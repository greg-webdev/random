"""
Run this script (or paste into Thonny) to instantly reboot the Pico into BOOTSEL UF2 mode!
"""
import microcontroller
import time

print("Rebooting Raspberry Pi Pico into BOOTSEL UF2 mode...")
time.sleep(0.3)
microcontroller.on_next_reset(microcontroller.RunMode.UF2)
microcontroller.reset()
