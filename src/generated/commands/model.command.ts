import { BaseCommand } from '../base-command';
import { Command, RequireAuth, RateLimit, Validate } from '../decorators';
import { CommandContext, CommandOptions, CommandResult } from '../types';
import { z } from 'zod';
import chalk from 'chalk';
import { logger } from '../../utils/logger';
import { ConfigManagerService } from '../../services/config-manager';
import { ModelRegistryService } from '../../services/model-registry';
import { ProviderManagerService } from '../../services/provider-manager';

const modelSchema = z.object({
  set: z.string().optional(),
  list: z.boolean().optional().default(false),
  info: z.string().optional(),
  test: z.string().optional(),
  benchmark: z.boolean().optional().default(false),
  provider: z
    .enum(['openai', 'anthropic', 'google', 'groq', 'xai', 'lmstudio', 'ollama'])
    .optional(),
  category: z.enum(['chat', 'code', 'vision', 'reasoning', 'creative']).optional(),
  cost: z.boolean().optional().default(false),
  local: z.boolean().optional().default(false),
  cloud: z.boolean().optional().default(true),
});

export type ModelOptions = z.infer<typeof modelSchema>;

/**
 * AI Model Management Command
 *
 * Features:
 * - List available models from all providers
 * - Set default model for commands
 * - Display model information and capabilities
 * - Test model connectivity
 * - Benchmark model performance
 * - Cost analysis
 * - Local vs Cloud model selection
 */
@Command({
  name: 'model',
  aliases: ['m', 'models', 'llm'],
  description: 'Manage and select AI models',
  category: 'configuration',
  priority: 90,
  version: '2.0.0',
})
@RequireAuth({ level: 'basic' })
@RateLimit(30, '1m')
@Validate(modelSchema)
export class ModelCommand extends BaseCommand<ModelOptions> {
  private configManager: ConfigManagerService;
  private modelRegistry: ModelRegistryService;
  private providerManager: ProviderManagerService;

  constructor() {
    super();
    this.configManager = ConfigManagerService.getInstance();
    this.modelRegistry = new ModelRegistryService();
    this.providerManager = new ProviderManagerService();
  }

  async execute(
    args: string[],
    options: ModelOptions,
    context: CommandContext,
  ): Promise<CommandResult> {
    try {
      this.emit('start', { command: 'model', options });

      // Handle different operations
      if (options.list) {
        return await this.listModels(options);
      }

      if (options.set) {
        return await this.setModel(options.set, context);
      }

      if (options.info) {
        return await this.showModelInfo(options.info);
      }

      if (options.test) {
        return await this.testModel(options.test);
      }

      if (options.benchmark) {
        return await this.benchmarkModels(options);
      }

      if (options.cost) {
        return await this.analyzeCosts(options);
      }

      // Default: show current model
      return await this.showCurrentModel(context);
    } catch (error) {
      this.emit('error', { error });
      logger.error(chalk.red(`Model command failed: ${error.message}`));
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async listModels(options: ModelOptions): Promise<CommandResult> {
    const models = await this.modelRegistry.getAllModels();

    // Filter by options
    let filteredModels = models;

    if (options.provider) {
      filteredModels = filteredModels.filter((m) => m.provider === options.provider);
    }

    if (options.category) {
      filteredModels = filteredModels.filter((m) => m.categories.includes(options.category));
    }

    if (options.local && !options.cloud) {
      filteredModels = filteredModels.filter((m) => m.isLocal);
    } else if (options.cloud && !options.local) {
      filteredModels = filteredModels.filter((m) => !m.isLocal);
    }

    // Group by provider
    const grouped = this.groupModelsByProvider(filteredModels);

    // Display models
    console.log(chalk.bold.blue('\n📊 Available AI Models\n'));

    for (const [provider, providerModels] of Object.entries(grouped)) {
      console.log(chalk.bold.cyan(`${this.getProviderEmoji(provider)} ${provider.toUpperCase()}`));

      for (const model of providerModels) {
        const status = await this.checkModelStatus(model);
        const statusIcon = status.available ? '✅' : '❌';
        const costInfo = model.costPerToken ? ` ($${model.costPerToken}/1K)` : '';
        const contextInfo = model.contextWindow
          ? ` [${this.formatContext(model.contextWindow)}]`
          : '';

        console.log(
          `  ${statusIcon} ${chalk.white(model.id)}${chalk.gray(contextInfo)}${chalk.yellow(costInfo)}`,
        );

        if (model.description) {
          console.log(chalk.gray(`     ${model.description}`));
        }

        if (model.bestFor && model.bestFor.length > 0) {
          console.log(chalk.gray(`     Best for: ${model.bestFor.join(', ')}`));
        }
      }

      console.log();
    }

    return {
      success: true,
      data: {
        total: filteredModels.length,
        models: filteredModels,
      },
    };
  }

  private groupModelsByProvider(models: unknown[]): Record<string, any[]> {
    return models.reduce(
      (acc, model) => {
        if (!acc[model.provider]) {
          acc[model.provider] = [];
        }
        acc[model.provider].push(model);
        return acc;
      },
      {} as Record<string, any[]>,
    );
  }

  private getProviderEmoji(provider: string): string {
    const emojis: Record<string, string> = {
      openai: '🤖',
      anthropic: '🎭',
      google: '🌈',
      groq: '⚡',
      xai: '🚀',
      lmstudio: '💻',
      ollama: '🦙',
    };
    return emojis[provider.toLowerCase()] || '🔮';
  }

  private formatContext(tokens: number): string {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(0)}K`;
    }
    return tokens.toString();
  }

  private async checkModelStatus(model: unknown): Promise<{ available: boolean; latency?: number }> {
    try {
      const provider = await this.providerManager.getProvider(model.provider);
      const startTime = Date.now();
      const available = await provider.testConnection(model.id);
      const latency = Date.now() - startTime;

      return { available, latency };
    } catch {
      return { available: false };
    }
  }

  private async setModel(modelId: string, context: CommandContext): Promise<CommandResult> {
    // Validate model exists
    const model = await this.modelRegistry.getModel(modelId);

    if (!model) {
      // Try to find by partial match
      const models = await this.modelRegistry.getAllModels();
      const matches = models.filter((m) => m.id.toLowerCase().includes(modelId.toLowerCase()));

      if (matches.length === 0) {
        throw new Error(`Model not found: ${modelId}`);
      }

      if (matches.length > 1) {
        console.log(chalk.yellow('Multiple models found:'));
        matches.forEach((m) => console.log(`  - ${m.id}`));
        throw new Error('Please specify a more specific model ID');
      }

      modelId = matches[0].id;
    }

    // Test connectivity
    const status = await this.checkModelStatus(model || matches[0]);

    if (!status.available) {
      logger.warn(chalk.yellow(`⚠️  Model ${modelId} is not currently available`));

      const proceed = await this.prompt('Do you want to set it as default anyway? (y/n): ');

      if (proceed.toLowerCase() !== 'y') {
        return {
          success: false,
          data: { message: 'Model change cancelled' },
        };
      }
    }

    // Save to config
    await this.configManager.set('defaultModel', modelId);

    logger.info(chalk.green(`✅ Default model set to: ${modelId}`));

    if (status.latency) {
      logger.info(chalk.gray(`   Latency: ${status.latency}ms`));
    }

    return {
      success: true,
      data: {
        model: modelId,
        status: status.available ? 'available' : 'unavailable',
        latency: status.latency,
      },
    };
  }

  private async showModelInfo(modelId: string): Promise<CommandResult> {
    const model = await this.modelRegistry.getModel(modelId);

    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    console.log(chalk.bold.blue(`\n📊 Model Information: ${model.id}\n`));

    const info = [
      ['Provider', model.provider],
      ['Version', model.version || 'Latest'],
      ['Context Window', this.formatContext(model.contextWindow)],
      ['Max Output', model.maxOutput ? this.formatContext(model.maxOutput) : 'N/A'],
      ['Cost', model.costPerToken ? `$${model.costPerToken}/1K tokens` : 'Free'],
      ['Type', model.isLocal ? 'Local' : 'Cloud'],
      ['Categories', model.categories.join(', ')],
      ['Languages', model.languages?.join(', ') || 'All'],
    ];

    const maxLabelLength = Math.max(...info.map(([label]) => label.length));

    info.forEach(([label, value]) => {
      console.log(chalk.cyan(label.padEnd(maxLabelLength + 2)) + chalk.white(value));
    });

    if (model.description) {
      console.log(chalk.cyan('\nDescription:'));
      console.log(chalk.white(model.description));
    }

    if (model.bestFor && model.bestFor.length > 0) {
      console.log(chalk.cyan('\nBest For:'));
      model.bestFor.forEach((use) => {
        console.log(chalk.white(`  • ${use}`));
      });
    }

    if (model.limitations && model.limitations.length > 0) {
      console.log(chalk.cyan('\nLimitations:'));
      model.limitations.forEach((limit) => {
        console.log(chalk.yellow(`  • ${limit}`));
      });
    }

    // Check availability
    const status = await this.checkModelStatus(model);
    console.log(
      chalk.cyan('\nStatus:'),
      status.available ? chalk.green('Available') : chalk.red('Unavailable'),
    );

    if (status.latency) {
      console.log(chalk.cyan('Latency:'), chalk.white(`${status.latency}ms`));
    }

    return {
      success: true,
      data: model,
    };
  }

  private async testModel(modelId: string): Promise<CommandResult> {
    const model = await this.modelRegistry.getModel(modelId);

    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    console.log(chalk.blue(`\n🧪 Testing model: ${modelId}\n`));

    const tests = [
      {
        name: 'Connectivity',
        test: async () => await this.checkModelStatus(model),
      },
      {
        name: 'Simple Generation',
        test: async () => await this.testGeneration(model, 'Hello, respond with "OK"'),
      },
      {
        name: 'Code Generation',
        test: async () => await this.testGeneration(model, 'Write a hello world in Python'),
      },
      {
        name: 'Reasoning',
        test: async () => await this.testGeneration(model, 'What is 25 * 4?'),
      },
    ];

    const results = [];

    for (const { name, test } of tests) {
      process.stdout.write(chalk.cyan(`Testing ${name}... `));

      try {
        const startTime = Date.now();
        const result = await test();
        const duration = Date.now() - startTime;

        console.log(chalk.green(`✓ (${duration}ms)`));
        results.push({ name, success: true, duration });
      } catch (error) {
        console.log(chalk.red(`✗ ${error.message}`));
        results.push({ name, success: false, error: error.message });
      }
    }

    // Summary
    const successCount = results.filter((r) => r.success).length;
    const avgDuration =
      results.filter((r) => r.success && r.duration).reduce((sum, r) => sum + r.duration, 0) /
        successCount || 0;

    console.log(chalk.bold(`\nResults: ${successCount}/${results.length} tests passed`));

    if (avgDuration > 0) {
      console.log(chalk.gray(`Average response time: ${avgDuration.toFixed(0)}ms`));
    }

    return {
      success: successCount === results.length,
      data: {
        model: modelId,
        results,
        summary: {
          passed: successCount,
          failed: results.length - successCount,
          avgResponseTime: avgDuration,
        },
      },
    };
  }

  private async testGeneration(model: unknown, prompt: string): Promise<unknown> {
    const provider = await this.providerManager.getProvider(model.provider);
    const response = await provider.generate({
      model: model.id,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 100,
      temperature: 0.3,
    });

    if (!response || response.length === 0) {
      throw new Error('Empty response');
    }

    return response;
  }

  private async benchmarkModels(options: ModelOptions): Promise<CommandResult> {
    const models = await this.modelRegistry.getAllModels();

    // Filter to available models
    const availableModels = [];
    for (const model of models) {
      const status = await this.checkModelStatus(model);
      if (status.available) {
        availableModels.push(model);
      }
    }

    if (availableModels.length === 0) {
      throw new Error('No available models to benchmark');
    }

    console.log(chalk.bold.blue(`\n⚡ Benchmarking ${availableModels.length} models\n`));

    const prompts = [
      { type: 'simple', text: 'What is 2+2?' },
      { type: 'code', text: 'Write a fibonacci function in Python' },
      { type: 'reasoning', text: 'Explain why the sky is blue in one sentence' },
      { type: 'creative', text: 'Write a haiku about programming' },
    ];

    const results = [];

    for (const model of availableModels) {
      console.log(chalk.cyan(`Testing ${model.id}...`));

      const modelResults = {
        model: model.id,
        provider: model.provider,
        scores: {} as Record<string, number>,
        avgLatency: 0,
        totalCost: 0,
      };

      let totalLatency = 0;
      let successCount = 0;

      for (const prompt of prompts) {
        try {
          const startTime = Date.now();
          await this.testGeneration(model, prompt.text);
          const latency = Date.now() - startTime;

          modelResults.scores[prompt.type] = latency;
          totalLatency += latency;
          successCount++;
        } catch (error) {
          modelResults.scores[prompt.type] = -1; // Failed
        }
      }

      if (successCount > 0) {
        modelResults.avgLatency = totalLatency / successCount;

        if (model.costPerToken) {
          // Estimate cost (assuming ~50 tokens per test)
          modelResults.totalCost = (50 * prompts.length * model.costPerToken) / 1000;
        }
      }

      results.push(modelResults);
    }

    // Sort by average latency
    results.sort((a, b) => a.avgLatency - b.avgLatency);

    // Display results
    console.log(chalk.bold('\n📊 Benchmark Results:\n'));

    results.forEach((result, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';

      console.log(`${medal} ${chalk.bold(result.model)}`);
      console.log(chalk.gray(`   Provider: ${result.provider}`));
      console.log(chalk.gray(`   Avg Latency: ${result.avgLatency.toFixed(0)}ms`));

      if (result.totalCost > 0) {
        console.log(chalk.gray(`   Est. Cost: $${result.totalCost.toFixed(4)}`));
      }

      // Show individual scores
      Object.entries(result.scores).forEach(([type, latency]) => {
        const status = latency === -1 ? chalk.red('Failed') : chalk.green(`${latency}ms`);
        console.log(chalk.gray(`   ${type}: ${status}`));
      });

      console.log();
    });

    return {
      success: true,
      data: {
        results,
        winner: results[0]?.model,
      },
    };
  }

  private async analyzeCosts(options: ModelOptions): Promise<CommandResult> {
    const models = await this.modelRegistry.getAllModels();

    // Filter to models with cost info
    const pricedModels = models.filter((m) => m.costPerToken);

    if (pricedModels.length === 0) {
      return {
        success: false,
        data: { message: 'No pricing information available' },
      };
    }

    // Sort by cost
    pricedModels.sort((a, b) => a.costPerToken - b.costPerToken);

    console.log(chalk.bold.blue('\n💰 Model Cost Analysis\n'));
    console.log(chalk.gray('Based on 1 million tokens:\n'));

    const costTable = pricedModels.map((model) => ({
      model: model.id,
      provider: model.provider,
      costPer1K: `$${model.costPerToken.toFixed(3)}`,
      costPer1M: `$${(model.costPerToken * 1000).toFixed(2)}`,
      context: this.formatContext(model.contextWindow),
    }));

    // Display as table
    console.log(
      chalk.bold(
        'Model'.padEnd(25) +
          'Provider'.padEnd(12) +
          '$/1K'.padEnd(10) +
          '$/1M'.padEnd(10) +
          'Context',
      ),
    );
    console.log(chalk.gray('-'.repeat(70)));

    costTable.forEach((row) => {
      const costColor = row.costPer1M.includes('0.')
        ? chalk.green
        : parseFloat(row.costPer1M.replace('$', '')) < 10
          ? chalk.yellow
          : chalk.red;

      console.log(
        chalk.white(row.model.padEnd(25)) +
          chalk.gray(row.provider.padEnd(12)) +
          costColor(row.costPer1K.padEnd(10)) +
          costColor(row.costPer1M.padEnd(10)) +
          chalk.cyan(row.context),
      );
    });

    // Calculate usage estimates
    console.log(chalk.bold('\n📈 Usage Estimates:\n'));

    const usageScenarios = [
      { name: 'Light (10K tokens/day)', tokensPerMonth: 300000 },
      { name: 'Medium (100K tokens/day)', tokensPerMonth: 3000000 },
      { name: 'Heavy (1M tokens/day)', tokensPerMonth: 30000000 },
    ];

    usageScenarios.forEach((scenario) => {
      console.log(chalk.cyan(`${scenario.name}:`));

      // Show top 3 cheapest options
      pricedModels.slice(0, 3).forEach((model) => {
        const monthlyCost = (model.costPerToken * scenario.tokensPerMonth) / 1000;
        console.log(
          chalk.gray(`  ${model.id}: `) + chalk.green(`$${monthlyCost.toFixed(2)}/month`),
        );
      });

      console.log();
    });

    return {
      success: true,
      data: {
        models: costTable,
        cheapest: pricedModels[0].id,
        mostExpensive: pricedModels[pricedModels.length - 1].id,
      },
    };
  }

  private async showCurrentModel(context: CommandContext): Promise<CommandResult> {
    const currentModel = (await this.configManager.get('defaultModel')) || 'gpt-4';
    const model = await this.modelRegistry.getModel(currentModel);

    console.log(chalk.bold.blue('\n🤖 Current Model Configuration\n'));
    console.log(chalk.cyan('Default Model:'), chalk.white(currentModel));

    if (model) {
      console.log(chalk.cyan('Provider:'), chalk.white(model.provider));
      console.log(chalk.cyan('Context:'), chalk.white(this.formatContext(model.contextWindow)));

      if (model.costPerToken) {
        console.log(chalk.cyan('Cost:'), chalk.white(`$${model.costPerToken}/1K tokens`));
      }

      // Check status
      const status = await this.checkModelStatus(model);
      console.log(
        chalk.cyan('Status:'),
        status.available ? chalk.green('Available') : chalk.red('Unavailable'),
      );

      if (status.latency) {
        console.log(chalk.cyan('Latency:'), chalk.white(`${status.latency}ms`));
      }
    }

    // Show recent usage
    const usage = (await this.configManager.get('modelUsage')) || {};
    if (Object.keys(usage).length > 0) {
      console.log(chalk.bold('\n📊 Recent Usage:'));

      Object.entries(usage)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .forEach(([modelId, stats]: [string, any]) => {
          console.log(chalk.gray(`  ${modelId}: ${stats.count} requests, ${stats.tokens} tokens`));
        });
    }

    console.log(chalk.gray('\nUse /model list to see all available models'));
    console.log(chalk.gray('Use /model set <model-id> to change the default model'));

    return {
      success: true,
      data: {
        current: currentModel,
        model,
        usage,
      },
    };
  }

  private async prompt(message: string): Promise<string> {
    // This would be replaced with actual prompt implementation
    return 'n';
  }

  async help(): Promise<string> {
    return `
${chalk.bold.blue('Model Management Command')}

${chalk.yellow('Usage:')}
  /model                        # Show current model
  /model list [options]         # List available models
  /model set <model-id>         # Set default model
  /model info <model-id>        # Show model details
  /model test <model-id>        # Test model connectivity
  /model benchmark              # Compare model performance
  /model cost                   # Analyze model costs

${chalk.yellow('Options:')}
  --provider <name>     Filter by provider
  --category <type>     Filter by category
  --local               Show only local models
  --cloud               Show only cloud models
  --cost                Show cost analysis

${chalk.yellow('Examples:')}
  /model list --provider openai
  /model set gpt-5
  /model info claude-opus-4.1
  /model test gemini-2.5-pro
  /model benchmark
  /model cost

${chalk.yellow('Providers:')}
  • OpenAI (GPT-5, GPT-4, etc.)
  • Anthropic (Claude 4.1, Sonnet)
  • Google (Gemini 2.5)
  • Groq (Llama, Mixtral)
  • xAI (Grok)
  • LM Studio (Local models)
  • Ollama (Local models)

${chalk.yellow('Categories:')}
  • chat - General conversation
  • code - Programming tasks
  • vision - Image analysis
  • reasoning - Logic and math
  • creative - Writing and art
    `;
  }
}
