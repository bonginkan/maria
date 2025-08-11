#!/usr/bin/env node
import { Command } from 'commander';

/**
 * MARIA CLI - Command Line Interface
 * OSS Version with core functionality
 */

interface CLIOptions {
    model?: string;
    debug?: boolean;
}
declare function createCLI(): Command;

export { type CLIOptions, createCLI };
