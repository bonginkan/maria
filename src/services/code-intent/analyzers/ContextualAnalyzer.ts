/**
 * Contextual Analyzer
 * Infers filename from context and keywords in user input
 */

import {
  FilenameCandidate,
  ProjectContext,
  ContextualMapping
} from '../types/filename-inference.types.js';

export class ContextualAnalyzer {
  private mappings: ContextualMapping[];

  constructor() {
    this.mappings = [
      // Game-related
      { keywords: ['tetris', 'テトリス'], suggest: 'tetris.html', confidence: 0.8, category: 'game' },
      { keywords: ['game', 'ゲーム'], suggest: 'game.html', confidence: 0.7, category: 'game' },
      { keywords: ['snake', 'スネーク'], suggest: 'snake.html', confidence: 0.8, category: 'game' },
      { keywords: ['puzzle', 'パズル'], suggest: 'puzzle.html', confidence: 0.7, category: 'game' },
      { keywords: ['breakout', 'ブロック崩し'], suggest: 'breakout.html', confidence: 0.8, category: 'game' },
      
      // API/Backend
      { keywords: ['api', 'rest', 'endpoint'], suggest: 'api.js', confidence: 0.8, category: 'backend' },
      { keywords: ['server', 'サーバー'], suggest: 'server.js', confidence: 0.8, category: 'backend' },
      { keywords: ['route', 'router', 'ルート'], suggest: 'routes.js', confidence: 0.7, category: 'backend' },
      { keywords: ['middleware', 'ミドルウェア'], suggest: 'middleware.js', confidence: 0.7, category: 'backend' },
      { keywords: ['auth', '認証'], suggest: 'auth.js', confidence: 0.7, category: 'backend' },
      
      // Frontend Components
      { keywords: ['component', 'コンポーネント'], suggest: 'Component.tsx', confidence: 0.7, category: 'frontend' },
      { keywords: ['button', 'ボタン'], suggest: 'Button.tsx', confidence: 0.8, category: 'frontend' },
      { keywords: ['form', 'フォーム'], suggest: 'Form.tsx', confidence: 0.8, category: 'frontend' },
      { keywords: ['modal', 'モーダル'], suggest: 'Modal.tsx', confidence: 0.8, category: 'frontend' },
      { keywords: ['navbar', 'navigation', 'ナビ'], suggest: 'Navbar.tsx', confidence: 0.8, category: 'frontend' },
      { keywords: ['dashboard', 'ダッシュボード'], suggest: 'Dashboard.tsx', confidence: 0.8, category: 'frontend' },
      
      // Configuration
      { keywords: ['config', '設定', 'configuration'], suggest: 'config.json', confidence: 0.8, category: 'config' },
      { keywords: ['env', 'environment', '環境'], suggest: '.env', confidence: 0.8, category: 'config' },
      { keywords: ['package', 'dependencies'], suggest: 'package.json', confidence: 0.9, category: 'config' },
      { keywords: ['docker'], suggest: 'Dockerfile', confidence: 0.9, category: 'config' },
      { keywords: ['webpack'], suggest: 'webpack.config.js', confidence: 0.9, category: 'config' },
      
      // Testing
      { keywords: ['test', 'テスト'], suggest: 'test.spec.js', confidence: 0.7, category: 'test' },
      { keywords: ['spec', 'specification'], suggest: 'spec.js', confidence: 0.7, category: 'test' },
      { keywords: ['unit test', 'ユニットテスト'], suggest: 'unit.test.js', confidence: 0.8, category: 'test' },
      { keywords: ['e2e', 'end-to-end'], suggest: 'e2e.test.js', confidence: 0.8, category: 'test' },
      
      // Data
      { keywords: ['database', 'db', 'データベース'], suggest: 'database.sql', confidence: 0.7, category: 'data' },
      { keywords: ['schema', 'スキーマ'], suggest: 'schema.sql', confidence: 0.8, category: 'data' },
      { keywords: ['model', 'モデル'], suggest: 'model.js', confidence: 0.7, category: 'data' },
      { keywords: ['migration', 'マイグレーション'], suggest: 'migration.sql', confidence: 0.8, category: 'data' },
      
      // Styles
      { keywords: ['style', 'css', 'スタイル'], suggest: 'styles.css', confidence: 0.7, category: 'style' },
      { keywords: ['theme', 'テーマ'], suggest: 'theme.css', confidence: 0.7, category: 'style' },
      { keywords: ['sass', 'scss'], suggest: 'styles.scss', confidence: 0.8, category: 'style' },
      
      // Documentation
      { keywords: ['readme', 'documentation'], suggest: 'README.md', confidence: 0.9, category: 'docs' },
      { keywords: ['changelog', '変更履歴'], suggest: 'CHANGELOG.md', confidence: 0.9, category: 'docs' },
      { keywords: ['license', 'ライセンス'], suggest: 'LICENSE', confidence: 0.9, category: 'docs' },
      
      // Utilities
      { keywords: ['util', 'utility', 'helper', 'ユーティリティ'], suggest: 'utils.js', confidence: 0.6, category: 'util' },
      { keywords: ['format', 'formatter'], suggest: 'formatter.js', confidence: 0.7, category: 'util' },
      { keywords: ['validate', 'validator', 'バリデーション'], suggest: 'validator.js', confidence: 0.7, category: 'util' },
      { keywords: ['parser', 'parse', 'パーサー'], suggest: 'parser.js', confidence: 0.7, category: 'util' }
    ];
  }

  /**
   * Analyze user input for contextual filename hints
   */
  async analyze(userInput: string, projectContext?: ProjectContext): Promise<FilenameCandidate> {
    const lowerInput = userInput.toLowerCase();
    const matches: Array<{ mapping: ContextualMapping; score: number }> = [];

    // Check each mapping
    for (const mapping of this.mappings) {
      let score = 0;
      let matchedKeywords = 0;
      
      for (const keyword of mapping.keywords) {
        if (lowerInput.includes(keyword.toLowerCase())) {
          matchedKeywords++;
          // Give higher score for longer keyword matches
          score += keyword.length * mapping.confidence;
        }
      }

      if (matchedKeywords > 0) {
        matches.push({
          mapping,
          score: score / mapping.keywords.length // Normalize by number of keywords
        });
      }
    }

    // Sort by score
    matches.sort((a, b) => b.score - a.score);

    if (matches.length > 0) {
      const bestMatch = matches[0];
      let suggestedFilename = bestMatch.mapping.suggest;
      
      // Adjust based on project context
      if (projectContext) {
        suggestedFilename = this.adjustForProjectContext(
          suggestedFilename,
          bestMatch.mapping.category || 'general',
          projectContext
        );
      }

      // Extract additional context from input
      const enhancedFilename = this.enhanceWithSpecificContext(suggestedFilename, userInput);

      return {
        filename: enhancedFilename,
        extension: this.extractExtension(enhancedFilename),
        confidence: Math.min(bestMatch.score, 0.85), // Cap at 0.85 for contextual
        reasoning: `Inferred from context: ${bestMatch.mapping.keywords.join(', ')}`,
        source: 'contextual',
        alternatives: this.generateAlternatives(enhancedFilename, matches.slice(1, 4))
      };
    }

    // No contextual match found
    return {
      filename: 'index.js',
      extension: '.js',
      confidence: 0.3,
      reasoning: 'No strong contextual hints found, using default',
      source: 'contextual',
      alternatives: ['app.js', 'main.js', 'script.js']
    };
  }

  /**
   * Adjust filename based on project context
   */
  private adjustForProjectContext(
    filename: string,
    category: string,
    context: ProjectContext
  ): string {
    // Adjust extension based on project type
    if (context.language === 'typescript' && filename.endsWith('.js')) {
      filename = filename.replace('.js', '.ts');
    }
    
    if (context.framework === 'react') {
      if (category === 'frontend' && filename.endsWith('.ts')) {
        filename = filename.replace('.ts', '.tsx');
      }
      if (category === 'frontend' && filename.endsWith('.js')) {
        filename = filename.replace('.js', '.jsx');
      }
    }

    // Apply naming conventions
    if (context.conventions?.fileNaming) {
      const basename = filename.substring(0, filename.lastIndexOf('.'));
      const ext = filename.substring(filename.lastIndexOf('.'));
      
      switch (context.conventions.fileNaming) {
        case 'kebab-case':
          filename = this.toKebabCase(basename) + ext;
          break;
        case 'camelCase':
          filename = this.toCamelCase(basename) + ext;
          break;
        case 'PascalCase':
          filename = this.toPascalCase(basename) + ext;
          break;
        case 'snake_case':
          filename = this.toSnakeCase(basename) + ext;
          break;
      }
    }

    return filename;
  }

  /**
   * Enhance filename with specific context from input
   */
  private enhanceWithSpecificContext(baseFilename: string, userInput: string): string {
    // Extract specific names from input
    const namePatterns = [
      /(?:called|named|という名前の?)\s+([a-zA-Z][a-zA-Z0-9]*)/i,
      /([A-Z][a-zA-Z0-9]*)\s+(?:component|コンポーネント|class|クラス)/i,
      /(?:for|の)\s+([a-zA-Z][a-zA-Z0-9]*)/i
    ];

    for (const pattern of namePatterns) {
      const match = userInput.match(pattern);
      if (match) {
        const specificName = match[1];
        const ext = this.extractExtension(baseFilename);
        
        // Replace generic part with specific name
        if (baseFilename.includes('Component')) {
          return specificName + ext;
        }
        if (baseFilename === 'game.html' || baseFilename === 'app.js') {
          return specificName.toLowerCase() + ext;
        }
      }
    }

    return baseFilename;
  }

  /**
   * Generate alternative filenames
   */
  private generateAlternatives(
    primary: string,
    otherMatches: Array<{ mapping: ContextualMapping; score: number }>
  ): string[] {
    const alternatives: string[] = [];
    
    // Add alternatives from other matches
    for (const match of otherMatches) {
      if (alternatives.length < 3) {
        alternatives.push(match.mapping.suggest);
      }
    }

    // Add variations of primary
    const ext = this.extractExtension(primary);
    const basename = primary.substring(0, primary.lastIndexOf('.') || primary.length);
    
    if (ext === '.js') {
      alternatives.push(basename + '.ts');
    }
    if (ext === '.html') {
      alternatives.push(basename + '.tsx');
    }

    return alternatives.slice(0, 3);
  }

  /**
   * Extract file extension
   */
  private extractExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.substring(lastDot) : '';
  }

  // String conversion utilities
  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  private toCamelCase(str: string): string {
    return str
      .replace(/[-_\s](.)/g, (_, char) => char.toUpperCase())
      .replace(/^(.)/, (_, char) => char.toLowerCase());
  }

  private toPascalCase(str: string): string {
    return str
      .replace(/[-_\s](.)/g, (_, char) => char.toUpperCase())
      .replace(/^(.)/, (_, char) => char.toUpperCase());
  }

  private toSnakeCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[-\s]+/g, '_')
      .toLowerCase();
  }
}