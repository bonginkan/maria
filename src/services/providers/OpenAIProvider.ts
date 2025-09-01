/**
 * OpenAI Provider - GPT models integration
 */

import { AIProvider, GenerateOptions, GenerateResult } from "./types";
import { extractCodeOrText } from "./_helpers";

export class OpenAIProvider implements AIProvider {
  id: string;
  modelId: string;
  vendor = "openai" as const;
  name = "OpenAI GPT";

  constructor(modelId = "gpt-4o") {
    this.modelId = modelId;
    this.id = `openai:${modelId}`;
  }

  available(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  async generate(
    prompt: string,
    opts: GenerateOptions = {},
  ): Promise<GenerateResult> {
    if (!this.available()) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    const controller = new AbortController();
    const signal = opts.signal || controller.signal;

    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          signal,
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: this.modelId,
            temperature: opts.temperature ?? 0.2,
            max_tokens: opts.maxTokens ?? 2048,
            messages: [
              {
                role: "system",
                content:
                  "You are a senior software engineer. When asked for code, return ONLY the code without explanations or markdown fences unless specifically requested.",
              },
              { role: "user", content: prompt },
            ],
          }),
        },
      );

      if (!response.ok) {
        const error = await response.text().catch(() => "Unknown error");
        throw new Error(`OpenAI API error ${response.status}: ${error}`);
      }

      const json = (await response.json()) as any;
      const content = json.choices?.[0]?.message?.content || "";

      const { code, text } = extractCodeOrText(content);

      return {
        code,
        text,
        finishReason: json.choices?.[0]?.finish_reason || "stop",
        modelId: this.modelId,
        providerId: this.id,
        usage: {
          promptTokens: json.usage?.prompt_tokens,
          completionTokens: json.usage?.completion_tokens,
        },
      };
    } catch (error: any) {
      if (error.name === "AbortError") {
        throw new Error("Request was cancelled");
      }
      throw error;
    }
  }
}
