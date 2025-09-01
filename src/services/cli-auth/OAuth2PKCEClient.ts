/**
 * OAuth2 PKCE Client for MARIA CLI - Phase 4 Implementation
 * Implements RFC 7636 PKCE (Proof Key for Code Exchange) flow
 * for secure CLI authentication without client secrets
 */

import * as crypto from 'crypto';
import * as http from 'http';
import * as url from 'url';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

interface PKCEConfig {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  authServerUrl?: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
}

interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt: number;
  scopes: string[];
  obtainedAt: number;
}

export class OAuth2PKCEClient {
  private config: PKCEConfig;
  private codeVerifier: string = '';
  private codeChallenge: string = '';
  private state: string = '';
  private server: http.Server | null = null;
  private tokenStoragePath: string;

  constructor(config: PKCEConfig) {
    this.config = {
      ...config,
      redirectUri: config.redirectUri || 'http://127.0.0.1:9876/callback',
      authServerUrl: config.authServerUrl || 'http://localhost:3000'
    };
    
    // Token storage in user's home directory
    const configDir = path.join(os.homedir(), '.maria');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    this.tokenStoragePath = path.join(configDir, 'auth-tokens.json');
  }

  /**
   * Generate cryptographically secure random string
   */
  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const randomBytes = crypto.randomBytes(length);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[randomBytes[i] % chars.length];
    }
    return result;
  }

  /**
   * Generate PKCE code verifier (43-128 characters)
   */
  private generateCodeVerifier(): string {
    // RFC 7636 recommends 43-128 characters
    return this.generateRandomString(128);
  }

  /**
   * Generate PKCE code challenge from verifier
   */
  private generateCodeChallenge(verifier: string): string {
    // S256 method: base64url(sha256(verifier))
    const hash = crypto.createHash('sha256').update(verifier).digest();
    return this.base64UrlEncode(hash);
  }

  /**
   * Base64 URL encoding (RFC 4648)
   */
  private base64UrlEncode(buffer: Buffer): string {
    return buffer.toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Generate state parameter for CSRF protection
   */
  private generateState(): string {
    return this.generateRandomString(32);
  }

  /**
   * Build authorization URL with PKCE parameters
   */
  private buildAuthorizationUrl(): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(' '),
      state: this.state,
      code_challenge: this.codeChallenge,
      code_challenge_method: 'S256'
    });

    return `${this.config.authorizationEndpoint}?${params.toString()}`;
  }

  /**
   * Start local HTTP server to receive OAuth callback
   */
  private async startCallbackServer(): Promise<string> {
    return new Promise((resolve, reject) => {
      const port = parseInt(new URL(this.config.redirectUri).port) || 9876;
      
      this.server = http.createServer((req, res) => {
        const reqUrl = url.parse(req.url || '', true);
        
        if (reqUrl.pathname === '/callback') {
          const code = reqUrl.query.code as string;
          const returnedState = reqUrl.query.state as string;
          const error = reqUrl.query.error as string;
          
          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                  <h2>❌ Authentication Failed</h2>
                  <p>Error: ${error}</p>
                  <p>You can close this window.</p>
                </body>
              </html>
            `);
            reject(new Error(`OAuth error: ${error}`));
            return;
          }
          
          if (returnedState !== this.state) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                  <h2>❌ Security Error</h2>
                  <p>State mismatch - possible CSRF attack</p>
                </body>
              </html>
            `);
            reject(new Error('State mismatch - possible CSRF attack'));
            return;
          }
          
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h2>✅ Authentication Successful!</h2>
                <p>You can close this window and return to the CLI.</p>
                <script>setTimeout(() => window.close(), 3000);</script>
              </body>
            </html>
          `);
          
          resolve(code);
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });
      
      this.server.listen(port, '127.0.0.1', () => {
        console.log(`🔐 Callback server listening on http://127.0.0.1:${port}`);
      });
      
      this.server.on('error', reject);
    });
  }

  /**
   * Stop the callback server
   */
  private stopCallbackServer(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  /**
   * Open URL in system browser
   */
  private async openBrowser(url: string): Promise<void> {
    const platform = os.platform();
    let command: string;
    let args: string[];
    
    switch (platform) {
      case 'darwin':
        command = 'open';
        args = [url];
        break;
      case 'win32':
        command = 'cmd';
        args = ['/c', 'start', url];
        break;
      default: // Linux and others
        command = 'xdg-open';
        args = [url];
        break;
    }
    
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { detached: true, stdio: 'ignore' });
      child.unref();
      child.on('error', reject);
      setTimeout(resolve, 1000); // Give browser time to open
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  private async exchangeCodeForTokens(code: string): Promise<TokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      code: code,
      redirect_uri: this.config.redirectUri,
      code_verifier: this.codeVerifier
    });

    const response = await fetch(this.config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Store tokens securely
   */
  private async storeTokens(tokens: TokenResponse): Promise<void> {
    const storedTokens: StoredTokens = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      idToken: tokens.id_token,
      expiresAt: Date.now() + (tokens.expires_in * 1000),
      scopes: tokens.scope?.split(' ') || this.config.scopes,
      obtainedAt: Date.now()
    };

    // In production, encrypt tokens before storing
    fs.writeFileSync(
      this.tokenStoragePath,
      JSON.stringify(storedTokens, null, 2),
      { mode: 0o600 } // Read/write for owner only
    );
  }

  /**
   * Load stored tokens
   */
  public async loadStoredTokens(): Promise<StoredTokens | null> {
    if (!fs.existsSync(this.tokenStoragePath)) {
      return null;
    }

    try {
      const data = fs.readFileSync(this.tokenStoragePath, 'utf-8');
      const tokens = JSON.parse(data) as StoredTokens;
      
      // Check if tokens are expired
      if (Date.now() >= tokens.expiresAt) {
        if (tokens.refreshToken) {
          // Try to refresh
          const newTokens = await this.refreshAccessToken(tokens.refreshToken);
          await this.storeTokens(newTokens);
          return this.loadStoredTokens();
        }
        return null;
      }
      
      return tokens;
    } catch (error) {
      console.error('Failed to load stored tokens:', error);
      return null;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  public async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.config.clientId,
      refresh_token: refreshToken
    });

    const response = await fetch(this.config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Main authentication flow
   */
  public async authenticate(): Promise<StoredTokens> {
    // Check for existing valid tokens
    const existingTokens = await this.loadStoredTokens();
    if (existingTokens) {
      console.log('✅ Using existing authentication');
      return existingTokens;
    }

    console.log('🚀 Starting OAuth2 PKCE authentication flow...');

    // Generate PKCE parameters
    this.codeVerifier = this.generateCodeVerifier();
    this.codeChallenge = this.generateCodeChallenge(this.codeVerifier);
    this.state = this.generateState();

    // Build authorization URL
    const authUrl = this.buildAuthorizationUrl();
    
    try {
      // Start callback server
      const codePromise = this.startCallbackServer();
      
      // Open browser for authentication
      console.log(`\n📱 Opening browser for authentication...`);
      console.log(`If browser doesn't open, visit:\n${authUrl}\n`);
      await this.openBrowser(authUrl);
      
      // Wait for callback with authorization code
      const code = await codePromise;
      console.log('✅ Authorization code received');
      
      // Exchange code for tokens
      console.log('🔄 Exchanging code for tokens...');
      const tokens = await this.exchangeCodeForTokens(code);
      
      // Store tokens
      await this.storeTokens(tokens);
      console.log('✅ Authentication complete! Tokens stored securely.');
      
      return this.loadStoredTokens() as Promise<StoredTokens>;
      
    } finally {
      this.stopCallbackServer();
    }
  }

  /**
   * Logout - clear stored tokens
   */
  public async logout(): Promise<void> {
    if (fs.existsSync(this.tokenStoragePath)) {
      fs.unlinkSync(this.tokenStoragePath);
      console.log('✅ Logged out successfully');
    }
  }

  /**
   * Get current access token
   */
  public async getAccessToken(): Promise<string | null> {
    const tokens = await this.loadStoredTokens();
    return tokens?.accessToken || null;
  }

  /**
   * Check if authenticated
   */
  public async isAuthenticated(): Promise<boolean> {
    const tokens = await this.loadStoredTokens();
    return tokens !== null;
  }
}