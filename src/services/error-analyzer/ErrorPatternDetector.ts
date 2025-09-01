/**
 * ErrorPatternDetector Service
 * Multi-error detection with confidence scoring
 *
 * Supports:
 * - TypeScript (tsc) errors
 * - ESLint violations
 * - Vitest test failures
 * - Node.js runtime errors
 * - Build errors
 *
 * @since v3.4.2
 */

export type ErrorSource =
  | "tsc"
  | "eslint"
  | "vitest"
  | "node"
  | "build"
  | "unknown";

export type ErrorType =
  | "TS_TYPE_ERROR"
  | "TS_REF_ERROR"
  | "TS_SYNTAX_ERROR"
  | "ESLINT_RULE_VIOLATION"
  | "TEST_FAIL"
  | "TEST_TIMEOUT"
  | "RUNTIME_EXCEPTION"
  | "BUILD_ERROR"
  | "IMPORT_ERROR"
  | "UNKNOWN";

export interface ErrorLocation {
  file?: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

export interface DetectedError {
  source: ErrorSource;
  type: ErrorType;
  message: string;
  location?: ErrorLocation;
  ruleId?: string; // ESLint rule or TS error code
  code?: string; // Error code (e.g., TS2339)
  confidence: number; // 0.0 to 1.0
  severity?: "error" | "warning" | "info";
  raw?: string; // Original error text
  context?: string[]; // Additional context lines
  suggestions?: string[]; // Possible fixes
}

export interface DetectionResult {
  errors: DetectedError[];
  hasErrors: boolean;
  hasCriticalErrors: boolean;
  summary: {
    total: number;
    bySource: Record<ErrorSource, number>;
    bySeverity: Record<string, number>;
  };
}

export class ErrorPatternDetector {
  // TypeScript error patterns
  private readonly TSC_PATTERNS = {
    standard:
      /^(?<file>.+?)\((?<line>\d+),(?<col>\d+)\):\s*(?<severity>error|warning)\s+(?<code>TS\d+):\s*(?<msg>.+)$/,
    multiline:
      /^(?<severity>error|warning)\s+(?<code>TS\d+):\s*(?<msg>.+?)[\r\n]+\s*(?<file>.+?):(?<line>\d+):(?<col>\d+)/,
    build:
      /^(?<file>.+?):\s*(?<msg>.*?)\s*\[(?<line>\d+),\s*(?<col>\d+)\]:\s*(?<severity>error|warning)\s+(?<code>TS\d+)/,
  };

  // ESLint error patterns
  private readonly ESLINT_PATTERNS = {
    stylish:
      /^(?<file>[^:\n]+):(?<line>\d+):(?<col>\d+):\s*(?<msg>.+?)\s*\[(?<rule>[^\]]+)\]$/,
    compact:
      /^(?<file>.+?):\s*line\s+(?<line>\d+),\s*col\s+(?<col>\d+),\s*(?<severity>Error|Warning)\s*-\s*(?<msg>.+?)\s*\((?<rule>[^)]+)\)$/,
    unix: /^(?<file>.+?):(?<line>\d+):(?<col>\d+):\s*(?<msg>.+?)$/,
  };

  // Vitest/Jest patterns
  private readonly TEST_PATTERNS = {
    fail: /^(?<marker>✓|✗|●)\s+(?<test>.+?)\s*(?:\((?<time>\d+)ms\))?$/,
    expect:
      /^(?:Expected|Expect).*?(?<expected>".+?").*?(?:Received|received|got).*?(?<received>".+?")/,
    file: /^(?:FAIL|PASS)\s+(?<file>.+?)(?:\s+\((?<time>[\d.]+)s?\))?$/,
    summary: /^Tests:\s*(?<failed>\d+)\s*failed,\s*(?<passed>\d+)\s*passed/,
  };

  // Node.js runtime patterns
  private readonly NODE_PATTERNS = {
    error: /^(?<type>\w+Error):\s*(?<msg>.+?)$/,
    stack:
      /^\s*at\s+(?<fn>.*?)\s*\((?<file>[^:()]+):(?<line>\d+):(?<col>\d+)\)/,
    stackAlt: /^\s*at\s+(?<file>[^:()]+):(?<line>\d+):(?<col>\d+)$/,
    module: /^Error:\s*Cannot find module\s*['"](?<module>[^'"]+)['"]/,
  };

  /**
   * Detect all errors in the input text
   */
  detectErrors(input: string): DetectionResult {
    if (!input || typeof input !== "string") {
      return this.createEmptyResult();
    }

    const errors: DetectedError[] = [];

    // Try JSON parsing first (for structured error reports)
    const jsonErrors = this.parseJSONErrors(input);
    errors.push(...jsonErrors);

    // Parse line-by-line errors
    const lines = input.split(/\r?\n/);

    // Try different parsers
    errors.push(...this.parseTypeScriptErrors(lines));
    errors.push(...this.parseESLintErrors(lines));
    errors.push(...this.parseTestErrors(lines, input));
    errors.push(...this.parseNodeErrors(lines));
    errors.push(...this.parseBuildErrors(lines));

    // Deduplicate errors
    const deduped = this.deduplicateErrors(errors);

    // Sort by confidence (highest first)
    deduped.sort((a, b) => b.confidence - a.confidence);

    // If no specific errors found, try generic detection
    if (deduped.length === 0 && this.looksLikeError(input)) {
      deduped.push(this.createGenericError(input));
    }

    return this.createResult(deduped);
  }

  /**
   * Parse TypeScript compiler errors
   */
  private parseTypeScriptErrors(lines: string[]): DetectedError[] {
    const errors: DetectedError[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Try each TypeScript pattern
      for (const [name, pattern] of Object.entries(this.TSC_PATTERNS)) {
        const match = line.match(pattern);
        if (match?.groups) {
          const g = match.groups;
          const errorType = this.classifyTypeScriptError(g.code, g.msg);

          errors.push({
            source: "tsc",
            type: errorType,
            message: g.msg?.trim() || "",
            location: {
              file: g.file,
              line: parseInt(g.line, 10),
              column: parseInt(g.col, 10),
            },
            code: g.code,
            severity: (g.severity as "error" | "warning") || "error",
            confidence: 0.95,
            raw: line,
            context: this.extractContext(lines, i),
            suggestions: this.getTypeScriptSuggestions(g.code),
          });
          break;
        }
      }
    }

    return errors;
  }

  /**
   * Parse ESLint errors
   */
  private parseESLintErrors(lines: string[]): DetectedError[] {
    const errors: DetectedError[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const [name, pattern] of Object.entries(this.ESLINT_PATTERNS)) {
        const match = line.match(pattern);
        if (match?.groups) {
          const g = match.groups;

          errors.push({
            source: "eslint",
            type: "ESLINT_RULE_VIOLATION",
            message: g.msg?.trim() || "",
            location: {
              file: g.file,
              line: parseInt(g.line, 10),
              column: parseInt(g.col, 10),
            },
            ruleId: g.rule,
            severity: this.mapESLintSeverity(g.severity),
            confidence: name === "unix" ? 0.7 : 0.9,
            raw: line,
            context: this.extractContext(lines, i),
            suggestions: this.getESLintSuggestions(g.rule),
          });
          break;
        }
      }
    }

    return errors;
  }

  /**
   * Parse test framework errors (Vitest, Jest)
   */
  private parseTestErrors(lines: string[], fullText: string): DetectedError[] {
    const errors: DetectedError[] = [];
    let currentFile: string | undefined;
    let inFailure = false;

    // Check for JSON test output first
    if (
      fullText.includes('"testResults"') ||
      fullText.includes('"numFailedTests"')
    ) {
      try {
        const json = JSON.parse(fullText);
        return this.parseTestJSON(json);
      } catch {
        // Not valid JSON, continue with line parsing
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Track test file
      const fileMatch = line.match(this.TEST_PATTERNS.file);
      if (fileMatch?.groups) {
        currentFile = fileMatch.groups.file;
        inFailure = line.startsWith("FAIL");
      }

      // Track test failures
      const testMatch = line.match(this.TEST_PATTERNS.fail);
      if (testMatch?.groups && testMatch.groups.marker === "✗") {
        inFailure = true;

        // Look for expectation details
        const expectMatch = lines[i + 1]?.match(this.TEST_PATTERNS.expect);

        errors.push({
          source: "vitest",
          type: "TEST_FAIL",
          message: `Test failed: ${testMatch.groups.test}`,
          location: currentFile ? { file: currentFile } : undefined,
          confidence: 0.9,
          severity: "error",
          raw: line,
          context: this.extractContext(lines, i, 3),
          suggestions: [
            "Review test expectations",
            "Check test implementation",
          ],
        });
      }
    }

    return errors;
  }

  /**
   * Parse Node.js runtime errors
   */
  private parseNodeErrors(lines: string[]): DetectedError[] {
    const errors: DetectedError[] = [];
    let errorHeader: { type: string; message: string } | undefined;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for error header
      const errorMatch = line.match(this.NODE_PATTERNS.error);
      if (errorMatch?.groups) {
        errorHeader = {
          type: errorMatch.groups.type,
          message: errorMatch.groups.msg,
        };
        continue;
      }

      // Check for module not found
      const moduleMatch = line.match(this.NODE_PATTERNS.module);
      if (moduleMatch?.groups) {
        errors.push({
          source: "node",
          type: "IMPORT_ERROR",
          message: `Cannot find module '${moduleMatch.groups.module}'`,
          confidence: 0.95,
          severity: "error",
          raw: line,
          suggestions: [
            `Install missing module: npm install ${moduleMatch.groups.module}`,
            "Check import path",
            "Verify module exists",
          ],
        });
      }

      // Check for stack trace
      const stackMatch =
        line.match(this.NODE_PATTERNS.stack) ||
        line.match(this.NODE_PATTERNS.stackAlt);
      if (stackMatch?.groups && errorHeader) {
        errors.push({
          source: "node",
          type: "RUNTIME_EXCEPTION",
          message: errorHeader.message,
          location: {
            file: stackMatch.groups.file,
            line: parseInt(stackMatch.groups.line, 10),
            column: parseInt(stackMatch.groups.col, 10),
          },
          code: errorHeader.type,
          confidence: 0.85,
          severity: "error",
          raw: `${errorHeader.type}: ${errorHeader.message}`,
          context: this.extractContext(lines, i),
        });
        errorHeader = undefined; // Reset after use
      }
    }

    return errors;
  }

  /**
   * Parse build errors
   */
  private parseBuildErrors(lines: string[]): DetectedError[] {
    const errors: DetectedError[] = [];
    const buildPatterns = [
      /^ERROR in (?<file>.+?)$/,
      /^Module build failed.*?(?<file>.+?)$/,
      /^Failed to compile\.?$/,
      /^\[ERROR\]\s+(?<msg>.+?)$/,
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const pattern of buildPatterns) {
        const match = line.match(pattern);
        if (match) {
          errors.push({
            source: "build",
            type: "BUILD_ERROR",
            message: match.groups?.msg || line,
            location: match.groups?.file
              ? { file: match.groups.file }
              : undefined,
            confidence: 0.75,
            severity: "error",
            raw: line,
            context: this.extractContext(lines, i),
          });
          break;
        }
      }
    }

    return errors;
  }

  /**
   * Parse JSON error reports
   */
  private parseJSONErrors(text: string): DetectedError[] {
    try {
      const json = JSON.parse(text);

      // Vitest/Jest JSON format
      if (json.testResults || json.results) {
        return this.parseTestJSON(json);
      }

      // ESLint JSON format
      if (Array.isArray(json) && json[0]?.filePath) {
        return this.parseESLintJSON(json);
      }

      // TypeScript diagnostics
      if (json.diagnostics || (Array.isArray(json) && json[0]?.file)) {
        return this.parseTypeScriptJSON(json);
      }
    } catch {
      // Not valid JSON
    }

    return [];
  }

  /**
   * Parse test framework JSON output
   */
  private parseTestJSON(data: any): DetectedError[] {
    const errors: DetectedError[] = [];
    const suites = data.testResults || data.results || data.suites || [];

    const processResults = (results: any[]) => {
      for (const result of results) {
        const assertions = result.assertionResults || result.assertions || [];

        for (const assertion of assertions) {
          if (assertion.status === "failed" || assertion.error) {
            errors.push({
              source: "vitest",
              type: "TEST_FAIL",
              message:
                assertion.failureMessages?.[0] ||
                assertion.error?.message ||
                "Test failed",
              location:
                assertion.location ||
                (result.name ? { file: result.name } : undefined),
              confidence: 0.95,
              severity: "error",
              raw: JSON.stringify(assertion, null, 2),
            });
          }
        }

        // Recurse into nested tests
        if (result.tests) {
          processResults(result.tests);
        }
      }
    };

    processResults(suites);
    return errors;
  }

  /**
   * Parse ESLint JSON output
   */
  private parseESLintJSON(data: any[]): DetectedError[] {
    const errors: DetectedError[] = [];

    for (const file of data) {
      for (const message of file.messages || []) {
        errors.push({
          source: "eslint",
          type: "ESLINT_RULE_VIOLATION",
          message: message.message,
          location: {
            file: file.filePath,
            line: message.line,
            column: message.column,
            endLine: message.endLine,
            endColumn: message.endColumn,
          },
          ruleId: message.ruleId,
          severity: message.severity === 2 ? "error" : "warning",
          confidence: 0.95,
          suggestions: message.suggestions?.map((s: any) => s.desc),
        });
      }
    }

    return errors;
  }

  /**
   * Parse TypeScript JSON diagnostics
   */
  private parseTypeScriptJSON(data: any): DetectedError[] {
    const errors: DetectedError[] = [];
    const diagnostics = data.diagnostics || (Array.isArray(data) ? data : []);

    for (const diag of diagnostics) {
      if (diag.file) {
        errors.push({
          source: "tsc",
          type: this.classifyTypeScriptError(
            String(diag.code),
            diag.messageText,
          ),
          message:
            typeof diag.messageText === "string"
              ? diag.messageText
              : diag.messageText?.messageText,
          location: {
            file: diag.file.fileName,
            line: diag.start?.line,
            column: diag.start?.character,
          },
          code: `TS${diag.code}`,
          severity: diag.category === 0 ? "warning" : "error",
          confidence: 0.95,
        });
      }
    }

    return errors;
  }

  /**
   * Classify TypeScript error type
   */
  private classifyTypeScriptError(code: string, message: string): ErrorType {
    const codeNum = parseInt(code.replace("TS", ""), 10);

    // Syntax errors (1xxx)
    if (codeNum >= 1000 && codeNum < 2000) {
      return "TS_SYNTAX_ERROR";
    }

    // Type errors (2xxx)
    if (codeNum >= 2000 && codeNum < 3000) {
      return "TS_TYPE_ERROR";
    }

    // Reference errors
    if (
      message?.toLowerCase().includes("cannot find") ||
      message?.toLowerCase().includes("is not defined")
    ) {
      return "TS_REF_ERROR";
    }

    return "TS_TYPE_ERROR";
  }

  /**
   * Get TypeScript error suggestions
   */
  private getTypeScriptSuggestions(code: string): string[] {
    const suggestions: Record<string, string[]> = {
      TS2304: [
        "Import the missing identifier",
        "Check spelling",
        "Declare the variable",
      ],
      TS2339: [
        "Check property name spelling",
        "Add type declaration",
        "Verify object structure",
      ],
      TS7006: [
        "Add explicit type annotation",
        "Enable noImplicitAny: false",
        "Use type inference",
      ],
      TS2345: [
        "Check argument types",
        "Add type assertion",
        "Update function signature",
      ],
    };

    return (
      suggestions[code] || [
        "Check TypeScript documentation",
        "Review type definitions",
      ]
    );
  }

  /**
   * Get ESLint rule suggestions
   */
  private getESLintSuggestions(rule: string): string[] {
    const suggestions: Record<string, string[]> = {
      "no-unused-vars": [
        "Remove unused variable",
        "Prefix with underscore",
        "Export if needed",
      ],
      "no-undef": [
        "Import or declare the variable",
        "Check spelling",
        "Add to globals",
      ],
      semi: ["Add or remove semicolon", "Configure rule in .eslintrc"],
      quotes: ["Use consistent quote style", "Configure preferred style"],
    };

    return (
      suggestions[rule] || [`Review ESLint rule: ${rule}`, "Run eslint --fix"]
    );
  }

  /**
   * Map ESLint severity
   */
  private mapESLintSeverity(severity?: string): "error" | "warning" | "info" {
    const lower = severity?.toLowerCase();
    if (lower === "error") return "error";
    if (lower === "warning" || lower === "warn") return "warning";
    return "info";
  }

  /**
   * Extract context lines around an error
   */
  private extractContext(
    lines: string[],
    index: number,
    contextSize: number = 2,
  ): string[] {
    const start = Math.max(0, index - contextSize);
    const end = Math.min(lines.length, index + contextSize + 1);
    return lines.slice(start, end);
  }

  /**
   * Check if text looks like an error
   */
  private looksLikeError(text: string): boolean {
    const errorKeywords = [
      "error",
      "Error",
      "ERROR",
      "failed",
      "Failed",
      "FAILED",
      "exception",
      "Exception",
      "fatal",
      "Fatal",
      "cannot",
      "Cannot",
      "undefined",
      "null",
      "not found",
      "not defined",
    ];

    return errorKeywords.some((keyword) => text.includes(keyword));
  }

  /**
   * Create a generic error for unrecognized patterns
   */
  private createGenericError(text: string): DetectedError {
    const firstLine = text.split(/\r?\n/)[0] || text;

    return {
      source: "unknown",
      type: "UNKNOWN",
      message: firstLine.slice(0, 200),
      confidence: 0.3,
      severity: "error",
      raw: text.slice(0, 500),
      suggestions: [
        "Check error format",
        "Review full error output",
        "Run diagnostic commands",
      ],
    };
  }

  /**
   * Deduplicate errors
   */
  private deduplicateErrors(errors: DetectedError[]): DetectedError[] {
    const seen = new Set<string>();
    const unique: DetectedError[] = [];

    for (const error of errors) {
      const key = [
        error.source,
        error.type,
        error.location?.file || "",
        error.location?.line || "",
        error.location?.column || "",
        error.ruleId || "",
        error.code || "",
        error.message.slice(0, 50),
      ].join("|");

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(error);
      }
    }

    return unique;
  }

  /**
   * Create empty result
   */
  private createEmptyResult(): DetectionResult {
    return {
      errors: [],
      hasErrors: false,
      hasCriticalErrors: false,
      summary: {
        total: 0,
        bySource: {} as Record<ErrorSource, number>,
        bySeverity: { error: 0, warning: 0, info: 0 },
      },
    };
  }

  /**
   * Create result from errors
   */
  private createResult(errors: DetectedError[]): DetectionResult {
    const bySource: Record<ErrorSource, number> = {
      tsc: 0,
      eslint: 0,
      vitest: 0,
      node: 0,
      build: 0,
      unknown: 0,
    };

    const bySeverity: Record<string, number> = {
      error: 0,
      warning: 0,
      info: 0,
    };

    for (const error of errors) {
      bySource[error.source]++;
      bySeverity[error.severity || "error"]++;
    }

    return {
      errors,
      hasErrors: errors.length > 0,
      hasCriticalErrors: errors.some(
        (e) => e.severity === "error" && e.confidence > 0.8,
      ),
      summary: {
        total: errors.length,
        bySource,
        bySeverity,
      },
    };
  }

  /**
   * Analyze error patterns and suggest commands
   */
  suggestCommands(result: DetectionResult): string[] {
    const suggestions: string[] = [];

    if (result.summary.bySource.tsc > 0) {
      suggestions.push("pnpm type-check");
    }

    if (result.summary.bySource.eslint > 0) {
      suggestions.push("pnpm lint:fix");
    }

    if (result.summary.bySource.vitest > 0) {
      suggestions.push("pnpm test");
    }

    if (result.summary.bySource.node > 0) {
      suggestions.push("node --trace-warnings");
    }

    if (result.summary.bySource.build > 0) {
      suggestions.push("pnpm clean && pnpm build");
    }

    return suggestions;
  }
}

export default ErrorPatternDetector;
