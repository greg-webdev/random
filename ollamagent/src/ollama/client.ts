import {
  OllamaChatRequest,
  OllamaChatChunk,
  OllamaGenerateRequest,
  OllamaGenerateChunk,
  OllamaModel,
  OllamaTagsResponse,
} from './types';

export class OllamaClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://127.0.0.1:11434') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  public setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Check connection to Ollama server
   */
  public async ping(signal?: AbortSignal): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/version`, { signal });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * List installed models
   */
  public async listModels(signal?: AbortSignal): Promise<OllamaModel[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal });
      if (!res.ok) {
        throw new Error(`Failed to list models: ${res.statusText}`);
      }
      const data = (await res.json()) as OllamaTagsResponse;
      return data.models || [];
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw err;
      }
      throw new Error(`Cannot connect to Ollama at ${this.baseUrl}: ${err.message}`);
    }
  }

  /**
   * List currently loaded/running models in VRAM
   */
  public async getRunningModels(signal?: AbortSignal): Promise<OllamaModel[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/ps`, { signal });
      if (!res.ok) return [];
      const data = (await res.json()) as OllamaTagsResponse;
      return data.models || [];
    } catch {
      return [];
    }
  }

  /**
   * Stream chat completion
   */
  public async *streamChat(
    request: OllamaChatRequest,
    signal?: AbortSignal
  ): AsyncGenerator<OllamaChatChunk, void, unknown> {
    const payload = {
      keep_alive: '60m',
      ...request,
      options: {
        num_predict: -1, // Remove token limit (unlimited generation until EOS)
        num_ctx: 32768,   // 32k context window (no truncation)
        ...(request.options || {}),
      },
      stream: true,
    };

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Ollama Chat Error (${res.status}): ${errorText || res.statusText}`);
    }

    if (!res.body) {
      throw new Error('Response body is null');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const chunk: OllamaChatChunk = JSON.parse(trimmed);
            yield chunk;
          } catch (parseErr) {
            console.error('Failed to parse Ollama chunk JSON:', trimmed, parseErr);
          }
        }
      }

      if (buffer.trim()) {
        const lines = buffer.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const chunk: OllamaChatChunk = JSON.parse(trimmed);
            yield chunk;
          } catch {
            // ignore trailing partial json
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Non-streaming chat completion
   */
  public async chat(
    request: OllamaChatRequest,
    signal?: AbortSignal
  ): Promise<OllamaChatChunk> {
    const payload = {
      keep_alive: '60m',
      ...request,
      options: {
        num_predict: -1, // Remove token limit (unlimited generation until EOS)
        num_ctx: 32768,   // 32k context window (no truncation)
        ...(request.options || {}),
      },
      stream: false,
    };

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Ollama Chat Error (${res.status}): ${errorText || res.statusText}`);
    }

    return (await res.json()) as OllamaChatChunk;
  }

  /**
   * Stream raw generation
   */
  public async *streamGenerate(
    request: OllamaGenerateRequest,
    signal?: AbortSignal
  ): AsyncGenerator<OllamaGenerateChunk, void, unknown> {
    const payload = {
      keep_alive: '60m',
      ...request,
      options: {
        num_predict: -1, // Remove token limit (unlimited generation until EOS)
        num_ctx: 32768,   // 32k context window (no truncation)
        ...(request.options || {}),
      },
      stream: true,
    };

    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Ollama Generate Error (${res.status}): ${errorText || res.statusText}`);
    }

    if (!res.body) {
      throw new Error('Response body is null');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const chunk: OllamaGenerateChunk = JSON.parse(trimmed);
            yield chunk;
          } catch (parseErr) {
            console.error('Failed to parse Ollama generate chunk:', trimmed, parseErr);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
