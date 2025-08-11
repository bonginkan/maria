import { modelManager, GenerationOptions } from './model-manager';
import { promises as fs } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

export interface ImageOptions extends GenerationOptions {
  style?: 'photorealistic' | 'artistic' | 'anime' | 'concept' | 'technical';
  quality?: 'low' | 'medium' | 'high';
  batch?: number;
  variations?: number;
  size?: '512x512' | '768x768' | '1024x1024' | '1024x768' | '768x1024';
}

export interface ImageResult {
  success: boolean;
  outputPaths?: string[];
  error?: string;
  metadata?: {
    resolution: string;
    style: string;
    modelUsed: string;
    generationTime: number;
    seedUsed: number;
    batchSize: number;
  };
}

export interface ImageProgress {
  stage: 'initializing' | 'processing' | 'finalizing' | 'complete' | 'error';
  percentage: number;
  estimatedTimeRemaining: string;
  currentStep: string;
  currentImage?: number;
  totalImages?: number;
  error?: string;
}

export class ImageGenerationService {
  private outputDir: string;
  private tempDir: string;

  constructor() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const mariaRoot = resolve(__dirname, '../../../../..');
    this.outputDir = join(mariaRoot, 'outputs/images');
    this.tempDir = join(mariaRoot, 'outputs/temp');
  }

  /**
   * 画像生成（Text-to-Image）
   */
  async generateImage(
    prompt: string,
    options: Partial<ImageOptions> = {},
    onProgress?: (progress: ImageProgress) => void,
  ): Promise<ImageResult> {
    try {
      const startTime = Date.now();

      // 初期化
      onProgress?.({
        stage: 'initializing',
        percentage: 0,
        estimatedTimeRemaining: '計算中...',
        currentStep: 'Qwen-Imageモデル確認',
        currentImage: 1,
        totalImages: options.batch || 1,
      });

      // ComfyUI起動確認
      const isComfyUIRunning = await modelManager.checkComfyUIStatus();
      if (!isComfyUIRunning) {
        onProgress?.({
          stage: 'initializing',
          percentage: 10,
          estimatedTimeRemaining: '30秒',
          currentStep: 'ComfyUI起動中',
          currentImage: 1,
          totalImages: options.batch || 1,
        });

        const started = await modelManager.startComfyUI();
        if (!started) {
          throw new Error('ComfyUIの起動に失敗しました');
        }
      }

      // Qwen-Imageモデル確認
      onProgress?.({
        stage: 'initializing',
        percentage: 20,
        estimatedTimeRemaining: this.estimateGenerationTime(options.batch || 1),
        currentStep: 'Qwen-Imageモデル読み込み',
        currentImage: 1,
        totalImages: options.batch || 1,
      });

      const modelInfo = await modelManager.getModelInfo('qwen-image');
      if (!modelInfo || modelInfo.status !== 'available') {
        throw new Error('Qwen-Imageモデルが利用できません');
      }

      // 出力ディレクトリ準備
      await this.ensureDirectories();

      // バッチ生成またはバリエーション生成
      const results = await this.generateBatch(prompt, options, onProgress);

      // 最終使用日時更新
      await modelManager.updateLastUsed('qwen-image');

      onProgress?.({
        stage: 'complete',
        percentage: 100,
        estimatedTimeRemaining: '完了',
        currentStep: '画像生成完了',
        currentImage: results.length,
        totalImages: results.length,
      });

      // メタデータ生成
      const metadata = this.generateMetadata(options, Date.now() - startTime, results.length);

      return {
        success: true,
        outputPaths: results,
        metadata,
      };
    } catch (error) {
      onProgress?.({
        stage: 'error',
        percentage: 0,
        estimatedTimeRemaining: '',
        currentStep: 'エラー発生',
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * バッチ画像生成
   */
  private async generateBatch(
    prompt: string,
    options: Partial<ImageOptions>,
    onProgress?: (progress: ImageProgress) => void,
  ): Promise<string[]> {
    const batchSize = options.batch || 1;
    const variations = options.variations || 1;
    const totalImages = batchSize * variations;
    const results: string[] = [];

    let currentImageIndex = 0;

    // バリエーション用プロンプト生成
    const prompts = this.generatePromptVariations(prompt, variations);

    for (let batchIndex = 0; batchIndex < batchSize; batchIndex++) {
      for (let variationIndex = 0; variationIndex < variations; variationIndex++) {
        currentImageIndex++;
        const currentPrompt = prompts[variationIndex] || prompt;

        onProgress?.({
          stage: 'processing',
          percentage: Math.min(90, 30 + (currentImageIndex / totalImages) * 60),
          estimatedTimeRemaining: this.estimateRemainingTime(
            currentImageIndex,
            totalImages,
            Date.now(),
          ),
          currentStep: `画像生成中 (${currentImageIndex}/${totalImages})`,
          currentImage: currentImageIndex,
          totalImages,
        });

        // 単一画像生成
        const imagePath = await this.generateSingleImage(
          currentPrompt,
          options,
          batchIndex,
          variationIndex,
        );

        results.push(imagePath);

        // 短い待機（API制限回避）
        if (currentImageIndex < totalImages) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    return results;
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
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `maria_image_${timestamp}_${batchIndex}_${variationIndex}.png`;
    const outputPath = join(this.outputDir, filename);

    // ワークフロー読み込み
    const workflowData = await modelManager.loadWorkflow('qwen_image');

    // パラメータ設定
    const size = this.parseImageSize(options.size);
    const generationParams: GenerationOptions = {
      model: 'qwen-image',
      prompt,
      width: size.width,
      height: size.height,
      steps: options.steps || 30,
      guidance: options.guidance || 7.5,
      seed: options.seed || Math.floor(Math.random() * 1000000),
      style: options.style || 'photorealistic',
      outputPath: filename.replace('.png', ''),
    };

    // ワークフロー実行
    const processedWorkflow = modelManager.replaceWorkflowParameters(
      workflowData.workflow,
      generationParams,
    );

    const promptId = await modelManager.executeWorkflow(processedWorkflow);

    // 生成完了待機
    await this.waitForImageCompletion(promptId);

    // ComfyUI出力からファイル移動
    await this.moveImageOutput(outputPath);

    return outputPath;
  }

  /**
   * プロンプトバリエーション生成
   */
  private generatePromptVariations(basePrompt: string, count: number): string[] {
    if (count === 1) {
      return [basePrompt];
    }

    const variations: string[] = [basePrompt];

    // 基本的なバリエーション生成ロジック
    const modifiers = [
      'highly detailed',
      'masterpiece quality',
      'professional lighting',
      'vibrant colors',
      'sharp focus',
      'cinematic composition',
      'award winning',
      'trending on artstation',
    ];

    for (let i = 1; i < count; i++) {
      const modifier = modifiers[i % modifiers.length];
      variations.push(`${basePrompt}, ${modifier}`);
    }

    return variations;
  }

  /**
   * スタイル適用
   */
  async applyStyle(
    prompt: string,
    style: ImageOptions['style'],
    options: Partial<Omit<ImageOptions, 'style'>> = {},
  ): Promise<ImageResult> {
    const stylePrompts = this.getStylePrompt(style || 'photorealistic');
    const enhancedPrompt = `${prompt}, ${stylePrompts}`;

    return await this.generateImage(enhancedPrompt, {
      ...options,
      style,
    });
  }

  /**
   * 複数スタイル比較生成
   */
  async generateStyleComparison(
    prompt: string,
    styles: ImageOptions['style'][],
    options: Partial<Omit<ImageOptions, 'style'>> = {},
  ): Promise<{ [style: string]: ImageResult }> {
    const results: { [style: string]: ImageResult } = {};

    for (const style of styles) {
      if (style) {
        console.log(`🎨 ${style} スタイルで生成中...`);
        results[style] = await this.applyStyle(prompt, style, options);
      }
    }

    return results;
  }

  /**
   * 画像アップスケール（将来実装）
   */
  async upscaleImage(
    _imagePath: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _scaleFactor: number = 2,
  ): Promise<ImageResult> {
    // TODO: Real-ESRGANやWAIFU2X統合
    return {
      success: false,
      error: 'アップスケール機能は未実装です',
    };
  }

  /**
   * 画像バリエーション生成（将来実装）
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
      error: 'バリエーション生成機能は未実装です',
    };
  }

  /**
   * プライベートメソッド
   */
  private async waitForImageCompletion(promptId: string): Promise<void> {
    const maxWaitTime = 5 * 60 * 1000; // 5分タイムアウト
    const checkInterval = 2000; // 2秒間隔
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const status = await modelManager.checkProgress(promptId);

      if (status.completed) {
        return;
      }

      if (status.error) {
        throw new Error(`画像生成エラー: ${status.error}`);
      }

      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    throw new Error('画像生成がタイムアウトしました');
  }

  private async moveImageOutput(targetPath: string): Promise<void> {
    // TODO: ComfyUIの出力ディレクトリからtargetPathへファイル移動
    // 現在はプレースホルダー実装
    console.log(`画像出力を ${targetPath} に移動準備中...`);
  }

  private parseImageSize(size?: string): { width: number; height: number } {
    switch (size) {
      case '512x512':
        return { width: 512, height: 512 };
      case '768x768':
        return { width: 768, height: 768 };
      case '1024x1024':
        return { width: 1024, height: 1024 };
      case '1024x768':
        return { width: 1024, height: 768 };
      case '768x1024':
        return { width: 768, height: 1024 };
      default:
        return { width: 1024, height: 1024 };
    }
  }

  private getStylePrompt(style: ImageOptions['style']): string {
    switch (style) {
      case 'photorealistic':
        return 'photorealistic, high resolution, detailed, professional photography';
      case 'artistic':
        return 'artistic, painterly style, creative, expressive, fine art';
      case 'anime':
        return 'anime style, manga, cel shading, vibrant colors, Japanese art';
      case 'concept':
        return 'concept art, digital painting, matte painting, cinematic';
      case 'technical':
        return 'technical illustration, clean lines, precise, schematic style';
      default:
        return 'high quality, detailed';
    }
  }

  private estimateGenerationTime(batchSize: number): string {
    const timePerImage = 45; // 秒
    const totalSeconds = batchSize * timePerImage;

    if (totalSeconds < 60) {
      return `${totalSeconds}秒`;
    } else {
      return `${Math.ceil(totalSeconds / 60)}分`;
    }
  }

  private estimateRemainingTime(
    currentImage: number,
    totalImages: number,
    startTime: number,
  ): string {
    const elapsed = Date.now() - startTime;
    const avgTimePerImage = elapsed / currentImage;
    const remainingImages = totalImages - currentImage;
    const remainingMs = remainingImages * avgTimePerImage;

    if (remainingMs < 60000) {
      return `${Math.ceil(remainingMs / 1000)}秒`;
    } else {
      return `${Math.ceil(remainingMs / 60000)}分`;
    }
  }

  private generateMetadata(
    options: Partial<ImageOptions>,
    generationTime: number,
    imageCount: number,
  ): ImageResult['metadata'] {
    const size = this.parseImageSize(options.size);

    return {
      resolution: `${size.width}x${size.height}`,
      style: options.style || 'photorealistic',
      modelUsed: 'qwen-image',
      generationTime: Math.round(generationTime / 1000),
      seedUsed: options.seed || -1,
      batchSize: imageCount,
    };
  }

  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.outputDir, { recursive: true });
    await fs.mkdir(this.tempDir, { recursive: true });
  }
}

// シングルトンインスタンス
export const imageGenerationService = new ImageGenerationService();
