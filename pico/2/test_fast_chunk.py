
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

# Precompute surface section for base_y = 64 (Section 8, Y=64..79, surface_y_rel = 0)
surf_sec_idx = (base_y + 64) // 16
surf_y_rel = (base_y + 64) % 16

data_array = bytearray(2048)
# y_rel == surf_y_rel -> Grass (Palette Index 1 = 0x1111111111111111)
# y_rel < surf_y_rel -> Dirt (Palette Index 2 = 0x2222222222222222)
# y_rel > surf_y_rel -> Air (Palette Index 0 = 0x0000000000000000)

for y_rel in range(16):
    pal_idx = 1 if y_rel == surf_y_rel else (2 if y_rel < surf_y_rel else 0)
    if pal_idx != 0:
        long_val = 0
        for x in range(16):
            long_val |= (pal_idx << (x * 4))
        for z in range(16):
            struct.pack_into(">Q", data_array, (y_rel * 16 + z) * 8, long_val)

chunk_sections = bytearray()
for s_idx in range(24):
    if s_idx < surf_sec_idx:
        # 100% Solid Section
        b_type = 85 if s_idx == 0 else (27722 if s_idx == 1 else primary)
        chunk_sections.extend(struct.pack(">h", 4096))
        chunk_sections.append(0) # BPE=0
        chunk_sections.extend(send_varint(b_type))
    elif s_idx == surf_sec_idx:
        # Surface Section (BPE=4)
        non_air = (surf_y_rel + 1) * 256
        chunk_sections.extend(struct.pack(">h", non_air))
        chunk_sections.append(4) # BPE=4
        chunk_sections.extend(send_varint(3)) # Palette length = 3
        chunk_sections.extend(send_varint(0)) # 0 = Air
        chunk_sections.extend(send_varint(9)) # 1 = Grass
        chunk_sections.extend(send_varint(10)) # 2 = Dirt
        chunk_sections.extend(data_array)
    else:
        # 100% Air Section
        chunk_sections.extend(struct.pack(">h", 0))
        chunk_sections.append(0) # BPE=0
        chunk_sections.extend(send_varint(0))
        
    # Biomes (Plains, BPE=0)
    chunk_sections.append(0)
    chunk_sections.extend(send_varint(1))

sys.stdout.buffer.write(chunk_sections)
