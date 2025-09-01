/**
 * ContextAnalyzer - Analyzes project context and codebase understanding
 * Provides deep insights about the project structure, dependencies, and impact analysis
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { minimatch } from 'minimatch';

export interface ProjectContext {
  rootPath: string;
  projectType: 'node' | 'python' | 'java' | 'go' | 'unknown';
  framework?: string;
  structure: ProjectStructure;
  dependencies: DependencyInfo[];
  statistics: ProjectStatistics;
  conventions: CodingConventions;
  gitInfo?: GitInfo;
}

export interface ProjectStructure {
  directories: DirectoryInfo[];
  mainFiles: FileInfo[];
  testFiles: FileInfo[];
  configFiles: FileInfo[];
  documentationFiles: FileInfo[];
  entryPoints: string[];
}

export interface DirectoryInfo {
  path: string;
  purpose: 'source' | 'test' | 'docs' | 'config' | 'build' | 'vendor' | 'unknown';
  fileCount: number;
  importance: 'critical' | 'high' | 'medium' | 'low';
}

export interface FileInfo {
  path: string;
  type: string;
  size: number;
  lastModified: string;
  importance: 'critical' | 'high' | 'medium' | 'low';
  dependencies?: string[];
}

export interface DependencyInfo {
  name: string;
  version?: string;
  type: 'production' | 'development' | 'peer';
  usageCount: number;
  critical: boolean;
}

export interface ProjectStatistics {
  totalFiles: number;
  totalLines: number;
  languages: Record<string, number>;
  avgFileSize: number;
  testCoverage?: number;
  complexity?: number;
}

export interface CodingConventions {
  indentation: 'tabs' | 'spaces';
  indentSize?: number;
  lineEndings: 'lf' | 'crlf' | 'mixed';
  namingStyle: 'camelCase' | 'snake_case' | 'kebab-case' | 'mixed';
  hasLinter: boolean;
  hasFormatter: boolean;
}

export interface GitInfo {
  branch: string;
  lastCommit: string;
  uncommittedChanges: number;
  remoteUrl?: string;
}

export interface ImpactAnalysis {
  directlyAffected: string[];
  indirectlyAffected: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  testFilesAffected: string[];
  buildImpact: boolean;
  suggestions: string[];
}

export class ContextAnalyzer {
  private projectContext: ProjectContext | null = null;
  private fileCache: Map<string, string> = new Map();
  private dependencyGraph: Map<string, Set<string>> = new Map();

  /**
   * Analyze project context
   */
  async analyzeProject(rootPath?: string): Promise<ProjectContext> {
    const projectRoot = rootPath || process.cwd();
    
    // Detect project type
    const projectType = await this.detectProjectType(projectRoot);
    const framework = await this.detectFramework(projectRoot, projectType);
    
    // Analyze structure
    const structure = await this.analyzeStructure(projectRoot, projectType);
    
    // Analyze dependencies
    const dependencies = await this.analyzeDependencies(projectRoot, projectType);
    
    // Gather statistics
    const statistics = await this.gatherStatistics(projectRoot, structure);
    
    // Detect conventions
    const conventions = await this.detectConventions(projectRoot, structure);
    
    // Get git info
    const gitInfo = await this.getGitInfo(projectRoot);
    
    this.projectContext = {
      rootPath: projectRoot,
      projectType,
      framework,
      structure,
      dependencies,
      statistics,
      conventions,
      gitInfo
    };
    
    // Build dependency graph for impact analysis
    await this.buildDependencyGraph(projectRoot, structure);
    
    return this.projectContext;
  }

  /**
   * Analyze impact of changes
   */
  async analyzeImpact(
    changedFiles: string[],
    operationType: 'create' | 'modify' | 'delete'
  ): Promise<ImpactAnalysis> {
    if (!this.projectContext) {
      await this.analyzeProject();
    }
    
    const directlyAffected = new Set<string>(changedFiles);
    const indirectlyAffected = new Set<string>();
    const testFilesAffected = new Set<string>();
    
    // Find files that depend on changed files
    for (const file of changedFiles) {
      const dependents = this.dependencyGraph.get(file);
      if (dependents) {
        for (const dependent of dependents) {
          if (!directlyAffected.has(dependent)) {
            indirectlyAffected.add(dependent);
          }
          
          // Check if test files are affected
          if (this.isTestFile(dependent)) {
            testFilesAffected.add(dependent);
          }
        }
      }
      
      // Find test files for the changed file
      const testFiles = await this.findTestFiles(file);
      testFiles.forEach(tf => testFilesAffected.add(tf));
    }
    
    // Assess risk level
    const riskLevel = this.assessRiskLevel(
      changedFiles,
      Array.from(indirectlyAffected),
      operationType
    );
    
    // Check build impact
    const buildImpact = this.checkBuildImpact(changedFiles);
    
    // Generate suggestions
    const suggestions = this.generateSuggestions(
      changedFiles,
      Array.from(indirectlyAffected),
      operationType,
      riskLevel
    );
    
    return {
      directlyAffected: changedFiles,
      indirectlyAffected: Array.from(indirectlyAffected),
      riskLevel,
      testFilesAffected: Array.from(testFilesAffected),
      buildImpact,
      suggestions
    };
  }

  /**
   * Get file importance
   */
  getFileImportance(filePath: string): 'critical' | 'high' | 'medium' | 'low' {
    const fileName = path.basename(filePath).toLowerCase();
    const dirName = path.dirname(filePath).toLowerCase();
    
    // Critical files
    const criticalPatterns = [
      'package.json', 'package-lock.json', 'yarn.lock',
      'tsconfig.json', 'webpack.config', '.env',
      'dockerfile', 'docker-compose',
      'main.ts', 'index.ts', 'app.ts', 'server.ts'
    ];
    
    if (criticalPatterns.some(p => fileName.includes(p))) {
      return 'critical';
    }
    
    // High importance
    if (dirName.includes('core') || dirName.includes('auth') || 
        dirName.includes('security') || dirName.includes('database')) {
      return 'high';
    }
    
    // Low importance
    if (dirName.includes('test') || dirName.includes('doc') || 
        dirName.includes('example') || fileName.startsWith('.')) {
      return 'low';
    }
    
    return 'medium';
  }

  /**
   * Get recommendations for file operations
   */
  async getRecommendations(
    operation: 'create' | 'modify' | 'delete',
    targetPath: string
  ): Promise<{
    recommendations: string[];
    warnings: string[];
    relatedFiles: string[];
  }> {
    if (!this.projectContext) {
      await this.analyzeProject();
    }
    
    const recommendations: string[] = [];
    const warnings: string[] = [];
    const relatedFiles: string[] = [];
    
    const importance = this.getFileImportance(targetPath);
    
    // Operation-specific recommendations
    switch (operation) {
      case 'create':
        recommendations.push(`Create file following ${this.projectContext!.conventions.namingStyle} naming convention`);
        if (this.isSourceFile(targetPath)) {
          recommendations.push('Consider creating corresponding test file');
          const testPath = this.suggestTestPath(targetPath);
          if (testPath) {
            relatedFiles.push(testPath);
          }
        }
        break;
      
      case 'modify':
        if (importance === 'critical') {
          warnings.push('Modifying critical file - ensure thorough testing');
          recommendations.push('Run full test suite after modification');
        }
        
        const dependents = this.dependencyGraph.get(targetPath);
        if (dependents && dependents.size > 0) {
          warnings.push(`${dependents.size} files depend on this file`);
          relatedFiles.push(...Array.from(dependents).slice(0, 5));
        }
        break;
      
      case 'delete':
        if (importance === 'critical' || importance === 'high') {
          warnings.push('Deleting important file - this may break the application');
        }
        
        const deps = this.dependencyGraph.get(targetPath);
        if (deps && deps.size > 0) {
          warnings.push(`${deps.size} files will be affected by this deletion`);
          recommendations.push('Update or remove references in dependent files');
          relatedFiles.push(...Array.from(deps));
        }
        break;
    }
    
    // Convention-based recommendations
    if (this.projectContext!.conventions.hasLinter) {
      recommendations.push('Run linter after changes');
    }
    if (this.projectContext!.conventions.hasFormatter) {
      recommendations.push('Format code before committing');
    }
    
    return {
      recommendations,
      warnings,
      relatedFiles
    };
  }

  /**
   * Detect project type
   */
  private async detectProjectType(rootPath: string): Promise<'node' | 'python' | 'java' | 'go' | 'unknown'> {
    try {
      const files = await fs.readdir(rootPath);
      
      if (files.includes('package.json')) return 'node';
      if (files.includes('requirements.txt') || files.includes('setup.py') || files.includes('Pipfile')) return 'python';
      if (files.includes('pom.xml') || files.includes('build.gradle')) return 'java';
      if (files.includes('go.mod')) return 'go';
      
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Detect framework
   */
  private async detectFramework(rootPath: string, projectType: string): Promise<string | undefined> {
    if (projectType === 'node') {
      try {
        const packageJson = JSON.parse(await fs.readFile(path.join(rootPath, 'package.json'), 'utf-8'));
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        if (deps['react']) return 'react';
        if (deps['vue']) return 'vue';
        if (deps['@angular/core']) return 'angular';
        if (deps['express']) return 'express';
        if (deps['next']) return 'nextjs';
        if (deps['gatsby']) return 'gatsby';
      } catch {
        // Ignore
      }
    }
    
    return undefined;
  }

  /**
   * Analyze project structure
   */
  private async analyzeStructure(rootPath: string, projectType: string): Promise<ProjectStructure> {
    const directories: DirectoryInfo[] = [];
    const mainFiles: FileInfo[] = [];
    const testFiles: FileInfo[] = [];
    const configFiles: FileInfo[] = [];
    const documentationFiles: FileInfo[] = [];
    const entryPoints: string[] = [];
    
    // Find main directories
    const dirs = await this.findDirectories(rootPath);
    for (const dir of dirs) {
      const info = await this.analyzeDirectory(dir, rootPath);
      directories.push(info);
    }
    
    // Find important files
    const files = await glob('**/*', {
      cwd: rootPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
      nodir: true
    });
    
    for (const file of files.slice(0, 1000)) { // Limit to prevent hanging
      const fullPath = path.join(rootPath, file);
      const fileInfo = await this.analyzeFile(fullPath);
      
      if (this.isTestFile(file)) {
        testFiles.push(fileInfo);
      } else if (this.isConfigFile(file)) {
        configFiles.push(fileInfo);
      } else if (this.isDocumentationFile(file)) {
        documentationFiles.push(fileInfo);
      } else if (this.isSourceFile(file)) {
        mainFiles.push(fileInfo);
        
        if (this.isEntryPoint(file, projectType)) {
          entryPoints.push(file);
        }
      }
    }
    
    return {
      directories,
      mainFiles: mainFiles.slice(0, 100), // Limit for performance
      testFiles: testFiles.slice(0, 100),
      configFiles,
      documentationFiles,
      entryPoints
    };
  }

  /**
   * Analyze dependencies
   */
  private async analyzeDependencies(rootPath: string, projectType: string): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [];
    
    if (projectType === 'node') {
      try {
        const packageJson = JSON.parse(await fs.readFile(path.join(rootPath, 'package.json'), 'utf-8'));
        
        // Production dependencies
        for (const [name, version] of Object.entries(packageJson.dependencies || {})) {
          dependencies.push({
            name,
            version: version as string,
            type: 'production',
            usageCount: 0, // Would need to analyze imports
            critical: this.isCriticalDependency(name)
          });
        }
        
        // Dev dependencies
        for (const [name, version] of Object.entries(packageJson.devDependencies || {})) {
          dependencies.push({
            name,
            version: version as string,
            type: 'development',
            usageCount: 0,
            critical: false
          });
        }
      } catch {
        // Ignore
      }
    }
    
    return dependencies;
  }

  /**
   * Gather project statistics
   */
  private async gatherStatistics(rootPath: string, structure: ProjectStructure): Promise<ProjectStatistics> {
    const languages: Record<string, number> = {};
    let totalLines = 0;
    let totalSize = 0;
    
    const allFiles = [
      ...structure.mainFiles,
      ...structure.testFiles,
      ...structure.configFiles
    ];
    
    for (const file of allFiles) {
      const ext = path.extname(file.path);
      languages[ext] = (languages[ext] || 0) + 1;
      totalSize += file.size;
    }
    
    return {
      totalFiles: allFiles.length,
      totalLines, // Would need to count actual lines
      languages,
      avgFileSize: allFiles.length > 0 ? totalSize / allFiles.length : 0
    };
  }

  /**
   * Detect coding conventions
   */
  private async detectConventions(rootPath: string, structure: ProjectStructure): Promise<CodingConventions> {
    // Check for linter/formatter configs
    const hasLinter = structure.configFiles.some(f => 
      f.path.includes('eslint') || f.path.includes('tslint') || f.path.includes('pylint')
    );
    
    const hasFormatter = structure.configFiles.some(f =>
      f.path.includes('prettier') || f.path.includes('black') || f.path.includes('gofmt')
    );
    
    // Detect naming style from file names
    const fileNames = structure.mainFiles.map(f => path.basename(f.path, path.extname(f.path)));
    let namingStyle: 'camelCase' | 'snake_case' | 'kebab-case' | 'mixed' = 'mixed';
    
    if (fileNames.every(n => n.includes('-'))) {
      namingStyle = 'kebab-case';
    } else if (fileNames.every(n => n.includes('_'))) {
      namingStyle = 'snake_case';
    } else if (fileNames.every(n => /^[a-z][a-zA-Z]*$/.test(n))) {
      namingStyle = 'camelCase';
    }
    
    return {
      indentation: 'spaces', // Would need to analyze actual files
      indentSize: 2,
      lineEndings: 'lf',
      namingStyle,
      hasLinter,
      hasFormatter
    };
  }

  /**
   * Get git information
   */
  private async getGitInfo(rootPath: string): Promise<GitInfo | undefined> {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const branch = (await execAsync('git branch --show-current', { cwd: rootPath })).stdout.trim();
      const lastCommit = (await execAsync('git rev-parse HEAD', { cwd: rootPath })).stdout.trim();
      const status = (await execAsync('git status --porcelain', { cwd: rootPath })).stdout;
      const uncommittedChanges = status.split('\n').filter(Boolean).length;
      
      return {
        branch,
        lastCommit,
        uncommittedChanges
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Build dependency graph
   */
  private async buildDependencyGraph(rootPath: string, structure: ProjectStructure): Promise<void> {
    // This is a simplified version - real implementation would parse imports
    for (const file of structure.mainFiles) {
      const deps = new Set<string>();
      
      // Add some mock dependencies based on naming
      if (file.path.includes('service')) {
        structure.mainFiles
          .filter(f => f.path.includes('model') || f.path.includes('repository'))
          .forEach(f => deps.add(f.path));
      }
      
      this.dependencyGraph.set(file.path, deps);
    }
  }

  // Helper methods
  private async findDirectories(rootPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(rootPath, { withFileTypes: true });
      return entries
        .filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
        .map(e => path.join(rootPath, e.name));
    } catch {
      return [];
    }
  }

  private async analyzeDirectory(dirPath: string, rootPath: string): Promise<DirectoryInfo> {
    const relativePath = path.relative(rootPath, dirPath);
    const dirName = path.basename(dirPath).toLowerCase();
    
    let purpose: DirectoryInfo['purpose'] = 'unknown';
    let importance: DirectoryInfo['importance'] = 'medium';
    
    if (dirName.includes('test') || dirName.includes('spec')) {
      purpose = 'test';
      importance = 'medium';
    } else if (dirName.includes('doc')) {
      purpose = 'docs';
      importance = 'low';
    } else if (dirName === 'src' || dirName === 'lib') {
      purpose = 'source';
      importance = 'critical';
    } else if (dirName === 'config' || dirName === 'conf') {
      purpose = 'config';
      importance = 'high';
    } else if (dirName === 'dist' || dirName === 'build' || dirName === 'out') {
      purpose = 'build';
      importance = 'low';
    }
    
    let fileCount = 0;
    try {
      const entries = await fs.readdir(dirPath);
      fileCount = entries.length;
    } catch {
      // Ignore
    }
    
    return {
      path: relativePath,
      purpose,
      fileCount,
      importance
    };
  }

  private async analyzeFile(filePath: string): Promise<FileInfo> {
    const stats = await fs.stat(filePath);
    
    return {
      path: filePath,
      type: path.extname(filePath),
      size: stats.size,
      lastModified: stats.mtime.toISOString(),
      importance: this.getFileImportance(filePath)
    };
  }

  private isTestFile(filePath: string): boolean {
    const name = path.basename(filePath).toLowerCase();
    return name.includes('.test.') || name.includes('.spec.') || 
           name.includes('_test.') || name.includes('test_');
  }

  private isConfigFile(filePath: string): boolean {
    const name = path.basename(filePath).toLowerCase();
    return name.includes('config') || name.includes('rc') || 
           name.endsWith('.json') || name.endsWith('.yml') || 
           name.endsWith('.yaml') || name.endsWith('.toml');
  }

  private isDocumentationFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.md' || ext === '.rst' || ext === '.txt' || ext === '.doc';
  }

  private isSourceFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.cpp', '.c'].includes(ext);
  }

  private isEntryPoint(filePath: string, projectType: string): boolean {
    const name = path.basename(filePath).toLowerCase();
    const entryNames = ['main', 'index', 'app', 'server', 'cli'];
    return entryNames.some(e => name.includes(e));
  }

  private isCriticalDependency(name: string): boolean {
    const critical = ['express', 'react', 'vue', 'angular', 'typescript', 'webpack'];
    return critical.some(c => name.includes(c));
  }

  private async findTestFiles(sourceFile: string): Promise<string[]> {
    const baseName = path.basename(sourceFile, path.extname(sourceFile));
    const dir = path.dirname(sourceFile);
    
    const patterns = [
      `${baseName}.test.*`,
      `${baseName}.spec.*`,
      `test_${baseName}.*`,
      `${baseName}_test.*`
    ];
    
    const testFiles: string[] = [];
    // Would search for test files matching patterns
    
    return testFiles;
  }

  private suggestTestPath(sourceFile: string): string {
    const ext = path.extname(sourceFile);
    const baseName = path.basename(sourceFile, ext);
    const dir = path.dirname(sourceFile);
    
    // Replace src with test/tests
    let testDir = dir.replace('/src/', '/tests/').replace('/lib/', '/tests/');
    if (testDir === dir) {
      testDir = path.join(dir, '__tests__');
    }
    
    return path.join(testDir, `${baseName}.test${ext}`);
  }

  private assessRiskLevel(
    changedFiles: string[],
    indirectlyAffected: string[],
    operationType: string
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Check if critical files are affected
    const hasCritical = changedFiles.some(f => this.getFileImportance(f) === 'critical');
    if (hasCritical) return 'critical';
    
    // Many files affected
    if (indirectlyAffected.length > 20) return 'high';
    if (indirectlyAffected.length > 5) return 'medium';
    
    // Delete operations are riskier
    if (operationType === 'delete') return 'medium';
    
    return 'low';
  }

  private checkBuildImpact(changedFiles: string[]): boolean {
    return changedFiles.some(f => {
      const name = path.basename(f).toLowerCase();
      return name.includes('package.json') || name.includes('tsconfig') || 
             name.includes('webpack') || name.includes('build');
    });
  }

  private generateSuggestions(
    changedFiles: string[],
    indirectlyAffected: string[],
    operationType: string,
    riskLevel: string
  ): string[] {
    const suggestions: string[] = [];
    
    if (riskLevel === 'critical' || riskLevel === 'high') {
      suggestions.push('Create backup before proceeding');
      suggestions.push('Run comprehensive test suite after changes');
    }
    
    if (indirectlyAffected.length > 0) {
      suggestions.push(`Review ${indirectlyAffected.length} indirectly affected files`);
    }
    
    if (operationType === 'delete') {
      suggestions.push('Ensure no broken imports remain');
      suggestions.push('Update documentation if needed');
    }
    
    return suggestions;
  }
}