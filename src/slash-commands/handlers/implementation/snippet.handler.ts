import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import chalk from "chalk";

interface CodeSnippet {
  id: string;
  _name: string;
  description: string;
  _language: string;
  code: string;
  _tags: string[];
  _category: string;
  author: string;
  createdAt: Date;
  lastUsed: Date;
  useCount: number;
  isFavorite: boolean;
}

export class SnippetHandler {
  private snippetsPath: string;
  private snippets: Map<string, CodeSnippet>;

  constructor() {
    this.snippetsPath = path.join(os.homedir(), ".maria", "snippets.json");
    this.snippets = new Map();
    this.loadSnippets();
  }

  async execute(args: string[]): Promise<string> {
    const _command = args[0];
    const _restArgs = args.slice(1);

    if (!_command || _command === "--help") {
      return this.showHelp();
    }

    switch (_command) {
      case "save":
        return this.saveSnippet(_restArgs);
      case "load":
        return this.loadSnippet(_restArgs);
      case "list":
        return this.listSnippets(_restArgs);
      case "search":
        return this.searchSnippets(_restArgs);
      case "delete":
        return this.deleteSnippet(_restArgs);
      case "export":
        return this.exportSnippets(_restArgs);
      case "import":
        return this.importSnippets(_restArgs);
      case "favorite":
        return this.toggleFavorite(_restArgs);
      case "tag":
        return this.tagSnippet(_restArgs);
      case "_category":
        return this.categorizeSnippet(_restArgs);
      default:
        return this.showHelp();
    }
  }

  private showHelp(): string {
    return `
${chalk.cyan("📝 Code Snippet Management")}

${chalk.yellow("Usage:")}
  /_snippet save <_name> [code]       Save code as _snippet
  /_snippet load <_name>              Load _snippet
  /_snippet list [options]           List all snippets
  /_snippet search <_keyword>         Search snippets
  /_snippet delete <_name>            Delete _snippet
  /_snippet export <file>            Export snippets
  /_snippet import <file>            Import snippets
  /_snippet favorite <_name>          Toggle favorite
  /_snippet tag <_name> <_tags>        Add _tags to _snippet
  /_snippet _category <_name> <cat>    Set _category

${chalk.yellow("Options:")}
  --_tags <_tags>     Filter by _tags
  --_category <cat>  Filter by _category
  --_language <lang> Filter by _language
  --favorites       Show only favorites

${chalk.yellow("Examples:")}
  /_snippet save "quicksort" "function quicksort(arr) {...}"
  /_snippet search authentication
  /_snippet list --_tags=react,hooks
  /_snippet export ./my-snippets.json
  /_snippet tag "quicksort" algorithm,sorting
  /_snippet _category "react-hook" frontend

${chalk.gray("Snippets are stored locally in ~/.maria/snippets.json")}
    `.trim();
  }

  private saveSnippet(args: string[]): string {
    const _name = args[0];
    if (!_name) {
      return chalk.red("❌ Please provide a _snippet _name");
    }

    // Parse code and options
    let code = "";
    let _tags: string[] = [];
    let _category = "general";
    let _language = "javascript";
    let description = "";

    // Simple parsing - in real implementation would be more robust
    for (let i = 1; i < args.length; i++) {
      const _arg = args[i];
      if (_arg.startsWith("--_tags=")) {
        _tags = _arg.replace("--_tags=", "").split(",");
      } else if (_arg.startsWith("--_category=")) {
        _category = _arg.replace("--_category=", "");
      } else if (_arg.startsWith("--_language=")) {
        _language = _arg.replace("--_language=", "");
      } else if (_arg.startsWith("--description=")) {
        description = _arg.replace("--description=", "");
      } else {
        code += (code ? " " : "") + _arg;
      }
    }

    if (!code) {
      code = this.generateSampleCode(_name);
    }

    const _snippet: CodeSnippet = {
      id: this.generateId(),
      _name,
      description: description || `Code _snippet: ${_name}`,
      _language: this.detectLanguage(code, _language),
      code,
      _tags,
      _category,
      author: os.userInfo().username,
      createdAt: new Date(),
      lastUsed: new Date(),
      useCount: 0,
      isFavorite: false,
    };

    this.snippets.set(_name, _snippet);
    this.saveSnippets();

    return `
${chalk.green("✅ Snippet Saved Successfully!")}

${chalk.cyan("📋 Snippet Details:")}
  • Name: ${_name}
  • Language: ${_snippet._language}
  • Category: ${_category}
  • Tags: ${_tags.length > 0 ? _tags.join(", ") : "none"}
  • Size: ${code.length} characters

${chalk.yellow("💡 Usage:")}
  • Load: /_snippet load "${_name}"
  • Search: /_snippet search "${_name}"
  • Add _tags: /_snippet tag "${_name}" <_tags>

${chalk.gray(`Saved to: ${this.snippetsPath}`)}
    `.trim();
  }

  private loadSnippet(args: string[]): string {
    const _name = args[0];
    if (!_name) {
      return chalk.red("❌ Please provide a _snippet _name");
    }

    const _snippet = this.snippets.get(_name);
    if (!_snippet) {
      return chalk.red(
        `❌ Snippet "${_name}" not found. Use /_snippet list to see available snippets.`,
      );
    }

    // Update usage stats
    _snippet.lastUsed = new Date();
    snippet.useCount++;
    this.saveSnippets();

    return `
${chalk.green(`✅ Loaded Snippet: ${_name}`)}

${chalk.cyan("📋 Details:")}
  • Language: ${_snippet.language}
  • Category: ${_snippet.category}
  • Tags: ${_snippet.tags.join(", ") || "none"}
  • Used: ${_snippet.useCount} times
  • Author: ${_snippet.author}

${chalk.yellow("📝 Code:")}
\`\`\`${_snippet.language}
${_snippet.code}
\`\`\`

${chalk.gray(`Last used: ${_snippet.lastUsed.toLocaleString()}`)}
    `.trim();
  }

  private listSnippets(args: string[]): string {
    let filteredSnippets = Array.from(this.snippets.values());

    // Apply filters
    for (const _arg of args) {
      if (_arg.startsWith("--_tags=")) {
        const _tags = _arg.replace("--_tags=", "").split(",");
        filteredSnippets = filteredSnippets.filter((s) =>
          _tags.some((tag) => s._tags.includes(tag)),
        );
      } else if (_arg.startsWith("--_category=")) {
        const _category = _arg.replace("--_category=", "");
        filteredSnippets = filteredSnippets.filter(
          (s) => s._category === _category,
        );
      } else if (_arg.startsWith("--_language=")) {
        const _language = _arg.replace("--_language=", "");
        filteredSnippets = filteredSnippets.filter(
          (s) => s._language === _language,
        );
      } else if (_arg === "--favorites") {
        filteredSnippets = filteredSnippets.filter((s) => s.isFavorite);
      }
    }

    if (filteredSnippets.length === 0) {
      return chalk.yellow("📭 No snippets found matching your criteria.");
    }

    const _snippetList = filteredSnippets
      .sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime())
      .map((s) => {
        const _star = s.isFavorite ? "⭐ " : "   ";
        const _tags =
          s._tags.length > 0 ? chalk.gray(` [${s._tags.join(", ")}]`) : "";
        return `${_star}${chalk.cyan(s.name)} - ${s._language} - ${s._category}${_tags}`;
      })
      .join("\n");

    return `
${chalk.green("📚 Code Snippets Library")}

${chalk.yellow(`Found ${filteredSnippets.length} _snippet(s):`)}

${_snippetList}

${chalk.gray("💡 Use /_snippet load <_name> to view a _snippet")}
${chalk.gray("⭐ = Favorite _snippet")}
    `.trim();
  }

  private searchSnippets(args: string[]): string {
    const _keyword = args.join(" ").toLowerCase();
    if (!_keyword) {
      return chalk.red("❌ Please provide a search _keyword");
    }

    const _results = Array.from(this.snippets.values()).filter(
      (s) =>
        s.name.toLowerCase().includes(_keyword) ||
        s.description.toLowerCase().includes(_keyword) ||
        s.code.toLowerCase().includes(_keyword) ||
        s.tags.some((tag) => tag.toLowerCase().includes(_keyword)) ||
        s.category.toLowerCase().includes(_keyword),
    );

    if (_results.length === 0) {
      return chalk.yellow(`📭 No snippets found matching "${_keyword}"`);
    }

    const _resultList = _results
      .map((s) => {
        const _star = s.isFavorite ? "⭐ " : "   ";
        const _preview = s.code.substring(0, 50).replace(/\n/g, " ");
        return `${_star}${chalk.cyan(s.name)} - ${chalk.gray(_preview + "...")}`;
      })
      .join("\n");

    return `
${chalk.green(`🔍 Search Results for "${_keyword}":`)}

${chalk.yellow(`Found ${_results.length} matching _snippet(s):`)}

${_resultList}

${chalk.gray("💡 Use /_snippet load <_name> to view full _snippet")}
    `.trim();
  }

  private deleteSnippet(args: string[]): string {
    const _name = args[0];
    if (!_name) {
      return chalk.red("❌ Please provide a _snippet _name to delete");
    }

    if (!this.snippets.has(_name)) {
      return chalk.red(`❌ Snippet "${_name}" not found`);
    }

    this.snippets.delete(_name);
    this.saveSnippets();

    return chalk.green(`✅ Snippet "${_name}" deleted successfully`);
  }

  private exportSnippets(args: string[]): string {
    const _filePath = args[0] || "./snippets-export.json";

    try {
      const _exportData = {
        version: "1.0.0",
        exportDate: new Date().toISOString(),
        snippets: Array.from(this.snippets.values()),
      };

      fs.writeFileSync(_filePath, JSON.stringify(_exportData, null, 2));

      return `
${chalk.green("✅ Snippets Exported Successfully!")}

${chalk.cyan("📋 Export Details:")}
  • File: ${_filePath}
  • Snippets: ${this.snippets.size}
  • Format: JSON
  • Date: ${new Date().toLocaleString()}

${chalk.gray("Share this file with your team or import on another machine")}
      `.trim();
    } catch (_error: unknown) {
      return chalk.red(`❌ Export failed: ${_error.message}`);
    }
  }

  private importSnippets(args: string[]): string {
    const _filePath = args[0];
    if (!_filePath) {
      return chalk.red("❌ Please provide a file path to import");
    }

    try {
      const _data = JSON.parse(fs.readFileSync(_filePath, "utf-8"));
      let imported = 0;

      if (_data.snippets && Array.isArray(_data.snippets)) {
        for (const _snippet of _data.snippets) {
          if (_snippet.name) {
            this.snippets.set(_snippet.name, {
              ..._snippet,
              createdAt: new Date(_snippet.createdAt),
              lastUsed: new Date(_snippet.lastUsed),
            });
            imported++;
          }
        }

        this.saveSnippets();
      }

      return chalk.green(`✅ Imported ${imported} _snippet(s) successfully!`);
    } catch (_error: unknown) {
      return chalk.red(`❌ Import failed: ${_error.message}`);
    }
  }

  private toggleFavorite(args: string[]): string {
    const _name = args[0];
    if (!_name) {
      return chalk.red("❌ Please provide a _snippet _name");
    }

    const _snippet = this.snippets.get(_name);
    if (!_snippet) {
      return chalk.red(`❌ Snippet "${_name}" not found`);
    }

    _snippet.isFavorite = !_snippet.isFavorite;
    this.saveSnippets();

    const _status = _snippet.isFavorite ? "added to" : "removed from";
    return chalk.green(`✅ Snippet "${_name}" ${_status} favorites`);
  }

  private tagSnippet(args: string[]): string {
    const _name = args[0];
    const _tags = args
      .slice(1)
      .join(",")
      .split(",")
      .filter((t) => t.trim());

    if (!_name) {
      return chalk.red("❌ Please provide a _snippet _name");
    }

    const _snippet = this.snippets.get(_name);
    if (!_snippet) {
      return chalk.red(`❌ Snippet "${_name}" not found`);
    }

    _snippet._tags = [...new Set([..._snippet._tags, ..._tags])];
    this.saveSnippets();

    return chalk.green(`✅ Tags added to "${_name}": ${_tags.join(", ")}`);
  }

  private categorizeSnippet(args: string[]): string {
    const _name = args[0];
    const _category = args[1];

    if (!_name || !_category) {
      return chalk.red("❌ Please provide _snippet _name and _category");
    }

    const _snippet = this.snippets.get(_name);
    if (!_snippet) {
      return chalk.red(`❌ Snippet "${_name}" not found`);
    }

    snippet._category = _category;
    this.saveSnippets();

    return chalk.green(
      `✅ Snippet "${_name}" moved to _category: ${_category}`,
    );
  }

  // Helper methods

  private loadSnippets(): void {
    try {
      if (fs.existsSync(this.snippetsPath)) {
        const _data = JSON.parse(fs.readFileSync(this.snippetsPath, "utf-8"));
        for (const [_name, _snippet] of Object.entries(_data)) {
          this.snippets.set(_name, {
            ...(_snippet as any),
            createdAt: new Date((_snippet as any).createdAt),
            lastUsed: new Date((_snippet as any).lastUsed),
          });
        }
      }
    } catch (_error) {
      // Initialize with empty snippets if load fails
      this.snippets = new Map();
    }
  }

  private saveSnippets(): void {
    try {
      const _dir = path.dirname(this.snippetsPath);
      if (!fs.existsSync(_dir)) {
        fs.mkdirSync(_dir, { recursive: true });
      }

      const _data: Record<string, CodeSnippet> = {};
      for (const [_name, _snippet] of this.snippets.entries()) {
        _data[_name] = _snippet;
      }

      fs.writeFileSync(this.snippetsPath, JSON.stringify(_data, null, 2));
    } catch (_error: unknown) {
      console._error(chalk.red(`Failed to save snippets: ${_error.message}`));
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private detectLanguage(
    _code: string,
    defaultLang: string = "javascript",
  ): string {
    // Simple _language detection based on patterns
    if (
      _code.includes("function") ||
      _code.includes("=>") ||
      _code.includes("const ")
    ) {
      return "javascript";
    } else if (_code.includes("def ") || _code.includes("import ")) {
      return "python";
    } else if (_code.includes("public class") || _code.includes("private ")) {
      return "java";
    } else if (_code.includes("<?php")) {
      return "php";
    } else if (
      _code.includes("func ") ||
      _code.includes("let ") ||
      _code.includes("var ")
    ) {
      return "swift";
    } else if (_code.includes("package main")) {
      return "go";
    }
    return defaultLang;
  }

  private generateSampleCode(_name: string): string {
    // Generate sample code based on _snippet _name
    if (name.includes("sort")) {
      return `function quickSort(arr) {
  if (arr.length <= 1) return arr;
  const _pivot = arr[0];
  const _left = arr.slice(1).filter(x => x < pivot);
  const _right = arr.slice(1).filter(x => x >= pivot);
  return [...quickSort(left), pivot, ...quickSort(right)];
}`;
    } else if (name.includes("auth")) {
      return `async function authenticate(username, _password) {
  const _user = await db.users.findOne({ username });
  if (!user) return { success: false, _error: 'User not found' };
  const _valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return { success: false, _error: 'Invalid password' };
  const _token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);
  return { success: true, token };
}`;
    } else {
      return `// ${_name} _snippet
function ${name.replace(/[^a-zA-Z0-9]/g, "")}() {
  // TODO: Implement ${_name}
  console.log('${_name} executed');
}`;
    }
  }
}
