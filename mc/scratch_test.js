const WebSocket = require('ws');
const https = require('https');

async function testEndpoint(name, url) {
  return new Promise((resolve) => {
    console.log(`[Test] Connecting to ${name}: ${url}...`);
    const ws = new WebSocket(url, {
      rejectUnauthorized: false
    });

    const timeout = setTimeout(() => {
      console.log(`[Fail] ${name} (${url}) timed out after 5s`);
      try { ws.terminate(); } catch (e) {}
      resolve(false);
    }, 5000);

    ws.on('open', () => {
      clearTimeout(timeout);
      console.log(`[SUCCESS] Connected to ${name} (${url})!`);
      ws.close();
      resolve(true);
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      console.log(`[ERROR] ${name} (${url}):`, err.message);
      resolve(false);
    });
  });
}

async function run() {
  await testEndpoint('Direct Velocity (ws://127.0.0.1:25566)', 'ws://127.0.0.1:25566');
  await testEndpoint('Proxy Minecraft (wss://127.0.0.1:8608/)', 'wss://127.0.0.1:8608/');
  await testEndpoint('Proxy Relay (wss://127.0.0.1:8608/relay)', 'wss://127.0.0.1:8608/relay');
}

run();
