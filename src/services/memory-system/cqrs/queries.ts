/**
 * CQRS Queries
 * Memory-specific queries for the Ultra Memory System
 */

import { v4 as uuidv4 } from "uuid";
import { Query } from "./interfaces";

/**
 * Base query implementation
 */
export abstract class BaseQuery implements Query {
  readonly id: string;
  readonly type: string;
  readonly timestamp: Date;
  readonly userId?: string;
  readonly correlationId?: string;
  readonly parameters: Record<string, any>;

  constructor(
    type: string,
    parameters: Record<string, any> = {},
    userId?: string,
    correlationId?: string,
  ) {
    this.id = uuidv4();
    this.type = type;
    this.timestamp = new Date();
    this.userId = userId;
    this.correlationId = correlationId || uuidv4();
    this.parameters = parameters;
  }
}

/**
 * Get memory by ID query
 */
export class GetMemoryByIdQuery extends BaseQuery {
  constructor(
    public readonly memoryId: string,
    public readonly includeMeta: boolean = false,
    userId?: string,
    correlationId?: string,
  ) {
    super(
      "GetMemoryByIdQuery",
      { memoryId, includeMeta },
      userId,
      correlationId,
    );
  }
}

/**
 * Find memories by type query
 */
export class FindMemoriesByTypeQuery extends BaseQuery {
  constructor(
    public readonly memoryType: string,
    public readonly _limit: number = 100,
    public readonly _offset: number = 0,
    userId?: string,
    correlationId?: string,
  ) {
    super(
      "FindMemoriesByTypeQuery",
      { memoryType, _limit, _offset },
      userId,
      correlationId,
    );
  }
}

/**
 * Find memories by tier query
 */
export class FindMemoriesByTierQuery extends BaseQuery {
  constructor(
    public readonly tier: string,
    public readonly _limit: number = 100,
    public readonly _offset: number = 0,
    userId?: string,
    correlationId?: string,
  ) {
    super(
      "FindMemoriesByTierQuery",
      { tier, _limit, _offset },
      userId,
      correlationId,
    );
  }
}

/**
 * Get most accessed memories query
 */
export class GetMostAccessedMemoriesQuery extends BaseQuery {
  constructor(
    public readonly _limit: number = 10,
    public readonly _timeRangeHours: number = 24,
    userId?: string,
    correlationId?: string,
  ) {
    super(
      "GetMostAccessedMemoriesQuery",
      { _limit, _timeRangeHours },
      userId,
      correlationId,
    );
  }
}

/**
 * Search memories query
 */
export class SearchMemoriesQuery extends BaseQuery {
  constructor(
    public readonly searchTerm: string,
    public readonly _searchFields: string[] = ["data", "tags"],
    public readonly _limit: number = 50,
    public readonly _offset: number = 0,
    public readonly filters: Record<string, any> = {},
    userId?: string,
    correlationId?: string,
  ) {
    super(
      "SearchMemoriesQuery",
      {
        searchTerm,
        _searchFields,
        _limit,
        _offset,
        filters,
      },
      userId,
      correlationId,
    );
  }
}

/**
 * Get memory statistics query
 */
export class GetMemoryStatisticsQuery extends BaseQuery {
  constructor(
    public readonly includeDetails: boolean = false,
    public readonly _timeRangeHours: number = 24,
    userId?: string,
    correlationId?: string,
  ) {
    super(
      "GetMemoryStatisticsQuery",
      { includeDetails, _timeRangeHours },
      userId,
      correlationId,
    );
  }
}

/**
 * Get memory usage by tier query
 */
export class GetMemoryUsageByTierQuery extends BaseQuery {
  constructor(
    public readonly includeSizeStats: boolean = true,
    userId?: string,
    correlationId?: string,
  ) {
    super(
      "GetMemoryUsageByTierQuery",
      { includeSizeStats },
      userId,
      correlationId,
    );
  }
}

/**
 * Get memory access patterns query
 */
export class _GetMemoryAccessPatternsQuery extends BaseQuery {
  constructor(
    public readonly memoryId?: string,
    public readonly patternType?: string,
    public readonly _timeRangeHours: number = 168, // 1 week
    public readonly _limit: number = 100,
    userId?: string,
    correlationId?: string,
  ) {
    super(
      "GetMemoryAccessPatternsQuery",
      {
        memoryId,
        patternType,
        _timeRangeHours,
        _limit,
      },
      userId,
      correlationId,
    );
  }
}

/**
 * Get knowledge graph query
 */
export class GetKnowledgeGraphQuery extends BaseQuery {
  constructor(
    public readonly memoryId?: string,
    public readonly _depth: number = 2,
    public readonly includeMetrics: boolean = false,
    userId?: string,
    correlationId?: string,
  ) {
    super(
      "GetKnowledgeGraphQuery",
      {
        memoryId,
        _depth,
        includeMetrics,
      },
      userId,
      correlationId,
    );
  }
}

/**
 * Get compression statistics query
 */
export class GetCompressionStatisticsQuery extends BaseQuery {
  constructor(
    public readonly algorithm?: string,
    public readonly _timeRangeHours: number = 24,
    userId?: string,
    correlationId?: string,
  ) {
    super(
      "GetCompressionStatisticsQuery",
      {
        algorithm,
        _timeRangeHours,
      },
      userId,
      correlationId,
    );
  }
}

/**
 * Get memory health query
 */
export class GetMemoryHealthQuery extends BaseQuery {
  constructor(
    public readonly includeRecommendations: boolean = true,
    userId?: string,
    correlationId?: string,
  ) {
    super(
      "GetMemoryHealthQuery",
      { includeRecommendations },
      userId,
      correlationId,
    );
  }
}

/**
 * Get event history query
 */
export class GetEventHistoryQuery extends BaseQuery {
  constructor(
    public readonly aggregateId?: string,
    public readonly eventTypes: string[] = [],
    public readonly fromTimestamp?: Date,
    public readonly toTimestamp?: Date,
    public readonly _limit: number = 100,
    public readonly _offset: number = 0,
    userId?: string,
    correlationId?: string,
  ) {
    super(
      "GetEventHistoryQuery",
      {
        aggregateId,
        eventTypes,
        fromTimestamp: fromTimestamp?.toISOString(),
        toTimestamp: toTimestamp?.toISOString(),
        _limit,
        _offset,
      },
      userId,
      correlationId,
    );
  }
}

/**
 * Query factory for creating queries with validation
 */
export class QueryFactory {
  /**
   * Create get memory by ID query with validation
   */
  static createGetMemoryByIdQuery(
    memoryId: string,
    options: {
      includeMeta?: boolean;
      userId?: string;
      correlationId?: string;
    } = {},
  ): GetMemoryByIdQuery {
    if (!memoryId || memoryId.trim().length === 0) {
      throw new Error("Memory ID is required");
    }

    return new GetMemoryByIdQuery(
      memoryId.trim(),
      options.includeMeta || false,
      options.userId,
      options.correlationId,
    );
  }

  /**
   * Create find memories by type query
   */
  static createFindMemoriesByTypeQuery(
    memoryType: string,
    options: {
      _limit?: number;
      _offset?: number;
      userId?: string;
      correlationId?: string;
    } = {},
  ): FindMemoriesByTypeQuery {
    if (!memoryType || memoryType.trim().length === 0) {
      throw new Error("Memory type is required");
    }

    const _limit = options._limit ?? 100;
    const _offset = options._offset ?? 0;

    if (_limit <= 0 || _limit > 1000) {
      throw new Error("Limit must be between 1 and 1000");
    }

    if (_offset < 0) {
      throw new Error("Offset must be non-negative");
    }

    return new FindMemoriesByTypeQuery(
      memoryType.trim(),
      _limit,
      _offset,
      options.userId,
      options.correlationId,
    );
  }

  /**
   * Create search memories query
   */
  static createSearchMemoriesQuery(
    searchTerm: string,
    options: {
      _searchFields?: string[];
      _limit?: number;
      _offset?: number;
      filters?: Record<string, any>;
      userId?: string;
      correlationId?: string;
    } = {},
  ): SearchMemoriesQuery {
    if (!searchTerm || searchTerm.trim().length === 0) {
      throw new Error("Search term is required");
    }

    const _limit = options._limit || 50;
    const _offset = options._offset || 0;

    if (_limit <= 0 || _limit > 1000) {
      throw new Error("Limit must be between 1 and 1000");
    }

    if (_offset < 0) {
      throw new Error("Offset must be non-negative");
    }

    const _searchFields = options._searchFields || ["data", "tags"];
    if (_searchFields.length === 0) {
      throw new Error("At least one search field must be specified");
    }

    return new SearchMemoriesQuery(
      searchTerm.trim(),
      _searchFields,
      _limit,
      _offset,
      options.filters || object,
      options.userId,
      options.correlationId,
    );
  }

  /**
   * Create get most accessed memories query
   */
  static createGetMostAccessedMemoriesQuery(
    options: {
      _limit?: number;
      _timeRangeHours?: number;
      userId?: string;
      correlationId?: string;
    } = {},
  ): GetMostAccessedMemoriesQuery {
    const _limit = options._limit ?? 10;
    const _timeRangeHours = options._timeRangeHours ?? 24;

    if (_limit <= 0 || _limit > 1000) {
      throw new Error("Limit must be between 1 and 1000");
    }

    if (_timeRangeHours <= 0) {
      throw new Error("Time range must be positive");
    }

    return new GetMostAccessedMemoriesQuery(
      _limit,
      _timeRangeHours,
      options.userId,
      options.correlationId,
    );
  }

  /**
   * Create get memory statistics query
   */
  static createGetMemoryStatisticsQuery(
    options: {
      includeDetails?: boolean;
      _timeRangeHours?: number;
      userId?: string;
      correlationId?: string;
    } = {},
  ): GetMemoryStatisticsQuery {
    const _timeRangeHours = options._timeRangeHours ?? 24;

    if (_timeRangeHours <= 0) {
      throw new Error("Time range must be positive");
    }

    return new GetMemoryStatisticsQuery(
      options.includeDetails || false,
      _timeRangeHours,
      options.userId,
      options.correlationId,
    );
  }

  /**
   * Create get knowledge graph query
   */
  static createGetKnowledgeGraphQuery(
    options: {
      memoryId?: string;
      _depth?: number;
      includeMetrics?: boolean;
      userId?: string;
      correlationId?: string;
    } = {},
  ): GetKnowledgeGraphQuery {
    const _depth = options._depth ?? 2;

    if (_depth <= 0 || _depth > 10) {
      throw new Error("Depth must be between 1 and 10");
    }

    return new GetKnowledgeGraphQuery(
      options.memoryId,
      _depth,
      options.includeMetrics || false,
      options.userId,
      options.correlationId,
    );
  }

  /**
   * Create get event history query
   */
  static createGetEventHistoryQuery(
    options: {
      aggregateId?: string;
      eventTypes?: string[];
      fromTimestamp?: Date;
      toTimestamp?: Date;
      _limit?: number;
      _offset?: number;
      userId?: string;
      correlationId?: string;
    } = {},
  ): GetEventHistoryQuery {
    const _limit = options._limit ?? 100;
    const _offset = options._offset ?? 0;

    if (_limit <= 0 || _limit > 1000) {
      throw new Error("Limit must be between 1 and 1000");
    }

    if (_offset < 0) {
      throw new Error("Offset must be non-negative");
    }

    if (options.fromTimestamp && options.toTimestamp) {
      if (options.fromTimestamp >= options.toTimestamp) {
        throw new Error("From timestamp must be before to timestamp");
      }
    }

    return new GetEventHistoryQuery(
      options.aggregateId,
      options.eventTypes || [],
      options.fromTimestamp,
      options.toTimestamp,
      _limit,
      _offset,
      options.userId,
      options.correlationId,
    );
  }
}
