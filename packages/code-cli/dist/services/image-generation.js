import {
  modelManager
} from "../chunk-J5LY4C2O.js";
import "../chunk-7D4SUZUM.js";

// src/services/image-generation.ts
import { promises as fs } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
var ImageGenerationService = class {
  outputDir;
  tempDir;
  constructor() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const mariaRoot = resolve(__dirname, "../../../../..");
    this.outputDir = join(mariaRoot, "outputs/images");
    this.tempDir = join(mariaRoot, "outputs/temp");
  }
  /**
   * 画像生成（Text-to-Image）
   */
  async generateImage(prompt, options = {}, onProgress) {
    try {
      const startTime = Date.now();
      onProgress?.({
        stage: "initializing",
        percentage: 0,
        estimatedTimeRemaining: "\u8A08\u7B97\u4E2D...",
        currentStep: "Qwen-Image\u30E2\u30C7\u30EB\u78BA\u8A8D",
        currentImage: 1,
        totalImages: options.batch || 1
      });
      const isComfyUIRunning = await modelManager.checkComfyUIStatus();
      if (!isComfyUIRunning) {
        onProgress?.({
          stage: "initializing",
          percentage: 10,
          estimatedTimeRemaining: "30\u79D2",
          currentStep: "ComfyUI\u8D77\u52D5\u4E2D",
          currentImage: 1,
          totalImages: options.batch || 1
        });
        const started = await modelManager.startComfyUI();
        if (!started) {
          throw new Error("ComfyUI\u306E\u8D77\u52D5\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
        }
      }
      onProgress?.({
        stage: "initializing",
        percentage: 20,
        estimatedTimeRemaining: this.estimateGenerationTime(options.batch || 1),
        currentStep: "Qwen-Image\u30E2\u30C7\u30EB\u8AAD\u307F\u8FBC\u307F",
        currentImage: 1,
        totalImages: options.batch || 1
      });
      const modelInfo = await modelManager.getModelInfo("qwen-image");
      if (!modelInfo || modelInfo.status !== "available") {
        throw new Error("Qwen-Image\u30E2\u30C7\u30EB\u304C\u5229\u7528\u3067\u304D\u307E\u305B\u3093");
      }
      await this.ensureDirectories();
      const results = await this.generateBatch(prompt, options, onProgress);
      await modelManager.updateLastUsed("qwen-image");
      onProgress?.({
        stage: "complete",
        percentage: 100,
        estimatedTimeRemaining: "\u5B8C\u4E86",
        currentStep: "\u753B\u50CF\u751F\u6210\u5B8C\u4E86",
        currentImage: results.length,
        totalImages: results.length
      });
      const metadata = this.generateMetadata(
        options,
        Date.now() - startTime,
        results.length
      );
      return {
        success: true,
        outputPaths: results,
        metadata
      };
    } catch (error) {
      onProgress?.({
        stage: "error",
        percentage: 0,
        estimatedTimeRemaining: "",
        currentStep: "\u30A8\u30E9\u30FC\u767A\u751F",
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  /**
   * バッチ画像生成
   */
  async generateBatch(prompt, options, onProgress) {
    const batchSize = options.batch || 1;
    const variations = options.variations || 1;
    const totalImages = batchSize * variations;
    const results = [];
    let currentImageIndex = 0;
    const prompts = this.generatePromptVariations(prompt, variations);
    for (let batchIndex = 0; batchIndex < batchSize; batchIndex++) {
      for (let variationIndex = 0; variationIndex < variations; variationIndex++) {
        currentImageIndex++;
        const currentPrompt = prompts[variationIndex] || prompt;
        onProgress?.({
          stage: "processing",
          percentage: Math.min(90, 30 + currentImageIndex / totalImages * 60),
          estimatedTimeRemaining: this.estimateRemainingTime(
            currentImageIndex,
            totalImages,
            Date.now()
          ),
          currentStep: `\u753B\u50CF\u751F\u6210\u4E2D (${currentImageIndex}/${totalImages})`,
          currentImage: currentImageIndex,
          totalImages
        });
        const imagePath = await this.generateSingleImage(
          currentPrompt,
          options,
          batchIndex,
          variationIndex
        );
        results.push(imagePath);
        if (currentImageIndex < totalImages) {
          await new Promise((resolve2) => setTimeout(resolve2, 1e3));
        }
      }
    }
    return results;
  }
  /**
   * 単一画像生成
   */
  async generateSingleImage(prompt, options, batchIndex, variationIndex) {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    const filename = `maria_image_${timestamp}_${batchIndex}_${variationIndex}.png`;
    const outputPath = join(this.outputDir, filename);
    const workflowData = await modelManager.loadWorkflow("qwen_image");
    const size = this.parseImageSize(options.size);
    const generationParams = {
      model: "qwen-image",
      prompt,
      width: size.width,
      height: size.height,
      steps: options.steps || 30,
      guidance: options.guidance || 7.5,
      seed: options.seed || Math.floor(Math.random() * 1e6),
      style: options.style || "photorealistic",
      outputPath: filename.replace(".png", "")
    };
    const processedWorkflow = modelManager.replaceWorkflowParameters(
      workflowData.workflow,
      generationParams
    );
    const promptId = await modelManager.executeWorkflow(processedWorkflow);
    await this.waitForImageCompletion(promptId);
    await this.moveImageOutput(outputPath);
    return outputPath;
  }
  /**
   * プロンプトバリエーション生成
   */
  generatePromptVariations(basePrompt, count) {
    if (count === 1) {
      return [basePrompt];
    }
    const variations = [basePrompt];
    const modifiers = [
      "highly detailed",
      "masterpiece quality",
      "professional lighting",
      "vibrant colors",
      "sharp focus",
      "cinematic composition",
      "award winning",
      "trending on artstation"
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
  async applyStyle(prompt, style, options = {}) {
    const stylePrompts = this.getStylePrompt(style || "photorealistic");
    const enhancedPrompt = `${prompt}, ${stylePrompts}`;
    return await this.generateImage(enhancedPrompt, {
      ...options,
      style
    });
  }
  /**
   * 複数スタイル比較生成
   */
  async generateStyleComparison(prompt, styles, options = {}) {
    const results = {};
    for (const style of styles) {
      if (style) {
        console.log(`\u{1F3A8} ${style} \u30B9\u30BF\u30A4\u30EB\u3067\u751F\u6210\u4E2D...`);
        results[style] = await this.applyStyle(prompt, style, options);
      }
    }
    return results;
  }
  /**
   * 画像アップスケール（将来実装）
   */
  async upscaleImage(_imagePath, _scaleFactor = 2) {
    return {
      success: false,
      error: "\u30A2\u30C3\u30D7\u30B9\u30B1\u30FC\u30EB\u6A5F\u80FD\u306F\u672A\u5B9F\u88C5\u3067\u3059"
    };
  }
  /**
   * 画像バリエーション生成（将来実装）
   */
  async generateVariations(_imagePath, _prompt, _count = 4) {
    return {
      success: false,
      error: "\u30D0\u30EA\u30A8\u30FC\u30B7\u30E7\u30F3\u751F\u6210\u6A5F\u80FD\u306F\u672A\u5B9F\u88C5\u3067\u3059"
    };
  }
  /**
   * プライベートメソッド
   */
  async waitForImageCompletion(promptId) {
    const maxWaitTime = 5 * 60 * 1e3;
    const checkInterval = 2e3;
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitTime) {
      const status = await modelManager.checkProgress(promptId);
      if (status.completed) {
        return;
      }
      if (status.error) {
        throw new Error(`\u753B\u50CF\u751F\u6210\u30A8\u30E9\u30FC: ${status.error}`);
      }
      await new Promise((resolve2) => setTimeout(resolve2, checkInterval));
    }
    throw new Error("\u753B\u50CF\u751F\u6210\u304C\u30BF\u30A4\u30E0\u30A2\u30A6\u30C8\u3057\u307E\u3057\u305F");
  }
  async moveImageOutput(targetPath) {
    console.log(`\u753B\u50CF\u51FA\u529B\u3092 ${targetPath} \u306B\u79FB\u52D5\u6E96\u5099\u4E2D...`);
  }
  parseImageSize(size) {
    switch (size) {
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
  getStylePrompt(style) {
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
  estimateGenerationTime(batchSize) {
    const timePerImage = 45;
    const totalSeconds = batchSize * timePerImage;
    if (totalSeconds < 60) {
      return `${totalSeconds}\u79D2`;
    } else {
      return `${Math.ceil(totalSeconds / 60)}\u5206`;
    }
  }
  estimateRemainingTime(currentImage, totalImages, startTime) {
    const elapsed = Date.now() - startTime;
    const avgTimePerImage = elapsed / currentImage;
    const remainingImages = totalImages - currentImage;
    const remainingMs = remainingImages * avgTimePerImage;
    if (remainingMs < 6e4) {
      return `${Math.ceil(remainingMs / 1e3)}\u79D2`;
    } else {
      return `${Math.ceil(remainingMs / 6e4)}\u5206`;
    }
  }
  generateMetadata(options, generationTime, imageCount) {
    const size = this.parseImageSize(options.size);
    return {
      resolution: `${size.width}x${size.height}`,
      style: options.style || "photorealistic",
      modelUsed: "qwen-image",
      generationTime: Math.round(generationTime / 1e3),
      seedUsed: options.seed || -1,
      batchSize: imageCount
    };
  }
  async ensureDirectories() {
    await fs.mkdir(this.outputDir, { recursive: true });
    await fs.mkdir(this.tempDir, { recursive: true });
  }
};
var imageGenerationService = new ImageGenerationService();
export {
  ImageGenerationService,
  imageGenerationService
};
//# sourceMappingURL=image-generation.js.map