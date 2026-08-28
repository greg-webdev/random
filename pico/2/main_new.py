import time
import math
import struct
import gc

gc.collect()

# MicroPython network module check
try:
    import network
except ImportError:
    network = None

try:
    import socket
except ImportError:
    try:
        import usocket as socket
    except ImportError:
        socket = None

try:
    import select
except ImportError:
    try:
        import uselect as select
    except ImportError:
        select = None

try:
    import machine
except ImportError:
    machine = None

# Hardware LED setup
led = None
if machine:
    try:
        led = machine.Pin("LED", machine.Pin.OUT)
    except Exception:
        try:
            led = machine.Pin(25, machine.Pin.OUT)
        except Exception:
            pass

def set_led(val):
    if led:
        try:
            led.value(1 if val else 0)
        except Exception:
            pass

def get_led():
    if led:
        try:
            return bool(led.value())
        except Exception:
            pass
    return False

def blink_led(delay):
    set_led(not get_led())
    time.sleep(delay)

# ==========================================
# 1. WiFi Setup
# ==========================================
WIFI_NETWORKS = [
    ("dont use this this 2.4", ""),
    ("dont use this 2.4", ""),
    ("potato", "aaaaaaaa")
]

wlan = None

def get_wlan_interface():
    global wlan
    if wlan:
        return wlan

    if not network:
        print("[ERROR] MicroPython 'network' module missing!")
        return None

    if hasattr(network, "WLAN") and hasattr(network, "STA_IF"):
        try:
            wlan = network.WLAN(network.STA_IF)
            return wlan
        except Exception as e:
            print("[ERROR] network.WLAN(network.STA_IF) failed:", e)

    try:
        import cyw43
        cyw43.init()
        wlan = network.WLAN(network.STA_IF)
        return wlan
    except Exception as e:
        print("[ERROR] cyw43 fallback failed:", e)

    return None

def connect_wifi_loop():
    interface = get_wlan_interface()
    if not interface:
        print("[CRITICAL] Wi-Fi interface not available!")
        return False

    try:
        interface.active(True)
        time.sleep(0.2)
    except Exception as e:
        print("[ERROR] Failed to activate WLAN interface:", e)
        return False

    if interface.isconnected():
        return True

    print("Scanning for WiFi APs...")
    ssids = []
    try:
        scan_results = interface.scan()
        ssids = [net[0].decode('utf-8') if isinstance(net[0], bytes) else str(net[0]) for net in scan_results]
        print("Visible Networks:", ssids)
    except Exception as e:
        print("Scan error:", e)

    target_networks = list(WIFI_NETWORKS)
    for scanned in ssids:
        if "dont use" in scanned.lower():
            target_networks.insert(0, (scanned, ""))

    for ssid, password in target_networks:
        print(f"Connecting to SSID '{ssid}'...")
        try:
            interface.disconnect()
        except Exception:
            pass
        time.sleep(0.1)
        
        try:
            if password:
                interface.connect(ssid, password)
            else:
                interface.connect(ssid)
        except Exception as e:
            print(f"Connect error for '{ssid}':", e)
            continue

        start_time = time.time()
        while not interface.isconnected():
            blink_led(0.5)
            if time.time() - start_time > 8:
                print(f"Timeout connecting to '{ssid}'")
                break

        if interface.isconnected():
            print(f"SUCCESS! Connected to '{ssid}'.")
            try:
                print("Pico W IP Address:", interface.ifconfig()[0])
            except Exception:
                pass
            return True

    print("Could not connect to configured networks.")
    return False

wifi_ok = connect_wifi_loop()
if not wifi_ok:
    print("WiFi connection not active. Setting LED steady ON...")
    set_led(True)

# ==========================================
# 2. Optimized Procedural Terrain Generator
# ==========================================
WORLD_X = 16
WORLD_Y = 16
WORLD_Z = 16

def height_noise(x, z):
    n1 = math.sin(x * 0.3) * math.cos(z * 0.3) * 2.0
    base_height = 8 + int(n1)
    return max(1, min(14, base_height))

def get_block_at(x, y, z):
    if y <= 0:
        return 7 # Bedrock
    h = height_noise(x, z)
    if y > h:
        return 0 # Air
    elif y == h:
        return 2 # Grass
    elif y >= h - 2:
        return 3 # Dirt
    else:
        return 1 # Stone

print(f"Generating 1.21.x custom procedural terrain ({WORLD_X}x{WORLD_Y}x{WORLD_Z})...")
gc.collect()
world_blocks = bytearray(WORLD_X * WORLD_Y * WORLD_Z)

for x in range(WORLD_X):
    for y in range(WORLD_Y):
        for z in range(WORLD_Z):
            idx = y * (WORLD_X * WORLD_Z) + z * WORLD_X + x
            world_blocks[idx] = get_block_at(x - (WORLD_X // 2), y, z - (WORLD_Z // 2))

print("Terrain generated!")
gc.collect()

# ==========================================
# 3. VarInt & Modern Packet Helpers (1.21.x)
# ==========================================
def read_varint(sock):
    val = 0
    for i in range(5):
        b = sock.recv(1)
        if not b:
            return None
        byte = b[0]
        val |= (byte & 0x7F) << (7 * i)
        if not (byte & 0x80):
            break
    return val

def send_varint(val):
    res = bytearray()
    while True:
        b = val & 0x7F
        val >>= 7
        if val:
            b |= 0x80
            res.append(b)
        else:
            res.append(b)
            break
    return res

def send_string(s):
    b = s.encode('utf-8')
    return send_varint(len(b)) + b

def make_packet(pkt_id, payload):
    data = send_varint(pkt_id) + payload
    return send_varint(len(data)) + data

# ==========================================
# 4. Server Sockets (Minecraft 1.21.x + Web)
# ==========================================
mc_sock = None
web_sock = None

def setup_sockets():
    global mc_sock, web_sock
    if not socket:
        return
    try:
        if not mc_sock:
            mc_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            try:
                mc_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            except Exception:
                pass
            mc_sock.bind(('0.0.0.0', 25565))
            mc_sock.listen(2)

        if not web_sock:
            web_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            try:
                web_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            except Exception:
                pass
            web_sock.bind(('0.0.0.0', 80))
            web_sock.listen(2)
    except Exception as e:
        print("Socket binding error:", e)

setup_sockets()

ip_addr = "0.0.0.0"
if wlan:
    try:
        if wlan.isconnected():
            ip_addr = wlan.ifconfig()[0]
    except Exception:
        pass

print("Minecraft 1.21.x Server running on port 25565!")
print("Status Web Server running on port 80!")
print(f"Minecraft IP: {ip_addr}:25565")
print(f"Status Web Page: http://{ip_addr}/")
start_server_time = time.time()
last_blink_time = time.time()
last_reconnect_time = time.time()

server_logs = []
server_logs = []
_orig_print = print
def _new_print(*args, **kwargs):
    global server_logs
    msg = " ".join(str(a) for a in args)
    _orig_print(msg)
    server_logs.append(msg)
    if len(server_logs) > 30:
        server_logs.pop(0)
print = _new_print

def handle_web_request(client_sock):
    try:
        try:
            req = client_sock.recv(512)
        except Exception:
            pass
            
        uptime = int(time.time() - start_server_time)
        curr_ip = "0.0.0.0"
        if wlan:
            try:
                if wlan.isconnected():
                    curr_ip = wlan.ifconfig()[0]
            except Exception:
                pass
        
        logs_html = "<br>".join(server_logs)
        if not logs_html:
            logs_html = "No logs yet."
            
        html = f"""<!DOCTYPE html>
<html>
<head>
    <title>Pico W Minecraft 1.21 Status</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body {{ font-family: sans-serif; background: #121214; color: #f0f0f0; margin: 0; padding: 20px; text-align: center; }}
        .card {{ background: #1e1e24; border-radius: 16px; padding: 24px; max-width: 480px; margin: 20px auto; box-shadow: 0 10px 30px rgba(0,0,0,0.5); border: 1px solid #333; }}
        h1 {{ color: #4CAF50; margin-bottom: 8px; }}
        .badge {{ display: inline-block; padding: 6px 12px; border-radius: 20px; font-weight: bold; background: #4CAF50; color: #fff; margin-bottom: 20px; }}
        .info {{ text-align: left; background: #18181c; padding: 16px; border-radius: 8px; font-family: monospace; font-size: 14px; color: #00e676; margin-bottom: 15px; }}
        .info div {{ margin-bottom: 8px; }}
        .logs {{ text-align: left; background: #000; padding: 12px; border-radius: 8px; font-family: monospace; font-size: 12px; color: #aaa; overflow-y: auto; max-height: 200px; border: 1px solid #333; }}
    </style>
</head>
<body>
    <div class="card">
        <h1>â›ï¸ Pico Minecraft 1.21.x</h1>
        <div class="badge">â— ONLINE & READY</div>
        <div class="info">
            <div><strong>IP Address:</strong> {curr_ip}</div>
            <div><strong>Minecraft Port:</strong> 25565</div>
            <div><strong>Protocol:</strong> 1.21.x / Modern Netty</div>
            <div><strong>Terrain:</strong> {WORLD_X}x{WORLD_Y}x{WORLD_Z} Procedural</div>
            <div><strong>Uptime:</strong> {uptime} seconds</div>
        </div>
        <div class="logs">
            {logs_html}
        </div>
    </div>
</body>
</html>"""
        
        response = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n" + html
        client_sock.sendall(response.encode())
    except Exception as e:
        print("Web request error:", e)
    finally:
        try:
            client_sock.close()
        except Exception:
            pass

def read_exact(sock, n):
    buf = bytearray()
    while len(buf) < n:
        try:
            chunk = sock.recv(n - len(buf))
            if not chunk:
                break
            buf.extend(chunk)
        except Exception:
            break
    return bytes(buf)


# ==========================================
# WebSocket & Eaglercraft Helper
# ==========================================
import hashlib
import binascii

def make_ws_accept(key):
    guid = b"258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
    try:
        sha = hashlib.sha1(key.encode('utf-8') + guid).digest()
        return binascii.b2a_base64(sha).decode('utf-8').strip()
    except:
        return ""

def make_ws_frame(payload):
    length = len(payload)
    if length <= 125:
        header = bytes([0x82, length])
    elif length <= 65535:
        header = bytes([0x82, 126]) + struct.pack(">H", length)
    else:
        header = bytes([0x82, 127]) + struct.pack(">Q", length)
    return header + payload

# ==========================================
# Safe Flash Streaming Helper
# ==========================================
def stream_file_safely(sock, filename, chunk_size=512):
    import gc
    gc.collect()
    f = None
    try:
        sock.settimeout(20.0)
        f = open(filename, 'rb')
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            sent = 0
            while sent < len(chunk):
                try:
                    n = sock.send(chunk[sent:])
                    if n > 0:
                        sent += n
                    else:
                        time.sleep(0.002)
                except Exception as ex:
                    if is_socket_timeout(ex):
                        time.sleep(0.005)
                        continue
                    raise ex
        return True
    except Exception as e:
        print(f"Error streaming {filename}:", e)
        return False
    finally:
        if f:
            try: f.close()
            except: pass

def is_socket_timeout(ex):
    try:
        if hasattr(ex, 'args') and ex.args:
            errno = ex.args[0]
            if errno in (11, 110, 116, 12, None):
                return True
        s = str(ex).lower()
        return 'timeout' in s or 'etimedout' in s or 'eagain' in s or 'ewouldblock' in s
    except:
        return True

# ==========================================
# World State, Redstone & Settings
# ==========================================

server_settings = {
    "terrain_type": "flat",       # "flat", "aether", "mountains", "layered", "void"
    "primary_block": 11109,       # Default block to place (Redstone Block)
    "base_height": 64,            # Base Y
    "island_thickness": 12,       # Thickness for islands/mountains
    "redstone_enabled": True,     # Redstone mechanics
}

world_blocks = {} # (x, y, z) -> state_id
active_buttons = {} # (x, y, z) -> expire_time

ITEM_TO_BLOCK = {
    723: 2045,  # Sticky Piston Item -> Sticky Piston (Up)
    722: 2067,  # Piston Item -> Regular Piston (Up)
    717: 4970,  # Redstone Dust Item -> Redstone Wire
    719: 11109, # Redstone Block Item -> Redstone Block
    718: 6684,  # Redstone Torch Item -> Redstone Torch
    747: 9278,  # Redstone Lamp Item -> Redstone Lamp
    732: 6579,  # Lever Item -> Lever (floor)
    746: 2141,  # TNT Item -> TNT
    1: 1,       # Stone
    9: 9,       # Grass Block
    10: 10,     # Dirt
    72: 5108,   # Diamond Block
}

DEFAULT_HOTBAR = [
    (36, 719), # Slot 1: Redstone Block
    (37, 717), # Slot 2: Redstone Dust
    (38, 723), # Slot 3: Sticky Piston
    (39, 722), # Slot 4: Regular Piston
    (40, 718), # Slot 5: Redstone Torch
    (41, 732), # Slot 6: Lever
    (42, 747), # Slot 7: Redstone Lamp
    (43, 746), # Slot 8: TNT
    (44, 72),  # Slot 9: Diamond Block
]

# Piston precise state definitions for 1.21.11
PISTON_DATA = {
    'sticky': {
        'down':  (2046, 2040, 2092, (0, -1, 0)),
        'up':    (2045, 2039, 2088, (0, 1, 0)),
        'north': (2041, 2035, 2072, (0, 0, -1)),
        'south': (2043, 2037, 2080, (0, 0, 1)),
        'west':  (2044, 2038, 2084, (-1, 0, 0)),
        'east':  (2042, 2036, 2076, (1, 0, 0)),
    },
    'normal': {
        'down':  (2068, 2062, 2091, (0, -1, 0)),
        'up':    (2067, 2061, 2087, (0, 1, 0)),
        'north': (2063, 2057, 2071, (0, 0, -1)),
        'south': (2065, 2059, 2079, (0, 0, 1)),
        'west':  (2066, 2060, 2083, (-1, 0, 0)),
        'east':  (2064, 2058, 2075, (1, 0, 0)),
    }
}

STATE_TO_PISTON = {}
for p_type, facings in PISTON_DATA.items():
    for facing, (unext, ext, head, offset) in facings.items():
        STATE_TO_PISTON[unext] = (p_type, facing, False, ext, head, offset)
        STATE_TO_PISTON[ext]   = (p_type, facing, True,  unext, head, offset)

def get_pico_temp():
    try:
        import machine
        sensor_temp = machine.ADC(4)
        reading = sensor_temp.read_u16() * (3.3 / 65535)
        temperature = 27 - (reading - 0.706) / 0.001721
        return round(temperature, 1)
    except:
        return 28.5

def get_wifi_rssi():
    try:
        if wlan and wlan.isconnected():
            return wlan.status('rssi')
    except:
        pass
    return -55

def get_mem_stats():
    import gc
    try:
        alloc = gc.mem_alloc()
        free = gc.mem_free()
        total = alloc + free
        pct = round((alloc / total) * 100, 1) if total > 0 else 0
        return alloc, free, total, pct
    except:
        return 0, 0, 0, 0

def decode_position(val):
    x = val >> 38
    if x >= (1 << 25): x -= (1 << 26)
    y = val & 0xFFF
    if y >= (1 << 11): y -= (1 << 12)
    z = (val >> 12) & 0x3FFFFFF
    if z >= (1 << 25): z -= (1 << 26)
    return int(x), int(y), int(z)

def encode_position(x, y, z):
    return ((x & 0x3FFFFFF) << 38) | ((z & 0x3FFFFFF) << 12) | (y & 0xFFF)

def make_block_change(x, y, z, block_state):
    pos_val = encode_position(x, y, z)
    payload = struct.pack(">Q", pos_val) + send_varint(block_state)
    return make_packet(0x08, payload)

def make_chat_message(text, is_action_bar=False):
    t_bytes = text.encode('utf-8')
    nbt = b'\x0A\x08\x00\x04text' + struct.pack(">H", len(t_bytes)) + t_bytes + b'\x00'
    payload = nbt + (b'\x01' if is_action_bar else b'\x00')
    return make_packet(0x77, payload)

def broadcast_block_change(x, y, z, block_state):
    pkt = make_block_change(x, y, z, block_state)
    for p in play_clients:
        if p.sock:
            try:
                p.sock.sendall(pkt)
            except Exception:
                pass

def broadcast_chat(message):
    pkt = make_chat_message(message)
    for p in play_clients:
        if p.sock:
            try:
                p.sock.sendall(pkt)
            except Exception:
                pass

def set_block(x, y, z, state_id):
    if state_id == 0:
        world_blocks.pop((x, y, z), None)
    else:
        world_blocks[(x, y, z)] = state_id
    broadcast_block_change(x, y, z, state_id)
    if server_settings["redstone_enabled"]:
        trigger_redstone_update(x, y, z)

def get_block(x, y, z):
    if (x, y, z) in world_blocks:
        return world_blocks[(x, y, z)]
    if y < -64 or y > 319: return 0
    if y == -64: return 85 # Bedrock
    
    base_y = server_settings["base_height"]
    ttype = server_settings["terrain_type"]
    
    if ttype == "void":
        return 9 if (x, y, z) == (8, base_y, 8) else 0
    if y > base_y: return 0
    if y == base_y: return 9 # Grass
    if y >= base_y - 3: return 10 # Dirt
    if y < -48: return 27722 # Deepslate
    return 1 # Stone

# ==========================================
# Full Redstone & Piston Engine
# ==========================================
REDSTONE_BLOCK = 11109
REDSTONE_TORCH = 6684
LEVER_ON = 6580
LEVER_OFF = 6579
LAMP_UNLIT = 9278
LAMP_LIT = 9279
TNT = 2141

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

def get_piston_state_from_placement(dir_val, pitch, yaw, sticky=True):
    p_type = 'sticky' if sticky else 'normal'
    if dir_val == 1: facing = 'up'
    elif dir_val == 0: facing = 'down'
    elif pitch > 45: facing = 'up'
    elif pitch < -45: facing = 'down'
    else:
        norm_yaw = (yaw % 360 + 360) % 360
        if 45 <= norm_yaw < 135: facing = 'west'
        elif 135 <= norm_yaw < 225: facing = 'north'
        elif 225 <= norm_yaw < 315: facing = 'east'
        else: facing = 'south'
    unext, ext, head, offset = PISTON_DATA[p_type][facing]
    return unext

def parse_creative_slot(payload):
    if len(payload) < 3: return None, None
    slot = struct.unpack(">h", payload[:2])[0]
    idx = 2
    item_count = 0
    shift = 0
    while idx < len(payload):
        b = payload[idx]
        idx += 1
        item_count |= (b & 0x7F) << shift
        if (b & 0x80) == 0: break
        shift += 7
    if item_count <= 0 or idx >= len(payload):
        return slot, 0
    item_id = 0
    shift = 0
    while idx < len(payload):
        b = payload[idx]
        idx += 1
        item_id |= (b & 0x7F) << shift
        if (b & 0x80) == 0: break
        shift += 7
    return slot, item_id

def trigger_redstone_update(cx=0, cy=0, cz=0):
    powered_blocks = {}
    
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
            if new_wire != b:
                world_blocks[(x, y, z)] = new_wire
                broadcast_block_change(x, y, z, new_wire)

    # 4. Update Consumers: Lamps, Pistons, TNT
    for (x, y, z), b in list(world_blocks.items()):
        # Redstone Lamp
        if b in (LAMP_UNLIT, LAMP_LIT):
            has_pwr = any(powered_blocks.get((x+dx, y+dy, z+dz), 0) > 0 for dx,dy,dz in ((1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)))
            new_b = LAMP_LIT if has_pwr else LAMP_UNLIT
            if new_b != b:
                world_blocks[(x, y, z)] = new_b
                broadcast_block_change(x, y, z, new_b)
                
        # Pistons (Sticky & Normal)
        elif b in STATE_TO_PISTON:
            p_type, facing, is_ext, target_state, head_state, (ox, oy, oz) = STATE_TO_PISTON[b]
            head_pos = (x + ox, y + oy, z + oz)
            has_pwr = any(powered_blocks.get((x+dx, y+dy, z+dz), 0) > 0 for dx,dy,dz in ((1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)))
            
            if has_pwr and not is_ext:
                # Extend piston!
                world_blocks[(x, y, z)] = target_state
                broadcast_block_change(x, y, z, target_state)
                world_blocks[head_pos] = head_state
                broadcast_block_change(head_pos[0], head_pos[1], head_pos[2], head_state)
            elif not has_pwr and is_ext:
                # Retract piston!
                world_blocks[(x, y, z)] = target_state
                broadcast_block_change(x, y, z, target_state)
                if get_block(*head_pos) in range(2069, 2093):
                    world_blocks.pop(head_pos, None)
                    broadcast_block_change(head_pos[0], head_pos[1], head_pos[2], 0)

        # TNT Ignition
        elif b == TNT:
            has_pwr = any(powered_blocks.get((x+dx, y+dy, z+dz), 0) > 0 for dx,dy,dz in ((1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)))
            if has_pwr:
                world_blocks.pop((x, y, z), None)
                broadcast_block_change(x, y, z, 0)
                for ex in range(x-2, x+3):
                    for ey in range(y-2, y+3):
                        for ez in range(z-2, z+3):
                            if (ex-x)**2 + (ey-y)**2 + (ez-z)**2 <= 5:
                                if get_block(ex, ey, ez) != 85: # Bedrock
                                    world_blocks.pop((ex, ey, ez), None)
                                    broadcast_block_change(ex, ey, ez, 0)

# ==========================================
# Player & Client Management
# ==========================================
class Player:
    def __init__(self, sock, addr, eid, name=None):
        self.sock = sock
        self.addr = addr
        self.eid = eid
        self.is_bot = (sock is None)
        self.is_ws = False
        
        try:
            import os
            r1 = os.urandom(8)
            r2 = os.urandom(8)
        except:
            r1 = struct.pack(">Q", time.ticks_cpu() if hasattr(time, 'ticks_cpu') else 0)
            r2 = struct.pack(">Q", eid)
        self.uuid = r1 + r2
        
        self.x = 8.0
        self.y = float(server_settings["base_height"]) + 2.0
        self.z = 8.0
        self.yaw = 0.0
        self.pitch = 0.0
        self.chunks_to_send = []
        self.last_keep_alive = time.time()
        self.last_chunk_time = 0.0
        self.last_chunk_x = 0
        self.last_chunk_z = 0
        self.held_item = 717 # Default: Redstone Dust
        self.inventory = {}
        for s, i in DEFAULT_HOTBAR:
            self.inventory[s] = i
        self.held_slot = 1
        self.name = name or f"Player_{eid}"

play_clients = []
next_eid = 100

def spawn_fake_player(name="Steve_Bot"):
    global next_eid
    eid = next_eid
    next_eid += 1
    base_y = float(server_settings["base_height"])
    
    px, py, pz = 8.5, base_y + 2.0, 8.5
    for p in play_clients:
        if not p.is_bot:
            px, py, pz = p.x + 1.5, p.y, p.z + 1.5
            break
            
    bot = Player(None, ("127.0.0.1", 0), eid, name=name)
    bot.x, bot.y, bot.z = px, py, pz
    play_clients.append(bot)
    
    pid_player_info = 0x44
    pid_spawn_entity = 0x01
    broadcast(pid_player_info, make_player_info(bot))
    broadcast(pid_spawn_entity, make_spawn_entity(bot))
    broadcast_chat(f"[Server] Fake player {name} joined the game!")
    return bot

def remove_all_fake_players():
    bots = [p for p in play_clients if p.is_bot]
    for b in bots:
        play_clients.remove(b)
        pid_player_remove = 0x43
        pid_entity_destroy = 0x4B
        broadcast(pid_player_remove, make_player_remove(b))
        broadcast(pid_entity_destroy, make_entity_destroy(b))
    if bots:
        broadcast_chat(f"[Server] Removed {len(bots)} fake player(s).")

def make_player_info(player):
    return (
        b'\x01' +
        send_varint(1) +
        player.uuid +
        send_string(player.name) +
        send_varint(0)
    )

def make_spawn_entity(player):
    # 1.21.11 (Protocol 774): 49 bytes exact
    yaw_byte = int((player.yaw % 360) * 256 // 360) & 0xFF
    pitch_byte = int((player.pitch % 360) * 256 // 360) & 0xFF
    return (
        send_varint(player.eid) +
        player.uuid +
        send_varint(155) +
        struct.pack(">ddd", player.x, player.y, player.z) +
        struct.pack(">bbb", pitch_byte, yaw_byte, yaw_byte) +
        send_varint(0) +
        b'\x00'
    )

def make_sync_position(player):
    # 0x23 in 1.21.11: entityId (varint) + x,y,z (3 doubles) + dx,dy,dz (3 doubles) + yaw,pitch (2 floats) + onGround (bool)
    return (
        send_varint(player.eid) +
        struct.pack(">ddd", player.x, player.y, player.z) +
        struct.pack(">ddd", 0.0, 0.0, 0.0) +
        struct.pack(">ff", float(player.yaw), float(player.pitch)) +
        b'\x01'
    )

def make_entity_head_rotation(player):
    yaw_byte = int((player.yaw % 360) * 256 // 360) & 0xFF
    return send_varint(player.eid) + struct.pack(">b", yaw_byte)

def make_player_remove(player):
    return send_varint(1) + player.uuid

def make_entity_destroy(player):
    return send_varint(1) + send_varint(player.eid)

def broadcast(packet_id, payload, exclude_player=None):
    pkt = make_packet(packet_id, payload)
    for p in play_clients:
        if p != exclude_player and p.sock:
            try:
                p.sock.sendall(pkt)
            except Exception:
                pass

def build_chunk_data(cx, cz):
    base_y = server_settings["base_height"]
    ttype = server_settings["terrain_type"]
    
    surf_sec_idx = max(0, min(23, (base_y + 64) // 16))
    surf_y_rel = max(0, min(15, (base_y + 64) % 16))
    
    # Pre-build surface section (Grass on top at surf_y_rel, Dirt underneath, Air above)
    surf_data = bytearray(2048)
    long_grass = 0x1111111111111111 # Palette index 1 = Grass
    long_dirt  = 0x2222222222222222 # Palette index 2 = Dirt
    
    for y_rel in range(16):
        if y_rel == surf_y_rel:
            for z in range(16):
                struct.pack_into(">Q", surf_data, (y_rel * 16 + z) * 8, long_grass)
        elif y_rel < surf_y_rel:
            for z in range(16):
                struct.pack_into(">Q", surf_data, (y_rel * 16 + z) * 8, long_dirt)
                
    chunk_sections = bytearray()
    for s_idx in range(24):
        if ttype == "void":
            if s_idx == surf_sec_idx and cx == 0 and cz == 0:
                v_data = bytearray(2048)
                struct.pack_into(">Q", v_data, (surf_y_rel * 16 + 8) * 8, 1 << (8 * 4))
                chunk_sections.extend(struct.pack(">h", 1))
                chunk_sections.append(4)
                chunk_sections.extend(send_varint(2))
                chunk_sections.extend(send_varint(0))
                chunk_sections.extend(send_varint(9))
                chunk_sections.extend(v_data)
            else:
                chunk_sections.extend(struct.pack(">h", 0))
                chunk_sections.append(0)
                chunk_sections.extend(send_varint(0))
        else:
            if s_idx == 0: # Bedrock at bottom Y=-64..-49
                chunk_sections.extend(struct.pack(">h", 4096))
                chunk_sections.append(0) # BPE=0
                chunk_sections.extend(send_varint(85))
            elif s_idx == 1: # Deepslate Y=-48..-33
                chunk_sections.extend(struct.pack(">h", 4096))
                chunk_sections.append(0) # BPE=0
                chunk_sections.extend(send_varint(27722))
            elif s_idx < surf_sec_idx: # Underground Stone / Dirt
                b_type = 10 if (s_idx == surf_sec_idx - 1 and surf_y_rel == 0) else 1
                chunk_sections.extend(struct.pack(">h", 4096))
                chunk_sections.append(0) # BPE=0
                chunk_sections.extend(send_varint(b_type))
            elif s_idx == surf_sec_idx: # Surface Section with Grass + Dirt
                non_air = (surf_y_rel + 1) * 256
                chunk_sections.extend(struct.pack(">h", non_air))
                chunk_sections.append(4) # BPE=4
                chunk_sections.extend(send_varint(3)) # Palette length = 3
                chunk_sections.extend(send_varint(0))  # 0 = Air
                chunk_sections.extend(send_varint(9))  # 1 = Grass
                chunk_sections.extend(send_varint(10)) # 2 = Dirt
                chunk_sections.extend(surf_data)
            else: # Sky Air
                chunk_sections.extend(struct.pack(">h", 0))
                chunk_sections.append(0) # BPE=0
                chunk_sections.extend(send_varint(0))
                
        # Biomes (Plains, BPE=0)
        chunk_sections.append(0)
        chunk_sections.extend(send_varint(1))
        
    # Standard 1.21.11 light with empty masks (0 extra bytes)
    light_data = (
        send_varint(0) + send_varint(0) +
        send_varint(0) + send_varint(0) +
        send_varint(0) + send_varint(0)
    )
    
    return (
        struct.pack(">ii", cx, cz) +
        send_varint(0) + # 0 Heightmaps
        send_varint(len(chunk_sections)) +
        chunk_sections +
        send_varint(0) + # 0 Block Entities
        light_data
    )

def refresh_all_player_chunks():
    for p in play_clients:
        if p.sock:
            p.chunks_to_send = []
            for cx in range(-3, 4):
                for cz in range(-3, 4):
                    p.chunks_to_send.append((cx, cz))
            p.chunks_to_send.sort(key=lambda c: c[0]**2 + c[1]**2)

def handle_mc_client(client_sock, addr, eid):

    print(f"Minecraft 1.21.x connection from {addr}...")
    try:
        client_sock.settimeout(20.0)
        
        # 1. Read Handshake Packet Length
        pkt_len = read_varint(client_sock)
        if not pkt_len:
            client_sock.close()
            return
        
        # Read Packet ID (0x00 for Handshake)
        pkt_id = read_varint(client_sock)
        if pkt_id != 0x00:
            client_sock.close()
            return

        # Handshake payload: Protocol Version (VarInt) + Server Address (String) + Port (Unsigned Short) + Next State (VarInt)
        proto_ver = read_varint(client_sock)
        
        # Read server address length & string
        addr_len = read_varint(client_sock)
        if addr_len:
            client_sock.recv(addr_len)
        port = client_sock.recv(2)
        
        # Next state: 1 = Status Ping, 2 = Login
        next_state = read_varint(client_sock)
        print(f"Handshake ver={proto_ver}, state={next_state}")

        if next_state == 1: # Status / Ping (Server List Multiplayer Screen)
            req_len = read_varint(client_sock)
            req_id = read_varint(client_sock)
            if req_id == 0x00:
                print("Sending 1.21.x Server List JSON Status...")
                json_status = (
                    '{"version":{"name":"1.21.11","protocol":' + str(proto_ver if proto_ver else 767) + '},'
                    '"players":{"max":5,"online":1,"sample":[]},'
                    '"description":{"text":"\\u00a7a\\u26cf \\u00a7lPico W Minecraft 1.21.x Server\\n\\u00a77Custom Procedural Terrain!"}}'
                )
                status_pkt = make_packet(0x00, send_string(json_status))
                client_sock.sendall(status_pkt)
                
                # Check for ping packet payload
                ping_len = read_varint(client_sock)
                if ping_len:
                    ping_id = read_varint(client_sock)
                    payload = client_sock.recv(8)
                    pong_pkt = make_packet(0x01, payload)
                    client_sock.sendall(pong_pkt)
            client_sock.close()
            return

        elif next_state == 2: # Login State
            login_len = read_varint(client_sock)
            login_id = read_varint(client_sock)
            
            username = "Player"
            name_len = read_varint(client_sock)
            if name_len:
                username_bytes = client_sock.recv(name_len)
                username = username_bytes.decode('utf-8', 'ignore')
            # In 1.20.2+, Login Start has 16-byte UUID at the end - discard remaining packet bytes
            rem_login = login_len - 1 - name_len - 1
            if rem_login > 0:
                client_sock.recv(rem_login)
            print(f"Player '{username}' logging into 1.21.x world...")

            # 1. Login Success (Packet ID 0x02 in Login State)
            uuid_bytes = b'\x00\x11\x22\x33\x44\x55\x66\x77\x88\x99\xaa\xbb\xcc\xdd\xee\xff'
            login_success_payload = uuid_bytes + send_string(username) + send_varint(0)
            client_sock.sendall(make_packet(0x02, login_success_payload))
            print("Login Success sent!")

            # 2. Configuration State Event Loop
            client_sock.settimeout(20.0)
            
            # Send all full dynamic registries required for 1.21.11 from a binary file
            # This completely avoids known pack mismatches and "Registry must be non-empty" errors
            try:
                stream_file_safely(client_sock, 'registries.bin', 512)
                print("All full dynamic registries sent from registries.bin!")
            except Exception as e:
                print("Error sending registries.bin:", e)
            
            try:
                stream_file_safely(client_sock, 'tags.bin', 512)
                print("Tags sent from tags.bin!")
            except Exception as e:
                print("Error sending tags.bin:", e)
            
            client_sock.sendall(make_packet(0x03, b''))
            print("Full Registry Data (0x07) & finish_configuration (0x03) sent!")

            # Drain handshake responses until client sends 0x03 (Acknowledge Finish Configuration)
            for _ in range(10):
                c_len = read_varint(client_sock)
                if not c_len:
                    break
                c_data = read_exact(client_sock, c_len)
                c_id = c_data[0] if c_data else 0
                print(f"Config packet 0x{c_id:02x} received (len={c_len})")
                if c_id == 0x03:
                    print("Client acknowledged Finish Configuration -> Entered Play state!")
                    break
                elif c_id == 0x07: # Client selected known packs -> resend finish configuration
                    client_sock.sendall(make_packet(0x03, b''))


            # Determine Protocol-specific Packet IDs
            is_1_21_11 = (proto_ver == 774)
            # IDs for Play state
            pid_login       = 0x30 if is_1_21_11 else 0x2C
            pid_position    = 0x46 if is_1_21_11 else 0x42
            pid_game_state  = 0x26 if is_1_21_11 else 0x23
            pid_batch_start = 0x0c if is_1_21_11 else 0x0d
            pid_chunk       = 0x2c if is_1_21_11 else 0x28
            pid_batch_end   = 0x0b if is_1_21_11 else 0x0c
            pid_keep_alive  = 0x2b if is_1_21_11 else 0x27

            # 4. Login (Play)
            play_login_payload = (
                struct.pack(">i", 1) +                                # Entity ID (4 bytes)
                b'\x00' +                                             # Is Hardcore: false
                send_varint(1) + send_string("minecraft:overworld") + # Dimension Names (array of strings)
                send_varint(5) +                                      # Max Players
                send_varint(8) +                                      # View Distance
                send_varint(8) +                                      # Simulation Distance
                b'\x00' +                                             # Reduced Debug Info: false
                b'\x01' +                                             # Enable Respawn Screen: true
                b'\x00' +                                             # Do Limited Crafting: false
                send_varint(0) +                                      # Dimension Type ID: 0 (Overworld)
                send_string("minecraft:overworld") +                  # Dimension Name
                struct.pack(">q", 12345) +                            # Hashed Seed (8 bytes)
                b'\x01' +                                             # Game Mode: Creative (1)
                b'\xFF' +                                             # Previous Game Mode: None (-1)
                b'\x00' +                                             # Is Debug: false
                b'\x01' +                                             # Is Flat: true
                b'\x00' +                                             # Has Death Location: false
                send_varint(0) +                                      # Portal Cooldown: 0
                send_varint(63) +                                     # Sea Level: 63 (Added in 1.21.2+)
                b'\x00'                                               # Enforces Secure Chat: false
            )
            client_sock.sendall(make_packet(pid_login, play_login_payload))
            print(f"Play Login packet (0x{pid_login:02X}) sent successfully!")

            # 5. Synchronize Player Position
            pos_payload = (
                send_varint(1) +
                struct.pack(">ddd", 8.0, float(server_settings["base_height"]) + 2.0, 8.0) +
                struct.pack(">ddd", 0.0, 0.0, 0.0) +
                struct.pack(">ff", 0.0, 0.0) +
                struct.pack(">i", 0)
            )
            client_sock.sendall(make_packet(pid_position, pos_payload))
            print(f"Player position teleported to (8, 16, 8) with ID 0x{pid_position:02X}!")

            # 6. Signal Game State Change: Start Waiting for Level Chunks
            client_sock.sendall(make_packet(pid_game_state, b'\x0d\x00\x00\x00\x00'))

            # 7. Chunk Batch Start (Disabled to prevent chunk_batch_received encoding crash)
            # client_sock.sendall(make_packet(pid_batch_start, b''))

            # 8. Stream Chunk Data (16x16 chunks = 256x256 blocks)
            # Center the view on 0, 0
            client_sock.sendall(make_packet(0x5C, send_varint(0) + send_varint(0)))
            print("Update View Position (0x5C) sent!")
            
            client_sock.sendall(make_packet(0x5D, send_varint(8)))
            print("Update View Distance (0x5D) sent!")
            
            nbt_heightmaps = send_varint(0) if is_1_21_11 else b'\x0A\x00'
            
            light_data = (
                send_varint(0) + send_varint(0) +
                send_varint(0) + send_varint(0) +
                send_varint(0) + send_varint(0)
            )

            print("Starting chunk streaming loop...")
            
            # 9. Night Vision Effect
            effect_payload = (
                send_varint(1) +        # Entity ID 1
                send_varint(16) +       # Effect ID (16 = Night Vision in 1.20+)
                send_varint(1) +        # Amplifier 1
                send_varint(999999) +   # Duration
                b'\x00'                 # Flags: no particles
            )
            client_sock.sendall(make_packet(0x82, effect_payload)) # 0x82 is entity_effect
            print("Night Vision effect sent!")

            # Prepare list of chunks to generate dynamically
            # Sort chunks by distance to player (0,0) so the center loads first!
            chunks_to_send = []
            for cx in range(-8, 8):
                for cz in range(-8, 8):
                    chunks_to_send.append((cx, cz))
            chunks_to_send.sort(key=lambda c: c[0]**2 + c[1]**2)


            client_sock.settimeout(0.01)
            player = Player(client_sock, addr, eid)
            
            # Send all current placed blocks to the new player
            for (bx, by, bz), b_state in list(world_blocks.items()):
                try:
                    client_sock.sendall(make_block_change(bx, by, bz, b_state))
                except:
                    pass
            
            # Queue chunks in distance order (7x7 radius = 49 chunks)
            for cx in range(-3, 4):
                for cz in range(-3, 4):
                    player.chunks_to_send.append((cx, cz))
            player.chunks_to_send.sort(key=lambda c: c[0]**2 + c[1]**2)
            
            print(f"Player {player.name} finished config. Entering Play mode!")
            return player
    except Exception as e:
        print(f"Login error with {addr}:", e)
        try:
            client_sock.close()
        except:
            pass
        return None

def tick_player(player):
    if player.is_bot:
        return True
        
    now_t = time.time()
    
    pid_keep_alive = 0x2B
    pid_chunk = 0x2C
    pid_sync_pos = 0x23
    pid_head_rot = 0x51
    
    if now_t - player.last_keep_alive >= 5.0:
        player.last_keep_alive = now_t
        keep_alive_payload = struct.pack(">q", 1609459200000)
        try:
            player.sock.sendall(make_packet(pid_keep_alive, keep_alive_payload))
        except Exception as e:
            if not is_socket_timeout(e):
                return False
            
    # Send 1 chunk at a controlled 80ms interval
    if player.chunks_to_send and (now_t - player.last_chunk_time) >= 0.08:
        player.last_chunk_time = now_t
        cx, cz = player.chunks_to_send.pop(0)
        try:
            chunk_payload = build_chunk_data(cx, cz)
            player.sock.sendall(make_packet(pid_chunk, chunk_payload))
            set_led(not get_led())
        except Exception:
            player.chunks_to_send.insert(0, (cx, cz))
        
    try:
        while True:
            p_len = read_varint(player.sock)
            if p_len is None or p_len <= 0:
                break
                
            p_id = read_varint(player.sock)
            if p_id is None:
                break
                
            def varint_size(val):
                if val == 0: return 1
                count = 0
                while val != 0:
                    val >>= 7
                    count += 1
                return count
            
            id_size = varint_size(p_id)
            data_len = p_len - id_size
            
            payload = b''
            if data_len > 0:
                payload = read_exact(player.sock, data_len)
                if not payload or len(payload) < data_len:
                    break
                    
            moved = False
            
            # Movement Packets
            if p_id == 0x1D and len(payload) >= 24: # position
                player.x, player.y, player.z = struct.unpack(">ddd", payload[:24])
                moved = True
            elif p_id == 0x1E and len(payload) >= 32: # position_look
                player.x, player.y, player.z, player.yaw, player.pitch = struct.unpack(">dddff", payload[:32])
                moved = True
            elif p_id == 0x1F and len(payload) >= 8: # look
                player.yaw, player.pitch = struct.unpack(">ff", payload[:8])
                moved = True
            elif p_id == 0x34 and len(payload) >= 2: # held_item_slot
                slot = struct.unpack(">h", payload[:2])[0]
                player.held_slot = slot
                inv_slot = 36 + slot
                if inv_slot in player.inventory:
                    player.held_item = player.inventory[inv_slot]
                elif slot in player.inventory:
                    player.held_item = player.inventory[slot]
            elif p_id == 0x37: # set_creative_slot
                s_num, i_num = parse_creative_slot(payload)
                if s_num is not None:
                    player.inventory[s_num] = i_num
                    if s_num == (36 + player.held_slot) or s_num == player.held_slot:
                        player.held_item = i_num
            elif p_id == 0x28: # block_dig
                set_led(not get_led())
                if len(payload) >= 9:
                    status = payload[0]
                    pos_val = struct.unpack(">Q", payload[1:9])[0]
                    bx, by, bz = decode_position(pos_val)
                    if status in (0, 2):
                        set_block(bx, by, bz, 0)
            elif p_id == 0x3F: # block_place / interact
                set_led(not get_led())
                if len(payload) >= 9:
                    pos_val = struct.unpack(">Q", payload[1:9])[0]
                    bx, by, bz = decode_position(pos_val)
                    curr_block = get_block(bx, by, bz)
                    
                    dir_val = payload[9] if len(payload) > 9 else 1
                    offsets = [(0,-1,0), (0,1,0), (0,0,-1), (0,0,1), (-1,0,0), (1,0,0)]
                    ox, oy, oz = offsets[dir_val] if dir_val < len(offsets) else (0, 1, 0)
                    
                    if 6570 <= curr_block <= 6593: # Lever
                        new_b = 6580 if curr_block == 6579 else 6579
                        set_block(bx, by, bz, new_b)
                    elif curr_block in (5465, 5466): # Door
                        new_b = 5466 if curr_block == 5465 else 5465
                        set_block(bx, by, bz, new_b)
                    elif curr_block == 2141: # TNT
                        set_block(bx, by, bz, 0)
                    else:
                        place_x, place_y, place_z = bx + ox, by + oy, bz + oz
                        
                        item = player.held_item or server_settings["primary_block"]
                        b_state = ITEM_TO_BLOCK.get(item, item)
                        
                        if b_state == 2045: # Sticky Piston
                            b_state = get_piston_state_from_placement(dir_val, player.pitch, player.yaw, sticky=True)
                        elif b_state == 2067: # Regular Piston
                            b_state = get_piston_state_from_placement(dir_val, player.pitch, player.yaw, sticky=False)
                            
                        set_block(place_x, place_y, place_z, b_state)
                
            if moved:
                new_cx = int(player.x) >> 4
                new_cz = int(player.z) >> 4
                if new_cx != player.last_chunk_x or new_cz != player.last_chunk_z:
                    player.last_chunk_x = new_cx
                    player.last_chunk_z = new_cz
                    try:
                        player.sock.sendall(make_packet(0x5C, send_varint(new_cx) + send_varint(new_cz)))
                    except: pass
                
                broadcast(pid_sync_pos, make_sync_position(player), exclude_player=player)
                broadcast(pid_head_rot, make_entity_head_rotation(player), exclude_player=player)
    except Exception as ex:
        if not is_socket_timeout(ex):
            return False
            
    return True

# ==========================================
# Simple Clean HTML Web UI with Real Control Panels
# ==========================================
def render_checkboxes(pct, count=10):
    filled = int(round((pct / 100.0) * count))
    filled = max(0, min(count, filled))
    boxes = "".join([f'<input type="checkbox" {"checked" if i < filled else ""} disabled style="pointer-events:none;margin:0 1px;">' for i in range(count)])
    return boxes

def handle_web_request(client):
    try:
        client.settimeout(2.0)
        req = client.recv(2048).decode('utf-8', 'ignore')
        
        # Check for Eaglercraft WebSocket upgrade
        if "Upgrade: websocket" in req or "upgrade: websocket" in req:
            key = ""
            for line in req.split("\r\n"):
                if line.lower().startswith("sec-websocket-key:"):
                    key = line.split(":")[1].strip()
                    break
            if key:
                accept_key = make_ws_accept(key)
                ws_resp = (
                    "HTTP/1.1 101 Switching Protocols\r\n"
                    "Upgrade: websocket\r\n"
                    "Connection: Upgrade\r\n"
                    f"Sec-WebSocket-Accept: {accept_key}\r\n\r\n"
                )
                client.sendall(ws_resp.encode('utf-8'))
                print("Eaglercraft WebSocket connection upgraded!")
                return
        
        # Handle Settings and Commands
        if "POST /set" in req or "GET /set?" in req:
            # 1. Place Block at exact Coord
            if "place_coord=1" in req:
                try:
                    px = int(req.split("px=")[1].split("&")[0].split(" ")[0])
                    py = int(req.split("py=")[1].split("&")[0].split(" ")[0])
                    pz = int(req.split("pz=")[1].split("&")[0].split(" ")[0])
                    blk = int(req.split("block=")[1].split("&")[0].split(" ")[0])
                    set_block(px, py, pz, blk)
                    broadcast_chat(f"[WebAdmin] Placed block {blk} at ({px}, {py}, {pz})")
                except Exception as e:
                    print("Place coord error:", e)
                    
            # 2. Spawn Working Redstone Circuit Preset
            if "spawn_circuit=1" in req:
                base_y = float(server_settings["base_height"])
                cx, cy, cz = 8, int(base_y) + 1, 8
                for p in play_clients:
                    if not p.is_bot:
                        cx, cy, cz = int(p.x) + 1, int(p.y), int(p.z)
                        break
                # Place Redstone Block -> 3 Wires -> Sticky Piston Up
                set_block(cx, cy, cz, REDSTONE_BLOCK)
                set_block(cx + 1, cy, cz, 4970)
                set_block(cx + 2, cy, cz, 4970)
                set_block(cx + 3, cy, cz, 4970)
                set_block(cx + 4, cy, cz, 2045)
                broadcast_chat(f"[WebAdmin] Spawned live Redstone circuit at ({cx}, {cy}, {cz})!")
                
            # 3. Spawn / Remove Fake Player (Bot)
            if "spawn_bot=1" in req:
                bot_name = "Steve_Bot"
                if "bot_name=" in req:
                    try:
                        bot_name = req.split("bot_name=")[1].split("&")[0].split(" ")[0].replace("+", "_")
                    except: pass
                spawn_fake_player(bot_name)
            if "remove_bots=1" in req:
                remove_all_fake_players()
                
            # 4. Standard settings
            if "terrain=" in req:
                for t in ("flat", "aether", "mountains", "layered", "void"):
                    if f"terrain={t}" in req: server_settings["terrain_type"] = t
            if "block=" in req and "place_coord" not in req:
                for b_val in (1, 9, 10, 85, 118, 2137, 5108, 3168, 27722, 9278, 11109, 2141, 6579, 6684, 2045, 2067, 4970, 723, 722, 717, 719, 718, 747, 732, 746):
                    if f"block={b_val}" in req:
                        server_settings["primary_block"] = b_val
                        for p in play_clients: p.held_item = b_val
            if "height=" in req:
                try:
                    h = int(req.split("height=")[1].split("&")[0].split(" ")[0])
                    server_settings["base_height"] = max(16, min(128, h))
                except: pass
            if "redstone=" in req:
                server_settings["redstone_enabled"] = ("redstone=1" in req or "redstone=on" in req)
            if "regen=1" in req:
                world_blocks.clear()
                refresh_all_player_chunks()
                broadcast_chat("[Server] Terrain regenerated!")
            if "msg=" in req:
                try:
                    msg = req.split("msg=")[1].split("&")[0].split(" ")[0].replace("+", " ")
                    broadcast_chat(f"[WebAdmin] {msg}")
                except: pass
            if "tp_all=1" in req:
                base_y = float(server_settings["base_height"])
                for p in play_clients:
                    if p.sock:
                        p.x, p.y, p.z = 8.0, base_y + 2.0, 8.0
                        broadcast(0x23, make_sync_position(p))
                broadcast_chat("[Server] Teleported all to spawn!")
            if "led=toggle" in req:
                set_led(not get_led())
                
        # Live JSON API
        if "GET /api/status" in req:
            alloc, free, total, pct = get_mem_stats()
            rssi = get_wifi_rssi()
            wifi_pct = max(0, min(100, int((rssi + 100) * 2)))
            temp = get_pico_temp()
            temp_pct = max(0, min(100, int((temp / 70.0) * 100)))
            uptime_s = int(time.time() - start_server_time)
            hrs = uptime_s // 3600
            mins = (uptime_s % 3600) // 60
            secs = uptime_s % 60
            p_names = ", ".join([p.name for p in play_clients]) or "None"
            
            data = (
                f'{{"uptime":"{hrs:02d}:{mins:02d}:{secs:02d}",'
                f'"players":{len(play_clients)},'
                f'"player_names":"{p_names}",'
                f'"ram_used":{alloc//1024},'
                f'"ram_total":{total//1024},'
                f'"ram_pct":{pct},'
                f'"temp":{temp},'
                f'"temp_pct":{temp_pct},'
                f'"rssi":{rssi},'
                f'"wifi_pct":{wifi_pct}}}'
            )
            resp = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n" + data
            client.sendall(resp.encode('utf-8'))
            client.close()
            return
            
        alloc, free, total, pct = get_mem_stats()
        rssi = get_wifi_rssi()
        wifi_pct = max(0, min(100, int((rssi + 100) * 2)))
        temp = get_pico_temp()
        temp_pct = max(0, min(100, int((temp / 70.0) * 100)))
        
        uptime_s = int(time.time() - start_server_time)
        hrs = uptime_s // 3600
        mins = (uptime_s % 3600) // 60
        secs = uptime_s % 60
        curr_ip = wlan.ifconfig()[0] if (wlan and wlan.isconnected()) else "0.0.0.0"
        p_list = ", ".join([p.name for p in play_clients]) or "None"
        
        def_x, def_y, def_z = 8, int(server_settings["base_height"]) + 1, 8
        for p in play_clients:
            if not p.is_bot:
                def_x, def_y, def_z = int(p.x), int(p.y), int(p.z)
                break
                
        html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Pico W Minecraft & Eaglercraft</title>
<style>
body {{ background: #000; color: #fff; font-family: sans-serif; padding: 15px; margin: 0; max-width: 480px; margin: auto; }}
.card {{ background: #111; border: 1px solid #333; border-radius: 4px; padding: 10px; margin-bottom: 10px; }}
.row {{ display: flex; justify-content: space-between; align-items: center; margin: 4px 0; font-size: 13px; }}
button, a.btn {{ background: #222; color: #fff; border: 1px solid #444; border-radius: 3px; padding: 4px 8px; text-decoration: none; cursor: pointer; display: inline-block; font-size: 12px; }}
button:hover, a.btn:hover {{ background: #333; }}
select, input[type=number], input[type=text] {{ background: #222; color: #fff; border: 1px solid #444; border-radius: 3px; padding: 3px; font-size: 12px; }}
</style>
</head>
<body>
<h3>Pico W Minecraft & Eaglercraft</h3>

<div class="card">
<b>Status</b>
<div class="row"><span>RAM:</span> <span id="r_box">{render_checkboxes(pct)}</span> <span id="r_txt">{pct}% ({alloc//1024}/{total//1024}K)</span></div>
<div class="row"><span>CPU Temp:</span> <span id="t_box">{render_checkboxes(temp_pct)}</span> <span id="t_txt">{temp}&deg;C</span></div>
<div class="row"><span>Wi-Fi:</span> <span id="w_box">{render_checkboxes(wifi_pct)}</span> <span id="w_txt">{rssi} dBm</span></div>
<div class="row"><span>Uptime:</span> <span id="u_txt">{hrs:02d}:{mins:02d}:{secs:02d}</span> <span>Players: <span id="p_txt">{len(play_clients)}/5 ({p_list})</span></span></div>
</div>

<div class="card">
<b>Place Block at Coordinate</b>
<form method="GET" action="/set" style="margin-top:8px;">
<input type="hidden" name="place_coord" value="1">
<div class="row">
  <span>Coord (X, Y, Z):</span>
  <span>
    <input type="number" name="px" value="{def_x}" style="width:40px;">
    <input type="number" name="py" value="{def_y}" style="width:40px;">
    <input type="number" name="pz" value="{def_z}" style="width:40px;">
  </span>
</div>
<div class="row">
  <span>Block:</span>
  <select name="block">
    <option value="11109">Redstone Block</option>
    <option value="4970">Redstone Wire</option>
    <option value="2045">Sticky Piston (Up)</option>
    <option value="2067">Regular Piston (Up)</option>
    <option value="6684">Redstone Torch</option>
    <option value="9278">Redstone Lamp</option>
    <option value="6580">Lever (Active)</option>
    <option value="2141">TNT</option>
    <option value="5108">Diamond Block</option>
    <option value="1">Stone</option>
    <option value="0">Air (Break)</option>
  </select>
</div>
<div style="margin-top:8px;">
  <button type="submit">Place Block</button>
  <a href="/set?spawn_circuit=1" class="btn">Spawn Circuit Preset</a>
</div>
</form>
</div>

<div class="card">
<b>Bots & Players</b>
<div style="margin-top:8px;">
  <a href="/set?spawn_bot=1&bot_name=Steve_Bot" class="btn">+ Spawn Fake Player</a>
  <a href="/set?remove_bots=1" class="btn">- Remove Bots</a>
  <a href="/set?tp_all=1" class="btn">Teleport All to Spawn</a>
</div>
</div>

<div class="card">
<b>World Settings</b>
<form method="GET" action="/set" style="margin-top:8px;">
<div class="row"><span>Terrain:</span>
<select name="terrain">
  <option value="flat" {"selected" if server_settings["terrain_type"]=="flat" else ""}>Flat World</option>
  <option value="aether" {"selected" if server_settings["terrain_type"]=="aether" else ""}>Aether Floating Islands</option>
  <option value="mountains" {"selected" if server_settings["terrain_type"]=="mountains" else ""}>Mountains & Valleys</option>
  <option value="layered" {"selected" if server_settings["terrain_type"]=="layered" else ""}>Layered Superflat</option>
  <option value="void" {"selected" if server_settings["terrain_type"]=="void" else ""}>Void Island</option>
</select>
</div>
<div class="row"><span>Base Height:</span> <input type="number" name="height" value="{server_settings["base_height"]}" min="16" max="128" style="width:45px;"></div>
<div style="margin-top:8px;">
<button type="submit">Save</button>
<a href="/set?regen=1" class="btn" onclick="return confirm('Regenerate world?');">Regenerate World</a>
</div>
</form>
</div>

<div class="card">
<b>Broadcast Chat</b>
<form method="GET" action="/set" style="margin-top:8px;">
<input type="text" name="msg" placeholder="Broadcast message..." style="width:65%;">
<button type="submit">Send</button>
</form>
</div>

<div style="font-size:11px;color:#888;">
Java IP: {curr_ip}:25565<br>
Eaglercraft WS: ws://{curr_ip}/
</div>

<script>
function renderBoxes(pct, count=10) {{
  var f = Math.min(count, Math.max(0, Math.round((pct / 100) * count)));
  var s = '';
  for (var i = 0; i < count; i++) {{
    s += '<input type="checkbox" ' + (i < f ? 'checked ' : '') + 'disabled style="pointer-events:none;margin:0 1px;">';
  }}
  return s;
}}

setInterval(function() {{
  fetch('/api/status').then(function(r) {{ return r.json(); }}).then(function(d) {{
    document.getElementById('r_box').innerHTML = renderBoxes(d.ram_pct);
    document.getElementById('r_txt').innerText = d.ram_pct + '% (' + d.ram_used + '/' + d.ram_total + 'K)';
    document.getElementById('t_box').innerHTML = renderBoxes(d.temp_pct);
    document.getElementById('t_txt').innerText = d.temp + '°C';
    document.getElementById('w_box').innerHTML = renderBoxes(d.wifi_pct);
    document.getElementById('w_txt').innerText = d.rssi + ' dBm';
    document.getElementById('u_txt').innerText = d.uptime;
    document.getElementById('p_txt').innerText = d.players + '/5 (' + d.player_names + ')';
  }}).catch(function() {{}});
}}, 1000);
</script>
</body>
</html>"""
        
        resp = f"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {len(html.encode('utf-8'))}\r\nConnection: close\r\n\r\n{html}"
        client.sendall(resp.encode('utf-8'))
        client.close()
    except Exception as e:
        try: client.close()
        except: pass

# ==========================================
# Main Server Loop
# ==========================================
while True:
    now = time.time()
    
    is_conn = False
    if wlan:
        try:
            is_conn = wlan.isconnected()
        except Exception:
            pass

    if not is_conn:
        set_led(True)
        if now - last_reconnect_time >= 5.0:
            last_reconnect_time = now
            print("Re-attempting WiFi connection...")
            if connect_wifi_loop():
                setup_sockets()
    else:
        if now - last_blink_time >= 0.2:
            set_led(not get_led())
            last_blink_time = now

    if not mc_sock or not web_sock:
        setup_sockets()
        time.sleep(0.1)
        continue

    r = []
    read_socks = [web_sock, mc_sock]
    for p in play_clients:
        if p.sock: read_socks.append(p.sock)
        
    if select:
        try:
            r, _, _ = select.select(read_socks, [], [], 0.02)
        except Exception:
            r = []
    else:
        r = read_socks

    for s in r:
        if s == web_sock:
            try:
                http_client, addr = web_sock.accept()
                handle_web_request(http_client)
            except Exception:
                pass
        elif s == mc_sock:
            try:
                client_sock, addr = mc_sock.accept()
                p = handle_mc_client(client_sock, addr, next_eid)
                if p:
                    next_eid += 1
                    play_clients.append(p)
                    
                    pid_player_info = 0x44 # 1.21.11 Player Info
                    pid_spawn_entity = 0x01 # 1.21.11 Spawn Entity
                    
                    # 1. Inform existing players about the new player & spawn their entity
                    broadcast(pid_player_info, make_player_info(p), exclude_player=p)
                    broadcast(pid_spawn_entity, make_spawn_entity(p), exclude_player=p)
                    
                    # 2. Inform the new player about all existing players & bots
                    for other in play_clients:
                        if other != p:
                            try:
                                p.sock.sendall(make_packet(pid_player_info, make_player_info(other)))
                                p.sock.sendall(make_packet(pid_spawn_entity, make_spawn_entity(other)))
                            except Exception:
                                pass
            except Exception as e:
                print("Accept error:", e)

    to_remove = []
    for p in play_clients:
        if not tick_player(p):
            to_remove.append(p)
            
    for p in to_remove:
        print(f"Player {p.name} disconnected.")
        play_clients.remove(p)
        if p.sock:
            try:
                p.sock.close()
            except:
                pass
            
        pid_player_remove = 0x43
        pid_entity_destroy = 0x4B
        broadcast(pid_player_remove, make_player_remove(p))
        broadcast(pid_entity_destroy, make_entity_destroy(p))
