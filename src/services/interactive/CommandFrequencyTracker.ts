/**
 * Command Frequency Tracker
 * コマンド使用頻度追跡サービス - 使用統計とパターン分析
 */

import { EventEmitter } from "node:events";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import os from "os";

export interface CommandUsage {
  commandName: string;
  _count: number;
  lastUsed: Date;
  firstUsed: Date;
  averageInterval: number; // 平均使用間隔(分)
  contexts: string[]; // 使用コンテキスト
  successRate: number; // 成功率
}

export interface UsageSession {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  commandsUsed: string[];
  context: string;
}

export interface UsageStats {
  totalCommands: number;
  uniqueCommands: number;
  mostUsedCommand: string;
  recentlyUsedCommands: string[];
  _productiveHours: number[];
  _averageSessionLength: number;
}

export class CommandFrequencyTracker extends EventEmitter {
  private usageData: Map<string, CommandUsage> = new Map();
  private sessions: UsageSession[] = [];
  private currentSession: UsageSession | null = null;
  private dataFile: string;
  private isInitialized = false;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.dataFile = path.join(os.homedir(), ".maria", "usage-stats.json");
  }

  /**
   * 初期化
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.loadUsageData();
      this.startNewSession();
      this.isInitialized = true;
      this.emit("initialized");
    } catch (_error) {
      this.emit("_error", _error);
      throw _error;
    }
  }

  /**
   * コマンド使用を記録
   */
  public recordUsage(
    commandName: string,
    context: string = "general",
    success: boolean = true,
  ): void {
    if (!this.isInitialized) {
      return;
    }

    const _now = new Date();

    // 使用データを更新
    const _existing = this.usageData.get(commandName);

    if (_existing) {
      // 既存コマンドの更新
      const _timeDiff = _now.getTime() - _existing.lastUsed.getTime();
      const _newInterval = _timeDiff / (1000 * 60); // 分単位

      _existing.count++;
      _existing.lastUsed = _now;
      existing.averageInterval =
        (_existing.averageInterval * (_existing.count - 1) + _newInterval) /
        _existing.count;

      // コンテキストを追加(重複なし)
      if (!_existing.contexts.includes(context)) {
        existing.contexts.push(context);
      }

      // 成功率を更新
      const _totalAttempts = _existing.count;
      const _previousSuccesses = Math.round(
        (_existing.successRate * (_totalAttempts - 1)) / 100,
      );
      const _currentSuccesses = success
        ? _previousSuccesses + 1
        : _previousSuccesses;
      existing.successRate = (_currentSuccesses / _totalAttempts) * 100;
    } else {
      // 新規コマンドの追加
      this.usageData.set(commandName, {
        commandName,
        _count: 1,
        lastUsed: _now,
        firstUsed: _now,
        averageInterval: 0,
        contexts: [context],
        successRate: success ? 100 : 0,
      });
    }

    // 現在のセッションに追加
    if (this.currentSession) {
      this.currentSession.commandsUsed.push(commandName);
      if (!this.currentSession.context) {
        this.currentSession.context = context;
      }
    }

    // イベントを発行
    this.emit("usageRecorded", commandName, this.usageData.get(commandName));
    this.emit(
      "frequencyUpdated",
      commandName,
      this.usageData.get(commandName)!.count,
    );

    // 遅延保存
    this.scheduleSave();
  }

  /**
   * コマンド使用頻度を取得
   */
  public getCommandFrequency(commandName: string): number {
    return this.usageData.get(commandName)?.count || 0;
  }

  /**
   * 最後に使用した日時を取得
   */
  public getLastUsedDate(commandName: string): Date | undefined {
    return this.usageData.get(commandName)?.lastUsed;
  }

  /**
   * コマンド使用統計を取得
   */
  public getUsageStats(): UsageStats {
    const _commands = Array.from(this.usageData.values());
    const _sortedByCount = _commands.sort((a, b) => b.count - a.count);
    const _recentlyUsed = _commands
      .sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime())
      .slice(0, 10)
      .map((cmd) => cmd.commandName);

    // 生産性の高い時間帯を分析
    const _productiveHours = this.calculateProductiveHours();

    // 平均セッション長を計算
    const _completedSessions = this.sessions.filter((s) => s.endTime);
    const _averageSessionLength =
      completedSessions.length > 0
        ? _completedSessions.reduce(
            (sum, s) => sum + (s.endTime!.getTime() - s.startTime.getTime()),
            0,
          ) /
          (_completedSessions.length * 1000 * 60) // 分単位
        : 0;

    return {
      totalCommands: _commands.reduce((sum, cmd) => sum + cmd.count, 0),
      uniqueCommands: _commands.length,
      mostUsedCommand: _sortedByCount[0]?.commandName || "",
      recentlyUsedCommands: _recentlyUsed,
      _productiveHours,
      _averageSessionLength,
    };
  }

  /**
   * 人気のコマンドを取得
   */
  public getPopularCommands(limit: number = 10): CommandUsage[] {
    return Array.from(this.usageData.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * 最近使用したコマンドを取得
   */
  public getRecentCommands(limit: number = 10): CommandUsage[] {
    return Array.from(this.usageData.values())
      .sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime())
      .slice(0, limit);
  }

  /**
   * 特定期間の使用パターンを分析
   */
  public getUsagePattern(days: number = 7): {
    _dailyUsage: { date: string; _count: number }[];
    _hourlyPattern: number[];
    _commandTrends: { command: string; _trend: "up" | "down" | "stable" }[];
  } {
    const _endDate = new Date();
    const _startDate = new Date(
      _endDate.getTime() - days * 24 * 60 * 60 * 1000,
    );

    // 日別使用量
    const _dailyUsage = this.calculateDailyUsage(_startDate, _endDate);

    // 時間別パターン
    const _hourlyPattern = this.calculateHourlyPattern();

    // コマンドトレンド
    const _commandTrends = this.calculateCommandTrends(days);

    return { _dailyUsage, _hourlyPattern, _commandTrends };
  }

  /**
   * コマンド成功率を取得
   */
  public getSuccessRate(commandName: string): number {
    return this.usageData.get(commandName)?.successRate || 0;
  }

  /**
   * 使用コンテキストを取得
   */
  public getUsageContexts(commandName: string): string[] {
    return this.usageData.get(commandName)?.contexts || [];
  }

  /**
   * 新しいセッションを開始
   */
  private startNewSession(): void {
    // 前のセッションを終了
    if (this.currentSession && !this.currentSession.endTime) {
      this.currentSession.endTime = new Date();
    }

    // 新しいセッションを開始
    this.currentSession = {
      sessionId: this.generateSessionId(),
      startTime: new Date(),
      commandsUsed: [],
      context: "",
    };

    this.sessions.push(this.currentSession);
    this.emit("sessionStarted", this.currentSession.sessionId);
  }

  /**
   * 現在のセッションを終了
   */
  public endCurrentSession(): void {
    if (this.currentSession && !this.currentSession.endTime) {
      this.currentSession.endTime = new Date();
      this.emit("sessionEnded", this.currentSession.sessionId);
      this.scheduleSave();
    }
  }

  /**
   * セッションIDを生成
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生産性の高い時間帯を計算
   */
  private calculateProductiveHours(): number[] {
    const _hourlyUsage = new Array(24).fill(0);

    this.sessions.forEach((session) => {
      const _hour = session.startTime.getHours();
      _hourlyUsage[_hour] += session.commandsUsed.length;
    });

    // 上位5つの時間帯を返す
    return _hourlyUsage
      .map((usage, _hour) => ({ _hour, usage }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 5)
      .map((_item) => _item.hour);
  }

  /**
   * 日別使用量を計算
   */
  private calculateDailyUsage(
    _startDate: Date,
    _endDate: Date,
  ): { date: string; _count: number }[] {
    const daily: { date: string; _count: number }[] = [];
    const _current = new Date(_startDate);

    while (_current <= _endDate) {
      const _dateStr = _current.toISOString().split("T")[0];
      const _count = this.sessions
        .filter((s) => s.startTime.toDateString() === _current.toDateString())
        .reduce((sum, s) => sum + s.commandsUsed.length, 0);

      daily.push({ date: _dateStr || "", _count });
      _current.setDate(_current.getDate() + 1);
    }

    return daily;
  }

  /**
   * 時間別パターンを計算
   */
  private calculateHourlyPattern(): number[] {
    const _hourlyUsage = new Array(24).fill(0);

    this.sessions.forEach((session) => {
      const _hour = session.startTime.getHours();
      _hourlyUsage[_hour] += session.commandsUsed.length;
    });

    return _hourlyUsage;
  }

  /**
   * コマンドトレンドを計算
   */
  private calculateCommandTrends(
    days: number,
  ): { command: string; _trend: "up" | "down" | "stable" }[] {
    // 簡単な実装:最近の使用頻度と過去の使用頻度を比較
    const trends: { command: string; _trend: "up" | "down" | "stable" }[] = [];
    // const _threshold = 0.1; // 10%の変化を閾値とする

    for (const [commandName, usage] of this.usageData) {
      // 過去の期間と最近の期間を比較(簡略化)
      const _recentlyUsed =
        usage.lastUsed.getTime() > Date.now() - days * 24 * 60 * 60 * 1000;
      const _trend = _recentlyUsed ? "up" : "stable";

      trends.push({ command: commandName, _trend });
    }

    return trends.slice(0, 20); // 上位20コマンド
  }

  /**
   * 使用データを読み込み
   */
  private async loadUsageData(): Promise<void> {
    try {
      if (existsSync(this.dataFile)) {
        const _data = await readFile(this.dataFile, "utf-8");
        const _parsed = JSON.parse(_data);

        // 使用データを復元
        if (_parsed.usageData) {
          for (const [commandName, usage] of Object.entries(
            _parsed.usageData,
          )) {
            const _typedUsage = usage as {
              lastUsed: string;
              firstUsed: string;
              _count: number;
              successCount: number;
              averageDuration: number;
              errorCount: number;
            };
            this.usageData.set(commandName, {
              ..._typedUsage,
              lastUsed: new Date(_typedUsage.lastUsed),
              firstUsed: new Date(_typedUsage.firstUsed),
            });
          }
        }

        // セッションデータを復元
        if (_parsed.sessions) {
          this.sessions = _parsed.sessions.map(
            (_s: {
              startTime: string;
              endTime?: string;
              commandCount: number;
              successCount: number;
            }) => ({
              ..._s,
              startTime: new Date(_s.startTime),
              endTime: _s.endTime ? new Date(_s.endTime) : undefined,
            }),
          );
        }
      }
    } catch (_error) {
      // ファイルが存在しないか読み込めない場合は空データで開始
      console.warn("Could not load usage _data:", _error);
    }
  }

  /**
   * 使用データを保存
   */
  private async saveUsageData(): Promise<void> {
    try {
      // ディレクトリを作成
      const _dir = path.dirname(this.dataFile);
      await import("fs/promises").then((fs) =>
        fs.mkdir(_dir, { recursive: true }),
      );

      const _data = {
        usageData: Object.fromEntries(this.usageData),
        sessions: this.sessions,
        lastSaved: new Date(),
      };

      await writeFile(this.dataFile, JSON.stringify(_data, null, 2));
      this.emit("dataSaved");
    } catch (_error) {
      this.emit("_error", _error);
    }
  }

  /**
   * 遅延保存をスケジュール
   */
  private scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // 5秒後に保存
    this.saveTimeout = setTimeout(() => {
      this.saveUsageData();
      this.saveTimeout = null;
    }, 5000);
  }

  /**
   * 統計をリセット
   */
  public resetStats(): void {
    this.usageData.clear();
    this.sessions = [];
    this.currentSession = null;
    this.startNewSession();
    this.scheduleSave();
    this.emit("statsReset");
  }

  /**
   * 特定のコマンドの統計をリセット
   */
  public resetCommandStats(commandName: string): void {
    this.usageData.delete(commandName);
    this.scheduleSave();
    this.emit("commandStatsReset", commandName);
  }

  /**
   * リソースをクリーンアップ
   */
  public dispose(): void {
    this.endCurrentSession();

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    // 即座に保存
    this.saveUsageData();

    this.removeAllListeners();
    this.usageData.clear();
    this.sessions = [];
    this.currentSession = null;
    this.isInitialized = false;
  }
}
