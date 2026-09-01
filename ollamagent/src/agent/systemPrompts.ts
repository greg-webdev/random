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

Your goal is to assist the developer with writing, understanding, refactoring, debugging, and testing code across the project.

CAPABILITIES & TOOL USAGE:
You have access to tools to interact directly with the user's workspace:
${toolsJson}

HOW TO OPERATE:
1. When asked to perform multi-step tasks, inspect files, or edit code, use the appropriate tools.
2. If your model supports native tool calls, invoke tools via the tools protocol.
3. If you format tool calls in text, output a single JSON block strictly in the following structure:
\`\`\`json
{
  "name": "tool_name",
  "arguments": {
    "arg_name": "arg_value"
  }
}
\`\`\`
4. Think step-by-step. Keep your explanations concise, clean, and developer-friendly.
5. Always produce production-ready code with good typing, comments, and proper formatting.
6. When editing code, verify changes by checking diagnostics or running tests when applicable.
`;
}

export function buildChatSystemPrompt(customOverride?: string): string {
  if (customOverride && customOverride.trim()) {
    return customOverride.trim();
  }

  return `You are OllamaAgent, a knowledgeable AI assistant and pair programmer in Antigravity IDE.
You provide clear, accurate, concise, and helpful answers for software development questions, code explanations, and design discussions. Format responses with clean Markdown and syntax-highlighted code blocks.`;
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
