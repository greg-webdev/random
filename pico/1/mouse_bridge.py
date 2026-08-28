import sys
import time
import math
import serial
import serial.tools.list_ports
import pyautogui

# Disable PyAutoGUI failsafe so cursor can reach screen edges smoothly
pyautogui.FAILSAFE = False

# Auto-detect connected Raspberry Pi Pico COM port
def find_pico_port():
    ports = serial.tools.list_ports.comports()
    for port in ports:
        # Ignore Bluetooth ports
        if "BTHENUM" in port.hwid.upper() or "BLUETOOTH" in port.description.upper():
            continue
        # Raspberry Pi Pico USB Vendor ID is 2E8A
        if "2E8A" in port.hwid.upper() or "PICO" in port.description.upper() or "USB SERIAL" in port.description.upper():
            return port.device
    return None


def main():
    port = find_pico_port()
    if not port:
        print("Error: Could not find Raspberry Pi Pico COM port!")
        sys.exit(1)
        
    print(f"Connecting to Pico on {port}...")
    try:
        ser = serial.Serial(port, 115200, timeout=0.05)
    except Exception as e:
        print(f"Failed to open port {port}: {e}")
        sys.exit(1)
        
    print("=" * 50)
    print("  JOYSTICK TO MOUSE BRIDGE ACTIVE")
    print("  Move joystick to control cursor. Press stick to click.")
    print("  Press Ctrl+C in terminal to stop.")
    print("=" * 50)

    # Calibration constants
    CENTER_X = 32768
    CENTER_Y = 32768
    DEADZONE = 4000
    SPEED_SENSITIVITY = 18.0

    button_was_pressed = False

    while True:
        try:
            if ser.in_waiting > 0:
                line = ser.readline().decode('utf-8', errors='ignore').strip()
                if line and ',' in line:
                    parts = line.split(',')
                    if len(parts) == 3:
                        raw_x = int(parts[0])
                        raw_y = int(parts[1])
                        btn_pressed = bool(int(parts[2]))

                        # Calculate offsets
                        diff_x = raw_x - CENTER_X
                        diff_y = raw_y - CENTER_Y

                        dx = 0
                        dy = 0

                        if abs(diff_x) > DEADZONE:
                            sign_x = 1 if diff_x > 0 else -1
                            dx = sign_x * ((abs(diff_x) - DEADZONE) / (32768 - DEADZONE)) * SPEED_SENSITIVITY

                        if abs(diff_y) > DEADZONE:
                            sign_y = 1 if diff_y > 0 else -1
                            dy = sign_y * ((abs(diff_y) - DEADZONE) / (32768 - DEADZONE)) * SPEED_SENSITIVITY

                        # Move mouse cursor relative to current position
                        if dx != 0 or dy != 0:
                            pyautogui.moveRel(int(dx), int(dy))

                        # Handle Click & Drag
                        if btn_pressed and not button_was_pressed:
                            pyautogui.mouseDown(button='left')
                            button_was_pressed = True
                        elif not btn_pressed and button_was_pressed:
                            pyautogui.mouseUp(button='left')
                            button_was_pressed = False

            time.sleep(0.01)

        except KeyboardInterrupt:
            print("\nStopping Mouse Bridge.")
            break
        except Exception as e:
            pass

    ser.close()

if __name__ == "__main__":
    main()
