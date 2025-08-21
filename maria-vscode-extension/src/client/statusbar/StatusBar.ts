import * as vscode from 'vscode';

export class MariaStatusBar {
  private statusBarItem: vscode.StatusBarItem;
  private context: vscode.ExtensionContext;
  
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.command = 'maria.openChat';
    this.statusBarItem.tooltip = 'MARIA AI Assistant';
    this.statusBarItem.show();
    
    context.subscriptions.push(this.statusBarItem);
  }
  
  update(text: string, state: 'ready' | 'loading' | 'error' | 'info' = 'ready'): void {
    const icons = {
      ready: '$(check)',
      loading: '$(sync~spin)',
      error: '$(error)',
      info: '$(info)'
    };
    
    this.statusBarItem.text = `${icons[state]} MARIA: ${text}`;
    
    // Update color based on state
    switch (state) {
      case 'ready':
        this.statusBarItem.backgroundColor = undefined;
        break;
      case 'loading':
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        break;
      case 'error':
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        break;
      case 'info':
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
        break;
    }
  }
  
  dispose(): void {
    this.statusBarItem.dispose();
  }
}