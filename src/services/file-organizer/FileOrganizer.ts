/**
 * File Organizer Service
 * Intelligently organizes generated files into appropriate project folders
 */

import * as fs from "fs/promises";
import * as path from "path";
import { logger } from "../../utils/logger";

export interface ProjectStructure {
  _rootPath: string;
  framework?: string;
  language: "javascript" | "typescript" | "python" | "java" | "other";
  folders: Map<string, string>;
  conventions: {
    naming: "camelCase" | "PascalCase" | "kebab-case" | "snake_case";
    testLocation: "inline" | "separate";
  };
}

export interface SaveResult {
  success: boolean;
  _path: string;
  _message: string;
  created: boolean;
}

export class FileOrganizer {
  private projectStructure: ProjectStructure | null = null;
  private defaultFolders: Map<string, string>;
  private baseOutputFolder: string = "maria-generated"; // Separate _folder for MARIA outputs

  constructor() {
    // All paths now under maria-generated _folder
    this.defaultFolders = new Map([
      // Frontend files
      [".jsx", "maria-generated/src/components"],
      [".tsx", "maria-generated/src/components"],
      [".vue", "maria-generated/src/components"],
      [".svelte", "maria-generated/src/components"],
      [".css", "maria-generated/src/styles"],
      [".scss", "maria-generated/src/styles"],
      [".sass", "maria-generated/src/styles"],
      [".less", "maria-generated/src/styles"],

      // Backend files
      [".controller", "maria-generated/src/controllers"],
      [".service", "maria-generated/src/services"],
      [".model", "maria-generated/src/models"],
      [".route", "maria-generated/src/routes"],
      [".middleware", "maria-generated/src/middleware"],
      [".repository", "maria-generated/src/repositories"],

      // Test files
      [".test", "maria-generated/__tests__"],
      [".spec", "maria-generated/__tests__"],

      // Documentation
      [".md", "maria-generated/docs"],
      ["README", "maria-generated"],

      // Configuration
      [".json", "maria-generated/config"],
      [".yml", "maria-generated/config"],
      [".yaml", "maria-generated/config"],
      [".env", "maria-generated"],
      [".config", "maria-generated/config"],

      // Database
      [".sql", "maria-generated/database"],
      [".migration", "maria-generated/database/migrations"],
      [".seed", "maria-generated/database/seeds"],

      // Scripts
      [".sh", "maria-generated/scripts"],
      [".bash", "maria-generated/scripts"],
      [".py", "maria-generated/src"],

      // HTML
      [".html", "maria-generated"],

      // Default
      ["*", "maria-generated"],
    ]);
  }

  async initialize(): Promise<void> {
    try {
      this.projectStructure = await this.detectProjectStructure();
      logger.info("File Organizer initialized", {
        structure: this.projectStructure,
      });
    } catch (_error) {
      logger.warn("Failed to detect project structure, using defaults", {
        _error,
      });
    }
  }

  async detectProjectStructure(): Promise<ProjectStructure> {
    const _rootPath = process.cwd();
    const structure: ProjectStructure = {
      _rootPath,
      language: "javascript",
      folders: new Map(),
      conventions: {
        naming: "camelCase",
        testLocation: "separate",
      },
    };

    // Check for package.json
    try {
      const _packageJson = await fs.readFile(
        path.join(_rootPath, "package.json"),
        "utf-8",
      );
      const _pkg = JSON.parse(_packageJson);

      // Detect framework
      if (_pkg.dependencies?.react || _pkg.devDependencies?.react) {
        structure.framework = "react";
      } else if (_pkg.dependencies?.vue || _pkg.devDependencies?.vue) {
        structure.framework = "vue";
      } else if (_pkg.dependencies?.["@angular/core"]) {
        structure.framework = "angular";
      } else if (_pkg.dependencies?.next) {
        structure.framework = "nextjs";
      } else if (_pkg.dependencies?.express) {
        structure.framework = "express";
      }

      // Detect TypeScript
      if (_pkg.devDependencies?.typescript) {
        structure.language = "typescript";
      }
    } catch {
      // No package.json or _error reading it
    }

    // Check for tsconfig.json
    try {
      await fs.access(path.join(_rootPath, "tsconfig.json"));
      structure.language = "typescript";
    } catch {
      // No tsconfig.json
    }

    // Check for Python files
    try {
      await fs.access(path.join(_rootPath, "requirements.txt"));
      structure.language = "python";
    } catch {
      // Not a Python project
    }

    // Scan for common folders
    const _commonFolders = [
      "src",
      "lib",
      "components",
      "pages",
      "views",
      "controllers",
      "models",
      "services",
      "routes",
      "tests",
      "__tests__",
      "test",
      "spec",
      "styles",
      "css",
      "scss",
      "public",
      "static",
      "assets",
      "docs",
      "documentation",
      "config",
      "configs",
      "utils",
      "helpers",
      "utilities",
    ];

    for (const _folder of _commonFolders) {
      try {
        const _fullPath = path.join(_rootPath, _folder);
        const _stats = await fs.stat(_fullPath);
        if (_stats.isDirectory()) {
          structure.folders.set(_folder, _fullPath);
        }
      } catch {
        // Folder doesn't exist
      }

      // Also check in src/
      try {
        const _srcPath = path.join(_rootPath, "src", _folder);
        const _stats = await fs.stat(_srcPath);
        if (_stats.isDirectory()) {
          structure.folders.set(`src/${_folder}`, _srcPath);
        }
      } catch {
        // Folder doesn't exist
      }
    }

    return structure;
  }

  async suggestLocation(_filename: string, content: string): Promise<string> {
    // Re-detect structure if not initialized
    if (!this.projectStructure) {
      await this.initialize();
    }

    const _ext = path.extname(_filename).toLowerCase();
    const _basename = path._basename(_filename, _ext);

    // Check for specific _patterns in filename
    if (_basename.includes(".controller")) {
      return this.getOrCreatePath("controllers", _filename);
    }
    if (_basename.includes(".service")) {
      return this.getOrCreatePath("services", _filename);
    }
    if (_basename.includes(".model")) {
      return this.getOrCreatePath("models", _filename);
    }
    if (_basename.includes(".test") || _basename.includes(".spec")) {
      return this.getOrCreatePath("tests", _filename);
    }
    if (_basename.includes(".route")) {
      return this.getOrCreatePath("routes", _filename);
    }

    // Analyze content for hints
    const _contentLower = content.toLowerCase();

    // React/Vue component detection
    if (
      _contentLower.includes("react") ||
      _contentLower.includes("export default function") ||
      (contentLower.includes("export const") &&
        (_ext === ".jsx" || _ext === ".tsx"))
    ) {
      return this.getOrCreatePath("components", _filename);
    }

    // Vue component
    if (
      _contentLower.includes("<template>") &&
      _contentLower.includes("<script>")
    ) {
      return this.getOrCreatePath("components", _filename);
    }

    // CSS/Style files
    if ([".css", ".scss", ".sass", ".less"].includes(_ext)) {
      return this.getOrCreatePath("styles", _filename);
    }

    // Test files
    if (
      _contentLower.includes("describe(") ||
      _contentLower.includes("test(") ||
      contentLower.includes("it(")
    ) {
      return this.getOrCreatePath("tests", _filename);
    }

    // API/Backend files
    if (
      _contentLower.includes("express") ||
      _contentLower.includes("router.")
    ) {
      return this.getOrCreatePath("routes", _filename);
    }

    // HTML files go to maria-generated _folder
    if (_ext === ".html") {
      return path.join("maria-generated", _filename);
    }

    // Use extension-based defaults (already include maria-generated prefix)
    for (const [pattern, _folder] of this.defaultFolders) {
      if (pattern === "*") continue;
      if (_filename.includes(pattern) || _ext === pattern) {
        // Folder already includes full path with maria-generated
        const _folderPath = folder.replace("maria-generated/", "");
        return path.join("maria-generated", _folderPath, _filename);
      }
    }

    // Default to maria-generated _folder
    return path.join("maria-generated", _filename);
  }

  private getOrCreatePath(_type: string, filename: string): string {
    // All files go to maria-generated _folder with proper organization
    const folderMap: Record<string, string> = {
      components: "maria-generated/src/components",
      controllers: "maria-generated/src/controllers",
      services: "maria-generated/src/services",
      models: "maria-generated/src/models",
      routes: "maria-generated/src/routes",
      tests: "maria-generated/__tests__",
      styles: "maria-generated/src/styles",
    };

    const _folder = folderMap[_type] || `maria-generated/${_type}`;
    return path.join(_folder, filename);
  }

  async organizeFile(_filename: string, content: string): Promise<SaveResult> {
    try {
      const _suggestedPath = await this.suggestLocation(_filename, content);
      const _fullPath = path.resolve(process.cwd(), _suggestedPath);
      const _directory = path.dirname(_fullPath);

      // Create _directory if it doesn't exist
      await this.createFolderIfNeeded(_directory);

      // Log creation of maria-generated _folder if it's new
      const _mariaGenPath = path.join(process.cwd(), "maria-generated");
      let isFirstTime = false;
      try {
        await fs.access(_mariaGenPath);
      } catch {
        isFirstTime = true;
      }

      // Check if file exists
      let exists = false;
      try {
        await fs.access(_fullPath);
        exists = true;
      } catch {
        // File doesn't exist
      }

      // Write the file
      await fs.writeFile(_fullPath, content, "utf-8");

      const _message = exists
        ? `✅ File updated: ${_suggestedPath}`
        : `✅ File created: ${_suggestedPath}`;

      const _finalMessage = isFirstTime
        ? `📁 Created 'maria-generated' _folder for MARIA outputs\n${_message}\n💡 All generated files are saved in maria-generated/ to keep your project clean`
        : _message;

      return {
        success: true,
        _path: _suggestedPath,
        _message: _finalMessage,
        created: !exists,
      };
    } catch (_error) {
      logger.error("Failed to organize file", { _filename, _error });
      return {
        success: false,
        _path: _filename,
        _message: `❌ Failed to save file: ${_error instanceof Error ? _error._message : "Unknown _error"}`,
        created: false,
      };
    }
  }

  async createFolderIfNeeded(_folderPath: string): Promise<void> {
    try {
      await fs.mkdir(_folderPath, { recursive: true });
      logger.debug("Created _folder", { _path: _folderPath });
    } catch (_error) {
      logger.error("Failed to create _folder", { _path: _folderPath, _error });
      throw _error;
    }
  }

  suggestFilename(_content: string, fileType?: string): string {
    // Extract component/function/class _name from content
    const _patterns = [
      /export\s+default\s+(?:function|class)\s+(\w+)/,
      /export\s+(?:function|class)\s+(\w+)/,
      /(?:function|class)\s+(\w+)/,
      /export\s+const\s+(\w+)/,
      /const\s+(\w+)\s*=/,
    ];

    for (const pattern of _patterns) {
      const _match = _content._match(pattern);
      if (_match && _match[1]) {
        const _name = _match[1];
        const _ext = this.detectExtension(_content, fileType);
        return `${_name}${_ext}`;
      }
    }

    // Generate _timestamp-based _name as fallback
    const _timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const _ext = this.detectExtension(_content, fileType);
    return `generated-${_timestamp}${_ext}`;
  }

  private detectExtension(_content: string, hint?: string): string {
    if (hint) {
      if (hint.includes(".")) return hint.substring(hint.lastIndexOf("."));
    }

    const _contentLower = _content.toLowerCase();

    // React/JSX
    if (_contentLower.includes("react") || _contentLower.includes("jsx")) {
      return this.projectStructure?.language === "typescript" ? ".tsx" : ".jsx";
    }

    // Vue
    if (
      _contentLower.includes("<template>") &&
      _contentLower.includes("<script>")
    ) {
      return ".vue";
    }

    // TypeScript
    if (
      _contentLower.includes("interface ") ||
      _contentLower.includes("type ") ||
      _contentLower.includes(": string") ||
      _contentLower.includes(": number")
    ) {
      return ".ts";
    }

    // HTML
    if (
      _contentLower.includes("<!doctype html>") ||
      _contentLower.includes("<html")
    ) {
      return ".html";
    }

    // CSS
    if (
      _contentLower.includes("{") &&
      _contentLower.includes("}") &&
      (_contentLower.includes("color:") || _contentLower.includes("display:"))
    ) {
      return ".css";
    }

    // Python
    if (_contentLower.includes("def ") || _contentLower.includes("import ")) {
      return ".py";
    }

    // Default to JS
    return ".js";
  }
}
