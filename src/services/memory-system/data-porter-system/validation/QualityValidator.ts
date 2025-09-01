/**
 * Quality Validator
 *
 * Validates data quality using configurable rules and thresholds
 */

import { EventEmitter } from "node:events";
import {
  DataQualityValidation,
  QualityRule,
  QualityThresholds,
  QualityResult,
  QualityIssue,
} from "../types/porter-types";
import { SafeExpressionEvaluator } from "../security/expression/SafeExpressionEvaluator";

export interface ValidationContext {
  requestId: string;
  userId: string;
  correlationId: string;
  timestamp: number;
  metadata: Record<string, any>;
}

export interface FieldAnalysis {
  field: string;
  totalRecords: number;
  nullCount: number;
  emptyCount: number;
  uniqueCount: number;
  validCount: number;
  invalidCount: number;
  completeness: number;
  uniqueness: number;
  validity: number;
  examples: any[];
  patterns: string[];
}

export class QualityValidator extends EventEmitter {
  private config: DataQualityValidation;
  private readonly expressionEvaluator: SafeExpressionEvaluator;
  private readonly builtInRules: QualityRule[];

  constructor(config: DataQualityValidation) {
    super();
    this.config = config;
    this.expressionEvaluator = new SafeExpressionEvaluator();
    this.builtInRules = this.createBuiltInRules();
  }

  /**
   * Create built-in quality rules
   */
  private createBuiltInRules(): QualityRule[] {
    return [
      {
        field: "*",
        type: "completeness",
        condition: 'value !== null && value !== undefined && value !== ""',
        threshold: 0.95, // 95% completeness
      },
      {
        field: "email",
        type: "validity",
        condition: "/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value)",
        threshold: 0.99, // 99% valid emails
      },
      {
        field: "phone",
        type: "validity",
        condition:
          '/^[\\+]?[1-9][\\d]{0,15}$/.test(value.replace(/[\\s\\-\\(\\)]/g, ""))',
        threshold: 0.95, // 95% valid phone numbers
      },
      {
        field: "id",
        type: "uniqueness",
        condition: "true", // Uniqueness is calculated separately
        threshold: 1.0, // 100% unique IDs
      },
      {
        field: "timestamp",
        type: "validity",
        condition: "!isNaN(Date.parse(value))",
        threshold: 0.99, // 99% valid timestamps
      },
      {
        field: "url",
        type: "validity",
        condition:
          "try { new URL(value); return true; } catch { return false; }",
        threshold: 0.95, // 95% valid URLs
      },
    ];
  }

  /**
   * Validate data quality
   */
  async validate(
    data: any,
    context: ValidationContext,
  ): Promise<QualityResult> {
    try {
      if (!this.config.enabled) {
        return this.createEmptyResult();
      }

      // Convert single record to array for uniform processing
      const records = Array.isArray(data) ? data : [data];

      if (records.length === 0) {
        return this.createEmptyResult();
      }

      // Analyze fields
      const fieldAnalyses = await this.analyzeFields(records, context);

      // Apply quality rules
      const allRules = [...this.builtInRules, ...this.config.rules];
      const issues = await this.applyQualityRules(
        fieldAnalyses,
        allRules,
        context,
      );

      // Calculate overall quality scores
      const scores = this.calculateQualityScores(
        fieldAnalyses,
        this.config.thresholds,
      );

      const result: QualityResult = {
        score: scores.overall,
        completeness: scores.completeness,
        uniqueness: scores.uniqueness,
        validity: scores.validity,
        consistency: scores.consistency,
        issues,
      };

      this.emit("validation_complete", {
        context,
        result,
        recordCount: records.length,
        fieldCount: fieldAnalyses.length,
      });

      return result;
    } catch (error) {
      this.emit("validation_error", {
        context,
        error: error.message,
      });

      throw new Error(`Quality validation failed: ${error.message}`);
    }
  }

  /**
   * Analyze fields in the dataset
   */
  private async analyzeFields(
    records: any[],
    context: ValidationContext,
  ): Promise<FieldAnalysis[]> {
    const fieldMap = new Map<string, FieldAnalysis>();

    // Collect all unique field names
    const allFields = new Set<string>();
    records.forEach((record) => {
      if (record && typeof record === "object") {
        Object.keys(record).forEach((key) => allFields.add(key));
      }
    });

    // Initialize field analyses
    for (const field of allFields) {
      fieldMap.set(field, {
        field,
        totalRecords: records.length,
        nullCount: 0,
        emptyCount: 0,
        uniqueCount: 0,
        validCount: 0,
        invalidCount: 0,
        completeness: 0,
        uniqueness: 0,
        validity: 0,
        examples: [],
        patterns: [],
      });
    }

    // Analyze each record
    const uniqueValues = new Map<string, Set<any>>();

    for (const field of allFields) {
      uniqueValues.set(field, new Set());
    }

    for (const record of records) {
      if (!record || typeof record !== "object") {
        continue;
      }

      for (const field of allFields) {
        const analysis = fieldMap.get(field)!;
        const value = record[field];

        // Count nulls and empties
        if (value === null || value === undefined) {
          analysis.nullCount++;
        } else if (
          value === "" ||
          (typeof value === "string" && value.trim() === "")
        ) {
          analysis.emptyCount++;
        }

        // Collect unique values
        if (value !== null && value !== undefined) {
          uniqueValues.get(field)!.add(this.normalizeValue(value));
        }

        // Collect examples (first 5 non-null values)
        if (
          analysis.examples.length < 5 &&
          value !== null &&
          value !== undefined &&
          value !== ""
        ) {
          analysis.examples.push(value);
        }
      }
    }

    // Calculate metrics
    for (const field of allFields) {
      const analysis = fieldMap.get(field)!;
      const uniqueSet = uniqueValues.get(field)!;

      analysis.uniqueCount = uniqueSet.size;

      const nullAndEmptyCount = analysis.nullCount + analysis.emptyCount;
      const completeCount = analysis.totalRecords - nullAndEmptyCount;

      analysis.completeness = completeCount / analysis.totalRecords;
      analysis.uniqueness = analysis.uniqueCount / Math.max(1, completeCount);

      // Detect patterns
      analysis.patterns = this.detectPatterns(analysis.examples);

      this.emit("field_analyzed", {
        context,
        field,
        analysis: {
          completeness: analysis.completeness,
          uniqueness: analysis.uniqueness,
          sampleSize: analysis.examples.length,
        },
      });
    }

    return Array.from(fieldMap.values());
  }

  /**
   * Apply quality rules to field analyses
   */
  private async applyQualityRules(
    analyses: FieldAnalysis[],
    rules: QualityRule[],
    context: ValidationContext,
  ): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];

    for (const rule of rules) {
      try {
        // Find matching fields
        const matchingFields =
          rule.field === "*"
            ? analyses
            : analyses.filter(
                (analysis) =>
                  analysis.field === rule.field ||
                  analysis.field.includes(rule.field) ||
                  new RegExp(rule.field).test(analysis.field),
              );

        for (const analysis of matchingFields) {
          const issue = await this.evaluateRule(analysis, rule, context);
          if (issue) {
            issues.push(issue);
          }
        }
      } catch (error) {
        this.emit("rule_error", {
          context,
          rule: rule.field,
          error: error.message,
        });
      }
    }

    return issues;
  }

  /**
   * Evaluate a quality rule against field analysis
   */
  private async evaluateRule(
    analysis: FieldAnalysis,
    rule: QualityRule,
    context: ValidationContext,
  ): Promise<QualityIssue | null> {
    try {
      let score = 0;
      let issueCount = 0;
      let percentage = 0;

      switch (rule.type) {
        case "completeness":
          score = analysis.completeness;
          issueCount = analysis.nullCount + analysis.emptyCount;
          percentage = (1 - analysis.completeness) * 100;
          break;

        case "uniqueness":
          score = Math.min(1, analysis.uniqueness); // Cap at 1.0
          issueCount = Math.max(
            0,
            analysis.totalRecords - analysis.uniqueCount,
          );
          percentage = (1 - Math.min(1, analysis.uniqueness)) * 100;
          break;

        case "validity":
          // Use expression evaluator to check validity condition
          let validCount = 0;
          for (const example of analysis.examples) {
            try {
              const evalContext = this.expressionEvaluator.createContext({
                value: example,
              });
              const result = await this.expressionEvaluator.evaluate(
                rule.condition,
                evalContext,
              );
              if (result.success && result.result) {
                validCount++;
              }
            } catch {
              // Invalid examples don't count as valid
            }
          }

          score =
            analysis.examples.length > 0
              ? validCount / analysis.examples.length
              : 1;
          issueCount = analysis.examples.length - validCount;
          percentage = (1 - score) * 100;
          break;

        case "consistency":
          // Measure consistency based on pattern diversity
          const patternCount = analysis.patterns.length;
          score = patternCount <= 1 ? 1 : Math.max(0, (10 - patternCount) / 10);
          issueCount = Math.max(0, patternCount - 1);
          percentage = (1 - score) * 100;
          break;

        default:
          return null;
      }

      // Check if rule threshold is violated
      if (score < rule.threshold) {
        return {
          field: analysis.field,
          type: rule.type,
          count: issueCount,
          percentage,
          examples: analysis.examples.slice(0, 3), // First 3 examples
        };
      }

      return null;
    } catch (error) {
      throw new Error(
        `Rule evaluation failed for field '${analysis.field}': ${error.message}`,
      );
    }
  }

  /**
   * Calculate overall quality scores
   */
  private calculateQualityScores(
    analyses: FieldAnalysis[],
    thresholds: QualityThresholds,
  ): {
    overall: number;
    completeness: number;
    uniqueness: number;
    validity: number;
    consistency: number;
  } {
    if (analyses.length === 0) {
      return {
        overall: 1,
        completeness: 1,
        uniqueness: 1,
        validity: 1,
        consistency: 1,
      };
    }

    // Calculate average scores across all fields
    const completeness =
      analyses.reduce((sum, a) => sum + a.completeness, 0) / analyses.length;
    const uniqueness =
      analyses.reduce((sum, a) => sum + Math.min(1, a.uniqueness), 0) /
      analyses.length;

    // Validity based on pattern consistency
    const validity =
      analyses.reduce((sum, a) => {
        const patternScore = Math.max(0, (5 - a.patterns.length) / 5);
        return sum + patternScore;
      }, 0) / analyses.length;

    // Consistency based on pattern uniformity
    const consistency =
      analyses.reduce((sum, a) => {
        const patternCount = a.patterns.length;
        const consistencyScore =
          patternCount <= 1 ? 1 : Math.max(0, (10 - patternCount) / 10);
        return sum + consistencyScore;
      }, 0) / analyses.length;

    // Calculate weighted overall score
    const weights = {
      completeness: 0.3,
      uniqueness: 0.2,
      validity: 0.3,
      consistency: 0.2,
    };
    const overall =
      completeness * weights.completeness +
      uniqueness * weights.uniqueness +
      validity * weights.validity +
      consistency * weights.consistency;

    return {
      overall: Math.max(0, Math.min(1, overall)),
      completeness: Math.max(0, Math.min(1, completeness)),
      uniqueness: Math.max(0, Math.min(1, uniqueness)),
      validity: Math.max(0, Math.min(1, validity)),
      consistency: Math.max(0, Math.min(1, consistency)),
    };
  }

  /**
   * Detect patterns in field values
   */
  private detectPatterns(examples: any[]): string[] {
    const patterns = new Set<string>();

    for (const value of examples) {
      if (value === null || value === undefined) {
        patterns.add("null");
        continue;
      }

      const strValue = String(value);

      // Detect common patterns
      if (/^\d+$/.test(strValue)) {
        patterns.add("integer");
      } else if (/^\d+\.\d+$/.test(strValue)) {
        patterns.add("decimal");
      } else if (/^[a-zA-Z]+$/.test(strValue)) {
        patterns.add("alphabetic");
      } else if (/^[a-zA-Z0-9]+$/.test(strValue)) {
        patterns.add("alphanumeric");
      } else if (/^\d{4}-\d{2}-\d{2}/.test(strValue)) {
        patterns.add("date");
      } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strValue)) {
        patterns.add("email");
      } else if (/^https?:\/\//.test(strValue)) {
        patterns.add("url");
      } else if (
        /^[\+]?[1-9][\d]{0,15}$/.test(strValue.replace(/[\s\-\(\)]/g, ""))
      ) {
        patterns.add("phone");
      } else if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          strValue,
        )
      ) {
        patterns.add("uuid");
      } else {
        patterns.add("mixed");
      }
    }

    return Array.from(patterns);
  }

  /**
   * Normalize value for uniqueness calculation
   */
  private normalizeValue(value: any): any {
    if (typeof value === "string") {
      return value.toLowerCase().trim();
    }
    return value;
  }

  /**
   * Create empty quality result
   */
  private createEmptyResult(): QualityResult {
    return {
      score: 1,
      completeness: 1,
      uniqueness: 1,
      validity: 1,
      consistency: 1,
      issues: [],
    };
  }

  /**
   * Analyze single field across dataset
   */
  async analyzeField(
    records: any[],
    fieldName: string,
  ): Promise<FieldAnalysis> {
    const analyses = await this.analyzeFields(records, {
      requestId: "field-analysis",
      userId: "system",
      correlationId: "single-field",
      timestamp: Date.now(),
      metadata: {},
    });

    const fieldAnalysis = analyses.find((a) => a.field === fieldName);
    if (!fieldAnalysis) {
      throw new Error(`Field '${fieldName}' not found in dataset`);
    }

    return fieldAnalysis;
  }

  /**
   * Get quality recommendations
   */
  getQualityRecommendations(result: QualityResult): Array<{
    type: string;
    severity: "low" | "medium" | "high" | "critical";
    message: string;
    suggestion: string;
  }> {
    const recommendations: Array<{
      type: string;
      severity: "low" | "medium" | "high" | "critical";
      message: string;
      suggestion: string;
    }> = [];

    // Overall quality recommendations
    if (result.score < 0.5) {
      recommendations.push({
        type: "overall",
        severity: "critical",
        message: `Overall data quality score is critically low (${(result.score * 100).toFixed(1)}%)`,
        suggestion:
          "Implement comprehensive data quality checks and cleansing processes",
      });
    } else if (result.score < 0.8) {
      recommendations.push({
        type: "overall",
        severity: "high",
        message: `Overall data quality needs improvement (${(result.score * 100).toFixed(1)}%)`,
        suggestion:
          "Focus on addressing the most impactful quality issues first",
      });
    }

    // Specific dimension recommendations
    if (result.completeness < 0.9) {
      recommendations.push({
        type: "completeness",
        severity: result.completeness < 0.7 ? "high" : "medium",
        message: `Data completeness is below acceptable levels (${(result.completeness * 100).toFixed(1)}%)`,
        suggestion:
          "Implement required field validation and default value strategies",
      });
    }

    if (result.validity < 0.95) {
      recommendations.push({
        type: "validity",
        severity: result.validity < 0.8 ? "high" : "medium",
        message: `Data validity issues detected (${(result.validity * 100).toFixed(1)}% valid)`,
        suggestion:
          "Add format validation and data type constraints at input points",
      });
    }

    if (
      result.uniqueness < 0.95 &&
      result.issues.some((issue) => issue.type === "uniqueness")
    ) {
      recommendations.push({
        type: "uniqueness",
        severity: "medium",
        message: `Duplicate data detected affecting uniqueness (${(result.uniqueness * 100).toFixed(1)}%)`,
        suggestion:
          "Implement deduplication processes and unique constraint enforcement",
      });
    }

    if (result.consistency < 0.8) {
      recommendations.push({
        type: "consistency",
        severity: "medium",
        message: `Data consistency issues found (${(result.consistency * 100).toFixed(1)}% consistent)`,
        suggestion:
          "Standardize data formats and implement consistent validation rules",
      });
    }

    return recommendations;
  }

  /**
   * Update quality validator configuration
   */
  updateConfig(newConfig: Partial<DataQualityValidation>): void {
    Object.assign(this.config, newConfig);

    this.emit("config_updated", {
      timestamp: Date.now(),
      config: this.config,
    });
  }

  /**
   * Get quality validator health status
   */
  getHealthStatus(): {
    status: "healthy" | "degraded" | "unhealthy";
    details: any;
  } {
    let status: "healthy" | "degraded" | "unhealthy" = "healthy";

    if (!this.config.enabled) {
      status = "degraded";
    }

    if (this.config.rules.length === 0 && this.builtInRules.length === 0) {
      status = "unhealthy";
    }

    const evaluatorHealth = this.expressionEvaluator.getHealthStatus();
    if (evaluatorHealth.status === "unhealthy") {
      status = "unhealthy";
    } else if (evaluatorHealth.status === "degraded") {
      status = "degraded";
    }

    return {
      status,
      details: {
        enabled: this.config.enabled,
        customRules: this.config.rules.length,
        builtInRules: this.builtInRules.length,
        thresholds: this.config.thresholds,
        expressionEvaluator: evaluatorHealth,
      },
    };
  }

  /**
   * Test quality validator
   */
  async test(testData?: any[]): Promise<{
    success: boolean;
    error?: string;
    result?: QualityResult;
  }> {
    try {
      const data = testData || [
        { id: 1, email: "user1@example.com", name: "User One", age: 25 },
        { id: 2, email: "user2@example.com", name: "User Two", age: 30 },
        { id: 3, email: "invalid-email", name: "", age: -5 }, // Quality issues
      ];

      const context = {
        requestId: "test",
        userId: "system",
        correlationId: "quality-test",
        timestamp: Date.now(),
        metadata: {},
      };

      const result = await this.validate(data, context);

      return {
        success: true,
        result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
