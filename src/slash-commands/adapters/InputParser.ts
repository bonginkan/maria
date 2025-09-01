import { CommandArgs } from "../types/command.types";

/**
 * InputParser: Parses command strings and arguments
 * Handles flags, options, and argument extraction
 */
export class InputParser {
  /**
   * Parse a full command string into structured CommandArgs
   */
  static parseCommand(input: string): CommandArgs {
    const trimmed = input.trim();
    const parts = this.tokenize(trimmed);

    if (parts.length === 0) {
      return {
        command: "",
        args: [],
        flags: Record<string, any>,
        raw: input,
      };
    }

    const command = parts[0].startsWith("/") ? parts[0] : `/${parts[0]}`;
    const remaining = parts.slice(1);
    const { args, flags } = this.parseArguments(remaining);

    return {
      command,
      args,
      flags,
      raw: input,
    };
  }

  /**
   * Parse arguments array into args and flags
   */
  static parseArguments(args: string[]): {
    args: string[];
    flags: Record<string, boolean | string>;
  } {
    const result = {
      args: [] as string[],
      flags: Record<string, any> as Record<string, boolean | string>,
    };

    let i = 0;
    while (i < args.length) {
      const arg = args[i];

      // Long flag: --flag or --flag=value
      if (arg.startsWith("--")) {
        const [flagName, ...valueParts] = arg.slice(2).split("=");
        if (valueParts.length > 0) {
          result.flags[flagName] = valueParts.join("=");
        } else {
          // Check if next arg is a value (not another flag)
          if (i + 1 < args.length && !args[i + 1].startsWith("-")) {
            result.flags[flagName] = args[i + 1];
            i++; // Skip next arg
          } else {
            result.flags[flagName] = true;
          }
        }
      }
      // Short flag: -f or multiple -abc
      else if (arg.startsWith("-") && arg.length > 1) {
        const flags = arg.slice(1);
        // Handle multiple short flags: -abc -> -a -b -c
        for (const flag of flags) {
          result.flags[flag] = true;
        }
      }
      // Regular argument
      else {
        result.args.push(arg);
      }

      i++;
    }

    return result;
  }

  /**
   * Tokenize a command string, respecting quotes
   */
  private static tokenize(input: string): string[] {
    const tokens: string[] = [];
    let current = "";
    let inQuotes = false;
    let quoteChar = "";
    let escaped = false;

    for (let i = 0; i < input.length; i++) {
      const char = input[i];

      if (escaped) {
        current += char;
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
        continue;
      }

      if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = "";
        continue;
      }

      if (char === " " && !inQuotes) {
        if (current) {
          tokens.push(current);
          current = "";
        }
        continue;
      }

      current += char;
    }

    if (current) {
      tokens.push(current);
    }

    return tokens;
  }

  /**
   * Extract specific flag value with type conversion
   */
  static getFlag<T = string>(
    flags: Record<string, boolean | string>,
    name: string,
    defaultValue?: T,
  ): T {
    const value = flags[name];

    if (value === undefined) {
      return defaultValue as T;
    }

    // Type conversion based on default value type
    if (defaultValue !== undefined) {
      if (typeof defaultValue === "boolean") {
        return (value === true || value === "true") as any;
      }
      if (typeof defaultValue === "number") {
        return (typeof value === "string" ? parseFloat(value) : 0) as any;
      }
    }

    return value as any;
  }

  /**
   * Check if a flag is present
   */
  static hasFlag(
    flags: Record<string, boolean | string>,
    ...names: string[]
  ): boolean {
    return names.some((name) => name in flags);
  }

  /**
   * Merge multiple flag objects
   */
  static mergeFlags(
    ...flagSets: Array<Record<string, boolean | string>>
  ): Record<string, boolean | string> {
    return Object.assign({}, ...flagSets);
  }

  /**
   * Validate required arguments
   */
  static validateArgs(
    args: string[],
    minArgs: number,
    maxArgs?: number,
  ): { valid: boolean; error?: string } {
    if (args.length < minArgs) {
      return {
        valid: false,
        error: `Expected at least ${minArgs} argument(s), got ${args.length}`,
      };
    }

    if (maxArgs !== undefined && args.length > maxArgs) {
      return {
        valid: false,
        error: `Expected at most ${maxArgs} argument(s), got ${args.length}`,
      };
    }

    return { valid: true };
  }

  /**
   * Parse key=value pairs from arguments
   */
  static parseKeyValuePairs(args: string[]): Record<string, string> {
    const result: Record<string, string> = {};

    for (const arg of args) {
      const [key, ...valueParts] = arg.split("=");
      if (valueParts.length > 0) {
        result[key] = valueParts.join("=");
      }
    }

    return result;
  }
}
