# CircuitPython USB HID Joystick + Push Button Wiring Guide

## Wiring Table

| Component | Pin / Terminal | Pico Pin Name | Pico Physical Pin # | Function |
|-----------|----------------|---------------|----------------------|----------|
| **Joystick** | GND | GND | Pin 3, 8, 13, 18, 23, 28, 33, or 38 | Ground |
| **Joystick** | +5V / VCC | **3V3 OUT** | **Pin 36** | Power |
| **Joystick** | VRx | **GP26 (ADC0)** | Pin 31 | X-Axis Mouse |
| **Joystick** | VRy | **GP27 (ADC1)** | Pin 32 | Y-Axis Mouse |
| **Joystick** | SW | **GP16** | Pin 21 | Joystick Press -> **Mouse Left Click** |
| **Push Button** | Terminal 1 | **GP15** | Pin 20 | Push Button -> **Spacebar Keypress** |
| **Push Button** | Terminal 2 | GND | Pin 18 or 23 | Ground Connection |

---

## Code Example ([code.py](file:///c:/Users/geg/Documents/random/pico/1/code.py))

```python
import board
import analogio
import digitalio
import time
import usb_hid
from adafruit_hid.mouse import Mouse
from adafruit_hid.keyboard import Keyboard
from adafruit_hid.keycode import Keycode

mouse = Mouse(usb_hid.devices)
keyboard = Keyboard(usb_hid.devices)

adc_x = analogio.AnalogIn(board.GP26)
adc_y = analogio.AnalogIn(board.GP27)

# Joystick built-in push switch (SW) -> Left Click
btn_joy_sw = digitalio.DigitalInOut(board.GP16)
btn_joy_sw.direction = digitalio.Direction.INPUT
btn_joy_sw.pull = digitalio.Pull.UP

# Standalone push button (GP15) -> Spacebar
btn_extra = digitalio.DigitalInOut(board.GP15)
btn_extra.direction = digitalio.Direction.INPUT
btn_extra.pull = digitalio.Pull.UP

CENTER = 32768
DEADZONE = 4000
SENSITIVITY = 14

while True:
    diff_x = adc_x.value - CENTER
    diff_y = adc_y.value - CENTER
    
    dx = int((diff_x / 32768) * SENSITIVITY) if abs(diff_x) > DEADZONE else 0
    dy = int((diff_y / 32768) * SENSITIVITY) if abs(diff_y) > DEADZONE else 0
    
    # 1. Joystick Switch -> Left Click
    if not btn_joy_sw.value:
        mouse.press(Mouse.LEFT_BUTTON)
    else:
        mouse.release(Mouse.LEFT_BUTTON)

    # 2. External Push Button -> Spacebar
    if not btn_extra.value:
        keyboard.press(Keycode.SPACE)
    else:
        keyboard.release(Keycode.SPACE)
        
    if dx != 0 or dy != 0:
        mouse.move(x=dx, y=dy)
        
    time.sleep(0.01)
```
