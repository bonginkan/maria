/**
 * Enhanced Filename Inference Service v2.0
 * 5-stage inference pipeline with timeout control and LRU caching
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import { LRUCache } from './cache/LRUCache';
import { ExplicitAnalyzer } from './analyzers/ExplicitAnalyzer';
import { ProjectConventionAnalyzer } from './analyzers/ProjectConventionAnalyzer';
import { ContextualAnalyzer } from './analyzers/ContextualAnalyzer';
import { SemanticAnalyzer } from './analyzers/SemanticAnalyzer';
import { ExtensionDetector } from './analyzers/ExtensionDetector';
import { filenameInferenceTelemetry } from './telemetry/FilenameInferenceTelemetry';
import {
  FilenameCandidate,
  InferenceResult,
  ProjectContext,
  InferenceSource,
  ExtensionResult
} from './types/filename-inference.types';

interface InferencePipeline {
  stages: InferenceStage[];
  timeout: number; // 100ms limit
}

interface InferenceStage {
  name: InferenceSource;
  analyzer: any;
  weight: number;
  cache: LRUCache<string, InferenceResult>;
}

interface IDefaultAnalyzer {
  analyze(prompt: string, code: string, context: ProjectContext): Promise<FilenameCandidate>;
}

export class FilenameInferenceServiceV2 {
  private pipeline: InferencePipeline;
  private extensionDetector: ExtensionDetector;
  
  constructor() {
    this.extensionDetector = new ExtensionDetector();
    
    this.pipeline = {
      timeout: 100, // 100ms as specified in SOW
      stages: [
        { 
          name: 'explicit', 
          analyzer: new ExplicitAnalyzer(), 
          weight: 1.0,
          cache: new LRUCache<string, InferenceResult>(50)
        },
        { 
          name: 'project', 
          analyzer: new ProjectConventionAnalyzer(), 
          weight: 0.9,
          cache: new LRUCache<string, InferenceResult>(30)
        },
        { 
          name: 'contextual', 
          analyzer: new ContextualAnalyzer(), 
          weight: 0.7,
          cache: new LRUCache<string, InferenceResult>(40)
        },
        { 
          name: 'semantic', 
          analyzer: new SemanticAnalyzer(), 
          weight: 0.5,
          cache: new LRUCache<string, InferenceResult>(20)
        },
        { 
          name: 'default', 
          analyzer: new DefaultAnalyzer(), 
          weight: 0.3,
          cache: new LRUCache<string, InferenceResult>(10)
        }
      ]
    };
  }
  
  /**
   * Main inference method with 5-stage pipeline
   */
  async infer(prompt: string, code: string, context: ProjectContext): Promise<InferenceResult> {
    const startTime = Date.now();
    const candidates: FilenameCandidate[] = [];
    let timedOut = false;
    
    // Record telemetry start
    const endTiming = filenameInferenceTelemetry.startInference(prompt, context);
    
    try {
      for (const stage of this.pipeline.stages) {
        // Timeout check
        if (Date.now() - startTime > this.pipeline.timeout) {
          console.warn(`Inference timeout at stage: ${stage.name}`);
          timedOut = true;
          break;
        }
        
        // Generate cache key
        const cacheKey = this.generateCacheKey(stage.name, prompt, code);
        
        // Check cache first
        const cached = stage.cache.get(cacheKey);
        if (cached) {
          candidates.push(...cached.candidates);
          continue;
        }
        
        // Run analysis
        try {
          const stageStart = Date.now();
          const candidate = await stage.analyzer.analyze(prompt, code, context);
          
          // Apply weight to confidence
          candidate.confidence *= stage.weight;
          candidate.source = stage.name;
          
          candidates.push(candidate);
          
          // Cache result
          const stageResult: InferenceResult = {
            candidates: [candidate],
            selectedIndex: 0,
            mode: 'dry-run'
          };
          stage.cache.set(cacheKey, stageResult);
          
          // Record stage telemetry
          filenameInferenceTelemetry.recordAnalyzerComplete(
            stage.name, 
            [candidate], 
            Date.now() - stageStart
          );
          
        } catch (error) {
          console.error(`Stage ${stage.name} failed:`, error);
          // Continue to next stage
        }
      }
      
      // Ensure we always have at least one candidate
      if (candidates.length === 0) {
        candidates.push({
          path: 'code-file.txt',
          filename: 'code-file.txt',
          extension: '.txt',
          confidence: 0.1,
          reasoning: 'Fallback when no analyzers produced results',
          source: 'default'
        });
      }
      
      // Rank and return results
      const rankedCandidates = this.rankResults(candidates);
      const result: InferenceResult = {
        candidates: rankedCandidates,
        selectedIndex: 0,
        mode: this.determineMode(rankedCandidates[0]?.confidence || 0),
        timedOut
      };
      
      // Record completion telemetry if we have candidates
      if (result.candidates.length > 0) {
        filenameInferenceTelemetry.recordInferenceComplete(
          result as any, 
          Date.now() - startTime
        );
      }
      
      return result;
      
    } finally {
      endTiming();
    }
  }
  
  /**
   * Enhanced extension detection with multi-layer approach
   */
  async detectExtension(code: string, context: ProjectContext): Promise<ExtensionResult> {
    // 1. Project preference priority
    const projectExt = await this.getProjectPreference(context);
    if (projectExt) {
      return { ext: projectExt, source: 'project', confidence: 1.0 };
    }
    
    // 2. Code fence detection
    const fence = this.detectCodeFence(code);
    if (fence) {
      return { ext: fence, source: 'fence', confidence: 0.95 };
    }
    
    // 3. MIME heuristics
    const mime = this.detectByMimeHeuristics(code);
    if (mime.confidence > 0.8) {
      return mime;
    }
    
    // 4. Import/syntax analysis
    return this.analyzeSyntax(code);
  }
  
  /**
   * Generate cache key for consistent caching
   */
  private generateCacheKey(stageName: string, prompt: string, code: string): string {
    // Use a simple hash for caching - in production use crypto.createHash
    const content = `${stageName}:${prompt.substring(0, 100)}:${code.substring(0, 200)}`;
    return Buffer.from(content).toString('base64').substring(0, 32);
  }
  
  /**
   * Rank results by confidence and source priority
   */
  private rankResults(candidates: FilenameCandidate[]): FilenameCandidate[] {
    return candidates
      .filter(c => c.confidence > 0.1) // Filter out very low confidence
      .sort((a, b) => {
        // First sort by confidence
        const confidenceDiff = b.confidence - a.confidence;
        if (Math.abs(confidenceDiff) > 0.1) {
          return confidenceDiff;
        }
        
        // Then by source priority
        const sourcePriority = {
          'explicit': 5,
          'project': 4,
          'contextual': 3,
          'semantic': 2,
          'default': 1
        };
        
        const aPriority = sourcePriority[a.source as keyof typeof sourcePriority] || 0;
        const bPriority = sourcePriority[b.source as keyof typeof sourcePriority] || 0;
        
        return bPriority - aPriority;
      });
  }
  
  /**
   * Determine save mode based on confidence
   */
  private determineMode(confidence: number): 'immediate' | 'interactive' | 'dry-run' {
    if (confidence >= 0.9) return 'immediate';
    if (confidence >= 0.7) return 'interactive';
    return 'dry-run';
  }
  
  /**
   * Get project extension preference
   */
  private async getProjectPreference(context: ProjectContext): Promise<string | null> {
    if (!context?.root) return null;
    
    try {
      // Check package.json for hints
      const packagePath = path.join(context.root, 'package.json');
      if (fs.existsSync(packagePath)) {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
        
        if (pkg.dependencies?.typescript || pkg.devDependencies?.typescript) {
          return '.ts';
        }
        if (pkg.dependencies?.react || pkg.devDependencies?.react) {
          return '.tsx';
        }
      }
      
      // Check tsconfig.json
      const tsconfigPath = path.join(context.root, 'tsconfig.json');
      if (fs.existsSync(tsconfigPath)) {
        return '.ts';
      }
      
    } catch (error) {
      // Ignore errors
    }
    
    return null;
  }
  
  /**
   * Detect code fence language
   */
  private detectCodeFence(code: string): string | null {
    const fenceMatch = code.match(/^```(\w+)/m);
    if (fenceMatch) {
      const lang = fenceMatch[1].toLowerCase();
      const extensions = {
        'javascript': '.js',
        'typescript': '.ts',
        'jsx': '.jsx',
        'tsx': '.tsx',
        'python': '.py',
        'html': '.html',
        'css': '.css',
        'json': '.json',
        'yaml': '.yml',
        'sql': '.sql',
        'bash': '.sh',
        'rust': '.rs',
        'go': '.go'
      };
      return extensions[lang as keyof typeof extensions] || `.${lang}`;
    }
    return null;
  }
  
  /**
   * MIME type heuristic detection
   */
  private detectByMimeHeuristics(code: string): ExtensionResult {
    const patterns = [
      { regex: /^<!DOCTYPE\s+html/i, ext: '.html', confidence: 0.95 },
      { regex: /^#!\/usr\/bin\/env\s+python/i, ext: '.py', confidence: 0.95 },
      { regex: /^#!\/usr\/bin\/env\s+node/i, ext: '.js', confidence: 0.95 },
      { regex: /^import\s+React/m, ext: '.tsx', confidence: 0.9 },
      { regex: /^import\s+{.*}\s+from\s+['"]react['"]/m, ext: '.tsx', confidence: 0.9 },
      { regex: /^const\s+.*:\s*React\.FC/m, ext: '.tsx', confidence: 0.95 },
      { regex: /^<template>/m, ext: '.vue', confidence: 0.95 },
      { regex: /^package\s+main/m, ext: '.go', confidence: 0.95 },
      { regex: /^use\s+strict/m, ext: '.pl', confidence: 0.8 },
      { regex: /^fn\s+main\(\)/m, ext: '.rs', confidence: 0.95 }
    ];
    
    for (const pattern of patterns) {
      if (pattern.regex.test(code)) {
        return { ext: pattern.ext, source: 'mime', confidence: pattern.confidence };
      }
    }
    
    return { ext: '.txt', source: 'default', confidence: 0.3 };
  }
  
  /**
   * Syntax analysis for extension detection
   */
  private analyzeSyntax(code: string): ExtensionResult {
    // Check for TypeScript specific syntax
    if (/:\s*\w+(\[\])?(\s*=|;|\s*\{)/.test(code) || /interface\s+\w+/.test(code)) {
      return { ext: '.ts', source: 'syntax', confidence: 0.85 };
    }
    
    // Check for JSX/TSX
    if (/<\w+[^>]*>/.test(code) && /import.*react/i.test(code)) {
      return { ext: '.tsx', source: 'syntax', confidence: 0.9 };
    }
    
    // Check for Python
    if (/^(def|class|import|from)\s+/m.test(code)) {
      return { ext: '.py', source: 'syntax', confidence: 0.8 };
    }
    
    // Check for JSON
    if (/^\s*[\{\[]/.test(code.trim()) && /["']\s*:\s*/.test(code)) {
      return { ext: '.json', source: 'syntax', confidence: 0.85 };
    }
    
    // Default to JavaScript
    return { ext: '.js', source: 'syntax', confidence: 0.5 };
  }
  
  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const stage of this.pipeline.stages) {
      stats[stage.name] = {
        ...stage.cache.getStats(),
        weight: stage.weight
      };
    }
    
    return stats;
  }
  
  /**
   * Clear all caches
   */
  clearCaches(): void {
    for (const stage of this.pipeline.stages) {
      stage.cache.clear();
    }
  }
}

/**
 * Default analyzer for fallback scenarios
 */
class DefaultAnalyzer implements IDefaultAnalyzer {
  async analyze(prompt: string, code: string, context: ProjectContext): Promise<FilenameCandidate> {
    // Simple timestamp-based fallback
    const timestamp = new Date().toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, -5);
    
    return {
      path: `code_${timestamp}.txt`,
      filename: `code_${timestamp}.txt`,
      extension: '.txt',
      confidence: 0.3,
      reasoning: 'Default timestamp-based naming',
      source: 'default'
    };
  }
}