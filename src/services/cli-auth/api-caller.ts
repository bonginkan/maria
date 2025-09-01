/**
 * API Caller for CLI commands
 * Centralized API communication with authentication
 */

import { AuthenticationManager } from './AuthenticationManager';
import http from 'http';
import https from 'https';

// Keep-alive agent to reduce TLS overhead
const agent = new https.Agent({ keepAlive: true });

const authManager = new AuthenticationManager();

export interface APIRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

/**
 * Make authenticated API call to Maria server
 */
export async function callAPI(
  endpoint: string,
  options: APIRequestOptions = {}
): Promise<any> {
  // Get authentication token
  const tokens = await authManager.getValidTokens();
  if (!tokens) {
    throw new Error('Authentication required. Please run /login first.');
  }

  const apiBase = process.env.MARIA_API_BASE || 'https://api.maria-code.ai';
  const url = `${apiBase}${endpoint}`;

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s hard limit

  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      agent, // Use keep-alive agent
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Handle timeout
    if (!response) {
      throw new Error('🌐 Network error, check connection');
    }

  // Handle common response codes
  if (response.status === 401) {
    throw new Error('Session expired. Please run /login again.');
  }

  if (response.status === 402) {
    const data = await response.json().catch(() => ({}));
    throw new Error(`Quota exceeded: ${data.message || 'Please wait or /upgrade'}`);
  }

  if (response.status === 403) {
    const data = await response.json().catch(() => ({}));
    throw new Error(`Not available on Free plan: ${data.message || 'Run /upgrade'}`);
  }

  if (response.status === 429) {
    const h = response.headers;
    const ra = h.get('Retry-After');
    const reset = h.get('RateLimit-Reset') || h.get('X-RateLimit-Reset');
    
    let waitSec = 3; // Default
    
    if (ra && /^\d+$/.test(ra)) {
      waitSec = +ra;
    } else if (ra) {
      const t = Date.parse(ra);
      if (!isNaN(t)) waitSec = Math.max(1, Math.ceil((t - Date.now()) / 1000));
    } else if (reset) {
      waitSec = Math.max(1, Math.ceil((+reset - Date.now()) / 1000));
    }
    
    throw new RateLimitError(`⏱ Wait ${waitSec}s`, waitSec);
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Request failed: ${response.statusText}`);
  }

    const data = await response.json();
    return data;
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('🌐 Network error, check connection');
    }
    
    throw error;
  }
}

export class RateLimitError extends Error {
  constructor(message: string, public retryAfter: number) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Chat with AI via API (model-agnostic)
 */
export async function executeChat(messages: Array<{ role: string; content: string }>): Promise<{ 
  id: string;
  output: string; 
  routedModel?: {
    vendor: string;
    family: string;
    name: string;
    reason: string;
  };
  usage: {
    req: number;
    tokens: number;
  };
}> {
  const response = await callAPI('/v1/chat', {
    method: 'POST',
    body: { messages }
  });
  return response;
}

/**
 * Execute code generation via API (model-agnostic)
 */
export async function executeCode(prompt: string): Promise<{ 
  output: string; 
  language?: string;
  routedModel?: {
    vendor: string;
    family: string;
    name: string;
    reason: string;
  };
  quotaRemain?: number;
  quotaReset?: string;
}> {
  const response = await callAPI('/v1/ai-proxy', {
    method: 'POST',
    body: { 
      prompt,
      taskType: 'code'
    }
  });
  
  // Extract routed model info for display
  if (response.data?.routedModel) {
    response.routedModel = response.data.routedModel;
  }
  
  // Map response format
  if (response.data?.content) {
    response.output = response.data.content;
  }
  
  return response;
}

/**
 * Legacy API for backward compatibility
 */
export async function executeAIProxy(
  provider: string, 
  model: string, 
  messages: Array<{ role: string; content: string }>,
  options?: Record<string, any>
): Promise<any> {
  return callAPI('/v1/ai-proxy', {
    method: 'POST',
    body: { provider, model, messages, options }
  });
}