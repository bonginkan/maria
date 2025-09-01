/**
 * Team Collaboration API
 *
 * High-level API for team _memory sharing and collaboration features
 */

import { DualMemoryEngine } from "../dual-memory-engine";
import {
  TeamMember,
  TeamMemoryManager,
  TeamWorkspace,
} from "./team-_memory-manager";
import {
  CrossSessionLearningEngine,
  SessionData,
} from "../learning/cross-session-learning";
import {
  PersonalizedAIBehavior,
  _PersonalizedResponse,
  UserContext,
} from "../learning/personalized-ai-behavior";
import { EventEmitter } from "node:events";

export interface TeamCollaborationConfig {
  enableRealTimeSync: boolean;
  enableCrossSessionLearning: boolean;
  enablePersonalization: boolean;
  syncInterval: number;
  maxTeamSize: number;
  dataRetentionDays: number;
}

export interface CollaborationSession {
  id: string;
  workspaceId: string;
  members: TeamMember[];
  startTime: Date;
  sharedMemories: SharedMemory[];
  activities: Activity[];
}

export interface SharedMemory {
  id: string;
  type: "code" | "bug" | "pattern" | "solution" | "knowledge";
  content: any;
  sharedBy: TeamMember;
  sharedAt: Date;
  accessCount: number;
  ratings: Rating[];
}

export interface Rating {
  memberId: string;
  score: number; // 1-5
  comment?: string;
}

export interface Activity {
  timestamp: Date;
  memberId: string;
  action: string;
  details: any;
}

export interface TeamInsights {
  _topContributors: { _member: TeamMember; contributions: number }[];
  _mostUsedPatterns: { pattern: any; usage: number }[];
  _knowledgeGrowth: { date: Date; totalKnowledge: number }[];
  _collaborationScore: number;
  _learningProgress: number;
}

export class TeamCollaborationAPI extends EventEmitter {
  private memoryEngine: DualMemoryEngine;
  private teamManager: TeamMemoryManager;
  private learningEngine: CrossSessionLearningEngine;
  private behaviorEngine: PersonalizedAIBehavior;
  private _sessions: Map<string, CollaborationSession> = new Map();

  constructor(
    private config: TeamCollaborationConfig = {
      enableRealTimeSync: true,
      enableCrossSessionLearning: true,
      enablePersonalization: true,
      syncInterval: 5000,
      maxTeamSize: 50,
      dataRetentionDays: 90,
    },
  ) {
    super();

    // Initialize engines
    this.memoryEngine = new DualMemoryEngine({
      system1: {
        maxKnowledgeNodes: 5000,
        embeddingDimension: 1536,
        cacheSize: 500,
        compressionThreshold: 0.75,
        accessDecayRate: 0.02,
      },
      system2: {
        maxReasoningTraces: 500,
        qualityThreshold: 0.75,
        reflectionFrequency: 12,
        enhancementEvaluationInterval: 6,
      },
      coordinator: {
        syncInterval: this.config.syncInterval,
        conflictResolutionStrategy: "balanced",
        learningRate: 0.2,
        adaptationThreshold: 0.8,
      },
      performance: {
        targetLatency: 30,
        maxMemoryUsage: 1024,
        cacheStrategy: "lru",
        preloadPriority: "high",
        backgroundOptimization: true,
      },
    });

    this.teamManager = new TeamMemoryManager({
      maxWorkspaces: 100,
      maxMembersPerWorkspace: this.config.maxTeamSize,
      defaultSyncInterval: this.config.syncInterval,
      conflictResolution: "merge",
    });

    this.learningEngine = new CrossSessionLearningEngine(this.memoryEngine, {
      persistencePath: ".maria/team-learning",
      autosaveInterval: 60000,
      maxSessionHistory: 1000,
      learningThreshold: 0.7,
      adaptationRate: 0.15,
    });

    this.behaviorEngine = new PersonalizedAIBehavior(
      this.memoryEngine,
      this.learningEngine,
      {
        adaptationSpeed: "moderate",
        personalizationLevel: "full",
        feedbackSensitivity: 0.8,
        contextAwareness: "high",
        proactivityLevel: 0.7,
      },
    );

    this.initialize();
  }

  private initialize(): void {
    // Set up event listeners
    this.teamManager.on(
      "_memory:shared",
      ({ _workspace, _member, _memory }) => {
        this.handleMemoryShared(_workspace, _member, _memory);
      },
    );

    this.teamManager.on("_member:joined", ({ _workspace, _member }) => {
      this.handleMemberJoined(_workspace, _member);
    });

    this.learningEngine.on("_session:ended", (_session) => {
      this.handleSessionEnded(_session);
    });
  }

  /**
   * Create a new team _workspace
   */
  async createTeamWorkspace(
    name: string,
    description: string,
    owner: TeamMember,
  ): Promise<TeamWorkspace> {
    const _workspace = await this.teamManager.createWorkspace(
      name,
      description,
      owner,
      {
        autoSync: this.config.enableRealTimeSync,
        syncInterval: this.config.syncInterval,
      },
    );

    this.emit("_workspace:created", _workspace);

    return _workspace;
  }

  /**
   * Join an existing _workspace
   */
  async joinWorkspace(
    _workspaceId: string,
    _member: TeamMember,
  ): Promise<void> {
    await this.teamManager.joinWorkspace(_workspaceId, _member);

    // Start learning _session for new _member
    if (this.config.enableCrossSessionLearning) {
      await this.learningEngine.startSession(member.id, {
        project: _workspaceId,
      });
    }

    this.emit("_member:joined", { _workspaceId, _member });
  }

  /**
   * Start a collaboration _session
   */
  async startCollaborationSession(
    workspaceId: string,
    members: TeamMember[],
  ): Promise<CollaborationSession> {
    const _session: CollaborationSession = {
      id: `collab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      workspaceId,
      members,
      startTime: new Date(),
      sharedMemories: [],
      activities: [],
    };

    this.sessions.set(_session.id, _session);

    // Start individual learning _sessions
    if (this.config.enableCrossSessionLearning) {
      for (const _member of members) {
        await this.learningEngine.startSession(_member.id, {
          project: workspaceId,
        });
      }
    }

    this.emit("collaboration:started", _session);

    return _session;
  }

  /**
   * Share _memory with team
   */
  async shareWithTeam(
    sessionId: string,
    memberId: string,
    _memory: {
      type: "code" | "bug" | "pattern" | "solution" | "knowledge";
      content: any;
      metadata?: any;
    },
  ): Promise<SharedMemory> {
    const _session = this.sessions.get(sessionId);
    if (!_session) {
      throw new Error("Session not found");
    }

    const _member = _session.members.find((m) => m.id === memberId);
    if (!_member) {
      throw new Error("Member not in _session");
    }

    // Share through team manager
    await this.teamManager.shareMemory(memberId, _session.workspaceId, {
      type:
        memory.type === "code" || memory.type === "solution"
          ? "knowledge"
          : "pattern",
      data: memory.content,
      metadata: memory.metadata,
    });

    // Create shared _memory record
    const sharedMemory: SharedMemory = {
      id: `shared_${Date.now()}`,
      type: memory.type,
      content: memory.content,
      sharedBy: _member,
      sharedAt: new Date(),
      accessCount: 0,
      ratings: [],
    };

    session.sharedMemories.push(sharedMemory);

    // Record activity
    this.recordActivity(_session, memberId, "shared_memory", {
      type: memory.type,
      size: JSON.stringify(memory.content).length,
    });

    // Learn from sharing pattern
    if (this.config.enableCrossSessionLearning) {
      await this.learningEngine.recordInteraction(_session.id, {
        timestamp: new Date(),
        type: "command",
        input: `share ${memory.type}`,
        output: "Memory shared with team",
        success: true,
        metadata: { _memory },
      });
    }

    this.emit("_memory:shared", { _session, _member, sharedMemory });

    return sharedMemory;
  }

  /**
   * Query team knowledge
   */
  async queryTeamKnowledge(
    sessionId: string,
    memberId: string,
    query: string,
    options?: {
      type?: "code" | "bug" | "pattern" | "solution" | "knowledge";
      limit?: number;
      includeRatings?: boolean;
    },
  ): Promise<any[]> {
    const _session = this.sessions.get(sessionId);
    if (!_session) {
      throw new Error("Session not found");
    }

    // Query from team manager
    const _results = await this.teamManager.queryTeamMemory(
      memberId,
      _session.workspaceId,
      {
        type:
          options?.type === "code" || options?.type === "solution"
            ? "knowledge"
            : "pattern",
        filter: query,
        limit: options?.limit || 10,
      },
    );

    // Apply personalization if enabled
    if (this.config.enablePersonalization) {
      const context: UserContext = {
        currentTask: query,
        activeProject: _session.workspaceId,
      };

      const _personalizedResponse =
        await this.behaviorEngine.generatePersonalizedResponse(
          memberId,
          query,
          context,
          JSON.stringify(_results),
        );

      // Return personalized _results
      return this.parsePersonalizedResults(_personalizedResponse.content);
    }

    // Record activity
    this.recordActivity(_session, memberId, "query", {
      query,
      resultCount: _results.length,
    });

    // Update access counts
    session.sharedMemories.forEach((_memory) => {
      if (
        _results.some((r) =>
          JSON.stringify(r).includes(JSON.stringify(_memory.content)),
        )
      ) {
        memory.accessCount++;
      }
    });

    return _results;
  }

  /**
   * Rate shared _memory
   */
  async rateSharedMemory(
    sessionId: string,
    memoryId: string,
    memberId: string,
    rating: number,
    comment?: string,
  ): Promise<void> {
    const _session = this.sessions.get(sessionId);
    if (!_session) {
      throw new Error("Session not found");
    }

    const _memory = _session.sharedMemories.find((m) => m.id === memoryId);
    if (!_memory) {
      throw new Error("Shared _memory not found");
    }

    // Add or update rating
    const _existingRating = _memory.ratings.find(
      (r) => r.memberId === memberId,
    );
    if (_existingRating) {
      _existingRating.score = rating;
      existingRating.comment = comment;
    } else {
      memory.ratings.push({ memberId, score: rating, comment });
    }

    // Process feedback for learning
    if (this.config.enablePersonalization) {
      await this.behaviorEngine.processFeedback(_memory.sharedBy.id, {
        responseId: memoryId,
        rating,
        helpful: rating >= 4,
        accurate: rating >= 3,
        suggestion: comment,
      });
    }

    // Record activity
    this.recordActivity(_session, memberId, "rated", {
      memoryId,
      rating,
    });

    this.emit("_memory:rated", { _session, _memory, rating });
  }

  /**
   * Get team insights
   */
  async getTeamInsights(workspaceId: string): Promise<TeamInsights> {
    const _statistics = this.teamManager.getWorkspaceStatistics(workspaceId);
    if (!_statistics) {
      throw new Error("Workspace not found");
    }

    // Get top contributors
    const _topContributors = Array.from(
      _statistics.contributionsByMember.entries(),
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([memberId, contributions]) => ({
        _member: { id: memberId } as TeamMember, // In production, fetch full _member data
        contributions,
      }));

    // Get most used patterns (simplified)
    const _sessions = Array.from(this._sessions.values()).filter(
      (s) => s.workspaceId === workspaceId,
    );

    const _patternUsage = new Map<string, number>();
    sessions.forEach((_session) => {
      session.sharedMemories
        .filter((m) => m.type === "pattern")
        .forEach((m) => {
          const _key = JSON.stringify(m.content).substring(0, 50);
          _patternUsage.set(
            _key,
            (_patternUsage.get(_key) || 0) + m.accessCount,
          );
        });
    });

    const _mostUsedPatterns = Array.from(_patternUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pattern, usage]) => ({ pattern, usage }));

    // Calculate knowledge growth (simplified)
    const _knowledgeGrowth = [
      {
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        totalKnowledge: _statistics.totalNodes * 0.7,
      },
      {
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        totalKnowledge: _statistics.totalNodes * 0.85,
      },
      { date: new Date(), totalKnowledge: _statistics.totalNodes },
    ];

    // Calculate collaboration score
    const _collaborationScore = this.calculateCollaborationScore(
      _statistics,
      _sessions,
    );

    // Get learning progress
    const _memberIds = Array.from(_statistics.contributionsByMember.keys());
    const _learningMetrics = _memberIds.map((id) =>
      this.learningEngine.getLearningMetrics(id),
    );
    const _learningProgress =
      learningMetrics.length > 0
        ? _learningMetrics.reduce((sum, m) => sum + m.improvementRate, 0) /
          _learningMetrics.length
        : 0;

    return {
      _topContributors,
      _mostUsedPatterns,
      _knowledgeGrowth,
      _collaborationScore,
      _learningProgress,
    };
  }

  /**
   * End collaboration _session
   */
  async endCollaborationSession(sessionId: string): Promise<void> {
    const _session = this.sessions.get(sessionId);
    if (!_session) {
      throw new Error("Session not found");
    }

    // End individual learning _sessions
    if (this.config.enableCrossSessionLearning) {
      for (const _member of _session.members) {
        // Find _member's learning _session
        // In production, track _session IDs properly
        await this.learningEngine.endSession(sessionId);
      }
    }

    // Calculate _session metrics
    const _duration = Date.now() - _session.startTime.getTime();
    const _sharedCount = _session.sharedMemories.length;
    const _avgRating = this.calculateAverageRating(_session.sharedMemories);

    // Store _session _summary
    await this.storeSessionSummary(_session, {
      _duration,
      _sharedCount,
      _avgRating,
    });

    this.sessions.delete(sessionId);

    this.emit("collaboration:ended", {
      _session,
      metrics: { _duration, _sharedCount, _avgRating },
    });
  }

  /**
   * Get personalized suggestions for team _member
   */
  async getPersonalizedSuggestions(
    memberId: string,
    workspaceId: string,
    context: unknown,
  ): Promise<string[]> {
    // Get suggestions from learning engine
    const _learningSuggestions =
      await this.learningEngine.getPersonalizedSuggestions(memberId, context);

    // Get team-based suggestions
    const _teamSuggestions = await this.getTeamBasedSuggestions(
      memberId,
      workspaceId,
    );

    // Combine and prioritize
    const _allSuggestions = [..._learningSuggestions, ..._teamSuggestions];

    // Remove duplicates and limit
    const _uniqueSuggestions = Array.from(new Set(_allSuggestions));

    return _uniqueSuggestions.slice(0, 5);
  }

  /**
   * Helper functions
   */
  private handleMemoryShared(
    _workspace: unknown,
    _member: unknown,
    _memory: unknown,
  ): void {
    // Broadcast to other team members
    this.emit("team:_memory:shared", { _workspace, _member, _memory });
  }

  private handleMemberJoined(_workspace: unknown, _member: unknown): void {
    // Initialize _member's personalization
    if (this.config.enablePersonalization) {
      // Member profile will be created on first interaction
    }
  }

  private handleSessionEnded(_session: SessionData): void {
    // Update team learning metrics
    if (_session.context?.project) {
      // In production, properly map _session to _workspace
    }
  }

  private recordActivity(
    _session: CollaborationSession,
    memberId: string,
    action: string,
    details: unknown,
  ): void {
    session.activities.push({
      timestamp: new Date(),
      memberId,
      action,
      details,
    });
  }

  private parsePersonalizedResults(content: string): any[] {
    try {
      // Try to parse as JSON array
      return JSON.parse(content);
    } catch {
      // Return as single result if not JSON
      return [{ content }];
    }
  }

  private calculateCollaborationScore(
    _statistics: unknown,
    _sessions: CollaborationSession[],
  ): number {
    // Factors for collaboration score
    const _factors = {
      contributions: Math.min(1, _statistics.sharedCount / 100),
      engagement: Math.min(1, _statistics.accessCount / 500),
      diversity: Math.min(1, _statistics.contributionsByMember.size / 10),
      activity: Math.min(1, _sessions.length / 20),
    };

    // Weighted average
    const _weights = {
      contributions: 0.3,
      engagement: 0.3,
      diversity: 0.2,
      activity: 0.2,
    };

    let score = 0;
    for (const [factor, value] of Object.entries(_factors)) {
      score += value * _weights[factor as keyof typeof _weights];
    }

    return Math.round(score * 100);
  }

  private calculateAverageRating(memories: SharedMemory[]): number {
    const _allRatings = memories.flatMap((m) => m.ratings.map((r) => r.score));

    if (_allRatings.length === 0) {
      return 0;
    }

    return (
      _allRatings.reduce((sum, rating) => sum + rating, 0) / _allRatings.length
    );
  }

  private async storeSessionSummary(
    _session: CollaborationSession,
    metrics: unknown,
  ): Promise<void> {
    const _summary = {
      sessionId: _session.id,
      workspaceId: _session.workspaceId,
      memberCount: _session.members.length,
      _duration: metrics.duration,
      _sharedCount: metrics.sharedCount,
      _avgRating: metrics.avgRating,
      topShared: _session.sharedMemories
        .sort((a, b) => b.accessCount - a.accessCount)
        .slice(0, 3)
        .map((m) => ({ type: m.type, accessCount: m.accessCount })),
    };

    // Store in _memory engine
    const _embedding = await this.generateEmbedding(JSON.stringify(_summary));

    await this.memoryEngine
      .getSystem1()
      .addKnowledgeNode(
        "session_summary",
        _session.id,
        JSON.stringify(_summary),
        _embedding,
        {
          workspaceId: _session.workspaceId,
          timestamp: new Date().toISOString(),
        },
      );
  }

  private async getTeamBasedSuggestions(
    _memberId: string,
    workspaceId: string,
  ): Promise<string[]> {
    const suggestions: string[] = [];

    // Get _workspace _statistics
    const _stats = this.teamManager.getWorkspaceStatistics(workspaceId);
    if (!_stats) {
      return suggestions;
    }

    // Suggest based on team activity
    if (_stats.totalPatterns > 10) {
      suggestions.push(
        "Team has identified useful patterns - check shared knowledge",
      );
    }

    if (_stats.sharedCount > 50) {
      suggestions.push(
        "Rich team knowledge available - try querying team _memory",
      );
    }

    const _contribution = this.teamManager.getMemberContribution(
      _memberId,
      workspaceId,
    );
    if (_contribution < 5) {
      suggestions.push(
        "Share your knowledge with the team to improve collaboration",
      );
    }

    return suggestions;
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    // Simplified _embedding - in production, use proper _embedding model
    const _hash = text
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return Array(100)
      .fill(0)
      .map((_, i) => Math.sin(_hash + i) * 0.5 + 0.5);
  }

  /**
   * Export _workspace data
   */
  async exportWorkspaceData(workspaceId: string): Promise<any> {
    const _workspaceData =
      await this.teamManager.exportWorkspaceMemory(workspaceId);

    // Add _session data
    const _sessions = Array.from(this._sessions.values())
      .filter((s) => s.workspaceId === workspaceId)
      .map((s) => ({
        id: s.id,
        startTime: s.startTime,
        memberCount: s.members.length,
        _sharedCount: s.sharedMemories.length,
        activityCount: s.activities.length,
      }));

    return {
      ..._workspaceData,
      _sessions,
      exportDate: new Date(),
    };
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.teamManager.stopSyncProcess();
    this.learningEngine.destroy();
  }
}
