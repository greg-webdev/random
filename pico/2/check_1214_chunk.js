const mc = require('minecraft-protocol');
const serializer = mc.createSerializer({ isServer: true, version: '1.21.4', state: 'play' });

const chunkBuf = serializer.createPacketBuffer({
  name: 'map_chunk',
  params: {
    x: 0,
    z: 0,
    heightmaps: {
      type: 'compound',
      name: '',
      value: {}
    },
    chunkData: Buffer.alloc(0),
    blockEntities: [],
    skyLightMask: [],
    blockLightMask: [],
    emptySkyLightMask: [],
    emptyBlockLightMask: [],
    skyLight: [],
    blockLight: []
  }
});
console.log('1.21.4 Chunk packet bytes (hex):', chunkBuf.toString('hex'));

const keepAliveBuf = serializer.createPacketBuffer({
  name: 'keep_alive',
  params: {
    keepAliveId: [0, 1000]
  }
});
console.log('1.21.4 Keep Alive packet bytes (hex):', keepAliveBuf.toString('hex'));
