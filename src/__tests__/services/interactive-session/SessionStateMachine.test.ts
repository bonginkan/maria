// src/services/interactive-session/__tests__/SessionStateMachine.test.ts
// Unit tests for SessionStateMachine

import { describe, it, expect, beforeEach, vi } from "vitest";
import { SessionStateMachine } from "../core/SessionStateMachine";

describe("SessionStateMachine", () => {
  let fsm: SessionStateMachine;

  beforeEach(() => {
    fsm = new SessionStateMachine({ deadlineMs: 1000 });
  });

  describe("State transitions", () => {
    it("should start in Idle state", () => {
      expect(fsm.state).toBe("Idle");
    });

    it("should transition from Idle to Reading on start", () => {
      const result = fsm.start("turn-1");
      expect(result.state).toBe("Reading");
      expect(result.ctx.turnId).toBe("turn-1");
    });

    it("should transition through complete flow", () => {
      // Start
      fsm.start("turn-1");
      expect(fsm.state).toBe("Reading");

      // Input ready
      fsm.send({ type: "INPUT_READY", payload: "/help" });
      expect(fsm.state).toBe("Routing");

      // Routed
      fsm.send({ type: "ROUTED" });
      expect(fsm.state).toBe("Executing");

      // Execution done
      fsm.send({ type: "EXEC_DONE" });
      expect(fsm.state).toBe("Streaming");

      // Stream done
      fsm.send({ type: "STREAM_DONE" });
      expect(fsm.state).toBe("Completed");

      // Reset
      fsm.send({ type: "RESET" });
      expect(fsm.state).toBe("Idle");
    });

    it("should handle cancellation at any state", () => {
      fsm.start("turn-1");

      // Cancel during Reading
      fsm.send({ type: "CANCEL" });
      expect(fsm.state).toBe("Canceled");

      // Reset and try again
      fsm.send({ type: "RESET" });
      fsm.start("turn-2");
      fsm.send({ type: "INPUT_READY", payload: "test" });

      // Cancel during Routing
      fsm.send({ type: "CANCEL" });
      expect(fsm.state).toBe("Canceled");
    });

    it("should handle errors and transition to Error state", () => {
      fsm.start("turn-1");
      fsm.send({ type: "FAIL", error: new Error("Test error") });

      expect(fsm.state).toBe("Error");
      expect(fsm.ctx.meta?.error).toBeDefined();
    });
  });

  describe("Inflight protection", () => {
    it("should prevent double execution", () => {
      fsm.start("turn-1");

      expect(() => fsm.start("turn-2")).toThrow("inflight");
    });

    it("should allow new turn after completion", () => {
      fsm.start("turn-1");
      fsm.send({ type: "INPUT_READY", payload: "test" });
      fsm.send({ type: "ROUTED" });
      fsm.send({ type: "EXEC_DONE" });
      fsm.send({ type: "STREAM_DONE" });
      expect(fsm.state).toBe("Completed");

      // Reset allows new turn
      fsm.send({ type: "RESET" });
      expect(() => fsm.start("turn-2")).not.toThrow();
    });
  });

  describe("Deadline handling", () => {
    it("should provide AbortSignal", () => {
      fsm.start("turn-1");
      expect(fsm.signal).toBeDefined();
      expect(fsm.signal?.aborted).toBe(false);
    });

    it("should enforce deadline", async () => {
      const fsmShort = new SessionStateMachine({ deadlineMs: 100 });
      fsmShort.start("turn-1");

      // Wait for deadline
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should be canceled due to deadline
      expect(fsmShort.state).toBe("Canceled");
      expect(fsmShort.signal?.aborted).toBe(true);
    });

    it("should clear deadline on completion", () => {
      fsm.start("turn-1");
      const signal = fsm.signal;

      // Complete the flow
      fsm.send({ type: "INPUT_READY", payload: "test" });
      fsm.send({ type: "ROUTED" });
      fsm.send({ type: "EXEC_DONE" });
      fsm.send({ type: "STREAM_DONE" });

      expect(fsm.state).toBe("Completed");
      // Signal should be cleared
      expect(fsm.signal).toBeUndefined();
    });
  });

  describe("Terminal states", () => {
    it("should not allow transitions from Completed except Reset", () => {
      fsm.start("turn-1");
      fsm.send({ type: "INPUT_READY", payload: "test" });
      fsm.send({ type: "ROUTED" });
      fsm.send({ type: "EXEC_DONE" });
      fsm.send({ type: "STREAM_DONE" });

      expect(fsm.state).toBe("Completed");

      // Try to send other events - should be ignored
      fsm.send({ type: "START" });
      expect(fsm.state).toBe("Completed");

      fsm.send({ type: "INPUT_READY", payload: "test2" });
      expect(fsm.state).toBe("Completed");

      // Only RESET should work
      fsm.send({ type: "RESET" });
      expect(fsm.state).toBe("Idle");
    });

    it("should not allow transitions from Error except Reset", () => {
      fsm.start("turn-1");
      fsm.send({ type: "FAIL", error: new Error("test") });

      expect(fsm.state).toBe("Error");

      // Try other events
      fsm.send({ type: "START" });
      expect(fsm.state).toBe("Error");

      // Only RESET should work
      fsm.send({ type: "RESET" });
      expect(fsm.state).toBe("Idle");
    });
  });

  describe("Context management", () => {
    it("should store input in context", () => {
      fsm.start("turn-1");
      fsm.send({ type: "INPUT_READY", payload: "/help me" });

      expect(fsm.ctx.input).toBe("/help me");
      expect(fsm.ctx.turnId).toBe("turn-1");
    });

    it("should clear context on reset", () => {
      fsm.start("turn-1");
      fsm.send({ type: "INPUT_READY", payload: "test" });
      expect(fsm.ctx.input).toBe("test");

      // Must be in a terminal state to reset
      fsm.send({ type: "CANCEL" });
      expect(fsm.state).toBe("Canceled");

      fsm.send({ type: "RESET" });
      expect(fsm.ctx).toEqual({});
      expect(fsm.state).toBe("Idle");
    });

    it("should store error in context on failure", () => {
      const error = new Error("Test error");
      fsm.start("turn-1");
      fsm.send({ type: "FAIL", error });

      expect(fsm.ctx.meta?.error).toBe(error);
    });
  });
});
