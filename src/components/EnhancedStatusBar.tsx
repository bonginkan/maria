import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import os from 'os';

interface StatusBarProps {
  aiModel?: string;
  aiProvider?: string;
  userPlan?: string;
  credits?: number;
}

export const EnhancedStatusBar: React.FC<StatusBarProps> = ({
  aiModel = 'GPT-5',
  userPlan = 'Pro',
  credits = 950,
}) => {
  const [cpuUsage, setCpuUsage] = useState(0);
  const [memoryUsage, setMemoryUsage] = useState(0);
  const [networkStatus, setNetworkStatus] = useState('Good');

  useEffect(() => {
    const updateMetrics = () => {
      // Memory usage calculation
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memPercent = Math.round((usedMem / totalMem) * 100);
      setMemoryUsage(memPercent);

      // Simple CPU approximation (in real app, use proper CPU monitoring)
      const loadAvg = os.loadavg()[0];
      const cpuCount = os.cpus().length;
      const cpuPercent = Math.min(100, Math.round((loadAvg / cpuCount) * 100));
      setCpuUsage(cpuPercent);

      // Network status simulation (in real app, check actual connection)
      setNetworkStatus(Math.random() > 0.1 ? 'Good' : 'Slow');
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  const getNetworkIcon = () => {
    switch (networkStatus) {
      case 'Good':
        return '📡';
      case 'Slow':
        return '📶';
      default:
        return '📵';
    }
  };

  const getCPUColor = () => {
    if (cpuUsage > 80) return 'red';
    if (cpuUsage > 50) return 'yellow';
    return 'green';
  };

  const getMemoryColor = () => {
    if (memoryUsage > 80) return 'red';
    if (memoryUsage > 60) return 'yellow';
    return 'green';
  };

  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      width="100%"
      flexDirection="row"
      justifyContent="space-between"
    >
      <Box flexDirection="row" gap={2}>
        <Text color="cyan">
          🧠 AI:{' '}
          <Text color="white" bold>
            {aiModel}
          </Text>
        </Text>

        <Text color="blue">
          💾 Mem:{' '}
          <Text color={getMemoryColor()} bold>
            {memoryUsage}%
          </Text>
        </Text>

        <Text color="magenta">
          🔋 CPU:{' '}
          <Text color={getCPUColor()} bold>
            {cpuUsage}%
          </Text>
        </Text>

        <Text color="green">
          {getNetworkIcon()} Net:{' '}
          <Text color="white" bold>
            {networkStatus}
          </Text>
        </Text>
      </Box>

      <Box flexDirection="row" gap={2}>
        <Text color="yellow">
          ⭐ <Text bold>{userPlan}</Text>
        </Text>

        {credits !== undefined && (
          <Text color="cyan">
            💰 Credits:{' '}
            <Text color="white" bold>
              {credits}
            </Text>
          </Text>
        )}
      </Box>
    </Box>
  );
};
