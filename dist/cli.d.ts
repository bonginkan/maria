import { Command } from 'commander';

/**
 * MARIA CLI - Command Line Interface
 */

interface CLIOptions {
    config?: string;
    priority?: 'privacy-first' | 'performance' | 'cost-effective' | 'auto';
    provider?: string;
    model?: string;
    debug?: boolean;
    offline?: boolean;
}
declare function createCLI(): Command;

export { type CLIOptions, createCLI };
