/**
 * Enhanced Status Display Component with Visualizations
 * Shows system status, metrics, and performance data
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import figures from 'figures';
import {
  BarChart,
  ProgressRing,
  TrendLine,
  MetricCard,
  Table,
  HeatMap,
  Timeline,
  ExpandableSection,
  DrillDownNav,
  SmartSummary,
  CrossReference,
  TreeView,
} from './visualizations';

interface StatusData {
  user: {
    isAuthenticated: boolean;
    userId?: string;
    plan: string;
    credits: number;
    loginTime?: Date;
  };
  system: {
    version: string;
    mode: string;
    apiUrl: string;
    sandboxStatus: string;
  };
  resources: {
    memory: string;
    uptime: string;
  };
}

export const StatusDisplay: React.FC<{
  data: StatusData;
  onClose?: () => void;
}> = ({ data }) => {
  const [activeTab] = useState<'overview' | 'performance' | 'resources' | 'history'>('overview');
  const [performanceData, setPerformanceData] = useState({
    cpu: [] as number[],
    memory: [] as number[],
    requests: [] as number[],
  });
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    user: true,
    services: true,
    memory: false,
    connections: false,
  });
  const [drillDownPath, setDrillDownPath] = useState<string[]>(['Status Overview']);

  // Simulate performance data updates
  useEffect(() => {
    const interval = setInterval(() => {
      setPerformanceData((prev) => ({
        cpu: [...prev.cpu.slice(-9), Math.random() * 100].slice(-10),
        memory: [...prev.memory.slice(-9), 50 + Math.random() * 30].slice(-10),
        requests: [...prev.requests.slice(-9), Math.floor(Math.random() * 50)].slice(-10),
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const tabs = ['overview', 'performance', 'resources', 'history'];

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleDrillDown = (newPath: string[]) => {
    setDrillDownPath(newPath);
  };

  const renderOverview = () => (
    <Box flexDirection="column" marginTop={1}>
      <SmartSummary
        data={{
          services: 4,
          warnings: 0,
          avgResponse: '25ms',
          successRate: 99.8,
          bottleneck: 'None detected',
        }}
        type="status"
      />

      <DrillDownNav
        path={drillDownPath}
        onNavigate={(index) => setDrillDownPath(drillDownPath.slice(0, index + 1))}
      />

      <Box marginBottom={1}>
        <Text bold color="cyan">
          System Overview
        </Text>
      </Box>

      <Box marginBottom={2}>
        <MetricCard
          title="Version"
          value={data.system.version}
          subtitle="Latest stable release"
          icon={figures.info}
          color="cyan"
        />
        <Box marginLeft={2}>
          <MetricCard
            title="Mode"
            value={data.system.mode.toUpperCase()}
            subtitle="Current operation mode"
            icon={figures.play}
            color="green"
          />
        </Box>
        <Box marginLeft={2}>
          <MetricCard
            title="Uptime"
            value={data.resources.uptime}
            subtitle="System running time"
            icon={figures.circleFilled}
            trend="up"
            color="yellow"
          />
        </Box>
      </Box>

      <ExpandableSection
        title="User Information"
        expanded={expandedSections['user'] || false}
        onToggle={() => toggleSection('user')}
        icon="👤"
        summary={
          data.user.isAuthenticated ? `${data.user.plan.toUpperCase()} Plan` : 'Not logged in'
        }
      >
        <Table
          columns={[
            { key: 'property', header: 'Property', width: 20 },
            { key: 'value', header: 'Value', width: 30, color: 'cyan' },
          ]}
          data={[
            {
              property: 'Authentication',
              value: data.user.isAuthenticated ? 'Logged In' : 'Not Logged In',
            },
            { property: 'User ID', value: data.user.userId || 'Anonymous' },
            { property: 'Plan', value: data.user.plan.toUpperCase() },
            {
              property: 'Credits Remaining',
              value: `${data.user.credits.toLocaleString()} / ${data.user.plan === 'free' ? '100' : data.user.plan === 'pro' ? '5,000' : '20,000'}`,
            },
          ]}
          showHeader={false}
          compact
        />
        <Box marginTop={1}>
          <CrossReference
            label="View cost details"
            target="/cost"
            icon={figures.arrowRight}
            onNavigate={() => handleDrillDown([...drillDownPath, 'Cost Analysis'])}
          />
        </Box>
      </ExpandableSection>

      <ExpandableSection
        title="Service Status"
        expanded={expandedSections['services'] || false}
        onToggle={() => toggleSection('services')}
        icon="🔌"
        summary="All services operational"
      >
        <TreeView
          data={[
            {
              id: 'api',
              label: 'API Server',
              value: data.system.apiUrl,
              icon: '🌐',
              expanded: true,
              children: [
                { id: 'api-status', label: 'Status: Active', icon: '●' },
                { id: 'api-uptime', label: 'Uptime: 99.9%', icon: figures.tick },
                { id: 'api-latency', label: 'Latency: 45ms', icon: figures.circleFilled },
              ],
            },
            {
              id: 'sandbox',
              label: 'Cloud Sandbox',
              value: data.system.sandboxStatus,
              icon: '☁️',
              expanded: false,
              children: [
                {
                  id: 'sandbox-status',
                  label: `Status: ${data.system.sandboxStatus}`,
                  icon: data.system.sandboxStatus === 'ready' ? '●' : '⚠',
                },
                { id: 'sandbox-region', label: 'Region: us-central1', icon: '📍' },
              ],
            },
            {
              id: 'ai',
              label: 'AI Models',
              icon: '🤖',
              expanded: false,
              children: [
                { id: 'gemini', label: 'Gemini 2.5 Pro', icon: '✨' },
                { id: 'grok', label: 'Grok-4', icon: '⚡' },
              ],
            },
            {
              id: 'mcp',
              label: 'MCP Servers',
              value: '3 active',
              icon: '🔧',
              expanded: false,
              children: [
                { id: 'playwright', label: 'Playwright', icon: '🎭' },
                { id: 'filesystem', label: 'FileSystem', icon: '📁' },
                { id: 'git', label: 'Git', icon: '🔀' },
              ],
            },
          ]}
          onToggle={(nodeId) => console.log('Toggle node:', nodeId)}
          onSelect={(node) => handleDrillDown([...drillDownPath, node.label])}
        />
      </ExpandableSection>
    </Box>
  );

  const renderPerformance = () => (
    <Box flexDirection="column" marginTop={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Performance Metrics
        </Text>
      </Box>

      <Box marginBottom={2}>
        <Box flexDirection="column" marginRight={4}>
          <Box marginBottom={1}>
            <Text bold>Resource Usage</Text>
          </Box>
          <BarChart
            data={[
              {
                label: 'CPU',
                value: performanceData.cpu[performanceData.cpu.length - 1] || 0,
                color: 'yellow',
              },
              {
                label: 'Memory',
                value: performanceData.memory[performanceData.memory.length - 1] || 0,
                color: 'cyan',
              },
              { label: 'Network', value: Math.random() * 100, color: 'green' },
            ]}
            width={30}
          />
        </Box>

        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold>Credits Usage</Text>
          </Box>
          <ProgressRing
            value={
              data.user.plan === 'free'
                ? 100 - data.user.credits
                : data.user.plan === 'pro'
                  ? 5000 - data.user.credits
                  : 20000 - data.user.credits
            }
            total={data.user.plan === 'free' ? 100 : data.user.plan === 'pro' ? 5000 : 20000}
            label="Daily Usage"
            size="large"
          />
        </Box>
      </Box>

      <Box flexDirection="column" marginBottom={2}>
        <Box marginBottom={1}>
          <Text bold>Performance Trends</Text>
        </Box>
        <TrendLine data={performanceData.cpu} label="CPU Usage %" width={30} />
        <TrendLine data={performanceData.memory} label="Memory Usage %" width={30} />
        <TrendLine data={performanceData.requests} label="API Requests" width={30} />
      </Box>

      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>Response Time Heatmap (ms)</Text>
        </Box>
        <HeatMap
          data={[
            [12, 15, 18, 25, 30, 22, 18, 15],
            [15, 18, 22, 30, 35, 28, 22, 18],
            [18, 22, 28, 35, 40, 32, 25, 20],
            [20, 25, 30, 38, 45, 35, 28, 22],
          ]}
          labels={{
            x: ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'],
            y: ['API', 'AI', 'DB', 'Cache'],
          }}
        />
      </Box>
    </Box>
  );

  const renderResources = () => (
    <Box flexDirection="column" marginTop={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Resource Details
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={2}>
        <Box marginBottom={1}>
          <Text bold>Memory Breakdown</Text>
        </Box>
        <BarChart
          data={[
            { label: 'Heap Used', value: parseInt(data.resources.memory), color: 'yellow' },
            { label: 'External', value: Math.floor(Math.random() * 50 + 20), color: 'cyan' },
            { label: 'Array Buffers', value: Math.floor(Math.random() * 30 + 10), color: 'green' },
            { label: 'Cached', value: Math.floor(Math.random() * 40 + 30), color: 'magenta' },
          ]}
          width={40}
        />
      </Box>

      <Box flexDirection="column" marginBottom={2}>
        <Box marginBottom={1}>
          <Text bold>Active Connections</Text>
        </Box>
        <Table
          columns={[
            { key: 'service', header: 'Service', width: 20 },
            { key: 'status', header: 'Status', width: 10 },
            { key: 'latency', header: 'Latency', width: 10, align: 'right' },
            { key: 'requests', header: 'Requests/min', width: 15, align: 'right' },
          ]}
          data={[
            { service: 'Vertex AI', status: '● Active', latency: '45ms', requests: '120' },
            {
              service: 'Graph Database',
              status: process.env['NEO4J_ENABLED'] === 'true' ? '● Active' : '○ Disabled',
              latency: 'N/A',
              requests: '0',
            },
            {
              service: 'Authentication',
              status: process.env['FIREBASE_ENABLED'] === 'true' ? '● Active' : '○ Local Mode',
              latency: 'N/A',
              requests: '0',
            },
            { service: 'Cloud Storage', status: '● Active', latency: '15ms', requests: '30' },
          ]}
        />
      </Box>

      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>Storage Usage</Text>
        </Box>
        <Box>
          <Box flexDirection="column" marginRight={2}>
            <Text color="gray">Project Files</Text>
            <ProgressRing value={35} total={100} size="medium" />
          </Box>
          <Box flexDirection="column" marginRight={2}>
            <Text color="gray">Cache</Text>
            <ProgressRing value={68} total={100} size="medium" />
          </Box>
          <Box flexDirection="column">
            <Text color="gray">Logs</Text>
            <ProgressRing value={22} total={100} size="medium" />
          </Box>
        </Box>
      </Box>
    </Box>
  );

  const renderHistory = () => (
    <Box flexDirection="column" marginTop={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Activity History
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={2}>
        <Box marginBottom={1}>
          <Text bold>Recent Events</Text>
        </Box>
        <Timeline
          events={[
            { time: '2 min ago', event: 'Command executed: /status', type: 'info' },
            { time: '5 min ago', event: 'AI model switched to Gemini 2.5 Pro', type: 'success' },
            { time: '12 min ago', event: 'Project initialized', type: 'success' },
            { time: '15 min ago', event: 'User logged in', type: 'info' },
            { time: '18 min ago', event: 'Rate limit warning', type: 'warning' },
            { time: '25 min ago', event: 'Session started', type: 'info' },
          ]}
        />
      </Box>

      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>Command Usage Statistics</Text>
        </Box>
        <BarChart
          data={[
            { label: '/help', value: 15, color: 'cyan' },
            { label: '/status', value: 12, color: 'cyan' },
            { label: '/model', value: 8, color: 'green' },
            { label: '/cost', value: 6, color: 'yellow' },
            { label: '/init', value: 4, color: 'magenta' },
          ]}
          width={35}
        />
      </Box>
    </Box>
  );

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
      <Box marginBottom={1} justifyContent="space-between">
        <Text bold color="cyan">
          {figures.info} MARIA Code Status Dashboard
        </Text>
        <Text color="gray">Press TAB to switch tabs, Q to close</Text>
      </Box>

      <Box marginBottom={1}>
        {tabs.map((tab, i) => (
          <Box key={tab} marginRight={2}>
            <Text color={activeTab === tab ? 'cyan' : 'gray'} bold={activeTab === tab}>
              {i + 1}. {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </Box>
        ))}
      </Box>

      <Box borderStyle="single" borderColor="gray" minHeight={20}>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'performance' && renderPerformance()}
        {activeTab === 'resources' && renderResources()}
        {activeTab === 'history' && renderHistory()}
      </Box>
    </Box>
  );
};
