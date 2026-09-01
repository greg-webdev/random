#pragma once

#include "esphome.h"
#include "esphome/core/component.h"
#include "esphome/components/web_server_base/web_server_base.h"
#include "esphome/components/web_server_idf/web_server_idf.h"
#include <vector>
#include <string>
#include <map>
#include <sstream>
#include <cmath>
#include <driver/gpio.h>
#include <esp_system.h>
#include <esp_heap_caps.h>

namespace esphome {
namespace custom_web {

struct StoredFile {
  std::string name;
  std::string content_type;
  std::string data;
  size_t size;
  uint32_t upload_time;
};

class ScriptEngine {
 public:
  static std::string run(const std::string &code) {
    std::ostringstream out;
    std::istringstream stream(code);
    std::string line;
    std::map<std::string, double> vars;
    vars["LED"] = 27; // User LED on Seeed XIAO C5
    vars["BOOT_BTN"] = 28; // Boot button
    vars["D0"] = 1;
    vars["D1"] = 0;
    vars["D2"] = 25;
    vars["D3"] = 7;
    vars["D4"] = 23;
    vars["D5"] = 24;
    vars["D6"] = 11;
    vars["D7"] = 12;
    vars["D8"] = 8;
    vars["D9"] = 9;
    vars["D10"] = 10;

    out << "[Execution Started on Seeed XIAO ESP32-C5]\n";
    uint32_t start_time = millis();

    int line_num = 0;
    while (std::getline(stream, line)) {
      line_num++;
      // Trim whitespace
      size_t first = line.find_first_not_of(" \t\r\n");
      if (first == std::string::npos) continue;
      size_t last = line.find_last_not_of(" \t\r\n");
      line = line.substr(first, (last - first + 1));

      // Skip comments
      if (line.rfind("//", 0) == 0 || line.rfind("#", 0) == 0) continue;

      try {
        if (line.rfind("pin_mode(", 0) == 0 || line.rfind("pinMode(", 0) == 0) {
          size_t p1 = line.find('(');
          size_t comma = line.find(',', p1);
          size_t p2 = line.find(')', comma);
          if (p1 != std::string::npos && comma != std::string::npos && p2 != std::string::npos) {
            std::string pin_str = trim(line.substr(p1 + 1, comma - p1 - 1));
            std::string mode_str = trim(line.substr(comma + 1, p2 - comma - 1));
            int pin = eval_val(pin_str, vars);
            if (mode_str == "OUTPUT" || mode_str == "output" || mode_str == "1") {
              gpio_reset_pin((gpio_num_t)pin);
              gpio_set_direction((gpio_num_t)pin, GPIO_MODE_OUTPUT);
              out << "Set GPIO " << pin << " -> OUTPUT\n";
            } else {
              gpio_reset_pin((gpio_num_t)pin);
              gpio_set_direction((gpio_num_t)pin, GPIO_MODE_INPUT);
              gpio_pullup_en((gpio_num_t)pin);
              out << "Set GPIO " << pin << " -> INPUT_PULLUP\n";
            }
          }
        } else if (line.rfind("digital_write(", 0) == 0 || line.rfind("digitalWrite(", 0) == 0) {
          size_t p1 = line.find('(');
          size_t comma = line.find(',', p1);
          size_t p2 = line.find(')', comma);
          if (p1 != std::string::npos && comma != std::string::npos && p2 != std::string::npos) {
            std::string pin_str = trim(line.substr(p1 + 1, comma - p1 - 1));
            std::string val_str = trim(line.substr(comma + 1, p2 - comma - 1));
            int pin = eval_val(pin_str, vars);
            int val = eval_val(val_str, vars);
            gpio_set_level((gpio_num_t)pin, val ? 1 : 0);
            out << "GPIO " << pin << " = " << (val ? "HIGH (1)" : "LOW (0)") << "\n";
          }
        } else if (line.rfind("digital_read(", 0) == 0 || line.rfind("digitalRead(", 0) == 0) {
          size_t p1 = line.find('(');
          size_t p2 = line.find(')', p1);
          if (p1 != std::string::npos && p2 != std::string::npos) {
            std::string pin_str = trim(line.substr(p1 + 1, p2 - p1 - 1));
            int pin = eval_val(pin_str, vars);
            int val = gpio_get_level((gpio_num_t)pin);
            out << "Read GPIO " << pin << " -> " << val << "\n";
          }
        } else if (line.rfind("delay(", 0) == 0 || line.rfind("sleep(", 0) == 0) {
          size_t p1 = line.find('(');
          size_t p2 = line.find(')', p1);
          if (p1 != std::string::npos && p2 != std::string::npos) {
            std::string ms_str = trim(line.substr(p1 + 1, p2 - p1 - 1));
            int ms = eval_val(ms_str, vars);
            if (ms > 3000) ms = 3000; // max safe delay in request
            delay(ms);
            out << "Delayed " << ms << " ms\n";
          }
        } else if (line.rfind("print(", 0) == 0 || line.rfind("println(", 0) == 0) {
          size_t p1 = line.find('(');
          size_t p2 = line.rfind(')');
          if (p1 != std::string::npos && p2 != std::string::npos) {
            std::string arg = trim(line.substr(p1 + 1, p2 - p1 - 1));
            if (arg.front() == '"' && arg.back() == '"') {
              out << arg.substr(1, arg.length() - 2) << "\n";
            } else {
              out << eval_val(arg, vars) << "\n";
            }
          }
        } else if (line.find('=') != std::string::npos) {
          size_t eq = line.find('=');
          std::string var_name = trim(line.substr(0, eq));
          std::string expr = trim(line.substr(eq + 1));
          if (!var_name.empty()) {
            double v = eval_val(expr, vars);
            vars[var_name] = v;
            out << var_name << " = " << v << "\n";
          }
        } else if (line == "info" || line == "sysinfo" || line == "sysinfo()") {
          out << "Chip: ESP32-C5 (RISC-V 32-bit)\n";
          out << "Free Heap: " << esp_get_free_heap_size() << " bytes\n";
          out << "Min Free Heap: " << esp_get_minimum_free_heap_size() << " bytes\n";
          out << "Uptime: " << (millis() / 1000) << " seconds\n";
        } else {
          out << "Evaluated: " << eval_val(line, vars) << "\n";
        }
      } catch (const std::exception &e) {
        out << "Error on line " << line_num << ": " << e.what() << "\n";
      }
    }

    uint32_t elapsed = millis() - start_time;
    out << "\n[Finished in " << elapsed << " ms]\n";
    return out.str();
  }

 private:
  static std::string trim(const std::string &s) {
    size_t first = s.find_first_not_of(" \t\r\n");
    if (first == std::string::npos) return "";
    size_t last = s.find_last_not_of(" \t\r\n");
    return s.substr(first, (last - first + 1));
  }

  static double eval_val(const std::string &expr_raw, const std::map<std::string, double> &vars) {
    std::string expr = trim(expr_raw);
    if (expr.empty()) return 0;
    if (expr == "HIGH" || expr == "true") return 1;
    if (expr == "LOW" || expr == "false") return 0;
    if (expr == "free_heap()" || expr == "get_free_heap()") return (double)esp_get_free_heap_size();
    if (expr == "uptime()" || expr == "get_uptime()") return (double)(millis() / 1000);

    // Check variables
    auto it = vars.find(expr);
    if (it != vars.end()) return it->second;

    // Simple arithmetic evaluation
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

    try {
      return std::stod(expr);
    } catch (...) {
      return 0;
    }
  }
};

class CustomWebComponent : public Component, public AsyncWebHandler {
 public:
  void setup() override {
    if (web_server_base::global_web_server_base != nullptr) {
      web_server_base::global_web_server_base->add_handler_without_auth(this);
    }
  }

  bool canHandle(AsyncWebServerRequest *request) const override {
    char url_buf[AsyncWebServerRequest::URL_BUF_SIZE];
    StringRef u = request->url_to(url_buf);
    return u == "/" || u == "/index.html" || u == "/app" ||
           u == "/api/upload" || u == "/api/files" || u == "/api/download" ||
           u == "/api/delete" || u == "/api/run";
  }

  void handleRequest(AsyncWebServerRequest *request) override {
    char url_buf[AsyncWebServerRequest::URL_BUF_SIZE];
    StringRef u = request->url_to(url_buf);

    if (u == "/" || u == "/index.html" || u == "/app") {
      serve_app_page(request);
      return;
    }

    if (u == "/api/files") {
      serve_file_list(request);
      return;
    }

    if (u == "/api/download") {
      serve_download(request);
      return;
    }

    if (u == "/api/delete") {
      serve_delete(request);
      return;
    }

    if (u == "/api/run") {
      serve_run_script(request);
      return;
    }

    if (u == "/api/upload") {
      serve_upload(request);
      return;
    }

    request->send(404, "text/plain", "Not Found");
  }

 private:
  std::vector<StoredFile> files_;

  void serve_app_page(AsyncWebServerRequest *request) {
    const char *html = R"rawliteral(<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Seeed XIAO ESP32-C5 Studio</title>
<style>
:root {
  --bg: #0d1117;
  --card: #161b22;
  --border: #30363d;
  --primary: #238636;
  --primary-hover: #2ea043;
  --accent: #58a6ff;
  --text: #c9d1d9;
  --text-bright: #ffffff;
  --code-bg: #090d12;
  --danger: #da3633;
}
* { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
body { background: var(--bg); color: var(--text); padding: 20px; }
.container { max-width: 1000px; margin: 0 auto; }
header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); padding-bottom: 16px; margin-bottom: 20px; }
.title-group h1 { color: var(--text-bright); font-size: 22px; }
.title-group p { font-size: 13px; color: #8b949e; }
.badge { background: #21262d; border: 1px solid var(--border); padding: 4px 10px; border-radius: 12px; font-size: 12px; color: var(--accent); }
.nav-tabs { display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 1px solid var(--border); padding-bottom: 8px; }
.tab-btn { background: transparent; border: none; color: #8b949e; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; }
.tab-btn.active { background: #21262d; color: var(--text-bright); border: 1px solid var(--border); }
.tab-content { display: none; }
.tab-content.active { display: block; }
.card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 20px; margin-bottom: 20px; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.card-title { font-size: 16px; color: var(--text-bright); font-weight: 600; }
.btn { background: var(--primary); color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; transition: 0.2s; }
.btn:hover { background: var(--primary-hover); }
.btn-accent { background: #1f6feb; }
.btn-accent:hover { background: #388bfd; }
.btn-danger { background: var(--danger); }
.upload-dropzone { border: 2px dashed var(--border); border-radius: 8px; padding: 30px; text-align: center; background: #0d1117; cursor: pointer; margin-bottom: 16px; }
.upload-dropzone:hover { border-color: var(--accent); }
.file-list { width: 100%; border-collapse: collapse; margin-top: 10px; }
.file-list th, .file-list td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border); font-size: 13px; }
.file-list th { color: #8b949e; font-weight: 600; }
.file-link { color: var(--accent); text-decoration: none; font-weight: 600; }
.file-link:hover { text-decoration: underline; }
.editor-container { display: flex; flex-direction: column; gap: 10px; }
textarea.code-editor { width: 100%; height: 220px; background: var(--code-bg); color: #7ee787; border: 1px solid var(--border); border-radius: 6px; padding: 12px; font-family: 'Consolas', 'Fira Code', monospace; font-size: 14px; line-height: 1.5; resize: vertical; outline: none; }
pre.terminal-output { background: var(--code-bg); color: #f0f6fc; border: 1px solid var(--border); border-radius: 6px; padding: 14px; font-family: 'Consolas', monospace; font-size: 13px; min-height: 140px; max-height: 300px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; }
.quick-templates { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.template-btn { background: #21262d; border: 1px solid var(--border); color: var(--text); padding: 4px 10px; border-radius: 4px; font-size: 12px; cursor: pointer; }
.template-btn:hover { border-color: var(--accent); color: var(--accent); }
.status-pill { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: bold; background: #238636; color: white; }
</style>
</head>
<body>
<div class="container">
  <header>
    <div class="title-group">
      <h1>Seeed Studio XIAO ESP32-C5</h1>
      <p>Standalone Web Server & Live Scripting Console</p>
    </div>
    <span class="badge" id="dev-status">● Online (192.168.4.1)</span>
  </header>

  <div class="nav-tabs">
    <button class="tab-btn active" onclick="switchTab('files')">📁 File Manager & Links</button>
    <button class="tab-btn" onclick="switchTab('code')">⚡ Live Code Runner</button>
    <button class="tab-btn" onclick="switchTab('info')">📊 System & Pinout</button>
  </div>

  <!-- FILE MANAGER TAB -->
  <div id="tab-files" class="tab-content active">
    <div class="card">
      <div class="card-header">
        <span class="card-title">Upload File to Seeed C5 Flash</span>
      </div>
      <div class="upload-dropzone" onclick="document.getElementById('file-input').click()">
        <p>📄 Click or Drag & Drop a file here to upload to Seeed Storage</p>
        <p style="font-size:12px; color:#8b949e; margin-top:6px;">Supported: HTML, Text, JSON, Images, Scripts, Binaries</p>
        <input type="file" id="file-input" style="display:none" onchange="uploadSelectedFile(event)">
      </div>
      <div id="upload-status" style="font-size:13px; color:var(--accent); margin-bottom:10px;"></div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">Stored Files & Display Links</span>
        <button class="btn btn-accent" onclick="loadFiles()">🔄 Refresh Files</button>
      </div>
      <table class="file-list">
        <thead>
          <tr>
            <th>File Name</th>
            <th>Size</th>
            <th>Type</th>
            <th>Direct Link / View</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody id="files-tbody">
          <tr><td colspan="5" style="text-align:center; color:#8b949e;">Loading files...</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- CODE RUNNER TAB -->
  <div id="tab-code" class="tab-content">
    <div class="card">
      <div class="card-header">
        <span class="card-title">Live Code Studio (Execute on ESP32-C5)</span>
        <div>
          <button class="btn" onclick="runCode()">▶ Run Code</button>
          <button class="btn btn-danger" onclick="document.getElementById('code-input').value=''">Clear</button>
        </div>
      </div>

      <div class="quick-templates">
        <span style="font-size:12px; color:#8b949e; align-self:center;">Templates:</span>
        <button class="template-btn" onclick="loadTemplate('blink')">💡 Blink User LED (GPIO27)</button>
        <button class="template-btn" onclick="loadTemplate('button')">🔘 Read Boot Button (GPIO28)</button>
        <button class="template-btn" onclick="loadTemplate('sysinfo')">📊 System Info & Memory</button>
        <button class="template-btn" onclick="loadTemplate('math')">🧮 Math Calculations</button>
        <button class="template-btn" onclick="loadTemplate('gpio_all')">⚡ Test All XIAO Pins</button>
      </div>

      <div class="editor-container">
        <textarea id="code-input" class="code-editor" spellcheck="false">// Write scripts to control Seeed XIAO ESP32-C5 in real-time
pin_mode(LED, OUTPUT)
digital_write(LED, 1)
print("User LED Turned ON")
delay(500)
digital_write(LED, 0)
print("User LED Turned OFF")
sysinfo()</textarea>

        <div style="font-size:13px; font-weight:600; color:var(--text-bright); margin-top:8px;">Console Output:</div>
        <pre id="code-output" class="terminal-output">// Execution output will appear here...</pre>
      </div>
    </div>
  </div>

  <!-- SYSTEM TAB -->
  <div id="tab-info" class="tab-content">
    <div class="card">
      <div class="card-header">
        <span class="card-title">Seeed Studio XIAO ESP32-C5 Pinout Reference</span>
      </div>
      <table class="file-list">
        <thead><tr><th>XIAO Pin</th><th>GPIO</th><th>Function / Description</th></tr></thead>
        <tbody>
          <tr><td><b>User LED</b></td><td>GPIO27</td><td>Onboard Active-HIGH User LED</td></tr>
          <tr><td><b>Boot Button</b></td><td>GPIO28</td><td>Onboard Button (Active-LOW with Pullup)</td></tr>
          <tr><td><b>D0</b></td><td>GPIO1</td><td>ADC / Digital I/O</td></tr>
          <tr><td><b>D1</b></td><td>GPIO0</td><td>ADC / Digital I/O</td></tr>
          <tr><td><b>D2</b></td><td>GPIO25</td><td>ADC / Digital I/O</td></tr>
          <tr><td><b>D3</b></td><td>GPIO7</td><td>ADC / Digital I/O</td></tr>
          <tr><td><b>D4</b></td><td>GPIO23</td><td>I2C SDA / Digital I/O</td></tr>
          <tr><td><b>D5</b></td><td>GPIO24</td><td>I2C SCL / Digital I/O</td></tr>
          <tr><td><b>D6</b></td><td>GPIO11</td><td>UART TX / Digital I/O</td></tr>
          <tr><td><b>D7</b></td><td>GPIO12</td><td>UART RX / Digital I/O</td></tr>
          <tr><td><b>D8</b></td><td>GPIO8</td><td>SPI SCK / Digital I/O</td></tr>
          <tr><td><b>D9</b></td><td>GPIO9</td><td>SPI MISO / Digital I/O</td></tr>
          <tr><td><b>D10</b></td><td>GPIO10</td><td>SPI MOSI / Digital I/O</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</div>

<script>
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('tab-' + tabId).classList.add('active');
  if (tabId === 'files') loadFiles();
}

const templates = {
  blink: `// Blink User LED on Seeed XIAO C5
pin_mode(LED, OUTPUT)
print("Turning LED ON...")
digital_write(LED, 1)
delay(1000)
print("Turning LED OFF...")
digital_write(LED, 0)
print("Done!")`,
  button: `// Read Boot Button (GPIO28)
pin_mode(BOOT_BTN, INPUT)
btn_val = digital_read(BOOT_BTN)
print("Boot Button State:")
print(btn_val)
if (btn_val == 0) {
  print("Button is currently PRESSED!")
} else {
  print("Button is RELEASED.")
}`,
  sysinfo: `// Query Hardware & System Stats
sysinfo()
free_mem = free_heap()
up_time = uptime()
print("Free Memory:")
print(free_mem)
print("System Uptime:")
print(up_time)`,
  math: `// Math and variables test
a = 150
b = 25
sum = a + b
product = a * b
print("Sum:")
print(sum)
print("Product:")
print(product)`,
  gpio_all: `// Test All XIAO Pin Mappings
print("D0 Pin:")
print(D0)
print("D1 Pin:")
print(D1)
print("User LED Pin:")
print(LED)
print("Boot Button Pin:")
print(BOOT_BTN)`
};

function loadTemplate(key) {
  if (templates[key]) {
    document.getElementById('code-input').value = templates[key];
  }
}

async function runCode() {
  const code = document.getElementById('code-input').value;
  const out = document.getElementById('code-output');
  out.textContent = "⏳ Running code on ESP32-C5...";
  try {
    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: code
    });
    const text = await res.text();
    out.textContent = text;
  } catch (err) {
    out.textContent = "Error executing code: " + err;
  }
}

async function loadFiles() {
  const tbody = document.getElementById('files-tbody');
  try {
    const res = await fetch('/api/files');
    const files = await res.json();
    if (!files || files.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#8b949e;">No files uploaded yet. Upload your first file above!</td></tr>';
      return;
    }
    tbody.innerHTML = files.map(f => `
      <tr>
        <td><b>${escapeHtml(f.name)}</b></td>
        <td>${formatBytes(f.size)}</td>
        <td><code>${escapeHtml(f.type)}</code></td>
        <td>
          <a href="/api/download?name=${encodeURIComponent(f.name)}" target="_blank" class="file-link">🔗 View / Download Link</a>
        </td>
        <td>
          <button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteFile('${escapeHtml(f.name)}')">Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:var(--danger)">Failed to load files: ${err}</td></tr>`;
  }
}

async function uploadSelectedFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const status = document.getElementById('upload-status');
  status.textContent = `⏳ Uploading ${file.name} (${formatBytes(file.size)})...`;

  const reader = new FileReader();
  reader.onload = async function(evt) {
    try {
      const res = await fetch('/api/upload?name=' + encodeURIComponent(file.name) + '&type=' + encodeURIComponent(file.type || 'text/plain'), {
        method: 'POST',
        body: evt.target.result
      });
      const text = await res.text();
      status.textContent = `✅ Successfully uploaded: ${file.name}!`;
      loadFiles();
    } catch (err) {
      status.textContent = `❌ Upload failed: ${err}`;
    }
  };
  reader.readAsArrayBuffer(file);
}

async function deleteFile(name) {
  if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
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

// Initial load
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
    request->send(200, "application/json", json.str().c_str());
  }

  void serve_download(AsyncWebServerRequest *request) {
    std::string name = "";
    if (request->hasArg("name")) {
      name = request->arg("name");
    }
    for (const auto &f : files_) {
      if (f.name == name) {
        request->send(200, f.content_type.c_str(), f.data.c_str());
        return;
      }
    }
    request->send(404, "text/plain", "File not found");
  }

  void serve_delete(AsyncWebServerRequest *request) {
    std::string name = "";
    if (request->hasArg("name")) {
      name = request->arg("name");
    }
    for (auto it = files_.begin(); it != files_.end(); ++it) {
      if (it->name == name) {
        files_.erase(it);
        request->send(200, "application/json", "{\"status\":\"ok\"}");
        return;
      }
    }
    request->send(404, "text/plain", "File not found");
  }

  void serve_run_script(AsyncWebServerRequest *request) {
    std::string code = "";
    if (request->hasArg("plain")) {
      code = request->arg("plain");
    } else if (request->hasArg("code")) {
      code = request->arg("code");
    } else {
      // In ESP-IDF web server handler, body is in post_query_ if raw
      code = request->arg("body");
    }

    std::string output = ScriptEngine::run(code);
    request->send(200, "text/plain", output.c_str());
  }

  void serve_upload(AsyncWebServerRequest *request) {
    std::string name = "file.txt";
    std::string type = "text/plain";
    if (request->hasArg("name")) name = request->arg("name");
    if (request->hasArg("type")) type = request->arg("type");

    std::string body = "";
    if (request->hasArg("plain")) {
      body = request->arg("plain");
    } else {
      body = request->arg("body");
    }

    // Check if file already exists, update it
    bool found = false;
    for (auto &f : files_) {
      if (f.name == name) {
        f.data = body;
        f.size = body.size();
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
      new_file.data = body;
      new_file.size = body.size();
      new_file.upload_time = millis();
      files_.push_back(std::move(new_file));
    }

    request->send(200, "application/json", "{\"status\":\"uploaded\",\"name\":\"" + json_escape(name) + "\"}");
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
