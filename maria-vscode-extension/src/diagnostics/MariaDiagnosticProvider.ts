import * as vscode from 'vscode';

export class MariaDiagnosticProvider implements vscode.Disposable {
  private diagnosticCollection: vscode.DiagnosticCollection;
  
  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('maria');
  }
  
  public updateDiagnostics(document: vscode.TextDocument): void {
    const diagnostics: vscode.Diagnostic[] = [];
    
    // Simple example: detect TODO comments
    const text = document.getText();
    const lines = text.split('\n');
    
    lines.forEach((line, i) => {
      const todoMatch = line.match(/TODO|FIXME|HACK/gi);
      if (todoMatch) {
        const index = line.indexOf(todoMatch[0]);
        const range = new vscode.Range(i, index, i, index + todoMatch[0].length);
        const diagnostic = new vscode.Diagnostic(
          range,
          `${todoMatch[0]} comment found`,
          vscode.DiagnosticSeverity.Information
        );
        diagnostic.source = 'MARIA';
        diagnostics.push(diagnostic);
      }
      
      // Simple security check
      if (line.match(/password\s*=\s*["'][^"']+["']/i)) {
        const range = new vscode.Range(i, 0, i, line.length);
        const diagnostic = new vscode.Diagnostic(
          range,
          'Potential hardcoded password detected',
          vscode.DiagnosticSeverity.Warning
        );
        diagnostic.source = 'MARIA Security';
        diagnostics.push(diagnostic);
      }
    });
    
    this.diagnosticCollection.set(document.uri, diagnostics);
  }
  
  public clearDiagnostics(): void {
    this.diagnosticCollection.clear();
  }
  
  public dispose(): void {
    this.diagnosticCollection.dispose();
  }
}