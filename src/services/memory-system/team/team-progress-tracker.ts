/**
 * Team Progress Tracker
 *
 * Real-time progress monitoring and analytics for team collaboration.
 * Provides insights into team velocity, bottlenecks, and productivity patterns.
 */

import { EventEmitter } from 'events';
import type {
  BugTracker,
  DeploymentState,
  FeatureProgress,
  Milestone,
  ReviewQueue,
  Sprint,
  TaskProgress,
  TeamMember,
} from './workspace-memory-manager';

export interface ProgressMetrics {
  velocity: VelocityMetrics;
  productivity: ProductivityMetrics;
  quality: QualityProgressMetrics;
  collaboration: CollaborationMetrics;
  predictive: PredictiveAnalytics;
}

export interface VelocityMetrics {
  currentSprint: SprintVelocity;
  historicalAverage: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  projectedCompletion: Date;
  burndownRate: number;
  burnupRate: number;
}

export interface SprintVelocity {
  plannedPoints: number;
  completedPoints: number;
  remainingPoints: number;
  dailyVelocity: number;
  percentComplete: number;
  daysRemaining: number;
  onTrack: boolean;
}

export interface ProductivityMetrics {
  individual: Map<string, IndividualProductivity>;
  team: TeamProductivity;
  trends: ProductivityTrend[];
  bottlenecks: Bottleneck[];
}

export interface IndividualProductivity {
  memberId: string;
  tasksCompleted: number;
  tasksInProgress: number;
  averageCompletionTime: number;
  focusTime: number;
  contextSwitches: number;
  efficiency: number;
  contributionScore: number;
}

export interface TeamProductivity {
  totalTasks: number;
  completedTasks: number;
  averageTaskTime: number;
  parallelEfficiency: number;
  collaborationIndex: number;
  knowledgeSharingScore: number;
}

export interface ProductivityTrend {
  period: 'daily' | 'weekly' | 'monthly';
  timestamp: Date;
  productivity: number;
  factors: Array<{
    name: string;
    impact: number;
  }>;
}

export interface Bottleneck {
  type: 'task' | 'dependency' | 'resource' | 'skill' | 'communication';
  description: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  affectedTasks: string[];
  affectedMembers: string[];
  suggestedActions: string[];
  estimatedDelay: number;
}

export interface QualityProgressMetrics {
  codeQuality: CodeQualityProgress;
  testCoverage: TestCoverageProgress;
  bugMetrics: BugProgressMetrics;
  reviewMetrics: ReviewProgressMetrics;
}

export interface CodeQualityProgress {
  currentScore: number;
  targetScore: number;
  trend: number[];
  violations: QualityViolation[];
  improvements: QualityImprovement[];
}

export interface QualityViolation {
  type: string;
  severity: 'info' | 'warning' | 'error';
  count: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface QualityImprovement {
  area: string;
  improvement: number;
  period: string;
  contributor: string;
}

export interface TestCoverageProgress {
  overall: number;
  unit: number;
  integration: number;
  e2e: number;
  trend: number[];
  uncoveredAreas: string[];
}

export interface BugProgressMetrics {
  openBugs: number;
  resolvedBugs: number;
  averageResolutionTime: number;
  criticalBugs: number;
  regressionRate: number;
  escapeRate: number;
}

export interface ReviewProgressMetrics {
  pendingReviews: number;
  completedReviews: number;
  averageReviewTime: number;
  firstPassApprovalRate: number;
  reviewerWorkload: Map<string, number>;
}

export interface CollaborationMetrics {
  communicationFrequency: number;
  knowledgeTransfer: number;
  pairProgrammingHours: number;
  crossTeamCollaboration: number;
  mentorshipActivities: number;
  teamSentiment: number;
}

export interface PredictiveAnalytics {
  completionPredictions: CompletionPrediction[];
  riskAssessment: RiskAssessment[];
  resourceNeeds: ResourcePrediction[];
  qualityForecast: QualityForecast;
}

export interface CompletionPrediction {
  itemType: 'task' | 'feature' | 'milestone' | 'sprint';
  itemId: string;
  predictedCompletion: Date;
  confidence: number;
  factors: Array<{
    name: string;
    impact: 'positive' | 'negative';
    weight: number;
  }>;
}

export interface RiskAssessment {
  riskType: string;
  probability: number;
  impact: number;
  riskScore: number;
  mitigation: string[];
  earlyWarnings: string[];
}

export interface ResourcePrediction {
  resourceType: 'developer' | 'reviewer' | 'tester' | 'designer';
  currentCapacity: number;
  requiredCapacity: number;
  gap: number;
  recommendation: string;
}

export interface QualityForecast {
  predictedQualityScore: number;
  confidenceInterval: [number, number];
  riskFactors: string[];
  recommendations: string[];
}

export interface ProgressSnapshot {
  timestamp: Date;
  metrics: ProgressMetrics;
  alerts: ProgressAlert[];
  insights: ProgressInsight[];
}

export interface ProgressAlert {
  type: 'deadline' | 'bottleneck' | 'quality' | 'resource' | 'risk';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  affectedItems: string[];
  suggestedAction: string;
}

export interface ProgressInsight {
  category: string;
  insight: string;
  confidence: number;
  actionable: boolean;
  recommendations: string[];
}

export class TeamProgressTracker extends EventEmitter {
  private progressHistory: ProgressSnapshot[];
  private currentMetrics: ProgressMetrics;
  private updateInterval?: NodeJS.Timeout;
  private analyticsEngine: AnalyticsEngine;

  constructor() {
    super();

    this.progressHistory = [];
    this.currentMetrics = this.initializeMetrics();
    this.analyticsEngine = new AnalyticsEngine();

    this.startTracking();
  }

  // ========== Core Tracking Methods ==========

  async trackTaskProgress(task: TaskProgress & { assignedTo: string }): Promise<void> {
    // Update individual productivity metrics
    const individualMetrics =
      this.currentMetrics.productivity.individual.get(task.assignedTo) ||
      this.createIndividualProductivity(task.assignedTo);

    if (task.status === 'completed') {
      individualMetrics.tasksCompleted++;
      individualMetrics.averageCompletionTime = this.updateAverage(
        individualMetrics.averageCompletionTime,
        task.actualHours,
        individualMetrics.tasksCompleted,
      );
    } else if (task.status === 'in-progress') {
      individualMetrics.tasksInProgress++;
    }

    this.currentMetrics.productivity.individual.set(task.assignedTo, individualMetrics);

    // Update team productivity
    await this.updateTeamProductivity();

    // Check for bottlenecks
    if (task.blockers && task.blockers.length > 0) {
      await this.analyzeBottlenecks(task);
    }

    // Generate predictions
    await this.updatePredictions();

    this.emit('taskProgressTracked', { task, metrics: this.currentMetrics });
  }

  async trackFeatureProgress(feature: FeatureProgress): Promise<void> {
    // Calculate feature velocity
    const velocity = this.calculateFeatureVelocity(feature);

    // Update sprint metrics if applicable
    await this.updateSprintMetrics(feature);

    // Generate completion predictions
    const prediction = await this.predictFeatureCompletion(feature);
    this.currentMetrics.predictive.completionPredictions.push(prediction);

    this.emit('featureProgressTracked', { feature, velocity, prediction });
  }

  async trackSprintProgress(sprint: Sprint): Promise<void> {
    const sprintVelocity = this.calculateSprintVelocity(sprint);

    this.currentMetrics.velocity.currentSprint = sprintVelocity;
    this.currentMetrics.velocity.trend = this.calculateVelocityTrend();
    this.currentMetrics.velocity.projectedCompletion = this.projectSprintCompletion(sprint);

    // Check if sprint is at risk
    if (!sprintVelocity.onTrack) {
      this.generateSprintAlert(sprint, sprintVelocity);
    }

    this.emit('sprintProgressTracked', { sprint, velocity: sprintVelocity });
  }

  async trackQualityProgress(quality: {
    codeQuality?: number;
    testCoverage?: number;
    bugs?: BugTracker[];
    reviews?: ReviewQueue[];
  }): Promise<void> {
    if (quality.codeQuality !== undefined) {
      this.currentMetrics.quality.codeQuality.currentScore = quality.codeQuality;
      this.currentMetrics.quality.codeQuality.trend.push(quality.codeQuality);
    }

    if (quality.testCoverage !== undefined) {
      this.currentMetrics.quality.testCoverage.overall = quality.testCoverage;
      this.currentMetrics.quality.testCoverage.trend.push(quality.testCoverage);
    }

    if (quality.bugs) {
      this.updateBugMetrics(quality.bugs);
    }

    if (quality.reviews) {
      this.updateReviewMetrics(quality.reviews);
    }

    // Generate quality forecast
    this.currentMetrics.predictive.qualityForecast = await this.forecastQuality();

    this.emit('qualityProgressTracked', { quality: this.currentMetrics.quality });
  }

  // ========== Velocity Calculations ==========

  private calculateSprintVelocity(sprint: Sprint): SprintVelocity {
    const now = new Date();
    const sprintDuration = sprint.endDate.getTime() - sprint.startDate.getTime();
    const elapsed = now.getTime() - sprint.startDate.getTime();
    const remaining = sprint.endDate.getTime() - now.getTime();

    const plannedPoints = sprint.velocity;
    const completedPoints = this.calculateCompletedPoints(sprint);
    const remainingPoints = plannedPoints - completedPoints;

    const daysTotal = Math.ceil(sprintDuration / (24 * 60 * 60 * 1000));
    const daysElapsed = Math.ceil(elapsed / (24 * 60 * 60 * 1000));
    const daysRemaining = Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));

    const dailyVelocity = daysElapsed > 0 ? completedPoints / daysElapsed : 0;
    const requiredVelocity = daysRemaining > 0 ? remainingPoints / daysRemaining : 0;

    return {
      plannedPoints,
      completedPoints,
      remainingPoints,
      dailyVelocity,
      percentComplete: plannedPoints > 0 ? (completedPoints / plannedPoints) * 100 : 0,
      daysRemaining,
      onTrack: dailyVelocity >= requiredVelocity,
    };
  }

  private calculateFeatureVelocity(feature: FeatureProgress): number {
    const progressValues = Object.values(feature.progress);
    const totalProgress = progressValues.reduce((sum, p) => sum + p, 0);
    const averageProgress = totalProgress / progressValues.length;

    const daysSinceStart = Math.ceil(
      (Date.now() - feature.startDate.getTime()) / (24 * 60 * 60 * 1000),
    );

    return daysSinceStart > 0 ? averageProgress / daysSinceStart : 0;
  }

  private calculateVelocityTrend(): 'increasing' | 'stable' | 'decreasing' {
    const recentSnapshots = this.progressHistory.slice(-10);
    if (recentSnapshots.length < 3) {return 'stable';}

    const velocities = recentSnapshots.map((s) => s.metrics.velocity.currentSprint.dailyVelocity);
    const trend = this.calculateTrend(velocities);

    if (trend > 0.1) {return 'increasing';}
    if (trend < -0.1) {return 'decreasing';}
    return 'stable';
  }

  // ========== Productivity Analysis ==========

  private async updateTeamProductivity(): Promise<void> {
    const individuals = Array.from(this.currentMetrics.productivity.individual.values());

    this.currentMetrics.productivity.team = {
      totalTasks: individuals.reduce((sum, i) => sum + i.tasksCompleted + i.tasksInProgress, 0),
      completedTasks: individuals.reduce((sum, i) => sum + i.tasksCompleted, 0),
      averageTaskTime: this.calculateAverageTaskTime(individuals),
      parallelEfficiency: this.calculateParallelEfficiency(individuals),
      collaborationIndex: this.calculateCollaborationIndex(),
      knowledgeSharingScore: this.calculateKnowledgeSharingScore(),
    };

    // Identify productivity trends
    this.currentMetrics.productivity.trends = this.analyzeProductivityTrends();
  }

  private async analyzeBottlenecks(task: TaskProgress & { assignedTo: string }): Promise<void> {
    for (const blocker of task.blockers || []) {
      const bottleneck: Bottleneck = {
        type: blocker.type === 'dependency' ? 'dependency' : 'task',
        description: blocker.description,
        impact: this.mapSeverityToImpact(blocker.severity),
        affectedTasks: [task.taskId],
        affectedMembers: [task.assignedTo],
        suggestedActions: this.generateBottleneckActions(blocker),
        estimatedDelay: this.estimateDelay(blocker),
      };

      // Check if this bottleneck already exists
      const existingIndex = this.currentMetrics.productivity.bottlenecks.findIndex(
        (b) => b.description === bottleneck.description,
      );

      if (existingIndex >= 0) {
        // Update existing bottleneck
        const existing = this.currentMetrics.productivity.bottlenecks[existingIndex];
        existing.affectedTasks.push(...bottleneck.affectedTasks);
        existing.affectedMembers.push(...bottleneck.affectedMembers);
        existing.affectedTasks = [...new Set(existing.affectedTasks)];
        existing.affectedMembers = [...new Set(existing.affectedMembers)];
      } else {
        // Add new bottleneck
        this.currentMetrics.productivity.bottlenecks.push(bottleneck);
      }
    }
  }

  // ========== Predictive Analytics ==========

  private async updatePredictions(): Promise<void> {
    // Update completion predictions
    this.currentMetrics.predictive.completionPredictions =
      await this.generateCompletionPredictions();

    // Update risk assessment
    this.currentMetrics.predictive.riskAssessment = await this.assessRisks();

    // Update resource predictions
    this.currentMetrics.predictive.resourceNeeds = await this.predictResourceNeeds();
  }

  private async predictFeatureCompletion(feature: FeatureProgress): Promise<CompletionPrediction> {
    const velocity = this.calculateFeatureVelocity(feature);
    const remainingWork =
      100 -
      Object.values(feature.progress).reduce((sum, p) => sum + p, 0) /
        Object.keys(feature.progress).length;

    const daysToComplete = velocity > 0 ? remainingWork / velocity : 999;
    const predictedDate = new Date(Date.now() + daysToComplete * 24 * 60 * 60 * 1000);

    // Calculate confidence based on historical accuracy
    const confidence = this.calculatePredictionConfidence(feature);

    // Identify factors affecting completion
    const factors = this.identifyCompletionFactors(feature);

    return {
      itemType: 'feature',
      itemId: feature.featureId,
      predictedCompletion: predictedDate,
      confidence,
      factors,
    };
  }

  private async generateCompletionPredictions(): Promise<CompletionPrediction[]> {
    // This would use ML models in production
    return [];
  }

  private async assessRisks(): Promise<RiskAssessment[]> {
    const risks: RiskAssessment[] = [];

    // Assess deadline risks
    if (
      this.currentMetrics.velocity.currentSprint &&
      !this.currentMetrics.velocity.currentSprint.onTrack
    ) {
      risks.push({
        riskType: 'deadline',
        probability: 0.7,
        impact: 0.8,
        riskScore: 0.7 * 0.8,
        mitigation: ['Reduce sprint scope', 'Add additional resources', 'Extend sprint deadline'],
        earlyWarnings: ['Daily velocity below required rate', 'Multiple task blockers identified'],
      });
    }

    // Assess quality risks
    if (
      this.currentMetrics.quality.codeQuality.currentScore <
      this.currentMetrics.quality.codeQuality.targetScore * 0.8
    ) {
      risks.push({
        riskType: 'quality',
        probability: 0.6,
        impact: 0.7,
        riskScore: 0.6 * 0.7,
        mitigation: [
          'Increase code review coverage',
          'Add automated quality checks',
          'Allocate time for refactoring',
        ],
        earlyWarnings: ['Code quality score declining', 'Increasing technical debt'],
      });
    }

    return risks;
  }

  private async predictResourceNeeds(): Promise<ResourcePrediction[]> {
    const predictions: ResourcePrediction[] = [];

    // Analyze current workload distribution
    const workloadDistribution = this.analyzeWorkloadDistribution();

    for (const [resourceType, metrics] of workloadDistribution) {
      if (metrics.utilization > 0.8) {
        predictions.push({
          resourceType: resourceType as any,
          currentCapacity: metrics.capacity,
          requiredCapacity: metrics.required,
          gap: metrics.required - metrics.capacity,
          recommendation: `Add ${Math.ceil(metrics.required - metrics.capacity)} more ${resourceType}s`,
        });
      }
    }

    return predictions;
  }

  private async forecastQuality(): Promise<QualityForecast> {
    const trend = this.calculateTrend(this.currentMetrics.quality.codeQuality.trend);
    const currentScore = this.currentMetrics.quality.codeQuality.currentScore;

    // Simple linear projection
    const predictedScore = currentScore + trend * 7; // 7 days forecast

    return {
      predictedQualityScore: Math.max(0, Math.min(100, predictedScore)),
      confidenceInterval: [predictedScore - 5, predictedScore + 5],
      riskFactors: this.identifyQualityRiskFactors(),
      recommendations: this.generateQualityRecommendations(),
    };
  }

  // ========== Alert Generation ==========

  private generateSprintAlert(sprint: Sprint, velocity: SprintVelocity): void {
    const alert: ProgressAlert = {
      type: 'deadline',
      severity: velocity.daysRemaining < 3 ? 'critical' : 'warning',
      message: `Sprint ${sprint.name} is off track. Current velocity: ${velocity.dailyVelocity.toFixed(1)} points/day, Required: ${(velocity.remainingPoints / Math.max(1, velocity.daysRemaining)).toFixed(1)} points/day`,
      affectedItems: [sprint.id],
      suggestedAction: 'Consider reducing scope or adding resources',
    };

    this.emit('progressAlert', alert);
  }

  async generateInsights(): Promise<ProgressInsight[]> {
    const insights: ProgressInsight[] = [];

    // Velocity insights
    if (this.currentMetrics.velocity.trend === 'increasing') {
      insights.push({
        category: 'velocity',
        insight: 'Team velocity has been increasing over the last 10 sprints',
        confidence: 0.85,
        actionable: true,
        recommendations: ['Consider increasing sprint commitment', 'Document successful practices'],
      });
    }

    // Bottleneck insights
    if (this.currentMetrics.productivity.bottlenecks.length > 0) {
      const criticalBottlenecks = this.currentMetrics.productivity.bottlenecks.filter(
        (b) => b.impact === 'critical' || b.impact === 'high',
      );

      if (criticalBottlenecks.length > 0) {
        insights.push({
          category: 'bottlenecks',
          insight: `${criticalBottlenecks.length} critical bottlenecks are impacting productivity`,
          confidence: 0.9,
          actionable: true,
          recommendations: criticalBottlenecks.map((b) => b.suggestedActions[0]),
        });
      }
    }

    // Quality insights
    const qualityTrend = this.calculateTrend(this.currentMetrics.quality.codeQuality.trend);
    if (qualityTrend < -0.5) {
      insights.push({
        category: 'quality',
        insight: 'Code quality has been declining',
        confidence: 0.75,
        actionable: true,
        recommendations: [
          'Increase code review thoroughness',
          'Add automated quality gates',
          'Schedule refactoring sessions',
        ],
      });
    }

    return insights;
  }

  // ========== Utility Methods ==========

  private initializeMetrics(): ProgressMetrics {
    return {
      velocity: {
        currentSprint: this.createEmptySprintVelocity(),
        historicalAverage: 0,
        trend: 'stable',
        projectedCompletion: new Date(),
        burndownRate: 0,
        burnupRate: 0,
      },
      productivity: {
        individual: new Map(),
        team: this.createEmptyTeamProductivity(),
        trends: [],
        bottlenecks: [],
      },
      quality: {
        codeQuality: {
          currentScore: 0,
          targetScore: 80,
          trend: [],
          violations: [],
          improvements: [],
        },
        testCoverage: {
          overall: 0,
          unit: 0,
          integration: 0,
          e2e: 0,
          trend: [],
          uncoveredAreas: [],
        },
        bugMetrics: {
          openBugs: 0,
          resolvedBugs: 0,
          averageResolutionTime: 0,
          criticalBugs: 0,
          regressionRate: 0,
          escapeRate: 0,
        },
        reviewMetrics: {
          pendingReviews: 0,
          completedReviews: 0,
          averageReviewTime: 0,
          firstPassApprovalRate: 0,
          reviewerWorkload: new Map(),
        },
      },
      collaboration: {
        communicationFrequency: 0,
        knowledgeTransfer: 0,
        pairProgrammingHours: 0,
        crossTeamCollaboration: 0,
        mentorshipActivities: 0,
        teamSentiment: 0,
      },
      predictive: {
        completionPredictions: [],
        riskAssessment: [],
        resourceNeeds: [],
        qualityForecast: {
          predictedQualityScore: 0,
          confidenceInterval: [0, 0],
          riskFactors: [],
          recommendations: [],
        },
      },
    };
  }

  private createEmptySprintVelocity(): SprintVelocity {
    return {
      plannedPoints: 0,
      completedPoints: 0,
      remainingPoints: 0,
      dailyVelocity: 0,
      percentComplete: 0,
      daysRemaining: 0,
      onTrack: true,
    };
  }

  private createEmptyTeamProductivity(): TeamProductivity {
    return {
      totalTasks: 0,
      completedTasks: 0,
      averageTaskTime: 0,
      parallelEfficiency: 0,
      collaborationIndex: 0,
      knowledgeSharingScore: 0,
    };
  }

  private createIndividualProductivity(memberId: string): IndividualProductivity {
    return {
      memberId,
      tasksCompleted: 0,
      tasksInProgress: 0,
      averageCompletionTime: 0,
      focusTime: 0,
      contextSwitches: 0,
      efficiency: 0,
      contributionScore: 0,
    };
  }

  private updateAverage(currentAvg: number, newValue: number, count: number): number {
    return (currentAvg * (count - 1) + newValue) / count;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) {return 0;}

    // Simple linear regression
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, v) => sum + v, 0);
    const sumXY = values.reduce((sum, v, i) => sum + i * v, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  private calculateCompletedPoints(sprint: Sprint): number {
    // Simplified calculation
    return sprint.velocity * 0.6; // Placeholder
  }

  private calculateAverageTaskTime(individuals: IndividualProductivity[]): number {
    const times = individuals.map((i) => i.averageCompletionTime).filter((t) => t > 0);
    return times.length > 0 ? times.reduce((sum, t) => sum + t, 0) / times.length : 0;
  }

  private calculateParallelEfficiency(individuals: IndividualProductivity[]): number {
    // Simplified calculation
    return 0.75; // Placeholder
  }

  private calculateCollaborationIndex(): number {
    return (
      this.currentMetrics.collaboration.communicationFrequency * 0.3 +
      this.currentMetrics.collaboration.knowledgeTransfer * 0.3 +
      this.currentMetrics.collaboration.crossTeamCollaboration * 0.4
    );
  }

  private calculateKnowledgeSharingScore(): number {
    return 0.7; // Placeholder
  }

  private analyzeProductivityTrends(): ProductivityTrend[] {
    // Simplified implementation
    return [];
  }

  private mapSeverityToImpact(
    severity: 'minor' | 'major' | 'critical',
  ): 'low' | 'medium' | 'high' | 'critical' {
    switch (severity) {
      case 'minor':
        return 'low';
      case 'major':
        return 'high';
      case 'critical':
        return 'critical';
      default:
        return 'medium';
    }
  }

  private generateBottleneckActions(blocker: unknown): string[] {
    return ['Escalate to team lead', 'Find alternative approach', 'Request additional resources'];
  }

  private estimateDelay(blocker: unknown): number {
    // Hours of delay
    switch (blocker.severity) {
      case 'critical':
        return 24;
      case 'major':
        return 8;
      case 'minor':
        return 2;
      default:
        return 4;
    }
  }

  private projectSprintCompletion(sprint: Sprint): Date {
    const velocity = this.currentMetrics.velocity.currentSprint;
    if (velocity.dailyVelocity === 0) {return sprint.endDate;}

    const daysNeeded = velocity.remainingPoints / velocity.dailyVelocity;
    return new Date(Date.now() + daysNeeded * 24 * 60 * 60 * 1000);
  }

  private updateBugMetrics(bugs: BugTracker[]): void {
    this.currentMetrics.quality.bugMetrics.openBugs = bugs.filter(
      (b) => b.status === 'open' || b.status === 'in-progress',
    ).length;

    this.currentMetrics.quality.bugMetrics.resolvedBugs = bugs.filter(
      (b) => b.status === 'resolved' || b.status === 'closed',
    ).length;

    this.currentMetrics.quality.bugMetrics.criticalBugs = bugs.filter(
      (b) => b.severity === 'critical' || b.severity === 'blocker',
    ).length;

    // Calculate average resolution time
    const resolvedWithTime = bugs.filter((b) => b.resolvedAt && b.reportedAt);
    if (resolvedWithTime.length > 0) {
      const totalTime = resolvedWithTime.reduce((sum, b) => {
        return sum + (b.resolvedAt!.getTime() - b.reportedAt.getTime());
      }, 0);
      this.currentMetrics.quality.bugMetrics.averageResolutionTime =
        totalTime / resolvedWithTime.length / (60 * 60 * 1000); // Convert to hours
    }
  }

  private updateReviewMetrics(reviews: ReviewQueue[]): void {
    this.currentMetrics.quality.reviewMetrics.pendingReviews = reviews.filter(
      (r) => r.status === 'pending' || r.status === 'in-progress',
    ).length;

    this.currentMetrics.quality.reviewMetrics.completedReviews = reviews.filter(
      (r) => r.status === 'approved',
    ).length;

    // Calculate average review time
    const completedWithTime = reviews.filter((r) => r.completedAt && r.submittedAt);
    if (completedWithTime.length > 0) {
      const totalTime = completedWithTime.reduce((sum, r) => {
        return sum + (r.completedAt!.getTime() - r.submittedAt.getTime());
      }, 0);
      this.currentMetrics.quality.reviewMetrics.averageReviewTime =
        totalTime / completedWithTime.length / (60 * 60 * 1000); // Convert to hours
    }

    // Calculate first-pass approval rate
    const approved = reviews.filter((r) => r.status === 'approved');
    const changesRequested = reviews.filter((r) => r.status === 'changes-requested');
    const total = approved.length + changesRequested.length;

    if (total > 0) {
      this.currentMetrics.quality.reviewMetrics.firstPassApprovalRate = approved.length / total;
    }

    // Update reviewer workload
    this.currentMetrics.quality.reviewMetrics.reviewerWorkload.clear();
    for (const review of reviews) {
      for (const reviewer of review.reviewers) {
        const current =
          this.currentMetrics.quality.reviewMetrics.reviewerWorkload.get(reviewer.reviewerId) || 0;
        this.currentMetrics.quality.reviewMetrics.reviewerWorkload.set(
          reviewer.reviewerId,
          current + 1,
        );
      }
    }
  }

  private calculatePredictionConfidence(feature: FeatureProgress): number {
    // Simplified confidence calculation
    const progressVariance = this.calculateProgressVariance(feature);
    const daysSinceStart = Math.ceil(
      (Date.now() - feature.startDate.getTime()) / (24 * 60 * 60 * 1000),
    );

    // Higher confidence with more data and less variance
    const dataFactor = Math.min(1, daysSinceStart / 30);
    const varianceFactor = Math.max(0, 1 - progressVariance);

    return dataFactor * varianceFactor;
  }

  private calculateProgressVariance(feature: FeatureProgress): number {
    const progressValues = Object.values(feature.progress);
    const mean = progressValues.reduce((sum, p) => sum + p, 0) / progressValues.length;
    const variance =
      progressValues.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / progressValues.length;
    return Math.sqrt(variance) / 100; // Normalize to 0-1
  }

  private identifyCompletionFactors(feature: FeatureProgress): Array<{
    name: string;
    impact: 'positive' | 'negative';
    weight: number;
  }> {
    const factors: Array<{ name: string; impact: 'positive' | 'negative'; weight: number }> = [];

    // Check blockers
    if (feature.blockers && feature.blockers.length > 0) {
      factors.push({
        name: `${feature.blockers.length} blockers`,
        impact: 'negative',
        weight: 0.3,
      });
    }

    // Check dependencies
    if (feature.dependencies && feature.dependencies.length > 0) {
      factors.push({
        name: `${feature.dependencies.length} dependencies`,
        impact: 'negative',
        weight: 0.2,
      });
    }

    // Check team size
    if (feature.contributors && feature.contributors.length > 2) {
      factors.push({
        name: 'Large team collaboration',
        impact: 'positive',
        weight: 0.15,
      });
    }

    return factors;
  }

  private analyzeWorkloadDistribution(): Map<
    string,
    { capacity: number; required: number; utilization: number }
  > {
    // Simplified workload analysis
    return new Map([
      ['developer', { capacity: 10, required: 12, utilization: 1.2 }],
      ['reviewer', { capacity: 5, required: 4, utilization: 0.8 }],
    ]);
  }

  private identifyQualityRiskFactors(): string[] {
    const factors: string[] = [];

    if (this.currentMetrics.quality.testCoverage.overall < 70) {
      factors.push('Low test coverage');
    }

    if (this.currentMetrics.quality.bugMetrics.regressionRate > 0.1) {
      factors.push('High regression rate');
    }

    if (this.currentMetrics.quality.reviewMetrics.firstPassApprovalRate < 0.5) {
      factors.push('Low first-pass approval rate');
    }

    return factors;
  }

  private generateQualityRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.currentMetrics.quality.codeQuality.currentScore < 70) {
      recommendations.push('Schedule code quality improvement sprint');
    }

    if (this.currentMetrics.quality.testCoverage.overall < 80) {
      recommendations.push('Increase test coverage to 80%');
    }

    if (this.currentMetrics.quality.bugMetrics.criticalBugs > 0) {
      recommendations.push('Prioritize critical bug fixes');
    }

    return recommendations;
  }

  private startTracking(): void {
    this.updateInterval = setInterval(async () => {
      const snapshot: ProgressSnapshot = {
        timestamp: new Date(),
        metrics: { ...this.currentMetrics },
        alerts: [],
        insights: await this.generateInsights(),
      };

      this.progressHistory.push(snapshot);

      // Keep only last 100 snapshots
      if (this.progressHistory.length > 100) {
        this.progressHistory.shift();
      }

      this.emit('progressSnapshot', snapshot);
    }, 60000); // Every minute
  }

  // ========== Public API ==========

  getMetrics(): ProgressMetrics {
    return { ...this.currentMetrics };
  }

  getHistory(): ProgressSnapshot[] {
    return [...this.progressHistory];
  }

  async getSnapshot(): Promise<ProgressSnapshot> {
    return {
      timestamp: new Date(),
      metrics: { ...this.currentMetrics },
      alerts: [],
      insights: await this.generateInsights(),
    };
  }

  dispose(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.removeAllListeners();
  }
}

// ========== Analytics Engine ==========

class AnalyticsEngine {
  analyzePattern(data: number[]): { pattern: string; confidence: number } {
    // Simplified pattern analysis
    return { pattern: 'steady', confidence: 0.7 };
  }

  predictTrend(historical: number[], horizon: number): number[] {
    // Simplified trend prediction
    const lastValue = historical[historical.length - 1] || 0;
    return Array(horizon).fill(lastValue);
  }

  detectAnomalies(data: number[]): Array<{ index: number; value: number; severity: number }> {
    if (data.length < 3) {return [];}

    const anomalies: Array<{ index: number; value: number; severity: number }> = [];
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);

    // Z-score based anomaly detection
    data.forEach((value, index) => {
      const zScore = Math.abs((value - mean) / stdDev);

      if (zScore > 2.5) {
        // 2.5 standard deviations threshold
        const severity = Math.min(zScore / 4, 1); // Cap severity at 1
        anomalies.push({ index, value, severity });
      }
    });

    // Additional statistical tests
    const iqr = this.calculateIQR(data);
    const q1 = this.calculatePercentile(data, 25);
    const q3 = this.calculatePercentile(data, 75);
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    data.forEach((value, index) => {
      if (value < lowerBound || value > upperBound) {
        const existingAnomaly = anomalies.find((a) => a.index === index);
        if (!existingAnomaly) {
          const severity =
            value < lowerBound
              ? Math.min((lowerBound - value) / (mean - lowerBound), 1)
              : Math.min((value - upperBound) / (upperBound - mean), 1);
          anomalies.push({ index, value, severity });
        }
      }
    });

    return anomalies.sort((a, b) => b.severity - a.severity);
  }

  private calculateIQR(data: number[]): number {
    const sorted = [...data].sort((a, b) => a - b);
    const q1 = this.calculatePercentile(sorted, 25);
    const q3 = this.calculatePercentile(sorted, 75);
    return q3 - q1;
  }

  private calculatePercentile(sortedData: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedData.length - 1);
    if (Number.isInteger(index)) {
      return sortedData[index];
    } else {
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      const weight = index - lower;
      return sortedData[lower] * (1 - weight) + sortedData[upper] * weight;
    }
  }

  /**
   * Advanced pattern recognition for team collaboration cycles
   */
  identifyCollaborationPatterns(teamData: TeamCollaborationData[]): CollaborationPattern[] {
    const patterns: CollaborationPattern[] = [];

    // Identify recurring meeting patterns
    const meetingPatterns = this.analyzeMeetingPatterns(teamData);
    patterns.push(...meetingPatterns);

    // Identify communication frequency patterns
    const communicationPatterns = this.analyzeCommunicationPatterns(teamData);
    patterns.push(...communicationPatterns);

    // Identify productivity cycles
    const productivityPatterns = this.analyzeProductivityCycles(teamData);
    patterns.push(...productivityPatterns);

    return patterns;
  }

  private analyzeMeetingPatterns(teamData: TeamCollaborationData[]): CollaborationPattern[] {
    const patterns: CollaborationPattern[] = [];

    // Group meetings by day of week
    const meetingsByDay: Record<string, number[]> = {};
    teamData.forEach((data) => {
      const dayOfWeek = new Date(data.timestamp).toLocaleDateString('en-US', { weekday: 'long' });
      if (!meetingsByDay[dayOfWeek]) {meetingsByDay[dayOfWeek] = [];}
      meetingsByDay[dayOfWeek].push(data.meetingsCount);
    });

    Object.entries(meetingsByDay).forEach(([day, counts]) => {
      if (counts.length >= 4) {
        // Need at least 4 data points
        const average = counts.reduce((sum, count) => sum + count, 0) / counts.length;
        const variance =
          counts.reduce((sum, count) => sum + Math.pow(count - average, 2), 0) / counts.length;

        if (variance < average * 0.2) {
          // Low variance indicates a pattern
          patterns.push({
            type: 'meeting_frequency',
            description: `Regular ${average.toFixed(1)} meetings on ${day}s`,
            confidence: 1 - variance / average,
            frequency: 'weekly',
            participants: [], // Would be filled with actual participant data
            effectiveness: average > 2 ? 0.8 : 0.6,
            duration: 60, // Default meeting duration
            outcomes: [],
          });
        }
      }
    });

    return patterns;
  }

  private analyzeCommunicationPatterns(teamData: TeamCollaborationData[]): CollaborationPattern[] {
    const patterns: CollaborationPattern[] = [];

    // Analyze message volume patterns
    const messageVolumes = teamData.map((data) => data.messageVolume);
    const hourlyPatterns: Record<number, number[]> = {};

    teamData.forEach((data) => {
      const hour = new Date(data.timestamp).getHours();
      if (!hourlyPatterns[hour]) {hourlyPatterns[hour] = [];}
      hourlyPatterns[hour].push(data.messageVolume);
    });

    // Find peak communication hours
    const peakHours = Object.entries(hourlyPatterns)
      .map(([hour, volumes]) => ({
        hour: parseInt(hour),
        average: volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length,
        consistency:
          1 -
          this.calculateStandardDeviation(volumes) /
            Math.max(1, volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length),
      }))
      .filter((data) => data.consistency > 0.7 && data.average > 5)
      .sort((a, b) => b.average - a.average)
      .slice(0, 3);

    peakHours.forEach(({ hour, average, consistency }) => {
      patterns.push({
        type: 'communication_peak',
        description: `High communication activity at ${hour}:00 (avg: ${average.toFixed(1)} messages)`,
        confidence: consistency,
        frequency: 'daily',
        participants: [],
        effectiveness: 0.7,
        duration: 60,
        outcomes: [],
      });
    });

    return patterns;
  }

  private analyzeProductivityCycles(teamData: TeamCollaborationData[]): CollaborationPattern[] {
    const patterns: CollaborationPattern[] = [];

    // Analyze task completion patterns
    const completionRates = teamData.map(
      (data) => data.tasksCompleted / Math.max(1, data.tasksAssigned),
    );
    const weeklyAverages: Record<number, number[]> = {};

    teamData.forEach((data, index) => {
      const weekNumber = Math.floor(index / 7);
      if (!weeklyAverages[weekNumber]) {weeklyAverages[weekNumber] = [];}
      weeklyAverages[weekNumber].push(completionRates[index]);
    });

    const weeklyPerformance = Object.values(weeklyAverages)
      .map((rates) => rates.reduce((sum, rate) => sum + rate, 0) / rates.length)
      .filter((avg) => !isNaN(avg));

    if (weeklyPerformance.length >= 3) {
      const trend = this.calculateTrend(weeklyPerformance);
      const volatility = this.calculateStandardDeviation(weeklyPerformance);

      if (Math.abs(trend) > 0.05) {
        // Significant trend
        patterns.push({
          type: 'productivity_trend',
          description: trend > 0 ? 'Improving productivity trend' : 'Declining productivity trend',
          confidence: Math.min(Math.abs(trend) * 10, 1),
          frequency: 'weekly',
          participants: [],
          effectiveness: trend > 0 ? 0.8 : 0.4,
          duration: 7 * 24 * 60, // One week in minutes
          outcomes: [],
        });
      }

      if (volatility < 0.1) {
        // Stable performance
        patterns.push({
          type: 'stable_productivity',
          description: `Consistent productivity (±${(volatility * 100).toFixed(1)}%)`,
          confidence: 1 - volatility,
          frequency: 'ongoing',
          participants: [],
          effectiveness: 0.7,
          duration: 0,
          outcomes: [],
        });
      }
    }

    return patterns;
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) {return 0;}

    const n = values.length;
    const sumX = (n * (n - 1)) / 2; // Sum of indices 0, 1, 2, ...
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, index) => sum + index * val, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6; // Sum of squares of indices

    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  /**
   * Generate comprehensive team health metrics
   */
  calculateTeamHealthScore(teamData: TeamCollaborationData[]): TeamHealthMetrics {
    const recentData = teamData.slice(-7); // Last 7 data points

    if (recentData.length === 0) {
      return {
        overallScore: 0,
        communicationScore: 0,
        productivityScore: 0,
        collaborationScore: 0,
        wellnessScore: 0,
        recommendations: ['Insufficient data for analysis'],
      };
    }

    const communicationScore = this.calculateCommunicationHealth(recentData);
    const productivityScore = this.calculateProductivityHealth(recentData);
    const collaborationScore = this.calculateCollaborationHealth(recentData);
    const wellnessScore = this.calculateWellnessHealth(recentData);

    const overallScore =
      (communicationScore + productivityScore + collaborationScore + wellnessScore) / 4;

    return {
      overallScore,
      communicationScore,
      productivityScore,
      collaborationScore,
      wellnessScore,
      recommendations: this.generateHealthRecommendations({
        overallScore,
        communicationScore,
        productivityScore,
        collaborationScore,
        wellnessScore,
      }),
    };
  }

  private calculateCommunicationHealth(data: TeamCollaborationData[]): number {
    const avgMessageVolume = data.reduce((sum, d) => sum + d.messageVolume, 0) / data.length;
    const avgResponseTime =
      data.reduce((sum, d) => sum + (d.averageResponseTime || 0), 0) / data.length;

    // Normalize scores (assuming ideal ranges)
    const volumeScore = Math.min(avgMessageVolume / 20, 1); // Ideal: 20 messages/day
    const responseScore = Math.max(0, 1 - avgResponseTime / 480); // Ideal: <8 hours (480 min)

    return (volumeScore + responseScore) / 2;
  }

  private calculateProductivityHealth(data: TeamCollaborationData[]): number {
    const completionRates = data.map((d) => d.tasksCompleted / Math.max(1, d.tasksAssigned));
    const avgCompletionRate =
      completionRates.reduce((sum, rate) => sum + rate, 0) / completionRates.length;
    const consistency = 1 - this.calculateStandardDeviation(completionRates);

    return (avgCompletionRate + consistency) / 2;
  }

  private calculateCollaborationHealth(data: TeamCollaborationData[]): number {
    const avgMeetings = data.reduce((sum, d) => sum + d.meetingsCount, 0) / data.length;
    const avgCollaboration =
      data.reduce((sum, d) => sum + (d.collaborationScore || 0), 0) / data.length;

    // Normalize meeting frequency (ideal: 2-4 meetings per week)
    const meetingScore =
      avgMeetings >= 2 && avgMeetings <= 4 ? 1 : Math.max(0, 1 - Math.abs(avgMeetings - 3) / 3);

    return (meetingScore + avgCollaboration) / 2;
  }

  private calculateWellnessHealth(data: TeamCollaborationData[]): number {
    const avgWellness = data.reduce((sum, d) => sum + (d.wellnessScore || 0.7), 0) / data.length;
    const workloadBalance =
      data.reduce((sum, d) => sum + (d.workloadBalance || 0.7), 0) / data.length;

    return (avgWellness + workloadBalance) / 2;
  }

  private generateHealthRecommendations(
    scores: Omit<TeamHealthMetrics, 'recommendations'>,
  ): string[] {
    const recommendations: string[] = [];

    if (scores.communicationScore < 0.6) {
      recommendations.push('Improve team communication frequency and response times');
    }

    if (scores.productivityScore < 0.6) {
      recommendations.push('Review task allocation and completion processes');
    }

    if (scores.collaborationScore < 0.6) {
      recommendations.push('Enhance collaborative practices and meeting effectiveness');
    }

    if (scores.wellnessScore < 0.6) {
      recommendations.push('Focus on team wellness and workload balance');
    }

    if (scores.overallScore > 0.8) {
      recommendations.push('Excellent team health - maintain current practices');
    } else if (scores.overallScore > 0.6) {
      recommendations.push('Good team health with room for improvement');
    } else {
      recommendations.push('Team health needs immediate attention');
    }

    return recommendations;
  }
}

// Additional interfaces for enhanced functionality
interface TeamCollaborationData {
  timestamp: Date;
  messageVolume: number;
  meetingsCount: number;
  tasksAssigned: number;
  tasksCompleted: number;
  averageResponseTime?: number; // minutes
  collaborationScore?: number; // 0-1
  wellnessScore?: number; // 0-1
  workloadBalance?: number; // 0-1
}

interface CollaborationPattern {
  type: string;
  description: string;
  confidence: number; // 0-1
  frequency: string;
  participants: string[];
  effectiveness: number; // 0-1
  duration: number; // minutes
  outcomes: string[];
}

interface TeamHealthMetrics {
  overallScore: number; // 0-1
  communicationScore: number; // 0-1
  productivityScore: number; // 0-1
  collaborationScore: number; // 0-1
  wellnessScore: number; // 0-1
  recommendations: string[];
}

export default TeamProgressTracker;
