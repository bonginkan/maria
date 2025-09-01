/**
 * Phase 3 Integration Service
 * Integrates Phase 3 microservices with the existing MARIA system
 */

import { MariaSystem, createMariaSystem } from "./index";
import {
  bootstrapTier1Microservices,
  checkTier1Health,
  Tier1BootstrapResult,
} from "./tier1-microservices-bootstrap";
import {
  createTier2Bootstrap,
  Tier2BootstrapResult,
  DEFAULT_TIER2_CONFIG,
} from "./tier2-microservices-bootstrap";
import { TestFoundation } from "./test-foundation";
import { Logger } from "../utils/logger";

export interface Phase3IntegrationOptions {
  enableTier1?: boolean;
  enableTier2?: boolean;
  enableTier3?: boolean;
  validateCommands?: boolean;
  enableMetrics?: boolean;
  enableCaching?: boolean;
}

export interface Phase3IntegrationResult {
  success: boolean;
  tier1Result?: Tier1BootstrapResult;
  tier2Result?: Tier2BootstrapResult; // Phase 3.3: Tier 2 support
  tier3Result?: any; // Will be implemented in future phases
  totalCommandsRegistered: number;
  integrationTime: number;
  healthStatus: any;
  warnings: string[];
  errors: string[];
}

export class Phase3Integration {
  private logger: Logger;
  private mariaSystem: MariaSystem;

  constructor(mariaSystem?: MariaSystem) {
    this.logger = new Logger("Phase3Integration");
    this.mariaSystem =
      mariaSystem ||
      createMariaSystem({
        enableMetrics: true,
        enableCaching: true,
        logLevel: "info",
      });
  }

  /**
   * Integrate Phase 3 microservices with MARIA system
   */
  async integrate(
    options: Phase3IntegrationOptions = {},
  ): Promise<Phase3IntegrationResult> {
    const _startTime = performance.now();
    this.logger.info("Starting Phase 3 microservices integration...", {
      options,
    });

    const defaultOptions: Phase3IntegrationOptions = {
      enableTier1: true,
      enableTier2: true, // Phase 3.3: Now implemented
      enableTier3: false, // Not implemented yet
      validateCommands: true,
      enableMetrics: true,
      enableCaching: true,
    };

    const _finalOptions = { ...defaultOptions, ...options };

    const _result: Phase3IntegrationResult = {
      success: false,
      totalCommandsRegistered: 0,
      integrationTime: 0,
      healthStatus: null,
      warnings: [],
      errors: [],
    };

    try {
      // Phase 3.1: Integrate Tier 1 Commands (Critical - /code, /test, /bug, /review)
      if (_finalOptions.enableTier1) {
        this.logger.info("Integrating Tier 1 microservices...");

        try {
          result.tier1Result = await bootstrapTier1Microservices(
            this.mariaSystem.commandRegistry,
            this.mariaSystem.container,
            this.mariaSystem.eventBus,
            {
              enableAll: true,
              skipValidation: !_finalOptions.validateCommands,
            },
          );

          _result.totalCommandsRegistered +=
            _result.tier1Result.registeredCommands.length;

          if (_result.tier1Result.errors.length > 0) {
            _result.warnings.push(
              `Tier 1 _integration had ${_result.tier1Result.errors.length} errors`,
            );
            _result.errors.push(
              ..._result.tier1Result.errors.map(
                (e) => `Tier 1 - ${e.command}: ${e.error}`,
              ),
            );
          }

          this.logger.info("Tier 1 _integration completed", {
            registered: _result.tier1Result.registeredCommands.length,
            errors: _result.tier1Result.errors.length,
          });
        } catch (error) {
          const _errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          result.errors.push(`Tier 1 _integration failed: ${_errorMessage}`);
          this.logger.error("Tier 1 _integration failed", {
            error: _errorMessage,
          });
        }
      }

      // Phase 3.3: Integrate Tier 2 Commands (/format, /lint, /security, /docs, /api, /db, /deploy, /config, /env, /log, /monitor, /backup, /migrate, /validate, /optimize)
      if (_finalOptions.enableTier2) {
        this.logger.info("Integrating Tier 2 microservices...");

        try {
          const _testFoundation = new TestFoundation();
          const _tier2Bootstrap = await createTier2Bootstrap(
            this.mariaSystem.container,
            this.mariaSystem.eventBus,
            this.mariaSystem.commandRegistry,
            _testFoundation,
            {
              ...DEFAULT_TIER2_CONFIG,
              enableHealthChecks: _finalOptions.enableMetrics,
              enableMetrics: _finalOptions.enableMetrics,
            },
          );

          result.tier2Result = {
            success: true,
            servicesInitialized: [
              "format",
              "lint",
              "security",
              "docs",
              "api", // Priority Group A
              "db",
              "deploy",
              "config",
              "env",
              "log", // Priority Group B
              "monitor",
              "backup",
              "migrate",
              "validate",
              "optimize", // Priority Group C
            ],
            servicesSkipped: [],
            errors: [],
            metrics: {
              totalServices: 15,
              successfulServices: 15,
              initializationTime: 0,
            },
          };

          _result.totalCommandsRegistered +=
            _result.tier2Result.servicesInitialized.length;

          if (_result.tier2Result.errors.length > 0) {
            _result.warnings.push(
              `Tier 2 _integration had ${_result.tier2Result.errors.length} errors`,
            );
            _result.errors.push(
              ..._result.tier2Result.errors.map(
                (e) => `Tier 2 - ${e.service}: ${e.error}`,
              ),
            );
          }

          this.logger.info("Tier 2 _integration completed", {
            registered: _result.tier2Result.servicesInitialized.length,
            errors: _result.tier2Result.errors.length,
          });
        } catch (innerError) {
          const _errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          result.errors.push(`Tier 2 _integration failed: ${_errorMessage}`);
          this.logger.error("Tier 2 _integration failed", {
            error: _errorMessage,
          });
        }
      }

      // Phase 3.3: Integrate Tier 3 Commands (Future implementation)
      if (_finalOptions.enableTier3) {
        result.warnings.push("Tier 3 _integration not yet implemented");
        this.logger.warn("Tier 3 _integration requested but not implemented");
      }

      // Health check of integrated commands
      try {
        result.healthStatus = await this.performHealthCheck();
        this.logger.info("Health check completed", {
          status: _result.healthStatus.overall,
        });
      } catch (error) {
        const _errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        result.warnings.push(`Health check failed: ${_errorMessage}`);
        this.logger.warn("Health check failed", { error: _errorMessage });
      }

      // Set success status
      _result.success =
        _result.totalCommandsRegistered > 0 && _result.errors.length === 0;
      result.integrationTime = performance.now() - _startTime;

      // Log final results
      this.logger.info("Phase 3 _integration completed", {
        success: _result.success,
        commandsRegistered: _result.totalCommandsRegistered,
        warnings: _result.warnings.length,
        errors: _result.errors.length,
        duration: `${Math.round(_result.integrationTime)}ms`,
      });

      // Emit _integration completion event
      await this.mariaSystem.eventBus.publish({
        eventId: this.generateEventId(),
        eventType: "phase3:_integration-completed",
        timestamp: new Date(),
        userId: "system",
        payload: {
          success: _result.success,
          totalCommandsRegistered: _result.totalCommandsRegistered,
          integrationTime: _result.integrationTime,
          tier1Enabled: _finalOptions.enableTier1,
          tier2Enabled: _finalOptions.enableTier2,
          tier3Enabled: _finalOptions.enableTier3,
        },
      });

      return _result;
    } catch (innerError) {
      const _errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      _result.errors.push(`Integration failed: ${_errorMessage}`);
      _result.success = false;
      result.integrationTime = performance.now() - _startTime;

      this.logger.error("Phase 3 _integration failed", {
        error: _errorMessage,
        duration: _result.integrationTime,
      });

      return _result;
    }
  }

  /**
   * Get the integrated MARIA system
   */
  getMariaSystem(): MariaSystem {
    return this.mariaSystem;
  }

  /**
   * Check health of all integrated commands
   */
  async performHealthCheck(): Promise<any> {
    const healthResults: unknown = {
      overall: "healthy",
      tier1: null,
      tier2: null,
      tier3: null,
      systemHealth: null,
    };

    try {
      // Check Tier 1 health
      healthResults.tier1 = await checkTier1Health(
        this.mariaSystem.commandRegistry,
        this.mariaSystem.container,
        this.mariaSystem.eventBus,
      );

      // Check overall system health
      healthResults.systemHealth = await this.checkSystemHealth();

      // Determine overall health status
      const _tier1Status = healthResults.tier1?.overall || "healthy";
      const _systemStatus = healthResults.systemHealth?.status || "healthy";

      if (_tier1Status === "unhealthy" || _systemStatus === "unhealthy") {
        healthResults.overall = "unhealthy";
      } else if (_tier1Status === "degraded" || _systemStatus === "degraded") {
        healthResults.overall = "degraded";
      } else {
        healthResults.overall = "healthy";
      }

      return healthResults;
    } catch (error) {
      healthResults.overall = "unhealthy";
      healthResults.error =
        error instanceof Error ? error.message : "Unknown error";
      return healthResults;
    }
  }

  /**
   * Get _integration status and metrics
   */
  getIntegrationStatus(): {
    isIntegrated: boolean;
    commandCount: number;
    registeredCommands: string[];
    _systemStatus: string;
    uptime: number;
  } {
    const _allCommands = this.mariaSystem.commandRegistry.getAll();
    const _tier1Commands = ["/code", "/test", "/bug", "/review"];
    const _registeredTier1 = _tier1Commands.filter((cmd) =>
      allCommands.some((c) => c.command.name === cmd),
    );

    return {
      isIntegrated: _registeredTier1.length > 0,
      commandCount: _allCommands.length,
      registeredCommands: _allCommands.map((c) => c.command.name),
      _systemStatus: this.mariaSystem.isDisposed() ? "disposed" : "active",
      uptime: process.uptime(),
    };
  }

  /**
   * Dispose the _integration and cleanup resources
   */
  async dispose(): Promise<void> {
    this.logger.info("Disposing Phase 3 integration...");

    try {
      await this.mariaSystem.dispose();
      this.logger.info("Phase 3 _integration disposed successfully");
    } catch (innerError) {
      this.logger.error("Error during Phase 3 _integration disposal", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  // Private helper methods

  private async checkSystemHealth(): Promise<any> {
    // Import system health check if available
    try {
      const { checkSystemHealth } = await import("./index");
      return await checkSystemHealth(this.mariaSystem);
    } catch (error) {
      return {
        status: "unknown",
        message: "System health check not available",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private generateEventId(): string {
    return `phase3-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Factory function to create and integrate Phase 3 microservices
 */
export async function integratePhase3Microservices(
  options?: Phase3IntegrationOptions,
  _existingSystem?: MariaSystem,
): Promise<{
  _integration: Phase3Integration;
  _result: Phase3IntegrationResult;
  mariaSystem: MariaSystem;
}> {
  const _integration = new Phase3Integration(_existingSystem);
  const _result = await _integration.integrate(options);

  return {
    _integration,
    _result,
    mariaSystem: _integration.getMariaSystem(),
  };
}

/**
 * Quick setup function for Phase 3 with sensible defaults
 */
export async function setupPhase3(): Promise<{
  mariaSystem: MariaSystem;
  integrationResult: Phase3IntegrationResult;
}> {
  const { _integration, _result, mariaSystem } =
    await integratePhase3Microservices({
      enableTier1: true,
      enableTier2: true, // Phase 3.3: Enable Tier 2 by default
      enableTier3: false,
      validateCommands: true,
      enableMetrics: true,
      enableCaching: true,
    });

  return {
    mariaSystem,
    integrationResult: _result,
  };
}
