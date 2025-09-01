#!/usr/bin/env node
/**
 * ACLFilter.js
 * Access Control List filtering for search results
 * Ensures users only see documents they have permission to access
 */

import crypto from 'crypto';
import { performance } from 'perf_hooks';

class ACLFilter {
  constructor(config = {}) {
    this.config = {
      // ACL sources
      ldapUrl: config.ldapUrl || process.env.POC_LDAP_URL,
      adUrl: config.adUrl || process.env.POC_AD_URL,
      authProvider: config.authProvider || 'internal', // 'ldap', 'ad', 'oauth', 'internal'
      
      // SharePoint/Box specific
      sharepointGraphUrl: config.sharepointGraphUrl || 'https://graph.microsoft.com/v1.0',
      boxApiUrl: config.boxApiUrl || 'https://api.box.com/2.0',
      
      // Caching
      cacheEnabled: config.cacheEnabled !== false,
      cacheTTL: config.cacheTTL || 300000, // 5 minutes
      maxCacheSize: config.maxCacheSize || 10000,
      
      // Security
      encryptCache: config.encryptCache !== false,
      auditEnabled: config.auditEnabled !== false,
      
      // Performance
      batchSize: config.batchSize || 100,
      parallel: config.parallel !== false,
      timeout: config.timeout || 5000
    };
    
    // User/Group cache
    this.userCache = new Map();
    this.groupCache = new Map();
    this.permissionCache = new Map();
    
    // Audit log
    this.auditLog = [];
    
    // Metrics
    this.metrics = {
      totalFilters: 0,
      documentsChecked: 0,
      documentsAllowed: 0,
      documentsBlocked: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgLatency: 0
    };
    
    // Encryption key for cache
    if (this.config.encryptCache) {
      this.encryptionKey = crypto.randomBytes(32);
      this.encryptionIV = crypto.randomBytes(16);
    }
  }

  /**
   * Filter search results based on user permissions
   */
  async filter(results, userContext, options = {}) {
    const startTime = performance.now();
    this.metrics.totalFilters++;
    
    try {
      // Validate user context
      if (!this.validateUserContext(userContext)) {
        throw new Error('Invalid user context');
      }
      
      // Get user's effective permissions
      const userPermissions = await this.getUserPermissions(userContext);
      
      // Process results in batches
      const filteredResults = await this.filterInBatches(
        results,
        userPermissions,
        options
      );
      
      // Audit the access
      if (this.config.auditEnabled) {
        this.auditAccess(userContext, results, filteredResults);
      }
      
      // Update metrics
      const latency = performance.now() - startTime;
      this.updateMetrics(results.length, filteredResults.length, latency);
      
      return {
        results: filteredResults,
        metadata: {
          totalResults: results.length,
          allowedResults: filteredResults.length,
          blockedResults: results.length - filteredResults.length,
          filterTime: latency,
          userGroups: userPermissions.groups,
          effectivePermissions: userPermissions.permissions.length
        }
      };
      
    } catch (error) {
      console.error('ACL filtering failed:', error);
      
      // Fail-safe: return empty results on error
      if (options.failSafe !== false) {
        return {
          results: [],
          metadata: {
            error: error.message,
            failSafeActivated: true
          }
        };
      }
      
      throw error;
    }
  }

  /**
   * Validate user context
   */
  validateUserContext(userContext) {
    if (!userContext) return false;
    
    // Required fields
    if (!userContext.userId && !userContext.email) {
      return false;
    }
    
    // Validate format
    if (userContext.email && !this.isValidEmail(userContext.email)) {
      return false;
    }
    
    return true;
  }

  /**
   * Get user's effective permissions
   */
  async getUserPermissions(userContext) {
    const cacheKey = this.getUserCacheKey(userContext);
    
    // Check cache
    if (this.config.cacheEnabled && this.permissionCache.has(cacheKey)) {
      const cached = this.permissionCache.get(cacheKey);
      
      if (Date.now() - cached.timestamp < this.config.cacheTTL) {
        this.metrics.cacheHits++;
        return this.decryptCacheEntry(cached.data);
      }
    }
    
    this.metrics.cacheMisses++;
    
    // Fetch fresh permissions
    const permissions = {
      userId: userContext.userId,
      email: userContext.email,
      groups: await this.getUserGroups(userContext),
      permissions: await this.getDirectPermissions(userContext),
      roles: await this.getUserRoles(userContext)
    };
    
    // Expand group permissions
    for (const group of permissions.groups) {
      const groupPerms = await this.getGroupPermissions(group);
      permissions.permissions.push(...groupPerms);
    }
    
    // Deduplicate permissions
    permissions.permissions = [...new Set(permissions.permissions)];
    
    // Cache the result
    if (this.config.cacheEnabled) {
      this.cacheUserPermissions(cacheKey, permissions);
    }
    
    return permissions;
  }

  /**
   * Get user groups
   */
  async getUserGroups(userContext) {
    switch (this.config.authProvider) {
      case 'ldap':
        return this.getLDAPGroups(userContext);
      case 'ad':
        return this.getADGroups(userContext);
      case 'oauth':
        return this.getOAuthGroups(userContext);
      case 'internal':
      default:
        return this.getInternalGroups(userContext);
    }
  }

  /**
   * Get internal groups (mock implementation)
   */
  async getInternalGroups(userContext) {
    // Mock implementation - replace with actual database lookup
    const mockGroups = {
      'admin@example.com': ['admins', 'users', 'project-a'],
      'user1@example.com': ['users', 'project-a', 'project-b'],
      'user2@example.com': ['users', 'project-b'],
      'guest@example.com': ['guests']
    };
    
    return mockGroups[userContext.email] || ['users'];
  }

  /**
   * Get direct permissions for user
   */
  async getDirectPermissions(userContext) {
    // Mock implementation - replace with actual permission lookup
    const mockPermissions = {
      'admin@example.com': ['read:*', 'write:*'],
      'user1@example.com': ['read:sharepoint/*', 'read:box/*'],
      'user2@example.com': ['read:database/*'],
      'guest@example.com': ['read:public/*']
    };
    
    return mockPermissions[userContext.email] || [];
  }

  /**
   * Get user roles
   */
  async getUserRoles(userContext) {
    // Mock implementation
    const mockRoles = {
      'admin@example.com': ['admin', 'user'],
      'user1@example.com': ['user', 'analyst'],
      'user2@example.com': ['user'],
      'guest@example.com': ['guest']
    };
    
    return mockRoles[userContext.email] || ['user'];
  }

  /**
   * Get group permissions
   */
  async getGroupPermissions(groupName) {
    // Check cache
    if (this.groupCache.has(groupName)) {
      const cached = this.groupCache.get(groupName);
      if (Date.now() - cached.timestamp < this.config.cacheTTL) {
        return cached.permissions;
      }
    }
    
    // Mock implementation - replace with actual group permission lookup
    const mockGroupPermissions = {
      'admins': ['read:*', 'write:*', 'delete:*'],
      'users': ['read:documents/*', 'read:public/*'],
      'project-a': ['read:project-a/*', 'write:project-a/drafts/*'],
      'project-b': ['read:project-b/*'],
      'guests': ['read:public/*']
    };
    
    const permissions = mockGroupPermissions[groupName] || [];
    
    // Cache the result
    this.groupCache.set(groupName, {
      permissions,
      timestamp: Date.now()
    });
    
    return permissions;
  }

  /**
   * Filter results in batches
   */
  async filterInBatches(results, userPermissions, options) {
    const batchSize = this.config.batchSize;
    const batches = [];
    
    // Split into batches
    for (let i = 0; i < results.length; i += batchSize) {
      batches.push(results.slice(i, i + batchSize));
    }
    
    // Process batches
    let filteredResults = [];
    
    if (this.config.parallel) {
      // Parallel processing
      const batchPromises = batches.map(batch => 
        this.filterBatch(batch, userPermissions, options)
      );
      
      const batchResults = await Promise.all(batchPromises);
      filteredResults = batchResults.flat();
      
    } else {
      // Sequential processing
      for (const batch of batches) {
        const batchResults = await this.filterBatch(batch, userPermissions, options);
        filteredResults.push(...batchResults);
      }
    }
    
    return filteredResults;
  }

  /**
   * Filter a single batch of results
   */
  async filterBatch(batch, userPermissions, options) {
    const filtered = [];
    
    for (const result of batch) {
      this.metrics.documentsChecked++;
      
      // Check if user has access to this document
      const hasAccess = await this.checkAccess(result, userPermissions, options);
      
      if (hasAccess) {
        this.metrics.documentsAllowed++;
        
        // Optionally redact sensitive fields
        const redacted = options.redact 
          ? this.redactSensitiveFields(result, userPermissions)
          : result;
        
        filtered.push(redacted);
      } else {
        this.metrics.documentsBlocked++;
        
        // Log blocked access if verbose
        if (options.verbose) {
          console.log(`Access denied for user ${userPermissions.userId} to document ${result.id}`);
        }
      }
    }
    
    return filtered;
  }

  /**
   * Check if user has access to a specific document
   */
  async checkAccess(document, userPermissions, options) {
    // Extract document ACL
    const documentAcl = this.extractDocumentAcl(document);
    
    // Check for explicit deny
    if (this.hasExplicitDeny(documentAcl, userPermissions)) {
      return false;
    }
    
    // Check for explicit allow
    if (this.hasExplicitAllow(documentAcl, userPermissions)) {
      return true;
    }
    
    // Check permission patterns
    const documentPath = this.getDocumentPath(document);
    
    for (const permission of userPermissions.permissions) {
      if (this.matchPermission(permission, documentPath)) {
        return true;
      }
    }
    
    // Check role-based access
    if (options.checkRoles !== false) {
      for (const role of userPermissions.roles) {
        if (this.checkRoleAccess(role, document)) {
          return true;
        }
      }
    }
    
    // Default deny
    return false;
  }

  /**
   * Extract ACL from document
   */
  extractDocumentAcl(document) {
    // Look for ACL in various locations
    const acl = document.acl || 
                document.metadata?.acl || 
                document.permissions ||
                {};
    
    return {
      users: acl.users || [],
      groups: acl.groups || [],
      deny_users: acl.deny_users || [],
      deny_groups: acl.deny_groups || [],
      public: acl.public || false
    };
  }

  /**
   * Check for explicit deny
   */
  hasExplicitDeny(documentAcl, userPermissions) {
    // Check user deny list
    if (documentAcl.deny_users.includes(userPermissions.userId) ||
        documentAcl.deny_users.includes(userPermissions.email)) {
      return true;
    }
    
    // Check group deny list
    for (const group of userPermissions.groups) {
      if (documentAcl.deny_groups.includes(group)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check for explicit allow
   */
  hasExplicitAllow(documentAcl, userPermissions) {
    // Check if public
    if (documentAcl.public) {
      return true;
    }
    
    // Check user allow list
    if (documentAcl.users.includes(userPermissions.userId) ||
        documentAcl.users.includes(userPermissions.email)) {
      return true;
    }
    
    // Check group allow list
    for (const group of userPermissions.groups) {
      if (documentAcl.groups.includes(group)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get document path for permission matching
   */
  getDocumentPath(document) {
    return document.path || 
           document.metadata?.path || 
           `${document.source}/${document.id}`;
  }

  /**
   * Match permission pattern against document path
   */
  matchPermission(permission, documentPath) {
    // Parse permission (e.g., "read:sharepoint/project-a/*")
    const [action, pattern] = permission.split(':');
    
    if (!pattern || pattern === '*') {
      return true; // Wildcard permission
    }
    
    // Convert pattern to regex
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\//g, '\\/');
    
    const regex = new RegExp(`^${regexPattern}$`);
    
    return regex.test(documentPath);
  }

  /**
   * Check role-based access
   */
  checkRoleAccess(role, document) {
    // Define role permissions
    const rolePermissions = {
      'admin': () => true, // Admin can access everything
      'user': (doc) => !doc.metadata?.restricted,
      'analyst': (doc) => doc.metadata?.category !== 'confidential',
      'guest': (doc) => doc.metadata?.public === true
    };
    
    const checkFn = rolePermissions[role];
    return checkFn ? checkFn(document) : false;
  }

  /**
   * Redact sensitive fields based on permissions
   */
  redactSensitiveFields(document, userPermissions) {
    const redacted = { ...document };
    
    // Define sensitive fields by role
    const sensitiveFields = {
      'guest': ['metadata.author', 'metadata.created_by', 'metadata.internal_notes'],
      'user': ['metadata.internal_notes'],
      'analyst': [],
      'admin': []
    };
    
    // Get fields to redact based on highest role
    const userRole = this.getHighestRole(userPermissions.roles);
    const fieldsToRedact = sensitiveFields[userRole] || sensitiveFields['guest'];
    
    // Redact fields
    for (const field of fieldsToRedact) {
      this.deleteNestedField(redacted, field);
    }
    
    return redacted;
  }

  /**
   * Get highest role from list
   */
  getHighestRole(roles) {
    const roleHierarchy = ['admin', 'analyst', 'user', 'guest'];
    
    for (const role of roleHierarchy) {
      if (roles.includes(role)) {
        return role;
      }
    }
    
    return 'guest';
  }

  /**
   * Delete nested field from object
   */
  deleteNestedField(obj, path) {
    const parts = path.split('.');
    const last = parts.pop();
    
    let current = obj;
    for (const part of parts) {
      if (current[part] === undefined) {
        return;
      }
      current = current[part];
    }
    
    delete current[last];
  }

  /**
   * Audit access attempt
   */
  auditAccess(userContext, originalResults, filteredResults) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      userId: userContext.userId,
      email: userContext.email,
      action: 'search_filter',
      totalDocuments: originalResults.length,
      allowedDocuments: filteredResults.length,
      blockedDocuments: originalResults.length - filteredResults.length,
      blockedIds: originalResults
        .filter(r => !filteredResults.find(f => f.id === r.id))
        .map(r => r.id)
        .slice(0, 10) // Limit to first 10 for brevity
    };
    
    this.auditLog.push(auditEntry);
    
    // Rotate audit log if too large
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-5000);
    }
    
    // Optionally send to external audit system
    if (process.env.AUDIT_WEBHOOK_URL) {
      this.sendAuditToWebhook(auditEntry);
    }
  }

  /**
   * Send audit entry to webhook
   */
  async sendAuditToWebhook(auditEntry) {
    try {
      await fetch(process.env.AUDIT_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(auditEntry)
      });
    } catch (error) {
      console.error('Failed to send audit entry:', error);
    }
  }

  /**
   * Cache user permissions
   */
  cacheUserPermissions(cacheKey, permissions) {
    const encrypted = this.config.encryptCache 
      ? this.encryptCacheEntry(permissions)
      : permissions;
    
    this.permissionCache.set(cacheKey, {
      data: encrypted,
      timestamp: Date.now()
    });
    
    // Enforce cache size limit
    if (this.permissionCache.size > this.config.maxCacheSize) {
      // Remove oldest entries
      const toRemove = this.permissionCache.size - this.config.maxCacheSize;
      const keys = Array.from(this.permissionCache.keys());
      
      for (let i = 0; i < toRemove; i++) {
        this.permissionCache.delete(keys[i]);
      }
    }
  }

  /**
   * Encrypt cache entry
   */
  encryptCacheEntry(data) {
    if (!this.config.encryptCache) return data;
    
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      this.encryptionKey,
      this.encryptionIV
    );
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return encrypted;
  }

  /**
   * Decrypt cache entry
   */
  decryptCacheEntry(encrypted) {
    if (!this.config.encryptCache) return encrypted;
    
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      this.encryptionKey,
      this.encryptionIV
    );
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }

  /**
   * Update metrics
   */
  updateMetrics(totalDocs, allowedDocs, latency) {
    this.metrics.documentsChecked += totalDocs;
    this.metrics.documentsAllowed += allowedDocs;
    this.metrics.documentsBlocked += (totalDocs - allowedDocs);
    
    // Update average latency
    const totalLatency = this.metrics.avgLatency * (this.metrics.totalFilters - 1) + latency;
    this.metrics.avgLatency = totalLatency / this.metrics.totalFilters;
  }

  /**
   * Get user cache key
   */
  getUserCacheKey(userContext) {
    return userContext.userId || userContext.email || 'anonymous';
  }

  /**
   * Validate email format
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheHitRate: this.metrics.totalFilters > 0 
        ? this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)
        : 0,
      blockRate: this.metrics.documentsChecked > 0
        ? this.metrics.documentsBlocked / this.metrics.documentsChecked
        : 0,
      userCacheSize: this.userCache.size,
      groupCacheSize: this.groupCache.size,
      permissionCacheSize: this.permissionCache.size,
      auditLogSize: this.auditLog.length
    };
  }

  /**
   * Get audit log
   */
  getAuditLog(limit = 100) {
    return this.auditLog.slice(-limit);
  }

  /**
   * Clear caches
   */
  clearCaches() {
    this.userCache.clear();
    this.groupCache.clear();
    this.permissionCache.clear();
    console.log('ACL caches cleared');
  }

  /**
   * Clear audit log
   */
  clearAuditLog() {
    this.auditLog = [];
    console.log('Audit log cleared');
  }
}

// Export for use in other modules
export { ACLFilter };

// Example usage and testing
if (import.meta.url === `file://${process.argv[1]}`) {
  const aclFilter = new ACLFilter({
    authProvider: 'internal',
    cacheEnabled: true,
    auditEnabled: true
  });
  
  // Sample user context
  const userContext = {
    userId: 'user123',
    email: 'user1@example.com',
    name: 'John Doe'
  };
  
  // Sample search results
  const searchResults = [
    {
      id: '1',
      title: 'Public Document',
      path: 'public/doc1.pdf',
      metadata: {
        acl: {
          public: true
        }
      }
    },
    {
      id: '2',
      title: 'Project A Document',
      path: 'project-a/report.docx',
      metadata: {
        acl: {
          groups: ['project-a']
        }
      }
    },
    {
      id: '3',
      title: 'Confidential Report',
      path: 'confidential/finance.xlsx',
      metadata: {
        acl: {
          users: ['admin@example.com'],
          deny_groups: ['users']
        },
        category: 'confidential'
      }
    },
    {
      id: '4',
      title: 'SharePoint Document',
      path: 'sharepoint/team/doc.pdf',
      source: 'sharepoint',
      metadata: {
        acl: {
          groups: ['users']
        }
      }
    },
    {
      id: '5',
      title: 'Restricted Document',
      path: 'restricted/secret.doc',
      metadata: {
        restricted: true,
        acl: {
          users: ['admin@example.com']
        }
      }
    }
  ];
  
  console.log('User Context:', userContext);
  console.log('\nOriginal Results:', searchResults.length, 'documents\n');
  
  aclFilter.filter(searchResults, userContext, { verbose: true })
    .then(filtered => {
      console.log('\nFiltered Results:');
      filtered.results.forEach((doc, i) => {
        console.log(`${i + 1}. ${doc.title} (${doc.path})`);
      });
      
      console.log('\nMetadata:', filtered.metadata);
      console.log('\nMetrics:', aclFilter.getMetrics());
      console.log('\nAudit Log:', aclFilter.getAuditLog(5));
    })
    .catch(console.error);
}

export default ACLFilter;