import * as vscode from 'vscode';
export declare class MariaWebviewProvider implements vscode.WebviewViewProvider {
    private readonly _extensionUri;
    private _view?;
    constructor(_extensionUri: vscode.Uri);
    resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken): void;
    private _getHtmlForWebview;
}
//# sourceMappingURL=MariaWebviewProvider.d.ts.map