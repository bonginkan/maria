import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'toml';
import { homedir } from 'os';

export interface MariaConfig {
  user?: {
    email?: string;
    plan?: 'free' | 'pro' | 'max';
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
    defaultMode?: 'chat' | 'command' | 'research' | 'creative';
    theme?: 'auto' | 'light' | 'dark';
    verbosity?: 'normal' | 'detailed' | 'quiet';
    autoSave?: boolean;
    historySize?: number;
    vimMode?: boolean;
    keyBindings?: Record<string, string>;
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
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
  };
  logging?: {
    level?: string;
  };
  // Top-level convenience properties for backward compatibility
  defaultMode?: 'chat' | 'command' | 'research' | 'creative';
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
  type: 'built-in' | 'custom';
  status: 'active' | 'inactive';
  capabilities: string[];
  config?: Record<string, unknown>;
}

export interface MCPServer {
  id: string;
  name: string;
  description: string;
  command: string;
  args: string[];
  status: 'running' | 'stopped' | 'error' | 'unknown';
  capabilities: string[];
  configPath?: string;
  type: 'built-in' | 'community' | 'custom';
}

const CONFIG_FILE = '.maria-code.toml';
const GLOBAL_CONFIG_PATH = join(homedir(), '.maria-code', 'config.toml');

/**
 * Load configuration from .maria-code.toml
 * Checks current directory first, then parent directories, then global config
 */
export function loadConfig(): MariaConfig {
  // Check current directory and parent directories
  let currentDir = process.cwd();
  while (currentDir !== '/') {
    const configPath = join(currentDir, CONFIG_FILE);
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf-8');
        return parse(content) as MariaConfig;
      } catch {
        // Intentionally empty - continue if parsing fails
      }
    }
    const parentDir = join(currentDir, '..');
    if (parentDir === currentDir) {break;}
    currentDir = parentDir;
  }

  // Check global config
  if (existsSync(GLOBAL_CONFIG_PATH)) {
    try {
      const content = readFileSync(GLOBAL_CONFIG_PATH, 'utf-8');
      return parse(content) as MariaConfig;
    } catch {
      // Ignore errors and return default config
    }
  }

  // Return default config with GPT-5 Mini as default model
  return {
    defaultModel: 'gpt-5-mini-2025-08-07',
    defaultMode: 'chat',
    ai: {
      defaultModel: 'gpt-5-mini-2025-08-07',
      preferredModel: 'gpt-5-mini-2025-08-07',
    },
    cli: {
      defaultMode: 'chat',
      theme: 'auto',
      verbosity: 'normal',
      autoSave: true,
      historySize: 100,
      vimMode: false,
    },
  };
}

export async function readConfig(): Promise<MariaConfig> {
  const config = loadConfig();
  // Set default API URL if not configured
  if (!config.apiUrl) {
    config['apiUrl'] = process.env['MARIA_API_URL'] || 'http://localhost:8080';
  }
  return config;
}

export async function writeConfig(config: MariaConfig, path?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      saveConfig(config, path);
      resolve();
    } catch (error: unknown) {
      reject(error);
    }
  });
}

/**
 * Save configuration to .maria-code.toml in current directory
 */
export function saveConfig(config: MariaConfig, path?: string): void {
  const configPath = path || join(process.cwd(), CONFIG_FILE);
  // Create TOML format manually
  const lines: string[] = [];

  if (config.user) {
    lines.push('[user]');
    if (config.user.email) {
      lines.push(`email = "${config.user.email}"`);
    }
    if (config.user.plan) {
      lines.push(`plan = "${config.user.plan}"`);
    }
    if (config.user.apiKey) {
      lines.push(`apiKey = "${config.user.apiKey}"`);
    }
    lines.push('');
  }

  if (config.project) {
    lines.push('[project]');
    if (config.project.name) {
      lines.push(`name = "${config.project.name}"`);
    }
    if (config.project.type) {
      lines.push(`type = "${config.project.type}"`);
    }
    if (config.project.description) {
      lines.push(`description = "${config.project.description}"`);
    }
    if (config.project.packageManager) {
      lines.push(`packageManager = "${config.project.packageManager}"`);
    }
    if (config.project.id) {
      lines.push(`id = "${config.project.id}"`);
    }
    if (config.project.workingDirectories && config.project.workingDirectories.length > 0) {
      lines.push(
        `workingDirectories = [${config.project.workingDirectories.map((d) => `"${d}"`).join(', ')}]`,
      );
    }
    if (config.project.memoryFiles && config.project.memoryFiles.length > 0) {
      lines.push(`memoryFiles = [${config.project.memoryFiles.map((f) => `"${f}"`).join(', ')}]`);
    }
    lines.push('');
  }

  if (config.neo4j) {
    lines.push('[neo4j]');
    if (config.neo4j.instanceId) {
      lines.push(`instanceId = "${config.neo4j.instanceId}"`);
    }
    if (config.neo4j.jwt_secret_name) {
      lines.push(`jwt_secret_name = "${config.neo4j.jwt_secret_name}"`);
    }
    lines.push('');
  }

  if (config.ai) {
    lines.push('[ai]');
    if (config.ai.preferredModel) {
      lines.push(`preferredModel = "${config.ai.preferredModel}"`);
    }
    if (config.ai.defaultModel) {
      lines.push(`defaultModel = "${config.ai.defaultModel}"`);
    }
    if (config.ai.provider) {
      lines.push(`provider = "${config.ai.provider}"`);
    }
    if (config.ai.apiKey) {
      lines.push(`apiKey = "${config.ai.apiKey}"`);
    }
    lines.push('');
  }

  if (config.cli) {
    lines.push('[cli]');
    if (config.cli.defaultMode) {
      lines.push(`defaultMode = "${config.cli.defaultMode}"`);
    }
    if (config.cli.theme) {
      lines.push(`theme = "${config.cli.theme}"`);
    }
    if (config.cli.verbosity) {
      lines.push(`verbosity = "${config.cli.verbosity}"`);
    }
    if (config.cli.autoSave !== undefined) {
      lines.push(`autoSave = ${config.cli.autoSave}`);
    }
    if (config.cli.historySize) {
      lines.push(`historySize = ${config.cli.historySize}`);
    }
    lines.push('');
  }

  if (config.sandbox) {
    lines.push('[sandbox]');
    if (config.sandbox.enabled !== undefined) {
      lines.push(`enabled = ${config.sandbox.enabled}`);
    }
    if (config.sandbox.region) {
      lines.push(`region = "${config.sandbox.region}"`);
    }
    if (config.sandbox.instanceType) {
      lines.push(`instanceType = "${config.sandbox.instanceType}"`);
    }
    lines.push('');
  }

  if (config.permissions) {
    lines.push('[permissions]');
    if (config.permissions.fileAccess !== undefined) {
      lines.push(`fileAccess = ${config.permissions.fileAccess}`);
    }
    if (config.permissions.networkAccess !== undefined) {
      lines.push(`networkAccess = ${config.permissions.networkAccess}`);
    }
    if (config.permissions.systemCommands !== undefined) {
      lines.push(`systemCommands = ${config.permissions.systemCommands}`);
    }
    lines.push('');
  }

  if (config.hooks) {
    lines.push('[hooks]');
    if (config.hooks.onStart) {
      lines.push(`onStart = "${config.hooks.onStart}"`);
    }
    if (config.hooks.onExit) {
      lines.push(`onExit = "${config.hooks.onExit}"`);
    }
    if (config.hooks.onError) {
      lines.push(`onError = "${config.hooks.onError}"`);
    }
    lines.push('');
  }

  if (config.agents) {
    lines.push('[agents]');
    if (config.agents.enabled && config.agents.enabled.length > 0) {
      lines.push(`enabled = [${config.agents.enabled.map((id) => `"${id}"`).join(', ')}]`);
    }
    lines.push('');

    // Custom agents as separate sections
    if (config.agents.custom && config.agents.custom.length > 0) {
      config.agents.custom.forEach((agent) => {
        lines.push(`[[agents.custom]]`);
        lines.push(`id = "${agent.id}"`);
        lines.push(`name = "${agent.name}"`);
        lines.push(`description = "${agent.description}"`);
        lines.push(`type = "${agent.type}"`);
        lines.push(`status = "${agent.status}"`);
        lines.push(`capabilities = [${agent.capabilities.map((c) => `"${c}"`).join(', ')}]`);
        lines.push('');
      });
    }
  }

  if (config.mcp) {
    lines.push('[mcp]');
    if (config.mcp.enabled !== undefined) {
      lines.push(`enabled = ${config.mcp.enabled}`);
    }
    if (config.mcp.autoStart !== undefined) {
      lines.push(`autoStart = ${config.mcp.autoStart}`);
    }
    if (config.mcp.timeout) {
      lines.push(`timeout = ${config.mcp.timeout}`);
    }
    if (config.mcp.logLevel) {
      lines.push(`logLevel = "${config.mcp.logLevel}"`);
    }
    lines.push('');

    // MCP servers as separate sections
    if (config.mcp.servers && config.mcp.servers.length > 0) {
      config.mcp.servers.forEach((server) => {
        lines.push(`[[mcp.servers]]`);
        lines.push(`id = "${server.id}"`);
        lines.push(`name = "${server.name}"`);
        lines.push(`description = "${server.description}"`);
        lines.push(`command = "${server.command}"`);
        lines.push(`args = [${server.args.map((arg) => `"${arg}"`).join(', ')}]`);
        lines.push(`status = "${server.status}"`);
        lines.push(`capabilities = [${server.capabilities.map((c) => `"${c}"`).join(', ')}]`);
        if (server.configPath) {
          lines.push(`configPath = "${server.configPath}"`);
        }
        lines.push(`type = "${server.type}"`);
        lines.push('');
      });
    }
  }

  if (config.logging) {
    lines.push('[logging]');
    if (config.logging.level) {
      lines.push(`level = "${config.logging.level}"`);
    }
    lines.push('');
  }

  if (config.datastore) {
    lines.push('[datastore]');
    if (config.datastore.embeddings_path) {
      lines.push(`embeddings_path = "${config.datastore.embeddings_path}"`);
    }
    lines.push('');
  }

  if (config.gcp) {
    lines.push('[gcp]');
    if (config.gcp.project) {
      lines.push(`project = "${config.gcp.project}"`);
    }
    if (config.gcp.region) {
      lines.push(`region = "${config.gcp.region}"`);
    }
    lines.push('');
  }

  if (config.apiUrl) {
    lines.push(`apiUrl = "${config.apiUrl}"`);
  }

  if (config.defaultMode) {
    lines.push(`defaultMode = "${config.defaultMode}"`);
  }

  if (config.defaultModel) {
    lines.push(`defaultModel = "${config.defaultModel}"`);
  }

  const content = lines.join('\n');
  writeFileSync(configPath, content, 'utf-8');
}

/**
 * Initialize a new .maria-code.toml with default values
 */
export function initConfig(): void {
  const defaultConfig: MariaConfig = {
    user: {
      email: process.env['USER'] ? `${process.env['USER']}@example.com` : 'user@example.com',
    },
    neo4j: {
      instanceId: '4234c1a0',
      database: 'neo4j',
    },
    ai: {
      preferredModel: 'gpt-5-mini-2025-08-07',
    },
  };

  const configPath = join(process.cwd(), CONFIG_FILE);
  if (existsSync(configPath)) {
    throw new Error(`Configuration file ${CONFIG_FILE} already exists`);
  }

  saveConfig(defaultConfig, configPath);
}
