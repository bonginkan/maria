/**
 * OptimizationEngine - Optimizes execution plans and performance
 * Provides intelligent execution optimization, batching, and resource management
 */

import { ExecutionPlan, PlannedOperation, OperationContext, ExecutionResult } from '../core/AutonomousExecutor';
import { ProjectContext, ImpactAnalysis } from './ContextAnalyzer';
import { LearningPattern, LearningMetrics } from './LearningEngine';

export interface OptimizationStrategy {
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
}

export interface OptimizationResult {
  originalPlan: ExecutionPlan;
  optimizedPlan: ExecutionPlan;
  improvements: OptimizationImprovement[];
  estimatedSpeedup: number;
  resourceSavings: ResourceSavings;
  riskChange: 'reduced' | 'unchanged' | 'increased';
}

export interface OptimizationImprovement {
  type: 'batching' | 'reordering' | 'caching' | 'parallelization' | 'elimination';
  description: string;
  impact: 'low' | 'medium' | 'high';
  confidence: number;
}

export interface ResourceSavings {
  timeMs: number;
  memoryMB: number;
  diskIOMB: number;
  networkRequests: number;
}

export interface BatchOperation {
  id: string;
  operations: PlannedOperation[];
  estimatedDuration: number;
  canParallelize: boolean;
  dependencies: string[];
}

export interface OptimizationMetrics {
  totalOptimizations: number;
  avgSpeedup: number;
  successRate: number;
  topStrategies: Array<{
    strategy: string;
    usage: number;
    avgImprovement: number;
  }>;
}

export class OptimizationEngine {
  private strategies: Map<string, OptimizationStrategy> = new Map();
  private optimizationHistory: OptimizationResult[] = [];
  private performanceCache: Map<string, number> = new Map();

  constructor() {
    this.initializeStrategies();
  }

  /**
   * Optimize execution plan
   */
  async optimize(
    plan: ExecutionPlan,
    context: OperationContext,
    projectContext?: ProjectContext,
    learningData?: LearningPattern[]
  ): Promise<OptimizationResult> {
    const originalPlan = JSON.parse(JSON.stringify(plan)); // Deep copy
    const improvements: OptimizationImprovement[] = [];
    let optimizedPlan = plan;
    
    // Apply enabled optimization strategies
    for (const [name, strategy] of this.strategies) {
      if (!strategy.enabled) continue;
      
      const result = await this.applyStrategy(
        name,
        optimizedPlan,
        context,
        projectContext,
        learningData
      );
      
      if (result) {
        optimizedPlan = result.plan;
        improvements.push(...result.improvements);
      }
    }
    
    // Calculate metrics
    const estimatedSpeedup = this.calculateSpeedup(originalPlan, optimizedPlan);
    const resourceSavings = this.calculateResourceSavings(originalPlan, optimizedPlan);
    const riskChange = this.assessRiskChange(originalPlan, optimizedPlan);
    
    const result: OptimizationResult = {
      originalPlan,
      optimizedPlan,
      improvements,
      estimatedSpeedup,
      resourceSavings,
      riskChange
    };
    
    // Store for learning
    this.optimizationHistory.push(result);
    
    return result;
  }

  /**
   * Create optimized batch operations
   */
  async createBatches(
    operations: PlannedOperation[],
    context: OperationContext
  ): Promise<BatchOperation[]> {
    const batches: BatchOperation[] = [];
    const processed = new Set<number>();
    
    // Group compatible operations
    for (let i = 0; i < operations.length; i++) {
      if (processed.has(i)) continue;
      
      const operation = operations[i];
      const batch: BatchOperation = {
        id: `batch-${Date.now()}-${i}`,
        operations: [operation],
        estimatedDuration: this.estimateOperationDuration(operation),
        canParallelize: this.canParallelize(operation),
        dependencies: this.findDependencies(operation, operations)
      };
      
      processed.add(i);
      
      // Find compatible operations to batch
      for (let j = i + 1; j < operations.length; j++) {
        if (processed.has(j)) continue;
        
        const otherOp = operations[j];
        if (this.areCompatible(operation, otherOp) && 
            !this.hasDependency(operation, otherOp)) {
          batch.operations.push(otherOp);
          batch.estimatedDuration += this.estimateOperationDuration(otherOp);
          processed.add(j);
        }
      }
      
      batches.push(batch);
    }
    
    // Optimize batch order
    return this.optimizeBatchOrder(batches);
  }

  /**
   * Suggest performance improvements
   */
  async suggestImprovements(
    plan: ExecutionPlan,
    context: OperationContext,
    pastResults?: ExecutionResult[]
  ): Promise<{
    suggestions: string[];
    potentialSpeedup: number;
    confidenceScore: number;
  }> {
    const suggestions: string[] = [];
    let potentialSpeedup = 1.0;
    let totalConfidence = 0;
    
    // Analyze operation patterns
    const patterns = this.analyzePatterns(plan.steps);
    
    // File operation optimizations
    const fileOps = plan.steps.filter(s => 
      s.type === 'writeFile' || s.type === 'editFile' || s.type === 'deleteFile'
    );
    
    if (fileOps.length > 5) {
      suggestions.push('Consider batching file operations for better performance');
      potentialSpeedup *= 1.3;
      totalConfidence += 0.8;
    }
    
    // Command execution optimizations
    const cmdOps = plan.steps.filter(s => s.type === 'execCommand');
    
    if (cmdOps.length > 1) {
      const parallelizable = cmdOps.filter(cmd => this.canParallelize(cmd));
      if (parallelizable.length > 1) {
        suggestions.push(`${parallelizable.length} commands can be run in parallel`);
        potentialSpeedup *= 1.5;
        totalConfidence += 0.9;
      }
    }
    
    // Redundancy detection
    const redundant = this.findRedundantOperations(plan.steps);
    if (redundant.length > 0) {
      suggestions.push(`Remove ${redundant.length} redundant operations`);
      potentialSpeedup *= 1.2;
      totalConfidence += 1.0;
    }
    
    // Dependency optimization
    const reordered = this.optimizeOrderForDependencies(plan.steps);
    if (reordered.length !== plan.steps.length || 
        !reordered.every((op, i) => op === plan.steps[i])) {
      suggestions.push('Reorder operations to resolve dependencies more efficiently');
      potentialSpeedup *= 1.1;
      totalConfidence += 0.7;
    }
    
    const confidenceScore = totalConfidence / suggestions.length || 0;
    
    return {
      suggestions,
      potentialSpeedup,
      confidenceScore
    };
  }

  /**
   * Get optimization metrics
   */
  getMetrics(): OptimizationMetrics {
    const history = this.optimizationHistory;
    
    const totalOptimizations = history.length;
    const avgSpeedup = history.reduce((sum, r) => sum + r.estimatedSpeedup, 0) / totalOptimizations || 1;
    const successRate = history.filter(r => r.estimatedSpeedup > 1).length / totalOptimizations || 0;
    
    // Count strategy usage
    const strategyUsage = new Map<string, { count: number; totalImprovement: number }>();
    
    for (const result of history) {
      for (const improvement of result.improvements) {
        const current = strategyUsage.get(improvement.type) || { count: 0, totalImprovement: 0 };
        current.count++;
        current.totalImprovement += result.estimatedSpeedup;
        strategyUsage.set(improvement.type, current);
      }
    }
    
    const topStrategies = Array.from(strategyUsage.entries())
      .map(([strategy, data]) => ({
        strategy,
        usage: data.count,
        avgImprovement: data.totalImprovement / data.count
      }))
      .sort((a, b) => b.avgImprovement - a.avgImprovement)
      .slice(0, 5);
    
    return {
      totalOptimizations,
      avgSpeedup,
      successRate,
      topStrategies
    };
  }

  /**
   * Initialize optimization strategies
   */
  private initializeStrategies(): void {
    this.strategies.set('batching', {
      name: 'Operation Batching',
      description: 'Group similar operations for batch execution',
      enabled: true,
      priority: 1
    });
    
    this.strategies.set('reordering', {
      name: 'Dependency Reordering', 
      description: 'Reorder operations to minimize dependencies',
      enabled: true,
      priority: 2
    });
    
    this.strategies.set('parallelization', {
      name: 'Parallel Execution',
      description: 'Execute independent operations in parallel',
      enabled: true,
      priority: 1
    });
    
    this.strategies.set('caching', {
      name: 'Result Caching',
      description: 'Cache and reuse operation results',
      enabled: true,
      priority: 3
    });
    
    this.strategies.set('elimination', {
      name: 'Redundancy Elimination',
      description: 'Remove redundant or unnecessary operations',
      enabled: true,
      priority: 1
    });
  }

  /**
   * Apply optimization strategy
   */
  private async applyStrategy(
    strategyName: string,
    plan: ExecutionPlan,
    context: OperationContext,
    projectContext?: ProjectContext,
    learningData?: LearningPattern[]
  ): Promise<{ plan: ExecutionPlan; improvements: OptimizationImprovement[] } | null> {
    switch (strategyName) {
      case 'batching':
        return this.applyBatching(plan, context);
      
      case 'reordering':
        return this.applyReordering(plan, context);
      
      case 'parallelization':
        return this.applyParallelization(plan, context);
      
      case 'elimination':
        return this.applyElimination(plan, context);
      
      case 'caching':
        return this.applyCaching(plan, context);
      
      default:
        return null;
    }
  }

  /**
   * Apply batching optimization
   */
  private async applyBatching(
    plan: ExecutionPlan,
    context: OperationContext
  ): Promise<{ plan: ExecutionPlan; improvements: OptimizationImprovement[] } | null> {
    const batchableOps = plan.steps.filter(s => this.canBatch(s));
    
    if (batchableOps.length < 2) return null;
    
    const optimizedPlan = { ...plan };
    const improvements: OptimizationImprovement[] = [];
    
    // Group file operations by directory
    const fileOpsByDir = new Map<string, PlannedOperation[]>();
    
    for (const op of batchableOps) {
      if (op.path) {
        const dir = op.path.includes('/') ? op.path.split('/').slice(0, -1).join('/') : '.';
        if (!fileOpsByDir.has(dir)) {
          fileOpsByDir.set(dir, []);
        }
        fileOpsByDir.get(dir)!.push(op);
      }
    }
    
    // Create batches for directories with multiple operations
    for (const [dir, ops] of fileOpsByDir) {
      if (ops.length > 1) {
        improvements.push({
          type: 'batching',
          description: `Batch ${ops.length} file operations in ${dir}`,
          impact: ops.length > 5 ? 'high' : 'medium',
          confidence: 0.8
        });
      }
    }
    
    if (improvements.length > 0) {
      return { plan: optimizedPlan, improvements };
    }
    
    return null;
  }

  /**
   * Apply reordering optimization
   */
  private applyReordering(
    plan: ExecutionPlan,
    context: OperationContext
  ): Promise<{ plan: ExecutionPlan; improvements: OptimizationImprovement[] } | null> {
    const reordered = this.optimizeOrderForDependencies(plan.steps);
    
    if (JSON.stringify(reordered) === JSON.stringify(plan.steps)) {
      return Promise.resolve(null);
    }
    
    const optimizedPlan = {
      ...plan,
      steps: reordered
    };
    
    const improvements: OptimizationImprovement[] = [{
      type: 'reordering',
      description: 'Reordered operations to minimize dependencies',
      impact: 'medium',
      confidence: 0.7
    }];
    
    return Promise.resolve({ plan: optimizedPlan, improvements });
  }

  /**
   * Apply parallelization optimization
   */
  private applyParallelization(
    plan: ExecutionPlan,
    context: OperationContext
  ): Promise<{ plan: ExecutionPlan; improvements: OptimizationImprovement[] } | null> {
    const parallelizable = plan.steps.filter(s => this.canParallelize(s));
    
    if (parallelizable.length < 2) {
      return Promise.resolve(null);
    }
    
    const improvements: OptimizationImprovement[] = [{
      type: 'parallelization',
      description: `${parallelizable.length} operations can run in parallel`,
      impact: parallelizable.length > 3 ? 'high' : 'medium',
      confidence: 0.9
    }];
    
    return Promise.resolve({ plan, improvements });
  }

  /**
   * Apply elimination optimization
   */
  private applyElimination(
    plan: ExecutionPlan,
    context: OperationContext
  ): Promise<{ plan: ExecutionPlan; improvements: OptimizationImprovement[] } | null> {
    const redundant = this.findRedundantOperations(plan.steps);
    
    if (redundant.length === 0) {
      return Promise.resolve(null);
    }
    
    const optimizedSteps = plan.steps.filter((_, index) => !redundant.includes(index));
    const optimizedPlan = {
      ...plan,
      steps: optimizedSteps
    };
    
    const improvements: OptimizationImprovement[] = [{
      type: 'elimination',
      description: `Removed ${redundant.length} redundant operations`,
      impact: redundant.length > 2 ? 'high' : 'medium',
      confidence: 0.95
    }];
    
    return Promise.resolve({ plan: optimizedPlan, improvements });
  }

  /**
   * Apply caching optimization
   */
  private applyCaching(
    plan: ExecutionPlan,
    context: OperationContext
  ): Promise<{ plan: ExecutionPlan; improvements: OptimizationImprovement[] } | null> {
    const cacheable = plan.steps.filter(s => this.canCache(s));
    
    if (cacheable.length === 0) {
      return Promise.resolve(null);
    }
    
    const improvements: OptimizationImprovement[] = [{
      type: 'caching',
      description: `${cacheable.length} operations can be cached`,
      impact: 'medium',
      confidence: 0.6
    }];
    
    return Promise.resolve({ plan, improvements });
  }

  // Helper methods
  private canBatch(operation: PlannedOperation): boolean {
    return operation.type === 'writeFile' || 
           operation.type === 'editFile' ||
           (operation.type === 'execCommand' && 
            operation.command?.startsWith('git') === true);
  }

  private canParallelize(operation: PlannedOperation): boolean {
    // Commands that can run independently
    if (operation.type === 'execCommand') {
      const safeCommands = ['git status', 'npm test', 'eslint', 'prettier'];
      return safeCommands.some(cmd => operation.command?.startsWith(cmd));
    }
    
    // File operations on different paths can be parallelized
    return operation.type === 'writeFile' || operation.type === 'editFile';
  }

  private canCache(operation: PlannedOperation): boolean {
    // Read-only commands can be cached
    if (operation.type === 'execCommand') {
      const readOnlyCommands = ['git status', 'git diff', 'npm ls'];
      return readOnlyCommands.some(cmd => operation.command?.startsWith(cmd));
    }
    
    return false;
  }

  private areCompatible(op1: PlannedOperation, op2: PlannedOperation): boolean {
    // Same type operations are often compatible
    if (op1.type !== op2.type) return false;
    
    // File operations in different directories are compatible
    if (op1.type === 'writeFile' && op1.path && op2.path) {
      const dir1 = op1.path.split('/').slice(0, -1).join('/');
      const dir2 = op2.path.split('/').slice(0, -1).join('/');
      return dir1 === dir2;
    }
    
    return true;
  }

  private hasDependency(op1: PlannedOperation, op2: PlannedOperation): boolean {
    // Simple dependency check - more sophisticated version would parse actual dependencies
    if (op1.type === 'writeFile' && op2.type === 'editFile') {
      return op1.path === op2.path;
    }
    
    if (op1.type === 'deleteFile' && (op2.type === 'writeFile' || op2.type === 'editFile')) {
      return op1.path === op2.path;
    }
    
    return false;
  }

  private findDependencies(operation: PlannedOperation, allOps: PlannedOperation[]): string[] {
    return allOps
      .filter(op => this.hasDependency(op, operation))
      .map(op => `${op.type}:${op.path || op.command}`);
  }

  private optimizeBatchOrder(batches: BatchOperation[]): BatchOperation[] {
    // Sort batches by dependencies and estimated duration
    return batches.sort((a, b) => {
      // Batches with dependencies should go first
      if (a.dependencies.length !== b.dependencies.length) {
        return a.dependencies.length - b.dependencies.length;
      }
      
      // Shorter batches first for faster completion
      return a.estimatedDuration - b.estimatedDuration;
    });
  }

  private analyzePatterns(operations: PlannedOperation[]): {
    repeated: PlannedOperation[];
    sequential: PlannedOperation[][];
  } {
    const repeated: PlannedOperation[] = [];
    const sequential: PlannedOperation[][] = [];
    
    // Find repeated operations
    const opCounts = new Map<string, number>();
    for (const op of operations) {
      const key = `${op.type}:${op.path || op.command}`;
      opCounts.set(key, (opCounts.get(key) || 0) + 1);
    }
    
    for (const [key, count] of opCounts) {
      if (count > 1) {
        const parts = key.split(':');
        repeated.push({
          type: parts[0] as any,
          path: parts[1],
          estimatedRisk: 'low'
        });
      }
    }
    
    return { repeated, sequential };
  }

  private findRedundantOperations(operations: PlannedOperation[]): number[] {
    const redundant: number[] = [];
    const seen = new Set<string>();
    
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      const key = `${op.type}:${op.path || op.command}`;
      
      if (seen.has(key)) {
        redundant.push(i);
      } else {
        seen.add(key);
      }
    }
    
    return redundant;
  }

  private optimizeOrderForDependencies(operations: PlannedOperation[]): PlannedOperation[] {
    const sorted = [...operations];
    
    // Simple topological sort based on file dependencies
    sorted.sort((a, b) => {
      // Delete operations should come last
      if (a.type === 'deleteFile' && b.type !== 'deleteFile') return 1;
      if (b.type === 'deleteFile' && a.type !== 'deleteFile') return -1;
      
      // Create operations should come before edit operations
      if (a.type === 'writeFile' && b.type === 'editFile') return -1;
      if (b.type === 'writeFile' && a.type === 'editFile') return 1;
      
      return 0;
    });
    
    return sorted;
  }

  private calculateSpeedup(original: ExecutionPlan, optimized: ExecutionPlan): number {
    const originalDuration = original.estimatedDuration;
    const optimizedDuration = optimized.estimatedDuration;
    
    if (optimizedDuration === 0) return 1;
    
    return originalDuration / optimizedDuration;
  }

  private calculateResourceSavings(original: ExecutionPlan, optimized: ExecutionPlan): ResourceSavings {
    const timeSaved = original.estimatedDuration - optimized.estimatedDuration;
    
    return {
      timeMs: Math.max(0, timeSaved),
      memoryMB: 0, // Would need more sophisticated analysis
      diskIOMB: 0,
      networkRequests: 0
    };
  }

  private assessRiskChange(original: ExecutionPlan, optimized: ExecutionPlan): 'reduced' | 'unchanged' | 'increased' {
    const originalRiskScore = this.getRiskScore(original.risk.level);
    const optimizedRiskScore = this.getRiskScore(optimized.risk.level);
    
    if (optimizedRiskScore < originalRiskScore) return 'reduced';
    if (optimizedRiskScore > originalRiskScore) return 'increased';
    return 'unchanged';
  }

  private getRiskScore(level: string): number {
    const scores: Record<string, number> = {
      'low': 1,
      'medium': 2,
      'high': 3,
      'critical': 4,
      'blocked': 5
    };
    return scores[level] || 2;
  }

  private estimateOperationDuration(operation: PlannedOperation): number {
    switch (operation.type) {
      case 'writeFile':
      case 'editFile':
      case 'deleteFile':
        return 100; // 100ms for file operations
      
      case 'execCommand':
        if (operation.command?.includes('test')) return 5000; // 5s for tests
        if (operation.command?.includes('build')) return 10000; // 10s for builds
        return 1000; // 1s for other commands
      
      case 'networkRequest':
        return 2000; // 2s for network requests
      
      default:
        return 500;
    }
  }
}