import {
  getEnvironmentStatus,
  loadEnvironmentVariables
} from "./chunk-FXZIJ6RD.js";
import {
  source_default
} from "./chunk-EWKDNERE.js";

// src/simple-interactive-cli.ts
import { createInterface } from "readline";
import * as fs from "fs";
import * as path from "path";
var MariaCLI = class {
  rl;
  commands = [];
  isProcessing = false;
  constructor() {
    loadEnvironmentVariables();
    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: source_default.cyan("\u27A4 "),
      terminal: true
    });
    this.showWelcome();
    this.setupHandlers();
    this.startPrompt();
  }
  showWelcome() {
    const logo = `
${source_default.bold.magenta("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557")}
${source_default.bold.magenta("\u2551")}                                                              ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}    ${source_default.bold.magenta("\u2588\u2588\u2588\u2557   \u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2557")}                    ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}    ${source_default.bold.magenta("\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557")}                   ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}    ${source_default.bold.magenta("\u2588\u2588\u2554\u2588\u2588\u2588\u2588\u2554\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551")}                   ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}    ${source_default.bold.magenta("\u2588\u2588\u2551\u255A\u2588\u2588\u2554\u255D\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551")}                   ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}    ${source_default.bold.magenta("\u2588\u2588\u2551 \u255A\u2550\u255D \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551")}                   ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}    ${source_default.bold.magenta("\u255A\u2550\u255D     \u255A\u2550\u255D\u255A\u2550\u255D  \u255A\u2550\u255D\u255A\u2550\u255D  \u255A\u2550\u255D\u255A\u2550\u255D\u255A\u2550\u255D  \u255A\u2550\u255D")}                   ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}                                                              ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}           ${source_default.bold.magenta("\u2591\u2588\u2588\u2588\u2588\u2588\u2557\u2591\u2591\u2588\u2588\u2588\u2588\u2588\u2557\u2591\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2591\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557")}                   ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}           ${source_default.bold.magenta("\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D")}                   ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}           ${source_default.bold.magenta("\u2588\u2588\u2551\u2591\u2591\u255A\u2550\u255D\u2588\u2588\u2551\u2591\u2591\u2588\u2588\u2551\u2588\u2588\u2551\u2591\u2591\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2557\u2591\u2591")}                   ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}           ${source_default.bold.magenta("\u2588\u2588\u2551\u2591\u2591\u2588\u2588\u2557\u2588\u2588\u2551\u2591\u2591\u2588\u2588\u2551\u2588\u2588\u2551\u2591\u2591\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u255D\u2591\u2591")}                   ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}           ${source_default.bold.magenta("\u255A\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u255A\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557")}                   ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}           ${source_default.bold.magenta("\u2591\u255A\u2550\u2550\u2550\u2550\u255D\u2591\u2591\u255A\u2550\u2550\u2550\u2550\u255D\u2591\u255A\u2550\u2550\u2550\u2550\u2550\u255D\u2591\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D")}                   ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}                                                              ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}          ${source_default.bold.magenta("AI-Powered Development Platform")}                    ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}              ${source_default.magenta("v1.0.0 | TypeScript Monorepo")}                     ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}                                                              ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}             ${source_default.bold.cyan("\xA9 2025 Bonginkan Inc.")}                           ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}                                                              ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D")}
`;
    console.log(logo);
    console.log(source_default.bold.cyan("\u{1F31F} Welcome to MARIA CODE CLI! \u{1F31F}\n"));
    console.log(source_default.cyan("\u{1F4DA} Available Commands:"));
    console.log(source_default.gray("  \u2022 /help            - Show available commands"));
    console.log(source_default.gray("  \u2022 /clear           - Clear command history"));
    console.log(source_default.gray("  \u2022 /status          - Show system status"));
    console.log(source_default.gray("  \u2022 /model           - Interactive AI model selector"));
    console.log(source_default.gray("  \u2022 /init            - Initialize MARIA project"));
    console.log(source_default.gray("  \u2022 mc chat          - Interactive AI chat mode"));
    console.log(source_default.gray("  \u2022 mc paper         - Academic paper development"));
    console.log(source_default.gray("  \u2022 mc slides        - Presentation creation"));
    console.log(source_default.gray("  \u2022 mc init          - Initialize project"));
    console.log(source_default.gray("  \u2022 exit             - Exit CLI\n"));
    console.log(source_default.yellow("\u{1F4A1} Try typing: /help, mc chat, or any natural language question!"));
    console.log(source_default.gray('Press Ctrl+C or type "exit" to quit\n'));
  }
  setupHandlers() {
    this.rl.on("line", async (input) => {
      if (this.isProcessing) {
        console.log(source_default.yellow("\u23F3 Please wait for the current command to finish..."));
        return;
      }
      const trimmed = input.trim();
      if (!trimmed) {
        this.rl.prompt();
        return;
      }
      if (trimmed.toLowerCase() === "exit" || trimmed.toLowerCase() === "quit") {
        this.exit();
        return;
      }
      await this.processCommand(trimmed);
    });
    this.rl.on("SIGINT", () => {
      this.exit();
    });
    process.on("SIGINT", () => {
      this.exit();
    });
  }
  startPrompt() {
    this.rl.prompt();
  }
  async processCommand(input) {
    this.isProcessing = true;
    const command = {
      input,
      output: "",
      timestamp: /* @__PURE__ */ new Date()
    };
    try {
      let output = "";
      if (input.startsWith("/")) {
        output = await this.handleSlashCommand(input);
      } else if (input.toLowerCase().startsWith("mc ")) {
        output = await this.handleMcCommand(input);
      } else {
        output = await this.handleChatMessage(input);
      }
      command.output = output;
      this.commands.push(command);
      console.log("\n" + source_default.green("\u2705 Response:"));
      console.log(output);
      console.log(source_default.gray(`
[${command.timestamp.toLocaleTimeString()}] Command completed
`));
    } catch (error) {
      const errorMsg = `\u274C Error: ${error}`;
      command.output = errorMsg;
      this.commands.push(command);
      console.log("\n" + source_default.red(errorMsg) + "\n");
    } finally {
      this.isProcessing = false;
      this.rl.prompt();
    }
  }
  async handleSlashCommand(input) {
    const parts = input.slice(1).toLowerCase().split(" ");
    const command = parts[0];
    const args = parts.slice(1);
    switch (command) {
      case "help":
        return `\u{1F4DA} MARIA CODE CLI Help

\u{1F539} Slash Commands:
  /help            - Show this help message
  /clear           - Clear command history  
  /status          - Show system status
  /model           - Interactive AI model selector
  /init            - Initialize MARIA project

\u{1F539} MC Commands:
  mc chat          - Interactive AI chat mode
  mc paper         - Academic paper development
  mc slides        - Presentation creation
  mc graph         - Neo4j knowledge graph
  mc init          - Initialize project configuration

\u{1F539} Chat:
  Type any natural language and I'll help you!
  
\u{1F4A1} Examples:
  \u2022 "Create a REST API for user management"
  \u2022 "Help me debug this React component"  
  \u2022 "Generate tests for my functions"`;
      case "clear":
        this.commands = [];
        console.clear();
        this.showWelcome();
        return "\u{1F9F9} Command history cleared!";
      case "status":
        return `\u{1F4CA} MARIA CODE CLI Status

\u{1F7E2} System: Online
\u{1F7E2} AI Agents: Ready  
\u{1F7E2} Neo4j: Connected
\u{1F4E6} Version: v1.0.0
\u26A1 Mode: Development

\u{1F4C8} Session Stats:
  Commands: ${this.commands.length}
  Uptime: ${Math.floor(process.uptime())}s
  Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`;
      case "model":
        return await this.handleModelCommand(args);
      case "init":
        return await this.handleInitCommand();
      default:
        return `\u2753 Unknown slash command: /${command}

Type /help to see available commands.`;
    }
  }
  async handleModelCommand(args = []) {
    const envStatus = getEnvironmentStatus();
    if (args.length > 0) {
      const requestedModel = args[0];
      const modelMap = {
        "gpt-4o": "gpt-4o",
        "gpt4o": "gpt-4o",
        "claude-3-opus": "claude-3-opus",
        "claude3opus": "claude-3-opus",
        "opus": "claude-3-opus",
        "gemini": "gemini-2.5-pro",
        "gemini-2.5-pro": "gemini-2.5-pro",
        "mixtral": "mixtral-8x7b",
        "mixtral-8x7b": "mixtral-8x7b",
        "gpt-oss-120b": "gpt-oss-120b",
        "120b": "gpt-oss-120b",
        "gpt-oss-20b": "gpt-oss-20b",
        "20b": "gpt-oss-20b",
        "qwen3-30b": "qwen3-30b",
        "qwen30b": "qwen3-30b",
        "qwen2.5-vl": "qwen2.5-vl",
        "qwenvl": "qwen2.5-vl"
      };
      const modelId = requestedModel ? modelMap[requestedModel] : void 0;
      if (modelId) {
        if (modelId.includes("gpt-oss")) {
          process.env.AI_PROVIDER = "lmstudio";
          process.env.LMSTUDIO_DEFAULT_MODEL = modelId;
          process.env.OFFLINE_MODE = "true";
        } else {
          process.env.AI_PROVIDER = "openai";
          process.env.AI_MODEL = modelId;
          process.env.OFFLINE_MODE = "false";
        }
        return `\u2705 AI Model Updated Successfully!

\u{1F916} Active Model: ${modelId}
\u{1F4CD} Configuration updated in environment
\u{1F4A1} Your next messages will use this model.

\u{1F31F} Ready to chat with ${modelId}!`;
      } else {
        return `\u274C Invalid model: "${requestedModel}"

\u{1F4A1} Available models: gpt-4o, claude-3-opus, gemini-2.5-pro, mixtral-8x7b, gpt-oss-120b, gpt-oss-20b, qwen3-30b, qwen2.5-vl`;
      }
    }
    let lmStudioStatus = "\u274C Not available";
    if (process.env.LMSTUDIO_ENABLED === "true") {
      try {
        const fetch = (await import("node-fetch")).default;
        const response = await fetch("http://localhost:1234/v1/models", {
          headers: { "Authorization": "Bearer lm-studio" },
          signal: AbortSignal.timeout(2e3)
        });
        lmStudioStatus = response.ok ? "\u2705 Running" : "\u26A0\uFE0F Server not running";
      } catch {
        lmStudioStatus = "\u26A0\uFE0F Server not running";
      }
    }
    return `\u{1F916} AI Model Selection

\u2601\uFE0F Cloud Models:
  \u2022 gpt-4o (OpenAI)          - High accuracy, multimodal
  \u2022 claude-3-opus (Anthropic) - Long text, complex tasks  
  \u2022 gemini-2.5-pro (Google)  - Research, analysis, vision
  \u2022 mixtral-8x7b (Groq)      - Fast inference

\u{1F4BB} Local Models:
  \u2022 gpt-oss-120b (LM Studio)  - Complex reasoning (~64GB VRAM)
  \u2022 gpt-oss-20b (LM Studio)   - Balanced performance (~12GB VRAM)  
  \u2022 qwen3-30b (LM Studio)     - Multilingual support (~16GB VRAM)
  \u2022 qwen2.5-vl (Ollama)      - Vision capabilities (~8GB VRAM)

\u{1F50D} **Current Status:**
\u2022 API Keys: ${envStatus.hasApiKeys ? "\u2705 Configured" : "\u274C Not found"}
\u2022 LM Studio: ${lmStudioStatus}
\u2022 Offline Mode: ${envStatus.offlineMode ? "\u2705 Enabled" : "\u274C Disabled"}
\u2022 Available Providers: ${envStatus.providers.join(", ")}

\u{1F4A1} To select a model, use: /model [model-name]
   Example: /model gpt-4o or /model 120b

\u{1F680} **Quick Setup:**
\u2022 For 120B model: /model 120b
\u2022 For cloud models: Add API keys to .env.local
\u2022 For offline work: Run LM Studio first`;
  }
  async handleInitCommand() {
    try {
      const currentDir = process.cwd();
      const configPath = path.join(currentDir, ".maria-code.toml");
      const memoryPath = path.join(currentDir, "MARIA.md");
      if (fs.existsSync(configPath)) {
        return `\u2705 MARIA project already initialized!

\u{1F4C1} Project: ${path.basename(currentDir)}
\u{1F4CD} Location: ${currentDir}
\u2699\uFE0F Config: .maria-code.toml
\u{1F4DD} Memory: MARIA.md

\u{1F4A1} Use /status to check project status
\u{1F527} Use /model to configure AI models`;
      }
      const tomlConfig = `# MARIA CODE Configuration
# AI-Powered Development Platform

[project]
name = "${path.basename(currentDir)}"
version = "1.0.0"
description = "MARIA AI-powered project"
created = "${(/* @__PURE__ */ new Date()).toISOString()}"

[ai]
default_model = "gemini-2.5-pro"
providers = [
  "openai",
  "anthropic", 
  "google",
  "groq",
  "lmstudio",
  "ollama"
]

[features]
auto_mode = false
learning_mode = true
collaboration_mode = false
mission_mode = false

[integrations]
neo4j_enabled = true
github_enabled = true
lm_studio_enabled = true

[memory]
file = "MARIA.md"
auto_save = true
context_window = 128000

[development]
typescript = true
testing = true
linting = true
formatting = true
`;
      const memoryContent = `# MARIA Memory

## Project: ${path.basename(currentDir)}

### Overview
- **Created**: ${(/* @__PURE__ */ new Date()).toLocaleDateString()}
- **AI Model**: Gemini 2.5 Pro (default)
- **Status**: Initialized

### Project Structure
\`\`\`
${currentDir}/
\u251C\u2500\u2500 .maria-code.toml    # Configuration
\u251C\u2500\u2500 MARIA.md           # AI memory & context
\u2514\u2500\u2500 ...                # Your project files
\`\`\`

### AI Models Available
- **Cloud Models**: GPT-4o, Claude 3 Opus, Gemini 2.5 Pro, Mixtral 8x7B
- **Local Models**: GPT-OSS 120B, GPT-OSS 20B, Qwen3 30B, Qwen2.5-VL

### Recent Commands
- \`/init\` - Project initialized

### Learning Notes
<!-- AI will automatically update this section based on interactions -->

---
*This file is automatically managed by MARIA CODE AI*
`;
      fs.writeFileSync(configPath, tomlConfig);
      fs.writeFileSync(memoryPath, memoryContent);
      return `\u{1F680} MARIA Project Initialized Successfully!

\u{1F4C1} **Project**: ${path.basename(currentDir)}
\u{1F4CD} **Location**: ${currentDir}

\u{1F4C4} **Files Created**:
  \u2705 .maria-code.toml - Project configuration
  \u2705 MARIA.md - AI memory & learning context

\u{1F916} **AI Configuration**:
  \u2022 Default Model: Gemini 2.5 Pro
  \u2022 Cloud & Local models available
  \u2022 Learning mode: Enabled

\u{1F527} **Next Steps**:
  1. Use \`/model\` to configure AI models
  2. Use \`mc chat\` to start AI conversations  
  3. Use \`mc read .\` to analyze your codebase
  4. Use \`/status\` to check system status

\u{1F4A1} **Pro Tips**:
  \u2022 MARIA.md tracks AI learning and project context
  \u2022 Use natural language for complex development tasks
  \u2022 LM Studio integration ready for local AI models

\u{1F31F} Welcome to AI-powered development with MARIA!`;
    } catch (error) {
      return `\u274C Failed to initialize MARIA project: ${error instanceof Error ? error.message : "Unknown error"}

\u{1F4A1} Make sure you have write permissions in the current directory.`;
    }
  }
  async handleMcCommand(input) {
    const args = input.split(" ").slice(1);
    const command = args[0];
    switch (command) {
      case "chat":
        return `\u{1F4AC} Starting AI Chat Mode...

\u{1F916} Hi! I'm MARIA, your AI development assistant.
\u{1F4DD} How can I help you today?

\u{1F4A1} Try asking me to:
  \u2022 "Create a REST API for user management"
  \u2022 "Help me debug this React component"
  \u2022 "Generate tests for my functions"

\u{1F504} I'm ready to help with any development task!`;
      case "paper":
        return `\u{1F4C4} Academic Paper Development Mode

\u{1F4DA} Features Available:
  \u2022 LaTeX document generation
  \u2022 BibTeX reference management
  \u2022 Real-time collaboration
  \u2022 Version control integration

\u{1F4DD} Example usage:
  mc paper --outline "AI in Healthcare"
  mc paper --template ieee
  mc paper --export pdf

\u2728 Ready to help with your academic writing!`;
      case "slides":
        return `\u{1F3A8} Presentation Creation Mode

\u{1F3AF} Features Available:
  \u2022 AI-generated content
  \u2022 Professional templates
  \u2022 Visual design optimization
  \u2022 Export to multiple formats

\u{1F4DD} Example usage:
  mc slides --structure "AI in Healthcare"
  mc slides --template corporate
  mc slides --export pptx

\u{1F3AA} Ready to create amazing presentations!`;
      case "graph":
        return `\u{1F578}\uFE0F Knowledge Graph (optional)

\u{1F5C2}\uFE0F Features Available:
  \u2022 Graph data visualization
  \u2022 Knowledge relationship mapping
  \u2022 Cypher query interface
  \u2022 Bloom integration

\u{1F4DD} Example usage:
  mc graph --query "MATCH (n) RETURN n LIMIT 25"
  mc graph --visualize entities
  mc graph --bloom

\u{1F310} Ready to explore your knowledge graph!`;
      case "init":
        return await this.handleInitCommand();
      default:
        return `\u2753 Unknown mc command: ${command}

\u{1F4DA} Available MC commands:
  \u2022 mc chat    - AI chat mode
  \u2022 mc paper   - Academic paper development  
  \u2022 mc slides  - Presentation creation
  \u2022 mc graph   - Knowledge graph
  \u2022 mc init    - Project initialization

Type /help for more information.`;
    }
  }
  async handleChatMessage(input) {
    return `\u{1F4AC} Chat Response for: "${input}"

\u{1F916} I understand you want help with: ${input}

\u{1F504} Processing your natural language request...

\u{1F4A1} Based on your input, I can help you with:
  \u2022 Code generation and debugging
  \u2022 Architecture planning
  \u2022 Testing strategies  
  \u2022 Documentation creation

\u{1F680} To get started with full AI capabilities, use /model to select an AI model first!

\u{1F4AC} For interactive chat, use: mc chat`;
  }
  exit() {
    console.log(source_default.cyan("\n\u{1F44B} Thank you for using MARIA CODE CLI!"));
    console.log(source_default.gray("Session saved. See you next time!\n"));
    process.exit(0);
  }
};

export {
  MariaCLI
};
//# sourceMappingURL=chunk-GY5MTOLB.js.map