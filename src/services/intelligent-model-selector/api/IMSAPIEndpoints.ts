/**
 * IMS API Endpoints - RESTful API endpoints for intelligent model routing
 * Implements Phase 2 API integration with streaming support and idempotency
 */

import { EventEmitter } from 'events';
import type { Request, Response } from 'express';
import { IMSRouter } from '../IMSRouter.js';
import { AdaptiveSSEController } from './AdaptiveSSEController.js';
import { IdempotencyManager } from '../IdempotencyManager.js';
import { TTFBAuditor } from '../TTFBAuditor.js';
import type { TaskInput } from '../types/TaskInput.js';

export interface APIEndpointConfig {
  enableStreaming: boolean;
  enableIdempotency: boolean;
  defaultStreamingQuality: 'fast' | 'balanced' | 'quality';
  maxRequestSize: number;
  rateLimitEnabled: boolean;
  corsEnabled: boolean;
}

export interface StreamingOptions {
  quality: 'fast' | 'balanced' | 'quality';
  enableSummarization: boolean;
  chunkSize?: number;
  flushInterval?: number;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
    traceId?: string;
  };
  metadata: {
    traceId: string;
    processedAt: string;
    ttfbMs: number;
    streamingEnabled?: boolean;
    idempotencyKey?: string;
  };
}

export class IMSAPIEndpoints extends EventEmitter {
  private readonly sseController: AdaptiveSSEController;
  
  constructor(
    private readonly config: APIEndpointConfig,
    private readonly dependencies: {
      imsRouter: IMSRouter;
      idempotencyManager: IdempotencyManager;
      ttfbAuditor: TTFBAuditor;
    }
  ) {
    super();
    
    this.sseController = new AdaptiveSSEController({
      maxConcurrentStreams: 100,
      defaultQuality: this.config.defaultStreamingQuality,
      enableBackpressure: true,
      backpressureThreshold: 50
    });
  }

  /**
   * POST /v1/chat - Chat completion with streaming support
   */
  async handleChatCompletion(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Extract and validate request
      const { messages, model, stream = false, ...options } = req.body;
      const idempotencyKey = req.headers['idempotency-key'] as string;
      
      if (!messages || !Array.isArray(messages)) {
        return this.sendError(res, 'INVALID_REQUEST', 'Messages array is required', startTime);
      }

      // Generate trace ID
      const traceId = this.generateTraceId();
      
      // Handle idempotency if key provided
      if (idempotencyKey) {
        const duplicate = this.dependencies.idempotencyManager.registerRequest(
          idempotencyKey,
          traceId,
          req.body,
          req.user?.id
        );

        if (duplicate.isDuplicate) {
          const cachedResponse = this.dependencies.idempotencyManager.getResponse(idempotencyKey);
          if (cachedResponse) {
            return this.sendCachedResponse(res, cachedResponse, startTime);
          }
          // If duplicate but no cached response, continue as new request
        }
      }

      // Convert to TaskInput
      const taskInput: TaskInput = {
        traceId,
        idempotencyKey: idempotencyKey || traceId,
        task: {
          kind: 'chat',
          subtype: 'completion',
          tokensIn: this.estimateTokens(messages),
          longContext: this.estimateTokens(messages) > 8000,
          modality: 'text'
        },
        content: messages,
        hints: {
          priority: options.priority || 'balanced',
          latencyBudgetMs: stream ? 500 : 2000,
          costTier: options.tier || 'mid'
        },
        session: {
          userId: req.user?.id,
          plan: req.user?.plan || 'free',
          currentUsage: await this.getCurrentUsage(req.user?.id),
          requestedAt: new Date()
        }
      };

      // Route through IMS
      const routingResult = await this.dependencies.imsRouter.route(taskInput);

      // Record TTFB
      const ttfbMs = Date.now() - startTime;
      this.dependencies.ttfbAuditor.recordMeasurement({
        traceId,
        timestamp: new Date(),
        breakdown: {
          authMs: 0, // Would be measured
          cacheMs: 0,
          rulesMs: 0,
          selectMs: ttfbMs,
          flushMs: 0,
          totalMs: ttfbMs,
          budgetCompliance: {
            auth: true,
            cache: true,
            rules: true,
            select: ttfbMs <= 10,
            flush: true,
            total: ttfbMs <= (stream ? 500 : 2000)
          }
        },
        metadata: {
          requestType: 'chat',
          userPlan: taskInput.session.plan,
          complexity: taskInput.task.longContext ? 'high' : 'medium'
        }
      });

      if (stream && this.config.enableStreaming) {
        return await this.handleStreamingResponse(req, res, taskInput, routingResult, startTime);
      } else {
        return await this.handleRegularResponse(req, res, taskInput, routingResult, startTime);
      }

    } catch (error) {
      this.emit('endpointError', { endpoint: '/v1/chat', error });
      return this.sendError(res, 'INTERNAL_ERROR', error.message, startTime);
    }
  }

  /**
   * POST /v1/code - Code generation with specialized routing
   */
  async handleCodeGeneration(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { instruction, language, context, stream = false, ...options } = req.body;
      const idempotencyKey = req.headers['idempotency-key'] as string;
      
      if (!instruction) {
        return this.sendError(res, 'INVALID_REQUEST', 'Instruction is required', startTime);
      }

      const traceId = this.generateTraceId();
      
      // Handle idempotency
      if (idempotencyKey) {
        const duplicate = this.dependencies.idempotencyManager.registerRequest(
          idempotencyKey,
          traceId,
          req.body,
          req.user?.id
        );

        if (duplicate.isDuplicate) {
          const cachedResponse = this.dependencies.idempotencyManager.getResponse(idempotencyKey);
          if (cachedResponse) {
            return this.sendCachedResponse(res, cachedResponse, startTime);
          }
        }
      }

      // Code-specific task input
      const taskInput: TaskInput = {
        traceId,
        idempotencyKey: idempotencyKey || traceId,
        task: {
          kind: 'code',
          subtype: language || 'general',
          tokensIn: this.estimateTokens([instruction, context].filter(Boolean)),
          longContext: Boolean(context && context.length > 4000),
          modality: 'text'
        },
        content: {
          instruction,
          language,
          context
        },
        hints: {
          priority: 'accuracy', // Code generation prioritizes accuracy
          latencyBudgetMs: stream ? 1000 : 5000, // More time for code
          costTier: options.tier || 'mid'
        },
        session: {
          userId: req.user?.id,
          plan: req.user?.plan || 'free',
          currentUsage: await this.getCurrentUsage(req.user?.id),
          requestedAt: new Date()
        }
      };

      const routingResult = await this.dependencies.imsRouter.route(taskInput);

      if (stream && this.config.enableStreaming) {
        return await this.handleStreamingResponse(req, res, taskInput, routingResult, startTime);
      } else {
        return await this.handleRegularResponse(req, res, taskInput, routingResult, startTime);
      }

    } catch (error) {
      this.emit('endpointError', { endpoint: '/v1/code', error });
      return this.sendError(res, 'INTERNAL_ERROR', error.message, startTime);
    }
  }

  /**
   * POST /v1/generate/image - Image generation routing
   */
  async handleImageGeneration(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { prompt, size, style, quality, ...options } = req.body;
      const idempotencyKey = req.headers['idempotency-key'] as string;
      
      if (!prompt) {
        return this.sendError(res, 'INVALID_REQUEST', 'Prompt is required', startTime);
      }

      const traceId = this.generateTraceId();
      
      // Handle idempotency
      if (idempotencyKey) {
        const duplicate = this.dependencies.idempotencyManager.registerRequest(
          idempotencyKey,
          traceId,
          req.body,
          req.user?.id
        );

        if (duplicate.isDuplicate) {
          const cachedResponse = this.dependencies.idempotencyManager.getResponse(idempotencyKey);
          if (cachedResponse) {
            return this.sendCachedResponse(res, cachedResponse, startTime);
          }
        }
      }

      const taskInput: TaskInput = {
        traceId,
        idempotencyKey: idempotencyKey || traceId,
        task: {
          kind: 'image',
          subtype: style || 'natural',
          tokensIn: this.estimateTokens(prompt),
          longContext: false,
          modality: 'image'
        },
        content: {
          prompt,
          size: size || '1024x1024',
          style,
          quality: quality || 'standard'
        },
        hints: {
          priority: 'quality', // Image generation prioritizes quality
          latencyBudgetMs: 10000, // Images take longer
          costTier: options.tier || 'high' // Images typically cost more
        },
        session: {
          userId: req.user?.id,
          plan: req.user?.plan || 'free',
          currentUsage: await this.getCurrentUsage(req.user?.id),
          requestedAt: new Date()
        }
      };

      const routingResult = await this.dependencies.imsRouter.route(taskInput);
      
      // Images don't stream, always regular response
      return await this.handleRegularResponse(req, res, taskInput, routingResult, startTime);

    } catch (error) {
      this.emit('endpointError', { endpoint: '/v1/generate/image', error });
      return this.sendError(res, 'INTERNAL_ERROR', error.message, startTime);
    }
  }

  /**
   * POST /v1/generate/audio - Audio generation routing
   */
  async handleAudioGeneration(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { text, voice, format, speed, ...options } = req.body;
      const idempotencyKey = req.headers['idempotency-key'] as string;
      
      if (!text) {
        return this.sendError(res, 'INVALID_REQUEST', 'Text is required', startTime);
      }

      const traceId = this.generateTraceId();
      
      // Handle idempotency
      if (idempotencyKey) {
        const duplicate = this.dependencies.idempotencyManager.registerRequest(
          idempotencyKey,
          traceId,
          req.body,
          req.user?.id
        );

        if (duplicate.isDuplicate) {
          const cachedResponse = this.dependencies.idempotencyManager.getResponse(idempotencyKey);
          if (cachedResponse) {
            return this.sendCachedResponse(res, cachedResponse, startTime);
          }
        }
      }

      const taskInput: TaskInput = {
        traceId,
        idempotencyKey: idempotencyKey || traceId,
        task: {
          kind: 'audio',
          subtype: voice || 'default',
          tokensIn: this.estimateTokens(text),
          longContext: text.length > 2000,
          modality: 'audio'
        },
        content: {
          text,
          voice,
          format: format || 'mp3',
          speed: speed || 1.0
        },
        hints: {
          priority: 'quality',
          latencyBudgetMs: 8000,
          costTier: options.tier || 'mid'
        },
        session: {
          userId: req.user?.id,
          plan: req.user?.plan || 'free',
          currentUsage: await this.getCurrentUsage(req.user?.id),
          requestedAt: new Date()
        }
      };

      const routingResult = await this.dependencies.imsRouter.route(taskInput);
      return await this.handleRegularResponse(req, res, taskInput, routingResult, startTime);

    } catch (error) {
      this.emit('endpointError', { endpoint: '/v1/generate/audio', error });
      return this.sendError(res, 'INTERNAL_ERROR', error.message, startTime);
    }
  }

  /**
   * GET /v1/health - Health check endpoint
   */
  async handleHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const health = await this.dependencies.imsRouter.getHealthStatus();
      const ttfbSummary = this.dependencies.ttfbAuditor.getRealTimeSummary();
      
      res.json({
        success: true,
        data: {
          status: health.status,
          components: health.components,
          performance: {
            averageTTFBMs: health.metrics.averageTTFBMs,
            recentTTFB: ttfbSummary.recentAverage,
            budgetCompliance: ttfbSummary.budgetComplianceRate
          },
          emergencyMode: health.metrics.emergencyMode
        },
        metadata: {
          traceId: this.generateTraceId(),
          processedAt: new Date().toISOString(),
          ttfbMs: 0
        }
      });
    } catch (error) {
      return this.sendError(res, 'HEALTH_CHECK_FAILED', error.message, Date.now());
    }
  }

  /**
   * Private methods for response handling
   */

  private async handleStreamingResponse(
    req: Request,
    res: Response,
    taskInput: TaskInput,
    routingResult: any,
    startTime: number
  ): Promise<void> {
    const streamingOptions: StreamingOptions = {
      quality: req.body.streaming_quality || this.config.defaultStreamingQuality,
      enableSummarization: req.body.enable_summarization !== false,
      chunkSize: req.body.chunk_size,
      flushInterval: req.body.flush_interval
    };

    try {
      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Trace-ID', taskInput.traceId);
      
      if (this.config.corsEnabled) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
      }

      // Send initial response
      const initialData = {
        traceId: taskInput.traceId,
        model: 'selected-model', // Don't expose actual model
        routingConfidence: routingResult.routing.confidence,
        streamingQuality: streamingOptions.quality
      };

      res.write(`data: ${JSON.stringify({ type: 'init', data: initialData })}\n\n`);

      // Start adaptive streaming
      await this.sseController.streamWithQualityControl(
        null, // Provider would be injected
        {
          taskInput,
          routingResult,
          streamingOptions
        },
        res,
        streamingOptions.quality
      );

      // Store response for idempotency
      if (taskInput.idempotencyKey) {
        this.dependencies.idempotencyManager.storeResponse(
          taskInput.idempotencyKey,
          taskInput.traceId,
          'streamed_response',
          200,
          { 'Content-Type': 'text/event-stream' }
        );
      }

    } catch (error) {
      this.emit('streamingError', { traceId: taskInput.traceId, error });
      
      // Send error event
      const errorEvent = {
        type: 'error',
        data: {
          code: 'STREAMING_ERROR',
          message: error.message,
          traceId: taskInput.traceId
        }
      };
      
      res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
      res.end();
    }
  }

  private async handleRegularResponse(
    req: Request,
    res: Response,
    taskInput: TaskInput,
    routingResult: any,
    startTime: number
  ): Promise<void> {
    try {
      // Simulate actual provider call here
      const providerResponse = await this.callProvider(taskInput, routingResult);
      
      const response: APIResponse = {
        success: true,
        data: providerResponse,
        metadata: {
          traceId: taskInput.traceId,
          processedAt: new Date().toISOString(),
          ttfbMs: Date.now() - startTime,
          idempotencyKey: taskInput.idempotencyKey !== taskInput.traceId ? taskInput.idempotencyKey : undefined
        }
      };

      // Store response for idempotency
      if (taskInput.idempotencyKey) {
        this.dependencies.idempotencyManager.storeResponse(
          taskInput.idempotencyKey,
          taskInput.traceId,
          response,
          200
        );
      }

      res.json(response);
    } catch (error) {
      this.emit('providerError', { traceId: taskInput.traceId, error });
      return this.sendError(res, 'PROVIDER_ERROR', error.message, startTime, taskInput.traceId);
    }
  }

  private sendError(
    res: Response,
    code: string,
    message: string,
    startTime: number,
    traceId?: string
  ): void {
    const response: APIResponse = {
      success: false,
      error: {
        code,
        message,
        traceId: traceId || this.generateTraceId()
      },
      metadata: {
        traceId: traceId || this.generateTraceId(),
        processedAt: new Date().toISOString(),
        ttfbMs: Date.now() - startTime
      }
    };

    const statusCode = this.getStatusCodeForError(code);
    res.status(statusCode).json(response);
  }

  private sendCachedResponse(res: Response, cachedResponse: any, startTime: number): void {
    const response = {
      ...cachedResponse.result,
      metadata: {
        ...cachedResponse.result.metadata,
        ttfbMs: Date.now() - startTime,
        cached: true,
        hitCount: cachedResponse.metadata.hitCount
      }
    };

    res.json(response);
  }

  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private estimateTokens(text: string | string[] | any): number {
    if (Array.isArray(text)) {
      return text.reduce((sum, item) => sum + this.estimateTokens(item), 0);
    }
    
    if (typeof text === 'object') {
      return this.estimateTokens(JSON.stringify(text));
    }
    
    const str = String(text);
    return Math.ceil(str.length / 4); // Rough estimate: 4 chars per token
  }

  private async getCurrentUsage(userId?: string): Promise<any> {
    // This would typically fetch from database
    return {
      inputTokens: 0,
      outputTokens: 0,
      monthStart: new Date()
    };
  }

  private async callProvider(taskInput: TaskInput, routingResult: any): Promise<any> {
    // This would call the actual provider based on routing result
    // For now, return mock response
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate latency
    
    return {
      content: `Simulated response for ${taskInput.task.kind} task`,
      model: 'selected-model', // Don't expose actual model
      usage: {
        prompt_tokens: taskInput.task.tokensIn,
        completion_tokens: 50,
        total_tokens: taskInput.task.tokensIn + 50
      }
    };
  }

  private getStatusCodeForError(code: string): number {
    const statusCodes: Record<string, number> = {
      'INVALID_REQUEST': 400,
      'UNAUTHORIZED': 401,
      'FORBIDDEN': 403,
      'NOT_FOUND': 404,
      'RATE_LIMIT': 429,
      'INTERNAL_ERROR': 500,
      'PROVIDER_ERROR': 502,
      'SERVICE_UNAVAILABLE': 503,
      'HEALTH_CHECK_FAILED': 503
    };

    return statusCodes[code] || 500;
  }

  /**
   * Cleanup method
   */
  cleanup(): void {
    this.sseController.cleanup();
    this.emit('cleanup');
  }
}