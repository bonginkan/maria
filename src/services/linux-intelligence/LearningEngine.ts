/**
 * Learning Engine
 * Machine learning for command patterns
 */

import { learnFromExecution } from "./LinuxIntelligenceEngine";

export class LearningEngine {
  private patterns: Map<string, any> = new Map();

  async learn(_command: string, result: unknown): Promise<void> {
    await learnFromExecution(_command, result);

    // Update patterns
    const _pattern = this.extractPattern(_command);
    const _count = this.patterns.get(_pattern) || 0;
    this.patterns.set(_pattern, _count + 1);
  }

  private extractPattern(command: string): string {
    // Extract command _pattern
    const _parts = command.split(" ");
    return _parts[0] || "unknown";
  }

  getPatterns(): Map<string, any> {
    return new Map(this.patterns);
  }
}
