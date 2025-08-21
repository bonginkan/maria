import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
export declare class MariaCommandManager {
    private context;
    private client;
    private configManager;
    private licenseStatus;
    private telemetry;
    constructor(context: vscode.ExtensionContext, client: LanguageClient, configManager: any, licenseStatus: any, telemetry: any);
    registerCommands(): Promise<void>;
    private generateCode;
    private analyzeBugs;
    private runLint;
    private typeCheck;
    private securityReview;
    private openChat;
    private switchProvider;
    private toggleInternalMode;
    private showDocumentation;
    private validateLicense;
    private chat;
    provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext): Promise<vscode.CodeAction[]>;
    provideCompletions(): vscode.CompletionItem[];
    private getDocumentationHtml;
}
//# sourceMappingURL=CommandManager.d.ts.map