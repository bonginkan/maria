// src/services/shell-agent/shell-intent.ts
import { ShellIntent } from "./shell-plan";

/**
 * Simple intent classification for shell operations
 * Uses keyword matching for reliable classification
 */
export function classifyIntent(text: string): ShellIntent {
  const t = text.toLowerCase();

  // Read intent patterns
  if (
    /(list|show|read|display|view|表示|一覧|見る|open|cat|head|tail)/.test(t)
  ) {
    return "read";
  }

  // Search intent patterns
  if (/(find|grep|search|look|検索|探す|locate)/.test(t)) {
    return "search";
  }

  // Edit intent patterns
  if (
    /(replace|rename|edit|change|modify|update|書き換え|置換|修正|変更|fix)/.test(
      t,
    )
  ) {
    return "edit";
  }

  // Default to read for safety (most permissive)
  return "read";
}

/**
 * Extract common patterns from natural language text
 * Helps with parameter extraction
 */
export function extractPatterns(text: string): {
  quotedStrings: string[];
  filePaths: string[];
  keywords: string[];
} {
  // Extract quoted strings
  const quotedStrings = [...text.matchAll(/["""]([^"""]+)["""]/g)].map(
    (m) => m[1],
  );

  // Extract file path patterns
  const filePaths = [
    ...text.matchAll(/\b[a-zA-Z0-9_-]+(\.[a-zA-Z0-9]+)+\b/g),
  ].map((m) => m[0]);

  // Extract directory-like patterns
  const dirPaths = [
    ...text.matchAll(/\b[a-zA-Z0-9_-]+\/[a-zA-Z0-9_/.-]*/g),
  ].map((m) => m[0]);

  // Extract common keywords
  const keywords =
    text
      .toLowerCase()
      .match(
        /\b(src|dist|node_modules|package\.json|readme|tsconfig|\.ts|\.js|\.md)\b/g,
      ) || [];

  return {
    quotedStrings,
    filePaths: [...filePaths, ...dirPaths],
    keywords,
  };
}
