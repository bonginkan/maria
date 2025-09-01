/**
 * SandboxExecutor - Secure sandboxed execution using Firejail and Docker
 * Implements --net=none by default with limited resource access
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { OperationContext, PlannedOperation } from './AutonomousExecutor';

const execAsync = promisify(exec);

export interface SandboxOptions {
  type?: 'firejail' | 'docker';
  enableNetwork?: boolean;
  timeout?: number;
  maxMemoryMB?: number;
  maxCpus?: number;
  workingDirectory?: string;
  env?: Record<string, string>;
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  error: string;
  exitCode: number;
  duration: number;
  operationId: string;
  resourceUsage?: ResourceUsage;
}

export interface ResourceUsage {
  maxMemoryMB: number;
  cpuTimeSeconds: number;
  filesCreated: number;
  filesModified: number;
  networkRequests: number;
}

export interface SandboxEnvironment {
  id: string;
  type: 'firejail' | 'docker';
  workDir: string;
  allowPaths: string[];
  denyPaths: string[];
  networkEnabled: boolean;
  resourceLimits: ResourceLimits;
}

export interface ResourceLimits {
  maxMemoryMB: number;
  maxCpus: number;
  maxDiskMB: number;
  maxProcesses: number;
  timeoutSeconds: number;
}

export class SandboxExecutor {
  private readonly sandboxType: 'firejail' | 'docker';
  private readonly sandboxDir: string;
  private readonly defaultLimits: ResourceLimits;

  constructor(options: SandboxOptions = {}) {
    this.sandboxType = options.type || 'firejail';
    this.sandboxDir = path.join(os.homedir(), '.maria', 'sandbox');
    this.defaultLimits = {
      maxMemoryMB: 512,
      maxCpus: 1,
      maxDiskMB: 100,
      maxProcesses: 256,
      timeoutSeconds: 300 // 5 minutes
    };
    
    this.ensureSandboxDirectory();
  }

  /**
   * Execute a planned operation in sandbox
   */
  async execute(
    operation: PlannedOperation,
    context: OperationContext,
    options: SandboxOptions = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      // 1. Prepare sandbox environment
      const environment = await this.prepareSandboxEnvironment(context, options);
      
      // 2. Convert operation to executable command
      const command = this.operationToCommand(operation, context);
      
      // 3. Execute in appropriate sandbox
      const result = await this.executeInSandbox(command, environment, context);
      
      // 4. Measure resource usage
      const resourceUsage = await this.measureResourceUsage(environment);
      
      return {
        ...result,
        duration: Date.now() - startTime,
        operationId: context.operationId,
        resourceUsage
      };
      
    } catch (error) {
      return {
        success: false,
        output: '',
        error: (error as Error).message,
        exitCode: 1,
        duration: Date.now() - startTime,
        operationId: context.operationId
      };
    }
  }

  /**
   * Prepare sandbox environment
   */
  private async prepareSandboxEnvironment(
    context: OperationContext,
    options: SandboxOptions
  ): Promise<SandboxEnvironment> {
    const sandboxId = `${context.operationId}`;
    const workDir = path.join(this.sandboxDir, sandboxId);
    
    // Create sandbox workspace
    await fs.mkdir(workDir, { recursive: true });
    
    // Set up allowed paths based on policy
    const allowPaths = [
      path.resolve(process.cwd(), 'src'),
      path.resolve(process.cwd(), 'tests'),
      path.resolve(process.cwd(), 'docs'),
      workDir
    ];
    
    const denyPaths = [
      '/etc',
      '/var',
      '/usr/bin/sudo',
      path.resolve(process.cwd(), 'node_modules'),
      path.resolve(process.cwd(), '.env*')
    ];
    
    const resourceLimits: ResourceLimits = {
      maxMemoryMB: options.maxMemoryMB || this.defaultLimits.maxMemoryMB,
      maxCpus: options.maxCpus || this.defaultLimits.maxCpus,
      maxDiskMB: this.defaultLimits.maxDiskMB,
      maxProcesses: this.defaultLimits.maxProcesses,
      timeoutSeconds: Math.floor((options.timeout || this.defaultLimits.timeoutSeconds * 1000) / 1000)
    };
    
    return {
      id: sandboxId,
      type: this.sandboxType,
      workDir,
      allowPaths,
      denyPaths,
      networkEnabled: options.enableNetwork || false,
      resourceLimits
    };
  }

  /**
   * Convert operation to executable command
   */
  private operationToCommand(operation: PlannedOperation, context: OperationContext): string {
    switch (operation.type) {
      case 'writeFile':
        return this.generateWriteFileCommand(operation);
      
      case 'editFile':
        return this.generateEditFileCommand(operation);
      
      case 'deleteFile':
        return this.generateDeleteFileCommand(operation);
      
      case 'execCommand':
        return operation.command || 'echo "No command specified"';
      
      case 'networkRequest':
        return this.generateNetworkCommand(operation);
      
      default:
        throw new Error(`Unsupported operation type: ${operation.type}`);
    }
  }

  /**
   * Generate write file command
   */
  private generateWriteFileCommand(operation: PlannedOperation): string {
    if (!operation.path || !operation.content) {
      throw new Error('Write file operation missing path or content');
    }
    
    // Use safe file writing with atomic operations
    const escapedContent = operation.content.replace(/'/g, "'\"'\"'");
    const escapedPath = operation.path.replace(/'/g, "'\"'\"'");
    
    return `
      mkdir -p "$(dirname '${escapedPath}')" && 
      echo '${escapedContent}' > '${escapedPath}.tmp' && 
      mv '${escapedPath}.tmp' '${escapedPath}' &&
      echo "File written successfully: ${escapedPath}"
    `.trim().replace(/\s+/g, ' ');
  }

  /**
   * Generate edit file command
   */
  private generateEditFileCommand(operation: PlannedOperation): string {
    if (!operation.path) {
      throw new Error('Edit file operation missing path');
    }
    
    // For now, treat edit as write (more sophisticated editing would require diff parsing)
    return this.generateWriteFileCommand(operation);
  }

  /**
   * Generate delete file command
   */
  private generateDeleteFileCommand(operation: PlannedOperation): string {
    if (!operation.path) {
      throw new Error('Delete file operation missing path');
    }
    
    const escapedPath = operation.path.replace(/'/g, "'\"'\"'");
    
    return `
      if [ -f '${escapedPath}' ]; then
        rm '${escapedPath}' && echo "File deleted: ${escapedPath}"
      else
        echo "File not found: ${escapedPath}"
      fi
    `.trim().replace(/\s+/g, ' ');
  }

  /**
   * Generate network command (usually blocked)
   */
  private generateNetworkCommand(operation: PlannedOperation): string {
    if (!operation.url) {
      throw new Error('Network operation missing URL');
    }
    
    // Network operations require special approval
    const method = operation.method || 'GET';
    const escapedUrl = operation.url.replace(/'/g, "'\"'\"'");
    
    return `curl -X ${method} '${escapedUrl}' --max-time 5 --silent`;
  }

  /**
   * Execute command in sandbox
   */
  private async executeInSandbox(
    command: string,
    environment: SandboxEnvironment,
    context: OperationContext
  ): Promise<Omit<ExecutionResult, 'duration' | 'operationId' | 'resourceUsage'>> {
    if (this.sandboxType === 'firejail') {
      return await this.executeFirejail(command, environment, context);
    } else {
      return await this.executeDocker(command, environment, context);
    }
  }

  /**
   * Execute using Firejail
   */
  private async executeFirejail(
    command: string,
    environment: SandboxEnvironment,
    context: OperationContext
  ): Promise<Omit<ExecutionResult, 'duration' | 'operationId' | 'resourceUsage'>> {
    // Build firejail command
    const firejailArgs = [
      '--quiet',
      '--force',
      '--caps.drop=all',
      '--seccomp',
      '--no3d',
      '--nodvd',
      '--nogroups',
      '--nonewprivs',
      '--noroot',
      '--nosound',
      '--notv',
      '--nou2f',
      '--novideo',
      `--private=${environment.workDir}`,
      `--timeout=00:${String(Math.floor(environment.resourceLimits.timeoutSeconds / 60)).padStart(2, '0')}:${String(environment.resourceLimits.timeoutSeconds % 60).padStart(2, '0')}`,
      `--memory=${environment.resourceLimits.maxMemoryMB}`,
      `--cpu=${environment.resourceLimits.maxCpus}`,
      `--rlimit-nproc=${environment.resourceLimits.maxProcesses}`
    ];

    // Network settings
    if (!environment.networkEnabled) {
      firejailArgs.push('--net=none');
    } else {
      firejailArgs.push('--net=eth0');
      firejailArgs.push('--netfilter=/etc/maria/netfilter.rules');
    }

    // Whitelist allowed paths
    for (const allowPath of environment.allowPaths) {
      firejailArgs.push(`--whitelist=${allowPath}`);
    }

    // Blacklist denied paths
    for (const denyPath of environment.denyPaths) {
      firejailArgs.push(`--blacklist=${denyPath}`);
    }

    // Environment variables
    const envVars = {
      MARIA_OPERATION_ID: context.operationId,
      MARIA_PLAN_ID: context.planId,
      MARIA_MODE: context.mode,
      MARIA_SANDBOX: 'firejail'
    };

    const envArgs = Object.entries(envVars)
      .map(([key, value]) => `--env=${key}=${value}`)
      .join(' ');

    const fullCommand = `firejail ${firejailArgs.join(' ')} ${envArgs} bash -c '${command.replace(/'/g, "'\"'\"'")}'`;

    try {
      const result = await execAsync(fullCommand, {
        cwd: environment.workDir,
        timeout: environment.resourceLimits.timeoutSeconds * 1000
      });

      return {
        success: true,
        output: result.stdout,
        error: result.stderr,
        exitCode: 0
      };
    } catch (error: any) {
      return {
        success: false,
        output: error.stdout || '',
        error: error.stderr || error.message,
        exitCode: error.code || 1
      };
    }
  }

  /**
   * Execute using Docker
   */
  private async executeDocker(
    command: string,
    environment: SandboxEnvironment,
    context: OperationContext
  ): Promise<Omit<ExecutionResult, 'duration' | 'operationId' | 'resourceUsage'>> {
    const dockerArgs = [
      'run', '--rm', '-t',
      '--network', environment.networkEnabled ? 'bridge' : 'none',
      '--memory', `${environment.resourceLimits.maxMemoryMB}m`,
      '--cpus', `${environment.resourceLimits.maxCpus}`,
      '--pids-limit', `${environment.resourceLimits.maxProcesses}`,
      '--security-opt', 'no-new-privileges',
      '--cap-drop', 'ALL',
      '--read-only',
      '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m'
    ];

    // Mount allowed paths
    for (const allowPath of environment.allowPaths) {
      const mountPoint = allowPath.replace(process.cwd(), '/work');
      dockerArgs.push('-v', `${allowPath}:${mountPoint}:rw`);
    }

    // Environment variables
    const envVars = {
      MARIA_OPERATION_ID: context.operationId,
      MARIA_PLAN_ID: context.planId,
      MARIA_MODE: context.mode,
      MARIA_SANDBOX: 'docker'
    };

    for (const [key, value] of Object.entries(envVars)) {
      dockerArgs.push('-e', `${key}=${value}`);
    }

    // Use Alpine Linux for minimal attack surface
    dockerArgs.push('node:20-alpine');
    dockerArgs.push('sh', '-c', command);

    const fullCommand = `docker ${dockerArgs.join(' ')}`;

    try {
      const result = await execAsync(fullCommand, {
        timeout: environment.resourceLimits.timeoutSeconds * 1000
      });

      return {
        success: true,
        output: result.stdout,
        error: result.stderr,
        exitCode: 0
      };
    } catch (error: any) {
      return {
        success: false,
        output: error.stdout || '',
        error: error.stderr || error.message,
        exitCode: error.code || 1
      };
    }
  }

  /**
   * Measure resource usage
   */
  private async measureResourceUsage(environment: SandboxEnvironment): Promise<ResourceUsage> {
    // This is a simplified implementation
    // In production, this would integrate with cgroups or Docker stats
    return {
      maxMemoryMB: 0,
      cpuTimeSeconds: 0,
      filesCreated: 0,
      filesModified: 0,
      networkRequests: 0
    };
  }

  /**
   * Ensure sandbox directory exists
   */
  private async ensureSandboxDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.sandboxDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  /**
   * Check if sandbox runtime is available
   */
  async checkSandboxAvailable(): Promise<{
    firejail: boolean;
    docker: boolean;
    recommended: 'firejail' | 'docker' | 'none';
  }> {
    let firejailAvailable = false;
    let dockerAvailable = false;

    // Check Firejail
    try {
      await execAsync('firejail --version');
      firejailAvailable = true;
    } catch (error) {
      // Firejail not available
    }

    // Check Docker
    try {
      await execAsync('docker --version');
      dockerAvailable = true;
    } catch (error) {
      // Docker not available
    }

    let recommended: 'firejail' | 'docker' | 'none' = 'none';
    if (firejailAvailable && process.platform === 'linux') {
      recommended = 'firejail';
    } else if (dockerAvailable) {
      recommended = 'docker';
    }

    return {
      firejail: firejailAvailable,
      docker: dockerAvailable,
      recommended
    };
  }

  /**
   * Install sandbox runtime (Linux only)
   */
  async installSandboxRuntime(): Promise<{
    success: boolean;
    message: string;
    installed: 'firejail' | 'docker' | 'none';
  }> {
    if (process.platform !== 'linux') {
      return {
        success: false,
        message: 'Automatic sandbox installation only supported on Linux',
        installed: 'none'
      };
    }

    try {
      // Try to install Firejail first (lighter weight)
      await execAsync('sudo apt-get update && sudo apt-get install -y firejail');
      
      return {
        success: true,
        message: 'Firejail installed successfully',
        installed: 'firejail'
      };
    } catch (error) {
      // Fall back to Docker installation instructions
      return {
        success: false,
        message: 'Please install Docker or Firejail manually for secure sandbox execution',
        installed: 'none'
      };
    }
  }

  /**
   * Clean up sandbox environments
   */
  async cleanup(): Promise<void> {
    try {
      // Remove old sandbox directories
      const entries = await fs.readdir(this.sandboxDir);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      for (const entry of entries) {
        const entryPath = path.join(this.sandboxDir, entry);
        const stats = await fs.stat(entryPath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.rm(entryPath, { recursive: true, force: true });
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Get sandbox status
   */
  async getStatus(): Promise<{
    type: 'firejail' | 'docker';
    available: boolean;
    activeSandboxes: number;
    resourceUsage: {
      diskUsageMB: number;
      oldestSandbox: string | null;
    };
  }> {
    const availability = await this.checkSandboxAvailable();
    let activeSandboxes = 0;
    let diskUsageMB = 0;
    let oldestSandbox: string | null = null;

    try {
      const entries = await fs.readdir(this.sandboxDir);
      activeSandboxes = entries.length;

      // Calculate disk usage
      for (const entry of entries) {
        const entryPath = path.join(this.sandboxDir, entry);
        const stats = await fs.stat(entryPath);
        if (stats.isDirectory()) {
          const usage = await this.calculateDirSize(entryPath);
          diskUsageMB += usage / (1024 * 1024);
          
          if (!oldestSandbox) {
            oldestSandbox = entry;
          }
        }
      }
    } catch (error) {
      // Ignore errors
    }

    return {
      type: this.sandboxType,
      available: availability[this.sandboxType],
      activeSandboxes,
      resourceUsage: {
        diskUsageMB: Math.round(diskUsageMB),
        oldestSandbox
      }
    };
  }

  /**
   * Calculate directory size recursively
   */
  private async calculateDirSize(dirPath: string): Promise<number> {
    let totalSize = 0;
    
    try {
      const entries = await fs.readdir(dirPath);
      
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry);
        const stats = await fs.stat(entryPath);
        
        if (stats.isFile()) {
          totalSize += stats.size;
        } else if (stats.isDirectory()) {
          totalSize += await this.calculateDirSize(entryPath);
        }
      }
    } catch (error) {
      // Ignore errors
    }
    
    return totalSize;
  }
}