import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import { BackgroundTask } from '../services/ui-state-manager.js';

export interface ProcessIndicatorProps {
  task: BackgroundTask;
  showDetails?: boolean;
  compact?: boolean;
  animated?: boolean;
}

interface AnimationFrame {
  spinner: string;
  timestamp: number;
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
// const _PULSE_FRAMES = ['●', '◐', '◑', '◒', '◓', '◔', '◕', '◖', '◗'];

export function ProcessIndicator({
  task,
  showDetails = false,
  compact = false,
  animated = true,
}: ProcessIndicatorProps) {
  const [animationFrame, setAnimationFrame] = useState<AnimationFrame>({
    spinner: SPINNER_FRAMES[0] || '⠋',
    timestamp: Date.now(),
  });

  // Animation loop
  useEffect(() => {
    if (!animated || task.status !== 'running') {
      return;
    }

    const interval = setInterval(() => {
      setAnimationFrame((prev) => {
        const frameIndex = (SPINNER_FRAMES.indexOf(prev.spinner) + 1) % SPINNER_FRAMES.length;
        return {
          spinner: SPINNER_FRAMES[frameIndex] || '⠋',
          timestamp: Date.now(),
        };
      });
    }, 100);

    return () => clearInterval(interval);
  }, [animated, task.status]);

  if (compact) {
    return <CompactIndicator task={task} spinner={animationFrame.spinner} />;
  }

  return (
    <Box flexDirection="column">
      <MainIndicator
        task={task}
        spinner={animationFrame.spinner}
        timestamp={animationFrame.timestamp}
      />
      {showDetails && <DetailedInfo task={task} />}
    </Box>
  );
}

interface MainIndicatorProps {
  task: BackgroundTask;
  spinner: string;
  timestamp: number;
}

function MainIndicator({ task, spinner, timestamp }: MainIndicatorProps) {
  const statusColor = getStatusColor(task.status);
  const icon = getStatusIcon(task.status, spinner);
  const progressBar = formatProgressBar(task.progress, task.status);

  return (
    <Box alignItems="center">
      {/* Status Icon */}
      <Text color={statusColor}>{icon}</Text>

      {/* Command */}
      <Text bold> {task.command} </Text>

      {/* Args (truncated if too long) */}
      <Text color="gray">{truncateArgs(task.args)} </Text>

      {/* Progress Bar */}
      <Box>
        <Text>{progressBar} </Text>
      </Box>

      {/* Time Info */}
      <Text color="gray">{formatTimeInfo(task, timestamp)}</Text>
    </Box>
  );
}

interface CompactIndicatorProps {
  task: BackgroundTask;
  spinner: string;
}

function CompactIndicator({ task, spinner }: CompactIndicatorProps) {
  const statusColor = getStatusColor(task.status);
  const icon = getStatusIcon(task.status, spinner);

  return (
    <Box alignItems="center">
      <Text color={statusColor}>{icon}</Text>
      <Text> {task.command} </Text>
      <Text color="gray">{task.progress.toFixed(0)}%</Text>
    </Box>
  );
}

interface DetailedInfoProps {
  task: BackgroundTask;
}

function DetailedInfo({ task }: DetailedInfoProps) {
  const startedAt = new Date(task.startTime).toLocaleTimeString();

  return (
    <Box flexDirection="column" marginTop={1} paddingLeft={2}>
      {/* Task ID */}
      <Box>
        <Text color="gray">ID: </Text>
        <Text color="white">{task.id}</Text>
      </Box>

      {/* Full Arguments */}
      {task.args.length > 0 && (
        <Box>
          <Text color="gray">Args: </Text>
          <Text color="white">{task.args.join(' ')}</Text>
        </Box>
      )}

      {/* Start Time */}
      <Box>
        <Text color="gray">Started: </Text>
        <Text color="white">{startedAt}</Text>
      </Box>

      {/* Estimated End Time */}
      {task.estimatedEndTime && (
        <Box>
          <Text color="gray">ETA: </Text>
          <Text color="white">{new Date(task.estimatedEndTime).toLocaleTimeString()}</Text>
        </Box>
      )}

      {/* Error Message */}
      {task.error && (
        <Box>
          <Text color="red">Error: {task.error}</Text>
        </Box>
      )}

      {/* Result Preview */}
      {task.status === 'completed' && task.result && (
        <Box>
          <Text color="gray">Result: </Text>
          <Text color="green">{formatResult(task.result)}</Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Multi-task indicator for showing multiple processes
 */
export function MultiProcessIndicator({
  tasks,
  maxVisible = 3,
}: {
  tasks: BackgroundTask[];
  maxVisible?: number;
}) {
  const runningTasks = tasks.filter((t) => t.status === 'running');
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const errorTasks = tasks.filter((t) => t.status === 'error');

  if (tasks.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="blue" paddingX={1}>
      {/* Summary Header */}
      <Box justifyContent="space-between">
        <Text bold color="blue">
          Background Tasks
        </Text>
        <Text color="gray">
          {runningTasks.length} running • {completedTasks.length} done • {errorTasks.length} errors
        </Text>
      </Box>

      {/* Task List */}
      <Box flexDirection="column" marginTop={1}>
        {tasks.slice(0, maxVisible).map((task) => (
          <ProcessIndicator key={task.id} task={task} compact={true} />
        ))}

        {tasks.length > maxVisible && (
          <Text color="gray" italic>
            ... and {tasks.length - maxVisible} more
          </Text>
        )}
      </Box>
    </Box>
  );
}

/**
 * Inline process indicator for status lines
 */
export function InlineProcessIndicator({ task }: { task: BackgroundTask }) {
  const [spinner, setSpinner] = useState(SPINNER_FRAMES[0]);

  useEffect(() => {
    if (task.status !== 'running') return;

    const interval = setInterval(() => {
      setSpinner((prev) => {
        const index = SPINNER_FRAMES.indexOf(prev);
        return SPINNER_FRAMES[(index + 1) % SPINNER_FRAMES.length];
      });
    }, 150);

    return () => clearInterval(interval);
  }, [task.status]);

  const statusColor = getStatusColor(task.status);
  const icon = getStatusIcon(task.status, spinner);

  return (
    <Text color={statusColor}>
      {icon} {task.command} ({task.progress.toFixed(0)}%)
    </Text>
  );
}

/**
 * Progress ring indicator for circular progress display
 */
export function ProgressRing({
  progress,
  size = 'medium',
  status = 'running',
}: {
  progress: number;
  size?: 'small' | 'medium' | 'large';
  status?: BackgroundTask['status'];
}) {
  const rings = {
    small: { outer: '●', inner: '○', segments: 8 },
    medium: { outer: '●', inner: '○', segments: 12 },
    large: { outer: '●', inner: '○', segments: 16 },
  };

  const ring = rings[size];
  const filled = Math.round((progress / 100) * ring.segments);
  const color = getStatusColor(status);

  const display =
    chalk[color as keyof typeof chalk](ring.outer.repeat(filled)) +
    chalk.gray(ring.inner.repeat(ring.segments - filled));

  return (
    <Text>
      {display} {progress.toFixed(0)}%
    </Text>
  );
}

// Helper Functions

function getStatusColor(status: BackgroundTask['status']): string {
  const colors = {
    running: 'blue',
    completed: 'green',
    error: 'red',
    paused: 'yellow',
  };
  return colors[status] || 'gray';
}

function getStatusIcon(status: BackgroundTask['status'], spinner: string): string {
  switch (status) {
    case 'running':
      return spinner;
    case 'completed':
      return '✅';
    case 'error':
      return '❌';
    case 'paused':
      return '⏸️';
    default:
      return '❓';
  }
}

function formatProgressBar(progress: number, status: BackgroundTask['status']): string {
  const width = 20;
  const filled = Math.round((progress / 100) * width);
  const empty = width - filled;

  let fillChar = '█';
  const emptyChar = '░';
  let color = 'blue';

  if (status === 'completed') {
    color = 'green';
  } else if (status === 'error') {
    color = 'red';
    fillChar = '▓';
  } else if (status === 'paused') {
    color = 'yellow';
    fillChar = '▒';
  }

  const bar =
    chalk[color as keyof typeof chalk](fillChar.repeat(filled)) +
    chalk.gray(emptyChar.repeat(empty));

  return `[${bar}] ${progress.toFixed(0)}%`;
}

function formatTimeInfo(task: BackgroundTask, now: number): string {
  const elapsed = now - task.startTime;
  const elapsedStr = formatDuration(elapsed);

  if (task.status === 'running' && task.estimatedEndTime) {
    const remaining = Math.max(0, task.estimatedEndTime - now);
    if (remaining > 0) {
      const remainingStr = formatDuration(remaining);
      return `${elapsedStr} / ~${remainingStr}`;
    } else {
      return `${elapsedStr} (overtime)`;
    }
  }

  return elapsedStr;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m${remainingSeconds > 0 ? ` ${remainingSeconds}s` : ''}`;
  } else {
    return `${seconds}s`;
  }
}

function truncateArgs(args: string[], maxLength: number = 30): string {
  const argsStr = args.join(' ');
  if (argsStr.length <= maxLength) {
    return argsStr;
  }
  return argsStr.slice(0, maxLength - 3) + '...';
}

function formatResult(result: unknown): string {
  if (typeof result === 'string') {
    return result.length > 50 ? result.slice(0, 47) + '...' : result;
  }

  if (typeof result === 'object' && result !== null) {
    return JSON.stringify(result).slice(0, 50) + '...';
  }

  return String(result);
}

export default ProcessIndicator;
