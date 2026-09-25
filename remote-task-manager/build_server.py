import os
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"
import sys
import subprocess
import shutil
import imageio_ffmpeg

try:
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    import glob
    candidates = glob.glob(os.path.expandvars(r"%LOCALAPPDATA%\Packages\PythonSoftwareFoundation.Python.3.13_*\LocalCache\local-packages\Python313\site-packages\imageio_ffmpeg\binaries\ffmpeg*.exe"))
    ffmpeg_exe = candidates[0] if candidates else None

if not ffmpeg_exe or not os.path.exists(ffmpeg_exe):
    raise RuntimeError(f"Could not locate ffmpeg executable: {ffmpeg_exe}")

os.environ["IMAGEIO_FFMPEG_EXE"] = ffmpeg_exe
print(f"[*] Found static FFmpeg executable: {ffmpeg_exe} (Exists: {os.path.exists(ffmpeg_exe)}, Size: {os.path.getsize(ffmpeg_exe)} bytes)")

# 2. Locate Hand Landmarker model
hand_task = os.path.abspath("hand_landmarker.task")
print(f"[*] Hand Landmarker model: {hand_task} (Exists: {os.path.exists(hand_task)})")

# 3. Terminate running server processes before build
try:
    import psutil
    for p in psutil.process_iter(['name']):
        if p.info['name'] and 'RemoteTaskManager' in p.info['name']:
            try:
                p.kill()
            except Exception:
                pass
except Exception:
    pass

cmd = [
    sys.executable, "-m", "PyInstaller",
    "--onefile",
    "--noconsole",
    "--name", "RemoteTaskManagerServer",
    "--collect-all", "imageio_ffmpeg",
    "--collect-data", "mediapipe",
    "--collect-binaries", "mediapipe",
    "--paths", "server",
    "--hidden-import", "pystray._win32",
    "--hidden-import", "PIL",
    "--hidden-import", "cv2",
    "--hidden-import", "mediapipe",
    "--hidden-import", "mediapipe.tasks",
    "--hidden-import", "mediapipe.tasks.python",
    "--hidden-import", "mediapipe.tasks.python.vision",
    "--hidden-import", "gesture_detector",
    "--hidden-import", "server.gesture_detector",
    "--add-binary", f"{ffmpeg_exe};.",
    "--add-binary", f"{ffmpeg_exe};imageio_ffmpeg/binaries",
    "--add-data", f"{hand_task};.",
    "--add-data", f"{hand_task};server",
    "--distpath", "dist",
    "--workpath", os.path.join("build_temp", "server"),
    "--specpath", os.path.join("build_temp", "server"),
    os.path.join("server", "server_app.py")
]

print(f"[*] Running PyInstaller for RemoteTaskManagerServer (with FFmpeg + MediaPipe gesture)...")
subprocess.check_call(cmd)

# 4. Copy to server directory
dist_exe = os.path.join("dist", "RemoteTaskManagerServer.exe")
server_exe = os.path.join("server", "RemoteTaskManagerServer.exe")
if os.path.exists(dist_exe):
    shutil.copy2(dist_exe, server_exe)
    print(f"[SUCCESS] Copied to {server_exe} ({os.path.getsize(server_exe)} bytes)")
else:
    print("[ERROR] Dist executable not found!")
