/**
 * Terminal Detection and Environment Discovery System
 * Detects terminal capabilities, IDE integrations, and environment features
 * Phase 2: Terminal Integration & Safety - Week 5
 */

import { spawn } from 'child_process';
import * as os from 'os';
import * as process from 'process';

export interface TerminalCapabilities {
  // Terminal Type Detection
  terminalType:
    | 'vscode'
    | 'cursor'
    | 'iterm2'
    | 'terminal'
    | 'gnome-terminal'
    | 'konsole'
    | 'unknown';

  // Display Capabilities
  colorSupport: '16' | '256' | 'truecolor' | 'none';
  unicodeSupport: boolean;
  columns: number;
  rows: number;

  // Interactive Features
  interactiveMode: boolean;
  elevationSupport: boolean;
  shellType: 'bash' | 'zsh' | 'fish' | 'sh' | 'cmd' | 'powershell' | 'unknown';

  // IDE Integration
  ideIntegration: {
    vscode: boolean;
    cursor: boolean;
    hasWorkspace: boolean;
    workspacePath?: string;
  };

  // Platform Features
  platform: 'darwin' | 'linux' | 'win32';
  hasTrashSupport: boolean;
  hasSudoSupport: boolean;
  hasFileWatcher: boolean;
}

export interface EnvironmentInfo {
  homeDirectory: string;
  currentWorkingDirectory: string;
  pathVariable: string[];
  environmentVariables: Record<string, string>;
  availableCommands: string[];
}

export class TerminalDetector {
  private static instance: TerminalDetector;
  private capabilities: TerminalCapabilities | null = null;
  private environmentInfo: EnvironmentInfo | null = null;

  public static getInstance(): TerminalDetector {
    if (!TerminalDetector.instance) {
      TerminalDetector.instance = new TerminalDetector();
    }
    return TerminalDetector.instance;
  }

  private constructor() {}

  /**
   * Detect all terminal capabilities and environment info
   */
  async detectEnvironment(): Promise<{
    capabilities: TerminalCapabilities;
    environment: EnvironmentInfo;
  }> {
    if (!this.capabilities || !this.environmentInfo) {
      this.capabilities = await this.detectTerminalCapabilities();
      this.environmentInfo = await this.detectEnvironmentInfo();
    }

    return {
      capabilities: this.capabilities,
      environment: this.environmentInfo,
    };
  }

  /**
   * Get cached capabilities without re-detection
   */
  getCachedCapabilities(): TerminalCapabilities | null {
    return this.capabilities;
  }

  /**
   * Force refresh of terminal capabilities
   */
  async refreshCapabilities(): Promise<TerminalCapabilities> {
    this.capabilities = await this.detectTerminalCapabilities();
    return this.capabilities;
  }

  /**
   * Detect terminal type and capabilities
   */
  private async detectTerminalCapabilities(): Promise<TerminalCapabilities> {
    const startTime = Date.now();

    const capabilities: TerminalCapabilities = {
      terminalType: await this.detectTerminalType(),
      colorSupport: this.detectColorSupport(),
      unicodeSupport: this.detectUnicodeSupport(),
      columns: process.stdout.columns || 80,
      rows: process.stdout.rows || 24,
      interactiveMode: this.detectInteractiveMode(),
      elevationSupport: await this.detectElevationSupport(),
      shellType: this.detectShellType(),
      ideIntegration: await this.detectIDEIntegration(),
      platform: process.platform as 'darwin' | 'linux' | 'win32',
      hasTrashSupport: await this.detectTrashSupport(),
      hasSudoSupport: await this.detectSudoSupport(),
      hasFileWatcher: this.detectFileWatcherSupport(),
    };

    const detectionTime = Date.now() - startTime;
    console.debug(`Terminal detection completed in ${detectionTime}ms`);

    return capabilities;
  }

  /**
   * Detect specific terminal application
   */
  private async detectTerminalType(): Promise<TerminalCapabilities['terminalType']> {
    // VS Code Terminal Detection
    if (
      process.env.VSCODE_INJECTION === '1' ||
      process.env.TERM_PROGRAM === 'vscode' ||
      process.env.VSCODE_PID
    ) {
      return 'vscode';
    }

    // Cursor IDE Detection
    if (process.env.CURSOR === '1' || process.env.TERM_PROGRAM === 'cursor') {
      return 'cursor';
    }

    // iTerm2 Detection (Mac)
    if (process.env.TERM_PROGRAM === 'iTerm.app' || process.env.ITERM_SESSION_ID) {
      return 'iterm2';
    }

    // Terminal.app Detection (Mac)
    if (process.env.TERM_PROGRAM === 'Apple_Terminal') {
      return 'terminal';
    }

    // GNOME Terminal Detection (Linux)
    if (process.env.GNOME_TERMINAL_SERVICE || process.env.GNOME_TERMINAL_SCREEN) {
      return 'gnome-terminal';
    }

    // Konsole Detection (KDE)
    if (process.env.KONSOLE_VERSION || process.env.KONSOLE_DBUS_SESSION) {
      return 'konsole';
    }

    return 'unknown';
  }

  /**
   * Detect color support level
   */
  private detectColorSupport(): TerminalCapabilities['colorSupport'] {
    // Check for true color support
    if (process.env.COLORTERM === 'truecolor' || process.env.COLORTERM === '24bit') {
      return 'truecolor';
    }

    // Check TERM variable
    const term = process.env.TERM?.toLowerCase();
    if (term) {
      if (term.includes('256color') || term.includes('256')) {
        return '256';
      }
      if (term.includes('color')) {
        return '16';
      }
    }

    // VS Code and modern terminals generally support 256 colors
    if (process.env.VSCODE_INJECTION === '1' || process.env.TERM_PROGRAM === 'vscode') {
      return 'truecolor';
    }

    // Fallback based on platform
    if (process.platform === 'win32') {
      return '16'; // Windows Command Prompt default
    }

    return '256'; // Most modern terminals
  }

  /**
   * Detect Unicode support
   */
  private detectUnicodeSupport(): boolean {
    const lang = process.env.LANG || process.env.LC_ALL || '';

    // Check for UTF-8 in locale
    if (lang.includes('UTF-8') || lang.includes('utf8')) {
      return true;
    }

    // Modern terminals and IDEs generally support Unicode
    if (
      process.env.VSCODE_INJECTION === '1' ||
      process.env.TERM_PROGRAM === 'vscode' ||
      process.env.CURSOR === '1'
    ) {
      return true;
    }

    // Default to true for modern systems
    return true;
  }

  /**
   * Detect if running in interactive mode
   */
  private detectInteractiveMode(): boolean {
    return process.stdin.isTTY === true && process.stdout.isTTY === true;
  }

  /**
   * Detect elevation/sudo support
   */
  private async detectElevationSupport(): Promise<boolean> {
    if (process.platform === 'win32') {
      // Windows: Check if running as Administrator
      try {
        await this.executeCommand('net', ['session'], { timeout: 1000 });
        return true;
      } catch {
        return false;
      }
    } else {
      // Unix-like: Check for sudo availability
      try {
        await this.executeCommand('which', ['sudo'], { timeout: 1000 });
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Detect shell type
   */
  private detectShellType(): TerminalCapabilities['shellType'] {
    const shell = process.env.SHELL || process.env.ComSpec || '';

    if (shell.includes('zsh')) return 'zsh';
    if (shell.includes('bash')) return 'bash';
    if (shell.includes('fish')) return 'fish';
    if (shell.includes('cmd')) return 'cmd';
    if (shell.includes('powershell') || shell.includes('pwsh')) return 'powershell';
    if (shell.includes('sh')) return 'sh';

    return 'unknown';
  }

  /**
   * Detect IDE integration capabilities
   */
  private async detectIDEIntegration(): Promise<TerminalCapabilities['ideIntegration']> {
    const integration = {
      vscode: false,
      cursor: false,
      hasWorkspace: false,
      workspacePath: undefined as string | undefined,
    };

    // VS Code Detection
    if (
      process.env.VSCODE_INJECTION === '1' ||
      process.env.TERM_PROGRAM === 'vscode' ||
      process.env.VSCODE_PID
    ) {
      integration.vscode = true;

      // Check for workspace
      if (process.env.VSCODE_CWD) {
        integration.hasWorkspace = true;
        integration.workspacePath = process.env.VSCODE_CWD;
      }
    }

    // Cursor IDE Detection
    if (process.env.CURSOR === '1' || process.env.TERM_PROGRAM === 'cursor') {
      integration.cursor = true;

      // Check for workspace (Cursor uses similar env vars to VS Code)
      if (process.env.CURSOR_CWD || process.env.VSCODE_CWD) {
        integration.hasWorkspace = true;
        integration.workspacePath = process.env.CURSOR_CWD || process.env.VSCODE_CWD;
      }
    }

    return integration;
  }

  /**
   * Detect trash/recycle bin support
   */
  private async detectTrashSupport(): Promise<boolean> {
    try {
      if (process.platform === 'darwin') {
        // macOS: Check for osascript (for Trash support)
        await this.executeCommand('which', ['osascript'], { timeout: 1000 });
        return true;
      } else if (process.platform === 'linux') {
        // Linux: Check for trash-cli or gio
        try {
          await this.executeCommand('which', ['trash'], { timeout: 1000 });
          return true;
        } catch {
          await this.executeCommand('which', ['gio'], { timeout: 1000 });
          return true;
        }
      } else if (process.platform === 'win32') {
        // Windows: Recycle bin is always available
        return true;
      }
    } catch {
      // If detection fails, assume no trash support
    }

    return false;
  }

  /**
   * Detect sudo support
   */
  private async detectSudoSupport(): Promise<boolean> {
    if (process.platform === 'win32') {
      return false; // Windows uses different elevation mechanism
    }

    try {
      await this.executeCommand('which', ['sudo'], { timeout: 1000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Detect file watcher support
   */
  private detectFileWatcherSupport(): boolean {
    // Node.js fs.watch is available on all platforms
    return true;
  }

  /**
   * Detect environment information
   */
  private async detectEnvironmentInfo(): Promise<EnvironmentInfo> {
    const pathVar = process.env.PATH || process.env.Path || '';
    const pathArray = pathVar.split(process.platform === 'win32' ? ';' : ':').filter(Boolean);

    return {
      homeDirectory: os.homedir(),
      currentWorkingDirectory: process.cwd(),
      pathVariable: pathArray,
      environmentVariables: { ...process.env },
      availableCommands: await this.detectAvailableCommands(pathArray),
    };
  }

  /**
   * Detect available commands in PATH
   */
  private async detectAvailableCommands(pathArray: string[]): Promise<string[]> {
    const commonCommands = [
      'ls',
      'cat',
      'grep',
      'find',
      'which',
      'chmod',
      'chown',
      'cp',
      'mv',
      'rm',
      'mkdir',
      'git',
      'npm',
      'node',
      'python',
      'python3',
      'java',
      'javac',
      'gcc',
      'make',
      'curl',
      'wget',
      'ssh',
      'rsync',
      'tar',
      'gzip',
      'zip',
      'unzip',
      'docker',
      'kubectl',
      'helm',
      'terraform',
      'aws',
      'gcloud',
      'az',
    ];

    const availableCommands: string[] = [];

    // Use Promise.allSettled for parallel command checking
    const commandChecks = commonCommands.map(async (cmd) => {
      try {
        await this.executeCommand('which', [cmd], { timeout: 500 });
        return cmd;
      } catch {
        return null;
      }
    });

    const results = await Promise.allSettled(commandChecks);

    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        availableCommands.push(result.value);
      }
    });

    return availableCommands.sort();
  }

  /**
   * Execute command with timeout
   */
  private executeCommand(
    command: string,
    args: string[],
    options: { timeout?: number } = {},
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, { stdio: 'pipe' });
      let output = '';
      let error = '';

      const timeout = options.timeout || 5000;
      const timer = setTimeout(() => {
        proc.kill();
        reject(new Error(`Command timeout: ${command} ${args.join(' ')}`));
      }, timeout);

      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        error += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(new Error(`Command failed: ${command} ${args.join(' ')}\n${error}`));
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }
}

export const terminalDetector = TerminalDetector.getInstance();
