/**
 * Team Collaboration API
 * 
 * High-level API for team memory sharing and collaboration features
 */

import { DualMemoryEngine } from '../dual-memory-engine';
import { TeamMemoryManager, TeamMember, TeamWorkspace } from './team-memory-manager';
import { CrossSessionLearningEngine, SessionData } from '../learning/cross-session-learning';
import { PersonalizedAIBehavior, PersonalizedResponse, UserContext } from '../learning/personalized-ai-behavior';
import { EventEmitter } from 'events';

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
  type: 'code' | 'bug' | 'pattern' | 'solution' | 'knowledge';
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
  topContributors: { member: TeamMember; contributions: number }[];
  mostUsedPatterns: { pattern: any; usage: number }[];
  knowledgeGrowth: { date: Date; totalKnowledge: number }[];
  collaborationScore: number;
  learningProgress: number;
}

export class TeamCollaborationAPI extends EventEmitter {
  private memoryEngine: DualMemoryEngine;
  private teamManager: TeamMemoryManager;
  private learningEngine: CrossSessionLearningEngine;
  private behaviorEngine: PersonalizedAIBehavior;
  private sessions: Map<string, CollaborationSession> = new Map();
  
  constructor(
    private config: TeamCollaborationConfig = {
      enableRealTimeSync: true,
      enableCrossSessionLearning: true,
      enablePersonalization: true,
      syncInterval: 5000,
      maxTeamSize: 50,
      dataRetentionDays: 90,
    }
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
        conflictResolutionStrategy: 'balanced',
        learningRate: 0.2,
        adaptationThreshold: 0.8,
      },
      performance: {
        targetLatency: 30,
        maxMemoryUsage: 1024,
        cacheStrategy: 'lru',
        preloadPriority: 'high',
        backgroundOptimization: true,
      },
    });
    
    this.teamManager = new TeamMemoryManager({
      maxWorkspaces: 100,
      maxMembersPerWorkspace: this.config.maxTeamSize,
      defaultSyncInterval: this.config.syncInterval,
      conflictResolution: 'merge',
    });
    
    this.learningEngine = new CrossSessionLearningEngine(this.memoryEngine, {
      persistencePath: '.maria/team-learning',
      autosaveInterval: 60000,
      maxSessionHistory: 1000,
      learningThreshold: 0.7,
      adaptationRate: 0.15,
    });
    
    this.behaviorEngine = new PersonalizedAIBehavior(
      this.memoryEngine,
      this.learningEngine,
      {
        adaptationSpeed: 'moderate',
        personalizationLevel: 'full',
        feedbackSensitivity: 0.8,
        contextAwareness: 'high',
        proactivityLevel: 0.7,
      }
    );
    
    this.initialize();
  }
  
  private initialize(): void {
    // Set up event listeners
    this.teamManager.on('memory:shared', ({ workspace, member, memory }) => {
      this.handleMemoryShared(workspace, member, memory);
    });
    
    this.teamManager.on('member:joined', ({ workspace, member }) => {
      this.handleMemberJoined(workspace, member);
    });
    
    this.learningEngine.on('session:ended', (session) => {
      this.handleSessionEnded(session);
    });
  }
  
  /**
   * Create a new team workspace
   */
  async createTeamWorkspace(
    name: string,
    description: string,
    owner: TeamMember
  ): Promise<TeamWorkspace> {
    const workspace = await this.teamManager.createWorkspace(
      name,
      description,
      owner,
      {
        autoSync: this.config.enableRealTimeSync,
        syncInterval: this.config.syncInterval,
      }
    );
    
    this.emit('workspace:created', workspace);
    
    return workspace;
  }
  
  /**
   * Join an existing workspace
   */
  async joinWorkspace(
    workspaceId: string,
    member: TeamMember
  ): Promise<void> {
    await this.teamManager.joinWorkspace(workspaceId, member);
    
    // Start learning session for new member
    if (this.config.enableCrossSessionLearning) {
      await this.learningEngine.startSession(member.id, {
        project: workspaceId,
      });
    }
    
    this.emit('member:joined', { workspaceId, member });
  }
  
  /**
   * Start a collaboration session
   */
  async startCollaborationSession(
    workspaceId: string,
    members: TeamMember[]
  ): Promise<CollaborationSession> {
    const session: CollaborationSession = {
      id: `collab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      workspaceId,
      members,
      startTime: new Date(),
      sharedMemories: [],
      activities: [],
    };
    
    this.sessions.set(session.id, session);
    
    // Start individual learning sessions
    if (this.config.enableCrossSessionLearning) {
      for (const member of members) {
        await this.learningEngine.startSession(member.id, {
          project: workspaceId,
        });
      }
    }
    
    this.emit('collaboration:started', session);
    
    return session;
  }
  
  /**
   * Share memory with team
   */
  async shareWithTeam(
    sessionId: string,
    memberId: string,
    memory: {
      type: 'code' | 'bug' | 'pattern' | 'solution' | 'knowledge';
      content: any;
      metadata?: any;
    }
  ): Promise<SharedMemory> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    const member = session.members.find(m => m.id === memberId);
    if (!member) {
      throw new Error('Member not in session');
    }
    
    // Share through team manager
    await this.teamManager.shareMemory(memberId, session.workspaceId, {
      type: memory.type === 'code' || memory.type === 'solution' ? 'knowledge' : 'pattern',
      data: memory.content,
      metadata: memory.metadata,
    });
    
    // Create shared memory record
    const sharedMemory: SharedMemory = {
      id: `shared_${Date.now()}`,
      type: memory.type,
      content: memory.content,
      sharedBy: member,
      sharedAt: new Date(),
      accessCount: 0,
      ratings: [],
    };
    
    session.sharedMemories.push(sharedMemory);
    
    // Record activity
    this.recordActivity(session, memberId, 'shared_memory', {
      type: memory.type,
      size: JSON.stringify(memory.content).length,
    });
    
    // Learn from sharing pattern
    if (this.config.enableCrossSessionLearning) {
      await this.learningEngine.recordInteraction(session.id, {
        timestamp: new Date(),
        type: 'command',
        input: `share ${memory.type}`,
        output: 'Memory shared with team',
        success: true,
        metadata: { memory },
      });
    }
    
    this.emit('memory:shared', { session, member, sharedMemory });
    
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
      type?: 'code' | 'bug' | 'pattern' | 'solution' | 'knowledge';
      limit?: number;
      includeRatings?: boolean;
    }
  ): Promise<any[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    // Query from team manager
    const results = await this.teamManager.queryTeamMemory(
      memberId,
      session.workspaceId,
      {
        type: options?.type === 'code' || options?.type === 'solution' ? 'knowledge' : 'pattern',
        filter: query,
        limit: options?.limit || 10,
      }
    );
    
    // Apply personalization if enabled
    if (this.config.enablePersonalization) {
      const context: UserContext = {
        currentTask: query,
        activeProject: session.workspaceId,
      };
      
      const personalizedResponse = await this.behaviorEngine.generatePersonalizedResponse(
        memberId,
        query,
        context,
        JSON.stringify(results)
      );
      
      // Return personalized results
      return this.parsePersonalizedResults(personalizedResponse.content);
    }
    
    // Record activity
    this.recordActivity(session, memberId, 'query', {
      query,
      resultCount: results.length,
    });
    
    // Update access counts
    session.sharedMemories.forEach(memory => {
      if (results.some(r => JSON.stringify(r).includes(JSON.stringify(memory.content)))) {
        memory.accessCount++;
      }
    });
    
    return results;
  }
  
  /**
   * Rate shared memory
   */
  async rateSharedMemory(
    sessionId: string,
    memoryId: string,
    memberId: string,
    rating: number,
    comment?: string
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    const memory = session.sharedMemories.find(m => m.id === memoryId);
    if (!memory) {
      throw new Error('Shared memory not found');
    }
    
    // Add or update rating
    const existingRating = memory.ratings.find(r => r.memberId === memberId);
    if (existingRating) {
      existingRating.score = rating;
      existingRating.comment = comment;
    } else {
      memory.ratings.push({ memberId, score: rating, comment });
    }
    
    // Process feedback for learning
    if (this.config.enablePersonalization) {
      await this.behaviorEngine.processFeedback(memory.sharedBy.id, {
        responseId: memoryId,
        rating,
        helpful: rating >= 4,
        accurate: rating >= 3,
        suggestion: comment,
      });
    }
    
    // Record activity
    this.recordActivity(session, memberId, 'rated', {
      memoryId,
      rating,
    });
    
    this.emit('memory:rated', { session, memory, rating });
  }
  
  /**
   * Get team insights
   */
  async getTeamInsights(workspaceId: string): Promise<TeamInsights> {
    const statistics = this.teamManager.getWorkspaceStatistics(workspaceId);
    if (!statistics) {
      throw new Error('Workspace not found');
    }
    
    // Get top contributors
    const topContributors = Array.from(statistics.contributionsByMember.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([memberId, contributions]) => ({
        member: { id: memberId } as TeamMember, // In production, fetch full member data
        contributions,
      }));
    
    // Get most used patterns (simplified)
    const sessions = Array.from(this.sessions.values())
      .filter(s => s.workspaceId === workspaceId);
    
    const patternUsage = new Map<string, number>();
    sessions.forEach(session => {
      session.sharedMemories
        .filter(m => m.type === 'pattern')
        .forEach(m => {
          const key = JSON.stringify(m.content).substring(0, 50);
          patternUsage.set(key, (patternUsage.get(key) || 0) + m.accessCount);
        });
    });
    
    const mostUsedPatterns = Array.from(patternUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pattern, usage]) => ({ pattern, usage }));
    
    // Calculate knowledge growth (simplified)
    const knowledgeGrowth = [
      { date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), totalKnowledge: statistics.totalNodes * 0.7 },
      { date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), totalKnowledge: statistics.totalNodes * 0.85 },
      { date: new Date(), totalKnowledge: statistics.totalNodes },
    ];
    
    // Calculate collaboration score
    const collaborationScore = this.calculateCollaborationScore(statistics, sessions);
    
    // Get learning progress
    const memberIds = Array.from(statistics.contributionsByMember.keys());
    const learningMetrics = memberIds.map(id => 
      this.learningEngine.getLearningMetrics(id)
    );
    const learningProgress = learningMetrics.length > 0
      ? learningMetrics.reduce((sum, m) => sum + m.improvementRate, 0) / learningMetrics.length
      : 0;
    
    return {
      topContributors,
      mostUsedPatterns,
      knowledgeGrowth,
      collaborationScore,
      learningProgress,
    };
  }
  
  /**
   * End collaboration session
   */
  async endCollaborationSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    // End individual learning sessions
    if (this.config.enableCrossSessionLearning) {
      for (const member of session.members) {
        // Find member's learning session
        // In production, track session IDs properly
        await this.learningEngine.endSession(sessionId);
      }
    }
    
    // Calculate session metrics
    const duration = Date.now() - session.startTime.getTime();
    const sharedCount = session.sharedMemories.length;
    const avgRating = this.calculateAverageRating(session.sharedMemories);
    
    // Store session summary
    await this.storeSessionSummary(session, {
      duration,
      sharedCount,
      avgRating,
    });
    
    this.sessions.delete(sessionId);
    
    this.emit('collaboration:ended', { session, metrics: { duration, sharedCount, avgRating } });
  }
  
  /**
   * Get personalized suggestions for team member
   */
  async getPersonalizedSuggestions(
    memberId: string,
    workspaceId: string,
    context: any
  ): Promise<string[]> {
    // Get suggestions from learning engine
    const learningSuggestions = await this.learningEngine.getPersonalizedSuggestions(
      memberId,
      context
    );
    
    // Get team-based suggestions
    const teamSuggestions = await this.getTeamBasedSuggestions(memberId, workspaceId);
    
    // Combine and prioritize
    const allSuggestions = [...learningSuggestions, ...teamSuggestions];
    
    // Remove duplicates and limit
    const uniqueSuggestions = Array.from(new Set(allSuggestions));
    
    return uniqueSuggestions.slice(0, 5);
  }
  
  /**
   * Helper functions
   */
  private handleMemoryShared(workspace: any, member: any, memory: any): void {
    // Broadcast to other team members
    this.emit('team:memory:shared', { workspace, member, memory });
  }
  
  private handleMemberJoined(workspace: any, member: any): void {
    // Initialize member's personalization
    if (this.config.enablePersonalization) {
      // Member profile will be created on first interaction
    }
  }
  
  private handleSessionEnded(session: SessionData): void {
    // Update team learning metrics
    if (session.context?.project) {
      // In production, properly map session to workspace
    }
  }
  
  private recordActivity(
    session: CollaborationSession,
    memberId: string,
    action: string,
    details: any
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
  
  private calculateCollaborationScore(statistics: any, sessions: CollaborationSession[]): number {
    // Factors for collaboration score
    const factors = {
      contributions: Math.min(1, statistics.sharedCount / 100),
      engagement: Math.min(1, statistics.accessCount / 500),
      diversity: Math.min(1, statistics.contributionsByMember.size / 10),
      activity: Math.min(1, sessions.length / 20),
    };
    
    // Weighted average
    const weights = { contributions: 0.3, engagement: 0.3, diversity: 0.2, activity: 0.2 };
    
    let score = 0;
    for (const [factor, value] of Object.entries(factors)) {
      score += value * weights[factor as keyof typeof weights];
    }
    
    return Math.round(score * 100);
  }
  
  private calculateAverageRating(memories: SharedMemory[]): number {
    const allRatings = memories.flatMap(m => m.ratings.map(r => r.score));
    
    if (allRatings.length === 0) return 0;
    
    return allRatings.reduce((sum, rating) => sum + rating, 0) / allRatings.length;
  }
  
  private async storeSessionSummary(
    session: CollaborationSession,
    metrics: any
  ): Promise<void> {
    const summary = {
      sessionId: session.id,
      workspaceId: session.workspaceId,
      memberCount: session.members.length,
      duration: metrics.duration,
      sharedCount: metrics.sharedCount,
      avgRating: metrics.avgRating,
      topShared: session.sharedMemories
        .sort((a, b) => b.accessCount - a.accessCount)
        .slice(0, 3)
        .map(m => ({ type: m.type, accessCount: m.accessCount })),
    };
    
    // Store in memory engine
    const embedding = await this.generateEmbedding(JSON.stringify(summary));
    
    await this.memoryEngine.getSystem1().addKnowledgeNode(
      'session_summary',
      session.id,
      JSON.stringify(summary),
      embedding,
      {
        workspaceId: session.workspaceId,
        timestamp: new Date().toISOString(),
      }
    );
  }
  
  private async getTeamBasedSuggestions(
    memberId: string,
    workspaceId: string
  ): Promise<string[]> {
    const suggestions: string[] = [];
    
    // Get workspace statistics
    const stats = this.teamManager.getWorkspaceStatistics(workspaceId);
    if (!stats) return suggestions;
    
    // Suggest based on team activity
    if (stats.totalPatterns > 10) {
      suggestions.push('Team has identified useful patterns - check shared knowledge');
    }
    
    if (stats.sharedCount > 50) {
      suggestions.push('Rich team knowledge available - try querying team memory');
    }
    
    const contribution = this.teamManager.getMemberContribution(memberId, workspaceId);
    if (contribution < 5) {
      suggestions.push('Share your knowledge with the team to improve collaboration');
    }
    
    return suggestions;
  }
  
  private async generateEmbedding(text: string): Promise<number[]> {
    // Simplified embedding - in production, use proper embedding model
    const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return Array(100).fill(0).map((_, i) => Math.sin(hash + i) * 0.5 + 0.5);
  }
  
  /**
   * Export workspace data
   */
  async exportWorkspaceData(workspaceId: string): Promise<any> {
    const workspaceData = await this.teamManager.exportWorkspaceMemory(workspaceId);
    
    // Add session data
    const sessions = Array.from(this.sessions.values())
      .filter(s => s.workspaceId === workspaceId)
      .map(s => ({
        id: s.id,
        startTime: s.startTime,
        memberCount: s.members.length,
        sharedCount: s.sharedMemories.length,
        activityCount: s.activities.length,
      }));
    
    return {
      ...workspaceData,
      sessions,
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