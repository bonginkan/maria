import { EventEmitter } from "node:events";
import { logger } from "../utils/logger.js";

export interface UIState {
  sessionId: string;
  isOutputExpanded: boolean;
  _currentTask?: BackgroundTask;
  backgroundTasks: BackgroundTask[];
  theme: "light" | "dark";
  lastActivity: number;
}

export interface BackgroundTask {
  id: string;
  command: string;
  args: string[];
  status: "running" | "completed" | "error" | "paused";
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
  private _sessions = new Map<string, UIState>();
  private currentSessionId: string = "default";

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
      theme: "dark",
      lastActivity: Date.now(),
    });
  }

  /**
   * Get current session _state
   */
  getCurrentSession(): UIState {
    return this.getSession(this.currentSessionId);
  }

  /**
   * Get session _state by ID
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
    const _state: UIState = {
      sessionId,
      isOutputExpanded: false,
      backgroundTasks: [],
      theme: "dark",
      lastActivity: Date.now(),
    };

    this.sessions.set(sessionId, _state);
    this.emit("sessionCreated", { sessionId, _state });

    logger.info(`Created new UI session: ${sessionId}`);
    return _state;
  }

  /**
   * Switch to different session
   */
  switchSession(sessionId: string): UIState {
    const _previousSessionId = this.currentSessionId;
    this.currentSessionId = sessionId;

    if (!this.sessions.has(sessionId)) {
      this.createSession(sessionId);
    }

    const _state = this.getSession(sessionId);
    this.emit("sessionSwitched", {
      _previousSessionId,
      currentSessionId: sessionId,
      _state,
    });

    logger.info(
      `Switched UI session from ${_previousSessionId} to ${sessionId}`,
    );
    return _state;
  }

  /**
   * Update session _state
   */
  updateSession(_sessionId: string, updates: Partial<UIState>): UIState {
    const _state = this.getSession(_sessionId);

    // Apply updates
    Object.assign(_state, updates, {
      lastActivity: Date.now(),
    });

    this.sessions.set(_sessionId, _state);

    // Emit update event for each field changed
    Object.keys(updates).forEach((field) => {
      this.emit("stateUpdated", {
        sessionId: "",
        field: field as keyof UIState,
        value: (updates as Record<string, unknown>)[field],
        fullState: _state,
      });
    });

    return _state;
  }

  /**
   * Toggle output expansion for session
   */
  toggleOutputExpansion(sessionId: string): boolean {
    const _state = this.getSession(sessionId);
    const _newExpanded = !_state.isOutputExpanded;

    this.updateSession(sessionId, { isOutputExpanded: _newExpanded });

    logger.info(`Output expansion toggled for ${sessionId}: ${_newExpanded}`);
    return _newExpanded;
  }

  /**
   * Add background task
   */
  addBackgroundTask(
    sessionId: string,
    task: Omit<BackgroundTask, "id" | "startTime">,
  ): BackgroundTask {
    const _state = this.getSession(sessionId);
    const fullTask: BackgroundTask = {
      ...task,
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startTime: Date.now(),
    };

    state.backgroundTasks.push(fullTask);
    this.updateSession(sessionId, {
      backgroundTasks: [..._state.backgroundTasks],
    });

    this.emit("backgroundTaskAdded", { sessionId, task: fullTask });
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
    const _state = this.getSession(sessionId);
    const _taskIndex = _state.backgroundTasks.findIndex((t) => t.id === taskId);

    if (_taskIndex === -1) {
      logger.warn(
        `Background task ${taskId} not found in session ${sessionId}`,
      );
      return null;
    }

    // Update task
    const _currentTask = _state.backgroundTasks[_taskIndex];
    if (_currentTask) {
      Object.assign(_currentTask, updates);
      this.updateSession(sessionId, {
        backgroundTasks: [..._state.backgroundTasks],
      });

      this.emit("backgroundTaskUpdated", { sessionId, task: _currentTask });
      return _currentTask;
    }

    return null;
  }

  /**
   * Remove background task
   */
  removeBackgroundTask(_sessionId: string, taskId: string): boolean {
    const _state = this.getSession(_sessionId);
    const _taskIndex = _state.backgroundTasks.findIndex((t) => t.id === taskId);

    if (_taskIndex === -1) {
      return false;
    }

    const _removedTask = _state.backgroundTasks.splice(_taskIndex, 1)[0];
    this.updateSession(_sessionId, {
      backgroundTasks: [..._state.backgroundTasks],
    });

    this.emit("backgroundTaskRemoved", { _sessionId, task: _removedTask });
    logger.info(`Removed background task ${taskId} from session ${_sessionId}`);

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
    return this.getBackgroundTasks(sessionId).filter(
      (t) => t.status === "running",
    );
  }

  /**
   * Set current task for session
   */
  setCurrentTask(_sessionId: string, task: BackgroundTask | undefined): void {
    this.updateSession(_sessionId, { _currentTask: task });
    this.emit("currentTaskChanged", { _sessionId, task });
  }

  /**
   * Get current task for session
   */
  getCurrentTask(sessionId: string): BackgroundTask | undefined {
    return this.getSession(sessionId).currentTask;
  }

  /**
   * Clean up old _sessions (remove inactive _sessions older than 24 hours)
   */
  cleanupOldSessions(): number {
    const _cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
    let cleanedCount = 0;

    for (const [sessionId, _state] of this.sessions.entries()) {
      if (
        state.lastActivity < _cutoffTime &&
        sessionId !== this.currentSessionId
      ) {
        this.sessions.delete(sessionId);
        cleanedCount++;
        this.emit("sessionCleaned", { sessionId, _state });
        logger.info(`Cleaned up old UI session: ${sessionId}`);
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} old UI _sessions`);
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
    const _sessions = Array.from(this._sessions.values());
    const _totalBackgroundTasks = _sessions.reduce(
      (sum, s) => sum + s.backgroundTasks.length,
      0,
    );
    const _runningTasks = _sessions.reduce(
      (sum, s) =>
        sum + s.backgroundTasks.filter((t) => t.status === "running").length,
      0,
    );

    return {
      totalSessions: _sessions.length,
      currentSessionId: this.currentSessionId,
      _totalBackgroundTasks,
      _runningTasks,
      memoryUsage: this._sessions.size * 1000, // rough estimate
    };
  }

  /**
   * Reset session to default _state
   */
  resetSession(sessionId: string): UIState {
    const defaultState: UIState = {
      sessionId,
      isOutputExpanded: false,
      backgroundTasks: [],
      theme: "dark",
      lastActivity: Date.now(),
    };

    this.sessions.set(sessionId, defaultState);
    this.emit("sessionReset", { sessionId, _state: defaultState });

    logger.info(`Reset UI session: ${sessionId}`);
    return defaultState;
  }

  /**
   * Clear all _sessions except current
   */
  clearAllSessions(): void {
    const _currentState = this.getCurrentSession();
    this.sessions.clear();
    this.sessions.set(this.currentSessionId, _currentState);

    this.emit("allSessionsCleared", {
      currentSessionId: this.currentSessionId,
    });
    logger.info("Cleared all UI _sessions except current");
  }
}

export const _uiStateManager = UIStateManager.getInstance();
