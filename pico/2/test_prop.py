# Test line of redstone wire propagation
world_blocks = {}
REDSTONE_BLOCK = 11109

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
    if y <= 64: return 9
    return 0

# Set up blocks: Redstone block at (10, 65, 10), then 4 wires extending west: (9, 65, 10), (8, 65, 10), (7, 65, 10), (6, 65, 10)
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
        if b == REDSTONE_BLOCK:
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

    print("Wire powers computed:", wire_powers)

trigger_redstone_update()
