
import struct, sys, math

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
ttype = "flat"

def get_h(wx, wz):
    if ttype == "flat" or ttype == "layered":
        return base_y
    elif ttype == "mountains":
        return int(base_y + math.sin(wx * 0.08) * math.cos(wz * 0.08) * 12.0)
    elif ttype == "aether":
        dx, dz = (wx % 32) - 16, (wz % 32) - 16
        dist = math.sqrt(dx*dx + dz*dz)
        if dist < 14:
            thick = 12.0 * (1.0 - dist / 14.0)
            return int(base_y + thick + math.sin(wx * 0.4) * math.cos(wz * 0.4) * 2.0)
        return 0
    elif ttype == "void":
        return base_y if (0 <= wx <= 16 and 0 <= wz <= 16) else 0
    return base_y

def get_block_id(wx, wy, wz, h):
    if wy < -64 or wy > 319: return 0
    if wy == -64: return 85 # Bedrock
    if ttype == "void":
        return 9 if wy == h and h > 0 else 0
    if wy > h: return 0
    if wy == h: return 9 # Grass
    if wy >= h - 3: return 10 # Dirt
    if wy < -48: return 27722 # Deepslate
    return primary # Stone

# Palette for BPE=4 (Index 0 = Air)
PALETTE_BLOCKS = [0, 9, 10, 1, 85, 27722]
BLOCK_TO_PAL = {0: 0, 9: 1, 10: 2, 1: 3, 85: 4, 27722: 5}

for cx in range(-2, 3):
    for cz in range(-2, 3):
        heights = [get_h(cx * 16 + x, cz * 16 + z) for z in range(16) for x in range(16)]
        chunk_sections = bytearray()
        
        for s_idx in range(24):
            sec_y_start = s_idx * 16 - 64
            sec_y_end = sec_y_start + 15
            
            data_array = bytearray(2048)
            non_air = 0
            single_block = None
            is_uniform = True
            first_block = None
            
            for y_rel in range(16):
                wy = sec_y_start + y_rel
                for z in range(16):
                    wz = cz * 16 + z
                    long_val = 0
                    for x in range(16):
                        wx = cx * 16 + x
                        h = heights[z*16 + x]
                        b = get_block_id(wx, wy, wz, h)
                        
                        if first_block is None:
                            first_block = b
                        elif is_uniform and b != first_block:
                            is_uniform = False
                            
                        if b != 0:
                            non_air += 1
                            pal_idx = BLOCK_TO_PAL.get(b, 3)
                            long_val |= (pal_idx << (x * 4))
                    if long_val != 0:
                        idx = (y_rel * 16 + z) * 8
                        struct.pack_into(">Q", data_array, idx, long_val)
                        
            if is_uniform or non_air == 0:
                # 100% Single-Valued Section (BPE=0)
                chunk_sections.extend(struct.pack(">h", 0 if first_block == 0 else 4096))
                chunk_sections.append(0) # BPE=0
                chunk_sections.extend(send_varint(first_block if first_block is not None else 0))
            elif non_air == 4096 and is_uniform:
                chunk_sections.extend(struct.pack(">h", 4096))
                chunk_sections.append(0) # BPE=0
                chunk_sections.extend(send_varint(first_block))
            else:
                # Mixed Section (BPE=4)
                chunk_sections.extend(struct.pack(">h", non_air))
                chunk_sections.append(4) # BPE=4
                chunk_sections.extend(send_varint(len(PALETTE_BLOCKS)))
                for p_block in PALETTE_BLOCKS:
                    chunk_sections.extend(send_varint(p_block))
                chunk_sections.extend(data_array)
                
            # Biomes (Plains, BPE=0)
            chunk_sections.append(0)
            chunk_sections.extend(send_varint(1))

sys.stdout.buffer.write(chunk_sections)
