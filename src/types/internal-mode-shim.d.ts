/**
 * Type definitions for Internal Mode Service
 * Provides type safety for previously untyped internal mode interactions
 */

declare module "*/InternalModeService" {
  export interface InternalMode {
    id: string;
    name: string;
    description: string;
    category: string;
    symbol?: string;
    intensity?: number;
    contextual?: boolean;
  }

  export interface ModeTransition {
    from: InternalMode | null;
    to: InternalMode;
    timestamp: Date;
    source: "manual" | "auto" | "system";
    confidence?: number;
  }

  export interface ModeStatistics {
    totalModes: number;
    currentMode?: string;
    modeChanges: number;
    averageConfidence: number;
    mostUsedModes: Array<{ mode: string; count: number; lastUsed: Date }>;
    sessionDuration: number;
    transitionHistory: ModeTransition[];
  }

  export interface ModeConfig {
    showTransitions?: boolean;
    autoSwitchEnabled?: boolean;
    transitionDelay?: number;
    maxHistorySize?: number;
    debugMode?: boolean;
  }

  export interface InternalModeService {
    // Core functionality
    initialize(): Promise<void>;
    isInitialized(): boolean;
    cleanup(): Promise<void>;

    // Mode management
    getCurrentMode(): InternalMode | null;
    getAllModes(): InternalMode[];
    getModeById(id: string): InternalMode | null;
    getModesByCategory(category: string): InternalMode[];

    // Mode transitions
    setMode(
      _mode: InternalMode,
      source?: "manual" | "auto" | "system",
    ): Promise<boolean>;
    setModeById(_modeId: string, source?: "manual" | "auto"): Promise<boolean>;
    resetToDefault(): Promise<boolean>;

    // Configuration
    updateConfig(config: Partial<ModeConfig>): void;
    getConfig(): ModeConfig;

    // History and statistics
    getModeHistory(): ModeTransition[];
    getStatistics(): ModeStatistics;
    clearHistory(): void;

    // Advanced features
    suggestMode(context: string): Promise<InternalMode | null>;
    validateModeTransition(
      _from: InternalMode | null,
      to: InternalMode,
    ): boolean;

    // Event handling (if implemented)
    onModeChange?: (_transition: ModeTransition) => void;
    onError?: (_error: Error) => void;
  }

  export function getInternalModeService(): InternalModeService;
}

// Additional types for Memory System integration
declare module "*/memory-system/dual-memory-engine" {
  export interface MemoryQuery {
    query: string;
    type: "search" | "update" | "store" | "delete";
    options?: Record<string, unknown>;
  }

  export interface MemoryResult {
    success: boolean;
    data?: unknown;
    error?: string;
    timestamp: Date;
  }

  export interface DualMemoryEngine {
    initialize(): Promise<void>;
    isInitialized(): boolean;
    query(query: MemoryQuery): Promise<MemoryResult>;
    store(_data: unknown, metadata?: Record<string, unknown>): Promise<boolean>;
    cleanup(): Promise<void>;
  }
}

declare module "*/memory-system/memory-coordinator" {
  export interface CoordinatorConfig {
    syncInterval: number;
    conflictResolutionStrategy: "balanced" | "system1" | "system2";
    learningRate: number;
    adaptationThreshold: number;
  }

  export interface MemoryCoordinator {
    initialize(): Promise<void>;
    sync(): Promise<void>;
    getStatus(): {
      isActive: boolean;
      lastSync: Date;
      conflictCount: number;
    };
  }
}

// Utility types for better type inference
export type SafeAny = unknown;
export type MaybePromise<T> = T | Promise<T>;

// Enhanced type guards
export function isInternalMode(obj: unknown): obj is InternalMode {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "id" in obj &&
    "name" in obj &&
    "description" in obj &&
    "category" in obj
  );
}

export function isModeTransition(obj: unknown): obj is ModeTransition {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "to" in obj &&
    "timestamp" in obj &&
    "source" in obj
  );
}
