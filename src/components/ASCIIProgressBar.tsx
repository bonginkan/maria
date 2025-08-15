import React from 'react';
import { Box, Text } from 'ink';

interface ProgressBarProps {
  value: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  showETA?: boolean;
  etaSeconds?: number;
  width?: number;
  colorize?: boolean;
}

export const ASCIIProgressBar: React.FC<ProgressBarProps> = ({
  value,
  label = '',
  showPercentage = true,
  showETA = false,
  etaSeconds = 0,
  width = 30,
  colorize = true,
}) => {
  const clampedValue = Math.max(0, Math.min(100, value));
  const filled = Math.floor((clampedValue / 100) * width);
  const empty = width - filled;

  // Create progress bar string
  const filledChar = '█';
  const emptyChar = '░';
  const progressBar = filledChar.repeat(filled) + emptyChar.repeat(empty);

  // Determine color based on progress
  const getColor = () => {
    if (!colorize) return 'white';
    if (clampedValue < 30) return 'red';
    if (clampedValue < 70) return 'yellow';
    return 'green';
  };

  // Format ETA
  const formatETA = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs.toFixed(0)}s`;
  };

  return (
    <Box flexDirection="column" gap={0}>
      {label && (
        <Text color="cyan" bold>
          {label}
        </Text>
      )}
      <Box flexDirection="row" alignItems="center" gap={1}>
        <Text color={getColor()}>{progressBar}</Text>
        {showPercentage && (
          <Text color="white" bold>
            {clampedValue}%
          </Text>
        )}
        {showETA && etaSeconds > 0 && <Text color="gray">({formatETA(etaSeconds)})</Text>}
      </Box>
    </Box>
  );
};

interface MultiProgressProps {
  tasks: Array<{
    label: string;
    progress: number;
    status?: 'pending' | 'running' | 'complete' | 'error';
  }>;
  totalLabel?: string;
}

export const MultiProgressBar: React.FC<MultiProgressProps> = ({
  tasks,
  totalLabel = 'Total Progress',
}) => {
  const totalProgress = Math.round(
    tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length,
  );

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'complete':
        return '✓';
      case 'running':
        return '⟳';
      case 'error':
        return '✗';
      default:
        return '○';
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'complete':
        return 'green';
      case 'running':
        return 'yellow';
      case 'error':
        return 'red';
      default:
        return 'gray';
    }
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      paddingY={0}
      width="100%"
    >
      <Text color="white" bold>
        🧠 AI Processing
      </Text>

      <Box flexDirection="column" marginTop={1}>
        {tasks.map((task, index) => (
          <Box key={index} flexDirection="row" alignItems="center" gap={1}>
            <Text color={getStatusColor(task.status)}>{getStatusIcon(task.status)}</Text>
            <Text color="gray" dimColor>
              {task.label}
            </Text>
            <Box flexGrow={1} />
            <ASCIIProgressBar
              value={task.progress}
              width={20}
              showPercentage={true}
              colorize={true}
            />
          </Box>
        ))}
      </Box>

      <Box marginTop={1} paddingTop={1} borderTop borderColor="gray">
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Text color="cyan" bold>
            📊 {totalLabel}:
          </Text>
          <ASCIIProgressBar
            value={totalProgress}
            width={25}
            showPercentage={true}
            showETA={true}
            etaSeconds={tasks.some((t) => t.status === 'running') ? 4.3 : 0}
            colorize={true}
          />
        </Box>
      </Box>
    </Box>
  );
};
