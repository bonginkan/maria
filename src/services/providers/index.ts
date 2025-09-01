/**
 * Provider initialization and registration
 */

import { ProviderHub } from "./ProviderHub";
import { TemplateProvider } from "./TemplateProvider";
import { OpenAIProvider } from "./OpenAIProvider";
import { defaultTemplates } from "../templates/TemplateRepo";

export { ProviderHub } from "./ProviderHub";
export type { AIProvider, GenerateOptions, GenerateResult } from "./types";

export function createDefaultProviderHub(): ProviderHub {
  const hub = new ProviderHub();
  const templates = defaultTemplates();

  // Always register template provider as fallback
  hub.register(new TemplateProvider(templates));

  // Register OpenAI provider
  hub.register(new OpenAIProvider("gpt-4o"));
  hub.register(new OpenAIProvider("gpt-4o-mini"));

  // TODO: Add more providers as they're implemented
  // hub.register(new GeminiProvider("gemini-2.5-pro"));
  // hub.register(new AnthropicProvider("claude-3-5-sonnet-latest"));
  // hub.register(new OllamaProvider());
  // hub.register(new LMStudioProvider());
  // hub.register(new VLLMProvider());

  // Set fallback chain
  hub.setFallbackChain(["gpt-4o", "gpt-4o-mini", "template"]);

  // Set default model if configured
  if (process.env.DEFAULT_MODEL) {
    hub.setCurrentModel(process.env.DEFAULT_MODEL);
  }

  return hub;
}
