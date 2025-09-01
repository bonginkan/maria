/**
 * Auto Research Service Module
 * Export all auto-research components
 */

export * from "./URLDetectionService";
export * from "./AsyncResearchQueue";
export * from "./AutoResearchService";

// Service factory
import { AutoResearchService } from "./AutoResearchService";

let instance: AutoResearchService | null = null;

export function getAutoResearchService(): AutoResearchService {
  if (!instance) {
    instance = new AutoResearchService();
  }
  return instance;
}

export async function initializeAutoResearch(): Promise<AutoResearchService> {
  const _service = getAutoResearchService();
  await _service.initialize();
  return _service;
}
