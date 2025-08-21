/**
 * Collaborative Planner - User-AI collaborative planning
 * Implements interactive planning and modification workflows
 */
import { EventEmitter } from 'events';
import chalk from 'chalk';
import {
  SOW,
  Task,
  CollaborativePlan,
  DecisionPoint,
  PlanModification,
  UserFeedback,
} from './types';

export class CollaborativePlanner extends EventEmitter {
  private activePlans: Map<string, CollaborativePlan>;
  private pendingDecisions: Map<string, DecisionPoint>;
  private planHistory: CollaborativePlan[];

  constructor() {
    super();
    this.activePlans = new Map();
    this.pendingDecisions = new Map();
    this.planHistory = [];
  }

  /**
   * Initialize the collaborative planner
   */
  public async initialize(): Promise<void> {
    console.log(chalk.cyan('✓ Collaborative Planner initialized'));
  }

  /**
   * Create a collaborative plan from SOW
   */
  public async createPlan(sow: SOW): Promise<CollaborativePlan> {
    const plan: CollaborativePlan = {
      id: `plan_${Date.now()}`,
      title: sow.title,
      sowId: sow.id,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
      tasks: [...sow.tasks],
      modifications: [],
      userFeedback: [],
      approvalStatus: 'pending',
    };

    this.activePlans.set(plan.id, plan);
    this.emit('plan:created', plan);

    return plan;
  }

  /**
   * Propose plan modifications
   */
  public async proposePlanModification(
    planId: string,
    modification: Omit<PlanModification, 'id' | 'timestamp'>,
  ): Promise<PlanModification> {
    const plan = this.activePlans.get(planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found`);
    }

    const mod: PlanModification = {
      id: `mod_${Date.now()}`,
      timestamp: new Date(),
      ...modification,
    };

    plan.modifications.push(mod);
    plan.updatedAt = new Date();
    plan.status = 'modified';

    this.emit('plan:modified', plan, mod);

    return mod;
  }

  /**
   * Get user feedback on plan
   */
  public async getUserFeedback(planId: string, question: string): Promise<UserFeedback> {
    const feedback: UserFeedback = {
      id: `feedback_${Date.now()}`,
      planId,
      question,
      timestamp: new Date(),
      response: 'pending',
    };

    // In a real implementation, this would wait for user input
    // For now, simulate user approval
    feedback.response = 'approved';
    feedback.comments = 'Plan looks good to proceed';

    const plan = this.activePlans.get(planId);
    if (plan) {
      plan.userFeedback.push(feedback);
    }

    this.emit('feedback:received', feedback);

    return feedback;
  }

  /**
   * Apply modifications to plan
   */
  public async applyModifications(planId: string): Promise<CollaborativePlan> {
    const plan = this.activePlans.get(planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found`);
    }

    // Apply all pending modifications
    for (const mod of plan.modifications) {
      if (mod.type === 'task_addition') {
        plan.tasks.push(mod.newValue as Task);
      } else if (mod.type === 'task_removal') {
        plan.tasks = plan.tasks.filter((t) => t.id !== mod.taskId);
      } else if (mod.type === 'task_modification' && mod.taskId) {
        const taskIndex = plan.tasks.findIndex((t) => t.id === mod.taskId);
        if (taskIndex >= 0) {
          plan.tasks[taskIndex] = { ...plan.tasks[taskIndex], ...mod.newValue };
        }
      }
    }

    plan.status = 'approved';
    plan.approvalStatus = 'approved';
    plan.updatedAt = new Date();

    this.emit('plan:applied', plan);

    return plan;
  }

  /**
   * Get active plans
   */
  public getActivePlans(): CollaborativePlan[] {
    return Array.from(this.activePlans.values());
  }

  /**
   * Get plan by ID
   */
  public getPlan(planId: string): CollaborativePlan | undefined {
    return this.activePlans.get(planId);
  }

  /**
   * Dispose the planner
   */
  public async dispose(): Promise<void> {
    this.activePlans.clear();
    this.pendingDecisions.clear();
    this.removeAllListeners();
  }
}
