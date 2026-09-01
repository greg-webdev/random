import { OllamaClient } from '../ollama/client';
import { OllamaMessage, OllamaToolCall } from '../ollama/types';
import { WorkspaceTools, OLLAMA_AGENT_TOOLS, ToolExecutionResult } from './tools';
import { buildAgentSystemPrompt, buildChatSystemPrompt } from './systemPrompts';

export interface AgentCallbacks {
  onTurnStart?: (turn: number) => void;
  onThinking?: (thought: string) => void;
  onToken?: (token: string) => void;
  onToolStart?: (toolCall: OllamaToolCall) => void;
  onToolResult?: (result: ToolExecutionResult) => void;
  onComplete?: (finalResponse: string) => void;
  onError?: (error: Error) => void;
}

export interface AgentRunOptions {
  model: string;
  temperature?: number;
  numCtx?: number;
  numPredict?: number;
  autonomousMode?: boolean;
  systemPromptOverride?: string;
  maxTurns?: number;
}

/**
 * Robust stream parser for models outputting <think>...</think> reasoning tags
 * (e.g. DeepSeek R1, Qwen 3.5, Gemma 4).
 * Prevents partial tag splits from truncating or muting responses.
 */
class ThinkingTagStreamer {
  private inThink: boolean = false;
  private buffer: string = '';

  constructor(
    private onThinking: (text: string) => void,
    private onToken: (text: string) => void
  ) {}

  public process(token: string) {
    this.buffer += token;

    while (this.buffer.length > 0) {
      if (!this.inThink) {
        const startIdx = this.buffer.indexOf('<think>');
        if (startIdx === -1) {
          // Check if buffer ends with partial "<think" prefix
          const partialMatch = this.buffer.match(/<t?(h?(i?(n?k?)?)?)?$/);
          if (partialMatch && partialMatch.index !== undefined && partialMatch.index < this.buffer.length) {
            const emitText = this.buffer.substring(0, partialMatch.index);
            if (emitText) this.onToken(emitText);
            this.buffer = this.buffer.substring(partialMatch.index);
            break;
          } else {
            this.onToken(this.buffer);
            this.buffer = '';
            break;
          }
        } else {
          const before = this.buffer.substring(0, startIdx);
          if (before) this.onToken(before);
          this.inThink = true;
          this.buffer = this.buffer.substring(startIdx + 7);
        }
      } else {
        const endIdx = this.buffer.indexOf('</think>');
        if (endIdx === -1) {
          // Check if buffer ends with partial "</think" prefix
          const partialMatch = this.buffer.match(/<\/?t?(h?(i?(n?k?)?)?)?$/);
          if (partialMatch && partialMatch.index !== undefined && partialMatch.index < this.buffer.length) {
            const emitText = this.buffer.substring(0, partialMatch.index);
            if (emitText) this.onThinking(emitText);
            this.buffer = this.buffer.substring(partialMatch.index);
            break;
          } else {
            this.onThinking(this.buffer);
            this.buffer = '';
            break;
          }
        } else {
          const thinkText = this.buffer.substring(0, endIdx);
          if (thinkText) this.onThinking(thinkText);
          this.inThink = false;
          this.buffer = this.buffer.substring(endIdx + 8);
        }
      }
    }
  }

  public flush() {
    if (this.buffer) {
      if (this.inThink) {
        this.onThinking(this.buffer);
      } else {
        this.onToken(this.buffer);
      }
      this.buffer = '';
    }
  }
}

export class AgentLoop {
  private client: OllamaClient;
  private tools: WorkspaceTools;

  constructor(client: OllamaClient) {
    this.client = client;
    this.tools = new WorkspaceTools();
  }

  /**
   * Run agentic loop on a conversation history
   */
  public async run(
    history: OllamaMessage[],
    userMessage: string,
    options: AgentRunOptions,
    callbacks: AgentCallbacks,
    signal?: AbortSignal
  ): Promise<OllamaMessage[]> {
    const isAutonomous = options.autonomousMode ?? true;
    const maxTurns = options.maxTurns || 15;

    const systemPrompt = isAutonomous
      ? buildAgentSystemPrompt(options.systemPromptOverride)
      : buildChatSystemPrompt(options.systemPromptOverride);

    // Prepare active conversation messages
    const messages: OllamaMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ];

    let currentTurn = 0;
    let keepRunning = true;
    let fallbackToTextTools = false;

    while (keepRunning && currentTurn < maxTurns) {
      if (signal?.aborted) {
        throw new Error('Agent execution cancelled by user.');
      }

      currentTurn++;
      callbacks.onTurnStart?.(currentTurn);

      let assistantContent = '';
      let detectedToolCalls: OllamaToolCall[] = [];
      let lastDoneReason: string | undefined;

      const streamer = new ThinkingTagStreamer(
        (thought) => callbacks.onThinking?.(thought),
        (token) => callbacks.onToken?.(token)
      );

      try {
        const stream = this.client.streamChat(
          {
            model: options.model,
            messages,
            tools: isAutonomous && !fallbackToTextTools ? OLLAMA_AGENT_TOOLS : undefined,
            options: {
              temperature: options.temperature ?? 0.2,
              num_ctx: options.numCtx ?? 16384,
              num_predict: options.numPredict ?? -1, // -1 ensures generation is not prematurely truncated
            },
            keep_alive: '60m',
          },
          signal
        );

        for await (const chunk of stream) {
          if (signal?.aborted) {
            throw new Error('Agent execution cancelled by user.');
          }

          if (chunk.done_reason) {
            lastDoneReason = chunk.done_reason;
          }

          // Handle model native thinking field (Ollama v0.5+)
          if (chunk.message?.thinking) {
            callbacks.onThinking?.(chunk.message.thinking);
          }

          const token = chunk.message?.content || '';
          if (token) {
            assistantContent += token;
            streamer.process(token);
          }

          // Handle native tool calls from Ollama
          if (chunk.message?.tool_calls && chunk.message.tool_calls.length > 0) {
            detectedToolCalls.push(...chunk.message.tool_calls);
          }
        }

        streamer.flush();

        // Generation completed for this turn
        // If generation reached max tokens/length, do not inject spam notices into the message history.

        // If no native tool calls were reported, check if model output formatted tool call as JSON
        if (isAutonomous && detectedToolCalls.length === 0) {
          const fallbackToolCall = this.parseFallbackToolCall(assistantContent);
          if (fallbackToolCall) {
            detectedToolCalls.push(fallbackToolCall);
          }
        }

        // Record assistant turn in messages
        const assistantMsg: OllamaMessage = {
          role: 'assistant',
          content: assistantContent,
          tool_calls: detectedToolCalls.length > 0 ? detectedToolCalls : undefined,
        };
        messages.push(assistantMsg);

        // If there are tool calls, execute them and continue loop
        if (isAutonomous && detectedToolCalls.length > 0) {
          for (const toolCall of detectedToolCalls) {
            if (signal?.aborted) break;

            const toolName = toolCall.function.name;
            let toolArgs: Record<string, any> = {};

            if (typeof toolCall.function.arguments === 'string') {
              try {
                toolArgs = JSON.parse(toolCall.function.arguments);
              } catch {
                toolArgs = {};
              }
            } else {
              toolArgs = toolCall.function.arguments || {};
            }

            callbacks.onToolStart?.(toolCall);
            const result = await this.tools.executeTool(toolName, toolArgs);
            callbacks.onToolResult?.(result);

            // Append tool response
            messages.push({
              role: 'tool',
              content: `[Tool Execution Result for ${toolName}]\n${result.output}`,
            });
          }
        } else {
          // No more tool calls, agent has completed task
          keepRunning = false;
          callbacks.onComplete?.(assistantContent);
        }
      } catch (err: any) {
        if (err.name === 'AbortError' || signal?.aborted) {
          throw new Error('Agent execution cancelled.');
        }

        // If native tool call failed due to unsupported model format, retry with text-based tools
        if (isAutonomous && !fallbackToTextTools && err.message?.includes('500')) {
          console.warn('[AgentLoop] Native tools unsupported by model, falling back to text schema.');
          fallbackToTextTools = true;
          currentTurn--;
          continue;
        }

        callbacks.onError?.(err);
        throw err;
      }
    }

    if (currentTurn >= maxTurns && keepRunning) {
      callbacks.onToken?.('\n\n*(Reached maximum autonomous step limit)*');
      callbacks.onComplete?.(messages[messages.length - 1]?.content || '');
    }

    // Return conversation history excluding initial system prompt
    return messages.filter((m) => m.role !== 'system');
  }

  /**
   * Fallback parser for models outputting JSON tool calls in text
   */
  private parseFallbackToolCall(text: string): OllamaToolCall | null {
    try {
      const jsonBlockRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/;
      const match = text.match(jsonBlockRegex);
      const jsonStr = match ? match[1] : (text.trim().startsWith('{') && text.trim().endsWith('}') ? text.trim() : null);

      if (!jsonStr) return null;

      const parsed = JSON.parse(jsonStr);
      if (parsed.name && (parsed.arguments || parsed.parameters)) {
        return {
          type: 'function',
          function: {
            name: parsed.name,
            arguments: parsed.arguments || parsed.parameters || {},
          },
        };
      }
    } catch {
      // Not a valid tool call JSON
    }
    return null;
  }
}
