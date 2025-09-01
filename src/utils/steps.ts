/**
 * Step management utilities for preventing infinite loops and managing timeouts
 */

export class Deadline {
  constructor(
    private ms: number,
    private started = Date.now(),
  ) {}

  remain(): number {
    return Math.max(0, this.ms - (Date.now() - this.started));
  }

  child(budget: number): number {
    return Math.min(budget, this.remain());
  }
}

export interface UI {
  progress(msg: string): void;
  progressEnd?(): void;
  error(msg: string, hint?: string): void;
  done(msg: string): void;
}

export function withStep(ui: UI, dl: Deadline, ctrl: AbortController) {
  return async function <T>(
    msg: string,
    budgetMs: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    const ms = dl.child(budgetMs);
    ui.progress(msg);

    try {
      return await pTimeout(
        fn(),
        ms,
        () => new Error(`Timeout at step: ${msg} (${ms}ms)`),
      );
    } finally {
      ui.progressEnd?.(); // Guaranteed spinner cleanup
    }
  };
}

export async function pTimeout<T>(
  p: Promise<T>,
  ms: number,
  onTimeout: () => Error,
): Promise<T> {
  let t: any;
  const timeout = new Promise<T>((_, rej) => {
    t = setTimeout(() => rej(onTimeout()), ms);
  });

  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(t);
  }
}

export function toUserError(e: unknown): { message: string; hint?: string } {
  const m = e instanceof Error ? e.message : String(e);

  if (/Timeout/i.test(m)) {
    return {
      message: "⌛ Processing timeout",
      hint: "Try /model to select a faster model or retry",
    };
  }

  if (/API[_ ]?key/i.test(m)) {
    return {
      message: "🔑 API key not configured",
      hint: "Set environment variable: export OPENAI_API_KEY=...",
    };
  }

  if (/not found/i.test(m)) {
    return {
      message: "📁 File or resource not found",
      hint: "Check the path and try again",
    };
  }

  if (/network|connection/i.test(m)) {
    return {
      message: "🌐 Network connection error",
      hint: "Check your internet connection and try again",
    };
  }

  return {
    message: `❌ ${m}`,
    hint: "Run /doctor for diagnostics or /model to check model settings",
  };
}
