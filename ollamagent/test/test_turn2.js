async function testTurn2() {
  const endpoint = 'http://127.0.0.1:11434';
  const model = 'llama3.1:latest';

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

  const messages = [
    { role: 'user', content: 'What is in README.md?' },
    {
      role: 'assistant',
      content: '',
      tool_calls: [
        {
          id: 'call_12345',
          type: 'function',
          function: {
            name: 'read_file',
            arguments: { path: 'README.md' }
          }
        }
      ]
    },
    {
      role: 'tool',
      content: '# Ollama Agent\nThis is a cool extension for Antigravity IDE.'
    }
  ];

  console.log('Testing turn 2 with tool response...');
  try {
    const res = await fetch(`${endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        tools,
        stream: false
      })
    });

    console.log('Status:', res.status);
    const data = await res.text();
    console.log('Response:', data);
  } catch (err) {
    console.error('Turn 2 failed:', err);
  }
}

testTurn2();
