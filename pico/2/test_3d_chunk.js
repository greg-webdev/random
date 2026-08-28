const mc = require('minecraft-protocol');
const fs = require('fs');
const des = mc.createDeserializer({isServer: false, version: '1.21.11', state: 'play'});
const { execSync } = require('child_process');

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

const pyScript = `
import math, struct, sys
def gen():
    chunk_sections = bytearray()
    heights = [64]*256
    for z in range(16):
        for x in range(16):
            heights[z*16 + x] = 64 + int(math.sin(x*0.5)*4)
    for s_idx in range(24):
        sec_y_start = s_idx * 16 - 64
        sec_y_end = sec_y_start + 15
        min_h = min(heights)
        max_h = max(heights)
        if max_h < sec_y_start:
            chunk_sections.extend(struct.pack('>h', 0))
            chunk_sections.append(0)
            chunk_sections.append(0)
        elif min_h > sec_y_end:
            chunk_sections.extend(struct.pack('>h', 4096))
            chunk_sections.append(0)
            chunk_sections.append(1)
        else:
            data_array = bytearray(2048)
            non_air = 0
            for y_rel in range(16):
                wy = sec_y_start + y_rel
                for z in range(16):
                    long_val = 0
                    for x in range(16):
                        if wy <= heights[z*16 + x]:
                            long_val |= (1 << (x * 4))
                            non_air += 1
                    if long_val != 0:
                        idx = (y_rel * 16 + z) * 8
                        struct.pack_into('>Q', data_array, idx, long_val)
            chunk_sections.extend(struct.pack('>h', non_air))
            chunk_sections.append(4)
            chunk_sections.append(2)
            chunk_sections.append(0)
            chunk_sections.append(1)
            chunk_sections.append(0x80)
            chunk_sections.append(0x02)
            chunk_sections.extend(data_array)
        chunk_sections.append(0)
        chunk_sections.append(1)
    sys.stdout.buffer.write(chunk_sections)
gen()
`;

fs.writeFileSync('temp_chunk_gen.py', pyScript);
const chunkSec = execSync('python temp_chunk_gen.py');
const light = Buffer.from([0, 0, 0, 0, 0, 0]);
const payload = Buffer.concat([
  Buffer.from([0,0,0,0, 0,0,0,0]),
  encodeVarint(0),
  encodeVarint(chunkSec.length),
  chunkSec,
  encodeVarint(0),
  light
]);
const packet = Buffer.concat([encodeVarint(payload.length + 1), Buffer.from([0x2c]), payload]);

des.on('data', d => {
  console.log('SUCCESS! 1.21.11 client parsed 3D chunk packet:', d.data.name);
});
des.write(packet);
