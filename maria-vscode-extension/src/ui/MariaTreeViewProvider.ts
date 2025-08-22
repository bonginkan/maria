import * as vscode from 'vscode';

export class MariaTreeViewProvider implements vscode.TreeDataProvider<MariaTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<MariaTreeItem | undefined | null | void> = new vscode.EventEmitter<MariaTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<MariaTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
  
  constructor() {}
  
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
  
  getTreeItem(element: MariaTreeItem): vscode.TreeItem {
    return element;
  }
  
  getChildren(element?: MariaTreeItem): Thenable<MariaTreeItem[]> {
    if (!element) {
      // Root items
      return Promise.resolve([
        new MariaTreeItem('Commands', vscode.TreeItemCollapsibleState.Expanded),
        new MariaTreeItem('AI Models', vscode.TreeItemCollapsibleState.Collapsed),
        new MariaTreeItem('Settings', vscode.TreeItemCollapsibleState.Collapsed)
      ]);
    } else if (element.label === 'Commands') {
      return Promise.resolve([
        new MariaTreeItem('Generate Code', vscode.TreeItemCollapsibleState.None, {
          command: 'maria.generateCode',
          title: 'Generate Code'
        }),
        new MariaTreeItem('Analyze Bugs', vscode.TreeItemCollapsibleState.None, {
          command: 'maria.analyzeBugs',
          title: 'Analyze Bugs'
        }),
        new MariaTreeItem('Security Review', vscode.TreeItemCollapsibleState.None, {
          command: 'maria.securityReview',
          title: 'Security Review'
        })
      ]);
    } else if (element.label === 'AI Models') {
      return Promise.resolve([
        new MariaTreeItem('GPT-4', vscode.TreeItemCollapsibleState.None),
        new MariaTreeItem('Claude', vscode.TreeItemCollapsibleState.None),
        new MariaTreeItem('Local LLM', vscode.TreeItemCollapsibleState.None)
      ]);
    }
    return Promise.resolve([]);
  }
}

export class MariaTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.tooltip = this.label;
    this.contextValue = 'mariaItem';
  }
}