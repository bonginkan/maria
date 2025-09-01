import {
  SlashCommandContext,
  SlashCommand,
} from "../../../types/slash-command-context";
import { MultimodalService } from "../../../services/multimodal/MultimodalService";
import { guardMultimodalResult } from "../../../shared/handlers/integration/ContractGuard";

interface MultimodalCommandOptions {
  provider?: string;
  model?: string;
  priority?: number;
  timeout?: number;
  format?: "json" | "text" | "structured";
  confidence?: number;
  dashboard?: boolean;
  stats?: boolean;
  export?: "json" | "prometheus" | "opentelemetry";
}

export class MultimodalCommandHandler {
  private static _service: MultimodalService;

  static async getService(): Promise<MultimodalService> {
    if (!this._service) {
      this._service = new MultimodalService({
        queue: {
          maxConcurrent: 5,
          timeout: 30000,
          retryAttempts: 2,
          priorityLevels: 10,
        },
        engine: {
          defaultProvider: "openai",
          enableCaching: true,
          cacheTTL: 300000,
        },
        strategies: {
          confidence: {
            enabled: true,
            thresholds: { high: 0.8, medium: 0.6, low: 0.3, reject: 0.2 },
          },
          storage: {
            enabled: true,
            retentionDays: 7,
            backupEnabled: false,
          },
          monitoring: {
            enabled: true,
            checkInterval: 30000,
          },
        },
        telemetry: {
          enabled: true,
          sampling: { enabled: true, rate: 0.1 },
        },
        dashboard: {
          enabled: true,
          autoRefresh: true,
          refreshInterval: 15000,
        },
      });

      await this._service.initialize();
    }
    return this._service;
  }
}

export const multimodalCommand: SlashCommand = {
  name: "multimodal",
  description: "Execute multimodal AI operations with advanced orchestration",
  category: "AI",
  examples: [
    '/multimodal generate "Create a story about AI" --provider=openai',
    "/multimodal analyze image.png --model=gpt-4-vision",
    "/multimodal transcribe audio.mp3 --priority=8",
    "/multimodal --stats",
    "/multimodal --dashboard",
    "/multimodal --export=prometheus",
  ],

  async execute(context: SlashCommandContext): Promise<void> {
    try {
      const service = await MultimodalCommandHandler.getService();
      const options = context.options as MultimodalCommandOptions;
      const args = context.args;

      // Handle utility commands
      if (options.stats) {
        await this.handleStats(context, service);
        return;
      }

      if (options.dashboard) {
        await this.handleDashboard(context, service);
        return;
      }

      if (options.export) {
        await this.handleExport(context, service, options.export);
        return;
      }

      if (!args || args.length === 0) {
        context.logger.info(
          "🤖 **Multimodal AI Service**\\n\\nAvailable operations:\\n\\n" +
            "**Text Operations:**\\n" +
            "• `generate` - Generate text content\\n" +
            "• `summarize` - Summarize text\\n" +
            "• `translate` - Translate text\\n" +
            "• `analyze` - Analyze text content\\n\\n" +
            "**Multimodal Operations:**\\n" +
            "• `describe` - Describe images\\n" +
            "• `transcribe` - Convert audio to text\\n" +
            "• `compare` - Compare multiple inputs\\n\\n" +
            "**Usage:**\\n" +
            "```\\n" +
            "/multimodal <operation> <input> [options]\\n" +
            "/multimodal --stats      # View statistics\\n" +
            "/multimodal --dashboard  # Show dashboard\\n" +
            "```\\n\\n" +
            "**Options:**\\n" +
            "• `--provider` - AI provider (openai, anthropic, google)\\n" +
            "• `--model` - Specific model to use\\n" +
            "• `--priority` - Operation priority (1-10)\\n" +
            "• `--confidence` - Minimum confidence threshold\\n" +
            "• `--format` - Output format (json, text, structured)",
        );
        return;
      }

      const operation = args[0].toLowerCase();
      const input = args.slice(1).join(" ").trim();

      if (!input && !["stats", "dashboard", "health"].includes(operation)) {
        context.logger.error("❌ Input required for operation: " + operation);
        return;
      }

      // Detect operation type and content type
      const { operationType, contentType } = this.detectOperationTypes(
        operation,
        input,
      );

      // Create operation request
      const operationRequest = {
        id: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        type: contentType,
        operation: operationType,
        input: {
          content: this.prepareInput(input, operation),
          metadata: {
            source: "slash-command",
            originalInput: input,
            timestamp: new Date(),
          },
        },
        options: {
          provider: options.provider,
          model: options.model,
          priority: options.priority || 5,
          timeout: options.timeout || 30000,
        },
        context: {
          sessionId: context.sessionId,
          userId: context.userId || "anonymous",
          traceId: `trace-${Date.now()}`,
          tags: {
            command: "multimodal",
            operation,
            interface: "cli",
          },
        },
      };

      context.logger.info(
        `🚀 **Executing ${operation}**\\n\\n` +
          `📋 **Operation Details:**\\n` +
          `• ID: \`${operationRequest.id}\`\\n` +
          `• Type: ${contentType} → ${operationType}\\n` +
          `• Provider: ${operationRequest.options.provider || "default"}\\n` +
          `• Priority: ${operationRequest.options.priority}/10\\n\\n` +
          `⏳ Processing...`,
      );

      const startTime = Date.now();
      const result = await service.executeOperation(operationRequest);
      const duration = Date.now() - startTime;

      if (result.success) {
        await this.handleSuccessResult(context, result, options, duration);
      } else {
        await this.handleErrorResult(context, result);
      }
    } catch (error) {
      context.logger.error(
        `❌ **Multimodal Command Error**\\n\\n\`\`\`\\n${error}\\n\`\`\``,
      );
    }
  },

  async handleStats(
    context: SlashCommandContext,
    service: MultimodalService,
  ): Promise<void> {
    const stats = service.getStats();

    context.logger.info(
      "📊 **Multimodal Service Statistics**\\n\\n" +
        `**Operations:**\\n` +
        `• Total: ${stats.operations.total}\\n` +
        `• Successful: ${stats.operations.successful} (${((stats.operations.successful / Math.max(stats.operations.total, 1)) * 100).toFixed(1)}%)\\n` +
        `• Failed: ${stats.operations.failed}\\n` +
        `• Pending: ${stats.operations.pending}\\n\\n` +
        `**Performance:**\\n` +
        `• Avg Execution Time: ${stats.performance.avgExecutionTime.toFixed(0)}ms\\n` +
        `• Avg Queue Time: ${stats.performance.avgQueueTime.toFixed(0)}ms\\n` +
        `• Throughput: ${stats.performance.throughput.toFixed(2)} ops/sec\\n\\n` +
        `**Queue:**\\n` +
        `• Current Size: ${stats.queue.size}/${stats.queue.maxSize}\\n` +
        `• Utilization: ${(stats.queue.utilization * 100).toFixed(1)}%\\n\\n` +
        `**Confidence:**\\n` +
        `• Average Score: ${stats.confidence.avgScore.toFixed(3)}\\n` +
        `• Acceptance Rate: ${(stats.confidence.acceptanceRate * 100).toFixed(1)}%\\n` +
        `• Rejection Rate: ${(stats.confidence.rejectionRate * 100).toFixed(1)}%\\n\\n` +
        `**Health:**\\n` +
        `• Overall: ${this.formatHealthStatus(stats.health.overall)}\\n` +
        Object.entries(stats.health.components)
          .map(
            ([comp, status]) => `• ${comp}: ${this.formatHealthStatus(status)}`,
          )
          .join("\\n"),
    );
  },

  async handleDashboard(
    context: SlashCommandContext,
    service: MultimodalService,
  ): Promise<void> {
    try {
      const dashboard = await service.renderDashboard();
      context.logger.info(
        "🖥️ **Multimodal Dashboard**\\n\\n```\\n" + dashboard + "\\n```",
      );
    } catch (error) {
      context.logger.error("❌ Failed to render dashboard: " + error);
    }
  },

  async handleExport(
    context: SlashCommandContext,
    service: MultimodalService,
    format: string,
  ): Promise<void> {
    try {
      const data = await service.exportTelemetry(format as any);

      // For CLI, we'll show a summary instead of full export
      const lines = data.split("\\n").length;
      const size = new Blob([data]).size;

      context.logger.info(
        `📤 **Telemetry Export (${format.toUpperCase()})**\\n\\n` +
          `• Format: ${format}\\n` +
          `• Lines: ${lines}\\n` +
          `• Size: ${this.formatBytes(size)}\\n\\n` +
          `First 10 lines:\\n\`\`\`\\n${data.split("\\n").slice(0, 10).join("\\n")}\\n...\`\`\``,
      );
    } catch (error) {
      context.logger.error("❌ Failed to export telemetry: " + error);
    }
  },

  async handleSuccessResult(
    context: SlashCommandContext,
    result: any,
    options: MultimodalCommandOptions,
    duration: number,
  ): Promise<void> {
    // Guard result to ensure contract compliance
    const guardedResult = guardMultimodalResult(result);
    const format = options.format || "text";

    let output = "";

    if (format === "json") {
      output =
        "```json\\n" +
        JSON.stringify(guardedResult.output || result.output, null, 2) +
        "\\n```";
    } else if (format === "structured") {
      output = this.formatStructuredOutput(
        guardedResult.output || result.output,
      );
    } else {
      output = this.formatTextOutput(guardedResult.output || result.output);
    }

    const confidenceIndicator = result.metrics.confidence
      ? this.getConfidenceIndicator(result.metrics.confidence)
      : "";

    context.logger.info(
      `✅ **Operation Completed** ${confidenceIndicator}\\n\\n` +
        `${output}\\n\\n` +
        `**Metrics:**\\n` +
        `• Execution Time: ${result.metrics.executionTime}ms\\n` +
        `• Queue Time: ${result.metrics.queueTime}ms\\n` +
        `• Provider: ${result.metrics.provider}\\n` +
        (result.metrics.model ? `• Model: ${result.metrics.model}\\n` : "") +
        (result.metrics.confidence
          ? `• Confidence: ${result.metrics.confidence.toFixed(3)}\\n`
          : "") +
        `• Total Time: ${duration}ms`,
    );
  },

  async handleErrorResult(
    context: SlashCommandContext,
    result: any,
  ): Promise<void> {
    const errorCode = result.error?.code || "UNKNOWN_ERROR";
    const errorMessage = result.error?.message || "Unknown error occurred";

    let errorDisplay =
      `❌ **Operation Failed**\\n\\n` +
      `**Error:** \`${errorCode}\`\\n` +
      `**Message:** ${errorMessage}\\n\\n`;

    // Add specific guidance based on error type
    if (errorCode === "CONFIDENCE_TOO_LOW") {
      errorDisplay +=
        `💡 **Suggestion:** The AI system's confidence in this operation is too low. Try:\\n` +
        `• Simplifying your request\\n` +
        `• Being more specific\\n` +
        `• Using \`--confidence=0.3\` to lower the threshold\\n\\n`;
    } else if (errorCode === "TIMEOUT_ERROR") {
      errorDisplay +=
        `💡 **Suggestion:** The operation timed out. Try:\\n` +
        `• Using \`--timeout=60000\` for longer operations\\n` +
        `• Breaking complex requests into smaller parts\\n\\n`;
    } else if (errorCode === "PROVIDER_ERROR") {
      errorDisplay +=
        `💡 **Suggestion:** Provider issue detected. Try:\\n` +
        `• Using a different provider with \`--provider=anthropic\`\\n` +
        `• Checking your API keys\\n\\n`;
    }

    errorDisplay +=
      `**Metrics:**\\n` +
      `• Execution Time: ${result.metrics.executionTime}ms\\n` +
      `• Provider: ${result.metrics.provider}\\n` +
      (result.metrics.confidence
        ? `• Confidence: ${result.metrics.confidence.toFixed(3)}\\n`
        : "");

    context.logger.error(errorDisplay);
  },

  detectOperationTypes(
    operation: string,
    input: string,
  ): { operationType: string; contentType: string } {
    // Map user operations to internal types
    const operationMap: Record<string, string> = {
      generate: "text-generation",
      create: "text-generation",
      write: "text-generation",
      summarize: "text-summarization",
      summary: "text-summarization",
      translate: "text-translation",
      analyze: "text-analysis",
      describe: "image-description",
      caption: "image-description",
      transcribe: "audio-transcription",
      speech: "audio-transcription",
      compare: "multimodal-comparison",
    };

    const operationType = operationMap[operation] || operation;

    // Detect content type from input or operation
    let contentType = "text";

    if (
      operation.includes("image") ||
      operation === "describe" ||
      operation === "caption"
    ) {
      contentType = "image";
    } else if (
      operation.includes("audio") ||
      operation === "transcribe" ||
      operation === "speech"
    ) {
      contentType = "audio";
    } else if (
      operation === "compare" ||
      input.includes("image") ||
      input.includes("audio")
    ) {
      contentType = "multimodal";
    }

    return { operationType, contentType };
  },

  prepareInput(input: string, operation: string): any {
    // For now, return input as-is
    // In a full implementation, this would handle file paths, URLs, etc.
    if (
      operation === "describe" &&
      (input.endsWith(".png") ||
        input.endsWith(".jpg") ||
        input.endsWith(".jpeg"))
    ) {
      return {
        type: "image_url",
        image_url: { url: input },
      };
    }

    if (
      operation === "transcribe" &&
      (input.endsWith(".mp3") ||
        input.endsWith(".wav") ||
        input.endsWith(".m4a"))
    ) {
      return {
        type: "audio_file",
        audio_file: { path: input },
      };
    }

    return input;
  },

  formatTextOutput(output: any): string {
    if (typeof output.content === "string") {
      return output.content;
    }

    if (output.content?.text) {
      return output.content.text;
    }

    return JSON.stringify(output.content, null, 2);
  },

  formatStructuredOutput(output: any): string {
    const content = output.content;

    if (typeof content === "string") {
      return `**Result:**\\n${content}`;
    }

    let formatted = "**Result:**\\n";

    if (content.text) {
      formatted += content.text + "\\n\\n";
    }

    if (content.metadata || output.metadata) {
      formatted += "**Metadata:**\\n";
      const metadata = content.metadata || output.metadata;
      Object.entries(metadata).forEach(([key, value]) => {
        formatted += `• ${key}: ${value}\\n`;
      });
    }

    return formatted;
  },

  getConfidenceIndicator(confidence: number): string {
    if (confidence >= 0.9) return "🟢";
    if (confidence >= 0.7) return "🟡";
    if (confidence >= 0.5) return "🟠";
    return "🔴";
  },

  formatHealthStatus(status: string): string {
    const statusMap: Record<string, string> = {
      healthy: "🟢 Healthy",
      degraded: "🟡 Degraded",
      unhealthy: "🔴 Unhealthy",
      disabled: "⚫ Disabled",
      unknown: "⚪ Unknown",
    };
    return statusMap[status] || status;
  },

  formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  },
};
