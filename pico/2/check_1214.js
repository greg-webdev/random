const mcData = require('minecraft-data')('1.21.4');
if (mcData) {
  console.log('1.21.4 protocol found!');
  const serializer = require('minecraft-protocol').createSerializer({ isServer: true, version: '1.21.4', state: 'play' });
  console.log('Testing 1.21.4 packets:');
  console.log('Play packets:', Object.keys(mcData.protocol.play.toClient.types).filter(k => k.includes('packet_login') || k.includes('packet_position') || k.includes('packet_map_chunk')));
} else {
  console.log('No 1.21.4 data, checking latest version...');
}
