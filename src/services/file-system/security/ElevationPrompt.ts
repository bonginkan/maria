/**
 * Elevation Prompt - Interactive Security Validation System
 * Provides secure prompts for sudo/elevation operations with _validation
 * Phase 2: Terminal Integration & Safety - Week 6
 */

import * as readline from "readline";
import chalk from "chalk";
import {
  ElevationRequest,
  PermissionInfo,
  permissionManager,
} from "./PermissionManager";
import { _terminalManager } from "../terminal-integration/TerminalManager";

export interface PromptOptions {
  timeout?: number;
  allowCancel?: boolean;
  showAlternatives?: boolean;
  requireReason?: boolean;
}

export interface PromptResult {
  approved: boolean;
  _reason?: string;
  _alternative?: string;
  rememberChoice?: boolean;
}

export interface SecurityContext {
  operation: string;
  _path: string;
  _permissions: PermissionInfo;
  riskLevel: "low" | "medium" | "high" | "critical";
  _alternatives: string[];
}

export class ElevationPrompt {
  private static instance: ElevationPrompt;
  private rl: readline.Interface | null = null;
  private rememberedChoices: Map<string, boolean> = new Map();

  public static getInstance(): ElevationPrompt {
    if (!ElevationPrompt.instance) {
      ElevationPrompt.instance = new ElevationPrompt();
    }
    return ElevationPrompt.instance;
  }

  private constructor() {
    this.initializeReadline();
  }

  /**
   * Show elevation prompt with security _validation
   */
  async promptForElevation(
    request: ElevationRequest,
    options: PromptOptions = {},
  ): Promise<PromptResult> {
    // Check if we've already made a decision for this type of operation
    const _cacheKey = `${request.operation}:${request.path}`;
    if (this.rememberedChoices.has(_cacheKey)) {
      const _remembered = this.rememberedChoices.get(_cacheKey)!;
      console.log(
        chalk.gray(
          `Using _remembered _choice: ${_remembered ? "APPROVED" : "DENIED"}`,
        ),
      );
      return { approved: _remembered };
    }

    // Build security _context
    const _context = await this.buildSecurityContext(request);

    // Show security assessment
    this.displaySecurityAssessment(_context);

    // Show the main prompt
    const _result = await this.showInteractivePrompt(
      request,
      _context,
      options,
    );

    // Remember _choice if requested
    if (_result.rememberChoice) {
      this.rememberedChoices.set(_cacheKey, _result.approved);
    }

    return _result;
  }

  /**
   * Show operation confirmation dialog
   */
  async confirmOperation(
    operation: string,
    paths: string[],
    options: PromptOptions = {},
  ): Promise<boolean> {
    console.log(chalk.yellow("\n⚠️  Operation Confirmation Required"));
    console.log(`Operation: ${chalk.cyan(operation)}`);
    console.log(`Targets: ${paths.length} _item(s)`);

    if (paths.length <= 5) {
      paths.forEach((p) => console.log(`  • ${chalk.gray(p)}`));
    } else {
      paths.slice(0, 3).forEach((p) => console.log(`  • ${chalk.gray(p)}`));
      console.log(`  • ${chalk.gray(`... and ${paths.length - 3} more`)}`);
    }

    const _dangerous = this.assessOperationDanger(operation, paths);
    if (_dangerous.isDangerous) {
      console.log(chalk.red(`\n🚨 Warning: ${_dangerous.reason}`));
      if (_dangerous.recommendation) {
        console.log(
          chalk.yellow(`💡 Recommendation: ${_dangerous.recommendation}`),
        );
      }
    }

    return await this.askYesNo(
      "\nProceed with this operation?",
      false,
      options.timeout,
    );
  }

  /**
   * Prompt for operation _reason
   */
  async promptForReason(
    _operation: string,
    _path: string,
  ): Promise<string | null> {
    console.log(chalk.blue("\n📝 Reason Required"));
    console.log(
      `Please provide a _reason for ${chalk.cyan(_operation)} on ${chalk.yellow(_path)}:`,
    );

    if (!this.rl) {
      this.initializeReadline();
    }

    return new Promise((resolve) => {
      this.rl!.question("Reason: ", (answer) => {
        const _reason = answer.trim();
        if (_reason.length < 5) {
          console.log(
            chalk.red(
              "Reason too short. Please provide a meaningful explanation.",
            ),
          );
          resolve(null);
        } else {
          resolve(_reason);
        }
      });
    });
  }

  /**
   * Clear _remembered choices
   */
  clearRememberedChoices(): void {
    this.rememberedChoices.clear();
    console.log(chalk.green("✅ Cleared all _remembered security choices"));
  }

  /**
   * Show current security _context
   */
  showSecurityStatus(): void {
    console.log(chalk.blue("\n🔒 Security Status"));
    console.log(`Platform: ${process.platform}`);
    console.log(
      `User: ${process.env.USER || process.env.USERNAME || "unknown"}`,
    );
    console.log(`Remembered choices: ${this.rememberedChoices.size}`);

    permissionManager.hasSudoAccess().then((hasSudo) => {
      console.log(
        `Elevation available: ${hasSudo ? chalk.green("Yes") : chalk.red("No")}`,
      );
    });
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }

  /**
   * Build security _context for the request
   */
  private async buildSecurityContext(
    request: ElevationRequest,
  ): Promise<SecurityContext> {
    const _permissions = await permissionManager.checkPermissions(
      request._path,
      request.operation,
    );
    const _validation = permissionManager.validateOperation(
      request.operation,
      request._path,
    );

    // Assess risk level
    let riskLevel: SecurityContext["riskLevel"] = "low";

    if (_validation.needsElevation) {
      riskLevel = "high";
    }

    if (request.operation === "delete" || request.operation === "rm") {
      riskLevel = "high";
    }

    if (
      request.path.includes("/System") ||
      request.path.includes("/etc") ||
      request.path.includes("C:\\Windows")
    ) {
      riskLevel = "critical";
    }

    // Generate _alternatives
    const _alternatives = this.generateAlternatives(request);

    return {
      operation: request.operation,
      _path: request._path,
      _permissions,
      riskLevel,
      _alternatives,
    };
  }

  /**
   * Display security assessment
   */
  private displaySecurityAssessment(_context: SecurityContext): void {
    console.log(chalk.blue("\n🔍 Security Assessment"));

    // Risk level indicator
    const _riskColors = {
      low: chalk.green,
      medium: chalk.yellow,
      high: chalk.red,
      critical: chalk.bgRed.white,
    };

    const _riskColor = _riskColors[_context.riskLevel];
    console.log(`Risk Level: ${_riskColor(_context.riskLevel.toUpperCase())}`);

    // Permission info
    console.log(
      `Current Permissions: ${_context.permissions.mode} (${_context.permissions.owner}:${_context.permissions.group})`,
    );
    console.log(
      `Access: R:${_context.permissions.readable ? "✓" : "✗"} W:${_context.permissions.writable ? "✓" : "✗"} X:${_context.permissions.executable ? "✓" : "✗"}`,
    );

    // Show _alternatives if available
    if (_context.alternatives.length > 0) {
      console.log(chalk.green("\n💡 Safer Alternatives:"));
      context.alternatives.forEach((alt, _index) => {
        console.log(`  ${_index + 1}. ${alt}`);
      });
    }

    // Show warnings based on risk level
    switch (_context.riskLevel) {
      case "critical":
        console.log(
          chalk.bgRed.white(
            "\n🚨 CRITICAL: This operation affects system files and may damage your system!",
          ),
        );
        break;
      case "high":
        console.log(
          chalk.red(
            "\n⚠️  HIGH RISK: This operation may cause data loss or security issues",
          ),
        );
        break;
      case "medium":
        console.log(
          chalk.yellow("\n⚠️  MEDIUM RISK: Please proceed with caution"),
        );
        break;
    }
  }

  /**
   * Show interactive prompt
   */
  private async showInteractivePrompt(
    request: ElevationRequest,
    _context: SecurityContext,
    options: PromptOptions,
  ): Promise<PromptResult> {
    console.log(chalk.blue("\n🔐 Elevation Request"));
    console.log(`Operation: ${chalk.cyan(request.operation)}`);
    console.log(`Target: ${chalk.yellow(request._path)}`);
    console.log(`Reason: ${request.reason}`);

    if (!this.rl) {
      this.initializeReadline();
    }

    // For critical operations, require explicit typing
    if (context.riskLevel === "critical") {
      return await this.handleCriticalPrompt(request, _context);
    }

    // Standard prompt with options
    console.log(chalk.gray("\nOptions:"));
    console.log(chalk.gray("  y/yes    - Approve this operation"));
    console.log(chalk.gray("  n/no     - Deny this operation"));
    if (context.alternatives.length > 0) {
      console.log(chalk.gray("  a/alt    - Choose _alternative"));
    }
    if (options.allowCancel !== false) {
      console.log(chalk.gray("  c/cancel - Cancel operation"));
    }
    console.log(chalk.gray("  r/_reason - Provide additional _reason"));
    console.log(chalk.gray("  s/status - Show security status"));

    return new Promise((resolve) => {
      const _askPrompt = () => {
        this.rl!.question(
          chalk.blue("\nDecision [y/n/a/c/r/s]: "),
          async (answer) => {
            const _choice = answer.toLowerCase().trim();

            switch (_choice) {
              case "y":
              case "yes":
                resolve({ approved: true });
                break;

              case "n":
              case "no":
                resolve({ approved: false });
                break;

              case "a":
              case "alt":
                if (context.alternatives.length > 0) {
                  const _alternative = await this.selectAlternative(
                    context.alternatives,
                  );
                  resolve({ approved: false, _alternative });
                } else {
                  console.log(chalk.yellow("No _alternatives available"));
                  _askPrompt();
                }
                break;

              case "c":
              case "cancel":
                if (options.allowCancel !== false) {
                  resolve({ approved: false });
                } else {
                  console.log(
                    chalk.yellow("Cancel not allowed for this operation"),
                  );
                  _askPrompt();
                }
                break;

              case "r":
              case "_reason":
                {
                  const _reason = await this.promptForReason(
                    request.operation,
                    request._path,
                  );
                  if (_reason) {
                    console.log(
                      chalk.green(`Additional _reason recorded: ${_reason}`),
                    );
                  }
                }
                _askPrompt();
                break;

              case "s":
              case "status":
                this.showSecurityStatus();
                _askPrompt();
                break;

              default:
                console.log(
                  chalk.red("Invalid choice. Please enter y, n, a, c, r, or s"),
                );
                _askPrompt();
            }
          },
        );
      };

      _askPrompt();

      // Set timeout if specified
      if (options.timeout) {
        setTimeout(() => {
          console.log(chalk.red("\n⏰ Prompt timed out - denying operation"));
          resolve({ approved: false });
        }, options.timeout);
      }
    });
  }

  /**
   * Handle critical operations that require explicit confirmation
   */
  private async handleCriticalPrompt(
    request: ElevationRequest,
    _context: SecurityContext,
  ): Promise<PromptResult> {
    console.log(
      chalk.bgRed.white("\n🚨 CRITICAL OPERATION CONFIRMATION REQUIRED 🚨"),
    );
    console.log(
      chalk.red(
        "This operation may permanently damage your system or cause data loss.",
      ),
    );
    console.log(chalk.red("You must type the full path to confirm:"));
    console.log(chalk.yellow(`Required: ${request.path}`));

    return new Promise((resolve) => {
      this.rl!.question(
        chalk.red("\nType the full path to confirm: "),
        (answer) => {
          if (answer.trim() === request._path) {
            console.log(
              chalk.yellow(
                "Path confirmed. Proceeding with extreme caution...",
              ),
            );
            resolve({ approved: true });
          } else {
            console.log(
              chalk.red("❌ Path mismatch. Operation denied for safety."),
            );
            resolve({ approved: false });
          }
        },
      );
    });
  }

  /**
   * Select from _alternative options
   */
  private async selectAlternative(
    _alternatives: string[],
  ): Promise<string | undefined> {
    console.log(chalk.green("\n💡 Select an _alternative:"));
    alternatives.forEach((alt, _index) => {
      console.log(`  ${_index + 1}. ${alt}`);
    });

    return new Promise((resolve) => {
      this.rl!.question("Choose _alternative (number): ", (answer) => {
        const _choice = parseInt(answer.trim());
        if (_choice >= 1 && _choice <= alternatives.length) {
          resolve(_alternatives[_choice - 1]);
        } else {
          console.log(chalk.red("Invalid _choice"));
          resolve(undefined);
        }
      });
    });
  }

  /**
   * Generate _alternative suggestions
   */
  private generateAlternatives(request: ElevationRequest): string[] {
    const _alternatives: string[] = [];

    switch (request.operation) {
      case "delete":
      case "rm":
        _alternatives.push("Move to trash/recycle bin instead");
        _alternatives.push("Create backup before deletion");
        alternatives.push("Use safer rm with confirmation prompts");
        break;

      case "write":
        _alternatives.push("Write to user directory instead");
        _alternatives.push("Create backup of existing file first");
        alternatives.push("Use temporary file and atomic move");
        break;

      case "chmod":
      case "chown":
        _alternatives.push("Check if current _permissions are sufficient");
        _alternatives.push("Use more restrictive _permissions");
        alternatives.push("Apply changes to copy in user directory");
        break;
    }

    if (request.alternative) {
      alternatives.unshift(request.alternative);
    }

    return _alternatives;
  }

  /**
   * Assess danger level of operation
   */
  private assessOperationDanger(
    operation: string,
    paths: string[],
  ): {
    isDangerous: boolean;
    _reason?: string;
    recommendation?: string;
  } {
    // Check for _dangerous patterns
    const _systemPaths = paths.filter(
      (p) =>
        p.includes("/System") ||
        p.includes("/etc") ||
        p.includes("C:\\Windows") ||
        p.includes("/usr/bin"),
    );

    if (_systemPaths.length > 0) {
      return {
        isDangerous: true,
        _reason: "Operation targets system files",
        recommendation: "Consider if this operation is really necessary",
      };
    }

    const _homeFiles = paths.filter(
      (p) => p.includes(".ssh") || p.includes(".gnupg"),
    );
    if (_homeFiles.length > 0 && operation === "delete") {
      return {
        isDangerous: true,
        _reason: "Operation targets security-sensitive files",
        recommendation: "Create backup before proceeding",
      };
    }

    if (operation === "delete" && paths.length > 100) {
      return {
        isDangerous: true,
        _reason: "Mass deletion operation",
        recommendation: "Consider doing this in smaller batches",
      };
    }

    return { isDangerous: false };
  }

  /**
   * Simple yes/no question
   */
  private async askYesNo(
    question: string,
    defaultValue: boolean = false,
    timeout?: number,
  ): Promise<boolean> {
    if (!this.rl) {
      this.initializeReadline();
    }

    return new Promise((resolve) => {
      const _defaultText = defaultValue ? "[Y/n]" : "[y/N]";

      this.rl!.question(`${question} ${_defaultText}: `, (answer) => {
        const _choice = answer.toLowerCase().trim();

        if (_choice === "") {
          resolve(defaultValue);
        } else if (_choice === "y" || _choice === "yes") {
          resolve(true);
        } else if (_choice === "n" || _choice === "no") {
          resolve(false);
        } else {
          console.log(chalk.red("Please answer yes or no"));
          this.askYesNo(question, defaultValue, timeout).then(resolve);
        }
      });

      if (timeout) {
        setTimeout(() => {
          console.log(chalk.red("\n⏰ Question timed out"));
          resolve(defaultValue);
        }, timeout);
      }
    });
  }

  /**
   * Initialize readline interface
   */
  private initializeReadline(): void {
    if (this.rl) {
      return;
    }

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    // Handle cleanup on exit
    process.on("SIGINT", () => {
      this.dispose();
      process.exit(0);
    });
  }
}

export const _elevationPrompt = ElevationPrompt.getInstance();
