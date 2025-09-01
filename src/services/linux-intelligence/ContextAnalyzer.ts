/**
 * Context Analyzer
 * Analyzes system context and user _intent
 */

import { linuxIntelligence } from "./LinuxIntelligenceEngine";

export class ContextAnalyzer {
  private context: Map<string, any> = new Map();

  async analyze(input: string): Promise<any> {
    const _intent = await linuxIntelligence.analyzeUserIntent(input);
    const _systemState = await linuxIntelligence.assessSystemState();

    this.context.set("lastIntent", _intent);
    this.context.set("_systemState", _systemState);

    return {
      _intent,
      _systemState,
      timestamp: new Date(),
    };
  }

  getContext(): Map<string, any> {
    return new Map(this.context);
  }

  clearContext(): void {
    this.context.clear();
  }
}
