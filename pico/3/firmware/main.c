/*
 * The Library of Babel - Infinite USB Firmware for Raspberry Pi Pico 2020
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "pico/stdlib.h"
#include "pico/binary_info.h"
#include "hardware/gpio.h"
#include "bsp/board_api.h"
#include "tusb.h"

#define PICO_LED_PIN   25
#define BUTTON_PIN     15

// Blink pattern for USB activity
static uint32_t blink_interval_ms = 1000;

void cdc_task(void);

int main(void) {
    board_init();
    
    // Initialize Onboard LED
    gpio_init(PICO_LED_PIN);
    gpio_set_dir(PICO_LED_PIN, GPIO_OUT);
    gpio_put(PICO_LED_PIN, 1);

    // Initialize Push Button GP15 with internal pull-up
    gpio_init(BUTTON_PIN);
    gpio_set_dir(BUTTON_PIN, GPIO_IN);
    gpio_pull_up(BUTTON_PIN);

    // Initialize TinyUSB stack
    tusb_init(BOARD_TUD_RHPORT);

    uint32_t start_ms = to_ms_since_boot(get_absolute_time());
    bool led_state = false;

    while (1) {
        // TinyUSB device task
        tud_task();

        // CDC task (Serial echo & REPL)
        cdc_task();

        // Button check (GP15)
        if (!gpio_get(BUTTON_PIN)) {
            blink_interval_ms = 100; // Rapid pulse on button press
        } else {
            blink_interval_ms = 1000; // Normal cosmic heartbeat
        }

        // Heartbeat LED
        uint32_t now_ms = to_ms_since_boot(get_absolute_time());
        if (now_ms - start_ms >= blink_interval_ms) {
            start_ms += blink_interval_ms;
            led_state = !led_state;
            gpio_put(PICO_LED_PIN, led_state);
        }
    }

    return 0;
}

//--------------------------------------------------------------------+
// USB CDC (Serial Interface)
//--------------------------------------------------------------------+
void cdc_task(void) {
    if (tud_cdc_available()) {
        uint8_t buf[64];
        uint32_t count = tud_cdc_read(buf, sizeof(buf));
        
        // Echo back
        tud_cdc_write(buf, count);
        tud_cdc_write_flush();
    }
}

// Invoked when cdc line state changed (e.g. connected/disconnected)
void tud_cdc_line_state_cb(uint8_t itf, bool dtr, bool rts) {
    (void) itf; (void) dtr; (void) rts;
}
