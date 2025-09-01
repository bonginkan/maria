/**
 * Core types for Internal Mode Microservices Architecture
 */

import { EventEmitter } from "node:events";

/**
 * Service lifecycle states
 */
export enum ServiceState {
  INITIALIZING = "initializing",
  READY = "ready",
  STARTING = "starting",
  RUNNING = "running",
  STOPPING = "stopping",
  STOPPED = "stopped",
  ERROR = "error",
  DISPOSED = "disposed",
}

/**
 * Service metadata
 */
export interface ServiceMetadata {
  id: string;
  name: string;
  version: string;
  description?: string;
  dependencies?: string[];
  path?: string;
  className?: string;
  priority?: number;
  autoStart?: boolean;
}

/**
 * Service configuration
 */
export interface ServiceConfig {
  [key: string]: any;
}

/**
 * Health status for service monitoring
 */
export interface HealthStatus {
  service: string;
  status: "healthy" | "unhealthy" | "degraded";
  uptime: number;
  memory: NodeJS.MemoryUsage;
  lastCheck?: Date;
  details?: Record<string, any>;
}

/**
 * Service event types
 */
export interface ServiceEvent {
  type: string;
  source: string;
  data?: any;
  timestamp: Date;
  correlationId?: string;
}

/**
 * Base service interface
 */
export interface IService extends EventEmitter {
  id: string;
  version: string;
  state: ServiceState;
  metadata?: ServiceMetadata;

  // Lifecycle methods
  initialize(config?: ServiceConfig): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  dispose(): Promise<void>;

  // Health monitoring
  health(): Promise<HealthStatus>;

  // Event handling
  handleEvent?(event: ServiceEvent): Promise<void>;
}

/**
 * Service registry interface
 */
export interface IServiceRegistry {
  register(_metadata: ServiceMetadata, service?: IService): void;
  unregister(serviceId: string): void;
  get(serviceId: string): IService | undefined;
  getMetadata(serviceId: string): ServiceMetadata | undefined;
  list(): ServiceMetadata[];
  has(serviceId: string): boolean;
  clear(): void;
}

/**
 * Service loader interface
 */
export interface IServiceLoader {
  load(serviceId: string): Promise<IService>;
  unload(serviceId: string): Promise<void>;
  reload(serviceId: string): Promise<IService>;
  isLoaded(serviceId: string): boolean;
  getLoaded(): string[];
}

/**
 * Service bus interface for inter-service communication
 */
export interface IServiceBus {
  register(service: IService): void;
  unregister(serviceId: string): void;
  emit(event: ServiceEvent): void;
  call<T = any>(
    _serviceId: string,
    method: string,
    ...args: unknown[]
  ): Promise<T>;
  broadcast(event: ServiceEvent): void;
  subscribe(_eventType: string, handler: (event: ServiceEvent) => void): void;
  unsubscribe(_eventType: string, handler: (event: ServiceEvent) => void): void;
}

/**
 * Mode-specific types
 */
export interface ModeConfig {
  name: string;
  category: ModeCategory;
  symbol: string;
  color: string;
  description: string;
  aliases?: string[];
  triggers?: string[];
  priority?: number;
}

export enum ModeCategory {
  REASONING = "reasoning",
  CREATIVE = "creative",
  ANALYTICAL = "analytical",
  STRUCTURAL = "structural",
  VALIDATION = "validation",
  CONTEMPLATIVE = "contemplative",
  INTENSIVE = "intensive",
  LEARNING = "learning",
  COLLABORATIVE = "collaborative",
}

export interface ModeContext {
  input: string;
  history: string[];
  userProfile?: any;
  sessionData?: any;
}

export interface ModeResult {
  response: string;
  metadata: {
    mode: string;
    confidence: number;
    processingTime?: number;
    suggestions?: string[];
  };
}

/**
 * Decorator metadata keys
 */
export const _METADATA_KEYS = {
  SERVICE: "service:metadata",
  MODE: "mode:config",
  EVENTHANDLER: "event:handlers",
  MIDDLEWARE: "middleware:config",
  DEPENDENCY: "dependency:injection",
} as const;

/**
 * Error types
 */
export class ServiceError extends Error {
  constructor(
    public serviceId: string,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export class ServiceNotFoundError extends ServiceError {
  constructor(_serviceId: string) {
    super(_serviceId, `Service ${_serviceId} not found`, "SERVICE_NOT_FOUND");
    this.name = "ServiceNotFoundError";
  }
}

export class ServiceLoadError extends ServiceError {
  constructor(_serviceId: string, reason: string) {
    super(
      _serviceId,
      `Failed to load service ${_serviceId}: ${reason}`,
      "SERVICE_LOAD_ERROR",
    );
    this.name = "ServiceLoadError";
  }
}
