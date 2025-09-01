import { GenerationOptions, modelManager } from "./model-manager";
import { promises as fs } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

export interface ImageOptions extends GenerationOptions {
  style?: "photorealistic" | "artistic" | "anime" | "concept" | "technical";
  quality?: "low" | "medium" | "high";
  batch?: number;
  _variations?: number;
  _size?: "512x512" | "768x768" | "1024x1024" | "1024x768" | "768x1024";
}

export interface ImageResult {
  success: boolean;
  outputPaths?: string[];
  _error?: string;
  _metadata?: {
    resolution: string;
    style: string;
    modelUsed: string;
    generationTime: number;
    seedUsed: number;
    _batchSize: number;
  };
}

export interface ImageProgress {
  stage: "initializing" | "processing" | "finalizing" | "complete" | "_error";
  percentage: number;
  estimatedTimeRemaining: string;
  currentStep: string;
  currentImage?: number;
  _totalImages?: number;
  _error?: string;
}

export class ImageGenerationService {
  private outputDir: string;
  private tempDir: string;

  constructor() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const _mariaRoot = resolve(dirname, "../../../../..");
    this.outputDir = join(_mariaRoot, "outputs/images");
    this.tempDir = join(_mariaRoot, "outputs/temp");
  }

  /**
   * 画像生成(Text-to-Image)
   */
  async generateImage(
    prompt: string,
    options: Partial<ImageOptions> = {},
    onProgress?: (_progress: ImageProgress) => void,
  ): Promise<ImageResult> {
    try {
      const _startTime = Date.now();

      // 初期化
      onProgress?.({
        stage: "initializing",
        percentage: 0,
        estimatedTimeRemaining: "計算中...",
        currentStep: "Qwen-Imageモデル確認",
        currentImage: 1,
        _totalImages: options.batch || 1,
      });

      // ComfyUI起動確認
      const _isComfyUIRunning = await modelManager.checkComfyUIStatus();
      if (!_isComfyUIRunning) {
        onProgress?.({
          stage: "initializing",
          percentage: 10,
          estimatedTimeRemaining: "30秒",
          currentStep: "ComfyUI起動中",
          currentImage: 1,
          _totalImages: options.batch || 1,
        });

        const _started = await modelManager.startComfyUI();
        if (!_started) {
          throw new Error("ComfyUIの起動に失敗しました");
        }
      }

      // Qwen-Imageモデル確認
      onProgress?.({
        stage: "initializing",
        percentage: 20,
        estimatedTimeRemaining: this.estimateGenerationTime(options.batch || 1),
        currentStep: "Qwen-Imageモデル読み込み",
        currentImage: 1,
        _totalImages: options.batch || 1,
      });

      const _modelInfo = await modelManager.getModelInfo("qwen-image");
      if (!_modelInfo || _modelInfo.status !== "available") {
        throw new Error("Qwen-Imageモデルが利用できません");
      }

      // 出力ディレクトリ準備
      await this.ensureDirectories();

      // バッチ生成またはバリエーション生成
      const _results = await this.generateBatch(prompt, options, onProgress);

      // 最終使用日時更新
      await modelManager.updateLastUsed("qwen-image");

      onProgress?.({
        stage: "complete",
        percentage: 100,
        estimatedTimeRemaining: "完了",
        currentStep: "画像生成完了",
        currentImage: _results.length,
        _totalImages: _results.length,
      });

      // メタデータ生成
      const _metadata = this.generateMetadata(
        options,
        Date.now() - _startTime,
        _results.length,
      );

      return {
        success: true,
        outputPaths: _results,
        _metadata,
      };
    } catch (_error: unknown) {
      onProgress?.({
        stage: "_error",
        percentage: 0,
        estimatedTimeRemaining: "",
        currentStep: "エラー発生",
        _error: _error instanceof Error ? _error.message : String(_error),
      });

      return {
        success: false,
        _error: _error instanceof Error ? _error.message : String(_error),
      };
    }
  }

  /**
   * バッチ画像生成
   */
  private async generateBatch(
    prompt: string,
    options: Partial<ImageOptions>,
    onProgress?: (_progress: ImageProgress) => void,
  ): Promise<string[]> {
    const _batchSize = options.batch || 1;
    const _variations = options._variations || 1;
    const _totalImages = _batchSize * _variations;
    const _results: string[] = [];

    let currentImageIndex = 0;

    // バリエーション用プロンプト生成
    const _prompts = this.generatePromptVariations(prompt, _variations);

    for (let batchIndex = 0; batchIndex < _batchSize; batchIndex++) {
      for (
        let variationIndex = 0;
        variationIndex < _variations;
        variationIndex++
      ) {
        currentImageIndex++;
        const _currentPrompt = _prompts[variationIndex] || prompt;

        onProgress?.({
          stage: "processing",
          percentage: Math.min(
            90,
            30 + (currentImageIndex / _totalImages) * 60,
          ),
          estimatedTimeRemaining: this.estimateRemainingTime(
            currentImageIndex,
            _totalImages,
            Date.now(),
          ),
          currentStep: `画像生成中 (${currentImageIndex}/${_totalImages})`,
          currentImage: currentImageIndex,
          _totalImages,
        });

        // 単一画像生成
        const _imagePath = await this.generateSingleImage(
          _currentPrompt,
          options,
          batchIndex,
          variationIndex,
        );

        results.push(_imagePath);

        // 短い待機(API制限回避)
        if (currentImageIndex < _totalImages) {
          await new Promise((resolveInner) => setTimeout(resolve, 1000));
        }
      }
    }

    return _results;
  }

  /**
   * 単一画像生成
   */
  private async generateSingleImage(
    prompt: string,
    options: Partial<ImageOptions>,
    batchIndex: number,
    variationIndex: number,
  ): Promise<string> {
    // 出力ファイル名生成
    const _timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const __filename = `maria_image_${_timestamp}_${batchIndex}_${variationIndex}.png`;
    const _outputPath = join(this.outputDir, __filename);

    // ワークフロー読み込み
    const _workflowData = await modelManager.loadWorkflow("qwen_image");

    // パラメータ設定
    const _size = this.parseImageSize(options._size);
    const generationParams: GenerationOptions = {
      model: "qwen-image",
      prompt,
      width: _size.width,
      height: _size.height,
      steps: options.steps || 30,
      guidance: options.guidance || 7.5,
      seed: options.seed || Math.floor(Math.random() * 1000000),
      style: options.style || "photorealistic",
      _outputPath: filename.replace(".png", ""),
    };

    // ワークフロー実行
    const _processedWorkflow = modelManager.replaceWorkflowParameters(
      (_workflowData as { workflow: unknown }).workflow,
      generationParams,
    );

    const _promptId = await modelManager.executeWorkflow(_processedWorkflow);

    // 生成完了待機
    await this.waitForImageCompletion(_promptId);

    // ComfyUI出力からファイル移動
    await this.moveImageOutput(_outputPath);

    return _outputPath;
  }

  /**
   * プロンプトバリエーション生成
   */
  private generatePromptVariations(
    _basePrompt: string,
    count: number,
  ): string[] {
    if (count === 1) {
      return [_basePrompt];
    }

    const _variations: string[] = [_basePrompt];

    // 基本的なバリエーション生成ロジック
    const _modifiers = [
      "highly detailed",
      "masterpiece quality",
      "professional lighting",
      "vibrant colors",
      "sharp focus",
      "cinematic composition",
      "award winning",
      "trending on artstation",
    ];

    for (let i = 1; i < count; i++) {
      const _modifier = _modifiers[i % _modifiers.length];
      variations.push(`${_basePrompt}, ${_modifier}`);
    }

    return _variations;
  }

  /**
   * スタイル適用
   */
  async applyStyle(
    prompt: string,
    style: ImageOptions["style"],
    options: Partial<Omit<ImageOptions, "style">> = {},
  ): Promise<ImageResult> {
    const _stylePrompts = this.getStylePrompt(style || "photorealistic");
    const _enhancedPrompt = `${prompt}, ${_stylePrompts}`;

    return await this.generateImage(_enhancedPrompt, {
      ...options,
      style,
    });
  }

  /**
   * 複数スタイル比較生成
   */
  async generateStyleComparison(
    prompt: string,
    styles: ImageOptions["style"][],
    options: Partial<Omit<ImageOptions, "style">> = {},
  ): Promise<{ [style: string]: ImageResult }> {
    const _results: { [style: string]: ImageResult } = {};

    for (const style of styles) {
      if (style) {
        console.log(`🎨 ${style} スタイルで生成中...`);
        _results[style] = await this.applyStyle(prompt, style, options);
      }
    }

    return _results;
  }

  /**
   * 画像アップスケール(将来実装)
   */
  async upscaleImage(
    _imagePath: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _scaleFactor: number = 2,
  ): Promise<ImageResult> {
    // TODO: Real-ESRGANやWAIFU2X統合
    return {
      success: false,
      _error: "アップスケール機能は未実装です",
    };
  }

  /**
   * 画像バリエーション生成(将来実装)
   */
  async generateVariations(
    _imagePath: string,
    _prompt: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _count: number = 4,
  ): Promise<ImageResult> {
    // TODO: Image-to-Image variationの実装
    return {
      success: false,
      _error: "バリエーション生成機能は未実装です",
    };
  }

  /**
   * プライベートメソッド
   */
  private async waitForImageCompletion(_promptId: string): Promise<void> {
    const _maxWaitTime = 5 * 60 * 1000; // 5分タイムアウト
    const _checkInterval = 2000; // 2秒間隔
    const _startTime = Date.now();

    while (Date.now() - _startTime < _maxWaitTime) {
      const _status = await modelManager.checkProgress(_promptId);

      if (_status.completed) {
        return;
      }

      if (_status.error) {
        throw new Error(`画像生成エラー: ${_status.error}`);
      }

      await new Promise((resolveInner) => setTimeout(resolve, _checkInterval));
    }

    throw new Error("画像生成がタイムアウトしました");
  }

  private async moveImageOutput(targetPath: string): Promise<void> {
    // TODO: ComfyUIの出力ディレクトリからtargetPathへファイル移動
    // 現在はプレースホルダー実装
    console.log(`画像出力を ${targetPath} に移動準備中...`);
  }

  private parseImageSize(_size?: string): { width: number; height: number } {
    switch (_size) {
      case "512x512":
        return { width: 512, height: 512 };
      case "768x768":
        return { width: 768, height: 768 };
      case "1024x1024":
        return { width: 1024, height: 1024 };
      case "1024x768":
        return { width: 1024, height: 768 };
      case "768x1024":
        return { width: 768, height: 1024 };
      default:
        return { width: 1024, height: 1024 };
    }
  }

  private getStylePrompt(style: ImageOptions["style"]): string {
    switch (style) {
      case "photorealistic":
        return "photorealistic, high resolution, detailed, professional photography";
      case "artistic":
        return "artistic, painterly style, creative, expressive, fine art";
      case "anime":
        return "anime style, manga, cel shading, vibrant colors, Japanese art";
      case "concept":
        return "concept art, digital painting, matte painting, cinematic";
      case "technical":
        return "technical illustration, clean lines, precise, schematic style";
      default:
        return "high quality, detailed";
    }
  }

  private estimateGenerationTime(_batchSize: number): string {
    const _timePerImage = 45; // 秒
    const _totalSeconds = _batchSize * _timePerImage;

    if (_totalSeconds < 60) {
      return `${_totalSeconds}秒`;
    } else {
      return `${Math.ceil(_totalSeconds / 60)}分`;
    }
  }

  private estimateRemainingTime(
    currentImage: number,
    _totalImages: number,
    _startTime: number,
  ): string {
    const _elapsed = Date.now() - _startTime;
    const _avgTimePerImage = _elapsed / currentImage;
    const _remainingImages = _totalImages - currentImage;
    const _remainingMs = _remainingImages * _avgTimePerImage;

    if (_remainingMs < 60000) {
      return `${Math.ceil(_remainingMs / 1000)}秒`;
    } else {
      return `${Math.ceil(_remainingMs / 60000)}分`;
    }
  }

  private generateMetadata(
    _options: Partial<ImageOptions>,
    generationTime: number,
    imageCount: number,
  ): ImageResult["_metadata"] {
    const _size = this.parseImageSize(_options._size);

    return {
      resolution: `${_size.width}x${_size.height}`,
      style: _options.style || "photorealistic",
      modelUsed: "qwen-image",
      generationTime: Math.round(generationTime / 1000),
      seedUsed: _options.seed || -1,
      _batchSize: imageCount,
    };
  }

  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.outputDir, { recursive: true });
    await fs.mkdir(this.tempDir, { recursive: true });
  }
}

// シングルトンインスタンス
export const _imageGenerationService = new ImageGenerationService();
