import * as vscode from 'vscode';

export class OllamaCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
    vscode.CodeActionKind.Refactor,
  ];

  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    _token: vscode.CancellationToken
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    // 1. Diagnostic Quick Fix Action
    if (context.diagnostics.length > 0) {
      const fixAction = new vscode.CodeAction(
        '🦙 Ollama Agent: Fix diagnostic errors with local AI',
        vscode.CodeActionKind.QuickFix
      );
      fixAction.command = {
        command: 'ollamagent.fixDiagnostics',
        title: 'Fix with Ollama Agent',
      };
      fixAction.isPreferred = true;
      actions.push(fixAction);
    }

    // 2. Refactor Action
    if (!range.isEmpty) {
      const refactorAction = new vscode.CodeAction(
        '🦙 Ollama Agent: Refactor selected code',
        vscode.CodeActionKind.RefactorRewrite
      );
      refactorAction.command = {
        command: 'ollamagent.refactorCode',
        title: 'Refactor with Ollama Agent',
      };
      actions.push(refactorAction);

      const explainAction = new vscode.CodeAction(
        '🦙 Ollama Agent: Explain selected code',
        vscode.CodeActionKind.Empty
      );
      explainAction.command = {
        command: 'ollamagent.explainCode',
        title: 'Explain with Ollama Agent',
      };
      actions.push(explainAction);

      const testAction = new vscode.CodeAction(
        '🦙 Ollama Agent: Generate unit tests',
        vscode.CodeActionKind.RefactorExtract
      );
      testAction.command = {
        command: 'ollamagent.generateTests',
        title: 'Generate tests with Ollama Agent',
      };
      actions.push(testAction);
    }

    return actions;
  }
}
