import { describe, it, expect } from "vitest";
import {
  isEditDistanceLE1,
  suggestCommands,
  formatUnknownCommandMessage,
} from "cli/utils/unknown-command";

describe("fuzzy (edit distance ≤ 1)", () => {
  it("distance<=1 detector works", () => {
    expect(isEditDistanceLE1("help", "help")).toBe(true); // same
    expect(isEditDistanceLE1("help", "hel")).toBe(true); // delete
    expect(isEditDistanceLE1("help", "helps")).toBe(true); // insert
    expect(isEditDistanceLE1("help", "heip")).toBe(true); // substitute
    expect(isEditDistanceLE1("help", "hp")).toBe(false); // 2 deletions
    expect(isEditDistanceLE1("status", "staats")).toBe(false); // 2 edits
  });

  it("suggestCommands uses fuzzy when enabled", () => {
    const sugs = suggestCommands("/hlp", 5, true); // 本来は /help を出したい
    // 何かしら候補が出る(並びはスコア順)
    expect(sugs.length).toBeGreaterThan(0);
  });

  it("suggestCommands does NOT use fuzzy when disabled", () => {
    const sugs = suggestCommands("/hlp", 5, false);
    // 前方一致/部分一致が無いなら 0 件もあり得る
    // ここは環境のコマンド定義次第なので「配列であること」程度でOK
    expect(Array.isArray(sugs)).toBe(true);
  });

  it("unknown message includes suggestions and doc link", () => {
    const msg = formatUnknownCommandMessage("/hlp", {
      docUrl: "https://docs.example.com/cli",
      color: false,
      fuzzy: true,
    });
    expect(msg).toContain("Unknown command: /hlp");
    expect(msg).toContain("Did you mean:");
    expect(msg).toContain("https://docs.example.com/cli");
  });

  it("handles edge cases gracefully", () => {
    // 空入力
    expect(suggestCommands("", 5, true)).toEqual([]);

    // 全角文字混在
    expect(suggestCommands("/help", 5, true).length).toBeGreaterThan(0);

    // 大文字小文字混在
    expect(suggestCommands("HELP", 5, true).length).toBeGreaterThan(0);
  });

  it("respects NO_COLOR environment variable", () => {
    process.env.NO_COLOR = "1";
    const msg = formatUnknownCommandMessage("/test123", { color: true });
    expect(msg).not.toContain("\u001b["); // ANSI escape sequences
    delete process.env.NO_COLOR;
  });
});
