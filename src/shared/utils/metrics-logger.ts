/**
 * メトリクスロガー
 * コマンド実行のメトリクスを構造化ログとして出力
 */

import type { RouterMetrics } from "../types/context";

/**
 * メトリクスを構造化ログとして出力
 */
export function logMetrics(metrics: RouterMetrics): void {
  // デバッグモードまたはコード開発モードでのみログ出力
  if (process.env.MARIA_DEBUG !== "1" && process.env.MARIA_CODE_DEBUG !== "1") {
    return;
  }

  const line = JSON.stringify({
    t: new Date().toISOString(),
    cmd: metrics.command,
    ms: metrics.latencyMs,
    end: metrics.endReason,
    ok: metrics.ok,
    err: metrics.errorCode || null,
  });

  // eslint-disable-next-line no-console
  console.log(`[router] ${line}`);
}

/**
 * エラーログを構造化形式で出力
 */
export function logError(
  command: string,
  error: Error,
  context?: Record<string, unknown>,
): void {
  const line = JSON.stringify({
    t: new Date().toISOString(),
    level: "error",
    cmd: command,
    msg: error.message,
    stack: error.stack,
    ...context,
  });

  // eslint-disable-next-line no-console
  console.error(`[error] ${line}`);
}

/**
 * デバッグログを構造化形式で出力
 */
export function logDebug(
  message: string,
  data?: Record<string, unknown>,
): void {
  if (process.env.MARIA_DEBUG !== "1") return;

  const line = JSON.stringify({
    t: new Date().toISOString(),
    level: "debug",
    msg: message,
    ...data,
  });

  // eslint-disable-next-line no-console
  console.log(`[debug] ${line}`);
}

/**
 * パフォーマンスメトリクスを記録
 */
export class PerformanceTracker {
  private marks = new Map<string, number>();

  /**
   * 計測開始
   */
  start(label: string): void {
    this.marks.set(label, performance.now());
  }

  /**
   * 計測終了して結果を返す
   */
  end(label: string): number | null {
    const start = this.marks.get(label);
    if (!start) return null;

    const duration = performance.now() - start;
    this.marks.delete(label);

    logDebug(`Performance: ${label}`, {
      label,
      duration_ms: Math.round(duration),
    });

    return duration;
  }

  /**
   * リセット
   */
  reset(): void {
    this.marks.clear();
  }
}

/**
 * コマンド実行統計を収集
 */
export class CommandStats {
  private stats = new Map<
    string,
    {
      count: number;
      totalMs: number;
      errors: number;
      timeouts: number;
    }
  >();

  /**
   * メトリクスを記録
   */
  record(metrics: RouterMetrics): void {
    const stats = this.stats.get(metrics.command) || {
      count: 0,
      totalMs: 0,
      errors: 0,
      timeouts: 0,
    };

    stats.count++;
    stats.totalMs += metrics.latencyMs;

    if (!metrics.ok) {
      stats.errors++;
      if (metrics.endReason === "timeout") {
        stats.timeouts++;
      }
    }

    this.stats.set(metrics.command, stats);
  }

  /**
   * 統計情報を取得
   */
  getStats(command?: string): any {
    if (command) {
      const stats = this.stats.get(command);
      if (!stats) return null;

      return {
        command,
        ...stats,
        avgMs: Math.round(stats.totalMs / stats.count),
      };
    }

    // 全体統計
    const result: Record<string, any> = {};
    for (const [cmd, stats] of this.stats.entries()) {
      result[cmd] = {
        ...stats,
        avgMs: Math.round(stats.totalMs / stats.count),
      };
    }
    return result;
  }

  /**
   * リセット
   */
  reset(): void {
    this.stats.clear();
  }
}

// グローバルインスタンス(必要に応じて)
export const globalStats = new CommandStats();
export const perfTracker = new PerformanceTracker();
