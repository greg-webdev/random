"""
One-Click Flasher for Raspberry Pi Pico 2020
Flashes the Infinite Virtual FAT32 Library of Babel UF2 Firmware
or restores CircuitPython.
"""

import sys
import os
import time
import shutil

try:
    import serial
    HAS_SERIAL = True
except ImportError:
    HAS_SERIAL = False

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BABEL_UF2 = os.path.join(SCRIPT_DIR, "babel_infinite_usb.uf2")
RESTORE_UF2 = os.path.join(SCRIPT_DIR, "circuitpython_10.2.1_pico_restore.uf2")

def find_drive_by_volume_name(target_name):
    """Find drive letter by volume label (Windows)."""
    import subprocess
    cmd = 'Get-Volume | Select-Object DriveLetter, FriendlyName | ConvertTo-Json'
    res = subprocess.run(["powershell", "-Command", cmd], capture_output=True, text=True)
    try:
        import json
        data = json.loads(res.stdout)
        if isinstance(data, dict):
            data = [data]
        for item in data:
            fn = str(item.get("FriendlyName") or "").upper()
            dl = item.get("DriveLetter")
            if target_name.upper() in fn and dl:
                return f"{dl}:\\"
    except Exception:
        pass
    return None

def reboot_pico_to_bootsel():
    """Trigger software reboot to BOOTSEL mode via CircuitPython COM port."""
    if not HAS_SERIAL:
        print("Notice: pyserial not installed, attempting to trigger via E:\\code.py reboot...")
        return False

    print("Attempting to command Pico into BOOTSEL mode via COM12...")
    try:
        ser = serial.Serial("COM12", 115200, timeout=1.0)
        time.sleep(0.2)
        # Send Python command to reboot to UF2
        cmd = (
            b"\x03" # Ctrl+C to enter REPL
            b"import microcontroller\r\n"
            b"microcontroller.on_next_reset(microcontroller.RunMode.UF2)\r\n"
            b"microcontroller.reset()\r\n"
        )
        ser.write(cmd)
        time.sleep(0.5)
        ser.close()
        print("Reboot signal sent!")
        return True
    except Exception as e:
        print("Serial trigger note:", e)
        return False

def flash(target_file):
    print("==================================================")
    print("      Raspberry Pi Pico 2020 Firmware Flasher     ")
    print("==================================================")
    print(f"Target Firmware: {os.path.basename(target_file)}")

    if not os.path.exists(target_file):
        print(f"Error: File '{target_file}' not found!")
        return False

    # Check if RPI-RP2 drive is already present
    rp2_drive = find_drive_by_volume_name("RPI-RP2")
    if not rp2_drive:
        # Try software reboot from CircuitPython
        print("Pico not yet in BOOTSEL mode. Triggering automatic reset...")
        reboot_pico_to_bootsel()
        
        # Wait up to 10 seconds for RPI-RP2 drive
        print("Waiting for 'RPI-RP2' drive to mount...")
        for _ in range(20):
            time.sleep(0.5)
            rp2_drive = find_drive_by_volume_name("RPI-RP2")
            if rp2_drive:
                break

    if not rp2_drive:
        print("\nCould not automatically detect 'RPI-RP2' drive.")
        print("Please hold the physical 'BOOTSEL' button on the Pico while plugging in the USB cable.")
        return False

    print(f"Found Pico BOOTSEL drive at: {rp2_drive}")
    dest = os.path.join(rp2_drive, os.path.basename(target_file))
    print(f"Copying {os.path.basename(target_file)} -> {dest} ...")

    shutil.copy2(target_file, dest)
    print("\nSUCCESS! Firmware copied.")
    print("The Raspberry Pi Pico is rebooting now with the new firmware.")
    return True

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--restore":
        flash(RESTORE_UF2)
    else:
        flash(BABEL_UF2)
