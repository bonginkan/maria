/**
 * CodeRAG Command - Vector-based Code Search and Analysis
 * Provides intelligent code search and codebase analysis capabilities
 */

import { Command } from 'commander';
import { codeRAGService } from '../services/coderag-system';
import { MultiAgentSystem } from '../agents/multi-agent-system';
import chalk from 'chalk';

export default function registerCodeRAGCommand(program: Command) {
  const coderagCommand = program
    .command('coderag')
    .alias('rag')
    .description('🔍 Vector-based code search and semantic analysis')
    .addHelpText(
      'after',
      `
${chalk.cyan('Examples:')}
  ${chalk.gray('$')} maria coderag index .                     # Index current directory
  ${chalk.gray('$')} maria coderag search "async function"     # Search for async functions
  ${chalk.gray('$')} maria coderag analyze .                   # Analyze codebase patterns
  ${chalk.gray('$')} maria coderag similar "function calc()"   # Find similar patterns
    `,
    );

  // Index codebase
  coderagCommand
    .command('index')
    .argument('<path>', 'Path to codebase directory')
    .option('--types <types>', 'File types to include (comma-separated)', '.ts,.tsx,.js,.jsx')
    .option('--exclude <paths>', 'Paths to exclude (comma-separated)', 'node_modules,dist,.git')
    .option('--chunk-size <size>', 'Chunk size for indexing', '500')
    .description('Index codebase for vector search')
    .action(async (path: string, options) => {
      try {
        console.log(chalk.blue('🔍 Indexing codebase for CodeRAG...'));
        console.log(chalk.gray(`Path: ${path}`));

        const fileTypes = options.types.split(',').map((t: string) => t.trim());
        const excludePaths = options.exclude.split(',').map((p: string) => p.trim());

        await codeRAGService.initialize();

        const result = await codeRAGService.indexCodebase(path, {
          fileTypes,
          excludePaths,
          chunkSize: parseInt(options.chunkSize, 10),
          includeTests: false,
        });

        console.log(chalk.green(`✅ Indexing completed:`));
        console.log(`  📁 Indexed: ${result.indexed} code chunks`);
        console.log(`  ⏭️  Skipped: ${result.skipped} files`);

        if (result.errors.length > 0) {
          console.log(chalk.yellow(`⚠️  Errors: ${result.errors.length}`));
          result.errors.forEach((error) => console.log(chalk.red(`   ${error}`)));
        }
      } catch (error) {
        console.error(chalk.red('❌ Indexing failed:'), error);
        process.exit(1);
      }
    });

  // Search codebase
  coderagCommand
    .command('search')
    .argument('<query>', 'Search query')
    .option('--language <lang>', 'Programming language filter')
    .option('--max-results <num>', 'Maximum number of results', '10')
    .option('--threshold <num>', 'Similarity threshold (0-1)', '0.7')
    .description('Search codebase using semantic similarity')
    .action(async (query: string, options) => {
      try {
        console.log(chalk.blue('🔍 Searching codebase...'));
        console.log(chalk.gray(`Query: "${query}"`));

        await codeRAGService.initialize();

        const results = await codeRAGService.semanticSearch({
          query,
          language: options.language,
          maxResults: parseInt(options.maxResults, 10),
          threshold: parseFloat(options.threshold),
        });

        if (results.length === 0) {
          console.log(chalk.yellow('🔍 No matching code found'));
          return;
        }

        console.log(chalk.green(`✅ Found ${results.length} matches:`));
        console.log();

        results.forEach((result, index) => {
          console.log(
            chalk.cyan(
              `[${index + 1}] ${result.chunk.filePath}:${result.chunk.startLine}-${result.chunk.endLine}`,
            ),
          );
          console.log(chalk.gray(`    Similarity: ${(result.similarity * 100).toFixed(1)}%`));
          console.log(chalk.gray(`    Relevance: ${(result.relevanceScore * 100).toFixed(1)}%`));
          console.log(chalk.white(`    ${result.explanation}`));
          console.log();
        });
      } catch (error) {
        console.error(chalk.red('❌ Search failed:'), error);
        process.exit(1);
      }
    });

  // Analyze codebase
  coderagCommand
    .command('analyze')
    .argument('<paths...>', 'Paths to analyze')
    .option('--patterns', 'Include pattern analysis', true)
    .option('--complexity', 'Include complexity analysis', true)
    .option('--insights', 'Include AI insights', true)
    .description('Analyze codebase semantically')
    .action(async (paths: string[], options) => {
      try {
        console.log(chalk.blue('🔍 Analyzing codebase...'));
        console.log(chalk.gray(`Paths: ${paths.join(', ')}`));

        await codeRAGService.initialize();

        const analysis = await codeRAGService.analyzeCodebase(paths, {
          includePatterns: options.patterns,
          includeComplexity: options.complexity,
          includeInsights: options.insights,
        });

        console.log(chalk.green('✅ Analysis completed:'));
        console.log();

        // Codebase overview
        console.log(chalk.cyan('📊 Codebase Overview:'));
        console.log(`  Files: ${analysis.codebase.totalFiles}`);
        console.log(`  Code chunks: ${analysis.codebase.totalChunks}`);
        console.log(`  Languages: ${analysis.codebase.languages.join(', ')}`);
        console.log();

        // Common patterns
        if (analysis.patterns.commonPatterns.length > 0) {
          console.log(chalk.cyan('🔧 Common Patterns:'));
          analysis.patterns.commonPatterns.slice(0, 5).forEach((pattern) => {
            console.log(`  • ${pattern.pattern} (${pattern.frequency} times)`);
          });
          console.log();
        }

        // Anti-patterns
        if (analysis.patterns.antiPatterns.length > 0) {
          console.log(chalk.yellow('⚠️  Anti-patterns Found:'));
          analysis.patterns.antiPatterns.slice(0, 3).forEach((antiPattern) => {
            const color =
              antiPattern.severity === 'high'
                ? chalk.red
                : antiPattern.severity === 'medium'
                  ? chalk.yellow
                  : chalk.gray;
            console.log(color(`  • ${antiPattern.pattern} (${antiPattern.severity})`));
          });
          console.log();
        }

        // Insights
        if (analysis.insights.length > 0) {
          console.log(chalk.cyan('💡 AI Insights:'));
          analysis.insights.slice(0, 3).forEach((insight) => {
            console.log(`  • ${insight}`);
          });
          console.log();
        }

        // Recommendations
        if (analysis.recommendations.length > 0) {
          console.log(chalk.green('🎯 Recommendations:'));
          analysis.recommendations.slice(0, 3).forEach((recommendation) => {
            console.log(`  • ${recommendation}`);
          });
        }
      } catch (error) {
        console.error(chalk.red('❌ Analysis failed:'), error);
        process.exit(1);
      }
    });

  // Find similar patterns
  coderagCommand
    .command('similar')
    .argument('<code>', 'Code snippet to find similar patterns for')
    .option('--language <lang>', 'Programming language')
    .option('--similarity <num>', 'Minimum similarity threshold', '0.6')
    .option('--max-results <num>', 'Maximum number of results', '5')
    .description('Find similar code patterns')
    .action(async (code: string, options) => {
      try {
        console.log(chalk.blue('🔍 Finding similar patterns...'));
        console.log(chalk.gray(`Code: "${code.substring(0, 50)}${code.length > 50 ? '...' : ''}"`));

        await codeRAGService.initialize();

        const results = await codeRAGService.findSimilarPatterns(code, {
          language: options.language,
          minSimilarity: parseFloat(options.similarity),
          maxResults: parseInt(options.maxResults, 10),
        });

        if (results.length === 0) {
          console.log(chalk.yellow('🔍 No similar patterns found'));
          return;
        }

        console.log(chalk.green(`✅ Found ${results.length} similar patterns:`));
        console.log();

        results.forEach((result, index) => {
          console.log(
            chalk.cyan(
              `[${index + 1}] ${result.chunk.filePath}:${result.chunk.startLine}-${result.chunk.endLine}`,
            ),
          );
          console.log(chalk.gray(`    Similarity: ${(result.similarity * 100).toFixed(1)}%`));
          console.log(chalk.white(`    ${result.explanation}`));

          // Show code snippet
          const lines = result.chunk.content.split('\n').slice(0, 3);
          lines.forEach((line) => {
            console.log(chalk.gray(`    ${line.trim()}`));
          });
          if (result.chunk.content.split('\n').length > 3) {
            console.log(chalk.gray('    ...'));
          }
          console.log();
        });
      } catch (error) {
        console.error(chalk.red('❌ Pattern search failed:'), error);
        process.exit(1);
      }
    });

  // Status command
  coderagCommand
    .command('status')
    .description('Show CodeRAG system status')
    .action(async () => {
      try {
        const status = codeRAGService.getStatus();

        console.log(chalk.cyan('🔍 CodeRAG System Status:'));
        console.log();
        console.log(`Initialized: ${status.initialized ? chalk.green('✅') : chalk.red('❌')}`);
        console.log(`Indexed paths: ${status.indexedPaths.length}`);
        console.log(`Total chunks: ${status.totalChunks}`);
        console.log(`Total embeddings: ${status.totalEmbeddings}`);
        console.log(`Embedding model: ${status.embeddingModel}`);

        if (status.lastIndexed) {
          console.log(`Last indexed: ${status.lastIndexed.toLocaleString()}`);
        }

        if (status.indexedPaths.length > 0) {
          console.log();
          console.log(chalk.cyan('Indexed paths:'));
          status.indexedPaths.forEach((path) => {
            console.log(`  • ${path}`);
          });
        }
      } catch (error) {
        console.error(chalk.red('❌ Status check failed:'), error);
        process.exit(1);
      }
    });

  // Smart paper processing with CodeRAG
  coderagCommand
    .command('process-paper')
    .argument('<source>', 'Paper source (PDF path, arXiv ID, or URL)')
    .option('--type <type>', 'Source type (pdf|arxiv|url)', 'pdf')
    .option('--language <lang>', 'Target programming language', 'typescript')
    .option('--framework <framework>', 'Target framework', 'none')
    .description('Process paper with CodeRAG-enhanced intelligence')
    .action(async (source: string, options) => {
      try {
        console.log(chalk.blue('🚀 Processing paper with CodeRAG intelligence...'));
        console.log(chalk.gray(`Source: ${source}`));
        console.log(chalk.gray(`Type: ${options.type}`));
        console.log(chalk.gray(`Target: ${options.language}`));

        const multiAgent = MultiAgentSystem.getInstance();
        await multiAgent.initialize();

        const result = await multiAgent.processEnhancedPaperWithRAG({
          source: options.type as 'pdf' | 'arxiv' | 'url',
          content: source,
          options: {
            extractAlgorithms: true,
            generateTests: true,
            includeDocumentation: true,
            targetLanguage: options.language,
            framework: options.framework,
          },
        });

        if (result.success && result.synthesizedOutput) {
          console.log(chalk.green('✅ Paper processing completed!'));
          console.log();

          const output = result.synthesizedOutput;
          console.log(chalk.cyan(`📊 Workflow: ${output.workflowId}`));
          console.log(chalk.cyan(`🤖 Agents: ${output.participatingAgents.join(', ')}`));
          console.log(
            chalk.cyan(`⭐ Quality: ${Math.round(output.qualityMetrics.accuracy * 100)}%`),
          );
          console.log();

          if (result.documentAnalysis) {
            console.log(chalk.cyan('📄 Document Analysis:'));
            const analysis = result.documentAnalysis as Record<string, unknown>;
            console.log(`  Title: ${analysis['title'] || 'N/A'}`);
            console.log(`  Algorithms found: ${analysis['algorithmsFound'] || 0}`);
            console.log(`  Code blocks: ${analysis['codeBlocksFound'] || 0}`);
            console.log(
              `  Quality score: ${(((analysis['qualityScore'] as number) || 0) * 100).toFixed(1)}%`,
            );
            console.log();
          }

          if (result.codebaseInsights) {
            console.log(chalk.cyan('💻 Codebase Insights:'));
            const insights = result.codebaseInsights as Record<string, unknown>;
            console.log(`  Total files: ${insights['totalFiles'] || 0}`);
            console.log(`  Languages: ${(insights['languages'] as string[])?.join(', ') || 'N/A'}`);
            console.log(
              `  Common patterns: ${(insights['commonPatterns'] as unknown[])?.length || 0}`,
            );
            console.log();
          }

          console.log(chalk.cyan('🔍 Key Insights:'));
          output.insights.forEach((insight) => {
            console.log(`  • ${insight}`);
          });
          console.log();

          console.log(chalk.green('💡 Recommendations:'));
          output.recommendations.forEach((rec) => {
            console.log(`  • ${rec}`);
          });
        } else {
          console.error(chalk.red('❌ Paper processing failed:'), result.error);
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red('❌ Enhanced paper processing failed:'), error);
        process.exit(1);
      }
    });

  return coderagCommand;
}
