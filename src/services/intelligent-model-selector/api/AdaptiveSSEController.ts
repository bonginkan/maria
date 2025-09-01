/**
 * Adaptive SSE Controller - Server-Sent Events with intelligent quality control
 * Manages streaming quality based on network conditions and client capabilities
 */

import { EventEmitter } from 'events';
import type { Response } from 'express';

export interface ConstrainedQueue {
  items: QueueItem[];
  maxSize: number;
  currentSize: number;
  averageThroughput: number;
  lastFlushTime: number;
}

export interface QueueItem {
  data: string;
  timestamp: number;
  priority: 'low' | 'medium' | 'high';
  size: number;
}

export type SummarizationMode = 'punctuation' | 'semantic' | 'truncate' | 'none';
export type StreamingQuality = 'fast' | 'balanced' | 'quality';

export interface AdaptiveSSEConfig {
  maxConcurrentStreams: number;
  defaultQuality: StreamingQuality;
  enableBackpressure: boolean;
  backpressureThreshold: number;
  maxQueueSize: number;
  flushIntervalMs: number;
  adaptiveThresholds: {
    highThroughput: number; // tokens/sec
    mediumThroughput: number;
    lowThroughput: number;
  };
}

export interface StreamingMetrics {
  streamId: string;
  startTime: number;
  tokenCount: number;
  backpressureEvents: number;
  qualityDegradations: number;
  currentQuality: StreamingQuality;
  currentMode: SummarizationMode;
  throughputTokensPerSec: number;
  clientLatencyMs: number;
  queueUtilization: number;
}

export interface QualityControlDecision {
  newMode: SummarizationMode;
  reason: string;
  action: 'upgrade' | 'maintain' | 'degrade';
  confidence: number;
}

export class AdaptiveSSEController extends EventEmitter {
  private readonly activeStreams = new Map<string, StreamingMetrics>();
  private readonly streamQueues = new Map<string, ConstrainedQueue>();
  private readonly qualityAdaptationHistory = new Map<string, QualityControlDecision[]>();
  
  constructor(
    private readonly config: AdaptiveSSEConfig = {
      maxConcurrentStreams: 100,
      defaultQuality: 'balanced',
      enableBackpressure: true,
      backpressureThreshold: 50,
      maxQueueSize: 1000,
      flushIntervalMs: 16, // ~60fps
      adaptiveThresholds: {
        highThroughput: 50, // tokens/sec
        mediumThroughput: 20,
        lowThroughput: 5
      }
    }
  ) {
    super();
    
    // Start periodic maintenance
    setInterval(() => this.performMaintenance(), 1000);
  }

  /**
   * Start streaming with adaptive quality control
   */
  async streamWithQualityControl(
    provider: any,
    request: {
      taskInput: any;
      routingResult: any;
      streamingOptions: any;
    },
    response: Response,
    targetQuality: StreamingQuality
  ): Promise<void> {
    const streamId = this.generateStreamId();
    
    // Check concurrent stream limit
    if (this.activeStreams.size >= this.config.maxConcurrentStreams) {
      throw new Error('Maximum concurrent streams exceeded');
    }

    // Initialize streaming metrics
    const metrics: StreamingMetrics = {
      streamId,
      startTime: Date.now(),
      tokenCount: 0,
      backpressureEvents: 0,
      qualityDegradations: 0,
      currentQuality: targetQuality,
      currentMode: this.getInitialSummarizationMode(targetQuality),
      throughputTokensPerSec: 0,
      clientLatencyMs: 0,
      queueUtilization: 0
    };

    // Initialize queue
    const queue: ConstrainedQueue = {
      items: [],
      maxSize: this.config.maxQueueSize,
      currentSize: 0,
      averageThroughput: 0,
      lastFlushTime: Date.now()
    };

    this.activeStreams.set(streamId, metrics);
    this.streamQueues.set(streamId, queue);
    this.qualityAdaptationHistory.set(streamId, []);

    try {
      // Set up response monitoring
      this.setupResponseMonitoring(response, streamId);
      
      // Send stream initialization
      this.sendStreamEvent(response, {
        type: 'stream_init',
        data: {
          streamId,
          quality: targetQuality,
          mode: metrics.currentMode
        }
      });

      // Start the actual streaming
      await this.processStream(request, response, streamId);

    } catch (error) {
      this.handleStreamError(streamId, error);
      throw error;
    } finally {
      this.cleanupStream(streamId);
    }
  }

  /**
   * Get streaming statistics
   */
  getStreamingStatistics(): {
    activeStreams: number;
    totalProcessed: number;
    averageQuality: number;
    backpressureRate: number;
    qualityAdaptations: number;
  } {
    const streams = Array.from(this.activeStreams.values());
    
    return {
      activeStreams: streams.length,
      totalProcessed: streams.reduce((sum, s) => sum + s.tokenCount, 0),
      averageQuality: this.calculateAverageQuality(streams),
      backpressureRate: this.calculateBackpressureRate(streams),
      qualityAdaptations: streams.reduce((sum, s) => sum + s.qualityDegradations, 0)
    };
  }

  /**
   * Private methods
   */

  private async processStream(
    request: any,
    response: Response,
    streamId: string
  ): Promise<void> {
    const metrics = this.activeStreams.get(streamId)!;
    const queue = this.streamQueues.get(streamId)!;
    
    // Simulate token-by-token streaming
    const simulatedTokens = this.generateSimulatedTokenStream(request.taskInput);
    
    for (const token of simulatedTokens) {
      // Update metrics
      metrics.tokenCount++;
      const elapsed = Date.now() - metrics.startTime;
      metrics.throughputTokensPerSec = metrics.tokenCount / (elapsed / 1000);
      
      // Check if we can enqueue
      if (this.canEnqueue(queue)) {
        // Direct send for high-quality streaming
        this.sendStreamEvent(response, {
          type: 'token',
          data: { token, streamId }
        });
      } else {
        // Handle backpressure
        metrics.backpressureEvents++;
        
        if (this.config.enableBackpressure) {
          const qualityDecision = await this.adaptStreamingQuality(streamId, metrics, queue);
          
          if (qualityDecision.action === 'degrade') {
            metrics.qualityDegradations++;
            metrics.currentMode = qualityDecision.newMode;
            
            this.sendStreamEvent(response, {
              type: 'quality_change',
              data: {
                newMode: qualityDecision.newMode,
                reason: qualityDecision.reason,
                streamId
              }
            });
          }
          
          // Apply quality control
          const shouldSend = this.shouldSendToken(token, metrics.currentMode, queue);
          
          if (shouldSend) {
            this.sendStreamEvent(response, {
              type: 'token',
              data: { token, streamId }
            });
          } else {
            // Add to queue for potential summarization
            this.enqueueToken(queue, token);
          }
        }
      }
      
      // Periodic queue flush
      if (Date.now() - queue.lastFlushTime > this.config.flushIntervalMs) {
        await this.flushQueue(queue, response, streamId);
      }
      
      // Simulate network delay
      await this.simulateNetworkDelay();
    }
    
    // Final flush and completion
    await this.flushQueue(queue, response, streamId);
    this.sendStreamEvent(response, {
      type: 'stream_complete',
      data: {
        streamId,
        totalTokens: metrics.tokenCount,
        finalQuality: metrics.currentQuality,
        metrics: this.getStreamMetrics(streamId)
      }
    });
    
    response.end();
  }

  private async adaptStreamingQuality(
    streamId: string,
    metrics: StreamingMetrics,
    queue: ConstrainedQueue
  ): Promise<QualityControlDecision> {
    const history = this.qualityAdaptationHistory.get(streamId) || [];
    const queueUtilization = queue.currentSize / queue.maxSize;
    metrics.queueUtilization = queueUtilization;
    
    let decision: QualityControlDecision;
    
    // High backpressure - aggressive degradation
    if (queueUtilization > 0.8 && metrics.throughputTokensPerSec > this.config.adaptiveThresholds.highThroughput) {
      decision = {
        newMode: 'truncate',
        reason: 'High throughput detected, switching to truncate mode',
        action: 'degrade',
        confidence: 0.9
      };
    }
    // Medium backpressure - moderate degradation
    else if (queueUtilization > 0.6) {
      decision = {
        newMode: 'punctuation',
        reason: 'Medium backpressure, switching to punctuation boundaries',
        action: 'degrade',
        confidence: 0.7
      };
    }
    // Semantic summarization for balanced approach
    else if (queueUtilization > 0.4 && metrics.throughputTokensPerSec > this.config.adaptiveThresholds.mediumThroughput) {
      decision = {
        newMode: 'semantic',
        reason: 'Implementing semantic summarization for optimal balance',
        action: 'degrade',
        confidence: 0.8
      };
    }
    // Try to upgrade quality if conditions improve
    else if (queueUtilization < 0.2 && metrics.throughputTokensPerSec < this.config.adaptiveThresholds.lowThroughput) {
      const betterMode = this.getUpgradedMode(metrics.currentMode);
      decision = {
        newMode: betterMode,
        reason: 'Conditions improved, upgrading streaming quality',
        action: 'upgrade',
        confidence: 0.6
      };
    }
    // Maintain current quality
    else {
      decision = {
        newMode: metrics.currentMode,
        reason: 'Maintaining current streaming quality',
        action: 'maintain',
        confidence: 0.5
      };
    }

    // Record decision
    history.push(decision);
    this.qualityAdaptationHistory.set(streamId, history.slice(-10)); // Keep last 10

    this.emit('qualityAdaptation', {
      streamId,
      decision,
      metrics: { ...metrics },
      queueUtilization
    });

    return decision;
  }

  private shouldSendToken(token: string, mode: SummarizationMode, queue: ConstrainedQueue): boolean {
    switch (mode) {
      case 'none':
        return true;
      
      case 'punctuation':
        return /[.!?;:]/.test(token) || queue.items.length === 0;
      
      case 'semantic':
        // Simple semantic boundary detection
        return /[.!?]/.test(token) || 
               /\b(however|therefore|moreover|furthermore|consequently)\b/i.test(token) ||
               queue.items.length === 0;
      
      case 'truncate':
        return Math.random() < 0.1; // Send only 10% of tokens
      
      default:
        return true;
    }
  }

  private canEnqueue(queue: ConstrainedQueue): boolean {
    return queue.currentSize < queue.maxSize * (this.config.backpressureThreshold / 100);
  }

  private enqueueToken(queue: ConstrainedQueue, token: string): void {
    const item: QueueItem = {
      data: token,
      timestamp: Date.now(),
      priority: this.getTokenPriority(token),
      size: token.length
    };

    queue.items.push(item);
    queue.currentSize += item.size;

    // Remove oldest items if queue is full
    while (queue.currentSize > queue.maxSize && queue.items.length > 0) {
      const removed = queue.items.shift()!;
      queue.currentSize -= removed.size;
    }
  }

  private async flushQueue(queue: ConstrainedQueue, response: Response, streamId: string): Promise<void> {
    if (queue.items.length === 0) return;

    const summary = this.summarizeQueueItems(queue.items);
    
    if (summary) {
      this.sendStreamEvent(response, {
        type: 'summary',
        data: {
          content: summary,
          originalTokens: queue.items.length,
          streamId
        }
      });
    }

    // Clear queue
    queue.items = [];
    queue.currentSize = 0;
    queue.lastFlushTime = Date.now();
  }

  private summarizeQueueItems(items: QueueItem[]): string | null {
    if (items.length === 0) return null;

    // Simple summarization - in reality would use more sophisticated methods
    const text = items.map(item => item.data).join(' ');
    
    if (text.length < 50) return text;

    // Extract key sentences (simple heuristic)
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    if (sentences.length <= 2) return text;

    // Return first and last sentences as summary
    return `${sentences[0].trim()}... ${sentences[sentences.length - 1].trim()}`;
  }

  private sendStreamEvent(response: Response, event: { type: string; data: any }): void {
    try {
      const eventData = JSON.stringify(event);
      response.write(`event: ${event.type}\n`);
      response.write(`data: ${eventData}\n\n`);
    } catch (error) {
      this.emit('sendError', { error, event });
    }
  }

  private getInitialSummarizationMode(quality: StreamingQuality): SummarizationMode {
    switch (quality) {
      case 'fast': return 'truncate';
      case 'balanced': return 'punctuation';
      case 'quality': return 'none';
      default: return 'punctuation';
    }
  }

  private getUpgradedMode(currentMode: SummarizationMode): SummarizationMode {
    const hierarchy: SummarizationMode[] = ['truncate', 'punctuation', 'semantic', 'none'];
    const currentIndex = hierarchy.indexOf(currentMode);
    return hierarchy[Math.min(currentIndex + 1, hierarchy.length - 1)];
  }

  private getTokenPriority(token: string): QueueItem['priority'] {
    if (/[.!?]/.test(token)) return 'high';
    if (/[,:;]/.test(token)) return 'medium';
    return 'low';
  }

  private calculateAverageQuality(streams: StreamingMetrics[]): number {
    if (streams.length === 0) return 0;
    
    const qualityValues = { fast: 1, balanced: 2, quality: 3 };
    const total = streams.reduce((sum, s) => sum + qualityValues[s.currentQuality], 0);
    
    return total / streams.length;
  }

  private calculateBackpressureRate(streams: StreamingMetrics[]): number {
    if (streams.length === 0) return 0;
    
    const totalEvents = streams.reduce((sum, s) => sum + s.backpressureEvents, 0);
    const totalTokens = streams.reduce((sum, s) => sum + s.tokenCount, 0);
    
    return totalTokens > 0 ? totalEvents / totalTokens : 0;
  }

  private generateSimulatedTokenStream(taskInput: any): string[] {
    // Generate a realistic token stream for testing
    const baseText = "This is a simulated response that demonstrates streaming capabilities with adaptive quality control and backpressure handling.";
    return baseText.split(' ').map(word => word + ' ');
  }

  private async simulateNetworkDelay(): Promise<void> {
    // Simulate realistic network conditions
    const delay = Math.random() * 10 + 1; // 1-11ms random delay
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  private setupResponseMonitoring(response: Response, streamId: string): void {
    response.on('close', () => {
      this.emit('streamClosed', { streamId, reason: 'client_disconnected' });
      this.cleanupStream(streamId);
    });

    response.on('error', (error) => {
      this.emit('streamError', { streamId, error });
      this.cleanupStream(streamId);
    });
  }

  private handleStreamError(streamId: string, error: any): void {
    this.emit('streamError', { streamId, error });
    this.cleanupStream(streamId);
  }

  private cleanupStream(streamId: string): void {
    this.activeStreams.delete(streamId);
    this.streamQueues.delete(streamId);
    this.qualityAdaptationHistory.delete(streamId);
  }

  private generateStreamId(): string {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getStreamMetrics(streamId: string): StreamingMetrics | null {
    return this.activeStreams.get(streamId) || null;
  }

  private performMaintenance(): void {
    const now = Date.now();
    
    // Clean up stale streams (older than 5 minutes)
    for (const [streamId, metrics] of this.activeStreams.entries()) {
      if (now - metrics.startTime > 300000) {
        this.cleanupStream(streamId);
        this.emit('streamTimeout', { streamId });
      }
    }

    this.emit('maintenanceCompleted', {
      activeStreams: this.activeStreams.size,
      timestamp: new Date()
    });
  }

  /**
   * Cleanup method
   */
  cleanup(): void {
    for (const streamId of this.activeStreams.keys()) {
      this.cleanupStream(streamId);
    }
    
    this.emit('cleanup');
  }
}