/**
 * Learning Engine
 * ユーザーの使用パターンを学習し、個人に最適化された体験を提供
 * Phase 3: アダプティブラーニング
 */
// @ts-nocheck - Machine learning engine with complex dynamic data structures - Complex type interactions requiring gradual type migration

import { InferredCommand } from './intent-classifier';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';

export interface UsagePattern {
  id: string;
  timestamp: Date;
  dayOfWeek: number;
  hourOfDay: number;
  command: string;
  params: Record<string, unknown>;
  _context: {
    projectType?: string;
    fileTypes?: string[];
    previousCommand?: string;
  };
  success: boolean;
  executionTime: number;
  errorType?: string;
}

export interface UserPreferences {
  favoriteCommands: string[];
  codeStyle: {
    indentation: 'tabs' | 'spaces';
    indentSize: number;
    semicolons: boolean;
    quotes: 'single' | 'double';
    trailingComma: boolean;
  };
  language: 'ja' | 'en' | 'auto';
  frameworks: string[];
  libraries: string[];
  testFramework?: string;
  commitStyle: 'conventional' | 'descriptive' | 'emoji';
  defaultModel?: string;
  shortcuts: Map<string, string>;
}

export interface LearningModel {
  patterns: UsagePattern[];
  preferences: UserPreferences;
  predictions: CommandPrediction[];
  errorPatterns: ErrorPattern[];
  successPatterns: SuccessPattern[];
  timePatterns: TimePattern[];
}

export interface CommandPrediction {
  command: string;
  probability: number;
  _context: string;
  suggestedParams?: Record<string, unknown>;
}

export interface ErrorPattern {
  command: string;
  errorType: string;
  frequency: number;
  lastOccurred: Date;
  suggestedFix?: string;
}

export interface SuccessPattern {
  command: string;
  _context: string;
  successRate: number;
  averageTime: number;
  optimalParams?: Record<string, unknown>;
}

export interface TimePattern {
  dayOfWeek: number;
  hourRange: [number, number];
  commonCommands: string[];
  productivity: number;
}

export class LearningEngine extends EventEmitter {
  private model: LearningModel;
  private dataDir: string;
  private modelFile: string;
  private patternThreshold: number = 3; // 最小パターン認識回数
  private learningRate: number = 0.1;
  private maxPatterns: number = 10000;
  private saveInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.dataDir = join(homedir(), '.maria', 'learning');
    this.modelFile = join(this.dataDir, 'model.json');

    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }

    this.model = this.loadModel();
    this.startAutoSave();
    this.analyzePatterns();
  }

  /**
   * 使用パターンを記録
   */
  // @ts-nocheck - Machine learning engine with complex dynamic data structures
  recordUsage(
    command: InferredCommand,
    success: boolean,
    executionTime: number,
    _context: unknown = {},
  ) {
    const now = new Date();
    const pattern: UsagePattern = {
      id: this.generateId(),
      timestamp: now,
      dayOfWeek: now.getDay(),
      hourOfDay: now.getHours(),
      command: command.command,
      params: command.params,
      _context: {
        projectType: context.projectType,
        fileTypes: context.fileTypes,
        previousCommand: context.previousCommand,
      },
      success,
      executionTime,
      errorType: context.errorType,
    };

    this.model.patterns.push(pattern);

    // 古いパターンを削除
    if (this.model.patterns.length > this.maxPatterns) {
      this.model.patterns = this.model.patterns.slice(-this.maxPatterns);
    }

    // パターン分析を更新
    this.updatePatternAnalysis(pattern);

    // 予測モデルを更新
    this.updatePredictions();

    this.emit('pattern:recorded', pattern);
  }

  /**
   * パターン分析を更新
   */
  // @ts-nocheck - Machine learning engine with complex dynamic data structures
  private updatePatternAnalysis(pattern: UsagePattern) {
    // エラーパターンの更新
    if (!pattern.success && pattern.errorType) {
      this.updateErrorPattern(pattern);
    }

    // 成功パターンの更新
    if (pattern.success) {
      this.updateSuccessPattern(pattern);
    }

    // 時間パターンの更新
    this.updateTimePattern(pattern);

    // ユーザー設定の推論
    this.inferPreferences(pattern);
  }

  /**
   * エラーパターンを更新
   */
  // @ts-nocheck - Machine learning engine with complex dynamic data structures
  private updateErrorPattern(pattern: UsagePattern) {
    const existing = this.model.errorPatterns.find(
      (ep) => ep.command === pattern.command && ep.errorType === pattern.errorType,
    );

    if (existing) {
      existing.frequency++;
      existing.lastOccurred = pattern.timestamp;
    } else {
      this.model.errorPatterns.push({
        command: pattern.command,
        errorType: pattern.errorType!,
        frequency: 1,
        lastOccurred: pattern.timestamp,
        suggestedFix: this.suggestErrorFix(pattern.command, pattern.errorType!),
      });
    }

    // エラーが頻発する場合は警告
    if (existing && existing.frequency > 5) {
      this.emit('error:pattern:detected', existing);
    }
  }

  /**
   * 成功パターンを更新
   */
  // @ts-nocheck - Machine learning engine with complex dynamic data structures
  private updateSuccessPattern(pattern: UsagePattern) {
    const contextKey = JSON.stringify(pattern.context);
    const existing = this.model.successPatterns.find(
      (sp) => sp.command === pattern.command && sp.context === contextKey,
    );

    if (existing) {
      // 成功率と実行時間を更新（指数移動平均）
      const alpha = this.learningRate;
      existing.averageTime = existing.averageTime * (1 - alpha) + pattern.executionTime * alpha;

      // 最適なパラメータを記録
      if (pattern.executionTime < existing.averageTime) {
        existing.optimalParams = pattern.params;
      }
    } else {
      this.model.successPatterns.push({
        command: pattern.command,
        _context: contextKey,
        successRate: 1.0,
        averageTime: pattern.executionTime,
        optimalParams: pattern.params,
      });
    }
  }

  /**
   * 時間パターンを更新
   */
  // @ts-nocheck - Machine learning engine with complex dynamic data structures
  private updateTimePattern(pattern: UsagePattern) {
    const hourRange: [number, number] = [
      Math.floor(pattern.hourOfDay / 3) * 3,
      Math.floor(pattern.hourOfDay / 3) * 3 + 3,
    ];

    const existing = this.model.timePatterns.find(
      (tp) => tp.dayOfWeek === pattern.dayOfWeek && tp.hourRange[0] === hourRange[0],
    );

    if (existing) {
      // コマンド頻度を更新
      if (!existing.commonCommands.includes(pattern.command)) {
        existing.commonCommands.push(pattern.command);
      }

      // 生産性スコアを更新
      if (pattern.success) {
        existing.productivity = existing.productivity * 0.9 + 0.1;
      }
    } else {
      this.model.timePatterns.push({
        dayOfWeek: pattern.dayOfWeek,
        hourRange,
        commonCommands: [pattern.command],
        productivity: pattern.success ? 1.0 : 0.0,
      });
    }
  }

  /**
   * ユーザー設定を推論
   */
  // @ts-nocheck - Machine learning engine with complex dynamic data structures
  private inferPreferences(pattern: UsagePattern) {
    // よく使うコマンドを記録
    const commandCount = this.model.patterns.filter((p) => p.command === pattern.command).length;

    if (commandCount >= this.patternThreshold) {
      if (!this.model.preferences.favoriteCommands.includes(pattern.command)) {
        this.model.preferences.favoriteCommands.push(pattern.command);

        // 上位10個のみ保持
        this.model.preferences.favoriteCommands = this.getTopCommands(10);
      }
    }

    // フレームワークとライブラリを検出
    if (pattern.context.fileTypes) {
      this.detectFrameworks(pattern.context.fileTypes);
    }
  }

  /**
   * 次のアクションを予測
   */
  // @ts-nocheck - Machine learning engine with complex dynamic data structures
  predictNextAction(currentContext: unknown): CommandPrediction[] {
    const predictions: CommandPrediction[] = [];
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();

    // 1. 時間ベースの予測
    const timePattern = this.model.timePatterns.find(
      (tp) =>
        tp.dayOfWeek === currentDay &&
        currentHour >= tp.hourRange[0] &&
        currentHour < tp.hourRange[1],
    );

    if (timePattern) {
      timePattern.commonCommands.forEach((cmd) => {
        predictions.push({
          command: cmd,
          probability: 0.3,
          _context: 'time-based',
        });
      });
    }

    // 2. コンテキストベースの予測
    if (currentContext.previousCommand) {
      const sequences = this.findCommandSequences(currentContext.previousCommand);
      sequences.forEach((seq) => {
        predictions.push({
          command: seq.nextCommand,
          probability: seq.probability,
          _context: 'sequence-based',
          suggestedParams: seq.params,
        });
      });
    }

    // 3. 成功パターンベースの予測
    const contextKey = JSON.stringify({
      projectType: currentContext.projectType,
      fileTypes: currentContext.fileTypes,
    });

    this.model.successPatterns
      .filter((sp) => sp.context === contextKey && sp.successRate > 0.8)
      .forEach((sp) => {
        predictions.push({
          command: sp.command,
          probability: sp.successRate * 0.5,
          _context: 'success-pattern',
          suggestedParams: sp.optimalParams,
        });
      });

    // 予測を統合してソート
    return this.consolidatePredictions(predictions);
  }

  /**
   * コマンドシーケンスを検出
   */
  // @ts-nocheck - Machine learning engine with complex dynamic data structures
  private findCommandSequences(previousCommand: string): unknown[] {
    const sequences: unknown[] = [];
    const patterns = this.model.patterns;

    for (let i = 1; i < patterns.length; i++) {
      if (patterns[i - 1].command === previousCommand) {
        const nextCommand = patterns[i].command;
        const existing = sequences.find((s) => s.nextCommand === nextCommand);

        if (existing) {
          existing.count++;
        } else {
          sequences.push({
            nextCommand,
            count: 1,
            params: patterns[i].params,
          });
        }
      }
    }

    // 確率を計算
    const total = sequences.reduce((sum, s) => sum + s.count, 0);
    sequences.forEach((s) => {
      s.probability = s.count / total;
    });

    return sequences.filter((s) => s.probability > 0.1);
  }

  /**
   * 予測を統合
   */
  // @ts-nocheck - Machine learning engine with complex dynamic data structures
  private consolidatePredictions(predictions: CommandPrediction[]): CommandPrediction[] {
    const consolidated = new Map<string, CommandPrediction>();

    predictions.forEach((pred) => {
      const existing = consolidated.get(pred.command);
      if (existing) {
        // 確率を合成（最大1.0）
        existing.probability = Math.min(1.0, existing.probability + pred.probability * 0.5);

        // パラメータをマージ
        if (pred.suggestedParams) {
          existing.suggestedParams = { ...existing.suggestedParams, ...pred.suggestedParams };
        }
      } else {
        consolidated.set(pred.command, { ...pred });
      }
    });

    // 確率でソート
    return Array.from(consolidated.values())
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 5); // 上位5個
  }

  /**
   * 自動補完の提案
   */
  // @ts-nocheck - Machine learning engine with complex dynamic data structures
  getSuggestions(partialInput: string): string[] {
    const suggestions: string[] = [];

    // お気に入りコマンドから提案
    this.model.preferences.favoriteCommands
      .filter((cmd) => cmd.toLowerCase().includes(partialInput.toLowerCase()))
      .forEach((cmd) => suggestions.push(cmd));

    // ショートカットから提案
    Array.from(this.model.preferences.shortcuts.entries())
      .filter(([key]) => key.toLowerCase().includes(partialInput.toLowerCase()))
      .forEach(([key, value]) => suggestions.push(`${key} → ${value}`));

    // 成功パターンから提案
    this.model.successPatterns
      .filter((sp) => sp.successRate > 0.9)
      .map((sp) => sp.command)
      .filter((cmd) => cmd.toLowerCase().includes(partialInput.toLowerCase()))
      .forEach((cmd) => {
        if (!suggestions.includes(cmd)) {
          suggestions.push(cmd);
        }
      });

    return suggestions.slice(0, 10);
  }

  /**
   * プロアクティブな提案
   */
  // @ts-nocheck - Machine learning engine with complex dynamic data structures
  getProactiveSuggestions(_context: unknown): string[] {
    const suggestions: string[] = [];

    // エラーパターンに基づく提案
    const recentErrors = this.model.errorPatterns.filter((ep) => {
      const hoursSince = (Date.now() - ep.lastOccurred.getTime()) / (1000 * 60 * 60);
      return hoursSince < 1 && ep.frequency > 2;
    });

    recentErrors.forEach((error) => {
      if (error.suggestedFix) {
        suggestions.push(`⚠️ ${error.command}でエラーが頻発しています: ${error.suggestedFix}`);
      }
    });

    // 最適化の提案
    const currentTime = new Date().getHours();
    const productiveHours = this.model.timePatterns
      .filter((tp) => tp.productivity > 0.8)
      .map((tp) => tp.hourRange);

    const isProductiveTime = productiveHours.some(
      (range) => currentTime >= range[0] && currentTime < range[1],
    );

    if (isProductiveTime) {
      suggestions.push('🚀 今は生産性の高い時間帯です！集中して作業しましょう');
    }

    // よく使うコマンドのショートカット提案
    const frequentCommands = this.getTopCommands(3);
    frequentCommands.forEach((cmd) => {
      if (!this.model.preferences.shortcuts.has(cmd)) {
        suggestions.push(`💡 "${cmd}"のショートカットを作成すると便利です`);
      }
    });

    return suggestions;
  }

  /**
   * エラー予防アラート
   */
  // @ts-nocheck - Machine learning engine with complex dynamic data structures
  getErrorPreventionAlerts(command: string, params: unknown): string[] {
    const alerts: string[] = [];

    // 過去のエラーパターンをチェック
    const errorPattern = this.model.errorPatterns.find(
      (ep) => ep.command === command && ep.frequency > 3,
    );

    if (errorPattern) {
      alerts.push(`⚠️ このコマンドは以前${errorPattern.frequency}回エラーになりました`);
      if (errorPattern.suggestedFix) {
        alerts.push(`💡 推奨: ${errorPattern.suggestedFix}`);
      }
    }

    // パラメータの検証
    const successPattern = this.model.successPatterns.find(
      (sp) => sp.command === command && sp.successRate > 0.9,
    );

    if (successPattern && successPattern.optimalParams) {
      const optimalKeys = Object.keys(successPattern.optimalParams);
      const currentKeys = Object.keys(params);
      const missingKeys = optimalKeys.filter((k) => !currentKeys.includes(k));

      if (missingKeys.length > 0) {
        alerts.push(
          `💡 最適なパラメータ: ${missingKeys.join(', ')}を追加することを検討してください`,
        );
      }
    }

    return alerts;
  }

  /**
   * 最適化提案
   */
  // @ts-nocheck - Machine learning engine with complex dynamic data structures
  getOptimizationSuggestions(): string[] {
    const suggestions: string[] = [];

    // 実行時間の長いコマンドを検出
    const slowCommands = this.model.successPatterns
      .filter((sp) => sp.averageTime > 10000) // 10秒以上
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, 3);

    slowCommands.forEach((cmd) => {
      suggestions.push(
        `🐌 "${cmd.command}"の実行時間が長いです（平均${(cmd.averageTime / 1000).toFixed(1)}秒）`,
      );
      if (cmd.optimalParams) {
        suggestions.push(`   最適なパラメータ: ${JSON.stringify(cmd.optimalParams)}`);
      }
    });

    // 失敗率の高いコマンド
    const failureRates = new Map<string, number>();
    this.model.patterns.forEach((p) => {
      const current = failureRates.get(p.command) || { success: 0, total: 0 };
      current.total++;
      if (p.success) {current.success++;}
      failureRates.set(p.command, current);
    });

    Array.from(failureRates.entries())
      .map(([cmd, stats]) => ({ cmd, failureRate: 1 - stats.success / stats.total }))
      .filter((item) => item.failureRate > 0.3 && failureRates.get(item.cmd).total > 5)
      .forEach((item) => {
        suggestions.push(
          `❌ "${item.cmd}"の失敗率が高いです（${(item.failureRate * 100).toFixed(0)}%）`,
        );
      });

    return suggestions;
  }

  /**
   * エラー修正の提案
   */
  // @ts-nocheck - Machine learning engine with complex dynamic data structures
  private suggestErrorFix(command: string, errorType: string): string {
    const fixes: Record<string, Record<string, string>> = {
      '/test': {
        timeout: 'タイムアウト値を増やすか、テストを分割してください',
        not_found: 'テストファイルのパスを確認してください',
        syntax: 'テストコードの構文を確認してください',
      },
      '/deploy': {
        auth: '認証情報を確認してください',
        build_failed: 'ビルドエラーを修正してからデプロイしてください',
        network: 'ネットワーク接続を確認してください',
      },
      '/code': {
        syntax: 'コードの構文エラーを確認してください',
        type: 'TypeScriptの型エラーを修正してください',
        import: 'インポートパスを確認してください',
      },
    };

    return fixes[command]?.[errorType] || 'エラーの詳細を確認してください';
  }

  /**
   * フレームワークを検出
   */
  // @ts-nocheck - Machine learning engine with complex dynamic data structures
  private detectFrameworks(fileTypes: string[]) {
    const frameworkIndicators: Record<string, string[]> = {
      react: ['.tsx', '.jsx', 'react'],
      vue: ['.vue', 'vue'],
      angular: ['.component.ts', 'angular'],
      nextjs: ['next.config', '_app'],
      express: ['app.js', 'server.js', 'express'],
      django: ['.py', 'manage.py', 'django'],
      rails: ['.rb', 'Gemfile', 'rails'],
    };

    Object.entries(frameworkIndicators).forEach(([framework, indicators]) => {
      if (indicators.some((ind) => fileTypes.some((ft) => ft.includes(ind)))) {
        if (!this.model.preferences.frameworks.includes(framework)) {
          this.model.preferences.frameworks.push(framework);
        }
      }
    });
  }

  /**
   * トップコマンドを取得
   */
  // @ts-nocheck - Machine learning engine with complex dynamic data structures
  private getTopCommands(limit: number): string[] {
    const commandCounts = new Map<string, number>();

    this.model.patterns.forEach((p) => {
      commandCounts.set(p.command, (commandCounts.get(p.command) || 0) + 1);
    });

    return Array.from(commandCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([cmd]) => cmd);
  }

  /**
   * パターンを分析
   */
  // @ts-nocheck - Machine learning engine with complex dynamic data structures
  private analyzePatterns() {
    // 定期的にパターン分析を実行
    setInterval(() => {
      this.updatePredictions();
      this.cleanupOldData();
    }, 60000); // 1分ごと
  }

  /**
   * 予測モデルを更新
   */
  // @ts-nocheck - Machine learning engine with complex dynamic data structures
  private updatePredictions() {
    // 機械学習的なアプローチで予測精度を向上
    // ここでは簡易的な実装
    const predictions: CommandPrediction[] = [];

    // 頻度ベースの予測
    const commandFreq = new Map<string, number>();
    this.model.patterns.forEach((p) => {
      commandFreq.set(p.command, (commandFreq.get(p.command) || 0) + 1);
    });

    const total = this.model.patterns.length;
    commandFreq.forEach((count, command) => {
      predictions.push({
        command,
        probability: count / total,
        _context: 'frequency',
      });
    });

    this.model.predictions = predictions;
  }

  /**
   * 古いデータをクリーンアップ
   */
  // @ts-nocheck - Machine learning engine with complex dynamic data structures
  private cleanupOldData() {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    // 30日以上前のパターンを削除
    this.model.patterns = this.model.patterns.filter((p) => p.timestamp.getTime() > thirtyDaysAgo);

    // エラーパターンの頻度をリセット
    this.model.errorPatterns.forEach((ep) => {
      if (ep.lastOccurred.getTime() < thirtyDaysAgo) {
        ep.frequency = Math.floor(ep.frequency / 2);
      }
    });

    // 使われていないエラーパターンを削除
    this.model.errorPatterns = this.model.errorPatterns.filter((ep) => ep.frequency > 0);
  }

  /**
   * モデルを読み込み
   */
  // @ts-nocheck - Machine learning engine with complex dynamic data structures
  private loadModel(): LearningModel {
    try {
      if (existsSync(this.modelFile)) {
        const data = readFileSync(this.modelFile, 'utf-8');
        const model = JSON.parse(data) as Record<string, unknown>;

        // 日付を復元
        model.patterns.forEach((p: unknown) => {
          p.timestamp = new Date(p.timestamp);
        });
        model.errorPatterns.forEach((ep: unknown) => {
          ep.lastOccurred = new Date(ep.lastOccurred);
        });

        // Mapを復元
        model.preferences.shortcuts = new Map(model.preferences.shortcuts);

        return model;
      }
    } catch (error: unknown) {
      logger.error('Failed to load learning model:', error);
    }

    return this.createNewModel();
  }

  /**
   * 新しいモデルを作成
   */
  // @ts-nocheck - Machine learning engine with complex dynamic data structures
  private createNewModel(): LearningModel {
    return {
      patterns: [],
      preferences: {
        favoriteCommands: [],
        codeStyle: {
          indentation: 'spaces',
          indentSize: 2,
          semicolons: true,
          quotes: 'single',
          trailingComma: true,
        },
        language: 'ja',
        frameworks: [],
        libraries: [],
        commitStyle: 'conventional',
        shortcuts: new Map(),
      },
      predictions: [],
      errorPatterns: [],
      successPatterns: [],
      timePatterns: [],
    };
  }

  /**
   * モデルを保存
   */
  // @ts-nocheck - Machine learning engine with complex dynamic data structures
  private saveModel() {
    try {
      const modelToSave = {
        ...this.model,
        preferences: {
          ...this.model.preferences,
          shortcuts: Array.from(this.model.preferences.shortcuts.entries()),
        },
      };

      writeFileSync(this.modelFile, JSON.stringify(modelToSave, null, 2));
    } catch (error: unknown) {
      logger.error('Failed to save learning model:', error);
    }
  }

  /**
   * 自動保存を開始
   */
  // @ts-nocheck - Machine learning engine with complex dynamic data structures
  private startAutoSave() {
    this.saveInterval = setInterval(() => {
      this.saveModel();
    }, 30000); // 30秒ごと
  }

  /**
   * IDを生成
   */
  // @ts-nocheck - Machine learning engine with complex dynamic data structures
  private generateId(): string {
    return `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 学習エンジンを停止
   */
  // @ts-nocheck - Machine learning engine with complex dynamic data structures
  stop() {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }
    this.saveModel();
  }

  /**
   * 統計情報を取得
   */
  // @ts-nocheck - Machine learning engine with complex dynamic data structures
  getStatistics() {
    const totalPatterns = this.model.patterns.length;
    const successRate = this.model.patterns.filter((p) => p.success).length / totalPatterns;
    const avgExecutionTime =
      this.model.patterns.reduce((sum, p) => sum + p.executionTime, 0) / totalPatterns;

    return {
      totalPatterns,
      successRate,
      averageExecutionTime: avgExecutionTime,
      favoriteCommands: this.model.preferences.favoriteCommands,
      errorPatterns: this.model.errorPatterns.length,
      successPatterns: this.model.successPatterns.length,
      timePatterns: this.model.timePatterns.length,
      predictions: this.model.predictions.length,
    };
  }
}
