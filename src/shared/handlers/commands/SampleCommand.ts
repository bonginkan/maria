/**
 * SampleCommandV2 - Enhanced Version
 * Example command demonstrating the new port/adapter pattern with all improvements
 */

import type { SlashCommandV2 } from "../SlashCommandHandler";
import type {
  CommandContext,
  CommandResult,
  MemoryContent,
  ModelInfo,
} from "../../types/enhanced-context";
import { throwIfAborted, safeAsync } from "../utils/abort-helpers";
import { CommandTracer, traced } from "../utils/tracing";
import { ResultAdapter, ErrorType } from "../adapters/ResultAdapter";
import { ProgressManager } from "../utils/ui-throttling";
import { validateMemoryContent } from "../../types/enhanced-context";

export class SampleCommandV2 implements SlashCommandV2 {
  name = "sample";
  aliases = ["test", "demo"];
  description = "Sample command demonstrating the new architecture";
  category = "development";

  async execute(context: CommandContext): Promise<CommandResult> {
    const { deps, args, signal, traceId } = context;
    const { provider, memory, context: chatContext, ui } = deps;

    // Initialize tracing and progress management
    const tracer = new CommandTracer(context);
    const progress = new ProgressManager(ui, signal);
    const startedAt = Date.now();

    // Initialize progress (finally will ensure cleanup)
    await progress.update(0, "Processing sample command...");

    try {
      tracer.startSpan("sample_command_execution", {
        args: args.length,
        traceId,
      });

      // Helper for safe progress updates
      const safeUpdate = async (pct: number, message?: string) => {
        if (signal?.aborted) return; // Prevent TTY pollution
        await safeAsync(() => progress.update(pct, message), signal);
      };

      // 1) List models with improved type handling
      await traced(tracer, "provider.listModels", async () => {
        const modelsRaw = await provider.listModels({ signal });
        throwIfAborted(signal);

        // Handle both old string[] and new ModelInfo[] formats
        const models: ModelInfo[] = Array.isArray(modelsRaw)
          ? modelsRaw.map((m) =>
              typeof m === "string"
                ? {
                    id: m,
                    name: m,
                    provider: "unknown",
                    capabilities: {
                      streaming: false,
                      functions: false,
                      vision: false,
                    },
                    status: "available" as const,
                  }
                : m,
            )
          : [];

        // Display with length limiting (prevent CLI overflow)
        const top10 = models.slice(0, 10);
        const displayText = `Available models (${models.length}): ${top10.map((m) => m.name || m.id).join(", ")}${models.length > 10 ? " ..." : ""}`;

        await ui.display({
          content: displayText,
          type: "info",
        });

        tracer.addMetadata({ modelCount: models.length });
      });

      throwIfAborted(signal);
      await safeUpdate(40);

      // 2) Memory storage with schema validation
      await traced(tracer, "memory.store", async () => {
        const memoryContent: MemoryContent = validateMemoryContent({
          type: "command.sample.v2",
          content: {
            command: "sample",
            args,
            executedAt: new Date().toISOString(),
          },
          metadata: {
            timestamp: new Date().toISOString(),
            importance: 0.5, // Will be clamped 0-1
            type: "command.sample.v2",
            tags: ["sample", "demo", "v2"],
            traceId: tracer.getTraceId(),
          },
        });

        await memory.store(memoryContent, { signal });
        tracer.addMetadata({ memoryStored: true });
      });

      throwIfAborted(signal);
      await safeUpdate(65);

      // 3) Memory query
      await traced(tracer, "memory.query", async () => {
        const memories = await memory.query(
          {
            query: "sample command",
            limit: 5,
            type: "command.sample",
          },
          { signal },
        );

        await ui.display({
          content: `Found ${memories.length} related memories`,
          type: "info",
        });

        tracer.addMetadata({ memoriesFound: memories.length });
      });

      throwIfAborted(signal);
      await safeUpdate(85);

      // 4) Context update (business event only, display via return)
      await traced(tracer, "context.addMessage", async () => {
        // Only store business event, not display message
        await chatContext.addMessage(
          {
            role: "assistant",
            content: JSON.stringify({
              event: "sample_command_executed",
              args,
              timestamp: new Date().toISOString(),
              traceId: tracer.getTraceId(),
            }),
          },
          { signal },
        );
      });

      await safeUpdate(100, "Sample command completed");

      const result: CommandResult = {
        success: true,
        messages: [
          {
            role: "assistant",
            content: `Sample command completed in ${Date.now() - startedAt}ms. Processed ${args.length} arguments.`,
          },
        ],
        metrics: {
          startTime: startedAt,
          endTime: Date.now(),
          duration: Date.now() - startedAt,
          memoryAccess: 1,
          providerCalls: 1,
        },
      };

      tracer.complete(result);
      return result;
    } catch (err: any) {
      // Classify error properly
      const errorType = ResultAdapter.classifyError(err);

      if (errorType === ErrorType.ABORT || signal?.aborted) {
        return ResultAdapter.errorResult(err, "Command timed out or cancelled");
      }

      return ResultAdapter.errorResult(err, "Sample command failed");
    } finally {
      // CRITICAL: Always clean up progress (prevent dangling UI)
      await safeAsync(async () => {
        await progress.complete("Done");
      }, undefined); // No signal for cleanup
    }
  }
}

/**
 * Factory function to create the sample command
 */
export function createSampleCommand(): SlashCommandV2 {
  return new SampleCommandV2();
}
