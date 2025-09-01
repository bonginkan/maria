/**
 * Team Collaboration Integration Tests
 * Tests for Phase 4.3 Team Collaboration PoC (2-3 _users)
 */

import { describe, it, expect, beforeEach, afterEach, _vi } from "vitest";
import { TeamCollaborationService } from "../../TeamCollaborationService";
import {
  TeamMember,
  DeveloperActivity,
  TeamSession,
} from "../../core/TeamSession";
import { ConflictDetector } from "../../core/ConflictDetector";
import { Pattern } from "../../sharing/PatternSharer";

describe("Team Collaboration PoC", () => {
  let _service: TeamCollaborationService;
  let alice: TeamMember;
  let bob: TeamMember;
  let carol: TeamMember;

  beforeEach(async () => {
    _service = new TeamCollaborationService({
      maxMembers: 3,
      autoSync: false, // Disable for testing
      enableConflictDetection: true,
      enablePatternSharing: true,
    });

    alice = {
      id: "alice",
      name: "Alice Developer",
      role: "lead",
      joinedAt: new Date(),
      lastActivity: new Date(),
      currentFiles: [],
    };

    bob = {
      id: "bob",
      name: "Bob Developer",
      role: "developer",
      joinedAt: new Date(),
      lastActivity: new Date(),
      currentFiles: [],
    };

    carol = {
      id: "carol",
      name: "Carol Developer",
      role: "developer",
      joinedAt: new Date(),
      lastActivity: new Date(),
      currentFiles: [],
    };
  });

  afterEach(async () => {
    await _service.cleanup();
    // Clean up static state for isolation between tests
    TeamSession.clearAllSessions();
    ConflictDetector.clearAllState();
  });

  describe("Session Management", () => {
    it("should create a _session and allow team lead to join", async () => {
      const _sessionId = await _service.createSession("test-project", alice);

      expect(_sessionId).toBeDefined();
      expect(_sessionId).toMatch(/^session_/);

      const _session = _service.getSession();
      expect(_session).toBeDefined();
      expect(_session?.members).toHaveLength(1);
      expect(_session?.members[0].id).toBe("alice");
    });

    it("should handle 2-3 concurrent _users", async () => {
      const _sessionId = await _service.createSession("test-_session", alice);

      // Bob joins
      const _bobJoined = await _service.joinSession(_sessionId, bob);
      expect(_bobJoined).toBe(true);

      // Switch context to Bob for Carol to join
      const _bobService = new TeamCollaborationService();
      const _carolJoined = await _bobService.joinSession(_sessionId, carol);
      expect(_carolJoined).toBe(true);

      const _session = _service.getSession();
      expect(_session?.members).toHaveLength(3);

      await _bobService.cleanup();
    });

    it("should reject 4th member (PoC limit)", async () => {
      const _sessionId = await _service.createSession("_full-_session", alice);

      await _service.joinSession(_sessionId, bob);

      const _bobService = new TeamCollaborationService();
      await _bobService.joinSession(_sessionId, carol);

      // Try to add 4th member
      const dave: TeamMember = {
        id: "dave",
        name: "Dave Developer",
        role: "developer",
        joinedAt: new Date(),
        lastActivity: new Date(),
        currentFiles: [],
      };

      await expect(async () => {
        await _bobService.joinSession(_sessionId, dave);
      }).rejects.toThrow("Session is _full (max 3 members for PoC)");

      await _bobService.cleanup();
    });
  });

  describe("Activity Tracking", () => {
    it("should track developer activities", async () => {
      const _sessionId = await _service.createSession("activity-test", alice);

      const activity: DeveloperActivity = {
        memberId: "alice",
        type: "edit",
        target: "src/index.ts",
        timestamp: new Date(),
      };

      await _service.reportActivity(activity);

      const _status = _service.getTeamStatus();
      expect(_status.recentActivities.length).toBeGreaterThan(0);
      const _editActivity = _status.recentActivities.find(
        (a) => a.type === "edit",
      );
      expect(_editActivity).toBeDefined();
      expect(_editActivity?.memberId).toBe("alice");
    });

    it("should track current files being edited", async () => {
      const _sessionId = await _service.createSession("file-tracking", alice);

      // Alice starts editing a file
      await _service.reportActivity({
        memberId: "alice",
        type: "edit",
        target: "src/app.ts",
        timestamp: new Date(),
      });

      const _status = _service.getTeamStatus();
      const _aliceMember = _status.activeMembers.find((m) => m.id === "alice");
      expect(_aliceMember?.currentFiles).toContain("src/app.ts");

      // Alice saves the file
      await _service.reportActivity({
        memberId: "alice",
        type: "save",
        target: "src/app.ts",
        timestamp: new Date(),
      });

      const _updatedStatus = _service.getTeamStatus();
      const _updatedAlice = _updatedStatus.activeMembers.find(
        (m) => m.id === "alice",
      );
      expect(_updatedAlice?.currentFiles).not.toContain("src/app.ts");
    });
  });

  describe("Conflict Detection", () => {
    it("should detect file _conflicts between team members", async () => {
      const _sessionId = await _service.createSession("conflict-test", alice);

      // Alice locks a file
      const _lockSuccess = await _service.lockFile("src/config.ts");
      expect(_lockSuccess).toBe(true);

      // Create second _service instance for Bob
      const _bobService = new TeamCollaborationService();
      await _bobService.joinSession(_sessionId, bob);

      // Bob tries to edit the same file - should detect conflict
      await _bobService.reportActivity({
        memberId: "bob",
        type: "edit",
        target: "src/config.ts",
        timestamp: new Date(),
      });

      // Check _conflicts from both services since they share static state
      const _conflicts = _bobService.getTeamStatus()._conflicts;
      expect(_conflicts.length).toBeGreaterThan(0);

      const _lockConflict = _conflicts.find((c) => c.type === "lock_violation");
      expect(_lockConflict).toBeDefined();
      expect(_lockConflict?.members).toContain("alice");
      expect(_lockConflict?.members).toContain("bob");

      await _bobService.cleanup();
    });

    it("should detect rapid edit _conflicts", async () => {
      const _sessionId = await _service.createSession("rapid-edit-test", alice);

      const _bobService = new TeamCollaborationService();
      await _bobService.joinSession(_sessionId, bob);

      const _now = new Date();

      // Alice edits file
      await _service.reportActivity({
        memberId: "alice",
        type: "edit",
        target: "src/utils.ts",
        timestamp: _now,
      });

      // Bob edits same file shortly after
      await _bobService.reportActivity({
        memberId: "bob",
        type: "edit",
        target: "src/utils.ts",
        timestamp: new Date(_now.getTime() + 30000), // 30 seconds later
      });

      const _conflicts = _service.getTeamStatus()._conflicts;
      const _rapidConflict = _conflicts.find((c) => c.type === "rapid_edits");
      expect(_rapidConflict).toBeDefined();
      expect(_rapidConflict?.file).toBe("src/utils.ts");

      await _bobService.cleanup();
    });
  });

  describe("Pattern Sharing", () => {
    it("should share patterns between team members", async () => {
      const _sessionId = await _service.createSession("pattern-test", alice);

      const pattern: Pattern = {
        id: "test-build-pattern",
        sequence: ["test", "build", "deploy"],
        frequency: 5,
        confidence: 0.85,
        context: "CI/CD workflow",
        tags: ["testing", "deployment"],
      };

      await _service.sharePattern(pattern);

      // Create Bob's _service and join _session
      const _bobService = new TeamCollaborationService();
      await _bobService.joinSession(_sessionId, bob);

      const _sharedPatterns = await _bobService.getSharedPatterns();
      expect(_sharedPatterns).toHaveLength(1);
      expect(_sharedPatterns[0].id).toBe("test-build-pattern");
      expect(_sharedPatterns[0].author).toBe("alice");
      expect(_sharedPatterns[0].authorName).toBe("Alice Developer");

      await _bobService.cleanup();
    });

    it("should handle pattern adoption", async () => {
      const _sessionId = await _service.createSession("adoption-test", alice);

      const pattern: Pattern = {
        id: "git-workflow",
        sequence: ["git", "add", "git", "commit", "git", "push"],
        frequency: 10,
        confidence: 0.9,
      };

      await _service.sharePattern(pattern);

      // Bob joins and adopts pattern
      const _bobService = new TeamCollaborationService();
      await _bobService.joinSession(_sessionId, bob);

      const _adopted = await _bobService.adoptPattern("git-workflow");
      expect(_adopted).toBe(true);

      // Wait a bit for file operations to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check adoption count increased by syncing again
      const _updatedPatterns = await _bobService.getSharedPatterns();
      const _adoptedPattern = _updatedPatterns.find(
        (p) => p.id === "git-workflow",
      );
      expect(_adoptedPattern?._adopted).toBe(1);

      await _bobService.cleanup();
    });

    it("should get _popular patterns", async () => {
      const _sessionId = await _service.createSession("_popular-test", alice);

      // Share multiple patterns
      await _service.sharePattern({
        id: "pattern1",
        sequence: ["cmd1"],
        frequency: 1,
        confidence: 0.5,
      });

      await _service.sharePattern({
        id: "pattern2",
        sequence: ["cmd2"],
        frequency: 5,
        confidence: 0.9,
      });

      const _popular = await _service.getPopularPatterns(5);
      expect(_popular).toHaveLength(2);
      // Should be sorted by combined score (adoption + votes + confidence)
      expect(_popular[0].confidence).toBeGreaterThanOrEqual(
        _popular[1].confidence,
      );
    });
  });

  describe("UI Rendering", () => {
    it("should render team _status with active members", async () => {
      const _sessionId = await _service.createSession("ui-test", alice);

      const _status = _service.renderTeamStatus();
      expect(_status).toContain("Team Collaboration");
      expect(_status).toContain("Active Members");
      expect(_status).toContain("Alice Developer");
    });

    it("should render _compact _status", async () => {
      const _sessionId = await _service.createSession("_compact-test", alice);

      const _compact = _service.renderCompactStatus();
      expect(_compact).toContain("👥 Team (1)");
    });

    it("should show solo _status when not connected", () => {
      const _compact = _service.renderCompactStatus();
      expect(_compact).toBe("👥 Solo");

      const _full = _service.renderTeamStatus();
      expect(_full).toBe("Not connected to team _session");
    });

    it("should render activity _feed", async () => {
      const _sessionId = await _service.createSession("_feed-test", alice);

      await _service.reportActivity({
        memberId: "alice",
        type: "edit",
        target: "test.ts",
        timestamp: new Date(),
      });

      const _feed = _service.renderActivityFeed(5);
      expect(_feed).toContain("Activity Feed");
      expect(_feed).toContain("Alice Developer");
      expect(_feed).toContain("editing");
    });
  });

  describe("Event System", () => {
    it("should emit events for team activities", async () => {
      const events: any[] = [];

      service.onAnyEvent((event) => {
        events.push(event);
      });

      const _sessionId = await _service.createSession("event-test", alice);

      await _service.reportActivity({
        memberId: "alice",
        type: "command",
        target: "npm test",
        timestamp: new Date(),
      });

      expect(events.length).toBeGreaterThan(0);
      const _activityEvent = events.find((e) => e.type === "activity_reported");
      expect(_activityEvent).toBeDefined();
      expect(_activityEvent.memberId).toBe("alice");
    });

    it("should handle pattern sharing events", async () => {
      const patternEvents: any[] = [];

      service.onEvent("pattern_shared", (event) => {
        patternEvents.push(event);
      });

      const _sessionId = await _service.createSession(
        "pattern-event-test",
        alice,
      );

      await _service.sharePattern({
        id: "event-pattern",
        sequence: ["test"],
        frequency: 1,
        confidence: 0.7,
      });

      expect(patternEvents).toHaveLength(1);
      expect(patternEvents[0].data.patternId).toBe("event-pattern");
    });
  });

  describe("Statistics", () => {
    it("should provide team collaboration statistics", async () => {
      const _sessionId = await _service.createSession("_stats-test", alice);

      await _service.reportActivity({
        memberId: "alice",
        type: "edit",
        target: "file.ts",
        timestamp: new Date(),
      });

      const _stats = _service.getStats();
      expect(_stats.sessionsActive).toBe(1);
      expect(_stats.membersTotal).toBe(1);
      expect(_stats.activitiesTracked).toBe(1);
    });
  });
});

describe("Stress Test - 3 Users with Continuous Activity", () => {
  it("should handle 3 _users with 100 activities each", async () => {
    const _service = new TeamCollaborationService({
      maxMembers: 3,
      autoSync: false,
    });

    const _users = [
      { id: "alice", name: "Alice", role: "lead" as const },
      { id: "bob", name: "Bob", role: "developer" as const },
      { id: "carol", name: "Carol", role: "developer" as const },
    ];

    const _sessionId = await _service.createSession("stress-test", {
      ..._users[0],
      joinedAt: new Date(),
      lastActivity: new Date(),
      currentFiles: [],
    });

    // Join all _users
    for (let i = 1; i < _users.length; i++) {
      const _userService = new TeamCollaborationService();
      await _userService.joinSession(_sessionId, {
        ..._users[i],
        joinedAt: new Date(),
        lastActivity: new Date(),
        currentFiles: [],
      });
      await _userService.cleanup();
    }

    // Generate activities
    const activities: Promise<void>[] = [];

    for (const user of _users) {
      for (let i = 0; i < 100; i++) {
        activities.push(
          service.reportActivity({
            memberId: user.id,
            type: "edit",
            target: `file${i % 10}.ts`,
            timestamp: new Date(Date.now() + i * 100),
          }),
        );
      }
    }

    // Execute all activities
    await Promise.all(activities);

    // Verify system stability
    const _status = _service.getTeamStatus();
    expect(_status.activeMembers).toBeDefined();
    expect(_status.recentActivities).toBeDefined();
    expect(_status.conflicts).toBeDefined();

    const _stats = _service.getStats();
    expect(_stats.activitiesTracked).toBeGreaterThan(0);

    await _service.cleanup();
  }, 10000); // 10 second timeout for stress test
});
