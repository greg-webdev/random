# Seeed XIAO ESP32-C5 Standalone Web Server & Live Studio

Standalone ESPHome web application and firmware compiled for the **Seeed Studio XIAO ESP32-C5** with embedded offline UI, file storage/sharing, 2004A I2C LCD dashboard, and live code execution engine.

---

## 📁 Compiled Binary Files

Folder: [`c:\Users\geg\Documents\random\seeed-c5-webserver\`](file:///c:/Users/geg/Documents/random/seeed-c5-webserver/)

| Binary File | Purpose | Usage / Offset |
| :--- | :--- | :--- |
| [**`firmware.ota.bin`**](file:///c:/Users/geg/Documents/random/seeed-c5-webserver/firmware.ota.bin) | **Over-The-Air (OTA) Update Binary** | Upload in ESPHome Web OTA |
| [**`firmware.factory.bin`**](file:///c:/Users/geg/Documents/random/seeed-c5-webserver/firmware.factory.bin) | **Complete all-in-one Factory image** | USB Flash at `0x0` |
| [**`seeed-xiao-c5-webserver.bin`**](file:///c:/Users/geg/Documents/random/seeed-c5-webserver/seeed-xiao-c5-webserver.bin) | Application Firmware binary | `0x10000` |
| [**`bootloader.bin`**](file:///c:/Users/geg/Documents/random/seeed-c5-webserver/bootloader.bin) | ESP-IDF Bootloader binary | `0x2000` |
| [**`partition-table.bin`**](file:///c:/Users/geg/Documents/random/seeed-c5-webserver/partition-table.bin) | Partition table binary | `0x8000` |

---

## 🚀 Key Features

### 1. 📺 1-Click LCD 2004A Live Dashboard Button
- **Button in Web UI:** `📺 Show Live Status on LCD`
- Formats and displays real-time diagnostics on the 20x4 display:
  - **Row 0:** Device IP (`IP: 192.168.4.1`)
  - **Row 1:** Free RAM & Memory (`RAM: <KB>KB Free`)
  - **Row 2:** File Count & Storage (`Files: <N> (<KB>KB)`)
  - **Row 3:** System Uptime & Status (`Up: <Sec>s  C5-OK`)

### 2. 📁 File Upload & Direct Display Links
- Drag & Drop / File Browser for any file type.
- Direct clickable **🔗 View / Download Link** (`/api/download?name=<file>`).
- Live storage counter.

### 3. ⚡ Live Code Studio & Runner
- Code editor to write and execute scripts directly on the ESP32-C5.
- Control GPIOs (`LED`, `BOOT_BTN`, `D0`-`D10`), run math, query system stats.
- Built-in LCD functions: `lcd_init(0x27)`, `lcd_clear()`, `lcd_set_cursor(col, row)`, `lcd_print("text")`, `lcd_status()`, `i2c_scan()`.

---

## 🔌 How to Flash or OTA Update

### Method 1: Over-The-Air (OTA) Update
1. Connect to `Seeed-C5-AP` or browse to your device web UI at `http://192.168.4.1`.
2. Upload [`firmware.ota.bin`](file:///c:/Users/geg/Documents/random/seeed-c5-webserver/firmware.ota.bin) in the OTA Update section.

### Method 2: Initial USB Flashing via `esptool`
```powershell
cd c:\Users\geg\Documents\random\seeed-c5-webserver
.\.venv\Scripts\python -m esptool --chip esp32c5 -p <YOUR_COM_PORT> write_flash 0x0 firmware.factory.bin
```
