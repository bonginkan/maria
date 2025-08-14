/**
 * Auto-Improve CLI Commands
 * Provides command-line interface for the Auto-Improve Engine
 */

import React from 'react';
import { Box, Text, Newline } from 'ink';
import { logger } from '../utils/logger';
import { ApprovalWorkflow, PerformanceMetrics } from '../types/common';
// Type definitions for auto-improve functionality
export enum AutoImproveMode {
  MANUAL = 'manual',
  SEMI_AUTO = 'semi-auto',
  FULL_AUTO = 'full-auto',
}

export interface ImprovementGoal {
  type: string;
  priority: number;
  description: string;
}

export interface AutoImproveConfig {
  mode: AutoImproveMode;
  goals: ImprovementGoal[];
  safetyLevel: SafetyLevel;
  maxSuggestions: number;
  confidence: number;
}

export interface ImprovementSuggestion {
  id: string;
  title: string;
  description: string;
  goal: string;
  impact: 'low' | 'medium' | 'high';
  impact_level: 'low' | 'medium' | 'high';
  confidence: number;
  confidence_score: number;
  estimated_time_minutes: number;
  files_affected?: string[];
  changes: Array<{
    file: string;
    type: string;
    details: string;
  }>;
}

export enum SafetyLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

// Mock implementations for now
const autoImproveEngine = {
  initialize: async (_config: AutoImproveConfig) => {},
  analyze: async (): Promise<ImprovementSuggestion[]> => [],
  apply: async (_suggestions: ImprovementSuggestion[]) => ({
    success: true,
    applied: 0,
    failed: 0,
    details: [],
  }),
  getStatus: () => ({
    isRunning: false,
    suggestions: 0,
    applied: 0,
    failed: 0,
  }),
  startMonitoring: async () => {},
  stopMonitoring: async () => {},
  generateSuggestions: async (_goals?: string[]): Promise<ImprovementSuggestion[]> => [],
  getAllSuggestions: (): ImprovementSuggestion[] => [],
  approveImplementation: async (_id: string) => ({ success: true }),
  rejectSuggestion: async (_id: string) => ({ success: true }),
};

const approvalManager = {
  requestApproval: async (_suggestions: ImprovementSuggestion[]) => _suggestions,
  getApprovalStatus: () => 'pending',
  getAllWorkflows: (): ApprovalWorkflow[] => [],
};

const safetyEngine = {
  validate: async (_suggestions: ImprovementSuggestion[]) => ({ safe: true, warnings: [] }),
  setSafetyLevel: (_level: SafetyLevel) => {},
  configure: async (_config: unknown) => {},
  getSafetyMetrics: () => ({
    safety_violations_total: 0,
    violations_detected: 0,
    current_safety_score: 100,
    manual_reviews_required: 0,
    total_checks_performed: 0,
  }),
};

const metricsCollector = {
  collect: async () => ({}),
  report: () => {},
  collectPerformanceMetrics: async (): Promise<PerformanceMetrics> => ({
    cpu_usage: 0,
    memory_usage: 0,
    response_time_ms: 0,
    total_suggestions_generated: 0,
    suggestions_accepted: 0,
    suggestions_rejected: 0,
    suggestions_generated_total: 0,
    success_rate: 0,
    average_implementation_time_ms: 0,
    rollback_rate: 0,
    impact_distribution: { low: 0, medium: 0, high: 0 },
    safety_violations_total: 0,
    user_satisfaction_score: 0,
    automation_rate: 0,
    time_to_approval_avg_hours: 0,
    total_checks_performed: 0,
    violations_detected: 0,
    current_safety_score: 100,
    manual_reviews_required: 0,
  }),
  collectQualityMetrics: async () => ({}),
};

const fileOperations = {
  backup: async () => {},
  restore: async () => {},
  getChanges: () => [],
  createSnapshot: async () => ({ id: '', timestamp: new Date(), files: [] }),
  restoreFromSnapshot: async (_snapshotId: string) => ({ success: true }),
};

// CLI Command interfaces
export interface AutoImproveCliOptions {
  mode?: AutoImproveMode;
  goals?: ImprovementGoal[];
  safetyLevel?: SafetyLevel;
  maxSuggestions?: number;
  confidence?: number;
  dryRun?: boolean;
  interactive?: boolean;
  output?: 'json' | 'table' | 'summary';
  verbose?: boolean;
}

export interface AutoImproveStatus {
  engineStatus: 'stopped' | 'running' | 'paused' | 'error';
  mode: AutoImproveMode;
  activeSuggestions: number;
  pendingApprovals: number;
  safetyViolations: number;
  uptime: string;
  lastActivity: Date | null;
}

// CLI Command Components
export const AutoImproveCommand: React.FC<{ options: AutoImproveCliOptions }> = ({ options }) => {
  const [status, setStatus] = React.useState<string>('Initializing...');
  const [suggestions, setSuggestions] = React.useState<ImprovementSuggestion[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const runAutoImprove = async () => {
      try {
        setStatus('Configuring Auto-Improve Engine...');

        // Configure the engine
        const config: AutoImproveConfig = {
          mode: options.mode || AutoImproveMode.MANUAL,
          goals: options.goals || [
            { type: 'code_quality', priority: 1, description: 'Improve code quality' },
            { type: 'security', priority: 1, description: 'Enhance security' },
          ],
          safetyLevel: options.safetyLevel || SafetyLevel.MEDIUM,
          maxSuggestions: options.maxSuggestions || 10,
          confidence: options.confidence || 0.7,
        };

        await autoImproveEngine.initialize(config);

        if (options.safetyLevel) {
          await safetyEngine.configure({
            safety_level: options.safetyLevel,
            enabled_categories: ['destructive', 'security', 'data_integrity', 'system_stability'],
            allow_bypasses: false,
            require_approval_for_bypasses: true,
            max_risk_score: 0.3,
            backup_retention_hours: 24,
            enable_rollback_testing: true,
            enable_pre_commit_hooks: true,
            notification_on_violations: true,
          });
        }

        if (options.dryRun) {
          setStatus('Running in dry-run mode - no changes will be applied');
        } else {
          setStatus('Starting monitoring...');
          await autoImproveEngine.startMonitoring();
        }

        setStatus('Generating improvement suggestions...');
        const goalStrings = options.goals?.map((g) => g.type) || undefined;
        const generatedSuggestions = await autoImproveEngine.generateSuggestions(goalStrings);
        setSuggestions(generatedSuggestions);

        if (options.interactive) {
          setStatus('Interactive mode - waiting for user input...');
        } else {
          setStatus(`Generated ${generatedSuggestions.length} suggestions`);
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        logger.error('Auto-improve command failed', { error: errorMessage });
      }
    };

    runAutoImprove();

    // Cleanup on unmount
    return () => {
      autoImproveEngine
        .stopMonitoring()
        .catch((err: Error) => logger.warn('Failed to stop monitoring', { error: err.message }));
    };
  }, [options]);

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">❌ Auto-Improve Error</Text>
        <Text color="red">{error}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text color="blue">🔧 MARIA Auto-Improve Engine</Text>
      <Newline />

      <Box>
        <Text color="gray">Status: </Text>
        <Text color={status.includes('Error') ? 'red' : 'green'}>{status}</Text>
      </Box>

      <Box>
        <Text color="gray">Mode: </Text>
        <Text color="yellow">{options.mode || 'manual'}</Text>
      </Box>

      <Box>
        <Text color="gray">Goals: </Text>
        <Text>{(options.goals || ['code_quality', 'security']).join(', ')}</Text>
      </Box>

      <Box>
        <Text color="gray">Safety Level: </Text>
        <Text color="cyan">{options.safetyLevel || 'standard'}</Text>
      </Box>

      {suggestions.length > 0 && (
        <>
          <Newline />
          <Text color="green">📋 Generated {suggestions.length} Suggestions:</Text>
          {suggestions.map((suggestion, index) => (
            <SuggestionDisplay key={suggestion.id} suggestion={suggestion} index={index + 1} />
          ))}
        </>
      )}

      {options.interactive && (
        <>
          <Newline />
          <Text color="yellow">⚡ Interactive mode enabled. Use the following commands:</Text>
          <Text color="gray"> • approve &lt;id&gt; - Approve a suggestion</Text>
          <Text color="gray"> • reject &lt;id&gt; - Reject a suggestion</Text>
          <Text color="gray"> • implement &lt;id&gt; - Implement a suggestion</Text>
          <Text color="gray"> • status - Show current status</Text>
          <Text color="gray"> • quit - Exit interactive mode</Text>
        </>
      )}
    </Box>
  );
};

const SuggestionDisplay: React.FC<{ suggestion: ImprovementSuggestion; index: number }> = ({
  suggestion,
  index,
}) => {
  const impactColorMap = {
    low: 'green',
    medium: 'yellow',
    high: 'red',
    critical: 'magenta',
  } as const;
  const impactColor = impactColorMap[suggestion.impact_level as keyof typeof impactColorMap];

  const confidenceColor =
    suggestion.confidence_score >= 0.8
      ? 'green'
      : suggestion.confidence_score >= 0.6
        ? 'yellow'
        : 'red';

  return (
    <Box flexDirection="column" marginLeft={2}>
      <Box>
        <Text color="blue">{index}. </Text>
        <Text bold>{suggestion.title}</Text>
        <Text color="gray"> ({suggestion.goal})</Text>
      </Box>

      <Box marginLeft={3}>
        <Text color="gray">Impact: </Text>
        <Text color={impactColor}>{suggestion.impact_level}</Text>
        <Text color="gray"> | Confidence: </Text>
        <Text color={confidenceColor}>{(suggestion.confidence_score * 100).toFixed(0)}%</Text>
        <Text color="gray"> | Time: </Text>
        <Text>{suggestion.estimated_time_minutes}min</Text>
      </Box>

      <Box marginLeft={3}>
        <Text color="gray">Files: </Text>
        <Text>{suggestion.files_affected?.length || 0} file(s)</Text>
      </Box>

      <Box marginLeft={3} flexWrap="wrap">
        <Text color="gray">Description: </Text>
        <Text>{suggestion.description}</Text>
      </Box>
    </Box>
  );
};

export const AutoImproveStatusCommand: React.FC = () => {
  const [status, setStatus] = React.useState<AutoImproveStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchStatus = async () => {
      try {
        setLoading(true);

        // Get current metrics
        const suggestions = await autoImproveEngine.getAllSuggestions();
        const pendingApprovals = await approvalManager.getAllWorkflows();
        const safetyMetrics = await safetyEngine.getSafetyMetrics();

        const statusData: AutoImproveStatus = {
          engineStatus: 'running', // Would check actual status
          mode: AutoImproveMode.MANUAL, // Would get from current config
          activeSuggestions: suggestions.length,
          pendingApprovals: pendingApprovals.length,
          safetyViolations: safetyMetrics.violations_detected,
          uptime: '2h 30m', // Would calculate actual uptime
          lastActivity: new Date(),
        };

        setStatus(statusData);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        logger.error('Failed to fetch auto-improve status', { error: errorMessage });
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, []);

  if (loading) {
    return <Text color="yellow">⏳ Fetching auto-improve status...</Text>;
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">❌ Failed to fetch status</Text>
        <Text color="red">{error}</Text>
      </Box>
    );
  }

  if (!status) {
    return <Text color="red">❌ No status data available</Text>;
  }

  const statusColorMap = {
    stopped: 'red',
    running: 'green',
    paused: 'yellow',
    error: 'red',
  } as const;
  const statusColor = statusColorMap[status.engineStatus];

  return (
    <Box flexDirection="column">
      <Text color="blue" bold>
        🔧 Auto-Improve Engine Status
      </Text>
      <Newline />

      <Box>
        <Text color="gray">Engine Status: </Text>
        <Text color={statusColor}>{status.engineStatus.toUpperCase()}</Text>
      </Box>

      <Box>
        <Text color="gray">Mode: </Text>
        <Text color="yellow">{status.mode}</Text>
      </Box>

      <Box>
        <Text color="gray">Uptime: </Text>
        <Text>{status.uptime}</Text>
      </Box>

      <Box>
        <Text color="gray">Active Suggestions: </Text>
        <Text color="cyan">{status.activeSuggestions}</Text>
      </Box>

      <Box>
        <Text color="gray">Pending Approvals: </Text>
        <Text color="yellow">{status.pendingApprovals}</Text>
      </Box>

      <Box>
        <Text color="gray">Safety Violations: </Text>
        <Text color={status.safetyViolations > 0 ? 'red' : 'green'}>{status.safetyViolations}</Text>
      </Box>

      <Box>
        <Text color="gray">Last Activity: </Text>
        <Text>{status.lastActivity?.toLocaleString() || 'Never'}</Text>
      </Box>
    </Box>
  );
};

export const AutoImproveApprovalCommand: React.FC<{
  action: 'list' | 'approve' | 'reject';
  suggestionId?: string;
  reason?: string;
}> = ({ action, suggestionId, reason }) => {
  const [workflows, setWorkflows] = React.useState<ApprovalWorkflow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<string | null>(null);

  React.useEffect(() => {
    const handleApproval = async () => {
      try {
        setLoading(true);

        if (action === 'list') {
          const pendingWorkflows = await approvalManager.getAllWorkflows();
          setWorkflows(pendingWorkflows);
        } else if (action === 'approve' && suggestionId) {
          await autoImproveEngine.approveImplementation(suggestionId);
          setResult(`✅ Suggestion ${suggestionId} approved`);
        } else if (action === 'reject' && suggestionId) {
          await autoImproveEngine.rejectSuggestion(suggestionId);
          setResult(`❌ Suggestion ${suggestionId} rejected`);
        } else {
          throw new Error('Invalid approval action or missing parameters');
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        logger.error('Approval command failed', { error: errorMessage, action, suggestionId });
      } finally {
        setLoading(false);
      }
    };

    handleApproval();
  }, [action, suggestionId, reason]);

  if (loading) {
    return <Text color="yellow">⏳ Processing approval request...</Text>;
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">❌ Approval command failed</Text>
        <Text color="red">{error}</Text>
      </Box>
    );
  }

  if (result) {
    return <Text color="green">{result}</Text>;
  }

  if (action === 'list') {
    return (
      <Box flexDirection="column">
        <Text color="blue" bold>
          📋 Pending Approvals ({workflows.length})
        </Text>
        <Newline />

        {workflows.length === 0 ? (
          <Text color="gray">No pending approvals</Text>
        ) : (
          workflows.map((workflow, index) => (
            <Box key={workflow.workflow_id} flexDirection="column" marginBottom={1}>
              <Box>
                <Text color="cyan">{index + 1}. </Text>
                <Text bold>Workflow: {workflow.workflow_id}</Text>
              </Box>

              <Box marginLeft={3}>
                <Text color="gray">Suggestion: </Text>
                <Text>{workflow.suggestion_id}</Text>
              </Box>

              <Box marginLeft={3}>
                <Text color="gray">Priority: </Text>
                <Text color="yellow">{workflow.priority_level}</Text>
              </Box>

              <Box marginLeft={3}>
                <Text color="gray">Files Affected: </Text>
                <Text>
                  {(
                    workflow as unknown as { impact_assessment?: { affected_files_count?: number } }
                  ).impact_assessment?.affected_files_count || 0}
                </Text>
              </Box>

              <Box marginLeft={3}>
                <Text color="gray">Risk Factors: </Text>
                <Text color="red">
                  {(workflow as unknown as { impact_assessment?: { risk_factors?: unknown[] } })
                    .impact_assessment?.risk_factors?.length || 0}
                </Text>
              </Box>
            </Box>
          ))
        )}
      </Box>
    );
  }

  return <Text color="gray">Unknown approval action</Text>;
};

export const AutoImproveMetricsCommand: React.FC<{
  type?: 'performance' | 'quality' | 'security';
  format?: 'json' | 'table' | 'summary';
}> = ({ type = 'performance', format = 'summary' }) => {
  const [metrics, setMetrics] = React.useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);

        let metricsData: PerformanceMetrics | null = null;
        switch (type) {
          case 'performance':
            metricsData = await metricsCollector.collectPerformanceMetrics();
            break;
          case 'quality':
            metricsData = await metricsCollector.collectQualityMetrics() as PerformanceMetrics;
            break;
          case 'security':
            metricsData = await safetyEngine.getSafetyMetrics() as PerformanceMetrics;
            break;
          default:
            throw new Error(`Unknown metrics type: ${type}`);
        }

        setMetrics(metricsData);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        logger.error('Metrics command failed', { error: errorMessage, type });
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [type, format]);

  if (loading) {
    return <Text color="yellow">⏳ Fetching {type} metrics...</Text>;
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">❌ Failed to fetch metrics</Text>
        <Text color="red">{error}</Text>
      </Box>
    );
  }

  if (format === 'json') {
    return <Text>{JSON.stringify(metrics, null, 2)}</Text>;
  }

  if (!metrics) {
    return <Text color="gray">No metrics data available</Text>;
  }

  if (type === 'performance') {
    return (
      <Box flexDirection="column">
        <Text color="blue" bold>
          📊 Performance Metrics
        </Text>
        <Newline />

        <Box>
          <Text color="gray">Suggestions Generated: </Text>
          <Text color="cyan">{metrics.total_suggestions_generated}</Text>
        </Box>

        <Box>
          <Text color="gray">Success Rate: </Text>
          <Text color="green">
            {(
              (metrics.suggestions_accepted / Math.max(1, metrics.total_suggestions_generated)) *
              100
            ).toFixed(1)}
            %
          </Text>
        </Box>

        <Box>
          <Text color="gray">Average Implementation Time: </Text>
          <Text>{metrics.response_time_ms.toFixed(0)}ms</Text>
        </Box>

        <Box>
          <Text color="gray">Rollback Rate: </Text>
          <Text color={metrics.rollback_rate > 0.1 ? 'red' : 'green'}>
            {(metrics.rollback_rate * 100).toFixed(1)}%
          </Text>
        </Box>

        <Newline />
        <Text color="blue">Impact Distribution:</Text>
        {Object.entries(metrics.impact_distribution).map(([level, count]) => (
          <Box key={level} marginLeft={2}>
            <Text color="gray">{level}: </Text>
            <Text>{count as number}</Text>
          </Box>
        ))}
      </Box>
    );
  }

  if (type === 'quality') {
    return (
      <Box flexDirection="column">
        <Text color="blue" bold>
          🎯 Quality Metrics
        </Text>
        <Newline />

        <Box>
          <Text color="gray">Safety Violations: </Text>
          <Text color="red">{metrics.safety_violations_total}</Text>
        </Box>

        <Box>
          <Text color="gray">User Satisfaction: </Text>
          <Text color="green">{metrics.user_satisfaction_score.toFixed(1)}/5.0</Text>
        </Box>

        <Box>
          <Text color="gray">Automation Rate: </Text>
          <Text color="cyan">{(metrics.automation_rate * 100).toFixed(1)}%</Text>
        </Box>

        <Box>
          <Text color="gray">Avg. Approval Time: </Text>
          <Text>{metrics.time_to_approval_avg_hours.toFixed(1)} hours</Text>
        </Box>
      </Box>
    );
  }

  if (type === 'security') {
    return (
      <Box flexDirection="column">
        <Text color="blue" bold>
          🔒 Security Metrics
        </Text>
        <Newline />

        <Box>
          <Text color="gray">Total Checks: </Text>
          <Text color="cyan">{metrics.total_checks_performed}</Text>
        </Box>

        <Box>
          <Text color="gray">Violations Detected: </Text>
          <Text color="red">{metrics.violations_detected}</Text>
        </Box>

        <Box>
          <Text color="gray">Current Safety Score: </Text>
          <Text color="green">{metrics.current_safety_score.toFixed(0)}</Text>
        </Box>

        <Box>
          <Text color="gray">Manual Reviews Required: </Text>
          <Text color="yellow">{metrics.manual_reviews_required}</Text>
        </Box>
      </Box>
    );
  }

  return <Text color="gray">Unknown metrics type</Text>;
};

export const AutoImproveBackupCommand: React.FC<{
  action: 'create' | 'list' | 'restore';
  paths?: string[];
  snapshotId?: string;
  name?: string;
}> = ({ action, paths, snapshotId, name }) => {
  const [result, setResult] = React.useState<string | null>(null);
  const [snapshots, setSnapshots] = React.useState<unknown[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const handleBackup = async () => {
      try {
        setLoading(true);

        if (action === 'create' && paths && name) {
          const snapshot = await fileOperations.createSnapshot();
          setResult(`✅ Snapshot created: ${snapshot.id}`);
        } else if (action === 'restore' && snapshotId) {
          const result = await fileOperations.restoreFromSnapshot(snapshotId);
          const successCount = result.success ? 1 : 0;
          const operations = [result];
          setResult(
            `✅ Restored ${successCount}/${operations.length} files from snapshot ${snapshotId}`,
          );
        } else if (action === 'list') {
          // Get all snapshots (would need to implement in fileOperations)
          setSnapshots([]); // Mock empty for now
        } else {
          throw new Error('Invalid backup action or missing parameters');
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        logger.error('Backup command failed', { error: errorMessage, action });
      } finally {
        setLoading(false);
      }
    };

    handleBackup();
  }, [action, paths, snapshotId, name]);

  if (loading) {
    return <Text color="yellow">⏳ Processing backup operation...</Text>;
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">❌ Backup operation failed</Text>
        <Text color="red">{error}</Text>
      </Box>
    );
  }

  if (result) {
    return <Text color="green">{result}</Text>;
  }

  if (action === 'list') {
    return (
      <Box flexDirection="column">
        <Text color="blue" bold>
          💾 Available Snapshots ({snapshots.length})
        </Text>
        <Newline />

        {snapshots.length === 0 ? (
          <Text color="gray">No snapshots available</Text>
        ) : (
          snapshots.map((snapshot, index) => (
            <Box
              key={(snapshot as unknown as { id: string }).id}
              flexDirection="column"
              marginBottom={1}
            >
              <Box>
                <Text color="cyan">{index + 1}. </Text>
                <Text bold>{(snapshot as unknown as { name: string }).name}</Text>
                <Text color="gray"> ({(snapshot as unknown as { id: string }).id})</Text>
              </Box>

              <Box marginLeft={3}>
                <Text color="gray">Created: </Text>
                <Text>
                  {new Date(
                    (snapshot as unknown as { timestamp: number }).timestamp,
                  ).toLocaleString()}
                </Text>
              </Box>

              <Box marginLeft={3}>
                <Text color="gray">Files: </Text>
                <Text>{(snapshot as unknown as { files?: unknown[] }).files?.length || 0}</Text>
              </Box>

              <Box marginLeft={3}>
                <Text color="gray">Size: </Text>
                <Text>
                  {(
                    ((snapshot as unknown as { total_size_bytes?: number }).total_size_bytes || 0) /
                    1024 /
                    1024
                  ).toFixed(2)}{' '}
                  MB
                </Text>
              </Box>
            </Box>
          ))
        )}
      </Box>
    );
  }

  return <Text color="gray">Unknown backup action</Text>;
};

// CLI command handlers for use in the main CLI application
export const autoImproveCommands = {
  'auto-improve': (options: AutoImproveCliOptions) => <AutoImproveCommand options={options} />,
  'auto-improve:status': () => <AutoImproveStatusCommand />,
  'auto-improve:approve': (suggestionId: string, reason?: string) => (
    <AutoImproveApprovalCommand action="approve" suggestionId={suggestionId} reason={reason} />
  ),
  'auto-improve:reject': (suggestionId: string, reason?: string) => (
    <AutoImproveApprovalCommand action="reject" suggestionId={suggestionId} reason={reason} />
  ),
  'auto-improve:approvals': () => <AutoImproveApprovalCommand action="list" />,
  'auto-improve:metrics': (
    type?: 'performance' | 'quality' | 'security',
    format?: 'json' | 'table' | 'summary',
  ) => <AutoImproveMetricsCommand type={type} format={format} />,
  'auto-improve:backup': (action: 'create' | 'list' | 'restore', options?: unknown) => (
    <AutoImproveBackupCommand action={action} {...((options as Record<string, unknown>) || {})} />
  ),
};

export default autoImproveCommands;
