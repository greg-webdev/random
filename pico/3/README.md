# 🏛️ The Library of Babel USB • Raspberry Pi Pico 2020

An algorithmic, deterministic implementation of Jorge Luis Borges' **Library of Babel** running on a **Raspberry Pi Pico (RP2040, 2020)**.

Inspired by Borges' 1941 short story and the viral "infinite USB drive" concept, this device turns the Pico into a physical portal to an infinite universe containing every possible combination of 42 characters (every book ever written, every secret, every thought, and infinite noise).

---

## ⚡ Two Modes Available

### 🌟 Mode 1: True Infinite Virtual FAT32 USB Drive (`babel_infinite_usb.uf2`)
A compiled native C / TinyUSB firmware running directly on the RP2040 chip:
- **Mass Storage Device**: Reports as a 2 Gigabyte flash drive named **`BABEL_USB`** in Windows Explorer.
- **Infinite Folder Hierarchy**:
  - The root directory contains folders `0` through `7`, `README.TXT`, and `EXPLORE.HTM`.
  - Every folder contains subfolders `0` through `7` and `PAGE.TXT`.
  - You can navigate 10, 20, 50, 100 levels deep into folders inside folders inside folders:
    `BABEL_USB > 3 > 7 > 2 > 0 > 5 > 1 > 4 > 6 > 2 > 7 ...`
  - Every time you open `PAGE.TXT` in Windows Notepad, the Pico synthesizes the authentic 40 lines of 80 characters of the Library of Babel page calculated on-the-fly for that exact path!
  - Uses 0 bytes of physical flash — 100% procedurally synthesized in RAM!

### 💻 Mode 2: CircuitPython + Interactive Web Terminal Portal
- The CircuitPython setup with `index.html` (3D hexagonal animated chamber reader, Web Audio ambient synth, and WebSerial connection) and `code.py` running on `CIRCUITPY` (`E:\`).

---

## 🚀 How to Flash the True Infinite USB Drive

1. The compiled firmware is ready at: [`pico/3/babel_infinite_usb.uf2`](file:///c:/Users/geg/Documents/random/pico/3/babel_infinite_usb.uf2).
2. To flash:
   - Hold the white **BOOTSEL** button on your Pico and plug it into USB (or click the Stop/Restart button in Thonny to let `code.py` trigger the bootloader).
   - The **`RPI-RP2`** drive will appear.
   - Drag and drop [`babel_infinite_usb.uf2`](file:///c:/Users/geg/Documents/random/pico/3/babel_infinite_usb.uf2) onto `RPI-RP2` (or our active background watcher will copy it automatically).
   - The Pico will reboot instantly as **`BABEL_USB`**!
3. To switch back to CircuitPython anytime:
   - Hold BOOTSEL and drop [`circuitpython_10.2.1_pico_restore.uf2`](file:///c:/Users/geg/Documents/random/pico/3/circuitpython_10.2.1_pico_restore.uf2) onto `RPI-RP2`.

---

## 🧭 Directory Structure

- [`code.py`](file:///c:/Users/geg/Documents/random/pico/3/code.py): The CircuitPython firmware running on the Pico RP2040 chip.
- [`babel_engine.py`](file:///c:/Users/geg/Documents/random/pico/3/babel_engine.py): The core mathematical engine (compatible with Python 3 and CircuitPython).
- [`index.html`](file:///c:/Users/geg/Documents/random/pico/3/index.html): The interactive offline web portal with 3D-styled animated hexagonal lattice, book reader, and WebSerial hardware bridge.
- [`babel_cli.py`](file:///c:/Users/geg/Documents/random/pico/3/babel_cli.py): PC-side Python CLI tool to query the library or connect over serial.
- [`backup_code.py`](file:///c:/Users/geg/Documents/random/pico/3/backup_code.py): Backup of your previous `code.py` script.

---

## 🎮 How to Use

### Method 1: Interactive Web Portal
1. Open [`E:\index.html`](file:///E:/index.html) (or `pico/3/index.html`) in Google Chrome or Microsoft Edge.
2. Browse any hexagon chamber, wall (1-4), shelf (1-5), volume (1-32), and page (1-410).
3. Use **Universal Search** to find any phrase.
4. Click **⚡ CONNECT PICO SERIAL** to interface directly with the physical microcontroller using the WebSerial API.

### Method 2: Hardware Serial Console (COM12)
Connect to the Pico using `pico/3/babel_cli.py`:
```powershell
python babel_cli.py -t
```
Or with any serial monitor (Putty, Arduino, Thonny) set to **115200 baud**:
```text
search <text>                   - Calculate exact Hexagon, Wall, Shelf, Volume & Page
read <hex> <w> <s> <v> <p>      - Stream the full 40-line page (3,200 chars)
preview <hex> <w> <s> <v> <p>   - Display first 5 lines of the page
random                          - Discover a random page excerpt from the universe
prophecy                        - Speak a philosophical revelation from Borges
stats                           - Display RP2040 chip metrics & temperature
help                            - Show command manual
```

### Method 3: Standalone Python Search
```powershell
# Search for any string
python babel_cli.py -s "Antigravity and Greg built this USB"

# Read a specific page
python babel_cli.py -r cf96nfhq2m9b9r8kuqvqkqce 3 2 5 35
```

---

## 🔌 Hardware Configuration

| Component | Pin | Purpose |
|---|---|---|
| **Push Button** | **GP15** | Press to trigger Babel Prophecy / typing macro |
| **Ground** | **GND** | Button second terminal |
| **Activity LED** | **GP25** | Built-in Green LED pulses during library search |
| **USB Port** | **Micro-USB** | Mass Storage (`E:\`) + Serial (`COM12`) + HID |
