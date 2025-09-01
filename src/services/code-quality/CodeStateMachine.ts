/**
 * CodeStateMachine - Explicit state management for /code command
 * Prevents infinite loops with deterministic state transitions
 */

import { createHash } from "crypto";

export type CodeState =
  | "INIT"
  | "ANALYZE"
  | "PLAN"
  | "GENERATE"
  | "VALIDATE"
  | "FINAL"
  | "DONE"
  | "ERROR";

export interface LoopContext {
  state: CodeState;
  iter: number;
  maxIter: number;
  lastArtifactHash?: string;
  noDeltaCount: number;
  startTime: number;
  timeout: number;
  transitions: Array<{ from: CodeState; to: CodeState; timestamp: number }>;
}

/**
 * Create initial loop context
 */
export function createContext(
  maxIter: number = 2,
  timeout: number = 15000,
): LoopContext {
  return {
    state: "INIT",
    iter: 0,
    maxIter,
    noDeltaCount: 0,
    startTime: Date.now(),
    timeout,
    transitions: [],
  };
}

/**
 * Transition to a new state with validation
 */
export function transition(ctx: LoopContext, newState: CodeState): void {
  const oldState = ctx.state;

  // Record transition
  ctx.transitions.push({
    from: oldState,
    to: newState,
    timestamp: Date.now(),
  });

  // Detect illegal transitions
  if (oldState === "FINAL" && newState !== "DONE" && newState !== "ERROR") {
    console.error(`🚨 ILLEGAL TRANSITION: ${oldState} → ${newState}`);
    throw new Error(`Illegal state transition: ${oldState} → ${newState}`);
  }

  if (oldState === "DONE" && newState !== "DONE") {
    console.error(`🚨 ILLEGAL TRANSITION: Cannot leave DONE state`);
    throw new Error(`Cannot transition from DONE to ${newState}`);
  }

  ctx.state = newState;
}

/**
 * Check if execution should stop
 */
export function shouldStop(ctx: LoopContext, currentCode?: string): boolean {
  // 1. Check iteration limit
  if (ctx.iter >= ctx.maxIter) {
    console.log(`⚠️ Max iterations (${ctx.maxIter}) reached`);
    return true;
  }

  // 2. Check timeout
  const elapsed = Date.now() - ctx.startTime;
  if (elapsed > ctx.timeout) {
    console.log(`⚠️ Timeout (${ctx.timeout}ms) exceeded`);
    return true;
  }

  // 3. Check for unchanged artifact
  if (currentCode) {
    const hash = createHash("sha256").update(currentCode).digest("hex");
    if (ctx.lastArtifactHash === hash) {
      ctx.noDeltaCount++;
      if (ctx.noDeltaCount >= 1) {
        console.log("✓ No changes detected, stopping");
        return true;
      }
    } else {
      ctx.noDeltaCount = 0;
    }
    ctx.lastArtifactHash = hash;
  }

  // 4. Terminal states
  if (ctx.state === "DONE" || ctx.state === "ERROR") {
    return true;
  }

  return false;
}

/**
 * Detect loop patterns in transitions
 */
export function detectLoop(ctx: LoopContext): boolean {
  const recent = ctx.transitions.slice(-5);
  if (recent.length < 3) return false;

  // Check for FINAL → non-DONE transitions
  for (let i = 0; i < recent.length - 1; i++) {
    if (
      recent[i].from === "FINAL" &&
      recent[i].to !== "DONE" &&
      recent[i].to !== "ERROR"
    ) {
      return true;
    }
  }

  // Check for repetitive patterns
  const pattern = recent.map((t) => `${t.from}->${t.to}`).join(",");
  const firstHalf = pattern.substring(0, pattern.length / 2);
  const secondHalf = pattern.substring(pattern.length / 2);

  return firstHalf === secondHalf && firstHalf.length > 0;
}

/**
 * Get execution summary
 */
export function getSummary(ctx: LoopContext): {
  totalTime: number;
  iterations: number;
  transitions: number;
  finalState: CodeState;
  hasLoop: boolean;
} {
  return {
    totalTime: Date.now() - ctx.startTime,
    iterations: ctx.iter,
    transitions: ctx.transitions.length,
    finalState: ctx.state,
    hasLoop: detectLoop(ctx),
  };
}
