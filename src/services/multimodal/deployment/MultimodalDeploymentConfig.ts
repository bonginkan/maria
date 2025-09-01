export interface DeploymentEnvironment {
  name: "development" | "staging" | "production";
  multimodal: {
    queue: {
      maxConcurrent: number;
      timeout: number;
      retryAttempts: number;
      priorityLevels: number;
    };
    engine: {
      defaultProvider: string;
      providers: Record<
        string,
        {
          enabled: boolean;
          apiKey?: string;
          baseURL?: string;
          timeout: number;
          rateLimit: {
            requests: number;
            windowMs: number;
          };
        }
      >;
      enableCaching: boolean;
      cacheTTL: number;
    };
    strategies: {
      confidence: {
        enabled: boolean;
        thresholds: {
          high: number;
          medium: number;
          low: number;
          reject: number;
        };
        adaptationRate: number;
      };
      storage: {
        enabled: boolean;
        basePath: string;
        retentionDays: number;
        backupEnabled: boolean;
        encryptionEnabled: boolean;
      };
      monitoring: {
        enabled: boolean;
        checkInterval: number;
        alertingEnabled: boolean;
        alertWebhooks: string[];
      };
    };
    telemetry: {
      enabled: boolean;
      exports: Array<{
        format: "json" | "prometheus" | "opentelemetry";
        destination: string;
        interval: number;
        compression: boolean;
      }>;
      sampling: {
        enabled: boolean;
        rate: number;
      };
    };
    performance: {
      cache: {
        maxSize: number;
        ttl: number;
        enableCompression: boolean;
      };
      pooling: {
        enabled: boolean;
        maxConnections: number;
        idleTimeout: number;
      };
      batching: {
        enabled: boolean;
        maxBatchSize: number;
        batchTimeout: number;
      };
      circuitBreaker: {
        enabled: boolean;
        failureThreshold: number;
        recoveryTimeout: number;
      };
      memoryManagement: {
        enableGC: boolean;
        maxMemoryUsage: number; // MB
        gcInterval: number;
      };
    };
  };
  integration: {
    router: {
      enabled: boolean;
      confidenceThreshold: number;
    };
    memory: {
      enabled: boolean;
      persistOperations: boolean;
      maxOperationHistory: number;
    };
    fileSystem: {
      enabled: boolean;
      autoSave: boolean;
      workspacePath: string;
    };
    security: {
      validateInputs: boolean;
      sanitizeOutputs: boolean;
      auditTrail: boolean;
      encryptionAtRest: boolean;
      encryptionInTransit: boolean;
    };
  };
  infrastructure: {
    containerization: {
      enabled: boolean;
      image: string;
      resources: {
        cpu: string;
        memory: string;
        storage: string;
      };
      replicas: number;
      ports: number[];
    };
    scaling: {
      enabled: boolean;
      minReplicas: number;
      maxReplicas: number;
      targetCPUUtilization: number;
      targetMemoryUtilization: number;
    };
    loadBalancing: {
      enabled: boolean;
      algorithm: "round-robin" | "least-connections" | "ip-hash";
      healthCheckPath: string;
      healthCheckInterval: number;
    };
    database: {
      enabled: boolean;
      type: "sqlite" | "postgresql" | "mongodb";
      connectionString: string;
      pool: {
        min: number;
        max: number;
        idle: number;
      };
    };
    redis: {
      enabled: boolean;
      connectionString: string;
      keyPrefix: string;
      ttl: number;
    };
    logging: {
      level: "debug" | "info" | "warn" | "error";
      format: "json" | "text";
      destination: "console" | "file" | "elasticsearch";
      retention: number; // days
    };
    metrics: {
      enabled: boolean;
      endpoint: string;
      scrapeInterval: number;
      labels: Record<string, string>;
    };
    tracing: {
      enabled: boolean;
      jaegerEndpoint?: string;
      samplingRate: number;
    };
  };
}

export class MultimodalDeploymentConfig {
  private static readonly ENVIRONMENTS: Record<string, DeploymentEnvironment> =
    {
      development: {
        name: "development",
        multimodal: {
          queue: {
            maxConcurrent: 3,
            timeout: 30000,
            retryAttempts: 2,
            priorityLevels: 5,
          },
          engine: {
            defaultProvider: "openai",
            providers: {
              openai: {
                enabled: true,
                timeout: 30000,
                rateLimit: { requests: 60, windowMs: 60000 },
              },
              anthropic: {
                enabled: true,
                timeout: 30000,
                rateLimit: { requests: 50, windowMs: 60000 },
              },
            },
            enableCaching: true,
            cacheTTL: 300000,
          },
          strategies: {
            confidence: {
              enabled: true,
              thresholds: { high: 0.8, medium: 0.6, low: 0.3, reject: 0.1 },
              adaptationRate: 0.2,
            },
            storage: {
              enabled: true,
              basePath: ".maria/dev-storage",
              retentionDays: 7,
              backupEnabled: false,
              encryptionEnabled: false,
            },
            monitoring: {
              enabled: true,
              checkInterval: 30000,
              alertingEnabled: false,
              alertWebhooks: [],
            },
          },
          telemetry: {
            enabled: true,
            exports: [
              {
                format: "json",
                destination: "console",
                interval: 60000,
                compression: false,
              },
            ],
            sampling: { enabled: false, rate: 1.0 },
          },
          performance: {
            cache: {
              maxSize: 500,
              ttl: 300000,
              enableCompression: false,
            },
            pooling: {
              enabled: false,
              maxConnections: 5,
              idleTimeout: 30000,
            },
            batching: {
              enabled: true,
              maxBatchSize: 3,
              batchTimeout: 100,
            },
            circuitBreaker: {
              enabled: true,
              failureThreshold: 3,
              recoveryTimeout: 30000,
            },
            memoryManagement: {
              enableGC: true,
              maxMemoryUsage: 256,
              gcInterval: 60000,
            },
          },
        },
        integration: {
          router: {
            enabled: false,
            confidenceThreshold: 0.7,
          },
          memory: {
            enabled: false,
            persistOperations: false,
            maxOperationHistory: 100,
          },
          fileSystem: {
            enabled: true,
            autoSave: false,
            workspacePath: ".maria/dev-workspace",
          },
          security: {
            validateInputs: true,
            sanitizeOutputs: false,
            auditTrail: false,
            encryptionAtRest: false,
            encryptionInTransit: false,
          },
        },
        infrastructure: {
          containerization: {
            enabled: false,
            image: "maria:dev",
            resources: {
              cpu: "500m",
              memory: "512Mi",
              storage: "1Gi",
            },
            replicas: 1,
            ports: [3000],
          },
          scaling: {
            enabled: false,
            minReplicas: 1,
            maxReplicas: 2,
            targetCPUUtilization: 70,
            targetMemoryUtilization: 80,
          },
          loadBalancing: {
            enabled: false,
            algorithm: "round-robin",
            healthCheckPath: "/health",
            healthCheckInterval: 30000,
          },
          database: {
            enabled: false,
            type: "sqlite",
            connectionString: "file:.maria/dev.db",
            pool: { min: 1, max: 5, idle: 30000 },
          },
          redis: {
            enabled: false,
            connectionString: "redis://localhost:6379",
            keyPrefix: "maria:dev:",
            ttl: 3600,
          },
          logging: {
            level: "debug",
            format: "text",
            destination: "console",
            retention: 7,
          },
          metrics: {
            enabled: false,
            endpoint: "/metrics",
            scrapeInterval: 15000,
            labels: { env: "development" },
          },
          tracing: {
            enabled: false,
            samplingRate: 1.0,
          },
        },
      },

      staging: {
        name: "staging",
        multimodal: {
          queue: {
            maxConcurrent: 8,
            timeout: 45000,
            retryAttempts: 3,
            priorityLevels: 10,
          },
          engine: {
            defaultProvider: "openai",
            providers: {
              openai: {
                enabled: true,
                timeout: 45000,
                rateLimit: { requests: 120, windowMs: 60000 },
              },
              anthropic: {
                enabled: true,
                timeout: 45000,
                rateLimit: { requests: 100, windowMs: 60000 },
              },
              google: {
                enabled: true,
                timeout: 45000,
                rateLimit: { requests: 100, windowMs: 60000 },
              },
            },
            enableCaching: true,
            cacheTTL: 600000,
          },
          strategies: {
            confidence: {
              enabled: true,
              thresholds: { high: 0.85, medium: 0.65, low: 0.35, reject: 0.2 },
              adaptationRate: 0.1,
            },
            storage: {
              enabled: true,
              basePath: ".maria/staging-storage",
              retentionDays: 14,
              backupEnabled: true,
              encryptionEnabled: true,
            },
            monitoring: {
              enabled: true,
              checkInterval: 15000,
              alertingEnabled: true,
              alertWebhooks: ["https://hooks.slack.com/staging-alerts"],
            },
          },
          telemetry: {
            enabled: true,
            exports: [
              {
                format: "prometheus",
                destination: "http://prometheus:9090/api/v1/write",
                interval: 30000,
                compression: true,
              },
              {
                format: "json",
                destination: "/var/log/maria/telemetry.log",
                interval: 300000,
                compression: true,
              },
            ],
            sampling: { enabled: true, rate: 0.5 },
          },
          performance: {
            cache: {
              maxSize: 2000,
              ttl: 600000,
              enableCompression: true,
            },
            pooling: {
              enabled: true,
              maxConnections: 15,
              idleTimeout: 60000,
            },
            batching: {
              enabled: true,
              maxBatchSize: 8,
              batchTimeout: 50,
            },
            circuitBreaker: {
              enabled: true,
              failureThreshold: 5,
              recoveryTimeout: 60000,
            },
            memoryManagement: {
              enableGC: true,
              maxMemoryUsage: 1024,
              gcInterval: 30000,
            },
          },
        },
        integration: {
          router: {
            enabled: true,
            confidenceThreshold: 0.8,
          },
          memory: {
            enabled: true,
            persistOperations: true,
            maxOperationHistory: 1000,
          },
          fileSystem: {
            enabled: true,
            autoSave: true,
            workspacePath: ".maria/staging-workspace",
          },
          security: {
            validateInputs: true,
            sanitizeOutputs: true,
            auditTrail: true,
            encryptionAtRest: true,
            encryptionInTransit: true,
          },
        },
        infrastructure: {
          containerization: {
            enabled: true,
            image: "maria:staging",
            resources: {
              cpu: "1000m",
              memory: "2Gi",
              storage: "10Gi",
            },
            replicas: 2,
            ports: [3000, 9090],
          },
          scaling: {
            enabled: true,
            minReplicas: 2,
            maxReplicas: 5,
            targetCPUUtilization: 70,
            targetMemoryUtilization: 80,
          },
          loadBalancing: {
            enabled: true,
            algorithm: "least-connections",
            healthCheckPath: "/health",
            healthCheckInterval: 10000,
          },
          database: {
            enabled: true,
            type: "postgresql",
            connectionString:
              "postgresql://user:pass@postgres:5432/maria_staging",
            pool: { min: 2, max: 15, idle: 60000 },
          },
          redis: {
            enabled: true,
            connectionString: "redis://redis:6379",
            keyPrefix: "maria:staging:",
            ttl: 7200,
          },
          logging: {
            level: "info",
            format: "json",
            destination: "file",
            retention: 14,
          },
          metrics: {
            enabled: true,
            endpoint: "/metrics",
            scrapeInterval: 10000,
            labels: { env: "staging" },
          },
          tracing: {
            enabled: true,
            jaegerEndpoint: "http://jaeger:14268/api/traces",
            samplingRate: 0.1,
          },
        },
      },

      production: {
        name: "production",
        multimodal: {
          queue: {
            maxConcurrent: 20,
            timeout: 60000,
            retryAttempts: 5,
            priorityLevels: 10,
          },
          engine: {
            defaultProvider: "openai",
            providers: {
              openai: {
                enabled: true,
                timeout: 60000,
                rateLimit: { requests: 300, windowMs: 60000 },
              },
              anthropic: {
                enabled: true,
                timeout: 60000,
                rateLimit: { requests: 250, windowMs: 60000 },
              },
              google: {
                enabled: true,
                timeout: 60000,
                rateLimit: { requests: 200, windowMs: 60000 },
              },
              azure: {
                enabled: true,
                timeout: 60000,
                rateLimit: { requests: 200, windowMs: 60000 },
              },
            },
            enableCaching: true,
            cacheTTL: 1800000, // 30 minutes
          },
          strategies: {
            confidence: {
              enabled: true,
              thresholds: { high: 0.9, medium: 0.75, low: 0.5, reject: 0.3 },
              adaptationRate: 0.05,
            },
            storage: {
              enabled: true,
              basePath: "/data/maria/production-storage",
              retentionDays: 90,
              backupEnabled: true,
              encryptionEnabled: true,
            },
            monitoring: {
              enabled: true,
              checkInterval: 10000,
              alertingEnabled: true,
              alertWebhooks: [
                "https://hooks.slack.com/production-alerts",
                "https://pagerduty.com/integration/maria",
              ],
            },
          },
          telemetry: {
            enabled: true,
            exports: [
              {
                format: "prometheus",
                destination:
                  "http://prometheus.monitoring.svc.cluster.local:9090/api/v1/write",
                interval: 15000,
                compression: true,
              },
              {
                format: "opentelemetry",
                destination:
                  "http://otel-collector.monitoring.svc.cluster.local:4317",
                interval: 10000,
                compression: true,
              },
            ],
            sampling: { enabled: true, rate: 0.1 },
          },
          performance: {
            cache: {
              maxSize: 10000,
              ttl: 1800000,
              enableCompression: true,
            },
            pooling: {
              enabled: true,
              maxConnections: 50,
              idleTimeout: 120000,
            },
            batching: {
              enabled: true,
              maxBatchSize: 15,
              batchTimeout: 25,
            },
            circuitBreaker: {
              enabled: true,
              failureThreshold: 10,
              recoveryTimeout: 120000,
            },
            memoryManagement: {
              enableGC: true,
              maxMemoryUsage: 4096,
              gcInterval: 15000,
            },
          },
        },
        integration: {
          router: {
            enabled: true,
            confidenceThreshold: 0.85,
          },
          memory: {
            enabled: true,
            persistOperations: true,
            maxOperationHistory: 10000,
          },
          fileSystem: {
            enabled: true,
            autoSave: true,
            workspacePath: "/data/maria/production-workspace",
          },
          security: {
            validateInputs: true,
            sanitizeOutputs: true,
            auditTrail: true,
            encryptionAtRest: true,
            encryptionInTransit: true,
          },
        },
        infrastructure: {
          containerization: {
            enabled: true,
            image: "maria:latest",
            resources: {
              cpu: "2000m",
              memory: "6Gi",
              storage: "50Gi",
            },
            replicas: 5,
            ports: [3000, 9090],
          },
          scaling: {
            enabled: true,
            minReplicas: 5,
            maxReplicas: 20,
            targetCPUUtilization: 60,
            targetMemoryUtilization: 70,
          },
          loadBalancing: {
            enabled: true,
            algorithm: "least-connections",
            healthCheckPath: "/health",
            healthCheckInterval: 5000,
          },
          database: {
            enabled: true,
            type: "postgresql",
            connectionString:
              "postgresql://user:pass@postgres.db.svc.cluster.local:5432/maria_production",
            pool: { min: 10, max: 50, idle: 120000 },
          },
          redis: {
            enabled: true,
            connectionString: "redis://redis.cache.svc.cluster.local:6379",
            keyPrefix: "maria:prod:",
            ttl: 14400,
          },
          logging: {
            level: "warn",
            format: "json",
            destination: "elasticsearch",
            retention: 90,
          },
          metrics: {
            enabled: true,
            endpoint: "/metrics",
            scrapeInterval: 5000,
            labels: { env: "production", version: "3.5.0" },
          },
          tracing: {
            enabled: true,
            jaegerEndpoint:
              "http://jaeger.monitoring.svc.cluster.local:14268/api/traces",
            samplingRate: 0.01,
          },
        },
      },
    };

  static getConfig(environment: string = "development"): DeploymentEnvironment {
    const config = this.ENVIRONMENTS[environment];
    if (!config) {
      throw new Error(
        `Unknown environment: ${environment}. Available: ${Object.keys(this.ENVIRONMENTS).join(", ")}`,
      );
    }
    return JSON.parse(JSON.stringify(config)); // Deep clone
  }

  static getAllEnvironments(): string[] {
    return Object.keys(this.ENVIRONMENTS);
  }

  static validateConfig(config: DeploymentEnvironment): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate multimodal configuration
    if (config.multimodal.queue.maxConcurrent <= 0) {
      errors.push("multimodal.queue.maxConcurrent must be greater than 0");
    }

    if (config.multimodal.queue.timeout <= 0) {
      errors.push("multimodal.queue.timeout must be greater than 0");
    }

    if (config.multimodal.strategies.confidence.enabled) {
      const thresholds = config.multimodal.strategies.confidence.thresholds;
      if (thresholds.high <= thresholds.medium) {
        errors.push("confidence.thresholds.high must be greater than medium");
      }
      if (thresholds.medium <= thresholds.low) {
        errors.push("confidence.thresholds.medium must be greater than low");
      }
      if (thresholds.low <= thresholds.reject) {
        errors.push("confidence.thresholds.low must be greater than reject");
      }
    }

    // Validate infrastructure configuration
    if (config.infrastructure.containerization.enabled) {
      if (config.infrastructure.containerization.replicas <= 0) {
        errors.push(
          "infrastructure.containerization.replicas must be greater than 0",
        );
      }
    }

    if (config.infrastructure.scaling.enabled) {
      if (
        config.infrastructure.scaling.minReplicas >
        config.infrastructure.scaling.maxReplicas
      ) {
        errors.push(
          "infrastructure.scaling.minReplicas must not exceed maxReplicas",
        );
      }
    }

    // Validate performance configuration
    if (config.multimodal.performance.cache.maxSize <= 0) {
      errors.push("performance.cache.maxSize must be greater than 0");
    }

    if (config.multimodal.performance.memoryManagement.maxMemoryUsage <= 0) {
      errors.push(
        "performance.memoryManagement.maxMemoryUsage must be greater than 0",
      );
    }

    return { valid: errors.length === 0, errors };
  }

  static generateKubernetesManifests(environment: string): {
    deployment: any;
    service: any;
    configMap: any;
    hpa?: any;
  } {
    const config = this.getConfig(environment);

    const deployment = {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: {
        name: `maria-multimodal-${environment}`,
        labels: {
          app: "maria-multimodal",
          environment,
        },
      },
      spec: {
        replicas: config.infrastructure.containerization.replicas,
        selector: {
          matchLabels: {
            app: "maria-multimodal",
            environment,
          },
        },
        template: {
          metadata: {
            labels: {
              app: "maria-multimodal",
              environment,
            },
          },
          spec: {
            containers: [
              {
                name: "maria-multimodal",
                image: config.infrastructure.containerization.image,
                ports: config.infrastructure.containerization.ports.map(
                  (port) => ({
                    containerPort: port,
                  }),
                ),
                resources: {
                  requests: {
                    cpu: config.infrastructure.containerization.resources.cpu,
                    memory:
                      config.infrastructure.containerization.resources.memory,
                  },
                  limits: {
                    cpu: config.infrastructure.containerization.resources.cpu,
                    memory:
                      config.infrastructure.containerization.resources.memory,
                  },
                },
                env: [
                  {
                    name: "NODE_ENV",
                    value: environment,
                  },
                  {
                    name: "MARIA_CONFIG",
                    valueFrom: {
                      configMapKeyRef: {
                        name: `maria-config-${environment}`,
                        key: "config.json",
                      },
                    },
                  },
                ],
                livenessProbe: {
                  httpGet: {
                    path: config.infrastructure.loadBalancing.healthCheckPath,
                    port: config.infrastructure.containerization.ports[0],
                  },
                  initialDelaySeconds: 30,
                  periodSeconds: 10,
                },
                readinessProbe: {
                  httpGet: {
                    path: config.infrastructure.loadBalancing.healthCheckPath,
                    port: config.infrastructure.containerization.ports[0],
                  },
                  initialDelaySeconds: 5,
                  periodSeconds: 5,
                },
              },
            ],
          },
        },
      },
    };

    const service = {
      apiVersion: "v1",
      kind: "Service",
      metadata: {
        name: `maria-multimodal-service-${environment}`,
        labels: {
          app: "maria-multimodal",
          environment,
        },
      },
      spec: {
        selector: {
          app: "maria-multimodal",
          environment,
        },
        ports: config.infrastructure.containerization.ports.map(
          (port, index) => ({
            name: index === 0 ? "http" : `port-${port}`,
            port,
            targetPort: port,
          }),
        ),
        type: "ClusterIP",
      },
    };

    const configMap = {
      apiVersion: "v1",
      kind: "ConfigMap",
      metadata: {
        name: `maria-config-${environment}`,
        labels: {
          app: "maria-multimodal",
          environment,
        },
      },
      data: {
        "config.json": JSON.stringify(config, null, 2),
      },
    };

    let hpa;
    if (config.infrastructure.scaling.enabled) {
      hpa = {
        apiVersion: "autoscaling/v2",
        kind: "HorizontalPodAutoscaler",
        metadata: {
          name: `maria-multimodal-hpa-${environment}`,
          labels: {
            app: "maria-multimodal",
            environment,
          },
        },
        spec: {
          scaleTargetRef: {
            apiVersion: "apps/v1",
            kind: "Deployment",
            name: `maria-multimodal-${environment}`,
          },
          minReplicas: config.infrastructure.scaling.minReplicas,
          maxReplicas: config.infrastructure.scaling.maxReplicas,
          metrics: [
            {
              type: "Resource",
              resource: {
                name: "cpu",
                target: {
                  type: "Utilization",
                  averageUtilization:
                    config.infrastructure.scaling.targetCPUUtilization,
                },
              },
            },
            {
              type: "Resource",
              resource: {
                name: "memory",
                target: {
                  type: "Utilization",
                  averageUtilization:
                    config.infrastructure.scaling.targetMemoryUtilization,
                },
              },
            },
          ],
        },
      };
    }

    return { deployment, service, configMap, hpa };
  }

  static generateDockerCompose(environment: string): any {
    const config = this.getConfig(environment);

    const compose = {
      version: "3.8",
      services: {
        "maria-multimodal": {
          image: config.infrastructure.containerization.image,
          ports: config.infrastructure.containerization.ports.map(
            (port) => `${port}:${port}`,
          ),
          environment: {
            NODE_ENV: environment,
            MARIA_CONFIG: JSON.stringify(config),
          },
          volumes: [
            `${config.multimodal.strategies.storage.basePath}:/app/data`,
            `${config.integration.fileSystem.workspacePath}:/app/workspace`,
          ],
          restart: "unless-stopped",
          healthcheck: {
            test: [
              `CMD`,
              `curl`,
              `-f`,
              `http://localhost:${config.infrastructure.containerization.ports[0]}${config.infrastructure.loadBalancing.healthCheckPath}`,
            ],
            interval: "30s",
            timeout: "10s",
            retries: 3,
          },
        },
      },
    };

    // Add database if enabled
    if (
      config.infrastructure.database.enabled &&
      config.infrastructure.database.type === "postgresql"
    ) {
      compose.services.postgres = {
        image: "postgres:13",
        environment: {
          POSTGRES_DB: "maria_" + environment,
          POSTGRES_USER: "maria",
          POSTGRES_PASSWORD: "password",
        },
        volumes: ["postgres_data:/var/lib/postgresql/data"],
        ports: ["5432:5432"],
      };
      compose.volumes = { postgres_data: {} };
    }

    // Add Redis if enabled
    if (config.infrastructure.redis.enabled) {
      compose.services.redis = {
        image: "redis:6-alpine",
        ports: ["6379:6379"],
        volumes: ["redis_data:/data"],
      };
      if (!compose.volumes) compose.volumes = {};
      compose.volumes.redis_data = {};
    }

    return compose;
  }

  static generateEnvironmentFile(environment: string): string {
    const config = this.getConfig(environment);

    const envVars = [
      `NODE_ENV=${environment}`,
      `MARIA_QUEUE_MAX_CONCURRENT=${config.multimodal.queue.maxConcurrent}`,
      `MARIA_QUEUE_TIMEOUT=${config.multimodal.queue.timeout}`,
      `MARIA_DEFAULT_PROVIDER=${config.multimodal.engine.defaultProvider}`,
      `MARIA_CACHE_ENABLED=${config.multimodal.engine.enableCaching}`,
      `MARIA_STORAGE_PATH=${config.multimodal.strategies.storage.basePath}`,
      `MARIA_STORAGE_RETENTION_DAYS=${config.multimodal.strategies.storage.retentionDays}`,
      `MARIA_MONITORING_ENABLED=${config.multimodal.strategies.monitoring.enabled}`,
      `MARIA_TELEMETRY_ENABLED=${config.multimodal.telemetry.enabled}`,
      `MARIA_LOG_LEVEL=${config.infrastructure.logging.level}`,
      `MARIA_METRICS_ENABLED=${config.infrastructure.metrics.enabled}`,
      `MARIA_TRACING_ENABLED=${config.infrastructure.tracing.enabled}`,
    ];

    // Add provider configurations
    Object.entries(config.multimodal.engine.providers).forEach(
      ([provider, providerConfig]) => {
        if (providerConfig.enabled) {
          envVars.push(`MARIA_${provider.toUpperCase()}_ENABLED=true`);
          envVars.push(
            `MARIA_${provider.toUpperCase()}_TIMEOUT=${providerConfig.timeout}`,
          );
          if (providerConfig.apiKey) {
            envVars.push(
              `MARIA_${provider.toUpperCase()}_API_KEY=${providerConfig.apiKey}`,
            );
          }
          if (providerConfig.baseURL) {
            envVars.push(
              `MARIA_${provider.toUpperCase()}_BASE_URL=${providerConfig.baseURL}`,
            );
          }
        }
      },
    );

    // Add database configuration if enabled
    if (config.infrastructure.database.enabled) {
      envVars.push(`MARIA_DATABASE_ENABLED=true`);
      envVars.push(
        `MARIA_DATABASE_TYPE=${config.infrastructure.database.type}`,
      );
      envVars.push(
        `MARIA_DATABASE_CONNECTION_STRING=${config.infrastructure.database.connectionString}`,
      );
    }

    // Add Redis configuration if enabled
    if (config.infrastructure.redis.enabled) {
      envVars.push(`MARIA_REDIS_ENABLED=true`);
      envVars.push(
        `MARIA_REDIS_CONNECTION_STRING=${config.infrastructure.redis.connectionString}`,
      );
      envVars.push(
        `MARIA_REDIS_KEY_PREFIX=${config.infrastructure.redis.keyPrefix}`,
      );
    }

    return envVars.join("\\n");
  }
}
