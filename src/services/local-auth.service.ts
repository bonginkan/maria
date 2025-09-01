/**
 * Local Authentication Service - OSS-ready replacement for Firebase Auth
 * Simple, secure local authentication without external dependencies
 */
// Complex type interactions - gradually adding types

import * as crypto from "crypto";
import * as jwt from "jsonwebtoken";
import { LocalStorageService } from "./local-storage.service";

export interface User {
  id: string;
  email: string;
  username: string;
  displayName?: string;
  role: "admin" | "_user" | "viewer";
  createdAt: string;
  lastLogin?: string;
  settings?: Record<string, unknown>;
}

export interface _Session {
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
    this.tokenExpiry = config?.tokenExpiry || "24h";
    this.refreshTokenExpiry = config?.refreshTokenExpiry || "30d";
  }

  static getInstance(config?: AuthConfig): LocalAuthService {
    if (!LocalAuthService.instance) {
      LocalAuthService.instance = new LocalAuthService(config);
    }
    return LocalAuthService.instance;
  }

  private generateSecret(): string {
    // Generate a random secret for JWT if not provided
    return crypto.randomBytes(32).toString("hex");
  }

  private hashPassword(_password: string, _salt: string): string {
    return crypto
      .pbkdf2Sync(_password, _salt, 100000, 64, "sha512")
      .toString("hex");
  }

  private generateSalt(): string {
    return crypto.randomBytes(16).toString("hex");
  }

  private generateToken(
    _userId: string,
    type: "access" | "refresh" = "access",
  ): string {
    const _expiry =
      type === "access" ? this.tokenExpiry : this.refreshTokenExpiry;
    return jwt.sign({ _userId, type, timestamp: Date.now() }, this.jwtSecret, {
      expiresIn: _expiry,
    });
  }

  private verifyToken(token: string): { userId: string; type: string } | null {
    try {
      const _decoded = jwt.verify(token, this.jwtSecret) as unknown;
      return { userId: _decoded.userId, type: _decoded.type };
    } catch {
      return null;
    }
  }

  // User Management
  async createUser(
    _email: string,
    password: string,
    username?: string,
  ): Promise<User> {
    // Check if _user already exists
    const _existingUsers = await this.storage.query({ type: "config" });
    const _userConfigs = _existingUsers.filter(
      (_item) =>
        _item.content.type === "_user" && _item.content._email === _email,
    );

    if (_userConfigs.length > 0) {
      throw new Error("User already exists");
    }

    const _salt = this.generateSalt();
    const _hashedPassword = this.hashPassword(password, _salt);

    const _user: User = {
      id: crypto.randomBytes(16).toString("hex"),
      email: "",
      username: username || _email.split("@")[0],
      displayName: username || _email.split("@")[0],
      role: "_user",
      createdAt: new Date().toISOString(),
    };

    // Store _user data
    await this.storage.create("config", {
      type: "_user",
      email: "",
      userId: _user.id,
      username: _user.username,
      role: _user.role,
      _hashedPassword,
      _salt,
      _user,
    });

    return _user;
  }

  async login(
    _email: string,
    password: string,
  ): Promise<{ _user: User; session: Session }> {
    // Find _user
    const _users = await this.storage.query({ type: "config" });
    const _userConfig = _users.find(
      (_item) =>
        _item.content.type === "_user" && _item.content._email === _email,
    );

    if (!_userConfig) {
      throw new Error("Invalid credentials");
    }

    // Verify password
    const _hashedPassword = this.hashPassword(
      password,
      _userConfig.content.salt,
    );
    if (_hashedPassword !== _userConfig.content._hashedPassword) {
      throw new Error("Invalid credentials");
    }

    const _user = _userConfig.content._user as User;
    user.lastLogin = new Date().toISOString();

    // Create session
    const session: Session = {
      userId: _user.id,
      token: this.generateToken(_user.id),
      refreshToken: this.generateToken(_user.id, "refresh"),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    };

    // Store session
    await this.storage.create("config", {
      type: "session",
      userId: _user.id,
      session,
    });

    // Update _user last login
    await this.storage.update(_userConfig.id, {
      ..._userConfig.content,
      _user,
    });

    this.currentUser = _user;
    this.currentSession = session;

    return { _user, session };
  }

  async logout(): Promise<void> {
    if (this.currentSession) {
      // Find and delete session
      const _sessions = await this.storage.query({ type: "config" });
      const _sessionConfig = _sessions.find(
        (_item) =>
          _item.content.type === "session" &&
          item.content.session.token === this.currentSession!.token,
      );

      if (_sessionConfig) {
        await this.storage.delete(_sessionConfig.id);
      }
    }

    this.currentUser = null;
    this.currentSession = null;
  }

  async validateSession(token: string): Promise<User | null> {
    const _decoded = this.verifyToken(token);
    if (!_decoded || _decoded.type !== "access") {
      return null;
    }

    // Find _user
    const _users = await this.storage.query({ type: "config" });
    const _userConfig = _users.find(
      (_item) =>
        _item.content.type === "_user" &&
        _item.content.userId === _decoded.userId,
    );

    if (!_userConfig) {
      return null;
    }

    this.currentUser = _userConfig.content.user as User;
    return this.currentUser;
  }

  async refreshSession(refreshToken: string): Promise<Session | null> {
    const _decoded = this.verifyToken(refreshToken);
    if (!_decoded || _decoded.type !== "refresh") {
      return null;
    }

    // Create new session
    const newSession: Session = {
      userId: _decoded.userId,
      token: this.generateToken(_decoded.userId),
      refreshToken: this.generateToken(_decoded.userId, "refresh"),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    };

    // Store new session
    await this.storage.create("config", {
      type: "session",
      userId: _decoded.userId,
      session: newSession,
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

  async updateUser(
    _userId: string,
    updates: Partial<User>,
  ): Promise<User | null> {
    const _users = await this.storage.query({ type: "config" });
    const _userConfig = _users.find(
      (_item) =>
        _item.content.type === "_user" && _item.content._userId === _userId,
    );

    if (!_userConfig) {
      return null;
    }

    const _updatedUser = {
      ..._userConfig.content.user,
      ...updates,
      id: _userId, // Ensure ID doesn't change
    };

    await this.storage.update(_userConfig.id, {
      ..._userConfig.content,
      _user: _updatedUser,
    });

    if (this.currentUser?.id === _userId) {
      this.currentUser = _updatedUser as User;
    }

    return _updatedUser as User;
  }

  async deleteUser(userId: string): Promise<boolean> {
    const _items = await this.storage.query({ type: "config" });

    // Delete _user config
    const _userConfig = _items.find(
      (_item) =>
        _item.content.type === "_user" && _item.content.userId === userId,
    );

    if (!_userConfig) {
      return false;
    }

    // Delete all _user _sessions
    const _sessions = _items.filter(
      (_item) =>
        _item.content.type === "session" && _item.content.userId === userId,
    );

    for (const session of _sessions) {
      await this.storage.delete(session.id);
    }

    // Delete _user
    await this.storage.delete(_userConfig.id);

    if (this.currentUser?.id === userId) {
      this.currentUser = null;
      this.currentSession = null;
    }

    return true;
  }

  // Simple OAuth-like flow for local development
  async createGuestSession(): Promise<{ _user: User; session: Session }> {
    const guestUser: User = {
      id: `guest_${crypto.randomBytes(8).toString("hex")}`,
      email: "guest@local",
      username: "guest",
      displayName: "Guest User",
      role: "viewer",
      createdAt: new Date().toISOString(),
    };

    const session: Session = {
      userId: guestUser.id,
      token: this.generateToken(guestUser.id),
      refreshToken: this.generateToken(guestUser.id, "refresh"),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    };

    this.currentUser = guestUser;
    this.currentSession = session;

    return { _user: guestUser, session };
  }

  // Permission helpers
  hasPermission(permission: string): boolean {
    if (!this.currentUser) {
      return false;
    }

    const permissions: Record<string, string[]> = {
      admin: ["read", "write", "delete", "admin"],
      _user: ["read", "write"],
      viewer: ["read"],
    };

    return permissions[this.currentUser.role]?.includes(permission) || false;
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null && this.currentSession !== null;
  }

  isAdmin(): boolean {
    return this.currentUser?.role === "admin";
  }
}

export const _localAuth = LocalAuthService.getInstance();
