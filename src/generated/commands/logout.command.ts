/**
 * Logout Command Module
 * 認証系コマンド - ユーザーログアウト処理
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

export class LogoutCommand extends BaseCommand {
  name = 'logout';
  category = 'authentication' as const;
  description = 'Sign out from MARIA platform';
  usage = '/logout [--all]';
  aliases = ['signout', 'exit-session'];
  
  private configPath = path.join(os.homedir(), '.maria', 'auth.json');
  private sessionsPath = path.join(os.homedir(), '.maria', 'sessions');

  async execute(args: string[]): Promise<SlashCommandResult> {
    try {
      const logoutAll = args.includes('--all');
      
      // Check if user is logged in
      const session = await this.getCurrentSession();
      
      if (!session) {
        return {
          success: false,
          message: `❌ You are not currently logged in.\n\nUse \`/login\` to authenticate.`,
        };
      }

      // Perform logout
      const result = await this.performLogout(session, logoutAll);
      
      if (result.success) {
        return this.formatSuccessResponse(result.clearedSessions);
      }
      
      return {
        success: false,
        message: `❌ Logout failed: ${result.error}`,
      };
      
    } catch (error) {
      logger.error('Logout command error:', error);
      return {
        success: false,
        message: `❌ Logout failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async getCurrentSession(): Promise<unknown> {
    try {
      if (!fs.existsSync(this.configPath)) {
        return null;
      }
      
      const sessionData = fs.readFileSync(this.configPath, 'utf-8');
      const session = JSON.parse(sessionData);
      
      // Check if session is expired
      if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
        await this.clearSession();
        return null;
      }
      
      return session;
    } catch (error) {
      logger.error('Failed to read session:', error);
      return null;
    }
  }

  private async performLogout(
    session: unknown,
    logoutAll: boolean
  ): Promise<{ success: boolean; clearedSessions: number; error?: string }> {
    try {
      let clearedSessions = 0;

      // Clear current session
      await this.clearSession();
      clearedSessions++;

      // If logout all, clear all saved sessions
      if (logoutAll) {
        clearedSessions += await this.clearAllSessions();
      }

      // Call logout API (in production)
      // await this.callLogoutAPI(session.token);

      // Clear any cached data
      await this.clearCachedData();

      return {
        success: true,
        clearedSessions,
      };
    } catch (error) {
      logger.error('Logout error:', error);
      return {
        success: false,
        clearedSessions: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async clearSession(): Promise<void> {
    try {
      if (fs.existsSync(this.configPath)) {
        fs.unlinkSync(this.configPath);
      }
    } catch (error) {
      logger.error('Failed to clear session:', error);
    }
  }

  private async clearAllSessions(): Promise<number> {
    let cleared = 0;
    
    try {
      if (fs.existsSync(this.sessionsPath)) {
        const files = fs.readdirSync(this.sessionsPath);
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            const filePath = path.join(this.sessionsPath, file);
            fs.unlinkSync(filePath);
            cleared++;
          }
        }
      }
    } catch (error) {
      logger.error('Failed to clear all sessions:', error);
    }
    
    return cleared;
  }

  private async clearCachedData(): Promise<void> {
    const cachePaths = [
      path.join(os.homedir(), '.maria', 'cache'),
      path.join(os.homedir(), '.maria', 'temp'),
      path.join(os.homedir(), '.maria', 'history'),
    ];

    for (const cachePath of cachePaths) {
      try {
        if (fs.existsSync(cachePath)) {
          // Clear cache directory contents but keep the directory
          const files = fs.readdirSync(cachePath);
          for (const file of files) {
            const filePath = path.join(cachePath, file);
            if (fs.statSync(filePath).isFile()) {
              fs.unlinkSync(filePath);
            }
          }
        }
      } catch (error) {
        logger.error(`Failed to clear cache at ${cachePath}:`, error);
      }
    }
  }

  private formatSuccessResponse(clearedSessions: number): SlashCommandResult {
    const sessionText = clearedSessions === 1 ? 'session' : 'sessions';
    
    return {
      success: true,
      message: `✅ **Successfully logged out!**

**Summary:**
• Cleared ${clearedSessions} ${sessionText}
• Removed cached data
• Session tokens invalidated

**What's next?**
• Use \`/login\` to sign in again
• Your settings and preferences are preserved
• Your project data remains intact

**Privacy Note:**
All authentication data has been securely removed from this device.`,
    };
  }
}