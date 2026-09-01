#include "file_dialog.hpp"
#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <commdlg.h>
#include <shellapi.h>

#define WM_TRAYICON (WM_USER + 101)
#define ID_TRAY_ICON 1001

static NOTIFYICONDATAA g_nid;
static bool g_tray_initialized = false;
static bool g_tray_restore_requested = false;
static WNDPROC g_prev_wndproc = nullptr;

static LRESULT CALLBACK TraySubclassProc(HWND hwnd, UINT uMsg, WPARAM wParam, LPARAM lParam) {
    if (uMsg == WM_TRAYICON) {
        if (lParam == WM_LBUTTONDOWN || lParam == WM_LBUTTONDBLCLK || lParam == WM_RBUTTONDOWN) {
            g_tray_restore_requested = true;
            restore_window_from_tray(hwnd);
            return 0;
        }
    }
    if (g_prev_wndproc) {
        return CallWindowProcA(g_prev_wndproc, hwnd, uMsg, wParam, lParam);
    }
    return DefWindowProcA(hwnd, uMsg, wParam, lParam);
}

std::string open_file_dialog() {
    char filename[MAX_PATH] = "";
    OPENFILENAMEA ofn;
    ZeroMemory(&ofn, sizeof(ofn));
    ofn.lStructSize = sizeof(ofn);
    ofn.hwndOwner = NULL;
    ofn.lpstrFilter = "AI Brain Files (*.ai)\0*.ai\0All Files (*.*)\0*.*\0";
    ofn.lpstrFile = filename;
    ofn.nMaxFile = MAX_PATH;
    ofn.Flags = OFN_EXPLORER | OFN_FILEMUSTEXIST | OFN_HIDEREADONLY;
    ofn.lpstrDefExt = "ai";

    if (GetOpenFileNameA(&ofn)) {
        return std::string(filename);
    }
    return "";
}

std::string save_file_dialog() {
    char filename[MAX_PATH] = "best_brain.ai";
    OPENFILENAMEA ofn;
    ZeroMemory(&ofn, sizeof(ofn));
    ofn.lStructSize = sizeof(ofn);
    ofn.hwndOwner = NULL;
    ofn.lpstrFilter = "AI Brain Files (*.ai)\0*.ai\0All Files (*.*)\0*.*\0";
    ofn.lpstrFile = filename;
    ofn.nMaxFile = MAX_PATH;
    ofn.Flags = OFN_EXPLORER | OFN_PATHMUSTEXIST | OFN_OVERWRITEPROMPT;
    ofn.lpstrDefExt = "ai";

    if (GetSaveFileNameA(&ofn)) {
        return std::string(filename);
    }
    return "";
}

std::string open_map_dialog() {
    char filename[MAX_PATH] = "";
    OPENFILENAMEA ofn;
    ZeroMemory(&ofn, sizeof(ofn));
    ofn.lStructSize = sizeof(ofn);
    ofn.hwndOwner = NULL;
    ofn.lpstrFilter = "Maze Map Files (*.map)\0*.map\0All Files (*.*)\0*.*\0";
    ofn.lpstrFile = filename;
    ofn.nMaxFile = MAX_PATH;
    ofn.Flags = OFN_EXPLORER | OFN_FILEMUSTEXIST | OFN_HIDEREADONLY;
    ofn.lpstrDefExt = "map";

    if (GetOpenFileNameA(&ofn)) {
        return std::string(filename);
    }
    return "";
}

std::string save_map_dialog() {
    char filename[MAX_PATH] = "custom_maze.map";
    OPENFILENAMEA ofn;
    ZeroMemory(&ofn, sizeof(ofn));
    ofn.lStructSize = sizeof(ofn);
    ofn.hwndOwner = NULL;
    ofn.lpstrFilter = "Maze Map Files (*.map)\0*.map\0All Files (*.*)\0*.*\0";
    ofn.lpstrFile = filename;
    ofn.nMaxFile = MAX_PATH;
    ofn.Flags = OFN_EXPLORER | OFN_PATHMUSTEXIST | OFN_OVERWRITEPROMPT;
    ofn.lpstrDefExt = "map";

    if (GetSaveFileNameA(&ofn)) {
        return std::string(filename);
    }
    return "";
}

void native_start_window_drag(void* hwnd) {
    if (hwnd) {
        ReleaseCapture();
        SendMessageA((HWND)hwnd, WM_NCLBUTTONDOWN, HTCAPTION, 0);
    }
}

void init_system_tray(void* hwnd) {
    if (!hwnd || g_tray_initialized) return;

    HWND h = (HWND)hwnd;
    if (!g_prev_wndproc) {
        g_prev_wndproc = (WNDPROC)SetWindowLongPtrA(h, GWLP_WNDPROC, (LONG_PTR)TraySubclassProc);
    }

    ZeroMemory(&g_nid, sizeof(NOTIFYICONDATAA));
    g_nid.cbSize = sizeof(NOTIFYICONDATAA);
    g_nid.hWnd = h;
    g_nid.uID = ID_TRAY_ICON;
    g_nid.uFlags = NIF_ICON | NIF_MESSAGE | NIF_TIP;
    g_nid.uCallbackMessage = WM_TRAYICON;
    g_nid.hIcon = LoadIcon(NULL, IDI_APPLICATION);
    lstrcpyA(g_nid.szTip, "Maze AI Simulation - Running in Background");

    Shell_NotifyIconA(NIM_ADD, &g_nid);
    g_tray_initialized = true;
}

void update_system_tray(void* hwnd, const char* tooltip) {
    if (!g_tray_initialized && hwnd) {
        init_system_tray(hwnd);
    }
    if (g_tray_initialized && tooltip) {
        lstrcpynA(g_nid.szTip, tooltip, sizeof(g_nid.szTip));
        Shell_NotifyIconA(NIM_MODIFY, &g_nid);
    }
}

void remove_system_tray(void* hwnd) {
    if (g_tray_initialized) {
        Shell_NotifyIconA(NIM_DELETE, &g_nid);
        g_tray_initialized = false;
    }
}

void hide_window_to_tray(void* hwnd) {
    if (hwnd) {
        init_system_tray(hwnd);
        ShowWindow((HWND)hwnd, SW_HIDE);
    }
}

void restore_window_from_tray(void* hwnd) {
    if (hwnd) {
        ShowWindow((HWND)hwnd, SW_RESTORE);
        ShowWindow((HWND)hwnd, SW_SHOW);
        SetForegroundWindow((HWND)hwnd);
        remove_system_tray(hwnd);
    }
}

bool poll_tray_restore_event() {
    bool res = g_tray_restore_requested;
    g_tray_restore_requested = false;
    return res;
}

#else

std::string open_file_dialog() { return ""; }
std::string save_file_dialog() { return ""; }
std::string open_map_dialog() { return ""; }
std::string save_map_dialog() { return ""; }
void native_start_window_drag(void*) {}
void init_system_tray(void*) {}
void update_system_tray(void*, const char*) {}
void remove_system_tray(void*) {}
void hide_window_to_tray(void*) {}
void restore_window_from_tray(void*) {}
bool poll_tray_restore_event() { return false; }

#endif
