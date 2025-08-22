/**
 * Document Processing Command
 * Advanced document parsing, analysis, and multi-format support
 */

import { Command } from 'commander';
import { documentProcessor } from '../services/document-processor';
import chalk from 'chalk';

export default function registerDocumentCommand(program: Command) {
  const docCommand = program
    .command('document')
    .alias('doc')
    .description('📄 Advanced document processing and analysis')
    .addHelpText(
      'after',
      `
${chalk.cyan('Examples:')}
  ${chalk.gray('$')} maria doc process paper.pdf              # Process PDF document
  ${chalk.gray('$')} maria doc arxiv 2301.12345               # Fetch and process arXiv paper
  ${chalk.gray('$')} maria doc url https://example.com/doc    # Process web document
  ${chalk.gray('$')} maria doc search "machine learning"      # Search processed documents
    `,
    );

  // Process document
  docCommand
    .command('process')
    .argument('<source>', 'Document source (file path, URL, or arXiv ID)')
    .option('--type <type>', 'Document type (pdf|arxiv|url|docx|html|markdown|text)', 'auto')
    .option('--extract-structure', 'Extract document structure', true)
    .option('--extract-algorithms', 'Extract algorithms and procedures', true)
    .option('--extract-code', 'Extract code blocks', true)
    .option('--extract-formulas', 'Extract mathematical formulas', true)
    .option('--extract-diagrams', 'Extract diagram descriptions', false)
    .option('--extract-images', 'Extract and analyze images', false)
    .option('--ocr', 'Enable OCR for scanned documents', true)
    .option('--language <lang>', 'Document language', 'auto')
    .description('Process document with advanced extraction')
    .action(async (source: string, options) => {
      try {
        console.log(chalk.blue('📄 Processing document...'));
        console.log(chalk.gray(`Source: ${source}`));

        // Auto-detect type if not specified
        let type = options.type;
        if (type === 'auto') {
          if (source.match(/arxiv\.org|^\d{4}\.\d{4,5}$/)) {
            type = 'arxiv';
          } else if (source.startsWith('http')) {
            type = 'url';
          } else if (source.endsWith('.pdf')) {
            type = 'pdf';
          } else if (source.endsWith('.docx')) {
            type = 'docx';
          } else if (source.endsWith('.html')) {
            type = 'html';
          } else if (source.endsWith('.md')) {
            type = 'markdown';
          } else {
            type = 'text';
          }
        }

        console.log(chalk.gray(`Type: ${type}`));

        await documentProcessor.initialize();

        const document = await documentProcessor.processDocument(
          {
            type: type as 'pdf' | 'url' | 'arxiv',
            identifier: source,
          },
          {
            extractStructure: options.extractStructure,
            extractAlgorithms: options.extractAlgorithms,
            extractCode: options.extractCode,
            extractFormulas: options.extractFormulas,
            extractDiagrams: options.extractDiagrams,
            extractImages: options.extractImages,
            ocrEnabled: options.ocr,
            language: options.language,
          },
        );

        console.log(chalk.green('✅ Document processing completed!'));
        console.log();

        // Document overview
        console.log(chalk.cyan('📄 Document Overview:'));
        console.log(`  Title: ${document.title}`);
        console.log(`  ID: ${document.id}`);
        console.log(`  Authors: ${document.metadata.authors.join(', ') || 'N/A'}`);
        console.log(`  Pages: ${document.metadata.pageCount}`);
        console.log(`  Words: ${document.metadata.wordCount.toLocaleString()}`);
        console.log(`  Language: ${document.metadata.language}`);
        console.log(
          `  Quality: ${(document.metadata.processingQuality.overallScore * 100).toFixed(1)}%`,
        );
        console.log();

        // Content structure
        const content = document.content.structuredContent;
        if (content.sections.length > 0) {
          console.log(chalk.cyan('📋 Document Structure:'));
          content.sections.slice(0, 5).forEach((section) => {
            console.log(
              `  ${section.level === 1 ? '📄' : '  📝'} ${section.title} (${section.wordCount} words)`,
            );
          });
          if (content.sections.length > 5) {
            console.log(`  ... and ${content.sections.length - 5} more sections`);
          }
          console.log();
        }

        // Extracted elements
        const elements = document.content.extractedElements;

        if (elements.algorithms.length > 0) {
          console.log(chalk.cyan('🔧 Algorithms Found:'));
          elements.algorithms.slice(0, 3).forEach((algo) => {
            console.log(`  • ${algo.name}: ${algo.description}`);
            if (algo.complexity) {
              console.log(`    Time: ${algo.complexity.time}, Space: ${algo.complexity.space}`);
            }
          });
          if (elements.algorithms.length > 3) {
            console.log(`  ... and ${elements.algorithms.length - 3} more algorithms`);
          }
          console.log();
        }

        if (elements.codeBlocks.length > 0) {
          console.log(chalk.cyan('💻 Code Blocks:'));
          elements.codeBlocks.slice(0, 3).forEach((code) => {
            console.log(`  • ${code.language || 'Unknown'}: ${code.description || 'Code snippet'}`);
          });
          if (elements.codeBlocks.length > 3) {
            console.log(`  ... and ${elements.codeBlocks.length - 3} more code blocks`);
          }
          console.log();
        }

        if (elements.formulas.length > 0) {
          console.log(chalk.cyan('🔢 Mathematical Formulas:'));
          console.log(`  Found ${elements.formulas.length} formulas`);
          console.log();
        }

        if (content.figures.length > 0) {
          console.log(chalk.cyan('🖼️  Figures:'));
          content.figures.slice(0, 3).forEach((figure) => {
            console.log(`  • ${figure.caption} (Page ${figure.pageNumber})`);
          });
          if (content.figures.length > 3) {
            console.log(`  ... and ${content.figures.length - 3} more figures`);
          }
          console.log();
        }

        if (content.references.length > 0) {
          console.log(chalk.cyan('📚 References:'));
          console.log(`  Found ${content.references.length} references`);
          console.log();
        }

        // Processing quality breakdown
        console.log(chalk.cyan('🎯 Processing Quality:'));
        const quality = document.metadata.processingQuality;
        console.log(`  Text extraction: ${(quality.textExtractionScore * 100).toFixed(1)}%`);
        console.log(
          `  Structure recognition: ${(quality.structureRecognitionScore * 100).toFixed(1)}%`,
        );
        console.log(
          `  Algorithm extraction: ${(quality.algorithmExtractionScore * 100).toFixed(1)}%`,
        );
      } catch (error) {
        console.error(chalk.red('❌ Document processing failed:'), error);
        process.exit(1);
      }
    });

  // Process arXiv paper
  docCommand
    .command('arxiv')
    .argument('<id>', 'arXiv paper ID (e.g., 2301.12345)')
    .option('--extract-algorithms', 'Extract algorithms', true)
    .option('--extract-code', 'Extract code blocks', true)
    .option('--target-language <lang>', 'Target programming language for code generation')
    .description('Fetch and process arXiv paper')
    .action(async (id: string, options) => {
      try {
        console.log(chalk.blue('📄 Fetching arXiv paper...'));
        console.log(chalk.gray(`arXiv ID: ${id}`));

        await documentProcessor.initialize();

        const document = await documentProcessor.processDocument(
          {
            type: 'arxiv',
            identifier: id,
          },
          {
            extractStructure: true,
            extractAlgorithms: options.extractAlgorithms,
            extractCode: options.extractCode,
            extractFormulas: true,
          },
        );

        console.log(chalk.green('✅ arXiv paper processed successfully!'));
        console.log();

        console.log(chalk.cyan('📄 Paper Information:'));
        console.log(`  Title: ${document.title}`);
        console.log(`  Authors: ${document.metadata.authors.join(', ')}`);
        if (document.metadata.publishedDate) {
          console.log(`  Published: ${document.metadata.publishedDate.toDateString()}`);
        }
        console.log(`  arXiv ID: ${document.metadata.arxivId}`);
        console.log();

        // Show abstract
        if (document.content.structuredContent.abstract) {
          console.log(chalk.cyan('📝 Abstract:'));
          const abstract = document.content.structuredContent.abstract;
          console.log(abstract.length > 500 ? `${abstract.substring(0, 500)  }...` : abstract);
          console.log();
        }

        // Show algorithms if found
        const algorithms = document.content.extractedElements.algorithms;
        if (algorithms.length > 0) {
          console.log(chalk.cyan('🔧 Algorithms Detected:'));
          algorithms.forEach((algo) => {
            console.log(`  • ${algo.name}`);
            console.log(`    ${algo.description}`);
            if (algo.steps.length > 0) {
              console.log(`    Steps: ${algo.steps.length}`);
            }
          });
          console.log();
        }

        // Suggest code generation if target language specified
        if (options.targetLanguage && algorithms.length > 0) {
          console.log(chalk.yellow('💡 Suggestion:'));
          console.log(
            `  Use 'maria coderag process-paper' to generate ${options.targetLanguage} code from these algorithms`,
          );
        }
      } catch (error) {
        console.error(chalk.red('❌ arXiv processing failed:'), error);
        process.exit(1);
      }
    });

  // Search processed documents
  docCommand
    .command('search')
    .argument('<query>', 'Search query')
    .option('--type <types>', 'Filter by document types (comma-separated)')
    .option('--author <name>', 'Filter by author name')
    .option('--max-results <num>', 'Maximum number of results', '10')
    .description('Search processed documents')
    .action(async (query: string, options) => {
      try {
        console.log(chalk.blue('🔍 Searching documents...'));
        console.log(chalk.gray(`Query: "${query}"`));

        const filterByType = options.type
          ? options.type.split(',').map((t: string) => t.trim())
          : undefined;

        const results = await documentProcessor.searchDocuments(query, {
          filterByType,
          filterByAuthor: options.author,
          maxResults: parseInt(options.maxResults, 10),
        });

        if (results.length === 0) {
          console.log(chalk.yellow('🔍 No documents found matching your query'));
          return;
        }

        console.log(chalk.green(`✅ Found ${results.length} documents:`));
        console.log();

        results.forEach((doc, index) => {
          console.log(chalk.cyan(`[${index + 1}] ${doc.title}`));
          console.log(
            chalk.gray(
              `    Type: ${doc.source.type} | Authors: ${doc.metadata.authors.join(', ') || 'N/A'}`,
            ),
          );
          console.log(
            chalk.gray(
              `    Pages: ${doc.metadata.pageCount} | Words: ${doc.metadata.wordCount.toLocaleString()}`,
            ),
          );
          console.log(
            chalk.gray(
              `    Quality: ${(doc.metadata.processingQuality.overallScore * 100).toFixed(1)}%`,
            ),
          );

          // Show some extracted elements
          const elements = doc.content.extractedElements;
          const summary = [];
          if (elements.algorithms.length > 0)
            {summary.push(`${elements.algorithms.length} algorithms`);}
          if (elements.codeBlocks.length > 0)
            {summary.push(`${elements.codeBlocks.length} code blocks`);}
          if (elements.formulas.length > 0) {summary.push(`${elements.formulas.length} formulas`);}

          if (summary.length > 0) {
            console.log(chalk.gray(`    Content: ${summary.join(', ')}`));
          }
          console.log();
        });
      } catch (error) {
        console.error(chalk.red('❌ Document search failed:'), error);
        process.exit(1);
      }
    });

  // List processed documents
  docCommand
    .command('list')
    .option('--type <type>', 'Filter by document type')
    .option('--sort <field>', 'Sort by field (title|date|quality)', 'date')
    .description('List all processed documents')
    .action(async (options) => {
      try {
        const allDocs = documentProcessor.getProcessedDocuments();

        const docs = options.type
          ? allDocs.filter((doc) => doc.source.type === options.type)
          : allDocs;

        // Sort documents
        switch (options.sort) {
          case 'title':
            docs.sort((a, b) => a.title.localeCompare(b.title));
            break;
          case 'quality':
            docs.sort(
              (a, b) =>
                b.metadata.processingQuality.overallScore -
                a.metadata.processingQuality.overallScore,
            );
            break;
          case 'date':
          default:
            docs.sort((a, b) => b.processingTimestamp.getTime() - a.processingTimestamp.getTime());
            break;
        }

        if (docs.length === 0) {
          console.log(chalk.yellow('📄 No processed documents found'));
          console.log(chalk.gray('Use "maria doc process <file>" to process documents'));
          return;
        }

        console.log(chalk.cyan(`📄 Processed Documents (${docs.length}):`));
        console.log();

        docs.forEach((doc, index) => {
          console.log(chalk.cyan(`[${index + 1}] ${doc.title}`));
          console.log(chalk.gray(`    Type: ${doc.source.type} | ID: ${doc.id}`));
          console.log(chalk.gray(`    Processed: ${doc.processingTimestamp.toLocaleString()}`));
          console.log(
            chalk.gray(
              `    Quality: ${(doc.metadata.processingQuality.overallScore * 100).toFixed(1)}%`,
            ),
          );
          console.log();
        });
      } catch (error) {
        console.error(chalk.red('❌ Failed to list documents:'), error);
        process.exit(1);
      }
    });

  // Show document details
  docCommand
    .command('show')
    .argument('<id>', 'Document ID')
    .option('--full', 'Show full content', false)
    .description('Show detailed information about a document')
    .action(async (id: string, options) => {
      try {
        const document = documentProcessor.getDocument(id);

        if (!document) {
          console.log(chalk.yellow(`📄 Document not found: ${id}`));
          console.log(chalk.gray('Use "maria doc list" to see available documents'));
          return;
        }

        console.log(chalk.cyan('📄 Document Details:'));
        console.log();
        console.log(`Title: ${document.title}`);
        console.log(`ID: ${document.id}`);
        console.log(`Source: ${document.source.type} (${document.source.identifier})`);
        console.log(`Authors: ${document.metadata.authors.join(', ') || 'N/A'}`);
        console.log(`Language: ${document.metadata.language}`);
        console.log(`Processed: ${document.processingTimestamp.toLocaleString()}`);
        console.log();

        // Metadata
        console.log(chalk.cyan('📊 Metadata:'));
        console.log(`  Pages: ${document.metadata.pageCount}`);
        console.log(`  Words: ${document.metadata.wordCount.toLocaleString()}`);
        if (document.metadata.publishedDate) {
          console.log(`  Published: ${document.metadata.publishedDate.toDateString()}`);
        }
        if (document.metadata.doi) {
          console.log(`  DOI: ${document.metadata.doi}`);
        }
        if (document.metadata.arxivId) {
          console.log(`  arXiv ID: ${document.metadata.arxivId}`);
        }
        console.log();

        // Quality metrics
        console.log(chalk.cyan('🎯 Quality Metrics:'));
        const quality = document.metadata.processingQuality;
        console.log(`  Overall: ${(quality.overallScore * 100).toFixed(1)}%`);
        console.log(`  Text extraction: ${(quality.textExtractionScore * 100).toFixed(1)}%`);
        console.log(`  Structure: ${(quality.structureRecognitionScore * 100).toFixed(1)}%`);
        console.log(
          `  Algorithm extraction: ${(quality.algorithmExtractionScore * 100).toFixed(1)}%`,
        );
        console.log();

        // Extracted elements summary
        const elements = document.content.extractedElements;
        console.log(chalk.cyan('📋 Extracted Content:'));
        console.log(`  Sections: ${document.content.structuredContent.sections.length}`);
        console.log(`  Algorithms: ${elements.algorithms.length}`);
        console.log(`  Code blocks: ${elements.codeBlocks.length}`);
        console.log(`  Formulas: ${elements.formulas.length}`);
        console.log(`  Figures: ${document.content.structuredContent.figures.length}`);
        console.log(`  References: ${document.content.structuredContent.references.length}`);

        // Show full content if requested
        if (options.full) {
          console.log();
          console.log(chalk.cyan('📝 Full Content:'));
          console.log(document.content.rawText.substring(0, 2000));
          if (document.content.rawText.length > 2000) {
            console.log(chalk.gray('... (truncated)'));
          }
        }
      } catch (error) {
        console.error(chalk.red('❌ Failed to show document:'), error);
        process.exit(1);
      }
    });

  // Status command
  docCommand
    .command('status')
    .description('Show document processor status')
    .action(async () => {
      try {
        const status = documentProcessor.getStatus();

        console.log(chalk.cyan('📄 Document Processor Status:'));
        console.log();
        console.log(`Initialized: ${status.initialized ? chalk.green('✅') : chalk.red('❌')}`);
        console.log(`Processed documents: ${status.processedDocuments}`);
        console.log(`Queue length: ${status.queueLength}`);
        console.log(`Currently processing: ${status.isProcessing ? chalk.yellow('Yes') : 'No'}`);
        console.log();
        console.log(chalk.cyan('Supported formats:'));
        status.supportedFormats.forEach((format) => {
          console.log(`  • ${format}`);
        });
      } catch (error) {
        console.error(chalk.red('❌ Status check failed:'), error);
        process.exit(1);
      }
    });

  return docCommand;
}
