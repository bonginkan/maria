/**
 * Per-command Inflight Gates
 * 同じキー(=同じコマンド)を同時実行させないための軽量ガード。
 * /help など軽量コマンドはキーに #nolock を付けて素通しにできます。
 */

export class InflightGates {
  private running = new Set<string>();

  /**
   * 指定キーの実行区間を排他にする。
   * すでに実行中なら Error("Command already in progress: <key>") を投げる。
   */
  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (this.running.has(key)) {
      throw new Error(`Command already in progress: ${key}`);
    }
    this.running.add(key);
    try {
      return await fn();
    } finally {
      this.running.delete(key);
    }
  }

  /**
   * 例外を投げずに試行する版。失敗時は {ok:false, error} を返す。
   */
  async tryRun<T>(
    key: string,
    fn: () => Promise<T>,
  ): Promise<{ ok: true; value: T } | { ok: false; error: Error }> {
    if (this.running.has(key)) {
      return {
        ok: false,
        error: new Error(`Command already in progress: ${key}`),
      };
    }
    this.running.add(key);
    try {
      const value = await fn();
      return { ok: true, value };
    } catch (e: any) {
      return {
        ok: false,
        error: e instanceof Error ? e : new Error(String(e)),
      };
    } finally {
      this.running.delete(key);
    }
  }

  /** 状態リセット(テスト用) */
  reset(): void {
    this.running.clear();
  }

  /** 現在の実行中キーを取得(観測用) */
  list(): string[] {
    return Array.from(this.running.values());
  }
}
