/**
 * InputContext - Unified State Manager for Input Components
 * Central state management for all input-related components and data
 *
 * Features:
 * - Unified input state management
 * - Real-time indicators and status
 * - Performance monitoring
 * - Event-driven architecture
 * - Observable patterns
 *
 * @since v3.4.2
 */

import { EventEmitter } from "node:events";
import type { ClipboardAnalysis } from "../../services/clipboard/ClipboardAnalyzer";
import type { DetectionResult } from "../../services/error-analyzer/ErrorPatternDetector";
import type { CommandMapping } from "../../services/intelligent-router/NaturalLanguageCommandMapper";
import type { InputAttachment } from "./InputBoxAdapter";

export type InputMode = "command" | "text" | "code" | "error" | "natural";

export interface InputState {
  // Current content
  text: string;
  mode: InputMode;
  lines: string[];
  cursorPosition: number;
  selectionRange?: { start: number; end: number };

  // Input properties
  isMultiline: boolean;
  isExpanded: boolean;
  hasContent: boolean;
  hasAttachments: boolean;

  // Attachments and references
  attachments: InputAttachment[];
  references: Array<{
    type: "file" | "url" | "command" | "error";
    value: string;
    displayName?: string;
  }>;

  // Analysis results
  clipboardAnalysis?: ClipboardAnalysis;
  errorAnalysis?: DetectionResult;
  commandMapping?: CommandMapping;

  // Metadata
  lastModified: number;
  wordCount: number;
  characterCount: number;
  estimatedProcessingTime?: number;
}

export interface InputIndicators {
  // Real-time status
  isTyping: boolean;
  isPasting: boolean;
  isProcessing: boolean;
  isDragging: boolean;
  isAnalyzing: boolean;

  // Content indicators
  hasErrors: boolean;
  hasSecrets: boolean;
  hasCode: boolean;
  hasUrls: boolean;

  // Performance indicators
  inputLag: number;
  analysisProgress: number;

  // User feedback
  showSuggestions: boolean;
  showWarnings: boolean;
  showPreview: boolean;
}

export interface InputStatusBar {
  // Left side info
  mode: string;
  language?: string;
  encoding: string;

  // Center info
  position: {
    line: number;
    column: number;
    selection?: string;
  };

  // Right side info
  attachmentCount: number;
  wordCount: number;
  characterCount: number;

  // Active features
  features: Array<{
    name: string;
    active: boolean;
    shortcut?: string;
  }>;

  // Suggestions
  suggestions: Array<{
    text: string;
    type: "command" | "completion" | "action";
    confidence?: number;
  }>;
}

export interface InputPerformance {
  // Timing metrics
  inputLatency: number;
  renderTime: number;
  analysisTime: number;
  totalProcessingTime: number;

  // Resource usage
  memoryUsage: number;
  cpuUsage: number;

  // Operation counts
  keystrokes: number;
  backspaces: number;
  pasteOperations: number;
  attachmentOperations: number;

  // Quality metrics
  errorRate: number;
  suggestionAccuracy: number;
  userSatisfaction?: number;
}

export interface InputSettings {
  // UI preferences
  showLineNumbers: boolean;
  enableSyntaxHighlighting: boolean;
  enableWordWrap: boolean;
  enableAutoComplete: boolean;

  // Behavior settings
  autoExpandLines: boolean;
  enableSmartIndentation: boolean;
  enableAutoSave: boolean;
  enableSpellCheck: boolean;

  // Performance settings
  debounceMs: number;
  maxHighlightChars: number;
  enableRealTimeAnalysis: boolean;

  // Security settings
  enableSecretDetection: boolean;
  enableContentValidation: boolean;
  autoSanitizeContent: boolean;

  // Accessibility
  enableScreenReader: boolean;
  enableHighContrast: boolean;
  fontSize: "small" | "medium" | "large";
}

export interface InputContextConfig {
  enablePerformanceMonitoring?: boolean;
  enableRealTimeAnalysis?: boolean;
  maxHistorySize?: number;
  autoSaveInterval?: number;
  defaultSettings?: Partial<InputSettings>;
}

export class InputContext extends EventEmitter {
  // Core state
  private state: InputState;
  private indicators: InputIndicators;
  private statusBar: InputStatusBar;
  private performance: InputPerformance;
  private settings: InputSettings;
  private config: Required<InputContextConfig>;

  // History and undo/redo
  private stateHistory: Array<{
    state: Partial<InputState>;
    timestamp: number;
    action: string;
  }> = [];
  private historyIndex: number = -1;

  // Performance monitoring
  private performanceTimer: NodeJS.Timeout | null = null;
  private lastUpdateTime: number = Date.now();

  // Debounced operations
  private analysisDebounceTimer: NodeJS.Timeout | null = null;
  private saveDebounceTimer: NodeJS.Timeout | null = null;

  constructor(config: InputContextConfig = {}) {
    super();

    this.config = {
      enablePerformanceMonitoring: config.enablePerformanceMonitoring ?? true,
      enableRealTimeAnalysis: config.enableRealTimeAnalysis ?? true,
      maxHistorySize: config.maxHistorySize ?? 50,
      autoSaveInterval: config.autoSaveInterval ?? 5000,
      defaultSettings: config.defaultSettings ?? {},
    };

    // Initialize state
    this.state = this.createInitialState();
    this.indicators = this.createInitialIndicators();
    this.statusBar = this.createInitialStatusBar();
    this.performance = this.createInitialPerformance();
    this.settings = this.createInitialSettings();

    // Setup monitoring
    if (this.config.enablePerformanceMonitoring) {
      this.startPerformanceMonitoring();
    }
  }

  /**
   * Update input text
   */
  updateText(text: string, source: "user" | "paste" | "system" = "user"): void {
    const startTime = Date.now();

    // Update state
    const previousText = this.state.text;
    this.state.text = text;
    this.state.lines = text.split("\n");
    this.state.isMultiline = this.state.lines.length > 1;
    this.state.hasContent = text.trim().length > 0;
    this.state.wordCount = this.calculateWordCount(text);
    this.state.characterCount = text.length;
    this.state.lastModified = Date.now();

    // Update indicators
    this.indicators.isTyping = source === "user";
    this.indicators.isPasting = source === "paste";

    // Update performance
    this.performance.inputLatency = Date.now() - startTime;
    if (source === "user") {
      this.performance.keystrokes++;
    } else if (source === "paste") {
      this.performance.pasteOperations++;
    }

    // Add to history
    this.addToHistory("text-update", { text: previousText });

    // Trigger analysis if enabled
    if (this.config.enableRealTimeAnalysis) {
      this.scheduleAnalysis();
    }

    // Update status bar
    this.updateStatusBar();

    // Emit events
    this.emit("text-changed", {
      text,
      previousText,
      source,
      state: this.getState(),
    });

    this.emit("state-updated", this.getState());
  }

  /**
   * Update input mode
   */
  updateMode(mode: InputMode, reason?: string): void {
    const previousMode = this.state.mode;
    this.state.mode = mode;
    this.state.lastModified = Date.now();

    // Update status bar
    this.statusBar.mode = mode;

    // Add to history
    this.addToHistory("mode-change", { mode: previousMode });

    this.emit("mode-changed", {
      mode,
      previousMode,
      reason,
      state: this.getState(),
    });

    this.emit("state-updated", this.getState());
  }

  /**
   * Add attachment
   */
  addAttachment(attachment: InputAttachment): void {
    this.state.attachments.push(attachment);
    this.state.hasAttachments = this.state.attachments.length > 0;
    this.state.lastModified = Date.now();

    // Update status bar
    this.statusBar.attachmentCount = this.state.attachments.length;

    // Update performance
    this.performance.attachmentOperations++;

    // Add to history
    this.addToHistory("attachment-add", {});

    this.emit("attachment-added", {
      attachment,
      totalAttachments: this.state.attachments.length,
      state: this.getState(),
    });

    this.emit("state-updated", this.getState());
  }

  /**
   * Remove attachment
   */
  removeAttachment(index: number): boolean {
    if (index < 0 || index >= this.state.attachments.length) {
      return false;
    }

    const removedAttachment = this.state.attachments.splice(index, 1)[0];
    this.state.hasAttachments = this.state.attachments.length > 0;
    this.state.lastModified = Date.now();

    // Update status bar
    this.statusBar.attachmentCount = this.state.attachments.length;

    // Add to history
    this.addToHistory("attachment-remove", { attachment: removedAttachment });

    this.emit("attachment-removed", {
      attachment: removedAttachment,
      index,
      totalAttachments: this.state.attachments.length,
      state: this.getState(),
    });

    this.emit("state-updated", this.getState());

    return true;
  }

  /**
   * Update cursor position
   */
  updateCursorPosition(position: number): void {
    this.state.cursorPosition = Math.max(
      0,
      Math.min(position, this.state.text.length),
    );

    // Update status bar position info
    const { line, column } = this.getLineColumnFromPosition(position);
    this.statusBar.position = { line, column };

    this.emit("cursor-moved", {
      position: this.state.cursorPosition,
      line,
      column,
      state: this.getState(),
    });
  }

  /**
   * Set analysis results
   */
  setAnalysisResults(results: {
    clipboardAnalysis?: ClipboardAnalysis;
    errorAnalysis?: DetectionResult;
    commandMapping?: CommandMapping;
  }): void {
    const startTime = Date.now();

    // Update state
    if (results.clipboardAnalysis) {
      this.state.clipboardAnalysis = results.clipboardAnalysis;
    }

    if (results.errorAnalysis) {
      this.state.errorAnalysis = results.errorAnalysis;
      this.indicators.hasErrors = results.errorAnalysis.hasErrors;
    }

    if (results.commandMapping) {
      this.state.commandMapping = results.commandMapping;
    }

    // Update indicators based on analysis
    if (results.clipboardAnalysis) {
      this.indicators.hasSecrets = results.clipboardAnalysis.containsSecrets;
      this.indicators.hasCode = results.clipboardAnalysis.containsCode;
      this.indicators.hasUrls = results.clipboardAnalysis.containsUrls;
      this.statusBar.language = results.clipboardAnalysis.language;
    }

    // Update performance
    this.performance.analysisTime = Date.now() - startTime;
    this.indicators.isAnalyzing = false;

    this.state.lastModified = Date.now();

    this.emit("analysis-completed", {
      results,
      analysisTime: this.performance.analysisTime,
      state: this.getState(),
    });

    this.emit("state-updated", this.getState());
  }

  /**
   * Update indicators
   */
  updateIndicators(updates: Partial<InputIndicators>): void {
    Object.assign(this.indicators, updates);

    this.emit("indicators-updated", {
      indicators: this.getIndicators(),
      updates,
    });
  }

  /**
   * Update settings
   */
  updateSettings(updates: Partial<InputSettings>): void {
    const previousSettings = { ...this.settings };
    Object.assign(this.settings, updates);

    // Apply settings that require immediate action
    if (
      updates.debounceMs !== undefined &&
      updates.debounceMs !== previousSettings.debounceMs
    ) {
      this.scheduleAnalysis();
    }

    this.emit("settings-updated", {
      settings: this.getSettings(),
      previousSettings,
      updates,
    });
  }

  /**
   * Get current state
   */
  getState(): InputState {
    return { ...this.state };
  }

  /**
   * Get current indicators
   */
  getIndicators(): InputIndicators {
    return { ...this.indicators };
  }

  /**
   * Get current status bar
   */
  getStatusBar(): InputStatusBar {
    return { ...this.statusBar };
  }

  /**
   * Get performance metrics
   */
  getPerformance(): InputPerformance {
    return { ...this.performance };
  }

  /**
   * Get current settings
   */
  getSettings(): InputSettings {
    return { ...this.settings };
  }

  /**
   * Get full context
   */
  getFullContext(): {
    state: InputState;
    indicators: InputIndicators;
    statusBar: InputStatusBar;
    performance: InputPerformance;
    settings: InputSettings;
  } {
    return {
      state: this.getState(),
      indicators: this.getIndicators(),
      statusBar: this.getStatusBar(),
      performance: this.getPerformance(),
      settings: this.getSettings(),
    };
  }

  /**
   * Undo last change
   */
  undo(): boolean {
    if (
      this.historyIndex >= 0 &&
      this.historyIndex < this.stateHistory.length
    ) {
      const historyEntry = this.stateHistory[this.historyIndex];

      // Apply the historical state
      Object.assign(this.state, historyEntry.state);
      this.historyIndex--;

      this.emit("undo", {
        action: historyEntry.action,
        timestamp: historyEntry.timestamp,
        state: this.getState(),
      });

      this.emit("state-updated", this.getState());
      return true;
    }

    return false;
  }

  /**
   * Redo last undone change
   */
  redo(): boolean {
    if (this.historyIndex < this.stateHistory.length - 1) {
      this.historyIndex++;
      const historyEntry = this.stateHistory[this.historyIndex];

      // Apply the future state
      Object.assign(this.state, historyEntry.state);

      this.emit("redo", {
        action: historyEntry.action,
        timestamp: historyEntry.timestamp,
        state: this.getState(),
      });

      this.emit("state-updated", this.getState());
      return true;
    }

    return false;
  }

  /**
   * Clear all content and reset state
   */
  clear(): void {
    const previousState = { ...this.state };

    this.state = this.createInitialState();
    this.indicators = this.createInitialIndicators();
    this.statusBar = this.createInitialStatusBar();

    // Keep performance metrics but reset some indicators
    this.indicators.isTyping = false;
    this.indicators.isProcessing = false;
    this.indicators.isAnalyzing = false;

    this.emit("cleared", {
      previousState,
      state: this.getState(),
    });

    this.emit("state-updated", this.getState());
  }

  /**
   * Export state for persistence
   */
  exportState(): {
    state: InputState;
    settings: InputSettings;
    timestamp: number;
  } {
    return {
      state: this.getState(),
      settings: this.getSettings(),
      timestamp: Date.now(),
    };
  }

  /**
   * Import state from persistence
   */
  importState(exported: {
    state: Partial<InputState>;
    settings?: Partial<InputSettings>;
  }): void {
    // Merge state
    Object.assign(this.state, exported.state);

    // Merge settings if provided
    if (exported.settings) {
      Object.assign(this.settings, exported.settings);
    }

    // Update derived properties
    if (this.state.text) {
      this.state.lines = this.state.text.split("\n");
      this.state.isMultiline = this.state.lines.length > 1;
      this.state.hasContent = this.state.text.trim().length > 0;
      this.state.wordCount = this.calculateWordCount(this.state.text);
      this.state.characterCount = this.state.text.length;
    }

    this.state.hasAttachments = this.state.attachments.length > 0;

    // Update status bar
    this.updateStatusBar();

    this.emit("state-imported", exported);
    this.emit("state-updated", this.getState());
  }

  /**
   * Dispose resources and cleanup
   */
  dispose(): void {
    // Clear timers
    if (this.performanceTimer) {
      clearInterval(this.performanceTimer);
      this.performanceTimer = null;
    }

    if (this.analysisDebounceTimer) {
      clearTimeout(this.analysisDebounceTimer);
      this.analysisDebounceTimer = null;
    }

    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }

    // Clear event listeners
    this.removeAllListeners();

    // Clear history
    this.stateHistory = [];

    this.emit("disposed");
  }

  // Private helper methods

  private createInitialState(): InputState {
    return {
      text: "",
      mode: "natural",
      lines: [""],
      cursorPosition: 0,
      isMultiline: false,
      isExpanded: false,
      hasContent: false,
      hasAttachments: false,
      attachments: [],
      references: [],
      lastModified: Date.now(),
      wordCount: 0,
      characterCount: 0,
    };
  }

  private createInitialIndicators(): InputIndicators {
    return {
      isTyping: false,
      isPasting: false,
      isProcessing: false,
      isDragging: false,
      isAnalyzing: false,
      hasErrors: false,
      hasSecrets: false,
      hasCode: false,
      hasUrls: false,
      inputLag: 0,
      analysisProgress: 0,
      showSuggestions: false,
      showWarnings: false,
      showPreview: false,
    };
  }

  private createInitialStatusBar(): InputStatusBar {
    return {
      mode: "natural",
      encoding: "UTF-8",
      position: { line: 1, column: 1 },
      attachmentCount: 0,
      wordCount: 0,
      characterCount: 0,
      features: [
        { name: "Syntax Highlighting", active: true, shortcut: "Ctrl+H" },
        { name: "Auto Complete", active: true, shortcut: "Ctrl+Space" },
        { name: "Error Detection", active: true },
      ],
      suggestions: [],
    };
  }

  private createInitialPerformance(): InputPerformance {
    return {
      inputLatency: 0,
      renderTime: 0,
      analysisTime: 0,
      totalProcessingTime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      keystrokes: 0,
      backspaces: 0,
      pasteOperations: 0,
      attachmentOperations: 0,
      errorRate: 0,
      suggestionAccuracy: 0,
    };
  }

  private createInitialSettings(): InputSettings {
    return {
      showLineNumbers: false,
      enableSyntaxHighlighting: true,
      enableWordWrap: true,
      enableAutoComplete: true,
      autoExpandLines: true,
      enableSmartIndentation: true,
      enableAutoSave: false,
      enableSpellCheck: false,
      debounceMs: 300,
      maxHighlightChars: 2000,
      enableRealTimeAnalysis: true,
      enableSecretDetection: true,
      enableContentValidation: true,
      autoSanitizeContent: false,
      enableScreenReader: false,
      enableHighContrast: false,
      fontSize: "medium",
      ...this.config.defaultSettings,
    };
  }

  private calculateWordCount(text: string): number {
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }

  private getLineColumnFromPosition(position: number): {
    line: number;
    column: number;
  } {
    const textBeforePosition = this.state.text.slice(0, position);
    const lines = textBeforePosition.split("\n");
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;

    return { line, column };
  }

  private addToHistory(
    action: string,
    previousState: Partial<InputState>,
  ): void {
    // Remove future history if we're not at the end
    if (this.historyIndex < this.stateHistory.length - 1) {
      this.stateHistory = this.stateHistory.slice(0, this.historyIndex + 1);
    }

    // Add new history entry
    this.stateHistory.push({
      state: previousState,
      timestamp: Date.now(),
      action,
    });

    this.historyIndex = this.stateHistory.length - 1;

    // Limit history size
    if (this.stateHistory.length > this.config.maxHistorySize) {
      const removeCount = this.stateHistory.length - this.config.maxHistorySize;
      this.stateHistory = this.stateHistory.slice(removeCount);
      this.historyIndex -= removeCount;
    }
  }

  private updateStatusBar(): void {
    this.statusBar.wordCount = this.state.wordCount;
    this.statusBar.characterCount = this.state.characterCount;
    this.statusBar.attachmentCount = this.state.attachments.length;

    // Update position if cursor position is set
    const { line, column } = this.getLineColumnFromPosition(
      this.state.cursorPosition,
    );
    this.statusBar.position = { line, column };

    // Update features status
    this.statusBar.features.forEach((feature) => {
      switch (feature.name) {
        case "Syntax Highlighting":
          feature.active = this.settings.enableSyntaxHighlighting;
          break;
        case "Auto Complete":
          feature.active = this.settings.enableAutoComplete;
          break;
        case "Error Detection":
          feature.active = this.settings.enableContentValidation;
          break;
      }
    });
  }

  private scheduleAnalysis(): void {
    if (this.analysisDebounceTimer) {
      clearTimeout(this.analysisDebounceTimer);
    }

    this.analysisDebounceTimer = setTimeout(() => {
      this.indicators.isAnalyzing = true;
      this.emit("analysis-requested", {
        text: this.state.text,
        attachments: this.state.attachments,
        state: this.getState(),
      });
    }, this.settings.debounceMs);
  }

  private startPerformanceMonitoring(): void {
    this.performanceTimer = setInterval(() => {
      // Simple performance monitoring
      const now = Date.now();
      const timeDiff = now - this.lastUpdateTime;

      if (timeDiff > 0) {
        // Calculate approximate input lag
        this.indicators.inputLag = Math.max(0, timeDiff - 16); // 16ms = 60fps target

        // Update memory usage (simplified)
        this.performance.memoryUsage = this.estimateMemoryUsage();

        this.lastUpdateTime = now;
      }

      this.emit("performance-update", this.getPerformance());
    }, 1000);
  }

  private estimateMemoryUsage(): number {
    // Simple memory estimation based on content size
    const textSize = this.state.text.length * 2; // UTF-16
    const attachmentSize = this.state.attachments.reduce((sum, att) => {
      return sum + (att.content?.length || 0) * 2 + att.path.length * 2;
    }, 0);
    const historySize = this.stateHistory.length * 1000; // Rough estimate

    return textSize + attachmentSize + historySize;
  }
}

export default InputContext;
