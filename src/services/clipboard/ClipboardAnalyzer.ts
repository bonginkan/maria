/**
 * ClipboardAnalyzer Service
 * Intelligent clipboard content analysis and processing
 *
 * Features:
 * - Content type detection (code, error, data, plain text)
 * - Secret detection and sanitization
 * - Language/framework recognition
 * - Suggested actions based on content
 * - Security validation
 *
 * @since v3.4.2
 */

import { EventEmitter } from "node:events";

export type ClipboardContentType =
  | "code"
  | "error"
  | "data"
  | "url"
  | "file-path"
  | "json"
  | "markdown"
  | "plain-text"
  | "image-data"
  | "credentials"
  | "unknown";

export type ProgrammingLanguage =
  | "typescript"
  | "javascript"
  | "python"
  | "java"
  | "go"
  | "rust"
  | "c"
  | "cpp"
  | "csharp"
  | "php"
  | "ruby"
  | "shell"
  | "sql"
  | "html"
  | "css"
  | "json"
  | "yaml"
  | "xml"
  | "markdown"
  | "unknown";

export interface SecurityIssue {
  type:
    | "api-key"
    | "password"
    | "token"
    | "private-key"
    | "connection-string"
    | "secret";
  pattern: string;
  location: { start: number; end: number };
  confidence: number;
  severity: "critical" | "high" | "medium" | "low";
  suggestion: string;
}

export interface ClipboardAnalysis {
  contentType: ClipboardContentType;
  language?: ProgrammingLanguage;
  framework?: string;
  confidence: number;

  // Content properties
  isMultiline: boolean;
  lineCount: number;
  characterCount: number;
  wordCount: number;

  // Analysis results
  containsCode: boolean;
  containsErrors: boolean;
  containsSecrets: boolean;
  containsUrls: boolean;
  containsPaths: boolean;

  // Security
  securityIssues: SecurityIssue[];
  sanitizedContent?: string;

  // Suggestions
  suggestedActions: string[];
  suggestedCommands: string[];

  // Metadata
  timestamp: number;
  processingTime: number;
}

export interface ClipboardAnalyzerOptions {
  enableSecretDetection?: boolean;
  enableLanguageDetection?: boolean;
  maxContentLength?: number;
  secretPatterns?: Array<{
    name: string;
    pattern: RegExp;
    severity: SecurityIssue["severity"];
  }>;
}

export class ClipboardAnalyzer extends EventEmitter {
  private options: Required<ClipboardAnalyzerOptions>;
  private secretPatterns: Array<{
    name: string;
    pattern: RegExp;
    severity: SecurityIssue["severity"];
  }>;

  constructor(options: ClipboardAnalyzerOptions = {}) {
    super();

    this.options = {
      enableSecretDetection: options.enableSecretDetection ?? true,
      enableLanguageDetection: options.enableLanguageDetection ?? true,
      maxContentLength: options.maxContentLength ?? 100000, // 100KB
      secretPatterns: options.secretPatterns ?? [],
    };

    this.initializeSecretPatterns();
  }

  /**
   * Analyze clipboard content
   */
  async analyze(content: string): Promise<ClipboardAnalysis> {
    const startTime = Date.now();

    // Validate input
    if (!content || typeof content !== "string") {
      return this.createEmptyAnalysis(startTime);
    }

    // Truncate if too large
    if (content.length > this.options.maxContentLength) {
      content = content.slice(0, this.options.maxContentLength);
    }

    // Basic content analysis
    const basicAnalysis = this.analyzeBasicProperties(content);

    // Content type detection
    const contentType = this.detectContentType(content);

    // Language detection (if code)
    let language: ProgrammingLanguage | undefined;
    let framework: string | undefined;

    if (
      this.options.enableLanguageDetection &&
      (contentType === "code" || basicAnalysis.containsCode)
    ) {
      const langResult = this.detectLanguage(content);
      language = langResult.language;
      framework = langResult.framework;
    }

    // Security analysis
    let securityIssues: SecurityIssue[] = [];
    let sanitizedContent: string | undefined;

    if (this.options.enableSecretDetection) {
      securityIssues = this.detectSecrets(content);
      if (securityIssues.length > 0) {
        sanitizedContent = this.sanitizeContent(content, securityIssues);
      }
    }

    // Generate suggestions
    const suggestions = this.generateSuggestions(
      content,
      contentType,
      language,
      securityIssues,
    );

    const analysis: ClipboardAnalysis = {
      ...basicAnalysis,
      contentType,
      language,
      framework,
      confidence: this.calculateConfidence(
        contentType,
        language,
        basicAnalysis,
      ),
      securityIssues,
      sanitizedContent,
      suggestedActions: suggestions.actions,
      suggestedCommands: suggestions.commands,
      timestamp: Date.now(),
      processingTime: Date.now() - startTime,
    };

    // Emit events
    this.emitAnalysisEvents(analysis);

    return analysis;
  }

  /**
   * Analyze basic content properties
   */
  private analyzeBasicProperties(content: string) {
    const lines = content.split(/\r?\n/);
    const words = content
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0);

    return {
      isMultiline: lines.length > 1,
      lineCount: lines.length,
      characterCount: content.length,
      wordCount: words.length,
      containsCode: this.looksLikeCode(content),
      containsErrors: this.containsErrors(content),
      containsSecrets: false, // Will be set by security analysis
      containsUrls: this.containsUrls(content),
      containsPaths: this.containsPaths(content),
    };
  }

  /**
   * Detect content type
   */
  private detectContentType(content: string): ClipboardContentType {
    const trimmed = content.trim();

    // Check for credentials first (security priority)
    if (this.looksLikeCredentials(content)) {
      return "credentials";
    }

    // JSON detection
    if (this.isValidJSON(trimmed)) {
      return "json";
    }

    // Error patterns
    if (this.containsErrors(content)) {
      return "error";
    }

    // Code detection
    if (this.looksLikeCode(content)) {
      return "code";
    }

    // URL detection
    if (this.isURL(trimmed)) {
      return "url";
    }

    // File path detection
    if (this.looksLikeFilePath(trimmed)) {
      return "file-path";
    }

    // Markdown detection
    if (this.looksLikeMarkdown(content)) {
      return "markdown";
    }

    // Image data (base64)
    if (this.looksLikeImageData(trimmed)) {
      return "image-data";
    }

    // Structured data
    if (this.looksLikeStructuredData(content)) {
      return "data";
    }

    return "plain-text";
  }

  /**
   * Detect programming language
   */
  private detectLanguage(content: string): {
    language: ProgrammingLanguage;
    framework?: string;
  } {
    const patterns: Array<{
      language: ProgrammingLanguage;
      patterns: RegExp[];
      frameworks?: { pattern: RegExp; name: string }[];
    }> = [
      {
        language: "typescript",
        patterns: [
          /interface\s+\w+/,
          /type\s+\w+\s*=/,
          /:\s*(string|number|boolean|object)/,
          /as\s+\w+/,
          /import.*from\s+['"][^'"]+\.ts['"]/,
        ],
        frameworks: [
          { pattern: /from\s+['"]react['"]/, name: "React" },
          { pattern: /from\s+['"]@angular\//, name: "Angular" },
          { pattern: /from\s+['"]vue['"]/, name: "Vue" },
        ],
      },
      {
        language: "javascript",
        patterns: [
          /function\s+\w+\s*\(/,
          /=>\s*[{(]/,
          /const\s+\w+\s*=/,
          /require\s*\(/,
          /module\.exports/,
        ],
        frameworks: [
          { pattern: /from\s+['"]react['"]/, name: "React" },
          { pattern: /require\s*\(\s*['"]express['"]/, name: "Express" },
          { pattern: /from\s+['"]vue['"]/, name: "Vue" },
        ],
      },
      {
        language: "python",
        patterns: [
          /def\s+\w+\s*\(/,
          /import\s+\w+/,
          /from\s+\w+\s+import/,
          /if\s+__name__\s*==\s*['"]__main__['"]/,
          /:\s*$[\r\n]\s+/m,
        ],
        frameworks: [
          { pattern: /from\s+django/, name: "Django" },
          { pattern: /from\s+flask/, name: "Flask" },
          { pattern: /import\s+pandas/, name: "Pandas" },
        ],
      },
      {
        language: "java",
        patterns: [
          /public\s+class\s+\w+/,
          /public\s+static\s+void\s+main/,
          /import\s+java\./,
          /@\w+/,
        ],
        frameworks: [
          { pattern: /import.*springframework/, name: "Spring" },
          { pattern: /import.*hibernate/, name: "Hibernate" },
        ],
      },
      {
        language: "go",
        patterns: [/package\s+main/, /func\s+\w+\s*\(/, /import\s*\(/, /:=\s*/],
      },
      {
        language: "rust",
        patterns: [
          /fn\s+\w+\s*\(/,
          /let\s+mut\s+\w+/,
          /use\s+\w+::/,
          /impl\s+\w+/,
        ],
      },
      {
        language: "shell",
        patterns: [/^#!/, /\$\{?\w+\}?/, /\|\s*\w+/, /&&\s*\w+/],
      },
      {
        language: "sql",
        patterns: [
          /SELECT\s+.*FROM/i,
          /INSERT\s+INTO/i,
          /UPDATE\s+.*SET/i,
          /CREATE\s+TABLE/i,
        ],
      },
      {
        language: "json",
        patterns: [/^\s*[{\[][\s\S]*[}\]]\s*$/],
      },
      {
        language: "yaml",
        patterns: [/^[\w-]+:\s*.+$/m, /^\s*-\s+[\w-]+:/m],
      },
      {
        language: "html",
        patterns: [/<\/?[a-zA-Z][\w-]*(\s|>)/, /<!DOCTYPE\s+html/i],
      },
      {
        language: "css",
        patterns: [/[\w-]+\s*:\s*[^;]+;/, /[\w-]+\s*\{[^}]*\}/, /@media\s/],
      },
      {
        language: "markdown",
        patterns: [/^#+\s+.+$/m, /^\*\s+.+$/m, /\[.+\]\(.+\)/, /```[\w]*$/m],
      },
    ];

    let bestMatch = {
      language: "unknown" as ProgrammingLanguage,
      score: 0,
      framework: undefined as string | undefined,
    };

    for (const langPattern of patterns) {
      let score = 0;

      for (const pattern of langPattern.patterns) {
        if (pattern.test(content)) {
          score++;
        }
      }

      // Check frameworks if language matches
      let framework: string | undefined;
      if (score > 0 && langPattern.frameworks) {
        for (const fw of langPattern.frameworks) {
          if (fw.pattern.test(content)) {
            framework = fw.name;
            score += 0.5; // Bonus for framework detection
            break;
          }
        }
      }

      if (score > bestMatch.score) {
        bestMatch = { language: langPattern.language, score, framework };
      }
    }

    return { language: bestMatch.language, framework: bestMatch.framework };
  }

  /**
   * Detect secrets in content
   */
  private detectSecrets(content: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    for (const { name, pattern, severity } of this.secretPatterns) {
      let match;
      const globalPattern = new RegExp(
        pattern.source,
        pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g",
      );

      while ((match = globalPattern.exec(content)) !== null) {
        issues.push({
          type: name as SecurityIssue["type"],
          pattern: match[0],
          location: { start: match.index, end: match.index + match[0].length },
          confidence: this.calculateSecretConfidence(name, match[0]),
          severity,
          suggestion: this.getSecretSuggestion(name),
        });
      }
    }

    return issues;
  }

  /**
   * Initialize secret detection patterns
   */
  private initializeSecretPatterns() {
    this.secretPatterns = [
      // API Keys
      {
        name: "api-key",
        pattern: /(?:api[_-]?key|apikey)[\s:='"]*([a-zA-Z0-9_\-]{20,})/gi,
        severity: "high",
      },
      {
        name: "secret",
        pattern: /(?:secret|token)[\s:='"]*([a-zA-Z0-9_\-]{16,})/gi,
        severity: "high",
      },

      // Specific platforms
      {
        name: "token",
        pattern: /ghp_[a-zA-Z0-9]{36}/g, // GitHub token
        severity: "critical",
      },
      {
        name: "api-key",
        pattern: /sk-[a-zA-Z0-9]{48}/g, // OpenAI key
        severity: "critical",
      },
      {
        name: "token",
        pattern: /xoxp-[0-9]{12}-[0-9]{12}-[0-9]{12}-[a-zA-Z0-9]{32}/g, // Slack token
        severity: "high",
      },

      // Connection strings
      {
        name: "connection-string",
        pattern: /(?:mongodb|mysql|postgres|postgresql):\/\/[^\s'"]+/gi,
        severity: "medium",
      },

      // Passwords
      {
        name: "password",
        pattern: /(?:password|pwd|pass)[\s:='"]+([^\s'"]{8,})/gi,
        severity: "medium",
      },

      // Private keys
      {
        name: "private-key",
        pattern: /-----BEGIN[A-Z\s]+PRIVATE KEY-----/g,
        severity: "critical",
      },

      // AWS
      {
        name: "api-key",
        pattern: /AKIA[0-9A-Z]{16}/g, // AWS Access Key
        severity: "high",
      },

      // JWT tokens
      {
        name: "token",
        pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
        severity: "medium",
      },
    ];

    // Add user-provided patterns
    this.secretPatterns.push(...this.options.secretPatterns);
  }

  /**
   * Calculate confidence for secret detection
   */
  private calculateSecretConfidence(type: string, match: string): number {
    // Base confidence
    let confidence = 0.7;

    // Length bonus
    if (match.length > 32) confidence += 0.2;
    if (match.length > 64) confidence += 0.1;

    // Pattern specificity bonus
    if (type === "token" && match.includes("-")) confidence += 0.2;
    if (type === "api-key" && /[A-Z0-9]{16,}/.test(match)) confidence += 0.1;

    return Math.min(1.0, confidence);
  }

  /**
   * Get suggestion for secret type
   */
  private getSecretSuggestion(type: string): string {
    const suggestions: Record<string, string> = {
      "api-key": "Replace with environment variable or secure vault",
      secret: "Move to secure configuration",
      token: "Revoke and regenerate if exposed",
      password: "Use secure password management",
      "private-key": "Regenerate key pair if compromised",
      "connection-string": "Use environment variables for credentials",
    };

    return suggestions[type] || "Review and secure this credential";
  }

  /**
   * Sanitize content by masking secrets
   */
  private sanitizeContent(content: string, issues: SecurityIssue[]): string {
    let sanitized = content;

    // Sort by position (descending) to avoid index shifts
    const sortedIssues = [...issues].sort(
      (a, b) => b.location.start - a.location.start,
    );

    for (const issue of sortedIssues) {
      const before = sanitized.slice(0, issue.location.start);
      const after = sanitized.slice(issue.location.end);
      const mask = `[${issue.type.toUpperCase()}_REDACTED]`;
      sanitized = before + mask + after;
    }

    return sanitized;
  }

  /**
   * Generate suggestions based on analysis
   */
  private generateSuggestions(
    content: string,
    contentType: ClipboardContentType,
    language?: ProgrammingLanguage,
    securityIssues?: SecurityIssue[],
  ): { actions: string[]; commands: string[] } {
    const actions: string[] = [];
    const commands: string[] = [];

    // Security suggestions
    if (securityIssues && securityIssues.length > 0) {
      actions.push(
        `⚠️  ${securityIssues.length} security issue${securityIssues.length > 1 ? "s" : ""} detected`,
      );
      actions.push("Review and secure sensitive information");
      commands.push("/security scan");
    }

    // Content type specific suggestions
    switch (contentType) {
      case "code":
        actions.push("Analyze code for issues");
        actions.push("Format and validate syntax");
        if (language) {
          commands.push(`/code analyze --lang=${language}`);
          commands.push(`/lint check --lang=${language}`);
        } else {
          commands.push("/code analyze");
        }
        break;

      case "error":
        actions.push("Analyze error and suggest fixes");
        actions.push("Search for solutions");
        commands.push("/doctor analyze");
        commands.push("/fix error");
        break;

      case "json":
        actions.push("Validate JSON format");
        actions.push("Format and prettify");
        commands.push("/validate json");
        commands.push("/format json");
        break;

      case "url":
        actions.push("Open URL");
        actions.push("Analyze web content");
        commands.push("/browse");
        commands.push("/research url");
        break;

      case "file-path":
        actions.push("Open file or directory");
        actions.push("Analyze file content");
        commands.push("/open");
        commands.push("/analyze file");
        break;

      case "credentials":
        actions.push("🔒 Secure credential detected");
        actions.push("Move to environment variables");
        commands.push("/security audit");
        break;

      default:
        if (content.length > 100) {
          actions.push("Summarize content");
          commands.push("/summarize");
        }
        if (this.containsUrls(content)) {
          actions.push("Extract and process URLs");
          commands.push("/extract urls");
        }
    }

    // Language specific suggestions
    if (language && language !== "unknown") {
      switch (language) {
        case "typescript":
        case "javascript":
          commands.push("/typecheck");
          break;
        case "python":
          commands.push("/python lint");
          break;
        case "sql":
          commands.push("/sql validate");
          break;
      }
    }

    return { actions, commands };
  }

  /**
   * Content detection helper methods
   */
  private looksLikeCode(content: string): boolean {
    const codeIndicators = [
      /^(import|export|const|let|var|function|class|interface|type)\s+/m,
      /^(if|for|while|switch|try|catch)\s*[\(\{]/m,
      /=>\s*[\{\(]/,
      /\{[\s\S]*\}/,
      /;$/m,
      /\/\*[\s\S]*?\*\//,
      /\/\/.*$/m,
      /#include\s*<.*>/,
      /def\s+\w+\s*\(/,
      /function\s+\w+\s*\(/,
    ];

    const score = codeIndicators.filter((pattern) =>
      pattern.test(content),
    ).length;
    return score >= 2;
  }

  private containsErrors(content: string): boolean {
    const errorPatterns = [
      /TS\d{3,5}:/,
      /error TS\d+:/i,
      /^Error:/m,
      /^TypeError:/m,
      /^ReferenceError:/m,
      /^SyntaxError:/m,
      /at .+:\d+:\d+/,
      /^\s*✗\s+/m,
      /FAIL\s+\S+/,
      /\d+\s+failed/i,
    ];

    return errorPatterns.some((pattern) => pattern.test(content));
  }

  private containsUrls(content: string): boolean {
    return /https?:\/\/[^\s]+/.test(content);
  }

  private containsPaths(content: string): boolean {
    return /(?:^|\s)(?:\/[\w-]+(?:\/[\w.-]+)*|[A-Z]:\\[\w-]+(?:\\[\w.-]+)*|\.\/[\w.-]+)(?:\s|$)/m.test(
      content,
    );
  }

  private isValidJSON(content: string): boolean {
    try {
      JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  }

  private isURL(content: string): boolean {
    try {
      new URL(content);
      return true;
    } catch {
      return false;
    }
  }

  private looksLikeFilePath(content: string): boolean {
    const pathPatterns = [
      /^\/[\w-]+(?:\/[\w.-]+)*$/, // Unix path
      /^[A-Z]:\\[\w-]+(?:\\[\w.-]+)*$/, // Windows path
      /^\.\/[\w.-]+$/, // Relative path
      /^~\/[\w.-]+$/, // Home path
    ];

    return pathPatterns.some((pattern) => pattern.test(content.trim()));
  }

  private looksLikeMarkdown(content: string): boolean {
    const markdownPatterns = [
      /^#+\s+.+$/m, // Headers
      /^\*\s+.+$/m, // Lists
      /\[.+\]\(.+\)/, // Links
      /```[\w]*$/m, // Code blocks
      /^\|.+\|$/m, // Tables
    ];

    return markdownPatterns.some((pattern) => pattern.test(content));
  }

  private looksLikeImageData(content: string): boolean {
    return (
      /^data:image\/[^;]+;base64,/.test(content) ||
      /^[A-Za-z0-9+\/]{100,}={0,2}$/.test(content)
    );
  }

  private looksLikeStructuredData(content: string): boolean {
    // CSV-like
    if (/^[^,\n]+(?:,[^,\n]*)+$/m.test(content)) return true;

    // Key-value pairs
    if (/^\w+\s*[:=]\s*.+$/m.test(content)) return true;

    return false;
  }

  private looksLikeCredentials(content: string): boolean {
    const credentialPatterns = [
      /(?:password|pwd|pass)[\s:=]/i,
      /(?:api[_-]?key|apikey)[\s:=]/i,
      /(?:secret|token)[\s:=]/i,
      /(?:username|user)[\s:=]/i,
      /BEGIN[A-Z\s]+PRIVATE KEY/,
    ];

    return credentialPatterns.some((pattern) => pattern.test(content));
  }

  /**
   * Calculate overall analysis confidence
   */
  private calculateConfidence(
    contentType: ClipboardContentType,
    language?: ProgrammingLanguage,
    basicAnalysis?: any,
  ): number {
    let confidence = 0.5; // Base confidence

    // Content type confidence
    switch (contentType) {
      case "json":
      case "url":
      case "credentials":
        confidence += 0.4;
        break;
      case "code":
      case "error":
        confidence += 0.3;
        break;
      case "markdown":
      case "data":
        confidence += 0.2;
        break;
      default:
        confidence += 0.1;
    }

    // Language detection confidence
    if (language && language !== "unknown") {
      confidence += 0.1;
    }

    return Math.min(1.0, confidence);
  }

  /**
   * Create empty analysis for invalid input
   */
  private createEmptyAnalysis(startTime: number): ClipboardAnalysis {
    return {
      contentType: "unknown",
      confidence: 0,
      isMultiline: false,
      lineCount: 0,
      characterCount: 0,
      wordCount: 0,
      containsCode: false,
      containsErrors: false,
      containsSecrets: false,
      containsUrls: false,
      containsPaths: false,
      securityIssues: [],
      suggestedActions: [],
      suggestedCommands: [],
      timestamp: Date.now(),
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Emit analysis events
   */
  private emitAnalysisEvents(analysis: ClipboardAnalysis) {
    this.emit("analysis", analysis);
    this.emit(`content:${analysis.contentType}`, analysis);

    if (analysis.language) {
      this.emit(`language:${analysis.language}`, analysis);
    }

    if (analysis.containsSecrets) {
      this.emit("security-issue", analysis.securityIssues);
    }

    if (analysis.containsErrors) {
      this.emit("error-detected", analysis);
    }
  }

  /**
   * Quick content type check without full analysis
   */
  quickCheck(content: string): {
    type: ClipboardContentType;
    confidence: number;
  } {
    if (!content || typeof content !== "string") {
      return { type: "unknown", confidence: 0 };
    }

    const type = this.detectContentType(content);
    const confidence = this.calculateConfidence(type);

    return { type, confidence };
  }

  /**
   * Batch analyze multiple clipboard entries
   */
  async analyzeMultiple(contents: string[]): Promise<ClipboardAnalysis[]> {
    const results = await Promise.all(
      contents.map((content) => this.analyze(content)),
    );

    this.emit("batch-analysis", results);
    return results;
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): ProgrammingLanguage[] {
    return [
      "typescript",
      "javascript",
      "python",
      "java",
      "go",
      "rust",
      "c",
      "cpp",
      "csharp",
      "php",
      "ruby",
      "shell",
      "sql",
      "html",
      "css",
      "json",
      "yaml",
      "xml",
      "markdown",
    ];
  }

  /**
   * Update configuration
   */
  updateOptions(options: Partial<ClipboardAnalyzerOptions>): void {
    Object.assign(this.options, options);

    if (options.secretPatterns) {
      this.initializeSecretPatterns();
    }
  }
}

export default ClipboardAnalyzer;
