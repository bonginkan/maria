/**
 * NaturalLanguageProcessor - Converts natural language to structured plans
 * Core AI processing for intent understanding and plan generation
 */

import { 
  EnhancedIntent, 
  ExecutionPlan, 
  ExecutionStep,
  PlanRequest,
  TaskType,
  RiskLevel,
  ActionType
} from './contracts';
import { ModelSelector } from '../selector/ModelSelector';
import { ContextAnalyzer, ProjectContext } from '../intelligence/ContextAnalyzer';
import { v4 as uuid } from 'uuid';

export class NaturalLanguageProcessor {
  private modelSelector: ModelSelector;
  private contextAnalyzer: ContextAnalyzer;
  private planCache: Map<string, ExecutionPlan> = new Map();
  private readonly CACHE_TTL = 30000; // 30 seconds
  
  constructor() {
    this.modelSelector = new ModelSelector();
    this.contextAnalyzer = new ContextAnalyzer();
  }
  
  /**
   * Parse complex intent from natural language
   */
  async parseComplexIntent(
    input: string,
    projectContext?: ProjectContext
  ): Promise<EnhancedIntent> {
    // Get project context if not provided
    const context = projectContext || await this.contextAnalyzer.analyzeProject();
    
    // Select optimal model for intent parsing
    const model = this.modelSelector.choose({
      task: this.inferTaskType(input),
      contextTokens: this.modelSelector.estimateTokens(input, context),
      latencyBudget: 2000,
      allowVision: false
    });
    
    // Build prompt for intent extraction
    const prompt = this.buildIntentPrompt(input, context);
    
    // Call AI model (mock for now - would integrate with actual Gemini API)
    const response = await this.callModel(model, prompt);
    
    // Parse and validate response
    const intent = this.parseIntentResponse(response);
    
    return intent;
  }
  
  /**
   * Generate execution plan from request
   */
  async generatePlan(request: PlanRequest): Promise<ExecutionPlan> {
    // Check cache first
    const cacheKey = this.getCacheKey(request);
    const cached = this.planCache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      return cached;
    }
    
    // Parse intent
    const projectContext = await this.contextAnalyzer.analyzeProject();
    const intent = await this.parseComplexIntent(request.input, projectContext);
    
    // Generate steps based on intent
    const steps = await this.generateSteps(intent, projectContext);
    
    // Create execution plan
    const plan: ExecutionPlan = {
      id: uuid(),
      task: intent.primaryGoal,
      risk: this.assessOverallRisk(steps),
      steps,
      summary: this.generateSummary(intent, steps),
      estimatedTime: this.estimateTime(steps),
      totalLOC: this.calculateTotalLOC(steps),
      reasoning: this.generateReasoning(intent, steps),
      confidence: intent.confidence
    };
    
    // Cache the plan
    this.planCache.set(cacheKey, plan);
    
    return plan;
  }
  
  /**
   * Build prompt for intent extraction
   */
  private buildIntentPrompt(input: string, context: ProjectContext): string {
    return `
Analyze this development request and extract structured intent.

User Request: "${input}"

Project Context:
- Type: ${context.projectType}
- Framework: ${context.framework || 'none'}
- Main directories: ${context.structure.directories.slice(0, 5).map(d => d.path).join(', ')}
- Key dependencies: ${context.dependencies.slice(0, 10).map(d => d.name).join(', ')}
- Test framework: ${this.detectTestFramework(context)}

Analyze the request and return a JSON object with:
{
  "primaryGoal": "optimize|refactor|fix|scaffold|test",
  "secondaryGoals": ["additional goals if any"],
  "targetComponents": ["specific files, modules, or areas mentioned"],
  "suggestedApproaches": ["technical approaches to achieve the goal"],
  "estimatedComplexity": "low|medium|high",
  "requiredPermissions": ["code_modification", "dependency_addition", etc.],
  "confidence": 0.0-1.0
}

Focus on:
1. Understanding the primary intent
2. Identifying specific components or areas to modify
3. Assessing complexity and risk
4. Determining what permissions will be needed

Return ONLY valid JSON, no additional text.`;
  }
  
  /**
   * Generate execution steps from intent
   */
  private async generateSteps(
    intent: EnhancedIntent,
    context: ProjectContext
  ): Promise<ExecutionStep[]> {
    const steps: ExecutionStep[] = [];
    
    // Generate steps based on task type
    switch (intent.primaryGoal) {
      case 'optimize':
        steps.push(...await this.generateOptimizationSteps(intent, context));
        break;
      case 'refactor':
        steps.push(...await this.generateRefactorSteps(intent, context));
        break;
      case 'fix':
        steps.push(...await this.generateFixSteps(intent, context));
        break;
      case 'scaffold':
        steps.push(...await this.generateScaffoldSteps(intent, context));
        break;
      case 'test':
        steps.push(...await this.generateTestSteps(intent, context));
        break;
    }
    
    // Add step indices and dependencies
    steps.forEach((step, index) => {
      step.idx = index;
      step.dependencies = this.identifyDependencies(step, steps.slice(0, index));
    });
    
    return steps;
  }
  
  /**
   * Generate optimization steps
   */
  private async generateOptimizationSteps(
    intent: EnhancedIntent,
    context: ProjectContext
  ): Promise<ExecutionStep[]> {
    const steps: ExecutionStep[] = [];
    
    // Example: Add caching optimization
    if (intent.suggestedApproaches.includes('caching')) {
      steps.push({
        idx: 0,
        action: 'create',
        path: 'src/services/CacheService.ts',
        estimatedLOC: 150,
        risk: 'low',
        requiresApproval: false,
        reasoning: 'Create caching service for performance optimization'
      });
      
      steps.push({
        idx: 1,
        action: 'modify',
        path: 'src/routes/api.ts',
        estimatedLOC: 30,
        risk: 'medium',
        requiresApproval: false,
        reasoning: 'Integrate caching into API routes'
      });
    }
    
    return steps;
  }
  
  /**
   * Generate refactoring steps
   */
  private async generateRefactorSteps(
    intent: EnhancedIntent,
    context: ProjectContext
  ): Promise<ExecutionStep[]> {
    const steps: ExecutionStep[] = [];
    
    // Identify files to refactor
    for (const component of intent.targetComponents) {
      const filePath = this.resolveComponentPath(component, context);
      if (filePath) {
        steps.push({
          idx: steps.length,
          action: 'modify',
          path: filePath,
          estimatedLOC: 100,
          risk: 'medium',
          requiresApproval: false,
          reasoning: `Refactor ${component} for better code quality`
        });
      }
    }
    
    return steps;
  }
  
  /**
   * Generate fix steps
   */
  private async generateFixSteps(
    intent: EnhancedIntent,
    context: ProjectContext
  ): Promise<ExecutionStep[]> {
    const steps: ExecutionStep[] = [];
    
    // Generate fixes for identified issues
    for (const component of intent.targetComponents) {
      const filePath = this.resolveComponentPath(component, context);
      if (filePath) {
        steps.push({
          idx: steps.length,
          action: 'modify',
          path: filePath,
          estimatedLOC: 50,
          risk: 'low',
          requiresApproval: false,
          reasoning: `Fix issues in ${component}`
        });
      }
    }
    
    return steps;
  }
  
  /**
   * Generate scaffold steps
   */
  private async generateScaffoldSteps(
    intent: EnhancedIntent,
    context: ProjectContext
  ): Promise<ExecutionStep[]> {
    const steps: ExecutionStep[] = [];
    
    // Create new components
    for (const component of intent.targetComponents) {
      const filePath = this.generateNewFilePath(component, context);
      steps.push({
        idx: steps.length,
        action: 'create',
        path: filePath,
        estimatedLOC: 200,
        risk: 'low',
        requiresApproval: false,
        reasoning: `Create new ${component} component`
      });
    }
    
    // Add package dependencies if needed
    if (intent.requiredPermissions.includes('dependency_addition')) {
      steps.push({
        idx: steps.length,
        action: 'modify',
        path: 'package.json',
        estimatedLOC: 5,
        risk: 'high',
        requiresApproval: true,
        reasoning: 'Add required dependencies'
      });
    }
    
    return steps;
  }
  
  /**
   * Generate test steps
   */
  private async generateTestSteps(
    intent: EnhancedIntent,
    context: ProjectContext
  ): Promise<ExecutionStep[]> {
    const steps: ExecutionStep[] = [];
    
    // Create test files
    for (const component of intent.targetComponents) {
      const testPath = this.generateTestPath(component, context);
      steps.push({
        idx: steps.length,
        action: 'create',
        path: testPath,
        estimatedLOC: 150,
        risk: 'low',
        requiresApproval: false,
        reasoning: `Create tests for ${component}`
      });
    }
    
    return steps;
  }
  
  /**
   * Infer task type from input
   */
  private inferTaskType(input: string): TaskType {
    const lowered = input.toLowerCase();
    
    if (lowered.includes('optimize') || lowered.includes('performance') || lowered.includes('speed')) {
      return 'optimize';
    }
    if (lowered.includes('refactor') || lowered.includes('clean') || lowered.includes('improve')) {
      return 'refactor';
    }
    if (lowered.includes('fix') || lowered.includes('bug') || lowered.includes('error')) {
      return 'fix';
    }
    if (lowered.includes('create') || lowered.includes('add') || lowered.includes('scaffold')) {
      return 'scaffold';
    }
    if (lowered.includes('test') || lowered.includes('spec')) {
      return 'test';
    }
    
    return 'refactor'; // Default
  }
  
  /**
   * Mock AI model call (would be replaced with actual Gemini API)
   */
  private async callModel(model: any, prompt: string): Promise<string> {
    // Simulate AI response
    const mockResponse = {
      primaryGoal: this.inferTaskType(prompt),
      secondaryGoals: [],
      targetComponents: this.extractComponents(prompt),
      suggestedApproaches: ['optimization', 'caching'],
      estimatedComplexity: 'medium' as RiskLevel,
      requiredPermissions: ['code_modification'],
      confidence: 0.85
    };
    
    return JSON.stringify(mockResponse);
  }
  
  /**
   * Parse intent response from AI
   */
  private parseIntentResponse(response: string): EnhancedIntent {
    try {
      const parsed = JSON.parse(response);
      return {
        primaryGoal: parsed.primaryGoal || 'refactor',
        secondaryGoals: parsed.secondaryGoals || [],
        targetComponents: parsed.targetComponents || [],
        suggestedApproaches: parsed.suggestedApproaches || [],
        estimatedComplexity: parsed.estimatedComplexity || 'medium',
        requiredPermissions: parsed.requiredPermissions || ['code_modification'],
        confidence: parsed.confidence || 0.5
      };
    } catch (error) {
      // Fallback intent
      return {
        primaryGoal: 'refactor',
        secondaryGoals: [],
        targetComponents: [],
        suggestedApproaches: [],
        estimatedComplexity: 'medium',
        requiredPermissions: ['code_modification'],
        confidence: 0.3
      };
    }
  }
  
  /**
   * Extract components from input text
   */
  private extractComponents(input: string): string[] {
    const components: string[] = [];
    
    // Look for file paths
    const pathMatches = input.match(/[\w\/]+\.(ts|tsx|js|jsx)/g);
    if (pathMatches) {
      components.push(...pathMatches);
    }
    
    // Look for module names
    const moduleKeywords = ['service', 'controller', 'middleware', 'api', 'component'];
    for (const keyword of moduleKeywords) {
      if (input.toLowerCase().includes(keyword)) {
        components.push(keyword);
      }
    }
    
    return components;
  }
  
  /**
   * Detect test framework from project context
   */
  private detectTestFramework(context: ProjectContext): string {
    const deps = context.dependencies.map(d => d.name);
    
    if (deps.includes('jest')) return 'jest';
    if (deps.includes('mocha')) return 'mocha';
    if (deps.includes('vitest')) return 'vitest';
    if (deps.includes('ava')) return 'ava';
    
    return 'unknown';
  }
  
  /**
   * Resolve component name to file path
   */
  private resolveComponentPath(component: string, context: ProjectContext): string | null {
    // If already a path, return it
    if (component.includes('/') || component.includes('.')) {
      return component;
    }
    
    // Try to find in project structure
    const mainFiles = context.structure.mainFiles;
    for (const file of mainFiles) {
      if (file.path.toLowerCase().includes(component.toLowerCase())) {
        return file.path;
      }
    }
    
    // Generate likely path
    if (component.includes('service')) {
      return `src/services/${component}.ts`;
    }
    if (component.includes('component')) {
      return `src/components/${component}.tsx`;
    }
    
    return null;
  }
  
  /**
   * Generate path for new file
   */
  private generateNewFilePath(component: string, context: ProjectContext): string {
    const isTypeScript = context.projectType === 'node';
    const extension = isTypeScript ? '.ts' : '.js';
    
    if (component.includes('service')) {
      return `src/services/${component}${extension}`;
    }
    if (component.includes('middleware')) {
      return `src/middleware/${component}${extension}`;
    }
    if (component.includes('component')) {
      return `src/components/${component}.tsx`;
    }
    
    return `src/${component}${extension}`;
  }
  
  /**
   * Generate test file path
   */
  private generateTestPath(component: string, context: ProjectContext): string {
    const testDir = context.structure.testFiles.length > 0 
      ? context.structure.testFiles[0].path.split('/')[0]
      : 'tests';
    
    const baseName = component.replace(/\.(ts|js|tsx|jsx)$/, '');
    return `${testDir}/${baseName}.test.ts`;
  }
  
  /**
   * Identify step dependencies
   */
  private identifyDependencies(step: ExecutionStep, previousSteps: ExecutionStep[]): number[] {
    const deps: number[] = [];
    
    // File creation must happen before modification
    for (const prev of previousSteps) {
      if (prev.action === 'create' && step.action === 'modify' && prev.path === step.path) {
        deps.push(prev.idx);
      }
    }
    
    return deps;
  }
  
  /**
   * Assess overall risk level
   */
  private assessOverallRisk(steps: ExecutionStep[]): RiskLevel {
    const hasHighRisk = steps.some(s => s.risk === 'high');
    const hasMediumRisk = steps.some(s => s.risk === 'medium');
    
    if (hasHighRisk) return 'high';
    if (hasMediumRisk) return 'medium';
    return 'low';
  }
  
  /**
   * Generate human-readable summary
   */
  private generateSummary(intent: EnhancedIntent, steps: ExecutionStep[]): string {
    const fileCount = new Set(steps.map(s => s.path)).size;
    const createCount = steps.filter(s => s.action === 'create').length;
    const modifyCount = steps.filter(s => s.action === 'modify').length;
    
    let summary = `${intent.primaryGoal.charAt(0).toUpperCase() + intent.primaryGoal.slice(1)} `;
    summary += `${intent.targetComponents.join(', ')} `;
    summary += `(${fileCount} files: ${createCount} new, ${modifyCount} modified)`;
    
    return summary;
  }
  
  /**
   * Estimate execution time
   */
  private estimateTime(steps: ExecutionStep[]): number {
    // Estimate 2 seconds per step
    return steps.length * 2;
  }
  
  /**
   * Calculate total lines of code
   */
  private calculateTotalLOC(steps: ExecutionStep[]): number {
    return steps.reduce((total, step) => total + step.estimatedLOC, 0);
  }
  
  /**
   * Generate reasoning for the plan
   */
  private generateReasoning(intent: EnhancedIntent, steps: ExecutionStep[]): string[] {
    const reasoning: string[] = [];
    
    reasoning.push(`Identified task: ${intent.primaryGoal}`);
    reasoning.push(`Target components: ${intent.targetComponents.join(', ')}`);
    reasoning.push(`Approach: ${intent.suggestedApproaches.join(', ')}`);
    reasoning.push(`${steps.length} steps required for implementation`);
    
    if (intent.estimatedComplexity === 'high') {
      reasoning.push('Complex implementation requiring careful review');
    }
    
    return reasoning;
  }
  
  /**
   * Get cache key for plan
   */
  private getCacheKey(request: PlanRequest): string {
    return `${request.repoDigest}:${request.input}`;
  }
  
  /**
   * Check if cached plan is still valid
   */
  private isCacheValid(plan: ExecutionPlan): boolean {
    // Simple TTL check - could be enhanced
    return true; // For now, rely on cache TTL
  }
}