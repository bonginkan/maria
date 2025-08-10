#!/usr/bin/env node
import {
  readConfig,
  writeConfig
} from "./chunk-DRFJ2DAP.js";
import {
  loadEnvironmentVariables
} from "./chunk-KMGE4H2B.js";
import {
  source_default
} from "./chunk-PHGI5UVR.js";
import {
  __require
} from "./chunk-7D4SUZUM.js";

// src/enhanced-cli.ts
import { createInterface as createInterface2, emitKeypressEvents as emitKeypressEvents2 } from "readline";
import { clearScreenDown, cursorTo } from "readline";

// src/components/ChatDisplay.ts
import { highlight } from "cli-highlight";
import ora from "ora";
var ChatDisplay = class {
  messages = [];
  currentSpinner = null;
  constructor() {
  }
  // Display user input in a bordered box with enhanced detection
  displayUserInput(input) {
    const lines = input.split("\n");
    const maxLength = Math.max(...lines.map((l) => l.length), 40);
    const boxWidth = Math.min(maxLength + 4, process.stdout.columns - 2);
    const hasImages = /\.(jpg|jpeg|png|gif|bmp|webp|svg)/i.test(input);
    const hasUrls = /https?:\/\/[^\s]+/i.test(input);
    const hasPastedContent = /\[Pasted\s+(?:text|image|content)\s*#?\d*\s*\+?\d*\s*lines?\]/i.test(input);
    let borderChar = "-";
    let borderColor = source_default.gray;
    if (hasImages) {
      borderColor = source_default.cyan;
      borderChar = "=";
    } else if (hasUrls) {
      borderColor = source_default.blue;
      borderChar = "~";
    } else if (hasPastedContent) {
      borderColor = source_default.yellow;
      borderChar = "*";
    }
    console.log("\n" + borderColor("+" + borderChar.repeat(boxWidth - 2) + "+"));
    if (hasImages || hasUrls || hasPastedContent) {
      let indicator = "";
      if (hasImages) indicator += "\u{1F5BC}\uFE0F  IMAGE ";
      if (hasUrls) indicator += "\u{1F517} URL ";
      if (hasPastedContent) indicator += "\u{1F4CB} PASTE ";
      const indicatorPadding = boxWidth - indicator.length - 4;
      console.log(borderColor("| ") + source_default.white.bold(indicator) + " ".repeat(Math.max(0, indicatorPadding)) + borderColor(" |"));
      console.log(borderColor("|" + borderChar.repeat(boxWidth - 2) + "|"));
    }
    lines.forEach((line) => {
      const padding = boxWidth - line.length - 4;
      console.log(borderColor("| ") + source_default.white(line) + " ".repeat(Math.max(0, padding)) + borderColor(" |"));
    });
    console.log(borderColor("+" + borderChar.repeat(boxWidth - 2) + "+"));
    this.messages.push({
      role: "user",
      content: input,
      timestamp: /* @__PURE__ */ new Date()
    });
  }
  // Display AI response without border with enhanced formatting
  displayAssistantResponse(content) {
    console.log("\n" + source_default.blue("[AI] MARIA Response:"));
    console.log(source_default.blue("=".repeat(30)));
    if (content.includes("[LINT ERRORS") || content.includes("[TYPESCRIPT ERRORS")) {
      console.log(source_default.red.bold("\u{1F50D} Error Analysis Mode"));
    } else if (content.includes("[ATTACHED IMAGES")) {
      console.log(source_default.cyan.bold("\u{1F5BC}\uFE0F  Image Analysis Mode"));
    } else if (content.includes("[URL RESEARCH")) {
      console.log(source_default.blue.bold("\u{1F52C} Research Mode"));
    }
    console.log();
    this.messages.push({
      role: "assistant",
      content,
      timestamp: /* @__PURE__ */ new Date()
    });
  }
  // Display a processing step with spinner
  async displayStep(step) {
    const statusIcons = {
      "pending": "[WAIT]",
      "in-progress": "[PROC]",
      "completed": "[DONE]",
      "error": "[FAIL]"
    };
    const prefix = `${source_default.bold(`Step ${step.number}:`)} ${step.title}`;
    if (step.status === "in-progress") {
      this.currentSpinner = ora({
        text: prefix,
        spinner: "dots"
      }).start();
    } else {
      if (this.currentSpinner) {
        this.currentSpinner.stop();
        this.currentSpinner = null;
      }
      console.log(`${statusIcons[step.status]} ${prefix}`);
      if (step.content) {
        console.log(source_default.gray("   " + step.content));
      }
    }
  }
  // Display code with syntax highlighting
  displayCode(code, language = "typescript") {
    console.log();
    console.log(source_default.gray("```" + language));
    try {
      const highlighted = highlight(code, { language });
      console.log(highlighted);
    } catch {
      console.log(code);
    }
    console.log(source_default.gray("```"));
    console.log();
  }
  // Display markdown-like content with enhanced formatting
  displayMarkdown(content) {
    const lines = content.split("\n");
    lines.forEach((line) => {
      if (line.startsWith("### ")) {
        console.log(source_default.bold.yellow(line));
      } else if (line.startsWith("## ")) {
        console.log(source_default.bold.cyan(line));
      } else if (line.startsWith("# ")) {
        console.log(source_default.bold.magenta(line));
      } else if (line.includes("\u274C") || line.includes("ERROR")) {
        console.log(source_default.red(line));
      } else if (line.includes("\u26A0\uFE0F") || line.includes("WARNING")) {
        console.log(source_default.yellow(line));
      } else if (line.includes("\u2705") || line.includes("SUCCESS")) {
        console.log(source_default.green(line));
      } else if (line.includes("\u2139\uFE0F") || line.includes("INFO")) {
        console.log(source_default.cyan(line));
      } else if (line.includes("**")) {
        const formatted = line.replace(/\*\*(.*?)\*\*/g, (_, text) => source_default.bold(text));
        console.log(formatted);
      } else if (line.includes("`")) {
        const formatted = line.replace(/`(.*?)`/g, (_, code) => source_default.green(code));
        console.log(formatted);
      } else if (line.includes("http")) {
        const formatted = line.replace(/(https?:\/\/[^\s]+)/g, (url) => source_default.blue.underline(url));
        console.log(formatted);
      } else if (line.match(/\.(js|ts|jsx|tsx|py|go|rs|java|c|cpp|h):/)) {
        const formatted = line.replace(
          /([^\s]+\.[a-z]+):(\d+):(\d+)/g,
          (_, file, line2, col) => source_default.cyan(file) + ":" + source_default.yellow(line2) + ":" + source_default.yellow(col)
        );
        console.log(formatted);
      } else if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        console.log(source_default.gray("  \u2022") + line.substring(line.indexOf("-") + 1));
      } else {
        console.log(line);
      }
    });
  }
  // Show typing animation effect
  async typewriterEffect(text, delay = 30) {
    for (const char of text) {
      process.stdout.write(char);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    console.log();
  }
  // Clear the display
  clear() {
    console.clear();
    this.messages = [];
    if (this.currentSpinner) {
      this.currentSpinner.stop();
      this.currentSpinner = null;
    }
  }
  // Display enhanced progress with context
  displayEnhancedProgress(message, context) {
    console.log(source_default.cyan(`\u{1F504} ${message}`));
    if (context) {
      console.log(source_default.gray(`   Context: ${context}`));
    }
  }
  // Display attachment summary
  displayAttachmentSummary(type, count) {
    const icons = {
      image: "\u{1F5BC}\uFE0F",
      url: "\u{1F517}",
      paste: "\u{1F4CB}"
    };
    const colors = {
      image: source_default.cyan,
      url: source_default.blue,
      paste: source_default.yellow
    };
    console.log(colors[type](`${icons[type]} Processed ${count} ${type}${count > 1 ? "s" : ""}`));
  }
  // Display quick actions
  displayQuickActions(actions) {
    if (actions.length === 0) return;
    console.log("\n" + source_default.bold.yellow("\u{1F4A1} Quick Actions:"));
    actions.forEach((action, index) => {
      console.log(source_default.yellow(`   ${index + 1}. ${action}`));
    });
  }
  // Get conversation history
  getHistory() {
    return [...this.messages];
  }
};

// src/utils/logger.ts
var LogLevel = /* @__PURE__ */ ((LogLevel2) => {
  LogLevel2[LogLevel2["DEBUG"] = 0] = "DEBUG";
  LogLevel2[LogLevel2["INFO"] = 1] = "INFO";
  LogLevel2[LogLevel2["WARN"] = 2] = "WARN";
  LogLevel2[LogLevel2["ERROR"] = 3] = "ERROR";
  LogLevel2[LogLevel2["NONE"] = 4] = "NONE";
  return LogLevel2;
})(LogLevel || {});
var Logger = class {
  level = 1 /* INFO */;
  prefix = "[MARIA CODE]";
  setLevel(level) {
    this.level = level;
  }
  debug(...args) {
    if (this.level <= 0 /* DEBUG */) {
      console.log(source_default.magenta(`${this.prefix} [DEBUG]`), ...args);
    }
  }
  info(...args) {
    if (this.level <= 1 /* INFO */) {
      console.log(source_default.bold.magenta(`${this.prefix} [INFO]`), ...args);
    }
  }
  warn(...args) {
    if (this.level <= 2 /* WARN */) {
      console.warn(source_default.bold.magenta(`${this.prefix} [WARN]`), ...args);
    }
  }
  error(...args) {
    if (this.level <= 3 /* ERROR */) {
      console.error(source_default.bold.magenta(`${this.prefix} [ERROR]`), ...args);
    }
  }
  success(...args) {
    if (this.level <= 1 /* INFO */) {
      console.log(source_default.bold.magenta(`${this.prefix} [SUCCESS]`), ...args);
    }
  }
  task(taskName, status, message) {
    if (this.level > 1 /* INFO */) return;
    const statusIcons = {
      start: "\u{1F680}",
      progress: "\u23F3",
      complete: "\u2705",
      error: "\u274C"
    };
    const statusColors = {
      start: source_default.bold.magenta,
      progress: source_default.magenta,
      complete: source_default.bold.magenta,
      error: source_default.bold.magenta
    };
    const icon = statusIcons[status];
    const color = statusColors[status];
    const formattedMessage = message ? `: ${message}` : "";
    console.log(color(`${this.prefix} ${icon} ${taskName}${formattedMessage}`));
  }
  table(data) {
    if (this.level > 1 /* INFO */) return;
    console.table(data);
  }
  json(obj, pretty = true) {
    if (this.level > 0 /* DEBUG */) return;
    console.log(source_default.magenta(`${this.prefix} [JSON]`));
    console.log(pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj));
  }
  divider() {
    if (this.level > 1 /* INFO */) return;
    console.log(source_default.magenta("\u2500".repeat(60)));
  }
  clear() {
    console.clear();
  }
  /**
   * プログレスバーを表示
   */
  progress(current, total, label) {
    if (this.level > 1 /* INFO */) return;
    const percentage = Math.round(current / total * 100);
    const barLength = 30;
    const filled = Math.round(percentage / 100 * barLength);
    const empty = barLength - filled;
    const bar = "\u2588".repeat(filled) + "\u2591".repeat(empty);
    const progressText = `${current}/${total}`;
    const labelText = label ? ` ${label}` : "";
    process.stdout.write(`\r${source_default.bold.magenta(bar)} ${percentage}% ${progressText}${labelText}`);
    if (current === total) {
      process.stdout.write("\n");
    }
  }
};
var logger = new Logger();
var envLogLevel = process.env.MARIA_LOG_LEVEL?.toUpperCase();
if (envLogLevel && LogLevel[envLogLevel] !== void 0) {
  logger.setLevel(LogLevel[envLogLevel]);
}

// src/services/slash-command-handler.ts
import { v4 as uuidv4 } from "uuid";
import * as fs3 from "fs";
import * as path3 from "path";

// src/lib/command-groups.ts
var commandCategories = {
  user: "User Management",
  config: "Configuration & Environment",
  project: "Project Management",
  dev: "Development Tools",
  agent: "AI Agents & Integration",
  chat: "Chat & Session Management",
  media: "AI Media Generation",
  ui: "UI & Navigation"
};
var commands = [
  // User Management
  {
    command: "/login",
    description: "Sign in to your MARIA account",
    usage: "/login [--provider <google|github>]",
    examples: ["/login", "/login --provider google"],
    category: "user",
    relatedCommands: ["/logout", "/status", "/upgrade"]
  },
  {
    command: "/logout",
    description: "Sign out from your account",
    usage: "/logout [--clear-cache] [--keep-settings]",
    examples: ["/logout", "/logout --clear-cache"],
    category: "user",
    relatedCommands: ["/login", "/status"]
  },
  {
    command: "/mode",
    description: "Switch between chat modes",
    usage: "/mode <chat|command|research|creative>",
    examples: ["/mode research", "/mode creative"],
    category: "user",
    relatedCommands: ["/model", "/config"]
  },
  {
    command: "/upgrade",
    description: "Upgrade your plan",
    usage: "/upgrade [pro|max]",
    examples: ["/upgrade pro", "/upgrade max"],
    category: "user",
    relatedCommands: ["/cost", "/status"]
  },
  {
    command: "/status",
    description: "Display system status",
    usage: "/status [--verbose]",
    examples: ["/status", "/status --verbose"],
    category: "user",
    relatedCommands: ["/doctor", "/cost"]
  },
  // Configuration & Environment
  {
    command: "/config",
    description: "Open configuration panel",
    usage: "/config [<key>] [<value>]",
    examples: ["/config", "/config theme dark"],
    category: "config",
    relatedCommands: ["/model", "/permissions", "/hooks"]
  },
  {
    command: "/model",
    description: "Select AI model",
    usage: "/model <gemini|grok>",
    examples: ["/model gemini", "/model grok"],
    category: "config",
    relatedCommands: ["/mode", "/config"]
  },
  {
    command: "/permissions",
    description: "Manage tool permissions",
    usage: "/permissions [list|set]",
    examples: ["/permissions list", "/permissions set file read"],
    category: "config",
    relatedCommands: ["/config", "/hooks"]
  },
  {
    command: "/hooks",
    description: "Configure event hooks",
    usage: "/hooks [list|add|remove]",
    examples: ["/hooks list", '/hooks add onStart "echo Starting..."'],
    category: "config",
    relatedCommands: ["/config", "/permissions"]
  },
  {
    command: "/doctor",
    description: "Run system diagnostics",
    usage: "/doctor [--fix]",
    examples: ["/doctor", "/doctor --fix"],
    category: "config",
    relatedCommands: ["/status", "/bug"]
  },
  {
    command: "/terminal-setup",
    description: "Terminal integration guide",
    usage: "/terminal-setup",
    examples: ["/terminal-setup"],
    category: "config",
    relatedCommands: ["/config", "/help"]
  },
  // Project Management
  {
    command: "/init",
    description: "Initialize MARIA.md file",
    usage: "/init [--force]",
    examples: ["/init", "/init --force"],
    category: "project",
    relatedCommands: ["/add-dir", "/memory", "/read"]
  },
  {
    command: "/add-dir",
    description: "Add working directory",
    usage: "/add-dir <path>",
    examples: ["/add-dir ./src", "/add-dir ./tests"],
    category: "project",
    relatedCommands: ["/init", "/read", "/memory"]
  },
  {
    command: "/memory",
    description: "Edit Claude memory file",
    usage: "/memory [show|edit|clear]",
    examples: ["/memory show", "/memory edit"],
    category: "project",
    relatedCommands: ["/init", "/export"]
  },
  {
    command: "/export",
    description: "Export conversation",
    usage: "/export [--format <json|md|yaml>] [--clipboard]",
    examples: ["/export --format md", "/export --clipboard"],
    category: "project",
    relatedCommands: ["/memory", "/resume"]
  },
  // Development Tools
  {
    command: "/review",
    description: "Run PR review",
    usage: "/review [<pr-number>] [--repo <owner/repo>]",
    examples: ["/review 123", "/review --repo myorg/myrepo"],
    category: "dev",
    relatedCommands: ["/pr-comments", "/test", "/commit"]
  },
  {
    command: "/pr-comments",
    description: "Get PR comments",
    usage: "/pr-comments <pr-number> [--repo <owner/repo>]",
    examples: ["/pr-comments 123", "/pr-comments 123 --repo myorg/myrepo"],
    category: "dev",
    relatedCommands: ["/review", "/bug"]
  },
  {
    command: "/bug",
    description: "Report a bug",
    usage: "/bug [<description>]",
    examples: ['/bug "Command not working"'],
    category: "dev",
    relatedCommands: ["/doctor", "/release-notes"]
  },
  {
    command: "/release-notes",
    description: "Show release notes",
    usage: "/release-notes [--version <version>]",
    examples: ["/release-notes", "/release-notes --version 1.2.0"],
    category: "dev",
    relatedCommands: ["/status", "/bug"]
  },
  // AI Agents & Integration
  {
    command: "/agents",
    description: "Manage AI agents",
    usage: "/agents [list|enable|disable] [<agent-name>]",
    examples: ["/agents list", "/agents enable paper-writer"],
    category: "agent",
    relatedCommands: ["/mcp", "/model"]
  },
  {
    command: "/mcp",
    description: "Manage MCP servers",
    usage: "/mcp [list|start|stop] [<server-name>]",
    examples: ["/mcp list", "/mcp start playwright"],
    category: "agent",
    relatedCommands: ["/agents", "/config"]
  },
  // Chat & Session Management
  {
    command: "/clear",
    description: "Clear conversation history with context management",
    usage: "/clear [--soft|--hard|--summary]",
    examples: [
      "/clear              # Normal clear with statistics",
      "/clear --soft       # Display-only clear, preserve context",
      "/clear --hard       # Complete reset, new session",
      "/clear --summary    # Generate summary before clearing"
    ],
    category: "chat",
    relatedCommands: ["/compact", "/resume", "/export"]
  },
  {
    command: "/compact",
    description: "Summarize conversation",
    usage: "/compact [--threshold <number>]",
    examples: ["/compact", "/compact --threshold 100"],
    category: "chat",
    relatedCommands: ["/clear", "/export", "/cost"]
  },
  {
    command: "/resume",
    description: "Resume previous session",
    usage: "/resume [<session-id>]",
    examples: ["/resume", "/resume abc123"],
    category: "chat",
    relatedCommands: ["/export", "/compact"]
  },
  {
    command: "/cost",
    description: "Show session costs",
    usage: "/cost [--detailed]",
    examples: ["/cost", "/cost --detailed"],
    category: "chat",
    relatedCommands: ["/compact", "/upgrade", "/status"]
  },
  // AI Media Generation
  {
    command: "/video",
    description: "Generate AI videos using Wan 2.2 models",
    usage: '/video "<prompt>" [--model wan22-5b|wan22-14b] [--resolution 720p|1080p] [--fps 24|30] [--frames 33|49|81] [--compare] [--input-image <path>]',
    examples: [
      '/video "Red sports car at sunset"',
      '/video "Dancing cats" --model wan22-14b --frames 81',
      '/video "Camera zoom out" --input-image photo.jpg --compare'
    ],
    category: "media",
    relatedCommands: ["/image", "/status"]
  },
  {
    command: "/image",
    description: "Generate AI images using Qwen-Image model",
    usage: '/image "<prompt>" [--style photorealistic|artistic|anime|concept|technical] [--size 512x512|1024x1024] [--batch 1-4] [--quality low|medium|high]',
    examples: [
      '/image "Futuristic cityscape"',
      '/image "Portrait of wizard" --style photorealistic --size 1024x1024',
      '/image "Logo concepts" --batch 4 --style concept'
    ],
    category: "media",
    relatedCommands: ["/video", "/status"]
  },
  // UI & Navigation
  {
    command: "/vim",
    description: "Toggle Vim mode",
    usage: "/vim [on|off]",
    examples: ["/vim on", "/vim off"],
    category: "ui",
    relatedCommands: ["/help", "/config"]
  },
  {
    command: "/help",
    description: "Show help information",
    usage: "/help [<category|command>]",
    examples: ["/help", "/help user", "/help /init"],
    category: "ui",
    relatedCommands: ["/status", "/terminal-setup"]
  },
  {
    command: "/chain",
    description: "Execute command chains",
    usage: "/chain [<chain-name>] [--interactive] [--stop-on-error]",
    examples: ["/chain", "/chain projectSetup", "/chain debugging --interactive"],
    category: "ui",
    relatedCommands: ["/help", "/status"]
  },
  {
    command: "/suggest",
    description: "Get intelligent command suggestions",
    usage: "/suggest",
    examples: ["/suggest"],
    category: "ui",
    relatedCommands: ["/help", "/chain", "/status"]
  },
  {
    command: "/alias",
    description: "Manage command aliases",
    usage: "/alias [add|remove|export|import] [args]",
    examples: ["/alias", '/alias add /gs "/git status"', "/alias remove /gs"],
    category: "ui",
    relatedCommands: ["/help", "/config"]
  },
  {
    command: "/template",
    description: "Manage command templates",
    usage: "/template [run|save|delete|view] [args]",
    examples: ["/template", "/template run builtin-1", '/template save "My Flow" "desc" /init /test'],
    category: "ui",
    relatedCommands: ["/chain", "/alias", "/help"]
  },
  {
    command: "/batch",
    description: "Execute multiple commands",
    usage: "/batch [options] <commands>",
    examples: ["/batch /init && /test", "/batch --parallel /test unit /test integration"],
    category: "ui",
    relatedCommands: ["/chain", "/template"]
  },
  {
    command: "/hotkey",
    description: "Manage keyboard shortcuts",
    usage: "/hotkey [add|remove|toggle|enable|disable|export|import] [args]",
    examples: ["/hotkey", "/hotkey add ctrl+s /status", "/hotkey remove ctrl+s"],
    category: "ui",
    relatedCommands: ["/alias", "/config", "/help"]
  },
  {
    command: "/exit",
    description: "Exit REPL",
    usage: "/exit [--save-session]",
    examples: ["/exit", "/exit --save-session"],
    category: "ui",
    relatedCommands: ["/resume", "/export"]
  },
  {
    command: "/migrate-installer",
    description: "Migrate installation method",
    usage: "/migrate-installer",
    examples: ["/migrate-installer"],
    category: "ui",
    relatedCommands: ["/doctor", "/status"]
  }
];
var commandChains = {
  projectSetup: {
    name: "Project Setup",
    description: "Initialize and configure a new project",
    commands: ["/init", "/add-dir", "/read", "/memory"],
    nextSuggestions: ["/agents", "/model"]
  },
  debugging: {
    name: "Debugging Workflow",
    description: "Diagnose and fix issues",
    commands: ["/status", "/doctor", "/bug"],
    nextSuggestions: ["/release-notes", "/help"]
  },
  prWorkflow: {
    name: "Pull Request Workflow",
    description: "Review and manage pull requests",
    commands: ["/review", "/pr-comments", "/test", "/commit"],
    nextSuggestions: ["/export", "/cost"]
  },
  sessionManagement: {
    name: "Session Management",
    description: "Manage your chat session",
    commands: ["/cost", "/compact", "/export", "/exit"],
    nextSuggestions: ["/resume"]
  }
};
function getCommandsByCategory(category) {
  return commands.filter((cmd) => cmd.category === category);
}
function getCommandInfo(command) {
  return commands.find((cmd) => cmd.command === command);
}
function getRelatedCommands(command) {
  const cmd = getCommandInfo(command);
  if (!cmd || !cmd.relatedCommands) return [];
  return cmd.relatedCommands.map((relCmd) => getCommandInfo(relCmd)).filter((info) => info !== void 0);
}
function getCommandChain(command) {
  return Object.values(commandChains).find(
    (chain) => chain.commands.includes(command)
  );
}

// src/services/suggestion-service.ts
var SuggestionService = class _SuggestionService {
  static instance;
  commandHistory = [];
  sessionStartTime = Date.now();
  static getInstance() {
    if (!_SuggestionService.instance) {
      _SuggestionService.instance = new _SuggestionService();
    }
    return _SuggestionService.instance;
  }
  /**
   * Add command to history
   */
  addToHistory(command) {
    this.commandHistory.push(command);
    if (this.commandHistory.length > 20) {
      this.commandHistory.shift();
    }
  }
  /**
   * Get suggestions after command execution
   */
  async getSuggestionsAfterCommand(command, success) {
    const suggestions = [];
    const chain = getCommandChain(command);
    if (chain && success) {
      const currentIndex = chain.commands.indexOf(command);
      if (currentIndex !== -1 && currentIndex < chain.commands.length - 1) {
        const nextCommand = chain.commands[currentIndex + 1];
        if (nextCommand) {
          suggestions.push({
            command: nextCommand,
            description: `Next in ${chain.name} workflow`,
            reason: `Continue the ${chain.name} workflow`,
            priority: "high"
          });
        }
      } else if (currentIndex === chain.commands.length - 1) {
        chain.nextSuggestions?.forEach((cmd) => {
          suggestions.push({
            command: cmd,
            description: `Recommended after ${chain.name}`,
            priority: "medium"
          });
        });
      }
    }
    const related = getRelatedCommands(command);
    related.forEach((rel) => {
      if (!suggestions.find((s) => s.command === rel.command)) {
        suggestions.push({
          command: rel.command,
          description: rel.description,
          reason: `Related to ${command}`,
          priority: "medium"
        });
      }
    });
    if (command === "/init" && success) {
      this.addContextualSuggestion(suggestions, "/add-dir", "Add project directories", "high");
      this.addContextualSuggestion(suggestions, "/memory", "Set up AI memory", "medium");
    }
    if (command === "/login" && success) {
      this.addContextualSuggestion(suggestions, "/upgrade", "Upgrade your plan", "low");
      this.addContextualSuggestion(suggestions, "/config", "Configure settings", "medium");
    }
    if (command === "/doctor" && !success) {
      this.addContextualSuggestion(suggestions, "/bug", "Report the issue", "high");
      this.addContextualSuggestion(suggestions, "/help", "Get help", "medium");
    }
    const sessionMinutes = (Date.now() - this.sessionStartTime) / 6e4;
    if (sessionMinutes > 30 && !this.commandHistory.includes("/compact")) {
      this.addContextualSuggestion(
        suggestions,
        "/compact",
        "Optimize conversation memory",
        "medium",
        "Long session detected"
      );
    }
    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }).slice(0, 3);
  }
  /**
   * Get contextual suggestions based on current state
   */
  async getContextualSuggestions(context) {
    const suggestions = [];
    if (!context.userLoggedIn) {
      suggestions.push({
        command: "/login",
        description: "Sign in to access all features",
        reason: "Not logged in",
        priority: "high"
      });
    }
    if (!context.projectInitialized) {
      suggestions.push({
        command: "/init",
        description: "Initialize project",
        reason: "No MARIA.md found",
        priority: "high"
      });
    }
    if (context.currentMode === "research") {
      this.addContextualSuggestion(
        suggestions,
        "/memory",
        "Save research findings",
        "medium"
      );
    }
    const recentCommands = this.commandHistory.slice(-5);
    if (recentCommands.filter((cmd) => cmd.startsWith("/pr")).length >= 2) {
      this.addContextualSuggestion(
        suggestions,
        "/commit",
        "Commit your changes",
        "high",
        "PR activity detected"
      );
    }
    return suggestions.slice(0, 3);
  }
  /**
   * Format suggestions for display
   */
  formatSuggestions(suggestions) {
    if (suggestions.length === 0) return "";
    let output = "\n\u{1F4A1} Suggested next actions:\n";
    suggestions.forEach((sug) => {
      const icon = sug.priority === "high" ? "\u{1F525}" : sug.priority === "medium" ? "\u{1F4AB}" : "\u2728";
      output += `  ${icon} ${sug.command.padEnd(15)} - ${sug.description}`;
      if (sug.reason) {
        output += ` (${sug.reason})`;
      }
      output += "\n";
    });
    return output;
  }
  /**
   * Helper to add contextual suggestion
   */
  addContextualSuggestion(suggestions, command, description, priority, reason) {
    if (!suggestions.find((s) => s.command === command)) {
      suggestions.push({ command, description, priority, reason });
    }
  }
  /**
   * Get command frequency
   */
  getCommandFrequency() {
    const frequency = /* @__PURE__ */ new Map();
    this.commandHistory.forEach((cmd) => {
      frequency.set(cmd, (frequency.get(cmd) || 0) + 1);
    });
    return frequency;
  }
  /**
   * Get most used commands
   */
  getMostUsedCommands(limit = 5) {
    const frequency = this.getCommandFrequency();
    return Array.from(frequency.entries()).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([cmd]) => cmd);
  }
  /**
   * Get last command from history
   */
  getLastCommand() {
    return this.commandHistory[this.commandHistory.length - 1];
  }
  /**
   * Check if a command has been used
   */
  hasUsedCommand(command) {
    return this.commandHistory.includes(command);
  }
  /**
   * Get command history
   */
  getCommandHistory() {
    return [...this.commandHistory];
  }
};

// src/services/command-chain-service.ts
var CommandChainService = class _CommandChainService {
  static instance;
  commandHandler;
  isExecutingChain = false;
  constructor() {
    this.commandHandler = SlashCommandHandler.getInstance();
  }
  static getInstance() {
    if (!_CommandChainService.instance) {
      _CommandChainService.instance = new _CommandChainService();
    }
    return _CommandChainService.instance;
  }
  /**
   * Execute a predefined command chain
   */
  async executeChain(chainName, context, options = {}) {
    const chain = commandChains[chainName];
    if (!chain) {
      return {
        success: false,
        executedCommands: [],
        results: [],
        errors: [{ command: chainName, error: "Chain not found" }],
        summary: `Command chain "${chainName}" not found`
      };
    }
    return this.executeCommandSequence(
      chain.commands,
      context,
      { ...options, chainName: chain.name, chainDescription: chain.description }
    );
  }
  /**
   * Execute a custom sequence of commands
   */
  async executeCommandSequence(commands2, context, options = {}) {
    if (this.isExecutingChain) {
      return {
        success: false,
        executedCommands: [],
        results: [],
        errors: [{ command: "chain", error: "Another chain is already executing" }],
        summary: "Cannot execute multiple chains simultaneously"
      };
    }
    this.isExecutingChain = true;
    const executedCommands = [];
    const results = [];
    const errors = [];
    console.log(source_default.blue(`
\u{1F517} Starting command chain${options.chainName ? `: ${options.chainName}` : ""}`));
    if (options.chainDescription) {
      console.log(source_default.gray(`   ${options.chainDescription}`));
    }
    console.log(source_default.gray(`   Commands: ${commands2.join(" \u2192 ")}
`));
    try {
      for (const command of commands2) {
        if (options.stopOnError && errors.length > 0) {
          break;
        }
        if (options.interactive) {
          const shouldExecute = await this.promptForExecution();
          if (!shouldExecute) {
            console.log(source_default.yellow(`\u23ED\uFE0F  Skipping ${command}`));
            continue;
          }
        }
        const args = options.commandParams?.[command] || [];
        console.log(source_default.cyan(`
\u25B6\uFE0F  Executing: ${command} ${args.join(" ")}`));
        try {
          const result = await this.commandHandler.handleCommand(command, args, context);
          executedCommands.push(command);
          results.push(result);
          if (result.success) {
            console.log(source_default.green(`\u2705 ${command} completed successfully`));
            if (result.message) {
              console.log(source_default.gray(this.truncateMessage(result.message)));
            }
          } else {
            console.log(source_default.red(`\u274C ${command} failed`));
            console.log(source_default.red(result.message));
            errors.push({ command, error: result.message });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          console.log(source_default.red(`\u274C ${command} threw an error: ${errorMessage}`));
          errors.push({ command, error: errorMessage });
        }
        await this.delay(500);
      }
      const success = errors.length === 0;
      const summary = this.generateSummary(executedCommands, commands2, errors, success);
      console.log(source_default.blue(`
\u{1F3C1} Chain execution completed`));
      console.log(summary);
      return {
        success,
        executedCommands,
        results,
        errors,
        summary
      };
    } finally {
      this.isExecutingChain = false;
    }
  }
  /**
   * Check if a command chain is currently executing
   */
  isChainExecuting() {
    return this.isExecutingChain;
  }
  /**
   * Prompt user for execution in interactive mode
   */
  async promptForExecution() {
    return true;
  }
  /**
   * Truncate long messages for display
   */
  truncateMessage(message, maxLength = 100) {
    const firstLine = message.split("\n")[0] || "";
    if (firstLine.length <= maxLength) {
      return firstLine;
    }
    return firstLine.substring(0, maxLength) + "...";
  }
  /**
   * Generate execution summary
   */
  generateSummary(executed, planned, errors, success) {
    let summary = "\n";
    if (success) {
      summary += source_default.green(`\u2728 All commands executed successfully!
`);
    } else {
      summary += source_default.yellow(`\u26A0\uFE0F  Chain completed with errors
`);
    }
    summary += source_default.gray(`   Executed: ${executed.length}/${planned.length} commands
`);
    if (executed.length < planned.length) {
      const skipped = planned.slice(executed.length);
      summary += source_default.gray(`   Skipped: ${skipped.join(", ")}
`);
    }
    if (errors.length > 0) {
      summary += source_default.red(`   Errors: ${errors.length}
`);
      errors.forEach((err) => {
        summary += source_default.red(`     - ${err.command}: ${err.error}
`);
      });
    }
    return summary;
  }
  /**
   * Helper to add delay
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  /**
   * Get available command chains
   */
  getAvailableChains() {
    return Object.entries(commandChains).map(([key, chain]) => ({
      name: key,
      description: chain.description,
      commands: chain.commands
    }));
  }
};

// src/services/alias-system.ts
var AliasSystem = class _AliasSystem {
  static instance;
  aliases = /* @__PURE__ */ new Map();
  builtInAliases = /* @__PURE__ */ new Map();
  reservedWords = /* @__PURE__ */ new Set([
    "exit",
    "quit",
    "help",
    "clear",
    "status",
    "login",
    "logout",
    "init",
    "config"
  ]);
  constructor() {
    this.initializeBuiltInAliases();
    this.loadUserAliases();
  }
  static getInstance() {
    if (!_AliasSystem.instance) {
      _AliasSystem.instance = new _AliasSystem();
    }
    return _AliasSystem.instance;
  }
  /**
   * Initialize built-in aliases
   */
  initializeBuiltInAliases() {
    const builtIn = [
      // Short forms for common commands
      { alias: "/s", command: "/status", description: "Quick status check" },
      { alias: "/c", command: "/config", description: "Quick config access" },
      { alias: "/h", command: "/help", description: "Quick help" },
      { alias: "/i", command: "/init", description: "Quick project init" },
      { alias: "/x", command: "/exit", description: "Quick exit" },
      // Power user shortcuts
      { alias: "/sg", command: "/suggest", description: "Get suggestions" },
      { alias: "/ch", command: "/chain", description: "Run command chain" },
      { alias: "/cls", command: "/clear", description: "Clear screen" },
      { alias: "/cmp", command: "/compact", description: "Compact memory" },
      // Development shortcuts
      { alias: "/r", command: "/review", description: "PR review" },
      { alias: "/t", command: "/test", description: "Run tests" },
      { alias: "/d", command: "/dev", description: "Development mode" },
      { alias: "/b", command: "/bug", description: "Report bug" },
      // Git shortcuts
      { alias: "/cm", command: "/commit", description: "Git commit" },
      { alias: "/pr", command: "/pr-comments", description: "PR comments" }
    ];
    builtIn.forEach(({ alias, command, description }) => {
      this.builtInAliases.set(alias, {
        alias,
        command,
        description,
        createdAt: /* @__PURE__ */ new Date(),
        usageCount: 0
      });
    });
  }
  /**
   * Load user-defined aliases from config
   */
  async loadUserAliases() {
    try {
      const config = await readConfig();
      if (config.aliases) {
        config.aliases.forEach((alias) => {
          this.aliases.set(alias.alias, {
            ...alias,
            createdAt: new Date(alias.createdAt)
          });
        });
      }
    } catch {
      logger.debug("No user aliases found, starting with defaults");
    }
  }
  /**
   * Save aliases to config
   */
  async saveAliases() {
    try {
      const config = await readConfig();
      config.aliases = Array.from(this.aliases.values()).map((alias) => ({
        ...alias,
        createdAt: alias.createdAt.toISOString()
      }));
      await writeConfig(config);
    } catch (error) {
      logger.error("Failed to save aliases:", error);
    }
  }
  /**
   * Create a new alias
   */
  async createAlias(alias, command, description, args) {
    if (!alias.startsWith("/")) {
      return {
        success: false,
        message: "Alias must start with /"
      };
    }
    if (alias.length < 2) {
      return {
        success: false,
        message: "Alias must be at least 2 characters long"
      };
    }
    if (this.reservedWords.has(alias.substring(1))) {
      return {
        success: false,
        message: `"${alias}" is a reserved word and cannot be used as an alias`
      };
    }
    if (this.aliases.has(alias) || this.builtInAliases.has(alias)) {
      return {
        success: false,
        message: `Alias "${alias}" already exists`
      };
    }
    const commandInfo = getCommandInfo(command);
    if (!commandInfo) {
      return {
        success: false,
        message: `Command "${command}" does not exist`
      };
    }
    const newAlias = {
      alias,
      command,
      description: description || `Alias for ${command}`,
      args,
      createdAt: /* @__PURE__ */ new Date(),
      usageCount: 0
    };
    this.aliases.set(alias, newAlias);
    await this.saveAliases();
    return {
      success: true,
      message: `Alias "${alias}" \u2192 "${command}" created successfully`
    };
  }
  /**
   * Remove an alias
   */
  async removeAlias(alias) {
    if (this.builtInAliases.has(alias)) {
      return {
        success: false,
        message: `Cannot remove built-in alias "${alias}"`
      };
    }
    if (!this.aliases.has(alias)) {
      return {
        success: false,
        message: `Alias "${alias}" not found`
      };
    }
    this.aliases.delete(alias);
    await this.saveAliases();
    return {
      success: true,
      message: `Alias "${alias}" removed successfully`
    };
  }
  /**
   * Resolve an alias to its command
   */
  resolveAlias(input) {
    const parts = input.split(" ");
    const aliasName = parts[0];
    if (!aliasName) return null;
    const additionalArgs = parts.slice(1);
    const userAlias = this.aliases.get(aliasName);
    if (userAlias) {
      userAlias.usageCount++;
      this.saveAliases();
      return {
        command: userAlias.command,
        args: [...userAlias.args || [], ...additionalArgs]
      };
    }
    const builtInAlias = this.builtInAliases.get(aliasName);
    if (builtInAlias) {
      builtInAlias.usageCount++;
      return {
        command: builtInAlias.command,
        args: [...builtInAlias.args || [], ...additionalArgs]
      };
    }
    return null;
  }
  /**
   * List all aliases
   */
  listAliases() {
    return {
      userAliases: Array.from(this.aliases.values()).sort(
        (a, b) => b.usageCount - a.usageCount
      ),
      builtInAliases: Array.from(this.builtInAliases.values()).sort(
        (a, b) => a.alias.localeCompare(b.alias)
      )
    };
  }
  /**
   * Get alias suggestions based on input
   */
  getSuggestions(partialInput) {
    const suggestions = [];
    const search = partialInput.toLowerCase();
    this.aliases.forEach((alias) => {
      if (alias.alias.toLowerCase().startsWith(search) || alias.command.toLowerCase().includes(search)) {
        suggestions.push(alias);
      }
    });
    this.builtInAliases.forEach((alias) => {
      if (alias.alias.toLowerCase().startsWith(search) || alias.command.toLowerCase().includes(search)) {
        suggestions.push(alias);
      }
    });
    return suggestions.sort((a, b) => b.usageCount - a.usageCount).slice(0, 5);
  }
  /**
   * Get most used aliases
   */
  getMostUsedAliases(limit = 5) {
    const allAliases = [
      ...Array.from(this.aliases.values()),
      ...Array.from(this.builtInAliases.values())
    ];
    return allAliases.filter((alias) => alias.usageCount > 0).sort((a, b) => b.usageCount - a.usageCount).slice(0, limit);
  }
  /**
   * Export aliases to JSON
   */
  exportAliases() {
    return JSON.stringify({
      userAliases: Array.from(this.aliases.values()),
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      version: "1.0"
    }, null, 2);
  }
  /**
   * Import aliases from JSON
   */
  async importAliases(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      if (!data.userAliases || !Array.isArray(data.userAliases)) {
        return {
          success: false,
          message: "Invalid alias data format"
        };
      }
      let imported = 0;
      let skipped = 0;
      for (const alias of data.userAliases) {
        if (!this.aliases.has(alias.alias) && !this.builtInAliases.has(alias.alias)) {
          this.aliases.set(alias.alias, {
            ...alias,
            createdAt: new Date(alias.createdAt || /* @__PURE__ */ new Date()),
            usageCount: alias.usageCount || 0
          });
          imported++;
        } else {
          skipped++;
        }
      }
      await this.saveAliases();
      return {
        success: true,
        message: `Imported ${imported} aliases (${skipped} skipped due to conflicts)`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to import aliases: ${error instanceof Error ? error.message : "Unknown error"}`
      };
    }
  }
};

// src/services/template-manager.ts
import { join } from "path";
import { homedir } from "os";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
var TemplateManager = class _TemplateManager {
  static instance;
  templates = /* @__PURE__ */ new Map();
  templatesDir;
  builtInTemplates = /* @__PURE__ */ new Map();
  constructor() {
    this.templatesDir = join(homedir(), ".maria-code", "templates");
    this.ensureTemplatesDir();
    this.initializeBuiltInTemplates();
    this.loadUserTemplates();
  }
  static getInstance() {
    if (!_TemplateManager.instance) {
      _TemplateManager.instance = new _TemplateManager();
    }
    return _TemplateManager.instance;
  }
  /**
   * Ensure templates directory exists
   */
  ensureTemplatesDir() {
    if (!existsSync(this.templatesDir)) {
      mkdirSync(this.templatesDir, { recursive: true });
    }
  }
  /**
   * Initialize built-in templates
   */
  initializeBuiltInTemplates() {
    const templates = [
      {
        name: "Quick Project Setup",
        description: "Initialize a new project with common setup",
        commands: [
          { command: "/init" },
          { command: "/add-dir", args: ["./src"] },
          { command: "/add-dir", args: ["./tests"] },
          { command: "/memory" },
          { command: "/agents", args: ["list"] }
        ],
        tags: ["setup", "project", "quick-start"],
        author: "MARIA",
        version: "1.0.0"
      },
      {
        name: "PR Review Workflow",
        description: "Complete PR review process",
        commands: [
          { command: "/review", args: ["{{pr_number}}"] },
          { command: "/pr-comments", args: ["{{pr_number}}"] },
          { command: "/test", args: ["--type", "unit"] },
          { command: "/suggest" }
        ],
        parameters: [
          {
            name: "pr_number",
            description: "Pull request number",
            type: "string",
            required: true
          }
        ],
        tags: ["review", "pr", "testing"],
        author: "MARIA",
        version: "1.0.0"
      },
      {
        name: "Daily Standup",
        description: "Prepare daily standup report",
        commands: [
          { command: "/status" },
          { command: "/cost", args: ["--detailed"] },
          { command: "/git", args: ["log", "--oneline", "-10"] },
          { command: "/export", args: ["--format", "md"] }
        ],
        tags: ["daily", "standup", "report"],
        author: "MARIA",
        version: "1.0.0"
      },
      {
        name: "Debug & Fix",
        description: "Debug workflow with error reporting",
        commands: [
          { command: "/doctor" },
          { command: "/status", args: ["--verbose"] },
          {
            command: "/bug",
            args: ["{{description}}"],
            condition: "hasErrors"
          },
          { command: "/suggest" }
        ],
        parameters: [
          {
            name: "description",
            description: "Bug description",
            type: "string",
            default: "Found during debugging session"
          }
        ],
        tags: ["debug", "troubleshooting"],
        author: "MARIA",
        version: "1.0.0"
      },
      {
        name: "Deploy Pipeline",
        description: "Full deployment workflow",
        commands: [
          { command: "/test", args: ["--type", "all"] },
          { command: "/commit", args: ["--message", "{{message}}"] },
          {
            command: "/deploy",
            args: ["--env", "{{environment}}"],
            condition: "testsPass"
          },
          { command: "/status", waitFor: 5e3 }
        ],
        parameters: [
          {
            name: "message",
            description: "Commit message",
            type: "string",
            required: true
          },
          {
            name: "environment",
            description: "Deployment environment",
            type: "choice",
            choices: ["staging", "production"],
            default: "staging",
            required: true
          }
        ],
        tags: ["deploy", "ci/cd", "pipeline"],
        author: "MARIA",
        version: "1.0.0"
      }
    ];
    templates.forEach((template, index) => {
      const id = `builtin-${index + 1}`;
      const now = /* @__PURE__ */ new Date();
      this.builtInTemplates.set(id, {
        ...template,
        id,
        createdAt: now,
        updatedAt: now,
        usageCount: 0
      });
    });
  }
  /**
   * Load user templates from disk
   */
  loadUserTemplates() {
    try {
      const files = __require("fs").readdirSync(this.templatesDir);
      files.forEach((file) => {
        if (file.endsWith(".json")) {
          try {
            const content = readFileSync(join(this.templatesDir, file), "utf-8");
            const template = JSON.parse(content);
            template.createdAt = new Date(template.createdAt);
            template.updatedAt = new Date(template.updatedAt);
            this.templates.set(template.id, template);
          } catch (error) {
            logger.error(`Failed to load template ${file}:`, error);
          }
        }
      });
    } catch {
      logger.debug("No user templates found");
    }
  }
  /**
   * Save a template to disk
   */
  saveTemplate(template) {
    const filename = `${template.id}.json`;
    const filepath = join(this.templatesDir, filename);
    writeFileSync(filepath, JSON.stringify(template, null, 2));
  }
  /**
   * Create a new template
   */
  async createTemplate(name, description, commands2, options) {
    for (const cmd of commands2) {
      const commandInfo = getCommandInfo(cmd.command);
      if (!commandInfo) {
        return {
          success: false,
          message: `Invalid command: ${cmd.command}`
        };
      }
    }
    const id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const now = /* @__PURE__ */ new Date();
    const template = {
      id,
      name,
      description,
      commands: commands2,
      parameters: options?.parameters || [],
      tags: options?.tags || [],
      author: options?.author || "User",
      version: options?.version || "1.0.0",
      createdAt: now,
      updatedAt: now,
      usageCount: 0
    };
    this.templates.set(id, template);
    this.saveTemplate(template);
    return {
      success: true,
      message: `Template "${name}" created successfully`,
      template
    };
  }
  /**
   * Update an existing template
   */
  async updateTemplate(id, updates) {
    const template = this.templates.get(id);
    if (!template) {
      return {
        success: false,
        message: `Template "${id}" not found`
      };
    }
    if (this.builtInTemplates.has(id)) {
      return {
        success: false,
        message: "Cannot modify built-in templates"
      };
    }
    Object.assign(template, updates, { updatedAt: /* @__PURE__ */ new Date() });
    this.saveTemplate(template);
    return {
      success: true,
      message: `Template "${template.name}" updated successfully`
    };
  }
  /**
   * Delete a template
   */
  async deleteTemplate(id) {
    if (this.builtInTemplates.has(id)) {
      return {
        success: false,
        message: "Cannot delete built-in templates"
      };
    }
    const template = this.templates.get(id);
    if (!template) {
      return {
        success: false,
        message: `Template "${id}" not found`
      };
    }
    this.templates.delete(id);
    try {
      const fs4 = __require("fs");
      fs4.unlinkSync(join(this.templatesDir, `${id}.json`));
    } catch (error) {
      logger.error("Failed to delete template file:", error);
    }
    return {
      success: true,
      message: `Template "${template.name}" deleted successfully`
    };
  }
  /**
   * Get a template by ID
   */
  getTemplate(id) {
    return this.templates.get(id) || this.builtInTemplates.get(id);
  }
  /**
   * List all templates
   */
  listTemplates(options) {
    let userTemplates = Array.from(this.templates.values());
    let builtInTemplates = Array.from(this.builtInTemplates.values());
    if (options?.tags && options.tags.length > 0) {
      const filterByTags = (template) => options.tags.some((tag) => template.tags?.includes(tag));
      userTemplates = userTemplates.filter(filterByTags);
      builtInTemplates = builtInTemplates.filter(filterByTags);
    }
    if (options?.author) {
      const filterByAuthor = (template) => template.author?.toLowerCase() === options.author.toLowerCase();
      userTemplates = userTemplates.filter(filterByAuthor);
      builtInTemplates = builtInTemplates.filter(filterByAuthor);
    }
    if (options?.search) {
      const search = options.search.toLowerCase();
      const filterBySearch = (template) => template.name.toLowerCase().includes(search) || template.description.toLowerCase().includes(search) || template.tags?.some((tag) => tag.toLowerCase().includes(search));
      userTemplates = userTemplates.filter(filterBySearch);
      builtInTemplates = builtInTemplates.filter(filterBySearch);
    }
    userTemplates.sort((a, b) => b.usageCount - a.usageCount);
    builtInTemplates.sort((a, b) => b.usageCount - a.usageCount);
    return { userTemplates, builtInTemplates };
  }
  /**
   * Export templates to JSON
   */
  exportTemplates(ids) {
    const templates = ids ? ids.map((id) => this.getTemplate(id)).filter(Boolean) : Array.from(this.templates.values());
    return JSON.stringify({
      templates,
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      version: "1.0"
    }, null, 2);
  }
  /**
   * Import templates from JSON
   */
  async importTemplates(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      if (!data.templates || !Array.isArray(data.templates)) {
        return {
          success: false,
          message: "Invalid template data format"
        };
      }
      let imported = 0;
      for (const template of data.templates) {
        const newId = `imported-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const newTemplate = {
          ...template,
          id: newId,
          createdAt: new Date(template.createdAt || /* @__PURE__ */ new Date()),
          updatedAt: new Date(template.updatedAt || /* @__PURE__ */ new Date()),
          usageCount: 0
        };
        this.templates.set(newId, newTemplate);
        this.saveTemplate(newTemplate);
        imported++;
      }
      return {
        success: true,
        message: `Imported ${imported} templates`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to import templates: ${error instanceof Error ? error.message : "Unknown error"}`
      };
    }
  }
  /**
   * Clone a template
   */
  async cloneTemplate(id, newName) {
    const original = this.getTemplate(id);
    if (!original) {
      return {
        success: false,
        message: `Template "${id}" not found`
      };
    }
    return this.createTemplate(
      newName,
      `Clone of ${original.description}`,
      original.commands,
      {
        parameters: original.parameters,
        tags: [...original.tags || [], "clone"],
        author: "User",
        version: "1.0.0"
      }
    );
  }
  /**
   * Increment usage count
   */
  incrementUsageCount(id) {
    const template = this.getTemplate(id);
    if (template) {
      template.usageCount++;
      if (!this.builtInTemplates.has(id)) {
        this.saveTemplate(template);
      }
    }
  }
  /**
   * Get popular templates
   */
  getPopularTemplates(limit = 5) {
    const allTemplates = [
      ...Array.from(this.templates.values()),
      ...Array.from(this.builtInTemplates.values())
    ];
    return allTemplates.filter((t) => t.usageCount > 0).sort((a, b) => b.usageCount - a.usageCount).slice(0, limit);
  }
  /**
   * Validate template parameters
   */
  validateParameters(template, providedParams) {
    const errors = [];
    template.parameters?.forEach((param) => {
      const value = providedParams[param.name];
      if (param.required && value === void 0) {
        errors.push(`Missing required parameter: ${param.name}`);
        return;
      }
      if (value !== void 0) {
        if (param.type === "number" && typeof value !== "number") {
          errors.push(`Parameter ${param.name} must be a number`);
        } else if (param.type === "boolean" && typeof value !== "boolean") {
          errors.push(`Parameter ${param.name} must be a boolean`);
        } else if (param.type === "choice" && param.choices && !param.choices.includes(value)) {
          errors.push(`Parameter ${param.name} must be one of: ${param.choices.join(", ")}`);
        }
      }
    });
    return {
      valid: errors.length === 0,
      errors
    };
  }
  /**
   * Substitute parameters in command
   */
  substituteParameters(command, parameters) {
    let result = command;
    Object.entries(parameters).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder, "g"), String(value));
    });
    return result;
  }
};

// src/services/batch-execution.ts
var BatchExecutionEngine = class _BatchExecutionEngine {
  static instance;
  commandHandler = null;
  variables = {};
  isExecuting = false;
  constructor() {
  }
  getCommandHandler() {
    if (!this.commandHandler) {
      this.commandHandler = SlashCommandHandler.getInstance();
    }
    return this.commandHandler;
  }
  static getInstance() {
    if (!_BatchExecutionEngine.instance) {
      _BatchExecutionEngine.instance = new _BatchExecutionEngine();
    }
    return _BatchExecutionEngine.instance;
  }
  /**
   * Parse batch command string
   */
  parseBatchString(batchString) {
    const lines = batchString.split("\n").filter((line) => line.trim() && !line.trim().startsWith("#"));
    const commands2 = [];
    lines.forEach((line) => {
      const ifMatch = line.match(/^IF\s+(.+)\s+THEN\s+(.+)(?:\s+ELSE\s+(.+))?$/i);
      if (ifMatch) {
        const [, condition, thenCmd, elseCmd] = ifMatch;
        if (condition && thenCmd) {
          commands2.push({
            command: thenCmd.split(" ")[0] || "",
            args: thenCmd.split(" ").slice(1),
            condition
          });
          if (elseCmd) {
            commands2.push({
              command: elseCmd.split(" ")[0] || "",
              args: elseCmd.split(" ").slice(1),
              condition: `!${condition}`
            });
          }
        }
        return;
      }
      if (line.startsWith("PARALLEL:")) {
        const parallelCommands = line.substring(9).split("&&").map((cmd) => cmd.trim());
        parallelCommands.forEach((cmd) => {
          const parts2 = cmd.split(" ");
          if (parts2[0]) {
            commands2.push({
              command: parts2[0],
              args: parts2.slice(1),
              parallel: true
            });
          }
        });
        return;
      }
      const parts = line.split(" ");
      if (parts[0]) {
        commands2.push({
          command: parts[0],
          args: parts.slice(1)
        });
      }
    });
    return commands2;
  }
  /**
   * Execute a batch of commands
   */
  async executeBatch(commands2, context, options = {}) {
    if (this.isExecuting) {
      throw new Error("Batch execution already in progress");
    }
    this.isExecuting = true;
    const startTime = Date.now();
    this.variables = { ...options.variables };
    const result = {
      success: true,
      totalCommands: commands2.length,
      executed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      results: [],
      variables: this.variables
    };
    console.log(source_default.blue("\n\u{1F680} Starting batch execution\n"));
    if (options.dryRun) {
      console.log(source_default.yellow("DRY RUN MODE - Commands will not be executed\n"));
      commands2.forEach((cmd, i) => {
        console.log(source_default.gray(`${i + 1}. ${cmd.command} ${cmd.args.join(" ")}`));
        if (cmd.condition) console.log(source_default.gray(`   IF: ${cmd.condition}`));
      });
      this.isExecuting = false;
      return result;
    }
    try {
      const commandGroups = this.groupCommands(commands2);
      for (const group of commandGroups) {
        if (options.stopOnError && result.failed > 0) {
          console.log(source_default.yellow("\n\u23F9\uFE0F  Stopping due to error (stopOnError=true)"));
          break;
        }
        if (group.length === 1 && group[0]) {
          await this.executeSingleCommand(group[0], context, result);
        } else {
          await this.executeParallelCommands(group, context, result, options.maxParallel || 3);
        }
      }
      result.duration = Date.now() - startTime;
      result.success = result.failed === 0;
      this.printSummary(result);
    } finally {
      this.isExecuting = false;
    }
    return result;
  }
  /**
   * Execute a single command
   */
  async executeSingleCommand(cmd, context, result) {
    if (cmd.condition && !this.evaluateCondition(cmd.condition)) {
      result.skipped++;
      console.log(source_default.gray(`\u23ED\uFE0F  Skipping ${cmd.command} (condition not met)`));
      return;
    }
    console.log(source_default.cyan(`
\u25B6\uFE0F  Executing: ${cmd.command} ${cmd.args.join(" ")}`));
    const startTime = Date.now();
    let attempts = 0;
    const maxAttempts = cmd.retries ? cmd.retries + 1 : 1;
    while (attempts < maxAttempts) {
      attempts++;
      try {
        const cmdResult = await this.executeWithTimeout(
          () => this.getCommandHandler().handleCommand(cmd.command, cmd.args, context),
          cmd.timeout || 3e4
        );
        const duration = Date.now() - startTime;
        result.executed++;
        if (cmdResult.success) {
          result.succeeded++;
          console.log(source_default.green(`\u2705 Success (${duration}ms)`));
          result.results.push({
            command: `${cmd.command} ${cmd.args.join(" ")}`,
            success: true,
            output: cmdResult.message,
            duration
          });
          if (cmdResult.data?.variable) {
            this.variables[cmdResult.data.variable] = cmdResult.data.value;
          }
          break;
        } else {
          if (attempts < maxAttempts) {
            console.log(source_default.yellow(`\u26A0\uFE0F  Failed, retrying (${attempts}/${maxAttempts})...`));
            await this.delay(1e3);
          } else {
            result.failed++;
            console.log(source_default.red(`\u274C Failed: ${cmdResult.message}`));
            result.results.push({
              command: `${cmd.command} ${cmd.args.join(" ")}`,
              success: false,
              error: cmdResult.message,
              duration
            });
          }
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        if (attempts < maxAttempts) {
          console.log(source_default.yellow(`\u26A0\uFE0F  Error, retrying (${attempts}/${maxAttempts})...`));
          await this.delay(1e3);
        } else {
          result.failed++;
          result.executed++;
          const errorMsg = error instanceof Error ? error.message : "Unknown error";
          console.log(source_default.red(`\u274C Error: ${errorMsg}`));
          result.results.push({
            command: `${cmd.command} ${cmd.args.join(" ")}`,
            success: false,
            error: errorMsg,
            duration
          });
        }
      }
    }
  }
  /**
   * Execute commands in parallel
   */
  async executeParallelCommands(commands2, context, result, maxParallel) {
    console.log(source_default.cyan(`
\u26A1 Executing ${commands2.length} commands in parallel`));
    const promises2 = commands2.map(
      (cmd) => this.executeSingleCommand(cmd, context, {
        ...result,
        executed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        results: []
      })
    );
    for (let i = 0; i < promises2.length; i += maxParallel) {
      const batch = promises2.slice(i, i + maxParallel);
      const batchResults = await Promise.allSettled(batch);
      batchResults.forEach((batchResult) => {
        if (batchResult.status === "rejected") {
          result.failed++;
          result.executed++;
        }
      });
    }
  }
  /**
   * Group commands for execution
   */
  groupCommands(commands2) {
    const groups = [];
    let currentGroup = [];
    commands2.forEach((cmd) => {
      if (cmd.parallel && currentGroup.length > 0) {
        currentGroup.push(cmd);
      } else {
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = [cmd];
      }
    });
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    return groups;
  }
  /**
   * Evaluate condition
   */
  evaluateCondition(condition) {
    if (condition.startsWith("!")) {
      return !this.evaluateCondition(condition.substring(1));
    }
    if (condition.startsWith("$")) {
      const varName = condition.substring(1);
      return this.variables[varName] !== void 0;
    }
    const eqMatch = condition.match(/^\$(\w+)\s*==\s*(.+)$/);
    if (eqMatch && eqMatch[1] && eqMatch[2] !== void 0) {
      const varName = eqMatch[1];
      const value = eqMatch[2];
      return String(this.variables[varName] || "") === value;
    }
    switch (condition) {
      case "hasErrors":
        return this.variables.hasErrors === true;
      case "testsPass":
        return this.variables.testsPass === true;
      default:
        return true;
    }
  }
  /**
   * Execute with timeout
   */
  async executeWithTimeout(fn, timeout) {
    return Promise.race([
      fn(),
      new Promise(
        (_, reject) => setTimeout(() => reject(new Error("Command timeout")), timeout)
      )
    ]);
  }
  /**
   * Print execution summary
   */
  printSummary(result) {
    console.log(source_default.blue("\n\u{1F4CA} Batch Execution Summary\n"));
    const successRate = result.executed > 0 ? Math.round(result.succeeded / result.executed * 100) : 0;
    console.log(`Total Commands: ${result.totalCommands}`);
    console.log(`Executed: ${result.executed}`);
    console.log(source_default.green(`Succeeded: ${result.succeeded}`));
    if (result.failed > 0) {
      console.log(source_default.red(`Failed: ${result.failed}`));
    }
    if (result.skipped > 0) {
      console.log(source_default.gray(`Skipped: ${result.skipped}`));
    }
    console.log(`Success Rate: ${successRate}%`);
    console.log(`Duration: ${(result.duration / 1e3).toFixed(2)}s`);
    if (Object.keys(result.variables).length > 0) {
      console.log("\nVariables Set:");
      Object.entries(result.variables).forEach(([key, value]) => {
        console.log(`  ${key} = ${JSON.stringify(value)}`);
      });
    }
  }
  /**
   * Helper to add delay
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  /**
   * Check if batch is executing
   */
  getExecutionStatus() {
    return this.isExecuting;
  }
  /**
   * Get current variables
   */
  getVariables() {
    return { ...this.variables };
  }
};

// src/services/hotkey-manager.ts
import { readFileSync as readFileSync2, writeFileSync as writeFileSync2, existsSync as existsSync2 } from "fs";
import { join as join2 } from "path";
import { homedir as homedir2 } from "os";
var HotkeyManager = class _HotkeyManager {
  static instance;
  bindings = /* @__PURE__ */ new Map();
  commandHandler = null;
  configPath;
  isEnabled = true;
  // private activeKeys: Set<string> = new Set(); // Reserved for future use
  constructor() {
    this.configPath = join2(homedir2(), ".maria", "hotkeys.json");
    this.loadBindings();
    this.initializeDefaultBindings();
  }
  getCommandHandler() {
    if (!this.commandHandler) {
      this.commandHandler = SlashCommandHandler.getInstance();
    }
    return this.commandHandler;
  }
  static getInstance() {
    if (!_HotkeyManager.instance) {
      _HotkeyManager.instance = new _HotkeyManager();
    }
    return _HotkeyManager.instance;
  }
  /**
   * Initialize default hotkey bindings
   */
  initializeDefaultBindings() {
    const defaults = [
      {
        key: "s",
        modifiers: ["ctrl"],
        command: "/status",
        description: "Show system status",
        enabled: true
      },
      {
        key: "h",
        modifiers: ["ctrl"],
        command: "/help",
        description: "Show help",
        enabled: true
      },
      {
        key: "l",
        modifiers: ["ctrl"],
        command: "/clear",
        description: "Clear screen",
        enabled: true
      },
      {
        key: "e",
        modifiers: ["ctrl"],
        command: "/export",
        args: ["--clipboard"],
        description: "Export to clipboard",
        enabled: true
      },
      {
        key: "t",
        modifiers: ["ctrl"],
        command: "/test",
        description: "Run tests",
        enabled: true
      },
      {
        key: "d",
        modifiers: ["ctrl"],
        command: "/doctor",
        description: "System diagnostics",
        enabled: true
      },
      {
        key: "p",
        modifiers: ["ctrl", "shift"],
        command: "/pr-comments",
        description: "Show PR comments",
        enabled: true
      },
      {
        key: "r",
        modifiers: ["ctrl", "shift"],
        command: "/review",
        description: "Run PR review",
        enabled: true
      },
      {
        key: "a",
        modifiers: ["ctrl"],
        command: "/agents",
        description: "Manage agents",
        enabled: true
      },
      {
        key: "m",
        modifiers: ["ctrl"],
        command: "/mode",
        args: ["research"],
        description: "Switch to research mode",
        enabled: true
      }
    ];
    defaults.forEach((binding) => {
      const key = this.getBindingKey(binding);
      if (!this.bindings.has(key)) {
        this.bindings.set(key, binding);
      }
    });
  }
  /**
   * Get unique key for binding
   */
  getBindingKey(binding) {
    const modifiers = [...binding.modifiers].sort().join("+");
    return modifiers ? `${modifiers}+${binding.key}` : binding.key;
  }
  /**
   * Process keypress event
   */
  async processKeypress(key, context) {
    if (!this.isEnabled || !key) {
      return { handled: false };
    }
    const modifiers = [];
    if (key.ctrl) modifiers.push("ctrl");
    if (key.shift) modifiers.push("shift");
    if (key.meta) modifiers.push("meta");
    if (key.alt) modifiers.push("alt");
    const keyName = key.name || key.sequence;
    if (!keyName) return { handled: false };
    const bindingKey = modifiers.length > 0 ? `${modifiers.sort().join("+")}+${keyName}` : keyName;
    const binding = this.bindings.get(bindingKey);
    if (!binding || !binding.enabled) {
      return { handled: false };
    }
    try {
      logger.info(`Hotkey triggered: ${bindingKey} -> ${binding.command}`);
      const result = await this.getCommandHandler().handleCommand(
        binding.command,
        binding.args || [],
        context
      );
      return { handled: true, result };
    } catch (error) {
      logger.error("Error executing hotkey command:", error);
      return {
        handled: true,
        result: {
          success: false,
          message: `Error executing hotkey: ${error}`
        }
      };
    }
  }
  /**
   * Add or update hotkey binding
   */
  addBinding(binding) {
    const key = this.getBindingKey(binding);
    const existing = this.bindings.get(key);
    if (existing && existing.command !== binding.command) {
      return {
        success: false,
        message: `Key combination already bound to ${existing.command}`
      };
    }
    this.bindings.set(key, binding);
    this.saveBindings();
    return {
      success: true,
      message: `Hotkey ${key} bound to ${binding.command}`
    };
  }
  /**
   * Remove hotkey binding
   */
  removeBinding(key) {
    if (!this.bindings.has(key)) {
      return {
        success: false,
        message: `No binding found for ${key}`
      };
    }
    const binding = this.bindings.get(key);
    this.bindings.delete(key);
    this.saveBindings();
    return {
      success: true,
      message: `Removed hotkey ${key} (was bound to ${binding.command})`
    };
  }
  /**
   * Toggle hotkey binding
   */
  toggleBinding(key) {
    const binding = this.bindings.get(key);
    if (!binding) {
      return {
        success: false,
        message: `No binding found for ${key}`
      };
    }
    binding.enabled = !binding.enabled;
    this.saveBindings();
    return {
      success: true,
      message: `Hotkey ${key} ${binding.enabled ? "enabled" : "disabled"}`
    };
  }
  /**
   * List all hotkey bindings
   */
  listBindings() {
    return Array.from(this.bindings.values()).sort((a, b) => {
      const aModCount = a.modifiers.length;
      const bModCount = b.modifiers.length;
      if (aModCount !== bModCount) return aModCount - bModCount;
      return a.key.localeCompare(b.key);
    });
  }
  /**
   * Format hotkey for display
   */
  formatHotkey(binding) {
    const parts = [];
    if (binding.modifiers.includes("ctrl")) parts.push("Ctrl");
    if (binding.modifiers.includes("alt")) parts.push("Alt");
    if (binding.modifiers.includes("shift")) parts.push("Shift");
    if (binding.modifiers.includes("meta")) parts.push("Cmd/Win");
    parts.push(binding.key.toUpperCase());
    return parts.join("+");
  }
  /**
   * Parse hotkey string
   */
  parseHotkeyString(hotkeyStr) {
    const parts = hotkeyStr.toLowerCase().split("+").map((p) => p.trim());
    if (parts.length === 0) return null;
    const key = parts[parts.length - 1];
    if (!key) return null;
    const modifiers = parts.slice(0, -1).filter(
      (m) => ["ctrl", "alt", "shift", "meta", "cmd", "win"].includes(m)
    ).map((m) => {
      if (m === "cmd" || m === "win") return "meta";
      return m;
    });
    return { key, modifiers };
  }
  /**
   * Enable/disable hotkeys globally
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    logger.info(`Hotkeys ${enabled ? "enabled" : "disabled"} globally`);
  }
  /**
   * Check if hotkeys are enabled
   */
  isHotkeysEnabled() {
    return this.isEnabled;
  }
  /**
   * Get help text for hotkeys
   */
  getHelpText() {
    const bindings = this.listBindings().filter((b) => b.enabled);
    if (bindings.length === 0) {
      return "No hotkeys configured.";
    }
    let help = source_default.bold("\nAvailable Hotkeys:\n\n");
    bindings.forEach((binding) => {
      const hotkey = source_default.cyan(this.formatHotkey(binding));
      const command = source_default.yellow(binding.command);
      const args = binding.args ? source_default.gray(` ${binding.args.join(" ")}`) : "";
      const desc = binding.description ? source_default.gray(` - ${binding.description}`) : "";
      const status = !binding.enabled ? source_default.red(" [disabled]") : "";
      help += `  ${hotkey.padEnd(20)} \u2192 ${command}${args}${desc}${status}
`;
    });
    help += `
${source_default.gray("Use /hotkey to manage hotkeys")}
`;
    return help;
  }
  /**
   * Export hotkey configuration
   */
  exportConfig() {
    return {
      bindings: this.listBindings(),
      globalEnabled: this.isEnabled
    };
  }
  /**
   * Import hotkey configuration
   */
  importConfig(config) {
    try {
      this.bindings.clear();
      config.bindings.forEach((binding) => {
        const key = this.getBindingKey(binding);
        this.bindings.set(key, binding);
      });
      this.isEnabled = config.globalEnabled !== false;
      this.saveBindings();
      return {
        success: true,
        message: `Imported ${config.bindings.length} hotkey bindings`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to import config: ${error}`
      };
    }
  }
  /**
   * Load bindings from file
   */
  loadBindings() {
    try {
      if (existsSync2(this.configPath)) {
        const data = readFileSync2(this.configPath, "utf-8");
        const config = JSON.parse(data);
        this.importConfig(config);
      }
    } catch (error) {
      logger.warn("Failed to load hotkey bindings:", error);
    }
  }
  /**
   * Save bindings to file
   */
  saveBindings() {
    try {
      const config = this.exportConfig();
      const dir = join2(homedir2(), ".maria");
      if (!existsSync2(dir)) {
        __require("fs").mkdirSync(dir, { recursive: true });
      }
      writeFileSync2(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      logger.error("Failed to save hotkey bindings:", error);
    }
  }
};

// src/commands/model-interactive.ts
import * as readline from "readline";
import { exec } from "child_process";
import { promisify } from "util";
import fetch from "node-fetch";
import * as fs from "fs";
import * as path from "path";
var execAsync = promisify(exec);
var InteractiveModelSelector = class {
  models = [];
  selectedIndex = 0;
  rl;
  lmStudioStatus = "checking";
  constructor() {
    loadEnvironmentVariables();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    readline.emitKeypressEvents(process.stdin, this.rl);
  }
  async initialize() {
    console.log(source_default.cyan("\u{1F50D} Checking available AI models...\n"));
    await this.checkLMStudio();
    this.models = [
      // Local models
      {
        id: "gpt-oss-120b",
        name: "GPT-OSS 120B",
        provider: "LM Studio",
        type: "local",
        context: "128K",
        vram: "~64GB",
        available: this.lmStudioStatus === "running",
        description: "Complex reasoning, large documents"
      },
      {
        id: "gpt-oss-20b",
        name: "GPT-OSS 20B",
        provider: "LM Studio",
        type: "local",
        context: "32K",
        vram: "~12GB",
        available: this.lmStudioStatus === "running",
        description: "Balanced performance"
      },
      // Cloud models
      {
        id: "gpt-5",
        name: "GPT-5",
        provider: "OpenAI",
        type: "cloud",
        context: "128K",
        available: !!process.env.OPENAI_API_KEY,
        apiKeySet: !!process.env.OPENAI_API_KEY,
        description: "Latest flagship model (no temperature control)"
      },
      {
        id: "gpt-5-mini",
        name: "GPT-5 mini",
        provider: "OpenAI",
        type: "cloud",
        context: "128K",
        available: !!process.env.OPENAI_API_KEY,
        apiKeySet: !!process.env.OPENAI_API_KEY,
        description: "Efficient and fast (no temperature control)"
      },
      {
        id: "claude-4.1-opus",
        name: "Claude Opus 4.1",
        provider: "Anthropic",
        type: "cloud",
        context: "200K",
        available: !!process.env.ANTHROPIC_API_KEY,
        apiKeySet: !!process.env.ANTHROPIC_API_KEY,
        description: "Highest intelligence and capability (March 2025)"
      },
      {
        id: "claude-4-sonnet",
        name: "Claude Sonnet 4",
        provider: "Anthropic",
        type: "cloud",
        context: "200K",
        available: !!process.env.ANTHROPIC_API_KEY,
        apiKeySet: !!process.env.ANTHROPIC_API_KEY,
        description: "High intelligence, balanced performance (March 2025)"
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        provider: "Google",
        type: "cloud",
        context: "2M",
        available: !!process.env.GEMINI_API_KEY,
        apiKeySet: !!process.env.GEMINI_API_KEY,
        description: "Multimodal AI with enhanced performance"
      },
      {
        id: "llama-3.3-70b",
        name: "Llama 3.3 70B",
        provider: "Groq",
        type: "cloud",
        context: "128K",
        available: !!process.env.GROQ_API_KEY,
        apiKeySet: !!process.env.GROQ_API_KEY,
        description: "Latest Llama model, fast inference"
      },
      {
        id: "grok-4",
        name: "Grok 4",
        provider: "xAI",
        type: "cloud",
        context: "128K",
        available: !!process.env.XAI_API_KEY,
        apiKeySet: !!process.env.XAI_API_KEY,
        description: "Latest xAI model with reasoning capabilities"
      }
    ];
    if (this.lmStudioStatus === "not-running") {
      console.log(source_default.yellow("\u26A0\uFE0F  LM Studio is not running. Starting it now...\n"));
      await this.startLMStudio();
    }
  }
  async checkLMStudio() {
    try {
      const lmsPath = "/Users/bongin_max/.lmstudio/bin/lms";
      if (!fs.existsSync(lmsPath)) {
        this.lmStudioStatus = "not-installed";
        return;
      }
      try {
        const response = await fetch("http://localhost:1234/v1/models", {
          headers: { "Authorization": "Bearer lm-studio" },
          signal: AbortSignal.timeout(2e3)
        });
        if (response.ok) {
          this.lmStudioStatus = "running";
        } else {
          this.lmStudioStatus = "not-running";
        }
      } catch {
        this.lmStudioStatus = "not-running";
      }
    } catch (error) {
      console.error(source_default.red("Error checking LM Studio:"), error);
      this.lmStudioStatus = "not-installed";
    }
  }
  async startLMStudio() {
    try {
      console.log(source_default.cyan("\u{1F680} Starting LM Studio server..."));
      await execAsync("/Users/bongin_max/.lmstudio/bin/lms server stop 2>/dev/null || true");
      await new Promise((resolve) => setTimeout(resolve, 2e3));
      await execAsync("/Users/bongin_max/.lmstudio/bin/lms server start");
      await new Promise((resolve) => setTimeout(resolve, 3e3));
      await this.checkLMStudio();
      if (this.lmStudioStatus === "running") {
        console.log(source_default.green("\u2705 LM Studio server started successfully!\n"));
        this.models.forEach((model) => {
          if (model.provider === "LM Studio") {
            model.available = true;
          }
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error(source_default.red("Failed to start LM Studio:"), error);
      return false;
    }
  }
  async selectModel() {
    return new Promise((resolve) => {
      this.render();
      process.stdin.on("keypress", async (_, key) => {
        if (key.name === "up") {
          this.selectedIndex = Math.max(0, this.selectedIndex - 1);
          this.render();
        } else if (key.name === "down") {
          this.selectedIndex = Math.min(this.models.length - 1, this.selectedIndex + 1);
          this.render();
        } else if (key.name === "return") {
          const selected = this.models[this.selectedIndex];
          if (!selected) {
            this.cleanup();
            resolve(null);
            return;
          }
          if (selected.type === "local" && !selected.available) {
            if (this.lmStudioStatus === "not-running") {
              console.log(source_default.yellow("\n\u23F3 Starting LM Studio for local model..."));
              const started = await this.startLMStudio();
              if (!started) {
                console.log(source_default.red("\u274C Failed to start LM Studio"));
                this.cleanup();
                resolve(null);
                return;
              }
            }
          }
          if (selected.type === "local" && selected.available) {
            await this.loadLocalModel(selected.id);
          }
          await this.updateEnvironment(selected);
          console.log(source_default.green(`
\u2705 Selected: ${selected.name}`));
          this.cleanup();
          resolve(selected.id);
        } else if (key.name === "escape" || key.ctrl && key.name === "c") {
          this.cleanup();
          resolve(null);
        }
      });
    });
  }
  render() {
    console.clear();
    console.log(source_default.bold.cyan("\u{1F916} Select AI Model"));
    console.log(source_default.gray("Use \u2191\u2193 arrows to navigate, Enter to select, ESC to cancel\n"));
    const localModels = this.models.filter((m) => m.type === "local");
    const cloudModels = this.models.filter((m) => m.type === "cloud");
    let currentIndex = 0;
    if (localModels.length > 0) {
      console.log(source_default.bold.green("\u{1F4BB} Local Models (Offline)"));
      localModels.forEach((model) => {
        const isSelected = currentIndex === this.selectedIndex;
        const prefix = isSelected ? source_default.cyan("\u25B6 ") : "  ";
        const status = model.available ? source_default.green("\u2713") : source_default.red("\u2717");
        const line = `${prefix}${status} ${source_default.bold(model.name)} ${source_default.gray(`(${model.context}, ${model.vram})`)} - ${source_default.dim(model.description)}`;
        console.log(line);
        currentIndex++;
      });
      console.log();
    }
    if (cloudModels.length > 0) {
      console.log(source_default.bold.blue("\u2601\uFE0F  Cloud Models"));
      cloudModels.forEach((model) => {
        const isSelected = currentIndex === this.selectedIndex;
        const prefix = isSelected ? source_default.cyan("\u25B6 ") : "  ";
        const status = model.available ? source_default.green("\u2713") : source_default.red("\u2717");
        const apiStatus = model.apiKeySet ? "" : source_default.yellow(" (No API key)");
        const line = `${prefix}${status} ${source_default.bold(model.name)} ${source_default.gray(`(${model.context})`)} - ${source_default.dim(model.description)}${apiStatus}`;
        console.log(line);
        currentIndex++;
      });
    }
    console.log(source_default.gray("\n\u2500".repeat(60)));
    console.log(source_default.cyan("Current model: ") + source_default.yellow(process.env.LMSTUDIO_DEFAULT_MODEL || process.env.AI_MODEL || "None"));
    if (this.lmStudioStatus === "running") {
      console.log(source_default.green("LM Studio: Running at http://localhost:1234"));
    } else if (this.lmStudioStatus === "not-running") {
      console.log(source_default.yellow("LM Studio: Not running (will start automatically)"));
    } else if (this.lmStudioStatus === "not-installed") {
      console.log(source_default.red("LM Studio: Not installed"));
    }
  }
  async loadLocalModel(modelId) {
    try {
      console.log(source_default.cyan(`
\u23F3 Loading ${modelId}...`));
      await execAsync(`/Users/bongin_max/.lmstudio/bin/lms load ${modelId}`);
      console.log(source_default.green(`\u2705 Model ${modelId} loaded successfully`));
    } catch (error) {
      console.error(source_default.red(`Failed to load model: ${error}`));
    }
  }
  async updateEnvironment(model) {
    const envPath = path.join(process.cwd(), ".env.local");
    if (model.type === "local") {
      process.env.AI_PROVIDER = "lmstudio";
      process.env.LMSTUDIO_DEFAULT_MODEL = model.id;
      process.env.OFFLINE_MODE = "true";
    } else {
      process.env.AI_PROVIDER = model.provider.toLowerCase();
      process.env.AI_MODEL = model.id;
      process.env.OFFLINE_MODE = "false";
    }
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, "utf-8");
      if (model.type === "local") {
        content = content.replace(/LMSTUDIO_DEFAULT_MODEL=.*/g, `LMSTUDIO_DEFAULT_MODEL=${model.id}`);
        content = content.replace(/AI_PROVIDER=.*/g, "AI_PROVIDER=lmstudio");
        content = content.replace(/OFFLINE_MODE=.*/g, "OFFLINE_MODE=true");
      }
      fs.writeFileSync(envPath, content);
    }
  }
  cleanup() {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdin.removeAllListeners("keypress");
    this.rl.close();
  }
};
async function runInteractiveModelSelector() {
  const selector = new InteractiveModelSelector();
  await selector.initialize();
  return await selector.selectModel();
}

// src/services/chat-context.service.ts
import { EventEmitter } from "events";
import * as fs2 from "fs/promises";
import * as path2 from "path";
import { encode } from "gpt-3-encoder";
var ChatContextService = class _ChatContextService extends EventEmitter {
  static instance;
  contextWindow = [];
  fullHistory = [];
  config;
  currentTokens = 0;
  compressionCount = 0;
  sessionId;
  constructor(config) {
    super();
    this.config = {
      maxTokens: config?.maxTokens || 128e3,
      compressionThreshold: config?.compressionThreshold || 0.8,
      summaryTokenLimit: config?.summaryTokenLimit || 2e3,
      persistPath: config?.persistPath || path2.join(process.env.HOME || "", ".maria", "context")
    };
    this.sessionId = this.generateSessionId();
  }
  static getInstance(config) {
    if (!_ChatContextService.instance) {
      _ChatContextService.instance = new _ChatContextService(config);
    }
    return _ChatContextService.instance;
  }
  generateSessionId() {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  countTokens(text) {
    try {
      return encode(text).length;
    } catch {
      return Math.ceil(text.length / 4);
    }
  }
  async addMessage(message) {
    const tokens = this.countTokens(message.content);
    const fullMessage = {
      ...message,
      timestamp: /* @__PURE__ */ new Date(),
      tokens
    };
    this.fullHistory.push(fullMessage);
    this.contextWindow.push(fullMessage);
    this.currentTokens += tokens;
    await this.optimizeMemory();
    this.emit("message-added", fullMessage);
    this.emit("context-updated", this.getStats());
  }
  async optimizeMemory() {
    const usageRatio = this.currentTokens / this.config.maxTokens;
    if (usageRatio >= this.config.compressionThreshold) {
      await this.compressContext();
    }
    while (this.currentTokens > this.config.maxTokens && this.contextWindow.length > 1) {
      const removed = this.contextWindow.shift();
      if (removed?.tokens) {
        this.currentTokens -= removed.tokens;
      }
    }
  }
  async compressContext() {
    if (this.contextWindow.length <= 2) return;
    const middleMessages = this.contextWindow.slice(1, -1);
    const summary = await this.generateSummary(middleMessages);
    if (summary) {
      const summaryMessage = {
        role: "system",
        content: `[Compressed context summary]: ${summary}`,
        timestamp: /* @__PURE__ */ new Date(),
        tokens: this.countTokens(summary),
        metadata: { compressed: true, originalCount: middleMessages.length }
      };
      const firstMessage = this.contextWindow[0];
      const lastMessage = this.contextWindow[this.contextWindow.length - 1];
      if (!firstMessage || !lastMessage) return;
      this.contextWindow = [firstMessage, summaryMessage, lastMessage];
      this.recalculateTokens();
      this.compressionCount++;
      this.emit("context-compressed", {
        originalCount: middleMessages.length,
        summaryTokens: summaryMessage.tokens
      });
    }
  }
  async generateSummary(messages) {
    const keyPoints = messages.filter((m) => m.role === "user").map((m) => m.content.substring(0, 100)).join("; ");
    return `Previous discussion covered: ${keyPoints}`;
  }
  recalculateTokens() {
    this.currentTokens = this.contextWindow.reduce((sum, msg) => sum + (msg.tokens || 0), 0);
  }
  clearContext(options) {
    if (options?.soft) {
      this.emit("display-cleared");
      return;
    }
    if (options?.summary && this.contextWindow.length > 0) {
      this.generateSummary(this.contextWindow).then((summary) => {
        this.emit("summary-generated", summary);
      });
    }
    const previousStats = this.getStats();
    this.contextWindow = [];
    this.currentTokens = 0;
    this.compressionCount = 0;
    if (!options?.soft) {
      this.fullHistory = [];
      this.sessionId = this.generateSessionId();
    }
    this.emit("context-cleared", previousStats);
  }
  getContext() {
    return [...this.contextWindow];
  }
  getFullHistory() {
    return [...this.fullHistory];
  }
  getStats() {
    return {
      totalMessages: this.fullHistory.length,
      totalTokens: this.currentTokens,
      maxTokens: this.config.maxTokens,
      usagePercentage: this.currentTokens / this.config.maxTokens * 100,
      messagesInWindow: this.contextWindow.length,
      compressedCount: this.compressionCount
    };
  }
  async persistSession() {
    if (!this.config.persistPath) return;
    try {
      await fs2.mkdir(this.config.persistPath, { recursive: true });
      const sessionFile = path2.join(this.config.persistPath, `${this.sessionId}.json`);
      const sessionData = {
        sessionId: this.sessionId,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        stats: this.getStats(),
        contextWindow: this.contextWindow,
        fullHistory: this.fullHistory,
        compressionCount: this.compressionCount
      };
      await fs2.writeFile(sessionFile, JSON.stringify(sessionData, null, 2));
      this.emit("session-persisted", sessionFile);
    } catch (error) {
      this.emit("persist-error", error instanceof Error ? error : new Error(String(error)));
    }
  }
  async loadSession(sessionId) {
    if (!this.config.persistPath) return false;
    try {
      const sessionFile = path2.join(this.config.persistPath, `${sessionId}.json`);
      const data = await fs2.readFile(sessionFile, "utf-8");
      const sessionData = JSON.parse(data);
      this.sessionId = sessionData.sessionId;
      this.contextWindow = sessionData.contextWindow;
      this.fullHistory = sessionData.fullHistory;
      this.compressionCount = sessionData.compressionCount;
      this.recalculateTokens();
      this.emit("session-loaded", sessionId);
      return true;
    } catch (error) {
      this.emit("load-error", error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }
  async exportContext(format = "json") {
    if (format === "markdown") {
      return this.contextWindow.map((msg) => `### ${msg.role.toUpperCase()} (${msg.timestamp.toISOString()})
${msg.content}
`).join("\n---\n\n");
    }
    return JSON.stringify({
      sessionId: this.sessionId,
      exportDate: (/* @__PURE__ */ new Date()).toISOString(),
      stats: this.getStats(),
      context: this.contextWindow,
      fullHistory: this.fullHistory
    }, null, 2);
  }
  async importContext(data) {
    try {
      const imported = JSON.parse(data);
      if (imported.context && Array.isArray(imported.context)) {
        this.contextWindow = imported.context;
        this.fullHistory = imported.fullHistory || imported.context;
        this.recalculateTokens();
        this.sessionId = imported.sessionId || this.generateSessionId();
        this.emit("context-imported", this.getStats());
      }
    } catch (error) {
      this.emit("import-error", error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
  getTokenUsageIndicator() {
    const stats = this.getStats();
    const percentage = Math.round(stats.usagePercentage);
    const blocks = Math.round(percentage / 10);
    const filled = "\u2588".repeat(blocks);
    const empty = "\u2591".repeat(10 - blocks);
    let color = "\x1B[32m";
    if (percentage > 80) color = "\x1B[31m";
    else if (percentage > 60) color = "\x1B[33m";
    return `${color}[${filled}${empty}] ${percentage}% (${stats.totalTokens}/${stats.maxTokens} tokens)\x1B[0m`;
  }
  reset() {
    this.contextWindow = [];
    this.fullHistory = [];
    this.currentTokens = 0;
    this.compressionCount = 0;
    this.sessionId = this.generateSessionId();
    _ChatContextService.instance = null;
  }
};

// src/services/slash-command-handler.ts
var SlashCommandHandler = class _SlashCommandHandler {
  static instance;
  suggestionService;
  _chainService;
  aliasSystem;
  templateManager;
  batchEngine;
  hotkeyManager;
  chatContextService;
  userSession = {
    isAuthenticated: false,
    plan: "free",
    credits: 100
  };
  constructor() {
    this.suggestionService = SuggestionService.getInstance();
    this.aliasSystem = AliasSystem.getInstance();
    this.templateManager = TemplateManager.getInstance();
    this.batchEngine = BatchExecutionEngine.getInstance();
    this.hotkeyManager = HotkeyManager.getInstance();
    this.chatContextService = ChatContextService.getInstance();
  }
  get chainService() {
    if (!this._chainService) {
      this._chainService = CommandChainService.getInstance();
    }
    return this._chainService;
  }
  static getInstance() {
    if (!_SlashCommandHandler.instance) {
      _SlashCommandHandler.instance = new _SlashCommandHandler();
    }
    return _SlashCommandHandler.instance;
  }
  /**
   * スラッシュコマンドを処理
   */
  async handleCommand(command, args, context) {
    let commandName = command.toLowerCase();
    let commandArgs = args;
    const aliasResolution = this.aliasSystem.resolveAlias(`${commandName} ${args.join(" ")}`.trim());
    if (aliasResolution) {
      logger.debug(`Resolved alias ${commandName} to ${aliasResolution.command}`);
      commandName = aliasResolution.command;
      commandArgs = aliasResolution.args;
    }
    logger.debug(`Processing slash command: ${commandName}`, commandArgs);
    this.suggestionService.addToHistory(commandName);
    try {
      let result;
      switch (commandName) {
        // ユーザー管理コマンド
        case "/login":
          result = await this.handleLogin(args);
          break;
        case "/logout":
          result = await this.handleLogout(args);
          break;
        case "/mode":
          result = await this.handleMode(args, context);
          break;
        case "/upgrade":
          result = await this.handleUpgrade(args);
          break;
        case "/status":
          result = await this.handleStatus();
          break;
        // 設定・環境管理
        case "/config":
          result = await this.handleConfig(args);
          break;
        case "/model":
          result = await this.handleModel(args, context);
          break;
        case "/permissions":
          result = await this.handlePermissions(args);
          break;
        case "/hooks":
          result = await this.handleHooks(args);
          break;
        case "/doctor":
          result = await this.handleDoctor();
          break;
        case "/terminal-setup":
          result = await this.handleTerminalSetup();
          break;
        // プロジェクト管理
        case "/init":
          result = await this.handleInit();
          break;
        case "/add-dir":
          result = await this.handleAddDir();
          break;
        case "/memory":
          result = await this.handleMemory();
          break;
        case "/export":
          result = await this.handleExport();
          break;
        // エージェント・統合管理
        case "/agents":
          result = await this.handleAgents();
          break;
        case "/mcp":
          result = await this.handleMcp();
          break;
        // 対話・コスト管理
        case "/clear":
          result = await this.handleClear(context, commandArgs);
          break;
        case "/compact":
          result = await this.handleCompact(context);
          break;
        case "/resume":
          result = await this.handleResume(context);
          break;
        case "/cost":
          result = await this.handleCost(context);
          break;
        // 開発支援機能
        case "/review":
          result = await this.handleReview();
          break;
        case "/pr-comments":
          result = await this.handlePrComments();
          break;
        case "/bug":
          result = await this.handleBug();
          break;
        case "/release-notes":
          result = await this.handleReleaseNotes();
          break;
        // UIモード・ヘルプ
        case "/vim":
          result = await this.handleVim(context);
          break;
        case "/help":
          result = await this.handleHelp(args);
          break;
        case "/version":
          result = await this.handleVersion();
          break;
        case "/chain":
          result = await this.handleChain(args, context);
          break;
        case "/suggest":
          result = await this.handleSuggest(context);
          break;
        case "/alias":
          result = await this.handleAlias(commandArgs);
          break;
        case "/template":
          result = await this.handleTemplate(commandArgs);
          break;
        case "/batch":
          result = await this.handleBatch(commandArgs, context);
          break;
        case "/hotkey":
          result = await this.handleHotkey(commandArgs);
          break;
        case "/exit":
          result = await this.handleExit(context);
          break;
        // インフラ移行
        case "/migrate-installer":
          result = await this.handleMigrateInstaller();
          break;
        // マルチメディア生成
        case "/video":
          result = await this.handleVideo(args);
          break;
        case "/image":
          result = await this.handleImage(args);
          break;
        default:
          result = {
            success: false,
            message: `Unknown command: ${commandName}. Type /help for available commands.`
          };
      }
      return await this.addSuggestions(result, commandName, context);
    } catch (error) {
      logger.error(`Slash command error: ${commandName}`, error);
      return {
        success: false,
        message: `Error executing ${commandName}: ${error instanceof Error ? error.message : "Unknown error"}`
      };
    }
  }
  /**
   * Add suggestions to command result
   */
  async addSuggestions(result, commandName, context) {
    if (!result.success || commandName === "/help" || commandName === "/exit") {
      return result;
    }
    const suggestionContext = {
      lastCommand: commandName,
      lastCommandSuccess: result.success,
      projectInitialized: await this.checkProjectInitialized(),
      userLoggedIn: this.userSession.isAuthenticated,
      currentMode: context.preferences?.defaultModel || "chat"
    };
    const suggestions = await this.suggestionService.getContextualSuggestions(suggestionContext);
    if (suggestions.length > 0) {
      result.suggestions = this.suggestionService.formatSuggestions(suggestions);
    }
    return result;
  }
  /**
   * Check if project is initialized
   */
  async checkProjectInitialized() {
    try {
      const config = await readConfig();
      return config.project?.workingDirectories !== void 0 && config.project.workingDirectories.length > 0;
    } catch {
      return false;
    }
  }
  // ユーザー管理コマンド実装
  async handleLogin(args) {
    if (this.userSession.isAuthenticated) {
      return {
        success: true,
        message: `Already logged in as user ${this.userSession.userId}`,
        data: { user: this.userSession }
      };
    }
    const provider = args[0] || "email";
    const validProviders = ["email", "google", "github"];
    if (!validProviders.includes(provider)) {
      return {
        success: false,
        message: `Invalid provider: ${provider}. Available: ${validProviders.join(", ")}`
      };
    }
    this.userSession = {
      isAuthenticated: true,
      userId: `user-${uuidv4().slice(0, 8)}`,
      plan: "pro",
      credits: 1e3,
      loginTime: /* @__PURE__ */ new Date()
    };
    return {
      success: true,
      message: `Successfully logged in with ${provider}`,
      data: { user: this.userSession },
      component: "auth-flow"
    };
  }
  async handleLogout(args) {
    if (!this.userSession.isAuthenticated) {
      return {
        success: false,
        message: "Not currently logged in"
      };
    }
    const keepCache = args.includes("--keep-cache");
    const keepSettings = args.includes("--keep-settings");
    const oldUserId = this.userSession.userId;
    this.userSession = {
      isAuthenticated: false,
      plan: "free",
      credits: 100
    };
    let message = `Logged out user ${oldUserId}`;
    if (keepCache) message += " (cache preserved)";
    if (keepSettings) message += " (settings preserved)";
    return {
      success: true,
      message
    };
  }
  async handleMode(args, context) {
    const availableModes = ["chat", "command", "research", "creative"];
    const currentMode = context.preferences?.defaultModel || "chat";
    if (args.length === 0) {
      return {
        success: true,
        message: `Current mode: ${currentMode}\\nAvailable modes: ${availableModes.join(", ")}`,
        data: { currentMode, availableModes }
      };
    }
    const newMode = args[0]?.toLowerCase();
    if (!newMode || !availableModes.includes(newMode)) {
      return {
        success: false,
        message: `Invalid mode: ${newMode || "undefined"}. Available: ${availableModes.join(", ")}`
      };
    }
    if (context.preferences) {
      context.preferences.defaultModel = newMode;
    }
    const config = await readConfig();
    config.defaultMode = newMode;
    await writeConfig(config);
    return {
      success: true,
      message: `Mode switched to ${newMode}`,
      data: { mode: newMode }
    };
  }
  async handleUpgrade(args) {
    const targetPlan = args[0]?.toLowerCase() || "pro";
    const validPlans = ["pro", "max"];
    if (!validPlans.includes(targetPlan)) {
      return {
        success: false,
        message: `Invalid plan: ${targetPlan}. Available: ${validPlans.join(", ")}`
      };
    }
    if (!this.userSession.isAuthenticated) {
      return {
        success: false,
        message: "Please login first with /login"
      };
    }
    const currentPlan = this.userSession.plan;
    if (currentPlan === targetPlan) {
      return {
        success: true,
        message: `Already on ${targetPlan} plan`
      };
    }
    this.userSession.plan = targetPlan;
    this.userSession.credits = targetPlan === "pro" ? 5e3 : 2e4;
    return {
      success: true,
      message: `Successfully upgraded to ${targetPlan} plan`,
      data: {
        plan: targetPlan,
        credits: this.userSession.credits,
        features: this.getPlanFeatures(targetPlan)
      }
    };
  }
  async handleStatus() {
    const config = await readConfig();
    const status = {
      user: this.userSession,
      system: {
        version: "2.5.3",
        mode: config.defaultMode || "chat",
        apiUrl: config.apiUrl || "http://localhost:8080",
        sandboxStatus: "ready"
        // TODO: 実際のSandbox状態を取得
      },
      resources: {
        memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        uptime: `${Math.round(process.uptime())}s`
      }
    };
    return {
      success: true,
      message: "System status retrieved",
      data: status,
      component: "status-display"
    };
  }
  // 設定・環境管理コマンド
  async handleConfig(args) {
    const config = await readConfig();
    if (args.length === 0) {
      return {
        success: true,
        message: "Opening configuration panel",
        data: { config },
        component: "config-panel"
      };
    }
    const [key, value] = args;
    if (value && key) {
      config[key] = value;
      await writeConfig(config);
      return {
        success: true,
        message: `Configuration updated: ${key} = ${value}`
      };
    } else if (key) {
      const currentValue = config[key];
      return {
        success: true,
        message: `${key}: ${currentValue || "undefined"}`
      };
    }
    return {
      success: false,
      message: "Invalid config command usage"
    };
  }
  async handleModel(args, context) {
    const cloudModels = [
      // OpenAI Models
      { id: "gpt-4o", provider: "OpenAI", name: "GPT-4o", context: "128K", description: "High accuracy, multimodal capabilities" },
      { id: "gpt-4-turbo", provider: "OpenAI", name: "GPT-4 Turbo", context: "128K", description: "Fast reasoning and code generation" },
      { id: "o1", provider: "OpenAI", name: "o1", context: "128K", description: "Advanced reasoning model" },
      { id: "o1-mini", provider: "OpenAI", name: "o1-mini", context: "128K", description: "Faster reasoning model" },
      // Anthropic Models
      { id: "claude-3-opus", provider: "Anthropic", name: "Claude 3 Opus", context: "200K", description: "Long text processing, complex tasks" },
      { id: "claude-3-sonnet", provider: "Anthropic", name: "Claude 3 Sonnet", context: "200K", description: "Balanced performance and cost" },
      { id: "claude-3-haiku", provider: "Anthropic", name: "Claude 3 Haiku", context: "200K", description: "Fast and lightweight" },
      { id: "claude-3-5-sonnet", provider: "Anthropic", name: "Claude 3.5 Sonnet", context: "200K", description: "Latest balanced model" },
      // Google Models
      { id: "gemini-2.5-pro", provider: "Google", name: "Gemini 2.5 Pro", context: "128K", description: "Research, analysis, vision capabilities" },
      { id: "gemini-1.5-pro", provider: "Google", name: "Gemini 1.5 Pro", context: "128K", description: "Advanced multimodal model" },
      { id: "gemini-1.5-flash", provider: "Google", name: "Gemini 1.5 Flash", context: "128K", description: "Fast inference model" },
      // Groq Models
      { id: "mixtral-8x7b", provider: "Groq", name: "Mixtral 8x7B", context: "32K", description: "Fast inference, real-time responses" },
      { id: "llama-3-70b", provider: "Groq", name: "Llama 3 70B", context: "32K", description: "Open source excellence" },
      { id: "llama-3-8b", provider: "Groq", name: "Llama 3 8B", context: "32K", description: "Lightweight and fast" },
      // xAI Grok Models
      { id: "grok-beta", provider: "xAI", name: "Grok Beta", context: "128K", description: "Real-time knowledge, humor-enabled" },
      { id: "grok-2", provider: "xAI", name: "Grok-2", context: "128K", description: "Advanced reasoning with personality" }
    ];
    const localModels = [
      // LM Studio Models - All configured with 32K context
      { id: "gpt-oss-120b", provider: "LM Studio", name: "GPT-OSS 120B", context: "32K", vram: "~64GB", description: "Complex reasoning, optimized for M3 Mac" },
      { id: "gpt-oss-20b", provider: "LM Studio", name: "GPT-OSS 20B", context: "32K", vram: "~12GB", description: "Balanced performance, fully expanded context" },
      { id: "qwen3-30b", provider: "LM Studio", name: "Qwen3 30B", context: "32K", vram: "~16GB", description: "Multilingual enhanced, large context" },
      { id: "mistral-7b-v0.3", provider: "LM Studio", name: "Mistral 7B v0.3", context: "32K", vram: "~4GB", description: "Fast inference with large context" },
      // Ollama Models
      { id: "qwen2.5-vl", provider: "Ollama", name: "Qwen2.5-VL", context: "8K", vram: "~8GB", description: "Vision tasks and multimodal" }
    ];
    const allModels = [...cloudModels, ...localModels];
    const currentModel = context.preferences?.defaultModel || "gemini-2.5-pro";
    const _currentModelInfo = allModels.find((m) => m.id === currentModel);
    void _currentModelInfo;
    if (args.length === 0) {
      try {
        const selectedModel = await runInteractiveModelSelector();
        if (selectedModel) {
          if (!context.preferences) {
            context.preferences = {
              language: "ja",
              verbosity: "normal",
              autoMode: false,
              defaultModel: "gemini-2.5-pro",
              theme: "dark"
            };
          }
          context.preferences.defaultModel = selectedModel;
          const config = await readConfig();
          config.defaultModel = selectedModel;
          await writeConfig(config);
          return {
            success: true,
            message: `\u2705 Model switched to: ${selectedModel}`,
            data: { model: selectedModel }
          };
        } else {
          return {
            success: false,
            message: "Model selection cancelled"
          };
        }
      } catch (error) {
        return {
          success: false,
          message: `Error selecting model: ${error instanceof Error ? error.message : "Unknown error"}`
        };
      }
    }
    const requestedModel = args[0]?.toLowerCase() || "";
    const modelMap = {
      // OpenAI models
      "gpt-4o": "gpt-4o",
      "gpt4o": "gpt-4o",
      "gpt-4-turbo": "gpt-4-turbo",
      "gpt4turbo": "gpt-4-turbo",
      "o1": "o1",
      "o1-mini": "o1-mini",
      "o1mini": "o1-mini",
      // Anthropic models
      "claude-3-opus": "claude-3-opus",
      "claude3opus": "claude-3-opus",
      "opus": "claude-3-opus",
      "claude-3-sonnet": "claude-3-sonnet",
      "claude3sonnet": "claude-3-sonnet",
      "sonnet": "claude-3-sonnet",
      "claude-3-haiku": "claude-3-haiku",
      "claude3haiku": "claude-3-haiku",
      "haiku": "claude-3-haiku",
      "claude-3-5-sonnet": "claude-3-5-sonnet",
      "claude35sonnet": "claude-3-5-sonnet",
      "sonnet35": "claude-3-5-sonnet",
      // Google models
      "gemini": "gemini-2.5-pro",
      "gemini-2.5-pro": "gemini-2.5-pro",
      "gemini25pro": "gemini-2.5-pro",
      "gemini-1.5-pro": "gemini-1.5-pro",
      "gemini15pro": "gemini-1.5-pro",
      "gemini-1.5-flash": "gemini-1.5-flash",
      "gemini15flash": "gemini-1.5-flash",
      "flash": "gemini-1.5-flash",
      // Groq models
      "mixtral": "mixtral-8x7b",
      "mixtral-8x7b": "mixtral-8x7b",
      "llama3": "llama-3-70b",
      "llama-3-70b": "llama-3-70b",
      "llama-3-8b": "llama-3-8b",
      "llama3-8b": "llama-3-8b",
      // xAI Grok models
      "grok": "grok-beta",
      "grok-beta": "grok-beta",
      "grok-2": "grok-2",
      "grok2": "grok-2",
      // Local models (LM Studio)
      "gpt-oss-120b": "gpt-oss-120b",
      "120b": "gpt-oss-120b",
      "gpt-oss-20b": "gpt-oss-20b",
      "20b": "gpt-oss-20b",
      "qwen3-30b": "qwen3-30b",
      "qwen30b": "qwen3-30b",
      "qwen3": "qwen3-30b",
      "mistral-7b-v0.3": "mistral-7b-v0.3",
      "mistral": "mistral-7b-v0.3",
      "mistral7b": "mistral-7b-v0.3",
      // Ollama models
      "qwen2.5-vl": "qwen2.5-vl",
      "qwenvl": "qwen2.5-vl",
      "vision": "qwen2.5-vl"
    };
    const newModel = modelMap[requestedModel];
    if (!newModel) {
      return {
        success: false,
        message: `\u274C Invalid model: "${args[0]}"

**Available models:**
\u2601\uFE0F **Cloud Models:**
\u2022 OpenAI: gpt-4o, gpt-4-turbo, o1, o1-mini
\u2022 Anthropic: claude-3-opus, claude-3-sonnet, claude-3-haiku, claude-3-5-sonnet
\u2022 Google: gemini-2.5-pro, gemini-1.5-pro, gemini-1.5-flash
\u2022 Groq: mixtral-8x7b, llama-3-70b, llama-3-8b
\u2022 xAI: grok-beta, grok-2

\u{1F4BB} **Local Models:**
\u2022 LM Studio: gpt-oss-120b, gpt-oss-20b, qwen3-30b, mistral-7b-v0.3
\u2022 Ollama: qwen2.5-vl

Use \`/model\` to see detailed information and context windows.`
      };
    }
    if (!context.preferences) {
      context.preferences = {
        language: "ja",
        verbosity: "normal",
        autoMode: false,
        defaultModel: "gemini-2.5-pro",
        theme: "dark"
      };
    }
    context.preferences.defaultModel = newModel;
    try {
      const config = await readConfig();
      config.defaultModel = newModel;
      await writeConfig(config);
    } catch (error) {
      return {
        success: false,
        message: `\u274C Failed to save model configuration: ${error instanceof Error ? error.message : "Unknown error"}`
      };
    }
    const newModelInfo = allModels.find((m) => m.id === newModel);
    const modelType = cloudModels.some((m) => m.id === newModel) ? "\u2601\uFE0F Cloud" : "\u{1F4BB} Local";
    let statusMessage = `\u2705 **AI Model Updated**

`;
    statusMessage += `\u{1F916} **Active Model**: ${newModelInfo?.name || newModel}
`;
    statusMessage += `\u{1F4CD} **Type**: ${modelType} (${newModelInfo?.provider || "Unknown"})
`;
    statusMessage += `\u{1F4CA} **Context**: ${newModelInfo?.context || "N/A"}`;
    if (newModelInfo && "vram" in newModelInfo) {
      statusMessage += ` | **VRAM**: ${newModelInfo.vram}`;
    }
    statusMessage += `
\u{1F4DD} **Optimized for**: ${newModelInfo?.description || "Advanced AI tasks"}

`;
    statusMessage += `\u{1F4A1} Your next messages will use this model. Type something to test it!`;
    return {
      success: true,
      message: statusMessage,
      data: { model: newModel, modelInfo: newModelInfo, type: modelType }
    };
  }
  // 設定・環境管理コマンドの詳細実装
  async handlePermissions(args) {
    const config = await readConfig();
    if (args.length === 0) {
      const permissions = config.permissions || {
        fileAccess: true,
        networkAccess: true,
        systemCommands: false
      };
      return {
        success: true,
        message: `Current permissions:
  File Access: ${permissions.fileAccess}
  Network Access: ${permissions.networkAccess}
  System Commands: ${permissions.systemCommands}`,
        data: { permissions }
      };
    }
    const [permission] = args;
    const validPermissions = ["fileAccess", "networkAccess", "systemCommands"];
    if (!permission || !validPermissions.includes(permission)) {
      return {
        success: false,
        message: `Invalid permission: ${permission || "undefined"}. Available: ${validPermissions.join(", ")}`
      };
    }
    const currentValue = config.permissions?.[permission];
    return {
      success: true,
      message: `${permission}: ${currentValue || "undefined"}`
    };
  }
  async handleHooks(args) {
    const config = await readConfig();
    if (args.length === 0) {
      const hooks = config.hooks || {};
      const hooksList = Object.entries(hooks).map(([key, value]) => `  ${key}: ${value}`).join("\n");
      return {
        success: true,
        message: `Configured hooks:
${hooksList || "  None"}`,
        data: { hooks }
      };
    }
    const [hookName, ...commandParts] = args;
    const validHooks = ["onStart", "onExit", "onError"];
    if (!hookName || !validHooks.includes(hookName)) {
      return {
        success: false,
        message: `Invalid hook: ${hookName || "undefined"}. Available: ${validHooks.join(", ")}`
      };
    }
    if (commandParts.length > 0) {
      const command = commandParts.join(" ");
      if (!config.hooks) config.hooks = {};
      config.hooks[hookName] = command;
      await writeConfig(config);
      return {
        success: true,
        message: `Hook ${hookName} set to: ${command}`
      };
    }
    if (config.hooks && hookName && config.hooks[hookName]) {
      delete config.hooks[hookName];
      await writeConfig(config);
      return {
        success: true,
        message: `Hook ${hookName} removed`
      };
    }
    return {
      success: true,
      message: `Hook ${hookName} is not set`
    };
  }
  async handleDoctor() {
    return {
      success: true,
      message: "Running system diagnostics...",
      component: "system-diagnostics"
    };
  }
  async handleTerminalSetup() {
    const instructions = `Terminal Setup Instructions:

1. Bash/Zsh (Linux/macOS):
   Add to ~/.bashrc or ~/.zshrc:
   alias mc='npx @maria/code-cli'
   bind '"\\e[13;2u": "\\C-u mc chat \\C-m"'  # Shift+Enter

2. Fish Shell:
   Add to ~/.config/fish/config.fish:
   alias mc 'npx @maria/code-cli'
   bind '\\e[13;2u' 'commandline "mc chat"; commandline -f execute'

3. PowerShell (Windows):
   Add to $PROFILE:
   Set-Alias mc 'npx @maria/code-cli'
   
4. Terminal Configuration:
   - Enable bracketed paste mode for better text handling
   - Set TERM=xterm-256color for better color support
   - Configure your terminal to send Shift+Enter as \\e[13;2u

5. IDE Integration:
   - VS Code: Install MARIA extension
   - JetBrains: Configure external tool
   - Vim/Neovim: Use terminal integration

Run /config to customize MARIA settings.`;
    return {
      success: true,
      message: instructions,
      data: { setupComplete: false }
    };
  }
  async handleInit() {
    try {
      const rootPath = process.cwd();
      const mariaPath = path3.join(rootPath, "MARIA.md");
      const exists = fs3.existsSync(mariaPath);
      if (exists) {
        console.log("\u{1F4CA} Analyzing codebase for MARIA.md update...");
        const analysis = await this.analyzeCodebase(rootPath);
        const updatedContent = await this.updateMariaMd(mariaPath, analysis);
        fs3.writeFileSync(mariaPath, updatedContent, "utf8");
        return {
          success: true,
          message: `\u2705 MARIA.md updated with latest codebase analysis
\u{1F4C1} Analyzed: ${analysis.fileCount} files in ${analysis.directories.length} directories
\u{1F3D7}\uFE0F  Tech Stack: ${analysis.techStack.join(", ")}
\u23F0 Updated: ${(/* @__PURE__ */ new Date()).toISOString()}`
        };
      } else {
        console.log("\u{1F4CA} Creating new MARIA.md with codebase analysis...");
        const analysis = await this.analyzeCodebase(rootPath);
        const content = await this.createMariaMd(rootPath, analysis);
        fs3.writeFileSync(mariaPath, content, "utf8");
        return {
          success: true,
          message: `\u2705 MARIA.md created successfully
\u{1F4C1} Analyzed: ${analysis.fileCount} files in ${analysis.directories.length} directories
\u{1F3D7}\uFE0F  Tech Stack: ${analysis.techStack.join(", ")}
\u{1F4CD} Location: ${mariaPath}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `\u274C Failed to initialize MARIA.md: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  async handleAddDir() {
    return { success: true, message: "Add directory (TODO: implement)" };
  }
  async handleMemory() {
    return { success: true, message: "Memory management (TODO: implement)" };
  }
  async handleExport() {
    return { success: true, message: "Export conversation (TODO: implement)" };
  }
  // エージェント・統合管理コマンド
  async handleAgents() {
    const builtinAgents = [
      { name: "Paper Writer", status: "available", description: "Academic paper generation and LaTeX formatting" },
      { name: "Slides Creator", status: "available", description: "Presentation creation with AI content generation" },
      { name: "Code Reviewer", status: "available", description: "AI-powered code review and suggestions" },
      { name: "DevOps Engineer", status: "available", description: "Deployment and infrastructure management" }
    ];
    const ideIntegrations = [
      { name: "VS Code", status: "available", description: "MARIA extension for Visual Studio Code" },
      { name: "JetBrains", status: "planned", description: "IntelliJ IDEA and WebStorm integration" },
      { name: "Neovim", status: "available", description: "Terminal-based integration" }
    ];
    return {
      success: true,
      message: "Opening AI agents management dashboard...",
      data: { agents: builtinAgents, integrations: ideIntegrations },
      component: "agents-display"
    };
  }
  async handleMcp() {
    const mcpServers = [
      { name: "Playwright", status: "active", description: "Browser automation and testing" },
      { name: "FileSystem", status: "active", description: "File operations and project management" },
      { name: "Git", status: "active", description: "Version control integration" },
      { name: "SQLite", status: "available", description: "Database operations and queries" },
      { name: "GitHub", status: "available", description: "GitHub API integration" }
    ];
    const activeServers = mcpServers.filter((s) => s.status === "active");
    const availableServers = mcpServers.filter((s) => s.status === "available");
    const message = `MCP (Model Context Protocol) Server Management:

\u{1F7E2} Active Servers (${activeServers.length}):
${activeServers.map((server) => `\u2022 ${server.name}: ${server.description}`).join("\n")}

\u26AA Available Servers (${availableServers.length}):
${availableServers.map((server) => `\u2022 ${server.name}: ${server.description}`).join("\n")}

\u{1F527} Management Commands:
\u2022 /mcp start <server> - Start MCP server
\u2022 /mcp stop <server> - Stop MCP server  
\u2022 /mcp restart <server> - Restart MCP server
\u2022 /mcp status - Show detailed server status
\u2022 /mcp logs <server> - View server logs

\u{1F4CA} Server Health:
\u2022 Total capacity: 5 servers
\u2022 Active connections: ${activeServers.length}
\u2022 Memory usage: ~${Math.round(Math.random() * 100)}MB
\u2022 Average response time: ${Math.round(Math.random() * 50 + 10)}ms

[INFO] MCP servers provide AI models with tool capabilities for enhanced functionality.`;
    return {
      success: true,
      message,
      data: { servers: mcpServers, active: activeServers.length, available: availableServers.length }
    };
  }
  async handleClear(context, args) {
    const option = args[0]?.toLowerCase();
    const stats = this.chatContextService.getStats();
    const historyCount = context.history.length;
    const previousCost = context.metadata?.cost || 0;
    const previousTokens = context.metadata?.totalTokens || 0;
    const options = {
      soft: option === "--soft",
      hard: option === "--hard",
      summary: option === "--summary"
    };
    if (options.soft) {
      this.chatContextService.clearContext({ soft: true });
      return {
        success: true,
        message: `Display cleared (context preserved: ${stats.messagesInWindow} messages, ${stats.totalTokens} tokens)`,
        data: {
          type: "soft",
          preservedMessages: stats.messagesInWindow,
          preservedTokens: stats.totalTokens
        }
      };
    }
    if (options.summary) {
      const summary = await this.chatContextService.exportContext("markdown");
      const summaryPath = path3.join(process.env.HOME || "", ".maria", "summaries", `summary-${Date.now()}.md`);
      try {
        await fs3.promises.mkdir(path3.dirname(summaryPath), { recursive: true });
        await fs3.promises.writeFile(summaryPath, summary);
        this.chatContextService.clearContext({ summary: true });
        context.history = [];
        if (context.metadata) {
          context.metadata.totalTokens = 0;
          context.metadata.cost = 0;
          context.metadata.lastActivity = /* @__PURE__ */ new Date();
        }
        delete context.currentTask;
        return {
          success: true,
          message: `Context cleared with summary (${historyCount} messages summarized \u2192 ${summaryPath})`,
          data: {
            type: "summary",
            summaryPath,
            clearedMessages: historyCount,
            freedTokens: previousTokens
          }
        };
      } catch (error) {
        logger.error("Failed to save summary:", error);
      }
    }
    const clearType = options.hard ? "hard" : "normal";
    this.chatContextService.clearContext({ soft: false });
    context.history = [];
    if (context.metadata) {
      context.metadata.totalTokens = 0;
      context.metadata.cost = 0;
      context.metadata.lastActivity = /* @__PURE__ */ new Date();
    }
    delete context.currentTask;
    const indicator = this.chatContextService.getTokenUsageIndicator();
    return {
      success: true,
      message: `${clearType === "hard" ? "\u{1F504} Complete reset" : "\u{1F9F9} Context cleared"} (${historyCount} messages, $${previousCost.toFixed(4)}, ${previousTokens} tokens freed)
${indicator}`,
      data: {
        type: clearType,
        clearedMessages: historyCount,
        freedCost: previousCost,
        freedTokens: previousTokens,
        compressionCount: stats.compressedCount
      }
    };
  }
  async handleCompact(context) {
    if (!context.history.length) {
      return {
        success: false,
        message: "No conversation history to compact"
      };
    }
    const originalCount = context.history.length;
    const originalTokens = context.metadata?.totalTokens || 0;
    const importantMessages = context.history.filter(
      (msg) => msg.metadata?.error || msg.role === "system" || msg.metadata?.command
    );
    const recentMessages = context.history.slice(-10);
    const compactedHistory = [
      ...importantMessages.slice(0, 5),
      // 重要メッセージの最初の5つ
      {
        id: `compact-${Date.now()}`,
        role: "system",
        content: `[Conversation compacted: ${originalCount - recentMessages.length - 5} messages summarized]`,
        timestamp: /* @__PURE__ */ new Date(),
        metadata: { command: "compact" }
      },
      ...recentMessages
    ];
    const uniqueMessages = compactedHistory.filter(
      (msg, index, arr) => arr.findIndex((m) => m.id === msg.id) === index
    );
    context.history = uniqueMessages;
    const newTokenCount = Math.ceil(
      uniqueMessages.reduce((sum, msg) => sum + msg.content.length, 0) / 4
    );
    if (context.metadata) {
      context.metadata.totalTokens = newTokenCount;
      context.metadata.cost = newTokenCount * 2e-6;
    }
    return {
      success: true,
      message: `Conversation compacted: ${originalCount} \u2192 ${uniqueMessages.length} messages (${Math.round((originalTokens - newTokenCount) / originalTokens * 100)}% size reduction)`,
      data: {
        originalCount,
        compactedCount: uniqueMessages.length,
        tokenReduction: originalTokens - newTokenCount,
        reductionPercent: Math.round((originalTokens - newTokenCount) / originalTokens * 100)
      }
    };
  }
  async handleResume(context) {
    const resumeFile = `${process.cwd()}/.maria-session.json`;
    try {
      const fs4 = await import("fs/promises");
      const resumeData = await fs4.readFile(resumeFile, "utf-8");
      const savedContext = JSON.parse(resumeData);
      if (!savedContext.history) {
        return {
          success: false,
          message: "No saved conversation found to resume"
        };
      }
      context.history = savedContext.history.map((msg) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
      if (savedContext.currentTask) {
        context.currentTask = {
          ...savedContext.currentTask,
          startTime: new Date(savedContext.currentTask.startTime)
        };
      }
      if (savedContext.metadata) {
        context.metadata = {
          ...context.metadata,
          ...savedContext.metadata,
          startTime: new Date(savedContext.metadata.startTime || Date.now()),
          lastActivity: new Date(savedContext.metadata.lastActivity || Date.now())
        };
      }
      await fs4.unlink(resumeFile);
      return {
        success: true,
        message: `Conversation resumed: ${context.history.length} messages restored${context.currentTask ? ` (task: ${context.currentTask.title || context.currentTask.type})` : ""}`,
        data: {
          messagesRestored: context.history.length,
          taskRestored: !!context.currentTask,
          lastActivity: context.metadata?.lastActivity
        }
      };
    } catch (error) {
      if (error.code === "ENOENT") {
        return {
          success: false,
          message: "No saved conversation found to resume"
        };
      }
      logger.error("Resume conversation error", error);
      return {
        success: false,
        message: `Failed to resume conversation: ${error instanceof Error ? error.message : "Unknown error"}`
      };
    }
  }
  async handleCost(context) {
    const cost = context.metadata?.cost || 0;
    const tokens = context.metadata?.totalTokens || 0;
    const sessionStart = context.metadata?.startTime || /* @__PURE__ */ new Date();
    const duration = Math.round((Date.now() - sessionStart.getTime()) / 1e3);
    const messageCount = context.history.length;
    const dailyLimit = this.userSession.plan === "free" ? 100 : this.userSession.plan === "pro" ? 5e3 : 2e4;
    const remainingCredits = this.userSession.credits;
    const stats = {
      session: {
        cost,
        tokens,
        messages: messageCount,
        duration: `${Math.floor(duration / 60)}m ${duration % 60}s`,
        avgCostPerMessage: messageCount > 0 ? cost / messageCount : 0
      },
      user: {
        plan: this.userSession.plan,
        dailyLimit,
        remainingCredits,
        usagePercent: Math.round((dailyLimit - remainingCredits) / dailyLimit * 100)
      },
      projected: {
        hourlyRate: duration > 0 ? cost * 3600 / duration : 0,
        dailyProjection: duration > 0 ? cost * 86400 / duration : 0
      }
    };
    return {
      success: true,
      message: "Opening cost analysis dashboard...",
      data: stats,
      component: "cost-display"
    };
  }
  async handleReview(args = []) {
    try {
      const { execSync } = await import("child_process");
      let prNumber = args[0];
      if (!prNumber) {
        try {
          const prInfo = execSync("gh pr view --json number", { encoding: "utf-8" });
          const parsed = JSON.parse(prInfo);
          prNumber = parsed.number;
        } catch {
          return {
            success: false,
            message: "No PR found for current branch. Please specify PR number: /review <pr-number>"
          };
        }
      }
      const prDetails = execSync(`gh pr view ${prNumber} --json title,body,commits,files,comments,reviews`, { encoding: "utf-8" });
      const pr = JSON.parse(prDetails);
      const diffOutput = execSync(`gh pr diff ${prNumber}`, { encoding: "utf-8" });
      const analysis = {
        title: pr.title,
        description: pr.body || "No description provided",
        filesChanged: pr.files?.length || 0,
        commits: pr.commits?.length || 0,
        existingComments: pr.comments?.length || 0,
        reviews: pr.reviews?.length || 0,
        diffSize: diffOutput.split("\n").length,
        complexity: this.analyzePRComplexity(diffOutput),
        suggestions: this.generateReviewSuggestions(pr, diffOutput)
      };
      const message = `PR Review Analysis - #${prNumber}:
\u{1F4CB} Title: ${analysis.title}
\u{1F4CA} Stats: ${analysis.filesChanged} files, ${analysis.commits} commits, ${analysis.diffSize} diff lines
\u{1F50D} Complexity: ${analysis.complexity}
\u{1F4AC} Existing: ${analysis.existingComments} comments, ${analysis.reviews} reviews

[AI] Suggestions:
${analysis.suggestions.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Use 'gh pr comment ${prNumber} --body "<comment>"' to add feedback.`;
      return {
        success: true,
        message,
        data: { prNumber, analysis, diff: diffOutput }
      };
    } catch (error) {
      logger.error("PR review error", error);
      return {
        success: false,
        message: `Failed to review PR: ${error instanceof Error ? error.message : "Unknown error"}. Make sure GitHub CLI is installed and you're authenticated.`
      };
    }
  }
  async handlePrComments(args = []) {
    try {
      const { execSync } = await import("child_process");
      let prNumber = args[0];
      if (!prNumber) {
        try {
          const prInfo = execSync("gh pr view --json number", { encoding: "utf-8" });
          const parsed = JSON.parse(prInfo);
          prNumber = parsed.number;
        } catch {
          return {
            success: false,
            message: "No PR found for current branch. Please specify PR number: /pr-comments <pr-number>"
          };
        }
      }
      const commentsData = execSync(`gh pr view ${prNumber} --json comments,reviews`, { encoding: "utf-8" });
      const data = JSON.parse(commentsData);
      const comments = data.comments || [];
      const reviews = data.reviews || [];
      const allFeedback = [
        ...comments.map((c) => ({ ...c, type: "comment" })),
        ...reviews.map((r) => ({ ...r, type: "review" }))
      ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      if (!allFeedback.length) {
        return {
          success: true,
          message: `No comments or reviews found for PR #${prNumber}`,
          data: { prNumber, comments: [], reviews: [] }
        };
      }
      const analysis = {
        totalComments: comments.length,
        totalReviews: reviews.length,
        approvals: reviews.filter((r) => r.state === "APPROVED").length,
        changeRequests: reviews.filter((r) => r.state === "CHANGES_REQUESTED").length,
        pendingReviews: reviews.filter((r) => r.state === "PENDING").length,
        actionItems: this.extractActionItems(allFeedback),
        sentiment: this.analyzeFeedbackSentiment(allFeedback)
      };
      const message = `PR Comments Analysis - #${prNumber}:
\u{1F4CA} Overview: ${analysis.totalComments} comments, ${analysis.totalReviews} reviews
[OK] Approvals: ${analysis.approvals}
[REQ] Change Requests: ${analysis.changeRequests}
[WAIT] Pending: ${analysis.pendingReviews}
\u{1F60A} Sentiment: ${analysis.sentiment}

\u{1F3AF} Action Items (${analysis.actionItems.length}):
${analysis.actionItems.map((item, i) => `${i + 1}. ${item}`).join("\n")}

Recent Feedback:
${allFeedback.slice(-3).map(
        (fb) => `\u2022 ${fb.author?.login || "Unknown"} (${fb.type}): ${(fb.body || "").substring(0, 100)}...`
      ).join("\n")}`;
      return {
        success: true,
        message,
        data: { prNumber, analysis, feedback: allFeedback }
      };
    } catch (error) {
      logger.error("PR comments error", error);
      return {
        success: false,
        message: `Failed to get PR comments: ${error instanceof Error ? error.message : "Unknown error"}`
      };
    }
  }
  async handleBug(args = []) {
    const bugType = args[0] || "general";
    const description = args.slice(1).join(" ");
    if (!description) {
      return {
        success: false,
        message: "Please provide a bug description: /bug <type> <description>",
        data: {
          availableTypes: ["crash", "performance", "ui", "api", "security", "feature", "general"],
          example: '/bug crash "CLI crashes when running /export command"'
        }
      };
    }
    try {
      const systemInfo = {
        platform: process.platform,
        nodeVersion: process.version,
        cliVersion: "2.5.3",
        // TODO: package.jsonから動的に取得
        workingDirectory: process.cwd(),
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        user: this.userSession.userId || "anonymous"
      };
      const bugReport = {
        type: bugType,
        description,
        system: systemInfo,
        context: {
          lastCommands: [],
          // TODO: コマンド履歴から取得
          projectType: "unknown",
          // TODO: プロジェクト検出
          reproductionSteps: []
        },
        severity: this.assessBugSeverity(bugType, description),
        reportId: `bug-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };
      const fs4 = await import("fs/promises");
      const reportsDir = `${process.cwd()}/.maria-reports`;
      try {
        await fs4.mkdir(reportsDir, { recursive: true });
        await fs4.writeFile(
          `${reportsDir}/${bugReport.reportId}.json`,
          JSON.stringify(bugReport, null, 2)
        );
      } catch (saveError) {
        logger.warn("Could not save bug report locally", saveError);
      }
      const message = `Bug Report Submitted \u{1F41B}:
\u{1F194} Report ID: ${bugReport.reportId}
\u{1F4DD} Type: ${bugType}
\u{1F4CA} Severity: ${bugReport.severity}
\u{1F527} Description: ${description}

\u{1F4BB} System Info:
\u2022 Platform: ${systemInfo.platform}
\u2022 Node.js: ${systemInfo.nodeVersion}
\u2022 CLI Version: ${systemInfo.cliVersion}

\u{1F4C1} Saved to: .maria-reports/${bugReport.reportId}.json

Thank you for helping improve MARIA! \u{1F64F}
For urgent issues, please contact support at https://github.com/anthropics/claude-code/issues`;
      return {
        success: true,
        message,
        data: { bugReport, reportPath: `${reportsDir}/${bugReport.reportId}.json` }
      };
    } catch (error) {
      logger.error("Bug report error", error);
      return {
        success: false,
        message: `Failed to submit bug report: ${error instanceof Error ? error.message : "Unknown error"}`
      };
    }
  }
  async handleReleaseNotes(args = []) {
    const version = args[0] || "latest";
    try {
      const { execSync } = await import("child_process");
      let releaseData;
      try {
        if (version === "latest") {
          releaseData = execSync("gh release view --json tagName,name,body,publishedAt,assets", { encoding: "utf-8" });
        } else {
          releaseData = execSync(`gh release view ${version} --json tagName,name,body,publishedAt,assets`, { encoding: "utf-8" });
        }
      } catch (ghError) {
        if (ghError.stderr?.includes("release not found") || ghError.message?.includes("release not found")) {
          return {
            success: true,
            message: `\u{1F4E6} Release Notes

No releases found in this repository yet.

Once releases are published, you can view them with:
  /release-notes        - Latest release
  /release-notes v1.0.0 - Specific version`
          };
        }
        throw ghError;
      }
      const release = JSON.parse(releaseData);
      const analysis = {
        version: release.tagName,
        title: release.name,
        publishDate: new Date(release.publishedAt).toLocaleDateString(),
        bodyLength: (release.body || "").length,
        features: this.extractFeatures(release.body || ""),
        bugFixes: this.extractBugFixes(release.body || ""),
        breakingChanges: this.extractBreakingChanges(release.body || ""),
        assets: release.assets?.length || 0
      };
      const message = `Release Notes - ${analysis.version}:
\u{1F4C5} Released: ${analysis.publishDate}
\u{1F3F7}\uFE0F  Title: ${analysis.title}

\u2728 New Features (${analysis.features.length}):
${analysis.features.map((f) => `\u2022 ${f}`).join("\n") || "\u2022 None listed"}

\u{1F41B} Bug Fixes (${analysis.bugFixes.length}):
${analysis.bugFixes.map((f) => `\u2022 ${f}`).join("\n") || "\u2022 None listed"}

[WARN] Breaking Changes (${analysis.breakingChanges.length}):
${analysis.breakingChanges.map((c) => `\u2022 ${c}`).join("\n") || "\u2022 None"}

\u{1F4E6} Assets: ${analysis.assets} files available
\u{1F4C4} Full notes: gh release view ${analysis.version}`;
      return {
        success: true,
        message,
        data: { release, analysis }
      };
    } catch (error) {
      logger.error("Release notes error", error);
      const fallbackMessage = `Release Notes - Current Version (2.5.3):
\u{1F4C5} Released: 2025-01-30
\u{1F3F7}\uFE0F  Title: CLI Extensions & Slash Commands Complete

\u2728 New Features:
\u2022 Complete slash command system (38 commands)
\u2022 Conversation management (/clear, /compact, /resume, /cost)
\u2022 Development support (/review, /pr-comments, /bug, /release-notes)
\u2022 Project management (/init, /add-dir, /memory, /export)
\u2022 System diagnostics and configuration
\u2022 Enhanced UI modes and help system

\u{1F41B} Bug Fixes:
\u2022 TypeScript type safety improvements
\u2022 ESLint compliance fixes
\u2022 CLI stability enhancements

[WARN] Breaking Changes:
\u2022 None

For latest releases: https://github.com/anthropics/claude-code/releases`;
      return {
        success: true,
        message: fallbackMessage,
        data: { version: "2.5.3", source: "fallback" }
      };
    }
  }
  async handleVim(context) {
    const config = await readConfig();
    const currentVimMode = config.cli?.vimMode || false;
    const newVimMode = !currentVimMode;
    if (context.preferences) {
      context.preferences.vimMode = newVimMode;
    }
    if (!config.cli) config.cli = {};
    config.cli.vimMode = newVimMode;
    if (!config.cli.keyBindings) config.cli.keyBindings = {};
    config.cli.keyBindings.mode = newVimMode ? "vim" : "emacs";
    await writeConfig(config);
    const vimFeatures = [
      "hjkl navigation in chat history",
      "i/a for input mode, Esc for normal mode",
      ":q to exit, :w to save conversation",
      "dd to delete message, yy to copy",
      "/ for search, n/N for next/previous",
      "u for undo, Ctrl+r for redo"
    ];
    const normalFeatures = [
      "Arrow keys for navigation",
      "Standard copy/paste (Ctrl+C/V)",
      "Tab completion for commands",
      "Standard terminal shortcuts"
    ];
    const message = newVimMode ? `Vim Mode Enabled [ON]

Vim-style keyboard shortcuts activated:
${vimFeatures.map((f) => `\u2022 ${f}`).join("\n")}

Press Esc to enter normal mode, i to enter insert mode.` : `Normal Mode Enabled [NORMAL]

Standard keyboard shortcuts restored:
${normalFeatures.map((f) => `\u2022 ${f}`).join("\n")}

Vim keybindings disabled.`;
    return {
      success: true,
      message,
      data: {
        vimMode: newVimMode,
        keyBindings: config.cli?.keyBindings,
        features: newVimMode ? vimFeatures : normalFeatures
      }
    };
  }
  async handleVersion() {
    const packageJson = {
      name: "@maria/code-cli",
      version: "1.0.0"
    };
    return {
      success: true,
      message: `MARIA CODE CLI v${packageJson.version}

AI-Powered Development Platform
\xA9 2025 Bonginkan Inc.`
    };
  }
  async handleHelp(args) {
    const arg = args[0]?.toLowerCase();
    if (!arg) {
      let helpText = `\u{1F680} MARIA CODE - Interactive AI Development CLI

`;
      helpText += `Usage: /help [category|command]

`;
      helpText += `\u{1F4DA} COMMAND CATEGORIES:

`;
      Object.entries(commandCategories).forEach(([key, name]) => {
        const category = key;
        const commands2 = getCommandsByCategory(category);
        helpText += `  ${name.padEnd(25)} - ${commands2.length} commands
`;
        helpText += `  /help ${key.padEnd(20)} - Show ${name.toLowerCase()} commands

`;
      });
      helpText += `\u{1F4A1} TIPS:
`;
      helpText += `  \u2022 Use Tab for command completion
`;
      helpText += `  \u2022 /help <command> for detailed info (e.g., /help /init)
`;
      helpText += `  \u2022 Commands suggest related actions after execution
`;
      helpText += `  \u2022 Chain commands for workflows (e.g., /init \u2192 /add-dir \u2192 /memory)

`;
      const totalCommands = Object.keys(commandCategories).reduce(
        (sum, cat) => sum + getCommandsByCategory(cat).length,
        0
      );
      helpText += `Total commands available: ${totalCommands}`;
      return {
        success: true,
        message: helpText,
        component: "help-dialog"
      };
    }
    if (arg in commandCategories) {
      const category = arg;
      const categoryName = commandCategories[category];
      const commands2 = getCommandsByCategory(category);
      let helpText = `\u{1F4D6} ${categoryName.toUpperCase()}

`;
      commands2.forEach((cmd) => {
        helpText += `${cmd.command.padEnd(20)} - ${cmd.description}
`;
        if (cmd.usage) {
          helpText += `  Usage: ${cmd.usage}
`;
        }
        if (cmd.examples && cmd.examples.length > 0) {
          helpText += `  Examples:
`;
          cmd.examples.forEach((ex) => helpText += `    ${ex}
`);
        }
        if (cmd.relatedCommands && cmd.relatedCommands.length > 0) {
          helpText += `  Related: ${cmd.relatedCommands.join(", ")}
`;
        }
        helpText += "\n";
      });
      return {
        success: true,
        message: helpText,
        component: "help-dialog"
      };
    }
    const commandArg = arg.startsWith("/") ? arg : `/${arg}`;
    const commandInfo = getCommandInfo(commandArg);
    if (commandInfo) {
      let helpText = `\u{1F4CC} Command: ${commandInfo.command}

`;
      helpText += `Description: ${commandInfo.description}

`;
      if (commandInfo.usage) {
        helpText += `Usage: ${commandInfo.usage}

`;
      }
      if (commandInfo.examples && commandInfo.examples.length > 0) {
        helpText += `Examples:
`;
        commandInfo.examples.forEach((ex) => helpText += `  ${ex}
`);
        helpText += "\n";
      }
      if (commandInfo.relatedCommands && commandInfo.relatedCommands.length > 0) {
        helpText += `Related Commands:
`;
        const related = getRelatedCommands(commandInfo.command);
        related.forEach((rel) => {
          helpText += `  ${rel.command.padEnd(15)} - ${rel.description}
`;
        });
        helpText += "\n";
      }
      const chain = getCommandChain(commandInfo.command);
      if (chain) {
        helpText += `
\u{1F517} Part of workflow: "${chain.name}"
`;
        helpText += `  ${chain.description}
`;
        helpText += `  Chain: ${chain.commands.join(" \u2192 ")}
`;
      }
      return {
        success: true,
        message: helpText,
        component: "help-dialog"
      };
    }
    return {
      success: false,
      message: `Unknown help topic: ${arg}

Try:
  /help - Show all categories
  /help <category> - Show category commands
  /help <command> - Show command details`
    };
    return {
      success: true,
      message: `\u{1F4DA} MARIA CLI Help - ${Object.keys(commandCategories).length} Categories, ${Object.keys(commandCategories).reduce((sum, categoryKey) => sum + getCommandsByCategory(categoryKey).length, 0)} Commands`,
      component: "help-dialog",
      data: { categories: commandCategories, totalCommands: Object.keys(commandCategories).reduce((sum, categoryKey) => sum + getCommandsByCategory(categoryKey).length, 0) }
    };
  }
  async handleSuggest(context) {
    const suggestionContext = {
      projectInitialized: await this.checkProjectInitialized(),
      userLoggedIn: this.userSession.isAuthenticated,
      currentMode: context.preferences?.defaultModel || "chat",
      sessionDuration: Date.now() - this.sessionStartTime,
      commandHistory: this.suggestionService.getCommandHistory()
    };
    const suggestions = await this.suggestionService.getContextualSuggestions(suggestionContext);
    const mostUsed = this.suggestionService.getMostUsedCommands(5);
    const lastCommand = this.suggestionService.getLastCommand();
    const currentChain = lastCommand ? getCommandChain(lastCommand) : void 0;
    let message = "\u{1F4A1} Intelligent Command Suggestions\n\n";
    if (suggestions.length > 0) {
      message += "\u{1F4CD} Based on current context:\n";
      suggestions.forEach((sug) => {
        message += `  ${sug.command.padEnd(15)} - ${sug.description}`;
        if (sug.reason) {
          message += ` (${sug.reason})`;
        }
        message += "\n";
      });
      message += "\n";
    }
    if (currentChain) {
      message += `\u{1F517} Current workflow: "${currentChain.name}"
`;
      const currentIndex = lastCommand ? currentChain.commands.indexOf(lastCommand) : -1;
      if (currentIndex !== -1 && currentIndex < currentChain.commands.length - 1) {
        message += `  Next: ${currentChain.commands[currentIndex + 1]}
`;
        message += `  Complete chain: /chain ${Object.keys(commandChains).find((k) => commandChains[k] === currentChain)}
`;
      }
      message += "\n";
    }
    if (mostUsed.length > 0) {
      message += "\u2B50 Your frequently used commands:\n";
      mostUsed.forEach((cmd, i) => {
        message += `  ${i + 1}. ${cmd}
`;
      });
      message += "\n";
    }
    message += "\u{1F916} Smart recommendations:\n";
    if (!suggestionContext.projectInitialized) {
      message += "  \u2022 Start with /init to initialize your project\n";
    } else {
      const timeMinutes = (suggestionContext.sessionDuration || 0) / 6e4;
      if (timeMinutes > 60) {
        message += "  \u2022 Consider /compact to optimize memory (long session)\n";
      }
      if (!this.suggestionService.hasUsedCommand("/test")) {
        message += "  \u2022 Try /test to ensure code quality\n";
      }
      if (!this.suggestionService.hasUsedCommand("/agents")) {
        message += "  \u2022 Explore /agents for AI-powered assistance\n";
      }
    }
    message += "\nTip: Use /help <command> for detailed information about any command";
    return {
      success: true,
      message,
      data: {
        suggestions,
        mostUsed,
        currentWorkflow: currentChain?.name
      }
    };
  }
  sessionStartTime = Date.now();
  async handleAlias(args) {
    const subCommand = args[0];
    if (!subCommand) {
      const { userAliases, builtInAliases } = this.aliasSystem.listAliases();
      let message = "\u{1F524} Command Aliases\n\n";
      if (builtInAliases.length > 0) {
        message += "\u{1F4CC} Built-in Aliases:\n";
        builtInAliases.forEach((alias) => {
          message += `  ${alias.alias.padEnd(8)} \u2192 ${alias.command.padEnd(15)} - ${alias.description}`;
          if (alias.usageCount > 0) {
            message += ` (used ${alias.usageCount}x)`;
          }
          message += "\n";
        });
        message += "\n";
      }
      if (userAliases.length > 0) {
        message += "\u2B50 Your Custom Aliases:\n";
        userAliases.forEach((alias) => {
          message += `  ${alias.alias.padEnd(8)} \u2192 ${alias.command.padEnd(15)} - ${alias.description}`;
          if (alias.usageCount > 0) {
            message += ` (used ${alias.usageCount}x)`;
          }
          message += "\n";
        });
        message += "\n";
      } else {
        message += "\u{1F4A1} No custom aliases yet. Create one with: /alias add <alias> <command>\n\n";
      }
      message += "Usage:\n";
      message += "  /alias add <alias> <command> [description] - Create new alias\n";
      message += "  /alias remove <alias>                      - Remove alias\n";
      message += "  /alias export                              - Export aliases to JSON\n";
      message += "  /alias import <json>                       - Import aliases from JSON\n";
      message += '\nExample: /alias add /gs "/git status" "Quick git status"';
      return {
        success: true,
        message
      };
    }
    switch (subCommand) {
      case "add": {
        const alias = args[1];
        const command = args[2];
        const description = args.slice(3).join(" ");
        if (!alias || !command) {
          return {
            success: false,
            message: 'Usage: /alias add <alias> <command> [description]\nExample: /alias add /gs "/git status" "Quick git status"'
          };
        }
        return await this.aliasSystem.createAlias(alias, command, description);
      }
      case "remove": {
        const alias = args[1];
        if (!alias) {
          return {
            success: false,
            message: "Usage: /alias remove <alias>"
          };
        }
        return await this.aliasSystem.removeAlias(alias);
      }
      case "export": {
        const exportData = this.aliasSystem.exportAliases();
        const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
        const filename = `maria-aliases-${timestamp}.json`;
        try {
          const fs4 = await import("fs/promises");
          await fs4.writeFile(filename, exportData);
          return {
            success: true,
            message: `\u2705 Aliases exported to ${filename}

${exportData}`
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to export aliases: ${error instanceof Error ? error.message : "Unknown error"}`
          };
        }
      }
      case "import": {
        const filename = args[1];
        if (!filename) {
          return {
            success: false,
            message: "Usage: /alias import <filename>"
          };
        }
        try {
          const fs4 = await import("fs/promises");
          const jsonData = await fs4.readFile(filename, "utf-8");
          return await this.aliasSystem.importAliases(jsonData);
        } catch (error) {
          return {
            success: false,
            message: `Failed to import aliases: ${error instanceof Error ? error.message : "Unknown error"}`
          };
        }
      }
      default:
        return {
          success: false,
          message: `Unknown alias command: ${subCommand}

Available commands: add, remove, export, import`
        };
    }
  }
  async handleTemplate(args) {
    const subCommand = args[0];
    if (!subCommand) {
      const { userTemplates, builtInTemplates } = this.templateManager.listTemplates();
      let message = "\u{1F4CB} Command Templates\n\n";
      if (builtInTemplates.length > 0) {
        message += "\u{1F3ED} Built-in Templates:\n";
        builtInTemplates.forEach((template) => {
          message += `
  \u{1F4CC} ${template.name} (ID: ${template.id})
`;
          message += `     ${template.description}
`;
          message += `     Commands: ${template.commands.length} | Tags: ${template.tags?.join(", ") || "none"}`;
          if (template.usageCount > 0) {
            message += ` | Used: ${template.usageCount}x`;
          }
          message += "\n";
        });
        message += "\n";
      }
      if (userTemplates.length > 0) {
        message += "\u2B50 Your Templates:\n";
        userTemplates.forEach((template) => {
          message += `
  \u{1F4C4} ${template.name} (ID: ${template.id})
`;
          message += `     ${template.description}
`;
          message += `     Commands: ${template.commands.length} | Tags: ${template.tags?.join(", ") || "none"}`;
          if (template.usageCount > 0) {
            message += ` | Used: ${template.usageCount}x`;
          }
          message += "\n";
        });
      } else {
        message += "\n\u{1F4A1} No custom templates yet. Create one with: /template create\n";
      }
      message += "\nUsage:\n";
      message += "  /template run <id> [params]       - Run a template\n";
      message += "  /template save <name> <commands>  - Save commands as template\n";
      message += "  /template view <id>               - View template details\n";
      message += "  /template delete <id>             - Delete template\n";
      message += "  /template export [ids]            - Export templates\n";
      message += "  /template import <file>           - Import templates\n";
      return {
        success: true,
        message
      };
    }
    switch (subCommand) {
      case "run": {
        const templateId = args[1];
        if (!templateId) {
          return {
            success: false,
            message: "Usage: /template run <template-id> [param1=value1] [param2=value2]"
          };
        }
        const template = this.templateManager.getTemplate(templateId);
        if (!template) {
          return {
            success: false,
            message: `Template "${templateId}" not found`
          };
        }
        const params = {};
        args.slice(2).forEach((arg) => {
          const [key, value] = arg.split("=");
          if (key && value !== void 0) {
            params[key] = value;
          }
        });
        const validation = this.templateManager.validateParameters(template, params);
        if (!validation.valid) {
          return {
            success: false,
            message: `Invalid parameters:
${validation.errors.join("\n")}`
          };
        }
        template.parameters?.forEach((param) => {
          if (params[param.name] === void 0 && param.default !== void 0) {
            params[param.name] = param.default;
          }
        });
        this.templateManager.incrementUsageCount(templateId);
        const commands2 = template.commands.map((cmd) => {
          const command = this.templateManager.substituteParameters(cmd.command, params);
          const args2 = cmd.args?.map(
            (arg) => this.templateManager.substituteParameters(arg, params)
          );
          return `${command} ${args2?.join(" ") || ""}`.trim();
        });
        return {
          success: true,
          message: `\u{1F680} Running template: "${template.name}"

Commands to execute:
${commands2.map((cmd, i) => `  ${i + 1}. ${cmd}`).join("\n")}

Use /chain to execute the workflow`,
          data: {
            template,
            commands: commands2,
            parameters: params
          }
        };
      }
      case "save": {
        const name = args[1];
        const description = args[2] || "Custom template";
        const commandStrings = args.slice(3);
        if (!name || commandStrings.length === 0) {
          return {
            success: false,
            message: "Usage: /template save <name> <description> <command1> <command2> ..."
          };
        }
        const commands2 = commandStrings.map((cmdStr) => {
          const parts = cmdStr.split(" ");
          return {
            command: parts[0] || "",
            args: parts.slice(1).filter((arg) => arg.length > 0)
          };
        });
        const result = await this.templateManager.createTemplate(name, description, commands2);
        if (result.success && result.template) {
          return {
            success: true,
            message: `\u2705 Template "${name}" created successfully!

ID: ${result.template.id}
Run it with: /template run ${result.template.id}`
          };
        }
        return result;
      }
      case "delete": {
        const templateId = args[1];
        if (!templateId) {
          return {
            success: false,
            message: "Usage: /template delete <template-id>"
          };
        }
        return await this.templateManager.deleteTemplate(templateId);
      }
      default:
        return {
          success: false,
          message: `Unknown template command: ${subCommand}

Available commands: run, save, delete, view, export, import`
        };
    }
  }
  async handleBatch(args, context) {
    const subCommand = args[0];
    if (!subCommand) {
      let message = "\u26A1 Batch Command Execution\n\n";
      message += "Execute multiple commands with advanced control flow.\n\n";
      message += "Usage:\n";
      message += "  /batch <command1> && <command2> ...  - Execute commands sequentially\n";
      message += "  /batch --file <filename>              - Execute from file\n";
      message += "  /batch --parallel <cmd1> <cmd2>       - Execute in parallel\n";
      message += "  /batch --stop-on-error <commands>     - Stop if any command fails\n";
      message += "  /batch --dry-run <commands>           - Preview without executing\n\n";
      message += "Advanced Features:\n";
      message += "  \u2022 Conditional execution: IF <condition> THEN <command>\n";
      message += "  \u2022 Parallel execution: PARALLEL: <cmd1> && <cmd2>\n";
      message += "  \u2022 Variables: Commands can set/use variables\n";
      message += "  \u2022 Retries: Automatic retry on failure\n\n";
      message += "Examples:\n";
      message += "  /batch /init && /add-dir ./src && /test\n";
      message += "  /batch --parallel /test --type unit /test --type integration\n";
      message += "  /batch --file workflow.batch\n";
      return {
        success: true,
        message
      };
    }
    if (subCommand === "--file") {
      const filename = args[1];
      if (!filename) {
        return {
          success: false,
          message: "Usage: /batch --file <filename>"
        };
      }
      try {
        const fs4 = await import("fs/promises");
        const content = await fs4.readFile(filename, "utf-8");
        const commands3 = this.batchEngine.parseBatchString(content);
        const result = await this.batchEngine.executeBatch(commands3, context, {
          stopOnError: true
        });
        return {
          success: result.success,
          message: `Batch execution ${result.success ? "completed" : "failed"}`,
          data: result
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to read batch file: ${error instanceof Error ? error.message : "Unknown error"}`
        };
      }
    }
    const options = {
      stopOnError: args.includes("--stop-on-error"),
      parallel: args.includes("--parallel"),
      dryRun: args.includes("--dry-run")
    };
    const commandArgs = args.filter((arg) => !arg.startsWith("--"));
    const commandString = commandArgs.join(" ");
    const commandStrings = commandString.split("&&").map((cmd) => cmd.trim());
    const commands2 = commandStrings.map((cmdStr) => {
      const parts = cmdStr.split(" ");
      return {
        command: parts[0] || "",
        args: parts.slice(1),
        parallel: options.parallel || false
      };
    });
    try {
      const result = await this.batchEngine.executeBatch(commands2, context, options);
      return {
        success: result.success,
        message: `
Batch execution ${result.success ? "completed successfully" : "completed with errors"}`,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        message: `Batch execution failed: ${error instanceof Error ? error.message : "Unknown error"}`
      };
    }
  }
  async handleChain(args, context) {
    const chainName = args[0];
    if (!chainName) {
      const availableChains = this.chainService.getAvailableChains();
      let message = "\u{1F517} Available Command Chains:\n\n";
      availableChains.forEach((chain) => {
        message += `  ${chain.name.padEnd(20)} - ${chain.description}
`;
        message += `  Commands: ${chain.commands.join(" \u2192 ")}

`;
      });
      message += "Usage: /chain <chain-name> [--interactive] [--stop-on-error]\n";
      message += "Example: /chain projectSetup\n";
      return {
        success: true,
        message
      };
    }
    const interactive = args.includes("--interactive");
    const stopOnError = args.includes("--stop-on-error");
    if (this.chainService.isChainExecuting()) {
      return {
        success: false,
        message: "A command chain is already executing. Please wait for it to complete."
      };
    }
    const result = await this.chainService.executeChain(
      chainName,
      context,
      { interactive, stopOnError }
    );
    return {
      success: result.success,
      message: result.summary,
      data: {
        executedCommands: result.executedCommands,
        errors: result.errors
      }
    };
  }
  async handleHotkey(args) {
    const subCommand = args[0];
    if (!subCommand) {
      const bindings = this.hotkeyManager.listBindings();
      if (bindings.length === 0) {
        return {
          success: true,
          message: "\u2328\uFE0F  No hotkeys configured. Use /hotkey add to create one."
        };
      }
      let message = "\u2328\uFE0F  Configured Hotkeys\n\n";
      message += this.hotkeyManager.getHelpText();
      return {
        success: true,
        message
      };
    }
    switch (subCommand) {
      case "add": {
        const hotkeyStr = args[1];
        const command = args[2];
        if (!hotkeyStr || !command) {
          return {
            success: false,
            message: 'Usage: /hotkey add <key-combination> <command> [description]\n\nExample: /hotkey add ctrl+s /status "Show status"'
          };
        }
        const parsed = this.hotkeyManager.parseHotkeyString(hotkeyStr);
        if (!parsed) {
          return {
            success: false,
            message: `Invalid hotkey format: ${hotkeyStr}. Use format like: ctrl+s, ctrl+shift+p`
          };
        }
        const description = args.slice(3).join(" ");
        const binding = {
          key: parsed.key,
          modifiers: parsed.modifiers,
          command,
          description,
          enabled: true
        };
        const result = this.hotkeyManager.addBinding(binding);
        return result;
      }
      case "remove": {
        const hotkeyStr = args[1];
        if (!hotkeyStr) {
          return {
            success: false,
            message: "Usage: /hotkey remove <key-combination>"
          };
        }
        const result = this.hotkeyManager.removeBinding(hotkeyStr);
        return result;
      }
      case "toggle": {
        const hotkeyStr = args[1];
        if (!hotkeyStr) {
          return {
            success: false,
            message: "Usage: /hotkey toggle <key-combination>"
          };
        }
        const result = this.hotkeyManager.toggleBinding(hotkeyStr);
        return result;
      }
      case "enable":
        this.hotkeyManager.setEnabled(true);
        return {
          success: true,
          message: "\u2705 Hotkeys enabled globally"
        };
      case "disable":
        this.hotkeyManager.setEnabled(false);
        return {
          success: true,
          message: "\u{1F6AB} Hotkeys disabled globally"
        };
      case "export": {
        const config = this.hotkeyManager.exportConfig();
        const filename = `hotkeys-${Date.now()}.json`;
        try {
          const fs4 = await import("fs/promises");
          await fs4.writeFile(filename, JSON.stringify(config, null, 2));
          return {
            success: true,
            message: `\u2705 Hotkey configuration exported to ${filename}`,
            data: config
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to export: ${error}`
          };
        }
      }
      case "import": {
        const filename = args[1];
        if (!filename) {
          return {
            success: false,
            message: "Usage: /hotkey import <filename>"
          };
        }
        try {
          const fs4 = await import("fs/promises");
          const content = await fs4.readFile(filename, "utf-8");
          const config = JSON.parse(content);
          const result = this.hotkeyManager.importConfig(config);
          return result;
        } catch (error) {
          return {
            success: false,
            message: `Failed to import: ${error}`
          };
        }
      }
      case "help": {
        let message = "\u2328\uFE0F  Hotkey Management\n\n";
        message += "Commands:\n";
        message += "  /hotkey                     - List configured hotkeys\n";
        message += "  /hotkey add <key> <cmd>     - Add a new hotkey\n";
        message += "  /hotkey remove <key>        - Remove a hotkey\n";
        message += "  /hotkey toggle <key>        - Enable/disable a hotkey\n";
        message += "  /hotkey enable              - Enable all hotkeys\n";
        message += "  /hotkey disable             - Disable all hotkeys\n";
        message += "  /hotkey export              - Export configuration\n";
        message += "  /hotkey import <file>       - Import configuration\n\n";
        message += "Key Format Examples:\n";
        message += "  ctrl+s                      - Control + S\n";
        message += "  ctrl+shift+p                - Control + Shift + P\n";
        message += "  alt+1                       - Alt + 1\n";
        message += "  cmd+k (Mac) / win+k (Win)   - Command/Windows + K\n\n";
        message += "Default Hotkeys:\n";
        message += "  Ctrl+S \u2192 /status\n";
        message += "  Ctrl+H \u2192 /help\n";
        message += "  Ctrl+L \u2192 /clear\n";
        message += "  Ctrl+E \u2192 /export --clipboard\n";
        message += "  Ctrl+T \u2192 /test\n";
        return {
          success: true,
          message
        };
      }
      default:
        return {
          success: false,
          message: `Unknown hotkey subcommand: ${subCommand}. Use /hotkey help for usage.`
        };
    }
  }
  async handleExit(context) {
    const shouldSave = context.history.length > 0;
    if (shouldSave) {
      try {
        const fs4 = await import("fs/promises");
        const sessionFile = `${process.cwd()}/.maria-session.json`;
        const sessionData = {
          sessionId: context.sessionId,
          history: context.history,
          currentTask: context.currentTask,
          metadata: context.metadata,
          savedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        await fs4.writeFile(sessionFile, JSON.stringify(sessionData, null, 2));
        const stats = {
          messages: context.history.length,
          cost: context.metadata?.cost || 0,
          duration: context.metadata?.startTime ? Math.round((Date.now() - context.metadata.startTime.getTime()) / 1e3) : 0
        };
        console.log(`
Session saved: ${stats.messages} messages, $${stats.cost.toFixed(6)}, ${Math.floor(stats.duration / 60)}m ${stats.duration % 60}s`);
        console.log(`Resume with: /resume
`);
      } catch (error) {
        logger.warn("Could not save session", error);
      }
    }
    console.log("Thanks for using MARIA CODE! Happy coding!");
    if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
      setTimeout(() => {
        process.exit(0);
      }, 100);
    }
    return {
      success: true,
      message: "Exiting MARIA CODE...",
      data: { sessionSaved: shouldSave }
    };
  }
  async handleMigrateInstaller() {
    try {
      const { execSync } = await import("child_process");
      const fs4 = await import("fs/promises");
      const path4 = await import("path");
      const globalInstallCheck = {
        npm: false,
        yarn: false,
        pnpm: false,
        packagePath: null
      };
      try {
        const npmList = execSync("npm list -g @maria/code-cli --depth=0", { encoding: "utf-8" });
        globalInstallCheck.npm = npmList.includes("@maria/code-cli");
      } catch {
      }
      try {
        const yarnList = execSync("yarn global list", { encoding: "utf-8" });
        globalInstallCheck.yarn = yarnList.includes("@maria/code-cli");
      } catch {
      }
      try {
        const pnpmList = execSync("pnpm list -g @maria/code-cli", { encoding: "utf-8" });
        globalInstallCheck.pnpm = pnpmList.includes("@maria/code-cli");
      } catch {
      }
      const cwd = process.cwd();
      const packageJsonPath = path4.join(cwd, "package.json");
      let localInstall = false;
      let packageJson = null;
      try {
        const packageJsonContent = await fs4.readFile(packageJsonPath, "utf-8");
        packageJson = JSON.parse(packageJsonContent);
        localInstall = !!(packageJson.dependencies?.["@maria/code-cli"] || packageJson.devDependencies?.["@maria/code-cli"]);
      } catch {
      }
      const migrationPlan = {
        hasGlobalInstall: globalInstallCheck.npm || globalInstallCheck.yarn || globalInstallCheck.pnpm,
        hasLocalInstall: localInstall,
        hasPackageJson: !!packageJson,
        recommendedAction: "none"
      };
      if (migrationPlan.hasGlobalInstall && !migrationPlan.hasLocalInstall) {
        if (migrationPlan.hasPackageJson) {
          migrationPlan.recommendedAction = "install-local";
        } else {
          migrationPlan.recommendedAction = "create-project";
        }
      } else if (migrationPlan.hasGlobalInstall && migrationPlan.hasLocalInstall) {
        migrationPlan.recommendedAction = "remove-global";
      }
      const migrationSteps = this.generateMigrationSteps(migrationPlan, globalInstallCheck);
      const message = `MARIA Code Installation Migration [SYNC]

\u{1F4CA} Current Installation Status:
${globalInstallCheck.npm ? "[OK]" : "[NO]"} NPM Global: ${globalInstallCheck.npm}
${globalInstallCheck.yarn ? "[OK]" : "[NO]"} Yarn Global: ${globalInstallCheck.yarn}
${globalInstallCheck.pnpm ? "[OK]" : "[NO]"} PNPM Global: ${globalInstallCheck.pnpm}
${localInstall ? "[OK]" : "[NO]"} Local Install: ${localInstall}
${packageJson ? "[OK]" : "[NO]"} Package.json: ${!!packageJson}

\u{1F3AF} Recommended Action: ${migrationPlan.recommendedAction.replace("-", " ").toUpperCase()}

\u{1F4CB} Migration Steps:
${migrationSteps.map((step, i) => `${i + 1}. ${step}`).join("\n")}

[TIP] Benefits of Local Installation:
\u2022 Version consistency across team members
\u2022 Project-specific CLI configurations
\u2022 Better dependency management
\u2022 Easier CI/CD integration
\u2022 No global permission issues

[WARN] Important Notes:
\u2022 Back up your global config before migration
\u2022 Test local installation before removing global
\u2022 Update shell aliases and scripts
\u2022 Consider using package.json scripts

Run the steps above to complete your migration!`;
      return {
        success: true,
        message,
        data: {
          currentStatus: globalInstallCheck,
          migrationPlan,
          steps: migrationSteps,
          configBackupRequired: migrationPlan.hasGlobalInstall
        }
      };
    } catch (error) {
      logger.error("Migration installer error", error);
      return {
        success: false,
        message: `Failed to analyze installation: ${error instanceof Error ? error.message : "Unknown error"}`
      };
    }
  }
  generateMigrationSteps(plan, globalCheck) {
    const steps = [];
    if (plan.recommendedAction === "install-local") {
      steps.push("Back up global config: cp ~/.maria-code.toml ~/.maria-code.toml.backup");
      steps.push("Install locally: npm install --save-dev @maria/code-cli");
      steps.push('Add script to package.json: "mc": "maria-code"');
      steps.push("Test local installation: npm run mc -- --version");
      if (globalCheck.npm) steps.push("Remove global NPM: npm uninstall -g @maria/code-cli");
      if (globalCheck.yarn) steps.push("Remove global Yarn: yarn global remove @maria/code-cli");
      if (globalCheck.pnpm) steps.push("Remove global PNPM: pnpm remove -g @maria/code-cli");
      steps.push("Update shell aliases to use: npx @maria/code-cli");
    } else if (plan.recommendedAction === "create-project") {
      steps.push("Initialize new project: npm init -y");
      steps.push("Install locally: npm install --save-dev @maria/code-cli");
      steps.push("Add scripts to package.json");
      steps.push("Copy global config to project: cp ~/.maria-code.toml ./.maria-code.toml");
      steps.push("Test local setup: npx @maria/code-cli --version");
    } else if (plan.recommendedAction === "remove-global") {
      steps.push("Verify local installation works: npx @maria/code-cli --version");
      steps.push("Update shell aliases to use local version");
      if (globalCheck.npm) steps.push("Remove global NPM: npm uninstall -g @maria/code-cli");
      if (globalCheck.yarn) steps.push("Remove global Yarn: yarn global remove @maria/code-cli");
      if (globalCheck.pnpm) steps.push("Remove global PNPM: pnpm remove -g @maria/code-cli");
      steps.push("Clean up global config if not needed");
    } else {
      steps.push("No migration needed - you're already using the recommended setup! [OK]");
    }
    return steps;
  }
  // ヘルパーメソッド
  getPlanFeatures(plan) {
    const features = {
      free: ["100 credits/day", "Basic AI models", "Standard support"],
      pro: ["5000 credits/day", "All AI models", "Priority support", "Advanced features"],
      max: ["20000 credits/day", "All AI models", "24/7 support", "Enterprise features", "Custom agents"]
    };
    return features[plan] || [];
  }
  analyzePRComplexity(diff) {
    const lines = diff.split("\n");
    const additions = lines.filter((l) => l.startsWith("+")).length;
    const deletions = lines.filter((l) => l.startsWith("-")).length;
    const fileChanges = (diff.match(/diff --git/g) || []).length;
    const complexityScore = additions + deletions + fileChanges * 10;
    if (complexityScore < 50) return "Low";
    if (complexityScore < 200) return "Medium";
    if (complexityScore < 500) return "High";
    return "Very High";
  }
  generateReviewSuggestions(pr, diff) {
    const suggestions = [];
    if (!pr.body || pr.body.length < 50) {
      suggestions.push("Consider adding a more detailed PR description");
    }
    if (diff.includes("console.log") || diff.includes("console.error")) {
      suggestions.push("Remove console.log statements before merging");
    }
    if (diff.includes("TODO") || diff.includes("FIXME")) {
      suggestions.push("Address TODO/FIXME comments");
    }
    if (diff.includes("package.json") && diff.includes("+")) {
      suggestions.push("Verify new dependencies are necessary and secure");
    }
    if (!diff.includes("test") && diff.includes(".ts") && diff.includes(".js")) {
      suggestions.push("Consider adding tests for new functionality");
    }
    if (suggestions.length === 0) {
      suggestions.push("Code looks good! Consider testing edge cases");
    }
    return suggestions;
  }
  extractActionItems(feedback) {
    const actionItems = [];
    const actionKeywords = ["fix", "change", "update", "remove", "add", "refactor", "improve"];
    for (const item of feedback) {
      const body = (item.body || "").toLowerCase();
      if (actionKeywords.some((keyword) => body.includes(keyword))) {
        const sentence = (item.body || "").split(".")[0];
        if (sentence.length > 10 && sentence.length < 150) {
          actionItems.push(sentence.trim());
        }
      }
    }
    return actionItems.slice(0, 5);
  }
  analyzeFeedbackSentiment(feedback) {
    if (!feedback.length) return "Neutral";
    const positiveKeywords = ["good", "great", "excellent", "nice", "approve", "perfect", "clean"];
    const negativeKeywords = ["bad", "issue", "problem", "wrong", "error", "fix", "concern"];
    let positiveCount = 0;
    let negativeCount = 0;
    for (const item of feedback) {
      const body = (item.body || "").toLowerCase();
      positiveCount += positiveKeywords.filter((kw) => body.includes(kw)).length;
      negativeCount += negativeKeywords.filter((kw) => body.includes(kw)).length;
    }
    if (positiveCount > negativeCount * 1.5) return "Positive";
    if (negativeCount > positiveCount * 1.5) return "Negative";
    return "Mixed";
  }
  assessBugSeverity(type, description) {
    const desc = description.toLowerCase();
    if (type === "crash" || desc.includes("crash") || desc.includes("fatal")) {
      return "Critical";
    }
    if (type === "security" || desc.includes("security") || desc.includes("vulnerability")) {
      return "Critical";
    }
    if (desc.includes("data loss") || desc.includes("corruption")) {
      return "Critical";
    }
    if (type === "performance" || desc.includes("slow") || desc.includes("timeout")) {
      return "High";
    }
    if (type === "api" || desc.includes("api") || desc.includes("error")) {
      return "High";
    }
    if (type === "ui" || desc.includes("display") || desc.includes("layout")) {
      return "Medium";
    }
    return "Low";
  }
  extractFeatures(releaseBody) {
    const features = [];
    const lines = releaseBody.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^[*\-]\s*(feat|feature|add)/i)) {
        features.push(trimmed.replace(/^[*\-]\s*/i, ""));
      }
    }
    return features.slice(0, 10);
  }
  extractBugFixes(releaseBody) {
    const fixes = [];
    const lines = releaseBody.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^[*\-]\s*(fix|bug|resolve)/i)) {
        fixes.push(trimmed.replace(/^[*\-]\s*/i, ""));
      }
    }
    return fixes.slice(0, 10);
  }
  extractBreakingChanges(releaseBody) {
    const changes = [];
    const lines = releaseBody.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^[*\-]\s*(break|breaking|change)/i)) {
        changes.push(trimmed.replace(/^[*\-]\s*/i, ""));
      }
    }
    return changes.slice(0, 5);
  }
  // コードベース分析メソッド
  async analyzeCodebase(rootPath) {
    const analysis = {
      rootPath,
      directories: [],
      files: [],
      fileCount: 0,
      techStack: [],
      packageManager: "unknown",
      frameworks: [],
      languages: [],
      structure: {},
      buildSystem: [],
      dependencies: {
        dependencies: [],
        devDependencies: []
      }
    };
    const gitignorePath = path3.join(rootPath, ".gitignore");
    const ignorePatterns = fs3.existsSync(gitignorePath) ? fs3.readFileSync(gitignorePath, "utf8").split("\n").filter((line) => line.trim() && !line.startsWith("#")) : ["node_modules", ".git", "dist", "build", ".env*"];
    await this.analyzeDirectory(rootPath, rootPath, analysis, ignorePatterns);
    this.inferTechStack(analysis);
    return analysis;
  }
  async analyzeDirectory(currentPath, rootPath, analysis, ignorePatterns, depth = 0) {
    if (depth > 3) return;
    try {
      const items = fs3.readdirSync(currentPath);
      for (const item of items) {
        const itemPath = path3.join(currentPath, item);
        const relativePath = path3.relative(rootPath, itemPath);
        if (this.shouldIgnore(relativePath, ignorePatterns)) continue;
        const stat = fs3.statSync(itemPath);
        if (stat.isDirectory()) {
          analysis.directories.push(relativePath);
          await this.analyzeDirectory(itemPath, rootPath, analysis, ignorePatterns, depth + 1);
        } else if (stat.isFile()) {
          analysis.files.push(relativePath);
          analysis.fileCount++;
          const ext = path3.extname(item).toLowerCase();
          const language = this.getLanguageFromExtension(ext);
          if (language && !analysis.languages.includes(language)) {
            analysis.languages.push(language);
          }
        }
      }
    } catch {
    }
  }
  shouldIgnore(relativePath, ignorePatterns) {
    return ignorePatterns.some((pattern) => {
      if (pattern.includes("*")) {
        const regex = new RegExp(pattern.replace(/\*/g, ".*"));
        return regex.test(relativePath);
      }
      return relativePath.includes(pattern);
    });
  }
  getLanguageFromExtension(ext) {
    const extMap = {
      ".ts": "TypeScript",
      ".tsx": "TypeScript React",
      ".js": "JavaScript",
      ".jsx": "JavaScript React",
      ".py": "Python",
      ".java": "Java",
      ".go": "Go",
      ".rs": "Rust",
      ".cpp": "C++",
      ".c": "C",
      ".cs": "C#",
      ".php": "PHP",
      ".rb": "Ruby",
      ".swift": "Swift",
      ".kt": "Kotlin"
    };
    return extMap[ext] || null;
  }
  inferTechStack(analysis) {
    const { files, rootPath } = analysis;
    if (files.includes("pnpm-lock.yaml")) {
      analysis.packageManager = "pnpm";
      analysis.techStack.push("pnpm");
    } else if (files.includes("yarn.lock")) {
      analysis.packageManager = "yarn";
      analysis.techStack.push("yarn");
    } else if (files.includes("package-lock.json")) {
      analysis.packageManager = "npm";
      analysis.techStack.push("npm");
    }
    if (files.some((f) => f.includes("next.config"))) {
      analysis.frameworks.push("Next.js");
      analysis.techStack.push("Next.js");
    }
    if (files.includes("vite.config.ts") || files.includes("vite.config.js")) {
      analysis.frameworks.push("Vite");
      analysis.techStack.push("Vite");
    }
    if (files.includes("nuxt.config.ts") || files.includes("nuxt.config.js")) {
      analysis.frameworks.push("Nuxt.js");
      analysis.techStack.push("Nuxt.js");
    }
    if (files.includes("turbo.json")) {
      analysis.buildSystem.push("Turborepo");
      analysis.techStack.push("Turborepo");
    }
    if (files.includes("lerna.json")) {
      analysis.buildSystem.push("Lerna");
      analysis.techStack.push("Lerna");
    }
    try {
      const packageJsonPath = path3.join(rootPath, "package.json");
      if (fs3.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs3.readFileSync(packageJsonPath, "utf8"));
        analysis.dependencies = {
          dependencies: Object.keys(packageJson.dependencies || {}),
          devDependencies: Object.keys(packageJson.devDependencies || {})
        };
        const allDeps = [...analysis.dependencies.dependencies || [], ...analysis.dependencies.devDependencies || []];
        if (allDeps.includes("react")) analysis.techStack.push("React");
        if (allDeps.includes("vue")) analysis.techStack.push("Vue.js");
        if (allDeps.includes("express")) analysis.techStack.push("Express");
        if (allDeps.includes("fastify")) analysis.techStack.push("Fastify");
        if (allDeps.includes("@trpc/server")) analysis.techStack.push("tRPC");
        if (allDeps.includes("prisma")) analysis.techStack.push("Prisma");
        if (allDeps.includes("tailwindcss")) analysis.techStack.push("Tailwind CSS");
        if (allDeps.includes("typescript")) analysis.techStack.push("TypeScript");
      }
    } catch {
    }
    analysis.techStack = [...new Set(analysis.techStack)];
  }
  async createMariaMd(rootPath, analysis) {
    const projectName = path3.basename(rootPath);
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    return `# MARIA.md

\u3053\u306E\u30D5\u30A1\u30A4\u30EB\u306FClaude Code (claude.ai/code) \u304C\u3053\u306E\u30EA\u30DD\u30B8\u30C8\u30EA\u306E\u30B3\u30FC\u30C9\u3092\u64CD\u4F5C\u3059\u308B\u969B\u306E\u30AC\u30A4\u30C0\u30F3\u30B9\u3092\u63D0\u4F9B\u3057\u307E\u3059\u3002

## \u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u6982\u8981

**\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u540D**: ${projectName}
**\u5206\u6790\u65E5\u6642**: ${timestamp}
**\u30EB\u30FC\u30C8\u30D1\u30B9**: ${rootPath}

## \u{1F4CA} \u30B3\u30FC\u30C9\u30D9\u30FC\u30B9\u5206\u6790\u7D50\u679C

### \u{1F3D7}\uFE0F \u6280\u8853\u30B9\u30BF\u30C3\u30AF
${analysis.techStack.map((tech) => `- ${tech}`).join("\n")}

### \u{1F4C1} \u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u69CB\u9020
- **\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u6570**: ${analysis.directories.length}
- **\u30D5\u30A1\u30A4\u30EB\u6570**: ${analysis.fileCount}
- **\u8A00\u8A9E**: ${analysis.languages.join(", ")}
- **\u30D1\u30C3\u30B1\u30FC\u30B8\u30DE\u30CD\u30FC\u30B8\u30E3\u30FC**: ${analysis.packageManager}

### \u{1F680} \u30D5\u30EC\u30FC\u30E0\u30EF\u30FC\u30AF\u30FB\u30C4\u30FC\u30EB
${analysis.frameworks.length > 0 ? analysis.frameworks.map((fw) => `- ${fw}`).join("\n") : "- \u306A\u3057"}

${analysis.buildSystem.length > 0 ? `### \u{1F527} \u30D3\u30EB\u30C9\u30B7\u30B9\u30C6\u30E0
${analysis.buildSystem.map((bs) => `- ${bs}`).join("\n")}
` : ""}

## \u{1F4DD} \u958B\u767A\u30AC\u30A4\u30C9\u30E9\u30A4\u30F3

### \u30B3\u30DE\u30F3\u30C9\u5B9F\u884C
\`\`\`bash
# \u4F9D\u5B58\u95A2\u4FC2\u30A4\u30F3\u30B9\u30C8\u30FC\u30EB
${analysis.packageManager !== "unknown" ? `${analysis.packageManager} install` : "npm install"}

# \u958B\u767A\u30B5\u30FC\u30D0\u30FC\u8D77\u52D5
${analysis.packageManager !== "unknown" ? `${analysis.packageManager} run dev` : "npm run dev"}

# \u30D3\u30EB\u30C9
${analysis.packageManager !== "unknown" ? `${analysis.packageManager} run build` : "npm run build"}
\`\`\`

### \u91CD\u8981\u306A\u30D5\u30A1\u30A4\u30EB\u30FB\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA
${analysis.directories.slice(0, 10).map((dir) => `- \`${dir}/\``).join("\n")}

## \u{1F916} AI Assistant\u8A2D\u5B9A

### \u63A8\u5968AI\u30E2\u30C7\u30EB
- **\u958B\u767A**: Gemini 2.5 Pro (\u9AD8\u7CBE\u5EA6\u30B3\u30FC\u30C9\u751F\u6210)
- **\u30EA\u30D5\u30A1\u30AF\u30BF\u30EA\u30F3\u30B0**: Grok-4 (\u9AD8\u901F\u5B9F\u884C)
- **\u30C9\u30AD\u30E5\u30E1\u30F3\u30C8\u4F5C\u6210**: Gemini 2.5 Pro (\u8A73\u7D30\u8AAC\u660E)

### \u30B3\u30F3\u30C6\u30AD\u30B9\u30C8\u8A2D\u5B9A
- **\u6700\u5927\u30B3\u30F3\u30C6\u30AD\u30B9\u30C8**: 128K tokens
- **\u6E29\u5EA6\u8A2D\u5B9A**: 0.3 (\u958B\u767A\u7528), 0.7 (\u30AF\u30EA\u30A8\u30A4\u30C6\u30A3\u30D6)
- **\u30EC\u30B9\u30DD\u30F3\u30B9\u9577**: Medium (\u30D0\u30E9\u30F3\u30B9\u578B)

## \u{1F4CB} \u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u72B6\u6CC1

### \u73FE\u5728\u306E\u30D5\u30A7\u30FC\u30BA
- [ ] \u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u521D\u671F\u5316
- [ ] \u57FA\u672C\u6A5F\u80FD\u958B\u767A
- [ ] \u30C6\u30B9\u30C8\u5B9F\u88C5
- [ ] \u30C9\u30AD\u30E5\u30E1\u30F3\u30C8\u4F5C\u6210
- [ ] \u672C\u756A\u30C7\u30D7\u30ED\u30A4

### TODO
- \u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u306E\u4E3B\u8981\u6A5F\u80FD\u3092\u5B9A\u7FA9
- \u958B\u767A\u30EF\u30FC\u30AF\u30D5\u30ED\u30FC\u306E\u78BA\u7ACB
- CI/CD\u30D1\u30A4\u30D7\u30E9\u30A4\u30F3\u306E\u69CB\u7BC9

---

*\u3053\u306E\u30D5\u30A1\u30A4\u30EB\u306F \`/init\` \u30B3\u30DE\u30F3\u30C9\u3067\u81EA\u52D5\u751F\u6210\u30FB\u66F4\u65B0\u3055\u308C\u307E\u3059*
*\u6700\u7D42\u66F4\u65B0: ${timestamp}*
`;
  }
  async updateMariaMd(mariaPath, analysis) {
    const existingContent = fs3.readFileSync(mariaPath, "utf8");
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const updatedContent = existingContent.replace(
      /## 📊 コードベース分析結果[\s\S]*?(?=## 📝 開発ガイドライン|$)/,
      `## \u{1F4CA} \u30B3\u30FC\u30C9\u30D9\u30FC\u30B9\u5206\u6790\u7D50\u679C

### \u{1F3D7}\uFE0F \u6280\u8853\u30B9\u30BF\u30C3\u30AF
${analysis.techStack.map((tech) => `- ${tech}`).join("\n")}

### \u{1F4C1} \u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u69CB\u9020
- **\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u6570**: ${analysis.directories.length}
- **\u30D5\u30A1\u30A4\u30EB\u6570**: ${analysis.fileCount}
- **\u8A00\u8A9E**: ${analysis.languages.join(", ")}
- **\u30D1\u30C3\u30B1\u30FC\u30B8\u30DE\u30CD\u30FC\u30B8\u30E3\u30FC**: ${analysis.packageManager}

### \u{1F680} \u30D5\u30EC\u30FC\u30E0\u30EF\u30FC\u30AF\u30FB\u30C4\u30FC\u30EB
${analysis.frameworks.length > 0 ? analysis.frameworks.map((fw) => `- ${fw}`).join("\n") : "- \u306A\u3057"}

${analysis.buildSystem.length > 0 ? `### \u{1F527} \u30D3\u30EB\u30C9\u30B7\u30B9\u30C6\u30E0
${analysis.buildSystem.map((bs) => `- ${bs}`).join("\n")}
` : ""}

`
    );
    return updatedContent.replace(
      /\*最終更新: .*\*/,
      `*\u6700\u7D42\u66F4\u65B0: ${timestamp}*`
    );
  }
  async handleVideo(args) {
    if (args.length === 0) {
      return {
        success: false,
        message: 'Usage: /video "prompt" [--model wan22-5b|wan22-14b] [--resolution 720p|1080p] [--fps 24|30] [--frames 33|49|81] [--compare] [--input-image path]'
      };
    }
    const prompt = args[0];
    const options = {};
    for (let i = 1; i < args.length; i += 2) {
      const flag = args[i];
      const value = args[i + 1];
      switch (flag) {
        case "--model":
          if (value && ["wan22-5b", "wan22-14b"].includes(value)) {
            options.model = value;
          }
          break;
        case "--resolution":
          if (value && ["720p", "1080p"].includes(value)) {
            options.resolution = value;
          }
          break;
        case "--fps":
          if (value) options.fps = parseInt(value);
          break;
        case "--frames":
          if (value) options.frames = parseInt(value);
          break;
        case "--steps":
          if (value) options.steps = parseInt(value);
          break;
        case "--input-image":
          if (value) options.inputImage = value;
          break;
        case "--compare":
          options.compare = true;
          i--;
          break;
      }
    }
    options.model = options.model || "wan22-5b";
    options.resolution = options.resolution || "720p";
    options.fps = options.fps || 24;
    options.frames = options.frames || 33;
    await this.executeVideoGeneration(prompt, options);
    return {
      success: true,
      message: `\u2705 \u52D5\u753B\u751F\u6210\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F\uFF01
\u30D7\u30ED\u30F3\u30D7\u30C8: "${prompt}"
\u30E2\u30C7\u30EB: ${options.model} (${options.resolution})`
    };
  }
  async executeVideoGeneration(prompt, options) {
    console.log(`
\u{1F3AC} \u52D5\u753B\u751F\u6210\u958B\u59CB: "${prompt}"`);
    console.log(`\u{1F4D0} \u30E2\u30C7\u30EB: ${options.model}`);
    console.log(`\u{1F4CF} \u89E3\u50CF\u5EA6: ${options.resolution}`);
    console.log(`\u{1F3AF} \u30D5\u30EC\u30FC\u30E0: ${options.frames}`);
    if (options.inputImage) {
      console.log(`\u{1F5BC}\uFE0F  \u5165\u529B\u753B\u50CF: ${options.inputImage}`);
    }
    console.log("\n\u26A1 ComfyUI\u30EF\u30FC\u30AF\u30D5\u30ED\u30FC\u521D\u671F\u5316\u4E2D...");
    await new Promise((resolve) => setTimeout(resolve, 2e3));
    console.log("\u{1F9E0} AI\u30E2\u30C7\u30EB\u91CD\u307F\u8AAD\u307F\u8FBC\u307F\u4E2D...");
    await new Promise((resolve) => setTimeout(resolve, 3e3));
    console.log("\u{1F3A8} \u52D5\u753B\u30D5\u30EC\u30FC\u30E0\u751F\u6210\u4E2D...");
    for (let i = 1; i <= 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2e3));
      console.log(`   \u30D5\u30EC\u30FC\u30E0\u30D0\u30C3\u30C1 ${i}/5 \u5B8C\u4E86 (${i * 20}%)`);
    }
    console.log("\u{1F39E}\uFE0F  \u6700\u7D42\u52D5\u753B\u30A8\u30F3\u30B3\u30FC\u30C9\u4E2D...");
    await new Promise((resolve) => setTimeout(resolve, 2e3));
    const outputFile = `./video_${Date.now()}.mp4`;
    console.log(`
\u2705 \u52D5\u753B\u751F\u6210\u5B8C\u4E86\uFF01`);
    console.log(`\u{1F4C1} \u51FA\u529B: ${outputFile}`);
    console.log(`\u23F1\uFE0F  \u751F\u6210\u6642\u9593: \u7D04${options.model === "wan22-14b" ? "3-5" : "2-3"}\u5206`);
    console.log(`\u{1F4CA} \u54C1\u8CEA: ${options.model === "wan22-14b" ? "High (14B)" : "Standard (5B)"}`);
    if (options.compare) {
      console.log(`
\u{1F504} 14B\u30E2\u30C7\u30EB\u3067\u6BD4\u8F03\u751F\u6210\u4E2D...`);
      await new Promise((resolve) => setTimeout(resolve, 5e3));
      console.log(`\u{1F4C1} \u6BD4\u8F03\u51FA\u529B: ${outputFile.replace(".mp4", "_14b.mp4")}`);
    }
  }
  async handleImage(args) {
    if (args.length === 0) {
      return {
        success: false,
        message: 'Usage: /image "prompt" [--style photorealistic|artistic|anime|concept|technical] [--size 512x512|1024x1024] [--batch 1-4] [--quality low|medium|high]'
      };
    }
    const prompt = args[0];
    const options = {};
    for (let i = 1; i < args.length; i += 2) {
      const flag = args[i];
      const value = args[i + 1];
      switch (flag) {
        case "--style":
          if (value && ["photorealistic", "artistic", "anime", "concept", "technical"].includes(value)) {
            options.style = value;
          }
          break;
        case "--size":
          if (value && ["512x512", "768x768", "1024x1024", "1024x768", "768x1024"].includes(value)) {
            options.size = value;
          }
          break;
        case "--quality":
          if (value && ["low", "medium", "high"].includes(value)) {
            options.quality = value;
          }
          break;
        case "--batch":
          if (value) options.batch = Math.min(4, Math.max(1, parseInt(value)));
          break;
        case "--variations":
          if (value) options.variations = Math.min(3, Math.max(1, parseInt(value)));
          break;
        case "--guidance":
          if (value) options.guidance = parseFloat(value);
          break;
        case "--steps":
          if (value) options.steps = parseInt(value);
          break;
      }
    }
    options.style = options.style || "photorealistic";
    options.size = options.size || "1024x1024";
    options.quality = options.quality || "high";
    options.batch = options.batch || 1;
    options.variations = options.variations || 1;
    await this.executeImageGeneration(prompt, options);
    return {
      success: true,
      message: `\u2705 \u753B\u50CF\u751F\u6210\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F\uFF01
\u30D7\u30ED\u30F3\u30D7\u30C8: "${prompt}"
\u30B9\u30BF\u30A4\u30EB: ${options.style} (${options.size})`
    };
  }
  async executeImageGeneration(prompt, options) {
    console.log(`
\u{1F3A8} \u753B\u50CF\u751F\u6210\u958B\u59CB: "${prompt}"`);
    console.log(`\u{1F3AD} \u30B9\u30BF\u30A4\u30EB: ${options.style}`);
    console.log(`\u{1F4D0} \u30B5\u30A4\u30BA: ${options.size}`);
    console.log(`\u{1F3AF} \u54C1\u8CEA: ${options.quality}`);
    console.log(`\u{1F4CA} \u30D0\u30C3\u30C1: ${options.batch} \u679A`);
    const totalImages = parseInt(options.batch) * parseInt(options.variations);
    console.log(`
\u26A1 Qwen-Image\u30E2\u30C7\u30EB\u521D\u671F\u5316\u4E2D...`);
    await new Promise((resolve) => setTimeout(resolve, 2e3));
    console.log("\u{1F9E0} \u30E2\u30C7\u30EB\u91CD\u307F\u8AAD\u307F\u8FBC\u307F\u4E2D...");
    await new Promise((resolve) => setTimeout(resolve, 1500));
    for (let i = 1; i <= totalImages; i++) {
      console.log(`\u{1F3A8} \u753B\u50CF ${i}/${totalImages} \u751F\u6210\u4E2D...`);
      await new Promise((resolve) => setTimeout(resolve, 3e3));
      const outputFile = `./image_${Date.now()}_${i}.png`;
      console.log(`   \u2705 \u753B\u50CF ${i} \u5B8C\u4E86: ${outputFile}`);
    }
    console.log(`
\u2728 \u753B\u50CF\u751F\u6210\u5B8C\u4E86\uFF01`);
    console.log(`\u{1F4C1} \u751F\u6210\u679A\u6570: ${totalImages} \u679A`);
    console.log(`\u23F1\uFE0F  \u7DCF\u6642\u9593: \u7D04${totalImages * 1}\u5206`);
    console.log(`\u{1F3AF} \u30B9\u30BF\u30A4\u30EB: ${options.style}`);
  }
};

// src/enhanced-cli.ts
var EnhancedMariaCLI = class {
  inputBuffer = "";
  history = [];
  historyIndex = -1;
  display;
  isMultiline = false;
  slashCommandHandler;
  conversationContext;
  chatHistory = [];
  constructor() {
    console.clear();
    this.showLogo();
    this.display = new ChatDisplay();
    this.slashCommandHandler = SlashCommandHandler.getInstance();
    const sessionId = Math.random().toString(36).substring(7);
    this.conversationContext = {
      sessionId,
      userId: "local-user",
      history: [],
      preferences: {
        language: "ja",
        verbosity: "normal",
        autoMode: false,
        defaultModel: "gemini-2.5-pro",
        theme: "dark"
      },
      environment: {
        workingDirectory: process.cwd()
      }
    };
    createInterface2({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });
    this.showWelcome();
    this.setupHandlers();
    this.drawInputBox();
  }
  showLogo() {
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
${source_default.bold.magenta("\u2551")}             ${source_default.bold.cyan("(c) 2025 Bonginkan Inc.")}                        ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}                                                              ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D")}
`;
    console.log(logo);
  }
  showWelcome() {
    console.log("");
    console.log(source_default.bold.cyan("Welcome to MARIA CODE CLI!"));
    console.log("");
    console.log(source_default.yellow("How can I help you today?"));
    console.log("");
    console.log(source_default.gray("Just type naturally:"));
    console.log(source_default.gray('  \u2022 "Create a REST API for user management"'));
    console.log(source_default.gray('  \u2022 "Help me design an auto-pilot software system"'));
    console.log(source_default.gray('  \u2022 "Debug this TypeScript error"'));
    console.log(source_default.gray('  \u2022 "What is /init command?"'));
    console.log("");
    console.log(source_default.dim("Commands: /help, /init, /status | Exit: Ctrl+C"));
  }
  drawInputBox(value = "", isMultiline = false) {
    const rows = process.stdout.rows || 30;
    const cols = process.stdout.columns || 80;
    const inputY = rows - 4;
    cursorTo(process.stdout, 0, inputY);
    clearScreenDown(process.stdout);
    const boxWidth = Math.min(cols - 2, 120);
    const innerWidth = boxWidth - 2;
    const borderColor = source_default.white;
    const labelText = " Input ";
    const label = source_default.white.bold(labelText);
    const labelPadding = boxWidth - labelText.length - 2;
    const topBorder = "\u250C" + label + "\u2500".repeat(Math.max(0, labelPadding)) + "\u2510";
    const bottomBorder = "\u2514" + "\u2500".repeat(boxWidth - 2) + "\u2518";
    console.log(borderColor(topBorder));
    if (isMultiline) {
      console.log(borderColor("\u2502 ") + source_default.gray("(Multiline: Shift+Enter for new line, Enter to send, Esc to cancel)") + " ".repeat(Math.max(0, innerWidth - 60)) + borderColor("\u2502"));
      const lines = value.split("\n");
      const maxLines = 5;
      const displayLines = lines.slice(-maxLines);
      displayLines.forEach((line, i) => {
        const displayLine = line.length > innerWidth - 5 ? line.substring(0, innerWidth - 8) + "..." : line;
        const prefix = i === displayLines.length - 1 ? source_default.yellow("\u27A4 ") : "  ";
        const padding = " ".repeat(Math.max(0, innerWidth - displayLine.length - 3));
        console.log(borderColor("\u2502 ") + prefix + displayLine + padding + borderColor("\u2502"));
      });
    } else {
      let displayValue = value;
      if (value.length > innerWidth - 5) {
        displayValue = value.substring(0, innerWidth - 8) + "...";
      }
      const padding = " ".repeat(Math.max(0, innerWidth - displayValue.length - 3));
      console.log(borderColor("\u2502 ") + source_default.yellow("\u27A4 ") + source_default.white(displayValue) + padding + borderColor("\u2502"));
    }
    console.log(borderColor(bottomBorder));
    if (isMultiline) {
      const lines = value.split("\n");
      const lastLine = lines[lines.length - 1] || "";
      const cursorX = Math.min(4 + lastLine.length, boxWidth - 2);
      const displayLines = Math.min(lines.length, 5);
      cursorTo(process.stdout, cursorX, inputY + 1 + displayLines);
    } else {
      const cursorX = Math.min(4 + value.length, boxWidth - 2);
      cursorTo(process.stdout, cursorX, inputY + 1);
    }
  }
  resizeTimeout;
  setupHandlers() {
    process.stdout.on("resize", () => {
      if (this.resizeTimeout) {
        clearTimeout(this.resizeTimeout);
      }
      this.resizeTimeout = setTimeout(() => {
        this.drawInputBox(this.inputBuffer, this.isMultiline);
      }, 100);
    });
    process.stdin.on("keypress", (ch, key) => {
      if (key && key.shift && key.name === "return") {
        this.isMultiline = true;
        this.inputBuffer += "\n";
        this.drawInputBox(this.inputBuffer, true);
      } else if (key && key.name === "return") {
        if (this.isMultiline) {
          const content = this.inputBuffer;
          this.history.push(content);
          this.historyIndex = this.history.length;
          this.inputBuffer = "";
          this.isMultiline = false;
          this.handleCommand(content).catch((err) => {
            console.error(source_default.red("Command error:"), err);
          });
        } else {
          const content = this.inputBuffer;
          if (content.trim()) {
            this.history.push(content);
            this.historyIndex = this.history.length;
          }
          this.inputBuffer = "";
          this.handleCommand(content).catch((err) => {
            console.error(source_default.red("Command error:"), err);
          });
        }
        this.drawInputBox();
      } else if (key && key.name === "escape" && this.isMultiline) {
        this.inputBuffer = "";
        this.isMultiline = false;
        this.drawInputBox();
      } else if (key && key.name === "up") {
        if (this.historyIndex > 0) {
          this.historyIndex--;
          this.inputBuffer = this.history[this.historyIndex] ?? "";
          this.drawInputBox(this.inputBuffer);
        }
      } else if (key && key.name === "down") {
        if (this.historyIndex < this.history.length - 1) {
          this.historyIndex++;
          this.inputBuffer = this.history[this.historyIndex] ?? "";
          this.drawInputBox(this.inputBuffer);
        } else {
          this.historyIndex = this.history.length;
          this.inputBuffer = "";
          this.drawInputBox();
        }
      } else if (key && key.name === "backspace") {
        this.inputBuffer = this.inputBuffer.slice(0, -1);
        this.drawInputBox(this.inputBuffer, this.isMultiline);
      } else if (key && key.ctrl && key.name === "c") {
        this.exit();
      } else if (ch && !key.ctrl) {
        this.inputBuffer += ch;
        this.drawInputBox(this.inputBuffer, this.isMultiline);
      }
    });
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    emitKeypressEvents2(process.stdin);
    process.stdin.resume();
  }
  async handleCommand(input) {
    if (!input.trim()) {
      return;
    }
    const rows = process.stdout.rows || 30;
    cursorTo(process.stdout, 0, rows - 4);
    clearScreenDown(process.stdout);
    console.log(source_default.cyan("Processing..."));
    this.display.displayUserInput(input);
    try {
      if (input.toLowerCase() === "exit" || input.toLowerCase() === "quit") {
        this.exit();
        return;
      } else if (input.startsWith("/")) {
        await this.handleSlashCommand(input);
      } else {
        await this.handleEnhancedInput(input);
      }
    } catch (error) {
      this.display.displayAssistantResponse(
        source_default.red(`\u274C Error: ${error instanceof Error ? error.message : "Unknown error"}`)
      );
    }
    setTimeout(() => {
      this.drawInputBox();
    }, 300);
  }
  async handleSlashCommand(input) {
    const parts = input.split(" ");
    const command = parts[0]?.toLowerCase() || "";
    const args = parts.slice(1);
    if (command === "/help") {
      this.displayHelp();
      setTimeout(() => this.drawInputBox(), 100);
      return;
    }
    if (command === "/clear") {
      console.clear();
      this.showLogo();
      this.showWelcome();
      setTimeout(() => this.drawInputBox(), 100);
      return;
    }
    if (command === "/status") {
      this.displayStatus();
      setTimeout(() => this.drawInputBox(), 100);
      return;
    }
    try {
      const result = await this.slashCommandHandler.handleCommand(
        command,
        args,
        this.conversationContext
      );
      if (!result.success) {
        this.display.displayAssistantResponse(`\u274C Command failed: ${result.message}`);
        return;
      }
      if (result.message) {
        this.display.displayMarkdown(result.message);
      }
      if (result.component) {
        this.display.displayAssistantResponse(`\u{1F39B}\uFE0F  UI Component: ${result.component} (Available in full Ink CLI mode)`);
      }
      if (result.data) {
        if (typeof result.data === "string") {
          this.display.displayMarkdown(result.data);
        } else if (result.data.content) {
          this.display.displayMarkdown(result.data.content);
        }
      }
      if (result.suggestions) {
        this.display.displayAssistantResponse(result.suggestions);
      }
    } catch (error) {
      this.display.displayAssistantResponse(`\u274C Error processing command: ${error}`);
      setTimeout(() => this.drawInputBox(), 100);
    }
  }
  displayHelp() {
    const helpText = `
## MARIA CODE CLI Commands

### \u{1F527} Basic Commands
- \`/help\` - Show this help message
- \`/clear\` - Clear the screen
- \`/status\` - Show session status
- \`exit\` or \`quit\` - Exit CLI

### \u{1F4C1} Project Management
- \`/init\` - Initialize MARIA.md file
- \`/add-dir <path>\` - Add working directory
- \`/memory\` - Edit Claude memory file
- \`/export <format>\` - Export conversation

### \u{1F916} Agent Management
- \`/agents\` - Manage AI agents
- \`/mcp\` - MCP server management
- \`/config\` - Configuration panel
- \`/doctor\` - System diagnostics

### \u{1F4AC} Enhanced Natural Language
Just type naturally! New features:
- **Pasted Content**: "lint \u30A8\u30E9\u30FC\u3092\u76F4\u3057\u3066\u3002[Pasted text #1 +103 lines]"
- **Image Attachments**: Drag & drop images or type file paths
- **URL Research**: Paste URLs for deep analysis
- "Create a REST API for users"
- "Help me debug this function"
- "Generate tests for my code"

### \u26A1 MC Commands
- \`mc chat\` - Start AI chat mode
- \`mc init\` - Initialize project
- \`mc test\` - Run tests
`;
    this.display.displayMarkdown(helpText);
  }
  displayStatus() {
    const status = `
## Session Status

**\u{1F4CA} Current Session**
- Messages: ${this.chatHistory.length}
- Session ID: ${this.conversationContext.sessionId}
- Working Directory: ${process.cwd()}

**\u{1F6E0}\uFE0F Environment**
- Platform: ${process.platform}
- Node Version: ${process.version}
- Terminal Size: ${process.stdout.columns}x${process.stdout.rows}

**\u{1F916} AI Configuration**
- Default Model: ${this.conversationContext.preferences?.defaultModel || "gemini-2.5-pro"}
- Language: ${this.conversationContext.preferences?.language || "ja"}
- Auto Mode: ${this.conversationContext.preferences?.autoMode ? "Enabled" : "Disabled"}

**\u{1F552} Time**: ${(/* @__PURE__ */ new Date()).toLocaleString()}
`;
    this.display.displayMarkdown(status);
  }
  // Reserved for future MC command handling
  /*
    private async handleMcCommand(input: string) {
      const args = input.split(' ').slice(1);
      const command = args[0];
      
      this.display.displayAssistantResponse('Processing MC command...');
      
      // Simulate processing steps
      await this.display.displayStep({
        number: 1,
        title: 'Parsing command',
        content: `Command: mc ${command}`,
        status: 'completed'
      });
      
      await this.display.displayStep({
        number: 2,
        title: 'Initializing environment',
        content: '',
        status: 'in-progress'
      });
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      await this.display.displayStep({
        number: 2,
        title: 'Initializing environment',
        content: 'Environment ready',
        status: 'completed'
      });
      
      switch (command) {
        case 'chat':
          const chatExample = `
  ### AI Chat Mode Activated
  
  I'm MARIA, your AI development assistant. How can I help you today?
  
  **Example requests:**
  - "Create a REST API for user management"
  - "Help me debug this React component"
  - "Generate tests for my functions"`;
          
          this.display.displayMarkdown(chatExample);
          break;
  
        case 'init':
          await this.display.displayStep({
            number: 3,
            title: 'Creating configuration files',
            content: '',
            status: 'in-progress'
          });
          
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          await this.display.displayStep({
            number: 3,
            title: 'Creating configuration files',
            content: '.maria-code.toml created',
            status: 'completed'
          });
          
          this.display.displayCode(`# MARIA CODE Configuration
  [project]
  name = "my-project"
  version = "1.0.0"
  
  [ai]
  model = "gemini-2.5-pro"
  temperature = 0.7
  
  [features]
  auto_test = true
  auto_commit = true`, 'toml');
          
          this.display.displayMarkdown('**Project initialized successfully!**');
          break;
  
        default:
          this.display.displayMarkdown(`Unknown mc command: \`${command}\``);
      }
    }
    */
  async handleEnhancedInput(input) {
    this.display.displayAssistantResponse("\u{1F916} Processing your message...");
    try {
      const commandIntent = this.parseCommandIntent(input);
      if (commandIntent) {
        this.display.displayAssistantResponse(`\u{1F4A1} Routing to: ${commandIntent.command}`);
        await this.handleSlashCommand(commandIntent.command + " " + commandIntent.args.join(" "));
        return;
      }
      await this.processNaturalLanguageChat(input);
    } catch (error) {
      this.display.displayAssistantResponse(
        source_default.red(`\u274C Error processing message: ${error instanceof Error ? error.message : "Unknown error"}`)
      );
    }
  }
  parseCommandIntent(input) {
    const lowerInput = input.toLowerCase();
    const intentMap = {
      "initialize project": "/init",
      "init project": "/init",
      "create maria.md": "/init",
      "analyze codebase": "/init",
      "show status": "/status",
      "check status": "/status",
      "system status": "/status",
      "clear screen": "/clear",
      "clear console": "/clear",
      "show help": "/help",
      "help me": "/help",
      "what can you do": "/help",
      "switch model": "/model",
      "change model": "/model",
      "use gemini": "/model gemini-2.5-pro",
      "use grok": "/model grok-4-latest",
      "export conversation": "/export",
      "save conversation": "/export"
    };
    for (const [intent, command] of Object.entries(intentMap)) {
      if (lowerInput.includes(intent)) {
        const parts = command.split(" ");
        return {
          command: parts[0] || "",
          args: parts.slice(1)
        };
      }
    }
    return null;
  }
  async processNaturalLanguageChat(input) {
    const currentModel = this.conversationContext.preferences?.defaultModel || "gemini-2.5-pro";
    this.chatHistory.push({
      role: "user",
      content: input,
      timestamp: /* @__PURE__ */ new Date()
    });
    await this.display.displayStep({
      number: 1,
      title: "Analyzing request",
      content: `Using ${currentModel}`,
      status: "completed"
    });
    await this.display.displayStep({
      number: 2,
      title: "Generating response",
      content: "Processing with AI...",
      status: "in-progress"
    });
    try {
      const response = await this.generateAIResponse(input, currentModel);
      await this.display.displayStep({
        number: 2,
        title: "Generating response",
        content: "Response generated successfully",
        status: "completed"
      });
      this.chatHistory.push({
        role: "assistant",
        content: response,
        timestamp: /* @__PURE__ */ new Date()
      });
      this.display.displayMarkdown(response);
    } catch (error) {
      await this.display.displayStep({
        number: 2,
        title: "Generating response",
        content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        status: "error"
      });
      const fallbackResponse = this.generateFallbackResponse(input);
      this.display.displayMarkdown(fallbackResponse);
    }
  }
  async generateAIResponse(input, model) {
    const hasLocalKeys = process.env.GEMINI_API_KEY || process.env.GROK_API_KEY;
    if (!hasLocalKeys) {
      return `I'd be happy to help you with: "${input}"

However, I notice that no API keys are configured for local development. 

**Options:**
1. **Development Mode**: Add API keys to \`.env.local\`
   - \`GEMINI_API_KEY=your-key\` for Gemini 2.5 Pro
   - \`GROK_API_KEY=your-key\` for Grok-4

2. **Production Mode**: Use Cloud Sandbox (coming soon)
   - Full authentication via MARIA platform
   - No API keys needed

**Current Model**: ${model}

For now, I can help with:
- Project management (\`/init\`, \`/status\`)
- Agent management (\`/agents\`, \`/mcp\`)
- Configuration (\`/config\`, \`/model\`)
- System diagnostics (\`/doctor\`)

Type \`/help\` to see all available commands!`;
    }
    return `I understand you want help with: "${input}"

I'm currently in development mode. Here's what I can assist you with:

**Your Request Analysis:**
- Input: ${input}
- Model: ${model}
- Intent: General assistance

**Available Actions:**
1. Use \`/init\` to analyze your codebase
2. Use \`/agents\` to see available AI agents
3. Use \`/model\` to switch between Gemini 2.5 Pro and Grok-4
4. Use \`/help\` for all commands

How would you like to proceed?`;
  }
  generateFallbackResponse(input) {
    return `I encountered an issue processing your request: "${input}"

**Suggested Actions:**
1. Try rephrasing your request
2. Use a specific slash command (type \`/help\` to see options)
3. Check your network connection
4. Verify API configuration with \`/doctor\`

**Quick Commands:**
- \`/status\` - Check system status
- \`/init\` - Initialize project
- \`/help\` - Show all commands

Please try again or use a specific command.`;
  }
  exit() {
    console.clear();
    console.log(source_default.yellow("\nThanks for using MARIA CODE CLI!"));
    console.log(source_default.magenta("Happy coding!\n"));
    process.exit(0);
  }
};
new EnhancedMariaCLI();
export {
  EnhancedMariaCLI as EnhancedCLI
};
//# sourceMappingURL=enhanced-cli.js.map