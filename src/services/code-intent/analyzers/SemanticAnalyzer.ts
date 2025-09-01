/**
 * Semantic Analyzer
 * Analyzes code content to infer appropriate filename
 */

import { FilenameCandidate } from '../types/filename-inference.types.js';

export class SemanticAnalyzer {
  /**
   * Analyze code content to suggest filename
   */
  async analyze(code: string, userInput: string): Promise<FilenameCandidate> {
    // Detect primary language
    const language = this.detectLanguage(code);
    
    // Extract semantic information
    const componentName = this.extractComponentName(code);
    const className = this.extractClassName(code);
    const functionName = this.extractMainFunction(code);
    const isTest = this.isTestFile(code);
    const isConfig = this.isConfigFile(code);
    
    // Determine filename based on semantic analysis
    let filename = 'index';
    let confidence = 0.5;
    let reasoning = 'Inferred from code structure';

    if (componentName) {
      filename = componentName;
      confidence = 0.75;
      reasoning = `React component detected: ${componentName}`;
    } else if (className) {
      filename = className;
      confidence = 0.7;
      reasoning = `Class detected: ${className}`;
    } else if (functionName && functionName !== 'main') {
      filename = this.toKebabCase(functionName);
      confidence = 0.6;
      reasoning = `Main function detected: ${functionName}`;
    }

    // Adjust for test files
    if (isTest) {
      if (!filename.includes('test') && !filename.includes('spec')) {
        filename = filename + '.test';
      }
      reasoning += ' (test file)';
    }

    // Adjust for config files
    if (isConfig) {
      if (!filename.includes('config')) {
        filename = 'config';
      }
      reasoning += ' (configuration file)';
    }

    // Add extension based on language
    const extension = this.getExtensionForLanguage(language, code);
    filename = filename + extension;

    return {
      filename,
      extension,
      confidence,
      reasoning,
      source: 'semantic',
      alternatives: this.generateAlternatives(filename, language)
    };
  }

  /**
   * Detect programming language from code
   */
  private detectLanguage(code: string): string {
    const indicators = [
      { lang: 'html', patterns: [/<!DOCTYPE/i, /<html/i, /<body/i, /<head/i], weight: 10 },
      { lang: 'tsx', patterns: [/import.*React/, /export.*React.FC/, /<.*\/>/], weight: 9 },
      { lang: 'jsx', patterns: [/import.*react/, /ReactDOM.render/, /<.*\/>/], weight: 8 },
      { lang: 'typescript', patterns: [/interface\s+\w+/, /type\s+\w+\s*=/, /:\s*(string|number|boolean)/], weight: 7 },
      { lang: 'javascript', patterns: [/function\s+\w+/, /const\s+\w+\s*=/, /=>/], weight: 6 },
      { lang: 'python', patterns: [/def\s+\w+\(/, /import\s+\w+/, /if\s+__name__/], weight: 8 },
      { lang: 'java', patterns: [/public\s+class/, /public\s+static\s+void/, /import\s+java/], weight: 8 },
      { lang: 'css', patterns: [/\.\w+\s*\{/, /#\w+\s*\{/, /@media/], weight: 7 },
      { lang: 'sql', patterns: [/CREATE TABLE/i, /SELECT.*FROM/i, /INSERT INTO/i], weight: 9 },
      { lang: 'json', patterns: [/^\s*\{[\s\S]*\}\s*$/, /"[^"]+"\s*:/], weight: 7 },
      { lang: 'yaml', patterns: [/^\w+:/m, /^\s+-\s+/m], weight: 6 },
      { lang: 'shell', patterns: [/^#!/, /\$\{?\w+\}?/, /if\s+\[/], weight: 7 },
      { lang: 'go', patterns: [/package\s+\w+/, /func\s+\w+/, /import\s+\(/], weight: 8 },
      { lang: 'rust', patterns: [/fn\s+\w+/, /let\s+mut/, /impl\s+/], weight: 8 },
      { lang: 'php', patterns: [/<\?php/, /function\s+\w+\(/, /\$\w+/], weight: 8 }
    ];

    let maxScore = 0;
    let detectedLang = 'javascript'; // default

    for (const { lang, patterns, weight } of indicators) {
      let score = 0;
      for (const pattern of patterns) {
        if (pattern.test(code)) {
          score += weight;
        }
      }
      if (score > maxScore) {
        maxScore = score;
        detectedLang = lang;
      }
    }

    return detectedLang;
  }

  /**
   * Extract React component name
   */
  private extractComponentName(code: string): string | null {
    const patterns = [
      /export\s+default\s+function\s+(\w+)/,
      /export\s+function\s+(\w+).*\{[\s\S]*return\s*\(/,
      /const\s+(\w+).*=.*\(.*\).*=>.*\{[\s\S]*return\s*\(/,
      /class\s+(\w+)\s+extends\s+(?:React\.)?Component/,
      /export\s+default\s+(\w+);/
    ];

    for (const pattern of patterns) {
      const match = code.match(pattern);
      if (match && match[1]) {
        // Check if it looks like a React component (PascalCase)
        if (/^[A-Z]/.test(match[1])) {
          return match[1];
        }
      }
    }

    return null;
  }

  /**
   * Extract class name
   */
  private extractClassName(code: string): string | null {
    const patterns = [
      /class\s+(\w+)/,
      /interface\s+(\w+)/,
      /export\s+class\s+(\w+)/,
      /public\s+class\s+(\w+)/
    ];

    for (const pattern of patterns) {
      const match = code.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Extract main function name
   */
  private extractMainFunction(code: string): string | null {
    const patterns = [
      /export\s+default\s+function\s+(\w+)/,
      /export\s+function\s+(\w+)/,
      /function\s+(\w+)\s*\(/,
      /const\s+(\w+)\s*=\s*\(/,
      /def\s+(\w+)\s*\(/
    ];

    for (const pattern of patterns) {
      const match = code.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Check if code is a test file
   */
  private isTestFile(code: string): boolean {
    const testIndicators = [
      /describe\s*\(/,
      /it\s*\(/,
      /test\s*\(/,
      /expect\s*\(/,
      /assert/,
      /@Test/,
      /unittest/,
      /pytest/
    ];

    return testIndicators.some(pattern => pattern.test(code));
  }

  /**
   * Check if code is a configuration file
   */
  private isConfigFile(code: string): boolean {
    const configIndicators = [
      /module\.exports\s*=\s*\{/,
      /export\s+default\s+\{/,
      /"scripts"\s*:\s*\{/,
      /"dependencies"\s*:\s*\{/,
      /version:\s*['"]?\d/,
      /apiVersion:/
    ];

    return configIndicators.some(pattern => pattern.test(code));
  }

  /**
   * Get appropriate extension for language
   */
  private getExtensionForLanguage(language: string, code: string): string {
    const extensionMap: Record<string, string> = {
      'html': '.html',
      'css': '.css',
      'javascript': '.js',
      'typescript': '.ts',
      'jsx': '.jsx',
      'tsx': '.tsx',
      'python': '.py',
      'java': '.java',
      'go': '.go',
      'rust': '.rs',
      'php': '.php',
      'sql': '.sql',
      'json': '.json',
      'yaml': '.yml',
      'shell': '.sh'
    };

    // Special cases
    if (language === 'javascript' && code.includes('module.exports')) {
      return '.cjs';
    }
    if (language === 'javascript' && code.includes('export default')) {
      return '.mjs';
    }

    return extensionMap[language] || '.txt';
  }

  /**
   * Generate alternative filenames
   */
  private generateAlternatives(primary: string, language: string): string[] {
    const alternatives: string[] = [];
    const basename = primary.substring(0, primary.lastIndexOf('.'));
    
    // Language-specific alternatives
    switch (language) {
      case 'javascript':
        alternatives.push(basename + '.mjs', basename + '.cjs');
        break;
      case 'typescript':
        alternatives.push(basename + '.tsx', basename + '.d.ts');
        break;
      case 'jsx':
        alternatives.push(basename + '.js', basename + '.tsx');
        break;
      case 'tsx':
        alternatives.push(basename + '.ts', basename + '.jsx');
        break;
      case 'yaml':
        alternatives.push(basename + '.yaml');
        break;
    }

    // Common alternatives
    if (!basename.includes('index')) {
      alternatives.push('index' + primary.substring(primary.lastIndexOf('.')));
    }
    if (!basename.includes('main')) {
      alternatives.push('main' + primary.substring(primary.lastIndexOf('.')));
    }
    if (!basename.includes('app')) {
      alternatives.push('app' + primary.substring(primary.lastIndexOf('.')));
    }

    return alternatives.slice(0, 3);
  }

  /**
   * Convert to kebab-case
   */
  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }
}