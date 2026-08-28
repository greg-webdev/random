## 💡 LED Status Indicators

| Status | LED Behavior |
|--------|--------------|
| **Connecting to WiFi** | Blinking slowly (~2s interval) |
| **Connected to WiFi** | Blinking rapidly (0.2s interval) |
| **Not Found / Disconnected** | **Steady ON** |

---

## 📡 WiFi Networks Supported

The server uses CircuitPython's `wifi` & `socketpool` modules and automatically connects to:
1. `potato` (Password: `aaaaaaaa`)
2. `dont use this 2.4` (Open / No password)

---

## 🏔️ Custom Terrain Features

The MicroPython server includes an optimized multi-octave sinusoidal terrain generator with:
- **Procedural Height Map**: Dynamic rolling green hills, valleys, and deep stone layers.
- **Custom Strata & Bedrock**: Bedrock bottom layer (`y=0`), Stone core layer, Dirt buffer layer, and Grass surface tops.
- **Sky Cloud Structures**: Floating cloud blocks generated at `y=80`.
- **Pre-compressed World Streaming**: Compress and stream custom chunks over WiFi using `zlib` to fit into Pico W RAM.

---

## 🔌 Hardware Setup & Installation

1. Install **MicroPython** (with WLAN & zlib modules) onto your Raspberry Pi Pico W.
2. Copy [`main.py`](file:///c:/Users/geg/Documents/random/pico/2/main.py) onto the Pico W root directory (using Thonny, `ampy`, or `rshell`).
3. Power on the Pico W.

---

## 🎮 How to Join the Server

1. Connect your computer/device to the same WiFi network (`potato (5g)` or `dont use this 2.4`).
2. Open **ClassiCube** or any **Minecraft Classic (v0.30 / Protocol v7)** client.
3. Open Direct Connect / Multi-player and enter:
   - **IP Address**: *(Displayed on Pico W serial console)* e.g. `192.168.1.xxx`
   - **Port**: `25565`
4. Join and explore your custom Pico W terrain!
