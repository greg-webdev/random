"""
Library of Babel USB - Firmware for Raspberry Pi Pico 2020 (RP2040)
CircuitPython 10.2+

Provides:
- Interactive USB Serial Command Console (COM12)
- Reversible deterministic Library of Babel generation engine
- Physical push button macro on GP15 (Types random Babel prophecy / opens archive)
- Status LED breathing / activity indication on GP25
"""

import time
import sys
import board
import digitalio
import usb_hid
import gc
import microcontroller

try:
    from adafruit_hid.keyboard import Keyboard
    from adafruit_hid.keyboard_layout_us import KeyboardLayoutUS
    from adafruit_hid.keycode import Keycode
    HAS_HID = True
except ImportError:
    HAS_HID = False

# Import our algorithmic engine
import babel_engine as be

# Setup Onboard LED (GP25 on Pico 2020)
led = digitalio.DigitalInOut(board.LED)
led.direction = digitalio.Direction.OUTPUT
led.value = False

# Setup Push Button on GP15 (External button with internal pull-up)
btn_extra = None
try:
    btn_extra = digitalio.DigitalInOut(board.GP15)
    btn_extra.direction = digitalio.Direction.INPUT
    btn_extra.pull = digitalio.Pull.UP
except Exception as e:
    print("Button setup notice:", e)

# Setup HID Keyboard
keyboard = None
layout = None
if HAS_HID:
    try:
        keyboard = Keyboard(usb_hid.devices)
        layout = KeyboardLayoutUS(keyboard)
    except Exception as e:
        print("HID setup notice:", e)

def led_blink(times=2, speed=0.08):
    """Quick blink LED to indicate computation."""
    for _ in range(times):
        led.value = True
        time.sleep(speed)
        led.value = False
        time.sleep(speed)

BANNER = r"""
  _     _ _                             __   ____        _          _ 
 | |   (_) |__  _ __ __ _ _ __ _   _   / /  | __ )  __ _| |__   ___| |
 | |   | | '_ \| '__/ _` | '__| | | | / /   |  _ \ / _` | '_ \ / _ \ |
 | |___| | |_) | | | (_| | |  | |_| |/ /    | |_) | (_| | |_) |  __/ |
 |_____|_|_.__/|_|  \__,_|_|   \__, /_/     |____/ \__,_|_.__/ \___|_|
                               |___/                                  
   [ Raspberry Pi Pico 2020 • Infinite USB Archive • RP2040 CircuitPython ]
"""

PROPHETIC_EXCERPTS = [
    "the library is a sphere whose exact center is any hexagon and whose circumference is inaccessible.",
    "there is no combination of characters that does not exist in the infinite galleries.",
    "you who read me, are you sure you understand my language?",
    "in some shelf in some hexagon there must exist a book which is the cipher and perfect compendium of all the others.",
    "the certitude that everything has been written negates us or turns us into phantoms.",
    "antigravity and greg have explored the deepest hexagonal vault of rp2040.",
]

prophecy_idx = 0

def handle_button_press():
    """Triggered when physical button GP15 is pressed."""
    global prophecy_idx
    led_blink(4, 0.05)
    quote = PROPHETIC_EXCERPTS[prophecy_idx % len(PROPHETIC_EXCERPTS)]
    prophecy_idx += 1
    
    print("\n[GP15 BUTTON ACTIVATED - SUMMONING BABEL PROPHECY]")
    print(f">> {quote}")
    
    # If HID available, type the prophecy
    if keyboard and layout:
        try:
            time.sleep(0.3)
            layout.write(f"/* BABEL: {quote} */\n")
        except Exception as err:
            print("HID write error:", err)

def print_help():
    print("""
==================== BABEL COMMANDS ====================
  search <text>                   - Calculate exact Hexagon, Wall, Shelf, Volume & Page
  read <hex> <w> <s> <v> <p>      - Stream the full 40-line page (3200 chars)
  preview <hex> <w> <s> <v> <p>   - Display first 5 lines of the page
  random                          - Discover a random page excerpt from the universe
  prophecy                        - Speak a philosophical revelation from Borges
  stats                           - Display RP2040 chip metrics & library entropy
  help                            - Show this command manual
========================================================
""")

def print_stats():
    gc.collect()
    free_ram = gc.mem_free()
    temp_c = microcontroller.cpu.temperature
    freq_mhz = microcontroller.cpu.frequency // 1_000_000
    print(f"""
=== RASPBERRY PI PICO 2020 METRICS ===
  Processor:       Dual Cortex-M0+ @ {freq_mhz} MHz
  Core Temp:       {temp_c:.1f} °C
  Free SRAM:       {free_ram} bytes
  Flash Drive:     CIRCUITPY (USB MSC Active)
  Library Space:   Infinite (4 Walls × 5 Shelves × 32 Vols × 410 Pages × 36^N Hexagons)
  Alphabet:        42 symbols (a-z, 0-9, punctuation, space)
======================================
""")

def process_command(line):
    line = line.strip()
    if not line:
        return

    led_blink(1, 0.04)
    parts = line.split()
    cmd = parts[0].lower()

    if cmd == "help":
        print_help()

    elif cmd == "stats":
        print_stats()

    elif cmd == "prophecy":
        global prophecy_idx
        quote = PROPHETIC_EXCERPTS[prophecy_idx % len(PROPHETIC_EXCERPTS)]
        prophecy_idx += 1
        print(f"\n[BORGES ORACLE]: \"{quote}\"\n")

    elif cmd == "search":
        if len(parts) < 2:
            print("Usage: search <text phrase>")
            return
        query = " ".join(parts[1:])
        res = be.search_text(query)
        print("\n--- BABEL CATALOG LOCATOR ---")
        print(f"  Query:       '{res['query']}'")
        print(f"  Hexagon:     {res['hexagon']}")
        print(f"  Wall:        {res['wall']} (of 4)")
        print(f"  Shelf:       {res['shelf']} (of 5)")
        print(f"  Volume:      {res['volume']} (of 32)")
        print(f"  Page:        {res['page']} (of 410)")
        print(f"  Char Offset: {res['offset']} (in 3200 chars)")
        print(f"  Command to read: read {res['hexagon']} {res['wall']} {res['shelf']} {res['volume']} {res['page']}")
        print("-----------------------------\n")

    elif cmd in ("read", "preview"):
        if len(parts) < 6:
            print(f"Usage: {cmd} <hex> <wall:1-4> <shelf:1-5> <vol:1-32> <page:1-410>")
            return
        try:
            h = parts[1]
            w = int(parts[2])
            s = int(parts[3])
            v = int(parts[4])
            p = int(parts[5])
        except ValueError:
            print("Error: Wall, shelf, volume, and page must be integers.")
            return

        max_lines = 5 if cmd == "preview" else be.LINES_PER_PAGE
        print(f"\n=== HEXAGON {h} | WALL {w} | SHELF {s} | VOL {v} | PAGE {p} ===")
        for i in range(max_lines):
            line_str = be.generate_line(h, w, s, v, p, i)
            print(f"[{i+1:02d}] {line_str}")
        if cmd == "preview":
            print(f"... ({be.LINES_PER_PAGE - 5} more lines omitted. Use 'read' to stream all)")
        print("=" * 64 + "\n")

    elif cmd == "random":
        import random
        r_hex = be.int_to_base36(random.randint(1, 0xFFFFFFFFFFFFFFFF))
        r_w = random.randint(1, 4)
        r_s = random.randint(1, 5)
        r_v = random.randint(1, 32)
        r_p = random.randint(1, 410)
        print(f"\n[RANDOM CHAMBER DISCOVERED]: Hexagon {r_hex}, Wall {r_w}, Shelf {r_s}, Vol {r_v}, Page {r_p}")
        print("Sample Excerpt:")
        for i in range(3):
            line_str = be.generate_line(r_hex, r_w, r_s, r_v, r_p, i)
            print(f"  {line_str}")
        print(f"Command to read full: read {r_hex} {r_w} {r_s} {r_v} {r_p}\n")

    else:
        print(f"Unknown command: '{cmd}'. Type 'help' for instructions.")

def main():
    print(BANNER)
    print("Welcome to the Library of Babel USB Drive.")
    print("USB Serial & Mass Storage Active. Type 'help' for commands.\n")
    led_blink(3, 0.1)

    button_was_pressed = False
    input_buffer = []

    # Non-blocking main loop
    while True:
        # Check physical button GP15
        if btn_extra is not None:
            is_pressed = not btn_extra.value
            if is_pressed and not button_was_pressed:
                button_was_pressed = True
                handle_button_press()
            elif not is_pressed:
                button_was_pressed = False

        # Check Serial input via sys.stdin
        try:
            import supervisor
            while supervisor.runtime.serial_bytes_available:
                ch = sys.stdin.read(1)
                if ch in ("\r", "\n"):
                    # Process completed line
                    line = "".join(input_buffer)
                    input_buffer.clear()
                    print() # Echo newline
                    process_command(line)
                    print("babel> ", end="")
                    break
                elif ch in ("\x08", "\x7f"): # Backspace
                    if input_buffer:
                        input_buffer.pop()
                        sys.stdout.write("\b \b")
                else:
                    input_buffer.append(ch)
                    sys.stdout.write(ch) # Local echo
        except ImportError:
            # Fallback if supervisor not present
            time.sleep(0.01)

        time.sleep(0.01)

if __name__ == "__main__":
    main()
