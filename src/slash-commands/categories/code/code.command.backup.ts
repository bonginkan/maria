import { CommandCategory } from "@/types/slash-command";
import { MariaSlashCommand } from "@/types/slash-command";
import { getFastCodeGenerator } from "@/services/code-quality/FastCodeGenerator";
import { templateManager } from "@/services/code-quality/TemplateManager";
import { promptCache } from "@/services/code-quality/PromptCache";
import { validateGate } from "@/services/code-quality/ValidateGate";
import { runStep } from "@/services/code-quality/StepRunner";
import { codeMetrics } from "@/services/code-quality/CodeMetrics";

const MAX_TOTAL_MS = 15000;

/**
 * Linear flow /code command - Template → Cache → FastCodeGenerator → Validate(soft) → Final → DONE
 * No loops, no retries, guaranteed termination within 15 seconds
 */
export const codeCommand: MariaSlashCommand = {
  name: "code",
  description: "Fast code generation (template/cache/LLM)",
  category: CommandCategory.Code,

  handler: async (args, services) => {
    const prompt = args.trim();
    const aborter = new AbortController();
    const started = Date.now();
    const sessionId = `code_${started}_${Math.random().toString(36).substring(2, 8)}`;

    // Start metrics
    codeMetrics.startSession(sessionId);
    codeMetrics.record({
      t: "command_start",
      command: "code",
      prompt: prompt.substring(0, 100),
    });

    const endIfTimeout = () => {
      if (Date.now() - started > MAX_TOTAL_MS) {
        aborter.abort();
        throw new Error("overall-timeout");
      }
    };

    try {
      // 0) Early termination: no input
      if (!prompt) {
        codeMetrics.record({ t: "early_exit", reason: "no_prompt" });
        return {
          success: false,
          message: 'Provide prompt, e.g. /code "create tetris game"',
        };
      }

      // 1) Template immediate return
      endIfTimeout();
      const hit = await templateManager.match(prompt);
      if (hit) {
        codeMetrics.record({
          t: "template_hit",
          templateHit: true,
          duration: Date.now() - started,
        });
        codeMetrics.endSession();
        console.log(hit);
        return {
          success: true,
          message: `✅ Template match in ${Date.now() - started}ms`,
        };
      }

      // 2) Cache immediate return
      endIfTimeout();
      const cached = promptCache.get(prompt);
      if (cached) {
        codeMetrics.record({
          t: "cache_hit",
          cacheHit: true,
          duration: Date.now() - started,
        });
        codeMetrics.endSession();
        console.log(cached);
        return {
          success: true,
          message: `✅ Cache hit in ${Date.now() - started}ms`,
        };
      }

      // 3) Generation (lightweight model/streaming internally)
      endIfTimeout();
      const fast = getFastCodeGenerator(services.providerHub);
      const code = await runStep(
        "Generating code...",
        async (signal) => {
          const result = await fast.generate({
            prompt,
            signal: aborter.signal,
          });
          return result;
        },
        {
          timeoutMs: 6000, // 6s upper limit
          ui: services.ui,
          signal: aborter.signal,
        },
      );

      // 4) Lightweight validation (softOnly)
      endIfTimeout();
      const validation = await runStep(
        "Validating...",
        async (signal) => {
          // Simple validation - just check if we got code
          if (!code || code.trim().length === 0) {
            return { kind: "hardFail", messages: ["No code generated"] };
          }
          // Light format check
          const hasIssues = code.includes("  ") || code.includes("\t\t");
          if (hasIssues) {
            return { kind: "softFail", messages: ["Minor formatting issues"] };
          }
          return { kind: "pass", messages: [] };
        },
        {
          timeoutMs: 1000,
          ui: services.ui,
          signal: aborter.signal,
        },
      );

      // 5) Final (formatting only) → always DONE with return
      endIfTimeout();
      const final = await runStep(
        "Final review...",
        async (signal) => {
          // Light formatting only (sync/fast)
          let formatted = code;
          if (!formatted.endsWith("\n")) {
            formatted += "\n";
          }
          return formatted;
        },
        {
          timeoutMs: 500,
          ui: services.ui,
          signal: aborter.signal,
        },
      );

      // 6) Cache save (best-effort, don't await)
      promptCache.set(prompt, final);

      // Record metrics
      codeMetrics.record({
        t: "command_complete",
        success: true,
        duration: Date.now() - started,
        validation: validation.kind,
      });
      codeMetrics.endSession();

      // 7) **DONE: Always early return here (no retry)**
      console.log(final);
      return {
        success: true,
        message: `✅ Generated in ${Date.now() - started}ms`,
      };
    } catch (e: any) {
      aborter.abort();

      // Record error
      codeMetrics.record({
        t: "command_error",
        error: e?.message || String(e),
        duration: Date.now() - started,
      });
      codeMetrics.endSession();

      // Return error message
      const errorMsg = e?.message || String(e);
      if (errorMsg.includes("overall-timeout")) {
        return {
          success: false,
          message: `⏱️ Timeout: Code generation exceeded ${MAX_TOTAL_MS}ms limit`,
        };
      }

      return {
        success: false,
        message: `❌ /code failed: ${errorMsg}`,
      };
    }
  },

  completion: async (args: string) => {
    // Provide intelligent completions
    const completions = [
      "create tetris game",
      "todo list app",
      "calculator",
      "REST API for users",
      "login form",
      "chat application",
      "fibonacci function",
      "sorting algorithm",
    ];

    return completions.filter((c) =>
      c.toLowerCase().includes(args.toLowerCase()),
    );
  },
};

export default codeCommand;
