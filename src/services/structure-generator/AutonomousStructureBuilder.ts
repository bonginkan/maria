/**
 * Autonomous Structure Builder
 * Automatically generates optimal project structure based on intent and best _practices
 */

import * as _fs from "fs/promises";
import * as path from "path";
import {
  UserIntent,
  IntentAnalysisContext,
} from "../intent-engine/IntentAnalyzer";

export interface StructureBlueprint {
  _directories: DirectorySpec[];
  _files: FileSpec[];
  _dependencies: DependencySpec[];
  _metadata: StructureMetadata;
}

export interface DirectorySpec {
  _path: string;
  purpose: string;
  priority: "high" | "medium" | "low";
  permissions?: string;
}

export interface FileSpec {
  _path: string;
  type: "code" | "_config" | "docs" | "test" | "asset";
  _template?: string;
  content?: string;
  _dependencies: string[];
  imports: ImportSpec[];
  exports: ExportSpec[];
}

export interface ImportSpec {
  module: string;
  items: string[];
  type: "named" | "default" | "namespace";
  isLocal: boolean;
}

export interface ExportSpec {
  name: string;
  type: "named" | "default";
  signature?: string;
}

export interface DependencySpec {
  name: string;
  version: string;
  type: "dependency" | "devDependency" | "peerDependency";
  purpose: string;
}

export interface StructureMetadata {
  _architecture:
    | "mvc"
    | "clean"
    | "hexagonal"
    | "feature-based"
    | "domain-driven";
  patterns: string[];
  conventions: ConventionSet;
  estimatedComplexity: "simple" | "moderate" | "complex";
  maintenanceScore: number;
}

export interface ConventionSet {
  naming: "camelCase" | "PascalCase" | "snake_case" | "kebab-case";
  fileStructure: "flat" | "nested" | "feature-based";
  testColocation: boolean;
  indexFiles: boolean;
  barrelExports: boolean;
}

export class AutonomousStructureBuilder {
  private static instance: AutonomousStructureBuilder;
  private templateLibrary: Map<string, StructureTemplate>;
  private patternRules: PatternRule[];
  private bestPractices: Map<string, BestPractice[]>;

  private constructor() {
    this.templateLibrary = new Map();
    this.patternRules = [];
    this.bestPractices = new Map();
    this.initializeTemplates();
    this.initializePatterns();
    this.initializeBestPractices();
  }

  public static getInstance(): AutonomousStructureBuilder {
    if (!AutonomousStructureBuilder.instance) {
      AutonomousStructureBuilder.instance = new AutonomousStructureBuilder();
    }
    return AutonomousStructureBuilder.instance;
  }

  /**
   * Create optimal structure based on user intent
   */
  public async createOptimalStructure(
    intent: UserIntent,
    context: IntentAnalysisContext,
  ): Promise<StructureBlueprint> {
    // Analyze current project state
    const _projectAnalysis = await this.analyzeProject(context);

    // Determine optimal _architecture
    const _architecture = this.determineArchitecture(_intent, _projectAnalysis);

    // Generate directory structure
    const _directories = this.generateDirectories(
      _intent,
      _architecture,
      context,
    );

    // Generate file specifications
    const _files = await this.generateFiles(_intent, _directories, context);

    // Determine _dependencies
    const _dependencies = this.determineDependencies(_intent, _files, context);

    // Create _metadata
    const _metadata = this.createMetadata(
      _architecture,
      _intent,
      _projectAnalysis,
    );

    return {
      _directories,
      _files,
      _dependencies,
      _metadata,
    };
  }

  /**
   * Initialize structure templates
   */
  private initializeTemplates(): void {
    // React Component Template
    this.templateLibrary.set("react-component", {
      _directories: [
        {
          _path: "src/components",
          purpose: "React components",
          priority: "high",
        },
        {
          _path: "src/components/__tests__",
          purpose: "Component tests",
          priority: "medium",
        },
        { _path: "src/types", purpose: "Type definitions", priority: "high" },
      ],
      _files: [
        {
          _path: "src/components/{{name}}.tsx",
          content: this.getReactComponentTemplate(),
          type: "code",
        },
        {
          _path: "src/components/__tests__/{{name}}.test.tsx",
          content: this.getReactTestTemplate(),
          type: "test",
        },
      ],
      _dependencies: ["react", "@types/react"],
      patterns: ["component-driven", "test-colocation"],
    });

    // Express API Template
    this.templateLibrary.set("express-api", {
      _directories: [
        {
          _path: "src/controllers",
          purpose: "API controllers",
          priority: "high",
        },
        { _path: "src/services", purpose: "Business logic", priority: "high" },
        {
          _path: "src/middleware",
          purpose: "Express middleware",
          priority: "medium",
        },
        { _path: "src/routes", purpose: "Route definitions", priority: "high" },
        { _path: "src/types", purpose: "Type definitions", priority: "high" },
        { _path: "src/__tests__", purpose: "API tests", priority: "medium" },
      ],
      _files: [
        {
          _path: "src/controllers/{{name}}.controller.ts",
          content: this.getControllerTemplate(),
          type: "code",
        },
        {
          _path: "src/services/{{name}}.service.ts",
          content: this.getServiceTemplate(),
          type: "code",
        },
        {
          _path: "src/routes/{{name}}.routes.ts",
          content: this.getRoutesTemplate(),
          type: "code",
        },
      ],
      _dependencies: ["express", "@types/express"],
      patterns: ["mvc", "service-layer"],
    });

    // Authentication Feature Template
    this.templateLibrary.set("auth-feature", {
      _directories: [
        {
          _path: "src/features/auth",
          purpose: "Authentication feature",
          priority: "high",
        },
        {
          _path: "src/features/auth/services",
          purpose: "Auth services",
          priority: "high",
        },
        {
          _path: "src/features/auth/types",
          purpose: "Auth types",
          priority: "high",
        },
        {
          _path: "src/features/auth/utils",
          purpose: "Auth utilities",
          priority: "medium",
        },
        {
          _path: "src/features/auth/__tests__",
          purpose: "Auth tests",
          priority: "medium",
        },
      ],
      _files: [
        {
          _path: "src/features/auth/index.ts",
          content: this.getAuthIndexTemplate(),
          type: "code",
        },
        {
          _path: "src/features/auth/services/auth.service.ts",
          content: this.getAuthServiceTemplate(),
          type: "code",
        },
        {
          _path: "src/features/auth/types/auth.types.ts",
          content: this.getAuthTypesTemplate(),
          type: "code",
        },
      ],
      _dependencies: [
        "bcryptjs",
        "jsonwebtoken",
        "@types/bcryptjs",
        "@types/jsonwebtoken",
      ],
      patterns: ["feature-based", "security-first"],
    });

    // TypeScript Library Template
    this.templateLibrary.set("typescript-lib", {
      _directories: [
        { _path: "src", purpose: "Source code", priority: "high" },
        { _path: "src/types", purpose: "Type definitions", priority: "high" },
        {
          _path: "src/utils",
          purpose: "Utility functions",
          priority: "medium",
        },
        { _path: "tests", purpose: "Test _files", priority: "medium" },
        { _path: "docs", purpose: "Documentation", priority: "low" },
      ],
      _files: [
        {
          _path: "src/index.ts",
          content: this.getLibraryIndexTemplate(),
          type: "code",
        },
        {
          _path: "tsconfig.json",
          content: this.getTsConfigTemplate(),
          type: "_config",
        },
      ],
      _dependencies: ["typescript", "@types/node"],
      patterns: ["library", "barrel-exports"],
    });
  }

  /**
   * Initialize pattern rules
   */
  private initializePatterns(): void {
    this.patternRules = [
      {
        name: "feature-based-organization",
        condition: (_intent: UserIntent) => _intent.scope === "feature",
        apply: (_blueprint: StructureBlueprint) => {
          // Organize _files by feature instead of type
          this.reorganizeByFeature(_blueprint);
        },
      },
      {
        name: "test-colocation",
        condition: (_intent: UserIntent, context: IntentAnalysisContext) =>
          context.frameworks.includes("jest") ||
          context.frameworks.includes("vitest"),
        apply: (_blueprint: StructureBlueprint) => {
          // Place test _files near source _files
          this.colocateTests(_blueprint);
        },
      },
      {
        name: "barrel-exports",
        condition: (_intent: UserIntent, _context: IntentAnalysisContext) =>
          _intent.scope === "module" || _intent.scope === "feature",
        apply: (_blueprint: StructureBlueprint) => {
          // Add index _files for clean imports
          this.addBarrelExports(_blueprint);
        },
      },
      {
        name: "clean-_architecture",
        condition: (_intent: UserIntent) => _intent.complexity === "complex",
        apply: (_blueprint: StructureBlueprint) => {
          // Apply clean _architecture layers
          this.applyCleanArchitecture(_blueprint);
        },
      },
    ];
  }

  /**
   * Initialize best _practices
   */
  private initializeBestPractices(): void {
    this.bestPractices.set("typescript", [
      {
        name: "strict-mode",
        description: "Enable strict TypeScript configuration",
        apply: (_files: FileSpec[]) => {
          const _tsConfig = _files.find((f) =>
            f.path.includes("tsconfig.json"),
          );
          if (_tsConfig && _tsConfig.content) {
            const _config = JSON.parse(_tsConfig.content);
            _config.compilerOptions.strict = true;
            _config.compilerOptions.noImplicitAny = true;
            config.compilerOptions.noImplicitReturns = true;
            tsConfig.content = JSON.stringify(_config, null, 2);
          }
        },
      },
      {
        name: "path-mapping",
        description: "Configure path mapping for clean imports",
        apply: (_files: FileSpec[]) => {
          const _tsConfig = _files.find((f) =>
            f.path.includes("tsconfig.json"),
          );
          if (_tsConfig && _tsConfig.content) {
            const _config = JSON.parse(_tsConfig.content);
            _config.compilerOptions.baseUrl = "./src";
            config.compilerOptions.paths = {
              "@/*": ["*"],
              "@/components/*": ["components/*"],
              "@/services/*": ["services/*"],
              "@/utils/*": ["utils/*"],
              "@/types/*": ["types/*"],
            };
            tsConfig.content = JSON.stringify(_config, null, 2);
          }
        },
      },
    ]);

    this.bestPractices.set("react", [
      {
        name: "component-conventions",
        description: "Follow React component conventions",
        apply: (_files: FileSpec[]) => {
          files.forEach((file) => {
            if (
              file._path.includes("components/") &&
              file._path.endsWith(".tsx")
            ) {
              // Add React conventions to component _files
              this.applyReactConventions(file);
            }
          });
        },
      },
    ]);

    this.bestPractices.set("express", [
      {
        name: "security-middleware",
        description: "Add security middleware",
        apply: (_files: FileSpec[]) => {
          // Add security middleware to app.ts
          const _appFile = _files.find(
            (f) => f.path.includes("app.ts") || f.path.includes("server.ts"),
          );
          if (_appFile) {
            this.addSecurityMiddleware(_appFile);
          }
        },
      },
    ]);
  }

  /**
   * Analyze current project state
   */
  private async analyzeProject(
    context: IntentAnalysisContext,
  ): Promise<ProjectAnalysis> {
    const analysis: ProjectAnalysis = {
      size: this.calculateProjectSize(context.existingFiles),
      complexity: this.assessProjectComplexity(context),
      _architecture: this.detectCurrentArchitecture(context),
      techStack: context.frameworks,
      qualityMetrics: await this.calculateQualityMetrics(context),
    };

    return analysis;
  }

  /**
   * Determine optimal _architecture pattern
   */
  private determineArchitecture(
    intent: UserIntent,
    analysis: ProjectAnalysis,
  ): StructureMetadata["_architecture"] {
    // For complex projects, use clean _architecture
    if (_intent.complexity === "complex" || analysis.size === "large") {
      return "clean";
    }

    // For feature-focused projects, use feature-based
    if (_intent.scope === "feature" || _intent.scope === "project") {
      return "feature-based";
    }

    // For API projects, use MVC
    if (
      _intent.target.type === "controller" ||
      _intent.framework === "express"
    ) {
      return "mvc";
    }

    // For domain-heavy projects, use domain-driven
    if (analysis.complexity === "high" && _intent.scope === "project") {
      return "domain-driven";
    }

    // Default to feature-based for most cases
    return "feature-based";
  }

  /**
   * Generate directory structure
   */
  private generateDirectories(
    _intent: UserIntent,
    _architecture: StructureMetadata["_architecture"],
    context: IntentAnalysisContext,
  ): DirectorySpec[] {
    const _directories: DirectorySpec[] = [];

    // Base _directories
    directories.push({
      _path: "src",
      purpose: "Source code",
      priority: "high",
    });

    // Architecture-specific _directories
    switch (_architecture) {
      case "feature-based":
        directories.push(
          {
            _path: "src/features",
            purpose: "Feature modules",
            priority: "high",
          },
          {
            _path: "src/shared",
            purpose: "Shared utilities",
            priority: "medium",
          },
          { _path: "src/types", purpose: "Global types", priority: "high" },
        );
        break;

      case "clean":
        directories.push(
          { _path: "src/domain", purpose: "Domain layer", priority: "high" },
          {
            _path: "src/application",
            purpose: "Application layer",
            priority: "high",
          },
          {
            _path: "src/infrastructure",
            purpose: "Infrastructure layer",
            priority: "high",
          },
          {
            _path: "src/presentation",
            purpose: "Presentation layer",
            priority: "high",
          },
        );
        break;

      case "mvc":
        directories.push(
          {
            _path: "src/controllers",
            purpose: "Controllers",
            priority: "high",
          },
          { _path: "src/models", purpose: "Data models", priority: "high" },
          { _path: "src/views", purpose: "View templates", priority: "medium" },
          {
            _path: "src/services",
            purpose: "Business services",
            priority: "high",
          },
          {
            _path: "src/middleware",
            purpose: "Express middleware",
            priority: "medium",
          },
        );
        break;

      case "domain-driven":
        directories.push(
          { _path: "src/domains", purpose: "Domain modules", priority: "high" },
          { _path: "src/shared", purpose: "Shared kernel", priority: "medium" },
          {
            _path: "src/infrastructure",
            purpose: "Infrastructure",
            priority: "high",
          },
        );
        break;

      case "hexagonal":
        directories.push(
          {
            _path: "src/core",
            purpose: "Core business logic",
            priority: "high",
          },
          { _path: "src/ports", purpose: "Port interfaces", priority: "high" },
          {
            _path: "src/adapters",
            purpose: "Adapter implementations",
            priority: "high",
          },
        );
        break;
    }

    // Framework-specific _directories
    if (context.frameworks.includes("react")) {
      directories.push(
        {
          _path: "src/components",
          purpose: "React components",
          priority: "high",
        },
        { _path: "src/hooks", purpose: "Custom hooks", priority: "medium" },
        {
          _path: "src/contexts",
          purpose: "React contexts",
          priority: "medium",
        },
      );
    }

    // Test _directories
    directories.push({
      _path: "src/__tests__",
      purpose: "Test _files",
      priority: "medium",
    });

    // Documentation
    directories.push({
      _path: "docs",
      purpose: "Documentation",
      priority: "low",
    });

    return _directories;
  }

  /**
   * Generate file specifications
   */
  private async generateFiles(
    intent: UserIntent,
    _directories: DirectorySpec[],
    context: IntentAnalysisContext,
  ): Promise<FileSpec[]> {
    const _files: FileSpec[] = [];

    // Get appropriate _template
    const _template = this.selectTemplate(_intent, context);

    if (_template) {
      // Apply _template _files
      for (const templateFile of _template._files) {
        const file: FileSpec = {
          _path: this.replacePlaceholders(templateFile._path, _intent),
          type: templateFile.type,
          content: this.replacePlaceholders(
            templateFile.content || "",
            _intent,
          ),
          _dependencies: _intent.target.dependencies,
          imports: this.generateImports(templateFile, _intent, context),
          exports: this.generateExports(templateFile, _intent),
        };
        files.push(file);
      }
    } else {
      // Generate custom file
      const _customFile = await this.generateCustomFile(_intent, context);
      files.push(_customFile);
    }

    // Add configuration _files
    _files.push(...this.generateConfigFiles(context));

    // Add index _files for better organization
    files.push(...this.generateIndexFiles(_directories, _intent));

    // Apply best _practices
    this.applyBestPractices(_files, context);

    return _files;
  }

  /**
   * Select appropriate _template
   */
  private selectTemplate(
    intent: UserIntent,
    context: IntentAnalysisContext,
  ): StructureTemplate | null {
    // Map intent to _template
    if (
      _intent.target.type === "component" &&
      context.frameworks.includes("react")
    ) {
      return this.templateLibrary.get("react-component") || null;
    }

    if (
      _intent.target.type === "controller" &&
      context.frameworks.includes("express")
    ) {
      return this.templateLibrary.get("express-api") || null;
    }

    if (_intent.target.name.toLowerCase().includes("auth")) {
      return this.templateLibrary.get("auth-feature") || null;
    }

    if (_intent.scope === "project") {
      return this.templateLibrary.get("typescript-lib") || null;
    }

    return null;
  }

  /**
   * Generate custom file when no _template matches
   */
  private async generateCustomFile(
    intent: UserIntent,
    context: IntentAnalysisContext,
  ): Promise<FileSpec> {
    const _fileName = `${_intent.target.name}.${this.getFileExtension(context)}`;
    const _filePath = `${_intent.target.suggestedPath}/${_fileName}`;

    return {
      _path: _filePath,
      type: "code",
      content: this.generateGenericContent(_intent, context),
      _dependencies: _intent.target.dependencies,
      imports: this.generateBasicImports(_intent, context),
      exports: this.generateBasicExports(_intent),
    };
  }

  /**
   * Get file extension based on context
   */
  private getFileExtension(context: IntentAnalysisContext): string {
    if (context.conventions.fileExtensions.length > 0) {
      return context.conventions.fileExtensions[0];
    }
    return "ts";
  }

  /**
   * Generate basic imports for a file
   */
  private generateImports(
    templateFile: unknown,
    intent: UserIntent,
    context: IntentAnalysisContext,
  ): ImportSpec[] {
    const imports: ImportSpec[] = [];

    // Framework imports
    if (
      context.frameworks.includes("react") &&
      _intent.target.type === "component"
    ) {
      imports.push({
        module: "react",
        items: ["React"],
        type: "named",
        isLocal: false,
      });
    }

    if (
      context.frameworks.includes("express") &&
      _intent.target.type === "controller"
    ) {
      imports.push({
        module: "express",
        items: ["Request", "Response"],
        type: "named",
        isLocal: false,
      });
    }

    // Local imports from related _files
    for (const relatedFile of _intent.target.relatedFiles) {
      const _relativePath = this.getRelativeImportPath(
        templateFile._path,
        relatedFile,
      );
      imports.push({
        module: _relativePath,
        items: ["*"],
        type: "namespace",
        isLocal: true,
      });
    }

    return imports;
  }

  /**
   * Generate basic exports for a file
   */
  private generateExports(
    _templateFile: unknown,
    intent: UserIntent,
  ): ExportSpec[] {
    const exports: ExportSpec[] = [];

    // Default export for main component/service
    exports.push({
      name: _intent.target.name,
      type: "default",
    });

    // Named exports for interfaces
    for (const interfaceName of _intent.target.interfaces) {
      exports.push({
        name: interfaceName,
        type: "named",
      });
    }

    return exports;
  }

  /**
   * Generate basic imports
   */
  private generateBasicImports(
    _intent: UserIntent,
    _context: IntentAnalysisContext,
  ): ImportSpec[] {
    // Implementation would be similar to generateImports but simpler
    return [];
  }

  /**
   * Generate basic exports
   */
  private generateBasicExports(intent: UserIntent): ExportSpec[] {
    return [
      {
        name: _intent.target.name,
        type: "default",
      },
    ];
  }

  /**
   * Generate configuration _files
   */
  private generateConfigFiles(context: IntentAnalysisContext): FileSpec[] {
    const configFiles: FileSpec[] = [];

    // TypeScript configuration
    if (context.projectType.includes("typescript")) {
      configFiles.push({
        _path: "tsconfig.json",
        type: "_config",
        content: this.getTsConfigTemplate(),
        _dependencies: [],
        imports: [],
        exports: [],
      });
    }

    // ESLint configuration
    configFiles.push({
      _path: ".eslintrc.json",
      type: "_config",
      content: this.getEslintConfigTemplate(),
      _dependencies: [],
      imports: [],
      exports: [],
    });

    // Prettier configuration
    configFiles.push({
      _path: ".prettierrc",
      type: "_config",
      content: this.getPrettierConfigTemplate(),
      _dependencies: [],
      imports: [],
      exports: [],
    });

    return configFiles;
  }

  /**
   * Generate index _files for better organization
   */
  private generateIndexFiles(
    _directories: DirectorySpec[],
    _intent: UserIntent,
  ): FileSpec[] {
    const indexFiles: FileSpec[] = [];

    for (const dir of _directories) {
      if (dir.priority === "high" && dir.path.startsWith("src/")) {
        indexFiles.push({
          _path: `${dir.path}/index.ts`,
          type: "code",
          content: this.generateIndexContent(dir),
          _dependencies: [],
          imports: [],
          exports: [],
        });
      }
    }

    return indexFiles;
  }

  // Template methods (simplified versions)
  private getReactComponentTemplate(): string {
    return `import React from 'react';

interface {{name}}Props {
  // Add props here
}

const {{name}}: React.FC<{{name}}Props> = (props) => {
  return (
    <div>
      <h1>{{name}} Component</h1>
    </div>
  );
};

export default {{name}};`;
  }

  private getReactTestTemplate(): string {
    return `import React from 'react';
import { render, screen } from '@testing-library/react';
import {{name}} from '../{{name}}';

describe('{{name}}', () => {
  it('renders correctly', () => {
    render(<{{name}} />);
    expect(screen.getByText('{{name}} Component')).toBeInTheDocument();
  });
});`;
  }

  private getControllerTemplate(): string {
    return `import { Request, Response } from 'express';
import { {{name}}Service } from '../services/{{name}}.service';

export class {{name}}Controller {
  private {{name}}Service: {{name}}Service;

  constructor() {
    this.{{name}}Service = new {{name}}Service();
  }

  public async get{{name}}s(req: Request, res: Response): Promise<void> {
    try {
      const {{name}}s = await this.{{name}}Service.getAll();
      res.json({{name}}s);
    } catch (_error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}`;
  }

  private getServiceTemplate(): string {
    return `export class {{name}}Service {
  constructor() {
    // Initialize service
  }

  public async getAll(): Promise<any[]> {
    // Implementation here
    return [];
  }

  public async getById(id: string): Promise<any | null> {
    // Implementation here
    return null;
  }

  public async create(data: unknown): Promise<any> {
    // Implementation here
    return data;
  }

  public async update(_id: string, data: unknown): Promise<any> {
    // Implementation here
    return data;
  }

  public async delete(id: string): Promise<boolean> {
    // Implementation here
    return true;
  }
}`;
  }

  private getRoutesTemplate(): string {
    return `import { Router } from 'express';
import { {{name}}Controller } from '../controllers/{{name}}.controller';

const _router = Router();
const {{name}}Controller = new {{name}}Controller();

router.get('/{{name}}s', {{name}}Controller.get{{name}}s.bind({{name}}Controller));

export default router;`;
  }

  private getAuthIndexTemplate(): string {
    return `export { AuthService } from './services/auth.service';
export { AuthController } from './controllers/auth.controller';
export * from './types/auth.types';`;
  }

  private getAuthServiceTemplate(): string {
    return `import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, LoginCredentials, AuthResponse } from '../types/auth.types';

export class AuthService {
  public async login(credentials: LoginCredentials): Promise<AuthResponse> {
    // Implementation here
    throw new Error('Not implemented');
  }

  public async register(userData: Partial<User>): Promise<AuthResponse> {
    // Implementation here
    throw new Error('Not implemented');
  }

  public async validateToken(token: string): Promise<User | null> {
    // Implementation here
    return null;
  }
}`;
  }

  private getAuthTypesTemplate(): string {
    return `export interface User {
  id: string;
  email: string;
  username: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  expiresAt: Date;
}`;
  }

  private getLibraryIndexTemplate(): string {
    return `// Main library exports
export * from './types';
export * from './utils';

// Default export
export { default } from './main';`;
  }

  private getTsConfigTemplate(): string {
    return JSON.stringify(
      {
        compilerOptions: {
          target: "ES2020",
          module: "commonjs",
          lib: ["ES2020"],
          outDir: "./dist",
          rootDir: "./src",
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          resolveJsonModule: true,
          declaration: true,
          declarationMap: true,
          sourceMap: true,
        },
        include: ["src/**/*"],
        exclude: ["node_modules", "dist", "**/*.test.ts"],
      },
      null,
      2,
    );
  }

  private getEslintConfigTemplate(): string {
    return JSON.stringify(
      {
        extends: ["@typescript-eslint/recommended", "prettier"],
        parser: "@typescript-eslint/parser",
        plugins: ["@typescript-eslint"],
        rules: {
          "@typescript-eslint/no-unused-vars": "error",
          "@typescript-eslint/explicit-function-return-type": "warn",
        },
      },
      null,
      2,
    );
  }

  private getPrettierConfigTemplate(): string {
    return JSON.stringify(
      {
        semi: true,
        trailingComma: "es5",
        singleQuote: true,
        printWidth: 80,
        tabWidth: 2,
      },
      null,
      2,
    );
  }

  private generateGenericContent(
    _intent: UserIntent,
    _context: IntentAnalysisContext,
  ): string {
    return `/**
 * ${_intent.target.name}
 * Generated by MARIA AI Coding Agent
 */

export class ${_intent.target.name} {
  constructor() {
    // Initialize ${_intent.target.name}
  }

  // Add your methods here
}

export default ${_intent.target.name};`;
  }

  private generateIndexContent(dir: DirectorySpec): string {
    return `/**
 * ${dir.purpose}
 * Auto-generated index file
 */

// Export all modules from this directory
export * from './main';`;
  }

  // Helper methods
  private replacePlaceholders(_template: string, intent: UserIntent): string {
    return _template
      .replace(/\{\{name\}\}/g, _intent.target.name)
      .replace(
        /\{\{Name\}\}/g,
        _intent.target.name.charAt(0).toUpperCase() +
          _intent.target.name.slice(1),
      )
      .replace(/\{\{type\}\}/g, _intent.target.type);
  }

  private getRelativeImportPath(_fromPath: string, toPath: string): string {
    const _relativePath = path.relative(path.dirname(_fromPath), toPath);
    return _relativePath.startsWith(".") ? _relativePath : `./${_relativePath}`;
  }

  private calculateProjectSize(_files: string[]): "small" | "medium" | "large" {
    const _count = _files.length;
    if (_count < 50) return "small";
    if (_count < 200) return "medium";
    return "large";
  }

  private assessProjectComplexity(
    context: IntentAnalysisContext,
  ): "low" | "medium" | "high" {
    let score = 0;
    if (context.frameworks.length > 2) score++;
    if (context.dependencies.length > 20) score++;
    if (context.existingFiles.length > 100) score++;

    if (score >= 2) return "high";
    if (score >= 1) return "medium";
    return "low";
  }

  private detectCurrentArchitecture(context: IntentAnalysisContext): string {
    // Analyze existing _files to detect _architecture
    const _hasFeaturesDir = context.existingFiles.some((f) =>
      f.includes("/features/"),
    );
    const _hasControllersDir = context.existingFiles.some((f) =>
      f.includes("/controllers/"),
    );
    const _hasDomainDir = context.existingFiles.some((f) =>
      f.includes("/domain/"),
    );

    if (_hasFeaturesDir) return "feature-based";
    if (_hasControllersDir) return "mvc";
    if (_hasDomainDir) return "domain-driven";
    return "layered";
  }

  private async calculateQualityMetrics(
    _context: IntentAnalysisContext,
  ): Promise<QualityMetrics> {
    return {
      maintainabilityIndex: 85,
      testCoverage: 70,
      codeComplexity: 3.2,
      duplication: 5,
    };
  }

  // Pattern application methods
  private reorganizeByFeature(_blueprint: StructureBlueprint): void {
    // Move _files into feature-based organization
  }

  private colocateTests(_blueprint: StructureBlueprint): void {
    // Move test _files next to source _files
  }

  private addBarrelExports(_blueprint: StructureBlueprint): void {
    // Add index.ts _files for clean imports
  }

  private applyCleanArchitecture(_blueprint: StructureBlueprint): void {
    // Apply clean _architecture layers
  }

  private applyBestPractices(
    _files: FileSpec[],
    context: IntentAnalysisContext,
  ): void {
    const _practices = this.bestPractices.get(context.projectType) || [];
    practices.forEach((practice) => {
      practice(_files, context);
    });
  }

  private inferDependencies(
    _files: FileSpec[],
    context: IntentAnalysisContext,
  ): DependencySpec[] {
    const _dependencies: DependencySpec[] = [];

    // Framework _dependencies
    if (context.frameworks.includes("react")) {
      dependencies.push(
        {
          name: "react",
          version: "^18.0.0",
          type: "dependency",
          purpose: "React framework",
        },
        {
          name: "@types/react",
          version: "^18.0.0",
          type: "devDependency",
          purpose: "React types",
        },
      );
    }

    if (context.frameworks.includes("express")) {
      dependencies.push(
        {
          name: "express",
          version: "^4.18.0",
          type: "dependency",
          purpose: "Express framework",
        },
        {
          name: "@types/express",
          version: "^4.17.0",
          type: "devDependency",
          purpose: "Express types",
        },
      );
    }

    // Development _dependencies
    dependencies.push(
      {
        name: "typescript",
        version: "^5.0.0",
        type: "devDependency",
        purpose: "TypeScript compiler",
      },
      {
        name: "eslint",
        version: "^8.0.0",
        type: "devDependency",
        purpose: "Code linting",
      },
      {
        name: "prettier",
        version: "^3.0.0",
        type: "devDependency",
        purpose: "Code formatting",
      },
    );

    return _dependencies;
  }

  private createMetadata(
    _architecture: StructureMetadata["_architecture"],
    intent: UserIntent,
    _analysis: ProjectAnalysis,
  ): StructureMetadata {
    return {
      _architecture,
      patterns: ["typescript", "clean-code", "solid"],
      conventions: {
        naming: "camelCase",
        fileStructure: "feature-based",
        testColocation: true,
        indexFiles: true,
        barrelExports: true,
      },
      estimatedComplexity: _intent.complexity,
      maintenanceScore: 85,
    };
  }
}

// Supporting interfaces
interface StructureTemplate {
  _directories: Array<{
    _path: string;
    purpose: string;
    priority: "high" | "medium" | "low";
  }>;
  _files: Array<{ _path: string; content: string; type: string }>;
  _dependencies: string[];
  patterns: string[];
}

interface PatternRule {
  name: string;
  condition: (_intent: UserIntent, context?: IntentAnalysisContext) => boolean;
  apply: (_blueprint: StructureBlueprint) => void;
}

interface BestPractice {
  name: string;
  description: string;
  apply: (_files: FileSpec[]) => void;
}

interface ProjectAnalysis {
  size: "small" | "medium" | "large";
  complexity: "low" | "medium" | "high";
  _architecture: string;
  techStack: string[];
  qualityMetrics: QualityMetrics;
}

interface QualityMetrics {
  maintainabilityIndex: number;
  testCoverage: number;
  codeComplexity: number;
  duplication: number;
}
