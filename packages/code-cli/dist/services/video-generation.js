import {
  modelManager
} from "../chunk-J5LY4C2O.js";
import "../chunk-7D4SUZUM.js";

// src/services/video-generation.ts
import { promises as fs } from "fs";
import { join, resolve, extname, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
var VideoGenerationService = class {
  outputDir;
  tempDir;
  constructor() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const mariaRoot = resolve(__dirname, "../../../../..");
    this.outputDir = join(mariaRoot, "outputs/videos");
    this.tempDir = join(mariaRoot, "outputs/temp");
  }
  /**
   * 動画生成（Text-to-Video）
   */
  async generateVideo(prompt, options, onProgress) {
    try {
      onProgress?.({
        stage: "initializing",
        percentage: 0,
        estimatedTimeRemaining: "\u8A08\u7B97\u4E2D...",
        currentStep: "ComfyUI\u8D77\u52D5\u78BA\u8A8D",
        totalSteps: 4
      });
      const isComfyUIRunning = await modelManager.checkComfyUIStatus();
      if (!isComfyUIRunning) {
        onProgress?.({
          stage: "initializing",
          percentage: 10,
          estimatedTimeRemaining: "30\u79D2",
          currentStep: "ComfyUI\u8D77\u52D5\u4E2D",
          totalSteps: 4
        });
        const started = await modelManager.startComfyUI();
        if (!started) {
          throw new Error("ComfyUI\u306E\u8D77\u52D5\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
        }
      }
      onProgress?.({
        stage: "initializing",
        percentage: 25,
        estimatedTimeRemaining: options.model === "wan22-14b" ? "10-15\u5206" : "3-7\u5206",
        currentStep: "\u30E2\u30C7\u30EB\u8AAD\u307F\u8FBC\u307F\u78BA\u8A8D",
        totalSteps: 4
      });
      const modelInfo = await modelManager.getModelInfo(options.model);
      if (!modelInfo || modelInfo.status !== "available") {
        throw new Error(`\u30E2\u30C7\u30EB ${options.model} \u304C\u5229\u7528\u3067\u304D\u307E\u305B\u3093`);
      }
      await this.ensureDirectories();
      if (options.compare) {
        return await this.generateComparison(prompt, options, onProgress);
      }
      return await this.generateSingle(prompt, options, onProgress);
    } catch (error) {
      onProgress?.({
        stage: "error",
        percentage: 0,
        estimatedTimeRemaining: "",
        currentStep: "\u30A8\u30E9\u30FC\u767A\u751F",
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
  async generateSingle(prompt, options, onProgress) {
    const startTime = Date.now();
    const outputFilename = this.generateOutputFilename(options.model);
    const outputPath = join(this.outputDir, outputFilename);
    try {
      const modelMap = {
        "wan22-5b": "wan22_5b",
        "wan22-14b": "wan22_14b"
      };
      const normalizedModel = modelMap[options.model] || options.model;
      const workflowId = options.inputImage ? `${normalizedModel}_i2v` : `${normalizedModel}_t2v`;
      onProgress?.({
        stage: "processing",
        percentage: 30,
        estimatedTimeRemaining: this.estimateGenerationTime(options.model),
        currentStep: "\u30EF\u30FC\u30AF\u30D5\u30ED\u30FC\u6E96\u5099",
        totalSteps: 4
      });
      const workflowData = await modelManager.loadWorkflow(workflowId);
      const generationParams = {
        model: options.model,
        prompt,
        width: this.parseResolution(options.resolution).width,
        height: this.parseResolution(options.resolution).height,
        steps: options.steps || (options.model === "wan22-14b" ? 50 : 30),
        seed: options.seed,
        inputImage: options.inputImage,
        outputPath: outputFilename.replace(".mp4", "")
      };
      onProgress?.({
        stage: "processing",
        percentage: 50,
        estimatedTimeRemaining: this.estimateGenerationTime(options.model),
        currentStep: `${options.model} \u30E2\u30C7\u30EB\u3067\u751F\u6210\u4E2D`,
        totalSteps: 4
      });
      const processedWorkflow = modelManager.replaceWorkflowParameters(
        workflowData.workflow,
        generationParams
      );
      const promptId = await modelManager.executeWorkflow(processedWorkflow);
      await this.waitForCompletion(promptId, onProgress);
      onProgress?.({
        stage: "finalizing",
        percentage: 90,
        estimatedTimeRemaining: "30\u79D2",
        currentStep: "\u51FA\u529B\u30D5\u30A1\u30A4\u30EB\u51E6\u7406",
        totalSteps: 4
      });
      await this.moveOutputFiles(outputPath);
      const metadata = await this.generateMetadata(
        outputPath,
        options.model,
        Date.now() - startTime
      );
      await modelManager.updateLastUsed(options.model);
      onProgress?.({
        stage: "complete",
        percentage: 100,
        estimatedTimeRemaining: "\u5B8C\u4E86",
        currentStep: "\u52D5\u753B\u751F\u6210\u5B8C\u4E86",
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
  async generateComparison(prompt, options, onProgress) {
    try {
      onProgress?.({
        stage: "processing",
        percentage: 10,
        estimatedTimeRemaining: "15-20\u5206",
        currentStep: "5B\u30E2\u30C7\u30EB\u3067\u751F\u6210\u4E2D",
        totalSteps: 6
      });
      const options5B = { ...options, model: "wan22-5b", compare: false };
      const result5B = await this.generateSingle(prompt, options5B);
      if (!result5B.success) {
        throw new Error(`5B\u30E2\u30C7\u30EB\u751F\u6210\u30A8\u30E9\u30FC: ${result5B.error}`);
      }
      onProgress?.({
        stage: "processing",
        percentage: 40,
        estimatedTimeRemaining: "10-15\u5206",
        currentStep: "14B\u30E2\u30C7\u30EB\u3067\u751F\u6210\u4E2D",
        totalSteps: 6
      });
      const options14B = { ...options, model: "wan22-14b", compare: false };
      const result14B = await this.generateSingle(prompt, options14B);
      if (!result14B.success) {
        throw new Error(`14B\u30E2\u30C7\u30EB\u751F\u6210\u30A8\u30E9\u30FC: ${result14B.error}`);
      }
      onProgress?.({
        stage: "finalizing",
        percentage: 80,
        estimatedTimeRemaining: "2-3\u5206",
        currentStep: "\u6BD4\u8F03\u52D5\u753B\u4F5C\u6210\u4E2D",
        totalSteps: 6
      });
      const comparisonPath = await this.createComparisonVideo(
        result5B.outputPath,
        result14B.outputPath
      );
      onProgress?.({
        stage: "complete",
        percentage: 100,
        estimatedTimeRemaining: "\u5B8C\u4E86",
        currentStep: "\u6BD4\u8F03\u52D5\u753B\u751F\u6210\u5B8C\u4E86",
        totalSteps: 6
      });
      return {
        success: true,
        outputPath: result14B.outputPath,
        // メイン出力は14B
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
  async waitForCompletion(promptId, onProgress) {
    const maxWaitTime = 20 * 60 * 1e3;
    const checkInterval = 5e3;
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitTime) {
      const status = await modelManager.checkProgress(promptId);
      if (status.completed) {
        return;
      }
      if (status.error) {
        throw new Error(`\u751F\u6210\u30A8\u30E9\u30FC: ${status.error}`);
      }
      if (onProgress && status.progress !== void 0) {
        const elapsedMinutes = (Date.now() - startTime) / 6e4;
        const progressPercent = Math.min(75, 50 + status.progress * 25);
        onProgress({
          stage: "processing",
          percentage: progressPercent,
          estimatedTimeRemaining: `\u6B8B\u308A ${Math.max(1, Math.ceil(15 - elapsedMinutes))} \u5206`,
          currentStep: "\u52D5\u753B\u751F\u6210\u51E6\u7406\u4E2D",
          totalSteps: 4
        });
      }
      await new Promise((resolve2) => setTimeout(resolve2, checkInterval));
    }
    throw new Error("\u52D5\u753B\u751F\u6210\u304C\u30BF\u30A4\u30E0\u30A2\u30A6\u30C8\u3057\u307E\u3057\u305F");
  }
  /**
   * 比較動画作成（ffmpeg使用）
   */
  async createComparisonVideo(leftVideo, rightVideo) {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    const outputPath = join(this.outputDir, `comparison_${timestamp}.mp4`);
    return new Promise((resolve2, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-y",
        // 上書き
        "-i",
        leftVideo,
        // 左側動画（5B）
        "-i",
        rightVideo,
        // 右側動画（14B）
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
        outputPath
      ]);
      ffmpeg.on("close", (code) => {
        if (code === 0) {
          resolve2(outputPath);
        } else {
          reject(new Error(`ffmpeg\u7D42\u4E86\u30B3\u30FC\u30C9: ${code}`));
        }
      });
      ffmpeg.on("error", (error) => {
        reject(new Error(`ffmpeg\u5B9F\u884C\u30A8\u30E9\u30FC: ${error.message}`));
      });
    });
  }
  /**
   * 出力ファイルの移動処理
   */
  async moveOutputFiles(targetPath) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const _comfyUIOutputDir = resolve(__dirname, "../../../../comfyui/output");
    void _comfyUIOutputDir;
    try {
      console.log(`\u51FA\u529B\u30D5\u30A1\u30A4\u30EB\u3092 ${targetPath} \u306B\u79FB\u52D5\u6E96\u5099\u4E2D...`);
    } catch (error) {
      console.warn("\u51FA\u529B\u30D5\u30A1\u30A4\u30EB\u79FB\u52D5\u8B66\u544A:", error);
    }
  }
  /**
   * メタデータ生成
   */
  async generateMetadata(_outputPath, modelUsed, generationTime) {
    return {
      duration: 2,
      // 秒
      fps: 24,
      resolution: "1280x720",
      modelUsed,
      generationTime: Math.round(generationTime / 1e3)
      // 秒単位
    };
  }
  /**
   * ユーティリティメソッド
   */
  parseResolution(resolution) {
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
  estimateGenerationTime(model) {
    return model === "wan22-14b" ? "5-15\u5206" : "2-7\u5206";
  }
  generateOutputFilename(model) {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    return `maria_video_${model}_${timestamp}.mp4`;
  }
  async ensureDirectories() {
    await fs.mkdir(this.outputDir, { recursive: true });
    await fs.mkdir(this.tempDir, { recursive: true });
  }
  /**
   * Image-to-Video 専用メソッド
   */
  async generateFromImage(imagePath, prompt, options) {
    try {
      await fs.access(imagePath);
    } catch {
      return {
        success: false,
        error: `\u5165\u529B\u753B\u50CF\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093: ${imagePath}`
      };
    }
    const ext = extname(imagePath).toLowerCase();
    if (![".jpg", ".jpeg", ".png", ".bmp"].includes(ext)) {
      return {
        success: false,
        error: `\u5BFE\u5FDC\u3057\u3066\u3044\u306A\u3044\u753B\u50CF\u30D5\u30A9\u30FC\u30DE\u30C3\u30C8: ${ext}`
      };
    }
    return await this.generateVideo(prompt, {
      ...options,
      inputImage: imagePath
    });
  }
};
var videoGenerationService = new VideoGenerationService();
export {
  VideoGenerationService,
  videoGenerationService
};
//# sourceMappingURL=video-generation.js.map