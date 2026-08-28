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

// Use the dimensionCodec from 1.21.11
const codecs = mcData.loginPacket.dimensionCodec;
const bufs = [];

// Set full ambient light (1.0) on dimension_type so the world is bright and clear without fullbright mod!
if (codecs['minecraft:dimension_type']) {
  const dt = codecs['minecraft:dimension_type'];
  const overworld = dt.entries.find(e => e.key === 'minecraft:overworld');
  if (overworld && overworld.value && overworld.value.value) {
    overworld.value.value.ambient_light = { type: 'float', value: 1.0 };
  }
}

for (const key of Object.keys(codecs)) {
  const reg = JSON.parse(JSON.stringify(codecs[key]));
  
  // If this is enchantment, make entries empty so it never crashes on missing tag references!
  if (key === 'minecraft:enchantment') {
    reg.entries = [];
  }
  
  try {
    const payload = s.createPacketBuffer({
      name: 'registry_data',
      params: reg
    });
    
    // Framed packet: prepend length
    const packetLen = payload.length;
    const packetLenBuf = encodeVarint(packetLen);
    
    bufs.push(packetLenBuf);
    bufs.push(payload);
    console.log('Included registry:', key, 'entries:', reg.entries ? reg.entries.length : 0);
  } catch(e) {
    console.error('Failed to serialize', key, e.message);
  }
}

const finalBuf = Buffer.concat(bufs);
fs.writeFileSync('registries.bin', finalBuf);
console.log('Successfully wrote registries.bin for 1.21.11:', finalBuf.length, 'bytes');
