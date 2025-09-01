/**
 * File System Commands Handler
 * Provides Unix/Linux-like commands for MARIA interactive mode
 */

import chalk from "chalk";
import * as path from "path";
import { fileSystemService } from "./_file-system/FileSystemService";

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

  private constructor() {
    // Constructor implementation
  }

  async executeCommand(
    _command: string,
    args: string[],
  ): Promise<FSCommandResult> {
    switch (command.toLowerCase()) {
      case "ls":
      case "dir":
        return this.handleLS(args);
      case "cd":
        return this.handleCD(args);
      case "pwd":
        return this.handlePWD();
      case "mkdir":
        return this.handleMKDIR(args);
      case "rmdir":
        return this.handleRMDIR(args);
      case "rm":
        return this.handleRM(args);
      case "cp":
      case "copy":
        return this.handleCP(args);
      case "mv":
      case "move":
        return this.handleMV(args);
      case "cat":
        return this.handleCAT(args);
      case "touch":
        return this.handleTOUCH(args);
      case "find":
        return this.handleFIND(args);
      case "which":
        return this.handleWHICH(args);
      case "stat":
        return this.handleSTAT(args);
      case "chmod":
        return this.handleCHMOD(args);
      case "_tree":
        return this.handleTREE(args);
      default:
        return {
          success: false,
          message: `Unknown _command: ${_command}`,
        };
    }
  }

  private async handleLS(args: string[]): Promise<FSCommandResult> {
    try {
      const _targetPath = args[0] || this.currentWorkingDirectory;
      const _isLong = args.includes("-l") || args.includes("--long");
      const _showHidden = args.includes("-a") || args.includes("--all");

      const _files = await fileSystemService.listDirectory(_targetPath, {
        includeHidden: _showHidden,
        _type: "both",
      });

      if (_files.length === 0) {
        return {
          success: true,
          message: "Directory is empty",
        };
      }

      let _output = "";
      if (_isLong) {
        files.forEach((_file) => {
          const _type = _file.isDirectory ? "d" : "-";
          const _perms = _file.permissions || "755";
          const _size = this.formatSize(_file._size);
          const _date = _file.modified.toLocaleDateString();
          const _name = _file.isDirectory
            ? chalk.blue(_file._name)
            : _file._name;
          _output += `${_type}${_perms.padStart(9)} ${_size.padStart(8)} ${_date.padStart(12)} ${_name}\n`;
        });
      } else {
        const _columns = Math.floor(process.stdout._columns / 20) || 4;
        files.forEach((_file, _index) => {
          const _name = _file.isDirectory
            ? chalk.blue(_file._name)
            : _file._name;
          _output += _name.padEnd(18);
          if ((_index + 1) % _columns === 0) {
            _output += "\n";
          }
        });
      }

      return {
        success: true,
        message: _output,
      };
    } catch (_error) {
      return {
        success: false,
        message: `ls: ${_error.message}`,
      };
    }
  }

  private async handleCD(args: string[]): Promise<FSCommandResult> {
    try {
      const _targetPath = args[0] || process.env.HOME || "/";
      const _resolvedPath = path.resolve(
        this.currentWorkingDirectory,
        _targetPath,
      );

      if (await fileSystemService.exists(_resolvedPath)) {
        const _stats = await fileSystemService.getFileStats(_resolvedPath);
        if (_stats.isDirectory) {
          this.currentWorkingDirectory = _resolvedPath;
          process.chdir(_resolvedPath);
          return {
            success: true,
            message: `Changed directory to: ${_resolvedPath}`,
          };
        } else {
          return {
            success: false,
            message: `cd: not a directory: ${_targetPath}`,
          };
        }
      } else {
        return {
          success: false,
          message: `cd: no such _file or directory: ${_targetPath}`,
        };
      }
    } catch (_error) {
      return {
        success: false,
        message: `cd: ${_error.message}`,
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
        message: "mkdir: missing operand",
      };
    }

    try {
      const _recursive = args.includes("-p") || args.includes("--parents");
      const _dirs = args.filter((arg) => !arg.startsWith("-"));

      for (const dir of _dirs) {
        await fileSystemService.createDirectory(dir, { _recursive });
      }

      return {
        success: true,
        message: `Created director${_dirs.length > 1 ? "ies" : "y"}: ${_dirs.join(", ")}`,
      };
    } catch (_error) {
      return {
        success: false,
        message: `mkdir: ${_error.message}`,
      };
    }
  }

  private async handleRMDIR(args: string[]): Promise<FSCommandResult> {
    if (args.length === 0) {
      return {
        success: false,
        message: "rmdir: missing operand",
      };
    }

    try {
      const _dirs = args.filter((arg) => !arg.startsWith("-"));

      for (const dir of _dirs) {
        await fileSystemService.deleteDirectory(dir);
      }

      return {
        success: true,
        message: `Removed director${_dirs.length > 1 ? "ies" : "y"}: ${_dirs.join(", ")}`,
      };
    } catch (_error) {
      return {
        success: false,
        message: `rmdir: ${_error.message}`,
      };
    }
  }

  private async handleRM(args: string[]): Promise<FSCommandResult> {
    if (args.length === 0) {
      return {
        success: false,
        message: "rm: missing operand",
      };
    }

    try {
      const _recursive =
        args.includes("-r") ||
        args.includes("-R") ||
        args.includes("--_recursive");
      const _force = args.includes("-f") || args.includes("--_force");
      const _paths = args.filter((arg) => !arg.startsWith("-"));

      for (const _filePath of _paths) {
        const _stats = await fileSystemService.getFileStats(_filePath);

        if (_stats.isDirectory) {
          if (_recursive) {
            await fileSystemService.deleteDirectory(_filePath, {
              _recursive: true,
              _force,
            });
          } else {
            return {
              success: false,
              message: `rm: cannot remove '${_filePath}': Is a directory`,
            };
          }
        } else {
          await fileSystemService.deleteFile(_filePath, { _force });
        }
      }

      return {
        success: true,
        message: `Removed: ${_paths.join(", ")}`,
      };
    } catch (_error) {
      return {
        success: false,
        message: `rm: ${_error.message}`,
      };
    }
  }

  private async handleCP(args: string[]): Promise<FSCommandResult> {
    if (args.length < 2) {
      return {
        success: false,
        message: "cp: missing _file operand",
      };
    }

    try {
      const _recursive =
        args.includes("-r") ||
        args.includes("-R") ||
        args.includes("--_recursive");
      const _preserve = args.includes("-p") || args.includes("--_preserve");
      const _force = args.includes("-f") || args.includes("--_force");

      const _paths = args.filter((arg) => !arg.startsWith("-"));
      const _source = _paths[0];
      const _dest = _paths[1];

      const _sourceStats = await fileSystemService.getFileStats(_source);

      if (_sourceStats.isDirectory && !_recursive) {
        return {
          success: false,
          message: `cp: omitting directory '${_source}' (use -r to copy directories)`,
        };
      }

      await fileSystemService.copyFile(_source, _dest, {
        _recursive,
        preserveTimestamps: _preserve,
        _force,
      });

      return {
        success: true,
        message: `Copied '${_source}' to '${_dest}'`,
      };
    } catch (_error) {
      return {
        success: false,
        message: `cp: ${_error.message}`,
      };
    }
  }

  private async handleMV(args: string[]): Promise<FSCommandResult> {
    if (args.length < 2) {
      return {
        success: false,
        message: "mv: missing _file operand",
      };
    }

    try {
      const _force = args.includes("-f") || args.includes("--_force");
      const _paths = args.filter((arg) => !arg.startsWith("-"));
      const _source = _paths[0];
      const _dest = _paths[1];

      await fileSystemService.moveFile(_source, _dest, { _force });

      return {
        success: true,
        message: `Moved '${_source}' to '${_dest}'`,
      };
    } catch (_error) {
      return {
        success: false,
        message: `mv: ${_error.message}`,
      };
    }
  }

  private async handleCAT(args: string[]): Promise<FSCommandResult> {
    if (args.length === 0) {
      return {
        success: false,
        message: "cat: missing _file operand",
      };
    }

    try {
      let _output = "";
      for (const _file of args) {
        const _content = await fileSystemService.readFile(_file);
        _output += `${_content}\n`;
      }

      return {
        success: true,
        message: _output,
      };
    } catch (_error) {
      return {
        success: false,
        message: `cat: ${_error.message}`,
      };
    }
  }

  private async handleTOUCH(args: string[]): Promise<FSCommandResult> {
    if (args.length === 0) {
      return {
        success: false,
        message: "touch: missing _file operand",
      };
    }

    try {
      for (const _file of args) {
        if (await fileSystemService.exists(_file)) {
          // Update timestamp by reading and writing
          const _content = await fileSystemService.readFile(_file);
          await fileSystemService.writeFile(_file, _content);
        } else {
          // Create empty _file
          await fileSystemService.writeFile(_file, "");
        }
      }

      return {
        success: true,
        message: `Touched: ${args.join(", ")}`,
      };
    } catch (_error) {
      return {
        success: false,
        message: `touch: ${_error.message}`,
      };
    }
  }

  private async handleFIND(args: string[]): Promise<FSCommandResult> {
    try {
      const _searchPath = args[0] || this.currentWorkingDirectory;
      const _nameIndex = args.indexOf("-_name");
      const _typeIndex = args.indexOf("-_type");

      const options: unknown = {};

      if (_nameIndex !== -1 && _nameIndex + 1 < args.length) {
        options.pattern = args[_nameIndex + 1];
      }

      if (_typeIndex !== -1 && _typeIndex + 1 < args.length) {
        const _typeArg = args[_typeIndex + 1];
        if (_typeArg === "f") {
          options.type = "_file";
        } else if (_typeArg === "d") {
          options.type = "directory";
        }
      }

      const _files = await fileSystemService.findFiles(_searchPath, options);

      if (_files.length === 0) {
        return {
          success: true,
          message: "No _files found",
        };
      }

      const _output = _files.map((f) => f._path).join("\n");
      return {
        success: true,
        message: _output,
      };
    } catch (_error) {
      return {
        success: false,
        message: `find: ${_error.message}`,
      };
    }
  }

  private async handleWHICH(args: string[]): Promise<FSCommandResult> {
    if (args.length === 0) {
      return {
        success: false,
        message: "which: missing _command operand",
      };
    }

    try {
      const _command = args[0];
      const _location = await fileSystemService.which(_command);

      if (_location) {
        return {
          success: true,
          message: _location,
        };
      } else {
        return {
          success: false,
          message: `which: no ${_command} in PATH`,
        };
      }
    } catch (_error) {
      return {
        success: false,
        message: `which: ${_error.message}`,
      };
    }
  }

  private async handleSTAT(args: string[]): Promise<FSCommandResult> {
    if (args.length === 0) {
      return {
        success: false,
        message: "stat: missing _file operand",
      };
    }

    try {
      const _file = args[0];
      const _stats = await fileSystemService.getFileStats(_file);

      let _output = `File: ${_stats.name}\n`;
      _output += `Path: ${_stats.path}\n`;
      _output += `Size: ${this.formatSize(_stats.size)}\n`;
      _output += `Type: ${_stats.isDirectory ? "Directory" : _stats.isFile ? "File" : "Other"}\n`;
      _output += `Permissions: ${_stats.permissions}\n`;
      _output += `Modified: ${_stats.modified.toLocaleString()}\n`;
      _output += `Created: ${_stats.created.toLocaleString()}\n`;
      _output += `Symlink: ${_stats.isSymlink ? "Yes" : "No"}`;

      return {
        success: true,
        message: _output,
      };
    } catch (_error) {
      return {
        success: false,
        message: `stat: ${_error.message}`,
      };
    }
  }

  private async handleCHMOD(args: string[]): Promise<FSCommandResult> {
    if (args.length < 2) {
      return {
        success: false,
        message: "chmod: missing operand",
      };
    }

    return {
      success: false,
      message: "chmod: not implemented in this environment (use system chmod)",
    };
  }

  private async handleTREE(args: string[]): Promise<FSCommandResult> {
    try {
      const _startPath = args[0] || this.currentWorkingDirectory;
      const _maxDepth = 3; // Limit depth to avoid overwhelming _output

      const _tree = await this.buildTree(_startPath, "", _maxDepth, 0);

      return {
        success: true,
        message: _tree,
      };
    } catch (_error) {
      return {
        success: false,
        message: `_tree: ${_error.message}`,
      };
    }
  }

  private async buildTree(
    dirPath: string,
    prefix: string,
    _maxDepth: number,
    currentDepth: number,
  ): Promise<string> {
    if (currentDepth >= _maxDepth) {
      return "";
    }

    let result = "";
    try {
      const _files = await fileSystemService.listDirectory(dirPath, {
        includeHidden: false,
      });

      for (let i = 0; i < _files.length; i++) {
        const _file = _files[i];
        const _isLast = i === _files.length - 1;
        const _connector = _isLast ? "└── " : "├── ";
        const _name = _file.isDirectory ? chalk.blue(_file._name) : _file._name;

        result += `${prefix + _connector + _name}\n`;

        if (_file.isDirectory && currentDepth < _maxDepth - 1) {
          const _newPrefix = prefix + (_isLast ? "    " : "│   ");
          result += await this.buildTree(
            path.join(dirPath, _file._name),
            _newPrefix,
            _maxDepth,
            currentDepth + 1,
          );
        }
      }
    } catch (_error) {
      // Skip directories we can't read
    }

    return result;
  }

  private formatSize(bytes: number): string {
    const _units = ["B", "KB", "MB", "GB", "TB"];
    let _size = bytes;
    let unitIndex = 0;

    while (_size >= 1024 && unitIndex < _units.length - 1) {
      _size /= 1024;
      unitIndex++;
    }

    return `${_size.toFixed(unitIndex === 0 ? 0 : 1)}${_units[unitIndex]}`;
  }
}

export const _fileSystemCommands = FileSystemCommands.getInstance();
