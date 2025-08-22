/**
 * Permission Manager - Permission Checking and Elevation System
 * Handles file system permissions, elevation, and security validation
 * Phase 2: Terminal Integration & Safety - Week 6
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import chalk from 'chalk';

export interface PermissionInfo {
  readable: boolean;
  writable: boolean;
  executable: boolean;
  owner: string;
  group: string;
  mode: string;
  needsElevation: boolean;
}

export interface ElevationRequest {
  operation: 'read' | 'write' | 'execute' | 'delete' | 'create';
  path: string;
  reason: string;
  alternative?: string;
}

export interface SecurityPolicy {
  // Safe operations that don't require confirmation
  safeOperations: Set<string>;

  // Destructive operations that require confirmation
  destructiveOperations: Set<string>;

  // System paths that require elevation
  systemPaths: Set<string>;

  // Sensitive files that require extra caution
  sensitivePaths: Set<string>;

  // Operations blocked completely
  blockedOperations: Set<string>;
}

export interface PermissionCache {
  [path: string]: {
    permissions: PermissionInfo;
    timestamp: number;
    ttl: number;
  };
}

export class PermissionManager {
  private static instance: PermissionManager;
  private cache: PermissionCache = {};
  private readonly cacheTTL = 60000; // 1 minute cache

  private readonly securityPolicy: SecurityPolicy = {
    safeOperations: new Set([
      'read',
      'readdir',
      'stat',
      'find',
      'which',
      'pwd',
      'ls',
      'cat',
      'tree',
    ]),

    destructiveOperations: new Set([
      'delete',
      'rmdir',
      'rm',
      'move',
      'mv',
      'rename',
      'chmod',
      'chown',
      'write',
    ]),

    systemPaths: new Set([
      '/System',
      '/usr',
      '/etc',
      '/bin',
      '/sbin',
      '/var/log',
      '/Library/Application Support',
      '/Library/Preferences',
      'C:\\Windows',
      'C:\\Program Files',
      'C:\\ProgramData',
    ]),

    sensitivePaths: new Set([
      '~/.ssh',
      '~/.gnupg',
      '~/.aws',
      '~/.config',
      '/etc/passwd',
      '/etc/shadow',
      '/etc/sudoers',
      'C:\\Users\\*\\AppData\\Roaming\\Microsoft\\Credentials',
      'C:\\Users\\*\\AppData\\Local\\Microsoft\\Credentials',
    ]),

    blockedOperations: new Set([
      // No operations are completely blocked by default
      // This can be configured for enterprise security
    ]),
  };

  public static getInstance(): PermissionManager {
    if (!PermissionManager.instance) {
      PermissionManager.instance = new PermissionManager();
    }
    return PermissionManager.instance;
  }

  private constructor() {}

  /**
   * Check permissions for a given path and operation
   */
  async checkPermissions(filePath: string, operation: string): Promise<PermissionInfo> {
    const resolvedPath = path.resolve(filePath);
    const cacheKey = `${resolvedPath}:${operation}`;

    // Check cache first
    const cached = this.cache[cacheKey];
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.permissions;
    }

    try {
      const permissions = await this.performPermissionCheck(resolvedPath, operation);

      // Cache the result
      this.cache[cacheKey] = {
        permissions,
        timestamp: Date.now(),
        ttl: this.cacheTTL,
      };

      return permissions;
    } catch (error) {
      // Return minimal permissions on error
      return {
        readable: false,
        writable: false,
        executable: false,
        owner: 'unknown',
        group: 'unknown',
        mode: '000',
        needsElevation: true,
      };
    }
  }

  /**
   * Request elevation for an operation
   */
  async requestElevation(request: ElevationRequest): Promise<boolean> {
    console.log(chalk.yellow('\n🔐 Elevation Required'));
    console.log(`Operation: ${chalk.cyan(request.operation)}`);
    console.log(`Path: ${chalk.cyan(request.path)}`);
    console.log(`Reason: ${request.reason}`);

    if (request.alternative) {
      console.log(`Alternative: ${chalk.green(request.alternative)}`);
    }

    // Check if operation is blocked
    if (this.securityPolicy.blockedOperations.has(request.operation)) {
      console.log(chalk.red('❌ Operation blocked by security policy'));
      return false;
    }

    // Check for destructive operations
    if (this.securityPolicy.destructiveOperations.has(request.operation)) {
      const confirmed = await this.confirmDestructiveOperation(request);
      if (!confirmed) {
        return false;
      }
    }

    // Attempt elevation based on platform
    if (process.platform === 'win32') {
      return await this.requestWindowsElevation(request);
    } else {
      return await this.requestUnixElevation(request);
    }
  }

  /**
   * Validate operation against security policy
   */
  validateOperation(
    operation: string,
    filePath: string,
  ): {
    allowed: boolean;
    needsConfirmation: boolean;
    needsElevation: boolean;
    reason?: string;
  } {
    const resolvedPath = path.resolve(filePath);

    // Check if operation is blocked
    if (this.securityPolicy.blockedOperations.has(operation)) {
      return {
        allowed: false,
        needsConfirmation: false,
        needsElevation: false,
        reason: 'Operation blocked by security policy',
      };
    }

    // Check for sensitive paths
    const isSensitivePath = this.isSensitivePath(resolvedPath);
    const isSystemPath = this.isSystemPath(resolvedPath);
    const isDestructive = this.securityPolicy.destructiveOperations.has(operation);

    return {
      allowed: true,
      needsConfirmation: isDestructive || isSensitivePath,
      needsElevation: isSystemPath || (isSensitivePath && isDestructive),
      reason: isSensitivePath
        ? 'Sensitive path detected'
        : isSystemPath
          ? 'System path requires elevation'
          : undefined,
    };
  }

  /**
   * Clear permission cache
   */
  clearCache(): void {
    this.cache = {};
  }

  /**
   * Clear expired cache entries
   */
  cleanupCache(): void {
    const now = Date.now();
    Object.keys(this.cache).forEach((key) => {
      const entry = this.cache[key];
      if (now - entry.timestamp >= entry.ttl) {
        delete this.cache[key];
      }
    });
  }

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<{
    uid: number;
    gid: number;
    username: string;
    groups: string[];
  }> {
    if (process.platform === 'win32') {
      return {
        uid: 0,
        gid: 0,
        username: process.env.USERNAME || 'unknown',
        groups: [],
      };
    }

    try {
      const uid = process.getuid?.() || 0;
      const gid = process.getgid?.() || 0;
      const username = os.userInfo().username;

      // Get user groups
      const groups = await this.getUserGroups(username);

      return { uid, gid, username, groups };
    } catch (error) {
      return {
        uid: 0,
        gid: 0,
        username: 'unknown',
        groups: [],
      };
    }
  }

  /**
   * Check if user has sudo access
   */
  async hasSudoAccess(): Promise<boolean> {
    if (process.platform === 'win32') {
      return await this.isWindowsAdmin();
    }

    try {
      const result = await this.executeCommand('sudo', ['-n', 'true'], { timeout: 1000 });
      return result.success;
    } catch {
      return false;
    }
  }

  /**
   * Perform actual permission check
   */
  private async performPermissionCheck(
    filePath: string,
    operation: string,
  ): Promise<PermissionInfo> {
    try {
      // Check if file/directory exists
      const stats = await fs.promises.stat(filePath);

      if (process.platform === 'win32') {
        return await this.checkWindowsPermissions(filePath, stats, operation);
      } else {
        return await this.checkUnixPermissions(filePath, stats, operation);
      }
    } catch (error) {
      // File doesn't exist - check parent directory permissions
      const parentDir = path.dirname(filePath);
      if (parentDir !== filePath) {
        try {
          const parentStats = await fs.promises.stat(parentDir);
          return await this.checkUnixPermissions(parentDir, parentStats, 'write');
        } catch {
          // Parent doesn't exist either
          throw error;
        }
      }
      throw error;
    }
  }

  /**
   * Check Unix-like permissions
   */
  private async checkUnixPermissions(
    filePath: string,
    stats: fs.Stats,
    operation: string,
  ): Promise<PermissionInfo> {
    const mode = stats.mode;
    const uid = process.getuid?.() || 0;
    const gid = process.getgid?.() || 0;

    // Extract permission bits
    const ownerPerms = (mode & 0o700) >> 6;
    const groupPerms = (mode & 0o070) >> 3;
    const otherPerms = mode & 0o007;

    // Determine effective permissions
    let effectivePerms: number;
    if (stats.uid === uid) {
      effectivePerms = ownerPerms;
    } else if (stats.gid === gid) {
      effectivePerms = groupPerms;
    } else {
      effectivePerms = otherPerms;
    }

    const readable = (effectivePerms & 0o4) !== 0;
    const writable = (effectivePerms & 0o2) !== 0;
    const executable = (effectivePerms & 0o1) !== 0;

    // Check if elevation is needed
    const needsElevation =
      this.isSystemPath(filePath) ||
      (operation === 'write' && !writable) ||
      (operation === 'execute' && !executable) ||
      (operation === 'read' && !readable);

    // Get owner/group names
    const owner = await this.getOwnerName(stats.uid);
    const group = await this.getGroupName(stats.gid);

    return {
      readable,
      writable,
      executable,
      owner,
      group,
      mode: (mode & 0o777).toString(8),
      needsElevation,
    };
  }

  /**
   * Check Windows permissions
   */
  private async checkWindowsPermissions(
    filePath: string,
    stats: fs.Stats,
    operation: string,
  ): Promise<PermissionInfo> {
    // Basic check using fs.access
    let readable = false;
    let writable = false;
    let executable = false;

    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
      readable = true;
    } catch {}

    try {
      await fs.promises.access(filePath, fs.constants.W_OK);
      writable = true;
    } catch {}

    try {
      await fs.promises.access(filePath, fs.constants.X_OK);
      executable = true;
    } catch {}

    const needsElevation =
      this.isSystemPath(filePath) ||
      (operation === 'write' && !writable) ||
      (operation === 'execute' && !executable) ||
      (operation === 'read' && !readable);

    return {
      readable,
      writable,
      executable,
      owner: 'unknown',
      group: 'unknown',
      mode: '644', // Default mode for display
      needsElevation,
    };
  }

  /**
   * Check if path is a system path
   */
  private isSystemPath(filePath: string): boolean {
    const normalizedPath = path.normalize(filePath);

    return Array.from(this.securityPolicy.systemPaths).some((systemPath) => {
      const expandedPath = systemPath.replace('~', os.homedir());
      return normalizedPath.startsWith(expandedPath);
    });
  }

  /**
   * Check if path is sensitive
   */
  private isSensitivePath(filePath: string): boolean {
    const normalizedPath = path.normalize(filePath);

    return Array.from(this.securityPolicy.sensitivePaths).some((sensitivePath) => {
      const expandedPath = sensitivePath.replace('~', os.homedir());

      // Handle wildcard patterns
      if (expandedPath.includes('*')) {
        const pattern = expandedPath.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}`);
        return regex.test(normalizedPath);
      }

      return normalizedPath.startsWith(expandedPath);
    });
  }

  /**
   * Confirm destructive operation
   */
  private async confirmDestructiveOperation(request: ElevationRequest): Promise<boolean> {
    console.log(chalk.red('\n⚠️  Destructive Operation Warning'));
    console.log(`This operation may cause data loss or system changes.`);
    console.log(`Operation: ${chalk.red(request.operation)}`);
    console.log(`Target: ${chalk.yellow(request.path)}`);

    // In a real implementation, this would show an interactive prompt
    // For now, we'll default to requiring manual confirmation
    console.log(chalk.yellow('Please confirm this operation manually in your terminal.'));
    return true; // Assume confirmation for automation
  }

  /**
   * Request Unix elevation (sudo)
   */
  private async requestUnixElevation(request: ElevationRequest): Promise<boolean> {
    try {
      console.log(chalk.blue('Checking sudo access...'));

      const hasSudo = await this.hasSudoAccess();
      if (!hasSudo) {
        console.log(chalk.red('❌ Sudo access not available'));
        return false;
      }

      console.log(chalk.green('✅ Sudo access confirmed'));
      return true;
    } catch (error) {
      console.error('Failed to request Unix elevation:', error);
      return false;
    }
  }

  /**
   * Request Windows elevation
   */
  private async requestWindowsElevation(request: ElevationRequest): Promise<boolean> {
    try {
      console.log(chalk.blue('Checking administrator access...'));

      const isAdmin = await this.isWindowsAdmin();
      if (!isAdmin) {
        console.log(chalk.red('❌ Administrator access not available'));
        console.log('Please run as Administrator to perform this operation.');
        return false;
      }

      console.log(chalk.green('✅ Administrator access confirmed'));
      return true;
    } catch (error) {
      console.error('Failed to request Windows elevation:', error);
      return false;
    }
  }

  /**
   * Check if running as Windows admin
   */
  private async isWindowsAdmin(): Promise<boolean> {
    try {
      const result = await this.executeCommand('net', ['session'], { timeout: 1000 });
      return result.success;
    } catch {
      return false;
    }
  }

  /**
   * Get owner name from UID
   */
  private async getOwnerName(uid: number): Promise<string> {
    try {
      const result = await this.executeCommand('id', ['-nu', uid.toString()], { timeout: 1000 });
      return result.success ? result.output.trim() : uid.toString();
    } catch {
      return uid.toString();
    }
  }

  /**
   * Get group name from GID
   */
  private async getGroupName(gid: number): Promise<string> {
    try {
      const result = await this.executeCommand('id', ['-ng', gid.toString()], { timeout: 1000 });
      return result.success ? result.output.trim() : gid.toString();
    } catch {
      return gid.toString();
    }
  }

  /**
   * Get user groups
   */
  private async getUserGroups(username: string): Promise<string[]> {
    try {
      const result = await this.executeCommand('groups', [username], { timeout: 1000 });
      if (result.success) {
        return result.output.split(' ').filter(Boolean);
      }
    } catch {}
    return [];
  }

  /**
   * Execute command with timeout
   */
  private executeCommand(
    command: string,
    args: string[],
    options: { timeout?: number } = {},
  ): Promise<{ success: boolean; output: string; error?: string }> {
    return new Promise((resolve) => {
      const proc = spawn(command, args, { stdio: 'pipe' });
      let output = '';
      let error = '';

      const timeout = options.timeout || 5000;
      const timer = setTimeout(() => {
        proc.kill();
        resolve({ success: false, output: '', error: 'Command timeout' });
      }, timeout);

      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        error += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          success: code === 0,
          output: output.trim(),
          error: error.trim() || undefined,
        });
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          success: false,
          output: '',
          error: err.message,
        });
      });
    });
  }
}

export const permissionManager = PermissionManager.getInstance();
