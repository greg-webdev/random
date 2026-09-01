# Ollama Agent for Antigravity IDE 🦙✨

**Ollama Agent** is an extension and plugin for **Antigravity IDE** that integrates local, private Large Language Models (LLMs) via Ollama as an autonomous AI software engineer and interactive coding assistant.

---

## 🚀 Key Features

- **Autonomous Agent Loop**: Capable of reading files, searching across the workspace, writing/editing code, running terminal commands (e.g. tests, linters), and retrieving language diagnostics.
- **Native Ollama & Streaming**: Zero-latency local streaming with automatic support for thinking tokens (`<think>`), tool calls, and model capabilities.
- **Modern Sidebar UI**: Premium dark-mode glassmorphic interface matching Antigravity IDE with collapsible thinking processes, expandable tool execution traces, and instant code actions (**Copy**, **Insert at Cursor**, **Apply to File**).
- **Status Bar Model Switcher**: Real-time status indicator (`$(sparkle) <model>`) showing connection state and allowing 1-click model switching via Quick Pick.
- **Inline Code Actions & Lightbulbs**:
  - `Fix Diagnostic Errors`
  - `Refactor Code`
  - `Explain Selection`
  - `Generate Unit Tests`
- **Antigravity Customization Plugin & MCP Server**: Exposes Model Context Protocol (MCP) tools (`ollama_chat`, `ollama_generate_code`, `ollama_list_models`) for Antigravity workflows and skills.

---

## 📦 Directory Structure

```
ollamagent/
├── package.json               # Extension manifest, contributes views, commands & settings
├── tsconfig.json              # TypeScript compilation configuration
├── esbuild.js                 # High-speed bundler configuration
├── plugin.json                # Antigravity plugin manifest
├── mcp_config.json            # Antigravity MCP server configuration
├── resources/
│   └── icon.svg               # Extension & Activity Bar icon
├── src/
│   ├── extension.ts           # Extension entrypoint, commands & status bar
│   ├── ollama/
│   │   ├── client.ts          # Ollama API client (streaming, models, chat)
│   │   └── types.ts           # TypeScript interfaces
│   ├── agent/
│   │   ├── agentLoop.ts       # Multi-step autonomous agent loop
│   │   ├── tools.ts           # Workspace tools (file I/O, search, terminal, diagnostics)
│   │   └── systemPrompts.ts   # System prompts and quick action templates
│   ├── providers/
│   │   ├── chatViewProvider.ts # Sidebar Webview provider
│   │   └── codeActionProvider.ts # Editor code actions & lightbulbs
│   ├── mcp/
│   │   └── mcpServer.ts       # Model Context Protocol stdio server
│   └── webview/
│       ├── index.html         # Modern webview UI template
│       ├── main.css           # Glassmorphism & dark-mode styling
│       └── main.js            # Client-side chat application & markdown engine
└── skills/
    └── ollama-agent/
        └── SKILL.md           # Antigravity IDE skill definition
```

---

## 🛠️ Getting Started

### 1. Prerequisites
Ensure [Ollama](https://ollama.com) is installed and running locally:
```bash
ollama serve
```

Pull your desired models (e.g. `llama3.1`, `qwen3.5`, `qwen3-coder`, or `gemma4`):
```bash
ollama pull llama3.1
ollama pull qwen3.5
```

### 2. Building the Extension
From the `/ollamagent` directory:
```bash
npm install
npm run build
```

The compiled extension bundle will be output to `dist/extension.js` and `dist/mcpServer.js`.

---

## ⚙️ Configuration Settings

| Setting | Default | Description |
| :--- | :--- | :--- |
| `ollamagent.endpoint` | `http://127.0.0.1:11434` | Ollama server API endpoint |
| `ollamagent.model` | `llama3.1:latest` | Default model for chat and agent runs |
| `ollamagent.temperature` | `0.2` | Sampling temperature |
| `ollamagent.autonomousMode` | `true` | Enable autonomous multi-step tool execution |
| `ollamagent.contextWindow` | `8192` | Context window size (`num_ctx`) |
| `ollamagent.systemPrompt` | `""` | Custom system prompt override |

---

## 🤖 Using with Antigravity IDE

### As a Sidebar Extension:
1. Open the **Ollama Agent** icon in the Activity Bar.
2. Select your desired local model from the dropdown or the status bar.
3. Chat, attach context, or trigger quick prompt actions.

### As an MCP Tool in Antigravity:
The extension includes `mcp_config.json`. Antigravity can automatically discover the `ollama-agent` MCP server and invoke `ollama_chat` and `ollama_generate_code` natively.
