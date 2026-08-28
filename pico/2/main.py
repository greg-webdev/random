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
        <h1>⛏️ Pico Minecraft 1.21.x</h1>
        <div class="badge">● ONLINE & READY</div>
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

def handle_mc_client(client_sock, addr):
    print(f"Minecraft 1.21.x connection from {addr}...")
    try:
        client_sock.settimeout(3.0)
        
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
            client_sock.settimeout(3.0)
            
            # Send all full dynamic registries required for 1.21.11 from a binary file
            # This completely avoids known pack mismatches and "Registry must be non-empty" errors
            try:
                with open('registries.bin', 'rb') as f:
                    while True:
                        chunk = f.read(1024)
                        if not chunk:
                            break
                        client_sock.sendall(chunk)
                print("All full dynamic registries sent from registries.bin!")
            except Exception as e:
                print("Error sending registries.bin:", e)
            
            try:
                with open('tags.bin', 'rb') as f:
                    while True:
                        chunk = f.read(1024)
                        if not chunk:
                            break
                        client_sock.sendall(chunk)
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
                send_varint(2) +                                      # View Distance
                send_varint(2) +                                      # Simulation Distance
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
                struct.pack(">ddd", 8.0, 16.0, 8.0) +
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
            
            # Precompute the empty light masks
            empty_light_mask = send_varint(1) + struct.pack(">q", 0x3FFFFFF)
            light_data = (
                send_varint(0) + send_varint(0) +
                empty_light_mask + empty_light_mask +
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

            # 7. Keep Player Session Alive
            client_sock.settimeout(0.05)
            last_keep_alive = time.time()
            keep_alive_id = 1609459200000
            
            while True:
                now_t = time.time()
                # Send Keep Alive every 5 seconds
                if now_t - last_keep_alive >= 5.0:
                    last_keep_alive = now_t
                    keep_alive_payload = struct.pack(">q", keep_alive_id)
                    client_sock.settimeout(5.0)
                    client_sock.sendall(make_packet(pid_keep_alive, keep_alive_payload))
                    client_sock.settimeout(0.05)

                # Send up to 2 chunks per tick to prevent TCP buffer overflow (ECONNRESET)
                chunks_sent_this_tick = 0
                while chunks_to_send and chunks_sent_this_tick < 2:
                    cx, cz = chunks_to_send.pop(0)
                    
                    chunk_sections = bytearray()
                    
                    # Optimized Math for Aether Islands
                    z_masks = [math.cos((cz * 16 + z) * 0.03) for z in range(16)]
                    z_details = [math.cos((cz * 16 + z) * 0.1) * 3.0 for z in range(16)]
                    x_masks = [math.sin((cx * 16 + x) * 0.03) for x in range(16)]
                    x_details = [math.sin((cx * 16 + x) * 0.1) for x in range(16)]
                    
                    bottoms = [0]*256
                    tops = [-1]*256
                    has_blocks = False
                    for z in range(16):
                        zm = z_masks[z]
                        zd = z_details[z]
                        for x in range(16):
                            mask = x_masks[x] * zm
                            if mask >= 0.2:
                                thickness = (mask - 0.2) * 20.0
                                detail = x_details[x] * zd
                                bot = max(0, int(8 - thickness + detail))
                                top = min(15, int(8 + thickness + detail))
                                bottoms[z*16+x] = bot
                                tops[z*16+x] = top
                                has_blocks = True
                                
                    for s_idx in range(24):
                        if s_idx == 4 and has_blocks:  # Y=0..15 with blocks
                            data_array = bytearray(2048)
                            non_air_count = 0
                            
                            for y in range(16):
                                for z in range(16):
                                    long_val = 0
                                    for x in range(16):
                                        col_idx = z*16 + x
                                        if bottoms[col_idx] <= y <= tops[col_idx]:
                                            long_val |= (1 << (x * 4))
                                            non_air_count += 1
                                    if long_val != 0:
                                        idx = (y * 16 + z) * 8
                                        struct.pack_into(">Q", data_array, idx, long_val)
                                    
                            if non_air_count > 0:
                                chunk_sections.extend(struct.pack(">h", non_air_count))
                                # Block States (BPE=4)
                                chunk_sections.append(4)
                                chunk_sections.extend(send_varint(2))
                                chunk_sections.extend(send_varint(0))
                                chunk_sections.extend(send_varint(1))
                                # Data Array Length is NO LONGER SENT in modern Minecraft! The client calculates it automatically.
                                chunk_sections.extend(data_array)
                                
                                # Biomes (Single-valued)
                                chunk_sections.append(0)
                                chunk_sections.extend(send_varint(1))
                            else:
                                chunk_sections.extend(struct.pack(">h", 0))
                                chunk_sections.append(0)
                                chunk_sections.extend(send_varint(0))
                                chunk_sections.append(0)
                                chunk_sections.extend(send_varint(1))
                        else:
                            # Empty Air Section
                            chunk_sections.extend(struct.pack(">h", 0))
                            chunk_sections.append(0)
                            chunk_sections.extend(send_varint(0))
                            chunk_sections.append(0)
                            chunk_sections.extend(send_varint(1))

                    chunk_payload = (
                        struct.pack(">ii", cx, cz) +
                        nbt_heightmaps +
                        send_varint(len(chunk_sections)) +
                        chunk_sections +
                        send_varint(0) +  # 0 Block Entities
                        light_data
                    )
                    # Increase timeout to 5 seconds so sending a 2KB chunk packet over WiFi doesn't time out
                    client_sock.settimeout(5.0)
                    client_sock.sendall(make_packet(pid_chunk, chunk_payload))
                    client_sock.settimeout(0.05)
                    
                    chunks_sent_this_tick += 1

                try:
                    p_len = read_varint(client_sock)
                    if p_len is None:
                        print(f"Client {addr} disconnected.")
                        break
                    if p_len > 0:
                        # Read packet ID and calculate its byte size
                        old_buf = client_sock.recv(1, socket.MSG_PEEK) if hasattr(socket, 'MSG_PEEK') else None
                        
                        # read_varint consumes the bytes
                        p_id = read_varint(client_sock)
                        
                        # In micropython, we don't easily know how many bytes read_varint consumed.
                        # But wait, we can just calculate it!
                        def varint_size(val):
                            if val == 0: return 1
                            count = 0
                            while val != 0:
                                val >>= 7
                                count += 1
                            return count
                        
                        id_size = varint_size(p_id)
                        data_len = p_len - id_size
                        
                        if data_len > 0:
                            # Safely read exactly the remaining payload to keep the stream aligned
                            read_exact(client_sock, data_len)
                except Exception as ex:
                    # Timeout is normal in non-blocking reads; socket error means disconnected
                    err_str = str(ex)
                    if "ETIMEDOUT" not in err_str and "timed out" not in err_str:
                        break
                time.sleep(0.05)

    except Exception as e:
        print(f"Client stream error with {addr}:", e)
    finally:
        try:
            client_sock.close()
        except Exception:
            pass

# Main Loop
while True:
    now = time.time()

    # Connection Check & Reconnect Loop
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

    # Non-blocking IO with select
    r = []
    if select:
        try:
            r, _, _ = select.select([web_sock, mc_sock], [], [], 0.05)
        except Exception:
            r = []
    else:
        r = [web_sock, mc_sock]

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
                handle_mc_client(client_sock, addr)
            except Exception as e:
                print("Accept error:", e)
