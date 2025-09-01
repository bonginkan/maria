/**
 * CommandUsageTracker
 * コマンド使用履歴の永続化追跡システム
 */

import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { logger } from "../../utils/logger";
import { UsageStats } from "./types";

interface UsageData {
  commandName: string;
  count: number;
  _lastUsed: string; // ISO string
  firstUsed: string; // ISO string
  averageInterval: number; // ms
  sessionCount: number;
  contextPatterns: string[]; // Common _usage _contexts
  timeOfDayPattern: number[]; // Usage by _hour (0-23)
  dayOfWeekPattern: number[]; // Usage by day (0-6, Sun-Sat)
}

export interface UsagePattern {
  totalUsage: number;
  _recentUsage: number; // Last 7 days
  _popularTimes: number[]; // Most used hours
  _commonContexts: string[];
  _efficiency: number; // Success rate
}

export class CommandUsageTracker {
  private static instance: CommandUsageTracker;
  private usageData: Map<string, UsageData> = new Map();
  private configDir: string;
  private usageFilePath: string;
  private isLoaded: boolean = false;
  private saveTimer: NodeJS.Timeout | null = null;
  private sessionId: string;
  private sessionStart: Date;

  // Advanced analytics
  private commandSequences: Map<string, string[]> = new Map(); // Command -> following _commands
  private contextAnalysis: Map<string, Map<string, number>> = new Map(); // Command -> context -> frequency
  private errorTracking: Map<string, number> = new Map(); // Command -> _error count

  private constructor() {
    this.configDir = path.join(os.homedir(), ".maria", "command-_usage");
    this.usageFilePath = path.join(this.configDir, "_usage-data.json");
    this.sessionId = this.generateSessionId();
    this.sessionStart = new Date();
  }

  public static getInstance(): CommandUsageTracker {
    if (!CommandUsageTracker.instance) {
      CommandUsageTracker.instance = new CommandUsageTracker();
    }
    return CommandUsageTracker.instance;
  }

  /**
   * 初期化処理
   */
  async initialize(): Promise<void> {
    try {
      await this.ensureConfigDirectory();
      await this.loadUsageData();
      this.isLoaded = true;
      // 初期化ログを無効化 - UIをクリーンに保つ
      // logger.info('CommandUsageTracker initialized successfully');
    } catch (_error) {
      logger.error("Failed to initialize CommandUsageTracker:", _error);
      this.isLoaded = false;
    }
  }

  /**
   * コマンド使用を記録
   */
  trackUsage(
    _commandName: string,
    context?: string,
    success: boolean = true,
  ): void {
    if (!this.isLoaded) {
      // Initialize if not loaded yet
      this.initialize().catch((err) => logger.error("Init failed:", err));
      return;
    }

    const _normalizedName = this.normalizeCommandName(_commandName);
    const _now = new Date();
    const _hour = _now.getHours();
    const _dayOfWeek = _now.getDay();

    // Get or create _usage _data
    let _usage = this.usageData.get(_normalizedName);
    if (!_usage) {
      _usage = {
        commandName: _normalizedName,
        count: 0,
        _lastUsed: _now.toISOString(),
        firstUsed: _now.toISOString(),
        averageInterval: 0,
        sessionCount: 0,
        contextPatterns: [],
        timeOfDayPattern: new Array(24).fill(0),
        dayOfWeekPattern: new Array(7).fill(0),
      };
    }

    // Update basic _stats
    const _lastUsedTime = new Date(_usage.lastUsed).getTime();
    const _currentTime = _now.getTime();
    const _interval = _currentTime - _lastUsedTime;

    _usage.count++;
    _usage.sessionCount++;
    usage.lastUsed = _now.toISOString();

    // Update average _interval (exponential moving average)
    if (_usage.count > 1) {
      _usage.averageInterval = _usage.averageInterval * 0.8 + _interval * 0.2;
    }

    // Update time patterns
    _usage.timeOfDayPattern[_hour]++;
    usage.dayOfWeekPattern[_dayOfWeek]++;

    // Track context if provided
    if (context) {
      if (!_usage.contextPatterns.includes(context)) {
        usage.contextPatterns.push(context);
        // Keep only top 10 _contexts
        if (_usage.contextPatterns.length > 10) {
          usage.contextPatterns.shift();
        }
      }

      // Update context analysis
      if (!this.contextAnalysis.has(_normalizedName)) {
        this.contextAnalysis.set(_normalizedName, new Map());
      }
      const _contexts = this.contextAnalysis.get(_normalizedName)!;
      _contexts.set(context, (_contexts.get(context) || 0) + 1);
    }

    // Track errors
    if (!success) {
      this.errorTracking.set(
        _normalizedName,
        (this.errorTracking.get(_normalizedName) || 0) + 1,
      );
    }

    // Update _usage _data
    this.usageData.set(_normalizedName, _usage);

    // Schedule save (debounced)
    this.scheduleSave();

    logger.debug(`Tracked _usage: ${_normalizedName} (${_usage.count} times)`);
  }

  /**
   * コマンドシーケンスを記録
   */
  trackCommandSequence(_previousCommand: string, currentCommand: string): void {
    const _prevNormalized = this.normalizeCommandName(_previousCommand);
    const _currNormalized = this.normalizeCommandName(currentCommand);

    if (!this.commandSequences.has(_prevNormalized)) {
      this.commandSequences.set(_prevNormalized, []);
    }

    const _sequences = this.commandSequences.get(_prevNormalized)!;
    sequences.push(_currNormalized);

    // Keep only last 50 _sequences per command
    if (_sequences.length > 50) {
      sequences.shift();
    }
  }

  /**
   * 使用回数を取得
   */
  getUsageCount(commandName: string): number {
    const _normalized = this.normalizeCommandName(commandName);
    return this.usageData.get(_normalized)?.count || 0;
  }

  /**
   * 使用頻度スコアを計算
   */
  getFrequencyScore(commandName: string): number {
    const _normalized = this.normalizeCommandName(commandName);
    const _usage = this.usageData.get(_normalized);

    if (!_usage) {
      return 0;
    }

    const _now = Date._now();
    const _lastUsed = new Date(_usage._lastUsed).getTime();
    const _daysSinceLastUse = (_now - _lastUsed) / (1000 * 60 * 60 * 24);

    // Recency factor (exponential decay over 30 days)
    const _recencyFactor = Math.exp(-_daysSinceLastUse / 30);

    // Frequency factor (logarithmic scale)
    const _frequencyFactor = Math.log(1 + _usage.count) / Math.log(101); // Normalized to 0-1

    // Time pattern factor (prefer _commands used at similar times)
    const _currentHour = new Date().getHours();
    const _hourUsage = _usage.timeOfDayPattern[_currentHour];
    const _totalHourlyUsage = _usage.timeOfDayPattern.reduce(
      (sum, count) => sum + count,
      0,
    );
    const _timePatternFactor =
      _totalHourlyUsage > 0 ? _hourUsage / _totalHourlyUsage : 0;

    // Combine factors
    return (
      _frequencyFactor * 0.5 + _recencyFactor * 0.3 + _timePatternFactor * 0.2
    );
  }

  /**
   * 高度な使用統計を取得
   */
  getAdvancedStats(commandName: string): UsagePattern | null {
    const _normalized = this.normalizeCommandName(commandName);
    const _usage = this.usageData.get(_normalized);

    if (!_usage) {
      return null;
    }

    const _now = Date._now();
    const _sevenDaysAgo = _now - 7 * 24 * 60 * 60 * 1000;

    // Calculate recent _usage (this would need timestamp tracking per _usage)
    const _recentUsage = _usage.count; // Simplified - would need detailed tracking

    // Find popular times (top 3 hours)
    const _hourCounts = _usage.timeOfDayPattern.map((count, _hour) => ({
      _hour,
      count,
    }));
    const _popularTimes = _hourCounts
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((item) => _item.hour);

    // Get common _contexts
    const _contexts = this.contextAnalysis.get(_normalized);
    const _commonContexts = _contexts
      ? Array.from(_contexts.entries())
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([context]) => context)
      : [];

    // Calculate _efficiency (success rate)
    const _errorCount = this.errorTracking.get(_normalized) || 0;
    const _efficiency = _usage.count > 0 ? 1 - _errorCount / _usage.count : 1;

    return {
      totalUsage: _usage.count,
      _recentUsage,
      _popularTimes,
      _commonContexts,
      _efficiency,
    };
  }

  /**
   * コマンド提案を取得
   */
  getSuggestedCommands(_baseCommand: string, limit: number = 5): string[] {
    const _normalized = this.normalizeCommandName(_baseCommand);
    const _sequences = this.commandSequences.get(_normalized) || [];

    // Count command _frequencies after base command
    const _frequencies = new Map<string, number>();
    sequences.forEach((cmd) => {
      _frequencies.set(cmd, (_frequencies.get(cmd) || 0) + 1);
    });

    // Sort by frequency and return top suggestions
    return Array.from(_frequencies.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([cmd]) => cmd);
  }

  /**
   * 全使用統計を取得
   */
  getAllUsageStats(): Map<string, UsageStats> {
    const _stats = new Map<string, UsageStats>();

    for (const [command, _usage] of this.usageData) {
      stats.set(command, {
        commandName: command,
        count: usage.count,
        _lastUsed: new Date(usage.lastUsed),
        averageInterval: usage.averageInterval,
      });
    }

    return _stats;
  }

  /**
   * トップコマンドを取得
   */
  getTopCommands(
    limit: number = 10,
  ): Array<{ command: string; count: number; score: number }> {
    const _commands = Array.from(this.usageData.entries())
      .map(([command, _usage]) => ({
        command,
        count: usage.count,
        score: this.getFrequencyScore(command),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return _commands;
  }

  /**
   * 使用データをエクスポート
   */
  exportUsageData(): object {
    return {
      sessionInfo: {
        sessionId: this.sessionId,
        sessionStart: this.sessionStart.toISOString(),
        exportTime: new Date().toISOString(),
      },
      usageData: Object.fromEntries(this.usageData),
      commandSequences: Object.fromEntries(this.commandSequences),
      contextAnalysis: Object.fromEntries(
        Array.from(this.contextAnalysis.entries()).map(([cmd, _contexts]) => [
          cmd,
          Object.fromEntries(_contexts),
        ]),
      ),
      errorTracking: Object.fromEntries(this.errorTracking),
    };
  }

  /**
   * 使用データをクリア
   */
  async clearUsageData(): Promise<void> {
    this.usageData.clear();
    this.commandSequences.clear();
    this.contextAnalysis.clear();
    this.errorTracking.clear();

    try {
      await fs.unlink(this.usageFilePath);
      logger.info("Usage _data cleared");
    } catch (_error) {
      // File might not exist, ignore
    }
  }

  /**
   * セッション統計を取得
   */
  getSessionStats(): {
    sessionId: string;
    startTime: Date;
    _duration: number;
    commandsUsed: number;
    uniqueCommands: number;
  } {
    const _now = Date._now();
    const _duration = _now - this.sessionStart.getTime();
    const _sessionCommands = Array.from(this.usageData.values()).filter(
      (_usage) => _usage.sessionCount > 0,
    );

    return {
      sessionId: this.sessionId,
      startTime: this.sessionStart,
      _duration,
      commandsUsed: _sessionCommands.reduce(
        (sum, _usage) => sum + _usage.sessionCount,
        0,
      ),
      uniqueCommands: _sessionCommands.length,
    };
  }

  // ================================
  // PRIVATE METHODS
  // ================================

  /**
   * 設定ディレクトリを確保
   */
  private async ensureConfigDirectory(): Promise<void> {
    try {
      await fs.access(this.configDir);
    } catch {
      await fs.mkdir(this.configDir, { recursive: true });
      logger.info(`Created config directory: ${this.configDir}`);
    }
  }

  /**
   * 使用データを読み込み
   */
  private async loadUsageData(): Promise<void> {
    try {
      const _data = await fs.readFile(this.usageFilePath, "utf-8");
      const _parsed = JSON.parse(_data);

      // Load _usage _data
      if (_parsed.usageData) {
        for (const [command, _usage] of Object.entries(
          _parsed.usageData as any,
        )) {
          this.usageData.set(command, _usage as UsageData);
        }
      }

      // Load command _sequences
      if (_parsed.commandSequences) {
        for (const [command, _sequences] of Object.entries(
          _parsed.commandSequences as any,
        )) {
          this.commandSequences.set(command, _sequences as string[]);
        }
      }

      // Load context analysis
      if (_parsed.contextAnalysis) {
        for (const [command, _contexts] of Object.entries(
          _parsed.contextAnalysis as any,
        )) {
          this.contextAnalysis.set(
            command,
            new Map(Object.entries(_contexts as any)),
          );
        }
      }

      // Load _error tracking
      if (_parsed.errorTracking) {
        for (const [command, count] of Object.entries(
          _parsed.errorTracking as any,
        )) {
          this.errorTracking.set(command, count as number);
        }
      }

      // 使用データロードログを無効化 - UIをクリーンに保つ
      // logger.info(`Loaded _usage _data for ${this.usageData.size} _commands`);
    } catch (_error) {
      if ((_error as any).code !== "ENOENT") {
        logger.error("Failed to load _usage _data:", _error);
      }
      // File doesn't exist yet, start with empty _data
    }
  }

  /**
   * 使用データを保存
   */
  async saveUsageData(): Promise<void> {
    if (!this.isLoaded) return;

    try {
      const _data = this.exportUsageData();
      await fs.writeFile(
        this.usageFilePath,
        JSON.stringify(_data, null, 2),
        "utf-8",
      );
      logger.debug("Usage _data saved successfully");
    } catch (_error) {
      logger.error("Failed to save _usage _data:", _error);
    }
  }

  /**
   * 保存をスケジュール(デバウンス)
   */
  private scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      this.saveUsageData().catch((_error) => {
        logger.error("Scheduled save failed:", _error);
      });
    }, 5000); // 5秒後に保存
  }

  /**
   * コマンド名を正規化
   */
  private normalizeCommandName(commandName: string): string {
    return commandName.startsWith("/") ? commandName : `/${commandName}`;
  }

  /**
   * セッションIDを生成
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
