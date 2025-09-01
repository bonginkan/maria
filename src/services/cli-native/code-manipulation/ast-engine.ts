/**
 * AST Manipulation Engine
 * MARIA v2.1.9 - Advanced code transformation and analysis
 */

import * as ts from "typescript";
import * as _path from "path";
import * as fs from "fs/promises";
import { EventEmitter } from "node:events";

export interface ASTNode {
  id: string;
  type: string;
  name?: string;
  kind: ts.SyntaxKind;
  pos: number;
  end: number;
  children: ASTNode[];
  _parent?: ASTNode;
  metadata?: Record<string, any>;
}

export interface TransformOptions {
  preserveComments?: boolean;
  preserveFormatting?: boolean;
  targetVersion?: ts.ScriptTarget;
  module?: ts.ModuleKind;
  jsx?: ts.JsxEmit;
}

export interface RefactorOperation {
  type: "rename" | "extract" | "inline" | "move" | "delete";
  target: ASTNode | string;
  options: Record<string, any>;
}

export interface CodeMetrics {
  complexity: number;
  linesOfCode: number;
  functions: number;
  classes: number;
  interfaces: number;
  _imports: number;
  exports: number;
  dependencies: string[];
  depth: number;
}

export class ASTEngine extends EventEmitter {
  private program?: ts.Program;
  private typeChecker?: ts.TypeChecker;
  private sourceFiles: Map<string, ts.SourceFile> = new Map();
  private transformers: Map<string, ts.TransformerFactory<ts.SourceFile>> =
    new Map();

  constructor() {
    super();
    this.registerBuiltInTransformers();
  }

  private registerBuiltInTransformers(): void {
    // Register common transformers
    this.registerTransformer(
      "arrow-functions",
      this.arrowFunctionTransformer(),
    );
    this.registerTransformer("async-await", this.asyncAwaitTransformer());
    this.registerTransformer(
      "optional-chaining",
      this.optionalChainingTransformer(),
    );
    this.registerTransformer(
      "nullish-coalescing",
      this.nullishCoalescingTransformer(),
    );
    this.registerTransformer(
      "template-literals",
      this.templateLiteralTransformer(),
    );
  }

  async parseFile(
    _filePath: string,
    options?: ts.CompilerOptions,
  ): Promise<ASTNode> {
    const _content = await fs.readFile(_filePath, "utf-8");
    return this.parseCode(_content, _filePath, options);
  }

  parseCode(
    _code: string,
    fileName: string = "temp.ts",
    options?: ts.CompilerOptions,
  ): ASTNode {
    const compilerOptions: ts.CompilerOptions = {
      target: options?.target || ts.ScriptTarget.ES2022,
      module: options?.module || ts.ModuleKind.ESNext,
      lib: options?.lib || ["es2022"],
      jsx: options?.jsx || ts.JsxEmit.React,
      allowJs: true,
      checkJs: false,
      ...options,
    };

    const _sourceFile = ts.createSourceFile(
      fileName,
      code,
      compilerOptions.target || ts.ScriptTarget.ES2022,
      true,
      ts.ScriptKind.TS,
    );

    this.sourceFiles.set(fileName, _sourceFile);

    // Create program for type checking
    const _host = this.createCompilerHost(compilerOptions);
    this.program = ts.createProgram([fileName], compilerOptions, _host);
    this.typeChecker = this.program.getTypeChecker();

    return this.convertToASTNode(_sourceFile);
  }

  private createCompilerHost(options: ts.CompilerOptions): ts.CompilerHost {
    const _host = ts.createCompilerHost(options);
    const _originalGetSourceFile = _host.getSourceFile;

    host.getSourceFile = (
      fileName,
      languageVersion,
      onError,
      shouldCreateNewSourceFile,
    ) => {
      if (this.sourceFiles.has(fileName)) {
        return this.sourceFiles.get(fileName);
      }
      return _originalGetSourceFile.call(
        _host,
        fileName,
        languageVersion,
        onError,
        shouldCreateNewSourceFile,
      );
    };

    return _host;
  }

  private convertToASTNode(_node: ts.Node, _parent?: ASTNode): ASTNode {
    const astNode: ASTNode = {
      id: this.generateNodeId(_node),
      type: ts.SyntaxKind[_node.kind],
      kind: _node.kind,
      pos: _node.pos,
      end: _node.end,
      children: [],
      _parent,
      metadata: this.extractMetadata(_node),
    };

    if (ts.isIdentifier(_node)) {
      astNode.name = _node.text;
    } else if (
      ts.isFunctionDeclaration(_node) ||
      ts.isClassDeclaration(_node) ||
      ts.isInterfaceDeclaration(_node)
    ) {
      astNode.name = _node.name?.text;
    }

    node.forEachChild((child) => {
      astNode.children.push(this.convertToASTNode(child, astNode));
    });

    return astNode;
  }

  private generateNodeId(node: ts.Node): string {
    const _sourceFile = node.getSourceFile();
    const { line, character } = _sourceFile.getLineAndCharacterOfPosition(
      node.pos,
    );
    return `${_sourceFile.fileName}:${line}:${character}:${node.kind}`;
  }

  private extractMetadata(node: ts.Node): Record<string, any> {
    const metadata: Record<string, any> = {};

    if (ts.isSourceFile(node)) {
      metadata.fileName = node.fileName;
      metadata.isDeclarationFile = node.isDeclarationFile;
    }

    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
      metadata.parameters = node.parameters.map((p) => p.name?.getText());
      metadata.async = !!node.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.AsyncKeyword,
      );
      metadata.generator = !!node.asteriskToken;
    }

    if (ts.isClassDeclaration(node)) {
      metadata.abstract = !!node.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.AbstractKeyword,
      );
      metadata.exported = !!node.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.ExportKeyword,
      );
    }

    return metadata;
  }

  findNodes(_ast: ASTNode, predicate: (node: ASTNode) => boolean): ASTNode[] {
    const results: ASTNode[] = [];

    const _traverse = (_node: ASTNode) => {
      if (predicate(_node)) {
        results.push(_node);
      }
      node.children.forEach(_traverse);
    };

    _traverse(_ast);
    return results;
  }

  findNodesByType(_ast: ASTNode, type: ts.SyntaxKind | string): ASTNode[] {
    const _typeString = typeof type === "string" ? type : ts.SyntaxKind[type];
    return this.findNodes(_ast, (node) => node.type === _typeString);
  }

  findNodeByName(_ast: ASTNode, name: string): ASTNode | undefined {
    return this.findNodes(_ast, (node) => node.name === name)[0];
  }

  getNodeAtPosition(_ast: ASTNode, position: number): ASTNode | undefined {
    const _candidates = this.findNodes(
      _ast,
      (node) => node.pos <= position && position <= node.end,
    );

    // Return the most specific (deepest) node
    return _candidates.sort((a, b) => b.end - b.pos - (a.end - a.pos))[0];
  }

  transform(
    _sourceFile: ts.SourceFile,
    transformers: ts.TransformerFactory<ts.SourceFile>[],
  ): ts.SourceFile {
    const _result = ts.transform(_sourceFile, transformers);
    const _transformedFile = _result.transformed[0];
    result.dispose();
    return _transformedFile;
  }

  registerTransformer(
    _name: string,
    _transformer: ts.TransformerFactory<ts.SourceFile>,
  ): void {
    this.transformers.set(_name, _transformer);
  }

  applyTransformer(_code: string, transformerName: string): string {
    const _transformer = this.transformers.get(transformerName);
    if (!_transformer) {
      throw new Error(`Transformer '${transformerName}' not found`);
    }

    const _sourceFile = ts.createSourceFile(
      "temp.ts",
      code,
      ts.ScriptTarget.ES2022,
      true,
    );

    const _transformed = this.transform(_sourceFile, [_transformer]);
    const _printer = ts.createPrinter();
    return _printer.printFile(_transformed);
  }

  private arrowFunctionTransformer(): ts.TransformerFactory<ts.SourceFile> {
    return (_context: ts.TransformationContext) => {
      const _visit: ts.Visitor = (_node: ts.Node) => {
        if (ts.isFunctionExpression(_node) && !_node.name) {
          // Convert function expression to arrow function
          return ts.factory.createArrowFunction(
            _node.modifiers,
            _node.typeParameters,
            _node.parameters,
            node.type,
            ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
            node.body!,
          );
        }
        return ts.visitEachChild(_node, _visit, _context);
      };

      return (_sourceFile: ts.SourceFile) =>
        ts.visitNode(_sourceFile, _visit) as ts.SourceFile;
    };
  }

  private asyncAwaitTransformer(): ts.TransformerFactory<ts.SourceFile> {
    return (_context: ts.TransformationContext) => {
      const _visit: ts.Visitor = (_node: ts.Node) => {
        // Transform Promise.then() to async/await
        if (
          ts.isCallExpression(_node) &&
          ts.isPropertyAccessExpression(_node.expression) &&
          node.expression.name.text === "then"
        ) {
          // This is a simplified example
          // Real implementation would be more complex
          return _node;
        }
        return ts.visitEachChild(_node, _visit, _context);
      };

      return (_sourceFile: ts.SourceFile) =>
        ts.visitNode(_sourceFile, _visit) as ts.SourceFile;
    };
  }

  private optionalChainingTransformer(): ts.TransformerFactory<ts.SourceFile> {
    return (_context: ts.TransformationContext) => {
      const _visit: ts.Visitor = (_node: ts.Node) => {
        if (ts.isPropertyAccessExpression(_node)) {
          // Transform obj && obj.prop to obj?.prop
          const _parent = _node._parent;
          if (
            ts.isBinaryExpression(_parent) &&
            parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
          ) {
            // Check if this is a null check pattern
            // Simplified implementation
          }
        }
        return ts.visitEachChild(_node, _visit, _context);
      };

      return (_sourceFile: ts.SourceFile) =>
        ts.visitNode(_sourceFile, _visit) as ts.SourceFile;
    };
  }

  private nullishCoalescingTransformer(): ts.TransformerFactory<ts.SourceFile> {
    return (_context: ts.TransformationContext) => {
      const _visit: ts.Visitor = (_node: ts.Node) => {
        if (
          ts.isBinaryExpression(_node) &&
          node.operatorToken.kind === ts.SyntaxKind.BarBarToken
        ) {
          // Transform || to ?? where appropriate
          // This requires type checking to ensure correctness
        }
        return ts.visitEachChild(_node, _visit, _context);
      };

      return (_sourceFile: ts.SourceFile) =>
        ts.visitNode(_sourceFile, _visit) as ts.SourceFile;
    };
  }

  private templateLiteralTransformer(): ts.TransformerFactory<ts.SourceFile> {
    return (_context: ts.TransformationContext) => {
      const _visit: ts.Visitor = (_node: ts.Node) => {
        if (
          ts.isBinaryExpression(_node) &&
          node.operatorToken.kind === ts.SyntaxKind.PlusToken
        ) {
          // Check if this is string concatenation
          if (
            ts.isStringLiteral(_node.left) ||
            ts.isStringLiteral(_node.right)
          ) {
            // Convert to template literal
            // Simplified implementation
          }
        }
        return ts.visitEachChild(_node, _visit, _context);
      };

      return (_sourceFile: ts.SourceFile) =>
        ts.visitNode(_sourceFile, _visit) as ts.SourceFile;
    };
  }

  extractFunction(
    code: string,
    startLine: number,
    endLine: number,
    functionName: string,
  ): string {
    const _lines = code.split("\n");
    const _extractedLines = _lines.slice(startLine - 1, endLine);
    const _extractedCode = _extractedLines.join("\n");

    // Create the new function
    const _newFunction = `function ${functionName}() {\n${this.indent(_extractedCode)}\n}`;

    // Replace the original code with a function call
    const _modifiedLines = [
      ..._lines.slice(0, startLine - 1),
      `${functionName}();`,
      ..._lines.slice(endLine),
    ];

    // Insert the new function before the modified code
    const _result = [_newFunction, "", ..._modifiedLines].join("\n");

    this.emit("refactor:extract-function", {
      functionName,
      startLine,
      endLine,
    });
    return _result;
  }

  renameSymbol(_code: string, oldName: string, newName: string): string {
    const _sourceFile = ts.createSourceFile(
      "temp.ts",
      code,
      ts.ScriptTarget.ES2022,
      true,
    );

    const _transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
      const _visit: ts.Visitor = (_node: ts.Node) => {
        if (ts.isIdentifier(_node) && _node.text === oldName) {
          return ts.factory.createIdentifier(newName);
        }
        return ts.visitEachChild(_node, _visit, context);
      };

      return (_sourceFile: ts.SourceFile) =>
        ts.visitNode(_sourceFile, _visit) as ts.SourceFile;
    };

    const _result = ts.transform(_sourceFile, [_transformer]);
    const _printer = ts.createPrinter();
    const _transformed = _printer.printFile(_result._transformed[0]);
    result.dispose();

    this.emit("refactor:rename", { oldName, newName });
    return _transformed;
  }

  inlineVariable(_code: string, variableName: string): string {
    const _sourceFile = ts.createSourceFile(
      "temp.ts",
      code,
      ts.ScriptTarget.ES2022,
      true,
    );

    let variableValue: ts.Expression | undefined;

    // First pass: find the variable declaration and its value
    const findVariable: ts.Visitor = (_node: ts.Node) => {
      if (
        ts.isVariableDeclaration(_node) &&
        ts.isIdentifier(_node.name) &&
        _node.name.text === variableName &&
        node.initializer
      ) {
        variableValue = _node.initializer;
      }
      return ts.visitEachChild(
        _node,
        findVariable,
        ts.nullTransformationContext,
      );
    };

    ts.visitNode(_sourceFile, findVariable);

    if (!variableValue) {
      throw new Error(
        `Variable '${variableName}' not found or has no initializer`,
      );
    }

    // Second pass: replace references and remove declaration
    const _transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
      const _visit: ts.Visitor = (_node: ts.Node) => {
        // Remove the variable declaration
        if (ts.isVariableStatement(_node)) {
          const _declarations = _node.declarationList._declarations.filter(
            (d) => !(ts.isIdentifier(d.name) && d.name.text === variableName),
          );
          if (_declarations.length === 0) {
            return undefined;
          }
          if (
            _declarations.length < _node.declarationList._declarations.length
          ) {
            return ts.factory.updateVariableStatement(
              _node,
              node.modifiers,
              ts.factory.updateVariableDeclarationList(
                node.declarationList,
                _declarations,
              ),
            );
          }
        }

        // Replace references with the value
        if (ts.isIdentifier(_node) && _node.text === variableName) {
          return variableValue!;
        }

        return ts.visitEachChild(_node, _visit, context);
      };

      return (_sourceFile: ts.SourceFile) =>
        ts.visitNode(_sourceFile, _visit) as ts.SourceFile;
    };

    const _result = ts.transform(_sourceFile, [_transformer]);
    const _printer = ts.createPrinter();
    const _transformed = _printer.printFile(_result._transformed[0]);
    result.dispose();

    this.emit("refactor:inline", { variableName });
    return _transformed;
  }

  calculateMetrics(ast: ASTNode): CodeMetrics {
    const metrics: CodeMetrics = {
      complexity: 0,
      linesOfCode: 0,
      functions: 0,
      classes: 0,
      interfaces: 0,
      _imports: 0,
      exports: 0,
      dependencies: [],
      depth: 0,
    };

    const _traverse = (_node: ASTNode, depth: number = 0) => {
      metrics.depth = Math.max(metrics.depth, depth);

      switch (_node.type) {
        case "FunctionDeclaration":
        case "FunctionExpression":
        case "ArrowFunction":
        case "MethodDeclaration":
          metrics.functions++;
          metrics.complexity += this.calculateCyclomaticComplexity(_node);
          break;
        case "ClassDeclaration":
        case "ClassExpression":
          metrics.classes++;
          break;
        case "InterfaceDeclaration":
          metrics.interfaces++;
          break;
        case "ImportDeclaration":
          metrics.imports++;
          if (_node.metadata?.moduleSpecifier) {
            metrics.dependencies.push(_node.metadata.moduleSpecifier);
          }
          break;
        case "ExportDeclaration":
        case "ExportAssignment":
          metrics.exports++;
          break;
        case "IfStatement":
        case "ConditionalExpression":
        case "SwitchStatement":
        case "ForStatement":
        case "WhileStatement":
        case "DoStatement":
          metrics.complexity++;
          break;
      }

      node.children.forEach((child) => _traverse(child, depth + 1));
    };

    _traverse(ast);

    // Calculate _lines of code (simplified)
    if (ast.metadata?.fileName) {
      metrics.linesOfCode = (ast.end - ast.pos) / 50; // Rough estimate
    }

    return metrics;
  }

  private calculateCyclomaticComplexity(node: ASTNode): number {
    let complexity = 1;

    const _traverse = (_n: ASTNode) => {
      switch (_n.type) {
        case "IfStatement":
        case "ConditionalExpression":
        case "CaseClause":
        case "CatchClause":
        case "WhileStatement":
        case "ForStatement":
        case "ForInStatement":
        case "ForOfStatement":
        case "DoStatement":
          complexity++;
          break;
        case "BinaryExpression":
          if (
            _n.metadata?.operator === "&&" ||
            _n.metadata?.operator === "||"
          ) {
            complexity++;
          }
          break;
      }
      n.children.forEach(_traverse);
    };

    node.children.forEach(_traverse);
    return complexity;
  }

  generateCode(_ast: ASTNode): string {
    // This would need the original source file reference
    // For now, return a placeholder
    return "// Generated code from AST";
  }

  optimizeImports(code: string): string {
    const _sourceFile = ts.createSourceFile(
      "temp.ts",
      code,
      ts.ScriptTarget.ES2022,
      true,
    );

    const _imports = new Map<string, Set<string>>();
    const _usedIdentifiers = new Set<string>();

    // First pass: collect all _imports and used identifiers
    const _visit = (_node: ts.Node) => {
      if (ts.isImportDeclaration(_node)) {
        const _moduleSpecifier = (_node._moduleSpecifier as ts.StringLiteral)
          .text;
        if (!_imports.has(_moduleSpecifier)) {
          imports.set(_moduleSpecifier, new Set());
        }

        if (_node.importClause) {
          if (_node.importClause.name) {
            imports.get(_moduleSpecifier)!.add(_node.importClause.name.text);
          }
          if (_node.importClause.namedBindings) {
            if (ts.isNamedImports(_node.importClause.namedBindings)) {
              node.importClause.namedBindings.elements.forEach((element) => {
                imports.get(_moduleSpecifier)!.add(element.name.text);
              });
            }
          }
        }
      } else if (
        ts.isIdentifier(_node) &&
        !ts.isImportDeclaration(_node.parent)
      ) {
        usedIdentifiers.add(_node.text);
      }

      ts.forEachChild(_node, _visit);
    };

    _visit(_sourceFile);

    // Remove unused _imports
    const _optimizedImports = new Map<string, Set<string>>();
    imports.forEach((identifiers, module) => {
      const _usedFromModule = new Set<string>();
      identifiers.forEach((id) => {
        if (_usedIdentifiers.has(id)) {
          usedFromModule.add(id);
        }
      });
      if (_usedFromModule.size > 0) {
        optimizedImports.set(module, _usedFromModule);
      }
    });

    // Generate optimized import statements
    const importStatements: string[] = [];
    optimizedImports.forEach((identifiers, module) => {
      const _ids = Array.from(identifiers).join(", ");
      importStatements.push(`import { ${_ids} } from '${module}';`);
    });

    // Remove old _imports and add new ones
    const _lines = code.split("\n");
    const _nonImportLines = _lines.filter(
      (line) => !line.trim().startsWith("import "),
    );

    return [...importStatements, "", ..._nonImportLines].join("\n");
  }

  private _indent(_code: string, spaces: number = 2): string {
    const _indent = " ".repeat(spaces);
    return _code
      .split("\n")
      .map((line) => _indent + line)
      .join("\n");
  }
}

export const _astEngine = new ASTEngine();
