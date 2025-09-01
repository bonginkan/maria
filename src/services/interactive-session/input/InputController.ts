// src/services/interactive-session/input/InputController.ts
// readline の rawMode/リスナー漏れを try/finally で必ず復旧する安全化ユーティリティ

import * as readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";

export interface InputControllerOptions {
  debounceMs?: number; // 既定 250ms(連打対策)
  escCancels?: boolean; // 既定 true(Esc で null)
}

export class InputController {
  private lastSubmitAt = 0;
  private opts: Required<InputControllerOptions>;

  constructor(
    private rl: readline.Interface,
    opts: InputControllerOptions = {},
  ) {
    this.opts = {
      debounceMs: opts.debounceMs ?? 250,
      escCancels: opts.escCancels ?? true,
    };
  }

  /**
   * 1行入力(UI側でプロンプト描画済みを想定)
   * - Esc で null(既定)
   * - Ctrl+C は例外化せず null(セッション継続志向)
   */
  async readline(): Promise<string | null> {
    const now = Date.now();
    if (now - this.lastSubmitAt < this.opts.debounceMs) return null;

    const saved = this.captureStdinState();

    try {
      this.enableRawMode(true);
      await this.installKeypress();
      const line = await new Promise<string | null>((resolve) => {
        const onKey = (str: string, key: any): void => {
          if (key?.name === "escape" && this.opts.escCancels) {
            resolve(null);
            return;
          }
          if (key?.ctrl && key?.name === "c") {
            resolve(null);
            return;
          }
          if (key?.name === "return" || key?.name === "enter") {
            // 実際の入力は readline に委譲するため、ここでは無視
            return;
          }
          // Other keys are handled by readline, so we just return
          return;
        };
        (input as any).on("keypress", onKey);

        this.rl.question("", (answer) => {
          (input as any).off("keypress", onKey);
          resolve(answer.trim());
        });
      });

      this.lastSubmitAt = Date.now();
      return line;
    } finally {
      this.restoreStdinState(saved);
    }
  }

  /**
   * 汎用的な withRawMode 実行(副作用確実復旧)
   */
  async withRawMode<T>(fn: () => Promise<T>): Promise<T> {
    const saved = this.captureStdinState();
    try {
      this.enableRawMode(true);
      await this.installKeypress();
      return await fn();
    } finally {
      this.restoreStdinState(saved);
    }
  }

  // --- 内部ユーティリティ ---

  private async installKeypress(): Promise<void> {
    // Node の keypress イベントを有効化(readline.emitKeypressEvents)
    readline.emitKeypressEvents(input, this.rl);
  }

  private enableRawMode(enable: boolean) {
    if (input.isTTY) {
      try {
        input.setRawMode(enable);
      } catch {
        /* ignore */
      }
    }
    // カーソルの可視性は UI 層で担保する方針(ここでは触らない)
  }

  private captureStdinState() {
    return {
      isRaw: (input as any).isRaw ?? false,
      // 必要に応じて既存のリスナーも退避可能
    };
  }

  private restoreStdinState(saved: { isRaw: boolean }) {
    try {
      if (input.isTTY) input.setRawMode(saved.isRaw);
    } catch {
      /* ignore */
    }
  }
}
