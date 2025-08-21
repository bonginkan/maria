import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';

export class MariaDiagnosticProvider {
  private client: LanguageClient;
  private diagnosticCollection: vscode.DiagnosticCollection;
  
  constructor(client: LanguageClient) {
    this.client = client;
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('maria');
  }
  
  async initialize(): Promise<void> {
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
  
  private shouldAnalyze(document: vscode.TextDocument): boolean {
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
  
  async updateDiagnostics(document: vscode.TextDocument): Promise<void> {
    try {
      // Request diagnostics from language server
      const diagnostics = await this.client.sendRequest('textDocument/diagnostic', {
        textDocument: {
          uri: document.uri.toString()
        }
      });
      
      if (Array.isArray(diagnostics)) {
        const vscodeDiagnostics = diagnostics.map((diag: any) => {
          const range = new vscode.Range(
            diag.range.start.line,
            diag.range.start.character,
            diag.range.end.line,
            diag.range.end.character
          );
          
          const diagnostic = new vscode.Diagnostic(
            range,
            diag.message,
            this.mapSeverity(diag.severity)
          );
          
          diagnostic.source = diag.source || 'MARIA';
          diagnostic.code = diag.code;
          
          return diagnostic;
        });
        
        this.diagnosticCollection.set(document.uri, vscodeDiagnostics);
      }
    } catch (error) {
      console.error('Failed to update diagnostics:', error);
    }
  }
  
  private mapSeverity(severity: number): vscode.DiagnosticSeverity {
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
  
  dispose(): void {
    this.diagnosticCollection.dispose();
  }
}