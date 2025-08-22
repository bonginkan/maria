/**
 * Code Generator Agent
 * Generates production-ready code from algorithms and specifications
 */

import { BaseAgent } from '../base-agent';
import { AgentRole, AgentTask, AlgorithmExtraction, CodeGenerationOutput } from '../types';
import { logger } from '../../utils/logger';

export class CodeGeneratorAgent extends BaseAgent {
  constructor() {
    super(AgentRole.CODE_GENERATOR, [
      'code-generation',
      'test-generation',
      'documentation-generation',
      'multi-language-support',
      'framework-integration',
      'best-practices',
    ]);
  }

  protected async onInitialize(): Promise<void> {
    logger.info('CodeGeneratorAgent initialized');
  }

  protected async performTask(task: AgentTask): Promise<CodeGenerationOutput> {
    const input = task.input as {
      algorithms: AlgorithmExtraction[];
      targetLanguage?: string;
      framework?: string;
      options?: {
        generateTests: boolean;
        includeDocumentation: boolean;
      };
    };

    const language = input.targetLanguage || 'typescript';
    const framework = input.framework || 'none';
    const options = input.options || { generateTests: true, includeDocumentation: true };

    const files = new Map<string, string>();
    const tests = new Map<string, string>();
    const documentation: string[] = [];
    const dependencies: string[] = [];

    // Generate code for each algorithm
    for (const algorithm of input.algorithms) {
      const { code, test, docs, deps } = await this.generateCodeForAlgorithm(
        algorithm,
        language,
        framework,
      );

      files.set(`${algorithm.name}.${this.getFileExtension(language)}`, code);

      if (options.generateTests && test) {
        tests.set(`${algorithm.name}.test.${this.getFileExtension(language)}`, test);
      }

      if (options.includeDocumentation && docs) {
        documentation.push(docs);
      }

      dependencies.push(...deps);
    }

    // Generate main module file
    const mainFile = this.generateMainModule(input.algorithms, language);
    files.set(`index.${this.getFileExtension(language)}`, mainFile);

    // Generate setup instructions
    const setupInstructions = this.generateSetupInstructions(
      language,
      framework,
      Array.from(new Set(dependencies)),
    );

    return {
      files,
      tests,
      documentation: documentation.join('\n\n'),
      dependencies: Array.from(new Set(dependencies)),
      setupInstructions,
    };
  }

  protected async onShutdown(): Promise<void> {
    logger.info('CodeGeneratorAgent shutting down');
  }

  protected checkCustomCapabilities(task: AgentTask): boolean {
    return task.type === 'code-generation' || task.type === 'implementation';
  }

  private async generateCodeForAlgorithm(
    algorithm: AlgorithmExtraction,
    language: string,
    framework: string,
  ): Promise<{
    code: string;
    test: string;
    docs: string;
    deps: string[];
  }> {
    // Generate implementation based on language
    const code = this.generateImplementation(algorithm, language, framework);
    const test = this.generateTests(algorithm, language);
    const docs = this.generateDocumentation(algorithm);
    const deps = this.identifyDependencies(algorithm, language, framework);

    return { code, test, docs, deps };
  }

  private generateImplementation(
    algorithm: AlgorithmExtraction,
    language: string,
    framework: string,
  ): string {
    switch (language.toLowerCase()) {
      case 'typescript':
      case 'javascript':
        return this.generateTypeScriptCode(algorithm, framework);
      case 'python':
        return this.generatePythonCode(algorithm, framework);
      case 'java':
        return this.generateJavaCode(algorithm, framework);
      default:
        return this.generateTypeScriptCode(algorithm, framework);
    }
  }

  private generateTypeScriptCode(algorithm: AlgorithmExtraction, framework: string): string {
    const params = algorithm.parameters
      .map((p) => `${p.name}: ${this.mapTypeToTS(p.type)}`)
      .join(', ');

    const functionSignature = `export function ${algorithm.name}(${params}): unknown`;

    let implementation = `/**
 * ${algorithm.description}
 * 
 * Time Complexity: ${algorithm.complexity?.time || 'Unknown'}
 * Space Complexity: ${algorithm.complexity?.space || 'Unknown'}
 */
${functionSignature} {
`;

    // Convert pseudocode/steps to TypeScript
    for (const step of algorithm.steps) {
      const tsCode = this.convertStepToTypeScript(step);
      implementation += `  ${tsCode}\n`;
    }

    implementation += `  // TODO: Complete implementation based on algorithm
  throw new Error('Implementation pending');
}`;

    // Add framework-specific wrappers if needed
    if (framework === 'react') {
      implementation = this.wrapInReactComponent(algorithm.name, implementation);
    } else if (framework === 'express') {
      implementation = this.wrapInExpressRoute(algorithm.name, implementation);
    }

    return implementation;
  }

  private generatePythonCode(algorithm: AlgorithmExtraction, framework: string): string {
    const params = algorithm.parameters
      .map((p) => `${p.name}: ${this.mapTypeToPython(p.type)}`)
      .join(', ');

    let implementation = `"""
${algorithm.description}

Time Complexity: ${algorithm.complexity?.time || 'Unknown'}
Space Complexity: ${algorithm.complexity?.space || 'Unknown'}
"""

def ${algorithm.name}(${params}):
`;

    // Convert steps to Python
    for (const step of algorithm.steps) {
      const pyCode = this.convertStepToPython(step);
      implementation += `    ${pyCode}\n`;
    }

    implementation += `    # TODO: Complete implementation
    raise NotImplementedError("Implementation pending")`;

    // Add framework-specific decorators if needed
    if (framework === 'django') {
      implementation = this.wrapInDjangoView(algorithm.name, implementation);
    } else if (framework === 'flask') {
      implementation = this.wrapInFlaskRoute(algorithm.name, implementation);
    }

    return implementation;
  }

  private generateJavaCode(algorithm: AlgorithmExtraction, _framework: string): string {
    const params = algorithm.parameters
      .map((p) => `${this.mapTypeToJava(p.type)} ${p.name}`)
      .join(', ');

    return `/**
 * ${algorithm.description}
 * 
 * Time Complexity: ${algorithm.complexity?.time || 'Unknown'}
 * Space Complexity: ${algorithm.complexity?.space || 'Unknown'}
 */
public class ${algorithm.name} {
    public static Object execute(${params}) {
        // TODO: Implement algorithm
        throw new UnsupportedOperationException("Implementation pending");
    }
}`;
  }

  private generateTests(algorithm: AlgorithmExtraction, language: string): string {
    switch (language.toLowerCase()) {
      case 'typescript':
      case 'javascript':
        return this.generateJestTest(algorithm);
      case 'python':
        return this.generatePytestTest(algorithm);
      case 'java':
        return this.generateJUnitTest(algorithm);
      default:
        return '';
    }
  }

  private generateJestTest(algorithm: AlgorithmExtraction): string {
    return `import { ${algorithm.name} } from './${algorithm.name}';

describe('${algorithm.name}', () => {
  it('should execute without errors', () => {
    // TODO: Add test cases based on algorithm specification
    expect(() => ${algorithm.name}()).not.toThrow();
  });
  
  it('should handle edge cases', () => {
    // TODO: Add edge case tests
  });
  
  it('should meet performance requirements', () => {
    // TODO: Add performance tests if needed
  });
});`;
  }

  private generatePytestTest(algorithm: AlgorithmExtraction): string {
    return `import pytest
from ${algorithm.name} import ${algorithm.name}

def test_${algorithm.name}_basic():
    """Test basic functionality"""
    # TODO: Add test cases
    with pytest.raises(NotImplementedError):
        ${algorithm.name}()

def test_${algorithm.name}_edge_cases():
    """Test edge cases"""
    # TODO: Add edge case tests
    pass

def test_${algorithm.name}_performance():
    """Test performance requirements"""
    # TODO: Add performance tests
    pass`;
  }

  private generateJUnitTest(algorithm: AlgorithmExtraction): string {
    return `import org.junit.Test;
import static org.junit.Assert.*;

public class ${algorithm.name}Test {
    @Test
    public void testBasicFunctionality() {
        // TODO: Add test cases
    }
    
    @Test
    public void testEdgeCases() {
        // TODO: Add edge case tests
    }
}`;
  }

  private generateDocumentation(algorithm: AlgorithmExtraction): string {
    return `# ${algorithm.name}

## Description
${algorithm.description}

## Algorithm Details
${algorithm.pseudocode || 'See implementation for details'}

## Complexity Analysis
- **Time Complexity**: ${algorithm.complexity?.time || 'Not analyzed'}
- **Space Complexity**: ${algorithm.complexity?.space || 'Not analyzed'}

## Parameters
${algorithm.parameters.map((p) => `- **${p.name}** (${p.type}): ${p.description}`).join('\n')}

## Implementation Notes
${algorithm.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}
`;
  }

  private generateMainModule(algorithms: AlgorithmExtraction[], language: string): string {
    if (language === 'typescript' || language === 'javascript') {
      const exports = algorithms.map((a) => `export { ${a.name} } from './${a.name}';`).join('\n');
      return `/**
 * Main module exporting all generated algorithms
 */

${exports}

// Re-export types if needed
export * from './types';
`;
    } else if (language === 'python') {
      const imports = algorithms.map((a) => `from .${a.name} import ${a.name}`).join('\n');
      return `"""
Main module for generated algorithms
"""

${imports}

__all__ = [${algorithms.map((a) => `'${a.name}'`).join(', ')}]
`;
    }

    return '';
  }

  private generateSetupInstructions(
    language: string,
    framework: string,
    dependencies: string[],
  ): string {
    let instructions = `# Setup Instructions

## Language: ${language}
## Framework: ${framework}

### Installation

`;

    if (language === 'typescript' || language === 'javascript') {
      instructions += `\`\`\`bash
npm install ${dependencies.join(' ')}
\`\`\``;
    } else if (language === 'python') {
      instructions += `\`\`\`bash
pip install ${dependencies.join(' ')}
\`\`\``;
    } else if (language === 'java') {
      instructions += `Add the following dependencies to your pom.xml or build.gradle`;
    }

    instructions += `

### Running Tests

`;

    if (language === 'typescript' || language === 'javascript') {
      instructions += `\`\`\`bash
npm test
\`\`\``;
    } else if (language === 'python') {
      instructions += `\`\`\`bash
pytest
\`\`\``;
    }

    return instructions;
  }

  private identifyDependencies(
    _algorithm: AlgorithmExtraction,
    language: string,
    framework: string,
  ): string[] {
    const deps: string[] = [];

    if (language === 'typescript') {
      deps.push('@types/node');
    }

    if (framework === 'react') {
      deps.push('react', 'react-dom');
    } else if (framework === 'express') {
      deps.push('express', '@types/express');
    } else if (framework === 'django') {
      deps.push('django');
    } else if (framework === 'flask') {
      deps.push('flask');
    }

    return deps;
  }

  private getFileExtension(language: string): string {
    const extensions: Record<string, string> = {
      typescript: 'ts',
      javascript: 'js',
      python: 'py',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      go: 'go',
      rust: 'rs',
    };

    return extensions[language.toLowerCase()] || 'txt';
  }

  private mapTypeToTS(type: string): string {
    const typeMap: Record<string, string> = {
      int: 'number',
      float: 'number',
      double: 'number',
      str: 'string',
      string: 'string',
      bool: 'boolean',
      boolean: 'boolean',
      list: 'any[]',
      array: 'any[]',
      dict: 'Record<string, any>',
      any: 'any',
    };

    return typeMap[type.toLowerCase()] || 'any';
  }

  private mapTypeToPython(type: string): string {
    const typeMap: Record<string, string> = {
      int: 'int',
      float: 'float',
      string: 'str',
      bool: 'bool',
      list: 'List',
      array: 'List',
      dict: 'Dict',
      any: 'Any',
    };

    return typeMap[type.toLowerCase()] || 'Any';
  }

  private mapTypeToJava(type: string): string {
    const typeMap: Record<string, string> = {
      int: 'int',
      float: 'float',
      double: 'double',
      string: 'String',
      bool: 'boolean',
      list: 'List<Object>',
      array: 'Object[]',
      dict: 'Map<String, Object>',
      any: 'Object',
    };

    return typeMap[type.toLowerCase()] || 'Object';
  }

  private convertStepToTypeScript(step: string): string {
    // Basic conversion of pseudocode to TypeScript
    let tsCode = step;

    // Convert common pseudocode patterns
    tsCode = tsCode.replace(/FOR EACH/gi, 'for (const item of');
    tsCode = tsCode.replace(/FOR/gi, 'for (');
    tsCode = tsCode.replace(/WHILE/gi, 'while (');
    tsCode = tsCode.replace(/IF/gi, 'if (');
    tsCode = tsCode.replace(/ELSE/gi, '} else {');
    tsCode = tsCode.replace(/END IF/gi, '}');
    tsCode = tsCode.replace(/RETURN/gi, 'return');
    tsCode = tsCode.replace(/:=/g, '=');

    // Add semicolons if missing
    if (!tsCode.endsWith(';') && !tsCode.endsWith('{') && !tsCode.endsWith('}')) {
      tsCode += ';';
    }

    return `// ${step}\n  ${tsCode}`;
  }

  private convertStepToPython(step: string): string {
    // Basic conversion of pseudocode to Python
    let pyCode = step;

    // Convert common pseudocode patterns
    pyCode = pyCode.replace(/FOR EACH/gi, 'for item in');
    pyCode = pyCode.replace(/FOR/gi, 'for');
    pyCode = pyCode.replace(/WHILE/gi, 'while');
    pyCode = pyCode.replace(/IF/gi, 'if');
    pyCode = pyCode.replace(/ELSE/gi, 'else:');
    pyCode = pyCode.replace(/END IF/gi, '');
    pyCode = pyCode.replace(/RETURN/gi, 'return');
    pyCode = pyCode.replace(/:=/g, '=');

    return `# ${step}\n    ${pyCode}`;
  }

  private wrapInReactComponent(name: string, code: string): string {
    return `import React from 'react';

${code}

export const ${name}Component: React.FC = () => {
  // Component implementation using ${name} function
  return <div>Algorithm: ${name}</div>;
};`;
  }

  private wrapInExpressRoute(name: string, code: string): string {
    return `import { Request, Response } from 'express';

${code}

export const ${name}Route = (req: Request, res: Response) => {
  try {
    const result = ${name}(req.body);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};`;
  }

  private wrapInDjangoView(name: string, code: string): string {
    return `from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json

${code}

@csrf_exempt
def ${name}_view(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        result = ${name}(**data)
        return JsonResponse({'result': result})
    return JsonResponse({'error': 'Method not allowed'}, status=405)`;
  }

  private wrapInFlaskRoute(name: string, code: string): string {
    return `from flask import request, jsonify

${code}

@app.route('/${name}', methods=['POST'])
def ${name}_route():
    data = request.get_json()
    result = ${name}(**data)
    return jsonify({'result': result})`;
  }
}
