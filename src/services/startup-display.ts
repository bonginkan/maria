/**
 * MARIA CODE Startup Display
 * Beautiful ASCII art logo and welcome screen
 */

import chalk from 'chalk';

export function displayStartupLogo(): void {
  console.clear();

  // Beautiful border and logo
  console.log(chalk.magenta('╔══════════════════════════════════════════════════════════╗'));
  console.log(chalk.magenta('║                                                          ║'));
  console.log(
    chalk.magenta('║  ') +
      chalk.magentaBright.bold('███╗   ███╗ █████╗ ██████╗ ██╗ █████╗ ') +
      chalk.magenta('               ║'),
  );
  console.log(
    chalk.magenta('║  ') +
      chalk.magentaBright.bold('████╗ ████║██╔══██╗██╔══██╗██║██╔══██╗') +
      chalk.magenta('               ║'),
  );
  console.log(
    chalk.magenta('║  ') +
      chalk.magentaBright.bold('██╔████╔██║███████║██████╔╝██║███████║') +
      chalk.magenta('               ║'),
  );
  console.log(
    chalk.magenta('║  ') +
      chalk.magentaBright.bold('██║╚██╔╝██║██╔══██║██╔══██╗██║██╔══██║') +
      chalk.magenta('               ║'),
  );
  console.log(
    chalk.magenta('║  ') +
      chalk.magentaBright.bold('██║ ╚═╝ ██║██║  ██║██║  ██║██║██║  ██║') +
      chalk.magenta('               ║'),
  );
  console.log(
    chalk.magenta('║  ') +
      chalk.magentaBright.bold('╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═╝') +
      chalk.magenta('               ║'),
  );
  console.log(chalk.magenta('║                                                          ║'));
  console.log(
    chalk.magenta('║  ') +
      chalk.magentaBright.bold(' ██████╗ ██████╗ ██████╗ ███████╗') +
      chalk.magenta('                    ║'),
  );
  console.log(
    chalk.magenta('║  ') +
      chalk.magentaBright.bold('██╔════╝██╔═══██╗██╔══██╗██╔════╝') +
      chalk.magenta('                    ║'),
  );
  console.log(
    chalk.magenta('║  ') +
      chalk.magentaBright.bold('██║     ██║   ██║██║  ██║█████╗  ') +
      chalk.magenta('                    ║'),
  );
  console.log(
    chalk.magenta('║  ') +
      chalk.magentaBright.bold('██║     ██║   ██║██║  ██║██╔══╝  ') +
      chalk.magenta('                    ║'),
  );
  console.log(
    chalk.magenta('║  ') +
      chalk.magentaBright.bold('╚██████╗╚██████╔╝██████╔╝███████╗') +
      chalk.magenta('                    ║'),
  );
  console.log(
    chalk.magenta('║  ') +
      chalk.magentaBright.bold(' ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝') +
      chalk.magenta('                    ║'),
  );
  console.log(chalk.magenta('║                                                          ║'));
  console.log(
    chalk.magenta('║        ') +
      chalk.gray('AI-Powered Development Platform') +
      chalk.magenta('                  ║'),
  );
  console.log(
    chalk.magenta('║         ') +
      chalk.gray('(c) 2025 Bonginkan Inc.') +
      chalk.magenta('                        ║'),
  );
  console.log(chalk.magenta('║                                                          ║'));
  console.log(chalk.magenta('╚══════════════════════════════════════════════════════════╝'));
  console.log('');
  console.log(chalk.cyan.bold('Welcome to MARIA CODE Interactive Chat'));
  console.log('');
  console.log(
    chalk.green('40+ Slash Commands Available') +
      chalk.gray(' - Type ') +
      chalk.yellow('/help') +
      chalk.gray(' to see all'),
  );
  console.log(chalk.gray('Type anytime to interrupt current processing'));
  console.log('');
  console.log('You can:');
  console.log(chalk.gray('• ') + 'Type naturally for AI assistance');
  console.log(chalk.gray('• ') + 'Use slash commands for specific actions');
  console.log(chalk.gray('• ') + 'Interrupt anytime with new instructions');
  console.log('');
  console.log(
    chalk.gray('Examples: ') +
      chalk.yellow('/code') +
      ', ' +
      chalk.yellow('/test') +
      ', ' +
      chalk.yellow('/review') +
      ', ' +
      chalk.yellow('/video') +
      ', ' +
      chalk.yellow('/image'),
  );
  console.log('');
}

export function displayCompactLogo(): void {
  // Compact version for limited space
  console.log(chalk.magenta.bold('MARIA CODE'));
  console.log(chalk.gray('AI-Powered Development Platform'));
  console.log(chalk.gray('(c) 2025 Bonginkan Inc.'));
  console.log('');
}
