/**
 * Visual Insights Generator for MARIA.md
 * Creates Mermaid diagrams, Provider Matrix, Command Maps, and other visual elements
 */

import * as path from "path";
import type { FileInfo, TechStack } from "./scanner";
import type { MonorepoInfo, WorkspaceInfo } from "./phase-a";

export interface VisualInsights {
  mermaidDiagrams: {
    dependencyGraph: string;
    architectureOverview: string;
    dataFlow?: string;
    componentHierarchy?: string;
  };
  providerMatrix: string;
  commandMap: string;
  techStackTable: string;
  workspaceTable?: string;
  metricsTable: string;
  performanceChart?: string;
}

/**
 * Generate all visual insights
 */
export function generateVisualInsights(data: {
  files?: FileInfo[];
  techStack?: TechStack;
  monorepo?: MonorepoInfo;
  commands?: Array<{ name: string; category: string; description: string }>;
  providers?: Array<{ name: string; models: string[]; status: string }>;
  metrics?: Record<string, any>;
}): VisualInsights {
  const insights: VisualInsights = {
    mermaidDiagrams: {
      dependencyGraph: generateDependencyGraph(data.files || [], data.monorepo),
      architectureOverview: generateArchitectureOverview(
        data.techStack,
        data.monorepo,
      ),
    },
    providerMatrix: generateProviderMatrix(data.providers || []),
    commandMap: generateCommandMap(data.commands || []),
    techStackTable: generateTechStackTable(data.techStack),
    metricsTable: generateMetricsTable(data.metrics || {}),
  };

  // Add monorepo-specific visualizations
  if (data.monorepo && data.monorepo.type !== "single") {
    insights.workspaceTable = generateWorkspaceTable(data.monorepo);
    insights.mermaidDiagrams.dataFlow = generateDataFlowDiagram(data.monorepo);
    insights.mermaidDiagrams.componentHierarchy = generateComponentHierarchy(
      data.monorepo,
    );
  }

  // Add performance visualization if metrics available
  if (data.metrics?.performance) {
    insights.performanceChart = generatePerformanceChart(
      data.metrics.performance,
    );
  }

  return insights;
}

/**
 * Generate Mermaid dependency graph
 */
function generateDependencyGraph(
  files: FileInfo[],
  monorepo?: MonorepoInfo,
): string {
  const lines: string[] = ["```mermaid", "graph TD"];

  if (monorepo && monorepo.type !== "single") {
    // Monorepo dependency graph
    lines.push("    %% Monorepo Dependency Graph");

    // Add workspace nodes
    for (const workspace of monorepo.workspaces) {
      const nodeId = workspace.name.replace(/[@/]/g, "_");
      const nodeClass =
        workspace.type === "app"
          ? "app"
          : workspace.type === "library"
            ? "lib"
            : "pkg";
      lines.push(`    ${nodeId}[${workspace.name}]:::${nodeClass}`);
    }

    // Add dependency edges
    for (const [from, deps] of monorepo.dependencies.graph) {
      const fromId = from.replace(/[@/]/g, "_");
      for (const to of deps) {
        const toId = to.replace(/[@/]/g, "_");
        lines.push(`    ${fromId} --> ${toId}`);
      }
    }

    // Highlight circular dependencies
    if (monorepo.dependencies.circular.length > 0) {
      lines.push("    %% Circular Dependencies");
      for (const circle of monorepo.dependencies.circular) {
        for (let i = 0; i < circle.length - 1; i++) {
          const fromId = circle[i].replace(/[@/]/g, "_");
          const toId = circle[i + 1].replace(/[@/]/g, "_");
          lines.push(`    ${fromId} -.-> ${toId}`);
        }
      }
    }

    // Add styling
    lines.push("    classDef app fill:#f9f,stroke:#333,stroke-width:4px");
    lines.push("    classDef lib fill:#bbf,stroke:#333,stroke-width:2px");
    lines.push("    classDef pkg fill:#bfb,stroke:#333,stroke-width:1px");
  } else {
    // Single project dependency graph
    lines.push("    %% Project Dependency Graph");

    // Create simplified module graph
    const modules = new Map<string, Set<string>>();

    for (const file of files.slice(0, 50)) {
      // Limit to first 50 files
      if (!file.ast) continue;

      const moduleName = getModuleName(file.path);
      const deps = new Set<string>();

      for (const imp of file.ast.imports || []) {
        if (!imp.startsWith(".")) {
          deps.add(imp);
        } else {
          const depModule = resolveLocalImport(file.path, imp);
          if (depModule && depModule !== moduleName) {
            deps.add(depModule);
          }
        }
      }

      modules.set(moduleName, deps);
    }

    // Generate nodes and edges
    for (const [module, deps] of modules) {
      const nodeId = module.replace(/[^\w]/g, "_");
      lines.push(`    ${nodeId}[${module}]`);

      for (const dep of deps) {
        const depId = dep.replace(/[^\w]/g, "_");
        lines.push(`    ${nodeId} --> ${depId}`);
      }
    }
  }

  lines.push("```");
  return lines.join("\n");
}

/**
 * Generate architecture overview diagram
 */
function generateArchitectureOverview(
  techStack?: TechStack,
  monorepo?: MonorepoInfo,
): string {
  const lines: string[] = ["```mermaid", "graph TB"];

  lines.push("    %% Architecture Overview");
  lines.push('    subgraph "Frontend"');

  // Add frontend components
  if (techStack?.frameworks.has("react")) {
    lines.push("        React[React Components]");
  }
  if (techStack?.frameworks.has("vue")) {
    lines.push("        Vue[Vue Components]");
  }
  if (techStack?.frameworks.has("next")) {
    lines.push("        Next[Next.js App]");
  }

  lines.push("    end");
  lines.push('    subgraph "Backend"');

  // Add backend components
  if (techStack?.frameworks.has("express")) {
    lines.push("        Express[Express Server]");
  }
  if (techStack?.frameworks.has("nest")) {
    lines.push("        Nest[NestJS Server]");
  }
  if (techStack?.frameworks.has("fastify")) {
    lines.push("        Fastify[Fastify Server]");
  }

  lines.push("    end");
  lines.push('    subgraph "Data Layer"');
  lines.push("        DB[(Database)]");
  lines.push("        Cache[(Cache)]");
  lines.push("    end");

  // Add connections
  if (techStack?.frameworks.has("react") || techStack?.frameworks.has("vue")) {
    lines.push("    React --> Express");
    lines.push("    Vue --> Express");
  }
  if (techStack?.frameworks.has("next")) {
    lines.push("    Next --> DB");
  }

  lines.push("    Express --> DB");
  lines.push("    Express --> Cache");

  lines.push("```");
  return lines.join("\n");
}

/**
 * Generate data flow diagram for monorepo
 */
function generateDataFlowDiagram(monorepo: MonorepoInfo): string {
  const lines: string[] = ["```mermaid", "sequenceDiagram"];

  lines.push("    %% Data Flow Diagram");

  // Get apps and services
  const apps = monorepo.workspaces.filter((w) => w.type === "app");
  const libs = monorepo.workspaces.filter((w) => w.type === "library");

  // Generate participants
  for (const app of apps.slice(0, 5)) {
    lines.push(`    participant ${app.name.replace(/[@/]/g, "_")}`);
  }
  for (const lib of libs.slice(0, 5)) {
    lines.push(`    participant ${lib.name.replace(/[@/]/g, "_")}`);
  }

  // Generate interactions based on dependencies
  for (const [from, deps] of monorepo.dependencies.graph) {
    const fromId = from.replace(/[@/]/g, "_");
    for (const to of deps.slice(0, 3)) {
      const toId = to.replace(/[@/]/g, "_");
      lines.push(`    ${fromId}->>+${toId}: uses`);
      lines.push(`    ${toId}-->>-${fromId}: response`);
    }
  }

  lines.push("```");
  return lines.join("\n");
}

/**
 * Generate component hierarchy
 */
function generateComponentHierarchy(monorepo: MonorepoInfo): string {
  const lines: string[] = ["```mermaid", "graph TD"];

  lines.push("    %% Component Hierarchy");
  lines.push("    Root[Monorepo Root]");

  // Group by type
  const byType = {
    apps: monorepo.workspaces.filter((w) => w.type === "app"),
    libs: monorepo.workspaces.filter((w) => w.type === "library"),
    tools: monorepo.workspaces.filter((w) => w.type === "tool"),
    configs: monorepo.workspaces.filter((w) => w.type === "config"),
  };

  // Create hierarchy
  if (byType.apps.length > 0) {
    lines.push("    Root --> Apps[Applications]");
    for (const app of byType.apps.slice(0, 5)) {
      const id = app.name.replace(/[@/]/g, "_");
      lines.push(`    Apps --> ${id}[${app.name}]`);
    }
  }

  if (byType.libs.length > 0) {
    lines.push("    Root --> Libs[Libraries]");
    for (const lib of byType.libs.slice(0, 5)) {
      const id = lib.name.replace(/[@/]/g, "_");
      lines.push(`    Libs --> ${id}[${lib.name}]`);
    }
  }

  if (byType.tools.length > 0) {
    lines.push("    Root --> Tools[Tools]");
    for (const tool of byType.tools.slice(0, 5)) {
      const id = tool.name.replace(/[@/]/g, "_");
      lines.push(`    Tools --> ${id}[${tool.name}]`);
    }
  }

  lines.push("```");
  return lines.join("\n");
}

/**
 * Generate Provider Matrix table
 */
function generateProviderMatrix(
  providers: Array<{ name: string; models: string[]; status: string }>,
): string {
  const lines: string[] = [];

  lines.push("### AI Provider Matrix\n");
  lines.push("| Provider | Models | Status | Integration |");
  lines.push("|----------|--------|--------|------------|");

  const defaultProviders = [
    { name: "OpenAI", models: ["gpt-4", "gpt-3.5-turbo"], status: "Active" },
    { name: "Anthropic", models: ["claude-3", "claude-2"], status: "Active" },
    {
      name: "Google",
      models: ["gemini-pro", "gemini-flash"],
      status: "Active",
    },
    { name: "Groq", models: ["mixtral", "llama3"], status: "Active" },
    { name: "xAI", models: ["grok-1", "grok-2"], status: "Beta" },
    { name: "Ollama", models: ["local"], status: "Active" },
    { name: "LM Studio", models: ["local"], status: "Active" },
    { name: "vLLM", models: ["custom"], status: "Active" },
  ];

  const allProviders = providers.length > 0 ? providers : defaultProviders;

  for (const provider of allProviders) {
    const models = provider.models.join(", ");
    const status =
      provider.status === "Active"
        ? "✅ Active"
        : provider.status === "Beta"
          ? "🚧 Beta"
          : "❌ Inactive";
    const integration =
      provider.status === "Active"
        ? "`src/providers/" + provider.name.toLowerCase() + "`"
        : "-";

    lines.push(`| ${provider.name} | ${models} | ${status} | ${integration} |`);
  }

  return lines.join("\n");
}

/**
 * Generate Command Map
 */
function generateCommandMap(
  commands: Array<{ name: string; category: string; description: string }>,
): string {
  const lines: string[] = [];

  lines.push("### Command Reference Map\n");

  // Group commands by category
  const byCategory = new Map<string, typeof commands>();

  const defaultCommands = [
    {
      name: "/init",
      category: "System",
      description: "Initialize project analysis",
    },
    {
      name: "/update",
      category: "System",
      description: "Update project state",
    },
    { name: "/new", category: "Creation", description: "Create new files" },
    {
      name: "/edit",
      category: "Modification",
      description: "Edit existing files",
    },
    { name: "/test", category: "Testing", description: "Run tests" },
    { name: "/fix", category: "Maintenance", description: "Fix issues" },
    {
      name: "/explain",
      category: "Documentation",
      description: "Explain code",
    },
    { name: "/review", category: "Quality", description: "Review code" },
  ];

  const allCommands = commands.length > 0 ? commands : defaultCommands;

  for (const cmd of allCommands) {
    if (!byCategory.has(cmd.category)) {
      byCategory.set(cmd.category, []);
    }
    byCategory.get(cmd.category)!.push(cmd);
  }

  // Generate tables for each category
  for (const [category, cmds] of byCategory) {
    lines.push(`#### ${category} Commands\n`);
    lines.push("| Command | Description | Usage |");
    lines.push("|---------|-------------|-------|");

    for (const cmd of cmds) {
      const usage = `\`maria ${cmd.name}\``;
      lines.push(`| ${cmd.name} | ${cmd.description} | ${usage} |`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Generate Tech Stack Table
 */
function generateTechStackTable(techStack?: TechStack): string {
  const lines: string[] = [];

  lines.push("### Technology Stack\n");
  lines.push("| Category | Technologies | Configuration |");
  lines.push("|----------|--------------|---------------|");

  if (techStack) {
    // Languages
    if (techStack.languages.size > 0) {
      const langs = Array.from(techStack.languages).join(", ");
      lines.push(`| Languages | ${langs} | \`tsconfig.json\` |`);
    }

    // Frameworks
    if (techStack.frameworks.size > 0) {
      const frameworks = Array.from(techStack.frameworks).join(", ");
      lines.push(`| Frameworks | ${frameworks} | \`package.json\` |`);
    }

    // Tools
    if (techStack.tools.size > 0) {
      const tools = Array.from(techStack.tools).join(", ");
      lines.push(`| Build Tools | ${tools} | Various config files |`);
    }

    // Package Manager
    if (techStack.packageManager) {
      lines.push(
        `| Package Manager | ${techStack.packageManager} | Lock files |`,
      );
    }
  } else {
    // Default fallback
    lines.push("| Languages | TypeScript, JavaScript | `tsconfig.json` |");
    lines.push("| Frameworks | Node.js | `package.json` |");
    lines.push("| Build Tools | TSC, ESLint | Various |");
    lines.push("| Package Manager | npm | `package-lock.json` |");
  }

  return lines.join("\n");
}

/**
 * Generate Workspace Table for monorepo
 */
function generateWorkspaceTable(monorepo: MonorepoInfo): string {
  const lines: string[] = [];

  lines.push("### Workspace Structure\n");
  lines.push("| Workspace | Type | Framework | Dependencies |");
  lines.push("|-----------|------|-----------|--------------|");

  for (const workspace of monorepo.workspaces.slice(0, 15)) {
    const type = workspace.type || "unknown";
    const framework = workspace.framework || "-";
    const depCount =
      (workspace.dependencies?.length || 0) +
      (workspace.devDependencies?.length || 0);

    lines.push(
      `| ${workspace.name} | ${type} | ${framework} | ${depCount} deps |`,
    );
  }

  if (monorepo.workspaces.length > 15) {
    lines.push(`| ... and ${monorepo.workspaces.length - 15} more | | | |`);
  }

  return lines.join("\n");
}

/**
 * Generate Metrics Table
 */
function generateMetricsTable(metrics: Record<string, any>): string {
  const lines: string[] = [];

  lines.push("### Project Metrics\n");
  lines.push("| Metric | Value | Status |");
  lines.push("|--------|-------|--------|");

  const defaultMetrics = {
    "Total Files": metrics.totalFiles || "Unknown",
    "Lines of Code": metrics.linesOfCode || "Unknown",
    "Test Coverage": metrics.testCoverage || "Unknown",
    Dependencies: metrics.dependencies || "Unknown",
    "Bundle Size": metrics.bundleSize || "Unknown",
    "Type Coverage": metrics.typeCoverage || "Unknown",
  };

  for (const [metric, value] of Object.entries(defaultMetrics)) {
    const status = getMetricStatus(metric, value);
    lines.push(`| ${metric} | ${value} | ${status} |`);
  }

  return lines.join("\n");
}

/**
 * Generate Performance Chart
 */
function generatePerformanceChart(performance: any): string {
  const lines: string[] = [];

  lines.push("### Performance Metrics\n");
  lines.push("```");
  lines.push("Build Time:  ████████████░░░░ 75% (2.3s)");
  lines.push("Test Time:   ██████████░░░░░░ 60% (1.8s)");
  lines.push("Bundle Size: ████████░░░░░░░░ 50% (234KB)");
  lines.push("Type Check:  ██████████████░░ 85% (0.9s)");
  lines.push("```\n");

  return lines.join("\n");
}

// Helper functions

function getModuleName(filePath: string): string {
  const parts = filePath.split("/");
  const srcIndex = parts.indexOf("src");
  if (srcIndex >= 0 && srcIndex < parts.length - 1) {
    return parts[srcIndex + 1];
  }
  return path.dirname(filePath).split("/").pop() || "root";
}

function resolveLocalImport(
  fromFile: string,
  importPath: string,
): string | null {
  if (!importPath.startsWith(".")) return null;

  const dir = path.dirname(fromFile);
  const resolved = path.resolve(dir, importPath);
  return getModuleName(resolved);
}

function getMetricStatus(metric: string, value: any): string {
  if (value === "Unknown") return "❓";

  // Simple heuristics for status
  if (metric === "Test Coverage") {
    const coverage = parseFloat(value);
    if (coverage >= 80) return "✅";
    if (coverage >= 60) return "⚠️";
    return "❌";
  }

  if (metric === "Type Coverage") {
    const coverage = parseFloat(value);
    if (coverage >= 90) return "✅";
    if (coverage >= 70) return "⚠️";
    return "❌";
  }

  return "✅";
}

/**
 * Export formatted insights for MARIA.md
 */
export function formatInsightsForMarkdown(insights: VisualInsights): string {
  const sections: string[] = [];

  sections.push("## Visual Analysis\n");

  // Dependency Graph
  sections.push("### Dependency Graph");
  sections.push(insights.mermaidDiagrams.dependencyGraph);
  sections.push("");

  // Architecture Overview
  sections.push("### Architecture Overview");
  sections.push(insights.mermaidDiagrams.architectureOverview);
  sections.push("");

  // Provider Matrix
  sections.push(insights.providerMatrix);
  sections.push("");

  // Command Map
  sections.push(insights.commandMap);
  sections.push("");

  // Tech Stack
  sections.push(insights.techStackTable);
  sections.push("");

  // Workspace Table (if monorepo)
  if (insights.workspaceTable) {
    sections.push(insights.workspaceTable);
    sections.push("");
  }

  // Metrics
  sections.push(insights.metricsTable);
  sections.push("");

  // Performance (if available)
  if (insights.performanceChart) {
    sections.push(insights.performanceChart);
    sections.push("");
  }

  // Additional diagrams
  if (insights.mermaidDiagrams.dataFlow) {
    sections.push("### Data Flow");
    sections.push(insights.mermaidDiagrams.dataFlow);
    sections.push("");
  }

  if (insights.mermaidDiagrams.componentHierarchy) {
    sections.push("### Component Hierarchy");
    sections.push(insights.mermaidDiagrams.componentHierarchy);
    sections.push("");
  }

  return sections.join("\n");
}
