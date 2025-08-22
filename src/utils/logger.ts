/**
 * Logger Utility
 * ログ出力の統一的な管理
 */

import chalk from 'chalk';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

class Logger {
  private level: LogLevel = LogLevel.INFO;
  private readonly prefix = '[MARIA CODE]';

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.log(chalk.magenta(`${this.prefix} [DEBUG]`), ...args);
    }
  }

  info(...args: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      console.log(chalk.bold.magenta(`${this.prefix} [INFO]`), ...args);
    }
  }

  warn(...args: unknown[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(chalk.bold.magenta(`${this.prefix} [WARN]`), ...args);
    }
  }

  error(...args: unknown[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(chalk.bold.magenta(`${this.prefix} [ERROR]`), ...args);
    }
  }

  success(...args: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      console.log(chalk.bold.magenta(`${this.prefix} [SUCCESS]`), ...args);
    }
  }

  task(
    taskName: string,
    status: 'start' | 'progress' | 'complete' | 'error',
    message?: string,
  ): void {
    if (this.level > LogLevel.INFO) {return;}

    const statusIcons = {
      start: '🚀',
      progress: '⏳',
      complete: '✅',
      error: '❌',
    };

    const statusColors = {
      start: chalk.bold.magenta,
      progress: chalk.magenta,
      complete: chalk.bold.magenta,
      error: chalk.bold.magenta,
    };

    const icon = statusIcons[status];
    const color = statusColors[status];
    const formattedMessage = message ? `: ${message}` : '';

    console.log(color(`${this.prefix} ${icon} ${taskName}${formattedMessage}`));
  }

  table(data: Record<string, unknown>[]): void {
    if (this.level > LogLevel.INFO) {return;}
    console.table(data);
  }

  json(obj: unknown, pretty = true): void {
    if (this.level > LogLevel.DEBUG) {return;}
    console.log(chalk.magenta(`${this.prefix} [JSON]`));
    console.log(pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj));
  }

  divider(): void {
    if (this.level > LogLevel.INFO) {return;}
    console.log(chalk.magenta('─'.repeat(60)));
  }

  clear(): void {
    console.clear();
  }

  /**
   * プログレスバーを表示
   */
  progress(current: number, total: number, label?: string): void {
    if (this.level > LogLevel.INFO) {return;}

    const percentage = Math.round((current / total) * 100);
    const barLength = 30;
    const filled = Math.round((percentage / 100) * barLength);
    const empty = barLength - filled;

    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const progressText = `${current}/${total}`;
    const labelText = label ? ` ${label}` : '';

    process.stdout.write(`\r${chalk.bold.magenta(bar)} ${percentage}% ${progressText}${labelText}`);

    if (current === total) {
      process.stdout.write('\n');
    }
  }
}

// シングルトンインスタンスをエクスポート
export const logger = new Logger();

// 環境変数でログレベルを設定
const envLogLevel = process.env['MARIA_LOG_LEVEL']?.toUpperCase();
if (envLogLevel && LogLevel[envLogLevel as keyof typeof LogLevel] !== undefined) {
  logger.setLevel(LogLevel[envLogLevel as keyof typeof LogLevel]);
}
