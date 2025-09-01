/**
 * Authentication Manager
 * Central orchestrator for all CLI authentication operations
 */

import { AuthTokens, User, AuthResult, PKCEParams, DeviceFlowResponse, LoginOptions, LogoutOptions, AuthenticationRequiredError, QuotaExceededError, PlanRestrictedError, ERROR_MESSAGES } from './types';
import { TokenStorage } from './TokenStorage';
import crypto from 'crypto';
import { createServer, Server } from 'http';
import { URL } from 'url';
import open from 'open';

export class AuthenticationManager {
  private tokenStorage: TokenStorage;
  private readonly authBase: string;
  private readonly apiBase: string;
  private readonly clientId: string;
  private readonly REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes
  private readonly CLOCK_SKEW = 2 * 60 * 1000; // 2 minutes clock skew tolerance

  constructor() {
    this.tokenStorage = new TokenStorage();
    // Use custom domain for auth-server
    // Fallback order: env var -> custom domain -> Cloud Run URL
    this.authBase = process.env.MARIA_AUTH_BASE || 
                    'https://auth.maria-code.ai';
    // For now, use Cloud Run URL until DNS is configured
    // TODO: Remove this fallback once auth.maria-code.ai DNS is ready
    if (this.authBase === 'https://auth.maria-code.ai') {
      // Temporarily use Cloud Run URL until DNS propagates
      this.authBase = 'https://auth-server-1098737975582.us-central1.run.app';
      console.debug('Using Cloud Run URL for auth (DNS pending for auth.maria-code.ai)');
    }
    this.apiBase = process.env.MARIA_API_BASE || 'https://api.maria-code.ai';
    this.clientId = process.env.MARIA_CLIENT_ID || 'maria-cli';
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const tokens = await this.tokenStorage.load();
      if (!tokens) return false;

      // Check if token is still valid (with clock skew tolerance)
      if (Date.now() >= (tokens.expiresAt + this.CLOCK_SKEW)) {
        // Try to refresh
        return await this.refreshToken();
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Require authenticated user (throws if not authenticated)
   */
  async requireUser(): Promise<User> {
    if (!await this.isAuthenticated()) {
      throw new AuthenticationRequiredError(ERROR_MESSAGES.AUTH_REQUIRED);
    }

    return await this.getCurrentUser();
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<User> {
    const tokens = await this.getValidTokens();
    if (!tokens) {
      throw new AuthenticationRequiredError(ERROR_MESSAGES.AUTH_REQUIRED);
    }

    try {
      const response = await fetch(`${this.apiBase}/api/user/profile`, {
        headers: {
          'Authorization': `Bearer ${tokens.accessToken}`,
          'User-Agent': `maria-cli/${process.env.CLI_VERSION || '3.8.0'}`
        }
      });

      if (response.status === 401) {
        throw new AuthenticationRequiredError(ERROR_MESSAGES.TOKEN_EXPIRED);
      }

      if (response.status === 402) {
        throw new QuotaExceededError(ERROR_MESSAGES.QUOTA_EXCEEDED);
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch user profile: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof AuthenticationRequiredError || error instanceof QuotaExceededError) {
        throw error;
      }
      throw new Error(ERROR_MESSAGES.NETWORK_ERROR);
    }
  }

  /**
   * Login with OAuth2 PKCE flow
   */
  async login(options: LoginOptions = {}): Promise<AuthResult> {
    try {
      // Check if already authenticated
      if (await this.isAuthenticated() && !options.force) {
        const user = await this.getCurrentUser();
        return { success: true, user };
      }

      // Try PKCE flow first, fallback to device flow
      let tokens: AuthTokens;
      
      if (options.device) {
        tokens = await this.loginWithDeviceFlow();
      } else {
        try {
          tokens = await this.loginWithPKCEFlow();
        } catch (error) {
          console.warn('PKCE flow failed, falling back to device flow');
          tokens = await this.loginWithDeviceFlow();
        }
      }

      // Save tokens
      await this.tokenStorage.save(tokens);

      // Get user info
      const user = await this.getCurrentUser();

      return { success: true, user, tokens };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Login failed'
      };
    }
  }

  /**
   * Logout and clean up
   */
  async logout(options: LogoutOptions = {}): Promise<void> {
    try {
      const tokens = await this.tokenStorage.load();
      
      // Revoke tokens on server
      if (tokens && !options.force) {
        try {
          await this.revokeTokens(tokens, options.all || false);
        } catch (error) {
          console.warn('Server token revocation failed:', error);
        }
      }

      // Clear local storage
      await this.tokenStorage.clear();
    } catch (error) {
      if (!options.force) {
        throw error;
      }
      // Force logout - clear local storage even if server call fails
      await this.tokenStorage.clear();
    }
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(): Promise<boolean> {
    try {
      const tokens = await this.tokenStorage.load();
      if (!tokens?.refreshToken) return false;

      const response = await fetch(`${this.authBase}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: tokens.refreshToken,
          client_id: this.clientId
        })
      });

      if (!response.ok) return false;

      const newTokens = await response.json();
      const updatedTokens: AuthTokens = {
        idToken: newTokens.id_token,
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token || tokens.refreshToken,
        customToken: newTokens.custom_token,
        expiresAt: Date.now() + (newTokens.expires_in * 1000)
      };

      await this.tokenStorage.save(updatedTokens);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get usage statistics with quota checking
   */
  async getUsageStats(): Promise<{ usage: any; withinQuota: boolean }> {
    const user = await this.getCurrentUser();
    const withinQuota = user.usage.requests < user.usage.requestLimit;
    
    return {
      usage: user.usage,
      withinQuota
    };
  }

  /**
   * Check if feature is available for current plan
   */
  async checkPlanAccess(feature: string): Promise<void> {
    const user = await this.getCurrentUser();
    
    // Define feature restrictions for FREE plan
    const freeFeatures = ['chat', 'code', 'help', 'status', 'version'];
    const restrictedFeatures = ['image', 'video', 'voice', 'advanced-search'];
    
    if (user.plan === 'FREE' && restrictedFeatures.includes(feature)) {
      throw new PlanRestrictedError(ERROR_MESSAGES.PLAN_RESTRICTED);
    }
  }

  /**
   * Login with PKCE OAuth2 flow
   */
  private async loginWithPKCEFlow(): Promise<AuthTokens> {
    // Check if browser can be launched
    if (!this.canLaunchBrowser()) {
      throw new Error('Browser launch not available');
    }
    
    // Generate PKCE parameters
    const pkceParams = this.generatePKCEParams();
    
    // Start callback server
    const { server, port } = await this.startCallbackServer();
    
    try {
      // Build authorization URL
      const redirectUri = `http://127.0.0.1:${port}/callback`;
      const authUrl = this.buildAuthUrl(pkceParams, redirectUri);
      
      // Open browser with error handling
      console.log('📱 Opening browser for authentication...');
      try {
        await open(authUrl);
      } catch (error) {
        server.close();
        throw new Error('Failed to open browser');
      }
      
      // Wait for callback
      const authCode = await this.waitForCallback(server, pkceParams.state);
      
      // Exchange code for tokens
      return await this.exchangeCodeForTokens(authCode, pkceParams.codeVerifier, redirectUri);
    } finally {
      server.close();
    }
  }

  /**
   * Check if browser can be launched
   */
  private canLaunchBrowser(): boolean {
    // CI environment
    if (process.env.CI === 'true') return false;
    
    // SSH connection
    if (process.env.SSH_CONNECTION) return false;
    
    // WSL detection
    if (process.platform === 'linux' && process.env.WSL_DISTRO_NAME) return false;
    
    // Docker container
    if (process.env.CONTAINER === 'true') return false;
    
    // Headless environment
    if (!process.env.DISPLAY && process.platform === 'linux') return false;
    
    return true;
  }

  /**
   * Login with device flow (fallback)
   */
  private async loginWithDeviceFlow(): Promise<AuthTokens> {
    // Start device flow
    const response = await fetch(`${this.authBase}/oauth/device/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.clientId,
        scope: 'user:profile user:inference org:create_api_key'
      })
    });

    if (!response.ok) {
      throw new Error(`Device flow start failed: ${response.statusText}`);
    }

    const deviceResponse: DeviceFlowResponse = await response.json();
    
    console.log(`🔐 Device Login`);
    console.log(`Open: ${deviceResponse.verificationUri}`);
    console.log(`Code: ${deviceResponse.userCode}`);
    
    // Poll for completion
    const deadline = Date.now() + (deviceResponse.expiresIn * 1000);
    const intervalMs = Math.max(1500, deviceResponse.interval * 1000);
    
    while (Date.now() < deadline) {
      await this.sleep(intervalMs);
      
      const finishResponse = await fetch(`${this.authBase}/oauth/device/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: this.clientId,
          device_code: deviceResponse.deviceCode
        })
      });
      
      if (finishResponse.status === 428 || finishResponse.status === 400) {
        continue; // Still waiting
      }
      
      if (!finishResponse.ok) {
        throw new Error(`Device flow failed: ${finishResponse.statusText}`);
      }
      
      const tokens = await finishResponse.json();
      return {
        idToken: tokens.id_token,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        customToken: tokens.custom_token,
        expiresAt: Date.now() + (tokens.expires_in * 1000)
      };
    }
    
    throw new Error(ERROR_MESSAGES.LOGIN_TIMEOUT);
  }

  /**
   * Generate PKCE parameters
   */
  private generatePKCEParams(): PKCEParams {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    const state = crypto.randomBytes(16).toString('hex');

    return { codeVerifier, codeChallenge, state };
  }

  /**
   * Build authorization URL
   */
  private buildAuthUrl(pkceParams: PKCEParams, redirectUri: string): string {
    const url = new URL(`${this.authBase}/oauth/authorize`);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', 'user:profile user:inference org:create_api_key');
    url.searchParams.set('code_challenge', pkceParams.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('state', pkceParams.state);
    
    return url.toString();
  }

  /**
   * Start local callback server
   */
  private async startCallbackServer(): Promise<{ server: Server; port: number }> {
    // Try to find an available port
    const maxAttempts = 10;
    let lastError: Error | null = null;
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const port = await this.findAvailablePort();
        const server = await this.createServer(port);
        return { server, port };
      } catch (error: any) {
        lastError = error;
        if (error.code !== 'EADDRINUSE') {
          throw error;
        }
      }
    }
    
    throw lastError || new Error('Failed to find available port');
  }

  /**
   * Find an available port in the ephemeral range
   */
  private async findAvailablePort(): Promise<number> {
    // Use ephemeral port range (49152-65535)
    return 49152 + Math.floor(Math.random() * 16383);
  }

  /**
   * Create HTTP server on specified port
   */
  private async createServer(port: number): Promise<Server> {
    return new Promise((resolve, reject) => {
      const server = createServer();
      
      server.listen(port, '127.0.0.1', () => {
        resolve(server);
      });

      server.on('error', (err: any) => {
        reject(err);
      });
    });
  }

  /**
   * Wait for OAuth callback
   */
  private async waitForCallback(server: Server, expectedState: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        server.close();
        reject(new Error(ERROR_MESSAGES.LOGIN_TIMEOUT));
      }, 5 * 60 * 1000); // 5 minutes

      server.on('request', (req, res) => {
        const url = new URL(req.url!, 'http://127.0.0.1');
        
        if (url.pathname === '/callback') {
          const code = url.searchParams.get('code');
          const state = url.searchParams.get('state');
          const error = url.searchParams.get('error');

          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(this.getErrorPage(error));
            clearTimeout(timeout);
            reject(new Error(error));
            return;
          }

          if (!this.secureCompare(state || '', expectedState)) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(this.getErrorPage('Invalid state parameter'));
            clearTimeout(timeout);
            reject(new Error(ERROR_MESSAGES.INVALID_STATE));
            return;
          }

          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(this.getSuccessPage());
            clearTimeout(timeout);
            resolve(code);
          }
        }
      });
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  private async exchangeCodeForTokens(code: string, codeVerifier: string, redirectUri: string): Promise<AuthTokens> {
    const response = await fetch(`${this.authBase}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri
      })
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    const tokens = await response.json();
    return {
      idToken: tokens.id_token,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      customToken: tokens.custom_token,
      expiresAt: Date.now() + (tokens.expires_in * 1000)
    };
  }

  /**
   * Revoke tokens on server
   */
  private async revokeTokens(tokens: AuthTokens, allDevices: boolean): Promise<void> {
    const response = await fetch(`${this.apiBase}/api/auth/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens.accessToken}`
      },
      body: JSON.stringify({
        refresh_token: tokens.refreshToken,
        all_devices: allDevices
      })
    });

    if (!response.ok) {
      throw new Error(`Token revocation failed: ${response.statusText}`);
    }
  }

  /**
   * Get valid tokens (refresh if needed)
   */
  public async getValidTokens(): Promise<AuthTokens | null> {
    const tokens = await this.tokenStorage.load();
    if (!tokens) return null;

    // Check if token needs refresh (with threshold and clock skew)
    const now = Date.now();
    const expiresWithBuffer = tokens.expiresAt - this.REFRESH_THRESHOLD + this.CLOCK_SKEW;
    
    if (now >= expiresWithBuffer) {
      if (await this.refreshToken()) {
        return await this.tokenStorage.load();
      }
      return null;
    }

    return tokens;
  }

  /**
   * Secure string comparison
   */
  private secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }

  /**
   * HTML page for successful authentication
   */
  private getSuccessPage(): string {
    return `
      <html>
        <head>
          <title>MARIA CLI - Authentication Successful</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              text-align: center;
              padding: 50px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              margin: 0;
            }
            .icon { font-size: 64px; margin-bottom: 20px; }
            h1 { font-size: 36px; margin-bottom: 20px; }
            p { font-size: 18px; opacity: 0.9; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="icon">✅</div>
          <h1>Authentication Successful!</h1>
          <p>You can close this window and return to the terminal.</p>
          <p style="margin-top: 30px; opacity: 0.7;">MARIA CLI is now authenticated.</p>
        </body>
      </html>
    `;
  }

  /**
   * HTML page for authentication errors
   */
  private getErrorPage(error: string): string {
    return `
      <html>
        <head>
          <title>MARIA CLI - Authentication Error</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              text-align: center;
              padding: 50px;
              background: #ff6b6b;
              color: white;
              margin: 0;
            }
            .icon { font-size: 64px; margin-bottom: 20px; }
            h1 { font-size: 36px; margin-bottom: 20px; }
            p { font-size: 18px; opacity: 0.9; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="icon">❌</div>
          <h1>Authentication Failed</h1>
          <p>${error}</p>
          <p style="margin-top: 30px; opacity: 0.7;">You can close this window and try again.</p>
        </body>
      </html>
    `;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const authManager = new AuthenticationManager();