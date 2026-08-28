const mc = require('minecraft-protocol');
const serializer = mc.createSerializer({ isServer: true, version: '1.21.4', state: 'configuration' });

const knownPacksBuf = serializer.createPacketBuffer({
  name: 'select_known_packs',
  params: {
    packs: [
      { namespace: 'minecraft', id: 'core', version: '1.21.11' },
      { namespace: 'minecraft', id: 'core', version: '1.21.4' },
      { namespace: 'minecraft', id: 'core', version: '1.21.1' },
      { namespace: 'minecraft', id: 'core', version: '1.21' }
    ]
  }
});
console.log('Multi-version select_known_packs hex:', knownPacksBuf.toString('hex'));
