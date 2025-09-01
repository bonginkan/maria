/**
 * Template Manager for Command Workflows
 * Save, load, and manage reusable command sequences
 */

import { logger as _logger } from "../utils/logger";
const logger = _logger;
// import.*from.*../lib/command-groups';
import { join } from "path";
import { homedir } from "os";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "fs";

export interface CommandTemplate {
  id: string;
  name: string;
  description: string;
  commands: Array<{
    command: string;
    args?: string[];
    condition?: string; // Optional condition for execution
    waitFor?: number; // Optional wait time in ms
  }>;
  parameters?: Array<{
    name: string;
    description: string;
    type: "string" | "number" | "boolean" | "choice";
    default?: unknown;
    choices?: string[];
    required?: boolean;
  }>;
  tags?: string[];
  author?: string;
  version?: string;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
}

export interface TemplateExecutionContext {
  parameters: Record<string, unknown>;
  variables: Record<string, unknown>;
  results: Array<{
    command: string;
    success: boolean;
    output?: string;
    _error?: string;
  }>;
}

export class TemplateManager {
  private static instance: TemplateManager;
  // Rename to userTemplates to avoid confusion with built-ins
  private userTemplates: Map<string, CommandTemplate> = new Map();
  private templatesDir: string;
  private builtInTemplates: Map<string, CommandTemplate> = new Map();

  private constructor() {
    this.templatesDir = join(homedir(), ".maria-code", "_templates");
    this.ensureTemplatesDir();
    this.initializeBuiltInTemplates();
    this.loadUserTemplates();
  }

  public static getInstance(): TemplateManager {
    if (!TemplateManager.instance) {
      TemplateManager.instance = new TemplateManager();
    }
    return TemplateManager.instance;
  }

  /**
   * Ensure _templates directory exists
   */
  private ensureTemplatesDir(): void {
    if (!existsSync(this.templatesDir)) {
      mkdirSync(this.templatesDir, { recursive: true });
    }
  }

  /**
   * Initialize built-in _templates
   */
  private initializeBuiltInTemplates(): void {
    const _templates: Omit<
      CommandTemplate,
      "id" | "createdAt" | "updatedAt" | "usageCount"
    >[] = [
      {
        name: "Quick Project Setup",
        description: "Initialize a new project with common setup",
        commands: [
          { command: "/init" },
          { command: "/add-dir", args: ["./src"] },
          { command: "/add-dir", args: ["./tests"] },
          { command: "/memory" },
          { command: "/agents", args: ["list"] },
        ],
        tags: ["setup", "project", "quick-start"],
        author: "MARIA",
        version: "1.0.0",
      },
      {
        name: "PR Review Workflow",
        description: "Complete PR review process",
        commands: [
          { command: "/review", args: ["{{pr_number}}"] },
          { command: "/pr-comments", args: ["{{pr_number}}"] },
          { command: "/test", args: ["--type", "unit"] },
          { command: "/suggest" },
        ],
        parameters: [
          {
            name: "pr_number",
            description: "Pull request number",
            type: "string",
            required: true,
          },
        ],
        tags: ["review", "pr", "testing"],
        author: "MARIA",
        version: "1.0.0",
      },
      {
        name: "Daily Standup",
        description: "Prepare daily standup report",
        commands: [
          { command: "/status" },
          { command: "/cost", args: ["--detailed"] },
          { command: "/git", args: ["log", "--oneline", "-10"] },
          { command: "/export", args: ["--format", "md"] },
        ],
        tags: ["daily", "standup", "report"],
        author: "MARIA",
        version: "1.0.0",
      },
      {
        name: "Debug & Fix",
        description: "Debug workflow with _error reporting",
        commands: [
          { command: "/doctor" },
          { command: "/status", args: ["--verbose"] },
          {
            command: "/bug",
            args: ["{{description}}"],
            condition: "hasErrors",
          },
          { command: "/suggest" },
        ],
        parameters: [
          {
            name: "description",
            description: "Bug description",
            type: "string",
            default: "Found during debugging session",
          },
        ],
        tags: ["debug", "troubleshooting"],
        author: "MARIA",
        version: "1.0.0",
      },
      {
        name: "Deploy Pipeline",
        description: "Full deployment workflow",
        commands: [
          { command: "/test", args: ["--type", "all"] },
          { command: "/commit", args: ["--message", "{{message}}"] },
          {
            command: "/deploy",
            args: ["--env", "{{environment}}"],
            condition: "testsPass",
          },
          { command: "/status", waitFor: 5000 },
        ],
        parameters: [
          {
            name: "message",
            description: "Commit message",
            type: "string",
            required: true,
          },
          {
            name: "environment",
            description: "Deployment environment",
            type: "choice",
            choices: ["staging", "production"],
            default: "staging",
            required: true,
          },
        ],
        tags: ["deploy", "ci/cd", "pipeline"],
        author: "MARIA",
        version: "1.0.0",
      },
    ];

    _templates.forEach((_template, index) => {
      const id = `builtin-${index + 1}`;
      const _now = new Date();
      this.builtInTemplates.set(id, {
        ..._template,
        id,
        createdAt: _now,
        updatedAt: _now,
        usageCount: 0,
      });
    });
  }

  /**
   * Load user _templates from disk
   */
  private loadUserTemplates(): void {
    try {
      const files = readdirSync(this.templatesDir);

      files.forEach((file: string) => {
        if (file.endsWith(".json")) {
          try {
            const content = readFileSync(
              join(this.templatesDir, file),
              "utf-8",
            );
            const t = JSON.parse(content) as CommandTemplate;
            // Revive dates
            t.createdAt = new Date(t.createdAt);
            t.updatedAt = new Date(t.updatedAt);
            this.userTemplates.set(t.id, t);
          } catch (_error: unknown) {
            logger.error(`Failed to load _template ${file}:`, _error);
          }
        }
      });
    } catch {
      logger.debug("No user _templates found");
    }
  }

  /**
   * Save a _template to disk
   */
  private saveTemplate(_template: CommandTemplate): void {
    const _filename = `${template.id}.json`;
    const _filepath = join(this.templatesDir, _filename);
    writeFileSync(_filepath, JSON.stringify(_template, null, 2));
  }

  /**
   * Create a new _template
   */
  async createTemplate(
    name: string,
    description: string,
    commands: CommandTemplate["commands"],
    options?: {
      parameters?: CommandTemplate["parameters"];
      tags?: string[];
      author?: string;
      version?: string;
    },
  ): Promise<{
    success: boolean;
    message: string;
    _template?: CommandTemplate;
  }> {
    // Validate commands
    for (const _cmd of commands) {
      // TODO: Implement command validation
      // const _commandInfo = getCommandInfo(cmd.command);
      // if (!commandInfo) {
      //   return {
      //     success: false,
      //     message: `Invalid command: ${cmd.command}`,
      //   };
      // }
    }

    const id = `user-${Date._now()}-${Math.random().toString(36).substring(2, 9)}`;
    const _now = new Date();

    const _template: CommandTemplate = {
      id,
      name,
      description,
      commands,
      parameters: options?.parameters || [],
      tags: options?.tags || [],
      author: options?.author || "User",
      version: options?.version || "1.0.0",
      createdAt: _now,
      updatedAt: _now,
      usageCount: 0,
    };

    this.userTemplates.set(id, _template);
    this.saveTemplate(_template);

    return {
      success: true,
      message: `Template "${_template.name}" created successfully`,
      _template,
    };
  }

  /**
   * Update an existing _template
   */
  async updateTemplate(
    id: string,
    updates: Partial<Omit<CommandTemplate, "id" | "createdAt">>,
  ): Promise<{ success: boolean; message: string }> {
    const t = this.userTemplates.get(id);
    if (!t) {
      return {
        success: false,
        message: `Template "${id}" not found`,
      };
    }

    if (this.builtInTemplates.has(id)) {
      return {
        success: false,
        message: "Cannot modify built-in _templates",
      };
    }

    Object.assign(t, updates, { updatedAt: new Date() });
    this.saveTemplate(t);

    return {
      success: true,
      message: `Template "${t.name}" updated successfully`,
    };
  }

  /**
   * Delete a _template
   */
  async deleteTemplate(
    id: string,
  ): Promise<{ success: boolean; message: string }> {
    if (this.builtInTemplates.has(id)) {
      return {
        success: false,
        message: "Cannot delete built-in _templates",
      };
    }

    const t = this.userTemplates.get(id);
    if (!t) {
      return {
        success: false,
        message: `Template "${id}" not found`,
      };
    }

    this.userTemplates.delete(id);

    try {
      const fs = await import("fs");
      fs.unlinkSync(join(this.templatesDir, `${id}.json`));
    } catch (_error: unknown) {
      logger.error("Failed to delete _template file:", _error);
    }

    return {
      success: true,
      message: `Template "${t.name}" deleted successfully`,
    };
  }

  /**
   * Get a _template by ID
   */
  getTemplate(id: string): CommandTemplate | undefined {
    return this.userTemplates.get(id) || this.builtInTemplates.get(id);
  }

  /**
   * List all _templates
   */
  listTemplates(options?: {
    tags?: string[];
    author?: string;
    _search?: string;
  }): {
    userTemplates: CommandTemplate[];
    builtInTemplates: CommandTemplate[];
  } {
    let userTemplatesList = Array.from(this.userTemplates.values());
    let builtInTemplatesList = Array.from(this.builtInTemplates.values());

    // Apply filters
    if (options?.tags && options.tags.length > 0) {
      const filterByTags = (t: CommandTemplate) =>
        options.tags!.some((tag) => t.tags?.includes(tag));
      userTemplatesList = userTemplatesList.filter(filterByTags);
      builtInTemplatesList = builtInTemplatesList.filter(filterByTags);
    }

    if (options?.author) {
      const filterByAuthor = (t: CommandTemplate) =>
        (t.author ?? "").toLowerCase() === options.author!.toLowerCase();
      userTemplatesList = userTemplatesList.filter(filterByAuthor);
      builtInTemplatesList = builtInTemplatesList.filter(filterByAuthor);
    }

    const search = (options as any)?.search ?? (options as any)?._search;
    if (typeof search === "string" && search.length > 0) {
      const q = search.toLowerCase();
      const filterBySearch = (t: CommandTemplate) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags?.some((tag) => tag.toLowerCase().includes(q));
      userTemplatesList = userTemplatesList.filter(filterBySearch);
      builtInTemplatesList = builtInTemplatesList.filter(filterBySearch);
    }

    // Sort by usage count
    userTemplatesList.sort((a, b) => b.usageCount - a.usageCount);
    builtInTemplatesList.sort((a, b) => b.usageCount - a.usageCount);

    return {
      userTemplates: userTemplatesList,
      builtInTemplates: builtInTemplatesList,
    };
  }

  /**
   * Export _templates to JSON
   */
  exportTemplates(ids?: string[]): string {
    const selected = ids
      ? (ids
          .map((id) => this.getTemplate(id))
          .filter(Boolean) as CommandTemplate[])
      : Array.from(this.userTemplates.values());

    return JSON.stringify(
      {
        _templates: selected,
        exportedAt: new Date().toISOString(),
        version: "1.0",
      },
      null,
      2,
    );
  }

  /**
   * Import _templates from JSON
   */
  async importTemplates(
    jsonData: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const _data = JSON.parse(jsonData) as Record<string, unknown>;

      if (!_data["_templates"] || !Array.isArray(_data["_templates"])) {
        return {
          success: false,
          message: "Invalid _template _data format",
        };
      }

      let imported = 0;

      for (const _template of _data["_templates"] as unknown[]) {
        // Generate new ID to avoid conflicts
        const _newId = `imported-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        const _templateObj = _template as Record<string, unknown>;
        const newTemplate: CommandTemplate = {
          name: String(_templateObj["name"] ?? "Imported Template"),
          description: String(
            _templateObj["description"] ?? "Imported _template",
          ),
          commands: Array.isArray(_templateObj["commands"])
            ? (_templateObj["commands"] as CommandTemplate["commands"])
            : [],
          ...(typeof _template === "object" ? _template : Record<string, any>),
          id: _newId,
          createdAt: new Date((_templateObj["createdAt"] as any) ?? new Date()),
          updatedAt: new Date((_templateObj["updatedAt"] as any) ?? new Date()),
          usageCount: 0,
        };

        this.userTemplates.set(_newId, newTemplate);
        this.saveTemplate(newTemplate);
        imported++;
      }

      return {
        success: true,
        message: `Imported ${imported} _templates`,
      };
    } catch (_error: unknown) {
      return {
        success: false,
        message: `Failed to import _templates: ${_error instanceof Error ? _error.message : "Unknown _error"}`,
      };
    }
  }

  /**
   * Clone a _template
   */
  async cloneTemplate(
    id: string,
    newName: string,
  ): Promise<{
    success: boolean;
    message: string;
    _template?: CommandTemplate;
  }> {
    const original = this.getTemplate(id);
    if (!original) {
      return {
        success: false,
        message: `Template "${id}" not found`,
      };
    }

    return this.createTemplate(
      newName,
      `Clone of ${original.description}`,
      original.commands,
      {
        parameters: original.parameters ?? [],
        tags: [...(original.tags ?? []), "clone"],
        author: "User",
        version: "1.0.0",
      },
    );
  }

  /**
   * Increment usage count
   */
  incrementUsageCount(id: string): void {
    const t = this.getTemplate(id);
    if (!t) return;
    t.usageCount++;
    // Persist only user _template
    if (this.userTemplates.has(id)) {
      this.saveTemplate(t);
    }
  }

  /**
   * Get popular _templates
   */
  getPopularTemplates(limit = 5): CommandTemplate[] {
    const _allTemplates = [
      ...Array.from(this.userTemplates.values()),
      ...Array.from(this.builtInTemplates.values()),
    ];

    return _allTemplates
      .filter((t) => t.usageCount > 0)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }

  /**
   * Validate _template parameters
   */
  validateParameters(
    _template: CommandTemplate,
    providedParams: Record<string, unknown>,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    template.parameters?.forEach((param) => {
      const value = providedParams[param.name];

      if (param.required && value === undefined) {
        errors.push(`Missing required parameter: ${param.name}`);
        return;
      }

      if (value !== undefined) {
        // Type validation
        if (param.type === "number" && typeof value !== "number") {
          errors.push(`Parameter ${param.name} must be a number`);
        } else if (param.type === "boolean" && typeof value !== "boolean") {
          errors.push(`Parameter ${param.name} must be a boolean`);
        } else if (
          param.type === "choice" &&
          param.choices &&
          !param.choices.includes(value as string)
        ) {
          errors.push(
            `Parameter ${param.name} must be one of: ${param.choices.join(", ")}`,
          );
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Substitute parameters in command
   */
  substituteParameters(
    commandStr: string,
    parameters: Record<string, unknown>,
  ): string {
    let result = commandStr;

    Object.entries(parameters).forEach(([key, _value]) => {
      const _placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(_placeholder, "g"), String(_value));
    });

    return result;
  }
}
