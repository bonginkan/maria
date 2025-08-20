/**
 * Search Filter Bar Component
 * 検索・フィルタバーコンポーネント - リアルタイム検索UI
 */

import React, { useState, useEffect } from 'react';
import { Text, Box } from 'ink';

export interface SearchFilterBarProps {
  query: string;
  resultCount: number;
  isActive?: boolean;
  placeholder?: string;
  showResultCount?: boolean;
  showClearButton?: boolean;
  enableHighlight?: boolean;
  onQueryChange?: (query: string) => void;
  onClear?: () => void;
  onActivate?: () => void;
  onDeactivate?: () => void;
}

export const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  query,
  resultCount,
  isActive = true,
  placeholder = 'Type to search commands...',
  showResultCount = true,
  showClearButton = true,
  enableHighlight = true,
  onQueryChange: _onQueryChange,
  onClear: _onClear,
  onActivate: _onActivate,
  onDeactivate: _onDeactivate,
}) => {
  const [_localQuery, _setLocalQuery] = useState(query);
  const [_isInputFocused, _setIsInputFocused] = useState(isActive);

  // 外部からのクエリ変更を反映
  useEffect(() => {
    _setLocalQuery(query);
  }, [query, _setLocalQuery]);

  // 検索状態に応じた表示スタイル
  const getSearchIcon = (): string => {
    if (query && resultCount > 0) return '🔍';
    if (query && resultCount === 0) return '❌';
    return '🔍';
  };

  const getStatusColor = (): string => {
    if (!query) return 'gray';
    if (resultCount > 0) return 'green';
    return 'red';
  };

  // 検索クエリのハイライト表示
  const renderHighlightedQuery = (text: string): React.ReactNode => {
    if (!enableHighlight || !text) {
      return <Text color="white">{text}</Text>;
    }

    // シンプルな実装：最初と最後の文字をハイライト
    if (text.length <= 2) {
      return <Text color="yellow">{text}</Text>;
    }

    return (
      <Text>
        <Text color="yellow">{text[0]}</Text>
        <Text color="white">{text.slice(1, -1)}</Text>
        <Text color="yellow">{text[text.length - 1]}</Text>
      </Text>
    );
  };

  // 結果カウント表示
  const renderResultCount = (): React.ReactNode => {
    if (!showResultCount) return null;

    let countText: string;
    let countColor: string;

    if (!query) {
      countText = 'Ready';
      countColor = 'gray';
    } else if (resultCount === 0) {
      countText = 'No results';
      countColor = 'red';
    } else if (resultCount === 1) {
      countText = '1 result';
      countColor = 'green';
    } else {
      countText = `${resultCount} results`;
      countColor = 'green';
    }

    return <Text color={countColor}>{' (' + countText + ')'}</Text>;
  };

  // クリアボタン表示
  const renderClearButton = (): React.ReactNode => {
    if (!showClearButton || !query) return null;

    return (
      <Text color="red" dimColor>
        {' [Ctrl+U: Clear]'}
      </Text>
    );
  };

  // 検索提案/ヒント表示
  const renderSearchHints = (): React.ReactNode => {
    if (query || !isActive) return null;

    const hints = [
      'Try: "code", "test", "image"',
      'Use "/" to start searching',
      'Arrow keys to navigate',
    ];

    return <Text color="gray">{' ' + hints[Math.floor(Date.now() / 3000) % hints.length]}</Text>;
  };

  // 高度な検索オプションのヒント
  const renderAdvancedHints = (): React.ReactNode => {
    if (!query || query.length < 2) return null;

    const advancedFeatures = [];

    // カテゴリ検索のヒント
    if (!query.includes(':')) {
      advancedFeatures.push('cat:dev for category filter');
    }

    // 頻度検索のヒント
    if (!query.includes('@')) {
      advancedFeatures.push('@recent for recent commands');
    }

    if (advancedFeatures.length === 0) return null;

    return (
      <Box marginTop={1}>
        <Text color="blue" dimColor>
          💡 Try: {advancedFeatures.slice(0, 2).join(' | ')}
        </Text>
      </Box>
    );
  };

  return (
    <Box flexDirection="column">
      {/* メイン検索バー */}
      <Box borderStyle="round" borderColor={getStatusColor()} paddingX={1}>
        {/* 検索アイコン */}
        <Text>{getSearchIcon()}</Text>

        {/* 検索入力表示 */}
        <Box flexGrow={1}>
          {query ? (
            <Box>
              <Text color="yellow">Search: </Text>
              {renderHighlightedQuery(query)}
            </Box>
          ) : (
            <Text color="gray" italic>
              {_isInputFocused ? 'Type to search...' : placeholder}
            </Text>
          )}
        </Box>

        {/* 結果カウント */}
        {renderResultCount()}

        {/* クリアボタン */}
        {renderClearButton()}
      </Box>

      {/* 検索統計/情報行 */}
      <Box marginTop={1}>
        {/* 検索ヒント */}
        {renderSearchHints()}

        {/* アクティブフィルタ表示 */}
        {query && (
          <Box marginLeft={2}>
            <Text color="blue">Active filters: </Text>
            <Text color="white" backgroundColor="blue">
              {' query: "' + query + '" '}
            </Text>
            {resultCount > 0 && <Text color="green">{' ✓ ' + resultCount + ' matches'}</Text>}
          </Box>
        )}
      </Box>

      {/* 高度な検索機能のヒント */}
      {renderAdvancedHints()}

      {/* 検索モードキーボードショートカット */}
      {isActive && (
        <Box marginTop={1}>
          <Text color="gray">
            Search Mode: Type to filter | Esc to exit | Enter to apply | Ctrl+U to clear
          </Text>
        </Box>
      )}

      {/* 検索結果が0件の場合の提案 */}
      {query && resultCount === 0 && (
        <Box marginTop={1} borderStyle="single" borderColor="yellow" paddingX={1}>
          <Text color="yellow">💡 No results found. Try:</Text>
          <Box flexDirection="column" marginLeft={2} marginTop={1}>
            <Text color="gray">• Check spelling: "{query}"</Text>
            <Text color="gray">• Try shorter search terms</Text>
            <Text color="gray">• Use command name instead of description</Text>
            <Text color="gray">• Try categories: "dev", "media", "config"</Text>
          </Box>
        </Box>
      )}

      {/* 検索パフォーマンス情報（デバッグ用） */}
      {process.env['NODE_ENV'] === 'development' && query && (
        <Box marginTop={1}>
          <Text color="gray">
            Debug: Query="{query}" | Results={resultCount} | Length={query.length}
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default SearchFilterBar;
