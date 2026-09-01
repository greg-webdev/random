#pragma once

#include "esphome/core/component.h"
#include "esphome/core/hal.h"
#include "esphome/components/web_server_base/web_server_base.h"
#include "esphome/components/web_server_idf/web_server_idf.h"
#include <vector>
#include <string>
#include <map>
#include <sstream>
#include <cmath>
#include <cstdlib>
#include <cstring>
#include <algorithm>
#include <driver/gpio.h>
#include <esp_system.h>
#include <esp_heap_caps.h>
#include <esp_wifi.h>
#include <esp_ota_ops.h>
#include <esp_partition.h>
#include <esp_netif.h>
#include <esp_http_client.h>
#include <esp_crt_bundle.h>

namespace esphome {
namespace custom_web {

inline std::string get_current_ip_str() {
  esp_netif_ip_info_t ip_info;
  esp_netif_t *netif_sta = esp_netif_get_handle_from_ifkey("WIFI_STA_DEF");
  if (netif_sta && esp_netif_get_ip_info(netif_sta, &ip_info) == ESP_OK && ip_info.ip.addr != 0) {
    char buf[24];
    esp_ip4addr_ntoa(&ip_info.ip, buf, sizeof(buf));
    return std::string(buf);
  }
  esp_netif_t *netif_ap = esp_netif_get_handle_from_ifkey("WIFI_AP_DEF");
  if (netif_ap && esp_netif_get_ip_info(netif_ap, &ip_info) == ESP_OK && ip_info.ip.addr != 0) {
    char buf[24];
    esp_ip4addr_ntoa(&ip_info.ip, buf, sizeof(buf));
    return std::string(buf);
  }
  return "192.168.4.1";
}

struct StoredFile {
  std::string name;
  std::string content_type;
  std::string data;
  size_t size;
  uint32_t upload_time;
};

struct ProxyResponse {
  int status_code{0};
  std::string content_type{"text/plain"};
  std::string body;
  std::string error;
};

class HttpProxyClient {
 public:
  static ProxyResponse request(const std::string &url, const std::string &method = "GET", const std::string &post_data = "") {
    ProxyResponse resp;
    if (url.empty()) {
      resp.status_code = 400;
      resp.error = "Target URL is empty";
      return resp;
    }

    esp_http_client_config_t config = {};
    config.url = url.c_str();
    config.timeout_ms = 10000;
    config.crt_bundle_attach = esp_crt_bundle_attach;
    config.skip_cert_common_name_check = true;
    config.method = (method == "POST") ? HTTP_METHOD_POST :
                    (method == "PUT") ? HTTP_METHOD_PUT :
                    (method == "DELETE") ? HTTP_METHOD_DELETE :
                    (method == "HEAD") ? HTTP_METHOD_HEAD : HTTP_METHOD_GET;

    esp_http_client_handle_t client = esp_http_client_init(&config);
    if (!client) {
      resp.status_code = 500;
      resp.error = "Failed to initialize HTTP client";
      return resp;
    }

    esp_http_client_set_header(client, "User-Agent", "XIAO-ESP32-C5-Proxy/1.0");

    if ((config.method == HTTP_METHOD_POST || config.method == HTTP_METHOD_PUT) && !post_data.empty()) {
      esp_http_client_set_post_field(client, post_data.c_str(), post_data.length());
      esp_http_client_set_header(client, "Content-Type", "application/json");
    }

    esp_err_t err = esp_http_client_open(client, post_data.length());
    if (err != ESP_OK) {
      resp.status_code = 502;
      resp.error = "Failed to connect to " + url + " (" + std::string(esp_err_to_name(err)) + ")";
      esp_http_client_cleanup(client);
      return resp;
    }

    if (post_data.length() > 0) {
      int wlen = esp_http_client_write(client, post_data.c_str(), post_data.length());
      if (wlen < 0) {
        resp.status_code = 502;
        resp.error = "Failed to send request body";
        esp_http_client_cleanup(client);
        return resp;
      }
    }

    int content_len = esp_http_client_fetch_headers(client);
    resp.status_code = esp_http_client_get_status_code(client);

    char *ct = nullptr;
    if (esp_http_client_get_header(client, "Content-Type", &ct) == ESP_OK && ct) {
      resp.content_type = std::string(ct);
    }

    char buffer[512];
    int read_len = 0;
    size_t total = 0;
    const size_t max_body = 64 * 1024;
    while ((read_len = esp_http_client_read(client, buffer, sizeof(buffer))) > 0) {
      if (total + read_len > max_body) {
        resp.body.append(buffer, max_body - total);
        break;
      }
      resp.body.append(buffer, read_len);
      total += read_len;
    }

    esp_http_client_close(client);
    esp_http_client_cleanup(client);
    return resp;
  }
};

class I2CLcdDriver {
 public:
  static inline int sda_pin = 8; // D8 (GPIO8)
  static inline int scl_pin = 9; // D9 (GPIO9)
  static inline uint8_t default_addr = 0x27;

  static void i2c_delay() {
    esp_rom_delay_us(4);
  }

  static void i2c_start(int sda = -1, int scl = -1) {
    if (sda < 0) sda = sda_pin;
    if (scl < 0) scl = scl_pin;
    gpio_set_direction((gpio_num_t)sda, GPIO_MODE_INPUT);
    gpio_set_direction((gpio_num_t)scl, GPIO_MODE_INPUT);
    i2c_delay();
    gpio_set_direction((gpio_num_t)sda, GPIO_MODE_OUTPUT);
    gpio_set_level((gpio_num_t)sda, 0);
    i2c_delay();
    gpio_set_direction((gpio_num_t)scl, GPIO_MODE_OUTPUT);
    gpio_set_level((gpio_num_t)scl, 0);
    i2c_delay();
  }

  static void i2c_stop(int sda = -1, int scl = -1) {
    if (sda < 0) sda = sda_pin;
    if (scl < 0) scl = scl_pin;
    gpio_set_direction((gpio_num_t)sda, GPIO_MODE_OUTPUT);
    gpio_set_level((gpio_num_t)sda, 0);
    i2c_delay();
    gpio_set_direction((gpio_num_t)scl, GPIO_MODE_INPUT);
    i2c_delay();
    gpio_set_direction((gpio_num_t)sda, GPIO_MODE_INPUT);
    i2c_delay();
  }

  static bool i2c_write_byte(int sda, int scl, uint8_t byte) {
    if (sda < 0) sda = sda_pin;
    if (scl < 0) scl = scl_pin;
    for (int i = 7; i >= 0; i--) {
      if (byte & (1 << i)) {
        gpio_set_direction((gpio_num_t)sda, GPIO_MODE_INPUT);
      } else {
        gpio_set_direction((gpio_num_t)sda, GPIO_MODE_OUTPUT);
        gpio_set_level((gpio_num_t)sda, 0);
      }
      i2c_delay();
      gpio_set_direction((gpio_num_t)scl, GPIO_MODE_INPUT);
      i2c_delay();
      gpio_set_direction((gpio_num_t)scl, GPIO_MODE_OUTPUT);
      gpio_set_level((gpio_num_t)scl, 0);
      i2c_delay();
    }
    gpio_set_direction((gpio_num_t)sda, GPIO_MODE_INPUT);
    i2c_delay();
    gpio_set_direction((gpio_num_t)scl, GPIO_MODE_INPUT);
    i2c_delay();
    int ack = gpio_get_level((gpio_num_t)sda);
    gpio_set_direction((gpio_num_t)scl, GPIO_MODE_OUTPUT);
    gpio_set_level((gpio_num_t)scl, 0);
    i2c_delay();
    return ack == 0;
  }

  static uint8_t i2c_read_byte(int sda, int scl, bool ack) {
    if (sda < 0) sda = sda_pin;
    if (scl < 0) scl = scl_pin;
    gpio_set_direction((gpio_num_t)sda, GPIO_MODE_INPUT);
    uint8_t byte = 0;
    for (int i = 7; i >= 0; i--) {
      i2c_delay();
      gpio_set_direction((gpio_num_t)scl, GPIO_MODE_INPUT);
      i2c_delay();
      if (gpio_get_level((gpio_num_t)sda)) {
        byte |= (1 << i);
      }
      gpio_set_direction((gpio_num_t)scl, GPIO_MODE_OUTPUT);
      gpio_set_level((gpio_num_t)scl, 0);
      i2c_delay();
    }
    if (ack) {
      gpio_set_direction((gpio_num_t)sda, GPIO_MODE_OUTPUT);
      gpio_set_level((gpio_num_t)sda, 0);
    } else {
      gpio_set_direction((gpio_num_t)sda, GPIO_MODE_INPUT);
    }
    i2c_delay();
    gpio_set_direction((gpio_num_t)scl, GPIO_MODE_INPUT);
    i2c_delay();
    gpio_set_direction((gpio_num_t)scl, GPIO_MODE_OUTPUT);
    gpio_set_level((gpio_num_t)scl, 0);
    gpio_set_direction((gpio_num_t)sda, GPIO_MODE_INPUT);
    i2c_delay();
    return byte;
  }

  static bool send_pcf(uint8_t addr, uint8_t data, int sda = -1, int scl = -1) {
    if (sda < 0) sda = sda_pin;
    if (scl < 0) scl = scl_pin;
    i2c_start(sda, scl);
    bool ok = i2c_write_byte(sda, scl, addr << 1);
    if (ok) {
      i2c_write_byte(sda, scl, data);
    }
    i2c_stop(sda, scl);
    return ok;
  }

  static void write_nibble(uint8_t addr, uint8_t nibble, uint8_t mode, uint8_t backlight, int sda = -1, int scl = -1) {
    uint8_t d = (nibble & 0xF0) | (backlight ? 0x08 : 0x00) | (mode ? 0x01 : 0x00);
    send_pcf(addr, d | 0x04, sda, scl);
    esp_rom_delay_us(5);
    send_pcf(addr, d & ~0x04, sda, scl);
    esp_rom_delay_us(50);
  }

  static void send_byte(uint8_t addr, uint8_t value, uint8_t mode, uint8_t backlight = 1, int sda = -1, int scl = -1) {
    write_nibble(addr, value & 0xF0, mode, backlight, sda, scl);
    write_nibble(addr, (value << 4) & 0xF0, mode, backlight, sda, scl);
  }

  static void init(uint8_t addr = 0x27, int sda = 8, int scl = 9) {
    sda_pin = sda;
    scl_pin = scl;
    default_addr = addr;

    gpio_pullup_en((gpio_num_t)sda);
    gpio_pullup_en((gpio_num_t)scl);
    gpio_set_direction((gpio_num_t)sda, GPIO_MODE_INPUT);
    gpio_set_direction((gpio_num_t)scl, GPIO_MODE_INPUT);
    delay(20);

    write_nibble(addr, 0x30, 0, 1, sda, scl);
    delay(5);
    write_nibble(addr, 0x30, 0, 1, sda, scl);
    delay(5);
    write_nibble(addr, 0x30, 0, 1, sda, scl);
    delay(1);
    write_nibble(addr, 0x20, 0, 1, sda, scl);
    delay(1);

    send_byte(addr, 0x28, 0, 1, sda, scl);
    send_byte(addr, 0x0C, 0, 1, sda, scl);
    send_byte(addr, 0x01, 0, 1, sda, scl);
    delay(2);
    send_byte(addr, 0x06, 0, 1, sda, scl);
  }

  static void clear(uint8_t addr = 0x27, uint8_t backlight = 1, int sda = -1, int scl = -1) {
    send_byte(addr, 0x01, 0, backlight, sda, scl);
    delay(2);
  }

  static void set_cursor(uint8_t addr, uint8_t col, uint8_t row, uint8_t backlight = 1, int sda = -1, int scl = -1) {
    const uint8_t row_offsets[] = {0x00, 0x40, 0x14, 0x54};
    if (row >= 4) row = 0;
    send_byte(addr, 0x80 | (col + row_offsets[row]), 0, backlight, sda, scl);
  }

  static void print_str(uint8_t addr, const std::string &str, uint8_t backlight = 1, int sda = -1, int scl = -1) {
    for (char c : str) {
      send_byte(addr, (uint8_t)c, 1, backlight, sda, scl);
    }
  }

  static inline char last_lcd_frame[4][21] = {{0}};

  static void draw_cube(uint8_t addr = 0x27, float rot_x = 0, float rot_y = 0, float rot_z = 0, uint8_t backlight = 1, int sda = -1, int scl = -1) {
    char buf[4][21];
    for (int r = 0; r < 4; r++) {
      for (int c = 0; c < 20; c++) buf[r][c] = ' ';
      buf[r][20] = '\0';
    }

    int norm_y = (((int)rot_y % 360) + 360) % 360;
    int shift = (norm_y / 15) % 6;
    int bx = 1 + (shift >= 3 ? (5 - shift) : shift);

    int norm_x = (((int)rot_x % 360) + 360) % 360;
    bool tilt_down = (norm_x > 60 && norm_x < 240);

    char line0[22], line1[22], line2[22], line3[22];
    if (!tilt_down) {
      snprintf(line0, sizeof(line0), "%*s+-----+  [3D CUBE]", bx + 2, "");
      snprintf(line1, sizeof(line1), "%*s/     /|  P:%4d", bx + 1, "", ((int)rot_x % 360));
      snprintf(line2, sizeof(line2), "%*s+-----+ |  R:%4d", bx, "", ((int)rot_y % 360));
      snprintf(line3, sizeof(line3), "%*s|     | +  Y:%4d", bx, "", ((int)rot_z % 360));
    } else {
      snprintf(line0, sizeof(line0), "%*s|     | +  [3D CUBE]", bx, "");
      snprintf(line1, sizeof(line1), "%*s+-----+ |  P:%4d", bx, "", ((int)rot_x % 360));
      snprintf(line2, sizeof(line2), "%*s\\     \\|  R:%4d", bx + 1, "", ((int)rot_y % 360));
      snprintf(line3, sizeof(line3), "%*s+-----+   Y:%4d", bx + 2, "", ((int)rot_z % 360));
    }

    auto copy_to_buf = [](char dst[21], const char *src) {
      int len = strlen(src);
      for (int i = 0; i < 20; i++) {
        dst[i] = (i < len) ? src[i] : ' ';
      }
      dst[20] = '\0';
    };

    copy_to_buf(buf[0], line0);
    copy_to_buf(buf[1], line1);
    copy_to_buf(buf[2], line2);
    copy_to_buf(buf[3], line3);

    // Differential I2C update: only write changed characters to eliminate flicker completely
    for (int r = 0; r < 4; r++) {
      for (int c = 0; c < 20; c++) {
        if (buf[r][c] != last_lcd_frame[r][c]) {
          set_cursor(addr, c, r, backlight, sda, scl);
          send_byte(addr, (uint8_t)buf[r][c], 1, backlight, sda, scl);
          last_lcd_frame[r][c] = buf[r][c];
        }
      }
    }
  }

  static void show_system_dashboard(size_t file_count, size_t total_bytes, uint8_t addr = 0x27, int sda = 8, int scl = 9) {
    init(addr, sda, scl);
    clear(addr, 1, sda, scl);

    std::string ip = get_current_ip_str();
    set_cursor(addr, 0, 0, 1, sda, scl);
    print_str(addr, "IP:" + ip, 1, sda, scl);

    uint32_t free_kb = esp_get_free_heap_size() / 1024;
    char ram_buf[21];
    snprintf(ram_buf, sizeof(ram_buf), "RAM: %luKB Free", (unsigned long)free_kb);
    set_cursor(addr, 0, 1, 1, sda, scl);
    print_str(addr, ram_buf, 1, sda, scl);

    char files_buf[21];
    snprintf(files_buf, sizeof(files_buf), "Files: %u (%uKB)", (unsigned int)file_count, (unsigned int)(total_bytes / 1024));
    set_cursor(addr, 0, 2, 1, sda, scl);
    print_str(addr, files_buf, 1, sda, scl);

    uint32_t uptime_s = millis() / 1000;
    char up_buf[21];
    snprintf(up_buf, sizeof(up_buf), "Up: %lus  C5-OK", (unsigned long)uptime_s);
    set_cursor(addr, 0, 3, 1, sda, scl);
    print_str(addr, up_buf, 1, sda, scl);
  }

  static std::string scan(int sda = 8, int scl = 9) {
    std::ostringstream res;
    res << "Scanning I2C bus (SDA=GPIO" << sda << ", SCL=GPIO" << scl << ")...\n";
    int count = 0;
    gpio_pullup_en((gpio_num_t)sda);
    gpio_pullup_en((gpio_num_t)scl);
    gpio_set_direction((gpio_num_t)sda, GPIO_MODE_INPUT);
    gpio_set_direction((gpio_num_t)scl, GPIO_MODE_INPUT);

    for (uint8_t addr = 1; addr < 127; addr++) {
      i2c_start(sda, scl);
      bool ack = i2c_write_byte(sda, scl, addr << 1);
      i2c_stop(sda, scl);
      if (ack) {
        char buf[40];
        snprintf(buf, sizeof(buf), "[+] Found I2C Device at 0x%02X\n", addr);
        res << buf;
        count++;
      }
    }
    if (count == 0) {
      res << "No I2C devices found on pins SDA=" << sda << ", SCL=" << scl << ".\n";
    } else {
      res << "Scan complete. Found " << count << " device(s).\n";
    }
    return res.str();
  }
};

class Mpu6050Driver {
 public:
  static inline int sda_pin = 8;
  static inline int scl_pin = 9;
  static inline uint8_t dev_addr = 0x68;
  static inline int16_t gyro_x = 0;
  static inline int16_t gyro_y = 0;
  static inline int16_t gyro_z = 0;
  static inline int16_t accel_x = 0;
  static inline int16_t accel_y = 0;
  static inline int16_t accel_z = 0;
  static inline float temp_c = 0.0f;

  static bool init(uint8_t addr = 0x68, int sda = 8, int scl = 9) {
    dev_addr = addr;
    sda_pin = sda;
    scl_pin = scl;

    gpio_pullup_en((gpio_num_t)sda);
    gpio_pullup_en((gpio_num_t)scl);
    gpio_set_direction((gpio_num_t)sda, GPIO_MODE_INPUT);
    gpio_set_direction((gpio_num_t)scl, GPIO_MODE_INPUT);
    delay(10);

    // Wake up MPU-6050 by writing 0x00 to PWR_MGMT_1 (0x6B)
    I2CLcdDriver::i2c_start(sda, scl);
    bool ok = I2CLcdDriver::i2c_write_byte(sda, scl, dev_addr << 1);
    if (!ok) {
      I2CLcdDriver::i2c_stop(sda, scl);
      return false;
    }
    I2CLcdDriver::i2c_write_byte(sda, scl, 0x6B);
    I2CLcdDriver::i2c_write_byte(sda, scl, 0x00);
    I2CLcdDriver::i2c_stop(sda, scl);
    return true;
  }

  static bool read_all(uint8_t addr = 0x68, int sda = -1, int scl = -1) {
    if (sda < 0) sda = sda_pin;
    if (scl < 0) scl = scl_pin;
    if (addr != 0) dev_addr = addr;

    // Set register address to 0x3B (ACCEL_XOUT_H)
    I2CLcdDriver::i2c_start(sda, scl);
    if (!I2CLcdDriver::i2c_write_byte(sda, scl, dev_addr << 1)) {
      I2CLcdDriver::i2c_stop(sda, scl);
      return false;
    }
    I2CLcdDriver::i2c_write_byte(sda, scl, 0x3B);
    I2CLcdDriver::i2c_stop(sda, scl);

    // Read 14 bytes: 6 accel, 2 temp, 6 gyro
    I2CLcdDriver::i2c_start(sda, scl);
    if (!I2CLcdDriver::i2c_write_byte(sda, scl, (dev_addr << 1) | 1)) {
      I2CLcdDriver::i2c_stop(sda, scl);
      return false;
    }
    uint8_t raw[14];
    for (int i = 0; i < 14; i++) {
      raw[i] = I2CLcdDriver::i2c_read_byte(sda, scl, i < 13);
    }
    I2CLcdDriver::i2c_stop(sda, scl);

    accel_x = (int16_t)((raw[0] << 8) | raw[1]);
    accel_y = (int16_t)((raw[2] << 8) | raw[3]);
    accel_z = (int16_t)((raw[4] << 8) | raw[5]);
    int16_t raw_temp = (int16_t)((raw[6] << 8) | raw[7]);
    temp_c = (raw_temp / 340.0f) + 36.53f;
    gyro_x = (int16_t)((raw[8] << 8) | raw[9]);
    gyro_y = (int16_t)((raw[10] << 8) | raw[11]);
    gyro_z = (int16_t)((raw[12] << 8) | raw[13]);
    return true;
  }
};

class Max7219MatrixDriver {
 public:
  static inline uint8_t matrix_buf[4][8] = {{0}};
  static inline int cur_din = 10;
  static inline int cur_cs = 25;
  static inline int cur_clk = 8;
  static inline int cur_devs = 4;

  static void delay_tick() {
    esp_rom_delay_us(1);
  }

  static void send_byte_raw(uint8_t b, int din, int clk) {
    for (int i = 7; i >= 0; i--) {
      gpio_set_level((gpio_num_t)clk, 0);
      gpio_set_level((gpio_num_t)din, (b & (1 << i)) ? 1 : 0);
      delay_tick();
      gpio_set_level((gpio_num_t)clk, 1);
      delay_tick();
    }
  }

  static void send_all(uint8_t reg, uint8_t data, int din = 10, int cs = 25, int clk = 8, int devs = 4) {
    gpio_set_level((gpio_num_t)cs, 0);
    delay_tick();
    for (int d = 0; d < devs; d++) {
      send_byte_raw(reg, din, clk);
      send_byte_raw(data, din, clk);
    }
    gpio_set_level((gpio_num_t)cs, 1);
    delay_tick();
  }

  static void send_dev(int dev_index, uint8_t reg, uint8_t data, int din = 10, int cs = 25, int clk = 8, int devs = 4) {
    gpio_set_level((gpio_num_t)cs, 0);
    delay_tick();
    for (int d = devs - 1; d >= 0; d--) {
      if (d == dev_index) {
        send_byte_raw(reg, din, clk);
        send_byte_raw(data, din, clk);
      } else {
        send_byte_raw(0x00, din, clk);
        send_byte_raw(0x00, din, clk);
      }
    }
    gpio_set_level((gpio_num_t)cs, 1);
    delay_tick();
  }

  static void init(int din = 10, int cs = 25, int clk = 8, int devs = 4) {
    cur_din = din;
    cur_cs = cs;
    cur_clk = clk;
    cur_devs = (devs > 4) ? 4 : devs;

    gpio_reset_pin((gpio_num_t)din);
    gpio_reset_pin((gpio_num_t)cs);
    gpio_reset_pin((gpio_num_t)clk);
    gpio_set_direction((gpio_num_t)din, GPIO_MODE_OUTPUT);
    gpio_set_direction((gpio_num_t)cs, GPIO_MODE_OUTPUT);
    gpio_set_direction((gpio_num_t)clk, GPIO_MODE_OUTPUT);
    gpio_set_level((gpio_num_t)cs, 1);

    send_all(0x0F, 0x00, din, cs, clk, cur_devs);
    send_all(0x09, 0x00, din, cs, clk, cur_devs);
    send_all(0x0B, 0x07, din, cs, clk, cur_devs);
    send_all(0x0A, 0x04, din, cs, clk, cur_devs);
    send_all(0x0C, 0x01, din, cs, clk, cur_devs);

    clear(din, cs, clk, cur_devs);
  }

  static void clear(int din = 10, int cs = 25, int clk = 8, int devs = 4) {
    for (int d = 0; d < 4; d++) {
      for (int r = 0; r < 8; r++) {
        matrix_buf[d][r] = 0;
        send_dev(d, r + 1, 0, din, cs, clk, devs);
      }
    }
  }

  static void set_brightness(uint8_t val, int din = 10, int cs = 25, int clk = 8, int devs = 4) {
    if (val > 15) val = 15;
    send_all(0x0A, val, din, cs, clk, devs);
  }

  static void set_pixel(int x, int y, int state, int din = 10, int cs = 25, int clk = 8, int devs = 4) {
    if (x < 0 || x >= devs * 8 || y < 0 || y >= 8) return;
    int dev = x / 8;
    int col = x % 8;
    if (state) {
      matrix_buf[dev][y] |= (1 << (7 - col));
    } else {
      matrix_buf[dev][y] &= ~(1 << (7 - col));
    }
    send_dev(dev, y + 1, matrix_buf[dev][y], din, cs, clk, devs);
  }

  static void set_row_raw(int dev, int row, uint8_t byte_val, int din = 10, int cs = 25, int clk = 8, int devs = 4) {
    if (dev < 0 || dev >= devs || row < 0 || row >= 8) return;
    matrix_buf[dev][row] = byte_val;
    send_dev(dev, row + 1, byte_val, din, cs, clk, devs);
  }
};

class SSD1306OledDriver {
 public:
  static inline uint8_t buffer[512] = {0}; // 128x32 / 8 = 512 bytes
  static inline uint8_t oled_addr = 0x3C;
  static inline int sda_pin = 24; // D5 (GPIO24)
  static inline int scl_pin = 23; // D4 (GPIO23)

  static void send_cmd(uint8_t cmd) {
    I2CLcdDriver::i2c_start(sda_pin, scl_pin);
    I2CLcdDriver::i2c_write_byte(sda_pin, scl_pin, oled_addr << 1);
    I2CLcdDriver::i2c_write_byte(sda_pin, scl_pin, 0x00);
    I2CLcdDriver::i2c_write_byte(sda_pin, scl_pin, cmd);
    I2CLcdDriver::i2c_stop(sda_pin, scl_pin);
  }

  static void send_cmds(const uint8_t *cmds, size_t len) {
    for (size_t i = 0; i < len; i++) send_cmd(cmds[i]);
  }

  static void init(uint8_t addr = 0x3C, int sda = 24, int scl = 23) {
    oled_addr = addr;
    sda_pin = sda;
    scl_pin = scl;

    gpio_reset_pin((gpio_num_t)sda);
    gpio_reset_pin((gpio_num_t)scl);
    gpio_pullup_en((gpio_num_t)sda);
    gpio_pullup_en((gpio_num_t)scl);
    gpio_set_direction((gpio_num_t)sda, GPIO_MODE_INPUT);
    gpio_set_direction((gpio_num_t)scl, GPIO_MODE_INPUT);
    delay(20);

    const uint8_t init_seq[] = {
      0xAE,       // Display OFF
      0xD5, 0x80, // Display clock divide
      0xA8, 0x1F, // Multiplex ratio 128x32 (31)
      0xD3, 0x00, // Display offset 0
      0x40,       // Start line 0
      0x8D, 0x14, // Charge pump ON
      0x20, 0x00, // Horizontal addressing mode
      0xA1,       // Segment re-map
      0xC8,       // COM scan direction
      0xDA, 0x02, // COM pins config for 128x32
      0x81, 0x8F, // Contrast
      0xD9, 0xF1, // Precharge
      0xDB, 0x40, // VCOMH
      0xA4,       // Entire display ON
      0xA6,       // Normal display
      0xAF        // Display ON
    };
    send_cmds(init_seq, sizeof(init_seq));
    clear();
    show();
  }

  static void clear() {
    memset(buffer, 0, sizeof(buffer));
  }

  static void set_pixel(int x, int y, int color = 1) {
    if (x < 0 || x >= 128 || y < 0 || y >= 32) return;
    int page = y / 8;
    int bit = y % 8;
    int idx = page * 128 + x;
    if (color) buffer[idx] |= (1 << bit);
    else buffer[idx] &= ~(1 << bit);
  }

  static void show() {
    send_cmd(0x21); send_cmd(0); send_cmd(127);
    send_cmd(0x22); send_cmd(0); send_cmd(3);

    I2CLcdDriver::i2c_start(sda_pin, scl_pin);
    I2CLcdDriver::i2c_write_byte(sda_pin, scl_pin, oled_addr << 1);
    I2CLcdDriver::i2c_write_byte(sda_pin, scl_pin, 0x40);
    for (int i = 0; i < 512; i++) {
      I2CLcdDriver::i2c_write_byte(sda_pin, scl_pin, buffer[i]);
    }
    I2CLcdDriver::i2c_stop(sda_pin, scl_pin);
  }

  static void draw_char(int x, int y, char c, int color = 1) {
    static const uint8_t font5x7[][5] = {
      {0x00,0x00,0x00,0x00,0x00}, {0x00,0x00,0x5F,0x00,0x00}, {0x00,0x07,0x00,0x07,0x00}, {0x14,0x7F,0x14,0x7F,0x14},
      {0x24,0x2A,0x7F,0x2A,0x12}, {0x23,0x13,0x08,0x64,0x62}, {0x36,0x49,0x55,0x22,0x50}, {0x00,0x05,0x03,0x00,0x00},
      {0x00,0x1C,0x22,0x41,0x00}, {0x00,0x41,0x22,0x1C,0x00}, {0x14,0x08,0x3E,0x08,0x14}, {0x08,0x08,0x3E,0x08,0x08},
      {0x00,0x50,0x30,0x00,0x00}, {0x08,0x08,0x08,0x08,0x08}, {0x00,0x60,0x60,0x00,0x00}, {0x20,0x10,0x08,0x04,0x02},
      {0x3E,0x51,0x49,0x45,0x3E}, {0x00,0x42,0x7F,0x40,0x00}, {0x42,0x61,0x51,0x49,0x46}, {0x21,0x41,0x45,0x4B,0x31},
      {0x18,0x12,0x14,0x7F,0x10}, {0x27,0x45,0x45,0x45,0x39}, {0x3C,0x4A,0x49,0x49,0x30}, {0x01,0x71,0x09,0x05,0x03},
      {0x36,0x49,0x49,0x49,0x36}, {0x06,0x49,0x49,0x29,0x1E}, {0x00,0x36,0x36,0x00,0x00}, {0x00,0x56,0x36,0x00,0x00},
      {0x08,0x14,0x22,0x41,0x00}, {0x14,0x14,0x14,0x14,0x14}, {0x00,0x41,0x22,0x14,0x08}, {0x02,0x01,0x51,0x09,0x06},
      {0x32,0x49,0x79,0x41,0x3E}, {0x7E,0x11,0x11,0x11,0x7E}, {0x7F,0x49,0x49,0x49,0x36}, {0x3E,0x41,0x41,0x41,0x22},
      {0x7F,0x41,0x41,0x22,0x1C}, {0x7F,0x49,0x49,0x49,0x41}, {0x7F,0x09,0x09,0x09,0x01}, {0x3E,0x41,0x49,0x49,0x7A},
      {0x7F,0x08,0x08,0x08,0x7F}, {0x00,0x41,0x7F,0x41,0x00}, {0x20,0x40,0x41,0x3F,0x01}, {0x7F,0x08,0x14,0x22,0x41},
      {0x7F,0x40,0x40,0x40,0x40}, {0x7F,0x02,0x0C,0x02,0x7F}, {0x7F,0x04,0x08,0x10,0x7F}, {0x3E,0x41,0x41,0x41,0x3E},
      {0x7F,0x09,0x09,0x09,0x06}, {0x3E,0x41,0x51,0x21,0x5E}, {0x7F,0x09,0x19,0x29,0x46}, {0x46,0x49,0x49,0x49,0x31},
      {0x01,0x01,0x7F,0x01,0x01}, {0x3F,0x40,0x40,0x40,0x3F}, {0x1F,0x20,0x40,0x20,0x1F}, {0x3F,0x40,0x38,0x40,0x3F},
      {0x63,0x14,0x08,0x14,0x63}, {0x07,0x08,0x70,0x08,0x07}, {0x61,0x51,0x49,0x45,0x43}, {0x00,0x7F,0x41,0x41,0x00},
      {0x02,0x04,0x08,0x10,0x20}, {0x00,0x41,0x41,0x7F,0x00}, {0x04,0x02,0x01,0x02,0x04}, {0x40,0x40,0x40,0x40,0x40},
      {0x00,0x01,0x02,0x04,0x00}, {0x20,0x54,0x54,0x54,0x78}, {0x7F,0x48,0x44,0x44,0x38}, {0x38,0x44,0x44,0x44,0x20},
      {0x38,0x44,0x44,0x48,0x7F}, {0x38,0x54,0x54,0x54,0x18}, {0x08,0x7E,0x09,0x01,0x02}, {0x0C,0x52,0x52,0x52,0x3E},
      {0x7F,0x08,0x04,0x04,0x78}, {0x00,0x44,0x7D,0x40,0x00}, {0x20,0x40,0x44,0x3D,0x00}, {0x7F,0x10,0x28,0x44,0x00},
      {0x00,0x41,0x7F,0x40,0x00}, {0x7C,0x04,0x18,0x04,0x78}, {0x7C,0x08,0x04,0x04,0x78}, {0x38,0x44,0x44,0x44,0x38},
      {0x7C,0x14,0x14,0x14,0x08}, {0x08,0x14,0x14,0x18,0x7C}, {0x7C,0x08,0x04,0x04,0x08}, {0x48,0x54,0x54,0x54,0x20},
      {0x04,0x3F,0x44,0x40,0x20}, {0x3C,0x40,0x40,0x20,0x7C}, {0x1C,0x20,0x40,0x20,0x1C}, {0x3C,0x40,0x30,0x40,0x3C},
      {0x44,0x28,0x10,0x28,0x44}, {0x0C,0x50,0x50,0x50,0x3C}, {0x44,0x64,0x54,0x4C,0x44}
    };
    if (c < 32 || c > 122) c = 32;
    const uint8_t *glyph = font5x7[c - 32];
    for (int col = 0; col < 5; col++) {
      uint8_t line = glyph[col];
      for (int row = 0; row < 8; row++) {
        if (line & (1 << row)) set_pixel(x + col, y + row, color);
      }
    }
  }

  static void print_str(int x, int y, const std::string &str, int color = 1) {
    int cur_x = x;
    for (char c : str) {
      if (cur_x + 6 > 128) break;
      draw_char(cur_x, y, c, color);
      cur_x += 6;
    }
  }

  static void print_line(int line_num, const std::string &str) {
    if (line_num < 0 || line_num >= 4) return;
    int y = line_num * 8;
    for (int x = 0; x < 128; x++) {
      for (int dy = 0; dy < 8; dy++) set_pixel(x, y + dy, 0);
    }
    print_str(0, y, str, 1);
  }

  static void fill_rect(int x, int y, int w, int h, int color = 1) {
    for (int i = x; i < x + w; i++) {
      for (int j = y; j < y + h; j++) set_pixel(i, j, color);
    }
  }

  static void draw_line(int x0, int y0, int x1, int y1, int color = 1) {
    int dx = abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    int dy = -abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    int err = dx + dy, e2;
    while (true) {
      set_pixel(x0, y0, color);
      if (x0 == x1 && y0 == y1) break;
      e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  static void draw_3d_cube(float rot_x, float rot_y, float rot_z, int cx = 64, int cy = 16, float size = 11.0f) {
    static const float vertices[8][3] = {
      {-1, -1, -1}, { 1, -1, -1}, { 1,  1, -1}, {-1,  1, -1},
      {-1, -1,  1}, { 1, -1,  1}, { 1,  1,  1}, {-1,  1,  1}
    };
    static const int edges[12][2] = {
      {0,1}, {1,2}, {2,3}, {3,0},
      {4,5}, {5,6}, {6,7}, {7,4},
      {0,4}, {1,5}, {2,6}, {3,7}
    };

    float rad_x = rot_x * 0.0174533f;
    float rad_y = rot_y * 0.0174533f;
    float rad_z = rot_z * 0.0174533f;

    float cx_sin = sinf(rad_x), cx_cos = cosf(rad_x);
    float cy_sin = sinf(rad_y), cy_cos = cosf(rad_y);
    float cz_sin = sinf(rad_z), cz_cos = cosf(rad_z);

    int proj_x[8], proj_y[8];

    for (int i = 0; i < 8; i++) {
      float x = vertices[i][0] * size;
      float y = vertices[i][1] * size;
      float z = vertices[i][2] * size;

      // Rotation around X
      float y1 = y * cx_cos - z * cx_sin;
      float z1 = y * cx_sin + z * cx_cos;

      // Rotation around Y
      float x2 = x * cy_cos + z1 * cy_sin;
      float z2 = -x * cy_sin + z1 * cy_cos;

      // Rotation around Z
      float x3 = x2 * cz_cos - y1 * cz_sin;
      float y3 = x2 * cz_sin + y1 * cz_cos;

      // Perspective projection onto 128x32 screen
      float distance = 36.0f;
      float fov = 30.0f;
      float z_proj = z2 + distance;
      if (z_proj < 1.0f) z_proj = 1.0f;

      proj_x[i] = cx + (int)(x3 * fov / z_proj);
      proj_y[i] = cy + (int)(y3 * fov / z_proj);
    }

    for (int i = 0; i < 12; i++) {
      int p0 = edges[i][0];
      int p1 = edges[i][1];
      draw_line(proj_x[p0], proj_y[p0], proj_x[p1], proj_y[p1], 1);
    }
  }

  static inline std::vector<std::string> console_lines;

  static void clear_console() {
    console_lines.clear();
    clear();
    show();
  }

  static void console_print(const std::string &str, uint8_t addr = 0x3C, int sda = -1, int scl = -1) {
    if (sda >= 0) sda_pin = sda;
    if (scl >= 0) scl_pin = scl;
    if (addr != 0) oled_addr = addr;

    std::istringstream iss(str);
    std::string line;
    while (std::getline(iss, line)) {
      if (line.empty()) continue;
      while (line.length() > 21) {
        console_lines.push_back(line.substr(0, 21));
        line = line.substr(21);
      }
      console_lines.push_back(line);
      while (console_lines.size() > 4) {
        console_lines.erase(console_lines.begin());
      }
    }

    clear();
    for (size_t i = 0; i < console_lines.size(); i++) {
      print_str(0, i * 8, console_lines[i], 1);
    }
    show();
  }

  static void start_sleeping_animation(uint8_t addr = 0x3C, int sda = 8, int scl = 9) {
    init(addr, sda, scl);
    clear();
    for (int x = 0; x <= 128; x += 8) {
      for (int i = 0; i < x; i++) {
        for (int j = 0; j < 32; j++) set_pixel(i, j, 1);
      }
      show();
      esp_rom_delay_us(5000);
    }
    memset(buffer, 0xFF, sizeof(buffer));
    print_str(36, 12, "SLEEPING", 0);
    tick_sleeping_spinner(0);
  }

  static void tick_sleeping_spinner(int frame) {
    static const char spin_chars[] = {'|', '/', '-', '\\'};
    char sc = spin_chars[frame % 4];
    for (int dx = 94; dx < 104; dx++) {
      for (int dy = 10; dy < 22; dy++) set_pixel(dx, dy, 1);
    }
    draw_char(96, 12, sc, 0);
    show();
  }

  static void show_ota_progress(int percent, uint8_t addr = 0x3C, int sda = 8, int scl = 9) {
    init(addr, sda, scl);
    clear();
    print_str(0, 0, "=== OTA UPGRADE ===");
    char pbuf[24];
    snprintf(pbuf, sizeof(pbuf), "Flashing: %d%%", percent);
    print_str(0, 10, pbuf);
    for (int x = 0; x < 128; x++) { set_pixel(x, 22, 1); set_pixel(x, 31, 1); }
    for (int y = 22; y <= 31; y++) { set_pixel(0, y, 1); set_pixel(127, y, 1); }
    int fill_w = (percent * 124) / 100;
    for (int x = 2; x < 2 + fill_w; x++) {
      for (int y = 24; y <= 29; y++) set_pixel(x, y, 1);
    }
    show();
  }

  static void show_ota_complete(uint8_t addr = 0x3C, int sda = 8, int scl = 9) {
    init(addr, sda, scl);
    clear();
    print_str(0, 4, "=== OTA COMPLETE ===");
    print_str(0, 16, "Rebooting XIAO-C5...");
    show();
  }

  static void show_system_dashboard(size_t file_count, size_t total_bytes, uint8_t addr = 0x3C, int sda = 8, int scl = 9) {
    init(addr, sda, scl);
    clear();
    std::string ip = get_current_ip_str();
    print_str(0, 0, "IP: " + ip);

    uint32_t free_kb = esp_get_free_heap_size() / 1024;
    char ram_buf[24];
    snprintf(ram_buf, sizeof(ram_buf), "RAM: %luKB Free", (unsigned long)free_kb);
    print_str(0, 8, ram_buf);

    char files_buf[24];
    snprintf(files_buf, sizeof(files_buf), "Files: %u (%uKB)", (unsigned int)file_count, (unsigned int)(total_bytes / 1024));
    print_str(0, 16, files_buf);

    uint32_t uptime_s = millis() / 1000;
    char up_buf[24];
    snprintf(up_buf, sizeof(up_buf), "Up: %lus  XIAO-C5", (unsigned long)uptime_s);
    print_str(0, 24, up_buf);

    show();
  }
};

class DisplayManager {
 public:
  static bool probe_i2c(uint8_t addr, int sda, int scl) {
    gpio_reset_pin((gpio_num_t)sda);
    gpio_reset_pin((gpio_num_t)scl);
    gpio_pullup_en((gpio_num_t)sda);
    gpio_pullup_en((gpio_num_t)scl);
    gpio_set_direction((gpio_num_t)sda, GPIO_MODE_INPUT);
    gpio_set_direction((gpio_num_t)scl, GPIO_MODE_INPUT);

    I2CLcdDriver::i2c_start(sda, scl);
    bool ack = I2CLcdDriver::i2c_write_byte(sda, scl, addr << 1);
    I2CLcdDriver::i2c_stop(sda, scl);
    return ack;
  }

  static void update_status_auto(size_t file_count, size_t total_bytes) {
    // 1. Probe for OLED (SSD1306) on SCL=D9/GPIO9, SDA=D8/GPIO8
    if (probe_i2c(0x3C, 8, 9)) {
      SSD1306OledDriver::show_system_dashboard(file_count, total_bytes, 0x3C, 8, 9);
      return;
    }
    if (probe_i2c(0x3D, 8, 9)) {
      SSD1306OledDriver::show_system_dashboard(file_count, total_bytes, 0x3D, 8, 9);
      return;
    }

    // 2. Probe for LCD 2004A / 1602 on SCL=D9/GPIO9, SDA=D8/GPIO8
    if (probe_i2c(0x27, 8, 9)) {
      I2CLcdDriver::show_system_dashboard(file_count, total_bytes, 0x27, 8, 9);
      return;
    }
    if (probe_i2c(0x3F, 8, 9)) {
      I2CLcdDriver::show_system_dashboard(file_count, total_bytes, 0x3F, 8, 9);
      return;
    }

    // 3. Probe for OLED on secondary pins (SDA=D5/24, SCL=D4/23)
    if (probe_i2c(0x3C, 24, 23)) {
      SSD1306OledDriver::show_system_dashboard(file_count, total_bytes, 0x3C, 24, 23);
      return;
    }
    if (probe_i2c(0x3D, 24, 23)) {
      SSD1306OledDriver::show_system_dashboard(file_count, total_bytes, 0x3D, 24, 23);
      return;
    }

    // 4. Probe for LCD on secondary pins (SDA=D5/24, SCL=D4/23)
    if (probe_i2c(0x27, 24, 23)) {
      I2CLcdDriver::show_system_dashboard(file_count, total_bytes, 0x27, 24, 23);
      return;
    }
    if (probe_i2c(0x3F, 24, 23)) {
      I2CLcdDriver::show_system_dashboard(file_count, total_bytes, 0x3F, 24, 23);
      return;
    }

    // Default fallback: Try OLED on requested pinout SCL=D9, SDA=D8
    SSD1306OledDriver::show_system_dashboard(file_count, total_bytes, 0x3C, 8, 9);
  }

  static void start_sleeping_animation() {
    if (probe_i2c(0x3C, 8, 9)) {
      SSD1306OledDriver::start_sleeping_animation(0x3C, 8, 9);
      return;
    }
    if (probe_i2c(0x27, 8, 9)) {
      I2CLcdDriver::init(0x27, 8, 9);
      I2CLcdDriver::clear(0x27, 1, 8, 9);
      I2CLcdDriver::set_cursor(0x27, 0, 1, 1, 8, 9);
      I2CLcdDriver::print_str(0x27, "    [ SLEEPING ]    ", 1, 8, 9);
      return;
    }
    if (probe_i2c(0x3C, 24, 23)) {
      SSD1306OledDriver::start_sleeping_animation(0x3C, 24, 23);
      return;
    }
    SSD1306OledDriver::start_sleeping_animation(0x3C, 8, 9);
  }

  static void tick_sleeping_spinner(int frame) {
    SSD1306OledDriver::tick_sleeping_spinner(frame);
    if (probe_i2c(0x27, 8, 9)) {
      static const char spin_chars[] = {'|', '/', '-', '\\'};
      I2CLcdDriver::set_cursor(0x27, 17, 1, 1, 8, 9);
      std::string s(1, spin_chars[frame % 4]);
      I2CLcdDriver::print_str(0x27, s, 1, 8, 9);
    }
  }

  static void show_ota_progress(int percent) {
    if (probe_i2c(0x3C, 8, 9)) {
      SSD1306OledDriver::show_ota_progress(percent, 0x3C, 8, 9);
    } else if (probe_i2c(0x3C, 24, 23)) {
      SSD1306OledDriver::show_ota_progress(percent, 0x3C, 24, 23);
    } else {
      SSD1306OledDriver::show_ota_progress(percent, 0x3C, 8, 9);
    }

    if (probe_i2c(0x27, 8, 9)) {
      I2CLcdDriver::init(0x27, 8, 9);
      I2CLcdDriver::set_cursor(0x27, 0, 0, 1, 8, 9);
      I2CLcdDriver::print_str(0x27, "=== OTA UPGRADE ===", 1, 8, 9);
      I2CLcdDriver::set_cursor(0x27, 0, 1, 1, 8, 9);
      char buf[21];
      snprintf(buf, sizeof(buf), "Flashing: %d%%      ", percent);
      I2CLcdDriver::print_str(0x27, buf, 1, 8, 9);
    }
  }

  static void show_ota_complete() {
    SSD1306OledDriver::show_ota_complete(0x3C, 8, 9);
    if (probe_i2c(0x27, 8, 9)) {
      I2CLcdDriver::init(0x27, 8, 9);
      I2CLcdDriver::clear(0x27, 1, 8, 9);
      I2CLcdDriver::set_cursor(0x27, 0, 0, 1, 8, 9);
      I2CLcdDriver::print_str(0x27, "=== OTA COMPLETE ===", 1, 8, 9);
      I2CLcdDriver::set_cursor(0x27, 0, 1, 1, 8, 9);
      I2CLcdDriver::print_str(0x27, "Rebooting...", 1, 8, 9);
    }
  }
};

class ScriptEngine {
 public:
  struct LoopFrame {
    size_t start_pc;
    size_t end_pc;
    enum LoopType { REPEAT_TYPE, WHILE_TYPE, FOR_TYPE } type;
    int remaining_count;
    std::string cond_expr;
    std::string step_expr;
  };

  static inline volatile bool script_stop_requested{false};
  static inline volatile bool script_is_running{false};
  static inline TaskHandle_t script_task_handle{nullptr};
  static inline std::string script_output_buffer{""};

  static int to_gpio(int p) {
    if (p == 0) return 1;   // D0 -> GPIO1
    if (p == 1) return 0;   // D1 -> GPIO0
    if (p == 2) return 25;  // D2 -> GPIO25
    if (p == 3) return 7;   // D3 -> GPIO7
    if (p == 4) return 23;  // D4 -> GPIO23
    if (p == 5) return 24;  // D5 -> GPIO24
    if (p == 6) return 11;  // D6 -> GPIO11
    if (p == 7) return 12;  // D7 -> GPIO12
    if (p == 8) return 8;   // D8 -> GPIO8
    if (p == 9) return 9;   // D9 -> GPIO9
    if (p == 10) return 10; // D10 -> GPIO10
    return p;
  }

  struct ScriptTaskParam {
    std::string code;
    size_t file_count;
    size_t total_bytes;
  };

  static void start_async(const std::string &code, size_t file_count = 0, size_t total_bytes = 0) {
    stop();

    script_stop_requested = false;
    script_is_running = true;
    script_output_buffer = "// Running script in background task...\n";

    ScriptTaskParam *param = new ScriptTaskParam{code, file_count, total_bytes};
    xTaskCreate([](void *arg) {
      ScriptTaskParam *p = static_cast<ScriptTaskParam *>(arg);
      std::string res = ScriptEngine::run(p->code, p->file_count, p->total_bytes);
      script_output_buffer = res;
      script_is_running = false;
      script_task_handle = nullptr;
      delete p;
      vTaskDelete(NULL);
    }, "script_worker", 8192, param, 1, &script_task_handle);
  }

  static void stop() {
    script_stop_requested = true;
    if (script_task_handle != nullptr) {
      TaskHandle_t th = script_task_handle;
      script_task_handle = nullptr;
      vTaskDelete(th);
    }
    script_is_running = false;
    script_output_buffer += "\n[FORCE STOPPED] Script execution terminated immediately by user.\n";
  }

  static bool is_running() {
    return script_is_running;
  }

  static std::string get_output() {
    return script_output_buffer;
  }

  static bool code_uses_custom_lcd_or_btn(const std::string &code) {
    std::string lower = code;
    std::transform(lower.begin(), lower.end(), lower.begin(), ::tolower);
    if (lower.find("lcd_print") != std::string::npos ||
        lower.find("lcdprint") != std::string::npos ||
        lower.find("lcd_init") != std::string::npos ||
        lower.find("lcdinit") != std::string::npos ||
        lower.find("lcd_set_cursor") != std::string::npos ||
        lower.find("lcdsetcursor") != std::string::npos ||
        lower.find("lcd_clear") != std::string::npos ||
        lower.find("lcdclear") != std::string::npos ||
        lower.find("oled_print") != std::string::npos ||
        lower.find("oledprint") != std::string::npos ||
        lower.find("oled_init") != std::string::npos ||
        lower.find("oledinit") != std::string::npos ||
        lower.find("oled_set_pixel") != std::string::npos ||
        lower.find("oled_clear") != std::string::npos ||
        lower.find("oledclear") != std::string::npos ||
        lower.find("boot_btn") != std::string::npos ||
        lower.find("bootbtn") != std::string::npos ||
        lower.find("28") != std::string::npos) {
      return true;
    }
    return false;
  }

  static std::string run(const std::string &code, size_t file_count = 0, size_t total_bytes = 0) {
    script_is_running = true;
    script_stop_requested = false;

    std::ostringstream out;
    std::map<std::string, double> vars;
    vars["LED"] = 27;       // Onboard User LED (GPIO27)
    vars["BOOT_BTN"] = 28;  // Onboard Boot Button (GPIO28)
    vars["D0"] = 1;
    vars["D1"] = 0;
    vars["D2"] = 25;        // CS for Matrix
    vars["D3"] = 7;
    vars["D4"] = 23;        // I2C SDA (LCD) / SCL (OLED)
    vars["D5"] = 24;        // I2C SCL (LCD) / SDA (OLED)
    vars["D6"] = 11;
    vars["D7"] = 12;
    vars["D8"] = 8;         // CLK for Matrix
    vars["D9"] = 9;
    vars["D10"] = 10;       // DIN for Matrix
    vars["LCD_ADDR"] = 0x27;
    vars["OLED_ADDR"] = 0x3C;

    uint8_t default_lcd_addr = 0x27;
    uint8_t default_oled_addr = 0x3C;
    uint8_t lcd_backlight = 1;

    int matrix_din = 10;
    int matrix_cs = 25;
    int matrix_clk = 8;
    int matrix_devs = 4;

    out << "=== Seeed XIAO ESP32-C5 Execution Output ===\n";
    uint32_t start_time = millis();

    std::vector<std::string> lines;
    std::istringstream stream(code);
    std::string line;
    while (std::getline(stream, line)) {
      lines.push_back(line);
    }

    std::vector<LoopFrame> loop_stack;
    size_t pc = 0;
    int max_ops = 10000;
    int op_count = 0;

    while (pc < lines.size() && op_count < max_ops) {
      if (script_stop_requested) {
        out << "\n[STOPPED] Execution stopped by user.\n";
        break;
      }

      op_count++;
      std::string current_line = trim(lines[pc]);
      size_t current_pc = pc;
      pc++;

      if (current_line.empty() || current_line.rfind("//", 0) == 0 || current_line.rfind("#", 0) == 0) {
        continue;
      }

      // Loop constructs
      if (current_line.rfind("repeat(", 0) == 0 || current_line.rfind("loop(", 0) == 0) {
        size_t p1 = current_line.find('(');
        size_t p2 = current_line.find(')', p1);
        int count = 0;
        if (p1 != std::string::npos && p2 != std::string::npos) {
          count = (int)eval_val(trim(current_line.substr(p1 + 1, p2 - p1 - 1)), vars);
        }
        size_t matching_end = find_matching_brace(lines, pc);
        if (count > 0) {
          loop_stack.push_back({pc, matching_end, LoopFrame::REPEAT_TYPE, count - 1, "", ""});
        } else {
          pc = matching_end + 1;
        }
        continue;
      }

      if (current_line.rfind("while(", 0) == 0 || current_line.rfind("while (", 0) == 0) {
        size_t p1 = current_line.find('(');
        size_t p2 = current_line.rfind(')');
        std::string cond_str = "";
        if (p1 != std::string::npos && p2 != std::string::npos && p2 > p1 + 1) {
          cond_str = trim(current_line.substr(p1 + 1, p2 - p1 - 1));
        }
        size_t matching_end = find_matching_brace(lines, pc);
        if (eval_cond(cond_str, vars)) {
          loop_stack.push_back({pc, matching_end, LoopFrame::WHILE_TYPE, 0, cond_str, ""});
        } else {
          pc = matching_end + 1;
        }
        continue;
      }

      if (current_line.rfind("for(", 0) == 0 || current_line.rfind("for (", 0) == 0) {
        size_t p1 = current_line.find('(');
        size_t p2 = current_line.rfind(')');
        std::string header = "";
        if (p1 != std::string::npos && p2 != std::string::npos && p2 > p1 + 1) {
          header = trim(current_line.substr(p1 + 1, p2 - p1 - 1));
        }
        size_t semi1 = header.find(';');
        size_t semi2 = header.find(';', semi1 == std::string::npos ? 0 : semi1 + 1);

        if (semi1 != std::string::npos && semi2 != std::string::npos) {
          std::string init_str = trim(header.substr(0, semi1));
          std::string cond_str = trim(header.substr(semi1 + 1, semi2 - semi1 - 1));
          std::string step_str = trim(header.substr(semi2 + 1));

          execute_stmt(init_str, vars);
          size_t matching_end = find_matching_brace(lines, pc);
          if (eval_cond(cond_str, vars)) {
            loop_stack.push_back({pc, matching_end, LoopFrame::FOR_TYPE, 0, cond_str, step_str});
          } else {
            pc = matching_end + 1;
          }
        }
        continue;
      }

      if (current_line == "}" || current_line == "};") {
        if (!loop_stack.empty()) {
          auto &top = loop_stack.back();
          if (top.type == LoopFrame::REPEAT_TYPE) {
            if (top.remaining_count > 0) {
              top.remaining_count--;
              pc = top.start_pc;
            } else {
              loop_stack.pop_back();
            }
          } else if (top.type == LoopFrame::WHILE_TYPE) {
            if (eval_cond(top.cond_expr, vars)) {
              pc = top.start_pc;
            } else {
              loop_stack.pop_back();
            }
          } else if (top.type == LoopFrame::FOR_TYPE) {
            execute_stmt(top.step_expr, vars);
            if (eval_cond(top.cond_expr, vars)) {
              pc = top.start_pc;
            } else {
              loop_stack.pop_back();
            }
          }
        }
        continue;
      }

      if (current_line == "break" || current_line == "break;") {
        if (!loop_stack.empty()) {
          pc = loop_stack.back().end_pc + 1;
          loop_stack.pop_back();
        }
        continue;
      }

      if (current_line == "continue" || current_line == "continue;") {
        if (!loop_stack.empty()) {
          pc = loop_stack.back().end_pc;
        }
        continue;
      }

      // 0.91" I2C OLED Commands (SSD1306) -> Default user pinout: SCL=D9(GPIO9), SDA=D8(GPIO8)
      if (current_line.rfind("oled_init(", 0) == 0 || current_line.rfind("oledInit(", 0) == 0 || current_line == "oled_init()" || current_line == "oled_init") {
        uint8_t addr = 0x3C;
        int sda = 8, scl = 9;
        size_t p1 = current_line.find('(');
        size_t p2 = current_line.find(')', p1);
        if (p1 != std::string::npos && p2 != std::string::npos && p2 > p1 + 1) {
          std::string args = current_line.substr(p1 + 1, p2 - p1 - 1);
          std::vector<std::string> parts;
          std::istringstream ss(args);
          std::string item;
          while (std::getline(ss, item, ',')) parts.push_back(trim(item));
          if (parts.size() >= 1) addr = (uint8_t)eval_val(parts[0], vars);
          if (parts.size() >= 2) sda = to_gpio((int)eval_val(parts[1], vars));
          if (parts.size() >= 3) scl = to_gpio((int)eval_val(parts[2], vars));
        }
        default_oled_addr = addr;
        SSD1306OledDriver::init(addr, sda, scl);
        out << "[OK] Initialized 0.91\" I2C OLED (SSD1306 128x32, addr: 0x" << std::hex << (int)addr << std::dec << ", SCL=" << scl << ", SDA=" << sda << ")\n";
      } else if (current_line == "oled_clear()" || current_line == "oled_clear" || current_line == "oledClear()") {
        SSD1306OledDriver::clear();
        SSD1306OledDriver::show();
        out << "[OK] OLED Display Cleared (Script Control Active)\n";
      } else if (current_line == "oled_idle()" || current_line == "oled_idle" || current_line == "oled_sleep()" || current_line == "oled_sleep") {
        SSD1306OledDriver::start_sleeping_animation(default_oled_addr, 8, 9);
        out << "[OK] OLED Sleeping Animation Started (White Curtain + Black SLEEPING + Spinner)\n";
      } else if (current_line.rfind("oled_spinner(", 0) == 0 || current_line.rfind("oledSpinner(", 0) == 0) {
        size_t p1 = current_line.find('(');
        size_t p2 = current_line.find(')', p1);
        int frame = 0;
        if (p1 != std::string::npos && p2 != std::string::npos && p2 > p1 + 1) {
          frame = (int)eval_val(trim(current_line.substr(p1 + 1, p2 - p1 - 1)), vars);
        }
        SSD1306OledDriver::tick_sleeping_spinner(frame);
      } else if (current_line.rfind("oled_print(", 0) == 0 || current_line.rfind("oledPrint(", 0) == 0) {
        size_t p1 = current_line.find('(');
        size_t p2 = current_line.find(')');
        if (p1 != std::string::npos && p2 != std::string::npos) {
          std::string args = current_line.substr(p1 + 1, p2 - p1 - 1);
          size_t comma1 = args.find(',');
          if (comma1 != std::string::npos) {
            size_t comma2 = args.find(',', comma1 + 1);
            if (comma2 != std::string::npos) {
              // oled_print(x, y, "text")
              int x = (int)eval_val(trim(args.substr(0, comma1)), vars);
              int y = (int)eval_val(trim(args.substr(comma1 + 1, comma2 - comma1 - 1)), vars);
              std::string str_raw = trim(args.substr(comma2 + 1));
              std::string text = (str_raw.size() >= 2 && str_raw.front() == '"' && str_raw.back() == '"') ? str_raw.substr(1, str_raw.size() - 2) : str_raw;
              SSD1306OledDriver::print_str(x, y, text, 1);
            } else {
              // oled_print(line, "text")
              int line_idx = (int)eval_val(trim(args.substr(0, comma1)), vars);
              std::string str_raw = trim(args.substr(comma1 + 1));
              std::string text = (str_raw.size() >= 2 && str_raw.front() == '"' && str_raw.back() == '"') ? str_raw.substr(1, str_raw.size() - 2) : str_raw;
              SSD1306OledDriver::print_line(line_idx, text);
            }
          } else {
            std::string text = (args.size() >= 2 && args.front() == '"' && args.back() == '"') ? args.substr(1, args.size() - 2) : args;
            SSD1306OledDriver::print_line(0, text);
          }
          SSD1306OledDriver::show();
          out << "[OK] OLED Updated\n";
        }
      } else if (current_line.rfind("oled_set_pixel(", 0) == 0 || current_line.rfind("oledSetPixel(", 0) == 0) {
        size_t p1 = current_line.find('(');
        size_t p2 = current_line.find(')', p1);
        if (p1 != std::string::npos && p2 != std::string::npos) {
          std::string args = current_line.substr(p1 + 1, p2 - p1 - 1);
          std::vector<std::string> parts;
          std::istringstream ss(args);
          std::string item;
          while (std::getline(ss, item, ',')) parts.push_back(trim(item));
          int x = 0, y = 0, color = 1;
          if (parts.size() >= 1) x = (int)eval_val(parts[0], vars);
          if (parts.size() >= 2) y = (int)eval_val(parts[1], vars);
          if (parts.size() >= 3) color = (int)eval_val(parts[2], vars);
          SSD1306OledDriver::set_pixel(x, y, color);
        }
      } else if (current_line.rfind("oled_line(", 0) == 0 || current_line.rfind("oledLine(", 0) == 0) {
        size_t p1 = current_line.find('(');
        size_t p2 = current_line.find(')', p1);
        if (p1 != std::string::npos && p2 != std::string::npos) {
          std::string args = current_line.substr(p1 + 1, p2 - p1 - 1);
          std::vector<std::string> parts;
          std::istringstream ss(args);
          std::string item;
          while (std::getline(ss, item, ',')) parts.push_back(trim(item));
          int x0 = 0, y0 = 0, x1 = 0, y1 = 0, color = 1;
          if (parts.size() >= 1) x0 = (int)eval_val(parts[0], vars);
          if (parts.size() >= 2) y0 = (int)eval_val(parts[1], vars);
          if (parts.size() >= 3) x1 = (int)eval_val(parts[2], vars);
          if (parts.size() >= 4) y1 = (int)eval_val(parts[3], vars);
          if (parts.size() >= 5) color = (int)eval_val(parts[4], vars);
          SSD1306OledDriver::draw_line(x0, y0, x1, y1, color);
        }
      } else if (current_line.rfind("oled_cube(", 0) == 0 || current_line.rfind("oledCube(", 0) == 0 || current_line.rfind("oled_draw_cube(", 0) == 0) {
        size_t p1 = current_line.find('(');
        size_t p2 = current_line.find(')', p1);
        if (p1 != std::string::npos && p2 != std::string::npos) {
          std::string args = current_line.substr(p1 + 1, p2 - p1 - 1);
          std::vector<std::string> parts;
          std::istringstream ss(args);
          std::string item;
          while (std::getline(ss, item, ',')) parts.push_back(trim(item));
          float rx = 0.0f, ry = 0.0f, rz = 0.0f;
          int cx = 64, cy = 16;
          float size = 11.0f;
          if (parts.size() >= 1) rx = (float)eval_val(parts[0], vars);
          if (parts.size() >= 2) ry = (float)eval_val(parts[1], vars);
          if (parts.size() >= 3) rz = (float)eval_val(parts[2], vars);
          if (parts.size() >= 4) cx = (int)eval_val(parts[3], vars);
          if (parts.size() >= 5) cy = (int)eval_val(parts[4], vars);
          if (parts.size() >= 6) size = (float)eval_val(parts[5], vars);
          SSD1306OledDriver::draw_3d_cube(rx, ry, rz, cx, cy, size);
        }
      } else if (current_line.rfind("oled_console(", 0) == 0 || current_line.rfind("oled_log(", 0) == 0 || current_line.rfind("oledConsole(", 0) == 0 || current_line.rfind("oledLog(", 0) == 0) {
        size_t p1 = current_line.find('(');
        size_t p2 = current_line.rfind(')');
        if (p1 != std::string::npos && p2 != std::string::npos) {
          std::string arg = trim(current_line.substr(p1 + 1, p2 - p1 - 1));
          std::string text_to_print;
          if (arg.size() >= 2 && arg.front() == '"' && arg.back() == '"') {
            text_to_print = arg.substr(1, arg.length() - 2);
          } else {
            std::ostringstream ss;
            ss << eval_val(arg, vars);
            text_to_print = ss.str();
          }
          SSD1306OledDriver::console_print(text_to_print, default_oled_addr);
          out << "[OLED CONSOLE] " << text_to_print << "\n";
        }
      } else if (current_line == "oled_clear_console()" || current_line == "oled_clear_console") {
        SSD1306OledDriver::clear_console();
        out << "[OK] OLED Console Cleared\n";
      } else if (current_line == "oled_show()" || current_line == "oled_display()" || current_line == "oled_show") {
        SSD1306OledDriver::show();
        out << "[OK] OLED Framebuffer flushed to screen\n";
      } else if (current_line == "oled_status()" || current_line == "oled_status") {
        SSD1306OledDriver::show_system_dashboard(file_count, total_bytes, default_oled_addr, 8, 9);
        out << "[OK] Live System Diagnostics displayed on 0.91\" OLED (SCL=D9, SDA=D8)\n";
      }
      // 8x32 MAX7219 Matrix Commands
      else if (current_line.rfind("matrix_init(", 0) == 0 || current_line.rfind("matrixInit(", 0) == 0 || current_line == "matrix_init()" || current_line == "matrix_init") {
        int din = 10, cs = 25, clk = 8, devs = 4;
        size_t p1 = current_line.find('(');
        size_t p2 = current_line.find(')', p1);
        if (p1 != std::string::npos && p2 != std::string::npos && p2 > p1 + 1) {
          std::string args = current_line.substr(p1 + 1, p2 - p1 - 1);
          std::vector<std::string> parts;
          std::istringstream ss(args);
          std::string item;
          while (std::getline(ss, item, ',')) parts.push_back(trim(item));
          if (parts.size() >= 1) din = (int)eval_val(parts[0], vars);
          if (parts.size() >= 2) cs = (int)eval_val(parts[1], vars);
          if (parts.size() >= 3) clk = (int)eval_val(parts[2], vars);
          if (parts.size() >= 4) devs = (int)eval_val(parts[3], vars);
        }
        matrix_din = din; matrix_cs = cs; matrix_clk = clk; matrix_devs = devs;
        Max7219MatrixDriver::init(din, cs, clk, devs);
        out << "[OK] Initialized 8x32 MAX7219 Matrix (DIN=D" << din << ", CS=D" << cs << ", CLK=D" << clk << ", Devs=" << devs << ")\n";
      } else if (current_line == "matrix_clear()" || current_line == "matrix_clear" || current_line == "matrixClear()") {
        Max7219MatrixDriver::clear(matrix_din, matrix_cs, matrix_clk, matrix_devs);
        out << "[OK] 8x32 Matrix Cleared\n";
      } else if (current_line.rfind("matrix_brightness(", 0) == 0 || current_line.rfind("matrixBrightness(", 0) == 0) {
        size_t p1 = current_line.find('(');
        size_t p2 = current_line.find(')', p1);
        if (p1 != std::string::npos && p2 != std::string::npos) {
          int b = (int)eval_val(trim(current_line.substr(p1 + 1, p2 - p1 - 1)), vars);
          Max7219MatrixDriver::set_brightness((uint8_t)b, matrix_din, matrix_cs, matrix_clk, matrix_devs);
          out << "[OK] Matrix Brightness -> " << b << "\n";
        }
      } else if (current_line.rfind("matrix_set_pixel(", 0) == 0 || current_line.rfind("matrixSetPixel(", 0) == 0) {
        size_t p1 = current_line.find('(');
        size_t p2 = current_line.find(')', p1);
        if (p1 != std::string::npos && p2 != std::string::npos) {
          std::string args = current_line.substr(p1 + 1, p2 - p1 - 1);
          std::vector<std::string> parts;
          std::istringstream ss(args);
          std::string item;
          while (std::getline(ss, item, ',')) parts.push_back(trim(item));
          int x = 0, y = 0, state = 1;
          if (parts.size() >= 1) x = (int)eval_val(parts[0], vars);
          if (parts.size() >= 2) y = (int)eval_val(parts[1], vars);
          if (parts.size() >= 3) state = (int)eval_val(parts[2], vars);
          Max7219MatrixDriver::set_pixel(x, y, state, matrix_din, matrix_cs, matrix_clk, matrix_devs);
        }
      } else if (current_line.rfind("matrix_set_row(", 0) == 0 || current_line.rfind("matrixSetRow(", 0) == 0) {
        size_t p1 = current_line.find('(');
        size_t p2 = current_line.find(')', p1);
        if (p1 != std::string::npos && p2 != std::string::npos) {
          std::string args = current_line.substr(p1 + 1, p2 - p1 - 1);
          std::vector<std::string> parts;
          std::istringstream ss(args);
          std::string item;
          while (std::getline(ss, item, ',')) parts.push_back(trim(item));
          int dev = 0, row = 0; uint8_t byte_val = 0;
          if (parts.size() >= 1) dev = (int)eval_val(parts[0], vars);
          if (parts.size() >= 2) row = (int)eval_val(parts[1], vars);
          if (parts.size() >= 3) byte_val = (uint8_t)eval_val(parts[2], vars);
          Max7219MatrixDriver::set_row_raw(dev, row, byte_val, matrix_din, matrix_cs, matrix_clk, matrix_devs);
        }
      }
      // 2004A I2C LCD Commands
      else if (current_line == "lcd_status()" || current_line == "lcd_status" || current_line == "lcdStatus()" || current_line == "lcd_normal()" || current_line == "lcd_normal" || current_line.rfind("lcd_normal(", 0) == 0 || current_line.rfind("lcd_status(", 0) == 0) {
        int sda = 5, scl = 4;
        size_t p1 = current_line.find('(');
        size_t p2 = current_line.find(')', p1);
        if (p1 != std::string::npos && p2 != std::string::npos && p2 > p1 + 1) {
          std::string args = current_line.substr(p1 + 1, p2 - p1 - 1);
          std::vector<std::string> parts;
          std::istringstream ss(args);
          std::string item;
          while (std::getline(ss, item, ',')) parts.push_back(trim(item));
          if (parts.size() >= 1) sda = to_gpio((int)eval_val(parts[0], vars));
          if (parts.size() >= 2) scl = to_gpio((int)eval_val(parts[1], vars));
        }
        I2CLcdDriver::show_system_dashboard(file_count, total_bytes, default_lcd_addr, sda, scl);
        out << "[OK] Live System Status, Usage, Files & IP displayed on 2004A LCD\n";
      } else if (current_line == "i2c_scan()" || current_line == "i2c_scan" || current_line == "i2cScan()") {
        out << I2CLcdDriver::scan(8, 9);
      } else if (current_line.rfind("lcd_init(", 0) == 0 || current_line.rfind("lcdInit(", 0) == 0 || current_line == "lcd_init()" || current_line == "lcd_init") {
        uint8_t addr = 0x27;
        int sda = 8, scl = 9;
        size_t p1 = current_line.find('(');
        size_t p2 = current_line.find(')', p1);
        if (p1 != std::string::npos && p2 != std::string::npos && p2 > p1 + 1) {
          std::string args = current_line.substr(p1 + 1, p2 - p1 - 1);
          std::vector<std::string> parts;
          std::istringstream ss(args);
          std::string item;
          while (std::getline(ss, item, ',')) parts.push_back(trim(item));
          if (parts.size() >= 1) addr = (uint8_t)eval_val(parts[0], vars);
          if (parts.size() >= 2) sda = to_gpio((int)eval_val(parts[1], vars));
          if (parts.size() >= 3) scl = to_gpio((int)eval_val(parts[2], vars));
        }
        default_lcd_addr = addr;
        I2CLcdDriver::init(addr, sda, scl);
        out << "[OK] Initialized 2004A LCD on I2C (addr: 0x" << std::hex << (int)addr << std::dec << ", SCL=" << scl << ", SDA=" << sda << ")\n";
      } else if (current_line.rfind("lcd_print(", 0) == 0 || current_line.rfind("lcdPrint(", 0) == 0) {
        size_t p1 = current_line.find('(');
        size_t p2 = current_line.find(')');
        if (p1 != std::string::npos && p2 != std::string::npos) {
          std::string arg = trim(current_line.substr(p1 + 1, p2 - p1 - 1));
          std::string text_to_print;
          if (arg.size() >= 2 && arg.front() == '"' && arg.back() == '"') {
            text_to_print = arg.substr(1, arg.length() - 2);
          } else {
            std::ostringstream ss;
            ss << eval_val(arg, vars);
            text_to_print = ss.str();
          }
          I2CLcdDriver::print_str(default_lcd_addr, text_to_print, lcd_backlight);
          out << "[OK] LCD Printed: \"" << text_to_print << "\"\n";
        }
      } else if (current_line.rfind("lcd_set_cursor(", 0) == 0 || current_line.rfind("lcdSetCursor(", 0) == 0) {
        size_t p1 = current_line.find('(');
        size_t comma = current_line.find(',', p1);
        size_t p2 = current_line.find(')', comma);
        if (p1 != std::string::npos && comma != std::string::npos && p2 != std::string::npos) {
          int col = (int)eval_val(trim(current_line.substr(p1 + 1, comma - p1 - 1)), vars);
          int row = (int)eval_val(trim(current_line.substr(comma + 1, p2 - comma - 1)), vars);
          I2CLcdDriver::set_cursor(default_lcd_addr, col, row, lcd_backlight);
          out << "[OK] LCD Cursor -> Col " << col << ", Row " << row << "\n";
        }
      } else if (current_line == "lcd_clear()" || current_line == "lcd_clear" || current_line == "lcdClear()") {
        I2CLcdDriver::clear(default_lcd_addr, lcd_backlight);
        out << "[OK] LCD Cleared\n";
      } else if (current_line.rfind("lcd_backlight(", 0) == 0) {
        size_t p1 = current_line.find('(');
        size_t p2 = current_line.find(')', p1);
        if (p1 != std::string::npos && p2 != std::string::npos) {
          lcd_backlight = (uint8_t)eval_val(trim(current_line.substr(p1 + 1, p2 - p1 - 1)), vars);
          I2CLcdDriver::send_pcf(default_lcd_addr, lcd_backlight ? 0x08 : 0x00);
          out << "[OK] LCD Backlight -> " << (lcd_backlight ? "ON" : "OFF") << "\n";
        }
      } else if (current_line.rfind("lcd_cube(", 0) == 0 || current_line.rfind("lcdCube(", 0) == 0) {
        size_t p1 = current_line.find('(');
        size_t p2 = current_line.find(')', p1);
        float rx = 0, ry = 0, rz = 0;
        if (p1 != std::string::npos && p2 != std::string::npos && p2 > p1 + 1) {
          std::string args = current_line.substr(p1 + 1, p2 - p1 - 1);
          std::vector<std::string> parts;
          std::istringstream ss(args);
          std::string item;
          while (std::getline(ss, item, ',')) parts.push_back(trim(item));
          if (parts.size() >= 1) rx = (float)eval_val(parts[0], vars);
          if (parts.size() >= 2) ry = (float)eval_val(parts[1], vars);
          if (parts.size() >= 3) rz = (float)eval_val(parts[2], vars);
        }
        I2CLcdDriver::draw_cube(default_lcd_addr, rx, ry, rz, lcd_backlight);
      }
      // GY-521 / MPU-6050 IMU Commands
      else if (current_line.rfind("mpu_init(", 0) == 0 || current_line.rfind("mpuInit(", 0) == 0 || current_line == "mpu_init()" || current_line == "mpu_init") {
        uint8_t addr = 0x68;
        int sda = 8, scl = 9;
        size_t p1 = current_line.find('(');
        size_t p2 = current_line.find(')', p1);
        if (p1 != std::string::npos && p2 != std::string::npos && p2 > p1 + 1) {
          std::string args = current_line.substr(p1 + 1, p2 - p1 - 1);
          std::vector<std::string> parts;
          std::istringstream ss(args);
          std::string item;
          while (std::getline(ss, item, ',')) parts.push_back(trim(item));
          if (parts.size() >= 1) addr = (uint8_t)eval_val(parts[0], vars);
          if (parts.size() >= 2) sda = to_gpio((int)eval_val(parts[1], vars));
          if (parts.size() >= 3) scl = to_gpio((int)eval_val(parts[2], vars));
        }
        bool ok = Mpu6050Driver::init(addr, sda, scl);
        if (ok) {
          out << "[OK] Initialized GY-521 MPU-6050 (addr: 0x" << std::hex << (int)addr << std::dec << ", SCL=" << scl << ", SDA=" << sda << ")\n";
        } else {
          out << "[WARN] GY-521 MPU-6050 not responding at 0x" << std::hex << (int)addr << std::dec << " (Check SCL=" << scl << ", SDA=" << sda << ")\n";
        }
      } else if (current_line.rfind("mpu_read(", 0) == 0 || current_line.rfind("mpuRead(", 0) == 0 || current_line == "mpu_read()" || current_line == "mpu_read") {
        uint8_t addr = 0x68;
        int sda = 8, scl = 9;
        size_t p1 = current_line.find('(');
        size_t p2 = current_line.find(')', p1);
        if (p1 != std::string::npos && p2 != std::string::npos && p2 > p1 + 1) {
          std::string args = current_line.substr(p1 + 1, p2 - p1 - 1);
          std::vector<std::string> parts;
          std::istringstream ss(args);
          std::string item;
          while (std::getline(ss, item, ',')) parts.push_back(trim(item));
          if (parts.size() >= 1) addr = (uint8_t)eval_val(parts[0], vars);
          if (parts.size() >= 2) sda = to_gpio((int)eval_val(parts[1], vars));
          if (parts.size() >= 3) scl = to_gpio((int)eval_val(parts[2], vars));
        }
        bool ok = Mpu6050Driver::read_all(addr, sda, scl);
        vars["gyro_x"] = Mpu6050Driver::gyro_x;
        vars["gyro_y"] = Mpu6050Driver::gyro_y;
        vars["gyro_z"] = Mpu6050Driver::gyro_z;
        vars["accel_x"] = Mpu6050Driver::accel_x;
        vars["accel_y"] = Mpu6050Driver::accel_y;
        vars["accel_z"] = Mpu6050Driver::accel_z;
        vars["temp_c"] = Mpu6050Driver::temp_c;
        vars["GYRO_X"] = Mpu6050Driver::gyro_x;
        vars["GYRO_Y"] = Mpu6050Driver::gyro_y;
        vars["GYRO_Z"] = Mpu6050Driver::gyro_z;
        vars["ACCEL_X"] = Mpu6050Driver::accel_x;
        vars["ACCEL_Y"] = Mpu6050Driver::accel_y;
        vars["ACCEL_Z"] = Mpu6050Driver::accel_z;
        vars["TEMP_C"] = Mpu6050Driver::temp_c;
        if (!ok) {
          out << "[WARN] MPU-6050 read timeout\n";
        }
      }
      // GPIO Commands
      else if (current_line.rfind("pin_mode(", 0) == 0 || current_line.rfind("pinMode(", 0) == 0) {
        size_t p1 = current_line.find('(');
        size_t comma = current_line.find(',', p1);
        size_t p2 = current_line.find(')', comma);
        if (p1 != std::string::npos && comma != std::string::npos && p2 != std::string::npos) {
          std::string pin_str = trim(current_line.substr(p1 + 1, comma - p1 - 1));
          std::string mode_str = trim(current_line.substr(comma + 1, p2 - comma - 1));
          int pin = to_gpio((int)eval_val(pin_str, vars));
          if (mode_str == "OUTPUT" || mode_str == "output" || mode_str == "1") {
            gpio_reset_pin((gpio_num_t)pin);
            gpio_set_direction((gpio_num_t)pin, GPIO_MODE_OUTPUT);
            out << "[OK] Set GPIO " << pin << " -> OUTPUT\n";
          } else {
            gpio_reset_pin((gpio_num_t)pin);
            gpio_set_direction((gpio_num_t)pin, GPIO_MODE_INPUT);
            gpio_pullup_en((gpio_num_t)pin);
            out << "[OK] Set GPIO " << pin << " -> INPUT_PULLUP\n";
          }
        }
      } else if (current_line.rfind("digital_write(", 0) == 0 || current_line.rfind("digitalWrite(", 0) == 0) {
        size_t p1 = current_line.find('(');
        size_t comma = current_line.find(',', p1);
        size_t p2 = current_line.find(')', comma);
        if (p1 != std::string::npos && comma != std::string::npos && p2 != std::string::npos) {
          std::string pin_str = trim(current_line.substr(p1 + 1, comma - p1 - 1));
          std::string val_str = trim(current_line.substr(comma + 1, p2 - comma - 1));
          int pin = to_gpio((int)eval_val(pin_str, vars));
          int val = (int)eval_val(val_str, vars);
          gpio_set_level((gpio_num_t)pin, val ? 1 : 0);
          out << "[OK] GPIO " << pin << " = " << (val ? "HIGH (1)" : "LOW (0)") << "\n";
        }
      } else if (current_line.rfind("digital_read(", 0) == 0 || current_line.rfind("digitalRead(", 0) == 0) {
        size_t p1 = current_line.find('(');
        size_t p2 = current_line.find(')', p1);
        if (p1 != std::string::npos && p2 != std::string::npos) {
          std::string pin_str = trim(current_line.substr(p1 + 1, p2 - p1 - 1));
          int pin = to_gpio((int)eval_val(pin_str, vars));
          int val = gpio_get_level((gpio_num_t)pin);
          out << "[OK] Read GPIO " << pin << " -> " << val << "\n";
        }
      } else if (current_line.rfind("delay(", 0) == 0 || current_line.rfind("sleep(", 0) == 0) {
        size_t p1 = current_line.find('(');
        size_t p2 = current_line.find(')', p1);
        if (p1 != std::string::npos && p2 != std::string::npos) {
          std::string ms_str = trim(current_line.substr(p1 + 1, p2 - p1 - 1));
          int ms = (int)eval_val(ms_str, vars);
          if (ms > 5000) ms = 5000;
          int remaining = ms;
          while (remaining > 0 && !script_stop_requested) {
            int chunk = (remaining > 20) ? 20 : remaining;
            delay(chunk);
            remaining -= chunk;
          }
          if (script_stop_requested) {
            out << "\n[STOPPED] Execution stopped by user.\n";
            break;
          }
          if (loop_stack.empty()) {
            out << "[DELAY] Delayed " << ms << " ms\n";
          }
        }
      } else if (current_line.rfind("print(", 0) == 0 || current_line.rfind("println(", 0) == 0) {
        size_t p1 = current_line.find('(');
        size_t p2 = current_line.rfind(')');
        if (p1 != std::string::npos && p2 != std::string::npos) {
          std::string arg = trim(current_line.substr(p1 + 1, p2 - p1 - 1));
          std::string text;
          if (arg.size() >= 2 && arg.front() == '"' && arg.back() == '"') {
            text = arg.substr(1, arg.length() - 2);
          } else {
            std::ostringstream ss;
            ss << eval_val(arg, vars);
            text = ss.str();
          }
          out << text << "\n";
          SSD1306OledDriver::console_print(text);
        }
      } else if (current_line.rfind("http_get(", 0) == 0 || current_line.rfind("httpGet(", 0) == 0 || current_line.rfind("fetch(", 0) == 0) {
        size_t p1 = current_line.find('(');
        size_t p2 = current_line.rfind(')');
        if (p1 != std::string::npos && p2 != std::string::npos) {
          std::string url_raw = trim(current_line.substr(p1 + 1, p2 - p1 - 1));
          std::string url = (url_raw.size() >= 2 && url_raw.front() == '"' && url_raw.back() == '"') ? url_raw.substr(1, url_raw.size() - 2) : url_raw;
          ProxyResponse pr = HttpProxyClient::request(url, "GET");
          out << "[PROXY GET " << pr.status_code << "] " << (pr.body.empty() ? pr.error : pr.body) << "\n";
        }
      } else if (current_line.rfind("http_post(", 0) == 0 || current_line.rfind("httpPost(", 0) == 0) {
        size_t p1 = current_line.find('(');
        size_t p2 = current_line.rfind(')');
        if (p1 != std::string::npos && p2 != std::string::npos) {
          std::string args = current_line.substr(p1 + 1, p2 - p1 - 1);
          size_t comma = args.find(',');
          std::string url_raw = (comma != std::string::npos) ? trim(args.substr(0, comma)) : trim(args);
          std::string body_raw = (comma != std::string::npos) ? trim(args.substr(comma + 1)) : "";
          std::string url = (url_raw.size() >= 2 && url_raw.front() == '"' && url_raw.back() == '"') ? url_raw.substr(1, url_raw.size() - 2) : url_raw;
          std::string body = (body_raw.size() >= 2 && body_raw.front() == '"' && body_raw.back() == '"') ? body_raw.substr(1, body_raw.size() - 2) : body_raw;
          ProxyResponse pr = HttpProxyClient::request(url, "POST", body);
          out << "[PROXY POST " << pr.status_code << "] " << (pr.body.empty() ? pr.error : pr.body) << "\n";
        }
      } else if (current_line.find('=') != std::string::npos) {
        execute_stmt(current_line, vars);
        if (loop_stack.empty()) {
          size_t eq = current_line.find('=');
          std::string var_name = trim(current_line.substr(0, eq));
          out << var_name << " = " << vars[var_name] << "\n";
        }
      } else if (current_line.find("++") != std::string::npos || current_line.find("--") != std::string::npos) {
        execute_stmt(current_line, vars);
      } else if (current_line == "sysinfo" || current_line == "sysinfo()") {
        out << "Chip: Seeed Studio XIAO ESP32-C5 (RISC-V 32-bit)\n";
        out << "Free Heap: " << esp_get_free_heap_size() << " bytes\n";
        out << "Min Free Heap: " << esp_get_minimum_free_heap_size() << " bytes\n";
        out << "Uptime: " << (millis() / 1000) << " seconds\n";
      } else {
        out << "Result: " << eval_val(current_line, vars) << "\n";
      }
    }

    uint32_t elapsed = millis() - start_time;
    out << "\n[Executed in " << elapsed << " ms]\n";
    script_is_running = false;
    return out.str();
  }

 private:
  static std::string trim(const std::string &s) {
    size_t first = s.find_first_not_of(" \t\r\n{;");
    if (first == std::string::npos) return "";
    size_t last = s.find_last_not_of(" \t\r\n{;");
    return s.substr(first, (last - first + 1));
  }

  static size_t find_matching_brace(const std::vector<std::string> &lines, size_t from_pc) {
    int depth = 1;
    for (size_t i = from_pc; i < lines.size(); i++) {
      std::string l = lines[i];
      for (char c : l) {
        if (c == '{') depth++;
        else if (c == '}') {
          depth--;
          if (depth == 0) return i;
        }
      }
    }
    return lines.size();
  }

  static void execute_stmt(const std::string &stmt_raw, std::map<std::string, double> &vars) {
    std::string stmt = stmt_raw;
    size_t sc = stmt.find(';');
    if (sc != std::string::npos) stmt = stmt.substr(0, sc);
    size_t pp = stmt.find("++");
    if (pp != std::string::npos) {
      std::string var = trim(stmt.substr(0, pp));
      if (!var.empty()) vars[var] = vars[var] + 1;
      return;
    }
    size_t mm = stmt.find("--");
    if (mm != std::string::npos) {
      std::string var = trim(stmt.substr(0, mm));
      if (!var.empty()) vars[var] = vars[var] - 1;
      return;
    }
    size_t eq = stmt.find('=');
    if (eq != std::string::npos) {
      std::string var_name = trim(stmt.substr(0, eq));
      std::string expr = trim(stmt.substr(eq + 1));
      if (!var_name.empty()) {
        vars[var_name] = eval_val(expr, vars);
      }
    }
  }

  static bool eval_cond(const std::string &expr_raw, const std::map<std::string, double> &vars) {
    std::string expr = expr_raw;
    size_t first = expr.find_first_not_of(" \t\r\n");
    if (first == std::string::npos) return true;
    size_t last = expr.find_last_not_of(" \t\r\n");
    expr = expr.substr(first, (last - first + 1));

    size_t pos;
    if ((pos = expr.find("==")) != std::string::npos) {
      return std::fabs(eval_val(expr.substr(0, pos), vars) - eval_val(expr.substr(pos + 2), vars)) < 1e-6;
    }
    if ((pos = expr.find("!=")) != std::string::npos) {
      return std::fabs(eval_val(expr.substr(0, pos), vars) - eval_val(expr.substr(pos + 2), vars)) >= 1e-6;
    }
    if ((pos = expr.find("<=")) != std::string::npos) {
      return eval_val(expr.substr(0, pos), vars) <= eval_val(expr.substr(pos + 2), vars) + 1e-6;
    }
    if ((pos = expr.find(">=")) != std::string::npos) {
      return eval_val(expr.substr(0, pos), vars) >= eval_val(expr.substr(pos + 2), vars) - 1e-6;
    }
    if ((pos = expr.find("<")) != std::string::npos) {
      return eval_val(expr.substr(0, pos), vars) < eval_val(expr.substr(pos + 1), vars);
    }
    if ((pos = expr.find(">")) != std::string::npos) {
      return eval_val(expr.substr(0, pos), vars) > eval_val(expr.substr(pos + 1), vars);
    }
    return eval_val(expr, vars) != 0;
  }

  static double eval_val(const std::string &expr_raw, const std::map<std::string, double> &vars) {
    std::string expr = expr_raw;
    size_t first = expr.find_first_not_of(" \t\r\n");
    if (first == std::string::npos) return 0;
    size_t last = expr.find_last_not_of(" \t\r\n");
    expr = expr.substr(first, (last - first + 1));

    if (expr.empty()) return 0;
    if (expr == "HIGH" || expr == "true") return 1;
    if (expr == "LOW" || expr == "false") return 0;
    if (expr == "free_heap()" || expr == "get_free_heap()") return (double)esp_get_free_heap_size();
    if (expr == "uptime()" || expr == "get_uptime()") return (double)(millis() / 1000);

    auto it = vars.find(expr);
    if (it != vars.end()) return it->second;

    size_t plus_pos = expr.find('+');
    if (plus_pos != std::string::npos && plus_pos > 0) {
      return eval_val(expr.substr(0, plus_pos), vars) + eval_val(expr.substr(plus_pos + 1), vars);
    }
    size_t minus_pos = expr.find('-');
    if (minus_pos != std::string::npos && minus_pos > 0) {
      return eval_val(expr.substr(0, minus_pos), vars) - eval_val(expr.substr(minus_pos + 1), vars);
    }
    size_t mul_pos = expr.find('*');
    if (mul_pos != std::string::npos) {
      return eval_val(expr.substr(0, mul_pos), vars) * eval_val(expr.substr(mul_pos + 1), vars);
    }
    size_t div_pos = expr.find('/');
    if (div_pos != std::string::npos) {
      double d = eval_val(expr.substr(div_pos + 1), vars);
      return d == 0 ? 0 : eval_val(expr.substr(0, div_pos), vars) / d;
    }

    char *endptr = nullptr;
    double val = strtod(expr.c_str(), &endptr);
    return val;
  }
};

class CustomWebComponent : public Component, public AsyncWebHandler {
 public:
  void setup() override {
    if (web_server_base::global_web_server_base != nullptr) {
      web_server_base::global_web_server_base->add_handler_without_auth(this);
    }
    gpio_reset_pin(GPIO_NUM_28);
    gpio_set_direction(GPIO_NUM_28, GPIO_MODE_INPUT);
    gpio_pullup_en(GPIO_NUM_28);
    last_screen_refresh_ = millis();
  }

  void loop() override {
    uint32_t now = millis();

    // 1. Button check (GPIO28) -> Immediately auto-detect display and update status
    if (now - last_btn_check_ >= 30) {
      last_btn_check_ = now;
      int btn_level = gpio_get_level(GPIO_NUM_28);
      if (btn_level == 0 && last_btn_state_ == 1 && (now - last_btn_press_time_ > 300)) {
        last_btn_press_time_ = now;
        this->custom_lcd_or_btn_in_use_ = false;
        this->idle_anim_active_ = false;
        size_t total_bytes = 0;
        for (const auto &f : this->files_) total_bytes += f.size;
        DisplayManager::update_status_auto(this->files_.size(), total_bytes);
        this->last_screen_refresh_ = now;
      }
      last_btn_state_ = btn_level;
    }

    // If script is using the screen (e.g. oled_clear() in code studio) or OTA in progress, don't run background refresh
    if (this->custom_lcd_or_btn_in_use_ || this->ota_in_progress_) {
      return;
    }

    // 2. 10-second automatic screen refresh / idle cycle
    if (now - last_screen_refresh_ >= 10000) {
      last_screen_refresh_ = now;
      this->idle_cycle_count_++;
      size_t total_bytes = 0;
      for (const auto &f : this->files_) total_bytes += f.size;

      if (this->idle_cycle_count_ % 2 == 1) {
        // Auto-update live system status
        this->idle_anim_active_ = false;
        DisplayManager::update_status_auto(this->files_.size(), total_bytes);
      } else {
        // Run white curtain slide-in, black "SLEEPING" text, and start spinner
        this->idle_anim_active_ = true;
        this->spinner_frame_ = 0;
        DisplayManager::start_sleeping_animation();
      }
    }

    // 3. Keep spinner rotating during idle animation (non-blocking)
    if (this->idle_anim_active_ && (now - last_spinner_tick_ >= 150)) {
      last_spinner_tick_ = now;
      this->spinner_frame_++;
      DisplayManager::tick_sleeping_spinner(this->spinner_frame_);
    }
  }

  bool canHandle(AsyncWebServerRequest *request) const override {
    char url_buf[AsyncWebServerRequest::URL_BUF_SIZE];
    StringRef u = request->url_to(url_buf);
    return u == "/" || u == "/index.html" || u == "/app" ||
           u == "/api/upload" || u == "/api/files" || u == "/api/download" ||
           u == "/api/delete" || u == "/api/run" || u == "/api/stop" ||
           u == "/api/script_output" ||
           u == "/api/lcd_status" || u == "/api/ota" || u == "/update" ||
           u == "/api/sysinfo" || u == "/proxy" || u == "/api/proxy";
  }

  void handleBody(AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) override {
    char url_buf[AsyncWebServerRequest::URL_BUF_SIZE];
    StringRef u = request->url_to(url_buf);

    if (u == "/api/ota" || u == "/update") {
      if (index == 0) {
        this->ota_bytes_written_ = 0;
        this->ota_error_ = false;
        this->ota_partition_ = esp_ota_get_next_update_partition(nullptr);
        if (this->ota_partition_ != nullptr) {
          esp_err_t err = esp_ota_begin(this->ota_partition_, OTA_WITH_SEQUENTIAL_WRITES, &this->ota_handle_);
          this->ota_in_progress_ = (err == ESP_OK);
          this->ota_error_ = (err != ESP_OK);
        } else {
          this->ota_in_progress_ = false;
          this->ota_error_ = true;
        }
        DisplayManager::show_ota_progress(0);
        this->last_ota_display_update_ = millis();
      }
      if (this->ota_in_progress_ && !this->ota_error_) {
        esp_err_t err = esp_ota_write(this->ota_handle_, data, len);
        if (err == ESP_OK) {
          this->ota_bytes_written_ += len;
          uint32_t now = millis();
          if (total > 0 && (now - this->last_ota_display_update_ >= 10000 || this->ota_bytes_written_ == total)) {
            this->last_ota_display_update_ = now;
            int pct = (int)((this->ota_bytes_written_ * 100) / total);
            DisplayManager::show_ota_progress(pct);
          }
        } else {
          this->ota_error_ = true;
        }
      }
      return;
    }

    if (index == 0) {
      this->body_buffer_.clear();
      this->body_buffer_.reserve(total);
    }
    this->body_buffer_.append(reinterpret_cast<const char *>(data), len);
  }

  void handleRequest(AsyncWebServerRequest *request) override {
    char url_buf[AsyncWebServerRequest::URL_BUF_SIZE];
    StringRef u = request->url_to(url_buf);

    if (u == "/" || u == "/index.html" || u == "/app") {
      serve_app_page(request);
      this->body_buffer_.clear();
      return;
    }

    if (u == "/api/files") {
      serve_file_list(request);
      this->body_buffer_.clear();
      return;
    }

    if (u == "/api/download") {
      serve_download(request);
      this->body_buffer_.clear();
      return;
    }

    if (u == "/api/delete") {
      serve_delete(request);
      this->body_buffer_.clear();
      return;
    }

    if (u == "/api/run") {
      serve_run_script(request);
      this->body_buffer_.clear();
      return;
    }

    if (u == "/api/stop") {
      ScriptEngine::stop();
      this->custom_lcd_or_btn_in_use_ = false;
      request->send(200, "application/json", "{\"status\":\"stopped\"}");
      this->body_buffer_.clear();
      return;
    }

    if (u == "/api/script_output") {
      std::string json = "{\"running\":" + std::string(ScriptEngine::is_running() ? "true" : "false") +
                         ",\"output\":\"" + json_escape(ScriptEngine::get_output()) + "\"}";
      request->send(200, "application/json", json.c_str());
      this->body_buffer_.clear();
      return;
    }

    if (u == "/api/lcd_status") {
      serve_lcd_status(request);
      this->body_buffer_.clear();
      return;
    }

    if (u == "/api/sysinfo") {
      serve_sysinfo(request);
      this->body_buffer_.clear();
      return;
    }

    if (u == "/proxy" || u == "/api/proxy") {
      serve_proxy(request);
      this->body_buffer_.clear();
      return;
    }

    if (u == "/api/ota" || u == "/update") {
      serve_ota_finish(request);
      return;
    }

    if (u == "/api/upload") {
      serve_upload(request);
      this->body_buffer_.clear();
      return;
    }

    request->send(404, "text/plain", "Not Found");
    this->body_buffer_.clear();
  }

  void serve_proxy(AsyncWebServerRequest *request) {
    std::string url = get_param(request, "url");
    if (url.empty()) {
      auto h = request->get_header("X-Target-URL");
      if (h.has_value() && !h.value().empty()) {
        url = h.value();
      }
    }

    if (url.empty()) {
      request->send(400, "text/plain", "Missing target URL parameter (?url=https://...)");
      return;
    }

    std::string method = "GET";
    std::string override_method = get_param(request, "method");
    if (!override_method.empty()) {
      method = override_method;
    } else {
      if (request->method() == HTTP_POST) method = "POST";
      else if (request->method() == HTTP_PUT) method = "PUT";
      else if (request->method() == HTTP_DELETE) method = "DELETE";
    }

    std::string body = this->body_buffer_;

    ProxyResponse resp = HttpProxyClient::request(url, method, body);

    if (!resp.error.empty() && resp.body.empty()) {
      std::string err_json = "{\"error\":\"" + json_escape(resp.error) + "\",\"status\":" + std::to_string(resp.status_code) + "}";
      request->send(resp.status_code > 0 ? resp.status_code : 502, "application/json", err_json.c_str());
      return;
    }

    request->send(resp.status_code > 0 ? resp.status_code : 200, resp.content_type.c_str(), resp.body.c_str());
  }

 private:
  std::vector<StoredFile> files_;
  std::string body_buffer_;
  esp_ota_handle_t ota_handle_{0};
  const esp_partition_t *ota_partition_{nullptr};
  bool ota_in_progress_{false};
  bool ota_error_{false};
  size_t ota_bytes_written_{0};
  bool custom_lcd_or_btn_in_use_{false};
  uint32_t last_btn_check_{0};
  uint32_t last_btn_press_time_{0};
  int last_btn_state_{1};
  uint32_t last_screen_refresh_{0};
  uint32_t last_spinner_tick_{0};
  int idle_cycle_count_{0};
  bool idle_anim_active_{false};
  int spinner_frame_{0};
  uint32_t last_ota_display_update_{0};

  static std::string get_param(AsyncWebServerRequest *request, const std::string &name) {
    std::string hname = "X-File-" + name;
    auto h = request->get_header(hname.c_str());
    if (h.has_value() && !h.value().empty()) {
      return url_decode(h.value());
    }

    if (request->hasParam(name.c_str())) {
      auto *p = request->getParam(name.c_str());
      if (p) return p->value();
    }
    if (request->hasArg(name.c_str())) {
      return request->arg(name.c_str());
    }

    httpd_req_t *r = *request;
    if (r && r->uri) {
      const char *q = strchr(r->uri, '?');
      if (q) {
        std::string query(q + 1);
        std::string key = name + "=";
        size_t pos = query.find(key);
        if (pos != std::string::npos) {
          size_t start = pos + key.length();
          size_t end = query.find('&', start);
          std::string raw_val = (end == std::string::npos) ? query.substr(start) : query.substr(start, end - start);
          return url_decode(raw_val);
        }
      }
    }
    return "";
  }

  static std::string url_decode(const std::string &src) {
    std::string ret = "";
    for (size_t i = 0; i < src.length(); i++) {
      if (src[i] == '%' && i + 2 < src.length()) {
        char hex[3] = { src[i+1], src[i+2], 0 };
        ret += (char)strtol(hex, nullptr, 16);
        i += 2;
      } else if (src[i] == '+') {
        ret += ' ';
      } else {
        ret += src[i];
      }
    }
    return ret;
  }

  void serve_app_page(AsyncWebServerRequest *request) {
    const char *html = R"rawliteral(<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Seeed XIAO ESP32-C5 Studio</title>
<style>
:root {
  --bg: #000000;
  --card: #0a0a0a;
  --border: #333333;
  --border-light: #555555;
  --text: #e0e0e0;
  --text-muted: #888888;
  --text-bright: #ffffff;
  --code-bg: #050505;
  --btn-bg: #141414;
  --btn-hover: #222222;
  --btn-border: #444444;
}
* { box-sizing: border-box; margin: 0; padding: 0; font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, monospace, sans-serif; }
body { background: var(--bg); color: var(--text); padding: 24px 16px; }
.container { max-width: 1000px; margin: 0 auto; }
header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); padding-bottom: 16px; margin-bottom: 20px; }
.title-group h1 { color: var(--text-bright); font-size: 20px; letter-spacing: 0.5px; text-transform: uppercase; }
.title-group p { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
.badge { background: #111111; border: 1px solid var(--border-light); padding: 4px 12px; border-radius: 4px; font-size: 12px; color: var(--text-bright); font-family: monospace; }
.nav-tabs { display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 1px solid var(--border); padding-bottom: 8px; flex-wrap: wrap; }
.tab-btn { background: transparent; border: 1px solid transparent; color: var(--text-muted); padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
.tab-btn:hover { color: var(--text-bright); border: 1px solid var(--border); }
.tab-btn.active { background: #111111; color: var(--text-bright); border: 1px solid var(--border-light); }
.tab-content { display: none; }
.tab-content.active { display: block; }
.card { background: var(--card); border: 1px solid var(--border); border-radius: 4px; padding: 20px; margin-bottom: 20px; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid #1a1a1a; padding-bottom: 10px; }
.card-title { font-size: 14px; color: var(--text-bright); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
.btn { background: var(--btn-bg); color: var(--text-bright); border: 1px solid var(--btn-border); padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; transition: 0.15s; }
.btn:hover { background: var(--btn-hover); border-color: var(--border-light); }
.btn-stop { background: #260a0a !important; border-color: #772222 !important; color: #ff9999 !important; }
.btn-stop:hover { background: #3d1010 !important; border-color: #aa3333 !important; }
.upload-dropzone { border: 1px dashed var(--border-light); border-radius: 4px; padding: 30px; text-align: center; background: #050505; cursor: pointer; margin-bottom: 16px; transition: 0.2s; }
.upload-dropzone:hover { border-color: #888888; background: #0a0a0a; }
.file-list { width: 100%; border-collapse: collapse; margin-top: 10px; }
.file-list th, .file-list td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border); font-size: 12px; font-family: monospace; }
.file-list th { color: var(--text-muted); font-weight: 600; text-transform: uppercase; background: #050505; }
.file-link { color: #ffffff; text-decoration: underline; font-weight: 600; }
.file-link:hover { color: #aaaaaa; }
.editor-container { display: flex; flex-direction: column; gap: 10px; }
textarea.code-editor { width: 100%; height: 220px; background: var(--code-bg); color: #ffffff; border: 1px solid var(--border); border-radius: 4px; padding: 12px; font-family: Consolas, "Fira Code", monospace; font-size: 13px; line-height: 1.5; resize: vertical; outline: none; }
textarea.code-editor:focus { border-color: var(--border-light); }
pre.terminal-output { background: var(--code-bg); color: #e0e0e0; border: 1px solid var(--border); border-radius: 4px; padding: 14px; font-family: Consolas, monospace; font-size: 12px; min-height: 140px; max-height: 300px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; }
.quick-templates { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.template-btn { background: #0e0e0e; border: 1px solid var(--border); color: var(--text); padding: 4px 10px; border-radius: 4px; font-size: 11px; cursor: pointer; text-transform: uppercase; font-family: monospace; }
.template-btn:hover { border-color: var(--border-light); color: #ffffff; }
.status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 16px; }
.status-box { background: #050505; border: 1px solid var(--border); border-radius: 4px; padding: 12px; }
.status-box-title { font-size: 11px; color: var(--text-muted); margin-bottom: 4px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }
.status-box-val { font-size: 13px; color: var(--text-bright); font-weight: 600; font-family: monospace; }
.pin-banner { background: #070707; border: 1px solid var(--border-light); border-radius: 4px; padding: 14px; margin-bottom: 16px; }
.pin-banner-title { font-size: 12px; font-weight: 700; color: var(--text-bright); text-transform: uppercase; margin-bottom: 8px; font-family: monospace; }
.pin-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; font-size: 12px; font-family: monospace; }
.pin-item { background: #111111; border: 1px solid #222222; padding: 6px 10px; border-radius: 3px; }
.progress-bar-container { width: 100%; height: 10px; background: #111111; border: 1px solid var(--border); border-radius: 2px; overflow: hidden; margin-top: 12px; display: none; }
.progress-bar-fill { height: 100%; width: 0%; background: #ffffff; transition: width 0.1s; }
</style>
</head>
<body>
<div class="container">
  <header>
    <div class="title-group">
      <h1>Seeed Studio XIAO ESP32-C5</h1>
      <p>Standalone Web Server and Live Studio</p>
    </div>
    <span class="badge" id="dev-status">ONLINE</span>
  </header>

  <!-- WIRING QUICK REFERENCE BANNER -->
  <div class="pin-banner">
    <div class="pin-banner-title">[ WIRING QUICK REFERENCE ]</div>
    <div class="pin-grid">
      <div class="pin-item"><b>0.91" OLED SCL:</b> D9 (GPIO9)</div>
      <div class="pin-item"><b>0.91" OLED SDA:</b> D8 (GPIO8)</div>
      <div class="pin-item"><b>LCD 2004A SCL:</b> D9 (GPIO9)</div>
      <div class="pin-item"><b>LCD 2004A SDA:</b> D8 (GPIO8)</div>
      <div class="pin-item"><b>GY-521 IMU SCL:</b> D9 (GPIO9)</div>
      <div class="pin-item"><b>GY-521 IMU SDA:</b> D8 (GPIO8)</div>
      <div class="pin-item"><b>8x32 Matrix DIN:</b> D10 (GPIO10)</div>
      <div class="pin-item"><b>8x32 Matrix CS:</b> D2 (GPIO25)</div>
      <div class="pin-item"><b>Power:</b> VCC = 3.3V/5V / GND = GND</div>
    </div>
  </div>

  <div class="nav-tabs">
    <button class="tab-btn active" onclick="switchTab('screen')">Display Controller</button>
    <button class="tab-btn" onclick="switchTab('code')">Code Studio</button>
    <button class="tab-btn" onclick="switchTab('proxy')">Web Proxy</button>
    <button class="tab-btn" onclick="switchTab('files')">File Storage</button>
    <button class="tab-btn" onclick="switchTab('ota')">OTA Upgrade</button>
    <button class="tab-btn" onclick="switchTab('info')">Hardware & Pinout</button>
  </div>

  <!-- DISPLAY STATUS TAB -->
  <div id="tab-screen" class="tab-content active">
    <div class="card">
      <div class="card-header">
        <span class="card-title">Auto-Detecting Display Controller (0.91" OLED & 2004A LCD)</span>
        <button class="btn" onclick="triggerLcdStatus()">Show Status on Display</button>
      </div>

      <div class="status-grid">
        <div class="status-box">
          <div class="status-box-title">IP Address</div>
          <div class="status-box-val" id="stat-ip-val">Loading...</div>
        </div>
        <div class="status-box">
          <div class="status-box-title">0.91" OLED Wiring</div>
          <div class="status-box-val">SCL=D4(GPIO23), SDA=D5(GPIO24)</div>
        </div>
        <div class="status-box">
          <div class="status-box-title">LCD 2004A Wiring</div>
          <div class="status-box-val">SDA=D4(GPIO23), SCL=D5(GPIO24)</div>
        </div>
        <div class="status-box">
          <div class="status-box-title">Storage Used</div>
          <div class="status-box-val" id="stat-storage-used">0 KB</div>
        </div>
      </div>

      <p style="font-size:12px; color:var(--text-muted); line-height:1.6;">
        <b>Auto Display Detection:</b> When you press the onboard <b>Boot Button (GPIO28)</b> or click <b>"Show Status on Display"</b>, the device probes I2C to automatically detect whether a <b>0.91" OLED (SSD1306)</b> or a <b>2004A/1602 LCD</b> is connected and renders live diagnostics.
      </p>
      <div id="lcd-feedback" style="margin-top:12px; font-size:12px; font-family:monospace; color:var(--text-bright);"></div>
    </div>
  </div>

  <!-- CODE RUNNER TAB -->
  <div id="tab-code" class="tab-content">
    <div class="card">
      <div class="card-header">
        <span class="card-title">Live Code Studio</span>
        <div style="display:flex; gap:8px;">
          <button class="btn" id="run-btn" onclick="runCode()">Execute</button>
          <button class="btn btn-stop" id="stop-btn" style="display:none;" onclick="stopCode()">Stop</button>
          <button class="btn" onclick="document.getElementById('code-input').value=''">Clear</button>
        </div>
      </div>

      <div class="quick-templates">
        <span style="font-size:11px; color:var(--text-muted); align-self:center; text-transform:uppercase;">Templates:</span>
        <button class="template-btn" onclick="loadTemplate('dual_anim')">Dual Animation</button>
        <button class="template-btn" onclick="loadTemplate('dual_hi')">Dual Screen "hi!"</button>
        <button class="template-btn" onclick="loadTemplate('oled_demo')">0.91" OLED Demo</button>
        <button class="template-btn" onclick="loadTemplate('oled_idle')">0.91" OLED Idle</button>
        <button class="template-btn" onclick="loadTemplate('oled_status')">0.91" OLED Status</button>
        <button class="template-btn" onclick="loadTemplate('proxy_fetch')">Proxy Fetch API</button>
        <button class="template-btn" onclick="loadTemplate('matrix_snake')">8x32 Snake Loop</button>
        <button class="template-btn" onclick="loadTemplate('matrix_scanner')">8x32 Scanner</button>
        <button class="template-btn" onclick="loadTemplate('repeat_blink')">Repeat Loop</button>
        <button class="template-btn" onclick="loadTemplate('while_count')">While Loop</button>
        <button class="template-btn" onclick="loadTemplate('lcd_status')">LCD Status</button>
        <button class="template-btn" onclick="loadTemplate('lcd_hi')">LCD Print</button>
        <button class="template-btn" onclick="loadTemplate('i2c_scan')">I2C Scan</button>
      </div>

      <div class="editor-container">
        <textarea id="code-input" class="code-editor" spellcheck="false">// 0.91" I2C OLED (SSD1306 128x32) Script
// Wiring: SCL -> D4 (GPIO23), SDA -> D5 (GPIO24), VCC -> 3.3V/5V, GND -> GND
oled_init(0x3C)
oled_clear()

// Print up to 4 lines of crisp 5x7 text
oled_print(0, "XIAO ESP32-C5")
oled_print(1, "0.91 Inch OLED (128x32)")
oled_print(2, "SSD1306 OK (SCL=D4, SDA=D5)")
oled_print(3, "Status: Online")
delay(1500)

// Dynamic animated progress bar on line 3
for (x = 0; x < 120; x = x + 4) {
  for (y = 26; y < 30; y = y + 1) {
    oled_set_pixel(x, y, 1)
  }
  oled_show()
  delay(30)
}

print("0.91 inch OLED script executed successfully!")</textarea>

        <div style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; margin-top:8px;">Console Output:</div>
        <pre id="code-output" class="terminal-output">// Output will appear here...</pre>
      </div>
    </div>
  </div>

  <!-- PROXY TAB -->
  <div id="tab-proxy" class="tab-content">
    <div class="card">
      <div class="card-header">
        <span class="card-title">ESP32-C5 Web & API Proxy</span>
      </div>
      <p style="font-size:12px; color:var(--text-muted); margin-bottom:14px;">
        Relay requests through the ESP32-C5 to fetch external websites and APIs, bypassing CORS or accessing internet endpoints directly from the microcontroller.
      </p>

      <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
        <select id="proxy-method" style="background:#050505; color:var(--text-bright); border:1px solid var(--border); padding:8px 12px; border-radius:4px; font-size:12px; font-weight:600; outline:none;" onchange="toggleProxyBody()">
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="HEAD">HEAD</option>
        </select>
        <input type="text" id="proxy-url" placeholder="https://api.ipify.org?format=json" value="https://api.ipify.org?format=json" style="flex:1; min-width:260px; background:#050505; color:var(--text-bright); border:1px solid var(--border); padding:8px 12px; border-radius:4px; font-family:monospace; font-size:12px; outline:none;">
        <button class="btn" onclick="sendProxyRequest()">Send Proxy Request</button>
      </div>

      <div id="proxy-body-group" style="display:none; margin-bottom:12px;">
        <label style="font-size:11px; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Request Body (JSON / Text):</label>
        <textarea id="proxy-body" style="width:100%; height:80px; background:#050505; color:var(--text-bright); border:1px solid var(--border); border-radius:4px; padding:8px; font-family:monospace; font-size:12px; margin-top:4px; outline:none; resize:vertical;"></textarea>
      </div>

      <div class="quick-templates" style="margin-top:8px;">
        <span style="font-size:11px; color:var(--text-muted); align-self:center; text-transform:uppercase;">Sample APIs:</span>
        <button class="template-btn" onclick="setProxyPreset('https://api.ipify.org?format=json', 'GET')">Public IP</button>
        <button class="template-btn" onclick="setProxyPreset('https://wttr.in/Tokyo?format=3', 'GET')">Tokyo Weather</button>
        <button class="template-btn" onclick="setProxyPreset('https://api.coindesk.com/v1/bpi/currentprice.json', 'GET')">Bitcoin Price</button>
        <button class="template-btn" onclick="setProxyPreset('https://httpbin.org/get', 'GET')">HTTPBin Get</button>
        <button class="template-btn" onclick="setProxyPreset('https://httpbin.org/post', 'POST', '{\x22hello\x22:\x22world\x22}')">HTTPBin Post</button>
      </div>

      <div style="margin-top:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase;">Proxy Output:</span>
          <span id="proxy-status-badge" style="font-size:11px; font-family:monospace; color:var(--text-muted);">Ready</span>
        </div>
        <pre id="proxy-output" class="terminal-output" style="min-height:120px;">// Response will appear here...</pre>
      </div>

      <div style="margin-top:14px; padding:10px; background:#070707; border:1px solid var(--border); border-radius:4px;">
        <span style="font-size:11px; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Direct Endpoint Usage:</span>
        <code style="display:block; margin-top:4px; color:var(--text-bright); font-size:11px; word-break:break-all;">GET http://&lt;ESP32_IP&gt;/proxy?url=https://api.ipify.org?format=json</code>
      </div>
    </div>
  </div>

  <!-- FILE MANAGER TAB -->
  <div id="tab-files" class="tab-content">
    <div class="card">
      <div class="card-header">
        <span class="card-title">Upload File to Storage</span>
      </div>
      <div id="file-dropzone" class="upload-dropzone" onclick="document.getElementById('file-input').click()">
        <p style="font-size:13px; font-weight:600; color:var(--text-bright);">Select or Drop File to Upload</p>
        <p style="font-size:11px; color:var(--text-muted); margin-top:4px;">Supported: HTML, TXT, JSON, Images, Binaries</p>
        <input type="file" id="file-input" style="display:none" onchange="if(this.files[0]) performFileUpload(this.files[0])">
      </div>
      <div id="upload-status" style="font-size:12px; font-family:monospace; margin-bottom:10px;"></div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">Stored Files</span>
        <button class="btn" onclick="loadFiles()">Refresh List</button>
      </div>
      <table class="file-list">
        <thead>
          <tr>
            <th>Filename</th>
            <th>Size</th>
            <th>MIME Type</th>
            <th>Direct Link</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody id="files-tbody">
          <tr><td colspan="5" style="text-align:center; color:var(--text-muted);">Loading files...</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- OTA UPDATE TAB -->
  <div id="tab-ota" class="tab-content">
    <div class="card">
      <div class="card-header">
        <span class="card-title">Over-the-Air (OTA) Firmware Upgrade</span>
      </div>
      <p style="font-size:12px; color:var(--text-muted); margin-bottom:16px;">
        Upload firmware.ota.bin to upgrade firmware over Wi-Fi without physical cables.
      </p>

      <div id="ota-dropzone" class="upload-dropzone" onclick="document.getElementById('ota-input').click()">
        <p style="font-size:13px; font-weight:600; color:var(--text-bright);">Select or Drop firmware.ota.bin</p>
        <p style="font-size:11px; color:var(--text-muted); margin-top:4px;">Target: ESP32-C5 Flash Partition</p>
        <input type="file" id="ota-input" accept=".bin" style="display:none" onchange="if(this.files[0]) performOtaSelect(this.files[0])">
      </div>

      <div id="ota-file-details" style="display:none; margin-bottom:16px;">
        <span style="font-size:12px; font-family:monospace; color:var(--text-bright);">Selected: <b id="ota-file-name"></b> (<span id="ota-file-size"></span>)</span>
        <div style="margin-top:10px;">
          <button class="btn" id="ota-upload-btn" onclick="uploadOtaFirmware()">Start OTA Upgrade</button>
        </div>
      </div>

      <div class="progress-bar-container" id="ota-progress-container">
        <div class="progress-bar-fill" id="ota-progress-fill"></div>
      </div>

      <div id="ota-status-msg" style="margin-top:12px; font-size:12px; font-family:monospace;"></div>
    </div>
  </div>

  <!-- SYSTEM TAB -->
  <div id="tab-info" class="tab-content">
    <div class="card">
      <div class="card-header">
        <span class="card-title">Hardware Pinout & Configuration</span>
      </div>
      <table class="file-list">
        <thead><tr><th>XIAO Pin</th><th>GPIO</th><th>Hardware Assignment / Wiring</th></tr></thead>
        <tbody>
          <tr><td><b>D9 (SCL)</b></td><td>GPIO9</td><td><b>I2C SCL</b> (0.91" OLED / LCD 2004A / GY-521 IMU SCL)</td></tr>
          <tr><td><b>D8 (SDA)</b></td><td>GPIO8</td><td><b>I2C SDA</b> (0.91" OLED / LCD 2004A / GY-521 IMU SDA)</td></tr>
          <tr><td><b>D10 (MOSI)</b></td><td>GPIO10</td><td><b>8x32 Matrix DIN</b> (Connect to 1088AS MAX7219 DIN)</td></tr>
          <tr><td><b>D2</b></td><td>GPIO25</td><td><b>8x32 Matrix CS</b> (Connect to 1088AS MAX7219 CS/LOAD)</td></tr>
          <tr><td><b>D4</b></td><td>GPIO23</td><td>General Purpose Digital I/O / ADC</td></tr>
          <tr><td><b>D5</b></td><td>GPIO24</td><td>General Purpose Digital I/O / ADC</td></tr>
          <tr><td><b>User LED</b></td><td>GPIO27</td><td>Onboard Active-HIGH User LED</td></tr>
          <tr><td><b>Boot Button</b></td><td>GPIO28</td><td>Onboard Button (Status display refresh)</td></tr>
          <tr><td><b>D0</b></td><td>GPIO1</td><td>ADC / Digital I/O</td></tr>
          <tr><td><b>D1</b></td><td>GPIO0</td><td>ADC / Digital I/O</td></tr>
          <tr><td><b>D3</b></td><td>GPIO7</td><td>ADC / Digital I/O</td></tr>
          <tr><td><b>D6</b></td><td>GPIO11</td><td>UART TX / Digital I/O</td></tr>
          <tr><td><b>D7</b></td><td>GPIO12</td><td>UART RX / Digital I/O</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</div>

<script>
let selectedOtaFile = null;
let isRunning = false;

function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('tab-' + tabId).classList.add('active');
  if (tabId === 'files' || tabId === 'screen') loadFiles();
}

const templates = {
  oled_demo: `// 0.91" I2C OLED (SSD1306 128x32) Demo
// Wiring: SCL=D9(GPIO9), SDA=D8(GPIO8), VCC=3.3V/5V, GND=GND
oled_init(0x3C)
oled_clear()

// Print crisp text across 4 lines
oled_print(0, "XIAO ESP32-C5")
oled_print(1, "0.91 Inch OLED (128x32)")
oled_print(2, "SSD1306 Driver OK!")
oled_print(3, "Ready for commands")
delay(1500)

// Progress line sweep animation
for (x = 0; x < 124; x = x + 3) {
  for (y = 26; y < 30; y = y + 1) {
    oled_set_pixel(x, y, 1)
  }
  oled_show()
  delay(20)
}
print("OLED Demo Finished!")`,

  oled_idle: `// 0.91" OLED Sleeping Animation & Spinner
// (Slide-in white curtain, black SLEEPING text, rotating spinner)
oled_init(0x3C)
oled_idle()
repeat(20) {
  for (frame = 0; frame < 4; frame = frame + 1) {
    oled_spinner(frame)
    delay(150)
  }
}
print("Idle animation demo finished!")`,

  oled_status: `// 0.91" OLED Live System Dashboard (SCL=D9, SDA=D8)
oled_status()`,

  matrix_snake: `// 8x32 Smooth Snake Loop using 'for' and 'repeat'
matrix_init(10, 25, 8, 4)
matrix_brightness(6)
matrix_clear()

matrix_set_pixel(28, 3, 1)

for (x = 0; x < 28; x = x + 1) {
  matrix_set_pixel(x, 3, 1)
  if (x >= 4) {
    tail = x - 4
    matrix_set_pixel(tail, 3, 0)
  }
  delay(40)
}

print("Snake ate food at (28,3)!")
repeat(3) {
  matrix_brightness(14)
  delay(80)
  matrix_brightness(2)
  delay(80)
}
print("Done!")`,

  matrix_scanner: `// 8x32 Cylon / Scanner Wave with Nested Loops
matrix_init(10, 25, 8, 4)
matrix_brightness(6)

repeat(2) {
  for (col = 0; col < 32; col = col + 1) {
    matrix_clear()
    for (row = 0; row < 8; row = row + 1) {
      matrix_set_pixel(col, row, 1)
    }
    delay(25)
  }
}
matrix_clear()
print("Scan wave complete!")`,

  repeat_blink: `// Fast LED Blink using Repeat Loop
pin_mode(LED, OUTPUT)
repeat(10) {
  digital_write(LED, 1)
  delay(80)
  digital_write(LED, 0)
  delay(80)
}
print("Finished 10 blinks!")`,

  while_count: `// While Loop Counter
i = 0
while (i < 5) {
  print("Count:")
  print(i)
  i = i + 1
}
print("While loop finished!")`,

  lcd_status: `// Show Live System Status on 2004A LCD Screen (SCL=D9, SDA=D8)
lcd_status()`,

  dual_anim: `// Infinite Cyber Animation on OLED & LCD (Stop button supported)
// Pins: SCL=D9 (GPIO9), SDA=D8 (GPIO8)
oled_init(0x3C)
oled_clear()
lcd_init(0x27)
lcd_clear()

oled_print(0, "[ CYBER MATRIX ]")
lcd_set_cursor(0, 0)
lcd_print("== DUAL CYBER ==")

tick = 0
pos = 0
dir = 4
led_state = 1

while (1 == 1) {
  // --- OLED ANIMATION ---
  if (tick % 4 == 0) {
    oled_print(3, "SCANNER [ | ] T:")
  }
  if (tick % 4 == 1) {
    oled_print(3, "SCANNER [ / ] T:")
  }
  if (tick % 4 == 2) {
    oled_print(3, "SCANNER [ - ] T:")
  }
  if (tick % 4 == 3) {
    oled_print(3, "SCANNER [ \\\\ ] T:")
  }
  oled_print(100, 24, tick)
  oled_show()

  // --- LCD ANIMATION ---
  lcd_set_cursor(0, 1)
  if (tick % 4 == 0) {
    lcd_print("[||||....||||] >")
  }
  if (tick % 4 == 1) {
    lcd_print("[..||||||||..] >>")
  }
  if (tick % 4 == 2) {
    lcd_print("[....||||....] >>>")
  }
  if (tick % 4 == 3) {
    lcd_print("[||||||||||||] >>>>")
  }

  lcd_set_cursor(0, 2)
  if (dir > 0) {
    lcd_print("BEAM >> [>>>>>>....]")
  }
  if (dir < 0) {
    lcd_print("BEAM << [....<<<<<<]")
  }

  lcd_set_cursor(0, 3)
  lcd_print("Tick: ")
  lcd_set_cursor(6, 3)
  lcd_print(tick)
  lcd_set_cursor(12, 3)
  lcd_print("[RUN]")

  pos = pos + dir
  if (pos >= 110) {
    dir = -4
  }
  if (pos <= 0) {
    dir = 4
  }

  digital_write(27, led_state)
  led_state = 1 - led_state

  tick = tick + 1
  delay(60)
}`,

  dual_hi: `// Say "hi!" on both 0.91" OLED & 2004A LCD (Pins SCL=D9 & SDA=D8)
// 1. Initialize & Print to 0.91" OLED (SSD1306 128x32, 0x3C)
oled_init(0x3C)
oled_clear()
oled_print(0, "hi!")
oled_print(1, "OLED & LCD Active")
oled_print(2, "Pins: D9 & D8")

// 2. Initialize & Print to 2004A/1602 LCD (PCF8574, 0x27)
lcd_init(0x27)
lcd_clear()
lcd_set_cursor(0, 0)
lcd_print("hi!")
lcd_set_cursor(0, 1)
lcd_print("Dual Screen Demo")

print("Successfully printed hi! on both OLED and LCD displays")`,

  lcd_hi: `// 2004A I2C LCD Display "hi!" (SCL=D9, SDA=D8)
lcd_init(0x27)
lcd_clear()
lcd_set_cursor(0, 0)
lcd_print("hi!")
print("Display updated: hi!")`,

  proxy_fetch: `// Fetch Public IP & Weather through ESP32 Web Proxy
http_get("https://api.ipify.org?format=json")
http_get("https://wttr.in/Tokyo?format=3")
print("Proxy requests completed successfully!")`,

  i2c_scan: `// Scan I2C bus (on both SDA=D4/SCL=D5 and SDA=D5/SCL=D4)
i2c_scan()`
};

function toggleProxyBody() {
  const m = document.getElementById('proxy-method').value;
  document.getElementById('proxy-body-group').style.display = (m === 'POST' || m === 'PUT') ? 'block' : 'none';
}

function setProxyPreset(url, method, body = '') {
  document.getElementById('proxy-url').value = url;
  document.getElementById('proxy-method').value = method;
  if (body) document.getElementById('proxy-body').value = body;
  toggleProxyBody();
}

async function sendProxyRequest() {
  const url = document.getElementById('proxy-url').value.trim();
  const method = document.getElementById('proxy-method').value;
  const body = document.getElementById('proxy-body').value;
  const out = document.getElementById('proxy-output');
  const badge = document.getElementById('proxy-status-badge');

  if (!url) {
    alert("Please enter a target URL");
    return;
  }

  badge.textContent = "Connecting via ESP32...";
  badge.style.color = "var(--text-muted)";
  out.textContent = `Connecting to ${url} through Seeed XIAO ESP32-C5 proxy...`;

  const startTime = Date.now();
  try {
    const proxyEndpoint = '/proxy?url=' + encodeURIComponent(url) + '&method=' + encodeURIComponent(method);
    const reqOptions = { method: method === 'GET' || method === 'HEAD' ? 'GET' : 'POST' };
    if (method === 'POST' || method === 'PUT') {
      reqOptions.headers = { 'Content-Type': 'application/json' };
      reqOptions.body = body;
    }

    const res = await fetch(proxyEndpoint, reqOptions);
    const elapsed = Date.now() - startTime;
    badge.textContent = `HTTP ${res.status} (${elapsed}ms)`;
    badge.style.color = res.ok ? '#88ff88' : '#ff8888';

    const text = await res.text();
    out.textContent = text;
  } catch (err) {
    badge.textContent = "ERROR";
    badge.style.color = "#ff4444";
    out.textContent = "[ERROR] Proxy request failed: " + err;
  }
}

function loadTemplate(key) {
  if (templates[key]) {
    document.getElementById('code-input').value = templates[key];
  }
}

async function triggerLcdStatus() {
  const fb = document.getElementById('lcd-feedback');
  fb.textContent = "Detecting display and updating screen...";
  try {
    const res = await fetch('/api/lcd_status', { method: 'POST' });
    const text = await res.text();
    fb.textContent = "[OK] Display auto-detected & updated with Live IP, RAM and Storage Status";
  } catch (err) {
    fb.textContent = "[ERROR] Failed to update display: " + err;
  }
}

let scriptPollTimer = null;

async function runCode() {
  const code = document.getElementById('code-input').value;
  const out = document.getElementById('code-output');
  const runBtn = document.getElementById('run-btn');
  const stopBtn = document.getElementById('stop-btn');

  isRunning = true;
  runBtn.disabled = true;
  runBtn.style.opacity = '0.5';
  stopBtn.style.display = 'inline-block';
  out.textContent = "Executing script in background FreeRTOS task...\n";

  try {
    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: code
    });

    if (scriptPollTimer) clearInterval(scriptPollTimer);
    scriptPollTimer = setInterval(async () => {
      try {
        const outRes = await fetch('/api/script_output');
        if (outRes.ok) {
          const json = await outRes.json();
          out.textContent = json.output || '// Running...';
          out.scrollTop = out.scrollHeight;
          if (!json.running) {
            clearInterval(scriptPollTimer);
            scriptPollTimer = null;
            isRunning = false;
            runBtn.disabled = false;
            runBtn.style.opacity = '1';
            stopBtn.style.display = 'none';
          }
        }
      } catch (e) {}
    }, 200);
  } catch (err) {
    out.textContent = "[ERROR] Could not start script: " + err;
    isRunning = false;
    runBtn.disabled = false;
    runBtn.style.opacity = '1';
    stopBtn.style.display = 'none';
  }
}

async function stopCode() {
  const out = document.getElementById('code-output');
  const runBtn = document.getElementById('run-btn');
  const stopBtn = document.getElementById('stop-btn');

  try {
    await fetch('/api/stop', { method: 'POST' });
    const outRes = await fetch('/api/script_output');
    if (outRes.ok) {
      const json = await outRes.json();
      out.textContent = json.output;
    }
  } catch (err) {
    out.textContent += "\n[ERROR] Stop request failed: " + err;
  } finally {
    if (scriptPollTimer) {
      clearInterval(scriptPollTimer);
      scriptPollTimer = null;
    }
    isRunning = false;
    runBtn.disabled = false;
    runBtn.style.opacity = '1';
    stopBtn.style.display = 'none';
  }
}

async function loadFiles() {
  const tbody = document.getElementById('files-tbody');
  try {
    const res = await fetch('/api/files');
    const files = await res.json();
    let totalBytes = 0;
    if (files) {
      files.forEach(f => totalBytes += (f.size || 0));
      const usedEl = document.getElementById('stat-storage-used');
      if (usedEl) usedEl.textContent = formatBytes(totalBytes);
    }

    const sysRes = await fetch('/api/sysinfo');
    if (sysRes.ok) {
      const sysJson = await sysRes.json();
      const ipEl = document.getElementById('stat-ip-val');
      if (ipEl && sysJson.ip) ipEl.textContent = sysJson.ip;
      const badgeEl = document.getElementById('dev-status');
      if (badgeEl && sysJson.ip) badgeEl.textContent = sysJson.ip;
    }

    if (!tbody) return;
    if (!files || files.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No files stored in memory.</td></tr>';
      return;
    }
    tbody.innerHTML = files.map(f => `
      <tr>
        <td><b>${escapeHtml(f.name)}</b></td>
        <td>${formatBytes(f.size)}</td>
        <td><code>${escapeHtml(f.type)}</code></td>
        <td>
          <a href="/api/download?name=${encodeURIComponent(f.name)}" target="_blank" class="file-link">View / Download</a>
        </td>
        <td>
          <button class="btn" style="padding:2px 8px; font-size:11px;" onclick="deleteFile('${escapeHtml(f.name)}')">Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="color:#ff6666">Failed to load files: ${err}</td></tr>`;
  }
}

async function performFileUpload(file) {
  if (!file) return;
  const status = document.getElementById('upload-status');
  status.textContent = `Uploading ${file.name} (${formatBytes(file.size)})...`;

  try {
    const uploadUrl = '/api/upload?name=' + encodeURIComponent(file.name) + '&type=' + encodeURIComponent(file.type || 'application/octet-stream');
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-File-Name': encodeURIComponent(file.name),
        'X-File-Type': encodeURIComponent(file.type || 'text/plain')
      },
      body: file
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }

    const json = await res.json();
    status.textContent = `[OK] Successfully uploaded ${file.name}`;
    loadFiles();
  } catch (err) {
    status.textContent = `[ERROR] Upload failed: ${err.message || err}`;
  }
}

function performOtaSelect(file) {
  if (!file) return;
  selectedOtaFile = file;
  document.getElementById('ota-file-name').textContent = selectedOtaFile.name;
  document.getElementById('ota-file-size').textContent = formatBytes(selectedOtaFile.size);
  document.getElementById('ota-file-details').style.display = 'block';
  document.getElementById('ota-status-msg').textContent = '';
}

function setupDragAndDrop(dropzoneId, onFile) {
  const el = document.getElementById(dropzoneId);
  if (!el) return;

  ['dragenter', 'dragover'].forEach(eventName => {
    el.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.style.borderColor = '#ffffff';
      el.style.background = '#151515';
    }, false);
  });

  ['dragleave', 'dragend'].forEach(eventName => {
    el.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.style.borderColor = 'var(--border-light)';
      el.style.background = '#050505';
    }, false);
  });

  el.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    el.style.borderColor = 'var(--border-light)';
    el.style.background = '#050505';

    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      onFile(file);
    }
  }, false);
}

function uploadOtaFirmware() {
  if (!selectedOtaFile) return;
  const btn = document.getElementById('ota-upload-btn');
  const progContainer = document.getElementById('ota-progress-container');
  const progFill = document.getElementById('ota-progress-fill');
  const statusMsg = document.getElementById('ota-status-msg');

  btn.disabled = true;
  btn.style.opacity = '0.5';
  progContainer.style.display = 'block';
  progFill.style.width = '0%';
  statusMsg.textContent = "Uploading and flashing firmware to partition...";

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/ota', true);
  xhr.setRequestHeader('Content-Type', 'application/octet-stream');

  xhr.upload.onprogress = function(e) {
    if (e.lengthComputable) {
      const percent = Math.round((e.loaded / e.total) * 100);
      progFill.style.width = percent + '%';
      statusMsg.textContent = `Flashing: ${percent}% (${formatBytes(e.loaded)} / ${formatBytes(e.total)})`;
    }
  };

  xhr.onload = function() {
    if (xhr.status === 200) {
      progFill.style.width = '100%';
      statusMsg.textContent = "[OK] OTA Update Successful. Device is rebooting. Reconnecting in 5s...";
      let countdown = 5;
      const timer = setInterval(() => {
        countdown--;
        if (countdown > 0) {
          statusMsg.textContent = `[OK] Rebooting... Reconnecting in ${countdown}s...`;
        } else {
          clearInterval(timer);
          location.reload();
        }
      }, 1000);
    } else {
      statusMsg.textContent = `[ERROR] OTA Flash Failed (HTTP ${xhr.status}: ${xhr.responseText})`;
      btn.disabled = false;
      btn.style.opacity = '1';
    }
  };

  xhr.onerror = function() {
    statusMsg.textContent = "[ERROR] Connection interrupted during OTA transmission";
    btn.disabled = false;
    btn.style.opacity = '1';
  };

  xhr.send(selectedOtaFile);
}

async function deleteFile(name) {
  if (!confirm(`Delete "${name}"?`)) return;
  try {
    await fetch('/api/delete?name=' + encodeURIComponent(name), { method: 'POST' });
    loadFiles();
  } catch (err) {
    alert("Delete failed: " + err);
  }
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

window.addEventListener('dragover', function(e) { e.preventDefault(); }, false);
window.addEventListener('drop', function(e) { e.preventDefault(); }, false);

setupDragAndDrop('file-dropzone', performFileUpload);
setupDragAndDrop('ota-dropzone', performOtaSelect);
loadFiles();
</script>
</body>
</html>)rawliteral";

    request->send(200, "text/html", html);
  }

  void serve_file_list(AsyncWebServerRequest *request) {
    std::ostringstream json;
    json << "[";
    for (size_t i = 0; i < files_.size(); i++) {
      if (i > 0) json << ",";
      json << "{\"name\":\"" << json_escape(files_[i].name) << "\","
           << "\"size\":" << files_[i].size << ","
           << "\"type\":\"" << json_escape(files_[i].content_type) << "\"}";
    }
    json << "]";
    std::string json_str = json.str();
    request->send(200, "application/json", json_str.c_str());
  }

  void serve_sysinfo(AsyncWebServerRequest *request) {
    std::ostringstream json;
    json << "{\"ip\":\"" << json_escape(get_current_ip_str()) << "\","
         << "\"free_heap\":" << esp_get_free_heap_size() << ","
         << "\"uptime\":" << (millis() / 1000) << "}";
    std::string json_str = json.str();
    request->send(200, "application/json", json_str.c_str());
  }

  void serve_download(AsyncWebServerRequest *request) {
    std::string name = get_param(request, "name");
    for (const auto &f : files_) {
      if (f.name == name) {
        request->send(200, f.content_type.c_str(), f.data.c_str());
        return;
      }
    }
    request->send(404, "text/plain", "File not found");
  }

  void serve_delete(AsyncWebServerRequest *request) {
    std::string name = get_param(request, "name");
    for (auto it = files_.begin(); it != files_.end(); ++it) {
      if (it->name == name) {
        files_.erase(it);
        request->send(200, "application/json", "{\"status\":\"ok\"}");
        return;
      }
    }
    request->send(404, "text/plain", "File not found");
  }

  void serve_lcd_status(AsyncWebServerRequest *request) {
    this->custom_lcd_or_btn_in_use_ = false;
    size_t total_bytes = 0;
    for (const auto &f : files_) total_bytes += f.size;
    DisplayManager::update_status_auto(files_.size(), total_bytes);
    request->send(200, "text/plain", "OK");
  }

  void serve_run_script(AsyncWebServerRequest *request) {
    std::string code = this->body_buffer_;
    if (code.empty()) {
      if (request->hasArg("plain")) {
        code = request->arg("plain");
      } else if (request->hasArg("code")) {
        code = request->arg("code");
      }
    }

    if (ScriptEngine::code_uses_custom_lcd_or_btn(code)) {
      this->custom_lcd_or_btn_in_use_ = true;
    } else {
      this->custom_lcd_or_btn_in_use_ = false;
    }

    size_t total_bytes = 0;
    for (const auto &f : files_) total_bytes += f.size;

    ScriptEngine::start_async(code, files_.size(), total_bytes);
    request->send(200, "application/json", "{\"status\":\"started\"}");
  }

  void serve_ota_finish(AsyncWebServerRequest *request) {
    if (this->ota_in_progress_ && !this->ota_error_ && this->ota_bytes_written_ > 0) {
      esp_err_t err = esp_ota_end(this->ota_handle_);
      if (err == ESP_OK) {
        err = esp_ota_set_boot_partition(this->ota_partition_);
        if (err == ESP_OK) {
          DisplayManager::show_ota_complete();
          request->send(200, "application/json", "{\"status\":\"success\",\"message\":\"Update OK, rebooting...\"}");
          this->set_timeout(1000, []() {
            esp_restart();
          });
          return;
        }
      }
    }
    this->ota_in_progress_ = false;
    request->send(500, "application/json", "{\"status\":\"error\",\"message\":\"OTA Flash verification failed\"}");
  }

  void serve_upload(AsyncWebServerRequest *request) {
    std::string name = get_param(request, "name");
    if (name.empty()) name = "uploaded_file.txt";

    std::string type = get_param(request, "type");
    if (type.empty()) type = "application/octet-stream";

    std::string body = this->body_buffer_;

    bool found = false;
    for (auto &f : files_) {
      if (f.name == name) {
        f.data = std::move(body);
        f.size = f.data.size();
        f.content_type = type;
        f.upload_time = millis();
        found = true;
        break;
      }
    }
    if (!found) {
      StoredFile new_file;
      new_file.name = name;
      new_file.content_type = type;
      new_file.size = body.size();
      new_file.data = std::move(body);
      new_file.upload_time = millis();
      files_.push_back(std::move(new_file));
    }

    std::string resp = "{\"status\":\"uploaded\",\"name\":\"" + json_escape(name) + "\"}";
    request->send(200, "application/json", resp.c_str());
  }

  static std::string json_escape(const std::string &s) {
    std::ostringstream o;
    for (char c : s) {
      if (c == '"') o << "\\\"";
      else if (c == '\\') o << "\\\\";
      else if (c == '\b') o << "\\b";
      else if (c == '\f') o << "\\f";
      else if (c == '\n') o << "\\n";
      else if (c == '\r') o << "\\r";
      else if (c == '\t') o << "\\t";
      else o << c;
    }
    return o.str();
  }
};

}  // namespace custom_web
}  // namespace esphome
