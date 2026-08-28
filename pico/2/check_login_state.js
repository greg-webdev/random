const mc = require('minecraft-protocol');
const serializer = mc.createSerializer({ isServer: true, version: '1.21.1', state: 'login' });

const successBuf = serializer.createPacketBuffer({
  name: 'success',
  params: {
    uuid: '00112233-4455-6677-8899-aabbccddeeff',
    username: 'TestPlayer',
    properties: [],
    strictErrorHandling: false
  }
});
console.log('Login success packet bytes (hex):', successBuf.toString('hex'));

const configSerializer = mc.createSerializer({ isServer: true, version: '1.21.1', state: 'configuration' });
const finishConfigBuf = configSerializer.createPacketBuffer({
  name: 'finish_configuration',
  params: {}
});
console.log('Finish configuration packet bytes (hex):', finishConfigBuf.toString('hex'));
