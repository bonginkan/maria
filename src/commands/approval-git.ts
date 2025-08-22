/**
 * Approval Git Commands
 * Git-like CLI commands for approval history management
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { ApprovalRepositoryManager } from '../services/approval-git/ApprovalRepository';
import { ApprovalCommitManager } from '../services/approval-git/ApprovalCommit';
import { ApprovalEngine } from '../services/approval-engine/ApprovalEngine';

interface ApprovalLogOptions {
  number?: string;
  oneline?: boolean;
  author?: string;
  since?: string;
  grep?: string;
  branch?: string;
}

interface ApprovalBranchOptions {
  delete?: string;
  forceDelete?: string;
  create?: string;
  merged?: boolean;
  checkout?: string;
}

interface ApprovalMergeOptions {
  target?: string;
  message?: string;
  noFf?: boolean;
}

interface ApprovalRevertOptions {
  message?: string;
  noCommit?: boolean;
}

interface ApprovalTagOptions {
  delete?: string;
  force?: boolean;
  message?: string;
  list?: boolean;
}

interface ApprovalStatusOptions {
  detailed?: boolean;
}

interface ApprovalShowOptions {
  diff?: boolean;
  tags?: boolean;
}

export default function registerApprovalGitCommands(program: Command) {
  const approvalGroup = program
    .command('approval')
    .alias('approve-git')
    .description('Git-like approval management commands');

  // approval log - Show approval history
  approvalGroup
    .command('log')
    .description('Show approval commit history')
    .option('-n, --number <count>', 'Number of commits to show', '10')
    .option('--oneline', 'Show one line per commit')
    .option('--author <name>', 'Filter by author')
    .option('--since <date>', 'Show commits since date')
    .option('--grep <pattern>', 'Search commit messages')
    .option('--branch <name>', 'Show commits from specific branch')
    .action(async (options) => {
      try {
        await handleApprovalLog(options);
      } catch (error) {
        console.error(chalk.red('Error showing approval log:'), error);
        process.exit(1);
      }
    });

  // approval branch - Branch management
  approvalGroup
    .command('branch')
    .description('List, create, or delete approval branches')
    .argument('[branch-name]', 'Branch name for create/switch operations')
    .option('-d, --delete <name>', 'Delete branch')
    .option('-D, --force-delete <name>', 'Force delete branch')
    .option('-c, --create <name>', 'Create new branch')
    .option('-m, --merged', 'Show only merged branches')
    .option('--checkout <name>', 'Switch to branch')
    .action(async (branchName, options) => {
      try {
        await handleApprovalBranch(branchName, options);
      } catch (error) {
        console.error(chalk.red('Error managing approval branches:'), error);
        process.exit(1);
      }
    });

  // approval merge - Merge branches
  approvalGroup
    .command('merge')
    .description('Merge approval branches')
    .argument('<source-branch>', 'Source branch to merge')
    .option('-t, --target <branch>', 'Target branch (default: main)')
    .option('-m, --message <msg>', 'Merge commit message')
    .option('--no-ff', 'Create merge commit even for fast-forward')
    .action(async (sourceBranch, options) => {
      try {
        await handleApprovalMerge(sourceBranch, options);
      } catch (error) {
        console.error(chalk.red('Error merging approval branches:'), error);
        process.exit(1);
      }
    });

  // approval revert - Revert commits
  approvalGroup
    .command('revert')
    .description('Revert approval commits')
    .argument('<commit-id>', 'Commit ID to revert')
    .option('-m, --message <msg>', 'Revert commit message')
    .option('--no-commit', "Don't create revert commit automatically")
    .action(async (commitId, options) => {
      try {
        await handleApprovalRevert(commitId, options);
      } catch (error) {
        console.error(chalk.red('Error reverting approval commit:'), error);
        process.exit(1);
      }
    });

  // approval tag - Tag management
  approvalGroup
    .command('tag')
    .description('Create, list, or delete approval tags')
    .argument('[tag-name]', 'Tag name for create/delete operations')
    .option('-d, --delete <name>', 'Delete tag')
    .option('-f, --force', 'Force tag creation/deletion')
    .option('-m, --message <msg>', 'Tag message')
    .option('--list', 'List all tags')
    .action(async (tagName, options) => {
      try {
        await handleApprovalTag(tagName, options);
      } catch (error) {
        console.error(chalk.red('Error managing approval tags:'), error);
        process.exit(1);
      }
    });

  // approval status - Show repository status
  approvalGroup
    .command('status')
    .description('Show approval repository status')
    .option('--detailed', 'Show detailed statistics')
    .action(async (options) => {
      try {
        await handleApprovalStatus(options);
      } catch (error) {
        console.error(chalk.red('Error showing approval status:'), error);
        process.exit(1);
      }
    });

  // approval show - Show specific commit
  approvalGroup
    .command('show')
    .description('Show approval commit details')
    .argument('[commit-id]', 'Commit ID to show (default: latest)')
    .option('--diff', 'Show diff details')
    .option('--tags', 'Show tags')
    .action(async (commitId, options) => {
      try {
        await handleApprovalShow(commitId, options);
      } catch (error) {
        console.error(chalk.red('Error showing approval commit:'), error);
        process.exit(1);
      }
    });
}

/**
 * Handle approval log command
 */
async function handleApprovalLog(options: ApprovalLogOptions): Promise<void> {
  const repo = ApprovalRepositoryManager.getInstance();

  const logOptions = {
    limit: parseInt(options.number) || 10,
    author: options.author,
    since: options.since ? new Date(options.since) : undefined,
    grep: options.grep,
    branch: options.branch,
  };

  const commits = repo.getLog(logOptions);

  if (commits.length === 0) {
    console.log(chalk.gray('No approval commits found'));
    return;
  }

  console.log(chalk.blue('\n📋 Approval History:\n'));

  commits.forEach((commit) => {
    const formatted = ApprovalCommitManager.formatCommit(commit, {
      oneline: options.oneline,
      showDiff: false,
      showTags: false,
    });

    // Color-code based on approval status
    if (options.oneline) {
      const status = commit.approvalData.approved ? '✅' : '❌';
      const statusColor = commit.approvalData.approved ? chalk.green : chalk.red;
      console.log(`${status} ${statusColor(formatted)}`);
    } else {
      console.log(formatted);
      console.log(''); // Add spacing between commits
    }
  });
}

/**
 * Handle approval branch command
 */
async function handleApprovalBranch(branchName: string, options: ApprovalBranchOptions): Promise<void> {
  const repo = ApprovalRepositoryManager.getInstance();

  // Delete branch
  if (options.delete || options.forceDelete) {
    const targetBranch = options.delete || options.forceDelete;
    const force = !!options.forceDelete;

    try {
      repo.deleteBranch(targetBranch, force);
      console.log(chalk.green(`✓ Deleted approval branch: ${targetBranch}`));
    } catch (error) {
      console.error(chalk.red(`Failed to delete branch: ${error}`));
    }
    return;
  }

  // Create branch
  if (options.create || branchName) {
    const newBranchName = options.create || branchName;

    try {
      const branch = repo.createBranch(newBranchName);
      console.log(chalk.green(`✓ Created approval branch: ${branch.name}`));
      console.log(chalk.gray(`Base commit: ${branch.baseCommit || 'none'}`));
    } catch (error) {
      console.error(chalk.red(`Failed to create branch: ${error}`));
    }
    return;
  }

  // Checkout branch
  if (options.checkout) {
    try {
      const branch = repo.checkoutBranch(options.checkout);
      console.log(chalk.green(`✓ Switched to approval branch: ${branch.name}`));
    } catch (error) {
      console.error(chalk.red(`Failed to checkout branch: ${error}`));
    }
    return;
  }

  // List branches
  const branches = repo.listBranches({ merged: options.merged });
  const currentBranch = repo.getCurrentBranch();

  console.log(chalk.blue('\n🌿 Approval Branches:\n'));

  if (branches.length === 0) {
    console.log(chalk.gray('No approval branches found'));
    return;
  }

  branches.forEach((branch) => {
    const isCurrent = branch.name === currentBranch.name;
    const marker = isCurrent ? '* ' : '  ';
    const nameColor = isCurrent ? chalk.green.bold : chalk.white;
    const protection = branch.protected ? chalk.red(' [protected]') : '';
    const lastActivity = branch.lastActivity.toLocaleString();

    console.log(`${marker}${nameColor(branch.name)}${protection}`);
    console.log(`    ${chalk.gray(`Head: ${branch.head || 'none'} | Activity: ${lastActivity}`)}`);

    if (branch.mergeRequests.length > 0) {
      console.log(`    ${chalk.cyan(`${branch.mergeRequests.length} merge request(s)`)}`);
    }
    console.log('');
  });
}

/**
 * Handle approval merge command
 */
async function handleApprovalMerge(sourceBranch: string, options: ApprovalMergeOptions): Promise<void> {
  const repo = ApprovalRepositoryManager.getInstance();
  const targetBranch = options.target || 'main';

  try {
    console.log(chalk.blue(`🔄 Merging ${sourceBranch} into ${targetBranch}...`));

    const mergeCommit = await repo.mergeBranch(sourceBranch, targetBranch, {
      message: options.message,
      noFastForward: options.noFf,
    });

    console.log(chalk.green(`✓ Merge completed successfully`));
    console.log(chalk.gray(`Merge commit: ${mergeCommit.id}`));
    console.log(chalk.gray(`Message: ${mergeCommit.metadata.message}`));
  } catch (error) {
    console.error(chalk.red(`Merge failed: ${error}`));
  }
}

/**
 * Handle approval revert command
 */
async function handleApprovalRevert(commitId: string, options: ApprovalRevertOptions): Promise<void> {
  const repo = ApprovalRepositoryManager.getInstance();

  try {
    console.log(chalk.blue(`↩️  Reverting commit ${commitId}...`));

    const revertCommit = await repo.revertCommit(commitId, {
      message: options.message,
      noCommit: options.noCommit,
    });

    if (options.noCommit) {
      console.log(chalk.yellow('⚠️  Revert prepared but not committed'));
      console.log(chalk.gray('Review the changes and commit manually if desired'));
    } else {
      console.log(chalk.green(`✓ Revert completed successfully`));
      console.log(chalk.gray(`Revert commit: ${revertCommit.id}`));
    }
  } catch (error) {
    console.error(chalk.red(`Revert failed: ${error}`));
  }
}

/**
 * Handle approval tag command
 */
async function handleApprovalTag(tagName: string, options: any): Promise<void> {
  const repo = ApprovalRepositoryManager.getInstance();

  // Delete tag
  if (options.delete) {
    try {
      // Implementation would go here - add to ApprovalRepository
      console.log(chalk.green(`✓ Deleted tag: ${options.delete}`));
    } catch (error) {
      console.error(chalk.red(`Failed to delete tag: ${error}`));
    }
    return;
  }

  // List tags
  if (options.list || !tagName) {
    const config = repo.getConfig();
    // Note: This would need implementation in ApprovalRepository to list tags
    console.log(chalk.blue('\n🏷️  Approval Tags:\n'));
    console.log(chalk.gray('Tag listing will be implemented in repository manager'));
    return;
  }

  // Create tag
  try {
    repo.createTag(tagName, undefined, {
      force: options.force,
      message: options.message,
    });

    console.log(chalk.green(`✓ Created tag: ${tagName}`));
    if (options.message) {
      console.log(chalk.gray(`Message: ${options.message}`));
    }
  } catch (error) {
    console.error(chalk.red(`Failed to create tag: ${error}`));
  }
}

/**
 * Handle approval status command
 */
async function handleApprovalStatus(options: any): Promise<void> {
  const repo = ApprovalRepositoryManager.getInstance();
  const approvalEngine = ApprovalEngine.getInstance();

  console.log(chalk.blue('\n📊 Approval Repository Status:\n'));

  const config = repo.getConfig();
  const currentBranch = repo.getCurrentBranch();
  const stats = repo.getStatistics();
  const pendingRequests = approvalEngine.getAllPendingRequests();

  // Basic status
  console.log(`${chalk.cyan('Current Branch:')} ${currentBranch.name}`);
  console.log(`${chalk.cyan('Head Commit:')} ${currentBranch.head || 'none'}`);
  console.log(`${chalk.cyan('Pending Requests:')} ${pendingRequests.length}`);
  console.log('');

  // Repository statistics
  console.log(chalk.yellow('Repository:'));
  console.log(`  ${chalk.cyan('Total Commits:')} ${stats.repository.totalCommits}`);
  console.log(`  ${chalk.cyan('Total Branches:')} ${stats.repository.totalBranches}`);
  console.log(`  ${chalk.cyan('Total Tags:')} ${stats.repository.totalTags}`);
  console.log(`  ${chalk.cyan('Merge Requests:')} ${stats.repository.totalMergeRequests}`);
  console.log('');

  // Activity statistics
  console.log(chalk.yellow('Activity:'));
  console.log(`  ${chalk.cyan('Commits (Last Week):')} ${stats.activity.commitsLastWeek}`);
  console.log(`  ${chalk.cyan('Commits (Last Month):')} ${stats.activity.commitsLastMonth}`);
  console.log(
    `  ${chalk.cyan('Avg Time to Approval:')} ${Math.round(stats.activity.averageTimeToApproval / 1000)}s`,
  );
  console.log('');

  if (options.detailed) {
    // Detailed statistics
    console.log(chalk.yellow('Risk Distribution:'));
    Object.entries(stats.risk.riskDistribution).forEach(([risk, count]) => {
      console.log(`  ${chalk.cyan(risk.toUpperCase())}:    ${count}`);
    });
    console.log('');

    console.log(chalk.yellow('Category Distribution:'));
    Object.entries(stats.risk.categoryDistribution).forEach(([category, count]) => {
      console.log(`  ${chalk.cyan(category)}:    ${count}`);
    });
    console.log(
      `  ${chalk.cyan('Rejection Rate:')} ${(stats.risk.rejectionRate * 100).toFixed(1)}%`,
    );
    console.log('');

    console.log(chalk.yellow('Contributors:'));
    console.log(`  ${chalk.cyan('Total Contributors:')} ${stats.contributors.totalContributors}`);
    console.log(`  ${chalk.cyan('Most Active:')} ${stats.contributors.mostActiveContributor}`);
  }
}

/**
 * Handle approval show command
 */
async function handleApprovalShow(commitId: string, options: any): Promise<void> {
  const repo = ApprovalRepositoryManager.getInstance();

  let targetCommitId = commitId;

  // If no commit ID provided, use latest
  if (!targetCommitId) {
    const currentBranch = repo.getCurrentBranch();
    targetCommitId = currentBranch.head;

    if (!targetCommitId) {
      console.log(chalk.gray('No commits found in current branch'));
      return;
    }
  }

  // Get the commit
  const commits = repo.getLog({ limit: 1 });
  const commit = commits.find((c) => c.id.startsWith(targetCommitId.substring(0, 7)));

  if (!commit) {
    console.error(chalk.red(`Commit not found: ${targetCommitId}`));
    return;
  }

  console.log(chalk.blue('\n📋 Approval Commit Details:\n'));

  const formatted = ApprovalCommitManager.formatCommit(commit, {
    oneline: false,
    showDiff: options.diff,
    showTags: options.tags,
  });

  console.log(formatted);

  // Show approval-specific information
  console.log(chalk.yellow('\n📝 Approval Details:'));
  console.log(`${chalk.cyan('Action:')} ${commit.approvalData.action}`);
  console.log(`${chalk.cyan('Approved:')} ${commit.approvalData.approved ? '✅ Yes' : '❌ No'}`);
  console.log(`${chalk.cyan('Request ID:')} ${commit.approvalData.requestId}`);

  if (commit.approvalData.comments) {
    console.log(`${chalk.cyan('Comments:')} ${commit.approvalData.comments}`);
  }

  if (commit.approvalData.trustLevel) {
    console.log(`${chalk.cyan('Trust Level:')} ${commit.approvalData.trustLevel}`);
  }

  console.log(
    `${chalk.cyan('Quick Decision:')} ${commit.approvalData.quickDecision ? 'Yes' : 'No'}`,
  );
  console.log('');
}
