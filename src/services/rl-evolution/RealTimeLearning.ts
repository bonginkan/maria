/**
 * Real-time Learning System
 * Live adaptation during conversations for immediate improvement
 */

import { EventEmitter } from "node:events";
import { Episode, Policy, RLEvolutionMode, _RewardSignals } from './types';
import { RLEvolutionEngine } from './RLEvolutionEngine';
import { PPOAlgorithm } from './algorithms/PPOAlgorithm';
import { DPOAlgorithm, _PreferencePair } from './algorithms/DPOAlgorithm';
import { RubricEvaluator } from './RubricEvaluator';
import { SafetyValidator, _SafetyReport } from './SafetyValidator';

export interface RealTimeLearningConfig {
  enabled: boolean;
  mode: 'conservative' | 'balanced' | 'aggressive';
  triggers: LearningTrigger[];
  updateFrequency: number;        // Episodes between updates
  batchSize: number;             // Min _episodes for update
  safetyChecks: boolean;         // Enable safety validation
  rollbackOnFailure: boolean;    // Auto-rollback on safety failure
  learningRate: number;          // Real-time learning rate (lower than batch)
  confidenceThreshold: number;   // Min confidence for applying updates
}

export interface LearningTrigger {
  id: string;
  name: string;
  enabled: boolean;
  condition: TriggerCondition;
  action: TriggerAction;
  cooldown: number;              // Min time between triggers (ms)
  lastTriggered?: Date;
}

export interface TriggerCondition {
  type: 'error_rate' | 'user_feedback' | 'performance' | 'pattern' | 'time';
  threshold: number;
  windowSize: number;            // Number of recent _episodes to consider
  comparison: 'above' | 'below' | 'equals';
}

export interface TriggerAction {
  type: 'immediate_update' | 'schedule_update' | 'mode_switch' | 'alert';
  parameters: Record<string, any>;
}

export interface RealTimeLearningState {
  isActive: boolean;
  currentMode: RLEvolutionMode;
  _lastUpdate: Date | null;
  episodesSinceUpdate: number;
  pendingUpdates: PendingUpdate[];
  recentPerformance: PerformanceWindow;
  adaptationHistory: AdaptationRecord[];
}

export interface PendingUpdate {
  id: string;
  _episodes: Episode[];
  priority: number;
  scheduledFor: Date;
  type: 'ppo' | 'dpo' | 'hybrid';
  reason: string;
}

export interface PerformanceWindow {
  _episodes: Episode[];
  windowSize: number;
  avgReward: number;
  errorRate: number;
  userSatisfaction: number;
  trendDirection: 'improving' | 'stable' | 'declining';
}

export interface AdaptationRecord {
  timestamp: Date;
  trigger: string;
  episodesBefore: number;
  episodesAfter: number;
  performanceBefore: number;
  performanceAfter: number;
  improvement: number;
  safetyPassed: boolean;
}

export class RealTimeLearning extends EventEmitter {
  private config: RealTimeLearningConfig;
  private state: RealTimeLearningState;
  private rlEngine: RLEvolutionEngine;
  private ppoAlgorithm: PPOAlgorithm;
  private dpoAlgorithm: DPOAlgorithm;
  private rubricEvaluator: RubricEvaluator;
  private safetyValidator: SafetyValidator;
  private updateTimer: NodeJS.Timeout | null = null;

  constructor(
    rlEngine: RLEvolutionEngine,
    config: Partial<RealTimeLearningConfig> = {}
  ) {
    super();

    this.rlEngine = rlEngine;
    this.config = {
      enabled: true,
      mode: 'balanced',
      triggers: this.getDefaultTriggers(),
      updateFrequency: 10,         // Update every 10 _episodes
      batchSize: 5,               // Min 5 _episodes per update
      safetyChecks: true,
      rollbackOnFailure: true,
      learningRate: 0.0001,       // Lower than batch learning
      confidenceThreshold: 0.7,
      ...config,
    };

    this.state = {
      isActive: false,
      currentMode: RLEvolutionMode.BANDIT_ROUTER,
      _lastUpdate: null,
      episodesSinceUpdate: 0,
      pendingUpdates: [],
      recentPerformance: this.initializePerformanceWindow(),
      adaptationHistory: [],
    };

    this.ppoAlgorithm = new PPOAlgorithm(rlEngine.getPolicy(), {
      clipEpsilon: 0.1,           // More conservative for real-time
      epochs: 1,                  // Single epoch for speed
      miniBatchSize: this.config.batchSize,
    });

    this.dpoAlgorithm = new DPOAlgorithm(rlEngine.getPolicy(), {
      learningRate: this.config.learningRate,
      epochs: 1,
      batchSize: this.config.batchSize,
    });

    this.rubricEvaluator = new RubricEvaluator();
    this.safetyValidator = new SafetyValidator();

    this.setupEventListeners();
  }

  /**
   * Start real-time learning
   */
  async start(): Promise<void> {
    if (this.state.isActive) {
      return;
    }

    this.emit('realtime:starting');

    try {
      await this.rubricEvaluator.initialize();
      await this.initializePolicyBaseline();
      
      this.state.isActive = true;
      this.startUpdateTimer();
      
      this.emit('realtime:started', {
        mode: this.config.mode,
        updateFrequency: this.config.updateFrequency,
      });
    } catch (_error) {
      this.emit('realtime:_error', {
        phase: 'startup',
        _error: _error instanceof Error ? _error.message : 'Unknown _error',
      });
      throw _error;
    }
  }

  /**
   * Stop real-time learning
   */
  async stop(): Promise<void> {
    if (!this.state.isActive) {
      return;
    }

    this.emit('realtime:stopping');

    this.state.isActive = false;
    
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }

    // Process any pending updates
    await this.processPendingUpdates();

    this.emit('realtime:stopped');
  }

  /**
   * Process new episode in real-time
   */
  async processEpisode(episode: Episode): Promise<void> {
    if (!this.state.isActive) {
      return;
    }

    this.emit('episode:processing', { episodeId: episode.id });

    try {
      // Update performance _window
      this.updatePerformanceWindow(episode);

      // Check triggers
      await this.checkTriggers(episode);

      // Increment episode counter
      this.state.episodesSinceUpdate++;

      // Check if update is needed
      if (this.shouldTriggerUpdate()) {
        await this.scheduleUpdate([episode], 'scheduled', 1);
      }

      this.emit('episode:processed', {
        episodeId: episode.id,
        episodesSinceUpdate: this.state.episodesSinceUpdate,
      });
    } catch (_error) {
      this.emit('episode:_error', {
        episodeId: episode.id,
        _error: _error instanceof Error ? _error.message : 'Unknown _error',
      });
    }
  }

  /**
   * Check learning triggers
   */
  private async checkTriggers(episode: Episode): Promise<void> {
    for (const trigger of this.config.triggers.filter(t => t.enabled)) {
      if (this.isTriggerdReady(trigger)) {
        const _shouldTrigger = this.evaluateTriggerCondition(trigger, episode);
        
        if (_shouldTrigger) {
          await this.executeTriggerAction(trigger, episode);
          trigger.lastTriggered = new Date();
          
          this.emit('trigger:executed', {
            triggerId: trigger.id,
            episodeId: episode.id,
          });
        }
      }
    }
  }

  /**
   * Check if trigger is ready (respecting cooldown)
   */
  private isTriggerdReady(trigger: LearningTrigger): boolean {
    if (!trigger.lastTriggered) {
      return true;
    }

    const _timeSinceLastTrigger = Date.now() - trigger.lastTriggered.getTime();
    return _timeSinceLastTrigger >= trigger.cooldown;
  }

  /**
   * Evaluate trigger condition
   */
  private evaluateTriggerCondition(_trigger: LearningTrigger, _episode: Episode): boolean {
    const { condition } = _trigger;
    const _recentEpisodes = this.state.recentPerformance._episodes.slice(-condition.windowSize);

    if (_recentEpisodes.length < condition.windowSize) {
      return false; // Not enough data
    }

    let currentValue: number;

    switch (condition.type) {
      case 'error_rate':
        currentValue = _recentEpisodes.filter(ep => ep.outcome.errors.length > 0).length / _recentEpisodes.length;
        break;
      case 'thumbs_down': {
        const _thumbsDown = _recentEpisodes.filter(ep => ep.outcome.rewards.userSignals._thumbsDown).length;
        currentValue = _thumbsDown / _recentEpisodes.length;
        break;
      }
      case "user_satisfaction": {
        currentValue = _recentEpisodes.reduce((sum, ep) => sum + (ep.outcome.rewards.totalReward || 0), 0) / _recentEpisodes.length;
        break;
      }
      case 'pattern': {
        // Check for repeated patterns (simplified)
        const _commands = _recentEpisodes.map(ep => ep.action.command);
        const _uniqueCommands = new Set(_commands);
        currentValue = _uniqueCommands.size / _commands.length; // Diversity measure
        break;
      }
      case 'time': {
        const _lastUpdate = this.state._lastUpdate || new Date(0);
        currentValue = (Date.now() - _lastUpdate.getTime()) / (1000 * 60); // Minutes since last update
        break;
      }
      default:
        return false;
    }

    // Compare against threshold
    switch (condition.comparison) {
      case 'above':
        return currentValue > condition.threshold;
      case 'below':
        return currentValue < condition.threshold;
      case 'equals':
        return Math.abs(currentValue - condition.threshold) < 0.01;
      default:
        return false;
    }
  }

  /**
   * Execute trigger action
   */
  private async executeTriggerAction(_trigger: LearningTrigger, episode: Episode): Promise<void> {
    const { action } = _trigger;

    switch (action.type) {
      case 'immediate_update':
        await this.performImmediateUpdate(episode, _trigger.id);
        break;
      case 'schedule_update': {
        const _delay = action.parameters._delay || 0;
        await this.scheduleUpdate([episode], _trigger.id, 2, _delay);
        break;
      }
      case 'mode_switch': {
        const _newMode = action.parameters.mode as RLEvolutionMode;
        this.switchMode(_newMode, _trigger.id);
        break;
      }
      case 'alert':
        this.emit('trigger:alert', {
          triggerId: _trigger.id,
          message: action.parameters.message || 'Trigger condition met',
          severity: action.parameters.severity || 'info',
        });
        break;
    }
  }

  /**
   * Perform immediate update
   */
  private async performImmediateUpdate(_episode: Episode, reason: string): Promise<void> {
    if (this.state.recentPerformance._episodes.length < this.config.batchSize) {
      // Not enough _episodes, schedule for later
      await this.scheduleUpdate([_episode], reason, 3);
      return;
    }

    this.emit('update:immediate:started', { reason, episodeId: _episode.id });

    try {
      const _episodes = this.state.recentPerformance._episodes.slice(-this.config.batchSize);
      const _beforePerformance = this.state.recentPerformance.avgReward;

      // Perform update based on current mode
      let newPolicy: Policy;
      
      switch (this.state.currentMode) {
        case RLEvolutionMode.CODERLVR:
          newPolicy = await this.ppoAlgorithm.updatePolicy(_episodes);
          break;
        case RLEvolutionMode.RUBRICRL: {
          const _preferences = DPOAlgorithm.extractPreferencePairs(_episodes);
          if (_preferences.length > 0) {
            newPolicy = await this.dpoAlgorithm.updateFromPreferences(_preferences);
          } else {
            newPolicy = await this.ppoAlgorithm.updatePolicy(_episodes);
          }
          break;
        }
        default:
          newPolicy = await this.ppoAlgorithm.updatePolicy(_episodes);
          break;
      }

      // Safety validation
      if (this.config.safetyChecks) {
        const _safetyReport = await this.safetyValidator.validatePolicy(newPolicy, _episodes);
        
        if (!_safetyReport.passed) {
          if (this.config.rollbackOnFailure) {
            this.emit('update:rollback', { reason: 'Safety validation failed' });
            return;
          } else {
            this.emit('update:warning', { 
              message: 'Safety validation failed but rollback disabled',
              _safetyReport 
            });
          }
        }
      }

      // Apply update
      this.rlEngine.updatePolicy(newPolicy);
      this.state._lastUpdate = new Date();
      this.state.episodesSinceUpdate = 0;

      // Record adaptation
      const _afterPerformance = this.calculateCurrentPerformance();
      this.recordAdaptation(reason, _beforePerformance, _afterPerformance, true);

      this.emit('update:immediate:completed', {
        reason,
        improvement: _afterPerformance - _beforePerformance,
        policyVersion: newPolicy.version,
      });
    } catch (_error) {
      this.emit('update:immediate:_error', {
        reason,
        _error: _error instanceof Error ? _error.message : 'Unknown _error',
      });
    }
  }

  /**
   * Schedule update for later processing
   */
  private async scheduleUpdate(
    _episodes: Episode[],
    reason: string,
    priority: number,
    delayMs: number = 0
  ): Promise<void> {
    const update: PendingUpdate = {
      id: `update_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      _episodes,
      priority,
      scheduledFor: new Date(Date.now() + delayMs),
      type: this.determineUpdateType(_episodes),
      reason,
    };

    this.state.pendingUpdates.push(update);
    
    // Sort by priority and scheduled time
    this.state.pendingUpdates.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Higher priority first
      }
      return a.scheduledFor.getTime() - b.scheduledFor.getTime(); // Earlier first
    });

    this.emit('update:scheduled', {
      updateId: update.id,
      reason,
      priority,
      scheduledFor: update.scheduledFor,
    });
  }

  /**
   * Process pending updates
   */
  private async processPendingUpdates(): Promise<void> {
    const _now = new Date();
    const _readyUpdates = this.state.pendingUpdates.filter(
      update => update.scheduledFor <= _now
    );

    for (const update of _readyUpdates) {
      try {
        await this.executeUpdate(update);
        
        // Remove from pending list
        this.state.pendingUpdates = this.state.pendingUpdates.filter(
          u => u.id !== update.id
        );
      } catch (_error) {
        this.emit('update:_error', {
          updateId: update.id,
          _error: _error instanceof Error ? _error.message : 'Unknown _error',
        });
      }
    }
  }

  /**
   * Execute scheduled update
   */
  private async executeUpdate(update: PendingUpdate): Promise<void> {
    this.emit('update:executing', {
      updateId: update.id,
      type: update.type,
      reason: update.reason,
    });

    const _beforePerformance = this.state.recentPerformance.avgReward;

    let newPolicy: Policy;

    switch (update.type) {
      case 'ppo':
        newPolicy = await this.ppoAlgorithm.updatePolicy(update._episodes);
        break;
      case 'dpo': {
        const _preferences = DPOAlgorithm.extractPreferencePairs(update._episodes);
        newPolicy = await this.dpoAlgorithm.updateFromPreferences(_preferences);
        break;
      }
      case 'hybrid':
      default: {
        // Try DPO first, fall back to PPO
        const _prefs = DPOAlgorithm.extractPreferencePairs(update._episodes);
        if (_prefs.length >= this.config.batchSize / 2) {
          newPolicy = await this.dpoAlgorithm.updateFromPreferences(_prefs);
        } else {
          newPolicy = await this.ppoAlgorithm.updatePolicy(update._episodes);
        }
        break;
      }
    }

    // Apply safety checks
    if (this.config.safetyChecks) {
      const _safetyReport = await this.safetyValidator.validatePolicy(newPolicy, update._episodes);
      
      if (!_safetyReport.passed) {
        this.emit('update:blocked', {
          updateId: update.id,
          reason: 'Safety validation failed',
          _safetyReport,
        });
        return;
      }
    }

    // Apply update
    this.rlEngine.updatePolicy(newPolicy);
    this.state._lastUpdate = new Date();
    this.state.episodesSinceUpdate = 0;

    // Record adaptation
    const _afterPerformance = this.calculateCurrentPerformance();
    this.recordAdaptation(update.reason, _beforePerformance, _afterPerformance, true);

    this.emit('update:completed', {
      updateId: update.id,
      improvement: _afterPerformance - _beforePerformance,
      policyVersion: newPolicy.version,
    });
  }

  /**
   * Helper methods
   */
  private shouldTriggerUpdate(): boolean {
    return this.state.episodesSinceUpdate >= this.config.updateFrequency &&
           this.state.recentPerformance._episodes.length >= this.config.batchSize;
  }

  private updatePerformanceWindow(episode: Episode): void {
    const _window = this.state.recentPerformance;
    
    // Add new episode
    _window._episodes.push(episode);
    
    // Remove old _episodes if _window is full
    if (_window._episodes.length > _window.windowSize) {
      _window._episodes.shift();
    }

    // Recalculate metrics
    if (_window._episodes.length > 0) {
      _window.avgReward = _window._episodes.reduce(
        (sum, ep) => sum + (ep.outcome.rewards.totalReward || 0),
        0
      ) / _window._episodes.length;

      _window.errorRate = _window._episodes.filter(
        ep => ep.outcome.errors.length > 0
      ).length / _window._episodes.length;

      _window.userSatisfaction = _window._episodes.reduce(
        (sum, ep) => sum + ep.outcome.rewards.rubricScores.userSatisfaction,
        0
      ) / _window._episodes.length / 100;

      // Determine trend
      if (_window._episodes.length >= 10) {
        const _recent5 = _window._episodes.slice(-5);
        const _previous5 = _window._episodes.slice(-10, -5);
        
        const _recentAvg = _recent5.reduce((sum, ep) => sum + (ep.outcome.rewards.totalReward || 0), 0) / 5;
        const _previousAvg = _previous5.reduce((sum, ep) => sum + (ep.outcome.rewards.totalReward || 0), 0) / 5;
        
        const _diff = _recentAvg - _previousAvg;
        if (_diff > 5) _window.trendDirection = 'improving';
        else if (_diff < -5) _window.trendDirection = 'declining';
        else _window.trendDirection = 'stable';
      }
    }
  }

  private switchMode(_newMode: RLEvolutionMode, reason: string): void {
    const _oldMode = this.state.currentMode;
    this.state.currentMode = _newMode;
    this.rlEngine.setMode(_newMode);
    
    this.emit('mode:switched', {
      from: _oldMode,
      to: _newMode,
      reason,
    });
  }

  private determineUpdateType(_episodes: Episode[]): PendingUpdate['type'] {
    const _preferences = DPOAlgorithm.extractPreferencePairs(_episodes);
    
    if (_preferences.length >= _episodes.length / 2) {
      return 'dpo'; // Enough preference data
    } else if (_preferences.length > 0) {
      return 'hybrid'; // Some preference data
    } else {
      return 'ppo'; // No preference data
    }
  }

  private calculateCurrentPerformance(): number {
    const _window = this.state.recentPerformance;
    return _window._episodes.length > 0 ? _window.avgReward : 0;
  }

  private recordAdaptation(
    trigger: string,
    _beforePerformance: number,
    _afterPerformance: number,
    safetyPassed: boolean
  ): void {
    const record: AdaptationRecord = {
      timestamp: new Date(),
      trigger,
      episodesBefore: this.state.episodesSinceUpdate,
      episodesAfter: 0,
      performanceBefore: _beforePerformance,
      performanceAfter: _afterPerformance,
      improvement: _afterPerformance - _beforePerformance,
      safetyPassed,
    };

    this.state.adaptationHistory.push(record);
    
    // Keep only recent adaptations
    if (this.state.adaptationHistory.length > 100) {
      this.state.adaptationHistory = this.state.adaptationHistory.slice(-100);
    }
  }

  private initializePerformanceWindow(): PerformanceWindow {
    return {
      _episodes: [],
      windowSize: 50,
      avgReward: 0,
      errorRate: 0,
      userSatisfaction: 0,
      trendDirection: 'stable',
    };
  }

  private async initializePolicyBaseline(): Promise<void> {
    const _currentPolicy = this.rlEngine.getPolicy();
    this.safetyValidator.setBaselinePolicy(_currentPolicy);
  }

  private startUpdateTimer(): void {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }

    // Process pending updates every 30 seconds
    this.updateTimer = setTimeout(async () => {
      if (this.state.isActive) {
        await this.processPendingUpdates();
        this.startUpdateTimer(); // Restart timer
      }
    }, 30000);
  }

  private setupEventListeners(): void {
    this.ppoAlgorithm.on('training:completed', (data) => {
      this.emit('algorithm:ppo:completed', data);
    });

    this.dpoAlgorithm.on('training:completed', (data) => {
      this.emit('algorithm:dpo:completed', data);
    });

    this.safetyValidator.on('validation:completed', (data) => {
      this.emit('safety:validated', data);
    });
  }

  private getDefaultTriggers(): LearningTrigger[] {
    return [
      {
        id: 'high_error_rate',
        name: 'High Error Rate Trigger',
        enabled: true,
        condition: {
          type: 'error_rate',
          threshold: 0.3,
          windowSize: 10,
          comparison: 'above',
        },
        action: {
          type: 'immediate_update',
          parameters: Record<string, any>,
        },
        cooldown: 300000, // 5 minutes
      },
      {
        id: 'negative_feedback',
        name: 'Negative User Feedback Trigger',
        enabled: true,
        condition: {
          type: 'user_feedback',
          threshold: 0.4,
          windowSize: 5,
          comparison: 'above',
        },
        action: {
          type: 'schedule_update',
          parameters: { _delay: 60000 }, // 1 minute _delay
        },
        cooldown: 180000, // 3 minutes
      },
      {
        id: 'performance_decline',
        name: 'Performance Decline Trigger',
        enabled: true,
        condition: {
          type: 'performance',
          threshold: 40,
          windowSize: 15,
          comparison: 'below',
        },
        action: {
          type: 'mode_switch',
          parameters: { mode: RLEvolutionMode.ERROR_RECOVERY },
        },
        cooldown: 600000, // 10 minutes
      },
      {
        id: 'time_based',
        name: 'Time-based Update Trigger',
        enabled: this.config.mode !== 'conservative',
        condition: {
          type: 'time',
          threshold: 60, // 60 minutes
          windowSize: 1,
          comparison: 'above',
        },
        action: {
          type: 'schedule_update',
          parameters: { _delay: 0 },
        },
        cooldown: 1800000, // 30 minutes
      },
    ];
  }

  /**
   * Get current learning state
   */
  getState(): RealTimeLearningState {
    return { ...this.state };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RealTimeLearningConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('config:updated', this.config);
  }

  /**
   * Get adaptation history
   */
  getAdaptationHistory(): AdaptationRecord[] {
    return [...this.state.adaptationHistory];
  }

  /**
   * Force immediate learning update
   */
  async forceUpdate(reason: string = 'manual'): Promise<void> {
    if (!this.state.isActive) {
      throw new Error('Real-time learning is not active');
    }

    if (this.state.recentPerformance._episodes.length < this.config.batchSize) {
      throw new Error('Insufficient _episodes for update');
    }

    const _recentEpisode = this.state.recentPerformance._episodes[
      this.state.recentPerformance._episodes.length - 1
    ];

    await this.performImmediateUpdate(_recentEpisode, reason);
  }
}