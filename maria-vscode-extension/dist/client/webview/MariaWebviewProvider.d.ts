import * as vscode from 'vscode';
export declare class MariaWebviewProvider implements vscode.WebviewViewProvider {
    static readonly viewType = "maria.chatView";
    private _view?;
    private _extensionUri;
    private _configManager;
    private _licenseStatus;
    private _chatHistory;
    constructor(extensionUri: vscode.Uri, configManager: any, licenseStatus: any);
    resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken): void;
    private _handleChatMessage;
    private _handleCommand;
    private _exportChatHistory;
    private _updateWebview;
    private _getHtmlForWebview;
    private _getNonce;
}
//# sourceMappingURL=MariaWebviewProvider.d.ts.map