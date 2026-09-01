const http = require('http');

async function testIntegration() {
  console.log('=== Testing Ollama Connection ===');
  
  const tagsReq = await fetch('http://127.0.0.1:11434/api/tags');
  if (!tagsReq.ok) {
    throw new Error('Failed to reach Ollama');
  }
  const tagsData = await tagsReq.json();
  console.log(`✓ Ollama reachable! Found ${tagsData.models?.length} models:`);
  tagsData.models?.slice(0, 5).forEach(m => {
    console.log(`  - ${m.name} (${m.details?.parameter_size || 'N/A'})`);
  });

  console.log('\n=== Testing Model Completion (llama3.1:latest) ===');
  const chatRes = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3.1:latest',
      messages: [
        { role: 'user', content: 'Say "Ollama Agent for Antigravity IDE is ready!" in one short sentence.' }
      ],
      stream: false,
      options: { temperature: 0.1 }
    })
  });

  if (!chatRes.ok) {
    const errorBody = await chatRes.text();
    throw new Error(`Chat error (${chatRes.status}): ${errorBody}`);
  }

  const chatData = await chatRes.json();
  console.log('✓ Model Response:', chatData.message?.content?.trim());
  console.log('\n=== All Tests Passed Successfully! ===');
}

testIntegration().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
