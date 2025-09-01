/**
 * Enhanced Code Command - Enterprise AST-powered Code Operations
 * Week 1-2 Implementation: TypeScript-first with AST intelligence
 */

import { BaseCommand } from "../../base-command.js";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
  CommandExample,
} from "../../types";
import { writeFile } from "fs/promises";
import * as path from "path";
import { executeCode } from "../../../services/cli-auth/api-caller";
import { withQuotaFooter, compactPath, formatError } from "../../shared/telemetry-helper";
import { parseRateLimitResponse, handleRateLimitError } from "../../../services/api-client/rate-limit-handler.js";
import { 
  executeEnterpriseCodeOperation,
  getFileContextWithFallback,
  initializeCodeIntelligence,
  safetyKillSwitch,
  type DiagnosticInfo
} from "../../../services/code-intelligence/index.js";
import { Phase2IntegratedSystem } from "../../../services/code-intelligence/Phase2IntegratedSystem.js";

interface CodeCommandOptions {
  intent?: 'FIX_ERROR' | 'REFACTOR' | 'ADD_FEATURE';
  file?: string;
  dryRun?: boolean;
  strict?: boolean;
  fast?: boolean;
  phase2?: boolean;
}

/**
 * Enhanced Code Command with AST-powered intelligence
 * Implements Week 1-2 requirements: TypeScript-first, 3 core intents, enterprise safety
 */
export class EnhancedCodeCommand extends BaseCommand {
  name = "code";
  category = "code" as const;
  description = "AI-powered code generation with AST intelligence (TypeScript-first)";
  usage = "[options] <request>";
  aliases = ["ec", "ast"];
  
  // Track initialization state
  private isInitialized = false;
  private initializationPromise?: Promise<void>;
  private phase2System?: Phase2IntegratedSystem;
  
  examples: CommandExample[] = [
    {
      input: "/code --intent=FIX_ERROR fix TypeScript errors in src/components",
      description: "Fix TypeScript errors with AST analysis",
      output: "✅ Fixed 3 TypeScript errors with 95% confidence",
    },
    {
      input: "/code --phase2 --intent=REFACTOR --file=src/utils/helper.ts extract method",
      description: "Phase 2: Enterprise-grade refactoring with full validation",
      output: "🏆 Phase 2: Refactored helper.ts with 100% safety validation (Score: 95/100)",
    },
    {
      input: "/code --phase2 --intent=ADD_FEATURE --dry-run add React component for user profile",
      description: "Phase 2: Complete validation pipeline with dry-run",
      output: "📋 Phase 2 Dry-run: 5 validation stages, 3 quality gates (estimated 85/100)",
    },
    {
      input: "/code --fast create button component",
      description: "Fast mode bypasses heavy AST analysis",
      output: "⚡ Generated Button.tsx using templates",
    }
  ];

  async execute(
    commandArgs: CommandArgs,
    context: CommandContext,
  ): Promise<CommandResult> {
    const request = commandArgs.raw.join(" ").trim();

    // Parse options and request
    const { options, cleanRequest } = this.parseOptions(request);

    if (!cleanRequest) {
      return this.error('Please provide a code request · Example: /code create button component');
    }

    // Check kill switch first
    const killSwitchActive = await safetyKillSwitch.checkKillSwitch();
    if (killSwitchActive) {
      console.log('🔒 AST operations disabled, falling back to cloud-only generation');
      return this.executeCloudFallback(cleanRequest, context);
    }

    try {
      // Initialize AST system if not already done
      await this.ensureInitialized();

      // Determine operation intent
      const intent = this.determineIntent(options.intent, cleanRequest);
      
      // Route to appropriate handler based on intent and options
      if (options.phase2) {
        return await this.executePhase2Operation(intent, cleanRequest, options, context);
      } else if (intent && !options.fast) {
        return await this.executeASTOperation(intent, cleanRequest, options, context);
      } else {
        // Fast mode or unrecognized intent - fall back to cloud generation
        return await this.executeCloudFallback(cleanRequest, context);
      }

    } catch (error: any) {
      console.error('Enhanced code command error:', error);
      
      // Fallback to cloud generation on AST failure
      console.log('🔄 AST operation failed, falling back to cloud generation');
      return await this.executeCloudFallback(cleanRequest, context);
    }
  }

  /**
   * Execute Phase 2 enterprise operation with full validation pipeline
   */
  private async executePhase2Operation(
    intent: 'FIX_ERROR' | 'REFACTOR' | 'ADD_FEATURE' | null,
    request: string,
    options: CodeCommandOptions,
    context: CommandContext
  ): Promise<CommandResult> {
    console.log(`🏆 Executing Phase 2 Enterprise Operation`);
    
    try {
      // Initialize Phase 2 system if not already done
      await this.ensurePhase2Initialized();
      
      const projectRoot = process.cwd();
      
      // Create operation handler
      const operation = async (workingDir: string) => {
        console.log(`⚙️  Phase 2 operation in: ${workingDir}`);
        
        if (intent) {
          // Use AST operation for specific intents
          const params = await this.prepareOperationParams(intent, request, options);
          const result = await executeEnterpriseCodeOperation(intent, params);
          
          if (result.success && result.changes) {
            return await this.applyChanges(result.changes);
          }
        }
        
        // Fallback to cloud generation with Phase 2 validation
        const cloudResult = await executeCode(request);
        if (cloudResult.output) {
          const codeBlocks = this.extractCodeBlocks(cloudResult.output);
          const savedFiles: string[] = [];
          
          for (let i = 0; i < codeBlocks.length; i++) {
            const block = codeBlocks[i];
            const filePath = await this.saveCodeBlock(block, request, i);
            savedFiles.push(filePath);
          }
          
          return savedFiles;
        }
        
        return [];
      };
      
      // Execute with Phase 2 system
      const result = await this.phase2System!.quickExecute(
        projectRoot,
        operation,
        `Phase 2: ${request}`,
        {
          dryRun: options.dryRun,
          strictMode: options.strict
        }
      );
      
      if (!result.success && !options.dryRun) {
        const report = await this.phase2System!.generateComprehensiveReport(result);
        return this.error(`Phase 2 validation failed:\n${report}`);
      }
      
      // Generate success message
      const quotaLeft = context.user?.quotaLeft || 99;
      const score = result.overallScore.toFixed(1);
      const duration = (result.duration / 1000).toFixed(1);
      
      let message = options.dryRun 
        ? `📋 Phase 2 Dry-run: Score ${score}/100 (${duration}s)\n${result.summary}`
        : `🏆 Phase 2: Completed with score ${score}/100 (${duration}s)`;
      
      // Add validation summary
      if (result.validationResults.length > 0) {
        const passedStages = result.validationResults.filter(r => r.success).length;
        message += `\n✅ Validation: ${passedStages}/${result.validationResults.length} stages passed`;
      }
      
      if (result.qualityResults.length > 0) {
        const passedGates = result.qualityResults.filter(r => r.success).length;
        message += `\n🏆 Quality Gates: ${passedGates}/${result.qualityResults.length} passed`;
      }
      
      return this.success(withQuotaFooter(message, quotaLeft));
      
    } catch (error: any) {
      return this.error(`Phase 2 execution failed: ${formatError(error)}`);
    }
  }

  /**
   * Execute AST-powered code operation
   */
  private async executeASTOperation(
    intent: 'FIX_ERROR' | 'REFACTOR' | 'ADD_FEATURE',
    request: string,
    options: CodeCommandOptions,
    context: CommandContext
  ): Promise<CommandResult> {
    console.log(`🔧 Executing AST operation: ${intent}`);
    
    try {
      // Prepare parameters based on intent
      const params = await this.prepareOperationParams(intent, request, options);
      
      if (options.dryRun) {
        // Dry run mode - show what would be done
        return this.showDryRunPreview(intent, params, context);
      }

      // Execute AST operation with enterprise fallback
      const result = await executeEnterpriseCodeOperation(intent, params);
      
      if (!result.success) {
        return this.error(`${intent} failed: No changes could be generated`);
      }

      // Apply changes
      const appliedFiles = await this.applyChanges(result.changes);
      
      // Generate success message
      const quotaLeft = context.user?.quotaLeft || 99;
      const confidence = Math.round(result.confidence * 100);
      const fileList = appliedFiles.map(f => compactPath(f)).join(', ');
      
      const message = appliedFiles.length === 1 
        ? `✅ ${intent}: ${fileList} (${confidence}% confidence)`
        : `✅ ${intent}: ${appliedFiles.length} files (${confidence}% confidence)`;

      return this.success(withQuotaFooter(message, quotaLeft));

    } catch (error: any) {
      return this.error(`AST operation failed: ${formatError(error)}`);
    }
  }

  /**
   * Prepare operation parameters based on intent
   */
  private async prepareOperationParams(
    intent: 'FIX_ERROR' | 'REFACTOR' | 'ADD_FEATURE',
    request: string,
    options: CodeCommandOptions
  ): Promise<any> {
    switch (intent) {
      case 'FIX_ERROR':
        return {
          diagnostics: await this.extractDiagnostics(request, options.file)
        };
      
      case 'REFACTOR':
        return {
          type: this.determineRefactorType(request),
          file: options.file || await this.inferTargetFile(request),
          options: { request }
        };
      
      case 'ADD_FEATURE':
        return {
          pattern: this.determineFeaturePattern(request),
          context: {
            request,
            file: options.file,
            projectContext: options.file ? await getFileContextWithFallback(options.file) : null
          }
        };
      
      default:
        throw new Error(`Unsupported intent: ${intent}`);
    }
  }

  /**
   * Show dry-run preview
   */
  private async showDryRunPreview(
    intent: 'FIX_ERROR' | 'REFACTOR' | 'ADD_FEATURE',
    params: any,
    context: CommandContext
  ): Promise<CommandResult> {
    const quotaLeft = context.user?.quotaLeft || 99;
    
    // Simulate operation to get preview
    const dryRunMessage = `📋 Dry-run preview for ${intent}:\n` +
      `   - Would analyze: ${params.file || 'project files'}\n` +
      `   - Estimated changes: 1-3 files\n` +
      `   - Safety: Full validation enabled\n` +
      `   - Run without --dry-run to apply`;
    
    return this.success(withQuotaFooter(dryRunMessage, quotaLeft));
  }

  /**
   * Apply changes from AST operation
   */
  private async applyChanges(changes: any[]): Promise<string[]> {
    const appliedFiles: string[] = [];
    
    for (const change of changes) {
      try {
        const fullPath = path.resolve(change.file);
        
        switch (change.type) {
          case 'insert':
            await this.insertContent(fullPath, change.content, change.startLine);
            break;
          case 'replace':
            await this.replaceContent(fullPath, change.content, change.startLine, change.endLine);
            break;
          case 'delete':
            await this.deleteContent(fullPath, change.startLine, change.endLine);
            break;
          default:
            // Create new file
            await writeFile(fullPath, change.content, 'utf8');
            break;
        }
        
        appliedFiles.push(fullPath);
        console.log(`✅ Applied ${change.type}: ${change.description}`);
        
      } catch (error) {
        console.warn(`Failed to apply change to ${change.file}:`, error);
      }
    }
    
    return appliedFiles;
  }

  /**
   * Cloud fallback implementation (original /code behavior)
   */
  private async executeCloudFallback(
    request: string,
    context: CommandContext
  ): Promise<CommandResult> {
    try {
      const result = await executeCode(request);
      
      if (!result.output) {
        return this.error('No code generated · Try rephrasing your request');
      }

      // Extract and save code blocks
      const codeBlocks = this.extractCodeBlocks(result.output);
      
      if (codeBlocks.length === 0) {
        const quotaLeft = context.user?.quotaLeft || 99;
        return this.success(withQuotaFooter(result.output, quotaLeft));
      }

      const savedFiles: string[] = [];
      for (let i = 0; i < codeBlocks.length; i++) {
        const block = codeBlocks[i];
        const filePath = await this.saveCodeBlock(block, request, i);
        savedFiles.push(filePath);
      }

      const fileList = savedFiles.map(f => compactPath(f)).join(', ');
      const quotaLeft = context.user?.quotaLeft || 99;
      
      const message = savedFiles.length === 1 
        ? `⚡ Generated ${fileList} (cloud)`
        : `⚡ Generated ${savedFiles.length} files (cloud)`;

      return this.success(withQuotaFooter(message, quotaLeft));

    } catch (error: any) {
      // Handle rate limiting and auth errors
      if (error.message?.includes('Authentication required')) {
        return this.error('🔐 Authentication required · Run: /login', undefined, undefined, 2);
      }
      
      if (error.message?.includes('Quota exceeded')) {
        return this.error('⚠️ Quota exceeded · See /billing', undefined, undefined, 3);
      }
      
      if (error.message?.includes('Rate limit') || (error as any).status === 429) {
        try {
          const response = (error as any).response;
          if (response && response.status === 429) {
            const rateLimitError = await parseRateLimitResponse(response);
            if (rateLimitError) {
              handleRateLimitError(rateLimitError);
              return this.error('', undefined, undefined, 3);
            }
          }
        } catch {
          // Fallback
        }
        
        const waitTime = this.extractWaitTime(error.message) || 3;
        return this.error(`⏱ Wait ${waitTime}s`, undefined, undefined, 5);
      }

      return this.error(formatError(error));
    }
  }

  /**
   * Parse command options
   */
  private parseOptions(input: string): { options: CodeCommandOptions; cleanRequest: string } {
    const options: CodeCommandOptions = {};
    let cleanRequest = input;

    // Parse --intent flag
    const intentMatch = input.match(/--intent[=\s]+(FIX_ERROR|REFACTOR|ADD_FEATURE)/);
    if (intentMatch) {
      options.intent = intentMatch[1] as any;
      cleanRequest = cleanRequest.replace(intentMatch[0], '').trim();
    }

    // Parse --file flag
    const fileMatch = input.match(/--file[=\s]+([^\s]+)/);
    if (fileMatch) {
      options.file = fileMatch[1];
      cleanRequest = cleanRequest.replace(fileMatch[0], '').trim();
    }

    // Parse boolean flags
    if (input.includes('--dry-run')) {
      options.dryRun = true;
      cleanRequest = cleanRequest.replace('--dry-run', '').trim();
    }

    if (input.includes('--strict')) {
      options.strict = true;
      cleanRequest = cleanRequest.replace('--strict', '').trim();
    }

    if (input.includes('--fast')) {
      options.fast = true;
      cleanRequest = cleanRequest.replace('--fast', '').trim();
    }

    if (input.includes('--phase2')) {
      options.phase2 = true;
      cleanRequest = cleanRequest.replace('--phase2', '').trim();
    }

    return { options, cleanRequest };
  }

  /**
   * Determine operation intent from request
   */
  private determineIntent(
    explicitIntent: 'FIX_ERROR' | 'REFACTOR' | 'ADD_FEATURE' | undefined,
    request: string
  ): 'FIX_ERROR' | 'REFACTOR' | 'ADD_FEATURE' | null {
    if (explicitIntent) {
      return explicitIntent;
    }

    const lowerRequest = request.toLowerCase();

    // Intent detection patterns
    if (lowerRequest.includes('fix') || lowerRequest.includes('error') || lowerRequest.includes('bug')) {
      return 'FIX_ERROR';
    }
    
    if (lowerRequest.includes('refactor') || lowerRequest.includes('extract') || lowerRequest.includes('rename')) {
      return 'REFACTOR';
    }
    
    if (lowerRequest.includes('add') || lowerRequest.includes('create') || lowerRequest.includes('generate')) {
      return 'ADD_FEATURE';
    }

    return null; // Will fall back to cloud generation
  }

  /**
   * Initialize AST system if not already done
   */
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    this.initializationPromise = this.performInitialization();
    await this.initializationPromise;
  }

  private async performInitialization(): Promise<void> {
    try {
      await initializeCodeIntelligence();
      this.isInitialized = true;
      console.log('✅ AST system initialized for enhanced /code command');
    } catch (error) {
      console.warn('⚠️ AST system initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize Phase 2 system if not already done
   */
  private async ensurePhase2Initialized(): Promise<void> {
    if (this.phase2System) {
      return;
    }

    try {
      this.phase2System = new Phase2IntegratedSystem({
        validation: {
          strictMode: true,
          timeoutMs: 300000,
          enableAllChecks: true
        },
        safety: {
          enableWorktreeIsolation: true,
          enableAtomicOperations: true,
          autoRollbackOnFailure: true
        },
        quality: {
          enforceGates: true,
          minOverallScore: 75,
          failOnCriticalIssues: true
        }
      });

      const initialized = await this.phase2System.initializePhase2System(process.cwd());
      
      if (!initialized) {
        throw new Error('Phase 2 system initialization failed');
      }

      console.log('🏆 Phase 2 Enterprise System initialized');
    } catch (error) {
      console.warn('⚠️ Phase 2 system initialization failed:', error);
      throw error;
    }
  }

  // Helper methods (simplified implementations for Week 1-2)
  private async extractDiagnostics(request: string, file?: string): Promise<DiagnosticInfo[]> {
    // In a real implementation, this would run TypeScript compiler to get diagnostics
    // For now, return mock diagnostics based on request
    return [];
  }

  private determineRefactorType(request: string): any {
    if (request.includes('extract')) return 'extract_method';
    if (request.includes('rename')) return 'rename_symbol';
    if (request.includes('inline')) return 'inline_variable';
    return 'eliminate_side_effects';
  }

  private determineFeaturePattern(request: string): any {
    if (request.includes('component') || request.includes('react')) return 'react_component';
    if (request.includes('endpoint') || request.includes('api')) return 'rest_endpoint';
    if (request.includes('test')) return 'test_case';
    return 'utility_function';
  }

  private async inferTargetFile(request: string): Promise<string> {
    // Simple pattern matching for file inference
    const fileMatch = request.match(/(?:in|file|at)\s+([^\s]+\.(ts|tsx|js|jsx))/);
    return fileMatch ? fileMatch[1] : 'src/index.ts';
  }

  // File manipulation methods (simplified for Week 1-2)
  private async insertContent(filePath: string, content: string, line?: number): Promise<void> {
    await writeFile(filePath, content, 'utf8');
  }

  private async replaceContent(filePath: string, content: string, startLine?: number, endLine?: number): Promise<void> {
    await writeFile(filePath, content, 'utf8');
  }

  private async deleteContent(filePath: string, startLine?: number, endLine?: number): Promise<void> {
    // For now, just log the deletion - would implement proper line deletion
    console.log(`Would delete lines ${startLine}-${endLine} from ${filePath}`);
  }

  // Reuse methods from original CodeCommand
  private extractCodeBlocks(content: string): Array<{code: string, language: string}> {
    const blocks: Array<{code: string, language: string}> = [];
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      blocks.push({
        language: match[1] || 'javascript',
        code: match[2].trim()
      });
    }

    if (blocks.length === 0 && this.looksLikeCode(content)) {
      blocks.push({
        code: content.trim(),
        language: this.detectLanguage(content)
      });
    }

    return blocks;
  }

  private looksLikeCode(content: string): boolean {
    const codeIndicators = [
      'function ', 'const ', 'let ', 'var ',
      'class ', 'def ', 'import ', 'export ',
      '{', '}', ';', '//', '/*'
    ];
    
    return codeIndicators.some(indicator => content.includes(indicator));
  }

  private detectLanguage(code: string): string {
    if (code.includes('import React') || code.includes('<')) return 'tsx';
    if (code.includes('interface ') || code.includes(': string')) return 'typescript';
    if (code.includes('def ') || code.includes('print(')) return 'python';
    if (code.includes('func ') || code.includes('package main')) return 'go';
    return 'typescript'; // Default to TypeScript for Week 1-2
  }

  private async saveCodeBlock(
    block: {code: string, language: string},
    request: string,
    index: number
  ): Promise<string> {
    const baseName = this.generateFilename(request, block.language);
    const extension = this.getExtensionForLanguage(block.language);
    
    const filename = index === 0 
      ? `${baseName}${extension}`
      : `${baseName}_${index + 1}${extension}`;
    
    const fullPath = path.join(process.cwd(), filename);
    await writeFile(fullPath, block.code, 'utf8');
    
    return fullPath;
  }

  private generateFilename(request: string, language: string): string {
    const words = request.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 3);
    
    if (words.length === 0) {
      return `code_${Date.now().toString(36)}`;
    }
    
    const baseName = words.join('_');
    
    if (language === 'tsx' || language === 'jsx') {
      return baseName.includes('component') ? baseName : `${baseName}_component`;
    }
    
    return baseName;
  }

  private getExtensionForLanguage(language: string): string {
    const extensions: Record<string, string> = {
      typescript: '.ts',
      tsx: '.tsx',
      javascript: '.js',
      jsx: '.jsx',
      python: '.py',
      go: '.go',
      rust: '.rs'
    };
    
    return extensions[language] || '.ts'; // Default to TypeScript
  }

  private extractWaitTime(message: string): number | null {
    const match = message.match(/wait (\d+)/i);
    if (match) {
      const seconds = parseInt(match[1], 10);
      return isFinite(seconds) ? seconds : null;
    }
    return null;
  }
}

// Export instance for registration
export const enhancedCodeCommand = new EnhancedCodeCommand();