/**
 * Core exports for Internal Mode Microservices
 */

// Types
export * from "./types";

// Core services
export { ServiceRegistry } from "./ServiceRegistry";
export { ServiceBus } from "./ServiceBus";
export { ServiceLoader } from "./ServiceLoader";
export { BaseService } from "./BaseService";

// Decorators
export * from "./decorators";

// Re-export reflect-metadata for convenience
import "reflect-metadata";

// Note: Plugins are no longer re-exported here to avoid circular dependencies
// Import plugins directly from '../plugins' where needed

// Phase 2 Services - Import directly from '../services' to avoid circular deps

// Phase 3 Mode Plugin System - Import directly from '../plugins' to avoid circular deps
