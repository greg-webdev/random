const mc = require('minecraft-protocol');
const fs = require('fs');

const client = mc.createClient({
  host: '127.0.0.1',
  port: 25566,
  username: 'geg',
  version: '1.21.4',
  auth: 'offline'
});

const payloads = [];

client.on('packet', (data, meta, buffer, fullBuffer) => {
  if (client.state === 'configuration' && meta.name === 'registry_data') {
    payloads.push(buffer.toString('hex'));
  }
  if (meta.name === 'finish_configuration') {
    console.log('Writing registry payloads...');
    fs.writeFileSync('registry_payloads.json', JSON.stringify(payloads, null, 2));
    process.exit(0);
  }
});
