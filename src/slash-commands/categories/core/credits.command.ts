/**
 * Credits Command
 * Display credits and acknowledgments for MARIA
 */

import { BaseCommand } from "../../base-command";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
} from "../../../types/command.types";
import chalk from "chalk";

export class CreditsCommand extends BaseCommand {
  name = "credits";
  description = "Display credits and acknowledgments for MARIA";
  category = "core";
  aliases = ["thanks", "acknowledgments"];

  async execute(
    args: CommandArgs,
    context: CommandContext
  ): Promise<CommandResult> {
    const output: string[] = [];
    
    output.push('');
    output.push(chalk.cyan.bold('🏆 MARIA Credits & Acknowledgments'));
    output.push(chalk.gray('═'.repeat(45)));
    output.push('');
    
    output.push(chalk.white.bold('👨‍💻 Core Development Team'));
    output.push('  • Bonginkan Team - Architecture & Implementation');
    output.push('  • Enterprise AI Solutions Division');
    output.push('  • Open Source Contributors');
    output.push('');
    
    output.push(chalk.white.bold('🤖 AI Partners & Providers'));
    output.push('  • Anthropic - Claude AI Integration');
    output.push('  • OpenAI - GPT Models & API');
    output.push('  • Google - Gemini & Vertex AI');
    output.push('  • Groq - High-Performance Inference');
    output.push('  • xAI - Grok Integration');
    output.push('  • Ollama - Local Model Support');
    output.push('  • LM Studio & vLLM - Community Models');
    output.push('');
    
    output.push(chalk.white.bold('🛠️ Technology Stack'));
    output.push('  • Node.js & TypeScript - Runtime & Language');
    output.push('  • React & Next.js - Frontend Framework');
    output.push('  • Firebase - Authentication & Database');
    output.push('  • Google Cloud - Infrastructure & Deployment');
    output.push('  • Stripe - Payment Processing');
    output.push('  • GitHub - Version Control & CI/CD');
    output.push('');
    
    output.push(chalk.white.bold('📚 Open Source Libraries'));
    output.push('  • chalk - Terminal colors and styling');
    output.push('  • commander - CLI argument parsing');
    output.push('  • inquirer - Interactive prompts');
    output.push('  • typescript-eslint - Code quality tools');
    output.push('  • vitest - Testing framework');
    output.push('  • And 100+ other amazing OSS projects');
    output.push('');
    
    output.push(chalk.white.bold('🌟 Special Thanks'));
    output.push('  • Claude Code team for development platform');
    output.push('  • Discord community for feedback and testing');
    output.push('  • Beta users for early adoption and reports');
    output.push('  • Stack Overflow community for solutions');
    output.push('  • TypeScript team for amazing tooling');
    output.push('');
    
    output.push(chalk.green('❤️ Thank you for using MARIA!'));
    output.push(chalk.blue('🔗 Join our community: https://discord.gg/SMSmSGcEQy'));
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }
}

export const meta = {
  name: 'credits',
  category: 'core',
  description: 'Display credits and acknowledgments for MARIA',
  aliases: ['thanks', 'acknowledgments'],
  usage: '/credits',
  examples: [
    '/credits'
  ],
  deps: []
};