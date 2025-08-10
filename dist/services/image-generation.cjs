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

// src/services/image-generation.ts
var image_generation_exports = {};
__export(image_generation_exports, {
  ImageGenerationService: () => ImageGenerationService,
  imageGenerationService: () => imageGenerationService
});
module.exports = __toCommonJS(image_generation_exports);

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

// src/services/image-generation.ts
var import_fs2 = require("fs");
var import_path2 = require("path");
var import_url2 = require("url");
var import_meta2 = {};
var ImageGenerationService = class {
  outputDir;
  tempDir;
  constructor() {
    const __filename = (0, import_url2.fileURLToPath)(import_meta2.url);
    const __dirname = (0, import_path2.dirname)(__filename);
    const mariaRoot = (0, import_path2.resolve)(__dirname, "../../../../..");
    this.outputDir = (0, import_path2.join)(mariaRoot, "outputs/images");
    this.tempDir = (0, import_path2.join)(mariaRoot, "outputs/temp");
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
          await new Promise((resolve3) => setTimeout(resolve3, 1e3));
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
    const outputPath = (0, import_path2.join)(this.outputDir, filename);
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
      await new Promise((resolve3) => setTimeout(resolve3, checkInterval));
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
    await import_fs2.promises.mkdir(this.outputDir, { recursive: true });
    await import_fs2.promises.mkdir(this.tempDir, { recursive: true });
  }
};
var imageGenerationService = new ImageGenerationService();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ImageGenerationService,
  imageGenerationService
});
//# sourceMappingURL=image-generation.cjs.map