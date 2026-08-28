const mc = require('minecraft-protocol');
const des = mc.createDeserializer({isServer: false, version: '1.21.11', state: 'play'});
const { execSync } = require('child_process');

// Run python to get build_chunk_data bytes
const pyScript = `
import struct, sys

def send_varint(val):
    out = bytearray()
    while True:
        b = val & 0x7F
        val >>= 7
        if val != 0: out.append(b | 0x80)
        else: out.append(b); break
    return bytes(out)

def make_packet(packet_id, payload):
    p_id = send_varint(packet_id)
    return send_varint(len(p_id) + len(payload)) + p_id + payload

base_y = 64
surf_sec_idx = max(0, min(23, (base_y + 64) // 16))
surf_y_rel = max(0, min(15, (base_y + 64) % 16))

surf_data = bytearray(2048)
long_grass = 0x1111111111111111
long_dirt  = 0x2222222222222222

for y_rel in range(16):
    if y_rel == surf_y_rel:
        for z in range(16):
            struct.pack_into(">Q", surf_data, (y_rel * 16 + z) * 8, long_grass)
    elif y_rel < surf_y_rel:
        for z in range(16):
            struct.pack_into(">Q", surf_data, (y_rel * 16 + z) * 8, long_dirt)
            
chunk_sections = bytearray()
for s_idx in range(24):
    if s_idx == 0:
        chunk_sections.extend(struct.pack(">h", 4096))
        chunk_sections.append(0)
        chunk_sections.extend(send_varint(85))
    elif s_idx == 1:
        chunk_sections.extend(struct.pack(">h", 4096))
        chunk_sections.append(0)
        chunk_sections.extend(send_varint(27722))
    elif s_idx < surf_sec_idx:
        chunk_sections.extend(struct.pack(">h", 4096))
        chunk_sections.append(0)
        chunk_sections.extend(send_varint(1))
    elif s_idx == surf_sec_idx:
        non_air = (surf_y_rel + 1) * 256
        chunk_sections.extend(struct.pack(">h", non_air))
        chunk_sections.append(4)
        chunk_sections.extend(send_varint(3))
        chunk_sections.extend(send_varint(0))
        chunk_sections.extend(send_varint(9))
        chunk_sections.extend(send_varint(10))
        chunk_sections.extend(surf_data)
    else:
        chunk_sections.extend(struct.pack(">h", 0))
        chunk_sections.append(0)
        chunk_sections.extend(send_varint(0))
        
    chunk_sections.append(0)
    chunk_sections.extend(send_varint(1))

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

pkt = make_packet(0x2C, payload)
sys.stdout.buffer.write(pkt)
`;

const fs = require('fs');
fs.writeFileSync('temp_chunk_gen.py', pyScript);
const pktBuf = execSync('python temp_chunk_gen.py');

des.on('data', d => console.log('CHUNK DESERIALIZE SUCCESS:', d.data.name, 'x:', d.data.params.x, 'z:', d.data.params.z));
des.on('error', e => console.error('CHUNK ERROR:', e));
des.write(pktBuf);
