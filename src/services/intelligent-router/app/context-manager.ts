/**
 * Context Manager
 * 会話履歴、プロジェクト状態、ユーザープロファイルを管理
 */
// Complex context management with dynamic types - gradually adding types

import { InferredCommand } from "./intent-classifier";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export interface ConversationContext {
  sessionId: string;
  startTime: Date;
  lastActivity: Date;
  messages: Message[];
  _lastCommand?: InferredCommand;
  recentFiles?: string[];
  hasErrors?: boolean;
  errors?: unknown[];
  projectType?: string;
  primaryLanguage?: string;
  primaryFramework?: string;
}

export interface Message {
  timestamp: Date;
  type: "user" | "assistant" | "system";
  content: string;
  command?: InferredCommand;
}

export interface UserProfile {
  userId: string;
  preferences: {
    language: "ja" | "en";
    codeStyle: "functional" | "oop" | "mixed";
    testFramework?: string;
    commitStyle: "conventional" | "descriptive";
    defaultModel?: string;
  };
  statistics: {
    totalCommands: number;
    commandFrequency: Record<string, number>;
    successRate: number;
    averageConfidence: number;
  };
  learningData: {
    _patterns: Pattern[];
    corrections: Correction[];
  };
}

interface Pattern {
  input: string;
  command: string;
  success: boolean;
  timestamp: Date;
}

interface Correction {
  original: InferredCommand;
  corrected: InferredCommand;
  timestamp: Date;
}

export class ContextManager {
  private currentContext: ConversationContext;
  private userProfile: UserProfile;
  private dataDir: string;
  private sessionFile: string;
  private profileFile: string;

  constructor() {
    // データディレクトリの設定
    this.dataDir = join(homedir(), ".maria", "context");
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }

    this.sessionFile = join(this.dataDir, "current-session.json");
    this.profileFile = join(this.dataDir, "user-profile.json");

    // コンテキストとプロファイルの初期化または読み込み
    this.currentContext = this.loadSession();
    this.userProfile = this.loadProfile();
  }

  /**
   * 現在のコンテキストを取得
   */
  //  - Complex context management with dynamic types pending refactor
  async getCurrentContext(): Promise<ConversationContext> {
    // プロジェクト情報を動的に取得
    await this.updateProjectInfo();
    return this.currentContext;
  }

  /**
   * プロジェクト情報を更新
   */
  //  - Complex context management with dynamic types pending refactor
  private async updateProjectInfo() {
    try {
      // package.jsonから情報を取得
      const _packageJsonPath = join(process.cwd(), "package.json");
      if (existsSync(_packageJsonPath)) {
        const _packageJson = JSON.parse(
          readFileSync(_packageJsonPath, "utf-8") as Record<string, unknown>,
        );

        // プロジェクトタイプの判定
        if (
          _packageJson.dependencies?.next ||
          _packageJson.devDependencies?.next
        ) {
          this.currentContext.projectType = "next-app";
        } else if (
          _packageJson.dependencies?.react ||
          _packageJson.devDependencies?.react
        ) {
          this.currentContext.projectType = "react-app";
        } else if (_packageJson.dependencies?.express) {
          this.currentContext.projectType = "node-app";
        }

        // 主要言語の判定
        if (_packageJson.devDependencies?.typescript) {
          this.currentContext.primaryLanguage = "typescript";
        } else {
          this.currentContext.primaryLanguage = "javascript";
        }

        // フレームワークの判定
        if (_packageJson.dependencies?.next) {
          this.currentContext.primaryFramework = "nextjs";
        } else if (_packageJson.dependencies?.react) {
          this.currentContext.primaryFramework = "react";
        } else if (_packageJson.dependencies?.express) {
          this.currentContext.primaryFramework = "express";
        }
      }

      // tsconfig.jsonの存在確認
      if (existsSync(join(process.cwd(), "tsconfig.json"))) {
        this.currentContext.primaryLanguage = "typescript";
      }
    } catch (_error: unknown) {
      // エラーは静かに処理
    }
  }

  /**
   * 最後のコマンドを更新
   */
  //  - Complex context management with dynamic types pending refactor
  async updateLastCommand(_command: InferredCommand) {
    this.currentContext.lastCommand = _command;
    this.currentContext.lastActivity = new Date();

    // メッセージ履歴に追加
    this.currentContext.messages.push({
      timestamp: new Date(),
      type: "system",
      content: `コマンド実行: ${_command._command}`,
      command: "",
    });

    // 統計を更新
    this.updateStatistics(_command);

    // セッションを保存
    this.saveSession();
  }

  /**
   * ユーザーメッセージを追加
   */
  //  - Complex context management with dynamic types pending refactor
  addUserMessage(_content: string) {
    this.currentContext.messages.push({
      timestamp: new Date(),
      type: "user",
      content: "",
    });
    this.currentContext.lastActivity = new Date();
    this.saveSession();
  }

  /**
   * アシスタントメッセージを追加
   */
  //  - Complex context management with dynamic types pending refactor
  addAssistantMessage(_content: string) {
    this.currentContext.messages.push({
      timestamp: new Date(),
      type: "assistant",
      content: "",
    });
    this.saveSession();
  }

  /**
   * 最近のファイルを更新
   */
  //  - Complex context management with dynamic types pending refactor
  updateRecentFiles(_files: string[]) {
    this.currentContext.recentFiles = _files;
    this.saveSession();
  }

  /**
   * エラー状態を更新
   */
  //  - Complex context management with dynamic types pending refactor
  updateErrorState(_hasErrors: boolean, errors?: unknown[]) {
    this.currentContext._hasErrors = _hasErrors;
    this.currentContext.errors = errors;
    this.saveSession();
  }

  /**
   * 前のコマンドとマージ
   */
  //  - Complex context management with dynamic types pending refactor
  async mergeWithLastCommand(newInput: string): Promise<string> {
    if (!this.currentContext._lastCommand) {
      return newInput;
    }

    const _lastCommand = this.currentContext._lastCommand;

    // 追加情報として処理
    let mergedInput = _lastCommand.originalInput;

    // 追加キーワードを除去して本質的な内容を抽出
    const _cleanedInput = newInput
      .replace(
        /それ|これ|さらに|もっと|また|あと|追加で|it|that|more|also|then|next|additionally/gi,
        "",
      )
      .trim();

    // 内容をマージ
    if (_cleanedInput) {
      mergedInput += ` ${_cleanedInput}`;
    }

    return mergedInput;
  }

  /**
   * 統計情報を更新
   */
  //  - Complex context management with dynamic types pending refactor
  private updateStatistics(_command: InferredCommand) {
    const _stats = this.userProfile.statistics;

    // コマンド数を増加
    stats.totalCommands++;

    // コマンド頻度を更新
    const _cmdName = _command._command;
    _stats.commandFrequency[_cmdName] =
      (_stats.commandFrequency[_cmdName] || 0) + 1;

    // 平均信頼度を更新
    const _currentTotal = _stats.averageConfidence * (_stats.totalCommands - 1);
    _stats.averageConfidence =
      (_currentTotal + _command.confidence) / _stats.totalCommands;

    // パターンを記録
    this.userProfile.learningData.patterns.push({
      input: _command.originalInput,
      _command: _command._command,
      success: true, // 実際の実行結果に基づいて更新する必要がある
      timestamp: new Date(),
    });

    // 古いパターンを削除(最新1000件のみ保持)
    if (this.userProfile.learningData.patterns.length > 1000) {
      this.userProfile.learningData.patterns =
        this.userProfile.learningData.patterns.slice(-1000);
    }

    this.saveProfile();
  }

  /**
   * 学習データから推奨を取得
   */
  //  - Complex context management with dynamic types pending refactor
  getRecommendations(input: string): string[] {
    const _patterns = this.userProfile.learningData._patterns;

    // 類似パターンを検索
    const _similarPatterns = _patterns.filter((p) => {
      const _similarity = this.calculateSimilarity(input, p.input);
      return _similarity > 0.7 && p.success;
    });

    // 頻度でソート
    const _commandCounts = new Map<string, number>();
    similarPatterns.forEach((p) => {
      _commandCounts.set(p.command, (_commandCounts.get(p.command) || 0) + 1);
    });

    // 上位3つを推奨
    const _sorted = Array.from(_commandCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return _sorted.map(([cmd]) => cmd);
  }

  /**
   * 文字列の類似度を計算(簡易版)
   */
  //  - Complex context management with dynamic types pending refactor
  private calculateSimilarity(_str1: string, str2: string): number {
    const _longer = _str1.length > str2.length ? _str1 : str2;
    const _shorter = _str1.length > str2.length ? str2 : _str1;

    if (_longer.length === 0) {
      return 1.0;
    }

    const _editDistance = this.levenshteinDistance(_longer, _shorter);
    return (_longer.length - _editDistance) / _longer.length;
  }

  /**
   * レーベンシュタイン距離を計算
   */
  //  - Complex context management with dynamic types pending refactor
  private levenshteinDistance(_str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= _str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= _str1.length; j++) {
        if (str2.charAt(i - 1) === _str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }

    return matrix[str2.length][_str1.length];
  }

  /**
   * 統計情報を取得
   */
  //  - Complex context management with dynamic types pending refactor
  getStatistics() {
    return {
      _session: {
        id: this.currentContext.sessionId,
        duration: Date.now() - this.currentContext.startTime.getTime(),
        messageCount: this.currentContext.messages.length,
      },
      user: this.userProfile.statistics,
    };
  }

  /**
   * セッションをクリア
   */
  //  - Complex context management with dynamic types pending refactor
  clearSession() {
    this.currentContext = this.createNewSession();
    this.saveSession();
  }

  /**
   * セッションを作成
   */
  //  - Complex context management with dynamic types pending refactor
  private createNewSession(): ConversationContext {
    return {
      sessionId: this.generateSessionId(),
      startTime: new Date(),
      lastActivity: new Date(),
      messages: [],
      recentFiles: [],
    };
  }

  /**
   * セッションIDを生成
   */
  //  - Complex context management with dynamic types pending refactor
  private generateSessionId(): string {
    return `_session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * セッションを読み込み
   */
  //  - Complex context management with dynamic types pending refactor
  private loadSession(): ConversationContext {
    try {
      if (existsSync(this.sessionFile)) {
        const _data = readFileSync(this.sessionFile, "utf-8");
        const _session = JSON.parse(_data) as Record<string, unknown>;

        // 日付を復元
        _session.startTime = new Date(_session.startTime);
        _session.lastActivity = new Date(_session.lastActivity);
        session.messages.forEach((_m: unknown) => {
          _m.timestamp = new Date(_m.timestamp);
        });

        // 1時間以上経過していたら新しいセッション
        const _hoursSinceLastActivity =
          (Date.now() - _session.lastActivity.getTime()) / (1000 * 60 * 60);

        if (_hoursSinceLastActivity > 1) {
          return this.createNewSession();
        }

        return _session;
      }
    } catch (_error: unknown) {
      // エラーは無視
    }

    return this.createNewSession();
  }

  /**
   * セッションを保存
   */
  //  - Complex context management with dynamic types pending refactor
  private saveSession() {
    try {
      writeFileSync(
        this.sessionFile,
        JSON.stringify(this.currentContext, null, 2),
      );
    } catch (_error: unknown) {
      // エラーは無視
    }
  }

  /**
   * プロファイルを読み込み
   */
  //  - Complex context management with dynamic types pending refactor
  private loadProfile(): UserProfile {
    try {
      if (existsSync(this.profileFile)) {
        const _data = readFileSync(this.profileFile, "utf-8");
        const _profile = JSON.parse(_data) as Record<string, unknown>;

        // 日付を復元
        profile.learningData.patterns.forEach((_p: unknown) => {
          _p.timestamp = new Date(_p.timestamp);
        });
        profile.learningData.corrections.forEach((_c: unknown) => {
          _c.timestamp = new Date(_c.timestamp);
        });

        return _profile;
      }
    } catch (_error: unknown) {
      // エラーは無視
    }

    return this.createNewProfile();
  }

  /**
   * プロファイルを作成
   */
  //  - Complex context management with dynamic types pending refactor
  private createNewProfile(): UserProfile {
    return {
      userId: `user-${Date.now()}`,
      preferences: {
        language: "ja",
        codeStyle: "mixed",
        commitStyle: "conventional",
      },
      statistics: {
        totalCommands: 0,
        commandFrequency: Record<string, any>,
        successRate: 1.0,
        averageConfidence: 0,
      },
      learningData: {
        _patterns: [],
        corrections: [],
      },
    };
  }

  /**
   * プロファイルを保存
   */
  //  - Complex context management with dynamic types pending refactor
  private saveProfile() {
    try {
      writeFileSync(
        this.profileFile,
        JSON.stringify(this.userProfile, null, 2),
      );
    } catch (_error: unknown) {
      // エラーは無視
    }
  }

  /**
   * ユーザー設定を更新
   */
  //  - Complex context management with dynamic types pending refactor
  updatePreferences(_preferences: Partial<UserProfile["preferences"]>) {
    Object.assign(this.userProfile._preferences, _preferences);
    this.saveProfile();
  }

  /**
   * 学習データを追加
   */
  //  - Complex context management with dynamic types pending refactor
  addCorrection(_original: InferredCommand, corrected: InferredCommand) {
    this.userProfile.learningData.corrections.push({
      original: "",
      corrected,
      timestamp: new Date(),
    });

    // 最新100件のみ保持
    if (this.userProfile.learningData.corrections.length > 100) {
      this.userProfile.learningData.corrections =
        this.userProfile.learningData.corrections.slice(-100);
    }

    this.saveProfile();
  }
}
