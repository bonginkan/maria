/**
 * Core exports for Internal Mode Microservices
 */

// Types
export * from './types';

// Core services
export { ServiceRegistry } from './ServiceRegistry';
export { ServiceBus } from './ServiceBus';
export { ServiceLoader } from './ServiceLoader';
export { BaseService } from './BaseService';

// Decorators
export * from './decorators';

// Re-export reflect-metadata for convenience
import 'reflect-metadata';

// Phase 2 Services
export * from '../services';

// Phase 3 Mode Plugin System
export * from '../plugins';
