import { promises as _fs } from "fs";
import { _join } from "path";
import {
  _DashboardConfig,
  DashboardTemplate,
  TemplateVariable,
} from "./dashboard-engine";

export interface TemplateLibrary {
  categories: TemplateCategory[];
  templates: Record<string, DashboardTemplate>;
  customTemplates: Record<string, DashboardTemplate>;
}

export interface TemplateCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  templates: string[];
}

export interface TemplateGenerator {
  generateFromData(
    _data: any[],
    options: GenerationOptions,
  ): Promise<DashboardTemplate>;
  generateFromSchema(
    _schema: DataSchema,
    options: GenerationOptions,
  ): Promise<DashboardTemplate>;
  generateFromMetrics(
    _metrics: MetricDefinition[],
    options: GenerationOptions,
  ): Promise<DashboardTemplate>;
}

export interface GenerationOptions {
  name: string;
  description?: string;
  theme?: string;
  layout?: "grid" | "flow" | "masonry";
  refreshInterval?: number;
  autoRefresh?: boolean;
  includeAlerts?: boolean;
  customizations?: TemplateCustomization[];
}

export interface TemplateCustomization {
  panelId: string;
  property: string;
  value: any;
}

export interface DataSchema {
  fields: SchemaField[];
  relationships: SchemaRelationship[];
  metadata: Record<string, any>;
}

export interface SchemaField {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "array" | "object";
  description?: string;
  format?: string;
  nullable?: boolean;
  enum?: any[];
}

export interface SchemaRelationship {
  from: string;
  to: string;
  type: "one-to-one" | "one-to-many" | "many-to-many";
}

export interface MetricDefinition {
  name: string;
  type: "counter" | "gauge" | "histogram" | "summary";
  description: string;
  unit?: string;
  labels: string[];
  alerts?: AlertDefinition[];
}

export interface AlertDefinition {
  condition: string;
  threshold: number;
  severity: "info" | "warning" | "error" | "critical";
  message: string;
}

export class DashboardTemplateLibrary {
  private templates = new Map<string, DashboardTemplate>();
  private categories = new Map<string, TemplateCategory>();
  private customTemplates = new Map<string, DashboardTemplate>();

  constructor() {
    this.initializeBuiltinTemplates();
    this.initializeCategories();
  }

  private initializeCategories(): void {
    const categories: TemplateCategory[] = [
      {
        id: "infrastructure",
        name: "Infrastructure Monitoring",
        description: "Monitor servers, networks, and infrastructure components",
        icon: "🖥️",
        templates: [
          "system-overview",
          "network-monitoring",
          "disk-usage",
          "memory-analysis",
        ],
      },
      {
        id: "application",
        name: "Application Performance",
        description: "Monitor application metrics, performance, and health",
        icon: "📱",
        templates: [
          "app-performance",
          "api-monitoring",
          "error-tracking",
          "user-analytics",
        ],
      },
      {
        id: "business",
        name: "Business Metrics",
        description: "Track business KPIs and operational metrics",
        icon: "📊",
        templates: [
          "revenue-tracking",
          "user-engagement",
          "conversion-funnel",
          "growth-metrics",
        ],
      },
      {
        id: "security",
        name: "Security Monitoring",
        description: "Monitor security events and threats",
        icon: "🔒",
        templates: [
          "security-overview",
          "threat-detection",
          "access-monitoring",
          "vulnerability-tracking",
        ],
      },
      {
        id: "devops",
        name: "DevOps & CI/CD",
        description: "Monitor deployment pipelines and development workflows",
        icon: "🚀",
        templates: [
          "deployment-tracking",
          "build-pipeline",
          "test-results",
          "release-metrics",
        ],
      },
    ];

    categories.forEach((category) => {
      this.categories.set(category.id, category);
    });
  }

  private initializeBuiltinTemplates(): void {
    // System Overview Template
    this.templates.set("system-overview", {
      id: "system-overview",
      name: "System Overview",
      category: "infrastructure",
      description:
        "Comprehensive system monitoring dashboard with CPU, memory, disk, and network metrics",
      tags: ["system", "infrastructure", "monitoring"],
      config: {
        name: "${environment} System Overview",
        description:
          "System monitoring dashboard for ${environment} environment",
        layout: {
          type: "grid",
          columns: 4,
          gap: 16,
          responsive: true,
          breakpoints: Record<string, any>,
        },
        _panels: [
          {
            id: "cpu-usage",
            title: "CPU Usage (%)",
            type: "gauge",
            position: { x: 0, y: 0 },
            size: { width: 1, height: 1 },
            dataSource: {
              type: "metrics",
              query: 'cpu_usage_percent{instance="${instance}"}',
              params: Record<string, any>,
              cache: { enabled: true, ttl: 30 },
            },
            visualization: {
              renderer: "canvas",
              options: {
                min: 0,
                max: 100,
                unit: "%",
                thresholds: [
                  { value: 70, color: "#f39c12" },
                  { value: 90, color: "#e74c3c" },
                ],
              },
            },
            alerts: [
              {
                id: "high-cpu",
                condition: { field: "value", operator: "gt", value: 80 },
                severity: "warning",
                message: "High CPU usage detected",
                actions: [],
              },
            ],
            interactions: [],
          },
          {
            id: "memory-usage",
            title: "Memory Usage (%)",
            type: "gauge",
            position: { x: 1, y: 0 },
            size: { width: 1, height: 1 },
            dataSource: {
              type: "metrics",
              query: 'memory_usage_percent{instance="${instance}"}',
              params: Record<string, any>,
              cache: { enabled: true, ttl: 30 },
            },
            visualization: {
              renderer: "canvas",
              options: {
                min: 0,
                max: 100,
                unit: "%",
                thresholds: [
                  { value: 80, color: "#f39c12" },
                  { value: 95, color: "#e74c3c" },
                ],
              },
            },
            alerts: [],
            interactions: [],
          },
          {
            id: "disk-usage",
            title: "Disk Usage (%)",
            type: "gauge",
            position: { x: 2, y: 0 },
            size: { width: 1, height: 1 },
            dataSource: {
              type: "metrics",
              query: 'disk_usage_percent{instance="${instance}"}',
              params: Record<string, any>,
              cache: { enabled: true, ttl: 60 },
            },
            visualization: {
              renderer: "canvas",
              options: {
                min: 0,
                max: 100,
                unit: "%",
                thresholds: [
                  { value: 85, color: "#f39c12" },
                  { value: 95, color: "#e74c3c" },
                ],
              },
            },
            alerts: [],
            interactions: [],
          },
          {
            id: "network-io",
            title: "Network I/O (MB/s)",
            type: "line",
            position: { x: 3, y: 0 },
            size: { width: 1, height: 1 },
            dataSource: {
              type: "metrics",
              query: 'network_io_mbps{instance="${instance}"}',
              params: Record<string, any>,
              cache: { enabled: true, ttl: 15 },
            },
            visualization: {
              renderer: "canvas",
              options: Record<string, any>,
              series: [
                {
                  id: "network-in",
                  name: "Inbound",
                  type: "line",
                  data: "in",
                  color: "#3498db",
                },
                {
                  id: "network-out",
                  name: "Outbound",
                  type: "line",
                  data: "out",
                  color: "#e74c3c",
                },
              ],
            },
            alerts: [],
            interactions: [],
          },
          {
            id: "system-load",
            title: "System Load Average",
            type: "line",
            position: { x: 0, y: 1 },
            size: { width: 2, height: 1 },
            dataSource: {
              type: "metrics",
              query: 'system_load{instance="${instance}"}',
              params: Record<string, any>,
              cache: { enabled: true, ttl: 30 },
            },
            visualization: {
              renderer: "canvas",
              options: Record<string, any>,
              series: [
                {
                  id: "load1",
                  name: "1m",
                  type: "line",
                  data: "load1",
                  color: "#2ecc71",
                },
                {
                  id: "load5",
                  name: "5m",
                  type: "line",
                  data: "load5",
                  color: "#f39c12",
                },
                {
                  id: "load15",
                  name: "15m",
                  type: "line",
                  data: "load15",
                  color: "#e74c3c",
                },
              ],
            },
            alerts: [],
            interactions: [],
          },
          {
            id: "process-count",
            title: "Running Processes",
            type: "metric",
            position: { x: 2, y: 1 },
            size: { width: 1, height: 1 },
            dataSource: {
              type: "metrics",
              query: 'process_count{instance="${instance}"}',
              params: Record<string, any>,
              cache: { enabled: true, ttl: 60 },
            },
            visualization: { renderer: "canvas", options: Record<string, any> },
            alerts: [],
            interactions: [],
          },
          {
            id: "uptime",
            title: "System Uptime",
            type: "metric",
            position: { x: 3, y: 1 },
            size: { width: 1, height: 1 },
            dataSource: {
              type: "metrics",
              query: 'system_uptime{instance="${instance}"}',
              params: Record<string, any>,
              cache: { enabled: true, ttl: 300 },
            },
            visualization: {
              renderer: "canvas",
              options: {
                format: "duration",
                unit: "seconds",
              },
            },
            alerts: [],
            interactions: [],
          },
        ],
        refreshInterval: 30000,
        theme: { name: "${theme}" },
        filters: [
          {
            id: "instance-filter",
            name: "Instance",
            type: "select",
            field: "instance",
            options: [],
            defaultValue: "all",
          },
        ],
        variables: [
          {
            id: "instance",
            name: "instance",
            type: "query",
            value: "*",
            query: "label_values(cpu_usage_percent, instance)",
          },
        ],
        autoRefresh: true,
        permissions: {
          read: ["*"],
          write: ["admin"],
          admin: ["admin"],
          public: true,
        },
      } as any,
      variables: [
        {
          name: "environment",
          type: "string",
          description: "Environment name (e.g., production, staging)",
          defaultValue: "Production",
          required: true,
        },
        {
          name: "instance",
          type: "string",
          description: "Instance identifier or pattern",
          defaultValue: "*",
          required: false,
        },
        {
          name: "theme",
          type: "string",
          description: "Dashboard theme",
          defaultValue: "default",
          required: false,
        },
      ],
    });

    // Application Performance Template
    this.templates.set("app-performance", {
      id: "app-performance",
      name: "Application Performance Monitoring",
      category: "application",
      description:
        "Monitor application performance, response times, throughput, and errors",
      tags: ["application", "performance", "apm"],
      config: {
        name: "${service} Performance Dashboard",
        description: "Performance monitoring for ${service} application",
        layout: {
          type: "grid",
          columns: 3,
          gap: 16,
          responsive: true,
          breakpoints: Record<string, any>,
        },
        _panels: [
          {
            id: "response-time",
            title: "Response Time (ms)",
            type: "line",
            position: { x: 0, y: 0 },
            size: { width: 2, height: 1 },
            dataSource: {
              type: "metrics",
              query: 'http_request_duration_ms{service="${service}"}',
              params: Record<string, any>,
              cache: { enabled: true, ttl: 30 },
            },
            visualization: {
              renderer: "canvas",
              options: Record<string, any>,
              series: [
                {
                  id: "p50",
                  name: "50th percentile",
                  type: "line",
                  data: "p50",
                  color: "#3498db",
                },
                {
                  id: "p95",
                  name: "95th percentile",
                  type: "line",
                  data: "p95",
                  color: "#f39c12",
                },
                {
                  id: "p99",
                  name: "99th percentile",
                  type: "line",
                  data: "p99",
                  color: "#e74c3c",
                },
              ],
            },
            alerts: [
              {
                id: "high-latency",
                condition: { field: "p95", operator: "gt", value: 500 },
                severity: "warning",
                message: "High response time detected",
                actions: [],
              },
            ],
            interactions: [],
          },
          {
            id: "request-rate",
            title: "Request Rate (req/s)",
            type: "line",
            position: { x: 2, y: 0 },
            size: { width: 1, height: 1 },
            dataSource: {
              type: "metrics",
              query: 'http_requests_per_second{service="${service}"}',
              params: Record<string, any>,
              cache: { enabled: true, ttl: 30 },
            },
            visualization: {
              renderer: "canvas",
              options: Record<string, any>,
              series: [
                {
                  id: "requests",
                  name: "Requests/sec",
                  type: "line",
                  data: "rate",
                  color: "#2ecc71",
                },
              ],
            },
            alerts: [],
            interactions: [],
          },
          {
            id: "error-rate",
            title: "Error Rate (%)",
            type: "line",
            position: { x: 0, y: 1 },
            size: { width: 1, height: 1 },
            dataSource: {
              type: "metrics",
              query: 'http_error_rate_percent{service="${service}"}',
              params: Record<string, any>,
              cache: { enabled: true, ttl: 30 },
            },
            visualization: {
              renderer: "canvas",
              options: Record<string, any>,
              series: [
                {
                  id: "error-rate",
                  name: "Error Rate",
                  type: "line",
                  data: "rate",
                  color: "#e74c3c",
                },
              ],
            },
            alerts: [
              {
                id: "high-error-rate",
                condition: { field: "rate", operator: "gt", value: 5 },
                severity: "error",
                message: "High error rate detected",
                actions: [],
              },
            ],
            interactions: [],
          },
          {
            id: "status-codes",
            title: "HTTP Status Codes",
            type: "bar",
            position: { x: 1, y: 1 },
            size: { width: 1, height: 1 },
            dataSource: {
              type: "metrics",
              query: 'http_status_codes{service="${service}"}',
              params: Record<string, any>,
              cache: { enabled: true, ttl: 60 },
            },
            visualization: {
              renderer: "canvas",
              options: Record<string, any>,
              series: [
                {
                  id: "status-codes",
                  name: "Status Codes",
                  type: "bar",
                  data: "count",
                  xField: "code",
                  yField: "count",
                },
              ],
            },
            alerts: [],
            interactions: [],
          },
          {
            id: "active-connections",
            title: "Active Connections",
            type: "metric",
            position: { x: 2, y: 1 },
            size: { width: 1, height: 1 },
            dataSource: {
              type: "metrics",
              query: 'active_connections{service="${service}"}',
              params: Record<string, any>,
              cache: { enabled: true, ttl: 30 },
            },
            visualization: { renderer: "canvas", options: Record<string, any> },
            alerts: [],
            interactions: [],
          },
        ],
        refreshInterval: 30000,
        theme: { name: "${theme}" },
        filters: [],
        variables: [],
        autoRefresh: true,
        permissions: {
          read: ["*"],
          write: ["admin"],
          admin: ["admin"],
          public: false,
        },
      } as any,
      variables: [
        {
          name: "service",
          type: "string",
          description: "Service name",
          required: true,
        },
        {
          name: "theme",
          type: "string",
          description: "Dashboard theme",
          defaultValue: "default",
          required: false,
        },
      ],
    });

    // Security Monitoring Template
    this.templates.set("security-overview", {
      id: "security-overview",
      name: "Security Monitoring Dashboard",
      category: "security",
      description: "Monitor security events, threats, and access patterns",
      tags: ["security", "threats", "monitoring"],
      config: {
        name: "${environment} Security Overview",
        description: "Security monitoring dashboard for ${environment}",
        layout: {
          type: "grid",
          columns: 3,
          gap: 16,
          responsive: true,
          breakpoints: Record<string, any>,
        },
        _panels: [
          {
            id: "threat-level",
            title: "Current Threat Level",
            type: "gauge",
            position: { x: 0, y: 0 },
            size: { width: 1, height: 1 },
            dataSource: {
              type: "metrics",
              query: 'security_threat_level{environment="${environment}"}',
              params: Record<string, any>,
              cache: { enabled: true, ttl: 60 },
            },
            visualization: {
              renderer: "canvas",
              options: {
                min: 0,
                max: 10,
                thresholds: [
                  { value: 3, color: "#2ecc71" },
                  { value: 6, color: "#f39c12" },
                  { value: 8, color: "#e74c3c" },
                ],
              },
            },
            alerts: [
              {
                id: "high-threat",
                condition: { field: "level", operator: "gt", value: 7 },
                severity: "critical",
                message: "High threat level detected",
                actions: [],
              },
            ],
            interactions: [],
          },
          {
            id: "failed-logins",
            title: "Failed Login Attempts",
            type: "line",
            position: { x: 1, y: 0 },
            size: { width: 2, height: 1 },
            dataSource: {
              type: "events",
              query: 'failed_login_attempts{environment="${environment}"}',
              params: Record<string, any>,
              cache: { enabled: true, ttl: 30 },
            },
            visualization: {
              renderer: "canvas",
              options: Record<string, any>,
              series: [
                {
                  id: "failed-logins",
                  name: "Failed Logins",
                  type: "line",
                  data: "count",
                  color: "#e74c3c",
                },
              ],
            },
            alerts: [],
            interactions: [],
          },
          {
            id: "security-events",
            title: "Recent Security Events",
            type: "log",
            position: { x: 0, y: 1 },
            size: { width: 3, height: 2 },
            dataSource: {
              type: "logs",
              query:
                'security_events{environment="${environment}", level="warning|error|critical"}',
              params: Record<string, any>,
              cache: { enabled: false, ttl: 0 },
            },
            visualization: { renderer: "canvas", options: Record<string, any> },
            alerts: [],
            interactions: [],
          },
        ],
        refreshInterval: 60000,
        theme: { name: "${theme}" },
        filters: [],
        variables: [],
        autoRefresh: true,
        permissions: {
          read: ["security", "admin"],
          write: ["admin"],
          admin: ["admin"],
          public: false,
        },
      } as any,
      variables: [
        {
          name: "environment",
          type: "string",
          description: "Environment name",
          required: true,
        },
        {
          name: "theme",
          type: "string",
          description: "Dashboard theme",
          defaultValue: "dark",
          required: false,
        },
      ],
    });

    // Business Metrics Template
    this.templates.set("business-metrics", {
      id: "business-metrics",
      name: "Business Metrics Dashboard",
      category: "business",
      description: "Track key business metrics and KPIs",
      tags: ["business", "kpi", "metrics"],
      config: {
        name: "${company} Business Metrics",
        description: "Business KPI dashboard for ${company}",
        layout: {
          type: "grid",
          columns: 4,
          gap: 16,
          responsive: true,
          breakpoints: Record<string, any>,
        },
        _panels: [
          {
            id: "revenue",
            title: "Monthly Revenue ($)",
            type: "metric",
            position: { x: 0, y: 0 },
            size: { width: 1, height: 1 },
            dataSource: {
              type: "metrics",
              query: 'monthly_revenue{company="${company}"}',
              params: Record<string, any>,
              cache: { enabled: true, ttl: 3600 },
            },
            visualization: {
              renderer: "canvas",
              options: {
                format: "currency",
                currency: "USD",
              },
            },
            alerts: [],
            interactions: [],
          },
          {
            id: "active-users",
            title: "Active Users",
            type: "metric",
            position: { x: 1, y: 0 },
            size: { width: 1, height: 1 },
            dataSource: {
              type: "metrics",
              query: 'daily_active_users{company="${company}"}',
              params: Record<string, any>,
              cache: { enabled: true, ttl: 1800 },
            },
            visualization: { renderer: "canvas", options: Record<string, any> },
            alerts: [],
            interactions: [],
          },
          {
            id: "conversion-rate",
            title: "Conversion Rate (%)",
            type: "gauge",
            position: { x: 2, y: 0 },
            size: { width: 1, height: 1 },
            dataSource: {
              type: "metrics",
              query: 'conversion_rate{company="${company}"}',
              params: Record<string, any>,
              cache: { enabled: true, ttl: 1800 },
            },
            visualization: {
              renderer: "canvas",
              options: {
                min: 0,
                max: 100,
                unit: "%",
                thresholds: [
                  { value: 2, color: "#e74c3c" },
                  { value: 5, color: "#f39c12" },
                  { value: 10, color: "#2ecc71" },
                ],
              },
            },
            alerts: [],
            interactions: [],
          },
          {
            id: "customer-satisfaction",
            title: "Customer Satisfaction",
            type: "gauge",
            position: { x: 3, y: 0 },
            size: { width: 1, height: 1 },
            dataSource: {
              type: "metrics",
              query: 'customer_satisfaction_score{company="${company}"}',
              params: Record<string, any>,
              cache: { enabled: true, ttl: 3600 },
            },
            visualization: {
              renderer: "canvas",
              options: {
                min: 0,
                max: 10,
                thresholds: [
                  { value: 6, color: "#e74c3c" },
                  { value: 8, color: "#f39c12" },
                  { value: 9, color: "#2ecc71" },
                ],
              },
            },
            alerts: [],
            interactions: [],
          },
        ],
        refreshInterval: 1800000, // 30 minutes
        theme: { name: "${theme}" },
        filters: [],
        variables: [],
        autoRefresh: true,
        permissions: {
          read: ["business", "admin"],
          write: ["admin"],
          admin: ["admin"],
          public: false,
        },
      } as any,
      variables: [
        {
          name: "company",
          type: "string",
          description: "Company identifier",
          required: true,
        },
        {
          name: "theme",
          type: "string",
          description: "Dashboard theme",
          defaultValue: "professional",
          required: false,
        },
      ],
    });
  }

  getTemplate(templateId: string): DashboardTemplate | undefined {
    return (
      this.templates.get(templateId) || this.customTemplates.get(templateId)
    );
  }

  getAllTemplates(): DashboardTemplate[] {
    return [
      ...Array.from(this.templates.values()),
      ...Array.from(this.customTemplates.values()),
    ];
  }

  getTemplatesByCategory(categoryId: string): DashboardTemplate[] {
    return this.getAllTemplates().filter(
      (_template) => _template.category === categoryId,
    );
  }

  getCategories(): TemplateCategory[] {
    return Array.from(this.categories.values());
  }

  async createCustomTemplate(_template: DashboardTemplate): Promise<void> {
    this.validateTemplate(_template);
    this.customTemplates.set(template.id, _template);
  }

  async deleteCustomTemplate(templateId: string): Promise<void> {
    this.customTemplates.delete(templateId);
  }

  async exportTemplate(templateId: string): Promise<string> {
    const _template = this.getTemplate(templateId);
    if (!_template) {
      throw new Error(`Template '${templateId}' not found`);
    }
    return JSON.stringify(_template, null, 2);
  }

  async importTemplate(templateJson: string): Promise<DashboardTemplate> {
    const _template = JSON.parse(templateJson) as DashboardTemplate;
    this.validateTemplate(_template);
    await this.createCustomTemplate(_template);
    return _template;
  }

  searchTemplates(_query: string, category?: string): DashboardTemplate[] {
    const _searchTerm = _query.toLowerCase();
    let templates = this.getAllTemplates();

    if (category) {
      templates = templates.filter((t) => t.category === category);
    }

    return templates.filter((_template) => {
      const _searchableText = [
        _template.name,
        template.description,
        ..._template.tags,
      ]
        .join(" ")
        .toLowerCase();

      return _searchableText.includes(_searchTerm);
    });
  }

  private validateTemplate(_template: DashboardTemplate): void {
    if (!_template.id || !_template.name) {
      throw new Error("Template must have id and name");
    }

    if (!_template.config || !_template.config.panels) {
      throw new Error("Template must have config with _panels");
    }

    if (!_template.variables || !Array.isArray(_template.variables)) {
      throw new Error("Template must have variables array");
    }
  }
}

export class SmartTemplateGenerator implements TemplateGenerator {
  async generateFromData(
    _data: any[],
    options: GenerationOptions,
  ): Promise<DashboardTemplate> {
    if (_data.length === 0) {
      throw new Error("Cannot generate _template from empty data");
    }

    const _schema = this.inferSchema(_data);
    return this.generateFromSchema(_schema, options);
  }

  async generateFromSchema(
    _schema: DataSchema,
    options: GenerationOptions,
  ): Promise<DashboardTemplate> {
    const _panels = this.generatePanelsFromSchema(_schema, options);

    const _template: DashboardTemplate = {
      id: `generated_${Date.now()}`,
      name: options.name,
      category: "custom",
      description:
        options.description || `Auto-generated dashboard for ${options.name}`,
      tags: ["auto-generated"],
      config: {
        id: `dashboard_${Date.now()}`,
        name: options.name,
        description: options.description,
        layout: {
          type: options.layout || "grid",
          columns: this.calculateOptimalColumns(_panels.length),
          gap: 16,
          responsive: true,
          breakpoints: Record<string, any>,
        },
        _panels,
        refreshInterval: options.refreshInterval || 60000,
        theme: { name: options.theme || "default" },
        filters: this.generateFiltersFromSchema(_schema),
        variables: this.generateVariablesFromSchema(_schema),
        autoRefresh: options.autoRefresh !== false,
        permissions: {
          read: ["*"],
          write: ["admin"],
          admin: ["admin"],
          public: true,
        },
      } as any,
      variables: this.generateTemplateVariablesFromSchema(_schema),
    };

    return _template;
  }

  async generateFromMetrics(
    _metrics: MetricDefinition[],
    options: GenerationOptions,
  ): Promise<DashboardTemplate> {
    const _panels = _metrics.map((metric, _index) =>
      this.createPanelFromMetric(metric, _index),
    );

    const _template: DashboardTemplate = {
      id: `metrics_${Date.now()}`,
      name: options.name,
      category: "metrics",
      description:
        options.description || `Metrics dashboard for ${options.name}`,
      tags: ["metrics", "auto-generated"],
      config: {
        id: `metrics_dashboard_${Date.now()}`,
        name: options.name,
        description: options.description,
        layout: {
          type: options.layout || "grid",
          columns: this.calculateOptimalColumns(_panels.length),
          gap: 16,
          responsive: true,
          breakpoints: Record<string, any>,
        },
        _panels,
        refreshInterval: options.refreshInterval || 30000,
        theme: { name: options.theme || "default" },
        filters: [],
        variables: [],
        autoRefresh: options.autoRefresh !== false,
        permissions: {
          read: ["*"],
          write: ["admin"],
          admin: ["admin"],
          public: true,
        },
      } as any,
      variables: [],
    };

    return _template;
  }

  private inferSchema(data: any[]): DataSchema {
    const _sample = _data[0];
    const fields: SchemaField[] = [];

    for (const [key, value] of Object.entries(_sample)) {
      const field: SchemaField = {
        name: key,
        type: this.inferFieldType(value),
        nullable: _data.some((_item) => _item[key] == null),
      };

      // Check if it's an enum
      const _uniqueValues = [...new Set(_data.map((item) => _item[key]))];
      if (_uniqueValues.length <= 10 && typeof value === "string") {
        field.enum = _uniqueValues;
      }

      fields.push(field);
    }

    return {
      fields,
      relationships: [], // Would need more analysis to infer relationships
      metadata: {
        sampleCount: _data.length,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  private inferFieldType(value: unknown): SchemaField["type"] {
    if (value === null || value === undefined) return "string";
    if (typeof value === "number") return "number";
    if (typeof value === "boolean") return "boolean";
    if (value instanceof Date) return "date";
    if (typeof value === "string") {
      // Check if it looks like a date
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) return "date";
    }
    if (Array.isArray(value)) return "array";
    if (typeof value === "object") return "object";
    return "string";
  }

  private generatePanelsFromSchema(
    _schema: DataSchema,
    options: GenerationOptions,
  ): any[] {
    const _panels: any[] = [];
    let panelIndex = 0;

    for (const field of _schema.fields) {
      if (field.type === "number") {
        // Numeric fields become charts or metrics
        const _panelType = this.shouldUseChart(field, _schema)
          ? "line"
          : "metric";

        panels.push({
          id: `${field.name}-panel`,
          title: this.humanizeFieldName(field.name),
          type: _panelType,
          position: this.calculatePanelPosition(panelIndex, 3),
          size: { width: 1, height: 1 },
          dataSource: {
            type: "custom",
            query: `SELECT ${field.name} FROM data`,
            params: Record<string, any>,
            cache: { enabled: true, ttl: 60 },
          },
          visualization: { renderer: "canvas", options: Record<string, any> },
          alerts: options.includeAlerts
            ? this.generateAlertsForField(field)
            : [],
          interactions: [],
        });

        panelIndex++;
      } else if (field.type === "string" && field.enum) {
        // Enum fields become pie charts or bar charts
        panels.push({
          id: `${field.name}-distribution`,
          title: `${this.humanizeFieldName(field.name)} Distribution`,
          type: "pie",
          position: this.calculatePanelPosition(panelIndex, 3),
          size: { width: 1, height: 1 },
          dataSource: {
            type: "custom",
            query: `SELECT ${field.name}, COUNT(*) as count FROM data GROUP BY ${field.name}`,
            params: Record<string, any>,
            cache: { enabled: true, ttl: 300 },
          },
          visualization: { renderer: "canvas", options: Record<string, any> },
          alerts: [],
          interactions: [],
        });

        panelIndex++;
      }
    }

    return _panels;
  }

  private shouldUseChart(_field: SchemaField, _schema: DataSchema): boolean {
    // Use chart if there's likely a time dimension
    return (
      _schema.fields.some((f) => f.type === "date") ||
      _field.name.includes("time")
    );
  }

  private calculatePanelPosition(
    _index: number,
    columns: number,
  ): { x: number; y: number } {
    return {
      x: _index % columns,
      y: Math.floor(_index / columns),
    };
  }

  private calculateOptimalColumns(panelCount: number): number {
    if (panelCount <= 2) return panelCount;
    if (panelCount <= 6) return 3;
    return 4;
  }

  private humanizeFieldName(fieldName: string): string {
    return fieldName
      .replace(/[_-]/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  }

  private generateAlertsForField(field: SchemaField): any[] {
    if (field.type !== "number") return [];

    return [
      {
        id: `${field.name}-alert`,
        condition: { field: field.name, operator: "gt", value: 100 },
        severity: "warning",
        message: `High ${field.name} detected`,
        actions: [],
      },
    ];
  }

  private generateFiltersFromSchema(_schema: DataSchema): any[] {
    return _schema.fields
      .filter((field) => field.enum && field.enum.length <= 20)
      .map((field) => ({
        id: `${field.name}-filter`,
        name: this.humanizeFieldName(field.name),
        type: "select",
        field: field.name,
        options: field.enum!.map((value) => ({ label: String(value), value })),
        defaultValue: field.enum![0],
      }));
  }

  private generateVariablesFromSchema(_schema: DataSchema): any[] {
    return _schema.fields
      .filter((field) => field.type === "string" && field.enum)
      .slice(0, 5) // Limit to 5 variables
      .map((field) => ({
        id: field.name,
        name: field.name,
        type: "custom",
        value: field.enum![0],
      }));
  }

  private generateTemplateVariablesFromSchema(
    _schema: DataSchema,
  ): TemplateVariable[] {
    return _schema.fields
      .filter((field) => field.type === "string" && field.enum)
      .slice(0, 3) // Limit to 3 _template variables
      .map((field) => ({
        name: field.name,
        type: "string",
        description: `${this.humanizeFieldName(field.name)} selection`,
        defaultValue: field.enum![0],
        required: false,
      }));
  }

  private createPanelFromMetric(
    _metric: MetricDefinition,
    index: number,
  ): unknown {
    const _panelType = this.getPanelTypeForMetric(_metric.type);

    return {
      id: `${_metric.name}-panel`,
      title: this.humanizeFieldName(_metric.name),
      type: _panelType,
      position: this.calculatePanelPosition(index, 3),
      size: { width: 1, height: 1 },
      dataSource: {
        type: "metrics",
        query: _metric.name,
        params: Record<string, any>,
        cache: { enabled: true, ttl: 30 },
      },
      visualization: {
        renderer: "canvas",
        options: {
          unit: _metric.unit,
        },
      },
      alerts: _metric.alerts
        ? _metric.alerts.map((alert) => ({
            id: `${_metric.name}-${alert.condition}`,
            condition: {
              field: "value",
              operator: "gt",
              value: alert.threshold,
            },
            severity: alert.severity,
            message: alert.message,
            actions: [],
          }))
        : [],
      interactions: [],
    };
  }

  private getPanelTypeForMetric(metricType: string): string {
    switch (metricType) {
      case "counter":
        return "line";
      case "gauge":
        return "gauge";
      case "histogram":
        return "histogram";
      case "summary":
        return "line";
      default:
        return "metric";
    }
  }
}
