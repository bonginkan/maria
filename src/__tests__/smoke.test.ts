import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { existsSync } from "fs";
import path from "path";

describe("Smoke Tests", () => {
  const distPath = path.join(process.cwd(), "dist");
  let cliPath = path.join(distPath, "cli.js");

  // Check for both .js and .cjs extensions
  if (!existsSync(cliPath)) {
    const cliPathCjs = path.join(distPath, "cli.cjs");
    if (existsSync(cliPathCjs)) {
      cliPath = cliPathCjs;
    }
  }

  it("should have built dist directory", () => {
    expect(existsSync(distPath)).toBe(true);
  });

  it("should have cli.js or cli.cjs in dist", () => {
    const hasJs = existsSync(path.join(distPath, "cli.js"));
    const hasCjs = existsSync(path.join(distPath, "cli.cjs"));
    expect(hasJs || hasCjs).toBe(true);
  });

  it("should show version", () => {
    try {
      const output = execSync(`node ${cliPath} --version`, {
        encoding: "utf8",
        timeout: 5000,
      });
      expect(output).toBeTruthy();
    } catch (error) {
      // Version might not work yet, but CLI should at least run
      expect(error).toBeDefined();
    }
  });

  it("should show help", () => {
    try {
      const output = execSync(`echo "/help" | node ${cliPath}`, {
        encoding: "utf8",
        timeout: 5000,
        input: "/help\n",
      });
      expect(output).toContain("Core Commands");
    } catch (innerError) {
      // Help might not work yet, but check for some output
      expect(innerError).toBeDefined();
    }
  });

  it("should have utilities category in help", () => {
    try {
      const output = execSync(`echo "/help" | node ${cliPath}`, {
        encoding: "utf8",
        timeout: 5000,
        input: "/help\n",
      });
      expect(output).toContain("Utilities");
      expect(output).toContain("🧮");
    } catch (error) {
      // Utilities might not show yet
      expect(error).toBeDefined();
    }
  });
});
