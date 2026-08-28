import board
import digitalio
import time
import usb_hid
from adafruit_hid.keyboard import Keyboard
from adafruit_hid.keyboard_layout_us import KeyboardLayoutUS
from adafruit_hid.keycode import Keycode

# Initialize Keyboard and Layout
keyboard = Keyboard(usb_hid.devices)
layout = KeyboardLayoutUS(keyboard)

# External Push Button setup (GP15 -> GND)
btn_extra = digitalio.DigitalInOut(board.GP15)
btn_extra.direction = digitalio.Direction.INPUT
btn_extra.pull = digitalio.Pull.UP

print("Button Macro Active!")

button_was_pressed = False

while True:
    is_pressed = not btn_extra.value
    
    if is_pressed and not button_was_pressed:
        button_was_pressed = True
        
        layout.write("As~1234567890-")
        time.sleep(0.1)
        keyboard.send(Keycode.ENTER)
        
    elif not is_pressed:
        button_was_pressed = False
        
    time.sleep(0.01)
