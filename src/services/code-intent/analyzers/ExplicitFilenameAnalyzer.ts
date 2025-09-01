/**
 * Explicit Filename Analyzer
 * Detects when user explicitly specifies a filename
 */

import { FilenameCandidate, FilenamePattern } from '../types/filename-inference.types.js';
import * as path from 'path';

export class ExplicitFilenameAnalyzer {
  private patterns: FilenamePattern[];

  constructor() {
    this.patterns = [
      // Japanese patterns
      {
        pattern: /(?:を|で|として|に|へ)\s*([a-zA-Z0-9_\-]+\.\w+)/,
        extractor: (match) => match[1],
        confidence: 0.95,
        priority: 1
      },
      {
        pattern: /([a-zA-Z0-9_\-]+\.\w+)\s*(?:で|を|として|に|へ)/,
        extractor: (match) => match[1],
        confidence: 0.95,
        priority: 1
      },
      {
        pattern: /(?:作成|作って|生成).*?([a-zA-Z0-9_\-]+\.\w+)/,
        extractor: (match) => match[1],
        confidence: 0.9,
        priority: 2
      },
      
      // English patterns
      {
        pattern: /create\s+(?:a\s+)?(?:file\s+)?(?:named\s+)?([a-zA-Z0-9_\-]+\.\w+)/i,
        extractor: (match) => match[1],
        confidence: 0.95,
        priority: 1
      },
      {
        pattern: /save\s+(?:as|to)\s+([a-zA-Z0-9_\-]+\.\w+)/i,
        extractor: (match) => match[1],
        confidence: 0.95,
        priority: 1
      },
      {
        pattern: /(?:in|into)\s+(?:file\s+)?([a-zA-Z0-9_\-]+\.\w+)/i,
        extractor: (match) => match[1],
        confidence: 0.9,
        priority: 2
      },
      {
        pattern: /([a-zA-Z0-9_\-]+\.\w+)\s+(?:file|for|with)/i,
        extractor: (match) => match[1],
        confidence: 0.85,
        priority: 3
      },
      
      // Direct filename mention
      {
        pattern: /^([a-zA-Z0-9_\-]+\.\w+)$/,
        extractor: (match) => match[1],
        confidence: 0.8,
        priority: 4
      },
      {
        pattern: /"([a-zA-Z0-9_\-/]+\.\w+)"/,
        extractor: (match) => match[1],
        confidence: 0.95,
        priority: 1
      },
      {
        pattern: /'([a-zA-Z0-9_\-/]+\.\w+)'/,
        extractor: (match) => match[1],
        confidence: 0.95,
        priority: 1
      },
      
      // Path patterns
      {
        pattern: /(?:at|in)\s+([a-zA-Z0-9_\-/]+\/[a-zA-Z0-9_\-]+\.\w+)/,
        extractor: (match) => match[1],
        confidence: 0.9,
        priority: 2
      }
    ];

    // Sort by priority
    this.patterns.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Analyze user input for explicit filename specification
   */
  async analyze(userInput: string): Promise<FilenameCandidate> {
    // Try each pattern
    for (const pattern of this.patterns) {
      const match = userInput.match(pattern.pattern);
      if (match) {
        const extractedFilename = pattern.extractor(match);
        const { filename, extension, isValid } = this.validateFilename(extractedFilename);
        
        if (isValid) {
          return {
            filename,
            extension,
            confidence: pattern.confidence,
            reasoning: `Explicitly specified filename detected: "${filename}"`,
            source: 'explicit',
            alternatives: this.generateAlternatives(filename)
          };
        }
      }
    }

    // No explicit filename found
    return {
      filename: '',
      extension: '',
      confidence: 0,
      reasoning: 'No explicit filename specification detected',
      source: 'explicit',
      alternatives: []
    };
  }

  /**
   * Validate and normalize filename
   */
  private validateFilename(filename: string): {
    filename: string;
    extension: string;
    isValid: boolean;
  } {
    // Remove any directory path for validation
    const basename = path.basename(filename);
    const ext = path.extname(basename);
    
    // Check for invalid characters
    const invalidChars = /[<>:"|?*\x00-\x1F]/;
    if (invalidChars.test(basename)) {
      return { filename: '', extension: '', isValid: false };
    }

    // Check for reserved names (Windows)
    const reserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4',
                     'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2',
                     'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    const nameWithoutExt = path.basename(basename, ext).toUpperCase();
    if (reserved.includes(nameWithoutExt)) {
      return { filename: '', extension: '', isValid: false };
    }

    // Valid filename
    return {
      filename: basename,
      extension: ext,
      isValid: true
    };
  }

  /**
   * Generate alternative filenames
   */
  private generateAlternatives(filename: string): string[] {
    const alternatives: string[] = [];
    const ext = path.extname(filename);
    const basename = path.basename(filename, ext);

    // Different casing alternatives
    if (basename.includes('-')) {
      // kebab-case to camelCase
      const camelCase = basename.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      alternatives.push(camelCase + ext);
      
      // kebab-case to PascalCase
      const pascalCase = camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
      alternatives.push(pascalCase + ext);
    } else if (basename.includes('_')) {
      // snake_case to camelCase
      const camelCase = basename.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
      alternatives.push(camelCase + ext);
    } else if (/[A-Z]/.test(basename)) {
      // camelCase/PascalCase to kebab-case
      const kebabCase = basename.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
      alternatives.push(kebabCase + ext);
    }

    // Extension alternatives for web files
    const webExtensions: Record<string, string[]> = {
      '.html': ['.htm'],
      '.htm': ['.html'],
      '.js': ['.mjs', '.cjs'],
      '.mjs': ['.js', '.cjs'],
      '.cjs': ['.js', '.mjs'],
      '.ts': ['.tsx'],
      '.tsx': ['.ts'],
      '.jsx': ['.js'],
      '.yml': ['.yaml'],
      '.yaml': ['.yml']
    };

    if (webExtensions[ext]) {
      for (const altExt of webExtensions[ext]) {
        alternatives.push(basename + altExt);
      }
    }

    return alternatives.slice(0, 3); // Return top 3 alternatives
  }
}