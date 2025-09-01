/**
 * SystemCommand + Interactive Session Integration Bridge
 *
 * SOW Phase 3.3 v2.1 Week 4 Implementation:
 * - State machine coordination
 * - Deadline controller sharing
 * - Abort signal propagation
 * - Metrics unification
 * - Session context preservation
 */

import { SystemCommandBase } from "../base/SystemCommandBase";
import type { CommandResultV2 } from "../contracts/SystemCommandContract";
import { logger } from "../../../utils/logger";

// Session types (simplified for integration)
export interface SessionContext {
  sessionId: string;
  deadlineAt?: number;
  signal?: AbortSignal;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface SessionStateMachine {
  currentState: string;
  send(event: SessionEvent): void;
  on(event: string, callback: (data?: any) => void): void;
  off(event: string, callback: (data?: any) => void): void;
}

export interface SessionEvent {
  type:
    | "SYSTEM_CMD_START"
    | "SYSTEM_CMD_DONE"
    | "SYSTEM_CMD_ERROR"
    | "TIMEOUT"
    | "CANCEL";
  data?: any;
  error?: Error;
}

export interface DeadlineController {
  setDeadline(ms: number): void;
  getTimeRemaining(): number;
  isExpired(): boolean;
  createAbortSignal(): AbortSignal;
}

/**
 * Bridge for integrating SystemCommand with Interactive Session
 */
export class SystemCommandSessionBridge {
  private sessionFSM?: SessionStateMachine;
  private deadlineCtrl?: DeadlineController;
  private activeCommands = new Map<string, SystemCommandBase>();

  constructor(
    sessionFSM?: SessionStateMachine,
    deadlineCtrl?: DeadlineController,
  ) {
    this.sessionFSM = sessionFSM;
    this.deadlineCtrl = deadlineCtrl;

    // Setup session event handlers
    if (sessionFSM) {
      this.setupSessionHandlers();
    }
  }

  /**
   * Execute SystemCommand with full session integration
   */
  async executeWithSession(
    command: SystemCommandBase,
    sessionContext: SessionContext,
  ): Promise<CommandResultV2> {
    const commandId = this.generateCommandId();
    const startTime = performance.now();

    try {
      // Register active command
      this.activeCommands.set(commandId, command);

      // Share session state machine
      if (this.sessionFSM) {
        this.sessionFSM.send({
          type: "SYSTEM_CMD_START",
          data: {
            commandId,
            command: command.name,
            sessionId: sessionContext.sessionId,
          },
        });
      }

      // Apply session deadline and abort signal
      await this.applySessionConstraints(command, sessionContext);

      // Execute command with monitoring
      const result = await this.executeWithMonitoring(
        command,
        commandId,
        sessionContext,
      );

      // Notify session of completion
      if (this.sessionFSM) {
        this.sessionFSM.send({
          type: "SYSTEM_CMD_DONE",
          data: {
            commandId,
            result: result.endReason,
            duration: result.duration,
          },
        });
      }

      // Add session metadata to result
      return this.enrichWithSessionData(result, sessionContext, commandId);
    } catch (error) {
      // Notify session of error
      if (this.sessionFSM) {
        this.sessionFSM.send({
          type: "SYSTEM_CMD_ERROR",
          error: error instanceof Error ? error : new Error(String(error)),
          data: { commandId },
        });
      }

      // Return error result with session context
      return {
        endReason: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        duration: performance.now() - startTime,
        timestamp: Date.now(),
        monotonicMs: performance.now(),
        data: {
          sessionId: sessionContext.sessionId,
          commandId,
        },
      };
    } finally {
      // Cleanup
      this.activeCommands.delete(commandId);
    }
  }

  /**
   * Apply session-level constraints to command
   */
  private async applySessionConstraints(
    command: SystemCommandBase,
    sessionContext: SessionContext,
  ): Promise<void> {
    // Apply deadline from session context
    if (sessionContext.deadlineAt || this.deadlineCtrl) {
      const deadlineAt =
        sessionContext.deadlineAt ??
        Date.now() + (this.deadlineCtrl?.getTimeRemaining() ?? 30000);

      command.deadlineAt = deadlineAt;

      logger.debug("Applied session deadline to command", {
        command: command.name,
        deadlineAt: new Date(deadlineAt).toISOString(),
        timeRemainingMs: deadlineAt - Date.now(),
      });
    }

    // Apply abort signal from session context or deadline controller
    if (sessionContext.signal || this.deadlineCtrl) {
      const signal =
        sessionContext.signal ?? this.deadlineCtrl?.createAbortSignal();

      if (signal) {
        command.signal = signal;

        // Log signal application
        logger.debug("Applied session abort signal to command", {
          command: command.name,
          signalAborted: signal.aborted,
        });
      }
    }

    // Apply session metadata
    if (sessionContext.metadata) {
      // Commands can access session metadata if needed
      (command as any).sessionMetadata = sessionContext.metadata;
    }
  }

  /**
   * Execute command with monitoring and session awareness
   */
  private async executeWithMonitoring(
    command: SystemCommandBase,
    commandId: string,
    sessionContext: SessionContext,
  ): Promise<CommandResultV2> {
    const startMono = performance.now();

    // Setup timeout monitoring
    const timeoutMs = command.deadlineAt
      ? command.deadlineAt - Date.now()
      : 30000;
    let timeoutHandle: NodeJS.Timeout | undefined;

    try {
      // Create timeout promise for additional safety
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(
            new Error(`Command ${command.name} timed out after ${timeoutMs}ms`),
          );
        }, timeoutMs);
      });

      // Race between command execution and timeout
      const executionPromise = command.execute();

      const result = await Promise.race([executionPromise, timeoutPromise]);

      // Clear timeout if execution completed
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      // Validate and enhance result
      return this.validateCommandResult(result, startMono);
    } catch (error) {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      // Check if it's a timeout or abort
      const isTimeout = error.message?.includes("timed out");
      const isAbort = error.name === "AbortError" || command.signal?.aborted;

      return {
        endReason: isTimeout ? "timeout" : isAbort ? "cancel" : "error",
        error: error instanceof Error ? error.message : "Unknown error",
        duration: performance.now() - startMono,
        timestamp: Date.now(),
        monotonicMs: performance.now(),
        data: {
          sessionId: sessionContext.sessionId,
          commandId,
          errorType: isTimeout ? "timeout" : isAbort ? "abort" : "error",
        },
      };
    }
  }

  /**
   * Validate and normalize command result
   */
  private validateCommandResult(
    result: CommandResultV2,
    startMono: number,
  ): CommandResultV2 {
    // Ensure required fields are present
    const validated: CommandResultV2 = {
      endReason: result.endReason ?? "error",
      duration: result.duration ?? performance.now() - startMono,
      timestamp: result.timestamp ?? Date.now(),
      monotonicMs: result.monotonicMs ?? performance.now(),
      data: result.data,
      error: result.error,
    };

    // Validate endReason
    const validReasons = ["success", "error", "timeout", "cancel"];
    if (!validReasons.includes(validated.endReason)) {
      logger.warn(
        `Invalid endReason: ${validated.endReason}, normalizing to 'error'`,
      );
      validated.endReason = "error";
    }

    return validated;
  }

  /**
   * Enrich result with session data
   */
  private enrichWithSessionData(
    result: CommandResultV2,
    sessionContext: SessionContext,
    commandId: string,
  ): CommandResultV2 {
    return {
      ...result,
      data: {
        ...result.data,
        sessionId: sessionContext.sessionId,
        commandId,
        userId: sessionContext.userId,
        sessionMetadata: {
          deadlineAt: sessionContext.deadlineAt,
          hasSignal: !!sessionContext.signal,
          sessionState: this.sessionFSM?.currentState,
        },
      },
    };
  }

  /**
   * Setup session event handlers
   */
  private setupSessionHandlers(): void {
    if (!this.sessionFSM) return;

    // Handle session timeout
    this.sessionFSM.on("TIMEOUT", () => {
      logger.info("Session timeout - cancelling active commands");
      this.cancelAllActiveCommands("Session timeout");
    });

    // Handle session cancellation
    this.sessionFSM.on("CANCEL", () => {
      logger.info("Session cancelled - cancelling active commands");
      this.cancelAllActiveCommands("Session cancelled");
    });
  }

  /**
   * Cancel all active commands
   */
  private cancelAllActiveCommands(reason: string): void {
    for (const [commandId, command] of this.activeCommands.entries()) {
      try {
        // Cancel command if possible
        if (command.signal && !command.signal.aborted) {
          // Create new AbortController to signal cancellation
          const controller = new AbortController();
          controller.abort();

          // Replace signal (if the command supports it)
          (command as any).signal = controller.signal;
        }

        logger.debug("Cancelled command due to session event", {
          commandId,
          command: command.name,
          reason,
        });
      } catch (error) {
        logger.warn("Failed to cancel command", {
          commandId,
          command: command.name,
          error: error.message,
        });
      }
    }
  }

  /**
   * Get statistics about bridge usage
   */
  getStats(): SessionBridgeStats {
    return {
      activeCommands: this.activeCommands.size,
      commandIds: Array.from(this.activeCommands.keys()),
      hasSessionFSM: !!this.sessionFSM,
      hasDeadlineController: !!this.deadlineCtrl,
      sessionState: this.sessionFSM?.currentState,
      deadlineRemaining: this.deadlineCtrl?.getTimeRemaining(),
    };
  }

  /**
   * Check if bridge is properly configured
   */
  isConfigured(): boolean {
    return !!(this.sessionFSM || this.deadlineCtrl);
  }

  /**
   * Generate unique command ID for tracking
   */
  private generateCommandId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export interface SessionBridgeStats {
  activeCommands: number;
  commandIds: string[];
  hasSessionFSM: boolean;
  hasDeadlineController: boolean;
  sessionState?: string;
  deadlineRemaining?: number;
}

/**
 * Factory function for creating configured session bridge
 */
export function createSessionBridge(
  sessionFSM?: SessionStateMachine,
  deadlineCtrl?: DeadlineController,
): SystemCommandSessionBridge {
  return new SystemCommandSessionBridge(sessionFSM, deadlineCtrl);
}

/**
 * Mock implementations for testing
 */
export class MockSessionStateMachine implements SessionStateMachine {
  currentState = "idle";
  private eventHandlers = new Map<string, ((data?: any) => void)[]>();

  send(event: SessionEvent): void {
    logger.debug("Mock session FSM event:", event);

    // Simple state transitions for testing
    switch (event.type) {
      case "SYSTEM_CMD_START":
        this.currentState = "executing_system_command";
        break;
      case "SYSTEM_CMD_DONE":
      case "SYSTEM_CMD_ERROR":
        this.currentState = "idle";
        break;
    }

    // Trigger event handlers
    const handlers = this.eventHandlers.get(event.type) || [];
    handlers.forEach((handler) => {
      try {
        handler(event.data);
      } catch (error) {
        logger.warn("Session event handler error:", error);
      }
    });
  }

  on(event: string, callback: (data?: any) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(callback);
  }

  off(event: string, callback: (data?: any) => void): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(callback);
      if (index >= 0) {
        handlers.splice(index, 1);
      }
    }
  }
}

export class MockDeadlineController implements DeadlineController {
  private deadlineAt?: number;

  setDeadline(ms: number): void {
    this.deadlineAt = Date.now() + ms;
  }

  getTimeRemaining(): number {
    if (!this.deadlineAt) return Infinity;
    return Math.max(0, this.deadlineAt - Date.now());
  }

  isExpired(): boolean {
    return this.getTimeRemaining() <= 0;
  }

  createAbortSignal(): AbortSignal {
    const controller = new AbortController();

    if (this.isExpired()) {
      controller.abort();
    } else {
      const remaining = this.getTimeRemaining();
      if (remaining < Infinity) {
        setTimeout(() => controller.abort(), remaining);
      }
    }

    return controller.signal;
  }
}
