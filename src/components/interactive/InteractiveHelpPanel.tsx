/**
 * Interactive Help Panel Component
 * インタラクティブヘルプパネル - /helpコマンド用UIコンポーネント
 */

import React, { useEffect, useState } from 'react';
import { Text, Box, useInput } from 'ink';
import {
  InteractiveHelpService,
  CommandInfo,
} from '../../services/interactive/InteractiveHelpService';
import { CommandListView } from './CommandListView';
import { SearchFilterBar } from './SearchFilterBar';

export interface InteractiveHelpPanelProps {
  onCommandSelected?: (command: CommandInfo) => void;
  onExit?: () => void;
  initialCategory?: string;
  enableVimMode?: boolean;
}

export interface HelpPanelState {
  isLoading: boolean;
  commands: CommandInfo[];
  filteredCommands: CommandInfo[];
  selectedIndex: number;
  currentCategory: string;
  categories: string[];
  searchQuery: string;
  showDetails: boolean;
  error?: string;
}

export const InteractiveHelpPanel: React.FC<InteractiveHelpPanelProps> = ({
  onCommandSelected,
  onExit,
  initialCategory = 'all',
  enableVimMode = false,
}) => {
  const [state, setState] = useState<HelpPanelState>({
    isLoading: true,
    commands: [],
    filteredCommands: [],
    selectedIndex: 0,
    currentCategory: initialCategory,
    categories: [],
    searchQuery: '',
    showDetails: false,
  });

  const [helpService] = useState(() => new InteractiveHelpService());

  // サービス初期化
  useEffect(() => {
    const initializeService = async () => {
      try {
        await helpService.initialize();

        const displayInfo = helpService.getDisplayInfo();
        setState((prev) => ({
          ...prev,
          isLoading: false,
          commands: displayInfo.commands,
          filteredCommands: displayInfo.commands,
          categories: displayInfo.categories,
          currentCategory: displayInfo.currentCategory,
        }));

        // サービス開始
        await helpService.start();
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    };

    initializeService();

    return () => {
      helpService.dispose();
    };
  }, [helpService]);

  // サービスイベントリスナー
  useEffect(() => {
    const handleSelectionChanged = (index: number) => {
      setState((prev) => ({ ...prev, selectedIndex: index }));
    };

    const handleCategoryChanged = (category: string) => {
      setState((prev) => ({ ...prev, currentCategory: category }));
    };

    const handleSearchUpdated = (query: string) => {
      setState((prev) => ({ ...prev, searchQuery: query }));
    };

    const handleCommandsFiltered = (commands: CommandInfo[]) => {
      setState((prev) => ({ ...prev, filteredCommands: commands }));
    };

    const handleCommandSelected = (command: CommandInfo) => {
      onCommandSelected?.(command);
    };

    const handleStopped = () => {
      onExit?.();
    };

    // イベントリスナー登録
    helpService.on('selectionChanged', handleSelectionChanged);
    helpService.on('categoryChanged', handleCategoryChanged);
    helpService.on('searchUpdated', handleSearchUpdated);
    helpService.on('commandsFiltered', handleCommandsFiltered);
    helpService.on('commandSelected', handleCommandSelected);
    helpService.on('stopped', handleStopped);

    return () => {
      // イベントリスナー削除
      helpService.off('selectionChanged', handleSelectionChanged);
      helpService.off('categoryChanged', handleCategoryChanged);
      helpService.off('searchUpdated', handleSearchUpdated);
      helpService.off('commandsFiltered', handleCommandsFiltered);
      helpService.off('commandSelected', handleCommandSelected);
      helpService.off('stopped', handleStopped);
    };
  }, [helpService, onCommandSelected, onExit]);

  // キーボード入力処理
  useInput((input, key) => {
    // 検索モード中の処理
    if (state.searchQuery !== '') {
      if (key.return) {
        // 検索実行
        helpService.updateSearch(state.searchQuery);
        return;
      }
      if (key.escape) {
        // 検索キャンセル
        helpService.updateSearch('');
        return;
      }
      if (key.backspace || key.delete) {
        // 文字削除
        const newQuery = state.searchQuery.slice(0, -1);
        helpService.updateSearch(newQuery);
        return;
      }
      // 通常文字入力
      if (input && input.length === 1) {
        const newQuery = state.searchQuery + input;
        helpService.updateSearch(newQuery);
        return;
      }
    }

    // 通常モード
    if (key.upArrow || (enableVimMode && input === 'k')) {
      helpService.handleNavigation({ type: 'up' });
    } else if (key.downArrow || (enableVimMode && input === 'j')) {
      helpService.handleNavigation({ type: 'down' });
    } else if (key.leftArrow || (enableVimMode && input === 'h')) {
      helpService.handleNavigation({ type: 'left' });
    } else if (key.rightArrow || (enableVimMode && input === 'l')) {
      helpService.handleNavigation({ type: 'right' });
    } else if (key.return) {
      helpService.handleNavigation({ type: 'select' });
    } else if (key.escape || (enableVimMode && input === 'q')) {
      helpService.handleNavigation({ type: 'exit' });
    } else if (input === '/') {
      helpService.handleNavigation({ type: 'search' });
    } else if (input === '?') {
      setState((prev) => ({ ...prev, showDetails: !prev.showDetails }));
    } else if (key.tab) {
      // 表示モード切替
      setState((prev) => ({ ...prev, showDetails: !prev.showDetails }));
    }
  });

  // ローディング表示
  if (state.isLoading) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" minHeight={10}>
        <Text color="blue">Initializing Interactive Help...</Text>
        <Text color="gray">Loading commands and setting up services...</Text>
      </Box>
    );
  }

  // エラー表示
  if (state.error) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" minHeight={10}>
        <Text color="red" bold>
          Error
        </Text>
        <Text color="red">{state.error}</Text>
        <Text color="gray">Press ESC to exit</Text>
      </Box>
    );
  }

  const selectedCommand = state.filteredCommands[state.selectedIndex];

  return (
    <Box flexDirection="column" width="100%" height={25}>
      {/* ヘッダー */}
      <Box borderStyle="round" borderColor="blue" paddingX={1} paddingY={0}>
        <Box flexGrow={1}>
          <Text color="blue" bold>
            🚀 MARIA Interactive Command Helper
          </Text>
        </Box>
        <Text color="gray">[ESC: Exit | /: Search | ?: Toggle Details]</Text>
      </Box>

      {/* カテゴリバー */}
      <Box marginTop={1}>
        <Text color="yellow">Categories: </Text>
        {state.categories.map((category, index) => (
          <Text
            key={category}
            color={category === state.currentCategory ? 'yellow' : 'gray'}
            bold={category === state.currentCategory}
          >
            {index > 0 ? ' ' : ''}[{category}]
          </Text>
        ))}
      </Box>

      {/* 検索バー */}
      {state.searchQuery && (
        <SearchFilterBar
          query={state.searchQuery}
          resultCount={state.filteredCommands.length}
          onQueryChange={(query) => helpService.updateSearch(query)}
          onClear={() => helpService.updateSearch('')}
        />
      )}

      {/* メインコンテンツ */}
      <Box flexGrow={1} marginTop={1}>
        <Box width="60%">
          <CommandListView
            commands={state.filteredCommands}
            selectedIndex={state.selectedIndex}
            showDetails={false}
            maxHeight={15}
            onCommandSelect={(command) => onCommandSelected?.(command)}
          />
        </Box>

        {/* コマンド詳細パネル */}
        {selectedCommand && state.showDetails && (
          <Box width="40%" marginLeft={2} paddingLeft={1} borderStyle="round" borderColor="gray">
            <Box flexDirection="column">
              <Text color="green" bold>
                /{selectedCommand.name}
              </Text>
              <Text color="white" wrap="wrap">
                {selectedCommand.description}
              </Text>

              <Box marginTop={1}>
                <Text color="yellow">Usage: </Text>
                <Text color="gray">{selectedCommand.usage}</Text>
              </Box>

              {selectedCommand.examples && selectedCommand.examples.length > 0 && (
                <Box marginTop={1}>
                  <Text color="yellow">Examples:</Text>
                  <Box flexDirection="column" marginLeft={2}>
                    {selectedCommand.examples.slice(0, 3).map((example, index) => (
                      <Text key={index} color="cyan">
                        {example}
                      </Text>
                    ))}
                  </Box>
                </Box>
              )}

              <Box marginTop={1}>
                <Text color="yellow">Category: </Text>
                <Text color="magenta">{selectedCommand.category}</Text>
              </Box>

              <Box marginTop={1}>
                <Text color="yellow">Frequency: </Text>
                <Text color="green">
                  {'█'.repeat(Math.min(10, Math.floor(selectedCommand.frequency / 10)))}
                  {'░'.repeat(10 - Math.min(10, Math.floor(selectedCommand.frequency / 10)))}
                </Text>
                <Text color="gray"> ({selectedCommand.frequency})</Text>
              </Box>

              {selectedCommand.aliases && selectedCommand.aliases.length > 0 && (
                <Box marginTop={1}>
                  <Text color="yellow">Aliases: </Text>
                  <Text color="cyan">{selectedCommand.aliases.join(', ')}</Text>
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Box>

      {/* フッター */}
      <Box borderStyle="round" borderColor="gray" paddingX={1} marginTop={1}>
        <Text color="gray">
          Commands: {state.filteredCommands.length} | Selected: {selectedCommand?.name || 'None'} |
          Mode: {state.showDetails ? 'Detailed' : 'List'}
        </Text>
      </Box>

      {/* 簡易選択インジケータ */}
      {!state.showDetails && selectedCommand && (
        <Box borderStyle="single" borderColor="green" paddingX={1} marginTop={1}>
          <Box flexDirection="column">
            <Text color="green" bold>
              /{selectedCommand.name} - {selectedCommand.description}
            </Text>
            <Text color="gray">Usage: {selectedCommand.usage}</Text>
            {selectedCommand.examples && selectedCommand.examples[0] && (
              <Text color="cyan">Example: {selectedCommand.examples[0]}</Text>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default InteractiveHelpPanel;
