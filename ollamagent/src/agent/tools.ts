import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { OllamaTool } from '../ollama/types';

export interface ToolExecutionResult {
  toolName: string;
  args: Record<string, any>;
  output: string;
  error?: boolean;
}

export const OLLAMA_AGENT_TOOLS: OllamaTool[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read contents of a file in the workspace. Supports specifying line ranges.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative or absolute path to the file to read.',
          },
          start_line: {
            type: 'number',
            description: 'Optional 1-indexed starting line number.',
          },
          end_line: {
            type: 'number',
            description: 'Optional 1-indexed ending line number.',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Create a new file or completely overwrite an existing file with the provided content.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative or absolute file path to create/overwrite.',
          },
          content: {
            type: 'string',
            description: 'The exact text content to write to the file.',
          },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description: 'Replace a unique block of text inside an existing file with new content.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file to edit.',
          },
          target: {
            type: 'string',
            description: 'Exact text segment to search for and replace.',
          },
          replacement: {
            type: 'string',
            description: 'The new text to replace the target segment with.',
          },
        },
        required: ['path', 'target', 'replacement'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_directory',
      description: 'List contents of a directory (files and subfolders).',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative or absolute path of directory to list. Defaults to workspace root if empty.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_workspace',
      description: 'Search for text or regular expressions across workspace files.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Text pattern or keyword to search for.',
          },
          file_pattern: {
            type: 'string',
            description: 'Optional glob pattern to restrict search (e.g. "*.ts", "*.json").',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_terminal_command',
      description: 'Execute a shell command in the project directory and return its stdout / stderr output.',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'Command line string to execute.',
          },
          timeout_ms: {
            type: 'number',
            description: 'Maximum milliseconds to wait before timing out (default 30000ms).',
          },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_diagnostics',
      description: 'Retrieve current language diagnostics (syntax errors, type errors, lint warnings) in the workspace.',
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Optional specific file to get diagnostics for.',
          },
        },
        required: [],
      },
    },
  },
];

export class WorkspaceTools {
  private workspaceRoot: string;

  constructor() {
    this.workspaceRoot =
      vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
        ? vscode.workspace.workspaceFolders[0].uri.fsPath
        : process.cwd();
  }

  public resolvePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.join(this.workspaceRoot, filePath);
  }

  public async executeTool(name: string, args: Record<string, any>): Promise<ToolExecutionResult> {
    try {
      let output = '';
      switch (name) {
        case 'read_file': {
          output = await this.readFile(args.path, args.start_line, args.end_line);
          break;
        }
        case 'write_file': {
          output = await this.writeFile(args.path, args.content);
          break;
        }
        case 'edit_file': {
          output = await this.editFile(args.path, args.target, args.replacement);
          break;
        }
        case 'list_directory': {
          output = await this.listDirectory(args.path || '.');
          break;
        }
        case 'search_workspace': {
          output = await this.searchWorkspace(args.query, args.file_pattern);
          break;
        }
        case 'run_terminal_command': {
          output = await this.runTerminalCommand(args.command, args.timeout_ms);
          break;
        }
        case 'get_diagnostics': {
          output = await this.getDiagnostics(args.file_path);
          break;
        }
        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return { toolName: name, args, output, error: false };
    } catch (err: any) {
      return { toolName: name, args, output: `Error: ${err.message}`, error: true };
    }
  }

  private async readFile(filePath: string, startLine?: number, endLine?: number): Promise<string> {
    const fullPath = this.resolvePath(filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split(/\r?\n/);

    if (startLine !== undefined || endLine !== undefined) {
      const start = Math.max(1, startLine || 1) - 1;
      const end = Math.min(lines.length, endLine || lines.length);
      const sliced = lines.slice(start, end).map((l, i) => `${start + i + 1}: ${l}`);
      return `--- File: ${filePath} (Lines ${start + 1}-${end} of ${lines.length}) ---\n` + sliced.join('\n');
    }

    const numbered = lines.map((l, i) => `${i + 1}: ${l}`);
    return `--- File: ${filePath} (${lines.length} lines) ---\n` + numbered.join('\n');
  }

  private async writeFile(filePath: string, content: string): Promise<string> {
    const fullPath = this.resolvePath(filePath);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content, 'utf8');
    return `Successfully wrote ${Buffer.byteLength(content, 'utf8')} bytes to ${filePath}`;
  }

  private async editFile(filePath: string, target: string, replacement: string): Promise<string> {
    const fullPath = this.resolvePath(filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    const rawContent = fs.readFileSync(fullPath, 'utf8');

    // 1. Direct exact match
    if (rawContent.includes(target)) {
      const occurrences = rawContent.split(target).length - 1;
      if (occurrences > 1) {
        throw new Error(`Target text matched ${occurrences} times in ${filePath}. Please provide a larger unique context block.`);
      }
      const updated = rawContent.replace(target, replacement);
      fs.writeFileSync(fullPath, updated, 'utf8');
      return `Successfully replaced target in ${filePath}`;
    }

    // 2. Normalized line endings (\r\n vs \n) for Windows compatibility
    const normContent = rawContent.replace(/\r\n/g, '\n');
    const normTarget = target.replace(/\r\n/g, '\n');
    const normReplacement = replacement.replace(/\r\n/g, '\n');

    if (normContent.includes(normTarget)) {
      const occurrences = normContent.split(normTarget).length - 1;
      if (occurrences > 1) {
        throw new Error(`Target text matched ${occurrences} times in ${filePath}. Please provide a larger unique context block.`);
      }
      const updated = normContent.replace(normTarget, normReplacement);
      // Restore CRLF if original file had CRLF
      const finalContent = rawContent.includes('\r\n') ? updated.replace(/\n/g, '\r\n') : updated;
      fs.writeFileSync(fullPath, finalContent, 'utf8');
      return `Successfully replaced target in ${filePath}`;
    }

    // 3. Trimmed / fuzzy whitespace fallback
    const trimmedTarget = normTarget.trim();
    if (trimmedTarget && normContent.includes(trimmedTarget)) {
      const occurrences = normContent.split(trimmedTarget).length - 1;
      if (occurrences === 1) {
        const updated = normContent.replace(trimmedTarget, normReplacement.trim());
        const finalContent = rawContent.includes('\r\n') ? updated.replace(/\n/g, '\r\n') : updated;
        fs.writeFileSync(fullPath, finalContent, 'utf8');
        return `Successfully replaced target in ${filePath} (using trimmed match)`;
      }
    }

    throw new Error(`Target text was not found in ${filePath}. Verify line numbers and content using read_file.`);
  }

  private async listDirectory(dirPath: string): Promise<string> {
    const fullPath = this.resolvePath(dirPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Directory does not exist: ${dirPath}`);
    }

    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    const items = entries.map((e) => {
      const prefix = e.isDirectory() ? '[DIR]  ' : '[FILE] ';
      let sizeInfo = '';
      if (e.isFile()) {
        try {
          const stats = fs.statSync(path.join(fullPath, e.name));
          sizeInfo = ` (${stats.size} bytes)`;
        } catch {}
      }
      return `${prefix} ${e.name}${sizeInfo}`;
    });

    return `Contents of ${dirPath}:\n` + (items.length > 0 ? items.join('\n') : '(empty directory)');
  }

  private async searchWorkspace(query: string, filePattern?: string): Promise<string> {
    const results: string[] = [];
    const ignoreDirs = new Set(['node_modules', '.git', 'dist', 'out', 'build', '.gemini']);

    const searchRecursive = (dir: string) => {
      if (results.length >= 40) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length >= 40) break;
        const entryPath = path.join(dir, entry.name);
        const relPath = path.relative(this.workspaceRoot, entryPath);

        if (entry.isDirectory()) {
          if (!ignoreDirs.has(entry.name) && !entry.name.startsWith('.')) {
            try {
              searchRecursive(entryPath);
            } catch {}
          }
        } else if (entry.isFile()) {
          if (filePattern && !entry.name.includes(filePattern.replace('*', ''))) {
            continue;
          }
          try {
            const content = fs.readFileSync(entryPath, 'utf8');
            const lines = content.split(/\r?\n/);
            lines.forEach((line, idx) => {
              if (line.includes(query) && results.length < 40) {
                results.push(`${relPath}:${idx + 1}: ${line.trim()}`);
              }
            });
          } catch {}
        }
      }
    };

    searchRecursive(this.workspaceRoot);
    if (results.length === 0) {
      return `No matches found for "${query}".`;
    }
    return `Search matches for "${query}" (capped at 40):\n` + results.join('\n');
  }

  private async runTerminalCommand(command: string, timeoutMs: number = 60000): Promise<string> {
    return new Promise((resolve) => {
      const isWindows = process.platform === 'win32';
      const shell = isWindows ? 'powershell.exe' : '/bin/bash';

      // Build enhanced PATH on Windows so python scripts (pyinstaller, uvicorn, etc.) are always found
      const env = { ...process.env };
      if (isWindows) {
        const userProfile = process.env.USERPROFILE || '';
        const pythonPaths = [
          path.join(userProfile, 'AppData', 'Local', 'Python', 'pythoncore-3.14-64', 'Scripts'),
          path.join(userProfile, 'AppData', 'Local', 'Programs', 'Python', 'Python314', 'Scripts'),
          path.join(userProfile, 'AppData', 'Local', 'Programs', 'Python', 'Python313', 'Scripts'),
          path.join(userProfile, 'AppData', 'Local', 'Programs', 'Python', 'Python312', 'Scripts'),
          path.join(userProfile, 'AppData', 'Local', 'Programs', 'Python', 'Python311', 'Scripts'),
          path.join(userProfile, 'AppData', 'Roaming', 'Python', 'Python314', 'Scripts'),
          path.join(userProfile, 'AppData', 'Roaming', 'Python', 'Python313', 'Scripts'),
        ];
        const existingPath = env.PATH || '';
        const extraPaths = pythonPaths.filter((p) => fs.existsSync(p)).join(';');
        if (extraPaths) {
          env.PATH = `${extraPaths};${existingPath}`;
        }
      }

      exec(
        command,
        {
          cwd: this.workspaceRoot,
          timeout: timeoutMs,
          maxBuffer: 1024 * 1024 * 10,
          shell,
          env,
        },
        (error, stdout, stderr) => {
          let out = '';
          if (stdout) out += stdout;
          if (stderr) out += (out ? '\n[STDERR]\n' : '') + stderr;
          if (error) {
            out += `\n[Process exited with code ${error.code || 1}]`;
            // Helpful hint for Python CLI tools on Windows
            if (out.includes('is not recognized as the name of a cmdlet') && command.includes('pyinstaller')) {
              out += '\n💡 Tip: Try running with `python -m PyInstaller <args>` if the script is not in system PATH.';
            }
          }
          resolve(out.trim() || '(Command executed with no output)');
        }
      );
    });
  }

  private async getDiagnostics(filePath?: string): Promise<string> {
    const allDiagnostics = vscode.languages.getDiagnostics();
    const results: string[] = [];

    for (const [uri, diags] of allDiagnostics) {
      const relPath = path.relative(this.workspaceRoot, uri.fsPath);
      if (filePath && !uri.fsPath.endsWith(filePath)) {
        continue;
      }
      for (const diag of diags) {
        const severity =
          diag.severity === vscode.DiagnosticSeverity.Error
            ? 'ERROR'
            : diag.severity === vscode.DiagnosticSeverity.Warning
            ? 'WARN'
            : 'INFO';
        results.push(
          `[${severity}] ${relPath}:${diag.range.start.line + 1}:${diag.range.start.character + 1} - ${diag.message}`
        );
      }
    }

    if (results.length === 0) {
      return 'No diagnostic errors or warnings found.';
    }
    return 'Workspace Diagnostics:\n' + results.join('\n');
  }
}
