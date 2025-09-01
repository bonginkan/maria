/**
 * OpenTelemetry Tracing for Graph RAG 10T
 * 
 * Provides distributed tracing for:
 * - Search pipeline stages (BM25, Vector, KG, RRF, Rerank)
 * - External service calls (OpenSearch, Qdrant, Neo4j)
 * - Cache operations and database queries
 * - User request flows and error propagation
 */

import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/auto-instrumentations-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { performance } from 'node:perf_hooks';

// Service configuration
const SERVICE_NAME = 'graph-rag-10t';
const SERVICE_VERSION = process.env.SERVICE_VERSION || '1.0.0';
const JAEGER_ENDPOINT = process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces';

/**
 * Initialize OpenTelemetry tracing
 */
function initializeTracing() {
  // Configure Jaeger exporter
  const jaegerExporter = new JaegerExporter({
    endpoint: JAEGER_ENDPOINT,
  });

  // Create SDK
  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
      [SemanticResourceAttributes.SERVICE_VERSION]: SERVICE_VERSION,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development'
    }),
    traceExporter: jaegerExporter,
    instrumentations: [getNodeAutoInstrumentations({
      // Disable some instrumentations if needed
      '@opentelemetry/instrumentation-fs': {
        enabled: false
      }
    })]
  });

  // Start tracing
  sdk.start();
  console.log('📡 OpenTelemetry tracing initialized');

  return sdk;
}

// Initialize tracing (call once at app startup)
let tracingSDK = null;
export function startTracing() {
  if (!tracingSDK) {
    tracingSDK = initializeTracing();
  }
  return tracingSDK;
}

// Get tracer instance
const tracer = trace.getTracer(SERVICE_NAME, SERVICE_VERSION);

/**
 * Create a traced function wrapper
 * @param {string} spanName - Name of the span
 * @param {Function} fn - Function to trace
 * @param {object} options - Tracing options
 * @returns {Function} Wrapped function
 */
export function traced(spanName, fn, options = {}) {
  return async function tracedFunction(...args) {
    const span = tracer.startSpan(spanName, {
      kind: options.kind || SpanKind.INTERNAL,
      attributes: {
        'component': 'graph-rag',
        'operation.name': spanName,
        ...options.attributes
      }
    });

    // Set span as active
    return context.with(trace.setSpan(context.active(), span), async () => {
      const startTime = performance.now();
      
      try {
        // Add input attributes if provided
        if (options.addArgs && args.length > 0) {
          span.setAttributes({
            'args.count': args.length,
            'args.first': typeof args[0] === 'string' ? args[0].substring(0, 100) : JSON.stringify(args[0]).substring(0, 100)
          });
        }

        const result = await fn.apply(this, args);
        
        // Add result attributes
        if (options.addResult && result) {
          const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
          span.setAttributes({
            'result.type': typeof result,
            'result.length': Array.isArray(result) ? result.length : undefined,
            'result.preview': resultStr.substring(0, 200)
          });
        }

        span.setStatus({ code: SpanStatusCode.OK });
        return result;
        
      } catch (error) {
        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message
        });
        throw error;
        
      } finally {
        const duration = performance.now() - startTime;
        span.setAttributes({
          'duration.ms': duration,
          'timestamp.end': new Date().toISOString()
        });
        span.end();
      }
    });
  };
}

/**
 * Search pipeline tracer - specialized for search operations
 */
export class SearchTracer {
  constructor(query, options = {}) {
    this.query = query;
    this.options = options;
    this.rootSpan = tracer.startSpan('search.pipeline', {
      kind: SpanKind.SERVER,
      attributes: {
        'search.query': query.substring(0, 200),
        'search.language': options.language || 'unknown',
        'search.variant': options.variant || 'default',
        'search.topK': options.topK || 10,
        'search.kgBoost': options.kgBoost || false,
        'search.rerank': options.rerank || false
      }
    });
    
    this.context = trace.setSpan(context.active(), this.rootSpan);
    this.stages = new Map();
    this.startTime = performance.now();
  }

  /**
   * Start a search stage
   */
  startStage(stageName, attributes = {}) {
    const stageSpan = tracer.startSpan(`search.stage.${stageName}`, {
      kind: SpanKind.INTERNAL,
      parent: this.rootSpan,
      attributes: {
        'stage.name': stageName,
        'search.query': this.query.substring(0, 100),
        ...attributes
      }
    });

    const stageInfo = {
      span: stageSpan,
      startTime: performance.now(),
      context: trace.setSpan(this.context, stageSpan)
    };

    this.stages.set(stageName, stageInfo);
    return stageInfo;
  }

  /**
   * End a search stage
   */
  endStage(stageName, result = null, error = null) {
    const stageInfo = this.stages.get(stageName);
    if (!stageInfo) {
      console.warn(`Unknown stage: ${stageName}`);
      return;
    }

    const duration = performance.now() - stageInfo.startTime;
    const { span } = stageInfo;

    // Add stage-specific attributes
    span.setAttributes({
      'stage.duration.ms': duration,
      'stage.timestamp.end': new Date().toISOString()
    });

    if (result) {
      span.setAttributes({
        'stage.result.count': Array.isArray(result) ? result.length : 1,
        'stage.result.type': typeof result
      });

      // Add stage-specific result attributes
      this.addStageResultAttributes(stageName, span, result);
    }

    if (error) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message
      });
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }

    span.end();
    this.stages.delete(stageName);
  }

  /**
   * Add stage-specific result attributes
   */
  addStageResultAttributes(stageName, span, result) {
    switch (stageName) {
      case 'bm25':
        if (Array.isArray(result)) {
          const scores = result.map(r => r.score);
          span.setAttributes({
            'bm25.max_score': Math.max(...scores),
            'bm25.min_score': Math.min(...scores),
            'bm25.avg_score': scores.reduce((a, b) => a + b, 0) / scores.length
          });
        }
        break;

      case 'vector':
        if (Array.isArray(result)) {
          const similarities = result.map(r => r.similarity || r.score);
          span.setAttributes({
            'vector.max_similarity': Math.max(...similarities),
            'vector.min_similarity': Math.min(...similarities),
            'vector.avg_similarity': similarities.reduce((a, b) => a + b, 0) / similarities.length
          });
        }
        break;

      case 'kg':
        if (Array.isArray(result)) {
          const features = result.map(r => r.features || {});
          const mentions = features.map(f => f.mentions || 0);
          span.setAttributes({
            'kg.total_mentions': mentions.reduce((a, b) => a + b, 0),
            'kg.avg_mentions': mentions.length > 0 ? mentions.reduce((a, b) => a + b, 0) / mentions.length : 0,
            'kg.features_computed': features.length
          });
        }
        break;

      case 'rrf':
        if (Array.isArray(result)) {
          const rrfScores = result.map(r => r.rrfScore || r.score);
          span.setAttributes({
            'rrf.max_score': Math.max(...rrfScores),
            'rrf.sources_combined': new Set(result.flatMap(r => Object.keys(r.sourceRanks || {}))).size
          });
        }
        break;

      case 'rerank':
        if (Array.isArray(result)) {
          const rerankScores = result.map(r => r.rerankScore || r.score);
          const originalScores = result.map(r => r.originalScore || 0);
          const improvements = rerankScores.map((r, i) => r - originalScores[i]);
          
          span.setAttributes({
            'rerank.max_improvement': Math.max(...improvements),
            'rerank.min_improvement': Math.min(...improvements),
            'rerank.avg_improvement': improvements.reduce((a, b) => a + b, 0) / improvements.length
          });
        }
        break;
    }
  }

  /**
   * Run a stage with automatic tracing
   */
  async runStage(stageName, stageFunction, attributes = {}) {
    const stageInfo = this.startStage(stageName, attributes);
    
    try {
      const result = await context.with(stageInfo.context, stageFunction);
      this.endStage(stageName, result);
      return result;
    } catch (error) {
      this.endStage(stageName, null, error);
      throw error;
    }
  }

  /**
   * End the entire search pipeline
   */
  end(result = null, error = null) {
    const totalDuration = performance.now() - this.startTime;
    
    this.rootSpan.setAttributes({
      'search.total_duration.ms': totalDuration,
      'search.stages_count': this.stages.size,
      'search.timestamp.end': new Date().toISOString()
    });

    if (result) {
      this.rootSpan.setAttributes({
        'search.result.count': Array.isArray(result) ? result.length : 1,
        'search.result.has_results': Boolean(result && (!Array.isArray(result) || result.length > 0))
      });
    }

    if (error) {
      this.rootSpan.recordException(error);
      this.rootSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message
      });
    } else {
      this.rootSpan.setStatus({ code: SpanStatusCode.OK });
    }

    this.rootSpan.end();
  }
}

/**
 * External service tracer for database/API calls
 */
export function traceExternalService(serviceName, operation, fn, attributes = {}) {
  return traced(`external.${serviceName}.${operation}`, fn, {
    kind: SpanKind.CLIENT,
    attributes: {
      'service.name': serviceName,
      'operation.name': operation,
      'external.service': true,
      ...attributes
    },
    addArgs: true
  });
}

/**
 * Cache operation tracer
 */
export function traceCache(cacheType, operation, fn, attributes = {}) {
  return traced(`cache.${cacheType}.${operation}`, fn, {
    kind: SpanKind.INTERNAL,
    attributes: {
      'cache.type': cacheType,
      'cache.operation': operation,
      ...attributes
    }
  });
}

/**
 * Utility function to get current trace ID
 */
export function getCurrentTraceId() {
  const span = trace.getActiveSpan();
  if (span) {
    const spanContext = span.spanContext();
    return spanContext.traceId;
  }
  return null;
}

/**
 * Utility function to get current span ID
 */
export function getCurrentSpanId() {
  const span = trace.getActiveSpan();
  if (span) {
    const spanContext = span.spanContext();
    return spanContext.spanId;
  }
  return null;
}

/**
 * Add custom attributes to current span
 */
export function addAttributes(attributes) {
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttributes(attributes);
  }
}

/**
 * Record an event on current span
 */
export function addEvent(name, attributes = {}) {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Express middleware for request tracing
 */
export function tracingMiddleware() {
  return (req, res, next) => {
    const span = tracer.startSpan(`http.${req.method} ${req.route?.path || req.path}`, {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': req.method,
        'http.url': req.url,
        'http.path': req.path,
        'http.user_agent': req.headers['user-agent'],
        'http.remote_addr': req.ip,
        'request.id': req.headers['x-request-id'] || 'unknown'
      }
    });

    // Set span in context and attach to request
    const spanContext = trace.setSpan(context.active(), span);
    req.traceContext = spanContext;
    req.span = span;

    // Hook response end
    res.on('finish', () => {
      span.setAttributes({
        'http.status_code': res.statusCode,
        'http.response.size': res.get('content-length') || 0,
        'response.time.ms': Date.now() - req._startTime
      });

      if (res.statusCode >= 400) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${res.statusCode}`
        });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }

      span.end();
    });

    // Continue with request in span context
    context.with(spanContext, next);
  };
}

/**
 * Graceful shutdown
 */
export async function shutdownTracing() {
  if (tracingSDK) {
    await tracingSDK.shutdown();
    console.log('🔌 OpenTelemetry tracing shut down');
  }
}

// Export utility functions and classes
export {
  tracer,
  SearchTracer,
  traceExternalService,
  traceCache,
  getCurrentTraceId,
  getCurrentSpanId,
  addAttributes,
  addEvent,
  tracingMiddleware
};

export default {
  startTracing,
  traced,
  SearchTracer,
  traceExternalService,
  traceCache,
  tracingMiddleware,
  shutdownTracing,
  getCurrentTraceId,
  addAttributes
};