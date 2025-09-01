/**
 * Configuration Profile System - Phase 3
 * Environment-specific configurations with inheritance and override capabilities
 */

import { _z } from "zod";
import { ValidatedConfig } from "../config-manager";
import { _ConfigTemplate } from "../templates/config-templates";

// Profile definition with inheritance support
export interface ConfigProfile {
  id: string;
  name: string;
  description: string;

  // Inheritance chain
  extends?: string; // Parent profile ID
  environment: ProfileEnvironment;

  // Configuration data
  config: Partial<ValidatedConfig>;

  // Profile-specific settings
  variables?: Record<string, ProfileVariable>;
  secrets?: ProfileSecret[];
  conditions?: ProfileCondition[];

  // Metadata
  version: string;
  author: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;

  // Deployment settings
  deploymentTargets?: DeploymentTarget[];
  restrictions?: ProfileRestriction[];

  // Validation
  active: boolean;
  validated?: boolean;
  validationErrors?: string[];
}

export enum ProfileEnvironment {
  DEVELOPMENT = "development",
  TESTING = "testing",
  STAGING = "staging",
  PRODUCTION = "production",
  PREVIEW = "preview",
  SANDBOX = "sandbox",
  CUSTOM = "custom",
}

export interface ProfileVariable {
  name: string;
  value: unknown;
  encrypted?: boolean;
  environment?: string; // Override for specific environments
  required?: boolean;
  description?: string;
}

export interface ProfileSecret {
  name: string;
  source: "environment" | "vault" | "file" | "k8s-secret";
  key: string;
  required: boolean;
  description?: string;
  rotationPolicy?: {
    enabled: boolean;
    intervalDays: number;
    warningDays: number;
  };
}

export interface ProfileCondition {
  type: "environment" | "time" | "feature_flag" | "resource_availability";
  condition: string; // JavaScript-like expression
  action: "apply" | "skip" | "warn" | "error";
  description?: string;
}

export interface DeploymentTarget {
  name: string;
  type: "kubernetes" | "docker" | "serverless" | "bare_metal";
  configuration: Record<string, unknown>;
  healthCheck?: {
    endpoint: string;
    expectedStatus: number;
    timeout: number;
  };
}

export interface ProfileRestriction {
  type: "time_window" | "geographic" | "user_role" | "resource_limit";
  rule: string;
  enforcement: "warn" | "error" | "block";
  message?: string;
}

// Profile inheritance resolution result
export interface ResolvedProfile {
  profile: ConfigProfile;
  inheritanceChain: ConfigProfile[];
  resolvedConfig: ValidatedConfig;
  appliedVariables: Record<string, unknown>;
  activeConditions: ProfileCondition[];
  unmetSecrets: ProfileSecret[];
}

export class ConfigProfileManager {
  private profiles: Map<string, ConfigProfile> = new Map();
  private resolvedCache: Map<string, ResolvedProfile> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.initializeBuiltInProfiles();
  }

  private initializeBuiltInProfiles(): void {
    // Base development profile
    this.registerProfile({
      id: "base-development",
      name: "Base Development",
      description: "Base configuration for development environments",
      environment: ProfileEnvironment.DEVELOPMENT,
      config: {
        priority: "performance",
        logLevel: "debug",
        telemetryEnabled: false,
        cacheEnabled: true,
        autoStart: true,
        healthMonitoring: false,
        timeout: 60000,
        maxRetries: 1,
        concurrentRequests: 10,
        localProviders: {
          lmstudio: true,
          ollama: true,
          vllm: false,
        },
        offlineMode: true,
      },
      variables: {
        DEBUG_MODE: {
          name: "DEBUG_MODE",
          value: true,
          description: "Enable debug features",
        },
        LOCAL_MODEL_PREFERENCE: {
          name: "LOCAL_MODEL_PREFERENCE",
          value: "llama3",
          description: "Preferred local model for development",
        },
      },
      conditions: [
        {
          type: "environment",
          condition: 'NODE_ENV === "development"',
          action: "apply",
          description: "Only apply in development environment",
        },
      ],
      version: "1.0.0",
      author: "MARIA Team",
      tags: ["development", "base", "local"],
      createdAt: new Date("2025-01-27"),
      updatedAt: new Date("2025-01-27"),
      active: true,
    });

    // Extended development profile
    this.registerProfile({
      id: "dev-extended",
      name: "Development Extended",
      description:
        "Extended development profile with additional debugging tools",
      extends: "base-development",
      environment: ProfileEnvironment.DEVELOPMENT,
      config: {
        logLevel: "debug",
        telemetryEnabled: false,
        // Additional debug settings
        timeout: 120000, // Longer timeout for debugging
        maxRetries: 0, // Fail fast for debugging
      },
      variables: {
        TRACE_ENABLED: {
          name: "TRACE_ENABLED",
          value: true,
          description: "Enable request tracing",
        },
        MOCK_API_CALLS: {
          name: "MOCK_API_CALLS",
          value: false,
          description: "Mock external API calls for testing",
        },
      },
      version: "1.0.0",
      author: "MARIA Team",
      tags: ["development", "extended", "debugging"],
      createdAt: new Date("2025-01-27"),
      updatedAt: new Date("2025-01-27"),
      active: true,
    });

    // Base production profile
    this.registerProfile({
      id: "base-production",
      name: "Base Production",
      description: "Secure base configuration for production environments",
      environment: ProfileEnvironment.PRODUCTION,
      config: {
        priority: "privacy-first",
        provider: "openai",
        model: "gpt-4o",
        logLevel: "info",
        telemetryEnabled: true,
        cacheEnabled: true,
        autoStart: true,
        healthMonitoring: true,
        timeout: 30000,
        maxRetries: 3,
        concurrentRequests: 5,
        localProviders: {
          lmstudio: false,
          ollama: false,
          vllm: false,
        },
        offlineMode: false,
      },
      secrets: [
        {
          name: "OPENAI_API_KEY",
          source: "environment",
          key: "OPENAI_API_KEY",
          required: true,
          description: "OpenAI API key for production",
          rotationPolicy: {
            enabled: true,
            intervalDays: 90,
            warningDays: 14,
          },
        },
        {
          name: "ANTHROPIC_API_KEY",
          source: "environment",
          key: "ANTHROPIC_API_KEY",
          required: false,
          description: "Anthropic API key for fallback",
        },
      ],
      conditions: [
        {
          type: "environment",
          condition: 'NODE_ENV === "production"',
          action: "apply",
          description: "Only apply in production environment",
        },
      ],
      restrictions: [
        {
          type: "time_window",
          rule: "deployment_window: weekdays 09:00-17:00",
          enforcement: "warn",
          message: "Production deployments recommended during business hours",
        },
      ],
      version: "1.0.0",
      author: "MARIA Team",
      tags: ["production", "base", "secure"],
      createdAt: new Date("2025-01-27"),
      updatedAt: new Date("2025-01-27"),
      active: true,
    });

    // High-availability production profile
    this.registerProfile({
      id: "prod-ha",
      name: "Production High Availability",
      description:
        "High-availability production configuration with multiple providers",
      extends: "base-production",
      environment: ProfileEnvironment.PRODUCTION,
      config: {
        priority: "privacy-first",
        provider: "openai",
        model: "gpt-4o",
        timeout: 20000, // Faster timeout for HA
        maxRetries: 5, // More retries for reliability
        concurrentRequests: 8, // Higher throughput
      },
      secrets: [
        {
          name: "GROQ_API_KEY",
          source: "vault",
          key: "secret/maria/groq-api-key",
          required: true,
          description: "Groq API key for high-speed fallback",
        },
      ],
      deploymentTargets: [
        {
          name: "kubernetes-primary",
          type: "kubernetes",
          configuration: {
            namespace: "maria-prod",
            replicas: 3,
            resources: {
              requests: { cpu: "500m", memory: "1Gi" },
              limits: { cpu: "2", memory: "4Gi" },
            },
          },
          healthCheck: {
            endpoint: "/health",
            expectedStatus: 200,
            timeout: 5000,
          },
        },
      ],
      restrictions: [
        {
          type: "resource_limit",
          rule: "max_concurrent_requests: 100",
          enforcement: "error",
          message: "Concurrent request limit exceeded",
        },
      ],
      version: "1.0.0",
      author: "MARIA Team",
      tags: ["production", "high-availability", "kubernetes"],
      createdAt: new Date("2025-01-27"),
      updatedAt: new Date("2025-01-27"),
      active: true,
    });

    // Testing profile
    this.registerProfile({
      id: "testing-ci",
      name: "CI/CD Testing",
      description: "Configuration optimized for automated testing pipelines",
      environment: ProfileEnvironment.TESTING,
      config: {
        priority: "cost-effective",
        provider: "groq",
        model: "mixtral-8x7b-32768",
        logLevel: "warn",
        telemetryEnabled: false,
        cacheEnabled: true,
        autoStart: true,
        healthMonitoring: false,
        timeout: 15000,
        maxRetries: 2,
        concurrentRequests: 4,
        offlineMode: false,
      },
      variables: {
        TEST_MODE: {
          name: "TEST_MODE",
          value: true,
          description: "Enable test-specific features",
        },
        MOCK_EXTERNAL_APIS: {
          name: "MOCK_EXTERNAL_APIS",
          value: true,
          description: "Mock external API calls in tests",
        },
      },
      conditions: [
        {
          type: "environment",
          condition: 'CI === "true" || NODE_ENV === "test"',
          action: "apply",
          description: "Apply only in CI/testing environments",
        },
      ],
      version: "1.0.0",
      author: "MARIA Team",
      tags: ["testing", "ci-cd", "automated"],
      createdAt: new Date("2025-01-27"),
      updatedAt: new Date("2025-01-27"),
      active: true,
    });
  }

  /**
   * Register a new profile
   */
  registerProfile(profile: ConfigProfile): void {
    // Validate profile before registration
    this.validateProfile(profile);

    profile.updatedAt = new Date();
    this.profiles.set(profile.id, profile);

    // Clear cache for this profile and any dependents
    this.invalidateProfileCache(profile.id);
  }

  /**
   * Get profile by ID
   */
  getProfile(profileId: string): ConfigProfile | undefined {
    return this.profiles.get(profileId);
  }

  /**
   * List all profiles, optionally filtered by environment
   */
  listProfiles(environment?: ProfileEnvironment): ConfigProfile[] {
    const profiles = Array.from(this.profiles.values()).filter((p) => p.active);
    return environment
      ? profiles.filter((p) => p.environment === environment)
      : profiles;
  }

  /**
   * Resolve a profile with full inheritance chain
   */
  async resolveProfile(
    profileId: string,
    context?: Record<string, unknown>,
  ): Promise<ResolvedProfile> {
    // Check cache first
    const cacheKey = `${profileId}-${JSON.stringify(context || object)}`;
    const cached = this.resolvedCache.get(cacheKey);

    if (
      cached &&
      Date.now() - cached.profile.updatedAt.getTime() < this.cacheTimeout
    ) {
      return cached;
    }

    // Resolve inheritance chain
    const inheritanceChain = await this.resolveInheritanceChain(profileId);
    const baseProfile = inheritanceChain[0];

    // Merge configurations from inheritance chain
    let resolvedConfig = {} as ValidatedConfig;
    const appliedVariables: Record<string, unknown> = {};
    const activeConditions: ProfileCondition[] = [];
    const unmetSecrets: ProfileSecret[] = [];

    for (const profile of inheritanceChain) {
      // Merge configuration
      resolvedConfig = this.deepMerge(resolvedConfig, profile.config);

      // Evaluate conditions
      const conditions = await this.evaluateConditions(
        profile.conditions || [],
        context,
      );
      activeConditions.push(...conditions.active);

      // Skip profile if conditions not met
      if (conditions.skip) {
        continue;
      }

      // Apply variables
      if (profile.variables) {
        for (const [name, variable] of Object.entries(profile.variables)) {
          appliedVariables[name] = variable.value;
        }
      }

      // Check secrets
      if (profile.secrets) {
        for (const secret of profile.secrets) {
          const available = await this.checkSecretAvailability(secret);
          if (!available && secret.required) {
            unmetSecrets.push(secret);
          }
        }
      }
    }

    const resolved: ResolvedProfile = {
      profile: baseProfile,
      inheritanceChain,
      resolvedConfig,
      appliedVariables,
      activeConditions,
      unmetSecrets,
    };

    // Cache result
    this.resolvedCache.set(cacheKey, resolved);

    return resolved;
  }

  /**
   * Resolve inheritance chain for a profile
   */
  private async resolveInheritanceChain(
    profileId: string,
  ): Promise<ConfigProfile[]> {
    const chain: ConfigProfile[] = [];
    const visited = new Set<string>();
    let currentId: string | undefined = profileId;

    while (currentId) {
      if (visited.has(currentId)) {
        throw new Error(
          `Circular inheritance detected in profile chain: ${Array.from(visited).join(" -> ")} -> ${currentId}`,
        );
      }

      const profile = this.profiles.get(currentId);
      if (!profile) {
        throw new Error(`Profile not found: ${currentId}`);
      }

      if (!profile.active) {
        throw new Error(`Profile is inactive: ${currentId}`);
      }

      visited.add(currentId);
      chain.unshift(profile); // Add to beginning to maintain inheritance order
      currentId = profile.extends;
    }

    return chain;
  }

  /**
   * Evaluate profile conditions
   */
  private async evaluateConditions(
    conditions: ProfileCondition[],
    context?: Record<string, unknown>,
  ): Promise<{ active: ProfileCondition[]; skip: boolean }> {
    const active: ProfileCondition[] = [];
    let skip = false;

    for (const condition of conditions) {
      try {
        const result = await this.evaluateCondition(condition, context);

        if (result) {
          active.push(condition);

          if (condition.action === "skip") {
            skip = true;
          } else if (condition.action === "error") {
            throw new Error(
              `Profile condition failed: ${condition.description || condition.condition}`,
            );
          }
        }
      } catch (error) {
        if (condition.action === "error") {
          throw error;
        }
        // Continue for warn/apply actions
      }
    }

    return { active, skip };
  }

  /**
   * Evaluate a single condition safely
   */
  private async evaluateCondition(
    condition: ProfileCondition,
    context?: Record<string, unknown>,
  ): Promise<boolean> {
    const evalContext = {
      ...process.env,
      ...context,
      NODE_ENV: process.env.NODE_ENV,
      CI: process.env.CI,
      // Add time-based functions
      now: new Date(),
      hour: new Date().getHours(),
      day: new Date().getDay(),
      // Add feature flag checking (mock implementation)
      hasFeature: (flag: string) =>
        !!process.env[`FEATURE_${flag.toUpperCase()}`],
    };

    switch (condition.type) {
      case "environment":
        // Simple environment variable checks
        return this.evaluateEnvironmentCondition(
          condition.condition,
          evalContext,
        );

      case "time":
        return this.evaluateTimeCondition(condition.condition, evalContext);

      case "feature_flag":
        return this.evaluateFeatureFlagCondition(
          condition.condition,
          evalContext,
        );

      case "resource_availability":
        return this.evaluateResourceCondition(condition.condition, evalContext);

      default:
        throw new Error(`Unknown condition type: ${condition.type}`);
    }
  }

  private evaluateEnvironmentCondition(
    condition: string,
    context: any,
  ): boolean {
    // Safe environment condition evaluation
    try {
      // Simple comparisons only - no eval()
      const envVar = condition.match(/^(\w+)\s*===\s*"([^"]*)"$/);
      if (envVar) {
        return context[envVar[1]] === envVar[2];
      }

      const envExists = condition.match(/^(\w+)$/);
      if (envExists) {
        return !!context[envExists[1]];
      }

      return false;
    } catch {
      return false;
    }
  }

  private evaluateTimeCondition(condition: string, context: any): boolean {
    // Time-based conditions (business hours, etc.)
    try {
      const now = context.now as Date;
      const hour = now.getHours();
      const day = now.getDay(); // 0 = Sunday

      if (condition.includes("business_hours")) {
        return day >= 1 && day <= 5 && hour >= 9 && hour <= 17;
      }

      if (condition.includes("weekdays")) {
        return day >= 1 && day <= 5;
      }

      return true;
    } catch {
      return false;
    }
  }

  private evaluateFeatureFlagCondition(
    condition: string,
    context: any,
  ): boolean {
    // Feature flag evaluation
    try {
      const flagMatch = condition.match(/feature_flag\("([^"]*)"\)/);
      if (flagMatch) {
        return context.hasFeature(flagMatch[1]);
      }
      return false;
    } catch {
      return false;
    }
  }

  private evaluateResourceCondition(
    _condition: string,
    _context: any,
  ): boolean {
    // Resource availability checks (simplified)
    try {
      // In real implementation, check actual resource availability
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a secret is available
   */
  private async checkSecretAvailability(
    secret: ProfileSecret,
  ): Promise<boolean> {
    switch (secret.source) {
      case "environment":
        return !!process.env[secret.key];

      case "vault":
        // In real implementation, check Vault
        return false;

      case "file":
        // In real implementation, check file existence
        return false;

      case "k8s-secret":
        // In real implementation, check Kubernetes secret
        return false;

      default:
        return false;
    }
  }

  /**
   * Validate profile structure
   */
  private validateProfile(profile: ConfigProfile): void {
    if (!profile.id || !profile.name) {
      throw new Error("Profile must have id and name");
    }

    if (profile.extends && !this.profiles.has(profile.extends)) {
      throw new Error(`Parent profile not found: ${profile.extends}`);
    }

    // Validate conditions
    if (profile.conditions) {
      for (const condition of profile.conditions) {
        if (!condition.type || !condition.condition) {
          throw new Error("Condition must have type and condition");
        }
      }
    }
  }

  /**
   * Deep merge configurations
   */
  private deepMerge<T extends Record<string, any>>(
    target: T,
    source: Partial<T>,
  ): T {
    const result = { ...target };

    for (const key in source) {
      if (source[key] === undefined) continue;

      const sourceValue = source[key];
      const targetValue = result[key];

      if (Array.isArray(sourceValue)) {
        result[key] = [...sourceValue] as any;
      } else if (
        sourceValue &&
        typeof sourceValue === "object" &&
        targetValue &&
        typeof targetValue === "object" &&
        !Array.isArray(targetValue)
      ) {
        result[key] = this.deepMerge(targetValue, sourceValue);
      } else {
        result[key] = sourceValue as any;
      }
    }

    return result;
  }

  /**
   * Invalidate profile cache
   */
  private invalidateProfileCache(profileId: string): void {
    // Remove all cached entries that depend on this profile
    for (const [key, resolved] of this.resolvedCache.entries()) {
      if (resolved.inheritanceChain.some((p) => p.id === profileId)) {
        this.resolvedCache.delete(key);
      }
    }
  }

  /**
   * Clone a profile with new ID
   */
  cloneProfile(
    sourceId: string,
    newId: string,
    modifications?: Partial<ConfigProfile>,
  ): ConfigProfile {
    const source = this.getProfile(sourceId);
    if (!source) {
      throw new Error(`Profile not found: ${sourceId}`);
    }

    const cloned: ConfigProfile = {
      ...JSON.parse(JSON.stringify(source)),
      id: newId,
      name: modifications?.name || `${source.name} (Copy)`,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...modifications,
    };

    this.registerProfile(cloned);
    return cloned;
  }

  /**
   * Deactivate a profile
   */
  deactivateProfile(profileId: string): void {
    const profile = this.getProfile(profileId);
    if (profile) {
      profile.active = false;
      profile.updatedAt = new Date();
      this.invalidateProfileCache(profileId);
    }
  }

  /**
   * Get profile statistics
   */
  getProfileStats(): {
    total: number;
    active: number;
    byEnvironment: Record<ProfileEnvironment, number>;
    withInheritance: number;
  } {
    const profiles = Array.from(this.profiles.values());
    const active = profiles.filter((p) => p.active);

    const byEnvironment = {} as Record<ProfileEnvironment, number>;
    for (const env of Object.values(ProfileEnvironment)) {
      byEnvironment[env] = active.filter((p) => p.environment === env).length;
    }

    return {
      total: profiles.length,
      active: active.length,
      byEnvironment,
      withInheritance: active.filter((p) => p.extends).length,
    };
  }
}
