/**
 * Planning Mode Plugin - Strategic planning and roadmap development mode
 * Specialized for creating structured plans, roadmaps, and strategic frameworks
 */

import { BaseMode, ModeConfig, ModeContext, ModeResult } from '../BaseMode.js';

export default class PlanningMode extends BaseMode {
  constructor() {
    const config: ModeConfig = {
      id: 'planning',
      name: 'Planning',
      category: 'structural',
      symbol: '📋',
      color: 'blue',
      description: '戦略計画モード - 構造化計画とロードマップ開発',
      keywords: [
        'plan',
        'strategy',
        'roadmap',
        'schedule',
        'timeline',
        'milestones',
        'goals',
        'objectives',
        'design',
        'blueprint',
      ],
      triggers: [
        'plan',
        'create plan',
        'strategy',
        'roadmap',
        'schedule',
        'timeline',
        'milestones',
        'goals',
        'design approach',
      ],
      examples: [
        'Create a project roadmap for the next quarter',
        'Plan the implementation strategy for this feature',
        'Design a timeline with key milestones',
        'Develop a strategic plan for team growth',
        'Create a detailed project schedule',
      ],
      enabled: true,
      priority: 7,
      timeout: 120000, // 2 minutes for comprehensive planning
      maxConcurrentSessions: 8,
    };

    super(config);
  }

  protected async onActivate(context: ModeContext): Promise<void> {
    console.log(`[${this.config.id}] Activating planning mode for session ${context.sessionId}`);

    this.emit('display:update', {
      mode: this.config.id,
      symbol: this.config.symbol,
      text: 'Planning...',
      color: this.config.color,
      sessionId: context.sessionId,
    });

    this.emit('analytics:event', {
      type: 'mode_activation',
      mode: this.config.id,
      sessionId: context.sessionId,
      timestamp: context.timestamp,
      metadata: {
        previousMode: context.previousMode,
        confidence: context.confidence,
      },
    });
  }

  protected async onDeactivate(sessionId: string): Promise<void> {
    console.log(`[${this.config.id}] Deactivating planning mode for session ${sessionId}`);

    this.emit('analytics:event', {
      type: 'mode_deactivation',
      mode: this.config.id,
      sessionId,
      timestamp: Date.now(),
    });
  }

  protected async onProcess(input: string, context: ModeContext): Promise<ModeResult> {
    console.log(`[${this.config.id}] Processing planning request: "${input.substring(0, 50)}..."`);

    // Planning process pipeline
    const planningScope = await this.definePlanningScope(input, context);
    const stakeholderAnalysis = await this.analyzeStakeholders(input, planningScope);
    const objectives = await this.defineObjectives(input, stakeholderAnalysis);
    const strategy = await this.developStrategy(input, objectives);
    const roadmap = await this.createRoadmap(input, strategy);
    const riskAssessment = await this.assessRisks(input, roadmap);
    const plan = await this.synthesizePlan(input, roadmap, riskAssessment);

    const suggestions = await this.generatePlanningSuggestions(input, plan);
    const nextMode = await this.determineNextMode(input, plan);

    return {
      success: true,
      output: this.formatPlanningResults(planningScope, objectives, strategy, roadmap, plan),
      suggestions,
      nextRecommendedMode: nextMode,
      confidence: 0.88,
      metadata: {
        scopeType: planningScope.type,
        timeframe: planningScope.timeframe,
        objectiveCount: objectives.length,
        strategyType: strategy.type,
        milestoneCount: roadmap.milestones.length,
        riskLevel: riskAssessment.overall_risk,
        processedAt: Date.now(),
      },
    };
  }

  protected async onCanHandle(
    input: string,
    context: ModeContext,
  ): Promise<{ confidence: number; reasoning: string[] }> {
    const reasoning: string[] = [];
    let confidence = 0.3;

    const inputLower = input.toLowerCase();

    // Direct planning keywords
    const planningKeywords = [
      'plan',
      'strategy',
      'roadmap',
      'schedule',
      'timeline',
      'milestones',
      'goals',
      'objectives',
      'design',
      'blueprint',
    ];

    const planningMatches = planningKeywords.filter((keyword) => inputLower.includes(keyword));
    if (planningMatches.length > 0) {
      confidence += 0.4;
      reasoning.push(`Planning keywords: ${planningMatches.join(', ')}`);
    }

    // Future-oriented language
    const futureIndicators = [
      'will',
      'going to',
      'next',
      'future',
      'upcoming',
      'ahead',
      'forward',
      'later',
      'soon',
      'eventually',
    ];

    const futureMatches = futureIndicators.filter((indicator) => inputLower.includes(indicator));
    if (futureMatches.length > 0) {
      confidence += 0.25;
      reasoning.push(`Future-oriented language: ${futureMatches.join(', ')}`);
    }

    // Project and initiative terms
    const projectTerms = [
      'project',
      'initiative',
      'program',
      'implementation',
      'development',
      'execution',
      'deployment',
      'rollout',
      'launch',
    ];

    const projectMatches = projectTerms.filter((term) => inputLower.includes(term));
    if (projectMatches.length > 0) {
      confidence += 0.2;
      reasoning.push(`Project/initiative terms: ${projectMatches.join(', ')}`);
    }

    // Time-related planning terms
    const timeTerms = [
      'deadline',
      'schedule',
      'timeline',
      'phases',
      'stages',
      'quarters',
      'months',
      'weeks',
      'duration',
      'timeframe',
    ];

    const timeMatches = timeTerms.filter((term) => inputLower.includes(term));
    if (timeMatches.length > 0) {
      confidence += 0.15;
      reasoning.push(`Time-related terms: ${timeMatches.join(', ')}`);
    }

    // Organizational planning terms
    const orgTerms = [
      'team',
      'organization',
      'department',
      'resources',
      'budget',
      'coordination',
      'alignment',
      'collaboration',
    ];

    const orgMatches = orgTerms.filter((term) => inputLower.includes(term));
    if (orgMatches.length > 0) {
      confidence += 0.1;
      reasoning.push(`Organizational terms: ${orgMatches.join(', ')}`);
    }

    // Questions that suggest planning need
    const planningQuestions = [
      /how.*should.*approach/i,
      /what.*steps/i,
      /how.*organize/i,
      /when.*should/i,
      /how.*structure/i,
      /what.*plan/i,
    ];

    const questionMatches = planningQuestions.filter((pattern) => pattern.test(input));
    if (questionMatches.length > 0) {
      confidence += 0.2;
      reasoning.push('Planning-oriented questions detected');
    }

    // Context-based adjustments
    if (context.previousMode === 'analyzing') {
      confidence += 0.15;
      reasoning.push('Natural progression from analysis to planning');
    }

    if (context.previousMode === 'researching') {
      confidence += 0.1;
      reasoning.push('Planning follows research appropriately');
    }

    // Complexity suggests need for planning
    const wordCount = input.split(/\s+/).length;
    if (wordCount > 40) {
      confidence += 0.1;
      reasoning.push('Complex request benefits from structured planning');
    }

    return { confidence: Math.min(confidence, 1.0), reasoning };
  }

  /**
   * Define the scope of planning
   */
  private async definePlanningScope(input: string, context: ModeContext): Promise<unknown> {
    const scope = {
      type: this.classifyPlanningType(input),
      level: this.determinePlanningLevel(input),
      timeframe: this.extractTimeframe(input),
      domain: this.identifyPlanningDomain(input),
      complexity: this.assessPlanningComplexity(input),
      constraints: this.identifyPlanningConstraints(input),
      success_criteria: this.defineSuccessCriteria(input),
    };

    return scope;
  }

  /**
   * Analyze stakeholders involved in the plan
   */
  private async analyzeStakeholders(input: string, scope: unknown): Promise<unknown> {
    const stakeholders = {
      primary: this.identifyPrimaryStakeholders(input),
      secondary: this.identifySecondaryStakeholders(input),
      decision_makers: this.identifyDecisionMakers(input),
      implementers: this.identifyImplementers(input),
      beneficiaries: this.identifyBeneficiaries(input),
      influencers: this.identifyInfluencers(input),
    };

    return stakeholders;
  }

  /**
   * Define clear objectives for the plan
   */
  private async defineObjectives(input: string, stakeholders: unknown): Promise<unknown[]> {
    const objectives: unknown[] = [];

    // Primary objective
    objectives.push({
      type: 'primary',
      description: this.extractPrimaryObjective(input),
      priority: 'high',
      measurable: true,
      timebound: this.extractObjectiveTimeframe(input),
    });

    // Secondary objectives
    const secondaryObjectives = this.extractSecondaryObjectives(input);
    secondaryObjectives.forEach((obj) => {
      objectives.push({
        type: 'secondary',
        description: obj,
        priority: 'medium',
        measurable: true,
        timebound: 'aligned_with_primary',
      });
    });

    // Stakeholder-specific objectives
    Object.keys(stakeholders).forEach((stakeholderType) => {
      if (stakeholders[stakeholderType].length > 0) {
        objectives.push({
          type: 'stakeholder',
          description: `Address ${stakeholderType} needs and requirements`,
          priority: 'medium',
          measurable: false,
          timebound: 'ongoing',
        });
      }
    });

    return objectives;
  }

  /**
   * Develop strategic approach
   */
  private async developStrategy(input: string, objectives: unknown[]): Promise<unknown> {
    const strategy = {
      type: this.selectStrategyType(input, objectives),
      approach: this.defineStrategicApproach(input, objectives),
      principles: this.establishStrategicPrinciples(input),
      methodologies: this.selectMethodologies(input, objectives),
      frameworks: this.chooseFrameworks(input),
      tactics: this.developTactics(input, objectives),
    };

    return strategy;
  }

  /**
   * Create detailed roadmap
   */
  private async createRoadmap(input: string, strategy: unknown): Promise<unknown> {
    const roadmap = {
      phases: this.definePlanningPhases(input, strategy),
      milestones: this.createMilestones(input, strategy),
      dependencies: this.mapDependencies(input, strategy),
      timeline: this.createTimeline(input, strategy),
      resources: this.planResourceAllocation(input, strategy),
      deliverables: this.defineDeliverables(input, strategy),
    };

    return roadmap;
  }

  /**
   * Assess risks and mitigation strategies
   */
  private async assessRisks(input: string, roadmap: unknown): Promise<unknown> {
    const risks = {
      identified_risks: this.identifyRisks(input, roadmap),
      risk_categories: this.categorizeRisks(input),
      probability_assessment: this.assessRiskProbability(input),
      impact_assessment: this.assessRiskImpact(input),
      mitigation_strategies: this.developMitigationStrategies(input),
      contingency_plans: this.createContingencyPlans(input),
      overall_risk: this.calculateOverallRisk(input),
    };

    return risks;
  }

  /**
   * Synthesize comprehensive plan
   */
  private async synthesizePlan(input: string, roadmap: unknown, risks: unknown): Promise<unknown> {
    const plan = {
      executive_summary: this.createExecutiveSummary(input, roadmap),
      detailed_plan: this.createDetailedPlan(roadmap, risks),
      implementation_guide: this.createImplementationGuide(roadmap),
      monitoring_framework: this.createMonitoringFramework(roadmap),
      success_metrics: this.defineSuccessMetrics(roadmap),
      review_schedule: this.createReviewSchedule(roadmap),
    };

    return plan;
  }

  /**
   * Format comprehensive planning results
   */
  private formatPlanningResults(
    scope: unknown,
    objectives: unknown[],
    strategy: unknown,
    roadmap: unknown,
    plan: unknown,
  ): string {
    const output: string[] = [];

    output.push('Strategic Planning Results');
    output.push('═'.repeat(25));
    output.push('');

    output.push('Planning Scope:');
    output.push(`Type: ${scope.type}`);
    output.push(`Level: ${scope.level}`);
    output.push(`Timeframe: ${scope.timeframe}`);
    output.push(`Domain: ${scope.domain}`);
    output.push('');

    output.push('Key Objectives:');
    objectives.slice(0, 4).forEach((obj, index) => {
      output.push(`${index + 1}. ${obj.description} (${obj.priority} priority)`);
    });
    output.push('');

    output.push('Strategic Approach:');
    output.push(`Strategy Type: ${strategy.type}`);
    output.push(`Approach: ${strategy.approach}`);
    output.push('Core Principles:');
    strategy.principles.slice(0, 3).forEach((principle: string) => {
      output.push(`• ${principle}`);
    });
    output.push('');

    output.push('Roadmap Overview:');
    output.push(`Phases: ${roadmap.phases.length}`);
    output.push(`Milestones: ${roadmap.milestones.length}`);
    output.push(`Timeline: ${roadmap.timeline}`);
    output.push('');

    output.push('Key Milestones:');
    roadmap.milestones.slice(0, 4).forEach((milestone: unknown, index: number) => {
      output.push(`${index + 1}. ${milestone.name} (${milestone.target_date})`);
    });
    output.push('');

    output.push('Implementation Framework:');
    output.push(plan.implementation_guide.overview);
    output.push('');

    output.push('Success Metrics:');
    plan.success_metrics.slice(0, 3).forEach((metric: string) => {
      output.push(`• ${metric}`);
    });

    return output.join('\n');
  }

  /**
   * Generate planning-specific suggestions
   */
  private async generatePlanningSuggestions(input: string, plan: unknown): Promise<string[]> {
    const suggestions: string[] = [];

    suggestions.push('Review and validate plan with key stakeholders');
    suggestions.push('Establish clear communication channels for updates');

    if (plan.detailed_plan.complexity === 'high') {
      suggestions.push('Consider breaking down into smaller, manageable phases');
    }

    suggestions.push('Set up regular progress review meetings');
    suggestions.push('Prepare contingency plans for identified risks');

    return suggestions.slice(0, 4);
  }

  /**
   * Determine next recommended mode
   */
  private async determineNextMode(input: string, plan: unknown): Promise<string | undefined> {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('implement') || inputLower.includes('execute')) {
      return 'organizing';
    }

    if (inputLower.includes('team') || inputLower.includes('stakeholder')) {
      return 'facilitating';
    }

    if (inputLower.includes('risk') || inputLower.includes('problem')) {
      return 'analyzing';
    }

    if (inputLower.includes('document') || inputLower.includes('report')) {
      return 'summarizing';
    }

    return 'reflecting';
  }

  // Helper methods
  private classifyPlanningType(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('project')) {return 'project_planning';}
    if (inputLower.includes('strategic') || inputLower.includes('strategy'))
      {return 'strategic_planning';}
    if (inputLower.includes('product')) {return 'product_planning';}
    if (inputLower.includes('resource')) {return 'resource_planning';}
    if (inputLower.includes('timeline') || inputLower.includes('schedule'))
      {return 'timeline_planning';}

    return 'general_planning';
  }

  private determinePlanningLevel(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('executive') || inputLower.includes('strategic')) {return 'strategic';}
    if (inputLower.includes('tactical') || inputLower.includes('operational')) {return 'tactical';}
    if (inputLower.includes('detailed') || inputLower.includes('specific')) {return 'operational';}

    return 'tactical';
  }

  private extractTimeframe(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('quarter')) {return 'quarterly';}
    if (inputLower.includes('year')) {return 'annual';}
    if (inputLower.includes('month')) {return 'monthly';}
    if (inputLower.includes('week')) {return 'weekly';}
    if (inputLower.includes('sprint')) {return 'sprint';}

    return 'medium_term';
  }

  private identifyPlanningDomain(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('technical') || inputLower.includes('technology')) {return 'technical';}
    if (inputLower.includes('business') || inputLower.includes('commercial')) {return 'business';}
    if (inputLower.includes('marketing') || inputLower.includes('sales')) {return 'marketing';}
    if (inputLower.includes('hr') || inputLower.includes('people')) {return 'human_resources';}
    if (inputLower.includes('financial') || inputLower.includes('budget')) {return 'financial';}

    return 'general';
  }

  private assessPlanningComplexity(input: string): string {
    const wordCount = input.split(/\s+/).length;
    const complexityIndicators = ['complex', 'multiple', 'various', 'different'];
    const inputLower = input.toLowerCase();

    const complexityCount = complexityIndicators.filter((indicator) =>
      inputLower.includes(indicator),
    ).length;

    if (wordCount > 100 || complexityCount > 2) {return 'high';}
    if (wordCount > 50 || complexityCount > 1) {return 'medium';}
    return 'low';
  }

  private identifyPlanningConstraints(input: string): string[] {
    const constraints: string[] = [];
    const inputLower = input.toLowerCase();

    if (inputLower.includes('budget')) {constraints.push('budget_constraint');}
    if (inputLower.includes('time')) {constraints.push('time_constraint');}
    if (inputLower.includes('resource')) {constraints.push('resource_constraint');}
    if (inputLower.includes('regulation')) {constraints.push('regulatory_constraint');}

    return constraints;
  }

  private defineSuccessCriteria(input: string): string[] {
    return [
      'Objectives achieved within timeline',
      'Budget constraints respected',
      'Quality standards met',
      'Stakeholder satisfaction achieved',
    ];
  }

  private identifyPrimaryStakeholders(input: string): string[] {
    const stakeholders: string[] = [];
    const inputLower = input.toLowerCase();

    if (inputLower.includes('team')) {stakeholders.push('project team');}
    if (inputLower.includes('customer')) {stakeholders.push('customers');}
    if (inputLower.includes('management')) {stakeholders.push('management');}
    if (inputLower.includes('user')) {stakeholders.push('end users');}

    return stakeholders.length > 0 ? stakeholders : ['project team'];
  }

  private identifySecondaryStakeholders(input: string): string[] {
    return ['support teams', 'vendors', 'partners'];
  }

  private identifyDecisionMakers(input: string): string[] {
    return ['project sponsor', 'executive team', 'steering committee'];
  }

  private identifyImplementers(input: string): string[] {
    return ['development team', 'operations team', 'support staff'];
  }

  private identifyBeneficiaries(input: string): string[] {
    return ['end users', 'customers', 'organization'];
  }

  private identifyInfluencers(input: string): string[] {
    return ['subject matter experts', 'advisors', 'external consultants'];
  }

  private extractPrimaryObjective(input: string): string {
    // Extract the main goal from the input
    const sentences = input.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    return sentences[0]?.trim() || 'Achieve successful project completion';
  }

  private extractObjectiveTimeframe(input: string): string {
    return this.extractTimeframe(input);
  }

  private extractSecondaryObjectives(input: string): string[] {
    return [
      'Maintain high quality standards',
      'Ensure efficient resource utilization',
      'Minimize risks and disruptions',
    ];
  }

  private selectStrategyType(input: string, objectives: unknown[]): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('agile') || inputLower.includes('iterative')) {return 'agile';}
    if (inputLower.includes('waterfall') || inputLower.includes('sequential')) {return 'waterfall';}
    if (inputLower.includes('hybrid') || inputLower.includes('mixed')) {return 'hybrid';}

    return objectives.length > 3 ? 'phased' : 'direct';
  }

  private defineStrategicApproach(input: string, objectives: unknown[]): string {
    return 'Systematic, phased approach with continuous monitoring and adaptation';
  }

  private establishStrategicPrinciples(input: string): string[] {
    return [
      'Clear communication and transparency',
      'Stakeholder engagement and collaboration',
      'Risk-aware decision making',
      'Continuous improvement and learning',
    ];
  }

  private selectMethodologies(input: string, objectives: unknown[]): string[] {
    const methodologies: string[] = [];
    const inputLower = input.toLowerCase();

    if (inputLower.includes('agile')) {methodologies.push('Agile methodology');}
    if (inputLower.includes('lean')) {methodologies.push('Lean principles');}
    methodologies.push('Best practices framework');

    return methodologies;
  }

  private chooseFrameworks(input: string): string[] {
    return ['SMART objectives', 'RACI matrix', 'Risk management framework'];
  }

  private developTactics(input: string, objectives: unknown[]): string[] {
    return [
      'Regular checkpoint reviews',
      'Stakeholder communication plan',
      'Risk monitoring and mitigation',
      'Resource optimization strategies',
    ];
  }

  private definePlanningPhases(input: string, strategy: unknown): string[] {
    const phases = ['Initiation', 'Planning', 'Execution', 'Monitoring', 'Closure'];

    if (strategy.type === 'agile') {
      phases.splice(2, 0, 'Sprint Planning');
    }

    return phases;
  }

  private createMilestones(input: string, strategy: unknown): unknown[] {
    return [
      { name: 'Project Kickoff', target_date: 'Week 1', description: 'Official project start' },
      {
        name: 'First Phase Complete',
        target_date: 'Week 4',
        description: 'Initial deliverables ready',
      },
      { name: 'Mid-Point Review', target_date: 'Week 8', description: 'Progress assessment' },
      { name: 'Final Delivery', target_date: 'Week 12', description: 'Project completion' },
    ];
  }

  private mapDependencies(input: string, strategy: unknown): string[] {
    return [
      'Resource availability dependency',
      'Technology readiness dependency',
      'Stakeholder approval dependency',
      'External vendor dependency',
    ];
  }

  private createTimeline(input: string, strategy: unknown): string {
    const timeframe = this.extractTimeframe(input);

    switch (timeframe) {
      case 'weekly':
        return '4-6 weeks';
      case 'monthly':
        return '2-3 months';
      case 'quarterly':
        return '3 months';
      case 'annual':
        return '12 months';
      default:
        return '8-12 weeks';
    }
  }

  private planResourceAllocation(input: string, strategy: unknown): unknown {
    return {
      human_resources: '5-8 team members',
      budget: 'To be determined based on scope',
      technology: 'Standard development tools and infrastructure',
      time: this.createTimeline(input, strategy),
    };
  }

  private defineDeliverables(input: string, strategy: unknown): string[] {
    return [
      'Project charter and scope document',
      'Detailed work breakdown structure',
      'Implementation deliverables',
      'Testing and validation reports',
      'Final project documentation',
    ];
  }

  private identifyRisks(input: string, roadmap: unknown): string[] {
    return [
      'Resource availability risk',
      'Timeline pressure risk',
      'Technical complexity risk',
      'Stakeholder alignment risk',
      'External dependency risk',
    ];
  }

  private categorizeRisks(input: string): string[] {
    return ['technical', 'operational', 'strategic', 'external'];
  }

  private assessRiskProbability(input: string): string {
    return 'medium'; // Simplified
  }

  private assessRiskImpact(input: string): string {
    return 'medium'; // Simplified
  }

  private developMitigationStrategies(input: string): string[] {
    return [
      'Regular risk assessment and monitoring',
      'Proactive stakeholder communication',
      'Resource buffer planning',
      'Technical validation checkpoints',
    ];
  }

  private createContingencyPlans(input: string): string[] {
    return [
      'Alternative resource allocation plan',
      'Scope reduction strategy',
      'Timeline extension protocol',
      'Emergency escalation procedure',
    ];
  }

  private calculateOverallRisk(input: string): string {
    return 'medium'; // Simplified
  }

  private createExecutiveSummary(input: string, roadmap: unknown): string {
    return `Strategic plan for ${this.extractPrimaryObjective(input)} with ${roadmap.phases.length} phases over ${roadmap.timeline}. Key milestones and risk mitigation strategies included.`;
  }

  private createDetailedPlan(roadmap: unknown, risks: unknown): unknown {
    return {
      overview: 'Comprehensive implementation plan with detailed phases and deliverables',
      complexity: roadmap.phases.length > 5 ? 'high' : 'medium',
      risk_level: risks.overall_risk,
    };
  }

  private createImplementationGuide(roadmap: unknown): unknown {
    return {
      overview: 'Step-by-step implementation guide with clear responsibilities and timelines',
      phases: roadmap.phases,
      success_factors: ['Clear communication', 'Regular monitoring', 'Stakeholder engagement'],
    };
  }

  private createMonitoringFramework(roadmap: unknown): string[] {
    return [
      'Weekly progress reviews',
      'Milestone achievement tracking',
      'Risk monitoring dashboard',
      'Stakeholder feedback collection',
    ];
  }

  private defineSuccessMetrics(roadmap: unknown): string[] {
    return [
      'On-time delivery of milestones',
      'Budget adherence',
      'Quality standards achievement',
      'Stakeholder satisfaction scores',
    ];
  }

  private createReviewSchedule(roadmap: unknown): string[] {
    return [
      'Weekly team standup meetings',
      'Bi-weekly stakeholder updates',
      'Monthly steering committee reviews',
      'Quarterly strategic assessments',
    ];
  }
}
