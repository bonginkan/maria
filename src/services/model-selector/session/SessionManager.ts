/**
 * Model Selector v2 - Session Manager
 * Manages model selection state across user sessions with persistence
 */

import { EventEmitter } from "node:events";
import { ModelSelectorEngine } from "../core/ModelSelectorEngine";
import type {
  ModelInfo,
  RecommendationContext,
  ModelRecommendation,
  AuditEvent,
} from "../types/index";

export interface SessionConfig {
  userId: string;
  sessionId: string;
  persistenceEnabled?: boolean;
  maxSessionDuration?: number; // milliseconds
  autoSave?: boolean;
  securityContext?: SecurityContext;
}

export interface SecurityContext {
  permissions: string[];
  roles: string[];
  allowedProviders?: string[];
  restrictedModels?: string[];
}

export interface ModelSessionState {
  userId: string;
  sessionId: string;
  currentModel?: ModelInfo;
  recentSelections: Array<{
    modelId: string;
    timestamp: Date;
    context?: string;
  }>;
  preferences: {
    favoriteModels: string[];
    preferredProviders: string[];
    usageHistory: Array<{
      modelId: string;
      success: boolean;
      task?: string;
      timestamp: Date;
      duration?: number;
    }>;
  };
  metadata: {
    createdAt: Date;
    lastUpdated: Date;
    totalSelections: number;
    sessionDuration: number;
  };
}

export interface SessionEventData {
  type:
    | "session_started"
    | "model_changed"
    | "session_ended"
    | "preferences_updated";
  sessionId: string;
  userId: string;
  timestamp: Date;
  data?: any;
}

export class SessionManager extends EventEmitter {
  private engine: ModelSelectorEngine;
  private sessions: Map<string, ModelSessionState> = new Map();
  private config: Required<SessionConfig>;
  private activeSessionId?: string;
  private sessionStartTime: Date;
  private autoSaveInterval?: NodeJS.Timeout;

  constructor(engine: ModelSelectorEngine, config: SessionConfig) {
    super();

    this.engine = engine;
    this.config = {
      persistenceEnabled: true,
      maxSessionDuration: 24 * 60 * 60 * 1000, // 24 hours
      autoSave: true,
      securityContext: { permissions: [], roles: [] },
      ...config,
    };

    this.sessionStartTime = new Date();
    this.setupEventHandlers();
    this.initializeSession();
  }

  /**
   * Initialize a new session or restore existing one
   */
  private async initializeSession(): Promise<void> {
    this.activeSessionId = this.config.sessionId;

    try {
      // Try to restore existing session
      if (this.config.persistenceEnabled) {
        const restored = await this.restoreSession(this.config.sessionId);
        if (restored) {
          this.sessions.set(this.config.sessionId, restored);
          this.emit("session_restored", {
            sessionId: this.config.sessionId,
            userId: this.config.userId,
            state: restored,
          });
          return;
        }
      }

      // Create new session
      const newSession = this.createNewSession();
      this.sessions.set(this.config.sessionId, newSession);

      this.emitSessionEvent("session_started", { state: newSession });

      // Start auto-save if enabled
      if (this.config.autoSave && this.config.persistenceEnabled) {
        this.startAutoSave();
      }
    } catch (error) {
      this.emit("session_error", {
        error: error.message,
        operation: "initialize",
      });

      // Create fallback session
      const fallbackSession = this.createNewSession();
      this.sessions.set(this.config.sessionId, fallbackSession);
    }
  }

  /**
   * Select a model within the session context
   */
  async selectModel(
    modelId: string,
    context?: { task?: string; reason?: string },
  ): Promise<void> {
    const session = this.getActiveSession();
    if (!session) {
      throw new Error("No active session");
    }

    // Security check
    if (this.config.securityContext?.restrictedModels?.includes(modelId)) {
      const audit: AuditEvent = {
        event: "security.access_denied",
        userId: this.config.userId,
        modelId,
        timestamp: new Date(),
        metadata: { reason: "Restricted model access attempt" },
      };
      this.emit("audit", audit);
      throw new Error(`Access denied for model: ${modelId}`);
    }

    try {
      // Use engine to select model
      await this.engine.select(modelId, {
        userId: this.config.userId,
        sessionId: this.config.sessionId,
      });

      // Update session state
      const model = this.engine.getModel(modelId);
      if (model) {
        session.currentModel = model;
        session.recentSelections.unshift({
          modelId,
          timestamp: new Date(),
          context: context?.task || context?.reason,
        });

        // Keep only last 10 selections
        if (session.recentSelections.length > 10) {
          session.recentSelections = session.recentSelections.slice(0, 10);
        }

        session.metadata.totalSelections++;
        session.metadata.lastUpdated = new Date();
        session.metadata.sessionDuration =
          Date.now() - this.sessionStartTime.getTime();

        // Update in storage
        this.sessions.set(this.config.sessionId, session);

        // Auto-save if enabled
        if (this.config.persistenceEnabled && this.config.autoSave) {
          await this.saveSession(session);
        }

        this.emitSessionEvent("model_changed", {
          modelId,
          modelName: model.name,
          provider: model.provider,
          context,
        });

        // Emit model selector event for telemetry
        this.emit("model_selector_event", {
          type: "select",
          modelId,
          timestamp: new Date(),
          duration: Date.now() - this.sessionStartTime.getTime(),
          success: true,
        });

        // Audit log
        const audit: AuditEvent = {
          event: "session.model_selected",
          userId: this.config.userId,
          modelId,
          timestamp: new Date(),
          metadata: {
            sessionId: this.config.sessionId,
            task: context?.task,
            totalSelections: session.metadata.totalSelections,
          },
        };
        this.emit("audit", audit);
      }
    } catch (error) {
      this.emit("selection_error", {
        modelId,
        error: error.message,
        sessionId: this.config.sessionId,
      });
      throw error;
    }
  }

  /**
   * Get recommendations with session context
   */
  async getRecommendations(
    context: Partial<RecommendationContext> = {},
  ): Promise<ModelRecommendation[]> {
    const session = this.getActiveSession();
    if (!session) {
      throw new Error("No active session");
    }

    // Enhance context with session data
    const enhancedContext: RecommendationContext = {
      userId: this.config.userId,
      sessionId: this.config.sessionId,
      history: session.preferences.usageHistory.map((h) => ({
        modelId: h.modelId,
        success: h.success,
        task: h.task || "unknown",
        timestamp: h.timestamp,
        latency: h.duration,
      })),
      candidates: [], // Will be populated by engine
      ...context,
    };

    try {
      const recommendations = await this.engine.recommend(enhancedContext);

      this.emit("recommendations_generated", {
        sessionId: this.config.sessionId,
        count: recommendations.length,
        task: context.task,
        topModel: recommendations[0]?.id,
      });

      return recommendations;
    } catch (error) {
      this.emit("recommendation_error", {
        sessionId: this.config.sessionId,
        error: error.message,
        task: context.task,
      });

      return [];
    }
  }

  /**
   * Record model usage in session
   */
  async recordUsage(
    modelId: string,
    context: {
      success: boolean;
      duration?: number;
      task?: string;
      error?: string;
    },
  ): Promise<void> {
    const session = this.getActiveSession();
    if (!session) return;

    // Update session history
    session.preferences.usageHistory.push({
      modelId,
      success: context.success,
      task: context.task,
      timestamp: new Date(),
      duration: context.duration,
    });

    // Keep only last 100 usage records
    if (session.preferences.usageHistory.length > 100) {
      session.preferences.usageHistory =
        session.preferences.usageHistory.slice(-100);
    }

    session.metadata.lastUpdated = new Date();
    this.sessions.set(this.config.sessionId, session);

    // Record in engine
    await this.engine.recordUsage(modelId, {
      success: context.success,
      executionTime: context.duration || 0,
      task: context.task,
      userId: this.config.userId,
      error: context.error,
    });

    // Auto-save if enabled
    if (this.config.persistenceEnabled && this.config.autoSave) {
      await this.saveSession(session);
    }

    this.emit("usage_recorded", {
      sessionId: this.config.sessionId,
      modelId,
      success: context.success,
      task: context.task,
    });
  }

  /**
   * Update user preferences
   */
  async updatePreferences(updates: {
    favoriteModels?: string[];
    preferredProviders?: string[];
  }): Promise<void> {
    const session = this.getActiveSession();
    if (!session) return;

    if (updates.favoriteModels) {
      session.preferences.favoriteModels = [...new Set(updates.favoriteModels)];
    }

    if (updates.preferredProviders) {
      session.preferences.preferredProviders = [
        ...new Set(updates.preferredProviders),
      ];
    }

    session.metadata.lastUpdated = new Date();
    this.sessions.set(this.config.sessionId, session);

    if (this.config.persistenceEnabled) {
      await this.saveSession(session);
    }

    this.emitSessionEvent("preferences_updated", {
      favorites: session.preferences.favoriteModels,
      providers: session.preferences.preferredProviders,
    });
  }

  /**
   * Get current session state
   */
  getSession(): ModelSessionState | undefined {
    return this.getActiveSession();
  }

  /**
   * Get session statistics
   */
  getStats(): {
    sessionId: string;
    duration: number;
    totalSelections: number;
    uniqueModels: number;
    favoriteCount: number;
    successRate: number;
  } {
    const session = this.getActiveSession();
    if (!session) {
      return {
        sessionId: this.config.sessionId,
        duration: 0,
        totalSelections: 0,
        uniqueModels: 0,
        favoriteCount: 0,
        successRate: 0,
      };
    }

    // Calculate unique models from both usage history and recent selections
    const usageModels = session.preferences.usageHistory.map((h) => h.modelId);
    const recentModels = session.recentSelections.map((s) => s.modelId);
    const uniqueModels = new Set([...usageModels, ...recentModels]).size;
    const successes = session.preferences.usageHistory.filter(
      (h) => h.success,
    ).length;
    const total = session.preferences.usageHistory.length;
    const successRate = total > 0 ? successes / total : 0;

    return {
      sessionId: this.config.sessionId,
      duration: session.metadata.sessionDuration,
      totalSelections: session.metadata.totalSelections,
      uniqueModels,
      favoriteCount: session.preferences.favoriteModels.length,
      successRate,
    };
  }

  /**
   * End the session
   */
  async endSession(): Promise<void> {
    const session = this.getActiveSession();
    if (!session) return;

    // Calculate final duration
    session.metadata.sessionDuration =
      Date.now() - this.sessionStartTime.getTime();
    session.metadata.lastUpdated = new Date();

    // Save final state
    if (this.config.persistenceEnabled) {
      await this.saveSession(session);
    }

    // Stop auto-save
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }

    this.emitSessionEvent("session_ended", {
      duration: session.metadata.sessionDuration,
      totalSelections: session.metadata.totalSelections,
    });

    // Audit log
    const audit: AuditEvent = {
      event: "session.ended",
      userId: this.config.userId,
      timestamp: new Date(),
      metadata: {
        sessionId: this.config.sessionId,
        duration: session.metadata.sessionDuration,
        totalSelections: session.metadata.totalSelections,
      },
    };
    this.emit("audit", audit);

    // Remove from memory if not persistent
    if (!this.config.persistenceEnabled) {
      this.sessions.delete(this.config.sessionId);
    }
  }

  // Private methods

  private getActiveSession(): ModelSessionState | undefined {
    return this.activeSessionId
      ? this.sessions.get(this.activeSessionId)
      : undefined;
  }

  private createNewSession(): ModelSessionState {
    return {
      userId: this.config.userId,
      sessionId: this.config.sessionId,
      recentSelections: [],
      preferences: {
        favoriteModels: [],
        preferredProviders: [],
        usageHistory: [],
      },
      metadata: {
        createdAt: new Date(),
        lastUpdated: new Date(),
        totalSelections: 0,
        sessionDuration: 0,
      },
    };
  }

  private async saveSession(session: ModelSessionState): Promise<void> {
    try {
      // For MVP, we'll use a simple file-based storage
      // In production, this could be Redis, Database, etc.
      const fs = await import("fs").then((m) => m.promises);
      const path = await import("path");

      const sessionDir = path.join(process.cwd(), ".maria", "sessions");
      const sessionFile = path.join(sessionDir, `${session.sessionId}.json`);

      // Ensure directory exists
      await fs.mkdir(sessionDir, { recursive: true });

      // Save session data
      await fs.writeFile(sessionFile, JSON.stringify(session, null, 2));
    } catch (error) {
      this.emit("save_error", {
        sessionId: session.sessionId,
        error: error.message,
      });
    }
  }

  private async restoreSession(
    sessionId: string,
  ): Promise<ModelSessionState | null> {
    try {
      const fs = await import("fs").then((m) => m.promises);
      const path = await import("path");

      const sessionFile = path.join(
        process.cwd(),
        ".maria",
        "sessions",
        `${sessionId}.json`,
      );
      const data = await fs.readFile(sessionFile, "utf8");
      const session = JSON.parse(data) as ModelSessionState;

      // Validate and clean up session data
      session.metadata.lastUpdated = new Date();

      return session;
    } catch (error) {
      // Session doesn't exist or is corrupted - not an error
      return null;
    }
  }

  private startAutoSave(): void {
    // Auto-save every 30 seconds
    this.autoSaveInterval = setInterval(async () => {
      const session = this.getActiveSession();
      if (session) {
        await this.saveSession(session);
      }
    }, 30000);
  }

  private setupEventHandlers(): void {
    // Forward engine events to session events
    this.engine.on("model_selected", (data) => {
      this.emit("engine_event", { type: "model_selected", data });
    });

    this.engine.on("recommendations_generated", (data) => {
      this.emit("engine_event", { type: "recommendations_generated", data });
    });

    this.engine.on("usage_recorded", (data) => {
      this.emit("engine_event", { type: "usage_recorded", data });
    });

    // Handle audit events
    this.engine.on("audit", (event: AuditEvent) => {
      this.emit("audit", event);
    });
  }

  private emitSessionEvent(type: SessionEventData["type"], data?: any): void {
    const event: SessionEventData = {
      type,
      sessionId: this.config.sessionId,
      userId: this.config.userId,
      timestamp: new Date(),
      data,
    };

    this.emit("session_event", event);
    this.emit(type, event);
  }
}

export default SessionManager;
