/**
 * File Save Service
 * Automatically saves generated code to appropriate files with safety checks
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';

import { logger } from '../utils/logger';

export interface FileSaveOptions {
  filename?: string;
  directory?: string;
  extension?: string;
  overwrite?: boolean;
  createBackup?: boolean;
  dryRun?: boolean;
}

export interface FileSaveResult {
  success: boolean;
  filepath?: string;
  backupPath?: string;
  message: string;
  error?: string;
}

export class FileSaveService {
  private static instance: FileSaveService;
  private defaultDirectory: string;

  private constructor() {
    this.defaultDirectory = process.cwd();
  }

  public static getInstance(): FileSaveService {
    if (!FileSaveService.instance) {
      FileSaveService.instance = new FileSaveService();
    }
    return FileSaveService.instance;
  }

  /**
   * Save code to file with automatic naming and safety checks
   */
  public async saveCode(
    code: string,
    language: string,
    description: string,
    options: FileSaveOptions = {},
  ): Promise<FileSaveResult> {
    try {
      // 1. Determine file path
      const filepath = await this.determineFilePath(language, description, options);

      // 2. Check if file exists and handle accordingly
      if (await this.fileExists(filepath)) {
        if (!options.overwrite && !options.dryRun) {
          // Ask for confirmation or generate alternative name
          const altPath = await this.generateAlternativePath(filepath);
          return this.performSave(code, altPath, options);
        }

        // Create backup if requested
        if (options.createBackup && !options.dryRun) {
          await this.createBackup(filepath);
        }
      }

      // 3. Perform the save
      return this.performSave(code, filepath, options);
    } catch (error: unknown) {
      logger.error('Failed to save code:', error);
      return {
        success: false,
        message: 'Failed to save code',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Determine the appropriate file path based on language and description
   */
  private async determineFilePath(
    language: string,
    description: string,
    options: FileSaveOptions,
  ): Promise<string> {
    // Use provided filename if available
    if (options.filename) {
      const dir = options.directory || this.defaultDirectory;
      return path.join(dir, options.filename);
    }

    // Generate filename from description
    const filename = this.generateFilename(description, language);
    const extension = options.extension || this.getExtension(language);
    const directory = options.directory || this.defaultDirectory;

    return path.join(directory, `${filename}.${extension}`);
  }

  /**
   * Generate a meaningful filename from description
   */
  private generateFilename(description: string, _language: string): string {
    // Extract key terms from description
    const cleanDesc = description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim();

    // Common patterns to extract meaningful names
    const patterns = [
      /(?:create|generate|build|make)\s+(?:a\s+)?(\w+)/,
      /(\w+)\s+(?:function|class|component|service|module)/,
      /(?:for|to)\s+(\w+)/,
    ];

    for (const pattern of patterns) {
      const match = cleanDesc.match(pattern);
      if (match && match[1]) {
        return this.toKebabCase(match[1]);
      }
    }

    // Fallback: use first few words
    const words = cleanDesc.split(/\s+/).slice(0, 3);
    return this.toKebabCase(words.join('-')) || `generated-${Date.now()}`;
  }

  /**
   * Convert string to kebab-case
   */
  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  /**
   * Get file extension for language
   */
  private getExtension(language: string): string {
    const extensions: Record<string, string> = {
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      java: 'java',
      csharp: 'cs',
      cpp: 'cpp',
      c: 'c',
      go: 'go',
      rust: 'rs',
      ruby: 'rb',
      php: 'php',
      swift: 'swift',
      kotlin: 'kt',
      scala: 'scala',
      html: 'html',
      css: 'css',
      sql: 'sql',
      shell: 'sh',
      bash: 'sh',
      powershell: 'ps1',
      yaml: 'yaml',
      json: 'json',
      xml: 'xml',
      markdown: 'md',
    };

    return extensions[language.toLowerCase()] || 'txt';
  }

  /**
   * Check if file exists
   */
  private async fileExists(filepath: string): Promise<boolean> {
    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate alternative path for existing file
   */
  private async generateAlternativePath(filepath: string): Promise<string> {
    const dir = path.dirname(filepath);
    const ext = path.extname(filepath);
    const base = path.basename(filepath, ext);

    let counter = 1;
    let altPath = filepath;

    while (await this.fileExists(altPath)) {
      altPath = path.join(dir, `${base}-${counter}${ext}`);
      counter++;
    }

    return altPath;
  }

  /**
   * Create backup of existing file
   */
  private async createBackup(filepath: string): Promise<string> {
    const backupPath = `${filepath}.backup.${Date.now()}`;
    await fs.copyFile(filepath, backupPath);
    return backupPath;
  }

  /**
   * Perform the actual file save
   */
  private async performSave(
    code: string,
    filepath: string,
    options: FileSaveOptions,
  ): Promise<FileSaveResult> {
    if (options.dryRun) {
      console.log(chalk.yellow('\n📝 Dry Run - File would be saved to:'));
      console.log(chalk.cyan(filepath));
      console.log(chalk.gray('\nContent preview:'));
      console.log(code.substring(0, 500) + (code.length > 500 ? '...' : ''));

      return {
        success: true,
        filepath,
        message: `Dry run: Would save to ${filepath}`,
      };
    }

    // Ensure directory exists
    const dir = path.dirname(filepath);
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(filepath, code, 'utf-8');

    // Display success message
    console.log(chalk.green('\n✅ Code saved successfully!'));
    console.log(chalk.cyan(`📁 File: ${filepath}`));
    console.log(chalk.gray(`📏 Size: ${code.length} characters`));

    return {
      success: true,
      filepath,
      message: `Code saved to ${filepath}`,
    };
  }

  /**
   * Save multiple files (e.g., code + tests)
   */
  public async saveMultiple(
    files: Array<{
      content: string;
      language: string;
      description: string;
      options?: FileSaveOptions;
    }>,
  ): Promise<FileSaveResult[]> {
    const results: FileSaveResult[] = [];

    for (const file of files) {
      const result = await this.saveCode(
        file.content,
        file.language,
        file.description,
        file.options,
      );
      results.push(result);
    }

    return results;
  }
}
