/**
 * LearningEngine - Machine learning system for autonomous agent
 * Learns from approval patterns and user behavior to improve decision making
 */

import { OperationContext, ExecutionPlan, PlannedOperation } from '../core/AutonomousExecutor';
import { PolicyResult } from '../security/PolicyEngine';
import { AuditEvent } from '../security/AuditLogger';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface LearningPattern {
  id: string;
  pattern: string;                    // Operation pattern signature
  approvalRate: number;               // Historical approval rate (0-1)
  successRate: number;                // Historical success rate (0-1)
  averageRisk: string;                // Average risk level
  occurrences: number;                // Number of times seen
  lastSeen: string;                   // Last occurrence timestamp
  userPreference: 'preferred' | 'neutral' | 'avoided';
  confidence: number;                 // Learning confidence (0-1)
}

export interface LearningMetrics {
  totalPatterns: number;
  totalOperations: number;
  approvalRate: number;
  successRate: number;
  confidenceScore: number;
  topPatterns: LearningPattern[];
  riskDistribution: Record<string, number>;
}

export interface PredictionResult {
  willBeApproved: boolean;
  confidence: number;
  reasoning: string[];
  similarPatterns: LearningPattern[];
  suggestedModifications?: string[];
}

export interface LearningConfig {
  minOccurrencesForPattern: number;   // Minimum occurrences to consider pattern
  learningRate: number;               // How fast to update patterns (0-1)
  decayRate: number;                  // How fast old patterns lose weight
  confidenceThreshold: number;        // Minimum confidence for predictions
  maxPatternsStored: number;          // Maximum patterns to keep in memory
}

export class LearningEngine {
  private patterns: Map<string, LearningPattern> = new Map();
  private readonly config: LearningConfig;
  private readonly dataDir: string;
  private isDirty: boolean = false;

  constructor(config?: Partial<LearningConfig>) {
    this.config = {
      minOccurrencesForPattern: config?.minOccurrencesForPattern ?? 3,
      learningRate: config?.learningRate ?? 0.1,
      decayRate: config?.decayRate ?? 0.01,
      confidenceThreshold: config?.confidenceThreshold ?? 0.7,
      maxPatternsStored: config?.maxPatternsStored ?? 1000
    };
    
    this.dataDir = path.join(process.env.HOME || '', '.maria', 'learning');
    this.loadPatterns();
  }

  /**
   * Learn from an execution result
   */
  async learn(
    plan: ExecutionPlan,
    context: OperationContext,
    result: {
      approved: boolean;
      executed: boolean;
      successful: boolean;
      userFeedback?: 'positive' | 'negative' | 'neutral';
    }
  ): Promise<void> {
    const pattern = this.generatePattern(plan, context);
    const existing = this.patterns.get(pattern);
    
    if (existing) {
      // Update existing pattern
      this.updatePattern(existing, result, context);
    } else {
      // Create new pattern
      const newPattern = this.createPattern(pattern, plan, context, result);
      if (this.patterns.size < this.config.maxPatternsStored) {
        this.patterns.set(pattern, newPattern);
      } else {
        // Remove least used pattern
        this.evictLeastUsedPattern();
        this.patterns.set(pattern, newPattern);
      }
    }
    
    this.isDirty = true;
    
    // Periodic save
    if (this.patterns.size % 10 === 0) {
      await this.savePatterns();
    }
  }

  /**
   * Predict if an operation will be approved
   */
  async predict(
    plan: ExecutionPlan,
    context: OperationContext
  ): Promise<PredictionResult> {
    const pattern = this.generatePattern(plan, context);
    const exactMatch = this.patterns.get(pattern);
    
    if (exactMatch && exactMatch.occurrences >= this.config.minOccurrencesForPattern) {
      // We have exact match with enough data
      return this.predictFromPattern(exactMatch, plan);
    }
    
    // Find similar patterns
    const similarPatterns = this.findSimilarPatterns(pattern, plan);
    
    if (similarPatterns.length === 0) {
      // No data, neutral prediction
      return {
        willBeApproved: true,
        confidence: 0.5,
        reasoning: ['No historical data available for this operation pattern'],
        similarPatterns: []
      };
    }
    
    // Weighted prediction from similar patterns
    return this.predictFromSimilarPatterns(similarPatterns, plan);
  }

  /**
   * Get learning metrics
   */
  async getMetrics(): Promise<LearningMetrics> {
    const patterns = Array.from(this.patterns.values());
    
    const totalOperations = patterns.reduce((sum, p) => sum + p.occurrences, 0);
    const totalApprovals = patterns.reduce(
      (sum, p) => sum + p.approvalRate * p.occurrences, 
      0
    );
    const totalSuccesses = patterns.reduce(
      (sum, p) => sum + p.successRate * p.occurrences,
      0
    );
    
    // Risk distribution
    const riskDistribution: Record<string, number> = {};
    for (const pattern of patterns) {
      riskDistribution[pattern.averageRisk] = 
        (riskDistribution[pattern.averageRisk] || 0) + pattern.occurrences;
    }
    
    // Top patterns by occurrence
    const topPatterns = patterns
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 10);
    
    // Average confidence
    const avgConfidence = patterns.length > 0
      ? patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length
      : 0;
    
    return {
      totalPatterns: patterns.length,
      totalOperations,
      approvalRate: totalOperations > 0 ? totalApprovals / totalOperations : 0,
      successRate: totalOperations > 0 ? totalSuccesses / totalOperations : 0,
      confidenceScore: avgConfidence,
      topPatterns,
      riskDistribution
    };
  }

  /**
   * Suggest improvements for a plan
   */
  async suggestImprovements(
    plan: ExecutionPlan,
    context: OperationContext
  ): Promise<{
    suggestions: string[];
    alternativeApproaches: ExecutionPlan[];
    confidenceImpact: number;
  }> {
    const suggestions: string[] = [];
    const prediction = await this.predict(plan, context);
    
    // Analyze why it might be rejected
    if (!prediction.willBeApproved && prediction.confidence > this.config.confidenceThreshold) {
      // Look at successful similar patterns
      const successfulSimilar = prediction.similarPatterns
        .filter(p => p.approvalRate > 0.8)
        .slice(0, 3);
      
      for (const pattern of successfulSimilar) {
        suggestions.push(`Consider approach similar to: ${this.describePattern(pattern)}`);
      }
      
      // Specific suggestions based on risk
      if (plan.risk.level === 'critical' || plan.risk.level === 'high') {
        suggestions.push('Break down into smaller, lower-risk operations');
        suggestions.push('Add explicit validation steps');
        suggestions.push('Consider dry-run first to verify changes');
      }
      
      // Path-based suggestions
      for (const step of plan.steps) {
        if (step.type === 'deleteFile') {
          suggestions.push(`Consider archiving instead of deleting: ${step.path}`);
        }
        if (step.type === 'execCommand' && step.command?.includes('sudo')) {
          suggestions.push('Remove sudo and use appropriate permissions');
        }
      }
    }
    
    return {
      suggestions,
      alternativeApproaches: [], // Would generate alternative plans
      confidenceImpact: prediction.confidence
    };
  }

  /**
   * Generate pattern signature from plan
   */
  private generatePattern(plan: ExecutionPlan, context: OperationContext): string {
    const components: string[] = [];
    
    // Operation types
    const opTypes = plan.steps.map(s => s.type).sort();
    components.push(`ops:${opTypes.join(',')}`);
    
    // Risk level
    components.push(`risk:${plan.risk.level}`);
    
    // Mode
    components.push(`mode:${context.mode}`);
    
    // Feature
    components.push(`feature:${context.tags.feature}`);
    
    // File patterns (generalized)
    const paths = plan.steps
      .filter(s => s.path)
      .map(s => this.generalizePathc(s.path!))
      .sort();
    if (paths.length > 0) {
      components.push(`paths:${paths.join(',')}`);
    }
    
    return components.join('|');
  }

  /**
   * Generalize path for pattern matching
   */
  private generalizePathc(filepath: string): string {
    // Remove specific filenames, keep structure
    if (filepath.includes('/')) {
      const parts = filepath.split('/');
      const dir = parts.slice(0, -1).join('/');
      const ext = path.extname(filepath);
      return `${dir}/*${ext}`;
    }
    return `*${path.extname(filepath)}`;
  }

  /**
   * Create new learning pattern
   */
  private createPattern(
    pattern: string,
    plan: ExecutionPlan,
    context: OperationContext,
    result: { approved: boolean; successful: boolean }
  ): LearningPattern {
    return {
      id: `pattern-${Date.now()}`,
      pattern,
      approvalRate: result.approved ? 1 : 0,
      successRate: result.successful ? 1 : 0,
      averageRisk: plan.risk.level,
      occurrences: 1,
      lastSeen: new Date().toISOString(),
      userPreference: result.approved ? 'preferred' : 'avoided',
      confidence: this.config.learningRate // Start with low confidence
    };
  }

  /**
   * Update existing pattern
   */
  private updatePattern(
    pattern: LearningPattern,
    result: { approved: boolean; successful: boolean },
    context: OperationContext
  ): void {
    const alpha = this.config.learningRate;
    
    // Update approval rate (exponential moving average)
    pattern.approvalRate = pattern.approvalRate * (1 - alpha) + (result.approved ? 1 : 0) * alpha;
    
    // Update success rate
    pattern.successRate = pattern.successRate * (1 - alpha) + (result.successful ? 1 : 0) * alpha;
    
    // Update occurrences
    pattern.occurrences++;
    
    // Update confidence (increases with more data)
    pattern.confidence = Math.min(1, pattern.confidence + alpha * 0.1);
    
    // Update user preference
    if (pattern.approvalRate > 0.8) {
      pattern.userPreference = 'preferred';
    } else if (pattern.approvalRate < 0.3) {
      pattern.userPreference = 'avoided';
    } else {
      pattern.userPreference = 'neutral';
    }
    
    pattern.lastSeen = new Date().toISOString();
  }

  /**
   * Find similar patterns
   */
  private findSimilarPatterns(
    targetPattern: string,
    plan: ExecutionPlan
  ): LearningPattern[] {
    const similar: Array<{ pattern: LearningPattern; similarity: number }> = [];
    
    for (const [key, pattern] of this.patterns) {
      if (pattern.occurrences < this.config.minOccurrencesForPattern) {
        continue;
      }
      
      const similarity = this.calculateSimilarity(targetPattern, key);
      if (similarity > 0.5) {
        similar.push({ pattern, similarity });
      }
    }
    
    // Sort by similarity and return top matches
    return similar
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5)
      .map(s => s.pattern);
  }

  /**
   * Calculate similarity between patterns
   */
  private calculateSimilarity(pattern1: string, pattern2: string): number {
    const parts1 = pattern1.split('|');
    const parts2 = pattern2.split('|');
    
    let matches = 0;
    let total = Math.max(parts1.length, parts2.length);
    
    for (const part of parts1) {
      if (parts2.includes(part)) {
        matches++;
      }
    }
    
    return matches / total;
  }

  /**
   * Predict from exact pattern match
   */
  private predictFromPattern(
    pattern: LearningPattern,
    plan: ExecutionPlan
  ): PredictionResult {
    const reasoning: string[] = [];
    
    reasoning.push(`Based on ${pattern.occurrences} previous occurrences`);
    reasoning.push(`Historical approval rate: ${(pattern.approvalRate * 100).toFixed(1)}%`);
    reasoning.push(`Historical success rate: ${(pattern.successRate * 100).toFixed(1)}%`);
    
    if (pattern.userPreference === 'preferred') {
      reasoning.push('This type of operation is typically preferred');
    } else if (pattern.userPreference === 'avoided') {
      reasoning.push('This type of operation is typically avoided');
    }
    
    const willBeApproved = pattern.approvalRate > 0.5;
    
    return {
      willBeApproved,
      confidence: pattern.confidence,
      reasoning,
      similarPatterns: [pattern],
      suggestedModifications: willBeApproved ? undefined : [
        'Consider breaking into smaller operations',
        'Review similar successful operations'
      ]
    };
  }

  /**
   * Predict from similar patterns
   */
  private predictFromSimilarPatterns(
    patterns: LearningPattern[],
    plan: ExecutionPlan
  ): PredictionResult {
    // Weighted average based on similarity and confidence
    let totalWeight = 0;
    let weightedApproval = 0;
    let weightedSuccess = 0;
    
    for (const pattern of patterns) {
      const weight = pattern.confidence * pattern.occurrences;
      totalWeight += weight;
      weightedApproval += pattern.approvalRate * weight;
      weightedSuccess += pattern.successRate * weight;
    }
    
    const avgApproval = totalWeight > 0 ? weightedApproval / totalWeight : 0.5;
    const avgSuccess = totalWeight > 0 ? weightedSuccess / totalWeight : 0.5;
    
    const reasoning: string[] = [];
    reasoning.push(`Based on ${patterns.length} similar patterns`);
    reasoning.push(`Average approval rate: ${(avgApproval * 100).toFixed(1)}%`);
    reasoning.push(`Average success rate: ${(avgSuccess * 100).toFixed(1)}%`);
    
    return {
      willBeApproved: avgApproval > 0.5,
      confidence: Math.min(...patterns.map(p => p.confidence)),
      reasoning,
      similarPatterns: patterns
    };
  }

  /**
   * Describe pattern in human-readable form
   */
  private describePattern(pattern: LearningPattern): string {
    const parts = pattern.pattern.split('|');
    const descriptions: string[] = [];
    
    for (const part of parts) {
      if (part.startsWith('ops:')) {
        descriptions.push(`Operations: ${part.substring(4)}`);
      } else if (part.startsWith('risk:')) {
        descriptions.push(`Risk level: ${part.substring(5)}`);
      }
    }
    
    return descriptions.join(', ');
  }

  /**
   * Evict least used pattern
   */
  private evictLeastUsedPattern(): void {
    let leastUsed: string | null = null;
    let minScore = Infinity;
    
    for (const [key, pattern] of this.patterns) {
      // Score based on recency and frequency
      const daysSinceLastSeen = (Date.now() - new Date(pattern.lastSeen).getTime()) / (1000 * 60 * 60 * 24);
      const score = pattern.occurrences / (1 + daysSinceLastSeen * this.config.decayRate);
      
      if (score < minScore) {
        minScore = score;
        leastUsed = key;
      }
    }
    
    if (leastUsed) {
      this.patterns.delete(leastUsed);
    }
  }

  /**
   * Load patterns from disk
   */
  private async loadPatterns(): Promise<void> {
    try {
      const dataFile = path.join(this.dataDir, 'patterns.json');
      const data = await fs.readFile(dataFile, 'utf-8');
      const loaded = JSON.parse(data);
      
      this.patterns = new Map(loaded.patterns);
    } catch (error) {
      // No data file yet, start fresh
      this.patterns = new Map();
    }
  }

  /**
   * Save patterns to disk
   */
  async savePatterns(): Promise<void> {
    if (!this.isDirty) return;
    
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      
      const dataFile = path.join(this.dataDir, 'patterns.json');
      const data = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        patterns: Array.from(this.patterns.entries())
      };
      
      await fs.writeFile(dataFile, JSON.stringify(data, null, 2));
      this.isDirty = false;
    } catch (error) {
      console.error('Failed to save learning patterns:', error);
    }
  }

  /**
   * Clear all learning data
   */
  async reset(): Promise<void> {
    this.patterns.clear();
    this.isDirty = true;
    await this.savePatterns();
  }
}