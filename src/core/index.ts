/**
 * MARIA Phase 3 Core Infrastructure - Types Only Export
 */

// Core Infrastructure Type Exports Only
export type * from "./base-command";
export type * from "./di-container";
export type * from "./event-bus";
export type * from "./command-registry";
export type * from "./test-foundation";

// System Type Interfaces Only
/* TODO(types-only): value import removed: import { DIContainer, createContainer } from './di-container'; */
/* TODO(types-only): value import removed: import { EventBus, getEventBus } from './event-bus'; */

export interface MariaSystemOptions {
  logLevel?: "debug" | "info" | "warn" | "error";
  enableMetrics?: boolean;
  enableCaching?: boolean;
  maxCommands?: number;
  eventBusMaxListeners?: number;
}

export interface MariaSystem {
  container: any; // DIContainer;
  eventBus: any; // EventBus;
  commandRegistry: any; // CommandRegistry;
  logger: any; // Logger;
  dispose(): Promise<void>;
  isDisposed(): boolean;
}

/* TODO(types-only): value export removed: function createMariaSystem */
/* TODO(types-only): value export removed: function createSystemBuilder */
/* TODO(types-only): value export removed: function getDefaultSystem */
/* TODO(types-only): value export removed: function resetDefaultSystem */

// System health check
export interface SystemHealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: Date;
  components: {
    container: ComponentHealth;
    eventBus: ComponentHealth;
    commandRegistry: ComponentHealth;
  };
  metrics: SystemMetrics;
}

export interface ComponentHealth {
  status: "healthy" | "degraded" | "unhealthy";
  message: string;
  details?: Record<string, any>;
}

export interface SystemMetrics {
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  registeredCommands: number;
  activeEventSubscriptions: number;
  serviceResolutions: number;
}

/* TODO(types-only): value export removed: function checkSystemHealth */
/* TODO(types-only): value export removed: function checkContainerHealth */
/* TODO(types-only): value export removed: function checkEventBusHealth */
/* TODO(types-only): value export removed: function checkRegistryHealth */
/* TODO(types-only): value export removed: function createTestSystem */
/* TODO(types-only): value export removed: function createProductionSystem */
/* TODO(types-only): value export removed: const _VERSION, _BUILD_DATE, _SYSTEM_NAME */

export // TODO: Implement
 {}; // types-only barrel
