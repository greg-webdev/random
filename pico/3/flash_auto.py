"""
Automatic Infinite USB Flasher for Raspberry Pi Pico 2020
Triggers bootloader reset directly via CIRCUITPY drive, waits for RPI-RP2, and flashes the UF2.
"""

import os
import sys
import time
import shutil
import subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
UF2_FILE = os.path.join(SCRIPT_DIR, "babel_infinite_usb.uf2")

def get_drives():
    # Direct drive checks
    res = {}
    for letter in "EFGHIJKLMNOPQRSTUVWXYZD":
        path = f"{letter}:\\"
        if os.path.exists(path):
            if os.path.exists(os.path.join(path, "INFO_UF2.TXT")):
                res["RPI-RP2"] = path
            elif os.path.exists(os.path.join(path, "boot_out.txt")):
                res["CIRCUITPY"] = path
            elif os.path.exists(os.path.join(path, "README.TXT")):
                res["BABEL_USB"] = path
            else:
                res[f"DRIVE_{letter}"] = path
    return res

def main():
    print("=== Auto-Flasher: Library of Babel Infinite USB ===")
    print(f"Target Firmware: {os.path.basename(UF2_FILE)}")

    drives = get_drives()
    print("Current drives detected:", drives)

    rp2_path = drives.get("RPI-RP2")
    circuitpy_path = drives.get("CIRCUITPY")

    if not rp2_path:
        if circuitpy_path:
            print(f"Found CIRCUITPY drive at: {circuitpy_path}")
            print("Writing UF2 reset trigger to code.py...")
            trigger_code = (
                "import microcontroller\n"
                "import time\n"
                "time.sleep(0.3)\n"
                "microcontroller.on_next_reset(microcontroller.RunMode.UF2)\n"
                "microcontroller.reset()\n"
            )
            with open(os.path.join(circuitpy_path, "code.py"), "w") as f:
                f.write(trigger_code)
            print("Reset trigger written. Waiting for Pico to reboot into RPI-RP2 bootloader...")
        else:
            print("Neither CIRCUITPY nor RPI-RP2 drive found.")
            print("Please connect your Pico or hold BOOTSEL while plugging it in.")
            return

        # Poll for RPI-RP2
        for i in range(25):
            time.sleep(0.5)
            drives = get_drives()
            if "RPI-RP2" in drives:
                rp2_path = drives["RPI-RP2"]
                break

    if not rp2_path:
        print("Timed out waiting for RPI-RP2 drive.")
        print("Please hold the physical BOOTSEL button while plugging in the Pico.")
        return

    print(f"Found RPI-RP2 drive at: {rp2_path}")
    target_dest = os.path.join(rp2_path, "babel_infinite_usb.uf2")
    print(f"Copying UF2 firmware to {target_dest} ...")
    shutil.copy2(UF2_FILE, target_dest)

    print("\nSUCCESS! Firmware copied to Raspberry Pi Pico.")
    print("The Pico is rebooting now with the Infinite Virtual FAT32 Filesystem.")
    
    # Wait for BABEL_USB to mount
    print("Waiting for 'BABEL_USB' to appear in Windows Explorer...")
    for _ in range(15):
        time.sleep(0.5)
        drives = get_drives()
        if any("BABEL" in k for k in drives):
            babel_drive = [v for k, v in drives.items() if "BABEL" in k][0]
            print(f"\n[CONFIRMED] Infinite USB Drive successfully mounted at: {babel_drive}")
            return

if __name__ == "__main__":
    main()
