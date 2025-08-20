/**
 * Interactive Session Service
 * Manages interactive CLI chat sessions
 */
// @ts-nocheck - Complex type interactions requiring gradual type migration

import { MariaAI } from '../maria-ai';
import chalk from 'chalk';
import * as readline from 'readline';
import * as fs from 'fs/promises'; // Used for avatar functionality
// Dynamic imports for React/Ink to avoid top-level await issues
// import React from 'react';
// import { render } from 'ink';
// import SlashCommandHandler from '../components/SlashCommandHandler.js';
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
      console.log(chalk.blue('\n⚙️  Configuration Options:\n'));
      console.log(
        chalk.gray(
          'Configuration management is temporarily disabled while React/Ink issues are resolved.',
        ),
      );
      console.log(chalk.gray('Basic configuration can be set via environment variables.'));
      console.log(chalk.yellow('Available environment variables:'));
      console.log(chalk.cyan('  OPENAI_API_KEY=') + chalk.gray('Your OpenAI API key'));
      console.log(chalk.cyan('  ANTHROPIC_API_KEY=') + chalk.gray('Your Anthropic API key'));
      console.log(chalk.cyan('  GOOGLE_AI_API_KEY=') + chalk.gray('Your Google AI API key'));
      console.log('');
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
      // Launch avatar interface directly
      await showAvatar();
      return true;

    case '/voice':
      // Launch voice mode (for now same as avatar)
      console.log(chalk.blue('🎤 Starting Voice Chat with MARIA Avatar...'));
      console.log(chalk.yellow('Voice mode will launch the avatar interface.'));
      await showAvatar();
      return true;

    // Development/Code Commands
    case '/code':
      console.log(chalk.blue('\n💻 Code Generation Mode\n'));
      console.log(chalk.gray('Entering interactive coding mode...'));
      console.log(chalk.yellow('What would you like me to code for you?'));
      return true;

    case '/test':
      console.log(chalk.blue('\n🧪 Test Generation Mode\n'));
      console.log(chalk.gray('Entering test generation mode...'));
      console.log(chalk.yellow('What code would you like me to write tests for?'));
      return true;

    case '/review':
      console.log(chalk.blue('\n🔍 Code Review Mode\n'));
      console.log(chalk.gray('Entering code review mode...'));
      console.log(chalk.yellow("Please paste the code you'd like me to review:"));
      return true;

    case '/setup':
      console.log(chalk.blue('\n🚀 Environment Setup Wizard\n'));
      console.log(chalk.gray('This wizard helps you configure MARIA for first-time use.'));
      console.log(chalk.yellow('Set the following environment variables:'));
      console.log(chalk.cyan('  export OPENAI_API_KEY=') + chalk.gray('your_openai_key'));
      console.log(chalk.cyan('  export ANTHROPIC_API_KEY=') + chalk.gray('your_anthropic_key'));
      console.log(chalk.cyan('  export GOOGLE_AI_API_KEY=') + chalk.gray('your_google_key'));
      console.log('');
      return true;

    case '/settings':
      console.log(chalk.blue('\n⚙️  Environment Settings\n'));
      console.log(chalk.gray('Checking current environment configuration...'));
      console.log(
        chalk.cyan('OPENAI_API_KEY:'),
        process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not set',
      );
      console.log(
        chalk.cyan('ANTHROPIC_API_KEY:'),
        process.env.ANTHROPIC_API_KEY ? '✅ Set' : '❌ Not set',
      );
      console.log(
        chalk.cyan('GOOGLE_AI_API_KEY:'),
        process.env.GOOGLE_AI_API_KEY ? '✅ Set' : '❌ Not set',
      );
      console.log('');
      return true;

    case '/image':
      console.log(chalk.blue('\n🎨 Image Generation Mode\n'));
      console.log(chalk.gray('Entering image generation mode...'));
      console.log(chalk.yellow("Describe the image you'd like me to generate:"));
      return true;

    case '/video':
      console.log(chalk.blue('\n🎬 Video Generation Mode\n'));
      console.log(chalk.gray('Entering video generation mode...'));
      console.log(chalk.yellow("Describe the video content you'd like me to create:"));
      return true;

    // Project Management Commands (basic implementations)
    case '/init':
      console.log(chalk.blue('\n📁 Project Initialization\n'));
      console.log(chalk.gray('Initializing new MARIA project...'));
      console.log(chalk.yellow('What type of project would you like to initialize?'));
      return true;

    case '/add-dir':
      console.log(chalk.blue('\n📂 Add Directory to Project\n'));
      console.log(chalk.gray('Adding directory to current project context...'));
      console.log(chalk.yellow('Which directory would you like to add?'));
      return true;

    case '/memory':
      console.log(chalk.blue('\n🧠 Project Memory Management\n'));
      console.log(chalk.gray('Managing project context and memory...'));
      console.log(chalk.yellow('Current project memory status will be displayed here.'));
      return true;

    case '/export':
      console.log(chalk.blue('\n📤 Export Project Data\n'));
      console.log(chalk.gray('Exporting project configuration and data...'));
      console.log(chalk.yellow('What format would you like to export to?'));
      return true;

    case '/agents':
      console.log(chalk.blue('\n🤖 Agent Management\n'));
      console.log(chalk.gray('Managing AI agents and their configurations...'));
      console.log(chalk.yellow('Available agents and their status will be displayed here.'));
      return true;

    case '/mcp':
      console.log(chalk.blue('\n🔌 MCP Integration\n'));
      console.log(chalk.gray('Managing Model Context Protocol integrations...'));
      console.log(chalk.yellow('MCP tools and connections will be shown here.'));
      return true;

    case '/ide':
      console.log(chalk.blue('\n💻 IDE Integration\n'));
      console.log(chalk.gray('Setting up IDE integrations...'));
      console.log(chalk.yellow('Supported IDEs: VS Code, Cursor, JetBrains'));
      return true;

    case '/install-github-app':
      console.log(chalk.blue('\n🐙 GitHub App Installation\n'));
      console.log(chalk.gray('Installing MARIA GitHub application...'));
      console.log(chalk.yellow('Visit: https://github.com/apps/maria-ai-assistant'));
      return true;

    case '/doctor':
      console.log(chalk.blue('\n🏥 System Diagnostics\n'));
      console.log(chalk.gray('Running comprehensive system health checks...'));
      await showHealth(maria);
      return true;

    case '/model':
      await showModelSelector(maria, args);
      return true;

    case '/sow':
      await handleSOWCommand(args);
      return true;

    case '/bug':
      await handleBugCommand(args);
      return true;

    default:
      console.log(chalk.red(`Unknown command: ${cmd}. Type /help for available commands.`));
      return true;
  }
}

function showHelp(): void {
  console.log(chalk.blue('\n📖 MARIA Commands:\n'));

  console.log(chalk.yellow('🚀 Development:'));
  console.log(chalk.cyan('/code') + '          - Generate code from description');
  console.log(chalk.cyan('/test') + '          - Generate tests for code');
  console.log(chalk.cyan('/review') + '        - Review and improve code');
  console.log(chalk.cyan('/model') + '         - Show/select AI models');
  console.log('');

  console.log(chalk.yellow('⚙️  Configuration:'));
  console.log(chalk.cyan('/setup') + '         - First-time environment setup wizard');
  console.log(chalk.cyan('/settings') + '      - Environment variable setup');
  console.log(chalk.cyan('/config') + '        - Show configuration');
  console.log('');

  console.log(chalk.yellow('🎨 Media Generation:'));
  console.log(chalk.cyan('/image') + '         - Generate images');
  console.log(chalk.cyan('/video') + '         - Generate videos');
  console.log(chalk.cyan('/avatar') + '        - Interactive ASCII avatar');
  console.log(chalk.cyan('/voice') + '         - Voice chat mode');
  console.log('');

  console.log(chalk.yellow('📁 Project Management:'));
  console.log(chalk.cyan('/init') + '          - Initialize new project');
  console.log(chalk.cyan('/add-dir') + '       - Add directory to project');
  console.log(chalk.cyan('/memory') + '        - Manage project memory');
  console.log(chalk.cyan('/export') + '        - Export project data');
  console.log('');

  console.log(chalk.yellow('🤖 Agent Management:'));
  console.log(chalk.cyan('/agents') + '        - Manage AI agents');
  console.log(chalk.cyan('/mcp') + '           - MCP integrations');
  console.log(chalk.cyan('/ide') + '           - IDE integration setup');
  console.log(chalk.cyan('/install-github-app') + ' - Install GitHub app');
  console.log('');

  console.log(chalk.yellow('⚙️  System:'));
  console.log(chalk.cyan('/status') + '        - Show system status');
  console.log(chalk.cyan('/health') + '        - Check system health');
  console.log(chalk.cyan('/doctor') + '        - System diagnostics');
  console.log(chalk.cyan('/models') + '        - List available models');
  console.log(chalk.cyan('/priority') + '      - Set priority mode');
  console.log('');

  console.log(chalk.yellow('📝 Session:'));
  console.log(chalk.cyan('/clear') + '         - Clear screen');
  console.log(chalk.cyan('/help') + '          - Show this help');
  console.log(chalk.cyan('/exit') + '          - Exit session');
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

// Unused function - config command now uses SlashCommandHandler
// function showConfig(maria: MariaAI): void {
//   console.log(chalk.blue('\n⚙️  Current Configuration:\n'));

//   const config = maria.getConfig();
//   console.log(chalk.cyan('Priority:'), config.priority || 'auto');
//   console.log(chalk.cyan('Auto Start:'), config.autoStart ? 'enabled' : 'disabled');
//   console.log(chalk.cyan('Health Monitoring:'), config.healthMonitoring ? 'enabled' : 'disabled');
//   console.log('');
// }

async function showModelSelector(maria: MariaAI, args: string[]): Promise<void> {
  console.log(chalk.blue('\n🤖 AI Model Selector\n'));

  try {
    const models = await maria.getModels();
    const available = models.filter((m) => m.available);

    if (args.length > 0) {
      // Model selection mode
      const modelName = args.join(' ');
      const targetModel = available.find(
        (m) =>
          m.name.toLowerCase().includes(modelName.toLowerCase()) ||
          m.provider.toLowerCase().includes(modelName.toLowerCase()),
      );

      if (targetModel) {
        console.log(
          chalk.green(`✅ Target model found: ${targetModel.name} (${targetModel.provider})`),
        );
        console.log(chalk.yellow('Note: Model switching will be implemented in a future version'));
        console.log(
          chalk.gray('Currently, you can switch models using environment variables or CLI options'),
        );
      } else {
        console.log(chalk.red(`❌ Model not found: ${modelName}`));
        console.log(chalk.gray('Available models listed below:'));
      }
    }

    // Show available models
    console.log(chalk.yellow('📋 Available AI Models:\n'));

    available.forEach((model, _index) => {
      const status = model.available ? '✅' : '⚠️';
      const pricing = model.pricing ? ` ($${model.pricing.input}/${model.pricing.output})` : '';

      console.log(
        `  ${status} ${chalk.bold(model.name)} ${chalk.gray(`[${model.provider}]`)}${pricing}`,
      );
      console.log(`     ${chalk.gray(model.description)}`);
      if (model.capabilities && model.capabilities.length > 0) {
        console.log(`     ${chalk.cyan('Capabilities:')} ${model.capabilities.join(', ')}`);
      }
      console.log('');
    });

    console.log(chalk.gray('Usage: /model <model_name_or_provider> - Find and display model info'));
    console.log(chalk.gray('Example: /model gpt-4 or /model anthropic'));
    console.log('');
  } catch (error: unknown) {
    console.error(chalk.red('❌ Failed to access model selector:'), error);
  }
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

async function handleSOWCommand(args: string[]): Promise<void> {
  console.log(chalk.blue('\n📋 Statement of Work (SOW) Generator\n'));

  if (args.length === 0) {
    // Show SOW templates and options
    console.log(chalk.yellow('Available SOW Templates:'));
    console.log(chalk.cyan('• /sow project <name>') + ' - Generate project-based SOW');
    console.log(chalk.cyan('• /sow consulting') + ' - Generate consulting services SOW');
    console.log(chalk.cyan('• /sow development') + ' - Generate software development SOW');
    console.log(chalk.cyan('• /sow maintenance') + ' - Generate maintenance & support SOW');
    console.log('');
    console.log(chalk.gray('Example: /sow project "Website Redesign"'));
    return;
  }

  const sowType = args[0].toLowerCase();
  const projectName = args.slice(1).join(' ') || 'New Project';

  console.log(chalk.green(`🔄 Generating ${sowType} SOW for: ${projectName}`));
  console.log(chalk.gray('This will create a comprehensive Statement of Work document...'));
  console.log('');

  // SOW template based on type
  const templates = {
    project: generateProjectSOW(projectName),
    consulting: generateConsultingSOW(projectName),
    development: generateDevelopmentSOW(projectName),
    maintenance: generateMaintenanceSOW(projectName),
  };

  const template = templates[sowType as keyof typeof templates] || templates.project;
  console.log(template);
}

async function handleBugCommand(args: string[]): Promise<void> {
  console.log(chalk.blue('\n🐛 Bug Report & Fix Assistant\n'));

  if (args.length === 0) {
    console.log(chalk.yellow('Bug Assistant Options:'));
    console.log(chalk.cyan('• /bug report') + ' - Start interactive bug report');
    console.log(chalk.cyan('• /bug analyze') + ' - Analyze error logs/stack traces');
    console.log(chalk.cyan('• /bug fix <description>') + ' - Get fix suggestions');
    console.log(chalk.cyan('• /bug search <keywords>') + ' - Search for similar issues');
    console.log('');
    console.log(chalk.gray('Example: /bug fix "TypeError: Cannot read property"'));
    return;
  }

  const action = args[0].toLowerCase();
  const details = args.slice(1).join(' ');

  switch (action) {
    case 'report':
      console.log(chalk.green('🔍 Interactive Bug Report Generator'));
      console.log(chalk.yellow('Please provide the following information:'));
      console.log('1. What were you trying to do?');
      console.log('2. What actually happened?');
      console.log('3. What did you expect to happen?');
      console.log('4. Steps to reproduce the issue');
      console.log('5. Environment details (OS, browser, version)');
      break;

    case 'analyze':
      console.log(chalk.green('🔬 Error Analysis Mode'));
      console.log(chalk.gray('Paste your error logs or stack trace below:'));
      console.log(chalk.yellow('I will analyze the error and suggest solutions...'));
      break;

    case 'fix':
      if (!details) {
        console.log(chalk.red('Please provide a bug description'));
        console.log(chalk.gray('Example: /bug fix "Application crashes on startup"'));
        return;
      }
      console.log(chalk.green(`🔧 Analyzing bug: "${details}"`));
      console.log(chalk.gray('Searching knowledge base and generating fix suggestions...'));
      console.log('');
      generateBugFixSuggestions(details);
      break;

    case 'search':
      if (!details) {
        console.log(chalk.red('Please provide search keywords'));
        return;
      }
      console.log(chalk.green(`🔍 Searching for: "${details}"`));
      console.log(chalk.gray('Looking through known issues and solutions...'));
      break;

    default:
      console.log(chalk.red(`Unknown bug action: ${action}`));
      console.log(chalk.gray('Use: /bug to see available options'));
  }
}

function generateProjectSOW(projectName: string): string {
  return `
${chalk.bold.blue('STATEMENT OF WORK')}
${chalk.gray('═'.repeat(50))}

${chalk.yellow('Project:')} ${projectName}
${chalk.yellow('Date:')} ${new Date().toLocaleDateString()}
${chalk.yellow('Client:')} [CLIENT_NAME]
${chalk.yellow('Vendor:')} MARIA Development Services

${chalk.bold('1. PROJECT OVERVIEW')}
This Statement of Work outlines the scope, deliverables, and timeline for ${projectName}.

${chalk.bold('2. SCOPE OF WORK')}
• Requirements analysis and documentation
• System design and architecture
• Development and implementation
• Testing and quality assurance
• Deployment and go-live support

${chalk.bold('3. DELIVERABLES')}
• Project specification document
• Design mockups and wireframes
• Fully functional application/system
• Test results and documentation
• Deployment package

${chalk.bold('4. TIMELINE')}
• Phase 1 - Requirements: 2 weeks
• Phase 2 - Design: 3 weeks  
• Phase 3 - Development: 6 weeks
• Phase 4 - Testing: 2 weeks
• Phase 5 - Deployment: 1 week

${chalk.bold('5. ACCEPTANCE CRITERIA')}
All deliverables must meet specified requirements and pass acceptance testing.

${chalk.gray('Generated by MARIA CLI - Statement of Work Assistant')}
`;
}

function generateConsultingSOW(projectName: string): string {
  return `
${chalk.bold.blue('CONSULTING SERVICES - STATEMENT OF WORK')}
${chalk.gray('═'.repeat(60))}

${chalk.yellow('Engagement:')} ${projectName}
${chalk.yellow('Type:')} Strategic Consulting Services

${chalk.bold('CONSULTING SCOPE')}
• Strategic planning and roadmap development
• Technology assessment and recommendations
• Process optimization analysis
• Implementation guidance and oversight

${chalk.bold('EXPECTED OUTCOMES')}
• Comprehensive strategy document
• Technology roadmap
• Implementation recommendations
• Process improvement plan

${chalk.gray('Generated by MARIA CLI - SOW Assistant')}
`;
}

function generateDevelopmentSOW(projectName: string): string {
  return `
${chalk.bold.blue('SOFTWARE DEVELOPMENT - STATEMENT OF WORK')}
${chalk.gray('═'.repeat(60))}

${chalk.yellow('Project:')} ${projectName}
${chalk.yellow('Type:')} Custom Software Development

${chalk.bold('DEVELOPMENT SCOPE')}
• Requirements gathering and analysis
• System architecture and design
• Frontend and backend development
• API development and integration
• Database design and implementation
• Testing and quality assurance

${chalk.bold('TECHNICAL DELIVERABLES')}
• Source code repository
• Technical documentation
• API documentation
• Deployment scripts
• Test suites

${chalk.gray('Generated by MARIA CLI - SOW Assistant')}
`;
}

function generateMaintenanceSOW(projectName: string): string {
  return `
${chalk.bold.blue('MAINTENANCE & SUPPORT - STATEMENT OF WORK')}
${chalk.gray('═'.repeat(60))}

${chalk.yellow('Service:')} ${projectName} Maintenance
${chalk.yellow('Type:')} Ongoing Support Services

${chalk.bold('MAINTENANCE SCOPE')}
• Bug fixes and issue resolution
• Security updates and patches
• Performance monitoring and optimization
• Feature enhancements
• Technical support

${chalk.bold('SERVICE LEVELS')}
• Critical issues: 4-hour response
• High priority: 24-hour response
• Normal priority: 72-hour response
• Enhancement requests: Next release cycle

${chalk.gray('Generated by MARIA CLI - SOW Assistant')}
`;
}

function generateBugFixSuggestions(bugDescription: string): void {
  console.log(chalk.bold('💡 Fix Suggestions:'));
  console.log('');

  // Basic pattern matching for common issues
  const lowerBug = bugDescription.toLowerCase();

  if (lowerBug.includes('cannot read property') || lowerBug.includes('undefined')) {
    console.log(chalk.green('🔹 Null/Undefined Reference Issue:'));
    console.log('  • Add null checks: if (obj && obj.property)');
    console.log('  • Use optional chaining: obj?.property');
    console.log('  • Initialize variables before use');
    console.log('  • Check async data loading completion');
  }

  if (lowerBug.includes('cors') || lowerBug.includes('cross-origin')) {
    console.log(chalk.green('🔹 CORS Issue:'));
    console.log('  • Configure server CORS headers');
    console.log('  • Use proxy in development environment');
    console.log('  • Check API endpoint configuration');
  }

  if (lowerBug.includes('memory') || lowerBug.includes('heap')) {
    console.log(chalk.green('🔹 Memory Issue:'));
    console.log('  • Check for memory leaks');
    console.log('  • Remove event listeners properly');
    console.log('  • Optimize large data processing');
    console.log('  • Use pagination for large datasets');
  }

  if (lowerBug.includes('timeout') || lowerBug.includes('slow')) {
    console.log(chalk.green('🔹 Performance Issue:'));
    console.log('  • Increase timeout settings');
    console.log('  • Optimize database queries');
    console.log('  • Add caching mechanisms');
    console.log('  • Use async/await properly');
  }

  console.log('');
  console.log(chalk.gray('💡 General debugging steps:'));
  console.log('  1. Check browser/server console logs');
  console.log('  2. Review recent code changes');
  console.log('  3. Test in different environments');
  console.log('  4. Add debugging statements/breakpoints');
  console.log('');
}
