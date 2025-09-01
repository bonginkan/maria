/**
 * Phase-A: High Priority Inventory Scanner for Monorepo Support
 * Quickly inventories monorepo structure and workspace relationships
 */

import * as fs from "fs/promises";
import * as path from "path";
import { globby } from "globby";
import { safeRead } from "./scanner";
import type { InitOptions } from "./types";

export interface WorkspaceInfo {
  name: string;
  path: string;
  version?: string;
  private?: boolean;
  scripts?: Record<string, string>;
  dependencies?: string[];
  devDependencies?: string[];
  workspaceDependencies?: string[];
  type?: "app" | "library" | "tool" | "config" | "unknown";
  language?: "typescript" | "javascript" | "mixed" | "unknown";
  framework?: string;
  size?: "small" | "medium" | "large";
  entryPoint?: string;
}

export interface MonorepoInfo {
  type: "npm" | "yarn" | "pnpm" | "lerna" | "nx" | "rush" | "turbo" | "single";
  root: string;
  packageManager?: string;
  workspaces: WorkspaceInfo[];
  structure: {
    apps: string[];
    packages: string[];
    libs: string[];
    tools: string[];
    configs: string[];
  };
  dependencies: {
    graph: Map<string, string[]>;
    circular: string[][];
    external: Set<string>;
  };
  stats: {
    totalWorkspaces: number;
    totalDependencies: number;
    maxDepth: number;
    totalFiles: number;
    totalLinesOfCode?: number;
  };
}

export interface PhaseAResult {
  monorepo: MonorepoInfo;
  priority: {
    critical: string[]; // Must scan first
    high: string[]; // Important packages
    medium: string[]; // Regular packages
    low: string[]; // Can be skipped if budget low
  };
  recommendations: string[];
  scanTime: number;
}

/**
 * Detect monorepo type and structure
 */
async function detectMonorepoType(root: string): Promise<MonorepoInfo["type"]> {
  try {
    // Check for various monorepo indicators
    const files = await fs.readdir(root);

    // Check package.json for workspaces
    if (files.includes("package.json")) {
      const pkg = JSON.parse(
        await fs.readFile(path.join(root, "package.json"), "utf8"),
      );
      if (pkg.workspaces) {
        // Detect package manager
        if (files.includes("pnpm-workspace.yaml")) return "pnpm";
        if (files.includes("yarn.lock")) return "yarn";
        return "npm";
      }
    }

    // Check for specific monorepo tools
    if (files.includes("nx.json")) return "nx";
    if (files.includes("lerna.json")) return "lerna";
    if (files.includes("rush.json")) return "rush";
    if (files.includes("turbo.json")) return "turbo";
    if (files.includes("pnpm-workspace.yaml")) return "pnpm";

    return "single";
  } catch {
    return "single";
  }
}

/**
 * Find all workspace packages
 */
async function findWorkspaces(
  root: string,
  type: MonorepoInfo["type"],
): Promise<string[]> {
  const workspacePaths: string[] = [];

  try {
    switch (type) {
      case "pnpm": {
        // Read pnpm-workspace.yaml
        const wsFile = path.join(root, "pnpm-workspace.yaml");
        try {
          const content = await fs.readFile(wsFile, "utf8");
          const patterns = content.match(/packages:\s*\n((?:\s+-\s+.+\n?)+)/);
          if (patterns) {
            const workspacePatterns = patterns[1]
              .split("\n")
              .map((line) => line.replace(/^\s*-\s*['"]?(.+?)['"]?\s*$/, "$1"))
              .filter(Boolean);

            for (const pattern of workspacePatterns) {
              const paths = await globby(pattern, {
                cwd: root,
                onlyDirectories: true,
                deep: 2,
              });
              workspacePaths.push(...paths);
            }
          }
        } catch {
          // Fallback to common patterns
        }
        break;
      }

      case "yarn":
      case "npm": {
        // Read package.json workspaces field
        const pkgPath = path.join(root, "package.json");
        try {
          const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8"));
          const patterns = Array.isArray(pkg.workspaces)
            ? pkg.workspaces
            : pkg.workspaces?.packages || [];

          for (const pattern of patterns) {
            const paths = await globby(pattern, {
              cwd: root,
              onlyDirectories: true,
              deep: 2,
            });
            workspacePaths.push(...paths);
          }
        } catch {
          // Fallback
        }
        break;
      }

      case "lerna": {
        // Read lerna.json
        try {
          const lernaPath = path.join(root, "lerna.json");
          const lerna = JSON.parse(await fs.readFile(lernaPath, "utf8"));
          const patterns = lerna.packages || ["packages/*"];

          for (const pattern of patterns) {
            const paths = await globby(pattern, {
              cwd: root,
              onlyDirectories: true,
              deep: 2,
            });
            workspacePaths.push(...paths);
          }
        } catch {
          // Fallback
        }
        break;
      }

      case "nx": {
        // Nx uses apps/ and libs/ by default
        const nxPatterns = ["apps/*", "libs/*", "packages/*"];
        for (const pattern of nxPatterns) {
          const paths = await globby(pattern, {
            cwd: root,
            onlyDirectories: true,
            deep: 1,
          });
          workspacePaths.push(...paths);
        }
        break;
      }

      default:
        // Fallback to common patterns
        break;
    }

    // If no workspaces found, try common patterns
    if (workspacePaths.length === 0) {
      const commonPatterns = [
        "packages/*",
        "apps/*",
        "libs/*",
        "services/*",
        "plugins/*",
        "tools/*",
      ];

      for (const pattern of commonPatterns) {
        const paths = await globby(pattern, {
          cwd: root,
          onlyDirectories: true,
          deep: 1,
          ignore: ["node_modules", ".git", "dist", "build"],
        });
        workspacePaths.push(...paths);
      }
    }
  } catch (error) {
    console.error("Error finding workspaces:", error);
  }

  return [...new Set(workspacePaths)];
}

/**
 * Analyze individual workspace
 */
async function analyzeWorkspace(
  workspacePath: string,
  root: string,
): Promise<WorkspaceInfo> {
  const info: WorkspaceInfo = {
    name: path.basename(workspacePath),
    path: workspacePath,
    type: "unknown",
    language: "unknown",
  };

  try {
    // Read package.json
    const pkgPath = path.join(root, workspacePath, "package.json");
    const pkgContent = await safeRead(pkgPath, 512 * 1024, 1000);

    if (pkgContent.head) {
      try {
        const pkg = JSON.parse(pkgContent.head);
        info.name = pkg.name || info.name;
        info.version = pkg.version;
        info.private = pkg.private;
        info.scripts = pkg.scripts;
        info.dependencies = pkg.dependencies
          ? Object.keys(pkg.dependencies)
          : [];
        info.devDependencies = pkg.devDependencies
          ? Object.keys(pkg.devDependencies)
          : [];

        // Detect workspace dependencies (local packages)
        info.workspaceDependencies = [
          ...(info.dependencies || []),
          ...(info.devDependencies || []),
        ].filter(
          (dep) =>
            dep.startsWith("workspace:") ||
            dep.startsWith("*") ||
            dep.startsWith("^workspace"),
        );

        // Determine type
        if (pkg.bin) {
          info.type = "tool";
        } else if (
          info.name.includes("config") ||
          info.name.includes("eslint") ||
          info.name.includes("prettier")
        ) {
          info.type = "config";
        } else if (pkg.main || pkg.module || pkg.exports) {
          info.type = "library";
        } else if (
          info.scripts?.start ||
          info.scripts?.dev ||
          info.scripts?.serve
        ) {
          info.type = "app";
        }

        // Detect framework
        const deps = [
          ...(info.dependencies || []),
          ...(info.devDependencies || []),
        ];
        if (deps.includes("next")) info.framework = "next";
        else if (deps.includes("react")) info.framework = "react";
        else if (deps.includes("vue")) info.framework = "vue";
        else if (deps.includes("@angular/core")) info.framework = "angular";
        else if (deps.includes("express")) info.framework = "express";
        else if (deps.includes("fastify")) info.framework = "fastify";
        else if (deps.includes("@nestjs/core")) info.framework = "nest";

        // Find entry point
        info.entryPoint =
          pkg.main || pkg.module || (pkg.exports && pkg.exports["."]);
      } catch (e) {
        // JSON parse error
      }
    }

    // Detect language
    const files = await globby(["**/*.{ts,tsx,js,jsx,mjs,cjs}"], {
      cwd: path.join(root, workspacePath),
      deep: 2,
      ignore: ["node_modules", "dist", "build"],
      stats: false,
    });

    const hasTypeScript = files.some(
      (f) => f.endsWith(".ts") || f.endsWith(".tsx"),
    );
    const hasJavaScript = files.some(
      (f) =>
        f.endsWith(".js") ||
        f.endsWith(".jsx") ||
        f.endsWith(".mjs") ||
        f.endsWith(".cjs"),
    );

    if (hasTypeScript && hasJavaScript) {
      info.language = "mixed";
    } else if (hasTypeScript) {
      info.language = "typescript";
    } else if (hasJavaScript) {
      info.language = "javascript";
    }

    // Estimate size
    if (files.length < 10) {
      info.size = "small";
    } else if (files.length < 50) {
      info.size = "medium";
    } else {
      info.size = "large";
    }
  } catch (error) {
    // Silent fail for individual workspace analysis
  }

  return info;
}

/**
 * Build dependency graph
 */
function buildDependencyGraph(
  workspaces: WorkspaceInfo[],
): MonorepoInfo["dependencies"] {
  const graph = new Map<string, string[]>();
  const external = new Set<string>();
  const workspaceNames = new Set(workspaces.map((w) => w.name));

  for (const workspace of workspaces) {
    const deps: string[] = [];

    // Process all dependencies
    const allDeps = [
      ...(workspace.dependencies || []),
      ...(workspace.devDependencies || []),
    ];

    for (const dep of allDeps) {
      if (workspaceNames.has(dep)) {
        deps.push(dep);
      } else if (!dep.startsWith("@types/")) {
        external.add(dep);
      }
    }

    graph.set(workspace.name, deps);
  }

  // Detect circular dependencies
  const circular = detectCircularDependencies(graph);

  return { graph, circular, external };
}

/**
 * Detect circular dependencies
 */
function detectCircularDependencies(graph: Map<string, string[]>): string[][] {
  const circles: string[][] = [];
  const visited = new Set<string>();
  const stack: string[] = [];

  function visit(node: string) {
    if (stack.includes(node)) {
      // Found circular dependency
      const circle = stack.slice(stack.indexOf(node));
      circle.push(node);
      circles.push(circle);
      return;
    }

    if (visited.has(node)) return;

    visited.add(node);
    stack.push(node);

    const deps = graph.get(node) || [];
    for (const dep of deps) {
      visit(dep);
    }

    stack.pop();
  }

  for (const [node] of graph) {
    if (!visited.has(node)) {
      visit(node);
    }
  }

  return circles;
}

/**
 * Calculate workspace priorities
 */
function calculatePriorities(monorepo: MonorepoInfo): PhaseAResult["priority"] {
  const priority = {
    critical: [] as string[],
    high: [] as string[],
    medium: [] as string[],
    low: [] as string[],
  };

  const depCounts = new Map<string, number>();

  // Count how many workspaces depend on each workspace
  for (const [, deps] of monorepo.dependencies.graph) {
    for (const dep of deps) {
      depCounts.set(dep, (depCounts.get(dep) || 0) + 1);
    }
  }

  // Categorize workspaces by priority
  for (const workspace of monorepo.workspaces) {
    const depCount = depCounts.get(workspace.name) || 0;
    const isApp = workspace.type === "app";
    const isTool = workspace.type === "tool";
    const isConfig = workspace.type === "config";
    const isLarge = workspace.size === "large";

    // Critical: Apps and heavily depended upon libraries
    if (isApp || depCount > 5) {
      priority.critical.push(workspace.path);
    }
    // High: Tools, configs, and moderately depended libraries
    else if (isTool || isConfig || depCount > 2 || isLarge) {
      priority.high.push(workspace.path);
    }
    // Medium: Regular libraries with some dependents
    else if (depCount > 0 || workspace.type === "library") {
      priority.medium.push(workspace.path);
    }
    // Low: Isolated packages
    else {
      priority.low.push(workspace.path);
    }
  }

  return priority;
}

/**
 * Generate recommendations
 */
function generateRecommendations(monorepo: MonorepoInfo): string[] {
  const recommendations: string[] = [];

  // Check for circular dependencies
  if (monorepo.dependencies.circular.length > 0) {
    recommendations.push(
      `⚠️ Found ${monorepo.dependencies.circular.length} circular dependencies. Consider refactoring.`,
    );
  }

  // Check for large number of external dependencies
  if (monorepo.dependencies.external.size > 100) {
    recommendations.push(
      `📦 High number of external dependencies (${monorepo.dependencies.external.size}). Consider dependency audit.`,
    );
  }

  // Check for missing workspace types
  const unknownWorkspaces = monorepo.workspaces.filter(
    (w) => w.type === "unknown",
  );
  if (unknownWorkspaces.length > 0) {
    recommendations.push(
      `🔍 ${unknownWorkspaces.length} workspaces have unknown type. Consider adding package.json metadata.`,
    );
  }

  // Check for inconsistent languages
  const languages = new Set(monorepo.workspaces.map((w) => w.language));
  if (languages.size > 2) {
    recommendations.push(
      `🌐 Multiple languages detected. Ensure consistent tooling across workspaces.`,
    );
  }

  // Suggest structure improvements
  if (monorepo.structure.apps.length === 0) {
    recommendations.push(
      `📱 No apps detected. Consider organizing application code in apps/ directory.`,
    );
  }

  if (monorepo.stats.totalWorkspaces > 20 && monorepo.type === "npm") {
    recommendations.push(
      `🚀 Large monorepo with npm. Consider using pnpm or yarn for better performance.`,
    );
  }

  return recommendations;
}

/**
 * Main Phase-A scanner
 */
export async function scanPhaseA(opts: InitOptions): Promise<PhaseAResult> {
  const startTime = Date.now();
  const root = opts.cwd || process.cwd();

  // Detect monorepo type
  const type = await detectMonorepoType(root);

  // Find all workspaces
  const workspacePaths = await findWorkspaces(root, type);

  // Analyze each workspace
  const workspaces = await Promise.all(
    workspacePaths.map((wsPath) => analyzeWorkspace(wsPath, root)),
  );

  // Build dependency graph
  const dependencies = buildDependencyGraph(workspaces);

  // Organize by structure
  const structure = {
    apps: workspaces.filter((w) => w.type === "app").map((w) => w.path),
    packages: workspaces.filter((w) => w.type === "library").map((w) => w.path),
    libs: workspaces.filter((w) => w.type === "library").map((w) => w.path),
    tools: workspaces.filter((w) => w.type === "tool").map((w) => w.path),
    configs: workspaces.filter((w) => w.type === "config").map((w) => w.path),
  };

  // Calculate stats
  const stats = {
    totalWorkspaces: workspaces.length,
    totalDependencies: dependencies.external.size,
    maxDepth: Math.max(
      ...Array.from(dependencies.graph.values()).map((deps) => deps.length),
    ),
    totalFiles: 0, // Will be calculated in Phase-B
  };

  // Detect package manager
  let packageManager = "npm";
  try {
    const files = await fs.readdir(root);
    if (files.includes("pnpm-lock.yaml")) packageManager = "pnpm";
    else if (files.includes("yarn.lock")) packageManager = "yarn";
    else if (files.includes("package-lock.json")) packageManager = "npm";
  } catch {
    // Ignore
  }

  // Build monorepo info
  const monorepo: MonorepoInfo = {
    type,
    root,
    packageManager,
    workspaces,
    structure,
    dependencies,
    stats,
  };

  // Calculate priorities
  const priority = calculatePriorities(monorepo);

  // Generate recommendations
  const recommendations = generateRecommendations(monorepo);

  const scanTime = Date.now() - startTime;

  return {
    monorepo,
    priority,
    recommendations,
    scanTime,
  };
}

/**
 * Quick monorepo check
 */
export async function isMonorepo(root?: string): Promise<boolean> {
  const type = await detectMonorepoType(root || process.cwd());
  return type !== "single";
}

/**
 * Get workspace info for a specific package
 */
export async function getWorkspaceInfo(
  packageName: string,
  root?: string,
): Promise<WorkspaceInfo | null> {
  const scanResult = await scanPhaseA({ cwd: root });
  return (
    scanResult.monorepo.workspaces.find((w) => w.name === packageName) || null
  );
}
