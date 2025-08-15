/**
 * Template Manager for Command Workflows
 * Save, load, and manage reusable command sequences
 */

import { logger } from '../utils/logger';
// import.*from.*../lib/command-groups';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';

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
    type: 'string' | 'number' | 'boolean' | 'choice';
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
    error?: string;
  }>;
}

export class TemplateManager {
  private static instance: TemplateManager;
  private templates: Map<string, CommandTemplate> = new Map();
  private templatesDir: string;
  private builtInTemplates: Map<string, CommandTemplate> = new Map();

  private constructor() {
    this.templatesDir = join(homedir(), '.maria-code', 'templates');
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
   * Ensure templates directory exists
   */
  private ensureTemplatesDir(): void {
    if (!existsSync(this.templatesDir)) {
      mkdirSync(this.templatesDir, { recursive: true });
    }
  }

  /**
   * Initialize built-in templates
   */
  private initializeBuiltInTemplates(): void {
    const templates: Omit<CommandTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>[] = [
      {
        name: 'Quick Project Setup',
        description: 'Initialize a new project with common setup',
        commands: [
          { command: '/init' },
          { command: '/add-dir', args: ['./src'] },
          { command: '/add-dir', args: ['./tests'] },
          { command: '/memory' },
          { command: '/agents', args: ['list'] },
        ],
        tags: ['setup', 'project', 'quick-start'],
        author: 'MARIA',
        version: '1.0.0',
      },
      {
        name: 'PR Review Workflow',
        description: 'Complete PR review process',
        commands: [
          { command: '/review', args: ['{{pr_number}}'] },
          { command: '/pr-comments', args: ['{{pr_number}}'] },
          { command: '/test', args: ['--type', 'unit'] },
          { command: '/suggest' },
        ],
        parameters: [
          {
            name: 'pr_number',
            description: 'Pull request number',
            type: 'string',
            required: true,
          },
        ],
        tags: ['review', 'pr', 'testing'],
        author: 'MARIA',
        version: '1.0.0',
      },
      {
        name: 'Daily Standup',
        description: 'Prepare daily standup report',
        commands: [
          { command: '/status' },
          { command: '/cost', args: ['--detailed'] },
          { command: '/git', args: ['log', '--oneline', '-10'] },
          { command: '/export', args: ['--format', 'md'] },
        ],
        tags: ['daily', 'standup', 'report'],
        author: 'MARIA',
        version: '1.0.0',
      },
      {
        name: 'Debug & Fix',
        description: 'Debug workflow with error reporting',
        commands: [
          { command: '/doctor' },
          { command: '/status', args: ['--verbose'] },
          {
            command: '/bug',
            args: ['{{description}}'],
            condition: 'hasErrors',
          },
          { command: '/suggest' },
        ],
        parameters: [
          {
            name: 'description',
            description: 'Bug description',
            type: 'string',
            default: 'Found during debugging session',
          },
        ],
        tags: ['debug', 'troubleshooting'],
        author: 'MARIA',
        version: '1.0.0',
      },
      {
        name: 'Deploy Pipeline',
        description: 'Full deployment workflow',
        commands: [
          { command: '/test', args: ['--type', 'all'] },
          { command: '/commit', args: ['--message', '{{message}}'] },
          {
            command: '/deploy',
            args: ['--env', '{{environment}}'],
            condition: 'testsPass',
          },
          { command: '/status', waitFor: 5000 },
        ],
        parameters: [
          {
            name: 'message',
            description: 'Commit message',
            type: 'string',
            required: true,
          },
          {
            name: 'environment',
            description: 'Deployment environment',
            type: 'choice',
            choices: ['staging', 'production'],
            default: 'staging',
            required: true,
          },
        ],
        tags: ['deploy', 'ci/cd', 'pipeline'],
        author: 'MARIA',
        version: '1.0.0',
      },
    ];

    templates.forEach((template, index) => {
      const id = `builtin-${index + 1}`;
      const now = new Date();
      this.builtInTemplates.set(id, {
        ...template,
        id,
        createdAt: now,
        updatedAt: now,
        usageCount: 0,
      });
    });
  }

  /**
   * Load user templates from disk
   */
  private loadUserTemplates(): void {
    try {
      const files = readdirSync(this.templatesDir);

      files.forEach((file: string) => {
        if (file.endsWith('.json')) {
          try {
            const content = readFileSync(join(this.templatesDir, file), 'utf-8');
            const template = JSON.parse(content) as unknown as CommandTemplate;
            template.createdAt = new Date(template.createdAt);
            template.updatedAt = new Date(template.updatedAt);
            this.templates.set(template.id, template);
          } catch (error: unknown) {
            logger.error(`Failed to load template ${file}:`, error);
          }
        }
      });
    } catch {
      logger.debug('No user templates found');
    }
  }

  /**
   * Save a template to disk
   */
  private saveTemplate(template: CommandTemplate): void {
    const filename = `${template.id}.json`;
    const filepath = join(this.templatesDir, filename);
    writeFileSync(filepath, JSON.stringify(template, null, 2));
  }

  /**
   * Create a new template
   */
  async createTemplate(
    name: string,
    description: string,
    commands: CommandTemplate['commands'],
    options?: {
      parameters?: CommandTemplate['parameters'];
      tags?: string[];
      author?: string;
      version?: string;
    },
  ): Promise<{ success: boolean; message: string; template?: CommandTemplate }> {
    // Validate commands
    for (const _cmd of commands) {
      // TODO: Implement command validation
      // const commandInfo = getCommandInfo(cmd.command);
      // if (!commandInfo) {
      //   return {
      //     success: false,
      //     message: `Invalid command: ${cmd.command}`,
      //   };
      // }
    }

    const id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date();

    const template: CommandTemplate = {
      id,
      name,
      description,
      commands,
      parameters: options?.parameters || [],
      tags: options?.tags || [],
      author: options?.author || 'User',
      version: options?.version || '1.0.0',
      createdAt: now,
      updatedAt: now,
      usageCount: 0,
    };

    this.templates.set(id, template);
    this.saveTemplate(template);

    return {
      success: true,
      message: `Template "${name}" created successfully`,
      template,
    };
  }

  /**
   * Update an existing template
   */
  async updateTemplate(
    id: string,
    updates: Partial<Omit<CommandTemplate, 'id' | 'createdAt'>>,
  ): Promise<{ success: boolean; message: string }> {
    const template = this.templates.get(id);
    if (!template) {
      return {
        success: false,
        message: `Template "${id}" not found`,
      };
    }

    if (this.builtInTemplates.has(id)) {
      return {
        success: false,
        message: 'Cannot modify built-in templates',
      };
    }

    Object.assign(template, updates, { updatedAt: new Date() });
    this.saveTemplate(template);

    return {
      success: true,
      message: `Template "${template.name}" updated successfully`,
    };
  }

  /**
   * Delete a template
   */
  async deleteTemplate(id: string): Promise<{ success: boolean; message: string }> {
    if (this.builtInTemplates.has(id)) {
      return {
        success: false,
        message: 'Cannot delete built-in templates',
      };
    }

    const template = this.templates.get(id);
    if (!template) {
      return {
        success: false,
        message: `Template "${id}" not found`,
      };
    }

    this.templates.delete(id);

    try {
      const fs = await import('fs');
      fs.unlinkSync(join(this.templatesDir, `${id}.json`));
    } catch (error: unknown) {
      logger.error('Failed to delete template file:', error);
    }

    return {
      success: true,
      message: `Template "${template.name}" deleted successfully`,
    };
  }

  /**
   * Get a template by ID
   */
  getTemplate(id: string): CommandTemplate | undefined {
    return this.templates.get(id) || this.builtInTemplates.get(id);
  }

  /**
   * List all templates
   */
  listTemplates(options?: { tags?: string[]; author?: string; search?: string }): {
    userTemplates: CommandTemplate[];
    builtInTemplates: CommandTemplate[];
  } {
    let userTemplates = Array.from(this.templates.values());
    let builtInTemplates = Array.from(this.builtInTemplates.values());

    // Apply filters
    if (options?.tags && options.tags.length > 0) {
      const filterByTags = (template: CommandTemplate) =>
        options.tags!.some((tag) => template.tags?.includes(tag));
      userTemplates = userTemplates.filter(filterByTags);
      builtInTemplates = builtInTemplates.filter(filterByTags);
    }

    if (options?.author) {
      const filterByAuthor = (template: CommandTemplate) =>
        template.author?.toLowerCase() === options.author!.toLowerCase();
      userTemplates = userTemplates.filter(filterByAuthor);
      builtInTemplates = builtInTemplates.filter(filterByAuthor);
    }

    if (options?.search) {
      const search = options.search.toLowerCase();
      const filterBySearch = (template: CommandTemplate) =>
        template.name.toLowerCase().includes(search) ||
        template.description.toLowerCase().includes(search) ||
        template.tags?.some((tag) => tag.toLowerCase().includes(search));
      userTemplates = userTemplates.filter(filterBySearch);
      builtInTemplates = builtInTemplates.filter(filterBySearch);
    }

    // Sort by usage count
    userTemplates.sort((a, b) => b.usageCount - a.usageCount);
    builtInTemplates.sort((a, b) => b.usageCount - a.usageCount);

    return { userTemplates, builtInTemplates };
  }

  /**
   * Export templates to JSON
   */
  exportTemplates(ids?: string[]): string {
    const templates = ids
      ? ids.map((id) => this.getTemplate(id)).filter(Boolean)
      : Array.from(this.templates.values());

    return JSON.stringify(
      {
        templates,
        exportedAt: new Date().toISOString(),
        version: '1.0',
      },
      null,
      2,
    );
  }

  /**
   * Import templates from JSON
   */
  async importTemplates(jsonData: string): Promise<{ success: boolean; message: string }> {
    try {
      const data = JSON.parse(jsonData) as Record<string, unknown>;

      if (!data['templates'] || !Array.isArray(data['templates'])) {
        return {
          success: false,
          message: 'Invalid template data format',
        };
      }

      let imported = 0;

      for (const template of data['templates'] as unknown[]) {
        // Generate new ID to avoid conflicts
        const newId = `imported-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        const templateObj = template as Record<string, unknown>;
        const newTemplate: CommandTemplate = {
          name: (templateObj['name'] as string) || 'Imported Template',
          description: (templateObj['description'] as string) || 'Imported template',
          commands: (templateObj['commands'] as CommandTemplate['commands']) || [],
          ...(template as object),
          id: newId,
          createdAt: new Date((templateObj['createdAt'] as string | Date) || new Date()),
          updatedAt: new Date((templateObj['updatedAt'] as string | Date) || new Date()),
          usageCount: 0,
        };

        this.templates.set(newId, newTemplate);
        this.saveTemplate(newTemplate);
        imported++;
      }

      return {
        success: true,
        message: `Imported ${imported} templates`,
      };
    } catch (error: unknown) {
      return {
        success: false,
        message: `Failed to import templates: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Clone a template
   */
  async cloneTemplate(
    id: string,
    newName: string,
  ): Promise<{ success: boolean; message: string; template?: CommandTemplate }> {
    const original = this.getTemplate(id);
    if (!original) {
      return {
        success: false,
        message: `Template "${id}" not found`,
      };
    }

    return this.createTemplate(newName, `Clone of ${original.description}`, original.commands, {
      parameters: original.parameters,
      tags: [...(original.tags || []), 'clone'],
      author: 'User',
      version: '1.0.0',
    });
  }

  /**
   * Increment usage count
   */
  incrementUsageCount(id: string): void {
    const template = this.getTemplate(id);
    if (template) {
      template.usageCount++;
      if (!this.builtInTemplates.has(id)) {
        this.saveTemplate(template);
      }
    }
  }

  /**
   * Get popular templates
   */
  getPopularTemplates(limit = 5): CommandTemplate[] {
    const allTemplates = [
      ...Array.from(this.templates.values()),
      ...Array.from(this.builtInTemplates.values()),
    ];

    return allTemplates
      .filter((t) => t.usageCount > 0)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }

  /**
   * Validate template parameters
   */
  validateParameters(
    template: CommandTemplate,
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
        if (param.type === 'number' && typeof value !== 'number') {
          errors.push(`Parameter ${param.name} must be a number`);
        } else if (param.type === 'boolean' && typeof value !== 'boolean') {
          errors.push(`Parameter ${param.name} must be a boolean`);
        } else if (
          param.type === 'choice' &&
          param.choices &&
          !param.choices.includes(value as string)
        ) {
          errors.push(`Parameter ${param.name} must be one of: ${param.choices.join(', ')}`);
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
  substituteParameters(command: string, parameters: Record<string, unknown>): string {
    let result = command;

    Object.entries(parameters).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder, 'g'), String(value));
    });

    return result;
  }
}
