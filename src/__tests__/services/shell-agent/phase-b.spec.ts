/**
 * Phase B Tests - Patch Application and Approval System
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { PatchEngine, PatchPlan, PatchOperation } from "../../patch-engine";
import { ApprovalSystem } from "../../approval-system";
import { ShellAgent } from "../../shell-agent";

describe("Phase B - Patch Engine", () => {
  let patchEngine: PatchEngine;
  let tempDir: string;
  let testFile: string;

  beforeEach(async () => {
    patchEngine = new PatchEngine();

    // Create temp directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "patch-test-"));
    testFile = path.join(tempDir, "test.txt");

    // Create test file
    await fs.writeFile(testFile, "Line 1\nLine 2\nLine 3\nLine 4\nLine 5\n");
  });

  afterEach(async () => {
    // Cleanup temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("Unified Diff Parsing", () => {
    it("should parse simple unified diff", () => {
      const diff = `@@ -1,3 +1,3 @@
 Line 1
-Line 2
+Modified Line 2
 Line 3`;

      const hunks = patchEngine.parseUnifiedDiff(diff);

      expect(hunks).toHaveLength(1);
      expect(hunks[0].oldStart).toBe(1);
      expect(hunks[0].oldLines).toBe(3);
      expect(hunks[0].newStart).toBe(1);
      expect(hunks[0].newLines).toBe(3);
      expect(hunks[0].lines).toHaveLength(3);
    });

    it("should parse multi-hunk diff", () => {
      const diff = `@@ -1,2 +1,2 @@
 Line 1
-Line 2
+Modified Line 2
@@ -4,2 +4,2 @@
 Line 4
-Line 5
+Modified Line 5`;

      const hunks = patchEngine.parseUnifiedDiff(diff);

      expect(hunks).toHaveLength(2);
      expect(hunks[0].oldStart).toBe(1);
      expect(hunks[1].oldStart).toBe(4);
    });
  });

  describe("Find/Replace Operations", () => {
    it("should perform simple find/replace", async () => {
      const result = await patchEngine.applyFindReplace(
        testFile,
        "Line 2",
        "Modified Line 2",
        { all: false },
      );

      expect(result.success).toBe(true);
      expect(result.replacements).toBe(1);

      const content = await fs.readFile(testFile, "utf-8");
      expect(content).toContain("Modified Line 2");
      expect(content).not.toContain("Line 2\n");
    });

    it("should perform global find/replace", async () => {
      await fs.writeFile(testFile, "test test test\ntest line\n");

      const result = await patchEngine.applyFindReplace(
        testFile,
        "test",
        "replaced",
        { all: true },
      );

      expect(result.success).toBe(true);
      expect(result.replacements).toBe(4);

      const content = await fs.readFile(testFile, "utf-8");
      expect(content).toBe("replaced replaced replaced\nreplaced line\n");
    });

    it("should handle regex find/replace", async () => {
      const result = await patchEngine.applyFindReplace(
        testFile,
        "Line \\d+",
        "Item X",
        { regex: true, all: true },
      );

      expect(result.success).toBe(true);
      expect(result.replacements).toBe(5);

      const content = await fs.readFile(testFile, "utf-8");
      expect(
        content.split("\n").filter((l) => l.startsWith("Item X")),
      ).toHaveLength(5);
    });
  });

  describe("Transaction Support", () => {
    it("should rollback changes on failure", async () => {
      const originalContent = await fs.readFile(testFile, "utf-8");

      await patchEngine.startTransaction("test-tx-1");
      await patchEngine.saveRollbackState(testFile);

      // Make changes
      await fs.writeFile(testFile, "Modified content");

      // Rollback
      const result = await patchEngine.rollbackTransaction();
      expect(result.rolledBack).toBe(1);

      const content = await fs.readFile(testFile, "utf-8");
      expect(content).toBe(originalContent);
    });

    it("should commit changes on success", async () => {
      await patchEngine.startTransaction("test-tx-2");
      await patchEngine.saveRollbackState(testFile);

      // Make changes
      await fs.writeFile(testFile, "Committed content");

      // Commit
      await patchEngine.commitTransaction();

      const content = await fs.readFile(testFile, "utf-8");
      expect(content).toBe("Committed content");
    });

    it("should handle rollback of non-existent files", async () => {
      const newFile = path.join(tempDir, "new.txt");

      await patchEngine.startTransaction("test-tx-3");
      await patchEngine.saveRollbackState(newFile);

      // Create new file
      await fs.writeFile(newFile, "New content");

      // Rollback should delete the file
      await patchEngine.rollbackTransaction();

      await expect(fs.access(newFile)).rejects.toThrow();
    });
  });

  describe("Patch Plan Execution", () => {
    it("should execute find/replace plan", async () => {
      const plan: PatchPlan = {
        description: "Test find/replace",
        operations: [
          {
            type: "find_replace",
            file: testFile,
            find: "Line 2",
            replace: "Modified Line 2",
          },
        ],
        requiresApproval: false,
        transactionId: "test-plan-1",
      };

      const result = await patchEngine.executePatchPlan(plan);

      expect(result.success).toBe(true);
      expect(result.applied).toBe(1);
      expect(result.failed).toBe(0);

      const content = await fs.readFile(testFile, "utf-8");
      expect(content).toContain("Modified Line 2");
    });

    it("should execute append operation", async () => {
      const plan: PatchPlan = {
        description: "Test append",
        operations: [
          {
            type: "append",
            file: testFile,
            content: "Appended Line\n",
          },
        ],
        requiresApproval: false,
        transactionId: "test-plan-2",
      };

      const result = await patchEngine.executePatchPlan(plan);

      expect(result.success).toBe(true);
      expect(result.applied).toBe(1);

      const content = await fs.readFile(testFile, "utf-8");
      expect(content).toEndWith("Appended Line\n");
    });

    it("should execute prepend operation", async () => {
      const plan: PatchPlan = {
        description: "Test prepend",
        operations: [
          {
            type: "prepend",
            file: testFile,
            content: "Prepended Line\n",
          },
        ],
        requiresApproval: false,
        transactionId: "test-plan-3",
      };

      const result = await patchEngine.executePatchPlan(plan);

      expect(result.success).toBe(true);
      expect(result.applied).toBe(1);

      const content = await fs.readFile(testFile, "utf-8");
      expect(content).toStartWith("Prepended Line\n");
    });

    it("should execute delete lines operation", async () => {
      const plan: PatchPlan = {
        description: "Test delete lines",
        operations: [
          {
            type: "delete_lines",
            file: testFile,
            startLine: 2,
            endLine: 3,
          },
        ],
        requiresApproval: false,
        transactionId: "test-plan-4",
      };

      const result = await patchEngine.executePatchPlan(plan);

      expect(result.success).toBe(true);
      expect(result.applied).toBe(1);

      const content = await fs.readFile(testFile, "utf-8");
      const lines = content.split("\n").filter((_l) => _l);
      expect(lines).toHaveLength(3); // Originally 5, deleted 2
      expect(lines[1]).toBe("Line 4"); // Line 2 and 3 deleted
    });

    it("should rollback on operation failure", async () => {
      const originalContent = await fs.readFile(testFile, "utf-8");

      const plan: PatchPlan = {
        description: "Test rollback",
        operations: [
          {
            type: "find_replace",
            file: testFile,
            find: "Line 2",
            replace: "Modified Line 2",
          },
          {
            type: "find_replace",
            file: testFile,
            find: "Non-existent text",
            replace: "Will fail",
          },
        ],
        requiresApproval: false,
        transactionId: "test-plan-5",
      };

      const result = await patchEngine.executePatchPlan(plan);

      expect(result.success).toBe(false);
      expect(result.message).toContain("rolled back");

      // File should be unchanged due to rollback
      const content = await fs.readFile(testFile, "utf-8");
      expect(content).toBe(originalContent);
    });
  });
});

describe("Phase B - Approval System", () => {
  let approvalSystem: ApprovalSystem;
  let _mockStdin: any;

  beforeEach(() => {
    approvalSystem = new ApprovalSystem();

    // Mock readline interface
    _mockStdin = {
      question: vi.fn(),
      close: vi.fn(),
    };
  });

  describe("Diff Formatting", () => {
    it("should format colored diff output", () => {
      const diff = `@@ -1,3 +1,3 @@
 Line 1
-Line 2
+Modified Line 2
 Line 3`;

      // Test that formatting doesn't throw
      expect(() => {
        // @ts-expect-error - accessing private method for testing
        approvalSystem.formatColoredDiff(diff);
      }).not.toThrow();
    });
  });

  describe("Operation Display", () => {
    it("should format find/replace operation", () => {
      const operation: PatchOperation = {
        type: "find_replace",
        file: "test.txt",
        find: "old text",
        replace: "new text",
      };

      // Test that formatting doesn't throw
      expect(() => {
        // @ts-expect-error - accessing private method for testing
        approvalSystem.formatOperation(operation, 0);
      }).not.toThrow();
    });
  });
});

describe("Phase B - Shell Agent Integration", () => {
  let shellAgent: ShellAgent;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "shell-agent-test-"));

    shellAgent = new ShellAgent({
      workspaceRoot: tempDir,
      phase: "B",
      enableEdit: true,
      autoApprove: true, // Auto-approve for testing
    });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("Patch Plan Generation", () => {
    it("should generate find/replace patch plan", async () => {
      const request = {
        text: 'replace "old text" with "new text" in test.txt',
        dryRun: false,
      };

      // @ts-expect-error - accessing private method for testing
      const plan = await shellAgent.generatePatchPlan(request);

      expect(plan.operations).toHaveLength(1);
      expect(plan.operations[0].type).toBe("find_replace");
      expect(plan.operations[0].find).toBe("old text");
      expect(plan.operations[0].replace).toBe("new text");
    });

    it("should generate append patch plan", async () => {
      const request = {
        text: 'add "new line" to test.txt',
        dryRun: false,
      };

      // @ts-expect-error - accessing private method for testing
      const plan = await shellAgent.generatePatchPlan(request);

      expect(plan.operations).toHaveLength(1);
      expect(plan.operations[0].type).toBe("append");
      expect(plan.operations[0].content).toBe("new line\n");
    });

    it("should generate delete lines patch plan", async () => {
      const request = {
        text: "delete lines 5-10 from test.txt",
        dryRun: false,
      };

      // @ts-expect-error - accessing private method for testing
      const plan = await shellAgent.generatePatchPlan(request);

      expect(plan.operations).toHaveLength(1);
      expect(plan.operations[0].type).toBe("delete_lines");
      expect(plan.operations[0].startLine).toBe(5);
      expect(plan.operations[0].endLine).toBe(10);
    });
  });

  describe("Phase Validation", () => {
    it("should reject edit operations in Phase A", () => {
      const phaseAAgent = new ShellAgent({
        workspaceRoot: tempDir,
        phase: "A",
        enableEdit: false,
      });

      expect(() => {
        // @ts-expect-error - accessing private method for testing
        phaseAAgent.createEditPlan({ text: "edit test", dryRun: false });
      }).toThrow("Edit operations require Phase B or higher");
    });

    it("should allow edit operations in Phase B", () => {
      const phaseBAgent = new ShellAgent({
        workspaceRoot: tempDir,
        phase: "B",
        enableEdit: true,
      });

      expect(() => {
        // @ts-expect-error - accessing private method for testing
        phaseBAgent.createEditPlan({ text: "edit test", dryRun: false });
      }).not.toThrow();
    });
  });
});
