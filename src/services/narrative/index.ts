/**
 * Narrative Reporter Factory and Exports
 */

import type { NarrativeReporter, ReporterOptions } from "./types.js";
import { TTYReporter } from "./reporters/TTYReporter.js";
import { JSONReporter } from "./reporters/JSONReporter.js";
import { NullReporter } from "./reporters/NullReporter.js";
import { RunIdGenerator } from "./utils/RunIdGenerator.js";

// Export types
export * from "./types.js";
export { RunIdGenerator } from "./utils/RunIdGenerator.js";
export { Masker } from "./security/Masker.js";
export { AdaptiveCompact } from "./utils/AdaptiveCompact.js";

// Export reporters
export { TTYReporter } from "./reporters/TTYReporter.js";
export { JSONReporter } from "./reporters/JSONReporter.js";
export { NullReporter } from "./reporters/NullReporter.js";

/**
 * Create a narrative reporter based on options
 */
export function createReporter(
  options: ReporterOptions = {},
): NarrativeReporter {
  const {
    mode,
    isTTY = process.stdout.isTTY && !process.env.CI,
    runId,
    redact = process.env.INIT_REDACT === "1",
    compactThreshold,
    verbose = process.env.INIT_VERBOSE === "1",
  } = options;

  // Generate run ID if not provided
  const finalRunId = runId || RunIdGenerator.getInstance().getCurrent();

  // Determine mode based on environment and options
  let finalMode = mode;

  if (!finalMode) {
    // Auto-detect mode
    if (process.env.INIT_QUIET === "1" || process.argv.includes("--quiet")) {
      finalMode = "null";
    } else if (
      process.env.INIT_JSON === "1" ||
      process.argv.includes("--json")
    ) {
      finalMode = "json";
    } else if (process.env.INIT_NARRATIVE === "0") {
      finalMode = "null";
    } else {
      finalMode = "tty";
    }
  }

  // Create appropriate reporter
  switch (finalMode) {
    case "json":
      return new JSONReporter(finalRunId, redact);

    case "null":
      return new NullReporter();

    case "tty":
    default:
      // For TTY mode, respect verbose and isTTY settings
      return new TTYReporter(isTTY, redact, verbose, compactThreshold);
  }
}

/**
 * Default reporter instance (singleton)
 */
let defaultReporter: NarrativeReporter | null = null;

/**
 * Get or create default reporter
 */
export function getDefaultReporter(): NarrativeReporter {
  if (!defaultReporter) {
    defaultReporter = createReporter();
  }
  return defaultReporter;
}

/**
 * Reset default reporter (useful for testing)
 */
export function resetDefaultReporter(): void {
  defaultReporter = null;
}
