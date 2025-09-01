/**
 * Core input types for the Intelligent Model Selector
 */

export interface TaskInput {
  /** Unique trace identifier for request tracking and reproduction */
  traceId: string;
  
  /** Idempotency key to prevent duplicate processing */
  idempotencyKey: string;
  
  /** Task specification */
  task: {
    /** Type of task being performed */
    kind: 'chat' | 'code' | 'image' | 'video' | 'tts' | 'analysis';
    
    /** Sub-type for more specific routing */
    subtype?: 'fix_error' | 'add_feature' | 'refactor' | 'generate' | 'optimize';
    
    /** Estimated input tokens for cost calculation */
    tokensIn: number;
    
    /** Whether this requires long context window */
    longContext: boolean;
    
    /** Modality requirements */
    modality: 'text' | 'vision' | 'audio' | 'video' | 'multimodal';
  };
  
  /** Content payload (will be PII-redacted) */
  content: {
    /** Text content */
    text?: string;
    
    /** Binary content (base64 encoded) */
    binary?: {
      data: string;
      mimeType: string;
    };
    
    /** Structured metadata */
    metadata?: Record<string, any>;
  };
  
  /** Routing hints from client */
  hints: {
    /** Priority level for speed vs quality trade-off */
    priority: 'fast' | 'balanced' | 'quality';
    
    /** Maximum tokens for response */
    maxTokens?: number;
    
    /** Language preference */
    language?: string;
    
    /** Cost tier preference */
    costTier?: 'low' | 'mid' | 'high';
    
    /** Latency budget in milliseconds */
    latencyBudgetMs?: number;
  };
  
  /** Session context */
  session: {
    /** User identifier (will be hashed in logs) */
    userId?: string;
    
    /** User's subscription plan */
    plan: 'free' | 'starter' | 'pro' | 'enterprise';
    
    /** Current usage state */
    currentUsage: {
      inputTokens: number;
      outputTokens: number;
      monthStart: Date;
    };
    
    /** Request timestamp */
    requestedAt: Date;
  };
}

export interface ProcessedTaskInput extends Omit<TaskInput, 'content'> {
  /** PII-redacted content */
  cleanContent: TaskInput['content'];
  
  /** PII redaction report */
  piiRedactionReport: {
    location: string;
    type: string;
    count: number;
  }[];
}