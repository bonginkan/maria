/**
 * SlashCommandRouter
 * - コマンド登録と実行
 * - タイムボックス(deadline)と AbortSignal 伝播
 * - requiresInput のデフォルト false(interactive allowlist は例外)
 * - 構造化メトリクスのフック
 */

import { toCommandResult } from "../shared/types/result";
import type { CommandResult } from "../shared/types/result";
import type {
  HandlerContext,
  RouterOptions,
  RouterMetrics,
} from "../shared/types/context";
import { ERROR_CODES } from "../shared/types/result";
import { getCommandTimeout } from "../shared/config/command-settings";
import { contractGuard } from "./router/ContractGuard";

// コマンドハンドラ型
export type Handler = (
  args: string[],
  ctx: HandlerContext,
) => Promise<CommandResult>;

export class SlashCommandRouter {
  private handlers = new Map<string, Handler>();
  private interactiveAllow = new Set<string>();
  private systemCommandsV2 = new Set<string>(); // Track SystemCommand instances
  private timebox: Record<string, number>;
  private onFinish?: (meta: RouterMetrics) => void;

  constructor(opts?: RouterOptions) {
    // デフォルト:* = 5000ms
    this.timebox = { "*": 5000, ...(opts?.timebox || {}) };
    if (opts?.interactiveAllow) this.interactiveAllow = opts.interactiveAllow;

    // デバッグモードの場合のみonFinishコールバックを設定
    const isDebugMode =
      process.env.MARIA_DEBUG === "1" || process.env.MARIA_CODE_DEBUG === "1";
    if (opts?.onFinish && isDebugMode) {
      this.onFinish = opts.onFinish;
    }
  }

  /**
   * コマンドハンドラを登録
   */
  register(command: string, handler: Handler): void {
    this.handlers.set(command.toLowerCase(), handler);
  }

  /**
   * SystemCommandハンドラを登録(契約強制付き)
   */
  registerSystemV2(command: string, handler: Handler): void {
    const cmd = command.toLowerCase();
    this.handlers.set(cmd, handler);
    this.systemCommandsV2.add(cmd);
  }

  /**
   * 登録されているコマンドの一覧を取得
   */
  getCommands(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * コマンドを実行
   * - タイムアウト制御
   * - AbortSignal伝播
   * - requiresInput制御
   * - メトリクス記録
   */
  async execute(
    command: string,
    args: string[],
    ctx: HandlerContext,
  ): Promise<CommandResult> {
    const cmd = command.toLowerCase();
    const handler = this.handlers.get(cmd);

    if (!handler) {
      const msg = `Unknown command: ${command}`;
      const result = {
        ok: false,
        message: msg,
        requiresInput: false,
        endReason: "error",
        errorCode: ERROR_CODES.INVALID_INPUT,
        // Compatibility fields
        success: false,
        _success: false,
        _message: msg,
      } as any;

      // Track metrics for unknown commands too
      this.onFinish?.({
        command: cmd,
        latencyMs: 0,
        endReason: "error",
        ok: false,
        errorCode: ERROR_CODES.INVALID_INPUT,
      });

      return result;
    }

    const started = Date.now();
    const timeoutMs = getCommandTimeout(command);

    // Router の自前コントローラ(deadline)
    const controller = new AbortController();
    const signal = controller.signal;

    // 上位から渡された signal(存在すれば)も監視
    const parent = ctx.signal;
    const parentAbort = () => controller.abort();

    let tm: NodeJS.Timeout | undefined;

    try {
      // 親シグナルのチェックと連携
      if (parent) {
        if (parent.aborted) {
          controller.abort();
        } else {
          parent.addEventListener("abort", parentAbort, { once: true });
        }
      }

      // タイムボックス開始
      tm = setTimeout(() => controller.abort(), timeoutMs);

      // ハンドラ実行(新しいsignalを渡す)
      const raw = await handler(args, { ...ctx, signal });
      let res = toCommandResult(raw);

      // SystemCommand契約強制(副作用なし)
      if (this.systemCommandsV2.has(cmd)) {
        // SystemCommand: 厳密な契約ガード適用
        const guardedResult = contractGuard.enforceContract(res);
        res = { ...res, ...guardedResult };
      } else if (!this.interactiveAllow.has(cmd)) {
        // Legacy command: 従来通りの強制
        res = { ...res, requiresInput: false };
      }

      // endReason の補完
      if (!res.endReason) {
        res.endReason = res.ok
          ? "success"
          : signal.aborted
            ? "timeout"
            : "error";
      }

      // メトリクス記録
      this.onFinish?.({
        command: cmd,
        latencyMs: Date.now() - started,
        endReason: res.endReason,
        ok: res.ok,
        errorCode: res.errorCode,
      });

      // Add compatibility fields for legacy code
      const finalResult = {
        ...res,
        success: res.ok,
        _success: res.ok,
        _message: res.message,
      };

      // Add invisible termination marker for debugging
      if (
        process.env.MARIA_DEBUG === "1" ||
        process.env.MARIA_CODE_DEBUG === "1"
      ) {
        try {
          process.stdout.write(`\x1eEND:${cmd}\n`);
        } catch {}
      }

      return finalResult;
    } catch (e: any) {
      const isAbort = e?.name === "AbortError" || signal.aborted;
      const ok = false;
      const msg = isAbort
        ? `⏱️ Command timed out after ${timeoutMs}ms`
        : `❌ ${e?.message || "Unknown error"}`;

      const result: CommandResult & {
        success?: boolean;
        _success?: boolean;
        _message?: string;
      } = {
        ok,
        message: msg,
        requiresInput: false,
        endReason: isAbort ? "timeout" : "error",
        errorCode: isAbort
          ? ERROR_CODES.TIMEOUT
          : e?.code || ERROR_CODES.INTERNAL,
        // Compatibility fields
        success: ok,
        _success: ok,
        _message: msg,
      };

      // エラーメトリクス記録
      this.onFinish?.({
        command: cmd,
        latencyMs: Date.now() - started,
        endReason: result.endReason!,
        ok: false,
        errorCode: result.errorCode,
      });

      return result;
    } finally {
      // クリーンアップ
      if (tm) clearTimeout(tm);
      if (parent) parent.removeEventListener("abort", parentAbort);
    }
  }

  /**
   * ハンドラの存在確認
   */
  hasCommand(command: string): boolean {
    return this.handlers.has(command.toLowerCase());
  }

  /**
   * デバッグ用:登録状況を取得
   */
  getDebugInfo(): {
    commands: string[];
    interactiveCommands: string[];
    timeouts: Record<string, number>;
  } {
    return {
      commands: this.getCommands(),
      interactiveCommands: Array.from(this.interactiveAllow),
      timeouts: this.timebox,
    };
  }
}
