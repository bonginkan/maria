/**
 * Reviewing Mode Plugin - Comprehensive review and audit mode
 * Specialized for systematic reviews, quality audits, and assessment processes
 */

import { BaseMode, ModeConfig, ModeContext, ModeResult } from '../BaseMode.js';

export default class ReviewingMode extends BaseMode {
  constructor() {
    const config: ModeConfig = {
      id: 'reviewing',
      name: 'Reviewing',
      category: 'validation',
      symbol: '📝',
      color: 'blue',
      description: 'レビュー・監査モード - 体系的レビューと品質監査',
      keywords: [
        'review',
        'audit',
        'inspect',
        'examine',
        'assess',
        'evaluate',
        'check',
        'analyze',
        'critique',
        'scrutinize',
      ],
      triggers: [
        'review',
        'audit',
        'inspect',
        'examine',
        'assess quality',
        'code review',
        'peer review',
        'quality review',
        'check work',
      ],
      examples: [
        'Review the code for quality and best practices',
        'Audit the system architecture for compliance',
        'Examine the documentation for completeness',
        'Assess the project deliverables against requirements',
        'Conduct a peer review of the implementation',
      ],
      enabled: true,
      priority: 8,
      timeout: 100000, // 1.67 minutes
      maxConcurrentSessions: 10,
    };

    super(config);
  }

  protected async onActivate(context: ModeContext): Promise<void> {
    console.log(`[${this.config.id}] Activating reviewing mode for session ${context.sessionId}`);

    this.emit('display:update', {
      mode: this.config.id,
      symbol: this.config.symbol,
      text: 'Reviewing...',
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
    console.log(`[${this.config.id}] Deactivating reviewing mode for session ${sessionId}`);

    this.emit('analytics:event', {
      type: 'mode_deactivation',
      mode: this.config.id,
      sessionId,
      timestamp: Date.now(),
    });
  }

  protected async onProcess(input: string, context: ModeContext): Promise<ModeResult> {
    console.log(`[${this.config.id}] Processing review request: "${input.substring(0, 50)}..."`);

    // Review process pipeline
    const reviewScope = await this.defineReviewScope(input, context);
    const criteria = await this.establishReviewCriteria(input, reviewScope);
    const methodology = await this.selectReviewMethodology(input, criteria);
    const examination = await this.conductExamination(input, methodology);
    const findings = await this.analyzeFindings(input, examination);
    const recommendations = await this.generateRecommendations(input, findings);

    const suggestions = await this.generateReviewSuggestions(input, recommendations);
    const nextMode = await this.determineNextMode(input, recommendations);

    return {
      success: true,
      output: this.formatReviewResults(
        reviewScope,
        criteria,
        examination,
        findings,
        recommendations,
      ),
      suggestions,
      nextRecommendedMode: nextMode,
      confidence: 0.91,
      metadata: {
        reviewType: reviewScope.type,
        criteriaCount: criteria.length,
        findingsCount: findings.issues.length,
        severity: findings.maxSeverity,
        compliance: findings.complianceScore,
        quality: findings.qualityScore,
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

    // Direct review keywords
    const reviewKeywords = [
      'review',
      'audit',
      'inspect',
      'examine',
      'assess',
      'evaluate',
      'check',
      'analyze',
      'critique',
      'scrutinize',
    ];

    const reviewMatches = reviewKeywords.filter((keyword) => inputLower.includes(keyword));
    if (reviewMatches.length > 0) {
      confidence += 0.4;
      reasoning.push(`Review keywords: ${reviewMatches.join(', ')}`);
    }

    // Specific review types
    const reviewTypes = [
      'code review',
      'peer review',
      'design review',
      'architecture review',
      'security review',
      'quality review',
      'compliance review',
      'technical review',
    ];

    const reviewTypeMatches = reviewTypes.filter((type) => inputLower.includes(type));
    if (reviewTypeMatches.length > 0) {
      confidence += 0.35;
      reasoning.push(`Specific review types: ${reviewTypeMatches.join(', ')}`);
    }

    // Quality and compliance terms
    const qualityTerms = [
      'quality',
      'compliance',
      'standards',
      'best practices',
      'guidelines',
      'requirements',
      'specifications',
      'criteria',
    ];

    const qualityMatches = qualityTerms.filter((term) => inputLower.includes(term));
    if (qualityMatches.length > 0) {
      confidence += 0.25;
      reasoning.push(`Quality/compliance terms: ${qualityMatches.join(', ')}`);
    }

    // Assessment and evaluation terms
    const assessmentTerms = [
      'assessment',
      'evaluation',
      'validation',
      'verification',
      'analysis',
      'examination',
      'investigation',
      'study',
    ];

    const assessmentMatches = assessmentTerms.filter((term) => inputLower.includes(term));
    if (assessmentMatches.length > 0) {
      confidence += 0.2;
      reasoning.push(`Assessment terms: ${assessmentMatches.join(', ')}`);
    }

    // Improvement and feedback terms
    const improvementTerms = [
      'feedback',
      'improvement',
      'suggestion',
      'recommendation',
      'issue',
      'problem',
      'concern',
      'observation',
    ];

    const improvementMatches = improvementTerms.filter((term) => inputLower.includes(term));
    if (improvementMatches.length > 0) {
      confidence += 0.15;
      reasoning.push(`Improvement/feedback terms: ${improvementMatches.join(', ')}`);
    }

    // Deliverable and artifact terms
    const deliverableTerms = [
      'document',
      'deliverable',
      'artifact',
      'output',
      'work product',
      'submission',
      'draft',
      'final',
    ];

    const deliverableMatches = deliverableTerms.filter((term) => inputLower.includes(term));
    if (deliverableMatches.length > 0) {
      confidence += 0.1;
      reasoning.push(`Deliverable terms: ${deliverableMatches.join(', ')}`);
    }

    // Questions that suggest review need
    const reviewQuestions = [
      /is.*correct/i,
      /does.*meet/i,
      /how.*good/i,
      /what.*think/i,
      /any.*issues/i,
      /can.*improve/i,
      /ready.*for/i,
    ];

    const questionMatches = reviewQuestions.filter((pattern) => pattern.test(input));
    if (questionMatches.length > 0) {
      confidence += 0.15;
      reasoning.push('Review-oriented questions detected');
    }

    // Context-based adjustments
    if (context.previousMode === 'implementing') {
      confidence += 0.2;
      reasoning.push('Natural follow-up to implementation');
    }

    if (context.previousMode === 'testing') {
      confidence += 0.15;
      reasoning.push('Good complement to testing activities');
    }

    return { confidence: Math.min(confidence, 1.0), reasoning };
  }

  /**
   * Define the scope of review
   */
  private async defineReviewScope(input: string, context: ModeContext): Promise<unknown> {
    const scope = {
      type: this.identifyReviewType(input),
      target: this.identifyReviewTarget(input),
      objectives: this.defineReviewObjectives(input),
      stakeholders: this.identifyReviewStakeholders(input),
      timeline: this.estimateReviewTimeline(input),
      depth: this.determineReviewDepth(input),
      coverage: this.defineReviewCoverage(input),
    };

    return scope;
  }

  /**
   * Establish review criteria
   */
  private async establishReviewCriteria(input: string, scope: unknown): Promise<unknown[]> {
    const criteria: unknown[] = [];

    // Type-specific criteria
    switch (scope.type) {
      case 'code_review':
        criteria.push(...this.getCodeReviewCriteria());
        break;
      case 'design_review':
        criteria.push(...this.getDesignReviewCriteria());
        break;
      case 'security_review':
        criteria.push(...this.getSecurityReviewCriteria());
        break;
      case 'quality_review':
        criteria.push(...this.getQualityReviewCriteria());
        break;
      default:
        criteria.push(...this.getGeneralReviewCriteria());
    }

    return criteria;
  }

  /**
   * Select review methodology
   */
  private async selectReviewMethodology(input: string, criteria: unknown[]): Promise<unknown> {
    const methodology = {
      approach: this.selectReviewApproach(input, criteria),
      techniques: this.selectReviewTechniques(input),
      tools: this.recommendReviewTools(input),
      process: this.defineReviewProcess(input),
      documentation: this.planReviewDocumentation(input),
      validation: this.planReviewValidation(input),
    };

    return methodology;
  }

  /**
   * Conduct systematic examination
   */
  private async conductExamination(input: string, methodology: unknown): Promise<unknown> {
    const examination = {
      phases: this.executeReviewPhases(methodology),
      checklist: this.applyReviewChecklist(methodology),
      sampling: this.applySamplingStrategy(methodology),
      analysis: this.performDetailedAnalysis(methodology),
      cross_checks: this.performCrossChecks(methodology),
      validation: this.validateFindings(methodology),
    };

    return examination;
  }

  /**
   * Analyze findings and issues
   */
  private async analyzeFindings(input: string, examination: unknown): Promise<unknown> {
    const findings = {
      issues: this.categorizeIssues(examination),
      patterns: this.identifyPatterns(examination),
      trends: this.analyzeTrends(examination),
      root_causes: this.identifyRootCauses(examination),
      impact_assessment: this.assessImpact(examination),
      priority_ranking: this.rankPriorities(examination),
      complianceScore: this.calculateComplianceScore(examination),
      qualityScore: this.calculateQualityScore(examination),
      maxSeverity: this.determineMaxSeverity(examination),
    };

    return findings;
  }

  /**
   * Generate actionable recommendations
   */
  private async generateRecommendations(input: string, findings: unknown): Promise<unknown> {
    const recommendations = {
      immediate: this.generateImmediateActions(findings),
      short_term: this.generateShortTermActions(findings),
      long_term: this.generateLongTermActions(findings),
      preventive: this.generatePreventiveMeasures(findings),
      process_improvements: this.generateProcessImprovements(findings),
      best_practices: this.recommendBestPractices(findings),
    };

    return recommendations;
  }

  /**
   * Format review results
   */
  private formatReviewResults(
    scope: unknown,
    criteria: unknown[],
    examination: unknown,
    findings: unknown,
    recommendations: unknown,
  ): string {
    const output: string[] = [];

    output.push('Review Assessment Report');
    output.push('═'.repeat(25));
    output.push('');

    output.push('Review Scope:');
    output.push(`Type: ${scope.type}`);
    output.push(`Target: ${scope.target}`);
    output.push(`Depth: ${scope.depth}`);
    output.push(`Coverage: ${scope.coverage}`);
    output.push('');

    output.push('Assessment Criteria:');
    criteria.slice(0, 5).forEach((criterion, index) => {
      output.push(`${index + 1}. ${criterion.name} (Weight: ${criterion.weight})`);
    });
    output.push('');

    output.push('Review Summary:');
    output.push(`Quality Score: ${findings.qualityScore}/10`);
    output.push(`Compliance Score: ${findings.complianceScore}%`);
    output.push(`Total Issues Found: ${findings.issues.length}`);
    output.push(`Maximum Severity: ${findings.maxSeverity}`);
    output.push('');

    output.push('Key Findings:');
    findings.issues.slice(0, 4).forEach((issue: unknown, index: number) => {
      output.push(`${index + 1}. [${issue.severity}] ${issue.title}`);
      output.push(`   Category: ${issue.category}`);
    });
    output.push('');

    output.push('Priority Recommendations:');
    recommendations.immediate.slice(0, 3).forEach((rec: string, index: number) => {
      output.push(`${index + 1}. ${rec}`);
    });
    output.push('');

    output.push('Process Improvements:');
    recommendations.process_improvements.slice(0, 3).forEach((improvement: string) => {
      output.push(`• ${improvement}`);
    });

    return output.join('\n');
  }

  /**
   * Generate review suggestions
   */
  private async generateReviewSuggestions(
    input: string,
    recommendations: unknown,
  ): Promise<string[]> {
    const suggestions: string[] = [];

    suggestions.push('Address high-severity issues first');
    suggestions.push('Document review findings for future reference');

    if (recommendations.immediate.length > 0) {
      suggestions.push('Implement immediate action items promptly');
    }

    suggestions.push('Schedule follow-up review to verify improvements');
    suggestions.push('Share lessons learned with the team');

    return suggestions.slice(0, 4);
  }

  /**
   * Determine next recommended mode
   */
  private async determineNextMode(
    input: string,
    recommendations: unknown,
  ): Promise<string | undefined> {
    const inputLower = input.toLowerCase();

    if (recommendations.immediate.length > 0) {
      return 'debugging';
    }

    if (inputLower.includes('improve') || inputLower.includes('optimize')) {
      return 'optimizing';
    }

    if (inputLower.includes('implement') || inputLower.includes('fix')) {
      return 'adapting';
    }

    if (inputLower.includes('document') || inputLower.includes('report')) {
      return 'summarizing';
    }

    return 'reflecting';
  }

  // Helper methods
  private identifyReviewType(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('code')) return 'code_review';
    if (inputLower.includes('design')) return 'design_review';
    if (inputLower.includes('security')) return 'security_review';
    if (inputLower.includes('architecture')) return 'architecture_review';
    if (inputLower.includes('quality')) return 'quality_review';
    if (inputLower.includes('compliance')) return 'compliance_review';
    if (inputLower.includes('peer')) return 'peer_review';

    return 'general_review';
  }

  private identifyReviewTarget(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('document')) return 'documentation';
    if (inputLower.includes('code')) return 'source_code';
    if (inputLower.includes('design')) return 'design_artifacts';
    if (inputLower.includes('system')) return 'system_architecture';
    if (inputLower.includes('process')) return 'process_definition';

    return 'work_product';
  }

  private defineReviewObjectives(input: string): string[] {
    const objectives: string[] = [];
    const inputLower = input.toLowerCase();

    if (inputLower.includes('quality')) objectives.push('Ensure quality standards');
    if (inputLower.includes('compliance')) objectives.push('Verify compliance');
    if (inputLower.includes('best practice')) objectives.push('Validate best practices');
    if (inputLower.includes('requirement')) objectives.push('Check requirements adherence');

    return objectives.length > 0
      ? objectives
      : ['Assess quality', 'Identify improvements', 'Ensure standards'];
  }

  private identifyReviewStakeholders(input: string): string[] {
    const stakeholders: string[] = [];
    const inputLower = input.toLowerCase();

    if (inputLower.includes('team')) stakeholders.push('development team');
    if (inputLower.includes('architect')) stakeholders.push('solution architect');
    if (inputLower.includes('qa')) stakeholders.push('quality assurance');
    if (inputLower.includes('security')) stakeholders.push('security team');

    return stakeholders.length > 0 ? stakeholders : ['reviewer', 'author', 'stakeholders'];
  }

  private estimateReviewTimeline(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('quick') || inputLower.includes('brief')) return '2-4 hours';
    if (inputLower.includes('comprehensive') || inputLower.includes('thorough')) return '1-2 weeks';

    return '1-3 days';
  }

  private determineReviewDepth(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('deep') || inputLower.includes('thorough')) return 'comprehensive';
    if (inputLower.includes('quick') || inputLower.includes('high-level')) return 'overview';

    return 'detailed';
  }

  private defineReviewCoverage(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('complete') || inputLower.includes('full')) return 'complete';
    if (inputLower.includes('sample') || inputLower.includes('partial')) return 'sampling';

    return 'targeted';
  }

  private getCodeReviewCriteria(): unknown[] {
    return [
      { name: 'Code Quality', weight: 0.25, type: 'quality' },
      { name: 'Best Practices', weight: 0.2, type: 'standards' },
      { name: 'Performance', weight: 0.15, type: 'performance' },
      { name: 'Security', weight: 0.2, type: 'security' },
      { name: 'Maintainability', weight: 0.2, type: 'maintainability' },
    ];
  }

  private getDesignReviewCriteria(): unknown[] {
    return [
      { name: 'Design Principles', weight: 0.3, type: 'principles' },
      { name: 'Usability', weight: 0.25, type: 'usability' },
      { name: 'Scalability', weight: 0.2, type: 'scalability' },
      { name: 'Consistency', weight: 0.25, type: 'consistency' },
    ];
  }

  private getSecurityReviewCriteria(): unknown[] {
    return [
      { name: 'Security Controls', weight: 0.3, type: 'security' },
      { name: 'Data Protection', weight: 0.25, type: 'data_protection' },
      { name: 'Access Control', weight: 0.2, type: 'access_control' },
      { name: 'Compliance', weight: 0.25, type: 'compliance' },
    ];
  }

  private getQualityReviewCriteria(): unknown[] {
    return [
      { name: 'Completeness', weight: 0.25, type: 'completeness' },
      { name: 'Accuracy', weight: 0.25, type: 'accuracy' },
      { name: 'Consistency', weight: 0.2, type: 'consistency' },
      { name: 'Standards Compliance', weight: 0.3, type: 'standards' },
    ];
  }

  private getGeneralReviewCriteria(): unknown[] {
    return [
      { name: 'Requirements Adherence', weight: 0.3, type: 'requirements' },
      { name: 'Quality Standards', weight: 0.25, type: 'quality' },
      { name: 'Best Practices', weight: 0.25, type: 'practices' },
      { name: 'Documentation', weight: 0.2, type: 'documentation' },
    ];
  }

  private selectReviewApproach(input: string, criteria: unknown[]): string {
    if (criteria.length > 6) return 'structured_checklist';
    if (input.toLowerCase().includes('collaborative')) return 'collaborative_review';
    return 'systematic_inspection';
  }

  private selectReviewTechniques(input: string): string[] {
    return [
      'Checklist-based review',
      'Walkthrough method',
      'Inspection technique',
      'Pair review approach',
    ];
  }

  private recommendReviewTools(input: string): string[] {
    const inputLower = input.toLowerCase();
    const tools: string[] = [];

    if (inputLower.includes('code')) tools.push('Code review tools (GitHub, GitLab)');
    if (inputLower.includes('document')) tools.push('Document review tools');
    tools.push('Collaboration platforms', 'Issue tracking systems');

    return tools;
  }

  private defineReviewProcess(input: string): string[] {
    return [
      'Review preparation',
      'Individual examination',
      'Collaborative discussion',
      'Issue identification',
      'Recommendation formulation',
      'Report generation',
    ];
  }

  private planReviewDocumentation(input: string): string {
    return 'Structured documentation of findings, issues, and recommendations';
  }

  private planReviewValidation(input: string): string {
    return 'Validation of review findings through cross-verification';
  }

  private executeReviewPhases(methodology: unknown): string[] {
    return [
      'Preparation phase completed',
      'Examination phase executed',
      'Analysis phase conducted',
      'Validation phase performed',
    ];
  }

  private applyReviewChecklist(methodology: unknown): string {
    return 'Systematic checklist application for comprehensive coverage';
  }

  private applySamplingStrategy(methodology: unknown): string {
    return 'Representative sampling strategy applied for efficiency';
  }

  private performDetailedAnalysis(methodology: unknown): string {
    return 'In-depth analysis of identified issues and patterns';
  }

  private performCrossChecks(methodology: unknown): string {
    return 'Cross-verification performed for accuracy';
  }

  private validateFindings(methodology: unknown): string {
    return 'Findings validated through independent verification';
  }

  private categorizeIssues(examination: unknown): unknown[] {
    return [
      { id: 'ISS001', title: 'Code quality violation', category: 'Quality', severity: 'Medium' },
      { id: 'ISS002', title: 'Security vulnerability', category: 'Security', severity: 'High' },
      { id: 'ISS003', title: 'Performance concern', category: 'Performance', severity: 'Low' },
    ];
  }

  private identifyPatterns(examination: unknown): string[] {
    return [
      'Recurring code quality issues',
      'Consistent documentation gaps',
      'Pattern of security oversights',
    ];
  }

  private analyzeTrends(examination: unknown): string[] {
    return [
      'Improvement in code quality over time',
      'Increasing attention to security',
      'Better documentation practices',
    ];
  }

  private identifyRootCauses(examination: unknown): string[] {
    return [
      'Insufficient code review processes',
      'Lack of automated quality checks',
      'Limited security awareness training',
    ];
  }

  private assessImpact(examination: unknown): unknown {
    return {
      high: 1,
      medium: 1,
      low: 1,
      overall: 'medium',
    };
  }

  private rankPriorities(examination: unknown): string[] {
    return [
      'Address security vulnerabilities immediately',
      'Improve code quality standards',
      'Enhance documentation coverage',
    ];
  }

  private calculateComplianceScore(examination: unknown): number {
    return 85; // Simulated compliance score
  }

  private calculateQualityScore(examination: unknown): number {
    return 7.5; // Simulated quality score out of 10
  }

  private determineMaxSeverity(examination: unknown): string {
    return 'High'; // Based on categorized issues
  }

  private generateImmediateActions(findings: unknown): string[] {
    return [
      'Fix high-severity security vulnerability',
      'Address critical quality issues',
      'Update non-compliant documentation',
    ];
  }

  private generateShortTermActions(findings: unknown): string[] {
    return [
      'Implement automated quality checks',
      'Enhance code review process',
      'Provide security training to team',
    ];
  }

  private generateLongTermActions(findings: unknown): string[] {
    return [
      'Establish comprehensive quality framework',
      'Implement continuous compliance monitoring',
      'Develop organizational best practices',
    ];
  }

  private generatePreventiveMeasures(findings: unknown): string[] {
    return [
      'Implement pre-commit quality gates',
      'Establish regular review cycles',
      'Create quality metrics dashboard',
    ];
  }

  private generateProcessImprovements(findings: unknown): string[] {
    return [
      'Streamline review workflow',
      'Enhance review criteria clarity',
      'Improve feedback mechanisms',
      'Automate routine checks',
    ];
  }

  private recommendBestPractices(findings: unknown): string[] {
    return [
      'Follow industry-standard review practices',
      'Maintain review documentation templates',
      'Establish clear review guidelines',
      'Promote collaborative review culture',
    ];
  }
}
