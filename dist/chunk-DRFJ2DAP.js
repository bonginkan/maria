// src/utils/config.ts
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { parse } from "toml";
import { homedir } from "os";
var CONFIG_FILE = ".maria-code.toml";
var GLOBAL_CONFIG_PATH = join(homedir(), ".maria-code", "config.toml");
function loadConfig() {
  let currentDir = process.cwd();
  while (currentDir !== "/") {
    const configPath = join(currentDir, CONFIG_FILE);
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, "utf-8");
        return parse(content);
      } catch {
      }
    }
    const parentDir = join(currentDir, "..");
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }
  if (existsSync(GLOBAL_CONFIG_PATH)) {
    try {
      const content = readFileSync(GLOBAL_CONFIG_PATH, "utf-8");
      return parse(content);
    } catch {
    }
  }
  return {
    defaultModel: "gemini-2.5-pro",
    defaultMode: "chat",
    ai: {
      defaultModel: "gemini-2.5-pro",
      preferredModel: "gemini-2.5-pro"
    },
    cli: {
      defaultMode: "chat",
      theme: "auto",
      verbosity: "normal",
      autoSave: true,
      historySize: 100,
      vimMode: false
    }
  };
}
async function readConfig() {
  const config = loadConfig();
  if (!config.apiUrl) {
    config.apiUrl = process.env.MARIA_API_URL || "http://localhost:8080";
  }
  return config;
}
async function writeConfig(config, path) {
  return new Promise((resolve, reject) => {
    try {
      saveConfig(config, path);
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}
function saveConfig(config, path) {
  const configPath = path || join(process.cwd(), CONFIG_FILE);
  const lines = [];
  if (config.user) {
    lines.push("[user]");
    if (config.user.email) {
      lines.push(`email = "${config.user.email}"`);
    }
    if (config.user.plan) {
      lines.push(`plan = "${config.user.plan}"`);
    }
    if (config.user.apiKey) {
      lines.push(`apiKey = "${config.user.apiKey}"`);
    }
    lines.push("");
  }
  if (config.project) {
    lines.push("[project]");
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
      lines.push(`workingDirectories = [${config.project.workingDirectories.map((d) => `"${d}"`).join(", ")}]`);
    }
    if (config.project.memoryFiles && config.project.memoryFiles.length > 0) {
      lines.push(`memoryFiles = [${config.project.memoryFiles.map((f) => `"${f}"`).join(", ")}]`);
    }
    lines.push("");
  }
  if (config.neo4j) {
    lines.push("[neo4j]");
    if (config.neo4j.instanceId) {
      lines.push(`instanceId = "${config.neo4j.instanceId}"`);
    }
    if (config.neo4j.jwt_secret_name) {
      lines.push(`jwt_secret_name = "${config.neo4j.jwt_secret_name}"`);
    }
    lines.push("");
  }
  if (config.ai) {
    lines.push("[ai]");
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
    lines.push("");
  }
  if (config.cli) {
    lines.push("[cli]");
    if (config.cli.defaultMode) {
      lines.push(`defaultMode = "${config.cli.defaultMode}"`);
    }
    if (config.cli.theme) {
      lines.push(`theme = "${config.cli.theme}"`);
    }
    if (config.cli.verbosity) {
      lines.push(`verbosity = "${config.cli.verbosity}"`);
    }
    if (config.cli.autoSave !== void 0) {
      lines.push(`autoSave = ${config.cli.autoSave}`);
    }
    if (config.cli.historySize) {
      lines.push(`historySize = ${config.cli.historySize}`);
    }
    lines.push("");
  }
  if (config.sandbox) {
    lines.push("[sandbox]");
    if (config.sandbox.enabled !== void 0) {
      lines.push(`enabled = ${config.sandbox.enabled}`);
    }
    if (config.sandbox.region) {
      lines.push(`region = "${config.sandbox.region}"`);
    }
    if (config.sandbox.instanceType) {
      lines.push(`instanceType = "${config.sandbox.instanceType}"`);
    }
    lines.push("");
  }
  if (config.permissions) {
    lines.push("[permissions]");
    if (config.permissions.fileAccess !== void 0) {
      lines.push(`fileAccess = ${config.permissions.fileAccess}`);
    }
    if (config.permissions.networkAccess !== void 0) {
      lines.push(`networkAccess = ${config.permissions.networkAccess}`);
    }
    if (config.permissions.systemCommands !== void 0) {
      lines.push(`systemCommands = ${config.permissions.systemCommands}`);
    }
    lines.push("");
  }
  if (config.hooks) {
    lines.push("[hooks]");
    if (config.hooks.onStart) {
      lines.push(`onStart = "${config.hooks.onStart}"`);
    }
    if (config.hooks.onExit) {
      lines.push(`onExit = "${config.hooks.onExit}"`);
    }
    if (config.hooks.onError) {
      lines.push(`onError = "${config.hooks.onError}"`);
    }
    lines.push("");
  }
  if (config.agents) {
    lines.push("[agents]");
    if (config.agents.enabled && config.agents.enabled.length > 0) {
      lines.push(`enabled = [${config.agents.enabled.map((id) => `"${id}"`).join(", ")}]`);
    }
    lines.push("");
    if (config.agents.custom && config.agents.custom.length > 0) {
      config.agents.custom.forEach((agent) => {
        lines.push(`[[agents.custom]]`);
        lines.push(`id = "${agent.id}"`);
        lines.push(`name = "${agent.name}"`);
        lines.push(`description = "${agent.description}"`);
        lines.push(`type = "${agent.type}"`);
        lines.push(`status = "${agent.status}"`);
        lines.push(`capabilities = [${agent.capabilities.map((c) => `"${c}"`).join(", ")}]`);
        lines.push("");
      });
    }
  }
  if (config.mcp) {
    lines.push("[mcp]");
    if (config.mcp.enabled !== void 0) {
      lines.push(`enabled = ${config.mcp.enabled}`);
    }
    if (config.mcp.autoStart !== void 0) {
      lines.push(`autoStart = ${config.mcp.autoStart}`);
    }
    if (config.mcp.timeout) {
      lines.push(`timeout = ${config.mcp.timeout}`);
    }
    if (config.mcp.logLevel) {
      lines.push(`logLevel = "${config.mcp.logLevel}"`);
    }
    lines.push("");
    if (config.mcp.servers && config.mcp.servers.length > 0) {
      config.mcp.servers.forEach((server) => {
        lines.push(`[[mcp.servers]]`);
        lines.push(`id = "${server.id}"`);
        lines.push(`name = "${server.name}"`);
        lines.push(`description = "${server.description}"`);
        lines.push(`command = "${server.command}"`);
        lines.push(`args = [${server.args.map((arg) => `"${arg}"`).join(", ")}]`);
        lines.push(`status = "${server.status}"`);
        lines.push(`capabilities = [${server.capabilities.map((c) => `"${c}"`).join(", ")}]`);
        if (server.configPath) {
          lines.push(`configPath = "${server.configPath}"`);
        }
        lines.push(`type = "${server.type}"`);
        lines.push("");
      });
    }
  }
  if (config.logging) {
    lines.push("[logging]");
    if (config.logging.level) {
      lines.push(`level = "${config.logging.level}"`);
    }
    lines.push("");
  }
  if (config.datastore) {
    lines.push("[datastore]");
    if (config.datastore.embeddings_path) {
      lines.push(`embeddings_path = "${config.datastore.embeddings_path}"`);
    }
    lines.push("");
  }
  if (config.gcp) {
    lines.push("[gcp]");
    if (config.gcp.project) {
      lines.push(`project = "${config.gcp.project}"`);
    }
    if (config.gcp.region) {
      lines.push(`region = "${config.gcp.region}"`);
    }
    lines.push("");
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
  const content = lines.join("\n");
  writeFileSync(configPath, content, "utf-8");
}

export {
  loadConfig,
  readConfig,
  writeConfig
};
//# sourceMappingURL=chunk-DRFJ2DAP.js.map