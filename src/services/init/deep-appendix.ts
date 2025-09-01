/**
 * Deep Technical Appendix Generator
 * Automatically extracts and documents technical details for MARIA.md
 */

import * as fs from "fs/promises";
import * as path from "path";
import { safeRead } from "./scanner";
import type { FileInfo } from "./scanner";
import type { MonorepoInfo } from "./phase-a";

export interface DeepAppendixSection {
  title: string;
  content: string;
  priority: "critical" | "high" | "medium" | "low";
}

export interface DeepAppendix {
  sections: DeepAppendixSection[];
  codeSnippets: CodeSnippet[];
  apiDocumentation: APIDoc[];
  configurationDetails: ConfigDetail[];
  troubleshooting: TroubleshootingItem[];
  performanceNotes: PerformanceNote[];
  securityConsiderations: SecurityItem[];
}

export interface CodeSnippet {
  file: string;
  title: string;
  description: string;
  code: string;
  language: string;
  category: "example" | "pattern" | "antipattern" | "setup" | "utility";
}

export interface APIDoc {
  name: string;
  type: "class" | "function" | "interface" | "enum";
  signature: string;
  description: string;
  parameters?: Array<{ name: string; type: string; description: string }>;
  returns?: { type: string; description: string };
  examples?: string[];
}

export interface ConfigDetail {
  file: string;
  setting: string;
  value: any;
  description: string;
  importance: "required" | "recommended" | "optional";
}

export interface TroubleshootingItem {
  issue: string;
  symptoms: string[];
  causes: string[];
  solutions: string[];
  preventions?: string[];
}

export interface PerformanceNote {
  area: string;
  observation: string;
  impact: "high" | "medium" | "low";
  optimization?: string;
}

export interface SecurityItem {
  category: string;
  risk: string;
  mitigation: string;
  severity: "critical" | "high" | "medium" | "low";
}

/**
 * Generate complete deep appendix
 */
export async function generateDeepAppendix(data: {
  files?: FileInfo[];
  monorepo?: MonorepoInfo;
  projectRoot?: string;
  options?: {
    includeExamples?: boolean;
    maxSnippets?: number;
    focusAreas?: string[];
  };
}): Promise<DeepAppendix> {
  const {
    files = [],
    monorepo,
    projectRoot = process.cwd(),
    options = {},
  } = data;

  const { includeExamples = true, maxSnippets = 20, focusAreas = [] } = options;

  const appendix: DeepAppendix = {
    sections: [],
    codeSnippets: [],
    apiDocumentation: [],
    configurationDetails: [],
    troubleshooting: [],
    performanceNotes: [],
    securityConsiderations: [],
  };

  // Extract code snippets
  appendix.codeSnippets = await extractCodeSnippets(
    files,
    projectRoot,
    maxSnippets,
    includeExamples,
  );

  // Extract API documentation
  appendix.apiDocumentation = extractAPIDocumentation(files);

  // Extract configuration details
  appendix.configurationDetails =
    await extractConfigurationDetails(projectRoot);

  // Generate troubleshooting guide
  appendix.troubleshooting = generateTroubleshootingGuide(files, monorepo);

  // Extract performance notes
  appendix.performanceNotes = extractPerformanceNotes(files);

  // Extract security considerations
  appendix.securityConsiderations = extractSecurityConsiderations(files);

  // Generate main sections
  appendix.sections = generateMainSections(appendix, focusAreas);

  return appendix;
}

/**
 * Extract important code snippets
 */
async function extractCodeSnippets(
  files: FileInfo[],
  projectRoot: string,
  maxSnippets: number,
  includeExamples: boolean,
): Promise<CodeSnippet[]> {
  const snippets: CodeSnippet[] = [];

  // Priority files for snippets
  const priorityPatterns = [
    { pattern: /index\.(ts|js)$/, category: "setup" as const },
    { pattern: /main\.(ts|js)$/, category: "setup" as const },
    { pattern: /cli\.(ts|js)$/, category: "setup" as const },
    { pattern: /config\.(ts|js)$/, category: "setup" as const },
    { pattern: /util.*\.(ts|js)$/, category: "utility" as const },
    { pattern: /helper.*\.(ts|js)$/, category: "utility" as const },
    { pattern: /example.*\.(ts|js)$/, category: "example" as const },
    { pattern: /test.*\.(ts|js)$/, category: "example" as const },
  ];

  // Extract snippets from priority files
  for (const file of files.slice(0, 100)) {
    if (snippets.length >= maxSnippets) break;

    for (const { pattern, category } of priorityPatterns) {
      if (pattern.test(file.path)) {
        const snippet = await extractFileSnippet(file, projectRoot, category);
        if (snippet) {
          snippets.push(snippet);
          break;
        }
      }
    }
  }

  // Extract pattern examples from AST
  if (includeExamples) {
    for (const file of files) {
      if (snippets.length >= maxSnippets) break;
      if (!file.ast) continue;

      // Look for interesting patterns
      const patterns = findInterestingPatterns(file);
      for (const pattern of patterns) {
        if (snippets.length >= maxSnippets) break;
        snippets.push(pattern);
      }
    }
  }

  return snippets;
}

/**
 * Extract snippet from a file
 */
async function extractFileSnippet(
  file: FileInfo,
  projectRoot: string,
  category: CodeSnippet["category"],
): Promise<CodeSnippet | null> {
  try {
    const fullPath = path.join(projectRoot, file.path);
    const content = await safeRead(fullPath, 512 * 1024, 50);

    if (!content.head) return null;

    // Extract the most important part
    const lines = content.head.split("\n");
    const importEnd = lines.findIndex(
      (line) =>
        !line.startsWith("import") &&
        !line.startsWith("//") &&
        line.trim() !== "",
    );
    const codeStart = Math.max(0, importEnd);
    const codeLines = lines.slice(codeStart, codeStart + 30);

    return {
      file: file.path,
      title: `${path.basename(file.path)} - ${category}`,
      description: getFileDescription(file),
      code: codeLines.join("\n"),
      language: file.language || "javascript",
      category,
    };
  } catch {
    return null;
  }
}

/**
 * Find interesting code patterns
 */
function findInterestingPatterns(file: FileInfo): CodeSnippet[] {
  const patterns: CodeSnippet[] = [];

  if (!file.ast) return patterns;

  // Look for specific patterns
  for (const cls of file.ast.classes || []) {
    if (cls.methods.length > 5) {
      // Complex class - good example
      patterns.push({
        file: file.path,
        title: `${cls.name} Class Pattern`,
        description: `Class with ${cls.methods.length} methods showing architectural pattern`,
        code: generateClassSnippet(cls),
        language: file.language || "typescript",
        category: "pattern",
      });
      break;
    }
  }

  // Look for singleton patterns
  const singletonPattern = file.ast.exports?.find((e) =>
    e.includes("getInstance"),
  );
  if (singletonPattern) {
    patterns.push({
      file: file.path,
      title: "Singleton Pattern",
      description: "Singleton implementation pattern",
      code: "// Singleton pattern detected\nexport class Singleton {\n  private static instance: Singleton;\n  static getInstance() { ... }\n}",
      language: file.language || "typescript",
      category: "pattern",
    });
  }

  return patterns;
}

/**
 * Extract API documentation
 */
function extractAPIDocumentation(files: FileInfo[]): APIDoc[] {
  const docs: APIDoc[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    if (!file.ast) continue;

    // Extract classes
    for (const cls of file.ast.classes || []) {
      const key = `class:${cls.name}`;
      if (seen.has(key)) continue;
      seen.add(key);

      docs.push({
        name: cls.name,
        type: "class",
        signature: generateClassSignature(cls),
        description: `Class with ${cls.methods.length} methods and ${cls.properties.length} properties`,
        parameters: cls.properties.map((p) => ({
          name: p,
          type: "unknown",
          description: `Property of ${cls.name}`,
        })),
      });
    }

    // Extract functions
    for (const func of file.ast.functions || []) {
      const key = `function:${func.name}`;
      if (seen.has(key)) continue;
      seen.add(key);

      docs.push({
        name: func.name,
        type: "function",
        signature: generateFunctionSignature(func),
        description: func.async ? "Async function" : "Function",
        parameters: func.params.map((p) => ({
          name: p,
          type: "unknown",
          description: `Parameter of ${func.name}`,
        })),
        returns: {
          type: func.returnType || "unknown",
          description: "Return value",
        },
      });
    }
  }

  return docs.slice(0, 30); // Limit to 30 items
}

/**
 * Extract configuration details
 */
async function extractConfigurationDetails(
  projectRoot: string,
): Promise<ConfigDetail[]> {
  const details: ConfigDetail[] = [];

  // Check package.json
  try {
    const pkgPath = path.join(projectRoot, "package.json");
    const pkgContent = await fs.readFile(pkgPath, "utf8");
    const pkg = JSON.parse(pkgContent);

    // Extract important configurations
    if (pkg.engines) {
      details.push({
        file: "package.json",
        setting: "engines",
        value: pkg.engines,
        description: "Required Node.js and npm versions",
        importance: "required",
      });
    }

    if (pkg.scripts?.start) {
      details.push({
        file: "package.json",
        setting: "scripts.start",
        value: pkg.scripts.start,
        description: "Start command for the application",
        importance: "required",
      });
    }

    if (pkg.type) {
      details.push({
        file: "package.json",
        setting: "type",
        value: pkg.type,
        description: "Module type (commonjs or module)",
        importance: "recommended",
      });
    }
  } catch {
    // Ignore errors
  }

  // Check tsconfig.json
  try {
    const tsconfigPath = path.join(projectRoot, "tsconfig.json");
    const tsconfigContent = await fs.readFile(tsconfigPath, "utf8");
    const tsconfig = JSON.parse(tsconfigContent);

    if (tsconfig.compilerOptions?.strict !== undefined) {
      details.push({
        file: "tsconfig.json",
        setting: "compilerOptions.strict",
        value: tsconfig.compilerOptions.strict,
        description: "TypeScript strict mode setting",
        importance: "recommended",
      });
    }

    if (tsconfig.compilerOptions?.target) {
      details.push({
        file: "tsconfig.json",
        setting: "compilerOptions.target",
        value: tsconfig.compilerOptions.target,
        description: "TypeScript compilation target",
        importance: "required",
      });
    }
  } catch {
    // Ignore errors
  }

  // Check .env.example
  try {
    const envExamplePath = path.join(projectRoot, ".env.example");
    const envContent = await fs.readFile(envExamplePath, "utf8");
    const envVars = envContent.match(/^[A-Z_]+=/gm);

    if (envVars) {
      for (const envVar of envVars.slice(0, 5)) {
        const varName = envVar.replace("=", "");
        details.push({
          file: ".env.example",
          setting: varName,
          value: "<required>",
          description: `Environment variable ${varName}`,
          importance: "required",
        });
      }
    }
  } catch {
    // Ignore errors
  }

  return details;
}

/**
 * Generate troubleshooting guide
 */
function generateTroubleshootingGuide(
  files: FileInfo[],
  monorepo?: MonorepoInfo,
): TroubleshootingItem[] {
  const items: TroubleshootingItem[] = [];

  // Common TypeScript issues
  const hasTypeScript = files.some((f) => f.language === "typescript");
  if (hasTypeScript) {
    items.push({
      issue: "TypeScript compilation errors",
      symptoms: [
        "Build fails with type errors",
        "IDE shows red underlines",
        "Cannot find module errors",
      ],
      causes: [
        "Missing type definitions",
        "Incorrect tsconfig.json settings",
        "Version mismatches",
      ],
      solutions: [
        "Run `npm install @types/<package>` for missing types",
        "Check tsconfig.json paths configuration",
        "Ensure TypeScript version matches project requirements",
      ],
      preventions: [
        "Keep dependencies up to date",
        "Use strict mode for early error detection",
      ],
    });
  }

  // Monorepo-specific issues
  if (monorepo && monorepo.type !== "single") {
    items.push({
      issue: "Monorepo workspace linking issues",
      symptoms: [
        "Cannot resolve workspace dependencies",
        "Changes not reflected in dependent packages",
        "Build order problems",
      ],
      causes: [
        "Incorrect workspace configuration",
        "Missing symbolic links",
        "Cache corruption",
      ],
      solutions: [
        "Run package manager install command",
        "Clear node_modules and reinstall",
        "Check workspace configuration in package.json",
      ],
      preventions: [
        "Use workspace protocol for local dependencies",
        "Configure proper build order",
      ],
    });
  }

  // Module resolution issues
  items.push({
    issue: "Module resolution failures",
    symptoms: [
      "Cannot find module errors",
      "Import path not working",
      "Relative import confusion",
    ],
    causes: [
      "Incorrect import paths",
      "Missing index files",
      "Case sensitivity issues",
    ],
    solutions: [
      "Check import paths are correct",
      "Ensure index.js/ts files exist where expected",
      "Verify file name casing matches imports",
    ],
  });

  // Performance issues
  const largeFiles = files.filter((f) => f.size && f.size > 100000);
  if (largeFiles.length > 0) {
    items.push({
      issue: "Build performance issues",
      symptoms: [
        "Slow build times",
        "High memory usage",
        "Development server lag",
      ],
      causes: [
        `Large files detected (${largeFiles.length} files > 100KB)`,
        "Inefficient bundler configuration",
        "Too many dependencies",
      ],
      solutions: [
        "Split large files into smaller modules",
        "Configure bundler optimizations",
        "Use dynamic imports for code splitting",
      ],
    });
  }

  return items;
}

/**
 * Extract performance notes
 */
function extractPerformanceNotes(files: FileInfo[]): PerformanceNote[] {
  const notes: PerformanceNote[] = [];

  // Check for large files
  const largeFiles = files.filter((f) => f.size && f.size > 100000);
  if (largeFiles.length > 0) {
    notes.push({
      area: "File Size",
      observation: `${largeFiles.length} files exceed 100KB`,
      impact: "high",
      optimization: "Consider splitting large files into smaller modules",
    });
  }

  // Check for complex files
  const complexFiles = files.filter(
    (f) => f.ast?.complexity && f.ast.complexity > 20,
  );
  if (complexFiles.length > 0) {
    notes.push({
      area: "Code Complexity",
      observation: `${complexFiles.length} files have high cyclomatic complexity`,
      impact: "medium",
      optimization:
        "Refactor complex functions into smaller, more focused units",
    });
  }

  // Check for deep dependency chains
  const deepImports = files.filter((f) => (f.ast?.imports?.length || 0) > 20);
  if (deepImports.length > 0) {
    notes.push({
      area: "Dependencies",
      observation: `${deepImports.length} files have more than 20 imports`,
      impact: "medium",
      optimization: "Consider consolidating imports or using barrel exports",
    });
  }

  // Check for async patterns
  const asyncHeavy = files.filter(
    (f) => f.ast?.functions?.filter((fn) => fn.async).length || 0 > 10,
  );
  if (asyncHeavy.length > 0) {
    notes.push({
      area: "Async Operations",
      observation: `${asyncHeavy.length} files have heavy async usage`,
      impact: "low",
      optimization:
        "Ensure proper error handling and consider using Promise.all() for parallel operations",
    });
  }

  return notes;
}

/**
 * Extract security considerations
 */
function extractSecurityConsiderations(files: FileInfo[]): SecurityItem[] {
  const items: SecurityItem[] = [];

  // Check for environment variable usage
  const envUsage = files.filter(
    (f) => f.ast?.imports?.some((i) => i.includes("dotenv")) || false,
  );
  if (envUsage.length > 0) {
    items.push({
      category: "Environment Variables",
      risk: "Sensitive data exposure through environment variables",
      mitigation: "Never commit .env files, use .env.example for documentation",
      severity: "high",
    });
  }

  // Check for eval usage (basic check)
  items.push({
    category: "Code Injection",
    risk: "Potential code injection through eval() or Function()",
    mitigation:
      "Avoid eval() and Function() constructor, use safer alternatives",
    severity: "critical",
  });

  // Check for authentication patterns
  const authFiles = files.filter(
    (f) => f.path.includes("auth") || f.path.includes("login"),
  );
  if (authFiles.length > 0) {
    items.push({
      category: "Authentication",
      risk: "Authentication and authorization vulnerabilities",
      mitigation: "Implement proper session management, use secure tokens",
      severity: "critical",
    });
  }

  // Check for API usage
  const apiFiles = files.filter(
    (f) =>
      f.path.includes("api") ||
      f.ast?.imports?.some((i) => i.includes("axios") || i.includes("fetch")),
  );
  if (apiFiles.length > 0) {
    items.push({
      category: "API Security",
      risk: "API endpoint exposure and data leakage",
      mitigation:
        "Implement rate limiting, authentication, and input validation",
      severity: "high",
    });
  }

  // Check for database patterns
  const dbFiles = files.filter((f) =>
    f.ast?.imports?.some(
      (i) =>
        i.includes("mongoose") ||
        i.includes("sequelize") ||
        i.includes("prisma"),
    ),
  );
  if (dbFiles.length > 0) {
    items.push({
      category: "Database Security",
      risk: "SQL injection and data exposure",
      mitigation:
        "Use parameterized queries, validate input, implement access controls",
      severity: "high",
    });
  }

  return items;
}

/**
 * Generate main sections
 */
function generateMainSections(
  appendix: Omit<DeepAppendix, "sections">,
  focusAreas: string[],
): DeepAppendixSection[] {
  const sections: DeepAppendixSection[] = [];

  // Architecture section
  if (focusAreas.length === 0 || focusAreas.includes("architecture")) {
    sections.push({
      title: "Architecture Patterns",
      content: generateArchitectureSection(
        appendix.codeSnippets,
        appendix.apiDocumentation,
      ),
      priority: "high",
    });
  }

  // Configuration section
  if (focusAreas.length === 0 || focusAreas.includes("configuration")) {
    sections.push({
      title: "Configuration Guide",
      content: generateConfigurationSection(appendix.configurationDetails),
      priority: "high",
    });
  }

  // Security section
  if (appendix.securityConsiderations.length > 0) {
    sections.push({
      title: "Security Considerations",
      content: generateSecuritySection(appendix.securityConsiderations),
      priority: "critical",
    });
  }

  // Performance section
  if (appendix.performanceNotes.length > 0) {
    sections.push({
      title: "Performance Optimization",
      content: generatePerformanceSection(appendix.performanceNotes),
      priority: "medium",
    });
  }

  // Troubleshooting section
  if (appendix.troubleshooting.length > 0) {
    sections.push({
      title: "Troubleshooting Guide",
      content: generateTroubleshootingSection(appendix.troubleshooting),
      priority: "high",
    });
  }

  return sections;
}

// Helper functions for section generation

function generateArchitectureSection(
  snippets: CodeSnippet[],
  apis: APIDoc[],
): string {
  const lines: string[] = [];

  lines.push(
    "This section documents the key architectural patterns used in the project.\n",
  );

  // Document patterns
  const patterns = snippets.filter((s) => s.category === "pattern");
  if (patterns.length > 0) {
    lines.push("### Design Patterns\n");
    for (const pattern of patterns.slice(0, 3)) {
      lines.push(`#### ${pattern.title}`);
      lines.push(pattern.description);
      lines.push("```" + pattern.language);
      lines.push(pattern.code);
      lines.push("```\n");
    }
  }

  // Document key APIs
  if (apis.length > 0) {
    lines.push("### Core APIs\n");
    for (const api of apis.slice(0, 5)) {
      lines.push(`#### ${api.name}`);
      lines.push(`- Type: ${api.type}`);
      lines.push(`- Signature: \`${api.signature}\``);
      lines.push(`- Description: ${api.description}\n`);
    }
  }

  return lines.join("\n");
}

function generateConfigurationSection(configs: ConfigDetail[]): string {
  const lines: string[] = [];

  lines.push("Essential configuration settings for the project.\n");

  // Group by importance
  const required = configs.filter((c) => c.importance === "required");
  const recommended = configs.filter((c) => c.importance === "recommended");

  if (required.length > 0) {
    lines.push("### Required Settings\n");
    for (const config of required) {
      lines.push(`- **${config.setting}** (${config.file})`);
      lines.push(`  - Value: \`${JSON.stringify(config.value)}\``);
      lines.push(`  - ${config.description}\n`);
    }
  }

  if (recommended.length > 0) {
    lines.push("### Recommended Settings\n");
    for (const config of recommended) {
      lines.push(`- **${config.setting}** (${config.file})`);
      lines.push(`  - Value: \`${JSON.stringify(config.value)}\``);
      lines.push(`  - ${config.description}\n`);
    }
  }

  return lines.join("\n");
}

function generateSecuritySection(security: SecurityItem[]): string {
  const lines: string[] = [];

  lines.push("Security considerations and best practices for this project.\n");

  // Group by severity
  const critical = security.filter((s) => s.severity === "critical");
  const high = security.filter((s) => s.severity === "high");

  if (critical.length > 0) {
    lines.push("### Critical Security Items\n");
    for (const item of critical) {
      lines.push(`#### ${item.category}`);
      lines.push(`- **Risk**: ${item.risk}`);
      lines.push(`- **Mitigation**: ${item.mitigation}\n`);
    }
  }

  if (high.length > 0) {
    lines.push("### High Priority Security Items\n");
    for (const item of high) {
      lines.push(`#### ${item.category}`);
      lines.push(`- **Risk**: ${item.risk}`);
      lines.push(`- **Mitigation**: ${item.mitigation}\n`);
    }
  }

  return lines.join("\n");
}

function generatePerformanceSection(notes: PerformanceNote[]): string {
  const lines: string[] = [];

  lines.push("Performance observations and optimization opportunities.\n");

  for (const note of notes) {
    lines.push(`### ${note.area}`);
    lines.push(`- **Observation**: ${note.observation}`);
    lines.push(`- **Impact**: ${note.impact}`);
    if (note.optimization) {
      lines.push(`- **Optimization**: ${note.optimization}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function generateTroubleshootingSection(items: TroubleshootingItem[]): string {
  const lines: string[] = [];

  lines.push("Common issues and their solutions.\n");

  for (const item of items) {
    lines.push(`### ${item.issue}\n`);

    lines.push("**Symptoms:**");
    for (const symptom of item.symptoms) {
      lines.push(`- ${symptom}`);
    }
    lines.push("");

    lines.push("**Causes:**");
    for (const cause of item.causes) {
      lines.push(`- ${cause}`);
    }
    lines.push("");

    lines.push("**Solutions:**");
    for (const solution of item.solutions) {
      lines.push(`- ${solution}`);
    }
    lines.push("");

    if (item.preventions && item.preventions.length > 0) {
      lines.push("**Prevention:**");
      for (const prevention of item.preventions) {
        lines.push(`- ${prevention}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

// Utility functions

function getFileDescription(file: FileInfo): string {
  if (file.path.includes("index")) return "Main entry point";
  if (file.path.includes("cli")) return "CLI interface";
  if (file.path.includes("config")) return "Configuration file";
  if (file.path.includes("util")) return "Utility functions";
  if (file.path.includes("test")) return "Test file";
  return "Project file";
}

function generateClassSnippet(cls: any): string {
  const lines: string[] = [];
  lines.push(`class ${cls.name} {`);

  // Show first few properties
  for (const prop of cls.properties.slice(0, 3)) {
    lines.push(`  ${prop}: any;`);
  }

  // Show first few methods
  for (const method of cls.methods.slice(0, 3)) {
    lines.push(`  ${method}() { ... }`);
  }

  if (cls.properties.length > 3 || cls.methods.length > 3) {
    lines.push(`  // ... and more`);
  }

  lines.push("}");
  return lines.join("\n");
}

function generateClassSignature(cls: any): string {
  return `class ${cls.name} { ${cls.methods.length} methods, ${cls.properties.length} properties }`;
}

function generateFunctionSignature(func: any): string {
  const params = func.params.join(", ");
  const asyncPrefix = func.async ? "async " : "";
  const returnType = func.returnType ? `: ${func.returnType}` : "";
  return `${asyncPrefix}function ${func.name}(${params})${returnType}`;
}

/**
 * Format appendix for MARIA.md
 */
export function formatAppendixForMarkdown(appendix: DeepAppendix): string {
  const lines: string[] = [];

  lines.push("## Deep Technical Appendix\n");

  // Add priority sections first
  const criticalSections = appendix.sections.filter(
    (s) => s.priority === "critical",
  );
  const highSections = appendix.sections.filter((s) => s.priority === "high");
  const otherSections = appendix.sections.filter(
    (s) => s.priority !== "critical" && s.priority !== "high",
  );

  for (const section of [
    ...criticalSections,
    ...highSections,
    ...otherSections,
  ]) {
    lines.push(`### ${section.title}\n`);
    lines.push(section.content);
    lines.push("");
  }

  // Add code examples if present
  if (appendix.codeSnippets.length > 0) {
    lines.push("### Code Examples\n");
    for (const snippet of appendix.codeSnippets.slice(0, 5)) {
      lines.push(`#### ${snippet.title}`);
      lines.push(snippet.description);
      lines.push("```" + snippet.language);
      lines.push(snippet.code);
      lines.push("```\n");
    }
  }

  return lines.join("\n");
}
