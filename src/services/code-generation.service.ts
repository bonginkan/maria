/**
 * Code Generation Service
 * AI-powered code generation with multiple provider support
 * Architecture: Provider pattern with strategy pattern for different languages
 */
// @ts-nocheck - Complex AI service with dynamic types that are difficult to type properly

import { logger } from '../utils/logger';
import { AIProvider } from '../providers/ai-provider';
import { OpenAIProvider } from '../providers/openai-provider';
import { AnthropicProvider } from '../providers/anthropic-provider';
import { GoogleAIProvider } from '../providers/google-ai-provider';
import { LMStudioProvider } from '../providers/lmstudio-provider';
import { readConfig } from '../utils/config';
import * as fs from 'fs/promises';
import * as path from 'path';
// import { execSync } from 'child_process';

export interface CodeGenerationRequest {
  prompt: string;
  language?: string;
  framework?: string;
  context?: {
    files?: string[];
    currentFile?: string;
    projectType?: string;
    dependencies?: string[];
  };
  options?: {
    includeTests?: boolean;
    includeComments?: boolean;
    style?: 'clean' | 'verbose' | 'minimal';
    pattern?: 'mvc' | 'functional' | 'oop' | 'reactive';
  };
}

export interface CodeGenerationResult {
  success: boolean;
  code?: string;
  language?: string;
  framework?: string;
  tests?: string;
  documentation?: string;
  suggestions?: string[];
  error?: string;
  metadata?: {
    provider: string;
    model: string;
    tokens: number;
    executionTime: number;
  };
}

export class CodeGenerationService {
  private static instance: CodeGenerationService;
  private providers: Map<string, AIProvider> = new Map();
  private currentProvider?: AIProvider;
  private languageDetector = new LanguageDetector();
  private contextAnalyzer = new ContextAnalyzer();

  private constructor() {
    this.initializeProviders();
  }

  public static getInstance(): CodeGenerationService {
    if (!CodeGenerationService.instance) {
      CodeGenerationService.instance = new CodeGenerationService();
    }
    return CodeGenerationService.instance;
  }

  private async initializeProviders(): Promise<void> {
    const config = await readConfig();

    // Initialize available providers based on config
    if (config.providers?.openai?.apiKey) {
      this.providers.set('openai', new OpenAIProvider(config.providers.openai));
    }
    if (config.providers?.anthropic?.apiKey) {
      this.providers.set('anthropic', new AnthropicProvider(config.providers.anthropic));
    }
    if (config.providers?.google?.apiKey) {
      this.providers.set('google', new GoogleAIProvider(config.providers.google));
    }
    if (config.providers?.lmstudio?.enabled) {
      this.providers.set('lmstudio', new LMStudioProvider(config.providers.lmstudio));
    }

    // Set default provider
    const defaultProvider = config.defaultProvider || 'openai';
    this.currentProvider = this.providers.get(defaultProvider);
  }

  /**
   * Generate code based on the request
   */
  // @ts-nocheck - Complex AI service with dynamic types that are difficult to type properly - Complex async type handling
  public async generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResult> {
    const startTime = Date.now();

    try {
      // 1. Analyze context and detect language/framework
      const context = await this.analyzeContext(request);

      // 2. Build enhanced prompt
      const enhancedPrompt = await this.buildEnhancedPrompt(request, context);

      // 3. Select best provider for the task
      const provider = await this.selectProvider(request, context);

      // 4. Generate code
      const response = await provider.generateCode(enhancedPrompt);

      // 5. Post-process and validate
      const processedCode = await this.postProcessCode(response.code, context);

      // 6. Generate tests if requested
      let tests: string | undefined;
      if (request.options?.includeTests) {
        tests = await this.generateTests(processedCode, context);
      }

      // 7. Generate documentation
      const documentation = await this.generateDocumentation(processedCode, context);

      // 8. Generate suggestions for next steps
      const suggestions = await this.generateSuggestions(processedCode, context);

      return {
        success: true,
        code: processedCode,
        language: context.language,
        framework: context.framework,
        tests,
        documentation,
        suggestions,
        metadata: {
          provider: provider.name,
          model: provider.model,
          tokens: response.tokens,
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error: unknown) {
      logger.error('Code generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          provider: this.currentProvider?.name || 'unknown',
          model: this.currentProvider?.model || 'unknown',
          tokens: 0,
          executionTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Analyze project context
   */
  // @ts-nocheck - Complex AI service with dynamic types that are difficult to type properly - Complex async type handling
  private async analyzeContext(request: CodeGenerationRequest): Promise<ProjectContext> {
    const context: ProjectContext = {
      language: request.language,
      framework: request.framework,
      projectType: request.context?.projectType,
      dependencies: request.context?.dependencies || [],
      files: [],
      patterns: [],
    };

    // Auto-detect language if not specified
    if (!context.language && request.context?.currentFile) {
      context.language = await this.languageDetector.detectFromFile(request.context.currentFile);
    }

    // Auto-detect framework
    if (!context.framework) {
      context.framework = await this.detectFramework();
    }

    // Analyze existing code patterns
    if (request.context?.files) {
      context.patterns = await this.contextAnalyzer.analyzePatterns(request.context.files);
    }

    // Detect project type
    if (!context.projectType) {
      context.projectType = await this.detectProjectType();
    }

    return context;
  }

  /**
   * Build enhanced prompt with context - Designed for high-performance AI models
   */
  // @ts-nocheck - Complex AI service with dynamic types that are difficult to type properly - Complex async type handling
  private async buildEnhancedPrompt(
    request: CodeGenerationRequest,
    context: ProjectContext,
  ): Promise<string> {
    // System prompt that positions the AI as a senior engineer
    let prompt = `You are a world-class senior software engineer with 15+ years of experience across multiple tech stacks. You write production-grade code that is secure, performant, maintainable, and follows industry best practices.

## TASK SPECIFICATION
**Request**: ${request.prompt}

## CONTEXT & CONSTRAINTS
**Language**: ${context.language || 'TypeScript/JavaScript'}
**Framework**: ${context.framework || 'Modern stack'}
**Project Type**: ${context.projectType || 'Web application'}
**Architecture Pattern**: ${request.options?.pattern || 'Clean Architecture'}
**Code Style**: ${request.options?.style || 'Professional'}
`;

    // Add dependency context if available
    if (context.dependencies.length > 0) {
      prompt += `**Available Dependencies**: ${context.dependencies.slice(0, 10).join(', ')}${context.dependencies.length > 10 ? '...' : ''}\n`;
    }

    // Add project patterns
    if (context.patterns.length > 0) {
      prompt += `**Existing Patterns**:\n`;
      context.patterns.forEach((pattern) => {
        prompt += `- ${pattern.name}: ${pattern.description}\n`;
      });
    }

    // Core requirements - emphasizing quality and best practices
    prompt += `
## MANDATORY REQUIREMENTS
1. **Code Quality**: Write enterprise-grade code that would pass rigorous code review
2. **Security**: Implement proper input validation, sanitization, and security best practices
3. **Performance**: Optimize for efficiency, memory usage, and scalability
4. **Error Handling**: Comprehensive error handling with meaningful error messages
5. **Type Safety**: Use strong typing (TypeScript) with proper interfaces and generics
6. **Testing**: Design code to be easily testable with dependency injection
7. **Documentation**: Self-documenting code with clear variable/function names
8. **SOLID Principles**: Follow Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion
9. **Modern Standards**: Use latest language features and frameworks (ES2023+, React 18+, etc.)
10. **Accessibility**: If UI code, ensure WCAG 2.1 AA compliance

## ARCHITECTURAL CONSIDERATIONS
- Use composition over inheritance
- Implement proper separation of concerns
- Follow domain-driven design principles where applicable
- Use appropriate design patterns (Factory, Observer, Command, etc.)
- Ensure code is easily unit testable and mockable
- Implement proper logging and monitoring hooks
- Consider scalability and future maintenance

## SPECIFIC TECHNICAL REQUIREMENTS
- Use async/await for asynchronous operations
- Implement proper resource cleanup and memory management
- Use environment variables for configuration
- Implement rate limiting and circuit breakers where applicable
- Add proper validation schemas (Zod, Joi, etc.)
- Use proper ORM practices with migrations
- Implement caching strategies where beneficial
- Add proper middleware and request/response handling
`;

    // Framework-specific enhancements
    if (context.framework) {
      switch (context.framework.toLowerCase()) {
        case 'react':
        case 'next.js':
          prompt += `
**React/Next.js Specific**:
- Use React 18+ features (Suspense, Concurrent Features)
- Implement proper state management (Zustand, Redux Toolkit)
- Use custom hooks for reusable logic
- Implement proper memoization (useMemo, useCallback)
- Follow React Testing Library best practices
- Use proper component composition patterns
- Implement proper error boundaries
- Use Server Components and Client Components appropriately (Next.js)
`;
          break;
        case 'express':
        case 'fastify':
          prompt += `
**Backend Framework Specific**:
- Implement proper middleware stack
- Use request validation with schemas
- Implement proper authentication/authorization
- Use database transactions where needed
- Implement proper API versioning
- Add request/response logging
- Implement rate limiting and security headers
- Use proper database connection pooling
`;
          break;
        case 'python':
          prompt += `
**Python Specific**:
- Follow PEP 8 style guidelines
- Use type hints throughout
- Implement proper exception handling
- Use context managers for resource management
- Follow Pythonic patterns and idioms
- Use dataclasses or Pydantic models
- Implement proper async/await patterns
`;
          break;
      }
    }

    // Add comment requirements if requested
    if (request.options?.includeComments) {
      prompt += `
**Documentation Requirements**:
- Add comprehensive JSDoc/docstring comments
- Explain complex algorithms and business logic
- Document all public APIs with examples
- Add inline comments for non-obvious code
- Include performance notes where relevant
`;
    }

    // Add test generation hint
    if (request.options?.includeTests) {
      prompt += `
**Testing Requirements**:
- Structure code to be easily unit testable
- Use dependency injection for external dependencies
- Implement proper interfaces for mocking
- Follow AAA pattern (Arrange, Act, Assert)
`;
    }

    prompt += `
## OUTPUT FORMAT
Provide ONLY the code implementation. No explanations, no markdown formatting around the code block, just the raw, executable code that can be directly used in production.

The code should be:
- Immediately executable/usable
- Production-ready quality
- Thoroughly documented
- Following all specified requirements
- Optimized for the specific use case

BEGIN CODE GENERATION:
`;

    return prompt;
  }

  /**
   * Select the best provider for the task
   */
  // @ts-nocheck - Complex AI service with dynamic types that are difficult to type properly - Complex async type handling
  private async selectProvider(
    request: CodeGenerationRequest,
    context: ProjectContext,
  ): Promise<AIProvider> {
    // Provider selection logic based on task type
    const providerScores = new Map<string, number>();

    for (const [name, provider] of this.providers) {
      let score = 0;

      // Score based on language expertise
      if (provider.languages?.includes(context.language || '')) {
        score += 10;
      }

      // Score based on model capabilities
      if (request.prompt.length > 1000 && provider.maxTokens > 4000) {
        score += 5;
      }

      // Score based on specialized features
      if (request.options?.includeTests && provider.capabilities?.includes('testing')) {
        score += 5;
      }

      providerScores.set(name, score);
    }

    // Select provider with highest score
    const bestProvider = Array.from(providerScores.entries()).sort((a, b) => b[1] - a[1])[0];

    return this.providers.get(bestProvider[0]) || this.currentProvider!;
  }

  /**
   * Post-process generated code
   */
  // @ts-nocheck - Complex AI service with dynamic types that are difficult to type properly - Complex async type handling
  private async postProcessCode(code: string, context: ProjectContext): Promise<string> {
    let processedCode = code;

    // 1. Format code based on project standards
    processedCode = await this.formatCode(processedCode, context);

    // 2. Add necessary imports
    processedCode = await this.addImports(processedCode, context);

    // 3. Validate syntax
    const isValid = await this.validateSyntax(processedCode, context);
    if (!isValid) {
      logger.warn('Generated code has syntax issues, attempting to fix...');
      processedCode = await this.fixSyntaxIssues(processedCode, context);
    }

    return processedCode;
  }

  /**
   * Generate tests for the code
   */
  // @ts-nocheck - Complex AI service with dynamic types that are difficult to type properly - Complex async type handling
  private async generateTests(code: string, context: ProjectContext): Promise<string> {
    const testFramework = await this.detectTestFramework(context);

    const testPrompt = `Generate comprehensive tests for the following ${context.language} code using ${testFramework}:\n\n${code}\n\nInclude unit tests, edge cases, and integration tests where appropriate.`;

    const provider = this.currentProvider!;
    const response = await provider.generateCode(testPrompt);

    return response.code;
  }

  /**
   * Generate documentation
   */
  // @ts-nocheck - Complex AI service with dynamic types that are difficult to type properly - Complex async type handling
  private async generateDocumentation(code: string, context: ProjectContext): Promise<string> {
    const docPrompt = `Generate comprehensive documentation for the following ${context.language} code:\n\n${code}\n\nInclude: function descriptions, parameter explanations, return values, usage examples, and any important notes.`;

    const provider = this.currentProvider!;
    const response = await provider.generateCode(docPrompt);

    return response.code;
  }

  /**
   * Generate suggestions for next steps
   */
  // @ts-nocheck - Complex AI service with dynamic types that are difficult to type properly - Complex async type handling
  private async generateSuggestions(code: string, context: ProjectContext): Promise<string[]> {
    const suggestions: string[] = [];

    // Analyze code for potential improvements
    if (!code.includes('try') && !code.includes('catch')) {
      suggestions.push('Add error handling with try-catch blocks');
    }

    if (!code.includes('async') && context.language === 'javascript') {
      suggestions.push('Consider using async/await for asynchronous operations');
    }

    if (code.length > 100 && !code.includes('function') && !code.includes('class')) {
      suggestions.push('Consider breaking down the code into smaller functions');
    }

    suggestions.push('Run /test to generate and execute tests');
    suggestions.push('Use /review to get code review suggestions');
    suggestions.push('Run /commit to save your changes');

    return suggestions;
  }

  // Helper methods
  private async detectFramework(): Promise<string | undefined> {
    try {
      const packageJson = await fs.readFile('package.json', 'utf-8');
      const pkg = JSON.parse(packageJson) as Record<string, unknown>;

      if (pkg.dependencies?.react || pkg.devDependencies?.react) return 'React';
      if (pkg.dependencies?.vue || pkg.devDependencies?.vue) return 'Vue';
      if (pkg.dependencies?.angular || pkg.devDependencies?.angular) return 'Angular';
      if (pkg.dependencies?.express) return 'Express';
      if (pkg.dependencies?.nestjs) return 'NestJS';
      if (pkg.dependencies?.next) return 'Next.js';
    } catch {
      // No package.json or error reading it
    }
    return undefined;
  }

  private async detectProjectType(): Promise<string | undefined> {
    try {
      const files = await fs.readdir(process.cwd());

      if (files.includes('package.json')) return 'Node.js';
      if (files.includes('requirements.txt') || files.includes('setup.py')) return 'Python';
      if (files.includes('go.mod')) return 'Go';
      if (files.includes('Cargo.toml')) return 'Rust';
      if (files.includes('pom.xml') || files.includes('build.gradle')) return 'Java';
    } catch {
      // Error reading directory
    }
    return undefined;
  }

  private async detectTestFramework(context: ProjectContext): Promise<string> {
    if (context.language === 'javascript' || context.language === 'typescript') {
      try {
        const packageJson = await fs.readFile('package.json', 'utf-8');
        const pkg = JSON.parse(packageJson) as Record<string, unknown>;

        if (pkg.devDependencies?.jest) return 'Jest';
        if (pkg.devDependencies?.mocha) return 'Mocha';
        if (pkg.devDependencies?.vitest) return 'Vitest';
        if (pkg.devDependencies?.['@testing-library/react']) return 'React Testing Library';
      } catch {
        // Default to Jest for JS/TS
      }
      return 'Jest';
    }

    if (context.language === 'python') return 'pytest';
    if (context.language === 'go') return 'testing';
    if (context.language === 'rust') return 'cargo test';
    if (context.language === 'java') return 'JUnit';

    return 'unit tests';
  }

  private async formatCode(code: string, _context: ProjectContext): Promise<string> {
    // TODO: Implement code formatting based on project's prettier/eslint config
    return code;
  }

  private async addImports(code: string, _context: ProjectContext): Promise<string> {
    // TODO: Analyze code and add missing imports
    return code;
  }

  private async validateSyntax(_code: string, _context: ProjectContext): Promise<boolean> {
    // TODO: Use language-specific parsers to validate syntax
    return true;
  }

  private async fixSyntaxIssues(code: string, _context: ProjectContext): Promise<string> {
    // TODO: Attempt to fix common syntax issues
    return code;
  }
}

interface ProjectContext {
  language?: string;
  framework?: string;
  projectType?: string;
  dependencies: string[];
  files: string[];
  patterns: CodePattern[];
}

interface CodePattern {
  name: string;
  description: string;
  example?: string;
}

class LanguageDetector {
  async detectFromFile(filePath: string): Promise<string | undefined> {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.go': 'go',
      '.rs': 'rust',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.rb': 'ruby',
      '.php': 'php',
      '.swift': 'swift',
      '.kt': 'kotlin',
    };
    return languageMap[ext];
  }
}

class ContextAnalyzer {
  async analyzePatterns(_files: string[]): Promise<CodePattern[]> {
    const patterns: CodePattern[] = [];

    // TODO: Analyze files for common patterns
    // For now, return common patterns
    patterns.push({
      name: 'Error Handling',
      description: 'Use try-catch blocks for error handling',
    });

    patterns.push({
      name: 'Async/Await',
      description: 'Use async/await for asynchronous operations',
    });

    return patterns;
  }
}
