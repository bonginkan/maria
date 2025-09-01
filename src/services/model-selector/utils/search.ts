/**
 * Search utilities for model selector
 */

import { Choice, SearchResult } from "../types";

/**
 * Normalize text for searching
 */
export function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}

/**
 * Calculate search score for a choice
 */
export function calculateSearchScore(choice: Choice, query: string): number {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return 0;

  const name = normalizeText(choice.name);
  const value = normalizeText(choice.value);
  const group = normalizeText(choice.group);
  const tags = (choice.tags || []).map((t) => normalizeText(t));
  const description = normalizeText(choice.description || "");

  let score = 0;

  // Exact matches get highest score
  if (value === normalizedQuery) score += 1000;
  if (name === normalizedQuery) score += 800;

  // Prefix matches
  if (name.startsWith(normalizedQuery)) score += 500;
  if (value.startsWith(normalizedQuery)) score += 400;
  if (group.startsWith(normalizedQuery)) score += 200;

  // Contains matches
  if (name.includes(normalizedQuery)) score += 100;
  if (value.includes(normalizedQuery)) score += 80;
  if (group.includes(normalizedQuery)) score += 50;
  if (description.includes(normalizedQuery)) score += 30;

  // Tag matches
  for (const tag of tags) {
    if (tag === normalizedQuery) score += 300;
    if (tag.startsWith(normalizedQuery)) score += 150;
    if (tag.includes(normalizedQuery)) score += 75;
  }

  // Multi-word query support (all words must match somewhere)
  const queryWords = normalizedQuery.split(/\s+/).filter((w) => w.length > 0);
  if (queryWords.length > 1) {
    const searchableText = [name, value, group, description, ...tags].join(" ");
    const allWordsMatch = queryWords.every((word) =>
      searchableText.includes(word),
    );
    if (allWordsMatch) {
      score += 200; // Bonus for multi-word matches
    } else {
      score = 0; // All words must match for multi-word queries
    }
  }

  return score;
}

/**
 * Highlight matching parts in text
 */
export function highlightMatches(text: string, query: string): string {
  if (!query || !text) return text;

  const normalizedQuery = normalizeText(query);
  const queryWords = normalizedQuery.split(/\s+/).filter((w) => w.length > 1);

  let result = text;

  // Highlight each query word
  for (const word of queryWords) {
    const regex = new RegExp(`(${escapeRegex(word)})`, "gi");
    result = result.replace(regex, "\x1b[93m$1\x1b[0m"); // Bright yellow highlight
  }

  return result;
}

/**
 * Escape special regex characters
 */
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Filter and sort choices by search query
 */
export function filterChoices(
  choices: Choice[],
  query: string,
): SearchResult[] {
  if (!query.trim()) {
    return choices.map((choice) => ({
      choice,
      score: 0,
      highlightedName: choice.name,
    }));
  }

  const results: SearchResult[] = [];

  for (const choice of choices) {
    const score = calculateSearchScore(choice, query);
    if (score > 0) {
      results.push({
        choice,
        score,
        highlightedName: highlightMatches(choice.name, query),
      });
    }
  }

  // Sort by score (highest first)
  results.sort((a, b) => b.score - a.score);

  return results;
}

/**
 * Apply usage and favorite boosting to search results
 */
export function boostResults(
  results: SearchResult[],
  getUsageScore: (id: string) => number,
  isFavorite: (id: string) => boolean,
): SearchResult[] {
  return results
    .map((result) => {
      const id = result.choice.id || result.choice.value;
      let boostedScore = result.score;

      // Boost favorites
      if (isFavorite(id)) {
        boostedScore += 2000; // Strong boost for favorites
      }

      // Boost recent/frequent usage
      const usageScore = getUsageScore(id);
      boostedScore += Math.min(1000, usageScore / 10); // Scale down usage score

      return {
        ...result,
        score: boostedScore,
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Check if text is printable (for key filtering)
 */
export function isPrintable(text: string): boolean {
  return /^[\x20-\x7E]+$/.test(text);
}
