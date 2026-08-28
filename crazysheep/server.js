const WebSocket = require('ws');

const PORT = 8080;
const wss = new WebSocket.Server({ port: PORT });

let nextPlayerId = 1; // Start at 1
const maxPlayers = 40;

const clients = new Map(); // ws -> { id, name, lastState }

wss.on('connection', (ws) => {
  console.log('New client connected');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'join') {
        const playerId = nextPlayerId++;
        clients.set(ws, { id: playerId, name: data.name, lastState: null });
        
        // Tell the new client their ID and the current players
        const currentPlayers = [];
        clients.forEach((client, clientWs) => {
          if (clientWs !== ws && client.lastState) {
            currentPlayers.push({ id: client.id, name: client.name, state: client.lastState });
          }
        });

        ws.send(JSON.stringify({ type: 'init', id: playerId, players: currentPlayers }));

        // Broadcast to others that a new player joined
        broadcast(ws, { type: 'player_join', id: playerId, name: data.name });
        console.log(`Player ${playerId} joined as ${data.name}`);
      }
      else if (data.type === 'state_update') {
        const client = clients.get(ws);
        if (client) {
          client.lastState = data.state;
          // Broadcast state to all other clients
          broadcast(ws, { type: 'state_update', id: client.id, state: data.state });
        }
      }
      else if (data.type === 'explosion') {
        const client = clients.get(ws);
        if (client) {
           broadcast(ws, { type: 'explosion', id: client.id });
        }
      }
    } catch (e) {
      console.error('Error processing message:', e);
    }
  });

  ws.on('close', () => {
    const client = clients.get(ws);
    if (client) {
      console.log(`Player ${client.id} (${client.name}) disconnected`);
      broadcast(ws, { type: 'player_leave', id: client.id });
      clients.delete(ws);
    }
  });
});

function broadcast(senderWs, messageObj) {
  const msgStr = JSON.stringify(messageObj);
  wss.clients.forEach((client) => {
    if (client !== senderWs && client.readyState === WebSocket.OPEN) {
      client.send(msgStr);
    }
  });
}

console.log(`WebSocket server running on ws://localhost:${PORT}`);
