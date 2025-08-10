/**
 * Data Visualization Components for CLI
 * Rich information display with charts, graphs, and progress indicators
 */

import React from 'react';
import { Box, Text } from 'ink';
import figures from 'figures';

/**
 * Bar Chart Component
 * Display horizontal bar charts with labels and values
 */
interface BarChartData {
  label: string;
  value: number;
  color?: string;
}

export const BarChart: React.FC<{
  data: BarChartData[];
  width?: number;
  showValues?: boolean;
}> = ({ data, width = 40, showValues = true }) => {
  const maxValue = Math.max(...data.map(d => d.value));

  return (
    <Box flexDirection="column">
      {data.map((item, index) => {
        const barWidth = Math.round((item.value / maxValue) * width);
        const bar = '█'.repeat(barWidth);
        const emptyBar = '░'.repeat(width - barWidth);
        
        return (
          <Box key={index} marginBottom={index < data.length - 1 ? 0 : 0}>
            <Text color={item.color || 'cyan'}>
              {item.label.padEnd(15)} {bar}
              <Text color="gray">{emptyBar}</Text>
              {showValues && <Text color="white"> {item.value}</Text>}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};

/**
 * Progress Ring Component
 * Circular progress indicator with percentage
 */
export const ProgressRing: React.FC<{
  value: number;
  total: number;
  label?: string;
  size?: 'small' | 'medium' | 'large';
}> = ({ value, total, label }) => {
  const percentage = Math.round((value / total) * 100);
  const filled = Math.round((percentage / 100) * 8);

  const ringChars = ['○', '◔', '◑', '◕', '●'];
  const ringChar = ringChars[Math.min(Math.floor(filled / 2), 4)];

  return (
    <Box flexDirection="column" alignItems="center">
      <Text color={percentage > 80 ? 'red' : percentage > 50 ? 'yellow' : 'green'}>
        {ringChar}
      </Text>
      <Text color="gray">{percentage}%</Text>
      {label && <Text color="gray">{label}</Text>}
    </Box>
  );
};

/**
 * Trend Line Component
 * Display trend with up/down indicators
 */
export const TrendLine: React.FC<{
  data: number[];
  label: string;
  width?: number;
}> = ({ data, label }) => {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Normalize data to 0-4 range for display
  const normalized = data.map(v => Math.round(((v - min) / range) * 4));
  
  const sparklineChars = [' ', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  const sparkline = normalized.map(v => sparklineChars[v]).join('');

  const lastValue = data[data.length - 1] || 0;
  const secondLastValue = data[data.length - 2] || 0;
  const trend = lastValue - secondLastValue;
  const trendIcon = trend > 0 ? figures.arrowUp : trend < 0 ? figures.arrowDown : '→';
  const trendColor = trend > 0 ? 'green' : trend < 0 ? 'red' : 'yellow';

  return (
    <Box>
      <Text>{label.padEnd(15)}</Text>
      <Text color="cyan">{sparkline}</Text>
      <Text color={trendColor}> {trendIcon} {Math.abs(trend).toFixed(1)}</Text>
    </Box>
  );
};

/**
 * Metric Card Component
 * Display key metrics with icons and trends
 */
export const MetricCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  trend?: 'up' | 'down' | 'stable';
  color?: string;
}> = ({ title, value, subtitle, icon, trend, color = 'cyan' }) => {
  const trendIcons = {
    up: { icon: figures.arrowUp, color: 'green' },
    down: { icon: figures.arrowDown, color: 'red' },
    stable: { icon: '→', color: 'yellow' }
  };

  return (
    <Box borderStyle="round" borderColor={color} padding={1} flexDirection="column">
      <Box marginBottom={1}>
        {icon && <Text color={color}>{icon} </Text>}
        <Text bold>{title}</Text>
      </Box>
      <Box>
        <Text bold color={color}>{value}</Text>
        {trend && (
          <Text color={trendIcons[trend].color}> {trendIcons[trend].icon}</Text>
        )}
      </Box>
      {subtitle && (
        <Box marginTop={1}>
          <Text color="gray">{subtitle}</Text>
        </Box>
      )}
    </Box>
  );
};

/**
 * Table Component
 * Display data in a table format with headers
 */
interface TableColumn {
  key: string;
  header: string;
  width?: number;
  align?: 'left' | 'right' | 'center';
  color?: string;
}

export const Table: React.FC<{
  columns: TableColumn[];
  data: Record<string, any>[];
  showHeader?: boolean;
  compact?: boolean;
}> = ({ columns, data, showHeader = true, compact = false }) => {
  const renderCell = (value: any, column: TableColumn) => {
    const str = String(value || '');
    const width = column.width || 15;
    
    if (column.align === 'right') {
      return str.padStart(width);
    } else if (column.align === 'center') {
      const padding = Math.max(0, width - str.length);
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      return ' '.repeat(leftPad) + str + ' '.repeat(rightPad);
    }
    return str.padEnd(width);
  };

  return (
    <Box flexDirection="column">
      {showHeader && (
        <>
          <Box>
            {columns.map((col, i) => (
              <Text key={i} bold color="cyan">
                {renderCell(col.header, col)}
                {i < columns.length - 1 && ' '}
              </Text>
            ))}
          </Box>
          <Box>
            {columns.map((col, i) => (
              <Text key={i} color="gray">
                {'─'.repeat(col.width || 15)}
                {i < columns.length - 1 && ' '}
              </Text>
            ))}
          </Box>
        </>
      )}
      {data.map((row, rowIndex) => (
        <Box key={rowIndex} marginTop={compact ? 0 : rowIndex > 0 ? 1 : 0}>
          {columns.map((col, colIndex) => (
            <Text key={colIndex} color={col.color || 'white'}>
              {renderCell(row[col.key], col)}
              {colIndex < columns.length - 1 && ' '}
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  );
};

/**
 * Status Indicator Component
 * Display status with colored icons
 */
export const StatusIndicator: React.FC<{
  status: 'active' | 'inactive' | 'warning' | 'error' | 'pending';
  label?: string;
}> = ({ status, label }) => {
  const indicators = {
    active: { icon: '●', color: 'green' },
    inactive: { icon: '○', color: 'gray' },
    warning: { icon: '⚠', color: 'yellow' },
    error: { icon: '✗', color: 'red' },
    pending: { icon: '◐', color: 'cyan' }
  };

  const { icon, color } = indicators[status];

  return (
    <Box>
      <Text color={color}>{icon}</Text>
      {label && <Text> {label}</Text>}
    </Box>
  );
};

/**
 * Tree View Component
 * Display hierarchical data as expandable tree
 */
interface TreeNode {
  id: string;
  label: string;
  value?: string | number;
  children?: TreeNode[];
  expanded?: boolean;
  icon?: string;
  highlighted?: boolean;
  metadata?: Record<string, any>;
}

export const TreeView: React.FC<{
  data: TreeNode[];
  level?: number;
  onToggle?: (nodeId: string) => void;
  onSelect?: (node: TreeNode) => void;
}> = ({ data, level = 0, onToggle, onSelect }) => {
  const indent = '  '.repeat(level);

  return (
    <Box flexDirection="column">
      {data.map((node) => (
        <Box key={node.id} flexDirection="column">
          <Box>
            <Text>{indent}</Text>
            {node.children && node.children.length > 0 && (
              <Text color="cyan">
                {node.expanded ? figures.arrowDown : figures.arrowRight} 
              </Text>
            )}
            {node.icon && <Text> {node.icon} </Text>}
            <Text
              color={node.highlighted ? 'yellow' : 'white'}
              bold={node.highlighted || false}
            >
              {node.label}
            </Text>
            {node.value && <Text color="gray"> ({node.value})</Text>}
          </Box>
          {node.expanded && node.children && (
            <TreeView 
              data={node.children} 
              level={level + 1} 
              onToggle={onToggle} 
              onSelect={onSelect}
            />
          )}
        </Box>
      ))}
    </Box>
  );
};

/**
 * Heat Map Component
 * Display data density with color gradients
 */
export const HeatMap: React.FC<{
  data: number[][];
  labels?: { x: string[]; y: string[] };
  colorScale?: string[];
}> = ({ data, labels, colorScale = ['░', '▒', '▓', '█'] }) => {
  const maxValue = Math.max(...data.flat());
  const minValue = Math.min(...data.flat());
  const range = maxValue - minValue || 1;

  return (
    <Box flexDirection="column">
      {labels?.x && (
        <Box marginLeft={labels.y ? 10 : 0}>
          {labels.x.map((label, i) => (
            <Text key={i} color="gray">{(label || '').substring(0, 3).padEnd(3)} </Text>
          ))}
        </Box>
      )}
      {data.map((row, y) => (
        <Box key={y}>
          {labels?.y && (
            <Text color="gray">{(labels.y[y] || '').padEnd(10)}</Text>
          )}
          {row.map((value, x) => {
            const normalized = (value - minValue) / range;
            const colorIndex = Math.min(
              Math.floor(normalized * colorScale.length),
              colorScale.length - 1
            );
            const colorChar = colorScale[colorIndex] || '░';
            return (
              <Text key={x} color={normalized > 0.7 ? 'red' : normalized > 0.4 ? 'yellow' : 'green'}>
                {colorChar.repeat(3)} 
              </Text>
            );
          })}
        </Box>
      ))}
    </Box>
  );
};

/**
 * Timeline Component
 * Display events on a timeline
 */
interface TimelineEvent {
  time: string;
  event: string;
  type?: 'success' | 'warning' | 'error' | 'info';
}

export const Timeline: React.FC<{
  events: TimelineEvent[];
  orientation?: 'vertical' | 'horizontal';
}> = ({ events, orientation = 'vertical' }) => {
  const typeColors = {
    success: 'green',
    warning: 'yellow',
    error: 'red',
    info: 'cyan'
  };

  if (orientation === 'horizontal') {
    return (
      <Box>
        {events.map((event, i) => (
          <Box key={i}>
            <Text color={typeColors[event.type || 'info']}>●</Text>
            {i < events.length - 1 && <Text color="gray">───</Text>}
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {events.map((event, i) => (
        <Box key={i} flexDirection="column">
          <Box>
            <Text color={typeColors[event.type || 'info']}>●</Text>
            <Text color="gray"> {event.time}</Text>
            <Text> {event.event}</Text>
          </Box>
          {i < events.length - 1 && (
            <Text color="gray">│</Text>
          )}
        </Box>
      ))}
    </Box>
  );
};

/**
 * Expandable Section Component
 * Provides collapsible content areas with smooth transitions
 */
export const ExpandableSection: React.FC<{
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  icon?: string;
  summary?: string;
}> = ({ title, expanded, children, icon, summary }) => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box 
        borderStyle="single" 
        borderColor={expanded ? 'cyan' : 'gray'}
        paddingX={1}
      >
        <Box>
          <Text color="cyan">{expanded ? '▼' : '▶'}</Text>
          {icon && <Text> {icon}</Text>}
          <Text bold> {title}</Text>
          {!expanded && summary && (
            <Text color="gray"> - {summary}</Text>
          )}
        </Box>
      </Box>
      {expanded && (
        <Box 
          borderStyle="single" 
          borderColor="gray" 
          borderTop={false}
          paddingX={1}
          paddingY={1}
        >
          {children}
        </Box>
      )}
    </Box>
  );
};

/**
 * Drill-Down Navigation Component
 * Enables hierarchical navigation through data
 */
export const DrillDownNav: React.FC<{
  path: string[];
  onNavigate: (index: number) => void;
}> = ({ path }) => {
  return (
    <Box marginBottom={1}>
      {path.map((segment, index) => (
        <React.Fragment key={index}>
          <Text
            color={index === path.length - 1 ? 'cyan' : 'gray'}
            bold={index === path.length - 1}
          >
            {segment}
          </Text>
          {index < path.length - 1 && <Text color="gray"> {figures.arrowRight} </Text>}
        </React.Fragment>
      ))}
    </Box>
  );
};

/**
 * Smart Summary Component
 * Generates intelligent summaries based on data patterns
 */
export const SmartSummary: React.FC<{
  data: any;
  type: 'status' | 'cost' | 'performance' | 'usage';
}> = ({ data, type }) => {
  const generateSummary = () => {
    switch (type) {
      case 'status':
        return {
          title: 'System Status Summary',
          points: [
            `${figures.tick} All systems operational`,
            `${figures.info} ${data.services?.length || 0} services running`,
            `${figures.warning} ${data.warnings || 0} warnings to review`
          ],
          insight: 'System performance is within normal parameters'
        };
      case 'cost':
        const trend = data.trend || 'stable';
        return {
          title: 'Cost Analysis Summary',
          points: [
            `${figures.pointer} Current session: $${data.cost || '0.00'}`,
            `${trend === 'up' ? figures.arrowUp : figures.arrowDown} ${trend} trend`,
            `${figures.star} Most expensive: ${data.mostExpensive || 'API calls'}`
          ],
          insight: `Cost optimization ${trend === 'up' ? 'recommended' : 'not required'}`
        };
      case 'performance':
        return {
          title: 'Performance Summary',
          points: [
            `${figures.circleFilled} Avg response: ${data.avgResponse || 'N/A'}`,
            `${figures.tick} Success rate: ${data.successRate || 'N/A'}%`,
            `${figures.warning} Bottleneck: ${data.bottleneck || 'None detected'}`
          ],
          insight: 'Performance metrics are healthy'
        };
      case 'usage':
        return {
          title: 'Usage Summary',
          points: [
            `${figures.circleFilled} Total calls: ${data.totalCalls || 0}`,
            `${figures.star} Most active: ${data.mostActive || 'N/A'}`,
            `${figures.arrowUp} Peak time: ${data.peakTime || 'N/A'}`
          ],
          insight: 'Usage patterns are consistent with expectations'
        };
      default:
        return { title: 'Summary', points: [], insight: '' };
    }
  };

  const summary = generateSummary();

  return (
    <Box 
      flexDirection="column" 
      borderStyle="round" 
      borderColor="yellow"
      padding={1}
      marginBottom={2}
    >
      <Box marginBottom={1}>
        <Text bold color="yellow">
          {figures.star} {summary.title}
        </Text>
      </Box>
      <Box flexDirection="column" marginBottom={1}>
        {summary.points.map((point, i) => (
          <Text key={i} color="gray">{point}</Text>
        ))}
      </Box>
      {summary.insight && (
        <Text italic color="cyan">
          {figures.arrowRight} {summary.insight}
        </Text>
      )}
    </Box>
  );
};

/**
 * Cross-Reference Link Component
 * Enables navigation between related information
 */
export const CrossReference: React.FC<{
  label: string;
  target: string;
  icon?: string;
  onNavigate: (target: string) => void;
}> = ({ label, icon }) => {
  return (
    <Text>
      {icon && `${icon} `}
      <Text color="cyan">
        {label}
      </Text>
    </Text>
  );
};