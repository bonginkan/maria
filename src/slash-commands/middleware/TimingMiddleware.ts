/**
 * TimingMiddleware - Measure execution time
 */
import type { Middleware, CommandContext } from "../router/CommandRouter";
import type { NormalizedResult } from "../adapters/ResultAdapter";

export class TimingMiddleware implements Middleware {
  private startTimes = new WeakMap<object, number>();
  private isDevelopment = process.env.NODE_ENV !== "production";

  async before(
    _command: string,
    _args: string[],
    context: CommandContext,
  ): Promise<CommandContext> {
    this.startTimes.set(context as object, performance.now());
    return context;
  }

  async after(
    command: string,
    _args: string[],
    context: CommandContext,
    result: NormalizedResult,
  ): Promise<NormalizedResult> {
    if (this.isDevelopment) {
      const start = this.startTimes.get(context as object) ?? performance.now();
      const duration = performance.now() - start;
      console.log(`⏱  ${command} executed in ${duration.toFixed(1)}ms`);
    }
    return result;
  }
}
