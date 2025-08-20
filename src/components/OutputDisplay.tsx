import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import { outputController, CollapsedState } from '../services/output-controller.js';

export interface OutputDisplayProps {
  content: string;
  sessionId: string;
  processingTime?: number;
  autoCollapse?: boolean;
  showMetrics?: boolean;
}

export const OutputDisplay: React.FC<OutputDisplayProps> = ({
  content,
  sessionId,
  processingTime = 0,
  autoCollapse = true,
  showMetrics = true,
}) => {
  const [collapsedState, setCollapsedState] = useState<CollapsedState | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Determine if content should be collapsed
    const shouldCollapse = autoCollapse && outputController.shouldCollapse(content, processingTime);

    if (shouldCollapse) {
      const state = outputController.createCollapsedState(content, sessionId, processingTime);
      setCollapsedState(state);
      setIsExpanded(outputController.isExpanded(sessionId));
    } else {
      setCollapsedState(null);
      setIsExpanded(true);
    }
  }, [content, sessionId, processingTime, autoCollapse]);

  useEffect(() => {
    // Listen for expansion toggle events
    const handleToggle = ({
      sessionId: eventSessionId,
      isExpanded: expanded,
    }: {
      sessionId: string;
      isExpanded: boolean;
    }) => {
      if (eventSessionId === sessionId) {
        setIsExpanded(expanded);
      }
    };

    outputController.on('expansionToggled', handleToggle);
    return () => {
      outputController.off('expansionToggled', handleToggle);
    };
  }, [sessionId]);

  // const _handleToggleExpansion = useCallback(() => {
  //   const newState = outputController.toggleExpansion(sessionId);
  //   setIsExpanded(newState);
  // }, [sessionId]);

  // If content is not collapsed, show full content
  if (!collapsedState || isExpanded) {
    return (
      <Box flexDirection="column">
        {collapsedState && showMetrics && (
          <Box marginBottom={1}>
            <Text color="gray">
              {chalk.dim(
                `📄 Full content (${outputController.getFormattedSize(collapsedState.metrics)})`,
              )}
            </Text>
          </Box>
        )}
        <Box flexDirection="column">
          {content.split('\n').map((line, index) => (
            <Text key={index}>{line}</Text>
          ))}
        </Box>
        {collapsedState && (
          <Box marginTop={1}>
            <Text color="gray">{chalk.dim('🔽 Ctrl+R to collapse')}</Text>
          </Box>
        )}
      </Box>
    );
  }

  // Show collapsed view
  return (
    <Box flexDirection="column">
      {/* Header with metrics */}
      <Box marginBottom={1}>
        <Text>
          {chalk.green('✨')} AI応答が生成されました{' '}
          {chalk.dim(`(${outputController.getFormattedSize(collapsedState.metrics)})`)}
        </Text>
      </Box>

      {/* Processing time if significant */}
      {collapsedState.metrics.processingTime > 5000 && showMetrics && (
        <Box marginBottom={1}>
          <Text color="yellow">
            ⏱️ 処理時間:{' '}
            {outputController.getFormattedProcessingTime(collapsedState.metrics.processingTime)}
          </Text>
        </Box>
      )}

      {/* Preview content */}
      <Box flexDirection="column" marginBottom={1}>
        <Text color="gray">最初の{collapsedState.previewLines.length}行を表示:</Text>
        {collapsedState.previewLines.map((line, index) => (
          <Text key={index} color="dim">
            {chalk.gray('> ')} {line}
          </Text>
        ))}
        {collapsedState.metrics.lineCount > collapsedState.previewLines.length && (
          <Text color="gray">
            {chalk.dim(
              `... ${collapsedState.metrics.lineCount - collapsedState.previewLines.length} more lines`,
            )}
          </Text>
        )}
      </Box>

      {/* Controls */}
      <Box>
        <Text>
          {chalk.blue('📖 Ctrl+R')} で全体表示 {' | '}
          {chalk.red('🔄 Ctrl+C')} でキャンセル
        </Text>
      </Box>

      {/* Additional metrics for very large content */}
      {showMetrics &&
        (collapsedState.metrics.lineCount > 100 || collapsedState.metrics.charCount > 20000) && (
          <Box marginTop={1}>
            <Text color="yellow">
              ⚠️ 大きなコンテンツ:{' '}
              {collapsedState.metrics.tokens && `~${collapsedState.metrics.tokens} tokens`}
            </Text>
          </Box>
        )}
    </Box>
  );
};

export default OutputDisplay;
