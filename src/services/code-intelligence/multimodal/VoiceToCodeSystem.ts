import { BaseService } from '../../base/BaseService.js';
import { Phase2IntegratedSystem } from '../Phase2IntegratedSystem.js';
import { EnterpriseTypeScriptEngine } from '../EnterpriseTypeScriptEngine.js';

export interface VoiceInput {
  audioBuffer: Buffer;
  format: 'wav' | 'mp3' | 'webm' | 'ogg';
  sampleRate: number;
  duration: number;
  language?: string;
}

export interface VoiceTranscription {
  text: string;
  confidence: number;
  language: string;
  segments: TranscriptionSegment[];
  intent?: CodeIntent;
}

export interface TranscriptionSegment {
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
  keywords?: string[];
}

export interface CodeIntent {
  action: 'CREATE' | 'MODIFY' | 'REFACTOR' | 'FIX' | 'DELETE' | 'EXPLAIN' | 'TEST';
  target?: string;
  context?: string;
  parameters?: Record<string, any>;
  confidence: number;
}

export interface VoiceToCodeResult {
  transcription: VoiceTranscription;
  intent: CodeIntent;
  generatedCode?: string;
  executedActions?: string[];
  feedback?: string;
  success: boolean;
}

export interface VoiceCommandPattern {
  patterns: RegExp[];
  action: CodeIntent['action'];
  extractor: (match: RegExpMatchArray) => Partial<CodeIntent>;
}

export class VoiceToCodeSystem extends BaseService {
  private phase2System: Phase2IntegratedSystem;
  private tsEngine: EnterpriseTypeScriptEngine;
  private commandPatterns: VoiceCommandPattern[];
  private transcriptionCache: Map<string, VoiceTranscription> = new Map();

  constructor(phase2System: Phase2IntegratedSystem, tsEngine: EnterpriseTypeScriptEngine) {
    super();
    this.phase2System = phase2System;
    this.tsEngine = tsEngine;
    this.commandPatterns = this.initializeCommandPatterns();
  }

  private initializeCommandPatterns(): VoiceCommandPattern[] {
    return [
      // CREATE patterns
      {
        patterns: [
          /create\s+(?:a\s+)?new\s+(\w+)\s+(?:called|named)\s+(\w+)/i,
          /generate\s+(?:a\s+)?(\w+)\s+component\s+(?:for\s+)?(\w+)/i,
          /make\s+(?:me\s+)?(?:a\s+)?(\w+)\s+(?:class|function|module)\s+(?:called\s+)?(\w+)?/i
        ],
        action: 'CREATE',
        extractor: (match) => ({
          target: match[2] || match[1],
          parameters: { type: match[1] }
        })
      },
      // MODIFY patterns
      {
        patterns: [
          /(?:modify|change|update)\s+(?:the\s+)?(\w+)\s+(?:to|so\s+that|with)\s+(.+)/i,
          /add\s+(?:a\s+)?(\w+)\s+(?:to|into)\s+(?:the\s+)?(\w+)/i,
          /insert\s+(.+)\s+(?:into|to)\s+(?:the\s+)?(\w+)/i
        ],
        action: 'MODIFY',
        extractor: (match) => ({
          target: match[1],
          context: match[2]
        })
      },
      // REFACTOR patterns
      {
        patterns: [
          /refactor\s+(?:the\s+)?(\w+)\s+(?:to|into|using)\s+(.+)/i,
          /extract\s+(?:a\s+)?(\w+)\s+from\s+(?:the\s+)?(\w+)/i,
          /rename\s+(?:the\s+)?(\w+)\s+to\s+(\w+)/i
        ],
        action: 'REFACTOR',
        extractor: (match) => ({
          target: match[1],
          parameters: { newName: match[2] || undefined, type: 'rename' }
        })
      },
      // FIX patterns
      {
        patterns: [
          /fix\s+(?:the\s+)?(?:error|bug|issue|problem)\s+(?:in\s+)?(?:the\s+)?(\w+)?/i,
          /resolve\s+(?:the\s+)?typescript\s+errors?\s+(?:in\s+)?(\w+)?/i,
          /correct\s+(?:the\s+)?(\w+)\s+(?:error|issue)/i
        ],
        action: 'FIX',
        extractor: (match) => ({
          target: match[1] || 'current_file'
        })
      },
      // DELETE patterns
      {
        patterns: [
          /(?:delete|remove)\s+(?:the\s+)?(\w+)\s+(?:from\s+)?(\w+)?/i,
          /get\s+rid\s+of\s+(?:the\s+)?(\w+)/i
        ],
        action: 'DELETE',
        extractor: (match) => ({
          target: match[1],
          context: match[2]
        })
      },
      // EXPLAIN patterns
      {
        patterns: [
          /(?:explain|describe|what\s+does)\s+(?:the\s+)?(\w+)\s+(?:do|mean)?/i,
          /how\s+does\s+(?:the\s+)?(\w+)\s+work/i,
          /tell\s+me\s+about\s+(?:the\s+)?(\w+)/i
        ],
        action: 'EXPLAIN',
        extractor: (match) => ({
          target: match[1]
        })
      },
      // TEST patterns
      {
        patterns: [
          /(?:test|write\s+tests?\s+for)\s+(?:the\s+)?(\w+)/i,
          /create\s+(?:unit\s+)?tests?\s+for\s+(?:the\s+)?(\w+)/i,
          /generate\s+test\s+cases?\s+for\s+(?:the\s+)?(\w+)/i
        ],
        action: 'TEST',
        extractor: (match) => ({
          target: match[1]
        })
      }
    ];
  }

  async processVoiceInput(input: VoiceInput): Promise<VoiceToCodeResult> {
    try {
      console.log('🎤 Processing voice input...');
      
      // Step 1: Transcribe audio to text
      const transcription = await this.transcribeAudio(input);
      
      // Step 2: Extract intent from transcription
      const intent = this.extractIntent(transcription);
      
      // Step 3: Generate code based on intent
      const codeResult = await this.generateCodeFromIntent(intent, transcription);
      
      // Step 4: Execute with Phase 2 validation if needed
      if (codeResult.code && intent.action !== 'EXPLAIN') {
        const validationResult = await this.validateWithPhase2(codeResult.code, intent);
        
        if (!validationResult.success) {
          return {
            transcription,
            intent,
            generatedCode: codeResult.code,
            feedback: `Validation failed: ${validationResult.message}`,
            success: false
          };
        }
      }
      
      // Step 5: Generate voice feedback
      const feedback = this.generateVoiceFeedback(intent, codeResult);
      
      return {
        transcription,
        intent,
        generatedCode: codeResult.code,
        executedActions: codeResult.actions,
        feedback,
        success: true
      };
      
    } catch (error) {
      console.error('Voice processing error:', error);
      return {
        transcription: { text: '', confidence: 0, language: 'en', segments: [] },
        intent: { action: 'CREATE', confidence: 0 },
        feedback: `Error processing voice input: ${error.message}`,
        success: false
      };
    }
  }

  private async transcribeAudio(input: VoiceInput): Promise<VoiceTranscription> {
    // Check cache first
    const cacheKey = this.generateCacheKey(input);
    if (this.transcriptionCache.has(cacheKey)) {
      return this.transcriptionCache.get(cacheKey)!;
    }

    // In production, this would use Google Speech-to-Text, Azure Speech, or OpenAI Whisper
    // For now, we'll simulate with a mock implementation
    const mockTranscription: VoiceTranscription = {
      text: 'create a new React component called UserProfile with props for name and avatar',
      confidence: 0.95,
      language: input.language || 'en',
      segments: [
        {
          text: 'create a new React component',
          startTime: 0,
          endTime: 2.5,
          confidence: 0.96,
          keywords: ['create', 'React', 'component']
        },
        {
          text: 'called UserProfile',
          startTime: 2.5,
          endTime: 3.8,
          confidence: 0.94,
          keywords: ['UserProfile']
        },
        {
          text: 'with props for name and avatar',
          startTime: 3.8,
          endTime: 5.2,
          confidence: 0.93,
          keywords: ['props', 'name', 'avatar']
        }
      ]
    };

    // Cache the transcription
    this.transcriptionCache.set(cacheKey, mockTranscription);
    
    return mockTranscription;
  }

  private extractIntent(transcription: VoiceTranscription): CodeIntent {
    const text = transcription.text.toLowerCase();
    
    // Try to match against command patterns
    for (const pattern of this.commandPatterns) {
      for (const regex of pattern.patterns) {
        const match = text.match(regex);
        if (match) {
          const extracted = pattern.extractor(match);
          return {
            action: pattern.action,
            target: extracted.target,
            context: extracted.context,
            parameters: extracted.parameters,
            confidence: transcription.confidence * 0.9 // Adjust confidence based on pattern match
          };
        }
      }
    }
    
    // Default intent if no pattern matches
    return this.inferIntentFromKeywords(transcription);
  }

  private inferIntentFromKeywords(transcription: VoiceTranscription): CodeIntent {
    const keywords = transcription.segments.flatMap(s => s.keywords || []);
    const text = transcription.text.toLowerCase();
    
    // Simple keyword-based inference
    if (keywords.includes('create') || keywords.includes('generate') || text.includes('new')) {
      return { action: 'CREATE', confidence: 0.7 };
    }
    if (keywords.includes('fix') || keywords.includes('error') || keywords.includes('bug')) {
      return { action: 'FIX', confidence: 0.7 };
    }
    if (keywords.includes('refactor') || keywords.includes('extract') || keywords.includes('rename')) {
      return { action: 'REFACTOR', confidence: 0.7 };
    }
    if (keywords.includes('test') || text.includes('test')) {
      return { action: 'TEST', confidence: 0.7 };
    }
    if (keywords.includes('explain') || text.includes('what') || text.includes('how')) {
      return { action: 'EXPLAIN', confidence: 0.7 };
    }
    
    // Default to CREATE with low confidence
    return { action: 'CREATE', confidence: 0.5 };
  }

  private async generateCodeFromIntent(
    intent: CodeIntent,
    transcription: VoiceTranscription
  ): Promise<{ code?: string; actions?: string[] }> {
    
    switch (intent.action) {
      case 'CREATE':
        return this.generateCreateCode(intent, transcription);
      
      case 'MODIFY':
        return this.generateModifyCode(intent, transcription);
      
      case 'REFACTOR':
        return this.generateRefactorCode(intent, transcription);
      
      case 'FIX':
        return this.generateFixCode(intent, transcription);
      
      case 'DELETE':
        return this.generateDeleteCode(intent, transcription);
      
      case 'TEST':
        return this.generateTestCode(intent, transcription);
      
      case 'EXPLAIN':
        return this.generateExplanation(intent, transcription);
      
      default:
        return { code: undefined, actions: [] };
    }
  }

  private async generateCreateCode(
    intent: CodeIntent,
    transcription: VoiceTranscription
  ): Promise<{ code?: string; actions?: string[] }> {
    const text = transcription.text;
    
    // Extract component details from natural language
    const isReactComponent = text.match(/react|component/i);
    const componentName = intent.target || 'NewComponent';
    const propsMatch = text.match(/props?\s+(?:for\s+)?(.+?)(?:\s+and\s+|$)/gi);
    
    if (isReactComponent) {
      const props = propsMatch ? this.extractPropsFromText(propsMatch[0]) : [];
      
      const code = `import React from 'react';

interface ${componentName}Props {
${props.map(p => `  ${p.name}: ${p.type};`).join('\n')}
}

export const ${componentName}: React.FC<${componentName}Props> = ({ ${props.map(p => p.name).join(', ')} }) => {
  return (
    <div className="${this.camelToKebab(componentName)}">
      <h2>${componentName}</h2>
${props.map(p => `      <div>{${p.name}}</div>`).join('\n')}
    </div>
  );
};

export default ${componentName};`;

      return {
        code,
        actions: [`Created React component: ${componentName}`]
      };
    }
    
    // Default to TypeScript function
    const code = `export function ${componentName}() {
  // TODO: Implement ${componentName}
  return null;
}`;
    
    return {
      code,
      actions: [`Created function: ${componentName}`]
    };
  }

  private async generateModifyCode(
    intent: CodeIntent,
    transcription: VoiceTranscription
  ): Promise<{ code?: string; actions?: string[] }> {
    // This would integrate with AST to modify existing code
    const target = intent.target || 'current_file';
    const modification = intent.context || transcription.text;
    
    return {
      code: `// Modified ${target}: ${modification}`,
      actions: [`Modified ${target}`]
    };
  }

  private async generateRefactorCode(
    intent: CodeIntent,
    transcription: VoiceTranscription
  ): Promise<{ code?: string; actions?: string[] }> {
    const refactorType = intent.parameters?.type || 'extract';
    const target = intent.target || 'selection';
    
    // Use AST engine for refactoring
    const result = await this.tsEngine.safeRefactor(
      refactorType as any,
      target,
      { request: transcription.text }
    );
    
    if (result.success && result.changes.length > 0) {
      return {
        code: result.changes[0].content,
        actions: result.changes.map(c => c.description)
      };
    }
    
    return {
      code: undefined,
      actions: [`Refactoring ${target} failed`]
    };
  }

  private async generateFixCode(
    intent: CodeIntent,
    transcription: VoiceTranscription
  ): Promise<{ code?: string; actions?: string[] }> {
    const target = intent.target || 'current_file';
    
    // Use AST engine to fix errors
    const diagnostics = await this.tsEngine.getDiagnostics(target);
    const result = await this.tsEngine.fixErrors(diagnostics);
    
    if (result.success && result.changes.length > 0) {
      return {
        code: result.changes[0].content,
        actions: [`Fixed ${diagnostics.length} errors in ${target}`]
      };
    }
    
    return {
      code: undefined,
      actions: [`No errors found in ${target}`]
    };
  }

  private async generateDeleteCode(
    intent: CodeIntent,
    transcription: VoiceTranscription
  ): Promise<{ code?: string; actions?: string[] }> {
    const target = intent.target;
    const context = intent.context;
    
    return {
      code: undefined,
      actions: [`Deleted ${target}${context ? ` from ${context}` : ''}`]
    };
  }

  private async generateTestCode(
    intent: CodeIntent,
    transcription: VoiceTranscription
  ): Promise<{ code?: string; actions?: string[] }> {
    const target = intent.target || 'Component';
    
    const code = `import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ${target} from './${target}';

describe('${target}', () => {
  it('should render correctly', () => {
    render(<${target} />);
    expect(screen.getByText('${target}')).toBeInTheDocument();
  });

  it('should handle props', () => {
    const props = { /* test props */ };
    render(<${target} {...props} />);
    // Add assertions
  });
});`;

    return {
      code,
      actions: [`Generated tests for ${target}`]
    };
  }

  private async generateExplanation(
    intent: CodeIntent,
    transcription: VoiceTranscription
  ): Promise<{ code?: string; actions?: string[] }> {
    const target = intent.target;
    
    return {
      code: undefined,
      actions: [`Explained ${target}: This is a placeholder explanation`]
    };
  }

  private async validateWithPhase2(code: string, intent: CodeIntent): Promise<{ success: boolean; message?: string }> {
    try {
      const operation = async (workingDir: string) => {
        // Simulate saving the code to validate it
        return { code, intent };
      };
      
      const result = await this.phase2System.quickExecute(
        process.cwd(),
        operation,
        `Voice command: ${intent.action}`,
        { dryRun: true }
      );
      
      return {
        success: result.success,
        message: result.summary
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  private generateVoiceFeedback(intent: CodeIntent, result: { code?: string; actions?: string[] }): string {
    if (!result.code && (!result.actions || result.actions.length === 0)) {
      return `I couldn't ${intent.action.toLowerCase()} that. Please try rephrasing your request.`;
    }
    
    const actionSummary = result.actions?.join('. ') || '';
    
    switch (intent.action) {
      case 'CREATE':
        return `Created ${intent.target || 'component'} successfully. ${actionSummary}`;
      
      case 'MODIFY':
        return `Modified ${intent.target || 'code'} as requested. ${actionSummary}`;
      
      case 'REFACTOR':
        return `Refactored ${intent.target || 'code'} successfully. ${actionSummary}`;
      
      case 'FIX':
        return `Fixed errors in ${intent.target || 'the code'}. ${actionSummary}`;
      
      case 'DELETE':
        return `Deleted ${intent.target} successfully. ${actionSummary}`;
      
      case 'TEST':
        return `Generated tests for ${intent.target}. ${actionSummary}`;
      
      case 'EXPLAIN':
        return actionSummary || `Here's the explanation for ${intent.target}`;
      
      default:
        return `Operation completed. ${actionSummary}`;
    }
  }

  private extractPropsFromText(text: string): Array<{ name: string; type: string }> {
    // Extract prop names from natural language
    const props: Array<{ name: string; type: string }> = [];
    
    // Common patterns: "props for name and avatar", "name, email, and age props"
    const propNames = text.match(/\b([a-z]+)\b/gi) || [];
    
    for (const propName of propNames) {
      if (!['props', 'for', 'and', 'with', 'the', 'a', 'an'].includes(propName.toLowerCase())) {
        // Infer type from prop name
        let type = 'string';
        if (propName.match(/age|count|number|id/i)) type = 'number';
        if (propName.match(/is|has|should|can/i)) type = 'boolean';
        if (propName.match(/date|time/i)) type = 'Date';
        if (propName.match(/list|array|items/i)) type = 'any[]';
        
        props.push({ name: propName.toLowerCase(), type });
      }
    }
    
    return props;
  }

  private camelToKebab(str: string): string {
    return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
  }

  private generateCacheKey(input: VoiceInput): string {
    // Generate a unique key for caching transcriptions
    return `${input.format}_${input.sampleRate}_${input.duration}_${input.audioBuffer.length}`;
  }

  async startContinuousListening(
    onTranscription: (result: VoiceToCodeResult) => void,
    options: { language?: string; continuous?: boolean } = {}
  ): Promise<() => void> {
    console.log('🎤 Starting continuous voice listening...');
    
    // This would integrate with Web Audio API or native audio capture
    // Returns a stop function
    return () => {
      console.log('🛑 Stopped voice listening');
    };
  }

  async processVoiceCommand(command: string): Promise<VoiceToCodeResult> {
    // Direct text command processing (for testing without audio)
    const transcription: VoiceTranscription = {
      text: command,
      confidence: 1.0,
      language: 'en',
      segments: [{
        text: command,
        startTime: 0,
        endTime: 1,
        confidence: 1.0
      }]
    };
    
    const intent = this.extractIntent(transcription);
    const codeResult = await this.generateCodeFromIntent(intent, transcription);
    const feedback = this.generateVoiceFeedback(intent, codeResult);
    
    return {
      transcription,
      intent,
      generatedCode: codeResult.code,
      executedActions: codeResult.actions,
      feedback,
      success: true
    };
  }

  async initialize(): Promise<void> {
    // Initialize VoiceToCodeSystem - no initialization needed for now
  }
}