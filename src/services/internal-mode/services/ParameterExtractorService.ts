/**
 * Parameter Extractor Service
 * Extracts _parameters and arguments from natural language input for specific commands
 */

import { BaseService, Service } from "../core";

export interface ParameterExtractionRequest {
  input: string;
  command: string;
  language: string;
  context?: Record<string, any>;
}

export interface ParameterExtractionResult {
  _parameters: Record<string, any>;
  confidence: number;
  extractedEntities: Array<{
    type: string;
    value: Event;
    confidence: number;
    position: [number, number];
  }>;
}

@Service({
  id: "parameter-extractor",
  name: "ParameterExtractorService",
  version: "1.0.0",
  description:
    "Extracts _parameters from natural language for command execution",
})
export class ParameterExtractorService extends BaseService {
  id = "parameter-extractor";
  version = "1.0.0";

  // Parameter extraction _patterns by command
  private extractionPatterns = {
    "/code": {
      description:
        /(作って|書いて|実装|create|implement|write|build)\s*(.+?)(?:を|で|in|using|with|\.|$)/i,
      language:
        /(javascript|typescript|python|java|cpp|c\+\+|go|rust|php|ruby|swift|kotlin)/i,
      framework: /(react|vue|angular|express|flask|django|spring|nextjs)/i,
      style: /(functional|oop|object-oriented|class-based|functional)/i,
    },
    "/image": {
      prompt:
        /(画像|image|picture|illustration|graphic)\s*(.+?)(?:を|の|of|showing|with|\.|$)/i,
      style:
        /(realistic|cartoon|anime|abstract|minimalist|photorealistic|artistic)/i,
      size: /(\d+x\d+|small|medium|large|tiny|huge|square|landscape|portrait)/i,
      color: /(color|colour|monochrome|black and white|sepia|vibrant|muted)/i,
    },
    "/video": {
      description:
        /(動画|video|animation|movie)\s*(.+?)(?:を|の|of|showing|about|\.|$)/i,
      duration: /(\d+\s*(?:seconds?|minutes?|mins?|秒|分))/i,
      style: /(animation|live-action|cartoon|3d|2d|stop-motion)/i,
      format: /(mp4|avi|mov|webm|gif)/i,
    },
    "/document": {
      title:
        /(document|docs|documentation|文書|ドキュメント)\s*(.+?)(?:について|about|on|regarding|\.|$)/i,
      format: /(markdown|html|pdf|docx|txt)/i,
      length: /(short|long|brief|detailed|comprehensive|summary|overview)/i,
      language: /(japanese|english|chinese|korean|vietnamese|ja|en|zh|ko|vi)/i,
    },
    "/slides": {
      topic:
        /(presentation|slides|プレゼン|スライド)\s*(.+?)(?:について|about|on|regarding|\.|$)/i,
      slides: /(\d+)\s*(?:slides?|pages?|枚|ページ)/i,
      style: /(professional|casual|academic|business|creative|minimal)/i,
      template: /(default|modern|classic|colorful|dark|light)/i,
    },
  };

  // Entity recognition _patterns
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
    programminglanguage:
      /\b(?:javascript|typescript|python|java|cpp|c\+\+|go|rust|php|ruby|swift|kotlin|html|css|sql)\b/gi,
    fileextension: /\.\w{2,4}\b/g,
  };

  async onInitialize(): Promise<void> {
    this.logger.info("Initializing Parameter Extractor Service...");
  }

  async onStart(): Promise<void> {
    this.logger.info("Starting Parameter Extractor Service...");
    this.emitServiceEvent("parameter-extractor:started", { service: this.id });
  }

  /**
   * Extract _parameters from input for a specific command
   */
  async extractParameters(
    request: ParameterExtractionRequest,
  ): Promise<Record<string, any>> {
    const { input, command, language, context } = request;

    try {
      const _patterns =
        this.extractionPatterns[
          command as keyof typeof this.extractionPatterns
        ];
      if (!_patterns) {
        return this.extractGenericParameters(input, language);
      }

      const extractedParams: Record<string, any> = {};

      // Extract command-specific _parameters
      for (const [paramName, pattern] of Object.entries(_patterns)) {
        const _match = input._match(pattern);
        if (_match && _match[2]) {
          extractedParams[paramName] = _match[2].trim();
        }
      }

      // Extract _entities
      const _entities = this.extractEntities(input);
      if (_entities.length > 0) {
        extractedParams._entities = _entities;
      }

      // Apply contextual enhancement
      if (context) {
        this.enhanceWithContext(extractedParams, context);
      }

      // Command-specific post-processing
      this.postProcessParameters(extractedParams, command, language);

      return extractedParams;
    } catch (_error) {
      this.logger.error("Parameter extraction failed:", _error);
      return {};
    }
  }

  /**
   * Extract detailed parameter analysis
   */
  async analyzeParameters(
    request: ParameterExtractionRequest,
  ): Promise<ParameterExtractionResult> {
    const _parameters = await this.extractParameters(request);
    const _entities = this.extractEntities(request.input);

    // Calculate confidence based on extraction success
    let confidence = 0.5; // Base confidence

    if (Object.keys(_parameters).length > 0) {
      confidence += 0.3;
    }
    if (_entities.length > 0) {
      confidence += 0.2;
    }

    return {
      _parameters,
      confidence: Math.min(confidence, 1.0),
      extractedEntities: _entities,
    };
  }

  /**
   * Extract _entities from input text
   */
  private extractEntities(input: string): Array<{
    type: string;
    value: Event;
    confidence: number;
    position: [number, number];
  }> {
    const _entities: Array<{
      type: string;
      value: Event;
      confidence: number;
      position: [number, number];
    }> = [];

    for (const [entityType, pattern] of Object.entries(this.entityPatterns)) {
      const _matches = input.matchAll(pattern);

      for (const _match of _matches) {
        if (_match.index !== undefined) {
          entities.push({
            type: entityType,
            value: _match[0],
            confidence: 0.9,
            position: [_match.index, _match.index + _match[0].length],
          });
        }
      }
    }

    return _entities;
  }

  /**
   * Extract generic _parameters when no specific _patterns exist
   */
  private extractGenericParameters(
    _input: string,
    _language: string,
  ): Record<string, any> {
    const params: Record<string, any> = {};

    // Extract quoted strings as potential _parameters
    const _quotedStrings = _input._match(/"([^"]+)"|'([^']+)'/g);
    if (_quotedStrings) {
      params.quoted_text = _quotedStrings.map((str) => str.slice(1, -1));
    }

    // Extract key-value _patterns
    const _keyValuePattern = /(\w+)[:=]\s*([^\s,]+)/g;
    const _keyValueMatches = _input.matchAll(_keyValuePattern);

    for (const _match of _keyValueMatches) {
      params[_match[1]] = _match[2];
    }

    return params;
  }

  /**
   * Enhance _parameters with contextual information
   */
  private enhanceWithContext(
    _params: Record<string, any>,
    context: Record<string, any>,
  ): void {
    // Add working directory context
    if (context.workingDirectory && !_params.directory) {
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
   * Post-process _parameters based on command type
   */
  private postProcessParameters(
    _params: Record<string, any>,
    command: string,
    language: string,
  ): void {
    switch (command) {
      case "/code":
        // Default to TypeScript if no language specified
        if (!_params.language && !_params.programming_language) {
          params.language = "typescript";
        }
        // Ensure description exists
        if (!_params.description && !_params.prompt) {
          params.description = "Code implementation";
        }
        break;

      case "/image":
        // Default image size
        if (!_params.size) {
          params.size = "1024x1024";
        }
        // Ensure prompt exists
        if (!_params.prompt && !_params.description) {
          params.prompt = "An image";
        }
        break;

      case "/video":
        // Default duration
        if (!_params.duration) {
          params.duration = "30 seconds";
        }
        // Default format
        if (!_params.format) {
          params.format = "mp4";
        }
        break;

      case "/document":
        // Default format
        if (!_params.format) {
          params.format = "markdown";
        }
        // Default language
        if (!_params.language) {
          params.language = language;
        }
        break;

      case "/slides":
        // Default slide count
        if (!_params.slides) {
          params.slides = "10";
        }
        // Default style
        if (!_params.style) {
          params.style = "professional";
        }
        break;
    }
  }

  /**
   * Validate extracted _parameters
   */
  async validateParameters(_options: {
    _parameters: Record<string, any>;
    command: string;
  }): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const { _parameters, command } = options;
    const errors: string[] = [];
    const warnings: string[] = [];

    // Command-specific validation
    switch (command) {
      case "/code":
        if (!parameters.description && !parameters.prompt) {
          errors.push("Code description is required");
        }
        break;

      case "/image":
        if (!parameters.prompt && !parameters.description) {
          errors.push("Image prompt is required");
        }
        if (
          parameters.size &&
          !parameters.size.match(/\d+x\d+|small|medium|large/)
        ) {
          warnings.push("Invalid size format");
        }
        break;

      case "/video":
        if (!parameters.description && !parameters.prompt) {
          errors.push("Video description is required");
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
