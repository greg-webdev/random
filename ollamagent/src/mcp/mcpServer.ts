#!/usr/bin/env node
import * as readline from 'readline';
import { OllamaClient } from '../ollama/client';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

class OllamaMcpServer {
  private client: OllamaClient;

  constructor() {
    const endpoint = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
    this.client = new OllamaClient(endpoint);
  }

  public start() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    rl.on('line', async (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      try {
        const req: JsonRpcRequest = JSON.parse(trimmed);
        const res = await this.handleRequest(req);
        if (res && req.id !== undefined) {
          process.stdout.write(JSON.stringify(res) + '\n');
        }
      } catch (err: any) {
        const errRes: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: null as any,
          error: { code: -32700, message: `Parse error: ${err.message}` },
        };
        process.stdout.write(JSON.stringify(errRes) + '\n');
      }
    });

    process.stderr.write('[Ollama MCP Server] Started on stdio.\n');
  }

  private async handleRequest(req: JsonRpcRequest): Promise<JsonRpcResponse> {
    switch (req.method) {
      case 'initialize': {
        return {
          jsonrpc: '2.0',
          id: req.id,
          result: {
            protocolVersion: '2024-11-05',
            serverInfo: {
              name: 'ollama-mcp-server',
              version: '1.0.0',
            },
            capabilities: {
              tools: {},
            },
          },
        };
      }

      case 'notifications/initialized': {
        return null as any;
      }

      case 'tools/list': {
        return {
          jsonrpc: '2.0',
          id: req.id,
          result: {
            tools: [
              {
                name: 'ollama_list_models',
                description: 'List all locally installed Ollama AI models with details.',
                inputSchema: {
                  type: 'object',
                  properties: {},
                },
              },
              {
                name: 'ollama_chat',
                description: 'Send a prompt or conversation to a local Ollama model and receive the response.',
                inputSchema: {
                  type: 'object',
                  properties: {
                    model: {
                      type: 'string',
                      description: 'Name of the Ollama model (e.g. "llama3.1:latest", "qwen3.5:latest", "gemma4:latest").',
                    },
                    prompt: {
                      type: 'string',
                      description: 'The user prompt or query to send.',
                    },
                    system: {
                      type: 'string',
                      description: 'Optional system instructions for the model.',
                    },
                    temperature: {
                      type: 'number',
                      description: 'Optional sampling temperature (0.0 to 1.0).',
                    },
                  },
                  required: ['model', 'prompt'],
                },
              },
              {
                name: 'ollama_generate_code',
                description: 'Generate, optimize, or review code using a local Ollama model.',
                inputSchema: {
                  type: 'object',
                  properties: {
                    model: {
                      type: 'string',
                      description: 'Name of the code-capable Ollama model.',
                    },
                    language: {
                      type: 'string',
                      description: 'Programming language (e.g. "typescript", "python", "cpp").',
                    },
                    instruction: {
                      type: 'string',
                      description: 'What code to generate or what refactoring to perform.',
                    },
                    context_code: {
                      type: 'string',
                      description: 'Optional existing code context.',
                    },
                  },
                  required: ['model', 'language', 'instruction'],
                },
              },
            ],
          },
        };
      }

      case 'tools/call': {
        const name = req.params?.name;
        const args = req.params?.arguments || {};

        try {
          let content = '';

          if (name === 'ollama_list_models') {
            const models = await this.client.listModels();
            content = JSON.stringify(models, null, 2);
          } else if (name === 'ollama_chat') {
            const model = args.model || 'llama3.1:latest';
            const messages: any[] = [];
            if (args.system) {
              messages.push({ role: 'system', content: args.system });
            }
            messages.push({ role: 'user', content: args.prompt });

            const res = await this.client.chat({
              model,
              messages,
              options: { temperature: args.temperature ?? 0.2 },
            });
            content = res.message?.content || '(No response)';
          } else if (name === 'ollama_generate_code') {
            const model = args.model || 'llama3.1:latest';
            const prompt = `Language: ${args.language}\nInstruction: ${args.instruction}\n` +
              (args.context_code ? `\nExisting Code Context:\n\`\`\`${args.language}\n${args.context_code}\n\`\`\`\n` : '');

            const res = await this.client.chat({
              model,
              messages: [
                {
                  role: 'system',
                  content: 'You are an expert software engineer. Provide high-quality, production-ready code with explanations.',
                },
                { role: 'user', content: prompt },
              ],
            });
            content = res.message?.content || '(No response)';
          } else {
            throw new Error(`Unknown tool: ${name}`);
          }

          return {
            jsonrpc: '2.0',
            id: req.id,
            result: {
              content: [
                {
                  type: 'text',
                  text: content,
                },
              ],
            },
          };
        } catch (callErr: any) {
          return {
            jsonrpc: '2.0',
            id: req.id,
            result: {
              content: [
                {
                  type: 'text',
                  text: `Error executing Ollama MCP tool: ${callErr.message}`,
                },
              ],
              isError: true,
            },
          };
        }
      }

      default:
        return {
          jsonrpc: '2.0',
          id: req.id,
          error: { code: -32601, message: `Method not found: ${req.method}` },
        };
    }
  }
}

const server = new OllamaMcpServer();
server.start();
