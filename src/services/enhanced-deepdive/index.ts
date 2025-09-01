/**
 * Enhanced Deep Dive Service
 * Export module for enhanced deep dive functionality
 */

export * from "./EnhancedDeepDiveAnalyzer";

// Service factory
import { EnhancedDeepDiveAnalyzer } from "./EnhancedDeepDiveAnalyzer";

let instance: EnhancedDeepDiveAnalyzer | null = null;

export function getEnhancedDeepDiveService(): EnhancedDeepDiveAnalyzer {
  if (!instance) {
    instance = new EnhancedDeepDiveAnalyzer();
  }
  return instance;
}

export async function initializeEnhancedDeepDive(): Promise<EnhancedDeepDiveAnalyzer> {
  const _service = getEnhancedDeepDiveService();
  await _service.initialize();
  return _service;
}
