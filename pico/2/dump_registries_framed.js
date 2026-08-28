const mc = require('minecraft-protocol');
const fs = require('fs');
function encodeVarint(val) {
  const buf = [];
  while (true) {
    if ((val & ~0x7f) === 0) {
      buf.push(val);
      break;
    }
    buf.push((val & 0x7f) | 0x80);
    val >>>= 7;
  }
  return Buffer.from(buf);
}const client = mc.createClient({
  host: '127.0.0.1',
  port: 25566,
  username: 'geg',
  version: '1.21.4',
  auth: 'offline'
});

const bufs = [];

client.on('packet', (data, meta, buffer, fullBuffer) => {
  if (client.state === 'configuration' && meta.name === 'registry_data') {
    // buffer is the payload.
    // Packet ID for registry_data in config is 0x07
    const packetId = 0x07;
    const packetIdBuf = encodeVarint(packetId);
    const packetLen = packetIdBuf.length + buffer.length;
    const packetLenBuf = encodeVarint(packetLen);
    
    bufs.push(packetLenBuf);
    bufs.push(packetIdBuf);
    bufs.push(buffer);
  }
  if (meta.name === 'finish_configuration') {
    fs.writeFileSync('registries_framed.bin', Buffer.concat(bufs));
    console.log('Wrote registries_framed.bin', Buffer.concat(bufs).length);
    process.exit(0);
  }
});
