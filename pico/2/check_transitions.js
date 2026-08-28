const mc = require('minecraft-protocol');
const client = mc.createClient({
  host: '127.0.0.1',
  port: 25565,
  username: 'Test',
  version: '1.21.1'
});
console.log('Client login state packets:', Object.keys(client.deserializer.proto.play || {}));
