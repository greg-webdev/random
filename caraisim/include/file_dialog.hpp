#pragma once
#include <string>

std::string open_file_dialog();
std::string save_file_dialog();
std::string open_map_dialog();
std::string save_map_dialog();

// Native Windows 7 Smooth Dragging & Tray Integration
void native_start_window_drag(void* hwnd);
void init_system_tray(void* hwnd);
void update_system_tray(void* hwnd, const char* tooltip);
void remove_system_tray(void* hwnd);
void hide_window_to_tray(void* hwnd);
void restore_window_from_tray(void* hwnd);
bool poll_tray_restore_event();
