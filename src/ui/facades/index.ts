/**
 * UI Facades
 *
 * This module provides facade interfaces for UI components to access
 * service layer functionality without direct imports.
 * This maintains the architectural boundary between UI and Services.
 *
 * @since v2.2.5
 */

// Re-export types only (not implementations)
export type { CommandRecommendation } from "../../services/command-recommendation/types";

export type {
  Episode,
  Policy,
  EvolutionMetrics,
} from "../../services/rl-evolution/types";

// Facade interfaces for service access
export interface EvolutionFacade {
  getEngine(): any; // Returns RLEvolutionEngine instance
  getRealTimeLearning(): any; // Returns RealTimeLearning instance
  getReporter(): any; // Returns EvolutionReporter instance
}

export interface HSRFacade {
  getEngine(): any; // Returns HSREngine instance
  getBrandedStyle(): any; // Returns HSRBrandedStyle
}

export interface PerformanceFacade {
  getProfiler(): any; // Returns ContextSwitchProfiler instance
}

// Factory function to create facades (to be injected from service layer)
let evolutionFacade: EvolutionFacade | null = null;
let hsrFacade: HSRFacade | null = null;
let performanceFacade: PerformanceFacade | null = null;

export function setEvolutionFacade(facade: EvolutionFacade): void {
  evolutionFacade = facade;
}

export function getEvolutionFacade(): EvolutionFacade | null {
  return evolutionFacade;
}

export function setHSRFacade(facade: HSRFacade): void {
  hsrFacade = facade;
}

export function getHSRFacade(): HSRFacade | null {
  return hsrFacade;
}

export function setPerformanceFacade(facade: PerformanceFacade): void {
  performanceFacade = facade;
}

export function getPerformanceFacade(): PerformanceFacade | null {
  return performanceFacade;
}
