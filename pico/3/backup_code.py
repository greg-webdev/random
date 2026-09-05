import board
import digitalio
import time
import usb_hid
from adafruit_hid.keyboard import Keyboard
from adafruit_hid.keyboard_layout_us import KeyboardLayoutUS
from adafruit_hid.keycode import Keycode
from adafruit_hid.mouse import Mouse

# Initialize Keyboard, Layout, and Mouse
keyboard = Keyboard(usb_hid.devices)
layout = KeyboardLayoutUS(keyboard)
mouse = Mouse(usb_hid.devices)

# Move mouse toward bottom-left after every action
def mouse_bottom_left():
    mouse.move(x=-127, y=127)

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

        # 1. Press Ctrl + N
        keyboard.send(Keycode.CONTROL, Keycode.N)
        mouse_bottom_left()

        # 2. Wait
        time.sleep(0.5)

        # 3. Type URL
        layout.write("https://notgreg.space/test")
        mouse_bottom_left()

        time.sleep(0.1)

        # Enter
        keyboard.send(Keycode.ENTER)
        mouse_bottom_left()

        time.sleep(0.1)

        keyboard.send(Keycode.ENTER)
        mouse_bottom_left()

        time.sleep(0.1)

        keyboard.send(Keycode.ENTER)
        mouse_bottom_left()

        time.sleep(0.1)

        keyboard.send(Keycode.ENTER)
        mouse_bottom_left()

        time.sleep(0.2)

        # Ctrl + N repeatedly
        keyboard.send(Keycode.CONTROL, Keycode.N)
        mouse_bottom_left()

        time.sleep(0.2)

        keyboard.send(Keycode.CONTROL, Keycode.N)
        mouse_bottom_left()

        time.sleep(0.2)

        keyboard.send(Keycode.CONTROL, Keycode.N)
        mouse_bottom_left()

        time.sleep(0.2)

        keyboard.send(Keycode.CONTROL, Keycode.N)
        mouse_bottom_left()

        time.sleep(0.2)

        keyboard.send(Keycode.CONTROL, Keycode.N)
        mouse_bottom_left()

        time.sleep(0.2)

        keyboard.send(Keycode.CONTROL, Keycode.N)
        mouse_bottom_left()

    elif not is_pressed:
        button_was_pressed = False

    time.sleep(0.01)