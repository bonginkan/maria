/**
 * Team Memory Manager
 *
 * Manages shared memory across team members with real-time synchronization
 * and access control. Enables collaborative development with shared knowledge.
 */

import { EventEmitter } from "node:events";
import { DualMemoryEngine } from "../dual-memory-engine";
import type {
  CodePattern,
  KnowledgeNode,
  _MemoryEvent,
  ReasoningTrace,
  UserPreferenceSet,
} from "../types/memory-interfaces";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "developer" | "viewer";
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
  visibility: "private" | "team" | "organization";
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
  readPermission: "all" | "team" | "role-based";
  writePermission: "all" | "admin" | "owner";
  deletePermission: "owner" | "admin";
  sharePermission: "all" | "admin" | "owner";
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
  type: "add" | "update" | "delete" | "merge";
  timestamp: Date;
  memberId: string;
  data: any;
  _workspace: string;
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
      conflictResolution: "latest" | "merge" | "prompt";
    } = {
      maxWorkspaces: 10,
      maxMembersPerWorkspace: 50,
      defaultSyncInterval: 5000,
      conflictResolution: "merge",
    },
  ) {
    super();
    this.startSyncProcess();
  }

  /**
   * Create a new team _workspace
   */
  async createWorkspace(
    name: string,
    description: string,
    owner: TeamMember,
    settings?: Partial<WorkspaceSettings>,
  ): Promise<TeamWorkspace> {
    if (this.workspaces.size >= this.config.maxWorkspaces) {
      throw new Error("Maximum _workspace limit reached");
    }

    const _workspace: TeamWorkspace = {
      id: `workspace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      createdAt: new Date(),
      members: [owner],
      settings: {
        visibility: "team",
        autoSync: true,
        syncInterval: this.config.defaultSyncInterval,
        retentionPolicy: {
          maxAge: 90,
          maxSize: 1000,
          compressionEnabled: true,
          archiveOldData: true,
        },
        accessControl: {
          readPermission: "team",
          writePermission: "all",
          deletePermission: "admin",
          sharePermission: "admin",
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

    this.workspaces.set(_workspace.id, _workspace);

    // Initialize owner's memory _engine
    await this.initializeMemberEngine(owner.id, _workspace.id);

    this.emit("_workspace:created", { _workspace, owner });

    return _workspace;
  }

  /**
   * Join an _existing _workspace
   */
  async joinWorkspace(
    _workspaceId: string,
    _member: TeamMember,
  ): Promise<void> {
    const _workspace = this.workspaces.get(_workspaceId);
    if (!_workspace) {
      throw new Error("Workspace not found");
    }

    if (_workspace.members.length >= this.config.maxMembersPerWorkspace) {
      throw new Error("Workspace _member limit reached");
    }

    if (_workspace.members.some((m) => m.id === member.id)) {
      throw new Error("Member already in _workspace");
    }

    _workspace.members.push(_member);
    workspace.memoryPool.statistics.contributionsByMember.set(member.id, 0);

    // Initialize _member's memory _engine
    await this.initializeMemberEngine(member.id, _workspaceId);

    // Sync _existing memory to new _member
    await this.syncToMember(member.id, _workspaceId);

    this.emit("_member:joined", { _workspace, _member });
  }

  /**
   * Share memory to _workspace
   */
  async shareMemory(
    memberId: string,
    workspaceId: string,
    memory: {
      type: "knowledge" | "pattern" | "reasoning" | "preference";
      data: any;
      metadata?: any;
    },
  ): Promise<void> {
    const _workspace = this.workspaces.get(workspaceId);
    if (!_workspace) {
      throw new Error("Workspace not found");
    }

    const _member = _workspace.members.find((m) => m.id === memberId);
    if (!_member) {
      throw new Error("Member not in _workspace");
    }

    // Check permissions
    if (!this.hasWritePermission(_member, _workspace)) {
      throw new Error("Insufficient permissions to share memory");
    }

    // Add to shared pool
    switch (memory.type) {
      case "knowledge":
        this.addToPool(_workspace.memoryPool.knowledge, memberId, memory.data);
        workspace.memoryPool.statistics.totalNodes++;
        break;
      case "pattern":
        this.addToPool(_workspace.memoryPool.patterns, memberId, memory.data);
        workspace.memoryPool.statistics.totalPatterns++;
        break;
      case "reasoning":
        this.addToPool(_workspace.memoryPool.reasoning, memberId, memory.data);
        workspace.memoryPool.statistics.totalTraces++;
        break;
      case "preference":
        workspace.memoryPool.preferences.set(memberId, memory.data);
        break;
    }

    _workspace.memoryPool.statistics.sharedCount++;
    workspace.memoryPool.statistics.contributionsByMember.set(
      memberId,
      (_workspace.memoryPool.statistics.contributionsByMember.get(memberId) ||
        0) + 1,
    );

    // Queue for sync
    this.queueSync({
      type: "add",
      timestamp: new Date(),
      memberId,
      data: memory,
      _workspace: workspaceId,
    });

    this.emit("memory:shared", { _workspace, _member, memory });
  }

  /**
   * Query team memory
   */
  async queryTeamMemory(
    memberId: string,
    workspaceId: string,
    query: {
      type: "knowledge" | "pattern" | "reasoning" | "preference";
      filter?: string;
      limit?: number;
    },
  ): Promise<any[]> {
    const _workspace = this.workspaces.get(workspaceId);
    if (!_workspace) {
      throw new Error("Workspace not found");
    }

    const _member = _workspace.members.find((m) => m.id === memberId);
    if (!_member) {
      throw new Error("Member not in _workspace");
    }

    // Check permissions
    if (!this.hasReadPermission(_member, _workspace)) {
      throw new Error("Insufficient permissions to query memory");
    }

    workspace.memoryPool.statistics.accessCount++;

    // Query from pool
    let results: any[] = [];

    switch (query.type) {
      case "knowledge":
        results = this.queryPool(
          _workspace.memoryPool.knowledge,
          query.filter,
          query.limit,
        );
        break;
      case "pattern":
        results = this.queryPool(
          _workspace.memoryPool.patterns,
          query.filter,
          query.limit,
        );
        break;
      case "reasoning":
        results = this.queryPool(
          _workspace.memoryPool.reasoning,
          query.filter,
          query.limit,
        );
        break;
      case "preference":
        results = Array.from(_workspace.memoryPool.preferences.values());
        break;
    }

    this.emit("memory:queried", {
      _workspace,
      _member,
      query,
      resultCount: results.length,
    });

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
      const _eventsToSync = [...this.syncQueue];
      this.syncQueue = [];

      for (const event of _eventsToSync) {
        const _workspace = this.workspaces.get(event._workspace);
        if (!_workspace) {
          continue;
        }

        // Sync to all members except the originator
        const _otherMembers = _workspace.members.filter(
          (m) => m.id !== event.memberId,
        );

        for (const _member of _otherMembers) {
          const _engine = this.memberEngines.get(
            `${_member.id}_${event._workspace}`,
          );
          if (_engine) {
            await this.applySync(_engine, event);
          }
        }
      }

      this.emit("sync:completed", { eventCount: _eventsToSync.length });
    } catch (_error) {
      this.emit("sync:_error", _error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Apply sync event to _member's _engine
   */
  private async applySync(
    _engine: DualMemoryEngine,
    event: SyncEvent,
  ): Promise<void> {
    switch (event.type) {
      case "add":
      case "update":
        await engine.processEvent({
          type: "team_sync",
          timestamp: event.timestamp,
          source: "team_collaboration",
          data: event.data,
          metadata: {
            memberId: event.memberId,
            _workspace: event.workspace,
          },
        });
        break;
      case "delete":
        // Handle deletion
        break;
      case "merge":
        // Handle merge conflicts
        await this.handleMergeConflict(_engine, event);
        break;
    }
  }

  /**
   * Handle merge conflicts
   */
  private async handleMergeConflict(
    _engine: DualMemoryEngine,
    event: SyncEvent,
  ): Promise<void> {
    switch (this.config.conflictResolution) {
      case "latest":
        // Use the latest change
        await this.applySync(_engine, { ...event, type: "update" });
        break;
      case "merge":
        // Attempt to merge changes
        // Implementation depends on data type
        break;
      case "prompt":
        // Emit event for user resolution
        this.emit("conflict:detected", { _engine, event });
        break;
    }
  }

  /**
   * Initialize _member's memory _engine
   */
  private async initializeMemberEngine(
    _memberId: string,
    workspaceId: string,
  ): Promise<void> {
    const _key = `${_memberId}_${workspaceId}`;

    if (!this.memberEngines.has(_key)) {
      const _engine = new DualMemoryEngine({
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
          conflictResolutionStrategy: "balanced",
          learningRate: 0.15,
          adaptationThreshold: 0.75,
        },
        performance: {
          targetLatency: 50,
          maxMemoryUsage: 256,
          cacheStrategy: "lru",
          preloadPriority: "medium",
          backgroundOptimization: true,
        },
      });

      this.memberEngines.set(_key, _engine);
    }
  }

  /**
   * Sync _existing memory to new _member
   */
  private async syncToMember(
    _memberId: string,
    workspaceId: string,
  ): Promise<void> {
    const _workspace = this.workspaces.get(workspaceId);
    if (!_workspace) {
      return;
    }

    const _engine = this.memberEngines.get(`${_memberId}_${workspaceId}`);
    if (!_engine) {
      return;
    }

    // Sync all shared memory to new _member
    for (const [contributorId, nodes] of _workspace.memoryPool.knowledge) {
      for (const node of nodes) {
        await _engine
          .getSystem1()
          .addKnowledgeNode(node.type, node.id, node.content, node.embedding, {
            ...node.metadata,
            sharedBy: contributorId,
          });
      }
    }

    for (const [contributorId, patterns] of _workspace.memoryPool.patterns) {
      for (const pattern of patterns) {
        await _engine.getSystem1().recordPattern({
          ...pattern,
          metadata: { ...pattern.metadata, sharedBy: contributorId },
        });
      }
    }

    for (const [_contributorId, traces] of _workspace.memoryPool.reasoning) {
      for (const trace of traces) {
        // Start and complete trace to preserve history
        const _newTrace = await _engine
          .getSystem2()
          .startReasoningTrace(trace.context);
        await _engine
          .getSystem2()
          .completeReasoningTrace(
            _newTrace.id,
            trace.outcome || "",
            trace.metadata.qualityScore,
          );
      }
    }
  }

  /**
   * Helper: Add to pool
   */
  private addToPool<T>(
    _pool: Map<string, T[]>,
    memberId: string,
    data: T,
  ): void {
    const _existing = _pool.get(memberId) || [];
    existing.push(data);
    pool.set(memberId, _existing);
  }

  /**
   * Helper: Query pool
   */
  private queryPool<T>(
    _pool: Map<string, T[]>,
    filter?: string,
    limit?: number,
  ): T[] {
    const allItems: T[] = [];

    for (const items of _pool.values()) {
      allItems.push(...items);
    }

    // Apply filter if provided
    let filtered = allItems;
    if (filter) {
      filtered = allItems.filter((_item) =>
        JSON.stringify(_item).toLowerCase().includes(filter.toLowerCase()),
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
  private hasReadPermission(
    _member: TeamMember,
    _workspace: TeamWorkspace,
  ): boolean {
    const _permission = _workspace.settings.accessControl.readPermission;

    switch (_permission) {
      case "all":
        return true;
      case "team":
        return _workspace.members.some((m) => m.id === _member.id);
      case "role-based":
        return _member.role !== "viewer";
      default:
        return false;
    }
  }

  private hasWritePermission(
    _member: TeamMember,
    _workspace: TeamWorkspace,
  ): boolean {
    const _permission = _workspace.settings.accessControl.writePermission;

    switch (_permission) {
      case "all":
        return true;
      case "admin":
        return _member.role === "admin" || _member.role === "owner";
      case "owner":
        return _member.role === "owner";
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
      this.synchronizeMemory().catch((_error) => {
        console.error("Sync _error:", _error);
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
   * Get _workspace statistics
   */
  getWorkspaceStatistics(workspaceId: string): MemoryStatistics | null {
    const _workspace = this.workspaces.get(workspaceId);
    return _workspace?.memoryPool.statistics || null;
  }

  /**
   * Get _member contribution
   */
  getMemberContribution(_memberId: string, workspaceId: string): number {
    const _workspace = this.workspaces.get(workspaceId);
    if (!_workspace) {
      return 0;
    }

    return (
      _workspace.memoryPool.statistics.contributionsByMember.get(_memberId) || 0
    );
  }

  /**
   * Export _workspace memory
   */
  async exportWorkspaceMemory(workspaceId: string): Promise<any> {
    const _workspace = this.workspaces.get(workspaceId);
    if (!_workspace) {
      throw new Error("Workspace not found");
    }

    return {
      _workspace: {
        id: _workspace.id,
        name: _workspace.name,
        description: _workspace.description,
        createdAt: _workspace.createdAt,
        memberCount: _workspace.members.length,
      },
      memory: {
        knowledge: Array.from(_workspace.memoryPool.knowledge.entries()),
        patterns: Array.from(_workspace.memoryPool.patterns.entries()),
        reasoning: Array.from(_workspace.memoryPool.reasoning.entries()),
        preferences: Array.from(_workspace.memoryPool.preferences.entries()),
      },
      statistics: _workspace.memoryPool.statistics,
    };
  }
}
