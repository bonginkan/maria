/**
 * SessionOrchestrator - Unified session management
 * Handles both TTY interactive mode and non-TTY pipe mode
 * Single point of control for session lifecycle
 */

import type { Interface as ReadlineInterface } from "node:readline";
import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";
import { InputController } from "./input-controller";

export interface SessionDeps {
  rl?: ReadlineInterface;
  onCommand: (line: string) => Promise<void>;
  onExit?: (code?: number) => Promise<void>;
}

export interface SessionConfig {
  sessionId?: string;
  correlationId?: string;
  useGlobalOwnershipCheck?: boolean;
}

export class SessionOrchestrator {
  private readonly input = new InputController();
  private readonly sessionId: string;
  private running = false;
  private shuttingDown = false;
  private rl?: ReadlineInterface;

  constructor(
    private deps: SessionDeps,
    config?: SessionConfig,
  ) {
    this.sessionId = config?.sessionId ?? `s_${Date.now().toString(36)}`;

    // Global ownership check to prevent double startup
    if (config?.useGlobalOwnershipCheck !== false) {
      this.checkGlobalOwnership();
    }
  }

  /**
   * Prevent multiple session instances
   * Critical for avoiding dual session conflicts
   */
  private checkGlobalOwnership(): void {
    if ((globalThis as any).__MARIA_STDIN_OWNER) {
      console.error("FATAL: Another session already owns stdin");
      console.error(
        `Current owner: ${(globalThis as any).__MARIA_STDIN_OWNER}`,
      );
      console.error(`Attempting owner: ${this.sessionId}`);
      process.exitCode = 1;
      return;
    }
    (globalThis as any).__MARIA_STDIN_OWNER = this.sessionId;

    if (process.env.MARIA_DEBUG === "1") {
      console.log(`[SESSION] ${this.sessionId} acquired stdin ownership`);
    }
  }

  /**
   * Start the session - handles both interactive and pipe modes
   */
  async start(): Promise<void> {
    if (this.running) {
      console.warn(`Session ${this.sessionId} already running`);
      return;
    }

    this.running = true;

    if (process.env.MARIA_DEBUG === "1") {
      console.log(
        `[SESSION] ${this.sessionId} starting - TTY=${!!process.stdin.isTTY}`,
      );
    }

    try {
      // Setup graceful shutdown handlers
      this.setupShutdownHandlers();

      // Handle different input modes
      if (!process.stdin.isTTY) {
        await this.handlePipeMode();
      } else {
        await this.handleInteractiveMode();
      }
    } catch (error) {
      console.error(`[SESSION] ${this.sessionId} error:`, error);
      await this.shutdown(1);
    }
  }

  /**
   * Handle pipe/non-TTY input (CI/CD, scripts)
   */
  private async handlePipeMode(): Promise<void> {
    if (process.env.MARIA_DEBUG === "1") {
      console.log(`[SESSION] ${this.sessionId} pipe mode started`);
    }

    const chunks: Buffer[] = [];

    try {
      // Read all input
      for await (const chunk of process.stdin) {
        chunks.push(chunk as Buffer);
      }

      // Process lines
      const lines = Buffer.concat(chunks)
        .toString("utf-8")
        .replace(/^\uFEFF/, "") // Strip BOM
        .split(/\r\n|\n|\r/) // Handle all line endings
        .map((line) => line.trim())
        .filter(Boolean); // Remove empty lines

      if (process.env.MARIA_DEBUG === "1") {
        console.log(
          `[SESSION] ${this.sessionId} processing ${lines.length} lines`,
        );
      }

      // Process each line through InputController
      for (const line of lines) {
        if (this.isExitCommand(line)) {
          break;
        }

        await this.input.acquire(async () => {
          await this.deps.onCommand(line);
        });
      }
    } finally {
      // Pause stdin to prevent further events
      try {
        process.stdin.pause();
      } catch {}
    }

    await this.shutdown(0);
  }

  /**
   * Handle interactive TTY mode
   */
  private async handleInteractiveMode(): Promise<void> {
    // Use provided readline interface or create one
    this.rl =
      this.deps.rl ??
      createInterface({
        input: stdin,
        output: stdout,
        terminal: true,
        historySize: 1000,
      });

    if (process.env.MARIA_DEBUG === "1") {
      console.log(`[SESSION] ${this.sessionId} interactive mode started`);
    }

    while (this.running && !this.shuttingDown) {
      try {
        const line = await this.readLineWithRawModeControl("> ");

        if (this.isExitCommand(line)) {
          break;
        }

        if (!line.trim()) {
          continue;
        }

        // Process through InputController for serialization
        await this.input.acquire(async () => {
          await this.deps.onCommand(line);
        });
      } catch (error) {
        if (this.isAbortError(error)) {
          console.log("\nGoodbye! =K");
          break;
        }
        console.error(`[SESSION] ${this.sessionId} input error:`, error);
      }
    }

    await this.shutdown(0);
  }

  /**
   * Read line with proper raw mode management
   * Critical for preventing TTY corruption
   */
  private async readLineWithRawModeControl(prompt: string): Promise<string> {
    const stdin = process.stdin as any;
    const wasRaw = stdin.isRaw === true;
    const hasSetRawMode = stdin.isTTY && typeof stdin.setRawMode === "function";

    try {
      if (hasSetRawMode) {
        stdin.setRawMode(false);
      }

      return new Promise<string>((resolve, reject) => {
        if (!this.rl) {
          reject(new Error("Readline interface not available"));
          return;
        }

        this.rl.question(prompt, (answer) => {
          resolve(answer.trim());
        });
      });
    } finally {
      // Always restore raw mode state
      if (hasSetRawMode && wasRaw) {
        try {
          stdin.setRawMode(true);
        } catch (e) {
          // Ignore restoration errors
        }
      }
    }
  }

  /**
   * Check if command is an exit command
   */
  private isExitCommand(line: string): boolean {
    const normalized = line.toLowerCase().trim();
    return (
      normalized === "exit" ||
      normalized === "/exit" ||
      normalized === "quit" ||
      normalized === "/quit"
    );
  }

  /**
   * Check if error is abort/SIGINT
   */
  private isAbortError(error: any): boolean {
    return (
      error?.code === "ABORT_ERR" ||
      error?.name === "AbortError" ||
      error?.message?.includes("aborted")
    );
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupShutdownHandlers(): void {
    const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGUSR2"];

    signals.forEach((signal) => {
      process.once(signal, () => {
        if (process.env.MARIA_DEBUG === "1") {
          console.log(`[SESSION] ${this.sessionId} received ${signal}`);
        }
        void this.shutdown(signal === "SIGINT" ? 130 : 143);
      });
    });

    // Handle uncaught errors
    process.once("uncaughtException", (error) => {
      console.error(`[SESSION] ${this.sessionId} uncaught exception:`, error);
      void this.shutdown(1);
    });
  }

  /**
   * Stop the session loop
   */
  async stop(): Promise<void> {
    if (!this.running) return;

    if (process.env.MARIA_DEBUG === "1") {
      console.log(`[SESSION] ${this.sessionId} stopping`);
    }

    this.running = false;
  }

  /**
   * Complete shutdown - idempotent and safe
   * NEVER calls process.exit() directly
   */
  async shutdown(code = 0): Promise<void> {
    if (this.shuttingDown) {
      return; // Idempotent
    }

    this.shuttingDown = true;

    if (process.env.MARIA_DEBUG === "1") {
      console.log(
        `[SESSION] ${this.sessionId} shutting down with code ${code}`,
      );
    }

    try {
      // Stop the session loop
      await this.stop();

      // Clear any queued operations
      this.input.clearQueue();

      // Close readline interface
      if (this.rl) {
        this.rl.close();
        this.rl = undefined;
      }

      // Release stdin ownership
      if ((globalThis as any).__MARIA_STDIN_OWNER === this.sessionId) {
        delete (globalThis as any).__MARIA_STDIN_OWNER;
      }

      // Call exit handler if provided
      await this.deps.onExit?.(code);
    } finally {
      // Set exit code but NEVER call process.exit()
      process.exitCode = code;
    }
  }

  /**
   * Get session metrics
   */
  getMetrics() {
    return {
      sessionId: this.sessionId,
      running: this.running,
      shuttingDown: this.shuttingDown,
      input: this.input.getMetrics(),
    };
  }

  /**
   * Get session ID for correlation
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Check if session is running
   */
  isRunning(): boolean {
    return this.running && !this.shuttingDown;
  }
}
