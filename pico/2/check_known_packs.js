const mc = require('minecraft-protocol');
const serializer = mc.createSerializer({ isServer: true, version: '1.21.4', state: 'configuration' });

const knownPacksBuf = serializer.createPacketBuffer({
  name: 'select_known_packs',
  params: {
    packs: [
      {
        namespace: 'minecraft',
        id: 'core',
        version: '1.21.4'
      }
    ]
  }
});
console.log('select_known_packs (0x0e) bytes (hex):', knownPacksBuf.toString('hex'));

const emptyKnownPacksBuf = serializer.createPacketBuffer({
  name: 'select_known_packs',
  params: {
    packs: []
  }
});
console.log('empty select_known_packs (0x0e) bytes (hex):', emptyKnownPacksBuf.toString('hex'));
