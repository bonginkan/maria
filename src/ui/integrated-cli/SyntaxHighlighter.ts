/**
 * SyntaxHighlighter - Performance-Optimized Syntax Highlighting
 * Phase 3 component for intelligent syntax highlighting with performance optimization
 *
 * Features:
 * - Multi-language syntax highlighting (TypeScript, JavaScript, Python, etc.)
 * - Performance optimizations for large content
 * - Incremental highlighting with viewport-based rendering
 * - Theme support with accessibility compliance
 * - Error and warning highlighting integration
 * - Real-time highlighting with debouncing
 * - Memory-efficient token caching
 *
 * @since v3.4.2 Phase 3
 */

import { EventEmitter } from "node:events";

export interface SyntaxHighlighterConfig {
  // Language support
  supportedLanguages: string[];
  defaultLanguage: string;
  autoDetectLanguage: boolean;

  // Performance settings
  enableIncrementalHighlighting: boolean;
  enableVirtualScrolling: boolean;
  maxHighlightLength: number;
  debounceMs: number;
  chunkSize: number;

  // Visual settings
  theme: "dark" | "light" | "auto";
  enableLineNumbers: boolean;
  enableWordWrap: boolean;
  fontSize: number;
  lineHeight: number;

  // Features
  enableErrorHighlighting: boolean;
  enableBracketMatching: boolean;
  enableFolding: boolean;
  enableMinimap: boolean;

  // Accessibility
  enableHighContrast: boolean;
  enableScreenReaderSupport: boolean;
  respectMotionPreference: boolean;
}

export interface LanguageDefinition {
  id: string;
  name: string;
  extensions: string[];
  keywords: string[];
  operators: string[];
  builtins: string[];
  patterns: {
    comment: RegExp;
    string: RegExp;
    number: RegExp;
    function: RegExp;
    class: RegExp;
    import: RegExp;
  };
  brackets: Array<{ open: string; close: string }>;
}

export interface Token {
  type:
    | "keyword"
    | "string"
    | "comment"
    | "number"
    | "function"
    | "class"
    | "operator"
    | "builtin"
    | "text"
    | "error";
  value: string;
  start: number;
  end: number;
  line: number;
  column: number;
  metadata?: Record<string, any>;
}

export interface HighlightResult {
  tokens: Token[];
  language: string;
  processingTime: number;
  lineCount: number;
  characterCount: number;
  errors: Array<{
    line: number;
    column: number;
    message: string;
    type: "error" | "warning";
  }>;
}

export interface ViewportInfo {
  startLine: number;
  endLine: number;
  scrollTop: number;
  visibleHeight: number;
  totalHeight: number;
}

export class SyntaxHighlighter extends EventEmitter {
  private config: SyntaxHighlighterConfig;
  private container: HTMLElement | null = null;
  private content: string = "";
  private currentLanguage: string = "";
  private highlightResult: HighlightResult | null = null;

  // Performance optimization
  private tokenCache: Map<string, Token[]> = new Map();
  private renderQueue: Array<{ start: number; end: number }> = [];
  private isHighlighting: boolean = false;
  private debounceTimer: NodeJS.Timeout | null = null;
  private animationFrame: number | null = null;

  // Language definitions
  private languages: Map<string, LanguageDefinition> = new Map();

  // DOM elements
  private elements: {
    codeContainer?: HTMLElement;
    lineNumbers?: HTMLElement;
    minimap?: HTMLElement;
    viewport?: HTMLElement;
  } = {};

  // Viewport management
  private viewportInfo: ViewportInfo = {
    startLine: 0,
    endLine: 0,
    scrollTop: 0,
    visibleHeight: 0,
    totalHeight: 0,
  };

  // Performance metrics
  private metrics = {
    totalHighlightTime: 0,
    averageHighlightTime: 0,
    cacheHitRate: 0,
    memoryUsage: 0,
    renderedLines: 0,
    totalLines: 0,
  };

  constructor(config?: Partial<SyntaxHighlighterConfig>) {
    super();

    this.config = {
      supportedLanguages: config?.supportedLanguages ?? [
        "typescript",
        "javascript",
        "python",
        "java",
        "cpp",
        "c",
        "go",
        "rust",
        "php",
        "ruby",
        "swift",
        "kotlin",
        "dart",
        "html",
        "css",
        "scss",
        "json",
        "yaml",
        "xml",
        "markdown",
        "bash",
        "shell",
        "sql",
        "docker",
        "nginx",
      ],
      defaultLanguage: config?.defaultLanguage ?? "javascript",
      autoDetectLanguage: config?.autoDetectLanguage ?? true,
      enableIncrementalHighlighting:
        config?.enableIncrementalHighlighting ?? true,
      enableVirtualScrolling: config?.enableVirtualScrolling ?? true,
      maxHighlightLength: config?.maxHighlightLength ?? 100000,
      debounceMs: config?.debounceMs ?? 300,
      chunkSize: config?.chunkSize ?? 1000,
      theme: config?.theme ?? "auto",
      enableLineNumbers: config?.enableLineNumbers ?? true,
      enableWordWrap: config?.enableWordWrap ?? false,
      fontSize: config?.fontSize ?? 14,
      lineHeight: config?.lineHeight ?? 1.4,
      enableErrorHighlighting: config?.enableErrorHighlighting ?? true,
      enableBracketMatching: config?.enableBracketMatching ?? true,
      enableFolding: config?.enableFolding ?? false,
      enableMinimap: config?.enableMinimap ?? false,
      enableHighContrast: config?.enableHighContrast ?? false,
      enableScreenReaderSupport: config?.enableScreenReaderSupport ?? true,
      respectMotionPreference: config?.respectMotionPreference ?? true,
    };

    this.initializeLanguages();
    this.injectStyles();
  }

  /**
   * Mount syntax highlighter to container
   */
  mount(container: HTMLElement): void {
    this.container = container;
    this.setupContainer();
    this.createElements();

    if (this.content) {
      this.highlight(this.content, this.currentLanguage);
    }
  }

  /**
   * Unmount and cleanup
   */
  unmount(): void {
    this.cleanup();
    this.container = null;
  }

  /**
   * Highlight content with specified language
   */
  async highlight(
    content: string,
    language?: string,
    options?: {
      forceUpdate?: boolean;
      viewport?: ViewportInfo;
    },
  ): Promise<HighlightResult> {
    if (this.isHighlighting && !options?.forceUpdate) {
      return Promise.resolve(this.highlightResult || this.createEmptyResult());
    }

    // Store content and language
    this.content = content;
    this.currentLanguage = language || this.detectLanguage(content);

    // Check length limits
    if (content.length > this.config.maxHighlightLength) {
      console.warn(
        `Content too large for highlighting: ${content.length} chars`,
      );
      return this.createEmptyResult();
    }

    // Use debounced highlighting for performance
    return new Promise((resolve) => {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = setTimeout(async () => {
        try {
          const result = await this.performHighlight(
            content,
            this.currentLanguage,
            options?.viewport,
          );
          resolve(result);
        } catch (error) {
          console.error("[SyntaxHighlighter] Highlighting failed:", error);
          resolve(this.createEmptyResult());
        }
      }, this.config.debounceMs);
    });
  }

  /**
   * Update viewport for virtual scrolling
   */
  updateViewport(viewport: ViewportInfo): void {
    this.viewportInfo = viewport;

    if (this.config.enableVirtualScrolling && this.highlightResult) {
      this.renderVisibleLines();
    }
  }

  /**
   * Set language manually
   */
  setLanguage(language: string): void {
    if (this.config.supportedLanguages.includes(language)) {
      this.currentLanguage = language;

      if (this.content) {
        this.highlight(this.content, language, { forceUpdate: true });
      }

      this.emit("language-changed", language);
    }
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): LanguageDefinition[] {
    return Array.from(this.languages.values());
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<SyntaxHighlighterConfig>): void {
    Object.assign(this.config, updates);

    // Reapply theme if changed
    if (updates.theme || updates.enableHighContrast) {
      this.applyTheme();
    }

    // Re-render if visual settings changed
    if (updates.fontSize || updates.lineHeight || updates.enableLineNumbers) {
      this.render();
    }

    this.emit("config-updated", this.config);
  }

  /**
   * Get performance metrics
   */
  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.tokenCache.clear();
    this.metrics.cacheHitRate = 0;
    this.emit("cache-cleared");
  }

  // Private methods

  private async performHighlight(
    content: string,
    language: string,
    viewport?: ViewportInfo,
  ): Promise<HighlightResult> {
    this.isHighlighting = true;
    const startTime = performance.now();

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(content, language);
      const cached = this.tokenCache.get(cacheKey);

      if (cached && !viewport) {
        this.metrics.cacheHitRate = this.metrics.cacheHitRate * 0.9 + 1 * 0.1;

        const result: HighlightResult = {
          tokens: cached,
          language,
          processingTime: 0,
          lineCount: content.split("\n").length,
          characterCount: content.length,
          errors: [],
        };

        this.highlightResult = result;
        await this.render();

        return result;
      }

      // Get language definition
      const langDef =
        this.languages.get(language) ||
        this.languages.get(this.config.defaultLanguage)!;

      // Tokenize content
      const tokens = await this.tokenize(content, langDef);

      // Add error highlighting if enabled
      const errors = this.config.enableErrorHighlighting
        ? this.detectErrors(content, language, tokens)
        : [];

      // Cache result
      this.tokenCache.set(cacheKey, tokens);

      // Limit cache size
      if (this.tokenCache.size > 100) {
        const firstKey = this.tokenCache.keys().next().value;
        this.tokenCache.delete(firstKey);
      }

      const processingTime = performance.now() - startTime;

      const result: HighlightResult = {
        tokens,
        language,
        processingTime,
        lineCount: content.split("\n").length,
        characterCount: content.length,
        errors,
      };

      // Update metrics
      this.metrics.totalHighlightTime += processingTime;
      this.metrics.averageHighlightTime =
        this.metrics.averageHighlightTime * 0.9 + processingTime * 0.1;
      this.metrics.memoryUsage = this.estimateMemoryUsage();
      this.metrics.totalLines = result.lineCount;

      this.highlightResult = result;

      // Render result
      await this.render();

      this.emit("highlighted", result);

      return result;
    } catch (error) {
      console.error("[SyntaxHighlighter] Tokenization failed:", error);
      return this.createEmptyResult();
    } finally {
      this.isHighlighting = false;
    }
  }

  private async tokenize(
    content: string,
    langDef: LanguageDefinition,
  ): Promise<Token[]> {
    const tokens: Token[] = [];
    const lines = content.split("\n");

    // Process in chunks for performance
    const chunkSize = Math.min(this.config.chunkSize, lines.length);

    for (let i = 0; i < lines.length; i += chunkSize) {
      const chunk = lines.slice(i, i + chunkSize);
      const chunkTokens = await this.tokenizeChunk(chunk, i, langDef);
      tokens.push(...chunkTokens);

      // Yield control to prevent blocking
      if (i % (chunkSize * 5) === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    return tokens;
  }

  private async tokenizeChunk(
    lines: string[],
    startLineNumber: number,
    langDef: LanguageDefinition,
  ): Promise<Token[]> {
    const tokens: Token[] = [];

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const lineNumber = startLineNumber + lineIndex;

      const lineTokens = this.tokenizeLine(line, lineNumber, langDef);
      tokens.push(...lineTokens);
    }

    return tokens;
  }

  private tokenizeLine(
    line: string,
    lineNumber: number,
    langDef: LanguageDefinition,
  ): Token[] {
    const tokens: Token[] = [];
    let position = 0;

    while (position < line.length) {
      const remaining = line.slice(position);

      // Skip whitespace
      const whitespaceMatch = remaining.match(/^\s+/);
      if (whitespaceMatch) {
        position += whitespaceMatch[0].length;
        continue;
      }

      // Try to match each pattern
      let matched = false;

      // Comments
      const commentMatch = remaining.match(langDef.patterns.comment);
      if (commentMatch) {
        tokens.push(
          this.createToken(
            "comment",
            commentMatch[0],
            position,
            position + commentMatch[0].length,
            lineNumber,
            position,
          ),
        );
        position += commentMatch[0].length;
        matched = true;
        continue;
      }

      // Strings
      const stringMatch = remaining.match(langDef.patterns.string);
      if (stringMatch) {
        tokens.push(
          this.createToken(
            "string",
            stringMatch[0],
            position,
            position + stringMatch[0].length,
            lineNumber,
            position,
          ),
        );
        position += stringMatch[0].length;
        matched = true;
        continue;
      }

      // Numbers
      const numberMatch = remaining.match(langDef.patterns.number);
      if (numberMatch) {
        tokens.push(
          this.createToken(
            "number",
            numberMatch[0],
            position,
            position + numberMatch[0].length,
            lineNumber,
            position,
          ),
        );
        position += numberMatch[0].length;
        matched = true;
        continue;
      }

      // Functions
      const functionMatch = remaining.match(langDef.patterns.function);
      if (functionMatch) {
        tokens.push(
          this.createToken(
            "function",
            functionMatch[0],
            position,
            position + functionMatch[0].length,
            lineNumber,
            position,
          ),
        );
        position += functionMatch[0].length;
        matched = true;
        continue;
      }

      // Classes
      const classMatch = remaining.match(langDef.patterns.class);
      if (classMatch) {
        tokens.push(
          this.createToken(
            "class",
            classMatch[0],
            position,
            position + classMatch[0].length,
            lineNumber,
            position,
          ),
        );
        position += classMatch[0].length;
        matched = true;
        continue;
      }

      // Keywords
      const wordMatch = remaining.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/);
      if (wordMatch) {
        const word = wordMatch[0];
        let tokenType: Token["type"] = "text";

        if (langDef.keywords.includes(word)) {
          tokenType = "keyword";
        } else if (langDef.builtins.includes(word)) {
          tokenType = "builtin";
        }

        tokens.push(
          this.createToken(
            tokenType,
            word,
            position,
            position + word.length,
            lineNumber,
            position,
          ),
        );
        position += word.length;
        matched = true;
        continue;
      }

      // Operators
      const operatorMatch = remaining.match(/^[+\-*/%=<>!&|^~?:;,.(){}[\]]/);
      if (operatorMatch) {
        const operator = operatorMatch[0];
        const tokenType = langDef.operators.includes(operator)
          ? "operator"
          : "text";

        tokens.push(
          this.createToken(
            tokenType,
            operator,
            position,
            position + operator.length,
            lineNumber,
            position,
          ),
        );
        position += operator.length;
        matched = true;
        continue;
      }

      // Default: single character
      if (!matched) {
        tokens.push(
          this.createToken(
            "text",
            remaining[0],
            position,
            position + 1,
            lineNumber,
            position,
          ),
        );
        position += 1;
      }
    }

    return tokens;
  }

  private createToken(
    type: Token["type"],
    value: string,
    start: number,
    end: number,
    line: number,
    column: number,
  ): Token {
    return {
      type,
      value,
      start,
      end,
      line,
      column,
    };
  }

  private detectLanguage(content: string): string {
    if (!this.config.autoDetectLanguage) {
      return this.config.defaultLanguage;
    }

    // Simple heuristic-based detection
    const lines = content.split("\n").slice(0, 10); // Check first 10 lines

    // TypeScript/JavaScript patterns
    if (
      lines.some(
        (line) =>
          line.includes("interface ") ||
          line.includes("type ") ||
          line.includes(": string") ||
          line.includes(": number") ||
          (line.includes("import ") && line.includes(" from ")),
      )
    ) {
      return "typescript";
    }

    if (
      lines.some(
        (line) =>
          line.includes("function ") ||
          line.includes("const ") ||
          line.includes("let ") ||
          line.includes("var ") ||
          line.includes("console.log"),
      )
    ) {
      return "javascript";
    }

    // Python patterns
    if (
      lines.some(
        (line) =>
          line.includes("def ") ||
          (line.includes("import ") && !line.includes(" from ")) ||
          line.includes("print(") ||
          line.match(/^class \w+.*:$/),
      )
    ) {
      return "python";
    }

    // HTML patterns
    if (
      content.includes("<html") ||
      content.includes("<!DOCTYPE") ||
      content.includes("<div")
    ) {
      return "html";
    }

    // CSS patterns
    if (
      content.includes("{") &&
      content.includes(":") &&
      content.includes(";") &&
      lines.some(
        (line) => line.match(/^[.#]?\w+.*{$/) || line.includes("@media"),
      )
    ) {
      return "css";
    }

    // JSON patterns
    if (
      (content.trim().startsWith("{") && content.trim().endsWith("}")) ||
      (content.trim().startsWith("[") && content.trim().endsWith("]"))
    ) {
      try {
        JSON.parse(content);
        return "json";
      } catch {
        // Not valid JSON
      }
    }

    return this.config.defaultLanguage;
  }

  private detectErrors(
    content: string,
    language: string,
    tokens: Token[],
  ): HighlightResult["errors"] {
    const errors: HighlightResult["errors"] = [];

    if (language === "javascript" || language === "typescript") {
      // Simple syntax error detection
      const lines = content.split("\n");

      lines.forEach((line, index) => {
        // Unclosed brackets
        const openBrackets = (line.match(/[({[]/g) || []).length;
        const closeBrackets = (line.match(/[)}\]]/g) || []).length;

        if (openBrackets !== closeBrackets) {
          errors.push({
            line: index + 1,
            column: line.length,
            message: "Mismatched brackets",
            type: "warning",
          });
        }

        // Missing semicolons (simplified)
        if (
          line.trim().match(/^(let|const|var|return)\s.*[^;{]$/) &&
          !line.includes("//")
        ) {
          errors.push({
            line: index + 1,
            column: line.length,
            message: "Missing semicolon",
            type: "warning",
          });
        }
      });
    }

    return errors;
  }

  private async render(): Promise<void> {
    if (!this.container || !this.highlightResult) {
      return;
    }

    const startTime = performance.now();

    if (this.config.enableVirtualScrolling) {
      await this.renderVisibleLines();
    } else {
      await this.renderAllLines();
    }

    const renderTime = performance.now() - startTime;

    this.emit("rendered", {
      renderTime,
      linesRendered: this.metrics.renderedLines,
      totalLines: this.metrics.totalLines,
    });
  }

  private async renderVisibleLines(): Promise<void> {
    if (!this.elements.codeContainer || !this.highlightResult) {
      return;
    }

    const { startLine, endLine } = this.viewportInfo;
    const visibleTokens = this.highlightResult.tokens.filter(
      (token) => token.line >= startLine && token.line <= endLine,
    );

    // Clear container
    this.elements.codeContainer.innerHTML = "";

    // Render visible lines
    const fragment = document.createDocumentFragment();
    const renderedLines = new Set<number>();

    for (const token of visibleTokens) {
      if (!renderedLines.has(token.line)) {
        const lineElement = this.createLineElement(token.line);
        fragment.appendChild(lineElement);
        renderedLines.add(token.line);
      }

      const lineElement = fragment.querySelector(
        `[data-line="${token.line}"]`,
      ) as HTMLElement;
      if (lineElement) {
        const tokenElement = this.createTokenElement(token);
        lineElement.appendChild(tokenElement);
      }
    }

    this.elements.codeContainer.appendChild(fragment);
    this.metrics.renderedLines = renderedLines.size;

    // Update line numbers if enabled
    if (this.config.enableLineNumbers && this.elements.lineNumbers) {
      this.renderLineNumbers(startLine, endLine);
    }
  }

  private async renderAllLines(): Promise<void> {
    if (!this.elements.codeContainer || !this.highlightResult) {
      return;
    }

    // Clear container
    this.elements.codeContainer.innerHTML = "";

    // Group tokens by line
    const lineGroups = new Map<number, Token[]>();

    for (const token of this.highlightResult.tokens) {
      if (!lineGroups.has(token.line)) {
        lineGroups.set(token.line, []);
      }
      lineGroups.get(token.line)!.push(token);
    }

    // Render lines in chunks to avoid blocking
    const lines = Array.from(lineGroups.keys()).sort((a, b) => a - b);
    const chunkSize = 50;

    for (let i = 0; i < lines.length; i += chunkSize) {
      const chunk = lines.slice(i, i + chunkSize);
      await this.renderLineChunk(chunk, lineGroups);

      // Yield control
      if (i % (chunkSize * 2) === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    this.metrics.renderedLines = lines.length;

    // Update line numbers
    if (this.config.enableLineNumbers && this.elements.lineNumbers) {
      this.renderLineNumbers(1, lines.length);
    }
  }

  private async renderLineChunk(
    lines: number[],
    lineGroups: Map<number, Token[]>,
  ): Promise<void> {
    const fragment = document.createDocumentFragment();

    for (const lineNumber of lines) {
      const tokens = lineGroups.get(lineNumber) || [];
      const lineElement = this.createLineElement(lineNumber);

      for (const token of tokens) {
        const tokenElement = this.createTokenElement(token);
        lineElement.appendChild(tokenElement);
      }

      fragment.appendChild(lineElement);
    }

    this.elements.codeContainer?.appendChild(fragment);
  }

  private createLineElement(lineNumber: number): HTMLElement {
    const lineElement = document.createElement("div");
    lineElement.className = "syntax-line";
    lineElement.setAttribute("data-line", lineNumber.toString());

    // Add error highlighting if needed
    if (
      this.highlightResult?.errors.some((error) => error.line === lineNumber)
    ) {
      lineElement.classList.add("syntax-line-error");
    }

    return lineElement;
  }

  private createTokenElement(token: Token): HTMLElement {
    const tokenElement = document.createElement("span");
    tokenElement.className = `syntax-token syntax-token-${token.type}`;
    tokenElement.textContent = token.value;

    // Add error highlighting for specific tokens
    if (token.type === "error") {
      tokenElement.classList.add("syntax-error");
      tokenElement.title = token.metadata?.error || "Syntax error";
    }

    // Accessibility
    if (this.config.enableScreenReaderSupport) {
      tokenElement.setAttribute("role", "text");
      if (token.type !== "text") {
        tokenElement.setAttribute("data-token-type", token.type);
      }
    }

    return tokenElement;
  }

  private renderLineNumbers(startLine: number, endLine: number): void {
    if (!this.elements.lineNumbers) {
      return;
    }

    this.elements.lineNumbers.innerHTML = "";

    const fragment = document.createDocumentFragment();

    for (let lineNumber = startLine; lineNumber <= endLine; lineNumber++) {
      const lineNumberElement = document.createElement("div");
      lineNumberElement.className = "line-number";
      lineNumberElement.textContent = lineNumber.toString();
      lineNumberElement.setAttribute("data-line", lineNumber.toString());

      fragment.appendChild(lineNumberElement);
    }

    this.elements.lineNumbers.appendChild(fragment);
  }

  private setupContainer(): void {
    if (!this.container) {
      return;
    }

    this.container.className = "syntax-highlighter";
    this.container.setAttribute("role", "textbox");
    this.container.setAttribute("aria-multiline", "true");
    this.container.setAttribute("aria-readonly", "true");

    this.applyTheme();
  }

  private createElements(): void {
    if (!this.container) {
      return;
    }

    // Main code container
    this.elements.codeContainer = document.createElement("div");
    this.elements.codeContainer.className = "syntax-code-container";

    // Line numbers
    if (this.config.enableLineNumbers) {
      this.elements.lineNumbers = document.createElement("div");
      this.elements.lineNumbers.className = "syntax-line-numbers";
    }

    // Minimap
    if (this.config.enableMinimap) {
      this.elements.minimap = document.createElement("div");
      this.elements.minimap.className = "syntax-minimap";
    }

    // Viewport for virtual scrolling
    if (this.config.enableVirtualScrolling) {
      this.elements.viewport = document.createElement("div");
      this.elements.viewport.className = "syntax-viewport";
      this.elements.viewport.appendChild(this.elements.codeContainer);
    }

    // Append elements
    if (this.elements.lineNumbers) {
      this.container.appendChild(this.elements.lineNumbers);
    }

    if (this.elements.viewport) {
      this.container.appendChild(this.elements.viewport);
    } else {
      this.container.appendChild(this.elements.codeContainer);
    }

    if (this.elements.minimap) {
      this.container.appendChild(this.elements.minimap);
    }
  }

  private applyTheme(): void {
    if (!this.container) {
      return;
    }

    const isDark =
      this.config.theme === "dark" ||
      (this.config.theme === "auto" && this.prefersDarkMode());

    this.container.classList.toggle("syntax-theme-dark", isDark);
    this.container.classList.toggle("syntax-theme-light", !isDark);
    this.container.classList.toggle(
      "syntax-high-contrast",
      this.config.enableHighContrast,
    );

    // Apply font settings
    this.container.style.fontSize = `${this.config.fontSize}px`;
    this.container.style.lineHeight = this.config.lineHeight.toString();
  }

  private initializeLanguages(): void {
    // TypeScript
    this.languages.set("typescript", {
      id: "typescript",
      name: "TypeScript",
      extensions: [".ts", ".tsx"],
      keywords: [
        "abstract",
        "any",
        "as",
        "asserts",
        "async",
        "await",
        "boolean",
        "break",
        "case",
        "catch",
        "class",
        "const",
        "constructor",
        "continue",
        "declare",
        "default",
        "delete",
        "do",
        "else",
        "enum",
        "export",
        "extends",
        "false",
        "finally",
        "for",
        "from",
        "function",
        "get",
        "if",
        "implements",
        "import",
        "in",
        "instanceof",
        "interface",
        "is",
        "keyof",
        "let",
        "module",
        "namespace",
        "never",
        "new",
        "null",
        "number",
        "object",
        "of",
        "package",
        "private",
        "protected",
        "public",
        "readonly",
        "require",
        "return",
        "set",
        "static",
        "string",
        "super",
        "switch",
        "symbol",
        "this",
        "throw",
        "true",
        "try",
        "type",
        "typeof",
        "undefined",
        "unknown",
        "var",
        "void",
        "while",
        "with",
        "yield",
      ],
      operators: [
        "+",
        "-",
        "*",
        "/",
        "%",
        "=",
        "==",
        "===",
        "!=",
        "!==",
        "<",
        ">",
        "<=",
        ">=",
        "&&",
        "||",
        "!",
        "&",
        "|",
        "^",
        "~",
        "<<",
        ">>",
        ">>>",
        "?",
        ":",
        ";",
        ",",
        ".",
        "(",
        ")",
        "[",
        "]",
        "{",
        "}",
        "=>",
        "...",
        "++",
        "--",
        "+=",
        "-=",
        "*=",
        "/=",
        "%=",
        "&=",
        "|=",
        "^=",
        "<<=",
        ">>=",
        ">>>=",
      ],
      builtins: [
        "console",
        "process",
        "global",
        "window",
        "document",
        "Array",
        "Object",
        "String",
        "Number",
        "Boolean",
        "Date",
        "RegExp",
        "Error",
        "Promise",
        "Map",
        "Set",
        "WeakMap",
        "WeakSet",
        "Symbol",
        "Proxy",
        "Reflect",
        "JSON",
        "Math",
      ],
      patterns: {
        comment: /^\/\/.*|\/\*[\s\S]*?\*\//,
        string:
          /^"(?:[^"\\]|\\.)*"|^'(?:[^'\\]|\\.)*'|^`(?:[^`\\]|\\.|\$\{[^}]*\})*`/,
        number:
          /^0x[0-9a-fA-F]+|^0b[01]+|^0o[0-7]+|^\d+\.?\d*(?:[eE][+-]?\d+)?/,
        function: /^[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\()/,
        class: /^class\s+[a-zA-Z_$][a-zA-Z0-9_$]*/,
        import: /^import\s+.*?from\s+.*?;?/,
      },
      brackets: [
        { open: "(", close: ")" },
        { open: "[", close: "]" },
        { open: "{", close: "}" },
      ],
    });

    // JavaScript (simplified version of TypeScript)
    const jsLang = { ...this.languages.get("typescript")! };
    jsLang.id = "javascript";
    jsLang.name = "JavaScript";
    jsLang.extensions = [".js", ".jsx"];
    jsLang.keywords = jsLang.keywords.filter(
      (k) =>
        ![
          "interface",
          "type",
          "declare",
          "abstract",
          "implements",
          "private",
          "protected",
          "public",
          "readonly",
        ].includes(k),
    );
    this.languages.set("javascript", jsLang);

    // Add more languages as needed...
    // This is a simplified implementation - in a real system, you'd want more comprehensive language definitions
  }

  private generateCacheKey(content: string, language: string): string {
    // Simple hash function for cache key
    let hash = 0;
    const str = `${language}:${content}`;

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return hash.toString(36);
  }

  private createEmptyResult(): HighlightResult {
    return {
      tokens: [],
      language: this.currentLanguage || this.config.defaultLanguage,
      processingTime: 0,
      lineCount: 0,
      characterCount: 0,
      errors: [],
    };
  }

  private estimateMemoryUsage(): number {
    let size = 0;

    // Estimate token cache size
    for (const tokens of this.tokenCache.values()) {
      size += tokens.length * 100; // Rough estimate per token
    }

    // Estimate content size
    size += this.content.length * 2; // UTF-16

    return size;
  }

  private prefersDarkMode(): boolean {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  private injectStyles(): void {
    if (document.getElementById("syntax-highlighter-styles")) {
      return;
    }

    const styles = document.createElement("style");
    styles.id = "syntax-highlighter-styles";
    styles.textContent = `
      .syntax-highlighter {
        display: flex;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        background: var(--syntax-bg, #1e1e1e);
        color: var(--syntax-fg, #d4d4d4);
        overflow: hidden;
        border-radius: 4px;
      }
      
      .syntax-theme-dark {
        --syntax-bg: #1e1e1e;
        --syntax-fg: #d4d4d4;
        --syntax-keyword: #569cd6;
        --syntax-string: #ce9178;
        --syntax-comment: #6a9955;
        --syntax-number: #b5cea8;
        --syntax-function: #dcdcaa;
        --syntax-class: #4ec9b0;
        --syntax-operator: #d4d4d4;
        --syntax-builtin: #4fc1ff;
        --syntax-error: #f44747;
        --syntax-line-number: #858585;
      }
      
      .syntax-theme-light {
        --syntax-bg: #ffffff;
        --syntax-fg: #000000;
        --syntax-keyword: #0000ff;
        --syntax-string: #a31515;
        --syntax-comment: #008000;
        --syntax-number: #09885a;
        --syntax-function: #795e26;
        --syntax-class: #267f99;
        --syntax-operator: #000000;
        --syntax-builtin: #001080;
        --syntax-error: #cd3131;
        --syntax-line-number: #6e6e6e;
      }
      
      .syntax-line-numbers {
        background: var(--syntax-bg);
        border-right: 1px solid var(--syntax-line-number);
        padding: 0 8px;
        user-select: none;
        min-width: 40px;
        text-align: right;
      }
      
      .line-number {
        color: var(--syntax-line-number);
        line-height: inherit;
        font-size: inherit;
        padding: 0;
        margin: 0;
      }
      
      .syntax-code-container {
        flex: 1;
        overflow: auto;
        padding: 0 8px;
      }
      
      .syntax-viewport {
        flex: 1;
        overflow: auto;
        position: relative;
      }
      
      .syntax-line {
        line-height: inherit;
        min-height: 1em;
        white-space: pre;
      }
      
      .syntax-line-error {
        background: rgba(244, 71, 71, 0.1);
        border-left: 3px solid var(--syntax-error);
        padding-left: 5px;
        margin-left: -8px;
      }
      
      .syntax-token-keyword {
        color: var(--syntax-keyword);
        font-weight: bold;
      }
      
      .syntax-token-string {
        color: var(--syntax-string);
      }
      
      .syntax-token-comment {
        color: var(--syntax-comment);
        font-style: italic;
      }
      
      .syntax-token-number {
        color: var(--syntax-number);
      }
      
      .syntax-token-function {
        color: var(--syntax-function);
      }
      
      .syntax-token-class {
        color: var(--syntax-class);
        font-weight: bold;
      }
      
      .syntax-token-operator {
        color: var(--syntax-operator);
      }
      
      .syntax-token-builtin {
        color: var(--syntax-builtin);
      }
      
      .syntax-error {
        color: var(--syntax-error);
        text-decoration: underline wavy var(--syntax-error);
      }
      
      .syntax-minimap {
        width: 100px;
        background: var(--syntax-bg);
        border-left: 1px solid var(--syntax-line-number);
        overflow: hidden;
      }
      
      .syntax-high-contrast .syntax-token-keyword {
        border: 1px solid var(--syntax-keyword);
        background: rgba(86, 156, 214, 0.1);
      }
      
      .syntax-high-contrast .syntax-token-string {
        border: 1px solid var(--syntax-string);
        background: rgba(206, 145, 120, 0.1);
      }
      
      @media (prefers-reduced-motion: reduce) {
        .syntax-highlighter *,
        .syntax-highlighter *::before,
        .syntax-highlighter *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }
    `;

    document.head.appendChild(styles);
  }

  private cleanup(): void {
    // Clear debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Clear animation frame
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    // Clear cache
    this.tokenCache.clear();

    // Clear elements
    this.elements = {};

    // Remove event listeners
    this.removeAllListeners();
  }
}

export default SyntaxHighlighter;
