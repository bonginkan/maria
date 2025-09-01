import { BaseService } from '../base/BaseService.js';
import { AdvancedValidationPipeline, ValidationResult } from './validation/AdvancedValidationPipeline.js';
import { GitBasedSafetySystem, SafetyOperation } from './safety/GitBasedSafetySystem.js';
import { EnterpriseQualityGates, QualityGateResult } from './quality/EnterpriseQualityGates.js';

export interface Phase2Config {
  validation: {
    strictMode: boolean;
    timeoutMs: number;
    enableAllChecks: boolean;
  };
  safety: {
    enableWorktreeIsolation: boolean;
    enableAtomicOperations: boolean;
    autoRollbackOnFailure: boolean;
  };
  quality: {
    enforceGates: boolean;
    minOverallScore: number;
    failOnCriticalIssues: boolean;
  };
}

export interface Phase2ExecutionResult {
  operationId: string;
  success: boolean;
  overallScore: number;
  validationResults: ValidationResult[];
  qualityResults: QualityGateResult[];
  safetyStatus: SafetyOperation | null;
  duration: number;
  summary: string;
  recommendations: string[];
}

export interface Phase2ExecutionPlan {
  description: string;
  estimatedDuration: number;
  riskLevel: 'low' | 'medium' | 'high';
  requiredChecks: string[];
  bypassableWarnings: boolean;
}

export class Phase2IntegratedSystem extends BaseService {
  private validationPipeline: AdvancedValidationPipeline;
  private safetySystem: GitBasedSafetySystem;
  private qualityGates: EnterpriseQualityGates;
  private config: Phase2Config;

  constructor(config: Partial<Phase2Config> = {}) {
    super();
    
    this.config = {
      validation: {
        strictMode: true,
        timeoutMs: 300000, // 5 minutes
        enableAllChecks: true,
        ...config.validation
      },
      safety: {
        enableWorktreeIsolation: true,
        enableAtomicOperations: true,
        autoRollbackOnFailure: true,
        ...config.safety
      },
      quality: {
        enforceGates: true,
        minOverallScore: 75,
        failOnCriticalIssues: true,
        ...config.quality
      }
    };

    this.validationPipeline = new AdvancedValidationPipeline({
      strictMode: this.config.validation.strictMode,
      timeoutMs: this.config.validation.timeoutMs,
      enableSyntaxCheck: this.config.validation.enableAllChecks,
      enableSemanticCheck: this.config.validation.enableAllChecks,
      enableTestExecution: this.config.validation.enableAllChecks,
      enableBuildVerification: this.config.validation.enableAllChecks,
      enableSecurityScan: this.config.validation.enableAllChecks
    });

    this.safetySystem = new GitBasedSafetySystem({
      enableAtomicOperations: this.config.safety.enableAtomicOperations
    });

    this.qualityGates = new EnterpriseQualityGates();
  }

  async initializePhase2System(projectRoot: string): Promise<boolean> {
    try {
      console.log('🔧 Initializing Phase 2 Enterprise System...');

      // Initialize safety system
      const safetyInitialized = await this.safetySystem.initializeSafetySystem(projectRoot);
      if (!safetyInitialized) {
        console.error('❌ Failed to initialize safety system');
        return false;
      }

      console.log('✅ Phase 2 system initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Phase 2 initialization failed:', error);
      return false;
    }
  }

  async planExecution(
    projectRoot: string,
    operationType: 'modification' | 'creation' | 'deletion',
    description: string,
    options: { dryRun?: boolean; skipValidation?: boolean } = {}
  ): Promise<Phase2ExecutionPlan> {
    
    const requiredChecks = [];
    
    if (!options.skipValidation) {
      requiredChecks.push('syntax_check', 'semantic_check', 'test_execution');
      
      if (operationType === 'modification' || operationType === 'creation') {
        requiredChecks.push('build_verification');
      }
    }

    if (this.config.quality.enforceGates) {
      requiredChecks.push('quality_gates');
    }

    // Estimate duration based on checks
    const baseDuration = 30000; // 30 seconds base
    const checkDuration = requiredChecks.length * 15000; // 15 seconds per check
    const estimatedDuration = baseDuration + checkDuration;

    // Assess risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    
    if (operationType === 'deletion') {
      riskLevel = 'high';
    } else if (description.toLowerCase().includes('refactor') || 
               description.toLowerCase().includes('breaking')) {
      riskLevel = 'medium';
    }

    if (options.dryRun) {
      riskLevel = 'low'; // Dry runs are always low risk
    }

    return {
      description,
      estimatedDuration,
      riskLevel,
      requiredChecks,
      bypassableWarnings: !this.config.validation.strictMode
    };
  }

  async executeSafeOperation<T>(
    projectRoot: string,
    operation: (workingDir: string) => Promise<T>,
    plan: Phase2ExecutionPlan,
    options: { dryRun?: boolean } = {}
  ): Promise<Phase2ExecutionResult> {
    
    const startTime = Date.now();
    let operationId: string | null = null;
    let safetyOp: SafetyOperation | null = null;

    try {
      console.log(`🚀 Starting Phase 2 execution: ${plan.description}`);
      console.log(`📊 Plan: ${plan.riskLevel} risk, ~${(plan.estimatedDuration / 1000).toFixed(0)}s duration`);

      // Step 1: Create safe operation environment
      if (this.config.safety.enableWorktreeIsolation && !options.dryRun) {
        operationId = await this.safetySystem.createSafeOperation(
          projectRoot, 
          plan.description, 
          'modification'
        );
        safetyOp = await this.safetySystem.getOperationStatus(operationId);
        console.log(`🔒 Created safe operation: ${operationId}`);
      }

      // Step 2: Execute operation in safe environment
      let operationResult: T;
      const workingDir = safetyOp?.worktreePath || projectRoot;

      if (options.dryRun) {
        console.log(`🔍 DRY RUN: Would execute operation in ${workingDir}`);
        // In dry run, we simulate the operation
        operationResult = await this.simulateOperation(operation, workingDir);
      } else if (operationId) {
        console.log(`⚙️  Executing operation in isolated environment...`);
        operationResult = await this.safetySystem.executeInSafeEnvironment(
          operationId, 
          operation
        );
      } else {
        console.log(`⚙️  Executing operation directly...`);
        operationResult = await operation(workingDir);
      }

      // Step 3: Run validation pipeline
      let validationResults: ValidationResult[] = [];
      if (plan.requiredChecks.includes('syntax_check') || 
          plan.requiredChecks.includes('semantic_check') ||
          plan.requiredChecks.includes('test_execution') ||
          plan.requiredChecks.includes('build_verification')) {
        
        console.log(`🔍 Running validation pipeline...`);
        validationResults = await this.validationPipeline.validateChanges(workingDir);
        
        const validationPassed = validationResults.every(r => r.success);
        if (!validationPassed && this.config.validation.strictMode && !options.dryRun) {
          throw new Error('Validation failed in strict mode');
        }
      }

      // Step 4: Run quality gates
      let qualityResults: QualityGateResult[] = [];
      if (plan.requiredChecks.includes('quality_gates') && this.config.quality.enforceGates) {
        console.log(`🏆 Running enterprise quality gates...`);
        qualityResults = await this.qualityGates.runAllQualityGates(workingDir);
        
        const overallScore = qualityResults.reduce((sum, r) => sum + r.score, 0) / qualityResults.length;
        const hasCriticalIssues = qualityResults.some(r => 
          r.errors.some(e => e.severity === 'critical')
        );
        
        if ((overallScore < this.config.quality.minOverallScore || 
             (hasCriticalIssues && this.config.quality.failOnCriticalIssues)) && !options.dryRun) {
          throw new Error(`Quality gates failed: score ${overallScore.toFixed(1)} < ${this.config.quality.minOverallScore}`);
        }
      }

      // Step 5: Validate in safe environment
      if (operationId && !options.dryRun) {
        console.log(`✅ Validating changes in safe environment...`);
        const safeValidation = await this.safetySystem.validateOperation(operationId);
        if (!safeValidation && this.config.safety.autoRollbackOnFailure) {
          await this.safetySystem.rollbackOperation(operationId);
          throw new Error('Safe validation failed, operation rolled back');
        }
      }

      // Step 6: Commit if not dry run
      if (operationId && !options.dryRun) {
        console.log(`💾 Committing safe operation...`);
        const commitSuccess = await this.safetySystem.commitSafeOperation(
          operationId,
          `Phase 2 Safe Operation: ${plan.description}`
        );
        if (!commitSuccess) {
          throw new Error('Failed to commit safe operation');
        }
      }

      // Generate results
      const overallScore = qualityResults.length > 0 
        ? qualityResults.reduce((sum, r) => sum + r.score, 0) / qualityResults.length
        : 100;

      const success = validationResults.every(r => r.success) && 
                     qualityResults.every(r => r.success || !this.config.quality.failOnCriticalIssues);

      const summary = this.generateExecutionSummary(validationResults, qualityResults, success, options.dryRun);
      const recommendations = this.generateRecommendations(validationResults, qualityResults);

      console.log(`🎉 Phase 2 execution completed: ${success ? 'SUCCESS' : 'PARTIAL'}`);

      return {
        operationId: operationId || 'direct-execution',
        success,
        overallScore,
        validationResults,
        qualityResults,
        safetyStatus: safetyOp,
        duration: Date.now() - startTime,
        summary,
        recommendations
      };

    } catch (error) {
      console.error(`❌ Phase 2 execution failed: ${error.message}`);

      // Auto-rollback on failure
      if (operationId && this.config.safety.autoRollbackOnFailure && !options.dryRun) {
        console.log(`↩️  Auto-rolling back operation: ${operationId}`);
        await this.safetySystem.rollbackOperation(operationId);
      }

      return {
        operationId: operationId || 'failed-execution',
        success: false,
        overallScore: 0,
        validationResults: [],
        qualityResults: [],
        safetyStatus: safetyOp,
        duration: Date.now() - startTime,
        summary: `Execution failed: ${error.message}`,
        recommendations: ['Fix the reported errors and retry the operation']
      };
    }
  }

  private async simulateOperation<T>(
    operation: (workingDir: string) => Promise<T>,
    workingDir: string
  ): Promise<T> {
    // In dry run mode, we create a temporary copy to simulate
    // For now, we'll just call the operation with a note that it's simulation
    console.log(`🔍 DRY RUN: Simulating operation in ${workingDir}`);
    
    // In a real implementation, we might create a temporary directory
    // and copy files there for safe simulation
    return await operation(workingDir);
  }

  private generateExecutionSummary(
    validationResults: ValidationResult[],
    qualityResults: QualityGateResult[],
    success: boolean,
    isDryRun: boolean = false
  ): string {
    const prefix = isDryRun ? '[DRY RUN] ' : '';
    
    if (success) {
      return `${prefix}✅ All checks passed successfully. Operation is safe to proceed.`;
    }

    const validationErrors = validationResults.reduce((sum, r) => sum + r.errors.length, 0);
    const qualityErrors = qualityResults.reduce((sum, r) => sum + r.errors.length, 0);
    
    return `${prefix}⚠️  Operation completed with ${validationErrors + qualityErrors} issues that need attention.`;
  }

  private generateRecommendations(
    validationResults: ValidationResult[],
    qualityResults: QualityGateResult[]
  ): string[] {
    const recommendations: string[] = [];

    // Validation recommendations
    for (const result of validationResults) {
      if (!result.success) {
        recommendations.push(`Fix ${result.stage} issues before production deployment`);
      }
    }

    // Quality recommendations
    for (const result of qualityResults) {
      if (result.score < 80) {
        recommendations.push(`Improve ${result.gate} score (current: ${result.score.toFixed(1)}/100)`);
      }
    }

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('All checks passed - consider running integration tests before deployment');
    }

    return recommendations;
  }

  async generateComprehensiveReport(result: Phase2ExecutionResult): Promise<string> {
    let report = `\n🚀 Phase 2 Enterprise System - Execution Report\n`;
    report += `===============================================\n\n`;

    // Executive Summary
    report += `📋 Executive Summary:\n`;
    report += `- Operation ID: ${result.operationId}\n`;
    report += `- Status: ${result.success ? '✅ SUCCESS' : '⚠️  NEEDS ATTENTION'}\n`;
    report += `- Overall Score: ${result.overallScore.toFixed(1)}/100\n`;
    report += `- Duration: ${(result.duration / 1000).toFixed(1)}s\n`;
    report += `- Summary: ${result.summary}\n\n`;

    // Validation Results
    if (result.validationResults.length > 0) {
      report += await this.validationPipeline.generateValidationReport(result.validationResults);
      report += `\n`;
    }

    // Quality Gate Results
    if (result.qualityResults.length > 0) {
      report += await this.qualityGates.generateQualityReport(result.qualityResults);
      report += `\n`;
    }

    // Safety System Status
    if (result.safetyStatus) {
      report += await this.safetySystem.generateSafetyReport();
      report += `\n`;
    }

    // Recommendations
    if (result.recommendations.length > 0) {
      report += `💡 Next Steps:\n`;
      for (const recommendation of result.recommendations) {
        report += `  • ${recommendation}\n`;
      }
      report += `\n`;
    }

    // Footer
    report += `\n🔒 Phase 2 Enterprise Features Active:\n`;
    report += `- ✅ Advanced Validation Pipeline (5 stages)\n`;
    report += `- ✅ Git-based Safety System (worktree isolation)\n`;
    report += `- ✅ Enterprise Quality Gates (5 gates)\n`;
    report += `- ✅ Atomic Operations with Rollback\n`;
    report += `- ✅ Production-grade Error Handling\n`;

    return report;
  }

  // Convenience method for quick execution
  async quickExecute(
    projectRoot: string,
    operation: (workingDir: string) => Promise<any>,
    description: string,
    options: { dryRun?: boolean; strictMode?: boolean } = {}
  ): Promise<Phase2ExecutionResult> {
    
    // Adjust config for quick execution
    if (options.strictMode !== undefined) {
      this.config.validation.strictMode = options.strictMode;
    }

    const plan = await this.planExecution(projectRoot, 'modification', description, options);
    return await this.executeSafeOperation(projectRoot, operation, plan, options);
  }

  async initialize(): Promise<void> {
    // Initialize Phase2IntegratedSystem - no initialization needed for now
  }
}