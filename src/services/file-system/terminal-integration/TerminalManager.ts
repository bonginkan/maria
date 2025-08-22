/**
 * Terminal Manager - Unified Terminal Capability Detection System
 * Coordinates all terminal integrations and provides a single interface
 * Phase 2: Terminal Integration & Safety - Week 5
 */

import { EnvironmentInfo, TerminalCapabilities, terminalDetector } from './TerminalDetector';
import { vscodeIntegration, VSCodeIntegration } from './VSCodeIntegration';
import { cursorIntegration, CursorIntegration } from './CursorIntegration';

export interface TerminalManagerState {
  isInitialized: boolean;
  activeTerminal: 'vscode' | 'cursor' | 'native' | 'unknown';
  capabilities: TerminalCapabilities;
  environment: EnvironmentInfo;
  integrations: {
    vscode: boolean;
    cursor: boolean;
  };
}

export interface TerminalOperation {
  command: string;
  args: string[];
  workingDirectory?: string;
  environment?: Record<string, string>;
}

export interface TerminalResponse {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
}

export class TerminalManager {
  private static instance: TerminalManager;
  private state: TerminalManagerState | null = null;
  private initializationPromise: Promise<boolean> | null = null;

  public static getInstance(): TerminalManager {
    if (!TerminalManager.instance) {
      TerminalManager.instance = new TerminalManager();
    }
    return TerminalManager.instance;
  }

  private constructor() {}

  /**
   * Initialize the terminal manager and all integrations
   */
  async initialize(): Promise<boolean> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  /**
   * Get current terminal manager state
   */
  getState(): TerminalManagerState | null {
    return this.state;
  }

  /**
   * Check if terminal manager is ready
   */
  isReady(): boolean {
    return this.state?.isInitialized === true;
  }

  /**
   * Get terminal capabilities
   */
  getCapabilities(): TerminalCapabilities | null {
    return this.state?.capabilities || null;
  }

  /**
   * Get environment information
   */
  getEnvironment(): EnvironmentInfo | null {
    return this.state?.environment || null;
  }

  /**
   * Execute command using the appropriate terminal integration
   */
  async executeCommand(operation: TerminalOperation): Promise<TerminalResponse> {
    if (!this.isReady()) {
      await this.initialize();
    }

    if (!this.state) {
      return {
        success: false,
        error: 'Terminal manager not initialized',
      };
    }

    try {
      switch (this.state.activeTerminal) {
        case 'vscode':
          return await this.executeVSCodeCommand(operation);
        case 'cursor':
          return await this.executeCursorCommand(operation);
        case 'native':
        default:
          return await this.executeNativeCommand(operation);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Open file using the appropriate IDE integration
   */
  async openFile(filePath: string, line?: number, column?: number): Promise<boolean> {
    if (!this.isReady()) {
      await this.initialize();
    }

    if (!this.state) {
      return false;
    }

    try {
      switch (this.state.activeTerminal) {
        case 'vscode':
          return await vscodeIntegration.openFile(filePath, line, column);
        case 'cursor':
          return await cursorIntegration.openFile(filePath, line, column);
        default:
          // Fallback to native file opening
          return await this.openFileNative(filePath);
      }
    } catch (error) {
      console.error('Failed to open file:', error);
      return false;
    }
  }

  /**
   * Show notification using the appropriate integration
   */
  async showNotification(
    message: string,
    type: 'info' | 'warning' | 'error' = 'info',
  ): Promise<boolean> {
    if (!this.isReady()) {
      await this.initialize();
    }

    if (!this.state) {
      console.log(message);
      return true;
    }

    try {
      switch (this.state.activeTerminal) {
        case 'vscode':
          return await vscodeIntegration.showNotification(message, type);
        case 'cursor':
          return await cursorIntegration.showNotification(message, type);
        default:
          // Fallback to console output
          const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
          console.log(`${prefix} ${message}`);
          return true;
      }
    } catch (error) {
      console.error('Failed to show notification:', error);
      return false;
    }
  }

  /**
   * Get AI assistance features (if available)
   */
  getAIFeatures(): {
    available: boolean;
    codeGeneration: boolean;
    chatIntegration: boolean;
    contextAwareness: boolean;
    provider?: string;
  } {
    if (!this.state) {
      return {
        available: false,
        codeGeneration: false,
        chatIntegration: false,
        contextAwareness: false,
      };
    }

    switch (this.state.activeTerminal) {
      case 'cursor':
        return {
          available: true,
          codeGeneration: true,
          chatIntegration: true,
          contextAwareness: true,
          provider: 'cursor',
        };
      case 'vscode':
        return {
          available: true,
          codeGeneration: false, // Depends on extensions
          chatIntegration: false, // Depends on extensions
          contextAwareness: false,
          provider: 'vscode',
        };
      default:
        return {
          available: false,
          codeGeneration: false,
          chatIntegration: false,
          contextAwareness: false,
        };
    }
  }

  /**
   * Watch for terminal environment changes
   */
  async watchEnvironmentChanges(
    callback: (changes: Partial<TerminalManagerState>) => void,
  ): Promise<() => void> {
    const watchers: Array<() => void> = [];

    // Watch for VS Code workspace changes
    if (this.state?.integrations.vscode) {
      try {
        const vscodeWatcher = await vscodeIntegration.watchWorkspaceChanges((event, filePath) => {
          callback({ activeTerminal: 'vscode' });
        });
        watchers.push(vscodeWatcher);
      } catch (error) {
        console.debug('Failed to watch VS Code changes:', error);
      }
    }

    // Watch for Cursor workspace changes
    if (this.state?.integrations.cursor) {
      try {
        const cursorWatcher = await cursorIntegration.watchWorkspaceChanges(
          (event, filePath, aiContext) => {
            callback({ activeTerminal: 'cursor' });
          },
        );
        watchers.push(cursorWatcher);
      } catch (error) {
        console.debug('Failed to watch Cursor changes:', error);
      }
    }

    // Return cleanup function
    return () => {
      watchers.forEach((cleanup) => cleanup());
    };
  }

  /**
   * Get terminal-specific settings
   */
  async getTerminalSettings(): Promise<{
    autoSave: boolean;
    trimTrailingWhitespace: boolean;
    insertFinalNewline: boolean;
    excludePatterns: string[];
    aiFeatures?: boolean;
  }> {
    if (!this.isReady()) {
      await this.initialize();
    }

    const defaultSettings = {
      autoSave: false,
      trimTrailingWhitespace: false,
      insertFinalNewline: false,
      excludePatterns: ['**/.git/**', '**/node_modules/**', '**/.DS_Store'],
    };

    if (!this.state) {
      return defaultSettings;
    }

    try {
      switch (this.state.activeTerminal) {
        case 'vscode':
          return await vscodeIntegration.getFileOperationSettings();
        case 'cursor':
          return await cursorIntegration.getFileOperationSettings();
        default:
          return defaultSettings;
      }
    } catch (error) {
      console.debug('Failed to get terminal settings:', error);
      return defaultSettings;
    }
  }

  /**
   * Refresh terminal detection
   */
  async refresh(): Promise<boolean> {
    this.state = null;
    this.initializationPromise = null;
    return await this.initialize();
  }

  /**
   * Perform the actual initialization
   */
  private async performInitialization(): Promise<boolean> {
    try {
      console.debug('Initializing terminal manager...');

      // Detect terminal capabilities and environment
      const { capabilities, environment } = await terminalDetector.detectEnvironment();

      // Initialize integrations
      const [vscodeInitialized, cursorInitialized] = await Promise.all([
        vscodeIntegration.initialize(),
        cursorIntegration.initialize(),
      ]);

      // Determine active terminal
      let activeTerminal: TerminalManagerState['activeTerminal'] = 'unknown';

      if (capabilities.ideIntegration.cursor && cursorInitialized) {
        activeTerminal = 'cursor';
      } else if (capabilities.ideIntegration.vscode && vscodeInitialized) {
        activeTerminal = 'vscode';
      } else if (capabilities.interactiveMode) {
        activeTerminal = 'native';
      }

      this.state = {
        isInitialized: true,
        activeTerminal,
        capabilities,
        environment,
        integrations: {
          vscode: vscodeInitialized,
          cursor: cursorInitialized,
        },
      };

      console.debug(`Terminal manager initialized - Active: ${activeTerminal}`);
      return true;
    } catch (error) {
      console.error('Failed to initialize terminal manager:', error);
      return false;
    }
  }

  /**
   * Execute command in VS Code
   */
  private async executeVSCodeCommand(operation: TerminalOperation): Promise<TerminalResponse> {
    const command = `${operation.command} ${operation.args.join(' ')}`;
    const success = await vscodeIntegration.sendTerminalCommand(command);

    return {
      success,
      output: success ? 'Command sent to VS Code terminal' : undefined,
      error: success ? undefined : 'Failed to send command to VS Code terminal',
    };
  }

  /**
   * Execute command in Cursor
   */
  private async executeCursorCommand(operation: TerminalOperation): Promise<TerminalResponse> {
    const command = `${operation.command} ${operation.args.join(' ')}`;
    const success = await cursorIntegration.sendTerminalCommand(command);

    return {
      success,
      output: success ? 'Command sent to Cursor terminal' : undefined,
      error: success ? undefined : 'Failed to send command to Cursor terminal',
    };
  }

  /**
   * Execute command natively
   */
  private async executeNativeCommand(operation: TerminalOperation): Promise<TerminalResponse> {
    return new Promise((resolve) => {
      const { spawn } = require('child_process');

      const proc = spawn(operation.command, operation.args, {
        cwd: operation.workingDirectory || process.cwd(),
        env: { ...process.env, ...operation.environment },
        stdio: 'pipe',
      });

      let output = '';
      let error = '';

      proc.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      proc.stderr?.on('data', (data: Buffer) => {
        error += data.toString();
      });

      proc.on('close', (code: number | null) => {
        resolve({
          success: code === 0,
          output: output.trim(),
          error: error.trim() || undefined,
          exitCode: code || undefined,
        });
      });

      proc.on('error', (err: Error) => {
        resolve({
          success: false,
          error: err.message,
        });
      });
    });
  }

  /**
   * Open file natively
   */
  private async openFileNative(filePath: string): Promise<boolean> {
    try {
      const { spawn } = require('child_process');

      // Determine the appropriate command based on platform
      let command: string;
      let args: string[];

      switch (process.platform) {
        case 'darwin':
          command = 'open';
          args = [filePath];
          break;
        case 'linux':
          command = 'xdg-open';
          args = [filePath];
          break;
        case 'win32':
          command = 'start';
          args = ['', filePath];
          break;
        default:
          console.error('Unsupported platform for opening files');
          return false;
      }

      const proc = spawn(command, args, { stdio: 'ignore' });

      return new Promise((resolve) => {
        proc.on('close', (code) => {
          resolve(code === 0);
        });

        proc.on('error', () => {
          resolve(false);
        });
      });
    } catch (error) {
      console.error('Failed to open file natively:', error);
      return false;
    }
  }
}

export const terminalManager = TerminalManager.getInstance();
