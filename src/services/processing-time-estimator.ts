/**
 * Processing Time Estimator & ETA Display System
 * 処理時間推定とETA表示システム
 */

export interface TimeEstimate {
  estimated: number; // milliseconds
  _confidence: number; // 0-1
  factors: EstimationFactor[];
  category: "instant" | "fast" | "medium" | "slow" | "very-slow";
  displayText: string;
}

export interface EstimationFactor {
  name: string;
  impact: number; // milliseconds
  _confidence: number; // 0-1
  description: string;
}

export interface ProcessingMetrics {
  _command: string;
  startTime: Date;
  estimatedDuration: number;
  _actualDuration?: number;
  parameters: string[];
  _systemLoad: number;
  success: boolean;
}

export interface ETADisplay {
  remaining: number; // milliseconds
  progress: number; // 0-100
  _speed: number; // items/second or percentage/second
  timeLeft: string; // formatted string
  _estimatedCompletion: Date;
  _confidence: number;
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
    _command: string,
    parameters: string[] = [],
    _context?: unknown,
  ): TimeEstimate {
    const factors: EstimationFactor[] = [];
    let _baseEstimate = this.getBaseEstimate(_command);

    // 1. 履歴データからの推定
    const _historicalFactor = this.calculateHistoricalFactor(
      _command,
      parameters,
    );
    if (_historicalFactor) {
      factors.push(_historicalFactor);
      _baseEstimate += _historicalFactor.impact;
    }

    // 2. パラメータの複雑さ
    const _complexityFactor = this.calculateComplexityFactor(
      _command,
      parameters,
    );
    factors.push(_complexityFactor);
    _baseEstimate += _complexityFactor.impact;

    // 3. システム負荷の影響
    const _systemFactor = this.calculateSystemLoadFactor();
    factors.push(_systemFactor);
    _baseEstimate *= 1 + _systemFactor.impact / 1000;

    // 4. ファイルサイズの影響
    const _fileFactor = this.calculateFileSizeFactor(parameters);
    if (_fileFactor) {
      factors.push(_fileFactor);
      _baseEstimate += _fileFactor.impact;
    }

    // 5. ネットワーク依存の影響
    const _networkFactor = this.calculateNetworkFactor(_command);
    if (_networkFactor) {
      factors.push(_networkFactor);
      _baseEstimate += _networkFactor.impact;
    }

    // 信頼度の計算
    const _confidence = this.calculateConfidence(factors, _command);

    const estimate: TimeEstimate = {
      estimated: Math.max(100, Math.round(_baseEstimate)), // 最低100ms
      _confidence,
      factors,
      category: this.categorizeTime(_baseEstimate),
      displayText: this.formatEstimate(_baseEstimate, _confidence),
    };

    return estimate;
  }

  /**
   * リアルタイムETA更新
   */
  updateETA(_processId: string, currentProgress: number): ETADisplay | null {
    const _process = this.currentProcesses.get(_processId);
    if (!_process) {
      return null;
    }

    const _elapsed = Date.now() - _process.startTime.getTime();
    const _progressRatio = currentProgress / 100;

    if (_progressRatio <= 0) {
      return null;
    }

    // 現在の速度を計算
    const _speed = _progressRatio / (_elapsed / 1000); // progress per second

    // 残り時間の計算
    const _remainingProgress = 1 - _progressRatio;
    const _remainingTime = (_remainingProgress / _speed) * 1000; // milliseconds

    // 推定完了時刻
    const _estimatedCompletion = new Date(Date.now() + _remainingTime);

    // 信頼度の計算(進捗が進むほど高くなる)
    const _confidence = Math.min(0.95, 0.3 + _progressRatio * 0.7);

    return {
      remaining: Math.round(_remainingTime),
      progress: currentProgress,
      _speed: _speed * 100, // percentage per second
      timeLeft: this.formatDuration(_remainingTime),
      _estimatedCompletion,
      _confidence,
    };
  }

  /**
   * 処理開始を記録
   */
  startProcessing(
    processId: string,
    _command: string,
    parameters: string[],
    estimatedDuration: number,
  ): void {
    const metrics: ProcessingMetrics = {
      _command,
      startTime: new Date(),
      estimatedDuration,
      parameters,
      _systemLoad: this.getCurrentSystemLoad(),
      success: false,
    };

    this.currentProcesses.set(processId, metrics);
  }

  /**
   * 処理完了を記録
   */
  completeProcessing(
    _processId: string,
    success: boolean = true,
  ): ProcessingMetrics | null {
    const _process = this.currentProcesses.get(_processId);
    if (!_process) {
      return null;
    }

    const _actualDuration = Date.now() - _process.startTime.getTime();
    _process._actualDuration = _actualDuration;
    process.success = success;

    // 履歴データに追加
    this.addToHistory(_process);

    // 現在のプロセスから削除
    this.currentProcesses.delete(_processId);

    // 推定精度の更新
    this.updateEstimationAccuracy(_process);

    return _process;
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
  getEstimationAccuracy(_command?: string): {
    _accuracy: number;
    totalPredictions: number;
  } {
    let relevantHistory: ProcessingMetrics[];

    if (_command) {
      relevantHistory = this.historicalData.get(_command) || [];
    } else {
      relevantHistory = Array.from(this.historicalData.values()).flat();
    }

    if (relevantHistory.length === 0) {
      return { _accuracy: 0, totalPredictions: 0 };
    }

    const _accuracyScores = relevantHistory
      .filter((metrics) => metrics.actualDuration !== undefined)
      .map((metrics) => {
        const _predicted = metrics.estimatedDuration;
        const _actual = metrics.actualDuration!;
        const _error = Math.abs(_predicted - _actual) / _actual;
        return Math.max(0, 1 - _error); // 0-1の精度スコア
      });

    const _averageAccuracy =
      _accuracyScores.reduce((sum, score) => sum + score, 0) /
      _accuracyScores.length;

    return {
      _accuracy: Math.round(_averageAccuracy * 100) / 100,
      totalPredictions: _accuracyScores.length,
    };
  }

  // Private helper methods
  private getBaseEstimate(_command: string): number {
    const _baseEstimates = {
      "/code": 8000, // 8 _seconds
      "/test": 12000, // 12 _seconds
      "/review": 6000, // 6 _seconds
      "/image": 15000, // 15 _seconds
      "/video": 45000, // 45 _seconds
      "/commit": 3000, // 3 _seconds
      "/config": 2000, // 2 _seconds
      "/model": 4000, // 4 _seconds
      "/help": 500, // 0.5 _seconds
      "/clear": 200, // 0.2 _seconds
      "/init": 5000, // 5 _seconds
      "/bug": 10000, // 10 _seconds
    };

    return (_baseEstimates as Record<string, number>)[_command] || 5000; // default 5 _seconds
  }

  private calculateHistoricalFactor(
    _command: string,
    parameters: string[],
  ): EstimationFactor | null {
    const _history = this.historicalData.get(_command);
    if (!_history || _history.length < 3) {
      return null;
    }

    // 類似のパラメータを持つ過去の実行を検索
    const _similarExecutions = _history.filter(
      (metrics) =>
        this.calculateParameterSimilarity(metrics.parameters, parameters) > 0.7,
    );

    if (_similarExecutions.length === 0) {
      return null;
    }

    const _averageDuration =
      similarExecutions.reduce(
        (sum, metrics) =>
          sum + (metrics.actualDuration || metrics.estimatedDuration),
        0,
      ) / _similarExecutions.length;

    const _baseEstimate = this.getBaseEstimate(_command);
    const _adjustment = _averageDuration - _baseEstimate;

    return {
      name: "Historical Data",
      impact: _adjustment,
      _confidence: Math.min(0.9, _similarExecutions.length / 10),
      description: `Based on ${_similarExecutions.length} similar past executions`,
    };
  }

  private calculateComplexityFactor(
    _command: string,
    parameters: string[],
  ): EstimationFactor {
    let complexityScore = 0;

    // パラメータ数による複雑さ
    complexityScore += parameters.length * 0.1;

    // 特定のパラメータによる複雑さ
    const _complexParams = ["--all", "--recursive", "--force", "--batch"];
    for (const param of parameters) {
      if (_complexParams.some((cp) => param.includes(cp))) {
        complexityScore += 0.3;
      }
    }

    // ファイルパスの複雑さ
    const _pathParams = parameters.filter(
      (p) => p.includes("/") || p.includes("\\"),
    );
    complexityScore += _pathParams.length * 0.2;

    const _complexityImpact = complexityScore * 2000; // milliseconds

    return {
      name: "Command Complexity",
      impact: _complexityImpact,
      _confidence: 0.8,
      description: `Complexity score: ${complexityScore.toFixed(1)}`,
    };
  }

  private calculateSystemLoadFactor(): EstimationFactor {
    const _systemLoad = this.getCurrentSystemLoad();
    const _loadImpact = _systemLoad * 50; // 負荷1%につき50ms増加

    return {
      name: "System Load",
      impact: _loadImpact,
      _confidence: 0.7,
      description: `Current system load: ${_systemLoad}%`,
    };
  }

  private calculateFileSizeFactor(
    parameters: string[],
  ): EstimationFactor | null {
    // ファイルサイズを推定(実際の実装では fs.stat などを使用)
    const _fileParams = parameters.filter(
      (p) => p.includes(".") && (p.includes("/") || p.includes("\\")),
    );

    if (_fileParams.length === 0) {
      return null;
    }

    // 仮の計算(実際にはファイルサイズを取得)
    const _estimatedSizeImpact = _fileParams.length * 1000; // ファイル1個につき1秒

    return {
      name: "File Processing",
      impact: _estimatedSizeImpact,
      _confidence: 0.6,
      description: `Processing ${_fileParams.length} file(s)`,
    };
  }

  private calculateNetworkFactor(_command: string): EstimationFactor | null {
    const _networkCommands = ["/model", "/image", "/video", "/review"];
    if (!_networkCommands.includes(_command)) {
      return null;
    }

    const _networkSpeed = this.getNetworkSpeed(); // 'fast' | 'medium' | 'slow'
    const _networkImpact =
      {
        fast: 0,
        medium: 2000,
        slow: 5000,
      }[_networkSpeed] || 1000;

    return {
      name: "Network Speed",
      impact: _networkImpact,
      _confidence: 0.5,
      description: `Network _speed: ${_networkSpeed}`,
    };
  }

  private calculateConfidence(
    _factors: EstimationFactor[],
    _command: string,
  ): number {
    const _history = this.historicalData.get(_command);
    const _historyFactor = _history ? Math.min(0.4, _history.length / 25) : 0;

    const _factorConfidence =
      _factors.reduce((sum, factor) => sum + factor.confidence, 0) /
      _factors.length;

    return Math.min(0.95, _historyFactor + _factorConfidence * 0.6);
  }

  private categorizeTime(
    milliseconds: number,
  ): "instant" | "fast" | "medium" | "slow" | "very-slow" {
    if (milliseconds < 1000) {
      return "instant";
    }
    if (milliseconds < 5000) {
      return "fast";
    }
    if (milliseconds < 15000) {
      return "medium";
    }
    if (milliseconds < 60000) {
      return "slow";
    }
    return "very-slow";
  }

  private formatEstimate(_milliseconds: number, _confidence: number): string {
    const _duration = this.formatDuration(_milliseconds);
    const _confidenceText =
      _confidence > 0.8
        ? "High _confidence"
        : _confidence > 0.6
          ? "Medium _confidence"
          : "Low _confidence";

    return `~${_duration} (${_confidenceText})`;
  }

  private formatDuration(milliseconds: number): string {
    if (milliseconds < 1000) {
      return `${Math.round(milliseconds)}ms`;
    } else if (milliseconds < 60000) {
      return `${(milliseconds / 1000).toFixed(1)}s`;
    } else {
      const _minutes = Math.floor(milliseconds / 60000);
      const _seconds = Math.round((milliseconds % 60000) / 1000);
      return `${_minutes}m ${_seconds}s`;
    }
  }

  private addToHistory(metrics: ProcessingMetrics): void {
    const _command = metrics._command;
    if (!this.historicalData.has(_command)) {
      this.historicalData.set(_command, []);
    }

    const _history = this.historicalData.get(_command)!;
    history.push(metrics);

    // 履歴は最新50件まで保持
    if (_history.length > 50) {
      history.shift();
    }
  }

  private updateEstimationAccuracy(metrics: ProcessingMetrics): void {
    if (!metrics.actualDuration) {
      return;
    }

    const _accuracy =
      1 -
      Math.abs(metrics.estimatedDuration - metrics.actualDuration) /
        metrics.actualDuration;

    // 推定モデルの改善に使用(機械学習の簡易版)
    const _command = metrics._command;
    const _currentComplexity = this.commandComplexity.get(_command) || 1;

    if (_accuracy < 0.7) {
      // 精度が低い場合は複雑度を調整
      this.commandComplexity.set(_command, _currentComplexity * 1.1);
    } else if (_accuracy > 0.9) {
      // 精度が高い場合は複雑度を下げる
      this.commandComplexity.set(_command, _currentComplexity * 0.95);
    }
  }

  private calculateParameterSimilarity(
    _params1: string[],
    params2: string[],
  ): number {
    const _set1 = new Set(_params1);
    const _set2 = new Set(params2);

    const _intersection = new Set([..._set1].filter((x) => _set2.has(x)));
    const _union = new Set([..._set1, ..._set2]);

    return _union.size === 0 ? 1 : _intersection.size / _union.size;
  }

  private getCurrentSystemLoad(): number {
    // 実際の実装では os.loadavg() などを使用
    return Math.random() * 30 + 10; // 10-40% の負荷をシミュレート
  }

  private getNetworkSpeed(): "fast" | "medium" | "slow" {
    // 実際の実装ではネットワークテストを実行
    const _speeds = ["fast", "medium", "slow"] as const;
    return _speeds[Math.floor(Math.random() * _speeds.length)] || "medium";
  }

  private initializeCommandComplexity(): void {
    this.commandComplexity.set("/code", 1.5);
    this.commandComplexity.set("/test", 1.8);
    this.commandComplexity.set("/review", 1.2);
    this.commandComplexity.set("/image", 2.0);
    this.commandComplexity.set("/video", 3.0);
    this.commandComplexity.set("/commit", 0.8);
    this.commandComplexity.set("/config", 0.6);
    this.commandComplexity.set("/model", 1.0);
    this.commandComplexity.set("/help", 0.3);
    this.commandComplexity.set("/clear", 0.2);
    this.commandComplexity.set("/init", 1.3);
    this.commandComplexity.set("/bug", 1.7);
  }

  private initializeSystemBenchmarks(): void {
    // システムベンチマークの初期化
    this.systemBenchmarks.set("cpu_single", 1000);
    this.systemBenchmarks.set("cpu_multi", 4000);
    this.systemBenchmarks.set("memory_bandwidth", 8000);
    this.systemBenchmarks.set("disk_read", 2000);
    this.systemBenchmarks.set("disk_write", 1500);
  }

  // Public getters
  getHistoricalData(_command?: string): ProcessingMetrics[] {
    if (_command) {
      return this.historicalData.get(_command) || [];
    }
    return Array.from(this.historicalData.values()).flat();
  }

  getCurrentProcesses(): Map<string, ProcessingMetrics> {
    return new Map(this.currentProcesses);
  }
}
