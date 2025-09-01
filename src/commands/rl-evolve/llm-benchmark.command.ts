/**
 * LLM Benchmark Command - Test Local LLM Studio integration
 * Commands: maria llm-benchmark, maria llm-studio
 */

import { Command } from "commander";
import {
  LocalLLMBenchmark,
  LLMStudioConfig,
} from "../../services/rl-evolution/LocalLLMBenchmark";
import { MacProM3Optimizer } from "../../services/rl-evolution/MacProM3Optimizer";
import * as chalk from "chalk";

export function createLLMBenchmarkCommand(): Command {
  const command = new Command("llm-benchmark");

  command
    .description("🤖 Benchmark Local LLM Studio models for RL evolution")
    .option("--server <url>", "LLM Studio server URL", "http://localhost:1234")
    .option(
      "--models <models>",
      "Models to benchmark (comma-separated)",
      "gpt-oss-128b,gpt-oss-20b",
    )
    .option("--save-report", "Save benchmark report to file")
    .option("--compare", "Run comparative analysis between models")
    .option("--rl-integration", "Test RL evolution integration")
    .option("--mac-optimize", "Run Mac Pro M3 optimization tests")
    .action(async (options) => {
      try {
        await runLLMBenchmark(options);
      } catch (error: any) {
        console.error(chalk.red("❌ LLM Benchmark failed:"), error.message);
        process.exit(1);
      }
    });

  return command;
}

export function createLLMStudioCommand(): Command {
  const command = new Command("llm-studio");

  command
    .description("🎛️ Manage LLM Studio integration")
    .addCommand(createLLMStudioStatusCommand())
    .addCommand(createLLMStudioTestCommand())
    .addCommand(createLLMStudioBenchmarkCommand());

  return command;
}

function createLLMStudioStatusCommand(): Command {
  return new Command("status")
    .description("Check LLM Studio server status")
    .option("--server <url>", "LLM Studio server URL", "http://localhost:1234")
    .action(async (options) => {
      await checkLLMStudioStatus(options.server);
    });
}

function createLLMStudioTestCommand(): Command {
  return new Command("test")
    .description("Test LLM Studio connection and models")
    .option("--server <url>", "LLM Studio server URL", "http://localhost:1234")
    .option("--model <model>", "Model to test", "gpt-oss-20b")
    .action(async (options) => {
      await testLLMStudioConnection(options);
    });
}

function createLLMStudioBenchmarkCommand(): Command {
  return new Command("benchmark")
    .description("Run comprehensive LLM Studio benchmark")
    .option("--server <url>", "LLM Studio server URL", "http://localhost:1234")
    .option("--detailed", "Show detailed benchmark _results")
    .option("--export", "Export _results to file")
    .action(async (options) => {
      await runComprehensiveBenchmark(options);
    });
}

async function runLLMBenchmark(options: any): Promise<void> {
  console.log(chalk.blue("🚀 Starting LLM Benchmark Suite"));
  console.log(chalk.gray(`Server: ${options.server}`));
  console.log(chalk.gray(`Models: ${options.models}`));
  console.log();

  const config: LLMStudioConfig = {
    baseUrl: options.server,
    timeout: 30000,
  };

  const benchmark = new LocalLLMBenchmark(config);
  let macOptimizer: MacProM3Optimizer | undefined;

  // Initialize Mac Pro M3 optimizer if requested
  if (options.macOptimize) {
    console.log(chalk.blue("🖥️ Initializing Mac Pro M3 Optimizer..."));
    macOptimizer = new MacProM3Optimizer();

    try {
      await macOptimizer.validateAndOptimize();
      console.log(chalk.green("✅ Mac Pro M3 Max validated and optimized"));
    } catch (error: any) {
      console.log(
        chalk.yellow("⚠️ Mac Pro M3 optimization failed:"),
        error.message,
      );
    }
    console.log();
  }

  // Set up event listeners for progress tracking
  benchmark.on("benchmark:start", (message) => {
    console.log(chalk.blue("🔄"), message);
  });

  benchmark.on("benchmark:model:start", (modelName) => {
    console.log(chalk.cyan("   📊 Benchmarking"), chalk.bold(modelName));
  });

  benchmark.on("benchmark:model:complete", (modelName, _results) => {
    console.log(chalk.green("   ✅"), chalk.bold(modelName), "completed");
    displayModelSummary(modelName, _results);
    console.log();
  });

  benchmark.on("benchmark:complete", (_results) => {
    console.log(chalk.green("🎉 Benchmark completed successfully!"));
    displayComparisonResults(_results);
  });

  benchmark.on("benchmark:error", (error) => {
    console.error(chalk.red("❌ Benchmark error:"), error.message);
  });

  // Run the benchmark
  try {
    const _results = await benchmark.runComprehensiveBenchmark();

    if (options.saveReport) {
      const report = await benchmark.exportBenchmarkReport();
      const filename = `llm-benchmark-${Date.now()}.md`;
      const fs = require("fs");
      fs.writeFileSync(filename, report);
      console.log(chalk.green("📄 Report saved to:"), filename);
    }
  } catch (error: any) {
    console.error(chalk.red("❌ Benchmark failed:"), error.message);
    throw error;
  }
}

async function checkLLMStudioStatus(serverUrl: string): Promise<void> {
  console.log(chalk.blue("🔍 Checking LLM Studio status..."));
  console.log(chalk.gray(`Server: ${serverUrl}`));

  try {
    const axios = require("axios");
    const response = await axios.get(`${serverUrl}/v1/models`, {
      timeout: 5000,
    });

    console.log(chalk.green("✅ LLM Studio is running"));
    console.log(chalk.cyan("Available models:"));

    if (response.data && response.data.data) {
      response.data.data.forEach((model: any) => {
        console.log(
          chalk.gray("  -"),
          model.id || model.name || "Unknown model",
        );
      });
    } else {
      console.log(
        chalk.yellow("  No models found or unexpected response format"),
      );
    }
  } catch (error: any) {
    console.error(chalk.red("❌ LLM Studio not accessible:"), error.message);
    console.log(
      chalk.yellow("💡 Make sure LLM Studio is running on"),
      serverUrl,
    );
  }
}

async function testLLMStudioConnection(options: any): Promise<void> {
  console.log(chalk.blue("🧪 Testing LLM Studio connection..."));
  console.log(chalk.gray(`Server: ${options.server}`));
  console.log(chalk.gray(`Model: ${options.model}`));

  try {
    const axios = require("axios");
    const testPrompt =
      "Hello! Please respond with 'Connection test successful' if you can understand this message.";

    const startTime = Date.now();
    const response = await axios.post(
      `${options.server}/v1/chat/completions`,
      {
        model: options.model,
        messages: [{ role: "user", content: testPrompt }],
        max_tokens: 50,
        temperature: 0.1,
      },
      {
        timeout: 10000,
      },
    );

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    if (response.data && response.data.choices && response.data.choices[0]) {
      const message = response.data.choices[0].message.content;
      console.log(chalk.green("✅ Connection test successful!"));
      console.log(chalk.cyan("Response time:"), `${responseTime}ms`);
      console.log(chalk.cyan("Model response:"), message.trim());

      if (message.toLowerCase().includes("connection test successful")) {
        console.log(chalk.green("🎯 Model understood the test correctly"));
      } else {
        console.log(
          chalk.yellow("⚠️ Unexpected response, but connection works"),
        );
      }
    } else {
      console.log(
        chalk.yellow("⚠️ Connection works but unexpected response format"),
      );
    }
  } catch (error: any) {
    console.error(chalk.red("❌ Connection test failed:"), error.message);
    console.log(
      chalk.yellow(
        "💡 Check if the model name is correct and LLM Studio is running",
      ),
    );
  }
}

async function runComprehensiveBenchmark(options: any): Promise<void> {
  console.log(chalk.blue("📊 Running comprehensive LLM Studio benchmark..."));
  console.log();

  const config: LLMStudioConfig = {
    baseUrl: options.server,
    timeout: 30000,
  };

  const benchmark = new LocalLLMBenchmark(config);

  // Progress tracking
  benchmark.on("benchmark:start", (message) => {
    console.log(chalk.blue("🚀"), message);
  });

  benchmark.on("benchmark:model:start", (modelName) => {
    process.stdout.write(chalk.cyan(`   Testing ${modelName}... `));
  });

  benchmark.on("benchmark:model:complete", (modelName, _results) => {
    console.log(chalk.green("✅"));
    if (options.detailed) {
      displayDetailedResults(modelName, _results);
    }
  });

  try {
    const _results = await benchmark.runComprehensiveBenchmark();
    console.log();
    console.log(chalk.green("🎉 Comprehensive benchmark completed!"));

    displayComparisonResults(_results);

    if (options.export) {
      const report = await benchmark.exportBenchmarkReport();
      const filename = `comprehensive-benchmark-${Date.now()}.md`;
      const fs = require("fs");
      fs.writeFileSync(filename, report);
      console.log(chalk.green("📄 Detailed report exported to:"), filename);
    }
  } catch (error: any) {
    console.error(
      chalk.red("❌ Comprehensive benchmark failed:"),
      error.message,
    );
  }
}

function displayModelSummary(modelName: string, _results: any): void {
  console.log(
    chalk.gray("     Speed:"),
    `${results.performance.tokensPerSecond.toFixed(1)} tok/sec`,
  );
  console.log(
    chalk.gray("     Memory:"),
    `${results.performance.memoryUsage.toFixed(1)}GB`,
  );
  console.log(
    chalk.gray("     Quality:"),
    `${(((results.quality.coherenceScore + results.quality.factualAccuracy + results.quality.relevanceScore + results.quality.codeGenerationScore) / 4) * 100).toFixed(1)}%`,
  );
}

function displayComparisonResults(_results: any): void {
  console.log();
  console.log(chalk.bold("📊 Comparison Results"));
  console.log(chalk.gray("═".repeat(50)));

  const gpt128b = results.gpt_oss_128b;
  const gpt20b = results.gpt_oss_20b;
  const comparison = results.comparison;

  console.log();
  console.log(chalk.bold("🚀 Performance Comparison:"));
  console.table({
    "GPT-OSS 128B": {
      Speed: `${gpt128b.performance.tokensPerSecond.toFixed(1)} tok/sec`,
      Latency: `${gpt128b.performance.firstTokenLatency.toFixed(0)}ms`,
      Memory: `${gpt128b.performance.memoryUsage.toFixed(1)}GB`,
      Power: `${gpt128b.performance.powerConsumption.toFixed(0)}W`,
    },
    "GPT-OSS 20B": {
      Speed: `${gpt20b.performance.tokensPerSecond.toFixed(1)} tok/sec`,
      Latency: `${gpt20b.performance.firstTokenLatency.toFixed(0)}ms`,
      Memory: `${gpt20b.performance.memoryUsage.toFixed(1)}GB`,
      Power: `${gpt20b.performance.powerConsumption.toFixed(0)}W`,
    },
  });

  console.log();
  console.log(chalk.bold("🏆 Winner Analysis:"));
  console.log(
    chalk.green("Speed Winner:"),
    "GPT-OSS 20B",
    chalk.gray(`(${comparison.speedRatio.toFixed(2)}x faster)`),
  );
  console.log(
    chalk.blue("Quality Winner:"),
    "GPT-OSS 128B",
    chalk.gray(
      `(+${(comparison.qualityImprovement * 100).toFixed(1)}% better)`,
    ),
  );
  console.log(
    chalk.yellow("Efficiency Winner:"),
    "GPT-OSS 20B",
    chalk.gray(`(${comparison.costEfficiency.toFixed(2)}x more efficient)`),
  );

  console.log();
  console.log(chalk.bold("💡 Recommendations:"));
  console.log(
    chalk.cyan("Development:"),
    comparison.recommendedUseCase.development,
  );
  console.log(
    chalk.cyan("Production:"),
    comparison.recommendedUseCase.production,
  );
  console.log(chalk.cyan("Research:"), comparison.recommendedUseCase.research);
}

function displayDetailedResults(modelName: string, _results: any): void {
  console.log();
  console.log(chalk.bold(`📋 Detailed Results - ${modelName}`));
  console.log(chalk.gray("─".repeat(40)));

  console.log(chalk.cyan("Performance:"));
  console.log(
    `  Speed: ${results.performance.tokensPerSecond.toFixed(1)} tokens/sec`,
  );
  console.log(
    `  First Token: ${results.performance.firstTokenLatency.toFixed(0)}ms`,
  );
  console.log(`  Memory: ${results.performance.memoryUsage.toFixed(1)}GB`);
  console.log(`  CPU Usage: ${results.performance.cpuUsage.toFixed(0)}%`);
  console.log(`  Power: ${results.performance.powerConsumption.toFixed(0)}W`);

  console.log(chalk.cyan("Quality Metrics:"));
  console.log(
    `  Coherence: ${(results.quality.coherenceScore * 100).toFixed(1)}%`,
  );
  console.log(
    `  Factual Accuracy: ${(results.quality.factualAccuracy * 100).toFixed(1)}%`,
  );
  console.log(
    `  Relevance: ${(results.quality.relevanceScore * 100).toFixed(1)}%`,
  );
  console.log(
    `  Code Generation: ${(results.quality.codeGenerationScore * 100).toFixed(1)}%`,
  );

  console.log(chalk.cyan("RL Integration:"));
  console.log(
    `  Reward Calculation: ${results.rlIntegration.rewardCalculationSpeed.toFixed(0)}ms`,
  );
  console.log(
    `  Policy Updates: ${results.rlIntegration.policyUpdateLatency.toFixed(0)}ms`,
  );
  console.log(
    `  Experience Processing: ${results.rlIntegration.experienceProcessing.toFixed(1)} exp/sec`,
  );
}
