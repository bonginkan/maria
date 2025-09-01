import { describe, it, expect } from "vitest";
import {
  getCommandInfo,
  getRelatedCommands,
  getCommandChain,
} from "../lib/command-groups";
import { validateRegistry } from "../lib/command-selftest";

describe("command registry self test", () => {
  it("examples & usage must be resolvable", () => {
    const { valid, _errors } = validateRegistry();
    if (!valid) {
      console.error(
        "\nSelfTestErrors:\n" + _errors.map((e) => ` - ${e}`).join("\n"),
      );
    }
    expect(valid).toBe(true);
    expect(_errors.length).toBe(0);
  });

  it("normalization & alias resolution", () => {
    // スラ無しでも解決
    expect(getCommandInfo("help")?.name).toBe("/help");
    expect(getCommandInfo("/help")?.name).toBe("/help");

    // alias → 本体
    const save = getCommandInfo("/write");
    expect(save?.name).toBe("/save");

    // related (同カテゴリ)
    const rel = getRelatedCommands("/help", 10);
    expect(Array.isArray(rel)).toBe(true);
    // 自身は含まない
    expect(rel.find((x) => x.name === "/help")).toBeFalsy();
  });

  it("command chains must resolve", () => {
    const chain = getCommandChain("code-review-flow");
    expect(chain).toBeTruthy();
    if (chain) {
      expect(chain.resolved.length).toBe(chain.commands.length);
    }
  });

  it("should handle edge cases gracefully", () => {
    // 存在しないコマンド
    expect(getCommandInfo("/nonexistent")).toBeUndefined();

    // 空文字列
    expect(getCommandInfo("")).toBeUndefined();

    // 存在しないチェーン
    expect(getCommandChain("nonexistent-chain")).toBeUndefined();

    // 存在しないコマンドの関連コマンド
    expect(getRelatedCommands("/nonexistent")).toEqual([]);
  });

  it("should maintain registry integrity", () => {
    // 最低限のコマンドが存在することを確認
    const help = getCommandInfo("/help");
    expect(help).toBeTruthy();
    expect(help?.category).toBe("core");

    const code = getCommandInfo("/code");
    expect(code).toBeTruthy();
    expect(code?.category).toBe("generation");
  });
});
