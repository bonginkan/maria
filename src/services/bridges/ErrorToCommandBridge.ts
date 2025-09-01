/**
 * ErrorToCommandBridge Service
 * Maps detected errors to appropriate command suggestions
 * Bridges error analysis with intelligent command routing
 *
 * @since v3.4.2
 */

import * as fs from "fs/promises";
import * as path from "path";
import {
  ErrorPatternDetector,
  DetectedError,
  DetectionResult,
  ErrorSource,
  ErrorType,
} from "../error-analyzer/ErrorPatternDetector";
import type { InputAttachment } from "../../ui/integrated-cli/InputBoxAdapter";

export interface ProposedAction {
  suggestedCommand: string; // e.g., "/doctor", "/lint", "/test"
  args: string[]; // Command arguments
  reason: string; // Human-readable explanation
  confidence: number; // 0.0 to 1.0
  priority: "high" | "medium" | "low";
  relatedFiles?: string[]; // Files mentioned in errors
  alternativeCommands?: string[]; // Other possible commands
  autoExecute?: boolean; // Whether to run automatically
}

export interface BridgeOptions {
  maxFileReadSize?: number; // Max bytes to read from files
  enableFileAnalysis?: boolean;
  confidenceThreshold?: number;
}

export class ErrorToCommandBridge {
  private detector: ErrorPatternDetector;
  private options: Required<BridgeOptions>;

  constructor(options: BridgeOptions = {}) {
    this.detector = new ErrorPatternDetector();
    this.options = {
      maxFileReadSize: options.maxFileReadSize ?? 2048,
      enableFileAnalysis: options.enableFileAnalysis ?? true,
      confidenceThreshold: options.confidenceThreshold ?? 0.6,
    };
  }

  /**
   * Propose actions based on text and attachments
   */
  async propose(
    text: string,
    attachments: InputAttachment[] = [],
  ): Promise<ProposedAction[]> {
    // Combine text with attachment content
    let combinedContent = text || "";

    // Add content from attachments if enabled
    if (this.options.enableFileAnalysis) {
      combinedContent += await this.extractAttachmentContent(attachments);
    }

    // Detect errors
    const detectionResult = this.detector.detectErrors(combinedContent);

    if (!detectionResult.hasErrors) {
      return [];
    }

    // Generate proposals
    const proposals = this.generateProposals(detectionResult);

    // Sort by confidence and priority
    proposals.sort((a, b) => {
      if (a.confidence !== b.confidence) {
        return b.confidence - a.confidence;
      }
      return this.priorityScore(b.priority) - this.priorityScore(a.priority);
    });

    // Filter by confidence threshold
    return proposals.filter(
      (p) => p.confidence >= this.options.confidenceThreshold,
    );
  }

  /**
   * Generate command proposals from detected errors
   */
  private generateProposals(result: DetectionResult): ProposedAction[] {
    const proposals: ProposedAction[] = [];
    const processedCommands = new Set<string>();

    // Group errors by source for better suggestions
    const errorsBySource = this.groupErrorsBySource(result.errors);

    // TypeScript errors
    if (errorsBySource.tsc.length > 0) {
      proposals.push(...this.proposeTypeScriptActions(errorsBySource.tsc));
    }

    // ESLint errors
    if (errorsBySource.eslint.length > 0) {
      proposals.push(...this.proposeESLintActions(errorsBySource.eslint));
    }

    // Test failures
    if (errorsBySource.vitest.length > 0) {
      proposals.push(...this.proposeTestActions(errorsBySource.vitest));
    }

    // Node runtime errors
    if (errorsBySource.node.length > 0) {
      proposals.push(...this.proposeNodeActions(errorsBySource.node));
    }

    // Build errors
    if (errorsBySource.build.length > 0) {
      proposals.push(...this.proposeBuildActions(errorsBySource.build));
    }

    // General doctor command if multiple error types
    if (
      Object.keys(errorsBySource).filter(
        (k) => errorsBySource[k as ErrorSource].length > 0,
      ).length > 1
    ) {
      proposals.push(this.createDoctorProposal(result));
    }

    // Deduplicate proposals
    return this.deduplicateProposals(proposals);
  }

  /**
   * Propose actions for TypeScript errors
   */
  private proposeTypeScriptActions(errors: DetectedError[]): ProposedAction[] {
    const proposals: ProposedAction[] = [];
    const files = this.extractUniqueFiles(errors);
    const hasTypeErrors = errors.some((e) => e.type === "TS_TYPE_ERROR");
    const hasSyntaxErrors = errors.some((e) => e.type === "TS_SYNTAX_ERROR");

    // Main type-check command
    proposals.push({
      suggestedCommand: "/typecheck",
      args: files.length === 1 ? ["analyze", files[0]] : ["analyze"],
      reason: `Found ${errors.length} TypeScript error${errors.length > 1 ? "s" : ""}: ${this.summarizeErrors(errors)}`,
      confidence: 0.95,
      priority: "high",
      relatedFiles: files,
      alternativeCommands: ["/lint", "/doctor"],
      autoExecute: false,
    });

    // Suggest fix command if fixable
    if (hasTypeErrors && !hasSyntaxErrors) {
      proposals.push({
        suggestedCommand: "/fix",
        args: ["typescript", ...files.slice(0, 3)],
        reason: "TypeScript errors may be auto-fixable",
        confidence: 0.7,
        priority: "medium",
        relatedFiles: files,
      });
    }

    // Build command if many errors
    if (errors.length > 10) {
      proposals.push({
        suggestedCommand: "/build",
        args: ["--clean"],
        reason: "Many TypeScript errors detected, clean build recommended",
        confidence: 0.6,
        priority: "low",
      });
    }

    return proposals;
  }

  /**
   * Propose actions for ESLint errors
   */
  private proposeESLintActions(errors: DetectedError[]): ProposedAction[] {
    const proposals: ProposedAction[] = [];
    const files = this.extractUniqueFiles(errors);
    const rules = this.extractUniqueRules(errors);

    // Main lint command
    proposals.push({
      suggestedCommand: "/lint",
      args: files.length === 1 ? ["check", files[0]] : ["check"],
      reason: `Found ${errors.length} ESLint violation${errors.length > 1 ? "s" : ""} in ${rules.length} rule${rules.length > 1 ? "s" : ""}`,
      confidence: 0.95,
      priority: "high",
      relatedFiles: files,
      alternativeCommands: ["/fix", "/doctor"],
      autoExecute: false,
    });

    // Auto-fix command
    proposals.push({
      suggestedCommand: "/lint",
      args: ["fix", ...files.slice(0, 3)],
      reason: "Auto-fix available for most ESLint rules",
      confidence: 0.85,
      priority: "high",
      relatedFiles: files,
      autoExecute: false,
    });

    // Specific rule disable if single rule dominates
    const ruleCounts = this.countByRule(errors);
    const topRule = Object.entries(ruleCounts).sort((a, b) => b[1] - a[1])[0];
    if (topRule && topRule[1] > errors.length * 0.5) {
      proposals.push({
        suggestedCommand: "/config",
        args: ["eslint", "rule", topRule[0], "off"],
        reason: `Rule '${topRule[0]}' accounts for ${topRule[1]} errors`,
        confidence: 0.5,
        priority: "low",
      });
    }

    return proposals;
  }

  /**
   * Propose actions for test failures
   */
  private proposeTestActions(errors: DetectedError[]): ProposedAction[] {
    const proposals: ProposedAction[] = [];
    const files = this.extractUniqueFiles(errors);
    const testFiles = files.filter(
      (f) => f.includes(".test.") || f.includes(".spec."),
    );

    // Run tests command
    proposals.push({
      suggestedCommand: "/test",
      args:
        testFiles.length === 1
          ? [testFiles[0]]
          : testFiles.length > 0
            ? ["--failed"]
            : [],
      reason: `${errors.length} test${errors.length > 1 ? "s" : ""} failed`,
      confidence: 0.95,
      priority: "high",
      relatedFiles: testFiles,
      alternativeCommands: ["/test --watch", "/test --debug"],
      autoExecute: false,
    });

    // Debug mode for complex failures
    if (
      errors.some(
        (e) => e.message.includes("timeout") || e.message.includes("async"),
      )
    ) {
      proposals.push({
        suggestedCommand: "/test",
        args: ["--debug", "--timeout=10000"],
        reason: "Async or timeout issues detected",
        confidence: 0.7,
        priority: "medium",
      });
    }

    // Update snapshots if snapshot failures
    if (errors.some((e) => e.message.includes("snapshot"))) {
      proposals.push({
        suggestedCommand: "/test",
        args: ["--updateSnapshot"],
        reason: "Snapshot mismatches detected",
        confidence: 0.8,
        priority: "medium",
      });
    }

    return proposals;
  }

  /**
   * Propose actions for Node runtime errors
   */
  private proposeNodeActions(errors: DetectedError[]): ProposedAction[] {
    const proposals: ProposedAction[] = [];
    const hasModuleError = errors.some((e) => e.type === "IMPORT_ERROR");
    const hasRuntimeError = errors.some((e) => e.type === "RUNTIME_EXCEPTION");

    // Module installation for missing modules
    if (hasModuleError) {
      const missingModules = this.extractMissingModules(errors);
      if (missingModules.length > 0) {
        proposals.push({
          suggestedCommand: "/install",
          args: missingModules,
          reason: `Missing module${missingModules.length > 1 ? "s" : ""}: ${missingModules.join(", ")}`,
          confidence: 0.9,
          priority: "high",
          autoExecute: false,
        });
      }
    }

    // Doctor command for runtime errors
    if (hasRuntimeError) {
      proposals.push({
        suggestedCommand: "/doctor",
        args: ["--category", "runtime", "--verbose"],
        reason: "Runtime exception detected, diagnostic needed",
        confidence: 0.85,
        priority: "high",
        relatedFiles: this.extractUniqueFiles(errors),
      });
    }

    // Debug mode suggestion
    proposals.push({
      suggestedCommand: "/debug",
      args: ["--break-on-error"],
      reason: "Enable debugging to trace runtime errors",
      confidence: 0.6,
      priority: "medium",
    });

    return proposals;
  }

  /**
   * Propose actions for build errors
   */
  private proposeBuildActions(errors: DetectedError[]): ProposedAction[] {
    const proposals: ProposedAction[] = [];

    // Clean and rebuild
    proposals.push({
      suggestedCommand: "/build",
      args: ["--clean", "--force"],
      reason: "Build errors detected, clean rebuild recommended",
      confidence: 0.85,
      priority: "high",
      autoExecute: false,
    });

    // Check dependencies
    proposals.push({
      suggestedCommand: "/deps",
      args: ["check"],
      reason: "Verify all dependencies are installed correctly",
      confidence: 0.7,
      priority: "medium",
    });

    // Clear cache
    proposals.push({
      suggestedCommand: "/cache",
      args: ["clear"],
      reason: "Clear build cache to resolve potential issues",
      confidence: 0.6,
      priority: "low",
    });

    return proposals;
  }

  /**
   * Create a general doctor proposal
   */
  private createDoctorProposal(result: DetectionResult): ProposedAction {
    const sources = Object.keys(result.summary.bySource).filter(
      (k) => result.summary.bySource[k as ErrorSource] > 0,
    );

    return {
      suggestedCommand: "/doctor",
      args: ["--verbose", "--all"],
      reason: `Multiple error types detected (${sources.join(", ")})`,
      confidence: 0.75,
      priority: "medium",
      alternativeCommands: this.detector.suggestCommands(result),
      autoExecute: false,
    };
  }

  /**
   * Extract content from attachments
   */
  private async extractAttachmentContent(
    attachments: InputAttachment[],
  ): Promise<string> {
    if (!attachments.length) {
      return "";
    }

    let content = "\n\n--- Attachment Content ---\n";

    for (const attachment of attachments) {
      // Skip non-text files
      if (
        !this.isTextFile(attachment.path) &&
        attachment.kind !== "error-log"
      ) {
        continue;
      }

      // Use provided content if available
      if (attachment.content) {
        content += `\nFile: ${attachment.path}\n${attachment.content}\n`;
        continue;
      }

      // Try to read file content
      if (attachment.kind === "file" || attachment.kind === "error-log") {
        try {
          const fileContent = await this.readFileContent(attachment.path);
          if (fileContent) {
            content += `\nFile: ${attachment.path}\n${fileContent}\n`;
          }
        } catch {
          // Ignore read errors
        }
      }
    }

    return content;
  }

  /**
   * Read file content with size limit
   */
  private async readFileContent(filePath: string): Promise<string | null> {
    try {
      const stats = await fs.stat(filePath);

      // Check file size
      if (stats.size > this.options.maxFileReadSize * 10) {
        // For large files, read only the beginning
        const fd = await fs.open(filePath, "r");
        const buffer = Buffer.alloc(this.options.maxFileReadSize);
        await fd.read(buffer, 0, this.options.maxFileReadSize, 0);
        await fd.close();
        return buffer.toString("utf8");
      }

      // Read entire file for small files
      const content = await fs.readFile(filePath, "utf8");
      return content.slice(0, this.options.maxFileReadSize);
    } catch {
      return null;
    }
  }

  /**
   * Check if file is text-based
   */
  private isTextFile(filePath: string): boolean {
    const textExtensions = [
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".json",
      ".md",
      ".txt",
      ".log",
      ".css",
      ".scss",
      ".html",
      ".xml",
      ".yml",
      ".yaml",
      ".toml",
      ".ini",
      ".sh",
      ".bash",
      ".zsh",
    ];

    const ext = path.extname(filePath).toLowerCase();
    return textExtensions.includes(ext);
  }

  /**
   * Group errors by source
   */
  private groupErrorsBySource(
    errors: DetectedError[],
  ): Record<ErrorSource, DetectedError[]> {
    const grouped: Record<ErrorSource, DetectedError[]> = {
      tsc: [],
      eslint: [],
      vitest: [],
      node: [],
      build: [],
      unknown: [],
    };

    for (const error of errors) {
      grouped[error.source].push(error);
    }

    return grouped;
  }

  /**
   * Extract unique files from errors
   */
  private extractUniqueFiles(errors: DetectedError[]): string[] {
    const files = new Set<string>();

    for (const error of errors) {
      if (error.location?.file) {
        files.add(error.location.file);
      }
    }

    return Array.from(files);
  }

  /**
   * Extract unique ESLint rules
   */
  private extractUniqueRules(errors: DetectedError[]): string[] {
    const rules = new Set<string>();

    for (const error of errors) {
      if (error.ruleId) {
        rules.add(error.ruleId);
      }
    }

    return Array.from(rules);
  }

  /**
   * Count errors by rule
   */
  private countByRule(errors: DetectedError[]): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const error of errors) {
      if (error.ruleId) {
        counts[error.ruleId] = (counts[error.ruleId] || 0) + 1;
      }
    }

    return counts;
  }

  /**
   * Extract missing module names
   */
  private extractMissingModules(errors: DetectedError[]): string[] {
    const modules = new Set<string>();

    for (const error of errors) {
      const match = error.message.match(/Cannot find module ['"]([^'"]+)['"]/);
      if (match) {
        modules.add(match[1]);
      }
    }

    return Array.from(modules);
  }

  /**
   * Summarize errors for display
   */
  private summarizeErrors(errors: DetectedError[]): string {
    if (errors.length === 0) {
      return "No errors";
    }

    if (errors.length === 1) {
      return errors[0].message.slice(0, 100);
    }

    const types = new Set(errors.map((e) => e.type));
    return `${types.size} error type${types.size > 1 ? "s" : ""}`;
  }

  /**
   * Get priority score
   */
  private priorityScore(priority: "high" | "medium" | "low"): number {
    const scores = { high: 3, medium: 2, low: 1 };
    return scores[priority] || 0;
  }

  /**
   * Deduplicate proposals
   */
  private deduplicateProposals(proposals: ProposedAction[]): ProposedAction[] {
    const seen = new Map<string, ProposedAction>();

    for (const proposal of proposals) {
      const key = `${proposal.suggestedCommand}:${proposal.args.join(":")}`;

      if (!seen.has(key) || seen.get(key)!.confidence < proposal.confidence) {
        seen.set(key, proposal);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Get the best proposal
   */
  getBestProposal(proposals: ProposedAction[]): ProposedAction | null {
    if (proposals.length === 0) {
      return null;
    }

    // Sort by confidence and priority
    const sorted = [...proposals].sort((a, b) => {
      if (a.confidence !== b.confidence) {
        return b.confidence - a.confidence;
      }
      return this.priorityScore(b.priority) - this.priorityScore(a.priority);
    });

    return sorted[0];
  }

  /**
   * Format proposal for display
   */
  formatProposal(proposal: ProposedAction): string {
    let output = `💡 Suggested: ${proposal.suggestedCommand}`;

    if (proposal.args.length > 0) {
      output += ` ${proposal.args.join(" ")}`;
    }

    output += `\n   Reason: ${proposal.reason}`;
    output += `\n   Confidence: ${Math.round(proposal.confidence * 100)}%`;

    if (
      proposal.alternativeCommands &&
      proposal.alternativeCommands.length > 0
    ) {
      output += `\n   Alternatives: ${proposal.alternativeCommands.join(", ")}`;
    }

    return output;
  }
}

export default ErrorToCommandBridge;
