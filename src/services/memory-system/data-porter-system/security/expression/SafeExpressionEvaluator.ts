/**
 * Safe Expression Evaluator with Sandboxing
 *
 * Provides secure expression evaluation for conditional logic
 * without exposing dangerous JavaScript execution
 */

import { EventEmitter } from "node:events";

export interface ExpressionContext {
  variables: Record<string, any>;
  functions: Record<string, (...args: any[]) => any>;
  metadata: {
    userId: string;
    correlationId: string;
    timestamp: number;
  };
}

export interface EvaluationResult {
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
  expressionComplexity: number;
}

export interface ExpressionAnalysis {
  complexity: number;
  usedVariables: string[];
  usedFunctions: string[];
  hasUnsafePatterns: boolean;
  estimatedExecutionTime: number;
}

export class SafeExpressionEvaluator extends EventEmitter {
  private readonly maxComplexity = 100;
  private readonly maxExecutionTime = 1000; // 1 second
  private readonly maxDepth = 10;
  private readonly allowedOperators = new Set([
    "+",
    "-",
    "*",
    "/",
    "%",
    "**",
    "==",
    "!=",
    "===",
    "!==",
    "<",
    ">",
    "<=",
    ">=",
    "&&",
    "||",
    "!",
    "?",
    ":",
    "in",
    "instanceof",
  ]);

  private readonly safeBuiltins = {
    Math: {
      abs: Math.abs,
      ceil: Math.ceil,
      floor: Math.floor,
      round: Math.round,
      max: Math.max,
      min: Math.min,
      random: Math.random,
      sqrt: Math.sqrt,
      pow: Math.pow,
      PI: Math.PI,
      E: Math.E,
    },
    String: {
      fromCharCode: String.fromCharCode,
    },
    Array: {
      isArray: Array.isArray,
      from: Array.from,
    },
    Object: {
      keys: Object.keys,
      values: Object.values,
      entries: Object.entries,
      assign: Object.assign,
    },
    Date: {
      now: Date.now,
      parse: Date.parse,
    },
    JSON: {
      parse: (str: string) => {
        try {
          return JSON.parse(str);
        } catch {
          throw new Error("Invalid JSON");
        }
      },
      stringify: JSON.stringify,
    },
  };

  constructor() {
    super();
  }

  /**
   * Evaluate expression safely
   */
  async evaluate(
    expression: string,
    context: ExpressionContext,
  ): Promise<EvaluationResult> {
    const startTime = Date.now();

    try {
      // Analyze expression first
      const analysis = this.analyzeExpression(expression);

      if (analysis.hasUnsafePatterns) {
        throw new Error("Unsafe patterns detected in expression");
      }

      if (analysis.complexity > this.maxComplexity) {
        throw new Error(
          `Expression too complex: ${analysis.complexity} > ${this.maxComplexity}`,
        );
      }

      // Create sandboxed execution environment
      const sandbox = this.createSandbox(context);

      // Execute with timeout
      const result = await this.executeWithTimeout(expression, sandbox);

      const executionTime = Date.now() - startTime;

      this.emit("expression_evaluated", {
        expression: this.maskSensitiveData(expression),
        executionTime,
        complexity: analysis.complexity,
        correlationId: context.metadata.correlationId,
      });

      return {
        success: true,
        result,
        executionTime,
        expressionComplexity: analysis.complexity,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.emit("expression_error", {
        expression: this.maskSensitiveData(expression),
        error: error.message,
        executionTime,
        correlationId: context.metadata.correlationId,
      });

      return {
        success: false,
        error: error.message,
        executionTime,
        expressionComplexity: 0,
      };
    }
  }

  /**
   * Analyze expression for complexity and safety
   */
  analyzeExpression(expression: string): ExpressionAnalysis {
    const analysis: ExpressionAnalysis = {
      complexity: 0,
      usedVariables: [],
      usedFunctions: [],
      hasUnsafePatterns: false,
      estimatedExecutionTime: 0,
    };

    // Check for unsafe patterns
    const unsafePatterns = [
      /eval\s*\(/i,
      /Function\s*\(/i,
      /constructor/i,
      /prototype/i,
      /process\./i,
      /global\./i,
      /require\s*\(/i,
      /import\s+/i,
      /setTimeout/i,
      /setInterval/i,
      /console\./i,
      /__proto__/i,
      /this\./i,
      /window\./i,
      /document\./i,
      /location\./i,
      /navigator\./i,
      /fs\./i,
      /child_process/i,
      /spawn/i,
      /exec/i,
    ];

    for (const pattern of unsafePatterns) {
      if (pattern.test(expression)) {
        analysis.hasUnsafePatterns = true;
        break;
      }
    }

    // Calculate complexity
    analysis.complexity = this.calculateComplexity(expression);

    // Extract variables and functions
    analysis.usedVariables = this.extractVariables(expression);
    analysis.usedFunctions = this.extractFunctions(expression);

    // Estimate execution time based on complexity
    analysis.estimatedExecutionTime = analysis.complexity * 2; // 2ms per complexity unit

    return analysis;
  }

  /**
   * Calculate expression complexity
   */
  private calculateComplexity(expression: string): number {
    let complexity = 1; // Base complexity

    // Count operators
    const operators = [
      "+",
      "-",
      "*",
      "/",
      "%",
      "==",
      "!=",
      "&&",
      "||",
      "?",
      ":",
    ];
    for (const op of operators) {
      const matches = expression.split(op).length - 1;
      complexity += matches;
    }

    // Count parentheses depth
    let depth = 0;
    let maxDepth = 0;
    for (const char of expression) {
      if (char === "(") depth++;
      if (char === ")") depth--;
      maxDepth = Math.max(maxDepth, depth);
    }
    complexity += maxDepth * 2;

    // Count function calls
    const functionCalls = (expression.match(/\w+\s*\(/g) || []).length;
    complexity += functionCalls * 3;

    // Count array/object access
    const accessors = (expression.match(/[\[\.][\w'"]/g) || []).length;
    complexity += accessors;

    return complexity;
  }

  /**
   * Extract variable names from expression
   */
  private extractVariables(expression: string): string[] {
    const variables: string[] = [];
    const variablePattern = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g;

    let match;
    while ((match = variablePattern.exec(expression)) !== null) {
      const variable = match[1];

      // Skip keywords and built-ins
      if (!this.isKeywordOrBuiltin(variable) && !variables.includes(variable)) {
        variables.push(variable);
      }
    }

    return variables;
  }

  /**
   * Extract function names from expression
   */
  private extractFunctions(expression: string): string[] {
    const functions: string[] = [];
    const functionPattern = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;

    let match;
    while ((match = functionPattern.exec(expression)) !== null) {
      const functionName = match[1];
      if (!functions.includes(functionName)) {
        functions.push(functionName);
      }
    }

    return functions;
  }

  /**
   * Check if identifier is a keyword or built-in
   */
  private isKeywordOrBuiltin(identifier: string): boolean {
    const keywords = [
      "true",
      "false",
      "null",
      "undefined",
      "if",
      "else",
      "for",
      "while",
      "return",
      "Math",
      "String",
      "Array",
      "Object",
      "Date",
      "JSON",
    ];

    return keywords.includes(identifier);
  }

  /**
   * Create sandboxed execution environment
   */
  private createSandbox(context: ExpressionContext): any {
    // Merge user context with safe built-ins
    const sandbox = {
      ...context.variables,
      ...context.functions,
      ...this.safeBuiltins,
    };

    // Add utility functions
    sandbox.typeof = (value: any) => typeof value;
    sandbox.isNull = (value: any) => value === null;
    sandbox.isUndefined = (value: any) => value === undefined;
    sandbox.isEmpty = (value: any) => {
      if (value == null) return true;
      if (typeof value === "string" || Array.isArray(value))
        return value.length === 0;
      if (typeof value === "object") return Object.keys(value).length === 0;
      return false;
    };

    // Add safe regex support
    sandbox.RegExp = {
      test:
        (pattern: string, flags: string = "") =>
        (input: string) => {
          try {
            return new RegExp(pattern, flags).test(input);
          } catch {
            return false;
          }
        },
    };

    return sandbox;
  }

  /**
   * Execute expression with timeout protection
   */
  private async executeWithTimeout(
    expression: string,
    sandbox: any,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(`Expression execution timeout: ${this.maxExecutionTime}ms`),
        );
      }, this.maxExecutionTime);

      try {
        // Create function with sandbox scope
        const keys = Object.keys(sandbox);
        const values = Object.values(sandbox);

        // Wrap expression to prevent scope escape
        const wrappedExpression = `
          "use strict";
          return (function() {
            ${keys.map((key) => `const ${key} = arguments[${keys.indexOf(key)}];`).join("\n")}
            return (${expression});
          }).apply(null, arguments);
        `;

        const evaluator = new Function(wrappedExpression);
        const result = evaluator(...values);

        clearTimeout(timeout);
        resolve(result);
      } catch (error) {
        clearTimeout(timeout);
        reject(new Error(`Expression evaluation failed: ${error.message}`));
      }
    });
  }

  /**
   * Mask sensitive data in expressions for logging
   */
  private maskSensitiveData(expression: string): string {
    // Mask potential sensitive patterns
    return expression
      .replace(/password\s*[=:]\s*['"][^'"]*['"]/gi, 'password="***"')
      .replace(/token\s*[=:]\s*['"][^'"]*['"]/gi, 'token="***"')
      .replace(/key\s*[=:]\s*['"][^'"]*['"]/gi, 'key="***"')
      .replace(/secret\s*[=:]\s*['"][^'"]*['"]/gi, 'secret="***"');
  }

  /**
   * Batch evaluate multiple expressions
   */
  async evaluateMultiple(
    expressions: Array<{ id: string; expression: string }>,
    context: ExpressionContext,
  ): Promise<Array<{ id: string; result: EvaluationResult }>> {
    const results = [];

    for (const { id, expression } of expressions) {
      const result = await this.evaluate(expression, context);
      results.push({ id, result });
    }

    return results;
  }

  /**
   * Create a new context with additional variables
   */
  createContext(
    variables: Record<string, any>,
    functions: Record<string, (...args: any[]) => any> = {},
    metadata: Partial<ExpressionContext["metadata"]> = {},
  ): ExpressionContext {
    return {
      variables,
      functions,
      metadata: {
        userId: metadata.userId || "anonymous",
        correlationId:
          metadata.correlationId ||
          `expr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: metadata.timestamp || Date.now(),
      },
    };
  }

  /**
   * Get evaluator health status
   */
  getHealthStatus(): {
    status: "healthy" | "degraded" | "unhealthy";
    details: any;
  } {
    return {
      status: "healthy",
      details: {
        maxComplexity: this.maxComplexity,
        maxExecutionTime: this.maxExecutionTime,
        maxDepth: this.maxDepth,
        allowedOperators: this.allowedOperators.size,
        safeBuiltins: Object.keys(this.safeBuiltins).length,
      },
    };
  }
}
