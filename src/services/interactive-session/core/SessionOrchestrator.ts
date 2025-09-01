/**
 * SessionOrchestrator - セッション統合コーディネーター
 *
 * 全サービスを統合し、InteractiveSessionの中核ロジックを管理
 * 依存性注入とライフサイクル管理を担当
 */

import { SessionManager } from "./SessionManager";
import { SessionStateMachine } from "./SessionStateMachine";

// Adapters
import { ReadlineAdapter } from "../adapters/ReadlineAdapter";
import { ChalkAdapter } from "../adapters/ChalkAdapter";

// Services
import { MemoryService } from "../services/MemoryService";
import { ConfigService } from "../services/ConfigService";
import { RouterService } from "../services/RouterService";
import { ValidationService } from "../services/ValidationService";
import { ApprovalService } from "../services/ApprovalService";
import { CommandRegistry } from "../services/CommandRegistry";

// Display Layer
import { DisplayManager } from "../display/DisplayManager";
import { SpinnerManager } from "../display/SpinnerManager";
import { StatusDisplay } from "../display/StatusDisplay";

// Input Layer
import { InputController } from "../input/InputController";

// Handlers
import { CoreHandlers } from "../handlers/CoreHandlers";
import { DevHandlers } from "../handlers/DevHandlers";
import { SystemHandlers } from "../handlers/SystemHandlers";

// Types
import type { IMaria } from "@/types/maria.types";

export interface OrchestratorConfig {
  memory?: {
    enablePersistence?: boolean;
    maxMemoryUsage?: number;
  };
  ui?: {
    theme?: string;
    showDebugInfo?: boolean;
  };
  behavior?: {
    autoApproval?: boolean;
    commandTimeout?: number;
  };
  validation?: {
    strictMode?: boolean;
    maxInputLength?: number;
  };
}

export interface SessionContext {
  maria: IMaria;
  sessionId: string;
  startTime: Date;
  user?: {
    name?: string;
    preferences?: Record<string, any>;
  };
}

export class SessionOrchestrator {
  // Core Services
  private _sessionManager: SessionManager | null = null;
  private _stateMachine: SessionStateMachine | null = null;

  // Business Services
  private _memoryService: MemoryService | null = null;
  private _configService: ConfigService | null = null;
  private _routerService: RouterService | null = null;
  private _validationService: ValidationService | null = null;
  private _approvalService: ApprovalService | null = null;
  private _commandRegistry: CommandRegistry | null = null;

  // UI Services
  private _displayManager: DisplayManager | null = null;
  private _spinnerManager: SpinnerManager | null = null;
  private _statusDisplay: StatusDisplay | null = null;
  private _inputController: InputController | null = null;

  // Adapters
  private _readlineAdapter: ReadlineAdapter | null = null;
  private _chalkAdapter: ChalkAdapter | null = null;

  // Handlers
  private _coreHandlers: CoreHandlers | null = null;
  private _devHandlers: DevHandlers | null = null;
  private _systemHandlers: SystemHandlers | null = null;

  // State
  private _context: SessionContext;
  private _config: OrchestratorConfig;
  private _initialized = false;
  private _running = false;

  constructor(context: SessionContext, config?: OrchestratorConfig) {
    this._context = context;
    this._config = config || {};
  }

  /**
   * オーケストレーターの初期化
   */
  async initialize(): Promise<void> {
    if (this._initialized) {
      return;
    }

    try {
      // 1. 基盤サービスの初期化
      await this.initializeFoundationServices();

      // 2. ビジネスサービスの初期化
      await this.initializeBusinessServices();

      // 3. UIサービスの初期化
      await this.initializeUIServices();

      // 4. ハンドラーの初期化
      await this.initializeHandlers();

      // 5. コマンドレジストリの設定
      await this.setupCommandRegistry();

      // 6. セッションマネージャーの初期化
      await this.initializeSessionManager();

      this._initialized = true;
    } catch (error) {
      // 初期化失敗時のクリーンアップ
      await this.cleanup();
      throw new Error(`SessionOrchestrator initialization failed: ${error}`);
    }
  }

  /**
   * 基盤サービスの初期化
   */
  private async initializeFoundationServices(): Promise<void> {
    // 設定サービス(最優先)
    this._configService = new ConfigService();
    await this._configService.initialize();

    // 検証サービス
    this._validationService = new ValidationService({
      maxInputLength: this._config.validation?.maxInputLength,
      strictMode: this._config.validation?.strictMode,
    });

    // メモリサービス
    this._memoryService = new MemoryService({
      system2: {
        persistenceEnabled: this._config.memory?.enablePersistence,
        maxLongTermMemory: this._config.memory?.maxMemoryUsage,
      },
    });

    await this._memoryService.initialize(this._context.maria);
  }

  /**
   * ビジネスサービスの初期化
   */
  private async initializeBusinessServices(): Promise<void> {
    // ルーターサービス
    this._routerService = new RouterService({
      enableContextualRouting: true,
      enableSmartSuggestions: true,
    });
    await this._routerService.initialize(this._context.maria);

    // 承認サービス
    this._approvalService = new ApprovalService({
      autoApproveThreshold: this._config.behavior?.autoApproval
        ? "medium"
        : "none",
      defaultTimeout: this._config.behavior?.commandTimeout,
    });
    await this._approvalService.initialize(this._context.maria);

    // コマンドレジストリ
    this._commandRegistry = new CommandRegistry();
  }

  /**
   * UIサービスの初期化
   */
  private async initializeUIServices(): Promise<void> {
    // アダプターの初期化
    this._readlineAdapter = new ReadlineAdapter();
    this._chalkAdapter = new ChalkAdapter();

    // ディスプレイサービス
    this._displayManager = new DisplayManager();
    this._spinnerManager = SpinnerManager.getInstance();

    // ステータス表示
    this._statusDisplay = new StatusDisplay();

    // 入力コントローラー
    this._inputController = new InputController(
      this._readlineAdapter,
      this._validationService!,
      this._routerService!,
    );

    // 状態機械
    this._stateMachine = new SessionStateMachine();
  }

  /**
   * ハンドラーの初期化
   */
  private async initializeHandlers(): Promise<void> {
    if (!this._displayManager || !this._statusDisplay || !this._memoryService) {
      throw new Error("Required services not initialized");
    }

    // コアハンドラー
    this._coreHandlers = new CoreHandlers(
      this._displayManager,
      this._statusDisplay,
    );

    // 開発ハンドラー
    this._devHandlers = new DevHandlers(this._displayManager);

    // システムハンドラー
    this._systemHandlers = new SystemHandlers(
      this._displayManager,
      this._memoryService,
    );
  }

  /**
   * コマンドレジストリの設定
   */
  private async setupCommandRegistry(): Promise<void> {
    if (
      !this._commandRegistry ||
      !this._coreHandlers ||
      !this._devHandlers ||
      !this._systemHandlers
    ) {
      throw new Error("Required components not initialized");
    }

    // コアコマンドの登録
    this._commandRegistry.register(
      "help",
      this._coreHandlers.handleHelp.bind(this._coreHandlers),
    );
    this._commandRegistry.register(
      "status",
      this._coreHandlers.handleStatus.bind(this._coreHandlers),
    );
    this._commandRegistry.register(
      "exit",
      this._coreHandlers.handleExit.bind(this._coreHandlers),
    );
    this._commandRegistry.register(
      "clear",
      this._coreHandlers.handleClear.bind(this._coreHandlers),
    );

    // システムコマンドの登録
    this._commandRegistry.register(
      "memory",
      this._systemHandlers.handleMemory.bind(this._systemHandlers),
    );
    this._commandRegistry.register(
      "health",
      this._systemHandlers.handleHealth.bind(this._systemHandlers),
    );
    this._commandRegistry.register(
      "config",
      this._systemHandlers.handleConfig.bind(this._systemHandlers),
    );

    // 開発コマンドの登録
    this._commandRegistry.register(
      "debug",
      this._devHandlers.handleDebug.bind(this._devHandlers),
    );
    this._commandRegistry.register(
      "inspect",
      this._devHandlers.handleInspect.bind(this._devHandlers),
    );
  }

  /**
   * セッションマネージャーの初期化
   */
  private async initializeSessionManager(): Promise<void> {
    if (
      !this._inputController ||
      !this._displayManager ||
      !this._commandRegistry ||
      !this._stateMachine
    ) {
      throw new Error("Required components not initialized");
    }

    this._sessionManager = new SessionManager(
      this._inputController,
      this._displayManager,
      this._commandRegistry,
      this._stateMachine,
    );
  }

  /**
   * セッションの開始
   */
  async start(): Promise<void> {
    if (!this._initialized) {
      throw new Error("SessionOrchestrator not initialized");
    }

    if (this._running) {
      throw new Error("Session already running");
    }

    try {
      this._running = true;

      // ウェルカムメッセージの表示
      await this.showWelcome();

      // セッションマネージャーの開始
      if (this._sessionManager) {
        await this._sessionManager.start();
      }
    } catch (error) {
      this._running = false;
      throw error;
    }
  }

  /**
   * セッションの停止
   */
  async stop(): Promise<void> {
    if (!this._running) {
      return;
    }

    try {
      this._running = false;

      // セッションマネージャーの停止
      if (this._sessionManager) {
        await this._sessionManager.stop();
      }

      // さよならメッセージの表示
      await this.showGoodbye();

      // クリーンアップ
      await this.cleanup();
    } catch (error) {
      console.error("Error during session stop:", error);
    }
  }

  /**
   * ウェルカムメッセージの表示
   */
  private async showWelcome(): Promise<void> {
    if (!this._displayManager) return;

    await this._displayManager.print("🤖 MARIA Interactive Session v3.5.0");
    await this._displayManager.print(
      "Type /help for available commands or just start typing...",
    );
    await this._displayManager.print("");
  }

  /**
   * さよならメッセージの表示
   */
  private async showGoodbye(): Promise<void> {
    if (!this._displayManager) return;

    await this._displayManager.print("");
    await this._displayManager.print(
      "👋 Session ended. Thank you for using MARIA!",
    );
  }

  /**
   * セッション統計の取得
   */
  getSessionStats(): {
    sessionId: string;
    uptime: number;
    memoryUsage: any;
    commandsExecuted: number;
    errorsOccurred: number;
  } {
    const uptime = Date.now() - this._context.startTime.getTime();

    return {
      sessionId: this._context.sessionId,
      uptime,
      memoryUsage: this._memoryService?.getStatus(),
      commandsExecuted: this._commandRegistry?.getExecutionCount() || 0,
      errorsOccurred: 0, // TODO: エラーカウンターの実装
    };
  }

  /**
   * 設定の取得
   */
  getConfig<T = any>(path: string): T | undefined {
    return this._configService?.getNestedValue(path);
  }

  /**
   * 設定の更新
   */
  async setConfig(path: string, value: any): Promise<void> {
    if (this._configService) {
      await this._configService.setNestedValue(path, value);
    }
  }

  /**
   * サービスの取得(テスト用)
   */
  getService<T>(
    serviceType: "memory" | "config" | "router" | "validation" | "approval",
  ): T | null {
    const serviceMap = {
      memory: this._memoryService,
      config: this._configService,
      router: this._routerService,
      validation: this._validationService,
      approval: this._approvalService,
    };

    return serviceMap[serviceType] as T | null;
  }

  /**
   * クリーンアップ
   */
  private async cleanup(): Promise<void> {
    const cleanupTasks = [];

    // 各サービスのシャットダウン
    if (this._spinnerManager) {
      cleanupTasks.push(this._spinnerManager.cleanup());
    }

    if (this._memoryService) {
      cleanupTasks.push(this._memoryService.shutdown());
    }

    if (this._routerService) {
      cleanupTasks.push(this._routerService.shutdown());
    }

    if (this._approvalService) {
      cleanupTasks.push(this._approvalService.shutdown());
    }

    if (this._configService) {
      cleanupTasks.push(this._configService.save());
    }

    if (this._readlineAdapter) {
      cleanupTasks.push(this._readlineAdapter.cleanup());
    }

    // 並行してクリーンアップ実行
    await Promise.allSettled(cleanupTasks);

    // 参照のクリア
    this._sessionManager = null;
    this._stateMachine = null;
    this._memoryService = null;
    this._configService = null;
    this._routerService = null;
    this._validationService = null;
    this._approvalService = null;
    this._commandRegistry = null;
    this._displayManager = null;
    this._spinnerManager = null;
    this._statusDisplay = null;
    this._inputController = null;
    this._readlineAdapter = null;
    this._chalkAdapter = null;
    this._coreHandlers = null;
    this._devHandlers = null;
    this._systemHandlers = null;

    this._initialized = false;
    this._running = false;
  }

  /**
   * 初期化状態の確認
   */
  get isInitialized(): boolean {
    return this._initialized;
  }

  /**
   * 実行状態の確認
   */
  get isRunning(): boolean {
    return this._running;
  }

  /**
   * セッションコンテキストの取得
   */
  get context(): SessionContext {
    return { ...this._context };
  }
}
