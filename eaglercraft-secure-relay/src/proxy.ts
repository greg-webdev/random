import https from 'https';
import fs from 'fs';
import path from 'path';
import httpProxy from 'http-proxy';
import selfsigned from 'selfsigned';

export function startUnifiedProxy(proxyPort: number, mcTargetPort: number, relayTargetPort: number) {
  const certPath = path.resolve('cert.pem');
  const keyPath = path.resolve('key.pem');

  // Generate self-signed certificate if it doesn't exist
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    console.log('Generating self-signed SSL certificate...');
    const attrs = [{ name: 'commonName', value: 'localhost' }];
    // @ts-ignore
    const pems = selfsigned.generate(attrs, { days: 365, keySize: 2048 });
    fs.writeFileSync(keyPath, pems.private, 'utf8');
    fs.writeFileSync(certPath, pems.cert, 'utf8');
    console.log('Certificate generated successfully.');
  }

  const key = fs.readFileSync(keyPath, 'utf8');
  const cert = fs.readFileSync(certPath, 'utf8');

  // Create proxies for both services
  const mcProxy = httpProxy.createProxyServer({
    target: `ws://127.0.0.1:${mcTargetPort}`,
    ws: true,
    changeOrigin: true
  });

  const relayProxy = httpProxy.createProxyServer({
    target: `ws://127.0.0.1:${relayTargetPort}`,
    ws: true,
    changeOrigin: true
  });

  // Handle proxy errors
  mcProxy.on('error', (err, req, res) => {
    console.error('Proxy error occurred for Eaglercraft Minecraft Proxy:', err.message);
    if (res && 'writeHead' in res) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Bad Gateway');
    }
  });

  relayProxy.on('error', (err, req, res) => {
    console.error('Proxy error occurred for Eaglercraft Relay:', err.message);
    if (res && 'writeHead' in res) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Bad Gateway');
    }
  });

  // Create unified HTTPS server on the single secure port
  const server = https.createServer({ key, cert }, (req, res) => {
    const urlPath = req.url || '/';
    
    // Provide a simple landing/status page
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Eaglercraft Unified Proxy</title>
        <style>
          body { font-family: sans-serif; background: #1e1e24; color: #f4f4f9; padding: 2rem; text-align: center; }
          .container { max-width: 600px; margin: 0 auto; background: #2a2a35; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
          h1 { color: #ffa801; }
          .endpoint { background: #15151c; padding: 0.8rem; border-radius: 4px; font-family: monospace; margin: 1rem 0; word-break: break-all; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Eaglercraft Unified Proxy</h1>
          <p>This single port runs both Eaglercraft services (Relay and Minecraft Proxy) to bypass network blocks.</p>
          <div class="endpoint">Minecraft Server: wss://${req.headers.host || 'localhost'}${urlPath.startsWith('/server') ? urlPath : '/'}</div>
          <div class="endpoint">Relay Server: wss://${req.headers.host || 'localhost'}/relay</div>
        </div>
      </body>
      </html>
    `);
  });

  // Handle WS upgrade events (route to correct backend based on path)
  server.on('upgrade', (req, socket, head) => {
    const remoteAddr = req.socket.remoteAddress || '127.0.0.1';
    
    // Append standard proxy headers for Eaglercraft client IP forwarding
    req.headers['X-Real-IP'] = remoteAddr;
    req.headers['X-Forwarded-For'] = remoteAddr;

    const urlPath = req.url || '/';
    if (urlPath.startsWith('/relay')) {
      // Forward to Eaglercraft Relay backend
      relayProxy.ws(req, socket, head);
    } else {
      // Forward to Velocity Minecraft Proxy backend
      mcProxy.ws(req, socket, head);
    }
  });

  function tryListen(retries = 3) {
    server.listen(proxyPort, () => {
      console.log(`\n==================================================`);
      console.log(`UNIFIED SECURE REVERSE PROXY RUNNING ON PORT ${proxyPort}`);
      console.log(`==================================================`);
      console.log(`Eaglercraft Minecraft Proxy: wss://localhost:${proxyPort}/`);
      console.log(`Eaglercraft Relay Server:    wss://localhost:${proxyPort}/relay`);
      console.log(`==================================================\n`);
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[Proxy] Port ${proxyPort} is in use. Attempting to free it...`);
        try {
          const { execSync } = require('child_process');
          if (process.platform === 'win32') {
            const out = execSync(
              `powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort ${proxyPort} -ErrorAction SilentlyContinue).OwningProcess"`,
              { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
            ) as string;
            const pids = out.trim().split(/\r?\n/).map((p: string) => p.trim()).filter((p: string) => /^\d+$/.test(p) && p !== '0' && p !== String(process.pid));
            for (const pid of pids) {
              try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' }); } catch (_) {}
            }
          } else {
            execSync(`fuser -k ${proxyPort}/tcp 2>/dev/null || true`);
          }
        } catch (_) {}
        if (retries > 0) {
          console.log(`[Proxy] Retrying in 2 seconds... (${retries} attempts left)`);
          server.removeAllListeners('error');
          server.close();
          setTimeout(() => tryListen(retries - 1), 2000);
        } else {
          console.error(`[Proxy] Could not bind to port ${proxyPort} after multiple attempts.`);
          process.exit(1);
        }
      } else {
        throw err;
      }
    });
  }

  tryListen();
}

// If run directly
if (process.argv[1] && (process.argv[1].endsWith('proxy.ts') || process.argv[1].endsWith('proxy.js'))) {
  startUnifiedProxy(8608, 25566, 8080);
}
