/**
 * Test suite for Deep Technical Appendix Generator
 * Phase 4 - Enhanced Testing & Validation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fs from "fs/promises";
import * as _path from "path";
import {
  generateDeepAppendix,
  formatAppendixForMarkdown,
  type DeepAppendix,
  type CodeSnippet as _CodeSnippet,
  type APIDoc as _APIDoc,
  type ConfigDetail as _ConfigDetail,
  type TroubleshootingItem as _TroubleshootingItem,
  type PerformanceNote as _PerformanceNote,
  type SecurityItem as _SecurityItem,
} from "../../deep-appendix";
import type { FileInfo } from "../../scanner";

// Mock modules
vi.mock("fs/promises");
vi.mock("../scanner");

describe("DeepAppendix Generator", () => {
  const mockProjectRoot = "/test/project";
  let mockFiles: FileInfo[];

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock files
    mockFiles = [
      {
        path: "src/index.ts",
        language: "typescript",
        size: 2000,
        ast: {
          imports: ["express", "./config", "./routes"],
          exports: ["app", "start"],
          classes: [
            {
              name: "Application",
              methods: [
                "initialize",
                "start",
                "stop",
                "configure",
                "setupRoutes",
                "handleError",
              ],
              properties: [
                "config",
                "server",
                "routes",
                "middleware",
                "database",
              ],
            },
          ],
          functions: [
            {
              name: "createApp",
              async: true,
              params: ["config"],
              returnType: "Promise<Application>",
            },
          ],
          complexity: 15,
        },
      },
      {
        path: "src/utils/auth.ts",
        language: "typescript",
        size: 1500,
        ast: {
          imports: ["jsonwebtoken", "bcrypt"],
          exports: ["authenticate", "authorize"],
          functions: [
            {
              name: "authenticate",
              async: true,
              params: ["token"],
              returnType: "Promise<User>",
            },
            {
              name: "hashPassword",
              async: true,
              params: ["password"],
              returnType: "Promise<string>",
            },
          ],
        },
      },
      {
        path: "src/database/connection.ts",
        language: "typescript",
        size: 3000,
        ast: {
          imports: ["mongoose", "dotenv"],
          exports: ["connect", "disconnect"],
          functions: [
            {
              name: "connect",
              async: true,
              params: ["uri", "options"],
              returnType: "Promise<Connection>",
            },
          ],
        },
      },
    ];
  });

  describe("Code Snippet Extraction", () => {
    it("should extract code snippets from priority files", async () => {
      vi.mocked(fs.readFile).mockResolvedValue(`
import express from 'express';
import { config } from '../../config';

export class Application {
  constructor() {
    this.app = express();
  }
  
  async start() {
    await this.initialize();
    this.app.listen(3000);
  }
}
`);

      const appendix = await generateDeepAppendix({
        files: mockFiles,
        projectRoot: mockProjectRoot,
        options: {
          includeExamples: true,
          maxSnippets: 10,
        },
      });

      expect(appendix.codeSnippets).toHaveLength(expect.any(Number));
      expect(appendix.codeSnippets[0]).toHaveProperty("file");
      expect(appendix.codeSnippets[0]).toHaveProperty("code");
      expect(appendix.codeSnippets[0]).toHaveProperty("language");
      expect(appendix.codeSnippets[0]).toHaveProperty("category");
    });

    it("should identify pattern categories correctly", async () => {
      const appendix = await generateDeepAppendix({
        files: mockFiles,
        projectRoot: mockProjectRoot,
        options: { maxSnippets: 20 },
      });

      const patterns = appendix.codeSnippets.filter(
        (s) => s.category === "pattern",
      );
      const hasComplexClass = mockFiles.some((f) =>
        f.ast?.classes?.some((c) => c.methods.length > 5),
      );

      if (hasComplexClass) {
        expect(patterns.length).toBeGreaterThan(0);
        expect(patterns[0].description).toContain("architectural pattern");
      }
    });

    it("should limit snippets to maxSnippets option", async () => {
      const appendix = await generateDeepAppendix({
        files: mockFiles,
        projectRoot: mockProjectRoot,
        options: { maxSnippets: 2 },
      });

      expect(appendix.codeSnippets.length).toBeLessThanOrEqual(2);
    });
  });

  describe("API Documentation Extraction", () => {
    it("should extract API documentation from classes and functions", async () => {
      const appendix = await generateDeepAppendix({
        files: mockFiles,
        projectRoot: mockProjectRoot,
      });

      expect(appendix.apiDocumentation).toBeDefined();
      expect(appendix.apiDocumentation.length).toBeGreaterThan(0);

      const classDoc = appendix.apiDocumentation.find(
        (d) => d.type === "class",
      );
      expect(classDoc).toBeDefined();
      expect(classDoc?.name).toBe("Application");
      expect(classDoc?.description).toContain("6 methods");

      const funcDoc = appendix.apiDocumentation.find(
        (d) => d.type === "function",
      );
      expect(funcDoc).toBeDefined();
      expect(funcDoc?.signature).toContain("async");
    });

    it("should generate proper signatures", async () => {
      const appendix = await generateDeepAppendix({
        files: mockFiles,
        projectRoot: mockProjectRoot,
      });

      const createAppDoc = appendix.apiDocumentation.find(
        (d) => d.name === "createApp",
      );
      expect(createAppDoc?.signature).toBe(
        "async function createApp(config): Promise<Application>",
      );
      expect(createAppDoc?.parameters).toHaveLength(1);
      expect(createAppDoc?.returns?.type).toBe("Promise<Application>");
    });

    it("should limit API docs to prevent overflow", async () => {
      // Create many mock files with classes
      const manyFiles = Array.from({ length: 100 }, (_, i) => ({
        path: `src/file${i}.ts`,
        language: "typescript",
        ast: {
          classes: [
            {
              name: `Class${i}`,
              methods: ["method1"],
              properties: ["prop1"],
            },
          ],
        },
      })) as FileInfo[];

      const appendix = await generateDeepAppendix({
        files: manyFiles,
        projectRoot: mockProjectRoot,
      });

      expect(appendix.apiDocumentation.length).toBeLessThanOrEqual(30);
    });
  });

  describe("Configuration Details Extraction", () => {
    it("should extract package.json configurations", async () => {
      vi.mocked(fs.readFile).mockImplementation((path) => {
        if (path.toString().includes("package.json")) {
          return Promise.resolve(
            JSON.stringify({
              name: "test-project",
              type: "module",
              engines: {
                node: ">=20.0.0",
                npm: ">=10.0.0",
              },
              scripts: {
                start: "node dist/index.js",
                build: "tsc",
              },
            }),
          );
        }
        return Promise.reject(new Error("File not found"));
      });

      const appendix = await generateDeepAppendix({
        files: [],
        projectRoot: mockProjectRoot,
      });

      expect(appendix.configurationDetails).toBeDefined();

      const engineConfig = appendix.configurationDetails.find(
        (c) => c.setting === "engines",
      );
      expect(engineConfig).toBeDefined();
      expect(engineConfig?.importance).toBe("required");
      expect(engineConfig?.value).toHaveProperty("node");

      const typeConfig = appendix.configurationDetails.find(
        (c) => c.setting === "type",
      );
      expect(typeConfig?.value).toBe("module");
    });

    it("should extract tsconfig.json settings", async () => {
      vi.mocked(fs.readFile).mockImplementation((path) => {
        if (path.toString().includes("tsconfig.json")) {
          return Promise.resolve(
            JSON.stringify({
              compilerOptions: {
                strict: true,
                target: "ES2022",
                module: "commonjs",
                esModuleInterop: true,
              },
            }),
          );
        }
        return Promise.reject(new Error("File not found"));
      });

      const appendix = await generateDeepAppendix({
        files: [],
        projectRoot: mockProjectRoot,
      });

      const strictConfig = appendix.configurationDetails.find(
        (c) => c.setting === "compilerOptions.strict",
      );
      expect(strictConfig?.value).toBe(true);
      expect(strictConfig?.importance).toBe("recommended");

      const targetConfig = appendix.configurationDetails.find(
        (c) => c.setting === "compilerOptions.target",
      );
      expect(targetConfig?.value).toBe("ES2022");
      expect(targetConfig?.importance).toBe("required");
    });

    it("should extract environment variables from .env.example", async () => {
      vi.mocked(fs.readFile).mockImplementation((path) => {
        if (path.toString().includes(".env.example")) {
          return Promise.resolve(`
DATABASE_URL=mongodb://localhost:27017/db
API_KEY=your-api-key-here
JWT_SECRET=your-secret-here
PORT=3000
NODE_ENV=development
REDIS_URL=redis://localhost:6379
`);
        }
        return Promise.reject(new Error("File not found"));
      });

      const appendix = await generateDeepAppendix({
        files: [],
        projectRoot: mockProjectRoot,
      });

      const envVars = appendix.configurationDetails.filter(
        (c) => c.file === ".env.example",
      );

      expect(envVars.length).toBe(5); // Limited to 5
      expect(envVars[0].setting).toBe("DATABASE_URL");
      expect(envVars[0].importance).toBe("required");
    });
  });

  describe("Troubleshooting Guide Generation", () => {
    it("should generate TypeScript troubleshooting for TS projects", async () => {
      const appendix = await generateDeepAppendix({
        files: mockFiles,
        projectRoot: mockProjectRoot,
      });

      const tsTroubleshooting = appendix.troubleshooting.find(
        (item) => item.issue === "TypeScript compilation errors",
      );

      expect(tsTroubleshooting).toBeDefined();
      expect(tsTroubleshooting?.symptoms).toContain(
        "Build fails with type errors",
      );
      expect(tsTroubleshooting?.solutions).toContain(
        expect.stringContaining("npm install @types/"),
      );
      expect(tsTroubleshooting?.preventions).toBeDefined();
    });

    it("should generate monorepo troubleshooting when applicable", async () => {
      const monorepoInfo = {
        type: "pnpm" as const,
        workspaces: [],
        stats: { totalWorkspaces: 5 },
        dependencies: { graph: new Map(), circular: [] },
      };

      const appendix = await generateDeepAppendix({
        files: [],
        monorepo: monorepoInfo,
        projectRoot: mockProjectRoot,
      });

      const monorepoTrouble = appendix.troubleshooting.find(
        (item) => item.issue === "Monorepo workspace linking issues",
      );

      expect(monorepoTrouble).toBeDefined();
      expect(monorepoTrouble?.causes).toContain(
        "Incorrect workspace configuration",
      );
      expect(monorepoTrouble?.solutions).toContain(
        expect.stringContaining("workspace"),
      );
    });

    it("should identify performance issues from large files", async () => {
      const largeFiles: FileInfo[] = [
        { path: "large1.js", size: 150000, language: "javascript" },
        { path: "large2.js", size: 200000, language: "javascript" },
        { path: "large3.js", size: 250000, language: "javascript" },
      ];

      const appendix = await generateDeepAppendix({
        files: largeFiles,
        projectRoot: mockProjectRoot,
      });

      const performanceIssue = appendix.troubleshooting.find(
        (item) => item.issue === "Build performance issues",
      );

      expect(performanceIssue).toBeDefined();
      expect(performanceIssue?.causes).toContain(
        expect.stringContaining("3 files > 100KB"),
      );
      expect(performanceIssue?.solutions).toContain(
        "Split large files into smaller modules",
      );
    });
  });

  describe("Performance Notes Extraction", () => {
    it("should identify file size performance issues", async () => {
      const files: FileInfo[] = [
        { path: "big1.js", size: 150000 },
        { path: "big2.js", size: 200000 },
      ];

      const appendix = await generateDeepAppendix({
        files,
        projectRoot: mockProjectRoot,
      });

      const sizeNote = appendix.performanceNotes.find(
        (note) => note.area === "File Size",
      );

      expect(sizeNote).toBeDefined();
      expect(sizeNote?.observation).toContain("2 files exceed 100KB");
      expect(sizeNote?.impact).toBe("high");
      expect(sizeNote?.optimization).toContain("splitting");
    });

    it("should identify code complexity issues", async () => {
      const complexFiles: FileInfo[] = [
        {
          path: "complex1.ts",
          ast: { complexity: 25 },
        },
        {
          path: "complex2.ts",
          ast: { complexity: 30 },
        },
      ];

      const appendix = await generateDeepAppendix({
        files: complexFiles,
        projectRoot: mockProjectRoot,
      });

      const complexityNote = appendix.performanceNotes.find(
        (note) => note.area === "Code Complexity",
      );

      expect(complexityNote).toBeDefined();
      expect(complexityNote?.observation).toContain(
        "2 files have high cyclomatic complexity",
      );
      expect(complexityNote?.impact).toBe("medium");
    });

    it("should identify dependency chain issues", async () => {
      const files: FileInfo[] = [
        {
          path: "heavy-imports.ts",
          ast: {
            imports: Array.from({ length: 25 }, (_, i) => `module${i}`),
          },
        },
      ];

      const appendix = await generateDeepAppendix({
        files,
        projectRoot: mockProjectRoot,
      });

      const depsNote = appendix.performanceNotes.find(
        (note) => note.area === "Dependencies",
      );

      expect(depsNote).toBeDefined();
      expect(depsNote?.observation).toContain("more than 20 imports");
      expect(depsNote?.optimization).toContain("barrel exports");
    });
  });

  describe("Security Considerations", () => {
    it("should detect environment variable usage", async () => {
      const files: FileInfo[] = [
        {
          path: "config.ts",
          ast: {
            imports: ["dotenv"],
          },
        },
      ];

      const appendix = await generateDeepAppendix({
        files,
        projectRoot: mockProjectRoot,
      });

      const envSecurity = appendix.securityConsiderations.find(
        (item) => item.category === "Environment Variables",
      );

      expect(envSecurity).toBeDefined();
      expect(envSecurity?.risk).toContain("Sensitive data exposure");
      expect(envSecurity?.mitigation).toContain("Never commit .env files");
      expect(envSecurity?.severity).toBe("high");
    });

    it("should detect authentication patterns", async () => {
      const appendix = await generateDeepAppendix({
        files: mockFiles, // Contains auth.ts
        projectRoot: mockProjectRoot,
      });

      const authSecurity = appendix.securityConsiderations.find(
        (item) => item.category === "Authentication",
      );

      expect(authSecurity).toBeDefined();
      expect(authSecurity?.severity).toBe("critical");
      expect(authSecurity?.mitigation).toContain("secure tokens");
    });

    it("should detect database usage", async () => {
      const appendix = await generateDeepAppendix({
        files: mockFiles, // Contains database/connection.ts with mongoose
        projectRoot: mockProjectRoot,
      });

      const dbSecurity = appendix.securityConsiderations.find(
        (item) => item.category === "Database Security",
      );

      expect(dbSecurity).toBeDefined();
      expect(dbSecurity?.risk).toContain("SQL injection");
      expect(dbSecurity?.mitigation).toContain("parameterized queries");
    });

    it("should always include code injection warning", async () => {
      const appendix = await generateDeepAppendix({
        files: [],
        projectRoot: mockProjectRoot,
      });

      const injectionSecurity = appendix.securityConsiderations.find(
        (item) => item.category === "Code Injection",
      );

      expect(injectionSecurity).toBeDefined();
      expect(injectionSecurity?.severity).toBe("critical");
      expect(injectionSecurity?.risk).toContain("eval()");
    });
  });

  describe("Section Generation", () => {
    it("should generate architecture section when patterns exist", async () => {
      const appendix = await generateDeepAppendix({
        files: mockFiles,
        projectRoot: mockProjectRoot,
      });

      const archSection = appendix.sections.find(
        (s) => s.title === "Architecture Patterns",
      );

      expect(archSection).toBeDefined();
      expect(archSection?.priority).toBe("high");
      expect(archSection?.content).toContain("architectural patterns");
    });

    it("should generate security section with proper priority", async () => {
      const appendix = await generateDeepAppendix({
        files: mockFiles,
        projectRoot: mockProjectRoot,
      });

      const securitySection = appendix.sections.find(
        (s) => s.title === "Security Considerations",
      );

      expect(securitySection).toBeDefined();
      expect(securitySection?.priority).toBe("critical");
    });

    it("should respect focus areas option", async () => {
      const appendix = await generateDeepAppendix({
        files: mockFiles,
        projectRoot: mockProjectRoot,
        options: {
          focusAreas: ["security", "performance"],
        },
      });

      const hasSecuritySection = appendix.sections.some(
        (s) => s.title === "Security Considerations",
      );
      const hasPerformanceSection = appendix.sections.some(
        (s) => s.title === "Performance Optimization",
      );

      expect(hasSecuritySection || hasPerformanceSection).toBe(true);
    });
  });

  describe("Markdown Formatting", () => {
    it("should format appendix for markdown correctly", async () => {
      const appendix: DeepAppendix = {
        sections: [
          {
            title: "Test Section",
            content: "Test content",
            priority: "high",
          },
        ],
        codeSnippets: [
          {
            file: "test.ts",
            title: "Test Snippet",
            description: "A test snippet",
            code: "const test = true;",
            language: "typescript",
            category: "example",
          },
        ],
        apiDocumentation: [],
        configurationDetails: [],
        troubleshooting: [],
        performanceNotes: [],
        securityConsiderations: [],
      };

      const markdown = formatAppendixForMarkdown(appendix);

      expect(markdown).toContain("## Deep Technical Appendix");
      expect(markdown).toContain("### Test Section");
      expect(markdown).toContain("Test content");
      expect(markdown).toContain("### Code Examples");
      expect(markdown).toContain("```typescript");
      expect(markdown).toContain("const test = true;");
    });

    it("should order sections by priority", async () => {
      const appendix: DeepAppendix = {
        sections: [
          { title: "Low Priority", content: "Low", priority: "low" },
          { title: "Critical", content: "Critical", priority: "critical" },
          { title: "High Priority", content: "High", priority: "high" },
          { title: "Medium Priority", content: "Medium", priority: "medium" },
        ],
        codeSnippets: [],
        apiDocumentation: [],
        configurationDetails: [],
        troubleshooting: [],
        performanceNotes: [],
        securityConsiderations: [],
      };

      const markdown = formatAppendixForMarkdown(appendix);

      const criticalIndex = markdown.indexOf("### Critical");
      const highIndex = markdown.indexOf("### High Priority");
      const mediumIndex = markdown.indexOf("### Medium Priority");
      const lowIndex = markdown.indexOf("### Low Priority");

      expect(criticalIndex).toBeLessThan(highIndex);
      expect(highIndex).toBeLessThan(mediumIndex);
      expect(mediumIndex).toBeLessThan(lowIndex);
    });

    it("should limit code examples to prevent overflow", async () => {
      const manySnippets = Array.from({ length: 20 }, (_, i) => ({
        file: `file${i}.ts`,
        title: `Snippet ${i}`,
        description: `Description ${i}`,
        code: `const var${i} = ${i};`,
        language: "typescript",
        category: "example" as const,
      }));

      const appendix: DeepAppendix = {
        sections: [],
        codeSnippets: manySnippets,
        apiDocumentation: [],
        configurationDetails: [],
        troubleshooting: [],
        performanceNotes: [],
        securityConsiderations: [],
      };

      const markdown = formatAppendixForMarkdown(appendix);

      // Should only include first 5 snippets
      expect(markdown.match(/#### Snippet/g)?.length).toBe(5);
    });
  });
});
