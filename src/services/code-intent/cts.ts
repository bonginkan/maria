/**
 * Code Task Spec (CTS) - 実行仕様の正規化と記録
 * 全ての/codeコマンド実行を追跡可能な仕様として保存
 */

import * as fs from "fs/promises";
import * as path from "path";
import { randomUUID } from "crypto";
import type {
  CodeIntent,
  GateReport,
  Patch,
  GrepSnippet,
} from "../code-quality/types";

export interface CodeTaskSpec {
  id: string; // UUID for unique identification
  timestamp: string; // ISO8601 timestamp
  author?: string; // User ID or terminal identifier
  intent: CodeIntent; // Detected intent

  inputs: {
    userText: string; // Original user input
    attachments?: {
      code?: string; // Pasted code snippet
      errors?: string; // Error logs/stack traces
      files?: string[]; // Target files specified
    };
  };

  constraints: {
    outputMode: "patch-only" | "single-file" | "multi-file" | "function-only";
    maxFiles: number; // Maximum files to modify
    maxLines: number; // Maximum lines to change
    securityLevel: "low" | "medium" | "high";
    allowedOperations?: string[]; // Specific operations allowed
  };

  contextDigest: {
    files: string[]; // Related file paths
    deps?: string[]; // Key dependencies from package.json
    rules?: string[]; // ESLint/Prettier rules in effect
    snippets?: GrepSnippet[]; // Code snippets from RepoRAG
    techStack?: {
      language: string;
      framework?: string;
      runtime?: string;
      testFramework?: string;
    };
  };

  modelPlan?: {
    selectedModel: string; // Actually used model
    selectionReason: string; // Why this model was chosen
    candidates?: string[]; // Other models considered
    estimatedCost?: number; // Estimated API cost
    estimatedTokens?: {
      input: number;
      output: number;
    };
  };

  result?: {
    success: boolean;
    executionTimeMs?: number;
    patches?: Patch[]; // Generated patches
    validationReport?: GateReport; // Validation results
    appliedFiles?: string[]; // Files actually modified
    rollbackId?: string; // ID for rollback if needed
    error?: {
      code: string;
      message: string;
      stack?: string;
    };
  };

  metadata?: {
    sessionId?: string; // Current session ID
    previousCtsId?: string; // Link to previous CTS
    tags?: string[]; // Custom tags for categorization
    feedback?: {
      accepted: boolean;
      userComment?: string;
      rating?: number;
    };
    [key: string]: any; // Extensible metadata
  };
}

/**
 * Create a new CTS with defaults
 */
export function createCTS(input: {
  intent: CodeIntent;
  userText: string;
  attachments?: CodeTaskSpec["inputs"]["attachments"];
  constraints?: Partial<CodeTaskSpec["constraints"]>;
  contextDigest?: Partial<CodeTaskSpec["contextDigest"]>;
  modelPlan?: Partial<CodeTaskSpec["modelPlan"]>;
  author?: string;
  metadata?: CodeTaskSpec["metadata"];
}): CodeTaskSpec {
  const now = new Date().toISOString();

  return {
    id: randomUUID(),
    timestamp: now,
    author: input.author || process.env.USER || "anonymous",
    intent: input.intent,

    inputs: {
      userText: input.userText,
      attachments: input.attachments,
    },

    constraints: {
      outputMode: "patch-only",
      maxFiles: 2,
      maxLines: 50,
      securityLevel: "medium",
      ...input.constraints,
    },

    contextDigest: {
      files: [],
      deps: [],
      rules: [],
      ...input.contextDigest,
    },

    modelPlan: input.modelPlan as any,
    metadata: input.metadata || {},
  };
}

/**
 * Save CTS to filesystem
 */
export async function saveCTS(
  cts: CodeTaskSpec,
  opts: { dir?: string; pretty?: boolean } = {},
): Promise<string> {
  const dir = opts.dir || path.join(process.cwd(), "reports", "cts");
  await fs.mkdir(dir, { recursive: true });

  // Generate filename with readable timestamp
  const dateStr = cts.timestamp.slice(0, 19).replace(/[:.]/g, "-");
  const shortId = cts.id.slice(0, 8);
  const filename = `cts_${dateStr}_${cts.intent}_${shortId}.json`;

  const filepath = path.join(dir, filename);
  const content = opts.pretty
    ? JSON.stringify(cts, null, 2)
    : JSON.stringify(cts);

  await fs.writeFile(filepath, content, "utf8");
  return filepath;
}

/**
 * Load CTS from file
 */
export async function loadCTS(filepath: string): Promise<CodeTaskSpec> {
  const content = await fs.readFile(filepath, "utf8");
  return JSON.parse(content) as CodeTaskSpec;
}

/**
 * Update CTS with results
 */
export async function updateCTSResult(
  ctsPath: string,
  result: CodeTaskSpec["result"],
): Promise<void> {
  const cts = await loadCTS(ctsPath);
  cts.result = result;

  // Overwrite with updated content
  await fs.writeFile(ctsPath, JSON.stringify(cts, null, 2), "utf8");
}

/**
 * Find CTS files by criteria
 */
export async function findCTS(opts: {
  dir?: string;
  intent?: CodeIntent;
  author?: string;
  since?: Date;
  limit?: number;
}): Promise<string[]> {
  const dir = opts.dir || path.join(process.cwd(), "reports", "cts");

  try {
    const files = await fs.readdir(dir);
    const ctsFiles = files
      .filter((f) => f.startsWith("cts_") && f.endsWith(".json"))
      .sort()
      .reverse(); // Most recent first

    const filtered: string[] = [];

    for (const file of ctsFiles) {
      if (opts.limit && filtered.length >= opts.limit) break;

      const filepath = path.join(dir, file);

      // Quick filter by filename pattern if possible
      if (opts.intent && !file.includes(`_${opts.intent}_`)) continue;

      try {
        const cts = await loadCTS(filepath);

        // Apply filters
        if (opts.intent && cts.intent !== opts.intent) continue;
        if (opts.author && cts.author !== opts.author) continue;
        if (opts.since && new Date(cts.timestamp) < opts.since) continue;

        filtered.push(filepath);
      } catch {
        // Skip invalid files
        continue;
      }
    }

    return filtered;
  } catch (err) {
    if ((err as any).code === "ENOENT") {
      return []; // Directory doesn't exist yet
    }
    throw err;
  }
}

/**
 * Generate CTS summary for reporting
 */
export function summarizeCTS(cts: CodeTaskSpec): string {
  const lines = [
    `CTS ${cts.id.slice(0, 8)}`,
    `Intent: ${cts.intent}`,
    `Time: ${cts.timestamp}`,
    `Author: ${cts.author || "unknown"}`,
    `Input: "${cts.inputs.userText.slice(0, 50)}..."`,
  ];

  if (cts.modelPlan) {
    lines.push(`Model: ${cts.modelPlan.selectedModel}`);
  }

  if (cts.result) {
    lines.push(`Result: ${cts.result.success ? "✅ Success" : "❌ Failed"}`);
    if (cts.result.patches) {
      lines.push(`Patches: ${cts.result.patches.length} files`);
    }
  }

  return lines.join("\n");
}
