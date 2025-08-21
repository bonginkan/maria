import { Command } from 'commander';
import chalk from 'chalk';
import {
  fileSystemService,
  FileOperationOptions,
  SearchOptions,
} from '../services/file-system/FileSystemService.js';
import { formatTable } from '../utils/ui.js';
import { OptimizedBox } from '../ui/design-system/OptimizedBox.js';
import { SEMANTIC_COLORS as _SEMANTIC_COLORS } from '../ui/design-system/UnifiedColorPalette.js';
import path from 'path';

interface FSCommandOptions {
  recursive?: boolean;
  force?: boolean;
  backup?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  hidden?: boolean;
  type?: 'file' | 'directory' | 'both';
  pattern?: string;
  maxDepth?: number;
}

export function createFSCommand(): Command {
  const fsCommand = new Command('fs');

  fsCommand.description('File system operations with natural language support').addHelpText(
    'after',
    `
${chalk.cyan('Examples:')}
  maria fs read package.json           # Read file contents
  maria fs write notes.txt "content"   # Write content to file
  maria fs copy src/ dest/             # Copy directory recursively
  maria fs find . --pattern "*.js"     # Find JavaScript files
  maria fs ls -l --hidden              # List all files including hidden
  maria fs rm temp/ --recursive        # Delete directory recursively
  maria fs mv old.txt new.txt          # Rename/move file
  maria fs mkdir -p deep/nested/dir    # Create nested directories
`,
  );

  // Read command
  fsCommand
    .command('read <file>')
    .alias('cat')
    .description('Read file contents')
    .option('-v, --verbose', 'verbose output')
    .action(async (file: string, options: FSCommandOptions) => {
      try {
        const content = await fileSystemService.readFile(file);
        const stats = await fileSystemService.getFileStats(file);

        if (options.verbose) {
          OptimizedBox.withTitle(`File: ${stats.path}`, [
            `Size: ${stats.size} bytes`,
            `Modified: ${stats.modified.toLocaleString()}`,
            `Permissions: ${stats.permissions}`,
          ]);
          console.log();
        }

        console.log(content);
      } catch (error) {
        console.error(chalk.red('✗ Failed to read file:'), error.message);
        process.exit(1);
      }
    });

  // Write command
  fsCommand
    .command('write <file> <content>')
    .description('Write content to file')
    .option('--backup', 'create backup before writing')
    .option('--dry-run', 'show what would be done')
    .action(async (file: string, content: string, options: FSCommandOptions) => {
      try {
        const fsOptions: FileOperationOptions = {
          backup: options.backup,
          dryRun: options.dryRun,
        };

        await fileSystemService.writeFile(file, content, fsOptions);

        if (!options.dryRun) {
          console.log(chalk.green('✓ File written successfully:'), file);
        }
      } catch (error) {
        console.error(chalk.red('✗ Failed to write file:'), error.message);
        process.exit(1);
      }
    });

  // Delete command
  fsCommand
    .command('rm <paths...>')
    .alias('delete')
    .description('Delete files or directories')
    .option('-r, --recursive', 'delete directories recursively')
    .option('-f, --force', 'force deletion without prompts')
    .option('--backup', 'create backup before deletion')
    .option('--dry-run', 'show what would be deleted')
    .action(async (paths: string[], options: FSCommandOptions) => {
      try {
        const fsOptions: FileOperationOptions = {
          recursive: options.recursive,
          force: options.force,
          backup: options.backup,
          dryRun: options.dryRun,
        };

        for (const filePath of paths) {
          const stats = await fileSystemService.getFileStats(filePath);

          if (stats.isDirectory) {
            await fileSystemService.deleteDirectory(filePath, fsOptions);
          } else {
            await fileSystemService.deleteFile(filePath, fsOptions);
          }

          if (!options.dryRun) {
            console.log(chalk.green('✓ Deleted:'), filePath);
          }
        }
      } catch (error) {
        console.error(chalk.red('✗ Failed to delete:'), error.message);
        process.exit(1);
      }
    });

  // Copy command
  fsCommand
    .command('cp <source> <dest>')
    .alias('copy')
    .description('Copy files or directories')
    .option('-r, --recursive', 'copy directories recursively')
    .option('-f, --force', 'overwrite existing files')
    .option('--preserve-timestamps', 'preserve timestamps')
    .option('--dry-run', 'show what would be copied')
    .action(async (source: string, dest: string, options: FSCommandOptions) => {
      try {
        const fsOptions: FileOperationOptions = {
          recursive: options.recursive,
          force: options.force,
          preserveTimestamps: options.preserveTimestamps,
          dryRun: options.dryRun,
        };

        const sourceStats = await fileSystemService.getFileStats(source);

        if (sourceStats.isDirectory && options.recursive) {
          await copyDirectoryRecursive(source, dest, fsOptions);
        } else if (sourceStats.isFile) {
          await fileSystemService.copyFile(source, dest, fsOptions);
        } else {
          throw new Error('Use --recursive to copy directories');
        }

        if (!options.dryRun) {
          console.log(chalk.green('✓ Copied:'), `${source} → ${dest}`);
        }
      } catch (error) {
        console.error(chalk.red('✗ Failed to copy:'), error.message);
        process.exit(1);
      }
    });

  // Move command
  fsCommand
    .command('mv <source> <dest>')
    .alias('move')
    .description('Move/rename files or directories')
    .option('-f, --force', 'overwrite existing files')
    .option('--dry-run', 'show what would be moved')
    .action(async (source: string, dest: string, options: FSCommandOptions) => {
      try {
        const fsOptions: FileOperationOptions = {
          force: options.force,
          dryRun: options.dryRun,
        };

        await fileSystemService.moveFile(source, dest, fsOptions);

        if (!options.dryRun) {
          console.log(chalk.green('✓ Moved:'), `${source} → ${dest}`);
        }
      } catch (error) {
        console.error(chalk.red('✗ Failed to move:'), error.message);
        process.exit(1);
      }
    });

  // List directory command
  fsCommand
    .command('ls [path]')
    .alias('list')
    .description('List directory contents')
    .option('-l, --long', 'use long listing format')
    .option('-a, --hidden', 'include hidden files')
    .option('-t, --type <type>', 'filter by type (file|directory|both)', 'both')
    .option('-p, --pattern <pattern>', 'filter by name pattern')
    .action(async (dirPath: string = '.', options: FSCommandOptions) => {
      try {
        const searchOptions: SearchOptions = {
          includeHidden: options.hidden,
          type: options.type as 'file' | 'directory' | 'both',
          pattern: options.pattern,
        };

        const files = await fileSystemService.listDirectory(dirPath, searchOptions);

        if (files.length === 0) {
          console.log(chalk.yellow('No files found'));
          return;
        }

        if (options.long) {
          const tableData = files.map((file) => [
            file.isDirectory ? chalk.blue('d') : '-',
            file.permissions,
            formatSize(file.size),
            file.modified.toLocaleDateString(),
            file.isDirectory ? chalk.blue(file.name) : file.name,
          ]);

          formatTable(tableData, ['Type', 'Perms', 'Size', 'Modified', 'Name']);
        } else {
          const columns = Math.floor(process.stdout.columns / 20) || 4;
          let output = '';

          files.forEach((file, index) => {
            const name = file.isDirectory ? chalk.blue(file.name) : file.name;
            output += name.padEnd(18);

            if ((index + 1) % columns === 0) {
              output += '\n';
            }
          });

          console.log(output);
        }
      } catch (error) {
        console.error(chalk.red('✗ Failed to list directory:'), error.message);
        process.exit(1);
      }
    });

  // Make directory command
  fsCommand
    .command('mkdir <paths...>')
    .description('Create directories')
    .option('-p, --parents', 'create parent directories as needed')
    .option('--dry-run', 'show what would be created')
    .action(async (paths: string[], options: FSCommandOptions) => {
      try {
        const fsOptions: FileOperationOptions = {
          recursive: options.parents,
          dryRun: options.dryRun,
        };

        for (const dirPath of paths) {
          await fileSystemService.createDirectory(dirPath, fsOptions);

          if (!options.dryRun) {
            console.log(chalk.green('✓ Created directory:'), dirPath);
          }
        }
      } catch (error) {
        console.error(chalk.red('✗ Failed to create directory:'), error.message);
        process.exit(1);
      }
    });

  // Find command
  fsCommand
    .command('find [path]')
    .description('Find files and directories')
    .option('-n, --name <pattern>', 'search by name pattern')
    .option('-t, --type <type>', 'filter by type (file|directory|both)', 'both')
    .option('-d, --max-depth <depth>', 'maximum search depth', parseInt)
    .option('-a, --hidden', 'include hidden files')
    .option('-r, --regex', 'use regex for pattern matching')
    .action(async (searchPath: string = '.', options: FSCommandOptions) => {
      try {
        const searchOptions: SearchOptions = {
          pattern: options.name,
          type: options.type as 'file' | 'directory' | 'both',
          maxDepth: options.maxDepth,
          includeHidden: options.hidden,
          regex: options.regex,
        };

        const files = await fileSystemService.findFiles(searchPath, searchOptions);

        if (files.length === 0) {
          console.log(chalk.yellow('No files found matching criteria'));
          return;
        }

        files.forEach((file) => {
          const icon = file.isDirectory ? chalk.blue('📁') : '📄';
          const _name = file.isDirectory ? chalk.blue(file.name) : file.name;
          console.log(`${icon} ${file.path}`);
        });

        console.log(`\n${chalk.cyan('ℹ Found')} ${files.length} item(s)`);
      } catch (error) {
        console.error(chalk.red('✗ Search failed:'), error.message);
        process.exit(1);
      }
    });

  // Which command
  fsCommand
    .command('which <command>')
    .description('Locate a command in PATH')
    .action(async (command: string) => {
      try {
        const location = await fileSystemService.which(command);

        if (location) {
          console.log(location);
        } else {
          console.log(chalk.yellow(`Command '${command}' not found in PATH`));
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red('✗ Failed to locate command:'), error.message);
        process.exit(1);
      }
    });

  // Stats command
  fsCommand
    .command('stat <path>')
    .description('Display file or directory statistics')
    .action(async (filePath: string) => {
      try {
        const stats = await fileSystemService.getFileStats(filePath);
        const realPath = await fileSystemService.getRealPath(filePath);

        OptimizedBox.withTitle(`File Statistics: ${stats.name}`, [
          `Path: ${stats.path}`,
          `Real Path: ${realPath}`,
          `Type: ${stats.isDirectory ? 'Directory' : stats.isFile ? 'File' : 'Other'}`,
          `Size: ${formatSize(stats.size)}`,
          `Permissions: ${stats.permissions}`,
          `Created: ${stats.created.toLocaleString()}`,
          `Modified: ${stats.modified.toLocaleString()}`,
          `Symlink: ${stats.isSymlink ? 'Yes' : 'No'}`,
        ]);
      } catch (error) {
        console.error(chalk.red('✗ Failed to get file stats:'), error.message);
        process.exit(1);
      }
    });

  // Operation log command
  fsCommand
    .command('log')
    .description('Show file operation history')
    .option('-c, --clear', 'clear the operation log')
    .action(async (options: FSCommandOptions) => {
      try {
        if (options.clear) {
          fileSystemService.clearOperationLog();
          console.log(chalk.green('✓ Operation log cleared'));
          return;
        }

        const log = fileSystemService.getOperationLog();

        if (log.length === 0) {
          console.log(chalk.yellow('No operations logged'));
          return;
        }

        const tableData = log
          .slice(-20)
          .map((entry) => [
            entry.timestamp.toLocaleTimeString(),
            entry.operation,
            entry.success ? chalk.green('✓') : chalk.red('✗'),
            entry.path,
          ]);

        formatTable(tableData, ['Time', 'Operation', 'Status', 'Path']);

        if (log.length > 20) {
          console.log(chalk.cyan(`\nShowing last 20 of ${log.length} operations`));
        }
      } catch (error) {
        console.error(chalk.red('✗ Failed to show operation log:'), error.message);
        process.exit(1);
      }
    });

  return fsCommand;
}

// Helper functions
async function copyDirectoryRecursive(
  source: string,
  dest: string,
  options: FileOperationOptions,
): Promise<void> {
  const files = await fileSystemService.listDirectory(source, { includeHidden: true });

  await fileSystemService.createDirectory(dest, { recursive: true, dryRun: options.dryRun });

  for (const file of files) {
    const sourcePath = path.join(source, file.name);
    const destPath = path.join(dest, file.name);

    if (file.isDirectory) {
      await copyDirectoryRecursive(sourcePath, destPath, options);
    } else {
      await fileSystemService.copyFile(sourcePath, destPath, options);
    }
  }
}

function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)}${units[unitIndex]}`;
}
