import React, { useEffect, useState } from 'react';
import { Box, Text, useStdout } from 'ink';
import { EnhancedStatusBar } from './EnhancedStatusBar';

interface FullscreenLayoutProps {
  children: React.ReactNode;
  showStatusBar?: boolean;
  title?: string;
  aiModel?: string;
  aiProvider?: string;
  userPlan?: string;
  credits?: number;
}

export const FullscreenLayout: React.FC<FullscreenLayoutProps> = ({
  children,
  showStatusBar = true,
  title = 'MARIA CODE',
  aiModel,
  aiProvider,
  userPlan,
  credits,
}) => {
  const { stdout } = useStdout();
  const [dimensions, setDimensions] = useState({
    width: stdout?.columns || 80,
    height: stdout?.rows || 24,
  });

  useEffect(() => {
    const handleResize = () => {
      if (stdout) {
        setDimensions({
          width: stdout.columns || 80,
          height: stdout.rows || 24,
        });
      }
    };

    // Listen for terminal resize
    if (stdout) {
      stdout.on('resize', handleResize);
      handleResize(); // Initial size
    }

    return () => {
      if (stdout) {
        stdout.off('resize', handleResize);
      }
    };
  }, [stdout]);

  // Calculate optimal widths (98% of terminal width)
  const contentWidth = Math.floor(dimensions.width * 0.98);
  const marginX = Math.floor((dimensions.width - contentWidth) / 2);

  return (
    <Box
      flexDirection="column"
      width={dimensions.width}
      minHeight={dimensions.height - 1}
      paddingX={Math.max(0, marginX)}
    >
      {/* Header Section */}
      <Box
        borderStyle="round"
        borderColor="cyan"
        paddingX={1}
        width={contentWidth}
        marginBottom={1}
      >
        <Box flexDirection="row" justifyContent="space-between">
          <Text color="cyan" bold>
            🚀 {title}
          </Text>
          <Text color="gray" dimColor>
            Terminal: {dimensions.width}×{dimensions.height}
          </Text>
        </Box>
      </Box>

      {/* Status Bar */}
      {showStatusBar && (
        <Box width={contentWidth} marginBottom={1}>
          <EnhancedStatusBar
            aiModel={aiModel}
            aiProvider={aiProvider}
            userPlan={userPlan}
            credits={credits}
          />
        </Box>
      )}

      {/* Main Content Area */}
      <Box
        flexDirection="column"
        flexGrow={1}
        width={contentWidth}
        minHeight={dimensions.height - (showStatusBar ? 8 : 5)}
      >
        {children}
      </Box>

      {/* Footer */}
      <Box
        borderTop
        borderColor="gray"
        paddingTop={0}
        paddingX={1}
        width={contentWidth}
        marginTop={1}
      >
        <Text color="gray" dimColor>
          💡 Tips: Use /help for commands • Ctrl+C to interrupt • Tab for autocomplete
        </Text>
      </Box>
    </Box>
  );
};

interface SplitLayoutProps {
  left: React.ReactNode;
  right: React.ReactNode;
  splitRatio?: number; // 0.0 to 1.0, default 0.5
  showDivider?: boolean;
}

export const SplitLayout: React.FC<SplitLayoutProps> = ({
  left,
  right,
  splitRatio = 0.5,
  showDivider = true,
}) => {
  const { stdout } = useStdout();
  const totalWidth = stdout?.columns || 80;

  const leftWidth = Math.floor(totalWidth * splitRatio) - 1;
  const rightWidth = totalWidth - leftWidth - (showDivider ? 1 : 0);

  return (
    <Box flexDirection="row" width={totalWidth}>
      {/* Left Panel */}
      <Box width={leftWidth} flexDirection="column">
        {left}
      </Box>

      {/* Divider */}
      {showDivider && <Box width={1} borderLeft borderColor="gray" marginX={0} />}

      {/* Right Panel */}
      <Box width={rightWidth} flexDirection="column">
        {right}
      </Box>
    </Box>
  );
};

interface ResponsiveBoxProps {
  children: React.ReactNode;
  minWidth?: number;
  maxWidth?: number;
  padding?: number;
  border?: boolean;
  borderColor?: string;
  borderStyle?: 'single' | 'double' | 'round' | 'bold';
  title?: string;
}

export const ResponsiveBox: React.FC<ResponsiveBoxProps> = ({
  children,
  minWidth = 20,
  maxWidth = 100,
  padding = 1,
  border = true,
  borderColor = 'cyan',
  borderStyle = 'round',
  title,
}) => {
  const { stdout } = useStdout();
  const availableWidth = (stdout?.columns || 80) - 4; // Account for margins

  const width = Math.min(maxWidth, Math.max(minWidth, availableWidth));

  const boxProps: unknown = {
    width,
    paddingX: padding,
    paddingY: padding > 0 ? Math.floor(padding / 2) : 0,
    flexDirection: 'column' as const,
  };

  if (border) {
    boxProps.borderStyle = borderStyle;
    boxProps.borderColor = borderColor;
  }

  return (
    <Box {...boxProps}>
      {title && (
        <Box marginBottom={1}>
          <Text color="cyan" bold>
            {title}
          </Text>
        </Box>
      )}
      {children}
    </Box>
  );
};

// Grid layout for organizing multiple components
interface GridLayoutProps {
  columns: number;
  gap?: number;
  children: React.ReactNode[];
}

export const GridLayout: React.FC<GridLayoutProps> = ({ columns, gap = 1, children }) => {
  const { stdout } = useStdout();
  const totalWidth = (stdout?.columns || 80) - 2;
  const columnWidth = Math.floor((totalWidth - gap * (columns - 1)) / columns);

  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < children.length; i += columns) {
    rows.push(children.slice(i, i + columns));
  }

  return (
    <Box flexDirection="column" gap={gap}>
      {rows.map((row, rowIndex) => (
        <Box key={rowIndex} flexDirection="row" gap={gap}>
          {row.map((child, colIndex) => (
            <Box key={colIndex} width={columnWidth}>
              {child}
            </Box>
          ))}
          {/* Fill empty columns */}
          {row.length < columns &&
            Array.from({ length: columns - row.length }).map((_, i) => (
              <Box key={`empty-${i}`} width={columnWidth} />
            ))}
        </Box>
      ))}
    </Box>
  );
};
