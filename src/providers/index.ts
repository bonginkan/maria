/**
 * Unified Provider System v2.0 – Single source of truth
 * Public exports used by the rest of the codebase.
 */

// ── Types & constants
export type {
  ProviderId,
  ProviderRequest,
  ProviderResponse,
  ProviderResponseChunk,
  ProviderStream,
  ProviderHealth,
  IUnifiedAIProvider,
  ProviderManagerConfig,
} from "./config";
export {
  USE_LEGACY_PROVIDERS,
  DEFAULT_PROVIDER,
  DEFAULT_MODEL,
} from "./config";

// ── Core classes
export { UnifiedBaseProvider } from "./base-provider";
export { UnifiedAIProviderManager } from "./manager";

// ── Factory (one canonical helper)
import type { ProviderManagerConfig, ProviderId } from "./config";
import { UnifiedAIProviderManager as _Manager } from "./manager";

export function createProviderManager(
  config?: ProviderManagerConfig,
): _Manager {
  return new _Manager(config);
}

// ── Singleton helper
export function getProviderManager(
  config?: ProviderManagerConfig,
): _Manager {
  return _Manager.getInstance(config);
}

// ── Health utility (handy for CLI/diagnostics)
export async function checkProviderHealth(): Promise<{
  healthy: ProviderId[];
  unhealthy: ProviderId[];
  details: Record<ProviderId, import("./config").ProviderHealth>;
}> {
  const manager = new _Manager();
  await manager.initialize();
  const details = await manager.getProvidersHealth();
  const healthy: ProviderId[] = [];
  const unhealthy: ProviderId[] = [];
  for (const [id, status] of Object.entries(details)) {
    (status.ok ? healthy : unhealthy).push(id as ProviderId);
  }
  return { healthy, unhealthy, details: details as Record<ProviderId, import("./config").ProviderHealth> };
}

// ── Environment helper (used by startup & /model)
export function getProviderEnvironmentConfig(): {
  useLegacy: boolean;
  defaultProvider: ProviderId;
  defaultModel: string;
  availableApiKeys: Record<string, boolean>;
} {
  return {
    useLegacy: USE_LEGACY_PROVIDERS,
    defaultProvider: (DEFAULT_PROVIDER as ProviderId),
    defaultModel: DEFAULT_MODEL,
    availableApiKeys: {
      // eslint-disable-next-line no-restricted-syntax
      openai: !!process.env.OPENAI_API_KEY,
      // eslint-disable-next-line no-restricted-syntax  
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      // eslint-disable-next-line no-restricted-syntax
      google: !!(process.env.GOOGLE_API_KEY || process.env.GOOGLE_AI_API_KEY),
      // eslint-disable-next-line no-restricted-syntax
      grok: !!(process.env.GROK_API_KEY || process.env.XAI_API_KEY),
      // keep groq key presence check for future adapter
      // eslint-disable-next-line no-restricted-syntax
      groq: !!process.env.GROQ_API_KEY,
    },
  };
}

// ── Legacy alias & default export
export { UnifiedAIProviderManager as AIProviderManager } from "./manager";
export { default } from "./manager";