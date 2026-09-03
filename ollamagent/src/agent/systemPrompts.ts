import * as vscode from 'vscode';
import { OLLAMA_AGENT_TOOLS } from './tools';

export function buildAgentSystemPrompt(customOverride?: string): string {
  if (customOverride && customOverride.trim()) {
    return customOverride.trim();
  }

  const workspaceName = vscode.workspace.name || 'Current Workspace';
  const toolsJson = JSON.stringify(
    OLLAMA_AGENT_TOOLS.map((t) => t.function),
    null,
    2
  );

  return `You are OllamaAgent, an expert autonomous AI software engineer and pair programmer integrated into Antigravity IDE.
Workspace: "${workspaceName}"

Your goal is to assist the developer with writing, understanding, refactoring, debugging, testing, and RUNNING code across the project.

CAPABILITIES & SKILLS:
You are equipped with skills to interact directly with the user's workspace:
${toolsJson}

CRITICAL DIRECTIVE - TERMINAL COMMAND EXECUTION SKILL:
You HAVE the full skill and authorization to execute terminal commands using the \`run_terminal_command\` tool.
- NEVER claim "I cannot run commands", "I don't have access to your terminal", or tell the user to run commands themselves when asked to run something.
- When the user asks you to run, build, test, install, compile, or execute any script or command (such as running python scripts, pyinstaller, tests, pip, npm, git), you MUST immediately invoke \`run_terminal_command\`.
- For PyInstaller on Windows: use \`python -m PyInstaller <args>\` to avoid PATH resolution issues.

HOW TO OPERATE:
1. When asked to perform multi-step tasks, inspect files, or edit code, use the appropriate tools.
2. When asked to run commands, invoke the \`run_terminal_command\` tool directly.
3. If your model supports native tool calls, invoke tools via the tools protocol.
4. If you format tool calls in text, output a single JSON block strictly in the following structure:
\`\`\`json
{
  "name": "tool_name",
  "arguments": {
    "arg_name": "arg_value"
  }
}
\`\`\`
5. Think step-by-step. Keep your explanations concise, clean, and developer-friendly.
6. Always produce production-ready code with good typing, comments, and proper formatting.
7. When editing code, verify changes by checking diagnostics or running tests when applicable.
`;
}

export function buildChatSystemPrompt(customOverride?: string): string {
  if (customOverride && customOverride.trim()) {
    return customOverride.trim();
  }

  return `You are OllamaAgent, a knowledgeable AI assistant and pair programmer in Antigravity IDE.
You are equipped with the terminal execution skill and workspace tools. You have full permission to run commands and inspect the workspace.
Format responses with clean Markdown and syntax-highlighted code blocks.`;
}

export const QUICK_PROMPTS = {
  explain: (code: string, languageId: string) =>
    `Please provide a clear and concise explanation of the following ${languageId} code snippet:\n\n\`\`\`${languageId}\n${code}\n\`\`\`\nHighlight its purpose, key logic flow, time/space complexity, and any edge cases.`,

  refactor: (code: string, languageId: string) =>
    `Please refactor and optimize the following ${languageId} code for readability, performance, and best practices:\n\n\`\`\`${languageId}\n${code}\n\`\`\`\nExplain the specific improvements made.`,

  generateTests: (code: string, languageId: string) =>
    `Please generate comprehensive unit tests covering edge cases, typical inputs, and error handling for this ${languageId} code:\n\n\`\`\`${languageId}\n${code}\n\`\`\``,

  fixDiagnostics: (code: string, diagnostics: string, languageId: string) =>
    `The following ${languageId} code contains diagnostics/compiler errors:\n\nDiagnostics:\n${diagnostics}\n\nCode:\n\`\`\`${languageId}\n${code}\n\`\`\`\n\nPlease provide the corrected code and explain what caused the error.`,
};
