/**
 * Command Recommendation Types
 * スラッシュコマンド推薦システムの型定義
 */

import { CommandCategory } from "../../lib/command-groups";

export interface CommandRecommendation {
  command: string;
  description: string;
  category: CommandCategory;
  aliases: string[];
  usage: string;
  examples: string[];
  matchScore: number;
  frequencyScore: number;
  combinedScore: number;
}

export interface IndexedCommand {
  name: string;
  normalizedName: string;
  aliases: string[];
  category: CommandCategory;
  description: string;
  usage: string;
  examples: string[];
  searchTokens: string[];
}

export interface SearchOptions {
  maxResults?: number;
  minMatchScore?: number;
  enablePartialMatch?: boolean;
  sortBy?: "alphabetical" | "relevance" | "usage";
}

export interface RecommendationEngineConfig {
  maxSuggestions: number;
  minInputLength: number;
  enableUsageTracking: boolean;
  enablePartialMatching: boolean;
  debounceDelay: number;
  cacheExpiry: number;
}

export interface UsageStats {
  commandName: string;
  count: number;
  lastUsed: Date;
  averageInterval: number;
}

export interface SearchResult {
  recommendations: CommandRecommendation[];
  totalMatches: number;
  searchTime: number;
}
