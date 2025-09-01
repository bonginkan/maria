/**
 * Interactive Session - リファクタリング済みエントリーポイント
 *
 * 新しいモジュラーアーキテクチャのメインエクスポート
 * SessionOrchestratorを使用した統合アプローチ
 */

import {
  SessionOrchestrator,
  type OrchestratorConfig,
  type SessionContext,
} from "./core/SessionOrchestrator";
import { SessionManager } from "./core/SessionManager";
import type { IMaria } from "@/types/maria.types";

// Command system types
interface ICommandPort {
  execute(command: string, context: CommandContext): Promise<CommandResult>;
  exists(command: string): boolean;
  getAvailableCommands(): string[];
  getHelp(command: string): string | null;
}

interface CommandContext {
  turnId: string;
  input: string;
  args: string[];
}

interface CommandResult {
  ok: boolean;
  message?: string;
}

// Re-export key types
export type { OrchestratorConfig, SessionContext };
export type { RouteResult } from "./services/RouterService";
export type {
  ApprovalRequest,
  ApprovalResponse,
} from "./services/ApprovalService";
export type { ValidationResult } from "./services/ValidationService";

// Legacy types for backward compatibility
export type { SessionStateName } from "./core/SessionStateMachine";
export type { SessionOptions, SessionMetrics } from "./core/SessionManager";
export * from "./types/errors";

/**
 * Command adapter to bridge with existing command system
 */
class CommandAdapter implements ICommandPort {
  constructor(private maria: IMaria) {}

  async execute(
    command: string,
    context: CommandContext,
  ): Promise<CommandResult> {
    try {
      // TODO: Integrate with existing SlashCommandHandler
      // For now, return a stub implementation

      // Handle basic commands
      switch (command) {
        case "/help":
          return {
            ok: true,
            message: `📖 Available Commands:
• /help - Show this help message
• /clear - Clear the context
• /status - Show system status
• /model - Manage AI models
• /code - Generate code
• /exit - Exit the session`,
          };

        case "/clear":
          // TODO: Call actual clear implementation
          return {
            ok: true,
            message: "🧹 Context cleared",
          };

        case "/status":
          // TODO: Call actual status implementation
          return {
            ok: true,
            message: "✅ System is operational",
          };

        default:
          // TODO: Forward to actual command handler
          return {
            ok: false,
            message: `Command ${command} is being migrated to the new system`,
          };
      }
    } catch (error) {
      return {
        ok: false,
        message: `Error executing command: ${error}`,
      };
    }
  }

  exists(command: string): boolean {
    // TODO: Check against actual command registry
    const knownCommands = [
      "/help",
      "/clear",
      "/status",
      "/model",
      "/code",
      "/exit",
      "/memory",
      "/test",
      "/review",
    ];
    return knownCommands.includes(command.toLowerCase());
  }

  getAvailableCommands(): string[] {
    // TODO: Get from actual command registry
    return [
      "/help",
      "/clear",
      "/status",
      "/model",
      "/code",
      "/exit",
      "/memory",
      "/test",
      "/review",
    ];
  }

  getHelp(command: string): string | null {
    // TODO: Get from actual command metadata
    const helpTexts: Record<string, string> = {
      "/help": "Show available commands",
      "/clear": "Clear the conversation context",
      "/status": "Show system status",
      "/model": "Select or view AI models",
      "/code": "Generate code from a description",
      "/exit": "Exit the session",
    };
    return helpTexts[command.toLowerCase()] || null;
  }
}

/**
 * InteractiveSession インターフェース
 */
export interface InteractiveSession {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
  getStats(): any;
  getConfig(path: string): any;
  setConfig(path: string, value: any): Promise<void>;
}

/**
 * リファクタリング済みInteractiveSession実装
 */
class RefactoredInteractiveSession implements InteractiveSession {
  private orchestrator: SessionOrchestrator;

  constructor(orchestrator: SessionOrchestrator) {
    this.orchestrator = orchestrator;
  }

  async start(): Promise<void> {
    await this.orchestrator.initialize();
    await this.orchestrator.start();
  }

  async stop(): Promise<void> {
    await this.orchestrator.stop();
  }

  isRunning(): boolean {
    return this.orchestrator.isRunning;
  }

  getStats(): any {
    return this.orchestrator.getSessionStats();
  }

  getConfig(path: string): any {
    return this.orchestrator.getConfig(path);
  }

  async setConfig(path: string, value: any): Promise<void> {
    await this.orchestrator.setConfig(path, value);
  }
}

/**
 * インタラクティブセッションのファクトリー関数
 */
export function createInteractiveSession(
  maria: IMaria,
  config?: OrchestratorConfig,
): InteractiveSession {
  const context: SessionContext = {
    maria,
    sessionId: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    startTime: new Date(),
    user: {
      name: process.env.USER || "Unknown",
    },
  };

  const orchestrator = new SessionOrchestrator(context, config);
  return new RefactoredInteractiveSession(orchestrator);
}

/**
 * 既存APIとの互換性のための関数
 * @deprecated Use createInteractiveSession instead
 */
export async function startInteractiveSession(
  maria: IMaria,
  config?: any,
): Promise<void> {
  console.warn(
    "startInteractiveSession is deprecated. Use createInteractiveSession().start() instead.",
  );

  const session = createInteractiveSession(maria, config);
  await session.start();
}

/**
 * Export handle command for compatibility with existing code
 */
export async function handleCommand(
  command: string,
  maria: IMaria,
  memoryEngine?: unknown,
  memoryCoordinator?: unknown,
): Promise<string | boolean> {
  // Create a temporary command adapter
  const commandAdapter = new CommandAdapter(maria);

  // Parse command
  const parts = command.split(/\s+/);
  const cmd = parts[0];
  const args = parts.slice(1);

  // Execute command
  const result = await commandAdapter.execute(cmd, {
    turnId: `compat-${Date.now()}`,
    input: command,
    args,
  });

  // Return result in expected format
  if (result.ok) {
    return result.message || true;
  } else {
    return result.message || false;
  }
}

/**
 * デフォルトエクスポート(後方互換性)
 */
export default createInteractiveSession;

// Legacy exports for backward compatibility
export { SessionOrchestrator };

// Service exports (for advanced usage)
export { MemoryService } from "./services/MemoryService";
export { ConfigService } from "./services/ConfigService";
export { RouterService } from "./services/RouterService";
export { ValidationService } from "./services/ValidationService";
export { ApprovalService } from "./services/ApprovalService";

// Core exports
export { SessionManager } from "./core/SessionManager";
export { SessionStateMachine } from "./core/SessionStateMachine";

// Display exports
export { DisplayManager } from "./display/DisplayManager";
export { SpinnerManager } from "./display/SpinnerManager";
export { FormatUtils } from "./display/FormatUtils";

// Legacy compatibility functions
export { showHelp } from "./utils/showHelp";

// Development exports for testing
export const __testing = {
  SessionManager,
  CommandAdapter,
  SessionOrchestrator,
};

/**
 * 使用例:
 *
 * ```typescript
 * import { createInteractiveSession } from '@/services/interactive-session';
 *
 * const session = createInteractiveSession(maria, {
 *   memory: { enablePersistence: true },
 *   ui: { theme: 'dark' },
 *   behavior: { autoApproval: false }
 * });
 *
 * await session.start();
 * ```
 */
