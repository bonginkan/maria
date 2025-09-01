import { GenerationOptions, modelManager } from "./model-manager";
import { promises as fs } from "fs";
import { dirname, extname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

export interface VideoOptions extends GenerationOptions {
  model: "wan22-5b" | "wan22-14b";
  fps?: number;
  frames?: number;
  resolution?: "720p" | "1080p" | "1280x720" | "1920x1080";
  compare?: boolean;
}

export interface VideoResult {
  success: boolean;
  _outputPath?: string;
  _comparisonPath?: string;
  _error?: string;
  _metadata?: {
    duration: number;
    fps: number;
    resolution: string;
    modelUsed: string;
    generationTime: number;
  };
}

export interface GenerationProgress {
  stage: "initializing" | "processing" | "finalizing" | "complete" | "_error";
  percentage: number;
  estimatedTimeRemaining: string;
  currentStep: string;
  totalSteps: number;
  _error?: string;
}

export class VideoGenerationService {
  private outputDir: string;
  private tempDir: string;

  constructor() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(filename);
    const _mariaRoot = resolve(dirname, "../../../../..");
    this.outputDir = join(_mariaRoot, "outputs/videos");
    this.tempDir = join(_mariaRoot, "outputs/temp");
  }

  /**
   * 動画生成(Text-to-Video)
   */
  async generateVideo(
    prompt: string,
    options: VideoOptions,
    onProgress?: (_progress: GenerationProgress) => void,
  ): Promise<VideoResult> {
    try {
      // 初期化
      onProgress?.({
        stage: "initializing",
        percentage: 0,
        estimatedTimeRemaining: "計算中...",
        currentStep: "ComfyUI起動確認",
        totalSteps: 4,
      });

      // ComfyUI起動確認
      const _isComfyUIRunning = await modelManager.checkComfyUIStatus();
      if (!_isComfyUIRunning) {
        onProgress?.({
          stage: "initializing",
          percentage: 10,
          estimatedTimeRemaining: "30秒",
          currentStep: "ComfyUI起動中",
          totalSteps: 4,
        });

        const _started = await modelManager.startComfyUI();
        if (!_started) {
          throw new Error("ComfyUIの起動に失敗しました");
        }
      }

      // モデル可用性確認
      onProgress?.({
        stage: "initializing",
        percentage: 25,
        estimatedTimeRemaining:
          options.model === "wan22-14b" ? "10-15分" : "3-7分",
        currentStep: "モデル読み込み確認",
        totalSteps: 4,
      });

      const _modelInfo = await modelManager.getModelInfo(options.model);
      if (!_modelInfo || _modelInfo.status !== "available") {
        throw new Error(`モデル ${options.model} が利用できません`);
      }

      // 出力ディレクトリ準備
      await this.ensureDirectories();

      // 比較生成の場合は両モデルで生成
      if (options.compare) {
        return await this.generateComparison(prompt, options, onProgress);
      }

      // 単一モデルで生成
      return await this.generateSingle(prompt, options, onProgress);
    } catch (_error: unknown) {
      onProgress?.({
        stage: "_error",
        percentage: 0,
        estimatedTimeRemaining: "",
        currentStep: "エラー発生",
        totalSteps: 0,
        _error: _error instanceof Error ? _error.message : String(_error),
      });

      return {
        success: false,
        _error: _error instanceof Error ? _error.message : String(_error),
      };
    }
  }

  /**
   * 単一モデルで動画生成
   */
  private async generateSingle(
    prompt: string,
    options: VideoOptions,
    onProgress?: (_progress: GenerationProgress) => void,
  ): Promise<VideoResult> {
    const _startTime = Date.now();
    const _outputFilename = this.generateOutputFilename(options.model);
    const _outputPath = join(this.outputDir, _outputFilename);

    try {
      // ワークフロー選択
      const modelMap: Record<string, string> = {
        "wan22-5b": "wan22_5b",
        "wan22-14b": "wan22_14b",
      };
      const _normalizedModel = modelMap[options.model] || options.model;
      const _workflowId = options.inputImage
        ? `${_normalizedModel}_i2v`
        : `${_normalizedModel}_t2v`;

      onProgress?.({
        stage: "processing",
        percentage: 30,
        estimatedTimeRemaining: this.estimateGenerationTime(options.model),
        currentStep: "ワークフロー準備",
        totalSteps: 4,
      });

      // ワークフロー読み込み
      const _workflowData = await modelManager.loadWorkflow(_workflowId);

      // パラメータ設定
      const generationParams: GenerationOptions = {
        model: options.model,
        prompt,
        width: this.parseResolution(options.resolution).width,
        height: this.parseResolution(options.resolution).height,
        steps: options.steps || (options.model === "wan22-14b" ? 50 : 30),
        seed: options.seed,
        inputImage: options.inputImage,
        _outputPath: _outputFilename.replace(".mp4", ""),
      };

      // ワークフロー実行
      onProgress?.({
        stage: "processing",
        percentage: 50,
        estimatedTimeRemaining: this.estimateGenerationTime(options.model),
        currentStep: `${options.model} モデルで生成中`,
        totalSteps: 4,
      });

      const _processedWorkflow = modelManager.replaceWorkflowParameters(
        (_workflowData as Record<string, unknown>)["workflow"] as Record<
          string,
          unknown
        >,
        generationParams,
      );

      const _promptId = await modelManager.executeWorkflow(_processedWorkflow);

      // 生成完了待機
      await this.waitForCompletion(_promptId, onProgress);

      // 後処理
      onProgress?.({
        stage: "finalizing",
        percentage: 90,
        estimatedTimeRemaining: "30秒",
        currentStep: "出力ファイル処理",
        totalSteps: 4,
      });

      // ComfyUI出力からファイル移動
      await this.moveOutputFiles(_outputPath);

      // メタデータ生成
      const _metadata = await this.generateMetadata(
        _outputPath,
        options.model,
        Date.now() - _startTime,
      );

      // 最終使用日時更新
      await modelManager.updateLastUsed(options.model);

      onProgress?.({
        stage: "complete",
        percentage: 100,
        estimatedTimeRemaining: "完了",
        currentStep: "動画生成完了",
        totalSteps: 4,
      });

      return {
        success: true,
        _outputPath,
        _metadata,
      };
    } catch (_error: unknown) {
      return {
        success: false,
        _error: _error instanceof Error ? _error.message : String(_error),
      };
    }
  }

  /**
   * 比較動画生成(5B vs 14B)
   */
  private async generateComparison(
    prompt: string,
    options: VideoOptions,
    onProgress?: (_progress: GenerationProgress) => void,
  ): Promise<VideoResult> {
    try {
      onProgress?.({
        stage: "processing",
        percentage: 10,
        estimatedTimeRemaining: "15-20分",
        currentStep: "5Bモデルで生成中",
        totalSteps: 6,
      });

      // 5Bモデルで生成
      const options5B: VideoOptions = {
        ...options,
        model: "wan22-5b",
        compare: false,
      };
      const _result5B = await this.generateSingle(prompt, options5B);

      if (!_result5B.success) {
        throw new Error(`5Bモデル生成エラー: ${_result5B._error}`);
      }

      onProgress?.({
        stage: "processing",
        percentage: 40,
        estimatedTimeRemaining: "10-15分",
        currentStep: "14Bモデルで生成中",
        totalSteps: 6,
      });

      // 14Bモデルで生成
      const options14B: VideoOptions = {
        ...options,
        model: "wan22-14b",
        compare: false,
      };
      const _result14B = await this.generateSingle(prompt, options14B);

      if (!_result14B.success) {
        throw new Error(`14Bモデル生成エラー: ${_result14B._error}`);
      }

      onProgress?.({
        stage: "finalizing",
        percentage: 80,
        estimatedTimeRemaining: "2-3分",
        currentStep: "比較動画作成中",
        totalSteps: 6,
      });

      // 横並び比較動画作成
      const _comparisonPath = await this.createComparisonVideo(
        result5B.outputPath!,
        result14B.outputPath!,
      );

      onProgress?.({
        stage: "complete",
        percentage: 100,
        estimatedTimeRemaining: "完了",
        currentStep: "比較動画生成完了",
        totalSteps: 6,
      });

      return {
        success: true,
        _outputPath: _result14B.outputPath, // メイン出力は14B
        _comparisonPath,
        _metadata: _result14B.metadata,
      };
    } catch (_error: unknown) {
      return {
        success: false,
        _error: _error instanceof Error ? _error.message : String(_error),
      };
    }
  }

  /**
   * 生成完了待機
   */
  private async waitForCompletion(
    _promptId: string,
    onProgress?: (_progress: GenerationProgress) => void,
  ): Promise<void> {
    const _maxWaitTime = 20 * 60 * 1000; // 20分タイムアウト
    const _checkInterval = 5000; // 5秒間隔
    const _startTime = Date.now();

    while (Date.now() - _startTime < _maxWaitTime) {
      const _status = await modelManager.checkProgress(_promptId);

      if (_status.completed) {
        return;
      }

      if (_status.error) {
        throw new Error(`生成エラー: ${_status.error}`);
      }

      // 進捗更新
      if (onProgress && _status._progress !== undefined) {
        const _elapsedMinutes = (Date.now() - _startTime) / 60000;
        const _progressPercent = Math.min(75, 50 + _status._progress * 25);

        onProgress({
          stage: "processing",
          percentage: _progressPercent,
          estimatedTimeRemaining: `残り ${Math.max(1, Math.ceil(15 - _elapsedMinutes))} 分`,
          currentStep: "動画生成処理中",
          totalSteps: 4,
        });
      }

      await new Promise((resolveInner) => setTimeout(resolve, _checkInterval));
    }

    throw new Error("動画生成がタイムアウトしました");
  }

  /**
   * 比較動画作成(_ffmpeg使用)
   */
  private async createComparisonVideo(
    _leftVideo: string,
    rightVideo: string,
  ): Promise<string> {
    const _timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const _outputPath = join(this.outputDir, `comparison_${_timestamp}.mp4`);

    return new Promise((resolvePromise, reject) => {
      const _ffmpeg = spawn("_ffmpeg", [
        "-y", // 上書き
        "-i",
        leftVideo, // 左側動画(5B)
        "-i",
        rightVideo, // 右側動画(14B)
        "-filter_complex",
        "[0:v]scale=640:360[left];[1:v]scale=640:360[right];[left][right]hstack=inputs=2[v]",
        "-map",
        "[v]",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-crf",
        "23",
        _outputPath,
      ]);

      ffmpeg.on("close", (code) => {
        if (code === 0) {
          resolve(_outputPath);
        } else {
          reject(new Error(`_ffmpeg終了コード: ${code}`));
        }
      });

      ffmpeg.on("_error", (_error) => {
        reject(new Error(`_ffmpeg実行エラー: ${_error.message}`));
      });
    });
  }

  /**
   * 出力ファイルの移動処理
   */
  private async moveOutputFiles(targetPath: string): Promise<void> {
    // TODO: ComfyUIの出力ディレクトリから targetPath へファイル移動
    // 現在はプレースホルダー実装

    // ComfyUIのデフォルト出力ディレクトリ確認 (将来使用予定)
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(filename);
    const _comfyUIOutputDir = resolve(dirname, "../../../../comfyui/output");
    void _comfyUIOutputDir; // Will be used for actual ComfyUI integration

    try {
      // 最新の出力ファイルを検索してコピー
      // 実装が必要: ComfyUIの実際の出力パスに応じて調整
      console.log(`出力ファイルを ${targetPath} に移動準備中...`);
    } catch (_error: unknown) {
      console.warn("出力ファイル移動警告:", _error);
    }
  }

  /**
   * メタデータ生成
   */
  private async generateMetadata(
    _outputPath: string,
    modelUsed: string,
    generationTime: number,
  ): Promise<VideoResult["_metadata"]> {
    // TODO: 実際の動画ファイルからメタデータを取得
    return {
      duration: 2.0, // 秒
      fps: 24,
      resolution: "1280x720",
      modelUsed,
      generationTime: Math.round(generationTime / 1000), // 秒単位
    };
  }

  /**
   * ユーティリティメソッド
   */
  private parseResolution(resolution?: string): {
    width: number;
    height: number;
  } {
    switch (resolution) {
      case "720p":
      case "1280x720":
        return { width: 1280, height: 720 };
      case "1080p":
      case "1920x1080":
        return { width: 1920, height: 1080 };
      default:
        return { width: 1280, height: 720 };
    }
  }

  private estimateGenerationTime(model: string): string {
    return model === "wan22-14b" ? "5-15分" : "2-7分";
  }

  private generateOutputFilename(model: string): string {
    const _timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `maria_video_${model}_${_timestamp}.mp4`;
  }

  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.outputDir, { recursive: true });
    await fs.mkdir(this.tempDir, { recursive: true });
  }

  /**
   * Image-to-Video 専用メソッド
   */
  async generateFromImage(
    imagePath: string,
    prompt: string,
    options: Omit<VideoOptions, "inputImage">,
  ): Promise<VideoResult> {
    // 画像ファイル存在確認
    try {
      await fs.access(imagePath);
    } catch {
      return {
        success: false,
        _error: `入力画像が見つかりません: ${imagePath}`,
      };
    }

    // 対応フォーマット確認
    const _ext = extname(imagePath).toLowerCase();
    if (![".jpg", ".jpeg", ".png", ".bmp"].includes(_ext)) {
      return {
        success: false,
        _error: `対応していない画像フォーマット: ${_ext}`,
      };
    }

    return await this.generateVideo(prompt, {
      ...options,
      inputImage: imagePath,
    });
  }
}

// シングルトンインスタンス
export const _videoGenerationService = new VideoGenerationService();
