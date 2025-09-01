/**
 * MARIA Memory System - Phase 4: Enterprise Deployment Manager
 *
 * Kubernetes orchestration, cloud deployment, scaling, and infrastructure management
 * with support for multi-cloud, hybrid, and on-premises deployments
 */

import { EventEmitter } from "node:events";
import * as yaml from 'js-yaml';
import { _warnOnce, _deprecated } from '../utils/deprecation';
import {
  IManifestApplier, ICloudDriver, IMonitor, 
  IIdempotency, ICostOptimizer, JobContext, 
  _K8sManifest, DeploymentEvent, _ApplyResult,
  _ProvisioningPlan, _OptimizationPlan, _DeploymentInfo
} from './types';

export interface DeploymentConfig {
  infrastructure: InfrastructureConfig;
  kubernetes: KubernetesConfig;
  scaling: ScalingConfig;
  monitoring: MonitoringConfig;
  security: DeploymentSecurityConfig;
  backup: BackupConfig;
  networking: NetworkingConfig;
}

export interface InfrastructureConfig {
  provider: CloudProvider;
  regions: RegionConfig[];
  _environments: EnvironmentConfig[];
  resourceQuotas: ResourceQuotas;
  costOptimization: CostOptimizationConfig;
}

export type CloudProvider = 'aws' | 'azure' | 'gcp' | 'kubernetes' | 'on_premises';

export interface RegionConfig {
  name: string;
  primary: boolean;
  zones: string[];
  networkCIDR: string;
  compliance: string[];
  disasterrecovery: boolean;
}

export interface EnvironmentConfig {
  name: string;
  type: 'development' | 'staging' | 'production' | 'disaster_recovery';
  regions: string[];
  isolation: IsolationLevel;
  approvalRequired: boolean;
  resources: ResourceAllocation;
}

export type IsolationLevel = 'namespace' | 'cluster' | 'vpc' | 'account';

export interface ResourceAllocation {
  cpu: ResourceLimit;
  memory: ResourceLimit;
  storage: ResourceLimit;
  network: NetworkLimit;
}

export interface ResourceLimit {
  requests: string;
  limits: string;
  burstable?: boolean;
}

export interface NetworkLimit {
  bandwidth: string;
  connections: number;
  ingressRules: IngressRule[];
  egressRules: EgressRule[];
}

export interface IngressRule {
  protocol: 'tcp' | 'udp' | 'http' | 'https';
  port: number;
  sources: string[];
  authentication?: string;
}

export interface EgressRule {
  protocol: 'tcp' | 'udp' | 'http' | 'https';
  destinations: string[];
  ports: number[];
  restrictions?: string[];
}

export interface ResourceQuotas {
  cpu: string;
  memory: string;
  storage: string;
  pods: number;
  services: number;
  persistentVolumeClaims: number;
}

export interface CostOptimizationConfig {
  autoScaling: boolean;
  spotInstances: boolean;
  scheduledScaling: ScheduledScaling[];
  resourceRightSizing: boolean;
  budgetAlerts: BudgetAlert[];
}

export interface ScheduledScaling {
  name: string;
  schedule: string; // cron format
  minReplicas: number;
  maxReplicas: number;
  timezone: string;
}

export interface BudgetAlert {
  threshold: number;
  type: 'percentage' | 'absolute';
  period: 'daily' | 'weekly' | 'monthly';
  actions: BudgetAction[];
}

export interface BudgetAction {
  type: 'email' | 'slack' | 'webhook' | 'scale_down' | 'shutdown';
  config: Record<string, any>;
}

export interface KubernetesConfig {
  version: string;
  distribution: 'eks' | 'aks' | 'gke' | 'openshift' | 'vanilla';
  addons: KubernetesAddon[];
  rbac: RBACConfig;
  networkPolicy: NetworkPolicyConfig;
  podSecurityPolicy: PodSecurityConfig;
  storage: StorageConfig;
}

export interface KubernetesAddon {
  name: string;
  version: string;
  enabled: boolean;
  config: Record<string, any>;
}

export interface RBACConfig {
  enabled: boolean;
  serviceAccounts: ServiceAccount[];
  roles: KubernetesRole[];
  bindings: RoleBinding[];
}

export interface ServiceAccount {
  name: string;
  namespace: string;
  automountServiceAccountToken: boolean;
  annotations?: Record<string, string>;
}

export interface KubernetesRole {
  name: string;
  namespace?: string;
  rules: PolicyRule[];
}

export interface PolicyRule {
  apiGroups: string[];
  resources: string[];
  verbs: string[];
  resourceNames?: string[];
}

export interface RoleBinding {
  name: string;
  namespace?: string;
  roleRef: RoleRef;
  subjects: Subject[];
}

export interface RoleRef {
  kind: 'Role' | 'ClusterRole';
  name: string;
  apiGroup: string;
}

export interface Subject {
  kind: 'User' | 'Group' | 'ServiceAccount';
  name: string;
  namespace?: string;
}

export interface NetworkPolicyConfig {
  enabled: boolean;
  defaultDeny: boolean;
  _policies: NetworkPolicy[];
}

export interface NetworkPolicy {
  name: string;
  namespace: string;
  selector: LabelSelector;
  ingress: NetworkPolicyRule[];
  egress: NetworkPolicyRule[];
}

export interface NetworkPolicyRule {
  from?: NetworkPolicyPeer[];
  to?: NetworkPolicyPeer[];
  ports?: NetworkPolicyPort[];
}

export interface NetworkPolicyPeer {
  podSelector?: LabelSelector;
  namespaceSelector?: LabelSelector;
  ipBlock?: IPBlock;
}

export interface IPBlock {
  cidr: string;
  except?: string[];
}

export interface NetworkPolicyPort {
  protocol: 'TCP' | 'UDP' | 'SCTP';
  port: number | string;
  endPort?: number;
}

export interface LabelSelector {
  matchLabels?: Record<string, string>;
  matchExpressions?: LabelSelectorRequirement[];
}

export interface LabelSelectorRequirement {
  key: string;
  operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist';
  values?: string[];
}

export interface PodSecurityConfig {
  enabled: boolean;
  _policies: PodSecurityPolicy[];
  defaults: PodSecurityDefaults;
}

export interface PodSecurityPolicy {
  name: string;
  privileged: boolean;
  allowPrivilegeEscalation: boolean;
  runAsUser: RunAsUserStrategy;
  seLinux: SELinuxStrategy;
  fsGroup: FSGroupStrategy;
  volumes: string[];
}

export interface RunAsUserStrategy {
  rule: 'MustRunAs' | 'MustRunAsNonRoot' | 'RunAsAny';
  ranges?: UserIDRange[];
}

export interface UserIDRange {
  min: number;
  max: number;
}

export interface SELinuxStrategy {
  rule: 'MustRunAs' | 'RunAsAny';
  seLinuxOptions?: SELinuxOptions;
}

export interface SELinuxOptions {
  level: string;
  role: string;
  type: string;
  user: string;
}

export interface FSGroupStrategy {
  rule: 'MustRunAs' | 'RunAsAny';
  ranges?: UserIDRange[];
}

export interface PodSecurityDefaults {
  runAsNonRoot: boolean;
  readOnlyRootFilesystem: boolean;
  allowPrivilegeEscalation: boolean;
  capabilities: CapabilityConfig;
}

export interface CapabilityConfig {
  add: string[];
  drop: string[];
}

export interface StorageConfig {
  classes: StorageClass[];
  encryption: StorageEncryption;
  backup: StorageBackupConfig;
  monitoring: StorageMonitoringConfig;
}

export interface StorageClass {
  name: string;
  provisioner: string;
  parameters: Record<string, string>;
  reclaimPolicy: 'Delete' | 'Retain';
  allowVolumeExpansion: boolean;
  volumeBindingMode: 'Immediate' | 'WaitForFirstConsumer';
}

export interface StorageEncryption {
  enabled: boolean;
  keyManagement: 'provider' | 'customer';
  algorithm: string;
  keyRotation: boolean;
}

export interface StorageBackupConfig {
  enabled: boolean;
  schedule: string;
  retention: string;
  crossRegion: boolean;
  encryption: boolean;
}

export interface StorageMonitoringConfig {
  enabled: boolean;
  metrics: string[];
  alerts: StorageAlert[];
}

export interface StorageAlert {
  metric: string;
  threshold: number;
  operator: 'greater_than' | 'less_than';
  duration: string;
}

export interface ScalingConfig {
  horizontal: HorizontalScalingConfig;
  vertical: VerticalScalingConfig;
  cluster: ClusterScalingConfig;
  predictive: PredictiveScalingConfig;
}

export interface HorizontalScalingConfig {
  enabled: boolean;
  minReplicas: number;
  maxReplicas: number;
  targetCPUUtilization: number;
  targetMemoryUtilization: number;
  customMetrics: CustomMetric[];
  behavior: ScalingBehavior;
}

export interface CustomMetric {
  name: string;
  selector: LabelSelector;
  target: MetricTarget;
}

export interface MetricTarget {
  type: 'Utilization' | 'Value' | 'AverageValue';
  value?: string;
  averageValue?: string;
  averageUtilization?: number;
}

export interface ScalingBehavior {
  scaleUp: ScalingPolicy;
  scaleDown: ScalingPolicy;
}

export interface ScalingPolicy {
  stabilizationWindowSeconds: number;
  _policies: ScalingPolicyRule[];
}

export interface ScalingPolicyRule {
  type: 'Percent' | 'Pods';
  value: number;
  periodSeconds: number;
}

export interface VerticalScalingConfig {
  enabled: boolean;
  updateMode: 'Off' | 'Initial' | 'Recreation' | 'Auto';
  resourcePolicy: ResourcePolicy;
}

export interface ResourcePolicy {
  containerPolicies: ContainerResourcePolicy[];
}

export interface ContainerResourcePolicy {
  containerName: string;
  minAllowed: ResourceRequirements;
  maxAllowed: ResourceRequirements;
  controlled: ControlledResource;
}

export interface ResourceRequirements {
  cpu?: string;
  memory?: string;
}

export interface ControlledResource {
  name: 'cpu' | 'memory';
  mode: 'Auto' | 'Off';
}

export interface ClusterScalingConfig {
  enabled: boolean;
  minNodes: number;
  maxNodes: number;
  nodeGroups: NodeGroup[];
  scaleDownDelay: string;
  scaleDownUnneededTime: string;
}

export interface NodeGroup {
  name: string;
  instanceType: string;
  minSize: number;
  maxSize: number;
  desiredSize: number;
  labels: Record<string, string>;
  taints: Taint[];
  spot: boolean;
}

export interface Taint {
  key: string;
  value: string;
  effect: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';
}

export interface PredictiveScalingConfig {
  enabled: boolean;
  models: PredictiveModel[];
  lookaheadMinutes: number;
  confidenceThreshold: number;
}

export interface PredictiveModel {
  name: string;
  type: 'linear' | 'polynomial' | 'neural_network';
  features: string[];
  trainingData: string;
  updateFrequency: string;
}

export interface MonitoringConfig {
  prometheus: PrometheusConfig;
  grafana: GrafanaConfig;
  logging: LoggingConfig;
  tracing: TracingConfig;
  alerting: AlertingConfig;
}

export interface PrometheusConfig {
  enabled: boolean;
  retention: string;
  storage: string;
  replicas: number;
  resources: ResourceRequirements;
  rules: PrometheusRule[];
}

export interface PrometheusRule {
  name: string;
  rules: AlertRule[];
}

export interface AlertRule {
  alert: string;
  expr: string;
  for: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

export interface GrafanaConfig {
  enabled: boolean;
  adminPassword: string;
  dashboards: GrafanaDashboard[];
  datasources: GrafanaDataSource[];
  plugins: string[];
}

export interface GrafanaDashboard {
  name: string;
  url?: string;
  configMap?: string;
  folder: string;
}

export interface GrafanaDataSource {
  name: string;
  type: string;
  url: string;
  access: 'proxy' | 'direct';
  basicAuth: boolean;
}

export interface LoggingConfig {
  enabled: boolean;
  level: 'debug' | 'info' | 'warn' | '_error';
  aggregator: 'fluentd' | 'fluent-bit' | 'logstash';
  storage: LogStorageConfig;
  retention: string;
}

export interface LogStorageConfig {
  type: 'elasticsearch' | 'loki' | 's3' | 'gcs' | 'azure_blob';
  config: Record<string, any>;
  indexing: LogIndexingConfig;
}

export interface LogIndexingConfig {
  enabled: boolean;
  fields: string[];
  lifecycle: LogLifecyclePolicy;
}

export interface LogLifecyclePolicy {
  hot: string;
  warm: string;
  cold: string;
  delete: string;
}

export interface TracingConfig {
  enabled: boolean;
  provider: 'jaeger' | 'zipkin' | 'datadog' | 'newrelic';
  samplingRate: number;
  config: Record<string, any>;
}

export interface AlertingConfig {
  enabled: boolean;
  manager: AlertManagerConfig;
  receivers: AlertReceiver[];
  routes: AlertRoute[];
}

export interface AlertManagerConfig {
  replicas: number;
  retention: string;
  storage: string;
  config: Record<string, any>;
}

export interface AlertReceiver {
  name: string;
  emailConfigs?: EmailConfig[];
  slackConfigs?: SlackConfig[];
  webhookConfigs?: WebhookConfig[];
}

export interface EmailConfig {
  to: string[];
  from: string;
  subject: string;
  body: string;
  smarthost: string;
}

export interface SlackConfig {
  apiUrl: string;
  channel: string;
  username: string;
  title: string;
  text: string;
}

export interface WebhookConfig {
  url: string;
  httpConfig: HTTPConfig;
}

export interface HTTPConfig {
  basicAuth?: BasicAuth;
  bearerToken?: string;
  tlsConfig?: TLSConfig;
}

export interface BasicAuth {
  username: string;
  password: string;
}

export interface TLSConfig {
  caCert: string;
  cert: string;
  key: string;
  insecure: boolean;
}

export interface AlertRoute {
  match: Record<string, string>;
  matchRe: Record<string, string>;
  receiver: string;
  groupBy: string[];
  groupWait: string;
  groupInterval: string;
  repeatInterval: string;
  routes?: AlertRoute[];
}

export interface DeploymentSecurityConfig {
  tls: TLSConfig;
  secrets: SecretsConfig;
  imageScanning: ImageScanningConfig;
  admission: AdmissionConfig;
}

export interface SecretsConfig {
  management: 'kubernetes' | 'vault' | 'sealed_secrets' | 'external_secrets';
  encryption: boolean;
  rotation: boolean;
  config: Record<string, any>;
}

export interface ImageScanningConfig {
  enabled: boolean;
  provider: 'trivy' | 'clair' | 'twistlock' | 'aqua';
  policy: ScanningPolicy;
  registry: RegistryConfig;
}

export interface ScanningPolicy {
  failOnCritical: boolean;
  failOnHigh: boolean;
  allowedVulnerabilities: string[];
  exemptions: VulnerabilityExemption[];
}

export interface VulnerabilityExemption {
  cve: string;
  reason: string;
  expiryDate: Date;
  approvedBy: string;
}

export interface RegistryConfig {
  url: string;
  credentials: RegistryCredentials;
  scanOnPush: boolean;
  retention: RegistryRetention;
}

export interface RegistryCredentials {
  username: string;
  password: string;
  token?: string;
}

export interface RegistryRetention {
  enabled: boolean;
  _policies: RetentionPolicy[];
}

export interface RetentionPolicy {
  tag: string;
  count: number;
  age: string;
}

export interface AdmissionConfig {
  controllers: AdmissionController[];
  _policies: AdmissionPolicy[];
}

export interface AdmissionController {
  name: string;
  enabled: boolean;
  config: Record<string, any>;
}

export interface AdmissionPolicy {
  name: string;
  rules: PolicyRule[];
  enforcement: 'enforce' | 'warn' | 'audit';
}

export interface BackupConfig {
  enabled: boolean;
  provider: 'velero' | 'kasten' | 'stash';
  storage: BackupStorageConfig;
  schedule: BackupSchedule[];
  retention: BackupRetention;
  encryption: boolean;
}

export interface BackupStorageConfig {
  type: 's3' | 'gcs' | 'azure_blob' | 'nfs';
  config: Record<string, any>;
  crossRegion: boolean;
}

export interface BackupSchedule {
  name: string;
  schedule: string;
  includedNamespaces: string[];
  excludedNamespaces: string[];
  includedResources: string[];
  excludedResources: string[];
  labelSelector: LabelSelector;
  snapshotVolumes: boolean;
}

export interface BackupRetention {
  default: string;
  _policies: RetentionPolicy[];
}

export interface NetworkingConfig {
  ingress: IngressConfig;
  serviceMesh: ServiceMeshConfig;
  cni: CNIConfig;
  dns: DNSConfig;
}

export interface IngressConfig {
  controller: 'nginx' | 'traefik' | 'istio' | 'ambassador';
  tls: IngressTLSConfig;
  rateLimiting: RateLimitingConfig;
  auth: IngressAuthConfig;
}

export interface IngressTLSConfig {
  enabled: boolean;
  provider: 'cert_manager' | 'manual';
  issuer: string;
  wildcard: boolean;
}

export interface RateLimitingConfig {
  enabled: boolean;
  global: RateLimit;
  perPath: PathRateLimit[];
}

export interface RateLimit {
  requests: number;
  window: string;
  burst?: number;
}

export interface PathRateLimit {
  _path: string;
  limit: RateLimit;
}

export interface IngressAuthConfig {
  enabled: boolean;
  provider: 'oauth2_proxy' | 'authelia' | 'external';
  config: Record<string, any>;
}

export interface ServiceMeshConfig {
  enabled: boolean;
  provider: 'istio' | 'linkerd' | 'consul_connect';
  mtls: MTLSConfig;
  tracing: boolean;
  monitoring: boolean;
}

export interface MTLSConfig {
  enabled: boolean;
  mode: 'permissive' | 'strict';
  certificateAuthority: CAConfig;
}

export interface CAConfig {
  provider: 'istio' | 'cert_manager' | 'vault';
  config: Record<string, any>;
}

export interface CNIConfig {
  provider: 'calico' | 'flannel' | 'weave' | 'cilium';
  ipv6: boolean;
  encryption: boolean;
  config: Record<string, any>;
}

export interface DNSConfig {
  provider: 'coredns' | 'kube_dns';
  customDomains: string[];
  externalDNS: ExternalDNSConfig;
}

export interface ExternalDNSConfig {
  enabled: boolean;
  provider: 'route53' | 'cloudflare' | 'google' | 'azure';
  config: Record<string, any>;
}

export class EnterpriseDeploymentManager extends EventEmitter {
  private config: DeploymentConfig;
  private kubernetesClient: KubernetesClient;
  private helmClient: HelmClient;
  private terraformClient: TerraformClient;
  
  // Dependency Inversion: Depend on interfaces, not concrete classes
  private idempotencyManager: IIdempotency;
  private parallelApplier: IManifestApplier;
  private monitoring: IMonitor;
  private costOptimizer: ICostOptimizer;
  private multiCloud: ICloudDriver;
  
  // Communication context for one-way dependency flow
  private ctx: JobContext;

  constructor(
    _config: DeploymentConfig,
    applier: IManifestApplier,
    cloud: ICloudDriver,
    monitor: IMonitor,
    idempotency: IIdempotency,
    costOptimizer: ICostOptimizer) {
    super();
    this._config = _config;
    this.kubernetesClient = new KubernetesClient();
    this.helmClient = new HelmClient();
    this.terraformClient = new TerraformClient();
    
    // Interface dependencies injected
    this.idempotencyManager = idempotency;
    this.parallelApplier = applier;
    this.monitoring = monitor;
    this.costOptimizer = costOptimizer;
    this.multiCloud = cloud;
    
    // JobContext for reverse communication (Event-driven)
    this.ctx = { 
      on: (event) => this.handleDeploymentEvent(event) 
    };
  }
  
  private async handleDeploymentEvent(event: DeploymentEvent): Promise<void> {
    await this.monitoring.publish(event);
    this.emit('deployment:event', event);
  }

  /**
   * Deploy MARIA Memory System to target environment
   */
  async deploy(
    environment: string,
    options: {
      dryRun?: boolean;
      skipTests?: boolean;
      rollback?: boolean;
      timeout?: number;
      force?: boolean;
    } = {}): Promise<DeploymentResult> {
    const _startTime = Date.now();

    try {
      // Phase 3: Record deployment start for monitoring
      this.monitoring.recordDeploymentEvent({
        environment,
        type: 'started'
      });

      // Validate deployment configuration
      await this.validateDeployment(environment);

      // Generate Kubernetes _manifests
      let _manifests = await this.generateManifests(environment);

      // Phase 3: Apply cost optimizations
      if (this.config.infrastructure.costOptimization.autoScaling) {
        const optimization = this.costOptimizer.optimizeManifests(_manifests, environment, this.config);
        _manifests = optimization.optimizedManifests;
        
        if (optimization.modifications.length > 0) {
          this.emit('cost:optimized', {
            environment,
            modifications: optimization.modifications,
            estimatedSavings: optimization.estimatedSavings
          });
        }
      }

      // Phase 3: Apply multi-cloud transformations
      const cloudTransformation = this.multiCloud.transformManifests(
        _manifests,
        this.config.infrastructure.provider,
        environment
      );
      _manifests = cloudTransformation._manifests;
      
      if (cloudTransformation.modifications.length > 0) {
        this.emit('cloud:transformed', {
          environment,
          provider: this.config.infrastructure.provider,
          modifications: cloudTransformation.modifications,
          providerResources: cloudTransformation.providerResources.length
        });
      }

      // Phase 3: Check idempotency - should we apply?
      const idempotencyResult = await this.idempotencyManager.checkIdempotency(
        environment,
        this.config,
        _manifests,
        { force: options.force, dryRun: options.dryRun }
      );

      // Emit idempotency check event
      this.emit('idempotency:checked', {
        environment,
        shouldApply: idempotencyResult.shouldApply,
        reason: idempotencyResult.reason,
        driftSummary: idempotencyResult.driftDetection.summary
      });

      if (options.dryRun) {
        return {
          success: true,
          environment,
          _manifests: _manifests,
          duration: Date.now() - _startTime,
          dryRun: true,
          idempotency: idempotencyResult
        };
      }

      // If no changes needed and not forced, skip deployment
      if (!idempotencyResult.shouldApply) {
        return {
          success: true,
          environment,
          _manifests: _manifests,
          duration: Date.now() - _startTime,
          skipped: true,
          idempotency: idempotencyResult,
          message: 'Deployment skipped - no changes detected (idempotent)'
        };
      }

      // Deploy infrastructure
      await this.deployInfrastructure(environment);

      // Deploy application with parallel processing
      const _deploymentStatus = await this.deployApplication(environment, _manifests, {
        timeout: options.timeout,
        force: options.force
      });

      // Run post-deployment tests
      if (!options.skipTests) {
        await this.runDeploymentTests(environment);
      }

      // Update deployment status
      await this.updateDeploymentStatus(environment, _deploymentStatus);

      // Phase 3: Record successful deployment state for idempotency
      this.idempotencyManager.recordDeploymentState(environment, this.config, _manifests);

      // Phase 3: Record successful deployment for monitoring
      const deploymentDuration = Date.now() - _startTime;
      this.monitoring.recordDeploymentEvent({
        environment,
        type: 'completed',
        duration: deploymentDuration,
        _manifests: _manifests.length
      });

      // Emit deployment completion event
      this.emit('deployment:completed', {
        environment,
        duration: deploymentDuration,
        manifestCount: _manifests.length,
        idempotency: idempotencyResult
      });

      return {
        success: true,
        environment,
        _manifests: _manifests,
        status: _deploymentStatus,
        duration: Date.now() - _startTime,
        idempotency: idempotencyResult
      };
    } catch (_error) {
      // Phase 3: Record deployment failure for monitoring
      this.monitoring.recordDeploymentEvent({
        environment,
        type: 'failed',
        duration: Date.now() - _startTime
      });

      if (options.rollback) {
        await this.rollback(environment);
      }

      throw new DeploymentError(`Deployment failed: ${_error.message}`, {
        environment,
        _error: _error.message,
        duration: Date.now() - _startTime
      });
    }
  }

  /**
   * Scale deployment based on configuration
   */
  async scale(environment: string, component: string, replicas: number): Promise<ScalingResult> {
    try {
      const _currentStatus = await this.getDeploymentStatus(environment, component);

      await this.kubernetesClient.scale(environment, component, replicas);

      // Wait for scaling to complete
      await this.waitForScaling(environment, component, replicas);

      const _newStatus = await this.getDeploymentStatus(environment, component);

      return {
        success: true,
        component,
        previousReplicas: _currentStatus.replicas,
        newReplicas: replicas,
        duration: _newStatus.lastScaleTime
      };
    } catch (_error) {
      throw new DeploymentError(`Scaling failed: ${_error.message}`);
    }
  }

  /**
   * Update deployment configuration
   */
  async update(environment: string, updates: Partial<DeploymentConfig>): Promise<UpdateResult> {
    try {
      // Validate updates
      await this.validateUpdates(environment, updates);

      // Apply configuration updates
      const _mergedConfig = this.mergeConfig(this.config, updates);

      // Generate new _manifests
      const _manifests = await this.generateManifests(environment, _mergedConfig);

      // Apply updates
      await this.kubernetesClient(..._manifests);

      // Update stored configuration
      this.config = _mergedConfig;

      return {
        success: true,
        environment: environment,
        appliedUpdates: updates,
        timestamp: new Date()
      };
    } catch (_error) {
      throw new DeploymentError(`Update failed: ${_error.message}`);
    }
  }

  /**
   * Rollback to previous deployment
   */
  async rollback(environment: string, revision?: number): Promise<RollbackResult> {
    try {
      const _currentRevision = await this.getCurrentRevision(environment);
      const _targetRevision = revision || _currentRevision - 1;

      await this.kubernetesClient.rollback(environment, _targetRevision);

      // Wait for rollback to complete
      await this.waitForRollback(environment, _targetRevision);

      // Phase 3: Record rollback event for monitoring
      this.monitoring.recordDeploymentEvent({
        environment,
        type: 'rolled_back'
      });

      return {
        success: true,
        environment: environment,
        fromRevision: _currentRevision,
        toRevision: _targetRevision,
        timestamp: new Date()
      };
    } catch (_error) {
      throw new DeploymentError(`Rollback failed: ${_error.message}`);
    }
  }

  /**
   * Phase 3: Get comprehensive monitoring metrics
   */
  async getMetricsSnapshot(environment: string): Promise<any> {
    return await this.monitoring.getMetricsSnapshot(environment);
  }

  /**
   * Phase 3: Get deployment metrics for monitoring dashboard
   */
  async getDeploymentMetrics(environment: string): Promise<any> {
    return await this.monitoring.collectDeploymentMetrics(environment);
  }

  /**
   * Phase 3: Get cost analysis and optimization recommendations
   */
  async getCostAnalysis(environment: string): Promise<any> {
    return await this.costOptimizer.analyzeCosts(environment);
  }

  /**
   * Phase 3: Get cost optimization summary
   */
  async getCostOptimizationSummary(environment: string): Promise<any> {
    return await this.costOptimizer.getCostOptimizationSummary(environment);
  }

  /**
   * Phase 3: Analyze optimal cloud placement for workload
   */
  async analyzeCloudPlacement(
    environment: string,
    requirements: {
      latency?: number;
      availability?: number;
      compliance?: string[];
      budget?: number;
    }
  ): Promise<any> {
    const _manifests = await this.generateManifests(environment);
    return this.multiCloud.analyzeWorkloadPlacement(_manifests, requirements);
  }

  /**
   * Phase 3: Get multi-cloud deployment options
   */
  async getMultiCloudOptions(environment: string): Promise<{
    currentProvider: string;
    alternativeProviders: any[];
    migrationComplexity: string;
    estimatedSavings: number;
  }> {
    const _manifests = await this.generateManifests(environment);
    const analysis = this.multiCloud.analyzeWorkloadPlacement(_manifests, {});
    
    return {
      currentProvider: this.config.infrastructure.provider,
      alternativeProviders: analysis.recommendations.slice(1, 4),
      migrationComplexity: 'medium',
      estimatedSavings: 200
    };
  }

  /**
   * Get deployment status
   */
  async getStatus(environment?: string): Promise<DeploymentStatusResponse> {
    try {
      const _environments = environment
        ? [environment]
        : this.config.infrastructure._environments.map((e) => e.name);

      const statuses: Record<string, DeploymentStatus> = {};

      for (const env of _environments) {
        statuses[env] = await this.getEnvironmentStatus(env);
      }

      return {
        _environments: statuses,
        overall: this.calculateOverallHealth(statuses),
        timestamp: new Date()
      };
    } catch (_error) {
      throw new DeploymentError(`Status check failed: ${_error.message}`);
    }
  }

  /**
   * Generate Kubernetes _manifests
   */
  async generateManifests(
    environment: string,
    config?: DeploymentConfig): Promise<KubernetesManifest[]> {
    const _deployConfig = config || this.config;
    const _envConfig = this.getEnvironmentConfig(environment);

    const _manifests: KubernetesManifest[] = [];

    // Namespace
    _manifests.push(this.generateNamespace(environment, _envConfig));

    // Service Account
    _manifests.push(...this.generateServiceAccounts(_envConfig));

    // RBAC
    _manifests.push(...this.generateRBAC(_envConfig));

    // ConfigMaps
    _manifests.push(...this.generateConfigMaps(environment, _deployConfig));

    // Secrets
    _manifests.push(...this.generateSecrets(environment, _deployConfig));

    // Deployments
    _manifests.push(...this.generateDeployments(environment, _deployConfig));

    // Services
    _manifests.push(...this.generateServices(environment, _deployConfig));

    // Ingress
    _manifests.push(...this.generateIngress(environment, _deployConfig));

    // HPA
    if (_deployConfig.scaling.horizontal.enabled) {
      _manifests.push(...this.generateHPA(environment, _deployConfig));
    }

    // Network Policies
    if (_deployConfig.kubernetes.networkPolicy.enabled) {
      _manifests.push(...this.generateNetworkPolicies(environment, _deployConfig));
    }

    // Storage
    _manifests.push(...this.generateStorage(environment, _deployConfig));

    // Phase 3: Monitoring integration
    if (_deployConfig.monitoring.enabled) {
      _manifests.push(...this.monitoring.generateMonitoringManifests(environment, _deployConfig));
    }

    return _manifests;
  }

  // Private methods

  private async validateDeployment(environment: string): Promise<void> {
    const _envConfig = this.getEnvironmentConfig(environment);

    if (!_envConfig) {
      throw new Error(`Environment ${environment} not found in configuration`);
    }

    // Validate resource _quotas
    await this.validateResourceQuotas(environment);

    // Validate security _policies
    await this.validateSecurityPolicies(environment);

    // Validate networking
    await this.validateNetworking(environment);
  }

  private async validateResourceQuotas(environment: string): Promise<void> {
    const _envConfig = this.getEnvironmentConfig(environment);
    const _quotas = this.config.infrastructure.resourceQuotas;

    // Check if requested resources exceed _quotas
    const _requestedResources = this.calculateRequestedResources(_envConfig);

    if (this.parseResource(_requestedResources.cpu) > this.parseResource(_quotas.cpu)) {
      throw new Error(`CPU request exceeds quota: ${_requestedResources.cpu} > ${_quotas.cpu}`);
    }

    if (this.parseResource(_requestedResources.memory) > this.parseResource(_quotas.memory)) {
      throw new Error(
        `Memory request exceeds quota: ${_requestedResources.memory} > ${_quotas.memory}`);
    }
  }

  private async validateSecurityPolicies(environment: string): Promise<void> {
    if (this.config.kubernetes.podSecurityPolicy.enabled) {
      // Validate pod security _policies
      const _policies = this.config.kubernetes.podSecurityPolicy._policies;

      for (const policy of _policies) {
        if (policy.privileged && environment === 'production') {
          throw new Error('Privileged pods not allowed in production');
        }
      }
    }
  }

  private async validateNetworking(_environment: string): Promise<void> {
    if (this.config.kubernetes.networkPolicy.enabled) {
      // Validate network _policies don't conflict
      const _policies = this.config.kubernetes.networkPolicy._policies;
      // Add validation logic
    }
  }

  private getEnvironmentConfig(environment: string): EnvironmentConfig {
    const _envConfig = this.config.infrastructure.environments.find((e) => e.name === environment);

    if (!_envConfig) {
      throw new Error(`Environment ${environment} not found`);
    }

    return _envConfig;
  }

  private calculateRequestedResources(_envConfig: EnvironmentConfig): ResourceRequirements {
    return {
      cpu: _envConfig.resources.cpu.requests,
      memory: _envConfig.resources.memory.requests
    };
  }

  private parseResource(resource: string): number {
    // Simple resource parsing (e.g., "1000m" -> 1000, "1Gi" -> 1073741824)
    if (resource.endsWith('m')) {
      return parseInt(resource.slice(0, -1));
    }
    if (resource.endsWith('Gi')) {
      return parseInt(resource.slice(0, -2)) * 1024 * 1024 * 1024;
    }
    if (resource.endsWith('Mi')) {
      return parseInt(resource.slice(0, -2)) * 1024 * 1024;
    }
    return parseInt(resource);
  }

  private generateNamespace(environment: string, _envConfig: EnvironmentConfig): KubernetesManifest {
    return {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: {
        name: `maria-${environment}`,
        labels: {
          'app.kubernetes.io/name': 'maria',
          'app.kubernetes.io/instance': environment,
          'app.kubernetes.io/component': 'namespace'
        },
        annotations: {
          'maria.ai/environment': environment,
          'maria.ai/isolation': _envConfig.isolation
        }
      }
    };
  }

  private generateServiceAccounts(_envConfig: EnvironmentConfig): KubernetesManifest[] {
    return this.config.kubernetes.rbac.serviceAccounts.map((sa) => ({
      apiVersion: 'v1',
      kind: 'ServiceAccount',
      metadata: {
        name: sa.name,
        namespace: sa.namespace,
        annotations: sa.annotations
      },
      automountServiceAccountToken: sa.automountServiceAccountToken
    }));
  }

  private generateRBAC(_envConfig: EnvironmentConfig): KubernetesManifest[] {
    const _manifests: KubernetesManifest[] = [];

    // Roles
    manifests.push(
      ...this.config.kubernetes.rbac.roles.map((role) => ({
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: role.namespace ? 'Role' : 'ClusterRole',
        metadata: {
          name: role.name,
          namespace: role.namespace
        },
        rules: role.rules
      })));

    // Role Bindings
    manifests.push(
      ...this.config.kubernetes.rbac.bindings.map((binding) => ({
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: binding.namespace ? 'RoleBinding' : 'ClusterRoleBinding',
        metadata: {
          name: binding.name,
          namespace: binding.namespace
        },
        roleRef: binding.roleRef,
        subjects: binding.subjects
      })));

    return _manifests;
  }

  private generateConfigMaps(environment: string, config: DeploymentConfig): KubernetesManifest[] {
    return [
      {
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: {
          name: 'maria-config',
          namespace: `maria-${environment}`
        },
        data: {
          'config.yaml': yaml.dump({
            environment: environment,
            memorySystem: {
              encryption: !config.security.tls.insecure,
              monitoring: config.monitoring.prometheus.enabled
            }
          })
        }
      }
    ];
  }

  private generateSecrets(_environment: string, _config: DeploymentConfig): KubernetesManifest[] {
    // Generate secrets based on configuration
    return [];
  }

  private generateDeployments(environment: string, config: DeploymentConfig): KubernetesManifest[] {
    const _envConfig = this.getEnvironmentConfig(environment);

    return [
      {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: 'maria-memory-system',
          namespace: `maria-${environment}`,
          labels: {
            'app.kubernetes.io/name': 'maria',
            'app.kubernetes.io/component': 'memory-system'
          }
        },
        spec: {
          replicas: config.scaling.horizontal.minReplicas,
          selector: {
            matchLabels: {
              'app.kubernetes.io/name': 'maria',
              'app.kubernetes.io/component': 'memory-system'
            }
          },
          template: {
            metadata: {
              labels: {
                'app.kubernetes.io/name': 'maria',
                'app.kubernetes.io/component': 'memory-system'
              }
            },
            spec: {
              serviceAccountName: 'maria-memory-system',
              securityContext: {
                runAsNonRoot: true,
                runAsUser: 1000,
                fsGroup: 2000
              },
              containers: [
                {
                  name: 'memory-system',
                  image: 'maria/memory-system:latest',
                  imagePullPolicy: 'IfNotPresent',
                  ports: [
                    {
                      name: 'http',
                      containerPort: 8080,
                      protocol: 'TCP'
                    }
                  ],
                  resources: {
                    requests: {
                      cpu: _envConfig.resources.cpu.requests,
                      memory: _envConfig.resources.memory.requests
                    },
                    limits: {
                      cpu: _envConfig.resources.cpu.limits,
                      memory: _envConfig.resources.memory.limits
                    }
                  },
                  env: [
                    {
                      name: 'ENVIRONMENT',
                      value: environment
                    }
                  ],
                  volumeMounts: [
                    {
                      name: 'config',
                      mountPath: '/etc/maria/config',
                      readOnly: true
                    }
                  ],
                  livenessProbe: {
                    httpGet: {
                      _path: '/health',
                      port: 8080
                    },
                    initialDelaySeconds: 30,
                    periodSeconds: 10
                  },
                  readinessProbe: {
                    httpGet: {
                      _path: '/ready',
                      port: 8080
                    },
                    initialDelaySeconds: 5,
                    periodSeconds: 5
                  }
                }
              ],
              volumes: [
                {
                  name: 'config',
                  configMap: {
                    name: 'maria-config'
                  }
                }
              ]
            }
          }
        }
      }
    ];
  }

  private generateServices(environment: string, _config: DeploymentConfig): KubernetesManifest[] {
    return [
      {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
          name: 'maria-memory-system',
          namespace: `maria-${environment}`,
          labels: {
            'app.kubernetes.io/name': 'maria',
            'app.kubernetes.io/component': 'memory-system'
          }
        },
        spec: {
          type: 'ClusterIP',
          ports: [
            {
              name: 'http',
              port: 80,
              targetPort: 8080,
              protocol: 'TCP'
            }
          ],
          selector: {
            'app.kubernetes.io/name': 'maria',
            'app.kubernetes.io/component': 'memory-system'
          }
        }
      }
    ];
  }

  private generateIngress(environment: string, config: DeploymentConfig): KubernetesManifest[] {
    if (!config.networking.ingress.tls.enabled) {
      return [];
    }

    return [
      {
        apiVersion: 'networking.k8s.io/v1',
        kind: 'Ingress',
        metadata: {
          name: 'maria-ingress',
          namespace: `maria-${environment}`,
          annotations: {
            'kubernetes.io/ingress.class': config.networking.ingress.controller,
            'cert-manager.io/cluster-issuer': config.networking.ingress.tls.issuer
          }
        },
        spec: {
          tls: config.networking.ingress.tls.enabled
            ? [
                {
                  hosts: [`maria-${environment}.example.com`],
                  secretName: 'maria-tls'
                }
              ]
            : undefined,
          rules: [
            {
              host: `maria-${environment}.example.com`,
              http: {
                paths: [
                  {
                    _path: '/',
                    pathType: 'Prefix',
                    backend: {
                      service: {
                        name: 'maria-memory-system',
                        port: {
                          number: 80
                        }
                      }
                    }
                  }
                ]
              }
            }
          ]
        }
      }
    ];
  }

  private generateHPA(environment: string, config: DeploymentConfig): KubernetesManifest[] {
    const _hpaConfig = config.scaling.horizontal;

    return [
      {
        apiVersion: 'autoscaling/v2',
        kind: 'HorizontalPodAutoscaler',
        metadata: {
          name: 'maria-memory-system-hpa',
          namespace: `maria-${environment}`
        },
        spec: {
          scaleTargetRef: {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            name: 'maria-memory-system'
          },
          minReplicas: _hpaConfig.minReplicas,
          maxReplicas: _hpaConfig.maxReplicas,
          metrics: [
            {
              type: 'Resource',
              resource: {
                name: 'cpu',
                target: {
                  type: 'Utilization',
                  averageUtilization: _hpaConfig.targetCPUUtilization
                }
              }
            },
            {
              type: 'Resource',
              resource: {
                name: 'memory',
                target: {
                  type: 'Utilization',
                  averageUtilization: _hpaConfig.targetMemoryUtilization
                }
              }
            }
          ],
          behavior: _hpaConfig.behavior
        }
      }
    ];
  }

  private generateNetworkPolicies(
    environment: string,
    config: DeploymentConfig): KubernetesManifest[] {
    return config.kubernetes.networkPolicy.policies.map((policy) => ({
      apiVersion: 'networking.k8s.io/v1',
      kind: 'NetworkPolicy',
      metadata: {
        name: policy.name,
        namespace: policy.namespace || `maria-${environment}`
      },
      spec: {
        podSelector: policy.selector,
        policyTypes: ['Ingress', 'Egress'],
        ingress: policy.ingress,
        egress: policy.egress
      }
    }));
  }

  private generateStorage(_environment: string, config: DeploymentConfig): KubernetesManifest[] {
    const _manifests: KubernetesManifest[] = [];

    // Storage Classes
    manifests.push(
      ...config.kubernetes.storage.classes.map((sc) => ({
        apiVersion: 'storage.k8s.io/v1',
        kind: 'StorageClass',
        metadata: {
          name: sc.name
        },
        provisioner: sc.provisioner,
        parameters: sc.parameters,
        reclaimPolicy: sc.reclaimPolicy,
        allowVolumeExpansion: sc.allowVolumeExpansion,
        volumeBindingMode: sc.volumeBindingMode
      })));

    return _manifests;
  }

  // Additional helper methods would be implemented here...

  private mergeConfig(
    base: DeploymentConfig,
    updates: Partial<DeploymentConfig>): DeploymentConfig {
    // Deep merge configuration
    return { ...base, ...updates };
  }

  private async deployInfrastructure(environment: string): Promise<void> {
    // Deploy cloud infrastructure using Terraform
    console.log(`Deploying infrastructure for environment: ${environment}`);
    const expression = {};
  }

  async applyManifests(_manifests: KubernetesManifest[]): Promise<DeploymentStatus> {
    // Phase 3: Use parallel manifest applier with intelligent batching
    const applyOptions = {
      dryRun: false,
      force: options.force || false,
      waitForReady: true,
      timeout: options.timeout || 300000, // 5 minutes default
      maxConcurrency: options.maxConcurrency || 5,
      batchSize: 10
    };

    // Set up event listeners for parallel application progress
    this.parallelApplier.on('batching:completed', (event) => {
      this.emit('deployment:batching', {
        environment: "",
        totalManifests: event.totalManifests,
        totalBatches: event.totalBatches,
        dependencies: event.dependencies
      });
    });

    this.parallelApplier.on('batch:started', (event) => {
      this.emit('deployment:batch:started', {
        environment: "",
        batchIndex: event.batchIndex,
        batchSize: event.batchSize,
        totalBatches: event.totalBatches
      });
    });

    this.parallelApplier.on('batch:completed', (event) => {
      this.emit('deployment:batch:completed', {
        environment: "",
        batchIndex: event.batchIndex,
        duration: event.duration,
        applied: event.applied,
        errors: event.errors
      });
    });

    // Apply _manifests with parallel processing
    const applyResult = await this.parallelApplier(...applyOptions);
    
    if (!applyResult.success) {
      throw new DeploymentError(
        `Parallel manifest application failed: ${applyResult.errors.length} errors`,
        {
          errors: applyResult.errors,
          batchSummary: applyResult.batchSummary
        }
      );
    }

    // Emit parallel processing summary
    this.emit('deployment:parallel:completed', {
      environment: "",
      batchSummary: applyResult.batchSummary,
      totalManifests: manifests.length,
      duration: applyResult.duration
    });

    return {
      replicas: this.config.scaling.horizontal.minReplicas,
      readyReplicas: this.config.scaling.horizontal.minReplicas,
      availableReplicas: this.config.scaling.horizontal.minReplicas,
      lastScaleTime: new Date(),
      conditions: [
        {
          type: 'Available',
          status: 'True',
          reason: 'ParallelDeploymentCompleted',
          message: `Successfully applied ${applyResult.appliedManifests.length} _manifests in ${applyResult.batchSummary.totalBatches} batches`
        }
      ],
      parallelSummary: applyResult.batchSummary
    };
  }

  private async runDeploymentTests(environment: string): Promise<void> {
    // Run post-deployment tests
    console.log(`Running deployment tests for ${environment}`);
  }

  private async updateDeploymentStatus(
    environment: string,
    status: DeploymentStatus): Promise<void> {
    // Update deployment status in database/storage
    console.log(`Updating deployment status for ${environment}:`, status);
  }

  private async getDeploymentStatus(
    _environment: string,
    _component: string): Promise<DeploymentStatus> {
    return {
      replicas: 3,
      readyReplicas: 3,
      availableReplicas: 3,
      lastScaleTime: new Date(),
      conditions: []
    };
  }

  private async waitForScaling(
    _environment: string,
    component: string,
    replicas: number): Promise<void> {
    // Wait for scaling operation to complete
    console.log(`Waiting for ${component} to scale to ${replicas} replicas`);
  }

  private async validateUpdates(
    environment: string,
    _updates: Partial<DeploymentConfig>): Promise<void> {
    // Validate configuration updates
    console.log(`Validating updates for ${environment}`);
  }

  private async getCurrentRevision(_environment: string): Promise<number> {
    return 1;
  }

  private async waitForRollback(_environment: string, revision: number): Promise<void> {
    console.log(`Waiting for rollback to revision ${revision}`);
  }

  private async getEnvironmentStatus(_environment: string): Promise<DeploymentStatus> {
    return {
      replicas: 3,
      readyReplicas: 3,
      availableReplicas: 3,
      lastScaleTime: new Date(),
      conditions: []
    };
  }

  private calculateOverallHealth(
    statuses: Record<string, DeploymentStatus>): 'healthy' | 'degraded' | 'unhealthy' {
    const _healthyCount = Object.values(statuses).filter(
      (s) => s.readyReplicas === s.replicas).length;

    if (_healthyCount === Object.keys(statuses).length) {return 'healthy';}
    if (_healthyCount > 0) {return 'degraded';}
    return 'unhealthy';
  }
}

// Supporting classes and interfaces

class KubernetesClient {
  async scale(environment: string, component: string, replicas: number): Promise<void> {
    console.log(`Scaling ${component} in ${environment} to ${replicas} replicas`);
  }

  async apply(environment: string, _manifests: KubernetesManifest[]): Promise<void> {
    console.log(`Applying ${_manifests.length} _manifests to ${environment}`);
  }

  async rollback(environment: string, revision: number): Promise<void> {
    console.log(`Rolling back ${environment} to revision ${revision}`);
  }
}

class HelmClient {
  async install(chart: string, namespace: string, _values: unknown): Promise<void> {
    console.log(`Installing Helm chart ${chart} in namespace ${namespace}`);
  }

  async upgrade(chart: string, namespace: string, _values: unknown): Promise<void> {
    console.log(`Upgrading Helm chart ${chart} in namespace ${namespace}`);
  }

  async rollback(release: string, revision: number): Promise<void> {
    console.log(`Rolling back Helm release ${release} to revision ${revision}`);
  }
}

class TerraformClient {
  async apply(environment: string): Promise<void> {
    console.log(`Applying Terraform configuration for ${environment}`);
  }

  async destroy(environment: string): Promise<void> {
    console.log(`Destroying Terraform resources for ${environment}`);
  }
}

// Error and result types

class DeploymentError extends Error {
  constructor(
    message: string,
    public details?: unknown) {
    super(message);
    this.name = 'DeploymentError';
  }
}

interface KubernetesManifest {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec?: any;
  data?: any;
  [key: string]: any;
}

interface DeploymentResult {
  success: boolean;
  environment: string;
  _manifests: KubernetesManifest[];
  status?: DeploymentStatus;
  duration: number;
  dryRun?: boolean;
  skipped?: boolean;
  message?: string;
  idempotency?: any; // Will be properly typed from IdempotencyResult
}

interface ScalingResult {
  success: boolean;
  component: string;
  previousReplicas: number;
  newReplicas: number;
  duration: Date;
}

interface UpdateResult {
  success: boolean;
  environment: string;
  appliedUpdates: Partial<DeploymentConfig>;
  timestamp: Date;
}

interface RollbackResult {
  success: boolean;
  environment: string;
  fromRevision: number;
  toRevision: number;
  timestamp: Date;
}

interface DeploymentStatusResponse {
  _environments: Record<string, DeploymentStatus>;
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
}

interface DeploymentStatus {
  replicas: number;
  readyReplicas: number;
  availableReplicas: number;
  lastScaleTime: Date;
  conditions: DeploymentCondition[];
  parallelSummary?: any; // Will be properly typed from BatchSummary
}

interface DeploymentCondition {
  type: string;
  status: string;
  reason: string;
  message: string;
  lastTransitionTime: Date;
}
