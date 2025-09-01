/**
 * Policy Engine with version management and hot cache
 * Handles policy evaluation, rule matching, and configuration management
 */

import { EventEmitter } from 'events';
import type { 
  RoutingPolicy, 
  RoutingRule, 
  RuleCondition, 
  RuleAction, 
  TaskConfiguration,
  ABTestConfiguration 
} from './types/RoutingPolicy.js';
import type { TaskInput, ProcessedTaskInput } from './types/TaskInput.js';

export interface PolicyEvaluationResult {
  /** Matched rules in priority order */
  matchedRules: RoutingRule[];
  
  /** Final merged configuration */
  finalConfig: TaskConfiguration & RuleAction;
  
  /** A/B test assignment if applicable */
  abTestAssignment?: {
    testName: string;
    group: 'control' | 'treatment';
    shadowOnly: boolean;
  };
  
  /** Evaluation trace for debugging */
  evaluationTrace: {
    ruleId: string;
    matched: boolean;
    reason: string;
    appliedActions?: Partial<RuleAction>;
  }[];
}

export interface PolicyCacheEntry {
  policy: RoutingPolicy;
  version: string;
  cachedAt: Date;
  lastAccessedAt: Date;
  hitCount: number;
}

export class PolicyEngine extends EventEmitter {
  private readonly policyCache = new Map<string, PolicyCacheEntry>();
  private readonly configChangeListeners = new Map<string, () => void>();
  private isInitialized = false;
  
  constructor(
    private readonly firestoreClient: any, // Will be injected
    private readonly options: {
      cacheExpirationMs: number;
      maxCacheSize: number;
      enableHotReload: boolean;
    } = {
      cacheExpirationMs: 300000, // 5 minutes
      maxCacheSize: 100,
      enableHotReload: true
    }
  ) {
    super();
  }

  /**
   * Initialize the policy engine with hot cache setup
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Set up configuration change listeners if hot reload is enabled
    if (this.options.enableHotReload) {
      await this.setupConfigurationListeners();
    }

    // Preload default policy
    await this.getPolicy('default');
    
    this.isInitialized = true;
    this.emit('initialized');
  }

  /**
   * Get policy with hot cache support
   */
  async getPolicy(policyId: string): Promise<RoutingPolicy> {
    const cached = this.policyCache.get(policyId);
    
    // Check cache validity
    if (cached && this.isCacheValid(cached)) {
      cached.lastAccessedAt = new Date();
      cached.hitCount++;
      return cached.policy;
    }

    // Load from Firestore
    const policy = await this.loadPolicyFromFirestore(policyId);
    
    // Update cache
    this.updateCache(policyId, policy);
    
    return policy;
  }

  /**
   * Evaluate task against policy and return routing configuration
   */
  async evaluatePolicy(
    task: ProcessedTaskInput, 
    policyId = 'default'
  ): Promise<PolicyEvaluationResult> {
    const startTime = Date.now();
    const policy = await this.getPolicy(policyId);
    
    // Get base configuration for task type
    const baseConfig = policy.taskMatrix[task.task.kind] || this.getDefaultTaskConfig();
    
    // Evaluate rules in priority order
    const matchedRules: RoutingRule[] = [];
    const evaluationTrace: PolicyEvaluationResult['evaluationTrace'] = [];
    let finalConfig = { ...baseConfig };

    // Sort rules by priority (higher number = higher priority)
    const sortedRules = [...policy.rules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (!rule.enabled) {
        evaluationTrace.push({
          ruleId: rule.id,
          matched: false,
          reason: 'Rule disabled'
        });
        continue;
      }

      const matchResult = this.evaluateRuleCondition(rule.when, task);
      
      evaluationTrace.push({
        ruleId: rule.id,
        matched: matchResult.matched,
        reason: matchResult.reason,
        appliedActions: matchResult.matched ? rule.then : undefined
      });

      if (matchResult.matched) {
        matchedRules.push(rule);
        finalConfig = this.mergeConfiguration(finalConfig, rule.then);
      }
    }

    // Handle A/B tests
    const abTestAssignment = await this.evaluateABTests(policy.abTests || [], task);
    if (abTestAssignment && !abTestAssignment.shadowOnly) {
      // Apply A/B test overrides to control group
      if (abTestAssignment.group === 'treatment') {
        const testConfig = policy.abTests?.find(t => t.name === abTestAssignment.testName);
        if (testConfig?.override) {
          finalConfig = this.mergeConfiguration(finalConfig, testConfig.override);
        }
      }
    }

    // Check for emergency overrides
    const emergencyOverride = this.getActiveEmergencyOverride(policy);
    if (emergencyOverride) {
      finalConfig = this.applyEmergencyOverride(finalConfig, emergencyOverride);
    }

    const evaluationTime = Date.now() - startTime;
    this.emit('policyEvaluated', {
      policyId,
      taskKind: task.task.kind,
      matchedRulesCount: matchedRules.length,
      evaluationTimeMs: evaluationTime,
      abTestAssignment
    });

    return {
      matchedRules,
      finalConfig,
      abTestAssignment,
      evaluationTrace
    };
  }

  /**
   * Reproduce policy evaluation with snapshot
   */
  async reproduceEvaluation(
    task: ProcessedTaskInput,
    policySnapshot: any
  ): Promise<PolicyEvaluationResult> {
    // Create temporary policy from snapshot
    const policy: RoutingPolicy = {
      ...policySnapshot,
      createdAt: new Date(policySnapshot.createdAt)
    };

    // Use snapshot data directly without cache
    const baseConfig = policy.taskMatrix[task.task.kind] || this.getDefaultTaskConfig();
    const matchedRules: RoutingRule[] = [];
    const evaluationTrace: PolicyEvaluationResult['evaluationTrace'] = [];
    let finalConfig = { ...baseConfig };

    const sortedRules = [...policy.rules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (!rule.enabled) continue;

      const matchResult = this.evaluateRuleCondition(rule.when, task);
      evaluationTrace.push({
        ruleId: rule.id,
        matched: matchResult.matched,
        reason: matchResult.reason,
        appliedActions: matchResult.matched ? rule.then : undefined
      });

      if (matchResult.matched) {
        matchedRules.push(rule);
        finalConfig = this.mergeConfiguration(finalConfig, rule.then);
      }
    }

    return {
      matchedRules,
      finalConfig,
      evaluationTrace
    };
  }

  /**
   * Validate policy configuration for safety
   */
  async validatePolicyConfiguration(policy: RoutingPolicy): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate basic structure
    if (!policy.id || !policy.version) {
      errors.push('Policy must have id and version');
    }

    if (!policy.taskMatrix || Object.keys(policy.taskMatrix).length === 0) {
      errors.push('Policy must define task matrix');
    }

    // Validate rules
    for (const rule of policy.rules || []) {
      if (!rule.id || !rule.when || !rule.then) {
        errors.push(`Rule ${rule.id || 'unnamed'} missing required fields`);
      }

      // Check for conflicting rules with same priority
      const samePrority = policy.rules.filter(r => r.priority === rule.priority && r.id !== rule.id);
      if (samePrority.length > 0) {
        warnings.push(`Rule ${rule.id} has same priority as ${samePrority.map(r => r.id).join(', ')}`);
      }
    }

    // Validate A/B tests
    for (const test of policy.abTests || []) {
      if (test.trafficPercent > 1 || test.trafficPercent < 0) {
        errors.push(`A/B test ${test.name} has invalid traffic percent: ${test.trafficPercent}`);
      }

      if (test.endDate < new Date()) {
        warnings.push(`A/B test ${test.name} has expired`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Private methods
   */

  private async setupConfigurationListeners(): Promise<void> {
    // Listen for policy changes in Firestore
    const policiesRef = this.firestoreClient.collection('ims').doc('policies');
    
    // Only setup listeners if onSnapshot method exists (production Firestore)
    if (typeof policiesRef.onSnapshot === 'function') {
      this.configChangeListeners.set('policies', 
        policiesRef.onSnapshot((snapshot: any) => {
          if (snapshot.exists) {
            this.handlePolicyConfigChange(snapshot.data());
          }
        })
      );
    } else {
      // Mock/test environment - skip listeners
      this.emit('configListenersSkipped', 'Mock environment detected');
    }
  }

  private handlePolicyConfigChange(configData: any): void {
    // Invalidate relevant cache entries
    for (const [policyId, cacheEntry] of this.policyCache.entries()) {
      if (configData[policyId] && configData[policyId].version !== cacheEntry.version) {
        this.policyCache.delete(policyId);
        this.emit('policyUpdated', { policyId, oldVersion: cacheEntry.version, newVersion: configData[policyId].version });
      }
    }
  }

  private async loadPolicyFromFirestore(policyId: string): Promise<RoutingPolicy> {
    try {
      const docRef = this.firestoreClient
        .collection('ims')
        .doc('policies')
        .collection('active')
        .doc(policyId);
      
      const doc = await docRef.get();
      
      if (!doc.exists) {
        throw new Error(`Policy ${policyId} not found`);
      }

      const data = doc.data();
      return {
        ...data,
        createdAt: data.createdAt?.toDate() || new Date()
      } as RoutingPolicy;
    } catch (error) {
      this.emit('policyLoadError', { policyId, error });
      throw error;
    }
  }

  private isCacheValid(cacheEntry: PolicyCacheEntry): boolean {
    const age = Date.now() - cacheEntry.cachedAt.getTime();
    return age < this.options.cacheExpirationMs;
  }

  private updateCache(policyId: string, policy: RoutingPolicy): void {
    // Implement LRU eviction if cache is full
    if (this.policyCache.size >= this.options.maxCacheSize) {
      const lru = Array.from(this.policyCache.entries())
        .sort((a, b) => a[1].lastAccessedAt.getTime() - b[1].lastAccessedAt.getTime())[0];
      this.policyCache.delete(lru[0]);
    }

    this.policyCache.set(policyId, {
      policy,
      version: policy.version,
      cachedAt: new Date(),
      lastAccessedAt: new Date(),
      hitCount: 0
    });
  }

  private evaluateRuleCondition(
    condition: RuleCondition, 
    task: ProcessedTaskInput
  ): { matched: boolean; reason: string } {
    const reasons: string[] = [];
    
    // Task kind matching
    if (condition['task.kind']) {
      const allowedKinds = Array.isArray(condition['task.kind']) 
        ? condition['task.kind'] 
        : [condition['task.kind']];
      
      if (!allowedKinds.includes(task.task.kind)) {
        return { matched: false, reason: `Task kind ${task.task.kind} not in ${allowedKinds.join(', ')}` };
      }
      reasons.push(`Task kind matches: ${task.task.kind}`);
    }

    // Task subtype matching
    if (condition['task.subtype'] && task.task.subtype) {
      const allowedSubtypes = Array.isArray(condition['task.subtype'])
        ? condition['task.subtype']
        : [condition['task.subtype']];
        
      if (!allowedSubtypes.includes(task.task.subtype)) {
        return { matched: false, reason: `Task subtype ${task.task.subtype} not in ${allowedSubtypes.join(', ')}` };
      }
      reasons.push(`Task subtype matches: ${task.task.subtype}`);
    }

    // User plan matching
    if (condition['session.plan']) {
      const allowedPlans = Array.isArray(condition['session.plan'])
        ? condition['session.plan']
        : [condition['session.plan']];
        
      if (!allowedPlans.includes(task.session.plan)) {
        return { matched: false, reason: `User plan ${task.session.plan} not in ${allowedPlans.join(', ')}` };
      }
      reasons.push(`User plan matches: ${task.session.plan}`);
    }

    // Token count conditions
    if (condition['task.tokensIn']) {
      const tokenCondition = condition['task.tokensIn'];
      const tokensIn = task.task.tokensIn;
      
      if (tokenCondition.gt !== undefined && tokensIn <= tokenCondition.gt) {
        return { matched: false, reason: `Tokens ${tokensIn} not > ${tokenCondition.gt}` };
      }
      if (tokenCondition.gte !== undefined && tokensIn < tokenCondition.gte) {
        return { matched: false, reason: `Tokens ${tokensIn} not >= ${tokenCondition.gte}` };
      }
      if (tokenCondition.lt !== undefined && tokensIn >= tokenCondition.lt) {
        return { matched: false, reason: `Tokens ${tokensIn} not < ${tokenCondition.lt}` };
      }
      if (tokenCondition.lte !== undefined && tokensIn > tokenCondition.lte) {
        return { matched: false, reason: `Tokens ${tokensIn} not <= ${tokenCondition.lte}` };
      }
      reasons.push(`Token count condition satisfied: ${tokensIn}`);
    }

    // Time-based conditions
    if (condition.timeOfDay) {
      const now = new Date();
      const timeStr = now.toTimeString().slice(0, 5); // HH:MM format
      const { start, end } = condition.timeOfDay;
      
      if (timeStr < start || timeStr > end) {
        return { matched: false, reason: `Current time ${timeStr} not between ${start} and ${end}` };
      }
      reasons.push(`Time condition satisfied: ${timeStr} between ${start}-${end}`);
    }

    return { 
      matched: true, 
      reason: reasons.length > 0 ? reasons.join('; ') : 'All conditions matched' 
    };
  }

  private mergeConfiguration(
    base: TaskConfiguration & Partial<RuleAction>, 
    override: RuleAction
  ): TaskConfiguration & RuleAction {
    return {
      ...base,
      ...override,
      // Special handling for generation params
      generationParams: {
        ...base.generationParams,
        ...override.generationParams
      }
    };
  }

  private async evaluateABTests(
    abTests: ABTestConfiguration[], 
    task: ProcessedTaskInput
  ): Promise<PolicyEvaluationResult['abTestAssignment']> {
    // Simple hash-based assignment for consistency
    const userId = task.session.userId;
    if (!userId) return undefined;

    for (const test of abTests) {
      if (!test.active || new Date() > test.endDate) continue;
      
      // Simple hash-based assignment
      const hash = this.simpleHash(userId + test.name);
      const assignmentValue = hash % 100;
      
      if (assignmentValue < test.trafficPercent * 100) {
        // User is in this test
        const group = (hash % 2 === 0) ? 'control' : 'treatment';
        
        return {
          testName: test.name,
          group,
          shadowOnly: test.shadowOnly
        };
      }
    }

    return undefined;
  }

  private getActiveEmergencyOverride(policy: RoutingPolicy): any {
    if (!policy.emergencyOverrides) return null;
    
    const now = new Date();
    return policy.emergencyOverrides.find(override => 
      override.active && override.expiresAt > now
    );
  }

  private applyEmergencyOverride(config: any, override: any): any {
    // Emergency overrides take precedence over everything
    return {
      ...config,
      ...override.config,
      emergencyMode: true,
      emergencyReason: override.reason
    };
  }

  private getDefaultTaskConfig(): TaskConfiguration {
    return {
      latencyBudgetMs: 2000,
      costTier: 'mid',
      qualityPreference: 'balanced'
    };
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Cleanup method
   */
  async cleanup(): Promise<void> {
    // Remove configuration listeners
    for (const [key, unsubscribe] of this.configChangeListeners.entries()) {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    }
    this.configChangeListeners.clear();
    
    // Clear cache
    this.policyCache.clear();
    
    this.isInitialized = false;
    this.emit('cleanup');
  }
}