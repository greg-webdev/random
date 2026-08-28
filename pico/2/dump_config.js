const mc = require('minecraft-protocol');
const client = mc.createClient({
  host: '127.0.0.1',
  port: 25566,
  username: 'geg',
  version: '1.21.4',
  auth: 'offline'
});
client.on('packet', (data, meta) => {
  if (client.state === 'configuration') {
    if (meta.name === 'registry_data') {
      console.log('Registry Data:', data.id);
    } else {
      console.log('Config Packet:', meta.name);
    }
  }
});
