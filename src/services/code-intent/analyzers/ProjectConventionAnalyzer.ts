/**
 * Project Convention Analyzer
 * Analyzes project structure and conventions to suggest appropriate filenames
 */

import { FilenameCandidate, ProjectContext } from '../types/filename-inference.types';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface ProjectPattern {
  directory: string;
  pattern: RegExp;
  template: string;
  extension: string;
}

export class ProjectConventionAnalyzer {
  private projectPatterns: ProjectPattern[] = [
    // React components
    {
      directory: 'src/components',
      pattern: /component|button|form|modal|card|list/i,
      template: '{Name}.tsx',
      extension: '.tsx'
    },
    // Pages/Routes
    {
      directory: 'src/pages',
      pattern: /page|route|view|screen/i,
      template: '{name}.tsx',
      extension: '.tsx'
    },
    // API routes
    {
      directory: 'src/api',
      pattern: /api|endpoint|route|controller/i,
      template: '{name}.ts',
      extension: '.ts'
    },
    // Utilities
    {
      directory: 'src/utils',
      pattern: /util|helper|service|lib/i,
      template: '{name}.ts',
      extension: '.ts'
    },
    // Tests
    {
      directory: 'tests',
      pattern: /test|spec/i,
      template: '{name}.spec.ts',
      extension: '.spec.ts'
    },
    // Styles
    {
      directory: 'src/styles',
      pattern: /style|css|theme/i,
      template: '{name}.css',
      extension: '.css'
    }
  ];

  /**
   * Analyzes project conventions to suggest filenames
   */
  async analyze(prompt: string, code: string, context: ProjectContext): Promise<FilenameCandidate> {
    // Load project conventions if available
    const conventions = await this.loadProjectConventions(context);
    
    // Analyze existing project structure
    const projectStructure = await this.analyzeProjectStructure(context);
    
    // Determine file type from prompt and code
    const fileType = this.determineFileType(prompt, code);
    
    // Find matching pattern
    const pattern = this.findMatchingPattern(fileType, projectStructure);
    if (!pattern) {
      // Return fallback if no pattern matches
      return {
        path: 'file.js',
        filename: 'file.js', 
        extension: '.js',
        directory: '',
        confidence: 0.2,
        reasoning: 'No project convention pattern matched',
        source: 'project'
      };
    }

    // Generate filename based on pattern
    const filename = this.generateFilename(prompt, pattern, conventions);
    const fullPath = path.join(context.root || '.', pattern.directory, filename);

    return {
      path: fullPath,
      filename,
      extension: path.extname(filename),
      directory: pattern.directory,
      confidence: 0.8,
      reasoning: `Following project convention for ${pattern.directory}`,
      source: 'project'
    };
  }

  /**
   * Loads project-specific conventions
   */
  private async loadProjectConventions(context: ProjectContext): Promise<any> {
    const conventionsPath = path.join(context.root || '.', '.maria', 'conventions.json');
    
    if (fs.existsSync(conventionsPath)) {
      try {
        return JSON.parse(fs.readFileSync(conventionsPath, 'utf-8'));
      } catch (error) {
        console.warn('Failed to load project conventions:', error);
      }
    }

    // Check for common convention files
    const eslintPath = path.join(context.root || '.', '.eslintrc.json');
    if (fs.existsSync(eslintPath)) {
      try {
        const eslint = JSON.parse(fs.readFileSync(eslintPath, 'utf-8'));
        return this.extractConventionsFromEslint(eslint);
      } catch {}
    }

    return null;
  }

  /**
   * Analyzes existing project structure
   */
  private async analyzeProjectStructure(context: ProjectContext): Promise<Map<string, string[]>> {
    const structure = new Map<string, string[]>();
    const root = context.root || '.';

    // Common directories to check
    const dirsToCheck = [
      'src/components',
      'src/pages',
      'src/api',
      'src/utils',
      'src/services',
      'src/hooks',
      'src/styles',
      'tests',
      'public'
    ];

    for (const dir of dirsToCheck) {
      const fullPath = path.join(root, dir);
      if (fs.existsSync(fullPath)) {
        try {
          const files = fs.readdirSync(fullPath)
            .filter(f => !f.startsWith('.'))
            .slice(0, 10); // Sample first 10 files
          structure.set(dir, files);
        } catch {}
      }
    }

    return structure;
  }

  /**
   * Determines the type of file from prompt and code
   */
  private determineFileType(prompt: string, code: string): string {
    const promptLower = prompt.toLowerCase();
    
    // Check for explicit type mentions
    if (promptLower.includes('component')) return 'component';
    if (promptLower.includes('page') || promptLower.includes('route')) return 'page';
    if (promptLower.includes('api') || promptLower.includes('endpoint')) return 'api';
    if (promptLower.includes('test') || promptLower.includes('spec')) return 'test';
    if (promptLower.includes('style') || promptLower.includes('css')) return 'style';
    if (promptLower.includes('util') || promptLower.includes('helper')) return 'util';

    // Infer from code patterns
    if (code.includes('export default function') && /[A-Z]/.test(code)) return 'component';
    if (code.includes('describe(') || code.includes('test(')) return 'test';
    if (code.includes('router.') || code.includes('app.')) return 'api';
    if (/\{\s*color:|background:|margin:|padding:/.test(code)) return 'style';

    return 'generic';
  }

  /**
   * Finds a matching pattern for the file type
   */
  private findMatchingPattern(fileType: string, structure: Map<string, string[]>): ProjectPattern | null {
    // Map file types to patterns
    const typeMap: Record<string, RegExp> = {
      'component': /component/i,
      'page': /page|route/i,
      'api': /api|endpoint/i,
      'test': /test|spec/i,
      'style': /style|css/i,
      'util': /util|helper/i
    };

    const pattern = typeMap[fileType];
    if (!pattern) return null;

    // Find matching project pattern
    return this.projectPatterns.find(p => pattern.test(p.directory)) || null;
  }

  /**
   * Generates a filename based on pattern and conventions
   */
  private generateFilename(prompt: string, pattern: ProjectPattern, conventions: any): string {
    // Extract a name from the prompt
    const name = this.extractName(prompt);
    
    // Apply template
    let filename = pattern.template;
    
    // Replace placeholders
    filename = filename.replace('{Name}', this.toPascalCase(name));
    filename = filename.replace('{name}', this.toKebabCase(name));
    filename = filename.replace('{NAME}', name.toUpperCase());
    
    // Apply naming convention if specified
    if (conventions?.fileNaming) {
      const baseName = path.basename(filename, path.extname(filename));
      const ext = path.extname(filename);
      
      switch (conventions.fileNaming) {
        case 'kebab-case':
          filename = this.toKebabCase(baseName) + ext;
          break;
        case 'camelCase':
          filename = this.toCamelCase(baseName) + ext;
          break;
        case 'PascalCase':
          filename = this.toPascalCase(baseName) + ext;
          break;
        case 'snake_case':
          filename = this.toSnakeCase(baseName) + ext;
          break;
      }
    }

    return filename;
  }

  /**
   * Extracts a meaningful name from the prompt
   */
  private extractName(prompt: string): string {
    // Remove common words
    const cleaned = prompt
      .replace(/create|make|build|generate|add|new/gi, '')
      .replace(/component|page|file|api|test/gi, '')
      .trim();

    // Extract first meaningful word
    const words = cleaned.split(/\s+/)
      .filter(w => w.length > 2)
      .filter(w => !/^(the|and|for|with|from)$/i.test(w));

    if (words.length > 0) {
      return words[0].replace(/[^a-zA-Z0-9]/g, '');
    }

    return 'file';
  }

  /**
   * Extracts conventions from ESLint config
   */
  private extractConventionsFromEslint(eslint: any): any {
    const conventions: any = {};

    // Check for naming convention rules
    if (eslint.rules?.['naming-convention']) {
      // Parse naming convention rules
      // This is simplified - real implementation would be more complex
      conventions.fileNaming = 'camelCase';
    }

    return conventions;
  }

  // Naming convention utilities
  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  private toCamelCase(str: string): string {
    const words = str.split(/[-_\s]+/);
    return words[0].toLowerCase() + 
      words.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
  }

  private toPascalCase(str: string): string {
    const words = str.split(/[-_\s]+/);
    return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
  }

  private toSnakeCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[\s\-]+/g, '_')
      .toLowerCase();
  }
}