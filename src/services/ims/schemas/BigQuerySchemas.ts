/**
 * BigQuery Schema Definitions for IMS Decision Logging v1.0
 * Complete table schemas for decision analytics and monitoring
 * Phase 2 implementation
 */

/**
 * Dataset: maria_ims
 * Tables:
 * - routing_decisions - All routing decisions with full context
 * - performance_metrics - Aggregated performance data
 * - cost_analytics - Cost tracking and optimization
 * - error_logs - Error tracking and debugging
 * - user_patterns - User behavior and preference learning
 */

// ============================================================================
// Table: routing_decisions
// Stores every routing decision for analysis and replay
// ============================================================================

export const ROUTING_DECISIONS_SCHEMA = {
  name: 'routing_decisions',
  description: 'Complete routing decision log with full context for replay and analysis',
  timePartitioning: {
    type: 'DAY',
    field: 'timestamp',
    expirationMs: 90 * 24 * 60 * 60 * 1000 // 90 days
  },
  clustering: {
    fields: ['user_id', 'selected_model', 'timestamp']
  },
  schema: [
    {
      name: 'trace_id',
      type: 'STRING',
      mode: 'REQUIRED',
      description: 'Unique trace ID for the request'
    },
    {
      name: 'timestamp',
      type: 'TIMESTAMP',
      mode: 'REQUIRED',
      description: 'Decision timestamp'
    },
    {
      name: 'user_id',
      type: 'STRING',
      mode: 'REQUIRED',
      description: 'User identifier (hashed for privacy)'
    },
    {
      name: 'user_tier',
      type: 'STRING',
      mode: 'REQUIRED',
      description: 'User subscription tier'
    },
    {
      name: 'request_context',
      type: 'RECORD',
      mode: 'REQUIRED',
      fields: [
        { name: 'intent', type: 'STRING', mode: 'REQUIRED' },
        { name: 'complexity', type: 'STRING', mode: 'REQUIRED' },
        { name: 'prompt_tokens', type: 'INTEGER', mode: 'REQUIRED' },
        { name: 'max_tokens', type: 'INTEGER', mode: 'NULLABLE' },
        { name: 'temperature', type: 'FLOAT', mode: 'NULLABLE' },
        { name: 'streaming', type: 'BOOLEAN', mode: 'REQUIRED' },
        { name: 'priority', type: 'STRING', mode: 'NULLABLE' },
        { name: 'session_id', type: 'STRING', mode: 'NULLABLE' }
      ]
    },
    {
      name: 'selected_model',
      type: 'STRING',
      mode: 'REQUIRED',
      description: 'Primary model selected'
    },
    {
      name: 'fallback_models',
      type: 'STRING',
      mode: 'REPEATED',
      description: 'Ordered list of fallback models'
    },
    {
      name: 'policy_applied',
      type: 'RECORD',
      mode: 'REQUIRED',
      fields: [
        { name: 'policy_id', type: 'STRING', mode: 'REQUIRED' },
        { name: 'policy_version', type: 'STRING', mode: 'REQUIRED' },
        { name: 'matched_rules', type: 'STRING', mode: 'REPEATED' }
      ]
    },
    {
      name: 'scoring',
      type: 'RECORD',
      mode: 'REPEATED',
      fields: [
        { name: 'model', type: 'STRING', mode: 'REQUIRED' },
        { name: 'total_score', type: 'FLOAT', mode: 'REQUIRED' },
        { name: 'latency_score', type: 'FLOAT', mode: 'REQUIRED' },
        { name: 'cost_score', type: 'FLOAT', mode: 'REQUIRED' },
        { name: 'quality_score', type: 'FLOAT', mode: 'REQUIRED' },
        { name: 'availability_score', type: 'FLOAT', mode: 'REQUIRED' }
      ]
    },
    {
      name: 'health_snapshot',
      type: 'RECORD',
      mode: 'REPEATED',
      fields: [
        { name: 'model', type: 'STRING', mode: 'REQUIRED' },
        { name: 'status', type: 'STRING', mode: 'REQUIRED' },
        { name: 'latency_ms', type: 'INTEGER', mode: 'NULLABLE' },
        { name: 'success_rate', type: 'FLOAT', mode: 'NULLABLE' },
        { name: 'circuit_breaker_state', type: 'STRING', mode: 'NULLABLE' }
      ]
    },
    {
      name: 'performance',
      type: 'RECORD',
      mode: 'REQUIRED',
      fields: [
        { name: 'decision_latency_ms', type: 'INTEGER', mode: 'REQUIRED' },
        { name: 'ttfb_ms', type: 'INTEGER', mode: 'NULLABLE' },
        { name: 'total_latency_ms', type: 'INTEGER', mode: 'NULLABLE' },
        { name: 'tokens_per_second', type: 'FLOAT', mode: 'NULLABLE' }
      ]
    },
    {
      name: 'cost',
      type: 'RECORD',
      mode: 'NULLABLE',
      fields: [
        { name: 'estimated_cents', type: 'FLOAT', mode: 'REQUIRED' },
        { name: 'actual_cents', type: 'FLOAT', mode: 'NULLABLE' },
        { name: 'input_tokens', type: 'INTEGER', mode: 'NULLABLE' },
        { name: 'output_tokens', type: 'INTEGER', mode: 'NULLABLE' }
      ]
    },
    {
      name: 'outcome',
      type: 'RECORD',
      mode: 'NULLABLE',
      fields: [
        { name: 'success', type: 'BOOLEAN', mode: 'REQUIRED' },
        { name: 'actual_model_used', type: 'STRING', mode: 'NULLABLE' },
        { name: 'fallback_used', type: 'BOOLEAN', mode: 'REQUIRED' },
        { name: 'fallback_reason', type: 'STRING', mode: 'NULLABLE' },
        { name: 'error_code', type: 'STRING', mode: 'NULLABLE' },
        { name: 'error_message', type: 'STRING', mode: 'NULLABLE' }
      ]
    },
    {
      name: 'metadata',
      type: 'RECORD',
      mode: 'NULLABLE',
      fields: [
        { name: 'client_version', type: 'STRING', mode: 'NULLABLE' },
        { name: 'server_version', type: 'STRING', mode: 'NULLABLE' },
        { name: 'environment', type: 'STRING', mode: 'NULLABLE' },
        { name: 'region', type: 'STRING', mode: 'NULLABLE' },
        { name: 'experiment_ids', type: 'STRING', mode: 'REPEATED' }
      ]
    }
  ]
};

// ============================================================================
// Table: performance_metrics
// Aggregated performance metrics for monitoring and alerting
// ============================================================================

export const PERFORMANCE_METRICS_SCHEMA = {
  name: 'performance_metrics',
  description: 'Aggregated performance metrics by model and time window',
  timePartitioning: {
    type: 'HOUR',
    field: 'window_start',
    expirationMs: 30 * 24 * 60 * 60 * 1000 // 30 days
  },
  clustering: {
    fields: ['model', 'window_start']
  },
  schema: [
    {
      name: 'window_start',
      type: 'TIMESTAMP',
      mode: 'REQUIRED',
      description: 'Start of aggregation window'
    },
    {
      name: 'window_end',
      type: 'TIMESTAMP',
      mode: 'REQUIRED',
      description: 'End of aggregation window'
    },
    {
      name: 'model',
      type: 'STRING',
      mode: 'REQUIRED',
      description: 'Model identifier'
    },
    {
      name: 'request_count',
      type: 'INTEGER',
      mode: 'REQUIRED',
      description: 'Total requests in window'
    },
    {
      name: 'success_count',
      type: 'INTEGER',
      mode: 'REQUIRED',
      description: 'Successful requests'
    },
    {
      name: 'error_count',
      type: 'INTEGER',
      mode: 'REQUIRED',
      description: 'Failed requests'
    },
    {
      name: 'fallback_count',
      type: 'INTEGER',
      mode: 'REQUIRED',
      description: 'Requests that used fallback'
    },
    {
      name: 'latency_stats',
      type: 'RECORD',
      mode: 'REQUIRED',
      fields: [
        { name: 'min_ms', type: 'INTEGER', mode: 'REQUIRED' },
        { name: 'max_ms', type: 'INTEGER', mode: 'REQUIRED' },
        { name: 'avg_ms', type: 'FLOAT', mode: 'REQUIRED' },
        { name: 'median_ms', type: 'FLOAT', mode: 'REQUIRED' },
        { name: 'p50_ms', type: 'INTEGER', mode: 'REQUIRED' },
        { name: 'p75_ms', type: 'INTEGER', mode: 'REQUIRED' },
        { name: 'p90_ms', type: 'INTEGER', mode: 'REQUIRED' },
        { name: 'p95_ms', type: 'INTEGER', mode: 'REQUIRED' },
        { name: 'p99_ms', type: 'INTEGER', mode: 'REQUIRED' }
      ]
    },
    {
      name: 'ttfb_stats',
      type: 'RECORD',
      mode: 'NULLABLE',
      fields: [
        { name: 'avg_ms', type: 'FLOAT', mode: 'REQUIRED' },
        { name: 'p50_ms', type: 'INTEGER', mode: 'REQUIRED' },
        { name: 'p95_ms', type: 'INTEGER', mode: 'REQUIRED' },
        { name: 'p99_ms', type: 'INTEGER', mode: 'REQUIRED' }
      ]
    },
    {
      name: 'throughput_stats',
      type: 'RECORD',
      mode: 'NULLABLE',
      fields: [
        { name: 'avg_tokens_per_second', type: 'FLOAT', mode: 'REQUIRED' },
        { name: 'total_input_tokens', type: 'INTEGER', mode: 'REQUIRED' },
        { name: 'total_output_tokens', type: 'INTEGER', mode: 'REQUIRED' }
      ]
    },
    {
      name: 'error_breakdown',
      type: 'RECORD',
      mode: 'REPEATED',
      fields: [
        { name: 'error_code', type: 'STRING', mode: 'REQUIRED' },
        { name: 'count', type: 'INTEGER', mode: 'REQUIRED' }
      ]
    }
  ]
};

// ============================================================================
// Table: cost_analytics
// Cost tracking and optimization analytics
// ============================================================================

export const COST_ANALYTICS_SCHEMA = {
  name: 'cost_analytics',
  description: 'Cost tracking by user, model, and time period',
  timePartitioning: {
    type: 'DAY',
    field: 'date',
    expirationMs: 365 * 24 * 60 * 60 * 1000 // 1 year
  },
  clustering: {
    fields: ['user_id', 'model', 'date']
  },
  schema: [
    {
      name: 'date',
      type: 'DATE',
      mode: 'REQUIRED',
      description: 'Date of aggregation'
    },
    {
      name: 'user_id',
      type: 'STRING',
      mode: 'REQUIRED',
      description: 'User identifier (hashed)'
    },
    {
      name: 'user_tier',
      type: 'STRING',
      mode: 'REQUIRED',
      description: 'User subscription tier'
    },
    {
      name: 'model',
      type: 'STRING',
      mode: 'REQUIRED',
      description: 'Model identifier'
    },
    {
      name: 'request_count',
      type: 'INTEGER',
      mode: 'REQUIRED',
      description: 'Number of requests'
    },
    {
      name: 'total_input_tokens',
      type: 'INTEGER',
      mode: 'REQUIRED',
      description: 'Total input tokens'
    },
    {
      name: 'total_output_tokens',
      type: 'INTEGER',
      mode: 'REQUIRED',
      description: 'Total output tokens'
    },
    {
      name: 'estimated_cost_cents',
      type: 'FLOAT',
      mode: 'REQUIRED',
      description: 'Estimated cost in cents'
    },
    {
      name: 'actual_cost_cents',
      type: 'FLOAT',
      mode: 'NULLABLE',
      description: 'Actual billed cost in cents'
    },
    {
      name: 'cost_savings_cents',
      type: 'FLOAT',
      mode: 'NULLABLE',
      description: 'Savings from optimization'
    },
    {
      name: 'optimization_applied',
      type: 'STRING',
      mode: 'REPEATED',
      description: 'Optimization techniques used'
    }
  ]
};

// ============================================================================
// Table: error_logs
// Detailed error tracking for debugging
// ============================================================================

export const ERROR_LOGS_SCHEMA = {
  name: 'error_logs',
  description: 'Detailed error logs for debugging and monitoring',
  timePartitioning: {
    type: 'DAY',
    field: 'timestamp',
    expirationMs: 30 * 24 * 60 * 60 * 1000 // 30 days
  },
  clustering: {
    fields: ['error_code', 'model', 'timestamp']
  },
  schema: [
    {
      name: 'error_id',
      type: 'STRING',
      mode: 'REQUIRED',
      description: 'Unique error identifier'
    },
    {
      name: 'timestamp',
      type: 'TIMESTAMP',
      mode: 'REQUIRED',
      description: 'Error timestamp'
    },
    {
      name: 'trace_id',
      type: 'STRING',
      mode: 'REQUIRED',
      description: 'Request trace ID'
    },
    {
      name: 'user_id',
      type: 'STRING',
      mode: 'REQUIRED',
      description: 'User identifier (hashed)'
    },
    {
      name: 'model',
      type: 'STRING',
      mode: 'REQUIRED',
      description: 'Model that failed'
    },
    {
      name: 'error_code',
      type: 'STRING',
      mode: 'REQUIRED',
      description: 'Error code'
    },
    {
      name: 'error_message',
      type: 'STRING',
      mode: 'REQUIRED',
      description: 'Error message (PII redacted)'
    },
    {
      name: 'error_type',
      type: 'STRING',
      mode: 'REQUIRED',
      description: 'Error classification'
    },
    {
      name: 'severity',
      type: 'STRING',
      mode: 'REQUIRED',
      description: 'Error severity level'
    },
    {
      name: 'stack_trace',
      type: 'STRING',
      mode: 'NULLABLE',
      description: 'Stack trace (PII redacted)'
    },
    {
      name: 'context',
      type: 'JSON',
      mode: 'NULLABLE',
      description: 'Additional error context'
    },
    {
      name: 'recovery_action',
      type: 'STRING',
      mode: 'NULLABLE',
      description: 'Action taken to recover'
    },
    {
      name: 'recovered',
      type: 'BOOLEAN',
      mode: 'REQUIRED',
      description: 'Whether recovery was successful'
    }
  ]
};

// ============================================================================
// Table: user_patterns
// User behavior patterns for preference learning
// ============================================================================

export const USER_PATTERNS_SCHEMA = {
  name: 'user_patterns',
  description: 'User behavior patterns and preferences',
  timePartitioning: {
    type: 'DAY',
    field: 'updated_at',
    expirationMs: 180 * 24 * 60 * 60 * 1000 // 180 days
  },
  clustering: {
    fields: ['user_id', 'updated_at']
  },
  schema: [
    {
      name: 'user_id',
      type: 'STRING',
      mode: 'REQUIRED',
      description: 'User identifier (hashed)'
    },
    {
      name: 'updated_at',
      type: 'TIMESTAMP',
      mode: 'REQUIRED',
      description: 'Last update timestamp'
    },
    {
      name: 'total_requests',
      type: 'INTEGER',
      mode: 'REQUIRED',
      description: 'Total requests by user'
    },
    {
      name: 'model_preferences',
      type: 'RECORD',
      mode: 'REPEATED',
      fields: [
        { name: 'model', type: 'STRING', mode: 'REQUIRED' },
        { name: 'usage_count', type: 'INTEGER', mode: 'REQUIRED' },
        { name: 'success_rate', type: 'FLOAT', mode: 'REQUIRED' },
        { name: 'avg_satisfaction', type: 'FLOAT', mode: 'NULLABLE' }
      ]
    },
    {
      name: 'intent_distribution',
      type: 'RECORD',
      mode: 'REPEATED',
      fields: [
        { name: 'intent', type: 'STRING', mode: 'REQUIRED' },
        { name: 'count', type: 'INTEGER', mode: 'REQUIRED' },
        { name: 'percentage', type: 'FLOAT', mode: 'REQUIRED' }
      ]
    },
    {
      name: 'complexity_preference',
      type: 'STRING',
      mode: 'REQUIRED',
      description: 'Typical complexity level'
    },
    {
      name: 'avg_prompt_length',
      type: 'INTEGER',
      mode: 'REQUIRED',
      description: 'Average prompt length in tokens'
    },
    {
      name: 'peak_usage_hours',
      type: 'INTEGER',
      mode: 'REPEATED',
      description: 'Hours of peak usage (0-23)'
    },
    {
      name: 'latency_sensitivity',
      type: 'STRING',
      mode: 'REQUIRED',
      description: 'User latency tolerance level'
    },
    {
      name: 'feature_usage',
      type: 'JSON',
      mode: 'NULLABLE',
      description: 'Features used by the user'
    }
  ]
};

// ============================================================================
// View: decision_replay_view
// Materialized view for decision replay and debugging
// ============================================================================

export const DECISION_REPLAY_VIEW = `
CREATE OR REPLACE VIEW \`maria_ims.decision_replay_view\` AS
SELECT
  rd.trace_id,
  rd.timestamp,
  rd.user_id,
  rd.user_tier,
  rd.request_context,
  rd.selected_model,
  rd.fallback_models,
  rd.policy_applied,
  rd.scoring,
  rd.health_snapshot,
  rd.performance,
  rd.cost,
  rd.outcome,
  -- Enriched fields
  pm.latency_stats.p95_ms as model_p95_latency,
  pm.success_count / pm.request_count as model_success_rate,
  ca.actual_cost_cents as actual_cost,
  up.model_preferences,
  up.latency_sensitivity
FROM
  \`maria_ims.routing_decisions\` rd
LEFT JOIN
  \`maria_ims.performance_metrics\` pm
  ON rd.selected_model = pm.model
  AND DATE(rd.timestamp) = DATE(pm.window_start)
LEFT JOIN
  \`maria_ims.cost_analytics\` ca
  ON rd.user_id = ca.user_id
  AND rd.selected_model = ca.model
  AND DATE(rd.timestamp) = ca.date
LEFT JOIN
  \`maria_ims.user_patterns\` up
  ON rd.user_id = up.user_id
WHERE
  rd.timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
`;

// ============================================================================
// BigQuery Client Configuration
// ============================================================================

export interface BigQueryConfig {
  projectId: string;
  datasetId: string;
  location: string;
  credentials?: {
    client_email: string;
    private_key: string;
  };
}

export const DEFAULT_BIGQUERY_CONFIG: BigQueryConfig = {
  projectId: 'maria-code-470602',
  datasetId: 'maria_ims',
  location: 'US'
};

// ============================================================================
// Table Creation Scripts
// ============================================================================

export const CREATE_DATASET_SCRIPT = `
CREATE SCHEMA IF NOT EXISTS \`maria-code-470602.maria_ims\`
OPTIONS(
  description="MARIA Intelligence Model Selector analytics dataset",
  location="US",
  default_table_expiration_ms=7776000000
);
`;

export const CREATE_TABLES_SCRIPT = `
-- Create routing_decisions table
${generateCreateTableScript(ROUTING_DECISIONS_SCHEMA)}

-- Create performance_metrics table
${generateCreateTableScript(PERFORMANCE_METRICS_SCHEMA)}

-- Create cost_analytics table
${generateCreateTableScript(COST_ANALYTICS_SCHEMA)}

-- Create error_logs table
${generateCreateTableScript(ERROR_LOGS_SCHEMA)}

-- Create user_patterns table
${generateCreateTableScript(USER_PATTERNS_SCHEMA)}

-- Create decision replay view
${DECISION_REPLAY_VIEW}
`;

function generateCreateTableScript(schema: any): string {
  // Helper function to generate CREATE TABLE statement from schema
  // This would be implemented to convert the schema object to SQL
  return `-- Table: ${schema.name}\n-- ${schema.description}`;
}