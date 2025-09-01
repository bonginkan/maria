/**
 * RiskAssessor - Evaluates risk levels for planned operations
 * Provides comprehensive risk analysis for security decisions
 */

import { ExecutionPlan, PlannedOperation, OperationContext } from '../core/AutonomousExecutor';

export interface RiskAssessment {
  level: 'low' | 'medium' | 'high' | 'critical' | 'blocked';
  factors: RiskFactor[];
  score: number; // 0-100
  recommendation: string;
  mitigations?: string[];
}

export interface RiskFactor {
  type: RiskFactorType;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number; // 0-100
}

export type RiskFactorType =
  | 'file_system'
  | 'network'
  | 'execution'
  | 'data_loss'
  | 'security'
  | 'performance'
  | 'dependency';

export class RiskAssessor {
  private readonly criticalPaths = [
    '/etc',
    '/var',
    '/usr',
    '/System',
    'C:\\Windows',
    'C:\\Program Files'
  ];

  private readonly sensitiveFiles = [
    '.env',
    '.env.local',
    '.env.production',
    'credentials',
    'secrets',
    'private',
    'id_rsa',
    'id_ed25519',
    '.ssh',
    '.aws',
    '.git/config'
  ];

  private readonly dangerousCommands = [
    'rm -rf',
    'format',
    'mkfs',
    'dd',
    'sudo',
    'chmod 777',
    'chown',
    ':(){:|:&};:' // Fork bomb
  ];

  /**
   * Assess risk for an execution plan
   */
  async assess(plan: ExecutionPlan, context: OperationContext): Promise<RiskAssessment> {
    const factors: RiskFactor[] = [];
    
    // Assess each operation
    for (const operation of plan.steps) {
      const operationFactors = await this.assessOperation(operation, context);
      factors.push(...operationFactors);
    }

    // Assess overall plan characteristics
    const planFactors = this.assessPlanCharacteristics(plan, context);
    factors.push(...planFactors);

    // Calculate total risk score
    const score = this.calculateRiskScore(factors);
    const level = this.determineRiskLevel(score, factors);
    
    // Generate recommendations
    const recommendation = this.generateRecommendation(level, factors);
    const mitigations = this.suggestMitigations(factors);

    return {
      level,
      factors,
      score,
      recommendation,
      mitigations: mitigations.length > 0 ? mitigations : undefined
    };
  }

  /**
   * Assess risk for a single operation
   */
  private async assessOperation(
    operation: PlannedOperation,
    context: OperationContext
  ): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    switch (operation.type) {
      case 'writeFile':
      case 'editFile':
        factors.push(...this.assessFileWrite(operation));
        break;
      
      case 'deleteFile':
        factors.push(...this.assessFileDelete(operation));
        break;
      
      case 'execCommand':
        factors.push(...this.assessCommandExecution(operation));
        break;
      
      case 'networkRequest':
        factors.push(...this.assessNetworkRequest(operation));
        break;
    }

    return factors;
  }

  /**
   * Assess file write operations
   */
  private assessFileWrite(operation: PlannedOperation): RiskFactor[] {
    const factors: RiskFactor[] = [];
    const path = operation.path || '';

    // Check for sensitive files
    if (this.isSensitiveFile(path)) {
      factors.push({
        type: 'security',
        description: `Writing to sensitive file: ${path}`,
        severity: 'critical',
        score: 90
      });
    }

    // Check for system paths
    if (this.isSystemPath(path)) {
      factors.push({
        type: 'file_system',
        description: `Writing to system directory: ${path}`,
        severity: 'critical',
        score: 95
      });
    }

    // Check for configuration files
    if (path.includes('config') || path.endsWith('.json')) {
      factors.push({
        type: 'file_system',
        description: `Modifying configuration file: ${path}`,
        severity: 'medium',
        score: 40
      });
    }

    // Check for large content
    if (operation.content && operation.content.length > 100000) {
      factors.push({
        type: 'performance',
        description: 'Large file write operation',
        severity: 'medium',
        score: 35
      });
    }

    return factors;
  }

  /**
   * Assess file delete operations
   */
  private assessFileDelete(operation: PlannedOperation): RiskFactor[] {
    const factors: RiskFactor[] = [];
    const path = operation.path || '';

    // Deletion is always risky
    factors.push({
      type: 'data_loss',
      description: `File deletion: ${path}`,
      severity: 'medium',
      score: 50
    });

    // Critical if system file
    if (this.isSystemPath(path)) {
      factors.push({
        type: 'file_system',
        description: `Deleting system file: ${path}`,
        severity: 'critical',
        score: 100
      });
    }

    // High risk for configuration files
    if (path.includes('config') || path.includes('package.json')) {
      factors.push({
        type: 'dependency',
        description: `Deleting configuration: ${path}`,
        severity: 'high',
        score: 70
      });
    }

    return factors;
  }

  /**
   * Assess command execution
   */
  private assessCommandExecution(operation: PlannedOperation): RiskFactor[] {
    const factors: RiskFactor[] = [];
    const command = operation.command || '';

    // Check for dangerous commands
    for (const dangerous of this.dangerousCommands) {
      if (command.includes(dangerous)) {
        factors.push({
          type: 'execution',
          description: `Dangerous command detected: ${dangerous}`,
          severity: 'critical',
          score: 100
        });
      }
    }

    // Check for sudo/admin
    if (command.includes('sudo') || command.includes('runas')) {
      factors.push({
        type: 'security',
        description: 'Elevated privileges requested',
        severity: 'high',
        score: 80
      });
    }

    // Check for network commands
    if (command.includes('curl') || command.includes('wget') || command.includes('nc')) {
      factors.push({
        type: 'network',
        description: 'Network access in command',
        severity: 'medium',
        score: 45
      });
    }

    // Check for package installation
    if (command.includes('install') || command.includes('add')) {
      factors.push({
        type: 'dependency',
        description: 'Package installation detected',
        severity: 'medium',
        score: 40
      });
    }

    return factors;
  }

  /**
   * Assess network requests
   */
  private assessNetworkRequest(operation: PlannedOperation): RiskFactor[] {
    const factors: RiskFactor[] = [];
    const url = operation.url || '';
    const method = operation.method || 'GET';

    // All network requests have baseline risk
    factors.push({
      type: 'network',
      description: `Network request to: ${url}`,
      severity: 'medium',
      score: 50
    });

    // POST/PUT/DELETE are riskier
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase())) {
      factors.push({
        type: 'network',
        description: `Data modification via ${method}`,
        severity: 'high',
        score: 70
      });
    }

    // External domains are riskier
    try {
      const urlObj = new URL(url);
      if (!urlObj.hostname.includes('localhost') && !urlObj.hostname.includes('127.0.0.1')) {
        factors.push({
          type: 'network',
          description: 'External network access',
          severity: 'high',
          score: 65
        });
      }
    } catch {
      // Invalid URL
      factors.push({
        type: 'network',
        description: 'Invalid URL format',
        severity: 'medium',
        score: 40
      });
    }

    return factors;
  }

  /**
   * Assess overall plan characteristics
   */
  private assessPlanCharacteristics(plan: ExecutionPlan, context: OperationContext): RiskFactor[] {
    const factors: RiskFactor[] = [];

    // Many operations increase risk
    if (plan.steps.length > 10) {
      factors.push({
        type: 'execution',
        description: `Large operation count: ${plan.steps.length}`,
        severity: 'medium',
        score: 35
      });
    }

    // Mixed operation types increase complexity
    const operationTypes = new Set(plan.steps.map(s => s.type));
    if (operationTypes.size > 3) {
      factors.push({
        type: 'execution',
        description: 'Complex multi-type operation',
        severity: 'medium',
        score: 40
      });
    }

    // Read-write mode is riskier
    if (context.mode === 'read-write') {
      factors.push({
        type: 'execution',
        description: 'Read-write mode execution',
        severity: 'low',
        score: 20
      });
    }

    return factors;
  }

  /**
   * Check if file is sensitive
   */
  private isSensitiveFile(path: string): boolean {
    const lowerPath = path.toLowerCase();
    return this.sensitiveFiles.some(sensitive => 
      lowerPath.includes(sensitive.toLowerCase())
    );
  }

  /**
   * Check if path is system directory
   */
  private isSystemPath(path: string): boolean {
    const normalizedPath = path.replace(/\\/g, '/');
    return this.criticalPaths.some(critical => 
      normalizedPath.startsWith(critical)
    );
  }

  /**
   * Calculate total risk score
   */
  private calculateRiskScore(factors: RiskFactor[]): number {
    if (factors.length === 0) return 0;

    // Take the maximum score as base
    const maxScore = Math.max(...factors.map(f => f.score));
    
    // Add weighted average of other scores
    const avgOtherScores = factors
      .filter(f => f.score < maxScore)
      .reduce((sum, f) => sum + f.score * 0.2, 0);
    
    return Math.min(100, maxScore + avgOtherScores);
  }

  /**
   * Determine risk level from score
   */
  private determineRiskLevel(
    score: number,
    factors: RiskFactor[]
  ): 'low' | 'medium' | 'high' | 'critical' | 'blocked' {
    // Any critical factor with score 100 means blocked
    const hasCriticalBlocker = factors.some(f => f.severity === 'critical' && f.score >= 100);
    if (hasCriticalBlocker) {
      return 'blocked';
    }

    // Score-based levels
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  /**
   * Generate risk recommendation
   */
  private generateRecommendation(
    level: 'low' | 'medium' | 'high' | 'critical' | 'blocked',
    factors: RiskFactor[]
  ): string {
    switch (level) {
      case 'blocked':
        return 'Operation blocked due to unacceptable security risk. Manual intervention required.';
      
      case 'critical':
        return 'Critical risk detected. Requires explicit approval from authorized personnel.';
      
      case 'high':
        return 'High risk operation. Careful review recommended before proceeding.';
      
      case 'medium':
        return 'Moderate risk detected. Standard approval process applies.';
      
      case 'low':
        return 'Low risk operation. Can proceed with standard safeguards.';
      
      default:
        return 'Risk assessment complete.';
    }
  }

  /**
   * Suggest risk mitigations
   */
  private suggestMitigations(factors: RiskFactor[]): string[] {
    const mitigations: string[] = [];

    // Check for specific risk types
    const hasFileRisk = factors.some(f => f.type === 'file_system');
    const hasNetworkRisk = factors.some(f => f.type === 'network');
    const hasExecutionRisk = factors.some(f => f.type === 'execution');
    const hasDataLossRisk = factors.some(f => f.type === 'data_loss');

    if (hasFileRisk) {
      mitigations.push('Create backup before modifying files');
      mitigations.push('Verify file paths are within allowed directories');
    }

    if (hasNetworkRisk) {
      mitigations.push('Use sandbox environment with network isolation');
      mitigations.push('Validate and sanitize all network endpoints');
    }

    if (hasExecutionRisk) {
      mitigations.push('Run commands in restricted sandbox');
      mitigations.push('Use timeout limits for long-running operations');
    }

    if (hasDataLossRisk) {
      mitigations.push('Create checkpoint before deletion');
      mitigations.push('Implement soft-delete with recovery option');
    }

    return mitigations;
  }
}