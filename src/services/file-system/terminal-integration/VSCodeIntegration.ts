/**
 * VS Code Extension Integration Hooks
 * Provides seamless integration with VS Code terminals and workspace
 * Phase 2: Terminal Integration & Safety - Week 5
 */

import * as path from 'path';
import * as fs from 'fs';
import { TerminalCapabilities, terminalDetector } from './TerminalDetector';

export interface VSCodeWorkspace {
  name: string;
  path: string;
  folders: Array<{ name: string; path: string }>;
  settings: Record<string, unknown>;
  extensions: string[];
}

export interface VSCodeTerminalInfo {
  terminalId: string;
  workingDirectory: string;
  shellType: string;
  environmentVariables: Record<string, string>;
}

export interface VSCodeIntegrationFeatures {
  workspaceManagement: boolean;
  terminalAccess: boolean;
  fileSystemEvents: boolean;
  settingsAccess: boolean;
  extensionAPI: boolean;
}

export class VSCodeIntegration {
  private static instance: VSCodeIntegration;
  private capabilities: TerminalCapabilities | null = null;
  private workspace: VSCodeWorkspace | null = null;
  private features: VSCodeIntegrationFeatures | null = null;

  public static getInstance(): VSCodeIntegration {
    if (!VSCodeIntegration.instance) {
      VSCodeIntegration.instance = new VSCodeIntegration();
    }
    return VSCodeIntegration.instance;
  }

  private constructor() {}

  /**
   * Initialize VS Code integration
   */
  async initialize(): Promise<boolean> {
    try {
      this.capabilities = await terminalDetector.refreshCapabilities();

      if (!this.capabilities.ideIntegration.vscode) {
        console.debug('VS Code not detected, skipping integration');
        return false;
      }

      this.features = await this.detectIntegrationFeatures();
      this.workspace = await this.detectWorkspace();

      console.debug('VS Code integration initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize VS Code integration:', error);
      return false;
    }
  }

  /**
   * Check if VS Code integration is available and active
   */
  isAvailable(): boolean {
    return this.capabilities?.ideIntegration.vscode === true;
  }

  /**
   * Get current workspace information
   */
  getWorkspace(): VSCodeWorkspace | null {
    return this.workspace;
  }

  /**
   * Get available integration features
   */
  getFeatures(): VSCodeIntegrationFeatures | null {
    return this.features;
  }

  /**
   * Get terminal information
   */
  getTerminalInfo(): VSCodeTerminalInfo {
    return {
      terminalId: process.env.TERM_SESSION_ID || 'unknown',
      workingDirectory: process.cwd(),
      shellType: this.capabilities?.shellType || 'unknown',
      environmentVariables: { ...process.env },
    };
  }

  /**
   * Send command to VS Code terminal
   */
  async sendTerminalCommand(command: string): Promise<boolean> {
    try {
      if (!this.isAvailable()) {
        throw new Error('VS Code integration not available');
      }

      // For VS Code integrated terminal, we can write directly to stdout
      // This will appear in the terminal as if the user typed it
      process.stdout.write(`\n${command}\n`);
      return true;
    } catch (error) {
      console.error('Failed to send terminal command:', error);
      return false;
    }
  }

  /**
   * Open file in VS Code editor
   */
  async openFile(filePath: string, line?: number, column?: number): Promise<boolean> {
    try {
      if (!this.isAvailable()) {
        throw new Error('VS Code integration not available');
      }

      const resolvedPath = path.resolve(filePath);

      // Use VS Code command to open file
      let command = `code "${resolvedPath}"`;

      if (line !== undefined) {
        command += ` --goto ${line}`;
        if (column !== undefined) {
          command += `:${column}`;
        }
      }

      await this.executeVSCodeCommand(command);
      return true;
    } catch (error) {
      console.error('Failed to open file in VS Code:', error);
      return false;
    }
  }

  /**
   * Create new file with VS Code
   */
  async createFile(filePath: string, content?: string): Promise<boolean> {
    try {
      if (!this.isAvailable()) {
        throw new Error('VS Code integration not available');
      }

      const resolvedPath = path.resolve(filePath);

      // Create file with content if provided
      if (content !== undefined) {
        await fs.promises.writeFile(resolvedPath, content);
      }

      // Open the file in VS Code
      await this.openFile(resolvedPath);
      return true;
    } catch (error) {
      console.error('Failed to create file in VS Code:', error);
      return false;
    }
  }

  /**
   * Show notification in VS Code
   */
  async showNotification(
    message: string,
    type: 'info' | 'warning' | 'error' = 'info',
  ): Promise<boolean> {
    try {
      if (!this.isAvailable()) {
        throw new Error('VS Code integration not available');
      }

      // For now, we'll output to the terminal with appropriate formatting
      // In a full extension, this would use the VS Code notification API
      const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
      console.log(`${prefix} ${message}`);

      return true;
    } catch (error) {
      console.error('Failed to show notification:', error);
      return false;
    }
  }

  /**
   * Get VS Code settings for file operations
   */
  async getFileOperationSettings(): Promise<{
    autoSave: boolean;
    trimTrailingWhitespace: boolean;
    insertFinalNewline: boolean;
    excludePatterns: string[];
  }> {
    const defaultSettings = {
      autoSave: false,
      trimTrailingWhitespace: false,
      insertFinalNewline: false,
      excludePatterns: ['**/.git/**', '**/node_modules/**', '**/.DS_Store'],
    };

    try {
      if (!this.workspace) {
        return defaultSettings;
      }

      // Try to read VS Code settings
      const settingsPath = path.join(this.workspace.path, '.vscode', 'settings.json');

      if (await this.fileExists(settingsPath)) {
        const settingsContent = await fs.promises.readFile(settingsPath, 'utf8');
        const settings = JSON.parse(settingsContent);

        return {
          autoSave:
            settings['files.autoSave'] === 'afterDelay' ||
            settings['files.autoSave'] === 'onFocusChange',
          trimTrailingWhitespace: settings['files.trimTrailingWhitespace'] === true,
          insertFinalNewline: settings['files.insertFinalNewline'] === true,
          excludePatterns: settings['files.exclude']
            ? Object.keys(settings['files.exclude'])
            : defaultSettings.excludePatterns,
        };
      }
    } catch (error) {
      console.debug('Could not read VS Code settings:', error);
    }

    return defaultSettings;
  }

  /**
   * Watch for VS Code workspace changes
   */
  async watchWorkspaceChanges(
    callback: (event: string, filePath: string) => void,
  ): Promise<() => void> {
    if (!this.workspace) {
      throw new Error('No workspace available for watching');
    }

    const watcher = fs.watch(this.workspace.path, { recursive: true }, (eventType, filename) => {
      if (filename) {
        const fullPath = path.join(this.workspace!.path, filename);
        callback(eventType, fullPath);
      }
    });

    // Return cleanup function
    return () => {
      watcher.close();
    };
  }

  /**
   * Get workspace files with VS Code patterns
   */
  async getWorkspaceFiles(
    includePatterns?: string[],
    excludePatterns?: string[],
  ): Promise<string[]> {
    if (!this.workspace) {
      throw new Error('No workspace available');
    }

    const settings = await this.getFileOperationSettings();
    const excludes = excludePatterns || settings.excludePatterns;

    return this.findFilesInDirectory(this.workspace.path, includePatterns, excludes);
  }

  /**
   * Detect VS Code integration features
   */
  private async detectIntegrationFeatures(): Promise<VSCodeIntegrationFeatures> {
    return {
      workspaceManagement: true, // Always available in VS Code
      terminalAccess: process.env.VSCODE_INJECTION === '1',
      fileSystemEvents: true, // Node.js fs.watch is available
      settingsAccess: await this.hasSettingsAccess(),
      extensionAPI: false, // Would need actual extension for full API access
    };
  }

  /**
   * Detect current workspace
   */
  private async detectWorkspace(): Promise<VSCodeWorkspace | null> {
    try {
      const workspacePath = this.capabilities?.ideIntegration.workspacePath || process.cwd();
      const workspaceName = path.basename(workspacePath);

      // Look for workspace file
      const workspaceFile = path.join(workspacePath, `${workspaceName}.code-workspace`);
      let folders: Array<{ name: string; path: string }> = [];
      let settings: Record<string, unknown> = {};

      if (await this.fileExists(workspaceFile)) {
        try {
          const workspaceContent = await fs.promises.readFile(workspaceFile, 'utf8');
          const workspaceData = JSON.parse(workspaceContent);

          folders = workspaceData.folders || [];
          settings = workspaceData.settings || {};
        } catch (error) {
          console.debug('Could not parse workspace file:', error);
        }
      } else {
        // Single folder workspace
        folders = [{ name: workspaceName, path: workspacePath }];
      }

      const extensions = await this.getInstalledExtensions();

      return {
        name: workspaceName,
        path: workspacePath,
        folders,
        settings,
        extensions,
      };
    } catch (error) {
      console.debug('Could not detect workspace:', error);
      return null;
    }
  }

  /**
   * Check if settings access is available
   */
  private async hasSettingsAccess(): Promise<boolean> {
    try {
      const settingsPath = path.join(process.cwd(), '.vscode', 'settings.json');
      await fs.promises.access(settingsPath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get installed VS Code extensions
   */
  private async getInstalledExtensions(): Promise<string[]> {
    try {
      const extensionsPath = path.join(process.cwd(), '.vscode', 'extensions.json');

      if (await this.fileExists(extensionsPath)) {
        const extensionsContent = await fs.promises.readFile(extensionsPath, 'utf8');
        const extensionsData = JSON.parse(extensionsContent);
        return extensionsData.recommendations || [];
      }
    } catch (error) {
      console.debug('Could not read extensions:', error);
    }

    return [];
  }

  /**
   * Execute VS Code command
   */
  private async executeVSCodeCommand(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      const proc = spawn('sh', ['-c', command], { stdio: 'pipe' });

      proc.on('close', (code: number) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`VS Code command failed with exit code ${code}`));
        }
      });

      proc.on('error', (error: Error) => {
        reject(error);
      });
    });
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Find files in directory with patterns
   */
  private async findFilesInDirectory(
    directory: string,
    includePatterns?: string[],
    excludePatterns?: string[],
  ): Promise<string[]> {
    const files: string[] = [];

    const processDirectory = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(directory, fullPath);

          // Check exclude patterns
          if (excludePatterns?.some((pattern) => this.matchesPattern(relativePath, pattern))) {
            continue;
          }

          if (entry.isFile()) {
            // Check include patterns
            if (
              !includePatterns ||
              includePatterns.some((pattern) => this.matchesPattern(relativePath, pattern))
            ) {
              files.push(fullPath);
            }
          } else if (entry.isDirectory()) {
            await processDirectory(fullPath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
        console.debug(`Skipping directory ${dir}:`, error);
      }
    };

    await processDirectory(directory);
    return files.sort();
  }

  /**
   * Simple pattern matching (supports * wildcards)
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }
}

export const vscodeIntegration = VSCodeIntegration.getInstance();
