/**
 * Processing Time Estimator & ETA Display System
 * 処理時間推定とETA表示システム
 */

export interface TimeEstimate {
  estimated: number; // milliseconds
  confidence: number; // 0-1
  factors: EstimationFactor[];
  category: 'instant' | 'fast' | 'medium' | 'slow' | 'very-slow';
  displayText: string;
}

export interface EstimationFactor {
  name: string;
  impact: number; // milliseconds
  confidence: number; // 0-1
  description: string;
}

export interface ProcessingMetrics {
  command: string;
  startTime: Date;
  estimatedDuration: number;
  actualDuration?: number;
  parameters: string[];
  systemLoad: number;
  success: boolean;
}

export interface ETADisplay {
  remaining: number; // milliseconds
  progress: number; // 0-100
  speed: number; // items/second or percentage/second
  timeLeft: string; // formatted string
  estimatedCompletion: Date;
  confidence: number;
}

export class ProcessingTimeEstimator {
  private historicalData: Map<string, ProcessingMetrics[]> = new Map();
  private currentProcesses: Map<string, ProcessingMetrics> = new Map();
  private commandComplexity: Map<string, number> = new Map();
  private systemBenchmarks: Map<string, number> = new Map();

  constructor() {
    this.initializeCommandComplexity();
    this.initializeSystemBenchmarks();
  }

  /**
   * コマンドの処理時間を推定
   */
  estimateProcessingTime(
    command: string,
    parameters: string[] = [],
    _context?: unknown,
  ): TimeEstimate {
    const factors: EstimationFactor[] = [];
    let baseEstimate = this.getBaseEstimate(command);

    // 1. 履歴データからの推定
    const historicalFactor = this.calculateHistoricalFactor(command, parameters);
    if (historicalFactor) {
      factors.push(historicalFactor);
      baseEstimate += historicalFactor.impact;
    }

    // 2. パラメータの複雑さ
    const complexityFactor = this.calculateComplexityFactor(command, parameters);
    factors.push(complexityFactor);
    baseEstimate += complexityFactor.impact;

    // 3. システム負荷の影響
    const systemFactor = this.calculateSystemLoadFactor();
    factors.push(systemFactor);
    baseEstimate *= 1 + systemFactor.impact / 1000;

    // 4. ファイルサイズの影響
    const fileFactor = this.calculateFileSizeFactor(parameters);
    if (fileFactor) {
      factors.push(fileFactor);
      baseEstimate += fileFactor.impact;
    }

    // 5. ネットワーク依存の影響
    const networkFactor = this.calculateNetworkFactor(command);
    if (networkFactor) {
      factors.push(networkFactor);
      baseEstimate += networkFactor.impact;
    }

    // 信頼度の計算
    const confidence = this.calculateConfidence(factors, command);

    const estimate: TimeEstimate = {
      estimated: Math.max(100, Math.round(baseEstimate)), // 最低100ms
      confidence,
      factors,
      category: this.categorizeTime(baseEstimate),
      displayText: this.formatEstimate(baseEstimate, confidence),
    };

    return estimate;
  }

  /**
   * リアルタイムETA更新
   */
  updateETA(processId: string, currentProgress: number): ETADisplay | null {
    const process = this.currentProcesses.get(processId);
    if (!process) return null;

    const elapsed = Date.now() - process.startTime.getTime();
    const progressRatio = currentProgress / 100;

    if (progressRatio <= 0) return null;

    // 現在の速度を計算
    const speed = progressRatio / (elapsed / 1000); // progress per second

    // 残り時間の計算
    const remainingProgress = 1 - progressRatio;
    const remainingTime = (remainingProgress / speed) * 1000; // milliseconds

    // 推定完了時刻
    const estimatedCompletion = new Date(Date.now() + remainingTime);

    // 信頼度の計算（進捗が進むほど高くなる）
    const confidence = Math.min(0.95, 0.3 + progressRatio * 0.7);

    return {
      remaining: Math.round(remainingTime),
      progress: currentProgress,
      speed: speed * 100, // percentage per second
      timeLeft: this.formatDuration(remainingTime),
      estimatedCompletion,
      confidence,
    };
  }

  /**
   * 処理開始を記録
   */
  startProcessing(
    processId: string,
    command: string,
    parameters: string[],
    estimatedDuration: number,
  ): void {
    const metrics: ProcessingMetrics = {
      command,
      startTime: new Date(),
      estimatedDuration,
      parameters,
      systemLoad: this.getCurrentSystemLoad(),
      success: false,
    };

    this.currentProcesses.set(processId, metrics);
  }

  /**
   * 処理完了を記録
   */
  completeProcessing(processId: string, success: boolean = true): ProcessingMetrics | null {
    const process = this.currentProcesses.get(processId);
    if (!process) return null;

    const actualDuration = Date.now() - process.startTime.getTime();
    process.actualDuration = actualDuration;
    process.success = success;

    // 履歴データに追加
    this.addToHistory(process);

    // 現在のプロセスから削除
    this.currentProcesses.delete(processId);

    // 推定精度の更新
    this.updateEstimationAccuracy(process);

    return process;
  }

  /**
   * 処理をキャンセル
   */
  cancelProcessing(processId: string): void {
    this.currentProcesses.delete(processId);
  }

  /**
   * 推定精度の分析
   */
  getEstimationAccuracy(command?: string): { accuracy: number; totalPredictions: number } {
    let relevantHistory: ProcessingMetrics[];

    if (command) {
      relevantHistory = this.historicalData.get(command) || [];
    } else {
      relevantHistory = Array.from(this.historicalData.values()).flat();
    }

    if (relevantHistory.length === 0) {
      return { accuracy: 0, totalPredictions: 0 };
    }

    const accuracyScores = relevantHistory
      .filter((metrics) => metrics.actualDuration !== undefined)
      .map((metrics) => {
        const predicted = metrics.estimatedDuration;
        const actual = metrics.actualDuration!;
        const error = Math.abs(predicted - actual) / actual;
        return Math.max(0, 1 - error); // 0-1の精度スコア
      });

    const averageAccuracy =
      accuracyScores.reduce((sum, score) => sum + score, 0) / accuracyScores.length;

    return {
      accuracy: Math.round(averageAccuracy * 100) / 100,
      totalPredictions: accuracyScores.length,
    };
  }

  // Private helper methods
  private getBaseEstimate(command: string): number {
    const baseEstimates = {
      '/code': 8000, // 8 seconds
      '/test': 12000, // 12 seconds
      '/review': 6000, // 6 seconds
      '/image': 15000, // 15 seconds
      '/video': 45000, // 45 seconds
      '/commit': 3000, // 3 seconds
      '/config': 2000, // 2 seconds
      '/model': 4000, // 4 seconds
      '/help': 500, // 0.5 seconds
      '/clear': 200, // 0.2 seconds
      '/init': 5000, // 5 seconds
      '/bug': 10000, // 10 seconds
    };

    return (baseEstimates as Record<string, number>)[command] || 5000; // default 5 seconds
  }

  private calculateHistoricalFactor(
    command: string,
    parameters: string[],
  ): EstimationFactor | null {
    const history = this.historicalData.get(command);
    if (!history || history.length < 3) return null;

    // 類似のパラメータを持つ過去の実行を検索
    const similarExecutions = history.filter(
      (metrics) => this.calculateParameterSimilarity(metrics.parameters, parameters) > 0.7,
    );

    if (similarExecutions.length === 0) return null;

    const averageDuration =
      similarExecutions.reduce(
        (sum, metrics) => sum + (metrics.actualDuration || metrics.estimatedDuration),
        0,
      ) / similarExecutions.length;

    const baseEstimate = this.getBaseEstimate(command);
    const adjustment = averageDuration - baseEstimate;

    return {
      name: 'Historical Data',
      impact: adjustment,
      confidence: Math.min(0.9, similarExecutions.length / 10),
      description: `Based on ${similarExecutions.length} similar past executions`,
    };
  }

  private calculateComplexityFactor(_command: string, parameters: string[]): EstimationFactor {
    let complexityScore = 0;

    // パラメータ数による複雑さ
    complexityScore += parameters.length * 0.1;

    // 特定のパラメータによる複雑さ
    const complexParams = ['--all', '--recursive', '--force', '--batch'];
    for (const param of parameters) {
      if (complexParams.some((cp) => param.includes(cp))) {
        complexityScore += 0.3;
      }
    }

    // ファイルパスの複雑さ
    const pathParams = parameters.filter((p) => p.includes('/') || p.includes('\\'));
    complexityScore += pathParams.length * 0.2;

    const complexityImpact = complexityScore * 2000; // milliseconds

    return {
      name: 'Command Complexity',
      impact: complexityImpact,
      confidence: 0.8,
      description: `Complexity score: ${complexityScore.toFixed(1)}`,
    };
  }

  private calculateSystemLoadFactor(): EstimationFactor {
    const systemLoad = this.getCurrentSystemLoad();
    const loadImpact = systemLoad * 50; // 負荷1%につき50ms増加

    return {
      name: 'System Load',
      impact: loadImpact,
      confidence: 0.7,
      description: `Current system load: ${systemLoad}%`,
    };
  }

  private calculateFileSizeFactor(parameters: string[]): EstimationFactor | null {
    // ファイルサイズを推定（実際の実装では fs.stat などを使用）
    const fileParams = parameters.filter(
      (p) => p.includes('.') && (p.includes('/') || p.includes('\\')),
    );

    if (fileParams.length === 0) return null;

    // 仮の計算（実際にはファイルサイズを取得）
    const estimatedSizeImpact = fileParams.length * 1000; // ファイル1個につき1秒

    return {
      name: 'File Processing',
      impact: estimatedSizeImpact,
      confidence: 0.6,
      description: `Processing ${fileParams.length} file(s)`,
    };
  }

  private calculateNetworkFactor(command: string): EstimationFactor | null {
    const networkCommands = ['/model', '/image', '/video', '/review'];
    if (!networkCommands.includes(command)) return null;

    const networkSpeed = this.getNetworkSpeed(); // 'fast' | 'medium' | 'slow'
    const networkImpact =
      {
        fast: 0,
        medium: 2000,
        slow: 5000,
      }[networkSpeed] || 1000;

    return {
      name: 'Network Speed',
      impact: networkImpact,
      confidence: 0.5,
      description: `Network speed: ${networkSpeed}`,
    };
  }

  private calculateConfidence(factors: EstimationFactor[], command: string): number {
    const history = this.historicalData.get(command);
    const historyFactor = history ? Math.min(0.4, history.length / 25) : 0;

    const factorConfidence =
      factors.reduce((sum, factor) => sum + factor.confidence, 0) / factors.length;

    return Math.min(0.95, historyFactor + factorConfidence * 0.6);
  }

  private categorizeTime(
    milliseconds: number,
  ): 'instant' | 'fast' | 'medium' | 'slow' | 'very-slow' {
    if (milliseconds < 1000) return 'instant';
    if (milliseconds < 5000) return 'fast';
    if (milliseconds < 15000) return 'medium';
    if (milliseconds < 60000) return 'slow';
    return 'very-slow';
  }

  private formatEstimate(milliseconds: number, confidence: number): string {
    const duration = this.formatDuration(milliseconds);
    const confidenceText =
      confidence > 0.8
        ? 'High confidence'
        : confidence > 0.6
          ? 'Medium confidence'
          : 'Low confidence';

    return `~${duration} (${confidenceText})`;
  }

  private formatDuration(milliseconds: number): string {
    if (milliseconds < 1000) {
      return `${Math.round(milliseconds)}ms`;
    } else if (milliseconds < 60000) {
      return `${(milliseconds / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(milliseconds / 60000);
      const seconds = Math.round((milliseconds % 60000) / 1000);
      return `${minutes}m ${seconds}s`;
    }
  }

  private addToHistory(metrics: ProcessingMetrics): void {
    const command = metrics.command;
    if (!this.historicalData.has(command)) {
      this.historicalData.set(command, []);
    }

    const history = this.historicalData.get(command)!;
    history.push(metrics);

    // 履歴は最新50件まで保持
    if (history.length > 50) {
      history.shift();
    }
  }

  private updateEstimationAccuracy(metrics: ProcessingMetrics): void {
    if (!metrics.actualDuration) return;

    const accuracy =
      1 - Math.abs(metrics.estimatedDuration - metrics.actualDuration) / metrics.actualDuration;

    // 推定モデルの改善に使用（機械学習の簡易版）
    const command = metrics.command;
    const currentComplexity = this.commandComplexity.get(command) || 1;

    if (accuracy < 0.7) {
      // 精度が低い場合は複雑度を調整
      this.commandComplexity.set(command, currentComplexity * 1.1);
    } else if (accuracy > 0.9) {
      // 精度が高い場合は複雑度を下げる
      this.commandComplexity.set(command, currentComplexity * 0.95);
    }
  }

  private calculateParameterSimilarity(params1: string[], params2: string[]): number {
    const set1 = new Set(params1);
    const set2 = new Set(params2);

    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return union.size === 0 ? 1 : intersection.size / union.size;
  }

  private getCurrentSystemLoad(): number {
    // 実際の実装では os.loadavg() などを使用
    return Math.random() * 30 + 10; // 10-40% の負荷をシミュレート
  }

  private getNetworkSpeed(): 'fast' | 'medium' | 'slow' {
    // 実際の実装ではネットワークテストを実行
    const speeds = ['fast', 'medium', 'slow'] as const;
    return speeds[Math.floor(Math.random() * speeds.length)] || 'medium';
  }

  private initializeCommandComplexity(): void {
    this.commandComplexity.set('/code', 1.5);
    this.commandComplexity.set('/test', 1.8);
    this.commandComplexity.set('/review', 1.2);
    this.commandComplexity.set('/image', 2.0);
    this.commandComplexity.set('/video', 3.0);
    this.commandComplexity.set('/commit', 0.8);
    this.commandComplexity.set('/config', 0.6);
    this.commandComplexity.set('/model', 1.0);
    this.commandComplexity.set('/help', 0.3);
    this.commandComplexity.set('/clear', 0.2);
    this.commandComplexity.set('/init', 1.3);
    this.commandComplexity.set('/bug', 1.7);
  }

  private initializeSystemBenchmarks(): void {
    // システムベンチマークの初期化
    this.systemBenchmarks.set('cpu_single', 1000);
    this.systemBenchmarks.set('cpu_multi', 4000);
    this.systemBenchmarks.set('memory_bandwidth', 8000);
    this.systemBenchmarks.set('disk_read', 2000);
    this.systemBenchmarks.set('disk_write', 1500);
  }

  // Public getters
  getHistoricalData(command?: string): ProcessingMetrics[] {
    if (command) {
      return this.historicalData.get(command) || [];
    }
    return Array.from(this.historicalData.values()).flat();
  }

  getCurrentProcesses(): Map<string, ProcessingMetrics> {
    return new Map(this.currentProcesses);
  }
}
