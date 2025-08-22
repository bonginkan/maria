/**
 * Intelligent Router Service
 * Core routing logic for natural language to command mapping
 */

import { BaseService, Inject, Service, ServiceEvent } from '../core';

export interface CommandIntent {
  command: string;
  confidence: number;
  parameters: Record<string, any>;
  language: string;
  originalInput: string;
}

export interface RoutingResult {
  success: boolean;
  intent?: CommandIntent;
  fallbackToChat: boolean;
  processingTime: number;
  error?: string;
}

export interface RoutingRequest {
  input: string;
  context?: Record<string, any>;
  userId?: string;
}

@Service({
  id: 'intelligent-router',
  name: 'IntelligentRouterService',
  version: '1.0.0',
  description: 'Core intelligent routing service for natural language command mapping',
  dependencies: [
    'nlp-processor',
    'command-mapping',
    'parameter-extractor',
    'user-pattern-analyzer',
  ],
})
export class IntelligentRouterService extends BaseService {
  id = 'intelligent-router';
  version = '1.0.0';

  // Configuration
  private confidenceThreshold = 0.85;
  private maxProcessingTime = 200; // ms

  // Metrics
  private totalRequests = 0;
  private successfulRoutes = 0;
  private averageResponseTime = 0;

  async onInitialize(): Promise<void> {
    this.logger.info('Initializing Intelligent Router Service...');

    // Load configuration from environment
    this.confidenceThreshold = parseFloat(process.env.ROUTER_CONFIDENCE_THRESHOLD || '0.85');
    this.maxProcessingTime = parseInt(process.env.ROUTER_MAX_PROCESSING_TIME || '200');

    this.logger.info(`Router initialized with confidence threshold: ${this.confidenceThreshold}`);
  }

  async onStart(): Promise<void> {
    this.logger.info('Starting Intelligent Router Service...');
    this.emitServiceEvent('router:started', {
      service: this.id,
      confidenceThreshold: this.confidenceThreshold,
    });
  }

  /**
   * Main routing method - processes natural language input
   */
  async route(request: RoutingRequest): Promise<RoutingResult> {
    const startTime = performance.now();
    this.totalRequests++;

    try {
      // Step 1: Detect language
      const language = await this.callService<string>('nlp-processor', 'detectLanguage', {
        text: request.input,
      });

      // Step 2: Extract intent
      const intent = await this.callService<CommandIntent>('nlp-processor', 'extractIntent', {
        text: request.input,
        language,
        context: request.context,
      });

      // Step 3: Validate confidence threshold
      if (!intent || intent.confidence < this.confidenceThreshold) {
        const processingTime = performance.now() - startTime;
        return {
          success: false,
          fallbackToChat: true,
          processingTime,
        };
      }

      // Step 4: Extract parameters
      const parameters = await this.callService<Record<string, any>>(
        'parameter-extractor',
        'extractParameters',
        {
          input: request.input,
          command: intent.command,
          language,
        },
      );

      // Step 5: Update user patterns
      if (request.userId) {
        await this.callService('user-pattern-analyzer', 'recordPattern', {
          userId: request.userId,
          input: request.input,
          command: intent.command,
          language,
          success: true,
        });
      }

      const processingTime = performance.now() - startTime;
      this.updateMetrics(processingTime, true);

      // Emit routing success event
      this.emitServiceEvent('router:success', {
        command: intent.command,
        confidence: intent.confidence,
        processingTime,
        language,
      });

      return {
        success: true,
        intent: {
          ...intent,
          parameters: parameters || intent.parameters,
        },
        fallbackToChat: false,
        processingTime,
      };
    } catch (error) {
      const processingTime = performance.now() - startTime;
      this.updateMetrics(processingTime, false);

      this.logger.error('Routing failed:', error);

      // Emit routing error event
      this.emitServiceEvent('router:error', {
        error: error.message,
        input: request.input,
        processingTime,
      });

      return {
        success: false,
        fallbackToChat: true,
        processingTime,
        error: error.message,
      };
    }
  }

  /**
   * Batch route multiple inputs (for testing/analysis)
   */
  async batchRoute(requests: RoutingRequest[]): Promise<RoutingResult[]> {
    const results = await Promise.all(requests.map((request) => this.route(request)));

    // Emit batch processing event
    this.emitServiceEvent('router:batch_complete', {
      totalRequests: requests.length,
      successCount: results.filter((r) => r.success).length,
      averageTime: results.reduce((sum, r) => sum + r.processingTime, 0) / results.length,
    });

    return results;
  }

  /**
   * Get router statistics
   */
  getStats() {
    return {
      totalRequests: this.totalRequests,
      successfulRoutes: this.successfulRoutes,
      successRate: this.totalRequests > 0 ? (this.successfulRoutes / this.totalRequests) * 100 : 0,
      averageResponseTime: this.averageResponseTime,
      confidenceThreshold: this.confidenceThreshold,
    };
  }

  /**
   * Update router configuration
   */
  async updateConfig(config: {
    confidenceThreshold?: number;
    maxProcessingTime?: number;
  }): Promise<void> {
    if (config.confidenceThreshold !== undefined) {
      this.confidenceThreshold = config.confidenceThreshold;
    }
    if (config.maxProcessingTime !== undefined) {
      this.maxProcessingTime = config.maxProcessingTime;
    }

    this.emitServiceEvent('router:config_updated', {
      confidenceThreshold: this.confidenceThreshold,
      maxProcessingTime: this.maxProcessingTime,
    });

    this.logger.info('Router configuration updated:', config);
  }

  /**
   * Health check with router-specific metrics
   */
  async health() {
    const baseHealth = await super.health();

    return {
      ...baseHealth,
      metrics: {
        totalRequests: this.totalRequests,
        successRate:
          this.totalRequests > 0 ? (this.successfulRoutes / this.totalRequests) * 100 : 0,
        averageResponseTime: this.averageResponseTime,
        confidenceThreshold: this.confidenceThreshold,
      },
    };
  }

  private updateMetrics(processingTime: number, success: boolean): void {
    if (success) {
      this.successfulRoutes++;
    }

    // Update average response time (exponential moving average)
    if (this.averageResponseTime === 0) {
      this.averageResponseTime = processingTime;
    } else {
      this.averageResponseTime = this.averageResponseTime * 0.9 + processingTime * 0.1;
    }
  }
}
