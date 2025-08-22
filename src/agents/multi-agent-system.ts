/**
 * Multi-Agent System Manager
 * Main interface for managing the DeepCode-inspired multi-agent system
 */

import { CentralOrchestrator } from './orchestrator';
import {
  AgentResult,
  AgentRole,
  AgentTask,
  ExecutionPlan,
  PaperProcessingRequest,
  TaskNode,
} from './types';
import { SynthesizedOutput } from './enhanced-communication';
import { codeRAGService } from '../services/coderag-system';
import { documentProcessor } from '../services/document-processor';
import {
  AlgorithmExtractorAgent,
  CitationManagerAgent,
  CodeGeneratorAgent,
  ConceptAnalyzerAgent,
  DocumentParserAgent,
  LiteratureReviewerAgent,
  QualityAssuranceAgent,
} from './specialized';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class MultiAgentSystem {
  private static instance: MultiAgentSystem;
  private orchestrator: CentralOrchestrator;
  private isInitialized = false;

  private constructor() {
    this.orchestrator = new CentralOrchestrator({
      maxConcurrentTasks: 3,
      taskTimeout: 60000, // 60 seconds
      loadBalancing: 'capability-based',
    });
  }

  public static getInstance(): MultiAgentSystem {
    if (!MultiAgentSystem.instance) {
      MultiAgentSystem.instance = new MultiAgentSystem();
    }
    return MultiAgentSystem.instance;
  }

  /**
   * Initialize the multi-agent system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Multi-agent system already initialized');
      return;
    }

    logger.info('Initializing multi-agent system...');

    try {
      // Initialize supporting services
      await this.initializeSupportingServices();

      // Register all specialized agents
      await this.orchestrator.registerAgent(new DocumentParserAgent());
      await this.orchestrator.registerAgent(new AlgorithmExtractorAgent());
      await this.orchestrator.registerAgent(new CodeGeneratorAgent());
      await this.orchestrator.registerAgent(new LiteratureReviewerAgent());
      await this.orchestrator.registerAgent(new ConceptAnalyzerAgent());
      await this.orchestrator.registerAgent(new QualityAssuranceAgent());
      await this.orchestrator.registerAgent(new CitationManagerAgent());

      // Start the orchestrator
      this.orchestrator.start();

      this.isInitialized = true;
      logger.info('Multi-agent system initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize multi-agent system:', error);
      throw error;
    }
  }

  /**
   * Shutdown the multi-agent system
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    logger.info('Shutting down multi-agent system...');
    await this.orchestrator.stop();
    this.isInitialized = false;
  }

  /**
   * Process a paper using the multi-agent system
   * This is the main /paper command implementation
   */
  async processPaper(request: PaperProcessingRequest): Promise<{
    success: boolean;
    results: Map<string, AgentResult>;
    error?: string;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      logger.info('Processing paper with multi-agent system');

      // Create execution plan
      const plan = this.createPaperProcessingPlan(request);

      // Execute the plan
      const results = await this.orchestrator.executePlan(plan);

      return {
        success: true,
        results,
      };
    } catch (error) {
      logger.error('Paper processing failed:', error);
      return {
        success: false,
        results: new Map(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Enhanced paper processing with result synthesis
   */
  async processEnhancedPaper(request: PaperProcessingRequest): Promise<{
    success: boolean;
    synthesizedOutput?: SynthesizedOutput;
    error?: string;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      logger.info('Processing paper with enhanced multi-agent system');

      // Create enhanced tasks
      const tasks = this.createEnhancedPaperTasks(request);
      const workflowId = uuidv4();
      const userIntent = `Process paper: ${request.source} with ${request.options.targetLanguage || 'TypeScript'} output`;

      // Execute enhanced workflow
      const synthesizedOutput = await this.orchestrator.executeEnhancedWorkflow(
        workflowId,
        tasks,
        userIntent,
      );

      return {
        success: true,
        synthesizedOutput,
      };
    } catch (error) {
      logger.error('Enhanced paper processing failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Create enhanced tasks for paper processing
   */
  private createEnhancedPaperTasks(request: PaperProcessingRequest): AgentTask[] {
    const tasks: AgentTask[] = [];

    // Task 1: Document Parsing
    tasks.push({
      id: uuidv4(),
      type: 'enhanced-document-parsing',
      priority: 1,
      input: request,
      requiredCapabilities: [AgentRole.DOCUMENT_PARSER],
      context: {
        userIntent: 'Extract document structure and content',
        qualityRequirements: ['accuracy', 'completeness'],
      },
    });

    // Task 2: Algorithm Extraction
    if (request.options.extractAlgorithms) {
      tasks.push({
        id: uuidv4(),
        type: 'enhanced-algorithm-extraction',
        priority: 2,
        input: request,
        requiredCapabilities: [AgentRole.ALGORITHM_EXTRACTOR],
        context: {
          userIntent: 'Extract algorithmic concepts and procedures',
          qualityRequirements: ['precision', 'algorithmic-accuracy'],
        },
      });
    }

    // Task 3: Code Generation
    tasks.push({
      id: uuidv4(),
      type: 'enhanced-code-generation',
      priority: 3,
      input: {
        targetLanguage: request.options.targetLanguage || 'typescript',
        framework: request.options.framework || 'none',
        generateTests: request.options.generateTests,
        includeDocumentation: request.options.includeDocumentation,
      },
      requiredCapabilities: [AgentRole.CODE_GENERATOR],
      context: {
        userIntent: 'Generate production-ready code implementation',
        qualityRequirements: ['code-quality', 'test-coverage', 'documentation'],
      },
    });

    // Task 4: Quality Assurance
    tasks.push({
      id: uuidv4(),
      type: 'enhanced-quality-assurance',
      priority: 4,
      input: request,
      requiredCapabilities: [AgentRole.QUALITY_ASSURANCE],
      context: {
        userIntent: 'Validate implementation quality and correctness',
        qualityRequirements: ['correctness', 'performance', 'maintainability'],
      },
    });

    return tasks;
  }

  /**
   * Initialize supporting services
   */
  private async initializeSupportingServices(): Promise<void> {
    logger.info('Initializing supporting services...');

    try {
      // Initialize CodeRAG system
      await codeRAGService.initialize();
      logger.info('CodeRAG service initialized');

      // Initialize document processor
      await documentProcessor.initialize();
      logger.info('Document processor initialized');
    } catch (error) {
      logger.warn('Some supporting services failed to initialize:', error);
      // Continue initialization even if some services fail
    }
  }

  /**
   * Enhanced paper processing with CodeRAG and document processing
   */
  async processEnhancedPaperWithRAG(request: PaperProcessingRequest): Promise<{
    success: boolean;
    synthesizedOutput?: SynthesizedOutput;
    documentAnalysis?: unknown;
    codebaseInsights?: unknown;
    error?: string;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      logger.info('Processing paper with enhanced CodeRAG and document processing');

      // Step 1: Process document using advanced document processor
      let documentAnalysis: unknown = null;
      if (request.source === 'pdf' || request.source === 'arxiv') {
        const document = await documentProcessor.processDocument(
          {
            type: request.source,
            identifier: request.content.toString(),
          },
          {
            extractStructure: true,
            extractAlgorithms: true,
            extractCode: true,
            extractFormulas: true,
          },
        );

        documentAnalysis = {
          title: document.title,
          algorithmsFound: document.content.extractedElements.algorithms.length,
          codeBlocksFound: document.content.extractedElements.codeBlocks.length,
          qualityScore: document.metadata.processingQuality.overallScore,
          insights: document.content.extractedElements.algorithms.map((a) => a.description),
        };
      }

      // Step 2: Perform codebase analysis with CodeRAG if relevant
      let codebaseInsights: unknown = null;
      if (request.options.targetLanguage && request.options.targetLanguage !== 'none') {
        // Analyze existing codebase for similar patterns
        const analysis = await codeRAGService.analyzeCodebase(['.'], {
          includePatterns: true,
          includeComplexity: true,
          includeInsights: true,
        });

        codebaseInsights = {
          totalFiles: analysis.codebase.totalFiles,
          languages: analysis.codebase.languages,
          commonPatterns: analysis.patterns.commonPatterns.slice(0, 5),
          recommendations: analysis.recommendations.slice(0, 3),
        };
      }

      // Step 3: Create enhanced tasks with RAG context
      const enhancedTasks = this.createEnhancedPaperTasksWithRAG(request, {
        documentAnalysis,
        codebaseInsights,
      });

      const workflowId = uuidv4();
      const userIntent = `Enhanced paper processing with CodeRAG: ${request.source} → ${request.options.targetLanguage || 'TypeScript'}`;

      // Step 4: Execute enhanced workflow
      const synthesizedOutput = await this.orchestrator.executeEnhancedWorkflow(
        workflowId,
        enhancedTasks,
        userIntent,
      );

      return {
        success: true,
        synthesizedOutput,
        documentAnalysis,
        codebaseInsights,
      };
    } catch (error) {
      logger.error('Enhanced paper processing with RAG failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Create enhanced tasks with CodeRAG context
   */
  private createEnhancedPaperTasksWithRAG(
    request: PaperProcessingRequest,
    ragContext: {
      documentAnalysis?: unknown;
      codebaseInsights?: unknown;
    },
  ): AgentTask[] {
    const tasks: AgentTask[] = [];

    // Task 1: Enhanced Document Parsing with RAG
    tasks.push({
      id: uuidv4(),
      type: 'enhanced-document-parsing-rag',
      priority: 1,
      input: {
        ...request,
        ragContext: ragContext.documentAnalysis,
      },
      requiredCapabilities: [AgentRole.DOCUMENT_PARSER],
      context: {
        userIntent: 'Advanced document analysis with semantic understanding',
        qualityRequirements: ['accuracy', 'completeness', 'semantic-analysis'],
        ragEnabled: true,
      },
    });

    // Task 2: CodeRAG-Enhanced Algorithm Extraction
    if (request.options.extractAlgorithms) {
      tasks.push({
        id: uuidv4(),
        type: 'coderag-algorithm-extraction',
        priority: 2,
        input: {
          ...request,
          codebaseContext: ragContext.codebaseInsights,
        },
        requiredCapabilities: [AgentRole.ALGORITHM_EXTRACTOR],
        context: {
          userIntent: 'Extract algorithms with codebase pattern awareness',
          qualityRequirements: ['precision', 'algorithmic-accuracy', 'pattern-matching'],
          ragEnabled: true,
        },
      });
    }

    // Task 3: Intelligent Code Generation with RAG
    tasks.push({
      id: uuidv4(),
      type: 'intelligent-code-generation-rag',
      priority: 3,
      input: {
        targetLanguage: request.options.targetLanguage || 'typescript',
        framework: request.options.framework || 'none',
        generateTests: request.options.generateTests,
        includeDocumentation: request.options.includeDocumentation,
        codebasePatterns: ragContext.codebaseInsights,
      },
      requiredCapabilities: [AgentRole.CODE_GENERATOR],
      context: {
        userIntent: 'Generate code using codebase patterns and best practices',
        qualityRequirements: ['code-quality', 'pattern-consistency', 'test-coverage'],
        ragEnabled: true,
      },
    });

    // Task 4: RAG-Enhanced Quality Assurance
    tasks.push({
      id: uuidv4(),
      type: 'rag-enhanced-quality-assurance',
      priority: 4,
      input: {
        ...request,
        qualityContext: {
          documentAnalysis: ragContext.documentAnalysis,
          codebaseInsights: ragContext.codebaseInsights,
        },
      },
      requiredCapabilities: [AgentRole.QUALITY_ASSURANCE],
      context: {
        userIntent: 'Comprehensive quality validation with RAG insights',
        qualityRequirements: ['correctness', 'performance', 'maintainability', 'consistency'],
        ragEnabled: true,
      },
    });

    return tasks;
  }

  /**
   * Index current codebase for CodeRAG
   */
  async indexCurrentCodebase(
    path: string = '.',
    options: {
      fileTypes?: string[];
      excludePaths?: string[];
    } = {},
  ): Promise<{
    success: boolean;
    indexed?: number;
    error?: string;
  }> {
    try {
      logger.info(`Indexing codebase for CodeRAG: ${path}`);

      const result = await codeRAGService.indexCodebase(path, {
        fileTypes: options.fileTypes || ['.ts', '.tsx', '.js', '.jsx'],
        excludePaths: options.excludePaths || ['node_modules', 'dist', '.git'],
        chunkSize: 500,
        includeTests: false,
      });

      return {
        success: true,
        indexed: result.indexed,
      };
    } catch (error) {
      logger.error('Codebase indexing failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Search codebase using CodeRAG
   */
  async searchCodebase(
    query: string,
    options: {
      language?: string;
      maxResults?: number;
    } = {},
  ): Promise<{
    success: boolean;
    results?: unknown[];
    error?: string;
  }> {
    try {
      logger.info(`Searching codebase with CodeRAG: "${query}"`);

      const results = await codeRAGService.semanticSearch({
        query,
        language: options.language,
        maxResults: options.maxResults || 5,
        threshold: 0.7,
      });

      return {
        success: true,
        results: results.map((r) => ({
          file: r.chunk.filePath,
          similarity: r.similarity,
          explanation: r.explanation,
          relevance: r.relevanceScore,
        })),
      };
    } catch (error) {
      logger.error('Codebase search failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Create an execution plan for paper processing
   */
  private createPaperProcessingPlan(request: PaperProcessingRequest): ExecutionPlan {
    const planId = uuidv4();
    const tasks: TaskNode[] = [];
    const dependencies = new Map<string, string[]>();

    // Task 1: Document Parsing
    const parseTaskId = uuidv4();
    tasks.push({
      id: parseTaskId,
      task: {
        id: parseTaskId,
        type: 'document-parsing',
        priority: 1,
        input: request,
        requiredCapabilities: [AgentRole.DOCUMENT_PARSER],
      },
      status: 'pending',
    });

    // Task 2: Algorithm Extraction (depends on parsing)
    const extractTaskId = uuidv4();
    tasks.push({
      id: extractTaskId,
      task: {
        id: extractTaskId,
        type: 'algorithm-extraction',
        priority: 2,
        input: null, // Will be filled from parse result
        requiredCapabilities: [AgentRole.ALGORITHM_EXTRACTOR],
      },
      status: 'pending',
    });
    dependencies.set(extractTaskId, [parseTaskId]);

    // Task 3: Literature Review (can run in parallel with extraction)
    if (request.options.includeDocumentation) {
      const reviewTaskId = uuidv4();
      tasks.push({
        id: reviewTaskId,
        task: {
          id: reviewTaskId,
          type: 'literature-review',
          priority: 2,
          input: request,
          requiredCapabilities: [AgentRole.LITERATURE_REVIEWER],
        },
        status: 'pending',
      });
      dependencies.set(reviewTaskId, [parseTaskId]);
    }

    // Task 4: Code Generation (depends on algorithm extraction)
    const codeTaskId = uuidv4();
    tasks.push({
      id: codeTaskId,
      task: {
        id: codeTaskId,
        type: 'code-generation',
        priority: 3,
        input: {
          algorithms: null, // Will be filled from extraction result
          targetLanguage: request.options.targetLanguage || 'typescript',
          framework: request.options.framework || 'none',
          options: {
            generateTests: request.options.generateTests,
            includeDocumentation: request.options.includeDocumentation,
          },
        },
        requiredCapabilities: [AgentRole.CODE_GENERATOR],
      },
      status: 'pending',
    });
    dependencies.set(codeTaskId, [extractTaskId]);

    // Task 5: Quality Assurance (depends on code generation)
    const qaTaskId = uuidv4();
    tasks.push({
      id: qaTaskId,
      task: {
        id: qaTaskId,
        type: 'quality-assurance',
        priority: 4,
        input: null, // Will be filled from code generation result
        requiredCapabilities: [AgentRole.QUALITY_ASSURANCE],
      },
      status: 'pending',
    });
    dependencies.set(qaTaskId, [codeTaskId]);

    // Task 6: Citation Management (if documentation is enabled)
    if (request.options.includeDocumentation) {
      const citationTaskId = uuidv4();
      tasks.push({
        id: citationTaskId,
        task: {
          id: citationTaskId,
          type: 'citation-management',
          priority: 3,
          input: request,
          requiredCapabilities: [AgentRole.CITATION_MANAGER],
        },
        status: 'pending',
      });
      dependencies.set(citationTaskId, [parseTaskId]);
    }

    return {
      id: planId,
      tasks,
      dependencies,
      estimatedDuration: 120000, // 2 minutes
      requiredAgents: [
        AgentRole.DOCUMENT_PARSER,
        AgentRole.ALGORITHM_EXTRACTOR,
        AgentRole.CODE_GENERATOR,
        AgentRole.QUALITY_ASSURANCE,
        ...(request.options.includeDocumentation
          ? [AgentRole.LITERATURE_REVIEWER, AgentRole.CITATION_MANAGER]
          : []),
      ],
    };
  }

  /**
   * Get system status
   */
  getStatus(): {
    initialized: boolean;
    orchestratorStatus: unknown;
  } {
    return {
      initialized: this.isInitialized,
      orchestratorStatus: this.orchestrator.getStatus(),
    };
  }

  /**
   * Submit a custom task to the system
   */
  async submitTask(task: AgentTask): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return await this.orchestrator.submitTask(task);
  }

  /**
   * Enhanced paper processing with streaming updates
   */
  async *processPaperWithStreaming(request: PaperProcessingRequest): AsyncGenerator<{
    stage: string;
    progress: number;
    result?: unknown;
    error?: string;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      yield { stage: 'Initializing', progress: 0 };

      // Create and start processing plan
      const plan = this.createPaperProcessingPlan(request);
      yield { stage: 'Plan Created', progress: 10 };

      // Process tasks sequentially with progress updates
      const totalTasks = plan.tasks.length;
      let completedTasks = 0;

      for (const taskNode of plan.tasks) {
        yield {
          stage: `Processing ${taskNode.task.type}`,
          progress: 10 + (completedTasks / totalTasks) * 80,
        };

        const taskId = await this.orchestrator.submitTask(taskNode.task);

        // Wait for completion (simplified)
        await new Promise((resolve) => setTimeout(resolve, 1000));

        completedTasks++;

        yield {
          stage: `Completed ${taskNode.task.type}`,
          progress: 10 + (completedTasks / totalTasks) * 80,
          result: { taskId, type: taskNode.task.type },
        };
      }

      yield { stage: 'Finalizing', progress: 95 };
      yield { stage: 'Complete', progress: 100 };
    } catch (error) {
      yield {
        stage: 'Error',
        progress: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
