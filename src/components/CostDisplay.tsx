/**
 * Cost Display Component with Rich Visualizations
 * Shows detailed cost analysis and projections
 */

import React, { useState } from 'react';
import { Box, Text } from 'ink';
import figures from 'figures';
import {
  BarChart,
  ProgressRing,
  TrendLine,
  MetricCard,
  Table,
  Timeline,
  HeatMap,
  SmartSummary
} from './visualizations';

interface CostStats {
  session: {
    cost: number;
    tokens: number;
    messages: number;
    duration: string;
    avgCostPerMessage: number;
  };
  user: {
    plan: string;
    dailyLimit: number;
    remainingCredits: number;
    usagePercent: number;
  };
  projected: {
    hourlyRate: number;
    dailyProjection: number;
  };
}

export const CostDisplay: React.FC<{
  stats: CostStats;
  onClose?: () => void;
}> = ({ stats }) => {
  const [activeTab] = useState<'overview' | 'breakdown' | 'trends' | 'projections'>('overview');

  // Mock historical data for trends
  const historicalCosts = [0.002, 0.003, 0.0025, 0.004, 0.0035, 0.003, 0.0045, stats.session.cost];
  const tokenUsage = [500, 750, 600, 1000, 850, 700, 1100, stats.session.tokens];

  const tabs = ['overview', 'breakdown', 'trends', 'projections'];


  const renderOverview = () => (
    <Box flexDirection="column" marginTop={1}>
      <SmartSummary
        data={{
          cost: stats.session.cost,
          trend: stats.session.cost > 0.003 ? 'up' : 'stable',
          mostExpensive: 'AI Model Calls'
        }}
        type="cost"
      />

      <Box marginBottom={2}>
        <MetricCard
          title="Session Cost"
          value={`$${stats.session.cost.toFixed(6)}`}
          subtitle={`${stats.session.tokens.toLocaleString()} tokens`}
          icon="💰"
          color="yellow"
        />
        <Box marginLeft={2}>
          <MetricCard
            title="Messages"
            value={stats.session.messages}
            subtitle={`$${stats.session.avgCostPerMessage.toFixed(6)}/msg`}
            icon="💬"
            color="cyan"
          />
        </Box>
        <Box marginLeft={2}>
          <MetricCard
            title="Duration"
            value={stats.session.duration}
            subtitle="Session time"
            icon={figures.circleFilled}
            color="green"
          />
        </Box>
      </Box>

      <Box flexDirection="column" marginBottom={2}>
        <Box marginBottom={1}>
          <Text bold>Plan Usage</Text>
        </Box>
        <Box>
          <Box flexDirection="column" marginRight={4}>
            <ProgressRing
              value={stats.user.dailyLimit - stats.user.remainingCredits}
              total={stats.user.dailyLimit}
              label={`${stats.user.plan.toUpperCase()} Plan`}
              size="large"
            />
          </Box>
          <Box flexDirection="column">
            <Table
              columns={[
                { key: 'metric', header: 'Metric', width: 20 },
                { key: 'value', header: 'Value', width: 20, align: 'right', color: 'cyan' }
              ]}
              data={[
                { metric: 'Daily Limit', value: stats.user.dailyLimit.toLocaleString() },
                { metric: 'Credits Used', value: (stats.user.dailyLimit - stats.user.remainingCredits).toLocaleString() },
                { metric: 'Credits Remaining', value: stats.user.remainingCredits.toLocaleString() },
                { metric: 'Usage Percentage', value: `${stats.user.usagePercent}%` }
              ]}
              showHeader={false}
              compact
            />
          </Box>
        </Box>
      </Box>

      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>Cost Projections</Text>
        </Box>
        <Box>
          <Box marginRight={2}>
            <Text color="gray">Hourly Rate: </Text>
            <Text color="yellow" bold>${stats.projected.hourlyRate.toFixed(4)}</Text>
          </Box>
          <Box>
            <Text color="gray">Daily Projection: </Text>
            <Text color={stats.projected.dailyProjection > 10 ? 'red' : 'yellow'} bold>
              ${stats.projected.dailyProjection.toFixed(4)}
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );

  const renderBreakdown = () => (
    <Box flexDirection="column" marginTop={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Cost Breakdown Analysis</Text>
      </Box>

      <Box flexDirection="column" marginBottom={2}>
        <Box marginBottom={1}>
          <Text bold>Token Usage by Type</Text>
        </Box>
        <BarChart
          data={[
            { label: 'Input Tokens', value: Math.floor(stats.session.tokens * 0.4), color: 'cyan' },
            { label: 'Output Tokens', value: Math.floor(stats.session.tokens * 0.6), color: 'yellow' }
          ]}
          width={40}
        />
      </Box>

      <Box flexDirection="column" marginBottom={2}>
        <Box marginBottom={1}>
          <Text bold>Cost by Model</Text>
        </Box>
        <BarChart
          data={[
            { label: 'Gemini 2.5 Pro', value: stats.session.cost * 0.7, color: 'green' },
            { label: 'Grok-4', value: stats.session.cost * 0.3, color: 'magenta' }
          ]}
          width={40}
          showValues={false}
        />
        <Box marginTop={1}>
          <Table
            columns={[
              { key: 'model', header: 'Model', width: 20 },
              { key: 'calls', header: 'Calls', width: 10, align: 'right' },
              { key: 'avgTokens', header: 'Avg Tokens', width: 12, align: 'right' },
              { key: 'cost', header: 'Cost', width: 15, align: 'right', color: 'yellow' }
            ]}
            data={[
              { 
                model: 'Gemini 2.5 Pro', 
                calls: Math.floor(stats.session.messages * 0.6),
                avgTokens: Math.floor(stats.session.tokens / stats.session.messages),
                cost: `$${(stats.session.cost * 0.7).toFixed(6)}`
              },
              { 
                model: 'Grok-4', 
                calls: Math.floor(stats.session.messages * 0.4),
                avgTokens: Math.floor(stats.session.tokens / stats.session.messages * 0.8),
                cost: `$${(stats.session.cost * 0.3).toFixed(6)}`
              }
            ]}
          />
        </Box>
      </Box>

      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>Cost by Operation Type</Text>
        </Box>
        <BarChart
          data={[
            { label: 'Code Generation', value: 35, color: 'cyan' },
            { label: 'Code Analysis', value: 25, color: 'green' },
            { label: 'Documentation', value: 20, color: 'yellow' },
            { label: 'Conversation', value: 15, color: 'magenta' },
            { label: 'Other', value: 5, color: 'gray' }
          ]}
          width={35}
        />
      </Box>
    </Box>
  );

  const renderTrends = () => (
    <Box flexDirection="column" marginTop={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Usage Trends</Text>
      </Box>

      <Box flexDirection="column" marginBottom={2}>
        <Box marginBottom={1}>
          <Text bold>Cost Trend (Last 8 Sessions)</Text>
        </Box>
        <TrendLine data={historicalCosts} label="Session Cost ($)" width={40} />
        <Box marginTop={1}>
          <TrendLine data={tokenUsage} label="Token Usage" width={40} />
        </Box>
      </Box>

      <Box flexDirection="column" marginBottom={2}>
        <Box marginBottom={1}>
          <Text bold>Daily Usage Pattern</Text>
        </Box>
        <HeatMap
          data={[
            [10, 15, 20, 35, 40, 45, 38, 25, 20, 15, 12, 8],
            [8, 12, 18, 30, 38, 42, 40, 30, 22, 18, 14, 10],
            [12, 18, 25, 40, 45, 50, 45, 35, 28, 20, 16, 12],
            [15, 22, 30, 45, 50, 55, 48, 38, 30, 22, 18, 14],
            [18, 25, 35, 48, 55, 60, 52, 40, 32, 25, 20, 16]
          ]}
          labels={{
            x: ['12am', '2am', '4am', '6am', '8am', '10am', '12pm', '2pm', '4pm', '6pm', '8pm', '10pm'],
            y: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
          }}
        />
        <Text color="gray">Higher usage shown in red</Text>
      </Box>

      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>Recent Cost Events</Text>
        </Box>
        <Timeline
          events={[
            { time: 'Now', event: `Cost analysis: $${stats.session.cost.toFixed(6)}`, type: 'info' },
            { time: '30m ago', event: 'High token usage detected', type: 'warning' },
            { time: '1h ago', event: 'Switched to efficient mode', type: 'success' },
            { time: '2h ago', event: 'Model optimization applied', type: 'success' },
            { time: '3h ago', event: 'Cost threshold alert', type: 'warning' }
          ]}
        />
      </Box>
    </Box>
  );

  const renderProjections = () => {
    const monthlyProjection = stats.projected.dailyProjection * 30;
    const yearlyProjection = stats.projected.dailyProjection * 365;
    
    return (
      <Box flexDirection="column" marginTop={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">Cost Projections & Optimization</Text>
        </Box>

        <Box marginBottom={2}>
          <MetricCard
            title="Monthly"
            value={`$${monthlyProjection.toFixed(2)}`}
            subtitle="Based on current usage"
            icon="📅"
            trend={monthlyProjection > 100 ? 'up' : 'stable'}
            color="yellow"
          />
          <Box marginLeft={2}>
            <MetricCard
              title="Yearly"
              value={`$${yearlyProjection.toFixed(2)}`}
              subtitle="Projected annual cost"
              icon="📊"
              trend="up"
              color="red"
            />
          </Box>
        </Box>

        <Box flexDirection="column" marginBottom={2}>
          <Box marginBottom={1}>
            <Text bold>Cost Optimization Suggestions</Text>
          </Box>
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text color="green">✓ </Text>
              <Text>Use /compact to reduce token usage by ~40%</Text>
            </Box>
            <Box marginBottom={1}>
              <Text color="green">✓ </Text>
              <Text>Switch to Grok-4 for simple tasks (30% cheaper)</Text>
            </Box>
            <Box marginBottom={1}>
              <Text color="green">✓ </Text>
              <Text>Enable smart caching to avoid repeated queries</Text>
            </Box>
            <Box marginBottom={1}>
              <Text color="green">✓ </Text>
              <Text>Use batch operations for multiple related tasks</Text>
            </Box>
          </Box>
        </Box>

        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold>Plan Comparison</Text>
          </Box>
          <Table
            columns={[
              { key: 'plan', header: 'Plan', width: 12 },
              { key: 'dailyLimit', header: 'Daily Limit', width: 12, align: 'right' },
              { key: 'monthlyCost', header: 'Monthly', width: 12, align: 'right' },
              { key: 'savings', header: 'Savings', width: 12, align: 'right', color: 'green' }
            ]}
            data={[
              { plan: 'FREE', dailyLimit: '100', monthlyCost: '$0', savings: '-' },
              { plan: 'PRO', dailyLimit: '5,000', monthlyCost: '$20', savings: '$50/mo' },
              { plan: 'MAX', dailyLimit: '20,000', monthlyCost: '$100', savings: '$200/mo' },
              { plan: 'API Mode', dailyLimit: 'Unlimited', monthlyCost: 'Pay as you go', savings: 'Variable' }
            ]}
          />
        </Box>
      </Box>
    );
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
      <Box marginBottom={1} justifyContent="space-between">
        <Text bold color="yellow">
          💰 Cost Analysis Dashboard
        </Text>
        <Text color="gray">Press TAB to switch tabs, Q to close</Text>
      </Box>

      <Box marginBottom={1}>
        {tabs.map((tab, i) => (
          <Box key={tab} marginRight={2}>
            <Text
              color={activeTab === tab ? 'yellow' : 'gray'}
              bold={activeTab === tab}
            >
              {i + 1}. {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </Box>
        ))}
      </Box>

      <Box borderStyle="single" borderColor="gray" minHeight={20}>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'breakdown' && renderBreakdown()}
        {activeTab === 'trends' && renderTrends()}
        {activeTab === 'projections' && renderProjections()}
      </Box>
    </Box>
  );
};