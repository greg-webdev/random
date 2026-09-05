"""
Library of Babel USB - PC CLI & Serial Bridge
Communicates directly with the Raspberry Pi Pico 2020 on COM12
or performs high-speed local lookups.
"""

import sys
import time
import argparse
import babel_engine as be

try:
    import serial
    import serial.tools.list_ports
    HAS_SERIAL = True
except ImportError:
    HAS_SERIAL = False

DEFAULT_BAUD = 115200

def find_pico_com_port():
    """Auto-detect the COM port for the Raspberry Pi Pico."""
    if not HAS_SERIAL:
        return None
    ports = list(serial.tools.list_ports.comports())
    for p in ports:
        desc = (p.description or "").lower()
        mfg = (p.manufacturer or "").lower()
        if "pico" in desc or "circuitpy" in desc or "raspberry" in desc or "239a" in (p.hwid or "").lower():
            return p.device
        if "usb serial" in desc:
            return p.device
    return "COM12"  # Default fallback based on detected device list

def interactive_terminal(port):
    """Open a direct live serial console to the Pico 2020."""
    if not HAS_SERIAL:
        print("Error: pyserial is required for direct hardware communication.")
        return

    print(f"Connecting to Raspberry Pi Pico on {port} @ {DEFAULT_BAUD} baud...")
    try:
        ser = serial.Serial(port, DEFAULT_BAUD, timeout=0.1)
        time.sleep(0.2)
        # Flush
        ser.reset_input_buffer()
        ser.write(b"\r\nhelp\r\n")
        
        print("\n--- CONNECTED TO BABEL USB HARDWARE ---")
        print("Type commands (search <text>, read <hex> <w> <s> <v> <p>, random, stats) or 'exit':\n")
        
        while True:
            # Read incoming
            while ser.in_waiting:
                data = ser.read(ser.in_waiting)
                sys.stdout.write(data.decode("utf-8", errors="replace"))
                sys.stdout.flush()

            # Prompt user
            try:
                cmd = input()
            except (KeyboardInterrupt, EOFError):
                break

            if cmd.strip().lower() in ("exit", "quit"):
                break

            ser.write((cmd + "\r\n").encode("utf-8"))
            time.sleep(0.1)

            while ser.in_waiting:
                data = ser.read(ser.in_waiting)
                sys.stdout.write(data.decode("utf-8", errors="replace"))
                sys.stdout.flush()

        ser.close()
        print("\nDisconnected from Pico.")
    except Exception as e:
        print(f"Serial connection error on {port}: {e}")

def main():
    parser = argparse.ArgumentParser(description="Library of Babel USB Explorer & Hardware Bridge")
    parser.add_argument("-s", "--search", type=str, help="Search for any phrase in the library")
    parser.add_argument("-r", "--read", nargs=5, metavar=("HEX", "WALL", "SHELF", "VOL", "PAGE"),
                        help="Read a specific 3200-char page")
    parser.add_argument("-t", "--terminal", action="store_true", help="Connect to Pico hardware serial REPL")
    parser.add_argument("-p", "--port", type=str, default=None, help="COM port for Pico (default: auto-detect)")
    parser.add_argument("--random", action="store_true", help="Generate a random page excerpt")

    args = parser.parse_args()

    if args.terminal:
        port = args.port or find_pico_com_port()
        interactive_terminal(port)
        return

    if args.search:
        res = be.search_text(args.search)
        print("\n================== BABEL SEARCH RESULT ==================")
        print(f"  Target Text:  \"{res['query']}\" ({res['length']} chars)")
        print(f"  Hexagon:      {res['hexagon']}")
        print(f"  Wall:         {res['wall']} / 4")
        print(f"  Shelf:        {res['shelf']} / 5")
        print(f"  Volume:       {res['volume']} / 32")
        print(f"  Page:         {res['page']} / 410")
        print(f"  Char Offset:  {res['offset']} (of 3,200 chars on page)")
        print("=========================================================")
        print("\nRetrieving page from library...")
        page = be.generate_page(res['hexagon'], res['wall'], res['shelf'], res['volume'], res['page'], line_wrap=True)
        lines = page.split("\n")
        for i, l in enumerate(lines[:8]):
            print(f"  [{i+1:02d}] {l}")
        print(f"  ... ({len(lines)-8} lines remaining. Use --read to view full page)")
        return

    if args.read:
        h, w, s, v, p = args.read
        w, s, v, p = int(w), int(s), int(v), int(p)
        page = be.generate_page(h, w, s, v, p, line_wrap=True)
        print(f"\n=== HEXAGON {h} | WALL {w} | SHELF {s} | VOL {v} | PAGE {p} ===")
        print(page)
        print("=" * 64)
        return

    if args.random:
        import random
        r_hex = be.int_to_base36(random.randint(1, 0xFFFFFFFFFFFFFFFF))
        r_w = random.randint(1, 4)
        r_s = random.randint(1, 5)
        r_v = random.randint(1, 32)
        r_p = random.randint(1, 410)
        print(f"\n[RANDOM SECTOR]: Hexagon {r_hex}, Wall {r_w}, Shelf {r_s}, Vol {r_v}, Page {r_p}")
        page = be.generate_page(r_hex, r_w, r_s, r_v, r_p, line_wrap=True)
        for i, l in enumerate(page.split("\n")[:6]):
            print(f"  [{i+1:02d}] {l}")
        return

    # If no flags passed, interactive menu
    print(r"""
  _     _ _                             __   ____        _          _ 
 | |   (_) |__  _ __ __ _ _ __ _   _   / /  | __ )  __ _| |__   ___| |
 | |   | | '_ \| '__/ _` | '__| | | | / /   |  _ \ / _` | '_ \ / _ \ |
 | |___| | |_) | | | (_| | |  | |_| |/ /    | |_) | (_| | |_) |  __/ |
 |_____|_|_.__/|_|  \__,_|_|   \__, /_/     |____/ \__,_|_.__/ \___|_|
                               |___/                                  
    Library of Babel USB Explorer • Raspberry Pi Pico 2020
""")
    port = args.port or find_pico_com_port()
    print(f"Detected Pico Hardware Port: {port}")
    print("\nChoose an option:")
    print("  1. Search for a phrase")
    print("  2. Read a specific page")
    print("  3. Discover a random page")
    print("  4. Connect live to Pico USB Serial Terminal")
    print("  5. Exit")

    choice = input("\nEnter choice [1-5]: ").strip()
    if choice == "1":
        q = input("Enter phrase to locate: ")
        res = be.search_text(q)
        print(f"\nLocated in Hexagon: {res['hexagon']}")
        print(f"Wall {res['wall']}, Shelf {res['shelf']}, Vol {res['volume']}, Page {res['page']} (Offset {res['offset']})")
        show = input("View page preview? (y/n): ").strip().lower()
        if show == "y":
            p = be.generate_page(res['hexagon'], res['wall'], res['shelf'], res['volume'], res['page'], line_wrap=True)
            print("\n" + p + "\n")
    elif choice == "2":
        h = input("Hexagon: ").strip()
        w = int(input("Wall (1-4): ").strip())
        s = int(input("Shelf (1-5): ").strip())
        v = int(input("Volume (1-32): ").strip())
        p = int(input("Page (1-410): ").strip())
        print("\n" + be.generate_page(h, w, s, v, p, line_wrap=True) + "\n")
    elif choice == "3":
        import random
        r_hex = be.int_to_base36(random.randint(1, 0xFFFFFFFFFFFFFFFF))
        p = be.generate_page(r_hex, 1, 1, 1, 1, line_wrap=True)
        print(f"\nHexagon {r_hex}:\n" + p[:400] + "...\n")
    elif choice == "4":
        interactive_terminal(port)

if __name__ == "__main__":
    main()
