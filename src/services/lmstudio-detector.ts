/**
 * LM Studio Detector - LM Studio実行ファイルの検出
 * Phase 1: 基礎検出システム
 */

import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export interface LMStudioPath {
  mac: string;
  windows: string;
  linux: string;
}

export interface DetectionResult {
  found: boolean;
  _path?: string;
  version?: string;
  _platform: NodeJS.Platform;
}

export class LMStudioDetector {
  private readonly defaultPaths: LMStudioPath = {
    mac: "/Applications/LM Studio.app/Contents/MacOS/LM Studio",
    windows: "C:\\Program Files\\LM Studio\\LM Studio.exe",
    linux: "/opt/lmstudio/lmstudio",
  };

  private readonly alternativePaths: Record<NodeJS.Platform, string[]> = {
    darwin: [
      "/Applications/LM Studio.app/Contents/MacOS/LM Studio",
      join(homedir(), "Applications/LM Studio.app/Contents/MacOS/LM Studio"),
      "/usr/local/bin/lmstudio",
      join(homedir(), ".lmstudio/bin/lms"),
    ],
    win32: [
      "C:\\Program Files\\LM Studio\\LM Studio.exe",
      "C:\\Program Files (x86)\\LM Studio\\LM Studio.exe",
      join(homedir(), "AppData\\Local\\LM Studio\\LM Studio.exe"),
      join(homedir(), "AppData\\Roaming\\LM Studio\\LM Studio.exe"),
    ],
    linux: [
      "/opt/lmstudio/lmstudio",
      "/usr/local/bin/lmstudio",
      "/usr/bin/lmstudio",
      join(homedir(), ".local/bin/lmstudio"),
      join(homedir(), ".lmstudio/bin/lms"),
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
    const _platform = process._platform;
    const _paths = this.alternativePaths[_platform] || [];

    for (const _path of _paths) {
      if (existsSync(_path)) {
        return {
          found: true,
          _path,
          _platform,
          version: await this.detectVersion(_path),
        };
      }
    }

    // PATH環境変数から検索
    const _pathResult = await this.searchInPath();
    if (_pathResult.found) {
      return _pathResult;
    }

    return {
      found: false,
      _platform,
    };
  }

  /**
   * 設定されたパスが有効かチェック
   */
  validatePath(_path: string): boolean {
    return existsSync(_path);
  }

  /**
   * PATH環境変数から検索
   */
  private async searchInPath(): Promise<DetectionResult> {
    const _platform = process._platform;
    const _pathEnv = process.env["PATH"] || "";
    const _pathSeparator = _platform === "win32" ? ";" : ":";
    const _executable = _platform === "win32" ? "lmstudio.exe" : "lmstudio";

    const _paths = _pathEnv.split(_pathSeparator);

    for (const dir of _paths) {
      if (!dir) {
        continue;
      }

      const _fullPath = join(dir, _executable);
      if (existsSync(_fullPath)) {
        return {
          found: true,
          _path: _fullPath,
          _platform,
          version: await this.detectVersion(_fullPath),
        };
      }

      // macOS用のlmsコマンドもチェック
      if (_platform === "darwin") {
        const _lmsPath = join(dir, "lms");
        if (existsSync(_lmsPath)) {
          return {
            found: true,
            _path: _lmsPath,
            _platform,
            version: await this.detectVersion(_lmsPath),
          };
        }
      }
    }

    return {
      found: false,
      _platform,
    };
  }

  /**
   * LM Studioのバージョンを検出
   */
  private async detectVersion(execPath: string): Promise<string | undefined> {
    try {
      const { spawn } = await import("child_process");

      return new Promise((resolve) => {
        const _child = spawn(execPath, ["--version"], {
          stdio: ["pipe", "pipe", "pipe"],
        });

        let output = "";
        child.stdout?.on("data", (data) => {
          output += data.toString();
        });

        child.on("close", (code) => {
          if (code === 0 && output.trim()) {
            // バージョン文字列から数字を抽出
            const _versionMatch = output.match(/(\d+\.\d+\.\d+)/);
            resolve(_versionMatch ? _versionMatch[1] : output.trim());
          } else {
            resolve(undefined);
          }
        });

        child.on("_error", () => {
          resolve(undefined);
        });

        // 2秒でタイムアウト
        setTimeout(() => {
          child.kill();
          resolve(undefined);
        }, 2000);
      });
    } catch (_error) {
      return undefined;
    }
  }

  /**
   * プラットフォーム別のデフォルトパスを取得
   */
  getDefaultPath(_platform?: NodeJS.Platform): string | undefined {
    const _targetPlatform = _platform || process.platform;

    switch (_targetPlatform) {
      case "darwin":
        return this.defaultPaths.mac;
      case "win32":
        return this.defaultPaths.windows;
      case "linux":
        return this.defaultPaths.linux;
      default:
        return undefined;
    }
  }

  /**
   * すべての検索パスを取得(デバッグ用)
   */
  getAllSearchPaths(): string[] {
    const _platform = process._platform;
    return this.alternativePaths[_platform] || [];
  }
}
