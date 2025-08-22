"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MariaDiagnosticProvider = void 0;
const vscode = __importStar(require("vscode"));
class MariaDiagnosticProvider {
    constructor(client) {
        this.client = client;
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('maria');
    }
    async initialize() {
        // Register for document changes
        vscode.workspace.onDidChangeTextDocument(async (e) => {
            if (this.shouldAnalyze(e.document)) {
                await this.updateDiagnostics(e.document);
            }
        });
        // Analyze all open documents
        vscode.workspace.textDocuments.forEach(async (document) => {
            if (this.shouldAnalyze(document)) {
                await this.updateDiagnostics(document);
            }
        });
    }
    shouldAnalyze(document) {
        // Skip certain file types
        const excludedSchemes = ['output', 'debugConsole', 'terminal'];
        if (excludedSchemes.includes(document.uri.scheme)) {
            return false;
        }
        // Only analyze supported languages
        const supportedLanguages = [
            'javascript',
            'typescript',
            'javascriptreact',
            'typescriptreact',
            'python',
            'java',
            'csharp',
            'cpp',
            'c',
            'go',
            'rust'
        ];
        return supportedLanguages.includes(document.languageId);
    }
    async updateDiagnostics(document) {
        try {
            // Request diagnostics from language server
            const diagnostics = await this.client.sendRequest('textDocument/diagnostic', {
                textDocument: {
                    uri: document.uri.toString()
                }
            });
            if (Array.isArray(diagnostics)) {
                const vscodeDiagnostics = diagnostics.map((diag) => {
                    const range = new vscode.Range(diag.range.start.line, diag.range.start.character, diag.range.end.line, diag.range.end.character);
                    const diagnostic = new vscode.Diagnostic(range, diag.message, this.mapSeverity(diag.severity));
                    diagnostic.source = diag.source || 'MARIA';
                    diagnostic.code = diag.code;
                    return diagnostic;
                });
                this.diagnosticCollection.set(document.uri, vscodeDiagnostics);
            }
        }
        catch (error) {
            console.error('Failed to update diagnostics:', error);
        }
    }
    mapSeverity(severity) {
        switch (severity) {
            case 1:
                return vscode.DiagnosticSeverity.Error;
            case 2:
                return vscode.DiagnosticSeverity.Warning;
            case 3:
                return vscode.DiagnosticSeverity.Information;
            case 4:
                return vscode.DiagnosticSeverity.Hint;
            default:
                return vscode.DiagnosticSeverity.Information;
        }
    }
    dispose() {
        this.diagnosticCollection.dispose();
    }
}
exports.MariaDiagnosticProvider = MariaDiagnosticProvider;
//# sourceMappingURL=DiagnosticProvider.js.map