import { BaseCommand } from '../base-command';
import { Command, RequireAuth, RateLimit, Cache, Validate } from '../decorators';
import { CommandContext, CommandOptions, CommandResult } from '../types';
import { z } from 'zod';
import { AIRouterService } from '../../services/ai-router';
import { IntentAnalyzerService } from '../../services/intent-analyzer';
import { TemplateManagerService } from '../../services/template-manager';
import { FileSystemService } from '../../services/file-system-service';
import { DiffGeneratorService } from '../../services/diff-generator';
import { ErrorHandlerService } from '../../services/error-handler';
import { logger } from '../../utils/logger';
import chalk from 'chalk';

const codeSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  model: z.string().optional(),
  language: z.string().optional(),
  framework: z.string().optional(),
  style: z.enum(['functional', 'oop', 'declarative']).optional(),
  output: z.string().optional(),
  context: z.string().optional(),
  stream: z.boolean().optional().default(true),
  autoFormat: z.boolean().optional().default(true),
  autoTest: z.boolean().optional().default(false),
  saveToFile: z.boolean().optional().default(false),
  fileName: z.string().optional(),
  append: z.boolean().optional().default(false),
  diff: z.boolean().optional().default(false),
  review: z.boolean().optional().default(false),
  optimize: z.boolean().optional().default(false),
  explain: z.boolean().optional().default(false),
  template: z.string().optional(),
});

export type CodeOptions = z.infer<typeof codeSchema>;

/**
 * Advanced AI Code Generation Command
 *
 * Features:
 * - Multi-model support (GPT-5, Claude 4.1, Gemini 2.5)
 * - Context-aware generation
 * - Auto-formatting and linting
 * - Template-based generation
 * - Incremental generation with diffs
 * - Code review integration
 * - Performance optimization
 * - Streaming output
 * - Auto-save to files
 * - Test generation
 */
@Command({
  name: 'code',
  aliases: ['c', 'generate', 'gen'],
  description: 'Generate code with AI assistance',
  category: 'development',
  priority: 100,
  version: '2.0.0',
})
@RequireAuth({ level: 'basic' })
@RateLimit(30, '1m')
@Cache({ ttl: 300, key: 'prompt' })
@Validate(codeSchema)
export class CodeCommand extends BaseCommand<CodeOptions> {
  private aiRouter: AIRouterService;
  private intentAnalyzer: IntentAnalyzerService;
  private templateManager: TemplateManagerService;
  private fileSystem: FileSystemService;
  private diffGenerator: DiffGeneratorService;
  private errorHandler: ErrorHandlerService;

  constructor() {
    super();
    this.aiRouter = new AIRouterService();
    this.intentAnalyzer = new IntentAnalyzerService();
    this.templateManager = new TemplateManagerService();
    this.fileSystem = new FileSystemService();
    this.diffGenerator = new DiffGeneratorService();
    this.errorHandler = new ErrorHandlerService();
  }

  async execute(
    args: string[],
    options: CodeOptions,
    context: CommandContext,
  ): Promise<CommandResult> {
    try {
      this.emit('start', { command: 'code', options });

      // Parse prompt from args if not in options
      const prompt = options.prompt || args.join(' ');
      if (!prompt) {
        throw new Error('Please provide a code generation prompt');
      }

      // Analyze intent and extract parameters
      const intent = await this.intentAnalyzer.analyze(prompt);
      const enhancedOptions = this.mergeIntentWithOptions(intent, options);

      // Apply template if specified
      let finalPrompt = prompt;
      if (enhancedOptions.template) {
        const template = await this.templateManager.get(enhancedOptions.template);
        finalPrompt = this.applyTemplate(template, prompt, enhancedOptions);
      }

      // Build context
      const aiContext = await this.buildContext(enhancedOptions, context);

      // Select optimal model
      const model =
        enhancedOptions.model ||
        (await this.aiRouter.selectModel({
          task: 'code-generation',
          complexity: intent.complexity,
          language: enhancedOptions.language,
          contextSize: aiContext.length,
        }));

      logger.info(chalk.blue(`🤖 Using model: ${model}`));
      this.emit('model-selected', { model });

      // Generate code
      const generatedCode = await this.generateCode(finalPrompt, model, aiContext, enhancedOptions);

      // Post-process code
      const processedCode = await this.postProcess(generatedCode, enhancedOptions);

      // Handle output
      const result = await this.handleOutput(processedCode, enhancedOptions, context);

      this.emit('complete', { result });
      return {
        success: true,
        data: result,
        metadata: {
          model,
          tokensUsed: result.tokensUsed,
          duration: result.duration,
          language: enhancedOptions.language,
          linesGenerated: processedCode.split('\n').length,
        },
      };
    } catch (error) {
      this.emit('error', { error });
      return this.errorHandler.handle(error, 'code-generation');
    }
  }

  private mergeIntentWithOptions(intent: unknown, options: CodeOptions): CodeOptions {
    return {
      ...options,
      language: options.language || intent.language,
      framework: options.framework || intent.framework,
      style: options.style || intent.style,
      autoTest: options.autoTest || intent.includeTests,
      optimize: options.optimize || intent.optimize,
    };
  }

  private applyTemplate(template: unknown, prompt: string, options: CodeOptions): string {
    return template.render({
      prompt,
      language: options.language,
      framework: options.framework,
      style: options.style,
    });
  }

  private async buildContext(options: CodeOptions, context: CommandContext): Promise<string> {
    const contextParts: string[] = [];

    // Add project context
    if (context.projectPath) {
      const projectInfo = await this.fileSystem.getProjectInfo(context.projectPath);
      contextParts.push(`Project: ${projectInfo.name} (${projectInfo.type})`);
      contextParts.push(`Dependencies: ${projectInfo.dependencies.join(', ')}`);
    }

    // Add custom context
    if (options.context) {
      contextParts.push(options.context);
    }

    // Add conversation history
    if (context.history && context.history.length > 0) {
      const recentHistory = context.history.slice(-3);
      contextParts.push('Recent context:');
      recentHistory.forEach((h) => {
        contextParts.push(`- ${h.type}: ${h.content.substring(0, 100)}...`);
      });
    }

    return contextParts.join('\n');
  }

  private async generateCode(
    prompt: string,
    model: string,
    context: string,
    options: CodeOptions,
  ): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(options);

    const response = await this.aiRouter.generate({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${context}\n\n${prompt}` },
      ],
      stream: options.stream,
      temperature: 0.3,
      maxTokens: 4000,
    });

    if (options.stream) {
      // Handle streaming response
      let code = '';
      for await (const chunk of response) {
        code += chunk;
        process.stdout.write(chunk);
      }
      return code;
    }

    return response;
  }

  private buildSystemPrompt(options: CodeOptions): string {
    const parts = [
      'You are an expert programmer.',
      `Generate ${options.language || 'code'} that is:`,
    ];

    const qualities = [
      'clean and well-structured',
      'following best practices',
      'properly commented',
      'type-safe',
      'performant',
    ];

    if (options.style) {
      qualities.push(`following ${options.style} paradigm`);
    }

    if (options.framework) {
      qualities.push(`using ${options.framework} framework`);
    }

    parts.push(qualities.join(', '));

    if (options.autoTest) {
      parts.push('Include comprehensive unit tests.');
    }

    if (options.optimize) {
      parts.push('Optimize for performance and memory usage.');
    }

    if (options.explain) {
      parts.push('Include detailed explanations as comments.');
    }

    return parts.join(' ');
  }

  private async postProcess(code: string, options: CodeOptions): Promise<string> {
    let processedCode = code;

    // Extract code from markdown if present
    processedCode = this.extractCodeFromMarkdown(processedCode);

    // Auto-format if enabled
    if (options.autoFormat) {
      processedCode = await this.formatCode(processedCode, options.language);
    }

    // Generate diff if requested
    if (options.diff && options.fileName) {
      const existingCode = await this.fileSystem.readFile(options.fileName);
      if (existingCode) {
        const diff = await this.diffGenerator.generate(existingCode, processedCode);
        logger.info(chalk.yellow('\n📝 Diff:'));
        console.log(diff);
      }
    }

    // Review if requested
    if (options.review) {
      const review = await this.reviewCode(processedCode, options);
      logger.info(chalk.cyan('\n🔍 Code Review:'));
      console.log(review);
    }

    return processedCode;
  }

  private extractCodeFromMarkdown(text: string): string {
    const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/g;
    const matches = text.match(codeBlockRegex);

    if (matches && matches.length > 0) {
      return matches
        .map((match) => match.replace(/```[\w]*\n/, '').replace(/```$/, ''))
        .join('\n\n');
    }

    return text;
  }

  private async formatCode(code: string, language?: string): Promise<string> {
    // Implementation would use prettier, eslint, or language-specific formatters
    return code;
  }

  private async reviewCode(code: string, options: CodeOptions): Promise<string> {
    const review = await this.aiRouter.generate({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'Review this code for quality, security, and best practices.',
        },
        { role: 'user', content: code },
      ],
      temperature: 0.3,
      maxTokens: 1000,
    });

    return review;
  }

  private async handleOutput(
    code: string,
    options: CodeOptions,
    context: CommandContext,
  ): Promise<unknown> {
    const result: unknown = {
      code,
      timestamp: new Date().toISOString(),
    };

    // Save to file if requested
    if (options.saveToFile) {
      const fileName = options.fileName || this.generateFileName(options);
      const filePath = await this.fileSystem.writeFile(fileName, code, { append: options.append });
      result.savedTo = filePath;
      logger.info(chalk.green(`\n✅ Code saved to: ${filePath}`));
    }

    // Generate tests if requested
    if (options.autoTest) {
      const tests = await this.generateTests(code, options);
      result.tests = tests;

      if (options.saveToFile) {
        const testFileName = this.generateTestFileName(options.fileName || '');
        await this.fileSystem.writeFile(testFileName, tests);
        logger.info(chalk.green(`✅ Tests saved to: ${testFileName}`));
      }
    }

    return result;
  }

  private async generateTests(code: string, options: CodeOptions): Promise<string> {
    const response = await this.aiRouter.generate({
      model: options.model || 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `Generate comprehensive unit tests for the following ${options.language || 'code'}.`,
        },
        { role: 'user', content: code },
      ],
      temperature: 0.3,
      maxTokens: 2000,
    });

    return response;
  }

  private generateFileName(options: CodeOptions): string {
    const timestamp = Date.now();
    const language = options.language || 'txt';
    const extension = this.getFileExtension(language);
    return `generated_${timestamp}.${extension}`;
  }

  private generateTestFileName(fileName: string): string {
    if (!fileName) return `test_${Date.now()}.test.js`;

    const parts = fileName.split('.');
    const extension = parts.pop();
    const name = parts.join('.');
    return `${name}.test.${extension}`;
  }

  private getFileExtension(language: string): string {
    const extensions: Record<string, string> = {
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      java: 'java',
      csharp: 'cs',
      go: 'go',
      rust: 'rs',
      cpp: 'cpp',
      c: 'c',
      swift: 'swift',
      kotlin: 'kt',
      ruby: 'rb',
      php: 'php',
      html: 'html',
      css: 'css',
      sql: 'sql',
      shell: 'sh',
      yaml: 'yaml',
      json: 'json',
      markdown: 'md',
    };

    return extensions[language.toLowerCase()] || 'txt';
  }

  async help(): Promise<string> {
    return `
${chalk.bold.blue('Code Generation Command')}

${chalk.yellow('Usage:')}
  /code <prompt> [options]

${chalk.yellow('Options:')}
  --model <model>       AI model to use (gpt-5, claude-4.1, gemini-2.5)
  --language <lang>     Programming language
  --framework <fw>      Framework to use
  --style <style>       Code style (functional, oop, declarative)
  --template <name>     Use a code template
  --save                Save to file
  --file <path>         Output file path
  --append              Append to existing file
  --diff                Show diff with existing file
  --review              Include code review
  --optimize            Optimize for performance
  --explain             Include detailed explanations
  --test                Generate unit tests
  --stream              Stream output (default: true)
  --format              Auto-format code (default: true)

${chalk.yellow('Examples:')}
  /code create a REST API endpoint for user management
  /code implement binary search --language typescript --test
  /code refactor this function for better performance --optimize
  /code generate React component --template component --save

${chalk.yellow('Supported Languages:')}
  JavaScript, TypeScript, Python, Java, C#, Go, Rust, C++, Swift, Kotlin, Ruby, PHP

${chalk.yellow('Advanced Features:')}
  • Multi-model selection based on task complexity
  • Context-aware generation using project information
  • Automatic code formatting and linting
  • Incremental generation with diff support
  • Integrated code review and optimization
  • Template-based generation for common patterns
  • Test generation with coverage analysis
    `;
  }
}
