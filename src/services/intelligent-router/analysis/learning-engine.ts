/**
 * Learning Engine
 * ユーザーの使用パターンを学習し、個人に最適化された体験を提供
 * Phase 3: アダプティブラーニング
 */
// Machine learning engine with complex dynamic _data structures - gradually adding types

import { InferredCommand } from "./intent-classifier";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { EventEmitter } from "node:events";
import { logger } from "../../utils/logger";

export interface UsagePattern {
  id: string;
  timestamp: Date;
  dayOfWeek: number;
  hourOfDay: number;
  command: string;
  params: Record<string, unknown>;
  context: {
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
    indentation: "tabs" | "spaces";
    indentSize: number;
    semicolons: boolean;
    quotes: "single" | "double";
    trailingComma: boolean;
  };
  language: "ja" | "en" | "auto";
  frameworks: string[];
  libraries: string[];
  testFramework?: string;
  commitStyle: "conventional" | "descriptive" | "emoji";
  defaultModel?: string;
  shortcuts: Map<string, string>;
}

export interface LearningModel {
  _patterns: UsagePattern[];
  preferences: UserPreferences;
  predictions: CommandPrediction[];
  errorPatterns: ErrorPattern[];
  successPatterns: SuccessPattern[];
  timePatterns: TimePattern[];
}

export interface CommandPrediction {
  command: string;
  probability: number;
  context: string;
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
  context: string;
  _successRate: number;
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
  private _model: LearningModel;
  private dataDir: string;
  private modelFile: string;
  private patternThreshold: number = 3; // 最小パターン認識回数
  private learningRate: number = 0.1;
  private maxPatterns: number = 10000;
  private saveInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.dataDir = join(homedir(), ".maria", "learning");
    this.modelFile = join(this.dataDir, "model.json");

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
  //  - Machine learning engine with complex dynamic _data structures
  recordUsage(
    _command: InferredCommand,
    success: boolean,
    executionTime: number,
    context: unknown = {},
  ) {
    const _now = new Date();
    const pattern: UsagePattern = {
      id: this.generateId(),
      timestamp: _now,
      dayOfWeek: _now.getDay(),
      hourOfDay: _now.getHours(),
      _command: _command._command,
      params: _command.params,
      context: {
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

    this.emit("pattern:recorded", pattern);
  }

  /**
   * パターン分析を更新
   */
  //  - Machine learning engine with complex dynamic _data structures
  private updatePatternAnalysis(_pattern: UsagePattern) {
    // エラーパターンの更新
    if (!_pattern.success && _pattern.errorType) {
      this.updateErrorPattern(_pattern);
    }

    // 成功パターンの更新
    if (_pattern.success) {
      this.updateSuccessPattern(_pattern);
    }

    // 時間パターンの更新
    this.updateTimePattern(_pattern);

    // ユーザー設定の推論
    this.inferPreferences(_pattern);
  }

  /**
   * エラーパターンを更新
   */
  //  - Machine learning engine with complex dynamic _data structures
  private updateErrorPattern(_pattern: UsagePattern) {
    const _existing = this.model.errorPatterns.find(
      (ep) =>
        ep.command === _pattern.command && ep.errorType === _pattern.errorType,
    );

    if (_existing) {
      _existing.frequency++;
      existing.lastOccurred = _pattern.timestamp;
    } else {
      this.model.errorPatterns.push({
        command: _pattern.command,
        errorType: _pattern.errorType!,
        frequency: 1,
        lastOccurred: _pattern.timestamp,
        suggestedFix: this.suggestErrorFix(
          _pattern.command,
          _pattern.errorType!,
        ),
      });
    }

    // エラーが頻発する場合は警告
    if (_existing && _existing.frequency > 5) {
      this.emit("_error:pattern:detected", _existing);
    }
  }

  /**
   * 成功パターンを更新
   */
  //  - Machine learning engine with complex dynamic _data structures
  private updateSuccessPattern(_pattern: UsagePattern) {
    const _contextKey = JSON.stringify(_pattern.context);
    const _existing = this.model.successPatterns.find(
      (sp) => sp.command === _pattern.command && sp.context === _contextKey,
    );

    if (_existing) {
      // 成功率と実行時間を更新(指数移動平均)
      const _alpha = this.learningRate;
      _existing.averageTime =
        _existing.averageTime * (1 - _alpha) + _pattern.executionTime * _alpha;

      // 最適なパラメータを記録
      if (_pattern.executionTime < _existing.averageTime) {
        existing.optimalParams = _pattern.params;
      }
    } else {
      this.model.successPatterns.push({
        command: _pattern.command,
        context: _contextKey,
        _successRate: 1.0,
        averageTime: _pattern.executionTime,
        optimalParams: _pattern.params,
      });
    }
  }

  /**
   * 時間パターンを更新
   */
  //  - Machine learning engine with complex dynamic _data structures
  private updateTimePattern(_pattern: UsagePattern) {
    const hourRange: [number, number] = [
      Math.floor(_pattern.hourOfDay / 3) * 3,
      Math.floor(_pattern.hourOfDay / 3) * 3 + 3,
    ];

    const _existing = this.model.timePatterns.find(
      (tp) =>
        tp.dayOfWeek === _pattern.dayOfWeek && tp.hourRange[0] === hourRange[0],
    );

    if (_existing) {
      // コマンド頻度を更新
      if (!_existing.commonCommands.includes(_pattern.command)) {
        existing.commonCommands.push(_pattern.command);
      }

      // 生産性スコアを更新
      if (_pattern.success) {
        _existing.productivity = _existing.productivity * 0.9 + 0.1;
      }
    } else {
      this.model.timePatterns.push({
        dayOfWeek: _pattern.dayOfWeek,
        hourRange,
        commonCommands: [_pattern.command],
        productivity: _pattern.success ? 1.0 : 0.0,
      });
    }
  }

  /**
   * ユーザー設定を推論
   */
  //  - Machine learning engine with complex dynamic _data structures
  private inferPreferences(_pattern: UsagePattern) {
    // よく使うコマンドを記録
    const _commandCount = this.model.patterns.filter(
      (p) => p.command === _pattern.command,
    ).length;

    if (_commandCount >= this.patternThreshold) {
      if (!this.model.preferences.favoriteCommands.includes(_pattern.command)) {
        this.model.preferences.favoriteCommands.push(_pattern.command);

        // 上位10個のみ保持
        this.model.preferences.favoriteCommands = this.getTopCommands(10);
      }
    }

    // フレームワークとライブラリを検出
    if (_pattern.context.fileTypes) {
      this.detectFrameworks(_pattern.context.fileTypes);
    }
  }

  /**
   * 次のアクションを予測
   */
  //  - Machine learning engine with complex dynamic _data structures
  predictNextAction(currentContext: unknown): CommandPrediction[] {
    const predictions: CommandPrediction[] = [];
    const _now = new Date();
    const _currentHour = _now.getHours();
    const _currentDay = _now.getDay();

    // 1. 時間ベースの予測
    const _timePattern = this.model.timePatterns.find(
      (tp) =>
        tp.dayOfWeek === _currentDay &&
        _currentHour >= tp.hourRange[0] &&
        _currentHour < tp.hourRange[1],
    );

    if (_timePattern) {
      timePattern.commonCommands.forEach((cmd) => {
        predictions.push({
          command: cmd,
          probability: 0.3,
          context: "time-based",
        });
      });
    }

    // 2. コンテキストベースの予測
    if (currentContext.previousCommand) {
      const _sequences = this.findCommandSequences(
        currentContext.previousCommand,
      );
      sequences.forEach((seq) => {
        predictions.push({
          command: seq.nextCommand,
          probability: seq.probability,
          context: "sequence-based",
          suggestedParams: seq.params,
        });
      });
    }

    // 3. 成功パターンベースの予測
    const _contextKey = JSON.stringify({
      projectType: currentContext.projectType,
      fileTypes: currentContext.fileTypes,
    });

    this.model.successPatterns
      .filter((sp) => sp.context === _contextKey && sp.successRate > 0.8)
      .forEach((sp) => {
        predictions.push({
          command: sp.command,
          probability: sp.successRate * 0.5,
          context: "success-pattern",
          suggestedParams: sp.optimalParams,
        });
      });

    // 予測を統合してソート
    return this.consolidatePredictions(predictions);
  }

  /**
   * コマンドシーケンスを検出
   */
  //  - Machine learning engine with complex dynamic _data structures
  private findCommandSequences(previousCommand: string): unknown[] {
    const _sequences: unknown[] = [];
    const _patterns = this.model._patterns;

    for (let i = 1; i < _patterns.length; i++) {
      if (_patterns[i - 1].command === previousCommand) {
        const _nextCommand = _patterns[i].command;
        const _existing = _sequences.find(
          (s) => s._nextCommand === _nextCommand,
        );

        if (_existing) {
          existing.count++;
        } else {
          sequences.push({
            _nextCommand,
            count: 1,
            params: _patterns[i].params,
          });
        }
      }
    }

    // 確率を計算
    const _total = _sequences.reduce((sum, s) => sum + s.count, 0);
    sequences.forEach((s) => {
      s.probability = s.count / _total;
    });

    return _sequences.filter((s) => s.probability > 0.1);
  }

  /**
   * 予測を統合
   */
  //  - Machine learning engine with complex dynamic _data structures
  private consolidatePredictions(
    predictions: CommandPrediction[],
  ): CommandPrediction[] {
    const _consolidated = new Map<string, CommandPrediction>();

    predictions.forEach((pred) => {
      const _existing = _consolidated.get(pred.command);
      if (_existing) {
        // 確率を合成(最大1.0)
        _existing.probability = Math.min(
          1.0,
          _existing.probability + pred.probability * 0.5,
        );

        // パラメータをマージ
        if (pred.suggestedParams) {
          _existing.suggestedParams = {
            ..._existing.suggestedParams,
            ...pred.suggestedParams,
          };
        }
      } else {
        consolidated.set(pred.command, { ...pred });
      }
    });

    // 確率でソート
    return Array.from(_consolidated.values())
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 5); // 上位5個
  }

  /**
   * 自動補完の提案
   */
  //  - Machine learning engine with complex dynamic _data structures
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
  //  - Machine learning engine with complex dynamic _data structures
  getProactiveSuggestions(_context: unknown): string[] {
    const suggestions: string[] = [];

    // エラーパターンに基づく提案
    const _recentErrors = this.model.errorPatterns.filter((ep) => {
      const _hoursSince =
        (Date.now() - ep.lastOccurred.getTime()) / (1000 * 60 * 60);
      return _hoursSince < 1 && ep.frequency > 2;
    });

    recentErrors.forEach((_error) => {
      if (_error.suggestedFix) {
        suggestions.push(
          `⚠️ ${_error.command}でエラーが頻発しています: ${_error.suggestedFix}`,
        );
      }
    });

    // 最適化の提案
    const _currentTime = new Date().getHours();
    const _productiveHours = this.model.timePatterns
      .filter((tp) => tp.productivity > 0.8)
      .map((tp) => tp.hourRange);

    const _isProductiveTime = _productiveHours.some(
      (range) => _currentTime >= range[0] && _currentTime < range[1],
    );

    if (_isProductiveTime) {
      suggestions.push("🚀 今は生産性の高い時間帯です！集中して作業しましょう");
    }

    // よく使うコマンドのショートカット提案
    const _frequentCommands = this.getTopCommands(3);
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
  //  - Machine learning engine with complex dynamic _data structures
  getErrorPreventionAlerts(_command: string, params: unknown): string[] {
    const alerts: string[] = [];

    // 過去のエラーパターンをチェック
    const _errorPattern = this.model.errorPatterns.find(
      (ep) => ep._command === _command && ep.frequency > 3,
    );

    if (_errorPattern) {
      alerts.push(
        `⚠️ このコマンドは以前${_errorPattern.frequency}回エラーになりました`,
      );
      if (_errorPattern.suggestedFix) {
        alerts.push(`💡 推奨: ${_errorPattern.suggestedFix}`);
      }
    }

    // パラメータの検証
    const _successPattern = this.model.successPatterns.find(
      (sp) => sp._command === _command && sp.successRate > 0.9,
    );

    if (_successPattern && _successPattern.optimalParams) {
      const _optimalKeys = Object.keys(_successPattern.optimalParams);
      const _currentKeys = Object.keys(params);
      const _missingKeys = _optimalKeys.filter(
        (k) => !_currentKeys.includes(k),
      );

      if (_missingKeys.length > 0) {
        alerts.push(
          `💡 最適なパラメータ: ${_missingKeys.join(", ")}を追加することを検討してください`,
        );
      }
    }

    return alerts;
  }

  /**
   * 最適化提案
   */
  //  - Machine learning engine with complex dynamic _data structures
  getOptimizationSuggestions(): string[] {
    const suggestions: string[] = [];

    // 実行時間の長いコマンドを検出
    const _slowCommands = this.model.successPatterns
      .filter((sp) => sp.averageTime > 10000) // 10秒以上
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, 3);

    slowCommands.forEach((cmd) => {
      suggestions.push(
        `🐌 "${cmd.command}"の実行時間が長いです(平均${(cmd.averageTime / 1000).toFixed(1)}秒)`,
      );
      if (cmd.optimalParams) {
        suggestions.push(
          `   最適なパラメータ: ${JSON.stringify(cmd.optimalParams)}`,
        );
      }
    });

    // 失敗率の高いコマンド
    const _failureRates = new Map<string, number>();
    this.model.patterns.forEach((p) => {
      const _current = _failureRates.get(p.command) || {
        success: 0,
        _total: 0,
      };
      current.total++;
      if (p.success) {
        _current.success++;
      }
      failureRates.set(p.command, _current);
    });

    Array.from(_failureRates.entries())
      .map(([cmd, stats]) => ({
        cmd,
        failureRate: 1 - stats.success / stats.total,
      }))
      .filter(
        (_item) =>
          _item.failureRate > 0.3 && _failureRates.get(_item.cmd).total > 5,
      )
      .forEach((_item) => {
        suggestions.push(
          `❌ "${_item.cmd}"の失敗率が高いです(${(_item.failureRate * 100).toFixed(0)}%)`,
        );
      });

    return suggestions;
  }

  /**
   * エラー修正の提案
   */
  //  - Machine learning engine with complex dynamic _data structures
  private suggestErrorFix(_command: string, errorType: string): string {
    const fixes: Record<string, Record<string, string>> = {
      "/test": {
        timeout: "タイムアウト値を増やすか、テストを分割してください",
        notfound: "テストファイルのパスを確認してください",
        syntax: "テストコードの構文を確認してください",
      },
      "/deploy": {
        auth: "認証情報を確認してください",
        buildfailed: "ビルドエラーを修正してからデプロイしてください",
        network: "ネットワーク接続を確認してください",
      },
      "/code": {
        syntax: "コードの構文エラーを確認してください",
        type: "TypeScriptの型エラーを修正してください",
        import: "インポートパスを確認してください",
      },
    };

    return fixes[_command]?.[errorType] || "エラーの詳細を確認してください";
  }

  /**
   * フレームワークを検出
   */
  //  - Machine learning engine with complex dynamic _data structures
  private detectFrameworks(_fileTypes: string[]) {
    const frameworkIndicators: Record<string, string[]> = {
      react: [".tsx", ".jsx", "react"],
      vue: [".vue", "vue"],
      angular: [".component.ts", "angular"],
      nextjs: ["next.config", "_app"],
      express: ["app.js", "server.js", "express"],
      django: [".py", "manage.py", "django"],
      rails: [".rb", "Gemfile", "rails"],
    };

    Object.entries(frameworkIndicators).forEach(([framework, indicators]) => {
      if (indicators.some((ind) => _fileTypes.some((ft) => ft.includes(ind)))) {
        if (!this.model.preferences.frameworks.includes(framework)) {
          this.model.preferences.frameworks.push(framework);
        }
      }
    });
  }

  /**
   * トップコマンドを取得
   */
  //  - Machine learning engine with complex dynamic _data structures
  private getTopCommands(limit: number): string[] {
    const _commandCounts = new Map<string, number>();

    this.model.patterns.forEach((p) => {
      _commandCounts.set(p.command, (_commandCounts.get(p.command) || 0) + 1);
    });

    return Array.from(_commandCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([cmd]) => cmd);
  }

  /**
   * パターンを分析
   */
  //  - Machine learning engine with complex dynamic _data structures
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
  //  - Machine learning engine with complex dynamic _data structures
  private updatePredictions() {
    // 機械学習的なアプローチで予測精度を向上
    // ここでは簡易的な実装
    const predictions: CommandPrediction[] = [];

    // 頻度ベースの予測
    const _commandFreq = new Map<string, number>();
    this.model.patterns.forEach((p) => {
      _commandFreq.set(p.command, (_commandFreq.get(p.command) || 0) + 1);
    });

    const _total = this.model.patterns.length;
    commandFreq.forEach((count, command) => {
      predictions.push({
        command,
        probability: count / _total,
        context: "frequency",
      });
    });

    this.model.predictions = predictions;
  }

  /**
   * 古いデータをクリーンアップ
   */
  //  - Machine learning engine with complex dynamic _data structures
  private cleanupOldData() {
    const _thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    // 30日以上前のパターンを削除
    this.model.patterns = this.model.patterns.filter(
      (p) => p.timestamp.getTime() > _thirtyDaysAgo,
    );

    // エラーパターンの頻度をリセット
    this.model.errorPatterns.forEach((ep) => {
      if (ep.lastOccurred.getTime() < _thirtyDaysAgo) {
        ep.frequency = Math.floor(ep.frequency / 2);
      }
    });

    // 使われていないエラーパターンを削除
    this.model.errorPatterns = this.model.errorPatterns.filter(
      (ep) => ep.frequency > 0,
    );
  }

  /**
   * モデルを読み込み
   */
  //  - Machine learning engine with complex dynamic _data structures
  private loadModel(): LearningModel {
    try {
      if (existsSync(this.modelFile)) {
        const _data = readFileSync(this.modelFile, "utf-8");
        const _model = JSON.parse(_data) as Record<string, unknown>;

        // 日付を復元
        model.patterns.forEach((_p: unknown) => {
          _p.timestamp = new Date(_p.timestamp);
        });
        model.errorPatterns.forEach((_ep: unknown) => {
          _ep.lastOccurred = new Date(_ep.lastOccurred);
        });

        // Mapを復元
        _model.preferences.shortcuts = new Map(_model.preferences.shortcuts);

        return _model;
      }
    } catch (_error: unknown) {
      logger.error("Failed to load learning _model:", _error);
    }

    return this.createNewModel();
  }

  /**
   * 新しいモデルを作成
   */
  //  - Machine learning engine with complex dynamic _data structures
  private createNewModel(): LearningModel {
    return {
      _patterns: [],
      preferences: {
        favoriteCommands: [],
        codeStyle: {
          indentation: "spaces",
          indentSize: 2,
          semicolons: true,
          quotes: "single",
          trailingComma: true,
        },
        language: "ja",
        frameworks: [],
        libraries: [],
        commitStyle: "conventional",
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
  //  - Machine learning engine with complex dynamic _data structures
  private saveModel() {
    try {
      const _modelToSave = {
        ...this.model,
        preferences: {
          ...this.model.preferences,
          shortcuts: Array.from(this.model.preferences.shortcuts.entries()),
        },
      };

      writeFileSync(this.modelFile, JSON.stringify(_modelToSave, null, 2));
    } catch (_error: unknown) {
      logger.error("Failed to save learning _model:", _error);
    }
  }

  /**
   * 自動保存を開始
   */
  //  - Machine learning engine with complex dynamic _data structures
  private startAutoSave() {
    this.saveInterval = setInterval(() => {
      this.saveModel();
    }, 30000); // 30秒ごと
  }

  /**
   * IDを生成
   */
  //  - Machine learning engine with complex dynamic _data structures
  private generateId(): string {
    return `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 学習エンジンを停止
   */
  //  - Machine learning engine with complex dynamic _data structures
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
  //  - Machine learning engine with complex dynamic _data structures
  getStatistics() {
    const _totalPatterns = this.model.patterns.length;
    const _successRate =
      this.model.patterns.filter((p) => p.success).length / _totalPatterns;
    const _avgExecutionTime =
      this.model.patterns.reduce((sum, p) => sum + p.executionTime, 0) /
      _totalPatterns;

    return {
      _totalPatterns,
      _successRate,
      averageExecutionTime: _avgExecutionTime,
      favoriteCommands: this.model.preferences.favoriteCommands,
      errorPatterns: this.model.errorPatterns.length,
      successPatterns: this.model.successPatterns.length,
      timePatterns: this.model.timePatterns.length,
      predictions: this.model.predictions.length,
    };
  }
}
