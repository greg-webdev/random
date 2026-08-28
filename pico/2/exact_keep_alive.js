const mc = require('minecraft-protocol');
const serializer = mc.createSerializer({ isServer: true, version: '1.21.1', state: 'play' });

const keepAliveBuf = serializer.createPacketBuffer({
  name: 'keep_alive',
  params: {
    keepAliveId: [0, 1000]
  }
});
console.log('Keep Alive packet bytes (hex):', keepAliveBuf.toString('hex'));
