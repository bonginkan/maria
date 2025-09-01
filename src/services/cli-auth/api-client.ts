/**
 * API Client with Authentication and Error Handling
 * Handles 401 (refresh), 429 (rate limit), and other errors gracefully
 */

import { authManager } from './AuthenticationManager';
import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';

// Error definitions with exit codes
export const ERR = {
  AUTH_REQUIRED: { msg: '🔐 Authentication required · Run: maria /login', code: 2 },
  REAUTH_REQUIRED: { msg: '🔄 Please re-authenticate · Run: maria /login', code: 2 },
  QUOTA: { msg: '⚠ Quota exceeded · Run: maria /billing', code: 3 },
  PLAN: { msg: '🔒 Not available in current plan', code: 4 },
  NETWORK: { msg: '🌐 Network error, check connection', code: 1 },
  RATE: { msg: '⏳ Rate limited, retrying...', code: 1 },
} as const;

// Get or create device ID for session tracking
function getDeviceId(): string {
  if (!(global as any).MARIA_DEVICE_ID) {
    (global as any).MARIA_DEVICE_ID = uuidv4();
  }
  return (global as any).MARIA_DEVICE_ID;
}

// Get session ID from current tokens
function getSessionId(): string | undefined {
  return (global as any).MARIA_SESSION_ID;
}

// Client-side rate limiting with real wait time
const rateLimitMap = new Map<string, number>();
const MIN_GAP_MS = 3000; // Minimum 3 seconds between requests

export function clientThrottle(endpoint: string): void {
  const now = Date.now();
  const lastCall = rateLimitMap.get(endpoint) || 0;
  const wait = MIN_GAP_MS - (now - lastCall);
  
  if (wait > 0) {
    const waitSeconds = Math.ceil(wait / 1000);
    console.log(chalk.yellow(`⏱️ Rate limit: wait ${waitSeconds}s`));
    throw { ...ERR.RATE, waitTime: waitSeconds };
  }
  
  rateLimitMap.set(endpoint, now);
}

/**
 * Make an authenticated API call with automatic retry and error handling
 * @param path API endpoint path
 * @param init Fetch options
 * @returns Response object
 */
export async function callApi(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const apiBase = process.env.MARIA_API_BASE || 'http://localhost:3001';
  const fullUrl = `${apiBase}${path}`;
  
  // Get valid token (may trigger refresh)
  let tokens = await authManager.getValidTokens();
  if (!tokens) {
    console.log(chalk.red(ERR.AUTH_REQUIRED.msg));
    process.exit(ERR.AUTH_REQUIRED.code);
  }
  
  // Build headers with authentication
  const buildHeaders = (token: string) => ({
    ...init.headers,
    'Authorization': `Bearer ${token}`,
    'X-Device-Id': getDeviceId(),
    'X-Session-Id': getSessionId() || '',
    'User-Agent': `maria-cli/${process.env.CLI_VERSION || '3.8.0'}`,
    'Content-Type': init.headers?.['Content-Type'] || 'application/json'
  });
  
  // Make the request
  const doFetch = async (token: string): Promise<Response> => {
    try {
      return await fetch(fullUrl, {
        ...init,
        headers: buildHeaders(token)
      });
    } catch (error: any) {
      // Network error
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        console.log(chalk.red(ERR.NETWORK.msg));
        process.exit(ERR.NETWORK.code);
      }
      throw error;
    }
  };
  
  // Initial request
  let response = await doFetch(tokens.accessToken);
  
  // Handle 401: Token expired, try refresh once
  if (response.status === 401) {
    console.log(chalk.gray('Token expired, refreshing...'));
    
    const refreshed = await authManager.refreshToken();
    if (!refreshed) {
      console.log(chalk.red(ERR.REAUTH_REQUIRED.msg));
      process.exit(ERR.REAUTH_REQUIRED.code);
    }
    
    // Get new tokens and retry
    tokens = await authManager.getValidTokens();
    if (!tokens) {
      console.log(chalk.red(ERR.REAUTH_REQUIRED.msg));
      process.exit(ERR.REAUTH_REQUIRED.code);
    }
    
    response = await doFetch(tokens.accessToken);
    
    // If still 401, authentication is broken
    if (response.status === 401) {
      console.log(chalk.red(ERR.REAUTH_REQUIRED.msg));
      process.exit(ERR.REAUTH_REQUIRED.code);
    }
  }
  
  // Handle 429: Rate limited
  if (response.status === 429) {
    const retryAfter = parseInt(
      response.headers.get('Retry-After') || 
      response.headers.get('X-RateLimit-Reset') || 
      '5'
    );
    
    // Display real wait time
    const waitTime = Math.min(retryAfter, 60); // Cap at 60 seconds
    console.log(chalk.yellow(`⏱️ Rate limit: wait ${waitTime}s`));
    
    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
    response = await doFetch(tokens.accessToken);
  }
  
  // Handle 402: Quota exceeded
  if (response.status === 402) {
    console.log(chalk.yellow(ERR.QUOTA.msg));
    process.exit(ERR.QUOTA.code);
  }
  
  // Handle 403: Plan restricted
  if (response.status === 403) {
    const error = await response.json().catch(() => ({}));
    if (error.code === 'PLAN_RESTRICTED') {
      console.log(chalk.yellow(ERR.PLAN.msg));
      process.exit(ERR.PLAN.code);
    }
  }
  
  return response;
}

/**
 * Make an authenticated API call and parse JSON response
 * @param path API endpoint path
 * @param init Fetch options
 * @returns Parsed JSON response
 */
export async function callApiJson<T = any>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await callApi(path, init);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: `API error: ${response.status} ${response.statusText}`
    }));
    throw new Error(error.message || `API error: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Stream API response with authentication
 * @param path API endpoint path
 * @param init Fetch options
 * @returns Async iterator for streaming response
 */
export async function* streamApi(
  path: string,
  init: RequestInit = {}
): AsyncGenerator<string, void, unknown> {
  const response = await callApi(path, {
    ...init,
    headers: {
      ...init.headers,
      'Accept': 'text/event-stream'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Stream error: ${response.status}`);
  }
  
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }
  
  const decoder = new TextDecoder();
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      yield chunk;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Upload file with authentication
 * @param path API endpoint path
 * @param file File data
 * @param metadata Additional metadata
 * @returns Upload response
 */
export async function uploadFile(
  path: string,
  file: Buffer | Uint8Array,
  metadata: Record<string, any> = {}
): Promise<any> {
  const formData = new FormData();
  formData.append('file', new Blob([file]));
  
  Object.entries(metadata).forEach(([key, value]) => {
    formData.append(key, String(value));
  });
  
  return callApiJson(path, {
    method: 'POST',
    body: formData,
    headers: {
      // Don't set Content-Type, let browser set it with boundary
    }
  });
}