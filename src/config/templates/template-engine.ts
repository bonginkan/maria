/**
 * Configuration Template Engine - Phase 3
 * Template processing, variable substitution, and validation
 */

import { z } from "zod";
import {
  ValidatedConfig,
  ConfigManager,
  ConfigValidationError,
} from "../config-manager";
import {
  ConfigTemplate,
  TemplateVariable,
  TemplateRequirement,
  ConfigTemplateRegistry,
} from "./config-templates";

export interface TemplateApplicationOptions {
  variables?: Record<string, unknown>;
  skipValidation?: boolean;
  skipRequirements?: boolean;
  dryRun?: boolean;
  overrides?: Partial<ValidatedConfig>;
}

export interface TemplateApplicationResult {
  success: boolean;
  config?: ValidatedConfig;
  errors: string[];
  warnings: string[];
  appliedVariables: Record<string, unknown>;
  unmetRequirements: TemplateRequirement[];
  preview?: string;
}

export interface RequirementValidationResult {
  requirement: TemplateRequirement;
  met: boolean;
  error?: string;
  details?: unknown;
}

export class ConfigTemplateEngine {
  constructor() {
    // Constructor implementation
  }

  /**
   * Apply a template to create a new configuration
   */
  async applyTemplate(
    templateId: string,
    options: TemplateApplicationOptions = {},
  ): Promise<TemplateApplicationResult> {
    const result: TemplateApplicationResult = {
      success: false,
      errors: [],
      warnings: [],
      appliedVariables: Record<string, any>,
      unmetRequirements: [],
    };

    try {
      // Get template
      const template = ConfigTemplateRegistry.get(templateId);
      if (!template) {
        result.errors.push(`Template not found: ${templateId}`);
        return result;
      }

      if (template.deprecated) {
        result.warnings.push(
          `Template "${template.name}" is deprecated: ${template.deprecationMessage || "No reason provided"}`,
        );
        if (!options.skipValidation) {
          result.errors.push(
            "Cannot apply deprecated template without skipValidation=true",
          );
          return result;
        }
      }

      // Validate requirements
      if (!options.skipRequirements) {
        const requirementResults = await this.validateRequirements(template);
        const unmetRequired = requirementResults
          .filter((r) => !r.met && !r.requirement.optional)
          .map((r) => r.requirement);

        if (unmetRequired.length > 0) {
          result.unmetRequirements = unmetRequired;
          result.errors.push(
            `Unmet requirements: ${unmetRequired.map((r) => r.name).join(", ")}`,
          );
          return result;
        }

        // Add warnings for unmet optional requirements
        const unmetOptional = requirementResults
          .filter((r) => !r.met && r.requirement.optional)
          .map((r) => r.requirement);

        for (const req of unmetOptional) {
          result.warnings.push(
            `Optional requirement not met: ${req.name} - ${req.description}`,
          );
        }
      }

      // Process template variables
      const processedConfig = await this.processTemplateVariables(
        template,
        options.variables || object,
      );

      result.appliedVariables = options.variables || object;

      // Apply overrides
      let finalConfig = processedConfig;
      if (options.overrides) {
        finalConfig = this.deepMerge(processedConfig, options.overrides);
        result.warnings.push("Configuration overrides applied");
      }

      // Create preview if dry run
      if (options.dryRun) {
        result.preview = this.generateConfigPreview(finalConfig, template);
      }

      // Validate final configuration
      if (!options.skipValidation) {
        try {
          // Use ConfigManager to validate the final configuration
          const tempManager = new ConfigManager(
            finalConfig as any,
            "template",
          );
          result.config = tempManager.getAll() as ValidatedConfig;
        } catch (error) {
          if (error instanceof ConfigValidationError) {
            result.errors.push(
              `Configuration validation failed: ${error.message}`,
            );
            if (error.suggestion) {
              result.warnings.push(`Suggestion: ${error.suggestion}`);
            }
          } else {
            result.errors.push(
              `Unexpected validation error: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
          return result;
        }
      } else {
        result.config = finalConfig as ValidatedConfig;
      }

      // Increment usage counter
      ConfigTemplateRegistry.incrementUsage(templateId);

      result.success = true;
      return result;
    } catch (innerError) {
      result.errors.push(
        `Template application failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return result;
    }
  }

  /**
   * Process template variables with substitution and validation
   */
  private async processTemplateVariables(
    template: ConfigTemplate,
    userVariables: Record<string, unknown>,
  ): Promise<Partial<ValidatedConfig>> {
    const processedConfig = JSON.parse(JSON.stringify(template.config));

    // If no variables defined, return config as-is
    if (!template.variables) {
      return processedConfig;
    }

    // Process each defined variable
    for (const [varName, varDef] of Object.entries(template.variables)) {
      const userValue = userVariables[varName];
      let finalValue: unknown;

      // Determine final value (user provided or default)
      if (userValue !== undefined) {
        // Validate user-provided value
        try {
          finalValue = this.validateVariableValue(varDef, userValue);
        } catch (error) {
          throw new Error(
            `Invalid value for variable "${varName}": ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      } else if (varDef.required) {
        throw new Error(`Required variable "${varName}" not provided`);
      } else {
        finalValue = varDef.defaultValue;
      }

      // Apply variable substitution in configuration
      if (finalValue !== undefined) {
        this.substituteVariableInConfig(processedConfig, varName, finalValue);
      }
    }

    return processedConfig;
  }

  /**
   * Validate a variable value against its definition
   */
  private validateVariableValue(
    varDef: TemplateVariable,
    value: unknown,
  ): unknown {
    // Type validation
    switch (varDef.type) {
      case "string":
        if (typeof value !== "string") {
          throw new Error(`Expected string, got ${typeof value}`);
        }
        break;
      case "number":
        if (typeof value !== "number" || isNaN(value)) {
          throw new Error(`Expected number, got ${typeof value}`);
        }
        break;
      case "boolean":
        if (typeof value !== "boolean") {
          throw new Error(`Expected boolean, got ${typeof value}`);
        }
        break;
      case "enum":
        if (!varDef.enumValues?.includes(String(value))) {
          throw new Error(
            `Value must be one of: ${varDef.enumValues?.join(", ")}, got: ${value}`,
          );
        }
        break;
    }

    // Custom Zod validation if provided
    if (varDef.validation) {
      try {
        return varDef.validation.parse(value);
      } catch (innerError) {
        if (error instanceof z.ZodError) {
          throw new Error(
            `Validation failed: ${error.errors[0]?.message || "Unknown error"}`,
          );
        }
        throw error;
      }
    }

    return value;
  }

  /**
   * Substitute variables in configuration object
   */
  private substituteVariableInConfig(
    config: any,
    varName: string,
    value: unknown,
  ): void {
    const placeholder = `{{${varName}}}`;

    const substitute = (obj: any): void => {
      for (const [key, val] of Object.entries(obj)) {
        if (typeof val === "string" && val.includes(placeholder)) {
          obj[key] = val.replace(
            new RegExp(`{{${varName}}}`, "g"),
            String(value),
          );
        } else if (typeof val === "object" && val !== null) {
          substitute(val);
        }
      }
    };

    substitute(config);

    // Also handle direct variable references in config
    // For example, if a config field is exactly the variable name, replace it
    const applyDirectSubstitution = (obj: any): void => {
      for (const [key, val] of Object.entries(obj)) {
        if (val === `$${varName}` || val === `\${${varName}}`) {
          obj[key] = value;
        } else if (typeof val === "object" && val !== null) {
          applyDirectSubstitution(val);
        }
      }
    };

    applyDirectSubstitution(config);
  }

  /**
   * Validate template requirements
   */
  private async validateRequirements(
    template: ConfigTemplate,
  ): Promise<RequirementValidationResult[]> {
    const results: RequirementValidationResult[] = [];

    if (!template.requirements) {
      return results;
    }

    for (const requirement of template.requirements) {
      const result: RequirementValidationResult = {
        requirement,
        met: false,
      };

      try {
        switch (requirement.type) {
          case "environment_variable":
            result.met = !!process.env[requirement.name];
            result.details = process.env[requirement.name];
            break;

          case "api_key": {
            // Check for API key in environment
            const apiKeyEnvNames = [
              requirement.name.toUpperCase(),
              requirement.name.toUpperCase().replace(/\s+/g, "_"),
              `${requirement.name.toUpperCase()}_API_KEY`,
              `API_KEY_${requirement.name.toUpperCase()}`,
            ];

            result.met = apiKeyEnvNames.some((name) => !!process.env[name]);
            result.details = apiKeyEnvNames.find((name) => process.env[name]);
            break;
          }

          case "service":
            // Check service availability using validation command
            if (requirement.validationCommand) {
              try {
                const { exec } = await import("child_process");
                const { promisify } = await import("util");
                const execAsync = promisify(exec);

                await execAsync(requirement.validationCommand);
                result.met = true;
              } catch (error) {
                result.met = false;
                result.error =
                  error instanceof Error ? error.message : String(error);
              }
            } else {
              result.met = false;
              result.error =
                "No validation command provided for service requirement";
            }
            break;

          case "permission":
            // Permission validation would need custom logic based on system
            // For now, we'll assume permissions are met if not explicitly checked
            result.met = true;
            result.details =
              "Permission validation not implemented - assuming met";
            break;

          default:
            result.met = false;
            result.error = `Unknown requirement type: ${requirement.type}`;
        }
      } catch (innerError) {
        result.met = false;
        result.error = error instanceof Error ? error.message : String(error);
      }

      results.push(result);
    }

    return results;
  }

  /**
   * Generate a configuration preview
   */
  private generateConfigPreview(
    config: Partial<ValidatedConfig>,
    template: ConfigTemplate,
  ): string {
    const preview = [
      `# Configuration Preview: ${template.name}`,
      `# Description: ${template.description}`,
      `# Category: ${template.category}`,
      `# Version: ${template.version}`,
      "",
      "## Generated Configuration:",
      JSON.stringify(config, null, 2),
      "",
      "## Template Recommendations:",
      ...(template.recommendations || []).map((rec) => `- ${rec}`),
    ];

    return preview.join("\n");
  }

  /**
   * Deep merge two objects
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
   * Create a new template from existing configuration
   */
  static createTemplateFromConfig(
    config: Partial<ValidatedConfig>,
    metadata: {
      id: string;
      name: string;
      description: string;
      category: string;
      author?: string;
      tags?: string[];
    },
  ): ConfigTemplate {
    const template: ConfigTemplate = {
      id: metadata.id,
      name: metadata.name,
      description: metadata.description,
      category: metadata.category as any,
      version: "1.0.0",
      author: metadata.author || "Custom",
      tags: metadata.tags || [],
      config,
      createdAt: new Date(),
      updatedAt: new Date(),
      compatibleVersions: [">=3.0.0"],
      usageCount: 0,
    };

    return template;
  }

  /**
   * Validate template compatibility with current system
   */
  static validateTemplateCompatibility(template: ConfigTemplate): {
    compatible: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check version compatibility (simplified)
    const currentVersion = "3.0.3";
    if (template.compatibleVersions.length > 0) {
      const hasCompatibleVersion = template.compatibleVersions.some(
        (version) => {
          // Simple compatibility check (in real implementation, use semver)
          return version.includes(currentVersion.split(".")[0]);
        },
      );

      if (!hasCompatibleVersion) {
        issues.push(
          `Template requires versions: ${template.compatibleVersions.join(", ")}, current: ${currentVersion}`,
        );
      }
    }

    // Check for deprecated status
    if (template.deprecated) {
      issues.push(
        `Template is deprecated: ${template.deprecationMessage || "No reason provided"}`,
      );
    }

    return {
      compatible: issues.length === 0,
      issues,
    };
  }
}
