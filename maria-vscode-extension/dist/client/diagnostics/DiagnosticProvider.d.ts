import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
export declare class MariaDiagnosticProvider {
    private client;
    private diagnosticCollection;
    constructor(client: LanguageClient);
    initialize(): Promise<void>;
    private shouldAnalyze;
    updateDiagnostics(document: vscode.TextDocument): Promise<void>;
    private mapSeverity;
    dispose(): void;
}
//# sourceMappingURL=DiagnosticProvider.d.ts.map