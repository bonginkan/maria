/**
 * Processor Registry - Modality Type Separation
 * Dynamic processor management with load balancing and health monitoring
 *
 * Features:
 * - Dynamic processor registration and discovery
 * - Load balancing across processor instances
 * - Health monitoring and automatic failover
 * - Performance-based routing
 * - Plugin architecture for extensibility
 */

import { EventEmitter } from "node:events";
import {
  ModalityType,
  MultimodalInput,
  ProcessedOutput,
  ProcessorPort,
  ProcessorHealthStatus,
  ProcessingMode,
  SecureProcessingContext,
  TypedEventEmitter,
} from "../core/types.js";

export interface ProcessorRegistryOptions {
  readonly healthCheckInterval: number; // milliseconds
  readonly unhealthyThreshold: number; // consecutive failed health checks
  readonly maxConcurrentRequests: number;
  readonly enableLoadBalancing: boolean;
  readonly enableHealthMonitoring: boolean;
  readonly processorTimeout: number; // milliseconds
}

export interface ProcessorInstance {
  readonly id: string;
  readonly processor: ProcessorPort;
  readonly registeredAt: Date;

  // Health tracking
  healthStatus: ProcessorHealthStatus;
  consecutiveFailures: number;
  lastHealthCheck: Date;

  // Load balancing
  activeRequests: number;
  totalRequests: number;
  totalErrors: number;
  averageResponseTime: number;

  // Performance metrics
  readonly metrics: {
    requestCount: number;
    errorCount: number;
    totalResponseTime: number;
    lastResponseTime: number;
    peakMemoryUsage: number;
    currentLoad: number; // 0-1 scale
  };
}

export interface LoadBalancingStrategy {
  selectProcessor(
    processors: ProcessorInstance[],
    input: MultimodalInput,
    options?: {
      mode?: ProcessingMode;
      preferStreaming?: boolean;
      avoidOverloaded?: boolean;
    },
  ): ProcessorInstance | null;
}

export class ProcessorRegistry {
  private readonly processors = new Map<string, ProcessorInstance[]>();
  private readonly eventEmitter: TypedEventEmitter;
  private readonly options: ProcessorRegistryOptions;
  private readonly loadBalancer: LoadBalancingStrategy;
  private healthCheckTimer?: NodeJS.Timeout;

  private static readonly DEFAULT_OPTIONS: ProcessorRegistryOptions = {
    healthCheckInterval: 30000, // 30 seconds
    unhealthyThreshold: 3,
    maxConcurrentRequests: 10,
    enableLoadBalancing: true,
    enableHealthMonitoring: true,
    processorTimeout: 60000, // 60 seconds
  };

  constructor(
    options?: Partial<ProcessorRegistryOptions>,
    loadBalancer?: LoadBalancingStrategy,
  ) {
    this.options = { ...ProcessorRegistry.DEFAULT_OPTIONS, ...options };
    this.eventEmitter = new EventEmitter() as TypedEventEmitter;
    this.loadBalancer = loadBalancer || new RoundRobinLoadBalancer();

    if (this.options.enableHealthMonitoring) {
      this.startHealthMonitoring();
    }
  }

  /**
   * Register a processor instance
   */
  async registerProcessor(
    processor: ProcessorPort,
    instanceId?: string,
  ): Promise<string> {
    const id = instanceId || this.generateInstanceId(processor.type);
    const modalityType = processor.type;

    // Initialize processor instance
    const instance: ProcessorInstance = {
      id,
      processor,
      registeredAt: new Date(),
      healthStatus: await this.checkProcessorHealth(processor),
      consecutiveFailures: 0,
      lastHealthCheck: new Date(),
      activeRequests: 0,
      totalRequests: 0,
      totalErrors: 0,
      averageResponseTime: 0,
      metrics: {
        requestCount: 0,
        errorCount: 0,
        totalResponseTime: 0,
        lastResponseTime: 0,
        peakMemoryUsage: 0,
        currentLoad: 0,
      },
    };

    // Add to registry
    if (!this.processors.has(modalityType)) {
      this.processors.set(modalityType, []);
    }

    const instances = this.processors.get(modalityType)!;
    instances.push(instance);

    this.eventEmitter.emit("processor.registered", {
      processorId: id,
      modalityType,
      healthy: instance.healthStatus.healthy,
    });

    return id;
  }

  /**
   * Unregister a processor instance
   */
  async unregisterProcessor(
    modalityType: ModalityType,
    instanceId: string,
  ): Promise<boolean> {
    const instances = this.processors.get(modalityType);
    if (!instances) return false;

    const index = instances.findIndex((instance) => instance.id === instanceId);
    if (index === -1) return false;

    const instance = instances[index];

    // Wait for active requests to complete (with timeout)
    await this.waitForRequestsToComplete(instance, 5000);

    instances.splice(index, 1);

    // Remove modality type if no instances left
    if (instances.length === 0) {
      this.processors.delete(modalityType);
    }

    this.eventEmitter.emit("processor.unregistered", {
      processorId: instanceId,
      modalityType,
    });

    return true;
  }

  /**
   * Process input using the best available processor
   */
  async processInput(
    input: MultimodalInput,
    options?: {
      mode?: ProcessingMode;
      securityContext?: SecureProcessingContext;
      signal?: AbortSignal;
      timeout?: number;
    },
  ): Promise<ProcessedOutput> {
    const instances = this.processors.get(input.type);
    if (!instances || instances.length === 0) {
      throw new ProcessorUnavailableError(input.type);
    }

    // Filter healthy processors
    const healthyProcessors = instances.filter(
      (instance) =>
        instance.healthStatus.healthy &&
        instance.activeRequests < this.options.maxConcurrentRequests,
    );

    if (healthyProcessors.length === 0) {
      throw new ProcessorOverloadedError(input.type);
    }

    // Select processor using load balancing strategy
    const selectedInstance = this.loadBalancer.selectProcessor(
      healthyProcessors,
      input,
      {
        mode: options?.mode,
        preferStreaming: options?.mode === "streaming",
        avoidOverloaded: true,
      },
    );

    if (!selectedInstance) {
      throw new ProcessorSelectionError(input.type);
    }

    return this.executeProcessing(selectedInstance, input, options);
  }

  /**
   * Get available processors for a modality type
   */
  getProcessors(modalityType: ModalityType): ProcessorInstance[] {
    return this.processors.get(modalityType)?.slice() || [];
  }

  /**
   * Get all registered modality types
   */
  getRegisteredModalityTypes(): ModalityType[] {
    return Array.from(this.processors.keys());
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalProcessors: number;
    healthyProcessors: number;
    activeRequests: number;
    totalRequests: number;
    totalErrors: number;
    averageResponseTime: number;
    modalityDistribution: Record<ModalityType, number>;
  } {
    let totalProcessors = 0;
    let healthyProcessors = 0;
    let activeRequests = 0;
    let totalRequests = 0;
    let totalErrors = 0;
    let totalResponseTime = 0;
    const modalityDistribution: Record<string, number> = {};

    for (const [modalityType, instances] of this.processors) {
      modalityDistribution[modalityType] = instances.length;

      for (const instance of instances) {
        totalProcessors++;
        if (instance.healthStatus.healthy) {
          healthyProcessors++;
        }
        activeRequests += instance.activeRequests;
        totalRequests += instance.totalRequests;
        totalErrors += instance.totalErrors;
        totalResponseTime += instance.metrics.totalResponseTime;
      }
    }

    return {
      totalProcessors,
      healthyProcessors,
      activeRequests,
      totalRequests,
      totalErrors,
      averageResponseTime:
        totalRequests > 0 ? totalResponseTime / totalRequests : 0,
      modalityDistribution: modalityDistribution as Record<
        ModalityType,
        number
      >,
    };
  }

  /**
   * Subscribe to registry events
   */
  on<K extends keyof ProcessorRegistryEvents>(
    event: K,
    listener: (data: ProcessorRegistryEvents[K]) => void,
  ): this {
    this.eventEmitter.on(event, listener);
    return this;
  }

  /**
   * Clean up resources
   */
  async shutdown(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    // Wait for all active requests to complete
    const activeInstances = Array.from(this.processors.values())
      .flat()
      .filter((instance) => instance.activeRequests > 0);

    await Promise.all(
      activeInstances.map((instance) =>
        this.waitForRequestsToComplete(instance, 10000),
      ),
    );

    this.processors.clear();
  }

  // Private methods

  private async executeProcessing(
    instance: ProcessorInstance,
    input: MultimodalInput,
    options?: {
      mode?: ProcessingMode;
      securityContext?: SecureProcessingContext;
      signal?: AbortSignal;
      timeout?: number;
    },
  ): Promise<ProcessedOutput> {
    const startTime = Date.now();

    // Track active request
    instance.activeRequests++;
    instance.totalRequests++;
    instance.metrics.requestCount++;

    try {
      // Create timeout signal if not provided
      const timeoutMs = options?.timeout || this.options.processorTimeout;
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

      // Combine signals
      const combinedSignal = options?.signal
        ? this.combineSignals([options.signal, timeoutController.signal])
        : timeoutController.signal;

      // Execute processing
      const result = await instance.processor.process(input, {
        signal: combinedSignal,
        deadlineAt: Date.now() + timeoutMs,
        mode: options?.mode,
        securityContext: options?.securityContext,
      });

      clearTimeout(timeoutId);

      // Update metrics
      const responseTime = Date.now() - startTime;
      this.updateInstanceMetrics(instance, responseTime, true);

      return result;
    } catch (error) {
      // Update error metrics
      const responseTime = Date.now() - startTime;
      this.updateInstanceMetrics(instance, responseTime, false);

      instance.totalErrors++;
      instance.metrics.errorCount++;

      // Update health status if needed
      if (this.isProcessorError(error)) {
        instance.consecutiveFailures++;
        if (instance.consecutiveFailures >= this.options.unhealthyThreshold) {
          instance.healthStatus = { ...instance.healthStatus, healthy: false };
        }
      }

      throw error;
    } finally {
      instance.activeRequests--;
    }
  }

  private updateInstanceMetrics(
    instance: ProcessorInstance,
    responseTime: number,
    success: boolean,
  ): void {
    instance.metrics.lastResponseTime = responseTime;
    instance.metrics.totalResponseTime += responseTime;

    // Update average response time
    instance.averageResponseTime =
      instance.metrics.totalResponseTime / instance.metrics.requestCount;

    // Update current load (0-1 scale)
    instance.metrics.currentLoad =
      instance.activeRequests / this.options.maxConcurrentRequests;

    if (success) {
      // Reset consecutive failures on success
      instance.consecutiveFailures = 0;
    }
  }

  private async checkProcessorHealth(
    processor: ProcessorPort,
  ): Promise<ProcessorHealthStatus> {
    try {
      return await processor.healthCheck();
    } catch (error) {
      return {
        healthy: false,
        latency: 0,
        errorRate: 1,
        memoryUsage: 0,
        queueDepth: 0,
        streamingCapable: false,
        lastError: error instanceof Error ? error.message : "Unknown error",
        lastHealthCheck: new Date(),
      };
    }
  }

  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(async () => {
      const healthCheckPromises: Promise<void>[] = [];

      for (const instances of this.processors.values()) {
        for (const instance of instances) {
          healthCheckPromises.push(this.performHealthCheck(instance));
        }
      }

      await Promise.allSettled(healthCheckPromises);
    }, this.options.healthCheckInterval);
  }

  private async performHealthCheck(instance: ProcessorInstance): Promise<void> {
    try {
      const healthStatus = await this.checkProcessorHealth(instance.processor);

      const wasHealthy = instance.healthStatus.healthy;
      instance.healthStatus = healthStatus;
      instance.lastHealthCheck = new Date();

      // Reset consecutive failures if healthy
      if (healthStatus.healthy) {
        instance.consecutiveFailures = 0;
      } else {
        instance.consecutiveFailures++;
      }

      // Emit health change events
      if (wasHealthy !== healthStatus.healthy) {
        this.eventEmitter.emit(
          healthStatus.healthy ? "processor.recovered" : "processor.unhealthy",
          {
            processorId: instance.id,
            modalityType: instance.processor.type,
            healthStatus,
          },
        );
      }
    } catch (error) {
      instance.consecutiveFailures++;
      instance.healthStatus = {
        ...instance.healthStatus,
        healthy: false,
        lastError:
          error instanceof Error ? error.message : "Health check failed",
        lastHealthCheck: new Date(),
      };
    }
  }

  private async waitForRequestsToComplete(
    instance: ProcessorInstance,
    timeoutMs: number,
  ): Promise<void> {
    const startTime = Date.now();

    while (instance.activeRequests > 0 && Date.now() - startTime < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  private combineSignals(signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();

    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort();
        break;
      }
      signal.addEventListener("abort", () => controller.abort());
    }

    return controller.signal;
  }

  private isProcessorError(error: unknown): boolean {
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      return (
        errorMessage.includes("processor") ||
        errorMessage.includes("processing") ||
        errorMessage.includes("internal")
      );
    }
    return false;
  }

  private generateInstanceId(modalityType: ModalityType): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${modalityType}_${timestamp}_${random}`;
  }
}

/**
 * Round-robin load balancing strategy
 */
class RoundRobinLoadBalancer implements LoadBalancingStrategy {
  private roundRobinCounters = new Map<ModalityType, number>();

  selectProcessor(
    processors: ProcessorInstance[],
    input: MultimodalInput,
    options?: {
      mode?: ProcessingMode;
      preferStreaming?: boolean;
      avoidOverloaded?: boolean;
    },
  ): ProcessorInstance | null {
    if (processors.length === 0) return null;

    // Filter based on options
    let candidates = processors;

    if (options?.preferStreaming) {
      const streamingCapable = candidates.filter(
        (p) => p.processor.canStream && p.processor.canStream(input),
      );
      if (streamingCapable.length > 0) {
        candidates = streamingCapable;
      }
    }

    if (options?.avoidOverloaded) {
      candidates = candidates.filter((p) => p.metrics.currentLoad < 0.8);
      if (candidates.length === 0) {
        candidates = processors; // Fallback to all processors
      }
    }

    // Round-robin selection
    const modalityType = input.type;
    const currentIndex = this.roundRobinCounters.get(modalityType) || 0;
    const selectedIndex = currentIndex % candidates.length;

    this.roundRobinCounters.set(modalityType, currentIndex + 1);

    return candidates[selectedIndex];
  }
}

/**
 * Performance-based load balancing strategy
 */
export class PerformanceLoadBalancer implements LoadBalancingStrategy {
  selectProcessor(
    processors: ProcessorInstance[],
    input: MultimodalInput,
    options?: {
      mode?: ProcessingMode;
      preferStreaming?: boolean;
      avoidOverloaded?: boolean;
    },
  ): ProcessorInstance | null {
    if (processors.length === 0) return null;

    // Calculate scores based on performance metrics
    const scoredProcessors = processors.map((processor) => {
      let score = 0;

      // Lower response time is better
      score += (1 / Math.max(processor.averageResponseTime, 1)) * 1000;

      // Lower current load is better
      score += (1 - processor.metrics.currentLoad) * 100;

      // Lower error rate is better
      const errorRate =
        processor.metrics.errorCount /
        Math.max(processor.metrics.requestCount, 1);
      score += (1 - errorRate) * 50;

      // Streaming preference
      if (options?.preferStreaming && processor.processor.canStream?.(input)) {
        score += 25;
      }

      return { processor, score };
    });

    // Sort by score (highest first) and select the best
    scoredProcessors.sort((a, b) => b.score - a.score);

    return scoredProcessors[0].processor;
  }
}

// Event types
export interface ProcessorRegistryEvents {
  "processor.registered": {
    processorId: string;
    modalityType: ModalityType;
    healthy: boolean;
  };
  "processor.unregistered": { processorId: string; modalityType: ModalityType };
  "processor.unhealthy": {
    processorId: string;
    modalityType: ModalityType;
    healthStatus: ProcessorHealthStatus;
  };
  "processor.recovered": {
    processorId: string;
    modalityType: ModalityType;
    healthStatus: ProcessorHealthStatus;
  };
}

// Error classes
export class ProcessorUnavailableError extends Error {
  constructor(modalityType: ModalityType) {
    super(`No processors available for modality type: ${modalityType}`);
    this.name = "ProcessorUnavailableError";
  }
}

export class ProcessorOverloadedError extends Error {
  constructor(modalityType: ModalityType) {
    super(`All processors for ${modalityType} are overloaded`);
    this.name = "ProcessorOverloadedError";
  }
}

export class ProcessorSelectionError extends Error {
  constructor(modalityType: ModalityType) {
    super(`Failed to select processor for ${modalityType}`);
    this.name = "ProcessorSelectionError";
  }
}
