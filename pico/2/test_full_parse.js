const mc = require('minecraft-protocol');
const serializer = mc.createSerializer({ isServer: true, version: '1.21.4', state: 'play' });
const deserializer = mc.createDeserializer({ isServer: false, version: '1.21.4', state: 'play' });

// Let's create packets with the serializer and parse with deserializer:
const p1 = serializer.createPacketBuffer({
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
      portalCooldown: 0,
      seaLevel: 63
    },
    enforcesSecureChat: false
  }
});

const p2 = serializer.createPacketBuffer({
  name: 'position',
  params: {
    teleportId: 1,
    x: 8.0,
    y: 16.0,
    z: 8.0,
    dx: 0.0,
    dy: 0.0,
    dz: 0.0,
    yaw: 0.0,
    pitch: 0.0,
    flags: 0
  }
});

const p3 = serializer.createPacketBuffer({
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

console.log('Login pkt (no framing):', p1.toString('hex'));
console.log('Position pkt (no framing):', p2.toString('hex'));
console.log('Chunk pkt (no framing):', p3.toString('hex'));

deserializer.on('data', (d) => {
  console.log('SUCCESSFULLY DECODED:', d.data.name);
});
deserializer.on('error', (e) => {
  console.error('ERROR:', e);
});

deserializer.write(p1);
deserializer.write(p2);
deserializer.write(p3);
