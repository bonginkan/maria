import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { parse } from "toml";
import { homedir } from "os";

export interface MariaConfig {
  user?: {
    email?: string;
    plan?: "free" | "pro" | "max";
    apiKey?: string;
  };
  project?: {
    name?: string;
    type?: string;
    description?: string;
    packageManager?: string;
    id?: string;
    workingDirectories?: string[];
    memoryFiles?: string[];
  };
  neo4j?: {
    instanceId?: string;
    database?: string;
    jwt_secret_name?: string;
  };
  ai?: {
    preferredModel?: string;
    defaultModel?: string;
    provider?: string;
    apiKey?: string;
    providerConfig?: Record<string, unknown>;
  };
  datastore?: {
    embeddings_path?: string;
  };
  gcp?: {
    project?: string;
    region?: string;
  };
  cli?: {
    defaultMode?: "chat" | "command" | "research" | "creative";
    theme?: "auto" | "light" | "dark";
    verbosity?: "normal" | "detailed" | "quiet";
    autoSave?: boolean;
    historySize?: number;
    vimMode?: boolean;
    keyBindings?: Record<string, string>;
    // 🚀 Streaming Optimization Settings (NEW)
    streaming?: {
      enabled?: boolean;
      showDashboard?: boolean;
      maxConcurrency?: number;
      throttleMs?: number;
    };
  };
  sandbox?: {
    enabled?: boolean;
    region?: string;
    instanceType?: string;
  };
  permissions?: {
    fileAccess?: boolean;
    networkAccess?: boolean;
    systemCommands?: boolean;
  };
  hooks?: {
    onStart?: string;
    onExit?: string;
    onError?: string;
  };
  agents?: {
    custom?: Agent[];
    enabled?: string[];
  };
  mcp?: {
    enabled?: boolean;
    servers?: MCPServer[];
    autoStart?: boolean;
    timeout?: number;
    logLevel?: "debug" | "info" | "warn" | "_error";
  };
  logging?: {
    level?: string;
  };
  // Top-level convenience properties for backward compatibility
  defaultMode?: "chat" | "command" | "research" | "creative";
  defaultModel?: string;
  apiUrl?: string;

  // Command aliases
  aliases?: Array<{
    alias: string;
    command: string;
    description?: string;
    args?: string[];
    createdAt: string;
    usageCount: number;
  }>;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  type: "built-in" | "custom";
  status: "active" | "inactive";
  capabilities: string[];
  _config?: Record<string, unknown>;
}

export interface MCPServer {
  id: string;
  name: string;
  description: string;
  command: string;
  args: string[];
  status: "running" | "stopped" | "_error" | "unknown";
  capabilities: string[];
  _configPath?: string;
  type: "built-in" | "community" | "custom";
}

const _CONFIG_FILE = ".maria-code.toml";
const _GLOBAL_CONFIG_PATH = join(homedir(), ".maria-code", "_config.toml");

/**
 * Load configuration from .maria-code.toml
 * Checks current directory first, then parent directories, then global _config
 */
export function loadConfig(): MariaConfig {
  // Check current directory and parent directories
  let currentDir = process.cwd();
  while (currentDir !== "/") {
    const _configPath = join(currentDir, _CONFIG_FILE);
    if (existsSync(_configPath)) {
      try {
        const _content = readFileSync(_configPath, "utf-8");
        return parse(_content) as MariaConfig;
      } catch {
        // Intentionally empty - continue if parsing fails
      }
    }
    const _parentDir = join(currentDir, "..");
    if (_parentDir === currentDir) {
      break;
    }
    currentDir = _parentDir;
  }

  // Check global _config
  if (existsSync(_GLOBAL_CONFIG_PATH)) {
    try {
      const _content = readFileSync(_GLOBAL_CONFIG_PATH, "utf-8");
      return parse(_content) as MariaConfig;
    } catch {
      // Ignore errors and return default _config
    }
  }

  // Return default _config with GPT-5 Mini as default model
  return {
    defaultModel: "gpt-5-mini-2025-08-07",
    defaultMode: "chat",
    ai: {
      defaultModel: "gpt-5-mini-2025-08-07",
      preferredModel: "gpt-5-mini-2025-08-07",
    },
    cli: {
      defaultMode: "chat",
      theme: "auto",
      verbosity: "normal",
      autoSave: true,
      historySize: 100,
      vimMode: false,
      // 🚀 Enable Streaming Optimization by Default
      streaming: {
        enabled: true,
        showDashboard: false,
        maxConcurrency: 3,
        throttleMs: 50, // 20 FPS smooth output
      },
    },
  };
}

export async function readConfig(): Promise<MariaConfig> {
  const _config = loadConfig();
  // Set default API URL if not configured
  if (!_config.apiUrl) {
    _config["apiUrl"] = process.env["MARIA_API_URL"] || "http://localhost:8080";
  }
  return _config;
}

export async function writeConfig(
  _config: MariaConfig,
  _path?: string,
): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    try {
      saveConfig(_config, _path);
      resolvePromise();
    } catch (_error: unknown) {
      reject(_error);
    }
  });
}

/**
 * Save configuration to .maria-code.toml in current directory
 */
export function saveConfig(_config: MariaConfig, _path?: string): void {
  const _configPath = _path || join(process.cwd(), _CONFIG_FILE);
  // Create TOML format manually
  const lines: string[] = [];

  if (_config.user) {
    lines.push("[user]");
    if (_config.user.email) {
      lines.push(`email = "${_config.user.email}"`);
    }
    if (_config.user.plan) {
      lines.push(`plan = "${_config.user.plan}"`);
    }
    if (_config.user.apiKey) {
      lines.push(`apiKey = "${_config.user.apiKey}"`);
    }
    lines.push("");
  }

  if (_config.project) {
    lines.push("[project]");
    if (_config.project.name) {
      lines.push(`name = "${_config.project.name}"`);
    }
    if (_config.project.type) {
      lines.push(`type = "${_config.project.type}"`);
    }
    if (_config.project.description) {
      lines.push(`description = "${_config.project.description}"`);
    }
    if (_config.project.packageManager) {
      lines.push(`packageManager = "${_config.project.packageManager}"`);
    }
    if (_config.project.id) {
      lines.push(`id = "${_config.project.id}"`);
    }
    if (
      _config.project.workingDirectories &&
      _config.project.workingDirectories.length > 0
    ) {
      lines.push(
        `workingDirectories = [${_config.project.workingDirectories.map((d) => `"${d}"`).join(", ")}]`,
      );
    }
    if (_config.project.memoryFiles && _config.project.memoryFiles.length > 0) {
      lines.push(
        `memoryFiles = [${_config.project.memoryFiles.map((f) => `"${f}"`).join(", ")}]`,
      );
    }
    lines.push("");
  }

  if (_config.neo4j) {
    lines.push("[neo4j]");
    if (_config.neo4j.instanceId) {
      lines.push(`instanceId = "${_config.neo4j.instanceId}"`);
    }
    if (_config.neo4j.jwt_secret_name) {
      lines.push(`jwt_secret_name = "${_config.neo4j.jwt_secret_name}"`);
    }
    lines.push("");
  }

  if (_config.ai) {
    lines.push("[ai]");
    if (_config.ai.preferredModel) {
      lines.push(`preferredModel = "${_config.ai.preferredModel}"`);
    }
    if (_config.ai.defaultModel) {
      lines.push(`defaultModel = "${_config.ai.defaultModel}"`);
    }
    if (_config.ai.provider) {
      lines.push(`provider = "${_config.ai.provider}"`);
    }
    if (_config.ai.apiKey) {
      lines.push(`apiKey = "${_config.ai.apiKey}"`);
    }
    lines.push("");
  }

  if (_config.cli) {
    lines.push("[cli]");
    if (_config.cli.defaultMode) {
      lines.push(`defaultMode = "${_config.cli.defaultMode}"`);
    }
    if (_config.cli.theme) {
      lines.push(`theme = "${_config.cli.theme}"`);
    }
    if (_config.cli.verbosity) {
      lines.push(`verbosity = "${_config.cli.verbosity}"`);
    }
    if (_config.cli.autoSave !== undefined) {
      lines.push(`autoSave = ${_config.cli.autoSave}`);
    }
    if (_config.cli.historySize) {
      lines.push(`historySize = ${_config.cli.historySize}`);
    }
    lines.push("");
  }

  if (_config.sandbox) {
    lines.push("[sandbox]");
    if (_config.sandbox.enabled !== undefined) {
      lines.push(`enabled = ${_config.sandbox.enabled}`);
    }
    if (_config.sandbox.region) {
      lines.push(`region = "${_config.sandbox.region}"`);
    }
    if (_config.sandbox.instanceType) {
      lines.push(`instanceType = "${_config.sandbox.instanceType}"`);
    }
    lines.push("");
  }

  if (_config.permissions) {
    lines.push("[permissions]");
    if (_config.permissions.fileAccess !== undefined) {
      lines.push(`fileAccess = ${_config.permissions.fileAccess}`);
    }
    if (_config.permissions.networkAccess !== undefined) {
      lines.push(`networkAccess = ${_config.permissions.networkAccess}`);
    }
    if (_config.permissions.systemCommands !== undefined) {
      lines.push(`systemCommands = ${_config.permissions.systemCommands}`);
    }
    lines.push("");
  }

  if (_config.hooks) {
    lines.push("[hooks]");
    if (_config.hooks.onStart) {
      lines.push(`onStart = "${_config.hooks.onStart}"`);
    }
    if (_config.hooks.onExit) {
      lines.push(`onExit = "${_config.hooks.onExit}"`);
    }
    if (_config.hooks.onError) {
      lines.push(`onError = "${_config.hooks.onError}"`);
    }
    lines.push("");
  }

  if (_config.agents) {
    lines.push("[agents]");
    if (_config.agents.enabled && _config.agents.enabled.length > 0) {
      lines.push(
        `enabled = [${_config.agents.enabled.map((id) => `"${id}"`).join(", ")}]`,
      );
    }
    lines.push("");

    // Custom agents as separate sections
    if (_config.agents.custom && _config.agents.custom.length > 0) {
      _config.agents.custom.forEach((agent) => {
        lines.push(`[[agents.custom]]`);
        lines.push(`id = "${agent.id}"`);
        lines.push(`name = "${agent.name}"`);
        lines.push(`description = "${agent.description}"`);
        lines.push(`type = "${agent.type}"`);
        lines.push(`status = "${agent.status}"`);
        lines.push(
          `capabilities = [${agent.capabilities.map((c) => `"${c}"`).join(", ")}]`,
        );
        lines.push("");
      });
    }
  }

  if (_config.mcp) {
    lines.push("[mcp]");
    if (_config.mcp.enabled !== undefined) {
      lines.push(`enabled = ${_config.mcp.enabled}`);
    }
    if (_config.mcp.autoStart !== undefined) {
      lines.push(`autoStart = ${_config.mcp.autoStart}`);
    }
    if (_config.mcp.timeout) {
      lines.push(`timeout = ${_config.mcp.timeout}`);
    }
    if (_config.mcp.logLevel) {
      lines.push(`logLevel = "${_config.mcp.logLevel}"`);
    }
    lines.push("");

    // MCP servers as separate sections
    if (_config.mcp.servers && _config.mcp.servers.length > 0) {
      _config.mcp.servers.forEach((server) => {
        lines.push(`[[mcp.servers]]`);
        lines.push(`id = "${server.id}"`);
        lines.push(`name = "${server.name}"`);
        lines.push(`description = "${server.description}"`);
        lines.push(`command = "${server.command}"`);
        lines.push(
          `args = [${server.args.map((arg) => `"${arg}"`).join(", ")}]`,
        );
        lines.push(`status = "${server.status}"`);
        lines.push(
          `capabilities = [${server.capabilities.map((c) => `"${c}"`).join(", ")}]`,
        );
        if (server._configPath) {
          lines.push(`_configPath = "${server._configPath}"`);
        }
        lines.push(`type = "${server.type}"`);
        lines.push("");
      });
    }
  }

  if (_config.logging) {
    lines.push("[logging]");
    if (_config.logging.level) {
      lines.push(`level = "${_config.logging.level}"`);
    }
    lines.push("");
  }

  if (_config.datastore) {
    lines.push("[datastore]");
    if (_config.datastore.embeddings_path) {
      lines.push(`embeddings_path = "${_config.datastore.embeddings_path}"`);
    }
    lines.push("");
  }

  if (_config.gcp) {
    lines.push("[gcp]");
    if (_config.gcp.project) {
      lines.push(`project = "${_config.gcp.project}"`);
    }
    if (_config.gcp.region) {
      lines.push(`region = "${_config.gcp.region}"`);
    }
    lines.push("");
  }

  if (_config.apiUrl) {
    lines.push(`apiUrl = "${_config.apiUrl}"`);
  }

  if (_config.defaultMode) {
    lines.push(`defaultMode = "${_config.defaultMode}"`);
  }

  if (_config.defaultModel) {
    lines.push(`defaultModel = "${_config.defaultModel}"`);
  }

  const _content = lines.join("\n");
  writeFileSync(_configPath, _content, "utf-8");
}

/**
 * Initialize a new .maria-code.toml with default values
 */
export function initConfig(): void {
  const defaultConfig: MariaConfig = {
    user: {
      email: process.env["USER"]
        ? `${process.env["USER"]}@example.com`
        : "user@example.com",
    },
    neo4j: {
      instanceId: "4234c1a0",
      database: "neo4j",
    },
    ai: {
      preferredModel: "gpt-5-mini-2025-08-07",
    },
  };

  const _configPath = join(process.cwd(), _CONFIG_FILE);
  if (existsSync(_configPath)) {
    throw new Error(`Configuration file ${_CONFIG_FILE} already exists`);
  }

  saveConfig(defaultConfig, _configPath);
}
