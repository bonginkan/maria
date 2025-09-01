/**
 * Intelligent Router Service
 * Core routing logic for natural _language to command mapping
 */

import { BaseService, _Inject, Service, _ServiceEvent } from "../core";

export interface CommandIntent {
  command: string;
  confidence: number;
  _parameters: Record<string, any>;
  _language: string;
  originalInput: string;
}

export interface RoutingResult {
  success: boolean;
  _intent?: CommandIntent;
  fallbackToChat: boolean;
  _processingTime: number;
  _error?: string;
}

export interface RoutingRequest {
  input: string;
  context?: Record<string, any>;
  userId?: string;
}

@Service({
  id: "intelligent-router",
  name: "IntelligentRouterService",
  version: "1.0.0",
  description:
    "Core intelligent routing service for natural _language command mapping",
  dependencies: [
    "nlp-processor",
    "command-mapping",
    "parameter-extractor",
    "user-pattern-analyzer",
  ],
})
export class IntelligentRouterService extends BaseService {
  id = "intelligent-router";
  version = "1.0.0";

  // Configuration
  private confidenceThreshold = 0.85;
  private maxProcessingTime = 200; // ms

  // Metrics
  private totalRequests = 0;
  private successfulRoutes = 0;
  private averageResponseTime = 0;

  async onInitialize(): Promise<void> {
    this.logger.info("Initializing Intelligent Router Service...");

    // Load configuration from environment
    this.confidenceThreshold = parseFloat(
      process.env.ROUTER_CONFIDENCE_THRESHOLD || "0.85",
    );
    this.maxProcessingTime = parseInt(
      process.env.ROUTER_MAX_PROCESSING_TIME || "200",
    );

    this.logger.info(
      `Router initialized with confidence threshold: ${this.confidenceThreshold}`,
    );
  }

  async onStart(): Promise<void> {
    this.logger.info("Starting Intelligent Router Service...");
    this.emitServiceEvent("router:started", {
      service: this.id,
      confidenceThreshold: this.confidenceThreshold,
    });
  }

  /**
   * Main routing method - processes natural _language input
   */
  async route(request: RoutingRequest): Promise<RoutingResult> {
    const _startTime = performance.now();
    this.totalRequests++;

    try {
      // Step 1: Detect _language
      const _language = await this.callService<string>(
        "nlp-processor",
        "detectLanguage",
        {
          text: request.input,
        },
      );

      // Step 2: Extract _intent
      const _intent = await this.callService<CommandIntent>(
        "nlp-processor",
        "extractIntent",
        {
          text: request.input,
          _language,
          context: request.context,
        },
      );

      // Step 3: Validate confidence threshold
      if (!_intent || _intent.confidence < this.confidenceThreshold) {
        const _processingTime = performance.now() - _startTime;
        return {
          success: false,
          fallbackToChat: true,
          _processingTime,
        };
      }

      // Step 4: Extract _parameters
      const _parameters = await this.callService<Record<string, any>>(
        "parameter-extractor",
        "extractParameters",
        {
          input: request.input,
          command: _intent.command,
          _language,
        },
      );

      // Step 5: Update user patterns
      if (request.userId) {
        await this.callService("user-pattern-analyzer", "recordPattern", {
          userId: request.userId,
          input: request.input,
          command: _intent.command,
          _language,
          success: true,
        });
      }

      const _processingTime = performance.now() - _startTime;
      this.updateMetrics(_processingTime, true);

      // Emit routing success event
      this.emitServiceEvent("router:success", {
        command: _intent.command,
        confidence: _intent.confidence,
        _processingTime,
        _language,
      });

      return {
        success: true,
        _intent: {
          ..._intent,
          _parameters: _parameters || _intent._parameters,
        },
        fallbackToChat: false,
        _processingTime,
      };
    } catch (_error) {
      const _processingTime = performance.now() - _startTime;
      this.updateMetrics(_processingTime, false);

      this.logger.error("Routing failed:", _error);

      // Emit routing _error event
      this.emitServiceEvent("router:_error", {
        _error: _error.message,
        input: request.input,
        _processingTime,
      });

      return {
        success: false,
        fallbackToChat: true,
        _processingTime,
        _error: _error.message,
      };
    }
  }

  /**
   * Batch route multiple inputs (for testing/analysis)
   */
  async batchRoute(requests: RoutingRequest[]): Promise<RoutingResult[]> {
    const _results = await Promise.all(
      requests.map((request) => this.route(request)),
    );

    // Emit batch processing event
    this.emitServiceEvent("router:batch_complete", {
      totalRequests: requests.length,
      successCount: _results.filter((r) => r.success).length,
      averageTime:
        _results.reduce((sum, r) => sum + r.processingTime, 0) /
        _results.length,
    });

    return _results;
  }

  /**
   * Get router statistics
   */
  getStats() {
    return {
      totalRequests: this.totalRequests,
      successfulRoutes: this.successfulRoutes,
      successRate:
        this.totalRequests > 0
          ? (this.successfulRoutes / this.totalRequests) * 100
          : 0,
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

    this.emitServiceEvent("router:config_updated", {
      confidenceThreshold: this.confidenceThreshold,
      maxProcessingTime: this.maxProcessingTime,
    });

    this.logger.info("Router configuration updated:", config);
  }

  /**
   * Health check with router-specific metrics
   */
  async health() {
    const _baseHealth = await super.health();

    return {
      ..._baseHealth,
      metrics: {
        totalRequests: this.totalRequests,
        successRate:
          this.totalRequests > 0
            ? (this.successfulRoutes / this.totalRequests) * 100
            : 0,
        averageResponseTime: this.averageResponseTime,
        confidenceThreshold: this.confidenceThreshold,
      },
    };
  }

  private updateMetrics(_processingTime: number, success: boolean): void {
    if (success) {
      this.successfulRoutes++;
    }

    // Update average response time (exponential moving average)
    if (this.averageResponseTime === 0) {
      this.averageResponseTime = _processingTime;
    } else {
      this.averageResponseTime =
        this.averageResponseTime * 0.9 + _processingTime * 0.1;
    }
  }
}
