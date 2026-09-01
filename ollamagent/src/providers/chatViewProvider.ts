import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { OllamaClient } from '../ollama/client';
import { AgentLoop } from '../agent/agentLoop';
import { OllamaMessage, OllamaModel } from '../ollama/types';
import { QUICK_PROMPTS } from '../agent/systemPrompts';
import { getBundledWebviewHtml } from '../webview/bundledView';

export interface ChatSession {
  id: string;
  title: string;
  timestamp: number;
  timeDisplay: string;
  model: string;
  messageCount: number;
  messages: OllamaMessage[];
}

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ollamagent.chatView';
  private _view?: vscode.WebviewView;
  private client: OllamaClient;
  private agentLoop: AgentLoop;
  private history: OllamaMessage[] = [];
  private currentSessionId: string = '';
  private currentAbortController?: AbortController;
  private models: OllamaModel[] = [];
  private selectedModel: string = '';
  private autonomousMode: boolean = true;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    const config = vscode.workspace.getConfiguration('ollamagent');
    const endpoint = config.get<string>('endpoint', 'http://127.0.0.1:11434');
    this.selectedModel = config.get<string>('model', 'llama3.1:latest');
    this.autonomousMode = config.get<boolean>('autonomousMode', true);

    this.client = new OllamaClient(endpoint);
    this.agentLoop = new AgentLoop(this.client);
    this.currentSessionId = `session_${Date.now()}`;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };

    webviewView.webview.html = getBundledWebviewHtml(webviewView.webview, this.context.extensionUri);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'ready': {
          await this.refreshModels();
          this.sendActiveContext();
          this.sendSavedSessions();
          this.postMessage({
            type: 'init',
            autonomous: this.autonomousMode,
            selectedModel: this.selectedModel,
          });
          break;
        }

        case 'send': {
          await this.handleUserMessage(data.text, data.context);
          break;
        }

        case 'stop': {
          this.abortCurrentRun();
          break;
        }

        case 'clear': {
          this.history = [];
          this.currentSessionId = `session_${Date.now()}`;
          break;
        }

        case 'newChat': {
          this.startNewChat();
          break;
        }

        case 'getSessions': {
          this.sendSavedSessions();
          break;
        }

        case 'loadSession': {
          this.loadSession(data.id);
          break;
        }

        case 'deleteSession': {
          this.deleteSession(data.id);
          break;
        }

        case 'clearAllSessions': {
          this.clearAllSessions();
          break;
        }

        case 'saveCurrentSession': {
          this.saveCurrentSession();
          break;
        }

        case 'exportChat': {
          await this.exportChat();
          break;
        }

        case 'setModel': {
          this.selectedModel = data.model;
          vscode.workspace
            .getConfiguration('ollamagent')
            .update('model', data.model, vscode.ConfigurationTarget.Global);
          break;
        }

        case 'setAutonomous': {
          this.autonomousMode = Boolean(data.enabled);
          vscode.workspace
            .getConfiguration('ollamagent')
            .update('autonomousMode', this.autonomousMode, vscode.ConfigurationTarget.Global);
          break;
        }

        case 'requestContext': {
          this.sendActiveContext();
          break;
        }

        case 'quickAction': {
          await this.handleQuickAction(data.action);
          break;
        }

        case 'insertCode': {
          this.insertCodeIntoActiveEditor(data.code);
          break;
        }

        case 'applyCode': {
          this.applyCodeToActiveEditor(data.code);
          break;
        }
      }
    });

    // Listen to active editor changes to keep context ready
    vscode.window.onDidChangeActiveTextEditor(() => {
      this.sendActiveContext();
    });
  }

  public async refreshModels(): Promise<OllamaModel[]> {
    try {
      const config = vscode.workspace.getConfiguration('ollamagent');
      const endpoint = config.get<string>('endpoint', 'http://127.0.0.1:11434');
      this.client.setBaseUrl(endpoint);

      this.models = await this.client.listModels();
      const runningModels = await this.client.getRunningModels();

      if (runningModels.length > 0) {
        if (!this.selectedModel || !this.models.some((m) => m.name === this.selectedModel)) {
          this.selectedModel = runningModels[0].name;
        }
      } else if (this.models.length > 0 && !this.models.some((m) => m.name === this.selectedModel)) {
        this.selectedModel = this.models[0].name;
      }

      this.postMessage({
        type: 'models',
        models: this.models,
        selectedModel: this.selectedModel,
        runningModels: runningModels.map((m) => m.name),
      });

      this.postMessage({
        type: 'status',
        online: true,
        endpoint,
      });

      return this.models;
    } catch (err: any) {
      this.postMessage({
        type: 'status',
        online: false,
        endpoint: this.client.getBaseUrl(),
        error: err.message,
      });
      return [];
    }
  }

  public getSelectedModel(): string {
    return this.selectedModel;
  }

  public setSelectedModel(model: string) {
    this.selectedModel = model;
    this.postMessage({
      type: 'models',
      models: this.models,
      selectedModel: this.selectedModel,
    });
  }

  public startNewChat() {
    this.abortCurrentRun();
    this.saveCurrentSession();
    this.history = [];
    this.currentSessionId = `session_${Date.now()}`;
    this.postMessage({ type: 'clear' });
  }

  public sendPromptToChat(promptText: string) {
    if (this._view) {
      this._view.show(true);
      this.handleUserMessage(promptText);
    }
  }

  private async handleUserMessage(userText: string, context?: any) {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
    this.currentAbortController = new AbortController();

    let fullPrompt = userText;
    if (context && context.selection) {
      fullPrompt = `[Context File: ${context.fileName} (${context.languageId}) - Lines ${context.startLine}-${context.endLine}]\n\`\`\`${context.languageId}\n${context.selection}\n\`\`\`\n\n${userText}`;
    }

    const config = vscode.workspace.getConfiguration('ollamagent');
    const temperature = config.get<number>('temperature', 0.2);
    const numCtx = config.get<number>('contextWindow', 16384);
    const numPredict = config.get<number>('maxTokens', -1);
    const systemOverride = config.get<string>('systemPrompt', '');

    try {
      this.history = await this.agentLoop.run(
        this.history,
        fullPrompt,
        {
          model: this.selectedModel,
          temperature,
          numCtx,
          numPredict,
          autonomousMode: this.autonomousMode,
          systemPromptOverride: systemOverride,
        },
        {
          onTurnStart: (turn) => this.postMessage({ type: 'turnStart', turn }),
          onThinking: (thought) => this.postMessage({ type: 'thinking', thought }),
          onToken: (token) => this.postMessage({ type: 'token', token }),
          onToolStart: (toolCall) => this.postMessage({ type: 'toolStart', toolCall }),
          onToolResult: (result) => this.postMessage({ type: 'toolResult', result }),
          onComplete: (response) => {
            this.postMessage({ type: 'complete', response });
            this.saveCurrentSession();
          },
          onError: (err) => this.postMessage({ type: 'error', error: err.message }),
        },
        this.currentAbortController.signal
      );
    } catch (err: any) {
      this.postMessage({ type: 'error', error: err.message });
    } finally {
      this.currentAbortController = undefined;
    }
  }

  // --- Session Management & Storage ---

  private getStoredSessions(): ChatSession[] {
    return this.context.globalState.get<ChatSession[]>('ollamagent.savedSessions', []);
  }

  private setStoredSessions(sessions: ChatSession[]) {
    this.context.globalState.update('ollamagent.savedSessions', sessions);
  }

  public saveCurrentSession() {
    if (this.history.length === 0) return;

    const sessions = this.getStoredSessions();
    const firstUserMsg = this.history.find((m) => m.role === 'user')?.content || 'Chat Session';
    const cleanTitle = firstUserMsg.replace(/\[Context File:[^\]]+\]\s*/g, '').slice(0, 50).trim() || 'Conversation';

    const now = new Date();
    const timeDisplay = now.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const existingIndex = sessions.findIndex((s) => s.id === this.currentSessionId);
    const sessionData: ChatSession = {
      id: this.currentSessionId,
      title: cleanTitle,
      timestamp: Date.now(),
      timeDisplay,
      model: this.selectedModel,
      messageCount: this.history.length,
      messages: this.history,
    };

    if (existingIndex >= 0) {
      sessions[existingIndex] = sessionData;
    } else {
      sessions.unshift(sessionData);
    }

    // Keep at most 50 past sessions
    if (sessions.length > 50) {
      sessions.splice(50);
    }

    this.setStoredSessions(sessions);
    this.sendSavedSessions();
  }

  public sendSavedSessions() {
    const sessions = this.getStoredSessions();
    this.postMessage({
      type: 'sessions',
      sessions,
    });
  }

  public loadSession(id: string) {
    const sessions = this.getStoredSessions();
    const target = sessions.find((s) => s.id === id);
    if (!target) return;

    this.abortCurrentRun();
    this.currentSessionId = target.id;
    this.history = target.messages || [];
    if (target.model) {
      this.selectedModel = target.model;
    }

    this.postMessage({
      type: 'loadConversation',
      messages: this.history,
    });
  }

  public deleteSession(id: string) {
    let sessions = this.getStoredSessions();
    sessions = sessions.filter((s) => s.id !== id);
    this.setStoredSessions(sessions);
    this.sendSavedSessions();
  }

  public clearAllSessions() {
    this.setStoredSessions([]);
    this.sendSavedSessions();
  }

  public async exportChat() {
    if (this.history.length === 0) {
      vscode.window.showInformationMessage('No active chat conversation to export.');
      return;
    }

    const choice = await vscode.window.showQuickPick(
      [
        { label: '$(markdown) Markdown File (.md)', format: 'md', description: 'Export formatted conversation report' },
        { label: '$(json) JSON File (.json)', format: 'json', description: 'Export raw structured chat messages' },
      ],
      { placeHolder: 'Select export format for conversation' }
    );

    if (!choice) return;

    const defaultName = `ollama-chat-${new Date().toISOString().slice(0, 10)}.${choice.format}`;
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', defaultName)),
      filters: choice.format === 'md' ? { 'Markdown': ['md'] } : { 'JSON': ['json'] },
    });

    if (!uri) return;

    let output = '';
    if (choice.format === 'json') {
      output = JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          model: this.selectedModel,
          messages: this.history,
        },
        null,
        2
      );
    } else {
      output = `# Ollama Agent Conversation\n\n- **Date**: ${new Date().toLocaleString()}\n- **Model**: \`${this.selectedModel}\`\n\n---\n\n`;
      this.history.forEach((m) => {
        if (m.role === 'user') {
          output += `### 👤 User\n\n${m.content}\n\n`;
        } else if (m.role === 'assistant') {
          output += `### 🦙 Ollama Agent\n\n${m.content}\n\n`;
        } else if (m.role === 'tool') {
          output += `> ⚡ **Tool Execution Result**:\n> \`\`\`\n> ${m.content}\n> \`\`\`\n\n`;
        }
      });
    }

    fs.writeFileSync(uri.fsPath, output, 'utf8');
    vscode.window.showInformationMessage(`Chat successfully exported to ${path.basename(uri.fsPath)}`);
  }

  private async handleQuickAction(action: string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('Open a file in the editor to use quick actions.');
      return;
    }

    const doc = editor.document;
    const selection = editor.selection;
    const selectedText = !selection.isEmpty
      ? doc.getText(selection)
      : doc.getText();
    const languageId = doc.languageId;

    let prompt = '';
    switch (action) {
      case 'explain':
        prompt = QUICK_PROMPTS.explain(selectedText, languageId);
        break;
      case 'refactor':
        prompt = QUICK_PROMPTS.refactor(selectedText, languageId);
        break;
      case 'tests':
        prompt = QUICK_PROMPTS.generateTests(selectedText, languageId);
        break;
      case 'diagnostics': {
        const diagnostics = vscode.languages.getDiagnostics(doc.uri);
        const diagStr = diagnostics
          .map((d) => `Line ${d.range.start.line + 1}: ${d.message}`)
          .join('\n');
        prompt = QUICK_PROMPTS.fixDiagnostics(selectedText, diagStr || 'No obvious diagnostics.', languageId);
        break;
      }
    }

    if (prompt) {
      await this.handleUserMessage(prompt);
    }
  }

  private sendActiveContext() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.postMessage({ type: 'context', context: null });
      return;
    }

    const doc = editor.document;
    const selection = editor.selection;
    const selectionText = !selection.isEmpty ? doc.getText(selection) : '';

    this.postMessage({
      type: 'context',
      context: {
        fileName: path.basename(doc.fileName),
        filePath: doc.fileName,
        languageId: doc.languageId,
        selection: selectionText,
        startLine: selection.start.line + 1,
        endLine: selection.end.line + 1,
      },
    });
  }

  private insertCodeIntoActiveEditor(code: string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    editor.edit((editBuilder) => {
      if (editor.selection.isEmpty) {
        editBuilder.insert(editor.selection.active, code);
      } else {
        editBuilder.replace(editor.selection, code);
      }
    });
  }

  private applyCodeToActiveEditor(code: string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const fullRange = new vscode.Range(
      editor.document.positionAt(0),
      editor.document.positionAt(editor.document.getText().length)
    );

    editor.edit((editBuilder) => {
      if (!editor.selection.isEmpty) {
        editBuilder.replace(editor.selection, code);
      } else {
        editBuilder.replace(fullRange, code);
      }
    });
  }

  public abortCurrentRun() {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = undefined;
      this.postMessage({ type: 'complete', response: '\n*(Cancelled by user)*' });
    }
  }

  private postMessage(message: any) {
    this._view?.webview.postMessage(message);
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const extensionPath = this.context.extensionUri.fsPath;
    
    // Find HTML file
    let htmlPath = path.join(extensionPath, 'dist', 'webview', 'index.html');
    if (!fs.existsSync(htmlPath)) {
      htmlPath = path.join(extensionPath, 'src', 'webview', 'index.html');
    }

    let cssPath = path.join(extensionPath, 'dist', 'webview', 'main.css');
    if (!fs.existsSync(cssPath)) {
      cssPath = path.join(extensionPath, 'src', 'webview', 'main.css');
    }

    let jsPath = path.join(extensionPath, 'dist', 'webview', 'main.js');
    if (!fs.existsSync(jsPath)) {
      jsPath = path.join(extensionPath, 'src', 'webview', 'main.js');
    }

    let htmlContent = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, 'utf8') : '';
    const cssContent = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
    const jsContent = fs.existsSync(jsPath) ? fs.readFileSync(jsPath, 'utf8') : '';

    const nonce = getNonce();
    const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource} 'unsafe-inline' 'unsafe-eval'; img-src ${webview.cspSource} data: https:;">`;

    // Inject CSP into head
    if (htmlContent.includes('<head>')) {
      htmlContent = htmlContent.replace('<head>', `<head>\n  ${csp}`);
    }

    // Inline styles directly for instant, guaranteed rendering
    if (cssContent) {
      htmlContent = htmlContent.replace('<link rel="stylesheet" href="main.css">', `<style>\n${cssContent}\n</style>`);
    }

    // Inline JavaScript directly with nonce
    if (jsContent) {
      htmlContent = htmlContent.replace('<script src="main.js"></script>', `<script nonce="${nonce}">\n${jsContent}\n</script>`);
    }

    return htmlContent;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
