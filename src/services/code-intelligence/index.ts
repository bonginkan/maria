/**
 * Code Intelligence Module - Enterprise TypeScript AST Foundation
 * Week 1-2 Implementation: Public API for AST-based code operations
 */

export { 
  EnterpriseProjectResolver,
  type ProjectReference,
  type TSConfig,
  type PathMapping,
  type SolutionInfo,
  type ResolvedModule,
  type WorkspaceType,
  enterpriseProjectResolver
} from './EnterpriseProjectResolver.js';

export {
  EnterpriseTypeScriptEngine,
  type Change,
  type DiagnosticInfo,
  type FixResult,
  type RefactorType,
  type FeaturePattern,
  enterpriseTypeScriptEngine
} from './EnterpriseTypeScriptEngine.js';

export {
  OptimizedContextSystem,
  type CachedAST,
  type FileContext,
  type SymbolInfo,
  type ImportInfo,
  type ExportInfo,
  type IncrementalGraph,
  type FastSymbolIndex,
  optimizedContextSystem
} from './OptimizedContextSystem.js';

export {
  PerformanceFallbackManager,
  SafetyKillSwitch,
  type PerformanceMetrics,
  type FallbackStrategy,
  type SystemHealth,
  performanceFallbackManager,
  safetyKillSwitch
} from './PerformanceFallbackManager.js';

// Export Phase 2 Enterprise Systems
export { Phase2IntegratedSystem, type Phase2Config, type Phase2ExecutionResult } from './Phase2IntegratedSystem.js';
export { AdvancedValidationPipeline, type ValidationResult, type ValidationConfig } from './validation/AdvancedValidationPipeline.js';
export { GitBasedSafetySystem, type SafetyOperation, type RollbackPoint } from './safety/GitBasedSafetySystem.js';
export { EnterpriseQualityGates, type QualityGateResult, type QualityStandards } from './quality/EnterpriseQualityGates.js';

/**
 * Initialize enterprise code intelligence system
 * Main entry point for AST-based operations
 */
export async function initializeCodeIntelligence(workspaceRoot?: string): Promise<void> {
  const root = workspaceRoot || process.cwd();
  
  console.log('🚀 Initializing Enterprise Code Intelligence...');
  
  try {
    // Initialize AST engine
    await enterpriseTypeScriptEngine.initialize(root);
    
    // Initialize context system
    await optimizedContextSystem.initialize(root);
    
    console.log('✅ Enterprise Code Intelligence initialized successfully');
    console.log(`   - Workspace: ${root}`);
    console.log('   - Ready for AST operations');
    
  } catch (error) {
    console.error('❌ Code Intelligence initialization failed:', error);
    throw error;
  }
}

/**
 * Initialize Phase 2 Enterprise System
 * Complete validation, safety, and quality assurance
 */
export async function initializePhase2System(workspaceRoot?: string): Promise<Phase2IntegratedSystem> {
  const root = workspaceRoot || process.cwd();
  
  console.log('🏆 Initializing Phase 2 Enterprise System...');
  
  try {
    const phase2System = new Phase2IntegratedSystem({
      validation: {
        strictMode: true,
        timeoutMs: 300000,
        enableAllChecks: true
      },
      safety: {
        enableWorktreeIsolation: true,
        enableAtomicOperations: true,
        autoRollbackOnFailure: true
      },
      quality: {
        enforceGates: true,
        minOverallScore: 75,
        failOnCriticalIssues: true
      }
    });

    const initialized = await phase2System.initializePhase2System(root);
    
    if (!initialized) {
      throw new Error('Phase 2 system initialization failed');
    }

    console.log('✅ Phase 2 Enterprise System initialized successfully');
    console.log(`   - Workspace: ${root}`);
    console.log('   - Advanced Validation: ✅ (5 stages)');
    console.log('   - Git Safety System: ✅ (worktree isolation)');
    console.log('   - Quality Gates: ✅ (5 enterprise gates)');
    console.log('   - Ready for enterprise operations');
    
    return phase2System;
    
  } catch (error) {
    console.error('❌ Phase 2 initialization failed:', error);
    throw error;
  }
}

/**
 * Enterprise code operation with full fallback support
 * Week 1-2: FIX_ERROR, REFACTOR, ADD_FEATURE support
 */
export async function executeEnterpriseCodeOperation(
  operation: 'FIX_ERROR' | 'REFACTOR' | 'ADD_FEATURE',
  params: any
): Promise<FixResult> {
  return performanceFallbackManager.executeWithFallback(
    'ast_operation',
    async () => {
      switch (operation) {
        case 'FIX_ERROR':
          return await enterpriseTypeScriptEngine.fixErrors(params.diagnostics);
        
        case 'REFACTOR':
          return await enterpriseTypeScriptEngine.safeRefactor(
            params.type,
            params.file,
            params.options
          );
        
        case 'ADD_FEATURE':
          return await enterpriseTypeScriptEngine.addFeature(
            params.pattern,
            params.context
          );
        
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }
    },
    [
      // Fallback to simpler operations if primary fails
      async () => {
        console.log(`Using fallback for ${operation}`);
        return {
          success: false,
          changes: [],
          diagnostics: [],
          confidence: 0
        };
      }
    ]
  );
}

/**
 * Get file context with performance monitoring
 */
export async function getFileContextWithFallback(filePath: string): Promise<FileContext> {
  return performanceFallbackManager.getContextWithFallback(
    filePath,
    // Fresh analysis
    async () => optimizedContextSystem.getContext(filePath),
    // Cached analysis (future implementation)
    async () => optimizedContextSystem.getContext(filePath),
    // Minimal analysis fallback
    async () => ({
      filePath,
      projectRoot: process.cwd(),
      imports: [],
      exports: [],
      symbols: [],
      dependencies: [],
      lastModified: Date.now()
    })
  );
}

/**
 * Health check for code intelligence system
 */
export function getCodeIntelligenceHealth(): {
  systemHealth: SystemHealth;
  performanceStats: any;
  recommendations: string[];
} {
  const health = performanceFallbackManager.getSystemHealth();
  const stats = performanceFallbackManager.getPerformanceStats();
  
  const recommendations: string[] = [];
  
  // Generate recommendations based on health
  if (health.metrics.errorRate > 0.1) {
    recommendations.push('High error rate detected - consider reducing operation complexity');
  }
  
  if (health.metrics.averageResponseTime > 2000) {
    recommendations.push('Slow response times - consider enabling more aggressive caching');
  }
  
  if (health.metrics.fallbackRate > 0.3) {
    recommendations.push('High fallback usage - primary operations may need optimization');
  }
  
  if (health.overallHealth === 'degraded') {
    recommendations.push('System performance degraded - monitor resource usage');
  }
  
  if (health.overallHealth === 'critical') {
    recommendations.push('CRITICAL: System performance critical - consider emergency mode');
  }
  
  return {
    systemHealth: health,
    performanceStats: stats,
    recommendations
  };
}

/**
 * Dispose all code intelligence resources
 */
export async function disposeCodeIntelligence(): Promise<void> {
  console.log('🛑 Disposing Code Intelligence resources...');
  
  try {
    await optimizedContextSystem.dispose();
    enterpriseTypeScriptEngine.dispose();
    performanceFallbackManager.dispose();
    
    console.log('✅ Code Intelligence disposed successfully');
  } catch (error) {
    console.error('Error disposing Code Intelligence:', error);
  }
}