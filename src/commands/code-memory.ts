/**
 * Memory-Enhanced Code Generation Command
 *
 * Integrates the dual-memory system for intelligent code generation with:
 * - Pattern recognition from previous generations (System 1)
 * - Reasoning traces for complex problems (System 2)
 * - Learning from user preferences and feedback
 * - Context-aware code suggestions
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { DualMemoryEngine } from '../services/memory-system/dual-memory-engine';
import { AIRouterService } from '../services/ai-router';
import { logger } from '../utils/logger';
import type {
  MemoryQuery,
  MemoryResponse,
  CodePattern,
  ReasoningTrace,
  UserPreferenceSet,
} from '../services/memory-system/types/memory-interfaces';

interface CodeGenerationContext {
  language?: string;
  framework?: string;
  style?: string;
  project?: string;
  previousCode?: string;
  requirements?: string[];
}

export default function registerCodeMemoryCommand(program: Command) {
  program
    .command('code')
    .alias('c')
    .description('Generate code with memory-enhanced AI assistance')
    .argument('<prompt>', 'Code generation prompt')
    .option('-l, --language <lang>', 'Programming language')
    .option('-f, --framework <name>', 'Framework to use')
    .option('-s, --style <style>', 'Code style (functional/oop/declarative)')
    .option('-m, --model <model>', 'AI model to use')
    .option('-o, --output <file>', 'Output to file')
    .option('--learn', 'Learn from this generation for future use')
    .option('--reason', 'Use deep reasoning for complex problems')
    .option('--no-memory', 'Disable memory system')
    .action(async (prompt: string, options) => {
      const spinner = ora('Initializing memory-enhanced code generation...').start();

      try {
        // Initialize memory system
        let memoryEngine: DualMemoryEngine | null = null;
        if (options.memory !== false) {
          memoryEngine = await initializeMemorySystem();
          spinner.text = 'Memory system initialized';
        }

        // Build generation context
        const context: CodeGenerationContext = {
          language: options.language,
          framework: options.framework,
          style: options.style,
          project: process.cwd().split('/').pop(),
        };

        // Query memory for relevant patterns and previous solutions
        let memoryContext: unknown = null;
        if (memoryEngine) {
          spinner.text = 'Searching memory for relevant patterns...';
          memoryContext = await queryMemoryForContext(memoryEngine, prompt, context);

          if (memoryContext.patterns.length > 0) {
            spinner.succeed(`Found ${memoryContext.patterns.length} relevant code patterns`);
          }

          if (memoryContext.reasoning.length > 0) {
            console.log(
              chalk.blue(`📚 Found ${memoryContext.reasoning.length} related reasoning traces`),
            );
          }
        }

        // Start reasoning trace if requested for complex problems
        let reasoningTraceId: string | null = null;
        if (options.reason && memoryEngine) {
          spinner.text = 'Starting deep reasoning process...';
          reasoningTraceId = await startReasoningTrace(memoryEngine, prompt, context);
          spinner.succeed('Reasoning trace initiated');
        }

        // Generate code with memory context
        spinner.text = 'Generating code...';
        const generatedCode = await generateCodeWithMemory(
          prompt,
          context,
          memoryContext,
          options.model,
        );

        // Complete reasoning trace with result
        if (reasoningTraceId && memoryEngine) {
          await completeReasoningTrace(memoryEngine, reasoningTraceId, generatedCode);
        }

        // Learn from this generation if requested
        if (options.learn && memoryEngine) {
          spinner.text = 'Learning from generation...';
          await learnFromGeneration(memoryEngine, prompt, generatedCode, context);
          spinner.succeed('Pattern learned and stored');
        }

        // Update user preferences based on choices
        if (memoryEngine) {
          await updateUserPreferences(memoryEngine, options);
        }

        // Output result
        spinner.stop();
        console.log(chalk.green('\n✨ Code generated successfully:\n'));
        console.log(generatedCode);

        // Save to file if requested
        if (options.output) {
          const fs = await import('fs/promises');
          await fs.writeFile(options.output, generatedCode);
          console.log(chalk.green(`\n📄 Saved to ${options.output}`));
        }

        // Show memory statistics
        if (memoryEngine) {
          const metrics = memoryEngine.getMetrics();
          console.log(
            chalk.gray(
              `\n📊 Memory: ${metrics.system1Operations} patterns, ${metrics.system2Operations} reasoning traces`,
            ),
          );
        }
      } catch (error) {
        spinner.fail('Code generation failed');
        logger.error('Code generation error:', error);
        console.error(chalk.red('Error:'), (error as Error).message);
        process.exit(1);
      }
    });
}

async function initializeMemorySystem(): Promise<DualMemoryEngine> {
  return new DualMemoryEngine({
    system1: {
      maxKnowledgeNodes: 1000,
      embeddingDimension: 1536,
      cacheSize: 100,
      compressionThreshold: 0.8,
      accessDecayRate: 0.05,
    },
    system2: {
      maxReasoningTraces: 100,
      qualityThreshold: 0.7,
      reflectionFrequency: 24,
      enhancementEvaluationInterval: 12,
    },
    coordinator: {
      syncInterval: 5000,
      conflictResolutionStrategy: 'balanced',
      learningRate: 0.15,
      adaptationThreshold: 0.75,
    },
    performance: {
      targetLatency: 50,
      maxMemoryUsage: 512,
      cacheStrategy: 'lru',
      preloadPriority: 'high',
      backgroundOptimization: true,
    },
  });
}

async function queryMemoryForContext(
  engine: DualMemoryEngine,
  prompt: string,
  context: CodeGenerationContext,
): Promise<unknown> {
  // Query for relevant code patterns
  const patternQuery: MemoryQuery = {
    type: 'pattern',
    query: prompt,
    context: context as Record<string, unknown>,
    urgency: 'medium',
    limit: 5,
  };

  const patterns = await engine.query(patternQuery);

  // Query for relevant reasoning traces
  const reasoningQuery: MemoryQuery = {
    type: 'reasoning',
    query: prompt,
    context: context as Record<string, unknown>,
    urgency: 'medium',
    limit: 3,
  };

  const reasoning = await engine.query(reasoningQuery);

  // Query for user preferences
  const preferenceQuery: MemoryQuery = {
    type: 'preference',
    query: 'code_generation',
    context: { language: context.language },
    urgency: 'low',
    limit: 1,
  };

  const preferences = await engine.query(preferenceQuery);

  return {
    patterns: patterns.data || [],
    reasoning: reasoning.data || [],
    preferences: preferences.data || {},
  };
}

async function startReasoningTrace(
  engine: DualMemoryEngine,
  prompt: string,
  context: CodeGenerationContext,
): Promise<string> {
  const trace = await engine.getSystem2().startReasoningTrace({
    problem: prompt,
    goals: [`Generate ${context.language || 'code'} that solves: ${prompt}`],
    constraints: context.requirements || [],
    assumptions: [`Using ${context.framework || 'standard library'}`],
    availableResources: ['Memory patterns', 'Previous solutions'],
  });

  return trace.id;
}

async function completeReasoningTrace(
  engine: DualMemoryEngine,
  traceId: string,
  generatedCode: string,
): Promise<void> {
  const quality = await evaluateCodeQuality(generatedCode);
  await engine.getSystem2().completeReasoningTrace(traceId, generatedCode, quality);
}

async function learnFromGeneration(
  engine: DualMemoryEngine,
  prompt: string,
  code: string,
  context: CodeGenerationContext,
): Promise<void> {
  // Store as a code pattern in System 1
  const embedding = await generateEmbedding(prompt);

  await engine
    .getSystem1()
    .addKnowledgeNode('code_pattern', `pattern_${Date.now()}`, code, embedding, {
      prompt,
      ...context,
      timestamp: new Date().toISOString(),
    });

  // Record as a successful pattern
  await engine.getSystem1().recordPattern({
    id: `pattern_${Date.now()}`,
    type: 'code_generation',
    frequency: 1,
    lastAccessed: new Date(),
    metadata: {
      language: context.language || 'unknown',
      framework: context.framework || 'none',
      success: true,
    },
  } as CodePattern);
}

async function updateUserPreferences(engine: DualMemoryEngine, options: unknown): Promise<void> {
  const preferences: Partial<UserPreferenceSet> = {
    preferredModels: options.model ? [options.model] : undefined,
    codeStyle: options.style,
    outputFormat: options.output ? 'file' : 'console',
    learningEnabled: options.learn || false,
  };

  await engine.processEvent({
    type: 'preference_update',
    timestamp: new Date(),
    source: 'code_command',
    data: preferences,
    metadata: {
      command: 'code',
      timestamp: new Date().toISOString(),
    },
  });
}

async function generateCodeWithMemory(
  prompt: string,
  context: CodeGenerationContext,
  memoryContext: unknown,
  model?: string,
): Promise<string> {
  const aiRouter = new AIRouterService();

  // Build enhanced prompt with memory context
  let enhancedPrompt = prompt;

  if (memoryContext && memoryContext.patterns.length > 0) {
    enhancedPrompt += '\n\n## Similar patterns from memory:\n';
    memoryContext.patterns.slice(0, 2).forEach((pattern: unknown) => {
      enhancedPrompt += `\n### Previous solution:\n\`\`\`\n${pattern.content}\n\`\`\`\n`;
    });
  }

  if (memoryContext && memoryContext.reasoning.length > 0) {
    enhancedPrompt += '\n\n## Related reasoning:\n';
    memoryContext.reasoning.slice(0, 1).forEach((trace: unknown) => {
      enhancedPrompt += `\n- ${trace.outcome}\n`;
    });
  }

  // Add context
  if (context.language) {
    enhancedPrompt = `Generate ${context.language} code:\n${enhancedPrompt}`;
  }
  if (context.framework) {
    enhancedPrompt += `\nUse ${context.framework} framework.`;
  }
  if (context.style) {
    enhancedPrompt += `\nFollow ${context.style} programming style.`;
  }

  // Generate code using AI router
  const response = await aiRouter.generateCode({
    prompt: enhancedPrompt,
    model: model || 'auto',
    temperature: 0.7,
    maxTokens: 2000,
  });

  return response.code;
}

async function generateEmbedding(text: string): Promise<number[]> {
  // Simplified embedding generation - in production, use proper embedding model
  const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return Array(100)
    .fill(0)
    .map((_, i) => Math.sin(hash + i) * 0.5 + 0.5);
}

async function evaluateCodeQuality(code: string): Promise<number> {
  // Simple quality evaluation - in production, use proper code analysis
  let quality = 0.5;

  // Check for common quality indicators
  if (code.includes('function') || code.includes('class')) quality += 0.1;
  if (code.includes('try') || code.includes('catch')) quality += 0.1;
  if (code.includes('async') || code.includes('await')) quality += 0.1;
  if (code.includes('/**') || code.includes('//')) quality += 0.1;
  if (code.length > 100) quality += 0.1;

  return Math.min(quality, 1.0);
}
