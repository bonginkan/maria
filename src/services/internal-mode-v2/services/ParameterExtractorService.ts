/**
 * Parameter Extractor Service
 * Extracts parameters and arguments from natural language input for specific commands
 */

import { BaseService, Service } from '../core';

export interface ParameterExtractionRequest {
  input: string;
  command: string;
  language: string;
  context?: Record<string, any>;
}

export interface ParameterExtractionResult {
  parameters: Record<string, any>;
  confidence: number;
  extractedEntities: Array<{
    type: string;
    value: Event;
    confidence: number;
    position: [number, number];
  }>;
}

@Service({
  id: 'parameter-extractor',
  name: 'ParameterExtractorService',
  version: '1.0.0',
  description: 'Extracts parameters from natural language for command execution',
})
export class ParameterExtractorService extends BaseService {
  id = 'parameter-extractor';
  version = '1.0.0';

  // Parameter extraction patterns by command
  private extractionPatterns = {
    '/code': {
      description:
        /(作って|書いて|実装|create|implement|write|build)\s*(.+?)(?:を|で|in|using|with|\.|$)/i,
      language: /(javascript|typescript|python|java|cpp|c\+\+|go|rust|php|ruby|swift|kotlin)/i,
      framework: /(react|vue|angular|express|flask|django|spring|nextjs)/i,
      style: /(functional|oop|object-oriented|class-based|functional)/i,
    },
    '/image': {
      prompt: /(画像|image|picture|illustration|graphic)\s*(.+?)(?:を|の|of|showing|with|\.|$)/i,
      style: /(realistic|cartoon|anime|abstract|minimalist|photorealistic|artistic)/i,
      size: /(\d+x\d+|small|medium|large|tiny|huge|square|landscape|portrait)/i,
      color: /(color|colour|monochrome|black and white|sepia|vibrant|muted)/i,
    },
    '/video': {
      description: /(動画|video|animation|movie)\s*(.+?)(?:を|の|of|showing|about|\.|$)/i,
      duration: /(\d+\s*(?:seconds?|minutes?|mins?|秒|分))/i,
      style: /(animation|live-action|cartoon|3d|2d|stop-motion)/i,
      format: /(mp4|avi|mov|webm|gif)/i,
    },
    '/document': {
      title:
        /(document|docs|documentation|文書|ドキュメント)\s*(.+?)(?:について|about|on|regarding|\.|$)/i,
      format: /(markdown|html|pdf|docx|txt)/i,
      length: /(short|long|brief|detailed|comprehensive|summary|overview)/i,
      language: /(japanese|english|chinese|korean|vietnamese|ja|en|zh|ko|vi)/i,
    },
    '/slides': {
      topic: /(presentation|slides|プレゼン|スライド)\s*(.+?)(?:について|about|on|regarding|\.|$)/i,
      slides: /(\d+)\s*(?:slides?|pages?|枚|ページ)/i,
      style: /(professional|casual|academic|business|creative|minimal)/i,
      template: /(default|modern|classic|colorful|dark|light)/i,
    },
  };

  // Entity recognition patterns
  private entityPatterns = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    url: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/g,
    phone: /(?:\+\d{1,3}\s?)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}/g,
    date: /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/g,
    time: /\b(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?(?:\s?[AaPp][Mm])?\b/g,
    number: /\b\d+(?:\.\d+)?\b/g,
    currency:
      /[$¥€£]\s?\d+(?:,\d{3})*(?:\.\d{2})?|\d+(?:,\d{3})*(?:\.\d{2})?\s?(?:dollars?|yen|euros?|pounds?)/g,
    percentage: /\b\d+(?:\.\d+)?%/g,
    programming_language:
      /\b(?:javascript|typescript|python|java|cpp|c\+\+|go|rust|php|ruby|swift|kotlin|html|css|sql)\b/gi,
    file_extension: /\.\w{2,4}\b/g,
  };

  async onInitialize(): Promise<void> {
    this.logger.info('Initializing Parameter Extractor Service...');
  }

  async onStart(): Promise<void> {
    this.logger.info('Starting Parameter Extractor Service...');
    this.emitServiceEvent('parameter-extractor:started', { service: this.id });
  }

  /**
   * Extract parameters from input for a specific command
   */
  async extractParameters(request: ParameterExtractionRequest): Promise<Record<string, any>> {
    const { input, command, language, context } = request;

    try {
      const patterns = this.extractionPatterns[command as keyof typeof this.extractionPatterns];
      if (!patterns) {
        return this.extractGenericParameters(input, language);
      }

      const extractedParams: Record<string, any> = {};

      // Extract command-specific parameters
      for (const [paramName, pattern] of Object.entries(patterns)) {
        const match = input.match(pattern);
        if (match && match[2]) {
          extractedParams[paramName] = match[2].trim();
        }
      }

      // Extract entities
      const entities = this.extractEntities(input);
      if (entities.length > 0) {
        extractedParams.entities = entities;
      }

      // Apply contextual enhancement
      if (context) {
        this.enhanceWithContext(extractedParams, context);
      }

      // Command-specific post-processing
      this.postProcessParameters(extractedParams, command, language);

      return extractedParams;
    } catch (error) {
      this.logger.error('Parameter extraction failed:', error);
      return {};
    }
  }

  /**
   * Extract detailed parameter analysis
   */
  async analyzeParameters(request: ParameterExtractionRequest): Promise<ParameterExtractionResult> {
    const parameters = await this.extractParameters(request);
    const entities = this.extractEntities(request.input);

    // Calculate confidence based on extraction success
    let confidence = 0.5; // Base confidence

    if (Object.keys(parameters).length > 0) confidence += 0.3;
    if (entities.length > 0) confidence += 0.2;

    return {
      parameters,
      confidence: Math.min(confidence, 1.0),
      extractedEntities: entities,
    };
  }

  /**
   * Extract entities from input text
   */
  private extractEntities(input: string): Array<{
    type: string;
    value: Event;
    confidence: number;
    position: [number, number];
  }> {
    const entities: Array<{
      type: string;
      value: Event;
      confidence: number;
      position: [number, number];
    }> = [];

    for (const [entityType, pattern] of Object.entries(this.entityPatterns)) {
      const matches = input.matchAll(pattern);

      for (const match of matches) {
        if (match.index !== undefined) {
          entities.push({
            type: entityType,
            value: match[0],
            confidence: 0.9,
            position: [match.index, match.index + match[0].length],
          });
        }
      }
    }

    return entities;
  }

  /**
   * Extract generic parameters when no specific patterns exist
   */
  private extractGenericParameters(input: string, language: string): Record<string, any> {
    const params: Record<string, any> = {};

    // Extract quoted strings as potential parameters
    const quotedStrings = input.match(/"([^"]+)"|'([^']+)'/g);
    if (quotedStrings) {
      params.quoted_text = quotedStrings.map((str) => str.slice(1, -1));
    }

    // Extract key-value patterns
    const keyValuePattern = /(\w+)[:=]\s*([^\s,]+)/g;
    const keyValueMatches = input.matchAll(keyValuePattern);

    for (const match of keyValueMatches) {
      params[match[1]] = match[2];
    }

    return params;
  }

  /**
   * Enhance parameters with contextual information
   */
  private enhanceWithContext(params: Record<string, any>, context: Record<string, any>): void {
    // Add working directory context
    if (context.workingDirectory && !params.directory) {
      params.directory = context.workingDirectory;
    }

    // Add user preferences
    if (context.userPreferences) {
      params.preferences = context.userPreferences;
    }

    // Add recent context
    if (context.recentCommands) {
      params.recentcontext = context.recentCommands.slice(-3); // Last 3 commands
    }
  }

  /**
   * Post-process parameters based on command type
   */
  private postProcessParameters(
    params: Record<string, any>,
    command: string,
    language: string,
  ): void {
    switch (command) {
      case '/code':
        // Default to TypeScript if no language specified
        if (!params.language && !params.programming_language) {
          params.language = 'typescript';
        }
        // Ensure description exists
        if (!params.description && !params.prompt) {
          params.description = 'Code implementation';
        }
        break;

      case '/image':
        // Default image size
        if (!params.size) {
          params.size = '1024x1024';
        }
        // Ensure prompt exists
        if (!params.prompt && !params.description) {
          params.prompt = 'An image';
        }
        break;

      case '/video':
        // Default duration
        if (!params.duration) {
          params.duration = '30 seconds';
        }
        // Default format
        if (!params.format) {
          params.format = 'mp4';
        }
        break;

      case '/document':
        // Default format
        if (!params.format) {
          params.format = 'markdown';
        }
        // Default language
        if (!params.language) {
          params.language = language;
        }
        break;

      case '/slides':
        // Default slide count
        if (!params.slides) {
          params.slides = '10';
        }
        // Default style
        if (!params.style) {
          params.style = 'professional';
        }
        break;
    }
  }

  /**
   * Validate extracted parameters
   */
  async validateParameters(options: {
    parameters: Record<string, any>;
    command: string;
  }): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const { parameters, command } = options;
    const errors: string[] = [];
    const warnings: string[] = [];

    // Command-specific validation
    switch (command) {
      case '/code':
        if (!parameters.description && !parameters.prompt) {
          errors.push('Code description is required');
        }
        break;

      case '/image':
        if (!parameters.prompt && !parameters.description) {
          errors.push('Image prompt is required');
        }
        if (parameters.size && !parameters.size.match(/\d+x\d+|small|medium|large/)) {
          warnings.push('Invalid size format');
        }
        break;

      case '/video':
        if (!parameters.description && !parameters.prompt) {
          errors.push('Video description is required');
        }
        break;
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get extraction statistics
   */
  getStats() {
    return {
      supportedCommands: Object.keys(this.extractionPatterns),
      entityTypes: Object.keys(this.entityPatterns),
      extractionAccuracy: 0.85, // TODO: Implement actual metrics
    };
  }
}
