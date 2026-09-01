// Diagnostic test script

async function testDiagnostics() {
  const endpoint = 'http://127.0.0.1:11434';
  const client = new (class {
    constructor() { this.baseUrl = endpoint; }
    async *streamChat(req) {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req)
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (line.trim()) yield JSON.parse(line);
        }
      }
    }
  })();

  const model = 'llama3.1:latest';
  console.log(`\n1. Testing basic streaming chat with ${model}...`);
  try {
    let text = '';
    for await (const chunk of client.streamChat({
      model,
      messages: [{ role: 'user', content: 'Say hello in 3 words' }],
      stream: true
    })) {
      text += chunk.message?.content || '';
    }
    console.log('✓ Success! Response:', text);
  } catch (err) {
    console.error('✗ Basic chat failed:', err.message);
  }

  console.log(`\n2. Testing chat with tools passed to ${model}...`);
  const tools = [
    {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read contents of a file in the workspace.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path' }
          },
          required: ['path']
        }
      }
    }
  ];

  try {
    let toolCalls = [];
    let text = '';
    for await (const chunk of client.streamChat({
      model,
      messages: [{ role: 'user', content: 'Please read the file README.md' }],
      tools,
      stream: true
    })) {
      text += chunk.message?.content || '';
      if (chunk.message?.tool_calls) {
        toolCalls.push(...chunk.message.tool_calls);
      }
    }
    console.log('✓ Response text:', text);
    console.log('✓ Tool calls detected:', JSON.stringify(toolCalls));
  } catch (err) {
    console.error('✗ Tools chat failed:', err.message);
  }
}

testDiagnostics();
