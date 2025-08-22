/**
 * Mode Service - Cognitive Mode Management Microservice
 * Handles mode registration, transition, and lifecycle management
 */

import { BaseService } from '../../core/BaseService.js';
import { ServiceEvent } from '../../core/types.js';
import { Service } from '../../core/decorators/service.decorator.js';
import { EventHandler } from '../../core/decorators/event.decorator.js';

export interface ModeDefinition {
  id: string;
  name: string;
  category: string;
  symbol: string;
  color: string;
  description: string;
  keywords: string[];
  triggers: string[];
  examples: string[];
  enabled: boolean;
  priority: number;
  metadata?: any;
}

export interface ModeTransition {
  fromMode: string;
  toMode: string;
  reason: string;
  confidence: number;
  timestamp: number;
  userId: string;
  sessionId: string;
}

export interface ModeUsageStats {
  modeId: string;
  usageCount: number;
  totalDuration: number;
  averageDuration: number;
  successRate: number;
  lastUsed: number;
}

@Service({
  id: 'mode-service',
  version: '1.0.0',
  description: 'Cognitive mode management and lifecycle service',
  dependencies: [],
  startupOrder: 2,
})
export class ModeService extends BaseService {
  public readonly id = 'mode-service';
  public readonly version = '1.0.0';

  private modes: Map<string, ModeDefinition> = new Map();
  private currentModes: Map<string, string> = new Map(); // sessionId -> modeId
  private transitionHistory: ModeTransition[] = [];
  private usageStats: Map<string, ModeUsageStats> = new Map();
  private modeStartTimes: Map<string, number> = new Map(); // sessionId -> startTime

  async onInitialize(): Promise<void> {
    console.log(`[${this.id}] Initializing Mode Service...`);
    await this.loadDefaultModes();
    await this.loadCustomModes();
    console.log(`[${this.id}] Mode Service initialized with ${this.modes.size} modes`);
  }

  async onStart(): Promise<void> {
    console.log(`[${this.id}] Starting Mode Service...`);
    this.emitServiceEvent('modes:ready', {
      service: this.id,
      totalModes: this.modes.size,
      activeSessions: this.currentModes.size,
    });
  }

  async onStop(): Promise<void> {
    console.log(`[${this.id}] Stopping Mode Service...`);
    // Record final usage stats for active sessions
    for (const [sessionId, modeId] of this.currentModes) {
      await this.recordModeUsage(sessionId, modeId);
    }
  }

  /**
   * Register a new mode
   */
  async registerMode(modeDefinition: ModeDefinition): Promise<void> {
    this.modes.set(modeDefinition.id, modeDefinition);

    // Initialize usage stats
    if (!this.usageStats.has(modeDefinition.id)) {
      this.usageStats.set(modeDefinition.id, {
        modeId: modeDefinition.id,
        usageCount: 0,
        totalDuration: 0,
        averageDuration: 0,
        successRate: 1.0,
        lastUsed: 0,
      });
    }

    this.emitServiceEvent('mode:registered', { mode: modeDefinition });
    console.log(`[${this.id}] Registered mode: ${modeDefinition.id}`);
  }

  /**
   * Unregister a mode
   */
  async unregisterMode(modeId: string): Promise<void> {
    if (this.modes.has(modeId)) {
      this.modes.delete(modeId);
      this.emitServiceEvent('mode:unregistered', { modeId });
      console.log(`[${this.id}] Unregistered mode: ${modeId}`);
    }
  }

  /**
   * Get mode definition
   */
  getMode(modeId: string): ModeDefinition | undefined {
    return this.modes.get(modeId);
  }

  /**
   * Get all modes
   */
  getAllModes(): ModeDefinition[] {
    return Array.from(this.modes.values());
  }

  /**
   * Get modes by category
   */
  getModesByCategory(category: string): ModeDefinition[] {
    return Array.from(this.modes.values()).filter((mode) => mode.category === category);
  }

  /**
   * Get current mode for session
   */
  getCurrentMode(sessionId: string): string {
    return this.currentModes.get(sessionId) || 'thinking';
  }

  /**
   * Transition to a new mode
   */
  async transitionToMode(
    sessionId: string,
    targetModeId: string,
    reason: string = 'manual',
    confidence: number = 1.0,
    userId: string = 'unknown',
  ): Promise<boolean> {
    const currentModeId = this.getCurrentMode(sessionId);

    // Validate target mode exists
    if (!this.modes.has(targetModeId)) {
      console.warn(`[${this.id}] Unknown mode: ${targetModeId}`);
      return false;
    }

    // Check if mode is enabled
    const targetMode = this.modes.get(targetModeId)!;
    if (!targetMode.enabled) {
      console.warn(`[${this.id}] Mode disabled: ${targetModeId}`);
      return false;
    }

    // Record previous mode usage if exists
    if (currentModeId && this.modeStartTimes.has(sessionId)) {
      await this.recordModeUsage(sessionId, currentModeId);
    }

    // Perform transition
    const transition: ModeTransition = {
      fromMode: currentModeId,
      toMode: targetModeId,
      reason,
      confidence,
      timestamp: Date.now(),
      userId,
      sessionId,
    };

    this.transitionHistory.push(transition);
    this.currentModes.set(sessionId, targetModeId);
    this.modeStartTimes.set(sessionId, Date.now());

    // Update usage stats
    const stats = this.usageStats.get(targetModeId)!;
    stats.usageCount++;
    stats.lastUsed = Date.now();

    this.emitServiceEvent('mode:transition', {
      transition,
      mode: targetMode,
    });

    console.log(`[${this.id}] Mode transition: ${currentModeId} → ${targetModeId} (${reason})`);
    return true;
  }

  /**
   * Get mode suggestions based on context
   */
  async suggestModes(context: unknown): Promise<ModeDefinition[]> {
    const suggestions: { mode: ModeDefinition; score: number }[] = [];

    for (const mode of this.modes.values()) {
      if (!mode.enabled) {continue;}

      let score = 0;

      // Keyword matching
      if (context.input && mode.keywords) {
        for (const keyword of mode.keywords) {
          if (context.input.toLowerCase().includes(keyword.toLowerCase())) {
            score += 10;
          }
        }
      }

      // Usage history bonus
      const stats = this.usageStats.get(mode.id);
      if (stats && stats.usageCount > 0) {
        score += Math.min(stats.usageCount / 10, 5);
      }

      // Category matching
      if (context.category && mode.category === context.category) {
        score += 15;
      }

      if (score > 0) {
        suggestions.push({ mode, score });
      }
    }

    // Sort by score and return top suggestions
    suggestions.sort((a, b) => b.score - a.score);
    return suggestions.slice(0, 5).map((s) => s.mode);
  }

  /**
   * Get mode transition history
   */
  getTransitionHistory(sessionId?: string, limit: number = 50): ModeTransition[] {
    let history = this.transitionHistory;

    if (sessionId) {
      history = history.filter((t) => t.sessionId === sessionId);
    }

    return history.slice(-limit);
  }

  /**
   * Get mode usage statistics
   */
  getUsageStats(modeId?: string): ModeUsageStats | ModeUsageStats[] {
    if (modeId) {
      return (
        this.usageStats.get(modeId) || {
          modeId,
          usageCount: 0,
          totalDuration: 0,
          averageDuration: 0,
          successRate: 0,
          lastUsed: 0,
        }
      );
    }

    return Array.from(this.usageStats.values());
  }

  /**
   * Record mode usage duration
   */
  private async recordModeUsage(sessionId: string, modeId: string): Promise<void> {
    const startTime = this.modeStartTimes.get(sessionId);
    if (!startTime) {return;}

    const duration = Date.now() - startTime;
    const stats = this.usageStats.get(modeId);

    if (stats) {
      stats.totalDuration += duration;
      stats.averageDuration = stats.totalDuration / stats.usageCount;
      this.usageStats.set(modeId, stats);
    }

    this.modeStartTimes.delete(sessionId);

    this.emitServiceEvent('mode:usage_recorded', {
      sessionId,
      modeId,
      duration,
      stats,
    });
  }

  /**
   * Load default cognitive modes
   */
  private async loadDefaultModes(): Promise<void> {
    const defaultModes: ModeDefinition[] = [
      // Reasoning Modes
      {
        id: 'thinking',
        name: 'Thinking',
        category: 'reasoning',
        symbol: '✽',
        color: 'cyan',
        description: '通常の推論プロセス',
        keywords: ['think', 'analyze', 'consider'],
        triggers: ['default'],
        examples: ['What is...?', 'How does...?', 'Explain...'],
        enabled: true,
        priority: 1,
      },
      {
        id: 'optimizing',
        name: 'Optimizing',
        category: 'reasoning',
        symbol: '⚡',
        color: 'yellow',
        description: '処理や出力の効率化・改善を行う',
        keywords: ['optimize', 'improve', 'efficient', 'performance'],
        triggers: ['optimize', 'improve', 'faster'],
        examples: ['Optimize this code', 'Make it faster', 'Improve performance'],
        enabled: true,
        priority: 2,
      },
      {
        id: 'researching',
        name: 'Researching',
        category: 'reasoning',
        symbol: '🔍',
        color: 'blue',
        description: '知識・情報を探索し補強',
        keywords: ['research', 'find', 'search', 'investigate'],
        triggers: ['research', 'find out', 'look up'],
        examples: ['Research best practices', 'Find information about', 'Look up documentation'],
        enabled: true,
        priority: 3,
      },

      // Creative Modes
      {
        id: 'brainstorming',
        name: 'Brainstorming',
        category: 'creative',
        symbol: '💡',
        color: 'green',
        description: '制約を緩めて多様な発想生成',
        keywords: ['brainstorm', 'ideas', 'creative', 'concept'],
        triggers: ['brainstorm', 'ideas', 'think outside'],
        examples: ['Brainstorm ideas for', 'Come up with concepts', 'Creative solutions'],
        enabled: true,
        priority: 4,
      },
      {
        id: 'inventing',
        name: 'Inventing',
        category: 'creative',
        symbol: '🔧',
        color: 'green',
        description: '新しい仕組みを発明',
        keywords: ['invent', 'create', 'design', 'build'],
        triggers: ['invent', 'create new', 'design'],
        examples: ['Invent a new approach', 'Create something novel', 'Design from scratch'],
        enabled: true,
        priority: 5,
      },

      // Analytical Modes
      {
        id: 'summarizing',
        name: 'Summarizing',
        category: 'analytical',
        symbol: '📋',
        color: 'magenta',
        description: '長文を要約',
        keywords: ['summary', 'summarize', 'brief', 'overview'],
        triggers: ['summarize', 'brief', 'overview'],
        examples: ['Summarize this document', 'Give me a brief overview', 'Main points'],
        enabled: true,
        priority: 6,
      },
      {
        id: 'debugging',
        name: 'Debugging',
        category: 'validation',
        symbol: '🐛',
        color: 'red',
        description: 'エラー原因特定・修正',
        keywords: ['debug', 'error', 'bug', 'fix', 'broken'],
        triggers: ['error', 'bug', 'not working', 'debug'],
        examples: ['Fix this error', 'Debug the issue', 'Something is broken'],
        enabled: true,
        priority: 7,
      },
    ];

    for (const mode of defaultModes) {
      await this.registerMode(mode);
    }
  }

  /**
   * Load custom user-defined modes
   */
  private async loadCustomModes(): Promise<void> {
    // Future: Load from configuration file or database
    console.log(`[${this.id}] Custom modes loading placeholder`);
  }

  @EventHandler('session:started')
  async handleSessionStarted(event: ServiceEvent): Promise<void> {
    const sessionId = event.data.sessionId;
    console.log(`[${this.id}] Session started: ${sessionId}`);

    // Set default mode for new session
    await this.transitionToMode(
      sessionId,
      'thinking',
      'session_start',
      1.0,
      event.data.userId || 'unknown',
    );
  }

  @EventHandler('session:ended')
  async handleSessionEnded(event: ServiceEvent): Promise<void> {
    const sessionId = event.data.sessionId;
    console.log(`[${this.id}] Session ended: ${sessionId}`);

    // Record final usage stats
    const currentMode = this.getCurrentMode(sessionId);
    if (currentMode && this.modeStartTimes.has(sessionId)) {
      await this.recordModeUsage(sessionId, currentMode);
    }

    // Clean up session data
    this.currentModes.delete(sessionId);
    this.modeStartTimes.delete(sessionId);
  }

  @EventHandler('recognition:complete')
  async handleRecognitionComplete(event: ServiceEvent): Promise<void> {
    const { result, sessionData } = event.data;

    if (result.confidence > 0.85) {
      // Auto-transition to recommended mode
      await this.transitionToMode(
        sessionData.sessionId,
        result.recommendedMode,
        'auto_recognition',
        result.confidence,
        sessionData.userId,
      );
    }
  }

  /**
   * Get comprehensive service statistics
   */
  async getStatistics(): Promise<unknown> {
    return {
      service: this.id,
      totalModes: this.modes.size,
      activeSessions: this.currentModes.size,
      totalTransitions: this.transitionHistory.length,
      mostUsedMode: this.getMostUsedMode(),
      modeCategories: this.getModeCategories(),
      uptime: Date.now() - this.startTime.getTime(),
    };
  }

  private getMostUsedMode(): string {
    let mostUsed = '';
    let maxUsage = 0;

    for (const stats of this.usageStats.values()) {
      if (stats.usageCount > maxUsage) {
        maxUsage = stats.usageCount;
        mostUsed = stats.modeId;
      }
    }

    return mostUsed;
  }

  private getModeCategories(): string[] {
    const categories = new Set<string>();
    for (const mode of this.modes.values()) {
      categories.add(mode.category);
    }
    return Array.from(categories);
  }
}
