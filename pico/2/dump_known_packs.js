const mc = require('minecraft-protocol');
const client = mc.createClient({
  host: '127.0.0.1',
  port: 25566,
  username: 'geg',
  version: '1.21.4',
  auth: 'offline'
});
client.on('packet', (data, meta) => {
  if (client.state === 'configuration' && meta.name === 'select_known_packs') {
    console.log('Known Packs from server:', JSON.stringify(data, null, 2));
    process.exit(0);
  }
});
