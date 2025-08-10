import { modelManager, GenerationOptions } from './model-manager';
import { promises as fs } from 'fs';
import { join, resolve, extname, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

export interface VideoOptions extends GenerationOptions {
  model: 'wan22-5b' | 'wan22-14b';
  fps?: number;
  frames?: number;
  resolution?: '720p' | '1080p' | '1280x720' | '1920x1080';
  compare?: boolean;
}

export interface VideoResult {
  success: boolean;
  outputPath?: string;
  comparisonPath?: string;
  error?: string;
  metadata?: {
    duration: number;
    fps: number;
    resolution: string;
    modelUsed: string;
    generationTime: number;
  };
}

export interface GenerationProgress {
  stage: 'initializing' | 'processing' | 'finalizing' | 'complete' | 'error';
  percentage: number;
  estimatedTimeRemaining: string;
  currentStep: string;
  totalSteps: number;
  error?: string;
}

export class VideoGenerationService {
  private outputDir: string;
  private tempDir: string;
  
  constructor() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const mariaRoot = resolve(__dirname, '../../../../..');
    this.outputDir = join(mariaRoot, 'outputs/videos');
    this.tempDir = join(mariaRoot, 'outputs/temp');
  }

  /**
   * 動画生成（Text-to-Video）
   */
  async generateVideo(
    prompt: string, 
    options: VideoOptions,
    onProgress?: (progress: GenerationProgress) => void
  ): Promise<VideoResult> {
    try {
      // 初期化
      onProgress?.({
        stage: 'initializing',
        percentage: 0,
        estimatedTimeRemaining: '計算中...',
        currentStep: 'ComfyUI起動確認',
        totalSteps: 4
      });

      // ComfyUI起動確認
      const isComfyUIRunning = await modelManager.checkComfyUIStatus();
      if (!isComfyUIRunning) {
        onProgress?.({
          stage: 'initializing',
          percentage: 10,
          estimatedTimeRemaining: '30秒',
          currentStep: 'ComfyUI起動中',
          totalSteps: 4
        });
        
        const started = await modelManager.startComfyUI();
        if (!started) {
          throw new Error('ComfyUIの起動に失敗しました');
        }
      }

      // モデル可用性確認
      onProgress?.({
        stage: 'initializing',
        percentage: 25,
        estimatedTimeRemaining: options.model === 'wan22-14b' ? '10-15分' : '3-7分',
        currentStep: 'モデル読み込み確認',
        totalSteps: 4
      });

      const modelInfo = await modelManager.getModelInfo(options.model);
      if (!modelInfo || modelInfo.status !== 'available') {
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

    } catch (error) {
      onProgress?.({
        stage: 'error',
        percentage: 0,
        estimatedTimeRemaining: '',
        currentStep: 'エラー発生',
        totalSteps: 0,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 単一モデルで動画生成
   */
  private async generateSingle(
    prompt: string,
    options: VideoOptions,
    onProgress?: (progress: GenerationProgress) => void
  ): Promise<VideoResult> {
    const startTime = Date.now();
    const outputFilename = this.generateOutputFilename(options.model);
    const outputPath = join(this.outputDir, outputFilename);

    try {
      // ワークフロー選択
      const modelMap: Record<string, string> = {
        'wan22-5b': 'wan22_5b',
        'wan22-14b': 'wan22_14b'
      };
      const normalizedModel = modelMap[options.model] || options.model;
      const workflowId = options.inputImage 
        ? `${normalizedModel}_i2v`
        : `${normalizedModel}_t2v`;

      onProgress?.({
        stage: 'processing',
        percentage: 30,
        estimatedTimeRemaining: this.estimateGenerationTime(options.model),
        currentStep: 'ワークフロー準備',
        totalSteps: 4
      });

      // ワークフロー読み込み
      const workflowData = await modelManager.loadWorkflow(workflowId);
      
      // パラメータ設定
      const generationParams: GenerationOptions = {
        model: options.model,
        prompt,
        width: this.parseResolution(options.resolution).width,
        height: this.parseResolution(options.resolution).height,
        steps: options.steps || (options.model === 'wan22-14b' ? 50 : 30),
        seed: options.seed,
        inputImage: options.inputImage,
        outputPath: outputFilename.replace('.mp4', '')
      };

      // ワークフロー実行
      onProgress?.({
        stage: 'processing',
        percentage: 50,
        estimatedTimeRemaining: this.estimateGenerationTime(options.model),
        currentStep: `${options.model} モデルで生成中`,
        totalSteps: 4
      });

      const processedWorkflow = modelManager.replaceWorkflowParameters(
        workflowData.workflow,
        generationParams
      );

      const promptId = await modelManager.executeWorkflow(processedWorkflow);

      // 生成完了待機
      await this.waitForCompletion(promptId, onProgress);

      // 後処理
      onProgress?.({
        stage: 'finalizing',
        percentage: 90,
        estimatedTimeRemaining: '30秒',
        currentStep: '出力ファイル処理',
        totalSteps: 4
      });

      // ComfyUI出力からファイル移動
      await this.moveOutputFiles(outputPath);

      // メタデータ生成
      const metadata = await this.generateMetadata(
        outputPath,
        options.model,
        Date.now() - startTime
      );

      // 最終使用日時更新
      await modelManager.updateLastUsed(options.model);

      onProgress?.({
        stage: 'complete',
        percentage: 100,
        estimatedTimeRemaining: '完了',
        currentStep: '動画生成完了',
        totalSteps: 4
      });

      return {
        success: true,
        outputPath,
        metadata
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 比較動画生成（5B vs 14B）
   */
  private async generateComparison(
    prompt: string,
    options: VideoOptions,
    onProgress?: (progress: GenerationProgress) => void
  ): Promise<VideoResult> {
    try {
      onProgress?.({
        stage: 'processing',
        percentage: 10,
        estimatedTimeRemaining: '15-20分',
        currentStep: '5Bモデルで生成中',
        totalSteps: 6
      });

      // 5Bモデルで生成
      const options5B: VideoOptions = { ...options, model: 'wan22-5b', compare: false };
      const result5B = await this.generateSingle(prompt, options5B);

      if (!result5B.success) {
        throw new Error(`5Bモデル生成エラー: ${result5B.error}`);
      }

      onProgress?.({
        stage: 'processing',
        percentage: 40,
        estimatedTimeRemaining: '10-15分',
        currentStep: '14Bモデルで生成中',
        totalSteps: 6
      });

      // 14Bモデルで生成
      const options14B: VideoOptions = { ...options, model: 'wan22-14b', compare: false };
      const result14B = await this.generateSingle(prompt, options14B);

      if (!result14B.success) {
        throw new Error(`14Bモデル生成エラー: ${result14B.error}`);
      }

      onProgress?.({
        stage: 'finalizing',
        percentage: 80,
        estimatedTimeRemaining: '2-3分',
        currentStep: '比較動画作成中',
        totalSteps: 6
      });

      // 横並び比較動画作成
      const comparisonPath = await this.createComparisonVideo(
        result5B.outputPath!,
        result14B.outputPath!
      );

      onProgress?.({
        stage: 'complete',
        percentage: 100,
        estimatedTimeRemaining: '完了',
        currentStep: '比較動画生成完了',
        totalSteps: 6
      });

      return {
        success: true,
        outputPath: result14B.outputPath, // メイン出力は14B
        comparisonPath,
        metadata: result14B.metadata
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 生成完了待機
   */
  private async waitForCompletion(
    promptId: string,
    onProgress?: (progress: GenerationProgress) => void
  ): Promise<void> {
    const maxWaitTime = 20 * 60 * 1000; // 20分タイムアウト
    const checkInterval = 5000; // 5秒間隔
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const status = await modelManager.checkProgress(promptId);
      
      if (status.completed) {
        return;
      }
      
      if (status.error) {
        throw new Error(`生成エラー: ${status.error}`);
      }

      // 進捗更新
      if (onProgress && status.progress !== undefined) {
        const elapsedMinutes = (Date.now() - startTime) / 60000;
        const progressPercent = Math.min(75, 50 + (status.progress * 25));
        
        onProgress({
          stage: 'processing',
          percentage: progressPercent,
          estimatedTimeRemaining: `残り ${Math.max(1, Math.ceil(15 - elapsedMinutes))} 分`,
          currentStep: '動画生成処理中',
          totalSteps: 4
        });
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    throw new Error('動画生成がタイムアウトしました');
  }

  /**
   * 比較動画作成（ffmpeg使用）
   */
  private async createComparisonVideo(leftVideo: string, rightVideo: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = join(this.outputDir, `comparison_${timestamp}.mp4`);

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y', // 上書き
        '-i', leftVideo,  // 左側動画（5B）
        '-i', rightVideo, // 右側動画（14B）
        '-filter_complex', 
        '[0:v]scale=640:360[left];[1:v]scale=640:360[right];[left][right]hstack=inputs=2[v]',
        '-map', '[v]',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-crf', '23',
        outputPath
      ]);

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error(`ffmpeg終了コード: ${code}`));
        }
      });

      ffmpeg.on('error', (error) => {
        reject(new Error(`ffmpeg実行エラー: ${error.message}`));
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
    const __dirname = dirname(__filename);
    const _comfyUIOutputDir = resolve(__dirname, '../../../../comfyui/output');
    void _comfyUIOutputDir; // Will be used for actual ComfyUI integration
    
    try {
      // 最新の出力ファイルを検索してコピー
      // 実装が必要: ComfyUIの実際の出力パスに応じて調整
      console.log(`出力ファイルを ${targetPath} に移動準備中...`);
    } catch (error) {
      console.warn('出力ファイル移動警告:', error);
    }
  }

  /**
   * メタデータ生成
   */
  private async generateMetadata(
    _outputPath: string,
    modelUsed: string,
    generationTime: number
  ): Promise<VideoResult['metadata']> {
    // TODO: 実際の動画ファイルからメタデータを取得
    return {
      duration: 2.0, // 秒
      fps: 24,
      resolution: '1280x720',
      modelUsed,
      generationTime: Math.round(generationTime / 1000) // 秒単位
    };
  }

  /**
   * ユーティリティメソッド
   */
  private parseResolution(resolution?: string): { width: number; height: number } {
    switch (resolution) {
      case '720p':
      case '1280x720':
        return { width: 1280, height: 720 };
      case '1080p':
      case '1920x1080':
        return { width: 1920, height: 1080 };
      default:
        return { width: 1280, height: 720 };
    }
  }

  private estimateGenerationTime(model: string): string {
    return model === 'wan22-14b' ? '5-15分' : '2-7分';
  }

  private generateOutputFilename(model: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `maria_video_${model}_${timestamp}.mp4`;
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
    options: Omit<VideoOptions, 'inputImage'>
  ): Promise<VideoResult> {
    // 画像ファイル存在確認
    try {
      await fs.access(imagePath);
    } catch {
      return {
        success: false,
        error: `入力画像が見つかりません: ${imagePath}`
      };
    }

    // 対応フォーマット確認
    const ext = extname(imagePath).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.bmp'].includes(ext)) {
      return {
        success: false,
        error: `対応していない画像フォーマット: ${ext}`
      };
    }

    return await this.generateVideo(prompt, {
      ...options,
      inputImage: imagePath
    });
  }
}

// シングルトンインスタンス
export const videoGenerationService = new VideoGenerationService();