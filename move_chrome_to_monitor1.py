#!/usr/bin/env python3
"""
Move Google Chrome to Monitor 1 (Main/Primary Monitor) on Windows, then exit.
Uses native Windows Win32 APIs via ctypes with zero external dependencies.
"""

import os
import sys
import time
import subprocess
import ctypes
from ctypes import wintypes

# Enable Per-Monitor DPI Awareness for exact coordinates across mixed-DPI displays
try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2)  # PROCESS_PER_MONITOR_DPI_AWARE
except Exception:
    try:
        ctypes.windll.user32.SetProcessDPIAware()
    except Exception:
        pass

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

SW_RESTORE = 9
SW_MAXIMIZE = 3
SW_SHOWNORMAL = 1
SWP_NOZORDER = 0x0004
SWP_NOACTIVATE = 0x0010
SWP_SHOWWINDOW = 0x0040
SWP_FRAMECHANGED = 0x0020
PROCESS_QUERY_LIMITED_INFORMATION = 0x1000


class RECT(ctypes.Structure):
    _fields_ = [
        ('left', wintypes.LONG),
        ('top', wintypes.LONG),
        ('right', wintypes.LONG),
        ('bottom', wintypes.LONG),
    ]


class MONITORINFOEXW(ctypes.Structure):
    _fields_ = [
        ('cbSize', wintypes.DWORD),
        ('rcMonitor', RECT),
        ('rcWork', RECT),
        ('dwFlags', wintypes.DWORD),
        ('szDevice', wintypes.WCHAR * 32),
    ]


def attach_interactive_desktop():
    """Ensure access to the interactive desktop if running from another window station or service."""
    try:
        hdesk = user32.OpenInputDesktop(0, False, 0x01FF)
        if hdesk:
            user32.SetThreadDesktop(hdesk)
            return hdesk
    except Exception:
        pass
    return None


def get_primary_monitor():
    """Find Monitor 1 (Main/Primary Monitor) work area and full bounds."""
    monitors = []

    def _enum_proc(hMonitor, hdcMonitor, lprcMonitor, dwData):
        mi = MONITORINFOEXW()
        mi.cbSize = ctypes.sizeof(MONITORINFOEXW)
        if user32.GetMonitorInfoW(hMonitor, ctypes.byref(mi)):
            monitors.append({
                'device': mi.szDevice,
                'is_primary': bool(mi.dwFlags & 1),
                'monitor': mi.rcMonitor,
                'work': mi.rcWork,
            })
        return True

    ENUM_PROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HMONITOR, wintypes.HDC, ctypes.POINTER(RECT), wintypes.LPARAM)
    user32.EnumDisplayMonitors(None, None, ENUM_PROC(_enum_proc), 0)

    # Return primary monitor
    for m in monitors:
        if m['is_primary']:
            return m

    # Fallback to first monitor or full screen metrics
    if monitors:
        return monitors[0]

    fallback_rect = RECT(0, 0, user32.GetSystemMetrics(0), user32.GetSystemMetrics(1))
    return {
        'device': r'\\.\DISPLAY1',
        'is_primary': True,
        'monitor': fallback_rect,
        'work': fallback_rect,
    }


def get_process_name(pid):
    """Retrieve executable full path from process ID."""
    h_proc = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
    if not h_proc:
        return ""
    try:
        buf = ctypes.create_unicode_buffer(1024)
        size = wintypes.DWORD(1024)
        if kernel32.QueryFullProcessImageNameW(h_proc, 0, buf, ctypes.byref(size)):
            return buf.value
        return ""
    finally:
        kernel32.CloseHandle(h_proc)


def find_chrome_windows(hdesk=None):
    """Locate all top-level Chrome browser windows."""
    chrome_windows = []

    def _enum_win(hwnd, lParam):
        if not user32.IsWindowVisible(hwnd):
            return True

        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        pname = os.path.basename(get_process_name(pid.value)).lower()

        if pname == 'chrome.exe':
            cls_buf = ctypes.create_unicode_buffer(256)
            user32.GetClassNameW(hwnd, cls_buf, 256)

            # Chrome main windows use 'Chrome_WidgetWin_1'
            if 'Chrome_WidgetWin_1' in cls_buf.value:
                rect = RECT()
                user32.GetWindowRect(hwnd, ctypes.byref(rect))
                w = rect.right - rect.left
                h = rect.bottom - rect.top

                # Ignore invisible 0x0 or utility helper windows
                if w > 20 and h > 20:
                    title_buf = ctypes.create_unicode_buffer(512)
                    user32.GetWindowTextW(hwnd, title_buf, 512)
                    chrome_windows.append({
                        'hwnd': hwnd,
                        'title': title_buf.value,
                        'rect': rect,
                        'is_zoomed': bool(user32.IsZoomed(hwnd)),
                        'is_iconic': bool(user32.IsIconic(hwnd)),
                    })
        return True

    ENUM_WIN_PROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    if hdesk:
        user32.EnumDesktopWindows(hdesk, ENUM_WIN_PROC(_enum_win), 0)
    else:
        user32.EnumWindows(ENUM_WIN_PROC(_enum_win), 0)

    return chrome_windows


def get_chrome_executable_path():
    """Find Google Chrome executable path on the machine."""
    candidates = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%PROGRAMFILES%\Google\Chrome\Application\chrome.exe"),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return "chrome.exe"


def bring_window_to_front(hwnd):
    """Safely bring window to front and focus it."""
    try:
        cur_thread = kernel32.GetCurrentThreadId()
        fore_hwnd = user32.GetForegroundWindow()
        fore_thread = user32.GetWindowThreadProcessId(fore_hwnd, None)
        if cur_thread != fore_thread:
            user32.AttachThreadInput(cur_thread, fore_thread, True)
            user32.BringWindowToTop(hwnd)
            user32.SetForegroundWindow(hwnd)
            user32.AttachThreadInput(cur_thread, fore_thread, False)
        else:
            user32.BringWindowToTop(hwnd)
            user32.SetForegroundWindow(hwnd)
    except Exception:
        user32.BringWindowToTop(hwnd)
        user32.SetForegroundWindow(hwnd)


def move_window_to_primary(win, primary_info, offset_idx=0):
    """Move a window to the primary monitor work area."""
    hwnd = win['hwnd']
    work = primary_info['work']
    work_left = work.left
    work_top = work.top
    work_w = work.right - work.left
    work_h = work.bottom - work.top

    is_zoomed = win['is_zoomed']
    is_iconic = win['is_iconic']

    if is_zoomed:
        # Restore temporarily, relocate into primary work bounds, then re-maximize
        user32.ShowWindow(hwnd, SW_RESTORE)
        time.sleep(0.05)

        target_w = min(1280, work_w - 100)
        target_h = min(800, work_h - 100)
        target_x = work_left + max(0, (work_w - target_w) // 2)
        target_y = work_top + max(0, (work_h - target_h) // 2)

        user32.MoveWindow(hwnd, target_x, target_y, target_w, target_h, True)
        time.sleep(0.05)
        user32.ShowWindow(hwnd, SW_MAXIMIZE)
    elif is_iconic:
        user32.ShowWindow(hwnd, SW_RESTORE)
        time.sleep(0.05)

        rect = win['rect']
        cur_w = rect.right - rect.left
        cur_h = rect.bottom - rect.top
        target_w = min(cur_w if cur_w > 200 else 1280, work_w)
        target_h = min(cur_h if cur_h > 200 else 800, work_h)
        target_x = work_left + max(0, (work_w - target_w) // 2) + (offset_idx * 30)
        target_y = work_top + max(0, (work_h - target_h) // 2) + (offset_idx * 30)

        user32.MoveWindow(hwnd, target_x, target_y, target_w, target_h, True)
    else:
        rect = win['rect']
        cur_w = rect.right - rect.left
        cur_h = rect.bottom - rect.top

        # Constrain window size if it exceeds the target monitor
        target_w = min(cur_w, work_w)
        target_h = min(cur_h, work_h)
        target_x = work_left + max(0, (work_w - target_w) // 2) + (offset_idx * 30)
        target_y = work_top + max(0, (work_h - target_h) // 2) + (offset_idx * 30)

        user32.MoveWindow(hwnd, target_x, target_y, target_w, target_h, True)

    bring_window_to_front(hwnd)


def main():
    hdesk = attach_interactive_desktop()
    primary = get_primary_monitor()
    work = primary['work']
    print(f"[Monitor 1] Device: {primary['device']}")
    print(f"[Monitor 1] Work Area: left={work.left}, top={work.top}, right={work.right}, bottom={work.bottom} ({work.right - work.left}x{work.bottom - work.top})")

    chrome_wins = find_chrome_windows(hdesk)

    if not chrome_wins:
        print("Chrome is not currently open. Starting Chrome...")
        chrome_exe = get_chrome_executable_path()
        try:
            if hasattr(os, 'startfile') and os.path.exists(chrome_exe):
                os.startfile(chrome_exe)
            else:
                subprocess.Popen([chrome_exe])
        except Exception as e:
            print(f"Error starting Chrome: {e}")
            sys.exit(1)

        # Wait for Chrome window to appear (up to 8 seconds)
        for _ in range(32):
            time.sleep(0.25)
            chrome_wins = find_chrome_windows(hdesk)
            if chrome_wins:
                break

    if not chrome_wins:
        print("No Chrome window detected.")
        sys.exit(1)

    print(f"Found {len(chrome_wins)} Chrome window(s):")
    for idx, win in enumerate(chrome_wins):
        title = win['title'] or "(Untitled)"
        status = "Maximized" if win['is_zoomed'] else ("Minimized" if win['is_iconic'] else "Normal")
        print(f"  {idx + 1}. [HWND {win['hwnd']}] ({status}) '{title}' -> Moving to Monitor 1...")
        move_window_to_primary(win, primary, offset_idx=idx)

    print("Chrome successfully moved to Monitor 1 (Main Monitor). Exiting.")
    sys.exit(0)


if __name__ == "__main__":
    main()
