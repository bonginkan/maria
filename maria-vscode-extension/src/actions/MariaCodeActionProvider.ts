import * as vscode from 'vscode';

export class MariaCodeActionProvider implements vscode.CodeActionProvider {
  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
    const actions: vscode.CodeAction[] = [];
    
    // Create quick fix actions for diagnostics
    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source === 'MARIA' || diagnostic.source === 'MARIA Security') {
        const action = new vscode.CodeAction(
          `Fix: ${diagnostic.message}`,
          vscode.CodeActionKind.QuickFix
        );
        action.diagnostics = [diagnostic];
        actions.push(action);
      }
    }
    
    // Add refactoring actions
    if (!range.isEmpty) {
      const extractAction = new vscode.CodeAction(
        'MARIA: Extract Method',
        vscode.CodeActionKind.RefactorExtract
      );
      extractAction.command = {
        command: 'maria.refactorExtract',
        title: 'Extract Method',
        arguments: [document, range]
      };
      actions.push(extractAction);
      
      const improveAction = new vscode.CodeAction(
        'MARIA: Improve Code',
        vscode.CodeActionKind.RefactorRewrite
      );
      improveAction.command = {
        command: 'maria.improveCode',
        title: 'Improve Code',
        arguments: [document, range]
      };
      actions.push(improveAction);
    }
    
    // Add source action
    const organizeAction = new vscode.CodeAction(
      'MARIA: Organize and Clean',
      vscode.CodeActionKind.Source
    );
    organizeAction.command = {
      command: 'maria.organizeCode',
      title: 'Organize Code'
    };
    actions.push(organizeAction);
    
    return actions;
  }
}