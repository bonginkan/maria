/**
 * Commit Command
 * AI-powered commit message generation
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { execSync } from 'child_process';
import prompts from 'prompts';
// import { logger } from '../utils/logger.js';
import { getBooleanProperty, getStringProperty, isObject } from '../utils/type-guards.js';

export const commitCommand = new Command('commit')
  .description('Generate AI-powered commit messages')
  .option('-m, --message <message>', 'Custom commit message')
  .option('-a, --all', 'Stage all changes before commit')
  .option('--amend', 'Amend the last commit')
  .option('--push', 'Push after commit')
  .option('--no-verify', 'Skip pre-commit hooks')
  .option('--type <type>', 'Commit type (feat, fix, docs, style, refactor, test, chore)')
  .option('--scope <scope>', 'Commit scope')
  .option('--breaking', 'Mark as breaking change')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🤖 AI Commit Assistant'));

      // Check if we're in a git repository
      try {
        execSync('git rev-parse --git-dir', { stdio: 'ignore' });
      } catch {
        console.error(chalk.red('Not in a git repository'));
        process.exit(1);
      }

      // Stage files if --all flag is set
      if (options.all) {
        console.log(chalk.gray('Staging all changes...'));
        execSync('git add -A');
      }

      // Get staged changes
      const stagedDiff = execSync('git diff --cached', { encoding: 'utf8' });
      const stagedFiles = execSync('git diff --cached --name-status', { encoding: 'utf8' });

      if (!stagedDiff && !options.amend) {
        console.log(chalk.yellow('No staged changes to commit'));

        // Check if there are unstaged changes
        const unstagedDiff = execSync('git diff', { encoding: 'utf8' });
        if (unstagedDiff) {
          const { shouldStage } = await prompts({
            type: 'confirm',
            name: 'shouldStage',
            message: 'You have unstaged changes. Would you like to stage them?',
            initial: true,
          });

          if (shouldStage) {
            execSync('git add -A');
            console.log(chalk.green('✓ All changes staged'));
          } else {
            process.exit(0);
          }
        } else {
          console.log(chalk.gray('Working directory is clean'));
          process.exit(0);
        }
      }

      // Generate or use commit message
      let commitMessage = '';

      if (options.message) {
        // Use provided message
        commitMessage = options.message;
      } else {
        // Generate AI commit message
        commitMessage = await generateCommitMessage(stagedDiff, stagedFiles, options);

        // Show generated message and ask for confirmation
        console.log(`\n${  chalk.bold('Generated Commit Message:')}`);
        console.log(chalk.green(commitMessage));

        const { confirm, editedMessage } = await prompts([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Use this commit message?',
            initial: true,
          },
          {
            type: (prev) => (prev === false ? 'text' : null),
            name: 'editedMessage',
            message: 'Enter your commit message:',
            initial: commitMessage,
          },
        ]);

        if (!confirm && !editedMessage) {
          console.log(chalk.yellow('Commit cancelled'));
          process.exit(0);
        }

        if (editedMessage) {
          commitMessage = editedMessage;
        }
      }

      // Perform commit
      try {
        const commitCmd = buildCommitCommand(commitMessage, options);
        execSync(commitCmd, { stdio: 'inherit' });
        console.log(chalk.green('✅ Commit successful!'));

        // Get commit hash
        const commitHash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
        console.log(chalk.gray(`Commit: ${commitHash.substring(0, 7)}`));

        // Push if requested
        if (options.push) {
          console.log(chalk.blue('Pushing to remote...'));
          try {
            execSync('git push', { stdio: 'inherit' });
            console.log(chalk.green('✅ Push successful!'));
          } catch (error: unknown) {
            console.error(chalk.red('Push failed. You can push manually with: git push'));
          }
        }
      } catch (error: unknown) {
        console.error(chalk.red('Commit failed:'), error);
        process.exit(1);
      }
    } catch (error: unknown) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

async function generateCommitMessage(
  diff: string,
  files: string,
  options: unknown,
): Promise<string> {
  // Analyze changes to determine commit type and message
  const analysis = analyzeChanges(diff, files);

  // Type guard for options
  const opts = isObject(options) ? options : {};

  // Determine commit type
  const type = getStringProperty(opts, 'type', analysis.suggestedType);
  const scope = getStringProperty(opts, 'scope', analysis.suggestedScope);
  const breaking = getBooleanProperty(opts, 'breaking', analysis.hasBreakingChanges);

  // Generate conventional commit message
  let message = type;

  if (scope) {
    message += `(${scope})`;
  }

  if (breaking) {
    message += '!';
  }

  message += `: ${  analysis.summary}`;

  // Add body if there are details
  if (analysis.details.length > 0) {
    message += `\n\n${  analysis.details.join('\n')}`;
  }

  // Add breaking change footer if needed
  if (breaking && analysis.breakingChangeDescription) {
    message += `\n\nBREAKING CHANGE: ${  analysis.breakingChangeDescription}`;
  }

  // Add co-authors or references if any
  if (analysis.references.length > 0) {
    message += `\n\n${  analysis.references.join('\n')}`;
  }

  return message;
}

interface ChangeAnalysis {
  suggestedType: string;
  suggestedScope?: string;
  summary: string;
  details: string[];
  hasBreakingChanges: boolean;
  breakingChangeDescription?: string;
  references: string[];
}

function analyzeChanges(diff: string, files: string): ChangeAnalysis {
  const fileList = files.split('\n').filter((f) => f);
  const addedFiles = fileList.filter((f) => f.startsWith('A')).length;
  const modifiedFiles = fileList.filter((f) => f.startsWith('M')).length;
  const deletedFiles = fileList.filter((f) => f.startsWith('D')).length;
  const renamedFiles = fileList.filter((f) => f.startsWith('R')).length;

  // Analyze file patterns
  const hasTests = fileList.some((f) => f.includes('.test.') || f.includes('.spec.'));
  const hasDocs = fileList.some((f) => f.includes('.md') || f.includes('docs/'));
  const hasConfig = fileList.some(
    (f) => f.includes('package.json') || f.includes('tsconfig') || f.includes('.config.'),
  );
  const hasStyles = fileList.some(
    (f) => f.includes('.css') || f.includes('.scss') || f.includes('.less'),
  );

  // Determine commit type
  let suggestedType = 'chore';

  if (hasTests && modifiedFiles === fileList.length) {
    suggestedType = 'test';
  } else if (hasDocs && modifiedFiles === fileList.length) {
    suggestedType = 'docs';
  } else if (hasStyles && modifiedFiles === fileList.length) {
    suggestedType = 'style';
  } else if (diff.includes('fix') || diff.includes('bug') || diff.includes('error')) {
    suggestedType = 'fix';
  } else if (addedFiles > modifiedFiles) {
    suggestedType = 'feat';
  } else if (deletedFiles > 0 && modifiedFiles > 0) {
    suggestedType = 'refactor';
  } else if (hasConfig) {
    suggestedType = 'build';
  }

  // Determine scope
  let suggestedScope: string | undefined;

  // Try to extract scope from file paths
  const paths = fileList
    .map((f) => f.split('\t')[1])
    .filter((path): path is string => Boolean(path));
  if (paths.length > 0) {
    const commonPath = findCommonPath(paths);
    if (commonPath && commonPath !== '.') {
      suggestedScope = commonPath.split('/')[0];
    }
  }

  // Generate summary
  let summary = '';

  if (addedFiles > 0 && modifiedFiles === 0 && deletedFiles === 0) {
    summary = `add ${addedFiles === 1 ? getFileName(fileList[0] || '') : `${addedFiles} files`}`;
  } else if (modifiedFiles > 0 && addedFiles === 0 && deletedFiles === 0) {
    summary = `update ${modifiedFiles === 1 ? getFileName(fileList[0] || '') : `${modifiedFiles} files`}`;
  } else if (deletedFiles > 0 && addedFiles === 0 && modifiedFiles === 0) {
    summary = `remove ${deletedFiles === 1 ? getFileName(fileList[0] || '') : `${deletedFiles} files`}`;
  } else if (renamedFiles > 0) {
    summary = `rename ${renamedFiles === 1 ? 'file' : `${renamedFiles} files`}`;
  } else {
    // Mixed changes
    const actions = [];
    if (addedFiles > 0) {actions.push(`add ${addedFiles}`);}
    if (modifiedFiles > 0) {actions.push(`update ${modifiedFiles}`);}
    if (deletedFiles > 0) {actions.push(`remove ${deletedFiles}`);}
    summary = `${actions.join(', ')  } files`;
  }

  // Generate details
  const details: string[] = [];

  if (fileList.length <= 5) {
    // List all files if there are few
    fileList.forEach((f) => {
      const [status, ...pathParts] = f.split('\t');
      const path = pathParts.join('\t');
      if (path) {
        let action = '';
        switch (status?.[0]) {
          case 'A':
            action = 'Add';
            break;
          case 'M':
            action = 'Update';
            break;
          case 'D':
            action = 'Remove';
            break;
          case 'R':
            action = 'Rename';
            break;
        }
        details.push(`- ${action} ${path}`);
      }
    });
  }

  // Check for breaking changes
  const hasBreakingChanges =
    diff.includes('BREAKING') ||
    diff.includes('Breaking') ||
    deletedFiles > 0 ||
    diff.includes('deprecated');

  let breakingChangeDescription: string | undefined;
  if (hasBreakingChanges && deletedFiles > 0) {
    breakingChangeDescription = 'Removed files may break existing functionality';
  }

  // Look for issue references
  const references: string[] = [];
  const issuePattern = /#(\d+)/g;
  const matches = diff.match(issuePattern);
  if (matches) {
    matches.forEach((match) => {
      if (!references.includes(`Closes ${match}`)) {
        references.push(`Closes ${match}`);
      }
    });
  }

  return {
    suggestedType,
    suggestedScope,
    summary,
    details,
    hasBreakingChanges,
    breakingChangeDescription,
    references,
  };
}

function findCommonPath(paths: string[]): string {
  if (paths.length === 0) {return '';}
  if (paths.length === 1) {return paths[0]?.split('/').slice(0, -1).join('/') || '';}

  const parts = paths[0]?.split('/') || [];
  let common = '';

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (part && paths.every((p) => p.split('/')[i] === part)) {
      common = common ? `${common}/${part}` : part;
    } else {
      break;
    }
  }

  return common;
}

function getFileName(fileLine: string): string {
  const parts = fileLine.split('\t');
  if (parts.length > 1) {
    const path = parts[1];
    return path?.split('/').pop() || path || 'file';
  }
  return 'file';
}

function buildCommitCommand(message: string, options: unknown): string {
  let cmd = 'git commit';

  // Type guard for options
  const opts = isObject(options) ? options : {};

  if (getBooleanProperty(opts, 'amend', false)) {
    cmd += ' --amend';
  }

  if (getBooleanProperty(opts, 'noVerify', false)) {
    cmd += ' --no-verify';
  }

  // Escape the message for shell
  const escapedMessage = message.replace(/'/g, "'\\''");
  cmd += ` -m '${escapedMessage}'`;

  return cmd;
}

export default commitCommand;
