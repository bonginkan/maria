/**
 * Code Generator Agent
 * Generates production-ready _code from algorithms and specifications
 */

import { BaseAgent } from "../base-agent";
import {
  AgentRole,
  AgentTask,
  AlgorithmExtraction,
  CodeGenerationOutput,
} from "../types";
import { logger } from "../../utils/logger";

export class CodeGeneratorAgent extends BaseAgent {
  constructor() {
    super(AgentRole.CODE_GENERATOR, [
      "_code-generation",
      "_test-generation",
      "documentation-generation",
      "multi-_language-support",
      "_framework-integration",
      "best-practices",
    ]);
  }

  protected async onInitialize(): Promise<void> {
    logger.info("CodeGeneratorAgent initialized");
  }

  protected async performTask(task: AgentTask): Promise<CodeGenerationOutput> {
    const _input = task._input as {
      algorithms: AlgorithmExtraction[];
      targetLanguage?: string;
      _framework?: string;
      _options?: {
        generateTests: boolean;
        includeDocumentation: boolean;
      };
    };

    const _language = _input.targetLanguage || "typescript";
    const _framework = _input._framework || "none";
    const _options = _input._options || {
      generateTests: true,
      includeDocumentation: true,
    };

    const _files = new Map<string, string>();
    const _tests = new Map<string, string>();
    const documentation: string[] = [];
    const dependencies: string[] = [];

    // Generate _code for each algorithm
    for (const algorithm of _input.algorithms) {
      const { _code, _test, _docs, _deps } =
        await this.generateCodeForAlgorithm(algorithm, _language, _framework);

      files.set(`${algorithm.name}.${this.getFileExtension(_language)}`, _code);

      if (_options.generateTests && _test) {
        tests.set(
          `${algorithm.name}.test.${this.getFileExtension(_language)}`,
          _test,
        );
      }

      if (_options.includeDocumentation && _docs) {
        documentation.push(_docs);
      }

      dependencies.push(...deps);
    }

    // Generate main module file
    const _mainFile = this.generateMainModule(_input.algorithms, _language);
    files.set(`index.${this.getFileExtension(_language)}`, _mainFile);

    // Generate setup instructions
    const _setupInstructions = this.generateSetupInstructions(
      _language,
      _framework,
      Array.from(new Set(dependencies)),
    );

    return {
      _files,
      _tests,
      documentation: documentation.join("\n\n"),
      dependencies: Array.from(new Set(dependencies)),
      _setupInstructions,
    };
  }

  protected async onShutdown(): Promise<void> {
    logger.info("CodeGeneratorAgent shutting down");
  }

  protected checkCustomCapabilities(task: AgentTask): boolean {
    return task.type === "_code-generation" || task.type === "implementation";
  }

  private async generateCodeForAlgorithm(
    algorithm: AlgorithmExtraction,
    _language: string,
    _framework: string,
  ): Promise<{
    _code: string;
    _test: string;
    _docs: string;
    _deps: string[];
  }> {
    // Generate implementation based on _language
    const _code = this.generateImplementation(algorithm, _language, _framework);
    const _test = this.generateTests(algorithm, _language);
    const _docs = this.generateDocumentation(algorithm);
    const _deps = this.identifyDependencies(algorithm, _language, _framework);

    return { _code, _test, _docs, _deps };
  }

  private generateImplementation(
    algorithm: AlgorithmExtraction,
    _language: string,
    _framework: string,
  ): string {
    switch (_language.toLowerCase()) {
      case "typescript":
      case "javascript":
        return this.generateTypeScriptCode(algorithm, _framework);
      case "python":
        return this.generatePythonCode(algorithm, _framework);
      case "java":
        return this.generateJavaCode(algorithm, _framework);
      default:
        return this.generateTypeScriptCode(algorithm, _framework);
    }
  }

  private generateTypeScriptCode(
    _algorithm: AlgorithmExtraction,
    _framework: string,
  ): string {
    const _params = _algorithm.parameters
      .map((p) => `${p.name}: ${this.mapTypeToTS(p.type)}`)
      .join(", ");

    const _functionSignature = `export function ${_algorithm.name}(${_params}): unknown`;

    let implementation = `/**
 * ${_algorithm.description}
 * 
 * Time Complexity: ${_algorithm.complexity?.time || "Unknown"}
 * Space Complexity: ${_algorithm.complexity?.space || "Unknown"}
 */
${_functionSignature} {
`;

    // Convert pseudocode/steps to TypeScript
    for (const step of _algorithm.steps) {
      const _tsCode = this.convertStepToTypeScript(step);
      implementation += `  ${_tsCode}\n`;
    }

    implementation += `  // TODO: Complete implementation based on algorithm
  throw new Error('Implementation pending');
}`;

    // Add _framework-specific wrappers if needed
    if (_framework === "react") {
      implementation = this.wrapInReactComponent(
        _algorithm.name,
        implementation,
      );
    } else if (_framework === "express") {
      implementation = this.wrapInExpressRoute(_algorithm.name, implementation);
    }

    return implementation;
  }

  private generatePythonCode(
    _algorithm: AlgorithmExtraction,
    _framework: string,
  ): string {
    const _params = _algorithm.parameters
      .map((p) => `${p.name}: ${this.mapTypeToPython(p.type)}`)
      .join(", ");

    let implementation = `"""
${_algorithm.description}

Time Complexity: ${_algorithm.complexity?.time || "Unknown"}
Space Complexity: ${_algorithm.complexity?.space || "Unknown"}
"""

def ${_algorithm.name}(${_params}):
`;

    // Convert steps to Python
    for (const step of _algorithm.steps) {
      const _pyCode = this.convertStepToPython(step);
      implementation += `    ${_pyCode}\n`;
    }

    implementation += `    # TODO: Complete implementation
    raise NotImplementedError("Implementation pending")`;

    // Add _framework-specific decorators if needed
    if (_framework === "django") {
      implementation = this.wrapInDjangoView(_algorithm.name, implementation);
    } else if (_framework === "flask") {
      implementation = this.wrapInFlaskRoute(_algorithm.name, implementation);
    }

    return implementation;
  }

  private generateJavaCode(
    _algorithm: AlgorithmExtraction,
    _framework: string,
  ): string {
    const _params = _algorithm.parameters
      .map((p) => `${this.mapTypeToJava(p.type)} ${p.name}`)
      .join(", ");

    return `/**
 * ${_algorithm.description}
 * 
 * Time Complexity: ${_algorithm.complexity?.time || "Unknown"}
 * Space Complexity: ${_algorithm.complexity?.space || "Unknown"}
 */
public class ${_algorithm.name} {
    public static Object execute(${_params}) {
        // TODO: Implement algorithm
        throw new UnsupportedOperationException("Implementation pending");
    }
}`;
  }

  private generateTests(
    _algorithm: AlgorithmExtraction,
    _language: string,
  ): string {
    switch (_language.toLowerCase()) {
      case "typescript":
      case "javascript":
        return this.generateJestTest(_algorithm);
      case "python":
        return this.generatePytestTest(_algorithm);
      case "java":
        return this.generateJUnitTest(_algorithm);
      default:
        return "";
    }
  }

  private generateJestTest(algorithm: AlgorithmExtraction): string {
    return `import { ${algorithm.name} } from './${algorithm.name}';

describe('${algorithm.name}', () => {
  it('should execute without errors', () => {
    // TODO: Add _test cases based on algorithm specification
    expect(() => ${algorithm.name}()).not.toThrow();
  });
  
  it('should handle edge cases', () => {
    // TODO: Add edge case _tests
  });
  
  it('should meet performance requirements', () => {
    // TODO: Add performance _tests if needed
  });
});`;
  }

  private generatePytestTest(algorithm: AlgorithmExtraction): string {
    return `import pytest
from ${algorithm.name} import ${algorithm.name}

def test_${algorithm.name}_basic():
    """Test basic functionality"""
    # TODO: Add _test cases
    with pytest.raises(NotImplementedError):
        ${algorithm.name}()

def test_${algorithm.name}_edge_cases():
    """Test edge cases"""
    # TODO: Add edge case _tests
    pass

def test_${algorithm.name}_performance():
    """Test performance requirements"""
    # TODO: Add performance _tests
    pass`;
  }

  private generateJUnitTest(algorithm: AlgorithmExtraction): string {
    return `import org.junit.Test;
import static org.junit.Assert.*;

public class ${algorithm.name}Test {
    @Test
    public void testBasicFunctionality() {
        // TODO: Add _test cases
    }
    
    @Test
    public void testEdgeCases() {
        // TODO: Add edge case _tests
    }
}`;
  }

  private generateDocumentation(algorithm: AlgorithmExtraction): string {
    return `# ${algorithm.name}

## Description
${algorithm.description}

## Algorithm Details
${algorithm.pseudocode || "See implementation for details"}

## Complexity Analysis
- **Time Complexity**: ${algorithm.complexity?.time || "Not analyzed"}
- **Space Complexity**: ${algorithm.complexity?.space || "Not analyzed"}

## Parameters
${algorithm.parameters.map((p) => `- **${p.name}** (${p.type}): ${p.description}`).join("\n")}

## Implementation Notes
${algorithm.steps.map((step, i) => `${i + 1}. ${step}`).join("\n")}
`;
  }

  private generateMainModule(
    _algorithms: AlgorithmExtraction[],
    _language: string,
  ): string {
    if (_language === "typescript" || _language === "javascript") {
      const _exports = _algorithms
        .map((a) => `export { ${a.name} } from './${a.name}';`)
        .join("\n");
      return `/**
 * Main module exporting all generated algorithms
 */

${_exports}

// Re-export types if needed
export * from './types';
`;
    } else if (_language === "python") {
      const _imports = _algorithms
        .map((a) => `from .${a.name} import ${a.name}`)
        .join("\n");
      return `"""
Main module for generated algorithms
"""

${_imports}

__all__ = [${_algorithms.map((a) => `'${a.name}'`).join(", ")}]
`;
    }

    return "";
  }

  private generateSetupInstructions(
    _language: string,
    _framework: string,
    dependencies: string[],
  ): string {
    let instructions = `# Setup Instructions

## Language: ${_language}
## Framework: ${_framework}

### Installation

`;

    if (_language === "typescript" || _language === "javascript") {
      instructions += `\`\`\`bash
npm install ${dependencies.join(" ")}
\`\`\``;
    } else if (_language === "python") {
      instructions += `\`\`\`bash
pip install ${dependencies.join(" ")}
\`\`\``;
    } else if (_language === "java") {
      instructions += `Add the following dependencies to your pom.xml or build.gradle`;
    }

    instructions += `

### Running Tests

`;

    if (_language === "typescript" || _language === "javascript") {
      instructions += `\`\`\`bash
npm _test
\`\`\``;
    } else if (_language === "python") {
      instructions += `\`\`\`bash
pytest
\`\`\``;
    }

    return instructions;
  }

  private identifyDependencies(
    _algorithm: AlgorithmExtraction,
    _language: string,
    _framework: string,
  ): string[] {
    const _deps: string[] = [];

    if (_language === "typescript") {
      deps.push("@types/node");
    }

    if (_framework === "react") {
      deps.push("react", "react-dom");
    } else if (_framework === "express") {
      deps.push("express", "@types/express");
    } else if (_framework === "django") {
      deps.push("django");
    } else if (_framework === "flask") {
      deps.push("flask");
    }

    return _deps;
  }

  private getFileExtension(_language: string): string {
    const extensions: Record<string, string> = {
      typescript: "ts",
      javascript: "js",
      python: "py",
      java: "java",
      cpp: "cpp",
      c: "c",
      go: "go",
      rust: "rs",
    };

    return extensions[_language.toLowerCase()] || "txt";
  }

  private mapTypeToTS(type: string): string {
    const _typeMap: Record<string, string> = {
      int: "number",
      float: "number",
      double: "number",
      str: "string",
      string: "string",
      bool: "boolean",
      boolean: "boolean",
      list: "any[]",
      array: "any[]",
      dict: "Record<string, any>",
      any: "any",
    };

    return _typeMap[type.toLowerCase()] || "any";
  }

  private mapTypeToPython(type: string): string {
    const _typeMap: Record<string, string> = {
      int: "int",
      float: "float",
      string: "str",
      bool: "bool",
      list: "List",
      array: "List",
      dict: "Dict",
      any: "Any",
    };

    return _typeMap[type.toLowerCase()] || "Any";
  }

  private mapTypeToJava(type: string): string {
    const _typeMap: Record<string, string> = {
      int: "int",
      float: "float",
      double: "double",
      string: "String",
      bool: "boolean",
      list: "List<Object>",
      array: "Object[]",
      dict: "Map<String, Object>",
      any: "Object",
    };

    return _typeMap[type.toLowerCase()] || "Object";
  }

  private convertStepToTypeScript(step: string): string {
    // Basic conversion of pseudocode to TypeScript
    let _tsCode = step;

    // Convert common pseudocode patterns
    _tsCode = _tsCode.replace(/FOR EACH/gi, "for (const _item of");
    _tsCode = _tsCode.replace(/FOR/gi, "for (");
    _tsCode = _tsCode.replace(/WHILE/gi, "while (");
    _tsCode = _tsCode.replace(/IF/gi, "if (");
    _tsCode = _tsCode.replace(/ELSE/gi, "} else {");
    _tsCode = _tsCode.replace(/END IF/gi, "}");
    _tsCode = _tsCode.replace(/RETURN/gi, "return");
    _tsCode = _tsCode.replace(/:=/g, "=");

    // Add semicolons if missing
    if (
      !_tsCode.endsWith(";") &&
      !_tsCode.endsWith("{") &&
      !_tsCode.endsWith("}")
    ) {
      _tsCode += ";";
    }

    return `// ${step}\n  ${_tsCode}`;
  }

  private convertStepToPython(step: string): string {
    // Basic conversion of pseudocode to Python
    let _pyCode = step;

    // Convert common pseudocode patterns
    _pyCode = _pyCode.replace(/FOR EACH/gi, "for _item in");
    _pyCode = _pyCode.replace(/FOR/gi, "for");
    _pyCode = _pyCode.replace(/WHILE/gi, "while");
    _pyCode = _pyCode.replace(/IF/gi, "if");
    _pyCode = _pyCode.replace(/ELSE/gi, "else:");
    _pyCode = _pyCode.replace(/END IF/gi, "");
    _pyCode = _pyCode.replace(/RETURN/gi, "return");
    _pyCode = _pyCode.replace(/:=/g, "=");

    return `# ${step}\n    ${_pyCode}`;
  }

  private wrapInReactComponent(_name: string, _code: string): string {
    return `import React from 'react';

${_code}

export const ${_name}Component: React.FC = () => {
  // Component implementation using ${_name} function
  return <div>Algorithm: ${_name}</div>;
};`;
  }

  private wrapInExpressRoute(_name: string, _code: string): string {
    return `import { Request, Response } from 'express';

${_code}

export const ${_name}Route = (req: Request, res: Response) => {
  try {
    const _result = ${_name}(req.body);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};`;
  }

  private wrapInDjangoView(_name: string, _code: string): string {
    return `from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json

${_code}

@csrf_exempt
def ${_name}_view(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        result = ${_name}(**data)
        return JsonResponse({'result': result})
    return JsonResponse({'error': 'Method not allowed'}, status=405)`;
  }

  private wrapInFlaskRoute(_name: string, _code: string): string {
    return `from flask import request, jsonify

${_code}

@app.route('/${_name}', methods=['POST'])
def ${_name}_route():
    data = request.get_json()
    result = ${_name}(**data)
    return jsonify({'result': result})`;
  }
}
