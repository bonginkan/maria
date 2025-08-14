import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import SelectInput from 'ink-select-input';
import { readConfig } from '../utils/config.js';
import { saveExecutionResults } from '../utils/file-output.js';

interface TaskProgressProps {
  executionId: string;
  onComplete: () => void;
}

interface ExecutionStatus {
  id: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  currentStep: number;
  totalSteps: number;
  steps: Array<{
    id: string;
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    progress: number;
    message?: string;
    startTime?: string;
    endTime?: string;
    estimatedTimeRemaining?: number;
    blockedBy?: string[];
  }>;
  error?: string;
  startTime?: string;
  estimatedCompletion?: string;
  performance?: {
    avgStepTime: number;
    successRate: number;
  };
}

type ViewMode = 'summary' | 'detailed' | 'timeline';
type ActionMode = 'viewing' | 'pausing' | 'canceling';

const TaskProgress: React.FC<TaskProgressProps> = ({ executionId, onComplete }) => {
  const [status, setStatus] = useState<ExecutionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [actionMode, setActionMode] = useState<ActionMode>('viewing');
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    const pollStatus = async () => {
      try {
        const config = await readConfig();
        const apiUrl = config.apiUrl || 'http://localhost:8080';

        const response = await fetch(`${apiUrl}/api/conversation/status/${executionId}`);
        if (!response.ok) throw new Error('Failed to fetch status');

        const data = await response.json();
        setStatus(data);

        if (data.status === 'completed' || data.status === 'failed') {
          setTimeout(onComplete, 2000);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to fetch status');
      }
    };

    const interval = setInterval(pollStatus, 2000);
    pollStatus(); // Initial fetch

    return () => clearInterval(interval);
  }, [executionId, onComplete]);

  useInput((input, key) => {
    if (actionMode === 'viewing') {
      if (input === 'v') {
        const modes: ViewMode[] = ['summary', 'detailed', 'timeline'];
        const currentIndex = modes.indexOf(viewMode);
        setViewMode(modes[(currentIndex + 1) % modes.length] || 'summary');
      } else if (input === 'c') {
        setShowControls(!showControls);
      } else if (input === 'p' && status?.status === 'running') {
        setActionMode('pausing');
      } else if (input === 'q') {
        setActionMode('canceling');
      } else if (input === 'r' && (status?.status === 'completed' || status?.status === 'failed')) {
        generateReport();
      }
    }
    if (key.escape) {
      setActionMode('viewing');
      setShowControls(false);
    }
  });

  const handlePauseExecution = async () => {
    try {
      const config = await readConfig();
      const apiUrl = config.apiUrl || 'http://localhost:8080';

      await fetch(`${apiUrl}/api/conversation/pause/${executionId}`, {
        method: 'POST',
      });
      setActionMode('viewing');
    } catch {
      setError('Failed to pause execution');
    }
  };

  const handleCancelExecution = async () => {
    try {
      const config = await readConfig();
      const apiUrl = config.apiUrl || 'http://localhost:8080';

      await fetch(`${apiUrl}/api/conversation/cancel/${executionId}`, {
        method: 'POST',
      });
      setActionMode('viewing');
      onComplete();
    } catch {
      setError('Failed to cancel execution');
    }
  };

  const generateReport = async () => {
    if (!status) return;

    try {
      const completedSteps = status.steps.filter((s) => s.status === 'completed').length;
      const failedSteps = status.steps.filter((s) => s.status === 'failed').length;
      const successRate = status.totalSteps > 0 ? completedSteps / status.totalSteps : 0;

      const results = {
        executionId: status.id,
        status: status.status,
        duration: status.startTime
          ? `${Math.round((Date.now() - new Date(status.startTime).getTime()) / 1000)}s`
          : 'Unknown',
        totalSteps: status.totalSteps,
        completedSteps,
        failedSteps,
        successRate,
        steps: status.steps.map((step) => ({
          name: step.name,
          status: step.status,
          duration:
            step.startTime && step.endTime
              ? `${Math.round((new Date(step.endTime).getTime() - new Date(step.startTime).getTime()) / 1000)}s`
              : 'N/A',
          message: step.message,
          error: step.status === 'failed' ? 'Execution failed' : undefined,
        })),
        generatedAt: new Date().toISOString(),
      };

      const filepath = await saveExecutionResults(results, { format: 'markdown' });
      console.log(`\nExecution report generated: ${filepath}`);
    } catch {
      setError('Failed to generate report');
    }
  };

  if (error) {
    return (
      <Box>
        <Text color="red">Error: {error}</Text>
      </Box>
    );
  }

  if (!status) {
    return (
      <Box>
        <Spinner type="dots" />
        <Text> Loading execution status...</Text>
      </Box>
    );
  }

  const progressPercentage =
    status.totalSteps > 0 ? Math.round((status.currentStep / status.totalSteps) * 100) : 0;

  const renderTimelineView = () => (
    <Box flexDirection="column">
      <Text bold>Execution Timeline</Text>
      {status?.steps.map((step) => (
        <Box key={step.id} marginLeft={2}>
          <Text>
            {step.startTime ? new Date(step.startTime).toLocaleTimeString() : 'Pending'}:{' '}
            {step.name}
          </Text>
          {step.endTime && (
            <Text color="gray">
              {' '}
              (Duration:{' '}
              {Math.round(
                (new Date(step.endTime).getTime() - new Date(step.startTime!).getTime()) / 1000,
              )}
              s)
            </Text>
          )}
        </Box>
      ))}
    </Box>
  );

  const renderDetailedView = () => (
    <Box flexDirection="column">
      {status?.steps.map((step) => (
        <Box key={step.id} flexDirection="column" marginBottom={1}>
          <Box>
            {step.status === 'running' && <Spinner type="dots" />}
            {step.status === 'completed' && <Text color="green">✓</Text>}
            {step.status === 'failed' && <Text color="red">✗</Text>}
            {step.status === 'pending' && <Text color="gray">○</Text>}
            {step.status === 'skipped' && <Text color="gray">-</Text>}
            <Text bold> {step.name}</Text>
          </Box>

          {step.message && (
            <Box marginLeft={2}>
              <Text color="gray">{step.message}</Text>
            </Box>
          )}

          {step.status === 'running' && step.progress > 0 && (
            <Box marginLeft={2}>
              <Text color="cyan">Progress: {step.progress}%</Text>
              {step.estimatedTimeRemaining && (
                <Text color="gray">
                  {' '}
                  (~{Math.round(step.estimatedTimeRemaining / 1000)}s remaining)
                </Text>
              )}
            </Box>
          )}

          {step.blockedBy && step.blockedBy.length > 0 && (
            <Box marginLeft={2}>
              <Text color="yellow">Blocked by: {step.blockedBy.join(', ')}</Text>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );

  if (actionMode === 'pausing') {
    return (
      <Box flexDirection="column">
        <Text bold>Pause Execution?</Text>
        <SelectInput
          items={[
            { label: 'Yes, pause execution', value: 'yes' },
            { label: 'No, continue', value: 'no' },
          ]}
          onSelect={(item) =>
            item.value === 'yes' ? handlePauseExecution() : setActionMode('viewing')
          }
        />
      </Box>
    );
  }

  if (actionMode === 'canceling') {
    return (
      <Box flexDirection="column">
        <Text bold color="red">
          Cancel Execution?
        </Text>
        <Text>This will permanently stop the current execution.</Text>
        <SelectInput
          items={[
            { label: 'Yes, cancel execution', value: 'yes' },
            { label: 'No, continue', value: 'no' },
          ]}
          onSelect={(item) =>
            item.value === 'yes' ? handleCancelExecution() : setActionMode('viewing')
          }
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Task Execution Progress</Text>
        <Text>
          {' '}
          ({progressPercentage}%) - View: {viewMode}
        </Text>
        {status?.estimatedCompletion && (
          <Text color="gray">
            {' '}
            (ETA: {new Date(status.estimatedCompletion).toLocaleTimeString()})
          </Text>
        )}
      </Box>

      <Box marginBottom={1}>
        <Text>[</Text>
        {Array.from({ length: 20 }).map((_, i) => (
          <Text key={i} color={i < Math.floor(progressPercentage / 5) ? 'green' : 'gray'}>
            {'█'}
          </Text>
        ))}
        <Text>] </Text>
        <Text color="cyan">
          Step {status.currentStep} of {status.totalSteps}
        </Text>
      </Box>

      <Box flexDirection="column" borderStyle="single" padding={1}>
        {viewMode === 'summary' && (
          <Box flexDirection="column">
            {status.steps
              .slice(Math.max(0, status.currentStep - 2), status.currentStep + 1)
              .map((step) => (
                <Box key={step.id}>
                  {step.status === 'running' && <Spinner type="dots" />}
                  {step.status === 'completed' && <Text color="green">✓</Text>}
                  {step.status === 'failed' && <Text color="red">✗</Text>}
                  {step.status === 'pending' && <Text color="gray">○</Text>}
                  <Text> {step.name}</Text>
                </Box>
              ))}
          </Box>
        )}

        {viewMode === 'detailed' && renderDetailedView()}
        {viewMode === 'timeline' && renderTimelineView()}
      </Box>

      {showControls && (
        <Box marginTop={1} flexDirection="column" borderStyle="round" padding={1}>
          <Text bold>Controls:</Text>
          <Text>V - Switch view mode</Text>
          <Text>C - Toggle controls</Text>
          {status?.status === 'running' && <Text>P - Pause execution</Text>}
          <Text>Q - Cancel execution</Text>
          {(status?.status === 'completed' || status?.status === 'failed') && (
            <Text>R - Generate report</Text>
          )}
          <Text>ESC - Hide this menu</Text>
        </Box>
      )}

      {status?.performance && (
        <Box marginTop={1}>
          <Text color="gray">
            Avg step time: {Math.round(status.performance.avgStepTime / 1000)}s | Success rate:{' '}
            {Math.round(status.performance.successRate * 100)}%
          </Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>Press C for controls • V to change view</Text>
      </Box>

      {status.status === 'completed' && (
        <Box marginTop={1}>
          <Text color="green" bold>
            ✓ Execution completed successfully!
          </Text>
        </Box>
      )}

      {status.status === 'failed' && (
        <Box marginTop={1}>
          <Text color="red" bold>
            ✗ Execution failed
          </Text>
          {status.error && <Text color="red">{status.error}</Text>}
        </Box>
      )}

      {status.status === 'paused' && (
        <Box marginTop={1}>
          <Text color="yellow" bold>
            ⏸ Execution paused
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default TaskProgress;
