/**
 * Code Command v2.1
 * Cloud-only code generation with compact output and quota footer
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
import chalk from 'chalk';

/**
 * Language to file extension mapping
 */
const LANGUAGE_EXTENSIONS: Record<string, string> = {
  javascript: '.js',
  typescript: '.ts',
  python: '.py',
  jsx: '.jsx',
  tsx: '.tsx',
  java: '.java',
  cpp: '.cpp',
  c: '.c',
  go: '.go',
  rust: '.rs',
  html: '.html',
  css: '.css',
};

export class CodeCommand extends BaseCommand {
  name = "code";
  category = "code" as const;
  description = "Generate code with AI";
  usage = "<request>";
  aliases = ["c"];
  
  examples: CommandExample[] = [
    {
      input: "/code create a button component",
      description: "Generate React button component",
      output: "Generated code saved to file",
    },
    {
      input: "/code fix this error: Cannot read property",
      description: "Fix JavaScript error",
      output: "Fixed code with explanation",
    },
  ];

  async execute(
    commandArgs: CommandArgs,
    context: CommandContext,
  ): Promise<CommandResult> {
    const request = commandArgs.raw.join(" ").trim();

    // Check for input
    if (!request) {
      return this.error('Please provide a code request · Example: /code create button component');
    }

    try {
      // Cloud-only API call
      const result = await executeCode(request);
      
      if (!result.output) {
        return this.error('No code generated · Try rephrasing your request');
      }

      // Extract code blocks
      const codeBlocks = this.extractCodeBlocks(result.output);
      
      if (codeBlocks.length === 0) {
        // No code blocks, return the response as-is
        const quotaLeft = context.user?.quotaLeft || 99;
        return this.success(withQuotaFooter(result.output, quotaLeft));
      }

      // Save code blocks to files
      const savedFiles: string[] = [];
      for (let i = 0; i < codeBlocks.length; i++) {
        const block = codeBlocks[i];
        const filePath = await this.saveCodeBlock(block, request, i);
        savedFiles.push(filePath);
      }

      // Compact output format as specified in plan
      const fileList = savedFiles.map(f => compactPath(f)).join(', ');
      const quotaLeft = context.user?.quotaLeft || 99;
      
      const message = savedFiles.length === 1 
        ? `✅ Saved ${fileList}`
        : `✅ Saved ${savedFiles.length} files: ${fileList}`;

      return this.success(withQuotaFooter(message, quotaLeft));

    } catch (error: any) {
      // Clean error handling - no stack traces
      if (error.message?.includes('Authentication required')) {
        return this.error('🔐 Authentication required · Run: /login', undefined, undefined, 2);
      }
      
      if (error.message?.includes('Quota exceeded')) {
        return this.error('⚠️ Quota exceeded · See /billing', undefined, undefined, 3);
      }
      
      if (error.message?.includes('Rate limit') || (error as any).status === 429) {
        // Try to parse as proper rate limit error
        try {
          const response = (error as any).response;
          if (response && response.status === 429) {
            const rateLimitError = await parseRateLimitResponse(response);
            if (rateLimitError) {
              handleRateLimitError(rateLimitError);
              return this.error('', undefined, undefined, 3); // Return empty message since handler already displayed it
            }
          }
        } catch {
          // Fallback to old behavior
        }
        
        const waitTime = this.extractWaitTime(error.message) || 3;
        return this.error(`⏱ Wait ${waitTime}s`, undefined, undefined, 5);
      }

      // Generic error - format cleanly
      return this.error(formatError(error));
    }
  }

  /**
   * Extract code blocks from AI response
   */
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

    // If no code blocks, try to detect if entire response is code
    if (blocks.length === 0 && this.looksLikeCode(content)) {
      blocks.push({
        code: content.trim(),
        language: this.detectLanguage(content)
      });
    }

    return blocks;
  }

  /**
   * Check if content looks like code
   */
  private looksLikeCode(content: string): boolean {
    const codeIndicators = [
      'function ', 'const ', 'let ', 'var ',
      'class ', 'def ', 'import ', 'export ',
      '{', '}', ';', '//', '/*'
    ];
    
    return codeIndicators.some(indicator => content.includes(indicator));
  }

  /**
   * Detect programming language from content
   */
  private detectLanguage(code: string): string {
    if (code.includes('import React') || code.includes('<')) return 'jsx';
    if (code.includes('interface ') || code.includes(': string')) return 'typescript';
    if (code.includes('def ') || code.includes('print(')) return 'python';
    if (code.includes('func ') || code.includes('package main')) return 'go';
    if (code.includes('fn ') || code.includes('let mut')) return 'rust';
    if (code.includes('<?php')) return 'php';
    if (code.includes('#include')) return 'cpp';
    
    return 'javascript';
  }

  /**
   * Save code block to file
   */
  private async saveCodeBlock(
    block: {code: string, language: string},
    request: string,
    index: number
  ): Promise<string> {
    // Generate filename from request
    const baseName = this.generateFilename(request, block.language);
    const extension = LANGUAGE_EXTENSIONS[block.language] || '.txt';
    const timestamp = Date.now().toString(36);
    
    const filename = index === 0 
      ? `${baseName}${extension}`
      : `${baseName}_${index + 1}${extension}`;
    
    const fullPath = path.join(process.cwd(), filename);
    
    try {
      await writeFile(fullPath, block.code, 'utf8');
      return fullPath;
    } catch (error) {
      // Fallback to temp filename if write fails
      const fallbackName = `code_${timestamp}${extension}`;
      const fallbackPath = path.join(process.cwd(), fallbackName);
      await writeFile(fallbackPath, block.code, 'utf8');
      return fallbackPath;
    }
  }

  /**
   * Generate filename from request
   */
  private generateFilename(request: string, language: string): string {
    // Extract meaningful words from request
    const words = request.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 3);
    
    if (words.length === 0) {
      return `code_${Date.now().toString(36)}`;
    }
    
    const baseName = words.join('_');
    
    // Add component suffix for React
    if (language === 'jsx' || language === 'tsx') {
      return baseName.includes('component') ? baseName : `${baseName}_component`;
    }
    
    return baseName;
  }

  /**
   * Extract wait time from rate limit error message
   */
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
export const codeCommand = new CodeCommand();

// Export metadata for registry
export const metadata = {
  name: 'code',
  description: 'Cloud-only code generation with compact output and quota footer',
  category: 'code',
  version: '2.1.0',
  type: 'functional' as const,
  planRequired: 'free' as const,
  isPreview: false
};

// Export execute function for registry
export async function execute(context: any): Promise<any> {
  return await codeCommand.execute(context.args || [], context);
};