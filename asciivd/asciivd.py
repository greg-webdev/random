#!/usr/bin/env python3
import os
import sys
import time
import math
import argparse
import urllib.parse
import threading
import queue
import socket
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
import cv2
import numpy as np

# Ensure UTF-8 output encoding on Windows consoles
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

ASCII_CHARS = " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZwmqpbdkhao*#MW&8%B@$"

class ServerConfig:
    """Thread-safe live configuration state for hot-swapping playback settings."""
    lock = threading.Lock()
    video_source = None
    width = 96
    height = 54
    fps = 30
    mode = 'block'
    filter_name = 'none'
    osd = False
    version = 0

    @classmethod
    def update(cls, **kwargs):
        with cls.lock:
            changed = False
            for k, v in kwargs.items():
                if hasattr(cls, k) and getattr(cls, k) != v:
                    setattr(cls, k, v)
                    changed = True
            if changed:
                cls.version += 1

    @classmethod
    def get_snapshot(cls):
        with cls.lock:
            return {
                'video_source': cls.video_source,
                'width': cls.width,
                'height': cls.height,
                'fps': cls.fps,
                'mode': cls.mode,
                'filter_name': cls.filter_name,
                'osd': cls.osd,
                'version': cls.version
            }

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def get_int_param(params, keys, default_val):
    for key in keys:
        if key in params and params[key]:
            try:
                return int(params[key][0])
            except ValueError:
                pass
    return default_val

def get_str_param(params, keys, default_val):
    for key in keys:
        if key in params and params[key]:
            return params[key][0]
    return default_val

def apply_color_filter(frame, filter_name, frame_idx=0):
    """Applies high-performance visual color filters & glitch shaders."""
    if not filter_name or filter_name in ['none', 'normal']:
        return frame

    filter_name = filter_name.lower()
    
    if filter_name == 'matrix':
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        green_img = np.zeros_like(frame)
        green_img[:, :, 1] = gray
        green_img[:, :, 0] = (gray * 0.15).astype(np.uint8)
        green_img[:, :, 2] = (gray * 0.1).astype(np.uint8)
        return green_img

    elif filter_name == 'cyberpunk':
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        hsv[:, :, 0] = (hsv[:, :, 0] * 0.6 + 130).astype(np.uint8)
        hsv[:, :, 1] = np.clip(hsv[:, :, 1] * 1.5, 0, 255).astype(np.uint8)
        return cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)

    elif filter_name == 'thermal':
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        return cv2.applyColorMap(gray, cv2.COLORMAP_JET)

    elif filter_name == 'rainbow':
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        shift = (frame_idx * 5) % 180
        hsv[:, :, 0] = (hsv[:, :, 0].astype(int) + shift) % 180
        hsv[:, :, 1] = np.clip(hsv[:, :, 1] * 1.3, 0, 255).astype(np.uint8)
        return cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)

    elif filter_name == 'glitch':
        h, w = frame.shape[:2]
        glitched = frame.copy()
        shift = int(math.sin(frame_idx * 0.8) * 6)
        if shift != 0:
            glitched[:, :, 0] = np.roll(glitched[:, :, 0], shift, axis=1)
            glitched[:, :, 2] = np.roll(glitched[:, :, 2], -shift, axis=1)
        if frame_idx % 7 == 0:
            y_start = np.random.randint(0, max(1, h - 10))
            slice_h = np.random.randint(4, 15)
            glitched[y_start:y_start+slice_h, :] = np.roll(glitched[y_start:y_start+slice_h, :], 12, axis=1)
        return glitched

    elif filter_name == 'vhs':
        h, w = frame.shape[:2]
        vhs = frame.copy()
        vhs[::2, :, :] = (vhs[::2, :, :] * 0.7).astype(np.uint8)
        track_y = int((frame_idx * 3) % max(1, h - 20))
        vhs[track_y:track_y+8, :, :] = np.clip(vhs[track_y:track_y+8, :, :] * 1.4 + 40, 0, 255).astype(np.uint8)
        return vhs

    elif filter_name in ['sepia', 'retro']:
        kernel = np.array([
            [0.272, 0.534, 0.131],
            [0.349, 0.686, 0.168],
            [0.393, 0.769, 0.189]
        ])
        return np.clip(cv2.transform(frame, kernel), 0, 255).astype(np.uint8)

    elif filter_name == 'invert':
        return 255 - frame

    elif filter_name in ['grayscale', 'bw']:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)

    return frame

def apply_16_9_scaling(frame, target_w, target_h):
    """Crops and resizes input frame to maintain a perfect 16:9 aspect ratio."""
    h, w = frame.shape[:2]
    desired_aspect = 16.0 / 9.0
    current_aspect = w / float(h)

    if current_aspect > desired_aspect:
        new_w = int(h * desired_aspect)
        offset = (w - new_w) // 2
        cropped = frame[:, offset:offset + new_w]
    else:
        new_h = int(w / desired_aspect)
        offset = (h - new_h) // 2
        cropped = frame[offset:offset + new_h, :]

    return cv2.resize(cropped, (target_w, target_h), interpolation=cv2.INTER_AREA)

def apply_vhs_osd(frame, frame_idx, fps, width, height):
    """Overlays retro VHS timecode & status on top of the video frame."""
    seconds = frame_idx // fps
    mins = seconds // 60
    hrs = mins // 60
    sec_rem = seconds % 60
    min_rem = mins % 60

    timecode = f"PLAY ▶ {hrs:02d}:{min_rem:02d}:{sec_rem:02d}"
    stats = f"16:9 | {width}x{height} | {fps}FPS"

    osd_frame = frame.copy()
    cv2.putText(osd_frame, timecode, (15, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2, cv2.LINE_AA)
    cv2.putText(osd_frame, stats, (15, osd_frame.shape[0] - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 255), 1, cv2.LINE_AA)
    return osd_frame

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    """Handle requests in a separate thread."""
    daemon_threads = True

class AsyncFrameBuffer:
    """Asynchronous pre-buffering frame generator supporting live parameter updates."""
    def __init__(self):
        self.queue = queue.Queue(maxsize=30)
        self.stopped = False
        self.current_source = None
        self.cap = None
        self.thread = threading.Thread(target=self._worker, daemon=True)
        self.thread.start()

    def _worker(self):
        frame_idx = 0
        while not self.stopped:
            cfg = ServerConfig.get_snapshot()
            src = cfg['video_source']
            target_w = cfg['width']
            target_h = cfg['height']
            mode = cfg['mode']
            target_fps = cfg['fps']
            filter_name = cfg['filter_name']
            osd = cfg['osd']

            if src != self.current_source:
                self.current_source = src
                if self.cap:
                    self.cap.release()
                    self.cap = None
                if src and os.path.exists(src):
                    self.cap = cv2.VideoCapture(src)

            pixel_h = target_h * 4 if mode == 'braille' else (target_h * 2 if mode == 'block' else target_h)
            pixel_w = target_w * 2 if mode == 'braille' else target_w

            is_synthetic = (self.cap is None or not self.cap.isOpened())

            if is_synthetic:
                t = frame_idx * 0.05
                x = np.linspace(-2, 2, pixel_w)
                y = np.linspace(-2, 2, pixel_h)
                xx, yy = np.meshgrid(x, y)
                r = (((np.sin(xx**2 + yy**2 + t)) + 1) * 127.5).astype(np.uint8)
                g = (((np.sin(np.sqrt(xx**2 + yy**2) - t * 1.5)) + 1) * 127.5).astype(np.uint8)
                b = (((np.cos(xx * np.sin(t/2) + yy * np.cos(t/3))) + 1) * 127.5).astype(np.uint8)
                frame = np.stack([b, g, r], axis=2)
            else:
                ret, raw_frame = self.cap.read()
                if not ret:
                    self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    ret, raw_frame = self.cap.read()
                    if not ret:
                        continue
                frame = apply_16_9_scaling(raw_frame, pixel_w, pixel_h)

            if filter_name and filter_name != 'none':
                frame = apply_color_filter(frame, filter_name, frame_idx)

            if osd:
                frame = apply_vhs_osd(frame, frame_idx, target_fps, target_w, target_h)

            try:
                self.queue.put((frame_idx, frame), timeout=0.5)
                frame_idx += 1
            except queue.Full:
                time.sleep(0.01)

        if self.cap:
            self.cap.release()

    def get_frame(self):
        try:
            return self.queue.get(timeout=1.0)
        except queue.Empty:
            return None, None

    def stop(self):
        self.stopped = True

def frame_to_ansi_fast(frame, mode='block', width=80, height=45):
    """
    Ultra-low latency ANSI converter with RLE color compression, clean integer casting,
    and gapless row rendering.
    """
    if mode == 'braille':
        resized = cv2.resize(frame, (width * 2, height * 4), interpolation=cv2.INTER_AREA)
        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
        
        lines = []
        for y in range(0, height * 4, 4):
            line_parts = []
            last_fg = None
            for x in range(0, width * 2, 2):
                code = 0x2800
                if gray[y, x] > 100: code |= 0x01
                if gray[y+1, x] > 100: code |= 0x02
                if gray[y+2, x] > 100: code |= 0x04
                if gray[y, x+1] > 100: code |= 0x08
                if gray[y+1, x+1] > 100: code |= 0x10
                if gray[y+2, x+1] > 100: code |= 0x20
                if gray[y+3, x] > 100: code |= 0x40
                if gray[y+3, x+1] > 100: code |= 0x80

                r, g, b = int(rgb[y, x][0]), int(rgb[y, x][1]), int(rgb[y, x][2])
                fg = (r, g, b)
                if fg != last_fg:
                    line_parts.append(f"\x1b[38;2;{r};{g};{b}m")
                    last_fg = fg
                line_parts.append(chr(code))
            lines.append("".join(line_parts))
        return "\n".join(lines) + "\x1b[0m"

    elif mode == 'edge':
        resized = cv2.resize(frame, (width, height), interpolation=cv2.INTER_AREA)
        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
        
        lines = []
        for y in range(height):
            line_parts = []
            last_fg = None
            for x in range(width):
                if edges[y, x] > 0:
                    r, g, b = int(rgb[y, x][0]), int(rgb[y, x][1]), int(rgb[y, x][2])
                    fg = (r, g, b)
                    if fg != last_fg:
                        line_parts.append(f"\x1b[38;2;{r};{g};{b}m")
                        last_fg = fg
                    line_parts.append("#")
                else:
                    line_parts.append(" ")
            lines.append("".join(line_parts))
        return "\n".join(lines) + "\x1b[0m"

    elif mode in ['solid', 'fullblock']:
        # Gapless 100% Solid Double-Space Background Block Mode
        resized = cv2.resize(frame, (width, height), interpolation=cv2.INTER_AREA)
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
        
        lines = []
        for y in range(height):
            line_parts = []
            last_bg = None
            row = rgb[y]
            for x in range(width):
                r, g, b = int(row[x][0]), int(row[x][1]), int(row[x][2])
                bg = (r, g, b)
                if bg != last_bg:
                    line_parts.append(f"\x1b[48;2;{r};{g};{b}m")
                    last_bg = bg
                line_parts.append("  ")
            lines.append("".join(line_parts))
        return "\n".join(lines) + "\x1b[0m"

    elif mode == 'block':
        # Half-block TrueColor with per-row color reset to eliminate line gaps
        resized = cv2.resize(frame, (width, height * 2), interpolation=cv2.INTER_AREA)
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
        
        lines = []
        for y in range(0, height * 2, 2):
            line_parts = []
            last_fg = None
            last_bg = None
            top_row = rgb[y]
            bottom_row = rgb[y + 1] if y + 1 < height * 2 else top_row
            
            for x in range(width):
                tr, tg, tb = int(top_row[x][0]), int(top_row[x][1]), int(top_row[x][2])
                br, bg, bb = int(bottom_row[x][0]), int(bottom_row[x][1]), int(bottom_row[x][2])
                
                fg = (tr, tg, tb)
                bg = (br, bg, bb)

                if fg != last_fg:
                    line_parts.append(f"\x1b[38;2;{tr};{tg};{tb}m")
                    last_fg = fg
                if bg != last_bg:
                    line_parts.append(f"\x1b[48;2;{br};{bg};{bb}m")
                    last_bg = bg
                line_parts.append("▀")
            lines.append("".join(line_parts))
        return "\n".join(lines) + "\x1b[0m"

    else:
        # Standard ASCII density mode
        resized = cv2.resize(frame, (width, height), interpolation=cv2.INTER_AREA)
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
        
        num_chars = len(ASCII_CHARS)
        lines = []
        for y in range(height):
            line_parts = []
            last_fg = None
            row_rgb = rgb[y]
            row_gray = gray[y]
            for x in range(width):
                r, g, b = int(row_rgb[x][0]), int(row_rgb[x][1]), int(row_rgb[x][2])
                val = int(row_gray[x])
                char_idx = int((val / 255.0) * (num_chars - 1))
                ch = ASCII_CHARS[char_idx]

                fg = (r, g, b)
                if fg != last_fg:
                    line_parts.append(f"\x1b[38;2;{r};{g};{b}m")
                    last_fg = fg
                line_parts.append(ch)
            lines.append("".join(line_parts))
        return "\n".join(lines) + "\x1b[0m"

class VideoStreamHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        sys.stderr.write(f"[{self.log_date_time_string()}] {self.address_string()} - {format%args}\n")

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip('/')
        params = urllib.parse.parse_qs(parsed.query)
        user_agent = self.headers.get('User-Agent', '').lower()

        # Check if URL explicitly overrides defaults
        has_mode = 'mode' in params
        has_filter = 'filter' in params or 'fx' in params
        has_w = 'w' in params or 'width' in params
        has_h = 'h' in params or 'height' in params

        current_cfg = ServerConfig.get_snapshot()

        width = get_int_param(params, ['w', 'width'], current_cfg['width'])
        if has_w and not has_h:
            height = int(width * (9.0 / 16.0))
        else:
            height = get_int_param(params, ['h', 'height'], current_cfg['height'])
            if has_h and not has_w:
                width = int(height * (16.0 / 9.0))

        fps = get_int_param(params, ['fps'], current_cfg['fps'])
        mode = get_str_param(params, ['mode'], current_cfg['mode']).lower()
        filter_name = get_str_param(params, ['filter', 'fx'], current_cfg['filter_name']).lower()
        osd_flag = get_int_param(params, ['osd'], 1 if current_cfg['osd'] else 0) == 1

        width = max(16, min(width, 1920))
        height = max(9, min(height, 1080))
        fps = max(1, min(fps, 60))

        accept_header = self.headers.get('Accept', '').lower()
        is_html_preferred = ('text/html' in accept_header and 'text/plain' not in accept_header and not params.get('raw'))
        is_cli_client = any(cli in user_agent for cli in ['curl', 'powershell', 'wget', 'httpie', 'python', 'winhttp'])

        if path == '/v':
            self.send_web_terminal_player(width, height, fps, mode, filter_name, osd_flag)
            return

        if path == '/landing':
            self.send_html_landing(width, height, fps, mode)
            return

        if (path == '' or path == '/') and is_html_preferred and not is_cli_client:
            self.send_html_landing(width, height, fps, mode)
            return

        # Chunked stream response
        self.send_response(200)
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        self.send_header('Transfer-Encoding', 'chunked')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Connection', 'close')
        self.end_headers()

        async_buf = AsyncFrameBuffer()
        
        try:
            initial_seq = "\x1b[2J\x1b[H\x1b[?25l".encode('utf-8')
            self.wfile.write(f"{len(initial_seq):X}\r\n".encode('ascii') + initial_seq + b"\r\n")

            last_mode = mode
            last_w = width

            while True:
                t0 = time.time()
                
                # Check for live server configuration updates (< 100ms response time)
                live_cfg = ServerConfig.get_snapshot()
                if not has_mode: mode = live_cfg['mode']
                if not has_filter: filter_name = live_cfg['filter_name']
                if not has_w and not has_h:
                    width = live_cfg['width']
                    height = live_cfg['height']
                fps = live_cfg['fps']

                # Reset screen on layout change
                if mode != last_mode or width != last_w:
                    clr = "\x1b[2J\x1b[H".encode('utf-8')
                    self.wfile.write(f"{len(clr):X}\r\n".encode('ascii') + clr + b"\r\n")
                    last_mode = mode
                    last_w = width

                frame_idx, frame = async_buf.get_frame()
                if frame is None:
                    break

                ansi_str = frame_to_ansi_fast(frame, mode=mode, width=width, height=height)
                payload = ("\x1b[H" + ansi_str).encode('utf-8')
                
                chunk_header = f"{len(payload):X}\r\n".encode('ascii')
                self.wfile.write(chunk_header + payload + b"\r\n")
                self.wfile.flush()

                frame_delay = 1.0 / max(1, fps)
                elapsed = time.time() - t0
                sleep_time = frame_delay - elapsed
                if sleep_time > 0:
                    time.sleep(sleep_time)

        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            async_buf.stop()
            try:
                restore_seq = "\x1b[?25h\x1b[0m\n".encode('utf-8')
                self.wfile.write(f"{len(restore_seq):X}\r\n".encode('ascii') + restore_seq + b"\r\n")
                self.wfile.write(b"0\r\n\r\n")
            except Exception:
                pass

    def send_web_terminal_player(self, width, height, fps, mode, filter_name, osd_flag):
        osd_val = 1 if osd_flag else 0
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>asciivd - 16:9 Zero-Lag Web Player (/v)</title>
    <style>
        * {{ box-sizing: border-box; }}
        body {{
            background-color: #05070a;
            color: #e6edf3;
            font-family: 'Consolas', 'Courier New', monospace;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-height: 100vh;
        }}
        header {{
            width: 100%;
            background: #0d1117;
            border-bottom: 1px solid #30363d;
            padding: 12px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
        }}
        .brand {{ font-size: 1.2rem; font-weight: bold; color: #58a6ff; }}
        .controls {{ display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }}
        select, .btn {{
            background: #21262d;
            color: #79c0ff;
            border: 1px solid #30363d;
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-family: inherit;
            font-size: 0.85rem;
        }}
        .btn-green {{ background: #238636; color: white; border: none; }}
        .btn-green:hover {{ background: #2ea043; }}
        .terminal-container {{
            margin-top: 20px;
            background: #000;
            border: 1px solid #30363d;
            border-radius: 8px;
            padding: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.8);
            overflow: auto;
            max-width: 98vw;
            display: flex;
            justify-content: center;
        }}
        #term {{
            white-space: pre;
            line-height: 0.85;
            letter-spacing: 0px;
            font-family: 'Consolas', 'Courier New', monospace;
            font-weight: bold;
            font-size: 9px;
            aspect-ratio: 16 / 9;
        }}
        .footer {{
            margin: 15px 0;
            color: #8b949e;
            font-size: 0.85rem;
        }}
    </style>
</head>
<body>
    <header>
        <div class="brand">⚡ asciivd Live Hot-Swapping Stream</div>
        <div class="controls">
            <label>Mode:</label>
            <select id="modeSelect" onchange="updateParams()">
                <option value="block" {'selected' if mode=='block' else ''}>TrueColor Block (▀)</option>
                <option value="braille" {'selected' if mode=='braille' else ''}>Braille 2x4 Matrix (⠋)</option>
                <option value="edge" {'selected' if mode=='edge' else ''}>Neon Edge Outline</option>
                <option value="ascii" {'selected' if mode=='ascii' else ''}>ASCII Density</option>
            </select>

            <label>Filter FX:</label>
            <select id="filterSelect" onchange="updateParams()">
                <option value="none" {'selected' if filter_name=='none' else ''}>Normal TrueColor</option>
                <option value="glitch" {'selected' if filter_name=='glitch' else ''}>⚡ Cyber Glitch</option>
                <option value="vhs" {'selected' if filter_name=='vhs' else ''}>📼 VHS Scanlines</option>
                <option value="matrix" {'selected' if filter_name=='matrix' else ''}>🟢 Matrix Rain</option>
                <option value="cyberpunk" {'selected' if filter_name=='cyberpunk' else ''}>🟣 Cyberpunk Neon</option>
                <option value="thermal" {'selected' if filter_name=='thermal' else ''}>🔥 Thermal Heat</option>
                <option value="rainbow" {'selected' if filter_name=='rainbow' else ''}>🌈 Rainbow Hue</option>
            </select>
            
            <label>16:9 Preset:</label>
            <select id="resSelect" onchange="updateParams()">
                <option value="160x90" {'selected' if width==160 else ''}>160x90 (HD)</option>
                <option value="128x72" {'selected' if width==128 else ''}>128x72 (720p)</option>
                <option value="96x54" {'selected' if width==96 else ''}>96x54 (Medium)</option>
                <option value="64x36" {'selected' if width==64 else ''}>64x36 (Compact)</option>
            </select>

            <button class="btn btn-green" onclick="location.reload()">Reconnect</button>
        </div>
    </header>

    <div class="terminal-container">
        <div id="term">Connecting to live stream...</div>
    </div>

    <div class="footer">
        Streaming at 60 FPS | Zero-Lag ANSI RLE Compressor Active
    </div>

    <script>
        const term = document.getElementById('term');
        let currentUrl = '/?w={width}&h={height}&mode={mode}&fps={fps}&filter={filter_name}&osd={osd_val}&raw=1';

        function updateParams() {{
            const m = document.getElementById('modeSelect').value;
            const f = document.getElementById('filterSelect').value;
            const res = document.getElementById('resSelect').value.split('x');
            window.location.href = `/v?w=${{res[0]}}&h=${{res[1]}}&mode=${{m}}&fps={fps}&filter=${{f}}&osd={osd_val}`;
        }}

        function ansiToHtml(ansiStr) {{
            let html = '';
            let fg = null;
            let bg = null;

            const parts = ansiStr.split(/\\x1b\\[([0-9;?]*)([a-zA-Z])/g);

            for (let i = 0; i < parts.length; i++) {{
                if (i % 3 === 0) {{
                    let text = parts[i].replace(/\\x1b/g, '');
                    if (text) {{
                        let style = '';
                        if (fg) style += `color: rgb(${{fg}});`;
                        if (bg) style += `background-color: rgb(${{bg}});`;
                        if (style) {{
                            html += `<span style="${{style}}">${{text}}</span>`;
                        }} else {{
                            html += text;
                        }}
                    }}
                }} else if (i % 3 === 1) {{
                    const code = parts[i];
                    const cmd = parts[i+1];
                    i++;

                    if (code === '0' || code === '') {{
                        fg = null;
                        bg = null;
                    }} else if (code.startsWith('38;2;')) {{
                        const c = code.split(';');
                        if (c.length >= 5) fg = `${{c[2]}},${{c[3]}},${{c[4]}}`;
                    }} else if (code.startsWith('48;2;')) {{
                        const c = code.split(';');
                        if (c.length >= 5) bg = `${{c[2]}},${{c[3]}},${{c[4]}}`;
                    }}
                }}
            }}
            return html;
        }}

        async function startStream() {{
            try {{
                const response = await fetch(currentUrl);
                const reader = response.body.getReader();
                const decoder = new TextDecoder('utf-8');
                let buffer = '';

                while (true) {{
                    const {{ done, value }} = await reader.read();
                    if (done) break;
                    
                    buffer += decoder.decode(value, {{ stream: true }});
                    
                    const frames = buffer.split('\\x1b[H');
                    if (frames.length > 1) {{
                        const latestFrame = frames[frames.length - 1];
                        term.innerHTML = ansiToHtml(latestFrame);
                        buffer = '\\x1b[H' + latestFrame;
                    }}
                }}
            }} catch (err) {{
                term.innerText = 'Stream disconnected: ' + err.message;
            }}
        }}

        startStream();
    </script>
</body>
</html>"""
        encoded = html.encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def send_html_landing(self, width, height, fps, mode):
        local_ip = get_local_ip()
        host = self.headers.get('Host', f'{local_ip}:{self.server.server_port}')
        html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>asciivd - Live Hot-Swapping Streamer</title>
    <style>
        body {{
            background: #0d0f12;
            color: #33ff66;
            font-family: 'Courier New', Courier, monospace;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
        }}
        .card {{
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 12px;
            padding: 2rem;
            max-width: 700px;
            text-align: center;
            box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        }}
        h1 {{ margin-top: 0; color: #58a6ff; font-size: 2.2rem; }}
        code {{
            background: #090d11;
            color: #79c0ff;
            padding: 10px 16px;
            border-radius: 6px;
            display: block;
            margin: 12px 0;
            font-size: 1.05rem;
            text-align: left;
            border: 1px solid #21262d;
            user-select: all;
        }}
        .btn {{
            display: inline-block;
            background: #238636;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: bold;
            margin-top: 10px;
        }}
        .btn:hover {{ background: #2ea043; }}
        p {{ color: #8b949e; line-height: 1.6; }}
    </style>
</head>
<body>
    <div class="card">
        <h1>⚡ asciivd Live Streamer</h1>
        <p>Live control sync active. Watch in browser:</p>
        <a href="/v" class="btn">▶ Open Live Web Player (/v)</a>
        
        <p style="margin-top: 25px;">Or stream directly inside your terminal:</p>
        <code>curl.exe http://{host}/</code>
    </div>
</body>
</html>"""
        encoded = html.encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

# Desktop GUI Implementation (Tkinter)
def launch_gui(initial_video=None, port=8080, width=96, height=54, fps=30, mode='block'):
    import tkinter as tk
    from tkinter import filedialog, ttk, messagebox

    root = tk.Tk()
    root.title("asciivd - Live Hot-Swapping Control Center")
    root.geometry("860x730")
    root.configure(bg="#0d1117")

    style = ttk.Style()
    style.theme_use('clam')
    style.configure(".", background="#0d1117", foreground="#c9d1d9", font=("Consolas", 10))
    style.configure("TLabel", background="#0d1117", foreground="#c9d1d9")
    style.configure("TButton", background="#21262d", foreground="#58a6ff", borderwidth=1)
    style.map("TButton", background=[("active", "#30363d")])

    server_thread = None
    httpd_instance = None
    server_running = False

    video_path_var = tk.StringVar(value=initial_video if initial_video else "[Demo 16:9 Rainbow Plasma]")
    port_var = tk.IntVar(value=port)
    width_var = tk.IntVar(value=width)
    height_var = tk.IntVar(value=height)
    fps_var = tk.IntVar(value=fps)
    mode_var = tk.StringVar(value=mode)
    filter_var = tk.StringVar(value="none")
    osd_var = tk.BooleanVar(value=False)
    status_var = tk.StringVar(value="Status: Stopped")

    def sync_live_config(*args):
        """Immediately update live server configuration when GUI settings change."""
        target_file = video_path_var.get()
        if target_file == "[Demo 16:9 Rainbow Plasma]":
            target_file = None

        ServerConfig.update(
            video_source=target_file,
            width=width_var.get(),
            height=height_var.get(),
            fps=fps_var.get(),
            mode=mode_var.get(),
            filter_name=filter_var.get(),
            osd=osd_var.get()
        )

    # Attach live listeners
    video_path_var.trace_add("write", sync_live_config)
    width_var.trace_add("write", sync_live_config)
    height_var.trace_add("write", sync_live_config)
    fps_var.trace_add("write", sync_live_config)
    mode_var.trace_add("write", sync_live_config)
    filter_var.trace_add("write", sync_live_config)
    osd_var.trace_add("write", sync_live_config)

    # Initial sync
    sync_live_config()

    title_label = tk.Label(root, text="⚡ asciivd Live Hot-Swapping Control Center", font=("Consolas", 18, "bold"), bg="#0d1117", fg="#58a6ff")
    title_label.pack(pady=12)

    file_frame = tk.LabelFrame(root, text=" Video Source ", bg="#161b22", fg="#79c0ff", font=("Consolas", 10, "bold"), padx=10, pady=10)
    file_frame.pack(fill="x", padx=15, pady=5)

    entry_path = tk.Entry(file_frame, textvariable=video_path_var, font=("Consolas", 9), bg="#0d1117", fg="#79c0ff", insertbackground="white")
    entry_path.pack(side="left", fill="x", expand=True, padx=(0, 10))

    def browse_file():
        filename = filedialog.askopenfilename(filetypes=[("Video files", "*.mp4 *.avi *.mkv *.mov *.webm *.flv"), ("All files", "*.*")])
        if filename:
            video_path_var.set(filename)

    btn_browse = tk.Button(file_frame, text="Browse Video", command=browse_file, bg="#238636", fg="white", font=("Consolas", 9, "bold"), bd=0, padx=10, pady=4, cursor="hand2")
    btn_browse.pack(side="right")

    settings_frame = tk.LabelFrame(root, text=" Live Settings & Shader FX (Updates Instantly!) ", bg="#161b22", fg="#79c0ff", font=("Consolas", 10, "bold"), padx=10, pady=10)
    settings_frame.pack(fill="x", padx=15, pady=5)

    row1 = tk.Frame(settings_frame, bg="#161b22")
    row1.pack(fill="x", pady=4)
    tk.Label(row1, text="Port:", bg="#161b22").pack(side="left")
    tk.Entry(row1, textvariable=port_var, width=8, bg="#0d1117", fg="white").pack(side="left", padx=(5, 15))

    tk.Label(row1, text="Mode:", bg="#161b22").pack(side="left")
    mode_combo = ttk.Combobox(row1, textvariable=mode_var, values=["block", "solid", "braille", "edge", "ascii"], width=10, state="readonly")
    mode_combo.pack(side="left", padx=5)

    tk.Label(row1, text="Filter FX:", bg="#161b22").pack(side="left", padx=(10, 5))
    filter_combo = ttk.Combobox(row1, textvariable=filter_var, values=["none", "glitch", "vhs", "matrix", "cyberpunk", "thermal", "rainbow", "sepia", "invert", "bw"], width=12, state="readonly")
    filter_combo.pack(side="left")

    row2 = tk.Frame(settings_frame, bg="#161b22")
    row2.pack(fill="x", pady=4)

    def on_width_change(val):
        w = int(float(val))
        h = int(w * (9.0 / 16.0))
        height_var.set(h)

    tk.Label(row2, text="Width:", bg="#161b22").pack(side="left")
    scale_w = tk.Scale(row2, from_=16, to=1920, orient="horizontal", variable=width_var, command=on_width_change, bg="#161b22", fg="white", highlightthickness=0, length=140)
    scale_w.pack(side="left", padx=(5, 15))

    tk.Label(row2, text="Height (16:9):", bg="#161b22").pack(side="left")
    tk.Entry(row2, textvariable=height_var, width=6, bg="#0d1117", fg="#58a6ff", state="readonly").pack(side="left", padx=(5, 15))

    tk.Label(row2, text="FPS:", bg="#161b22").pack(side="left")
    tk.Scale(row2, from_=5, to=60, orient="horizontal", variable=fps_var, bg="#161b22", fg="white", highlightthickness=0, length=100).pack(side="left", padx=5)

    chk_osd = tk.Checkbutton(row2, text="VHS OSD", variable=osd_var, bg="#161b22", fg="#e3b341", selectcolor="#0d1117")
    chk_osd.pack(side="left", padx=10)

    ctrl_frame = tk.Frame(root, bg="#0d1117")
    ctrl_frame.pack(fill="x", padx=15, pady=10)

    status_label = tk.Label(ctrl_frame, textvariable=status_var, font=("Consolas", 11, "bold"), bg="#0d1117", fg="#e3b341")
    status_label.pack(side="left")

    def toggle_server():
        nonlocal server_thread, httpd_instance, server_running
        if not server_running:
            sync_live_config()
            port_num = port_var.get()

            try:
                httpd_instance = ThreadedHTTPServer(("0.0.0.0", port_num), VideoStreamHandler)
                server_thread = threading.Thread(target=httpd_instance.serve_forever, daemon=True)
                server_thread.start()
                server_running = True
                
                local_ip = get_local_ip()
                status_var.set(f"⚡ Live Server Active: http://{local_ip}:{port_num}")
                status_label.config(fg="#3fb950")
                btn_toggle.config(text="Stop Server", bg="#da3633")

                url_curl = f"curl.exe http://{local_ip}:{port_num}/"
                url_browser = f"http://{local_ip}:{port_num}/v"
                entry_curl.delete(0, tk.END)
                entry_curl.insert(0, url_curl)
                entry_web.delete(0, tk.END)
                entry_web.insert(0, url_browser)

            except Exception as e:
                messagebox.showerror("Server Error", f"Failed to start server:\n{e}")
        else:
            if httpd_instance:
                httpd_instance.shutdown()
                httpd_instance.server_close()
            server_running = False
            status_var.set("Status: Stopped")
            status_label.config(fg="#e3b341")
            btn_toggle.config(text="Start Server", bg="#238636")

    btn_toggle = tk.Button(ctrl_frame, text="Start Server", command=toggle_server, bg="#238636", fg="white", font=("Consolas", 11, "bold"), bd=0, padx=18, pady=6, cursor="hand2")
    btn_toggle.pack(side="right")

    links_frame = tk.LabelFrame(root, text=" Stream URLs (Live Sync Active) ", bg="#161b22", fg="#79c0ff", font=("Consolas", 10, "bold"), padx=10, pady=10)
    links_frame.pack(fill="x", padx=15, pady=5)

    row_c = tk.Frame(links_frame, bg="#161b22")
    row_c.pack(fill="x", pady=3)
    tk.Label(row_c, text="Terminal (curl.exe):", bg="#161b22", width=18, anchor="w").pack(side="left")
    entry_curl = tk.Entry(row_c, font=("Consolas", 9), bg="#0d1117", fg="#79c0ff")
    entry_curl.pack(side="left", fill="x", expand=True, padx=5)

    row_w = tk.Frame(links_frame, bg="#161b22")
    row_w.pack(fill="x", pady=3)
    tk.Label(row_w, text="Browser Player (/v):", bg="#161b22", width=18, anchor="w").pack(side="left")
    entry_web = tk.Entry(row_w, font=("Consolas", 9), bg="#0d1117", fg="#79c0ff")
    entry_web.pack(side="left", fill="x", expand=True, padx=5)

    preview_frame = tk.LabelFrame(root, text=" 16:9 Live Preview ", bg="#161b22", fg="#79c0ff", font=("Consolas", 10, "bold"), padx=5, pady=5)
    preview_frame.pack(fill="both", expand=True, padx=15, pady=5)

    preview_text = tk.Text(preview_frame, bg="#000000", fg="#33ff66", font=("Courier", 6), bd=0, highlightthickness=0)
    preview_text.pack(fill="both", expand=True)

    def update_gui_preview():
        async_buf = AsyncFrameBuffer()
        while True:
            f_idx, frame = async_buf.get_frame()
            if frame is None:
                continue

            resized = cv2.resize(frame, (64, 36))
            gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
            num_chars = len(ASCII_CHARS)
            lines = []
            for y in range(36):
                line_chars = []
                for x in range(64):
                    val = gray[y, x]
                    idx = int((val / 255.0) * (num_chars - 1))
                    line_chars.append(ASCII_CHARS[idx])
                lines.append("".join(line_chars))
            plain_ascii = "\n".join(lines)

            try:
                preview_text.delete("1.0", tk.END)
                preview_text.insert("1.0", plain_ascii)
            except Exception:
                async_buf.stop()
                return

            time.sleep(0.06)

    prev_thread = threading.Thread(target=update_gui_preview, daemon=True)
    prev_thread.start()

    root.protocol("WM_DELETE_WINDOW", lambda: (httpd_instance.shutdown() if httpd_instance else None, root.destroy()))
    root.mainloop()

def play_local(source_path, width=96, height=54, mode='block', fps=30, filter_name='none', osd=False):
    """Play the ASCII video directly inside current terminal window."""
    ServerConfig.update(
        video_source=source_path,
        width=width,
        height=height,
        fps=fps,
        mode=mode,
        filter_name=filter_name,
        osd=osd
    )
    async_buf = AsyncFrameBuffer()
    frame_delay = 1.0 / fps

    print("\x1b[2J\x1b[H\x1b[?25l", end="")
    try:
        while True:
            t0 = time.time()
            frame_idx, frame = async_buf.get_frame()
            if frame is None:
                break

            cfg = ServerConfig.get_snapshot()
            ansi_str = frame_to_ansi_fast(frame, mode=cfg['mode'], width=cfg['width'], height=cfg['height'])
            sys.stdout.write("\x1b[H" + ansi_str)
            sys.stdout.flush()

            elapsed = time.time() - t0
            sleep_time = frame_delay - elapsed
            if sleep_time > 0:
                time.sleep(sleep_time)
    except KeyboardInterrupt:
        pass
    finally:
        async_buf.stop()
        print("\x1b[?25h\x1b[0m\n")

def main():
    parser = argparse.ArgumentParser(
        description="asciivd - Live Hot-Swapping 16:9 ANSI Video Server (/v browser player & curl) & GUI Control Center."
    )
    parser.add_argument("video", nargs="?", help="Path to video file")
    parser.add_argument("-p", "--port", type=int, default=8080, help="HTTP server port (default: 8080)")
    parser.add_argument("-b", "--bind", default="0.0.0.0", help="HTTP server bind host (default: 0.0.0.0)")
    parser.add_argument("-w", "--width", type=int, default=96, help="Default terminal width in columns (default: 96 for 16:9)")
    parser.add_argument("-y", "--height", type=int, default=54, help="Default terminal height in rows (default: 54 for 16:9)")
    parser.add_argument("-m", "--mode", choices=["block", "ascii", "braille", "edge"], default="block", help="Playback mode: 'block', 'braille' (2x4 matrix), 'edge' (neon outline), or 'ascii'")
    parser.add_argument("-f", "--fps", type=int, default=30, help="Playback frame rate (default: 30)")
    parser.add_argument("--filter", choices=["none", "glitch", "vhs", "matrix", "cyberpunk", "thermal", "rainbow", "sepia", "invert", "bw"], default="none", help="Visual Shader FX filter")
    parser.add_argument("--osd", action="store_true", help="Enable VHS Timecode & Resolution OSD overlay")
    parser.add_argument("--cli", action="store_true", help="Force headless CLI mode instead of GUI")
    parser.add_argument("--play", action="store_true", help="Play directly in local terminal window")

    args = parser.parse_args()

    if args.width and not args.height:
        args.height = int(args.width * (9.0 / 16.0))

    ServerConfig.update(
        video_source=args.video,
        width=args.width,
        height=args.height,
        fps=args.fps,
        mode=args.mode,
        filter_name=args.filter,
        osd=args.osd
    )

    if not args.cli and not args.play and len(sys.argv) == 1:
        launch_gui(initial_video=args.video, port=args.port, width=args.width, height=args.height, fps=args.fps, mode=args.mode)
        return

    if args.play:
        play_local(args.video, width=args.width, height=args.height, mode=args.mode, fps=args.fps, filter_name=args.filter, osd=args.osd)
        return

    server_address = (args.bind, args.port)
    httpd = ThreadedHTTPServer(server_address, VideoStreamHandler)

    local_ip = get_local_ip()
    video_info = args.video if args.video else "[Demo 16:9 Rainbow Plasma]"
    print("=" * 65)
    print("  \x1b[36m█████╗ ███████╗██╗██╗██╗   ██╗██████╗ \x1b[0m")
    print("  \x1b[36m██╔══██╗██╔════╝██║██║██║   ██║██╔══██╗\x1b[0m")
    print("  \x1b[36m███████║███████╗██║██║██║   ██║██║  ██║\x1b[0m")
    print("  \x1b[36m██╔══██║╚════██║██║██║██║   ██║██║  ██║\x1b[0m")
    print("  \x1b[36m██║  ██║███████║██║██║╚██████╔╝██████╔╝\x1b[0m")
    print("  \x1b[36m╚═╝  ╚═╝╚══════╝╚═╝╚═╝ ╚═════╝ ╚═════╝ \x1b[0m")
    print("=" * 65)
    print(f"  > Target Video : {video_info}")
    print(f"  > Server Listen: http://{local_ip}:{args.port}")
    print(f"  > Mode Sync    : Live Hot-Swapping Enabled (< 100ms response)")
    print("-" * 65)
    print(f"  \x1b[32m▶ Live Browser Player:\x1b[0m  \x1b[1mhttp://{local_ip}:{args.port}/v\x1b[0m")
    print(f"  \x1b[32m▶ Live Terminal Stream:\x1b[0m \x1b[1mcurl.exe http://{local_ip}:{args.port}/\x1b[0m")
    print("=" * 65)
    print("  Press Ctrl+C to stop server.\n")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[*] Server stopped.")

if __name__ == "__main__":
    main()
