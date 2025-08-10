/**
 * Local Authentication Service - OSS-ready replacement for Firebase Auth
 * Simple, secure local authentication without external dependencies
 */

import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { LocalStorageService } from './local-storage.service';

export interface User {
  id: string;
  email: string;
  username: string;
  displayName?: string;
  role: 'admin' | 'user' | 'viewer';
  createdAt: string;
  lastLogin?: string;
  settings?: Record<string, any>;
}

export interface Session {
  userId: string;
  token: string;
  refreshToken: string;
  expiresAt: string;
  createdAt: string;
}

export interface AuthConfig {
  jwtSecret?: string;
  tokenExpiry?: string; // e.g., '24h', '7d'
  refreshTokenExpiry?: string;
  sessionPath?: string;
}

export class LocalAuthService {
  private static instance: LocalAuthService;
  private currentUser: User | null = null;
  private currentSession: Session | null = null;
  private storage: LocalStorageService;
  private jwtSecret: string;
  private tokenExpiry: string;
  private refreshTokenExpiry: string;

  private constructor(config?: AuthConfig) {
    this.storage = LocalStorageService.getInstance();
    this.jwtSecret = config?.jwtSecret || this.generateSecret();
    this.tokenExpiry = config?.tokenExpiry || '24h';
    this.refreshTokenExpiry = config?.refreshTokenExpiry || '30d';
  }

  static getInstance(config?: AuthConfig): LocalAuthService {
    if (!LocalAuthService.instance) {
      LocalAuthService.instance = new LocalAuthService(config);
    }
    return LocalAuthService.instance;
  }

  private generateSecret(): string {
    // Generate a random secret for JWT if not provided
    return crypto.randomBytes(32).toString('hex');
  }

  private hashPassword(password: string, salt: string): string {
    return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  }

  private generateSalt(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private generateToken(userId: string, type: 'access' | 'refresh' = 'access'): string {
    const expiry = type === 'access' ? this.tokenExpiry : this.refreshTokenExpiry;
    return jwt.sign(
      { userId, type, timestamp: Date.now() },
      this.jwtSecret,
      { expiresIn: expiry }
    );
  }

  private verifyToken(token: string): { userId: string; type: string } | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      return { userId: decoded.userId, type: decoded.type };
    } catch {
      return null;
    }
  }

  // User Management
  async createUser(email: string, password: string, username?: string): Promise<User> {
    // Check if user already exists
    const existingUsers = await this.storage.query({ type: 'config' });
    const userConfigs = existingUsers.filter(item => 
      item.content.type === 'user' && item.content.email === email
    );

    if (userConfigs.length > 0) {
      throw new Error('User already exists');
    }

    const salt = this.generateSalt();
    const hashedPassword = this.hashPassword(password, salt);
    
    const user: User = {
      id: crypto.randomBytes(16).toString('hex'),
      email,
      username: username || email.split('@')[0],
      displayName: username || email.split('@')[0],
      role: 'user',
      createdAt: new Date().toISOString()
    };

    // Store user data
    await this.storage.create('config', {
      type: 'user',
      email,
      userId: user.id,
      username: user.username,
      role: user.role,
      hashedPassword,
      salt,
      user
    });

    return user;
  }

  async login(email: string, password: string): Promise<{ user: User; session: Session }> {
    // Find user
    const users = await this.storage.query({ type: 'config' });
    const userConfig = users.find(item => 
      item.content.type === 'user' && item.content.email === email
    );

    if (!userConfig) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const hashedPassword = this.hashPassword(password, userConfig.content.salt);
    if (hashedPassword !== userConfig.content.hashedPassword) {
      throw new Error('Invalid credentials');
    }

    const user = userConfig.content.user as User;
    user.lastLogin = new Date().toISOString();

    // Create session
    const session: Session = {
      userId: user.id,
      token: this.generateToken(user.id),
      refreshToken: this.generateToken(user.id, 'refresh'),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString()
    };

    // Store session
    await this.storage.create('config', {
      type: 'session',
      userId: user.id,
      session
    });

    // Update user last login
    await this.storage.update(userConfig.id, {
      ...userConfig.content,
      user
    });

    this.currentUser = user;
    this.currentSession = session;

    return { user, session };
  }

  async logout(): Promise<void> {
    if (this.currentSession) {
      // Find and delete session
      const sessions = await this.storage.query({ type: 'config' });
      const sessionConfig = sessions.find(item =>
        item.content.type === 'session' && 
        item.content.session.token === this.currentSession!.token
      );

      if (sessionConfig) {
        await this.storage.delete(sessionConfig.id);
      }
    }

    this.currentUser = null;
    this.currentSession = null;
  }

  async validateSession(token: string): Promise<User | null> {
    const decoded = this.verifyToken(token);
    if (!decoded || decoded.type !== 'access') {
      return null;
    }

    // Find user
    const users = await this.storage.query({ type: 'config' });
    const userConfig = users.find(item =>
      item.content.type === 'user' && 
      item.content.userId === decoded.userId
    );

    if (!userConfig) {
      return null;
    }

    this.currentUser = userConfig.content.user as User;
    return this.currentUser;
  }

  async refreshSession(refreshToken: string): Promise<Session | null> {
    const decoded = this.verifyToken(refreshToken);
    if (!decoded || decoded.type !== 'refresh') {
      return null;
    }

    // Create new session
    const newSession: Session = {
      userId: decoded.userId,
      token: this.generateToken(decoded.userId),
      refreshToken: this.generateToken(decoded.userId, 'refresh'),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString()
    };

    // Store new session
    await this.storage.create('config', {
      type: 'session',
      userId: decoded.userId,
      session: newSession
    });

    this.currentSession = newSession;
    return newSession;
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  getCurrentSession(): Session | null {
    return this.currentSession;
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User | null> {
    const users = await this.storage.query({ type: 'config' });
    const userConfig = users.find(item =>
      item.content.type === 'user' && 
      item.content.userId === userId
    );

    if (!userConfig) {
      return null;
    }

    const updatedUser = {
      ...userConfig.content.user,
      ...updates,
      id: userId // Ensure ID doesn't change
    };

    await this.storage.update(userConfig.id, {
      ...userConfig.content,
      user: updatedUser
    });

    if (this.currentUser?.id === userId) {
      this.currentUser = updatedUser as User;
    }

    return updatedUser as User;
  }

  async deleteUser(userId: string): Promise<boolean> {
    const items = await this.storage.query({ type: 'config' });
    
    // Delete user config
    const userConfig = items.find(item =>
      item.content.type === 'user' && 
      item.content.userId === userId
    );

    if (!userConfig) {
      return false;
    }

    // Delete all user sessions
    const sessions = items.filter(item =>
      item.content.type === 'session' && 
      item.content.userId === userId
    );

    for (const session of sessions) {
      await this.storage.delete(session.id);
    }

    // Delete user
    await this.storage.delete(userConfig.id);

    if (this.currentUser?.id === userId) {
      this.currentUser = null;
      this.currentSession = null;
    }

    return true;
  }

  // Simple OAuth-like flow for local development
  async createGuestSession(): Promise<{ user: User; session: Session }> {
    const guestUser: User = {
      id: `guest_${crypto.randomBytes(8).toString('hex')}`,
      email: 'guest@local',
      username: 'guest',
      displayName: 'Guest User',
      role: 'viewer',
      createdAt: new Date().toISOString()
    };

    const session: Session = {
      userId: guestUser.id,
      token: this.generateToken(guestUser.id),
      refreshToken: this.generateToken(guestUser.id, 'refresh'),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString()
    };

    this.currentUser = guestUser;
    this.currentSession = session;

    return { user: guestUser, session };
  }

  // Permission helpers
  hasPermission(permission: string): boolean {
    if (!this.currentUser) return false;

    const permissions: Record<string, string[]> = {
      admin: ['read', 'write', 'delete', 'admin'],
      user: ['read', 'write'],
      viewer: ['read']
    };

    return permissions[this.currentUser.role]?.includes(permission) || false;
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null && this.currentSession !== null;
  }

  isAdmin(): boolean {
    return this.currentUser?.role === 'admin';
  }
}

export const localAuth = LocalAuthService.getInstance();