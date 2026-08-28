import machine
import time

# Pin configuration
adc_x = machine.ADC(26)  # GP26 (X-axis)
adc_y = machine.ADC(27)  # GP27 (Y-axis)
btn_sw = machine.Pin(16, machine.Pin.IN, machine.Pin.PULL_UP)  # GP16 (Button)

while True:
    # Read raw 16-bit ADC values (0 to 65535)
    raw_x = adc_x.read_u16()
    raw_y = adc_y.read_u16()
    
    # Button state: 1 when pressed (GP16 low), 0 when released
    btn_state = 1 if btn_sw.value() == 0 else 0
    
    # Send CSV formatted line over serial: X,Y,BUTTON
    print(f"{raw_x},{raw_y},{btn_state}")
    
    time.sleep(0.015)  # Update ~60 times per second for responsive mouse control
