/**
 * Multi-Agent System Exports
 * Main entry point for the DeepCode-inspired multi-agent system
 */

// Core system exports
export { MultiAgentSystem } from './multi-agent-system';
export { CentralOrchestrator } from './orchestrator';
export { BaseAgent } from './base-agent';

// Type exports
export * from './types';

// Specialized agents
export * from './specialized';

// Convenience function to get system instance
export function getMultiAgentSystem() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('./multi-agent-system').MultiAgentSystem.getInstance();
}
