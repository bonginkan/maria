/**
 * Type definitions for Enterprise Data Porter modules
 */

export type SupportedFormat =
  | "json"
  | "csv"
  | "parquet"
  | "avro"
  | "xml"
  | "yaml"
  | "binary"
  | "encrypted";

export interface DataPorterConfig {
  formats: SupportedFormat[];
  encryption: PorterEncryptionConfig;
  validation: ValidationConfig;
  compliance: ComplianceConfig;
  storage: StorageConfig;
  performance: PerformanceConfig;
}

export interface PorterEncryptionConfig {
  enabled: boolean;
  algorithm: "AES-256-GCM" | "ChaCha20-Poly1305";
  keyDerivation: KeyDerivationConfig;
  compression: CompressionConfig;
}

export interface KeyDerivationConfig {
  method: "PBKDF2" | "Argon2" | "scrypt";
  iterations: number;
  saltSize: number;
  keySize: number;
}

export interface CompressionConfig {
  enabled: boolean;
  algorithm: "gzip" | "brotli" | "lz4";
  level: number;
}

export interface ValidationConfig {
  schema: SchemaValidation;
  integrity: IntegrityValidation;
  quality: DataQualityValidation;
}

export interface SchemaValidation {
  enabled: boolean;
  strict: boolean;
  schemas: SchemaDefinition[];
  autoDetect: boolean;
}

export interface SchemaDefinition {
  name: string;
  version: string;
  format: SupportedFormat;
  definition: any;
  required: boolean;
}

export interface IntegrityValidation {
  enabled: boolean;
  algorithms: ChecksumAlgorithm[];
  signatureValidation: boolean;
}

export type ChecksumAlgorithm = "md5" | "sha256" | "sha512" | "crc32";

export interface DataQualityValidation {
  enabled: boolean;
  rules: QualityRule[];
  thresholds: QualityThresholds;
}

export interface QualityRule {
  field: string;
  type: "completeness" | "uniqueness" | "validity" | "consistency";
  condition: string;
  threshold: number;
}

export interface QualityThresholds {
  completeness: number;
  uniqueness: number;
  validity: number;
  consistency: number;
}

export interface ComplianceConfig {
  gdpr: GDPRConfig;
  hipaa: HIPAAConfig;
  sox: SOXConfig;
  customRules: ComplianceRule[];
}

export interface GDPRConfig {
  enabled: boolean;
  dataSubjectRights: boolean;
  consentTracking: boolean;
  dataPortability: boolean;
  rightToErasure: boolean;
}

export interface HIPAAConfig {
  enabled: boolean;
  phiDetection: boolean;
  accessLogging: boolean;
  encryptionRequired: boolean;
  auditTrail: boolean;
}

export interface SOXConfig {
  enabled: boolean;
  financialDataProtection: boolean;
  changeTracking: boolean;
  approvalWorkflow: boolean;
}

export interface ComplianceRule {
  id: string;
  framework: "GDPR" | "HIPAA" | "SOX" | "CUSTOM";
  condition: string;
  action: "block" | "mask" | "log" | "notify";
  severity: "low" | "medium" | "high" | "critical";
}

export interface StorageConfig {
  defaultProvider: StorageProvider;
  encryption: boolean;
  compression: boolean;
  retention: RetentionConfig;
}

export type StorageProvider = "local" | "s3" | "azure" | "gcp" | "custom";

export interface RetentionConfig {
  enabled: boolean;
  defaultDuration: number; // days
  policyByDataType: Record<string, number>;
}

export interface PerformanceConfig {
  streaming: StreamingConfig;
  parallel: ParallelConfig;
  memory: MemoryConfig;
}

export interface StreamingConfig {
  enabled: boolean;
  chunkSize: number;
  bufferSize: number;
  backpressureThreshold: number;
}

export interface ParallelConfig {
  enabled: boolean;
  workerCount: number;
  batchSize: number;
  queueSize: number;
}

export interface MemoryConfig {
  maxHeapSize: number;
  spillToDisk: boolean;
  spillThreshold: number;
  tempDirectory: string;
}

// Request/Response types
export interface ExportRequest {
  source: DataSource;
  destination: DataDestination;
  format: SupportedFormat;
  options: ExportOptions;
  metadata: RequestMetadata;
}

export interface ImportRequest {
  source: DataSource;
  destination: DataDestination;
  format: SupportedFormat;
  options: ImportOptions;
  metadata: RequestMetadata;
}

export interface DataSource {
  type: "memory_system" | "knowledge_graph" | "audit_logs" | "user_data";
  path?: string;
  query?: string;
  credentials?: SourceCredentials;
  filters?: DataFilter[];
}

export interface DataDestination {
  type: "file" | "stream" | "api" | "storage";
  path?: string;
  endpoint?: string;
  credentials?: DestinationCredentials;
  options?: DestinationOptions;
}

export interface SourceCredentials {
  username?: string;
  password?: string;
  token?: string;
  keyPath?: string;
  [key: string]: any;
}

export interface DestinationCredentials {
  username?: string;
  password?: string;
  token?: string;
  keyPath?: string;
  [key: string]: any;
}

export interface DataFilter {
  field: string;
  operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "nin" | "regex";
  value: any;
  caseSensitive?: boolean;
}

export interface ExportOptions {
  includeMetadata?: boolean;
  compress?: boolean;
  encrypt?: boolean;
  validate?: boolean;
  streaming?: boolean;
  batchSize?: number;
  maxRecords?: number;
  timeoutMs?: number;
}

export interface ImportOptions {
  validateSchema?: boolean;
  skipErrors?: boolean;
  upsert?: boolean;
  batchSize?: number;
  maxRecords?: number;
  timeoutMs?: number;
  transformations?: DataTransformation[];
}

export interface DataTransformation {
  field: string;
  operation: "map" | "filter" | "validate" | "format" | "custom";
  parameters: Record<string, any>;
  condition?: string;
}

export interface RequestMetadata {
  requestId: string;
  userId: string;
  timestamp: number;
  correlationId?: string;
  tags?: string[];
  priority?: "low" | "normal" | "high" | "urgent";
}

export interface DestinationOptions {
  overwrite?: boolean;
  createPath?: boolean;
  permissions?: string;
  metadata?: Record<string, any>;
}

// Result types
export interface PorterResult {
  success: boolean;
  jobId: string;
  recordsProcessed: number;
  recordsSkipped: number;
  recordsFailed: number;
  totalSize: number;
  executionTime: number;
  metadata: ResultMetadata;
  errors?: ProcessingError[];
  warnings?: ProcessingWarning[];
}

export interface ProcessingError {
  type: "validation" | "transformation" | "compliance" | "system";
  message: string;
  field?: string;
  recordIndex?: number;
  code?: string;
  details?: Record<string, any>;
}

export interface ProcessingWarning {
  type: "data_quality" | "performance" | "compliance";
  message: string;
  field?: string;
  recordIndex?: number;
  suggestion?: string;
}

export interface ResultMetadata {
  startTime: number;
  endTime: number;
  version: string;
  environment: string;
  compliance: ComplianceResult;
  quality: QualityResult;
}

export interface ComplianceResult {
  gdpr: boolean;
  hipaa: boolean;
  sox: boolean;
  customRules: boolean;
  violations: ComplianceViolation[];
}

export interface ComplianceViolation {
  ruleId: string;
  framework: string;
  severity: string;
  description: string;
  recommendation: string;
}

export interface QualityResult {
  score: number;
  completeness: number;
  uniqueness: number;
  validity: number;
  consistency: number;
  issues: QualityIssue[];
}

export interface QualityIssue {
  field: string;
  type: string;
  count: number;
  percentage: number;
  examples: any[];
}

// Handler interfaces
export interface IFormatHandler {
  readonly format: SupportedFormat;
  readonly supportedOperations: ("read" | "write" | "stream")[];

  validate(data: any, schema?: any): Promise<ValidationResult>;
  serialize(data: any, options?: any): Promise<Buffer | string>;
  deserialize(data: Buffer | string, options?: any): Promise<any>;
  streamSerialize?(
    data: AsyncIterable<any>,
    options?: any,
  ): AsyncIterable<Buffer>;
  streamDeserialize?(
    data: AsyncIterable<Buffer>,
    options?: any,
  ): AsyncIterable<any>;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string;
  message: string;
  value?: any;
  constraint?: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
  value?: any;
  suggestion?: string;
}

// Job management
export interface PorterJob {
  id: string;
  type: "export" | "import";
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  request: ExportRequest | ImportRequest;
  result?: PorterResult;
  startTime?: number;
  endTime?: number;
  progress: JobProgress;
  error?: string;
}

export interface JobProgress {
  phase: "preparing" | "processing" | "validating" | "finalizing";
  percentage: number;
  recordsProcessed: number;
  estimatedTimeRemaining?: number;
  currentOperation?: string;
}

// Event types
export interface PorterEvent {
  type:
    | "job_started"
    | "job_progress"
    | "job_completed"
    | "job_failed"
    | "validation_error"
    | "compliance_violation";
  jobId: string;
  timestamp: number;
  data: any;
  correlationId?: string;
}
