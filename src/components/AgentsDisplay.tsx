/**
 * Agents Display Component with Rich Visualizations
 * Shows AI agents status, usage statistics, and performance
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
  StatusIndicator,
  Timeline,
  TreeView,
  SmartSummary,
  DrillDownNav
} from './visualizations';

interface AgentInfo {
  name: string;
  status: string;
  description: string;
}

interface IntegrationInfo {
  name: string;
  status: string;
  description: string;
}

interface AgentsData {
  agents: AgentInfo[];
  integrations: IntegrationInfo[];
}

export const AgentsDisplay: React.FC<{
  data: AgentsData;
  onClose?: () => void;
}> = ({ data }) => {
  const [activeTab] = useState<'overview' | 'usage' | 'performance' | 'config'>('overview');
  const [agentMetrics, setAgentMetrics] = useState({
    paperWriter: { calls: 45, avgTime: 3.2, successRate: 98 },
    slidesCreator: { calls: 32, avgTime: 2.8, successRate: 96 },
    codeReviewer: { calls: 78, avgTime: 1.5, successRate: 99 },
    devOpsEngineer: { calls: 23, avgTime: 4.1, successRate: 95 }
  });
  const [drillDownPath, setDrillDownPath] = useState<string[]>(['Agents Overview']);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setAgentMetrics(prev => ({
        paperWriter: { 
          ...prev.paperWriter, 
          calls: prev.paperWriter.calls + Math.floor(Math.random() * 3) 
        },
        slidesCreator: { 
          ...prev.slidesCreator, 
          calls: prev.slidesCreator.calls + Math.floor(Math.random() * 2) 
        },
        codeReviewer: { 
          ...prev.codeReviewer, 
          calls: prev.codeReviewer.calls + Math.floor(Math.random() * 5) 
        },
        devOpsEngineer: { 
          ...prev.devOpsEngineer, 
          calls: prev.devOpsEngineer.calls + Math.floor(Math.random() * 2) 
        }
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const tabs = ['overview', 'usage', 'performance', 'config'];


  const renderOverview = () => (
    <Box flexDirection="column" marginTop={1}>
      <SmartSummary
        data={{
          totalCalls: Object.values(agentMetrics).reduce((sum, m) => sum + m.calls, 0),
          mostActive: 'Code Reviewer',
          peakTime: '2-3 PM',
          avgResponse: '2.4s',
          successRate: 97
        }}
        type="usage"
      />

      <DrillDownNav 
        path={drillDownPath} 
        onNavigate={(index) => setDrillDownPath(drillDownPath.slice(0, index + 1))}
      />

      <Box marginBottom={2}>
        <MetricCard
          title="Active Agents"
          value={data.agents.filter(a => a.status === 'available').length}
          subtitle={`of ${data.agents.length} total`}
          icon="🤖"
          color="cyan"
        />
        <Box marginLeft={2}>
          <MetricCard
            title="Total Calls"
            value={Object.values(agentMetrics).reduce((sum, m) => sum + m.calls, 0)}
            subtitle="Today"
            icon="📊"
            trend="up"
            color="green"
          />
        </Box>
        <Box marginLeft={2}>
          <MetricCard
            title="Avg Response"
            value="2.4s"
            subtitle="All agents"
            icon={figures.circleFilled}
            trend="stable"
            color="yellow"
          />
        </Box>
      </Box>

      <Box flexDirection="column" marginBottom={2}>
        <Box marginBottom={1}>
          <Text bold>Built-in AI Agents</Text>
        </Box>
        <Table
          columns={[
            { key: 'name', header: 'Agent', width: 20 },
            { key: 'status', header: 'Status', width: 12 },
            { key: 'calls', header: 'Calls', width: 8, align: 'right' },
            { key: 'success', header: 'Success', width: 10, align: 'right', color: 'green' }
          ]}
          data={[
            { 
              name: 'Paper Writer', 
              status: '● Active', 
              calls: agentMetrics.paperWriter.calls,
              success: `${agentMetrics.paperWriter.successRate}%`
            },
            { 
              name: 'Slides Creator', 
              status: '● Active', 
              calls: agentMetrics.slidesCreator.calls,
              success: `${agentMetrics.slidesCreator.successRate}%`
            },
            { 
              name: 'Code Reviewer', 
              status: '● Active', 
              calls: agentMetrics.codeReviewer.calls,
              success: `${agentMetrics.codeReviewer.successRate}%`
            },
            { 
              name: 'DevOps Engineer', 
              status: '● Active', 
              calls: agentMetrics.devOpsEngineer.calls,
              success: `${agentMetrics.devOpsEngineer.successRate}%`
            }
          ]}
        />
      </Box>

      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>IDE Integrations</Text>
        </Box>
        <Box flexDirection="column">
          {data.integrations.map((integration, i) => (
            <Box key={i} marginBottom={1}>
              <StatusIndicator 
                status={integration.status === 'available' ? 'active' : 
                        integration.status === 'planned' ? 'pending' : 'inactive'} 
              />
              <Text> {integration.name}</Text>
              <Text color="gray"> - {integration.description}</Text>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );

  const renderUsage = () => (
    <Box flexDirection="column" marginTop={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Agent Usage Statistics</Text>
      </Box>

      <Box flexDirection="column" marginBottom={2}>
        <Box marginBottom={1}>
          <Text bold>Usage by Agent</Text>
        </Box>
        <BarChart
          data={[
            { label: 'Code Reviewer', value: agentMetrics.codeReviewer.calls, color: 'cyan' },
            { label: 'Paper Writer', value: agentMetrics.paperWriter.calls, color: 'green' },
            { label: 'Slides Creator', value: agentMetrics.slidesCreator.calls, color: 'yellow' },
            { label: 'DevOps Engineer', value: agentMetrics.devOpsEngineer.calls, color: 'magenta' }
          ]}
          width={40}
        />
      </Box>

      <Box flexDirection="column" marginBottom={2}>
        <Box marginBottom={1}>
          <Text bold>Usage Trends (Last 7 Days)</Text>
        </Box>
        <TrendLine 
          data={[45, 52, 48, 65, 72, 68, Object.values(agentMetrics).reduce((sum, m) => sum + m.calls, 0)]} 
          label="Total Daily Calls" 
          width={40} 
        />
        <TrendLine 
          data={[2.8, 2.6, 2.7, 2.5, 2.4, 2.5, 2.4]} 
          label="Avg Response Time (s)" 
          width={40} 
        />
      </Box>

      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>Recent Agent Activity</Text>
        </Box>
        <Timeline
          events={[
            { time: '1m ago', event: 'Code review completed for PR #123', type: 'success' },
            { time: '5m ago', event: 'Slides generated: Q4 Report', type: 'success' },
            { time: '12m ago', event: 'Paper formatting: Research.tex', type: 'info' },
            { time: '15m ago', event: 'DevOps deployment to staging', type: 'success' },
            { time: '20m ago', event: 'Code review detected 3 issues', type: 'warning' },
            { time: '25m ago', event: 'Paper Writer started new draft', type: 'info' }
          ]}
        />
      </Box>
    </Box>
  );

  const renderPerformance = () => (
    <Box flexDirection="column" marginTop={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Agent Performance Metrics</Text>
      </Box>

      <Box marginBottom={2}>
        <Box flexDirection="column" marginRight={4}>
          <Box marginBottom={1}>
            <Text bold>Response Time Distribution</Text>
          </Box>
          <BarChart
            data={[
              { label: '<1s', value: 35, color: 'green' },
              { label: '1-2s', value: 40, color: 'green' },
              { label: '2-5s', value: 20, color: 'yellow' },
              { label: '>5s', value: 5, color: 'red' }
            ]}
            width={30}
          />
        </Box>

        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold>Success Rates</Text>
          </Box>
          {Object.entries(agentMetrics).map(([agent, metrics]) => (
            <Box key={agent} marginBottom={1}>
              <Text>{agent.replace(/([A-Z])/g, ' $1').trim()}: </Text>
              <ProgressRing
                value={metrics.successRate}
                total={100}
                size="small"
              />
            </Box>
          ))}
        </Box>
      </Box>

      <Box flexDirection="column" marginBottom={2}>
        <Box marginBottom={1}>
          <Text bold>Performance by Time of Day</Text>
        </Box>
        <Box flexDirection="column">
          <Text color="gray">Response times (seconds)</Text>
          <BarChart
            data={[
              { label: 'Morning', value: 2.1, color: 'green' },
              { label: 'Midday', value: 2.8, color: 'yellow' },
              { label: 'Afternoon', value: 2.5, color: 'yellow' },
              { label: 'Evening', value: 2.2, color: 'green' },
              { label: 'Night', value: 1.8, color: 'green' }
            ]}
            width={35}
            showValues={true}
          />
        </Box>
      </Box>

      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>Quality Metrics</Text>
        </Box>
        <Table
          columns={[
            { key: 'metric', header: 'Metric', width: 25 },
            { key: 'value', header: 'Value', width: 15, align: 'right', color: 'cyan' }
          ]}
          data={[
            { metric: 'Code Review Accuracy', value: '94%' },
            { metric: 'Paper Formatting Success', value: '98%' },
            { metric: 'Slides Visual Quality', value: '92%' },
            { metric: 'Deployment Success Rate', value: '95%' },
            { metric: 'User Satisfaction', value: '4.6/5.0' }
          ]}
        />
      </Box>
    </Box>
  );

  const renderConfig = () => (
    <Box flexDirection="column" marginTop={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Agent Configuration</Text>
      </Box>

      <Box flexDirection="column" marginBottom={2}>
        <Box marginBottom={1}>
          <Text bold>Agent Capabilities</Text>
        </Box>
        <TreeView
          data={[
            {
              id: 'paper',
              label: 'Paper Writer',
              icon: '📝',
              expanded: true,
              children: [
                { id: 'latex', label: 'LaTeX formatting' },
                { id: 'bibtex', label: 'BibTeX management' },
                { id: 'citations', label: 'Citation formatting' },
                { id: 'templates', label: 'Template library' }
              ]
            },
            {
              id: 'slides',
              label: 'Slides Creator',
              icon: '🎨',
              expanded: true,
              children: [
                { id: 'themes', label: 'Theme selection' },
                { id: 'layouts', label: 'Layout optimization' },
                { id: 'visuals', label: 'Visual generation' },
                { id: 'export', label: 'Export formats' }
              ]
            },
            {
              id: 'code',
              label: 'Code Reviewer',
              icon: '🔍',
              expanded: true,
              children: [
                { id: 'security', label: 'Security analysis' },
                { id: 'performance', label: 'Performance tips' },
                { id: 'style', label: 'Style checking' },
                { id: 'tests', label: 'Test suggestions' }
              ]
            }
          ]}
        />
      </Box>

      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>Agent Settings</Text>
        </Box>
        <Table
          columns={[
            { key: 'setting', header: 'Setting', width: 25 },
            { key: 'value', header: 'Current Value', width: 20, align: 'right' }
          ]}
          data={[
            { setting: 'Max Concurrent Agents', value: '3' },
            { setting: 'Response Timeout', value: '30s' },
            { setting: 'Auto-retry on Failure', value: 'Enabled' },
            { setting: 'Cache Results', value: '24 hours' },
            { setting: 'Preferred Model', value: 'Gemini 2.5 Pro' },
            { setting: 'Context Window', value: '128K tokens' }
          ]}
        />
      </Box>
    </Box>
  );

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
      <Box marginBottom={1} justifyContent="space-between">
        <Text bold color="cyan">
          🤖 AI Agents Management Dashboard
        </Text>
        <Text color="gray">Press TAB to switch tabs, Q to close</Text>
      </Box>

      <Box marginBottom={1}>
        {tabs.map((tab, i) => (
          <Box key={tab} marginRight={2}>
            <Text
              color={activeTab === tab ? 'cyan' : 'gray'}
              bold={activeTab === tab}
            >
              {i + 1}. {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </Box>
        ))}
      </Box>

      <Box borderStyle="single" borderColor="gray" minHeight={20}>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'usage' && renderUsage()}
        {activeTab === 'performance' && renderPerformance()}
        {activeTab === 'config' && renderConfig()}
      </Box>
    </Box>
  );
};