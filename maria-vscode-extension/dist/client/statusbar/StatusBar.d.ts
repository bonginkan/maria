import * as vscode from 'vscode';
export declare class MariaStatusBar {
    private statusBarItem;
    private context;
    constructor(context: vscode.ExtensionContext);
    update(text: string, state?: 'ready' | 'loading' | 'error' | 'info'): void;
    dispose(): void;
}
//# sourceMappingURL=StatusBar.d.ts.map