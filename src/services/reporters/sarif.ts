/**
 * SARIF (Static Analysis Results Interchange Format) Reporter
 * Converts ValidateGate reports to SARIF format for CI/IDE integration
 */

import * as fs from "fs/promises";
import * as path from "path";
import type { GateReport, ErrorFingerprint } from "../code-quality/types";

export interface SarifLog {
  $schema: string;
  version: "2.1.0";
  runs: SarifRun[];
}

export interface SarifRun {
  tool: {
    driver: {
      name: string;
      version?: string;
      informationUri?: string;
      rules?: SarifRule[];
    };
  };
  results: SarifResult[];
  invocations?: SarifInvocation[];
  artifacts?: SarifArtifact[];
}

export interface SarifRule {
  id: string;
  name?: string;
  shortDescription?: { text: string };
  fullDescription?: { text: string };
  defaultConfiguration?: {
    level?: "error" | "warning" | "note";
  };
  helpUri?: string;
}

export interface SarifResult {
  ruleId?: string;
  ruleIndex?: number;
  level?: "error" | "warning" | "note";
  message: {
    text: string;
    markdown?: string;
  };
  locations?: SarifLocation[];
  fixes?: SarifFix[];
  relatedLocations?: SarifLocation[];
  suppressions?: any[];
}

export interface SarifLocation {
  physicalLocation?: {
    artifactLocation?: {
      uri: string;
      uriBaseId?: string;
    };
    region?: {
      startLine?: number;
      startColumn?: number;
      endLine?: number;
      endColumn?: number;
      charOffset?: number;
      charLength?: number;
      snippet?: {
        text?: string;
        rendered?: { text: string };
      };
    };
  };
  message?: { text: string };
}

export interface SarifFix {
  description?: { text: string };
  artifactChanges?: Array<{
    artifactLocation: { uri: string };
    replacements: Array<{
      deletedRegion: any;
      insertedContent?: { text: string };
    }>;
  }>;
}

export interface SarifInvocation {
  executionSuccessful: boolean;
  startTimeUtc?: string;
  endTimeUtc?: string;
  exitCode?: number;
  toolExecutionNotifications?: any[];
  toolConfigurationNotifications?: any[];
}

export interface SarifArtifact {
  location?: { uri: string };
  sourceLanguage?: string;
  length?: number;
  encoding?: string;
}

/**
 * Convert ErrorFingerprint to SARIF Result
 */
function errorToSarifResult(
  error: ErrorFingerprint,
  level: "error" | "warning" = "error",
): SarifResult {
  const result: SarifResult = {
    level,
    message: {
      text: error.message,
      markdown: formatMarkdownMessage(error),
    },
  };

  // Add rule information
  if (error.ruleId || error.code) {
    result.ruleId = error.ruleId || error.code || error.source;
  }

  // Add location information
  if (error.file) {
    result.locations = [
      {
        physicalLocation: {
          artifactLocation: {
            uri: error.file.startsWith("/")
              ? `file://${error.file}`
              : error.file,
          },
          region: {
            startLine: error.line,
            startColumn: error.column,
            endLine: error.endLine || error.line,
            endColumn: error.endColumn || error.column,
            snippet: error.raw
              ? {
                  text: error.raw,
                }
              : undefined,
          },
        },
      },
    ];
  }

  // Add fix suggestions if available
  if (error.suggestions && error.suggestions.length > 0) {
    result.fixes = error.suggestions.map((suggestion) => ({
      description: { text: suggestion },
    }));
  }

  return result;
}

/**
 * Format error as markdown for better display
 */
function formatMarkdownMessage(error: ErrorFingerprint): string {
  const lines = [`**${error.message}**`];

  if (error.code) {
    lines.push(`\nError Code: \`${error.code}\``);
  }

  if (error.ruleId) {
    lines.push(`Rule: \`${error.ruleId}\``);
  }

  if (error.stack && error.stack.length > 0) {
    lines.push("\nStack Trace:");
    lines.push("```");
    lines.push(...error.stack.slice(0, 5));
    lines.push("```");
  }

  if (error.suggestions && error.suggestions.length > 0) {
    lines.push("\n**Suggestions:**");
    error.suggestions.forEach((s) => lines.push(`- ${s}`));
  }

  return lines.join("\n");
}

/**
 * Extract unique rules from errors
 */
function extractRules(errors: ErrorFingerprint[]): SarifRule[] {
  const rulesMap = new Map<string, SarifRule>();

  errors.forEach((error) => {
    const ruleId = error.ruleId || error.code || error.source;
    if (!rulesMap.has(ruleId)) {
      rulesMap.set(ruleId, {
        id: ruleId,
        name: ruleId,
        shortDescription: {
          text: getRuleDescription(ruleId, error.source),
        },
        defaultConfiguration: {
          level: error.severity || "error",
        },
      });
    }
  });

  return Array.from(rulesMap.values());
}

/**
 * Get human-readable rule description
 */
function getRuleDescription(ruleId: string, source: string): string {
  // Common TypeScript errors
  if (ruleId.startsWith("TS")) {
    const tsErrors: Record<string, string> = {
      TS2307: "Cannot find module",
      TS7006: "Parameter implicitly has an any type",
      TS2345: "Argument type mismatch",
      TS2339: "Property does not exist on type",
      TS2551: "Property name misspelled",
      TS2322: "Type assignment error",
    };
    return tsErrors[ruleId] || `TypeScript error ${ruleId}`;
  }

  // Source-based descriptions
  switch (source) {
    case "eslint":
      return `ESLint rule violation: ${ruleId}`;
    case "vitest":
    case "jest":
      return `Test failure: ${ruleId}`;
    case "node":
      return `Runtime error: ${ruleId}`;
    default:
      return ruleId;
  }
}

/**
 * Convert GateReport to SARIF format
 */
export function toSarif(
  report: GateReport,
  options: {
    toolName?: string;
    toolVersion?: string;
    toolUri?: string;
    baseUri?: string;
  } = {},
): SarifLog {
  const toolName = options.toolName || "MARIA ValidateGate";
  const toolVersion = options.toolVersion || "2.1.0";

  // Combine all errors and warnings
  const allIssues = [
    ...report.errors.map((e) => ({ ...e, level: "error" as const })),
    ...report.warnings.map((w) => ({ ...w, level: "warning" as const })),
  ];

  // Convert to SARIF results
  const results = allIssues.map((issue) =>
    errorToSarifResult(issue, issue.level),
  );

  // Extract rules
  const rules = extractRules(allIssues);

  // Create invocation record
  const invocation: SarifInvocation = {
    executionSuccessful: report.pass,
    startTimeUtc: new Date(Date.now() - report.durationMs).toISOString(),
    endTimeUtc: new Date().toISOString(),
    exitCode: report.pass ? 0 : 1,
  };

  // Build SARIF log
  const sarifLog: SarifLog = {
    $schema:
      "https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: toolName,
            version: toolVersion,
            informationUri: options.toolUri,
            rules,
          },
        },
        results,
        invocations: [invocation],
      },
    ],
  };

  return sarifLog;
}

/**
 * Write SARIF report to file
 */
export async function writeSarif(
  report: GateReport,
  options: {
    outputDir?: string;
    filename?: string;
    pretty?: boolean;
    toolName?: string;
    toolVersion?: string;
  } = {},
): Promise<string> {
  const outputDir = options.outputDir || path.join(process.cwd(), "reports");
  const filename = options.filename || `validate_${Date.now()}.sarif.json`;

  // Ensure directory exists
  await fs.mkdir(outputDir, { recursive: true });

  // Generate SARIF log
  const sarifLog = toSarif(report, {
    toolName: options.toolName,
    toolVersion: options.toolVersion,
  });

  // Write to file
  const filepath = path.join(outputDir, filename);
  const content = options.pretty
    ? JSON.stringify(sarifLog, null, 2)
    : JSON.stringify(sarifLog);

  await fs.writeFile(filepath, content, "utf8");

  return filepath;
}

/**
 * Merge multiple SARIF reports
 */
export function mergeSarifReports(reports: SarifLog[]): SarifLog {
  if (reports.length === 0) {
    throw new Error("No reports to merge");
  }

  if (reports.length === 1) {
    return reports[0];
  }

  // Use first report as base
  const merged = JSON.parse(JSON.stringify(reports[0])) as SarifLog;

  // Merge runs from other reports
  for (let i = 1; i < reports.length; i++) {
    merged.runs.push(...reports[i].runs);
  }

  return merged;
}

/**
 * Filter SARIF results by severity
 */
export function filterSarifBySeverity(
  sarif: SarifLog,
  severities: Array<"error" | "warning" | "note">,
): SarifLog {
  const filtered = JSON.parse(JSON.stringify(sarif)) as SarifLog;

  filtered.runs = filtered.runs.map((run) => ({
    ...run,
    results: run.results.filter((r) => severities.includes(r.level || "error")),
  }));

  return filtered;
}
