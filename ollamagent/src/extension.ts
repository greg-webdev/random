import * as vscode from 'vscode';
import { ChatViewProvider } from './providers/chatViewProvider';
import { OllamaCodeActionProvider } from './providers/codeActionProvider';
import { QUICK_PROMPTS } from './agent/systemPrompts';

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  console.log('[OllamaAgent] Activating extension...');

  // 1. Webview Provider
  const chatProvider = new ChatViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, chatProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  // 2. Status Bar Item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'ollamagent.selectModel';
  statusBarItem.tooltip = 'Ollama Agent: Click to open panel or switch model (Right-click for options)';
  updateStatusBar(chatProvider.getSelectedModel() || 'Ollama');
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // 3. Code Action Provider
  const codeActionProvider = new OllamaCodeActionProvider();
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { scheme: 'file' },
      codeActionProvider,
      {
        providedCodeActionKinds: OllamaCodeActionProvider.providedCodeActionKinds,
      }
    )
  );

  // 4. Commands Registration
  context.subscriptions.push(
    vscode.commands.registerCommand('ollamagent.openChat', async () => {
      try {
        await vscode.commands.executeCommand('ollamagent.chatView.focus');
      } catch {
        await vscode.commands.executeCommand('workbench.view.extension.ollamagent-sidebar');
      }
    }),

    vscode.commands.registerCommand('ollamagent.newChat', () => {
      chatProvider.startNewChat();
      vscode.commands.executeCommand('ollamagent.openChat');
    }),

    vscode.commands.registerCommand('ollamagent.saveChat', () => {
      chatProvider.saveCurrentSession();
      vscode.window.showInformationMessage('Chat session saved to history.');
    }),

    vscode.commands.registerCommand('ollamagent.exportChat', async () => {
      await chatProvider.exportChat();
    }),

    vscode.commands.registerCommand('ollamagent.selectModel', async () => {
      const models = await chatProvider.refreshModels();
      const currentModel = chatProvider.getSelectedModel();

      type ActionQuickPickItem = vscode.QuickPickItem & {
        action?: string;
        modelName?: string;
      };

      const items: ActionQuickPickItem[] = [
        {
          label: '$(comment-discussion) Open Ollama Agent Panel',
          description: 'Show chat sidebar',
          action: 'openChat',
        },
        {
          label: '$(add) Start New Chat Session',
          description: 'Clear history and reset agent',
          action: 'newChat',
        },
        {
          label: '$(refresh) Refresh Available Models',
          description: 'Query Ollama API tags',
          action: 'refreshModels',
        },
        {
          label: 'Installed Ollama Models',
          kind: vscode.QuickPickItemKind.Separator,
        },
      ];

      if (models.length === 0) {
        items.push({
          label: '$(warning) No Ollama models found',
          description: 'Ensure Ollama is running (`ollama serve`)',
        });
      } else {
        models.forEach((m) => {
          const isCurrent = m.name === currentModel;
          const icon = isCurrent ? '$(check)' : '$(symbol-constant)';
          const size = m.details?.parameter_size ? `Size: ${m.details.parameter_size}` : '';
          const family = m.details?.family ? `Family: ${m.details.family}` : '';
          const desc = [size, family].filter(Boolean).join(' | ');

          items.push({
            label: `${icon} ${m.name}`,
            description: isCurrent ? `${desc} (Current)` : desc,
            modelName: m.name,
            action: 'selectModel',
          });
        });
      }

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: `Ollama Agent (${currentModel || 'No model selected'}) - Select an action or switch model`,
      });

      if (!selected) return;

      if (selected.action === 'openChat') {
        vscode.commands.executeCommand('ollamagent.openChat');
      } else if (selected.action === 'newChat') {
        vscode.commands.executeCommand('ollamagent.newChat');
      } else if (selected.action === 'refreshModels') {
        vscode.commands.executeCommand('ollamagent.refreshModels');
      } else if (selected.action === 'selectModel' && selected.modelName) {
        chatProvider.setSelectedModel(selected.modelName);
        updateStatusBar(selected.modelName);
        vscode.workspace
          .getConfiguration('ollamagent')
          .update('model', selected.modelName, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Active Ollama model set to: ${selected.modelName}`);
      }
    }),

    vscode.commands.registerCommand('ollamagent.refreshModels', async () => {
      const models = await chatProvider.refreshModels();
      updateStatusBar(chatProvider.getSelectedModel() || 'Ollama');
      vscode.window.showInformationMessage(
        `Refreshed Ollama models: Found ${models.length} model(s).`
      );
    }),

    vscode.commands.registerCommand('ollamagent.explainCode', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.selection.isEmpty) {
        vscode.window.showInformationMessage('Please select code to explain.');
        return;
      }
      const code = editor.document.getText(editor.selection);
      const prompt = QUICK_PROMPTS.explain(code, editor.document.languageId);
      chatProvider.sendPromptToChat(prompt);
    }),

    vscode.commands.registerCommand('ollamagent.refactorCode', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.selection.isEmpty) {
        vscode.window.showInformationMessage('Please select code to refactor.');
        return;
      }
      const code = editor.document.getText(editor.selection);
      const prompt = QUICK_PROMPTS.refactor(code, editor.document.languageId);
      chatProvider.sendPromptToChat(prompt);
    }),

    vscode.commands.registerCommand('ollamagent.generateTests', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.selection.isEmpty) {
        vscode.window.showInformationMessage('Please select code to generate tests for.');
        return;
      }
      const code = editor.document.getText(editor.selection);
      const prompt = QUICK_PROMPTS.generateTests(code, editor.document.languageId);
      chatProvider.sendPromptToChat(prompt);
    }),

    vscode.commands.registerCommand('ollamagent.fixDiagnostics', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage('No active editor found.');
        return;
      }
      const doc = editor.document;
      const selection = editor.selection.isEmpty
        ? new vscode.Range(0, 0, doc.lineCount, 0)
        : editor.selection;
      const code = doc.getText(selection);
      const diagnostics = vscode.languages
        .getDiagnostics(doc.uri)
        .filter((d) => selection.intersection(d.range));

      const diagStr = diagnostics
        .map((d) => `Line ${d.range.start.line + 1}: ${d.message}`)
        .join('\n');

      const prompt = QUICK_PROMPTS.fixDiagnostics(
        code,
        diagStr || 'Diagnostic error in current selection',
        doc.languageId
      );
      chatProvider.sendPromptToChat(prompt);
    })
  );

  console.log('[OllamaAgent] Activated successfully.');
}

function updateStatusBar(modelName: string) {
  if (statusBarItem) {
    statusBarItem.text = `$(sparkle) ${modelName}`;
  }
}

export function deactivate() {
  console.log('[OllamaAgent] Deactivated.');
}
