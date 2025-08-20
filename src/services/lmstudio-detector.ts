/**
 * LM Studio Detector - LM Studio実行ファイルの検出
 * Phase 1: 基礎検出システム
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface LMStudioPath {
  mac: string;
  windows: string;
  linux: string;
}

export interface DetectionResult {
  found: boolean;
  path?: string;
  version?: string;
  platform: NodeJS.Platform;
}

export class LMStudioDetector {
  private readonly defaultPaths: LMStudioPath = {
    mac: '/Applications/LM Studio.app/Contents/MacOS/LM Studio',
    windows: 'C:\\Program Files\\LM Studio\\LM Studio.exe',
    linux: '/opt/lmstudio/lmstudio',
  };

  private readonly alternativePaths: Record<NodeJS.Platform, string[]> = {
    darwin: [
      '/Applications/LM Studio.app/Contents/MacOS/LM Studio',
      join(homedir(), 'Applications/LM Studio.app/Contents/MacOS/LM Studio'),
      '/usr/local/bin/lmstudio',
      join(homedir(), '.lmstudio/bin/lms'),
    ],
    win32: [
      'C:\\Program Files\\LM Studio\\LM Studio.exe',
      'C:\\Program Files (x86)\\LM Studio\\LM Studio.exe',
      join(homedir(), 'AppData\\Local\\LM Studio\\LM Studio.exe'),
      join(homedir(), 'AppData\\Roaming\\LM Studio\\LM Studio.exe'),
    ],
    linux: [
      '/opt/lmstudio/lmstudio',
      '/usr/local/bin/lmstudio',
      '/usr/bin/lmstudio',
      join(homedir(), '.local/bin/lmstudio'),
      join(homedir(), '.lmstudio/bin/lms'),
    ],
    // Fallbacks for other platforms
    aix: [],
    android: [],
    freebsd: [],
    haiku: [],
    openbsd: [],
    sunos: [],
    cygwin: [],
    netbsd: [],
  };

  /**
   * プラットフォームを検出し、LM Studio実行ファイルを探す
   */
  async detect(): Promise<DetectionResult> {
    const platform = process.platform;
    const paths = this.alternativePaths[platform] || [];

    for (const path of paths) {
      if (existsSync(path)) {
        return {
          found: true,
          path,
          platform,
          version: await this.detectVersion(path),
        };
      }
    }

    // PATH環境変数から検索
    const pathResult = await this.searchInPath();
    if (pathResult.found) {
      return pathResult;
    }

    return {
      found: false,
      platform,
    };
  }

  /**
   * 設定されたパスが有効かチェック
   */
  validatePath(path: string): boolean {
    return existsSync(path);
  }

  /**
   * PATH環境変数から検索
   */
  private async searchInPath(): Promise<DetectionResult> {
    const platform = process.platform;
    const pathEnv = process.env['PATH'] || '';
    const pathSeparator = platform === 'win32' ? ';' : ':';
    const executable = platform === 'win32' ? 'lmstudio.exe' : 'lmstudio';

    const paths = pathEnv.split(pathSeparator);

    for (const dir of paths) {
      if (!dir) continue;

      const fullPath = join(dir, executable);
      if (existsSync(fullPath)) {
        return {
          found: true,
          path: fullPath,
          platform,
          version: await this.detectVersion(fullPath),
        };
      }

      // macOS用のlmsコマンドもチェック
      if (platform === 'darwin') {
        const lmsPath = join(dir, 'lms');
        if (existsSync(lmsPath)) {
          return {
            found: true,
            path: lmsPath,
            platform,
            version: await this.detectVersion(lmsPath),
          };
        }
      }
    }

    return {
      found: false,
      platform,
    };
  }

  /**
   * LM Studioのバージョンを検出
   */
  private async detectVersion(execPath: string): Promise<string | undefined> {
    try {
      const { spawn } = await import('child_process');

      return new Promise((resolve) => {
        const child = spawn(execPath, ['--version'], {
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        let output = '';
        child.stdout?.on('data', (data) => {
          output += data.toString();
        });

        child.on('close', (code) => {
          if (code === 0 && output.trim()) {
            // バージョン文字列から数字を抽出
            const versionMatch = output.match(/(\d+\.\d+\.\d+)/);
            resolve(versionMatch ? versionMatch[1] : output.trim());
          } else {
            resolve(undefined);
          }
        });

        child.on('error', () => {
          resolve(undefined);
        });

        // 2秒でタイムアウト
        setTimeout(() => {
          child.kill();
          resolve(undefined);
        }, 2000);
      });
    } catch (error) {
      return undefined;
    }
  }

  /**
   * プラットフォーム別のデフォルトパスを取得
   */
  getDefaultPath(platform?: NodeJS.Platform): string | undefined {
    const targetPlatform = platform || process.platform;

    switch (targetPlatform) {
      case 'darwin':
        return this.defaultPaths.mac;
      case 'win32':
        return this.defaultPaths.windows;
      case 'linux':
        return this.defaultPaths.linux;
      default:
        return undefined;
    }
  }

  /**
   * すべての検索パスを取得（デバッグ用）
   */
  getAllSearchPaths(): string[] {
    const platform = process.platform;
    return this.alternativePaths[platform] || [];
  }
}
