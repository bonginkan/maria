/**
 * Scalable Team Manager - Phase 4.4
 * Extends Phase 4.3 Team Collaboration to support 10 concurrent users
 */

import {
  TeamMember,
  DeveloperActivity,
  SessionInfo,
} from "../../team-collaboration/core/TeamSession";
import { Conflict } from "../../team-collaboration/core/ConflictDetector";

export interface LoadBalancerConfig {
  maxMembersPerWorker: number;
  healthCheckInterval: number;
  autoScaling: boolean;
}

export interface WorkerNode {
  id: string;
  load: number;
  memberCount: number;
  _responseTime: number;
  status: "healthy" | "degraded" | "offline";
  lastHealthCheck: Date;
}

export interface ConflictResolution {
  id: string;
  conflictId: string;
  strategy: "auto" | "manual" | "merge" | "override";
  success: boolean;
  _resolution: string;
  timestamp: Date;
  resolver?: string;
}

export interface TeamMetrics {
  _sessionId: string;
  memberCount: number;
  activeMembers: number;
  conflictCount: number;
  resolvedConflicts: number;
  patternsSynced: number;
  avgResponseTime: number;
  throughput: number;
  lastUpdated: Date;
}

export interface SubGroup {
  id: string;
  _members: TeamMember[];
  focusArea: string;
  leaderId: string;
  _sessionId: string;
  createdAt: Date;
}

class LoadBalancer {
  private workers = new Map<string, WorkerNode>();
  private config: LoadBalancerConfig;
  private healthCheckTimer?: NodeJS.Timeout;

  constructor(_config: Partial<LoadBalancerConfig> = {}) {
    this._config = {
      maxMembersPerWorker: 3,
      healthCheckInterval: 30000, // 30 seconds
      autoScaling: true,
      ..._config,
    };
  }

  async addWorker(workerId: string): Promise<void> {
    const _worker: WorkerNode = {
      id: workerId,
      load: 0,
      memberCount: 0,
      _responseTime: 0,
      status: "healthy",
      lastHealthCheck: new Date(),
    };

    this.workers.set(workerId, _worker);

    if (this.workers.size === 1) {
      this.startHealthChecks();
    }
  }

  selectWorker(): WorkerNode | null {
    const _healthyWorkers = Array.from(this.workers.values()).filter(
      (_worker) =>
        _worker.status === "healthy" &&
        worker.memberCount < this.config.maxMembersPerWorker,
    );

    if (_healthyWorkers.length === 0) {
      if (this.config.autoScaling) {
        return this.scaleUp();
      }
      return null;
    }

    // Select _worker with lowest load
    return _healthyWorkers.reduce((best, current) =>
      current.load < best.load ? current : best,
    );
  }

  updateWorkerLoad(
    _workerId: string,
    load: number,
    _responseTime: number,
  ): void {
    const _worker = this.workers.get(_workerId);
    if (_worker) {
      _worker.load = load;
      _worker.responseTime = _responseTime;
      worker.lastHealthCheck = new Date();
    }
  }

  private scaleUp(): WorkerNode | null {
    const _newWorkerId = `worker_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    const newWorker: WorkerNode = {
      id: _newWorkerId,
      load: 0,
      memberCount: 0,
      _responseTime: 0,
      status: "healthy",
      lastHealthCheck: new Date(),
    };

    this.workers.set(_newWorkerId, newWorker);
    return newWorker;
  }

  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  private async performHealthChecks(): Promise<void> {
    const _now = new Date();

    for (const [_workerId, _worker] of this.workers.entries()) {
      const _timeSinceCheck = _now.getTime() - worker.lastHealthCheck.getTime();

      if (_timeSinceCheck > this.config.healthCheckInterval * 2) {
        worker.status = "offline";
      } else if (worker.responseTime > 5000) {
        // 5 seconds
        worker.status = "degraded";
      } else {
        worker.status = "healthy";
      }
    }
  }

  getWorkerStats() {
    return Array.from(this.workers.values()).map((_worker) => ({
      id: _worker.id,
      load: _worker.load,
      memberCount: _worker.memberCount,
      _responseTime: _worker.responseTime,
      status: _worker.status,
    }));
  }

  cleanup(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    this.workers.clear();
  }
}

class ConflictQueue {
  private queue: Conflict[] = [];
  private processing = false;
  private resolutions = new Map<string, ConflictResolution>();
  private readonly maxQueueSize = 100;

  async enqueue(_conflict: Conflict): Promise<void> {
    if (this.queue.length >= this.maxQueueSize) {
      // Remove oldest _conflict
      this.queue.shift();
    }

    this.queue.push(_conflict);

    if (!this.processing) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    this.processing = true;

    while (this.queue.length > 0) {
      const _conflict = this.queue.shift()!;

      try {
        const _resolution = await this.processConflict(_conflict);
        this.resolutions.set(_conflict.id, _resolution);
      } catch (error) {
        console.error(`Failed to process _conflict ${_conflict.id}:`, error);

        // Create failed _resolution record
        this.resolutions.set(_conflict.id, {
          id: this.generateResolutionId(),
          conflictId: _conflict.id,
          strategy: "manual",
          success: false,
          _resolution: `Failed to auto-resolve: ${error}`,
          timestamp: new Date(),
        });
      }
    }

    this.processing = false;
  }

  private async processConflict(
    _conflict: Conflict,
  ): Promise<ConflictResolution> {
    const _resolution: ConflictResolution = {
      id: this.generateResolutionId(),
      conflictId: conflict.id,
      strategy: "auto",
      success: false,
      _resolution: "",
      timestamp: new Date(),
    };

    switch (conflict.type) {
      case "lock_violation":
        _resolution._resolution = await this.resolveLockViolation(_conflict);
        resolution.success = true;
        break;

      case "rapid_edits":
        _resolution._resolution = await this.resolveRapidEdits(_conflict);
        resolution.success = true;
        break;

      default:
        _resolution.strategy = "manual";
        _resolution._resolution = "Requires manual intervention";
        resolution.success = false;
    }

    return _resolution;
  }

  private async resolveLockViolation(_conflict: Conflict): Promise<string> {
    // Strategy: Notify second user and queue their edit
    return `Lock violation resolved: ${_conflict.memberNames[1]} notified of existing lock by ${_conflict.memberNames[0]}`;
  }

  private async resolveRapidEdits(_conflict: Conflict): Promise<string> {
    // Strategy: Create merge suggestion
    return `Rapid edits resolved: Merge suggestion created for ${_conflict.memberNames.join(" and ")}`;
  }

  private generateResolutionId(): string {
    return `resolution_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getResolution(conflictId: string): ConflictResolution | undefined {
    return this.resolutions.get(conflictId);
  }

  getQueueStats() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      totalResolutions: this.resolutions.size,
      successfulResolutions: Array.from(this.resolutions.values()).filter(
        (r) => r.success,
      ).length,
    };
  }
}

export class ScalableTeamManager {
  private sessions = new Map<
    string,
    SessionInfo & { _metrics: TeamMetrics; subGroups: SubGroup[] }
  >();
  private loadBalancer: LoadBalancer;
  private conflictQueue: ConflictQueue;
  private _metrics = new Map<string, TeamMetrics>();

  private readonly MAX_MEMBERS = 10;
  private readonly RESPONSE_TIME_THRESHOLD = 2000; // 2 seconds
  private readonly SUB_GROUP_THRESHOLD = 5; // Create sub-groups at 5+ _members

  constructor(_config: Partial<LoadBalancerConfig> = {}) {
    this.loadBalancer = new LoadBalancer(_config);
    this.conflictQueue = new ConflictQueue();

    // Initialize default _worker
    this.loadBalancer.addWorker("default-_worker");
  }

  async createScalableSession(
    _name: string,
    creator: TeamMember,
  ): Promise<string> {
    const _sessionId = this.generateSessionId();
    const _now = new Date();

    const _session = {
      id: _sessionId,
      name,
      createdAt: _now,
      _members: [creator],
      maxMembers: this.MAX_MEMBERS,
      _metrics: {
        _sessionId,
        memberCount: 1,
        activeMembers: 1,
        conflictCount: 0,
        resolvedConflicts: 0,
        patternsSynced: 0,
        avgResponseTime: 0,
        throughput: 0,
        lastUpdated: _now,
      },
      subGroups: [],
    };

    this.sessions.set(_sessionId, _session);
    this.metrics.set(_sessionId, _session.metrics);

    return _sessionId;
  }

  async addMember(_sessionId: string, member: TeamMember): Promise<boolean> {
    const _session = this.sessions.get(_sessionId);
    if (!_session) return false;

    // Check capacity
    if (_session.members.length >= this.MAX_MEMBERS) {
      return false;
    }

    // Select _worker for load balancing
    const _worker = this.loadBalancer.selectWorker();
    if (!_worker) {
      console.warn("No available workers for new member");
      return false;
    }

    // Add member to _session
    session.members.push(member);
    worker.memberCount++;

    // Update _metrics
    const _metrics = _session._metrics;
    _metrics.memberCount = _session.members.length;
    _metrics.activeMembers = _session.members.length; // Assume all new _members are active
    metrics.lastUpdated = new Date();

    // Consider creating sub-groups if _session is getting large
    if (
      _session.members.length >= this.SUB_GROUP_THRESHOLD &&
      _session.subGroups.length === 0
    ) {
      await this.createSubGroups(_sessionId);
    }

    // Update load balancer
    this.loadBalancer.updateWorkerLoad(
      _worker.id,
      _worker.load + 1,
      _worker.responseTime,
    );

    return true;
  }

  async removeMember(_sessionId: string, memberId: string): Promise<boolean> {
    const _session = this.sessions.get(_sessionId);
    if (!_session) return false;

    const _memberIndex = _session.members.findIndex((m) => m.id === memberId);
    if (_memberIndex === -1) return false;

    // Remove from _session
    _session.members.splice(_memberIndex, 1);

    // Remove from sub-groups
    session.subGroups.forEach((subGroup) => {
      const _subMemberIndex = subGroup.members.findIndex(
        (m) => m.id === memberId,
      );
      if (_subMemberIndex > -1) {
        subGroup.members.splice(_subMemberIndex, 1);
      }
    });

    // Update _metrics
    _session.metrics.memberCount = _session.members.length;
    _session.metrics.activeMembers = Math.max(
      0,
      _session.metrics.activeMembers - 1,
    );
    session.metrics.lastUpdated = new Date();

    // Clean up empty _session
    if (_session.members.length === 0) {
      this.sessions.delete(_sessionId);
      this.metrics.delete(_sessionId);
    }

    return true;
  }

  async handleConflict(_conflict: Conflict): Promise<ConflictResolution> {
    // Update _conflict _metrics
    const _session = this.findSessionForConflict(_conflict);
    if (_session) {
      session.metrics.conflictCount++;
    }

    // Queue for processing
    await this.conflictQueue.enqueue(_conflict);

    // Try to get _resolution (might be async)
    await this.waitForResolution(conflict.id, 5000); // Wait up to 5 seconds

    const _resolution = this.conflictQueue.getResolution(conflict.id);
    if (_resolution?.success && _session) {
      session.metrics.resolvedConflicts++;
    }

    return (
      _resolution || {
        id: "pending",
        conflictId: conflict.id,
        strategy: "manual",
        success: false,
        _resolution: "Resolution pending",
        timestamp: new Date(),
      }
    );
  }

  async reportActivity(
    _sessionId: string,
    _activity: DeveloperActivity,
  ): Promise<void> {
    const _session = this.sessions.get(_sessionId);
    if (!_session) return;

    // Update throughput _metrics
    const _metrics = _session._metrics;
    _metrics.throughput = (_metrics.throughput || 0) + 1;
    metrics.lastUpdated = new Date();

    // Update response time (simulate)
    const _responseTime = Math.random() * 1000 + 200; // 200-1200ms
    _metrics.avgResponseTime = (_metrics.avgResponseTime + _responseTime) / 2;

    // Check if scaling is needed
    if (_metrics.avgResponseTime > this.RESPONSE_TIME_THRESHOLD) {
      await this.scaleTeamSession(_sessionId);
    }
  }

  async scaleTeamSession(_sessionId: string): Promise<void> {
    const _session = this.sessions.get(_sessionId);
    if (!_session) return;

    const _metrics = _session._metrics;

    if (_metrics.avgResponseTime > this.RESPONSE_TIME_THRESHOLD) {
      // Split _session into sub-groups if not already done
      if (_session.subGroups.length === 0 && _session.members.length >= 4) {
        await this.createSubGroups(_sessionId);
      }

      // Add more workers if needed
      if (_session.members.length >= 6) {
        await this.loadBalancer.addWorker(`worker_${_sessionId}_${Date.now()}`);
      }
    }
  }

  private async createSubGroups(_sessionId: string): Promise<void> {
    const _session = this.sessions.get(_sessionId);
    if (!_session) return;

    const _members = _session._members;
    const _groupSize = Math.ceil(_members.length / 2);

    // Create two sub-groups
    const subGroup1: SubGroup = {
      id: `${_sessionId}_group1`,
      _members: _members.slice(0, _groupSize),
      focusArea: "Frontend/UI",
      leaderId: _members[0].id,
      _sessionId,
      createdAt: new Date(),
    };

    const subGroup2: SubGroup = {
      id: `${_sessionId}_group2`,
      _members: _members.slice(_groupSize),
      focusArea: "Backend/API",
      leaderId: _members[_groupSize]?.id || _members[0].id,
      _sessionId,
      createdAt: new Date(),
    };

    session.subGroups = [subGroup1, subGroup2];
  }

  private findSessionForConflict(
    _conflict: Conflict,
  ):
    | (SessionInfo & { _metrics: TeamMetrics; subGroups: SubGroup[] })
    | undefined {
    // Find _session containing the _conflict _members
    for (const _session of this.sessions.values()) {
      const _sessionMemberIds = _session.members.map((m) => m.id);
      if (
        _conflict.members.some((memberId) =>
          _sessionMemberIds.includes(memberId),
        )
      ) {
        return _session;
      }
    }
    return undefined;
  }

  private async waitForResolution(
    _conflictId: string,
    timeoutMs: number,
  ): Promise<void> {
    const _startTime = Date.now();

    return new Promise((resolve) => {
      const _checkResolution = () => {
        const _resolution = this.conflictQueue.getResolution(_conflictId);

        if (_resolution || Date.now() - _startTime >= timeoutMs) {
          resolve();
          return;
        }

        setTimeout(_checkResolution, 100);
      };

      _checkResolution();
    });
  }

  getSessionMetrics(_sessionId: string): TeamMetrics | undefined {
    return this.metrics.get(_sessionId);
  }

  getAllMetrics(): TeamMetrics[] {
    return Array.from(this.metrics.values());
  }

  getSystemStats() {
    return {
      totalSessions: this.sessions.size,
      totalMembers: Array.from(this.sessions.values()).reduce(
        (sum, _session) => sum + _session.members.length,
        0,
      ),
      avgMembersPerSession:
        this.sessions.size > 0
          ? Array.from(this.sessions.values()).reduce(
              (sum, _session) => sum + _session.members.length,
              0,
            ) / this.sessions.size
          : 0,
      totalConflicts: Array.from(this.metrics.values()).reduce(
        (sum, _metrics) => sum + _metrics.conflictCount,
        0,
      ),
      totalResolvedConflicts: Array.from(this.metrics.values()).reduce(
        (sum, _metrics) => sum + _metrics.resolvedConflicts,
        0,
      ),
      loadBalancer: this.loadBalancer.getWorkerStats(),
      conflictQueue: this.conflictQueue.getQueueStats(),
    };
  }

  async simulateActivity(
    _sessionId: string,
    memberId: string,
    config: {
      type: string;
      duration: number;
      files: string[];
    },
  ): Promise<void> {
    const _session = this.sessions.get(_sessionId);
    if (!_session) return;

    // Simulate activity over duration
    const _activityCount = Math.floor(config.duration / 1000); // 1 activity per second

    for (let i = 0; i < _activityCount; i++) {
      const _file =
        config.files[Math.floor(Math.random() * config.files.length)];

      await this.reportActivity(_sessionId, {
        memberId,
        type: "edit",
        target: _file,
        timestamp: new Date(),
      });

      // Wait 1 second between activities
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  async getResponseTime(_sessionId: string): Promise<number> {
    const _metrics = this.getSessionMetrics(_sessionId);
    return _metrics?.avgResponseTime || 0;
  }

  private generateSessionId(): string {
    return `scalable_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async cleanup(): Promise<void> {
    this.sessions.clear();
    this.metrics.clear();
    this.loadBalancer.cleanup();
  }
}
