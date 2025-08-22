import { BaseCommand } from '../base-command';
import { _Command, _Validate, RateLimit, RequireAuth } from '../decorators';
import { _CommandContext, _CommandResult, CommandOptions } from '../types';
import { z } from 'zod';
import chalk from 'chalk';
import { logger } from '../../utils/logger';
import { FileSystemService } from '../../services/file-system-service';
import { ProjectAnalyzerService } from '../../services/project-analyzer';
import { TemplateManagerService } from '../../services/template-manager';
import { ConfigManagerService } from '../../services/config-manager';
import path from 'path';
import fs from 'fs/promises';

const initSchema = z.object({
  name: z.string().optional(),
  type: z
    .enum(['web', 'api', 'cli', 'library', 'mobile', 'desktop', 'auto'])
    .optional()
    .default('auto'),
  framework: z.string().optional(),
  language: z.string().optional(),
  description: z.string().optional(),
  author: z.string().optional(),
  license: z.string().optional().default('MIT'),
  interactive: z.boolean().optional().default(true),
  force: z.boolean().optional().default(false),
  template: z.string().optional(),
  gitInit: z.boolean().optional().default(true),
});

export type InitOptions = z.infer<typeof initSchema>;

/**
 * Project Initialization Command
 *
 * Features:
 * - Generate .maria-code.toml configuration
 * - Create MARIA.md development guidance
 * - Interactive setup wizard
 * - Project type detection
 * - Template-based initialization
 * - Git repository setup
 * - Dependency analysis
 * - Best practices documentation
 */
@Command({
  name: 'init',
  aliases: ['initialize', 'setup', 'configure'],
  description: 'Initialize MARIA configuration for the project',
  category: 'project',
  priority: 88,
  version: '2.0.0',
})
@RequireAuth({ level: 'basic' })
@RateLimit(10, '1m')
@Validate(initSchema)
export class InitCommand extends BaseCommand<InitOptions> {
  private fileSystem: FileSystemService;
  private projectAnalyzer: ProjectAnalyzerService;
  private templateManager: TemplateManagerService;
  private configManager: ConfigManagerService;

  constructor() {
    super();
    this.fileSystem = new FileSystemService();
    this.projectAnalyzer = new ProjectAnalyzerService();
    this.templateManager = new TemplateManagerService();
    this.configManager = ConfigManagerService.getInstance();
  }

  async execute(
    args: string[],
    options: InitOptions,
    context: CommandContext,
  ): Promise<CommandResult> {
    try {
      this.emit('start', { command: 'init', options });

      const projectPath = context.projectPath || process.cwd();

      // Check if already initialized
      const existingConfig = await this.checkExistingConfig(projectPath);
      if (existingConfig && !options.force) {
        const proceed = await this.promptConfirm(
          'MARIA configuration already exists. Overwrite? (y/n): ',
        );

        if (!proceed) {
          return {
            success: false,
            data: { message: 'Initialization cancelled' },
          };
        }
      }

      // Analyze project
      logger.info(chalk.blue('🔍 Analyzing project structure...'));
      const projectInfo = await this.projectAnalyzer.analyze(projectPath);

      // Collect configuration
      let config: unknown;
      if (options.interactive && !options.template) {
        config = await this.interactiveSetup(projectInfo, options);
      } else if (options.template) {
        config = await this.templateSetup(options.template, projectInfo);
      } else {
        config = this.defaultSetup(projectInfo, options);
      }

      // Generate configuration files
      logger.info(chalk.blue('📝 Generating configuration files...'));

      // Create .maria-code.toml
      const tomlPath = await this.createTomlConfig(projectPath, config);
      logger.info(chalk.green(`✅ Created: ${tomlPath}`));

      // Create MARIA.md
      const mdPath = await this.createMariaMd(projectPath, config, projectInfo);
      logger.info(chalk.green(`✅ Created: ${mdPath}`));

      // Initialize git if requested
      if (options.gitInit && !projectInfo.hasGit) {
        await this.initializeGit(projectPath);
        logger.info(chalk.green('✅ Initialized git repository'));
      }

      // Save to global config
      await this.saveGlobalConfig(config);

      // Display summary
      this.displaySummary(config, projectInfo);

      this.emit('complete', { config });

      return {
        success: true,
        data: {
          config,
          files: {
            toml: tomlPath,
            markdown: mdPath,
          },
          projectInfo,
        },
      };
    } catch (error) {
      this.emit('error', { error });
      logger.error(chalk.red(`Initialization failed: ${error.message}`));
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async checkExistingConfig(projectPath: string): Promise<boolean> {
    const tomlPath = path.join(projectPath, '.maria-code.toml');
    const mdPath = path.join(projectPath, 'MARIA.md');

    try {
      await fs.access(tomlPath);
      return true;
    } catch {
      try {
        await fs.access(mdPath);
        return true;
      } catch {
        return false;
      }
    }
  }

  private async interactiveSetup(projectInfo: unknown, options: InitOptions): Promise<unknown> {
    console.log(chalk.bold.blue('\n🚀 MARIA Project Setup Wizard\n'));

    const config: unknown = {
      project: {},
      ai: {},
      development: {},
      testing: {},
      deployment: {},
    };

    // Project information
    config.project.name = options.name || projectInfo.name || (await this.prompt('Project name: '));
    config.project.type = options.type === 'auto' ? projectInfo.type : options.type;
    config.project.description =
      options.description || (await this.prompt('Project description: '));
    config.project.author = options.author || projectInfo.author || (await this.prompt('Author: '));
    config.project.license = options.license;

    // Detected information
    config.project.language = options.language || projectInfo.language;
    config.project.framework = options.framework || projectInfo.framework;
    config.project.dependencies = projectInfo.dependencies;

    // AI preferences
    console.log(chalk.cyan('\n🤖 AI Configuration:'));
    config.ai.defaultModel = (await this.prompt('Default AI model (gpt-4): ')) || 'gpt-4';
    config.ai.codeStyle = await this.promptChoice('Code style:', ['functional', 'oop', 'mixed']);
    config.ai.testingFramework =
      projectInfo.testFramework || (await this.prompt('Testing framework: '));
    config.ai.documentationStyle = await this.promptChoice('Documentation style:', [
      'jsdoc',
      'tsdoc',
      'minimal',
    ]);

    // Development settings
    console.log(chalk.cyan('\n⚙️  Development Settings:'));
    config.development.autoFormat = await this.promptConfirm('Enable auto-formatting? (y/n): ');
    config.development.linter =
      projectInfo.linter || (await this.prompt('Linter (eslint): ')) || 'eslint';
    config.development.formatter =
      projectInfo.formatter || (await this.prompt('Formatter (prettier): ')) || 'prettier';

    // Testing configuration
    console.log(chalk.cyan('\n🧪 Testing Configuration:'));
    config.testing.coverage = await this.promptConfirm('Enable coverage reporting? (y/n): ');
    config.testing.minCoverage = config.testing.coverage
      ? parseInt((await this.prompt('Minimum coverage % (80): ')) || '80')
      : 0;

    return config;
  }

  private async templateSetup(templateName: string, projectInfo: unknown): Promise<unknown> {
    const template = await this.templateManager.get(templateName);

    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    return {
      ...template.config,
      project: {
        ...template.config.project,
        ...projectInfo,
      },
    };
  }

  private defaultSetup(projectInfo: unknown, options: InitOptions): unknown {
    return {
      project: {
        name: options.name || projectInfo.name || 'unnamed-project',
        type: options.type === 'auto' ? projectInfo.type : options.type,
        description: options.description || '',
        author: options.author || projectInfo.author || '',
        license: options.license,
        language: options.language || projectInfo.language,
        framework: options.framework || projectInfo.framework,
        dependencies: projectInfo.dependencies,
      },
      ai: {
        defaultModel: 'gpt-4',
        codeStyle: 'mixed',
        testingFramework: projectInfo.testFramework || 'jest',
        documentationStyle: 'jsdoc',
      },
      development: {
        autoFormat: true,
        linter: projectInfo.linter || 'eslint',
        formatter: projectInfo.formatter || 'prettier',
      },
      testing: {
        coverage: true,
        minCoverage: 80,
      },
      deployment: {},
    };
  }

  private async createTomlConfig(projectPath: string, config: unknown): Promise<string> {
    const tomlContent = this.generateTomlContent(config);
    const tomlPath = path.join(projectPath, '.maria-code.toml');

    await this.fileSystem.writeFile(tomlPath, tomlContent);
    return tomlPath;
  }

  private generateTomlContent(config: unknown): string {
    const lines: string[] = [
      '# MARIA CODE Configuration',
      '# Generated by MARIA Init Command',
      '',
      '[project]',
      `name = "${config.project.name}"`,
      `type = "${config.project.type}"`,
      `description = "${config.project.description}"`,
      `author = "${config.project.author}"`,
      `license = "${config.project.license}"`,
      `language = "${config.project.language}"`,
      `framework = "${config.project.framework}"`,
      '',
    ];

    if (config.project.dependencies && config.project.dependencies.length > 0) {
      lines.push('dependencies = [');
      config.project.dependencies.forEach((dep: string) => {
        lines.push(`  "${dep}",`);
      });
      lines.push(']');
      lines.push('');
    }

    lines.push('[ai]');
    lines.push(`default_model = "${config.ai.defaultModel}"`);
    lines.push(`code_style = "${config.ai.codeStyle}"`);
    lines.push(`testing_framework = "${config.ai.testingFramework}"`);
    lines.push(`documentation_style = "${config.ai.documentationStyle}"`);
    lines.push('');

    lines.push('[development]');
    lines.push(`auto_format = ${config.development.autoFormat}`);
    lines.push(`linter = "${config.development.linter}"`);
    lines.push(`formatter = "${config.development.formatter}"`);
    lines.push('');

    lines.push('[testing]');
    lines.push(`coverage = ${config.testing.coverage}`);
    lines.push(`min_coverage = ${config.testing.minCoverage}`);
    lines.push('');

    lines.push('[deployment]');
    if (config.deployment.platform) {
      lines.push(`platform = "${config.deployment.platform}"`);
    }

    return lines.join('\n');
  }

  private async createMariaMd(
    projectPath: string,
    config: unknown,
    projectInfo: unknown,
  ): Promise<string> {
    const mdContent = this.generateMariaMdContent(config, projectInfo);
    const mdPath = path.join(projectPath, 'MARIA.md');

    await this.fileSystem.writeFile(mdPath, mdContent);
    return mdPath;
  }

  private generateMariaMdContent(config: unknown, projectInfo: unknown): string {
    const date = new Date().toISOString().split('T')[0];

    return `# MARIA.md - AI Development Guidelines

> This file provides guidance for AI assistants working on this project.
> Generated on ${date} by MARIA CODE

## 📋 Project Overview

**Name:** ${config.project.name}
**Type:** ${config.project.type}
**Description:** ${config.project.description}
**Language:** ${config.project.language}
**Framework:** ${config.project.framework}

## 🎯 Development Goals

1. Maintain high code quality and consistency
2. Follow ${config.ai.codeStyle} programming paradigm
3. Ensure comprehensive test coverage (minimum ${config.testing.minCoverage}%)
4. Document code using ${config.ai.documentationStyle} style

## 🏗️ Architecture

### Technology Stack
- **Language:** ${config.project.language}
- **Framework:** ${config.project.framework}
- **Testing:** ${config.ai.testingFramework}
- **Linting:** ${config.development.linter}
- **Formatting:** ${config.development.formatter}

### Project Structure
\`\`\`
${projectInfo.structure || 'To be documented'}
\`\`\`

## 📝 Coding Standards

### Style Guide
- Follow ${config.ai.codeStyle} programming style
- Use ${config.development.formatter} for code formatting
- Adhere to ${config.development.linter} rules

### Naming Conventions
- Files: ${projectInfo.language === 'typescript' ? 'kebab-case' : 'snake_case'}
- Classes: PascalCase
- Functions: camelCase
- Constants: UPPER_SNAKE_CASE

### Documentation
- Use ${config.ai.documentationStyle} for all public APIs
- Include examples in documentation
- Keep README.md up to date

## 🧪 Testing Requirements

- **Framework:** ${config.ai.testingFramework}
- **Coverage Target:** ${config.testing.minCoverage}%
- **Test Types:**
  - Unit tests for all functions
  - Integration tests for APIs
  - E2E tests for critical paths

## 🤖 AI Assistant Guidelines

### When generating code:
1. Always follow the established patterns in the codebase
2. Include appropriate error handling
3. Write tests alongside implementation
4. Add comprehensive documentation
5. Consider performance implications

### Preferred AI Model: ${config.ai.defaultModel}

### Code Generation Preferences:
- **Style:** ${config.ai.codeStyle}
- **Comments:** Explain complex logic
- **Types:** Use strict typing where applicable
- **Security:** Follow OWASP guidelines

## 🚀 Development Workflow

1. **Before coding:**
   - Understand the requirements
   - Review existing code patterns
   - Plan the implementation

2. **During coding:**
   - Write clean, readable code
   - Include error handling
   - Add logging where appropriate

3. **After coding:**
   - Run tests
   - Check code coverage
   - Update documentation

## 🔧 Common Commands

\`\`\`bash
# Install dependencies
${projectInfo.packageManager || 'npm'} install

# Run tests
${projectInfo.packageManager || 'npm'} test

# Run linter
${projectInfo.packageManager || 'npm'} run lint

# Format code
${projectInfo.packageManager || 'npm'} run format

# Build project
${projectInfo.packageManager || 'npm'} run build
\`\`\`

## 📚 Resources

- [Project Documentation](./docs/)
- [API Reference](./docs/api.md)
- [Contributing Guide](./CONTRIBUTING.md)

## 🐛 Troubleshooting

### Common Issues:
1. **Build failures:** Check Node version and dependencies
2. **Test failures:** Ensure test environment is properly configured
3. **Linting errors:** Run formatter before committing

## 📄 License

This project is licensed under the ${config.project.license} License.

---

*This document is maintained by MARIA CODE and should be updated as the project evolves.*
`;
  }

  private async initializeGit(projectPath: string): Promise<void> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
      await execAsync('git init', { cwd: projectPath });

      // Create .gitignore if it doesn't exist
      const gitignorePath = path.join(projectPath, '.gitignore');
      try {
        await fs.access(gitignorePath);
      } catch {
        const gitignoreContent = [
          'node_modules/',
          'dist/',
          'build/',
          '.env',
          '.env.local',
          '*.log',
          '.DS_Store',
          'coverage/',
          '.maria-cache/',
        ].join('\n');

        await this.fileSystem.writeFile(gitignorePath, gitignoreContent);
      }
    } catch (error) {
      logger.warn(chalk.yellow('Could not initialize git repository'));
    }
  }

  private async saveGlobalConfig(config: unknown): Promise<void> {
    await this.configManager.set('lastProject', {
      name: config.project.name,
      path: process.cwd(),
      type: config.project.type,
    });
  }

  private displaySummary(config: unknown, projectInfo: unknown): void {
    console.log(chalk.bold.green('\n✨ MARIA initialization complete!\n'));

    console.log(chalk.bold('Project Configuration:'));
    console.log(chalk.cyan('  Name:'), config.project.name);
    console.log(chalk.cyan('  Type:'), config.project.type);
    console.log(chalk.cyan('  Language:'), config.project.language);
    console.log(chalk.cyan('  Framework:'), config.project.framework);

    console.log(chalk.bold('\nAI Settings:'));
    console.log(chalk.cyan('  Model:'), config.ai.defaultModel);
    console.log(chalk.cyan('  Style:'), config.ai.codeStyle);

    console.log(chalk.bold('\nFiles Created:'));
    console.log(chalk.green('  ✅ .maria-code.toml - Configuration file'));
    console.log(chalk.green('  ✅ MARIA.md - AI development guidelines'));

    console.log(chalk.gray('\nNext steps:'));
    console.log(chalk.gray('  1. Review and customize MARIA.md'));
    console.log(chalk.gray('  2. Start coding with /code command'));
    console.log(chalk.gray('  3. Generate tests with /test --generate'));
  }

  private async prompt(message: string): Promise<string> {
    // This would be replaced with actual prompt implementation
    return '';
  }

  private async promptConfirm(message: string): Promise<boolean> {
    // This would be replaced with actual prompt implementation
    return true;
  }

  private async promptChoice(message: string, choices: string[]): Promise<string> {
    // This would be replaced with actual prompt implementation
    return choices[0];
  }

  async help(): Promise<string> {
    return `
${chalk.bold.blue('Project Initialization Command')}

${chalk.yellow('Usage:')}
  /init [options]

${chalk.yellow('Options:')}
  --name <name>         Project name
  --type <type>         Project type (web, api, cli, library, mobile, desktop, auto)
  --framework <fw>      Framework name
  --language <lang>     Programming language
  --description <desc>  Project description
  --author <name>       Author name
  --license <type>      License type (default: MIT)
  --interactive         Interactive setup (default: true)
  --force               Overwrite existing config
  --template <name>     Use a template
  --no-git              Skip git initialization

${chalk.yellow('Examples:')}
  /init                                          # Interactive setup
  /init --name my-app --type web                # Quick setup
  /init --template react-typescript             # Template-based
  /init --force                                  # Overwrite existing

${chalk.yellow('Generated Files:')}
  • .maria-code.toml - Project configuration
  • MARIA.md - AI development guidelines

${chalk.yellow('Features:')}
  • Automatic project type detection
  • Interactive configuration wizard
  • Template-based initialization
  • Dependency analysis
  • Git repository setup
  • Best practices documentation
    `;
  }
}
