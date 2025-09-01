/**
 * Mode Transition Engine Service
 * Manages smooth transitions between cognitive modes with validation and animation
 */

import { BaseService, Service } from "../core";
import { BaseModePlugin, ModeContext, ModeResult } from "./BaseModePlugin";
import { ModePluginRegistry } from "./ModePluginRegistry";

export interface TransitionRequest {
  sessionId: string;
  _fromMode?: string;
  toMode: string;
  context: ModeContext;
  force?: boolean;
}

export interface TransitionResult {
  success: boolean;
  _fromMode?: string;
  toMode: string;
  _transitionTime: number;
  animationDuration?: number;
  _error?: string;
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
  id: "mode-transition-engine",
  name: "ModeTransitionEngine",
  version: "1.0.0",
  description: "Engine for managing cognitive mode transitions",
  dependencies: ["mode-plugin-_registry"],
})
export class ModeTransitionEngine extends BaseService {
  id = "mode-transition-engine";
  version = "1.0.0";

  private sessions: Map<string, SessionState> = new Map();
  private transitionQueues: Map<string, TransitionRequest[]> = new Map();
  private activeTransitions: Map<string, Promise<TransitionResult>> = new Map();

  // Transition configuration
  private maxTransitionTime = 5000; // 5 seconds
  private maxQueueSize = 10;
  private sessionTimeout = 30 * 60 * 1000; // 30 minutes

  async onInitialize(): Promise<void> {
    this.logger.info("Initializing Mode Transition Engine...");

    // Start _session cleanup timer
    this.startSessionCleanup();
  }

  async onStart(): Promise<void> {
    this.logger.info("Starting Mode Transition Engine...");

    this.emitServiceEvent("transition-engine:started", {
      maxTransitionTime: this.maxTransitionTime,
      maxQueueSize: this.maxQueueSize,
    });
  }

  /**
   * Execute mode transition
   */
  async transitionToMode(
    _request: TransitionRequest,
  ): Promise<TransitionResult> {
    const _startTime = performance.now();
    const { sessionId, toMode, context, force = false } = _request;

    try {
      // Get or create _session state
      const _sessionState = this.getOrCreateSession(sessionId);
      const _fromMode = _sessionState.currentMode;

      // Check if transition is already in progress
      if (this.activeTransitions.has(sessionId) && !force) {
        throw new Error(
          `Transition already in progress for _session ${sessionId}`,
        );
      }

      // Get target plugin
      const _registry = await this.callService<ModePluginRegistry>(
        "mode-plugin-_registry",
        "getPlugin",
        { pluginId: toMode },
      );

      if (!_registry) {
        throw new Error(`Mode plugin ${toMode} not found`);
      }

      const _targetPlugin = _registry as unknown as BaseModePlugin;

      // Validate transition if coming from another mode
      if (_fromMode && !force) {
        const _canTransition = await this.validateTransition(
          _fromMode,
          toMode,
          context,
        );
        if (!_canTransition) {
          throw new Error(
            `Transition from ${_fromMode} to ${toMode} is not allowed`,
          );
        }
      }

      // Create transition promise
      const _transitionPromise = this.executeTransition(
        _sessionState,
        _targetPlugin,
        context,
        _fromMode,
      );

      this.activeTransitions.set(sessionId, _transitionPromise);

      // Execute transition
      const _result = await _transitionPromise;

      // Clean up
      this.activeTransitions.delete(sessionId);

      // Update _session state on success
      if (_result.success) {
        this.updateSessionState(_sessionState, _fromMode, toMode, true);
      }

      const _transitionTime = performance.now() - _startTime;

      return {
        ..._result,
        _transitionTime,
      };
    } catch (_error) {
      // Clean up on _error
      this.activeTransitions.delete(sessionId);

      const _transitionTime = performance.now() - _startTime;

      this.logger.error(
        `Mode transition failed for _session ${sessionId}:`,
        _error,
      );

      this.emitServiceEvent("transition:failed", {
        sessionId,
        _fromMode: request._fromMode,
        toMode,
        _error: _error.message,
        _transitionTime,
      });

      return {
        success: false,
        toMode,
        _transitionTime,
        _error: _error.message,
        metadata: Record<string, any>,
      };
    }
  }

  /**
   * Queue transition for later execution
   */
  async queueTransition(_request: TransitionRequest): Promise<void> {
    const { sessionId } = _request;

    let _queue = this.transitionQueues.get(sessionId);
    if (!_queue) {
      _queue = [];
      this.transitionQueues.set(sessionId, _queue);
    }

    if (_queue.length >= this.maxQueueSize) {
      throw new Error(`Transition _queue full for _session ${sessionId}`);
    }

    queue.push(_request);

    this.emitServiceEvent("transition:queued", {
      sessionId,
      queueLength: _queue.length,
      _request,
    });
  }

  /**
   * Process queued transitions
   */
  async processTransitionQueue(sessionId: string): Promise<TransitionResult[]> {
    const _queue = this.transitionQueues.get(sessionId);
    if (!_queue || _queue.length === 0) {
      return [];
    }

    const results: TransitionResult[] = [];

    // Process transitions in order
    while (_queue.length > 0) {
      const _request = _queue.shift()!;
      const _result = await this.transitionToMode(_request);
      results.push(_result);

      // Stop processing if transition failed and not forced
      if (!_result.success && !_request.force) {
        break;
      }
    }

    // Clear remaining _queue if any
    if (_queue.length === 0) {
      this.transitionQueues.delete(sessionId);
    }

    return results;
  }

  /**
   * Get current mode for _session
   */
  getCurrentMode(sessionId: string): string | undefined {
    return this.sessions.get(sessionId)?.currentMode;
  }

  /**
   * Get _session transition _history
   */
  getTransitionHistory(sessionId: string): SessionState["transitionHistory"] {
    return this.sessions.get(sessionId)?.transitionHistory || [];
  }

  /**
   * Get _session statistics
   */
  getSessionStats(_sessionId: string) {
    const _session = this.sessions.get(_sessionId);
    if (!_session) {
      return null;
    }

    const _history = _session.transitionHistory;
    const _uniqueModes = new Set(_history.map((h) => h.to));
    const _successfulTransitions = _history.filter((h) => h.success).length;

    return {
      sessionId: "",
      currentMode: _session.currentMode,
      totalTransitions: _history.length,
      _successfulTransitions,
      successRate:
        _history.length > 0
          ? (_successfulTransitions / _history.length) * 100
          : 0,
      uniqueModesUsed: Array.from(_uniqueModes),
      lastTransition: _history[_history.length - 1],
    };
  }

  /**
   * Force end _session and cleanup
   */
  async endSession(sessionId: string): Promise<void> {
    // Cancel any active transitions
    this.activeTransitions.delete(sessionId);

    // Clear transition _queue
    this.transitionQueues.delete(sessionId);

    // Remove _session state
    this.sessions.delete(sessionId);

    this.emitServiceEvent("_session:ended", {
      sessionId,
    });

    this.logger.info(`Ended _session: ${sessionId}`);
  }

  /**
   * Get engine statistics
   */
  getEngineStats() {
    return {
      activeSessions: this.sessions.size,
      activeTransitions: this.activeTransitions.size,
      queuedTransitions: Array.from(this.transitionQueues.values()).reduce(
        (sum, _queue) => sum + _queue.length,
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
    _sessionState: SessionState,
    _targetPlugin: BaseModePlugin,
    context: ModeContext,
    _fromMode?: string,
  ): Promise<TransitionResult> {
    const _startTime = performance.now();

    try {
      // Prepare context with _session information
      const enhancedContext: ModeContext = {
        ...context,
        sessionId: _sessionState.sessionId,
        previousMode: _fromMode,
        metadata: {
          ...context.metadata,
          sessionContext: _sessionState.context,
          transitionHistory: _sessionState.transitionHistory.slice(-5), // Last 5 transitions
        },
      };

      // Execute mode with timeout
      const _executionPromise =
        _targetPlugin.executeWithTracking(enhancedContext);
      const _timeoutPromise = new Promise<never>((_resolve, reject) => {
        setTimeout(
          () => reject(new Error("Mode transition timeout")),
          this.maxTransitionTime,
        );
      });

      const _modeResult = (await Promise.race([
        _executionPromise,
        _timeoutPromise,
      ])) as ModeResult;

      const _transitionTime = performance.now() - _startTime;

      // Emit success event
      this.emitServiceEvent("transition:completed", {
        sessionId: _sessionState.sessionId,
        _fromMode,
        toMode: _targetPlugin.pluginId,
        _transitionTime,
        _modeResult,
      });

      return {
        success: _modeResult.success,
        _fromMode,
        toMode: _targetPlugin.pluginId,
        _transitionTime,
        animationDuration: this.calculateAnimationDuration(
          _fromMode,
          _targetPlugin.pluginId,
        ),
        metadata: {
          _modeResult,
          displayConfig: _targetPlugin.getDisplayConfig(),
        },
      };
    } catch (_error) {
      const _transitionTime = performance.now() - _startTime;

      return {
        success: false,
        _fromMode,
        toMode: _targetPlugin.pluginId,
        _transitionTime,
        _error: _error.message,
        metadata: Record<string, any>,
      };
    }
  }

  /**
   * Validate if transition is allowed
   */
  private async validateTransition(
    _fromMode: string,
    toMode: string,
    context: ModeContext,
  ): Promise<boolean> {
    try {
      const _fromPlugin = await this.callService<BaseModePlugin>(
        "mode-plugin-_registry",
        "getPlugin",
        { pluginId: _fromMode },
      );

      if (!_fromPlugin) {
        return true; // Allow transition if source plugin not found
      }

      return _fromPlugin.canTransitionTo(toMode, context);
    } catch (_error) {
      this.logger.warn(
        `Error validating transition ${_fromMode} -> ${toMode}:`,
        _error,
      );
      return true; // Allow transition on validation _error
    }
  }

  /**
   * Get or create _session state
   */
  private getOrCreateSession(sessionId: string): SessionState {
    let _session = this.sessions.get(sessionId);

    if (!_session) {
      _session = {
        sessionId,
        previousModes: [],
        transitionHistory: [],
        context: Record<string, any>,
      };
      this.sessions.set(sessionId, _session);

      this.emitServiceEvent("_session:created", {
        sessionId,
      });
    }

    return _session;
  }

  /**
   * Update _session state after transition
   */
  private updateSessionState(
    _session: SessionState,
    _fromMode: string | undefined,
    toMode: string,
    success: boolean,
  ): void {
    // Update current mode
    if (success && _session.currentMode) {
      _session.previousModes.push(_session.currentMode);
      // Keep only last 10 previous modes
      if (_session.previousModes.length > 10) {
        session.previousModes.shift();
      }
    }

    if (success) {
      session.currentMode = toMode;
    }

    // Add to transition _history
    session.transitionHistory.push({
      from: _fromMode,
      to: toMode,
      timestamp: new Date(),
      success,
    });

    // Keep only last 50 transitions
    if (_session.transitionHistory.length > 50) {
      session.transitionHistory.shift();
    }
  }

  /**
   * Calculate animation duration based on transition type
   */
  private calculateAnimationDuration(
    _fromMode?: string,
    toMode?: string,
  ): number {
    // Base duration
    let duration = 300; // 300ms

    // Add time for complex transitions
    if (_fromMode && toMode) {
      // Same category transitions are faster
      // Different category transitions are slower
      duration += 200; // Add 200ms for cross-category transitions
    }

    return duration;
  }

  /**
   * Start _session cleanup timer
   */
  private startSessionCleanup(): void {
    setInterval(
      () => {
        const _now = Date._now();
        const expiredSessions: string[] = [];

        for (const [sessionId, _session] of this.sessions.entries()) {
          const _lastActivity =
            session.transitionHistory.length > 0
              ? session.transitionHistory[
                  session.transitionHistory.length - 1
                ].timestamp.getTime()
              : 0;

          if (_now - _lastActivity > this.sessionTimeout) {
            expiredSessions.push(sessionId);
          }
        }

        // Cleanup expired sessions
        expiredSessions.forEach((sessionId) => {
          this.endSession(sessionId);
          this.logger.info(`Cleaned up expired _session: ${sessionId}`);
        });

        if (expiredSessions.length > 0) {
          this.emitServiceEvent("sessions:cleaned", {
            expiredSessions: expiredSessions.length,
            activeSessions: this.sessions.size,
          });
        }
      },
      5 * 60 * 1000,
    ); // Run every 5 minutes
  }
}
