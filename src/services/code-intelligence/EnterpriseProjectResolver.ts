/**
 * Enterprise Project Resolver - Monorepo and TypeScript Project References Support
 * Week 1-2 Implementation: TypeScript-first with enterprise monorepo capabilities
 */

import * as ts from 'typescript';
import * as path from 'path';
import { readFileSync, existsSync } from 'fs';
import { globby } from 'globby';

export interface ProjectReference {
  path: string;
  config: TSConfig;
  dependencies: string[];
}

export interface TSConfig {
  compilerOptions?: ts.CompilerOptions;
  projectReferences?: Array<{ path: string; prepend?: boolean }>;
  include?: string[];
  exclude?: string[];
  extends?: string;
  files?: string[];
}

export interface PathMapping {
  pattern: string;
  mappings: string[];
}

export interface SolutionInfo {
  root: TSConfig;
  projects: ProjectReference[];
  pathMappings: PathMapping[];
  workspaceType: WorkspaceType;
}

export interface ResolvedModule {
  resolvedFileName: string;
  isExternalLibraryImport?: boolean;
  extension?: ts.Extension;
}

export type WorkspaceType = 'pnpm' | 'yarn' | 'npm' | 'lerna' | 'nx' | 'none';

/**
 * Production-grade project resolution with monorepo support
 * Implements enterprise requirements from SOW version 2.1
 */
export class EnterpriseProjectResolver {
  private configCache = new Map<string, TSConfig>();
  private moduleResolutionHost: ts.ModuleResolutionHost;
  
  constructor() {
    // Initialize module resolution host with safe fallbacks
    this.moduleResolutionHost = {
      fileExists: (fileName: string) => {
        try {
          return ts.sys?.fileExists?.(fileName) ?? existsSync(fileName);
        } catch {
          return false;
        }
      },
      readFile: (fileName: string) => {
        try {
          return ts.sys?.readFile?.(fileName) ?? readFileSync(fileName, 'utf-8');
        } catch {
          return undefined;
        }
      },
      realpath: ts.sys?.realpath,
      getCurrentDirectory: () => {
        try {
          return ts.sys?.getCurrentDirectory?.() ?? process.cwd();
        } catch {
          return process.cwd();
        }
      },
      getDirectories: ts.sys?.getDirectories
    };
  }

  /**
   * Load TypeScript solutions with project references
   * Handles monorepo configurations and workspace detection
   */
  async loadSolutions(rootPath: string): Promise<SolutionInfo> {
    const rootTsConfig = this.findRootTsConfig(rootPath);
    const config = await this.loadTSConfig(rootTsConfig);
    
    const projects: ProjectReference[] = [];
    
    // Load all referenced projects
    if (config.projectReferences) {
      for (const ref of config.projectReferences) {
        const refPath = path.resolve(path.dirname(rootTsConfig), ref.path);
        const refConfigPath = this.resolveTsConfigPath(refPath);
        
        if (refConfigPath && existsSync(refConfigPath)) {
          const refConfig = await this.loadTSConfig(refConfigPath);
          const dependencies = await this.analyzeDependencies(refConfig, refConfigPath);
          
          projects.push({
            path: refPath,
            config: refConfig,
            dependencies
          });
        }
      }
    }
    
    // Extract path mappings for proper module resolution
    const pathMappings = this.extractPathMappings(config, rootTsConfig);
    
    // Detect workspace type for package management
    const workspaceType = await this.detectWorkspaceType(rootPath);
    
    return {
      root: config,
      projects,
      pathMappings,
      workspaceType
    };
  }

  /**
   * Resolve module names using TypeScript's module resolution
   * Must match tsc behavior for enterprise compatibility
   */
  async resolveModuleName(
    moduleName: string,
    containingFile: string,
    compilerOptions: ts.CompilerOptions
  ): Promise<ResolvedModule | null> {
    const result = ts.resolveModuleName(
      moduleName,
      containingFile,
      compilerOptions,
      this.moduleResolutionHost
    );

    if (result.resolvedModule) {
      return {
        resolvedFileName: result.resolvedModule.resolvedFileName,
        isExternalLibraryImport: result.resolvedModule.isExternalLibraryImport,
        extension: result.resolvedModule.extension
      };
    }

    return null;
  }

  /**
   * Analyze cross-project impact for enterprise safety
   */
  async analyzeCrossProjectImpact(changes: Array<{ file: string }>): Promise<{
    affectedProjects: string[];
    requiredValidation: Array<'P1' | 'P2' | 'P3'>;
    riskLevel: 'low' | 'medium' | 'high';
  }> {
    const affectedProjects = new Set<string>();
    
    for (const change of changes) {
      const projects = await this.findProjectsContainingFile(change.file);
      projects.forEach(project => affectedProjects.add(project));
    }

    const projectCount = affectedProjects.size;
    
    // Risk assessment based on cross-project impact
    let riskLevel: 'low' | 'medium' | 'high';
    let requiredValidation: Array<'P1' | 'P2' | 'P3'>;

    if (projectCount === 0) {
      riskLevel = 'low';
      requiredValidation = ['P1'];
    } else if (projectCount === 1) {
      riskLevel = 'low';
      requiredValidation = ['P1'];
    } else if (projectCount <= 3) {
      riskLevel = 'medium';
      requiredValidation = ['P1', 'P2'];
    } else {
      riskLevel = 'high';
      requiredValidation = ['P1', 'P2', 'P3'];
    }

    return {
      affectedProjects: Array.from(affectedProjects),
      requiredValidation,
      riskLevel
    };
  }

  /**
   * Find root tsconfig.json with project references
   */
  private findRootTsConfig(rootPath: string): string {
    const candidates = [
      path.join(rootPath, 'tsconfig.json'),
      path.join(rootPath, 'tsconfig.base.json'),
      path.join(rootPath, 'tsconfig.root.json')
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        try {
          const config = this.parseTsConfig(candidate);
          // Prefer configs with project references for monorepo support
          if (config.projectReferences && config.projectReferences.length > 0) {
            return candidate;
          }
        } catch {
          continue;
        }
      }
    }

    // Fallback to first existing config
    return candidates.find(existsSync) || path.join(rootPath, 'tsconfig.json');
  }

  /**
   * Load and cache TypeScript configuration
   */
  private async loadTSConfig(configPath: string): Promise<TSConfig> {
    const normalizedPath = path.resolve(configPath);
    
    if (this.configCache.has(normalizedPath)) {
      return this.configCache.get(normalizedPath)!;
    }

    const config = this.parseTsConfig(normalizedPath);
    this.configCache.set(normalizedPath, config);
    
    return config;
  }

  /**
   * Parse TypeScript configuration with extends support
   */
  private parseTsConfig(configPath: string): TSConfig {
    try {
      const content = readFileSync(configPath, 'utf-8');
      const config = ts.parseConfigFileTextToJson(configPath, content);
      
      if (config.error) {
        console.warn(`Warning: Error parsing ${configPath}:`, config.error.messageText);
      }

      let parsedConfig = config.config as TSConfig;

      // Handle extends
      if (parsedConfig.extends) {
        const baseConfigPath = path.resolve(path.dirname(configPath), parsedConfig.extends);
        if (existsSync(baseConfigPath)) {
          const baseConfig = this.parseTsConfig(baseConfigPath);
          parsedConfig = this.mergeTsConfigs(baseConfig, parsedConfig);
        }
      }

      return parsedConfig;
    } catch (error) {
      console.warn(`Warning: Failed to parse ${configPath}:`, error);
      return {};
    }
  }

  /**
   * Merge TypeScript configurations (extends support)
   */
  private mergeTsConfigs(base: TSConfig, override: TSConfig): TSConfig {
    return {
      ...base,
      ...override,
      compilerOptions: {
        ...base.compilerOptions,
        ...override.compilerOptions
      },
      include: override.include || base.include,
      exclude: override.exclude || base.exclude,
      projectReferences: override.projectReferences || base.projectReferences
    };
  }

  /**
   * Extract path mappings for module resolution
   */
  private extractPathMappings(config: TSConfig, configPath: string): PathMapping[] {
    const paths = config.compilerOptions?.paths || {};
    const baseUrl = config.compilerOptions?.baseUrl || '.';
    const configDir = path.dirname(configPath);
    const resolvedBaseUrl = path.resolve(configDir, baseUrl);

    return Object.entries(paths).map(([pattern, mappings]) => ({
      pattern,
      mappings: mappings.map(mapping => {
        // Resolve relative paths against baseUrl
        if (path.isAbsolute(mapping)) {
          return mapping;
        }
        return path.resolve(resolvedBaseUrl, mapping);
      })
    }));
  }

  /**
   * Analyze project dependencies from imports
   */
  private async analyzeDependencies(config: TSConfig, configPath: string): Promise<string[]> {
    const dependencies = new Set<string>();
    const configDir = path.dirname(configPath);
    
    // Get all TypeScript files in project
    const include = config.include || ['**/*'];
    const exclude = config.exclude || ['node_modules/**', 'dist/**'];
    
    const patterns = include.map(pattern => {
      if (path.isAbsolute(pattern)) {
        return pattern;
      }
      return path.join(configDir, pattern);
    });

    try {
      const files = await globby(patterns, {
        ignore: exclude,
        extensions: ['ts', 'tsx'],
        absolute: true
      });

      // Analyze first 10 files to avoid performance issues
      const sampleFiles = files.slice(0, 10);
      
      for (const file of sampleFiles) {
        try {
          const content = readFileSync(file, 'utf-8');
          const imports = this.extractImports(content);
          
          for (const imp of imports) {
            if (!imp.startsWith('.') && !path.isAbsolute(imp)) {
              // External dependency
              const packageName = imp.split('/')[0];
              if (packageName.startsWith('@')) {
                // Scoped package
                dependencies.add(`${packageName}/${imp.split('/')[1]}`);
              } else {
                dependencies.add(packageName);
              }
            }
          }
        } catch {
          // Skip files that can't be read
          continue;
        }
      }
    } catch (error) {
      console.warn(`Warning: Failed to analyze dependencies for ${configPath}:`, error);
    }

    return Array.from(dependencies);
  }

  /**
   * Extract import statements from TypeScript source
   */
  private extractImports(content: string): string[] {
    const imports: string[] = [];
    
    // Simple regex-based import extraction (fast but limited)
    const importRegex = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"`]([^'"`]+)['"`]/g;
    const requireRegex = /require\(['"`]([^'"`]+)['"`]\)/g;
    
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    return imports;
  }

  /**
   * Detect workspace type for enterprise monorepo support
   */
  private async detectWorkspaceType(rootPath: string): Promise<WorkspaceType> {
    const workspaceIndicators = [
      { file: 'pnpm-workspace.yaml', type: 'pnpm' as const },
      { file: 'pnpm-workspace.yml', type: 'pnpm' as const },
      { file: 'yarn.lock', type: 'yarn' as const },
      { file: 'lerna.json', type: 'lerna' as const },
      { file: 'nx.json', type: 'nx' as const },
      { file: 'package-lock.json', type: 'npm' as const }
    ];

    for (const indicator of workspaceIndicators) {
      const filePath = path.join(rootPath, indicator.file);
      if (existsSync(filePath)) {
        // Additional validation for specific workspace types
        if (indicator.type === 'yarn' || indicator.type === 'npm') {
          // Check if package.json has workspaces field
          const packageJsonPath = path.join(rootPath, 'package.json');
          if (existsSync(packageJsonPath)) {
            try {
              const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
              if (packageJson.workspaces) {
                return indicator.type;
              }
            } catch {
              // Ignore parse errors
            }
          }
          if (indicator.type === 'yarn') continue; // Don't return yarn without workspaces
        }
        
        return indicator.type;
      }
    }

    return 'none';
  }

  /**
   * Resolve tsconfig.json path from directory or file path
   */
  private resolveTsConfigPath(targetPath: string): string | null {
    if (targetPath.endsWith('.json')) {
      return existsSync(targetPath) ? targetPath : null;
    }

    const candidates = [
      path.join(targetPath, 'tsconfig.json'),
      path.join(targetPath, 'tsconfig.base.json')
    ];

    return candidates.find(existsSync) || null;
  }

  /**
   * Find projects that contain a specific file
   */
  private async findProjectsContainingFile(filePath: string): Promise<string[]> {
    const projects: string[] = [];
    const normalizedPath = path.resolve(filePath);
    
    for (const [configPath] of this.configCache) {
      try {
        const config = await this.loadTSConfig(configPath);
        const configDir = path.dirname(configPath);
        
        const include = config.include || ['**/*'];
        const exclude = config.exclude || [];
        
        // Check if file matches include patterns and doesn't match exclude patterns
        const isIncluded = include.some(pattern => {
          const fullPattern = path.isAbsolute(pattern) 
            ? pattern 
            : path.join(configDir, pattern);
          return this.matchesPattern(normalizedPath, fullPattern);
        });
        
        const isExcluded = exclude.some(pattern => {
          const fullPattern = path.isAbsolute(pattern) 
            ? pattern 
            : path.join(configDir, pattern);
          return this.matchesPattern(normalizedPath, fullPattern);
        });
        
        if (isIncluded && !isExcluded) {
          projects.push(configDir);
        }
      } catch {
        // Skip projects that can't be analyzed
        continue;
      }
    }
    
    return projects;
  }

  /**
   * Simple pattern matching for file paths
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    // Convert glob pattern to regex (simplified)
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }

  /**
   * Clear configuration cache
   */
  clearCache(): void {
    this.configCache.clear();
  }

  /**
   * Get cached configurations count (for monitoring)
   */
  getCacheSize(): number {
    return this.configCache.size;
  }
}

// Export singleton instance for use across the application
export const enterpriseProjectResolver = new EnterpriseProjectResolver();