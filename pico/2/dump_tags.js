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
}

const client = mc.createClient({
  host: '127.0.0.1',
  port: 25566,
  username: 'geg',
  version: '1.21.4',
  auth: 'offline'
});

const bufs = [];

client.on('packet', (data, meta, buffer, fullBuffer) => {
  console.log('Got packet:', meta.name);
  if (meta.name === 'tags' || meta.name === 'update_tags') {
    // Packet ID for update_tags in config is 0x0D
    const packetId = 0x0D;
    const packetIdBuf = encodeVarint(packetId);
    const packetLen = packetIdBuf.length + buffer.length;
    const packetLenBuf = encodeVarint(packetLen);
    
    bufs.push(packetLenBuf);
    bufs.push(packetIdBuf);
    bufs.push(buffer);
  }
  if (meta.name === 'finish_configuration') {
    fs.writeFileSync('tags_payload.bin', Buffer.concat(bufs));
    console.log('Wrote tags_payload.bin', Buffer.concat(bufs).length);
    process.exit(0);
  }
});
