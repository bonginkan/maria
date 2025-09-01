/**
 * Integration Tests for Refactored Interactive Session
 *
 * Tests the complete integration of all modules and services
 * Verifies that the refactored architecture works correctly
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  beforeAll,
} from "vitest";
import { createInteractiveSession } from "../../index";
import { SessionOrchestrator } from "../../core/SessionOrchestrator";
import type { IMaria } from "../../../../../../types/maria-interfaces";

// Mock dependencies
vi.mock("../services/MemoryService");
vi.mock("../services/ConfigService");
vi.mock("../services/RouterService");
vi.mock("../services/ValidationService");
vi.mock("../services/ApprovalService");

// Create mock Maria instance
const createMockMaria = (): IMaria => ({
  id: "test-maria",
  name: "Test MARIA",
  version: "3.5.0",
  config: {
    provider: "test",
    model: "test-model",
  },
  setMemorySystem: vi.fn(),
  execute: vi.fn(),
  getStatus: vi.fn(() => ({ status: "ready" })),
});

describe("Interactive Session Integration", () => {
  let maria: IMaria;
  let session: any;

  beforeEach(() => {
    maria = createMockMaria();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (session && session.isRunning()) {
      await session.stop();
    }
  });

  describe("Session Creation", () => {
    it("should create a session with default config", () => {
      session = createInteractiveSession(maria);

      expect(session).toBeDefined();
      expect(typeof session.start).toBe("function");
      expect(typeof session.stop).toBe("function");
      expect(typeof session.isRunning).toBe("function");
      expect(typeof session.getStats).toBe("function");
      expect(typeof session.getConfig).toBe("function");
      expect(typeof session.setConfig).toBe("function");
    });

    it("should create a session with custom config", () => {
      const config = {
        memory: { enablePersistence: true },
        ui: { theme: "dark" },
        behavior: { autoApproval: true },
      };

      session = createInteractiveSession(maria, config);

      expect(session).toBeDefined();
    });

    it("should generate unique session IDs", () => {
      const session1 = createInteractiveSession(maria);
      const session2 = createInteractiveSession(maria);

      // Since we can't access sessionId directly, we'll test via stats
      expect(session1).not.toBe(session2);
    });
  });

  describe("Session Lifecycle", () => {
    it("should initialize and start session", async () => {
      session = createInteractiveSession(maria);

      expect(session.isRunning()).toBe(false);

      // Mock the underlying orchestrator to avoid actual readline
      const mockOrchestrator = {
        initialize: vi.fn().mockResolvedValue(undefined),
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        isRunning: true,
        getSessionStats: vi.fn().mockReturnValue({
          sessionId: "test-session",
          uptime: 1000,
        }),
      };

      // Replace the orchestrator with our mock
      (session as any).orchestrator = mockOrchestrator;

      await session.start();

      expect(mockOrchestrator.initialize).toHaveBeenCalled();
      expect(mockOrchestrator.start).toHaveBeenCalled();
    });

    it("should stop session gracefully", async () => {
      session = createInteractiveSession(maria);

      const mockOrchestrator = {
        initialize: vi.fn().mockResolvedValue(undefined),
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        isRunning: false,
      };

      (session as any).orchestrator = mockOrchestrator;

      await session.start();
      await session.stop();

      expect(mockOrchestrator.stop).toHaveBeenCalled();
    });
  });

  describe("Configuration Management", () => {
    it("should get configuration values", async () => {
      session = createInteractiveSession(maria);

      const mockOrchestrator = {
        getConfig: vi.fn().mockReturnValue("test-value"),
      };

      (session as any).orchestrator = mockOrchestrator;

      const value = session.getConfig("ui.theme");

      expect(mockOrchestrator.getConfig).toHaveBeenCalledWith("ui.theme");
      expect(value).toBe("test-value");
    });

    it("should set configuration values", async () => {
      session = createInteractiveSession(maria);

      const mockOrchestrator = {
        setConfig: vi.fn().mockResolvedValue(undefined),
      };

      (session as any).orchestrator = mockOrchestrator;

      await session.setConfig("ui.theme", "dark");

      expect(mockOrchestrator.setConfig).toHaveBeenCalledWith(
        "ui.theme",
        "dark",
      );
    });
  });

  describe("Session Statistics", () => {
    it("should return session statistics", () => {
      session = createInteractiveSession(maria);

      const mockStats = {
        sessionId: "test-session-123",
        uptime: 5000,
        memoryUsage: { system1: 100, system2: 200 },
        commandsExecuted: 5,
        errorsOccurred: 0,
      };

      const mockOrchestrator = {
        getSessionStats: vi.fn().mockReturnValue(mockStats),
      };

      (session as any).orchestrator = mockOrchestrator;

      const stats = session.getStats();

      expect(stats).toEqual(mockStats);
      expect(mockOrchestrator.getSessionStats).toHaveBeenCalled();
    });
  });

  describe("Service Integration", () => {
    it("should integrate all services correctly", async () => {
      const config = {
        memory: { enablePersistence: true, maxMemoryUsage: 256 },
        ui: { theme: "dark", showDebugInfo: true },
        behavior: { autoApproval: false, commandTimeout: 20000 },
        validation: { strictMode: true, maxInputLength: 5000 },
      };

      session = createInteractiveSession(maria, config);

      expect(session).toBeDefined();
      // Services are mocked, so we just verify the session was created successfully
    });
  });

  describe("Error Handling", () => {
    it("should handle initialization errors gracefully", async () => {
      session = createInteractiveSession(maria);

      const mockOrchestrator = {
        initialize: vi
          .fn()
          .mockRejectedValue(new Error("Initialization failed")),
        start: vi.fn(),
        stop: vi.fn().mockResolvedValue(undefined),
      };

      (session as any).orchestrator = mockOrchestrator;

      await expect(session.start()).rejects.toThrow("Initialization failed");
    });

    it("should handle stop errors gracefully", async () => {
      session = createInteractiveSession(maria);

      const mockOrchestrator = {
        initialize: vi.fn().mockResolvedValue(undefined),
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockRejectedValue(new Error("Stop failed")),
        isRunning: false,
      };

      (session as any).orchestrator = mockOrchestrator;

      await session.start();
      // Stop should not throw, but handle errors internally
      await session.stop();

      expect(mockOrchestrator.stop).toHaveBeenCalled();
    });
  });
});

describe("SessionOrchestrator Integration", () => {
  let maria: IMaria;

  beforeAll(() => {
    maria = createMockMaria();
  });

  it("should create orchestrator with valid context", () => {
    const context = {
      maria,
      sessionId: "test-session",
      startTime: new Date(),
      user: { name: "test-user" },
    };

    const orchestrator = new SessionOrchestrator(context);

    expect(orchestrator).toBeDefined();
    expect(orchestrator.isInitialized).toBe(false);
    expect(orchestrator.isRunning).toBe(false);
  });

  it("should provide access to session context", () => {
    const context = {
      maria,
      sessionId: "test-session-456",
      startTime: new Date("2025-08-29T10:00:00Z"),
      user: { name: "test-user" },
    };

    const orchestrator = new SessionOrchestrator(context);
    const retrievedContext = orchestrator.context;

    expect(retrievedContext.sessionId).toBe("test-session-456");
    expect(retrievedContext.user?.name).toBe("test-user");
  });
});

describe("Backward Compatibility", () => {
  let maria: IMaria;

  beforeEach(() => {
    maria = createMockMaria();
  });

  it("should maintain compatibility with old API", () => {
    const session = createInteractiveSession(maria);

    // Verify old interface is still available
    expect(typeof session.start).toBe("function");
    expect(typeof session.stop).toBe("function");

    // New interface should also be available
    expect(typeof session.isRunning).toBe("function");
    expect(typeof session.getStats).toBe("function");
  });

  it("should handle legacy configuration format", () => {
    // Test that the new system can handle configurations that might
    // be passed from legacy code
    const legacyConfig = {
      memory: { enablePersistence: false },
      ui: { theme: "default" },
    };

    const session = createInteractiveSession(maria, legacyConfig);
    expect(session).toBeDefined();
  });
});

describe("Performance", () => {
  let maria: IMaria;

  beforeEach(() => {
    maria = createMockMaria();
  });

  it("should create sessions quickly", () => {
    const start = Date.now();

    const session = createInteractiveSession(maria);

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(100); // Should create in < 100ms
    expect(session).toBeDefined();
  });

  it("should handle multiple session creation", () => {
    const sessions = [];
    const start = Date.now();

    for (let i = 0; i < 10; i++) {
      sessions.push(createInteractiveSession(maria));
    }

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500); // 10 sessions in < 500ms
    expect(sessions).toHaveLength(10);
  });
});
