/**
 * MARIA - Intelligent CLI Assistant
 * Entry point for the library
 */

// Core exports
export { MariaAI } from './maria-ai';
export { createCLI } from './cli';

// Service exports
export * from './services';
export * from './services/local';

// Provider exports
export * from './providers';

// Type exports
export * from './interfaces';

// Utility exports
export * from './utils';

// Version
export const VERSION = '1.0.0-alpha.1';