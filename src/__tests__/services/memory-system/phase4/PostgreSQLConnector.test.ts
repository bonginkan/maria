/**
 * PostgreSQL Connector Test Suite
 * Phase 4.0 Week 2: Comprehensive testing for PostgreSQL integration
 * Coverage target: 80%+
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import { PostgreSQLConnector } from "../enterprise/PostgreSQLConnector";
import { Pool } from "pg";
import type { MemoryRecord } from "../enterprise/PostgreSQLConnector";

// Mock pg module
vi.mock("pg", () => {
  const mockPool = {
    query: vi.fn(),
    connect: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
    totalCount: 5,
    idleCount: 3,
    waitingCount: 0,
  };

  const mockClient = {
    query: vi.fn(),
    release: vi.fn(),
  };

  return {
    Pool: vi.fn(() => mockPool),
    PoolClient: mockClient,
  };
});

describe("PostgreSQLConnector", () => {
  let connector: PostgreSQLConnector;
  let mockPool: any;

  const testConfig = {
    host: "localhost",
    port: 5432,
    database: "test_memories",
    user: "test_user",
    password: "test_password",
    connectionPoolSize: 10,
    enablePreparedStatements: true,
  };

  beforeEach(() => {
    connector = new PostgreSQLConnector(testConfig);
    mockPool = (Pool as any).mock.results[0].value;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Connection Management", () => {
    it("should connect successfully with valid config", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ now: new Date() }] });

      await connector.connect();

      expect(mockPool.query).toHaveBeenCalledWith("SELECT NOW()");
      expect(mockPool.on).toHaveBeenCalledWith("connect", expect.any(Function));
      expect(mockPool.on).toHaveBeenCalledWith("error", expect.any(Function));
    });

    it("should throw error when already connected", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ now: new Date() }] });
      await connector.connect();

      await expect(connector.connect()).rejects.toThrow("Already connected");
    });

    it("should disconnect gracefully", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ now: new Date() }] });
      await connector.connect();

      await connector.disconnect();

      expect(mockPool.end).toHaveBeenCalled();
    });

    it("should handle connection errors", async () => {
      const error = new Error("Connection failed");
      mockPool.query.mockRejectedValueOnce(error);

      await expect(connector.connect()).rejects.toThrow("Connection failed");
    });
  });

  describe("Query Execution", () => {
    beforeEach(async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ now: new Date() }] });
      await connector.connect();
    });

    it("should execute simple query successfully", async () => {
      const expectedResult = {
        rows: [{ id: "1", content: "test" }],
        rowCount: 1,
      };
      mockPool.query.mockResolvedValueOnce(expectedResult);

      const result = await connector.query(
        "SELECT * FROM memories WHERE id = $1",
        ["1"],
      );

      expect(result).toEqual(expectedResult);
      expect(mockPool.query).toHaveBeenCalledWith({
        text: "SELECT * FROM memories WHERE id = $1",
        values: ["1"],
        statement_timeout: undefined,
        query_timeout: undefined,
      });
    });

    it("should retry on retryable errors", async () => {
      const retryableError = new Error("Connection lost");
      (retryableError as any).code = "57P03";

      mockPool.query
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await connector.query("SELECT 1", [], { retries: 3 });

      expect(result.rowCount).toBe(0);
      expect(mockPool.query).toHaveBeenCalledTimes(4); // Initial + 3 retries, but succeeded on 3rd
    });

    it("should fail after max retries", async () => {
      const error = new Error("Persistent error");
      (error as any).code = "57P03";

      mockPool.query.mockRejectedValue(error);

      await expect(
        connector.query("SELECT 1", [], { retries: 2 }),
      ).rejects.toThrow("Persistent error");
    });
  });

  describe("Memory Operations", () => {
    beforeEach(async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ now: new Date() }] });
      await connector.connect();
    });

    it("should store memory record successfully", async () => {
      const memory: Partial<MemoryRecord> = {
        user_id: "user123",
        content: { text: "Test memory" },
        metadata: { source: "test" },
        tags: ["test", "unit"],
        category: "testing",
        importance: 5,
      };

      const storedMemory = {
        ...memory,
        id: "generated-uuid",
        created_at: new Date(),
        updated_at: new Date(),
        version: 1,
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [storedMemory],
        rowCount: 1,
      });

      const result = await connector.storeMemory(memory);

      expect(result).toEqual(storedMemory);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining("INSERT INTO memories"),
          values: expect.arrayContaining([
            expect.any(String), // id
            "user123",
            JSON.stringify(memory.content),
            JSON.stringify(memory.metadata),
            undefined, // embedding
            ["test", "unit"],
            "testing",
            5,
          ]),
        }),
      );
    });

    it("should retrieve memory by ID", async () => {
      const memory = {
        id: "test-id",
        user_id: "user123",
        content: { text: "Test" },
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
        version: 1,
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [memory],
        rowCount: 1,
      });

      const result = await connector.getMemory("test-id");

      expect(result).toEqual(memory);
    });

    it("should return null for non-existent memory", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const result = await connector.getMemory("non-existent");

      expect(result).toBeNull();
    });

    it("should search memories with JSONB query", async () => {
      const memories = [
        { id: "1", user_id: "user123", content: { type: "note" } },
        { id: "2", user_id: "user123", content: { type: "note" } },
      ];

      mockPool.query.mockResolvedValueOnce({
        rows: memories,
        rowCount: 2,
      });

      const result = await connector.searchMemories(
        "user123",
        { type: "note" },
        10,
      );

      expect(result).toEqual(memories);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.objectContaining({
          values: ["user123", JSON.stringify({ type: "note" }), 10],
        }),
      );
    });

    it("should perform vector similarity search", async () => {
      const embedding = new Array(1536).fill(0.1);
      const memories = [
        { id: "1", content: { text: "Similar memory" }, score: 0.95 },
      ];

      mockPool.query.mockResolvedValueOnce({
        rows: memories,
        rowCount: 1,
      });

      const result = await connector.vectorSearch(embedding, 0.8, 5);

      expect(result).toEqual(memories);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.objectContaining({
          values: [embedding, 0.8, 5],
        }),
      );
    });
  });

  describe("Transaction Management", () => {
    let mockClient: any;

    beforeEach(async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ now: new Date() }] });
      await connector.connect();

      mockClient = {
        query: vi.fn(),
        release: vi.fn(),
      };
      mockPool.connect.mockResolvedValueOnce(mockClient);
    });

    it("should execute transaction successfully", async () => {
      mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await connector.transaction(async (client) => {
        await client.query("INSERT INTO test VALUES (1)");
        return "success";
      });

      expect(result).toBe("success");
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith(
        "INSERT INTO test VALUES (1)",
      );
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("should rollback transaction on error", async () => {
      const error = new Error("Transaction failed");
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(error); // INSERT fails

      await expect(
        connector.transaction(async (client) => {
          await client.query("INSERT INTO test VALUES (1)");
          return "success";
        }),
      ).rejects.toThrow("Transaction failed");

      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe("Bulk Operations", () => {
    let mockClient: any;

    beforeEach(async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ now: new Date() }] });
      await connector.connect();

      mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        release: vi.fn(),
      };
      mockPool.connect.mockResolvedValueOnce(mockClient);
    });

    it("should perform bulk insert", async () => {
      const records: MemoryRecord[] = [
        {
          id: "1",
          user_id: "user1",
          content: { text: "Memory 1" },
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
          version: 1,
          importance: 5,
        },
        {
          id: "2",
          user_id: "user2",
          content: { text: "Memory 2" },
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
          version: 1,
          importance: 3,
        },
      ];

      await connector.bulk([{ type: "insert", records }]);

      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO memories"),
        expect.arrayContaining([
          "1",
          "user1",
          expect.any(String),
          expect.any(String),
          undefined,
          undefined,
          undefined,
          5,
          "2",
          "user2",
          expect.any(String),
          expect.any(String),
          undefined,
          undefined,
          undefined,
          3,
        ]),
      );
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
    });

    it("should perform bulk upsert", async () => {
      const records: MemoryRecord[] = [
        {
          id: "1",
          user_id: "user1",
          content: { text: "Updated" },
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
          version: 2,
          importance: 7,
        },
      ];

      await connector.bulk([{ type: "upsert", records }]);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("ON CONFLICT (id) DO UPDATE"),
        expect.any(Array),
      );
    });
  });

  describe("Health Monitoring", () => {
    it("should report disconnected health when not connected", () => {
      const health = connector.getHealth();

      expect(health.isConnected).toBe(false);
      expect(health.activeConnections).toBe(0);
      expect(health.totalQueries).toBe(0);
    });

    it("should report connected health with metrics", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ now: new Date() }] });
      await connector.connect();

      // Execute some queries to generate metrics
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      await connector.query("SELECT 1");

      const health = connector.getHealth();

      expect(health.isConnected).toBe(true);
      expect(health.activeConnections).toBe(5);
      expect(health.idleConnections).toBe(3);
      expect(health.totalQueries).toBeGreaterThan(0);
      expect(health.errorRate).toBe(0);
      expect(health.averageQueryTime).toBeGreaterThanOrEqual(0);
    });

    it("should calculate error rate correctly", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ now: new Date() }] });
      await connector.connect();

      // Successful query
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      await connector.query("SELECT 1");

      // Failed query
      mockPool.query.mockRejectedValueOnce(new Error("Query failed"));
      await expect(
        connector.query("SELECT 2", [], { retries: 0 }),
      ).rejects.toThrow();

      const health = connector.getHealth();

      expect(health.errorRate).toBeGreaterThan(0);
      expect(health.errorRate).toBeLessThanOrEqual(100);
    });
  });

  describe("Stream Operations", () => {
    beforeEach(async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ now: new Date() }] });
      await connector.connect();
    });

    it("should create stream for large result sets", async () => {
      const mockClient = {
        query: vi.fn(() => ({
          on: vi.fn((event, handler) => {
            if (event === "row") {
              handler({ id: "1", data: "test" });
              handler({ id: "2", data: "test" });
            }
            if (event === "end") {
              setTimeout(handler, 0);
            }
          }),
        })),
        release: vi.fn(),
      };

      mockPool.connect.mockResolvedValueOnce(mockClient);

      const stream = await connector.stream("SELECT * FROM large_table");

      const results: any[] = [];
      stream.on("data", (chunk) => results.push(chunk));

      await new Promise((resolve) => stream.on("end", resolve));

      expect(results).toHaveLength(2);
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    beforeEach(async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ now: new Date() }] });
      await connector.connect();
    });

    it("should identify retryable errors correctly", async () => {
      const retryableErrors = [
        { code: "40001", message: "Serialization failure" },
        { code: "40P01", message: "Deadlock detected" },
        { code: "57P03", message: "Cannot connect now" },
        { code: "ECONNREFUSED", message: "Connection refused" },
      ];

      for (const errorInfo of retryableErrors) {
        const error = new Error(errorInfo.message);
        (error as any).code = errorInfo.code;

        mockPool.query
          .mockRejectedValueOnce(error)
          .mockResolvedValueOnce({ rows: [], rowCount: 0 });

        const result = await connector.query("SELECT 1", [], { retries: 1 });
        expect(result.rowCount).toBe(0);
      }
    });

    it("should not retry non-retryable errors", async () => {
      const error = new Error("Syntax error");
      (error as any).code = "42601";

      mockPool.query.mockRejectedValue(error);

      await expect(
        connector.query("SELECT 1", [], { retries: 3 }),
      ).rejects.toThrow("Syntax error");

      // Should only try once (no retries)
      expect(mockPool.query).toHaveBeenCalledTimes(2); // 1 for connect, 1 for query
    });
  });

  describe("Configuration Validation", () => {
    it("should require either connectionString or host", () => {
      expect(() => {
        new PostgreSQLConnector({} as any);
      }).toThrow("Either connectionString or host must be provided");
    });

    it("should accept connectionString without host", () => {
      const connector = new PostgreSQLConnector({
        connectionString: "postgresql://user:pass@localhost/db",
      });

      expect(connector).toBeDefined();
    });

    it("should set default values for optional configs", () => {
      const connector = new PostgreSQLConnector({
        host: "localhost",
        database: "test",
      });

      const config = (connector as any).config;
      expect(config.connectionPoolSize).toBe(20);
      expect(config.maxRetries).toBe(3);
      expect(config.enablePreparedStatements).toBe(true);
    });
  });
});

describe("PostgreSQL Connector Integration", () => {
  it("should handle real-world memory sync scenario", async () => {
    const connector = new PostgreSQLConnector({
      host: "localhost",
      database: "test",
    });

    const mockPool = (Pool as any).mock.results[0].value;
    mockPool.query.mockResolvedValueOnce({ rows: [{ now: new Date() }] });

    await connector.connect();

    // Simulate storing multiple memories
    const memories = Array.from({ length: 100 }, (_, i) => ({
      user_id: `user${i % 10}`,
      content: { text: `Memory ${i}` },
      metadata: { index: i },
      importance: Math.floor(Math.random() * 10),
    }));

    for (const memory of memories) {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ ...memory, id: `id-${memories.indexOf(memory)}` }],
        rowCount: 1,
      });
    }

    const results = await Promise.all(
      memories.map((m) => connector.storeMemory(m)),
    );

    expect(results).toHaveLength(100);
    expect(results[0].id).toBe("id-0");
  });
});
