import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function getBundledWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const nonce = getNonce();

  const possiblePaths = [
    path.join(__dirname, 'webview', 'index.html'),
    path.join(extensionUri.fsPath, 'dist', 'webview', 'index.html'),
    path.join(extensionUri.fsPath, 'src', 'webview', 'index.html'),
  ];

  let html = '';
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      html = fs.readFileSync(p, 'utf8');
      break;
    }
  }

  const cssPaths = [
    path.join(__dirname, 'webview', 'main.css'),
    path.join(extensionUri.fsPath, 'dist', 'webview', 'main.css'),
    path.join(extensionUri.fsPath, 'src', 'webview', 'main.css'),
  ];
  let css = '';
  for (const p of cssPaths) {
    if (fs.existsSync(p)) {
      css = fs.readFileSync(p, 'utf8');
      break;
    }
  }

  const jsPaths = [
    path.join(__dirname, 'webview', 'main.js'),
    path.join(extensionUri.fsPath, 'dist', 'webview', 'main.js'),
    path.join(extensionUri.fsPath, 'src', 'webview', 'main.js'),
  ];
  let js = '';
  for (const p of jsPaths) {
    if (fs.existsSync(p)) {
      js = fs.readFileSync(p, 'utf8');
      break;
    }
  }

  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource} 'unsafe-inline' 'unsafe-eval'; img-src ${webview.cspSource} data: https:;">`;

  if (html.includes('<head>')) {
    html = html.replace('<head>', `<head>\n  ${csp}`);
  }

  if (css) {
    html = html.replace('<link rel="stylesheet" href="main.css">', `<style>\n${css}\n</style>`);
  }

  if (js) {
    html = html.replace('<script src="main.js"></script>', `<script nonce="${nonce}">\n${js}\n</script>`);
  }

  return html;
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
