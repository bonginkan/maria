// src/services/interactive-session/core/SessionStateMachine.ts
// Finite State Machine for the interactive session
// - 明示的ステート/遷移
// - Deadline/Cancel 伝播(AbortSignal)
// - 再入/多重遷移の防止

export type SessionStateName =
  | "Idle"
  | "Reading"
  | "Routing"
  | "Executing"
  | "Streaming"
  | "Completed"
  | "Canceled"
  | "Error";

export type SessionEvent =
  | { type: "START" }
  | { type: "INPUT_READY"; payload: string }
  | { type: "ROUTED" }
  | { type: "EXEC_DONE" }
  | { type: "STREAM_DONE" }
  | { type: "CANCEL" }
  | { type: "FAIL"; error: unknown }
  | { type: "RESET" };

export interface StateContext {
  // 現在処理中の入力・出力
  input?: string;
  output?: string;
  // デバッグやテレメトリ用途
  turnId?: string;
  meta?: Record<string, unknown>;
}

export interface TransitionResult {
  state: SessionStateName;
  ctx: StateContext;
}

export interface DeadlineOptions {
  deadlineMs?: number; // 既定 15000ms
}

export class SessionStateMachine {
  private _state: SessionStateName = "Idle";
  private _ctx: StateContext = {};
  private inflight = false;

  private deadlineTimer?: NodeJS.Timeout;
  private controller?: AbortController;

  constructor(private defaults: DeadlineOptions = { deadlineMs: 15000 }) {}

  get state() {
    return this._state;
  }
  get ctx() {
    return this._ctx;
  }
  get signal(): AbortSignal | undefined {
    return this.controller?.signal;
  }

  /**
   * ステートマシン開始(Idle→Reading)
   */
  start(
    turnId: string,
    deadlineMs = this.defaults.deadlineMs,
  ): TransitionResult {
    this.ensureNotInflight();
    this.inflight = true;
    this._ctx = { turnId, meta: {} };
    this.enterDeadline(deadlineMs);
    return this.to("Reading");
  }

  /**
   * イベント処理
   */
  send(evt: SessionEvent): TransitionResult {
    switch (this._state) {
      case "Idle": {
        if (evt.type === "START") {
          return this.to("Reading");
        }
        break;
      }

      case "Reading": {
        if (evt.type === "INPUT_READY") {
          this._ctx.input = evt.payload;
          return this.to("Routing");
        }
        if (evt.type === "CANCEL") return this.to("Canceled");
        if (evt.type === "FAIL") return this.fail(evt.error);
        break;
      }

      case "Routing": {
        if (evt.type === "ROUTED") return this.to("Executing");
        if (evt.type === "CANCEL") return this.to("Canceled");
        if (evt.type === "FAIL") return this.fail(evt.error);
        break;
      }

      case "Executing": {
        if (evt.type === "EXEC_DONE") return this.to("Streaming");
        if (evt.type === "CANCEL") return this.to("Canceled");
        if (evt.type === "FAIL") return this.fail(evt.error);
        break;
      }

      case "Streaming": {
        if (evt.type === "STREAM_DONE") return this.complete();
        if (evt.type === "CANCEL") return this.to("Canceled");
        if (evt.type === "FAIL") return this.fail(evt.error);
        break;
      }

      case "Completed":
      case "Canceled":
      case "Error": {
        if (evt.type === "RESET") return this.reset();
        break;
      }
    }
    // 不正・無視イベントは現状維持(安全)
    return { state: this._state, ctx: this._ctx };
  }

  /**
   * 実行フェーズで使用する AbortSignal を用意
   * - deadline 超過で Abort → 必ず Completed/Canceled/Error に遷移
   */
  private enterDeadline(deadlineMs = this.defaults.deadlineMs) {
    this.clearDeadline();
    this.controller = new AbortController();
    if (deadlineMs && deadlineMs > 0) {
      this.deadlineTimer = setTimeout(() => {
        this.controller?.abort();
        // 期限切れは Error よりも Canceled に寄せる
        if (
          this._state !== "Completed" &&
          this._state !== "Canceled" &&
          this._state !== "Error"
        ) {
          this.to("Canceled");
        }
      }, deadlineMs);
      // Node で自然終了を妨げない
      (this.deadlineTimer as any).unref?.();
    }
  }

  private clearDeadline() {
    if (this.deadlineTimer) clearTimeout(this.deadlineTimer);
    this.deadlineTimer = undefined;
  }

  private complete(): TransitionResult {
    this.inflight = false;
    this.clearDeadline();
    this.controller = undefined;
    return this.to("Completed");
  }

  private fail(error: unknown): TransitionResult {
    this._ctx.meta = { ...(this._ctx.meta || {}), error };
    this.inflight = false;
    this.clearDeadline();
    this.controller = undefined;
    return this.to("Error");
  }

  private reset(): TransitionResult {
    this.inflight = false;
    this.clearDeadline();
    this.controller = undefined;
    this._ctx = {};
    this._state = "Idle"; // Direct assignment for reset
    return { state: this._state, ctx: this._ctx };
  }

  private to(next: SessionStateName): TransitionResult {
    // 再入ロック:Completed/Canceled/Error → 他ステートへは RESET 経由のみ
    if (this.isTerminal(this._state) && next !== "Idle") {
      return { state: this._state, ctx: this._ctx };
    }
    this._state = next;
    return { state: this._state, ctx: this._ctx };
  }

  private ensureNotInflight() {
    if (this.inflight && !this.isTerminal(this._state)) {
      throw new Error("SessionState: transition while inflight");
    }
  }

  private isTerminal(s: SessionStateName) {
    return s === "Completed" || s === "Canceled" || s === "Error";
  }
}
