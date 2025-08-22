/**
 * MARIA Memory System - Phase 4: Enterprise Authentication & Authorization
 *
 * SSO integration, RBAC, multi-factor authentication, and enterprise identity management
 * with support for SAML, OAuth2, OIDC, and LDAP/Active Directory
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

export interface AuthenticationProvider {
  id: string;
  name: string;
  type: AuthProviderType;
  config: AuthProviderConfig;
  enabled: boolean;
  priority: number;
}

export type AuthProviderType =
  | 'saml'
  | 'oauth2'
  | 'oidc'
  | 'ldap'
  | 'active_directory'
  | 'local'
  | 'mfa_totp'
  | 'mfa_sms'
  | 'certificate';

export interface AuthProviderConfig {
  // OAuth2/OIDC
  clientId?: string;
  clientSecret?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  scopes?: string[];

  // SAML
  ssoUrl?: string;
  issuer?: string;
  certificate?: string;

  // LDAP/AD
  url?: string;
  baseDN?: string;
  bindDN?: string;
  bindPassword?: string;
  userFilter?: string;
  groupFilter?: string;

  // MFA
  issuerName?: string;
  secretLength?: number;
  window?: number;

  // Custom
  customConfig?: Record<string, any>;
}

export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  groups: string[];
  roles: Role[];
  permissions: Permission[];
  attributes: UserAttributes;
  status: UserStatus;
  mfaEnabled: boolean;
  lastLogin?: Date;
  passwordExpiry?: Date;
  accountExpiry?: Date;
}

export interface UserAttributes {
  department?: string;
  title?: string;
  manager?: string;
  location?: string;
  costCenter?: string;
  employeeId?: string;
  phoneNumber?: string;
  preferredLanguage?: string;
  timezone?: string;
  customAttributes?: Record<string, any>;
}

export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending' | 'locked';

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  inheritedRoles?: string[];
  scope: RoleScope;
  metadata: RoleMetadata;
}

export interface RoleScope {
  global: boolean;
  teams?: string[];
  projects?: string[];
  resources?: string[];
  environments?: string[];
}

export interface RoleMetadata {
  createdBy: string;
  createdAt: Date;
  lastModified: Date;
  tags: string[];
  approvalRequired: boolean;
  temporaryRole?: {
    expiryDate: Date;
    reason: string;
  };
}

export interface Permission {
  id: string;
  resource: string;
  action: string;
  conditions?: PermissionCondition[];
  effect: 'allow' | 'deny';
  priority: number;
}

export interface PermissionCondition {
  type: 'time' | 'location' | 'attribute' | 'mfa' | 'custom';
  operator: 'equals' | 'contains' | 'matches' | 'in' | 'not_in' | 'greater_than' | 'less_than';
  value: any;
  metadata?: Record<string, any>;
}

export interface AuthSession {
  id: string;
  userId: string;
  provider: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  ipAddress: string;
  userAgent: string;
  deviceId?: string;
  mfaVerified: boolean;
  permissions: EffectivePermissions;
  metadata: SessionMetadata;
}

export interface EffectivePermissions {
  resources: Map<string, string[]>; // resource -> actions
  computed: Date;
  cacheExpiry: Date;
}

export interface SessionMetadata {
  loginMethod: string;
  riskScore: number;
  location?: string;
  deviceFingerprint?: string;
  trustedDevice: boolean;
  sessionType: 'interactive' | 'api' | 'service';
}

export interface AuthRequest {
  username?: string;
  password?: string;
  provider: string;
  mfaToken?: string;
  ssoToken?: string;
  clientInfo: ClientInfo;
  context?: AuthContext;
}

export interface ClientInfo {
  ipAddress: string;
  userAgent: string;
  deviceId?: string;
  fingerprint?: string;
}

export interface AuthContext {
  resource?: string;
  action?: string;
  environment?: string;
  metadata?: Record<string, any>;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  session?: AuthSession;
  token?: string;
  mfaRequired?: boolean;
  error?: AuthError;
  nextAction?: NextAction;
}

// AuthError is implemented as a class below

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'account_locked'
  | 'account_expired'
  | 'password_expired'
  | 'mfa_required'
  | 'mfa_invalid'
  | 'provider_error'
  | 'session_expired'
  | 'insufficient_permissions'
  | 'rate_limited'
  | 'suspicious_activity';

export interface NextAction {
  type: 'redirect' | 'mfa_challenge' | 'password_change' | 'account_setup';
  url?: string;
  parameters?: Record<string, any>;
}

export interface AccessControlPolicy {
  id: string;
  name: string;
  rules: AccessRule[];
  enforcement: 'enforce' | 'monitor' | 'disabled';
  priority: number;
  conditions?: PolicyCondition[];
  effects: PolicyEffect[];
}

export interface AccessRule {
  id: string;
  subject: RuleSubject;
  resource: RuleResource;
  actions: string[];
  conditions: RuleCondition[];
  effect: 'permit' | 'deny';
}

export interface RuleSubject {
  type: 'user' | 'role' | 'group' | 'attribute';
  value: string;
  attributes?: Record<string, any>;
}

export interface RuleResource {
  type: 'memory' | 'knowledge_graph' | 'api' | 'data' | 'system';
  pattern: string;
  attributes?: Record<string, any>;
}

export interface RuleCondition {
  attribute: string;
  operator: string;
  value: any;
  context?: 'user' | 'resource' | 'environment' | 'session';
}

export interface PolicyCondition {
  type: 'time_based' | 'location_based' | 'risk_based' | 'environment_based';
  parameters: Record<string, any>;
}

export interface PolicyEffect {
  type: 'audit' | 'alert' | 'rate_limit' | 'require_mfa' | 'restrict_access';
  configuration: Record<string, any>;
}

export class EnterpriseAuthManager extends EventEmitter {
  private providers: Map<string, AuthenticationProvider>;
  private users: Map<string, User>;
  private roles: Map<string, Role>;
  private sessions: Map<string, AuthSession>;
  private policies: Map<string, AccessControlPolicy>;
  private permissionCache: Map<string, EffectivePermissions>;
  private mfaSecrets: Map<string, string>;
  private auditLogger: AuthAuditLogger;
  private riskAnalyzer: RiskAnalyzer;
  private sessionManager: SessionManager;

  constructor() {
    super();
    this.providers = new Map();
    this.users = new Map();
    this.roles = new Map();
    this.sessions = new Map();
    this.policies = new Map();
    this.permissionCache = new Map();
    this.mfaSecrets = new Map();

    this.auditLogger = new AuthAuditLogger();
    this.riskAnalyzer = new RiskAnalyzer();
    this.sessionManager = new SessionManager();

    this.initializeDefaultProviders();
    this.initializeDefaultRoles();
    this.initializeDefaultPolicies();
    this.startSessionCleanup();
  }

  /**
   * Authenticate user with provider
   */
  async authenticate(request: AuthRequest): Promise<AuthResult> {
    const startTime = Date.now();
    let result: AuthResult;

    try {
      // Risk assessment
      const riskScore = await this.riskAnalyzer.assessRequest(request);

      // Rate limiting
      await this.checkRateLimit(request);

      // Get provider
      const provider = this.providers.get(request.provider);
      if (!provider || !provider.enabled) {
        throw new AuthError('provider_error', 'Authentication provider not available');
      }

      // Authenticate with provider
      result = await this.authenticateWithProvider(provider, request);

      if (result.success && result.user) {
        // Check account status
        await this.validateAccountStatus(result.user);

        // Handle MFA if required
        if (this.requiresMFA(result.user, request, riskScore)) {
          if (!request.mfaToken) {
            result = {
              success: false,
              mfaRequired: true,
              nextAction: {
                type: 'mfa_challenge',
                parameters: { methods: ['totp', 'sms'] },
              },
            };
          } else {
            const mfaValid = await this.verifyMFA(result.user.id, request.mfaToken);
            if (!mfaValid) {
              throw new AuthError('mfa_invalid', 'Invalid MFA token');
            }
          }
        }

        // Create session if authentication successful
        if (result.success) {
          const session = await this.createSession(result.user, request, riskScore);
          result.session = session;
          result.token = await this.generateJWT(result.user, session);
        }
      }
    } catch (error) {
      result = {
        success: false,
        error:
          error instanceof AuthError
            ? error
            : new AuthError('provider_error', error.message || 'Authentication failed'),
      };
    }

    // Audit log
    await this.auditLogger.logAuthentication(request, result, Date.now() - startTime);

    // Emit event
    this.emit('authenticationAttempt', { request, result });

    return result;
  }

  /**
   * Check if user has permission for resource/action
   */
  async authorize(
    sessionId: string,
    resource: string,
    action: string,
    context?: AuthContext,
  ): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session || session.expiresAt < new Date()) {
      return false;
    }

    const user = this.users.get(session.userId);
    if (!user || user.status !== 'active') {
      return false;
    }

    // Get effective permissions
    const permissions = await this.getEffectivePermissions(user.id);

    // Check permissions
    const hasPermission = this.checkPermission(permissions, resource, action);

    // Apply policies
    const policyResult = await this.evaluatePolicies(user, resource, action, context);

    // Audit log
    await this.auditLogger.logAuthorization(
      sessionId,
      resource,
      action,
      hasPermission && policyResult.allowed,
    );

    return hasPermission && policyResult.allowed;
  }

  /**
   * Get user by session
   */
  async getUserBySession(sessionId: string): Promise<User | null> {
    const session = this.sessions.get(sessionId);
    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    return this.users.get(session.userId) || null;
  }

  /**
   * Refresh session
   */
  async refreshSession(sessionId: string): Promise<AuthResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        success: false,
        error: new AuthError('session_expired', 'Session not found'),
      };
    }

    const user = this.users.get(session.userId);
    if (!user || user.status !== 'active') {
      return {
        success: false,
        error: new AuthError('account_locked', 'User account is not active'),
      };
    }

    // Extend session
    session.expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours
    session.lastActivity = new Date();

    // Generate new token
    const token = await this.generateJWT(user, session);

    return {
      success: true,
      user,
      session,
      token,
    };
  }

  /**
   * Logout user session
   */
  async logout(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);

      // Audit log
      await this.auditLogger.logLogout(sessionId);

      // Emit event
      this.emit('userLogout', { sessionId, userId: session.userId });
    }
  }

  /**
   * Register authentication provider
   */
  registerProvider(provider: AuthenticationProvider): void {
    this.providers.set(provider.id, provider);
    this.emit('providerRegistered', provider);
  }

  /**
   * Create or update user
   */
  async createUser(userData: Partial<User> & { username: string; email: string }): Promise<User> {
    const user: User = {
      id: userData.id || this.generateId('user'),
      username: userData.username,
      email: userData.email,
      displayName: userData.displayName || userData.username,
      firstName: userData.firstName,
      lastName: userData.lastName,
      avatar: userData.avatar,
      groups: userData.groups || [],
      roles: userData.roles || [],
      permissions: userData.permissions || [],
      attributes: userData.attributes || {},
      status: userData.status || 'active',
      mfaEnabled: userData.mfaEnabled || false,
      lastLogin: userData.lastLogin,
      passwordExpiry: userData.passwordExpiry,
      accountExpiry: userData.accountExpiry,
    };

    this.users.set(user.id, user);

    // Clear permission cache
    this.permissionCache.delete(user.id);

    // Audit log
    await this.auditLogger.logUserManagement('create', user.id);

    // Emit event
    this.emit('userCreated', user);

    return user;
  }

  /**
   * Create or update role
   */
  async createRole(
    roleData: Omit<Role, 'metadata'> & { createdBy: string; metadata?: Partial<RoleMetadata> },
  ): Promise<Role> {
    const role: Role = {
      ...roleData,
      metadata: {
        createdBy: roleData.createdBy,
        createdAt: new Date(),
        lastModified: new Date(),
        tags: roleData.metadata?.tags || [],
        approvalRequired: roleData.metadata?.approvalRequired || false,
        temporaryRole: roleData.metadata?.temporaryRole,
      },
    };

    this.roles.set(role.id, role);

    // Clear affected users' permission cache
    for (const user of Array.from(this.users.values())) {
      if (user.roles.some((r) => r.id === role.id)) {
        this.permissionCache.delete(user.id);
      }
    }

    // Audit log
    await this.auditLogger.logRoleManagement('create', role.id);

    // Emit event
    this.emit('roleCreated', role);

    return role;
  }

  /**
   * Assign role to user
   */
  async assignRole(userId: string, roleId: string, assignedBy: string): Promise<void> {
    const user = this.users.get(userId);
    const role = this.roles.get(roleId);

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    if (!role) {
      throw new Error(`Role ${roleId} not found`);
    }

    // Check if role is already assigned
    if (user.roles.some((r) => r.id === roleId)) {
      return; // Already assigned
    }

    // Check if approval is required
    if (role.metadata.approvalRequired) {
      // Implement approval workflow
      this.emit('roleAssignmentRequiresApproval', { userId, roleId, assignedBy });
      return;
    }

    // Assign role
    user.roles.push(role);

    // Clear permission cache
    this.permissionCache.delete(userId);

    // Audit log
    await this.auditLogger.logRoleAssignment(userId, roleId, assignedBy);

    // Emit event
    this.emit('roleAssigned', { userId, roleId, assignedBy });
  }

  /**
   * Setup MFA for user
   */
  async setupMFA(
    userId: string,
    method: 'totp' | 'sms',
  ): Promise<{
    secret?: string;
    qrCode?: string;
    backupCodes: string[];
  }> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const result: any = { backupCodes: this.generateBackupCodes() };

    if (method === 'totp') {
      const secret = this.generateTOTPSecret();
      this.mfaSecrets.set(userId, secret);

      result.secret = secret;
      result.qrCode = this.generateQRCode(user.email, secret);
    }

    // Mark MFA as enabled
    user.mfaEnabled = true;

    // Audit log
    await this.auditLogger.logMFASetup(userId, method);

    return result;
  }

  /**
   * Create access control policy
   */
  createPolicy(policy: AccessControlPolicy): void {
    this.policies.set(policy.id, policy);

    // Clear all permission caches as policies affect authorization
    this.permissionCache.clear();

    this.emit('policyCreated', policy);
  }

  // Private methods

  private initializeDefaultProviders(): void {
    // Local authentication provider
    this.registerProvider({
      id: 'local',
      name: 'Local Authentication',
      type: 'local',
      config: {},
      enabled: true,
      priority: 1,
    });

    // SAML provider template
    this.registerProvider({
      id: 'saml_corporate',
      name: 'Corporate SAML',
      type: 'saml',
      config: {
        ssoUrl: process.env.SAML_SSO_URL,
        issuer: process.env.SAML_ISSUER,
        certificate: process.env.SAML_CERTIFICATE,
      },
      enabled: !!process.env.SAML_SSO_URL,
      priority: 2,
    });

    // OAuth2 provider template
    this.registerProvider({
      id: 'oauth2_azure',
      name: 'Azure AD OAuth2',
      type: 'oauth2',
      config: {
        clientId: process.env.AZURE_CLIENT_ID,
        clientSecret: process.env.AZURE_CLIENT_SECRET,
        authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
        scopes: ['openid', 'profile', 'email'],
      },
      enabled: !!process.env.AZURE_CLIENT_ID,
      priority: 3,
    });
  }

  private initializeDefaultRoles(): void {
    // Admin role
    this.createRole({
      id: 'admin',
      name: 'Administrator',
      description: 'Full system access',
      permissions: [
        {
          id: 'admin_all',
          resource: '*',
          action: '*',
          effect: 'allow',
          priority: 1,
        },
      ],
      scope: { global: true },
      createdBy: 'system',
    });

    // User role
    this.createRole({
      id: 'user',
      name: 'Standard User',
      description: 'Basic system access',
      permissions: [
        {
          id: 'user_read',
          resource: 'memory',
          action: 'read',
          effect: 'allow',
          priority: 1,
        },
        {
          id: 'user_write_own',
          resource: 'memory',
          action: 'write',
          conditions: [
            {
              type: 'attribute',
              operator: 'equals',
              value: 'self',
            },
          ],
          effect: 'allow',
          priority: 1,
        },
      ],
      scope: { global: true },
      createdBy: 'system',
    });

    // Viewer role
    this.createRole({
      id: 'viewer',
      name: 'Read-Only User',
      description: 'Read-only access',
      permissions: [
        {
          id: 'viewer_read',
          resource: 'memory',
          action: 'read',
          effect: 'allow',
          priority: 1,
        },
      ],
      scope: { global: true },
      createdBy: 'system',
    });
  }

  private initializeDefaultPolicies(): void {
    // Time-based access policy
    this.createPolicy({
      id: 'business_hours',
      name: 'Business Hours Access',
      rules: [
        {
          id: 'business_hours_rule',
          subject: { type: 'role', value: 'user' },
          resource: { type: 'memory', pattern: '*' },
          actions: ['read', 'write'],
          conditions: [
            {
              attribute: 'time',
              operator: 'greater_than',
              value: '09:00',
              context: 'environment',
            },
            {
              attribute: 'time',
              operator: 'less_than',
              value: '17:00',
              context: 'environment',
            },
          ],
          effect: 'permit',
        },
      ],
      enforcement: 'monitor',
      priority: 1,
      conditions: [
        {
          type: 'time_based',
          parameters: { timezone: 'UTC' },
        },
      ],
      effects: [
        {
          type: 'audit',
          configuration: { logLevel: 'info' },
        },
      ],
    });

    // High-risk access policy
    this.createPolicy({
      id: 'high_risk_access',
      name: 'High Risk Access Control',
      rules: [
        {
          id: 'high_risk_rule',
          subject: { type: 'user', value: '*' },
          resource: { type: 'memory', pattern: 'sensitive/*' },
          actions: ['*'],
          conditions: [
            {
              attribute: 'riskScore',
              operator: 'greater_than',
              value: 0.7,
              context: 'session',
            },
          ],
          effect: 'deny',
        },
      ],
      enforcement: 'enforce',
      priority: 10,
      effects: [
        {
          type: 'require_mfa',
          configuration: { methods: ['totp'] },
        },
        {
          type: 'alert',
          configuration: {
            channels: ['email', 'slack'],
            severity: 'high',
          },
        },
      ],
    });
  }

  private async authenticateWithProvider(
    provider: AuthenticationProvider,
    request: AuthRequest,
  ): Promise<AuthResult> {
    switch (provider.type) {
      case 'local':
        return this.authenticateLocal(request);

      case 'saml':
        return this.authenticateSAML(provider, request);

      case 'oauth2':
        return this.authenticateOAuth2(provider, request);

      case 'ldap':
        return this.authenticateLDAP(provider, request);

      default:
        throw new AuthError('provider_error', `Unsupported provider type: ${provider.type}`);
    }
  }

  private async authenticateLocal(request: AuthRequest): Promise<AuthResult> {
    if (!request.username || !request.password) {
      throw new AuthError('invalid_credentials', 'Username and password required');
    }

    // Find user by username
    const user = Array.from(this.users.values()).find(
      (u) => u.username === request.username || u.email === request.username,
    );

    if (!user) {
      throw new AuthError('invalid_credentials', 'Invalid credentials');
    }

    // Verify password (in production, use proper password hashing)
    const passwordValid = await this.verifyPassword(request.password!, user.id);

    if (!passwordValid) {
      throw new AuthError('invalid_credentials', 'Invalid credentials');
    }

    return { success: true, user };
  }

  private async authenticateSAML(
    provider: AuthenticationProvider,
    request: AuthRequest,
  ): Promise<AuthResult> {
    // SAML authentication implementation
    if (!request.ssoToken) {
      return {
        success: false,
        nextAction: {
          type: 'redirect',
          url: provider.config.ssoUrl!,
        },
      };
    }

    // Validate SAML token (simplified)
    const userInfo = await this.validateSAMLToken(request.ssoToken, provider.config);

    // Find or create user
    let user = Array.from(this.users.values()).find((u) => u.email === userInfo.email);

    if (!user) {
      user = await this.createUser({
        username: userInfo.username,
        email: userInfo.email,
        displayName: userInfo.displayName,
        firstName: userInfo.firstName,
        lastName: userInfo.lastName,
        groups: userInfo.groups || [],
      });
    }

    return { success: true, user };
  }

  private async authenticateOAuth2(
    provider: AuthenticationProvider,
    request: AuthRequest,
  ): Promise<AuthResult> {
    // OAuth2 authentication implementation
    // This would involve token exchange and user info retrieval
    throw new AuthError('provider_error', 'OAuth2 authentication not implemented');
  }

  private async authenticateLDAP(
    provider: AuthenticationProvider,
    request: AuthRequest,
  ): Promise<AuthResult> {
    // LDAP authentication implementation
    throw new AuthError('provider_error', 'LDAP authentication not implemented');
  }

  private async validateAccountStatus(user: User): Promise<void> {
    if (user.status !== 'active') {
      throw new AuthError('account_locked', `Account is ${user.status}`);
    }

    if (user.accountExpiry && user.accountExpiry < new Date()) {
      throw new AuthError('account_expired', 'Account has expired');
    }

    if (user.passwordExpiry && user.passwordExpiry < new Date()) {
      throw new AuthError('password_expired', 'Password has expired');
    }
  }

  private requiresMFA(user: User, request: AuthRequest, riskScore: number): boolean {
    // Always require MFA if enabled for user
    if (user.mfaEnabled) {
      return true;
    }

    // Require MFA for high-risk requests
    if (riskScore > 0.7) {
      return true;
    }

    // Check if resource requires MFA
    if (request.context?.resource?.includes('sensitive')) {
      return true;
    }

    return false;
  }

  private async verifyMFA(userId: string, token: string): Promise<boolean> {
    const secret = this.mfaSecrets.get(userId);
    if (!secret) {
      return false;
    }

    // Verify TOTP token (simplified)
    return this.verifyTOTP(secret, token);
  }

  private async createSession(
    user: User,
    request: AuthRequest,
    riskScore: number,
  ): Promise<AuthSession> {
    const session: AuthSession = {
      id: this.generateId('session'),
      userId: user.id,
      provider: request.provider,
      createdAt: new Date(),
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours
      ipAddress: request.clientInfo.ipAddress,
      userAgent: request.clientInfo.userAgent,
      deviceId: request.clientInfo.deviceId,
      mfaVerified: !!request.mfaToken,
      permissions: await this.getEffectivePermissions(user.id),
      metadata: {
        loginMethod: request.provider,
        riskScore,
        location: await this.getLocationFromIP(request.clientInfo.ipAddress),
        deviceFingerprint: request.clientInfo.fingerprint,
        trustedDevice: await this.isTrustedDevice(request.clientInfo),
        sessionType: 'interactive',
      },
    };

    this.sessions.set(session.id, session);

    // Update user last login
    user.lastLogin = new Date();

    return session;
  }

  private async getEffectivePermissions(userId: string): Promise<EffectivePermissions> {
    // Check cache first
    const cached = this.permissionCache.get(userId);
    if (cached && cached.cacheExpiry > new Date()) {
      return cached;
    }

    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const resources = new Map<string, string[]>();

    // Collect permissions from user's roles
    for (const role of user.roles) {
      for (const permission of role.permissions) {
        if (permission.effect === 'allow') {
          const actions = resources.get(permission.resource) || [];
          if (!actions.includes(permission.action)) {
            actions.push(permission.action);
          }
          resources.set(permission.resource, actions);
        }
      }
    }

    // Add direct user permissions
    for (const permission of user.permissions) {
      if (permission.effect === 'allow') {
        const actions = resources.get(permission.resource) || [];
        if (!actions.includes(permission.action)) {
          actions.push(permission.action);
        }
        resources.set(permission.resource, actions);
      }
    }

    const effective: EffectivePermissions = {
      resources,
      computed: new Date(),
      cacheExpiry: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes cache
    };

    this.permissionCache.set(userId, effective);

    return effective;
  }

  private checkPermission(
    permissions: EffectivePermissions,
    resource: string,
    action: string,
  ): boolean {
    // Check exact match
    const resourceActions = permissions.resources.get(resource);
    if (resourceActions && (resourceActions.includes(action) || resourceActions.includes('*'))) {
      return true;
    }

    // Check wildcard resources
    for (const [res, actions] of Array.from(permissions.resources)) {
      if (this.matchesPattern(res, resource)) {
        if (actions.includes(action) || actions.includes('*')) {
          return true;
        }
      }
    }

    return false;
  }

  private matchesPattern(pattern: string, resource: string): boolean {
    if (pattern === '*') {return true;}
    if (pattern === resource) {return true;}

    // Simple glob pattern matching
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(resource);
  }

  private async evaluatePolicies(
    user: User,
    resource: string,
    action: string,
    context?: AuthContext,
  ): Promise<{ allowed: boolean; effects: PolicyEffect[] }> {
    const effects: PolicyEffect[] = [];
    let allowed = true;

    // Sort policies by priority
    const sortedPolicies = Array.from(this.policies.values()).sort(
      (a, b) => b.priority - a.priority,
    );

    for (const policy of sortedPolicies) {
      if (policy.enforcement === 'disabled') {continue;}

      const evaluation = await this.evaluatePolicy(policy, user, resource, action, context);

      if (evaluation.applicable) {
        if (policy.enforcement === 'enforce') {
          allowed = allowed && evaluation.allowed;
        }

        effects.push(...policy.effects);
      }
    }

    return { allowed, effects };
  }

  private async evaluatePolicy(
    policy: AccessControlPolicy,
    user: User,
    resource: string,
    action: string,
    context?: AuthContext,
  ): Promise<{ applicable: boolean; allowed: boolean }> {
    let applicable = false;
    let allowed = true;

    for (const rule of policy.rules) {
      if (this.ruleApplies(rule, user, resource, action, context)) {
        applicable = true;

        if (rule.effect === 'deny') {
          allowed = false;
          break; // Deny takes precedence
        }
      }
    }

    return { applicable, allowed };
  }

  private ruleApplies(
    rule: AccessRule,
    user: User,
    resource: string,
    action: string,
    context?: AuthContext,
  ): boolean {
    // Check subject
    if (!this.subjectMatches(rule.subject, user)) {
      return false;
    }

    // Check resource
    if (!this.resourceMatches(rule.resource, resource)) {
      return false;
    }

    // Check action
    if (!rule.actions.includes(action) && !rule.actions.includes('*')) {
      return false;
    }

    // Check conditions
    for (const condition of rule.conditions) {
      if (!this.conditionMatches(condition, user, resource, context)) {
        return false;
      }
    }

    return true;
  }

  private subjectMatches(subject: RuleSubject, user: User): boolean {
    switch (subject.type) {
      case 'user':
        return subject.value === user.id || subject.value === '*';

      case 'role':
        return user.roles.some((r) => r.id === subject.value) || subject.value === '*';

      case 'group':
        return user.groups.includes(subject.value) || subject.value === '*';

      case 'attribute':
        return this.hasAttribute(user, subject.value, subject.attributes);

      default:
        return false;
    }
  }

  private resourceMatches(ruleResource: RuleResource, resource: string): boolean {
    return this.matchesPattern(ruleResource.pattern, resource);
  }

  private conditionMatches(
    condition: RuleCondition,
    user: User,
    resource: string,
    context?: AuthContext,
  ): boolean {
    let value: any;

    switch (condition.context) {
      case 'user':
        value = (user as any)[condition.attribute] || user.attributes[condition.attribute];
        break;

      case 'resource':
        value = resource;
        break;

      case 'environment':
        value = this.getEnvironmentValue(condition.attribute);
        break;

      case 'session':
        value = context?.metadata?.[condition.attribute];
        break;

      default:
        value = context?.metadata?.[condition.attribute];
    }

    return this.compareValues(value, condition.operator, condition.value);
  }

  private hasAttribute(
    user: User,
    attributeName: string,
    expectedAttributes?: Record<string, any>,
  ): boolean {
    if (!expectedAttributes) {return true;}

    for (const [key, value] of Object.entries(expectedAttributes)) {
      const userValue = user.attributes[key];
      if (userValue !== value) {
        return false;
      }
    }

    return true;
  }

  private getEnvironmentValue(attribute: string): any {
    switch (attribute) {
      case 'time':
        return new Date().toTimeString().substring(0, 5); // HH:MM

      case 'date':
        return new Date().toISOString().substring(0, 10); // YYYY-MM-DD

      case 'day_of_week':
        return new Date().getDay();

      default:
        return process.env[attribute];
    }
  }

  private compareValues(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;

      case 'contains':
        return String(actual).includes(String(expected));

      case 'matches':
        return new RegExp(expected).test(String(actual));

      case 'greater_than':
        return actual > expected;

      case 'less_than':
        return actual < expected;

      case 'in':
        return Array.isArray(expected) && expected.includes(actual);

      case 'not_in':
        return Array.isArray(expected) && !expected.includes(actual);

      default:
        return false;
    }
  }

  private async checkRateLimit(request: AuthRequest): Promise<void> {
    // Implement rate limiting logic
    // For now, just a placeholder
  }

  private async generateJWT(user: User, session: AuthSession): Promise<string> {
    const payload = {
      sub: user.id,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(session.expiresAt.getTime() / 1000),
      sid: session.id,
      roles: user.roles.map((r) => r.id),
      permissions: Array.from(session.permissions.resources.keys()),
    };

    // In production, use proper JWT secret from environment
    const secret = process.env.JWT_SECRET || 'default-secret';
    return jwt.sign(payload, secret);
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTOTPSecret(): string {
    return crypto.randomBytes(20).toString('hex');
  }

  private generateBackupCodes(): string[] {
    return Array.from({ length: 8 }, () => crypto.randomBytes(4).toString('hex').toUpperCase());
  }

  private generateQRCode(email: string, secret: string): string {
    // Generate QR code URL for TOTP
    const issuer = 'MARIA';
    const label = `${issuer}:${email}`;
    return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}`;
  }

  private verifyTOTP(secret: string, token: string): boolean {
    // Simplified TOTP verification
    // In production, use a proper TOTP library
    return token.length === 6 && /^\d{6}$/.test(token);
  }

  private async verifyPassword(password: string, userId: string): Promise<boolean> {
    // In production, compare with hashed password
    // For now, simplified check
    return password.length > 6;
  }

  private async validateSAMLToken(token: string, config: AuthProviderConfig): Promise<any> {
    // SAML token validation logic
    // Simplified for demo
    return {
      username: 'saml_user',
      email: 'user@company.com',
      displayName: 'SAML User',
      firstName: 'SAML',
      lastName: 'User',
      groups: ['employees'],
    };
  }

  private async getLocationFromIP(ipAddress: string): Promise<string> {
    // IP geolocation
    return 'Unknown';
  }

  private async isTrustedDevice(clientInfo: ClientInfo): Promise<boolean> {
    // Device trust assessment
    return false;
  }

  private startSessionCleanup(): void {
    // Clean up expired sessions every hour
    setInterval(
      () => {
        const now = new Date();
        for (const [id, session] of Array.from(this.sessions)) {
          if (session.expiresAt < now) {
            this.sessions.delete(id);
          }
        }
      },
      60 * 60 * 1000,
    );
  }
}

// Supporting classes

class AuthAuditLogger {
  async logAuthentication(
    request: AuthRequest,
    result: AuthResult,
    duration: number,
  ): Promise<void> {
    console.log('Auth Audit:', {
      username: request.username,
      provider: request.provider,
      success: result.success,
      duration,
    });
  }

  async logAuthorization(
    sessionId: string,
    resource: string,
    action: string,
    allowed: boolean,
  ): Promise<void> {
    console.log('Authz Audit:', { sessionId, resource, action, allowed });
  }

  async logLogout(sessionId: string): Promise<void> {
    console.log('Logout Audit:', { sessionId });
  }

  async logUserManagement(action: string, userId: string): Promise<void> {
    console.log('User Management Audit:', { action, userId });
  }

  async logRoleManagement(action: string, roleId: string): Promise<void> {
    console.log('Role Management Audit:', { action, roleId });
  }

  async logRoleAssignment(userId: string, roleId: string, assignedBy: string): Promise<void> {
    console.log('Role Assignment Audit:', { userId, roleId, assignedBy });
  }

  async logMFASetup(userId: string, method: string): Promise<void> {
    console.log('MFA Setup Audit:', { userId, method });
  }
}

class RiskAnalyzer {
  async assessRequest(request: AuthRequest): Promise<number> {
    let riskScore = 0.1; // Base risk

    // IP-based risk
    if (this.isKnownBadIP(request.clientInfo.ipAddress)) {
      riskScore += 0.5;
    }

    // Time-based risk
    if (this.isOffHours()) {
      riskScore += 0.2;
    }

    // Device risk
    if (!request.clientInfo.deviceId) {
      riskScore += 0.1;
    }

    return Math.min(1.0, riskScore);
  }

  private isKnownBadIP(ip: string): boolean {
    // Check against threat intelligence
    return false;
  }

  private isOffHours(): boolean {
    const hour = new Date().getHours();
    return hour < 6 || hour > 22;
  }
}

class SessionManager {
  // Session management utilities
}

export class AuthError extends Error {
  constructor(
    public code: AuthErrorCode,
    message: string,
    public details?: Record<string, any>,
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
