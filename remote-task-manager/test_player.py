import os
import sys
import time
import subprocess
import re
import threading
import tkinter as tk
from PIL import Image, ImageTk

def get_ffmpeg_exe():
    if getattr(sys, 'frozen', False):
        for name in ['ffmpeg.exe', 'ffmpeg-win-x86_64-v7.1.exe']:
            candidate = os.path.join(getattr(sys, '_MEIPASS', ''), name)
            if os.path.isfile(candidate):
                return candidate
            candidate_sub = os.path.join(getattr(sys, '_MEIPASS', ''), 'imageio_ffmpeg', 'binaries', name)
            if os.path.isfile(candidate_sub):
                return candidate_sub
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        pass
    import shutil
    return shutil.which('ffmpeg')

class FullscreenTkVideoPlayer(tk.Toplevel):
    def __init__(self, master, video_path, on_finish=None):
        super().__init__(master)
        self.video_path = os.path.abspath(video_path)
        self.on_finish = on_finish
        self.is_running = True
        self.ffmpeg_proc = None

        self.title("Remote Video Playback")
        self.attributes("-fullscreen", True)
        self.attributes("-topmost", True)
        self.configure(bg="black", cursor="none")

        # Ignore Alt+F4
        self.protocol("WM_DELETE_WINDOW", lambda: None)

        # Intercept keys: Only 'Z' or 'z' exits
        self.bind("<Key>", self._on_key)
        self.bind("<Button-1>", lambda e: "break")
        self.bind("<Button-2>", lambda e: "break")
        self.bind("<Button-3>", lambda e: "break")
        self.focus_force()

        self.screen_w = self.winfo_screenwidth()
        self.screen_h = self.winfo_screenheight()

        self.canvas = tk.Canvas(self, bg="black", highlightthickness=0, width=self.screen_w, height=self.screen_h)
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
            print("[PLAYER ERROR] FFmpeg binary not found")
            self.stop("FFmpeg binary not found")
            return

        # 1. Probe resolution and FPS
        cmd_probe = [ffmpeg_bin, "-i", self.video_path]
        startupinfo = None
        if os.name == "nt":
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        
        probe_res = subprocess.run(cmd_probe, stderr=subprocess.PIPE, text=True, errors="replace", startupinfo=startupinfo)
        match = re.search(r'(\d{2,5})x(\d{2,5})', probe_res.stderr)
        vw, vh = (int(match.group(1)), int(match.group(2))) if match else (1280, 720)
        fps_match = re.search(r'(\d+(?:\.\d+)?)\s*fps', probe_res.stderr)
        fps = float(fps_match.group(1)) if fps_match else 30.0
        if fps <= 0 or fps > 120:
            fps = 30.0
        frame_delay = 1.0 / fps

        # Calculate scaled dimensions preserving aspect ratio
        scale = min(self.screen_w / vw, self.screen_h / vh)
        target_w = int(vw * scale)
        target_h = int(vh * scale)
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

        try:
            self.ffmpeg_proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                bufsize=frame_bytes_len * 5,
                startupinfo=startupinfo
            )
        except Exception as e:
            print(f"[PLAYER ERROR] Failed launching ffmpeg: {e}")
            self.stop(f"launch failed: {e}")
            return

        frame_count = 0
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
            frame_count += 1

            elapsed = time.perf_counter() - t_start
            sleep_time = max(0.001, frame_delay - elapsed)
            time.sleep(sleep_time)

        if self.is_running:
            self.stop("video finished")

if __name__ == "__main__":
    root = tk.Tk()
    root.withdraw()
    p = FullscreenTkVideoPlayer(root, "test.mp4", on_finish=lambda r: root.destroy())
    root.mainloop()
    print("Test player completed successfully!")
