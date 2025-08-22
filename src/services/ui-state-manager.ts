import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

export interface UIState {
  sessionId: string;
  isOutputExpanded: boolean;
  currentTask?: BackgroundTask;
  backgroundTasks: BackgroundTask[];
  theme: 'light' | 'dark';
  lastActivity: number;
}

export interface BackgroundTask {
  id: string;
  command: string;
  args: string[];
  status: 'running' | 'completed' | 'error' | 'paused';
  progress: number;
  startTime: number;
  estimatedEndTime?: number;
  result?: unknown;
  error?: string;
  sessionId?: string;
}

export interface UIStateUpdate {
  sessionId: string;
  field: keyof UIState;
  value: unknown;
}

export class UIStateManager extends EventEmitter {
  private static instance: UIStateManager;
  private sessions = new Map<string, UIState>();
  private currentSessionId: string = 'default';

  static getInstance(): UIStateManager {
    if (!UIStateManager.instance) {
      UIStateManager.instance = new UIStateManager();
    }
    return UIStateManager.instance;
  }

  private constructor() {
    super();
    this.initializeDefaultSession();
  }

  /**
   * Initialize default session
   */
  private initializeDefaultSession(): void {
    this.sessions.set(this.currentSessionId, {
      sessionId: this.currentSessionId,
      isOutputExpanded: false,
      backgroundTasks: [],
      theme: 'dark',
      lastActivity: Date.now(),
    });
  }

  /**
   * Get current session state
   */
  getCurrentSession(): UIState {
    return this.getSession(this.currentSessionId);
  }

  /**
   * Get session state by ID
   */
  getSession(sessionId: string): UIState {
    if (!this.sessions.has(sessionId)) {
      this.createSession(sessionId);
    }
    return this.sessions.get(sessionId)!;
  }

  /**
   * Create new session
   */
  createSession(sessionId: string): UIState {
    const state: UIState = {
      sessionId,
      isOutputExpanded: false,
      backgroundTasks: [],
      theme: 'dark',
      lastActivity: Date.now(),
    };

    this.sessions.set(sessionId, state);
    this.emit('sessionCreated', { sessionId, state });

    logger.info(`Created new UI session: ${sessionId}`);
    return state;
  }

  /**
   * Switch to different session
   */
  switchSession(sessionId: string): UIState {
    const previousSessionId = this.currentSessionId;
    this.currentSessionId = sessionId;

    if (!this.sessions.has(sessionId)) {
      this.createSession(sessionId);
    }

    const state = this.getSession(sessionId);
    this.emit('sessionSwitched', {
      previousSessionId,
      currentSessionId: sessionId,
      state,
    });

    logger.info(`Switched UI session from ${previousSessionId} to ${sessionId}`);
    return state;
  }

  /**
   * Update session state
   */
  updateSession(sessionId: string, updates: Partial<UIState>): UIState {
    const state = this.getSession(sessionId);

    // Apply updates
    Object.assign(state, updates, {
      lastActivity: Date.now(),
    });

    this.sessions.set(sessionId, state);

    // Emit update event for each field changed
    Object.keys(updates).forEach((field) => {
      this.emit('stateUpdated', {
        sessionId,
        field: field as keyof UIState,
        value: (updates as Record<string, unknown>)[field],
        fullState: state,
      });
    });

    return state;
  }

  /**
   * Toggle output expansion for session
   */
  toggleOutputExpansion(sessionId: string): boolean {
    const state = this.getSession(sessionId);
    const newExpanded = !state.isOutputExpanded;

    this.updateSession(sessionId, { isOutputExpanded: newExpanded });

    logger.info(`Output expansion toggled for ${sessionId}: ${newExpanded}`);
    return newExpanded;
  }

  /**
   * Add background task
   */
  addBackgroundTask(
    sessionId: string,
    task: Omit<BackgroundTask, 'id' | 'startTime'>,
  ): BackgroundTask {
    const state = this.getSession(sessionId);
    const fullTask: BackgroundTask = {
      ...task,
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startTime: Date.now(),
    };

    state.backgroundTasks.push(fullTask);
    this.updateSession(sessionId, { backgroundTasks: [...state.backgroundTasks] });

    this.emit('backgroundTaskAdded', { sessionId, task: fullTask });
    logger.info(`Added background task ${fullTask.id} to session ${sessionId}`);

    return fullTask;
  }

  /**
   * Update background task
   */
  updateBackgroundTask(
    sessionId: string,
    taskId: string,
    updates: Partial<BackgroundTask>,
  ): BackgroundTask | null {
    const state = this.getSession(sessionId);
    const taskIndex = state.backgroundTasks.findIndex((t) => t.id === taskId);

    if (taskIndex === -1) {
      logger.warn(`Background task ${taskId} not found in session ${sessionId}`);
      return null;
    }

    // Update task
    const currentTask = state.backgroundTasks[taskIndex];
    if (currentTask) {
      Object.assign(currentTask, updates);
      this.updateSession(sessionId, { backgroundTasks: [...state.backgroundTasks] });

      this.emit('backgroundTaskUpdated', { sessionId, task: currentTask });
      return currentTask;
    }

    return null;
  }

  /**
   * Remove background task
   */
  removeBackgroundTask(sessionId: string, taskId: string): boolean {
    const state = this.getSession(sessionId);
    const taskIndex = state.backgroundTasks.findIndex((t) => t.id === taskId);

    if (taskIndex === -1) {
      return false;
    }

    const removedTask = state.backgroundTasks.splice(taskIndex, 1)[0];
    this.updateSession(sessionId, { backgroundTasks: [...state.backgroundTasks] });

    this.emit('backgroundTaskRemoved', { sessionId, task: removedTask });
    logger.info(`Removed background task ${taskId} from session ${sessionId}`);

    return true;
  }

  /**
   * Get background tasks for session
   */
  getBackgroundTasks(sessionId: string): BackgroundTask[] {
    return this.getSession(sessionId).backgroundTasks;
  }

  /**
   * Get running background tasks for session
   */
  getRunningBackgroundTasks(sessionId: string): BackgroundTask[] {
    return this.getBackgroundTasks(sessionId).filter((t) => t.status === 'running');
  }

  /**
   * Set current task for session
   */
  setCurrentTask(sessionId: string, task: BackgroundTask | undefined): void {
    this.updateSession(sessionId, { currentTask: task });
    this.emit('currentTaskChanged', { sessionId, task });
  }

  /**
   * Get current task for session
   */
  getCurrentTask(sessionId: string): BackgroundTask | undefined {
    return this.getSession(sessionId).currentTask;
  }

  /**
   * Clean up old sessions (remove inactive sessions older than 24 hours)
   */
  cleanupOldSessions(): number {
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
    let cleanedCount = 0;

    for (const [sessionId, state] of this.sessions.entries()) {
      if (state.lastActivity < cutoffTime && sessionId !== this.currentSessionId) {
        this.sessions.delete(sessionId);
        cleanedCount++;
        this.emit('sessionCleaned', { sessionId, state });
        logger.info(`Cleaned up old UI session: ${sessionId}`);
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} old UI sessions`);
    }

    return cleanedCount;
  }

  /**
   * Get all session IDs
   */
  getSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Get statistics
   */
  getStats() {
    const sessions = Array.from(this.sessions.values());
    const totalBackgroundTasks = sessions.reduce((sum, s) => sum + s.backgroundTasks.length, 0);
    const runningTasks = sessions.reduce(
      (sum, s) => sum + s.backgroundTasks.filter((t) => t.status === 'running').length,
      0,
    );

    return {
      totalSessions: sessions.length,
      currentSessionId: this.currentSessionId,
      totalBackgroundTasks,
      runningTasks,
      memoryUsage: this.sessions.size * 1000, // rough estimate
    };
  }

  /**
   * Reset session to default state
   */
  resetSession(sessionId: string): UIState {
    const defaultState: UIState = {
      sessionId,
      isOutputExpanded: false,
      backgroundTasks: [],
      theme: 'dark',
      lastActivity: Date.now(),
    };

    this.sessions.set(sessionId, defaultState);
    this.emit('sessionReset', { sessionId, state: defaultState });

    logger.info(`Reset UI session: ${sessionId}`);
    return defaultState;
  }

  /**
   * Clear all sessions except current
   */
  clearAllSessions(): void {
    const currentState = this.getCurrentSession();
    this.sessions.clear();
    this.sessions.set(this.currentSessionId, currentState);

    this.emit('allSessionsCleared', { currentSessionId: this.currentSessionId });
    logger.info('Cleared all UI sessions except current');
  }
}

export const uiStateManager = UIStateManager.getInstance();
