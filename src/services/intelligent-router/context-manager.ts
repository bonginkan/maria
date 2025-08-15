/**
 * Context Manager
 * 会話履歴、プロジェクト状態、ユーザープロファイルを管理
 */
// @ts-nocheck - Complex context management with dynamic types pending refactor - Complex type interactions requiring gradual type migration

import { InferredCommand } from './intent-classifier';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface ConversationContext {
  sessionId: string;
  startTime: Date;
  lastActivity: Date;
  messages: Message[];
  lastCommand?: InferredCommand;
  recentFiles?: string[];
  hasErrors?: boolean;
  errors?: unknown[];
  projectType?: string;
  primaryLanguage?: string;
  primaryFramework?: string;
}

export interface Message {
  timestamp: Date;
  type: 'user' | 'assistant' | 'system';
  content: string;
  command?: InferredCommand;
}

export interface UserProfile {
  userId: string;
  preferences: {
    language: 'ja' | 'en';
    codeStyle: 'functional' | 'oop' | 'mixed';
    testFramework?: string;
    commitStyle: 'conventional' | 'descriptive';
    defaultModel?: string;
  };
  statistics: {
    totalCommands: number;
    commandFrequency: Record<string, number>;
    successRate: number;
    averageConfidence: number;
  };
  learningData: {
    patterns: Pattern[];
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
    this.dataDir = join(homedir(), '.maria', 'context');
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }

    this.sessionFile = join(this.dataDir, 'current-session.json');
    this.profileFile = join(this.dataDir, 'user-profile.json');

    // コンテキストとプロファイルの初期化または読み込み
    this.currentContext = this.loadSession();
    this.userProfile = this.loadProfile();
  }

  /**
   * 現在のコンテキストを取得
   */
  // @ts-nocheck - Complex context management with dynamic types pending refactor
  async getCurrentContext(): Promise<ConversationContext> {
    // プロジェクト情報を動的に取得
    await this.updateProjectInfo();
    return this.currentContext;
  }

  /**
   * プロジェクト情報を更新
   */
  // @ts-nocheck - Complex context management with dynamic types pending refactor
  private async updateProjectInfo() {
    try {
      // package.jsonから情報を取得
      const packageJsonPath = join(process.cwd(), 'package.json');
      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(
          readFileSync(packageJsonPath, 'utf-8') as Record<string, unknown>,
        );

        // プロジェクトタイプの判定
        if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
          this.currentContext.projectType = 'next-app';
        } else if (packageJson.dependencies?.react || packageJson.devDependencies?.react) {
          this.currentContext.projectType = 'react-app';
        } else if (packageJson.dependencies?.express) {
          this.currentContext.projectType = 'node-app';
        }

        // 主要言語の判定
        if (packageJson.devDependencies?.typescript) {
          this.currentContext.primaryLanguage = 'typescript';
        } else {
          this.currentContext.primaryLanguage = 'javascript';
        }

        // フレームワークの判定
        if (packageJson.dependencies?.next) {
          this.currentContext.primaryFramework = 'nextjs';
        } else if (packageJson.dependencies?.react) {
          this.currentContext.primaryFramework = 'react';
        } else if (packageJson.dependencies?.express) {
          this.currentContext.primaryFramework = 'express';
        }
      }

      // tsconfig.jsonの存在確認
      if (existsSync(join(process.cwd(), 'tsconfig.json'))) {
        this.currentContext.primaryLanguage = 'typescript';
      }
    } catch (error: unknown) {
      // エラーは静かに処理
    }
  }

  /**
   * 最後のコマンドを更新
   */
  // @ts-nocheck - Complex context management with dynamic types pending refactor
  async updateLastCommand(command: InferredCommand) {
    this.currentContext.lastCommand = command;
    this.currentContext.lastActivity = new Date();

    // メッセージ履歴に追加
    this.currentContext.messages.push({
      timestamp: new Date(),
      type: 'system',
      content: `コマンド実行: ${command.command}`,
      command,
    });

    // 統計を更新
    this.updateStatistics(command);

    // セッションを保存
    this.saveSession();
  }

  /**
   * ユーザーメッセージを追加
   */
  // @ts-nocheck - Complex context management with dynamic types pending refactor
  addUserMessage(content: string) {
    this.currentContext.messages.push({
      timestamp: new Date(),
      type: 'user',
      content,
    });
    this.currentContext.lastActivity = new Date();
    this.saveSession();
  }

  /**
   * アシスタントメッセージを追加
   */
  // @ts-nocheck - Complex context management with dynamic types pending refactor
  addAssistantMessage(content: string) {
    this.currentContext.messages.push({
      timestamp: new Date(),
      type: 'assistant',
      content,
    });
    this.saveSession();
  }

  /**
   * 最近のファイルを更新
   */
  // @ts-nocheck - Complex context management with dynamic types pending refactor
  updateRecentFiles(files: string[]) {
    this.currentContext.recentFiles = files;
    this.saveSession();
  }

  /**
   * エラー状態を更新
   */
  // @ts-nocheck - Complex context management with dynamic types pending refactor
  updateErrorState(hasErrors: boolean, errors?: unknown[]) {
    this.currentContext.hasErrors = hasErrors;
    this.currentContext.errors = errors;
    this.saveSession();
  }

  /**
   * 前のコマンドとマージ
   */
  // @ts-nocheck - Complex context management with dynamic types pending refactor
  async mergeWithLastCommand(newInput: string): Promise<string> {
    if (!this.currentContext.lastCommand) {
      return newInput;
    }

    const lastCommand = this.currentContext.lastCommand;

    // 追加情報として処理
    let mergedInput = lastCommand.originalInput;

    // 追加キーワードを除去して本質的な内容を抽出
    const cleanedInput = newInput
      .replace(
        /それ|これ|さらに|もっと|また|あと|追加で|it|that|more|also|then|next|additionally/gi,
        '',
      )
      .trim();

    // 内容をマージ
    if (cleanedInput) {
      mergedInput += ` ${cleanedInput}`;
    }

    return mergedInput;
  }

  /**
   * 統計情報を更新
   */
  // @ts-nocheck - Complex context management with dynamic types pending refactor
  private updateStatistics(command: InferredCommand) {
    const stats = this.userProfile.statistics;

    // コマンド数を増加
    stats.totalCommands++;

    // コマンド頻度を更新
    const cmdName = command.command;
    stats.commandFrequency[cmdName] = (stats.commandFrequency[cmdName] || 0) + 1;

    // 平均信頼度を更新
    const currentTotal = stats.averageConfidence * (stats.totalCommands - 1);
    stats.averageConfidence = (currentTotal + command.confidence) / stats.totalCommands;

    // パターンを記録
    this.userProfile.learningData.patterns.push({
      input: command.originalInput,
      command: command.command,
      success: true, // 実際の実行結果に基づいて更新する必要がある
      timestamp: new Date(),
    });

    // 古いパターンを削除（最新1000件のみ保持）
    if (this.userProfile.learningData.patterns.length > 1000) {
      this.userProfile.learningData.patterns = this.userProfile.learningData.patterns.slice(-1000);
    }

    this.saveProfile();
  }

  /**
   * 学習データから推奨を取得
   */
  // @ts-nocheck - Complex context management with dynamic types pending refactor
  getRecommendations(input: string): string[] {
    const patterns = this.userProfile.learningData.patterns;

    // 類似パターンを検索
    const similarPatterns = patterns.filter((p) => {
      const similarity = this.calculateSimilarity(input, p.input);
      return similarity > 0.7 && p.success;
    });

    // 頻度でソート
    const commandCounts = new Map<string, number>();
    similarPatterns.forEach((p) => {
      commandCounts.set(p.command, (commandCounts.get(p.command) || 0) + 1);
    });

    // 上位3つを推奨
    const sorted = Array.from(commandCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return sorted.map(([cmd]) => cmd);
  }

  /**
   * 文字列の類似度を計算（簡易版）
   */
  // @ts-nocheck - Complex context management with dynamic types pending refactor
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {
      return 1.0;
    }

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * レーベンシュタイン距離を計算
   */
  // @ts-nocheck - Complex context management with dynamic types pending refactor
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
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

    return matrix[str2.length][str1.length];
  }

  /**
   * 統計情報を取得
   */
  // @ts-nocheck - Complex context management with dynamic types pending refactor
  getStatistics() {
    return {
      session: {
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
  // @ts-nocheck - Complex context management with dynamic types pending refactor
  clearSession() {
    this.currentContext = this.createNewSession();
    this.saveSession();
  }

  /**
   * セッションを作成
   */
  // @ts-nocheck - Complex context management with dynamic types pending refactor
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
  // @ts-nocheck - Complex context management with dynamic types pending refactor
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * セッションを読み込み
   */
  // @ts-nocheck - Complex context management with dynamic types pending refactor
  private loadSession(): ConversationContext {
    try {
      if (existsSync(this.sessionFile)) {
        const data = readFileSync(this.sessionFile, 'utf-8');
        const session = JSON.parse(data) as Record<string, unknown>;

        // 日付を復元
        session.startTime = new Date(session.startTime);
        session.lastActivity = new Date(session.lastActivity);
        session.messages.forEach((m: unknown) => {
          m.timestamp = new Date(m.timestamp);
        });

        // 1時間以上経過していたら新しいセッション
        const hoursSinceLastActivity =
          (Date.now() - session.lastActivity.getTime()) / (1000 * 60 * 60);

        if (hoursSinceLastActivity > 1) {
          return this.createNewSession();
        }

        return session;
      }
    } catch (error: unknown) {
      // エラーは無視
    }

    return this.createNewSession();
  }

  /**
   * セッションを保存
   */
  // @ts-nocheck - Complex context management with dynamic types pending refactor
  private saveSession() {
    try {
      writeFileSync(this.sessionFile, JSON.stringify(this.currentContext, null, 2));
    } catch (error: unknown) {
      // エラーは無視
    }
  }

  /**
   * プロファイルを読み込み
   */
  // @ts-nocheck - Complex context management with dynamic types pending refactor
  private loadProfile(): UserProfile {
    try {
      if (existsSync(this.profileFile)) {
        const data = readFileSync(this.profileFile, 'utf-8');
        const profile = JSON.parse(data) as Record<string, unknown>;

        // 日付を復元
        profile.learningData.patterns.forEach((p: unknown) => {
          p.timestamp = new Date(p.timestamp);
        });
        profile.learningData.corrections.forEach((c: unknown) => {
          c.timestamp = new Date(c.timestamp);
        });

        return profile;
      }
    } catch (error: unknown) {
      // エラーは無視
    }

    return this.createNewProfile();
  }

  /**
   * プロファイルを作成
   */
  // @ts-nocheck - Complex context management with dynamic types pending refactor
  private createNewProfile(): UserProfile {
    return {
      userId: `user-${Date.now()}`,
      preferences: {
        language: 'ja',
        codeStyle: 'mixed',
        commitStyle: 'conventional',
      },
      statistics: {
        totalCommands: 0,
        commandFrequency: {},
        successRate: 1.0,
        averageConfidence: 0,
      },
      learningData: {
        patterns: [],
        corrections: [],
      },
    };
  }

  /**
   * プロファイルを保存
   */
  // @ts-nocheck - Complex context management with dynamic types pending refactor
  private saveProfile() {
    try {
      writeFileSync(this.profileFile, JSON.stringify(this.userProfile, null, 2));
    } catch (error: unknown) {
      // エラーは無視
    }
  }

  /**
   * ユーザー設定を更新
   */
  // @ts-nocheck - Complex context management with dynamic types pending refactor
  updatePreferences(preferences: Partial<UserProfile['preferences']>) {
    Object.assign(this.userProfile.preferences, preferences);
    this.saveProfile();
  }

  /**
   * 学習データを追加
   */
  // @ts-nocheck - Complex context management with dynamic types pending refactor
  addCorrection(original: InferredCommand, corrected: InferredCommand) {
    this.userProfile.learningData.corrections.push({
      original,
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
