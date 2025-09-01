/**
 * MARIA API Client - Phase 4 Implementation
 * HTTP client for interacting with MARIA API Server endpoints
 * Handles authentication, request/response, and error handling
 */

import { OAuth2PKCEClient } from './OAuth2PKCEClient';

interface APIConfig {
  baseUrl: string;
  timeout?: number;
  retryAttempts?: number;
}

interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  hint?: string;
  action?: string;
}

interface MariaCommand {
  command: string;
  input: string;
  metadata?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    stream?: boolean;
  };
}

interface MariaResponse {
  success: boolean;
  output?: string;
  metadata?: {
    tokensUsed: number;
    model: string;
    processingTimeMs: number;
    planId: string;
  };
  quota?: {
    used: Record<string, number>;
    remain: Record<string, number>;
  };
}

interface UsageResponse {
  periodId: string;
  planCode: string;
  planName: string;
  used: Record<string, number>;
  remain: Record<string, number>;
  limits: Record<string, number>;
  percentage: Record<string, number>;
  resetAt: string;
  graceEndAt?: string;
}

interface PlanInfo {
  currentPlan: {
    id: string;
    name: string;
    priceUsd: number;
    features: any;
  };
  availablePlans: Array<{
    id: string;
    name: string;
    priceUsd: number;
    canUpgrade: boolean;
    canDowngrade: boolean;
  }>;
  usage?: any;
  recommendations?: any;
}

interface SystemStatus {
  status: 'healthy' | 'degraded' | 'maintenance';
  version: string;
  timestamp: string;
  services: Record<string, string>;
  rateLimits: any;
  planLimits?: any;
  announcements?: Array<{
    id: string;
    type: string;
    message: string;
    startDate: string;
    endDate?: string;
  }>;
}

export class MariaAPIClient {
  private config: APIConfig;
  private authClient: OAuth2PKCEClient;

  constructor(config: APIConfig, authClient: OAuth2PKCEClient) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:3000',
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 3
    };
    this.authClient = authClient;
  }

  /**
   * Make authenticated API request
   */
  private async request<T = any>(
    method: string,
    endpoint: string,
    body?: any,
    requiresAuth: boolean = true
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (requiresAuth) {
      const token = await this.authClient.getAccessToken();
      if (!token) {
        throw new Error('Authentication required. Please run "maria /login" first.');
      }
      headers['Authorization'] = `Bearer ${token}`;
    }

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= (this.config.retryAttempts || 3); attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        const responseData = await response.json();

        if (!response.ok) {
          // Handle specific error codes
          if (response.status === 401) {
            // Try to refresh token
            const tokens = await this.authClient.loadStoredTokens();
            if (tokens?.refreshToken) {
              try {
                await this.authClient.refreshAccessToken(tokens.refreshToken);
                // Retry request with new token
                continue;
              } catch {
                throw new Error('Session expired. Please login again.');
              }
            }
            throw new Error(responseData.hint || 'Authentication failed');
          }

          if (response.status === 429) {
            // Rate limited - wait and retry
            const retryAfter = response.headers.get('Retry-After');
            const delay = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
            console.log(`⏳ Rate limited. Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          throw new Error(responseData.error || `Request failed: ${response.status}`);
        }

        return responseData;

      } catch (error: any) {
        lastError = error;
        
        if (error.name === 'AbortError') {
          console.error(`Request timeout after ${this.config.timeout}ms`);
        }
        
        if (attempt < (this.config.retryAttempts || 3)) {
          console.log(`🔄 Retrying request (attempt ${attempt + 1}/${this.config.retryAttempts})...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    throw lastError || new Error('Request failed after all retries');
  }

  /**
   * Execute MARIA command
   */
  public async executeCommand(command: MariaCommand): Promise<MariaResponse> {
    return this.request<MariaResponse>('POST', '/api/v1/maria', command);
  }

  /**
   * Get usage information
   */
  public async getUsage(): Promise<UsageResponse> {
    return this.request<UsageResponse>('GET', '/api/v1/usage');
  }

  /**
   * Update usage (consume quota)
   */
  public async consumeQuota(consumption: Record<string, number>): Promise<UsageResponse> {
    return this.request<UsageResponse>('POST', '/api/v1/usage', { consumption });
  }

  /**
   * Get plan information
   */
  public async getPlanInfo(): Promise<PlanInfo> {
    return this.request<PlanInfo>('GET', '/api/v1/plans');
  }

  /**
   * Change subscription plan
   */
  public async changePlan(newPlanId: string, reason?: string): Promise<any> {
    return this.request('POST', '/api/v1/plans', { newPlanId, reason });
  }

  /**
   * Get system status
   */
  public async getSystemStatus(): Promise<SystemStatus> {
    return this.request<SystemStatus>('GET', '/api/v1/system', null, false);
  }

  /**
   * Get API documentation
   */
  public async getAPIInfo(): Promise<any> {
    return this.request('GET', '/api/v1', null, false);
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request('GET', '/api/healthz', null, false);
  }

  /**
   * Ask a question (convenience method)
   */
  public async ask(question: string, options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<string> {
    const response = await this.executeCommand({
      command: '/ask',
      input: question,
      metadata: options
    });

    if (!response.success) {
      throw new Error(response.error || 'Command failed');
    }

    return response.output || '';
  }

  /**
   * Generate code (convenience method)
   */
  public async generateCode(prompt: string, options?: {
    language?: string;
    framework?: string;
  }): Promise<string> {
    const response = await this.executeCommand({
      command: '/code',
      input: prompt,
      metadata: options
    });

    if (!response.success) {
      throw new Error(response.error || 'Code generation failed');
    }

    return response.output || '';
  }

  /**
   * Explain code (convenience method)
   */
  public async explainCode(code: string): Promise<string> {
    const response = await this.executeCommand({
      command: '/explain',
      input: code
    });

    if (!response.success) {
      throw new Error(response.error || 'Code explanation failed');
    }

    return response.output || '';
  }

  /**
   * Display usage statistics
   */
  public async displayUsageStats(): Promise<void> {
    try {
      const usage = await this.getUsage();
      
      console.log('\n📊 Usage Statistics');
      console.log('═══════════════════════════════════════');
      console.log(`📅 Period: ${usage.periodId}`);
      console.log(`💎 Plan: ${usage.planName} (${usage.planCode})`);
      console.log(`🔄 Resets: ${new Date(usage.resetAt).toLocaleDateString()}`);
      
      if (usage.graceEndAt) {
        console.log(`⚠️  Grace period ends: ${new Date(usage.graceEndAt).toLocaleString()}`);
      }
      
      console.log('\n📈 Resource Usage:');
      Object.keys(usage.used).forEach(key => {
        const used = usage.used[key];
        const limit = usage.limits[key];
        const percent = usage.percentage[key];
        const bar = this.createProgressBar(percent);
        
        console.log(`  ${this.getResourceIcon(key)} ${key}: ${used}/${limit} ${bar} ${percent}%`);
      });
      
      console.log('═══════════════════════════════════════\n');
    } catch (error: any) {
      console.error('Failed to fetch usage stats:', error.message);
    }
  }

  /**
   * Create visual progress bar
   */
  private createProgressBar(percentage: number): string {
    const width = 20;
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    
    const color = percentage >= 90 ? '\x1b[31m' : // Red
                  percentage >= 70 ? '\x1b[33m' : // Yellow
                  '\x1b[32m'; // Green
    
    return `${color}${'█'.repeat(filled)}${'░'.repeat(empty)}\x1b[0m`;
  }

  /**
   * Get icon for resource type
   */
  private getResourceIcon(resource: string): string {
    const icons: Record<string, string> = {
      req: '📨',
      tokens: '🪙',
      code: '💻',
      attachment: '📎'
    };
    return icons[resource] || '📊';
  }

  /**
   * Display system status
   */
  public async displaySystemStatus(): Promise<void> {
    try {
      const status = await this.getSystemStatus();
      
      console.log('\n🌐 System Status');
      console.log('═══════════════════════════════════════');
      console.log(`✨ Status: ${this.getStatusEmoji(status.status)} ${status.status.toUpperCase()}`);
      console.log(`📦 Version: ${status.version}`);
      console.log(`🕐 Time: ${new Date(status.timestamp).toLocaleString()}`);
      
      console.log('\n🔧 Services:');
      Object.entries(status.services).forEach(([service, serviceStatus]) => {
        const emoji = serviceStatus === 'operational' ? '✅' : 
                     serviceStatus === 'degraded' ? '⚠️' : '❌';
        console.log(`  ${emoji} ${service}: ${serviceStatus}`);
      });
      
      if (status.announcements && status.announcements.length > 0) {
        console.log('\n📢 Announcements:');
        status.announcements.forEach(announcement => {
          const icon = announcement.type === 'maintenance' ? '🔧' :
                       announcement.type === 'feature' ? '🎉' :
                       announcement.type === 'warning' ? '⚠️' : '📢';
          console.log(`  ${icon} ${announcement.message}`);
        });
      }
      
      console.log('═══════════════════════════════════════\n');
    } catch (error: any) {
      console.error('Failed to fetch system status:', error.message);
    }
  }

  /**
   * Get status emoji
   */
  private getStatusEmoji(status: string): string {
    const emojis: Record<string, string> = {
      healthy: '✅',
      degraded: '⚠️',
      maintenance: '🔧'
    };
    return emojis[status] || '❓';
  }
}