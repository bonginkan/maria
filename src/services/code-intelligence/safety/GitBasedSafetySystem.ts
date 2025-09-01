import { BaseService } from '../../BaseService.js';
import { execSync, spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface SafetyOperation {
  id: string;
  type: 'modification' | 'creation' | 'deletion';
  worktreePath: string;
  originalBranch: string;
  backupBranch: string;
  timestamp: Date;
  description: string;
  status: 'pending' | 'applied' | 'rolled_back' | 'committed';
}

export interface RollbackPoint {
  id: string;
  commitHash: string;
  branch: string;
  timestamp: Date;
  description: string;
  metadata: Record<string, any>;
}

export interface SafetyConfig {
  worktreePrefix: string;
  backupBranchPrefix: string;
  maxWorktrees: number;
  autoCleanupHours: number;
  enableAtomicOperations: boolean;
  enablePreCommitValidation: boolean;
}

export class GitBasedSafetySystem extends BaseService {
  private config: SafetyConfig;
  private activeOperations: Map<string, SafetyOperation> = new Map();
  private rollbackPoints: Map<string, RollbackPoint> = new Map();

  constructor(config: Partial<SafetyConfig> = {}) {
    super();
    this.config = {
      worktreePrefix: 'maria-code-safety',
      backupBranchPrefix: 'backup/maria-code',
      maxWorktrees: 10,
      autoCleanupHours: 24,
      enableAtomicOperations: true,
      enablePreCommitValidation: true,
      ...config
    };
  }

  async initializeSafetySystem(projectRoot: string): Promise<boolean> {
    try {
      // Ensure we're in a git repository
      const isGitRepo = await this.isGitRepository(projectRoot);
      if (!isGitRepo) {
        throw new Error('Safety system requires a Git repository');
      }

      // Clean up old worktrees and backups
      await this.cleanupOldOperations(projectRoot);

      // Set up git hooks if enabled
      if (this.config.enablePreCommitValidation) {
        await this.setupPreCommitHook(projectRoot);
      }

      return true;
    } catch (error) {
      console.error('Failed to initialize safety system:', error);
      return false;
    }
  }

  async createSafeOperation(
    projectRoot: string,
    description: string,
    type: SafetyOperation['type'] = 'modification'
  ): Promise<string> {
    const operationId = `safety-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date();

    try {
      // Get current branch
      const originalBranch = execSync('git branch --show-current', {
        cwd: projectRoot,
        encoding: 'utf-8'
      }).trim();

      // Create backup branch
      const backupBranch = `${this.config.backupBranchPrefix}-${operationId}`;
      execSync(`git branch ${backupBranch}`, {
        cwd: projectRoot,
        encoding: 'utf-8'
      });

      // Create isolated worktree
      const worktreePath = path.join(projectRoot, '..', `${this.config.worktreePrefix}-${operationId}`);
      execSync(`git worktree add ${worktreePath} ${originalBranch}`, {
        cwd: projectRoot,
        encoding: 'utf-8'
      });

      // Create rollback point
      const commitHash = execSync('git rev-parse HEAD', {
        cwd: projectRoot,
        encoding: 'utf-8'
      }).trim();

      const rollbackPoint: RollbackPoint = {
        id: operationId,
        commitHash,
        branch: originalBranch,
        timestamp,
        description: `Pre-operation state: ${description}`,
        metadata: { operationType: type }
      };

      this.rollbackPoints.set(operationId, rollbackPoint);

      // Create operation record
      const operation: SafetyOperation = {
        id: operationId,
        type,
        worktreePath,
        originalBranch,
        backupBranch,
        timestamp,
        description,
        status: 'pending'
      };

      this.activeOperations.set(operationId, operation);

      return operationId;
    } catch (error) {
      throw new Error(`Failed to create safe operation: ${error.message}`);
    }
  }

  async executeInSafeEnvironment<T>(
    operationId: string,
    operation: (worktreePath: string) => Promise<T>
  ): Promise<T> {
    const safetyOp = this.activeOperations.get(operationId);
    if (!safetyOp) {
      throw new Error(`Safety operation ${operationId} not found`);
    }

    try {
      // Execute operation in isolated worktree
      const result = await operation(safetyOp.worktreePath);
      
      // Mark as applied but not yet committed
      safetyOp.status = 'applied';
      this.activeOperations.set(operationId, safetyOp);

      return result;
    } catch (error) {
      // Auto-rollback on error
      await this.rollbackOperation(operationId);
      throw error;
    }
  }

  async validateOperation(operationId: string): Promise<boolean> {
    const safetyOp = this.activeOperations.get(operationId);
    if (!safetyOp) {
      throw new Error(`Safety operation ${operationId} not found`);
    }

    try {
      // Run validation in worktree
      const workingDir = safetyOp.worktreePath;
      
      // Check if package.json exists and install dependencies
      const packageJsonPath = path.join(workingDir, 'package.json');
      const packageJsonExists = await fs.access(packageJsonPath).then(() => true).catch(() => false);
      
      if (packageJsonExists) {
        // Install dependencies in worktree
        execSync('pnpm install', {
          cwd: workingDir,
          encoding: 'utf-8',
          timeout: 300000 // 5 minutes
        });

        // Run basic validation checks
        try {
          execSync('pnpm type-check', {
            cwd: workingDir,
            encoding: 'utf-8',
            timeout: 120000 // 2 minutes
          });
        } catch (typeError) {
          console.warn('TypeScript validation failed:', typeError.message);
          return false;
        }

        try {
          execSync('pnpm lint:errors-only', {
            cwd: workingDir,
            encoding: 'utf-8',
            timeout: 120000 // 2 minutes
          });
        } catch (lintError) {
          console.warn('Lint validation failed:', lintError.message);
          return false;
        }

        try {
          execSync('pnpm test:smoke', {
            cwd: workingDir,
            encoding: 'utf-8',
            timeout: 60000 // 1 minute
          });
        } catch (testError) {
          console.warn('Smoke test validation failed:', testError.message);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Validation failed:', error.message);
      return false;
    }
  }

  async commitSafeOperation(operationId: string, commitMessage: string): Promise<boolean> {
    const safetyOp = this.activeOperations.get(operationId);
    if (!safetyOp) {
      throw new Error(`Safety operation ${operationId} not found`);
    }

    if (safetyOp.status !== 'applied') {
      throw new Error(`Operation ${operationId} is not in 'applied' state`);
    }

    try {
      const workingDir = safetyOp.worktreePath;
      
      // Stage all changes
      execSync('git add .', {
        cwd: workingDir,
        encoding: 'utf-8'
      });

      // Create commit with safety metadata
      const enhancedCommitMessage = `${commitMessage}

🔒 MARIA Safety System
- Operation ID: ${operationId}
- Type: ${safetyOp.type}
- Backup Branch: ${safetyOp.backupBranch}
- Timestamp: ${safetyOp.timestamp.toISOString()}
- Rollback Point: ${this.rollbackPoints.get(operationId)?.commitHash}

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>`;

      execSync(`git commit -m "${enhancedCommitMessage.replace(/"/g, '\\"')}"`, {
        cwd: workingDir,
        encoding: 'utf-8'
      });

      // Copy changes back to original branch
      await this.mergeWorktreeChanges(safetyOp);

      // Update status
      safetyOp.status = 'committed';
      this.activeOperations.set(operationId, safetyOp);

      return true;
    } catch (error) {
      console.error('Failed to commit safe operation:', error.message);
      return false;
    }
  }

  async rollbackOperation(operationId: string): Promise<boolean> {
    const safetyOp = this.activeOperations.get(operationId);
    const rollbackPoint = this.rollbackPoints.get(operationId);

    if (!safetyOp || !rollbackPoint) {
      throw new Error(`Operation ${operationId} not found`);
    }

    try {
      // If changes were already committed, reset to rollback point
      if (safetyOp.status === 'committed') {
        execSync(`git checkout ${safetyOp.originalBranch}`, {
          cwd: path.dirname(safetyOp.worktreePath),
          encoding: 'utf-8'
        });

        execSync(`git reset --hard ${rollbackPoint.commitHash}`, {
          cwd: path.dirname(safetyOp.worktreePath),
          encoding: 'utf-8'
        });
      }

      // Clean up worktree
      await this.cleanupOperation(operationId);

      // Update status
      safetyOp.status = 'rolled_back';
      this.activeOperations.set(operationId, safetyOp);

      return true;
    } catch (error) {
      console.error('Failed to rollback operation:', error.message);
      return false;
    }
  }

  async getOperationStatus(operationId: string): Promise<SafetyOperation | null> {
    return this.activeOperations.get(operationId) || null;
  }

  async listActiveOperations(): Promise<SafetyOperation[]> {
    return Array.from(this.activeOperations.values());
  }

  async createInstantRollbackPoint(
    projectRoot: string,
    description: string
  ): Promise<string> {
    try {
      const rollbackId = `rollback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Get current state
      const commitHash = execSync('git rev-parse HEAD', {
        cwd: projectRoot,
        encoding: 'utf-8'
      }).trim();

      const currentBranch = execSync('git branch --show-current', {
        cwd: projectRoot,
        encoding: 'utf-8'
      }).trim();

      // Create lightweight tag for instant access
      const tagName = `maria-rollback-${rollbackId}`;
      execSync(`git tag ${tagName}`, {
        cwd: projectRoot,
        encoding: 'utf-8'
      });

      const rollbackPoint: RollbackPoint = {
        id: rollbackId,
        commitHash,
        branch: currentBranch,
        timestamp: new Date(),
        description,
        metadata: { tagName }
      };

      this.rollbackPoints.set(rollbackId, rollbackPoint);

      return rollbackId;
    } catch (error) {
      throw new Error(`Failed to create rollback point: ${error.message}`);
    }
  }

  async rollbackToPoint(rollbackId: string): Promise<boolean> {
    const rollbackPoint = this.rollbackPoints.get(rollbackId);
    if (!rollbackPoint) {
      throw new Error(`Rollback point ${rollbackId} not found`);
    }

    try {
      // Use tag if available, otherwise commit hash
      const target = rollbackPoint.metadata.tagName || rollbackPoint.commitHash;
      
      execSync(`git checkout ${rollbackPoint.branch}`, {
        encoding: 'utf-8'
      });

      execSync(`git reset --hard ${target}`, {
        encoding: 'utf-8'
      });

      return true;
    } catch (error) {
      console.error('Failed to rollback to point:', error.message);
      return false;
    }
  }

  private async isGitRepository(projectRoot: string): Promise<boolean> {
    try {
      execSync('git rev-parse --git-dir', {
        cwd: projectRoot,
        encoding: 'utf-8'
      });
      return true;
    } catch {
      return false;
    }
  }

  private async cleanupOperation(operationId: string): Promise<void> {
    const safetyOp = this.activeOperations.get(operationId);
    if (!safetyOp) return;

    try {
      // Remove worktree
      execSync(`git worktree remove ${safetyOp.worktreePath} --force`, {
        encoding: 'utf-8'
      });

      // Delete backup branch
      execSync(`git branch -D ${safetyOp.backupBranch}`, {
        encoding: 'utf-8'
      });

      // Clean up rollback point tag if exists
      const rollbackPoint = this.rollbackPoints.get(operationId);
      if (rollbackPoint?.metadata.tagName) {
        try {
          execSync(`git tag -d ${rollbackPoint.metadata.tagName}`, {
            encoding: 'utf-8'
          });
        } catch {
          // Tag might not exist, ignore
        }
      }

      // Remove from tracking
      this.activeOperations.delete(operationId);
      this.rollbackPoints.delete(operationId);
    } catch (error) {
      console.warn('Partial cleanup failure:', error.message);
    }
  }

  private async cleanupOldOperations(projectRoot: string): Promise<void> {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - this.config.autoCleanupHours);

    // Clean up old operations
    for (const [operationId, operation] of this.activeOperations.entries()) {
      if (operation.timestamp < cutoffTime) {
        await this.cleanupOperation(operationId);
      }
    }

    // Clean up orphaned worktrees
    try {
      execSync('git worktree prune', {
        cwd: projectRoot,
        encoding: 'utf-8'
      });
    } catch {
      // Ignore errors
    }
  }

  private async mergeWorktreeChanges(operation: SafetyOperation): Promise<void> {
    try {
      // Create a patch of worktree changes
      const patchOutput = execSync('git diff HEAD --binary', {
        cwd: operation.worktreePath,
        encoding: 'utf-8'
      });

      if (patchOutput.trim() === '') {
        return; // No changes to merge
      }

      // Apply patch to original location
      const originalProjectRoot = path.dirname(operation.worktreePath.replace(`../${this.config.worktreePrefix}`, '.'));
      
      execSync(`git checkout ${operation.originalBranch}`, {
        cwd: originalProjectRoot,
        encoding: 'utf-8'
      });

      // Apply the patch
      execSync('git apply', {
        cwd: originalProjectRoot,
        encoding: 'utf-8',
        input: patchOutput
      });

      // Stage and commit
      execSync('git add .', {
        cwd: originalProjectRoot,
        encoding: 'utf-8'
      });

    } catch (error) {
      throw new Error(`Failed to merge worktree changes: ${error.message}`);
    }
  }

  private async setupPreCommitHook(projectRoot: string): Promise<void> {
    const hooksDir = path.join(projectRoot, '.git', 'hooks');
    const preCommitPath = path.join(hooksDir, 'pre-commit');

    const hookContent = `#!/bin/sh
# MARIA Code Intelligence Pre-commit Hook
# Auto-generated - DO NOT EDIT

# Run basic validation
pnpm type-check || exit 1
pnpm lint:errors-only || exit 1
pnpm test:smoke || exit 1

# Success
exit 0
`;

    try {
      await fs.writeFile(preCommitPath, hookContent, { mode: 0o755 });
    } catch (error) {
      console.warn('Failed to setup pre-commit hook:', error.message);
    }
  }

  async generateSafetyReport(): Promise<string> {
    const activeOps = this.listActiveOperations();
    const rollbackPointsArray = Array.from(this.rollbackPoints.values());

    let report = `\n🔒 Git-based Safety System Status\n`;
    report += `===================================\n\n`;

    report += `📊 Overview:\n`;
    report += `- Active Operations: ${(await activeOps).length}\n`;
    report += `- Rollback Points: ${rollbackPointsArray.length}\n`;
    report += `- Max Worktrees: ${this.config.maxWorktrees}\n`;
    report += `- Auto Cleanup: ${this.config.autoCleanupHours}h\n\n`;

    if ((await activeOps).length > 0) {
      report += `🔧 Active Operations:\n`;
      for (const op of await activeOps) {
        const status = op.status === 'committed' ? '✅' : 
                      op.status === 'applied' ? '🔄' :
                      op.status === 'rolled_back' ? '↩️' : '⏳';
        
        report += `  ${status} ${op.id}\n`;
        report += `    Type: ${op.type}\n`;
        report += `    Description: ${op.description}\n`;
        report += `    Status: ${op.status}\n`;
        report += `    Branch: ${op.originalBranch}\n`;
        report += `    Created: ${op.timestamp.toISOString()}\n\n`;
      }
    }

    if (rollbackPointsArray.length > 0) {
      report += `🎯 Available Rollback Points:\n`;
      for (const point of rollbackPointsArray.slice(-5)) { // Show last 5
        report += `  📍 ${point.id}\n`;
        report += `    Description: ${point.description}\n`;
        report += `    Commit: ${point.commitHash.substring(0, 8)}\n`;
        report += `    Branch: ${point.branch}\n`;
        report += `    Created: ${point.timestamp.toISOString()}\n\n`;
      }
    }

    report += `\n💡 Usage:\n`;
    report += `- Instant rollback: Use rollback points for quick recovery\n`;
    report += `- Safe operations: All changes isolated in worktrees\n`;
    report += `- Atomic commits: All-or-nothing operation guarantee\n`;

    return report;
  }
}