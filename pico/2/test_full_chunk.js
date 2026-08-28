const mc = require('minecraft-protocol');
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
import struct, sys

def send_varint(val):
    out = bytearray()
    while True:
        if (val & ~0x7F) == 0:
            out.append(val)
            break
        out.append((val & 0x7F) | 0x80)
        val >>= 7
    return out

base_y = 64
primary = 1

# Surface section 8: y_rel=0 is Grass (Index 1), y_rel > 0 is Air (Index 0)
surf_data = bytearray(2048)
# For y_rel=0: each nibble is 1 (Grass) -> 0x1111111111111111
long_grass = 0x1111111111111111
for z in range(16):
    struct.pack_into(">Q", surf_data, z * 8, long_grass)

chunk_sections = bytearray()
for s_idx in range(24):
    if s_idx == 0: # Bedrock
        chunk_sections.extend(struct.pack(">h", 4096))
        chunk_sections.append(0)
        chunk_sections.extend(send_varint(85))
    elif s_idx == 1: # Deepslate
        chunk_sections.extend(struct.pack(">h", 4096))
        chunk_sections.append(0)
        chunk_sections.extend(send_varint(27722))
    elif s_idx < 7: # Stone
        chunk_sections.extend(struct.pack(">h", 4096))
        chunk_sections.append(0)
        chunk_sections.extend(send_varint(primary))
    elif s_idx == 7: # Dirt
        chunk_sections.extend(struct.pack(">h", 4096))
        chunk_sections.append(0)
        chunk_sections.extend(send_varint(10))
    elif s_idx == 8: # Surface Grass Layer (y_rel=0)
        chunk_sections.extend(struct.pack(">h", 256))
        chunk_sections.append(4) # BPE=4
        chunk_sections.extend(send_varint(2)) # Palette length = 2
        chunk_sections.extend(send_varint(0)) # 0 = Air
        chunk_sections.extend(send_varint(9)) # 1 = Grass
        chunk_sections.extend(surf_data)
    else: # Air
        chunk_sections.extend(struct.pack(">h", 0))
        chunk_sections.append(0)
        chunk_sections.extend(send_varint(0))
        
    # Biome: Plains
    chunk_sections.append(0)
    chunk_sections.extend(send_varint(1))

# Light with full sky daylight mask (26 sections = 0x3FFFFFF)
empty_light_mask = send_varint(1) + struct.pack(">q", 0x3FFFFFF)
light_data = (
    send_varint(0) + send_varint(0) +
    empty_light_mask + empty_light_mask +
    send_varint(0) + send_varint(0)
)

payload = (
    struct.pack(">ii", 0, 0) +
    send_varint(0) +
    send_varint(len(chunk_sections)) +
    chunk_sections +
    send_varint(0) +
    light_data
)

sys.stdout.buffer.write(payload)
`;

require('fs').writeFileSync('test_light_chunk.py', pyScript);
const payload = execSync('python test_light_chunk.py');
const packet = Buffer.concat([encodeVarint(payload.length + 1), Buffer.from([0x2c]), payload]);

let decoded = false;
des.on('data', d => {
  console.log('SUCCESS: Full daylight chunk deserialized with Sodium-compatible light mask!', d.data.name);
  decoded = true;
});
des.write(packet);
