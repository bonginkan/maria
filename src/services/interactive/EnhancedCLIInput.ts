/**
 * Enhanced CLI Input V3 - Phase 3 Complete Integration
 * Ultimate integration of all Phase 2 intelligence + Phase 3 visual enhancements
 *
 * This component combines:
 * - Phase 2: Intelligent analysis, natural language processing, error detection
 * - Phase 3: Visual feedback, status bar, syntax highlighting, animations
 *
 * Features:
 * - Complete visual and intelligent input experience
 * - Performance-optimized rendering and analysis
 * - Accessibility-compliant animations and feedback
 * - Real-time status updates and suggestions
 * - Advanced syntax highlighting with error integration
 * - Smooth animations and transitions
 *
 * @since v3.4.2 Phase 3
 */

import { EventEmitter } from "node:events";
import { EnhancedCLIConfig, ProcessingResult } from "./types";
import {
  InputStatusBar,
  StatusBarConfig,
} from "../../ui/integrated-cli/InputStatusBar";
import {
  VisualFeedback,
  VisualFeedbackConfig,
} from "../../ui/integrated-cli/VisualFeedback";
import {
  SyntaxHighlighter,
  SyntaxHighlighterConfig,
} from "../../ui/integrated-cli/SyntaxHighlighter";
import {
  AnimationSystem,
  AnimationConfig,
} from "../../ui/integrated-cli/AnimationSystem";
import {
  InputContext,
  InputState,
  InputIndicators,
  InputPerformance,
  InputMode,
} from "../../ui/integrated-cli/InputContext";
import {
  InputBoxAdapter,
  InputPayload,
} from "../../ui/integrated-cli/InputBoxAdapter";
import {
  ClipboardAnalyzer,
  ClipboardAnalysis,
} from "../clipboard/ClipboardAnalyzer";
import {
  ErrorPatternDetector,
  DetectionResult,
} from "../error-analyzer/ErrorPatternDetector";
import {
  ErrorToCommandBridge,
  ProposedAction,
} from "../bridges/ErrorToCommandBridge";
import {
  NaturalLanguageCommandMapper,
  CommandMapping,
} from "../intelligent-router/NaturalLanguageCommandMapper";
import type { RouterConfig } from "../intelligent-router/types/common-types";

export interface EnhancedCLIV3Config extends EnhancedCLIConfig {
  // Visual enhancement settings
  statusBar: StatusBarConfig;
  visualFeedback: VisualFeedbackConfig;
  syntaxHighlighter: SyntaxHighlighterConfig;
  animations: AnimationConfig;

  // Integration settings
  enableIntegratedExperience: boolean;
  enableVisualFeedbackSync: boolean;
  enableStatusBarUpdates: boolean;
  enableSyntaxHighlighting: boolean;
  enableAnimations: boolean;

  // Performance optimization
  enableLazyLoading: boolean;
  enableComponentCaching: boolean;
  renderThrottleMs: number;
  updateBatchSize: number;

  // Theme and styling
  theme: "dark" | "light" | "auto";
  customStyles?: Record<string, string>;
}

export interface V3ProcessingResult extends ProcessingResult {
  // Visual enhancements
  visualState: {
    statusBarData: any;
    feedbackState: any;
    highlightingResult: any;
    animationStates: any[];
  };

  // Performance metrics
  performanceData: {
    processingTime: number;
    renderTime: number;
    componentLoadTime: number;
    memoryUsage: number;
  };

  // User experience data
  uxMetrics: {
    interactionLatency: number;
    visualFeedbackDelay: number;
    suggestionDisplayTime: number;
    errorHighlightTime: number;
  };
}

export class EnhancedCLIInput extends EventEmitter {
  // Core Phase 2 component
  // V2 functionality now integrated directly
  private inputContextV2: InputContext;
  private inputAdapter: InputBoxAdapter;
  private clipboardAnalyzer: ClipboardAnalyzer;
  private errorDetector: ErrorPatternDetector;
  private errorBridge: ErrorToCommandBridge;
  private nlMapper: NaturalLanguageCommandMapper;

  // Processing state from V2
  private isProcessingV2: boolean = false;
  private processingQueue: Array<{
    payload: InputPayload;
    resolve: (result: ProcessingResult) => void;
    reject: (error: Error) => void;
  }> = [];

  // Metrics from V2
  private metrics = {
    totalInputs: 0,
    successfulProcessing: 0,
    averageProcessingTime: 0,
    commandAccuracy: 0,
    userSatisfaction: 0,
  };

  // Phase 3 visual components
  private statusBar: InputStatusBar;
  private visualFeedback: VisualFeedback;
  private syntaxHighlighter: SyntaxHighlighter;
  private animationSystem: AnimationSystem;

  // Configuration
  private config: EnhancedCLIV3Config;

  // DOM and state management
  private container: HTMLElement | null = null;
  private inputContext: InputContext | null = null;
  private isInitialized: boolean = false;
  private isProcessing: boolean = false;

  // Component containers
  private elements: {
    mainContainer?: HTMLElement;
    inputContainer?: HTMLElement;
    statusBarContainer?: HTMLElement;
    syntaxContainer?: HTMLElement;
    feedbackContainer?: HTMLElement;
  } = {};

  // Performance tracking
  private performanceMetrics = {
    totalInputs: 0,
    successfulRenders: 0,
    averageProcessingTime: 0,
    averageRenderTime: 0,
    componentLoadTimes: {
      statusBar: 0,
      visualFeedback: 0,
      syntaxHighlighter: 0,
      animationSystem: 0,
    },
  };

  // Event handlers cache
  private eventHandlers: Map<string, (...args: any[]) => any> = new Map();

  constructor(
    routerConfig: Required<RouterConfig>,
    config?: Partial<EnhancedCLIV3Config>,
  ) {
    super();

    this.config = {
      // Phase 2 config defaults
      enableClipboardAnalysis: config?.enableClipboardAnalysis ?? true,
      enableErrorDetection: config?.enableErrorDetection ?? true,
      enableNaturalLanguageMapping:
        config?.enableNaturalLanguageMapping ?? true,
      autoExecuteThreshold: config?.autoExecuteThreshold ?? 0.9,
      confirmationThreshold: config?.confirmationThreshold ?? 0.7,
      minimumConfidenceThreshold: config?.minimumConfidenceThreshold ?? 0.5,
      debounceMs: config?.debounceMs ?? 300,
      maxProcessingTime: config?.maxProcessingTime ?? 5000,
      enableRealTimeAnalysis: config?.enableRealTimeAnalysis ?? true,
      enableSecretDetection: config?.enableSecretDetection ?? true,
      enableContentValidation: config?.enableContentValidation ?? true,
      preferredLanguage: config?.preferredLanguage ?? "en",
      verboseOutput: config?.verboseOutput ?? false,
      enableLearning: config?.enableLearning ?? true,

      // Phase 3 config defaults
      statusBar: {
        showPerformanceMetrics: true,
        showDetailedPosition: true,
        showAttachmentPreviews: true,
        showSuggestionConfidence: true,
        enableAnimations: true,
        transitionDuration: 200,
        pulseOnUpdate: true,
        enableFeatureToggles: true,
        enableSuggestionClick: true,
        enableAttachmentClick: true,
        theme: "auto",
        compactMode: false,
        showIcons: true,
        ...config?.statusBar,
      },

      visualFeedback: {
        enableAnimations: true,
        respectMotionPreference: true,
        animationSpeed: "normal",
        enableTypingIndicator: true,
        enableProcessingAnimation: true,
        enableDragFeedback: true,
        enableLoadingStates: true,
        enableScreenReaderFeedback: true,
        enableHighContrast: false,
        enableReducedMotion: false,
        maxConcurrentAnimations: 10,
        throttleUpdates: true,
        updateInterval: 16,
        ...config?.visualFeedback,
      },

      syntaxHighlighter: {
        supportedLanguages: [
          "typescript",
          "javascript",
          "python",
          "java",
          "cpp",
          "c",
          "go",
          "rust",
          "php",
          "ruby",
          "swift",
          "kotlin",
          "dart",
          "html",
          "css",
          "scss",
          "json",
          "yaml",
          "xml",
          "markdown",
          "bash",
          "shell",
          "sql",
          "docker",
          "nginx",
        ],
        defaultLanguage: "javascript",
        autoDetectLanguage: true,
        enableIncrementalHighlighting: true,
        enableVirtualScrolling: true,
        maxHighlightLength: 100000,
        debounceMs: 300,
        chunkSize: 1000,
        theme: "auto",
        enableLineNumbers: true,
        enableWordWrap: false,
        fontSize: 14,
        lineHeight: 1.4,
        enableErrorHighlighting: true,
        enableBracketMatching: true,
        enableFolding: false,
        enableMinimap: false,
        enableHighContrast: false,
        enableScreenReaderSupport: true,
        respectMotionPreference: true,
        ...config?.syntaxHighlighter,
      },

      animations: {
        enableHardwareAcceleration: true,
        respectMotionPreference: true,
        maxConcurrentAnimations: 20,
        frameRateCap: 60,
        defaultDuration: 300,
        defaultEasing: "ease-out",
        defaultDelay: 0,
        enableReducedMotion: false,
        enableScreenReaderAnnouncements: false,
        enablePerformanceMonitoring: true,
        showAnimationBounds: false,
        logAnimationEvents: false,
        ...config?.animations,
      },

      // Integration settings
      enableIntegratedExperience: config?.enableIntegratedExperience ?? true,
      enableVisualFeedbackSync: config?.enableVisualFeedbackSync ?? true,
      enableStatusBarUpdates: config?.enableStatusBarUpdates ?? true,
      enableSyntaxHighlighting: config?.enableSyntaxHighlighting ?? true,
      enableAnimations: config?.enableAnimations ?? true,

      // Performance optimization
      enableLazyLoading: config?.enableLazyLoading ?? true,
      enableComponentCaching: config?.enableComponentCaching ?? true,
      renderThrottleMs: config?.renderThrottleMs ?? 16,
      updateBatchSize: config?.updateBatchSize ?? 10,

      // Theme and styling
      theme: config?.theme ?? "auto",
      customStyles: config?.customStyles ?? {},
    };

    this.initializeComponents(routerConfig);
    this.setupEventHandlers();
  }

  /**
   * Initialize and mount to container
   */
  async mount(container: HTMLElement): Promise<void> {
    const startTime = performance.now();

    try {
      this.container = container;

      // Setup container structure
      await this.setupContainer();

      // Mount components
      await this.mountComponents();

      // Initialize integration
      await this.initializeIntegration();

      this.isInitialized = true;

      const loadTime = performance.now() - startTime;
      this.performanceMetrics.componentLoadTimes.statusBar = loadTime;

      this.emit("mounted", {
        loadTime,
        container,
        config: this.config,
      });
    } catch (error) {
      console.error("[EnhancedCLIInput] Mount failed:", error);
      throw error;
    }
  }

  /**
   * Unmount and cleanup
   */
  async unmount(): Promise<void> {
    try {
      // Unmount components
      this.statusBar.unmount();
      this.visualFeedback.unmount();
      this.syntaxHighlighter.unmount();
      this.animationSystem.dispose();

      // Clear container
      if (this.container) {
        this.container.innerHTML = "";
        this.container = null;
      }

      this.isInitialized = false;
      this.elements = {};

      this.emit("unmounted");
    } catch (error) {
      console.error("[EnhancedCLIInput] Unmount failed:", error);
      throw error;
    }
  }

  /**
   * Start input session with full V3 experience
   */
  async getInput(): Promise<V3ProcessingResult> {
    if (!this.isInitialized) {
      throw new Error("EnhancedCLIInput not initialized");
    }

    const startTime = performance.now();
    this.performanceMetrics.totalInputs++;

    try {
      // Start visual feedback
      if (this.config.enableVisualFeedbackSync) {
        this.visualFeedback.startLoading({
          message: "Ready for input...",
          type: "pulse",
        });
      }

      // Get input from integrated Phase 2 system
      const v2Result = await this.getInputIntegrated();

      // Stop loading feedback
      if (this.config.enableVisualFeedbackSync) {
        this.visualFeedback.stopLoading();
      }

      // Start processing animation
      if (this.config.enableVisualFeedbackSync) {
        this.visualFeedback.startProcessing({
          stage: "Analyzing input...",
          estimatedDuration: this.config.maxProcessingTime,
          showProgress: true,
        });
      }

      // Enhance with Phase 3 visual processing
      const v3Result = await this.enhanceWithVisualProcessing(v2Result);

      // Stop processing animation
      if (this.config.enableVisualFeedbackSync) {
        this.visualFeedback.stopProcessing(true);
      }

      // Update performance metrics
      const totalTime = performance.now() - startTime;
      this.performanceMetrics.averageProcessingTime =
        this.performanceMetrics.averageProcessingTime * 0.9 + totalTime * 0.1;

      this.emit("input-completed", v3Result);

      return v3Result;
    } catch (error) {
      // Stop any active animations
      this.visualFeedback.stopLoading();
      this.visualFeedback.stopProcessing(false);

      // Show error feedback
      this.visualFeedback.showNotification(
        "Input processing failed",
        "error",
        3000,
      );

      console.error("[EnhancedCLIInput] Input processing failed:", error);
      throw error;
    }
  }

  /**
   * Update configuration for all components
   */
  updateConfig(updates: Partial<EnhancedCLIV3Config>): void {
    Object.assign(this.config, updates);

    // Update Phase 2 config
    if (
      updates.enableClipboardAnalysis !== undefined ||
      updates.enableErrorDetection !== undefined ||
      updates.enableNaturalLanguageMapping !== undefined
    ) {
      // Update integrated config
      Object.assign(this.config, updates);
    }

    // Update Phase 3 components
    if (updates.statusBar) {
      this.statusBar.updateConfig(updates.statusBar);
    }

    if (updates.visualFeedback) {
      this.visualFeedback.updateConfig(updates.visualFeedback);
    }

    if (updates.syntaxHighlighter) {
      this.syntaxHighlighter.updateConfig(updates.syntaxHighlighter);
    }

    if (updates.animations) {
      this.animationSystem.updateConfig(updates.animations);
    }

    // Update theme if changed
    if (updates.theme || updates.customStyles) {
      this.applyTheme();
    }

    this.emit("config-updated", this.config);
  }

  /**
   * Get comprehensive performance metrics
   */
  getMetrics(): {
    v2Metrics: any;
    statusBarMetrics: any;
    visualFeedbackMetrics: any;
    syntaxHighlighterMetrics: any;
    animationMetrics: any;
    v3Metrics: typeof this.performanceMetrics;
  } {
    return {
      v2Metrics: this.metrics,
      statusBarMetrics: {}, // StatusBar doesn't expose metrics yet
      visualFeedbackMetrics: this.visualFeedback.getPerformanceMetrics(),
      syntaxHighlighterMetrics: this.syntaxHighlighter.getMetrics(),
      animationMetrics: this.animationSystem.getPerformanceMetrics(),
      v3Metrics: { ...this.performanceMetrics },
    };
  }

  /**
   * Clear all components
   */
  clear(): void {
    // Clear integrated components
    this.isProcessingV2 = false;
    this.processingQueue = [];
    this.statusBar.clear();
    this.visualFeedback.clearNotifications();
    this.animationSystem.cancelAllAnimations();

    this.emit("cleared");
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    // Dispose integrated components
    // Component disposal handled in parent dispose method
    this.statusBar.unmount();
    this.visualFeedback.unmount();
    this.syntaxHighlighter.unmount();
    this.animationSystem.dispose();

    this.eventHandlers.clear();
    this.removeAllListeners();

    this.emit("disposed");
  }

  // Private methods

  private initializeComponents(routerConfig: Required<RouterConfig>): void {
    // Initialize Phase 2 components (integrated from V2)
    this.inputContextV2 = new InputContext({
      enableRealTimeAnalysis: this.config.enableRealTimeAnalysis,
      enablePerformanceMonitoring: true,
      defaultSettings: {
        debounceMs: this.config.debounceMs,
        enableSecretDetection: this.config.enableSecretDetection,
        enableContentValidation: this.config.enableContentValidation,
      },
    });

    this.inputAdapter = new InputBoxAdapter({
      placeholder: "Type naturally, paste errors, or drag files...",
      enableExpandable: true,
      maxLines: 8,
    });

    this.clipboardAnalyzer = new ClipboardAnalyzer({
      enableSecretDetection: this.config.enableSecretDetection,
      enableLanguageDetection: true,
    });

    this.errorDetector = new ErrorPatternDetector();
    this.errorBridge = new ErrorToCommandBridge();

    this.nlMapper = new NaturalLanguageCommandMapper(routerConfig, {
      enableLearning: this.config.enableLearning,
      minConfidenceThreshold: this.config.minimumConfidenceThreshold,
      defaultLanguage: this.config.preferredLanguage,
    });

    // Initialize Phase 3 components
    this.statusBar = new InputStatusBar(this.config.statusBar);
    this.visualFeedback = new VisualFeedback(this.config.visualFeedback);
    this.syntaxHighlighter = new SyntaxHighlighter(
      this.config.syntaxHighlighter,
    );
    this.animationSystem = new AnimationSystem(this.config.animations);
  }

  private setupEventHandlers(): void {
    // Phase 2 event handlers (now integrated)
    // Events are now emitted directly from this class

    // Status bar event handlers
    this.statusBar.on("section-clicked", (data) => {
      this.handleStatusBarClick(data);
    });

    this.statusBar.on("feature-toggled", (feature) => {
      this.handleFeatureToggled(feature);
    });

    this.statusBar.on("suggestion-selected", (suggestion) => {
      this.handleSuggestionSelected(suggestion);
    });

    // Visual feedback event handlers
    this.visualFeedback.on("notification-shown", (notification) => {
      this.handleNotificationShown(notification);
    });

    // Syntax highlighter event handlers
    this.syntaxHighlighter.on("highlighted", (result) => {
      this.handleSyntaxHighlighted(result);
    });

    this.syntaxHighlighter.on("language-changed", (language) => {
      this.handleLanguageChanged(language);
    });

    // Animation system event handlers
    this.animationSystem.on("animation-completed", (data) => {
      this.handleAnimationCompleted(data);
    });
  }

  private async setupContainer(): Promise<void> {
    if (!this.container) {
      throw new Error("Container not set");
    }

    // Clear container
    this.container.innerHTML = "";
    this.container.className = "enhanced-cli-v3";

    // Create main structure
    this.elements.mainContainer = document.createElement("div");
    this.elements.mainContainer.className = "enhanced-cli-v3-main";

    // Input container
    this.elements.inputContainer = document.createElement("div");
    this.elements.inputContainer.className = "enhanced-cli-v3-input";

    // Status bar container
    this.elements.statusBarContainer = document.createElement("div");
    this.elements.statusBarContainer.className = "enhanced-cli-v3-status";

    // Syntax highlighting container
    this.elements.syntaxContainer = document.createElement("div");
    this.elements.syntaxContainer.className = "enhanced-cli-v3-syntax";

    // Visual feedback container
    this.elements.feedbackContainer = document.createElement("div");
    this.elements.feedbackContainer.className = "enhanced-cli-v3-feedback";

    // Assemble structure
    this.elements.inputContainer.appendChild(this.elements.syntaxContainer);
    this.elements.inputContainer.appendChild(this.elements.feedbackContainer);

    this.elements.mainContainer.appendChild(this.elements.inputContainer);
    this.elements.mainContainer.appendChild(this.elements.statusBarContainer);

    this.container.appendChild(this.elements.mainContainer);

    // Apply theme
    this.applyTheme();

    // Inject component styles
    this.injectStyles();
  }

  private async mountComponents(): Promise<void> {
    const startTime = performance.now();

    try {
      // Mount components in parallel where possible
      const mountPromises = [];

      if (
        this.config.enableStatusBarUpdates &&
        this.elements.statusBarContainer
      ) {
        mountPromises.push(
          Promise.resolve(
            this.statusBar.mount(this.elements.statusBarContainer),
          ),
        );
      }

      if (
        this.config.enableVisualFeedbackSync &&
        this.elements.feedbackContainer
      ) {
        mountPromises.push(
          Promise.resolve(
            this.visualFeedback.mount(this.elements.feedbackContainer),
          ),
        );
      }

      if (
        this.config.enableSyntaxHighlighting &&
        this.elements.syntaxContainer
      ) {
        mountPromises.push(
          Promise.resolve(
            this.syntaxHighlighter.mount(this.elements.syntaxContainer),
          ),
        );
      }

      await Promise.all(mountPromises);

      const mountTime = performance.now() - startTime;
      this.performanceMetrics.componentLoadTimes.statusBar = mountTime;
    } catch (error) {
      console.error("[EnhancedCLIInput] Component mounting failed:", error);
      throw error;
    }
  }

  private async initializeIntegration(): Promise<void> {
    if (!this.config.enableIntegratedExperience) {
      return;
    }

    // Get input context from Phase 2 system
    // inputContext is already available as this.inputContextV2

    // Setup context event handlers
    if (this.inputContext) {
      this.inputContext.on("text-changed", (data) => {
        this.handleTextChanged(data);
      });

      this.inputContext.on("mode-changed", (data) => {
        this.handleModeChanged(data);
      });

      this.inputContext.on("analysis-completed", (data) => {
        this.handleAnalysisCompleted(data);
      });

      this.inputContext.on("state-updated", (state) => {
        this.handleStateUpdated(state);
      });
    }
  }

  private async enhanceWithVisualProcessing(
    v2Result: ProcessingResult,
  ): Promise<V3ProcessingResult> {
    const startTime = performance.now();

    // Update status bar with results
    if (this.config.enableStatusBarUpdates && this.inputContext) {
      const state = this.inputContext.getState();
      const indicators = this.inputContext.getIndicators();
      const performance = this.inputContext.getPerformance();
      const statusBar = this.inputContext.getStatusBar();

      this.statusBar.update(statusBar, state, indicators, performance);

      // Show suggestions if available
      if (v2Result.commandMapping?.alternatives) {
        this.statusBar.showSuggestions(
          v2Result.commandMapping.alternatives.map((alt) => ({
            text: alt.command,
            type: "command" as const,
            confidence: alt.confidence,
          })),
        );
      }
    }

    // Update syntax highlighting if code detected
    if (
      this.config.enableSyntaxHighlighting &&
      v2Result.clipboardAnalysis?.containsCode
    ) {
      const language = v2Result.clipboardAnalysis.language || "javascript";
      const content = v2Result.clipboardAnalysis.content || "";

      if (content.length > 0) {
        await this.syntaxHighlighter.highlight(content, language);

        // Animate highlighting appearance
        if (this.config.enableAnimations && this.elements.syntaxContainer) {
          await this.animationSystem.fade(this.elements.syntaxContainer, "in", {
            duration: 300,
            easing: "ease-out",
          });
        }
      }
    }

    // Show error indicators if errors detected
    if (
      v2Result.errorAnalysis?.hasErrors &&
      this.config.enableVisualFeedbackSync
    ) {
      this.visualFeedback.showNotification(
        `${v2Result.errorAnalysis.errors.length} error(s) detected`,
        "warning",
        5000,
      );
    }

    // Animate results appearance
    if (this.config.enableAnimations && this.elements.mainContainer) {
      await this.animationSystem.pulse(this.elements.mainContainer, 1.02, {
        duration: 400,
      });
    }

    const renderTime = performance.now() - startTime;
    this.performanceMetrics.averageRenderTime =
      this.performanceMetrics.averageRenderTime * 0.9 + renderTime * 0.1;

    // Create enhanced result
    const v3Result: V3ProcessingResult = {
      ...v2Result,
      visualState: {
        statusBarData: this.statusBar.getCurrentStatus(),
        feedbackState: this.visualFeedback.getState(),
        highlightingResult: null, // Would get from syntax highlighter
        animationStates: this.animationSystem.getActiveAnimations(),
      },
      performanceData: {
        processingTime: v2Result.clipboardAnalysis?.processingTime || 0,
        renderTime,
        componentLoadTime: this.performanceMetrics.componentLoadTimes.statusBar,
        memoryUsage: this.estimateMemoryUsage(),
      },
      uxMetrics: {
        interactionLatency: renderTime,
        visualFeedbackDelay: 50, // Estimated
        suggestionDisplayTime: 100, // Estimated
        errorHighlightTime: 75, // Estimated
      },
    };

    return v3Result;
  }

  // Event handlers

  private handleV2InputProcessed(data: any): void {
    this.emit("v2-input-processed", data);
  }

  private handleClipboardAnalyzed(data: any): void {
    if (data.analysis?.containsSecrets) {
      this.visualFeedback.showNotification(
        "Sensitive content detected",
        "warning",
        5000,
      );
    }
  }

  private handleErrorsDetected(data: any): void {
    if (this.config.enableAnimations && this.elements.inputContainer) {
      this.animationSystem.shake(this.elements.inputContainer, 5, {
        duration: 300,
      });
    }
  }

  private handleCommandMapped(data: any): void {
    if (
      data.mapping?.confidence > 0.8 &&
      this.config.enableAnimations &&
      this.elements.inputContainer
    ) {
      this.animationSystem.pulse(this.elements.inputContainer, 1.05, {
        duration: 200,
      });
    }
  }

  private handleActionsProposed(data: any): void {
    if (data.actions?.length > 0) {
      this.statusBar.showMessage(
        `${data.actions.length} action(s) suggested`,
        "info",
        3000,
      );
    }
  }

  private handleStatusBarClick(data: any): void {
    this.emit("status-bar-clicked", data);
  }

  private handleFeatureToggled(feature: any): void {
    // Handle feature toggles (e.g., syntax highlighting, line numbers)
    if (feature.name === "Syntax Highlighting") {
      this.updateConfig({
        enableSyntaxHighlighting: feature.active,
      });
    }

    this.emit("feature-toggled", feature);
  }

  private handleSuggestionSelected(suggestion: any): void {
    this.emit("suggestion-selected", suggestion);
  }

  private handleNotificationShown(notification: any): void {
    this.emit("notification-shown", notification);
  }

  private handleSyntaxHighlighted(result: any): void {
    // Update status bar with language info
    if (this.inputContext) {
      const statusBar = this.inputContext.getStatusBar();
      statusBar.language = result.language;

      if (this.config.enableStatusBarUpdates) {
        this.statusBar.update(statusBar);
      }
    }

    this.emit("syntax-highlighted", result);
  }

  private handleLanguageChanged(language: string): void {
    this.emit("language-changed", language);
  }

  private handleAnimationCompleted(data: any): void {
    this.emit("animation-completed", data);
  }

  private handleTextChanged(data: any): void {
    // Trigger typing animation
    if (this.config.enableVisualFeedbackSync && data.source === "user") {
      this.visualFeedback.startTyping({
        speed: 100,
      });

      // Stop typing after delay
      setTimeout(() => {
        this.visualFeedback.stopTyping();
      }, 1000);
    }
  }

  private handleModeChanged(data: any): void {
    // Update visual components based on mode
    if (data.mode === "code" && this.config.enableSyntaxHighlighting) {
      // Enable code-specific features
    }
  }

  private handleAnalysisCompleted(data: any): void {
    // Update visual feedback based on analysis
    if (data.results.errorAnalysis?.hasErrors) {
      // Show error indicators
    }
  }

  private handleStateUpdated(state: InputState): void {
    // Sync all visual components with state changes
  }

  private applyTheme(): void {
    if (!this.container) {
      return;
    }

    const isDark =
      this.config.theme === "dark" ||
      (this.config.theme === "auto" && this.prefersDarkMode());

    this.container.classList.toggle("theme-dark", isDark);
    this.container.classList.toggle("theme-light", !isDark);

    // Apply custom styles
    if (this.config.customStyles) {
      for (const [property, value] of Object.entries(
        this.config.customStyles,
      )) {
        this.container.style.setProperty(`--custom-${property}`, value);
      }
    }
  }

  private estimateMemoryUsage(): number {
    // Simple memory estimation
    let usage = 0;

    // Component memory estimates
    usage += 50000; // Base V2 system
    usage += 20000; // Status bar
    usage += 15000; // Visual feedback
    usage += 100000; // Syntax highlighter (tokens)
    usage += 30000; // Animation system

    return usage;
  }

  private prefersDarkMode(): boolean {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  private injectStyles(): void {
    if (document.getElementById("enhanced-cli-v3-styles")) {
      return;
    }

    const styles = document.createElement("style");
    styles.id = "enhanced-cli-v3-styles";
    styles.textContent = `
      .enhanced-cli-v3 {
        display: flex;
        flex-direction: column;
        width: 100%;
        min-height: 200px;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        background: var(--v3-bg, #ffffff);
        color: var(--v3-fg, #000000);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', monospace;
      }
      
      .theme-dark .enhanced-cli-v3 {
        --v3-bg: #1e1e1e;
        --v3-fg: #d4d4d4;
        --v3-border: #3c3c3c;
        --v3-accent: #0078d4;
      }
      
      .theme-light .enhanced-cli-v3 {
        --v3-bg: #ffffff;
        --v3-fg: #000000;
        --v3-border: #cccccc;
        --v3-accent: #0078d4;
      }
      
      .enhanced-cli-v3-main {
        display: flex;
        flex-direction: column;
        flex: 1;
      }
      
      .enhanced-cli-v3-input {
        position: relative;
        flex: 1;
        min-height: 120px;
        background: var(--v3-bg);
        border-bottom: 1px solid var(--v3-border);
      }
      
      .enhanced-cli-v3-syntax {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 1;
      }
      
      .enhanced-cli-v3-feedback {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 10;
        pointer-events: none;
      }
      
      .enhanced-cli-v3-status {
        min-height: 24px;
        background: var(--v3-bg);
        border-top: 1px solid var(--v3-border);
        z-index: 5;
      }
      
      /* Responsive design */
      @media (max-width: 768px) {
        .enhanced-cli-v3 {
          min-height: 150px;
          border-radius: 4px;
        }
        
        .enhanced-cli-v3-input {
          min-height: 100px;
        }
      }
      
      /* High contrast mode */
      @media (prefers-contrast: high) {
        .enhanced-cli-v3 {
          border: 2px solid var(--v3-accent);
        }
        
        .enhanced-cli-v3-status {
          border-top-width: 2px;
        }
      }
      
      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .enhanced-cli-v3 *,
        .enhanced-cli-v3 *::before,
        .enhanced-cli-v3 *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }
    `;

    document.head.appendChild(styles);
  }

  // ========================================
  // Integrated V2 Functionality
  // ========================================

  /**
   * Integrated input processing from V2
   */
  async getInputIntegrated(): Promise<ProcessingResult> {
    try {
      // Get input from adapter
      const payload = await this.inputAdapter.prompt();

      // Update input context
      this.inputContextV2.updateText(
        payload.raw,
        payload.meta.pasteDetected ? "paste" : "user",
      );
      this.inputContextV2.updateMode(payload.meta.modeHint as InputMode);

      // Add attachments
      for (const attachment of payload.attachments) {
        this.inputContextV2.addAttachment(attachment);
      }

      // Process the input
      const result = await this.processInputIntegrated(payload);

      return result;
    } catch (error) {
      console.error("[EnhancedCLIInput] Input failed:", error);
      throw error;
    }
  }

  /**
   * Process input payload through all analysis stages (from V2)
   */
  async processInputIntegrated(
    payload: InputPayload,
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    this.metrics.totalInputs++;

    // Check if already processing
    if (this.isProcessingV2) {
      return new Promise((resolve, reject) => {
        this.processingQueue.push({ payload, resolve, reject });
      });
    }

    this.isProcessingV2 = true;
    this.inputContextV2.updateIndicators({ isProcessing: true });

    try {
      // Stage 1: Content Analysis (parallel)
      const [clipboardResult, errorResult] = await Promise.all([
        this.config.enableClipboardAnalysis
          ? this.analyzeClipboardContent(payload)
          : Promise.resolve(null),
        this.config.enableErrorDetection
          ? this.analyzeErrorContent(payload)
          : Promise.resolve(null),
      ]);

      // Stage 2: Command Mapping
      let commandResult: CommandMapping | null = null;
      if (this.config.enableNaturalLanguageMapping) {
        commandResult = await this.mapToCommand(payload, {
          clipboardAnalysis: clipboardResult,
          errorAnalysis: errorResult,
        });
      }

      // Stage 3: Action Proposals
      let proposedActions: ProposedAction[] = [];
      if (errorResult?.hasErrors) {
        proposedActions = await this.generateErrorActions(payload, errorResult);
      }

      // Stage 4: Result Synthesis
      const result = await this.synthesizeResults({
        payload,
        clipboardAnalysis: clipboardResult,
        errorAnalysis: errorResult,
        commandMapping: commandResult,
        proposedActions,
      });

      // Update context with analysis results
      this.inputContextV2.setAnalysisResults({
        clipboardAnalysis: clipboardResult,
        errorAnalysis: errorResult,
        commandMapping: commandResult,
      });

      // Update metrics
      const processingTime = Date.now() - startTime;
      this.updateMetricsIntegrated(result, processingTime);

      // Emit events
      this.emit("input-processed", {
        payload,
        result,
        processingTime,
      });

      return result;
    } catch (error) {
      console.error("[EnhancedCLIInput] Processing failed:", error);
      throw error;
    } finally {
      this.isProcessingV2 = false;
      this.inputContextV2.updateIndicators({ isProcessing: false });

      // Process queue if any
      if (this.processingQueue.length > 0) {
        const next = this.processingQueue.shift()!;
        this.processInputIntegrated(next.payload)
          .then(next.resolve)
          .catch(next.reject);
      }
    }
  }

  private async analyzeClipboardContent(
    payload: InputPayload,
  ): Promise<ClipboardAnalysis | null> {
    if (!payload.meta.pasteDetected) return null;
    return await this.clipboardAnalyzer.analyze(payload.raw);
  }

  private async analyzeErrorContent(
    payload: InputPayload,
  ): Promise<DetectionResult | null> {
    return await this.errorDetector.detectErrors(payload.raw);
  }

  private async mapToCommand(
    payload: InputPayload,
    context: any,
  ): Promise<CommandMapping | null> {
    return await this.nlMapper.mapToCommand(payload.raw, context);
  }

  private async generateErrorActions(
    payload: InputPayload,
    errorResult: DetectionResult,
  ): Promise<ProposedAction[]> {
    return await this.errorBridge.generateProposedActions(errorResult);
  }

  private async synthesizeResults(data: any): Promise<ProcessingResult> {
    const {
      payload,
      clipboardAnalysis,
      errorAnalysis,
      commandMapping,
      proposedActions,
    } = data;

    // Determine confidence and execution suggestion
    let confidence = 0.5;
    let suggestedExecution: "auto" | "confirm" | "manual" = "manual";

    if (commandMapping) {
      confidence = Math.max(confidence, commandMapping.confidence);
    }

    if (confidence >= this.config.autoExecuteThreshold) {
      suggestedExecution = "auto";
    } else if (confidence >= this.config.confirmationThreshold) {
      suggestedExecution = "confirm";
    }

    return {
      command: commandMapping?.command,
      parameters: commandMapping?.parameters,
      confidence,
      requiresConfirmation: suggestedExecution === "confirm",
      clipboardAnalysis: clipboardAnalysis || undefined,
      errorAnalysis: errorAnalysis || undefined,
      commandMapping: commandMapping || undefined,
      proposedActions,
      suggestedExecution,
      explanation: commandMapping?.explanation || "Input processed",
    };
  }

  private updateMetricsIntegrated(
    result: ProcessingResult,
    processingTime: number,
  ): void {
    this.metrics.averageProcessingTime =
      this.metrics.averageProcessingTime * 0.9 + processingTime * 0.1;

    if (result.confidence > this.config.minimumConfidenceThreshold) {
      this.metrics.successfulProcessing++;
    }
  }
}

export default EnhancedCLIInput;
