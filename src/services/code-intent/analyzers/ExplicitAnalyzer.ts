/**
 * Explicit Filename Analyzer
 * Detects when users explicitly specify filenames in their prompts
 */

import { FilenameCandidate, ProjectContext } from '../types/filename-inference.types';
import * as path from 'node:path';

export class ExplicitAnalyzer {
  private patterns: RegExp[] = [
    // Japanese patterns
    /(?:を|で|に|として)?([a-zA-Z0-9\-_.]+\.[a-zA-Z0-9]+)(?:を|で|に|として|作|保存)?/,
    /(?:ファイル名|名前)[はを]?[「『"']?([a-zA-Z0-9\-_.]+\.[a-zA-Z0-9]+)[」』"']?/,
    
    // English patterns
    /(?:create|make|generate|save as|name it|call it)\s+([a-zA-Z0-9\-_.]+\.[a-zA-Z0-9]+)/i,
    /(?:file(?:name)?|name)\s*[:=]\s*["`']?([a-zA-Z0-9\-_.]+\.[a-zA-Z0-9]+)["`']?/i,
    /([a-zA-Z0-9\-_.]+\.[a-zA-Z0-9]+)\s+(?:file|という名前|というファイル)/i,
    
    // Direct file references
    /^([a-zA-Z0-9\-_.]+\.[a-zA-Z0-9]+)$/,
    /save\s+(?:to|as)\s+([a-zA-Z0-9\-_.]+\.[a-zA-Z0-9]+)/i,
    /into\s+([a-zA-Z0-9\-_.]+\.[a-zA-Z0-9]+)/i,
    
    // With directory paths
    /(?:in|to|at)\s+([a-zA-Z0-9\-_./\\]+\.[a-zA-Z0-9]+)/i,
    /([a-zA-Z0-9\-_./\\]+\.[a-zA-Z0-9]+)\s*(?:に|へ|で)/,
  ];

  /**
   * Analyzes the prompt for explicit filename specifications
   */
  async analyze(prompt: string, code: string, context: ProjectContext): Promise<FilenameCandidate> {
    // Try each pattern
    for (const pattern of this.patterns) {
      const match = prompt.match(pattern);
      if (match && match[1]) {
        const filename = this.normalizeFilename(match[1]);
        
        // Validate the filename
        if (this.isValidFilename(filename)) {
          return {
            path: this.buildFullPath(filename, context),
            filename: path.basename(filename),
            extension: path.extname(filename),
            directory: path.dirname(filename) === '.' ? '' : path.dirname(filename),
            confidence: 0.95, // High confidence for explicit names
            reasoning: `User explicitly specified: "${filename}"`,
            source: 'explicit'
          };
        }
      }
    }

    // Check for quoted filenames
    const quotedMatch = prompt.match(/["'`]([a-zA-Z0-9\-_.]+\.[a-zA-Z0-9]+)["'`]/);
    if (quotedMatch && quotedMatch[1]) {
      const filename = this.normalizeFilename(quotedMatch[1]);
      if (this.isValidFilename(filename)) {
        return {
          path: this.buildFullPath(filename, context),
          filename: path.basename(filename),
          extension: path.extname(filename),
          directory: '',
          confidence: 0.98, // Very high confidence for quoted names
          reasoning: `User quoted filename: "${filename}"`,
          source: 'explicit'
        };
      }
    }

    // Return low-confidence fallback if no explicit filename found
    return {
      path: 'code-file.txt',
      filename: 'code-file.txt',
      extension: '.txt',
      directory: '',
      confidence: 0.1,
      reasoning: 'No explicit filename found in prompt',
      source: 'explicit'
    };
  }

  /**
   * Normalizes a filename by cleaning up common issues
   */
  private normalizeFilename(filename: string): string {
    return filename
      .trim()
      .replace(/['"` ]/g, '') // Remove quotes and spaces
      .replace(/\\/g, '/'); // Normalize path separators
  }

  /**
   * Validates if a filename is reasonable
   */
  private isValidFilename(filename: string): boolean {
    // Must have an extension
    if (!path.extname(filename)) {
      return false;
    }

    // Must not be too long
    if (filename.length > 255) {
      return false;
    }

    // Must not contain invalid characters
    if (/[<>:"|?*\x00-\x1F]/.test(filename)) {
      return false;
    }

    // Must have a reasonable extension
    const ext = path.extname(filename).toLowerCase();
    const validExtensions = [
      '.html', '.htm', '.css', '.scss', '.sass', '.less',
      '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
      '.json', '.jsonc', '.json5',
      '.xml', '.svg', '.yml', '.yaml', '.toml',
      '.md', '.mdx', '.txt', '.csv', '.tsv',
      '.py', '.pyw', '.ipynb',
      '.java', '.kt', '.scala',
      '.go', '.rs', '.c', '.cpp', '.h', '.hpp',
      '.cs', '.vb', '.fs',
      '.rb', '.php', '.pl', '.lua',
      '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
      '.sql', '.graphql', '.gql',
      '.vue', '.svelte', '.astro',
      '.dockerfile', '.dockerignore',
      '.gitignore', '.gitattributes',
      '.env', '.env.example', '.env.local',
      '.editorconfig', '.prettierrc', '.eslintrc'
    ];

    return validExtensions.includes(ext) || 
           validExtensions.includes('.' + filename); // For files like .gitignore
  }

  /**
   * Builds the full path for a filename
   */
  private buildFullPath(filename: string, context: ProjectContext): string {
    if (path.isAbsolute(filename)) {
      return filename;
    }

    const dir = context.directory || context.root || '.';
    return path.join(dir, filename);
  }

  /**
   * Gets confidence score based on how explicit the specification is
   */
  getConfidenceScore(match: string): number {
    // Quoted filenames have highest confidence
    if (/["'`]/.test(match)) {
      return 0.98;
    }

    // Direct "save as X" or "create X" patterns
    if (/save\s+as|create|make/i.test(match)) {
      return 0.95;
    }

    // Japanese explicit patterns
    if (/という名前|というファイル|ファイル名/.test(match)) {
      return 0.95;
    }

    // Other patterns
    return 0.90;
  }
}