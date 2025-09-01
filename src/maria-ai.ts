/**
 * MARIA CODE Main Entry Point
 * The primary CLI interface with the classic startup experience
 */

import chalk from "chalk";
import { Command } from "commander";
import { displayStartupLogo } from "./services/startup-display";
import { ProviderSelector } from "./services/provider-selector";
import { ConfigManager } from "./config/index";
import { IntelligentRouterService } from "./services/intelligent-router/app/IntelligentRouterService";
import {
  InteractiveSession,
  createInteractiveSession,
} from "./services/interactive-session/index";
import type { IMaria } from "./types/maria-interfaces";
import packageJson from "../package.json";

export class MariaAI implements IMaria {
  private config: ConfigManager;
  private providerSelector: ProviderSelector;
  private router?: IntelligentRouterService;
  private session?: InteractiveSession;

  constructor() {
    this.config = new ConfigManager();
    this.providerSelector = new ProviderSelector(this.config);
  }

  async initialize(): Promise<void> {
    try {
      // Display the classic MARIA CODE startup screen
      displayStartupLogo();

      // Initialize provider selector
      await this.providerSelector.initialize();

      // Select AI provider and model
      const { provider, model } = await this.providerSelector.selectProvider();

      console.log(
        chalk.green(`\n✅ Selected: ${provider} with model ${model}`),
      );

      // Store selection in config
      this.config.set("currentProvider", provider);
      this.config.set("currentModel", model);
      await this.config.save();

      // Initialize Intelligent Router
      console.log(chalk.cyan("\n🧠 Initializing Intelligent Router..."));
      this.router = new IntelligentRouterService({
        confidenceThreshold: 0.85,
        enableLearning: true,
        enableConfirmation: true,
      });
      await this.router.initialize();
      console.log(
        chalk.green("✅ Intelligent Router initialized successfully\n"),
      );

      // Start interactive session
      this.session = createInteractiveSession(this);
      await this.session.start();
    } catch (error) {
      console.error(chalk.red("\n❌ Initialization failed:"), error);
      process.exit(1);
    }
  }

  async shutdown(): Promise<void> {
    if (this.session) {
      await this.session.stop();
    }
    console.log(chalk.cyan("\n👋 Goodbye!"));
  }
}

// Export for use in CLI
export function createCLI(): Command {
  const program = new Command();

  program
    .name("maria")
    .description("MARIA CODE - AI-Powered Development Platform")
    .version(packageJson.version)
    .option("--provider <provider>", "Specify AI provider")
    .option("--model <model>", "Specify model")
    .option("--demo", "Run v3.0.0 API demonstration")
    .action(async (options) => {
      if (options.demo) {
        // Import and run the demo from cli.ts
        const { runApiDemo } = await import("./cli");
        await runApiDemo();
      } else {
        // Run the main MARIA experience
        const maria = new MariaAI();

        // Handle graceful shutdown
        process.on("SIGINT", async () => {
          await maria.shutdown();
          process.exit(0);
        });

        process.on("SIGTERM", async () => {
          await maria.shutdown();
          process.exit(0);
        });

        await maria.initialize();
      }
    });

  // Add sub-commands
  program
    .command("setup-ollama")
    .description("Setup Ollama for local AI")
    .action(async () => {
      console.log(chalk.cyan("Setting up Ollama..."));
      // Implementation for Ollama setup
      console.log(
        chalk.yellow("Please run: brew install ollama && ollama serve"),
      );
    });

  program
    .command("setup-vllm")
    .description("Setup vLLM for local AI")
    .action(async () => {
      console.log(chalk.cyan("Setting up vLLM..."));
      // Implementation for vLLM setup
      console.log(chalk.yellow("Please run: pip install vllm"));
    });

  return program;
}
