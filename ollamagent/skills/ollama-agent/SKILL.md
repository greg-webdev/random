---
name: ollama-agent
description: Run local AI agents and chat with local LLMs (Llama 3.1, Qwen 3.5, Gemma 4, GPT-OSS) via Ollama in Antigravity IDE. Use when the user requests offline/local model inference, private code reviews, or local subagent tasks.
---

# Ollama Agent Skill for Antigravity IDE

This skill enables Antigravity IDE and agents to delegate tasks, execute tool calls, and generate code using local Ollama models.

## Available MCP Tools

When the Ollama MCP server is running, the following tools are available:

1. **`ollama_list_models`**: Lists all local models pulled on the host machine.
2. **`ollama_chat`**: Sends prompt with optional system instructions to a specified Ollama model.
3. **`ollama_generate_code`**: Generates or refactors code with language-specific guidance.

## Using Ollama in Antigravity IDE

- **Sidebar Webview**: Click the 🦙 Ollama Agent icon on the Activity Bar to open the interactive panel.
- **Autonomous Agent**: Toggle "Agent Mode" on to allow the local model to read files, search the workspace, edit code, and run terminal commands.
- **Model Switching**: Click the status bar item `$(sparkle) <model>` in the bottom-right corner to switch models anytime.
