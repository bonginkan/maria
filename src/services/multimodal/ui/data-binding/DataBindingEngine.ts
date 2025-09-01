/**
 * Real-time Data Binding Engine
 * Provides WebSocket-like real-time updates for dashboard widgets
 */

import { EventEmitter } from "node:events";

export interface DataSource {
  id: string;
  type: 'stream' | 'interval' | 'event';
  config: DataSourceConfig;
}

export interface DataSourceConfig {
  interval?: number;
  buffer?: number;
  transform?: (data: any) => any;
  filter?: (data: any) => boolean;
  debounce?: number;
}

export interface DataUpdate {
  sourceId: string;
  timestamp: Date;
  data: any;
  metadata?: {
    sequence?: number;
    batchId?: string;
    priority?: 'low' | 'normal' | 'high';
  };
}

export interface Subscription {
  id: string;
  widgetId: string;
  sourceId: string;
  active: boolean;
  lastUpdate?: Date;
  config: SubscriptionConfig;
}

export interface SubscriptionConfig {
  throttle?: number;
  aggregate?: 'none' | 'sum' | 'average' | 'latest';
  bufferSize?: number;
  onUpdate?: (data: any) => void;
  onError?: (error: Error) => void;
}

export class DataBindingEngine extends EventEmitter {
  private dataSources = new Map<string, DataSource>();
  private subscriptions = new Map<string, Subscription>();
  private dataBuffer = new Map<string, DataUpdate[]>();
  private timers = new Map<string, NodeJS.Timeout>();
  private sequenceCounters = new Map<string, number>();

  constructor() {
    super();
    this.setMaxListeners(100); // Support many widgets
  }

  // Data Source Management
  addDataSource(source: DataSource): void {
    this.dataSources.set(source.id, source);
    this.dataBuffer.set(source.id, []);
    this.sequenceCounters.set(source.id, 0);

    // Setup automatic data generation for interval sources
    if (source.type === 'interval' && source.config.interval) {
      this.startIntervalSource(source);
    }

    this.emit('source_added', source);
  }

  removeDataSource(sourceId: string): void {
    // Remove all subscriptions for this source
    const subscriptionsToRemove = Array.from(this.subscriptions.values())
      .filter(sub => sub.sourceId === sourceId);
    
    subscriptionsToRemove.forEach(sub => {
      this.unsubscribe(sub.id);
    });

    // Clean up timers
    const timer = this.timers.get(sourceId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(sourceId);
    }

    // Remove from maps
    this.dataSources.delete(sourceId);
    this.dataBuffer.delete(sourceId);
    this.sequenceCounters.delete(sourceId);

    this.emit('source_removed', sourceId);
  }

  // Subscription Management
  subscribe(widgetId: string, sourceId: string, config: SubscriptionConfig = {}): string {
    const source = this.dataSources.get(sourceId);
    if (!source) {
      throw new Error(`Data source '${sourceId}' not found`);
    }

    const subscriptionId = `${widgetId}:${sourceId}:${Date.now()}`;
    
    const subscription: Subscription = {
      id: subscriptionId,
      widgetId,
      sourceId,
      active: true,
      config
    };

    this.subscriptions.set(subscriptionId, subscription);

    // Send latest data immediately if available
    const buffer = this.dataBuffer.get(sourceId);
    if (buffer && buffer.length > 0) {
      const latestData = buffer[buffer.length - 1];
      this.deliverDataToSubscription(subscription, latestData);
    }

    this.emit('subscribed', { widgetId, sourceId, subscriptionId });
    return subscriptionId;
  }

  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.active = false;
      this.subscriptions.delete(subscriptionId);
      this.emit('unsubscribed', subscriptionId);
    }
  }

  unsubscribeWidget(widgetId: string): void {
    const subscriptionsToRemove = Array.from(this.subscriptions.values())
      .filter(sub => sub.widgetId === widgetId);
    
    subscriptionsToRemove.forEach(sub => {
      this.unsubscribe(sub.id);
    });
  }

  // Data Publishing
  push(sourceId: string, data: any, metadata: DataUpdate['metadata'] = {}): void {
    const source = this.dataSources.get(sourceId);
    if (!source) {
      console.warn(`Attempted to push to unknown data source: ${sourceId}`);
      return;
    }

    // Apply transformations and filters
    let processedData = data;
    if (source.config.transform) {
      processedData = source.config.transform(data);
    }

    if (source.config.filter && !source.config.filter(processedData)) {
      return; // Data filtered out
    }

    // Create update object
    const update: DataUpdate = {
      sourceId,
      timestamp: new Date(),
      data: processedData,
      metadata: {
        sequence: this.getNextSequence(sourceId),
        ...metadata
      }
    };

    // Add to buffer
    this.addToBuffer(sourceId, update);

    // Notify subscribers
    this.notifySubscribers(sourceId, update);

    this.emit('data_update', update);
  }

  // Bulk data operations
  pushBatch(sourceId: string, dataArray: any[], batchId?: string): void {
    const batchTimestamp = new Date();
    
    dataArray.forEach((data, index) => {
      this.push(sourceId, data, {
        batchId: batchId || `batch_${batchTimestamp.getTime()}`,
        sequence: index,
        priority: 'normal'
      });
    });
  }

  // Data retrieval
  getLatestData(sourceId: string): DataUpdate | undefined {
    const buffer = this.dataBuffer.get(sourceId);
    return buffer && buffer.length > 0 ? buffer[buffer.length - 1] : undefined;
  }

  getHistoricalData(sourceId: string, limit?: number): DataUpdate[] {
    const buffer = this.dataBuffer.get(sourceId) || [];
    return limit ? buffer.slice(-limit) : [...buffer];
  }

  // Statistics and monitoring
  getSourceStats(sourceId: string) {
    const buffer = this.dataBuffer.get(sourceId) || [];
    const subscriptions = Array.from(this.subscriptions.values())
      .filter(sub => sub.sourceId === sourceId && sub.active);

    return {
      bufferSize: buffer.length,
      activeSubscriptions: subscriptions.length,
      lastUpdate: buffer.length > 0 ? buffer[buffer.length - 1].timestamp : undefined,
      sequenceNumber: this.sequenceCounters.get(sourceId) || 0
    };
  }

  getGlobalStats() {
    return {
      totalSources: this.dataSources.size,
      totalSubscriptions: this.subscriptions.size,
      totalBufferSize: Array.from(this.dataBuffer.values()).reduce((sum, buffer) => sum + buffer.length, 0),
      activeTimers: this.timers.size
    };
  }

  // Cleanup
  dispose(): void {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();

    // Clear all data
    this.dataSources.clear();
    this.subscriptions.clear();
    this.dataBuffer.clear();
    this.sequenceCounters.clear();

    // Remove all listeners
    this.removeAllListeners();

    this.emit('disposed');
  }

  // Private methods
  private startIntervalSource(source: DataSource): void {
    if (!source.config.interval) return;

    const timer = setInterval(() => {
      // Generate sample data based on source type
      const sampleData = this.generateSampleData(source);
      this.push(source.id, sampleData);
    }, source.config.interval);

    this.timers.set(source.id, timer);
  }

  private generateSampleData(source: DataSource): any {
    // This would be replaced with real data generation logic
    switch (source.id) {
      case 'confidence':
        return {
          value: 0.5 + Math.random() * 0.4,
          timestamp: new Date()
        };
      case 'system_metrics':
        return {
          cpu: Math.random() * 100,
          memory: Math.random() * 8192,
          latency: Math.random() * 1000 + 50
        };
      case 'provider_status':
        return {
          openai: Math.random() > 0.1 ? 'active' : 'error',
          anthropic: Math.random() > 0.05 ? 'active' : 'idle',
          google: Math.random() > 0.2 ? 'active' : 'offline'
        };
      default:
        return { value: Math.random(), timestamp: new Date() };
    }
  }

  private addToBuffer(sourceId: string, update: DataUpdate): void {
    const buffer = this.dataBuffer.get(sourceId) || [];
    buffer.push(update);

    // Apply buffer size limit
    const source = this.dataSources.get(sourceId);
    const bufferSize = source?.config.buffer || 100;
    
    if (buffer.length > bufferSize) {
      buffer.shift(); // Remove oldest
    }

    this.dataBuffer.set(sourceId, buffer);
  }

  private notifySubscribers(sourceId: string, update: DataUpdate): void {
    const subscribers = Array.from(this.subscriptions.values())
      .filter(sub => sub.sourceId === sourceId && sub.active);

    subscribers.forEach(subscription => {
      this.deliverDataToSubscription(subscription, update);
    });
  }

  private deliverDataToSubscription(subscription: Subscription, update: DataUpdate): void {
    // Apply throttling
    if (subscription.config.throttle) {
      const timeSinceLastUpdate = subscription.lastUpdate 
        ? Date.now() - subscription.lastUpdate.getTime()
        : Infinity;
      
      if (timeSinceLastUpdate < subscription.config.throttle) {
        return; // Skip this update due to throttling
      }
    }

    subscription.lastUpdate = update.timestamp;

    try {
      // Apply aggregation if configured
      let processedData = update.data;
      if (subscription.config.aggregate !== 'none') {
        processedData = this.applyAggregation(subscription, update);
      }

      // Deliver to callback
      if (subscription.config.onUpdate) {
        subscription.config.onUpdate(processedData);
      }

      // Emit widget-specific event
      this.emit(`widget_update:${subscription.widgetId}`, {
        sourceId: subscription.sourceId,
        data: processedData,
        timestamp: update.timestamp
      });

    } catch (error) {
      if (subscription.config.onError) {
        subscription.config.onError(error as Error);
      }
      this.emit('subscription_error', { subscription, error });
    }
  }

  private applyAggregation(subscription: Subscription, update: DataUpdate): any {
    const bufferSize = subscription.config.bufferSize || 10;
    const buffer = this.dataBuffer.get(subscription.sourceId) || [];
    const recentData = buffer.slice(-bufferSize).map(u => u.data);

    switch (subscription.config.aggregate) {
      case 'sum':
        return recentData.reduce((sum, value) => {
          return typeof value === 'number' ? sum + value : sum + (value.value || 0);
        }, 0);
      
      case 'average':
        if (recentData.length === 0) return 0;
        const sum = recentData.reduce((sum, value) => {
          return typeof value === 'number' ? sum + value : sum + (value.value || 0);
        }, 0);
        return sum / recentData.length;
      
      case 'latest':
      default:
        return update.data;
    }
  }

  private getNextSequence(sourceId: string): number {
    const current = this.sequenceCounters.get(sourceId) || 0;
    const next = current + 1;
    this.sequenceCounters.set(sourceId, next);
    return next;
  }

  // Static factory methods for common data sources
  static createConfidenceSource(interval = 500): DataSource {
    return {
      id: 'confidence',
      type: 'interval',
      config: {
        interval,
        buffer: 50,
        transform: (data) => ({
          value: Math.max(0, Math.min(1, data.value)),
          timestamp: data.timestamp || new Date()
        })
      }
    };
  }

  static createSystemMetricsSource(interval = 1000): DataSource {
    return {
      id: 'system_metrics',
      type: 'interval',
      config: {
        interval,
        buffer: 30,
        transform: (data) => ({
          cpu: Math.max(0, Math.min(100, data.cpu)),
          memory: Math.max(0, data.memory),
          latency: Math.max(0, data.latency)
        })
      }
    };
  }

  static createProviderStatusSource(interval = 2000): DataSource {
    return {
      id: 'provider_status',
      type: 'interval',
      config: {
        interval,
        buffer: 20,
        filter: (data) => data && typeof data === 'object'
      }
    };
  }
}