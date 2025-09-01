/**
 * CQRS Commands
 * Memory-specific commands for the Ultra Memory System
 */

import { v4 as uuidv4 } from "uuid";
import { Command } from "./interfaces";

/**
 * Base command implementation
 */
export abstract class BaseCommand implements Command {
  readonly id: string;
  readonly type: string;
  readonly timestamp: Date;
  readonly userId?: string;
  readonly correlationId?: string;
  readonly metadata: Record<string, any>;
  readonly parameters: Record<string, any>;

  constructor(
    type: string,
    userId?: string,
    correlationId?: string,
    metadata: Record<string, any> = {},
  ) {
    this.id = uuidv4();
    this.type = type;
    this.timestamp = new Date();
    this.userId = userId;
    this.correlationId = correlationId || uuidv4();
    this.metadata = metadata;
    this.parameters = { metadata };
  }
}

/**
 * Store _memory command
 */
export class StoreMemoryCommand extends BaseCommand {
  constructor(
    public readonly memoryId: string,
    public readonly memoryType: string,
    public readonly data: unknown,
    public readonly size: number,
    public readonly tags: string[] = [],
    userId?: string,
    correlationId?: string,
    metadata: Record<string, any> = {},
  ) {
    super("StoreMemoryCommand", userId, correlationId, metadata);
  }
}

/**
 * Retrieve _memory command
 */
export class RetrieveMemoryCommand extends BaseCommand {
  constructor(
    public readonly memoryId: string,
    public readonly includeMeta: boolean = false,
    userId?: string,
    correlationId?: string,
    metadata: Record<string, any> = {},
  ) {
    super("RetrieveMemoryCommand", userId, correlationId, metadata);
  }
}

/**
 * Compress _memory context command
 */
export class CompressContextCommand extends BaseCommand {
  constructor(
    public readonly memoryId: string,
    public readonly algorithm: string = "gzip",
    public readonly _compressionLevel: number = 6,
    userId?: string,
    correlationId?: string,
    metadata: Record<string, any> = {},
  ) {
    super("CompressContextCommand", userId, correlationId, metadata);
  }
}

/**
 * Promote _memory tier command
 */
export class PromoteMemoryCommand extends BaseCommand {
  constructor(
    public readonly memoryId: string,
    public readonly toTier: string,
    public readonly reason?: string,
    userId?: string,
    correlationId?: string,
    metadata: Record<string, any> = {},
  ) {
    super("PromoteMemoryCommand", userId, correlationId, metadata);
  }
}

/**
 * Evict _memory command
 */
export class EvictMemoryCommand extends BaseCommand {
  constructor(
    public readonly memoryId: string,
    public readonly reason?: string,
    userId?: string,
    correlationId?: string,
    metadata: Record<string, any> = {},
  ) {
    super("EvictMemoryCommand", userId, correlationId, metadata);
  }
}

/**
 * Learn pattern command
 */
export class LearnPatternCommand extends BaseCommand {
  constructor(
    public readonly memoryId: string,
    public readonly patternType: string,
    public readonly pattern: unknown,
    public readonly _confidence: number,
    public readonly _frequency: number,
    userId?: string,
    correlationId?: string,
    metadata: Record<string, any> = {},
  ) {
    super("LearnPatternCommand", userId, correlationId, metadata);
  }
}

/**
 * Update knowledge graph command
 */
export class _UpdateKnowledgeGraphCommand extends BaseCommand {
  constructor(
    public readonly memoryId: string,
    public readonly updates: {
      addNodes?: Array<{
        id: string;
        type: string;
        properties: Record<string, any>;
      }>;
      addEdges?: Array<{
        from: string;
        to: string;
        type: string;
        weight: number;
        properties?: Record<string, any>;
      }>;
      removeNodes?: string[];
      removeEdges?: Array<{ from: string; to: string; type: string }>;
    },
    userId?: string,
    correlationId?: string,
    metadata: Record<string, any> = {},
  ) {
    super("UpdateKnowledgeGraphCommand", userId, correlationId, metadata);
  }
}

/**
 * Create snapshot command
 */
export class CreateSnapshotCommand extends BaseCommand {
  constructor(
    public readonly aggregateId: string,
    public readonly reason: string = "manual",
    userId?: string,
    correlationId?: string,
    metadata: Record<string, any> = {},
  ) {
    super("CreateSnapshotCommand", userId, correlationId, metadata);
  }
}

/**
 * Cleanup old memories command
 */
export class CleanupOldMemoriesCommand extends BaseCommand {
  constructor(
    public readonly olderThan: Date,
    public readonly dryRun: boolean = true,
    userId?: string,
    correlationId?: string,
    metadata: Record<string, any> = {},
  ) {
    super("CleanupOldMemoriesCommand", userId, correlationId, metadata);
  }
}

/**
 * Bulk import memories command
 */
export class BulkImportMemoriesCommand extends BaseCommand {
  constructor(
    public readonly memories: Array<{
      memoryType: string;
      data: any;
      size: number;
      tags?: string[];
    }>,
    public readonly _batchSize: number = 100,
    userId?: string,
    correlationId?: string,
    metadata: Record<string, any> = {},
  ) {
    super("BulkImportMemoriesCommand", userId, correlationId, metadata);
  }
}

/**
 * Command factory for creating commands with validation
 */
export class CommandFactory {
  /**
   * Create store _memory command with validation
   */
  static createStoreMemoryCommand(
    memoryId: string,
    memoryType: string,
    data: unknown,
    size: number,
    options: {
      tags?: string[];
      userId?: string;
      correlationId?: string;
      metadata?: Record<string, any>;
    } = {},
  ): StoreMemoryCommand {
    if (!memoryId || memoryId.trim().length === 0) {
      throw new Error("Memory ID is required");
    }

    if (!memoryType || memoryType.trim().length === 0) {
      throw new Error("Memory type is required");
    }

    if (size <= 0) {
      throw new Error("Size must be positive");
    }

    return new StoreMemoryCommand(
      memoryId.trim(),
      memoryType.trim(),
      data,
      size,
      options.tags || [],
      options.userId,
      options.correlationId,
      options.metadata || object,
    );
  }

  /**
   * Create retrieve _memory command
   */
  static createRetrieveMemoryCommand(
    memoryId: string,
    options: {
      includeMeta?: boolean;
      userId?: string;
      correlationId?: string;
      metadata?: Record<string, any>;
    } = {},
  ): RetrieveMemoryCommand {
    if (!memoryId || memoryId.trim().length === 0) {
      throw new Error("Memory ID is required");
    }

    return new RetrieveMemoryCommand(
      memoryId.trim(),
      options.includeMeta || false,
      options.userId,
      options.correlationId,
      options.metadata || object,
    );
  }

  /**
   * Create compress context command
   */
  static createCompressContextCommand(
    memoryId: string,
    algorithm: string = "gzip",
    options: {
      _compressionLevel?: number;
      userId?: string;
      correlationId?: string;
      metadata?: Record<string, any>;
    } = {},
  ): CompressContextCommand {
    if (!memoryId || memoryId.trim().length === 0) {
      throw new Error("Memory ID is required");
    }

    const _compressionLevel = options._compressionLevel || 6;

    if (_compressionLevel < 1 || _compressionLevel > 9) {
      throw new Error("Compression level must be between 1 and 9");
    }

    return new CompressContextCommand(
      memoryId.trim(),
      algorithm,
      _compressionLevel,
      options.userId,
      options.correlationId,
      options.metadata || object,
    );
  }

  /**
   * Create promote _memory command
   */
  static createPromoteMemoryCommand(
    memoryId: string,
    toTier: string,
    options: {
      reason?: string;
      userId?: string;
      correlationId?: string;
      metadata?: Record<string, any>;
    } = {},
  ): PromoteMemoryCommand {
    if (!memoryId || memoryId.trim().length === 0) {
      throw new Error("Memory ID is required");
    }

    if (!toTier || toTier.trim().length === 0) {
      throw new Error("Target tier is required");
    }

    return new PromoteMemoryCommand(
      memoryId.trim(),
      toTier.trim(),
      options.reason,
      options.userId,
      options.correlationId,
      options.metadata || object,
    );
  }

  /**
   * Create learn pattern command
   */
  static createLearnPatternCommand(
    memoryId: string,
    patternType: string,
    pattern: unknown,
    options: {
      _confidence?: number;
      _frequency?: number;
      userId?: string;
      correlationId?: string;
      metadata?: Record<string, any>;
    } = {},
  ): LearnPatternCommand {
    if (!memoryId || memoryId.trim().length === 0) {
      throw new Error("Memory ID is required");
    }

    if (!patternType || patternType.trim().length === 0) {
      throw new Error("Pattern type is required");
    }

    const _confidence = options._confidence ?? 0.5;
    const _frequency = options._frequency ?? 1;

    if (_confidence < 0 || _confidence > 1) {
      throw new Error("Confidence must be between 0 and 1");
    }

    if (_frequency < 0) {
      throw new Error("Frequency must be non-negative");
    }

    return new LearnPatternCommand(
      memoryId.trim(),
      patternType.trim(),
      pattern,
      _confidence,
      _frequency,
      options.userId,
      options.correlationId,
      options.metadata || object,
    );
  }

  /**
   * Create update knowledge graph command
   */
  static createUpdateKnowledgeGraphCommand(
    memoryId: string,
    updates: {
      addNodes?: Array<{
        id: string;
        type: string;
        properties: Record<string, any>;
      }>;
      addEdges?: Array<{
        from: string;
        to: string;
        type: string;
        weight: number;
        properties?: Record<string, any>;
      }>;
      removeNodes?: string[];
      removeEdges?: Array<{ from: string; to: string; type: string }>;
    },
    options: {
      userId?: string;
      correlationId?: string;
      metadata?: Record<string, any>;
    } = {},
  ): UpdateKnowledgeGraphCommand {
    if (!memoryId || memoryId.trim().length === 0) {
      throw new Error("Memory ID is required");
    }

    if (!updates || Object.keys(updates).length === 0) {
      throw new Error("At least one update operation must be specified");
    }

    return new UpdateKnowledgeGraphCommand(
      memoryId.trim(),
      updates,
      options.userId,
      options.correlationId,
      options.metadata || object,
    );
  }

  /**
   * Create bulk import command
   */
  static createBulkImportMemoriesCommand(
    memories: Array<{
      memoryType: string;
      data: any;
      size: number;
      tags?: string[];
    }>,
    options: {
      _batchSize?: number;
      userId?: string;
      correlationId?: string;
      metadata?: Record<string, any>;
    } = {},
  ): BulkImportMemoriesCommand {
    if (!memories || memories.length === 0) {
      throw new Error("Memories array cannot be empty");
    }

    // Validate each _memory
    for (let i = 0; i < memories.length; i++) {
      const _memory = memories[i];
      if (!_memory.memoryType || _memory.memoryType.trim().length === 0) {
        throw new Error(`Memory ${i}: type is required`);
      }
      if (!_memory.data) {
        throw new Error(`Memory ${i}: data is required`);
      }
      if (_memory.size <= 0) {
        throw new Error(`Memory ${i}: size must be positive`);
      }
    }

    const _batchSize = options._batchSize || 100;
    if (_batchSize <= 0 || _batchSize > 1000) {
      throw new Error("Batch size must be between 1 and 1000");
    }

    return new BulkImportMemoriesCommand(
      memories,
      _batchSize,
      options.userId,
      options.correlationId,
      options.metadata || object,
    );
  }
}
