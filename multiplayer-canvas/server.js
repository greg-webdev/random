// server.js
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// --- Setup HTTP Server ---
const server = http.createServer((req, res) => {
    // Simple handler for serving static files (like index.html and client.js)
    let filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
    const extname = path.extname(filePath);
    let contentType = 'text/html';

    switch (extname) {
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
        case '.html':
            contentType = 'text/html';
            break;
        default:
            contentType = 'application/octet-stream';
    }

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Server Error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// --- Setup WebSocket Server ---
const wss = new WebSocket.Server({ server });

console.log("WebSocket Server started.");

// Store connected clients
const clients = new Set();

wss.on('connection', (ws, req) => {
    console.log('Client connected.');
    clients.add(ws);

    // Send initial welcome message or state if needed
    ws.send(JSON.stringify({ type: 'system', message: 'Welcome to the Multiplayer Canvas!' }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            // Broadcast the received data to all other clients
            if (data.type && data.type !== 'system') {
                console.log(`Broadcasting ${data.type} event.`);
                clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(data));
                    }
                });
            }
        } catch (e) {
            console.error('Error parsing message:', e);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected.');
        clients.delete(ws);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// --- Start Server ---
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});