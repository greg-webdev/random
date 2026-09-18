import os
import sys
import subprocess
import shutil
import imageio_ffmpeg

# 1. Locate static FFmpeg executable
ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
print(f"[*] Found static FFmpeg executable: {ffmpeg_exe} (Exists: {os.path.exists(ffmpeg_exe)}, Size: {os.path.getsize(ffmpeg_exe)} bytes)")

# 2. Locate Hand Landmarker model
hand_task = os.path.abspath("hand_landmarker.task")
print(f"[*] Hand Landmarker model: {hand_task} (Exists: {os.path.exists(hand_task)})")

# 3. Terminate running server processes before build
try:
    subprocess.run('powershell -Command "Stop-Process -Name RemoteTaskManagerServer* -Force -ErrorAction SilentlyContinue"', shell=True)
except Exception:
    pass

cmd = [
    sys.executable, "-m", "PyInstaller",
    "--onefile",
    "--noconsole",
    "--name", "RemoteTaskManagerServer",
    "--collect-all", "imageio_ffmpeg",
    "--collect-all", "mediapipe",
    "--paths", "server",
    "--hidden-import", "pystray._win32",
    "--hidden-import", "PIL",
    "--hidden-import", "cv2",
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
