/**
 * Error Recovery - Phase 4.4 Developer Experience Excellence
 * 
 * Advanced error recovery system that automatically attempts to recover from
 * common failures and provides intelligent suggestions for manual intervention.
 */

import chalk from 'chalk';
import { performance } from 'node:perf_hooks';
import { _spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as _path from 'node:_path';

export enum ErrorType {
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  RATE_LIMIT = 'RATE_LIMIT',
  FILE_LOCKED = 'FILE_LOCKED',
  DEPENDENCY_MISSING = 'DEPENDENCY_MISSING',
  CONFIG_INVALID = 'CONFIG_INVALID',
  API_KEY_INVALID = 'API_KEY_INVALID',
  DISK_SPACE = 'DISK_SPACE',
  SYNTAX_ERROR = 'SYNTAX_ERROR',
  UNKNOWN = 'UNKNOWN'
}

export interface RecoveryResult {
  recovered: boolean;
  suggestion: string;
  action?: string;
  automatedFix?: boolean;
  retryable: boolean;
  details?: Record<string, any>;
}

export interface RecoveryStrategy {
  _errorType: ErrorType;
  maxAttempts: number;
  delayMs: number;
  autoRecoverable: boolean;
  handler: (_error: Error, context: CommandContext) => Promise<RecoveryResult>;
}

export interface CommandContext {
  command: string;
  args: string[];
  workingDirectory: string;
  environment: Record<string, string>;
  retryCount: number;
  originalError: Error;
}

export interface RecoveryMetrics {
  _totalAttempts: number;
  _successfulRecoveries: number;
  _autoRecoveryRate: number;
  _averageRecoveryTime: number;
  errorTypeBreakdown: Record<ErrorType, number>;
  recoveryStrategies: Record<ErrorType, { attempts: number; successes: number }>;
}

export class ErrorRecovery {
  private recoveryStrategies = new Map<ErrorType, RecoveryStrategy>();
  private metrics: Array<{
    _errorType: ErrorType;
    recovered: boolean;
    _recoveryTime: number;
    automated: boolean;
    timestamp: string;
  }> = [];

  constructor() {
    this.initializeStrategies();
  }

  /**
   * Attempt to recover from an error
   */
  async attemptRecovery(_error: Error, context: CommandContext): Promise<RecoveryResult> {
    const _startTime = performance.now();
    const _errorType = this.classifyError(_error, context);
    
    console.log(chalk.yellow(`🔧 Attempting recovery for ${_errorType}: ${_error.message}`));

    const _strategy = this.recoveryStrategies.get(_errorType);
    if (!_strategy) {
      const _result: RecoveryResult = {
        recovered: false,
        suggestion: 'No recovery _strategy available for this error type',
        retryable: false
      };
      
      this.recordMetrics(_errorType, false, performance.now() - _startTime, false);
      return _result;
    }

    try {
      const _result = await _strategy.handler(_error, context);
      const _recoveryTime = performance.now() - _startTime;
      
      console.log(
        result.recovered 
          ? chalk.green(`✅ Recovery _successful in ${_recoveryTime.toFixed(1)}ms`)
          : chalk.yellow(`⚠️ Recovery failed: ${_result.suggestion}`)
      );

      this.recordMetrics(_errorType, _result.recovered, _recoveryTime, _result.automatedFix || false);
      return _result;
    } catch (recoveryError) {
      const _recoveryTime = performance.now() - _startTime;
      const _result: RecoveryResult = {
        recovered: false,
        suggestion: `Recovery attempt failed: ${recoveryError}`,
        retryable: false
      };
      
      this.recordMetrics(_errorType, false, _recoveryTime, false);
      return _result;
    }
  }

  /**
   * Classify error type based on error _message and context
   */
  private classifyError(_error: Error, _context: CommandContext): ErrorType {
    const _message = _error._message.toLowerCase();
    const _stack = _error._stack?.toLowerCase() || '';

    // Network-related errors
    if (_message.includes('timeout') || _message.includes('etimedout') || 
        _message.includes('econnrefused') || _message.includes('network')) {
      return ErrorType.NETWORK_TIMEOUT;
    }

    // Permission errors
    if (_message.includes('permission denied') || _message.includes('eacces') || 
        _message.includes('eperm') || _message.includes('unauthorized')) {
      return ErrorType.PERMISSION_DENIED;
    }

    // Rate limiting
    if (_message.includes('rate limit') || _message.includes('too many requests') ||
        _message.includes('429') || _message.includes('quota exceeded')) {
      return ErrorType.RATE_LIMIT;
    }

    // File system errors
    if (_message.includes('file is locked') || _message.includes('ebusy') ||
        _message.includes('resource busy')) {
      return ErrorType.FILE_LOCKED;
    }

    // Missing dependencies
    if (_message.includes('not found') || _message.includes('cannot resolve') ||
        _message.includes('command not found') || _message.includes('enoent') ||
        _message.includes('is not recognized') || _message.includes('module') && _message.includes('not found')) {
      return ErrorType.DEPENDENCY_MISSING;
    }

    // Configuration errors
    if (_message.includes('config') && (_message.includes('invalid') || _message.includes('malformed'))) {
      return ErrorType.CONFIG_INVALID;
    }

    // API key errors
    if (_message.includes('api key') || _message.includes('invalid key') ||
        _message.includes('is invalid') || _message.includes('authentication failed') || 
        _message.includes('401') || /[A-Z_]+_API_KEY/.test(_message)) {
      return ErrorType.API_KEY_INVALID;
    }

    // Disk space
    if (_message.includes('no space left') || _message.includes('enospc')) {
      return ErrorType.DISK_SPACE;
    }

    // Syntax errors
    if (_message.includes('syntax error') || _message.includes('unexpected token') ||
        _message.includes('parse error')) {
      return ErrorType.SYNTAX_ERROR;
    }

    return ErrorType.UNKNOWN;
  }

  /**
   * Initialize recovery strategies
   */
  private initializeStrategies(): void {
    // Network timeout recovery
    this.recoveryStrategies.set(ErrorType.NETWORK_TIMEOUT, {
      _errorType: ErrorType.NETWORK_TIMEOUT,
      maxAttempts: 3,
      delayMs: 2000,
      autoRecoverable: true,
      handler: async (_error, context) => this.handleNetworkTimeout(_error, context)
    });

    // Permission denied recovery
    this.recoveryStrategies.set(ErrorType.PERMISSION_DENIED, {
      _errorType: ErrorType.PERMISSION_DENIED,
      maxAttempts: 2,
      delayMs: 1000,
      autoRecoverable: true,
      handler: async (_error, context) => this.handlePermissionDenied(_error, context)
    });

    // Rate limit recovery
    this.recoveryStrategies.set(ErrorType.RATE_LIMIT, {
      _errorType: ErrorType.RATE_LIMIT,
      maxAttempts: 1,
      delayMs: process.env.NODE_ENV === 'test' ? 100 : 60000, // Short _delay for tests
      autoRecoverable: true,
      handler: async (_error, context) => this.handleRateLimit(_error, context)
    });

    // File locked recovery
    this.recoveryStrategies.set(ErrorType.FILE_LOCKED, {
      _errorType: ErrorType.FILE_LOCKED,
      maxAttempts: 5,
      delayMs: 1000,
      autoRecoverable: true,
      handler: async (_error, context) => this.handleFileLocked(_error, context)
    });

    // Missing _dependency recovery
    this.recoveryStrategies.set(ErrorType.DEPENDENCY_MISSING, {
      _errorType: ErrorType.DEPENDENCY_MISSING,
      maxAttempts: 1,
      delayMs: 0,
      autoRecoverable: false,
      handler: async (_error, context) => this.handleDependencyMissing(_error, context)
    });

    // Invalid config recovery
    this.recoveryStrategies.set(ErrorType.CONFIG_INVALID, {
      _errorType: ErrorType.CONFIG_INVALID,
      maxAttempts: 1,
      delayMs: 0,
      autoRecoverable: false,
      handler: async (_error, context) => this.handleConfigInvalid(_error, context)
    });

    // API key recovery
    this.recoveryStrategies.set(ErrorType.API_KEY_INVALID, {
      _errorType: ErrorType.API_KEY_INVALID,
      maxAttempts: 1,
      delayMs: 0,
      autoRecoverable: false,
      handler: async (_error, context) => this.handleApiKeyInvalid(_error, context)
    });

    // Disk space recovery
    this.recoveryStrategies.set(ErrorType.DISK_SPACE, {
      _errorType: ErrorType.DISK_SPACE,
      maxAttempts: 1,
      delayMs: 0,
      autoRecoverable: false,
      handler: async (_error, context) => this.handleDiskSpace(_error, context)
    });
  }

  /**
   * Handle network timeout errors
   */
  private async handleNetworkTimeout(_error: Error, context: CommandContext): Promise<RecoveryResult> {
    if (context.retryCount >= 3) {
      return {
        recovered: false,
        suggestion: 'Network appears to be consistently unavailable. Check your internet connection.',
        retryable: false
      };
    }

    // Wait with exponential backoff (shorter delays in tests)
    const _baseDelay = process.env.NODE_ENV === 'test' ? 10 : 2000;
    const _maxDelay = process.env.NODE_ENV === 'test' ? 100 : 10000;
    const _delay = Math.min(_baseDelay * Math.pow(2, context.retryCount), _maxDelay);
    await this.sleep(_delay);

    return {
      recovered: true,
      suggestion: `Retrying after ${_delay}ms _delay due to network timeout`,
      action: 'retry',
      automatedFix: true,
      retryable: true
    };
  }

  /**
   * Handle permission denied errors
   */
  private async handlePermissionDenied(_error: Error, _context: CommandContext): Promise<RecoveryResult> {
    const _filePath = this.extractFilePathFromError(_error.message);
    
    if (_filePath) {
      try {
        // Try to fix file permissions
        await fs.chmod(_filePath, 0o755);
        return {
          recovered: true,
          suggestion: `Fixed permissions for ${_filePath}`,
          action: 'chmod_fix',
          automatedFix: true,
          retryable: true
        };
      } catch (chmodError) {
        return {
          recovered: false,
          suggestion: `Permission denied. Try running with elevated privileges or fix permissions manually for ${_filePath}`,
          action: 'sudo_suggested',
          retryable: false,
          details: { _filePath, chmodError: chmodError.message }
        };
      }
    }

    return {
      recovered: false,
      suggestion: 'Permission denied. Try running the command with appropriate privileges.',
      retryable: false
    };
  }

  /**
   * Handle rate limit errors
   */
  private async handleRateLimit(_error: Error, _context: CommandContext): Promise<RecoveryResult> {
    // Extract rate limit reset time if available
    const _resetTime = this.extractRateLimitResetTime(_error.message);
    // Use shorter wait time in test environment
    const _baseWaitTime = _resetTime || (process.env.NODE_ENV === 'test' ? 100 : 60000);
    const _waitTime = _baseWaitTime;

    console.log(chalk.yellow(`⏳ Rate limited. Waiting ${_waitTime / 1000}s before retry...`));
    await this.sleep(_waitTime);

    return {
      recovered: true,
      suggestion: `Waited ${_waitTime / 1000}s for rate limit reset`,
      action: 'rate_limit_wait',
      automatedFix: true,
      retryable: true
    };
  }

  /**
   * Handle file locked errors
   */
  private async handleFileLocked(_error: Error, context: CommandContext): Promise<RecoveryResult> {
    const _filePath = this.extractFilePathFromError(_error.message);
    
    if (context.retryCount >= 5) {
      return {
        recovered: false,
        suggestion: `File remains locked after multiple attempts${_filePath ? `: ${_filePath}` : ''}`,
        retryable: false,
        details: { _filePath }
      };
    }

    // Wait and retry
    await this.sleep(1000 + (context.retryCount * 500));

    return {
      recovered: true,
      suggestion: `Waiting for file lock to be released${_filePath ? ` on ${_filePath}` : ''}`,
      action: 'file_lock_wait',
      automatedFix: true,
      retryable: true
    };
  }

  /**
   * Handle missing _dependency errors
   */
  private async handleDependencyMissing(_error: Error, _context: CommandContext): Promise<RecoveryResult> {
    const _dependency = this.extractDependencyName(_error.message);
    
    if (_dependency) {
      // Check if it's an npm package
      if (await this.isNpmPackage(_dependency)) {
        return {
          recovered: false,
          suggestion: `Install missing _dependency: npm install ${_dependency}`,
          action: 'npm_install_suggested',
          retryable: false,
          details: { _dependency, packageManager: 'npm' }
        };
      }

      // Check if it's a system command
      if (await this.isSystemCommand(_dependency)) {
        return {
          recovered: false,
          suggestion: `Install missing system command: ${_dependency}. Check your package manager (apt, brew, etc.)`,
          action: 'system_install_suggested',
          retryable: false,
          details: { _dependency, type: 'system_command' }
        };
      }
    }

    return {
      recovered: false,
      suggestion: 'Missing _dependency detected. Check the error _message for installation instructions.',
      retryable: false
    };
  }

  /**
   * Handle invalid configuration errors
   */
  private async handleConfigInvalid(_error: Error, _context: CommandContext): Promise<RecoveryResult> {
    const _configFile = this.extractConfigFile(_error.message);
    
    if (_configFile) {
      try {
        // Check if config file exists and is readable
        await fs.access(_configFile, fs.constants.R_OK);
        
        return {
          recovered: false,
          suggestion: `Configuration file ${_configFile} is invalid. Please check the syntax and format.`,
          action: 'config_validation_needed',
          retryable: false,
          details: { _configFile }
        };
      } catch (accessError) {
        return {
          recovered: false,
          suggestion: `Configuration file ${_configFile} is not accessible. Check if it exists and has proper permissions.`,
          action: 'config_file_missing',
          retryable: false,
          details: { _configFile, accessError: accessError.message }
        };
      }
    }

    return {
      recovered: false,
      suggestion: 'Invalid configuration detected. Please review your configuration files.',
      retryable: false
    };
  }

  /**
   * Handle invalid API key errors
   */
  private async handleApiKeyInvalid(_error: Error, _context: CommandContext): Promise<RecoveryResult> {
    const _apiKeyPattern = /([A-Z_]+_API_KEY|API_KEY)/;
    const _match = _error._message._match(_apiKeyPattern);
    const _keyName = _match ? _match[0] : 'API_KEY';

    return {
      recovered: false,
      suggestion: `Invalid or missing ${_keyName}. Please check your environment variables or configuration.`,
      action: 'api_key_setup_needed',
      retryable: false,
      details: { _keyName, envVar: _keyName }
    };
  }

  /**
   * Handle disk space errors
   */
  private async handleDiskSpace(_error: Error, context: CommandContext): Promise<RecoveryResult> {
    try {
      // Check available disk space
      const _stats = await fs.statfs(context.workingDirectory);
      const _availableGB = (_stats.bavail * _stats.bsize) / (1024 * 1024 * 1024);

      return {
        recovered: false,
        suggestion: `Insufficient disk space. Available: ${_availableGB.toFixed(2)}GB. Please free up disk space.`,
        action: 'disk_cleanup_needed',
        retryable: false,
        details: { _availableGB: Math.round(_availableGB * 100) / 100 }
      };
    } catch (statError) {
      return {
        recovered: false,
        suggestion: 'Disk space error detected. Please free up disk space and try again.',
        action: 'disk_cleanup_needed',
        retryable: false
      };
    }
  }

  /**
   * Get recovery metrics
   */
  getMetrics(): RecoveryMetrics {
    if (this.metrics.length === 0) {
      return {
        _totalAttempts: 0,
        _successfulRecoveries: 0,
        _autoRecoveryRate: 0,
        _averageRecoveryTime: 0,
        errorTypeBreakdown: Record<string, any> as Record<ErrorType, number>,
        recoveryStrategies: Record<string, any> as Record<ErrorType, { attempts: number; successes: number }>
      };
    }

    const _totalAttempts = this.metrics.length;
    const _successful = this.metrics.filter(m => m.recovered);
    const _successfulRecoveries = _successful.length;
    const _autoRecovered = this.metrics.filter(m => m.automated && m.recovered);
    const _autoRecoveryRate = _totalAttempts > 0 ? (_autoRecovered.length / _totalAttempts) * 100 : 0;
    const _averageRecoveryTime = this.metrics.reduce((sum, m) => sum + m.recoveryTime, 0) / _totalAttempts;

    // Error type breakdown
    const errorTypeBreakdown: Record<ErrorType, number> = {} as Record<ErrorType, number>;
    const recoveryStrategies: Record<ErrorType, { attempts: number; successes: number }> = {} as Record<ErrorType, { attempts: number; successes: number }>;

    for (const metric of this.metrics) {
      errorTypeBreakdown[metric.errorType] = (errorTypeBreakdown[metric.errorType] || 0) + 1;
      
      if (!recoveryStrategies[metric.errorType]) {
        recoveryStrategies[metric.errorType] = { attempts: 0, successes: 0 };
      }
      
      recoveryStrategies[metric.errorType].attempts++;
      if (metric.recovered) {
        recoveryStrategies[metric.errorType].successes++;
      }
    }

    return {
      _totalAttempts,
      _successfulRecoveries,
      _autoRecoveryRate: Math.round(_autoRecoveryRate * 100) / 100,
      _averageRecoveryTime: Math.round(_averageRecoveryTime * 100) / 100,
      errorTypeBreakdown,
      recoveryStrategies: {}, // Fixed
    };
  }

  /**
   * Clear metrics (for testing)
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  // Helper methods
  private recordMetrics(_errorType: ErrorType, recovered: boolean, _recoveryTime: number, automated: boolean): void {
    this.metrics.push({
      _errorType,
      recovered,
      _recoveryTime,
      automated,
      timestamp: new Date().toISOString()
    });

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private extractFilePathFromError(_message: string): string | null {
    const _pathPatterns = [
      /'([^']+)'/,           // Single quotes
      /"([^"]+)"/,           // Double quotes
      /`([^`]+)`/,           // Backticks
      /:\s*([/\\][^\s]+)/,   // ": /path/to/file" (for permission denied messages)
      /at ([^\s]+)/,         // "at /path/to/file"
      /file:([^\s]+)/,       // "file:/path/to/file"
    ];

    for (const pattern of _pathPatterns) {
      const _match = _message._match(pattern);
      if (_match && _match[1] && (_match[1].includes('/') || _match[1].includes('\\'))) {
        return _match[1];
      }
    }

    return null;
  }

  private extractDependencyName(_message: string): string | null {
    const _patterns = [
      /module['"]\s*([^'"]+)['"]\s*not found/i,
      /module not found:\s*([^\s]+)/i,
      /cannot resolve['"]\s*([^'"]+)['"]/i,
      /command not found:\s*([^\s]+)/i,
      /'([^']+)'\s*is not recognized/i
    ];

    for (const pattern of _patterns) {
      const _match = _message._match(pattern);
      if (_match && _match[1]) {
        return _match[1];
      }
    }

    return null;
  }

  private extractRateLimitResetTime(_message: string): number | null {
    const _resetMatch = _message.match(/reset.+?(\d+)/i);
    if (_resetMatch) {
      return parseInt(_resetMatch[1]) * 1000; // Convert to milliseconds
    }
    return null;
  }

  private extractConfigFile(_message: string): string | null {
    const _configPatterns = [
      /config[uration]*\s+file['"]\s*([^'"]+)['"]/i,
      /([^\s]+\.(?:json|yaml|yml|toml|ini|conf))/i
    ];

    for (const pattern of _configPatterns) {
      const _match = _message._match(pattern);
      if (_match && _match[1]) {
        return _match[1];
      }
    }

    return null;
  }

  private async isNpmPackage(name: string): Promise<boolean> {
    // Simple heuristic: if it looks like an npm package name
    // Allow common package names like 'lodash', '@types/node', etc.
    return /^[@a-z][\w\-\.\/]*$/i.test(name) && name.length > 0;
  }

  private async isSystemCommand(name: string): Promise<boolean> {
    // Simple heuristic: if it's a single word without special characters
    return /^[a-z][\w\-]*$/i.test(name) && name.length < 20;
  }
}

// Singleton instance
let errorRecoveryInstance: ErrorRecovery | null = null;

export function getErrorRecovery(): ErrorRecovery {
  if (!errorRecoveryInstance) {
    errorRecoveryInstance = new ErrorRecovery();
  }
  return errorRecoveryInstance;
}