/**
 * Command List View Component
 * コマンド一覧表示コンポーネント - スクロール対応リスト
 */

import React, { useMemo } from 'react';
import { Text, Box } from 'ink';
import { CommandInfo } from '../../services/interactive/CommandSearchEngine';

export interface CommandListViewProps {
  commands: CommandInfo[];
  selectedIndex: number;
  showDetails?: boolean;
  maxHeight?: number;
  showLineNumbers?: boolean;
  showFrequencyBar?: boolean;
  showCategory?: boolean;
  compactMode?: boolean;
  onCommandSelect?: (command: CommandInfo) => void;
}

export const CommandListView: React.FC<CommandListViewProps> = ({
  commands,
  selectedIndex,
  showDetails = false,
  maxHeight = 10,
  showLineNumbers = false,
  showFrequencyBar = true,
  showCategory = false,
  compactMode = false,
}) => {
  // スクロール計算
  const scrollState = useMemo(() => {
    const visibleCount = Math.min(maxHeight, commands.length);
    let scrollTop = 0;

    // 選択位置がビューの範囲外の場合、スクロール位置を調整
    if (selectedIndex < scrollTop) {
      scrollTop = selectedIndex;
    } else if (selectedIndex >= scrollTop + visibleCount) {
      scrollTop = selectedIndex - visibleCount + 1;
    }

    // スクロール位置を有効範囲内に調整
    scrollTop = Math.max(0, Math.min(scrollTop, commands.length - visibleCount));

    return {
      top: scrollTop,
      visible: visibleCount,
      total: commands.length,
    };
  }, [commands.length, selectedIndex, maxHeight]);

  // 表示するコマンドを抽出
  const visibleCommands = useMemo(() => {
    return commands.slice(scrollState.top, scrollState.top + scrollState.visible);
  }, [commands, scrollState]);

  // 使用頻度バーを生成
  const renderFrequencyBar = (frequency: number): string => {
    const maxBars = 5;
    const normalizedFreq = Math.min(maxBars, Math.floor(frequency / 20));
    return '█'.repeat(normalizedFreq) + '░'.repeat(maxBars - normalizedFreq);
  };

  // カテゴリバッジを生成
  const renderCategoryBadge = (category: string): string => {
    const badges: Record<string, string> = {
      development: 'DEV',
      project: 'PRJ',
      media: 'MED',
      configuration: 'CFG',
      conversation: 'CNV',
      information: 'INF',
      all: 'ALL',
    };
    return badges[category] || category.substring(0, 3).toUpperCase();
  };

  // 行番号を生成
  const renderLineNumber = (index: number): string => {
    return `${(scrollState.top + index + 1).toString().padStart(2, ' ')}.`;
  };

  // コマンド名を短縮
  const truncateText = (text: string, maxLength: number): string => {
    return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
  };

  // 空のリスト表示
  if (commands.length === 0) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" minHeight={5}>
        <Text color="gray">No commands found</Text>
        <Text color="gray">Try adjusting your search or filter</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width="100%">
      {/* リストヘッダー（オプション） */}
      {!compactMode && (
        <Box borderStyle="single" borderColor="gray" paddingX={1} marginBottom={1}>
          <Text color="blue" bold>
            Commands ({commands.length})
          </Text>
          {scrollState.total > scrollState.visible && (
            <Box>
              <Text color="gray">
                {scrollState.top + 1}-{scrollState.top + scrollState.visible} of {scrollState.total}
              </Text>
            </Box>
          )}
        </Box>
      )}

      {/* コマンドリスト */}
      <Box flexDirection="column">
        {visibleCommands.map((command, index) => {
          const absoluteIndex = scrollState.top + index;
          const isSelected = absoluteIndex === selectedIndex;

          return (
            <Box key={command.name} marginBottom={compactMode ? 0 : 0}>
              {/* 選択インジケータ */}
              <Text color={isSelected ? 'yellow' : 'gray'}>{isSelected ? '>' : ' '}</Text>

              {/* 行番号 */}
              {showLineNumbers && <Text color="gray">{renderLineNumber(index)}</Text>}

              {/* コマンド名 */}
              <Text color={isSelected ? 'green' : 'white'} bold={isSelected}>
                /{truncateText(command.name, compactMode ? 8 : 10).padEnd(compactMode ? 10 : 12)}
              </Text>

              {/* 説明 */}
              <Text color={isSelected ? 'white' : 'gray'}>
                {' ' +
                  truncateText(command.description, compactMode ? 23 : 33).padEnd(
                    compactMode ? 25 : 35,
                  )}
              </Text>

              {/* カテゴリバッジ */}
              {showCategory && (
                <Text color="magenta">{' [' + renderCategoryBadge(command.category) + ']'}</Text>
              )}

              {/* 使用頻度バー */}
              {showFrequencyBar && (
                <Text color={isSelected ? 'green' : 'blue'}>
                  {' ' + renderFrequencyBar(command.frequency)}
                </Text>
              )}

              {/* エイリアス表示（詳細モード） */}
              {showDetails && command.aliases && command.aliases.length > 0 && (
                <Text color="cyan">{' (' + command.aliases.join(', ') + ')'}</Text>
              )}
            </Box>
          );
        })}
      </Box>

      {/* スクロールインジケータ */}
      {scrollState.total > scrollState.visible && !compactMode && (
        <Box marginTop={1} alignItems="center" justifyContent="center">
          <Text color="gray">
            {scrollState.top > 0 && '↑ '}
            Page {Math.floor(scrollState.top / scrollState.visible) + 1} of{' '}
            {Math.ceil(scrollState.total / scrollState.visible)}
            {scrollState.top + scrollState.visible < scrollState.total && ' ↓'}
          </Text>
        </Box>
      )}

      {/* 現在選択中のコマンドの詳細（コンパクトモード時） */}
      {compactMode && selectedIndex < commands.length && commands[selectedIndex] && (
        <Box borderStyle="round" borderColor="green" paddingX={1} marginTop={1}>
          <Box flexDirection="column">
            <Text color="green" bold>
              /{commands[selectedIndex]?.name || 'Unknown'}
            </Text>
            <Text color="white" wrap="wrap">
              {commands[selectedIndex]?.description || 'No description'}
            </Text>
            {commands[selectedIndex]?.examples && commands[selectedIndex]?.examples?.[0] && (
              <Text color="cyan">Example: {commands[selectedIndex]?.examples?.[0]}</Text>
            )}
          </Box>
        </Box>
      )}

      {/* キーボードヒント */}
      {!compactMode && (
        <Box marginTop={1}>
          <Text color="gray">↑↓: Navigate | Enter: Select | /: Search | Tab: Toggle Details</Text>
        </Box>
      )}
    </Box>
  );
};

export default CommandListView;
