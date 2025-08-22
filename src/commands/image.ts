import chalk from 'chalk';
import { imageGenerationService, ImageOptions, ImageProgress } from '../services/image-generation';

interface ImageCommandProps {
  prompt: string;
  style?: 'photorealistic' | 'artistic' | 'anime' | 'concept' | 'technical';
  size?: '512x512' | '768x768' | '1024x1024' | '1024x768' | '768x1024';
  quality?: 'low' | 'medium' | 'high';
  guidance?: number;
  steps?: number;
  batch?: number;
  variations?: number;
  seed?: number;
  outputPath?: string;
}

class ImageCommand {
  private progress: ImageProgress | null = null;
  private startTime = 0;
  private progressInterval: NodeJS.Timeout | null = null;

  constructor(private props: ImageCommandProps) {}

  async execute(): Promise<void> {
    const {
      prompt,
      style = 'photorealistic',
      size = '1024x1024',
      quality = 'high',
      guidance = 7.5,
      steps = 30,
      batch = 1,
      variations = 1,
      seed,
      outputPath,
    } = this.props;

    this.showHeader(prompt, style, size, quality, batch, variations);
    this.showStyleInfo(style);

    console.log(chalk.blue('🚀 画像生成を開始しています...'));
    console.log();

    // Starting generation
    this.startTime = Date.now();

    const options: ImageOptions = {
      model: 'qwen-image',
      prompt,
      style,
      size,
      quality,
      guidance,
      steps,
      batch,
      variations,
      seed: seed || Math.floor(Math.random() * 1000000),
      outputPath,
    };

    try {
      const result = await imageGenerationService.generateImage(prompt, options, (progressUpdate) =>
        this.updateProgress(progressUpdate),
      );

      this.stopProgressDisplay();
      this.showResult(result, style, size);
    } catch (error: unknown) {
      this.stopProgressDisplay();
      this.showError(error instanceof Error ? error.message : String(error));
    } finally {
      // Generation completed
    }
  }

  private showHeader(
    prompt: string,
    style: string,
    size: string,
    quality: string,
    batch: number,
    variations: number,
  ): void {
    console.log(chalk.blue.bold('🖼️ AI画像生成'));
    console.log(chalk.gray(`プロンプト: ${prompt}`));
    console.log();
    console.log(`${chalk.cyan('📊 設定:')  } スタイル=${style} サイズ=${size} 品質=${quality}`);

    if (batch > 1 || variations > 1) {
      console.log(chalk.yellow(`📦 バッチ生成: ${batch}×${variations} = ${batch * variations}枚`));
    }
    console.log();
  }

  private showStyleInfo(style: string): void {
    const styleDescriptions = {
      photorealistic: '写真のような高解像度でリアルな表現',
      artistic: '芸術的で表現豊かなペイント風',
      anime: 'アニメ・漫画スタイル、セルシェーディング',
      concept: 'コンセプトアート風のシネマティック表現',
      technical: '技術図面のような清潔で正確な線画',
    };

    console.log(chalk.gray(`🎨 ${styleDescriptions[style as keyof typeof styleDescriptions]}`));
    console.log();
  }

  private updateProgress(progressUpdate: ImageProgress): void {
    this.progress = progressUpdate;

    if (!this.progressInterval) {
      this.startProgressDisplay();
    }
  }

  private startProgressDisplay(): void {
    // Clear any existing intervals
    this.stopProgressDisplay();

    // Create spinner animation
    const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let spinnerIndex = 0;

    this.progressInterval = setInterval(() => {
      if (!this.progress) {return;}

      // Clear current line and move cursor to beginning
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);

      // Show spinner and progress
      const spinner = chalk.cyan(spinnerChars[spinnerIndex]);
      const stage = this.progress.stage;
      const percentage = this.progress.percentage;

      process.stdout.write(`${spinner} ${stage} (${percentage}%)`);

      if (this.progress.currentStep) {
        process.stdout.write(chalk.gray(` - Step: ${this.progress.currentStep}`));
      }

      if (this.progress.estimatedTimeRemaining) {
        process.stdout.write(chalk.gray(` - ETA: ${this.progress.estimatedTimeRemaining}s`));
      }

      // Show current image progress for batch
      if (
        this.progress.currentImage &&
        this.progress.totalImages &&
        this.progress.totalImages > 1
      ) {
        process.stdout.write(
          chalk.blue(` - 画像 ${this.progress.currentImage}/${this.progress.totalImages}`),
        );
      }

      // Show error if present
      if (this.progress.error) {
        process.stdout.write(chalk.red(` - エラー: ${this.progress.error}`));
      }

      spinnerIndex = (spinnerIndex + 1) % spinnerChars.length;
    }, 100);
  }

  private stopProgressDisplay(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }

    // Clear the progress line
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
  }

  private showResult(
    result: {
      success: boolean;
      outputPaths?: string[];
      error?: string;
      metadata?: unknown;
    },
    style: string,
    size: string,
  ): void {
    if (result.success && result.outputPaths) {
      const duration = Math.round((Date.now() - this.startTime) / 1000);

      console.log(chalk.green.bold('✨ 画像生成完了！'));
      console.log();

      console.log(chalk.cyan(`📁 出力ファイル (${result.outputPaths.length}枚):`));

      // Show up to 3 files, then indicate if there are more
      result.outputPaths.slice(0, 3).forEach((path) => {
        console.log(chalk.gray(' • ') + path);
      });

      if (result.outputPaths.length > 3) {
        console.log(chalk.gray(` ... 他 ${result.outputPaths.length - 3} ファイル`));
      }

      console.log();
      console.log(
        chalk.gray(`⏱️ 生成時間: ${duration}秒`) +
          chalk.gray(` | スタイル: ${style}`) +
          chalk.gray(` | 解像度: ${size}`),
      );

      if (result.metadata && typeof result.metadata === 'object') {
        console.log();
        console.log(chalk.cyan('📋 メタデータ:'));
        const metadata = result.metadata as { seedUsed?: unknown; modelUsed?: unknown };
        console.log(`  シード: ${String(metadata.seedUsed || 'N/A')}`);
        console.log(`  モデル: ${String(metadata.modelUsed || 'N/A')}`);
      }

      console.log();
      console.log(
        `${chalk.green('💡 ヒント:')  } 画像ファイルをダブルクリックしてプレビューできます`,
      );
    } else {
      this.showError(result.error || '不明なエラー');
    }
  }

  private showError(error: string): void {
    console.log(chalk.red.bold('❌ 画像生成エラー'));
    console.log(chalk.red(error));
    console.log();

    console.log(chalk.yellow('💡 解決策:'));
    console.log(chalk.yellow('• ComfyUIが起動していることを確認'));
    console.log(chalk.yellow('• Qwen-Imageモデルが正しく配置されていることを確認'));
    console.log(chalk.yellow('• プロンプトが適切であることを確認'));
  }
}

// Export function for CLI usage
export async function generateImage(props: ImageCommandProps): Promise<void> {
  const command = new ImageCommand(props);
  await command.execute();
}

// Export for use in slash command handler
export const imageCommand = {
  name: 'image',
  description: 'AI画像生成コマンド',
  execute: generateImage,
};

export default generateImage;
