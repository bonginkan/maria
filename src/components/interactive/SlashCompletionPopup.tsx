/**
 * Slash Completion Popup Component
 * スラッシュコマンド補完ポップアップ - Shiftキー循環対応
 */

import React, { useState, useEffect } from 'react';
import { Text, Box, useInput } from 'ink';
import {
  CompletionSuggestion,
  SlashCompletionService,
} from '../../services/interactive/SlashCompletionService';
import { CommandInfo } from '../../services/interactive/CommandSearchEngine';

export interface SlashCompletionPopupProps {
  query: string;
  isActive: boolean;
  onCommandSelected?: (command: CommandInfo) => void;
  onQueryChange?: (query: string) => void;
  onClose?: () => void;
  maxSuggestions?: number;
  enableShiftCycling?: boolean;
  showShortcuts?: boolean;
  compactMode?: boolean;
}

export interface CompletionPopupState {
  suggestions: CompletionSuggestion[];
  selectedIndex: number;
  isLoading: boolean;
  error?: string;
  isShiftCycling: boolean;
  cycleCount: number;
}

export const SlashCompletionPopup: React.FC<SlashCompletionPopupProps> = ({
  query,
  isActive,
  onCommandSelected,
  onQueryChange,
  onClose,
  maxSuggestions = 7,
  enableShiftCycling = true,
  showShortcuts = true,
  compactMode = false,
}) => {
  const [state, setState] = useState<CompletionPopupState>({
    suggestions: [],
    selectedIndex: 0,
    isLoading: false,
    error: undefined,
    isShiftCycling: false,
    cycleCount: 0,
  });

  const [completionService] = useState(
    () =>
      new SlashCompletionService({
        maxSuggestions,
        enableFuzzy: true,
        enableFrequencyBoost: true,
        enableContextAware: true,
      }),
  );

  // サービス初期化
  useEffect(() => {
    const initializeService = async () => {
      try {
        setState((prev) => ({ ...prev, isLoading: true }));

        // サンプルコマンドでサービス初期化
        const sampleCommands = await loadSampleCommands();
        await completionService.initialize(sampleCommands);

        setState((prev) => ({ ...prev, isLoading: false }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to initialize',
        }));
      }
    };

    initializeService();

    return () => {
      completionService.dispose();
    };
  }, [completionService, maxSuggestions]);

  // クエリ変更の処理
  useEffect(() => {
    if (!isActive || !query.trim()) {
      setState((prev) => ({ ...prev, suggestions: [], selectedIndex: 0 }));
      return;
    }

    completionService.startCompletion(query);
  }, [query, isActive, completionService]);

  // サービスイベントリスナー
  useEffect(() => {
    const handleSuggestionsUpdated = (suggestions: CompletionSuggestion[]) => {
      setState((prev) => ({
        ...prev,
        suggestions,
        selectedIndex: Math.min(prev.selectedIndex, suggestions.length - 1),
      }));
    };

    const handleSelectionChanged = (index: number) => {
      setState((prev) => ({ ...prev, selectedIndex: index }));
    };

    const handleShiftCycled = (_cycleIndex: number) => {
      setState((prev) => ({
        ...prev,
        isShiftCycling: true,
        cycleCount: prev.cycleCount + 1,
      }));
    };

    const handleCommandSelected = (command: CommandInfo) => {
      onCommandSelected?.(command);
      onClose?.();
    };

    // イベントリスナー登録
    completionService.on('suggestionsUpdated', handleSuggestionsUpdated);
    completionService.on('selectionChanged', handleSelectionChanged);
    completionService.on('shiftCycled', handleShiftCycled);
    completionService.on('commandSelected', handleCommandSelected);

    return () => {
      // イベントリスナー削除
      completionService.off('suggestionsUpdated', handleSuggestionsUpdated);
      completionService.off('selectionChanged', handleSelectionChanged);
      completionService.off('shiftCycled', handleShiftCycled);
      completionService.off('commandSelected', handleCommandSelected);
    };
  }, [completionService, onCommandSelected, onClose]);

  // キーボード入力処理
  useInput((_input, key) => {
    if (!isActive) return;

    if (key.upArrow) {
      completionService.selectPrevious();
    } else if (key.downArrow) {
      completionService.selectNext();
    } else if (key.return) {
      const selected = completionService.executeSelected();
      if (selected) {
        onCommandSelected?.(selected.command);
        onClose?.();
      }
    } else if (key.escape) {
      onClose?.();
    } else if (key.tab) {
      const completion = completionService.autoComplete();
      if (completion) {
        onQueryChange?.(completion);
      }
    } else if (key.shift && enableShiftCycling) {
      completionService.cycleWithShift();
    }
  });

  // 表示しない条件
  if (!isActive || state.isLoading) {
    return null;
  }

  // エラー表示
  if (state.error) {
    return (
      <Box borderStyle="round" borderColor="red" paddingX={1} paddingY={0}>
        <Text color="red">❌ Completion Error: {state.error}</Text>
      </Box>
    );
  }

  // 候補なしの場合
  if (state.suggestions.length === 0) {
    if (query.trim()) {
      return (
        <Box borderStyle="round" borderColor="gray" paddingX={1} paddingY={0}>
          <Text color="gray">No matches found for "/{query}"</Text>
          {showShortcuts && (
            <Box marginTop={1}>
              <Text color="gray">Press Esc to cancel</Text>
            </Box>
          )}
        </Box>
      );
    }
    return null;
  }

  // 理由別アイコン
  const getReasonIcon = (reason: CompletionSuggestion['reason']): string => {
    const icons = {
      exact: '🎯',
      prefix: '🔤',
      fuzzy: '🔍',
      frequent: '⭐',
      recent: '🕒',
    };
    return icons[reason] || '📝';
  };

  // スコア表示
  const renderScore = (suggestion: CompletionSuggestion): string => {
    if (compactMode) return '';
    const score = Math.round(suggestion.score);
    return `(${score})`;
  };

  // Shiftサイクリング状態表示
  const renderShiftCyclingStatus = (): React.ReactNode => {
    if (!state.isShiftCycling || !enableShiftCycling) return null;

    return (
      <Box marginBottom={1}>
        <Text color="yellow">
          🔄 Shift Cycling: {state.cycleCount} cycles | Current: {state.selectedIndex + 1}/
          {state.suggestions.length}
        </Text>
      </Box>
    );
  };

  return (
    <Box flexDirection="column">
      {/* Shiftサイクリング状態 */}
      {renderShiftCyclingStatus()}

      {/* メインポップアップ */}
      <Box
        borderStyle="round"
        borderColor="blue"
        paddingX={1}
        paddingY={0}
        minHeight={Math.min(state.suggestions.length + 3, 10)}
      >
        {/* ヘッダー */}
        <Box marginBottom={1}>
          <Text color="blue" bold>
            💡 Completions for "/{query}"
          </Text>
          <Box>
            <Text color="gray">
              [{state.selectedIndex + 1}/{state.suggestions.length}]
            </Text>
          </Box>
        </Box>

        {/* 候補リスト */}
        <Box flexDirection="column">
          {state.suggestions.slice(0, maxSuggestions).map((suggestion, index) => {
            const isSelected = index === state.selectedIndex;
            const icon = getReasonIcon(suggestion.reason);
            const scoreText = renderScore(suggestion);

            return (
              <Box key={suggestion.command.name} marginBottom={compactMode ? 0 : 0}>
                {/* 選択インジケータ */}
                <Text color={isSelected ? 'yellow' : 'gray'}>{isSelected ? '>' : ' '}</Text>

                {/* 理由アイコン */}
                <Text>{icon + ' '}</Text>

                {/* コマンド名 */}
                <Text color={isSelected ? 'green' : 'white'} bold={isSelected}>
                  /{suggestion.command.name.padEnd(compactMode ? 12 : 15)}
                </Text>

                {/* 説明 */}
                <Text color={isSelected ? 'white' : 'gray'}>
                  {' ' +
                    suggestion.command.description
                      .substring(0, compactMode ? 18 : 28)
                      .padEnd(compactMode ? 20 : 30)}
                </Text>

                {/* スコア表示 */}
                {!compactMode && scoreText && <Text color="blue">{' ' + scoreText}</Text>}

                {/* マッチタイプ */}
                {!compactMode && <Text color="magenta">{' [' + suggestion.reason + ']'}</Text>}
              </Box>
            );
          })}
        </Box>

        {/* 選択中のコマンド詳細 */}
        {(() => {
          const selectedSuggestion = state.suggestions[state.selectedIndex];
          if (!compactMode && selectedSuggestion) {
            return (
              <Box borderStyle="single" borderColor="green" paddingX={1} marginTop={1}>
                <Box flexDirection="column">
                  <Text color="green" bold>
                    /{selectedSuggestion.command.name}
                  </Text>
                  <Text color="white" wrap="wrap">
                    {selectedSuggestion.command.description}
                  </Text>
                  <Text color="gray">Usage: {selectedSuggestion.command.usage}</Text>
                </Box>
              </Box>
            );
          }
          return null;
        })()}

        {/* フッター - キーボードショートカット */}
        {showShortcuts && (
          <Box marginTop={1}>
            <Text color="gray">
              {enableShiftCycling && 'Shift: Cycle | '}
              ↑↓: Navigate | Enter: Select | Tab: Auto-complete | Esc: Cancel
            </Text>
          </Box>
        )}
      </Box>

      {/* 統計情報（デバッグ用） */}
      {process.env['NODE_ENV'] === 'development' && !compactMode && (
        <Box marginTop={1}>
          <Text color="blue" dimColor>
            Debug: Query="{query}" | Results={state.suggestions.length} | Selected=
            {state.selectedIndex} | Cycling={state.isShiftCycling ? 'Yes' : 'No'}
          </Text>
        </Box>
      )}
    </Box>
  );
};

/**
 * サンプルコマンドを読み込み
 */
async function loadSampleCommands(): Promise<CommandInfo[]> {
  return [
    {
      name: 'code',
      description: 'Generate code with AI assistance',
      usage: '/code "description" [--file=path] [--template=name]',
      category: 'development',
      examples: ['/code "create REST API"', '/code "add validation"'],
      frequency: 95,
      aliases: ['c'],
    },
    {
      name: 'test',
      description: 'Generate and run tests',
      usage: '/test [file]',
      category: 'development',
      examples: ['/test', '/test src/auth.ts'],
      frequency: 80,
      aliases: ['t'],
    },
    {
      name: 'review',
      description: 'Review code for improvements',
      usage: '/review [file|pr]',
      category: 'development',
      examples: ['/review', '/review --pr=123'],
      frequency: 70,
      aliases: ['r'],
    },
    {
      name: 'commit',
      description: 'Generate commit messages',
      usage: '/commit [--stage]',
      category: 'development',
      examples: ['/commit', '/commit --stage'],
      frequency: 65,
      aliases: ['cm'],
    },
    {
      name: 'config',
      description: 'Manage configuration settings',
      usage: '/config [get|set|list]',
      category: 'configuration',
      examples: ['/config list', '/config set theme dark'],
      frequency: 35,
      aliases: ['cfg'],
    },
    {
      name: 'clear',
      description: 'Clear conversation context',
      usage: '/clear',
      category: 'conversation',
      examples: ['/clear'],
      frequency: 55,
      aliases: ['cl'],
    },
    {
      name: 'help',
      description: 'Show interactive help',
      usage: '/help [topic]',
      category: 'information',
      examples: ['/help', '/help code'],
      frequency: 60,
      aliases: ['h', '?'],
    },
    {
      name: 'image',
      description: 'Generate images with AI',
      usage: '/image "description"',
      category: 'media',
      examples: ['/image "sunset over mountains"'],
      frequency: 30,
      aliases: ['img'],
    },
    {
      name: 'video',
      description: 'Create videos with AI',
      usage: '/video "description"',
      category: 'media',
      examples: ['/video "product demo"'],
      frequency: 20,
      aliases: ['vid'],
    },
  ];
}

export default SlashCompletionPopup;
