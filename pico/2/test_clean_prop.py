# Test exact redstone line propagation
world_blocks = {}
REDSTONE_BLOCK = 11109
REDSTONE_TORCH = 6684
LEVER_ON = 6580

def is_redstone_wire(b):
    return 3810 <= b <= 5105

def make_wire_state(east="side", north="none", power=0, south="none", west="side"):
    enum_map = {'up': 0, 'side': 1, 'none': 2}
    e = enum_map.get(east, 1)
    n = enum_map.get(north, 2)
    p = max(0, min(15, power))
    s = enum_map.get(south, 2)
    w = enum_map.get(west, 1)
    offset = ((((e * 3 + n) * 16 + p) * 3 + s) * 3 + w)
    return 3810 + offset

def get_block(x, y, z):
    if (x, y, z) in world_blocks:
        return world_blocks[(x, y, z)]
    if y <= 64: return 9 # Grass
    return 0

# Set up 4 wires extending west from Redstone Block
world_blocks[(10, 65, 10)] = REDSTONE_BLOCK
world_blocks[(9, 65, 10)] = 4970
world_blocks[(8, 65, 10)] = 4970
world_blocks[(7, 65, 10)] = 4970
world_blocks[(6, 65, 10)] = 4970

def trigger_redstone_update():
    powered_blocks = {}
    active_buttons = {}
    
    # 1. Direct power sources
    for (x, y, z), b in list(world_blocks.items()):
        if b in (REDSTONE_BLOCK, REDSTONE_TORCH, LEVER_ON) or (x, y, z) in active_buttons:
            powered_blocks[(x, y, z)] = 15
            
    # 2. BFS Redstone Wire propagation
    queue = []
    for (x, y, z), p in list(powered_blocks.items()):
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

    # 3. Update Redstone Wires visual power and connections
    for (x, y, z), b in list(world_blocks.items()):
        if is_redstone_wire(b):
            pwr = wire_powers.get((x, y, z), 0)
            
            e_block = get_block(x+1, y, z)
            w_block = get_block(x-1, y, z)
            n_block = get_block(x, y, z-1)
            s_block = get_block(x, y, z+1)
            
            e_conn = "side" if e_block != 0 else "none"
            w_conn = "side" if w_block != 0 else "none"
            n_conn = "side" if n_block != 0 else "none"
            s_conn = "side" if s_block != 0 else "none"
            
            if e_conn == "none" and w_conn == "none" and n_conn == "none" and s_conn == "none":
                e_conn = w_conn = n_conn = s_conn = "side"
            elif (e_conn != "none" or w_conn != "none") and (n_conn == "none" and s_conn == "none"):
                e_conn = w_conn = "side"
            elif (n_conn != "none" or s_conn != "none") and (e_conn == "none" and w_conn == "none"):
                n_conn = s_conn = "side"
                
            new_wire = make_wire_state(e_conn, n_conn, pwr, s_conn, w_conn)
            world_blocks[(x, y, z)] = new_wire
            print(f"Wire at ({x},{y},{z}) -> pwr={pwr}, state={new_wire}")

trigger_redstone_update()
