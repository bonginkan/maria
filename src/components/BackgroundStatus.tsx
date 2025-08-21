import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import { BackgroundTask } from '../services/ui-state-manager.js';

export interface BackgroundStatusProps {
  tasks: BackgroundTask[];
  isVisible: boolean;
  currentTask?: BackgroundTask;
  onTaskSelect?: (taskId: string) => void;
}

interface TaskDisplayInfo {
  id: string;
  command: string;
  args: string[];
  status: BackgroundTask['status'];
  progress: number;
  timeInfo: string;
  statusIcon: string;
  progressBar: string;
  error?: string;
}

export function BackgroundStatus({
  tasks,
  isVisible,
  currentTask,
  onTaskSelect,
}: BackgroundStatusProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());

  // Update component every second for time displays
  useEffect(() => {
    if (isVisible && tasks.length > 0) {
      const interval = setInterval(() => {
        setLastUpdateTime(Date.now());
      }, 1000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [isVisible, tasks.length]);

  // Reset selection when tasks change
  useEffect(() => {
    if (selectedIndex >= tasks.length) {
      setSelectedIndex(Math.max(0, tasks.length - 1));
    }
  }, [tasks.length, selectedIndex]);

  if (!isVisible || tasks.length === 0) {
    return null;
  }

  const displayTasks: TaskDisplayInfo[] = tasks.map((task) => ({
    id: task.id,
    command: task.command,
    args: task.args,
    status: task.status,
    progress: task.progress,
    timeInfo: formatTimeInfo(task, lastUpdateTime),
    statusIcon: getStatusIcon(task.status),
    progressBar: formatProgressBar(task.progress, task.status),
    error: task.error,
  }));

  const runningTasks = displayTasks.filter((t) => t.status === 'running').length;
  const completedTasks = displayTasks.filter((t) => t.status === 'completed').length;
  const errorTasks = displayTasks.filter((t) => t.status === 'error').length;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="blue" paddingX={1}>
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="blue">
          🔄 Background Tasks
        </Text>
        <Text color="gray">
          {runningTasks} running • {completedTasks} completed • {errorTasks} errors
        </Text>
      </Box>

      {/* Current Task Highlight */}
      {currentTask && (
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor="yellow"
          paddingX={1}
          marginBottom={1}
        >
          <Text color="yellow" bold>
            🎯 Current Focus:
          </Text>
          <Box>
            <Text color="white">
              {getStatusIcon(currentTask.status)} {currentTask.command} {currentTask.args.join(' ')}
            </Text>
          </Box>
          <Box>
            <Text color="gray">
              {formatProgressBar(currentTask.progress, currentTask.status)}{' '}
              {formatTimeInfo(currentTask, lastUpdateTime)}
            </Text>
          </Box>
        </Box>
      )}

      {/* Task List */}
      <Box flexDirection="column">
        {displayTasks.slice(0, 6).map((task, index) => (
          <TaskItem
            key={task.id}
            task={task}
            isSelected={index === selectedIndex}
            isCurrent={currentTask?.id === task.id}
            index={index + 1}
            onSelect={onTaskSelect}
          />
        ))}

        {displayTasks.length > 6 && (
          <Text color="gray" italic>
            ... and {displayTasks.length - 6} more tasks
          </Text>
        )}
      </Box>

      {/* Controls */}
      <Box justifyContent="center" marginTop={1} borderTop={true} borderColor="gray" paddingTop={1}>
        <Text color="gray">
          💡 Ctrl+F: Foreground • Ctrl+B: Background • Ctrl+Y: Toggle List • Ctrl+C: Cancel
        </Text>
      </Box>
    </Box>
  );
}

interface TaskItemProps {
  task: TaskDisplayInfo;
  isSelected: boolean;
  isCurrent: boolean;
  index: number;
  onSelect?: (taskId: string) => void;
}

function TaskItem({ task, isSelected, isCurrent, index, onSelect }: TaskItemProps) {
  const backgroundColor = isSelected ? 'blue' : undefined;
  const textColor = isSelected ? 'white' : undefined;

  const prefix = isCurrent ? '▶ ' : `${index}. `;

  return (
    <Box flexDirection="column" paddingX={isSelected ? 1 : 0}>
      {/* Task Command Line */}
      <Box>
        <Text color={textColor}>
          {prefix}
          {task.statusIcon} <Text bold>{task.command}</Text>{' '}
          <Text color="gray">{task.args.join(' ')}</Text>
        </Text>
      </Box>

      {/* Progress and Time Info */}
      <Box>
        <Text color={textColor || 'gray'}>
          {' '.repeat(prefix.length)}
          {task.progressBar} {task.timeInfo}
        </Text>
      </Box>

      {/* Error Message */}
      {task.error && (
        <Box>
          <Text color="red">❌ {task.error}</Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Get status icon for task status
 */
function getStatusIcon(status: BackgroundTask['status']): string {
  const icons = {
    running: '🔄',
    completed: '✅',
    error: '❌',
    paused: '⏸️',
  };
  return icons[status] || '❓';
}

/**
 * Format progress bar with status-appropriate styling
 */
function formatProgressBar(progress: number, status: BackgroundTask['status']): string {
  const width = 15;
  const filled = Math.round((progress / 100) * width);
  const empty = width - filled;

  let fillChar = '█';
  const emptyChar = '░';
  let color = 'green';

  if (status === 'error') {
    color = 'red';
    fillChar = '▓';
  } else if (status === 'completed') {
    color = 'green';
  } else if (status === 'running') {
    color = 'blue';
  } else if (status === 'paused') {
    color = 'yellow';
    fillChar = '▒';
  }

  const chalkColor =
    color === 'green'
      ? chalk.green
      : color === 'yellow'
        ? chalk.yellow
        : color === 'red'
          ? chalk.red
          : chalk.blue;
  const bar = chalkColor(fillChar.repeat(filled)) + chalk.gray(emptyChar.repeat(empty));

  return `[${bar}] ${progress.toFixed(0)}%`;
}

/**
 * Format time information for display
 */
function formatTimeInfo(task: BackgroundTask, now: number): string {
  const elapsed = now - task.startTime;
  const elapsedStr = formatDuration(elapsed);

  if (task.status === 'running' && task.estimatedEndTime) {
    const remaining = Math.max(0, task.estimatedEndTime - now);
    const remainingStr = formatDuration(remaining);

    if (remaining > 0) {
      return `${elapsedStr} elapsed, ~${remainingStr} remaining`;
    } else {
      return `${elapsedStr} elapsed (overtime)`;
    }
  } else if (task.status === 'completed') {
    return `Completed in ${elapsedStr}`;
  } else if (task.status === 'error') {
    return `Failed after ${elapsedStr}`;
  } else {
    return `${elapsedStr} elapsed`;
  }
}

/**
 * Format duration in human readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  } else if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Mini background status for inline display
 */
export function MiniBackgroundStatus({ tasks }: { tasks: BackgroundTask[] }) {
  const runningTasks = tasks.filter((t) => t.status === 'running');

  if (runningTasks.length === 0) {
    return null;
  }

  const mostRecent = runningTasks[runningTasks.length - 1];

  if (!mostRecent) {
    return null;
  }

  return (
    <Box borderStyle="single" borderColor="blue" paddingX={1}>
      <Text color="blue">
        🔄 {mostRecent.command} ({mostRecent.progress.toFixed(0)}%)
      </Text>
      {runningTasks.length > 1 && <Text color="gray"> +{runningTasks.length - 1} more</Text>}
    </Box>
  );
}

export default BackgroundStatus;
