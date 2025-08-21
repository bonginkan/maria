"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_1 = require("vscode-languageserver/node");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const MariaAIEngine_1 = require("./ai/MariaAIEngine");
const MariaAnalyzer_1 = require("./analyzer/MariaAnalyzer");
const SecurityReviewer_1 = require("./security/SecurityReviewer");
const InternalModeService_1 = require("./modes/InternalModeService");
// Create connection and document manager
const connection = (0, node_1.createConnection)(node_1.ProposedFeatures.all);
const documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
// MARIA AI components
let mariaAI;
let analyzer;
let securityReviewer;
let modeService;
let globalSettings = {
    enableDiagnostics: true,
    diagnosticDelay: 500,
    enableInternalModes: true
};
// Document settings cache
const documentSettings = new Map();
connection.onInitialize((params) => {
    connection.console.log('MARIA Language Server initializing...');
    // Initialize AI components
    mariaAI = new MariaAIEngine_1.MariaAIEngine(connection);
    analyzer = new MariaAnalyzer_1.MariaAnalyzer(mariaAI);
    securityReviewer = new SecurityReviewer_1.MariaSecurityReviewer(mariaAI);
    modeService = new InternalModeService_1.MariaInternalModeService(connection);
    const result = {
        capabilities: {
            textDocumentSync: node_1.TextDocumentSyncKind.Incremental,
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['/']
            },
            codeActionProvider: {
                codeActionKinds: [
                    node_1.CodeActionKind.QuickFix,
                    node_1.CodeActionKind.Refactor,
                    node_1.CodeActionKind.RefactorExtract,
                    node_1.CodeActionKind.RefactorInline,
                    node_1.CodeActionKind.RefactorRewrite,
                    node_1.CodeActionKind.Source
                ]
            },
            diagnosticProvider: {
                interFileDependencies: false,
                workspaceDiagnostics: false
            },
            hoverProvider: true,
            documentFormattingProvider: true,
            documentRangeFormattingProvider: true,
            renameProvider: true,
            foldingRangeProvider: true,
            executeCommandProvider: {
                commands: [
                    'maria.generateCode',
                    'maria.analyzeBugs',
                    'maria.runLint',
                    'maria.typeCheck',
                    'maria.securityReview',
                    'maria.switchMode',
                    'maria.chat'
                ]
            },
            workspace: {
                workspaceFolders: {
                    supported: true
                }
            }
        },
        serverInfo: {
            name: 'MARIA Language Server',
            version: '1.0.0'
        }
    };
    return result;
});
connection.onInitialized(() => {
    connection.console.log('MARIA Language Server initialized successfully');
    // Register for configuration changes
    connection.client.register(node_1.DidChangeConfigurationNotification.type, undefined);
    // Start internal mode service
    if (globalSettings.enableInternalModes) {
        modeService.start();
    }
});
// Configuration change handler
connection.onDidChangeConfiguration(change => {
    if (change.settings.maria) {
        globalSettings = change.settings.maria;
        // Update AI engine configuration
        mariaAI.updateConfiguration(globalSettings);
        // Toggle internal modes
        if (globalSettings.enableInternalModes) {
            modeService.start();
        }
        else {
            modeService.stop();
        }
    }
    // Clear document settings cache
    documentSettings.clear();
    // Revalidate all open documents
    documents.all().forEach(validateDocument);
});
// Document change handlers
documents.onDidClose(e => {
    documentSettings.delete(e.document.uri);
});
documents.onDidChangeContent(async (change) => {
    if (globalSettings.enableDiagnostics) {
        // Delay validation based on settings
        setTimeout(() => {
            validateDocument(change.document);
        }, globalSettings.diagnosticDelay);
    }
});
// Document validation
async function validateDocument(textDocument) {
    const text = textDocument.getText();
    const diagnostics = [];
    try {
        // Run multiple analyses in parallel
        const [bugs, lintIssues, typeErrors, securityIssues] = await Promise.all([
            analyzer.analyzeBugs(text, textDocument.languageId),
            analyzer.analyzeLint(text, textDocument.languageId),
            analyzer.analyzeTypes(text, textDocument.languageId),
            securityReviewer.analyze(text, textDocument.languageId)
        ]);
        // Convert analysis results to diagnostics
        bugs.forEach(bug => {
            diagnostics.push({
                severity: node_1.DiagnosticSeverity.Error,
                range: {
                    start: textDocument.positionAt(bug.start),
                    end: textDocument.positionAt(bug.end)
                },
                message: bug.message,
                source: 'MARIA Bug Analysis',
                code: bug.code
            });
        });
        lintIssues.forEach(issue => {
            diagnostics.push({
                severity: node_1.DiagnosticSeverity.Warning,
                range: {
                    start: textDocument.positionAt(issue.start),
                    end: textDocument.positionAt(issue.end)
                },
                message: issue.message,
                source: 'MARIA Lint',
                code: issue.code
            });
        });
        typeErrors.forEach(error => {
            diagnostics.push({
                severity: node_1.DiagnosticSeverity.Error,
                range: {
                    start: textDocument.positionAt(error.start),
                    end: textDocument.positionAt(error.end)
                },
                message: error.message,
                source: 'MARIA Type Check',
                code: error.code
            });
        });
        securityIssues.forEach(issue => {
            diagnostics.push({
                severity: issue.severity === 'critical' ? node_1.DiagnosticSeverity.Error : node_1.DiagnosticSeverity.Warning,
                range: {
                    start: textDocument.positionAt(issue.start),
                    end: textDocument.positionAt(issue.end)
                },
                message: `Security: ${issue.message}`,
                source: 'MARIA Security',
                code: issue.cwe
            });
        });
    }
    catch (error) {
        connection.console.error(`Error validating document: ${error}`);
    }
    // Send diagnostics to client
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}
// Completion handler
connection.onCompletion(async (params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return [];
    }
    const line = document.getText({
        start: { line: params.position.line, character: 0 },
        end: params.position
    });
    // Check if user is typing a MARIA command
    if (line.endsWith('/')) {
        return [
            {
                label: '/code',
                kind: node_1.CompletionItemKind.Keyword,
                detail: 'Generate code with MARIA',
                documentation: 'Generate code based on natural language description',
                insertText: 'code '
            },
            {
                label: '/bug',
                kind: node_1.CompletionItemKind.Keyword,
                detail: 'Analyze bugs',
                documentation: 'Analyze code for potential bugs and issues',
                insertText: 'bug'
            },
            {
                label: '/lint',
                kind: node_1.CompletionItemKind.Keyword,
                detail: 'Run lint analysis',
                documentation: 'Check code style and quality issues',
                insertText: 'lint'
            },
            {
                label: '/typecheck',
                kind: node_1.CompletionItemKind.Keyword,
                detail: 'Type check',
                documentation: 'Analyze type safety',
                insertText: 'typecheck'
            },
            {
                label: '/security',
                kind: node_1.CompletionItemKind.Keyword,
                detail: 'Security review',
                documentation: 'Review code for security vulnerabilities',
                insertText: 'security'
            },
            {
                label: '/explain',
                kind: node_1.CompletionItemKind.Keyword,
                detail: 'Explain code',
                documentation: 'Get AI explanation of selected code',
                insertText: 'explain'
            },
            {
                label: '/improve',
                kind: node_1.CompletionItemKind.Keyword,
                detail: 'Improve code',
                documentation: 'Get suggestions to improve code quality',
                insertText: 'improve'
            },
            {
                label: '/test',
                kind: node_1.CompletionItemKind.Keyword,
                detail: 'Generate tests',
                documentation: 'Generate unit tests for selected code',
                insertText: 'test'
            }
        ];
    }
    // Get AI-powered completions based on context
    const context = document.getText({
        start: { line: Math.max(0, params.position.line - 10), character: 0 },
        end: params.position
    });
    const completions = await mariaAI.getCompletions(context, document.languageId);
    return completions.map((completion, index) => ({
        label: completion.label,
        kind: node_1.CompletionItemKind.Text,
        detail: 'MARIA AI Suggestion',
        documentation: completion.description,
        insertText: completion.insertText,
        sortText: String(index).padStart(3, '0')
    }));
});
// Code action handler
connection.onCodeAction(async (params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return [];
    }
    const codeActions = [];
    // For each diagnostic, provide a quick fix
    for (const diagnostic of params.context.diagnostics) {
        if (diagnostic.source?.startsWith('MARIA')) {
            const text = document.getText(diagnostic.range);
            // Get AI-powered fix suggestion
            const fix = await mariaAI.suggestFix(text, diagnostic.message, document.languageId);
            if (fix) {
                const action = {
                    title: `MARIA: ${fix.title}`,
                    kind: node_1.CodeActionKind.QuickFix,
                    diagnostics: [diagnostic],
                    edit: {
                        changes: {
                            [params.textDocument.uri]: [
                                node_1.TextEdit.replace(diagnostic.range, fix.replacement)
                            ]
                        }
                    }
                };
                codeActions.push(action);
            }
        }
    }
    // Add refactoring suggestions
    const selectedText = document.getText(params.range);
    if (selectedText && selectedText.length > 0) {
        // Extract method
        codeActions.push({
            title: 'MARIA: Extract Method',
            kind: node_1.CodeActionKind.RefactorExtract,
            command: {
                title: 'Extract Method',
                command: 'maria.refactor.extractMethod',
                arguments: [params.textDocument.uri, params.range]
            }
        });
        // Improve code
        codeActions.push({
            title: 'MARIA: Improve Code',
            kind: node_1.CodeActionKind.RefactorRewrite,
            command: {
                title: 'Improve Code',
                command: 'maria.improveCode',
                arguments: [params.textDocument.uri, params.range]
            }
        });
        // Generate tests
        codeActions.push({
            title: 'MARIA: Generate Tests',
            kind: node_1.CodeActionKind.Source,
            command: {
                title: 'Generate Tests',
                command: 'maria.generateTests',
                arguments: [params.textDocument.uri, params.range]
            }
        });
    }
    return codeActions;
});
// Execute command handler
connection.onExecuteCommand(async (params) => {
    const { command, arguments: args } = params;
    switch (command) {
        case 'maria.generateCode':
            if (args && args[0]) {
                const result = await mariaAI.generateCode(args[0], args[1]);
                return result;
            }
            break;
        case 'maria.analyzeBugs':
            if (args && args[0]) {
                const bugs = await analyzer.analyzeBugs(args[0], args[1]);
                return bugs;
            }
            break;
        case 'maria.securityReview':
            if (args && args[0]) {
                const issues = await securityReviewer.analyze(args[0], args[1]);
                return issues;
            }
            break;
        case 'maria.switchMode':
            if (args && args[0]) {
                modeService.switchMode(args[0]);
            }
            break;
        case 'maria.chat':
            if (args && args[0]) {
                const response = await mariaAI.chat(args[0], args[1]);
                return response;
            }
            break;
    }
    return null;
});
// Hover provider
connection.onHover(async (params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return null;
    }
    // Get word at position
    const position = params.position;
    const line = document.getText({
        start: { line: position.line, character: 0 },
        end: { line: position.line + 1, character: 0 }
    });
    const wordMatch = /\w+/.exec(line.substring(position.character));
    if (!wordMatch) {
        return null;
    }
    const word = wordMatch[0];
    // Get AI-powered documentation
    const documentation = await mariaAI.getDocumentation(word, document.languageId);
    if (documentation) {
        return {
            contents: {
                kind: 'markdown',
                value: documentation
            }
        };
    }
    return null;
});
// Listen on the connection
documents.listen(connection);
connection.listen();
//# sourceMappingURL=server.js.map