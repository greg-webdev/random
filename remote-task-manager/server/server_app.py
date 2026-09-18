"""
Remote Task Manager - Host Server Application
Runs on the target machine (e.g., 192.168.50.148).
- Auto-starts server listening on launch.
- Auto-hides directly to Windows System Tray (^ up arrow on taskbar).
- Windows startup registration toggle (Run on Windows boot).
- File upload handling with direct path or server explorer selection.
- Video playback on fullscreen (dismissable with 'Z' key or via client stop).
- Privacy screen blanking overlay (dismissable with 'Z' key or via client stop).
"""

import sys
import os
import time
import json
import base64
import socket
import argparse
import platform
import subprocess
import threading
import winreg
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, unquote
import string
import tempfile
import ctypes
import tkinter as tk
from tkinter import ttk, messagebox, filedialog

import re
import shutil

def get_ffmpeg_exe():
    """Locate bundled or system ffmpeg executable without any DLL locking."""
    if getattr(sys, 'frozen', False):
        base_dir = getattr(sys, '_MEIPASS', os.path.dirname(sys.executable))
        for name in ['ffmpeg.exe', 'ffmpeg-win-x86_64-v7.1.exe']:
            candidate = os.path.join(base_dir, name)
            if os.path.isfile(candidate):
                return candidate
            candidate_sub = os.path.join(base_dir, 'imageio_ffmpeg', 'binaries', name)
            if os.path.isfile(candidate_sub):
                return candidate_sub
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        pass
    return shutil.which('ffmpeg')


class FullscreenTkVideoPlayer(tk.Toplevel):
    """
    Pure Python/Tkinter Native Borderless Fullscreen Video Player.
    Decodes video via isolated static FFmpeg stream and renders to Canvas with PIL.
    - Zero Windows Media Player/MFT/DirectShow dependency.
    - Zero OpenCV HighGUI windowing issues.
    - Zero Win32 cross-thread message pump conflicts.
    - Zero DLL locking on PyInstaller exit.
    - Blocks Escape, Alt+F4, right-click, and mouse clicks.
    - Dismissable ONLY via 'Z' key or remote client stop.
    """
    def __init__(self, master, video_path, on_finish=None, log_fn=None):
        super().__init__(master)
        self.video_path = os.path.abspath(video_path)
        self.on_finish = on_finish
        self.log_fn = log_fn or print
        self.is_running = True
        self.ffmpeg_proc = None

        self.title("Remote Video Playback")
        self.attributes("-fullscreen", True)
        self.attributes("-topmost", True)
        self.configure(bg="black", cursor="none")

        # Block Alt+F4
        self.protocol("WM_DELETE_WINDOW", lambda: None)

        # Intercept keys: Only 'Z' or 'z' exits; block Escape, Space, etc.
        self.bind("<Key>", self._on_key)
        self.bind("<Button-1>", lambda e: "break")
        self.bind("<Button-2>", lambda e: "break")
        self.bind("<Button-3>", lambda e: "break")
        self.focus_force()

        self.screen_w = self.winfo_screenwidth()
        self.screen_h = self.winfo_screenheight()

        self.canvas = tk.Canvas(
            self,
            bg="black",
            highlightthickness=0,
            width=self.screen_w,
            height=self.screen_h
        )
        self.canvas.pack(fill=tk.BOTH, expand=True)

        self.image_id = None
        self.current_photo = None

        self.thread = threading.Thread(target=self._worker, daemon=True)
        self.thread.start()

    def _on_key(self, event):
        if event.keysym in ('z', 'Z') or event.char in ('z', 'Z'):
            self.stop("dismissed with 'Z' key")
        return "break"

    def stop(self, reason="stopped"):
        if not self.is_running:
            return
        self.is_running = False
        if self.ffmpeg_proc:
            try:
                self.ffmpeg_proc.terminate()
                self.ffmpeg_proc.kill()
            except Exception:
                pass
        self.after(0, lambda: self._cleanup(reason))

    def _cleanup(self, reason):
        try:
            self.destroy()
        except Exception:
            pass
        if self.on_finish:
            self.on_finish(reason)

    def _worker(self):
        ffmpeg_bin = get_ffmpeg_exe()
        if not ffmpeg_bin or not os.path.isfile(ffmpeg_bin):
            self.log_fn(f"[VIDEO ERROR] FFmpeg executable not found for '{os.path.basename(self.video_path)}'.")
            self.stop("ffmpeg not found")
            return

        # 1. Probe resolution and FPS
        startupinfo = None
        if os.name == "nt":
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW

        cmd_probe = [ffmpeg_bin, "-i", self.video_path]
        try:
            probe_res = subprocess.run(
                cmd_probe,
                stderr=subprocess.PIPE,
                text=True,
                errors="replace",
                startupinfo=startupinfo
            )
            match = re.search(r'(\d{2,5})x(\d{2,5})', probe_res.stderr)
            vw, vh = (int(match.group(1)), int(match.group(2))) if match else (1280, 720)
            fps_match = re.search(r'(\d+(?:\.\d+)?)\s*fps', probe_res.stderr)
            fps = float(fps_match.group(1)) if fps_match else 30.0
            if fps <= 0 or fps > 120:
                fps = 30.0
            frame_delay = 1.0 / fps
        except Exception as e:
            self.log_fn(f"[VIDEO ERROR] Failed probing '{os.path.basename(self.video_path)}': {e}")
            self.stop(f"probe error: {e}")
            return

        # Calculate aspect-ratio letterboxing dimensions
        scale = min(self.screen_w / vw, self.screen_h / vh)
        target_w = max(2, int(vw * scale))
        target_h = max(2, int(vh * scale))
        x_off = (self.screen_w - target_w) // 2
        y_off = (self.screen_h - target_h) // 2

        frame_bytes_len = target_w * target_h * 3
        cmd = [
            ffmpeg_bin,
            "-v", "error",
            "-i", self.video_path,
            "-vf", f"scale={target_w}:{target_h}",
            "-f", "rawvideo",
            "-pix_fmt", "rgb24",
            "-"
        ]

        self.log_fn(f"[CUSTOM VIDEO] Playing '{os.path.basename(self.video_path)}' ({int(fps)} FPS, {target_w}x{target_h} letterboxed). Press 'Z' on server or Stop on client.")

        try:
            self.ffmpeg_proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                bufsize=frame_bytes_len * 5,
                startupinfo=startupinfo
            )
        except Exception as e:
            self.log_fn(f"[VIDEO ERROR] Failed launching FFmpeg decoder: {e}")
            self.stop(f"launch error: {e}")
            return

        while self.is_running:
            t_start = time.perf_counter()
            raw_data = self.ffmpeg_proc.stdout.read(frame_bytes_len)
            if not raw_data or len(raw_data) < frame_bytes_len:
                break

            img = Image.frombytes("RGB", (target_w, target_h), raw_data)
            photo = ImageTk.PhotoImage(img)

            def _update(p=photo):
                if not self.is_running:
                    return
                self.current_photo = p
                if self.image_id is None:
                    self.image_id = self.canvas.create_image(x_off, y_off, image=p, anchor="nw")
                else:
                    self.canvas.itemconfig(self.image_id, image=p)

            self.after(0, _update)

            elapsed = time.perf_counter() - t_start
            sleep_time = max(0.001, frame_delay - elapsed)
            time.sleep(sleep_time)

        if self.is_running:
            self.stop("video finished")


class SadFaceOverlay(tk.Toplevel):
    """Fullscreen 2-second Sad Face Reaction Window."""
    def __init__(self, master=None, duration=2.0):
        super().__init__(master)
        self.duration = duration

        self.title("Sad Face Reaction")
        self.attributes("-fullscreen", True)
        self.attributes("-topmost", True)
        self.configure(bg="#0b0f19", cursor="none")
        self.focus_force()

        # Block closing
        self.protocol("WM_DELETE_WINDOW", lambda: None)
        self.bind("<Key>", lambda e: "break")
        self.bind("<Button-1>", lambda e: "break")

        sw = self.winfo_screenwidth()
        sh = self.winfo_screenheight()

        canvas = tk.Canvas(self, bg="#0b0f19", highlightthickness=0, width=sw, height=sh)
        canvas.pack(fill=tk.BOTH, expand=True)

        cx, cy = sw // 2, sh // 2
        r = min(sw, sh) // 4

        # Face circle
        canvas.create_oval(cx - r, cy - r, cx + r, cy + r, outline="#38bdf8", width=8, fill="#0f172a")

        # Sad Eyes
        eye_r = r // 5
        eye_y = cy - r // 3
        canvas.create_oval(cx - r//2 - eye_r, eye_y - eye_r, cx - r//2 + eye_r, eye_y + eye_r, fill="#38bdf8", outline="")
        canvas.create_oval(cx + r//2 - eye_r, eye_y - eye_r, cx + r//2 + eye_r, eye_y + eye_r, fill="#38bdf8", outline="")

        # Tear drop on left eye
        tear_x = cx - r//2 + eye_r//2
        tear_y = eye_y + eye_r * 2
        canvas.create_polygon(
            tear_x, tear_y - 15,
            tear_x + 10, tear_y + 10,
            tear_x, tear_y + 15,
            tear_x - 10, tear_y + 10,
            fill="#60a5fa", outline=""
        )

        # Sad downturned mouth
        mouth_r = r // 2
        mouth_y = cy + r // 6
        canvas.create_arc(
            cx - mouth_r, mouth_y,
            cx + mouth_r, mouth_y + mouth_r * 1.4,
            start=30, extent=120,
            style="arc", outline="#38bdf8", width=10
        )

        # Subtitle
        canvas.create_text(
            cx, cy + r + 60,
            text=":( Why so mean?",
            font=("Segoe UI", 28, "bold"),
            fill="#94a3b8"
        )

        # Auto-destroy after duration
        self.after(int(duration * 1000), self._auto_close)

    def _auto_close(self):
        try:
            self.destroy()
        except Exception:
            pass


try:
    import psutil
except ImportError:
    psutil = None

try:
    import pystray
    from PIL import Image, ImageDraw, ImageTk
except ImportError:
    pystray = None

try:
    import cv2
except ImportError:
    cv2 = None

DEFAULT_PORT = 8888
REG_KEY_RUN = r"Software\Microsoft\Windows\CurrentVersion\Run"
APP_NAME_STARTUP = "RemoteTaskManagerServer"
SERVER_CONFIG_FILE = os.path.join(os.path.expanduser("~"), ".remote_task_manager_server.json")

def load_server_config():
    if os.path.exists(SERVER_CONFIG_FILE):
        try:
            with open(SERVER_CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "gesture_enabled": True,
        "gesture_sensitivity": 100
    }

def save_server_config(cfg):
    try:
        cur = load_server_config()
        cur.update(cfg)
        with open(SERVER_CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(cur, f, indent=2)
    except Exception:
        pass

# UI Palette for Server (Emerald Host Theme)
BG_MAIN = "#111827"          # Slate 900
BG_PANEL = "#1f2937"         # Slate 800
BG_INPUT = "#374151"         # Slate 700
BORDER_COL = "#4b5563"       # Slate 600
TEXT_HEAD = "#f9fafb"        # Slate 50
TEXT_MUTED = "#9ca3af"       # Slate 400
ACCENT_GREEN = "#10b981"     # Emerald 500
ACCENT_RED = "#ef4444"       # Red 500
ACCENT_BLUE = "#3b82f6"      # Blue 500


class ServerRequestHandler(BaseHTTPRequestHandler):
    logger_callback = None
    server_gui_instance = None

    def _log_event(self, message):
        if ServerRequestHandler.logger_callback:
            ServerRequestHandler.logger_callback(message)

    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json(self, status_code, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        client_ip = self.client_address[0]
        parsed = urlparse(self.path)
        path = parsed.path

        if path in ("/", "/api/status"):
            self._log_event(f"[HANDSHAKE] Connected from {client_ip}")
            self.handle_status()
        elif path == "/api/metrics":
            self.handle_metrics()
        elif path == "/api/processes":
            self.handle_processes()
        elif path == "/api/screen_status":
            is_blank = False
            is_video = False
            if ServerRequestHandler.server_gui_instance:
                is_blank = ServerRequestHandler.server_gui_instance.is_blanked
                is_video = ServerRequestHandler.server_gui_instance.is_video_playing
            self._send_json(200, {"blanked": is_blank, "video_playing": is_video})
        elif path == "/api/browse":
            query_params = parse_qs(parsed.query)
            target_path = query_params.get("path", [""])[0]
            self.handle_browse(target_path, client_ip)
        elif path == "/api/cam_frame":
            self.handle_cam_frame()
        elif path == "/api/cam_stream":
            self.handle_cam_stream()
        elif path == "/api/cam_status":
            self.handle_cam_status()
        elif path == "/api/internal_video_done":
            if ServerRequestHandler.server_gui_instance:
                ServerRequestHandler.server_gui_instance.stop_fullscreen_video()
            self._send_json(200, {"success": True})
        else:
            self._send_json(404, {"error": f"Endpoint not found: {path}"})

    def do_POST(self):
        client_ip = self.client_address[0]
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/internal_video_done":
            if ServerRequestHandler.server_gui_instance:
                ServerRequestHandler.server_gui_instance.stop_fullscreen_video()
            self._send_json(200, {"success": True})
            return

        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length) if content_length > 0 else b"{}"
        try:
            payload = json.loads(post_data.decode("utf-8")) if post_data else {}
        except Exception:
            self._send_json(400, {"error": "Invalid JSON payload"})
            return

        if path == "/api/kill":
            self.handle_kill(payload, client_ip)
        elif path == "/api/run":
            self.handle_run(payload, client_ip)
        elif path == "/api/upload":
            self.handle_upload(payload, client_ip)
        elif path == "/api/mkdir":
            self.handle_mkdir(payload, client_ip)
        elif path == "/api/blank":
            self.handle_blank(payload, client_ip)
        elif path == "/api/video":
            self.handle_video(payload, client_ip)
        elif path == "/api/gesture":
            self.handle_gesture(payload, client_ip)
        elif path == "/api/power":
            self.handle_power(payload, client_ip)
        else:
            self._send_json(404, {"error": f"Endpoint not found: {path}"})

    def handle_status(self):
        boot_time = psutil.boot_time() if psutil else time.time()
        uptime = int(time.time() - boot_time)
        is_blank = False
        is_video = False
        is_gesture = False
        gesture_sens = 100
        cam_info = {"active": False, "width": 0, "height": 0, "fps": 0.0, "gesture_enabled": False}
        if ServerRequestHandler.server_gui_instance:
            is_blank = ServerRequestHandler.server_gui_instance.is_blanked
            is_video = ServerRequestHandler.server_gui_instance.is_video_playing
            if hasattr(ServerRequestHandler.server_gui_instance, "gesture_enabled_var"):
                is_gesture = ServerRequestHandler.server_gui_instance.gesture_enabled_var.get()
            if hasattr(ServerRequestHandler.server_gui_instance, "gesture_sensitivity_var"):
                gesture_sens = ServerRequestHandler.server_gui_instance.gesture_sensitivity_var.get()
            elif hasattr(ServerRequestHandler.server_gui_instance, "gesture_service") and ServerRequestHandler.server_gui_instance.gesture_service:
                gesture_sens = getattr(ServerRequestHandler.server_gui_instance.gesture_service, "sensitivity", 70)
            if hasattr(ServerRequestHandler.server_gui_instance, "gesture_service") and ServerRequestHandler.server_gui_instance.gesture_service:
                cam_info = ServerRequestHandler.server_gui_instance.gesture_service.get_status()

        # Get primary network MAC address
        try:
            import uuid as _uuid
            mac_int = _uuid.getnode()
            mac_addr = ':'.join(f'{(mac_int >> (i * 8)) & 0xff:02x}' for i in reversed(range(6)))
        except Exception:
            mac_addr = "00:00:00:00:00:00"

        data = {
            "status": "online",
            "hostname": platform.node(),
            "os": f"{platform.system()} {platform.release()}",
            "arch": platform.machine(),
            "boot_time": boot_time,
            "uptime_seconds": uptime,
            "cpu_count": psutil.cpu_count(logical=True) if psutil else 1,
            "cpu_physical": psutil.cpu_count(logical=False) if psutil else 1,
            "blanked": is_blank,
            "video_playing": is_video,
            "gesture_enabled": is_gesture,
            "gesture_sensitivity": gesture_sens,
            "camera": cam_info,
            "mac_address": mac_addr
        }
        self._send_json(200, data)

    def handle_metrics(self):
        if not psutil:
            self._send_json(500, {"error": "psutil not available"})
            return

        vm = psutil.virtual_memory()
        cpu_pct = psutil.cpu_percent(interval=None)
        root_path = "C:\\" if os.name == "nt" else "/"
        try:
            disk = psutil.disk_usage(root_path)
            disk_data = {
                "total_gb": round(disk.total / (1024**3), 1),
                "used_gb": round(disk.used / (1024**3), 1),
                "free_gb": round(disk.free / (1024**3), 1),
                "percent": disk.percent
            }
        except Exception:
            disk_data = {"percent": 0, "total_gb": 0, "used_gb": 0, "free_gb": 0}

        data = {
            "timestamp": time.time(),
            "cpu_percent": cpu_pct,
            "memory": {
                "total_mb": round(vm.total / (1024**2), 1),
                "used_mb": round(vm.used / (1024**2), 1),
                "available_mb": round(vm.available / (1024**2), 1),
                "percent": vm.percent
            },
            "disk": disk_data,
            "process_count": len(psutil.pids())
        }
        self._send_json(200, data)

    def handle_processes(self):
        if not psutil:
            self._send_json(500, {"error": "psutil not available"})
            return

        total_mem = 0
        try:
            total_mem = psutil.virtual_memory().total
        except Exception:
            pass

        procs = []
        for p in psutil.process_iter(['pid', 'name', 'username', 'memory_info', 'cpu_percent']):
            try:
                info = p.info
                mem_info = info.get('memory_info')
                rss = mem_info.rss if mem_info else 0
                mem_mb = round(rss / (1024**2), 1)
                mem_pct = round((rss / total_mem) * 100, 1) if total_mem > 0 else 0.0
                cpu_pct = round(info.get('cpu_percent') or 0.0, 1)
                procs.append({
                    "pid": info.get("pid", 0),
                    "name": info.get("name", "unknown") or "unknown",
                    "user": info.get("username") or "",
                    "cpu_percent": cpu_pct,
                    "memory_mb": mem_mb,
                    "memory_percent": mem_pct,
                    "status": "running",
                    "create_time": 0
                })
            except (psutil.Error, OSError, Exception):
                continue

        procs.sort(key=lambda x: x["memory_mb"], reverse=True)
        self._send_json(200, {"processes": procs, "count": len(procs)})

    def handle_kill(self, payload, client_ip):
        pid = payload.get("pid")
        force = payload.get("force", False)
        if not pid or not isinstance(pid, int):
            self._send_json(400, {"error": "Invalid or missing 'pid'"})
            return

        try:
            proc = psutil.Process(pid)
            pname = proc.name()
            if force:
                proc.kill()
                msg = f"Force-killed '{pname}' (PID {pid})"
            else:
                proc.terminate()
                msg = f"Terminated '{pname}' (PID {pid})"

            self._log_event(f"[KILL] {client_ip}: {msg}")
            self._send_json(200, {"success": True, "message": msg, "pid": pid})
        except psutil.NoSuchProcess:
            self._send_json(404, {"error": f"PID {pid} not found (already exited)"})
        except psutil.AccessDenied:
            self._log_event(f"[ACCESS_DENIED] Cannot terminate PID {pid} requested by {client_ip}")
            self._send_json(403, {"error": f"Access denied. Cannot terminate protected process (PID {pid})"})
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def handle_run(self, payload, client_ip):
        command = payload.get("command")
        if not command or not isinstance(command, str):
            self._send_json(400, {"error": "Missing 'command'"})
            return

        try:
            p = subprocess.Popen(command, shell=True)
            self._log_event(f"[RUN] {client_ip} launched command: '{command}' (PID: {p.pid})")
            self._send_json(200, {"success": True, "pid": p.pid})
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def handle_upload(self, payload, client_ip):
        filename = payload.get("filename")
        data_b64 = payload.get("data")
        target_dir = payload.get("target_dir")  # Optional: specific directory requested by client
        prompt_mode = payload.get("prompt_on_server", False)

        if not filename or not data_b64:
            self._send_json(400, {"error": "Missing filename or data"})
            return

        try:
            file_bytes = base64.b64decode(data_b64)
        except Exception as e:
            self._send_json(400, {"error": f"Invalid base64 data: {e}"})
            return

        self._log_event(f"[UPLOAD] Incoming file '{filename}' ({round(len(file_bytes)/1024, 1)} KB) from {client_ip}")

        # If client specified a target directory on server
        if target_dir and isinstance(target_dir, str) and target_dir.strip():
            td = os.path.expandvars(target_dir.strip().strip('"\''))
            try:
                os.makedirs(td, exist_ok=True)
                dest = os.path.join(td, filename)
                with open(dest, "wb") as f:
                    f.write(file_bytes)
                self._log_event(f"[UPLOAD] Saved to target directory: '{dest}'")
                self._send_json(200, {"success": True, "saved_path": dest})
                return
            except Exception as e:
                self._log_event(f"[UPLOAD] Failed writing to target directory '{td}': {e}. Falling back to Downloads.")

        # If prompt_mode is explicitly requested and server GUI exists
        gui = ServerRequestHandler.server_gui_instance
        if prompt_mode and gui:
            saved_path = gui.prompt_save_file(filename, file_bytes)
            if saved_path:
                self._log_event(f"[UPLOAD] Saved via server prompt to '{saved_path}'")
                self._send_json(200, {"success": True, "saved_path": saved_path})
                return
            else:
                self._log_event(f"[UPLOAD] User cancelled destination selection on server")
                self._send_json(400, {"error": "File save cancelled by server user"})
                return

        # Fallback / default: save to Downloads folder
        try:
            downloads_dir = os.path.join(os.path.expanduser("~"), "Downloads")
            os.makedirs(downloads_dir, exist_ok=True)
            dest = os.path.join(downloads_dir, filename)
            with open(dest, "wb") as f:
                f.write(file_bytes)
            self._log_event(f"[UPLOAD] Saved to Downloads: '{dest}'")
            self._send_json(200, {"success": True, "saved_path": dest})
        except Exception as e:
            self._log_event(f"[UPLOAD ERROR] Failed saving file: {e}")
            self._send_json(500, {"error": f"Could not save file on server: {e}"})

    def handle_browse(self, target_path, client_ip):
        if not target_path or target_path.strip() in ("", "/", "\\"):
            drives = []
            if os.name == "nt":
                for letter in string.ascii_uppercase:
                    drive_path = f"{letter}:\\"
                    if os.path.exists(drive_path):
                        drives.append({
                            "name": f"Drive ({letter}:)",
                            "path": drive_path,
                            "type": "drive"
                        })
            else:
                drives.append({"name": "Root (/)", "path": "/", "type": "drive"})

            user_home = os.path.expanduser("~")
            shortcuts = [
                {"name": "Downloads", "path": os.path.join(user_home, "Downloads"), "type": "folder"},
                {"name": "Desktop", "path": os.path.join(user_home, "Desktop"), "type": "folder"},
                {"name": "Documents", "path": os.path.join(user_home, "Documents"), "type": "folder"},
            ]
            shortcuts = [s for s in shortcuts if os.path.exists(s["path"])]

            self._send_json(200, {
                "current_path": "",
                "parent_path": "",
                "drives": drives,
                "folders": shortcuts,
                "files": []
            })
            return

        clean_path = os.path.normpath(os.path.abspath(os.path.expandvars(target_path.strip())))
        if not os.path.exists(clean_path):
            self._send_json(404, {"error": f"Path does not exist: {clean_path}"})
            return

        if not os.path.isdir(clean_path):
            self._send_json(400, {"error": f"Path is not a directory: {clean_path}"})
            return

        drive, rest = os.path.splitdrive(clean_path)
        if rest in ("\\", "/", ""):
            parent_path = ""
        else:
            parent_path = os.path.dirname(clean_path)
            if parent_path == clean_path:
                parent_path = ""

        folders = []
        files = []
        try:
            with os.scandir(clean_path) as entries:
                for entry in entries:
                    try:
                        if entry.is_dir(follow_symlinks=False):
                            folders.append({
                                "name": entry.name,
                                "path": entry.path,
                                "type": "folder"
                            })
                        else:
                            size_kb = round(entry.stat().st_size / 1024, 1)
                            files.append({
                                "name": entry.name,
                                "path": entry.path,
                                "size_kb": size_kb,
                                "type": "file"
                            })
                    except (PermissionError, OSError):
                        continue
        except PermissionError:
            self._send_json(403, {"error": f"Permission denied accessing '{clean_path}'"})
            return
        except Exception as e:
            self._send_json(500, {"error": str(e)})
            return

        folders.sort(key=lambda x: x["name"].lower())
        files.sort(key=lambda x: x["name"].lower())
        self._send_json(200, {
            "current_path": clean_path,
            "parent_path": parent_path,
            "drives": [],
            "folders": folders,
            "files": files[:250]
        })

    def handle_mkdir(self, payload, client_ip):
        parent_dir = payload.get("path")
        folder_name = payload.get("folder_name")
        if not parent_dir or not folder_name:
            self._send_json(400, {"error": "Missing 'path' or 'folder_name'"})
            return

        folder_name = os.path.basename(folder_name.strip())
        if not folder_name:
            self._send_json(400, {"error": "Invalid folder name"})
            return

        target_dir = os.path.join(os.path.abspath(os.path.expandvars(parent_dir.strip())), folder_name)
        try:
            os.makedirs(target_dir, exist_ok=True)
            self._log_event(f"[MKDIR] Created folder '{target_dir}' by {client_ip}")
            self._send_json(200, {"success": True, "created_path": target_dir})
        except Exception as e:
            self._send_json(500, {"error": f"Could not create folder: {e}"})

    def handle_blank(self, payload, client_ip):
        enable = payload.get("enable", True)
        gui = ServerRequestHandler.server_gui_instance
        if gui:
            gui.set_blank_screen(enable)
        state_str = "ENABLED" if enable else "DISABLED"
        self._log_event(f"[BLANK] Screen blanking {state_str} by {client_ip}")
        self._send_json(200, {"success": True, "blanked": enable})

    def handle_video(self, payload, client_ip):
        action = payload.get("action", "play")
        video_path = payload.get("video_path")
        video_data_b64 = payload.get("data")
        gui = ServerRequestHandler.server_gui_instance

        if action == "stop":
            if gui:
                gui.stop_fullscreen_video()
            self._log_event(f"[VIDEO] Stopped by {client_ip}")
            self._send_json(200, {"success": True, "video_playing": False})
            return

        if not gui:
            self._send_json(500, {"error": "Server GUI instance not ready"})
            return

        # Handle playing video
        local_video_file = None
        if video_data_b64:
            try:
                raw_bytes = base64.b64decode(video_data_b64)
                v_filename = payload.get("filename", "remote_video.mp4")
                temp_dir = os.path.join(os.path.expanduser("~"), "AppData", "Local", "Temp", "RemoteTaskManager")
                os.makedirs(temp_dir, exist_ok=True)
                base, ext = os.path.splitext(v_filename)
                unique_name = f"{base}_{int(time.time()*1000)}{ext}"
                local_video_file = os.path.join(temp_dir, unique_name)
                with open(local_video_file, "wb") as f:
                    f.write(raw_bytes)
            except Exception as e:
                self._send_json(400, {"error": f"Failed to receive video data: {e}"})
                return
        elif video_path:
            local_video_file = os.path.expandvars(video_path)

        if not local_video_file or not os.path.exists(local_video_file):
            self._send_json(400, {"error": f"Video file not found: {local_video_file}"})
            return

        gui.play_fullscreen_video(local_video_file)
        self._log_event(f"[VIDEO] Started fullscreen video '{os.path.basename(local_video_file)}' by {client_ip}")
        self._send_json(200, {"success": True, "video_playing": True, "file": local_video_file})

    def handle_gesture(self, payload, client_ip):
        enable = payload.get("enable")
        sensitivity = payload.get("sensitivity")
        gui = ServerRequestHandler.server_gui_instance
        if gui:
            if enable is not None and hasattr(gui, "set_gesture_detection"):
                gui.set_gesture_detection(enable)
            if sensitivity is not None and hasattr(gui, "set_gesture_sensitivity"):
                gui.set_gesture_sensitivity(sensitivity)

        cur_enabled = gui.gesture_enabled_var.get() if gui and hasattr(gui, "gesture_enabled_var") else True
        cur_sens = gui.gesture_sensitivity_var.get() if gui and hasattr(gui, "gesture_sensitivity_var") else 70
        state_str = "ENABLED" if cur_enabled else "DISABLED"
        self._log_event(f"[GESTURE] Updated by {client_ip}: State={state_str}, Sensitivity={cur_sens}%")
        self._send_json(200, {
            "success": True,
            "gesture_enabled": cur_enabled,
            "gesture_sensitivity": cur_sens
        })

    def handle_power(self, payload, client_ip):
        action = payload.get("action", "").lower()
        if action == "sleep":
            self._log_event(f"[POWER] Sleep requested by {client_ip}")
            self._send_json(200, {"success": True, "action": "sleep", "message": "Going to sleep..."})
            # Give response time to flush, then sleep
            def _do_sleep():
                time.sleep(0.5)
                try:
                    if os.name == "nt":
                        import subprocess
                        subprocess.Popen(
                            ["rundll32.exe", "powrprof.dll,SetSuspendState", "0,1,0"],
                            creationflags=0x08000000  # CREATE_NO_WINDOW
                        )
                    else:
                        import subprocess
                        subprocess.Popen(["systemctl", "suspend"])
                except Exception as e:
                    self._log_event(f"[POWER ERROR] Sleep failed: {e}")
            threading.Thread(target=_do_sleep, daemon=True).start()
        else:
            self._send_json(400, {"error": f"Unknown power action: '{action}'. Supported: 'sleep'"})

    def handle_cam_frame(self):

        gui = ServerRequestHandler.server_gui_instance
        if gui and gui.gesture_service:
            jpg_bytes, ts = gui.gesture_service.get_latest_jpeg()
            if jpg_bytes:
                self.send_response(200)
                self.send_header("Content-Type", "image/jpeg")
                self.send_header("Content-Length", str(len(jpg_bytes)))
                self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(jpg_bytes)
                return
        self._send_json(503, {"error": "Camera frame not available or camera disconnected"})

    def handle_cam_stream(self):
        gui = ServerRequestHandler.server_gui_instance
        if not gui or not gui.gesture_service:
            self._send_json(503, {"error": "Camera service not available"})
            return

        self.send_response(200)
        self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self._send_cors_headers()
        self.end_headers()

        last_ts = 0.0
        try:
            while gui.is_running and gui.gesture_service and gui.gesture_service.is_running:
                jpg_bytes, ts = gui.gesture_service.get_latest_jpeg()
                if jpg_bytes and ts > last_ts:
                    last_ts = ts
                    header = (
                        b"--frame\r\n"
                        b"Content-Type: image/jpeg\r\n"
                        b"Content-Length: " + str(len(jpg_bytes)).encode("ascii") + b"\r\n\r\n"
                    )
                    self.wfile.write(header + jpg_bytes + b"\r\n")
                    self.wfile.flush()
                time.sleep(0.03)
        except (BrokenPipeError, ConnectionResetError, socket.error):
            pass

    def handle_cam_status(self):
        gui = ServerRequestHandler.server_gui_instance
        if gui and gui.gesture_service:
            self._send_json(200, gui.gesture_service.get_status())
        else:
            self._send_json(200, {"active": False, "width": 0, "height": 0, "fps": 0.0, "gesture_enabled": False})

    def log_message(self, format, *args):
        pass


class ServerSavePromptDialog(tk.Toplevel):
    def __init__(self, filename, file_bytes, on_complete):
        super().__init__()
        self.filename = filename
        self.file_bytes = file_bytes
        self.on_complete = on_complete
        self.saved_path = None

        self.title("Incoming Remote File Transfer")
        self.geometry("560x220")
        self.resizable(False, False)
        self.configure(bg=BG_PANEL)

        self.attributes("-topmost", True)
        self.lift()
        self.focus_force()

        default_dir = os.path.join(os.path.expanduser("~"), "Downloads")
        os.makedirs(default_dir, exist_ok=True)
        default_path = os.path.join(default_dir, filename)
        self.path_var = tk.StringVar(value=default_path)

        self._build_ui()
        self.protocol("WM_DELETE_WINDOW", self._on_cancel)

        # Safety auto-save timer (50s) so connection never drops
        self.timer_id = self.after(50000, self._auto_save)

    def _build_ui(self):
        banner = tk.Frame(self, bg=BG_PANEL, padx=16, pady=12)
        banner.pack(fill=tk.X)

        tk.Label(
            banner,
            text=f"📥 Incoming File from Remote Client: {self.filename}",
            font=("Segoe UI", 11, "bold"),
            fg=TEXT_HEAD,
            bg=BG_PANEL
        ).pack(anchor="w")

        size_kb = round(len(self.file_bytes) / 1024, 1)
        tk.Label(
            banner,
            text=f"Size: {size_kb} KB  •  Choose where to place this file on the server:",
            font=("Segoe UI", 9),
            fg=TEXT_MUTED,
            bg=BG_PANEL
        ).pack(anchor="w", pady=(2, 0))

        row = tk.Frame(self, bg=BG_PANEL, padx=16, pady=8)
        row.pack(fill=tk.X)

        entry = tk.Entry(
            row,
            textvariable=self.path_var,
            font=("Segoe UI", 9),
            bg=BG_INPUT,
            fg=TEXT_HEAD,
            insertbackground=TEXT_HEAD,
            relief="flat"
        )
        entry.pack(side=tk.LEFT, fill=tk.X, expand=True, ipady=4, padx=(0, 8))

        btn_browse = tk.Button(
            row,
            text="Browse...",
            font=("Segoe UI", 9),
            bg=BG_INPUT,
            fg=TEXT_HEAD,
            relief="flat",
            padx=10,
            pady=3,
            cursor="hand2",
            command=self._browse_destination
        )
        btn_browse.pack(side=tk.RIGHT)

        actions = tk.Frame(self, bg=BG_PANEL, padx=16, pady=12)
        actions.pack(fill=tk.X, side=tk.BOTTOM)

        btn_cancel = tk.Button(
            actions,
            text="Cancel",
            font=("Segoe UI", 9),
            bg=BG_INPUT,
            fg=TEXT_MUTED,
            relief="flat",
            padx=14,
            pady=4,
            cursor="hand2",
            command=self._on_cancel
        )
        btn_cancel.pack(side=tk.RIGHT, padx=(8, 0))

        btn_save = tk.Button(
            actions,
            text="✔ Save File Here",
            font=("Segoe UI", 9, "bold"),
            bg=ACCENT_GREEN,
            fg="#ffffff",
            activebackground="#059669",
            activeforeground="#ffffff",
            relief="flat",
            padx=16,
            pady=4,
            cursor="hand2",
            command=self._on_save
        )
        btn_save.pack(side=tk.RIGHT)

    def _browse_destination(self):
        cur = self.path_var.get().strip()
        init_dir = os.path.dirname(cur) if cur else os.path.expanduser("~")
        new_path = filedialog.asksaveasfilename(
            title="Choose destination to save incoming file",
            initialfile=self.filename,
            initialdir=init_dir,
            parent=self
        )
        if new_path:
            self.path_var.set(new_path)

    def _on_save(self):
        target = self.path_var.get().strip()
        if not target:
            return

        try:
            os.makedirs(os.path.dirname(os.path.abspath(target)), exist_ok=True)
            with open(target, "wb") as f:
                f.write(self.file_bytes)
            self.saved_path = target
        except Exception as e:
            messagebox.showerror("Save Error", f"Failed to save file:\n{e}", parent=self)
            return

        self._finish()

    def _auto_save(self):
        target = self.path_var.get().strip()
        try:
            os.makedirs(os.path.dirname(os.path.abspath(target)), exist_ok=True)
            with open(target, "wb") as f:
                f.write(self.file_bytes)
            self.saved_path = target
        except Exception:
            pass
        self._finish()

    def _on_cancel(self):
        self.saved_path = None
        self._finish()

    def _finish(self):
        if self.timer_id:
            try:
                self.after_cancel(self.timer_id)
            except Exception:
                pass
        res = self.saved_path
        self.destroy()
        if self.on_complete:
            self.on_complete(res)




class HostServerGUI(tk.Tk):
    def __init__(self, autohide=True, port=DEFAULT_PORT):
        super().__init__()

        self.title("Remote Task Manager - Host Server")
        self.geometry("980x620")
        self.minsize(820, 520)
        self.configure(bg=BG_MAIN)

        self.server_thread = None
        self.httpd = None
        self.is_running = False
        self.tray_icon = None

        # Screen overlay states
        self.blank_window = None
        self.is_blanked = False
        self.video_window = None
        self.is_video_playing = False
        self.video_process = None
        self.sad_face_window = None

        # Live Camera Preview states
        self.show_cam_preview = True
        self.preview_canvas = None
        self.preview_image_id = None
        self.current_preview_photo = None
        self.last_preview_render_time = 0.0
        self.lbl_cam_badge = None
        self.btn_toggle_preview = None

        # Gesture Detection service
        self.gesture_service = None
        self.server_cfg = load_server_config()
        self.gesture_enabled_var = tk.BooleanVar(value=self.server_cfg.get("gesture_enabled", True))
        self.gesture_sensitivity_var = tk.IntVar(value=self.server_cfg.get("gesture_sensitivity", 70))
        self.lbl_sens_val = None

        self.current_port = port
        self.port_var = tk.StringVar(value=str(port))
        self.autostart_var = tk.BooleanVar(value=self.check_windows_startup())

        ServerRequestHandler.logger_callback = self.log_activity
        ServerRequestHandler.server_gui_instance = self

        self._build_ui()
        self._setup_tray()

        # Intercept close window to minimize to tray
        self.protocol("WM_DELETE_WINDOW", self.minimize_to_tray)

        # Auto-start server immediately on launch
        self.start_server()

        # Start Camera Gesture Detector (Middle Finger -> Sad Face 2s)
        self._init_gesture_detector()

        # AUTO HIDE TO TRAY IMMEDIATELY ON STARTUP
        if autohide:
            self.withdraw()
            if self.tray_icon:
                try:
                    self.tray_icon.notify(
                        f"Server auto-hidden in taskbar tray.\nListening on port {port}.",
                        "Remote Task Manager Host"
                    )
                except Exception:
                    pass

    def check_windows_startup(self):
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, REG_KEY_RUN, 0, winreg.KEY_READ) as key:
                winreg.QueryValueEx(key, APP_NAME_STARTUP)
                return True
        except Exception:
            return False

    def toggle_windows_startup(self):
        enable = self.autostart_var.get()
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, REG_KEY_RUN, 0, winreg.KEY_SET_VALUE) as key:
                if enable:
                    exe_path = os.path.abspath(sys.argv[0])
                    winreg.SetValueEx(key, APP_NAME_STARTUP, 0, winreg.REG_SZ, f'"{exe_path}"')
                    self.log_activity("[STARTUP] Registered to auto-start with Windows.")
                else:
                    try:
                        winreg.DeleteValue(key, APP_NAME_STARTUP)
                        self.log_activity("[STARTUP] Removed from Windows startup.")
                    except FileNotFoundError:
                        pass
        except Exception as e:
            self.log_activity(f"[STARTUP ERROR] {e}")
            messagebox.showerror("Startup Config Error", f"Failed to modify startup registry: {e}")

    def prompt_save_file(self, filename, file_bytes):
        result_container = {"path": None}
        event = threading.Event()

        def _on_done(path):
            result_container["path"] = path
            event.set()

        def _ask():
            try:
                ServerSavePromptDialog(filename, file_bytes, _on_done)
            except Exception as e:
                self.log_activity(f"[PROMPT ERROR] {e}")
                try:
                    dest = os.path.join(os.path.expanduser("~"), "Downloads", filename)
                    with open(dest, "wb") as f:
                        f.write(file_bytes)
                    result_container["path"] = dest
                except Exception:
                    pass
                event.set()

        self.after(0, _ask)
        event.wait(timeout=55)
        return result_container["path"]

    def set_blank_screen(self, enable):
        self.after(0, lambda: self._apply_blank_screen(enable))

    def _apply_blank_screen(self, enable):
        if enable:
            if not self.blank_window or not tk.Toplevel.winfo_exists(self.blank_window):
                self.blank_window = tk.Toplevel(self)
                self.blank_window.title("Black Screen")
                self.blank_window.configure(bg="#000000")
                self.blank_window.attributes("-fullscreen", True)
                self.blank_window.attributes("-topmost", True)
                self.blank_window.config(cursor="none")

                # Solid black canvas, no exit text shown
                canvas = tk.Canvas(self.blank_window, bg="#000000", highlightthickness=0)
                canvas.pack(fill=tk.BOTH, expand=True)

                # Explicitly disable Escape, double-click, and mouse clicks
                self.blank_window.bind("<Escape>", lambda e: "break")
                self.blank_window.bind("<Button-1>", lambda e: "break")
                self.blank_window.bind("<Double-1>", lambda e: "break")
                self.blank_window.bind("<Button-3>", lambda e: "break")

                # Only 'Z' or 'z' can dismiss locally
                def _handle_key(event):
                    if event.char in ("z", "Z"):
                        self.set_blank_screen(False)

                self.blank_window.bind("<Key>", _handle_key)
                self.blank_window.focus_force()

            self.is_blanked = True
        else:
            if self.blank_window and tk.Toplevel.winfo_exists(self.blank_window):
                self.blank_window.destroy()
                self.blank_window = None
            self.is_blanked = False

    def play_fullscreen_video(self, video_file):
        self.after(0, lambda: self._apply_play_video(video_file))

    def _apply_play_video(self, video_file):
        self.stop_fullscreen_video()

        abs_video_path = os.path.abspath(video_file)
        if not os.path.exists(abs_video_path):
            self.log_activity(f"[VIDEO ERROR] File not found: {abs_video_path}")
            self.is_video_playing = False
            return

        self.is_video_playing = True

        def _on_finish(reason):
            self.is_video_playing = False
            self.video_window = None
            self.log_activity(f"[CUSTOM VIDEO] Playback ended ({reason}).")

        self.video_window = FullscreenTkVideoPlayer(
            self,
            abs_video_path,
            on_finish=_on_finish,
            log_fn=self.log_activity
        )

    def stop_fullscreen_video(self):
        self.after(0, self._apply_stop_video)

    def _apply_stop_video(self):
        self.is_video_playing = False
        if hasattr(self, "video_window") and self.video_window:
            try:
                self.video_window.stop("stopped by client")
            except Exception:
                pass
            self.video_window = None

    def _init_gesture_detector(self):
        try:
            try:
                from server.gesture_detector import CameraGestureService
            except ImportError:
                from gesture_detector import CameraGestureService
            self.gesture_service = CameraGestureService(
                on_middle_finger=self.trigger_sad_face_reaction,
                on_frame=self._on_camera_frame,
                log_callback=self.log_activity,
                sensitivity=self.gesture_sensitivity_var.get()
            )
            self.gesture_service.start()
        except Exception as e:
            self.log_activity(f"[GESTURE] Gesture detector not loaded: {e}")

    def _on_camera_frame(self, frame_bgr):
        if self.state() == "withdrawn" or not self.show_cam_preview:
            return
        now = time.time()
        if now - self.last_preview_render_time < 0.04:  # throttle to ~25 FPS
            return
        self.last_preview_render_time = now

        try:
            h, w = frame_bgr.shape[:2]
            target_w = 320
            target_h = int(h * (target_w / w)) if w > 0 else 240
            if cv2:
                resized = cv2.resize(frame_bgr, (target_w, target_h))
                rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
            else:
                rgb = frame_bgr
            img = Image.fromarray(rgb)
            photo = ImageTk.PhotoImage(image=img)
            self.after(0, lambda p=photo, orig_w=w, orig_h=h: self._draw_camera_preview(p, orig_w, orig_h))
        except Exception:
            pass

    def _draw_camera_preview(self, photo, orig_w, orig_h):
        if not self.show_cam_preview:
            return
        self.preview_photo = photo
        if hasattr(self, "preview_canvas") and self.preview_canvas and self.preview_canvas.winfo_exists():
            cw = self.preview_canvas.winfo_width() or 320
            ch = self.preview_canvas.winfo_height() or 240
            x = (cw - photo.width()) // 2
            y = (ch - photo.height()) // 2
            if self.preview_image_id is None:
                self.preview_image_id = self.preview_canvas.create_image(x, y, image=photo, anchor="nw")
            else:
                self.preview_canvas.coords(self.preview_image_id, x, y)
                self.preview_canvas.itemconfig(self.preview_image_id, image=photo)

        if hasattr(self, "lbl_cam_badge") and self.lbl_cam_badge and self.gesture_service:
            fps = self.gesture_service.measured_fps
            g_state = "ON" if self.gesture_enabled_var.get() else "OFF"
            sens = self.gesture_sensitivity_var.get()
            self.lbl_cam_badge.configure(text=f"● LIVE  {orig_w}x{orig_h}  {fps:.0f} FPS  [Sens: {sens}%]")

    def toggle_preview_display(self):
        self.show_cam_preview = not self.show_cam_preview
        if self.show_cam_preview:
            if hasattr(self, "btn_toggle_preview") and self.btn_toggle_preview:
                self.btn_toggle_preview.configure(text="Pause Preview UI")
            if hasattr(self, "lbl_cam_badge") and self.lbl_cam_badge:
                self.lbl_cam_badge.configure(text="● LIVE", fg=ACCENT_GREEN)
        else:
            if hasattr(self, "btn_toggle_preview") and self.btn_toggle_preview:
                self.btn_toggle_preview.configure(text="Resume Preview UI")
            if hasattr(self, "lbl_cam_badge") and self.lbl_cam_badge:
                self.lbl_cam_badge.configure(text="⏸ PAUSED", fg=TEXT_MUTED)
            if self.preview_canvas:
                self.preview_canvas.delete("all")
                self.preview_image_id = None
                self.preview_canvas.create_text(
                    160, 120,
                    text="Preview Paused\n(Live streaming active)",
                    fill=TEXT_MUTED,
                    font=("Segoe UI", 10),
                    justify=tk.CENTER
                )

    def set_gesture_detection(self, enable):
        self.gesture_enabled_var.set(enable)
        if self.gesture_service:
            self.gesture_service.gesture_enabled = enable
            if not self.gesture_service.is_running and enable:
                self.gesture_service.start()
        save_server_config({"gesture_enabled": enable})

    def set_gesture_sensitivity(self, val):
        try:
            ival = max(1, min(100, int(val)))
            self.gesture_sensitivity_var.set(ival)
            if self.gesture_service:
                self.gesture_service.set_sensitivity(ival)
            if hasattr(self, "lbl_sens_val") and self.lbl_sens_val:
                self.lbl_sens_val.configure(text=f"{ival}%")
            save_server_config({"gesture_sensitivity": ival})
        except Exception:
            pass

    def trigger_sad_face_reaction(self):
        if not self.gesture_enabled_var.get():
            return
        self.after(0, lambda: self.show_sad_face(duration=2.0))

    def show_sad_face(self, duration=2.0):
        if self.sad_face_window and tk.Toplevel.winfo_exists(self.sad_face_window):
            return
        self.sad_face_window = SadFaceOverlay(self, duration=duration)
        self.log_activity("[REACTION] Sad face displayed on screen for 2s.")

    def _get_local_ips(self):
        ips = []
        try:
            hostname = socket.gethostname()
            for ip in socket.gethostbyname_ex(hostname)[2]:
                if not ip.startswith("127."):
                    ips.append(ip)
        except Exception:
            pass
        return ips or ["127.0.0.1"]

    def _create_tray_image(self, color=ACCENT_GREEN):
        if not pystray:
            return None
        img = Image.new("RGBA", (64, 64), color=(0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        d.rounded_rectangle([2, 2, 62, 62], radius=14, fill=BG_MAIN)
        d.rounded_rectangle([6, 6, 58, 58], radius=10, fill=color)
        d.rounded_rectangle([14, 14, 50, 24], radius=3, fill="#ffffff")
        d.rounded_rectangle([14, 28, 50, 38], radius=3, fill="#ffffff")
        d.rounded_rectangle([14, 42, 50, 52], radius=3, fill="#ffffff")
        d.ellipse([43, 17, 47, 21], fill=color)
        d.ellipse([43, 31, 47, 35], fill=color)
        d.ellipse([43, 45, 47, 49], fill=color)
        return img

    def _setup_tray(self):
        if not pystray:
            return

        image = self._create_tray_image(ACCENT_GREEN)
        menu = pystray.Menu(
            pystray.MenuItem("Open Host Control Panel", self.restore_from_tray, default=True),
            pystray.MenuItem(lambda item: f"Status: {'Active' if self.is_running else 'Stopped'}", None, enabled=False),
            pystray.MenuItem(lambda item: f"Port: {self.current_port}", None, enabled=False),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Exit Server", self.quit_application)
        )
        self.tray_icon = pystray.Icon(
            "RemoteTaskManagerServer",
            image,
            "Remote Task Manager - Host Server (Click to open)",
            menu=menu
        )
        
        tray_thread = threading.Thread(target=self.tray_icon.run, daemon=True)
        tray_thread.start()

    def minimize_to_tray(self):
        self.withdraw()
        self.log_activity("[TRAY] Hidden to system tray (^ up arrow). Click tray icon to reopen.")

    def restore_from_tray(self, icon=None, item=None):
        self.after(0, self._restore_ui)

    def _restore_ui(self):
        self.deiconify()
        self.lift()
        self.focus_force()

    def quit_application(self, icon=None, item=None):
        self.stop_server()
        if self.tray_icon:
            self.tray_icon.stop()
        self.after(0, self.destroy)
        os._exit(0)

    def _build_ui(self):
        banner = tk.Frame(self, bg=BG_PANEL, pady=12, padx=16)
        banner.pack(fill=tk.X)

        header_top = tk.Frame(banner, bg=BG_PANEL)
        header_top.pack(fill=tk.X)

        title_lbl = tk.Label(
            header_top,
            text="Remote Task Manager - Host Server",
            font=("Segoe UI", 14, "bold"),
            fg=TEXT_HEAD,
            bg=BG_PANEL
        )
        title_lbl.pack(side=tk.LEFT)

        btn_tray = tk.Button(
            header_top,
            text="Hide to Tray",
            font=("Segoe UI", 8),
            bg=BG_INPUT,
            fg=TEXT_HEAD,
            activebackground=BORDER_COL,
            activeforeground=TEXT_HEAD,
            relief="flat",
            padx=10,
            pady=2,
            cursor="hand2",
            command=self.minimize_to_tray
        )
        btn_tray.pack(side=tk.RIGHT, padx=(4, 0))

        btn_quit = tk.Button(
            header_top,
            text="Quit Server",
            font=("Segoe UI", 8),
            bg="#991b1b",
            fg="#ffffff",
            activebackground="#b91c1c",
            activeforeground="#ffffff",
            relief="flat",
            padx=8,
            pady=2,
            cursor="hand2",
            command=self.quit_application
        )
        btn_quit.pack(side=tk.RIGHT)

        local_ips_str = ", ".join(self._get_local_ips())
        self.lbl_ips = tk.Label(
            banner,
            text=f"Server Hostname: {platform.node()}  |  Local IPs: {local_ips_str}",
            font=("Segoe UI", 9),
            fg=TEXT_MUTED,
            bg=BG_PANEL
        )
        self.lbl_ips.pack(anchor="w", pady=(4, 0))

        # Control Bar
        cfg_frame = tk.Frame(self, bg=BG_MAIN, padx=16, pady=10)
        cfg_frame.pack(fill=tk.X)

        tk.Label(cfg_frame, text="Port:", font=("Segoe UI", 9, "bold"), fg=TEXT_HEAD, bg=BG_MAIN).pack(side=tk.LEFT, padx=(0, 4))
        self.entry_port = tk.Entry(
            cfg_frame,
            textvariable=self.port_var,
            width=7,
            font=("Segoe UI", 9),
            bg=BG_INPUT,
            fg=TEXT_HEAD,
            relief="flat"
        )
        self.entry_port.pack(side=tk.LEFT, padx=(0, 14), ipady=3)

        chk_autostart = tk.Checkbutton(
            cfg_frame,
            text="Start with Windows",
            variable=self.autostart_var,
            command=self.toggle_windows_startup,
            font=("Segoe UI", 9),
            fg=TEXT_HEAD,
            bg=BG_MAIN,
            activebackground=BG_MAIN,
            activeforeground=TEXT_HEAD,
            selectcolor=BG_PANEL
        )
        chk_autostart.pack(side=tk.LEFT, padx=(0, 10))

        chk_gesture = tk.Checkbutton(
            cfg_frame,
            text="Middle Finger -> Sad Face",
            variable=self.gesture_enabled_var,
            command=lambda: self.set_gesture_detection(self.gesture_enabled_var.get()),
            font=("Segoe UI", 9),
            fg=TEXT_HEAD,
            bg=BG_MAIN,
            activebackground=BG_MAIN,
            activeforeground=TEXT_HEAD,
            selectcolor=BG_PANEL
        )
        chk_gesture.pack(side=tk.LEFT, padx=(0, 6))

        tk.Label(cfg_frame, text="Sensitivity:", font=("Segoe UI", 9), fg=TEXT_MUTED, bg=BG_MAIN).pack(side=tk.LEFT, padx=(2, 2))
        scale_sens = ttk.Scale(
            cfg_frame,
            from_=1, to=100,
            orient="horizontal",
            length=75,
            variable=self.gesture_sensitivity_var,
            command=lambda v: self.set_gesture_sensitivity(int(float(v)))
        )
        scale_sens.pack(side=tk.LEFT, padx=(0, 4))
        self.lbl_sens_val = tk.Label(
            cfg_frame,
            text=f"{self.gesture_sensitivity_var.get()}%",
            font=("Segoe UI", 8, "bold"),
            fg=ACCENT_BLUE,
            bg=BG_MAIN,
            width=4
        )
        self.lbl_sens_val.pack(side=tk.LEFT, padx=(0, 10))

        tk.Label(cfg_frame, text="• Open LAN (Zero Token)", font=("Segoe UI", 9), fg=ACCENT_GREEN, bg=BG_MAIN).pack(side=tk.LEFT)

        self.btn_toggle = tk.Button(
            cfg_frame,
            text="Start Server",
            font=("Segoe UI", 9, "bold"),
            bg=ACCENT_GREEN,
            fg="#ffffff",
            activebackground="#059669",
            activeforeground="#ffffff",
            relief="flat",
            padx=14,
            pady=4,
            cursor="hand2",
            command=self.toggle_server
        )
        self.btn_toggle.pack(side=tk.RIGHT)

        status_box = tk.Frame(self, bg=BG_PANEL, padx=16, pady=8)
        status_box.pack(fill=tk.X, padx=16, pady=(0, 8))

        self.lbl_indicator = tk.Label(status_box, text="●", font=("Segoe UI", 12), fg=ACCENT_RED, bg=BG_PANEL)
        self.lbl_indicator.pack(side=tk.LEFT, padx=(0, 6))

        self.lbl_status = tk.Label(status_box, text="Server is STOPPED", font=("Segoe UI", 10, "bold"), fg=TEXT_MUTED, bg=BG_PANEL)
        self.lbl_status.pack(side=tk.LEFT)

        lbl_tray_hint = tk.Label(
            status_box,
            text="ℹ Auto-runs in System Tray (^ in taskbar). Press 'Z' to dismiss black screen.",
            font=("Segoe UI", 8),
            fg=TEXT_MUTED,
            bg=BG_PANEL
        )
        lbl_tray_hint.pack(side=tk.RIGHT)

        # Main Content Container: Left = Activity Log, Right = Live Camera Preview Card
        body_container = tk.Frame(self, bg=BG_MAIN, padx=16, pady=4)
        body_container.pack(fill=tk.BOTH, expand=True)

        # Left: Activity Log
        log_frame = tk.Frame(body_container, bg=BG_MAIN)
        log_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 10))

        tk.Label(log_frame, text="Activity & Access Log:", font=("Segoe UI", 9, "bold"), fg=TEXT_HEAD, bg=BG_MAIN).pack(anchor="w", pady=(0, 4))

        self.log_text = tk.Text(
            log_frame,
            bg=BG_PANEL,
            fg=TEXT_HEAD,
            font=("Consolas", 9),
            relief="flat",
            wrap="word",
            padx=8,
            pady=8
        )
        scrollbar = ttk.Scrollbar(log_frame, orient="vertical", command=self.log_text.yview)
        self.log_text.configure(yscrollcommand=scrollbar.set)

        self.log_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        # Right: Camera Live Preview Card
        cam_card = tk.Frame(body_container, bg=BG_PANEL, highlightbackground=BORDER_COL, highlightthickness=1, width=340)
        cam_card.pack(side=tk.RIGHT, fill=tk.Y)
        cam_card.pack_propagate(False)

        cam_header = tk.Frame(cam_card, bg=BG_PANEL, padx=10, pady=6)
        cam_header.pack(fill=tk.X)

        tk.Label(
            cam_header,
            text="📹 Camera Live Preview",
            font=("Segoe UI", 10, "bold"),
            fg=TEXT_HEAD,
            bg=BG_PANEL
        ).pack(side=tk.LEFT)

        self.lbl_cam_badge = tk.Label(
            cam_header,
            text="● INITIALIZING",
            font=("Segoe UI", 8, "bold"),
            fg=ACCENT_GREEN,
            bg=BG_PANEL
        )
        self.lbl_cam_badge.pack(side=tk.RIGHT)

        # Preview Canvas (320x240)
        self.preview_canvas = tk.Canvas(cam_card, bg="#0b0f19", width=320, height=240, highlightthickness=0)
        self.preview_canvas.pack(padx=10, pady=4)
        self.preview_canvas.create_text(
            160, 120,
            text="Waiting for camera feed...",
            fill=TEXT_MUTED,
            font=("Segoe UI", 9)
        )

        cam_ctrl = tk.Frame(cam_card, bg=BG_PANEL, padx=10, pady=4)
        cam_ctrl.pack(fill=tk.X)

        self.btn_toggle_preview = tk.Button(
            cam_ctrl,
            text="Pause Preview UI",
            font=("Segoe UI", 8),
            bg=BG_INPUT,
            fg=TEXT_HEAD,
            relief="flat",
            padx=8,
            pady=2,
            cursor="hand2",
            command=self.toggle_preview_display
        )
        self.btn_toggle_preview.pack(side=tk.LEFT)

        tk.Label(
            cam_ctrl,
            text="Stream: ACTIVE",
            font=("Segoe UI", 8, "bold"),
            fg=ACCENT_GREEN,
            bg=BG_PANEL
        ).pack(side=tk.RIGHT)

        cam_note = tk.Label(
            cam_card,
            text="Camera feed is shared with MediaPipe gesture detector & remote client stream.",
            font=("Segoe UI", 8),
            fg=TEXT_MUTED,
            bg=BG_PANEL,
            wraplength=310,
            justify=tk.LEFT
        )
        cam_note.pack(padx=10, pady=(2, 6), anchor="w")

        footer = tk.Frame(self, bg=BG_MAIN, padx=16, pady=6)
        footer.pack(fill=tk.X)

        btn_clear = tk.Button(
            footer,
            text="Clear Log",
            font=("Segoe UI", 8),
            bg=BG_INPUT,
            fg=TEXT_MUTED,
            relief="flat",
            padx=8,
            pady=2,
            cursor="hand2",
            command=lambda: self.log_text.delete("1.0", tk.END)
        )
        btn_clear.pack(side=tk.RIGHT)

    def log_activity(self, message):
        timestamp = time.strftime("%H:%M:%S")
        entry = f"[{timestamp}] {message}\n"
        self.after(0, lambda: self._append_log(entry))
        try:
            log_dir = os.path.join(tempfile.gettempdir(), "RemoteTaskManager")
            os.makedirs(log_dir, exist_ok=True)
            log_path = os.path.join(log_dir, "server_activity.log")
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(entry)
        except Exception:
            pass

    def _append_log(self, entry):
        self.log_text.insert(tk.END, entry)
        self.log_text.see(tk.END)

    def toggle_server(self):
        if not self.is_running:
            self.start_server()
        else:
            self.stop_server()

    def start_server(self):
        try:
            port = int(self.port_var.get().strip())
        except ValueError:
            messagebox.showerror("Invalid Port", "Port must be a valid integer.")
            return

        try:
            self.httpd = ThreadingHTTPServer(("0.0.0.0", port), ServerRequestHandler)
        except Exception as e:
            messagebox.showerror("Error", f"Failed to bind port {port}: {e}")
            return

        self.current_port = port
        self.is_running = True
        self.server_thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.server_thread.start()

        self.btn_toggle.configure(text="Stop Server", bg=ACCENT_RED, activebackground="#dc2626")
        self.lbl_indicator.configure(fg=ACCENT_GREEN)
        self.lbl_status.configure(text=f"LISTENING on 0.0.0.0:{port} (Active)", fg=ACCENT_GREEN)
        self.entry_port.configure(state="disabled")

        if self.tray_icon:
            self.tray_icon.icon = self._create_tray_image(ACCENT_GREEN)

        self.log_activity(f"[STARTED] Server listening on port {port}. Ready for client connections.")

    def stop_server(self):
        if self.httpd:
            self.httpd.shutdown()
            self.httpd.server_close()

        self.is_running = False
        self.btn_toggle.configure(text="Start Server", bg=ACCENT_GREEN, activebackground="#059669")
        self.lbl_indicator.configure(fg=ACCENT_RED)
        self.lbl_status.configure(text="Server is STOPPED", fg=TEXT_MUTED)
        self.entry_port.configure(state="normal")

        if self.tray_icon:
            self.tray_icon.icon = self._create_tray_image(ACCENT_RED)

        self.log_activity("[STOPPED] Server stopped.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Remote Task Manager Host Server")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--headless", action="store_true", help="Run without GUI")
    parser.add_argument("--show", action="store_true", help="Do not auto-hide to tray on startup")
    parser.add_argument("--test-video", type=str, default="", help="Test playing a video file directly")
    args = parser.parse_args()

    if args.test_video:
        print(f"Testing video playback for: {args.test_video}")
        app = HostServerGUI(autohide=False, port=args.port)
        app.after(500, lambda: app.play_fullscreen_video(args.test_video))
        app.mainloop()
        sys.exit(0)

    if args.headless:
        ServerRequestHandler.logger_callback = lambda m: print(f"[{time.strftime('%X')}] {m}")
        gesture_service = None
        cfg = load_server_config()
        try:
            try:
                from server.gesture_detector import CameraGestureService
            except ImportError:
                from gesture_detector import CameraGestureService
            gesture_service = CameraGestureService(log_callback=print, sensitivity=cfg.get("gesture_sensitivity", 70))
            gesture_service.start()
            class MockGUI:
                pass
            mock_gui = MockGUI()
            mock_gui.gesture_service = gesture_service
            mock_gui.is_running = True
            mock_gui.is_blanked = False
            mock_gui.is_video_playing = False
            mock_gui.gesture_enabled_var = type("Var", (), {"get": lambda s: cfg.get("gesture_enabled", True)})()
            mock_gui.gesture_sensitivity_var = type("Var", (), {"get": lambda s: cfg.get("gesture_sensitivity", 70), "set": lambda s, v: None})()
            mock_gui.set_gesture_sensitivity = lambda val: gesture_service.set_sensitivity(val)
            mock_gui.set_gesture_detection = lambda val: setattr(gesture_service, "gesture_enabled", val)
            ServerRequestHandler.server_gui_instance = mock_gui
        except Exception as e:
            print("Gesture service headless init warning:", e)

        httpd = ThreadingHTTPServer(("0.0.0.0", args.port), ServerRequestHandler)
        print(f"Host Server running headlessly on port {args.port}...")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("Stopping server...")
            if gesture_service:
                gesture_service.stop()
            httpd.server_close()
    else:
        app = HostServerGUI(autohide=not args.show, port=args.port)
        app.mainloop()
