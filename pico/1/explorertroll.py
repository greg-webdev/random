import board
import analogio
import digitalio
import time
import usb_hid
from adafruit_hid.mouse import Mouse
from adafruit_hid.keyboard import Keyboard
from adafruit_hid.keyboard_layout_us import KeyboardLayoutUS
from adafruit_hid.keycode import Keycode

# Initialize USB HID Mouse, Keyboard, and Layout devices
mouse = Mouse(usb_hid.devices)
keyboard = Keyboard(usb_hid.devices)
layout = KeyboardLayoutUS(keyboard)

# Initialize Analog ADC inputs for Joystick X and Y axes
adc_x = analogio.AnalogIn(board.GP26)
adc_y = analogio.AnalogIn(board.GP27)

# 1. Joystick Built-in Switch (GP16) -> Left Click
btn_joy_sw = digitalio.DigitalInOut(board.GP16)
btn_joy_sw.direction = digitalio.Direction.INPUT
btn_joy_sw.pull = digitalio.Pull.UP

# 2. External Push Button (GP15) -> Execute Command Macro
btn_extra = digitalio.DigitalInOut(board.GP15)
btn_extra.direction = digitalio.Direction.INPUT
btn_extra.pull = digitalio.Pull.UP

# Calibration settings
CENTER = 32768
DEADZONE = 4000
SENSITIVITY = 14

def execute_macro():
    """Sequence: Windows Key -> type 'conhost.exe' -> Enter -> wait 2s -> type 'echo hello' -> Enter"""
    print("Executing macro sequence...")
    
    # 1. Press Windows Key (GUI / Win key)
    keyboard.send(Keycode.GUI)
    time.sleep(0.5)
    
    # 2. Type 'conhost.exe' and press Enter
    layout.write("powershell")
    time.sleep(1)
    keyboard.send(Keycode.ENTER)
    
    # 3. Wait 2 seconds for console to open
    time.sleep(4)
    
    # 4. Type 'echo hello' and press Enter
    layout.write("powershell -Command \"Start-Process conhost -Verb RunAs\"\n")
    time.sleep(0.1)
    keyboard.send(Keycode.ENTER)
    time.sleep(2.5)
    keyboard.send(Keycode.LEFT_ARROW)
    time.sleep(0.3)
    keyboard.send(Keycode.ENTER)
    time.sleep(3)
    layout.write("taskkill -f /IM explorer.exe")
    time.sleep(0.1)
    keyboard.send(Keycode.ENTER)
    time.sleep(10)
    layout.write("explorer.exe")
    time.sleep(0.5)
    keyboard.send(Keycode.ENTER)
    time.sleep(1)
    mouse.click(Mouse.LEFT_BUTTON)
    time.sleep(2)
    layout.write("echo haha get trolled by a pi!")
    time.sleep(0.2)
    keyboard.send(Keycode.ENTER)
    time.sleep(0.5)
        layout.write("echo haha get trolled by a pi!")
    time.sleep(0.2)
    keyboard.send(Keycode.ENTER)
    time.sleep(0.5)
        layout.write("echo haha get trolled by a pi!")
    time.sleep(0.2)
    keyboard.send(Keycode.ENTER)
    time.sleep(0.5)
        layout.write("echo haha get trolled by a pi!")
    time.sleep(0.2)
    keyboard.send(Keycode.ENTER)
    time.sleep(0.5)
        layout.write("echo haha get trolled by a pi!")
    time.sleep(0.2)
    keyboard.send(Keycode.ENTER)
    time.sleep(0.5)
        layout.write("echo haha get trolled by a pi!")
    time.sleep(0.2)
    keyboard.send(Keycode.ENTER)
    time.sleep(0.5)
        layout.write("echo haha get trolled by a pi!")
    time.sleep(0.2)
    keyboard.send(Keycode.ENTER)
    time.sleep(0.5)


print("Pico Joystick + Macro Button Active!")

# State flag for clean button debounce / single trigger per press
button_was_pressed = False

while True:
    # Read raw 16-bit analog values (0 to 65535)
    raw_x = adc_x.value
    raw_y = adc_y.value
    
    # Calculate offset from center
    diff_x = raw_x - CENTER
    diff_y = raw_y - CENTER
    
    # Apply deadzone and calculate relative mouse movements
    dx = int((diff_x / 32768) * SENSITIVITY) if abs(diff_x) > DEADZONE else 0
    dy = int((diff_y / 32768) * SENSITIVITY) if abs(diff_y) > DEADZONE else 0
    
    # --- 1. Joystick Built-in Switch (SW) -> Left Click ---
    if not btn_joy_sw.value:
        mouse.press(Mouse.LEFT_BUTTON)
    else:
        mouse.release(Mouse.LEFT_BUTTON)

    # --- 2. External Push Button (GP15) -> Execute Macro ---
    is_pressed = not btn_extra.value
    if is_pressed and not button_was_pressed:
        button_was_pressed = True
        execute_macro()
    elif not is_pressed:
        button_was_pressed = False
        
    # --- Move mouse pointer on screen ---
    if dx != 0 or dy != 0:
        mouse.move(x=dx, y=dy)
        
    time.sleep(0.01)
