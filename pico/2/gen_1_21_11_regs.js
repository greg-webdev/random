const mc = require('minecraft-protocol');
const mcData = require('minecraft-data')('1.21.11');
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

const s = mc.createSerializer({isServer: true, version: '1.21.4', state: 'configuration'});

// Use the dimensionCodec from 1.21.11!
const codecs = mcData.loginPacket.dimensionCodec;
const bufs = [];

for (const key of Object.keys(codecs)) {
  try {
    const payload = s.createPacketBuffer({
      name: 'registry_data',
      params: codecs[key]
    });
    
    // Framed packet: payload ALREADY contains the packet ID.
    // So we just need to prepend the length of the payload!
    const packetLen = payload.length;
    const packetLenBuf = encodeVarint(packetLen);
    
    bufs.push(packetLenBuf);
    bufs.push(payload);
  } catch(e) {
    console.error('Failed to serialize', key, e.message);
  }
}

const finalBuf = Buffer.concat(bufs);
fs.writeFileSync('registries_1_21_11.bin', finalBuf);
console.log('Successfully wrote registries_1_21_11.bin:', finalBuf.length, 'bytes');
