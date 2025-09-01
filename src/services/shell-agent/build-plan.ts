// src/services/shell-agent/build-plan.ts
import * as _z from "zod";
import {
  NLRequestZ,
  type NLRequest,
  _ShellIntentZ,
  type ShellIntent,
  ShellPlanZ,
  type ShellPlan,
} from "./shell-plan";
import { extractPatterns } from "./shell-intent";

/**
 * Build execution plan from natural language request
 * Uses rule-based generation for common patterns, with LLM fallback
 */
export async function buildPlan(
  reqInput: unknown,
  intentInput?: ShellIntent,
): Promise<ShellPlan> {
  const req = NLRequestZ.parse(reqInput);
  const intent = intentInput ?? classifyIntent(req.text);

  // Step 1: Try rule-based generation (fast _path)
  const byRule = ruleBasedPlan(req, intent);
  if (byRule) return byRule;

  // Step 2: LLM generation (future implementation)
  // For Phase A, we'll fall back to safe defaults
  try {
    // TODO: Implement LLM plan generation in future phases
    // const _byLLM = await llmPlan(req, intent, req.cwd ?? process.cwd());
    // return byLLM;
    throw new Error("LLM planning not implemented yet");
  } catch (e) {
    // Step 3: Safe fallback
    return createFallbackPlan(req, intent);
  }
}

/**
 * Simple intent classification (moved from shell-intent for consistency)
 */
function classifyIntent(text: string): ShellIntent {
  const t = text.toLowerCase();

  if (
    /(list|show|read|display|view|表示|一覧|見る|open|cat|head|tail)/.test(t)
  ) {
    return "read";
  }
  if (/(find|grep|search|look|検索|探す|locate)/.test(t)) {
    return "search";
  }
  if (
    /(replace|rename|edit|change|modify|update|書き換え|置換|修正|変更|fix)/.test(
      t,
    )
  ) {
    return "edit";
  }

  return "read"; // Safe default
}

/**
 * Rule-based plan generation for common patterns
 * Handles typical development tasks without LLM overhead
 */
function ruleBasedPlan(
  req: NLRequest,
  intent: ShellIntent,
): ShellPlan | undefined {
  const safety = {
    readOnly: intent !== "edit",
    allowPaths: [
      "src/**",
      "README.md",
      "package.json",
      "tsconfig.json",
      "*.md",
    ],
    denyPaths: [".git/**", "node_modules/**", "~/**", "/**"],
    timeLimitMs: 10_000,
    sizeLimitBytes: 1_000_000,
  };

  const lower = req.text.toLowerCase();
  const patterns = extractPatterns(req.text);

  // Pattern 1: README file operations
  if (intent === "read" && /readme/i.test(lower)) {
    const plan: ShellPlan = {
      intent: "read",
      steps: [
        {
          op: "read",
          args: ["README.md"],
          previewLimit: 5000,
          comment: "preview README.md",
        },
      ],
      safety,
    };
    return ShellPlanZ.parse(plan);
  }

  // Pattern 2: Source file listing
  if (
    intent === "read" &&
    /src/.test(lower) &&
    /(ts|typescript|一覧|list|files)/i.test(lower)
  ) {
    const plan: ShellPlan = {
      intent: "read",
      steps: [
        {
          op: "read",
          args: ["src"],
          comment: "list TypeScript files in src directory",
        },
      ],
      safety,
    };
    return ShellPlanZ.parse(plan);
  }

  // Pattern 3: Package.json inspection
  if (intent === "read" && /package$2.?json/i.test(lower)) {
    const plan: ShellPlan = {
      intent: "read",
      steps: [
        {
          op: "read",
          args: ["package.json"],
          previewLimit: 3000,
          comment: "preview package.json",
        },
      ],
      safety,
    };
    return ShellPlanZ.parse(plan);
  }

  // Pattern 4: Search operations
  if (intent === "search") {
    const searchTerm =
      patterns.quotedStrings[0] || patterns.keywords[0] || "TODO"; // fallback

    const searchPath = patterns.filePaths[0] || "src";

    const plan: ShellPlan = {
      intent: "search",
      steps: [
        {
          op: "search",
          args: [searchTerm, searchPath],
          previewLimit: 5000,
          comment: `search for "${searchTerm}" in ${searchPath}`,
        },
      ],
      safety,
    };
    return ShellPlanZ.parse(plan);
  }

  // Pattern 5: File extension searches
  if (intent === "read" && /$2.(ts|js|md|json)/.test(lower)) {
    const ext = lower.match(/..(ts|js|md|json)/)?.[1] || "ts";
    const dir = lower.includes("src") ? "src" : ".";

    const plan: ShellPlan = {
      intent: "search",
      steps: [
        {
          op: "search",
          args: [`..${ext}$`, dir],
          previewLimit: 3000,
          comment: `find .${ext} files in ${dir}`,
        },
      ],
      safety,
    };
    return ShellPlanZ.parse(plan);
  }

  return undefined; // No matching pattern
}

/**
 * Create safe fallback plan when all else fails
 */
function createFallbackPlan(_req: NLRequest, _intent: ShellIntent): ShellPlan {
  const plan: ShellPlan = {
    intent: "read",
    steps: [
      {
        op: "read",
        args: ["."],
        previewLimit: 3000,
        comment: "fallback: list current directory",
      },
    ],
    safety: {
      readOnly: true,
      allowPaths: [".", "README.md", "package.json"],
      denyPaths: [".git/**", "node_modules/**", "~/**", "/**"],
      timeLimitMs: 5_000,
      sizeLimitBytes: 500_000,
    },
  };

  return ShellPlanZ.parse(plan);
}
