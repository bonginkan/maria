// src/services/interactive-session/core/SessionManager.ts
// Core session orchestrator with state machine integration

import { SessionStateMachine, SessionStateName } from "./SessionStateMachine";
import { IInputPort } from "../ports/IInputPort";
import { IDisplayPort } from "../ports/IDisplayPort";
import { ICommandPort, CommandContext } from "../ports/ICommandPort";
import {
  toSessionError,
  UserCancelError,
  DeadlineError,
  isRecoverableError,
} from "../types/errors";

export interface SessionOptions {
  deadlineMs?: number; // Default 15000ms per turn
  maxRetries?: number; // Max retries for recoverable errors
  enableTelemetry?: boolean; // Enable metrics collection
  debugMode?: boolean; // Show debug information
}

export interface SessionMetrics {
  turnId: string;
  startTime: number;
  endTime?: number;
  state: SessionStateName;
  command?: string;
  errorCode?: string;
  deadline: boolean;
}

export class SessionManager {
  private fsm: SessionStateMachine;
  private running = false;
  private turnCount = 0;
  private metrics: SessionMetrics[] = [];
  private currentSpinnerId?: string;

  constructor(
    private input: IInputPort,
    private display: IDisplayPort,
    private command: ICommandPort,
    private options: SessionOptions = {},
  ) {
    this.options = {
      deadlineMs: 15000,
      maxRetries: 3,
      enableTelemetry: true,
      debugMode: false,
      ...options,
    };

    this.fsm = new SessionStateMachine({
      deadlineMs: this.options.deadlineMs,
    });
  }

  /**
   * Start the interactive session
   */
  async start(): Promise<void> {
    this.running = true;
    await this.display.showWelcome();

    while (this.running) {
      try {
        await this.runTurn();
      } catch (error) {
        // Handle unrecoverable errors
        const sessionError = toSessionError(error);
        this.display.error(`Session error: ${sessionError.message}`);

        if (!isRecoverableError(sessionError)) {
          this.display.error("Fatal error, ending session");
          break;
        }
      }
    }

    this.stop();
  }

  /**
   * Stop the session gracefully
   */
  stop(): void {
    this.running = false;
    this.display.stopAllSpinners();
    this.display.showGoodbye();

    if (this.options.enableTelemetry) {
      this.exportMetrics();
    }
  }

  /**
   * Run a single turn of the session
   */
  private async runTurn(): Promise<void> {
    const turnId = this.generateTurnId();
    const startTime = Date.now();

    const metric: SessionMetrics = {
      turnId,
      startTime,
      state: "Idle",
      deadline: false,
    };

    try {
      // Start state machine for this turn
      this.fsm.start(turnId, this.options.deadlineMs);

      // Input phase
      const input = await this.readInput();
      if (!input) {
        this.fsm.send({ type: "CANCEL" });
        return;
      }

      // Check for exit command
      if (input.toLowerCase() === "/exit" || input.toLowerCase() === "exit") {
        this.running = false;
        return;
      }

      metric.command = input;

      // Routing phase
      this.fsm.send({ type: "INPUT_READY", payload: input });
      const { command: cmd, args } = this.parseCommand(input);

      if (!this.command.exists(cmd)) {
        this.display.error(`Unknown command: ${cmd}`);
        this.display.info("Type /help for available commands");
        this.fsm.send({ type: "CANCEL" });
        return;
      }

      this.fsm.send({ type: "ROUTED" });

      // Execution phase
      const context: CommandContext = {
        turnId,
        input,
        args,
        signal: this.fsm.signal,
        meta: { debugMode: this.options.debugMode },
      };

      if (this.options.debugMode) {
        this.display.info(
          `Executing: ${cmd} with args: ${JSON.stringify(args)}`,
        );
      }

      // Start spinner for long operations
      this.currentSpinnerId = this.display.startSpinner(`Processing ${cmd}...`);

      const result = await this.command.execute(cmd, context);

      // Stop spinner
      if (this.currentSpinnerId) {
        this.display.stopSpinner(this.currentSpinnerId);
        this.currentSpinnerId = undefined;
      }

      this.fsm.send({ type: "EXEC_DONE" });

      // Display result
      if (result.ok) {
        if (result.message) {
          await this.display.print(result.message);
        }
      } else {
        this.display.error(result.message || "Command failed");
      }

      // Streaming phase (if applicable)
      if (
        result.data &&
        typeof result.data === "object" &&
        Symbol.asyncIterator in result.data
      ) {
        await this.display.stream(
          result.data as AsyncIterable<string>,
          this.fsm.signal,
        );
      }

      this.fsm.send({ type: "STREAM_DONE" });
    } catch (error) {
      // Stop any active spinner
      if (this.currentSpinnerId) {
        this.display.stopSpinner(this.currentSpinnerId);
        this.currentSpinnerId = undefined;
      }

      const sessionError = toSessionError(error);
      metric.errorCode = sessionError.code;

      // Check if deadline was exceeded
      if (sessionError instanceof DeadlineError) {
        metric.deadline = true;
        this.display.warning("Operation timed out");
      }

      // Send failure event to state machine
      this.fsm.send({ type: "FAIL", error: sessionError });

      // Re-throw for upper level handling
      throw sessionError;
    } finally {
      // Record metrics
      metric.endTime = Date.now();
      metric.state = this.fsm.state;

      if (this.options.enableTelemetry) {
        this.metrics.push(metric);
      }

      // Reset state machine for next turn
      this.fsm.send({ type: "RESET" });

      // Ensure spinners are stopped
      this.display.stopAllSpinners();
    }
  }

  /**
   * Read user input with proper error handling
   */
  private async readInput(): Promise<string | null> {
    try {
      // Show prompt
      await this.display.print("");
      const input = await this.input.prompt("maria> ", this.fsm.signal);

      if (!input || input.trim() === "") {
        return null;
      }

      return input.trim();
    } catch (error) {
      if (this.fsm.signal?.aborted) {
        throw new DeadlineError("Input timeout", this.options.deadlineMs!);
      }
      throw error;
    }
  }

  /**
   * Parse command and arguments from input
   */
  private parseCommand(input: string): { command: string; args: string[] } {
    const parts = input.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Handle slash commands
    if (command.startsWith("/")) {
      return { command, args };
    }

    // Default to chat/message command
    return { command: "/chat", args: parts };
  }

  /**
   * Generate unique turn ID
   */
  private generateTurnId(): string {
    return `turn-${++this.turnCount}-${Date.now()}`;
  }

  /**
   * Export collected metrics for analysis
   */
  private exportMetrics(): void {
    if (this.metrics.length === 0) return;

    const summary = {
      totalTurns: this.metrics.length,
      totalDuration: this.metrics.reduce(
        (sum, m) => sum + (m.endTime! - m.startTime),
        0,
      ),
      averageDuration: 0,
      deadlineExceeded: this.metrics.filter((m) => m.deadline).length,
      errors: this.metrics.filter((m) => m.errorCode).length,
      errorBreakdown: {} as Record<string, number>,
    };

    summary.averageDuration = summary.totalDuration / summary.totalTurns;

    // Count errors by type
    for (const metric of this.metrics) {
      if (metric.errorCode) {
        summary.errorBreakdown[metric.errorCode] =
          (summary.errorBreakdown[metric.errorCode] || 0) + 1;
      }
    }

    if (this.options.debugMode) {
      console.log("\n=== Session Metrics ===");
      console.log(JSON.stringify(summary, null, 2));
    }

    // TODO: Write to telemetry file or send to service
  }

  /**
   * Get current session state
   */
  getState(): SessionStateName {
    return this.fsm.state;
  }

  /**
   * Check if session is running
   */
  isRunning(): boolean {
    return this.running;
  }
}
