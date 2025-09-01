/**
 * Intent Analysis Engine
 * Analyzes user input to determine development intent and requirements
 */

export interface UserIntent {
  _action: "create" | "modify" | "refactor" | "test" | "document";
  _target: FileTarget;
  _scope: "file" | "module" | "feature" | "project";
  _language: string;
  _framework?: string;
  _priority: "low" | "medium" | "high";
  _complexity: "simple" | "moderate" | "complex";
}

export interface FileTarget {
  _type:
    | "component"
    | "service"
    | "util"
    | "test"
    | "config"
    | "docs"
    | "model"
    | "controller"
    | "middleware";
  _name: string;
  _suggestedPath: string;
  _dependencies: string[];
  _relatedFiles: string[];
  _interfaces: string[];
}

export interface IntentAnalysisContext {
  projectType: string;
  existingFiles: string[];
  _dependencies: string[];
  _frameworks: string[];
  conventions: NamingConventions;
  architecture: ArchitecturePattern;
}

export interface NamingConventions {
  caseStyle: "camelCase" | "PascalCase" | "snake_case" | "kebab-case";
  fileExtensions: string[];
  directoryStructure: "flat" | "nested" | "feature-based" | "_domain-driven";
}

export interface ArchitecturePattern {
  _type: "mvc" | "mvvm" | "clean" | "hexagonal" | "layered" | "microservices";
  layers: string[];
  conventions: Record<string, any>;
}

export class IntentAnalyzer {
  private static instance: IntentAnalyzer;
  private knowledgeBase: Map<string, IntentPattern>;
  private contextHistory: IntentAnalysisContext[];

  private constructor() {
    this.knowledgeBase = new Map();
    this.contextHistory = [];
    this.initializeKnowledgeBase();
  }

  public static getInstance(): IntentAnalyzer {
    if (!IntentAnalyzer.instance) {
      IntentAnalyzer.instance = new IntentAnalyzer();
    }
    return IntentAnalyzer.instance;
  }

  /**
   * Analyze user input to extract development intent
   */
  public async analyzeIntent(
    input: string,
    context: IntentAnalysisContext,
  ): Promise<UserIntent> {
    // Store context for future analysis
    this.contextHistory.push(context);

    // Normalize and tokenize input
    const _tokens = this.tokenizeInput(input.toLowerCase());

    // Detect _action _type
    const _action = this.detectAction(_tokens);

    // Extract _target information
    const _target = await this.extractTarget(input, _tokens, context);

    // Determine _scope
    const _scope = this.determineScope(_tokens, _target, context);

    // Detect _language and _framework
    const _language = this.detectLanguage(_tokens, context);
    const _framework = this.detectFramework(_tokens, context);

    // Assess _priority and _complexity
    const _priority = this.assessPriority(_tokens);
    const _complexity = this.assessComplexity(input, _target, context);

    return {
      _action,
      _target,
      _scope,
      _language,
      _framework,
      _priority,
      _complexity,
    };
  }

  /**
   * Initialize knowledge base with common patterns
   */
  private initializeKnowledgeBase(): void {
    const patterns: IntentPattern[] = [
      // React patterns
      {
        keywords: ["component", "react", "jsx", "tsx"],
        _action: "create",
        _type: "component",
        _language: "typescript",
        _framework: "react",
      },
      // API patterns
      {
        keywords: ["api", "endpoint", "route", "controller"],
        _action: "create",
        _type: "controller",
        _language: "typescript",
        _framework: "express",
      },
      // Service patterns
      {
        keywords: ["service", "business", "logic", "operations"],
        _action: "create",
        _type: "service",
        _language: "typescript",
        _framework: undefined,
      },
      // Authentication patterns
      {
        keywords: ["auth", "authentication", "login", "user", "session"],
        _action: "create",
        _type: "service",
        _language: "typescript",
        _framework: "express",
      },
      // Database patterns
      {
        keywords: ["database", "db", "model", "schema", "entity"],
        _action: "create",
        _type: "model",
        _language: "typescript",
        _framework: "prisma",
      },
      // Testing patterns
      {
        keywords: ["test", "spec", "unit", "integration", "e2e"],
        _action: "test",
        _type: "test",
        _language: "typescript",
        _framework: "jest",
      },
    ];

    patterns.forEach((pattern) => {
      const _key = pattern.keywords.join("|");
      this.knowledgeBase.set(_key, pattern);
    });
  }

  /**
   * Tokenize input string
   */
  private tokenizeInput(input: string): string[] {
    return input
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2);
  }

  /**
   * Detect _action _type from _tokens
   */
  private detectAction(_tokens: string[]): UserIntent["_action"] {
    const _actionKeywords = {
      create: [
        "create",
        "add",
        "new",
        "generate",
        "build",
        "implement",
        "make",
      ],
      modify: ["update", "change", "edit", "modify", "alter", "fix"],
      refactor: ["refactor", "restructure", "reorganize", "clean"],
      test: ["test", "spec", "check", "validate", "verify"],
      document: ["document", "docs", "readme", "comment", "explain"],
    };

    for (const [_action, keywords] of Object.entries(_actionKeywords)) {
      if (keywords.some((keyword) => _tokens.includes(keyword))) {
        return _action as UserIntent["_action"];
      }
    }

    return "create"; // Default _action
  }

  /**
   * Extract _target information from input
   */
  private async extractTarget(
    input: string,
    _tokens: string[],
    context: IntentAnalysisContext,
  ): Promise<FileTarget> {
    // Detect _target _type
    const _type = this.detectTargetType(_tokens);

    // Extract _name from input
    const _name = this.extractName(input, _type);

    // Generate suggested path
    const _suggestedPath = this.generatePath(_name, _type, context);

    // Analyze _dependencies
    const _dependencies = await this.analyzeDependencies(
      _tokens,
      _type,
      context,
    );

    // Find related files
    const _relatedFiles = this.findRelatedFiles(_name, _type, context);

    // Extract _interfaces
    const _interfaces = this.extractInterfaces(input, _tokens);

    return {
      _type,
      _name,
      _suggestedPath,
      _dependencies,
      _relatedFiles,
      _interfaces,
    };
  }

  /**
   * Detect _target _type from _tokens
   */
  private detectTargetType(_tokens: string[]): FileTarget["_type"] {
    const _typeKeywords = {
      component: ["component", "widget", "element", "view"],
      service: ["service", "manager", "handler", "processor"],
      util: ["util", "helper", "utility", "common"],
      test: ["test", "spec", "e2e", "integration"],
      config: ["config", "settings", "environment", "env"],
      docs: ["docs", "documentation", "readme", "guide"],
      model: ["model", "entity", "schema", "interface"],
      controller: ["controller", "endpoint", "route", "api"],
      middleware: ["middleware", "interceptor", "guard", "filter"],
    };

    for (const [_type, keywords] of Object.entries(_typeKeywords)) {
      if (keywords.some((keyword) => _tokens.includes(keyword))) {
        return _type as FileTarget["_type"];
      }
    }

    return "service"; // Default _type
  }

  /**
   * Extract _name from input
   */
  private extractName(_input: string, _type: FileTarget["_type"]): string {
    // Remove common prefixes/suffixes and extract meaningful _name
    const _cleaned = _input
      .replace(/^(create|add|new|generate|build|implement|make)\s+/i, "")
      .replace(
        /\s+(component|service|util|test|config|docs|model|controller|middleware)$/i,
        "",
      )
      .replace(/[^\w\s]/g, "")
      .trim();

    // Convert to appropriate case
    const _words = _cleaned.split(/\s+/).filter((w) => w.length > 0);
    if (_words.length === 0) {
      return `new${_type.charAt(0).toUpperCase()}${_type.slice(1)}`;
    }

    return _words
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join("");
  }

  /**
   * Generate suggested path for the file
   */
  private generatePath(
    _name: string,
    _type: FileTarget["_type"],
    context: IntentAnalysisContext,
  ): string {
    const _basePath = this.getBasePath(context);
    const _typeDirectory = this.getTypeDirectory(_type, context);
    const _fileName = this.generateFileName(_name, _type, context);

    if (context.conventions.directoryStructure === "feature-based") {
      const _featureName = this.extractFeatureName(_name);
      return `${_basePath}/features/${_featureName}/${_fileName}`;
    } else if (context.conventions.directoryStructure === "_domain-driven") {
      const _domain = this.extractDomain(_name);
      return `${_basePath}/${_domain}/${_typeDirectory}/${_fileName}`;
    } else {
      return `${_basePath}/${_typeDirectory}/${_fileName}`;
    }
  }

  /**
   * Get base source path
   */
  private getBasePath(context: IntentAnalysisContext): string {
    if (context.existingFiles.some((f) => f.includes("/src/"))) {
      return "src";
    }
    if (context.existingFiles.some((f) => f.includes("/lib/"))) {
      return "lib";
    }
    return "src";
  }

  /**
   * Get directory for file _type
   */
  private getTypeDirectory(
    _type: FileTarget["_type"],
    _context: IntentAnalysisContext,
  ): string {
    const _typeDirectories = {
      component: "components",
      service: "services",
      util: "utils",
      test: "__tests__",
      config: "config",
      docs: "docs",
      model: "models",
      controller: "controllers",
      middleware: "middleware",
    };

    return _typeDirectories[_type] || "misc";
  }

  /**
   * Generate file _name with appropriate extension
   */
  private generateFileName(
    _name: string,
    _type: FileTarget["_type"],
    context: IntentAnalysisContext,
  ): string {
    const _extensions = context.conventions.fileExtensions;
    const _primaryExt = _extensions[0] || "ts";

    // Convert to appropriate case
    let _fileName = _name;
    if (context.conventions.caseStyle === "kebab-case") {
      _fileName = _name
        .replace(/([A-Z])/g, "-$1")
        .toLowerCase()
        .replace(/^-/, "");
    } else if (context.conventions.caseStyle === "snake_case") {
      _fileName = _name
        .replace(/([A-Z])/g, "_$1")
        .toLowerCase()
        .replace(/^_/, "");
    } else if (context.conventions.caseStyle === "camelCase") {
      _fileName = name.charAt(0).toLowerCase() + name.slice(1);
    }

    // Add _type suffix if needed
    if (_type !== "component" && !_fileName.toLowerCase().includes(_type)) {
      _fileName += `.${_type}`;
    }

    return `${_fileName}.${_primaryExt}`;
  }

  /**
   * Analyze _dependencies for the _target
   */
  private async analyzeDependencies(
    _tokens: string[],
    _type: FileTarget["_type"],
    context: IntentAnalysisContext,
  ): Promise<string[]> {
    const _dependencies: string[] = [];

    // Framework-specific _dependencies
    if (context.frameworks.includes("react")) {
      dependencies.push("react");
      if (_type === "component") {
        dependencies.push("@types/react");
      }
    }

    if (context.frameworks.includes("express")) {
      dependencies.push("express");
      if (_type === "controller") {
        dependencies.push("@types/express");
      }
    }

    // Common _dependencies based on keywords
    if (
      _tokens.includes("axios") ||
      _tokens.includes("http") ||
      _tokens.includes("api")
    ) {
      dependencies.push("axios");
    }

    if (
      _tokens.includes("uuid") ||
      _tokens.includes("id") ||
      _tokens.includes("identifier")
    ) {
      dependencies.push("uuid", "@types/uuid");
    }

    return [...new Set(_dependencies)];
  }

  /**
   * Find related files in the project
   */
  private findRelatedFiles(
    _name: string,
    _type: FileTarget["_type"],
    context: IntentAnalysisContext,
  ): string[] {
    const related: string[] = [];
    const _nameLower = _name.toLowerCase();

    for (const file of context.existingFiles) {
      const _fileLower = file.toLowerCase();

      // Find files with similar names
      if (
        _fileLower.includes(_nameLower) ||
        _nameLower.includes(_fileLower.replace(/\.[^.]*$/, ""))
      ) {
        related.push(file);
      }

      // Find files in same _domain/feature
      const _fileSegments = file.split("/");
      if (
        _fileSegments.some((segment) =>
          segment.toLowerCase().includes(_nameLower),
        )
      ) {
        related.push(file);
      }
    }

    return related;
  }

  /**
   * Extract _interfaces from input
   */
  private extractInterfaces(_input: string, _tokens: string[]): string[] {
    const _interfaces: string[] = [];

    // Look for interface keywords
    const _interfacePattern = /interface\s+(\w+)/gi;
    let match;
    while ((match = _interfacePattern.exec(_input)) !== null) {
      interfaces.push(match[1]);
    }

    // Look for _type keywords
    const _typePattern = /_type\s+(\w+)/gi;
    while ((match = _typePattern.exec(_input)) !== null) {
      interfaces.push(match[1]);
    }

    return _interfaces;
  }

  /**
   * Determine _scope of the operation
   */
  private determineScope(
    _tokens: string[],
    _target: FileTarget,
    _context: IntentAnalysisContext,
  ): UserIntent["_scope"] {
    if (
      _tokens.includes("project") ||
      _tokens.includes("entire") ||
      _tokens.includes("whole")
    ) {
      return "project";
    }

    if (
      _tokens.includes("feature") ||
      _tokens.includes("module") ||
      _target.relatedFiles.length > 3
    ) {
      return "feature";
    }

    if (_target.relatedFiles.length > 0) {
      return "module";
    }

    return "file";
  }

  /**
   * Detect programming _language
   */
  private detectLanguage(
    _tokens: string[],
    context: IntentAnalysisContext,
  ): string {
    const _languageKeywords = {
      typescript: ["typescript", "ts", "tsx"],
      javascript: ["javascript", "js", "jsx"],
      python: ["python", "py"],
      java: ["java"],
      go: ["go", "golang"],
      rust: ["rust", "rs"],
    };

    for (const [lang, keywords] of Object.entries(_languageKeywords)) {
      if (keywords.some((keyword) => _tokens.includes(keyword))) {
        return lang;
      }
    }

    // Infer from project _type
    if (context.projectType.includes("typescript")) return "typescript";
    if (context.projectType.includes("javascript")) return "javascript";
    if (context.projectType.includes("node")) return "typescript";
    if (context.projectType.includes("react")) return "typescript";

    return "typescript"; // Default
  }

  /**
   * Detect _framework
   */
  private detectFramework(
    _tokens: string[],
    context: IntentAnalysisContext,
  ): string | undefined {
    const _frameworks = [
      "react",
      "vue",
      "angular",
      "express",
      "nestjs",
      "next",
      "nuxt",
    ];

    for (const _framework of _frameworks) {
      if (
        _tokens.includes(_framework) ||
        context._frameworks.includes(_framework)
      ) {
        return _framework;
      }
    }

    return undefined;
  }

  /**
   * Assess _priority level
   */
  private assessPriority(_tokens: string[]): UserIntent["_priority"] {
    const _highPriorityWords = [
      "urgent",
      "critical",
      "important",
      "asap",
      "_priority",
      "blocking",
    ];
    const _lowPriorityWords = [
      "later",
      "eventually",
      "nice",
      "optional",
      "enhancement",
    ];

    if (_highPriorityWords.some((word) => _tokens.includes(word))) {
      return "high";
    }

    if (_lowPriorityWords.some((word) => _tokens.includes(word))) {
      return "low";
    }

    return "medium";
  }

  /**
   * Assess _complexity level
   */
  private assessComplexity(
    input: string,
    _target: FileTarget,
    _context: IntentAnalysisContext,
  ): UserIntent["_complexity"] {
    let complexityScore = 0;

    // Length of description
    if (input.length > 100) complexityScore += 1;
    if (input.length > 300) complexityScore += 1;

    // Number of _dependencies
    if (_target.dependencies.length > 3) complexityScore += 1;
    if (_target.dependencies.length > 7) complexityScore += 1;

    // Number of related files
    if (_target.relatedFiles.length > 2) complexityScore += 1;
    if (_target.relatedFiles.length > 5) complexityScore += 1;

    // Framework _complexity
    if (_target.interfaces.length > 0) complexityScore += 1;

    if (complexityScore >= 4) return "complex";
    if (complexityScore >= 2) return "moderate";
    return "simple";
  }

  /**
   * Extract feature _name from input
   */
  private extractFeatureName(_name: string): string {
    return _name
      .toLowerCase()
      .replace(/([A-Z])/g, "-$1")
      .replace(/^-/, "");
  }

  /**
   * Extract _domain _name from input
   */
  private extractDomain(_name: string): string {
    const _domains = ["user", "auth", "payment", "product", "order", "admin"];
    const _nameLower = _name.toLowerCase();

    for (const _domain of _domains) {
      if (_nameLower.includes(_domain)) {
        return _domain;
      }
    }

    return "common";
  }
}

interface IntentPattern {
  keywords: string[];
  _action: UserIntent["_action"];
  _type: FileTarget["_type"];
  _language: string;
  _framework?: string;
}
