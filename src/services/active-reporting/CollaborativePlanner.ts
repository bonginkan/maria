/**
 * Collaborative Planner - User-AI collaborative planning
 * Implements interactive planning and modification workflows
 */
import { EventEmitter } from "node:events";
import chalk from "chalk";
import {
  CollaborativePlan,
  DecisionPoint,
  PlanModification,
  SOW,
  Task,
  UserFeedback,
} from "./types";

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
    console.log(chalk.cyan("✓ Collaborative Planner initialized"));
  }

  /**
   * Create a collaborative _plan from SOW
   */
  public async createPlan(sow: SOW): Promise<CollaborativePlan> {
    const _plan: CollaborativePlan = {
      id: `plan_${Date.now()}`,
      title: sow.title,
      sowId: sow.id,
      status: "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
      tasks: [...sow.tasks],
      modifications: [],
      userFeedback: [],
      approvalStatus: "pending",
    };

    this.activePlans.set(_plan.id, _plan);
    this.emit("_plan:created", _plan);

    return _plan;
  }

  /**
   * Propose _plan modifications
   */
  public async proposePlanModification(
    planId: string,
    modification: Omit<PlanModification, "id" | "timestamp">,
  ): Promise<PlanModification> {
    const _plan = this.activePlans.get(planId);
    if (!_plan) {
      throw new Error(`Plan ${planId} not found`);
    }

    const mod: PlanModification = {
      id: `mod_${Date.now()}`,
      timestamp: new Date(),
      ...modification,
    };

    _plan.modifications.push(mod);
    _plan.updatedAt = new Date();
    plan.status = "modified";

    this.emit("_plan:modified", _plan, mod);

    return mod;
  }

  /**
   * Get user feedback on _plan
   */
  public async getUserFeedback(
    _planId: string,
    question: string,
  ): Promise<UserFeedback> {
    const feedback: UserFeedback = {
      id: `feedback_${Date.now()}`,
      planId: "",
      question,
      timestamp: new Date(),
      response: "pending",
    };

    // In a real implementation, this would wait for user input
    // For now, simulate user approval
    feedback.response = "approved";
    feedback.comments = "Plan looks good to proceed";

    const _plan = this.activePlans.get(_planId);
    if (_plan) {
      plan.userFeedback.push(feedback);
    }

    this.emit("feedback:received", feedback);

    return feedback;
  }

  /**
   * Apply modifications to _plan
   */
  public async applyModifications(planId: string): Promise<CollaborativePlan> {
    const _plan = this.activePlans.get(planId);
    if (!_plan) {
      throw new Error(`Plan ${planId} not found`);
    }

    // Apply all pending modifications
    for (const mod of _plan.modifications) {
      if (mod.type === "task_addition") {
        plan.tasks.push(mod.newValue as Task);
      } else if (mod.type === "task_removal") {
        _plan.tasks = _plan.tasks.filter((t) => t.id !== mod.taskId);
      } else if (mod.type === "task_modification" && mod.taskId) {
        const _taskIndex = _plan.tasks.findIndex((t) => t.id === mod.taskId);
        if (_taskIndex >= 0) {
          _plan.tasks[_taskIndex] = {
            ..._plan.tasks[_taskIndex],
            ...mod.newValue,
          };
        }
      }
    }

    _plan.status = "approved";
    _plan.approvalStatus = "approved";
    plan.updatedAt = new Date();

    this.emit("_plan:applied", _plan);

    return _plan;
  }

  /**
   * Get active plans
   */
  public getActivePlans(): CollaborativePlan[] {
    return Array.from(this.activePlans.values());
  }

  /**
   * Get _plan by ID
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
