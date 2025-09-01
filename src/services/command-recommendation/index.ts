/**
 * Command Recommendation System
 * エクスポート用インデックス
 */

export { CommandRecommendationEngine } from "./CommandRecommendationEngine";
export { CommandIndexer } from "./CommandIndexer";
export type {
  CommandRecommendation,
  IndexedCommand,
  SearchOptions,
  RecommendationEngineConfig,
  UsageStats,
  SearchResult,
} from "./types";

// 便利なファクトリー関数
export const _createRecommendationEngine = (
  config?: Partial<import("./types").RecommendationEngineConfig>,
) => {
  return CommandRecommendationEngine.getInstance(config);
};
