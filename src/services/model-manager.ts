import { promises as fs } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn, ChildProcess } from 'child_process';

export interface ModelInfo {
  id: string;
  name: string;
  type: 'video' | 'image';
  size: string;
  path: string;
  status: 'available' | 'downloading' | 'error' | 'not_found';
  capabilities: string[];
  vramRequired: string;
  estimatedTime: string;
  lastUsed?: Date;
}

export interface ModelConfig {
  wan22_5b: ModelInfo;
  wan22_14b: ModelInfo;
  qwen_image: ModelInfo;
}

export interface GenerationOptions {
  model: string;
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
  private config: ModelConfig;
  private modelsDir: string;
  private workflowsDir: string;
  private comfyuiDir: string;
  private comfyuiProcess: ChildProcess | null = null;

  constructor() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const mariaRoot = resolve(__dirname, '../../../../..');
    this.modelsDir = join(mariaRoot, 'models');
    this.workflowsDir = join(mariaRoot, 'workflows');
    this.comfyuiDir = join(mariaRoot, 'comfyui');
    
    this.config = {
      wan22_5b: {
        id: 'wan22-5b',
        name: 'Wan 2.2 5B',
        type: 'video',
        size: '~8GB',
        path: join(this.modelsDir, 'wan22/5b'),
        status: 'not_found',
        capabilities: ['text-to-video', 'image-to-video'],
        vramRequired: '~8GB',
        estimatedTime: '2-5分'
      },
      wan22_14b: {
        id: 'wan22-14b',
        name: 'Wan 2.2 14B',
        type: 'video',
        size: '~16GB', 
        path: join(this.modelsDir, 'wan22/14b'),
        status: 'not_found',
        capabilities: ['text-to-video', 'image-to-video', 'high-quality'],
        vramRequired: '~16GB',
        estimatedTime: '5-15分'
      },
      qwen_image: {
        id: 'qwen-image',
        name: 'Qwen-Image',
        type: 'image',
        size: '~6GB',
        path: join(this.modelsDir, 'qwen-image'),
        status: 'not_found', 
        capabilities: ['text-to-image', 'style-control'],
        vramRequired: '~6GB',
        estimatedTime: '30-60秒'
      }
    };
  }

  /**
   * モデルステータス確認
   */
  async checkModelStatus(): Promise<ModelConfig> {
    for (const [key, model] of Object.entries(this.config)) {
      try {
        const stats = await fs.stat(model.path);
        if (stats.isDirectory()) {
          const files = await fs.readdir(model.path);
          if (files.length > 0) {
            this.config[key as keyof ModelConfig].status = 'available';
            
            // 最終使用日時を取得
            try {
              const lastUsedFile = join(model.path, '.last_used');
              const lastUsedStr = await fs.readFile(lastUsedFile, 'utf-8');
              this.config[key as keyof ModelConfig].lastUsed = new Date(lastUsedStr);
            } catch {
              // ファイルが存在しない場合は無視
            }
          }
        }
      } catch {
        this.config[key as keyof ModelConfig].status = 'not_found';
      }
    }
    
    return this.config;
  }

  /**
   * 利用可能なモデル一覧取得
   */
  async getAvailableModels(): Promise<ModelInfo[]> {
    await this.checkModelStatus();
    return Object.values(this.config).filter(model => model.status === 'available');
  }

  /**
   * 特定モデル情報取得
   */
  async getModelInfo(modelId: string): Promise<ModelInfo | null> {
    await this.checkModelStatus();
    const model = Object.values(this.config).find(m => m.id === modelId);
    return model || null;
  }

  /**
   * ComfyUI起動
   */
  async startComfyUI(): Promise<boolean> {
    if (this.comfyuiProcess && !this.comfyuiProcess.killed) {
      console.log('✅ ComfyUI は既に起動中です');
      return true;
    }

    try {
      console.log('🚀 ComfyUI 起動中...');
      
      const pythonPath = join(this.comfyuiDir, 'venv/bin/python');
      const mainScript = join(this.comfyuiDir, 'main.py');
      
      this.comfyuiProcess = spawn(pythonPath, [
        mainScript,
        '--listen', '127.0.0.1',
        '--port', '8188',
        '--disable-auto-launch'
      ], {
        cwd: this.comfyuiDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      return new Promise((resolve) => {
        let started = false;
        
        const timeout = setTimeout(() => {
          if (!started) {
            console.log('⚠️ ComfyUI起動タイムアウト');
            resolve(false);
          }
        }, 30000); // 30秒タイムアウト

        this.comfyuiProcess!.stdout?.on('data', (data) => {
          const output = data.toString();
          console.log('ComfyUI:', output);
          
          if (output.includes('Starting server')) {
            started = true;
            clearTimeout(timeout);
            console.log('✅ ComfyUI 起動完了: http://localhost:8188');
            resolve(true);
          }
        });

        this.comfyuiProcess!.stderr?.on('data', (data) => {
          console.error('ComfyUI Error:', data.toString());
        });

        this.comfyuiProcess!.on('error', (error) => {
          console.error('❌ ComfyUI起動エラー:', error.message);
          clearTimeout(timeout);
          resolve(false);
        });
      });
    } catch (error) {
      console.error('❌ ComfyUI起動失敗:', error);
      return false;
    }
  }

  /**
   * ComfyUI停止
   */
  async stopComfyUI(): Promise<void> {
    if (this.comfyuiProcess && !this.comfyuiProcess.killed) {
      console.log('🛑 ComfyUI 停止中...');
      this.comfyuiProcess.kill('SIGTERM');
      
      // 強制終了のための待機
      setTimeout(() => {
        if (this.comfyuiProcess && !this.comfyuiProcess.killed) {
          console.log('🔪 ComfyUI 強制停止');
          this.comfyuiProcess.kill('SIGKILL');
        }
      }, 5000);
      
      this.comfyuiProcess = null;
      console.log('✅ ComfyUI 停止完了');
    }
  }

  /**
   * ComfyUIステータス確認
   */
  async checkComfyUIStatus(): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:8188/system_stats');
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * ワークフロー読み込み
   */
  async loadWorkflow(workflowId: string): Promise<any> {
    const workflowConfigPath = join(this.workflowsDir, 'workflow_config.json');
    
    try {
      const configContent = await fs.readFile(workflowConfigPath, 'utf-8');
      const config = JSON.parse(configContent);
      
      const workflow = config.workflows[workflowId];
      if (!workflow) {
        throw new Error(`ワークフロー '${workflowId}' が見つかりません`);
      }
      
      const workflowPath = join(this.workflowsDir, workflow.file);
      const workflowContent = await fs.readFile(workflowPath, 'utf-8');
      
      return {
        ...workflow,
        workflow: JSON.parse(workflowContent)
      };
    } catch (error) {
      throw new Error(`ワークフロー読み込みエラー: ${error}`);
    }
  }

  /**
   * ワークフローパラメータ置換
   */
  replaceWorkflowParameters(workflow: any, params: GenerationOptions): any {
    const workflowStr = JSON.stringify(workflow);
    
    const replacements = {
      'PROMPT_PLACEHOLDER': params.prompt,
      'SEED_PLACEHOLDER': params.seed?.toString() || Math.floor(Math.random() * 1000000).toString(),
      'STEPS_PLACEHOLDER': params.steps?.toString() || '30',
      'WIDTH_PLACEHOLDER': params.width?.toString() || '1280',
      'HEIGHT_PLACEHOLDER': params.height?.toString() || '720',
      'OUTPUT_PREFIX_PLACEHOLDER': params.outputPath || 'maria_generated',
      'INPUT_IMAGE_PLACEHOLDER': params.inputImage || '',
      'STYLE_PLACEHOLDER': params.style || 'photorealistic',
      'GUIDANCE_PLACEHOLDER': params.guidance?.toString() || '7.5'
    };

    let processedWorkflow = workflowStr;
    for (const [placeholder, value] of Object.entries(replacements)) {
      processedWorkflow = processedWorkflow.replace(
        new RegExp(placeholder, 'g'),
        value
      );
    }

    return JSON.parse(processedWorkflow);
  }

  /**
   * ComfyUI API経由でワークフロー実行
   */
  async executeWorkflow(workflow: any): Promise<string> {
    if (!await this.checkComfyUIStatus()) {
      throw new Error('ComfyUIが起動していません');
    }

    try {
      const response = await fetch('http://localhost:8188/prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt: workflow })
      });

      if (!response.ok) {
        throw new Error(`ComfyUI API エラー: ${response.status}`);
      }

      const result = await response.json();
      return result.prompt_id;
    } catch (error) {
      throw new Error(`ワークフロー実行エラー: ${error}`);
    }
  }

  /**
   * 生成進捗確認
   */
  async checkProgress(promptId: string): Promise<{ completed: boolean; progress?: number; error?: string }> {
    try {
      const response = await fetch(`http://localhost:8188/prompt/${promptId}`);
      
      if (!response.ok) {
        return { completed: false, error: 'プロンプトIDが見つかりません' };
      }

      const result = await response.json();
      
      // ComfyUIの実際のレスポンス形式に合わせて調整が必要
      if (result.status === 'completed') {
        return { completed: true };
      } else if (result.status === 'error') {
        return { completed: false, error: result.message };
      } else {
        return { completed: false, progress: result.progress || 0 };
      }
    } catch (error) {
      return { completed: false, error: `進捗確認エラー: ${error}` };
    }
  }

  /**
   * 最終使用日時更新
   */
  async updateLastUsed(modelId: string): Promise<void> {
    const model = Object.values(this.config).find(m => m.id === modelId);
    if (model && model.status === 'available') {
      try {
        const lastUsedFile = join(model.path, '.last_used');
        await fs.writeFile(lastUsedFile, new Date().toISOString());
        model.lastUsed = new Date();
      } catch (error) {
        console.warn(`最終使用日時更新エラー (${modelId}):`, error);
      }
    }
  }

  /**
   * リソース使用状況確認
   */
  async getResourceUsage(): Promise<{ memory: number; gpu: number; disk: number }> {
    // TODO: 実際のシステムリソース監視実装
    return {
      memory: 0, // MB
      gpu: 0,    // %
      disk: 0    // MB
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
export const modelManager = new ModelManager();