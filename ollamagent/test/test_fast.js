async function testFast() {
  const endpoint = 'http://127.0.0.1:11434';
  const res = await fetch(`${endpoint}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen3.5:4b',
      messages: [{ role: 'user', content: 'What is 2+2?' }],
      stream: false
    })
  });
  const data = await res.json();
  console.log('Result:', JSON.stringify(data));
}
testFast();
