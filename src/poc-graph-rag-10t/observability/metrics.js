/**
 * Enhanced Prometheus Metrics for Graph RAG 10T
 * 
 * Provides comprehensive monitoring for:
 * - Search pipeline stage performance
 * - Quality metrics and cache performance  
 * - Error tracking and system health
 * - User behavior and feedback
 */

import client from 'prom-client';

// Enable default metrics collection
client.collectDefaultMetrics({
  timeout: 5000,
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
});

// === Search Performance Metrics ===

/**
 * End-to-end search latency histogram
 */
export const searchLatency = new client.Histogram({
  name: 'graphrag_search_latency_seconds',
  help: 'End-to-end search request latency in seconds',
  labelNames: ['stage', 'language', 'variant'],
  buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 1.5, 2, 3, 5, 10]
});

/**
 * Search stage latency (individual components)
 */
export const stageLatency = new client.Histogram({
  name: 'graphrag_stage_latency_seconds', 
  help: 'Individual search stage latency in seconds',
  labelNames: ['stage', 'language'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.2, 0.5, 1, 2]
});

/**
 * Search requests counter
 */
export const searchRequests = new client.Counter({
  name: 'graphrag_search_requests_total',
  help: 'Total number of search requests',
  labelNames: ['status', 'language', 'variant', 'user_type']
});

/**
 * Search throughput gauge
 */
export const searchThroughput = new client.Gauge({
  name: 'graphrag_search_throughput_per_second',
  help: 'Current search requests per second',
  labelNames: ['window']
});

// === Quality Metrics ===

/**
 * Search quality scores
 */
export const searchQuality = new client.Histogram({
  name: 'graphrag_search_quality_score',
  help: 'Search quality metrics (nDCG, MRR, etc.)',
  labelNames: ['metric', 'variant', 'language'],
  buckets: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
});

/**
 * Result relevance distribution
 */
export const resultRelevance = new client.Histogram({
  name: 'graphrag_result_relevance',
  help: 'Distribution of result relevance scores',
  labelNames: ['source', 'position'],
  buckets: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
});

/**
 * User feedback scores
 */
export const userFeedback = new client.Counter({
  name: 'graphrag_user_feedback_total',
  help: 'User feedback events (thumbs up/down, ratings)',
  labelNames: ['type', 'score', 'query_type']
});

// === Cache Performance ===

/**
 * Cache hit rates
 */
export const cacheHits = new client.Counter({
  name: 'graphrag_cache_hits_total',
  help: 'Cache hit events',
  labelNames: ['cache_type', 'status']
});

/**
 * Cache latency
 */
export const cacheLatency = new client.Histogram({
  name: 'graphrag_cache_latency_seconds',
  help: 'Cache operation latency',
  labelNames: ['cache_type', 'operation'],
  buckets: [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2]
});

/**
 * Cache size and utilization
 */
export const cacheSize = new client.Gauge({
  name: 'graphrag_cache_size_bytes',
  help: 'Current cache size in bytes',
  labelNames: ['cache_type']
});

export const cacheUtilization = new client.Gauge({
  name: 'graphrag_cache_utilization_ratio',
  help: 'Cache utilization ratio (0-1)',
  labelNames: ['cache_type']
});

// === Error Tracking ===

/**
 * Stage-specific errors
 */
export const stageErrors = new client.Counter({
  name: 'graphrag_stage_errors_total',
  help: 'Errors by search stage',
  labelNames: ['stage', 'error_type', 'severity']
});

/**
 * External service errors
 */
export const externalServiceErrors = new client.Counter({
  name: 'graphrag_external_service_errors_total',
  help: 'External service errors',
  labelNames: ['service', 'error_code', 'retry_attempt']
});

/**
 * Rate limiting events
 */
export const rateLimitEvents = new client.Counter({
  name: 'graphrag_rate_limit_events_total',
  help: 'Rate limiting events',
  labelNames: ['limit_type', 'action']
});

// === System Health ===

/**
 * Active connections
 */
export const activeConnections = new client.Gauge({
  name: 'graphrag_active_connections',
  help: 'Number of active connections',
  labelNames: ['connection_type']
});

/**
 * Queue sizes
 */
export const queueSize = new client.Gauge({
  name: 'graphrag_queue_size',
  help: 'Current queue sizes',
  labelNames: ['queue_type']
});

/**
 * Resource utilization
 */
export const resourceUtilization = new client.Gauge({
  name: 'graphrag_resource_utilization_ratio',
  help: 'Resource utilization ratios',
  labelNames: ['resource_type', 'instance']
});

// === Knowledge Graph Metrics ===

/**
 * KG feature computation time
 */
export const kgFeatureLatency = new client.Histogram({
  name: 'graphrag_kg_feature_latency_seconds',
  help: 'KG feature computation latency',
  labelNames: ['feature_type'],
  buckets: [0.001, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1]
});

/**
 * KG boost effectiveness
 */
export const kgBoostImpact = new client.Histogram({
  name: 'graphrag_kg_boost_impact',
  help: 'Impact of KG boost on result rankings',
  labelNames: ['boost_type'],
  buckets: [-1, -0.5, -0.2, -0.1, 0, 0.1, 0.2, 0.5, 1, 2]
});

/**
 * Entity extraction metrics
 */
export const entityExtraction = new client.Counter({
  name: 'graphrag_entity_extraction_total',
  help: 'Entity extraction events',
  labelNames: ['entity_type', 'confidence_bucket']
});

// === User Behavior ===

/**
 * Click-through rates
 */
export const clickThrough = new client.Counter({
  name: 'graphrag_click_through_total',
  help: 'Click-through events',
  labelNames: ['position', 'result_type']
});

/**
 * Session duration
 */
export const sessionDuration = new client.Histogram({
  name: 'graphrag_session_duration_seconds',
  help: 'User session duration',
  buckets: [1, 5, 10, 30, 60, 300, 600, 1800, 3600]
});

/**
 * Query complexity
 */
export const queryComplexity = new client.Histogram({
  name: 'graphrag_query_complexity',
  help: 'Query complexity metrics',
  labelNames: ['complexity_type'],
  buckets: [1, 2, 5, 10, 20, 50, 100, 200]
});

// === Business Metrics ===

/**
 * Search success rate
 */
export const searchSuccessRate = new client.Gauge({
  name: 'graphrag_search_success_rate',
  help: 'Search success rate over time window',
  labelNames: ['window', 'definition']
});

/**
 * User satisfaction
 */
export const userSatisfaction = new client.Histogram({
  name: 'graphrag_user_satisfaction_score',
  help: 'User satisfaction scores',
  labelNames: ['metric_type'],
  buckets: [1, 2, 3, 4, 5]
});

// === Utility Functions ===

/**
 * Record search request with comprehensive metrics
 */
export function recordSearch(duration, language, variant, status, stage = 'total') {
  searchLatency.labels(stage, language, variant).observe(duration / 1000);
  searchRequests.labels(status, language, variant, 'user').inc();
}

/**
 * Record stage performance
 */
export function recordStage(stageName, duration, language) {
  stageLatency.labels(stageName, language).observe(duration / 1000);
}

/**
 * Record cache operation
 */
export function recordCache(cacheType, operation, hit, duration) {
  const status = hit ? 'hit' : 'miss';
  cacheHits.labels(cacheType, status).inc();
  
  if (duration !== undefined) {
    cacheLatency.labels(cacheType, operation).observe(duration / 1000);
  }
}

/**
 * Record error with context
 */
export function recordError(stage, errorType, severity = 'error') {
  stageErrors.labels(stage, errorType, severity).inc();
}

/**
 * Record quality metrics
 */
export function recordQuality(metric, score, variant, language) {
  searchQuality.labels(metric, variant, language).observe(score);
}

/**
 * Record user feedback
 */
export function recordFeedback(type, score, queryType) {
  userFeedback.labels(type, score.toString(), queryType).inc();
}

/**
 * Update system health metrics
 */
export function updateHealth(connections, queueSizes, resourceUsage) {
  if (connections) {
    Object.entries(connections).forEach(([type, count]) => {
      activeConnections.labels(type).set(count);
    });
  }
  
  if (queueSizes) {
    Object.entries(queueSizes).forEach(([type, size]) => {
      queueSize.labels(type).set(size);
    });
  }
  
  if (resourceUsage) {
    Object.entries(resourceUsage).forEach(([resource, usage]) => {
      if (typeof usage === 'object') {
        Object.entries(usage).forEach(([instance, value]) => {
          resourceUtilization.labels(resource, instance).set(value);
        });
      } else {
        resourceUtilization.labels(resource, 'default').set(usage);
      }
    });
  }
}

/**
 * Create a timer for measuring durations
 */
export function createTimer() {
  const start = process.hrtime.bigint();
  
  return {
    end() {
      const end = process.hrtime.bigint();
      return Number(end - start) / 1000000; // Convert to milliseconds
    }
  };
}

/**
 * Middleware for automatic request metrics
 */
export function metricsMiddleware() {
  return (req, res, next) => {
    const timer = createTimer();
    
    // Extract request info
    const language = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'unknown';
    const variant = req.query.variant || 'default';
    const userType = req.headers.authorization ? 'authenticated' : 'anonymous';
    
    // Hook into response finish
    res.on('finish', () => {
      const duration = timer.end();
      const status = res.statusCode < 400 ? 'success' : 'error';
      
      searchRequests.labels(status, language, variant, userType).inc();
      
      if (req.path.includes('/search')) {
        searchLatency.labels('total', language, variant).observe(duration / 1000);
      }
    });
    
    next();
  };
}

/**
 * Get metrics registry for exposition
 */
export function getRegistry() {
  return client.register;
}

/**
 * Clear all metrics (useful for testing)
 */
export function clearMetrics() {
  client.register.clear();
}

export default {
  // Metrics
  searchLatency,
  stageLatency,
  searchRequests,
  searchThroughput,
  searchQuality,
  cacheHits,
  cacheLatency,
  stageErrors,
  userFeedback,
  
  // Functions
  recordSearch,
  recordStage,
  recordCache,
  recordError,
  recordQuality,
  recordFeedback,
  updateHealth,
  createTimer,
  metricsMiddleware,
  getRegistry,
  clearMetrics
};