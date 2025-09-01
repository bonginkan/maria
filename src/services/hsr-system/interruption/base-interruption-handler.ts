// src/services/hsr-system/interruption/base-interruption-handler.ts
/**
 * Base Interruption Handler - Human-First Design
 * 人間が常に制御権を持つことを保証する基盤システム
 */

export enum InterruptionLevel {
  IMMEDIATE = "immediate", // 即座停止(データロス可能性)
  SAFE_PAUSE = "safe_pause", // 安全一時停止(再開可能)
  COMPLETE_STOP = "complete", // 現在タスク完了後停止
  ROLLBACK = "rollback", // 状態をロールバック
}

export enum InterruptionSource {
  ESC_KEY = "esc_key",
  NATURAL_LANGUAGE = "natural_language",
  TIMEOUT = "timeout",
  USER_COMMAND = "user_command",
  SYSTEM_SAFETY = "system_safety",
}

export interface InterruptionAction {
  source: InterruptionSource;
  level: InterruptionLevel;
  originalInput: string;
  timestamp: number;
  processId: string;
  interpretation: string;
  suggestedAction: string;
  confidence: number;
  humanConfirmationRequired: boolean;
}

export interface InterruptionResponse {
  success: boolean;
  action: InterruptionLevel;
  message: string;
  canResume: boolean;
  rollbackAvailable: boolean;
  partialResults?: any;
}

// For compatibility with new interruption types
export interface SimpleInterruptionResponse {
  acknowledged: boolean;
  timestamp: Date;
  action: string;
  resumeCapable: boolean;
  message?: string;
}

/**
 * Base Interruption Handler
 * すべてのHSRプロセスで人間介入を可能にする基盤クラス
 */
export abstract class BaseInterruptionHandler {
  private readonly emergencyStopTimeout = 10; // 10ms以内にESC応答
  private activeProcesses: Map<string, ProcessState> = new Map();

  constructor(
    private processId: string = `hsr-${Date.now()}`,
    private processName: string = "HSR Process",
    private isStoppable: boolean = true,
  ) {
    this.setupEmergencyHandlers();
  }

  /**
   * 緊急停止ハンドラーの設定
   * ESCキーは最優先で処理される
   */
  private setupEmergencyHandlers(): void {
    // ESCキー緊急停止
    process.on("SIGINT", async () => {
      await this.handleEmergencyStop("ESC_KEY", "SIGINT received");
    });

    // Ctrl+C緊急停止 (テスト環境では無効)
    try {
      if (
        process.stdin &&
        typeof process.stdin.setRawMode === "function" &&
        process.stdin.isTTY
      ) {
        process.stdin.setRawMode(true);
        process.stdin.on("keypress", async (_str, key) => {
          if (key && key.name === "escape") {
            await this.handleEmergencyStop("ESC_KEY", "ESC key pressed");
          }
        });
      }
    } catch (_error) {
      // テスト環境やCI環境ではキーボード制御は利用不可
      // 本番環境でのみ動作するため、エラーは無視
    }
  }

  /**
   * 緊急停止処理(10ms以内応答保証)
   */
  private async handleEmergencyStop(
    source: string,
    reason: string,
  ): Promise<void> {
    const _startTime = Date.now();

    try {
      console.log(`
{err('🛑 EMERGENCY STOP ACTIVATED')}
{brand(' HRS ')}{muted('│')}{heading('Human Emergency Intervention')}
{accent('━━ ')}{heading('Process')}: ${this.processName}
{accent('━━ ')}{heading('Trigger')}: ${source}
{accent('━━ ')}{heading('Reason')}: ${reason}
{accent('━━ ')}{heading('Status')}: {err('STOPPING IMMEDIATELY...')}
      `);

      // 即座停止実行
      await this.executeImmediateStop();

      const _responseTime = Date.now() - _startTime;

      console.log(`
{ok('✅ EMERGENCY STOP COMPLETED')}
{accent('━━ ')}{heading('Response Time')}: ${_responseTime}ms
{accent('━━ ')}{heading('Human Safety')}: {ok('PRESERVED')}
{accent('━━ ')}{heading('Process State')}: {ok('SAFELY STOPPED')}
{muted('Process terminated by human authority')}
      `);
    } catch (_error) {
      console._error(`
{err('❌ EMERGENCY STOP FAILED')}
{accent('━━ ')}{heading('Error')}: ${_error.message}
{accent('━━ ')}{heading('Fallback')}: Force terminating process
      `);
      process.exit(1);
    }
  }

  /**
   * 自然言語による中断処理
   */
  async processNaturalLanguageInterruption(
    input: string,
  ): Promise<InterruptionAction> {
    const _patterns = {
      immediate: [
        "止めて",
        "やめて",
        "ストップ",
        "stop",
        "やめろ",
        "中断",
        "緊急停止",
        "強制終了",
      ],
      pause: [
        "待って",
        "ちょっと待って",
        "ちょっと",
        "pause",
        "一時停止",
        "hold",
        "wait",
        "まって",
      ],
      restart: [
        "やり直し",
        "やり直して",
        "restart",
        "reset",
        "最初から",
        "もう一度",
        "リスタート",
      ],
      explain: [
        "何してる",
        "何やってる",
        "説明して",
        "explain",
        "状況は",
        "進捗は",
        "どうなってる",
      ],
    };

    // パターンマッチング
    const _cleanInput = input.toLowerCase().trim();
    let matchedLevel = InterruptionLevel.SAFE_PAUSE;
    let interpretation = "不明な要求";
    let confidence = 0;

    // 即座停止パターン
    if (_patterns.immediate.some((pattern) => _cleanInput.includes(pattern))) {
      matchedLevel = InterruptionLevel.IMMEDIATE;
      interpretation = "即座停止要求";
      confidence = 0.95;
    }
    // 一時停止パターン
    else if (_patterns.pause.some((pattern) => _cleanInput.includes(pattern))) {
      matchedLevel = InterruptionLevel.SAFE_PAUSE;
      interpretation = "安全一時停止要求";
      confidence = 0.9;
    }
    // やり直しパターン
    else if (
      _patterns.restart.some((pattern) => _cleanInput.includes(pattern))
    ) {
      matchedLevel = InterruptionLevel.ROLLBACK;
      interpretation = "プロセスリセット要求";
      confidence = 0.85;
    }
    // 説明要求パターン
    else if (
      _patterns.explain.some((pattern) => _cleanInput.includes(pattern))
    ) {
      matchedLevel = InterruptionLevel.SAFE_PAUSE;
      interpretation = "状況説明要求";
      confidence = 0.8;
    }

    return {
      source: InterruptionSource.NATURAL_LANGUAGE,
      level: matchedLevel,
      originalInput: input,
      timestamp: Date.now(),
      processId: this.processId,
      interpretation: interpretation,
      suggestedAction: this.getSuggestedAction(matchedLevel),
      confidence: confidence,
      humanConfirmationRequired: confidence < 0.8,
    };
  }

  private getSuggestedAction(level: InterruptionLevel): string {
    switch (level) {
      case InterruptionLevel.IMMEDIATE:
        return "即座にプロセスを停止";
      case InterruptionLevel.SAFEPAUSE:
        return "安全にプロセスを一時停止";
      case InterruptionLevel.COMPLETE_STOP:
        return "現在の処理完了後に停止";
      case InterruptionLevel.ROLLBACK:
        return "プロセスをリセットして最初から";
      default:
        return "安全な停止を実行";
    }
  }

  /**
   * 中断確認UIの表示
   */
  protected displayInterruptionConfirmation(action: InterruptionAction): void {
    console.log(`
{err('🛑')} {brand(' HUMAN INTERVENTION ')}{err('🛑')}
{accent('━━ ')}{heading('検出された指示')}: "${action.originalInput}"
{accent('━━ ')}{heading('解釈')}: ${action.interpretation}
{accent('━━ ')}{heading('信頼度')}: ${Math.floor(action.confidence * 100)}%
{accent('━━ ')}{heading('提案アクション')}: ${action.suggestedAction}
${
  action.humanConfirmationRequired
    ? `{warn('⚠️ 確認が必要です(信頼度が低いため)')}`
    : `{ok('✅ 高信頼度で実行可能')}`
}
{accent('━━ ')}{heading('Safe Stop Options')}:
  {ok('[Y]')} 提案アクションを実行
  {ok('[N]')} 別の選択肢を表示
  {ok('[C]')} 操作を続行
  {ok('[E]')} 詳細説明を表示
{muted('Y/N/C/E で選択, Enter確定')}
    `);
  }

  /**
   * Create interruption action
   */
  async createInterruption(_type: string, reason: string): Promise<any> {
    return {
      type: "",
      reason,
      timestamp: new Date(),
      priority: _type === "EMERGENCY_STOP" ? "CRITICAL" : "HIGH",
    };
  }

  /**
   * Process interruption (override in subclasses)
   */
  protected async processInterruption(interruption: unknown): Promise<any> {
    return {
      acknowledged: true,
      timestamp: new Date(),
      action: interruption.type,
      resumeCapable: interruption.type !== "EMERGENCY_STOP",
    };
  }

  // 抽象メソッド - 各実装で定義
  abstract executeImmediateStop(): Promise<InterruptionResponse>;
  abstract executeSafePause(): Promise<InterruptionResponse>;
  abstract executeRollback(): Promise<InterruptionResponse>;
  abstract getProcessState(): ProcessState;
}

interface ProcessState {
  id: string;
  name: string;
  status: "running" | "paused" | "stopped" | "_error";
  _startTime: number;
  progress: number;
  canResume: boolean;
  hasPartialResults: boolean;
  backupAvailable: boolean;
}
