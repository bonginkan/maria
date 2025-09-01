// src/services/shell-agent/__tests__/patch.spec.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { PatchApplier, UnifiedDiff, FindReplace } from "../../patch";

describe("Patch System", () => {
  let tempDir: string;
  let applier: PatchApplier;
  let testFile: string;

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "shell-master-patch-"));
    applier = new PatchApplier(tempDir);
    testFile = path.join(tempDir, "test.txt");

    // Create test file
    await fs.writeFile(
      testFile,
      [
        "Line 1: Original content",
        "Line 2: This will be changed",
        "Line 3: Context line",
        "Line 4: Another line",
        "Line 5: Final line",
      ].join("\n"),
    );
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Unified Diff Parsing", () => {
    it("should parse simple unified diff correctly", () => {
      const diffText = `--- a/test.txt
+++ b/test.txt
@@ -2,3 +2,3 @@
 Line 1: Original content
-Line 2: This will be changed
+Line 2: This has been changed
 Line 3: Context line`;

      const diff = applier.parseUnifiedDiff(diffText);

      expect(diff.originalFile).toBe("a/test.txt");
      expect(diff.modifiedFile).toBe("b/test.txt");
      expect(diff.hunks).toHaveLength(1);

      const hunk = diff.hunks[0];
      expect(hunk.sourceStart).toBe(2);
      expect(hunk.sourceLength).toBe(3);
      expect(hunk.targetStart).toBe(2);
      expect(hunk.targetLength).toBe(3);
      expect(hunk.lines).toHaveLength(3);

      expect(hunk.lines[0]).toEqual({
        type: " ",
        content: "Line 1: Original content",
      });
      expect(hunk.lines[1]).toEqual({
        type: "-",
        content: "Line 2: This will be changed",
      });
      expect(hunk.lines[2]).toEqual({
        type: "+",
        content: "Line 2: This has been changed",
      });
    });

    it("should parse multiple hunk unified diff", () => {
      const diffText = `--- a/test.txt
+++ b/test.txt
@@ -2,1 +2,1 @@
-Line 2: This will be changed
+Line 2: This has been changed
@@ -4,1 +4,1 @@
-Line 4: Another line
+Line 4: Modified line`;

      const diff = applier.parseUnifiedDiff(diffText);

      expect(diff.hunks).toHaveLength(2);
      expect(diff.hunks[0].sourceStart).toBe(2);
      expect(diff.hunks[1].sourceStart).toBe(4);
    });

    it("should throw error for invalid diff format", () => {
      const invalidDiff = "This is not a valid diff";

      expect(() => applier.parseUnifiedDiff(invalidDiff)).toThrow(
        "Invalid unified diff format",
      );
    });
  });

  describe("Unified Diff Application", () => {
    it("should apply simple unified diff successfully", async () => {
      const diffText = `--- a/test.txt
+++ b/test.txt
@@ -2,1 +2,1 @@
-Line 2: This will be changed
+Line 2: This has been changed`;

      const diff = applier.parseUnifiedDiff(diffText);
      const result = await applier.applyUnifiedDiff(diff, "test.txt");

      expect(result.success).toBe(true);
      expect(result.appliedHunks).toBe(1);
      expect(result.backupPath).toBeTruthy();

      // Verify modified content
      const lines = result.modifiedContent!.split("\n");
      expect(lines[1]).toBe("Line 2: This has been changed");
      expect(lines[0]).toBe("Line 1: Original content"); // Context preserved
      expect(lines[2]).toBe("Line 3: Context line"); // Context preserved
    });

    it("should handle fuzzy matching with line offset", async () => {
      // Add extra line at beginning to create offset
      await fs.writeFile(
        testFile,
        [
          "New Line 0: Added line",
          "Line 1: Original content",
          "Line 2: This will be changed",
          "Line 3: Context line",
          "Line 4: Another line",
          "Line 5: Final line",
        ].join("\n"),
      );

      const diffText = `--- a/test.txt
+++ b/test.txt
@@ -2,3 +2,3 @@
 Line 1: Original content
-Line 2: This will be changed
+Line 2: This has been changed
 Line 3: Context line`;

      const diff = applier.parseUnifiedDiff(diffText);
      const result = await applier.applyUnifiedDiff(diff, "test.txt");

      expect(result.success).toBe(true);
      expect(result.warnings).toContain(
        "Fuzzy match applied with +1 line offset",
      );

      const lines = result.modifiedContent!.split("\n");
      expect(lines[2]).toBe("Line 2: This has been changed"); // Applied with offset
    });

    it("should create backup before applying changes", async () => {
      const diffText = `--- a/test.txt
+++ b/test.txt
@@ -2,1 +2,1 @@
-Line 2: This will be changed
+Line 2: This has been changed`;

      const diff = applier.parseUnifiedDiff(diffText);
      const result = await applier.applyUnifiedDiff(diff, "test.txt");

      expect(result.success).toBe(true);
      expect(result.backupPath).toBeTruthy();

      // Verify backup file exists and contains original content
      const backupContent = await fs.readFile(result.backupPath!, "utf-8");
      expect(backupContent).toContain("Line 2: This will be changed");
    });

    it("should fail gracefully when context does not match", async () => {
      const diffText = `--- a/test.txt
+++ b/test.txt
@@ -2,3 +2,3 @@
 Line 1: Wrong context
-Line 2: This will be changed
+Line 2: This has been changed
 Line 3: Context line`;

      const diff = applier.parseUnifiedDiff(diffText);
      const result = await applier.applyUnifiedDiff(diff, "test.txt");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Could not find matching context");
    });
  });

  describe("Find/Replace Operations", () => {
    it("should apply simple find/replace successfully", async () => {
      const findReplace: FindReplace = {
        finds: [
          {
            search: "This will be changed",
            replace: "This has been changed",
          },
        ],
      };

      const result = await applier.applyFindReplace(findReplace, "test.txt");

      expect(result.success).toBe(true);
      expect(result.modifiedContent).toContain("Line 2: This has been changed");
      expect(result.backupPath).toBeTruthy();
    });

    it("should handle multiple find/replace operations", async () => {
      const findReplace: FindReplace = {
        finds: [
          { search: "This will be changed", replace: "This has been changed" },
          { search: "Another line", replace: "Modified line" },
        ],
      };

      const result = await applier.applyFindReplace(findReplace, "test.txt");

      expect(result.success).toBe(true);
      expect(result.modifiedContent).toContain("This has been changed");
      expect(result.modifiedContent).toContain("Modified line");
    });

    it("should warn when search text is not found", async () => {
      const findReplace: FindReplace = {
        finds: [
          {
            search: "Nonexistent text",
            replace: "Replacement",
          },
        ],
      };

      const result = await applier.applyFindReplace(findReplace, "test.txt");

      expect(result.success).toBe(true);
      expect(result.warnings).toContain(
        'Search text not found: "Nonexistent text"',
      );
    });
  });

  describe("Transactional Operations", () => {
    it("should commit changes successfully", async () => {
      const findReplace: FindReplace = {
        finds: [
          {
            search: "This will be changed",
            replace: "This has been changed",
          },
        ],
      };

      const result = await applier.applyFindReplace(findReplace, "test.txt");
      expect(result.success).toBe(true);

      // Commit the changes
      await applier.commitPatch(result);

      // Verify file was actually modified
      const fileContent = await fs.readFile(testFile, "utf-8");
      expect(fileContent).toContain("This has been changed");
    });

    it("should rollback changes successfully", async () => {
      const originalContent = await fs.readFile(testFile, "utf-8");

      const findReplace: FindReplace = {
        finds: [
          {
            search: "This will be changed",
            replace: "This has been changed",
          },
        ],
      };

      const result = await applier.applyFindReplace(findReplace, "test.txt");
      expect(result.success).toBe(true);

      // Commit changes
      await applier.commitPatch(result);

      // Verify file was modified
      let fileContent = await fs.readFile(testFile, "utf-8");
      expect(fileContent).toContain("This has been changed");

      // Rollback changes
      await applier.rollbackPatch(result);

      // Verify file was restored
      fileContent = await fs.readFile(testFile, "utf-8");
      expect(fileContent).toBe(originalContent);
    });

    it("should handle rollback failure gracefully", async () => {
      const result = {
        success: true,
        target: "test.txt",
        originalContent: "",
        backupPath: "/nonexistent/backup.txt",
      };

      await expect(applier.rollbackPatch(result)).rejects.toThrow();
    });
  });

  describe("Colored Diff Generation", () => {
    it("should generate colored diff display", () => {
      const diff: UnifiedDiff = {
        originalFile: "a/test.txt",
        modifiedFile: "b/test.txt",
        hunks: [
          {
            sourceStart: 2,
            sourceLength: 3,
            targetStart: 2,
            targetLength: 3,
            lines: [
              { type: " ", content: "Line 1: Original content" },
              { type: "-", content: "Line 2: This will be changed" },
              { type: "+", content: "Line 2: This has been changed" },
            ],
          },
        ],
      };

      const coloredDiff = applier.generateColoredDiff(diff);

      expect(coloredDiff).toContain("b/test.txt");
      expect(coloredDiff).toContain("Hunk 1");
      expect(coloredDiff).toContain("This will be changed");
      expect(coloredDiff).toContain("This has been changed");
    });
  });

  describe("Backup Management", () => {
    it("should clean up old backup files", async () => {
      // Create some old backup files
      const backupDir = path.join(tempDir, ".maria-backups");
      await fs.mkdir(backupDir, { recursive: true });

      const oldBackup = path.join(backupDir, "old.backup");
      const recentBackup = path.join(backupDir, "recent.backup");

      await fs.writeFile(oldBackup, "old content");
      await fs.writeFile(recentBackup, "recent content");

      // Manually set old timestamp
      const oldTime = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
      await fs.utimes(oldBackup, oldTime, oldTime);

      const cleanedCount = await applier.cleanupBackups(7);

      expect(cleanedCount).toBe(1);

      // Verify old backup was removed
      await expect(fs.access(oldBackup)).rejects.toThrow();

      // Verify recent backup still exists
      await expect(fs.access(recentBackup)).resolves.not.toThrow();
    });
  });

  describe("Error Handling", () => {
    it("should handle nonexistent target file", async () => {
      const diff: UnifiedDiff = {
        originalFile: "a/nonexistent.txt",
        modifiedFile: "b/nonexistent.txt",
        hunks: [
          {
            sourceStart: 1,
            sourceLength: 1,
            targetStart: 1,
            targetLength: 1,
            lines: [{ type: "+", content: "New line" }],
          },
        ],
      };

      const result = await applier.applyUnifiedDiff(diff, "nonexistent.txt");

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it("should validate patch operation parameters", () => {
      expect(() => applier.parseUnifiedDiff("")).toThrow();
    });
  });

  describe("Security Constraints", () => {
    it("should respect workspace boundaries", async () => {
      const outsidePath = "../outside.txt";

      const findReplace: FindReplace = {
        finds: [
          {
            search: "test",
            replace: "modified",
          },
        ],
      };

      await expect(
        applier.applyFindReplace(findReplace, outsidePath),
      ).rejects.toThrow();
    });
  });
});
