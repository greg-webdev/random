#!/usr/bin/env python3
import os
import sys
import subprocess
import shutil

def build():
    print("[*] Building asciivd.exe with PyInstaller...")
    asciivd_py = os.path.join(os.path.dirname(__file__), "asciivd.py")
    
    cmd = [
        sys.executable,
        "-m", "PyInstaller",
        "--onefile",
        "--name=asciivd",
        "--clean",
        "--collect-all=cv2",
        "--collect-all=numpy",
        asciivd_py
    ]
    
    result = subprocess.run(cmd, cwd=os.path.dirname(__file__))
    if result.returncode == 0:
        dist_exe = os.path.join(os.path.dirname(__file__), "dist", "asciivd.exe")
        target_exe = os.path.join(os.path.dirname(__file__), "asciivd.exe")
        if os.path.exists(dist_exe):
            shutil.copy(dist_exe, target_exe)
            print(f"\n[+] Successfully built standalone executable: {target_exe}")
            print(f"    File size: {os.path.getsize(target_exe) / (1024*1024):.2f} MB")
    else:
        print("[!] PyInstaller build failed.")

if __name__ == "__main__":
    build()
