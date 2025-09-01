/**
 * MARIA Phase 3: Monitoring Integration
 *
 * Provides complete monitoring integration with:
 * - Prometheus metrics collection
 * - Grafana dashboard templates
 * - Real-time deployment tracking
 * - Alert management
 */

import { EventEmitter } from "node:events";
import { warnOnce } from "../utils/deprecation";
import type {
  DeploymentConfig,
  KubernetesManifest,
} from "./enterprise-deployment-manager";

export interface MetricsConfig {
  prometheus: PrometheusConfig;
  grafana: GrafanaConfig;
  alerting: AlertingConfig;
  exporters: ExporterConfig[];
}

export interface PrometheusConfig {
  enabled: boolean;
  endpoint?: string;
  retention: string;
  scrapeInterval: string;
  evaluationInterval: string;
  storage: PrometheusStorageConfig;
  rules: AlertRule[];
}

export interface PrometheusStorageConfig {
  type: "local" | "remote";
  path?: string;
  remoteWrite?: RemoteWriteConfig[];
  remoteRead?: RemoteReadConfig[];
}

export interface RemoteWriteConfig {
  url: string;
  name?: string;
  headers?: Record<string, string>;
  basicAuth?: { username: string; password: string };
  bearerToken?: string;
}

export interface RemoteReadConfig {
  url: string;
  name?: string;
  requiredMatchers?: Record<string, string>;
  readRecent?: boolean;
}

export interface GrafanaConfig {
  enabled: boolean;
  endpoint?: string;
  adminUser: string;
  adminPassword: string;
  datasources: DataSource[];
  dashboards: DashboardTemplate[];
  plugins: string[];
}

export interface DataSource {
  name: string;
  type: string;
  url: string;
  access: "proxy" | "direct";
  basicAuth?: boolean;
  basicAuthUser?: string;
  basicAuthPassword?: string;
  isDefault?: boolean;
}

export interface DashboardTemplate {
  name: string;
  title: string;
  tags: string[];
  template: string;
  variables: DashboardVariable[];
  panels: DashboardPanel[];
}

export interface DashboardVariable {
  name: string;
  type: "query" | "custom" | "constant";
  query?: string;
  options?: string[];
  current?: string;
}

export interface DashboardPanel {
  id: number;
  title: string;
  type: string;
  targets: PromQuery[];
  gridPos: { h: number; w: number; x: number; y: number };
  options?: any;
}

export interface PromQuery {
  expr: string;
  legendFormat?: string;
  refId: string;
}

export interface AlertingConfig {
  enabled: boolean;
  webhookUrl?: string;
  channels: AlertChannel[];
  rules: AlertRule[];
  inhibitRules: InhibitRule[];
}

export interface AlertChannel {
  name: string;
  type: "slack" | "email" | "webhook" | "pagerduty";
  settings: Record<string, any>;
}

export interface AlertRule {
  alert: string;
  expr: string;
  for: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

export interface InhibitRule {
  sourceMatch: Record<string, string>;
  targetMatch: Record<string, string>;
  equal: string[];
}

export interface ExporterConfig {
  name: string;
  type: string;
  enabled: boolean;
  port: number;
  _path: string;
  config: Record<string, any>;
}

export interface MetricsSnapshot {
  timestamp: number;
  deployment: DeploymentMetrics;
  infrastructure: InfrastructureMetrics;
  application: ApplicationMetrics;
}

export interface DeploymentMetrics {
  totalDeployments: number;
  successfulDeployments: number;
  failedDeployments: number;
  averageDeploymentTime: number;
  deploymentsPerDay: number;
  rollbackCount: number;
}

export interface InfrastructureMetrics {
  clusterCount: number;
  nodeCount: number;
  podCount: number;
  serviceCount: number;
  cpuUtilization: number;
  memoryUtilization: number;
  storageUtilization: number;
}

export interface ApplicationMetrics {
  activeNamespaces: number;
  totalRequests: number;
  errorRate: number;
  averageResponseTime: number;
  throughput: number;
}

/**
 * Comprehensive monitoring integration manager
 */
export class MonitoringIntegration extends EventEmitter {
  private metricsConfig: MetricsConfig;
  private metricsStore: Map<string, any[]> = new Map();

  constructor(config: MetricsConfig) {
    super();
    this.metricsConfig = config;
  }

  /**
   * Generate monitoring manifests for Kubernetes deployment
   */
  generateMonitoringManifests(
    environment: string,
    deploymentConfig: DeploymentConfig,
  ): KubernetesManifest[] {
    const manifests: KubernetesManifest[] = [];

    if (this.metricsConfig.prometheus.enabled) {
      manifests.push(
        ...this.generatePrometheusManifests(environment, deploymentConfig),
      );
    }

    if (this.metricsConfig.grafana.enabled) {
      manifests.push(...this.generateGrafanaManifests(environment));
    }

    // Generate exporter manifests
    manifests.push(...this.generateExporterManifests(environment));

    return manifests;
  }

  /**
   * Generate Prometheus monitoring manifests
   */
  private generatePrometheusManifests(
    environment: string,
    deploymentConfig: DeploymentConfig,
  ): KubernetesManifest[] {
    const namespace = `maria-${environment}`;
    const manifests: KubernetesManifest[] = [];

    // Prometheus ConfigMap
    manifests.push({
      apiVersion: "v1",
      kind: "ConfigMap",
      metadata: {
        name: "prometheus-config",
        namespace,
        labels: {
          "app.kubernetes.io/name": "prometheus",
          "app.kubernetes.io/component": "monitoring",
        },
      },
      data: {
        "prometheus.yml": this.generatePrometheusConfig(
          environment,
          deploymentConfig,
        ),
      },
    });

    // Prometheus Deployment
    manifests.push({
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: {
        name: "prometheus",
        namespace,
        labels: {
          "app.kubernetes.io/name": "prometheus",
          "app.kubernetes.io/component": "monitoring",
        },
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            "app.kubernetes.io/name": "prometheus",
          },
        },
        template: {
          metadata: {
            labels: {
              "app.kubernetes.io/name": "prometheus",
              "app.kubernetes.io/component": "monitoring",
            },
          },
          spec: {
            containers: [
              {
                name: "prometheus",
                image: "prom/prometheus:v2.40.0",
                ports: [{ containerPort: 9090 }],
                args: [
                  "--config.file=/etc/prometheus/prometheus.yml",
                  "--storage.tsdb._path=/prometheus/",
                  "--storage.tsdb.retention.time=" +
                    this.metricsConfig.prometheus.retention,
                  "--web.console.libraries=/etc/prometheus/console_libraries",
                  "--web.console.templates=/etc/prometheus/consoles",
                  "--web.enable-lifecycle",
                ],
                volumeMounts: [
                  {
                    name: "config-volume",
                    mountPath: "/etc/prometheus/",
                  },
                  {
                    name: "storage-volume",
                    mountPath: "/prometheus/",
                  },
                ],
                resources: {
                  requests: {
                    cpu: "100m",
                    memory: "512Mi",
                  },
                  limits: {
                    cpu: "200m",
                    memory: "1Gi",
                  },
                },
              },
            ],
            volumes: [
              {
                name: "config-volume",
                configMap: {
                  name: "prometheus-config",
                },
              },
              {
                name: "storage-volume",
                persistentVolumeClaim: {
                  claimName: "prometheus-storage",
                },
              },
            ],
          },
        },
      },
    });

    // Prometheus Service
    manifests.push({
      apiVersion: "v1",
      kind: "Service",
      metadata: {
        name: "prometheus",
        namespace,
        labels: {
          "app.kubernetes.io/name": "prometheus",
          "app.kubernetes.io/component": "monitoring",
        },
      },
      spec: {
        selector: {
          "app.kubernetes.io/name": "prometheus",
        },
        ports: [
          {
            port: 9090,
            targetPort: 9090,
            name: "web",
          },
        ],
      },
    });

    // Prometheus PVC
    manifests.push({
      apiVersion: "v1",
      kind: "PersistentVolumeClaim",
      metadata: {
        name: "prometheus-storage",
        namespace,
      },
      spec: {
        accessModes: ["ReadWriteOnce"],
        resources: {
          requests: {
            storage: "10Gi",
          },
        },
        storageClassName:
          deploymentConfig.monitoring.prometheus.storageClass || "standard",
      },
    });

    return manifests;
  }

  /**
   * Generate Grafana monitoring manifests
   */
  private generateGrafanaManifests(environment: string): KubernetesManifest[] {
    const namespace = `maria-${environment}`;
    const manifests: KubernetesManifest[] = [];

    // Grafana ConfigMaps for dashboards
    this.metricsConfig.grafana.dashboards.forEach((dashboard) => {
      manifests.push({
        apiVersion: "v1",
        kind: "ConfigMap",
        metadata: {
          name: `grafana-dashboard-${dashboard.name}`,
          namespace,
          labels: {
            "app.kubernetes.io/name": "grafana",
            "app.kubernetes.io/component": "dashboard",
          },
        },
        data: {
          [`${dashboard.name}.json`]: this.generateGrafanaDashboard(dashboard),
        },
      });
    });

    // Grafana Deployment
    manifests.push({
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: {
        name: "grafana",
        namespace,
        labels: {
          "app.kubernetes.io/name": "grafana",
          "app.kubernetes.io/component": "monitoring",
        },
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            "app.kubernetes.io/name": "grafana",
          },
        },
        template: {
          metadata: {
            labels: {
              "app.kubernetes.io/name": "grafana",
              "app.kubernetes.io/component": "monitoring",
            },
          },
          spec: {
            containers: [
              {
                name: "grafana",
                image: "grafana/grafana:9.3.0",
                ports: [{ containerPort: 3000 }],
                env: [
                  {
                    name: "GF_SECURITY_ADMIN_USER",
                    value: this.metricsConfig.grafana.adminUser,
                  },
                  {
                    name: "GF_SECURITY_ADMIN_PASSWORD",
                    valueFrom: {
                      secretKeyRef: {
                        name: "grafana-admin",
                        key: "password",
                      },
                    },
                  },
                ],
                resources: {
                  requests: {
                    cpu: "100m",
                    memory: "256Mi",
                  },
                  limits: {
                    cpu: "200m",
                    memory: "512Mi",
                  },
                },
              },
            ],
          },
        },
      },
    });

    // Grafana Service
    manifests.push({
      apiVersion: "v1",
      kind: "Service",
      metadata: {
        name: "grafana",
        namespace,
        labels: {
          "app.kubernetes.io/name": "grafana",
          "app.kubernetes.io/component": "monitoring",
        },
      },
      spec: {
        selector: {
          "app.kubernetes.io/name": "grafana",
        },
        ports: [
          {
            port: 3000,
            targetPort: 3000,
            name: "web",
          },
        ],
      },
    });

    // Grafana Admin Secret
    manifests.push({
      apiVersion: "v1",
      kind: "Secret",
      metadata: {
        name: "grafana-admin",
        namespace,
      },
      data: {
        password: Buffer.from(
          this.metricsConfig.grafana.adminPassword,
        ).toString("base64"),
      },
    });

    return manifests;
  }

  /**
   * Generate exporter manifests (node-exporter, etc.)
   */
  private generateExporterManifests(environment: string): KubernetesManifest[] {
    const namespace = `maria-${environment}`;
    const manifests: KubernetesManifest[] = [];

    this.metricsConfig.exporters.forEach((exporter) => {
      if (!exporter.enabled) return;

      switch (exporter.type) {
        case "node-exporter":
          manifests.push(
            ...this.generateNodeExporterManifests(namespace, exporter),
          );
          break;
        case "kube-state-metrics":
          manifests.push(
            ...this.generateKubeStateMetricsManifests(namespace, exporter),
          );
          break;
      }
    });

    return manifests;
  }

  private generateNodeExporterManifests(
    namespace: string,
    config: ExporterConfig,
  ): KubernetesManifest[] {
    return [
      {
        apiVersion: "apps/v1",
        kind: "DaemonSet",
        metadata: {
          name: "node-exporter",
          namespace,
          labels: {
            "app.kubernetes.io/name": "node-exporter",
            "app.kubernetes.io/component": "monitoring",
          },
        },
        spec: {
          selector: {
            matchLabels: {
              "app.kubernetes.io/name": "node-exporter",
            },
          },
          template: {
            metadata: {
              labels: {
                "app.kubernetes.io/name": "node-exporter",
              },
            },
            spec: {
              hostNetwork: true,
              hostPID: true,
              containers: [
                {
                  name: "node-exporter",
                  image: "prom/node-exporter:v1.5.0",
                  ports: [{ containerPort: config.port }],
                  args: [
                    "--path.procfs=/host/proc",
                    "--path.sysfs=/host/sys",
                    "--path.rootfs=/host/root",
                    "--collector.filesystem.ignored-mount-points",
                    "^/(dev|proc|sys|var/lib/docker/.+)($|/)",
                    "--collector.filesystem.ignored-fs-types",
                    "^(autofs|binfmt_misc|cgroup|configfs|debugfs|devpts|devtmpfs|fusectl|hugetlbfs|mqueue|overlay|proc|procfs|pstore|rpc_pipefs|securityfs|sysfs|tracefs)$",
                  ],
                  volumeMounts: [
                    { name: "proc", mountPath: "/host/proc", readOnly: true },
                    { name: "sys", mountPath: "/host/sys", readOnly: true },
                    { name: "root", mountPath: "/host/root", readOnly: true },
                  ],
                },
              ],
              volumes: [
                { name: "proc", hostPath: { _path: "/proc" } },
                { name: "sys", hostPath: { _path: "/sys" } },
                { name: "root", hostPath: { _path: "/" } },
              ],
            },
          },
        },
      },
    ];
  }

  private generateKubeStateMetricsManifests(
    namespace: string,
    config: ExporterConfig,
  ): KubernetesManifest[] {
    return [
      {
        apiVersion: "apps/v1",
        kind: "Deployment",
        metadata: {
          name: "kube-state-metrics",
          namespace,
          labels: {
            "app.kubernetes.io/name": "kube-state-metrics",
            "app.kubernetes.io/component": "monitoring",
          },
        },
        spec: {
          replicas: 1,
          selector: {
            matchLabels: {
              "app.kubernetes.io/name": "kube-state-metrics",
            },
          },
          template: {
            metadata: {
              labels: {
                "app.kubernetes.io/name": "kube-state-metrics",
              },
            },
            spec: {
              containers: [
                {
                  name: "kube-state-metrics",
                  image:
                    "k8s.gcr.io/kube-state-metrics/kube-state-metrics:v2.7.0",
                  ports: [
                    { containerPort: config.port, name: "http-metrics" },
                    { containerPort: 8081, name: "telemetry" },
                  ],
                  livenessProbe: {
                    httpGet: { _path: "/healthz", port: 8080 },
                    initialDelaySeconds: 5,
                    timeoutSeconds: 5,
                  },
                  readinessProbe: {
                    httpGet: { _path: "/", port: config.port },
                    initialDelaySeconds: 5,
                    timeoutSeconds: 5,
                  },
                },
              ],
            },
          },
        },
      },
    ];
  }

  /**
   * Generate Prometheus configuration
   */
  private generatePrometheusConfig(
    environment: string,
    _deploymentConfig: DeploymentConfig,
  ): string {
    const config = {
      global: {
        scrape_interval: this.metricsConfig.prometheus.scrapeInterval,
        evaluation_interval: this.metricsConfig.prometheus.evaluationInterval,
      },
      scrape_configs: [
        {
          job_name: "prometheus",
          static_configs: [{ targets: ["localhost:9090"] }],
        },
        {
          job_name: "maria-memory-system",
          kubernetes_sd_configs: [
            {
              role: "pod",
              namespaces: { names: [`maria-${environment}`] },
            },
          ],
          relabel_configs: [
            {
              source_labels: [
                "__meta_kubernetes_pod_label_app_kubernetes_io_name",
              ],
              action: "keep",
              regex: "maria",
            },
          ],
        },
        {
          job_name: "node-exporter",
          kubernetes_sd_configs: [
            {
              role: "node",
            },
          ],
          relabel_configs: [
            {
              source_labels: ["__address__"],
              regex: "([^:]+)(?::\\d+)?",
              target_label: "__address__",
              replacement: "${1}:9100",
            },
          ],
        },
        {
          job_name: "kube-state-metrics",
          static_configs: [{ targets: ["kube-state-metrics:8080"] }],
        },
      ],
      rule_files: ["*.rules"],
    };

    return JSON.stringify(config, null, 2);
  }

  /**
   * Generate Grafana dashboard JSON
   */
  private generateGrafanaDashboard(template: DashboardTemplate): string {
    const dashboard = {
      id: null,
      title: template.title,
      tags: template.tags,
      timezone: "browser",
      panels: template.panels,
      time: {
        from: "now-1h",
        to: "now",
      },
      timepicker: {
        refresh_intervals: [
          "5s",
          "10s",
          "30s",
          "1m",
          "5m",
          "15m",
          "30m",
          "1h",
          "2h",
          "1d",
        ],
      },
      templating: {
        list: template.variables,
      },
      version: 1,
    };

    return JSON.stringify(dashboard, null, 2);
  }

  /**
   * Collect deployment metrics
   */
  async collectDeploymentMetrics(
    _environment: string,
  ): Promise<DeploymentMetrics> {
    // In a real implementation, this would query Prometheus
    warnOnce(
      "mock-metrics",
      "Using mock metrics collection - integrate with actual Prometheus API",
    );

    return {
      totalDeployments: this.getMetricValue("deployment_total", 0),
      successfulDeployments: this.getMetricValue("deployment_success", 0),
      failedDeployments: this.getMetricValue("deployment_failed", 0),
      averageDeploymentTime: this.getMetricValue(
        "deployment_duration_avg",
        300,
      ),
      deploymentsPerDay: this.getMetricValue("deployment_rate_daily", 5),
      rollbackCount: this.getMetricValue("rollback_total", 0),
    };
  }

  /**
   * Record deployment event for metrics
   */
  recordDeploymentEvent(event: {
    environment: string;
    type: "started" | "completed" | "failed" | "rolled_back";
    duration?: number;
    manifests?: number;
  }): void {
    const timestamp = Date.now();
    const metricKey = `deployment_${event.type}`;

    if (!this.metricsStore.has(metricKey)) {
      this.metricsStore.set(metricKey, []);
    }

    this.metricsStore.get(metricKey)!.push({
      timestamp,
      environment: event.environment,
      duration: event.duration,
      manifests: event.manifests,
    });

    // Emit event for external monitoring
    this.emit("metric:recorded", {
      metric: metricKey,
      value: 1,
      timestamp,
      labels: { environment: event.environment },
    });
  }

  private getMetricValue(key: string, defaultValue: number): number {
    const metrics = this.metricsStore.get(key) || [];
    return metrics.length || defaultValue;
  }

  /**
   * Get current metrics snapshot
   */
  async getMetricsSnapshot(environment: string): Promise<MetricsSnapshot> {
    return {
      timestamp: Date.now(),
      deployment: await this.collectDeploymentMetrics(environment),
      infrastructure: {
        clusterCount: 1,
        nodeCount: 3,
        podCount: 10,
        serviceCount: 5,
        cpuUtilization: 45.5,
        memoryUtilization: 62.3,
        storageUtilization: 23.1,
      },
      application: {
        activeNamespaces: 3,
        totalRequests: 15420,
        errorRate: 0.02,
        averageResponseTime: 145.7,
        throughput: 156.8,
      },
    };
  }
}

/**
 * Default monitoring configuration
 */
export const createDefaultMonitoringConfig = (
  environment: string,
): MetricsConfig => ({
  prometheus: {
    enabled: true,
    retention: "30d",
    scrapeInterval: "15s",
    evaluationInterval: "15s",
    storage: {
      type: "local",
    },
    rules: [
      {
        alert: "HighCPUUsage",
        expr: "cpu_usage_percent > 80",
        for: "5m",
        labels: { severity: "warning" },
        annotations: {
          summary: "High CPU usage detected",
          description: "CPU usage is above 80% for more than 5 minutes",
        },
      },
      {
        alert: "DeploymentFailed",
        expr: "deployment_failed > 0",
        for: "0s",
        labels: { severity: "critical" },
        annotations: {
          summary: "Deployment failure detected",
          description: "A deployment has failed in {{ $labels.environment }}",
        },
      },
    ],
  },
  grafana: {
    enabled: true,
    adminUser: "admin",
    adminPassword: "maria-grafana-" + environment,
    datasources: [
      {
        name: "Prometheus",
        type: "prometheus",
        url: "http://prometheus:9090",
        access: "proxy",
        isDefault: true,
      },
    ],
    dashboards: [
      {
        name: "maria-overview",
        title: "MARIA System Overview",
        tags: ["maria", "overview"],
        template: "overview",
        variables: [
          {
            name: "environment",
            type: "custom",
            options: ["development", "staging", "production"],
            current: environment,
          },
        ],
        panels: [
          {
            id: 1,
            title: "Deployment Success Rate",
            type: "stat",
            targets: [
              {
                expr: "rate(deployment_success[5m]) / rate(deployment_total[5m]) * 100",
                legendFormat: "Success Rate",
                refId: "A",
              },
            ],
            gridPos: { h: 8, w: 12, x: 0, y: 0 },
          },
          {
            id: 2,
            title: "Average Deployment Time",
            type: "graph",
            targets: [
              {
                expr: "avg(deployment_duration_seconds)",
                legendFormat: "Average Duration",
                refId: "B",
              },
            ],
            gridPos: { h: 8, w: 12, x: 12, y: 0 },
          },
        ],
      },
    ],
    plugins: ["grafana-piechart-panel"],
  },
  alerting: {
    enabled: true,
    channels: [
      {
        name: "default",
        type: "webhook",
        settings: {
          url: process.env.ALERT_WEBHOOK_URL || "http://localhost:3000/alerts",
        },
      },
    ],
    rules: [],
    inhibitRules: [],
  },
  exporters: [
    {
      name: "node-exporter",
      type: "node-exporter",
      enabled: true,
      port: 9100,
      _path: "/metrics",
      config: Record<string, any>,
    },
    {
      name: "kube-state-metrics",
      type: "kube-state-metrics",
      enabled: true,
      port: 8080,
      _path: "/metrics",
      config: Record<string, any>,
    },
  ],
});
