/**
 * Document Auto-Save Service
 * Automatically saves design documents, specifications, TODOs, and SOWs as markdown files
 */

import { writeFile } from "fs/promises";
import * as path from "path";

/**
 * Document types for classification
 */
export enum DocumentType {
  // Documentation types
  DESIGN = 'design',
  SPECIFICATION = 'specification',
  TODO = 'todo',
  SOW = 'sow',
  REQUIREMENTS = 'requirements',
  ARCHITECTURE = 'architecture',
  API_DOC = 'api-doc',
  USER_STORY = 'user-story',
  MEETING_NOTES = 'meeting-notes',
  PROJECT_PLAN = 'project-plan',
  TECHNICAL_SPEC = 'technical-spec',
  IMPLEMENTATION_PLAN = 'implementation-plan',
  FEEDBACK = 'feedback',
  REVIEW = 'review',
  RETROSPECTIVE = 'retrospective',
  
  // Code and configuration types
  TYPESCRIPT = 'typescript',
  JAVASCRIPT = 'javascript',
  HTML = 'html',
  CSS = 'css',
  SCSS = 'scss',
  SASS = 'sass',
  LESS = 'less',
  SQL = 'sql',
  SHELL_SCRIPT = 'shell-script',
  YAML = 'yaml',
  JSON = 'json',
  XML = 'xml',
  CSV = 'csv',
  DOCKERFILE = 'dockerfile',
  ENV_CONFIG = 'env-config',
  GITIGNORE = 'gitignore',
  PACKAGE_JSON = 'package-json',
  WEBPACK_CONFIG = 'webpack-config',
  ESLINT_CONFIG = 'eslint-config',
  TSCONFIG = 'tsconfig',
  MAKEFILE = 'makefile',
  CMAKE = 'cmake',
  GRADLE = 'gradle',
  MAVEN = 'maven',
  PYTHON = 'python',
  RUBY = 'ruby',
  GO = 'go',
  RUST = 'rust',
  JAVA = 'java',
  CPP = 'cpp',
  C = 'c',
  CSHARP = 'csharp',
  PHP = 'php',
  SWIFT = 'swift',
  KOTLIN = 'kotlin',
  TERRAFORM = 'terraform',
  ANSIBLE = 'ansible',
  KUBERNETES = 'kubernetes',
  HELM = 'helm',
  GRAPHQL = 'graphql',
  PRISMA = 'prisma',
  README = 'readme',
  CHANGELOG = 'changelog',
  LICENSE = 'license'
}

/**
 * Document classification keywords
 */
const DOCUMENT_KEYWORDS: Record<DocumentType, string[]> = {
  // Documentation types
  [DocumentType.DESIGN]: [
    'design', 'architecture', 'diagram', 'wireframe', 'mockup', 'ui/ux',
    'visual design', 'user interface', 'user experience', 'layout', 'prototype'
  ],
  [DocumentType.FEEDBACK]: [
    'feedback', 'フィードバック', 'review', 'comment', 'suggestion',
    'improvement', 'opinion', '意見', 'レビュー', 'コメント'
  ],
  [DocumentType.REVIEW]: [
    'code review', 'peer review', 'review comments', 'review notes',
    'pr review', 'pull request review', 'merge request review'
  ],
  [DocumentType.RETROSPECTIVE]: [
    'retrospective', 'retro', 'sprint retrospective', 'lessons learned',
    'post-mortem', 'reflection', 'team retrospective'
  ],
  [DocumentType.SPECIFICATION]: [
    'specification', 'spec', 'requirements', 'functional spec', 'technical spec',
    'requirement document', 'system specification', 'feature spec'
  ],
  [DocumentType.TODO]: [
    'todo', 'task list', 'action items', 'checklist', 'to-do list',
    'pending tasks', 'work items', 'backlog', 'sprint tasks'
  ],
  [DocumentType.SOW]: [
    'sow', 'statement of work', 'scope of work', 'project scope',
    'work statement', 'project proposal', 'contract', 'milestone'
  ],
  [DocumentType.REQUIREMENTS]: [
    'requirements', 'user requirements', 'business requirements',
    'functional requirements', 'non-functional requirements', 'acceptance criteria'
  ],
  [DocumentType.ARCHITECTURE]: [
    'architecture', 'system architecture', 'software architecture',
    'infrastructure', 'component diagram', 'deployment diagram'
  ],
  [DocumentType.API_DOC]: [
    'api', 'api documentation', 'endpoint', 'rest api', 'graphql',
    'api reference', 'swagger', 'openapi'
  ],
  [DocumentType.USER_STORY]: [
    'user story', 'user stories', 'persona', 'use case', 'user journey',
    'user flow', 'scenario', 'acceptance criteria'
  ],
  [DocumentType.MEETING_NOTES]: [
    'meeting notes', 'meeting minutes', 'discussion', 'agenda',
    'action items from meeting', 'decision log'
  ],
  [DocumentType.PROJECT_PLAN]: [
    'project plan', 'timeline', 'roadmap', 'project timeline',
    'delivery schedule', 'project phases', 'milestones'
  ],
  [DocumentType.TECHNICAL_SPEC]: [
    'technical specification', 'tech spec', 'implementation details',
    'technical design', 'system design', 'database schema'
  ],
  [DocumentType.IMPLEMENTATION_PLAN]: [
    'implementation plan', 'development plan', 'execution plan',
    'rollout plan', 'deployment strategy', 'implementation steps'
  ],
  
  // Code and configuration types
  [DocumentType.TYPESCRIPT]: ['typescript', 'interface', 'type', 'enum', 'namespace'],
  [DocumentType.JAVASCRIPT]: ['javascript', 'function', 'const', 'let', 'var'],
  [DocumentType.HTML]: ['html', 'div', 'span', 'body', 'head', 'meta'],
  [DocumentType.CSS]: ['css', 'style', 'selector', 'class', 'id'],
  [DocumentType.SQL]: ['sql', 'select', 'insert', 'update', 'delete', 'create table'],
  [DocumentType.SHELL_SCRIPT]: ['bash', 'shell', 'script', '#!/bin/bash', 'sh'],
  [DocumentType.YAML]: ['yaml', 'yml', 'config', 'services', 'environment'],
  [DocumentType.JSON]: ['json', 'object', 'array', 'key', 'value'],
  [DocumentType.CSV]: ['csv', 'comma', 'separated', 'values', 'data'],
  [DocumentType.DOCKERFILE]: ['dockerfile', 'from', 'run', 'cmd', 'expose'],
  [DocumentType.ENV_CONFIG]: ['env', 'environment', 'variables', 'config'],
  [DocumentType.GITIGNORE]: ['gitignore', 'ignore', 'exclude', 'node_modules'],
  [DocumentType.PACKAGE_JSON]: ['package.json', 'dependencies', 'scripts', 'npm'],
  [DocumentType.WEBPACK_CONFIG]: ['webpack', 'config', 'module', 'loader'],
  [DocumentType.ESLINT_CONFIG]: ['eslint', 'rules', 'extends', 'parser'],
  [DocumentType.TSCONFIG]: ['tsconfig', 'compileroptions', 'typescript', 'config'],
  [DocumentType.SCSS]: ['scss', 'sass', 'mixin', 'include', 'extend'],
  [DocumentType.SASS]: ['sass', 'mixin', 'include', 'extend'],
  [DocumentType.LESS]: ['less', 'mixin', 'variable'],
  [DocumentType.XML]: ['xml', 'xmlns', 'xsd', 'xsl'],
  [DocumentType.MAKEFILE]: ['makefile', 'make', 'target', 'dependency'],
  [DocumentType.CMAKE]: ['cmake', 'cmakelist', 'find_package', 'add_executable'],
  [DocumentType.GRADLE]: ['gradle', 'dependencies', 'repositories', 'plugins'],
  [DocumentType.MAVEN]: ['maven', 'pom', 'dependency', 'artifact'],
  [DocumentType.PYTHON]: ['python', 'def', 'class', 'import', 'from', '__init__'],
  [DocumentType.RUBY]: ['ruby', 'def', 'end', 'class', 'module', 'require'],
  [DocumentType.GO]: ['golang', 'package', 'func', 'import', 'type', 'struct'],
  [DocumentType.RUST]: ['rust', 'fn', 'let', 'mut', 'impl', 'trait', 'cargo'],
  [DocumentType.JAVA]: ['java', 'class', 'public', 'private', 'interface', 'extends'],
  [DocumentType.CPP]: ['cpp', 'c++', 'include', 'namespace', 'class', 'template'],
  [DocumentType.C]: ['#include', 'typedef', 'struct', 'void', 'int main'],
  [DocumentType.CSHARP]: ['csharp', 'c#', 'namespace', 'class', 'public', 'using'],
  [DocumentType.PHP]: ['php', '<?php', 'function', 'class', 'namespace', 'use'],
  [DocumentType.SWIFT]: ['swift', 'func', 'var', 'let', 'class', 'struct', 'import'],
  [DocumentType.KOTLIN]: ['kotlin', 'fun', 'val', 'var', 'class', 'object', 'package'],
  [DocumentType.TERRAFORM]: ['terraform', 'resource', 'provider', 'variable', 'output'],
  [DocumentType.ANSIBLE]: ['ansible', 'playbook', 'tasks', 'handlers', 'roles'],
  [DocumentType.KUBERNETES]: ['kubernetes', 'k8s', 'apiVersion', 'kind', 'metadata', 'spec'],
  [DocumentType.HELM]: ['helm', 'chart', 'values', 'templates', 'requirements'],
  [DocumentType.GRAPHQL]: ['graphql', 'query', 'mutation', 'subscription', 'type', 'schema'],
  [DocumentType.PRISMA]: ['prisma', 'model', 'datasource', 'generator', '@@map'],
  [DocumentType.README]: ['readme', 'installation', 'usage', 'contributing', 'license'],
  [DocumentType.CHANGELOG]: ['changelog', 'version', 'added', 'changed', 'fixed', 'removed'],
  [DocumentType.LICENSE]: ['license', 'copyright', 'permission', 'warranty', 'liability']
};

/**
 * Filename templates for different document types
 */
const FILENAME_TEMPLATES: Record<DocumentType, string> = {
  // Documentation types
  [DocumentType.DESIGN]: 'design_document',
  [DocumentType.SPECIFICATION]: 'specification',
  [DocumentType.TODO]: 'todo_list',
  [DocumentType.SOW]: 'statement_of_work',
  [DocumentType.REQUIREMENTS]: 'requirements',
  [DocumentType.ARCHITECTURE]: 'architecture',
  [DocumentType.API_DOC]: 'api_documentation',
  [DocumentType.USER_STORY]: 'user_stories',
  [DocumentType.MEETING_NOTES]: 'meeting_notes',
  [DocumentType.PROJECT_PLAN]: 'project_plan',
  [DocumentType.TECHNICAL_SPEC]: 'technical_specification',
  [DocumentType.IMPLEMENTATION_PLAN]: 'implementation_plan',
  [DocumentType.FEEDBACK]: 'feedback',
  [DocumentType.REVIEW]: 'review',
  [DocumentType.RETROSPECTIVE]: 'retrospective',
  
  // Code and configuration types
  [DocumentType.TYPESCRIPT]: 'script',
  [DocumentType.JAVASCRIPT]: 'script',
  [DocumentType.HTML]: 'index',
  [DocumentType.CSS]: 'styles',
  [DocumentType.SQL]: 'query',
  [DocumentType.SHELL_SCRIPT]: 'script',
  [DocumentType.YAML]: 'config',
  [DocumentType.JSON]: 'data',
  [DocumentType.CSV]: 'data',
  [DocumentType.DOCKERFILE]: 'Dockerfile',
  [DocumentType.ENV_CONFIG]: '.env',
  [DocumentType.GITIGNORE]: '.gitignore',
  [DocumentType.PACKAGE_JSON]: 'package',
  [DocumentType.WEBPACK_CONFIG]: 'webpack.config',
  [DocumentType.ESLINT_CONFIG]: '.eslintrc',
  [DocumentType.TSCONFIG]: 'tsconfig',
  [DocumentType.SCSS]: 'styles',
  [DocumentType.SASS]: 'styles',
  [DocumentType.LESS]: 'styles',
  [DocumentType.XML]: 'data',
  [DocumentType.MAKEFILE]: 'Makefile',
  [DocumentType.CMAKE]: 'CMakeLists',
  [DocumentType.GRADLE]: 'build',
  [DocumentType.MAVEN]: 'pom',
  [DocumentType.PYTHON]: 'script',
  [DocumentType.RUBY]: 'script',
  [DocumentType.GO]: 'main',
  [DocumentType.RUST]: 'main',
  [DocumentType.JAVA]: 'Main',
  [DocumentType.CPP]: 'main',
  [DocumentType.C]: 'main',
  [DocumentType.CSHARP]: 'Program',
  [DocumentType.PHP]: 'index',
  [DocumentType.SWIFT]: 'main',
  [DocumentType.KOTLIN]: 'Main',
  [DocumentType.TERRAFORM]: 'main',
  [DocumentType.ANSIBLE]: 'playbook',
  [DocumentType.KUBERNETES]: 'deployment',
  [DocumentType.HELM]: 'chart',
  [DocumentType.GRAPHQL]: 'schema',
  [DocumentType.PRISMA]: 'schema',
  [DocumentType.README]: 'README',
  [DocumentType.CHANGELOG]: 'CHANGELOG',
  [DocumentType.LICENSE]: 'LICENSE'
};

/**
 * File extensions for different document types
 */
const FILE_EXTENSIONS: Record<DocumentType, string> = {
  // Documentation types (all markdown)
  [DocumentType.DESIGN]: '.md',
  [DocumentType.SPECIFICATION]: '.md',
  [DocumentType.TODO]: '.md',
  [DocumentType.SOW]: '.md',
  [DocumentType.REQUIREMENTS]: '.md',
  [DocumentType.ARCHITECTURE]: '.md',
  [DocumentType.API_DOC]: '.md',
  [DocumentType.USER_STORY]: '.md',
  [DocumentType.MEETING_NOTES]: '.md',
  [DocumentType.PROJECT_PLAN]: '.md',
  [DocumentType.TECHNICAL_SPEC]: '.md',
  [DocumentType.IMPLEMENTATION_PLAN]: '.md',
  [DocumentType.FEEDBACK]: '.md',
  [DocumentType.REVIEW]: '.md',
  [DocumentType.RETROSPECTIVE]: '.md',
  
  // Code and configuration types
  [DocumentType.TYPESCRIPT]: '.ts',
  [DocumentType.JAVASCRIPT]: '.js',
  [DocumentType.HTML]: '.html',
  [DocumentType.CSS]: '.css',
  [DocumentType.SQL]: '.sql',
  [DocumentType.SHELL_SCRIPT]: '.sh',
  [DocumentType.YAML]: '.yml',
  [DocumentType.JSON]: '.json',
  [DocumentType.CSV]: '.csv',
  [DocumentType.DOCKERFILE]: '',  // No extension for Dockerfile
  [DocumentType.ENV_CONFIG]: '',  // .env has no additional extension
  [DocumentType.GITIGNORE]: '',  // .gitignore has no additional extension
  [DocumentType.PACKAGE_JSON]: '.json',
  [DocumentType.WEBPACK_CONFIG]: '.js',
  [DocumentType.ESLINT_CONFIG]: '.json',
  [DocumentType.TSCONFIG]: '.json',
  [DocumentType.SCSS]: '.scss',
  [DocumentType.SASS]: '.sass',
  [DocumentType.LESS]: '.less',
  [DocumentType.XML]: '.xml',
  [DocumentType.MAKEFILE]: '',  // Makefile has no extension
  [DocumentType.CMAKE]: '.txt',  // CMakeLists.txt
  [DocumentType.GRADLE]: '.gradle',
  [DocumentType.MAVEN]: '.xml',
  [DocumentType.PYTHON]: '.py',
  [DocumentType.RUBY]: '.rb',
  [DocumentType.GO]: '.go',
  [DocumentType.RUST]: '.rs',
  [DocumentType.JAVA]: '.java',
  [DocumentType.CPP]: '.cpp',
  [DocumentType.C]: '.c',
  [DocumentType.CSHARP]: '.cs',
  [DocumentType.PHP]: '.php',
  [DocumentType.SWIFT]: '.swift',
  [DocumentType.KOTLIN]: '.kt',
  [DocumentType.TERRAFORM]: '.tf',
  [DocumentType.ANSIBLE]: '.yml',
  [DocumentType.KUBERNETES]: '.yaml',
  [DocumentType.HELM]: '.yaml',
  [DocumentType.GRAPHQL]: '.graphql',
  [DocumentType.PRISMA]: '.prisma',
  [DocumentType.README]: '.md',
  [DocumentType.CHANGELOG]: '.md',
  [DocumentType.LICENSE]: ''  // LICENSE has no extension
};

/**
 * Classify content based on keywords and patterns
 */
export function classifyDocument(content: string): DocumentType | null {
  const lowerContent = content.toLowerCase();
  
  // Score each document type based on keyword matches
  const scores: Record<DocumentType, number> = {
    // Documentation types
    [DocumentType.DESIGN]: 0,
    [DocumentType.SPECIFICATION]: 0,
    [DocumentType.TODO]: 0,
    [DocumentType.SOW]: 0,
    [DocumentType.REQUIREMENTS]: 0,
    [DocumentType.ARCHITECTURE]: 0,
    [DocumentType.API_DOC]: 0,
    [DocumentType.USER_STORY]: 0,
    [DocumentType.MEETING_NOTES]: 0,
    [DocumentType.PROJECT_PLAN]: 0,
    [DocumentType.TECHNICAL_SPEC]: 0,
    [DocumentType.IMPLEMENTATION_PLAN]: 0,
    
    // Code and configuration types
    [DocumentType.TYPESCRIPT]: 0,
    [DocumentType.JAVASCRIPT]: 0,
    [DocumentType.HTML]: 0,
    [DocumentType.CSS]: 0,
    [DocumentType.SQL]: 0,
    [DocumentType.SHELL_SCRIPT]: 0,
    [DocumentType.YAML]: 0,
    [DocumentType.JSON]: 0,
    [DocumentType.CSV]: 0,
    [DocumentType.DOCKERFILE]: 0,
    [DocumentType.ENV_CONFIG]: 0,
    [DocumentType.GITIGNORE]: 0,
    [DocumentType.PACKAGE_JSON]: 0,
    [DocumentType.WEBPACK_CONFIG]: 0,
    [DocumentType.ESLINT_CONFIG]: 0,
    [DocumentType.TSCONFIG]: 0,
    [DocumentType.FEEDBACK]: 0,
    [DocumentType.REVIEW]: 0,
    [DocumentType.RETROSPECTIVE]: 0,
    [DocumentType.SCSS]: 0,
    [DocumentType.SASS]: 0,
    [DocumentType.LESS]: 0,
    [DocumentType.XML]: 0,
    [DocumentType.MAKEFILE]: 0,
    [DocumentType.CMAKE]: 0,
    [DocumentType.GRADLE]: 0,
    [DocumentType.MAVEN]: 0,
    [DocumentType.PYTHON]: 0,
    [DocumentType.RUBY]: 0,
    [DocumentType.GO]: 0,
    [DocumentType.RUST]: 0,
    [DocumentType.JAVA]: 0,
    [DocumentType.CPP]: 0,
    [DocumentType.C]: 0,
    [DocumentType.CSHARP]: 0,
    [DocumentType.PHP]: 0,
    [DocumentType.SWIFT]: 0,
    [DocumentType.KOTLIN]: 0,
    [DocumentType.TERRAFORM]: 0,
    [DocumentType.ANSIBLE]: 0,
    [DocumentType.KUBERNETES]: 0,
    [DocumentType.HELM]: 0,
    [DocumentType.GRAPHQL]: 0,
    [DocumentType.PRISMA]: 0,
    [DocumentType.README]: 0,
    [DocumentType.CHANGELOG]: 0,
    [DocumentType.LICENSE]: 0
  };

  // Check for specific patterns that indicate document types
  for (const [docType, keywords] of Object.entries(DOCUMENT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerContent.includes(keyword)) {
        scores[docType as DocumentType] += 1;
        // Boost score if keyword appears in title/header
        if (lowerContent.includes(`# ${keyword}`) || lowerContent.includes(`## ${keyword}`)) {
          scores[docType as DocumentType] += 2;
        }
      }
    }
  }

  // Special pattern detection
  if (isMarkdownStructure(content)) {
    // Check for TODO list patterns
    if (hasTaskListPattern(content)) {
      scores[DocumentType.TODO] += 3;
    }
    
    // Check for API documentation patterns
    if (hasApiDocPattern(content)) {
      scores[DocumentType.API_DOC] += 3;
    }
    
    // Check for SOW patterns
    if (hasSOWPattern(content)) {
      scores[DocumentType.SOW] += 3;
    }
  }
  
  // Check for code patterns
  if (hasTypeScriptPattern(content)) {
    scores[DocumentType.TYPESCRIPT] += 5;
  }
  if (hasJavaScriptPattern(content)) {
    scores[DocumentType.JAVASCRIPT] += 5;
  }
  if (hasHTMLPattern(content)) {
    scores[DocumentType.HTML] += 5;
  }
  if (hasCSSPattern(content)) {
    scores[DocumentType.CSS] += 5;
  }
  if (hasSQLPattern(content)) {
    scores[DocumentType.SQL] += 5;
  }
  if (hasShellScriptPattern(content)) {
    scores[DocumentType.SHELL_SCRIPT] += 5;
  }
  if (hasYAMLPattern(content)) {
    scores[DocumentType.YAML] += 5;
  }
  if (hasJSONPattern(content)) {
    scores[DocumentType.JSON] += 5;
  }
  if (hasCSVPattern(content)) {
    scores[DocumentType.CSV] += 5;
  }
  if (hasDockerfilePattern(content)) {
    scores[DocumentType.DOCKERFILE] += 5;
  }
  if (hasEnvConfigPattern(content)) {
    scores[DocumentType.ENV_CONFIG] += 5;
  }
  if (hasPackageJsonPattern(content)) {
    scores[DocumentType.PACKAGE_JSON] += 5;
  }
  
  // Check for additional language patterns
  if (hasPythonPattern(content)) scores[DocumentType.PYTHON] += 5;
  if (hasRubyPattern(content)) scores[DocumentType.RUBY] += 5;
  if (hasGoPattern(content)) scores[DocumentType.GO] += 5;
  if (hasRustPattern(content)) scores[DocumentType.RUST] += 5;
  if (hasJavaPattern(content)) scores[DocumentType.JAVA] += 5;
  if (hasCppPattern(content)) scores[DocumentType.CPP] += 5;
  if (hasCPattern(content)) scores[DocumentType.C] += 5;
  if (hasCSharpPattern(content)) scores[DocumentType.CSHARP] += 5;
  if (hasPHPPattern(content)) scores[DocumentType.PHP] += 5;
  if (hasSwiftPattern(content)) scores[DocumentType.SWIFT] += 5;
  if (hasKotlinPattern(content)) scores[DocumentType.KOTLIN] += 5;
  
  // Check for infrastructure patterns
  if (hasTerraformPattern(content)) scores[DocumentType.TERRAFORM] += 5;
  if (hasKubernetesPattern(content)) scores[DocumentType.KUBERNETES] += 5;
  if (hasDockerComposePattern(content)) scores[DocumentType.YAML] += 3;
  
  // Check for feedback patterns
  if (hasFeedbackPattern(content)) scores[DocumentType.FEEDBACK] += 5;

  // Find the document type with the highest score
  // Prioritize documentation types over code types for mixed content
  let maxScore = 0;
  let bestType: DocumentType | null = null;
  let bestDocType: DocumentType | null = null;
  let maxDocScore = 0;

  for (const [docType, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestType = docType as DocumentType;
    }
    
    // Track best documentation type separately
    if (!isCodeFileType(docType as DocumentType) && score > maxDocScore) {
      maxDocScore = score;
      bestDocType = docType as DocumentType;
    }
  }

  // Prefer documentation types if they have a reasonable score
  if (maxDocScore >= 2) {
    return bestDocType;
  }
  
  // Only classify as code type if score is high and no doc type matched
  if (isCodeFileType(bestType!) && maxScore >= 5) {
    return bestType;
  }
  
  // Only classify if we have a reasonable confidence (score >= 2)
  return maxScore >= 2 ? bestType : null;
}

/**
 * Check if content has markdown structure
 */
function isMarkdownStructure(content: string): boolean {
  return /^#+ /.test(content) || 
         content.includes('## ') || 
         content.includes('### ') ||
         content.includes('- [ ]') ||
         content.includes('- [x]') ||
         content.includes('```');
}

/**
 * Check for task list patterns
 */
function hasTaskListPattern(content: string): boolean {
  return content.includes('- [ ]') || 
         content.includes('- [x]') ||
         /^\d+\.\s/.test(content) ||
         content.includes('TODO:') ||
         content.includes('FIXME:');
}

/**
 * Check for API documentation patterns
 */
function hasApiDocPattern(content: string): boolean {
  return content.includes('GET ') ||
         content.includes('POST ') ||
         content.includes('PUT ') ||
         content.includes('DELETE ') ||
         content.includes('PATCH ') ||
         content.includes('endpoint') ||
         content.includes('parameters') ||
         content.includes('response');
}

/**
 * Check for SOW patterns
 */
function hasSOWPattern(content: string): boolean {
  return content.includes('deliverable') ||
         content.includes('milestone') ||
         content.includes('timeline') ||
         content.includes('budget') ||
         content.includes('scope') ||
         content.includes('objective');
}

/**
 * Check for TypeScript patterns
 */
function hasTypeScriptPattern(content: string): boolean {
  return /\binterface\s+\w+/.test(content) ||
         /\btype\s+\w+\s*=/.test(content) ||
         /\benum\s+\w+/.test(content) ||
         /: (string|number|boolean|any|void)/.test(content) ||
         /\bnamespace\s+\w+/.test(content);
}

/**
 * Check for JavaScript patterns
 */
function hasJavaScriptPattern(content: string): boolean {
  return /\bfunction\s+\w+/.test(content) ||
         /\bconst\s+\w+\s*=/.test(content) ||
         /\blet\s+\w+\s*=/.test(content) ||
         /\bvar\s+\w+\s*=/.test(content) ||
         /=>/.test(content) ||
         /\.prototype\./.test(content);
}

/**
 * Check for HTML patterns
 */
function hasHTMLPattern(content: string): boolean {
  return /<(!DOCTYPE|html|head|body|div|span|p|h[1-6]|a|img|form|input|button)/.test(content) ||
         /<\/(html|head|body|div|span|p|h[1-6]|a|form)>/.test(content);
}

/**
 * Check for CSS patterns
 */
function hasCSSPattern(content: string): boolean {
  return /\.(\w+)\s*\{/.test(content) ||
         /#(\w+)\s*\{/.test(content) ||
         /\b(color|background|margin|padding|font|display|position)\s*:/.test(content) ||
         /@media\s+/.test(content);
}

/**
 * Check for SQL patterns
 */
function hasSQLPattern(content: string): boolean {
  const sqlKeywords = /\b(SELECT|INSERT INTO|UPDATE|DELETE FROM|CREATE TABLE|DROP TABLE|ALTER TABLE|FROM|WHERE|JOIN|GROUP BY|ORDER BY|HAVING|DATABASE)\b/i;
  // Require at least SQL-like structure, not just keywords
  return sqlKeywords.test(content) && 
         (content.includes('CREATE TABLE') || 
          content.includes('SELECT ') || 
          content.includes('INSERT INTO'));
}

/**
 * Check for Shell Script patterns
 */
function hasShellScriptPattern(content: string): boolean {
  // Must have shebang or multiple shell commands
  const hasShebang = /^#!\/bin\/(bash|sh)/.test(content);
  const shellCommands = content.match(/\b(echo|cd|ls|mkdir|rm|cp|mv|grep|sed|awk|chmod|chown|export)\b/g);
  const hasShellSyntax = /\bif\s+\[/.test(content) || /\bfor\s+\w+\s+in/.test(content);
  
  return hasShebang || (shellCommands && shellCommands.length > 3) || hasShellSyntax;
}

/**
 * Check for YAML patterns
 */
function hasYAMLPattern(content: string): boolean {
  return /^\w+:\s*$/m.test(content) ||
         /^\s+-\s+/m.test(content) ||
         /^\w+:\s+[^:]+$/m.test(content);
}

/**
 * Check for JSON patterns
 */
function hasJSONPattern(content: string): boolean {
  try {
    JSON.parse(content);
    return true;
  } catch {
    return /\{[\s\S]*"[\w]+"\s*:[\s\S]*\}/.test(content) ||
           /\[[\s\S]*\]/.test(content);
  }
}

/**
 * Check for CSV patterns
 */
function hasCSVPattern(content: string): boolean {
  const lines = content.split('\n');
  if (lines.length < 2) return false;
  
  const firstLine = lines[0].split(',').length;
  const secondLine = lines[1] ? lines[1].split(',').length : 0;
  
  return firstLine > 1 && firstLine === secondLine;
}

/**
 * Check for Dockerfile patterns
 */
function hasDockerfilePattern(content: string): boolean {
  return /^FROM\s+/m.test(content) ||
         /^(RUN|CMD|EXPOSE|ENV|ADD|COPY|ENTRYPOINT|VOLUME|USER|WORKDIR)\s+/m.test(content);
}

/**
 * Check for Environment Config patterns
 */
function hasEnvConfigPattern(content: string): boolean {
  return /^[A-Z_]+=[^\n]+$/m.test(content) && 
         content.split('\n').filter(line => /^[A-Z_]+=[^\n]+$/.test(line)).length > 2;
}

/**
 * Check for package.json patterns
 */
function hasPackageJsonPattern(content: string): boolean {
  try {
    const parsed = JSON.parse(content);
    return parsed.name && (parsed.dependencies || parsed.devDependencies || parsed.scripts);
  } catch {
    return false;
  }
}

/**
 * Check for Python patterns
 */
function hasPythonPattern(content: string): boolean {
  return /\bdef\s+\w+\s*\(/.test(content) ||
         /\bclass\s+\w+[\(:]/.test(content) ||
         /^from\s+\w+\s+import/m.test(content) ||
         /^import\s+\w+/m.test(content) ||
         /if\s+__name__\s*==\s*["']__main__["']/.test(content);
}

/**
 * Check for Ruby patterns
 */
function hasRubyPattern(content: string): boolean {
  return /\bdef\s+\w+/.test(content) ||
         /\bclass\s+\w+/.test(content) ||
         /\bmodule\s+\w+/.test(content) ||
         /\brequire\s+["']/.test(content) ||
         /\bputs\s+/.test(content);
}

/**
 * Check for Go patterns
 */
function hasGoPattern(content: string): boolean {
  return /^package\s+\w+/m.test(content) ||
         /\bfunc\s+\w+\s*\(/.test(content) ||
         /\btype\s+\w+\s+struct/.test(content) ||
         /^import\s+\(/m.test(content);
}

/**
 * Check for Rust patterns
 */
function hasRustPattern(content: string): boolean {
  return /\bfn\s+\w+\s*\(/.test(content) ||
         /\blet\s+(mut\s+)?\w+/.test(content) ||
         /\bimpl\s+\w+/.test(content) ||
         /\btrait\s+\w+/.test(content) ||
         /\buse\s+\w+/.test(content);
}

/**
 * Check for Java patterns
 */
function hasJavaPattern(content: string): boolean {
  return /\bpublic\s+class\s+\w+/.test(content) ||
         /\bprivate\s+(static\s+)?\w+/.test(content) ||
         /\binterface\s+\w+/.test(content) ||
         /\bextends\s+\w+/.test(content) ||
         /\bimplements\s+\w+/.test(content);
}

/**
 * Check for C++ patterns
 */
function hasCppPattern(content: string): boolean {
  return /#include\s*<\w+>/.test(content) ||
         /\bnamespace\s+\w+/.test(content) ||
         /\bclass\s+\w+\s*\{/.test(content) ||
         /\btemplate\s*</.test(content) ||
         /std::\w+/.test(content);
}

/**
 * Check for C patterns
 */
function hasCPattern(content: string): boolean {
  return /#include\s*[<"]\w+\.h[>"]/.test(content) ||
         /\btypedef\s+struct/.test(content) ||
         /\bint\s+main\s*\(/.test(content) ||
         /\bvoid\s+\w+\s*\(/.test(content);
}

/**
 * Check for C# patterns
 */
function hasCSharpPattern(content: string): boolean {
  return /\bnamespace\s+\w+/.test(content) ||
         /\bpublic\s+class\s+\w+/.test(content) ||
         /\busing\s+System/.test(content) ||
         /\basync\s+Task/.test(content);
}

/**
 * Check for PHP patterns
 */
function hasPHPPattern(content: string): boolean {
  return /<\?php/.test(content) ||
         /\bfunction\s+\w+\s*\(/.test(content) ||
         /\bclass\s+\w+\s*\{/.test(content) ||
         /\$\w+\s*=/.test(content);
}

/**
 * Check for Swift patterns
 */
function hasSwiftPattern(content: string): boolean {
  return /\bfunc\s+\w+\s*\(/.test(content) ||
         /\bvar\s+\w+\s*:/.test(content) ||
         /\blet\s+\w+\s*:/.test(content) ||
         /\bclass\s+\w+\s*:/.test(content) ||
         /\bstruct\s+\w+/.test(content);
}

/**
 * Check for Kotlin patterns
 */
function hasKotlinPattern(content: string): boolean {
  return /\bfun\s+\w+\s*\(/.test(content) ||
         /\bval\s+\w+/.test(content) ||
         /\bvar\s+\w+/.test(content) ||
         /\bclass\s+\w+/.test(content) ||
         /\bobject\s+\w+/.test(content);
}

/**
 * Check for Terraform patterns
 */
function hasTerraformPattern(content: string): boolean {
  return /\bresource\s+"\w+"\s+"\w+"/.test(content) ||
         /\bprovider\s+"\w+"/.test(content) ||
         /\bvariable\s+"\w+"/.test(content) ||
         /\boutput\s+"\w+"/.test(content);
}

/**
 * Check for Kubernetes patterns
 */
function hasKubernetesPattern(content: string): boolean {
  return /apiVersion:\s*\w+/.test(content) ||
         /kind:\s*(Deployment|Service|Pod|ConfigMap)/.test(content) ||
         /metadata:\s*\n\s+name:/.test(content);
}

/**
 * Check for Docker Compose patterns
 */
function hasDockerComposePattern(content: string): boolean {
  return /version:\s*["']\d+/.test(content) &&
         /services:\s*\n/.test(content);
}

/**
 * Check for feedback patterns
 */
function hasFeedbackPattern(content: string): boolean {
  return /feedback|\u30d5\u30a3\u30fc\u30c9\u30d0\u30c3\u30af|review|comment|suggestion/.test(content.toLowerCase()) ||
         /improvement|opinion|\u610f\u898b|\u30ec\u30d3\u30e5\u30fc|\u30b3\u30e1\u30f3\u30c8/.test(content.toLowerCase());
}

/**
 * Generate appropriate filename based on content and document type
 */
export function generateDocumentFilename(
  content: string,
  docType: DocumentType,
  userHint?: string
): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  
  // Try to extract a meaningful title from the content
  let title = extractTitleFromContent(content);
  
  // Use user hint if provided
  if (userHint) {
    title = sanitizeFilename(userHint);
  }
  
  // Fallback to template
  if (!title) {
    title = FILENAME_TEMPLATES[docType];
  }
  
  // Ensure English filename
  title = transliterateToEnglish(title);
  
  // Get appropriate file extension
  const extension = FILE_EXTENSIONS[docType] || '.md';
  
  // Format: title_YYYYMMDD with appropriate extension
  // Special cases for config files that start with dot
  if (docType === DocumentType.ENV_CONFIG) {
    return `.env`;
  }
  if (docType === DocumentType.GITIGNORE) {
    return `.gitignore`;
  }
  if (docType === DocumentType.DOCKERFILE) {
    return `Dockerfile`;
  }
  
  return `${title}_${dateStr}${extension}`;
}

/**
 * Extract title from markdown content
 */
function extractTitleFromContent(content: string): string | null {
  // Look for first h1 heading
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) {
    return sanitizeFilename(h1Match[1]);
  }
  
  // Look for first h2 heading
  const h2Match = content.match(/^##\s+(.+)$/m);
  if (h2Match) {
    return sanitizeFilename(h2Match[1]);
  }
  
  // Look for title-like patterns
  const titleMatch = content.match(/(?:title|name):\s*(.+)/i);
  if (titleMatch) {
    return sanitizeFilename(titleMatch[1]);
  }
  
  return null;
}

/**
 * Sanitize filename for filesystem
 */
function sanitizeFilename(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '_')     // Replace spaces with underscores
    .replace(/_+/g, '_')      // Remove multiple underscores
    .slice(0, 50);            // Limit length
}

/**
 * Simple transliteration for common non-English characters
 */
function transliterateToEnglish(text: string): string {
  const transliterationMap: Record<string, string> = {
    // Japanese katakana/hiragana to romaji (basic)
    'デザイン': 'design',
    'システム': 'system', 
    'プロジェクト': 'project',
    '仕様書': 'specification',
    '設計書': 'design_document',
    '要件定義': 'requirements',
    'TODO': 'todo',
    'タスク': 'task',
    'スケジュール': 'schedule',
    'ミーティング': 'meeting',
    'アーキテクチャ': 'architecture',
    'API': 'api',
    'ユーザー': 'user',
    'ストーリー': 'story',
    '実装': 'implementation',
    '計画': 'plan'
  };

  let result = text;
  for (const [original, transliterated] of Object.entries(transliterationMap)) {
    result = result.replace(new RegExp(original, 'g'), transliterated);
  }
  
  return result;
}

/**
 * Check if document type is a code file type
 */
function isCodeFileType(docType: DocumentType): boolean {
  return [
    DocumentType.TYPESCRIPT,
    DocumentType.JAVASCRIPT,
    DocumentType.HTML,
    DocumentType.CSS,
    DocumentType.SCSS,
    DocumentType.SASS,
    DocumentType.LESS,
    DocumentType.SQL,
    DocumentType.SHELL_SCRIPT,
    DocumentType.YAML,
    DocumentType.JSON,
    DocumentType.XML,
    DocumentType.CSV,
    DocumentType.DOCKERFILE,
    DocumentType.ENV_CONFIG,
    DocumentType.GITIGNORE,
    DocumentType.PACKAGE_JSON,
    DocumentType.WEBPACK_CONFIG,
    DocumentType.ESLINT_CONFIG,
    DocumentType.TSCONFIG,
    DocumentType.MAKEFILE,
    DocumentType.CMAKE,
    DocumentType.GRADLE,
    DocumentType.MAVEN,
    DocumentType.PYTHON,
    DocumentType.RUBY,
    DocumentType.GO,
    DocumentType.RUST,
    DocumentType.JAVA,
    DocumentType.CPP,
    DocumentType.C,
    DocumentType.CSHARP,
    DocumentType.PHP,
    DocumentType.SWIFT,
    DocumentType.KOTLIN,
    DocumentType.TERRAFORM,
    DocumentType.ANSIBLE,
    DocumentType.KUBERNETES,
    DocumentType.HELM,
    DocumentType.GRAPHQL,
    DocumentType.PRISMA
  ].includes(docType);
}

/**
 * Check if document type is a code file
 */
function isCodeFile(docType: DocumentType): boolean {
  return [
    DocumentType.TYPESCRIPT,
    DocumentType.JAVASCRIPT,
    DocumentType.HTML,
    DocumentType.CSS,
    DocumentType.SQL,
    DocumentType.SHELL_SCRIPT,
    DocumentType.YAML,
    DocumentType.JSON,
    DocumentType.CSV,
    DocumentType.DOCKERFILE,
    DocumentType.ENV_CONFIG,
    DocumentType.GITIGNORE,
    DocumentType.PACKAGE_JSON,
    DocumentType.WEBPACK_CONFIG,
    DocumentType.ESLINT_CONFIG,
    DocumentType.TSCONFIG
  ].includes(docType);
}

/**
 * Format content as proper markdown or code file
 */
export function formatAsMarkdown(content: string, docType: DocumentType): string {
  let formatted = content;
  
  // For code files, return content as-is (no markdown formatting)
  if (isCodeFile(docType)) {
    // Just ensure proper line endings
    return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }
  
  // For documentation files, apply markdown formatting
  // Ensure proper markdown headers
  if (!formatted.startsWith('#')) {
    const title = extractTitleFromContent(content) || FILENAME_TEMPLATES[docType].replace('_', ' ');
    formatted = `# ${title}\n\n${formatted}`;
  }
  
  // Add metadata header
  const metadata = generateMetadata(docType);
  formatted = `${metadata}\n\n${formatted}`;
  
  // Ensure proper line endings
  formatted = formatted.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Add footer with generation info
  const footer = `\n---\n\n*Generated by MARIA CODE v3.8.0 on ${new Date().toISOString().slice(0, 10)}*\n`;
  formatted = `${formatted}${footer}`;
  
  return formatted;
}

/**
 * Generate document metadata
 */
function generateMetadata(docType: DocumentType): string {
  const now = new Date();
  return `---
type: ${docType}
created: ${now.toISOString()}
generator: MARIA CODE v3.8.0
---`;
}

/**
 * Save document to file
 */
export async function saveDocumentToFile(
  content: string,
  docType: DocumentType,
  userHint?: string
): Promise<string> {
  const filename = generateDocumentFilename(content, docType, userHint);
  const formattedContent = formatAsMarkdown(content, docType);
  const filePath = path.resolve(process.cwd(), filename);
  
  await writeFile(filePath, formattedContent, 'utf8');
  
  return filePath;
}

/**
 * Main function to auto-save documents
 * Returns the saved file path if document was saved, null otherwise
 */
export async function autoSaveDocument(
  content: string,
  userHint?: string
): Promise<string | null> {
  const docType = classifyDocument(content);
  
  if (!docType) {
    // Not a recognized document type
    return null;
  }
  
  try {
    const filePath = await saveDocumentToFile(content, docType, userHint);
    return filePath;
  } catch (error) {
    console.error('Error auto-saving document:', error);
    return null;
  }
}

/**
 * Auto-save multiple documents from a single response
 * Splits content by document markers and saves each separately
 */
export async function autoSaveMultipleDocuments(
  content: string,
  baseHint?: string
): Promise<string[]> {
  const savedPaths: string[] = [];
  
  // Check for multiple document patterns
  const documentSections = splitIntoDocuments(content);
  
  if (documentSections.length > 1) {
    // Multiple documents detected
    for (let i = 0; i < documentSections.length; i++) {
      const section = documentSections[i];
      const docType = classifyDocument(section);
      
      if (docType) {
        const hint = baseHint ? `${baseHint}_${i + 1}` : undefined;
        try {
          const filePath = await saveDocumentToFile(section, docType, hint);
          savedPaths.push(filePath);
        } catch (error) {
          console.error(`Error saving document ${i + 1}:`, error);
        }
      }
    }
  } else {
    // Single document
    const savedPath = await autoSaveDocument(content, baseHint);
    if (savedPath) savedPaths.push(savedPath);
  }
  
  return savedPaths;
}

/**
 * Split content into multiple documents based on markers
 */
function splitIntoDocuments(content: string): string[] {
  // For code files, never split - always treat as single document
  const detectedType = classifyDocument(content);
  if (detectedType && isCodeFileType(detectedType)) {
    return [content];
  }
  
  // Look for document boundaries
  const sections: string[] = [];
  
  // Pattern 1: Multiple H1 headers that indicate separate documents
  // Only split if we have clear document-type headers
  const h1Matches = content.match(/^# (?:Statement of Work|SOW|Requirements|Technical Specification|Architecture|TODO|Project Plan|Design Document|User Stories)/gm);
  if (h1Matches && h1Matches.length > 1) {
    const majorSections = content.split(/^(?=# (?:Statement of Work|SOW|Requirements|Technical Specification|Architecture|TODO|Project Plan|Design Document|User Stories))/m);
    return majorSections.filter(s => s.trim());
  }
  
  // Pattern 2: Explicit document separators
  const separatorPattern = /^---\s*Document\s*\d+\s*---$/m;
  if (separatorPattern.test(content)) {
    return content.split(separatorPattern).filter(s => s.trim());
  }
  
  // Default: treat as single document
  return [content];
}