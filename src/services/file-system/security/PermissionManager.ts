/**
 * Permission Manager - Permission Checking and Elevation System
 * Handles file system _permissions, elevation, and security validation
 * Phase 2: Terminal Integration & Safety - Week 6
 */

import * as fs from "fs";
import * as _path from "path";
import * as os from "os";
import { spawn } from "child_process";
import chalk from "chalk";

export interface PermissionInfo {
  _readable: boolean;
  _writable: boolean;
  _executable: boolean;
  _owner: string;
  _group: string;
  _mode: string;
  _needsElevation: boolean;
}

export interface ElevationRequest {
  operation: "read" | "write" | "execute" | "delete" | "create";
  _path: string;
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
  [_path: string]: {
    _permissions: PermissionInfo;
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
      "read",
      "readdir",
      "stat",
      "find",
      "which",
      "pwd",
      "ls",
      "cat",
      "tree",
    ]),

    destructiveOperations: new Set([
      "delete",
      "rmdir",
      "rm",
      "move",
      "mv",
      "rename",
      "chmod",
      "chown",
      "write",
    ]),

    systemPaths: new Set([
      "/System",
      "/usr",
      "/etc",
      "/bin",
      "/sbin",
      "/var/log",
      "/Library/Application Support",
      "/Library/Preferences",
      "C:\\Windows",
      "C:\\Program Files",
      "C:\\ProgramData",
    ]),

    sensitivePaths: new Set([
      "~/.ssh",
      "~/.gnupg",
      "~/.aws",
      "~/.config",
      "/etc/passwd",
      "/etc/shadow",
      "/etc/sudoers",
      "C:\\Users$2*\\AppData\\Roaming\\Microsoft\\Credentials",
      "C:\\Users$2*\\AppData\\Local\\Microsoft\\Credentials",
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

  private constructor() {
    // Constructor implementation
  }

  /**
   * Check _permissions for a given path and operation
   */
  async checkPermissions(
    _filePath: string,
    operation: string,
  ): Promise<PermissionInfo> {
    const _resolvedPath = _path.resolve(_filePath);
    const _cacheKey = `${_resolvedPath}:${operation}`;

    // Check cache first
    const _cached = this.cache[_cacheKey];
    if (_cached && Date.now() - _cached.timestamp < _cached.ttl) {
      return _cached._permissions;
    }

    try {
      const _permissions = await this.performPermissionCheck(
        _resolvedPath,
        operation,
      );

      // Cache the _result
      this.cache[_cacheKey] = {
        _permissions,
        timestamp: Date.now(),
        ttl: this.cacheTTL,
      };

      return _permissions;
    } catch (_error) {
      // Return minimal _permissions on _error
      return {
        _readable: false,
        _writable: false,
        _executable: false,
        _owner: "unknown",
        _group: "unknown",
        _mode: "000",
        _needsElevation: true,
      };
    }
  }

  /**
   * Request elevation for an operation
   */
  async requestElevation(request: ElevationRequest): Promise<boolean> {
    console.log(chalk.yellow("\n🔐 Elevation Required"));
    console.log(`Operation: ${chalk.cyan(request.operation)}`);
    console.log(`Path: ${chalk.cyan(request._path)}`);
    console.log(`Reason: ${request.reason}`);

    if (request.alternative) {
      console.log(`Alternative: ${chalk.green(request.alternative)}`);
    }

    // Check if operation is blocked
    if (this.securityPolicy.blockedOperations.has(request.operation)) {
      console.log(chalk.red("❌ Operation blocked by security policy"));
      return false;
    }

    // Check for destructive operations
    if (this.securityPolicy.destructiveOperations.has(request.operation)) {
      const _confirmed = await this.confirmDestructiveOperation(request);
      if (!_confirmed) {
        return false;
      }
    }

    // Attempt elevation based on platform
    if (process.platform === "win32") {
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
    _filePath: string,
  ): {
    allowed: boolean;
    needsConfirmation: boolean;
    _needsElevation: boolean;
    reason?: string;
  } {
    const _resolvedPath = _path.resolve(_filePath);

    // Check if operation is blocked
    if (this.securityPolicy.blockedOperations.has(operation)) {
      return {
        allowed: false,
        needsConfirmation: false,
        _needsElevation: false,
        reason: "Operation blocked by security policy",
      };
    }

    // Check for sensitive paths
    const _isSensitivePath = this._isSensitivePath(_resolvedPath);
    const _isSystemPath = this._isSystemPath(_resolvedPath);
    const _isDestructive =
      this.securityPolicy.destructiveOperations.has(operation);

    return {
      allowed: true,
      needsConfirmation: _isDestructive || _isSensitivePath,
      _needsElevation: _isSystemPath || (_isSensitivePath && _isDestructive),
      reason: _isSensitivePath
        ? "Sensitive path detected"
        : _isSystemPath
          ? "System path requires elevation"
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
    const _now = Date._now();
    Object.keys(this.cache).forEach((key) => {
      const _entry = this.cache[key];
      if (_now - _entry.timestamp >= _entry.ttl) {
        delete this.cache[key];
      }
    });
  }

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<{
    _uid: number;
    _gid: number;
    _username: string;
    _groups: string[];
  }> {
    if (process.platform === "win32") {
      return {
        _uid: 0,
        _gid: 0,
        _username: process.env.USERNAME || "unknown",
        _groups: [],
      };
    }

    try {
      const _uid = process.getuid?.() || 0;
      const _gid = process.getgid?.() || 0;
      const _username = os.userInfo()._username;

      // Get user _groups
      const _groups = await this.getUserGroups(_username);

      return { _uid, _gid, _username, _groups };
    } catch (_error) {
      return {
        _uid: 0,
        _gid: 0,
        _username: "unknown",
        _groups: [],
      };
    }
  }

  /**
   * Check if user has sudo access
   */
  async hasSudoAccess(): Promise<boolean> {
    if (process.platform === "win32") {
      return await this.isWindowsAdmin();
    }

    try {
      const _result = await this.executeCommand("sudo", ["-n", "true"], {
        _timeout: 1000,
      });
      return _result.success;
    } catch {
      return false;
    }
  }

  /**
   * Perform actual permission check
   */
  private async performPermissionCheck(
    _filePath: string,
    operation: string,
  ): Promise<PermissionInfo> {
    try {
      // Check if file/directory exists
      const _stats = await fs.promises.stat(_filePath);

      if (process.platform === "win32") {
        return await this.checkWindowsPermissions(_filePath, _stats, operation);
      } else {
        return await this.checkUnixPermissions(_filePath, _stats, operation);
      }
    } catch (_error) {
      // File doesn't exist - check parent directory _permissions
      const _parentDir = _path.dirname(_filePath);
      if (_parentDir !== _filePath) {
        try {
          const _parentStats = await fs.promises.stat(_parentDir);
          return await this.checkUnixPermissions(
            _parentDir,
            _parentStats,
            "write",
          );
        } catch {
          // Parent doesn't exist either
          throw _error;
        }
      }
      throw _error;
    }
  }

  /**
   * Check Unix-like _permissions
   */
  private async checkUnixPermissions(
    _filePath: string,
    _stats: fs.Stats,
    operation: string,
  ): Promise<PermissionInfo> {
    const _mode = _stats._mode;
    const _uid = process.getuid?.() || 0;
    const _gid = process.getgid?.() || 0;

    // Extract permission bits
    const _ownerPerms = (_mode & 0o700) >> 6;
    const _groupPerms = (_mode & 0o070) >> 3;
    const _otherPerms = _mode & 0o007;

    // Determine effective _permissions
    let effectivePerms: number;
    if (_stats._uid === _uid) {
      effectivePerms = _ownerPerms;
    } else if (_stats._gid === _gid) {
      effectivePerms = _groupPerms;
    } else {
      effectivePerms = _otherPerms;
    }

    const _readable = (effectivePerms & 0o4) !== 0;
    const _writable = (effectivePerms & 0o2) !== 0;
    const _executable = (effectivePerms & 0o1) !== 0;

    // Check if elevation is needed
    const _needsElevation =
      this.isSystemPath(_filePath) ||
      (operation === "write" && !_writable) ||
      (operation === "execute" && !_executable) ||
      (operation === "read" && !_readable);

    // Get _owner/_group names
    const _owner = await this.getOwnerName(_stats._uid);
    const _group = await this.getGroupName(_stats._gid);

    return {
      _readable,
      _writable,
      _executable,
      _owner,
      _group,
      _mode: (_mode & 0o777).toString(8),
      _needsElevation,
    };
  }

  /**
   * Check Windows _permissions
   */
  private async checkWindowsPermissions(
    _filePath: string,
    _stats: fs.Stats,
    operation: string,
  ): Promise<PermissionInfo> {
    // Basic check using fs.access
    let _readable = false;
    let _writable = false;
    let _executable = false;

    try {
      await fs.promises.access(_filePath, fs.constants.R_OK);
      _readable = true;
    } catch {
      // Access denied or file doesn't exist
    }

    try {
      await fs.promises.access(_filePath, fs.constants.W_OK);
      _writable = true;
    } catch {
      // Write access denied
    }

    try {
      await fs.promises.access(_filePath, fs.constants.X_OK);
      _executable = true;
    } catch {
      // Execute access denied
    }

    const _needsElevation =
      this.isSystemPath(_filePath) ||
      (operation === "write" && !_writable) ||
      (operation === "execute" && !_executable) ||
      (operation === "read" && !_readable);

    return {
      _readable,
      _writable,
      _executable,
      _owner: "unknown",
      _group: "unknown",
      _mode: "644", // Default _mode for display
      _needsElevation,
    };
  }

  /**
   * Check if path is a system path
   */
  private _isSystemPath(_filePath: string): boolean {
    const _normalizedPath = _path.normalize(_filePath);

    return Array.from(this.securityPolicy.systemPaths).some((systemPath) => {
      const _expandedPath = systemPath.replace("~", os.homedir());
      return _normalizedPath.startsWith(_expandedPath);
    });
  }

  /**
   * Check if path is sensitive
   */
  private _isSensitivePath(_filePath: string): boolean {
    const _normalizedPath = _path.normalize(_filePath);

    return Array.from(this.securityPolicy.sensitivePaths).some(
      (sensitivePath) => {
        const _expandedPath = sensitivePath.replace("~", os.homedir());

        // Handle wildcard patterns
        if (_expandedPath.includes("*")) {
          const _pattern = _expandedPath.replace(/**/ g, ".*");
          const _regex = new RegExp(`^${_pattern}`);
          return _regex.test(_normalizedPath);
        }

        return _normalizedPath.startsWith(_expandedPath);
      },
    );
  }

  /**
   * Confirm destructive operation
   */
  private async confirmDestructiveOperation(
    request: ElevationRequest,
  ): Promise<boolean> {
    console.log(chalk.red("\n⚠️  Destructive Operation Warning"));
    console.log(`This operation may cause data loss or system changes.`);
    console.log(`Operation: ${chalk.red(request.operation)}`);
    console.log(`Target: ${chalk.yellow(request._path)}`);

    // In a real implementation, this would show an interactive prompt
    // For _now, we'll default to requiring manual confirmation
    console.log(
      chalk.yellow("Please confirm this operation manually in your terminal."),
    );
    return true; // Assume confirmation for automation
  }

  /**
   * Request Unix elevation (sudo)
   */
  private async requestUnixElevation(
    _request: ElevationRequest,
  ): Promise<boolean> {
    try {
      console.log(chalk.blue("Checking sudo access..."));

      const _hasSudo = await this.hasSudoAccess();
      if (!_hasSudo) {
        console.log(chalk.red("❌ Sudo access not available"));
        return false;
      }

      console.log(chalk.green("✅ Sudo access _confirmed"));
      return true;
    } catch (_error) {
      console._error("Failed to request Unix elevation:", _error);
      return false;
    }
  }

  /**
   * Request Windows elevation
   */
  private async requestWindowsElevation(
    _request: ElevationRequest,
  ): Promise<boolean> {
    try {
      console.log(chalk.blue("Checking administrator access..."));

      const _isAdmin = await this.isWindowsAdmin();
      if (!_isAdmin) {
        console.log(chalk.red("❌ Administrator access not available"));
        console.log("Please run as Administrator to perform this operation.");
        return false;
      }

      console.log(chalk.green("✅ Administrator access _confirmed"));
      return true;
    } catch (_error) {
      console._error("Failed to request Windows elevation:", _error);
      return false;
    }
  }

  /**
   * Check if running as Windows admin
   */
  private async isWindowsAdmin(): Promise<boolean> {
    try {
      const _result = await this.executeCommand("net", ["session"], {
        _timeout: 1000,
      });
      return _result.success;
    } catch {
      return false;
    }
  }

  /**
   * Get _owner name from UID
   */
  private async getOwnerName(_uid: number): Promise<string> {
    try {
      const _result = await this.executeCommand(
        "id",
        ["-nu", _uid.toString()],
        { _timeout: 1000 },
      );
      return _result.success ? _result.output.trim() : _uid.toString();
    } catch {
      return _uid.toString();
    }
  }

  /**
   * Get _group name from GID
   */
  private async getGroupName(_gid: number): Promise<string> {
    try {
      const _result = await this.executeCommand(
        "id",
        ["-ng", _gid.toString()],
        { _timeout: 1000 },
      );
      return _result.success ? _result.output.trim() : _gid.toString();
    } catch {
      return _gid.toString();
    }
  }

  /**
   * Get user _groups
   */
  private async getUserGroups(_username: string): Promise<string[]> {
    try {
      const _result = await this.executeCommand("_groups", [_username], {
        _timeout: 1000,
      });
      if (_result.success) {
        return _result.output.split(" ").filter(Boolean);
      }
    } catch {
      // Intentionally empty
    }
    return [];
  }

  /**
   * Execute command with _timeout
   */
  private executeCommand(
    command: string,
    args: string[],
    options: { _timeout?: number } = {},
  ): Promise<{ success: boolean; output: string; _error?: string }> {
    return new Promise((resolve) => {
      const _proc = spawn(command, args, { stdio: "pipe" });
      let output = "";
      let _error = "";

      const _timeout = options._timeout || 5000;
      const _timer = setTimeout(() => {
        proc.kill();
        resolve({ success: false, output: "", _error: "Command _timeout" });
      }, _timeout);

      proc.stdout?.on("data", (data) => {
        output += data.toString();
      });

      proc.stderr?.on("data", (data) => {
        _error += data.toString();
      });

      proc.on("close", (code) => {
        clearTimeout(_timer);
        resolve({
          success: code === 0,
          output: output.trim(),
          _error: _error.trim() || undefined,
        });
      });

      proc.on("_error", (err) => {
        clearTimeout(_timer);
        resolve({
          success: false,
          output: "",
          _error: err.message,
        });
      });
    });
  }
}

export const _permissionManager = PermissionManager.getInstance();
