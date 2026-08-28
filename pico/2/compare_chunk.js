const fs = require('fs');

// Generate Node.js serializer chunk packet:
const mc = require('minecraft-protocol');
const serializer = mc.createSerializer({ isServer: true, version: '1.21.4', state: 'play' });

function send_varint(val) {
  let buf = [];
  while (true) {
    if ((val & ~0x7F) === 0) {
      buf.push(val);
      break;
    } else {
      buf.push((val & 0x7F) | 0x80);
      val >>>= 7;
    }
  }
  return Buffer.from(buf);
}

let chunk_sections = [];
for (let s = 0; s < 24; s++) {
  if (s === 4) {
    chunk_sections.push(Buffer.from([0x01, 0x00])); // non-air 256
    chunk_sections.push(Buffer.from([0x00])); // BPE 0
    chunk_sections.push(send_varint(9)); // grass
    chunk_sections.push(send_varint(0)); // data len 0
  } else {
    chunk_sections.push(Buffer.from([0x00, 0x00])); // non-air 0
    chunk_sections.push(Buffer.from([0x00])); // BPE 0
    chunk_sections.push(send_varint(0)); // air
    chunk_sections.push(send_varint(0)); // data len 0
  }
  // biomes
  chunk_sections.push(Buffer.from([0x00])); // BPE 0
  chunk_sections.push(send_varint(1)); // plains
  chunk_sections.push(send_varint(0)); // data len 0
}
const chunk_data_bytes = Buffer.concat(chunk_sections);

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
    chunkData: chunk_data_bytes,
    blockEntities: [],
    skyLightMask: [],
    blockLightMask: [],
    emptySkyLightMask: [],
    emptyBlockLightMask: [],
    skyLight: [],
    blockLight: []
  }
});

console.log('NodeJS chunk packet hex:');
console.log(p3.toString('hex'));
