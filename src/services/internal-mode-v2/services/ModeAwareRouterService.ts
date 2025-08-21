/**
 * Mode-Aware Router Service
 * Integrates Intelligent Router with Mode Plugin System for cognitive routing
 */

import { BaseService, Service } from '../core';
import {
  IntelligentRouterService,
  RoutingRequest,
  RoutingResult,
} from './IntelligentRouterService';
import { ModePluginRegistry, ModeSelection } from '../plugins/ModePluginRegistry';
import { ModeTransitionEngine, TransitionResult } from '../plugins/ModeTransitionEngine';
import { ModeContext } from '../plugins/BaseModePlugin';

export interface CognitiveRoutingRequest extends RoutingRequest {
  sessionId: string;
  enableModeRouting?: boolean;
  currentMode?: string;
  forceModeTransition?: boolean;
}

export interface CognitiveRoutingResult extends RoutingResult {
  modeSelection?: ModeSelection;
  modeTransition?: TransitionResult;
  cognitiveState?: {
    currentMode?: string;
    previousMode?: string;
    transitionTime?: number;
    modeConfidence: number;
  };
}

@Service({
  id: 'mode-aware-router',
  name: 'ModeAwareRouterService',
  version: '1.0.0',
  description: 'Cognitive routing service integrating commands and mode plugins',
  dependencies: ['intelligent-router', 'mode-plugin-registry', 'mode-transition-engine'],
})
export class ModeAwareRouterService extends BaseService {
  id = 'mode-aware-router';
  version = '1.0.0';

  // Configuration
  private modeRoutingEnabled = true;
  private commandModeIntegration = true;
  private modeConfidenceThreshold = 0.6;
  private commandConfidenceThreshold = 0.8;

  // Metrics
  private totalRoutingRequests = 0;
  private commandRoutes = 0;
  private modeRoutes = 0;
  private hybridRoutes = 0;
  private fallbackRoutes = 0;

  async onInitialize(): Promise<void> {
    this.logger.info('Initializing Mode-Aware Router Service...');

    // Load configuration
    this.modeRoutingEnabled = process.env.ENABLE_MODE_ROUTING !== 'false';
    this.commandModeIntegration = process.env.ENABLE_COMMAND_MODE_INTEGRATION !== 'false';
    this.modeConfidenceThreshold = parseFloat(process.env.MODE_CONFIDENCE_THRESHOLD || '0.6');
    this.commandConfidenceThreshold = parseFloat(process.env.COMMAND_CONFIDENCE_THRESHOLD || '0.8');

    this.logger.info('Mode-aware routing configuration loaded');
  }

  async onStart(): Promise<void> {
    this.logger.info('Starting Mode-Aware Router Service...');

    this.emitServiceEvent('mode-aware-router:started', {
      service: this.id,
      modeRoutingEnabled: this.modeRoutingEnabled,
      commandModeIntegration: this.commandModeIntegration,
    });
  }

  /**
   * Main cognitive routing method
   */
  async route(request: CognitiveRoutingRequest): Promise<CognitiveRoutingResult> {
    const startTime = performance.now();
    this.totalRoutingRequests++;

    try {
      // Step 1: Try command routing first (existing slash command system)
      const commandResult = await this.callService<RoutingResult>('intelligent-router', 'route', {
        input: request.input,
        context: request.context,
        userId: request.userId,
      });

      // Step 2: Try mode plugin routing if enabled
      let modeSelection: ModeSelection | null = null;
      let modeTransition: TransitionResult | null = null;

      if (this.modeRoutingEnabled && request.enableModeRouting !== false) {
        modeSelection = await this.selectMode(request);

        // Execute mode transition if mode is selected
        if (modeSelection && modeSelection.confidence >= this.modeConfidenceThreshold) {
          modeTransition = await this.executeMode(request, modeSelection);
        }
      }

      // Step 3: Determine routing strategy and create unified result
      const unifiedResult = await this.unifyResults(
        request,
        commandResult,
        modeSelection,
        modeTransition,
        startTime,
      );

      return unifiedResult;
    } catch (error) {
      const processingTime = performance.now() - startTime;
      this.fallbackRoutes++;

      this.logger.error('Cognitive routing failed:', error);

      this.emitServiceEvent('cognitive-routing:error', {
        sessionId: request.sessionId,
        error: error.message,
        processingTime,
      });

      return {
        success: false,
        fallbackToChat: true,
        processingTime,
        error: error.message,
        cognitiveState: {
          modeConfidence: 0,
        },
      };
    }
  }

  /**
   * Select appropriate mode for the input
   */
  private async selectMode(request: CognitiveRoutingRequest): Promise<ModeSelection | null> {
    try {
      const modeContext: ModeContext = {
        sessionId: request.sessionId,
        userId: request.userId,
        input: request.input,
        language: this.detectLanguage(request.input),
        previousMode: request.currentMode,
        confidence: 0.8,
        metadata: {
          ...request.context,
          routingContext: 'cognitive',
        },
        timestamp: new Date(),
      };

      const selection = await this.callService<ModeSelection | null>(
        'mode-plugin-registry',
        'selectBestMode',
        modeContext,
      );

      return selection;
    } catch (error) {
      this.logger.warn('Mode selection failed:', error);
      return null;
    }
  }

  /**
   * Execute mode transition and get result
   */
  private async executeMode(
    request: CognitiveRoutingRequest,
    selection: ModeSelection,
  ): Promise<TransitionResult> {
    try {
      const modeContext: ModeContext = {
        sessionId: request.sessionId,
        userId: request.userId,
        input: request.input,
        language: this.detectLanguage(request.input),
        previousMode: request.currentMode,
        confidence: selection.confidence,
        metadata: {
          ...request.context,
          modeSelection: selection,
        },
        timestamp: new Date(),
      };

      const transitionResult = await this.callService<TransitionResult>(
        'mode-transition-engine',
        'transitionToMode',
        {
          sessionId: request.sessionId,
          fromMode: request.currentMode,
          toMode: selection.plugin.pluginId,
          context: modeContext,
          force: request.forceModeTransition,
        },
      );

      return transitionResult;
    } catch (error) {
      this.logger.warn('Mode execution failed:', error);
      return {
        success: false,
        toMode: selection.plugin.pluginId,
        transitionTime: 0,
        error: error.message,
        metadata: {},
      };
    }
  }

  /**
   * Unify command and mode routing results
   */
  private async unifyResults(
    request: CognitiveRoutingRequest,
    commandResult: RoutingResult,
    modeSelection: ModeSelection | null,
    modeTransition: TransitionResult | null,
    startTime: number,
  ): Promise<CognitiveRoutingResult> {
    const processingTime = performance.now() - startTime;

    // Determine routing strategy
    const commandConfidence = commandResult.success ? commandResult.intent?.confidence || 0 : 0;
    const modeConfidence = modeSelection?.confidence || 0;

    let routingStrategy: 'command' | 'mode' | 'hybrid' | 'fallback';
    let result: CognitiveRoutingResult;

    if (
      commandConfidence >= this.commandConfidenceThreshold &&
      modeConfidence >= this.modeConfidenceThreshold
    ) {
      // Both are confident - use hybrid approach
      routingStrategy = 'hybrid';
      result = this.createHybridResult(
        request,
        commandResult,
        modeSelection,
        modeTransition,
        processingTime,
      );
      this.hybridRoutes++;
    } else if (commandConfidence >= this.commandConfidenceThreshold) {
      // Command routing wins
      routingStrategy = 'command';
      result = this.createCommandResult(request, commandResult, modeSelection, processingTime);
      this.commandRoutes++;
    } else if (modeConfidence >= this.modeConfidenceThreshold) {
      // Mode routing wins
      routingStrategy = 'mode';
      result = this.createModeResult(request, modeSelection, modeTransition, processingTime);
      this.modeRoutes++;
    } else {
      // Fallback to chat
      routingStrategy = 'fallback';
      result = this.createFallbackResult(request, commandResult, modeSelection, processingTime);
      this.fallbackRoutes++;
    }

    // Emit routing event
    this.emitServiceEvent('cognitive-routing:completed', {
      sessionId: request.sessionId,
      strategy: routingStrategy,
      commandConfidence,
      modeConfidence,
      processingTime,
      success: result.success,
    });

    return result;
  }

  /**
   * Create hybrid result combining command and mode
   */
  private createHybridResult(
    request: CognitiveRoutingRequest,
    commandResult: RoutingResult,
    modeSelection: ModeSelection | null,
    modeTransition: TransitionResult | null,
    processingTime: number,
  ): CognitiveRoutingResult {
    return {
      success: true,
      intent: commandResult.intent,
      modeSelection,
      modeTransition,
      fallbackToChat: false,
      processingTime,
      cognitiveState: {
        currentMode: modeTransition?.success ? modeTransition.toMode : request.currentMode,
        previousMode: modeTransition?.fromMode,
        transitionTime: modeTransition?.transitionTime,
        modeConfidence: modeSelection?.confidence || 0,
      },
    };
  }

  /**
   * Create command-focused result
   */
  private createCommandResult(
    request: CognitiveRoutingRequest,
    commandResult: RoutingResult,
    modeSelection: ModeSelection | null,
    processingTime: number,
  ): CognitiveRoutingResult {
    return {
      success: commandResult.success,
      intent: commandResult.intent,
      modeSelection,
      fallbackToChat: commandResult.fallbackToChat,
      processingTime,
      error: commandResult.error,
      cognitiveState: {
        currentMode: request.currentMode,
        modeConfidence: modeSelection?.confidence || 0,
      },
    };
  }

  /**
   * Create mode-focused result
   */
  private createModeResult(
    request: CognitiveRoutingRequest,
    modeSelection: ModeSelection | null,
    modeTransition: TransitionResult | null,
    processingTime: number,
  ): CognitiveRoutingResult {
    return {
      success: modeTransition?.success || false,
      modeSelection,
      modeTransition,
      fallbackToChat: !modeTransition?.success,
      processingTime,
      cognitiveState: {
        currentMode: modeTransition?.success ? modeTransition.toMode : request.currentMode,
        previousMode: modeTransition?.fromMode,
        transitionTime: modeTransition?.transitionTime,
        modeConfidence: modeSelection?.confidence || 0,
      },
    };
  }

  /**
   * Create fallback result
   */
  private createFallbackResult(
    request: CognitiveRoutingRequest,
    commandResult: RoutingResult,
    modeSelection: ModeSelection | null,
    processingTime: number,
  ): CognitiveRoutingResult {
    return {
      success: false,
      modeSelection,
      fallbackToChat: true,
      processingTime,
      cognitiveState: {
        currentMode: request.currentMode,
        modeConfidence: modeSelection?.confidence || 0,
      },
    };
  }

  /**
   * Simple language detection
   */
  private detectLanguage(input: string): string {
    // Japanese
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(input)) {
      return 'japanese';
    }
    // Korean
    if (/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(input)) {
      return 'korean';
    }
    // Vietnamese
    if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ]/.test(input)) {
      return 'vietnamese';
    }
    // Chinese
    if (/[\u4E00-\u9FFF]/.test(input)) {
      return 'chinese';
    }
    // Default to English
    return 'english';
  }

  /**
   * Get routing statistics
   */
  getRoutingStats() {
    return {
      totalRequests: this.totalRoutingRequests,
      commandRoutes: this.commandRoutes,
      modeRoutes: this.modeRoutes,
      hybridRoutes: this.hybridRoutes,
      fallbackRoutes: this.fallbackRoutes,
      commandRoutePercentage:
        this.totalRoutingRequests > 0 ? (this.commandRoutes / this.totalRoutingRequests) * 100 : 0,
      modeRoutePercentage:
        this.totalRoutingRequests > 0 ? (this.modeRoutes / this.totalRoutingRequests) * 100 : 0,
      hybridRoutePercentage:
        this.totalRoutingRequests > 0 ? (this.hybridRoutes / this.totalRoutingRequests) * 100 : 0,
      fallbackPercentage:
        this.totalRoutingRequests > 0 ? (this.fallbackRoutes / this.totalRoutingRequests) * 100 : 0,
      configuration: {
        modeRoutingEnabled: this.modeRoutingEnabled,
        commandModeIntegration: this.commandModeIntegration,
        modeConfidenceThreshold: this.modeConfidenceThreshold,
        commandConfidenceThreshold: this.commandConfidenceThreshold,
      },
    };
  }

  /**
   * Update routing configuration
   */
  async updateConfig(config: {
    modeRoutingEnabled?: boolean;
    commandModeIntegration?: boolean;
    modeConfidenceThreshold?: number;
    commandConfidenceThreshold?: number;
  }): Promise<void> {
    if (config.modeRoutingEnabled !== undefined) {
      this.modeRoutingEnabled = config.modeRoutingEnabled;
    }
    if (config.commandModeIntegration !== undefined) {
      this.commandModeIntegration = config.commandModeIntegration;
    }
    if (config.modeConfidenceThreshold !== undefined) {
      this.modeConfidenceThreshold = config.modeConfidenceThreshold;
    }
    if (config.commandConfidenceThreshold !== undefined) {
      this.commandConfidenceThreshold = config.commandConfidenceThreshold;
    }

    this.emitServiceEvent('routing-config:updated', config);
    this.logger.info('Routing configuration updated:', config);
  }

  /**
   * Health check with routing-specific metrics
   */
  async health() {
    const baseHealth = await super.health();
    const stats = this.getRoutingStats();

    return {
      ...baseHealth,
      routing: {
        totalRequests: stats.totalRequests,
        fallbackPercentage: stats.fallbackPercentage,
        hybridCapability: this.commandModeIntegration,
        modeRoutingEnabled: this.modeRoutingEnabled,
      },
    };
  }
}
