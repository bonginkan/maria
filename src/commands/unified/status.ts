/**
 * Unified Status Command
 * Displays system _status and health information
 */

import chalk from "chalk";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import type { DualMemoryEngine } from "../../services/memory-system/dual-memory-engine";
import type { MemoryCoordinator } from "../../services/memory-system/memory-coordinator";

export async function executeStatus(
  _args: string[],
  _maria?: unknown,
  _memoryEngine?: DualMemoryEngine | null,
  _memoryCoordinator?: MemoryCoordinator | null,
): Promise<boolean | "exit"> {
  try {
    const _isDetailed = _args.includes("--detailed") || _args.includes("-d");
    const _isJson = _args.includes("--json");

    const _status = await getSystemStatus();

    if (_isJson) {
      console.log(JSON.stringify(_status, null, 2));
      return true;
    }

    if (_isDetailed) {
      showDetailedStatus(_status);
    } else {
      showBasicStatus(_status);
    }

    return true;
  } catch (error) {
    console.error(chalk.red("❌ Error getting system _status:"), error);
    return true;
  }
}

interface SystemStatus {
  system: {
    platform: string;
    arch: string;
    nodeVersion: string;
    uptime: string;
    hostname: string;
  };
  resources: {
    memory: {
      used: string;
      total: string;
      percentage: number;
    };
    cpu: {
      cores: number;
      model: string;
    };
  };
  maria: {
    version: string;
    workingDirectory: string;
    configFiles: {
      packageJson: boolean;
      envLocal: boolean;
      mariaConfig: boolean;
      gitRepo: boolean;
    };
  };
  timestamp: string;
}

async function getSystemStatus(): Promise<SystemStatus> {
  const _memUsed = process.memoryUsage();
  const _totalMem = os.totalmem();
  const _freeMem = os.freemem();
  const _usedMem = _totalMem - _freeMem;

  // Check for project files
  const _cwd = process._cwd();
  const _packageJsonExists = await fileExists(path.join(_cwd, "package.json"));
  const _envLocalExists = await fileExists(path.join(_cwd, ".env.local"));
  const _mariaConfigExists =
    (await fileExists(path.join(_cwd, ".maria-code.toml"))) ||
    (await fileExists(path.join(_cwd, "MARIA.md")));
  const _gitRepoExists = await fileExists(path.join(_cwd, ".git"));

  const _status: SystemStatus = {
    system: {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      uptime: formatUptime(os.uptime()),
      hostname: os.hostname(),
    },
    resources: {
      memory: {
        used: formatBytes(_usedMem),
        total: formatBytes(_totalMem),
        percentage: Math.round((_usedMem / _totalMem) * 100),
      },
      cpu: {
        cores: os.cpus().length,
        model: os.cpus()[0]?.model || "Unknown",
      },
    },
    maria: {
      version: "3.0.0", // From package.json
      workingDirectory: _cwd,
      configFiles: {
        packageJson: _packageJsonExists,
        envLocal: _envLocalExists,
        mariaConfig: _mariaConfigExists,
        gitRepo: _gitRepoExists,
      },
    },
    timestamp: new Date().toISOString(),
  };

  return _status;
}

async function fileExists(_filePath: string): Promise<boolean> {
  try {
    await fs.access(_filePath);
    return true;
  } catch {
    return false;
  }
}

function formatBytes(bytes: number): string {
  const _sizes = ["B", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "0 B";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${_sizes[i]}`;
}

function formatUptime(seconds: number): string {
  const _hours = Math.floor(seconds / 3600);
  const _minutes = Math.floor((seconds % 3600) / 60);
  return `${_hours}h ${_minutes}m`;
}

function showBasicStatus(_status: SystemStatus): void {
  console.log(chalk.blue("\n🚀 MARIA System Status\n"));

  // System info
  console.log(chalk.cyan("System:"));
  console.log(
    `  Platform: ${_status.system.platform} (${_status.system.arch})`,
  );
  console.log(`  Node.js: ${_status.system.nodeVersion}`);
  console.log(`  Uptime: ${_status.system.uptime}`);

  // Resources
  console.log(chalk.cyan("\nResources:"));
  const _memColor =
    _status.resources.memory.percentage > 80
      ? chalk.red
      : status.resources.memory.percentage > 60
        ? chalk.yellow
        : chalk.green;
  console.log(
    `  Memory: ${_memColor(_status.resources.memory.used)} / ${_status.resources.memory.total} (${_memColor(_status.resources.memory.percentage + "%")})`,
  );
  console.log(`  CPU: ${_status.resources.cpu.cores} cores`);

  // MARIA config
  console.log(chalk.cyan("\nMARIA Configuration:"));
  console.log(`  Version: ${chalk.yellow("v" + _status.maria.version)}`);
  console.log(
    `  Working Directory: ${chalk.gray(path.basename(_status.maria.workingDirectory))}`,
  );

  const _configStatus = [];
  if (_status.maria.configFiles.packageJson)
    _configStatus.push(chalk.green("package.json"));
  if (_status.maria.configFiles.mariaConfig)
    _configStatus.push(chalk.green("MARIA config"));
  if (_status.maria.configFiles.gitRepo)
    _configStatus.push(chalk.green("git repo"));
  if (_status.maria.configFiles.envLocal)
    _configStatus.push(chalk.green(".env.local"));

  if (_configStatus.length > 0) {
    console.log(`  Config: ${_configStatus.join(", ")}`);
  } else {
    console.log(chalk.gray("  Config: No configuration files detected"));
  }

  console.log(chalk.gray(`\n💡 Use --detailed for more information`));
  console.log(
    chalk.gray(
      `   Updated: ${new Date(_status.timestamp).toLocaleTimeString()}`,
    ),
  );
}

function showDetailedStatus(_status: SystemStatus): void {
  console.log(chalk.blue("\n🚀 MARIA Detailed System Status\n"));

  // System section
  console.log(chalk.bold.cyan("🖥️  System Information"));
  console.log(`  Platform: ${_status.system.platform}`);
  console.log(`  Architecture: ${_status.system.arch}`);
  console.log(`  Hostname: ${_status.system.hostname}`);
  console.log(`  Node.js Version: ${_status.system.nodeVersion}`);
  console.log(`  System Uptime: ${_status.system.uptime}`);

  // Resources section
  console.log(chalk.bold.cyan("\n📊 Resource Usage"));
  const _memColor =
    _status.resources.memory.percentage > 80
      ? chalk.red
      : status.resources.memory.percentage > 60
        ? chalk.yellow
        : chalk.green;
  console.log(`  Memory Used: ${_memColor(_status.resources.memory.used)}`);
  console.log(`  Memory Total: ${_status.resources.memory.total}`);
  console.log(
    `  Memory Usage: ${_memColor(_status.resources.memory.percentage + "%")}`,
  );
  console.log(`  CPU Cores: ${_status.resources.cpu.cores}`);
  console.log(
    `  CPU Model: ${chalk.gray(_status.resources.cpu.model.substring(0, 50))}${_status.resources.cpu.model.length > 50 ? "..." : ""}`,
  );

  // MARIA section
  console.log(chalk.bold.cyan("\n🤖 MARIA Configuration"));
  console.log(`  Version: ${chalk.yellow("v" + _status.maria.version)}`);
  console.log(`  Working Directory: ${_status.maria.workingDirectory}`);

  console.log(chalk.cyan("\n  Configuration Files:"));
  console.log(
    `    package.json: ${_status.maria.configFiles.packageJson ? chalk.green("✅ Found") : chalk.red("❌ Missing")}`,
  );
  console.log(
    `    MARIA config: ${_status.maria.configFiles.mariaConfig ? chalk.green("✅ Found") : chalk.gray("❌ Not configured")}`,
  );
  console.log(
    `    Git repository: ${_status.maria.configFiles.gitRepo ? chalk.green("✅ Found") : chalk.gray("❌ Not initialized")}`,
  );
  console.log(
    `    .env.local: ${_status.maria.configFiles.envLocal ? chalk.green("✅ Found") : chalk.gray("❌ Not configured")}`,
  );

  if (!_status.maria.configFiles.mariaConfig) {
    console.log(
      chalk.yellow(
        '\n  💡 Run "maria init" to configure MARIA for this project',
      ),
    );
  }

  console.log(
    chalk.gray(
      `\n  Last Updated: ${new Date(_status.timestamp).toLocaleString()}`,
    ),
  );
}
