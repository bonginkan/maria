/**
 * Access Control Manager for Enterprise Memory System
 *
 * Implements hierarchical access control for memory system with
 * RBAC (Role-Based Access Control), role-based permissions and data classification.
 * Provides GDPR and HIPAA compliance features for enterprise environments.
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';

export interface AccessControlConfig {
  organizationId: string;
  hierarchyLevels: HierarchyLevel[];
  defaultPermissions: PermissionSet;
  dataClassification: DataClassificationPolicy;
  auditEnabled: boolean;
}

export interface HierarchyLevel {
  level: 'individual' | 'team' | 'project' | 'organization';
  priority: number; // Higher number = higher priority
  inheritFromParent: boolean;
  overrideChild: boolean;
}

export interface User {
  id: string;
  email: string;
  roles: Role[];
  teams: string[];
  projects: string[];
  organizationId: string;
  attributes: UserAttributes;
  permissions: PermissionSet;
  restrictions: AccessRestriction[];
}

export interface Role {
  id: string;
  name: string;
  level: 'system' | 'organization' | 'project' | 'team';
  permissions: PermissionSet;
  priority: number;
  inherited: boolean;
}

export interface UserAttributes {
  department?: string;
  jobTitle?: string;
  clearanceLevel?: 'public' | 'internal' | 'confidential' | 'secret';
  location?: string;
  employmentType?: 'full-time' | 'contractor' | 'partner' | 'guest';
  customAttributes?: Record<string, unknown>;
}

export interface PermissionSet {
  memory: MemoryPermissions;
  data: DataPermissions;
  operations: OperationPermissions;
  administration: AdminPermissions;
}

export interface MemoryPermissions {
  read: MemoryScope[];
  write: MemoryScope[];
  delete: MemoryScope[];
  share: MemoryScope[];
  export: MemoryScope[];
}

export interface MemoryScope {
  type: 'personal' | 'team' | 'project' | 'organization' | 'global';
  id?: string; // Specific team/project ID if applicable
  dataTypes?: string[]; // Specific data types allowed
  timeRange?: TimeRange; // Access to historical data
}

export interface TimeRange {
  start?: Date;
  end?: Date;
  rolling?: number; // Rolling window in days
}

export interface DataPermissions {
  classification: DataClassification[];
  sensitivity: SensitivityLevel[];
  categories: string[];
  tags: string[];
  excludedFields?: string[]; // Fields that should be masked/excluded
}

export interface DataClassification {
  level: 'public' | 'internal' | 'confidential' | 'restricted' | 'secret';
  handling: 'standard' | 'encrypted' | 'masked' | 'redacted';
  retention: RetentionPolicy;
}

export interface SensitivityLevel {
  type: 'pii' | 'phi' | 'financial' | 'intellectual-property' | 'trade-secret';
  accessLevel: 'full' | 'masked' | 'aggregated' | 'none';
  auditRequired: boolean;
}

export interface RetentionPolicy {
  duration: number; // Days
  archiveAfter?: number; // Days before archiving
  deleteAfter?: number; // Days before deletion
  legalHold?: boolean;
}

export interface OperationPermissions {
  query: QueryPermissions;
  analyze: AnalyzePermissions;
  modify: ModifyPermissions;
  integrate: IntegrationPermissions;
}

export interface QueryPermissions {
  maxResults?: number;
  maxDepth?: number; // For graph queries
  allowedQueries?: string[];
  deniedQueries?: string[];
  timeLimit?: number; // Query timeout in seconds
}

export interface AnalyzePermissions {
  algorithms: string[];
  mlModels: string[];
  aggregations: string[];
  exports: ExportFormat[];
}

export interface ExportFormat {
  format: 'json' | 'csv' | 'xml' | 'pdf' | 'excel';
  maxSize?: number; // MB
  encryption?: 'none' | 'aes256' | 'pgp';
  watermark?: boolean;
}

export interface ModifyPermissions {
  create: boolean;
  update: boolean;
  delete: boolean;
  bulkOperations: boolean;
  maxBatchSize?: number;
}

export interface IntegrationPermissions {
  apis: string[];
  webhooks: string[];
  external: ExternalIntegration[];
}

export interface ExternalIntegration {
  service: string;
  permissions: string[];
  rateLimit?: number;
  dataFlow: 'inbound' | 'outbound' | 'bidirectional';
}

export interface AdminPermissions {
  manageUsers: boolean;
  manageRoles: boolean;
  managePermissions: boolean;
  viewAudit: boolean;
  configureSystem: boolean;
  emergencyAccess: boolean;
}

export interface AccessRestriction {
  id: string;
  type: 'temporal' | 'geographical' | 'conditional' | 'compliance';
  condition: RestrictionCondition;
  action: 'deny' | 'require-mfa' | 'audit' | 'alert';
  priority: number;
  expires?: Date;
}

export interface RestrictionCondition {
  temporal?: TemporalCondition;
  geographical?: GeographicalCondition;
  conditional?: ConditionalExpression;
  compliance?: ComplianceRequirement;
}

export interface TemporalCondition {
  allowedDays?: string[]; // ['monday', 'tuesday', ...]
  allowedHours?: { start: string; end: string }; // 24h format
  timezone?: string;
  blackoutDates?: Date[];
}

export interface GeographicalCondition {
  allowedCountries?: string[];
  deniedCountries?: string[];
  allowedIPs?: string[];
  deniedIPs?: string[];
  requireVPN?: boolean;
}

export interface ConditionalExpression {
  expression: string; // e.g., "user.department === 'Engineering'"
  variables: Record<string, unknown>;
  evaluator: 'javascript' | 'jsonpath' | 'custom';
}

export interface ComplianceRequirement {
  standard: 'gdpr' | 'hipaa' | 'sox' | 'pci-dss' | 'custom';
  requirements: string[];
  validationRequired: boolean;
  certificationExpiry?: Date;
}

export interface GDPRCompliance {
  enabled: boolean;
  dataProcessingBasis: DataProcessingBasis[];
  retentionPolicies: RetentionPolicy[];
  rightToErasure: boolean;
  rightToPortability: boolean;
  rightToRectification: boolean;
  dataBreachNotification: boolean;
  consentManagement: ConsentManagement;
  privacyByDesign: boolean;
  dataProtectionOfficer?: string;
}

export interface DataProcessingBasis {
  type:
    | 'consent'
    | 'contract'
    | 'legal_obligation'
    | 'vital_interests'
    | 'public_task'
    | 'legitimate_interests';
  description: string;
  dataTypes: string[];
  purposes: string[];
  validUntil?: Date;
}

export interface ConsentManagement {
  required: boolean;
  granular: boolean;
  withdrawable: boolean;
  recordConsent: boolean;
  consentExpiry?: number; // days
}

export interface HIPAACompliance {
  enabled: boolean;
  coveredEntity: boolean;
  businessAssociate: boolean;
  phi: PHIClassification;
  administrativeSafeguards: AdministrativeSafeguards;
  physicalSafeguards: PhysicalSafeguards;
  technicalSafeguards: TechnicalSafeguards;
  breachNotification: BreachNotification;
  accessLogs: boolean;
  auditControls: boolean;
}

export interface PHIClassification {
  identifiers: string[];
  deIdentificationMethod: 'safe_harbor' | 'expert_determination' | 'none';
  minimumNecessary: boolean;
  authorizedDisclosure: string[];
}

export interface AdministrativeSafeguards {
  securityOfficer: string;
  conductTraining: boolean;
  incidentProcedures: boolean;
  contingencyPlan: boolean;
  securityEvaluations: boolean;
}

export interface PhysicalSafeguards {
  facilityAccess: boolean;
  workstationSecurity: boolean;
  deviceControls: boolean;
  mediaControls: boolean;
}

export interface TechnicalSafeguards {
  accessControl: boolean;
  auditControls: boolean;
  integrity: boolean;
  transmission: boolean;
  encryption: EncryptionRequirements;
}

export interface EncryptionRequirements {
  atRest: boolean;
  inTransit: boolean;
  algorithm: string;
  keyManagement: boolean;
}

export interface BreachNotification {
  enabled: boolean;
  timeframeHours: number;
  authorities: string[];
  individuals: boolean;
  media: boolean;
}

export interface AccessRequest {
  id: string;
  userId: string;
  resource: ResourceIdentifier;
  operation: string;
  context: AccessContext;
  timestamp: Date;
}

export interface ResourceIdentifier {
  type: 'memory' | 'entity' | 'pattern' | 'insight' | 'configuration';
  id: string;
  path?: string;
  classification?: DataClassification;
  owner?: string;
}

export interface AccessContext {
  ip?: string;
  userAgent?: string;
  location?: GeographicalLocation;
  sessionId?: string;
  mfaVerified?: boolean;
  riskScore?: number;
}

export interface GeographicalLocation {
  country: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

export interface AccessDecision {
  requestId: string;
  granted: boolean;
  reason?: string;
  permissions?: PermissionSet;
  restrictions?: AccessRestriction[];
  audit: AuditEntry;
  ttl?: number; // Time to live for cached decision
}

export interface AuditEntry {
  id: string;
  timestamp: Date;
  userId: string;
  action: string;
  resource: ResourceIdentifier;
  decision: 'granted' | 'denied' | 'partial';
  reason?: string;
  context: AccessContext;
  duration?: number; // Processing time in ms
  modifications?: DataModification[];
}

export interface DataModification {
  field: string;
  action: 'masked' | 'redacted' | 'encrypted' | 'removed';
  reason: string;
}

export interface DataClassificationPolicy {
  enabled: boolean;
  defaultClassification: DataClassification;
  autoClassify: boolean;
  classifiers: DataClassifier[];
  scanInterval?: number; // Hours
}

export interface DataClassifier {
  id: string;
  name: string;
  type: 'pattern' | 'ml-model' | 'rule-based' | 'manual';
  patterns?: RegExp[];
  model?: string;
  rules?: ClassificationRule[];
  confidence: number;
}

export interface ClassificationRule {
  condition: string;
  classification: DataClassification;
  priority: number;
  override: boolean;
}

export interface AccessCache {
  decisions: Map<string, CachedDecision>;
  maxSize: number;
  ttl: number;
  hitRate: number;
  missRate: number;
}

export interface CachedDecision {
  decision: AccessDecision;
  expires: Date;
  hits: number;
  created: Date;
}

export class AccessControlManager extends EventEmitter {
  private config: AccessControlConfig;
  private users: Map<string, User>;
  private roles: Map<string, Role>;
  private cache: AccessCache;
  private auditLog: AuditEntry[];
  private _policyEngine: PolicyEngine;
  private _encryptionKey: Buffer;
  private gdprCompliance?: GDPRCompliance;
  private hipaaCompliance?: HIPAACompliance;

  constructor(config: AccessControlConfig) {
    super();

    this.config = config;
    this.users = new Map();
    this.roles = new Map();
    this.auditLog = [];
    this.cache = this.initializeCache();
    this._policyEngine = new PolicyEngine(config);
    this._encryptionKey = this.generateEncryptionKey();

    this.initializeDefaultRoles();
  }

  // ========== Access Control Methods ==========

  async enforceHierarchicalAccess(
    user: User,
    resource: ResourceIdentifier,
    operation: string,
  ): Promise<{ allowed: boolean; reason?: string; permissions?: PermissionSet }> {
    // Check organization-level access first
    if (!this.hasOrganizationAccess(user, resource)) {
      return {
        allowed: false,
        reason: 'User does not have organization-level access to this resource',
      };
    }

    // Check project-level access
    if (resource.type === 'memory' && resource.path?.includes('/projects/')) {
      const projectId = this.extractProjectId(resource.path);
      if (projectId && !user.projects.includes(projectId)) {
        return {
          allowed: false,
          reason: `User does not have access to project: ${projectId}`,
        };
      }
    }

    // Check team-level access
    if (resource.type === 'memory' && resource.path?.includes('/teams/')) {
      const teamId = this.extractTeamId(resource.path);
      if (teamId && !user.teams.includes(teamId)) {
        return {
          allowed: false,
          reason: `User does not have access to team: ${teamId}`,
        };
      }
    }

    // Apply hierarchical permission inheritance
    const inheritedPermissions = this.calculateInheritedPermissions(user, resource);

    // Check if user has required permission at any level
    const hasRequiredPermission = this.checkPermissionAtAllLevels(
      user,
      inheritedPermissions,
      operation,
    );

    if (!hasRequiredPermission) {
      return {
        allowed: false,
        reason: `Insufficient permissions for operation: ${operation}`,
      };
    }

    return {
      allowed: true,
      permissions: inheritedPermissions,
    };
  }

  private hasOrganizationAccess(user: User, resource: ResourceIdentifier): boolean {
    return user.organizationId === this.config.organizationId;
  }

  private extractProjectId(path: string): string | null {
    const match = path.match(/\/projects\/([^\/]+)/);
    return match ? match[1] : null;
  }

  private extractTeamId(path: string): string | null {
    const match = path.match(/\/teams\/([^\/]+)/);
    return match ? match[1] : null;
  }

  private calculateInheritedPermissions(user: User, resource: ResourceIdentifier): PermissionSet {
    let inheritedPermissions = { ...this.config.defaultPermissions };

    // Start with user's base permissions
    inheritedPermissions = this.mergePermissions(inheritedPermissions, user.permissions);

    // Apply role-based permissions in hierarchy order
    const sortedRoles = user.roles.sort((a, b) => b.priority - a.priority);

    for (const role of sortedRoles) {
      const level = this.config.hierarchyLevels.find((l) => l.level === role.level);
      if (level?.inheritFromParent) {
        inheritedPermissions = this.mergePermissions(inheritedPermissions, role.permissions);
      } else if (level?.overrideChild) {
        inheritedPermissions = role.permissions;
      }
    }

    return inheritedPermissions;
  }

  private checkPermissionAtAllLevels(
    user: User,
    permissions: PermissionSet,
    operation: string,
  ): boolean {
    // Check individual level
    if (this.hasPermissionAtLevel(permissions, operation, 'personal')) {
      return true;
    }

    // Check team level
    if (this.hasPermissionAtLevel(permissions, operation, 'team')) {
      return true;
    }

    // Check project level
    if (this.hasPermissionAtLevel(permissions, operation, 'project')) {
      return true;
    }

    // Check organization level
    if (this.hasPermissionAtLevel(permissions, operation, 'organization')) {
      return true;
    }

    return false;
  }

  private hasPermissionAtLevel(
    permissions: PermissionSet,
    operation: string,
    level: string,
  ): boolean {
    const operationMap: Record<string, keyof MemoryPermissions> = {
      read: 'read',
      write: 'write',
      delete: 'delete',
      share: 'share',
      export: 'export',
    };

    const permissionKey = operationMap[operation];
    if (!permissionKey) {return false;}

    const scopes = permissions.memory[permissionKey] || [];
    return scopes.some((scope) => scope.type === level);
  }

  private mergePermissions(base: PermissionSet, additional: PermissionSet): PermissionSet {
    return {
      memory: {
        read: [...(base.memory.read || []), ...(additional.memory.read || [])],
        write: [...(base.memory.write || []), ...(additional.memory.write || [])],
        delete: [...(base.memory.delete || []), ...(additional.memory.delete || [])],
        share: [...(base.memory.share || []), ...(additional.memory.share || [])],
        export: [...(base.memory.export || []), ...(additional.memory.export || [])],
      },
      data: {
        classification: [
          ...(base.data.classification || []),
          ...(additional.data.classification || []),
        ],
        sensitivity: [...(base.data.sensitivity || []), ...(additional.data.sensitivity || [])],
        categories: [...(base.data.categories || []), ...(additional.data.categories || [])],
        tags: [...(base.data.tags || []), ...(additional.data.tags || [])],
        excludedFields: [
          ...(base.data.excludedFields || []),
          ...(additional.data.excludedFields || []),
        ],
      },
      operations: { ...base.operations, ...additional.operations },
      administration: { ...base.administration, ...additional.administration },
    };
  }

  async checkAccess(request: AccessRequest): Promise<AccessDecision> {
    const startTime = Date.now();
    console.log(
      `Access request: user=${request.userId}, resource=${request.resource.id}, operation=${request.operation}`,
    );

    // Check cache first
    const cacheKey = this.generateCacheKey(request);
    const cached = this.cache.decisions.get(cacheKey);

    if (cached && cached.expires > new Date()) {
      cached.hits++;
      this.cache.hitRate++;

      this.emit('accessChecked', {
        request,
        decision: cached.decision,
        cached: true,
      });

      return cached.decision;
    }

    this.cache.missRate++;

    // Get user
    const user = this.users.get(request.userId);
    if (!user) {
      console.log(`User not found: ${request.userId}`);
      return this.createDeniedDecision(request, 'User not found');
    }

    console.log(`User found: ${user.email}, clearance: ${user.attributes.clearanceLevel}`);
    console.log(`User permissions:`, JSON.stringify(user.permissions.memory, null, 2));

    // Check restrictions first
    const restrictionCheck = await this.checkRestrictions(user, request);
    console.log(`Restriction check: passed=${restrictionCheck.passed}`);
    if (!restrictionCheck.passed) {
      console.log(`Access denied due to restrictions: ${restrictionCheck.reason}`);
      return this.createDeniedDecision(request, restrictionCheck.reason);
    }

    // Evaluate permissions
    const permissions = await this.evaluatePermissions(user, request);
    console.log(`Evaluated permissions:`, JSON.stringify(permissions.data.classification, null, 2));

    // Check data classification
    const classificationCheck = await this.checkDataClassification(
      user,
      request.resource,
      permissions,
    );
    console.log(
      `Resource classification:`,
      JSON.stringify(request.resource.classification, null, 2),
    );
    console.log(`Classification check: allowed=${classificationCheck.allowed}`);
    if (!classificationCheck.allowed) {
      console.log(`Access denied due to classification: ${classificationCheck.reason}`);
      return this.createDeniedDecision(request, classificationCheck.reason);
    }

    // Check if user has permission for the requested operation
    // For public resources, allow access if user has any read permission and appropriate classification
    const isPublicResource = request.resource.classification?.level === 'public';
    const hasAnyReadPermission = permissions.memory.read && permissions.memory.read.length > 0;

    console.log(
      `Permission check: isPublic=${isPublicResource}, operation=${request.operation}, hasAnyRead=${hasAnyReadPermission}`,
    );
    console.log(`Final permissions:`, JSON.stringify(permissions.memory, null, 2));

    let hasPermission = false;
    if (isPublicResource && request.operation === 'read' && hasAnyReadPermission) {
      hasPermission = true;
      console.log(`Granted access to public resource`);
    } else {
      hasPermission = this.checkPermissionAtAllLevels(user, permissions, request.operation);
      console.log(`Permission check result: ${hasPermission}`);
    }

    if (!hasPermission) {
      console.log(`Access denied: Insufficient permissions for operation: ${request.operation}`);
      return this.createDeniedDecision(
        request,
        `Insufficient permissions for operation: ${request.operation}`,
      );
    }

    // Apply data modifications if needed
    const modifications = await this.determineDataModifications(
      user,
      request.resource,
      permissions,
    );

    // Create decision
    const decision: AccessDecision = {
      requestId: request.id,
      granted: true,
      permissions,
      restrictions: restrictionCheck.activeRestrictions,
      audit: this.createAuditEntry(
        request,
        'granted',
        undefined,
        modifications,
        Date.now() - startTime,
      ),
      ttl: this.calculateTTL(permissions),
    };

    // Cache decision
    this.cacheDecision(cacheKey, decision);

    // Audit if enabled
    if (this.config.auditEnabled) {
      this.auditLog.push(decision.audit);
      this.emit('auditLogged', decision.audit);
    }

    this.emit('accessChecked', { request, decision, cached: false });

    return decision;
  }

  private async checkRestrictions(
    user: User,
    request: AccessRequest,
  ): Promise<{ passed: boolean; reason?: string; activeRestrictions?: AccessRestriction[] }> {
    const activeRestrictions: AccessRestriction[] = [];

    for (const restriction of user.restrictions) {
      if (restriction.expires && restriction.expires < new Date()) {
        continue; // Skip expired restrictions
      }

      const applies = await this.evaluateRestriction(restriction, user, request);

      if (applies) {
        activeRestrictions.push(restriction);

        if (restriction.action === 'deny') {
          return {
            passed: false,
            reason: `Access denied by restriction: ${restriction.type}`,
          };
        }

        if (restriction.action === 'require-mfa' && !request.context.mfaVerified) {
          return {
            passed: false,
            reason: 'MFA verification required',
          };
        }
      }
    }

    return { passed: true, activeRestrictions };
  }

  private async evaluateRestriction(
    restriction: AccessRestriction,
    user: User,
    request: AccessRequest,
  ): Promise<boolean> {
    const condition = restriction.condition;

    if (condition.temporal) {
      if (!this.checkTemporalCondition(condition.temporal)) {
        return false;
      }
    }

    if (condition.geographical) {
      if (!this.checkGeographicalCondition(condition.geographical, request.context)) {
        return false;
      }
    }

    if (condition.conditional) {
      if (!(await this.evaluateConditionalExpression(condition.conditional, user, request))) {
        return false;
      }
    }

    if (condition.compliance) {
      if (!this.checkComplianceRequirement(condition.compliance, user)) {
        return false;
      }
    }

    return true;
  }

  private checkTemporalCondition(condition: TemporalCondition): boolean {
    const now = new Date();
    const timezone = condition.timezone || 'UTC';

    // Check allowed days
    if (condition.allowedDays) {
      const dayName = now.toLocaleDateString('en-US', {
        weekday: 'lowercase',
        timeZone: timezone,
      });

      if (!condition.allowedDays.includes(dayName)) {
        return false;
      }
    }

    // Check allowed hours
    if (condition.allowedHours) {
      const currentTime = now.toLocaleTimeString('en-US', {
        hour12: false,
        timeZone: timezone,
      });

      if (currentTime < condition.allowedHours.start || currentTime > condition.allowedHours.end) {
        return false;
      }
    }

    // Check blackout dates
    if (condition.blackoutDates) {
      const today = now.toDateString();
      if (condition.blackoutDates.some((date) => date.toDateString() === today)) {
        return false;
      }
    }

    return true;
  }

  private checkGeographicalCondition(
    condition: GeographicalCondition,
    context: AccessContext,
  ): boolean {
    // Check country restrictions
    if (context.location) {
      if (
        condition.allowedCountries &&
        !condition.allowedCountries.includes(context.location.country)
      ) {
        return false;
      }

      if (
        condition.deniedCountries &&
        condition.deniedCountries.includes(context.location.country)
      ) {
        return false;
      }
    }

    // Check IP restrictions
    if (context.ip) {
      if (condition.allowedIPs && !condition.allowedIPs.includes(context.ip)) {
        return false;
      }

      if (condition.deniedIPs && condition.deniedIPs.includes(context.ip)) {
        return false;
      }
    }

    // Check VPN requirement
    if (condition.requireVPN && !this.isVPNConnection(context.ip)) {
      return false;
    }

    return true;
  }

  private async evaluateConditionalExpression(
    condition: ConditionalExpression,
    user: User,
    request: AccessRequest,
  ): Promise<boolean> {
    // Simplified expression evaluation
    // In production, would use a proper expression evaluator

    const context = {
      user,
      request,
      ...condition.variables,
    };

    try {
      // This is simplified - use a proper sandboxed evaluator in production
      return true; // Placeholder
    } catch (error) {
      this.emit('evaluationError', { condition, error });
      return false;
    }
  }

  private checkComplianceRequirement(requirement: ComplianceRequirement, user: User): boolean {
    // Check if user meets compliance requirements
    // This would integrate with compliance management systems

    if (requirement.certificationExpiry && requirement.certificationExpiry < new Date()) {
      return false;
    }

    return true;
  }

  private async evaluatePermissions(user: User, request: AccessRequest): Promise<PermissionSet> {
    // Start with user's base permissions
    let permissions = this.clonePermissions(user.permissions);
    console.log(`Base user permissions:`, JSON.stringify(permissions.data.classification, null, 2));

    // Apply role-based permissions
    for (const role of user.roles) {
      permissions = this.mergePermissions(permissions, role.permissions);
    }
    console.log(
      `After role permissions:`,
      JSON.stringify(permissions.data.classification, null, 2),
    );

    // Apply hierarchical permissions
    permissions = await this.applyHierarchicalPermissions(permissions, user, request);
    console.log(
      `After hierarchical permissions:`,
      JSON.stringify(permissions.data.classification, null, 2),
    );

    // Apply resource-specific permissions
    permissions = await this.applyResourcePermissions(permissions, request.resource);
    console.log(
      `After resource permissions:`,
      JSON.stringify(permissions.data.classification, null, 2),
    );

    return permissions;
  }

  private async applyHierarchicalPermissions(
    permissions: PermissionSet,
    user: User,
    request: AccessRequest,
  ): Promise<PermissionSet> {
    for (const level of this.config.hierarchyLevels) {
      const levelPermissions = await this.getHierarchyPermissions(level, user);

      if (level.inheritFromParent) {
        permissions = this.mergePermissions(permissions, levelPermissions);
      }

      if (level.overrideChild) {
        permissions = this.overridePermissions(permissions, levelPermissions);
      }
    }

    return permissions;
  }

  private async getHierarchyPermissions(level: HierarchyLevel, user: User): Promise<PermissionSet> {
    // Get permissions for the hierarchy level
    // For now, return default permissions to avoid overriding user permissions with empty ones

    if (level.overrideChild) {
      // If this level should override, return the default permissions instead of empty ones
      return this.config.defaultPermissions;
    }

    return this.createEmptyPermissions();
  }

  private async applyResourcePermissions(
    permissions: PermissionSet,
    resource: ResourceIdentifier,
  ): Promise<PermissionSet> {
    // Apply resource-specific permission modifications
    // This could include owner permissions, shared permissions, etc.

    return permissions;
  }

  private async checkDataClassification(
    user: User,
    resource: ResourceIdentifier,
    permissions: PermissionSet,
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (!resource.classification) {
      return { allowed: true };
    }

    const userClassifications = permissions.data.classification;
    const hasAccess = userClassifications.some(
      (c) =>
        c.level === resource.classification!.level ||
        this.isHigherClassification(c.level, resource.classification!.level),
    );

    if (!hasAccess) {
      return {
        allowed: false,
        reason: `Insufficient clearance for ${resource.classification.level} data`,
      };
    }

    return { allowed: true };
  }

  private isHigherClassification(userLevel: string, resourceLevel: string): boolean {
    const levels = ['public', 'internal', 'confidential', 'restricted', 'secret'];
    return levels.indexOf(userLevel) >= levels.indexOf(resourceLevel);
  }

  private async determineDataModifications(
    user: User,
    resource: ResourceIdentifier,
    permissions: PermissionSet,
  ): Promise<DataModification[]> {
    const modifications: DataModification[] = [];

    // Check for fields that need masking
    if (permissions.data.excludedFields) {
      for (const field of permissions.data.excludedFields) {
        modifications.push({
          field,
          action: 'masked',
          reason: 'Field excluded by permissions',
        });
      }
    }

    // Check sensitivity levels
    for (const sensitivity of permissions.data.sensitivity) {
      if (sensitivity.accessLevel === 'masked') {
        modifications.push({
          field: sensitivity.type,
          action: 'masked',
          reason: `${sensitivity.type} requires masking`,
        });
      } else if (sensitivity.accessLevel === 'none') {
        modifications.push({
          field: sensitivity.type,
          action: 'removed',
          reason: `${sensitivity.type} access denied`,
        });
      }
    }

    return modifications;
  }

  // ========== GDPR Compliance Methods ==========

  enableGDPRCompliance(gdprConfig: GDPRCompliance): void {
    this.gdprCompliance = gdprConfig;
    this.emit('gdprEnabled', gdprConfig);
  }

  async validateGDPRCompliance(
    request: AccessRequest,
    user: User,
  ): Promise<{ compliant: boolean; violations: string[]; requirements: string[] }> {
    const violations: string[] = [];
    const requirements: string[] = [];

    if (!this.gdprCompliance?.enabled) {
      return { compliant: true, violations, requirements };
    }

    // Check data processing basis
    const dataTypes = this.extractDataTypes(request.resource);
    for (const dataType of dataTypes) {
      const basis = this.gdprCompliance.dataProcessingBasis.find((b) =>
        b.dataTypes.includes(dataType),
      );

      if (!basis) {
        violations.push(`No legal basis found for processing data type: ${dataType}`);
      } else if (basis.validUntil && basis.validUntil < new Date()) {
        violations.push(`Legal basis expired for data type: ${dataType}`);
      }
    }

    // Check consent if required
    if (this.gdprCompliance.consentManagement.required) {
      const consent = await this.checkUserConsent(user.id, dataTypes);
      if (!consent.valid) {
        violations.push('Valid consent required but not found');
      }
    }

    // Check retention policies
    const retentionCheck = await this.checkRetentionCompliance(request.resource);
    if (!retentionCheck.compliant) {
      violations.push(`Data retention policy violated: ${retentionCheck.reason}`);
    }

    // Right to erasure check
    if (this.gdprCompliance.rightToErasure && request.operation === 'delete') {
      requirements.push('Data must be permanently deleted per GDPR Article 17');
    }

    // Privacy by design check
    if (this.gdprCompliance.privacyByDesign) {
      const privacyCheck = this.checkPrivacyByDesign(request);
      if (!privacyCheck.compliant) {
        violations.push(`Privacy by design violation: ${privacyCheck.issue}`);
      }
    }

    return {
      compliant: violations.length === 0,
      violations,
      requirements,
    };
  }

  async handleGDPRDataSubjectRequest(
    type: 'access' | 'rectification' | 'erasure' | 'portability' | 'restriction',
    subjectId: string,
    details?: unknown,
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    if (!this.gdprCompliance?.enabled) {
      return { success: false, error: 'GDPR compliance not enabled' };
    }

    switch (type) {
      case 'access':
        return this.handleDataAccess(subjectId);

      case 'rectification':
        if (!this.gdprCompliance.rightToRectification) {
          return { success: false, error: 'Right to rectification not enabled' };
        }
        return this.handleDataRectification(subjectId, details);

      case 'erasure':
        if (!this.gdprCompliance.rightToErasure) {
          return { success: false, error: 'Right to erasure not enabled' };
        }
        return this.handleDataErasure(subjectId);

      case 'portability':
        if (!this.gdprCompliance.rightToPortability) {
          return { success: false, error: 'Right to portability not enabled' };
        }
        return this.handleDataPortability(subjectId);

      case 'restriction':
        return this.handleProcessingRestriction(subjectId, details);

      default:
        return { success: false, error: 'Invalid request type' };
    }
  }

  private async checkUserConsent(
    userId: string,
    dataTypes: string[],
  ): Promise<{ valid: boolean; consentDate?: Date; expiryDate?: Date }> {
    // Implementation would check consent management system
    // For now, returning mock implementation
    return {
      valid: true,
      consentDate: new Date(),
      expiryDate: this.gdprCompliance?.consentManagement.consentExpiry
        ? new Date(
            Date.now() + this.gdprCompliance.consentManagement.consentExpiry * 24 * 60 * 60 * 1000,
          )
        : undefined,
    };
  }

  private async checkRetentionCompliance(
    resource: ResourceIdentifier,
  ): Promise<{ compliant: boolean; reason?: string }> {
    // Check if data should be deleted based on retention policies
    const policies = this.gdprCompliance?.retentionPolicies || [];

    for (const policy of policies) {
      if (policy.retentionPeriod && policy.enforcementDate) {
        const cutoffDate = new Date(
          policy.enforcementDate.getTime() + policy.retentionPeriod * 24 * 60 * 60 * 1000,
        );
        if (new Date() > cutoffDate) {
          return {
            compliant: false,
            reason: `Data exceeds retention period of ${policy.retentionPeriod} days`,
          };
        }
      }
    }

    return { compliant: true };
  }

  private checkPrivacyByDesign(request: AccessRequest): { compliant: boolean; issue?: string } {
    // Check if request follows privacy by design principles
    if (request.operation === 'read' && !request.context?.mfaVerified) {
      return {
        compliant: false,
        issue: 'Multi-factor authentication required for data access',
      };
    }

    return { compliant: true };
  }

  private async handleDataAccess(
    subjectId: string,
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      const userData = this.users.get(subjectId);
      if (!userData) {
        return { success: false, error: 'User data not found' };
      }

      // Collect all data related to the subject
      const exportData = {
        personalData: userData,
        accessLogs: this.auditLog.filter((log) => log.userId === subjectId),
        processingActivities: this.getProcessingActivities(subjectId),
      };

      return { success: true, data: exportData };
    } catch (error) {
      return { success: false, error: 'Failed to retrieve data' };
    }
  }

  private async handleDataRectification(
    subjectId: string,
    updates: unknown,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.updateUser(subjectId, updates);
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to update data' };
    }
  }

  private async handleDataErasure(
    subjectId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.deleteUser(subjectId);

      // Remove from audit logs (careful - may need to anonymize instead)
      this.auditLog = this.auditLog.map((entry) =>
        entry.userId === subjectId ? { ...entry, userId: 'ANONYMIZED' } : entry,
      );

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to erase data' };
    }
  }

  private async handleDataPortability(
    subjectId: string,
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const accessResult = await this.handleDataAccess(subjectId);
    if (!accessResult.success) {
      return accessResult;
    }

    // Format data for portability (machine-readable format)
    const portableData = {
      format: 'JSON',
      version: '1.0',
      exported: new Date().toISOString(),
      data: accessResult.data,
    };

    return { success: true, data: portableData };
  }

  private async handleProcessingRestriction(
    subjectId: string,
    details: unknown,
  ): Promise<{ success: boolean; error?: string }> {
    // Add processing restriction to user
    const user = this.users.get(subjectId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const restriction: AccessRestriction = {
      type: 'gdpr_processing_restriction',
      reason: details.reason || 'Data subject requested processing restriction',
      startTime: new Date(),
      conditions: details.conditions || [],
    };

    user.restrictions = user.restrictions || [];
    user.restrictions.push(restriction);

    return { success: true };
  }

  // ========== HIPAA Compliance Methods ==========

  enableHIPAACompliance(hipaaConfig: HIPAACompliance): void {
    this.hipaaCompliance = hipaaConfig;
    this.emit('hipaaEnabled', hipaaConfig);
  }

  async validateHIPAACompliance(
    request: AccessRequest,
    user: User,
  ): Promise<{ compliant: boolean; violations: string[]; requirements: string[] }> {
    const violations: string[] = [];
    const requirements: string[] = [];

    if (!this.hipaaCompliance?.enabled) {
      return { compliant: true, violations, requirements };
    }

    // Check if accessing PHI
    const isPHI = this.isPHIData(request.resource);
    if (!isPHI) {
      return { compliant: true, violations, requirements };
    }

    // Minimum necessary standard
    if (this.hipaaCompliance.phi.minimumNecessary && request.operation === 'read') {
      const minimumCheck = this.checkMinimumNecessary(request, user);
      if (!minimumCheck.compliant) {
        violations.push(`Minimum necessary standard violated: ${minimumCheck.reason}`);
      }
    }

    // Access control requirements
    if (this.hipaaCompliance.technicalSafeguards.accessControl) {
      const accessControlCheck = this.checkHIPAAAccessControl(user, request);
      if (!accessControlCheck.compliant) {
        violations.push(`HIPAA access control violation: ${accessControlCheck.reason}`);
      }
    }

    // Audit controls
    if (this.hipaaCompliance.auditControls) {
      requirements.push('All PHI access must be logged per HIPAA Security Rule');
    }

    // Encryption requirements
    if (
      this.hipaaCompliance.technicalSafeguards.encryption.atRest &&
      request.operation === 'write'
    ) {
      requirements.push('Data must be encrypted at rest per HIPAA Security Rule');
    }

    if (this.hipaaCompliance.technicalSafeguards.encryption.inTransit) {
      requirements.push('Data transmission must be encrypted per HIPAA Security Rule');
    }

    // Authentication requirements
    if (!request.context?.mfaVerified) {
      violations.push('Multi-factor authentication required for PHI access');
    }

    return {
      compliant: violations.length === 0,
      violations,
      requirements,
    };
  }

  async handleHIPAABreach(breachDetails: {
    description: string;
    dataInvolved: string[];
    individualsAffected: number;
    discoveryDate: Date;
    cause: string;
  }): Promise<{ success: boolean; notifications: string[]; error?: string }> {
    if (!this.hipaaCompliance?.enabled || !this.hipaaCompliance.breachNotification.enabled) {
      return { success: false, error: 'HIPAA breach notification not enabled' };
    }

    const notifications: string[] = [];

    try {
      // Notify authorities if required (> 500 individuals or significant risk)
      if (breachDetails.individualsAffected > 500) {
        notifications.push('HHS Secretary notified within 60 days');
        notifications.push('Media notification required');
      }

      // Individual notification
      if (this.hipaaCompliance.breachNotification.individuals) {
        notifications.push(
          `${breachDetails.individualsAffected} individuals must be notified within 60 days`,
        );
      }

      // Create audit entry for breach
      const auditEntry: AuditEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        userId: 'SYSTEM',
        action: 'HIPAA_BREACH_REPORTED',
        resource: {
          type: 'configuration',
          id: 'breach_notification',
        },
        decision: 'granted',
        reason: breachDetails.description,
        context: {
          sessionId: 'breach_notification',
        },
        modifications: [],
      };

      this.auditLog.push(auditEntry);

      this.emit('hipaaBreachReported', {
        breachDetails,
        notifications,
        auditEntry,
      });

      return { success: true, notifications };
    } catch (error) {
      return { success: false, error: 'Failed to process HIPAA breach notification' };
    }
  }

  private isPHIData(resource: ResourceIdentifier): boolean {
    // Check if resource contains PHI based on classification or patterns
    const phiIdentifiers = this.hipaaCompliance?.phi.identifiers || [];

    return (
      resource.classification?.level === 'confidential' ||
      resource.path?.includes('/phi/') ||
      phiIdentifiers.some((identifier) => resource.path?.includes(identifier))
    );
  }

  private checkMinimumNecessary(
    request: AccessRequest,
    user: User,
  ): { compliant: boolean; reason?: string } {
    // Check if user role requires full access to PHI
    const hasFullPHIAccess = user.roles.some(
      (role) =>
        role.name.includes('Physician') ||
        role.name.includes('Nurse') ||
        role.name.includes('Admin'),
    );

    if (!hasFullPHIAccess && request.operation === 'read') {
      return {
        compliant: false,
        reason: 'User role does not justify full PHI access - minimum necessary standard',
      };
    }

    return { compliant: true };
  }

  private checkHIPAAAccessControl(
    user: User,
    request: AccessRequest,
  ): { compliant: boolean; reason?: string } {
    // Check if user has appropriate clearance for PHI
    const clearanceLevel = user.attributes.clearanceLevel;

    if (clearanceLevel !== 'confidential' && clearanceLevel !== 'secret') {
      return {
        compliant: false,
        reason: 'Insufficient clearance level for PHI access',
      };
    }

    // Check if user has completed required training
    const hasRequiredTraining = user.attributes.customAttributes?.hipaaTrainingCompleted;
    if (!hasRequiredTraining) {
      return {
        compliant: false,
        reason: 'HIPAA training required before PHI access',
      };
    }

    return { compliant: true };
  }

  private extractDataTypes(resource: ResourceIdentifier): string[] {
    // Extract data types from resource metadata
    const dataTypes: string[] = [];

    if (resource.path) {
      if (resource.path.includes('/personal/')) {dataTypes.push('personal');}
      if (resource.path.includes('/financial/')) {dataTypes.push('financial');}
      if (resource.path.includes('/health/')) {dataTypes.push('health');}
      if (resource.path.includes('/phi/')) {dataTypes.push('phi');}
    }

    return dataTypes;
  }

  private getProcessingActivities(userId: string): unknown[] {
    // Get all processing activities for a user
    return this.auditLog
      .filter((log) => log.userId === userId)
      .map((log) => ({
        activity: log.action,
        timestamp: log.timestamp,
        resource: log.resource,
        purpose: 'Memory system access',
      }));
  }

  // ========== User & Role Management ==========

  async createUser(userData: Omit<User, 'id'>): Promise<string> {
    const userId = this.generateUserId();

    const user: User = {
      ...userData,
      id: userId,
    };

    this.users.set(userId, user);

    this.emit('userCreated', { userId, user });

    return userId;
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const updatedUser = { ...user, ...updates };
    this.users.set(userId, updatedUser);

    // Invalidate cache for this user
    this.invalidateUserCache(userId);

    this.emit('userUpdated', { userId, updates });
  }

  async deleteUser(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    this.users.delete(userId);

    // Invalidate cache for this user
    this.invalidateUserCache(userId);

    this.emit('userDeleted', { userId });
  }

  async createRole(roleData: Omit<Role, 'id'>): Promise<string> {
    const roleId = this.generateRoleId();

    const role: Role = {
      ...roleData,
      id: roleId,
    };

    this.roles.set(roleId, role);

    this.emit('roleCreated', { roleId, role });

    return roleId;
  }

  async assignRole(userId: string, roleId: string): Promise<void> {
    const user = this.users.get(userId);
    const role = this.roles.get(roleId);

    if (!user) {throw new Error(`User not found: ${userId}`);}
    if (!role) {throw new Error(`Role not found: ${roleId}`);}

    if (!user.roles.some((r) => r.id === roleId)) {
      user.roles.push(role);

      // Invalidate cache for this user
      this.invalidateUserCache(userId);

      this.emit('roleAssigned', { userId, roleId });
    }
  }

  async revokeRole(userId: string, roleId: string): Promise<void> {
    const user = this.users.get(userId);

    if (!user) {throw new Error(`User not found: ${userId}`);}

    user.roles = user.roles.filter((r) => r.id !== roleId);

    // Invalidate cache for this user
    this.invalidateUserCache(userId);

    this.emit('roleRevoked', { userId, roleId });
  }

  // ========== Utility Methods ==========

  private initializeCache(): AccessCache {
    return {
      decisions: new Map(),
      maxSize: 10000,
      ttl: 300000, // 5 minutes default
      hitRate: 0,
      missRate: 0,
    };
  }

  private initializeDefaultRoles(): void {
    // Create default system roles
    const defaultRoles: Omit<Role, 'id'>[] = [
      {
        name: 'admin',
        level: 'system',
        permissions: this.createAdminPermissions(),
        priority: 100,
        inherited: false,
      },
      {
        name: 'user',
        level: 'system',
        permissions: this.createUserPermissions(),
        priority: 10,
        inherited: true,
      },
      {
        name: 'guest',
        level: 'system',
        permissions: this.createGuestPermissions(),
        priority: 1,
        inherited: true,
      },
    ];

    for (const roleData of defaultRoles) {
      this.createRole(roleData);
    }
  }

  private createAdminPermissions(): PermissionSet {
    return {
      memory: {
        read: [{ type: 'global' }],
        write: [{ type: 'global' }],
        delete: [{ type: 'global' }],
        share: [{ type: 'global' }],
        export: [{ type: 'global' }],
      },
      data: {
        classification: [
          {
            level: 'secret',
            handling: 'standard',
            retention: { duration: 365 },
          },
        ],
        sensitivity: [],
        categories: ['*'],
        tags: ['*'],
      },
      operations: {
        query: { maxResults: undefined, maxDepth: undefined },
        analyze: {
          algorithms: ['*'],
          mlModels: ['*'],
          aggregations: ['*'],
          exports: [{ format: 'json' }, { format: 'csv' }],
        },
        modify: {
          create: true,
          update: true,
          delete: true,
          bulkOperations: true,
        },
        integrate: {
          apis: ['*'],
          webhooks: ['*'],
          external: [],
        },
      },
      administration: {
        manageUsers: true,
        manageRoles: true,
        managePermissions: true,
        viewAudit: true,
        configureSystem: true,
        emergencyAccess: true,
      },
    };
  }

  private createUserPermissions(): PermissionSet {
    return {
      memory: {
        read: [{ type: 'personal' }, { type: 'team' }, { type: 'project' }],
        write: [{ type: 'personal' }, { type: 'team' }],
        delete: [{ type: 'personal' }],
        share: [{ type: 'personal' }],
        export: [{ type: 'personal' }],
      },
      data: {
        classification: [
          {
            level: 'internal',
            handling: 'standard',
            retention: { duration: 90 },
          },
        ],
        sensitivity: [
          {
            type: 'pii',
            accessLevel: 'masked',
            auditRequired: true,
          },
        ],
        categories: ['general'],
        tags: [],
      },
      operations: {
        query: { maxResults: 1000, maxDepth: 3 },
        analyze: {
          algorithms: ['basic'],
          mlModels: [],
          aggregations: ['count', 'sum', 'average'],
          exports: [{ format: 'json', maxSize: 10 }],
        },
        modify: {
          create: true,
          update: true,
          delete: false,
          bulkOperations: false,
        },
        integrate: {
          apis: [],
          webhooks: [],
          external: [],
        },
      },
      administration: {
        manageUsers: false,
        manageRoles: false,
        managePermissions: false,
        viewAudit: false,
        configureSystem: false,
        emergencyAccess: false,
      },
    };
  }

  private createGuestPermissions(): PermissionSet {
    return {
      memory: {
        read: [{ type: 'personal', timeRange: { rolling: 7 } }],
        write: [],
        delete: [],
        share: [],
        export: [],
      },
      data: {
        classification: [
          {
            level: 'public',
            handling: 'standard',
            retention: { duration: 7 },
          },
        ],
        sensitivity: [
          {
            type: 'pii',
            accessLevel: 'none',
            auditRequired: true,
          },
        ],
        categories: ['public'],
        tags: [],
      },
      operations: {
        query: { maxResults: 100, maxDepth: 1, timeLimit: 10 },
        analyze: {
          algorithms: [],
          mlModels: [],
          aggregations: ['count'],
          exports: [],
        },
        modify: {
          create: false,
          update: false,
          delete: false,
          bulkOperations: false,
        },
        integrate: {
          apis: [],
          webhooks: [],
          external: [],
        },
      },
      administration: {
        manageUsers: false,
        manageRoles: false,
        managePermissions: false,
        viewAudit: false,
        configureSystem: false,
        emergencyAccess: false,
      },
    };
  }

  private createEmptyPermissions(): PermissionSet {
    return {
      memory: {
        read: [],
        write: [],
        delete: [],
        share: [],
        export: [],
      },
      data: {
        classification: [],
        sensitivity: [],
        categories: [],
        tags: [],
      },
      operations: {
        query: {},
        analyze: { algorithms: [], mlModels: [], aggregations: [], exports: [] },
        modify: {
          create: false,
          update: false,
          delete: false,
          bulkOperations: false,
        },
        integrate: {
          apis: [],
          webhooks: [],
          external: [],
        },
      },
      administration: {
        manageUsers: false,
        manageRoles: false,
        managePermissions: false,
        viewAudit: false,
        configureSystem: false,
        emergencyAccess: false,
      },
    };
  }

  private clonePermissions(permissions: PermissionSet): PermissionSet {
    return JSON.parse(JSON.stringify(permissions));
  }

  private mergePermissions(base: PermissionSet, additional: PermissionSet): PermissionSet {
    // Merge two permission sets, taking the more permissive option
    const merged = this.clonePermissions(base);

    // Merge memory permissions
    merged.memory.read.push(...additional.memory.read);
    merged.memory.write.push(...additional.memory.write);
    merged.memory.delete.push(...additional.memory.delete);
    merged.memory.share.push(...additional.memory.share);
    merged.memory.export.push(...additional.memory.export);

    // Merge data permissions
    merged.data.classification.push(...additional.data.classification);
    merged.data.sensitivity.push(...additional.data.sensitivity);
    merged.data.categories.push(...additional.data.categories);
    merged.data.tags.push(...additional.data.tags);

    // Merge operation permissions (taking more permissive)
    if (additional.operations.query.maxResults) {
      merged.operations.query.maxResults = Math.max(
        merged.operations.query.maxResults || 0,
        additional.operations.query.maxResults,
      );
    }

    merged.operations.modify.create =
      merged.operations.modify.create || additional.operations.modify.create;
    merged.operations.modify.update =
      merged.operations.modify.update || additional.operations.modify.update;
    merged.operations.modify.delete =
      merged.operations.modify.delete || additional.operations.modify.delete;

    // Merge admin permissions
    merged.administration.manageUsers =
      merged.administration.manageUsers || additional.administration.manageUsers;
    merged.administration.manageRoles =
      merged.administration.manageRoles || additional.administration.manageRoles;
    merged.administration.viewAudit =
      merged.administration.viewAudit || additional.administration.viewAudit;

    return merged;
  }

  private overridePermissions(base: PermissionSet, override: PermissionSet): PermissionSet {
    // Override base permissions with more restrictive permissions
    return override; // Simplified - would implement proper override logic
  }

  private generateCacheKey(request: AccessRequest): string {
    return crypto
      .createHash('sha256')
      .update(
        `${request.userId}:${request.resource.type}:${request.resource.id}:${request.operation}`,
      )
      .digest('hex');
  }

  private cacheDecision(key: string, decision: AccessDecision): void {
    // Implement LRU cache eviction if needed
    if (this.cache.decisions.size >= this.cache.maxSize) {
      const firstKey = this.cache.decisions.keys().next().value;
      this.cache.decisions.delete(firstKey);
    }

    this.cache.decisions.set(key, {
      decision,
      expires: new Date(Date.now() + (decision.ttl || this.cache.ttl)),
      hits: 0,
      created: new Date(),
    });
  }

  private invalidateUserCache(userId: string): void {
    // Remove all cached decisions for this user
    for (const [key, cached] of this.cache.decisions) {
      if (cached.decision.requestId.includes(userId)) {
        this.cache.decisions.delete(key);
      }
    }
  }

  private calculateTTL(permissions: PermissionSet): number {
    // Calculate appropriate TTL based on permission sensitivity
    if (permissions.administration.emergencyAccess) {
      return 60000; // 1 minute for emergency access
    }

    if (permissions.data.classification.some((c) => c.level === 'secret')) {
      return 180000; // 3 minutes for secret data
    }

    return 300000; // 5 minutes default
  }

  private createDeniedDecision(request: AccessRequest, reason: string): AccessDecision {
    return {
      requestId: request.id,
      granted: false,
      reason,
      audit: this.createAuditEntry(request, 'denied', reason),
    };
  }

  private createAuditEntry(
    request: AccessRequest,
    decision: 'granted' | 'denied' | 'partial',
    reason?: string,
    modifications?: DataModification[],
    duration?: number,
  ): AuditEntry {
    return {
      id: this.generateAuditId(),
      timestamp: new Date(),
      userId: request.userId,
      action: request.operation,
      resource: request.resource,
      decision,
      reason,
      context: request.context,
      duration,
      modifications,
    };
  }

  private isVPNConnection(ip?: string): boolean {
    // Check if IP is from VPN
    // This would integrate with VPN detection services
    return false; // Placeholder
  }

  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateRoleId(): string {
    return `role_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateEncryptionKey(): Buffer {
    return crypto.randomBytes(32);
  }

  // ========== Public API ==========

  getUser(userId: string): User | undefined {
    return this.users.get(userId);
  }

  getRole(roleId: string): Role | undefined {
    return this.roles.get(roleId);
  }

  getAuditLog(filters?: {
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    decision?: string;
  }): AuditEntry[] {
    let logs = [...this.auditLog];

    if (filters?.userId) {
      logs = logs.filter((l) => l.userId === filters.userId);
    }

    if (filters?.startDate) {
      logs = logs.filter((l) => l.timestamp >= filters.startDate!);
    }

    if (filters?.endDate) {
      logs = logs.filter((l) => l.timestamp <= filters.endDate!);
    }

    if (filters?.decision) {
      logs = logs.filter((l) => l.decision === filters.decision);
    }

    return logs;
  }

  getCacheStatistics(): {
    size: number;
    hitRate: number;
    missRate: number;
    efficiency: number;
  } {
    const total = this.cache.hitRate + this.cache.missRate;

    return {
      size: this.cache.decisions.size,
      hitRate: this.cache.hitRate,
      missRate: this.cache.missRate,
      efficiency: total > 0 ? this.cache.hitRate / total : 0,
    };
  }

  async exportConfiguration(): Promise<string> {
    return JSON.stringify(
      {
        config: this.config,
        roles: Array.from(this.roles.entries()),
        statistics: this.getCacheStatistics(),
        exportedAt: new Date().toISOString(),
      },
      null,
      2,
    );
  }

  async importConfiguration(data: string): Promise<void> {
    const imported = JSON.parse(data);

    if (imported.config) {
      this.config = imported.config;
    }

    if (imported.roles) {
      this.roles = new Map(imported.roles);
    }

    this.emit('configurationImported', { importedAt: new Date() });
  }
}

// ========== Policy Engine ==========

class PolicyEngine {
  private config: AccessControlConfig;

  constructor(config: AccessControlConfig) {
    this.config = config;
  }

  evaluatePolicy(policy: string, context: Record<string, unknown>): boolean {
    // Evaluate policy expressions
    // This would use a proper policy language in production
    return true; // Placeholder
  }

  validatePolicy(policy: string): { valid: boolean; errors?: string[] } {
    // Validate policy syntax
    return { valid: true };
  }
}

export default AccessControlManager;
