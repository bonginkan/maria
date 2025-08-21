/**
 * Coordinating Mode Plugin - Team coordination and synchronization mode
 * Specialized for managing team activities, aligning efforts, and ensuring coordination
 */

import { BaseMode, ModeConfig, ModeContext, ModeResult } from '../BaseMode.js';

export default class CoordinatingMode extends BaseMode {
  constructor() {
    const config: ModeConfig = {
      id: 'coordinating',
      name: 'Coordinating',
      category: 'collaborative',
      symbol: '🎯',
      color: 'cyan',
      description: 'チーム調整モード - 活動管理と努力の統合',
      keywords: [
        'coordinate',
        'align',
        'synchronize',
        'manage',
        'organize',
        'schedule',
        'assign',
        'delegate',
        'track',
        'monitor',
      ],
      triggers: [
        'coordinate',
        'align',
        'synchronize',
        'manage team',
        'organize activities',
        'schedule',
        'assign tasks',
        'track progress',
      ],
      examples: [
        'Coordinate the team activities for this sprint',
        'Align everyone on the project timeline',
        'Synchronize efforts across departments',
        'Manage task assignments and dependencies',
        'Track progress and coordinate adjustments',
      ],
      enabled: true,
      priority: 5,
      timeout: 100000, // 1.67 minutes
      maxConcurrentSessions: 8,
    };

    super(config);
  }

  protected async onActivate(context: ModeContext): Promise<void> {
    console.log(
      `[${this.config.id}] Activating coordinating mode for session ${context.sessionId}`,
    );

    this.emit('display:update', {
      mode: this.config.id,
      symbol: this.config.symbol,
      text: 'Coordinating...',
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
    console.log(`[${this.config.id}] Deactivating coordinating mode for session ${sessionId}`);

    this.emit('analytics:event', {
      type: 'mode_deactivation',
      mode: this.config.id,
      sessionId,
      timestamp: Date.now(),
    });
  }

  protected async onProcess(input: string, context: ModeContext): Promise<ModeResult> {
    console.log(
      `[${this.config.id}] Processing coordination request: "${input.substring(0, 50)}..."`,
    );

    // Coordination process pipeline
    const teamAnalysis = await this.analyzeTeam(input, context);
    const activityMapping = await this.mapActivities(input, teamAnalysis);
    const coordinationPlan = await this.createCoordinationPlan(input, activityMapping);
    const resourceAllocation = await this.allocateResources(input, coordinationPlan);
    const synchronization = await this.planSynchronization(input, coordinationPlan);
    const monitoring = await this.setupMonitoring(input, synchronization);

    const suggestions = await this.generateCoordinationSuggestions(input, monitoring);
    const nextMode = await this.determineNextMode(input, monitoring);

    return {
      success: true,
      output: this.formatCoordinationResults(
        teamAnalysis,
        coordinationPlan,
        synchronization,
        monitoring,
      ),
      suggestions,
      nextRecommendedMode: nextMode,
      confidence: 0.86,
      metadata: {
        teamSize: teamAnalysis.size,
        activityCount: activityMapping.activities.length,
        coordinationComplexity: coordinationPlan.complexity,
        resourceTypes: resourceAllocation.types.length,
        synchronizationPoints: synchronization.points.length,
        monitoringFrequency: monitoring.frequency,
        processedAt: Date.now(),
      },
    };
  }

  protected async onCanHandle(
    input: string,
    context: ModeContext,
  ): Promise<{ confidence: number; reasoning: string[] }> {
    const reasoning: string[] = [];
    let confidence = 0.25;

    const inputLower = input.toLowerCase();

    // Direct coordination keywords
    const coordinationKeywords = [
      'coordinate',
      'align',
      'synchronize',
      'manage',
      'organize',
      'schedule',
      'assign',
      'delegate',
      'track',
      'monitor',
    ];

    const coordinationMatches = coordinationKeywords.filter((keyword) =>
      inputLower.includes(keyword),
    );
    if (coordinationMatches.length > 0) {
      confidence += 0.4;
      reasoning.push(`Coordination keywords: ${coordinationMatches.join(', ')}`);
    }

    // Team management terms
    const teamTerms = [
      'team',
      'members',
      'group',
      'people',
      'stakeholders',
      'participants',
      'colleagues',
      'staff',
      'resources',
    ];

    const teamMatches = teamTerms.filter((term) => inputLower.includes(term));
    if (teamMatches.length > 0) {
      confidence += 0.25;
      reasoning.push(`Team management terms: ${teamMatches.join(', ')}`);
    }

    // Activity and task management terms
    const activityTerms = [
      'activities',
      'tasks',
      'work',
      'assignments',
      'responsibilities',
      'duties',
      'projects',
      'initiatives',
      'efforts',
    ];

    const activityMatches = activityTerms.filter((term) => inputLower.includes(term));
    if (activityMatches.length > 0) {
      confidence += 0.2;
      reasoning.push(`Activity management terms: ${activityMatches.join(', ')}`);
    }

    // Time and scheduling terms
    const timeTerms = [
      'schedule',
      'timeline',
      'deadline',
      'timing',
      'when',
      'sequence',
      'order',
      'priority',
      'urgency',
    ];

    const timeMatches = timeTerms.filter((term) => inputLower.includes(term));
    if (timeMatches.length > 0) {
      confidence += 0.15;
      reasoning.push(`Scheduling terms: ${timeMatches.join(', ')}`);
    }

    // Progress and tracking terms
    const progressTerms = [
      'progress',
      'status',
      'update',
      'report',
      'tracking',
      'monitoring',
      'oversight',
      'follow-up',
    ];

    const progressMatches = progressTerms.filter((term) => inputLower.includes(term));
    if (progressMatches.length > 0) {
      confidence += 0.15;
      reasoning.push(`Progress tracking terms: ${progressMatches.join(', ')}`);
    }

    // Multiple entity indicators
    const multipleIndicators = ['multiple', 'various', 'different', 'several', 'many'];
    const multipleMatches = multipleIndicators.filter((indicator) =>
      inputLower.includes(indicator),
    );
    if (multipleMatches.length > 0) {
      confidence += 0.1;
      reasoning.push('Multiple entity coordination indicators');
    }

    // Communication and alignment terms
    const communicationTerms = [
      'communicate',
      'inform',
      'update',
      'align',
      'sync',
      'meeting',
      'discussion',
      'collaboration',
    ];

    const commMatches = communicationTerms.filter((term) => inputLower.includes(term));
    if (commMatches.length > 0) {
      confidence += 0.1;
      reasoning.push(`Communication terms: ${commMatches.join(', ')}`);
    }

    // Context-based adjustments
    if (context.previousMode === 'planning') {
      confidence += 0.2;
      reasoning.push('Natural progression from planning to coordination');
    }

    if (context.previousMode === 'facilitating') {
      confidence += 0.15;
      reasoning.push('Good follow-up to facilitation activities');
    }

    return { confidence: Math.min(confidence, 1.0), reasoning };
  }

  /**
   * Analyze the team structure and dynamics
   */
  private async analyzeTeam(input: string, context: ModeContext): Promise<unknown> {
    const analysis = {
      size: this.estimateTeamSize(input),
      roles: this.identifyTeamRoles(input),
      skills: this.mapTeamSkills(input),
      availability: this.assessTeamAvailability(input),
      dynamics: this.analyzeTeamDynamics(input),
      communication_patterns: this.identifyCommunicationPatterns(input),
      collaboration_level: this.assessCollaborationLevel(input),
    };

    return analysis;
  }

  /**
   * Map activities and dependencies
   */
  private async mapActivities(input: string, teamAnalysis: unknown): Promise<unknown> {
    const mapping = {
      activities: this.extractActivities(input),
      dependencies: this.identifyDependencies(input),
      priorities: this.assignPriorities(input),
      timelines: this.estimateTimelines(input),
      resource_requirements: this.identifyResourceRequirements(input),
      skills_required: this.mapRequiredSkills(input),
    };

    return mapping;
  }

  /**
   * Create comprehensive coordination plan
   */
  private async createCoordinationPlan(input: string, activityMapping: unknown): Promise<unknown> {
    const plan = {
      strategy: this.selectCoordinationStrategy(activityMapping),
      structure: this.designCoordinationStructure(activityMapping),
      workflow: this.designWorkflow(activityMapping),
      communication_plan: this.createCommunicationPlan(activityMapping),
      decision_framework: this.establishDecisionFramework(activityMapping),
      complexity: this.assessCoordinationComplexity(activityMapping),
    };

    return plan;
  }

  /**
   * Allocate resources effectively
   */
  private async allocateResources(input: string, coordinationPlan: unknown): Promise<unknown> {
    const allocation = {
      types: this.identifyResourceTypes(coordinationPlan),
      assignments: this.createResourceAssignments(coordinationPlan),
      optimization: this.optimizeResourceUtilization(coordinationPlan),
      contingency: this.planResourceContingency(coordinationPlan),
      monitoring: this.setupResourceMonitoring(coordinationPlan),
    };

    return allocation;
  }

  /**
   * Plan synchronization points and mechanisms
   */
  private async planSynchronization(input: string, coordinationPlan: unknown): Promise<unknown> {
    const synchronization = {
      points: this.defineSynchronizationPoints(coordinationPlan),
      mechanisms: this.selectSynchronizationMechanisms(coordinationPlan),
      frequency: this.determineSynchronizationFrequency(coordinationPlan),
      protocols: this.establishSynchronizationProtocols(coordinationPlan),
      tools: this.selectSynchronizationTools(coordinationPlan),
    };

    return synchronization;
  }

  /**
   * Setup monitoring and tracking systems
   */
  private async setupMonitoring(input: string, synchronization: unknown): Promise<unknown> {
    const monitoring = {
      metrics: this.defineMonitoringMetrics(synchronization),
      dashboards: this.designMonitoringDashboards(synchronization),
      alerts: this.setupAlertSystems(synchronization),
      reporting: this.createReportingStructure(synchronization),
      frequency: this.determineMonitoringFrequency(synchronization),
      escalation: this.planEscalationProcedures(synchronization),
    };

    return monitoring;
  }

  /**
   * Format coordination results
   */
  private formatCoordinationResults(
    teamAnalysis: unknown,
    coordinationPlan: unknown,
    synchronization: unknown,
    monitoring: unknown,
  ): string {
    const output: string[] = [];

    output.push('Team Coordination Plan');
    output.push('═'.repeat(22));
    output.push('');

    output.push('Team Analysis:');
    output.push(`Team Size: ${teamAnalysis.size}`);
    output.push(`Key Roles: ${teamAnalysis.roles.join(', ')}`);
    output.push(`Collaboration Level: ${teamAnalysis.collaboration_level}`);
    output.push('');

    output.push('Coordination Strategy:');
    output.push(`Strategy: ${coordinationPlan.strategy}`);
    output.push(`Structure: ${coordinationPlan.structure}`);
    output.push(`Complexity: ${coordinationPlan.complexity}`);
    output.push('');

    output.push('Key Activities:');
    coordinationPlan.workflow.activities.slice(0, 4).forEach((activity: string, index: number) => {
      output.push(`${index + 1}. ${activity}`);
    });
    output.push('');

    output.push('Synchronization Plan:');
    output.push(`Frequency: ${synchronization.frequency}`);
    output.push(`Sync Points: ${synchronization.points.length}`);
    output.push('Key Sync Mechanisms:');
    synchronization.mechanisms.slice(0, 3).forEach((mechanism: string) => {
      output.push(`• ${mechanism}`);
    });
    output.push('');

    output.push('Communication Framework:');
    output.push('Regular Updates:');
    coordinationPlan.communication_plan.channels.forEach((channel: string) => {
      output.push(`• ${channel}`);
    });
    output.push('');

    output.push('Monitoring & Tracking:');
    output.push(`Monitoring Frequency: ${monitoring.frequency}`);
    output.push('Key Metrics:');
    monitoring.metrics.slice(0, 3).forEach((metric: string) => {
      output.push(`• ${metric}`);
    });

    return output.join('\n');
  }

  /**
   * Generate coordination-specific suggestions
   */
  private async generateCoordinationSuggestions(
    input: string,
    monitoring: unknown,
  ): Promise<string[]> {
    const suggestions: string[] = [];

    suggestions.push('Establish clear roles and responsibilities');
    suggestions.push('Set up regular check-in meetings');

    if (monitoring.frequency === 'high') {
      suggestions.push('Consider automated progress tracking tools');
    }

    suggestions.push('Create shared documentation and status boards');
    suggestions.push('Plan for conflict resolution procedures');

    return suggestions.slice(0, 4);
  }

  /**
   * Determine next recommended mode
   */
  private async determineNextMode(input: string, monitoring: unknown): Promise<string | undefined> {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('implement') || inputLower.includes('execute')) {
      return 'organizing';
    }

    if (inputLower.includes('meeting') || inputLower.includes('discuss')) {
      return 'facilitating';
    }

    if (inputLower.includes('track') || inputLower.includes('monitor')) {
      return 'analyzing';
    }

    if (inputLower.includes('adjust') || inputLower.includes('improve')) {
      return 'adapting';
    }

    return 'reflecting';
  }

  // Helper methods
  private estimateTeamSize(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('large team') || inputLower.includes('many people'))
      return 'large (10+ members)';
    if (inputLower.includes('small team') || inputLower.includes('few people'))
      return 'small (3-5 members)';
    if (inputLower.includes('medium') || inputLower.includes('several'))
      return 'medium (6-9 members)';

    return 'medium (6-9 members)';
  }

  private identifyTeamRoles(input: string): string[] {
    const roles: string[] = [];
    const inputLower = input.toLowerCase();

    if (inputLower.includes('developer')) roles.push('Developer');
    if (inputLower.includes('designer')) roles.push('Designer');
    if (inputLower.includes('manager')) roles.push('Manager');
    if (inputLower.includes('analyst')) roles.push('Analyst');
    if (inputLower.includes('tester')) roles.push('Tester');

    return roles.length > 0 ? roles : ['Team Member', 'Lead', 'Specialist'];
  }

  private mapTeamSkills(input: string): string[] {
    const skills: string[] = [];
    const inputLower = input.toLowerCase();

    if (inputLower.includes('technical')) skills.push('Technical Skills');
    if (inputLower.includes('creative')) skills.push('Creative Skills');
    if (inputLower.includes('analytical')) skills.push('Analytical Skills');
    if (inputLower.includes('communication')) skills.push('Communication Skills');

    return skills.length > 0 ? skills : ['Mixed Skills'];
  }

  private assessTeamAvailability(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('full time') || inputLower.includes('dedicated')) return 'high';
    if (inputLower.includes('part time') || inputLower.includes('limited')) return 'medium';
    if (inputLower.includes('busy') || inputLower.includes('constrained')) return 'low';

    return 'medium';
  }

  private analyzeTeamDynamics(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('collaborative') || inputLower.includes('cooperative'))
      return 'collaborative';
    if (inputLower.includes('independent') || inputLower.includes('autonomous'))
      return 'independent';
    if (inputLower.includes('hierarchical') || inputLower.includes('structured'))
      return 'hierarchical';

    return 'mixed';
  }

  private identifyCommunicationPatterns(input: string): string[] {
    return [
      'Regular team meetings',
      'Asynchronous updates',
      'Direct peer communication',
      'Formal reporting channels',
    ];
  }

  private assessCollaborationLevel(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('highly collaborative') || inputLower.includes('close cooperation'))
      return 'high';
    if (inputLower.includes('some collaboration') || inputLower.includes('moderate'))
      return 'medium';
    if (inputLower.includes('minimal') || inputLower.includes('independent')) return 'low';

    return 'medium';
  }

  private extractActivities(input: string): string[] {
    // Extract activities mentioned in the input
    const activities: string[] = [];
    const activityKeywords = ['develop', 'design', 'test', 'analyze', 'implement', 'review'];
    const inputLower = input.toLowerCase();

    activityKeywords.forEach((keyword) => {
      if (inputLower.includes(keyword)) {
        activities.push(`${keyword.charAt(0).toUpperCase() + keyword.slice(1)} activities`);
      }
    });

    return activities.length > 0
      ? activities
      : ['Core project activities', 'Support activities', 'Review activities'];
  }

  private identifyDependencies(input: string): string[] {
    return [
      'Sequential task dependencies',
      'Resource sharing dependencies',
      'Knowledge transfer dependencies',
      'Approval dependencies',
    ];
  }

  private assignPriorities(input: string): unknown {
    return {
      high: ['Critical path activities', 'Blocked dependencies'],
      medium: ['Standard deliverables', 'Planned milestones'],
      low: ['Nice-to-have features', 'Future enhancements'],
    };
  }

  private estimateTimelines(input: string): unknown {
    const timeframe = this.extractTimeframe(input);

    return {
      overall: timeframe,
      phases: this.breakdownPhases(timeframe),
      milestones: this.defineMilestones(timeframe),
    };
  }

  private identifyResourceRequirements(input: string): string[] {
    return [
      'Human resources',
      'Technical resources',
      'Time allocation',
      'Budget allocation',
      'Tools and equipment',
    ];
  }

  private mapRequiredSkills(input: string): string[] {
    return this.mapTeamSkills(input);
  }

  private selectCoordinationStrategy(activityMapping: unknown): string {
    const activityCount = activityMapping.activities.length;

    if (activityCount > 6) return 'matrix_coordination';
    if (activityCount > 3) return 'hierarchical_coordination';
    return 'direct_coordination';
  }

  private designCoordinationStructure(activityMapping: unknown): string {
    return 'Hub-and-spoke with direct peer connections';
  }

  private designWorkflow(activityMapping: unknown): unknown {
    return {
      activities: activityMapping.activities,
      sequence: 'parallel_with_sync_points',
      handoffs: this.defineHandoffs(activityMapping),
      checkpoints: this.defineCheckpoints(activityMapping),
    };
  }

  private createCommunicationPlan(activityMapping: unknown): unknown {
    return {
      channels: [
        'Daily standup meetings',
        'Weekly progress reviews',
        'Async status updates',
        'Direct peer communication',
      ],
      frequency: 'regular',
      escalation: 'defined_hierarchy',
    };
  }

  private establishDecisionFramework(activityMapping: unknown): unknown {
    return {
      authority_matrix: 'RACI-based',
      escalation_path: 'clear_hierarchy',
      consensus_threshold: '80%',
      decision_speed: 'optimized',
    };
  }

  private assessCoordinationComplexity(activityMapping: unknown): string {
    const factors = [
      activityMapping.activities.length,
      activityMapping.dependencies.length,
      Object.keys(activityMapping.priorities).length,
    ];

    const complexity = factors.reduce((sum, factor) => sum + factor, 0);

    if (complexity > 15) return 'high';
    if (complexity > 8) return 'medium';
    return 'low';
  }

  private identifyResourceTypes(coordinationPlan: unknown): string[] {
    return ['human', 'technical', 'financial', 'time', 'information'];
  }

  private createResourceAssignments(coordinationPlan: unknown): unknown {
    return {
      methodology: 'skill_and_availability_based',
      optimization: 'load_balancing',
      flexibility: 'cross_training_enabled',
    };
  }

  private optimizeResourceUtilization(coordinationPlan: unknown): string {
    return 'Dynamic allocation with buffer management';
  }

  private planResourceContingency(coordinationPlan: unknown): string[] {
    return [
      'Backup resource identification',
      'Skill redundancy planning',
      'External resource options',
      'Timeline adjustment protocols',
    ];
  }

  private setupResourceMonitoring(coordinationPlan: unknown): string {
    return 'Real-time utilization tracking with automated alerts';
  }

  private defineSynchronizationPoints(coordinationPlan: unknown): string[] {
    return [
      'Daily synchronization',
      'Weekly milestone review',
      'Phase completion sync',
      'Issue resolution sync',
    ];
  }

  private selectSynchronizationMechanisms(coordinationPlan: unknown): string[] {
    return [
      'Regular team meetings',
      'Shared status dashboards',
      'Automated progress reports',
      'Collaborative planning sessions',
    ];
  }

  private determineSynchronizationFrequency(coordinationPlan: unknown): string {
    switch (coordinationPlan.complexity) {
      case 'high':
        return 'daily';
      case 'medium':
        return 'twice_weekly';
      default:
        return 'weekly';
    }
  }

  private establishSynchronizationProtocols(coordinationPlan: unknown): string[] {
    return [
      'Standard meeting agenda format',
      'Progress reporting template',
      'Issue escalation procedure',
      'Decision documentation process',
    ];
  }

  private selectSynchronizationTools(coordinationPlan: unknown): string[] {
    return [
      'Project management software',
      'Communication platforms',
      'Shared documentation systems',
      'Status tracking tools',
    ];
  }

  private defineMonitoringMetrics(synchronization: unknown): string[] {
    return [
      'Task completion rate',
      'Milestone achievement',
      'Resource utilization',
      'Communication effectiveness',
      'Issue resolution time',
    ];
  }

  private designMonitoringDashboards(synchronization: unknown): string[] {
    return [
      'Executive summary dashboard',
      'Team progress dashboard',
      'Resource utilization dashboard',
      'Issue tracking dashboard',
    ];
  }

  private setupAlertSystems(synchronization: unknown): string[] {
    return [
      'Deadline approaching alerts',
      'Resource constraint warnings',
      'Dependency blocking notifications',
      'Quality threshold alerts',
    ];
  }

  private createReportingStructure(synchronization: unknown): string {
    return 'Tiered reporting with automated summaries';
  }

  private determineMonitoringFrequency(synchronization: unknown): string {
    return synchronization.frequency === 'daily' ? 'continuous' : 'regular';
  }

  private planEscalationProcedures(synchronization: unknown): string[] {
    return [
      'Clear escalation criteria',
      'Defined escalation paths',
      'Response time requirements',
      'Resolution authority levels',
    ];
  }

  private extractTimeframe(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('week')) return 'weeks';
    if (inputLower.includes('month')) return 'months';
    if (inputLower.includes('quarter')) return 'quarters';
    if (inputLower.includes('sprint')) return 'sprints';

    return 'weeks';
  }

  private breakdownPhases(timeframe: string): string[] {
    const phases = ['Initiation', 'Execution', 'Monitoring', 'Closure'];

    if (timeframe === 'months' || timeframe === 'quarters') {
      phases.splice(2, 0, 'Mid-point Review');
    }

    return phases;
  }

  private defineMilestones(timeframe: string): string[] {
    return ['Project kickoff', 'First deliverable', 'Mid-point review', 'Final delivery'];
  }

  private defineHandoffs(activityMapping: unknown): string[] {
    return [
      'Requirements to design handoff',
      'Design to development handoff',
      'Development to testing handoff',
      'Testing to deployment handoff',
    ];
  }

  private defineCheckpoints(activityMapping: unknown): string[] {
    return [
      'Quality gate checkpoints',
      'Progress review checkpoints',
      'Resource allocation checkpoints',
      'Risk assessment checkpoints',
    ];
  }
}
