import * as vscode from 'vscode';
export declare class MariaTreeViewProvider implements vscode.TreeDataProvider<MariaTreeItem> {
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<MariaTreeItem | undefined | null | void>;
    constructor();
    refresh(): void;
    getTreeItem(element: MariaTreeItem): vscode.TreeItem;
    getChildren(element?: MariaTreeItem): Thenable<MariaTreeItem[]>;
}
export declare class MariaTreeItem extends vscode.TreeItem {
    readonly label: string;
    readonly collapsibleState: vscode.TreeItemCollapsibleState;
    readonly command?: vscode.Command | undefined;
    constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState, command?: vscode.Command | undefined);
}
//# sourceMappingURL=MariaTreeViewProvider.d.ts.map