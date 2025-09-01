import { EventEmitter } from "node:events";

export interface OutputMetrics {
  lineCount: number;
  charCount: number;
  processingTime: number;
  tokens?: number;
}

export interface CollapsedState {
  isCollapsed: boolean;
  _previewLines: string[];
  fullContent: string;
  _metrics: OutputMetrics;
  sessionId: string;
  timestamp: number;
}

export class OutputController extends EventEmitter {
  private static instance: OutputController;
  private expandedStates = new Map<string, boolean>();
  private readonly config = {
    maxLines: 50,
    maxChars: 5000,
    maxProcessingTime: 10000, // 10 seconds
    _previewLines: 5,
  };

  static getInstance(): OutputController {
    if (!OutputController.instance) {
      OutputController.instance = new OutputController();
    }
    return OutputController.instance;
  }

  /**
   * Determines if output should be automatically collapsed
   */
  shouldCollapse(_content: string, processingTime: number = 0): boolean {
    const _metrics = this.analyzeOutput(_content, processingTime);

    return (
      _metrics.lineCount > this.config.maxLines ||
      _metrics.charCount > this.config.maxChars ||
      metrics.processingTime > this.config.maxProcessingTime
    );
  }

  /**
   * Analyzes output content and returns _metrics
   */
  analyzeOutput(_content: string, processingTime: number = 0): OutputMetrics {
    const _lines = _content.split("\n");

    return {
      lineCount: _lines.length,
      charCount: _content.length,
      processingTime,
      tokens: this.estimateTokens(_content),
    };
  }

  /**
   * Creates preview of content (first N _lines)
   */
  getPreview(
    _content: string,
    _lines: number = this.config.previewLines,
  ): string[] {
    return _content.split("\n").slice(0, _lines);
  }

  /**
   * Creates collapsed state object for UI
   */
  createCollapsedState(
    content: string,
    sessionId: string,
    processingTime: number = 0,
  ): CollapsedState {
    const _metrics = this.analyzeOutput(content, processingTime);
    const _previewLines = this.getPreview(content);

    return {
      isCollapsed: true,
      _previewLines,
      fullContent: content,
      _metrics,
      sessionId,
      timestamp: Date.now(),
    };
  }

  /**
   * Toggles expansion state for a specific session
   */
  toggleExpansion(sessionId: string): boolean {
    const _currentState = this.expandedStates.get(sessionId) || false;
    const _newState = !_currentState;

    this.expandedStates.set(sessionId, _newState);
    this.emit("expansionToggled", { sessionId, isExpanded: _newState });

    return _newState;
  }

  /**
   * Gets current expansion state
   */
  isExpanded(sessionId: string): boolean {
    return this.expandedStates.get(sessionId) || false;
  }

  /**
   * Sets expansion state directly
   */
  setExpanded(_sessionId: string, expanded: boolean): void {
    this.expandedStates.set(_sessionId, expanded);
    this.emit("expansionToggled", { _sessionId, isExpanded: expanded });
  }

  /**
   * Clears expansion state for a session
   */
  clearSession(sessionId: string): void {
    this.expandedStates.delete(sessionId);
    this.emit("sessionCleared", { sessionId });
  }

  /**
   * Gets formatted size string for display
   */
  getFormattedSize(_metrics: OutputMetrics): string {
    const { lineCount, charCount } = _metrics;
    const _sizeKB = (charCount / 1024).toFixed(1);

    return `${lineCount} _lines, ${_sizeKB}KB`;
  }

  /**
   * Estimates token count (rough approximation)
   */
  private estimateTokens(content: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(content.length / 4);
  }

  /**
   * Gets human-readable processing time
   */
  getFormattedProcessingTime(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    return `${(ms / 60000).toFixed(1)}m`;
  }

  /**
   * Updates configuration
   */
  updateConfig(newConfig: Partial<typeof this.config>): void {
    Object.assign(this.config, newConfig);
    this.emit("configUpdated", this.config);
  }

  /**
   * Gets current configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Clears all expansion states (useful for memory management)
   */
  clearAllStates(): void {
    this.expandedStates.clear();
    this.emit("allStatesCleared");
  }

  /**
   * Gets statistics about current states
   */
  getStats() {
    return {
      totalSessions: this.expandedStates.size,
      expandedSessions: Array.from(this.expandedStates.values()).filter(Boolean)
        .length,
      memoryUsage: this.expandedStates.size * 100, // rough estimate in bytes
    };
  }
}

export const _outputController = OutputController.getInstance();
