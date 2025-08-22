/**
 * Team Memory Manager
 *
 * Manages shared memory across team members with real-time synchronization
 * and access control. Enables collaborative development with shared knowledge.
 */

import { EventEmitter } from 'events';
import { DualMemoryEngine } from '../dual-memory-engine';
import type {
  MemoryEvent,
  KnowledgeNode,
  CodePattern,
  ReasoningTrace,
  UserPreferenceSet,
} from '../types/memory-interfaces';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'developer' | 'viewer';
  joinedAt: Date;
  lastActive: Date;
  preferences: UserPreferenceSet;
}

export interface TeamWorkspace {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  members: TeamMember[];
  settings: WorkspaceSettings;
  memoryPool: SharedMemoryPool;
}

export interface WorkspaceSettings {
  visibility: 'private' | 'team' | 'organization';
  autoSync: boolean;
  syncInterval: number; // milliseconds
  retentionPolicy: RetentionPolicy;
  accessControl: AccessControl;
}

export interface RetentionPolicy {
  maxAge: number; // days
  maxSize: number; // MB
  compressionEnabled: boolean;
  archiveOldData: boolean;
}

export interface AccessControl {
  readPermission: 'all' | 'team' | 'role-based';
  writePermission: 'all' | 'admin' | 'owner';
  deletePermission: 'owner' | 'admin';
  sharePermission: 'all' | 'admin' | 'owner';
}

export interface SharedMemoryPool {
  knowledge: Map<string, KnowledgeNode[]>;
  patterns: Map<string, CodePattern[]>;
  reasoning: Map<string, ReasoningTrace[]>;
  preferences: Map<string, UserPreferenceSet>;
  statistics: MemoryStatistics;
}

export interface MemoryStatistics {
  totalNodes: number;
  totalPatterns: number;
  totalTraces: number;
  sharedCount: number;
  accessCount: number;
  contributionsByMember: Map<string, number>;
}

export interface SyncEvent {
  type: 'add' | 'update' | 'delete' | 'merge';
  timestamp: Date;
  memberId: string;
  data: Record<string, unknown>;
  workspace: string;
}

export class TeamMemoryManager extends EventEmitter {
  private workspaces: Map<string, TeamWorkspace> = new Map();
  private memberEngines: Map<string, DualMemoryEngine> = new Map();
  private syncQueue: SyncEvent[] = [];
  private syncInProgress: boolean = false;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(
    private config: {
      maxWorkspaces: number;
      maxMembersPerWorkspace: number;
      defaultSyncInterval: number;
      conflictResolution: 'latest' | 'merge' | 'prompt';
    } = {
      maxWorkspaces: 10,
      maxMembersPerWorkspace: 50,
      defaultSyncInterval: 5000,
      conflictResolution: 'merge',
    },
  ) {
    super();
    this.startSyncProcess();
  }

  /**
   * Create a new team workspace
   */
  async createWorkspace(
    name: string,
    description: string,
    owner: TeamMember,
    settings?: Partial<WorkspaceSettings>,
  ): Promise<TeamWorkspace> {
    if (this.workspaces.size >= this.config.maxWorkspaces) {
      throw new Error('Maximum workspace limit reached');
    }

    const workspace: TeamWorkspace = {
      id: `workspace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      createdAt: new Date(),
      members: [owner],
      settings: {
        visibility: 'team',
        autoSync: true,
        syncInterval: this.config.defaultSyncInterval,
        retentionPolicy: {
          maxAge: 90,
          maxSize: 1000,
          compressionEnabled: true,
          archiveOldData: true,
        },
        accessControl: {
          readPermission: 'team',
          writePermission: 'all',
          deletePermission: 'admin',
          sharePermission: 'admin',
        },
        ...settings,
      },
      memoryPool: {
        knowledge: new Map(),
        patterns: new Map(),
        reasoning: new Map(),
        preferences: new Map(),
        statistics: {
          totalNodes: 0,
          totalPatterns: 0,
          totalTraces: 0,
          sharedCount: 0,
          accessCount: 0,
          contributionsByMember: new Map([[owner.id, 0]]),
        },
      },
    };

    this.workspaces.set(workspace.id, workspace);

    // Initialize owner's memory engine
    await this.initializeMemberEngine(owner.id, workspace.id);

    this.emit('workspace:created', { workspace, owner });

    return workspace;
  }

  /**
   * Join an existing workspace
   */
  async joinWorkspace(workspaceId: string, member: TeamMember): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    if (workspace.members.length >= this.config.maxMembersPerWorkspace) {
      throw new Error('Workspace member limit reached');
    }

    if (workspace.members.some((m) => m.id === member.id)) {
      throw new Error('Member already in workspace');
    }

    workspace.members.push(member);
    workspace.memoryPool.statistics.contributionsByMember.set(member.id, 0);

    // Initialize member's memory engine
    await this.initializeMemberEngine(member.id, workspaceId);

    // Sync existing memory to new member
    await this.syncToMember(member.id, workspaceId);

    this.emit('member:joined', { workspace, member });
  }

  /**
   * Share memory to workspace
   */
  async shareMemory(
    memberId: string,
    workspaceId: string,
    memory: {
      type: 'knowledge' | 'pattern' | 'reasoning' | 'preference';
      data: Record<string, unknown>;
      metadata?: any;
    },
  ): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const member = workspace.members.find((m) => m.id === memberId);
    if (!member) {
      throw new Error('Member not in workspace');
    }

    // Check permissions
    if (!this.hasWritePermission(member, workspace)) {
      throw new Error('Insufficient permissions to share memory');
    }

    // Add to shared pool
    switch (memory.type) {
      case 'knowledge':
        this.addToPool(workspace.memoryPool.knowledge, memberId, memory.data);
        workspace.memoryPool.statistics.totalNodes++;
        break;
      case 'pattern':
        this.addToPool(workspace.memoryPool.patterns, memberId, memory.data);
        workspace.memoryPool.statistics.totalPatterns++;
        break;
      case 'reasoning':
        this.addToPool(workspace.memoryPool.reasoning, memberId, memory.data);
        workspace.memoryPool.statistics.totalTraces++;
        break;
      case 'preference':
        workspace.memoryPool.preferences.set(memberId, memory.data);
        break;
    }

    workspace.memoryPool.statistics.sharedCount++;
    workspace.memoryPool.statistics.contributionsByMember.set(
      memberId,
      (workspace.memoryPool.statistics.contributionsByMember.get(memberId) || 0) + 1,
    );

    // Queue for sync
    this.queueSync({
      type: 'add',
      timestamp: new Date(),
      memberId,
      data: memory,
      workspace: workspaceId,
    });

    this.emit('memory:shared', { workspace, member, memory });
  }

  /**
   * Query team memory
   */
  async queryTeamMemory(
    memberId: string,
    workspaceId: string,
    query: {
      type: 'knowledge' | 'pattern' | 'reasoning' | 'preference';
      filter?: string;
      limit?: number;
    },
  ): Promise<unknown[]> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const member = workspace.members.find((m) => m.id === memberId);
    if (!member) {
      throw new Error('Member not in workspace');
    }

    // Check permissions
    if (!this.hasReadPermission(member, workspace)) {
      throw new Error('Insufficient permissions to query memory');
    }

    workspace.memoryPool.statistics.accessCount++;

    // Query from pool
    let results: unknown[] = [];

    switch (query.type) {
      case 'knowledge':
        results = this.queryPool(workspace.memoryPool.knowledge, query.filter, query.limit);
        break;
      case 'pattern':
        results = this.queryPool(workspace.memoryPool.patterns, query.filter, query.limit);
        break;
      case 'reasoning':
        results = this.queryPool(workspace.memoryPool.reasoning, query.filter, query.limit);
        break;
      case 'preference':
        results = Array.from(workspace.memoryPool.preferences.values());
        break;
    }

    this.emit('memory:queried', { workspace, member, query, resultCount: results.length });

    return results;
  }

  /**
   * Synchronize memory across team
   */
  private async synchronizeMemory(): Promise<void> {
    if (this.syncInProgress || this.syncQueue.length === 0) {
      return;
    }

    this.syncInProgress = true;

    try {
      const eventsToSync = [...this.syncQueue];
      this.syncQueue = [];

      for (const event of eventsToSync) {
        const workspace = this.workspaces.get(event.workspace);
        if (!workspace) continue;

        // Sync to all members except the originator
        const otherMembers = workspace.members.filter((m) => m.id !== event.memberId);

        for (const member of otherMembers) {
          const engine = this.memberEngines.get(`${member.id}_${event.workspace}`);
          if (engine) {
            await this.applySync(engine, event);
          }
        }
      }

      this.emit('sync:completed', { eventCount: eventsToSync.length });
    } catch (error) {
      this.emit('sync:error', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Apply sync event to member's engine
   */
  private async applySync(engine: DualMemoryEngine, event: SyncEvent): Promise<void> {
    switch (event.type) {
      case 'add':
      case 'update':
        await engine.processEvent({
          type: 'team_sync',
          timestamp: event.timestamp,
          source: 'team_collaboration',
          data: event.data,
          metadata: {
            memberId: event.memberId,
            workspace: event.workspace,
          },
        });
        break;
      case 'delete':
        // Handle deletion
        break;
      case 'merge':
        // Handle merge conflicts
        await this.handleMergeConflict(engine, event);
        break;
    }
  }

  /**
   * Handle merge conflicts
   */
  private async handleMergeConflict(engine: DualMemoryEngine, event: SyncEvent): Promise<void> {
    switch (this.config.conflictResolution) {
      case 'latest':
        // Use the latest change
        await this.applySync(engine, { ...event, type: 'update' });
        break;
      case 'merge':
        // Attempt to merge changes
        // Implementation depends on data type
        break;
      case 'prompt':
        // Emit event for user resolution
        this.emit('conflict:detected', { engine, event });
        break;
    }
  }

  /**
   * Initialize member's memory engine
   */
  private async initializeMemberEngine(memberId: string, workspaceId: string): Promise<void> {
    const key = `${memberId}_${workspaceId}`;

    if (!this.memberEngines.has(key)) {
      const engine = new DualMemoryEngine({
        system1: {
          maxKnowledgeNodes: 500,
          embeddingDimension: 1536,
          cacheSize: 50,
          compressionThreshold: 0.8,
          accessDecayRate: 0.05,
        },
        system2: {
          maxReasoningTraces: 50,
          qualityThreshold: 0.7,
          reflectionFrequency: 24,
          enhancementEvaluationInterval: 12,
        },
        coordinator: {
          syncInterval: 5000,
          conflictResolutionStrategy: 'balanced',
          learningRate: 0.15,
          adaptationThreshold: 0.75,
        },
        performance: {
          targetLatency: 50,
          maxMemoryUsage: 256,
          cacheStrategy: 'lru',
          preloadPriority: 'medium',
          backgroundOptimization: true,
        },
      });

      this.memberEngines.set(key, engine);
    }
  }

  /**
   * Sync existing memory to new member
   */
  private async syncToMember(memberId: string, workspaceId: string): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return;

    const engine = this.memberEngines.get(`${memberId}_${workspaceId}`);
    if (!engine) return;

    // Sync all shared memory to new member
    for (const [contributorId, nodes] of workspace.memoryPool.knowledge) {
      for (const node of nodes) {
        await engine
          .getSystem1()
          .addKnowledgeNode(node.type, node.id, node.content, node.embedding, {
            ...node.metadata,
            sharedBy: contributorId,
          });
      }
    }

    for (const [contributorId, patterns] of workspace.memoryPool.patterns) {
      for (const pattern of patterns) {
        await engine.getSystem1().recordPattern({
          ...pattern,
          metadata: { ...pattern.metadata, sharedBy: contributorId },
        });
      }
    }

    for (const [contributorId, traces] of workspace.memoryPool.reasoning) {
      for (const trace of traces) {
        // Start and complete trace to preserve history
        const newTrace = await engine.getSystem2().startReasoningTrace(trace.context);
        await engine
          .getSystem2()
          .completeReasoningTrace(newTrace.id, trace.outcome || '', trace.metadata.qualityScore);
      }
    }
  }

  /**
   * Helper: Add to pool
   */
  private addToPool<T>(pool: Map<string, T[]>, memberId: string, data: T): void {
    const existing = pool.get(memberId) || [];
    existing.push(data);
    pool.set(memberId, existing);
  }

  /**
   * Helper: Query pool
   */
  private queryPool<T>(pool: Map<string, T[]>, filter?: string, limit?: number): T[] {
    const allItems: T[] = [];

    for (const items of pool.values()) {
      allItems.push(...items);
    }

    // Apply filter if provided
    let filtered = allItems;
    if (filter) {
      filtered = allItems.filter((item) =>
        JSON.stringify(item).toLowerCase().includes(filter.toLowerCase()),
      );
    }

    // Apply limit
    if (limit) {
      filtered = filtered.slice(0, limit);
    }

    return filtered;
  }

  /**
   * Check permissions
   */
  private hasReadPermission(member: TeamMember, workspace: TeamWorkspace): boolean {
    const permission = workspace.settings.accessControl.readPermission;

    switch (permission) {
      case 'all':
        return true;
      case 'team':
        return workspace.members.some((m) => m.id === member.id);
      case 'role-based':
        return member.role !== 'viewer';
      default:
        return false;
    }
  }

  private hasWritePermission(member: TeamMember, workspace: TeamWorkspace): boolean {
    const permission = workspace.settings.accessControl.writePermission;

    switch (permission) {
      case 'all':
        return true;
      case 'admin':
        return member.role === 'admin' || member.role === 'owner';
      case 'owner':
        return member.role === 'owner';
      default:
        return false;
    }
  }

  /**
   * Queue sync event
   */
  private queueSync(event: SyncEvent): void {
    this.syncQueue.push(event);
  }

  /**
   * Start sync process
   */
  private startSyncProcess(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      this.synchronizeMemory().catch((error) => {
        console.error('Sync error:', error);
      });
    }, this.config.defaultSyncInterval);
  }

  /**
   * Stop sync process
   */
  stopSyncProcess(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Get workspace statistics
   */
  getWorkspaceStatistics(workspaceId: string): MemoryStatistics | null {
    const workspace = this.workspaces.get(workspaceId);
    return workspace?.memoryPool.statistics || null;
  }

  /**
   * Get member contribution
   */
  getMemberContribution(memberId: string, workspaceId: string): number {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return 0;

    return workspace.memoryPool.statistics.contributionsByMember.get(memberId) || 0;
  }

  /**
   * Export workspace memory
   */
  async exportWorkspaceMemory(workspaceId: string): Promise<unknown> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    return {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        createdAt: workspace.createdAt,
        memberCount: workspace.members.length,
      },
      memory: {
        knowledge: Array.from(workspace.memoryPool.knowledge.entries()),
        patterns: Array.from(workspace.memoryPool.patterns.entries()),
        reasoning: Array.from(workspace.memoryPool.reasoning.entries()),
        preferences: Array.from(workspace.memoryPool.preferences.entries()),
      },
      statistics: workspace.memoryPool.statistics,
    };
  }
}
