const mc = require('minecraft-protocol');
const serializer = mc.createSerializer({ isServer: true, version: '1.21.4', state: 'play' });
const deserializer = mc.createDeserializer({ isServer: false, version: '1.21.4', state: 'play' });

const p_login = serializer.createPacketBuffer({
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

const p_pos = serializer.createPacketBuffer({
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

const p_game_state = serializer.createPacketBuffer({
  name: 'game_state_change',
  params: {
    reason: 13, // Start waiting for level chunks
    gameMode: 0.0
  }
});

const p_batch_start = serializer.createPacketBuffer({
  name: 'chunk_batch_start',
  params: {}
});

const p_chunk = serializer.createPacketBuffer({
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

const p_batch_end = serializer.createPacketBuffer({
  name: 'chunk_batch_finished',
  params: {
    batchSize: 1
  }
});

console.log('Game State Change (0x23) bytes (hex):', p_game_state.toString('hex'));
console.log('Chunk Batch Start (0x0d) bytes (hex):', p_batch_start.toString('hex'));
console.log('Chunk Batch Finished (0x0c) bytes (hex):', p_batch_end.toString('hex'));

deserializer.on('data', (d) => {
  console.log('CLIENT RECEIVED:', d.data.name);
});
deserializer.on('error', (e) => {
  console.error('ERROR:', e);
});

deserializer.write(p_login);
deserializer.write(p_pos);
deserializer.write(p_game_state);
deserializer.write(p_batch_start);
deserializer.write(p_chunk);
deserializer.write(p_batch_end);
