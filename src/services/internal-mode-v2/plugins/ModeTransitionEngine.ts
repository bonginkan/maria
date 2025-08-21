/**
 * Mode Transition Engine Service
 * Manages smooth transitions between cognitive modes with validation and animation
 */

import { BaseService, Service } from '../core';
import { BaseModePlugin, ModeContext, ModeResult } from './BaseModePlugin';
import { ModePluginRegistry } from './ModePluginRegistry';

export interface TransitionRequest {
  sessionId: string;
  fromMode?: string;
  toMode: string;
  context: ModeContext;
  force?: boolean;
}

export interface TransitionResult {
  success: boolean;
  fromMode?: string;
  toMode: string;
  transitionTime: number;
  animationDuration?: number;
  error?: string;
  metadata: Record<string, any>;
}

export interface SessionState {
  sessionId: string;
  currentMode?: string;
  previousModes: string[];
  transitionHistory: Array<{
    from?: string;
    to: string;
    timestamp: Date;
    success: boolean;
  }>;
  context: Record<string, any>;
}

@Service({
  id: 'mode-transition-engine',
  name: 'ModeTransitionEngine',
  version: '1.0.0',
  description: 'Engine for managing cognitive mode transitions',
  dependencies: ['mode-plugin-registry'],
})
export class ModeTransitionEngine extends BaseService {
  id = 'mode-transition-engine';
  version = '1.0.0';

  private sessions: Map<string, SessionState> = new Map();
  private transitionQueues: Map<string, TransitionRequest[]> = new Map();
  private activeTransitions: Map<string, Promise<TransitionResult>> = new Map();

  // Transition configuration
  private maxTransitionTime = 5000; // 5 seconds
  private maxQueueSize = 10;
  private sessionTimeout = 30 * 60 * 1000; // 30 minutes

  async onInitialize(): Promise<void> {
    this.logger.info('Initializing Mode Transition Engine...');

    // Start session cleanup timer
    this.startSessionCleanup();
  }

  async onStart(): Promise<void> {
    this.logger.info('Starting Mode Transition Engine...');

    this.emitServiceEvent('transition-engine:started', {
      maxTransitionTime: this.maxTransitionTime,
      maxQueueSize: this.maxQueueSize,
    });
  }

  /**
   * Execute mode transition
   */
  async transitionToMode(request: TransitionRequest): Promise<TransitionResult> {
    const startTime = performance.now();
    const { sessionId, toMode, context, force = false } = request;

    try {
      // Get or create session state
      const sessionState = this.getOrCreateSession(sessionId);
      const fromMode = sessionState.currentMode;

      // Check if transition is already in progress
      if (this.activeTransitions.has(sessionId) && !force) {
        throw new Error(`Transition already in progress for session ${sessionId}`);
      }

      // Get target plugin
      const registry = await this.callService<ModePluginRegistry>(
        'mode-plugin-registry',
        'getPlugin',
        { pluginId: toMode },
      );

      if (!registry) {
        throw new Error(`Mode plugin ${toMode} not found`);
      }

      const targetPlugin = registry as unknown as BaseModePlugin;

      // Validate transition if coming from another mode
      if (fromMode && !force) {
        const canTransition = await this.validateTransition(fromMode, toMode, context);
        if (!canTransition) {
          throw new Error(`Transition from ${fromMode} to ${toMode} is not allowed`);
        }
      }

      // Create transition promise
      const transitionPromise = this.executeTransition(
        sessionState,
        targetPlugin,
        context,
        fromMode,
      );

      this.activeTransitions.set(sessionId, transitionPromise);

      // Execute transition
      const result = await transitionPromise;

      // Clean up
      this.activeTransitions.delete(sessionId);

      // Update session state on success
      if (result.success) {
        this.updateSessionState(sessionState, fromMode, toMode, true);
      }

      const transitionTime = performance.now() - startTime;

      return {
        ...result,
        transitionTime,
      };
    } catch (error) {
      // Clean up on error
      this.activeTransitions.delete(sessionId);

      const transitionTime = performance.now() - startTime;

      this.logger.error(`Mode transition failed for session ${sessionId}:`, error);

      this.emitServiceEvent('transition:failed', {
        sessionId,
        fromMode: request.fromMode,
        toMode,
        error: error.message,
        transitionTime,
      });

      return {
        success: false,
        toMode,
        transitionTime,
        error: error.message,
        metadata: {},
      };
    }
  }

  /**
   * Queue transition for later execution
   */
  async queueTransition(request: TransitionRequest): Promise<void> {
    const { sessionId } = request;

    let queue = this.transitionQueues.get(sessionId);
    if (!queue) {
      queue = [];
      this.transitionQueues.set(sessionId, queue);
    }

    if (queue.length >= this.maxQueueSize) {
      throw new Error(`Transition queue full for session ${sessionId}`);
    }

    queue.push(request);

    this.emitServiceEvent('transition:queued', {
      sessionId,
      queueLength: queue.length,
      request,
    });
  }

  /**
   * Process queued transitions
   */
  async processTransitionQueue(sessionId: string): Promise<TransitionResult[]> {
    const queue = this.transitionQueues.get(sessionId);
    if (!queue || queue.length === 0) {
      return [];
    }

    const results: TransitionResult[] = [];

    // Process transitions in order
    while (queue.length > 0) {
      const request = queue.shift()!;
      const result = await this.transitionToMode(request);
      results.push(result);

      // Stop processing if transition failed and not forced
      if (!result.success && !request.force) {
        break;
      }
    }

    // Clear remaining queue if any
    if (queue.length === 0) {
      this.transitionQueues.delete(sessionId);
    }

    return results;
  }

  /**
   * Get current mode for session
   */
  getCurrentMode(sessionId: string): string | undefined {
    return this.sessions.get(sessionId)?.currentMode;
  }

  /**
   * Get session transition history
   */
  getTransitionHistory(sessionId: string): SessionState['transitionHistory'] {
    return this.sessions.get(sessionId)?.transitionHistory || [];
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const history = session.transitionHistory;
    const uniqueModes = new Set(history.map((h) => h.to));
    const successfulTransitions = history.filter((h) => h.success).length;

    return {
      sessionId,
      currentMode: session.currentMode,
      totalTransitions: history.length,
      successfulTransitions,
      successRate: history.length > 0 ? (successfulTransitions / history.length) * 100 : 0,
      uniqueModesUsed: Array.from(uniqueModes),
      lastTransition: history[history.length - 1],
    };
  }

  /**
   * Force end session and cleanup
   */
  async endSession(sessionId: string): Promise<void> {
    // Cancel any active transitions
    this.activeTransitions.delete(sessionId);

    // Clear transition queue
    this.transitionQueues.delete(sessionId);

    // Remove session state
    this.sessions.delete(sessionId);

    this.emitServiceEvent('session:ended', {
      sessionId,
    });

    this.logger.info(`Ended session: ${sessionId}`);
  }

  /**
   * Get engine statistics
   */
  getEngineStats() {
    return {
      activeSessions: this.sessions.size,
      activeTransitions: this.activeTransitions.size,
      queuedTransitions: Array.from(this.transitionQueues.values()).reduce(
        (sum, queue) => sum + queue.length,
        0,
      ),
      maxTransitionTime: this.maxTransitionTime,
      maxQueueSize: this.maxQueueSize,
    };
  }

  /**
   * Execute the actual mode transition
   */
  private async executeTransition(
    sessionState: SessionState,
    targetPlugin: BaseModePlugin,
    context: ModeContext,
    fromMode?: string,
  ): Promise<TransitionResult> {
    const startTime = performance.now();

    try {
      // Prepare context with session information
      const enhancedContext: ModeContext = {
        ...context,
        sessionId: sessionState.sessionId,
        previousMode: fromMode,
        metadata: {
          ...context.metadata,
          sessionContext: sessionState.context,
          transitionHistory: sessionState.transitionHistory.slice(-5), // Last 5 transitions
        },
      };

      // Execute mode with timeout
      const executionPromise = targetPlugin.executeWithTracking(enhancedContext);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Mode transition timeout')), this.maxTransitionTime);
      });

      const modeResult = (await Promise.race([executionPromise, timeoutPromise])) as ModeResult;

      const transitionTime = performance.now() - startTime;

      // Emit success event
      this.emitServiceEvent('transition:completed', {
        sessionId: sessionState.sessionId,
        fromMode,
        toMode: targetPlugin.pluginId,
        transitionTime,
        modeResult,
      });

      return {
        success: modeResult.success,
        fromMode,
        toMode: targetPlugin.pluginId,
        transitionTime,
        animationDuration: this.calculateAnimationDuration(fromMode, targetPlugin.pluginId),
        metadata: {
          modeResult,
          displayConfig: targetPlugin.getDisplayConfig(),
        },
      };
    } catch (error) {
      const transitionTime = performance.now() - startTime;

      return {
        success: false,
        fromMode,
        toMode: targetPlugin.pluginId,
        transitionTime,
        error: error.message,
        metadata: {},
      };
    }
  }

  /**
   * Validate if transition is allowed
   */
  private async validateTransition(
    fromMode: string,
    toMode: string,
    context: ModeContext,
  ): Promise<boolean> {
    try {
      const fromPlugin = await this.callService<BaseModePlugin>(
        'mode-plugin-registry',
        'getPlugin',
        { pluginId: fromMode },
      );

      if (!fromPlugin) {
        return true; // Allow transition if source plugin not found
      }

      return fromPlugin.canTransitionTo(toMode, context);
    } catch (error) {
      this.logger.warn(`Error validating transition ${fromMode} -> ${toMode}:`, error);
      return true; // Allow transition on validation error
    }
  }

  /**
   * Get or create session state
   */
  private getOrCreateSession(sessionId: string): SessionState {
    let session = this.sessions.get(sessionId);

    if (!session) {
      session = {
        sessionId,
        previousModes: [],
        transitionHistory: [],
        context: {},
      };
      this.sessions.set(sessionId, session);

      this.emitServiceEvent('session:created', {
        sessionId,
      });
    }

    return session;
  }

  /**
   * Update session state after transition
   */
  private updateSessionState(
    session: SessionState,
    fromMode: string | undefined,
    toMode: string,
    success: boolean,
  ): void {
    // Update current mode
    if (success && session.currentMode) {
      session.previousModes.push(session.currentMode);
      // Keep only last 10 previous modes
      if (session.previousModes.length > 10) {
        session.previousModes.shift();
      }
    }

    if (success) {
      session.currentMode = toMode;
    }

    // Add to transition history
    session.transitionHistory.push({
      from: fromMode,
      to: toMode,
      timestamp: new Date(),
      success,
    });

    // Keep only last 50 transitions
    if (session.transitionHistory.length > 50) {
      session.transitionHistory.shift();
    }
  }

  /**
   * Calculate animation duration based on transition type
   */
  private calculateAnimationDuration(fromMode?: string, toMode?: string): number {
    // Base duration
    let duration = 300; // 300ms

    // Add time for complex transitions
    if (fromMode && toMode) {
      // Same category transitions are faster
      // Different category transitions are slower
      duration += 200; // Add 200ms for cross-category transitions
    }

    return duration;
  }

  /**
   * Start session cleanup timer
   */
  private startSessionCleanup(): void {
    setInterval(
      () => {
        const now = Date.now();
        const expiredSessions: string[] = [];

        for (const [sessionId, session] of this.sessions.entries()) {
          const lastActivity =
            session.transitionHistory.length > 0
              ? session.transitionHistory[session.transitionHistory.length - 1].timestamp.getTime()
              : 0;

          if (now - lastActivity > this.sessionTimeout) {
            expiredSessions.push(sessionId);
          }
        }

        // Cleanup expired sessions
        expiredSessions.forEach((sessionId) => {
          this.endSession(sessionId);
          this.logger.info(`Cleaned up expired session: ${sessionId}`);
        });

        if (expiredSessions.length > 0) {
          this.emitServiceEvent('sessions:cleaned', {
            expiredSessions: expiredSessions.length,
            activeSessions: this.sessions.size,
          });
        }
      },
      5 * 60 * 1000,
    ); // Run every 5 minutes
  }
}
