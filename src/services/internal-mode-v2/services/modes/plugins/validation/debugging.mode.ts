/**
 * Debugging Mode Plugin - Error analysis and problem resolution mode
 * Specialized for identifying, analyzing, and resolving bugs and issues
 */

import { BaseMode, ModeConfig, ModeContext, ModeResult } from '../BaseMode.js';

export default class DebuggingMode extends BaseMode {
  constructor() {
    const config: ModeConfig = {
      id: 'debugging',
      name: 'Debugging',
      category: 'validation',
      symbol: '🐛',
      color: 'red',
      description: 'エラー原因特定・修正 - バグ分析と問題解決専門モード',
      keywords: [
        'error',
        'bug',
        'issue',
        'problem',
        'debug',
        'fix',
        'broken',
        'crash',
        'fail',
        'exception',
        'traceback',
        'stack trace',
        'not working',
        'malfunction',
        'glitch',
        'fault',
      ],
      triggers: [
        'error',
        'bug',
        'not working',
        'broken',
        'crash',
        'fails',
        'debug',
        'fix',
        'troubleshoot',
        'resolve',
        'issue',
        'exception',
        'stack trace',
        "doesn't work",
      ],
      examples: [
        'This code is throwing an error',
        'Debug this function that keeps crashing',
        'My application is not working correctly',
        'Help me fix this bug in my program',
        'Analyze this stack trace and find the issue',
      ],
      enabled: true,
      priority: 9, // High priority for debugging
      timeout: 180000, // 3 minutes for thorough debugging
      maxConcurrentSessions: 6,
    };

    super(config);
  }

  protected async onActivate(context: ModeContext): Promise<void> {
    console.log(`[${this.config.id}] Activating debugging mode for session ${context.sessionId}`);

    this.emit('display:update', {
      mode: this.config.id,
      symbol: this.config.symbol,
      text: 'Debugging...',
      color: this.config.color,
      sessionId: context.sessionId,
      animation: 'fade',
    });

    this.emit('analytics:event', {
      type: 'mode_activation',
      mode: this.config.id,
      sessionId: context.sessionId,
      timestamp: context.timestamp,
      metadata: {
        previousMode: context.previousMode,
        errorType: this.classifyErrorType(context.input || ''),
      },
    });
  }

  protected async onDeactivate(sessionId: string): Promise<void> {
    console.log(`[${this.config.id}] Deactivating debugging mode for session ${sessionId}`);

    this.emit('analytics:event', {
      type: 'mode_deactivation',
      mode: this.config.id,
      sessionId,
      timestamp: Date.now(),
    });
  }

  protected async onProcess(input: string, context: ModeContext): Promise<ModeResult> {
    console.log(`[${this.config.id}] Processing debugging request: "${input.substring(0, 50)}..."`);

    // Multi-phase debugging process
    const errorAnalysis = await this.analyzeError(input, context);
    const rootCause = await this.identifyRootCause(errorAnalysis, input);
    const solutions = await this.generateSolutions(rootCause, errorAnalysis);
    const diagnostics = await this.runDiagnostics(input, errorAnalysis);

    const confidence = this.calculateDebuggingConfidence(errorAnalysis, solutions);

    return {
      success: true,
      output: this.formatDebuggingReport(errorAnalysis, rootCause, solutions, diagnostics),
      suggestions: this.generateDebuggingSuggestions(solutions, errorAnalysis),
      nextRecommendedMode: this.determineNextMode(solutions, rootCause),
      confidence,
      metadata: {
        errorAnalysis,
        rootCause,
        solutionsCount: solutions.length,
        errorSeverity: errorAnalysis.severity,
        diagnostics,
        processedAt: Date.now(),
      },
    };
  }

  protected async onCanHandle(
    input: string,
    context: ModeContext,
  ): Promise<{ confidence: number; reasoning: string[] }> {
    const reasoning: string[] = [];
    let confidence = 0;

    const inputLower = input.toLowerCase();

    // Strong error indicators
    const errorIndicators = [
      'error',
      'bug',
      'exception',
      'crash',
      'fail',
      'broken',
      'not working',
      "doesn't work",
      'issue',
      'problem',
    ];

    const errorMatches = errorIndicators.filter((indicator) => inputLower.includes(indicator));
    if (errorMatches.length > 0) {
      confidence += Math.min(0.8, errorMatches.length * 0.3);
      reasoning.push(`Error indicators found: ${errorMatches.join(', ')}`);
    }

    // Technical error patterns
    const techPatterns = [
      /stack trace/i,
      /null pointer/i,
      /undefined.*function/i,
      /syntax error/i,
      /reference error/i,
      /type error/i,
      /cannot read property/i,
      /permission denied/i,
      /connection refused/i,
    ];

    const techMatches = techPatterns.filter((pattern) => pattern.test(input));
    if (techMatches.length > 0) {
      confidence += Math.min(0.6, techMatches.length * 0.2);
      reasoning.push(`Technical error patterns detected: ${techMatches.length} patterns`);
    }

    // Code presence increases debugging relevance
    if (this.containsCode(input)) {
      confidence += 0.2;
      reasoning.push('Code detected - debugging highly relevant');
    }

    // Error messages or logs
    if (this.containsErrorMessage(input)) {
      confidence += 0.3;
      reasoning.push('Error message or log detected');
    }

    // Stack traces
    if (this.containsStackTrace(input)) {
      confidence += 0.4;
      reasoning.push('Stack trace detected');
    }

    // Debugging keywords
    const debugKeywords = ['debug', 'troubleshoot', 'diagnose', 'investigate', 'trace'];
    const debugMatches = debugKeywords.filter((keyword) => inputLower.includes(keyword));
    if (debugMatches.length > 0) {
      confidence += Math.min(0.2, debugMatches.length * 0.1);
      reasoning.push(`Debugging keywords: ${debugMatches.join(', ')}`);
    }

    return { confidence: Math.min(confidence, 1.0), reasoning };
  }

  /**
   * Analyze the error from input
   */
  private async analyzeError(input: string, context: ModeContext): Promise<unknown> {
    return {
      type: this.classifyErrorType(input),
      severity: this.assessErrorSeverity(input),
      language: this.identifyProgrammingLanguage(input),
      environment: this.identifyEnvironment(input),
      stackTrace: this.extractStackTrace(input),
      errorMessage: this.extractErrorMessage(input),
      codeSnippet: this.extractCodeSnippet(input),
      symptoms: this.identifySymptoms(input),
      context: this.analyzeErrorContext(input, context),
    };
  }

  /**
   * Identify root cause of the error
   */
  private async identifyRootCause(errorAnalysis: unknown, input: string): Promise<unknown> {
    const possibleCauses: unknown[] = [];

    // Analyze based on error type
    switch (errorAnalysis.type) {
      case 'syntax':
        possibleCauses.push({
          category: 'syntax',
          description: 'Invalid syntax in code',
          likelihood: 0.9,
          evidence: ['Syntax error message', 'Code parsing failure'],
        });
        break;

      case 'runtime':
        possibleCauses.push({
          category: 'runtime',
          description: 'Runtime execution error',
          likelihood: 0.8,
          evidence: ['Runtime exception', 'Unexpected behavior during execution'],
        });
        break;

      case 'logic':
        possibleCauses.push({
          category: 'logic',
          description: 'Logical error in algorithm or flow',
          likelihood: 0.7,
          evidence: ['Incorrect output', 'Unexpected program behavior'],
        });
        break;

      case 'resource':
        possibleCauses.push({
          category: 'resource',
          description: 'Resource limitation or access issue',
          likelihood: 0.6,
          evidence: ['Memory issues', 'File access problems', 'Network connectivity'],
        });
        break;

      case 'integration':
        possibleCauses.push({
          category: 'integration',
          description: 'Integration or dependency issue',
          likelihood: 0.5,
          evidence: ['API failures', 'Library conflicts', 'Service unavailability'],
        });
        break;
    }

    // Additional analysis based on symptoms
    if (errorAnalysis.stackTrace) {
      possibleCauses.push({
        category: 'exception',
        description: 'Unhandled exception thrown',
        likelihood: 0.8,
        evidence: ['Stack trace present', 'Exception propagation'],
      });
    }

    // Sort by likelihood
    possibleCauses.sort((a, b) => b.likelihood - a.likelihood);

    return {
      primaryCause: possibleCauses[0],
      alternateCauses: possibleCauses.slice(1, 3),
      analysisConfidence: this.calculateRootCauseConfidence(possibleCauses, errorAnalysis),
    };
  }

  /**
   * Generate solutions for the identified root cause
   */
  private async generateSolutions(rootCause: unknown, errorAnalysis: unknown): Promise<unknown[]> {
    const solutions: unknown[] = [];

    if (rootCause.primaryCause) {
      const primarySolutions = this.generateSolutionsForCause(
        rootCause.primaryCause,
        errorAnalysis,
      );
      solutions.push(...primarySolutions);
    }

    // Add alternate solutions
    for (const alternateCause of rootCause.alternateCauses || []) {
      const alternateSolutions = this.generateSolutionsForCause(alternateCause, errorAnalysis);
      solutions.push(...alternateSolutions.map((sol) => ({ ...sol, isAlternate: true })));
    }

    // Add general debugging solutions
    solutions.push(...this.generateGeneralDebuggingSolutions(errorAnalysis));

    return solutions.map((solution, index) => ({
      ...solution,
      priority: this.calculateSolutionPriority(solution, index),
      estimatedEffort: this.estimateImplementationEffort(solution),
      successProbability: this.estimateSuccessProbability(solution, errorAnalysis),
    }));
  }

  /**
   * Generate solutions for specific cause
   */
  private generateSolutionsForCause(cause: unknown, errorAnalysis: unknown): unknown[] {
    const solutions: unknown[] = [];

    switch (cause.category) {
      case 'syntax':
        solutions.push({
          title: 'Fix Syntax Error',
          description: 'Review and correct the syntax error in the code',
          steps: [
            'Check the error message for specific syntax issue',
            'Review the line number mentioned in error',
            'Verify proper use of brackets, semicolons, and keywords',
            'Use IDE syntax highlighting to identify issues',
          ],
          type: 'immediate',
        });
        break;

      case 'runtime':
        solutions.push({
          title: 'Add Error Handling',
          description: 'Implement proper error handling for runtime exceptions',
          steps: [
            'Wrap potentially failing code in try-catch blocks',
            'Add null/undefined checks before operations',
            'Validate input parameters',
            'Implement graceful error recovery',
          ],
          type: 'defensive',
        });
        break;

      case 'logic':
        solutions.push({
          title: 'Review Algorithm Logic',
          description: 'Analyze and correct the logical flow of the program',
          steps: [
            'Trace through the algorithm step by step',
            'Add logging statements to understand flow',
            'Test with simple input cases',
            'Review assumptions and edge cases',
          ],
          type: 'analytical',
        });
        break;

      case 'resource':
        solutions.push({
          title: 'Optimize Resource Usage',
          description: 'Address resource limitations and access issues',
          steps: [
            'Check system resources (memory, disk space)',
            'Verify file/network permissions',
            'Optimize memory allocation',
            'Implement resource cleanup',
          ],
          type: 'optimization',
        });
        break;
    }

    return solutions;
  }

  /**
   * Generate general debugging solutions
   */
  private generateGeneralDebuggingSolutions(errorAnalysis: unknown): unknown[] {
    return [
      {
        title: 'Enable Debug Logging',
        description: 'Add comprehensive logging to understand program flow',
        steps: [
          'Add console.log or print statements at key points',
          'Log variable values and function parameters',
          'Track execution flow through different code paths',
          'Use debugging tools and breakpoints',
        ],
        type: 'diagnostic',
      },
      {
        title: 'Reproduce and Isolate',
        description: 'Create minimal reproduction case to isolate the issue',
        steps: [
          'Create smallest possible test case that reproduces error',
          'Remove unnecessary code and dependencies',
          'Test with different input values',
          'Verify issue occurs consistently',
        ],
        type: 'isolation',
      },
    ];
  }

  /**
   * Run diagnostic checks
   */
  private async runDiagnostics(input: string, errorAnalysis: unknown): Promise<unknown> {
    const diagnostics = {
      codeQuality: this.assessCodeQuality(input),
      errorPatterns: this.identifyCommonErrorPatterns(input),
      bestPractices: this.checkBestPractices(input, errorAnalysis),
      securityConcerns: this.identifySecurityIssues(input),
      performanceIssues: this.identifyPerformanceIssues(input),
    };

    return diagnostics;
  }

  /**
   * Format debugging report
   */
  private formatDebuggingReport(
    errorAnalysis: unknown,
    rootCause: unknown,
    solutions: unknown[],
    diagnostics: unknown,
  ): string {
    const report = [
      '🐛 DEBUGGING ANALYSIS REPORT',
      '============================',
      '',
      `Error Type: ${errorAnalysis.type}`,
      `Severity: ${errorAnalysis.severity}`,
      `Language: ${errorAnalysis.language}`,
      `Environment: ${errorAnalysis.environment}`,
      '',
      '🎯 ROOT CAUSE ANALYSIS:',
      `Primary Cause: ${rootCause.primaryCause?.description || 'Unknown'}`,
      `Confidence: ${Math.round(rootCause.analysisConfidence * 100)}%`,
      '',
    ];

    if (errorAnalysis.errorMessage) {
      report.push('📝 ERROR MESSAGE:');
      report.push(errorAnalysis.errorMessage);
      report.push('');
    }

    if (errorAnalysis.stackTrace) {
      report.push('📚 STACK TRACE ANALYSIS:');
      report.push('Key points from stack trace identified');
      report.push('');
    }

    report.push('🔧 RECOMMENDED SOLUTIONS:');
    report.push('');

    solutions.slice(0, 3).forEach((solution, index) => {
      report.push(`${index + 1}. ${solution.title} ${solution.isAlternate ? '(Alternative)' : ''}`);
      report.push(`   ${solution.description}`);
      report.push(
        `   Priority: ${solution.priority} | Success Probability: ${Math.round(solution.successProbability * 100)}%`,
      );
      report.push('   Steps:');
      solution.steps.forEach((step: string, stepIndex: number) => {
        report.push(`   ${stepIndex + 1}) ${step}`);
      });
      report.push('');
    });

    report.push('🔍 DIAGNOSTIC INSIGHTS:');
    if (diagnostics.errorPatterns.length > 0) {
      report.push(`• Common patterns detected: ${diagnostics.errorPatterns.join(', ')}`);
    }
    if (diagnostics.bestPractices.violations.length > 0) {
      report.push(`• Best practice violations: ${diagnostics.bestPractices.violations.length}`);
    }

    report.push('');
    report.push('💡 Remember: Debug systematically - reproduce, isolate, fix, and test!');

    return report.join('\n');
  }

  /**
   * Generate debugging suggestions
   */
  private generateDebuggingSuggestions(solutions: unknown[], errorAnalysis: unknown): string[] {
    const suggestions: string[] = [];

    if (solutions.length > 0) {
      suggestions.push(`Start with: ${solutions[0].title.toLowerCase()}`);
    }

    suggestions.push('Add logging to trace execution flow');
    suggestions.push('Create minimal reproduction case');
    suggestions.push('Check for common error patterns');

    if (errorAnalysis.severity === 'high') {
      suggestions.push('Consider switching to optimization mode after fixing');
    }

    return suggestions.slice(0, 4);
  }

  // Helper methods for error analysis

  private classifyErrorType(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('syntax') || inputLower.includes('parse')) {return 'syntax';}
    if (inputLower.includes('runtime') || inputLower.includes('exception')) {return 'runtime';}
    if (inputLower.includes('logic') || inputLower.includes('wrong result')) {return 'logic';}
    if (inputLower.includes('memory') || inputLower.includes('resource')) {return 'resource';}
    if (inputLower.includes('api') || inputLower.includes('service')) {return 'integration';}

    return 'general';
  }

  private assessErrorSeverity(input: string): string {
    const inputLower = input.toLowerCase();

    if (
      inputLower.includes('crash') ||
      inputLower.includes('critical') ||
      inputLower.includes('fatal')
    ) {
      return 'high';
    }

    if (
      inputLower.includes('error') ||
      inputLower.includes('exception') ||
      inputLower.includes('fail')
    ) {
      return 'medium';
    }

    return 'low';
  }

  private identifyProgrammingLanguage(input: string): string {
    const languages = {
      javascript: [
        'javascript',
        'js',
        'node',
        'npm',
        'console.log',
        'function',
        'var',
        'let',
        'const',
      ],
      python: ['python', 'py', 'def', 'import', 'print', 'traceback'],
      java: ['java', 'class', 'public static', 'System.out', 'exception'],
      csharp: ['c#', 'csharp', 'using', 'Console.WriteLine', 'namespace'],
      php: ['php', '<?php', 'echo', '$'],
      ruby: ['ruby', 'rb', 'puts', 'def', 'end'],
      go: ['golang', 'go', 'func', 'fmt.Print', 'package'],
      rust: ['rust', 'rs', 'fn', 'println!', 'cargo'],
    };

    const inputLower = input.toLowerCase();

    for (const [lang, indicators] of Object.entries(languages)) {
      if (indicators.some((indicator) => inputLower.includes(indicator))) {
        return lang;
      }
    }

    return 'unknown';
  }

  private identifyEnvironment(input: string): string {
    const inputLower = input.toLowerCase();

    if (
      inputLower.includes('browser') ||
      inputLower.includes('chrome') ||
      inputLower.includes('firefox')
    ) {
      return 'browser';
    }

    if (inputLower.includes('node') || inputLower.includes('server')) {
      return 'server';
    }

    if (
      inputLower.includes('mobile') ||
      inputLower.includes('android') ||
      inputLower.includes('ios')
    ) {
      return 'mobile';
    }

    return 'unknown';
  }

  private extractStackTrace(input: string): string | null {
    // Look for stack trace patterns
    const stackTracePatterns = [
      /at .+:\d+:\d+/gm,
      /File ".+", line \d+/gm,
      /\s+at .+\(.+:\d+:\d+\)/gm,
    ];

    for (const pattern of stackTracePatterns) {
      const matches = input.match(pattern);
      if (matches && matches.length > 0) {
        return matches.slice(0, 5).join('\n'); // First 5 lines
      }
    }

    return null;
  }

  private extractErrorMessage(input: string): string | null {
    // Look for error message patterns
    const errorPatterns = [
      /Error: (.+)/i,
      /Exception: (.+)/i,
      /(\w+Error): (.+)/i,
      /Fatal error: (.+)/i,
    ];

    for (const pattern of errorPatterns) {
      const match = input.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  private extractCodeSnippet(input: string): string | null {
    // Look for code blocks or snippets
    const codePatterns = [
      /```[\s\S]*?```/g,
      /`[^`]+`/g,
      /function\s+\w+\s*\([^)]*\)\s*{[\s\S]*?}/g,
    ];

    for (const pattern of codePatterns) {
      const matches = input.match(pattern);
      if (matches && matches.length > 0) {
        return matches[0];
      }
    }

    return null;
  }

  private identifySymptoms(input: string): string[] {
    const symptoms: string[] = [];
    const inputLower = input.toLowerCase();

    const symptomPatterns = {
      crashes: ['crash', 'crashes', 'crashing'],
      freezes: ['freeze', 'freezes', 'frozen', 'hang'],
      slow_performance: ['slow', 'sluggish', 'performance'],
      incorrect_output: ['wrong', 'incorrect', 'unexpected'],
      not_responding: ['not responding', 'unresponsive'],
      memory_issues: ['memory', 'ram', 'out of memory'],
    };

    for (const [symptom, indicators] of Object.entries(symptomPatterns)) {
      if (indicators.some((indicator) => inputLower.includes(indicator))) {
        symptoms.push(symptom);
      }
    }

    return symptoms;
  }

  private analyzeErrorContext(input: string, context: ModeContext): unknown {
    return {
      hasRecentChanges: this.detectRecentChanges(input),
      hasNewDependencies: this.detectNewDependencies(input),
      hasEnvironmentChanges: this.detectEnvironmentChanges(input),
      userActions: this.identifyUserActions(input),
      systemState: this.assessSystemState(input),
    };
  }

  private containsCode(input: string): boolean {
    const codeIndicators = [
      'function',
      'class',
      'def',
      'var',
      'let',
      'const',
      '{',
      '}',
      '()',
      '=>',
      'return',
      'if',
      'for',
      'while',
      'import',
      'export',
      'require',
    ];

    return codeIndicators.some((indicator) => input.includes(indicator));
  }

  private containsErrorMessage(input: string): boolean {
    const errorMessagePatterns = [
      /Error:/i,
      /Exception:/i,
      /Fatal error:/i,
      /Warning:/i,
      /\w+Error:/i,
    ];

    return errorMessagePatterns.some((pattern) => pattern.test(input));
  }

  private containsStackTrace(input: string): boolean {
    const stackTracePatterns = [
      /at .+:\d+:\d+/,
      /File ".+", line \d+/,
      /\s+at .+\(.+:\d+:\d+\)/,
      /Traceback/i,
    ];

    return stackTracePatterns.some((pattern) => pattern.test(input));
  }

  private calculateRootCauseConfidence(causes: unknown[], errorAnalysis: unknown): number {
    if (causes.length === 0) {return 0.3;}

    const primaryCause = causes[0];
    let confidence = primaryCause.likelihood;

    // Boost confidence if we have concrete evidence
    if (errorAnalysis.stackTrace) {confidence += 0.1;}
    if (errorAnalysis.errorMessage) {confidence += 0.1;}
    if (errorAnalysis.codeSnippet) {confidence += 0.05;}

    return Math.min(confidence, 0.95);
  }

  private calculateSolutionPriority(solution: unknown, index: number): string {
    if (index === 0 && !solution.isAlternate) {return 'high';}
    if (index <= 2) {return 'medium';}
    return 'low';
  }

  private estimateImplementationEffort(solution: unknown): string {
    const stepCount = solution.steps?.length || 3;

    if (stepCount <= 2) {return 'low';}
    if (stepCount <= 4) {return 'medium';}
    return 'high';
  }

  private estimateSuccessProbability(solution: unknown, errorAnalysis: unknown): number {
    let probability = 0.7; // Base probability

    if (solution.type === 'immediate') {probability += 0.2;}
    if (solution.type === 'diagnostic') {probability += 0.1;}
    if (errorAnalysis.severity === 'low') {probability += 0.1;}

    return Math.min(probability, 0.95);
  }

  private assessCodeQuality(input: string): unknown {
    return {
      score: Math.random() * 0.4 + 0.6, // Simplified assessment
      issues: ['Missing error handling', 'Unclear variable names'],
    };
  }

  private identifyCommonErrorPatterns(input: string): string[] {
    const patterns: string[] = [];
    const inputLower = input.toLowerCase();

    if (inputLower.includes('null') || inputLower.includes('undefined')) {
      patterns.push('null_undefined_access');
    }

    if (inputLower.includes('index') || inputLower.includes('bounds')) {
      patterns.push('index_out_of_bounds');
    }

    if (inputLower.includes('type')) {
      patterns.push('type_mismatch');
    }

    return patterns;
  }

  private checkBestPractices(input: string, errorAnalysis: unknown): unknown {
    return {
      score: 0.7,
      violations: ['Missing input validation', 'No error handling'],
    };
  }

  private identifySecurityIssues(input: string): string[] {
    // Simplified security check
    return [];
  }

  private identifyPerformanceIssues(input: string): string[] {
    // Simplified performance check
    return [];
  }

  private detectRecentChanges(input: string): boolean {
    return input.toLowerCase().includes('changed') || input.toLowerCase().includes('modified');
  }

  private detectNewDependencies(input: string): boolean {
    return input.toLowerCase().includes('installed') || input.toLowerCase().includes('dependency');
  }

  private detectEnvironmentChanges(input: string): boolean {
    return input.toLowerCase().includes('updated') || input.toLowerCase().includes('environment');
  }

  private identifyUserActions(input: string): string[] {
    // Extract user actions that might have triggered the error
    return ['code_modification', 'dependency_update'];
  }

  private assessSystemState(input: string): unknown {
    return {
      resources: 'normal',
      services: 'running',
      network: 'connected',
    };
  }

  private calculateDebuggingConfidence(errorAnalysis: unknown, solutions: unknown[]): number {
    let confidence = 0.6; // Base confidence

    // More concrete evidence = higher confidence
    if (errorAnalysis.stackTrace) {confidence += 0.2;}
    if (errorAnalysis.errorMessage) {confidence += 0.15;}
    if (errorAnalysis.codeSnippet) {confidence += 0.1;}

    // More solutions = higher confidence in ability to help
    confidence += Math.min(0.1, solutions.length * 0.02);

    return Math.min(confidence, 0.9);
  }

  private determineNextMode(solutions: unknown[], rootCause: unknown): string | undefined {
    // If solutions involve optimization, recommend optimization mode
    const hasOptimizationSolution = solutions.some(
      (sol) => sol.type === 'optimization' || sol.description.toLowerCase().includes('optimize'),
    );

    if (hasOptimizationSolution) {
      return 'optimizing';
    }

    // If solutions involve testing, might recommend validation
    const hasTestingSolution = solutions.some((sol) =>
      sol.steps?.some((step: string) => step.toLowerCase().includes('test')),
    );

    if (hasTestingSolution) {
      return 'validating';
    }

    return undefined;
  }
}
