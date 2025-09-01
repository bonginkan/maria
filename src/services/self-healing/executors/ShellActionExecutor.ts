/**
 * Shell Action Executor
 * Handles safe shell command execution for self-healing
 */

import { FixAction } from "../types";
import { logger } from "../../../utils/logger";
import { exec, ExecOptions } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export class ShellActionExecutor {
  private readonly ALLOWED_COMMANDS = [
    "pnpm install",
    "npm install",
    "pnpm i",
    "npm i",
    "pnpm install --dry-run",
    "npm install --dry-run",
  ];

  /**
   * Execute shell action
   */
  async execute(action: FixAction, options: { dryRun: boolean }): Promise<any> {
    const { type, args } = action;
    const [, operation] = type.split(":");

    switch (operation) {
      case "execute":
        return this.executeCommand(args.command, {
          fallback: args.fallback,
          timeout: args.timeout || 30000,
          dryRun: options.dryRun,
        });

      default:
        throw new Error(`Unknown shell operation: ${operation}`);
    }
  }

  /**
   * Execute shell command with safety checks
   */
  private async executeCommand(
    command: string,
    options: {
      fallback?: string;
      timeout?: number;
      dryRun?: boolean;
    },
  ): Promise<any> {
    const { fallback, timeout = 30000, dryRun = false } = options;

    // Validate command is allowed
    this.validateCommand(command);

    if (dryRun) {
      return {
        action: "would_execute",
        command,
        fallback,
        timeout,
      };
    }

    try {
      const result = await this.runCommand(command, timeout);

      logger.info(`Shell command succeeded: ${command}`);

      return {
        action: "executed",
        command,
        exitCode: 0,
        stdout: result.stdout,
        stderr: result.stderr,
        duration: result.duration,
      };
    } catch (error) {
      logger.warn(`Shell command failed: ${command}`, error);

      // Try fallback if available
      if (fallback && this.isCommandAllowed(fallback)) {
        try {
          logger.info(`Trying fallback command: ${fallback}`);
          const result = await this.runCommand(fallback, timeout);

          logger.info(`Fallback command succeeded: ${fallback}`);

          return {
            action: "executed_fallback",
            originalCommand: command,
            fallbackCommand: fallback,
            exitCode: 0,
            stdout: result.stdout,
            stderr: result.stderr,
            duration: result.duration,
          };
        } catch (fallbackError) {
          logger.error(
            `Fallback command also failed: ${fallback}`,
            fallbackError,
          );
          throw fallbackError;
        }
      }

      throw error;
    }
  }

  /**
   * Run command with timeout and capture output
   */
  private async runCommand(
    command: string,
    timeout: number,
  ): Promise<{ stdout: string; stderr: string; duration: number }> {
    const startTime = Date.now();

    const execOptions: ExecOptions = {
      timeout,
      cwd: process.cwd(),
      env: {
        ...process.env,
        // Ensure package managers use non-interactive mode
        CI: "true",
        NPM_CONFIG_PROGRESS: "false",
        NPM_CONFIG_LOGLEVEL: "error",
      },
    };

    try {
      const { stdout, stderr } = await execAsync(command, execOptions);
      const duration = Date.now() - startTime;

      return {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      // Enhance error with execution details
      const enhancedError = new Error(`Command failed: ${command}`);
      (enhancedError as any).originalError = error;
      (enhancedError as any).command = command;
      (enhancedError as any).exitCode = error.code || -1;
      (enhancedError as any).stdout = error.stdout || "";
      (enhancedError as any).stderr = error.stderr || "";
      (enhancedError as any).duration = duration;

      throw enhancedError;
    }
  }

  /**
   * Validate command is in allowlist
   */
  private validateCommand(command: string): void {
    if (!this.isCommandAllowed(command)) {
      throw new Error(`Command not allowed: ${command}`);
    }
  }

  /**
   * Check if command is allowed
   */
  private isCommandAllowed(command: string): boolean {
    const normalizedCommand = command.trim().toLowerCase();

    return this.ALLOWED_COMMANDS.some((allowed) => {
      const normalizedAllowed = allowed.toLowerCase();
      return (
        normalizedCommand === normalizedAllowed ||
        normalizedCommand.startsWith(normalizedAllowed + " ")
      );
    });
  }

  /**
   * Get command info for dry-run
   */
  getCommandInfo(command: string): {
    allowed: boolean;
    description: string;
    estimatedDuration: number;
    riskLevel: "low" | "medium" | "high";
  } {
    const info = {
      allowed: this.isCommandAllowed(command),
      description: this.getCommandDescription(command),
      estimatedDuration: this.getEstimatedDuration(command),
      riskLevel: this.getCommandRiskLevel(command) as "low" | "medium" | "high",
    };

    return info;
  }

  /**
   * Get human-readable command description
   */
  private getCommandDescription(command: string): string {
    const descriptions: Record<string, string> = {
      "pnpm install": "Install dependencies using pnpm",
      "npm install": "Install dependencies using npm",
      "pnpm i": "Install dependencies using pnpm (short form)",
      "npm i": "Install dependencies using npm (short form)",
      "pnpm install --dry-run": "Preview dependency installation with pnpm",
      "npm install --dry-run": "Preview dependency installation with npm",
    };

    const normalizedCommand = command.trim().toLowerCase();

    for (const [cmd, desc] of Object.entries(descriptions)) {
      if (normalizedCommand.startsWith(cmd.toLowerCase())) {
        return desc;
      }
    }

    return `Execute shell command: ${command}`;
  }

  /**
   * Get estimated duration for command
   */
  private getEstimatedDuration(command: string): number {
    const durations: Record<string, number> = {
      "pnpm install": 30000, // 30 seconds
      "npm install": 60000, // 60 seconds
      "pnpm i": 30000,
      "npm i": 60000,
      "pnpm install --dry-run": 10000, // 10 seconds
      "npm install --dry-run": 15000, // 15 seconds
    };

    const normalizedCommand = command.trim().toLowerCase();

    for (const [cmd, duration] of Object.entries(durations)) {
      if (normalizedCommand.startsWith(cmd.toLowerCase())) {
        return duration;
      }
    }

    return 30000; // Default 30 seconds
  }

  /**
   * Get command risk level
   */
  private getCommandRiskLevel(command: string): string {
    const riskLevels: Record<string, string> = {
      "pnpm install --dry-run": "low",
      "npm install --dry-run": "low",
      "pnpm install": "medium",
      "npm install": "medium",
      "pnpm i": "medium",
      "npm i": "medium",
    };

    const normalizedCommand = command.trim().toLowerCase();

    for (const [cmd, risk] of Object.entries(riskLevels)) {
      if (normalizedCommand.startsWith(cmd.toLowerCase())) {
        return risk;
      }
    }

    return "high"; // Unknown commands are high risk
  }
}
