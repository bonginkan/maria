/**
 * SystemCommandsV2 Module with DRY-RUN Safety Mechanism
 *
 * Phase 3.3 - System Commands V2 Architecture
 * Week 3 Implementation: ConfigCommand with DRY-RUN safety mechanism
 */

// Contracts
export * from "./contracts/SystemCommandContract";

// Ports (Interfaces)
export * from "./ports/MonitoringPort";
export * from "./ports/ProviderHealthPort";
export * from "./ports/ConfigPort";
export * from "./ports/TimeSeriesPort";

// Base Classes
export * from "./base/SystemCommandBase";

// Core Engine
export * from "./core/SystemEngine";
export * from "./core/ProviderProbeCache";

// Adapters (Node.js implementations)
export * from "./adapters/NodeMonitoringAdapter";
export * from "./adapters/ConfigPortAdapter";

// Commands
// Note: StatusCommandV2 imports disabled due to direct slash-commands restriction
export * from "./commands/ConfigCommand";

// CLI Integration
export * from "./cli/ConfigCLI";

// Factory Pattern
export * from "./factory/SystemCommandFactory";
export * from "./factory/ConfigCommandFactory";

// Environment Detection
export * from "./detectors/EnvironmentDetector";

// Performance Optimization (Week 4)
export * from "./performance/PerformanceEngine";
export * from "./performance/ParallelExecutionEngine";
export * from "./performance/IntelligentCacheManager";
export * from "./performance/PerformanceMonitor";
export * from "./performance/PerformanceOptimizationFactory";

// Re-export key types
export type {
  SystemCommandContract,
  CommandResultV2,
  ExecutionOptions,
  SystemHealth,
  SystemMetrics,
  ProviderHealth,
  ValidationResult,
  MigrationResult,
} from "./contracts/SystemCommandContract";

export type { SystemCommandDependencies } from "./base/SystemCommandBase";

export type {
  ConfigPort,
  SetOptions,
  ConfigLayer,
  LayeredConfig,
  ConfigTemplate,
  ConfigHistoryEntry,
  TemplateOptions,
} from "./ports/ConfigPort";

export type {
  ConfigPreviewResult,
  ConfigChange,
  SafetyRisk,
  AffectedConfig,
} from "./commands/ConfigCommand";

export type { ConfigCLIOptions } from "./cli/ConfigCLI";

// Quick access convenience exports
export { ConfigV2 } from "./factory/ConfigCommandFactory";

// Performance optimization integration
export const performanceOptimization = {
  /**
   * Get performance optimization factory instance
   */
  getFactory: () =>
    import("./performance/PerformanceOptimizationFactory").then((m) =>
      m.PerformanceOptimizationFactory.getInstance(),
    ),

  /**
   * Optimize single command execution
   */
  async optimizeCommand(commandId: string, command: any) {
    const { PerformanceOptimizationFactory } = await import(
      "./performance/PerformanceOptimizationFactory"
    );
    return await PerformanceOptimizationFactory.optimizeCommand(
      commandId,
      command,
    );
  },

  /**
   * Get system performance report
   */
  async getReport() {
    const { PerformanceOptimizationFactory } = await import(
      "./performance/PerformanceOptimizationFactory"
    );
    return PerformanceOptimizationFactory.getSystemReport();
  },
};

// System-level integration
export const systemCommandsV2 = {
  /**
   * Get system factory instance
   */
  getFactory: () =>
    import("./factory/SystemCommandFactory").then((m) =>
      m.SystemCommandFactory.getInstance(),
    ),

  /**
   * Initialize system with MARIA components
   */
  async initialize(providerManager?: any, configManager?: any) {
    const { SystemCommandFactory } = await import(
      "./factory/SystemCommandFactory"
    );
    const factory = SystemCommandFactory.getInstance();

    if (providerManager && configManager) {
      factory.setSystemComponents(providerManager, configManager);
    }

    // Initialize ConfigCommandFactory
    const configFactory = factory.getConfigCommandFactory();
    await configFactory.initialize();

    // Set up default system configuration
    await factory.initializeDefaultConfig();

    return factory;
  },

  /**
   * Create configuration command with DRY-RUN
   */
  async createConfigCommand(
    operation: string,
    args: any[] = [],
    options: any = {},
  ) {
    const { SystemCommandFactory } = await import(
      "./factory/SystemCommandFactory"
    );
    const factory = SystemCommandFactory.getInstance();
    const configFactory = factory.getConfigCommandFactory();

    return configFactory.createSystemCommand(operation, args, {
      dryRun: true, // Default to safe mode
      interactive: true,
      ...options,
    });
  },
};
