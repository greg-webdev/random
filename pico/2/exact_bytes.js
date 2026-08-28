const mc = require('minecraft-protocol');
const serializer = mc.createSerializer({ isServer: true, version: '1.21.1', state: 'play' });

console.log('Testing Play Login serialization:');
const loginBuf = serializer.createPacketBuffer({
  name: 'login',
  params: {
    entityId: 1,
    isHardcore: false,
    worldNames: ['minecraft:overworld'],
    maxPlayers: 5,
    viewDistance: 2,
    simulationDistance: 2,
    reducedDebugInfo: false,
    enableRespawnScreen: true,
    doLimitedCrafting: false,
    worldState: {
      dimension: 0,
      name: 'minecraft:overworld',
      hashedSeed: [0, 12345],
      gamemode: 1,
      previousGamemode: 255,
      isDebug: false,
      isFlat: true,
      death: undefined,
      portalCooldown: 0
    },
    enforcesSecureChat: false
  }
});
console.log('Login packet bytes (hex):', loginBuf.toString('hex'));

console.log('Testing Position serialization:');
const posBuf = serializer.createPacketBuffer({
  name: 'position',
  params: {
    x: 8.0,
    y: 16.0,
    z: 8.0,
    yaw: 0.0,
    pitch: 0.0,
    flags: 0,
    teleportId: 1
  }
});
console.log('Position packet bytes (hex):', posBuf.toString('hex'));

console.log('Testing map_chunk serialization:');
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
console.log('Chunk packet bytes (hex):', chunkBuf.toString('hex'));
