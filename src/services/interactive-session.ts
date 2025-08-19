/**
 * Interactive Session Service
 * Manages interactive CLI chat sessions
 */
// @ts-nocheck - Complex type interactions requiring gradual type migration

import { MariaAI } from '../maria-ai';
import chalk from 'chalk';
import * as readline from 'readline';
import * as fs from 'fs/promises';
// import * as path from 'path'; // Not used

export interface InteractiveSession {
  start(): Promise<void>;
  stop(): void;
}

export function createInteractiveSession(maria: MariaAI): InteractiveSession {
  let running = false;
  let rl: readline.Interface | null = null;

  return {
    async start(): Promise<void> {
      running = true;

      // Create readline interface
      rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
        historySize: 100,
      });

      console.log(chalk.blue('🤖 MARIA Interactive Session Started'));
      console.log(chalk.gray('Type your message, or use /help for commands. Type /exit to quit.'));
      console.log('');

      // Handle Ctrl+C gracefully
      rl.on('SIGINT', () => {
        console.log(chalk.yellow('\n\nReceived SIGINT. Use /exit to quit gracefully.'));
        rl?.prompt();
      });

      while (running) {
        try {
          const message = await getUserInput(rl);

          if (!message || !running) break;

          // Handle special commands
          if (message.startsWith('/')) {
            const handled = await handleCommand(message.trim(), maria);
            if (handled === 'exit') {
              break;
            }
            if (handled) continue;
          }

          // Send to AI
          process.stdout.write(chalk.blue('\nMARIA: '));

          try {
            // let fullResponse = '';
            const stream = maria.chatStream(message);

            for await (const chunk of stream) {
              process.stdout.write(chunk);
              // fullResponse += chunk;
            }

            console.log('\n');
          } catch (error: unknown) {
            console.error(chalk.red('\n❌ Error:'), error);
          }
        } catch (error: unknown) {
          if ((error as unknown).message?.includes('canceled')) {
            break; // User pressed Ctrl+C
          }
          console.error(chalk.red('❌ Session error:'), error);
        }
      }

      rl?.close();
      await maria.close();
      console.log(chalk.green('\n👋 Session ended. Goodbye!'));
    },

    stop(): void {
      running = false;
      rl?.close();
    },
  };
}

function getUserInput(rl: readline.Interface): Promise<string> {
  return new Promise((resolve) => {
    rl.question(chalk.cyan('You: '), (answer) => {
      resolve(answer.trim());
    });
  });
}

async function handleCommand(command: string, maria: MariaAI): Promise<string | boolean> {
  const parts = command.split(' ');
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (cmd) {
    case '/help':
      showHelp();
      return true;

    case '/status':
      await showStatus(maria);
      return true;

    case '/models':
      await showModels(maria);
      return true;

    case '/health':
      await showHealth(maria);
      return true;

    case '/config':
      showConfig(maria);
      return true;

    case '/priority':
      if (args[0]) {
        const mode = args[0] as unknown;
        maria.setPriorityMode(mode);
        console.log(chalk.green(`✅ Priority mode set to: ${mode}`));
      } else {
        console.log(
          chalk.yellow('Usage: /priority <privacy-first|performance|cost-effective|auto>'),
        );
      }
      return true;

    case '/exit':
    case '/quit':
      return 'exit';

    case '/clear':
      console.clear();
      console.log(chalk.blue('🤖 MARIA Interactive Session'));
      console.log('');
      return true;

    case '/avatar':
      await showAvatar();
      return true;

    default:
      console.log(chalk.red(`Unknown command: ${cmd}. Type /help for available commands.`));
      return true;
  }
}

function showHelp(): void {
  console.log(chalk.blue('\n📖 MARIA Commands:\n'));
  console.log(chalk.cyan('/help') + '     - Show this help message');
  console.log(chalk.cyan('/avatar') + '   - Show ASCII avatar interface');
  console.log(chalk.cyan('/status') + '   - Show system status');
  console.log(chalk.cyan('/models') + '   - List available models');
  console.log(chalk.cyan('/health') + '   - Check system health');
  console.log(chalk.cyan('/config') + '   - Show configuration');
  console.log(chalk.cyan('/priority') + ' <mode> - Set priority mode');
  console.log(chalk.cyan('/clear') + '    - Clear screen');
  console.log(chalk.cyan('/exit') + '     - Exit session');
  console.log('');
}

async function showStatus(maria: MariaAI): Promise<void> {
  console.log(chalk.blue('\n📊 System Status:\n'));

  try {
    const health = await maria.getHealth();
    const status =
      health.overall === 'healthy' ? '✅' : health.overall === 'degraded' ? '⚠️' : '❌';

    console.log(`${status} Overall: ${health.overall}`);
    console.log(`💻 CPU: ${health.system.cpu}%`);
    console.log(`🧠 Memory: ${health.system.memory}%`);
    console.log(`💾 Disk: ${health.system.disk}%`);
    console.log('');
  } catch (error: unknown) {
    console.error(chalk.red('❌ Failed to get status:'), error);
  }
}

async function showModels(maria: MariaAI): Promise<void> {
  console.log(chalk.blue('\n🔧 Available Models:\n'));

  try {
    const models = await maria.getModels();
    const available = models.filter((m) => m.available);

    if (available.length === 0) {
      console.log(chalk.yellow('No models available'));
      return;
    }

    for (const model of available) {
      const provider = chalk.gray(`[${model.provider}]`);
      const capabilities = model.capabilities.join(', ');
      console.log(`✅ ${chalk.bold(model.name)} ${provider}`);
      console.log(`   ${chalk.gray(capabilities)}`);
    }
    console.log('');
  } catch (error: unknown) {
    console.error(chalk.red('❌ Failed to get models:'), error);
  }
}

async function showHealth(maria: MariaAI): Promise<void> {
  console.log(chalk.blue('\n🏥 Health Status:\n'));

  try {
    const health = await maria.getHealth();

    // Services
    console.log(chalk.bold('Local Services:'));
    Object.entries(health.services).forEach(([name, status]) => {
      const icon = status.status === 'running' ? '✅' : '⚠️';
      console.log(`  ${icon} ${name}: ${status.status}`);
    });

    console.log('');
    console.log(chalk.bold('Cloud APIs:'));
    Object.entries(health.cloudAPIs).forEach(([name, status]) => {
      const icon = status.status === 'available' ? '✅' : '⚠️';
      console.log(`  ${icon} ${name}: ${status.status}`);
    });

    if (health.recommendations.length > 0) {
      console.log('');
      console.log(chalk.bold('Recommendations:'));
      health.recommendations.forEach((rec) => {
        console.log(`  💡 ${rec}`);
      });
    }

    console.log('');
  } catch (error: unknown) {
    console.error(chalk.red('❌ Failed to get health status:'), error);
  }
}

function showConfig(maria: MariaAI): void {
  console.log(chalk.blue('\n⚙️  Current Configuration:\n'));

  const config = maria.getConfig();
  console.log(chalk.cyan('Priority:'), config.priority || 'auto');
  console.log(chalk.cyan('Auto Start:'), config.autoStart ? 'enabled' : 'disabled');
  console.log(chalk.cyan('Health Monitoring:'), config.healthMonitoring ? 'enabled' : 'disabled');
  console.log('');
}

async function showAvatar(): Promise<void> {
  console.log(chalk.blue('\n🎭 MARIA Avatar Interface\n'));

  const avatarPath = '/Users/bongin_max/maria_code/face_only_96x96_ramp.txt';

  try {
    // Load and display avatar
    const avatarData = await fs.readFile(avatarPath, 'utf-8');
    const lines = avatarData.split('\n').slice(0, 30); // Show first 30 lines for compact display

    console.log(chalk.white('═'.repeat(80)));
    lines.forEach((line) => {
      // Trim long lines for terminal display
      const displayLine = line.length > 80 ? line.substring(0, 80) : line;
      console.log(chalk.white(displayLine));
    });
    console.log(chalk.white('═'.repeat(80)));

    console.log(chalk.yellow('\n👋 Hello! I am MARIA, your AI assistant!'));
    console.log(chalk.gray('This is a preview of the avatar interface.'));
    console.log(chalk.gray('Full interactive avatar with animations is coming soon!\n'));
  } catch (error) {
    console.log(chalk.red('❌ Could not load avatar file'));
    console.log(chalk.gray('Avatar file should be at: ' + avatarPath));
  }
}
