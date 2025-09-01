/**
 * Type definitions for enhanced model selector UI
 */

export interface Choice {
  id?: string;
  name: string;
  value: string;
  group: string;
  tags?: string[];
  description?: string;
}

export interface GroupState {
  name: string;
  expanded: boolean;
  itemCount: number;
  choices: Choice[];
}

export interface UsageRecord {
  modelId: string;
  count: number;
  lastUsedAt: number;
  firstUsedAt: number;
}

export interface SearchResult {
  choice: Choice;
  score: number;
  highlightedName: string;
}

export interface SelectorConfig {
  enableRightPanel: boolean;
  enableFavorites: boolean;
  enableUsageTracking: boolean;
  pageSize: number;
  debounceMs: number;
}

export type RenderItem =
  | { kind: "group"; group: string; folded: boolean; count: number }
  | {
      kind: "choice";
      group: string;
      index: number;
      choice: Choice;
      highlighted?: string;
    };

export interface SelectorState {
  search: string;
  cursorIndex: number;
  viewOffset: number;
  items: RenderItem[];
  groups: Map<string, Choice[]>;
  folded: Map<string, boolean>;
}
