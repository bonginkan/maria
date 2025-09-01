/**
 * Unified Init Command
 * Enhanced with intelligent project analysis and safe MARIA.md generation
 */

import chalk from "chalk";
import * as fs from "fs/promises";
import * as path from "path";
import prompts from "prompts";
import type { DualMemoryEngine } from "../../services/memory-system/dual-memory-engine";
import type { MemoryCoordinator } from "../../services/memory-system/memory-coordinator";
import { loadCompleteConfig } from "../../config/loader";
import { executeInit as runNewInit } from "../../services/init";
import { InitCommand } from "../../services/init/init.command";
import type { KnowledgeGraphService } from "../../services/knowledge-graph/KnowledgeGraphService";

// Legacy options interface (kept for backward compatibility)
export interface LegacyInitOptions {
  name?: string;
  type?: "web" | "api" | "cli" | "library" | "mobile" | "desktop" | "auto";
  framework?: string;
  language?: string;
  description?: string;
  author?: string;
  license?: string;
  interactive?: boolean;
  force?: boolean;
  template?: string;
  gitInit?: boolean;
}

export async function executeInit(
  args: string[] = [],
  _maria?: unknown,
  _memoryEngine?: DualMemoryEngine | null,
  _memoryCoordinator?: MemoryCoordinator | null,
): Promise<boolean | "exit"> {
  // Check for Graph RAG enhanced init
  const useGraphRAG =
    args.includes("--graph-rag") ||
    args.includes("--ast") ||
    args.includes("--knowledge-graph") ||
    process.env.MARIA_GRAPH_RAG === "true";

  // Feature flag check for new intelligent scanner
  const useNewScanner =
    args.includes("--scan") ||
    process.env.MARIA_INIT_SCAN === "true" ||
    args.includes("--json");

  if (useGraphRAG) {
    // Use new Graph RAG enhanced init
    return runGraphRAGInit(args, _memoryEngine);
  }

  if (useNewScanner) {
    // Use new intelligent scanner
    return runNewInit(args);
  }

  // Legacy implementation for backward compatibility
  return legacyInit(args);
}

/**
 * Graph RAG enhanced init implementation
 */
async function runGraphRAGInit(
  args: string[],
  memoryEngine?: DualMemoryEngine | null,
): Promise<boolean | "exit"> {
  try {
    console.log(chalk.blue("🚀 Starting Graph RAG Enhanced Analysis..."));

    // Parse command line options
    const options = parseInitOptions(args);

    // Initialize knowledge graph service if available
    let knowledgeGraph: KnowledgeGraphService | undefined;
    try {
      const { KnowledgeGraphService } = await import(
        "../../services/knowledge-graph/KnowledgeGraphService"
      );
      knowledgeGraph = new KnowledgeGraphService({
        enableRAG: true,
        enablePersistence: true,
        analysisRootDir: process.cwd(),
      });
      await knowledgeGraph.initialize();
    } catch (error) {
      console.log(
        chalk.yellow(
          "⚠️ Knowledge Graph service not available, continuing with basic analysis",
        ),
      );
    }

    // Create and execute init command
    const initCommand = new InitCommand(knowledgeGraph, memoryEngine);
    const result = await initCommand.execute(options);

    if (result.success) {
      console.log(
        chalk.green("\n🎉 Graph RAG analysis completed successfully!"),
      );
      console.log(chalk.gray(`📊 Scanned: ${result.stats.filesScanned} files`));
      console.log(
        chalk.gray(`📈 Created: ${result.stats.nodesCreated} knowledge nodes`),
      );
      console.log(
        chalk.gray(`🔗 Built: ${result.stats.edgesCreated} relationships`),
      );
      console.log(
        chalk.gray(`⏱️ Time: ${(result.stats.timeMs / 1000).toFixed(2)}s`),
      );

      if (result.warnings.length > 0) {
        console.log(chalk.yellow(`\n⚠️ Warnings: ${result.warnings.length}`));
        result.warnings
          .slice(0, 3)
          .forEach((w) => console.log(chalk.yellow(`  • ${w}`)));
      }

      console.log(
        chalk.green("\n✅ MARIA.md has been updated with intelligent insights"),
      );
      console.log(chalk.gray('💡 Run "maria /update" for incremental updates'));

      return true;
    } else {
      console.error(chalk.red("❌ Graph RAG analysis failed"));
      return false;
    }
  } catch (error: any) {
    console.error(chalk.red("❌ Graph RAG init failed:"), error.message);
    return false;
  }
}

/**
 * Parse init command line options
 */
function parseInitOptions(args: string[]) {
  return {
    root: process.cwd(),
    force: args.includes("--force"),
    json: args.includes("--json"),
    verbose: args.includes("--verbose") || args.includes("-v"),
    skipDocs: args.includes("--skip-docs"),
    skipTests: args.includes("--skip-tests"),
    parallel: args.find((arg) => arg.startsWith("--parallel="))?.split("=")[1]
      ? parseInt(
          args.find((arg) => arg.startsWith("--parallel="))!.split("=")[1],
        )
      : 4,
    maxDepth: args.find((arg) => arg.startsWith("--max-depth="))?.split("=")[1]
      ? parseInt(
          args.find((arg) => arg.startsWith("--max-depth="))!.split("=")[1],
        )
      : 10,
    budgetMs: args.find((arg) => arg.startsWith("--budget-ms="))?.split("=")[1]
      ? parseInt(
          args.find((arg) => arg.startsWith("--budget-ms="))!.split("=")[1],
        )
      : 30000,
  };
}

/**
 * Legacy init implementation (preserved for compatibility)
 */
async function legacyInit(args: string[]): Promise<boolean | "exit"> {
  try {
    const _config = loadCompleteConfig();
    const projectPath = process.cwd();

    console.log(chalk.blue("🚀 Initializing MARIA configuration..."));

    // Check if already initialized
    const tomlPath = path.join(projectPath, ".maria-code.toml");
    const existingConfig = await fileExists(tomlPath);

    if (existingConfig && !args.includes("--force")) {
      const result = await prompts({
        type: "confirm",
        name: "overwrite",
        message: "MARIA configuration already exists. Overwrite?",
        initial: false,
      });

      if (!result.overwrite) {
        console.log(chalk.yellow("🛑 Initialization cancelled"));
        return "exit";
      }

      // Backup existing files
      await safeBackup(tomlPath);
      const mdPath = path.join(projectPath, "MARIA.md");
      if (await fileExists(mdPath)) {
        await safeBackup(mdPath);
      }
    }

    // Interactive setup or use defaults
    let projectConfig: any;
    if (!args.includes("--no-interactive")) {
      projectConfig = await interactiveSetup();
    } else {
      projectConfig = getDefaultConfig();
    }

    // Create .maria-code.toml
    const tomlContent = generateTomlConfig(projectConfig);
    await fs.writeFile(tomlPath, tomlContent, "utf-8");
    console.log(
      chalk.green(`✅ Created: ${path.relative(projectPath, tomlPath)}`),
    );

    // Create MARIA.md
    const mdPath = path.join(projectPath, "MARIA.md");
    const mdContent = generateMariaMd(projectConfig);
    await fs.writeFile(mdPath, mdContent, "utf-8");
    console.log(
      chalk.green(`✅ Created: ${path.relative(projectPath, mdPath)}`),
    );

    // Initialize git if requested
    if (
      projectConfig.gitInit &&
      !(await fileExists(path.join(projectPath, ".git")))
    ) {
      try {
        const { execSync } = await import("child_process");
        execSync("git init", { cwd: projectPath, stdio: "pipe" });
        console.log(chalk.green("✅ Initialized git repository"));
      } catch (error) {
        console.log(chalk.yellow("⚠️ Could not initialize git repository"));
      }
    }

    // Display summary
    console.log(chalk.green("\n🎉 MARIA project initialized successfully!"));
    console.log(chalk.gray("\nNext steps:"));
    console.log(chalk.gray('  • Run "maria help" to see available commands'));
    console.log(chalk.gray("  • Edit MARIA.md to customize project guidance"));
    console.log(chalk.gray("  • Configure AI providers in .maria-code.toml"));

    return true;
  } catch (innerError) {
    console.error(chalk.red("❌ Error initializing MARIA:"), error);
    return false;
  }
}

/**
 * Helper functions
 */
async function fileExists(_filePath: string): Promise<boolean> {
  try {
    await fs.access(_filePath);
    return true;
  } catch {
    return false;
  }
}

async function safeBackup(_filePath: string): Promise<void> {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const bakPath = `${_filePath}.bak.${stamp}`;
    await fs.copyFile(_filePath, bakPath);
    console.log(
      chalk.gray(`  ↳ backup: ${path.relative(process.cwd(), bakPath)}`),
    );
  } catch {
    // Best effort backup
  }
}

async function interactiveSetup(): Promise<any> {
  const packageJsonPath = path.join(process.cwd(), "package.json");
  let packageJson: any = {};

  try {
    const packageData = await fs.readFile(packageJsonPath, "utf-8");
    packageJson = JSON.parse(packageData);
  } catch {
    // No package.json found
  }

  const result = await prompts([
    {
      type: "text",
      name: "name",
      message: "Project name:",
      initial: packageJson.name || path.basename(process.cwd()),
    },
    {
      type: "select",
      name: "type",
      message: "Project type:",
      choices: [
        { title: "Web Application", value: "web" },
        { title: "API/Backend", value: "api" },
        { title: "CLI Tool", value: "cli" },
        { title: "Library/Package", value: "library" },
        { title: "Auto-detect", value: "auto" },
      ],
      initial: 0,
    },
    {
      type: "text",
      name: "description",
      message: "Project description:",
      initial:
        packageJson.description || "AI-powered development project using MARIA",
    },
    {
      type: "text",
      name: "author",
      message: "Author:",
      initial:
        (typeof packageJson.author === "string" ? packageJson.author : "") ||
        "",
    },
    {
      type: "text",
      name: "license",
      message: "License:",
      initial: packageJson.license || "MIT",
    },
    {
      type: "confirm",
      name: "gitInit",
      message: "Initialize git repository?",
      initial: true,
    },
  ]);

  return result;
}

function getDefaultConfig(): unknown {
  return {
    name: path.basename(process.cwd()),
    type: "auto",
    description: "AI-powered development project using MARIA",
    author: "",
    license: "MIT",
    gitInit: true,
  };
}

function generateTomlConfig(_config: any): string {
  const currentDate = new Date().toISOString().split("T")[0];

  return `# MARIA Configuration
# Generated on ${currentDate}

[project]
name = "${(_config.name || "MARIA Project").replace(/"/g, '\\"')}"
type = "${_config.type || "auto"}"
description = "${(_config.description || "AI-powered development project").replace(/"/g, '\\"')}"
author = "${(_config.author || "").replace(/"/g, '\\"')}"
license = "${_config.license || "MIT"}"

[ai]
provider = "openai"
model = "gpt-5-mini-2025-08-07"
reasoning_effort = "minimal"
text_verbosity = "low"
max_output_tokens = 2048

[responses_api]
json_only = false

# Enable offline mode (uses local models)
offline = false

[development]
# Auto-save generated code
auto_save = true

# Enable real-time code analysis
live_analysis = true

# Memory system configuration
memory_system = "dual-layer"

[ui]
# CLI interface preferences
theme = "default"
animations = true
progress_indicators = true
`;
}

function generateMariaMd(_config: any): string {
  const currentDate = new Date().toISOString().split("T")[0];

  return `# MARIA.md

This file provides guidance to MARIA CODE when working with code in this repository.

## Repository Status

**Project**: ${_config.name || "MARIA Development Project"}
**Type**: ${_config.type || "TypeScript/Node.js"}
**Created**: ${currentDate}
**Last Updated**: ${currentDate}

## Project Overview

### Description
${_config.description || "AI-powered development project using MARIA CODE CLI for intelligent code generation, analysis, and project management."}

### Technology Stack
- **Runtime**: Node.js 20+ LTS
- **Language**: TypeScript
- **Package Manager**: pnpm
- **AI Integration**: MARIA Platform
- **Development**: MARIA CODE CLI

## Development Workflow

### MARIA CODE CLI Commands

#### Basic Commands
\`\`\`bash
# Initialize/analyze project
maria /init

# Get help and commands
maria /help

# Check project status
maria /status
\`\`\`

#### Advanced Commands  
\`\`\`bash
# Full project analysis
maria analyze --full

# Memory operations
maria memory --search "authentication"

# Configuration with latest models
maria _config --provider openai --model gpt-5-mini-2025-08-07
\`\`\`

## Configuration

Edit \`.maria-code.toml\` as needed for AI provider configuration.

## Best Practices

1. **Commit Configuration**: Always commit \`.maria-code.toml\` and \`MARIA.md\`
2. **Keep Documentation Updated**: Update this file with project changes
3. **Use Structured Outputs**: Prefer structured outputs for AI operations  
4. **Dual-Layer Memory**: Use the memory system for better assistance
5. **Regular Quality Checks**: Run \`maria /review\` regularly
`;
}
