const mc = require('minecraft-protocol');

const client = mc.createClient({
  host: '192.168.51.232',
  port: 25565,
  username: 'geg',
  version: '1.21.11',
  auth: 'offline'
});

client.on('packet', (data, meta) => {
  console.log(`[PACKET in ${client.state}] ${meta.name}`);
});

client.on('state', (s) => console.log('STATE:', s));
client.on('login', (p) => console.log('🎉 PLAY LOGIN SUCCESS!'));
client.on('position', (p) => console.log('🎉 POSITION SYNC!'));
client.on('map_chunk', (p) => console.log('🎉 CHUNK LOADED!'));
client.on('error', (e) => console.error('ERR:', e));
client.on('end', (r) => console.log('END:', r));
