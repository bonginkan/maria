"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/services/video-generation.ts
var video_generation_exports = {};
__export(video_generation_exports, {
  VideoGenerationService: () => VideoGenerationService,
  videoGenerationService: () => videoGenerationService
});
module.exports = __toCommonJS(video_generation_exports);

// src/services/model-manager.ts
var import_fs = require("fs");
var import_path = require("path");
var import_url = require("url");
var import_child_process = require("child_process");
var import_meta = {};
var ModelManager = class {
  config;
  modelsDir;
  workflowsDir;
  comfyuiDir;
  comfyuiProcess = null;
  constructor() {
    const __filename = (0, import_url.fileURLToPath)(import_meta.url);
    const __dirname = (0, import_path.dirname)(__filename);
    const mariaRoot = (0, import_path.resolve)(__dirname, "../../../../..");
    this.modelsDir = (0, import_path.join)(mariaRoot, "models");
    this.workflowsDir = (0, import_path.join)(mariaRoot, "workflows");
    this.comfyuiDir = (0, import_path.join)(mariaRoot, "comfyui");
    this.config = {
      wan22_5b: {
        id: "wan22-5b",
        name: "Wan 2.2 5B",
        type: "video",
        size: "~8GB",
        path: (0, import_path.join)(this.modelsDir, "wan22/5b"),
        status: "not_found",
        capabilities: ["text-to-video", "image-to-video"],
        vramRequired: "~8GB",
        estimatedTime: "2-5\u5206"
      },
      wan22_14b: {
        id: "wan22-14b",
        name: "Wan 2.2 14B",
        type: "video",
        size: "~16GB",
        path: (0, import_path.join)(this.modelsDir, "wan22/14b"),
        status: "not_found",
        capabilities: ["text-to-video", "image-to-video", "high-quality"],
        vramRequired: "~16GB",
        estimatedTime: "5-15\u5206"
      },
      qwen_image: {
        id: "qwen-image",
        name: "Qwen-Image",
        type: "image",
        size: "~6GB",
        path: (0, import_path.join)(this.modelsDir, "qwen-image"),
        status: "not_found",
        capabilities: ["text-to-image", "style-control"],
        vramRequired: "~6GB",
        estimatedTime: "30-60\u79D2"
      }
    };
  }
  /**
   * モデルステータス確認
   */
  async checkModelStatus() {
    for (const [key, model] of Object.entries(this.config)) {
      try {
        const stats = await import_fs.promises.stat(model.path);
        if (stats.isDirectory()) {
          const files = await import_fs.promises.readdir(model.path);
          if (files.length > 0) {
            this.config[key].status = "available";
            try {
              const lastUsedFile = (0, import_path.join)(model.path, ".last_used");
              const lastUsedStr = await import_fs.promises.readFile(lastUsedFile, "utf-8");
              this.config[key].lastUsed = new Date(lastUsedStr);
            } catch {
            }
          }
        }
      } catch {
        this.config[key].status = "not_found";
      }
    }
    return this.config;
  }
  /**
   * 利用可能なモデル一覧取得
   */
  async getAvailableModels() {
    await this.checkModelStatus();
    return Object.values(this.config).filter((model) => model.status === "available");
  }
  /**
   * 特定モデル情報取得
   */
  async getModelInfo(modelId) {
    await this.checkModelStatus();
    const model = Object.values(this.config).find((m) => m.id === modelId);
    return model || null;
  }
  /**
   * ComfyUI起動
   */
  async startComfyUI() {
    if (this.comfyuiProcess && !this.comfyuiProcess.killed) {
      console.log("\u2705 ComfyUI \u306F\u65E2\u306B\u8D77\u52D5\u4E2D\u3067\u3059");
      return true;
    }
    try {
      console.log("\u{1F680} ComfyUI \u8D77\u52D5\u4E2D...");
      const pythonPath = (0, import_path.join)(this.comfyuiDir, "venv/bin/python");
      const mainScript = (0, import_path.join)(this.comfyuiDir, "main.py");
      this.comfyuiProcess = (0, import_child_process.spawn)(pythonPath, [
        mainScript,
        "--listen",
        "127.0.0.1",
        "--port",
        "8188",
        "--disable-auto-launch"
      ], {
        cwd: this.comfyuiDir,
        stdio: ["pipe", "pipe", "pipe"]
      });
      return new Promise((resolve3) => {
        let started = false;
        const timeout = setTimeout(() => {
          if (!started) {
            console.log("\u26A0\uFE0F ComfyUI\u8D77\u52D5\u30BF\u30A4\u30E0\u30A2\u30A6\u30C8");
            resolve3(false);
          }
        }, 3e4);
        this.comfyuiProcess.stdout?.on("data", (data) => {
          const output = data.toString();
          console.log("ComfyUI:", output);
          if (output.includes("Starting server")) {
            started = true;
            clearTimeout(timeout);
            console.log("\u2705 ComfyUI \u8D77\u52D5\u5B8C\u4E86: http://localhost:8188");
            resolve3(true);
          }
        });
        this.comfyuiProcess.stderr?.on("data", (data) => {
          console.error("ComfyUI Error:", data.toString());
        });
        this.comfyuiProcess.on("error", (error) => {
          console.error("\u274C ComfyUI\u8D77\u52D5\u30A8\u30E9\u30FC:", error.message);
          clearTimeout(timeout);
          resolve3(false);
        });
      });
    } catch (error) {
      console.error("\u274C ComfyUI\u8D77\u52D5\u5931\u6557:", error);
      return false;
    }
  }
  /**
   * ComfyUI停止
   */
  async stopComfyUI() {
    if (this.comfyuiProcess && !this.comfyuiProcess.killed) {
      console.log("\u{1F6D1} ComfyUI \u505C\u6B62\u4E2D...");
      this.comfyuiProcess.kill("SIGTERM");
      setTimeout(() => {
        if (this.comfyuiProcess && !this.comfyuiProcess.killed) {
          console.log("\u{1F52A} ComfyUI \u5F37\u5236\u505C\u6B62");
          this.comfyuiProcess.kill("SIGKILL");
        }
      }, 5e3);
      this.comfyuiProcess = null;
      console.log("\u2705 ComfyUI \u505C\u6B62\u5B8C\u4E86");
    }
  }
  /**
   * ComfyUIステータス確認
   */
  async checkComfyUIStatus() {
    try {
      const response = await fetch("http://localhost:8188/system_stats");
      return response.ok;
    } catch {
      return false;
    }
  }
  /**
   * ワークフロー読み込み
   */
  async loadWorkflow(workflowId) {
    const workflowConfigPath = (0, import_path.join)(this.workflowsDir, "workflow_config.json");
    try {
      const configContent = await import_fs.promises.readFile(workflowConfigPath, "utf-8");
      const config = JSON.parse(configContent);
      const workflow = config.workflows[workflowId];
      if (!workflow) {
        throw new Error(`\u30EF\u30FC\u30AF\u30D5\u30ED\u30FC '${workflowId}' \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093`);
      }
      const workflowPath = (0, import_path.join)(this.workflowsDir, workflow.file);
      const workflowContent = await import_fs.promises.readFile(workflowPath, "utf-8");
      return {
        ...workflow,
        workflow: JSON.parse(workflowContent)
      };
    } catch (error) {
      throw new Error(`\u30EF\u30FC\u30AF\u30D5\u30ED\u30FC\u8AAD\u307F\u8FBC\u307F\u30A8\u30E9\u30FC: ${error}`);
    }
  }
  /**
   * ワークフローパラメータ置換
   */
  replaceWorkflowParameters(workflow, params) {
    const workflowStr = JSON.stringify(workflow);
    const replacements = {
      "PROMPT_PLACEHOLDER": params.prompt,
      "SEED_PLACEHOLDER": params.seed?.toString() || Math.floor(Math.random() * 1e6).toString(),
      "STEPS_PLACEHOLDER": params.steps?.toString() || "30",
      "WIDTH_PLACEHOLDER": params.width?.toString() || "1280",
      "HEIGHT_PLACEHOLDER": params.height?.toString() || "720",
      "OUTPUT_PREFIX_PLACEHOLDER": params.outputPath || "maria_generated",
      "INPUT_IMAGE_PLACEHOLDER": params.inputImage || "",
      "STYLE_PLACEHOLDER": params.style || "photorealistic",
      "GUIDANCE_PLACEHOLDER": params.guidance?.toString() || "7.5"
    };
    let processedWorkflow = workflowStr;
    for (const [placeholder, value] of Object.entries(replacements)) {
      processedWorkflow = processedWorkflow.replace(
        new RegExp(placeholder, "g"),
        value
      );
    }
    return JSON.parse(processedWorkflow);
  }
  /**
   * ComfyUI API経由でワークフロー実行
   */
  async executeWorkflow(workflow) {
    if (!await this.checkComfyUIStatus()) {
      throw new Error("ComfyUI\u304C\u8D77\u52D5\u3057\u3066\u3044\u307E\u305B\u3093");
    }
    try {
      const response = await fetch("http://localhost:8188/prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ prompt: workflow })
      });
      if (!response.ok) {
        throw new Error(`ComfyUI API \u30A8\u30E9\u30FC: ${response.status}`);
      }
      const result = await response.json();
      return result.prompt_id;
    } catch (error) {
      throw new Error(`\u30EF\u30FC\u30AF\u30D5\u30ED\u30FC\u5B9F\u884C\u30A8\u30E9\u30FC: ${error}`);
    }
  }
  /**
   * 生成進捗確認
   */
  async checkProgress(promptId) {
    try {
      const response = await fetch(`http://localhost:8188/prompt/${promptId}`);
      if (!response.ok) {
        return { completed: false, error: "\u30D7\u30ED\u30F3\u30D7\u30C8ID\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093" };
      }
      const result = await response.json();
      if (result.status === "completed") {
        return { completed: true };
      } else if (result.status === "error") {
        return { completed: false, error: result.message };
      } else {
        return { completed: false, progress: result.progress || 0 };
      }
    } catch (error) {
      return { completed: false, error: `\u9032\u6357\u78BA\u8A8D\u30A8\u30E9\u30FC: ${error}` };
    }
  }
  /**
   * 最終使用日時更新
   */
  async updateLastUsed(modelId) {
    const model = Object.values(this.config).find((m) => m.id === modelId);
    if (model && model.status === "available") {
      try {
        const lastUsedFile = (0, import_path.join)(model.path, ".last_used");
        await import_fs.promises.writeFile(lastUsedFile, (/* @__PURE__ */ new Date()).toISOString());
        model.lastUsed = /* @__PURE__ */ new Date();
      } catch (error) {
        console.warn(`\u6700\u7D42\u4F7F\u7528\u65E5\u6642\u66F4\u65B0\u30A8\u30E9\u30FC (${modelId}):`, error);
      }
    }
  }
  /**
   * リソース使用状況確認
   */
  async getResourceUsage() {
    return {
      memory: 0,
      // MB
      gpu: 0,
      // %
      disk: 0
      // MB
    };
  }
  /**
   * クリーンアップ
   */
  async cleanup() {
    await this.stopComfyUI();
  }
};
var modelManager = new ModelManager();

// src/services/video-generation.ts
var import_fs2 = require("fs");
var import_path2 = require("path");
var import_url2 = require("url");
var import_child_process2 = require("child_process");
var import_meta2 = {};
var VideoGenerationService = class {
  outputDir;
  tempDir;
  constructor() {
    const __filename = (0, import_url2.fileURLToPath)(import_meta2.url);
    const __dirname = (0, import_path2.dirname)(__filename);
    const mariaRoot = (0, import_path2.resolve)(__dirname, "../../../../..");
    this.outputDir = (0, import_path2.join)(mariaRoot, "outputs/videos");
    this.tempDir = (0, import_path2.join)(mariaRoot, "outputs/temp");
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
    const outputPath = (0, import_path2.join)(this.outputDir, outputFilename);
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
      await new Promise((resolve3) => setTimeout(resolve3, checkInterval));
    }
    throw new Error("\u52D5\u753B\u751F\u6210\u304C\u30BF\u30A4\u30E0\u30A2\u30A6\u30C8\u3057\u307E\u3057\u305F");
  }
  /**
   * 比較動画作成（ffmpeg使用）
   */
  async createComparisonVideo(leftVideo, rightVideo) {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    const outputPath = (0, import_path2.join)(this.outputDir, `comparison_${timestamp}.mp4`);
    return new Promise((resolve3, reject) => {
      const ffmpeg = (0, import_child_process2.spawn)("ffmpeg", [
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
          resolve3(outputPath);
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
    const __filename = (0, import_url2.fileURLToPath)(import_meta2.url);
    const __dirname = (0, import_path2.dirname)(__filename);
    const _comfyUIOutputDir = (0, import_path2.resolve)(__dirname, "../../../../comfyui/output");
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
    await import_fs2.promises.mkdir(this.outputDir, { recursive: true });
    await import_fs2.promises.mkdir(this.tempDir, { recursive: true });
  }
  /**
   * Image-to-Video 専用メソッド
   */
  async generateFromImage(imagePath, prompt, options) {
    try {
      await import_fs2.promises.access(imagePath);
    } catch {
      return {
        success: false,
        error: `\u5165\u529B\u753B\u50CF\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093: ${imagePath}`
      };
    }
    const ext = (0, import_path2.extname)(imagePath).toLowerCase();
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  VideoGenerationService,
  videoGenerationService
});
//# sourceMappingURL=video-generation.cjs.map