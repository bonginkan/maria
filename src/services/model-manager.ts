import { promises as fs } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { ChildProcess, spawn } from "child_process";

export interface ModelInfo {
  id: string;
  name: string;
  type: "video" | "image";
  size: string;
  _path: string;
  status: "available" | "downloading" | "_error" | "not_found";
  capabilities: string[];
  vramRequired: string;
  estimatedTime: string;
  lastUsed?: Date;
}

export interface ModelConfig {
  wan225b: ModelInfo;
  wan22_14b: ModelInfo;
  qwen_image: ModelInfo;
}

export interface GenerationOptions {
  _model: string;
  prompt: string;
  width?: number;
  height?: number;
  steps?: number;
  guidance?: number;
  seed?: number;
  inputImage?: string;
  outputPath?: string;
  style?: string;
  fps?: number;
  frames?: number;
}

export class ModelManager {
  private _config: ModelConfig;
  private modelsDir: string;
  private workflowsDir: string;
  private comfyuiDir: string;
  private comfyuiProcess: ChildProcess | null = null;

  constructor() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(filename);
    const _mariaRoot = resolve(dirname, "../../../../..");
    this.modelsDir = join(_mariaRoot, "models");
    this.workflowsDir = join(_mariaRoot, "workflows");
    this.comfyuiDir = join(_mariaRoot, "comfyui");

    this.config = {
      wan225b: {
        id: "wan22-5b",
        name: "Wan 2.2 5B",
        type: "video",
        size: "~8GB",
        _path: join(this.modelsDir, "wan22/5b"),
        status: "not_found",
        capabilities: ["text-to-video", "image-to-video"],
        vramRequired: "~8GB",
        estimatedTime: "2-5分",
      },
      wan2214b: {
        id: "wan22-14b",
        name: "Wan 2.2 14B",
        type: "video",
        size: "~16GB",
        _path: join(this.modelsDir, "wan22/14b"),
        status: "not_found",
        capabilities: ["text-to-video", "image-to-video", "high-quality"],
        vramRequired: "~16GB",
        estimatedTime: "5-15分",
      },
      qwenimage: {
        id: "qwen-image",
        name: "Qwen-Image",
        type: "image",
        size: "~6GB",
        _path: join(this.modelsDir, "qwen-image"),
        status: "not_found",
        capabilities: ["text-to-image", "style-control"],
        vramRequired: "~6GB",
        estimatedTime: "30-60秒",
      },
    };
  }

  /**
   * モデルステータス確認
   */
  async checkModelStatus(): Promise<ModelConfig> {
    for (const [key, _model] of Object.entries(this.config)) {
      try {
        const _stats = await fs.stat(model._path);
        if (_stats.isDirectory()) {
          const _files = await fs.readdir(model._path);
          if (_files.length > 0) {
            this.config[key as keyof ModelConfig].status = "available";

            // 最終使用日時を取得
            try {
              const _lastUsedFile = join(model._path, ".last_used");
              const _lastUsedStr = await fs.readFile(_lastUsedFile, "utf-8");
              this.config[key as keyof ModelConfig].lastUsed = new Date(
                _lastUsedStr,
              );
            } catch {
              // ファイルが存在しない場合は無視
            }
          }
        }
      } catch {
        this.config[key as keyof ModelConfig].status = "not_found";
      }
    }

    return this.config;
  }

  /**
   * 利用可能なモデル一覧取得
   */
  async getAvailableModels(): Promise<ModelInfo[]> {
    await this.checkModelStatus();
    return Object.values(this.config).filter(
      (_model) => _model.status === "available",
    );
  }

  /**
   * 特定モデル情報取得
   */
  async getModelInfo(modelId: string): Promise<ModelInfo | null> {
    await this.checkModelStatus();
    const _model = Object.values(this.config).find((m) => m.id === modelId);
    return _model || null;
  }

  /**
   * ComfyUI起動
   */
  async startComfyUI(): Promise<boolean> {
    if (this.comfyuiProcess && !this.comfyuiProcess.killed) {
      console.log("✅ ComfyUI は既に起動中です");
      return true;
    }

    try {
      console.log("🚀 ComfyUI 起動中...");

      const _pythonPath = join(this.comfyuiDir, "venv/bin/python");
      const _mainScript = join(this.comfyuiDir, "main.py");

      this.comfyuiProcess = spawn(
        _pythonPath,
        [
          _mainScript,
          "--listen",
          "127.0.0.1",
          "--port",
          "8188",
          "--disable-auto-launch",
        ],
        {
          cwd: this.comfyuiDir,
          stdio: ["pipe", "pipe", "pipe"],
        },
      );

      return new Promise((resolveInner) => {
        let started = false;

        const _timeout = setTimeout(() => {
          if (!started) {
            console.log("⚠️ ComfyUI起動タイムアウト");
            resolve(false);
          }
        }, 30000); // 30秒タイムアウト

        this.comfyuiProcess!.stdout?.on("data", (data) => {
          const _output = data.toString();
          console.log("ComfyUI:", _output);

          if (_output.includes("Starting server")) {
            started = true;
            clearTimeout(_timeout);
            console.log("✅ ComfyUI 起動完了: http://localhost:8188");
            resolve(true);
          }
        });

        this.comfyuiProcess!.stderr?.on("data", (data) => {
          console._error("ComfyUI Error:", data.toString());
        });

        this.comfyuiProcess!.on("_error", (_error) => {
          console._error("❌ ComfyUI起動エラー:", _error.message);
          clearTimeout(_timeout);
          resolve(false);
        });
      });
    } catch (_error: unknown) {
      console._error("❌ ComfyUI起動失敗:", _error);
      return false;
    }
  }

  /**
   * ComfyUI停止
   */
  async stopComfyUI(): Promise<void> {
    if (this.comfyuiProcess && !this.comfyuiProcess.killed) {
      console.log("🛑 ComfyUI 停止中...");
      this.comfyuiProcess.kill("SIGTERM");

      // 強制終了のための待機
      setTimeout(() => {
        if (this.comfyuiProcess && !this.comfyuiProcess.killed) {
          console.log("🔪 ComfyUI 強制停止");
          this.comfyuiProcess.kill("SIGKILL");
        }
      }, 5000);

      this.comfyuiProcess = null;
      console.log("✅ ComfyUI 停止完了");
    }
  }

  /**
   * ComfyUIステータス確認
   */
  async checkComfyUIStatus(): Promise<boolean> {
    try {
      const _response = await fetch("http://localhost:8188/system_stats");
      return _response.ok;
    } catch {
      return false;
    }
  }

  /**
   * ワークフロー読み込み
   */
  async loadWorkflow(workflowId: string): Promise<unknown> {
    const _workflowConfigPath = join(this.workflowsDir, "workflow_config.json");

    try {
      const _configContent = await fs.readFile(_workflowConfigPath, "utf-8");
      const _config = JSON.parse(_configContent) as Record<string, unknown>;

      const _workflow = (_config["workflows"] as Record<string, unknown>)?.[
        workflowId
      ];
      if (!_workflow) {
        throw new Error(`ワークフロー '${workflowId}' が見つかりません`);
      }

      const _workflowPath = join(
        this.workflowsDir,
        (_workflow as Record<string, unknown>)["file"] as string,
      );
      const _workflowContent = await fs.readFile(_workflowPath, "utf-8");

      return {
        ..._workflow,
        _workflow: JSON.parse(_workflowContent) as Record<string, unknown>,
      };
    } catch (_error: unknown) {
      throw new Error(`ワークフロー読み込みエラー: ${_error}`);
    }
  }

  /**
   * ワークフローパラメータ置換
   */
  replaceWorkflowParameters(
    _workflow: unknown,
    params: GenerationOptions,
  ): unknown {
    const _workflowStr = JSON.stringify(_workflow);

    const _replacements = {
      PROMPTPLACEHOLDER: params.prompt,
      SEEDPLACEHOLDER:
        params.seed?.toString() ||
        Math.floor(Math.random() * 1000000).toString(),
      STEPSPLACEHOLDER: params.steps?.toString() || "30",
      WIDTHPLACEHOLDER: params.width?.toString() || "1280",
      HEIGHTPLACEHOLDER: params.height?.toString() || "720",
      OUTPUTPREFIX_PLACEHOLDER: params.outputPath || "maria_generated",
      INPUTIMAGE_PLACEHOLDER: params.inputImage || "",
      STYLEPLACEHOLDER: params.style || "photorealistic",
      GUIDANCEPLACEHOLDER: params.guidance?.toString() || "7.5",
    };

    let processedWorkflow = _workflowStr;
    for (const [placeholder, value] of Object.entries(_replacements)) {
      processedWorkflow = processedWorkflow.replace(
        new RegExp(placeholder, "g"),
        value,
      );
    }

    return JSON.parse(processedWorkflow) as Record<string, unknown>;
  }

  /**
   * ComfyUI API経由でワークフロー実行
   */
  async executeWorkflow(_workflow: unknown): Promise<string> {
    if (!(await this.checkComfyUIStatus())) {
      throw new Error("ComfyUIが起動していません");
    }

    try {
      const _response = await fetch("http://localhost:8188/prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: _workflow }),
      });

      if (!_response.ok) {
        throw new Error(`ComfyUI API エラー: ${_response.status}`);
      }

      const _result = (await _response.json()) as { promptid: string };
      return _result.prompt_id;
    } catch (_error: unknown) {
      throw new Error(`ワークフロー実行エラー: ${_error}`);
    }
  }

  /**
   * 生成進捗確認
   */
  async checkProgress(
    promptId: string,
  ): Promise<{ completed: boolean; progress?: number; _error?: string }> {
    try {
      const _response = await fetch(`http://localhost:8188/prompt/${promptId}`);

      if (!_response.ok) {
        return { completed: false, _error: "プロンプトIDが見つかりません" };
      }

      const _result = (await _response.json()) as {
        status: string;
        message?: string;
        progress?: number;
      };

      // ComfyUIの実際のレスポンス形式に合わせて調整が必要
      if (_result.status === "completed") {
        return { completed: true };
      } else if (_result.status === "_error") {
        return { completed: false, _error: _result.message };
      } else {
        return { completed: false, progress: _result.progress || 0 };
      }
    } catch (_error: unknown) {
      return { completed: false, _error: `進捗確認エラー: ${_error}` };
    }
  }

  /**
   * 最終使用日時更新
   */
  async updateLastUsed(modelId: string): Promise<void> {
    const _model = Object.values(this.config).find((m) => m.id === modelId);
    if (_model && _model.status === "available") {
      try {
        const _lastUsedFile = join(_model._path, ".last_used");
        await fs.writeFile(_lastUsedFile, new Date().toISOString());
        model.lastUsed = new Date();
      } catch (_error: unknown) {
        console.warn(`最終使用日時更新エラー (${modelId}):`, _error);
      }
    }
  }

  /**
   * リソース使用状況確認
   */
  async getResourceUsage(): Promise<{
    memory: number;
    gpu: number;
    disk: number;
  }> {
    // TODO: 実際のシステムリソース監視実装
    return {
      memory: 0, // MB
      gpu: 0, // %
      disk: 0, // MB
    };
  }

  /**
   * クリーンアップ
   */
  async cleanup(): Promise<void> {
    await this.stopComfyUI();
  }
}

// シングルトンインスタンス
export const _modelManager = new ModelManager();
