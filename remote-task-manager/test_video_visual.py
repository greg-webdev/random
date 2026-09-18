import subprocess
import time
import os
from PIL import ImageGrab

video_path = r"C:\Users\LENOVO\Documents\Apismoon Documents\Video\1. Apismoon Factory.mp4"
ps_script = r"c:\Users\LENOVO\Documents\random\remote-task-manager\server\play_video.ps1"

p = subprocess.Popen([
    "powershell.exe",
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", ps_script,
    "-VideoPath", video_path
])

time.sleep(2.5)

# Capture screenshot
img = ImageGrab.grab()
img.save("screen_capture.png")

# Kill process
p.terminate()
p.kill()

print("Captured screenshot to screen_capture.png, size:", img.size)
