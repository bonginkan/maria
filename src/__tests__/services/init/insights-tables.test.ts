/**
 * Test suite for Visual Insights Generator
 * Phase 4 - Enhanced Testing & Validation
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  generateVisualInsights,
  formatInsightsForMarkdown,
  type VisualInsights,
} from "../../insights-tables";
import type { FileInfo, TechStack } from "../../scanner";
import type { MonorepoInfo, WorkspaceInfo } from "../../phase-a";

describe("Visual Insights Generator", () => {
  let mockFiles: FileInfo[];
  let mockTechStack: TechStack;
  let mockMonorepo: MonorepoInfo;

  beforeEach(() => {
    // Setup mock files
    mockFiles = [
      {
        path: "src/index.ts",
        language: "typescript",
        ast: {
          imports: ["express", "dotenv", "./routes"],
          exports: ["app"],
          classes: [],
          functions: [],
        },
      },
      {
        path: "src/components/Button.tsx",
        language: "typescript",
        ast: {
          imports: ["react"],
          exports: ["Button"],
          classes: [],
          functions: [],
        },
      },
    ];

    // Setup mock tech stack
    mockTechStack = {
      languages: new Set(["typescript", "javascript"]),
      frameworks: new Set(["react", "express", "next"]),
      tools: new Set(["webpack", "babel", "eslint"]),
      packageManager: "pnpm",
      hasTypeScript: true,
      hasTests: true,
      testFrameworks: new Set(["vitest", "jest"]),
    };

    // Setup mock monorepo
    mockMonorepo = {
      type: "pnpm",
      workspaces: [
        {
          name: "@app/web",
          path: "apps/web",
          type: "app",
          framework: "next",
          dependencies: ["@lib/ui", "@lib/utils"],
          devDependencies: ["vitest"],
        },
        {
          name: "@lib/ui",
          path: "packages/ui",
          type: "library",
          framework: "react",
          dependencies: ["react"],
          devDependencies: ["@types/react"],
        },
        {
          name: "@lib/utils",
          path: "packages/utils",
          type: "library",
          dependencies: [],
          devDependencies: ["typescript"],
        },
      ],
      stats: {
        totalWorkspaces: 3,
        apps: 1,
        libraries: 2,
        tools: 0,
        configs: 0,
      },
      dependencies: {
        graph: new Map([
          ["@app/web", ["@lib/ui", "@lib/utils"]],
          ["@lib/ui", []],
          ["@lib/utils", []],
        ]),
        circular: [],
      },
    };
  });

  describe("Mermaid Diagram Generation", () => {
    describe("Dependency Graph", () => {
      it("should generate dependency graph for single project", () => {
        const insights = generateVisualInsights({
          files: mockFiles,
          techStack: mockTechStack,
        });

        expect(insights.mermaidDiagrams.dependencyGraph).toContain(
          "```mermaid",
        );
        expect(insights.mermaidDiagrams.dependencyGraph).toContain("graph TD");
        expect(insights.mermaidDiagrams.dependencyGraph).toContain(
          "Project Dependency Graph",
        );
      });

      it("should generate monorepo dependency graph", () => {
        const insights = generateVisualInsights({
          files: mockFiles,
          monorepo: mockMonorepo,
        });

        expect(insights.mermaidDiagrams.dependencyGraph).toContain(
          "Monorepo Dependency Graph",
        );
        expect(insights.mermaidDiagrams.dependencyGraph).toContain("_app_web");
        expect(insights.mermaidDiagrams.dependencyGraph).toContain("_lib_ui");
        expect(insights.mermaidDiagrams.dependencyGraph).toContain("-->");
        expect(insights.mermaidDiagrams.dependencyGraph).toContain(
          "classDef app",
        );
        expect(insights.mermaidDiagrams.dependencyGraph).toContain(
          "classDef lib",
        );
      });

      it("should highlight circular dependencies when present", () => {
        const monorepoWithCircular = {
          ...mockMonorepo,
          dependencies: {
            ...mockMonorepo.dependencies,
            circular: [["@lib/ui", "@lib/utils", "@lib/ui"]],
          },
        };

        const insights = generateVisualInsights({
          monorepo: monorepoWithCircular,
        });

        expect(insights.mermaidDiagrams.dependencyGraph).toContain(
          "Circular Dependencies",
        );
        expect(insights.mermaidDiagrams.dependencyGraph).toContain("-.->");
      });
    });

    describe("Architecture Overview", () => {
      it("should generate architecture diagram based on tech stack", () => {
        const insights = generateVisualInsights({
          techStack: mockTechStack,
        });

        expect(insights.mermaidDiagrams.architectureOverview).toContain(
          "Architecture Overview",
        );
        expect(insights.mermaidDiagrams.architectureOverview).toContain(
          'subgraph "Frontend"',
        );
        expect(insights.mermaidDiagrams.architectureOverview).toContain(
          "React[React Components]",
        );
        expect(insights.mermaidDiagrams.architectureOverview).toContain(
          "Next[Next.js App]",
        );
        expect(insights.mermaidDiagrams.architectureOverview).toContain(
          'subgraph "Backend"',
        );
        expect(insights.mermaidDiagrams.architectureOverview).toContain(
          "Express[Express Server]",
        );
        expect(insights.mermaidDiagrams.architectureOverview).toContain(
          "DB[(Database)]",
        );
      });

      it("should adapt to different frameworks", () => {
        const vueStack: TechStack = {
          ...mockTechStack,
          frameworks: new Set(["vue", "fastify"]),
        };

        const insights = generateVisualInsights({
          techStack: vueStack,
        });

        expect(insights.mermaidDiagrams.architectureOverview).toContain(
          "Vue[Vue Components]",
        );
        expect(insights.mermaidDiagrams.architectureOverview).toContain(
          "Fastify[Fastify Server]",
        );
      });
    });

    describe("Data Flow Diagram", () => {
      it("should generate data flow for monorepo", () => {
        const insights = generateVisualInsights({
          monorepo: mockMonorepo,
        });

        expect(insights.mermaidDiagrams.dataFlow).toBeDefined();
        expect(insights.mermaidDiagrams.dataFlow).toContain("sequenceDiagram");
        expect(insights.mermaidDiagrams.dataFlow).toContain("participant");
        expect(insights.mermaidDiagrams.dataFlow).toContain("->>+");
        expect(insights.mermaidDiagrams.dataFlow).toContain("-->>-");
      });

      it("should not generate data flow for single projects", () => {
        const insights = generateVisualInsights({
          files: mockFiles,
        });

        expect(insights.mermaidDiagrams.dataFlow).toBeUndefined();
      });
    });

    describe("Component Hierarchy", () => {
      it("should generate hierarchy for monorepo workspaces", () => {
        const insights = generateVisualInsights({
          monorepo: mockMonorepo,
        });

        expect(insights.mermaidDiagrams.componentHierarchy).toBeDefined();
        expect(insights.mermaidDiagrams.componentHierarchy).toContain(
          "Component Hierarchy",
        );
        expect(insights.mermaidDiagrams.componentHierarchy).toContain(
          "Root[Monorepo Root]",
        );
        expect(insights.mermaidDiagrams.componentHierarchy).toContain(
          "Apps[Applications]",
        );
        expect(insights.mermaidDiagrams.componentHierarchy).toContain(
          "Libs[Libraries]",
        );
      });

      it("should handle different workspace types", () => {
        const monorepoWithTools: MonorepoInfo = {
          ...mockMonorepo,
          workspaces: [
            ...mockMonorepo.workspaces,
            {
              name: "@tool/cli",
              path: "tools/cli",
              type: "tool",
            },
          ],
          stats: {
            ...mockMonorepo.stats,
            tools: 1,
          },
        };

        const insights = generateVisualInsights({
          monorepo: monorepoWithTools,
        });

        expect(insights.mermaidDiagrams.componentHierarchy).toContain(
          "Tools[Tools]",
        );
        expect(insights.mermaidDiagrams.componentHierarchy).toContain(
          "_tool_cli",
        );
      });
    });
  });

  describe("Provider Matrix Generation", () => {
    it("should generate default provider matrix when no providers given", () => {
      const insights = generateVisualInsights({});

      expect(insights.providerMatrix).toContain("### AI Provider Matrix");
      expect(insights.providerMatrix).toContain(
        "| Provider | Models | Status | Integration |",
      );
      expect(insights.providerMatrix).toContain("OpenAI");
      expect(insights.providerMatrix).toContain("Anthropic");
      expect(insights.providerMatrix).toContain("Google");
      expect(insights.providerMatrix).toContain("✅ Active");
    });

    it("should use custom providers when provided", () => {
      const customProviders = [
        {
          name: "CustomAI",
          models: ["custom-1", "custom-2"],
          status: "Active",
        },
        { name: "BetaAI", models: ["beta-1"], status: "Beta" },
      ];

      const insights = generateVisualInsights({
        providers: customProviders,
      });

      expect(insights.providerMatrix).toContain("CustomAI");
      expect(insights.providerMatrix).toContain("custom-1, custom-2");
      expect(insights.providerMatrix).toContain("BetaAI");
      expect(insights.providerMatrix).toContain("🚧 Beta");
    });

    it("should show integration paths for active providers", () => {
      const insights = generateVisualInsights({});

      expect(insights.providerMatrix).toContain("`src/providers/openai`");
      expect(insights.providerMatrix).toContain("`src/providers/anthropic`");
    });
  });

  describe("Command Map Generation", () => {
    it("should generate default command map when no commands given", () => {
      const insights = generateVisualInsights({});

      expect(insights.commandMap).toContain("### Command Reference Map");
      expect(insights.commandMap).toContain("#### System Commands");
      expect(insights.commandMap).toContain("/init");
      expect(insights.commandMap).toContain("/update");
      expect(insights.commandMap).toContain(
        "| Command | Description | Usage |",
      );
    });

    it("should organize custom commands by category", () => {
      const customCommands = [
        {
          name: "/custom1",
          category: "Custom",
          description: "Custom command 1",
        },
        {
          name: "/custom2",
          category: "Custom",
          description: "Custom command 2",
        },
        { name: "/other", category: "Other", description: "Other command" },
      ];

      const insights = generateVisualInsights({
        commands: customCommands,
      });

      expect(insights.commandMap).toContain("#### Custom Commands");
      expect(insights.commandMap).toContain("#### Other Commands");
      expect(insights.commandMap).toContain("/custom1");
      expect(insights.commandMap).toContain("/custom2");
      expect(insights.commandMap).toContain("`maria /custom1`");
    });
  });

  describe("Tech Stack Table Generation", () => {
    it("should generate tech stack table from provided data", () => {
      const insights = generateVisualInsights({
        techStack: mockTechStack,
      });

      expect(insights.techStackTable).toContain("### Technology Stack");
      expect(insights.techStackTable).toContain(
        "| Languages | typescript, javascript |",
      );
      expect(insights.techStackTable).toContain(
        "| Frameworks | react, express, next |",
      );
      expect(insights.techStackTable).toContain(
        "| Build Tools | webpack, babel, eslint |",
      );
      expect(insights.techStackTable).toContain("| Package Manager | pnpm |");
    });

    it("should provide default fallback when no tech stack given", () => {
      const insights = generateVisualInsights({});

      expect(insights.techStackTable).toContain(
        "| Languages | TypeScript, JavaScript |",
      );
      expect(insights.techStackTable).toContain("| Frameworks | Node.js |");
    });
  });

  describe("Workspace Table Generation", () => {
    it("should generate workspace table for monorepo", () => {
      const insights = generateVisualInsights({
        monorepo: mockMonorepo,
      });

      expect(insights.workspaceTable).toBeDefined();
      expect(insights.workspaceTable).toContain("### Workspace Structure");
      expect(insights.workspaceTable).toContain("| @app/web | app | next |");
      expect(insights.workspaceTable).toContain(
        "| @lib/ui | library | react |",
      );
      expect(insights.workspaceTable).toContain("deps |");
    });

    it("should limit workspace display to prevent overflow", () => {
      const manyWorkspaces = Array.from({ length: 20 }, (_, i) => ({
        name: `@workspace/pkg${i}`,
        path: `packages/pkg${i}`,
        type: "library" as const,
      }));

      const largeMonorepo: MonorepoInfo = {
        ...mockMonorepo,
        workspaces: manyWorkspaces,
      };

      const insights = generateVisualInsights({
        monorepo: largeMonorepo,
      });

      expect(insights.workspaceTable).toContain("... and 5 more");
      // Should show only first 15
      const matches = insights.workspaceTable?.match(/@workspace/g);
      expect(matches?.length).toBe(15);
    });

    it("should not generate workspace table for single projects", () => {
      const singleProject: MonorepoInfo = {
        type: "single",
        workspaces: [],
        stats: { totalWorkspaces: 0 },
        dependencies: { graph: new Map(), circular: [] },
      };

      const insights = generateVisualInsights({
        monorepo: singleProject,
      });

      expect(insights.workspaceTable).toBeUndefined();
    });
  });

  describe("Metrics Table Generation", () => {
    it("should generate metrics table with provided data", () => {
      const metrics = {
        totalFiles: 150,
        linesOfCode: 25000,
        testCoverage: "85%",
        dependencies: 45,
        bundleSize: "2.3MB",
        typeCoverage: "92%",
      };

      const insights = generateVisualInsights({ metrics });

      expect(insights.metricsTable).toContain("### Project Metrics");
      expect(insights.metricsTable).toContain("| Total Files | 150 |");
      expect(insights.metricsTable).toContain("| Test Coverage | 85% |");
      expect(insights.metricsTable).toContain("✅"); // Good coverage status
    });

    it("should show appropriate status indicators", () => {
      const lowCoverageMetrics = {
        testCoverage: "45%",
        typeCoverage: "60%",
      };

      const insights = generateVisualInsights({ metrics: lowCoverageMetrics });

      expect(insights.metricsTable).toContain("❌"); // Poor test coverage
      expect(insights.metricsTable).toContain("⚠️"); // Warning for type coverage
    });

    it("should handle unknown values gracefully", () => {
      const insights = generateVisualInsights({ metrics: {} });

      expect(insights.metricsTable).toContain("Unknown");
      expect(insights.metricsTable).toContain("❓");
    });
  });

  describe("Performance Chart Generation", () => {
    it("should generate performance chart when metrics available", () => {
      const metrics = {
        performance: {
          buildTime: 2300,
          testTime: 1800,
          bundleSize: 234000,
          typeCheckTime: 900,
        },
      };

      const insights = generateVisualInsights({ metrics });

      expect(insights.performanceChart).toBeDefined();
      expect(insights.performanceChart).toContain("### Performance Metrics");
      expect(insights.performanceChart).toContain("Build Time:");
      expect(insights.performanceChart).toContain("████");
      expect(insights.performanceChart).toContain("75%");
    });

    it("should not generate chart without performance metrics", () => {
      const insights = generateVisualInsights({ metrics: {} });

      expect(insights.performanceChart).toBeUndefined();
    });
  });

  describe("Markdown Formatting", () => {
    it("should format all insights into markdown", () => {
      const insights = generateVisualInsights({
        files: mockFiles,
        techStack: mockTechStack,
        monorepo: mockMonorepo,
      });

      const markdown = formatInsightsForMarkdown(insights);

      expect(markdown).toContain("## Visual Analysis");
      expect(markdown).toContain("### Dependency Graph");
      expect(markdown).toContain("### Architecture Overview");
      expect(markdown).toContain(insights.providerMatrix);
      expect(markdown).toContain(insights.commandMap);
      expect(markdown).toContain(insights.techStackTable);
      expect(markdown).toContain(insights.metricsTable);
    });

    it("should include optional sections when available", () => {
      const insights: VisualInsights = {
        mermaidDiagrams: {
          dependencyGraph: "graph",
          architectureOverview: "arch",
          dataFlow: "flow",
          componentHierarchy: "hierarchy",
        },
        providerMatrix: "providers",
        commandMap: "commands",
        techStackTable: "tech",
        workspaceTable: "workspaces",
        metricsTable: "metrics",
        performanceChart: "performance",
      };

      const markdown = formatInsightsForMarkdown(insights);

      expect(markdown).toContain("### Data Flow");
      expect(markdown).toContain("### Component Hierarchy");
      expect(markdown).toContain("workspaces");
      expect(markdown).toContain("performance");
    });

    it("should maintain proper section ordering", () => {
      const insights = generateVisualInsights({
        monorepo: mockMonorepo,
      });

      const markdown = formatInsightsForMarkdown(insights);

      const sections = [
        "## Visual Analysis",
        "### Dependency Graph",
        "### Architecture Overview",
        "### AI Provider Matrix",
        "### Command Reference Map",
        "### Technology Stack",
      ];

      let lastIndex = -1;
      for (const section of sections) {
        const index = markdown.indexOf(section);
        expect(index).toBeGreaterThan(lastIndex);
        lastIndex = index;
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty inputs gracefully", () => {
      const insights = generateVisualInsights({});

      expect(insights).toBeDefined();
      expect(insights.mermaidDiagrams).toBeDefined();
      expect(insights.providerMatrix).toBeDefined();
      expect(insights.commandMap).toBeDefined();
      expect(insights.techStackTable).toBeDefined();
      expect(insights.metricsTable).toBeDefined();
    });

    it("should handle malformed monorepo data", () => {
      const malformedMonorepo: MonorepoInfo = {
        type: "pnpm",
        workspaces: [],
        stats: { totalWorkspaces: 0 },
        dependencies: {
          graph: new Map(),
          circular: [],
        },
      };

      const insights = generateVisualInsights({
        monorepo: malformedMonorepo,
      });

      expect(insights.mermaidDiagrams.dependencyGraph).toContain(
        "Monorepo Dependency Graph",
      );
      // Should not crash even with empty workspaces
    });

    it("should sanitize special characters in workspace names", () => {
      const specialMonorepo: MonorepoInfo = {
        ...mockMonorepo,
        workspaces: [
          {
            name: "@scope/package-name",
            path: "packages/special",
            type: "library",
          },
        ],
      };

      const insights = generateVisualInsights({
        monorepo: specialMonorepo,
      });

      expect(insights.mermaidDiagrams.dependencyGraph).toContain(
        "_scope_package_name",
      );
      expect(insights.mermaidDiagrams.dependencyGraph).not.toContain("@");
      expect(insights.mermaidDiagrams.dependencyGraph).not.toContain("/");
    });
  });
});
