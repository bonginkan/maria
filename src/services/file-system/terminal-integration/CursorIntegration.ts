/**
 * Cursor IDE Integration Support
 * Provides seamless integration with Cursor IDE terminals and workspace
 * Phase 2: Terminal Integration & Safety - Week 5
 */

import * as path from 'path';
import * as fs from 'fs';
import { terminalDetector, TerminalCapabilities } from './TerminalDetector';

export interface CursorWorkspace {
  name: string;
  path: string;
  folders: Array<{ name: string; path: string }>;
  settings: Record<string, unknown>;
  extensions: string[];
  aiSettings?: {
    modelPreferences?: Record<string, unknown>;
    codeAssistance?: boolean;
    autoCompletion?: boolean;
  };
}

export interface CursorTerminalInfo {
  terminalId: string;
  workingDirectory: string;
  shellType: string;
  environmentVariables: Record<string, string>;
  aiFeatures: {
    codeGeneration: boolean;
    chatIntegration: boolean;
    contextAwareness: boolean;
  };
}

export interface CursorIntegrationFeatures {
  workspaceManagement: boolean;
  terminalAccess: boolean;
  fileSystemEvents: boolean;
  settingsAccess: boolean;
  aiIntegration: boolean;
  composerAccess: boolean;
}

export class CursorIntegration {
  private static instance: CursorIntegration;
  private capabilities: TerminalCapabilities | null = null;
  private workspace: CursorWorkspace | null = null;
  private features: CursorIntegrationFeatures | null = null;

  public static getInstance(): CursorIntegration {
    if (!CursorIntegration.instance) {
      CursorIntegration.instance = new CursorIntegration();
    }
    return CursorIntegration.instance;
  }

  private constructor() {}

  /**
   * Initialize Cursor IDE integration
   */
  async initialize(): Promise<boolean> {
    try {
      this.capabilities = await terminalDetector.refreshCapabilities();

      if (!this.capabilities.ideIntegration.cursor) {
        console.debug('Cursor IDE not detected, skipping integration');
        return false;
      }

      this.features = await this.detectIntegrationFeatures();
      this.workspace = await this.detectWorkspace();

      console.debug('Cursor IDE integration initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Cursor IDE integration:', error);
      return false;
    }
  }

  /**
   * Check if Cursor IDE integration is available and active
   */
  isAvailable(): boolean {
    return this.capabilities?.ideIntegration.cursor === true;
  }

  /**
   * Get current workspace information
   */
  getWorkspace(): CursorWorkspace | null {
    return this.workspace;
  }

  /**
   * Get available integration features
   */
  getFeatures(): CursorIntegrationFeatures | null {
    return this.features;
  }

  /**
   * Get terminal information with AI features
   */
  getTerminalInfo(): CursorTerminalInfo {
    return {
      terminalId: process.env.CURSOR_SESSION_ID || process.env.TERM_SESSION_ID || 'unknown',
      workingDirectory: process.cwd(),
      shellType: this.capabilities?.shellType || 'unknown',
      environmentVariables: { ...process.env },
      aiFeatures: {
        codeGeneration: true, // Cursor has built-in AI code generation
        chatIntegration: true, // Cursor has AI chat
        contextAwareness: true, // Cursor is context-aware
      },
    };
  }

  /**
   * Send command to Cursor terminal
   */
  async sendTerminalCommand(command: string): Promise<boolean> {
    try {
      if (!this.isAvailable()) {
        throw new Error('Cursor IDE integration not available');
      }

      // For Cursor integrated terminal, we can write directly to stdout
      // This will appear in the terminal as if the user typed it
      process.stdout.write(`\n${command}\n`);
      return true;
    } catch (error) {
      console.error('Failed to send terminal command:', error);
      return false;
    }
  }

  /**
   * Open file in Cursor editor
   */
  async openFile(filePath: string, line?: number, column?: number): Promise<boolean> {
    try {
      if (!this.isAvailable()) {
        throw new Error('Cursor IDE integration not available');
      }

      const resolvedPath = path.resolve(filePath);

      // Use Cursor command to open file
      let command = `cursor "${resolvedPath}"`;

      if (line !== undefined) {
        command += ` --goto ${line}`;
        if (column !== undefined) {
          command += `:${column}`;
        }
      }

      await this.executeCursorCommand(command);
      return true;
    } catch (error) {
      console.error('Failed to open file in Cursor:', error);
      return false;
    }
  }

  /**
   * Create new file with Cursor and AI assistance
   */
  async createFileWithAI(filePath: string, prompt?: string, content?: string): Promise<boolean> {
    try {
      if (!this.isAvailable()) {
        throw new Error('Cursor IDE integration not available');
      }

      const resolvedPath = path.resolve(filePath);

      // Create file with initial content if provided
      if (content !== undefined) {
        await fs.promises.writeFile(resolvedPath, content);
      }

      // Open the file in Cursor
      await this.openFile(resolvedPath);

      // If prompt is provided, suggest using Cursor's AI features
      if (prompt) {
        console.log(`💡 AI Suggestion: Use Cursor's AI chat with this prompt: "${prompt}"`);
        console.log('   You can open the chat panel and use this prompt to generate code.');
      }

      return true;
    } catch (error) {
      console.error('Failed to create file with AI in Cursor:', error);
      return false;
    }
  }

  /**
   * Trigger Cursor AI code generation
   */
  async triggerAICodeGeneration(filePath: string, prompt: string): Promise<boolean> {
    try {
      if (!this.isAvailable()) {
        throw new Error('Cursor IDE integration not available');
      }

      // Open the file first
      await this.openFile(filePath);

      // Display instructions for AI code generation
      console.log('\n🤖 AI Code Generation with Cursor:');
      console.log(`   1. File opened: ${filePath}`);
      console.log(`   2. Use Ctrl+K (or Cmd+K) to trigger AI code generation`);
      console.log(`   3. Enter prompt: "${prompt}"`);
      console.log('   4. Let Cursor AI generate the code for you\n');

      return true;
    } catch (error) {
      console.error('Failed to trigger AI code generation:', error);
      return false;
    }
  }

  /**
   * Show notification in Cursor
   */
  async showNotification(
    message: string,
    type: 'info' | 'warning' | 'error' = 'info',
  ): Promise<boolean> {
    try {
      if (!this.isAvailable()) {
        throw new Error('Cursor IDE integration not available');
      }

      // For now, we'll output to the terminal with appropriate formatting
      // In a full extension, this would use the Cursor notification API
      const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
      console.log(`${prefix} [Cursor] ${message}`);

      return true;
    } catch (error) {
      console.error('Failed to show notification:', error);
      return false;
    }
  }

  /**
   * Get Cursor AI settings for file operations
   */
  async getAISettings(): Promise<{
    codeGeneration: boolean;
    autoCompletion: boolean;
    modelPreferences: Record<string, unknown>;
    contextLength: number;
  }> {
    const defaultSettings = {
      codeGeneration: true,
      autoCompletion: true,
      modelPreferences: {},
      contextLength: 8192,
    };

    try {
      if (!this.workspace) {
        return defaultSettings;
      }

      // Try to read Cursor AI settings
      const settingsPath = path.join(this.workspace.path, '.cursor', 'settings.json');

      if (await this.fileExists(settingsPath)) {
        const settingsContent = await fs.promises.readFile(settingsPath, 'utf8');
        const settings = JSON.parse(settingsContent);

        return {
          codeGeneration: settings['cursor.ai.codeGeneration'] !== false,
          autoCompletion: settings['cursor.ai.autoCompletion'] !== false,
          modelPreferences: settings['cursor.ai.modelPreferences'] || {},
          contextLength: settings['cursor.ai.contextLength'] || defaultSettings.contextLength,
        };
      }
    } catch (error) {
      console.debug('Could not read Cursor AI settings:', error);
    }

    return defaultSettings;
  }

  /**
   * Get Cursor-specific file operation settings
   */
  async getFileOperationSettings(): Promise<{
    autoSave: boolean;
    trimTrailingWhitespace: boolean;
    insertFinalNewline: boolean;
    excludePatterns: string[];
    aiCodeAssistance: boolean;
  }> {
    const defaultSettings = {
      autoSave: false,
      trimTrailingWhitespace: false,
      insertFinalNewline: false,
      excludePatterns: ['**/.git/**', '**/node_modules/**', '**/.DS_Store', '**/.cursor/**'],
      aiCodeAssistance: true,
    };

    try {
      if (!this.workspace) {
        return defaultSettings;
      }

      // Try to read Cursor settings (uses similar structure to VS Code)
      const settingsPath = path.join(this.workspace.path, '.cursor', 'settings.json');

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
          aiCodeAssistance: settings['cursor.ai.enabled'] !== false,
        };
      }
    } catch (error) {
      console.debug('Could not read Cursor settings:', error);
    }

    return defaultSettings;
  }

  /**
   * Watch for Cursor workspace changes with AI awareness
   */
  async watchWorkspaceChanges(
    callback: (event: string, filePath: string, aiContext?: boolean) => void,
  ): Promise<() => void> {
    if (!this.workspace) {
      throw new Error('No workspace available for watching');
    }

    const watcher = fs.watch(this.workspace.path, { recursive: true }, (eventType, filename) => {
      if (filename) {
        const fullPath = path.join(this.workspace!.path, filename);

        // Check if this might be an AI-generated change
        const isAIContext =
          filename.includes('.cursor') ||
          filename.includes('ai-generated') ||
          filename.includes('composer');

        callback(eventType, fullPath, isAIContext);
      }
    });

    // Return cleanup function
    return () => {
      watcher.close();
    };
  }

  /**
   * Get workspace files with Cursor AI patterns
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
   * Suggest AI-powered file operations
   */
  async suggestAIOperations(operation: string, files: string[]): Promise<string[]> {
    const suggestions: string[] = [];

    switch (operation) {
      case 'refactor':
        suggestions.push('Use Ctrl+K to generate refactored code');
        suggestions.push('Select code and use AI chat for refactoring suggestions');
        break;
      case 'document':
        suggestions.push('Use AI to generate documentation comments');
        suggestions.push('Ask AI to explain complex code sections');
        break;
      case 'optimize':
        suggestions.push('Request AI optimization suggestions');
        suggestions.push('Use AI to identify performance bottlenecks');
        break;
      case 'test':
        suggestions.push('Generate unit tests with AI assistance');
        suggestions.push('Create test cases using AI prompts');
        break;
      default:
        suggestions.push('Use Cursor AI features for intelligent code assistance');
    }

    return suggestions;
  }

  /**
   * Detect Cursor IDE integration features
   */
  private async detectIntegrationFeatures(): Promise<CursorIntegrationFeatures> {
    return {
      workspaceManagement: true, // Always available in Cursor
      terminalAccess: process.env.CURSOR === '1' || process.env.TERM_PROGRAM === 'cursor',
      fileSystemEvents: true, // Node.js fs.watch is available
      settingsAccess: await this.hasSettingsAccess(),
      aiIntegration: true, // Cursor has built-in AI
      composerAccess: await this.hasComposerAccess(),
    };
  }

  /**
   * Detect current workspace
   */
  private async detectWorkspace(): Promise<CursorWorkspace | null> {
    try {
      const workspacePath = this.capabilities?.ideIntegration.workspacePath || process.cwd();
      const workspaceName = path.basename(workspacePath);

      // Look for Cursor workspace file
      const workspaceFile = path.join(workspacePath, `${workspaceName}.cursor-workspace`);
      let folders: Array<{ name: string; path: string }> = [];
      let settings: Record<string, unknown> = {};
      let aiSettings: CursorWorkspace['aiSettings'] = {};

      if (await this.fileExists(workspaceFile)) {
        try {
          const workspaceContent = await fs.promises.readFile(workspaceFile, 'utf8');
          const workspaceData = JSON.parse(workspaceContent);

          folders = workspaceData.folders || [];
          settings = workspaceData.settings || {};
          aiSettings = workspaceData.aiSettings || {};
        } catch (error) {
          console.debug('Could not parse Cursor workspace file:', error);
        }
      } else {
        // Single folder workspace
        folders = [{ name: workspaceName, path: workspacePath }];
      }

      // Try to read AI settings
      const aiSettingsPath = path.join(workspacePath, '.cursor', 'ai-settings.json');
      if (await this.fileExists(aiSettingsPath)) {
        try {
          const aiSettingsContent = await fs.promises.readFile(aiSettingsPath, 'utf8');
          aiSettings = JSON.parse(aiSettingsContent);
        } catch (error) {
          console.debug('Could not parse AI settings:', error);
        }
      }

      const extensions = await this.getInstalledExtensions();

      return {
        name: workspaceName,
        path: workspacePath,
        folders,
        settings,
        extensions,
        aiSettings,
      };
    } catch (error) {
      console.debug('Could not detect Cursor workspace:', error);
      return null;
    }
  }

  /**
   * Check if settings access is available
   */
  private async hasSettingsAccess(): Promise<boolean> {
    try {
      const settingsPath = path.join(process.cwd(), '.cursor', 'settings.json');
      await fs.promises.access(settingsPath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if Cursor Composer access is available
   */
  private async hasComposerAccess(): Promise<boolean> {
    try {
      const composerPath = path.join(process.cwd(), '.cursor', 'composer');
      await fs.promises.access(composerPath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get installed Cursor extensions
   */
  private async getInstalledExtensions(): Promise<string[]> {
    try {
      const extensionsPath = path.join(process.cwd(), '.cursor', 'extensions.json');

      if (await this.fileExists(extensionsPath)) {
        const extensionsContent = await fs.promises.readFile(extensionsPath, 'utf8');
        const extensionsData = JSON.parse(extensionsContent);
        return extensionsData.recommendations || [];
      }
    } catch (error) {
      console.debug('Could not read Cursor extensions:', error);
    }

    return [];
  }

  /**
   * Execute Cursor command
   */
  private async executeCursorCommand(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      const proc = spawn('sh', ['-c', command], { stdio: 'pipe' });

      proc.on('close', (code: number) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Cursor command failed with exit code ${code}`));
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

export const cursorIntegration = CursorIntegration.getInstance();
