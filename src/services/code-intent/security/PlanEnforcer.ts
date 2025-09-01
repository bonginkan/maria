/**
 * Plan Enforcer
 * Enforces plan-based restrictions and conventions
 */

import * as path from 'node:path';
import { ExtensionGuard } from './ExtensionGuard';
import { PathSecurityValidator } from './PathSecurityValidator';
import { CollisionResolver } from './CollisionResolver';
import { filenameInferenceTelemetry } from '../telemetry/FilenameInferenceTelemetry';
import { 
  SaveOperation, 
  PlanFileSaveConfig, 
  NamingConvention,
  PlanViolationError,
  SecurityError
} from '../types/filename-inference.types';

export class PlanEnforcer {
  private extensionGuard: ExtensionGuard;
  private pathValidator: PathSecurityValidator;
  private collisionResolver: CollisionResolver;
  
  constructor(projectRoot: string, configPath?: string) {
    this.extensionGuard = new ExtensionGuard(configPath);
    this.pathValidator = new PathSecurityValidator(projectRoot);
    this.collisionResolver = new CollisionResolver();
  }
  
  /**
   * Enforces all plan restrictions on a save operation
   */
  async enforce(operation: SaveOperation): Promise<SaveOperation> {
    try {
      // Use filepath consistently
      const inputPath = operation.filepath || operation.path;
      if (!inputPath) {
        throw new SecurityError('No file path provided');
      }
      
      // 1. Validate and normalize path
      const safePath = this.pathValidator.validateAndNormalize(inputPath);
      
      // 2. Check extension permission
      const ext = path.extname(safePath).slice(1);
      await this.extensionGuard.checkPermission(operation.planId, ext);
      
      // 3. Check file size
      await this.extensionGuard.checkFileSize(operation.planId, operation.content.length);
      
      // 4. Apply naming convention
      const convention = await this.extensionGuard.getNamingConvention(operation.planId);
      const conventionPath = this.applyNamingConvention(safePath, convention as NamingConvention);
      
      // 5. Resolve collisions
      const finalPath = this.collisionResolver.resolve(conventionPath);
      
      return {
        ...operation,
        filepath: finalPath,
        path: finalPath
      };
    } catch (error) {
      // Record security violation telemetry
      const errorPath = operation.filepath || operation.path || 'unknown';
      if (error instanceof SecurityError) {
        filenameInferenceTelemetry.recordSecurityViolation('path_traversal', {
          path: errorPath,
          planId: operation.planId,
          error: error.message
        });
      } else if (error instanceof PlanViolationError) {
        filenameInferenceTelemetry.recordSecurityViolation('plan_violation', {
          path: errorPath,
          planId: operation.planId,
          error: error.message,
          extension: path.extname(errorPath).slice(1),
          fileSize: operation.content.length
        });
      }
      
      throw error;
    }
  }
  
  /**
   * Validates a save operation without modifying it
   */
  async validate(operation: SaveOperation): Promise<void> {
    const filepath = operation.filepath || operation.path || '';
    
    // Check for path traversal patterns first
    if (filepath.includes('../') || filepath.includes('..\\')) {
      throw new SecurityError(`Invalid filename: ${path.basename(filepath)}`);
    }
    
    // Check path security
    if (!this.pathValidator.validateFilename(path.basename(filepath))) {
      throw new SecurityError(`Invalid filename: ${path.basename(filepath)}`);
    }
    
    // Check extension
    const ext = path.extname(filepath).slice(1);
    if (this.extensionGuard.isDangerousExtension(ext)) {
      throw new SecurityError(`Dangerous extension not allowed: .${ext}`);
    }
    
    await this.extensionGuard.checkPermission(operation.planId, ext);
    
    // Check file size
    await this.extensionGuard.checkFileSize(operation.planId, operation.content.length);
  }
  
  /**
   * Applies naming convention to a filename
   */
  applyNamingConvention(filepath: string, convention: NamingConvention): string {
    const dir = path.dirname(filepath);
    const ext = path.extname(filepath);
    const base = path.basename(filepath, ext);
    
    let converted: string;
    switch (convention) {
      case 'kebab-case':
        converted = this.toKebabCase(base);
        break;
      case 'camelCase':
        converted = this.toCamelCase(base);
        break;
      case 'PascalCase':
        converted = this.toPascalCase(base);
        break;
      case 'snake_case':
        converted = this.toSnakeCase(base);
        break;
      default:
        converted = base;
    }
    
    return path.join(dir, converted + ext);
  }
  
  /**
   * Gets the appropriate directory for a file type
   */
  async getTargetDirectory(planId: string, fileType: string, projectRoot: string): Promise<string> {
    const dir = await this.extensionGuard.getDirectoryForType(planId, fileType);
    if (dir) {
      return path.join(projectRoot, dir);
    }
    
    const defaultDir = await this.extensionGuard.getDefaultDirectory(planId);
    return path.join(projectRoot, defaultDir);
  }
  
  /**
   * Converts string to kebab-case
   */
  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .replace(/[^a-zA-Z0-9\-]/g, '')
      .toLowerCase()
      .replace(/^-+|-+$/g, '');
  }
  
  /**
   * Converts string to camelCase
   */
  private toCamelCase(str: string): string {
    const words = str
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .trim()
      .split(/\s+/);
    
    if (words.length === 0) return '';
    
    return words[0].toLowerCase() + 
      words.slice(1)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
  }
  
  /**
   * Converts string to PascalCase
   */
  private toPascalCase(str: string): string {
    const words = str
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .trim()
      .split(/\s+/);
    
    return words
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }
  
  /**
   * Converts string to snake_case
   */
  private toSnakeCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[\s\-]+/g, '_')
      .replace(/[^a-zA-Z0-9_]/g, '')
      .toLowerCase()
      .replace(/^_+|_+$/g, '');
  }
  
  /**
   * Batch validates multiple operations
   */
  async validateBatch(operations: SaveOperation[]): Promise<Map<string, string | null>> {
    const results = new Map<string, string | null>();
    
    for (const op of operations) {
      try {
        await this.validate(op);
        results.set(op.filepath, null);
      } catch (error) {
        results.set(op.filepath, (error as Error).message);
      }
    }
    
    return results;
  }
  
  /**
   * Gets plan limitations for display
   */
  async getPlanLimitations(planId: string): Promise<{
    maxFileSize: string;
    allowedExtensions: string[];
    totalExtensions: number;
  }> {
    const defaultDir = await this.extensionGuard.getDefaultDirectory(planId);
    const convention = await this.extensionGuard.getNamingConvention(planId);
    
    // Load config to get details
    const config = await this.loadPlanConfig(planId);
    
    return {
      maxFileSize: `${config?.fileSave?.maxFileSizeMB || 5}MB`,
      allowedExtensions: config?.fileSave?.allowExtensions?.slice(0, 10) || [],
      totalExtensions: config?.fileSave?.allowExtensions?.length || 0
    };
  }
  
  /**
   * Helper to load plan config
   */
  private async loadPlanConfig(planId: string): Promise<PlanFileSaveConfig | undefined> {
    // This would typically load from Firestore
    // For now, using the ExtensionGuard's default configs
    try {
      const testOp: SaveOperation = {
        filepath: 'test.txt',
        content: '',
        planId,
        timestamp: Date.now()
      };
      
      // Try to get config by checking a safe extension
      await this.extensionGuard.checkPermission(planId, 'txt');
      
      // If we get here, plan exists
      // In production, this would query Firestore directly
      return undefined;
    } catch {
      return undefined;
    }
  }
}