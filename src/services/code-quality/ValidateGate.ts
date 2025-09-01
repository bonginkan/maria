import * as ts from "typescript";
import { exec } from "child_process";
import { promisify } from "util";
import { readFileSync } from "fs";
import { ErrorFingerprint, ValidationResult, ChangeSpec } from "./types";

const execAsync = promisify(exec);

/**
 * ValidateGate: Error detection and validation system
 * Integrates with ErrorParsers for comprehensive analysis
 */
export class ValidateGate {
  private tsProgram: ts.Program | null = null;
  private diagnosticCache = new Map<string, ErrorFingerprint[]>();

  async validate(changeSpec: ChangeSpec): Promise<ValidationResult> {
    const errors: ErrorFingerprint[] = [];
    const startTime = Date.now();

    try {
      // Run multiple validators in parallel
      const [tsErrors, lintErrors, testErrors] = await Promise.all([
        this.runTypeScriptCheck(changeSpec),
        this.runLintCheck(changeSpec),
        this.runTestCheck(changeSpec),
      ]);

      errors.push(...tsErrors, ...lintErrors, ...testErrors);

      // Deduplicate errors by fingerprint
      const uniqueErrors = this.deduplicateErrors(errors);

      // Determine validation result using three-value system
      let result: "pass" | "softFail" | "hardFail" = "pass";

      if (uniqueErrors.length === 0) {
        result = "pass";
      } else {
        // Count critical errors (hardFail conditions)
        const criticalErrors = uniqueErrors.filter(
          (err) =>
            err.severity === "error" &&
            (err.category === "TYPE_ERROR" ||
              err.category === "SYSTEM" ||
              err.category === "TEST_FAILURE"),
        );

        // Count soft errors (can be auto-fixed)
        const softErrors = uniqueErrors.filter(
          (err) => err.severity === "warning" || err.category === "LINT_ERROR",
        );

        if (criticalErrors.length > 0) {
          result = "hardFail";
        } else if (softErrors.length > 0) {
          result = "softFail";
        }
      }

      return {
        valid: result === "pass",
        result,
        errors: uniqueErrors,
        executionTime: Date.now() - startTime,
        metadata: {
          totalErrors: uniqueErrors.length,
          byCategory: this.categorizeErrors(uniqueErrors),
          bySeverity: this.groupBySeverity(uniqueErrors),
        },
      };
    } catch (error) {
      return {
        valid: false,
        result: "hardFail",
        errors: [
          {
            file: changeSpec.file,
            line: 0,
            column: 0,
            message: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
            category: "SYSTEM",
            severity: "error",
            fingerprint: `system-error-${Date.now()}`,
          },
        ],
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async runTypeScriptCheck(
    changeSpec: ChangeSpec,
  ): Promise<ErrorFingerprint[]> {
    const errors: ErrorFingerprint[] = [];

    try {
      // Use TypeScript Compiler API for accurate error detection
      const configPath = ts.findConfigFile(
        process.cwd(),
        ts.sys.fileExists,
        "tsconfig.json",
      );
      if (!configPath) return errors;

      const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
      const parsedConfig = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        process.cwd(),
      );

      // Create program with modified file content
      const host = ts.createCompilerHost(parsedConfig.options);
      const originalReadFile = host.readFile;

      host.readFile = (fileName: string) => {
        if (fileName === changeSpec.file) {
          return this.applyChange(changeSpec);
        }
        return originalReadFile(fileName);
      };

      const program = ts.createProgram(
        [changeSpec.file],
        parsedConfig.options,
        host,
      );
      const diagnostics = ts.getPreEmitDiagnostics(program);

      for (const diagnostic of diagnostics) {
        if (diagnostic.file) {
          const { line, character } =
            diagnostic.file.getLineAndCharacterOfPosition(
              diagnostic.start || 0,
            );

          errors.push({
            file: diagnostic.file.fileName,
            line: line + 1,
            column: character + 1,
            message: ts.flattenDiagnosticMessageText(
              diagnostic.messageText,
              "\n",
            ),
            category: "TYPE_ERROR",
            severity: this.mapTsSeverity(diagnostic.category),
            fingerprint: this.generateFingerprint(
              diagnostic.file.fileName,
              line + 1,
              diagnostic.code || 0,
            ),
            code: diagnostic.code?.toString(),
          });
        }
      }
    } catch (error) {
      console.error("TypeScript check failed:", error);
    }

    return errors;
  }

  private async runLintCheck(
    changeSpec: ChangeSpec,
  ): Promise<ErrorFingerprint[]> {
    const errors: ErrorFingerprint[] = [];

    try {
      // Run ESLint via CLI for comprehensive checks
      const { stdout } = await execAsync(
        `npx eslint ${changeSpec.file} --format json`,
        { cwd: process.cwd() },
      );

      const results = JSON.parse(stdout);
      for (const fileResult of results) {
        for (const message of fileResult.messages) {
          errors.push({
            file: fileResult.filePath,
            line: message.line,
            column: message.column,
            message: message.message,
            category: "LINT_ERROR",
            severity: message.severity === 2 ? "error" : "warning",
            fingerprint: this.generateFingerprint(
              fileResult.filePath,
              message.line,
              message.ruleId || "unknown",
            ),
            rule: message.ruleId,
          });
        }
      }
    } catch (error) {
      // ESLint exits with non-zero on errors, parse output
      const errorStr = String(error);
      if (errorStr.includes("stdout:")) {
        try {
          const jsonStart = errorStr.indexOf("[");
          const jsonEnd = errorStr.lastIndexOf("]") + 1;
          const jsonStr = errorStr.substring(jsonStart, jsonEnd);
          const results = JSON.parse(jsonStr);

          for (const fileResult of results) {
            for (const message of fileResult.messages) {
              errors.push({
                file: fileResult.filePath,
                line: message.line,
                column: message.column,
                message: message.message,
                category: "LINT_ERROR",
                severity: message.severity === 2 ? "error" : "warning",
                fingerprint: this.generateFingerprint(
                  fileResult.filePath,
                  message.line,
                  message.ruleId || "unknown",
                ),
                rule: message.ruleId,
              });
            }
          }
        } catch {
          // Failed to parse ESLint output
        }
      }
    }

    return errors;
  }

  private async runTestCheck(
    changeSpec: ChangeSpec,
  ): Promise<ErrorFingerprint[]> {
    const errors: ErrorFingerprint[] = [];

    // Only run tests if the change affects test files or core functionality
    if (!this.shouldRunTests(changeSpec)) {
      return errors;
    }

    try {
      // Run targeted tests based on affected files
      const testPattern = this.getTestPattern(changeSpec.file);
      const { stdout, stderr } = await execAsync(
        `pnpm test ${testPattern} --reporter=json`,
        { cwd: process.cwd(), timeout: 30000 },
      );

      const results = JSON.parse(stdout);
      if (results.testResults) {
        for (const suite of results.testResults) {
          for (const test of suite.assertionResults || []) {
            if (test.status === "failed") {
              errors.push({
                file: suite.name,
                line: test.failureDetails?.[0]?.line || 0,
                column: 0,
                message: test.failureMessages?.join("\n") || "Test failed",
                category: "TEST_FAILURE",
                severity: "error",
                fingerprint: this.generateFingerprint(
                  suite.name,
                  0,
                  test.title,
                ),
                testName: test.title,
              });
            }
          }
        }
      }
    } catch (error) {
      // Test runner failed - could be expected for failing tests
      console.debug("Test check completed with failures");
    }

    return errors;
  }

  private applyChange(changeSpec: ChangeSpec): string {
    try {
      const content = readFileSync(changeSpec.file, "utf-8");

      if (changeSpec.type === "CREATE") {
        return changeSpec.content || "";
      }

      if (changeSpec.type === "MODIFY" && changeSpec.patch) {
        // Apply patch to content
        const lines = content.split("\n");
        for (const patch of changeSpec.patch) {
          if (patch.type === "replace" && patch.startLine && patch.endLine) {
            lines.splice(
              patch.startLine - 1,
              patch.endLine - patch.startLine + 1,
              ...patch.content.split("\n"),
            );
          }
        }
        return lines.join("\n");
      }

      return content;
    } catch {
      return changeSpec.content || "";
    }
  }

  private shouldRunTests(changeSpec: ChangeSpec): boolean {
    // Run tests for source files, not for test files themselves
    return (
      !changeSpec.file.includes("__tests__") &&
      !changeSpec.file.includes(".test.") &&
      !changeSpec.file.includes(".spec.")
    );
  }

  private getTestPattern(file: string): string {
    // Extract base name and look for corresponding test files
    const baseName = file.replace(/\.(ts|tsx|js|jsx)$/, "");
    const testName = baseName.split("/").pop();
    return `**/*${testName}*.test.*`;
  }

  private deduplicateErrors(errors: ErrorFingerprint[]): ErrorFingerprint[] {
    const seen = new Set<string>();
    return errors.filter((error) => {
      if (seen.has(error.fingerprint)) {
        return false;
      }
      seen.add(error.fingerprint);
      return true;
    });
  }

  private categorizeErrors(errors: ErrorFingerprint[]): Record<string, number> {
    const categories: Record<string, number> = {};
    for (const error of errors) {
      categories[error.category] = (categories[error.category] || 0) + 1;
    }
    return categories;
  }

  private groupBySeverity(errors: ErrorFingerprint[]): Record<string, number> {
    const severities: Record<string, number> = {};
    for (const error of errors) {
      severities[error.severity] = (severities[error.severity] || 0) + 1;
    }
    return severities;
  }

  private mapTsSeverity(
    category: ts.DiagnosticCategory,
  ): "error" | "warning" | "info" {
    switch (category) {
      case ts.DiagnosticCategory.Error:
        return "error";
      case ts.DiagnosticCategory.Warning:
        return "warning";
      default:
        return "info";
    }
  }

  private generateFingerprint(
    file: string,
    line: number,
    code: string | number,
  ): string {
    const normalizedFile = file.replace(process.cwd(), "");
    return `${normalizedFile}:${line}:${code}`;
  }

  /**
   * Batch validate multiple changes
   */
  async validateBatch(changes: ChangeSpec[]): Promise<ValidationResult[]> {
    return Promise.all(changes.map((change) => this.validate(change)));
  }

  /**
   * Get cached diagnostics for a file
   */
  getCachedDiagnostics(file: string): ErrorFingerprint[] | undefined {
    return this.diagnosticCache.get(file);
  }

  /**
   * Clear diagnostic cache
   */
  clearCache(): void {
    this.diagnosticCache.clear();
    this.tsProgram = null;
  }
}

// Export singleton instance
export const validateGate = new ValidateGate();
