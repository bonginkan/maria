/**
 * Login Command Module
 * 認証系コマンド - ユーザーログイン処理
 *
 * Phase 4: Low-frequency commands implementation
 * Category: Authentication
 */

import { SlashCommandResult } from '../../services/slash-command-handler';
import { BaseCommand } from './base-command';
import { logger } from '../../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface UserCredentials {
  email?: string;
  password?: string;
  token?: string;
  provider?: 'google' | 'github' | 'email';
}

interface UserSession {
  isAuthenticated: boolean;
  userId?: string;
  email?: string;
  plan: 'free' | 'pro' | 'max';
  credits: number;
  loginTime?: Date;
  provider?: string;
  expiresAt?: Date;
}

export class LoginCommand extends BaseCommand {
  name = 'login';
  category = 'authentication' as const;
  description = 'Authenticate with MARIA platform';
  usage = '/login [provider] [credentials]';
  aliases = ['signin', 'auth'];

  private configPath = path.join(os.homedir(), '.maria', 'auth.json');
  private sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours

  async execute(args: string[]): Promise<SlashCommandResult> {
    try {
      // Parse authentication method
      const provider = this.parseProvider(args);

      if (!provider) {
        return this.showLoginOptions();
      }

      // Perform authentication based on provider
      const result = await this.authenticate(provider, args);

      if (result.success) {
        await this.saveSession(result.session!);
        return this.formatSuccessResponse(result.session!);
      }

      return this.formatErrorResponse(result.error || 'Authentication failed');
    } catch (error) {
      logger.error('Login command error:', error);
      return {
        success: false,
        message: `❌ Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private parseProvider(args: string[]): string | null {
    if (args.length === 0) {
      return null;
    }

    const provider = args[0].toLowerCase();
    const validProviders = ['google', 'github', 'email', 'token'];

    if (validProviders.includes(provider)) {
      return provider;
    }

    // Check if it's an email or token directly
    if (args[0].includes('@')) {
      return 'email';
    }

    if (args[0].startsWith('mk_') || args[0].startsWith('sk_')) {
      return 'token';
    }

    return null;
  }

  private showLoginOptions(): SlashCommandResult {
    return {
      success: true,
      message: `🔐 **Login to MARIA Platform**

Choose an authentication method:

**1. Google OAuth** (Recommended)
\`\`\`
/login google
\`\`\`

**2. GitHub OAuth**
\`\`\`
/login github
\`\`\`

**3. Email & Password**
\`\`\`
/login email your@email.com
\`\`\`

**4. API Token**
\`\`\`
/login token YOUR_API_TOKEN
\`\`\`

**Need an account?**
Visit: https://maria-code.bonginkan.ai/signup

**Benefits of logging in:**
• 🚀 Access to premium models (GPT-5, Claude Opus 4.1)
• 💾 Persistent memory across sessions
• 📊 Usage analytics and history
• 🎯 Priority support
• 🔄 Sync settings across devices`,
      component: 'auth-flow',
    };
  }

  private async authenticate(
    provider: string,
    args: string[],
  ): Promise<{ success: boolean; session?: UserSession; error?: string }> {
    switch (provider) {
      case 'google':
        return this.authenticateOAuth('google');

      case 'github':
        return this.authenticateOAuth('github');

      case 'email':
        return this.authenticateEmail(args.slice(1));

      case 'token':
        return this.authenticateToken(args.slice(1));

      default:
        return {
          success: false,
          error: `Unknown authentication provider: ${provider}`,
        };
    }
  }

  private async authenticateOAuth(
    provider: 'google' | 'github',
  ): Promise<{ success: boolean; session?: UserSession; error?: string }> {
    // In a real implementation, this would open a browser for OAuth flow
    // For now, we'll simulate the process

    const authUrl = `https://maria-code.bonginkan.ai/auth/${provider}`;

    return {
      success: false,
      error: `🌐 Please visit the following URL to authenticate:\n${authUrl}\n\nThen run: /login token YOUR_AUTH_TOKEN`,
    };
  }

  private async authenticateEmail(
    args: string[],
  ): Promise<{ success: boolean; session?: UserSession; error?: string }> {
    if (args.length === 0) {
      return {
        success: false,
        error: 'Please provide your email address',
      };
    }

    const email = args[0];

    // Validate email format
    if (!this.isValidEmail(email)) {
      return {
        success: false,
        error: 'Invalid email format',
      };
    }

    // In a real implementation, this would prompt for password securely
    // and make an API call to authenticate

    return {
      success: false,
      error: `📧 Password authentication required.\nPlease use: /login token YOUR_API_TOKEN\n\nGet your token at: https://maria-code.bonginkan.ai/settings/api`,
    };
  }

  private async authenticateToken(
    args: string[],
  ): Promise<{ success: boolean; session?: UserSession; error?: string }> {
    if (args.length === 0) {
      return {
        success: false,
        error: 'Please provide your API token',
      };
    }

    const token = args[0];

    // Validate token format
    if (!this.isValidToken(token)) {
      return {
        success: false,
        error: 'Invalid token format. Tokens should start with mk_ or sk_',
      };
    }

    // Simulate API call to validate token
    // In production, this would make an actual API request
    const mockSession: UserSession = {
      isAuthenticated: true,
      userId: 'user_' + Math.random().toString(36).substr(2, 9),
      email: 'user@example.com',
      plan: token.startsWith('sk_') ? 'pro' : 'free',
      credits: token.startsWith('sk_') ? 10000 : 100,
      loginTime: new Date(),
      provider: 'token',
      expiresAt: new Date(Date.now() + this.sessionTimeout),
    };

    return {
      success: true,
      session: mockSession,
    };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidToken(token: string): boolean {
    return token.startsWith('mk_') || token.startsWith('sk_');
  }

  private async saveSession(session: UserSession): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Save session to file
      fs.writeFileSync(this.configPath, JSON.stringify(session, null, 2), 'utf-8');

      logger.info('Session saved successfully');
    } catch (error) {
      logger.error('Failed to save session:', error);
    }
  }

  private formatSuccessResponse(session: UserSession): SlashCommandResult {
    const planEmoji = {
      free: '🆓',
      pro: '⭐',
      max: '🚀',
    };

    return {
      success: true,
      message: `✅ **Successfully logged in!**

**Account Details:**
• User ID: \`${session.userId}\`
• Email: ${session.email || 'N/A'}
• Plan: ${planEmoji[session.plan]} ${session.plan.toUpperCase()}
• Credits: ${session.credits.toLocaleString()}
• Provider: ${session.provider}
• Session expires: ${session.expiresAt?.toLocaleString()}

**Available Features:**
${this.getPlanFeatures(session.plan)}

**Next Steps:**
• Run \`/status\` to see your account details
• Run \`/model\` to select an AI model
• Run \`/help\` to see all available commands`,
      data: session,
    };
  }

  private getPlanFeatures(plan: string): string {
    const features = {
      free: `• Access to basic models (GPT-4, Claude Sonnet)
• 100 requests per day
• Standard support`,
      pro: `• Access to all models including GPT-5 and Claude Opus 4.1
• 10,000 requests per day
• Priority support
• Advanced features (batch processing, templates)
• API access`,
      max: `• Unlimited access to all models
• No request limits
• Dedicated support
• Custom model fine-tuning
• Enterprise features
• SLA guarantee`,
    };

    return features[plan as keyof typeof features] || features.free;
  }

  private formatErrorResponse(error: string): SlashCommandResult {
    return {
      success: false,
      message: `❌ **Login Failed**

${error}

**Need help?**
• Check our docs: https://maria-code.bonginkan.ai/docs/authentication
• Contact support: support@bonginkan.ai`,
    };
  }
}
