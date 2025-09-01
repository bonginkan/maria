/**
 * Default Configuration Values
 * All hardcoded values should be defined here
 * Environment variables take precedence over these defaults
 */

import { getVersion } from "../utils/version";

// Helper function to parse comma-separated lists
const parseList = (
  envVar: string | undefined,
  defaultList: string[],
): string[] => {
  if (!envVar) return defaultList;
  return envVar
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
};

export const DEFAULT_MEMORY_CONFIG = {
  system1: {
    maxKnowledgeNodes: 1000,
    embeddingDimension: 1536,
    cacheSize: 100,
    compressionThreshold: 0.75,
    accessDecayRate: 0.03,
  },
  system2: {
    maxReasoningTraces: 100,
    qualityThreshold: 0.75,
    reflectionFrequency: 12,
    enhancementEvaluationInterval: 6,
  },
  coordinator: {
    syncInterval: 5000,
    conflictResolutionStrategy: "balanced" as const,
    learningRate: 0.15,
    adaptationThreshold: 0.7,
  },
  performance: {
    targetLatency: 50,
    maxMemoryUsage: 256,
    cacheStrategy: "lru" as const,
    preloadPriority: "medium" as const,
    backgroundOptimization: true,
    batchSize: 10,
  },
} as const;

export const DEFAULT_ROUTER_CONFIG = {
  confidenceThreshold: 0.7,
  enableLearning: true,
  supportedLanguages: ["en", "ja", "zh", "ko", "vi"] as const, // Fixed language codes
  enableConfirmation: false,
  maxSuggestions: 5,
  enableFuzzyMatch: true,
} as const;

export const DEFAULT_UI_CONFIG = {
  width: 120,
  borderColor: "white" as const,
  promptColor: "cyan" as const,
  textColor: "white" as const,
  promptSymbol: ">",
  placeholder: "Type your command or question here...",
  enablePasteDetection: true,
  enableFileDrop: true,
  showModeIndicator: true,
  animationSpeed: 100,
  enableSlashCommandSuggestions: true,
} as const;

export const DEFAULT_PATHS = {
  avatar: "face_only_96x96_ramp.txt", // 相対パスに変更
} as const;

export const DEFAULT_ENV_VARS = {
  OPENAIAPI_KEY: "OPENAI_API_KEY",
  ANTHROPICAPI_KEY: "ANTHROPIC_API_KEY",
  GOOGLEAI_API_KEY: "GOOGLE_AI_API_KEY",
} as const;

export const DEFAULT_DUMMY_VALUES = {
  lintScore: 94,
  typeCoverage: 87,
  securityScore: 89,
  defaultModel: "gpt-4 (openai)",
  cognitiveModes: 58, // Updated to actual count
} as const;

export const DEFAULT_HELP_TEXTS = {
  priorityUsage:
    "Usage: /priority <privacy-first|performance|cost-effective|auto>",
  githubAppUrl: "https://github.com/apps/maria-ai-assistant",
  cognitiveModesCount: 58, // Updated to actual count
  priorityModes: [
    "privacy-first",
    "performance",
    "cost-effective",
    "auto",
  ] as const,
} as const;

export const DEFAULT_COMMAND_OUTPUTS = {
  setupEnvVars: [
    "export OPENAI_API_KEY=",
    "export ANTHROPIC_API_KEY=",
    "export GOOGLE_AI_API_KEY=",
  ] as const,
  modelSelector: {
    currentModel: "gpt-4 (openai) - Default",
    provider: "openai",
  },
} as const;

// Provider Preferences
export const DEFAULT_PROVIDER_PREFS = {
  provider: process.env.AI_PROVIDER || "openai",
  model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  offline: process.env.OFFLINE_MODE === "true",
  debug: process.env.DEBUG === "true",
  priority: "auto" as
    | "privacy-first"
    | "performance"
    | "cost-effective"
    | "auto",
  maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || "2000", 10),
  temperature: parseFloat(process.env.OPENAI_TEMPERATURE || "0.7"),
} as const;

// AI Provider Configurations
export const AI_PROVIDERS_CONFIG = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    availableModels: parseList(process.env.OPENAI_MODELS, [
      "gpt-5-mini-2025-08-07",
      "gpt-5-mini",
      "gpt-4",
      "gpt-4-turbo",
      "o1-preview",
      "o1-mini",
    ]),
    endpoint:
      process.env.OPENAI_ENDPOINT ||
      "https://api.openai.com/v1/chat/completions",
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || "2000", 10),
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || "0.7"),
    timeout: parseInt(process.env.OPENAI_TIMEOUT || "30000", 10),
    maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES || "3", 10),
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.ANTHROPIC_MODEL || "claude-3-sonnet-20240229",
    availableModels: parseList(process.env.ANTHROPIC_MODELS, [
      "claude-3-opus-20240229",
      "claude-3-sonnet-20240229",
      "claude-3-haiku-20240307",
    ]),
    endpoint:
      process.env.ANTHROPIC_ENDPOINT || "https://api.anthropic.com/v1/messages",
    maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || "2000", 10),
    temperature: parseFloat(process.env.ANTHROPIC_TEMPERATURE || "0.7"),
  },
  ollama: {
    enabled: process.env.OLLAMA_ENABLED === "true",
    apiUrl: process.env.OLLAMA_API_URL || "http://localhost:11434",
    defaultModel: process.env.OLLAMA_DEFAULT_MODEL || "llama3.2:3b",
    maxTokens: parseInt(process.env.OLLAMA_MAX_TOKENS || "4096", 10),
  },
  lmstudio: {
    enabled: process.env.LMSTUDIO_ENABLED === "true",
    apiUrl: process.env.LMSTUDIO_API_URL || "http://localhost:1234",
    defaultModel: process.env.LMSTUDIO_DEFAULT_MODEL || "gpt-oss-120b",
    maxTokens: parseInt(process.env.LMSTUDIO_MAX_TOKENS || "8192", 10),
  },
} as const;

// Startup Configuration
export const DEFAULT_STARTUP = {
  showLogo: true,
  totalProvidersHint: 8,
  startupTimeout: 10000,
  showLoadingAnimation: true,
  checkForUpdates: false,
} as const;

// HSR System Configuration
export const DEFAULT_HSR_CONFIG = {
  enableHumanInterruption: true,
  interruptionCheckInterval: 100,
  autoSaveInterval: 30000,
  maxOperationTime: 60000,
  safetyLevel: "medium" as "low" | "medium" | "high",
} as const;

// RL Evolution Configuration
export const DEFAULT_RL_CONFIG = {
  learningRate: 0.001,
  discountFactor: 0.99,
  epsilon: 0.1,
  replayBufferSize: 10000,
  batchSize: 32,
  updateFrequency: 100,
  enablePPO: true,
  enableDPO: false,
} as const;

// Application Version
export const APP_VERSION = process.env.npm_package_version || getVersion();

// Export all configurations as a single object
export const DEFAULT_CONFIG = {
  version: APP_VERSION,
  memory: DEFAULT_MEMORY_CONFIG,
  router: DEFAULT_ROUTER_CONFIG,
  ui: DEFAULT_UI_CONFIG,
  paths: DEFAULT_PATHS,
  env: DEFAULT_ENV_VARS,
  values: DEFAULT_DUMMY_VALUES,
  help: DEFAULT_HELP_TEXTS,
  command: DEFAULT_COMMAND_OUTPUTS,
  provider: DEFAULT_PROVIDER_PREFS,
  providers: AI_PROVIDERS_CONFIG,
  startup: DEFAULT_STARTUP,
  hsr: DEFAULT_HSR_CONFIG,
  rl: DEFAULT_RL_CONFIG,
} as const;

export default DEFAULT_CONFIG;
