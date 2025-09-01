/**
 * Run ID Generator for correlation tracking
 */

export class RunIdGenerator {
  private static instance: RunIdGenerator;
  private currentRunId: string;

  private constructor() {
    this.currentRunId = this.generate("init");
  }

  static getInstance(): RunIdGenerator {
    if (!this.instance) {
      this.instance = new RunIdGenerator();
    }
    return this.instance;
  }

  /**
   * Generate a new run ID
   */
  generate(command: string): string {
    const timestamp = new Date().toISOString();
    this.currentRunId = `${command}-${timestamp}`;
    return this.currentRunId;
  }

  /**
   * Get current run ID
   */
  getCurrent(): string {
    return this.currentRunId;
  }

  /**
   * Set a custom run ID (for testing or correlation)
   */
  setCurrent(runId: string): void {
    this.currentRunId = runId;
  }
}
