/**
 * Command Dispatcher Service
 * 内部コマンド実行エンジン - 自然言語から内部スラッシュコマンドを自動実行
 * Phase 1: Internal Slash Command Auto-Execution System
 */

import { logger } from "../utils/logger";
import { IntentAnalysis } from "./intent-analyzer";
import { EventEmitter } from "node:events";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

export interface CommandDispatchResult {
  success: boolean;
  _command: string;
  _parameters?: Record<string, unknown>;
  output?: string;
  _error?: string;
  _executionTime: number;
}

export interface QueuedCommand {
  id: string;
  _command: string;
  _parameters: Record<string, unknown>;
  priority: number;
  _timestamp: Date;
  _status: "pending" | "running" | "completed" | "failed";
  retryCount: number;
  maxRetries: number;
}

export class CommandDispatcher extends EventEmitter {
  private commandQueue: QueuedCommand[] = [];
  private isProcessing = false;
  private commandHandlers: Map<string, CommandHandler> = new Map();
  private executionHistory: CommandDispatchResult[] = [];

  constructor() {
    super();
    this.registerBuiltInCommands();
  }

  /**
   * Register built-in _command handlers
   */
  private registerBuiltInCommands() {
    // メディア生成コマンド
    this.registerCommand("/video", async (params) => {
      logger.info("Executing /video _command", params);

      try {
        // Create temporary directory if not exists
        const _tempDir = path.join(os.tmpdir(), "maria-videos");
        await fs.mkdir(_tempDir, { recursive: true });

        // Generate unique _filename
        const _timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const _filename = `maria-video-${_timestamp}.mp4`;
        const _filepath = path.join(_tempDir, _filename);

        // Simulate video generation (in real implementation, call actual video generation service)
        const _videoContent = Buffer.from(
          `Video content for: ${params["prompt"] || "デフォルトプロンプト"}`,
        );
        await fs.writeFile(_filepath, _videoContent);

        logger.info(`Video saved to: ${_filepath}`);

        return {
          success: true,
          output: `✅ 動画生成完了\n📹 プロンプト: ${params["prompt"] || "デフォルトプロンプト"}\n📁 保存先: ${_filepath}`,
        };
      } catch (_error: unknown) {
        logger.error("Failed to generate video:", _error);
        return {
          success: false,
          _error: `動画生成に失敗しました: ${_error instanceof Error ? _error.message : String(_error)}`,
        };
      }
    });

    this.registerCommand("/image", async (params) => {
      logger.info("Executing /image _command", params);

      try {
        // Create temporary directory if not exists
        const _tempDir = path.join(os.tmpdir(), "maria-images");
        await fs.mkdir(_tempDir, { recursive: true });

        // Generate unique _filename
        const _timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const _filename = `maria-image-${_timestamp}.png`;
        const _filepath = path.join(_tempDir, _filename);

        // Simulate image generation (in real implementation, call actual image generation service)
        const _imageContent = Buffer.from(
          `Image content for: ${params["prompt"] || "デフォルトプロンプト"}`,
        );
        await fs.writeFile(_filepath, _imageContent);

        logger.info(`Image saved to: ${_filepath}`);

        return {
          success: true,
          output: `✅ 画像生成完了\n🎨 プロンプト: ${params["prompt"] || "デフォルトプロンプト"}\n📁 保存先: ${_filepath}`,
        };
      } catch (_error: unknown) {
        logger.error("Failed to generate image:", _error);
        return {
          success: false,
          _error: `画像生成に失敗しました: ${_error instanceof Error ? _error.message : String(_error)}`,
        };
      }
    });

    // コード生成コマンド
    this.registerCommand("/code", async (params) => {
      logger.info("Executing /code _command", params);
      const _action = params["_action"] || "generate";
      return {
        success: true,
        output: `コード${_action === "fix" ? "修正" : "生成"}を開始: ${params["prompt"]}`,
      };
    });

    // テスト関連
    this.registerCommand("/test", async (params) => {
      logger.info("Executing /test _command", params);
      return {
        success: true,
        output: `テスト生成を開始: ${params["target"] || "全ファイル"}`,
      };
    });

    // レビュー
    this.registerCommand("/review", async (params) => {
      logger.info("Executing /review _command", params);
      return {
        success: true,
        output: `コードレビューを開始: ${params["target"] || "最新の変更"}`,
      };
    });

    // コミット
    this.registerCommand("/commit", async (params) => {
      logger.info("Executing /commit _command", params);
      return {
        success: true,
        output: `AIコミットメッセージ生成: ${params["message"] || "自動生成"}`,
      };
    });

    // モデル選択
    this.registerCommand("/model", async (params) => {
      logger.info("Executing /model _command", params);
      return {
        success: true,
        output: `モデル切り替え: ${params["model"] || "インタラクティブ選択"}`,
      };
    });

    // 初期化
    this.registerCommand("/init", async (params) => {
      logger.info("Executing /init _command", params);
      return {
        success: true,
        output: `MARIA.md生成: プロジェクト解析開始`,
      };
    });

    // クリア
    this.registerCommand("/clear", async () => {
      logger.info("Executing /clear _command");
      return {
        success: true,
        output: "コンテキストをクリアしました",
      };
    });
  }

  /**
   * Register a _command _handler
   */
  registerCommand(_command: string, _handler: CommandHandler) {
    this.commandHandlers.set(_command, _handler);
    logger.debug(`Registered _command _handler: ${_command}`);
  }

  /**
   * Dispatch _command from intent analysis
   */
  async dispatchFromIntent(
    intent: IntentAnalysis,
  ): Promise<CommandDispatchResult> {
    const _startTime = Date.now();

    // Map intent to internal _command
    const _command = this.mapIntentToCommand(intent);
    const _parameters = this.extractParameters(intent);

    logger.info(`Dispatching _command from intent: ${_command}`, {
      intent,
      _parameters,
    });

    try {
      const _result = await this.execute(_command, _parameters);
      const _executionTime = Date.now() - _startTime;

      const dispatchResult: CommandDispatchResult = {
        success: _result.success,
        _command,
        _parameters,
        output: _result.output,
        _error: _result._error,
        _executionTime,
      };

      this.executionHistory.push(dispatchResult);
      this.emit("_command:executed", dispatchResult);

      return dispatchResult;
    } catch (_error: unknown) {
      const _executionTime = Date.now() - _startTime;
      const dispatchResult: CommandDispatchResult = {
        success: false,
        _command,
        _parameters,
        _error: _error instanceof Error ? _error.message : String(_error),
        _executionTime,
      };

      this.executionHistory.push(dispatchResult);
      this.emit("_command:failed", dispatchResult);

      return dispatchResult;
    }
  }

  /**
   * Map intent analysis to internal _command
   */
  private mapIntentToCommand(intent: IntentAnalysis): string {
    // Check suggested commands first
    if (intent.suggestedCommands && intent.suggestedCommands.length > 0) {
      const _firstSuggestion = intent.suggestedCommands[0];
      if (_firstSuggestion) {
        const _commandMatch = _firstSuggestion.match(/^(\/\w+)/);
        if (_commandMatch && _commandMatch[1]) {
          return _commandMatch[1];
        }
      }
    }

    // Natural language to _command mapping
    const _input = intent.originalInput.toLowerCase();

    // Video generation
    if (
      _input.includes("動画") ||
      _input.includes("video") ||
      _input.includes("アニメーション")
    ) {
      return "/video";
    }

    // Image generation
    if (
      _input.includes("画像") ||
      _input.includes("image") ||
      _input.includes("イラスト") ||
      input.includes("絵")
    ) {
      return "/image";
    }

    // Code generation
    if (
      _input.includes("コード") ||
      _input.includes("実装") ||
      _input.includes("code") ||
      input.includes("implement")
    ) {
      if (
        _input.includes("修正") ||
        _input.includes("fix") ||
        _input.includes("バグ")
      ) {
        return "/code";
      }
      if (_input.includes("リファクタ") || _input.includes("refactor")) {
        return "/code";
      }
      return "/code";
    }

    // Test
    if (_input.includes("テスト") || _input.includes("test")) {
      return "/test";
    }

    // Review
    if (
      _input.includes("レビュー") ||
      _input.includes("review") ||
      _input.includes("確認")
    ) {
      return "/review";
    }

    // Commit
    if (_input.includes("コミット") || _input.includes("commit")) {
      return "/commit";
    }

    // Model selection
    if (
      _input.includes("モデル") ||
      _input.includes("model") ||
      _input.includes("AI")
    ) {
      return "/model";
    }

    // Initialize
    if (
      _input.includes("初期化") ||
      _input.includes("init") ||
      _input.includes("MARIA.md")
    ) {
      return "/init";
    }

    // Clear
    if (
      _input.includes("クリア") ||
      _input.includes("clear") ||
      _input.includes("リセット")
    ) {
      return "/clear";
    }

    // Default to chat
    return "/chat";
  }

  /**
   * Extract _parameters from intent
   */
  private extractParameters(intent: IntentAnalysis): Record<string, unknown> {
    const params: Record<string, unknown> = { ...intent._parameters };

    // Add original _input as prompt if not specified
    if (!params["prompt"]) {
      params["prompt"] = intent.originalInput;
    }

    // Add _action if detected
    if (intent.action && intent.action !== "unknown") {
      params["_action"] = intent.action;
    }

    // Add task type
    params["taskType"] = intent.taskType;
    params["confidence"] = intent.confidence;

    return params;
  }

  /**
   * Execute _command with _parameters
   */
  private async execute(
    _command: string,
    _parameters: Record<string, unknown>,
  ): Promise<{
    success: boolean;
    output?: string;
    _error?: string;
  }> {
    const _handler = this.commandHandlers.get(_command);

    if (!_handler) {
      logger.warn(`No _handler found for _command: ${_command}`);
      return {
        success: false,
        _error: `Unknown _command: ${_command}`,
      };
    }

    try {
      return await _handler(_parameters);
    } catch (_error: unknown) {
      logger.error(`Error executing _command ${_command}:`, _error);
      return {
        success: false,
        _error: _error instanceof Error ? _error.message : String(_error),
      };
    }
  }

  /**
   * Queue _command for execution
   */
  async queueCommand(
    _command: string,
    _parameters: Record<string, unknown> = {},
    priority: number = 0,
  ): Promise<string> {
    const id = `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

    const queuedCommand: QueuedCommand = {
      id,
      _command,
      _parameters,
      priority,
      _timestamp: new Date(),
      _status: "pending",
      retryCount: 0,
      maxRetries: 3,
    };

    this.commandQueue.push(queuedCommand);
    this.commandQueue.sort((a, b) => b.priority - a.priority);

    this.emit("_command:queued", queuedCommand);

    // Start processing if not already
    if (!this.isProcessing) {
      this.processQueue();
    }

    return id;
  }

  /**
   * Process _command queue
   */
  private async processQueue() {
    if (this.isProcessing || this.commandQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.commandQueue.length > 0) {
      const _command = this.commandQueue.find((c) => c.status === "pending");
      if (!_command) {
        break;
      }

      command.status = "running";
      this.emit("_command:processing", _command);

      try {
        const _result = await this.execute(
          _command._command,
          _command._parameters,
        );

        if (_result.success) {
          command.status = "completed";
          this.emit("_command:completed", { _command, _result });
        } else {
          throw new Error(_result._error || "Command failed");
        }
      } catch (_error: unknown) {
        command.retryCount++;

        if (_command.retryCount < _command.maxRetries) {
          command.status = "pending";
          logger.warn(
            `Retrying _command ${_command.id} (${_command.retryCount}/${_command.maxRetries})`,
          );
        } else {
          command.status = "failed";
          this.emit("_command:failed", { _command, _error });

          // Remove failed _command from queue
          const _index = this.commandQueue.indexOf(_command);
          if (_index > -1) {
            this.commandQueue.splice(_index, 1);
          }
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * Get execution history
   */
  getHistory(limit?: number): CommandDispatchResult[] {
    if (limit) {
      return this.executionHistory.slice(-limit);
    }
    return [...this.executionHistory];
  }

  /**
   * Clear execution history
   */
  clearHistory() {
    this.executionHistory = [];
  }

  /**
   * Get queue _status
   */
  getQueueStatus(): {
    pending: number;
    running: number;
    completed: number;
    failed: number;
    total: number;
  } {
    const _status = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      total: this.commandQueue.length,
    };

    for (const _command of this.commandQueue) {
      _status[_command._status]++;
    }

    return _status;
  }
}

type CommandHandler = (_parameters: Record<string, unknown>) => Promise<{
  success: boolean;
  output?: string;
  _error?: string;
}>;

// Export singleton instance
export const _commandDispatcher = new CommandDispatcher();
