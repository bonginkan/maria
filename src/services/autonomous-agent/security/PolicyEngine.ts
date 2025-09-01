/**
 * PolicyEngine - Allow-list based security policy enforcement with enhanced governance
 * Default deny, explicit allow approach for maximum security with LOC limits
 */

import { minimatch } from 'minimatch';
import { OperationContext, PlannedOperation, ExecutionPlan } from '../core/AutonomousExecutor';
import { RiskLevel } from '../ai/contracts';

export interface AgentPolicy {
  id: string;
  name: string;
  version: string;
  
  modes: {
    default: 'dry-run' | 'diff-only' | 'read-write';
    allowedModes: string[];
    elevationRequiresApproval: boolean;
    elevationTTL: number;
  };
  
  filesystem: {
    allowPaths: string[];
    denyPatterns: string[];
    maxFileSizeKB: number;
    maxTotalSizeKB: number;
  };
  
  commands: {
    allowedCommands: string[];
    blockedCommands: string[];
    requiresApproval: string[];
  };
  
  network: {
    enabled: boolean;
    allowedDomains: string[];
    allowedMethods: string[];
    maxRequestsPerMinute: number;
    timeoutSeconds: number;
  };
  
  riskRules: Array<{
    pattern: string;
    risk: 'low' | 'medium' | 'high' | 'critical' | 'blocked';
  }>;
}

export interface PolicyResult {
  allow: boolean;
  reason: string;
  risk?: RiskLevel;
  risk: 'low' | 'medium' | 'high' | 'critical' | 'blocked';
  requiresApproval: boolean;
  violations?: string[];
}

export class PolicyEngine {
  private policy: AgentPolicy;
  private cache: Map<string, PolicyResult>;
  
  constructor() {
    this.policy = this.loadDefaultPolicy();
    this.cache = new Map();
  }
  
  /**
   * Get current policy
   */
  async getCurrentPolicy(): Promise<AgentPolicy> {
    // In production, this would load from Firestore
    return this.policy;
  }
  
  /**
   * Evaluate a complete execution plan
   */
  async evaluatePlan(
    plan: ExecutionPlan,
    context: OperationContext
  ): Promise<PolicyResult> {
    const violations: string[] = [];
    let maxRisk: 'low' | 'medium' | 'high' | 'critical' | 'blocked' = 'low';
    let requiresApproval = false;
    
    // Check each step in the plan
    for (const step of plan.steps) {
      const stepResult = await this.evaluateOperation(step, context);
      
      if (!stepResult.allow) {
        violations.push(`Step blocked: ${stepResult.reason}`);
        if (stepResult.risk === 'blocked') {
          return {
            allow: false,
            reason: 'Plan contains blocked operations',
            risk: 'blocked',
            requiresApproval: false,
            violations
          };
        }
      }
      
      // Track maximum risk level
      if (this.compareRisk(stepResult.risk, maxRisk) > 0) {
        maxRisk = stepResult.risk;
      }
      
      if (stepResult.requiresApproval) {
        requiresApproval = true;
      }
    }
    
    // Final decision
    const allow = violations.length === 0 && maxRisk !== 'blocked';
    
    return {
      allow,
      reason: allow ? 'Plan approved by policy' : 'Plan violates security policy',
      risk: maxRisk,
      requiresApproval: requiresApproval || this.requiresApprovalForRisk(maxRisk, context),
      violations: violations.length > 0 ? violations : undefined
    };
  }
  
  /**
   * Evaluate a single operation
   */
  async evaluateOperation(
    operation: PlannedOperation,
    context: OperationContext
  ): Promise<PolicyResult> {
    // Check cache
    const cacheKey = this.getCacheKey(operation, context);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    // 1. Skip cache for dry-run but continue evaluation
    // Dry-run mode should still evaluate security policies
    
    // 2. Check blocked patterns first (highest priority)
    const blockResult = this.checkBlockedPatterns(operation);
    if (blockResult) {
      return this.cacheResult(cacheKey, blockResult);
    }
    
    // 3. Check allow-list
    const allowResult = this.checkAllowList(operation);
    if (!allowResult.allow) {
      return this.cacheResult(cacheKey, allowResult);
    }
    
    // 4. Assess risk
    const risk = this.assessOperationRisk(operation);
    
    // 5. Determine approval requirements
    const requiresApproval = this.requiresApproval(operation, risk, context);
    
    // 6. Final decision
    const result: PolicyResult = {
      allow: !requiresApproval || context.elevationToken !== undefined,
      reason: requiresApproval 
        ? 'Operation requires manual approval' 
        : 'Operation approved by policy',
      risk,
      requiresApproval
    };
    
    return this.cacheResult(cacheKey, result);
  }
  
  /**
   * Check if operation matches blocked patterns
   */
  private checkBlockedPatterns(operation: PlannedOperation): PolicyResult | null {
    // Check blocked commands - more aggressive pattern matching
    if (operation.type === 'execCommand' && operation.command) {
      const cmdLower = operation.command.toLowerCase();
      for (const blocked of this.policy.commands.blockedCommands) {
        const blockedLower = blocked.toLowerCase();
        // Check both exact match and partial match for dangerous patterns
        if (cmdLower.includes(blockedLower) || 
            (blockedLower === 'rm -rf' && cmdLower.includes('rm') && cmdLower.includes('-rf')) ||
            (blockedLower === 'sudo' && cmdLower.startsWith('sudo')) ||
            (blockedLower === 'chmod -r' && cmdLower.includes('chmod') && cmdLower.includes('-r'))) {
          return {
            allow: false,
            reason: `Command contains blocked pattern: ${blocked}`,
            risk: 'blocked',
            requiresApproval: false
          };
        }
      }
    }
    
    // Check deny patterns for file operations
    if ((operation.type === 'writeFile' || operation.type === 'editFile' || operation.type === 'deleteFile') && operation.path) {
      // Block wildcard deletions
      if (operation.type === 'deleteFile' && (operation.path === '*' || operation.path.includes('*'))) {
        return {
          allow: false,
          reason: 'Wildcard deletion is not allowed',
          risk: 'blocked',
          requiresApproval: false
        };
      }
      
      for (const pattern of this.policy.filesystem.denyPatterns) {
        if (minimatch(operation.path, pattern)) {
          return {
            allow: false,
            reason: `Path matches deny pattern: ${pattern}`,
            risk: 'blocked',
            requiresApproval: false
          };
        }
      }
    }
    
    // Check risk rules
    for (const rule of this.policy.riskRules) {
      if (this.matchesRiskRule(operation, rule)) {
        if (rule.risk === 'blocked') {
          return {
            allow: false,
            reason: `Operation matches blocked risk rule: ${rule.pattern}`,
            risk: 'blocked',
            requiresApproval: false
          };
        }
      }
    }
    
    return null;
  }
  
  /**
   * Check if operation is in allow-list
   */
  private checkAllowList(operation: PlannedOperation): PolicyResult {
    switch (operation.type) {
      case 'writeFile':
      case 'editFile':
      case 'deleteFile':
        return this.checkFileAllowList(operation);
      
      case 'execCommand':
        return this.checkCommandAllowList(operation);
      
      case 'networkRequest':
        return this.checkNetworkAllowList(operation);
      
      default:
        return {
          allow: false,
          reason: `Unknown operation type: ${operation.type}`,
          risk: 'high',
          requiresApproval: true
        };
    }
  }
  
  /**
   * Check file operation against allow-list
   */
  private checkFileAllowList(operation: PlannedOperation): PolicyResult {
    if (!operation.path) {
      return {
        allow: false,
        reason: 'File operation missing path',
        risk: 'high',
        requiresApproval: true
      };
    }
    
    // First check if it's a system path (highest priority)
    const systemPaths = ['/etc', '/var', '/usr', '/bin', '/sbin', '/System', 'C:\\Windows', 'C:\\Program Files'];
    const normalizedPath = operation.path.replace(/\\/g, '/');
    for (const sysPath of systemPaths) {
      if (normalizedPath.startsWith(sysPath) || normalizedPath.startsWith(sysPath.toLowerCase())) {
        return {
          allow: false,
          reason: `System path access denied: ${operation.path}`,
          risk: 'blocked',
          requiresApproval: false
        };
      }
    }
    
    // Check if path is allowed
    let allowed = false;
    for (const pattern of this.policy.filesystem.allowPaths) {
      if (minimatch(operation.path, pattern)) {
        allowed = true;
        break;
      }
    }
    
    if (!allowed) {
      return {
        allow: false,
        reason: `Path not in allow-list: ${operation.path}`,
        risk: 'high',
        requiresApproval: true
      };
    }
    
    return {
      allow: true,
      reason: 'File operation allowed',
      risk: operation.type === 'deleteFile' ? 'medium' : 'low',
      requiresApproval: false
    };
  }
  
  /**
   * Check command against allow-list
   */
  private checkCommandAllowList(operation: PlannedOperation): PolicyResult {
    if (!operation.command) {
      return {
        allow: false,
        reason: 'Command operation missing command',
        risk: 'high',
        requiresApproval: true
      };
    }
    
    // Check if command is allowed
    let allowed = false;
    let requiresApproval = false;
    
    // Check exact matches and patterns
    for (const allowedCmd of this.policy.commands.allowedCommands) {
      if (operation.command.startsWith(allowedCmd)) {
        allowed = true;
        break;
      }
    }
    
    // Check if requires approval
    for (const approvalCmd of this.policy.commands.requiresApproval) {
      if (operation.command.startsWith(approvalCmd)) {
        requiresApproval = true;
        break;
      }
    }
    
    if (!allowed && !requiresApproval) {
      return {
        allow: false,
        reason: `Command not in allow-list: ${operation.command}`,
        risk: 'high',
        requiresApproval: true
      };
    }
    
    return {
      allow: true,
      reason: requiresApproval ? 'Command requires approval' : 'Command allowed',
      risk: requiresApproval ? 'medium' : 'low',
      requiresApproval
    };
  }
  
  /**
   * Check network request against allow-list
   */
  private checkNetworkAllowList(operation: PlannedOperation): PolicyResult {
    if (!this.policy.network.enabled) {
      return {
        allow: false,
        reason: 'Network operations disabled by policy',
        risk: 'blocked',
        requiresApproval: false
      };
    }
    
    if (!operation.url || !operation.method) {
      return {
        allow: false,
        reason: 'Network operation missing URL or method',
        risk: 'high',
        requiresApproval: true
      };
    }
    
    // Parse URL to get domain
    try {
      const url = new URL(operation.url);
      const domain = url.hostname;
      
      // Check domain allow-list
      let domainAllowed = false;
      for (const allowedDomain of this.policy.network.allowedDomains) {
        if (domain === allowedDomain || domain.endsWith(`.${allowedDomain}`)) {
          domainAllowed = true;
          break;
        }
      }
      
      if (!domainAllowed) {
        return {
          allow: false,
          reason: `Domain not in allow-list: ${domain}`,
          risk: 'high',
          requiresApproval: true
        };
      }
      
      // Check method allow-list
      if (!this.policy.network.allowedMethods.includes(operation.method.toUpperCase())) {
        return {
          allow: false,
          reason: `HTTP method not allowed: ${operation.method}`,
          risk: 'medium',
          requiresApproval: true
        };
      }
      
      return {
        allow: true,
        reason: 'Network request allowed',
        risk: 'medium',
        requiresApproval: true // Always require approval for network operations
      };
      
    } catch (error) {
      return {
        allow: false,
        reason: `Invalid URL: ${operation.url}`,
        risk: 'high',
        requiresApproval: true
      };
    }
  }
  
  /**
   * Assess risk level of operation
   */
  private assessOperationRisk(operation: PlannedOperation): 'low' | 'medium' | 'high' | 'critical' {
    // Check risk rules
    for (const rule of this.policy.riskRules) {
      if (this.matchesRiskRule(operation, rule) && rule.risk !== 'blocked') {
        return rule.risk as 'low' | 'medium' | 'high' | 'critical';
      }
    }
    
    // Default risk by operation type
    switch (operation.type) {
      case 'writeFile':
        return operation.path?.includes('config') || operation.path?.includes('json') ? 'medium' : 'low';
      case 'editFile':
        return 'low';
      case 'deleteFile':
        return 'medium';
      case 'execCommand':
        return 'medium';
      case 'networkRequest':
        return 'high';
      default:
        return 'high';
    }
  }
  
  /**
   * Check if operation matches risk rule
   */
  private matchesRiskRule(operation: PlannedOperation, rule: { pattern: string; risk: string }): boolean {
    const pattern = rule.pattern.toLowerCase();
    
    if (pattern.startsWith('delete') && operation.type === 'deleteFile') {
      return true;
    }
    
    if (pattern.startsWith('write:') && operation.type === 'writeFile') {
      const filePattern = pattern.substring(6);
      return operation.path ? minimatch(operation.path, filePattern) : false;
    }
    
    if (pattern.startsWith('exec:') && operation.type === 'execCommand') {
      const cmdPattern = pattern.substring(5);
      return operation.command ? operation.command.includes(cmdPattern) : false;
    }
    
    return false;
  }
  
  /**
   * Determine if operation requires approval
   */
  private requiresApproval(
    operation: PlannedOperation,
    risk: string,
    context: OperationContext
  ): boolean {
    // Always require approval for read-write mode with high risk
    if (context.mode === 'read-write' && (risk === 'high' || risk === 'critical')) {
      return true;
    }
    
    // Check if command requires approval
    if (operation.type === 'execCommand' && operation.command) {
      for (const cmd of this.policy.commands.requiresApproval) {
        if (operation.command.startsWith(cmd)) {
          return true;
        }
      }
    }
    
    // Network operations always require approval
    if (operation.type === 'networkRequest') {
      return true;
    }
    
    return false;
  }
  
  /**
   * Check if risk level requires approval
   */
  private requiresApprovalForRisk(
    risk: string,
    context: OperationContext
  ): boolean {
    if (context.mode !== 'read-write') {
      return false;
    }
    
    return risk === 'high' || risk === 'critical';
  }
  
  /**
   * Compare risk levels
   */
  private compareRisk(risk1: string, risk2: string): number {
    const levels = ['low', 'medium', 'high', 'critical', 'blocked'];
    return levels.indexOf(risk1) - levels.indexOf(risk2);
  }
  
  /**
   * Generate cache key for operation
   */
  private getCacheKey(operation: PlannedOperation, context: OperationContext): string {
    return `${context.mode}:${operation.type}:${operation.path || operation.command || operation.url}`;
  }
  
  /**
   * Cache and return result
   */
  private cacheResult(key: string, result: PolicyResult): PolicyResult {
    this.cache.set(key, result);
    return result;
  }
  
  /**
   * Load default policy
   */
  private loadDefaultPolicy(): AgentPolicy {
    return {
      id: 'default-safe-policy',
      name: 'Safe Default Policy',
      version: '2.0.0',
      
      modes: {
        default: 'dry-run',
        allowedModes: ['dry-run', 'diff-only'],
        elevationRequiresApproval: true,
        elevationTTL: 600
      },
      
      filesystem: {
        allowPaths: [
          'src/**/*.ts',
          'src/**/*.tsx',
          'tests/**/*.test.ts',
          'docs/**/*.md'
        ],
        denyPatterns: [
          '**/node_modules/**',
          '**/.env*',
          '**/secrets/**',
          '**/credentials/**',
          '**/.git/config',
          '**/package-lock.json'
        ],
        maxFileSizeKB: 256,
        maxTotalSizeKB: 10240
      },
      
      commands: {
        allowedCommands: [
          'git status',
          'git diff',
          'git add',
          'git commit',
          'npm test',
          'npm run lint',
          'pnpm test',
          'pnpm lint',
          'tsc --noEmit',
          'eslint',
          'prettier'
        ],
        blockedCommands: [
          'rm -rf',
          'sudo',
          'chmod -R',
          'chown',
          'mkfs',
          'dd',
          'mount',
          'curl',
          'wget',
          'nc',
          'ssh'
        ],
        requiresApproval: [
          'npm install',
          'pnpm install',
          'git push',
          'git pull'
        ]
      },
      
      network: {
        enabled: false,
        allowedDomains: [],
        allowedMethods: ['GET'],
        maxRequestsPerMinute: 10,
        timeoutSeconds: 5
      },
      
      riskRules: [
        { pattern: 'delete*', risk: 'high' },
        { pattern: 'write:package.json', risk: 'medium' },
        { pattern: 'write:tsconfig.json', risk: 'high' },
        { pattern: 'write:*.env*', risk: 'blocked' },
        { pattern: 'exec:rm', risk: 'blocked' },
        { pattern: 'exec:sudo', risk: 'blocked' }
      ]
    };
  }
  
  /**
   * Update policy (admin only)
   */
  async updatePolicy(newPolicy: Partial<AgentPolicy>): Promise<void> {
    // Validate and merge policy
    this.policy = {
      ...this.policy,
      ...newPolicy
    };
    
    // Clear cache
    this.cache.clear();
  }
}