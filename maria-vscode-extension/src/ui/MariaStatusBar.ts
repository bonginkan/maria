import * as vscode from 'vscode';

export class MariaStatusBar implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;
  
  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.text = '$(sparkle) MARIA Ready';
    this.statusBarItem.tooltip = 'MARIA AI Assistant';
    this.statusBarItem.command = 'maria.openChat';
    this.statusBarItem.show();
  }
  
  public update(text: string, tooltip?: string): void {
    this.statusBarItem.text = `$(sparkle) MARIA: ${text}`;
    if (tooltip) {
      this.statusBarItem.tooltip = tooltip;
    }
  }
  
  public dispose(): void {
    this.statusBarItem.dispose();
  }
}