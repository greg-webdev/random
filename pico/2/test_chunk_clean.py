
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

chunk_sections = bytearray()
for s_idx in range(24):
    if s_idx < 4: # Solid
        chunk_sections.extend(struct.pack('>h', 4096))
        chunk_sections.append(0) # BPE=0
        chunk_sections.extend(send_varint(1)) # Stone
    elif s_idx == 4: # Mixed BPE=4 without extra varint length
        data_array = bytearray(2048)
        chunk_sections.extend(struct.pack('>h', 2048))
        chunk_sections.append(4) # BPE=4
        chunk_sections.extend(send_varint(2)) # Palette size = 2
        chunk_sections.extend(send_varint(0)) # Air
        chunk_sections.extend(send_varint(9)) # Grass
        chunk_sections.extend(data_array)     # 2048 bytes raw data!
    else: # Air
        chunk_sections.extend(struct.pack('>h', 0))
        chunk_sections.append(0) # BPE=0
        chunk_sections.extend(send_varint(0)) # Air
    # Biome BPE=0 (Plains)
    chunk_sections.append(0)
    chunk_sections.extend(send_varint(1))

sys.stdout.buffer.write(chunk_sections)
