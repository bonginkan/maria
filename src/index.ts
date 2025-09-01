/**
 * MARIA v3.6.0 - Minimal Public API + Multimodal
 *
 * Core exports for maximum stability and focused functionality.
 * Everything else is internal implementation detail.
 */

// Core Router - The heart of intelligent routing
export { IntelligentRouterService } from "./services/intelligent-router/app/IntelligentRouterService";
export type { RoutingDecision } from "./services/intelligent-router/domain/priority-queue";

// Memory System - Dual-layer cognitive architecture
export { System1MemoryManager } from "./services/memory-system/system1-memory";
export { System2MemoryManager } from "./services/memory-system/system2-memory";
export { DualMemoryEngine } from "./services/memory-system/dual-memory-engine";
export type { DualMemoryEngineConfig } from "./services/memory-system/dual-memory-engine";

// File Operations - Unified, safe file system interface
export { FileSystemService } from "./services/file-system/FileSystemService";

// Multimodal AI - Complete multimodal processing platform
export { MultimodalService } from "./services/multimodal/MultimodalService";
export { MultimodalDeploymentConfig } from "./services/multimodal/deployment/MultimodalDeploymentConfig";
export type {
  MultimodalServiceConfig,
  MultimodalOperation,
  MultimodalResult,
} from "./services/multimodal/MultimodalService";

// Phase 4.0 Enterprise Security & Memory Portability
export {
  EnterpriseSecurityIntegration,
  SecureSlashCommandAdapter,
  RBACCommandGuard,
  createEnterpriseSecurityIntegration,
  type SecurityIntegrationConfig,
  type SecurityMetrics,
  type SecurityReport,
  type AuthenticatedUser,
  type PermissionSet,
} from "./services/security";

export {
  MemoryPortabilityFramework,
  createMemoryPortabilityFramework,
  type PortabilityConfig,
  type ExportRequest,
  type ImportRequest,
  type PortabilityResult,
} from "./services/memory-system/data-porter-system/MemoryPortabilityFramework";

// Document Auto-Save System
export {
  autoSaveDocument,
  autoSaveMultipleDocuments,
  classifyDocument,
  DocumentType,
  generateDocumentFilename,
  saveDocumentToFile
} from "./services/document-auto-save";

// Intelligent Document Save System
export {
  IntelligentDocumentSaveService,
  intelligentSave,
  autoSaveIntelligently,
  autoSaveMultipleIntelligently,
  type IntelligentSaveOptions,
  type IntelligentSaveResult
} from "./services/intelligent-document-save";

// Filename Inference System
export {
  FilenameInferenceService
} from "./services/code-intent/FilenameInferenceService";

export {
  EnterpriseDataPorter,
  type DataPorterConfig,
} from "./services/memory-system/data-porter-system/enterprise-data-porter";

export {
  AccessControlManager,
  type User,
  type Role,
  type PermissionSet as AccessControlPermissionSet,
} from "./services/memory-system/enterprise/access-control-manager";

// Model Selector v2 - Intelligent model selection system (Beta)
export {
  ModelSelectorEngine,
  ModelRegistry,
  RecommendationEngine,
  ModelSelectorV2Facade,
  isModelSelectorV2Enabled,
  getModelSelectorV2Config,
  createModelSelector,
  type ModelInfo,
  type ModelFilter,
  type RecommendationContext,
  type ModelRecommendation,
  type ModelSelectorConfig,
  type LegacyModelChoice,
} from "./services/model-selector/index";

// Intelligent Model Selector (IMS) - Phase 1 & Phase 2 Implementation
// Phase 1: Foundation + Complete Decision Logging
export { IMSRouter } from './services/intelligent-model-selector/IMSRouter.js';
export { HysteresisHealthChecker } from './services/intelligent-model-selector/HysteresisHealthChecker.js';
export { RunawayPreventionCircuitBreaker } from './services/intelligent-model-selector/RunawayPreventionCircuitBreaker.js';
export { PreciseCostCalculator } from './services/intelligent-model-selector/PreciseCostCalculator.js';
export { TTFBAuditor } from './services/intelligent-model-selector/TTFBAuditor.js';
export { IdempotencyManager } from './services/intelligent-model-selector/IdempotencyManager.js';
export { HotCache } from './services/intelligent-model-selector/HotCache.js';

// Phase 2: API Integration + SSE Adaptive Control
export { IMSAPIEndpoints } from './services/intelligent-model-selector/api/IMSAPIEndpoints.js';
export { AdaptiveSSEController } from './services/intelligent-model-selector/api/AdaptiveSSEController.js';
export { UnifiedProviderInterface } from './services/intelligent-model-selector/providers/UnifiedProviderInterface.js';
export { AdminAPI } from './services/intelligent-model-selector/AdminAPI.js';
