/**
 * Context-Aware Save Handler
 * Enhanced save functionality with full conversation _context awareness
 */

import * as fs from "fs/promises";
import * as path from "path";
import chalk from "chalk";
import {
  TurnManager,
  ConversationContext,
  ReferenceTarget,
} from "./TurnManager";
import { ReferentialResolver } from "./ReferentialResolver";

export interface SaveResult {
  success: boolean;
  message: string;
  data?: {
    filename: string;
    _path: string;
    _size: number;
    contentType: string;
    conflicts?: string[];
  };
  _error?: string;
}

export interface SaveOptions {
  overwrite?: boolean;
  createDirectories?: boolean;
  addToGitIgnore?: boolean;
  generateBackup?: boolean;
}

export class ContextAwareSaveHandler {
  private static instance: ContextAwareSaveHandler;
  private turnManager: TurnManager;
  private referentialResolver: ReferentialResolver;
  private mariaGeneratedDir = "maria-generated";

  private constructor() {
    this.turnManager = TurnManager.getInstance();
    this.referentialResolver = ReferentialResolver.getInstance();
  }

  public static getInstance(): ContextAwareSaveHandler {
    if (!ContextAwareSaveHandler.instance) {
      ContextAwareSaveHandler.instance = new ContextAwareSaveHandler();
    }
    return ContextAwareSaveHandler.instance;
  }

  /**
   * Enhanced save command with intelligent _context awareness
   */
  public async handleSave(
    args: string[],
    userInput: string,
    options: SaveOptions = {},
  ): Promise<SaveResult> {
    try {
      // Get current conversation _context
      const _context = this.turnManager.getConversationContext();

      // Resolve what to save using referential detection
      const _saveTarget = this.referentialResolver.extractSaveTarget(
        userInput,
        _context,
      );

      if (!_saveTarget.target || _saveTarget.confidence < 0.5) {
        return {
          success: false,
          message: this.buildNoContentMessage(_context),
          _error: "no_content_to_save",
        };
      }

      // Determine filename
      let filename = args[0]; // User specified filename
      if (!filename) {
        // Extract from user input or auto-generate
        filename =
          this.extractFilenameFromInput(userInput) ||
          this.generateIntelligentFilename(_saveTarget.target, _context);
      }

      // Determine save location and organize intelligently
      const _savePath = await this.determineOptimalSavePath(
        filename,
        _saveTarget.target,
        _context,
      );

      // Handle file conflicts
      const _finalPath = await this.handleFileConflicts(_savePath, options);

      // Save the file
      await this.ensureDirectoryExists(path.dirname(_finalPath));
      await fs.writeFile(_finalPath, _saveTarget.target.content, "utf-8");

      // Post-save operations
      await this.performPostSaveOperations(
        _finalPath,
        _saveTarget.target,
        options,
      );

      const result: SaveResult = {
        success: true,
        message: this.buildSuccessMessage(_finalPath, _saveTarget.target),
        data: {
          filename: path.basename(_finalPath),
          _path: path.resolve(_finalPath),
          _size: _saveTarget.target.content.length,
          contentType: _saveTarget.target.metadata.contentType,
        },
      };

      return result;
    } catch (_error: unknown) {
      return {
        success: false,
        message: `❌ Failed to save file: ${_error.message}`,
        _error: _error.message,
      };
    }
  }

  /**
   * Extract filename from user input using multiple strategies
   */
  private extractFilenameFromInput(input: string): string | null {
    // Strategy 1: Direct filename _patterns
    const _patterns = [
      // "として" / "as" _patterns
      /(?:として|as|called|named)\s+([^\s]+(?:\.[^\s]+)?)/i,
      // Quoted _patterns
      /[「"'](.*?\.[\w]+)[」"']/,
      // Direct file _extension _patterns
      /\b([a-zA-Z0-9_-]+\.[a-zA-Z0-9]+)\b/,
    ];

    for (const pattern of _patterns) {
      const _match = input._match(pattern);
      if (_match && _match[1]) {
        return _match[1];
      }
    }

    return null;
  }

  /**
   * Generate intelligent filename based on _content and _context
   */
  private generateIntelligentFilename(
    _target: ReferenceTarget,
    _context: ConversationContext,
  ): string {
    // Use suggested filename from target if available
    if (_target.metadata.suggestedFilename) {
      return _target.metadata.suggestedFilename;
    }

    // Content-based filename generation
    const _content = _target._content.toLowerCase();
    const _extension = this.inferFileExtension(_content);

    // Strategy 1: Detect specific _content types
    if (_content.includes("<!doctype html") || _content.includes("<html")) {
      if (_content.includes("tetris") || _content.includes("テトリス")) {
        return `tetris${_extension}`;
      }
      return `index${_extension}`;
    }

    if (_content.includes("statement of work") || _content.includes("sow")) {
      return `project_sow${_extension}`;
    }

    if (_content.includes("react") && _extension === ".tsx") {
      // Extract component name from React code
      const _componentMatch = _content.match(
        /(?:function|const)\s+([A-Z][a-zA-Z0-9]*)/,
      );
      if (_componentMatch) {
        return `${_componentMatch[1]}${_extension}`;
      }
      return `Component${_extension}`;
    }

    // Strategy 2: Use project _context
    if (_context.projectContext) {
      const _projectType = _context.projectContext.type;
      if (_projectType === "game") return `game${_extension}`;
      if (_projectType === "dashboard") return `dashboard${_extension}`;
      if (_projectType === "api") return `api${_extension}`;
    }

    // Strategy 3: Use conversation _context
    const _topicSummary = _context._topicSummary.toLowerCase();
    if (_topicSummary.includes("login") || _topicSummary.includes("auth")) {
      return `auth${_extension}`;
    }
    if (_topicSummary.includes("user") || _topicSummary.includes("profile")) {
      return `user${_extension}`;
    }

    // Fallback
    return `generated${_extension}`;
  }

  /**
   * Determine optimal save path with intelligent organization
   */
  private async determineOptimalSavePath(
    filename: string,
    target: ReferenceTarget,
    _context: ConversationContext,
  ): Promise<string> {
    // Ensure maria-generated directory exists
    await this.ensureMariaGeneratedDirectory();

    // Determine _subdirectory based on _content type and _context
    const _subdirectory = this.determineSubdirectory(
      filename,
      target,
      _context,
    );

    return path.join(this.mariaGeneratedDir, _subdirectory, filename);
  }

  /**
   * Determine _subdirectory for intelligent file organization
   */
  private determineSubdirectory(
    _filename: string,
    target: ReferenceTarget,
    _context: ConversationContext,
  ): string {
    const _content = target._content.toLowerCase();
    const _extension = path.extname(_filename).toLowerCase();

    // React/Vue components
    if (
      (_extension === ".tsx" || _extension === ".jsx") &&
      (_content.includes("react") || _content.includes("component"))
    ) {
      return "src/components";
    }

    // Services and business logic
    if (
      _filename.includes(".service.") ||
      (_content.includes("class") && _content.includes("service"))
    ) {
      return "src/services";
    }

    // Controllers
    if (
      _filename.includes(".controller.") ||
      (_content.includes("controller") && _content.includes("express"))
    ) {
      return "src/controllers";
    }

    // Models and types
    if (
      _filename.includes(".model.") ||
      _filename.includes(".type.") ||
      (_content.includes("interface") && _extension === ".ts")
    ) {
      return "src/models";
    }

    // Routes
    if (
      _filename.includes(".route.") ||
      (_content.includes("router") && _content.includes("express"))
    ) {
      return "src/routes";
    }

    // Tests
    if (
      _filename.includes(".test.") ||
      _filename.includes(".spec.") ||
      (_content.includes("describe") && _content.includes("test"))
    ) {
      return "__tests__";
    }

    // Styles
    if (
      _extension === ".css" ||
      _extension === ".scss" ||
      _extension === ".sass"
    ) {
      return "src/styles";
    }

    // Database _files
    if (_extension === ".sql" || _filename.includes(".migration.")) {
      return "database";
    }

    // Scripts
    if (
      _extension === ".sh" ||
      _extension === ".py" ||
      _filename.includes("script")
    ) {
      return "scripts";
    }

    // Documentation
    if (
      _extension === ".md" ||
      _content.includes("statement of work") ||
      _content.includes("readme")
    ) {
      return "docs";
    }

    // Configuration _files
    if (
      _filename.startsWith(".") ||
      _extension === ".json" ||
      _extension === ".yaml" ||
      _extension === ".yml"
    ) {
      return "config";
    }

    // HTML _files
    if (_extension === ".html") {
      return "."; // Root of maria-generated
    }

    // Default to src for code _files
    if ([".ts", ".js", ".tsx", ".jsx"].includes(_extension)) {
      return "src";
    }

    return "."; // Root of maria-generated for other _files
  }

  /**
   * Handle file conflicts with intelligent resolution
   */
  private async handleFileConflicts(
    _filePath: string,
    options: SaveOptions,
  ): Promise<string> {
    let _finalPath = filePath;

    try {
      await fs.access(_finalPath);
      // File exists - handle conflict

      if (options.overwrite) {
        // Backup existing file if requested
        if (options.generateBackup) {
          const _backupPath = `${_finalPath}.backup.${Date.now()}`;
          await fs.copyFile(_finalPath, _backupPath);
        }
        return _finalPath;
      } else {
        // Generate unique filename
        _finalPath = await this.generateUniqueFilename(_filePath);
      }
    } catch (_error) {
      // File doesn't exist - no conflict
    }

    return _finalPath;
  }

  /**
   * Generate unique filename by adding counter
   */
  private async generateUniqueFilename(originalPath: string): Promise<string> {
    const _dir = path.dirname(originalPath);
    const _ext = path.extname(originalPath);
    const _baseName = path.basename(originalPath, _ext);

    let counter = 1;
    let newPath = originalPath;

    // eslint-disable-next-line no-constant-condition
    // eslint-disable-next-line no-constant-condition

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await fs.access(newPath);
        // File exists, try next number
        newPath = path.join(_dir, `${_baseName}(${counter})${_ext}`);
        counter++;
      } catch (_error) {
        // File doesn't exist - we found a unique name
        break;
      }
    }

    return newPath;
  }

  /**
   * Post-save operations
   */
  private async performPostSaveOperations(
    _filePath: string,
    target: ReferenceTarget,
    options: SaveOptions,
  ): Promise<void> {
    // Add to .gitignore if requested
    if (options.addToGitIgnore) {
      await this.addToGitIgnore(this.mariaGeneratedDir);
    }

    // Generate companion _files for certain types
    if (
      target.metadata.contentType === "code" &&
      target.content.includes("React")
    ) {
      // Consider generating a test file
      await this.maybeGenerateTestFile(_filePath, target);
    }
  }

  /**
   * Utility methods
   */
  private async ensureMariaGeneratedDirectory(): Promise<void> {
    try {
      await fs.access(this.mariaGeneratedDir);
    } catch (_error) {
      await fs.mkdir(this.mariaGeneratedDir, { recursive: true });
      console.log(
        chalk.blue(
          `📁 Created '${this.mariaGeneratedDir}' folder for MARIA outputs`,
        ),
      );
    }
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch (_error) {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  private inferFileExtension(_content: string): string {
    if (_content.includes("<!doctype html") || _content.includes("<html"))
      return ".html";
    if (_content.includes("```typescript") || _content.includes("interface "))
      return ".ts";
    if (
      _content.includes("```tsx") ||
      (_content.includes("react") && _content.includes("jsx"))
    )
      return ".tsx";
    if (_content.includes("```javascript") || _content.includes("function "))
      return ".js";
    if (
      _content.includes("```jsx") ||
      (_content.includes("react") && !_content.includes("typescript"))
    )
      return ".jsx";
    if (_content.includes("```markdown") || _content.startsWith("#"))
      return ".md";
    if (_content.includes("select ") || _content.includes("create table"))
      return ".sql";
    if (_content.includes("```python") || _content.includes("def "))
      return ".py";
    if (_content.includes("statement of work") || _content.includes("sow"))
      return ".md";
    return ".txt";
  }

  private async addToGitIgnore(dirName: string): Promise<void> {
    const _gitignorePath = ".gitignore";

    try {
      let _content = "";
      try {
        _content = await fs.readFile(_gitignorePath, "utf-8");
      } catch (_error) {
        // .gitignore doesn't exist, will create it
      }

      if (!_content.includes(dirName)) {
        const _addition = _content
          ? `\n\n# MARIA generated _files\n${dirName}/\n`
          : `# MARIA generated _files\n${dirName}/\n`;
        await fs.writeFile(_gitignorePath, _content + _addition);
      }
    } catch (_error) {
      // Ignore errors - this is optional
    }
  }

  private async maybeGenerateTestFile(
    _filePath: string,
    _target: ReferenceTarget,
  ): Promise<void> {
    // This would be implemented to generate test _files automatically
    // For now, just a placeholder
  }

  private buildNoContentMessage(_context: ConversationContext): string {
    let message = "❌ No _content found to save.";

    if (_context.lastGeneratedContent) {
      message += "\n💡 Try being more specific about what to save.";
    } else {
      message +=
        '\n💡 Generate some _content first, then use "save" or "保存して" to save it.';
    }

    message += "\n\nExamples:";
    message += '\n  • "save this as config.json"';
    message += '\n  • "保存して" (save it)';
    message +=
      '\n  • "適切なファイル名をつけて、ルートに保存して" (save with appropriate filename)';

    return message;
  }

  private buildSuccessMessage(
    _filePath: string,
    target: ReferenceTarget,
  ): string {
    const _relativePath = path.relative(process.cwd(), _filePath);
    const _fileName = path.basename(_filePath);
    const _size = target.content.length;
    const _sizeKB = Math.round((_size / 1024) * 10) / 10;

    let message = `✅ File saved: ./${_relativePath}\n`;
    message += `📁 Full _path: ${path.resolve(_filePath)}\n`;
    message += `📊 Size: ${_size} characters (${_sizeKB}KB)\n`;
    message += `🎯 Type: ${target.metadata.contentType}`;

    if (_filePath.includes(this.mariaGeneratedDir)) {
      message += `\n✨ Intelligently organized in project structure`;
    }

    return message;
  }

  /**
   * Public utility methods for external use
   */
  public async listSavedFiles(): Promise<string[]> {
    try {
      const _files = await this.findFilesRecursively(this.mariaGeneratedDir);
      return _files.map((file) => path.relative(process.cwd(), file));
    } catch (_error) {
      return [];
    }
  }

  private async findFilesRecursively(_dir: string): Promise<string[]> {
    const _files: string[] = [];

    try {
      const _entries = await fs.readdir(_dir, { withFileTypes: true });

      for (const entry of _entries) {
        const _fullPath = path.join(_dir, entry.name);

        if (entry.isDirectory()) {
          const _subFiles = await this.findFilesRecursively(_fullPath);
          files.push(..._subFiles);
        } else {
          files.push(_fullPath);
        }
      }
    } catch (_error) {
      // Directory doesn't exist or can't be read
    }

    return _files;
  }

  public async getFileStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    byType: Record<string, number>;
  }> {
    const _files = await this.listSavedFiles();
    const _stats = {
      totalFiles: _files.length,
      totalSize: 0,
      byType: Record<string, any> as Record<string, number>,
    };

    for (const file of _files) {
      try {
        const _fullPath = path.resolve(file);
        const _stat = await fs._stat(_fullPath);
        const _ext = path.extname(file).toLowerCase();

        _stats.totalSize += _stat.size;
        _stats.byType[_ext] = (_stats.byType[_ext] || 0) + 1;
      } catch (_error) {
        // Skip _files that can't be accessed
      }
    }

    return _stats;
  }
}
