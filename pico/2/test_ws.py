import hashlib, binascii, struct

def make_ws_accept(key):
    guid = b"258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
    sha = hashlib.sha1(key.encode('utf-8') + guid).digest()
    return binascii.b2a_base64(sha).decode('utf-8').strip()

def make_ws_frame(payload):
    length = len(payload)
    if length <= 125:
        header = bytes([0x82, length])
    elif length <= 65535:
        header = bytes([0x82, 126]) + struct.pack(">H", length)
    else:
        header = bytes([0x82, 127]) + struct.pack(">Q", length)
    return header + payload

def parse_ws_frame(data):
    if len(data) < 6: return None, data
    b1 = data[0]
    b2 = data[1]
    masked = bool(b2 & 0x80)
    payload_len = b2 & 0x7F
    offset = 2
    if payload_len == 126:
        if len(data) < 8: return None, data
        payload_len = struct.unpack(">H", data[2:4])[0]
        offset = 4
    elif payload_len == 127:
        if len(data) < 14: return None, data
        payload_len = struct.unpack(">Q", data[2:10])[0]
        offset = 10
        
    if masked:
        if len(data) < offset + 4 + payload_len:
            return None, data
        mask = data[offset:offset+4]
        offset += 4
        raw = data[offset:offset+payload_len]
        unmasked = bytearray(payload_len)
        for i in range(payload_len):
            unmasked[i] = raw[i] ^ mask[i % 4]
        remaining = data[offset+payload_len:]
        return bytes(unmasked), remaining
    else:
        if len(data) < offset + payload_len:
            return None, data
        payload = data[offset:offset+payload_len]
        remaining = data[offset+payload_len:]
        return payload, remaining

# Test accept key
test_key = "dGhlIHNhbXBsZSBub25jZQ=="
print("Accept key:", make_ws_accept(test_key))
