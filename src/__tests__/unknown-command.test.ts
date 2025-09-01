import { describe, it, expect } from "vitest";
import {
  formatUnknownCommandMessage,
  suggestCommands,
} from "cli/utils/unknown-command";

describe("unknown command message", () => {
  it("should include unknown token and suggestions", () => {
    const msg = formatUnknownCommandMessage("/hlp", {
      docUrl: "https://docs.example.com/cli",
      color: false,
    });

    expect(msg).toContain("Unknown command: /hlp");

    // だいたい /help を提案できる
    const sugs = suggestCommands("/hlp", 5);
    if (sugs.length) {
      expect(msg).toContain("Did you mean:");
    }
    expect(msg).toContain("https://docs.example.com/cli");
  });

  it("suggestCommands returns deterministic top-k", () => {
    const a = suggestCommands("he", 3);
    const b = suggestCommands("he", 3);
    expect(a).toEqual(b);
  });

  it("should handle exact matches with highest priority", () => {
    const suggestions = suggestCommands("help", 5);
    expect(suggestions.length).toBeGreaterThan(0);
    // 完全一致が最初に来るべき
    expect(suggestions[0]).toBe("/help");
  });

  it("should handle prefix matches", () => {
    const suggestions = suggestCommands("co", 5);
    const codeCommands = suggestions.filter((s) => s.includes("code"));
    expect(codeCommands.length).toBeGreaterThan(0);
  });

  it("should handle empty input gracefully", () => {
    const suggestions = suggestCommands("", 5);
    expect(suggestions).toEqual([]);
  });

  it("should limit suggestions to max parameter", () => {
    const suggestions = suggestCommands("e", 2);
    expect(suggestions.length).toBeLessThanOrEqual(2);
  });

  it("should format message without color when disabled", () => {
    const msg = formatUnknownCommandMessage("/test123", { color: false });
    expect(msg).not.toContain("\u001b["); // ANSI escape sequences
  });
});
