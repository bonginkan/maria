"use strict";
/**
 * MARIA AI Language Server
 * Implements Language Server Protocol for AI-powered code analysis,
 * completion, and intelligent assistance
 */
Object.defineProperty(exports, "__esModule", { value: true });
const node_1 = require("vscode-languageserver/node");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
// Create a connection for the server, using Node's IPC as a transport
const connection = (0, node_1.createConnection)(node_1.ProposedFeatures.all);
// Create a simple text document manager
const documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;
// Global settings for the language server
const globalSettings = {
    enableDiagnostics: true,
    enableInternalModes: true,
    preferredProvider: 'auto'
};
// Cache for settings of all open documents
const documentSettings = new Map();
// MARIA AI Engine instance
let mariaAI;
connection.onInitialize((params) => {
    const capabilities = params.capabilities;
    // Does the client support the `workspace/configuration` request?
    hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
    hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
    hasDiagnosticRelatedInformationCapability = !!(capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation);
    const result = {
        capabilities: {
            textDocumentSync: node_1.TextDocumentSyncKind.Incremental,
            // Tell the client that this server supports code completion
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['/', '.', ':', '>', '<']
            },
            // Support code actions (quick fixes)
            codeActionProvider: {
                codeActionKinds: [
                    node_1.CodeActionKind.QuickFix,
                    node_1.CodeActionKind.Refactor,
                    node_1.CodeActionKind.Source
                ]
            },
            // Support hover information
            hoverProvider: true,
            // Support document formatting
            documentFormattingProvider: true,
            // Support diagnostics
            diagnosticProvider: {
                interFileDependencies: false,
                workspaceDiagnostics: false
            }
        }
    };
    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true
            }
        };
    }
    return result;
});
connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        // Register for all configuration changes
        connection.client.register(node_1.DidChangeConfigurationNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            connection.console.log('Workspace folder change event received.');
        });
    }
    // Initialize MARIA AI Engine
    initializeMariaAI();
});
async function initializeMariaAI() {
    try {
        // Mock implementation - in real implementation, this would integrate
        // with the actual MARIA AI engine from the CLI codebase
        mariaAI = new MockMariaAIEngine();
        connection.console.log('MARIA AI Engine initialized successfully');
    }
    catch (error) {
        connection.console.error(`Failed to initialize MARIA AI Engine: ${error}`);
    }
}
connection.onDidChangeConfiguration(change => {
    if (hasConfigurationCapability) {
        // Reset all cached document settings
        documentSettings.clear();
    }
    else {
        globalSettings.enableDiagnostics = change.settings.maria?.enableDiagnostics ?? true;
        globalSettings.enableInternalModes = change.settings.maria?.enableInternalModes ?? true;
        globalSettings.preferredProvider = change.settings.maria?.preferredProvider ?? 'auto';
    }
    // Revalidate all open text documents
    documents.all().forEach(validateTextDocument);
});
function getDocumentSettings(resource) {
    if (!hasConfigurationCapability) {
        return Promise.resolve(globalSettings);
    }
    let result = documentSettings.get(resource);
    if (!result) {
        result = connection.workspace.getConfiguration({
            scopeUri: resource,
            section: 'maria'
        });
        documentSettings.set(resource, result);
    }
    return result;
}
// Only keep settings for open documents
documents.onDidClose(e => {
    documentSettings.delete(e.document.uri);
});
// The content of a text document has changed
documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
});
async function validateTextDocument(textDocument) {
    const settings = await getDocumentSettings(textDocument.uri);
    if (!settings.enableDiagnostics || !mariaAI) {
        return;
    }
    try {
        // Analyze the document with MARIA AI
        const analysisResult = await mariaAI.analyzeCode(textDocument.getText());
        // Convert analysis results to diagnostics
        const diagnostics = [];
        // Add bug diagnostics
        analysisResult.bugs.forEach(bug => {
            diagnostics.push(createDiagnostic(bug, 'MARIA Bug Analysis'));
        });
        // Add lint diagnostics
        analysisResult.lint.forEach(lint => {
            diagnostics.push(createDiagnostic(lint, 'MARIA Lint'));
        });
        // Add security diagnostics
        analysisResult.security.forEach(security => {
            diagnostics.push(createDiagnostic(security, 'MARIA Security'));
        });
        // Add typecheck diagnostics
        analysisResult.typecheck.forEach(typecheck => {
            diagnostics.push(createDiagnostic(typecheck, 'MARIA TypeCheck'));
        });
        // Send the computed diagnostics to VS Code
        connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
    }
    catch (error) {
        connection.console.error(`Error analyzing document: ${error}`);
    }
}
function createDiagnostic(issue, source) {
    const diagnostic = {
        severity: mapSeverity(issue.severity),
        range: {
            start: { line: issue.line, character: issue.column },
            end: { line: issue.line, character: issue.column + issue.length }
        },
        message: issue.message,
        source: source
    };
    if (issue.code) {
        diagnostic.code = issue.code;
    }
    return diagnostic;
}
function mapSeverity(severity) {
    switch (severity) {
        case 'error':
            return node_1.DiagnosticSeverity.Error;
        case 'warning':
            return node_1.DiagnosticSeverity.Warning;
        case 'info':
            return node_1.DiagnosticSeverity.Information;
        case 'hint':
            return node_1.DiagnosticSeverity.Hint;
        default:
            return node_1.DiagnosticSeverity.Information;
    }
}
// Code completion provider
connection.onCompletion(async (_textDocumentPosition) => {
    // Get the document and position
    const document = documents.get(_textDocumentPosition.textDocument.uri);
    if (!document) {
        return [];
    }
    const position = _textDocumentPosition.position;
    const text = document.getText();
    const offset = document.offsetAt(position);
    // Check if we're in a MARIA command context (starting with /)
    const lineText = document.getText({
        start: { line: position.line, character: 0 },
        end: position
    });
    if (lineText.includes('/')) {
        return [
            {
                label: '/code',
                kind: node_1.CompletionItemKind.Function,
                data: 1,
                detail: 'Generate code with AI',
                documentation: 'Use MARIA AI to generate code based on natural language description'
            },
            {
                label: '/bug',
                kind: node_1.CompletionItemKind.Function,
                data: 2,
                detail: 'Analyze bugs in code',
                documentation: 'Detect and analyze potential bugs in your code'
            },
            {
                label: '/lint',
                kind: node_1.CompletionItemKind.Function,
                data: 3,
                detail: 'Run lint analysis',
                documentation: 'Perform comprehensive code quality analysis'
            },
            {
                label: '/typecheck',
                kind: node_1.CompletionItemKind.Function,
                data: 4,
                detail: 'Type safety analysis',
                documentation: 'Analyze TypeScript type safety and coverage'
            },
            {
                label: '/security-review',
                kind: node_1.CompletionItemKind.Function,
                data: 5,
                detail: 'Security vulnerability review',
                documentation: 'Scan for security vulnerabilities and OWASP compliance'
            }
        ];
    }
    return [];
});
// Code actions provider (quick fixes)
connection.onCodeAction(async (params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document || !mariaAI) {
        return [];
    }
    const actions = [];
    // Process diagnostics to generate quick fixes
    for (const diagnostic of params.context.diagnostics) {
        if (diagnostic.source?.startsWith('MARIA')) {
            try {
                const issue = {
                    line: diagnostic.range.start.line,
                    column: diagnostic.range.start.character,
                    length: diagnostic.range.end.character - diagnostic.range.start.character,
                    message: diagnostic.message,
                    severity: mapDiagnosticSeverity(diagnostic.severity),
                    code: diagnostic.code,
                    source: diagnostic.source
                };
                const fix = await mariaAI.generateFix(document.getText(), issue);
                if (fix) {
                    const action = {
                        title: fix.title,
                        kind: node_1.CodeActionKind.QuickFix,
                        diagnostics: [diagnostic],
                        edit: {
                            changes: {
                                [document.uri]: [
                                    node_1.TextEdit.replace(fix.range, fix.replacement)
                                ]
                            }
                        }
                    };
                    actions.push(action);
                }
            }
            catch (error) {
                connection.console.error(`Error generating fix: ${error}`);
            }
        }
    }
    return actions;
});
function mapDiagnosticSeverity(severity) {
    switch (severity) {
        case node_1.DiagnosticSeverity.Error:
            return 'error';
        case node_1.DiagnosticSeverity.Warning:
            return 'warning';
        case node_1.DiagnosticSeverity.Information:
            return 'info';
        case node_1.DiagnosticSeverity.Hint:
            return 'hint';
        default:
            return 'info';
    }
}
// Completion item resolve
connection.onCompletionResolve((item) => {
    if (item.data === 1) {
        item.detail = 'MARIA Code Generation';
        item.documentation = 'Generate code using natural language descriptions with MARIA AI';
    }
    else if (item.data === 2) {
        item.detail = 'MARIA Bug Analysis';
        item.documentation = 'Detect and analyze potential bugs and issues in your code';
    }
    return item;
});
// Make the text document manager listen on the connection
documents.listen(connection);
// Listen on the connection
connection.listen();
/**
 * Mock implementation of MARIA AI Engine
 * In production, this would integrate with the actual MARIA CLI engine
 */
class MockMariaAIEngine {
    async analyzeCode(code) {
        // Mock analysis - detect common patterns
        const issues = {
            bugs: [],
            lint: [],
            security: [],
            typecheck: []
        };
        const lines = code.split('\n');
        lines.forEach((line, index) => {
            // Mock bug detection
            if (line.includes('undefined.') || line.includes('null.')) {
                issues.bugs.push({
                    line: index,
                    column: line.indexOf('undefined') || line.indexOf('null'),
                    length: 9,
                    message: 'Potential null pointer exception',
                    severity: 'error',
                    code: 'MARIA001',
                    source: 'bug-analysis'
                });
            }
            // Mock lint issues
            if (line.includes('var ')) {
                issues.lint.push({
                    line: index,
                    column: line.indexOf('var'),
                    length: 3,
                    message: 'Use const or let instead of var',
                    severity: 'warning',
                    code: 'MARIA002',
                    source: 'lint-analysis'
                });
            }
            // Mock security issues
            if (line.includes('eval(') || line.includes('innerHTML')) {
                issues.security.push({
                    line: index,
                    column: line.indexOf('eval') || line.indexOf('innerHTML'),
                    length: 4,
                    message: 'Potential XSS vulnerability',
                    severity: 'error',
                    code: 'MARIA003',
                    source: 'security-analysis'
                });
            }
        });
        return issues;
    }
    async generateCode(prompt, language) {
        // Mock code generation
        return `// Generated by MARIA AI\n// Prompt: ${prompt}\n// Language: ${language || 'auto'}\n\nfunction generatedFunction() {\n  // TODO: Implement based on prompt\n  return "Hello from MARIA!";\n}`;
    }
    async generateFix(code, issue) {
        // Mock fix generation
        if (issue.code === 'MARIA001') {
            return {
                title: 'Add null check',
                replacement: 'obj && obj.',
                range: {
                    start: { line: issue.line, character: issue.column },
                    end: { line: issue.line, character: issue.column + issue.length }
                }
            };
        }
        if (issue.code === 'MARIA002') {
            return {
                title: 'Replace var with const',
                replacement: 'const',
                range: {
                    start: { line: issue.line, character: issue.column },
                    end: { line: issue.line, character: issue.column + 3 }
                }
            };
        }
        return null;
    }
    async chat(message) {
        return `MARIA AI Response: I understand you said "${message}". How can I help you with your code?`;
    }
}
//# sourceMappingURL=mariaLanguageServer.js.map