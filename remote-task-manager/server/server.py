"""
Remote Task Manager - Server Agent
Runs on the target PC (e.g. 192.168.50.148) to expose system metrics and task management.
Requires: pip install psutil
"""

import sys
import os
import time
import json
import argparse
import platform
import subprocess
from http.server import HTTPServer, ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

try:
    import psutil
except ImportError:
    print("[ERROR] 'psutil' is required. Please run: pip install psutil")
    sys.exit(1)

# Default configuration
DEFAULT_PORT = 8888
DEFAULT_TOKEN = "remoteadmin123"

class RemoteTaskManagerHandler(BaseHTTPRequestHandler):
    auth_token = DEFAULT_TOKEN

    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Auth-Token")

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

    def _is_authenticated(self):
        return True

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if not self._is_authenticated():
            self._send_json(401, {"error": "Unauthorized. Invalid or missing X-Auth-Token."})
            return

        if path == "/" or path == "/api/status":
            self.handle_status()
        elif path == "/api/metrics":
            self.handle_metrics()
        elif path == "/api/processes":
            self.handle_processes()
        else:
            self._send_json(404, {"error": f"Endpoint not found: {path}"})

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if not self._is_authenticated():
            self._send_json(401, {"error": "Unauthorized. Invalid or missing X-Auth-Token."})
            return

        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length) if content_length > 0 else b"{}"
        try:
            payload = json.loads(post_data.decode("utf-8")) if post_data else {}
        except Exception:
            self._send_json(400, {"error": "Invalid JSON payload"})
            return

        if path == "/api/kill":
            self.handle_kill(payload)
        elif path == "/api/run":
            self.handle_run(payload)
        else:
            self._send_json(404, {"error": f"Endpoint not found: {path}"})

    def handle_status(self):
        boot_time = psutil.boot_time()
        uptime = int(time.time() - boot_time)
        data = {
            "status": "online",
            "hostname": platform.node(),
            "os": f"{platform.system()} {platform.release()}",
            "arch": platform.machine(),
            "boot_time": boot_time,
            "uptime_seconds": uptime,
            "cpu_count": psutil.cpu_count(logical=True),
            "cpu_physical": psutil.cpu_count(logical=False),
        }
        self._send_json(200, data)

    def handle_metrics(self):
        vm = psutil.virtual_memory()
        cpu_pct = psutil.cpu_percent(interval=None)
        
        # Disk usage for root drive
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

        # Sort descending by memory usage by default
        procs.sort(key=lambda x: x["memory_mb"], reverse=True)
        self._send_json(200, {"processes": procs, "count": len(procs)})

    def handle_kill(self, payload):
        pid = payload.get("pid")
        force = payload.get("force", False)
        if not pid or not isinstance(pid, int):
            self._send_json(400, {"error": "Invalid or missing 'pid' parameter"})
            return

        try:
            proc = psutil.Process(pid)
            proc_name = proc.name()
            if force:
                proc.kill()
                msg = f"Force-killed process '{proc_name}' (PID: {pid})"
            else:
                proc.terminate()
                msg = f"Terminated process '{proc_name}' (PID: {pid})"
            self._send_json(200, {"success": True, "message": msg, "pid": pid})
        except psutil.NoSuchProcess:
            self._send_json(404, {"error": f"Process with PID {pid} not found (already terminated)"})
        except psutil.AccessDenied:
            self._send_json(403, {"error": f"Access denied. Cannot terminate system/protected process (PID {pid})"})
        except Exception as e:
            self._send_json(500, {"error": f"Failed to kill process: {str(e)}"})

    def handle_run(self, payload):
        command = payload.get("command")
        if not command or not isinstance(command, str):
            self._send_json(400, {"error": "Missing 'command' parameter"})
            return

        try:
            p = subprocess.Popen(command, shell=True)
            self._send_json(200, {
                "success": True,
                "message": f"Launched command successfully",
                "pid": p.pid
            })
        except Exception as e:
            self._send_json(500, {"error": f"Failed to launch command: {str(e)}"})

    def log_message(self, format, *args):
        # Clean console log
        print(f"[{time.strftime('%X')}] {self.address_string()} - {format % args}")


def run_server(host="0.0.0.0", port=DEFAULT_PORT, token=DEFAULT_TOKEN):
    RemoteTaskManagerHandler.auth_token = token
    server_address = (host, port)
    httpd = ThreadingHTTPServer(server_address, RemoteTaskManagerHandler)
    
    # Warm up psutil CPU calculation
    psutil.cpu_percent(interval=None)
    for p in psutil.process_iter(['cpu_percent']):
        pass

    print("=" * 60)
    print("  REMOTE TASK MANAGER - SERVER AGENT")
    print("=" * 60)
    print(f"  Host:           {host}")
    print(f"  Port:           {port}")
    print(f"  Auth Token:     {token}")
    print(f"  Status URL:     http://localhost:{port}/api/status")
    print(f"  Processes URL:  http://localhost:{port}/api/processes")
    print("=" * 60)
    print("  Server is listening for client requests... (Press Ctrl+C to stop)")
    print("=" * 60)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Remote Task Manager Server...")
        httpd.server_close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Remote Task Manager Server Agent")
    parser.add_argument("--host", default="0.0.0.0", help="Host address to bind to (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"Port to listen on (default: {DEFAULT_PORT})")
    parser.add_argument("--token", default=DEFAULT_TOKEN, help=f"Security token (default: {DEFAULT_TOKEN})")
    args = parser.parse_args()

    run_server(host=args.host, port=args.port, token=args.token)
