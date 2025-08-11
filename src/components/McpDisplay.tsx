/**
 * MCP Display Component with Rich Visualizations
 * Shows Model Context Protocol servers status and monitoring
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import figures from 'figures';
import {
  BarChart,
  ProgressRing,
  MetricCard,
  Table,
  HeatMap,
  Timeline,
  TreeView,
  ExpandableSection,
  SmartSummary,
  DrillDownNav,
} from './visualizations';

interface McpServer {
  name: string;
  status: string;
  description: string;
}

interface McpData {
  servers: McpServer[];
  active: number;
  available: number;
}

export const McpDisplay: React.FC<{
  data: McpData;
  onClose?: () => void;
}> = ({ data }) => {
  const [activeTab] = useState<'overview' | 'health' | 'connections' | 'logs'>('overview');
  const [serverMetrics, setServerMetrics] = useState({
    playwright: { latency: 45, requests: 120, errors: 2, memory: 85 },
    filesystem: { latency: 12, requests: 450, errors: 0, memory: 45 },
    git: { latency: 25, requests: 180, errors: 1, memory: 32 },
    sqlite: { latency: 8, requests: 0, errors: 0, memory: 0 },
    github: { latency: 35, requests: 0, errors: 0, memory: 0 },
  });
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    serverStatus: true,
    quickActions: false,
    connectionDetails: true,
  });
  const [drillDownPath, setDrillDownPath] = useState<string[]>(['MCP Overview']);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setServerMetrics((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((server) => {
          const metrics = updated[server as keyof typeof updated];
          metrics.latency = Math.max(5, metrics.latency + (Math.random() - 0.5) * 10);
          metrics.requests = metrics.requests + Math.floor(Math.random() * 20);
          metrics.errors = metrics.errors + (Math.random() > 0.95 ? 1 : 0);
          metrics.memory = Math.min(100, Math.max(0, metrics.memory + (Math.random() - 0.5) * 5));
        });
        return updated;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const tabs = ['overview', 'health', 'connections', 'logs'];

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const renderOverview = () => (
    <Box flexDirection="column" marginTop={1}>
      <SmartSummary
        data={{
          avgResponse: `${Math.round(Object.values(serverMetrics).reduce((sum, m) => sum + m.latency, 0) / data.servers.length)}ms`,
          successRate: 98.5,
          bottleneck: 'Playwright (high memory usage)',
        }}
        type="performance"
      />

      <DrillDownNav
        path={drillDownPath}
        onNavigate={(index) => setDrillDownPath(drillDownPath.slice(0, index + 1))}
      />

      <Box marginBottom={2}>
        <MetricCard
          title="Active Servers"
          value={`${data.active}/${data.servers.length}`}
          subtitle="MCP connections"
          icon="🔌"
          color="cyan"
        />
        <Box marginLeft={2}>
          <MetricCard
            title="Total Capacity"
            value={`${Math.round((data.active / data.servers.length) * 100)}%`}
            subtitle="Server utilization"
            icon="📊"
            trend={data.active > 3 ? 'up' : 'stable'}
            color="yellow"
          />
        </Box>
        <Box marginLeft={2}>
          <MetricCard
            title="Avg Response"
            value={`${Math.round(Object.values(serverMetrics).reduce((sum, m) => sum + m.latency, 0) / data.servers.length)}ms`}
            subtitle="All servers"
            icon={figures.circleFilled}
            color="green"
          />
        </Box>
      </Box>

      <ExpandableSection
        title="Server Status"
        expanded={expandedSections.serverStatus || false}
        onToggle={() => toggleSection('serverStatus')}
        icon="🖥️"
        summary={`${data.active}/${data.servers.length} servers active`}
      >
        <Table
          columns={[
            { key: 'name', header: 'Server', width: 15 },
            { key: 'status', header: 'Status', width: 10 },
            { key: 'latency', header: 'Latency', width: 10, align: 'right' },
            { key: 'requests', header: 'Requests', width: 10, align: 'right' },
            { key: 'memory', header: 'Memory', width: 10, align: 'right' },
          ]}
          data={data.servers.map((server) => {
            const metrics = serverMetrics[server.name.toLowerCase() as keyof typeof serverMetrics];
            return {
              name: server.name,
              status: server.status === 'active' ? '● Active' : '○ Inactive',
              latency: metrics ? `${Math.round(metrics.latency)}ms` : '-',
              requests: metrics ? metrics.requests.toString() : '0',
              memory: metrics ? `${Math.round(metrics.memory)}%` : '0%',
            };
          })}
        />
      </ExpandableSection>

      <ExpandableSection
        title="Quick Actions"
        expanded={expandedSections.quickActions || false}
        onToggle={() => toggleSection('quickActions')}
        icon="⚡"
        summary="Server management commands"
      >
        <Box flexDirection="column">
          <Text color="gray">• /mcp start {'<server>'} - Start MCP server</Text>
          <Text color="gray">• /mcp stop {'<server>'} - Stop MCP server</Text>
          <Text color="gray">• /mcp restart {'<server>'} - Restart server</Text>
          <Text color="gray">• /mcp logs {'<server>'} - View server logs</Text>
        </Box>
      </ExpandableSection>
    </Box>
  );

  const renderHealth = () => {
    const activeServers = data.servers.filter((s) => s.status === 'active');

    return (
      <Box flexDirection="column" marginTop={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">
            Server Health Monitoring
          </Text>
        </Box>

        <Box flexDirection="column" marginBottom={2}>
          <Box marginBottom={1}>
            <Text bold>Response Time Distribution</Text>
          </Box>
          <BarChart
            data={activeServers.map((server) => {
              const metrics =
                serverMetrics[server.name.toLowerCase() as keyof typeof serverMetrics];
              return {
                label: server.name,
                value: metrics ? metrics.latency : 0,
                color:
                  metrics && metrics.latency > 50
                    ? 'red'
                    : metrics && metrics.latency > 30
                      ? 'yellow'
                      : 'green',
              };
            })}
            width={40}
          />
        </Box>

        <Box marginBottom={2}>
          <Box flexDirection="column" marginRight={4}>
            <Box marginBottom={1}>
              <Text bold>Memory Usage</Text>
            </Box>
            {activeServers.map((server) => {
              const metrics =
                serverMetrics[server.name.toLowerCase() as keyof typeof serverMetrics];
              return (
                <Box key={server.name} marginBottom={1}>
                  <Text>{server.name.padEnd(12)}</Text>
                  <ProgressRing value={metrics ? metrics.memory : 0} total={100} size="small" />
                </Box>
              );
            })}
          </Box>

          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text bold>Error Rates (per hour)</Text>
            </Box>
            <BarChart
              data={activeServers.map((server) => {
                const metrics =
                  serverMetrics[server.name.toLowerCase() as keyof typeof serverMetrics];
                return {
                  label: server.name,
                  value: metrics ? metrics.errors : 0,
                  color:
                    metrics && metrics.errors > 5
                      ? 'red'
                      : metrics && metrics.errors > 2
                        ? 'yellow'
                        : 'green',
                };
              })}
              width={25}
            />
          </Box>
        </Box>

        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold>Performance Heatmap (Last 24h)</Text>
          </Box>
          <HeatMap
            data={[
              [10, 15, 12, 18, 25, 30, 28, 22],
              [5, 8, 10, 12, 15, 20, 18, 15],
              [8, 12, 15, 20, 25, 28, 25, 20],
              [0, 0, 0, 5, 8, 10, 8, 5],
              [0, 0, 0, 3, 5, 8, 6, 3],
            ]}
            labels={{
              x: ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'],
              y: ['Playwright', 'FileSystem', 'Git', 'SQLite', 'GitHub'],
            }}
          />
          <Text color="gray" dimColor>
            Higher load shown in red
          </Text>
        </Box>
      </Box>
    );
  };

  const renderConnections = () => (
    <Box flexDirection="column" marginTop={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Connection Details
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={2}>
        <Box marginBottom={1}>
          <Text bold>Active Connections</Text>
        </Box>
        <TreeView
          data={[
            {
              id: 'playwright',
              label: 'Playwright (Browser Automation)',
              icon: '🎭',
              expanded: true,
              children: [
                { id: 'chrome', label: 'Chrome instance (active)', icon: '🌐' },
                { id: 'firefox', label: 'Firefox instance (standby)', icon: '🦊' },
                { id: 'webkit', label: 'WebKit instance (inactive)', icon: '🧭' },
              ],
            },
            {
              id: 'filesystem',
              label: 'FileSystem (Project Files)',
              icon: '📁',
              expanded: true,
              children: [
                { id: 'read', label: 'Read operations: 245/min', icon: '📖' },
                { id: 'write', label: 'Write operations: 18/min', icon: '✏️' },
                { id: 'watch', label: 'File watchers: 12 active', icon: '👁️' },
              ],
            },
            {
              id: 'git',
              label: 'Git (Version Control)',
              icon: '🔀',
              expanded: true,
              children: [
                { id: 'status', label: 'Status checks: 85/min', icon: '📊' },
                { id: 'commits', label: 'Commit operations: 5/min', icon: '💾' },
                { id: 'branches', label: 'Branch operations: 2/min', icon: '🌿' },
              ],
            },
          ]}
        />
      </Box>

      <Box flexDirection="column" marginBottom={2}>
        <Box marginBottom={1}>
          <Text bold>Connection Pool Status</Text>
        </Box>
        <Table
          columns={[
            { key: 'metric', header: 'Metric', width: 25 },
            { key: 'value', header: 'Value', width: 15, align: 'right', color: 'cyan' },
          ]}
          data={[
            { metric: 'Max Connections', value: '10' },
            { metric: 'Active Connections', value: `${data.active}` },
            { metric: 'Idle Connections', value: `${10 - data.active}` },
            { metric: 'Connection Timeout', value: '30s' },
            { metric: 'Keep-alive Duration', value: '5 min' },
            { metric: 'Reconnect Attempts', value: '3' },
          ]}
        />
      </Box>

      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>Protocol Statistics</Text>
        </Box>
        <BarChart
          data={[
            { label: 'JSON-RPC calls', value: 850, color: 'cyan' },
            { label: 'WebSocket msgs', value: 320, color: 'green' },
            { label: 'HTTP requests', value: 180, color: 'yellow' },
            { label: 'Errors', value: 12, color: 'red' },
          ]}
          width={35}
        />
      </Box>
    </Box>
  );

  const renderLogs = () => (
    <Box flexDirection="column" marginTop={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Server Logs & Events
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={2}>
        <Box marginBottom={1}>
          <Text bold>Recent Server Events</Text>
        </Box>
        <Timeline
          events={[
            { time: '30s ago', event: 'Playwright: Browser instance started', type: 'success' },
            { time: '2m ago', event: 'FileSystem: Large file operation completed', type: 'info' },
            { time: '5m ago', event: 'Git: Repository sync completed', type: 'success' },
            { time: '8m ago', event: 'SQLite: Connection timeout', type: 'warning' },
            { time: '12m ago', event: 'GitHub: Rate limit warning (80% used)', type: 'warning' },
            { time: '15m ago', event: 'Playwright: Page load timeout', type: 'error' },
            { time: '20m ago', event: 'All servers health check passed', type: 'success' },
            { time: '25m ago', event: 'MCP service started', type: 'info' },
          ]}
        />
      </Box>

      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>Log Level Distribution</Text>
        </Box>
        <Box marginBottom={1}>
          <BarChart
            data={[
              { label: 'Debug', value: 245, color: 'gray' },
              { label: 'Info', value: 180, color: 'cyan' },
              { label: 'Warning', value: 32, color: 'yellow' },
              { label: 'Error', value: 8, color: 'red' },
            ]}
            width={30}
          />
        </Box>
        <Text color="gray">
          <Text dimColor>Tip: Use /mcp logs {'<server>'} --level=error to filter by severity</Text>
        </Text>
      </Box>
    </Box>
  );

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
      <Box marginBottom={1} justifyContent="space-between">
        <Text bold color="cyan">
          🔌 MCP Server Management Dashboard
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
        {activeTab === 'health' && renderHealth()}
        {activeTab === 'connections' && renderConnections()}
        {activeTab === 'logs' && renderLogs()}
      </Box>
    </Box>
  );
};
