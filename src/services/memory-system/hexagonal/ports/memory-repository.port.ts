/**
 * Memory Repository Port
 * Defines the contract for memory storage operations
 */

export interface MemoryEntity {
  id: string;
  type: string;
  data: any;
  size: number;
  tags: string[];
  tier: string;
  createdAt: Date;
  updatedAt: Date;
  accessCount: number;
  lastAccessedAt: Date;
  metadata: Record<string, any>;
}

export interface MemoryFilter {
  type?: string;
  tier?: string;
  tags?: string[];
  sizeRange?: { min?: number; max?: number };
  dateRange?: { from?: Date; to?: Date };
  userId?: string;
}

export interface MemoryStats {
  totalMemories: number;
  totalSize: number;
  memoryByTier: Record<string, number>;
  memoryByType: Record<string, number>;
  averageAccessCount: number;
  lastUpdated: Date;
}

/**
 * Primary port for memory storage operations
 */
export interface _IMemoryRepositoryPort {
  /**
   * Store a new memory
   */
  store(
    _memory: Omit<MemoryEntity, "id" | "createdAt" | "updatedAt">,
  ): Promise<MemoryEntity>;

  /**
   * Retrieve memory by ID
   */
  findById(id: string): Promise<MemoryEntity | null>;

  /**
   * Find memories by criteria
   */
  findByCriteria(
    _filter: MemoryFilter,
    limit?: number,
    offset?: number,
  ): Promise<MemoryEntity[]>;

  /**
   * Update existing memory
   */
  update(
    _id: string,
    updates: Partial<MemoryEntity>,
  ): Promise<MemoryEntity | null>;

  /**
   * Delete memory
   */
  delete(id: string): Promise<boolean>;

  /**
   * Search memories by text
   */
  search(
    _query: string,
    fields: string[],
    limit?: number,
  ): Promise<MemoryEntity[]>;

  /**
   * Get memory statistics
   */
  getStats(filter?: MemoryFilter): Promise<MemoryStats>;

  /**
   * Bulk operations
   */
  bulkStore(
    _memories: Omit<MemoryEntity, "id" | "createdAt" | "updatedAt">[],
  ): Promise<MemoryEntity[]>;
  bulkUpdate(
    updates: Array<{ _id: string; updates: Partial<MemoryEntity> }>,
  ): Promise<MemoryEntity[]>;
  bulkDelete(ids: string[]): Promise<number>;

  /**
   * Transaction support
   */
  transaction<T>(
    _operation: (repo: IMemoryRepositoryPort) => Promise<T>,
  ): Promise<T>;
}
