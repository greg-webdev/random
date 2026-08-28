world_blocks = {}

def get_block(x, y, z):
    return world_blocks.get((x, y, z), 0)

REDSTONE_BLOCK = 11109
REDSTONE_TORCH = 6684
LEVER_ON = 6580
LEVER_OFF = 6579
LAMP_UNLIT = 9278
LAMP_LIT = 9279
TNT = 2141

FACING_OFFSETS = [
    (0, 0, -1), # North (0)
    (1, 0, 0),  # East (1)
    (0, 0, 1),  # South (2)
    (-1, 0, 0), # West (3)
    (0, 1, 0),  # Up (4)
    (0, -1, 0)  # Down (5)
]

def is_sticky_piston(b):
    return 2035 <= b <= 2046

def is_regular_piston(b):
    return 2057 <= b <= 2068

def is_redstone_wire(b):
    return 3810 <= b <= 5105

def get_piston_facing_index(b):
    if 2035 <= b <= 2040: return b - 2035
    if 2041 <= b <= 2046: return b - 2041
    if 2057 <= b <= 2062: return b - 2057
    if 2063 <= b <= 2068: return b - 2063
    return 4

def make_wire_state(east="side", north="none", power=0, south="none", west="side"):
    enum_map = {'up': 0, 'side': 1, 'none': 2}
    e = enum_map.get(east, 1)
    n = enum_map.get(north, 2)
    p = max(0, min(15, power))
    s = enum_map.get(south, 2)
    w = enum_map.get(west, 1)
    offset = ((((e * 3 + n) * 16 + p) * 3 + s) * 3 + w)
    return 3810 + offset

def trigger_redstone_update(cx, cy, cz, broadcast_fn=None):
    powered_blocks = {}
    
    # 1. Direct power sources
    for (x, y, z), b in list(world_blocks.items()):
        if b in (REDSTONE_BLOCK, REDSTONE_TORCH, LEVER_ON):
            powered_blocks[(x, y, z)] = 15
            
    # 2. BFS Redstone Wire propagation
    queue = []
    for (x, y, z), p in powered_blocks.items():
        if p > 0: queue.append(((x, y, z), p))
            
    wire_powers = {}
    while queue:
        (x, y, z), p = queue.pop(0)
        if p <= 0: continue
        
        for dx, dy, dz in ((1,0,0), (-1,0,0), (0,1,0), (0,-1,0), (0,0,1), (0,0,-1)):
            nx, ny, nz = x + dx, y + dy, z + dz
            nb = get_block(nx, ny, nz)
            
            if is_redstone_wire(nb):
                wire_p = p - 1
                if wire_p > wire_powers.get((nx, ny, nz), 0):
                    wire_powers[(nx, ny, nz)] = wire_p
                    powered_blocks[(nx, ny, nz)] = wire_p
                    queue.append(((nx, ny, nz), wire_p))
            elif nb != 0:
                powered_blocks[(nx, ny, nz)] = max(powered_blocks.get((nx, ny, nz), 0), p)

    # 3. Update Redstone Wires visual power and connections
    for (x, y, z), b in list(world_blocks.items()):
        if is_redstone_wire(b):
            pwr = wire_powers.get((x, y, z), 0)
            e_conn = "side" if get_block(x+1, y, z) != 0 else "none"
            w_conn = "side" if get_block(x-1, y, z) != 0 else "none"
            n_conn = "side" if get_block(x, y, z-1) != 0 else "none"
            s_conn = "side" if get_block(x, y, z+1) != 0 else "none"
            
            if e_conn == "none" and w_conn == "none" and n_conn == "none" and s_conn == "none":
                e_conn = w_conn = n_conn = s_conn = "side"
            elif (e_conn != "none" or w_conn != "none") and (n_conn == "none" and s_conn == "none"):
                e_conn = w_conn = "side"
            elif (n_conn != "none" or s_conn != "none") and (e_conn == "none" and w_conn == "none"):
                n_conn = s_conn = "side"
                
            new_wire = make_wire_state(e_conn, n_conn, pwr, s_conn, w_conn)
            if new_wire != b:
                world_blocks[(x, y, z)] = new_wire
                if broadcast_fn: broadcast_fn(x, y, z, new_wire)

    # 4. Update Consumers: Lamps, Sticky Pistons, Regular Pistons, TNT
    for (x, y, z), b in list(world_blocks.items()):
        # Redstone Lamp
        if b in (LAMP_UNLIT, LAMP_LIT):
            has_pwr = any(powered_blocks.get((x+dx, y+dy, z+dz), 0) > 0 for dx,dy,dz in ((1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)))
            new_b = LAMP_LIT if has_pwr else LAMP_UNLIT
            if new_b != b:
                world_blocks[(x, y, z)] = new_b
                if broadcast_fn: broadcast_fn(x, y, z, new_b)
                
        # Sticky Piston
        elif is_sticky_piston(b):
            facing_idx = get_piston_facing_index(b)
            ox, oy, oz = FACING_OFFSETS[facing_idx]
            head_pos = (x + ox, y + oy, z + oz)
            has_pwr = any(powered_blocks.get((x+dx, y+dy, z+dz), 0) > 0 for dx,dy,dz in ((1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)))
            
            if has_pwr:
                ext_state = 2035 + facing_idx
                if b != ext_state:
                    world_blocks[(x, y, z)] = ext_state
                    if broadcast_fn: broadcast_fn(x, y, z, ext_state)
                    head_state = 2070 + facing_idx * 2 if facing_idx < 4 else (2088 if facing_idx == 4 else 2092)
                    world_blocks[head_pos] = head_state
                    if broadcast_fn: broadcast_fn(head_pos[0], head_pos[1], head_pos[2], head_state)
            else:
                unext_state = 2041 + facing_idx
                if b != unext_state:
                    world_blocks[(x, y, z)] = unext_state
                    if broadcast_fn: broadcast_fn(x, y, z, unext_state)
                    if get_block(*head_pos) in range(2069, 2093):
                        world_blocks.pop(head_pos, None)
                        if broadcast_fn: broadcast_fn(head_pos[0], head_pos[1], head_pos[2], 0)

        # Regular Piston
        elif is_regular_piston(b):
            facing_idx = get_piston_facing_index(b)
            ox, oy, oz = FACING_OFFSETS[facing_idx]
            head_pos = (x + ox, y + oy, z + oz)
            has_pwr = any(powered_blocks.get((x+dx, y+dy, z+dz), 0) > 0 for dx,dy,dz in ((1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)))
            
            if has_pwr:
                ext_state = 2057 + facing_idx
                if b != ext_state:
                    world_blocks[(x, y, z)] = ext_state
                    if broadcast_fn: broadcast_fn(x, y, z, ext_state)
                    head_state = 2069 + facing_idx * 2 if facing_idx < 4 else (2087 if facing_idx == 4 else 2091)
                    world_blocks[head_pos] = head_state
                    if broadcast_fn: broadcast_fn(head_pos[0], head_pos[1], head_pos[2], head_state)
            else:
                unext_state = 2063 + facing_idx
                if b != unext_state:
                    world_blocks[(x, y, z)] = unext_state
                    if broadcast_fn: broadcast_fn(x, y, z, unext_state)
                    if get_block(*head_pos) in range(2069, 2093):
                        world_blocks.pop(head_pos, None)
                        if broadcast_fn: broadcast_fn(head_pos[0], head_pos[1], head_pos[2], 0)

# Simulate setup from user screenshot:
# Redstone Block at (1, 64, 0)
# Wire at (0, 64, 0)
# Sticky Piston Up at (-1, 64, 0)
world_blocks[(1, 64, 0)] = REDSTONE_BLOCK
world_blocks[(0, 64, 0)] = 4970 # Wire (power 0)
world_blocks[(-1, 64, 0)] = 2045 # Sticky Piston Up (unextended)

changes = []
trigger_redstone_update(1, 64, 0, lambda x,y,z,b: changes.append(((x,y,z), b)))
print("Changes after update:", changes)
