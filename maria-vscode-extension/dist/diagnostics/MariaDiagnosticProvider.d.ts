import * as vscode from 'vscode';
export declare class MariaDiagnosticProvider implements vscode.Disposable {
    private diagnosticCollection;
    constructor();
    updateDiagnostics(document: vscode.TextDocument): void;
    clearDiagnostics(): void;
    dispose(): void;
}
//# sourceMappingURL=MariaDiagnosticProvider.d.ts.map