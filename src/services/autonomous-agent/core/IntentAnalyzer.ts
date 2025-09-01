/**
 * IntentAnalyzer - Analyzes natural language intents for operations
 * Converts user requests into structured action plans
 */

export interface Intent {
  type: IntentType;
  action: ActionType;
  target: TargetType;
  scope: ScopeType;
  urgency: UrgencyLevel;
  confidence: number;
  entities: ExtractedEntity[];
  rawIntent: string;
}

export type IntentType = 
  | 'create'
  | 'modify'
  | 'delete'
  | 'execute'
  | 'query'
  | 'analyze'
  | 'refactor'
  | 'optimize';

export type ActionType =
  | 'add'
  | 'update'
  | 'remove'
  | 'fix'
  | 'refactor'
  | 'test'
  | 'build'
  | 'deploy';

export type TargetType =
  | 'file'
  | 'directory'
  | 'service'
  | 'component'
  | 'configuration'
  | 'dependency'
  | 'test'
  | 'documentation';

export type ScopeType =
  | 'line'
  | 'function'
  | 'file'
  | 'module'
  | 'package'
  | 'project';

export type UrgencyLevel =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export interface ExtractedEntity {
  type: 'path' | 'command' | 'variable' | 'value' | 'pattern';
  value: string;
  confidence: number;
}

export class IntentAnalyzer {
  private readonly patterns: Map<string, IntentPattern> = new Map();

  constructor() {
    this.initializePatterns();
  }

  /**
   * Analyze user intent from natural language
   */
  async analyze(input: string): Promise<Intent> {
    const normalizedInput = input.toLowerCase().trim();
    
    // Extract entities first
    const entities = this.extractEntities(input);
    
    // Determine intent type
    const intentType = this.detectIntentType(normalizedInput);
    
    // Determine action
    const action = this.detectAction(normalizedInput, intentType);
    
    // Determine target
    const target = this.detectTarget(normalizedInput, entities);
    
    // Determine scope
    const scope = this.detectScope(normalizedInput, target);
    
    // Determine urgency
    const urgency = this.detectUrgency(normalizedInput);
    
    // Calculate confidence
    const confidence = this.calculateConfidence(normalizedInput, entities);

    return {
      type: intentType,
      action,
      target,
      scope,
      urgency,
      confidence,
      entities,
      rawIntent: input
    };
  }

  /**
   * Detect intent type from input
   */
  private detectIntentType(input: string): IntentType {
    // Check for dangerous patterns first
    if (input.includes('rm -rf') || input.includes('sudo') || input.includes('curl')) {
      return 'execute'; // Treat dangerous commands as execute type
    }
    
    const typePatterns: Record<IntentType, string[]> = {
      create: ['create', 'add', 'new', 'generate', 'make', 'build'],
      modify: ['modify', 'change', 'update', 'edit', 'alter', 'patch'],
      delete: ['delete', 'remove', 'clean', 'clear', 'destroy', 'drop'],
      execute: ['run', 'execute', 'exec', 'perform', 'invoke', 'call', 'rm', 'sudo'],
      query: ['find', 'search', 'get', 'list', 'show', 'display'],
      analyze: ['analyze', 'inspect', 'examine', 'review', 'check'],
      refactor: ['refactor', 'restructure', 'reorganize', 'improve'],
      optimize: ['optimize', 'enhance', 'speed up', 'improve performance']
    };

    for (const [type, patterns] of Object.entries(typePatterns)) {
      if (patterns.some(pattern => input.includes(pattern))) {
        return type as IntentType;
      }
    }

    return 'modify'; // Default to modify
  }

  /**
   * Detect action type
   */
  private detectAction(input: string, intentType: IntentType): ActionType {
    const actionMap: Record<IntentType, ActionType> = {
      create: 'add',
      modify: 'update',
      delete: 'remove',
      execute: 'build',
      query: 'test',
      analyze: 'test',
      refactor: 'refactor',
      optimize: 'refactor'
    };

    // Check for specific action keywords
    if (input.includes('fix') || input.includes('bug') || input.includes('error')) {
      return 'fix';
    }
    if (input.includes('test')) {
      return 'test';
    }
    if (input.includes('build')) {
      return 'build';
    }
    if (input.includes('deploy')) {
      return 'deploy';
    }

    return actionMap[intentType] || 'update';
  }

  /**
   * Detect target type
   */
  private detectTarget(input: string, entities: ExtractedEntity[]): TargetType {
    // Check for file paths in entities
    const hasFilePath = entities.some(e => e.type === 'path' && e.value.includes('.'));
    if (hasFilePath) {
      return 'file';
    }

    const targetPatterns: Record<TargetType, string[]> = {
      file: ['file', '.ts', '.js', '.json', '.md', '.tsx', '.jsx'],
      directory: ['directory', 'folder', 'dir', 'path'],
      service: ['service', 'api', 'endpoint', 'server'],
      component: ['component', 'module', 'class', 'function'],
      configuration: ['config', 'configuration', 'settings', 'env'],
      dependency: ['dependency', 'package', 'library', 'module'],
      test: ['test', 'spec', 'unit', 'integration'],
      documentation: ['docs', 'documentation', 'readme', 'comment']
    };

    for (const [target, patterns] of Object.entries(targetPatterns)) {
      if (patterns.some(pattern => input.includes(pattern))) {
        return target as TargetType;
      }
    }

    return 'file'; // Default to file
  }

  /**
   * Detect scope
   */
  private detectScope(input: string, target: TargetType): ScopeType {
    // If target is file, default scope is file
    if (target === 'file') {
      if (input.includes('line') || input.includes('specific')) {
        return 'line';
      }
      if (input.includes('function') || input.includes('method')) {
        return 'function';
      }
      return 'file';
    }

    const scopePatterns: Record<ScopeType, string[]> = {
      line: ['line', 'specific line', 'single line'],
      function: ['function', 'method', 'handler', 'callback'],
      file: ['file', 'entire file', 'whole file'],
      module: ['module', 'package', 'library'],
      package: ['package', 'entire package', 'all packages'],
      project: ['project', 'entire project', 'all', 'everything']
    };

    for (const [scope, patterns] of Object.entries(scopePatterns)) {
      if (patterns.some(pattern => input.includes(pattern))) {
        return scope as ScopeType;
      }
    }

    return 'file'; // Default to file scope
  }

  /**
   * Detect urgency level
   */
  private detectUrgency(input: string): UrgencyLevel {
    if (input.includes('urgent') || input.includes('critical') || input.includes('asap') || input.includes('immediately')) {
      return 'critical';
    }
    if (input.includes('high priority') || input.includes('important')) {
      return 'high';
    }
    if (input.includes('low priority') || input.includes('when possible') || input.includes('eventually')) {
      return 'low';
    }
    return 'medium';
  }

  /**
   * Extract entities from input
   */
  private extractEntities(input: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    // Look for common folder patterns
    if (input.includes('in src') || input.includes('in the src')) {
      entities.push({
        type: 'path',
        value: 'src/',
        confidence: 0.9
      });
    } else if (input.includes('in tests') || input.includes('in test')) {
      entities.push({
        type: 'path',
        value: 'tests/',
        confidence: 0.9
      });
    } else if (input.includes('in docs')) {
      entities.push({
        type: 'path',
        value: 'docs/',
        confidence: 0.9
      });
    }

    // Extract file paths
    const pathPattern = /(?:^|\s)([\.\/\w-]+(?:\.\w+)?)/g;
    let match;
    while ((match = pathPattern.exec(input)) !== null) {
      const value = match[1];
      if (value.includes('/') || value.includes('.')) {
        // Skip if we already added this as a folder
        if (!entities.some(e => e.value === value || e.value === value + '/')) {
          entities.push({
            type: 'path',
            value,
            confidence: 0.8
          });
        }
      }
    }

    // Extract commands (backticks or quotes)
    const commandPattern = /[`"']([^`"']+)[`"']/g;
    while ((match = commandPattern.exec(input)) !== null) {
      entities.push({
        type: 'command',
        value: match[1],
        confidence: 0.9
      });
    }

    // Extract patterns
    const patterns = ['*.ts', '*.js', '**/*.test.ts'];
    for (const pattern of patterns) {
      if (input.includes(pattern)) {
        entities.push({
          type: 'pattern',
          value: pattern,
          confidence: 0.7
        });
      }
    }

    return entities;
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(input: string, entities: ExtractedEntity[]): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence for more entities
    confidence += Math.min(entities.length * 0.1, 0.3);

    // Increase confidence for specific keywords
    const highConfidenceKeywords = ['create', 'delete', 'update', 'fix', 'add', 'remove'];
    const hasHighConfidenceKeyword = highConfidenceKeywords.some(kw => input.includes(kw));
    if (hasHighConfidenceKeyword) {
      confidence += 0.2;
    }

    // Decrease confidence for vague inputs
    if (input.length < 10) {
      confidence -= 0.2;
    }
    if (!entities.length) {
      confidence -= 0.1;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Initialize intent patterns
   */
  private initializePatterns(): void {
    // Add common patterns for better recognition
    this.patterns.set('create-file', {
      regex: /create\s+(?:a\s+)?(?:new\s+)?file\s+(?:named\s+)?(.+)/i,
      type: 'create',
      target: 'file'
    });

    this.patterns.set('delete-file', {
      regex: /delete\s+(?:the\s+)?file\s+(.+)/i,
      type: 'delete',
      target: 'file'
    });

    this.patterns.set('run-command', {
      regex: /run\s+(?:the\s+)?(?:command\s+)?(.+)/i,
      type: 'execute',
      target: 'component'
    });
  }
}

interface IntentPattern {
  regex: RegExp;
  type: IntentType;
  target: TargetType;
}