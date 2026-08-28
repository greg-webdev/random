const ProtoDef = require('protodef').ProtoDef;
const mcData = require('minecraft-data')('1.21.1');

console.log('Testing map_chunk serializer...');

// Let's create an exact valid chunk packet with minecraft-protocol!
const serializer = new ProtoDef();
serializer.addProtocol(mcData.protocol.play.toClient, ['toClient']);

// Let's build a clean chunk packet:
const chunkPkt = {
  x: 0,
  z: 0,
  heightmaps: {
    type: 'compound',
    name: '',
    value: {}
  },
  chunkData: Buffer.alloc(0), // let's see what happens with empty chunkData or 24 sections
  blockEntities: [],
  skyLightMask: [],
  blockLightMask: [],
  emptySkyLightMask: [],
  emptyBlockLightMask: [],
  skyLight: [],
  blockLight: []
};

try {
  const buf = mcData.protocol.play.toClient.types.packet_map_chunk;
  console.log('packet_map_chunk type found!');
} catch (e) {
  console.error('Error:', e);
}
