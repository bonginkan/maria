/**
 * Internal Mode System - Main Export
 *
 * Complete internal mode system for MARIA CODE CLI.
 * Provides real-time mode recognition, intelligent switching, and adaptive learning.
 */

// Core types
export * from './types';

// Main service
export {
  InternalModeService,
  getInternalModeService,
  resetInternalModeService,
} from './InternalModeService';

// Registry and definitions
export {
  ModeDefinitionRegistry,
  getModeRegistry,
  resetModeRegistry,
} from './ModeDefinitionRegistry';

// Recognition engine
export { ModeRecognitionEngine } from './ModeRecognitionEngine';

// Display management
export { ModeDisplayManager } from './ModeDisplayManager';

// History and learning
export { ModeHistoryTracker } from './ModeHistoryTracker';

// Utility functions for easy integration
export const InternalModeUtils = {
  /**
   * Initialize the complete internal mode system
   */
  async initializeSystem(config?: unknown) {
    const modeService = getInternalModeService(config);
    await modeService.initialize();
    return modeService;
  },

  /**
   * Quick mode recognition from user input
   */
  async quickRecognize(userInput: string, context?: unknown) {
    const modeService = getInternalModeService();
    return await modeService.recognizeMode(userInput, context);
  },

  /**
   * Get current mode display string
   */
  getCurrentModeDisplay(language?: string) {
    const modeService = getInternalModeService();
    const currentMode = modeService.getCurrentMode();

    if (!currentMode) return '✽ 🧠 Thinking…';

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ModeDisplayManager } = require('./ModeDisplayManager');
    const displayManager = new ModeDisplayManager(modeService.getConfig());
    return displayManager.getFormattedMode(currentMode, language);
  },

  /**
   * Reset entire system to default state
   */
  async resetSystem() {
    resetInternalModeService();
    resetModeRegistry();
  },
};

// Version information
export const INTERNAL_MODE_VERSION = '1.0.0';
export const SUPPORTED_LANGUAGES = ['en', 'ja', 'cn', 'ko', 'vn'];
export const DEFAULT_CONFIG = {
  confidenceThreshold: 0.85,
  autoSwitchEnabled: true,
  confirmationRequired: false,
  showTransitions: true,
  animationEnabled: true,
  colorEnabled: true,
  learningEnabled: true,
  patternTrackingEnabled: true,
  feedbackEnabled: true,
  defaultLanguage: 'en',
  supportedLanguages: SUPPORTED_LANGUAGES,
  maxHistoryEntries: 1000,
  maxPatterns: 500,
  recognitionTimeout: 200,
};
