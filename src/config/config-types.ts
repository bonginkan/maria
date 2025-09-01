/**
 * Configuration Type Definitions
 * Type definitions for default configuration values
 */

export interface MemorySystemConfig {
  system1: {
    maxKnowledgeNodes: number;
    embeddingDimension: number;
    cacheSize: number;
    compressionThreshold: number;
    accessDecayRate: number;
  };
  system2: {
    maxReasoningTraces: number;
    qualityThreshold: number;
    reflectionFrequency: number;
    enhancementEvaluationInterval: number;
  };
  coordinator: {
    syncInterval: number;
    conflictResolutionStrategy: "balanced" | "system1" | "system2";
    learningRate: number;
    adaptationThreshold: number;
  };
  performance: {
    targetLatency: number;
    maxMemoryUsage: number;
    cacheStrategy: "lru" | "fifo";
    preloadPriority: "low" | "medium" | "high";
    backgroundOptimization: boolean;
    batchSize: number;
  };
}

export interface RouterConfig {
  confidenceThreshold: number;
  enableLearning: boolean;
  supportedLanguages: readonly string[];
  enableConfirmation: boolean;
  maxSuggestions?: number;
  enableFuzzyMatch?: boolean;
}

export interface UIConfig {
  width: number;
  borderColor: string;
  promptColor: string;
  textColor: string;
  promptSymbol: string;
  placeholder: string;
  enablePasteDetection: boolean;
  enableFileDrop: boolean;
  showModeIndicator?: boolean;
  animationSpeed?: number;
}

export interface PathsConfig {
  avatar: string;
}

export interface EnvVarsConfig {
  OPENAIAPI_KEY: string;
  ANTHROPIC_API_KEY: string;
  GOOGLE_AI_API_KEY: string;
}

export interface DummyValuesConfig {
  lintScore: number;
  typeCoverage: number;
  securityScore: number;
  defaultModel: string;
  cognitiveModes: number;
}

export interface HelpTextsConfig {
  priorityUsage: string;
  githubAppUrl: string;
  cognitiveModesCount: number;
  priorityModes: readonly string[];
}

export interface CommandOutputsConfig {
  setupEnvVars: readonly string[];
  modelSelector: {
    currentModel: string;
    provider: string;
  };
}

// Feature Flags Configuration
export interface FeatureFlagsConfig {
  enableEnhancedInterface: boolean;
  enableStreaming: boolean;
  enableAutoRouting: boolean;
  enableBgOptimization: boolean;
  enableMemorySystem: boolean;
  enableRLEvolution: boolean;
  enableHSRSystem: boolean;
  enableVisionAnalysis: boolean;
  enableProactiveReporting: boolean;
}

// Provider Preferences Configuration
export interface ProviderPrefsConfig {
  provider: string;
  model: string;
  offline: boolean;
  debug: boolean;
  priority: "privacy-first" | "performance" | "cost-effective" | "auto";
  maxTokens: number;
  temperature: number;
}

// Startup Configuration
export interface StartupConfig {
  showLogo: boolean;
  totalProvidersHint: number;
  startupTimeout: number;
  showLoadingAnimation: boolean;
  checkForUpdates: boolean;
}

// HSR System Configuration
export interface HSRConfig {
  enableHumanInterruption: boolean;
  interruptionCheckInterval: number;
  autoSaveInterval: number;
  maxOperationTime: number;
  safetyLevel: "low" | "medium" | "high";
}

// RL Evolution Configuration
export interface RLConfig {
  learningRate: number;
  discountFactor: number;
  epsilon: number;
  replayBufferSize: number;
  batchSize: number;
  updateFrequency: number;
  enablePPO: boolean;
  enableDPO: boolean;
}

// Union type for all configuration sections
export interface DefaultConfiguration {
  memory: MemorySystemConfig;
  router: RouterConfig;
  ui: UIConfig;
  paths: PathsConfig;
  env: EnvVarsConfig;
  values: DummyValuesConfig;
  help: HelpTextsConfig;
  command: CommandOutputsConfig;
  flags: FeatureFlagsConfig;
  provider: ProviderPrefsConfig;
  startup: StartupConfig;
  hsr: HSRConfig;
  rl: RLConfig;
}
