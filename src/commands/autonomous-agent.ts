/**
 * Autonomous Coding Agent Command
 * World's First Fully Autonomous Professional Engineering AI
 */

import { Command } from 'commander';
import chalk from 'chalk';

import { AutonomousCodingAgentService } from '../services/autonomous-coding-agent/core/AutonomousCodingAgentService';

export default function registerAutonomousAgentCommand(program: Command): void {
  const agentCommand = program
    .command('agent')
    .description(
      "🤖 Autonomous Coding Agent - World's First Fully Autonomous Professional Engineering AI",
    )
    .alias('auto');

  agentCommand
    .command('execute <request>')
    .description('Execute autonomous coding task')
    .alias('exec')
    .option('--autonomy <level>', 'Autonomy level: assisted|collaborative|autonomous', 'autonomous')
    .option('--visual <level>', 'Visualization level: minimal|standard|detailed', 'detailed')
    .option('--reporting', 'Enable active reporting', true)
    .option('--evolution', 'Enable self-evolution learning', true)
    .action(
      async (
        request: string,
        options: {
          autonomy?: 'assisted' | 'collaborative' | 'autonomous';
          visual?: 'minimal' | 'standard' | 'detailed';
          reporting?: boolean;
          evolution?: boolean;
        },
      ) => {
        try {
          console.log(chalk.cyan('🚀 Initializing Autonomous Coding Agent...'));

          const agent = new AutonomousCodingAgentService({
            enableVisualMode: true,
            activeReporting: options.reporting ?? true,
            selfEvolution: options.evolution ?? true,
            autonomyLevel: options.autonomy ?? 'autonomous',
            visualizationLevel: options.visual ?? 'detailed',
            reportingInterval: 5,
          });

          await agent.execute(request);

          console.log(chalk.green('\n✅ Autonomous execution completed successfully!'));
        } catch (error: unknown) {
          console.error(
            chalk.red('\n❌ Autonomous agent execution failed:'),
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      },
    );

  agentCommand
    .command('demo')
    .description('Run autonomous agent demonstration')
    .action(async () => {
      try {
        console.log(chalk.cyan('🎯 Starting Autonomous Coding Agent Demo...\n'));

        const agent = new AutonomousCodingAgentService({
          enableVisualMode: true,
          activeReporting: true,
          selfEvolution: true,
          autonomyLevel: 'autonomous',
          visualizationLevel: 'detailed',
          reportingInterval: 3,
        });

        const demoRequest =
          'Create a simple TypeScript utility library with string manipulation functions, unit tests, and documentation';

        console.log(chalk.yellow(`📋 Demo Request: ${demoRequest}\n`));

        await agent.execute(demoRequest);

        console.log(
          chalk.green(
            "\n🎉 Demo completed! This demonstrates the world's first fully autonomous professional engineering AI.",
          ),
        );
        console.log(
          chalk.cyan('\n💡 Try your own request with: maria agent execute "<your request>"'),
        );
      } catch (error: unknown) {
        console.error(
          chalk.red('\n❌ Demo execution failed:'),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });

  agentCommand
    .command('status')
    .description('Show autonomous agent system status')
    .action(async () => {
      try {
        console.log(chalk.cyan('📊 Autonomous Coding Agent System Status\n'));

        const agent = new AutonomousCodingAgentService({
          enableVisualMode: false,
          activeReporting: false,
          selfEvolution: false,
          autonomyLevel: 'autonomous',
          visualizationLevel: 'minimal',
          reportingInterval: 5,
        });

        const status = agent.getStatus();

        console.log(chalk.green('✅ System Status: Ready'));
        console.log(chalk.blue(`📁 Project Path: ${status.projectPath}`));
        console.log(chalk.yellow(`🔧 Operations Completed: ${status.metrics.operations}`));
        console.log(chalk.green(`📈 Success Rate: ${status.metrics.successRate.toFixed(1)}%`));
        console.log(
          chalk.gray(`⏱️  Uptime: ${Math.floor((Date.now() - status.metrics.startTime) / 1000)}s`),
        );
        console.log(chalk.magenta(`🎯 Current Mode: ${status.currentMode?.name || 'None'}`));
        console.log(chalk.cyan(`🚀 Active: ${status.isActive ? 'Yes' : 'No'}\n`));

        console.log(chalk.cyan('🧠 Available Capabilities:'));
        console.log(chalk.white('  • Visual Mode Display with Real-time Feedback'));
        console.log(chalk.white('  • Active Reporting with Progress Tracking'));
        console.log(chalk.white('  • Self-Evolution Learning Engine'));
        console.log(chalk.white('  • 120+ Professional Engineering Modes'));
        console.log(chalk.white('  • SOW Auto-Generation'));
        console.log(chalk.white('  • Autonomous Error Recovery'));
        console.log(chalk.white('  • Multi-Language Code Generation'));
        console.log(chalk.white('  • Complete Software Development Lifecycle\n'));
      } catch (error: unknown) {
        console.error(
          chalk.red('❌ Status check failed:'),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });

  agentCommand
    .command('help')
    .description('Show detailed autonomous agent help')
    .action(() => {
      console.log(chalk.cyan('\n🤖 MARIA Autonomous Coding Agent v1.5.0'));
      console.log(chalk.cyan('═══════════════════════════════════════════════\n'));

      console.log(chalk.yellow("World's First Fully Autonomous Professional Engineering AI\n"));

      console.log(chalk.green('📋 Available Commands:'));
      console.log(
        chalk.white('  maria agent execute "<request>"  - Execute autonomous coding task'),
      );
      console.log(chalk.white('  maria agent demo                 - Run demonstration'));
      console.log(chalk.white('  maria agent status               - Show system status'));
      console.log(chalk.white('  maria agent help                 - Show this help\n'));

      console.log(chalk.green('🎯 Example Usage:'));
      console.log(chalk.gray('  maria agent execute "Create a REST API with authentication"'));
      console.log(chalk.gray('  maria agent execute "Build a React component library"'));
      console.log(chalk.gray('  maria agent execute "Set up CI/CD pipeline with testing"\n'));

      console.log(chalk.green('⚙️  Configuration Options:'));
      console.log(
        chalk.white(
          '  --autonomy <level>     - assisted|collaborative|autonomous (default: autonomous)',
        ),
      );
      console.log(
        chalk.white('  --visual <level>       - minimal|standard|detailed (default: detailed)'),
      );
      console.log(
        chalk.white('  --reporting            - Enable active reporting (default: true)'),
      );
      console.log(
        chalk.white('  --evolution            - Enable self-evolution (default: true)\n'),
      );

      console.log(chalk.green('🚀 Key Features:'));
      console.log(chalk.white('  ✓ Complete Statement of Work (SOW) Generation'));
      console.log(chalk.white('  ✓ Visual Mode Display with Real-time Progress'));
      console.log(chalk.white('  ✓ Active Reporting and Progress Tracking'));
      console.log(chalk.white('  ✓ Self-Evolution Learning Engine'));
      console.log(chalk.white('  ✓ 120+ Professional Engineering Modes'));
      console.log(chalk.white('  ✓ Autonomous Error Recovery'));
      console.log(chalk.white('  ✓ File System Operations (Create, Read, Write, Delete)'));
      console.log(chalk.white('  ✓ Code Generation and Testing'));
      console.log(chalk.white('  ✓ Version Control Integration'));
      console.log(chalk.white('  ✓ Build and Deployment Automation\n'));
    });
}
