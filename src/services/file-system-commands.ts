/**
 * File System Commands Handler
 * Provides Unix/Linux-like commands for MARIA interactive mode
 */

import chalk from 'chalk';
import * as path from 'path';
import { fileSystemService } from './file-system/FileSystemService';

export interface FSCommandResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export class FileSystemCommands {
  private static instance: FileSystemCommands;
  private currentWorkingDirectory: string = process.cwd();

  public static getInstance(): FileSystemCommands {
    if (!FileSystemCommands.instance) {
      FileSystemCommands.instance = new FileSystemCommands();
    }
    return FileSystemCommands.instance;
  }

  private constructor() {}

  async executeCommand(command: string, args: string[]): Promise<FSCommandResult> {
    switch (command.toLowerCase()) {
      case 'ls':
      case 'dir':
        return this.handleLS(args);
      case 'cd':
        return this.handleCD(args);
      case 'pwd':
        return this.handlePWD();
      case 'mkdir':
        return this.handleMKDIR(args);
      case 'rmdir':
        return this.handleRMDIR(args);
      case 'rm':
        return this.handleRM(args);
      case 'cp':
      case 'copy':
        return this.handleCP(args);
      case 'mv':
      case 'move':
        return this.handleMV(args);
      case 'cat':
        return this.handleCAT(args);
      case 'touch':
        return this.handleTOUCH(args);
      case 'find':
        return this.handleFIND(args);
      case 'which':
        return this.handleWHICH(args);
      case 'stat':
        return this.handleSTAT(args);
      case 'chmod':
        return this.handleCHMOD(args);
      case 'tree':
        return this.handleTREE(args);
      default:
        return {
          success: false,
          message: `Unknown command: ${command}`,
        };
    }
  }

  private async handleLS(args: string[]): Promise<FSCommandResult> {
    try {
      const targetPath = args[0] || this.currentWorkingDirectory;
      const isLong = args.includes('-l') || args.includes('--long');
      const showHidden = args.includes('-a') || args.includes('--all');

      const files = await fileSystemService.listDirectory(targetPath, {
        includeHidden: showHidden,
        type: 'both',
      });

      if (files.length === 0) {
        return {
          success: true,
          message: 'Directory is empty',
        };
      }

      let output = '';
      if (isLong) {
        files.forEach((file) => {
          const type = file.isDirectory ? 'd' : '-';
          const perms = file.permissions || '755';
          const size = this.formatSize(file.size);
          const date = file.modified.toLocaleDateString();
          const name = file.isDirectory ? chalk.blue(file.name) : file.name;
          output += `${type}${perms.padStart(9)} ${size.padStart(8)} ${date.padStart(12)} ${name}\n`;
        });
      } else {
        const columns = Math.floor(process.stdout.columns / 20) || 4;
        files.forEach((file, index) => {
          const name = file.isDirectory ? chalk.blue(file.name) : file.name;
          output += name.padEnd(18);
          if ((index + 1) % columns === 0) output += '\n';
        });
      }

      return {
        success: true,
        message: output,
      };
    } catch (error) {
      return {
        success: false,
        message: `ls: ${error.message}`,
      };
    }
  }

  private async handleCD(args: string[]): Promise<FSCommandResult> {
    try {
      const targetPath = args[0] || process.env.HOME || '/';
      const resolvedPath = path.resolve(this.currentWorkingDirectory, targetPath);

      if (await fileSystemService.exists(resolvedPath)) {
        const stats = await fileSystemService.getFileStats(resolvedPath);
        if (stats.isDirectory) {
          this.currentWorkingDirectory = resolvedPath;
          process.chdir(resolvedPath);
          return {
            success: true,
            message: `Changed directory to: ${resolvedPath}`,
          };
        } else {
          return {
            success: false,
            message: `cd: not a directory: ${targetPath}`,
          };
        }
      } else {
        return {
          success: false,
          message: `cd: no such file or directory: ${targetPath}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `cd: ${error.message}`,
      };
    }
  }

  private async handlePWD(): Promise<FSCommandResult> {
    return {
      success: true,
      message: this.currentWorkingDirectory,
    };
  }

  private async handleMKDIR(args: string[]): Promise<FSCommandResult> {
    if (args.length === 0) {
      return {
        success: false,
        message: 'mkdir: missing operand',
      };
    }

    try {
      const recursive = args.includes('-p') || args.includes('--parents');
      const dirs = args.filter((arg) => !arg.startsWith('-'));

      for (const dir of dirs) {
        await fileSystemService.createDirectory(dir, { recursive });
      }

      return {
        success: true,
        message: `Created director${dirs.length > 1 ? 'ies' : 'y'}: ${dirs.join(', ')}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `mkdir: ${error.message}`,
      };
    }
  }

  private async handleRMDIR(args: string[]): Promise<FSCommandResult> {
    if (args.length === 0) {
      return {
        success: false,
        message: 'rmdir: missing operand',
      };
    }

    try {
      const dirs = args.filter((arg) => !arg.startsWith('-'));

      for (const dir of dirs) {
        await fileSystemService.deleteDirectory(dir);
      }

      return {
        success: true,
        message: `Removed director${dirs.length > 1 ? 'ies' : 'y'}: ${dirs.join(', ')}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `rmdir: ${error.message}`,
      };
    }
  }

  private async handleRM(args: string[]): Promise<FSCommandResult> {
    if (args.length === 0) {
      return {
        success: false,
        message: 'rm: missing operand',
      };
    }

    try {
      const recursive = args.includes('-r') || args.includes('-R') || args.includes('--recursive');
      const force = args.includes('-f') || args.includes('--force');
      const paths = args.filter((arg) => !arg.startsWith('-'));

      for (const filePath of paths) {
        const stats = await fileSystemService.getFileStats(filePath);

        if (stats.isDirectory) {
          if (recursive) {
            await fileSystemService.deleteDirectory(filePath, { recursive: true, force });
          } else {
            return {
              success: false,
              message: `rm: cannot remove '${filePath}': Is a directory`,
            };
          }
        } else {
          await fileSystemService.deleteFile(filePath, { force });
        }
      }

      return {
        success: true,
        message: `Removed: ${paths.join(', ')}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `rm: ${error.message}`,
      };
    }
  }

  private async handleCP(args: string[]): Promise<FSCommandResult> {
    if (args.length < 2) {
      return {
        success: false,
        message: 'cp: missing file operand',
      };
    }

    try {
      const recursive = args.includes('-r') || args.includes('-R') || args.includes('--recursive');
      const preserve = args.includes('-p') || args.includes('--preserve');
      const force = args.includes('-f') || args.includes('--force');

      const paths = args.filter((arg) => !arg.startsWith('-'));
      const source = paths[0];
      const dest = paths[1];

      const sourceStats = await fileSystemService.getFileStats(source);

      if (sourceStats.isDirectory && !recursive) {
        return {
          success: false,
          message: `cp: omitting directory '${source}' (use -r to copy directories)`,
        };
      }

      await fileSystemService.copyFile(source, dest, {
        recursive,
        preserveTimestamps: preserve,
        force,
      });

      return {
        success: true,
        message: `Copied '${source}' to '${dest}'`,
      };
    } catch (error) {
      return {
        success: false,
        message: `cp: ${error.message}`,
      };
    }
  }

  private async handleMV(args: string[]): Promise<FSCommandResult> {
    if (args.length < 2) {
      return {
        success: false,
        message: 'mv: missing file operand',
      };
    }

    try {
      const force = args.includes('-f') || args.includes('--force');
      const paths = args.filter((arg) => !arg.startsWith('-'));
      const source = paths[0];
      const dest = paths[1];

      await fileSystemService.moveFile(source, dest, { force });

      return {
        success: true,
        message: `Moved '${source}' to '${dest}'`,
      };
    } catch (error) {
      return {
        success: false,
        message: `mv: ${error.message}`,
      };
    }
  }

  private async handleCAT(args: string[]): Promise<FSCommandResult> {
    if (args.length === 0) {
      return {
        success: false,
        message: 'cat: missing file operand',
      };
    }

    try {
      let output = '';
      for (const file of args) {
        const content = await fileSystemService.readFile(file);
        output += content + '\n';
      }

      return {
        success: true,
        message: output,
      };
    } catch (error) {
      return {
        success: false,
        message: `cat: ${error.message}`,
      };
    }
  }

  private async handleTOUCH(args: string[]): Promise<FSCommandResult> {
    if (args.length === 0) {
      return {
        success: false,
        message: 'touch: missing file operand',
      };
    }

    try {
      for (const file of args) {
        if (await fileSystemService.exists(file)) {
          // Update timestamp by reading and writing
          const content = await fileSystemService.readFile(file);
          await fileSystemService.writeFile(file, content);
        } else {
          // Create empty file
          await fileSystemService.writeFile(file, '');
        }
      }

      return {
        success: true,
        message: `Touched: ${args.join(', ')}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `touch: ${error.message}`,
      };
    }
  }

  private async handleFIND(args: string[]): Promise<FSCommandResult> {
    try {
      const searchPath = args[0] || this.currentWorkingDirectory;
      const nameIndex = args.indexOf('-name');
      const typeIndex = args.indexOf('-type');

      const options: unknown = {};

      if (nameIndex !== -1 && nameIndex + 1 < args.length) {
        options.pattern = args[nameIndex + 1];
      }

      if (typeIndex !== -1 && typeIndex + 1 < args.length) {
        const typeArg = args[typeIndex + 1];
        if (typeArg === 'f') options.type = 'file';
        else if (typeArg === 'd') options.type = 'directory';
      }

      const files = await fileSystemService.findFiles(searchPath, options);

      if (files.length === 0) {
        return {
          success: true,
          message: 'No files found',
        };
      }

      const output = files.map((f) => f.path).join('\n');
      return {
        success: true,
        message: output,
      };
    } catch (error) {
      return {
        success: false,
        message: `find: ${error.message}`,
      };
    }
  }

  private async handleWHICH(args: string[]): Promise<FSCommandResult> {
    if (args.length === 0) {
      return {
        success: false,
        message: 'which: missing command operand',
      };
    }

    try {
      const command = args[0];
      const location = await fileSystemService.which(command);

      if (location) {
        return {
          success: true,
          message: location,
        };
      } else {
        return {
          success: false,
          message: `which: no ${command} in PATH`,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `which: ${error.message}`,
      };
    }
  }

  private async handleSTAT(args: string[]): Promise<FSCommandResult> {
    if (args.length === 0) {
      return {
        success: false,
        message: 'stat: missing file operand',
      };
    }

    try {
      const file = args[0];
      const stats = await fileSystemService.getFileStats(file);

      let output = `File: ${stats.name}\n`;
      output += `Path: ${stats.path}\n`;
      output += `Size: ${this.formatSize(stats.size)}\n`;
      output += `Type: ${stats.isDirectory ? 'Directory' : stats.isFile ? 'File' : 'Other'}\n`;
      output += `Permissions: ${stats.permissions}\n`;
      output += `Modified: ${stats.modified.toLocaleString()}\n`;
      output += `Created: ${stats.created.toLocaleString()}\n`;
      output += `Symlink: ${stats.isSymlink ? 'Yes' : 'No'}`;

      return {
        success: true,
        message: output,
      };
    } catch (error) {
      return {
        success: false,
        message: `stat: ${error.message}`,
      };
    }
  }

  private async handleCHMOD(args: string[]): Promise<FSCommandResult> {
    if (args.length < 2) {
      return {
        success: false,
        message: 'chmod: missing operand',
      };
    }

    return {
      success: false,
      message: 'chmod: not implemented in this environment (use system chmod)',
    };
  }

  private async handleTREE(args: string[]): Promise<FSCommandResult> {
    try {
      const startPath = args[0] || this.currentWorkingDirectory;
      const maxDepth = 3; // Limit depth to avoid overwhelming output

      const tree = await this.buildTree(startPath, '', maxDepth, 0);

      return {
        success: true,
        message: tree,
      };
    } catch (error) {
      return {
        success: false,
        message: `tree: ${error.message}`,
      };
    }
  }

  private async buildTree(
    dirPath: string,
    prefix: string,
    maxDepth: number,
    currentDepth: number,
  ): Promise<string> {
    if (currentDepth >= maxDepth) return '';

    let result = '';
    try {
      const files = await fileSystemService.listDirectory(dirPath, { includeHidden: false });

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isLast = i === files.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        const name = file.isDirectory ? chalk.blue(file.name) : file.name;

        result += prefix + connector + name + '\n';

        if (file.isDirectory && currentDepth < maxDepth - 1) {
          const newPrefix = prefix + (isLast ? '    ' : '│   ');
          result += await this.buildTree(
            path.join(dirPath, file.name),
            newPrefix,
            maxDepth,
            currentDepth + 1,
          );
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }

    return result;
  }

  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 1)}${units[unitIndex]}`;
  }
}

export const fileSystemCommands = FileSystemCommands.getInstance();
