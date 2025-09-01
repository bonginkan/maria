/**
 * CLI Authentication Service - Phase 4 Implementation
 * Main service that orchestrates OAuth2 PKCE authentication for MARIA CLI
 * Integrates with OAuth2PKCEClient and MariaAPIClient
 */

import { OAuth2PKCEClient } from './OAuth2PKCEClient';
import { MariaAPIClient } from './MariaAPIClient';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

interface AuthConfig {
  apiBaseUrl?: string;
  authServerUrl?: string;
  clientId?: string;
  scopes?: string[];
}

interface CLIConfig {
  apiBaseUrl: string;
  authServerUrl: string;
  clientId: string;
  scopes: string[];
  lastLogin?: string;
  userEmail?: string;
  planName?: string;
}

export class CLIAuthService {
  private static instance: CLIAuthService;
  private authClient: OAuth2PKCEClient;
  private apiClient: MariaAPIClient;
  private configPath: string;
  private config: CLIConfig;

  private constructor(config?: AuthConfig) {
    // Load or initialize configuration
    const configDir = path.join(os.homedir(), '.maria');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    this.configPath = path.join(configDir, 'cli-config.json');
    
    this.config = this.loadConfig(config);
    
    // Initialize OAuth2 PKCE client
    this.authClient = new OAuth2PKCEClient({
      authorizationEndpoint: `${this.config.authServerUrl}/oauth/authorize`,
      tokenEndpoint: `${this.config.authServerUrl}/oauth/token`,
      clientId: this.config.clientId,
      redirectUri: 'http://127.0.0.1:9876/callback',
      scopes: this.config.scopes,
      authServerUrl: this.config.authServerUrl
    });
    
    // Initialize API client
    this.apiClient = new MariaAPIClient({
      baseUrl: this.config.apiBaseUrl,
      timeout: 30000,
      retryAttempts: 3
    }, this.authClient);
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: AuthConfig): CLIAuthService {
    if (!CLIAuthService.instance) {
      CLIAuthService.instance = new CLIAuthService(config);
    }
    return CLIAuthService.instance;
  }

  /**
   * Load configuration from file or use defaults
   */
  private loadConfig(overrides?: AuthConfig): CLIConfig {
    let config: CLIConfig = {
      apiBaseUrl: 'http://localhost:3000',
      authServerUrl: 'http://localhost:3000',
      clientId: 'maria-cli',
      scopes: ['profile', 'email', 'maria.api']
    };

    // Load from file if exists
    if (fs.existsSync(this.configPath)) {
      try {
        const savedConfig = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
        config = { ...config, ...savedConfig };
      } catch (error) {
        console.warn('Failed to load saved configuration, using defaults');
      }
    }

    // Apply overrides
    if (overrides) {
      config = {
        ...config,
        ...(overrides.apiBaseUrl && { apiBaseUrl: overrides.apiBaseUrl }),
        ...(overrides.authServerUrl && { authServerUrl: overrides.authServerUrl }),
        ...(overrides.clientId && { clientId: overrides.clientId }),
        ...(overrides.scopes && { scopes: overrides.scopes })
      };
    }

    // Handle environment-specific configuration
    if (process.env.MARIA_API_URL) {
      config.apiBaseUrl = process.env.MARIA_API_URL;
    }
    if (process.env.MARIA_AUTH_URL) {
      config.authServerUrl = process.env.MARIA_AUTH_URL;
    }
    if (process.env.MARIA_CLIENT_ID) {
      config.clientId = process.env.MARIA_CLIENT_ID;
    }

    return config;
  }

  /**
   * Save configuration to file
   */
  private saveConfig(): void {
    try {
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        { mode: 0o600 }
      );
    } catch (error) {
      console.warn('Failed to save configuration');
    }
  }

  /**
   * Login command handler
   */
  public async login(): Promise<void> {
    console.log('🚀 MARIA CLI Authentication');
    console.log('═══════════════════════════════════════\n');

    try {
      // Check if already authenticated
      const isAuth = await this.authClient.isAuthenticated();
      if (isAuth) {
        console.log('✅ You are already authenticated!');
        
        // Fetch and display user info
        await this.displayUserInfo();
        
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const answer = await new Promise<string>(resolve => {
          readline.question('\nDo you want to re-authenticate? (y/N): ', resolve);
        });
        readline.close();
        
        if (answer.toLowerCase() !== 'y') {
          return;
        }
        
        // Logout first
        await this.authClient.logout();
      }

      // Start authentication flow
      console.log('📱 Starting authentication flow...');
      console.log('A browser window will open for you to authenticate.\n');
      
      const tokens = await this.authClient.authenticate();
      
      // Update config with login info
      this.config.lastLogin = new Date().toISOString();
      this.saveConfig();
      
      // Display success and user info
      console.log('\n✅ Authentication successful!');
      await this.displayUserInfo();
      
      console.log('\n🎉 You can now use MARIA CLI commands!');
      console.log('Try: maria /ask "How do I create a REST API?"');
      
    } catch (error: any) {
      console.error('\n❌ Authentication failed:', error.message);
      console.error('\nTroubleshooting tips:');
      console.error('1. Make sure the auth server is running');
      console.error('2. Check your internet connection');
      console.error('3. Try running "maria /logout" and then login again');
      process.exit(1);
    }
  }

  /**
   * Logout command handler
   */
  public async logout(): Promise<void> {
    console.log('🔓 Logging out from MARIA CLI...');
    
    try {
      await this.authClient.logout();
      
      // Clear saved user info from config
      delete this.config.lastLogin;
      delete this.config.userEmail;
      delete this.config.planName;
      this.saveConfig();
      
      console.log('✅ Logged out successfully!');
      console.log('Run "maria /login" to authenticate again.');
      
    } catch (error: any) {
      console.error('❌ Logout failed:', error.message);
    }
  }

  /**
   * Check authentication status
   */
  public async checkAuth(): Promise<boolean> {
    const isAuth = await this.authClient.isAuthenticated();
    
    if (!isAuth) {
      console.log('❌ Not authenticated');
      console.log('Run "maria /login" to authenticate');
      return false;
    }
    
    console.log('✅ Authenticated');
    await this.displayUserInfo();
    return true;
  }

  /**
   * Display user information
   */
  private async displayUserInfo(): Promise<void> {
    try {
      // Get usage info which includes plan details
      const usage = await this.apiClient.getUsage();
      
      console.log('\n👤 User Information:');
      console.log(`  📧 Email: ${this.config.userEmail || 'N/A'}`);
      console.log(`  💎 Plan: ${usage.planName} (${usage.planCode})`);
      console.log(`  📅 Period: ${usage.periodId}`);
      console.log(`  🕐 Last login: ${this.config.lastLogin ? new Date(this.config.lastLogin).toLocaleString() : 'N/A'}`);
      
      // Update config with latest info
      this.config.planName = usage.planName;
      this.saveConfig();
      
    } catch (error) {
      // Silently fail if can't get user info
      console.log('  ℹ️  User information unavailable');
    }
  }

  /**
   * Execute authenticated command
   */
  public async executeCommand(command: string, input: string, options?: any): Promise<void> {
    // Check authentication
    const isAuth = await this.authClient.isAuthenticated();
    if (!isAuth) {
      console.log('❌ Authentication required');
      console.log('Please run "maria /login" first');
      return;
    }

    try {
      console.log(`\n🔄 Executing ${command}...`);
      
      const response = await this.apiClient.executeCommand({
        command,
        input,
        metadata: options
      });
      
      if (response.success) {
        console.log('\n✅ Success!\n');
        console.log(response.output);
        
        if (response.metadata) {
          console.log('\n📊 Metadata:');
          console.log(`  Model: ${response.metadata.model}`);
          console.log(`  Tokens used: ${response.metadata.tokensUsed}`);
          console.log(`  Processing time: ${response.metadata.processingTimeMs}ms`);
        }
        
        if (response.quota) {
          console.log('\n📈 Quota remaining:');
          Object.entries(response.quota.remain).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
          });
        }
      } else {
        console.error('\n❌ Command failed:', response.error);
        if (response.hint) {
          console.log('💡 Hint:', response.hint);
        }
      }
      
    } catch (error: any) {
      console.error('\n❌ Error:', error.message);
      
      if (error.message.includes('Authentication')) {
        console.log('\n💡 Try running "maria /login" to re-authenticate');
      }
    }
  }

  /**
   * Get API client instance
   */
  public getAPIClient(): MariaAPIClient {
    return this.apiClient;
  }

  /**
   * Get OAuth client instance
   */
  public getAuthClient(): OAuth2PKCEClient {
    return this.authClient;
  }

  /**
   * Display usage statistics
   */
  public async showUsage(): Promise<void> {
    const isAuth = await this.authClient.isAuthenticated();
    if (!isAuth) {
      console.log('❌ Authentication required');
      console.log('Please run "maria /login" first');
      return;
    }

    await this.apiClient.displayUsageStats();
  }

  /**
   * Display system status
   */
  public async showStatus(): Promise<void> {
    await this.apiClient.displaySystemStatus();
  }

  /**
   * Configure CLI settings
   */
  public async configure(settings: Partial<CLIConfig>): Promise<void> {
    console.log('⚙️  Updating CLI configuration...');
    
    this.config = { ...this.config, ...settings };
    this.saveConfig();
    
    console.log('✅ Configuration updated!');
    console.log('\nCurrent settings:');
    console.log(`  API URL: ${this.config.apiBaseUrl}`);
    console.log(`  Auth URL: ${this.config.authServerUrl}`);
    console.log(`  Client ID: ${this.config.clientId}`);
    console.log(`  Scopes: ${this.config.scopes.join(', ')}`);
  }

  /**
   * Show current configuration
   */
  public showConfig(): void {
    console.log('⚙️  MARIA CLI Configuration');
    console.log('═══════════════════════════════════════');
    console.log(`📍 API URL: ${this.config.apiBaseUrl}`);
    console.log(`🔐 Auth URL: ${this.config.authServerUrl}`);
    console.log(`🆔 Client ID: ${this.config.clientId}`);
    console.log(`🔑 Scopes: ${this.config.scopes.join(', ')}`);
    console.log(`📁 Config path: ${this.configPath}`);
    console.log('═══════════════════════════════════════\n');
  }
}

// Export singleton instance
export const cliAuth = CLIAuthService.getInstance();