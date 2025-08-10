/**
 * UI Utilities
 * Helper functions for CLI display and formatting
 */

import chalk from 'chalk';
import { HealthStatus } from '../types';

export function printWelcome(): void {
  console.log(chalk.blue('╔══════════════════════════════════════════════════════════╗'));
  console.log(chalk.blue('║                                                          ║'));
  console.log(chalk.blue('║') + chalk.bold.cyan('                    MARIA AI Assistant                   ') + chalk.blue('║'));
  console.log(chalk.blue('║') + chalk.gray('              Intelligent CLI with Multi-Model AI         ') + chalk.blue('║'));
  console.log(chalk.blue('║                                                          ║'));
  console.log(chalk.blue('╚══════════════════════════════════════════════════════════╝'));
  console.log('');
  console.log(chalk.gray('🚀 Initializing AI providers...'));
  console.log('');
}

export function printStatus(health: HealthStatus): void {
  console.log(chalk.blue('╔══════════════════════════════════════════════════════════╗'));
  console.log(chalk.blue('║') + chalk.bold.cyan('                    System Status                        ') + chalk.blue('║'));
  console.log(chalk.blue('╚══════════════════════════════════════════════════════════╝'));
  console.log('');

  // Overall status
  const statusColor = health.overall === 'healthy' ? chalk.green : 
                     health.overall === 'degraded' ? chalk.yellow : chalk.red;
  const statusIcon = health.overall === 'healthy' ? '✅' : 
                    health.overall === 'degraded' ? '⚠️' : '❌';
  
  console.log(statusColor(`${statusIcon} Overall Status: ${health.overall.toUpperCase()}`));
  console.log('');

  // System resources
  console.log(chalk.blue('📊 System Resources:'));
  console.log(`   CPU: ${formatResourceUsage(health.system.cpu)}%`);
  console.log(`   Memory: ${formatResourceUsage(health.system.memory)}%`);
  console.log(`   Disk: ${formatResourceUsage(health.system.disk)}%`);
  console.log('');

  // Local services
  console.log(chalk.blue('🤖 Local AI Services:'));
  Object.entries(health.services).forEach(([name, service]) => {
    const icon = service.status === 'running' ? '✅' : '⚠️';
    const status = service.status === 'running' ? chalk.green(service.status) : chalk.yellow(service.status);
    console.log(`   ${icon} ${name}: ${status}`);
  });
  console.log('');

  // Cloud APIs
  console.log(chalk.blue('☁️  Cloud APIs:'));
  Object.entries(health.cloudAPIs).forEach(([name, api]) => {
    const icon = api.status === 'available' ? '✅' : '⚠️';
    const status = api.status === 'available' ? chalk.green(api.status) : chalk.yellow(api.status);
    console.log(`   ${icon} ${name}: ${status}`);
  });

  // Recommendations
  if (health.recommendations.length > 0) {
    console.log('');
    console.log(chalk.blue('💡 Recommendations:'));
    health.recommendations.forEach(rec => {
      console.log(`   • ${chalk.cyan(rec)}`);
    });
  }

  console.log('');
  console.log(chalk.gray(`Last updated: ${new Date(health.timestamp).toLocaleString()}`));
}

export function formatResourceUsage(percentage: number): string {
  if (percentage < 70) {
    return chalk.green(percentage.toString());
  } else if (percentage < 90) {
    return chalk.yellow(percentage.toString());
  } else {
    return chalk.red(percentage.toString());
  }
}

export function printProgress(message: string): void {
  console.log(chalk.blue('⏳'), message);
}

export function printSuccess(message: string): void {
  console.log(chalk.green('✅'), message);
}

export function printWarning(message: string): void {
  console.log(chalk.yellow('⚠️'), message);
}

export function printError(message: string): void {
  console.log(chalk.red('❌'), message);
}

export function printInfo(message: string): void {
  console.log(chalk.blue('ℹ️'), message);
}

export function formatTable(data: any[], headers: string[]): void {
  const maxLengths = headers.map(header => 
    Math.max(header.length, ...data.map(row => String(row[header] || '').length))
  );

  // Print header
  const headerRow = headers.map((header, i) => 
    header.padEnd(maxLengths[i])
  ).join(' | ');
  console.log(chalk.bold(headerRow));
  console.log(maxLengths.map(len => '─'.repeat(len)).join('─┼─'));

  // Print data rows
  data.forEach(row => {
    const dataRow = headers.map((header, i) => 
      String(row[header] || '').padEnd(maxLengths[i])
    ).join(' | ');
    console.log(dataRow);
  });
}