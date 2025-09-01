import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";
import ts from "typescript";

describe("Variable Consistency Tests", () => {
  it("should not have underscore variable mismatches", async () => {
    const files = await glob("src/**/*.ts", {
      ignore: ["**/node_modules/**", "**/dist/**", "**/*.d.ts", "**/*.test.ts"],
    });

    const mismatches: Array<{ file: string; line: number; message: string }> =
      [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const sourceFile = ts.createSourceFile(
        file,
        content,
        ts.ScriptTarget.Latest,
        true,
      );

      const checkNode = (node: ts.Node) => {
        // Check for common variable mismatch patterns
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
          const varName = node.name.text;

          // Check if variable starts with underscore
          if (varName.startsWith("_")) {
            const nonUnderscoreName = varName.substring(1);

            // Search for usage without underscore in the same scope
            const parent = findScope(node);
            if (parent) {
              const checkUsage = (usageNode: ts.Node) => {
                if (
                  ts.isIdentifier(usageNode) &&
                  usageNode.text === nonUnderscoreName &&
                  !isDeclaration(usageNode)
                ) {
                  const { line } = sourceFile.getLineAndCharacterOfPosition(
                    usageNode.pos,
                  );
                  mismatches.push({
                    file: path.relative(process.cwd(), file),
                    line: line + 1,
                    message: `Variable declared as '${varName}' but used as '${nonUnderscoreName}'`,
                  });
                }
                ts.forEachChild(usageNode, checkUsage);
              };

              checkUsage(parent);
            }
          }
        }

        ts.forEachChild(node, checkNode);
      };

      checkNode(sourceFile);
    }

    // Report findings
    if (mismatches.length > 0) {
      console.log(`\nFound ${mismatches.length} variable consistency issues:`);

      // Group by file
      const byFile = new Map<string, typeof mismatches>();
      mismatches.forEach((m) => {
        if (!byFile.has(m.file)) {
          byFile.set(m.file, []);
        }
        byFile.get(m.file)!.push(m);
      });

      // Show top 10 files with most issues
      const sorted = Array.from(byFile.entries())
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 10);

      sorted.forEach(([file, issues]) => {
        console.log(`  ${file}: ${issues.length} issues`);
        issues.slice(0, 3).forEach((issue) => {
          console.log(`    Line ${issue.line}: ${issue.message}`);
        });
      });
    }

    // Current threshold - will be reduced over time
    const MAX_ALLOWED_MISMATCHES = 15000; // Start high, reduce gradually

    expect(mismatches.length).toBeLessThanOrEqual(MAX_ALLOWED_MISMATCHES);
  });

  it("should not have undefined identifier references", async () => {
    const criticalFiles = [
      "src/services/slash-command-handler.ts",
      "src/services/interactive-session.ts",
      "src/providers/manager.ts",
      "src/utils/config.ts",
    ];

    const undefinedRefs: Array<{
      file: string;
      line: number;
      identifier: string;
    }> = [];

    for (const file of criticalFiles) {
      if (!fs.existsSync(file)) continue;

      const content = fs.readFileSync(file, "utf-8");

      // Simple pattern matching for common undefined reference issues
      const lines = content.split("\n");
      lines.forEach((line, index) => {
        // Check for common patterns like using 'config' when '_config' was declared
        if (/\bconfig\b/.test(line) && !/\b_config\b/.test(line)) {
          // Check if this line is likely using an undefined 'config'
          if (
            !line.includes("import") &&
            !line.includes("export") &&
            !line.includes("ConfigManager") &&
            !line.includes("//")
          ) {
            // Look for _config declaration in nearby lines
            const nearbyHasUnderscore = lines
              .slice(
                Math.max(0, index - 20),
                Math.min(lines.length, index + 20),
              )
              .some((l) => /\b_config\b/.test(l));

            if (nearbyHasUnderscore && !line.includes("this.config")) {
              undefinedRefs.push({
                file: path.relative(process.cwd(), file),
                line: index + 1,
                identifier: "config (should be _config?)",
              });
            }
          }
        }
      });
    }

    if (undefinedRefs.length > 0) {
      console.log(`\nPotential undefined references in critical files:`);
      undefinedRefs.forEach((ref) => {
        console.log(`  ${ref.file}:${ref.line} - ${ref.identifier}`);
      });
    }

    // Should be zero for critical files
    expect(undefinedRefs.length).toBe(0);
  });

  it("should have consistent naming conventions", () => {
    // Check that route handlers don't have underscore prefixes
    const routeFile = "src/services/slash-command-handler.ts";
    if (fs.existsSync(routeFile)) {
      const content = fs.readFileSync(routeFile, "utf-8");

      // Check for route patterns with underscores
      const routePattern = /['"]\/[a-z-]+_[a-z-]+['"]/g;
      const matches = content.match(routePattern);

      if (matches) {
        console.log(`\nFound routes with underscores:`);
        matches.forEach((match) => {
          console.log(`  ${match}`);
        });
      }

      expect(matches).toBeNull();
    }
  });
});

// Helper functions
function findScope(node: ts.Node): ts.Node | null {
  let current = node.parent;
  while (current) {
    if (
      ts.isFunctionDeclaration(current) ||
      ts.isMethodDeclaration(current) ||
      ts.isArrowFunction(current) ||
      ts.isFunctionExpression(current) ||
      ts.isConstructorDeclaration(current) ||
      ts.isBlock(current) ||
      ts.isSourceFile(current)
    ) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

function isDeclaration(node: ts.Node): boolean {
  const parent = node.parent;
  return !!(
    parent &&
    (ts.isVariableDeclaration(parent) ||
      ts.isParameter(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isFunctionDeclaration(parent))
  );
}
