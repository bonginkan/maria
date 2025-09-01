/**
 * Extension Detector
 * Detects appropriate file extension based on code content
 */

import { Language } from '../types/filename-inference.types.js';

export class ExtensionDetector {
  private languagePatterns: Array<{
    language: string;
    extension: string;
    patterns: RegExp[];
    weight: number;
  }>;

  constructor() {
    this.languagePatterns = [
      {
        language: 'html',
        extension: '.html',
        patterns: [
          /<!DOCTYPE\s+html/i,
          /<html[\s>]/i,
          /<head[\s>][\s\S]*<\/head>/i,
          /<body[\s>]/i,
          /<meta\s+charset=/i
        ],
        weight: 10
      },
      {
        language: 'typescript-react',
        extension: '.tsx',
        patterns: [
          /import\s+.*React/,
          /import\s+\{.*\}\s+from\s+['"]react['"]/,
          /<[A-Z]\w*[\s/>]/,
          /:\s*React\.FC/,
          /:\s*JSX\.Element/
        ],
        weight: 9
      },
      {
        language: 'javascript-react',
        extension: '.jsx',
        patterns: [
          /import\s+React/,
          /const.*=.*<\w+/,
          /return\s*\(/,
          /ReactDOM\.render/
        ],
        weight: 8
      },
      {
        language: 'typescript',
        extension: '.ts',
        patterns: [
          /interface\s+\w+\s*\{/,
          /type\s+\w+\s*=/,
          /:\s*(string|number|boolean|any|void)\s*[;,\)]/,
          /enum\s+\w+\s*\{/,
          /namespace\s+\w+\s*\{/,
          /declare\s+(module|namespace)/
        ],
        weight: 7
      },
      {
        language: 'javascript',
        extension: '.js',
        patterns: [
          /function\s+\w+\s*\(/,
          /const\s+\w+\s*=/,
          /let\s+\w+\s*=/,
          /var\s+\w+\s*=/,
          /=>\s*\{/,
          /module\.exports/,
          /export\s+(default|const|function|class)/
        ],
        weight: 6
      },
      {
        language: 'python',
        extension: '.py',
        patterns: [
          /^def\s+\w+\(/m,
          /^class\s+\w+[\(:]/m,
          /^import\s+\w+/m,
          /^from\s+\w+\s+import/m,
          /if\s+__name__\s*==\s*['"]__main__['"]/,
          /^\s{4,}(def|class)\s+/m
        ],
        weight: 8
      },
      {
        language: 'java',
        extension: '.java',
        patterns: [
          /public\s+class\s+\w+/,
          /private\s+(static\s+)?.*\(/,
          /public\s+static\s+void\s+main/,
          /import\s+java\./,
          /@Override/,
          /extends\s+\w+/,
          /implements\s+\w+/
        ],
        weight: 8
      },
      {
        language: 'css',
        extension: '.css',
        patterns: [
          /\.\w+\s*\{[^}]*\}/,
          /#\w+\s*\{[^}]*\}/,
          /@media\s+/,
          /@import\s+/,
          /:[hover|active|focus|visited]/,
          /\w+:\s*[#\w\d]+;/
        ],
        weight: 7
      },
      {
        language: 'scss',
        extension: '.scss',
        patterns: [
          /\$\w+:\s*/,
          /@mixin\s+/,
          /@include\s+/,
          /@extend\s+/,
          /&:\w+/,
          /\.\w+\s*\{[\s\S]*\.\w+\s*\{/
        ],
        weight: 8
      },
      {
        language: 'sql',
        extension: '.sql',
        patterns: [
          /CREATE\s+TABLE/i,
          /SELECT\s+.*\s+FROM/i,
          /INSERT\s+INTO/i,
          /UPDATE\s+\w+\s+SET/i,
          /DELETE\s+FROM/i,
          /ALTER\s+TABLE/i,
          /DROP\s+TABLE/i
        ],
        weight: 9
      },
      {
        language: 'json',
        extension: '.json',
        patterns: [
          /^\s*\{[\s\S]*\}\s*$/,
          /^\s*\[[\s\S]*\]\s*$/,
          /"[^"]+"\s*:\s*["{[\d]/
        ],
        weight: 7
      },
      {
        language: 'yaml',
        extension: '.yml',
        patterns: [
          /^[a-z_]+:\s*$/im,
          /^\s+-\s+/m,
          /^[a-z_]+:\s+\S/im,
          /^\s{2,}[a-z_]+:/im
        ],
        weight: 6
      },
      {
        language: 'shell',
        extension: '.sh',
        patterns: [
          /^#!/,
          /\$\{?\w+\}?/,
          /if\s+\[\s*/,
          /echo\s+/,
          /export\s+\w+=/,
          /source\s+/
        ],
        weight: 7
      },
      {
        language: 'dockerfile',
        extension: '',
        patterns: [
          /^FROM\s+/m,
          /^RUN\s+/m,
          /^CMD\s+/m,
          /^EXPOSE\s+/m,
          /^ENV\s+/m,
          /^WORKDIR\s+/m
        ],
        weight: 10
      },
      {
        language: 'go',
        extension: '.go',
        patterns: [
          /^package\s+\w+/m,
          /^func\s+\w+/m,
          /^import\s+\(/m,
          /^type\s+\w+\s+struct/m,
          /^var\s+\w+\s+/m
        ],
        weight: 8
      },
      {
        language: 'rust',
        extension: '.rs',
        patterns: [
          /^fn\s+\w+/m,
          /^let\s+mut\s+/m,
          /^impl\s+/m,
          /^use\s+/m,
          /^struct\s+/m,
          /^trait\s+/m
        ],
        weight: 8
      },
      {
        language: 'php',
        extension: '.php',
        patterns: [
          /<\?php/,
          /function\s+\w+\s*\(/,
          /class\s+\w+/,
          /\$\w+\s*=/,
          /echo\s+/,
          /namespace\s+/
        ],
        weight: 8
      },
      {
        language: 'ruby',
        extension: '.rb',
        patterns: [
          /^def\s+\w+/m,
          /^class\s+\w+/m,
          /^module\s+\w+/m,
          /^require\s+/m,
          /puts\s+/,
          /@\w+\s*=/
        ],
        weight: 7
      },
      {
        language: 'swift',
        extension: '.swift',
        patterns: [
          /^func\s+\w+/m,
          /^var\s+\w+/m,
          /^let\s+\w+/m,
          /^class\s+\w+/m,
          /^struct\s+\w+/m,
          /^import\s+/m
        ],
        weight: 8
      },
      {
        language: 'kotlin',
        extension: '.kt',
        patterns: [
          /^fun\s+\w+/m,
          /^val\s+\w+/m,
          /^var\s+\w+/m,
          /^class\s+\w+/m,
          /^object\s+\w+/m,
          /^package\s+/m
        ],
        weight: 8
      },
      {
        language: 'csharp',
        extension: '.cs',
        patterns: [
          /^using\s+/m,
          /^namespace\s+/m,
          /^public\s+class\s+/m,
          /^private\s+/m,
          /^protected\s+/m,
          /^static\s+void\s+Main/m
        ],
        weight: 8
      },
      {
        language: 'cpp',
        extension: '.cpp',
        patterns: [
          /#include\s*<\w+>/,
          /using\s+namespace\s+std/,
          /int\s+main\s*\(/,
          /std::/,
          /template\s*</,
          /class\s+\w+\s*\{/
        ],
        weight: 7
      },
      {
        language: 'c',
        extension: '.c',
        patterns: [
          /#include\s*<\w+\.h>/,
          /int\s+main\s*\(/,
          /typedef\s+struct/,
          /void\s+\w+\s*\(/,
          /printf\s*\(/
        ],
        weight: 7
      },
      {
        language: 'vue',
        extension: '.vue',
        patterns: [
          /<template>/,
          /<script>/,
          /<style/,
          /export\s+default\s+\{[\s\S]*data\s*\(\)/
        ],
        weight: 9
      },
      {
        language: 'svelte',
        extension: '.svelte',
        patterns: [
          /<script>/,
          /\$:\s*/,
          /export\s+let\s+/,
          /\{#if/,
          /\{#each/
        ],
        weight: 8
      }
    ];
  }

  /**
   * Detect language and extension from code
   */
  detect(code: string): Language {
    let bestMatch: Language = {
      name: 'plaintext',
      extension: '.txt',
      confidence: 0,
      indicators: []
    };

    for (const lang of this.languagePatterns) {
      let score = 0;
      const matchedIndicators: string[] = [];

      for (const pattern of lang.patterns) {
        if (pattern.test(code)) {
          score += lang.weight;
          matchedIndicators.push(pattern.source);
        }
      }

      const confidence = score / (lang.patterns.length * lang.weight);

      if (confidence > bestMatch.confidence) {
        bestMatch = {
          name: lang.language,
          extension: lang.extension,
          confidence: Math.min(confidence, 1),
          indicators: matchedIndicators
        };
      }
    }

    // Special case for Dockerfile
    if (code.includes('FROM ') && code.includes('RUN ')) {
      return {
        name: 'dockerfile',
        extension: '',
        confidence: 0.95,
        indicators: ['FROM', 'RUN']
      };
    }

    // Special case for package.json
    try {
      const parsed = JSON.parse(code);
      if (parsed.name && (parsed.dependencies || parsed.devDependencies || parsed.scripts)) {
        return {
          name: 'package.json',
          extension: '.json',
          confidence: 0.95,
          indicators: ['package.json structure']
        };
      }
    } catch {
      // Not valid JSON or not package.json
    }

    return bestMatch;
  }

  /**
   * Get suggested extensions for a language
   */
  getSuggestedExtensions(language: string): string[] {
    const extensionMap: Record<string, string[]> = {
      'javascript': ['.js', '.mjs', '.cjs'],
      'typescript': ['.ts', '.d.ts'],
      'javascript-react': ['.jsx', '.js'],
      'typescript-react': ['.tsx', '.ts'],
      'python': ['.py', '.pyw'],
      'java': ['.java'],
      'css': ['.css'],
      'scss': ['.scss', '.sass'],
      'html': ['.html', '.htm'],
      'sql': ['.sql'],
      'json': ['.json'],
      'yaml': ['.yml', '.yaml'],
      'shell': ['.sh', '.bash'],
      'go': ['.go'],
      'rust': ['.rs'],
      'php': ['.php'],
      'ruby': ['.rb'],
      'swift': ['.swift'],
      'kotlin': ['.kt', '.kts'],
      'csharp': ['.cs'],
      'cpp': ['.cpp', '.cc', '.cxx'],
      'c': ['.c', '.h'],
      'vue': ['.vue'],
      'svelte': ['.svelte']
    };

    return extensionMap[language] || ['.txt'];
  }
}