/**
 * Integration tests for Graph RAG enhanced /init and /update commands
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { InitCommand } from "../../../services/init/init.command";
import { UpdateCommand } from "../../../services/init/update.command";
import { EnhancedScanner } from "../../../services/init/scanner";
import { DeltaDetector } from "../../../services/init/delta-detector";

describe("Graph RAG Init/Update Integration", () => {
  let testDir: string;
  let initCommand: InitCommand;
  let updateCommand: UpdateCommand;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "maria-test-"));

    // Create sample project structure
    await createSampleProject(testDir);

    // Initialize commands
    initCommand = new InitCommand();
    updateCommand = new UpdateCommand();
  });

  afterEach(async () => {
    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("InitCommand", () => {
    it("should analyze project structure", async () => {
      const result = await initCommand.execute({
        root: testDir,
        verbose: false,
        maxDepth: 5,
        parallel: 2,
        budgetMs: 5000,
      });

      expect(result.success).toBe(true);
      expect(result.stats.filesScanned).toBeGreaterThan(0);
      expect(result.artifacts.mariaMd).toBeDefined();
      expect(result.artifacts.depMapJson).toBeDefined();
      expect(result.artifacts.stateJson).toBeDefined();
    });

    it("should create MARIA.md file", async () => {
      await initCommand.execute({
        root: testDir,
        verbose: false,
      });

      const mariaMdPath = path.join(testDir, "MARIA.md");
      const exists = await fileExists(mariaMdPath);
      expect(exists).toBe(true);

      const content = await fs.readFile(mariaMdPath, "utf-8");
      expect(content).toContain("MARIA.md");
      expect(content).toContain("Project Overview");
    });

    it("should create state file", async () => {
      await initCommand.execute({
        root: testDir,
        verbose: false,
      });

      const statePath = path.join(testDir, ".maria", "state.json");
      const exists = await fileExists(statePath);
      expect(exists).toBe(true);

      const stateContent = await fs.readFile(statePath, "utf-8");
      const state = JSON.parse(stateContent);
      expect(state.version).toBe("3.2.2");
      expect(state.root).toBe(testDir);
      expect(state.fileHashes).toBeDefined();
    });
  });

  describe("UpdateCommand", () => {
    it("should detect no changes after init", async () => {
      // First, run init
      await initCommand.execute({ root: testDir, verbose: false });

      // Then run update
      const result = await updateCommand.execute({
        root: testDir,
        since: "state",
        verbose: false,
      });

      expect(result.success).toBe(true);
      expect(result.delta.added).toBe(0);
      expect(result.delta.modified).toBe(0);
      expect(result.delta.deleted).toBe(0);
    });

    it("should detect file changes", async () => {
      // First, run init
      await initCommand.execute({ root: testDir, verbose: false });

      // Modify a file
      const testFile = path.join(testDir, "src", "index.ts");
      await fs.appendFile(testFile, "\n// Modified file\n");

      // Run update
      const result = await updateCommand.execute({
        root: testDir,
        since: "state",
        verbose: false,
      });

      expect(result.success).toBe(true);
      expect(result.delta.modified).toBe(1);
      expect(result.changes.length).toBe(1);
      expect(result.changes[0].type).toBe("modified");
    });

    it("should support dry run mode", async () => {
      // First, run init
      await initCommand.execute({ root: testDir, verbose: false });

      // Modify a file
      const testFile = path.join(testDir, "src", "index.ts");
      await fs.appendFile(testFile, "\n// Modified file\n");

      // Run dry run update
      const result = await updateCommand.execute({
        root: testDir,
        since: "state",
        dryRun: true,
        verbose: false,
      });

      expect(result.success).toBe(true);
      expect(result.delta.modified).toBe(1);
      expect(result.warnings).toContain("Dry run - no changes applied");
    });
  });

  describe("Scanner Integration", () => {
    it("should parse TypeScript files", async () => {
      const scanner = new EnhancedScanner();
      const result = await scanner.scanProject({
        root: testDir,
        maxDepth: 5,
        parallel: 2,
        budgetMs: 5000,
      });

      expect(result.files.length).toBeGreaterThan(0);
      expect(result.techStack).toContain("TypeScript");
      expect(result.hasTypeScript).toBe(true);
    });
  });

  describe("Delta Detection", () => {
    it("should detect git changes", async () => {
      // Initialize git repo
      const { execSync } = await import("child_process");
      execSync("git init", { cwd: testDir, stdio: "pipe" });
      execSync("git add .", { cwd: testDir, stdio: "pipe" });
      execSync('git commit -m "initial"', { cwd: testDir, stdio: "pipe" });

      // Modify file
      const testFile = path.join(testDir, "src", "index.ts");
      await fs.appendFile(testFile, "\n// Git change\n");

      const deltaDetector = new DeltaDetector();
      const result = await deltaDetector.detectDelta(testDir, {
        since: "git:HEAD",
      });

      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files[0].type).toBe("modified");
    });
  });
});

/**
 * Helper function to create a sample project
 */
async function createSampleProject(root: string): Promise<void> {
  // Create directories
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.mkdir(path.join(root, "tests"), { recursive: true });

  // Create package.json
  const packageJson = {
    name: "test-project",
    version: "1.0.0",
    type: "module",
    scripts: {
      dev: "npm run build && node dist/index.js",
      build: "tsc",
      test: "vitest",
    },
    dependencies: {
      express: "^4.18.0",
    },
    devDependencies: {
      typescript: "^5.0.0",
      "@types/node": "^20.0.0",
      vitest: "^1.0.0",
    },
  };
  await fs.writeFile(
    path.join(root, "package.json"),
    JSON.stringify(packageJson, null, 2),
  );

  // Create tsconfig.json
  const tsConfig = {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "node",
      outDir: "./dist",
      rootDir: "./src",
      strict: true,
      esModuleInterop: true,
    },
    include: ["src/**/*"],
    exclude: ["node_modules", "dist"],
  };
  await fs.writeFile(
    path.join(root, "tsconfig.json"),
    JSON.stringify(tsConfig, null, 2),
  );

  // Create source files
  await fs.writeFile(
    path.join(root, "src", "index.ts"),
    `import express from 'express';
import { createServer } from '../../../src/server';

const app = express();
const server = createServer(app);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});
`,
  );

  await fs.writeFile(
    path.join(root, "src", "server.ts"),
    `import express, { Application } from 'express';

export function createServer(app: Application): Application {
  app.get('/', (req, res) => {
    res.json({ message: 'Hello World!' });
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return app;
}

export interface ServerConfig {
  port: number;
  host: string;
}
`,
  );

  // Create test file
  await fs.writeFile(
    path.join(root, "tests", "server.test.ts"),
    `import { describe, it, expect } from 'vitest';
import { createServer } from '../../../src/server';
import express from 'express';

describe('Server', () => {
  it('should create server', () => {
    const app = express();
    const server = createServer(app);
    expect(server).toBeDefined();
  });
});
`,
  );

  // Create README.md
  await fs.writeFile(
    path.join(root, "README.md"),
    `# Test Project

A sample TypeScript/Express project for testing MARIA Graph RAG functionality.

## Quick Start

\`\`\`bash
npm install
npm run dev
\`\`\`

## Testing

\`\`\`bash
npm test
\`\`\`
`,
  );
}

/**
 * Helper function to check if file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
