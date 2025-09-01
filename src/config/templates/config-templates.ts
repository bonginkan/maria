/**
 * Configuration Templates System - Phase 3
 * Pre-built configurations for rapid deployment and best practices
 */

import { z } from "zod";
import { ValidatedConfig } from "../config-manager";

// Template metadata for discoverability and management
export interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  version: string;
  author: string;
  tags: string[];

  // Template configuration
  config: Partial<ValidatedConfig>;

  // Template-specific settings
  variables?: Record<string, TemplateVariable>;
  requirements?: TemplateRequirement[];
  recommendations?: string[];

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  usageCount?: number;
  rating?: number;

  // Validation and compatibility
  compatibleVersions: string[];
  deprecated?: boolean;
  deprecationMessage?: string;
}

export enum TemplateCategory {
  DEVELOPMENT = "development",
  STAGING = "staging",
  PRODUCTION = "production",
  TESTING = "testing",
  CLOUD_PROVIDERS = "cloud-providers",
  SECURITY = "security",
  PERFORMANCE = "performance",
  COMPLIANCE = "compliance",
  LOCAL_DEVELOPMENT = "local-development",
  CI_CD = "ci-cd",
}

export interface TemplateVariable {
  name: string;
  description: string;
  type: "string" | "number" | "boolean" | "enum";
  required: boolean;
  defaultValue?: unknown;
  enumValues?: string[];
  validation?: z.ZodSchema;
  example?: string;
}

export interface TemplateRequirement {
  type: "environment_variable" | "api_key" | "service" | "permission";
  name: string;
  description: string;
  optional: boolean;
  validationCommand?: string;
}

// Built-in templates for common scenarios
export class ConfigTemplateRegistry {
  private static templates: Map<string, ConfigTemplate> = new Map();
  private static customTemplates: Map<string, ConfigTemplate> = new Map();

  static {
    this.initializeBuiltInTemplates();
  }

  private static initializeBuiltInTemplates(): void {
    // 1. Development Environment Template
    this.register({
      id: "dev-local",
      name: "Local Development Environment",
      description:
        "Optimized for local development with debug features and loose security",
      category: TemplateCategory.DEVELOPMENT,
      version: "1.0.0",
      author: "MARIA Team",
      tags: ["development", "local", "debug", "fast-iteration"],
      config: {
        priority: "performance",
        provider: "ollama",
        model: "llama3",
        timeout: 60000,
        maxRetries: 1,
        concurrentRequests: 10,
        cacheEnabled: true,
        logLevel: "debug",
        telemetryEnabled: false,
        localProviders: {
          lmstudio: true,
          ollama: true,
          vllm: false,
        },
        autoStart: true,
        healthMonitoring: false,
        offlineMode: true,
      },
      variables: {
        LOCAL_MODEL: {
          name: "LOCAL_MODEL",
          description: "Preferred local model for development",
          type: "enum",
          required: false,
          enumValues: ["llama3", "mistral", "qwen2.5", "codellama"],
          defaultValue: "llama3",
          example: "llama3",
        },
        DEBUG_LEVEL: {
          name: "DEBUG_LEVEL",
          description: "Debug logging level",
          type: "enum",
          required: false,
          enumValues: ["error", "warn", "info", "debug"],
          defaultValue: "debug",
          example: "debug",
        },
      },
      requirements: [
        {
          type: "service",
          name: "Ollama Server",
          description: "Local Ollama installation and server running",
          optional: false,
          validationCommand: "curl -f http://localhost:11434/api/tags",
        },
      ],
      recommendations: [
        "Install Ollama and pull your preferred models before using this template",
        "Disable telemetry for privacy during development",
        "Use debug logging to understand AI interactions",
        "Enable cache for faster repeated queries",
      ],
      createdAt: new Date("2025-01-27"),
      updatedAt: new Date("2025-01-27"),
      compatibleVersions: [">=3.0.0"],
      usageCount: 0,
      rating: 5.0,
    });

    // 2. Production Environment Template
    this.register({
      id: "prod-cloud",
      name: "Cloud Production Environment",
      description:
        "Production-ready configuration with security, reliability, and monitoring",
      category: TemplateCategory.PRODUCTION,
      version: "1.0.0",
      author: "MARIA Team",
      tags: [
        "production",
        "cloud",
        "security",
        "monitoring",
        "high-availability",
      ],
      config: {
        priority: "privacy-first",
        provider: "openai",
        model: "gpt-4o",
        timeout: 30000,
        maxRetries: 3,
        concurrentRequests: 5,
        cacheEnabled: true,
        logLevel: "info",
        telemetryEnabled: true,
        localProviders: {
          lmstudio: false,
          ollama: false,
          vllm: false,
        },
        autoStart: true,
        healthMonitoring: true,
        offlineMode: false,
      },
      variables: {
        CLOUD_PROVIDER: {
          name: "CLOUD_PROVIDER",
          description: "Primary cloud AI provider",
          type: "enum",
          required: true,
          enumValues: ["openai", "anthropic", "google", "groq"],
          defaultValue: "openai",
          example: "openai",
        },
        BACKUP_PROVIDER: {
          name: "BACKUP_PROVIDER",
          description: "Fallback provider for high availability",
          type: "enum",
          required: false,
          enumValues: ["openai", "anthropic", "google", "groq"],
          defaultValue: "anthropic",
          example: "anthropic",
        },
        REGION: {
          name: "REGION",
          description: "Deployment region for compliance",
          type: "enum",
          required: false,
          enumValues: ["us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1"],
          defaultValue: "us-east-1",
          example: "us-west-2",
        },
      },
      requirements: [
        {
          type: "api_key",
          name: "Primary Provider API Key",
          description: "Valid API key for the selected primary provider",
          optional: false,
        },
        {
          type: "api_key",
          name: "Backup Provider API Key",
          description: "Valid API key for the backup provider",
          optional: true,
        },
        {
          type: "environment_variable",
          name: "MARIA_LOG_LEVEL",
          description: "Production logging level",
          optional: true,
          validationCommand:
            'echo $MARIA_LOG_LEVEL | grep -E "error|warn|info"',
        },
      ],
      recommendations: [
        "Use multiple API providers for high availability",
        "Set up monitoring and alerting for API rate limits",
        "Enable telemetry for production insights",
        "Use info-level logging to balance observability and performance",
        "Implement proper API key rotation procedures",
      ],
      createdAt: new Date("2025-01-27"),
      updatedAt: new Date("2025-01-27"),
      compatibleVersions: [">=3.0.0"],
      usageCount: 0,
      rating: 5.0,
    });

    // 3. High-Performance Template
    this.register({
      id: "perf-optimized",
      name: "High-Performance Configuration",
      description: "Maximum throughput configuration for high-load scenarios",
      category: TemplateCategory.PERFORMANCE,
      version: "1.0.0",
      author: "MARIA Team",
      tags: ["performance", "throughput", "speed", "optimization"],
      config: {
        priority: "performance",
        provider: "groq",
        model: "llama-3.1-70b-versatile",
        timeout: 15000,
        maxRetries: 2,
        concurrentRequests: 20,
        cacheEnabled: true,
        logLevel: "warn",
        telemetryEnabled: true,
        localProviders: {
          lmstudio: false,
          ollama: false,
          vllm: true,
        },
        autoStart: true,
        healthMonitoring: true,
        offlineMode: false,
      },
      variables: {
        MAX_CONCURRENT: {
          name: "MAX_CONCURRENT",
          description: "Maximum concurrent requests",
          type: "number",
          required: false,
          defaultValue: 20,
          validation: z.number().min(1).max(50),
          example: "20",
        },
        CACHE_SIZE: {
          name: "CACHE_SIZE",
          description: "Cache size for response caching",
          type: "number",
          required: false,
          defaultValue: 1000,
          validation: z.number().min(100).max(10000),
          example: "1000",
        },
      },
      requirements: [
        {
          type: "api_key",
          name: "High-speed Provider API Key",
          description:
            "API key for a high-performance provider (Groq recommended)",
          optional: false,
        },
        {
          type: "service",
          name: "VLLM Server",
          description: "Local VLLM server for additional throughput",
          optional: true,
          validationCommand: "curl -f http://localhost:8000/health",
        },
      ],
      recommendations: [
        "Use Groq or similar high-speed providers for maximum throughput",
        "Monitor API rate limits closely",
        "Consider local VLLM deployment for additional capacity",
        "Use warn-level logging to reduce overhead",
        "Implement request batching where possible",
      ],
      createdAt: new Date("2025-01-27"),
      updatedAt: new Date("2025-01-27"),
      compatibleVersions: [">=3.0.0"],
      usageCount: 0,
      rating: 4.8,
    });

    // 4. Security-First Template
    this.register({
      id: "security-hardened",
      name: "Security-Hardened Configuration",
      description: "Maximum security configuration for sensitive environments",
      category: TemplateCategory.SECURITY,
      version: "1.0.0",
      author: "MARIA Team",
      tags: ["security", "privacy", "compliance", "enterprise"],
      config: {
        priority: "privacy-first",
        provider: "anthropic",
        model: "claude-3-5-sonnet-20241022",
        timeout: 45000,
        maxRetries: 2,
        concurrentRequests: 3,
        cacheEnabled: false,
        logLevel: "error",
        telemetryEnabled: false,
        localProviders: {
          lmstudio: true,
          ollama: true,
          vllm: false,
        },
        autoStart: false,
        healthMonitoring: true,
        offlineMode: true,
      },
      variables: {
        SECURITY_LEVEL: {
          name: "SECURITY_LEVEL",
          description: "Security enforcement level",
          type: "enum",
          required: false,
          enumValues: ["standard", "high", "maximum"],
          defaultValue: "high",
          example: "maximum",
        },
        AUDIT_MODE: {
          name: "AUDIT_MODE",
          description: "Enable comprehensive audit logging",
          type: "boolean",
          required: false,
          defaultValue: true,
          example: "true",
        },
      },
      requirements: [
        {
          type: "environment_variable",
          name: "SECURITY_AUDIT_ENABLED",
          description: "Security audit logging must be enabled",
          optional: false,
        },
        {
          type: "permission",
          name: "Restricted Network Access",
          description:
            "Network access should be limited to essential services only",
          optional: false,
        },
      ],
      recommendations: [
        "Use local providers when possible to avoid data transmission",
        "Disable telemetry and caching for maximum privacy",
        "Enable comprehensive audit logging",
        "Regularly rotate API keys",
        "Monitor all external API calls",
        "Consider air-gapped deployment for maximum security",
      ],
      createdAt: new Date("2025-01-27"),
      updatedAt: new Date("2025-01-27"),
      compatibleVersions: [">=3.0.0"],
      usageCount: 0,
      rating: 4.9,
    });

    // 5. CI/CD Pipeline Template
    this.register({
      id: "cicd-pipeline",
      name: "CI/CD Pipeline Configuration",
      description: "Optimized for automated testing and deployment pipelines",
      category: TemplateCategory.CI_CD,
      version: "1.0.0",
      author: "MARIA Team",
      tags: ["ci-cd", "automation", "testing", "pipeline"],
      config: {
        priority: "cost-effective",
        provider: "groq",
        model: "mixtral-8x7b-32768",
        timeout: 20000,
        maxRetries: 3,
        concurrentRequests: 8,
        cacheEnabled: true,
        logLevel: "info",
        telemetryEnabled: false,
        localProviders: {
          lmstudio: false,
          ollama: false,
          vllm: false,
        },
        autoStart: true,
        healthMonitoring: false,
        offlineMode: false,
      },
      variables: {
        PIPELINE_ENV: {
          name: "PIPELINE_ENV",
          description: "Pipeline environment type",
          type: "enum",
          required: true,
          enumValues: ["test", "staging", "production"],
          defaultValue: "test",
          example: "staging",
        },
        BUILD_TIMEOUT: {
          name: "BUILD_TIMEOUT",
          description: "Maximum build time in seconds",
          type: "number",
          required: false,
          defaultValue: 1200,
          validation: z.number().min(300).max(3600),
          example: "1200",
        },
      },
      requirements: [
        {
          type: "environment_variable",
          name: "CI_ENVIRONMENT",
          description: "CI environment indicator must be set",
          optional: false,
          validationCommand: 'test -n "$CI_ENVIRONMENT"',
        },
        {
          type: "api_key",
          name: "Cost-Effective Provider Key",
          description: "API key for cost-effective provider",
          optional: false,
        },
      ],
      recommendations: [
        "Use cost-effective providers to minimize CI costs",
        "Enable caching to speed up repeated builds",
        "Set reasonable timeouts for pipeline constraints",
        "Disable telemetry in CI environments",
        "Use environment-specific configurations",
        "Monitor API usage to prevent cost overruns",
      ],
      createdAt: new Date("2025-01-27"),
      updatedAt: new Date("2025-01-27"),
      compatibleVersions: [">=3.0.0"],
      usageCount: 0,
      rating: 4.7,
    });

    // 6. Streaming Optimization Template
    this.register({
      id: "streaming-optimized",
      name: "Streaming-Optimized Configuration",
      description:
        "Real-time streaming code generation with instant feedback and maximum responsiveness",
      category: TemplateCategory.DEVELOPMENT,
      version: "1.0.0",
      author: "MARIA Team",
      tags: ["streaming", "real-time", "performance", "developer-experience"],
      config: {
        priority: "performance",
        provider: "groq",
        model: "llama-3.1-70b-versatile",
        timeout: 25000,
        maxRetries: 2,
        concurrentRequests: 15,
        cacheEnabled: true,
        logLevel: "info",
        telemetryEnabled: true,
        localProviders: {
          lmstudio: true,
          ollama: true,
          vllm: true,
        },
        autoStart: true,
        healthMonitoring: true,
        offlineMode: false,
      },
      variables: {
        STREAMING_ENABLED: {
          name: "STREAMING_ENABLED",
          description: "Enable real-time streaming output",
          type: "boolean",
          required: false,
          defaultValue: true,
          example: "true",
        },
        SHOW_DASHBOARD: {
          name: "SHOW_DASHBOARD",
          description: "Display performance metrics dashboard",
          type: "boolean",
          required: false,
          defaultValue: false,
          example: "false",
        },
        MAX_CONCURRENCY: {
          name: "MAX_CONCURRENCY",
          description: "Maximum parallel operations for multi-file generation",
          type: "number",
          required: false,
          defaultValue: 3,
          validation: z.number().min(1).max(10),
          example: "3",
        },
        THROTTLE_MS: {
          name: "THROTTLE_MS",
          description: "Throttling interval in milliseconds for smooth output",
          type: "number",
          required: false,
          defaultValue: 50,
          validation: z.number().min(16).max(200),
          example: "50",
        },
      },
      requirements: [
        {
          type: "api_key",
          name: "High-Speed Provider API Key",
          description:
            "API key for a high-performance provider (Groq/OpenAI recommended)",
          optional: false,
        },
        {
          type: "service",
          name: "Local Provider (Optional)",
          description: "Optional local provider for offline streaming",
          optional: true,
          validationCommand:
            "curl -f http://localhost:11434/api/tags || curl -f http://localhost:1234/v1/models",
        },
      ],
      recommendations: [
        "Use high-speed providers (Groq, OpenAI GPT-4o) for best streaming experience",
        "Enable real-time dashboard with --dashboard flag for development",
        "Keep throttleMs at 50ms (20 FPS) for smooth visual experience",
        "Use maxConcurrency=3-5 for optimal parallel file generation",
        "Consider local providers for privacy-sensitive streaming operations",
        "Monitor first token latency - should be <500ms for good UX",
      ],
      createdAt: new Date("2025-08-29"),
      updatedAt: new Date("2025-08-29"),
      compatibleVersions: [">=3.6.0"],
      usageCount: 0,
      rating: 5.0,
    });
  }

  // Template management methods
  static register(template: ConfigTemplate): void {
    this.templates.set(template.id, template);
  }

  static registerCustom(template: ConfigTemplate): void {
    this.customTemplates.set(template.id, template);
  }

  static get(templateId: string): ConfigTemplate | undefined {
    return (
      this.templates.get(templateId) || this.customTemplates.get(templateId)
    );
  }

  static list(category?: TemplateCategory): ConfigTemplate[] {
    const allTemplates = [
      ...Array.from(this.templates.values()),
      ...Array.from(this.customTemplates.values()),
    ];

    return category
      ? allTemplates.filter((t) => t.category === category && !t.deprecated)
      : allTemplates.filter((t) => !t.deprecated);
  }

  static search(query: string): ConfigTemplate[] {
    const searchLower = query.toLowerCase();
    const allTemplates = this.list();

    return allTemplates.filter(
      (template) =>
        template.name.toLowerCase().includes(searchLower) ||
        template.description.toLowerCase().includes(searchLower) ||
        template.tags.some((tag) => tag.toLowerCase().includes(searchLower)),
    );
  }

  static getPopular(limit = 5): ConfigTemplate[] {
    return this.list()
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      .slice(0, limit);
  }

  static getByCategory(): Record<TemplateCategory, ConfigTemplate[]> {
    const result = {} as Record<TemplateCategory, ConfigTemplate[]>;

    for (const category of Object.values(TemplateCategory)) {
      result[category] = this.list(category);
    }

    return result;
  }

  static incrementUsage(templateId: string): void {
    const template = this.get(templateId);
    if (template) {
      template.usageCount = (template.usageCount || 0) + 1;
      template.updatedAt = new Date();
    }
  }

  static deprecateTemplate(templateId: string, message?: string): void {
    const template = this.get(templateId);
    if (template) {
      template.deprecated = true;
      template.deprecationMessage =
        message || "This template has been deprecated";
      template.updatedAt = new Date();
    }
  }
}
