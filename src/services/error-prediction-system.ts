/**
 * Error Prediction & Real-time Warning System
 * エラー予測とリアルタイム警告システム
 */

import { getStatusIcon, getMessageColor } from '../utils/color-theme';

export interface ErrorPattern {
  id: string;
  pattern: RegExp | string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'syntax' | 'security' | 'performance' | 'compatibility' | 'logic';
  description: string;
  suggestion: string;
  preventable: boolean;
  commonCauses: string[];
}

export interface RiskAssessment {
  level: 'safe' | 'caution' | 'warning' | 'danger' | 'critical';
  confidence: number; // 0-1
  factors: RiskFactor[];
  overallScore: number; // 0-100
}

export interface RiskFactor {
  type: string;
  description: string;
  impact: number; // 0-10
  likelihood: number; // 0-1
}

export interface WarningAlert {
  id: string;
  type: 'prevention' | 'warning' | 'critical' | 'suggestion';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  icon: string;
  color: string;
  timestamp: Date;
  dismissible: boolean;
  actionable?: {
    text: string;
    action: () => void;
  };
  autoFix?: {
    available: boolean;
    description: string;
    fix: () => string;
  };
}

export interface PredictionContext {
  command: string;
  parameters: string[];
  workingDirectory: string;
  recentErrors: ErrorHistory[];
  systemState: SystemState;
  userProfile: UserProfile;
}

export interface ErrorHistory {
  command: string;
  error: string;
  timestamp: Date;
  context: string;
  resolved: boolean;
  resolution?: string;
}

export interface SystemState {
  memoryUsage: number;
  cpuUsage: number;
  diskSpace: number;
  networkStatus: 'online' | 'offline' | 'slow';
  activeProcesses: number;
}

export interface UserProfile {
  experienceLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  commonMistakes: string[];
  preferredStyle: string;
  workingHours: { start: number; end: number };
}

export class ErrorPredictionSystem {
  private patterns: Map<string, ErrorPattern[]> = new Map();
  private errorHistory: ErrorHistory[] = [];
  private activeWarnings: Map<string, WarningAlert> = new Map();
  private riskFactors: Map<string, number> = new Map();

  constructor() {
    this.initializeErrorPatterns();
    this.initializeRiskFactors();
  }

  /**
   * リアルタイムエラー予測の主要メソッド
   */
  predictErrors(context: PredictionContext): WarningAlert[] {
    const warnings: WarningAlert[] = [];

    // 1. 構文エラー予測
    warnings.push(...this.predictSyntaxErrors(context));

    // 2. セキュリティリスク検出
    warnings.push(...this.detectSecurityRisks(context));

    // 3. パフォーマンス問題予測
    warnings.push(...this.predictPerformanceIssues(context));

    // 4. 互換性問題チェック
    warnings.push(...this.checkCompatibilityIssues(context));

    // 5. ロジックエラー予測
    warnings.push(...this.predictLogicErrors(context));

    // 6. システムリソース警告
    warnings.push(...this.checkSystemResources(context));

    // 7. 履歴ベースのエラー予測
    warnings.push(...this.predictHistoricalErrors(context));

    return warnings.sort(
      (a, b) => this.getSeverityWeight(b.severity) - this.getSeverityWeight(a.severity),
    );
  }

  /**
   * 構文エラー予測
   */
  private predictSyntaxErrors(context: PredictionContext): WarningAlert[] {
    const warnings: WarningAlert[] = [];
    const { command, parameters } = context;

    // 不完全なクォート
    const commandStr = `${command} ${parameters.join(' ')}`;
    const quotes = (commandStr.match(/["']/g) || []).length;
    if (quotes % 2 !== 0) {
      warnings.push({
        id: 'unclosed-quotes',
        type: 'warning',
        title: 'Unclosed Quote Detected',
        message: 'Command contains unclosed quotes which may cause syntax errors',
        severity: 'warning',
        icon: getStatusIcon('warning'),
        color: getMessageColor('warning'),
        timestamp: new Date(),
        dismissible: true,
        autoFix: {
          available: true,
          description: 'Add closing quote',
          fix: () => this.fixUnclosedQuotes(commandStr),
        },
      });
    }

    // 不正な特殊文字
    if (/[<>|&;`$(){}[\]\\]/.test(commandStr) && !command.startsWith('/')) {
      warnings.push({
        id: 'special-chars',
        type: 'warning',
        title: 'Special Characters Detected',
        message: 'Command contains special characters that may need escaping',
        severity: 'warning',
        icon: getStatusIcon('warning'),
        color: getMessageColor('warning'),
        timestamp: new Date(),
        dismissible: true,
      });
    }

    return warnings;
  }

  /**
   * セキュリティリスク検出
   */
  private detectSecurityRisks(context: PredictionContext): WarningAlert[] {
    const warnings: WarningAlert[] = [];
    const commandStr = `${context.command} ${context.parameters.join(' ')}`;

    // APIキー・シークレット検出
    if (/sk-[a-zA-Z0-9]{48}|API[_-]?KEY|SECRET[_-]?KEY|TOKEN/i.test(commandStr)) {
      warnings.push({
        id: 'credentials-exposure',
        type: 'critical',
        title: 'Credentials Detected!',
        message: 'Command contains potential API keys or secrets. Never expose credentials!',
        severity: 'critical',
        icon: getStatusIcon('error'),
        color: getMessageColor('error'),
        timestamp: new Date(),
        dismissible: false,
        actionable: {
          text: 'Learn about environment variables',
          action: () => console.log('Opening security guide...'),
        },
      });
    }

    // 危険なコマンド検出
    const dangerousPatterns = [
      /rm\s+-rf?\s+\//,
      /sudo\s+rm/,
      /\.\.\/.*\/\.\./,
      /exec\s*\(/,
      /eval\s*\(/,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(commandStr)) {
        warnings.push({
          id: 'dangerous-command',
          type: 'critical',
          title: 'Dangerous Command Detected!',
          message: 'This command may cause irreversible damage to your system',
          severity: 'critical',
          icon: getStatusIcon('error'),
          color: getMessageColor('error'),
          timestamp: new Date(),
          dismissible: true,
          actionable: {
            text: 'Review command safety',
            action: () => console.log('Opening safety guide...'),
          },
        });
        break;
      }
    }

    return warnings;
  }

  /**
   * パフォーマンス問題予測
   */
  private predictPerformanceIssues(context: PredictionContext): WarningAlert[] {
    const warnings: WarningAlert[] = [];
    const { systemState, command } = context;

    // メモリ不足警告
    if (systemState.memoryUsage > 85) {
      warnings.push({
        id: 'low-memory',
        type: 'warning',
        title: 'Low Memory Warning',
        message: `System memory usage is at ${systemState.memoryUsage}%. Consider freeing up memory.`,
        severity: 'warning',
        icon: getStatusIcon('warning'),
        color: getMessageColor('warning'),
        timestamp: new Date(),
        dismissible: true,
        actionable: {
          text: 'Optimize memory usage',
          action: () => console.log('Opening memory optimization guide...'),
        },
      });
    }

    // CPU負荷警告
    if (systemState.cpuUsage > 90) {
      warnings.push({
        id: 'high-cpu',
        type: 'warning',
        title: 'High CPU Usage',
        message: `CPU usage is at ${systemState.cpuUsage}%. Performance may be affected.`,
        severity: 'warning',
        icon: getStatusIcon('warning'),
        color: getMessageColor('warning'),
        timestamp: new Date(),
        dismissible: true,
      });
    }

    // 大容量処理の警告
    if (command.includes('large') || command.includes('batch') || command.includes('all')) {
      warnings.push({
        id: 'large-operation',
        type: 'suggestion',
        title: 'Large Operation Detected',
        message: 'This operation may take a while. Consider breaking it into smaller chunks.',
        severity: 'info',
        icon: getStatusIcon('info'),
        color: getMessageColor('info'),
        timestamp: new Date(),
        dismissible: true,
      });
    }

    return warnings;
  }

  /**
   * 互換性問題チェック
   */
  private checkCompatibilityIssues(context: PredictionContext): WarningAlert[] {
    const warnings: WarningAlert[] = [];
    const { command } = context;

    // Node.js バージョン互換性
    if (command.includes('node') || command.includes('npm')) {
      warnings.push({
        id: 'node-compatibility',
        type: 'suggestion',
        title: 'Node.js Compatibility',
        message: 'Ensure your Node.js version is compatible with the project requirements',
        severity: 'info',
        icon: getStatusIcon('info'),
        color: getMessageColor('info'),
        timestamp: new Date(),
        dismissible: true,
      });
    }

    return warnings;
  }

  /**
   * ロジックエラー予測
   */
  private predictLogicErrors(context: PredictionContext): WarningAlert[] {
    const warnings: WarningAlert[] = [];
    const { parameters } = context;

    // 矛盾するパラメータ
    if (parameters.includes('--delete') && parameters.includes('--create')) {
      warnings.push({
        id: 'conflicting-params',
        type: 'warning',
        title: 'Conflicting Parameters',
        message: 'Command contains conflicting parameters (--delete and --create)',
        severity: 'warning',
        icon: getStatusIcon('warning'),
        color: getMessageColor('warning'),
        timestamp: new Date(),
        dismissible: true,
      });
    }

    return warnings;
  }

  /**
   * システムリソースチェック
   */
  private checkSystemResources(context: PredictionContext): WarningAlert[] {
    const warnings: WarningAlert[] = [];
    const { systemState } = context;

    // ディスク容量不足
    if (systemState.diskSpace < 10) {
      warnings.push({
        id: 'low-disk-space',
        type: 'critical',
        title: 'Low Disk Space',
        message: `Only ${systemState.diskSpace}% disk space remaining. Operations may fail.`,
        severity: 'critical',
        icon: getStatusIcon('error'),
        color: getMessageColor('error'),
        timestamp: new Date(),
        dismissible: false,
        actionable: {
          text: 'Free up disk space',
          action: () => console.log('Opening disk cleanup guide...'),
        },
      });
    }

    // ネットワーク接続問題
    if (systemState.networkStatus === 'offline') {
      warnings.push({
        id: 'network-offline',
        type: 'critical',
        title: 'Network Offline',
        message: 'No network connection. Online operations will fail.',
        severity: 'critical',
        icon: getStatusIcon('error'),
        color: getMessageColor('error'),
        timestamp: new Date(),
        dismissible: true,
      });
    }

    return warnings;
  }

  /**
   * 履歴ベースのエラー予測
   */
  private predictHistoricalErrors(context: PredictionContext): WarningAlert[] {
    const warnings: WarningAlert[] = [];

    // 同じコマンドでの過去のエラー
    const similarErrors = this.errorHistory.filter(
      (error) => error.command === context.command && !error.resolved,
    );

    if (similarErrors.length > 0) {
      const lastError = similarErrors[similarErrors.length - 1];
      warnings.push({
        id: 'historical-error',
        type: 'warning',
        title: 'Previous Error Detected',
        message: `This command failed before: ${lastError.error}`,
        severity: 'warning',
        icon: getStatusIcon('warning'),
        color: getMessageColor('warning'),
        timestamp: new Date(),
        dismissible: true,
        actionable: {
          text: 'View previous solution',
          action: () => console.log(`Solution: ${lastError.resolution || 'No solution recorded'}`),
        },
      });
    }

    return warnings;
  }

  /**
   * リスク評価
   */
  assessRisk(context: PredictionContext): RiskAssessment {
    const factors: RiskFactor[] = [];

    // ユーザー経験レベル
    const experienceFactor = this.calculateExperienceFactor(context.userProfile.experienceLevel);
    factors.push({
      type: 'user-experience',
      description: `User experience level: ${context.userProfile.experienceLevel}`,
      impact: experienceFactor.impact,
      likelihood: experienceFactor.likelihood,
    });

    // システム状態
    const systemFactor = this.calculateSystemFactor(context.systemState);
    factors.push({
      type: 'system-state',
      description: 'Current system resource usage',
      impact: systemFactor.impact,
      likelihood: systemFactor.likelihood,
    });

    // コマンドの複雑さ
    const complexityFactor = this.calculateComplexityFactor(context.command, context.parameters);
    factors.push({
      type: 'command-complexity',
      description: 'Command complexity and risk level',
      impact: complexityFactor.impact,
      likelihood: complexityFactor.likelihood,
    });

    // 全体的なリスクスコア計算
    const overallScore =
      factors.reduce((sum, factor) => sum + factor.impact * factor.likelihood, 0) / factors.length;

    return {
      level: this.calculateRiskLevel(overallScore),
      confidence: Math.min(0.95, factors.length * 0.2),
      factors,
      overallScore: Math.round(overallScore * 10),
    };
  }

  /**
   * エラー履歴に記録
   */
  recordError(command: string, error: string, context: string): void {
    this.errorHistory.push({
      command,
      error,
      timestamp: new Date(),
      context,
      resolved: false,
    });

    // 履歴は最新100件まで保持
    if (this.errorHistory.length > 100) {
      this.errorHistory.shift();
    }
  }

  /**
   * エラー解決をマーク
   */
  markErrorResolved(command: string, resolution: string): void {
    const unresolvedErrors = this.errorHistory.filter(
      (error) => error.command === command && !error.resolved,
    );

    unresolvedErrors.forEach((error) => {
      error.resolved = true;
      error.resolution = resolution;
    });
  }

  /**
   * 警告をクリア
   */
  dismissWarning(warningId: string): void {
    this.activeWarnings.delete(warningId);
  }

  // Helper methods
  private initializeErrorPatterns(): void {
    // 一般的なエラーパターンを初期化
    this.patterns.set('syntax', [
      {
        id: 'unclosed-quotes',
        pattern: /["'][^"']*$/,
        severity: 'medium',
        category: 'syntax',
        description: 'Unclosed quotes detected',
        suggestion: 'Add closing quote',
        preventable: true,
        commonCauses: ['Forgetting to close quotes', 'Nested quotes'],
      },
    ]);

    this.patterns.set('security', [
      {
        id: 'credentials-in-command',
        pattern: /sk-[a-zA-Z0-9]{48}|API[_-]?KEY|SECRET/i,
        severity: 'critical',
        category: 'security',
        description: 'Credentials detected in command',
        suggestion: 'Use environment variables instead',
        preventable: true,
        commonCauses: ['Copy-pasting from documentation', 'Testing with real credentials'],
      },
    ]);
  }

  private initializeRiskFactors(): void {
    this.riskFactors.set('beginner', 0.8);
    this.riskFactors.set('intermediate', 0.5);
    this.riskFactors.set('advanced', 0.3);
    this.riskFactors.set('expert', 0.1);
  }

  private fixUnclosedQuotes(command: string): string {
    // Simple auto-fix for unclosed quotes
    const quotes = command.match(/["']/g) || [];
    if (quotes.length % 2 !== 0) {
      const lastQuote = quotes[quotes.length - 1];
      return command + lastQuote;
    }
    return command;
  }

  private getSeverityWeight(severity: string): number {
    const weights = { critical: 4, error: 3, warning: 2, info: 1 };
    return weights[severity] || 0;
  }

  private calculateExperienceFactor(level: string): { impact: number; likelihood: number } {
    const factors = {
      beginner: { impact: 8, likelihood: 0.7 },
      intermediate: { impact: 5, likelihood: 0.4 },
      advanced: { impact: 3, likelihood: 0.2 },
      expert: { impact: 1, likelihood: 0.1 },
    };
    return factors[level] || factors.intermediate;
  }

  private calculateSystemFactor(state: SystemState): { impact: number; likelihood: number } {
    const memoryRisk = state.memoryUsage > 85 ? 0.8 : 0.2;
    const cpuRisk = state.cpuUsage > 90 ? 0.7 : 0.1;
    const diskRisk = state.diskSpace < 10 ? 0.9 : 0.1;

    const averageRisk = (memoryRisk + cpuRisk + diskRisk) / 3;
    return {
      impact: Math.round(averageRisk * 10),
      likelihood: averageRisk,
    };
  }

  private calculateComplexityFactor(
    command: string,
    parameters: string[],
  ): { impact: number; likelihood: number } {
    let complexity = 0;

    // パラメータ数による複雑さ
    complexity += parameters.length * 0.1;

    // 特殊文字の使用
    if (/[|&;<>(){}[\]\\]/.test(command)) {
      complexity += 0.3;
    }

    // 危険なコマンド
    if (/rm|delete|remove/.test(command.toLowerCase())) {
      complexity += 0.5;
    }

    return {
      impact: Math.min(10, Math.round(complexity * 10)),
      likelihood: Math.min(0.9, complexity),
    };
  }

  private calculateRiskLevel(
    score: number,
  ): 'safe' | 'caution' | 'warning' | 'danger' | 'critical' {
    if (score < 2) return 'safe';
    if (score < 4) return 'caution';
    if (score < 6) return 'warning';
    if (score < 8) return 'danger';
    return 'critical';
  }
}
