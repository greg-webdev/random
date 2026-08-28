const mc = require('minecraft-protocol');
const serializer = mc.createSerializer({ isServer: true, version: '1.21.4', state: 'play' });

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
      portalCooldown: 0,
      seaLevel: 63
    },
    enforcesSecureChat: false
  }
});
console.log('1.21.4 Login packet bytes (hex):', loginBuf.toString('hex'));

const posBuf = serializer.createPacketBuffer({
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
console.log('1.21.4 Position packet bytes (hex):', posBuf.toString('hex'));
