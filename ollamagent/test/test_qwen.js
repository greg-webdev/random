async function testQwen() {
  const endpoint = 'http://127.0.0.1:11434';
  const model = 'qwen3.5:4b';

  console.log(`Testing streaming with ${model}...`);
  try {
    const res = await fetch(`${endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'What is 2+2? Answer in 1 word.' }],
        stream: true
      })
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let tokens = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (line.trim()) {
          const parsed = JSON.parse(line);
          tokens.push(parsed);
        }
      }
    }

    console.log(`Received ${tokens.length} chunks.`);
    const sample = tokens.slice(0, 5);
    console.log('Sample chunk:', JSON.stringify(sample[0]));
    const fullContent = tokens.map(t => t.message?.content || '').join('');
    console.log('Full content:', fullContent);
    const thinking = tokens.map(t => t.message?.thinking || '').join('');
    if (thinking) console.log('Thinking field:', thinking);
  } catch (err) {
    console.error('Qwen test failed:', err);
  }
}

testQwen();
