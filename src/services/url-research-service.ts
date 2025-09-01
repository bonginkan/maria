import chalk from 'chalk';

export interface URLAnalysis {
  url: string;
  title?: string;
  description?: string;
  content: string;
  contentType: 'webpage' | 'documentation' | 'api' | 'repository' | 'article' | 'unknown';
  _keywords: string[];
  links: string[];
  images: string[];
  codeBlocks: string[];
  _summary: string;
}

export interface ResearchResult {
  originalUrl: string;
  analysis: URLAnalysis;
  relatedUrls: string[];
  keyInsights: string[];
  actionableItems: string[];
  researchDepth: 'shallow' | 'medium' | 'deep';
}

export class URLResearchService {
  private static instance: URLResearchService;

  public static getInstance(): URLResearchService {
    if (!URLResearchService.instance) {
      URLResearchService.instance = new URLResearchService();
    }
    return URLResearchService.instance;
  }

  /**
   * Detect URLs in input text
   */
  public detectURLs(input: string): string[] {
    const _urlPatterns = [
      // HTTP/HTTPS URLs - simplified pattern
      /https?:\/\/[^\s]+/g,
      // Git repository URLs
      /git@[\w.-]+:[\w.-]+\/[\w.-]+\.git/g,
      // Domain-only URLs
      /(?:^|\s)((?:[\w-]+\.)+[a-zA-Z]{2,}(?:\/\S*)?)/g,
    ];

    const urls: string[] = [];

    for (const pattern of _urlPatterns) {
      const matches = input.matchAll(pattern);
      for (const match of matches) {
        let url = match[0];
        // Add protocol if missing
        if (!url.startsWith('http') && !url.startsWith('git@')) {
          url = `https://${url}`;
        }
        urls.push(url.trim());
      }
    }

    return [...new Set(urls)]; // Remove duplicates
  }

  /**
   * Analyze URL content type
   */
  public analyzeContentType(
    url: string,
    content: string,
    title?: string,
  ): URLAnalysis['contentType'] {
    const _urlLower = url.toLowerCase();
    const _contentLower = content.toLowerCase();
    const _titleLower = title?.toLowerCase() || '';

    // Documentation sites
    if (
      _urlLower.includes('docs.') ||
      urlLower.includes('/docs/') ||
      titleLower.includes('documentation') ||
      contentLower.includes('api reference')
    ) {
      return 'documentation';
    }

    // Repository sites
    if (
      _urlLower.includes('github.com') ||
      _urlLower.includes('gitlab.com') ||
      urlLower.includes('bitbucket.org') ||
      contentLower.includes('repository')
    ) {
      return 'repository';
    }

    // API endpoints
    if (
      _urlLower.includes('/api/') ||
      urlLower.includes('api.') ||
      _contentLower.includes('endpoint') ||
      contentLower.includes('json api')
    ) {
      return 'api';
    }

    // Articles/blogs
    if (
      _urlLower.includes('blog') ||
      urlLower.includes('article') ||
      titleLower.includes('tutorial') ||
      contentLower.includes('published')
    ) {
      return 'article';
    }

    // Default to webpage
    return 'webpage';
  }

  /**
   * Extract key information from content
   */
  public extractKeyInfo(content: string): {
    _keywords: string[];
    codeBlocks: string[];
    links: string[];
    _summary: string;
  } {
    // Extract code blocks
    const codeBlocks: string[] = [];
    const _codeMatches = content.matchAll(/`[\s\S]*?`|`[^`]+`/g);
    for (const match of _codeMatches) {
      codeBlocks.push(match[0]);
    }

    // Extract links
    const links: string[] = [];
    const _linkMatches = content.matchAll(/https?:\/\/[^\s<>"{}|\$2^`[\]]+/g);
    for (const match of _linkMatches) {
      links.push(match[0]);
    }

    // Extract _keywords (simple approach)
    const _keywords = this.extractKeywords(content);

    // Generate _summary (first 200 _words)
    const _words = content.split(/\s+/).slice(0, 200);
    const _summary = _words.join(' ') + (_words.length >= 200 ? '...' : '');

    return { _keywords, codeBlocks, links, _summary };
  }

  /**
   * Extract _keywords from content
   */
  private extractKeywords(content: string): string[] {
    // Simple keyword extraction based on frequency
    const _words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3);

    const wordCount: Record<string, number> = {};
    words.forEach((word) => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });

    // Get top 10 most frequent _words
    return Object.entries(wordCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Simulate deep research on URL (placeholder for actual implementation)
   */
  public async performDeepResearch(url: string): Promise<ResearchResult> {
    console.log(chalk.cyan(`🔍 Performing deep research on: ${url}`));

    // Simulate research steps
    await this.displayResearchStep('Fetching URL content...', 1000);
    await this.displayResearchStep('Analyzing content structure...', 800);
    await this.displayResearchStep('Extracting key information...', 600);
    await this.displayResearchStep('Finding related resources...', 900);
    await this.displayResearchStep('Generating insights...', 700);

    // Mock analysis result
    const mockAnalysis: URLAnalysis = {
      url,
      title: 'Example Title',
      description: 'Example description of the content',
      content:
        'Mock content for demonstration purposes. This would contain the actual fetched content from the URL.',
      contentType: this.analyzeContentType(url, 'mock content'),
      _keywords: ['example', 'mock', 'content', 'research', 'analysis'],
      links: ['https://example.com', 'https://example.com/related2'],
      images: ['https://example.com/image.png'],
      codeBlocks: ['`js\nconsole.log("example");\n`'],
      _summary:
        'This is a mock _summary of the researched content. In a real implementation, this would contain key insights from the actual URL content.',
    };

    const result: ResearchResult = {
      originalUrl: url,
      analysis: mockAnalysis,
      relatedUrls: [
        'https://example.com/related1',
        'https://example.com/related2',
        'https://example.com/related3'
      ],
      keyInsights: [
        'The content provides comprehensive information about the topic',
        'Multiple code examples are available for practical implementation',
        'The documentation includes best practices and common pitfalls',
      ],
      actionableItems: [
        'Review the provided code examples',
        'Implement the suggested best practices',
        'Explore the related resources for deeper understanding',
      ],
      researchDepth: 'deep',
    };

    return result;
  }

  /**
   * Display research progress step
   */
  private async displayResearchStep(message: string, delay: number): Promise<void> {
    console.log(chalk.gray(`   ${message}`));
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Display research results
   */
  public displayResearchResults(result: ResearchResult): void {
    console.log(`\n${chalk.cyan.bold('🔬 Deep Research Results')}`);
    console.log(chalk.gray(`=${'='.repeat(50)}`));

    // Basic info
    console.log(chalk.white.bold(`🔗 URL: ${result.originalUrl}`));
    console.log(chalk.gray(`📊 Research Depth: ${result.researchDepth}`));
    console.log(chalk.gray(`📝 Content Type: ${result.analysis.contentType}`));

    if (result.analysis.title) {
      console.log(chalk.white(`📰 Title: ${result.analysis.title}`));
    }

    if (result.analysis.description) {
      console.log(chalk.white(`📄 Description: ${result.analysis.description}`));
    }

    // Summary
    console.log(`\n${chalk.yellow.bold('📋 Summary:')}`);
    console.log(chalk.white(result.analysis.summary));

    // Key insights
    if (result.keyInsights.length > 0) {
      console.log(`\n${chalk.green.bold('💡 Key Insights:')}`);
      result.keyInsights.forEach((insight, _index) => {
        console.log(chalk.green(`   ${_index + 1}. ${insight}`));
      });
    }

    // Actionable items
    if (result.actionableItems.length > 0) {
      console.log(`\n${chalk.blue.bold('🎯 Actionable Items:')}`);
      result.actionableItems.forEach((_item, _index) => {
        console.log(chalk.blue(`   ${_index + 1}. ${_item}`));
      });
    }

    // Keywords
    if (result.analysis.keywords.length > 0) {
      console.log(`\n${chalk.magenta.bold('🔑 Keywords:')}`);
      console.log(chalk.magenta(`   ${result.analysis.keywords.join(', ')}`));
    }

    // Code blocks
    if (result.analysis.codeBlocks.length > 0) {
      console.log(`\n${chalk.cyan.bold('💻 Code Examples:')}`);
      console.log(chalk.gray(`   Found ${result.analysis.codeBlocks.length} code block(s)`));
    }

    // Related URLs
    if (result.relatedUrls.length > 0) {
      console.log(`\n${chalk.yellow.bold('🔗 Related Resources:')}`);
      result.relatedUrls.slice(0, 3).forEach((url, _index) => {
        console.log(chalk.yellow(`   ${_index + 1}. ${url}`));
      });
    }

    console.log(`\n${chalk.green('✅ Research completed successfully!')}`);
  }

  /**
   * Quick URL validation
   */
  public isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      // Try adding protocol
      try {
        new URL(`https://${url}`);
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Generate research suggestions based on URL type
   */
  public generateResearchSuggestions(url: string): string[] {
    const suggestions: string[] = [];
    const _urlLower = url.toLowerCase();

    if (urlLower.includes('github.com')) {
      suggestions.push('Analyze repository structure and recent commits');
      suggestions.push('Check issues and pull requests for insights');
      suggestions.push('Review README and documentation');
    } else if (urlLower.includes('docs.') || urlLower.includes('/docs/')) {
      suggestions.push('Extract API endpoints and usage examples');
      suggestions.push('Identify integration patterns');
      suggestions.push('Look for troubleshooting guides');
    } else if (urlLower.includes('stackoverflow.com')) {
      suggestions.push('Analyze the problem and solution approach');
      suggestions.push('Check alternative solutions in comments');
      suggestions.push('Find related questions');
    } else if (urlLower.includes('blog') || urlLower.includes('medium.com')) {
      suggestions.push('Extract key technical insights');
      suggestions.push('Identify best practices mentioned');
      suggestions.push('Look for code examples and implementations');
    } else {
      suggestions.push('Analyze content structure and main topics');
      suggestions.push('Extract technical information');
      suggestions.push('Identify actionable insights');
    }

    return suggestions;
  }

  /**
   * Create a _summary for AI context
   */
  public createResearchSummary(result: ResearchResult): string {
    let _summary = '\\n[URL RESEARCH RESULTS]\\n';
    _summary += 'URL: ' + result.originalUrl + '\\n';
    _summary += 'Type: ' + result.analysis.contentType + '\\n';
    _summary += 'Research Depth: ' + result.researchDepth + '\n\n';

    if (result.analysis.title) {
      _summary += 'Title: ' + result.analysis.title + '\n';
    }

    _summary += 'Summary: ' + result.analysis.summary + '\n\n';

    if (result.keyInsights.length > 0) {
      _summary += 'Key Insights:\n';
      result.keyInsights.forEach((insight, _index) => {
        _summary += (_index + 1) + '. ' + insight + '\n';
      });
      _summary += '\n';
    }

    if (result.actionableItems.length > 0) {
      _summary += 'Actionable Items:\n';
      result.actionableItems.forEach((_item, _index) => {
        _summary += (_index + 1) + '. ' + _item + '\n';
      });
      _summary += '\n';
    }

    return _summary;
  }
}
