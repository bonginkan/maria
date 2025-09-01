/**
 * CodeGenerationEngine - Generates and modifies code with safety constraints
 * Focuses on file deltas with strict LOC limits
 */

import { 
  ModifiedCode, 
  CodeContext, 
  JSONPatch, 
  UnifiedDiff,
  PatchValidation 
} from './contracts';
import { ModelSelector } from '../selector/ModelSelector';

export class CodeGenerationEngine {
  private modelSelector: ModelSelector;
  private readonly MAX_LOC_PER_OPERATION = 500;
  private readonly DANGEROUS_PATTERNS = [
    /rm\s+-rf/,
    /sudo/,
    /eval\(/,
    /exec\(/,
    /process\.env\./,
    /require\(['"]child_process['"]\)/,
    /\.env/,
    /password|secret|key|token/i
  ];
  
  constructor() {
    this.modelSelector = new ModelSelector();
  }
  
  /**
   * Modify existing code with constraints
   */
  async modifyCode(
    existingCode: string,
    modifications: string,
    context: CodeContext
  ): Promise<ModifiedCode> {
    // Select appropriate model
    const model = this.modelSelector.choose({
      task: 'refactor',
      contextTokens: this.estimateTokens(existingCode + modifications),
      latencyBudget: 3000,
      allowVision: false
    });
    
    // Generate patch
    const patch = await this.generatePatch(existingCode, modifications, context);
    
    // Validate patch safety
    const validation = this.validatePatch(patch, existingCode);
    if (!validation.safe) {
      throw new Error(`Unsafe patch: ${validation.reason}`);
    }
    
    // Apply patch to create preview
    const modifiedCode = this.applyPatch(existingCode, patch);
    
    return {
      originalCode: existingCode,
      modifiedCode,
      patch,
      estimatedLOC: this.countLOC(patch),
      confidence: validation.confidence,
      reasoning: validation.reasoning || []
    };
  }
  
  /**
   * Generate code for new file
   */
  async generateNewCode(
    description: string,
    context: CodeContext
  ): Promise<string> {
    // Build generation prompt
    const prompt = this.buildGenerationPrompt(description, context);
    
    // Select model
    const model = this.modelSelector.choose({
      task: 'scaffold',
      contextTokens: this.estimateTokens(prompt),
      latencyBudget: 5000,
      allowVision: false
    });
    
    // Generate code (mock for now)
    const generatedCode = await this.callModelForGeneration(model, prompt);
    
    // Validate generated code
    const validation = this.validateGeneratedCode(generatedCode);
    if (!validation.safe) {
      throw new Error(`Generated code failed validation: ${validation.reason}`);
    }
    
    return generatedCode;
  }
  
  /**
   * Generate patch from existing code and modifications
   */
  private async generatePatch(
    existingCode: string,
    modifications: string,
    context: CodeContext
  ): Promise<UnifiedDiff> {
    // Build prompt for patch generation
    const prompt = `
Generate a unified diff patch to apply these modifications to the existing code.

Existing code:
\`\`\`${context.language}
${existingCode}
\`\`\`

Modifications requested:
"${modifications}"

Project context:
- Language: ${context.language}
- Framework: ${context.framework || 'none'}
- Patterns: Follow existing code style

Generate ONLY a unified diff in standard format:
\`\`\`diff
--- a/file.ts
+++ b/file.ts
@@ -line,count +line,count @@
 context lines
-removed lines
+added lines
 context lines
\`\`\`

Rules:
1. Minimize changes - only modify what's necessary
2. Preserve existing code style and formatting
3. Keep changes under ${this.MAX_LOC_PER_OPERATION} lines
4. Do not add debugging code or console.logs
5. Maintain type safety`;

    // Mock response for now
    const diff = this.generateMockDiff(existingCode, modifications);
    
    return diff;
  }
  
  /**
   * Validate patch for safety and constraints
   */
  validatePatch(patch: JSONPatch | UnifiedDiff, originalCode: string): PatchValidation {
    const patchText = typeof patch === 'string' ? patch : JSON.stringify(patch);
    const loc = this.countLOC(patch);
    
    // Check LOC limits
    if (loc > this.MAX_LOC_PER_OPERATION) {
      return {
        safe: false,
        reason: `Patch exceeds ${this.MAX_LOC_PER_OPERATION} LOC limit (found ${loc})`,
        confidence: 1.0
      };
    }
    
    // Check for dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(patchText)) {
        return {
          safe: false,
          reason: `Contains potentially dangerous pattern: ${pattern.source}`,
          confidence: 0.9
        };
      }
    }
    
    // Check for environment variable access
    if (patchText.includes('process.env') && !originalCode.includes('process.env')) {
      return {
        safe: false,
        reason: 'Introduces new environment variable access',
        confidence: 0.8,
        warnings: ['New environment variables require manual review']
      };
    }
    
    // Check for file system operations
    const fsPatterns = ['fs.', 'readFile', 'writeFile', 'unlink', 'rmdir'];
    for (const pattern of fsPatterns) {
      if (patchText.includes(pattern) && !originalCode.includes(pattern)) {
        return {
          safe: false,
          reason: `Introduces file system operations: ${pattern}`,
          confidence: 0.85,
          warnings: ['File system operations require elevated permissions']
        };
      }
    }
    
    // Patch passes all safety checks
    return {
      safe: true,
      reason: 'Patch passes all safety validations',
      confidence: 0.95,
      reasoning: [
        `${loc} LOC within safe limits`,
        'No dangerous patterns detected',
        'No unauthorized operations introduced'
      ]
    };
  }
  
  /**
   * Apply patch to code
   */
  private applyPatch(originalCode: string, patch: JSONPatch | UnifiedDiff): string {
    if (typeof patch === 'string') {
      return this.applyUnifiedDiff(originalCode, patch);
    } else {
      return this.applyJSONPatch(originalCode, patch);
    }
  }
  
  /**
   * Apply unified diff to code
   */
  private applyUnifiedDiff(originalCode: string, diff: string): string {
    // Simple implementation - in production would use a proper diff library
    const lines = originalCode.split('\n');
    const diffLines = diff.split('\n');
    
    // Parse diff to find changes
    const changes: Array<{line: number; remove: string[]; add: string[]}> = [];
    let currentChange: any = null;
    
    for (const line of diffLines) {
      if (line.startsWith('@@')) {
        // Parse line numbers
        const match = line.match(/@@ -(\d+),(\d+) \+(\d+),(\d+) @@/);
        if (match) {
          currentChange = {
            line: parseInt(match[1]) - 1,
            remove: [],
            add: []
          };
          changes.push(currentChange);
        }
      } else if (currentChange) {
        if (line.startsWith('-')) {
          currentChange.remove.push(line.substring(1));
        } else if (line.startsWith('+')) {
          currentChange.add.push(line.substring(1));
        }
      }
    }
    
    // Apply changes (simplified)
    let result = lines;
    for (const change of changes.reverse()) {
      result.splice(change.line, change.remove.length, ...change.add);
    }
    
    return result.join('\n');
  }
  
  /**
   * Apply JSON patch to code
   */
  private applyJSONPatch(originalCode: string, patch: JSONPatch): string {
    // Would use a JSON patch library in production
    // For now, return original code
    return originalCode;
  }
  
  /**
   * Count lines of code in patch
   */
  private countLOC(patch: JSONPatch | UnifiedDiff): number {
    if (typeof patch === 'string') {
      // Count added and removed lines in diff
      const lines = patch.split('\n');
      let count = 0;
      for (const line of lines) {
        if (line.startsWith('+') || line.startsWith('-')) {
          if (!line.startsWith('+++') && !line.startsWith('---')) {
            count++;
          }
        }
      }
      return count;
    } else {
      // Estimate LOC for JSON patch
      return 10; // Simplified estimation
    }
  }
  
  /**
   * Validate generated code
   */
  private validateGeneratedCode(code: string): PatchValidation {
    // Check for dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(code)) {
        return {
          safe: false,
          reason: `Generated code contains dangerous pattern: ${pattern.source}`,
          confidence: 0.9
        };
      }
    }
    
    // Check code length
    const lines = code.split('\n').length;
    if (lines > this.MAX_LOC_PER_OPERATION) {
      return {
        safe: false,
        reason: `Generated code exceeds ${this.MAX_LOC_PER_OPERATION} lines`,
        confidence: 1.0
      };
    }
    
    // Basic syntax validation (would use proper parser in production)
    const hasBalancedBraces = this.checkBalancedBraces(code);
    if (!hasBalancedBraces) {
      return {
        safe: false,
        reason: 'Generated code has unbalanced braces',
        confidence: 0.8,
        warnings: ['Syntax may be invalid']
      };
    }
    
    return {
      safe: true,
      reason: 'Generated code passes validation',
      confidence: 0.9,
      reasoning: [
        'No dangerous patterns',
        `${lines} lines within limits`,
        'Syntax appears valid'
      ]
    };
  }
  
  /**
   * Build prompt for code generation
   */
  private buildGenerationPrompt(description: string, context: CodeContext): string {
    return `
Generate ${context.language} code for: "${description}"

Context:
- Language: ${context.language}
- Framework: ${context.framework || 'none'}
- Project structure: ${JSON.stringify(context.projectStructure, null, 2)}

Requirements:
1. Follow existing code patterns
2. Include proper error handling
3. Add TypeScript types if applicable
4. Keep code concise and readable
5. No console.log or debug statements
6. Include brief comments for complex logic

Generate ONLY the code, no explanations:`;
  }
  
  /**
   * Estimate token count
   */
  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
  
  /**
   * Mock model call for generation
   */
  private async callModelForGeneration(model: any, prompt: string): Promise<string> {
    // Mock response - would call actual Gemini API
    return `
export class ExampleService {
  constructor(private config: ServiceConfig) {}
  
  async process(data: any): Promise<ProcessResult> {
    try {
      // Validate input
      if (!data) {
        throw new Error('Invalid input data');
      }
      
      // Process data
      const result = await this.performProcessing(data);
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  private async performProcessing(data: any): Promise<any> {
    // Implementation details
    return data;
  }
}`;
  }
  
  /**
   * Generate mock diff for testing
   */
  private generateMockDiff(originalCode: string, modifications: string): UnifiedDiff {
    // Simple mock diff
    return `--- a/file.ts
+++ b/file.ts
@@ -1,5 +1,6 @@
 export class ExampleClass {
   constructor() {
+    // ${modifications}
     this.initialized = true;
   }
 }`;
  }
  
  /**
   * Check for balanced braces
   */
  private checkBalancedBraces(code: string): boolean {
    const stack: string[] = [];
    const pairs: Record<string, string> = {
      '{': '}',
      '[': ']',
      '(': ')'
    };
    
    for (const char of code) {
      if (char in pairs) {
        stack.push(char);
      } else if (Object.values(pairs).includes(char)) {
        const last = stack.pop();
        if (!last || pairs[last] !== char) {
          return false;
        }
      }
    }
    
    return stack.length === 0;
  }
}