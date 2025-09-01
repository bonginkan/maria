/**
 * Model Selector v2 - Reactive UI
 * High-performance reactive UI with 100ms response target
 */

import { EventEmitter } from "node:events";
import { SessionManager } from "../session/SessionManager";
import type {
  ModelInfo,
  ModelFilter,
  ModelRecommendation,
} from "../types/index";

export interface UIEvent {
  type:
    | "model_selected"
    | "filter_updated"
    | "search_performed"
    | "recommendation_requested";
  timestamp: Date;
  duration?: number;
  data?: any;
}

export interface UIState {
  models: ModelInfo[];
  filteredModels: ModelInfo[];
  recommendations: ModelRecommendation[];
  selectedModel?: ModelInfo;
  activeFilter: ModelFilter;
  searchQuery: string;
  isLoading: boolean;
  lastUpdate: Date;
  error?: string;
}

export interface UIPerformanceMetrics {
  renderTime: number;
  filterTime: number;
  searchTime: number;
  lastResponseTime: number;
  averageResponseTime: number;
  responseTimeHistory: number[];
}

export interface UIConfig {
  maxResponseTime: number; // Target: 100ms
  debounceDelay: number; // For search/filter
  maxHistoryEntries: number; // Performance tracking
  enablePerfMetrics: boolean;
  enableVirtualization: boolean; // For large lists
  batchSize: number; // For rendering optimization
}

export class ReactiveUI extends EventEmitter {
  private sessionManager: SessionManager;
  private state: UIState;
  private config: UIConfig;
  private performanceMetrics: UIPerformanceMetrics;

  // Performance optimization
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private renderQueue: Array<() => void> = [];
  private isRendering = false;
  private updateScheduled = false;

  // Caching for performance
  private modelCache: Map<string, ModelInfo[]> = new Map();
  private filterCache: Map<string, ModelInfo[]> = new Map();
  private searchCache: Map<string, ModelInfo[]> = new Map();

  constructor(sessionManager: SessionManager, config: Partial<UIConfig> = {}) {
    super();

    this.sessionManager = sessionManager;
    this.config = {
      maxResponseTime: 100, // 100ms target
      debounceDelay: 150,
      maxHistoryEntries: 100,
      enablePerfMetrics: true,
      enableVirtualization: true,
      batchSize: 50,
      ...config,
    };

    this.state = this.initializeState();
    this.performanceMetrics = this.initializeMetrics();

    this.setupEventHandlers();
    this.startPerformanceMonitoring();
  }

  /**
   * Initialize UI with models data
   */
  async initialize(): Promise<void> {
    const startTime = performance.now();

    try {
      this.setState({ isLoading: true });

      // Load models from session manager's engine
      const models = await this.loadModels();

      this.setState({
        models,
        filteredModels: models,
        isLoading: false,
        lastUpdate: new Date(),
      });

      const duration = performance.now() - startTime;
      this.recordPerformance("initialize", duration);

      this.emit("initialized", { duration, modelCount: models.length });
    } catch (error) {
      this.setState({
        isLoading: false,
        error: error.message,
      });

      this.emit("error", { operation: "initialize", error: error.message });
    }
  }

  /**
   * Select a model with optimized UI update
   */
  async selectModel(
    modelId: string,
    context?: { reason?: string; task?: string },
  ): Promise<void> {
    const startTime = performance.now();

    try {
      // Optimistic UI update
      const model = this.state.models.find((m) => m.id === modelId);
      if (model) {
        this.setState({ selectedModel: model });
      }

      // Background session update
      await this.sessionManager.selectModel(modelId, context);

      // Sync with actual session state
      const session = this.sessionManager.getSession();
      if (session?.currentModel) {
        this.setState({ selectedModel: session.currentModel });
      }

      const duration = performance.now() - startTime;
      this.recordPerformance("select", duration);

      this.emitUIEvent("model_selected", {
        modelId,
        duration,
        optimistic: false, // Now synced with session
      });

      // Check if we need to warn about performance
      if (duration > this.config.maxResponseTime) {
        this.emit("performance_warning", {
          operation: "select",
          duration,
          target: this.config.maxResponseTime,
        });
      }
    } catch (error) {
      // Revert optimistic update and set error state
      const session = this.sessionManager.getSession();
      this.setState({
        selectedModel: session?.currentModel,
        error: error instanceof Error ? error.message : "Selection failed",
      });

      this.emit("error", {
        operation: "select",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Apply filters with debouncing and caching
   */
  applyFilter(filter: ModelFilter): void {
    const startTime = performance.now();
    const filterKey = JSON.stringify(filter);

    // Cancel previous debounce
    const existingTimer = this.debounceTimers.get("filter");
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Debounced filter application
    const timer = setTimeout(() => {
      try {
        // Check cache first
        const cached = this.filterCache.get(filterKey);
        if (cached) {
          this.setState({
            filteredModels: cached,
            activeFilter: filter,
          });

          const duration = performance.now() - startTime;
          this.recordPerformance("filter", duration);
          this.emitUIEvent("filter_updated", {
            filter,
            fromCache: true,
            duration,
          });
          return;
        }

        // Apply filter
        const filteredModels = this.applyModelFilter(this.state.models, filter);

        // Cache result
        this.filterCache.set(filterKey, filteredModels);

        // Update state
        this.setState({
          filteredModels,
          activeFilter: filter,
        });

        const duration = performance.now() - startTime;
        this.recordPerformance("filter", duration);

        this.emitUIEvent("filter_updated", {
          filter,
          resultCount: filteredModels.length,
          duration,
        });
      } catch (error) {
        this.emit("error", { operation: "filter", error: error.message });
      } finally {
        this.debounceTimers.delete("filter");
      }
    }, this.config.debounceDelay);

    this.debounceTimers.set("filter", timer);
  }

  /**
   * Perform search with caching and virtualization
   */
  search(query: string): void {
    const startTime = performance.now();

    // Clear previous debounce
    const existingTimer = this.debounceTimers.get("search");
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      try {
        // Check cache first
        const cached = this.searchCache.get(query.toLowerCase());
        if (cached) {
          this.setState({
            filteredModels: cached,
            searchQuery: query,
          });

          const duration = performance.now() - startTime;
          this.recordPerformance("search", duration);
          this.emitUIEvent("search_performed", {
            query,
            fromCache: true,
            duration,
          });
          return;
        }

        // Perform search
        const searchResults = this.performModelSearch(this.state.models, query);

        // Cache result
        this.searchCache.set(query.toLowerCase(), searchResults);

        // Update state
        this.setState({
          filteredModels: searchResults,
          searchQuery: query,
        });

        const duration = performance.now() - startTime;
        this.recordPerformance("search", duration);

        this.emitUIEvent("search_performed", {
          query,
          resultCount: searchResults.length,
          duration,
        });
      } catch (error) {
        this.emit("error", { operation: "search", error: error.message });
      } finally {
        this.debounceTimers.delete("search");
      }
    }, this.config.debounceDelay);

    this.debounceTimers.set("search", timer);
  }

  /**
   * Get recommendations with UI state integration
   */
  async getRecommendations(context?: {
    task?: string;
    budget?: string;
  }): Promise<void> {
    const startTime = performance.now();

    try {
      this.setState({ isLoading: true });

      const recommendations =
        await this.sessionManager.getRecommendations(context);

      this.setState({
        recommendations,
        isLoading: false,
      });

      const duration = performance.now() - startTime;
      this.recordPerformance("recommend", duration);

      this.emitUIEvent("recommendation_requested", {
        context,
        resultCount: recommendations.length,
        duration,
      });
    } catch (error) {
      this.setState({
        recommendations: [],
        isLoading: false,
        error: error.message,
      });

      this.emit("error", { operation: "recommend", error: error.message });
    }
  }

  /**
   * Get current UI state (optimized for rendering)
   */
  getState(): UIState {
    return { ...this.state };
  }

  /**
   * Get virtualized model list for large datasets
   */
  getVirtualizedModels(
    startIndex: number = 0,
    count: number = this.config.batchSize,
  ): {
    models: ModelInfo[];
    totalCount: number;
    hasMore: boolean;
  } {
    const models = this.state.filteredModels;
    const endIndex = Math.min(startIndex + count, models.length);

    return {
      models: models.slice(startIndex, endIndex),
      totalCount: models.length,
      hasMore: endIndex < models.length,
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): UIPerformanceMetrics & {
    config: UIConfig;
    cacheStats: {
      modelCache: number;
      filterCache: number;
      searchCache: number;
    };
  } {
    return {
      ...this.performanceMetrics,
      config: this.config,
      cacheStats: {
        modelCache: this.modelCache.size,
        filterCache: this.filterCache.size,
        searchCache: this.searchCache.size,
      },
    };
  }

  /**
   * Clear all caches to free memory
   */
  clearCaches(): void {
    this.modelCache.clear();
    this.filterCache.clear();
    this.searchCache.clear();

    this.emit("caches_cleared", {
      timestamp: new Date(),
    });
  }

  /**
   * Reset UI state
   */
  reset(): void {
    this.state = this.initializeState();
    this.performanceMetrics = this.initializeMetrics();
    this.clearCaches();

    this.emit("ui_reset", {
      timestamp: new Date(),
    });
  }

  // Private methods

  private initializeState(): UIState {
    return {
      models: [],
      filteredModels: [],
      recommendations: [],
      activeFilter: {},
      searchQuery: "",
      isLoading: false,
      lastUpdate: new Date(),
    };
  }

  private initializeMetrics(): UIPerformanceMetrics {
    return {
      renderTime: 0,
      filterTime: 0,
      searchTime: 0,
      lastResponseTime: 0,
      averageResponseTime: 0,
      responseTimeHistory: [],
    };
  }

  private async loadModels(): Promise<ModelInfo[]> {
    // Get models from session manager's engine
    const engine = (this.sessionManager as any).engine;
    return engine.list();
  }

  private setState(update: Partial<UIState>): void {
    this.state = {
      ...this.state,
      ...update,
      lastUpdate: new Date(),
    };

    // Schedule efficient render
    this.scheduleRender();
  }

  private scheduleRender(): void {
    if (this.updateScheduled) return;

    this.updateScheduled = true;

    // Use RAF for smooth rendering
    if (typeof requestAnimationFrame !== "undefined") {
      requestAnimationFrame(() => {
        this.performRender();
        this.updateScheduled = false;
      });
    } else {
      // Fallback for Node.js environment
      setImmediate(() => {
        this.performRender();
        this.updateScheduled = false;
      });
    }
  }

  private performRender(): void {
    const startTime = performance.now();

    try {
      this.emit("state_updated", this.state);

      // Process render queue
      while (this.renderQueue.length > 0) {
        const renderFn = this.renderQueue.shift();
        if (renderFn) renderFn();
      }

      const duration = performance.now() - startTime;
      this.recordPerformance("render", duration);
    } catch (error) {
      this.emit("render_error", { error: error.message });
    }
  }

  private applyModelFilter(
    models: ModelInfo[],
    filter: ModelFilter,
  ): ModelInfo[] {
    return models.filter((model) => {
      if (filter.provider && model.provider !== filter.provider) return false;
      if (filter.capability && !model.capabilities.includes(filter.capability))
        return false;
      if (filter.maxLatency && model.latencyMs > filter.maxLatency)
        return false;
      if (
        filter.maxCost &&
        model.price.input + model.price.output > filter.maxCost
      )
        return false;

      return true;
    });
  }

  private performModelSearch(models: ModelInfo[], query: string): ModelInfo[] {
    const lowerQuery = query.toLowerCase();

    return models
      .filter(
        (model) =>
          model.name.toLowerCase().includes(lowerQuery) ||
          model.provider.toLowerCase().includes(lowerQuery) ||
          model.capabilities.some((cap) =>
            cap.toLowerCase().includes(lowerQuery),
          ),
      )
      .sort((a, b) => {
        // Boost exact name matches
        const aNameMatch = a.name.toLowerCase().includes(lowerQuery);
        const bNameMatch = b.name.toLowerCase().includes(lowerQuery);

        if (aNameMatch && !bNameMatch) return -1;
        if (!aNameMatch && bNameMatch) return 1;

        return 0;
      });
  }

  private recordPerformance(operation: string, duration: number): void {
    if (!this.config.enablePerfMetrics) return;

    this.performanceMetrics.lastResponseTime = duration;
    this.performanceMetrics.responseTimeHistory.push(duration);

    // Keep history limited
    if (
      this.performanceMetrics.responseTimeHistory.length >
      this.config.maxHistoryEntries
    ) {
      this.performanceMetrics.responseTimeHistory.shift();
    }

    // Update average
    this.performanceMetrics.averageResponseTime =
      this.performanceMetrics.responseTimeHistory.reduce((a, b) => a + b, 0) /
      this.performanceMetrics.responseTimeHistory.length;

    // Update operation-specific metrics
    switch (operation) {
      case "render":
        this.performanceMetrics.renderTime = duration;
        break;
      case "filter":
        this.performanceMetrics.filterTime = duration;
        break;
      case "search":
        this.performanceMetrics.searchTime = duration;
        break;
    }

    // Emit performance event if slow
    if (duration > this.config.maxResponseTime) {
      this.emit("slow_operation", {
        operation,
        duration,
        target: this.config.maxResponseTime,
      });
    }
  }

  private emitUIEvent(type: UIEvent["type"], data?: any): void {
    const event: UIEvent = {
      type,
      timestamp: new Date(),
      data,
    };

    this.emit("ui_event", event);
    this.emit(type, event);
  }

  private setupEventHandlers(): void {
    // Listen to session manager events
    this.sessionManager.on("model_changed", (data) => {
      this.setState({ selectedModel: data.model });
    });

    this.sessionManager.on("recommendations_generated", (data) => {
      // Will be handled by explicit getRecommendations call
    });

    this.sessionManager.on("session_error", (data) => {
      this.setState({ error: data.error });
    });
  }

  private startPerformanceMonitoring(): void {
    if (!this.config.enablePerfMetrics) return;

    // Monitor performance every 10 seconds
    setInterval(() => {
      const metrics = this.getPerformanceMetrics();

      this.emit("performance_report", {
        timestamp: new Date(),
        metrics,
      });

      // Auto-clear old cache entries if performance is degrading
      if (metrics.averageResponseTime > this.config.maxResponseTime * 1.5) {
        this.clearCaches();
        this.emit("performance_optimization", {
          reason: "Response time degradation",
          action: "Cache cleared",
        });
      }
    }, 10000);
  }
}

export default ReactiveUI;
