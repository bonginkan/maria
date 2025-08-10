#!/usr/bin/env node

import chalk from 'chalk';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

console.log('');
console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════'));
console.log(chalk.cyan.bold('           MARIA CODE - Installation Complete!          '));
console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════'));
console.log('');

console.log(chalk.green('✅ MARIA CODE has been successfully installed!'));
console.log('');

// Check for local LLM servers
console.log(chalk.yellow('🔍 Checking for local LLM servers...'));

const checks = [
  {
    name: 'LM Studio',
    url: 'http://localhost:1234',
    found: false
  },
  {
    name: 'Ollama',
    url: 'http://localhost:11434',
    found: false
  },
  {
    name: 'vLLM',
    url: 'http://localhost:8000',
    found: false
  }
];

// Check each server
for (const check of checks) {
  try {
    execSync(`curl -s ${check.url}/v1/models > /dev/null 2>&1`, { timeout: 1000 });
    check.found = true;
    console.log(chalk.green(`  ✓ ${check.name} detected at ${check.url}`));
  } catch {
    console.log(chalk.gray(`  ○ ${check.name} not running (optional)`));
  }
}

console.log('');

// Create config directory
const configDir = path.join(os.homedir(), '.maria');
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
  console.log(chalk.green(`📁 Created configuration directory: ${configDir}`));
}

// Display quick start
console.log(chalk.cyan.bold('🚀 Quick Start:'));
console.log('');
console.log('  Run ' + chalk.yellow('maria') + ' or ' + chalk.yellow('mc') + ' to start');
console.log('');

console.log(chalk.cyan.bold('📚 Commands:'));
console.log('');
console.log('  ' + chalk.white('mc code') + ' "Create a REST API"    ' + chalk.gray('# Generate code'));
console.log('  ' + chalk.white('mc vision') + ' image.png          ' + chalk.gray('# Analyze images'));
console.log('  ' + chalk.white('mc review') + ' src/               ' + chalk.gray('# Review code'));
console.log('  ' + chalk.white('mc test') + ' file.ts              ' + chalk.gray('# Generate tests'));
console.log('  ' + chalk.white('mc commit') + '                     ' + chalk.gray('# Smart commits'));
console.log('');

console.log(chalk.cyan.bold('💡 Tips:'));
console.log('');
console.log('  • Use ' + chalk.yellow('/help') + ' in interactive mode to see all commands');
console.log('  • Local models are prioritized for privacy');
console.log('  • Set API keys in ' + chalk.yellow('.env') + ' for cloud providers');
console.log('');

console.log(chalk.cyan.bold('📖 Documentation & Support:'));
console.log('');
console.log('  Website: ' + chalk.blue('https://bonginkan.ai/'));
console.log('  Email:   ' + chalk.blue('info@bonginkan.ai'));
console.log('  GitHub:  ' + chalk.blue('https://github.com/bonginkan/maria'));
console.log('  Issues:  ' + chalk.blue('https://github.com/bonginkan/maria/issues'));
console.log('');

console.log(chalk.gray('─'.repeat(55)));
console.log(chalk.gray('Built with ❤️  by Bonginkan Inc.'));
console.log(chalk.gray('Making AI development accessible to everyone'));
console.log('');