/**
 * Type definitions for filename inference system
 */

export interface FilenameCandidate {
  path: string;
  filename: string;
  extension: string;
  confidence: number;
  reasoning: string;
  source?: 'explicit' | 'contextual' | 'semantic' | 'default' | 'combined' | 'project';
  alternatives?: string[];
  directory?: string;
}

export interface FilenameResult extends FilenameCandidate {
  source: string;
  alternatives: string[];
}

export interface ProjectContext {
  root?: string;
  directory?: string;
  conventions?: ProjectConventions;
  directories?: Record<string, string[]>;
  existingFiles?: string[];
  framework?: string;
  language?: string;
}

export interface ProjectConventions {
  fileNaming: 'camelCase' | 'kebab-case' | 'PascalCase' | 'snake_case';
  directories: {
    components?: string;
    pages?: string;
    utils?: string;
    services?: string;
    styles?: string;
    tests?: string;
  };
  extensions: {
    react?: '.tsx' | '.jsx';
    typescript?: '.ts';
    javascript?: '.js';
    styles?: '.css' | '.scss' | '.module.css';
  };
}

export interface InferenceConfig {
  priority: 'explicit' | 'contextual' | 'semantic' | 'default';
  fallbackStrategy: 'timestamp' | 'generic' | 'random';
  projectConventions?: ProjectConventions;
  confidenceThreshold: number;
}

export interface FilenameInferenceOptions {
  priority?: 'explicit' | 'contextual' | 'semantic' | 'default';
  fallbackStrategy?: 'timestamp' | 'generic' | 'random';
  projectConventions?: ProjectConventions;
  confidenceThreshold?: number;
}

export interface Language {
  name: string;
  confidence: number;
  indicators: string[];
  extension: string;
}

export interface Framework {
  name: string;
  confidence: number;
  indicators: string[];
}

export interface FilenamePattern {
  pattern: RegExp;
  extractor: (match: RegExpMatchArray) => string;
  confidence: number;
  priority: number;
}

export interface ContextualMapping {
  keywords: string[];
  suggest: string;
  confidence: number;
  category?: string;
}

// Security and Plan Types
export type NamingConvention = 'kebab-case' | 'camelCase' | 'PascalCase' | 'snake_case';

export type SaveMode = 'immediate' | 'interactive' | 'dry-run';

export type InferenceSource = 'explicit' | 'project' | 'contextual' | 'semantic' | 'default';

export interface ExtensionResult {
  ext: string;
  source: 'project' | 'fence' | 'mime' | 'syntax' | 'default';
  confidence: number;
}

export interface SaveOperation {
  type?: 'create' | 'overwrite' | 'rename';
  filename?: string;
  filepath?: string;  // Alternative to path
  path?: string;      // Alternative to filepath
  content: string;
  previousPath?: string;
  timestamp: number;
  planId: string;
}

export interface SaveResult {
  success: boolean;
  path?: string;
  error?: string;
  dryRun?: boolean;
  suggested?: FilenameCandidate[];
  alternatives?: string[];
}

export interface PlanFileSaveConfig {
  fileSave: {
    allowExtensions: string[];
    maxFileSizeMB: number;
    defaultDir: string;
  };
  naming: {
    convention: NamingConvention;
  };
  dirs: {
    [key: string]: string;
  };
}

export interface InferenceResult {
  candidates: FilenameCandidate[];
  selectedIndex: number;
  mode: SaveMode;
  timedOut?: boolean;
}

// Error Classes
export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

export class PlanViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanViolationError';
  }
}

export class UserCancelledError extends Error {
  constructor() {
    super('User cancelled operation');
    this.name = 'UserCancelledError';
  }
}

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}