/**
 * CLI Authentication Types
 * Centralized type definitions for the authentication system
 */

export interface AuthTokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  customToken?: string;
  sessionId?: string;
  expiresAt: number;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  plan: 'FREE' | 'STARTER' | 'PRO' | 'ULTRA' | 'ENTERPRISE';
  usage: UsageStats;
  models: string[];
}

export interface UsageStats {
  requests: number;
  requestLimit: number;
  tokens: number;
  tokenLimit: number;
  resetDate: string;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  tokens?: AuthTokens;
  error?: string;
}

export interface PKCEParams {
  codeVerifier: string;
  codeChallenge: string;
  state: string;
}

export interface DeviceFlowResponse {
  verificationUri: string;
  userCode: string;
  deviceCode: string;
  interval: number;
  expiresIn: number;
}

export interface LoginOptions {
  device?: boolean;
  force?: boolean;
}

export interface LogoutOptions {
  all?: boolean;
  force?: boolean;
}

export class AuthenticationRequiredError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationRequiredError';
  }
}

export class QuotaExceededError extends Error {
  constructor(message: string = 'Quota exceeded') {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

export class PlanRestrictedError extends Error {
  constructor(message: string = 'Feature not available in current plan') {
    super(message);
    this.name = 'PlanRestrictedError';
  }
}

export const ERROR_MESSAGES = {
  AUTH_REQUIRED: '🔐 Authentication required · Run: /login',
  QUOTA_EXCEEDED: '⚠ Quota exceeded · Upgrade coming soon',
  PLAN_RESTRICTED: '🔒 Not available in Free plan · Join Waitlist → https://maria.dev/waitlist',
  NETWORK_ERROR: '🌐 Network error, check connection',
  TOKEN_EXPIRED: '🔄 Please re-authenticate · Run: /login',
  LOGIN_TIMEOUT: '⏳ Login timeout · Please try again',
  INVALID_STATE: '❌ Security error · Please try again',
  BROWSER_FAILED: '⚠ Browser launch failed · Use /login --device',
  REFRESH_FAILED: '🔄 Token refresh failed · Run: /login',
  LOGOUT_FAILED: '❌ Logout failed · Use /logout --force'
} as const;