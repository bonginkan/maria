/**
 * MARIA Memory System - Phase 4 Integration Tests
 * 
 * Comprehensive enterprise feature testing including audit, governance,
 * authentication, security, deployment, and data portability
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { EnterpriseAuditLogger } from '../enterprise-audit-logger';
import { DataGovernanceEngine } from '../data-governance-engine';
import { EnterpriseAuthManager } from '../enterprise-auth-manager';
import { EnterpriseSecurityManager } from '../enterprise-security-manager';
import { EnterpriseDeploymentManager } from '../enterprise-deployment-manager';
import { EnterpriseDataPorter } from '../enterprise-data-porter';

describe('Phase 4: Enterprise Integration Tests', () => {
  let auditLogger: EnterpriseAuditLogger;
  let governanceEngine: DataGovernanceEngine;
  let authManager: EnterpriseAuthManager;
  let securityManager: EnterpriseSecurityManager;
  let deploymentManager: EnterpriseDeploymentManager;
  let dataPorter: EnterpriseDataPorter;

  beforeAll(async () => {
    // Initialize enterprise components
    auditLogger = new EnterpriseAuditLogger();
    governanceEngine = new DataGovernanceEngine();
    authManager = new EnterpriseAuthManager();
    
    // Initialize security manager with test configuration
    const securityConfig = {
      encryption: {
        algorithm: 'AES-256-GCM' as const,
        keySize: 256 as 256,
        ivSize: 12,
        tagSize: 16,
        defaultClassification: 'internal' as const,
        classificationRules: []
      },
      keyManagement: {
        provider: 'local' as const,
        masterKey: {
          derivationMethod: 'manual' as const
        },
        keyBackup: {
          enabled: false,
          schedule: '0 2 * * *',
          encryption: true,
          storage: [],
          retention: 30
        }
      },
      threatProtection: {
        intrusion: {
          enabled: true,
          rules: [],
          alertThreshold: 5,
          blockThreshold: 10,
          quarantineEnabled: true
        },
        anomaly: {
          enabled: true,
          models: [],
          sensitivity: 0.7,
          learningPeriod: 30,
          alertThreshold: 3
        },
        malware: {
          enabled: true,
          scanners: [],
          quarantineEnabled: true,
          autoClean: false
        },
        dataExfiltration: {
          enabled: true,
          monitors: [],
          preventionRules: [],
          alertThreshold: 2
        }
      },
      dataLossPrevention: {
        enabled: true,
        policies: [],
        contentInspection: {
          enabled: true,
          maxFileSize: 100 * 1024 * 1024,
          supportedTypes: ['text', 'json', 'xml'],
          deepInspection: false,
          ocrEnabled: false
        },
        actionTemplates: []
      },
      monitoring: {
        realtime: {
          enabled: true,
          dashboards: [],
          alerts: [],
          correlationRules: []
        },
        logging: {
          level: 'info' as const,
          destinations: [],
          format: 'json' as const,
          retention: 365,
          encryption: true
        },
        alerting: {
          enabled: true,
          severityThresholds: new Map([
            ['low', 1],
            ['medium', 3],
            ['high', 5],
            ['critical', 1]
          ]),
          escalationPolicies: [],
          suppressionRules: []
        },
        metrics: {
          collection: {
            interval: 60,
            metrics: [],
            tags: []
          },
          storage: {
            provider: 'prometheus' as const,
            retention: 30,
            compression: true,
            config: {}
          },
          dashboards: []
        }
      }
    };
    
    securityManager = new EnterpriseSecurityManager(securityConfig);
    
    // Initialize deployment manager with test configuration
    const deploymentConfig = {
      infrastructure: {
        provider: 'kubernetes' as const,
        regions: [
          {
            name: 'us-east-1',
            primary: true,
            zones: ['us-east-1a', 'us-east-1b'],
            networkCIDR: '10.0.0.0/16',
            compliance: ['SOC2'],
            disaster_recovery: false
          }
        ],
        environments: [
          {
            name: 'test',
            type: 'development' as const,
            regions: ['us-east-1'],
            isolation: 'namespace' as const,
            approvalRequired: false,
            resources: {
              cpu: { requests: '100m', limits: '500m' },
              memory: { requests: '128Mi', limits: '512Mi' },
              storage: { requests: '1Gi', limits: '10Gi' },
              network: {
                bandwidth: '100Mbps',
                connections: 100,
                ingressRules: [],
                egressRules: []
              }
            }
          }
        ],
        resourceQuotas: {
          cpu: '10',
          memory: '20Gi',
          storage: '100Gi',
          pods: 100,
          services: 50,
          persistentVolumeClaims: 20
        },
        costOptimization: {
          autoScaling: true,
          spotInstances: false,
          scheduledScaling: [],
          resourceRightSizing: true,
          budgetAlerts: []
        }
      },
      kubernetes: {
        version: '1.28',
        distribution: 'vanilla' as const,
        addons: [],
        rbac: {
          enabled: true,
          serviceAccounts: [
            {
              name: 'maria-test',
              namespace: 'maria-test',
              automountServiceAccountToken: true
            }
          ],
          roles: [],
          bindings: []
        },
        networkPolicy: {
          enabled: false,
          defaultDeny: false,
          policies: []
        },
        podSecurityPolicy: {
          enabled: false,
          policies: [],
          defaults: {
            runAsNonRoot: true,
            readOnlyRootFilesystem: false,
            allowPrivilegeEscalation: false,
            capabilities: { add: [], drop: ['ALL'] }
          }
        },
        storage: {
          classes: [],
          encryption: {
            enabled: false,
            keyManagement: 'provider' as const,
            algorithm: 'AES-256',
            keyRotation: false
          },
          backup: {
            enabled: false,
            schedule: '0 2 * * *',
            retention: '30d',
            crossRegion: false,
            encryption: false
          },
          monitoring: {
            enabled: false,
            metrics: [],
            alerts: []
          }
        }
      },
      scaling: {
        horizontal: {
          enabled: true,
          minReplicas: 1,
          maxReplicas: 3,
          targetCPUUtilization: 70,
          targetMemoryUtilization: 80,
          customMetrics: [],
          behavior: {
            scaleUp: {
              stabilizationWindowSeconds: 60,
              policies: []
            },
            scaleDown: {
              stabilizationWindowSeconds: 300,
              policies: []
            }
          }
        },
        vertical: {
          enabled: false,
          updateMode: 'Off' as const,
          resourcePolicy: { containerPolicies: [] }
        },
        cluster: {
          enabled: false,
          minNodes: 1,
          maxNodes: 5,
          nodeGroups: [],
          scaleDownDelay: '10m',
          scaleDownUnneededTime: '10m'
        },
        predictive: {
          enabled: false,
          models: [],
          lookaheadMinutes: 30,
          confidenceThreshold: 0.8
        }
      },
      monitoring: {
        prometheus: {
          enabled: false,
          retention: '30d',
          storage: '10Gi',
          replicas: 1,
          resources: { cpu: '100m', memory: '128Mi' },
          rules: []
        },
        grafana: {
          enabled: false,
          adminPassword: 'admin',
          dashboards: [],
          datasources: [],
          plugins: []
        },
        logging: {
          enabled: false,
          level: 'info' as const,
          aggregator: 'fluentd' as const,
          storage: {
            type: 'elasticsearch' as const,
            config: {},
            indexing: {
              enabled: true,
              fields: [],
              lifecycle: {
                hot: '7d',
                warm: '30d',
                cold: '90d',
                delete: '365d'
              }
            }
          },
          retention: '90d'
        },
        tracing: {
          enabled: false,
          provider: 'jaeger' as const,
          samplingRate: 0.1,
          config: {}
        },
        alerting: {
          enabled: false,
          manager: {
            replicas: 1,
            retention: '120h',
            storage: '1Gi',
            config: {}
          },
          receivers: [],
          routes: []
        }
      },
      security: {
        tls: {
          enabled: false,
          caCert: '',
          cert: '',
          key: '',
          insecure: false
        },
        secrets: {
          management: 'kubernetes' as const,
          encryption: false,
          rotation: false,
          config: {}
        },
        imageScanning: {
          enabled: false,
          provider: 'trivy' as const,
          policy: {
            failOnCritical: false,
            failOnHigh: false,
            allowedVulnerabilities: [],
            exemptions: []
          },
          registry: {
            url: '',
            credentials: { username: '', password: '' },
            scanOnPush: false,
            retention: {
              enabled: false,
              policies: []
            }
          }
        },
        admission: {
          controllers: [],
          policies: []
        }
      },
      backup: {
        enabled: false,
        provider: 'velero' as const,
        storage: {
          type: 's3' as const,
          config: {},
          crossRegion: false
        },
        schedule: [],
        retention: {
          default: '30d',
          policies: []
        },
        encryption: false
      },
      networking: {
        ingress: {
          controller: 'nginx' as const,
          tls: {
            enabled: false,
            provider: 'cert_manager' as const,
            issuer: 'letsencrypt',
            wildcard: false
          },
          rateLimiting: {
            enabled: false,
            global: { requests: 1000, window: '1m' },
            perPath: []
          },
          auth: {
            enabled: false,
            provider: 'oauth2_proxy' as const,
            config: {}
          }
        },
        serviceMesh: {
          enabled: false,
          provider: 'istio' as const,
          mtls: {
            enabled: false,
            mode: 'permissive' as const,
            certificateAuthority: {
              provider: 'istio' as const,
              config: {}
            }
          },
          tracing: false,
          monitoring: false
        },
        cni: {
          provider: 'calico' as const,
          ipv6: false,
          encryption: false,
          config: {}
        },
        dns: {
          provider: 'coredns' as const,
          customDomains: [],
          externalDNS: {
            enabled: false,
            provider: 'route53' as const,
            config: {}
          }
        }
      }
    };
    
    deploymentManager = new EnterpriseDeploymentManager(deploymentConfig);
    
    // Initialize data porter with test configuration
    const porterConfig = {
      formats: ['json', 'csv', 'xml'],
      encryption: {
        enabled: true,
        algorithm: 'AES-256-GCM' as const,
        keyDerivation: {
          method: 'PBKDF2' as const,
          iterations: 100000,
          saltSize: 32,
          keySize: 32
        },
        compression: {
          enabled: true,
          algorithm: 'gzip' as const,
          level: 6
        }
      },
      validation: {
        schema: {
          enabled: true,
          strict: false,
          schemas: [],
          autoDetect: true
        },
        integrity: {
          enabled: true,
          algorithms: ['sha256'] as const,
          signatureValidation: false
        },
        quality: {
          enabled: true,
          rules: [],
          thresholds: {
            completeness: 0.9,
            uniqueness: 0.95,
            validity: 0.9,
            consistency: 0.9
          }
        }
      },
      compliance: {
        gdpr: {
          enabled: true,
          rightToErasure: true,
          dataPortability: true,
          consentTracking: true,
          lawfulBasisValidation: true
        },
        hipaa: {
          enabled: false,
          phi_identification: false,
          minimumNecessary: false,
          auditLogging: false,
          accessControls: false
        },
        sox: {
          enabled: false,
          financialDataProtection: false,
          auditTrail: false,
          accessLogging: false,
          dataRetention: false
        },
        custom: []
      },
      storage: {
        local: {
          enabled: true,
          basePath: '/tmp/maria-porter',
          compression: true,
          encryption: true,
          retention: 30
        },
        cloud: {
          enabled: false,
          providers: [],
          encryption: true,
          versioning: true,
          retention: 90
        },
        backup: {
          enabled: false,
          schedule: '0 2 * * *',
          retention: 365,
          crossRegion: false,
          versioning: true
        }
      },
      performance: {
        streaming: {
          enabled: true,
          chunkSize: 1024 * 1024,
          bufferSize: 10,
          timeout: 30
        },
        parallel: {
          enabled: true,
          workerCount: 4,
          queueSize: 100,
          batchSize: 1000
        },
        memory: {
          maxMemoryUsage: 512 * 1024 * 1024,
          spillToDisk: true,
          tempDirectory: '/tmp'
        },
        network: {
          timeout: 30,
          retries: 3,
          backoff: {
            initial: 1,
            max: 30,
            multiplier: 2
          }
        }
      }
    };
    
    dataPorter = new EnterpriseDataPorter(porterConfig);
  });

  afterAll(async () => {
    // Cleanup
  });

  describe('Enterprise Audit System', () => {
    it('should log authentication events with proper audit trail', async () => {
      const event = await auditLogger.logEvent(
        'authentication',
        'user123',
        'login_attempt',
        'auth_system',
        'success',
        {
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0',
          correlationId: 'test-correlation-123'
        }
      );

      expect(event).toBeDefined();
      expect(event.eventType).toBe('authentication');
      expect(event.userId).toBe('user123');
      expect(event.result).toBe('success');
      expect(event.signature).toBeDefined();
      expect(event.hash).toBeDefined();
    });

    it('should maintain audit log integrity chain', async () => {
      // Log multiple events
      const events = [];
      for (let i = 0; i < 3; i++) {
        const event = await auditLogger.logEvent(
          'data_access',
          'user123',
          `access_${i}`,
          'memory_system',
          'success'
        );
        events.push(event);
      }

      // Verify integrity
      const integrity = await auditLogger.verifyIntegrity();
      expect(integrity.valid).toBe(true);
      expect(integrity.errors).toHaveLength(0);
    });

    it('should generate compliance reports', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const report = await auditLogger.generateComplianceReport(
        startDate,
        endDate,
        ['GDPR', 'SOC2']
      );

      expect(report).toBeDefined();
      expect(report.reportId).toBeDefined();
      expect(report.compliance).toBeInstanceOf(Array);
      expect(report.summary).toBeDefined();
      expect(report.recommendations).toBeInstanceOf(Array);
    });

    it('should export audit logs for compliance', async () => {
      const jsonExport = await auditLogger.exportForCompliance('json');
      expect(jsonExport).toBeTruthy();
      expect(() => JSON.parse(jsonExport)).not.toThrow();

      const csvExport = await auditLogger.exportForCompliance('csv');
      expect(csvExport).toBeTruthy();
      expect(csvExport).toContain('ID,Timestamp');
    });
  });

  describe('Data Governance Engine', () => {
    it('should register and apply governance policies', async () => {
      const policy = {
        id: 'test_encryption_policy',
        name: 'Test Data Encryption Policy',
        description: 'Encrypt sensitive test data',
        type: 'encryption' as const,
        scope: {
          dataTypes: ['sensitive'],
          environments: ['development']
        },
        rules: [
          {
            id: 'encrypt_sensitive',
            condition: {
              field: 'classification',
              operator: 'equals' as const,
              value: 'sensitive',
              priority: 1
            },
            action: {
              type: 'encrypt' as const,
              parameters: { algorithm: 'AES-256-GCM' }
            },
            priority: 1
          }
        ],
        enforcement: 'mandatory' as const,
        effectiveDate: new Date(),
        approvedBy: 'test_admin',
        metadata: {
          version: '1.0',
          tags: ['encryption', 'test'],
          complianceFrameworks: ['SOC2'],
          lastReviewed: new Date(),
          nextReviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          changeLog: []
        }
      };

      await governanceEngine.registerPolicy(policy);

      const testData = { id: '123', name: 'Test User', ssn: '123-45-6789' };
      const context = {
        dataType: 'sensitive',
        environment: 'development' as const,
        userId: 'user123'
      };

      const result = await governanceEngine.applyPolicies(testData, context);

      expect(result.appliedPolicies).toContain('test_encryption_policy');
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe('encrypt');
    });

    it('should manage data lineage tracking', async () => {
      const sourceData = { id: '123', value: 'original' };
      const destinationData = { id: '123', value: 'transformed' };
      const context = {
        dataType: 'user_data',
        environment: 'development' as const,
        userId: 'user123',
        sourceId: 'source_system',
        destinationId: 'target_system'
      };

      const lineage = await governanceEngine.trackLineage(
        sourceData,
        destinationData,
        context,
        ['data_transformation']
      );

      expect(lineage).toBeDefined();
      expect(lineage.source.name).toBe('MARIA Memory System');
      expect(lineage.transformations).toHaveLength(1);
      expect(lineage.metadata.quality).toBeDefined();
    });

    it('should handle data subject rights requests', async () => {
      const request = {
        type: 'right_to_access' as const,
        dataSubjectId: 'user123',
        details: { requestReason: 'User requested data export' }
      };

      const result = await governanceEngine.handleDataSubjectRequest(request);

      expect(result.success).toBe(true);
      expect(result.message).toContain('exported successfully');
    });

    it('should generate compliance reports', async () => {
      const report = await governanceEngine.generateComplianceReport({
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        frameworks: ['GDPR']
      });

      expect(report).toBeDefined();
      expect(report.reportId).toBeDefined();
      expect(report.compliance).toBeInstanceOf(Array);
      expect(report.metrics).toBeDefined();
    });
  });

  describe('Enterprise Authentication & Authorization', () => {
    it('should authenticate user with local provider', async () => {
      // Create test user
      const user = await authManager.createUser({
        username: 'testuser',
        email: 'test@example.com',
        displayName: 'Test User'
      });

      expect(user).toBeDefined();
      expect(user.username).toBe('testuser');
      expect(user.status).toBe('active');

      // Authenticate user
      const authRequest = {
        username: 'testuser',
        password: 'testpassword',
        provider: 'local',
        clientInfo: {
          ipAddress: '192.168.1.100',
          userAgent: 'Test Agent',
          deviceId: 'test-device'
        }
      };

      const result = await authManager.authenticate(authRequest);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.session).toBeDefined();
      expect(result.token).toBeDefined();
    });

    it('should enforce role-based access control', async () => {
      // Create role
      const role = await authManager.createRole({
        id: 'test_role',
        name: 'Test Role',
        description: 'Role for testing',
        permissions: [
          {
            id: 'test_permission',
            resource: 'test_resource',
            action: 'read',
            effect: 'allow',
            priority: 1
          }
        ],
        scope: { global: true },
        createdBy: 'test_admin'
      });

      expect(role).toBeDefined();
      expect(role.permissions).toHaveLength(1);

      // Create user and assign role
      const user = await authManager.createUser({
        username: 'roleuser',
        email: 'roleuser@example.com'
      });

      await authManager.assignRole(user.id, role.id, 'test_admin');

      // Test authorization
      const authRequest = {
        username: 'roleuser',
        password: 'password',
        provider: 'local',
        clientInfo: {
          ipAddress: '192.168.1.100',
          userAgent: 'Test Agent'
        }
      };

      const authResult = await authManager.authenticate(authRequest);
      expect(authResult.success).toBe(true);

      const authorized = await authManager.authorize(
        authResult.session!.id,
        'test_resource',
        'read'
      );

      expect(authorized).toBe(true);
    });

    it('should handle session management', async () => {
      const user = await authManager.createUser({
        username: 'sessionuser',
        email: 'session@example.com'
      });

      const authRequest = {
        username: 'sessionuser',
        password: 'password',
        provider: 'local',
        clientInfo: {
          ipAddress: '192.168.1.100',
          userAgent: 'Test Agent'
        }
      };

      const authResult = await authManager.authenticate(authRequest);
      const sessionId = authResult.session!.id;

      // Refresh session
      const refreshResult = await authManager.refreshSession(sessionId);
      expect(refreshResult.success).toBe(true);
      expect(refreshResult.token).toBeDefined();

      // Get user by session
      const sessionUser = await authManager.getUserBySession(sessionId);
      expect(sessionUser).toBeDefined();
      expect(sessionUser!.id).toBe(user.id);

      // Logout
      await authManager.logout(sessionId);
      const loggedOutUser = await authManager.getUserBySession(sessionId);
      expect(loggedOutUser).toBeNull();
    });

    it('should setup and verify MFA', async () => {
      const user = await authManager.createUser({
        username: 'mfauser',
        email: 'mfa@example.com'
      });

      const mfaSetup = await authManager.setupMFA(user.id, 'totp');

      expect(mfaSetup).toBeDefined();
      expect(mfaSetup.secret).toBeDefined();
      expect(mfaSetup.qrCode).toBeDefined();
      expect(mfaSetup.backupCodes).toHaveLength(8);
    });
  });

  describe('Enterprise Security Manager', () => {
    it('should encrypt and decrypt data with proper classification', async () => {
      const testData = {
        id: '123',
        name: 'John Doe',
        ssn: '123-45-6789'
      };

      const context = {
        userId: 'user123',
        purpose: 'testing'
      };

      // Encrypt data
      const encrypted = await securityManager.encryptData(
        testData,
        'confidential',
        context
      );

      expect(encrypted).toBeDefined();
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.metadata.classification).toBe('confidential');
      expect(encrypted.metadata.encryptedAt).toBeDefined();

      // Decrypt data
      const decrypted = await securityManager.decryptData(encrypted, context);

      expect(decrypted).toEqual(testData);
    });

    it('should detect and handle threats', async () => {
      const testData = {
        type: 'suspicious_activity',
        source: '192.168.1.100',
        pattern: 'multiple_failed_logins'
      };

      const context = {
        userId: 'user123',
        sessionId: 'session123',
        timestamp: new Date()
      };

      const threats = await securityManager.detectThreats(testData, context);

      expect(threats).toBeInstanceOf(Array);
      // Threats may be empty for test data, but should not throw
    });

    it('should handle secure data transfer', async () => {
      const transferData = {
        message: 'This is sensitive data',
        value: 12345
      };

      const result = await securityManager.secureTransfer(
        transferData,
        'external_system',
        'confidential',
        { purpose: 'data_export' }
      );

      expect(result).toBeDefined();
      expect(result.encrypted).toBeDefined();
      expect(result.signature).toBeDefined();
      expect(result.transferId).toBeDefined();

      // Verify transfer
      const verified = await securityManager.verifyTransfer(
        result.encrypted,
        result.signature,
        result.transferId
      );

      expect(verified).toBe(true);
    });

    it('should perform key rotation', async () => {
      const rotationResult = await securityManager.rotateKeys();

      expect(rotationResult).toBeDefined();
      expect(rotationResult.rotated).toBeInstanceOf(Array);
      expect(rotationResult.failed).toBeInstanceOf(Array);
    });

    it('should provide security status overview', async () => {
      const status = await securityManager.getSecurityStatus();

      expect(status).toBeDefined();
      expect(status.overall).toMatch(/low|medium|high|critical/);
      expect(status.threats).toBeDefined();
      expect(status.encryption).toBeDefined();
      expect(status.dlp).toBeDefined();
      expect(status.monitoring).toBeDefined();
    });
  });

  describe('Enterprise Deployment Manager', () => {
    it('should generate Kubernetes manifests', async () => {
      const manifests = await deploymentManager.generateManifests('test');

      expect(manifests).toBeInstanceOf(Array);
      expect(manifests.length).toBeGreaterThan(0);

      // Check for required manifests
      const namespaceManifest = manifests.find(m => m.kind === 'Namespace');
      expect(namespaceManifest).toBeDefined();
      expect(namespaceManifest!.metadata.name).toBe('maria-test');

      const deploymentManifest = manifests.find(m => m.kind === 'Deployment');
      expect(deploymentManifest).toBeDefined();

      const serviceManifest = manifests.find(m => m.kind === 'Service');
      expect(serviceManifest).toBeDefined();
    });

    it('should validate deployment configuration', async () => {
      // Should not throw for valid environment
      await expect(
        deploymentManager.deploy('test', { dryRun: true })
      ).resolves.toBeDefined();
    });

    it('should get deployment status', async () => {
      const status = await deploymentManager.getStatus('test');

      expect(status).toBeDefined();
      expect(status.environments).toBeDefined();
      expect(status.environments.test).toBeDefined();
      expect(status.overall).toMatch(/healthy|degraded|unhealthy/);
    });

    it('should simulate scaling operations', async () => {
      const scalingResult = await deploymentManager.scale('test', 'maria-memory-system', 2);

      expect(scalingResult).toBeDefined();
      expect(scalingResult.success).toBe(true);
      expect(scalingResult.newReplicas).toBe(2);
    });
  });

  describe('Enterprise Data Porter', () => {
    it('should export data in multiple formats', async () => {
      const testData = [
        { id: '1', name: 'John Doe', email: 'john@example.com' },
        { id: '2', name: 'Jane Smith', email: 'jane@example.com' }
      ];

      const exportRequest = {
        id: 'test_export_json',
        source: {
          type: 'memory_system' as const,
          location: 'test://data',
          query: { filter: '*' }
        },
        destination: {
          type: 'memory_system' as const,
          location: '/tmp/test_export.json'
        },
        format: 'json' as const,
        options: {
          encryption: false,
          compression: false,
          validation: true,
          streaming: false,
          parallel: false,
          includeMetadata: true,
          includeSchema: true
        }
      };

      // Mock the loadSourceData method to return test data
      (dataPorter as any).loadSourceData = async () => testData;
      (dataPorter as any).writeToDestination = async () => {};

      const result = await dataPorter.exportData(exportRequest);

      expect(result.success).toBe(true);
      expect(result.records.total).toBe(2);
      expect(result.records.processed).toBe(2);
      expect(result.validation.integrity.verified).toBe(true);
    });

    it('should import data with validation', async () => {
      const testData = [
        { id: '1', name: 'Test User 1' },
        { id: '2', name: 'Test User 2' }
      ];

      const importRequest = {
        id: 'test_import_json',
        source: {
          type: 'memory_system' as const,
          location: '/tmp/test_import.json'
        },
        destination: {
          type: 'memory_system' as const,
          location: 'test://target'
        },
        format: 'json' as const,
        options: {
          mode: 'create' as const,
          skipErrors: false,
          validateSchema: true,
          validateData: true,
          dryRun: true,
          batchSize: 100
        }
      };

      // Mock methods
      (dataPorter as any).loadSourceData = async () => JSON.stringify(testData);
      (dataPorter as any).processRecord = async () => {};

      const result = await dataPorter.importData(importRequest);

      expect(result.success).toBe(true);
      expect(result.records.total).toBe(2);
    });

    it('should handle job status tracking', async () => {
      const exportRequest = {
        id: 'test_job_tracking',
        source: {
          type: 'memory_system' as const,
          location: 'test://data'
        },
        destination: {
          type: 'memory_system' as const,
          location: '/tmp/test.json'
        },
        format: 'json' as const,
        options: {
          encryption: false,
          compression: false,
          validation: false,
          streaming: false,
          parallel: false,
          includeMetadata: false,
          includeSchema: false
        }
      };

      // Mock async operation
      (dataPorter as any).loadSourceData = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return [];
      };
      (dataPorter as any).writeToDestination = async () => {};

      // Start export (don't await)
      const exportPromise = dataPorter.exportData(exportRequest);

      // Check job status
      const status = dataPorter.getJobStatus('test_job_tracking');
      expect(status).toBeDefined();
      expect(status!.type).toBe('export');

      // Wait for completion
      const result = await exportPromise;
      expect(result.success).toBe(true);

      // Job should be removed from active jobs
      const completedStatus = dataPorter.getJobStatus('test_job_tracking');
      expect(completedStatus).toBeNull();
    });

    it('should support job cancellation', async () => {
      const exportRequest = {
        id: 'test_job_cancellation',
        source: {
          type: 'memory_system' as const,
          location: 'test://data'
        },
        destination: {
          type: 'memory_system' as const,
          location: '/tmp/test_cancel.json'
        },
        format: 'json' as const,
        options: {
          encryption: false,
          compression: false,
          validation: false,
          streaming: false,
          parallel: false,
          includeMetadata: false,
          includeSchema: false
        }
      };

      // Mock long-running operation
      (dataPorter as any).loadSourceData = async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return [];
      };

      // Start export (don't await)
      dataPorter.exportData(exportRequest);

      // Cancel job
      const cancelled = await dataPorter.cancelJob('test_job_cancellation');
      expect(cancelled).toBe(true);
    });
  });

  describe('Cross-Component Integration', () => {
    it('should integrate authentication with audit logging', async () => {
      // Create user
      const user = await authManager.createUser({
        username: 'audituser',
        email: 'audit@example.com'
      });

      // Set up audit listener
      let auditedEvents: any[] = [];
      authManager.on('authenticationAttempt', (event) => {
        auditedEvents.push(event);
      });

      // Authenticate user
      const authRequest = {
        username: 'audituser',
        password: 'password',
        provider: 'local',
        clientInfo: {
          ipAddress: '192.168.1.100',
          userAgent: 'Test Agent'
        }
      };

      await authManager.authenticate(authRequest);

      // Verify audit event was captured
      expect(auditedEvents).toHaveLength(1);
      expect(auditedEvents[0].request.username).toBe('audituser');
    });

    it('should integrate data governance with security encryption', async () => {
      // Register governance policy that requires encryption
      const policy = {
        id: 'security_integration_policy',
        name: 'Security Integration Policy',
        description: 'Requires encryption for sensitive data',
        type: 'encryption' as const,
        scope: {
          dataTypes: ['sensitive'],
          environments: ['development']
        },
        rules: [
          {
            id: 'encrypt_rule',
            condition: {
              field: 'classification',
              operator: 'equals' as const,
              value: 'sensitive',
              priority: 1
            },
            action: {
              type: 'encrypt' as const,
              parameters: { algorithm: 'AES-256-GCM' }
            },
            priority: 1
          }
        ],
        enforcement: 'mandatory' as const,
        effectiveDate: new Date(),
        approvedBy: 'test_admin',
        metadata: {
          version: '1.0',
          tags: ['integration'],
          complianceFrameworks: [],
          lastReviewed: new Date(),
          nextReviewDate: new Date(),
          changeLog: []
        }
      };

      await governanceEngine.registerPolicy(policy);

      // Apply policy to data
      const testData = { secret: 'confidential information' };
      const context = {
        dataType: 'sensitive',
        environment: 'development' as const,
        userId: 'user123'
      };

      const result = await governanceEngine.applyPolicies(testData, context);

      expect(result.appliedPolicies).toContain('security_integration_policy');
      expect(result.actions.some(a => a.type === 'encrypt')).toBe(true);
    });

    it('should integrate deployment with security monitoring', async () => {
      // Generate manifests
      const manifests = await deploymentManager.generateManifests('test');
      
      // Verify security-related manifests
      const hasSecurityContext = manifests.some(manifest => 
        manifest.kind === 'Deployment' && 
        manifest.spec?.template?.spec?.securityContext
      );

      expect(hasSecurityContext).toBe(true);
    });

    it('should integrate data porter with audit and governance', async () => {
      // Set up governance policy for exports
      const exportPolicy = {
        id: 'export_governance_policy',
        name: 'Export Governance Policy',
        description: 'Governs data exports',
        type: 'access_control' as const,
        scope: {
          dataTypes: ['user_data'],
          environments: ['development']
        },
        rules: [
          {
            id: 'audit_export_rule',
            condition: {
              field: 'operation',
              operator: 'equals' as const,
              value: 'export',
              priority: 1
            },
            action: {
              type: 'audit' as const,
              parameters: { level: 'detailed' }
            },
            priority: 1
          }
        ],
        enforcement: 'mandatory' as const,
        effectiveDate: new Date(),
        approvedBy: 'test_admin',
        metadata: {
          version: '1.0',
          tags: ['export', 'audit'],
          complianceFrameworks: ['GDPR'],
          lastReviewed: new Date(),
          nextReviewDate: new Date(),
          changeLog: []
        }
      };

      await governanceEngine.registerPolicy(exportPolicy);

      // Perform export with compliance requirements
      const exportRequest = {
        id: 'compliance_export',
        source: {
          type: 'memory_system' as const,
          location: 'test://user_data'
        },
        destination: {
          type: 'memory_system' as const,
          location: '/tmp/compliance_export.json'
        },
        format: 'json' as const,
        options: {
          encryption: true,
          compression: false,
          validation: true,
          streaming: false,
          parallel: false,
          includeMetadata: true,
          includeSchema: true
        },
        compliance: {
          framework: 'gdpr' as const,
          dataSubjectConsent: true,
          auditRequired: true
        }
      };

      // Mock data and methods
      (dataPorter as any).loadSourceData = async () => [
        { id: '1', name: 'User 1', email: 'user1@example.com' }
      ];
      (dataPorter as any).writeToDestination = async () => {};

      const result = await dataPorter.exportData(exportRequest);

      expect(result.success).toBe(true);
      expect(result.compliance.compliant).toBe(true);
      expect(result.compliance.framework).toBe('gdpr');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-volume audit logging', async () => {
      const startTime = Date.now();
      const eventCount = 100;
      
      const promises = [];
      for (let i = 0; i < eventCount; i++) {
        promises.push(
          auditLogger.logEvent(
            'data_access',
            `user${i}`,
            `action_${i}`,
            'memory_system',
            'success'
          )
        );
      }

      await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      // Verify integrity still maintained
      const integrity = await auditLogger.verifyIntegrity();
      expect(integrity.valid).toBe(true);
    });

    it('should handle concurrent authentication requests', async () => {
      // Create multiple users
      const users = [];
      for (let i = 0; i < 10; i++) {
        const user = await authManager.createUser({
          username: `concurrentuser${i}`,
          email: `concurrent${i}@example.com`
        });
        users.push(user);
      }

      // Concurrent authentication
      const authPromises = users.map(user => 
        authManager.authenticate({
          username: user.username,
          password: 'password',
          provider: 'local',
          clientInfo: {
            ipAddress: '192.168.1.100',
            userAgent: 'Test Agent'
          }
        })
      );

      const results = await Promise.all(authPromises);

      expect(results).toHaveLength(10);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should handle large data exports efficiently', async () => {
      // Generate large dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i.toString(),
        name: `User ${i}`,
        email: `user${i}@example.com`,
        data: 'x'.repeat(100) // Some bulk data
      }));

      const exportRequest = {
        id: 'large_export_test',
        source: {
          type: 'memory_system' as const,
          location: 'test://large_data'
        },
        destination: {
          type: 'memory_system' as const,
          location: '/tmp/large_export.json'
        },
        format: 'json' as const,
        options: {
          encryption: false,
          compression: true,
          validation: false,
          streaming: true,
          parallel: true,
          includeMetadata: false,
          includeSchema: false
        }
      };

      // Mock large dataset
      (dataPorter as any).loadSourceData = async () => largeDataset;
      (dataPorter as any).writeToDestination = async () => {};

      const startTime = Date.now();
      const result = await dataPorter.exportData(exportRequest);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.records.total).toBe(1000);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });
});

describe('Phase 4: Error Handling and Recovery', () => {
  let auditLogger: EnterpriseAuditLogger;
  let authManager: EnterpriseAuthManager;

  beforeEach(() => {
    auditLogger = new EnterpriseAuditLogger();
    authManager = new EnterpriseAuthManager();
  });

  it('should handle audit system failures gracefully', async () => {
    // Test with invalid event data
    await expect(
      auditLogger.logEvent(
        '' as any,  // Invalid event type
        '',         // Invalid user ID
        '',         // Invalid action
        '',         // Invalid resource
        'success'
      )
    ).rejects.toThrow();
  });

  it('should handle authentication failures properly', async () => {
    const authRequest = {
      username: 'nonexistent',
      password: 'wrongpassword',
      provider: 'local',
      clientInfo: {
        ipAddress: '192.168.1.100',
        userAgent: 'Test Agent'
      }
    };

    const result = await authManager.authenticate(authRequest);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.code).toBe('invalid_credentials');
  });

  it('should maintain system integrity during failures', async () => {
    // Simulate partial failures in audit logging
    const validEvent = await auditLogger.logEvent(
      'data_access',
      'user123',
      'read_data',
      'memory_system',
      'success'
    );

    expect(validEvent).toBeDefined();

    // Verify system can still function after failures
    const integrity = await auditLogger.verifyIntegrity();
    expect(integrity.valid).toBe(true);
  });
});

describe('Phase 4: Security Validation', () => {
  let securityManager: EnterpriseSecurityManager;

  beforeEach(() => {
    const securityConfig = {
      encryption: {
        algorithm: 'AES-256-GCM' as const,
        keySize: 256 as 256,
        ivSize: 12,
        tagSize: 16,
        defaultClassification: 'internal' as const,
        classificationRules: []
      },
      keyManagement: {
        provider: 'local' as const,
        masterKey: { derivationMethod: 'manual' as const },
        keyBackup: {
          enabled: false,
          schedule: '0 2 * * *',
          encryption: true,
          storage: [],
          retention: 30
        }
      },
      threatProtection: {
        intrusion: { enabled: true, rules: [], alertThreshold: 5, blockThreshold: 10, quarantineEnabled: true },
        anomaly: { enabled: true, models: [], sensitivity: 0.7, learningPeriod: 30, alertThreshold: 3 },
        malware: { enabled: true, scanners: [], quarantineEnabled: true, autoClean: false },
        dataExfiltration: { enabled: true, monitors: [], preventionRules: [], alertThreshold: 2 }
      },
      dataLossPrevention: {
        enabled: true,
        policies: [],
        contentInspection: {
          enabled: true,
          maxFileSize: 100 * 1024 * 1024,
          supportedTypes: ['text'],
          deepInspection: false,
          ocrEnabled: false
        },
        actionTemplates: []
      },
      monitoring: {
        realtime: { enabled: true, dashboards: [], alerts: [], correlationRules: [] },
        logging: {
          level: 'info' as const,
          destinations: [],
          format: 'json' as const,
          retention: 365,
          encryption: true
        },
        alerting: {
          enabled: true,
          severityThresholds: new Map(),
          escalationPolicies: [],
          suppressionRules: []
        },
        metrics: {
          collection: { interval: 60, metrics: [], tags: [] },
          storage: { provider: 'prometheus' as const, retention: 30, compression: true, config: {} },
          dashboards: []
        }
      }
    };

    securityManager = new EnterpriseSecurityManager(securityConfig);
  });

  it('should validate encryption strength', async () => {
    const sensitiveData = {
      creditCard: '4111-1111-1111-1111',
      ssn: '123-45-6789'
    };

    const encrypted = await securityManager.encryptData(
      sensitiveData,
      'restricted',
      { userId: 'user123' }
    );

    expect(encrypted.algorithm).toBe('AES-256-GCM');
    expect(encrypted.metadata.classification).toBe('restricted');
    expect(encrypted.ciphertext).not.toContain('4111-1111-1111-1111');
    expect(encrypted.ciphertext).not.toContain('123-45-6789');
  });

  it('should detect potential security threats', async () => {
    const suspiciousData = {
      pattern: 'SELECT * FROM users WHERE 1=1',
      type: 'sql_injection_attempt'
    };

    const threats = await securityManager.detectThreats(
      suspiciousData,
      { userId: 'user123', sessionId: 'session123' }
    );

    // Should detect or at least handle gracefully
    expect(threats).toBeInstanceOf(Array);
  });

  it('should enforce data classification policies', async () => {
    const publicData = { message: 'Hello World' };
    const secretData = { apiKey: 'secret-api-key-12345' };

    const publicEncrypted = await securityManager.encryptData(
      publicData,
      'public',
      { userId: 'user123' }
    );

    const secretEncrypted = await securityManager.encryptData(
      secretData,
      'top_secret',
      { userId: 'user123' }
    );

    expect(publicEncrypted.metadata.classification).toBe('public');
    expect(secretEncrypted.metadata.classification).toBe('top_secret');
  });
});

// Test helpers and utilities

function generateTestUser(suffix: string = '') {
  return {
    username: `testuser${suffix}`,
    email: `test${suffix}@example.com`,
    displayName: `Test User ${suffix}`,
    firstName: 'Test',
    lastName: `User${suffix}`
  };
}

function generateTestAuditEvent(type: string, userId: string) {
  return {
    eventType: type,
    userId,
    action: `test_${type}`,
    resource: 'test_resource',
    result: 'success' as const,
    metadata: {
      ipAddress: '192.168.1.100',
      userAgent: 'Test Agent',
      correlationId: `test-${Date.now()}`
    }
  };
}

async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Condition not met within ${timeout}ms`);
}