/**
 * ElevationManager - Manages temporary privilege elevation with TTL
 * Provides time-limited access tokens for elevated operations
 */

import { v4 as uuid } from 'uuid';

export interface ElevationToken {
  token: string;
  expiresAt: string;
  approvedBy: string;
  operationId: string;
  planId: string;
  createdAt: string;
  revokedAt?: string;
  revocationReason?: string;
}

export interface TokenValidation {
  valid: boolean;
  reason?: string;
  remainingTTL?: number;
}

export class ElevationManager {
  private activeTokens: Map<string, ElevationToken> = new Map();
  private revokedTokens: Set<string> = new Set();
  private tokenExpiryTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Create a new elevation token
   */
  async createToken(
    approvedBy: string,
    ttlSeconds: number = 600,
    operationId?: string,
    planId?: string
  ): Promise<ElevationToken> {
    const token = uuid();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    const elevationToken: ElevationToken = {
      token,
      expiresAt: expiresAt.toISOString(),
      approvedBy,
      operationId: operationId || uuid(),
      planId: planId || uuid(),
      createdAt: now.toISOString()
    };

    // Store token
    this.activeTokens.set(token, elevationToken);

    // Set expiry timer
    const timer = setTimeout(() => {
      this.expireToken(token);
    }, ttlSeconds * 1000);
    this.tokenExpiryTimers.set(token, timer);

    return elevationToken;
  }

  /**
   * Validate a token
   */
  async validateToken(token: string): Promise<TokenValidation> {
    // Check if revoked
    if (this.revokedTokens.has(token)) {
      return {
        valid: false,
        reason: 'Token has been revoked'
      };
    }

    // Check if exists
    const elevationToken = this.activeTokens.get(token);
    if (!elevationToken) {
      return {
        valid: false,
        reason: 'Token does not exist or has expired'
      };
    }

    // Check expiry
    const now = new Date();
    const expiresAt = new Date(elevationToken.expiresAt);
    if (now >= expiresAt) {
      this.expireToken(token);
      return {
        valid: false,
        reason: 'Token has expired'
      };
    }

    // Calculate remaining TTL
    const remainingTTL = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);

    return {
      valid: true,
      remainingTTL
    };
  }

  /**
   * Revoke a token
   */
  async revokeToken(token: string, reason: string = 'Manual revocation'): Promise<void> {
    const elevationToken = this.activeTokens.get(token);
    if (elevationToken) {
      elevationToken.revokedAt = new Date().toISOString();
      elevationToken.revocationReason = reason;
    }

    // Add to revoked set
    this.revokedTokens.add(token);

    // Remove from active tokens
    this.activeTokens.delete(token);

    // Clear expiry timer
    const timer = this.tokenExpiryTimers.get(token);
    if (timer) {
      clearTimeout(timer);
      this.tokenExpiryTimers.delete(token);
    }
  }

  /**
   * Revoke all tokens for an operation
   */
  async revokeOperationTokens(operationId: string, reason: string = 'Operation completed'): Promise<number> {
    let revokedCount = 0;

    for (const [token, elevationToken] of this.activeTokens.entries()) {
      if (elevationToken.operationId === operationId) {
        await this.revokeToken(token, reason);
        revokedCount++;
      }
    }

    return revokedCount;
  }

  /**
   * Extend token TTL
   */
  async extendToken(token: string, additionalSeconds: number): Promise<ElevationToken | null> {
    const validation = await this.validateToken(token);
    if (!validation.valid) {
      return null;
    }

    const elevationToken = this.activeTokens.get(token);
    if (!elevationToken) {
      return null;
    }

    // Clear old timer
    const oldTimer = this.tokenExpiryTimers.get(token);
    if (oldTimer) {
      clearTimeout(oldTimer);
    }

    // Update expiry
    const currentExpiry = new Date(elevationToken.expiresAt);
    const newExpiry = new Date(currentExpiry.getTime() + additionalSeconds * 1000);
    elevationToken.expiresAt = newExpiry.toISOString();

    // Set new timer
    const remainingTime = newExpiry.getTime() - Date.now();
    const timer = setTimeout(() => {
      this.expireToken(token);
    }, remainingTime);
    this.tokenExpiryTimers.set(token, timer);

    return elevationToken;
  }

  /**
   * Get token information
   */
  async getTokenInfo(token: string): Promise<ElevationToken | null> {
    return this.activeTokens.get(token) || null;
  }

  /**
   * Get all active tokens
   */
  async getActiveTokens(): Promise<ElevationToken[]> {
    return Array.from(this.activeTokens.values());
  }

  /**
   * Get token statistics
   */
  async getStatistics(): Promise<{
    activeTokens: number;
    revokedTokens: number;
    averageTTL: number;
    oldestToken: ElevationToken | null;
  }> {
    const activeTokensList = Array.from(this.activeTokens.values());
    
    let totalTTL = 0;
    let oldestToken: ElevationToken | null = null;
    
    for (const token of activeTokensList) {
      const createdAt = new Date(token.createdAt);
      const expiresAt = new Date(token.expiresAt);
      const ttl = (expiresAt.getTime() - createdAt.getTime()) / 1000;
      totalTTL += ttl;

      if (!oldestToken || createdAt < new Date(oldestToken.createdAt)) {
        oldestToken = token;
      }
    }

    return {
      activeTokens: this.activeTokens.size,
      revokedTokens: this.revokedTokens.size,
      averageTTL: activeTokensList.length > 0 ? totalTTL / activeTokensList.length : 0,
      oldestToken
    };
  }

  /**
   * Clean up expired tokens
   */
  async cleanup(): Promise<number> {
    let cleanedCount = 0;
    const now = new Date();

    for (const [token, elevationToken] of this.activeTokens.entries()) {
      const expiresAt = new Date(elevationToken.expiresAt);
      if (now >= expiresAt) {
        this.expireToken(token);
        cleanedCount++;
      }
    }

    // Also clean up old revoked tokens (keep last 1000)
    if (this.revokedTokens.size > 1000) {
      const toRemove = this.revokedTokens.size - 1000;
      const iterator = this.revokedTokens.values();
      for (let i = 0; i < toRemove; i++) {
        const token = iterator.next().value;
        if (token) {
          this.revokedTokens.delete(token);
        }
      }
    }

    return cleanedCount;
  }

  /**
   * Expire a token
   */
  private expireToken(token: string): void {
    // Remove from active tokens
    this.activeTokens.delete(token);

    // Clear timer
    const timer = this.tokenExpiryTimers.get(token);
    if (timer) {
      clearTimeout(timer);
      this.tokenExpiryTimers.delete(token);
    }

    // Add to revoked set (to prevent reuse)
    this.revokedTokens.add(token);
  }

  /**
   * Clear all tokens (emergency use)
   */
  async clearAllTokens(reason: string = 'Emergency clearance'): Promise<number> {
    const count = this.activeTokens.size;

    for (const token of this.activeTokens.keys()) {
      await this.revokeToken(token, reason);
    }

    return count;
  }
}