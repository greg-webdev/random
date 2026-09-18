"""
Remote Task Manager - Client GUI
A modern Windows 11 Dark Mode Task Manager client with:
- Navigation Menu / Tabs:
  * Task Manager (Process table, search, kill, force kill, run task)
  * File Manager (Drag-and-drop file upload, target server folder selection)
  * Media & Display (Fullscreen video playback, Black Screen control with 'Z' key dismissal)
- Real-time CPU, RAM, and Disk utilization gauges
"""

import sys
import os
import json
import time
import base64
import threading
import urllib.request
import urllib.error
from urllib.parse import quote, unquote
import io
import re
from PIL import Image, ImageTk
import tkinter as tk
from tkinter import ttk, messagebox, simpledialog, filedialog

try:
    from tkinterdnd2 import TkinterDnD, DND_FILES
    BaseTkClass = TkinterDnD.Tk
    HAS_DND = True
except Exception:
    BaseTkClass = tk.Tk
    HAS_DND = False

CONFIG_FILE = os.path.join(os.path.expanduser("~"), ".remote_task_manager_config.json")

# Visual Palette (Windows 11 Fluent Dark inspired)
BG_DARK = "#18181b"          # Main Window Background
BG_CARD = "#27272a"          # Cards / Containers
BG_SURFACE = "#2d2d32"       # Input fields / secondary surface
BORDER_COLOR = "#3f3f46"     # Subtle borders
TEXT_PRIMARY = "#f4f4f5"     # High contrast primary text
TEXT_SECONDARY = "#a1a1aa"   # Muted subtext
ACCENT_BLUE = "#3b82f6"      # Primary actions / highlights
ACCENT_GREEN = "#22c55e"     # Good / Safe / Low usage
ACCENT_YELLOW = "#eab308"    # Warning / Medium usage
ACCENT_RED = "#ef4444"       # Danger / High usage / Kill button
ACCENT_PURPLE = "#8b5cf6"    # Media & File transfer accent
HOVER_ROW = "#383842"        # Row hover/select


class RemoteFolderBrowserDialog(tk.Toplevel):
    def __init__(self, parent, server_ip, server_port, initial_path="", on_select_callback=None):
        super().__init__(parent)
        self.parent_client = parent
        self.server_ip = server_ip
        self.server_port = server_port
        self.on_select_callback = on_select_callback

        self.title(f"Server Folder Explorer - {server_ip}:{server_port}")
        self.geometry("740x540")
        self.minsize(600, 420)
        self.configure(bg=BG_DARK)
        self.transient(parent)
        self.grab_set()

        self.current_path = initial_path
        self.parent_path = ""
        self.selected_path_var = tk.StringVar(value=initial_path)
        self.path_entry_var = tk.StringVar(value=initial_path)
        self.save_to_places_var = tk.BooleanVar(value=True)

        self._build_ui()
        self.navigate_to(initial_path)

    def _build_ui(self):
        header = tk.Frame(self, bg=BG_CARD, padx=16, pady=10)
        header.pack(fill=tk.X)

        title_lbl = tk.Label(
            header,
            text=f"Remote Server Explorer [{self.server_ip}:{self.server_port}]",
            font=("Segoe UI", 11, "bold"),
            fg=TEXT_PRIMARY,
            bg=BG_CARD
        )
        title_lbl.pack(side=tk.LEFT)

        sub_lbl = tk.Label(
            header,
            text="Double-click folders to open • Select folder and click 'Select This Folder'",
            font=("Segoe UI", 8),
            fg=TEXT_SECONDARY,
            bg=BG_CARD
        )
        sub_lbl.pack(side=tk.RIGHT)

        toolbar = tk.Frame(self, bg=BG_DARK, padx=16, pady=8)
        toolbar.pack(fill=tk.X)

        self.btn_up = tk.Button(
            toolbar,
            text="⬆️ Up",
            font=("Segoe UI", 9),
            bg=BG_SURFACE,
            fg=TEXT_PRIMARY,
            activebackground=BORDER_COLOR,
            activeforeground=TEXT_PRIMARY,
            relief="flat",
            padx=8,
            pady=2,
            cursor="hand2",
            command=self.go_up
        )
        self.btn_up.pack(side=tk.LEFT, padx=(0, 6))

        btn_drives = tk.Button(
            toolbar,
            text="💾 Drives",
            font=("Segoe UI", 9),
            bg=BG_SURFACE,
            fg=TEXT_PRIMARY,
            activebackground=BORDER_COLOR,
            activeforeground=TEXT_PRIMARY,
            relief="flat",
            padx=8,
            pady=2,
            cursor="hand2",
            command=lambda: self.navigate_to("")
        )
        btn_drives.pack(side=tk.LEFT, padx=(0, 6))

        self.btn_refresh = tk.Button(
            toolbar,
            text="🔄 Refresh",
            font=("Segoe UI", 9),
            bg=BG_SURFACE,
            fg=TEXT_PRIMARY,
            activebackground=BORDER_COLOR,
            activeforeground=TEXT_PRIMARY,
            relief="flat",
            padx=8,
            pady=2,
            cursor="hand2",
            command=lambda: self.navigate_to(self.current_path)
        )
        self.btn_refresh.pack(side=tk.LEFT, padx=(0, 8))

        path_entry = tk.Entry(
            toolbar,
            textvariable=self.path_entry_var,
            font=("Segoe UI", 9),
            bg=BG_SURFACE,
            fg=TEXT_PRIMARY,
            insertbackground=TEXT_PRIMARY,
            relief="flat"
        )
        path_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 6), ipady=3)
        path_entry.bind("<Return>", lambda e: self.navigate_to(self.path_entry_var.get().strip()))

        btn_go = tk.Button(
            toolbar,
            text="Go",
            font=("Segoe UI", 9, "bold"),
            bg=ACCENT_BLUE,
            fg="#ffffff",
            relief="flat",
            padx=10,
            pady=2,
            cursor="hand2",
            command=lambda: self.navigate_to(self.path_entry_var.get().strip())
        )
        btn_go.pack(side=tk.LEFT, padx=(0, 6))

        btn_new_folder = tk.Button(
            toolbar,
            text="➕ New Folder",
            font=("Segoe UI", 9),
            bg=BG_SURFACE,
            fg=ACCENT_GREEN,
            activebackground=BORDER_COLOR,
            activeforeground=ACCENT_GREEN,
            relief="flat",
            padx=8,
            pady=2,
            cursor="hand2",
            command=self.create_new_folder
        )
        btn_new_folder.pack(side=tk.LEFT)

        tree_container = tk.Frame(self, bg=BG_DARK, padx=16, pady=4)
        tree_container.pack(fill=tk.BOTH, expand=True)

        cols = ("name", "path")
        self.tree = ttk.Treeview(
            tree_container,
            columns=cols,
            show="headings",
            selectmode="browse"
        )
        self.tree.heading("name", text="Folder / Drive Name", anchor="w")
        self.tree.heading("path", text="Server Path", anchor="w")
        self.tree.column("name", width=280, anchor="w")
        self.tree.column("path", width=400, anchor="w")

        tree_scroll = ttk.Scrollbar(tree_container, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=tree_scroll.set)

        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        tree_scroll.pack(side=tk.RIGHT, fill=tk.Y)

        self.tree.bind("<<TreeviewSelect>>", self._on_item_select)
        self.tree.bind("<Double-1>", self._on_item_double_click)

        bottom_bar = tk.Frame(self, bg=BG_CARD, padx=16, pady=10)
        bottom_bar.pack(fill=tk.X, side=tk.BOTTOM)

        sel_info = tk.Frame(bottom_bar, bg=BG_CARD)
        sel_info.pack(fill=tk.X, pady=(0, 8))

        tk.Label(sel_info, text="Selected Server Path:", font=("Segoe UI", 9, "bold"), fg=TEXT_SECONDARY, bg=BG_CARD).pack(side=tk.LEFT)
        self.lbl_selected = tk.Label(sel_info, textvariable=self.selected_path_var, font=("Segoe UI", 9, "bold"), fg=ACCENT_GREEN, bg=BG_CARD)
        self.lbl_selected.pack(side=tk.LEFT, padx=8)

        action_row = tk.Frame(bottom_bar, bg=BG_CARD)
        action_row.pack(fill=tk.X)

        chk_save = tk.Checkbutton(
            action_row,
            text="⭐ Save to reusable download places",
            variable=self.save_to_places_var,
            font=("Segoe UI", 9),
            fg=TEXT_PRIMARY,
            bg=BG_CARD,
            activebackground=BG_CARD,
            activeforeground=TEXT_PRIMARY,
            selectcolor=BG_SURFACE
        )
        chk_save.pack(side=tk.LEFT)

        btn_cancel = tk.Button(
            action_row,
            text="Cancel",
            font=("Segoe UI", 9),
            bg=BG_SURFACE,
            fg=TEXT_SECONDARY,
            relief="flat",
            padx=12,
            pady=4,
            cursor="hand2",
            command=self.destroy
        )
        btn_cancel.pack(side=tk.RIGHT, padx=(6, 0))

        btn_select = tk.Button(
            action_row,
            text="✔ Select This Folder",
            font=("Segoe UI", 9, "bold"),
            bg=ACCENT_BLUE,
            fg="#ffffff",
            activebackground="#2563eb",
            activeforeground="#ffffff",
            relief="flat",
            padx=16,
            pady=4,
            cursor="hand2",
            command=self.confirm_selection
        )
        btn_select.pack(side=tk.RIGHT)

    def navigate_to(self, target_path):
        url = f"http://{self.server_ip}:{self.server_port}/api/browse?path={quote(target_path or '')}"
        
        def _fetch():
            try:
                req = urllib.request.Request(url)
                with urllib.request.urlopen(req, timeout=10) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    self.after(0, lambda: self._populate_tree(data))
            except Exception as e:
                self.after(0, lambda: messagebox.showerror("Browse Error", f"Failed to list server directory:\n{e}", parent=self))

        threading.Thread(target=_fetch, daemon=True).start()

    def _populate_tree(self, data):
        self.current_path = data.get("current_path", "")
        self.parent_path = data.get("parent_path", "")
        self.path_entry_var.set(self.current_path)
        if self.current_path:
            self.selected_path_var.set(self.current_path)

        for item in self.tree.get_children():
            self.tree.delete(item)

        # 1. If inside a folder, ALWAYS show the [.. Up to Parent] entry as the very first row
        if self.current_path:
            parent_display = self.parent_path if self.parent_path else "[All Drives / Root]"
            self.tree.insert("", "end", iid="__up__", values=("📁 ⬆️ .. [Go Up to Parent]", parent_display))

        # 2. Drives
        for d in data.get("drives", []):
            d_name = f"💾 {d.get('name', 'Drive')}"
            d_path = d.get("path", "")
            self.tree.insert("", "end", values=(d_name, d_path))

        # 3. Folders
        folders = data.get("folders", [])
        for f in folders:
            f_name = f"📁 {f.get('name')}"
            f_path = f.get("path")
            self.tree.insert("", "end", values=(f_name, f_path))

        # 4. Files
        files = data.get("files", [])
        for f in files:
            f_name = f"📄 {f.get('name')}  ({f.get('size_kb', 0)} KB)"
            f_path = f.get("path")
            self.tree.insert("", "end", values=(f_name, f_path))

        # 5. Empty check
        if self.current_path and not folders and not files:
            self.tree.insert("", "end", values=("(This directory is currently empty)", self.current_path))

    def _on_item_select(self, event):
        sel = self.tree.selection()
        if sel:
            if sel[0] == "__up__":
                return
            vals = self.tree.item(sel[0], "values")
            name_val = vals[0]
            if name_val.startswith("📄"):
                self.selected_path_var.set(os.path.dirname(vals[1]))
            elif not name_val.startswith("("):
                self.selected_path_var.set(vals[1])

    def _on_item_double_click(self, event):
        sel = self.tree.selection()
        if sel:
            if sel[0] == "__up__":
                self.go_up()
                return
            vals = self.tree.item(sel[0], "values")
            folder_path = vals[1]
            name_val = vals[0]
            if name_val.startswith("📄") or name_val.startswith("("):
                return
            self.navigate_to(folder_path)

    def go_up(self):
        cur = self.path_entry_var.get().strip() or self.current_path.strip()
        target = self.parent_path
        if not target and cur:
            norm = os.path.normpath(cur)
            drive, rest = os.path.splitdrive(norm)
            if rest not in ("\\", "/", ""):
                target = os.path.dirname(norm)
            else:
                target = ""  # Root drives
        self.navigate_to(target or "")

    def create_new_folder(self):
        if not self.current_path:
            messagebox.showinfo("Cannot Create Folder", "Please open a drive or directory first before creating a subfolder.", parent=self)
            return

        new_name = simpledialog.askstring("New Folder", "Enter new folder name on server:", parent=self)
        if not new_name or not new_name.strip():
            return

        url = f"http://{self.server_ip}:{self.server_port}/api/mkdir"
        payload = json.dumps({"path": self.current_path, "folder_name": new_name.strip()}).encode("utf-8")

        def _worker():
            try:
                req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
                with urllib.request.urlopen(req, timeout=8) as resp:
                    res = json.loads(resp.read().decode("utf-8"))
                    self.after(0, lambda: self.navigate_to(self.current_path))
            except Exception as e:
                self.after(0, lambda: messagebox.showerror("Create Error", f"Failed to create folder: {e}", parent=self))

        threading.Thread(target=_worker, daemon=True).start()

    def confirm_selection(self):
        chosen = self.selected_path_var.get().strip()
        if not chosen:
            chosen = self.current_path.strip()
        if not chosen:
            messagebox.showinfo("No Selection", "Please select a folder or drive first.", parent=self)
            return

        if self.on_select_callback:
            self.on_select_callback(chosen, self.save_to_places_var.get())
        self.destroy()


class RemoteTaskManagerClient(BaseTkClass):
    def __init__(self):
        super().__init__()

        self.title("Remote Task Manager - Client Hub")
        self.geometry("1100x740")
        self.minsize(940, 560)
        self.configure(bg=BG_DARK)

        # State
        self.is_connected = False
        self.polling_active = False
        self.refresh_interval = 2.0
        self.last_fetch_time = 0
        self.raw_processes = []
        self.filtered_processes = []
        self.sort_column = "memory_mb"
        self.sort_reverse = True
        self.selected_pid = None
        self.is_screen_blanked = False
        self.is_video_playing = False

        # Live Camera Streaming State
        self.is_streaming_camera = False
        self.client_cam_fps = 0.0
        self.client_cam_target_delay = 0.033  # ~30 FPS default
        self.current_client_cam_photo = None
        self.cam_canvas_image_id = None
        self.latest_client_frame_bytes = None
        self.gesture_enabled = True
        self.gesture_sensitivity = tk.IntVar(value=self.load_config("gesture_sensitivity", 100))
        self.lbl_client_sens_val = None
        self.lbl_media_sens_val = None
        self._sens_update_timer = None
        self.server_mac = None  # Stored on connect for Wake-on-LAN

        # Load Saved Config
        self.server_ip = tk.StringVar(value=self.load_config("ip", "192.168.50.148"))
        self.server_port = tk.StringVar(value=self.load_config("port", "8888"))
        self.search_query = tk.StringVar()
        self.status_text = tk.StringVar(value="Disconnected")

        # Saved reusable download places on server
        default_destinations = [
            "C:\\Users\\LENOVO\\Downloads",
            "C:\\Users\\LENOVO\\Desktop",
            "C:\\Users\\LENOVO\\Documents",
            "C:\\Temp"
        ]
        self.saved_destinations = self.load_config("saved_destinations", default_destinations)
        if not isinstance(self.saved_destinations, list) or not self.saved_destinations:
            self.saved_destinations = default_destinations

        # File manager state
        self.selected_file_path = tk.StringVar(value="")
        initial_dest = self.saved_destinations[0] if self.saved_destinations else "C:\\Users\\LENOVO\\Downloads"
        self.server_dest_dir = tk.StringVar(value=initial_dest)
        self.dest_mode_var = tk.StringVar(value="direct")

        # Configure styles
        self._setup_styles()

        # Build UI layout
        self._build_header()
        self._build_system_cards()
        self._build_nav_and_tabs()
        self._build_status_bar()

        # Context Menu
        self._setup_context_menu()

        # Event bindings
        self.search_query.trace_add("write", lambda *args: self.apply_filter_and_sort())

        # Start background polling thread
        self.poll_thread = threading.Thread(target=self._background_poll_worker, daemon=True)
        self.poll_thread.start()

    def load_config(self, key, default_val):
        try:
            if os.path.exists(CONFIG_FILE):
                with open(CONFIG_FILE, "r") as f:
                    cfg = json.load(f)
                    return cfg.get(key, default_val)
        except Exception:
            pass
        return default_val

    def save_config(self, key=None, value=None):
        try:
            cfg = {}
            if os.path.exists(CONFIG_FILE):
                with open(CONFIG_FILE, "r") as f:
                    cfg = json.load(f)
            # Always sync base fields
            cfg["ip"] = self.server_ip.get().strip()
            cfg["port"] = self.server_port.get().strip()
            cfg["saved_destinations"] = self.saved_destinations
            cfg["gesture_sensitivity"] = self.gesture_sensitivity.get()
            if key is not None:
                cfg[key] = value
            with open(CONFIG_FILE, "w") as f:
                json.dump(cfg, f, indent=2)
        except Exception:
            pass

    def add_saved_destination(self, path):
        path = path.strip()
        if not path:
            return
        if path in self.saved_destinations:
            self.saved_destinations.remove(path)
        self.saved_destinations.insert(0, path)
        self.save_config()
        if hasattr(self, "preset_combo"):
            self.preset_combo["values"] = self.saved_destinations
        self.server_dest_dir.set(path)

    def remove_saved_destination(self, path):
        path = path.strip()
        if path in self.saved_destinations:
            self.saved_destinations.remove(path)
            self.save_config()
            if hasattr(self, "preset_combo"):
                self.preset_combo["values"] = self.saved_destinations
            if self.saved_destinations:
                self.server_dest_dir.set(self.saved_destinations[0])
            else:
                self.server_dest_dir.set("")

    def save_current_destination(self):
        target = self.server_dest_dir.get().strip()
        if not target:
            messagebox.showinfo("Notice", "Please enter or select a folder path to save.", parent=self)
            return
        self.add_saved_destination(target)
        messagebox.showinfo("Saved", f"Location saved:\n{target}\n\nYou can now reuse it anytime from the dropdown!", parent=self)

    def remove_current_destination(self):
        target = self.server_dest_dir.get().strip()
        if not target:
            return
        if messagebox.askyesno("Remove Saved Location", f"Remove '{target}' from saved download places?", parent=self):
            self.remove_saved_destination(target)

    def open_server_folder_browser(self):
        if not self.is_connected:
            messagebox.showwarning("Not Connected", "Please connect to the remote server first to browse its folders.", parent=self)
            return

        ip = self.server_ip.get().strip()
        port = self.server_port.get().strip()
        init_path = self.server_dest_dir.get().strip()

        RemoteFolderBrowserDialog(
            parent=self,
            server_ip=ip,
            server_port=port,
            initial_path=init_path,
            on_select_callback=self.on_server_folder_chosen
        )

    def on_server_folder_chosen(self, chosen_path, should_save=True):
        self.server_dest_dir.set(chosen_path)
        self.dest_mode_var.set("direct")
        if should_save:
            self.add_saved_destination(chosen_path)
        self.status_text.set(f"Selected server destination: {chosen_path}")

    def _on_file_dropped(self, event):
        try:
            raw_data = getattr(event, "data", "")
            if not raw_data:
                return
            files = []
            try:
                files = list(self.tk.splitlist(raw_data))
            except Exception:
                pass
            if not files:
                matches = re.findall(r'\{([^}]+)\}|(\S+)', raw_data)
                files = [m[0] or m[1] for m in matches if m[0] or m[1]]

            for raw_f in files:
                f = raw_f.strip("{}").strip('"\'').strip()
                f = os.path.normpath(f)
                if os.path.exists(f) and os.path.isfile(f):
                    self.selected_file_path.set(f)
                    sz = os.path.getsize(f)
                    sz_str = f"{round(sz / 1024, 1)} KB" if sz < 1024*1024 else f"{round(sz / (1024*1024), 2)} MB"
                    self.drop_box.configure(
                        text=f"✅ FILE READY TO SEND:\n\n{os.path.basename(f)}\n({sz_str})\n\nClick '🚀 Send File to Server Now' below",
                        fg=ACCENT_GREEN
                    )
                    self.status_text.set(f"Selected file: {os.path.basename(f)} ({sz_str})")
                    break
        except Exception as e:
            print(f"[DND_ERROR] {e}")

    def _setup_styles(self):
        self.style = ttk.Style(self)
        self.style.theme_use("clam")

        self.style.configure(".", background=BG_DARK, foreground=TEXT_PRIMARY, font=("Segoe UI", 10))
        self.style.configure("Card.TFrame", background=BG_CARD)

        # Notebook tabs
        self.style.configure("TNotebook", background=BG_DARK, borderwidth=0)
        self.style.configure(
            "TNotebook.Tab",
            background=BG_SURFACE,
            foreground=TEXT_SECONDARY,
            padding=[16, 8],
            font=("Segoe UI", 10, "bold"),
            borderwidth=0
        )
        self.style.map(
            "TNotebook.Tab",
            background=[("selected", BG_CARD)],
            foreground=[("selected", TEXT_PRIMARY)]
        )

        # Treeview
        self.style.configure(
            "Treeview",
            background=BG_CARD,
            fieldbackground=BG_CARD,
            foreground=TEXT_PRIMARY,
            rowheight=28,
            font=("Segoe UI", 9),
            borderwidth=0,
        )
        self.style.configure(
            "Treeview.Heading",
            background=BG_SURFACE,
            foreground=TEXT_PRIMARY,
            font=("Segoe UI", 9, "bold"),
            relief="flat",
            padding=(6, 4),
        )
        self.style.map("Treeview.Heading", background=[("active", BORDER_COLOR)])
        self.style.map("Treeview", background=[("selected", ACCENT_BLUE)], foreground=[("selected", "#ffffff")])

        # Scrollbar
        self.style.configure("Vertical.TScrollbar", background=BG_SURFACE, troughcolor=BG_DARK, borderwidth=0)

    def _build_header(self):
        header_frame = tk.Frame(self, bg=BG_DARK, pady=10, padx=16)
        header_frame.pack(fill=tk.X)

        title_box = tk.Frame(header_frame, bg=BG_DARK)
        title_box.pack(side=tk.LEFT)

        app_title = tk.Label(
            title_box,
            text="Remote Task Manager [Client Hub]",
            font=("Segoe UI", 14, "bold"),
            fg=TEXT_PRIMARY,
            bg=BG_DARK
        )
        app_title.pack(anchor="w")

        conn_box = tk.Frame(header_frame, bg=BG_DARK)
        conn_box.pack(side=tk.RIGHT)

        tk.Label(conn_box, text="Server IP:", font=("Segoe UI", 9), fg=TEXT_SECONDARY, bg=BG_DARK).pack(side=tk.LEFT, padx=(6, 2))
        ip_entry = tk.Entry(
            conn_box,
            textvariable=self.server_ip,
            width=15,
            font=("Segoe UI", 9),
            bg=BG_SURFACE,
            fg=TEXT_PRIMARY,
            insertbackground=TEXT_PRIMARY,
            relief="flat"
        )
        ip_entry.pack(side=tk.LEFT, padx=(0, 6), ipady=3)

        tk.Label(conn_box, text="Port:", font=("Segoe UI", 9), fg=TEXT_SECONDARY, bg=BG_DARK).pack(side=tk.LEFT, padx=(2, 2))
        port_entry = tk.Entry(
            conn_box,
            textvariable=self.server_port,
            width=6,
            font=("Segoe UI", 9),
            bg=BG_SURFACE,
            fg=TEXT_PRIMARY,
            insertbackground=TEXT_PRIMARY,
            relief="flat"
        )
        port_entry.pack(side=tk.LEFT, padx=(0, 10), ipady=3)

        self.btn_connect = tk.Button(
            conn_box,
            text="Connect",
            font=("Segoe UI", 9, "bold"),
            bg=ACCENT_BLUE,
            fg="#ffffff",
            activebackground="#2563eb",
            activeforeground="#ffffff",
            relief="flat",
            padx=14,
            pady=3,
            cursor="hand2",
            command=self.toggle_connection
        )
        self.btn_connect.pack(side=tk.LEFT)

    def _build_system_cards(self):
        cards_container = tk.Frame(self, bg=BG_DARK, padx=16, pady=4)
        cards_container.pack(fill=tk.X)

        self.card_cpu = self._create_metric_card(cards_container, "CPU Utilization", "0.0%", ACCENT_BLUE)
        self.card_mem = self._create_metric_card(cards_container, "Memory Usage", "0.0 GB / 0.0 GB (0%)", ACCENT_GREEN)
        self.card_disk = self._create_metric_card(cards_container, "Disk (C:)", "0.0 GB / 0.0 GB (0%)", ACCENT_YELLOW)
        self.card_host = self._create_metric_card(cards_container, "Remote Host", "Not Connected", TEXT_SECONDARY)

        self.card_cpu["frame"].pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=4)
        self.card_mem["frame"].pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=4)
        self.card_disk["frame"].pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=4)
        self.card_host["frame"].pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=4)

    def _create_metric_card(self, parent, title, initial_val, color):
        f = tk.Frame(parent, bg=BG_CARD, highlightbackground=BORDER_COLOR, highlightthickness=1, padx=12, pady=10)
        lbl_title = tk.Label(f, text=title, font=("Segoe UI", 9), fg=TEXT_SECONDARY, bg=BG_CARD)
        lbl_title.pack(anchor="w")

        lbl_val = tk.Label(f, text=initial_val, font=("Segoe UI", 12, "bold"), fg=color, bg=BG_CARD)
        lbl_val.pack(anchor="w", pady=(2, 4))

        pbar = ttk.Progressbar(f, orient="horizontal", mode="determinate", length=100)
        pbar.pack(fill=tk.X, expand=True)

        return {"frame": f, "title": lbl_title, "value": lbl_val, "progress": pbar, "color": color}

    def _build_nav_and_tabs(self):
        nav_container = tk.Frame(self, bg=BG_DARK, padx=16, pady=6)
        nav_container.pack(fill=tk.BOTH, expand=True)

        self.notebook = ttk.Notebook(nav_container)
        self.notebook.pack(fill=tk.BOTH, expand=True)

        # Tab 1: Task Manager
        self.tab_tasks = tk.Frame(self.notebook, bg=BG_DARK)
        self.notebook.add(self.tab_tasks, text="  ⚡ Task Manager  ")
        self._build_task_manager_tab(self.tab_tasks)

        # Tab 2: File Transfer (with Drop Zone & Target Selection)
        self.tab_files = tk.Frame(self.notebook, bg=BG_DARK)
        self.notebook.add(self.tab_files, text="  📁 File Transfer  ")
        self._build_file_transfer_tab(self.tab_files)

        # Tab 3: Media & Display Control (Fullscreen Video & Black Screen)
        self.tab_media = tk.Frame(self.notebook, bg=BG_DARK)
        self.notebook.add(self.tab_media, text="  🎬 Media & Display  ")
        self._build_media_display_tab(self.tab_media)

        # Tab 4: Live Camera Stream
        self.tab_camera = tk.Frame(self.notebook, bg=BG_DARK)
        self.notebook.add(self.tab_camera, text="  📹 Live Camera  ")
        self._build_camera_tab(self.tab_camera)

    # -----------------------------
    # TAB 1: Task Manager
    # -----------------------------
    def _build_task_manager_tab(self, parent):
        bar = tk.Frame(parent, bg=BG_DARK, pady=8)
        bar.pack(fill=tk.X)

        search_box = tk.Frame(bar, bg=BG_SURFACE, highlightbackground=BORDER_COLOR, highlightthickness=1)
        search_box.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 10))

        search_icon = tk.Label(search_box, text="🔍", font=("Segoe UI", 9), fg=TEXT_SECONDARY, bg=BG_SURFACE)
        search_icon.pack(side=tk.LEFT, padx=6)

        search_entry = tk.Entry(
            search_box,
            textvariable=self.search_query,
            font=("Segoe UI", 10),
            bg=BG_SURFACE,
            fg=TEXT_PRIMARY,
            insertbackground=TEXT_PRIMARY,
            relief="flat"
        )
        search_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, ipady=4)

        tk.Label(bar, text="Update Rate:", font=("Segoe UI", 9), fg=TEXT_SECONDARY, bg=BG_DARK).pack(side=tk.LEFT, padx=(4, 4))
        self.refresh_combo = ttk.Combobox(
            bar,
            values=["1 sec", "2 sec", "3 sec", "5 sec", "Paused"],
            state="readonly",
            width=8
        )
        self.refresh_combo.current(1)
        self.refresh_combo.bind("<<ComboboxSelected>>", self._on_interval_change)
        self.refresh_combo.pack(side=tk.LEFT, padx=(0, 8))

        self.btn_run_task = tk.Button(
            bar,
            text="+ Run Task",
            font=("Segoe UI", 9),
            bg=BG_SURFACE,
            fg=TEXT_PRIMARY,
            activebackground=BORDER_COLOR,
            activeforeground=TEXT_PRIMARY,
            relief="flat",
            padx=10,
            pady=3,
            cursor="hand2",
            command=self.show_run_dialog
        )
        self.btn_run_task.pack(side=tk.LEFT, padx=3)

        self.btn_kill = tk.Button(
            bar,
            text="End Task",
            font=("Segoe UI", 9, "bold"),
            bg=ACCENT_RED,
            fg="#ffffff",
            activebackground="#dc2626",
            activeforeground="#ffffff",
            relief="flat",
            padx=12,
            pady=3,
            cursor="hand2",
            command=lambda: self.kill_selected_process(force=False)
        )
        self.btn_kill.pack(side=tk.LEFT, padx=3)

        # Process Table
        tbl_container = tk.Frame(parent, bg=BG_DARK)
        tbl_container.pack(fill=tk.BOTH, expand=True, pady=(4, 0))

        columns = ("pid", "name", "cpu_percent", "memory_mb", "memory_percent", "status", "user")
        self.tree = ttk.Treeview(
            tbl_container,
            columns=columns,
            show="headings",
            selectmode="browse"
        )

        col_configs = [
            ("pid", "PID", 80, "center"),
            ("name", "Process Name", 260, "w"),
            ("cpu_percent", "CPU %", 90, "e"),
            ("memory_mb", "Memory (MB)", 110, "e"),
            ("memory_percent", "Memory %", 90, "e"),
            ("status", "Status", 90, "center"),
            ("user", "User / Owner", 160, "w"),
        ]

        for col_id, col_name, width, anchor in col_configs:
            self.tree.heading(
                col_id,
                text=col_name,
                anchor=anchor,
                command=lambda c=col_id: self.on_header_click(c)
            )
            self.tree.column(col_id, width=width, anchor=anchor)

        scrollbar = ttk.Scrollbar(tbl_container, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar.set)

        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        self.tree.bind("<<TreeviewSelect>>", self._on_tree_select)
        self.tree.bind("<Button-3>", self._on_tree_right_click)
        self.tree.bind("<Double-1>", lambda event: self.kill_selected_process(force=False))

    # -----------------------------
    # TAB 2: File Transfer (Drag & Drop / Target Folder)
    # -----------------------------
    def _build_file_transfer_tab(self, parent):
        container = tk.Frame(parent, bg=BG_DARK, padx=20, pady=16)
        container.pack(fill=tk.BOTH, expand=True)

        # Instructions banner
        header_lbl = tk.Label(
            container,
            text="Send Files to Server (192.168.50.148)",
            font=("Segoe UI", 12, "bold"),
            fg=TEXT_PRIMARY,
            bg=BG_DARK
        )
        header_lbl.pack(anchor="w")

        sub_lbl = tk.Label(
            container,
            text="Choose where to put the file on the server, select or drag & drop a file, and transfer instantly.",
            font=("Segoe UI", 9),
            fg=TEXT_SECONDARY,
            bg=BG_DARK
        )
        sub_lbl.pack(anchor="w", pady=(2, 16))

        # Target folder selector on server
        dest_card = tk.Frame(container, bg=BG_CARD, highlightbackground=BORDER_COLOR, highlightthickness=1, padx=16, pady=12)
        dest_card.pack(fill=tk.X, pady=(0, 16))

        tk.Label(dest_card, text="1. Destination on Server (192.168.50.148):", font=("Segoe UI", 10, "bold"), fg=TEXT_PRIMARY, bg=BG_CARD).pack(anchor="w", pady=(0, 6))

        dest_row = tk.Frame(dest_card, bg=BG_CARD)
        dest_row.pack(fill=tk.X)

        rb1 = tk.Radiobutton(
            dest_row,
            text="Direct Server Path (Saved locations or browse server directory):",
            variable=self.dest_mode_var,
            value="direct",
            font=("Segoe UI", 9, "bold"),
            fg=TEXT_PRIMARY,
            bg=BG_CARD,
            activebackground=BG_CARD,
            activeforeground=TEXT_PRIMARY,
            selectcolor=BG_SURFACE
        )
        rb1.pack(anchor="w")

        folder_input_row = tk.Frame(dest_row, bg=BG_CARD)
        folder_input_row.pack(fill=tk.X, padx=(24, 0), pady=(4, 6))

        self.preset_combo = ttk.Combobox(
            folder_input_row,
            values=self.saved_destinations,
            textvariable=self.server_dest_dir,
            width=36,
            font=("Segoe UI", 9)
        )
        self.preset_combo.pack(side=tk.LEFT, ipady=3)

        btn_browse_server = tk.Button(
            folder_input_row,
            text="🌐 Browse Server...",
            font=("Segoe UI", 9, "bold"),
            bg=ACCENT_BLUE,
            fg="#ffffff",
            activebackground="#2563eb",
            activeforeground="#ffffff",
            relief="flat",
            padx=10,
            pady=3,
            cursor="hand2",
            command=self.open_server_folder_browser
        )
        btn_browse_server.pack(side=tk.LEFT, padx=6)

        btn_save_loc = tk.Button(
            folder_input_row,
            text="⭐ Save Location",
            font=("Segoe UI", 8),
            bg=BG_SURFACE,
            fg=TEXT_PRIMARY,
            activebackground=BORDER_COLOR,
            activeforeground=TEXT_PRIMARY,
            relief="flat",
            padx=8,
            pady=3,
            cursor="hand2",
            command=self.save_current_destination
        )
        btn_save_loc.pack(side=tk.LEFT, padx=3)

        btn_del_loc = tk.Button(
            folder_input_row,
            text="🗑️ Remove",
            font=("Segoe UI", 8),
            bg=BG_SURFACE,
            fg=ACCENT_RED,
            activebackground=BORDER_COLOR,
            activeforeground=ACCENT_RED,
            relief="flat",
            padx=8,
            pady=3,
            cursor="hand2",
            command=self.remove_current_destination
        )
        btn_del_loc.pack(side=tk.LEFT, padx=3)

        rb2 = tk.Radiobutton(
            dest_row,
            text="Ask on Server Screen (Opens Explorer 'Save As' window on the remote machine)",
            variable=self.dest_mode_var,
            value="prompt",
            font=("Segoe UI", 9),
            fg=TEXT_SECONDARY,
            bg=BG_CARD,
            activebackground=BG_CARD,
            activeforeground=TEXT_PRIMARY,
            selectcolor=BG_SURFACE
        )
        rb2.pack(anchor="w", pady=(4, 0))

        # Drag and Drop / File Selection Zone
        file_card = tk.Frame(container, bg=BG_CARD, highlightbackground=BORDER_COLOR, highlightthickness=1, padx=16, pady=16)
        file_card.pack(fill=tk.BOTH, expand=True)

        tk.Label(file_card, text="2. Select File to Send:", font=("Segoe UI", 10, "bold"), fg=TEXT_PRIMARY, bg=BG_CARD).pack(anchor="w", pady=(0, 8))

        # Big clickable & drop-friendly target box
        self.drop_box = tk.Label(
            file_card,
            text="📂 CLICK HERE TO BROWSE FILE\n\n(Or Drag & Drop file directly into this box)",
            font=("Segoe UI", 11, "bold"),
            fg=ACCENT_PURPLE,
            bg=BG_SURFACE,
            highlightbackground=ACCENT_PURPLE,
            highlightthickness=2,
            relief="flat",
            cursor="hand2",
            padx=20,
            pady=36
        )
        self.drop_box.pack(fill=tk.BOTH, expand=True, pady=6)
        self.drop_box.bind("<Button-1>", lambda e: self.browse_local_file())
        if HAS_DND:
            for w in (self, container, file_card, self.drop_box):
                try:
                    w.drop_target_register(DND_FILES)
                    w.dnd_bind("<<Drop>>", self._on_file_dropped)
                except Exception:
                    pass

        # Selected file display
        sel_row = tk.Frame(file_card, bg=BG_CARD)
        sel_row.pack(fill=tk.X, pady=8)

        tk.Label(sel_row, text="Selected File:", font=("Segoe UI", 9, "bold"), fg=TEXT_SECONDARY, bg=BG_CARD).pack(side=tk.LEFT)
        self.lbl_selected_file = tk.Label(sel_row, textvariable=self.selected_file_path, font=("Segoe UI", 9), fg=ACCENT_GREEN, bg=BG_CARD)
        self.lbl_selected_file.pack(side=tk.LEFT, padx=8)

        # Send Button
        btn_row = tk.Frame(file_card, bg=BG_CARD)
        btn_row.pack(fill=tk.X, pady=(8, 0))

        self.btn_start_upload = tk.Button(
            btn_row,
            text="🚀 Send File to Server Now",
            font=("Segoe UI", 10, "bold"),
            bg=ACCENT_PURPLE,
            fg="#ffffff",
            activebackground="#7c3aed",
            activeforeground="#ffffff",
            relief="flat",
            padx=20,
            pady=6,
            cursor="hand2",
            command=self.execute_file_upload
        )
        self.btn_start_upload.pack(side=tk.RIGHT)

    def browse_local_file(self):
        f = filedialog.askopenfilename(title="Select File to Transfer", parent=self)
        if f:
            f = os.path.normpath(f.strip().strip('"\''))
            self.selected_file_path.set(f)
            sz = os.path.getsize(f)
            sz_str = f"{round(sz / 1024, 1)} KB" if sz < 1024*1024 else f"{round(sz / (1024*1024), 2)} MB"
            self.drop_box.configure(
                text=f"✅ FILE READY TO SEND:\n\n{os.path.basename(f)}\n({sz_str})\n\nClick '🚀 Send File to Server Now' below",
                fg=ACCENT_GREEN
            )
            self.status_text.set(f"Selected file: {os.path.basename(f)} ({sz_str})")

    def execute_file_upload(self):
        if not self.is_connected:
            messagebox.showwarning("Not Connected", "Please connect to the remote server first.", parent=self)
            return

        file_path = self.selected_file_path.get().strip().strip('"\'')
        if not file_path or not os.path.exists(file_path):
            messagebox.showinfo("No File Selected", "Please select or drop a file to send first.", parent=self)
            return

        filename = os.path.basename(file_path)
        try:
            file_size = os.path.getsize(file_path)
            sz_str = f"{round(file_size / 1024, 1)} KB" if file_size < 1024*1024 else f"{round(file_size / (1024*1024), 2)} MB"
        except Exception:
            sz_str = ""

        ip = self.server_ip.get().strip()
        port = self.server_port.get().strip()
        url = f"http://{ip}:{port}/api/upload"

        is_prompt = (self.dest_mode_var.get() == "prompt")
        target_dir = self.server_dest_dir.get().strip() if not is_prompt else None

        self.status_text.set(f"Preparing '{filename}' ({sz_str})...")
        self.btn_start_upload.configure(state="disabled", text="Uploading...")

        def _worker():
            try:
                self.after(0, lambda: self.status_text.set(f"Reading '{filename}' ({sz_str})..."))
                with open(file_path, "rb") as f:
                    raw_bytes = f.read()

                self.after(0, lambda: self.status_text.set(f"Encoding '{filename}'..."))
                b64_str = base64.b64encode(raw_bytes).decode("utf-8")

                payload = {
                    "filename": filename,
                    "data": b64_str,
                    "prompt_on_server": is_prompt
                }
                if target_dir:
                    payload["target_dir"] = target_dir

                payload_bytes = json.dumps(payload).encode("utf-8")

                self.after(0, lambda: self.status_text.set(f"Sending '{filename}' ({sz_str}) to server..."))
                req = urllib.request.Request(
                    url,
                    data=payload_bytes,
                    headers={"Content-Type": "application/json"}
                )
                with urllib.request.urlopen(req, timeout=180) as resp:
                    res = json.loads(resp.read().decode("utf-8"))
                    saved = res.get("saved_path", "")
                    self.after(0, lambda: messagebox.showinfo(
                        "Transfer Complete",
                        f"File '{filename}' successfully placed on server at:\n\n{saved}",
                        parent=self
                    ))
                    self.after(0, lambda: self.status_text.set(f"File transferred: {saved}"))
            except urllib.error.HTTPError as he:
                try:
                    err_body = json.loads(he.read().decode("utf-8"))
                    err_msg = err_body.get("error", str(he))
                except Exception:
                    err_msg = str(he)
                self.after(0, lambda m=err_msg: messagebox.showerror("Transfer Failed", f"Server error: {m}", parent=self))
                self.after(0, lambda m=err_msg: self.status_text.set(f"Upload failed: {m}"))
            except Exception as e:
                self.after(0, lambda err=str(e): messagebox.showerror("Transfer Failed", f"Failed: {err}", parent=self))
                self.after(0, lambda err=str(e): self.status_text.set(f"Upload failed: {err}"))
            finally:
                self.after(0, lambda: self.btn_start_upload.configure(state="normal", text="🚀 Send File to Server Now"))

        threading.Thread(target=_worker, daemon=True).start()

    # -----------------------------
    # TAB 3: Media & Display Control
    # -----------------------------
    def _build_media_display_tab(self, parent):
        container = tk.Frame(parent, bg=BG_DARK, padx=20, pady=16)
        container.pack(fill=tk.BOTH, expand=True)

        header_lbl = tk.Label(
            container,
            text="Media Playback & Display Controls",
            font=("Segoe UI", 12, "bold"),
            fg=TEXT_PRIMARY,
            bg=BG_DARK
        )
        header_lbl.pack(anchor="w")

        sub_lbl = tk.Label(
            container,
            text="Control the remote display on 192.168.50.148. Play videos in fullscreen or trigger a privacy black screen.",
            font=("Segoe UI", 9),
            fg=TEXT_SECONDARY,
            bg=BG_DARK
        )
        sub_lbl.pack(anchor="w", pady=(2, 16))

        # Card 1: Black Out Screen
        black_card = tk.Frame(container, bg=BG_CARD, highlightbackground=BORDER_COLOR, highlightthickness=1, padx=16, pady=16)
        black_card.pack(fill=tk.X, pady=(0, 16))

        tk.Label(black_card, text="⬛ Privacy Black Screen", font=("Segoe UI", 10, "bold"), fg=TEXT_PRIMARY, bg=BG_CARD).pack(anchor="w")
        tk.Label(
            black_card,
            text="Covers the remote monitor completely in black.\n(Escape and double-click are disabled on server; dismissed via client or by pressing 'Z' on server keyboard).",
            font=("Segoe UI", 9),
            fg=TEXT_SECONDARY,
            bg=BG_CARD,
            justify=tk.LEFT
        ).pack(anchor="w", pady=(2, 10))

        self.btn_black_screen = tk.Button(
            black_card,
            text="Turn ON Black Screen",
            font=("Segoe UI", 9, "bold"),
            bg="#27272a",
            fg="#ffffff",
            activebackground="#3f3f46",
            activeforeground="#ffffff",
            relief="flat",
            padx=16,
            pady=5,
            cursor="hand2",
            command=self.toggle_blank_screen
        )
        self.btn_black_screen.pack(anchor="w")

        # Card 2: Fullscreen Video Player
        video_card = tk.Frame(container, bg=BG_CARD, highlightbackground=BORDER_COLOR, highlightthickness=1, padx=16, pady=16)
        video_card.pack(fill=tk.BOTH, expand=True)

        tk.Label(video_card, text="🎬 Fullscreen Video Player", font=("Segoe UI", 10, "bold"), fg=TEXT_PRIMARY, bg=BG_CARD).pack(anchor="w")
        tk.Label(
            video_card,
            text="Play a video on the remote server in fullscreen. Dismissable remotely via the client Stop button or by pressing 'Z' on the server.",
            font=("Segoe UI", 9),
            fg=TEXT_SECONDARY,
            bg=BG_CARD
        ).pack(anchor="w", pady=(2, 10))

        # Video source options
        self.video_source_mode = tk.StringVar(value="upload")

        v_row1 = tk.Frame(video_card, bg=BG_CARD)
        v_row1.pack(fill=tk.X, pady=4)

        tk.Radiobutton(
            v_row1,
            text="Select video file from client PC to stream to server:",
            variable=self.video_source_mode,
            value="upload",
            font=("Segoe UI", 9),
            fg=TEXT_PRIMARY,
            bg=BG_CARD,
            activebackground=BG_CARD,
            activeforeground=TEXT_PRIMARY,
            selectcolor=BG_SURFACE
        ).pack(side=tk.LEFT)

        self.local_video_path = tk.StringVar()
        btn_browse_vid = tk.Button(
            v_row1,
            text="Browse Video...",
            font=("Segoe UI", 8),
            bg=BG_SURFACE,
            fg=TEXT_PRIMARY,
            relief="flat",
            padx=8,
            pady=2,
            cursor="hand2",
            command=self.browse_local_video
        )
        btn_browse_vid.pack(side=tk.LEFT, padx=8)

        self.lbl_video_name = tk.Label(v_row1, textvariable=self.local_video_path, font=("Segoe UI", 8), fg=ACCENT_BLUE, bg=BG_CARD)
        self.lbl_video_name.pack(side=tk.LEFT)

        # Video controls
        v_btn_row = tk.Frame(video_card, bg=BG_CARD)
        v_btn_row.pack(fill=tk.X, pady=(16, 0))

        self.btn_play_video = tk.Button(
            v_btn_row,
            text="▶ Play Video on Fullscreen",
            font=("Segoe UI", 9, "bold"),
            bg=ACCENT_GREEN,
            fg="#ffffff",
            activebackground="#059669",
            activeforeground="#ffffff",
            relief="flat",
            padx=16,
            pady=5,
            cursor="hand2",
            command=self.play_remote_video
        )
        self.btn_play_video.pack(side=tk.LEFT, padx=(0, 10))

        self.btn_stop_video = tk.Button(
            v_btn_row,
            text="⏹ Stop Video from Client",
            font=("Segoe UI", 9, "bold"),
            bg=ACCENT_RED,
            fg="#ffffff",
            activebackground="#dc2626",
            activeforeground="#ffffff",
            relief="flat",
            padx=16,
            pady=5,
            cursor="hand2",
            command=self.stop_remote_video
        )
        self.btn_stop_video.pack(side=tk.LEFT)

        self.btn_gesture_toggle = tk.Button(
            v_btn_row,
            text="🖕 Gesture: Middle Finger -> Sad Face (ON)",
            font=("Segoe UI", 9, "bold"),
            bg="#2563eb",
            fg="#ffffff",
            activebackground="#1d4ed8",
            activeforeground="#ffffff",
            relief="flat",
            padx=14,
            pady=5,
            cursor="hand2",
            command=self.toggle_remote_gesture
        )
        self.btn_gesture_toggle.pack(side=tk.LEFT, padx=(10, 0))

        tk.Label(v_btn_row, text="Sens:", font=("Segoe UI", 9), fg=TEXT_SECONDARY, bg=BG_CARD).pack(side=tk.LEFT, padx=(12, 2))
        self.scale_media_sens = ttk.Scale(
            v_btn_row,
            from_=1, to=100,
            orient="horizontal",
            length=80,
            variable=self.gesture_sensitivity,
            command=self._on_sensitivity_slider_change
        )
        self.scale_media_sens.pack(side=tk.LEFT, padx=(0, 4))
        self.lbl_media_sens_val = tk.Label(
            v_btn_row,
            text=self._get_sensitivity_label_text(self.gesture_sensitivity.get()),
            font=("Segoe UI", 8, "bold"),
            fg=ACCENT_BLUE,
            bg=BG_CARD,
            width=13
        )
        self.lbl_media_sens_val.pack(side=tk.LEFT)

        # Power Controls
        power_row = tk.Frame(v_btn_row, bg=BG_CARD)
        power_row.pack(side=tk.LEFT, padx=(16, 0))

        tk.Button(
            power_row,
            text="💤 Sleep",
            font=("Segoe UI", 9, "bold"),
            bg="#7c3aed",
            fg="#ffffff",
            activebackground="#6d28d9",
            activeforeground="#ffffff",
            relief="flat",
            padx=10,
            pady=5,
            cursor="hand2",
            command=self.remote_sleep
        ).pack(side=tk.LEFT, padx=(0, 4))

        tk.Button(
            power_row,
            text="⚡ Wake",
            font=("Segoe UI", 9, "bold"),
            bg="#065f46",
            fg="#ffffff",
            activebackground="#047857",
            activeforeground="#ffffff",
            relief="flat",
            padx=10,
            pady=5,
            cursor="hand2",
            command=self.remote_wake
        ).pack(side=tk.LEFT)

    def browse_local_video(self):
        f = filedialog.askopenfilename(
            title="Select Video File",
            filetypes=[("Video Files", "*.mp4 *.avi *.mkv *.mov *.wmv *.webm"), ("All Files", "*.*")],
            parent=self
        )
        if f:
            self.local_video_path.set(f)

    def play_remote_video(self):
        if not self.is_connected:
            messagebox.showwarning("Not Connected", "Please connect to the remote server first.")
            return

        v_path = self.local_video_path.get().strip()
        if not v_path or not os.path.exists(v_path):
            messagebox.showinfo("No Video Selected", "Please select a video file first.")
            return

        filename = os.path.basename(v_path)
        try:
            with open(v_path, "rb") as f:
                raw_bytes = f.read()
        except Exception as e:
            messagebox.showerror("Error", f"Failed to read video: {e}")
            return

        b64_str = base64.b64encode(raw_bytes).decode("utf-8")
        ip = self.server_ip.get().strip()
        port = self.server_port.get().strip()
        url = f"http://{ip}:{port}/api/video"

        payload = json.dumps({"action": "play", "filename": filename, "data": b64_str}).encode("utf-8")
        self.status_text.set(f"Streaming video '{filename}' to server...")

        def _worker():
            try:
                req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
                with urllib.request.urlopen(req, timeout=300) as resp:
                    res = json.loads(resp.read().decode("utf-8"))
                    self.is_video_playing = True
                    self.after(0, lambda: messagebox.showinfo("Playing", f"Fullscreen video '{filename}' is now playing on the server!"))
                    self.after(0, lambda: self.status_text.set("Video playing on server"))
            except Exception as e:
                self.after(0, lambda: self.status_text.set(f"Video play error: {e}"))
                self.after(0, lambda: messagebox.showerror("Video Error", f"Failed to play video on server: {e}"))

        threading.Thread(target=_worker, daemon=True).start()

    def stop_remote_video(self):
        if not self.is_connected:
            messagebox.showwarning("Not Connected", "Please connect to the remote server first.")
            return

        ip = self.server_ip.get().strip()
        port = self.server_port.get().strip()
        url = f"http://{ip}:{port}/api/video"
        payload = json.dumps({"action": "stop"}).encode("utf-8")

        def _worker():
            try:
                req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
                with urllib.request.urlopen(req, timeout=5) as resp:
                    self.is_video_playing = False
                    self.after(0, lambda: messagebox.showinfo("Stopped", "Remote fullscreen video stopped."))
                    self.after(0, lambda: self.status_text.set("Video stopped on server"))
            except Exception as e:
                self.after(0, lambda: messagebox.showerror("Error", f"Could not stop video: {e}"))

        threading.Thread(target=_worker, daemon=True).start()

    def toggle_blank_screen(self):
        if not self.is_connected:
            messagebox.showwarning("Not Connected", "Please connect to the remote server first.")
            return

        target_state = not self.is_screen_blanked
        ip = self.server_ip.get().strip()
        port = self.server_port.get().strip()
        url = f"http://{ip}:{port}/api/blank"
        payload = json.dumps({"enable": target_state}).encode("utf-8")

        def _worker():
            try:
                req = urllib.request.Request(
                    url,
                    data=payload,
                    headers={"Content-Type": "application/json"}
                )
                with urllib.request.urlopen(req, timeout=5) as resp:
                    res = json.loads(resp.read().decode("utf-8"))
                    blanked = res.get("blanked", target_state)
                    self.after(0, lambda: self._update_blank_button(blanked))
            except Exception as e:
                self.after(0, lambda: messagebox.showerror("Screen Error", f"Failed to toggle screen: {e}"))

        threading.Thread(target=_worker, daemon=True).start()

    def _update_blank_button(self, is_blanked):
        self.is_screen_blanked = is_blanked
        if is_blanked:
            self.btn_black_screen.configure(
                text="Turn OFF Black Screen",
                bg="#b45309",
                fg="#fef3c7"
            )
            self.status_text.set("Remote screen is currently BLACKED OUT")
        else:
            self.btn_black_screen.configure(
                text="Turn ON Black Screen",
                bg="#27272a",
                fg="#ffffff"
            )

    def toggle_remote_gesture(self):
        if not self.is_connected:
            messagebox.showwarning("Not Connected", "Please connect to the remote server first.")
            return

        current_state = getattr(self, "gesture_enabled", True)
        target_state = not current_state
        ip = self.server_ip.get().strip()
        port = self.server_port.get().strip()
        url = f"http://{ip}:{port}/api/gesture"
        payload = json.dumps({"enable": target_state}).encode("utf-8")

        def _worker():
            try:
                req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
                with urllib.request.urlopen(req, timeout=5) as resp:
                    res = json.loads(resp.read().decode("utf-8"))
                    enabled = res.get("gesture_enabled", target_state)
                    self.after(0, lambda: self._update_gesture_button(enabled))
            except Exception as e:
                self.after(0, lambda: messagebox.showerror("Gesture Error", f"Failed to toggle gesture reaction: {e}"))

        threading.Thread(target=_worker, daemon=True).start()

    def _update_gesture_button(self, enabled):
        self.gesture_enabled = enabled
        text = "🖕 Gesture: Middle Finger -> Sad Face (ON)" if enabled else "🖕 Gesture: Middle Finger -> Sad Face (OFF)"
        bg = "#2563eb" if enabled else "#4b5563"
        if hasattr(self, "btn_gesture_toggle"):
            self.btn_gesture_toggle.configure(text=text, bg=bg)
        if hasattr(self, "btn_cam_gesture_toggle"):
            self.btn_cam_gesture_toggle.configure(text=text, bg=bg)

    def remote_sleep(self):
        if not self.is_connected:
            messagebox.showwarning("Not Connected", "Please connect to the remote server first.")
            return
        if not messagebox.askyesno("Remote Sleep", f"Put {self.server_ip.get().strip()} to sleep?\n\nYou can wake it later using the ⚡ Wake button."):
            return
        ip = self.server_ip.get().strip()
        port = self.server_port.get().strip()
        url = f"http://{ip}:{port}/api/power"
        payload = json.dumps({"action": "sleep"}).encode("utf-8")

        def _worker():
            try:
                req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
                with urllib.request.urlopen(req, timeout=5) as resp:
                    res = json.loads(resp.read().decode("utf-8"))
                    self.after(0, lambda: self.status_text.set(f"Server sleeping... ({res.get('message', 'Sleep sent')})"))
            except Exception:
                # Server may disconnect before responding — that's expected for sleep
                self.after(0, lambda: self.status_text.set("Sleep command sent (server may be offline now)"))

        threading.Thread(target=_worker, daemon=True).start()

    def remote_wake(self):
        mac = self.server_mac
        if not mac:
            ip_str = self.server_ip.get().strip()
            mac = simpledialog.askstring(
                "Wake-on-LAN",
                f"No MAC address stored for {ip_str}.\nEnter server MAC address (e.g. AA:BB:CC:DD:EE:FF):",
                parent=self
            )
            if not mac:
                return
            self.server_mac = mac.strip()

        def _send_wol(mac_str):
            try:
                import socket as _sock
                # Build magic packet: 6x 0xFF + 16x MAC bytes
                mac_clean = mac_str.replace(":", "").replace("-", "").upper()
                if len(mac_clean) != 12:
                    raise ValueError(f"Invalid MAC: {mac_str}")
                mac_bytes = bytes.fromhex(mac_clean)
                magic = b'\xff' * 6 + mac_bytes * 16
                # Broadcast on port 9 (standard WoL)
                with _sock.socket(_sock.AF_INET, _sock.SOCK_DGRAM) as s:
                    s.setsockopt(_sock.SOL_SOCKET, _sock.SO_BROADCAST, 1)
                    s.sendto(magic, ('<broadcast>', 9))
                    s.sendto(magic, ('<broadcast>', 7))
                self.after(0, lambda: self.status_text.set(f"⚡ Wake-on-LAN sent to {mac_str}"))
            except Exception as e:
                self.after(0, lambda: messagebox.showerror("Wake Failed", f"Could not send Wake-on-LAN packet:\n{e}"))

        threading.Thread(target=_send_wol, args=(self.server_mac,), daemon=True).start()

    # -----------------------------
    # TAB 4: Live Camera Stream
    # -----------------------------
    def _build_camera_tab(self, parent):
        container = tk.Frame(parent, bg=BG_DARK, padx=20, pady=14)
        container.pack(fill=tk.BOTH, expand=True)

        header_row = tk.Frame(container, bg=BG_DARK)
        header_row.pack(fill=tk.X, pady=(0, 10))

        title_box = tk.Frame(header_row, bg=BG_DARK)
        title_box.pack(side=tk.LEFT)

        tk.Label(
            title_box,
            text="📹 Remote Live Camera Stream",
            font=("Segoe UI", 12, "bold"),
            fg=TEXT_PRIMARY,
            bg=BG_DARK
        ).pack(anchor="w")

        tk.Label(
            title_box,
            text="Real-time video feed streamed from host camera with gesture detection.",
            font=("Segoe UI", 9),
            fg=TEXT_SECONDARY,
            bg=BG_DARK
        ).pack(anchor="w", pady=(2, 0))

        self.lbl_client_cam_badge = tk.Label(
            header_row,
            text="⏹ STREAM STOPPED",
            font=("Segoe UI", 9, "bold"),
            fg=TEXT_SECONDARY,
            bg=BG_CARD,
            padx=12,
            pady=4,
            relief="flat"
        )
        self.lbl_client_cam_badge.pack(side=tk.RIGHT)

        # Center Video Canvas inside Card
        vid_card = tk.Frame(container, bg=BG_CARD, highlightbackground=BORDER_COLOR, highlightthickness=1)
        vid_card.pack(fill=tk.BOTH, expand=True, pady=(0, 12))

        self.cam_canvas = tk.Canvas(vid_card, bg="#0b0f19", highlightthickness=0)
        self.cam_canvas.pack(fill=tk.BOTH, expand=True, padx=4, pady=4)
        self.cam_canvas.bind("<Configure>", self._on_cam_canvas_resize)

        self._draw_cam_canvas_placeholder("Remote Camera Stream is Paused\n\nClick '▶ Start Live Stream' below to view feed.")

        # Bottom Control Card
        ctrl_card = tk.Frame(container, bg=BG_CARD, highlightbackground=BORDER_COLOR, highlightthickness=1, padx=14, pady=10)
        ctrl_card.pack(fill=tk.X)

        self.btn_cam_stream_toggle = tk.Button(
            ctrl_card,
            text="▶ Start Live Stream",
            font=("Segoe UI", 9, "bold"),
            bg=ACCENT_GREEN,
            fg="#ffffff",
            activebackground="#059669",
            activeforeground="#ffffff",
            relief="flat",
            padx=18,
            pady=6,
            cursor="hand2",
            command=self.toggle_camera_stream
        )
        self.btn_cam_stream_toggle.pack(side=tk.LEFT, padx=(0, 10))

        self.btn_cam_snapshot = tk.Button(
            ctrl_card,
            text="📸 Save Snapshot",
            font=("Segoe UI", 9),
            bg=BG_SURFACE,
            fg=TEXT_PRIMARY,
            relief="flat",
            padx=12,
            pady=6,
            cursor="hand2",
            command=self.take_camera_snapshot
        )
        self.btn_cam_snapshot.pack(side=tk.LEFT, padx=(0, 14))

        tk.Label(ctrl_card, text="Framerate:", font=("Segoe UI", 9), fg=TEXT_SECONDARY, bg=BG_CARD).pack(side=tk.LEFT, padx=(0, 6))
        self.cam_fps_combo = ttk.Combobox(
            ctrl_card,
            values=["Smooth (30 FPS)", "Standard (15 FPS)", "Eco (5 FPS)"],
            state="readonly",
            width=16
        )
        self.cam_fps_combo.current(0)
        self.cam_fps_combo.bind("<<ComboboxSelected>>", self._on_cam_framerate_change)
        self.cam_fps_combo.pack(side=tk.LEFT, padx=(0, 14))

        tk.Label(ctrl_card, text="Sens:", font=("Segoe UI", 9), fg=TEXT_SECONDARY, bg=BG_CARD).pack(side=tk.LEFT, padx=(4, 2))
        self.scale_cam_sens = ttk.Scale(
            ctrl_card,
            from_=1, to=100,
            orient="horizontal",
            length=80,
            variable=self.gesture_sensitivity,
            command=self._on_sensitivity_slider_change
        )
        self.scale_cam_sens.pack(side=tk.LEFT, padx=(0, 4))
        self.lbl_client_sens_val = tk.Label(
            ctrl_card,
            text=self._get_sensitivity_label_text(self.gesture_sensitivity.get()),
            font=("Segoe UI", 8, "bold"),
            fg=ACCENT_BLUE,
            bg=BG_CARD,
            width=13
        )
        self.lbl_client_sens_val.pack(side=tk.LEFT, padx=(0, 10))

        self.btn_cam_gesture_toggle = tk.Button(
            ctrl_card,
            text="🖕 Gesture: Middle Finger -> Sad Face (ON)",
            font=("Segoe UI", 9, "bold"),
            bg="#2563eb",
            fg="#ffffff",
            activebackground="#1d4ed8",
            activeforeground="#ffffff",
            relief="flat",
            padx=12,
            pady=6,
            cursor="hand2",
            command=self.toggle_remote_gesture
        )
        self.btn_cam_gesture_toggle.pack(side=tk.RIGHT)

    def _get_sensitivity_label_text(self, val):
        ival = int(val)
        if ival < 35:
            desc = "Strict"
        elif ival < 75:
            desc = "Balanced"
        elif ival < 90:
            desc = "High"
        else:
            desc = "Ultra"
        return f"{ival}% [{desc}]"

    def _on_sensitivity_slider_change(self, val):
        ival = int(float(val))
        self._update_sensitivity_labels(ival)
        if hasattr(self, "_sens_update_timer") and self._sens_update_timer:
            try:
                self.after_cancel(self._sens_update_timer)
            except Exception:
                pass
        self._sens_update_timer = self.after(300, lambda: self.set_remote_sensitivity(ival))

    def _update_sensitivity_labels(self, ival):
        txt = self._get_sensitivity_label_text(ival)
        if hasattr(self, "lbl_client_sens_val") and self.lbl_client_sens_val:
            self.lbl_client_sens_val.configure(text=txt)
        if hasattr(self, "lbl_media_sens_val") and self.lbl_media_sens_val:
            self.lbl_media_sens_val.configure(text=txt)

    def set_remote_sensitivity(self, val):
        ival = int(val)
        self.save_config("gesture_sensitivity", ival)
        if not self.is_connected:
            return

        ip = self.server_ip.get().strip()
        port = self.server_port.get().strip()
        url = f"http://{ip}:{port}/api/gesture"
        payload = json.dumps({"sensitivity": ival}).encode("utf-8")

        def _worker():
            try:
                req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
                with urllib.request.urlopen(req, timeout=4) as resp:
                    pass
            except Exception:
                pass

        threading.Thread(target=_worker, daemon=True).start()

    def _draw_cam_canvas_placeholder(self, text):
        if not hasattr(self, "cam_canvas") or not self.cam_canvas:
            return
        self.cam_canvas.delete("all")
        self.cam_canvas_image_id = None
        cw = self.cam_canvas.winfo_width() or 640
        ch = self.cam_canvas.winfo_height() or 400
        self.cam_canvas.create_text(
            cw // 2, ch // 2,
            text=text,
            fill=TEXT_SECONDARY,
            font=("Segoe UI", 12),
            justify=tk.CENTER
        )

    def _on_cam_canvas_resize(self, event):
        if not self.is_streaming_camera:
            self._draw_cam_canvas_placeholder("Remote Camera Stream is Paused\n\nClick '▶ Start Live Stream' below to view feed.")

    def _on_cam_framerate_change(self, event=None):
        val = self.cam_fps_combo.get()
        if "30" in val:
            self.client_cam_target_delay = 0.033
        elif "15" in val:
            self.client_cam_target_delay = 0.066
        else:
            self.client_cam_target_delay = 0.2

    def toggle_camera_stream(self):
        if not self.is_connected:
            messagebox.showwarning("Not Connected", "Please connect to the remote server first.")
            return

        if not self.is_streaming_camera:
            self.start_camera_stream()
        else:
            self.stop_camera_stream()

    def start_camera_stream(self):
        self.is_streaming_camera = True
        self.btn_cam_stream_toggle.configure(text="⏹ Stop Live Stream", bg=ACCENT_RED, activebackground="#dc2626")
        self.lbl_client_cam_badge.configure(text="● CONNECTING...", fg=ACCENT_YELLOW)
        threading.Thread(target=self._camera_stream_worker, daemon=True).start()

    def stop_camera_stream(self):
        self.is_streaming_camera = False
        if hasattr(self, "btn_cam_stream_toggle") and self.btn_cam_stream_toggle:
            self.btn_cam_stream_toggle.configure(text="▶ Start Live Stream", bg=ACCENT_GREEN, activebackground="#059669")
        if hasattr(self, "lbl_client_cam_badge") and self.lbl_client_cam_badge:
            self.lbl_client_cam_badge.configure(text="⏹ STREAM STOPPED", fg=TEXT_SECONDARY)
        self._draw_cam_canvas_placeholder("Stream Stopped\nClick '▶ Start Live Stream' to resume feed.")

    def _camera_stream_worker(self):
        ip = self.server_ip.get().strip()
        port = self.server_port.get().strip()
        url = f"http://{ip}:{port}/api/cam_frame"

        fps_timer = time.time()
        fps_counter = 0

        while self.is_streaming_camera and self.is_connected:
            t0 = time.perf_counter()
            try:
                req = urllib.request.Request(url, headers={"Cache-Control": "no-cache"})
                with urllib.request.urlopen(req, timeout=3.0) as resp:
                    if resp.status == 200:
                        raw_jpg = resp.read()
                        self.latest_client_frame_bytes = raw_jpg
                        latency_ms = max(1, int((time.perf_counter() - t0) * 1000))

                        fps_counter += 1
                        now = time.time()
                        if now - fps_timer >= 1.0:
                            self.client_cam_fps = round(fps_counter / (now - fps_timer), 1)
                            fps_counter = 0
                            fps_timer = now

                        # Convert to PIL Image
                        img = Image.open(io.BytesIO(raw_jpg))
                        orig_w, orig_h = img.size

                        # Resize to fit canvas proportionally
                        cw = self.cam_canvas.winfo_width() or 640
                        ch = self.cam_canvas.winfo_height() or 400
                        scale = min(cw / orig_w, ch / orig_h)
                        new_w = max(2, int(orig_w * scale))
                        new_h = max(2, int(orig_h * scale))

                        img_resized = img.resize((new_w, new_h), Image.Resampling.BILINEAR)
                        photo = ImageTk.PhotoImage(image=img_resized)

                        def _render(p=photo, ow=orig_w, oh=orig_h, lat=latency_ms):
                            if not self.is_streaming_camera:
                                return
                            self.current_client_cam_photo = p
                            canv_w = self.cam_canvas.winfo_width() or 640
                            canv_h = self.cam_canvas.winfo_height() or 400
                            x = (canv_w - p.width()) // 2
                            y = (canv_h - p.height()) // 2

                            if self.cam_canvas_image_id is None:
                                self.cam_canvas.delete("all")
                                self.cam_canvas_image_id = self.cam_canvas.create_image(x, y, image=p, anchor="nw")
                            else:
                                self.cam_canvas.coords(self.cam_canvas_image_id, x, y)
                                self.cam_canvas.itemconfig(self.cam_canvas_image_id, image=p)

                            self.lbl_client_cam_badge.configure(
                                text=f"● LIVE • {ow}x{oh} • {self.client_cam_fps} FPS • Latency: {lat}ms",
                                fg=ACCENT_GREEN
                            )

                        self.after(0, _render)
            except Exception:
                time.sleep(0.4)

            elapsed = time.perf_counter() - t0
            target_delay = self.client_cam_target_delay
            sleep_t = max(0.005, target_delay - elapsed)
            time.sleep(sleep_t)

    def take_camera_snapshot(self):
        if not getattr(self, "latest_client_frame_bytes", None):
            messagebox.showinfo("Snapshot", "No camera frame received yet. Please start streaming first.", parent=self)
            return

        ts = int(time.time())
        default_name = f"remote_cam_snapshot_{ts}.jpg"
        downloads_dir = os.path.join(os.path.expanduser("~"), "Downloads")
        file_path = filedialog.asksaveasfilename(
            title="Save Camera Snapshot",
            initialdir=downloads_dir,
            initialfile=default_name,
            filetypes=[("JPEG Image", "*.jpg"), ("All Files", "*.*")],
            parent=self
        )
        if file_path:
            try:
                with open(file_path, "wb") as f:
                    f.write(self.latest_client_frame_bytes)
                messagebox.showinfo("Saved", f"Snapshot saved successfully to:\n\n{file_path}", parent=self)
            except Exception as e:
                messagebox.showerror("Error", f"Failed saving snapshot:\n{e}", parent=self)

    # -----------------------------
    # General / Tree / Sockets
    # -----------------------------
    def _build_status_bar(self):
        status_bar = tk.Frame(self, bg=BG_CARD, height=26, padx=16)
        status_bar.pack(fill=tk.X, side=tk.BOTTOM)

        self.lbl_status_icon = tk.Label(status_bar, text="●", font=("Segoe UI", 10), fg=ACCENT_RED, bg=BG_CARD)
        self.lbl_status_icon.pack(side=tk.LEFT)

        self.lbl_status_msg = tk.Label(status_bar, textvariable=self.status_text, font=("Segoe UI", 9), fg=TEXT_SECONDARY, bg=BG_CARD)
        self.lbl_status_msg.pack(side=tk.LEFT, padx=6)

        self.lbl_proc_count = tk.Label(status_bar, text="Processes: 0", font=("Segoe UI", 9), fg=TEXT_SECONDARY, bg=BG_CARD)
        self.lbl_proc_count.pack(side=tk.RIGHT)

    def _setup_context_menu(self):
        self.context_menu = tk.Menu(self, tearoff=0, bg=BG_CARD, fg=TEXT_PRIMARY, activebackground=ACCENT_BLUE, activeforeground="#ffffff")
        self.context_menu.add_command(label="End Task", command=lambda: self.kill_selected_process(force=False))
        self.context_menu.add_command(label="Force Kill", command=lambda: self.kill_selected_process(force=True))
        self.context_menu.add_separator()
        self.context_menu.add_command(label="Copy Process Name", command=self._copy_process_name)
        self.context_menu.add_command(label="Copy PID", command=self._copy_process_pid)

    def _on_tree_right_click(self, event):
        row_id = self.tree.identify_row(event.y)
        if row_id:
            self.tree.selection_set(row_id)
            self._on_tree_select(None)
            self.context_menu.post(event.x_root, event.y_root)

    def _copy_process_name(self):
        item = self.tree.selection()
        if item:
            val = self.tree.item(item[0], "values")
            if val and len(val) > 1:
                self.clipboard_clear()
                self.clipboard_append(str(val[1]))

    def _copy_process_pid(self):
        item = self.tree.selection()
        if item:
            val = self.tree.item(item[0], "values")
            if val and len(val) > 0:
                self.clipboard_clear()
                self.clipboard_append(str(val[0]))

    def _on_tree_select(self, event):
        selected = self.tree.selection()
        if selected:
            vals = self.tree.item(selected[0], "values")
            if vals and len(vals) > 0:
                try:
                    self.selected_pid = int(vals[0])
                except (ValueError, TypeError):
                    self.selected_pid = None
            else:
                self.selected_pid = None
        else:
            self.selected_pid = None

    def _on_interval_change(self, event):
        val = self.refresh_combo.get()
        mapping = {"1 sec": 1.0, "2 sec": 2.0, "3 sec": 3.0, "5 sec": 5.0, "Paused": 999999.0}
        self.refresh_interval = mapping.get(val, 2.0)

    def toggle_connection(self):
        if not self.is_connected:
            self.save_config()
            self.btn_connect.configure(text="Connecting...", state="disabled")
            self.status_text.set("Connecting to server...")
            self.lbl_status_icon.configure(fg=ACCENT_YELLOW)

            threading.Thread(target=self._connect_handshake, daemon=True).start()
        else:
            self.is_connected = False
            self.stop_camera_stream()
            self.btn_connect.configure(text="Connect", bg=ACCENT_BLUE)
            self.status_text.set("Disconnected")
            self.lbl_status_icon.configure(fg=ACCENT_RED)
            self.card_host["value"].configure(text="Not Connected", fg=TEXT_SECONDARY)

    def _connect_handshake(self):
        ip = self.server_ip.get().strip()
        port = self.server_port.get().strip()
        url = f"http://{ip}:{port}/api/status"

        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=4) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                hostname = data.get("hostname", "Unknown")
                os_info = data.get("os", "")
                blanked = data.get("blanked", False)
                gesture_enabled = data.get("gesture_enabled", True)
                server_sens = data.get("gesture_sensitivity", None)
                server_mac = data.get("mac_address", None)
                self.after(0, lambda: self._on_connected(hostname, os_info, blanked, gesture_enabled, server_sens, server_mac))
        except urllib.error.HTTPError as e:
            msg = f"HTTP Error {e.code}"
            self.after(0, lambda: self._on_connect_failed(msg))
        except Exception as e:
            self.after(0, lambda: self._on_connect_failed(f"Cannot reach server: {e}"))

    def _on_connected(self, hostname, os_info, blanked=False, gesture_enabled=True, server_sens=None, server_mac=None):
        self.is_connected = True
        self.btn_connect.configure(text="Disconnect", state="normal", bg="#4b5563")
        self.status_text.set(f"Connected to {self.server_ip.get().strip()} ({hostname})")
        self.lbl_status_icon.configure(fg=ACCENT_GREEN)
        self.card_host["value"].configure(text=f"{hostname} ({os_info})", fg=TEXT_PRIMARY)
        self._update_blank_button(blanked)
        self._update_gesture_button(gesture_enabled)
        # Store server MAC for Wake-on-LAN
        if server_mac:
            self.server_mac = server_mac
        # Sync sensitivity from server (server state takes priority on connect)
        if server_sens is not None:
            try:
                isens = max(1, min(100, int(server_sens)))
                self.gesture_sensitivity.set(isens)
                self._update_sensitivity_labels(isens)
            except Exception:
                pass
        # Immediate poll trigger on connect
        threading.Thread(target=self._poll_once, daemon=True).start()

    def _on_connect_failed(self, err_msg):
        self.is_connected = False
        self.btn_connect.configure(text="Connect", state="normal", bg=ACCENT_BLUE)
        self.status_text.set(f"Error: {err_msg}")
        self.lbl_status_icon.configure(fg=ACCENT_RED)
        messagebox.showerror("Connection Failed", f"Could not connect to Remote Task Manager server:\n\n{err_msg}\n\nMake sure server is running on {self.server_ip.get().strip()} and port {self.server_port.get().strip()}.")

    def _poll_once(self):
        if not self.is_connected:
            return
        ip = self.server_ip.get().strip()
        port = self.server_port.get().strip()
        try:
            metrics_url = f"http://{ip}:{port}/api/metrics"
            req_m = urllib.request.Request(metrics_url)
            with urllib.request.urlopen(req_m, timeout=5) as resp:
                metrics_data = json.loads(resp.read().decode("utf-8"))

            procs_url = f"http://{ip}:{port}/api/processes"
            req_p = urllib.request.Request(procs_url)
            with urllib.request.urlopen(req_p, timeout=6) as resp:
                procs_data = json.loads(resp.read().decode("utf-8"))

            self.after(0, lambda m=metrics_data, p=procs_data: self._update_ui(m, p))
        except Exception as e:
            self.after(0, lambda err=str(e): self.status_text.set(f"Poll warning: {err}"))

    def _background_poll_worker(self):
        last_poll = 0.0
        while True:
            now = time.time()
            if self.is_connected and self.refresh_interval < 1000:
                if now - last_poll >= self.refresh_interval:
                    last_poll = now
                    self._poll_once()
            time.sleep(0.25)

    def _update_ui(self, metrics, procs):
        try:
            cpu_pct = metrics.get("cpu_percent", 0.0)
            self.card_cpu["value"].configure(
                text=f"{cpu_pct}%",
                fg=ACCENT_RED if cpu_pct > 80 else (ACCENT_YELLOW if cpu_pct > 50 else ACCENT_BLUE)
            )
            self.card_cpu["progress"]["value"] = cpu_pct

            mem = metrics.get("memory", {})
            mem_pct = mem.get("percent", 0.0)
            used_gb = round(mem.get("used_mb", 0) / 1024, 1)
            tot_gb = round(mem.get("total_mb", 0) / 1024, 1)
            self.card_mem["value"].configure(
                text=f"{used_gb} GB / {tot_gb} GB ({mem_pct}%)",
                fg=ACCENT_RED if mem_pct > 85 else (ACCENT_YELLOW if mem_pct > 65 else ACCENT_GREEN)
            )
            self.card_mem["progress"]["value"] = mem_pct

            disk = metrics.get("disk", {})
            disk_pct = disk.get("percent", 0.0)
            d_used = disk.get("used_gb", 0)
            d_tot = disk.get("total_gb", 0)
            self.card_disk["value"].configure(
                text=f"{d_used} GB / {d_tot} GB ({disk_pct}%)",
                fg=ACCENT_RED if disk_pct > 90 else ACCENT_YELLOW
            )
            self.card_disk["progress"]["value"] = disk_pct

            self.raw_processes = procs.get("processes", [])
            self.lbl_proc_count.configure(text=f"Processes: {len(self.raw_processes)}")
            self.apply_filter_and_sort()
        except Exception as e:
            print(f"[UI_UPDATE_ERROR] {e}")

    def apply_filter_and_sort(self):
        try:
            query = self.search_query.get().strip().lower()
        except Exception:
            query = ""

        if query:
            filtered = [
                p for p in self.raw_processes
                if query in str(p.get("pid", "")).lower()
                or query in str(p.get("name", "")).lower()
                or query in str(p.get("user", "")).lower()
            ]
        else:
            filtered = list(self.raw_processes)

        col = getattr(self, "sort_column", "memory_mb")
        rev = getattr(self, "sort_reverse", True)

        def sort_key(p):
            val = p.get(col, 0)
            if isinstance(val, (int, float)):
                return val
            return str(val).lower()

        filtered.sort(key=sort_key, reverse=rev)
        self.filtered_processes = filtered

        cur_selection = self.selected_pid
        existing_items = set(self.tree.get_children())
        active_pids = set()

        for i, p in enumerate(filtered):
            vals = (
                p.get("pid"),
                p.get("name"),
                f"{p.get('cpu_percent', 0.0):.1f}%",
                f"{p.get('memory_mb', 0.0):.1f}",
                f"{p.get('memory_percent', 0.0):.1f}%",
                p.get("status", "running"),
                p.get("user", "")
            )
            item_id = str(p.get("pid"))
            active_pids.add(item_id)
            if self.tree.exists(item_id):
                self.tree.item(item_id, values=vals)
                self.tree.move(item_id, "", i)
            else:
                self.tree.insert("", i, iid=item_id, values=vals)

        for item in existing_items:
            if item not in active_pids:
                try:
                    self.tree.delete(item)
                except Exception:
                    pass

        if cur_selection is not None and self.tree.exists(str(cur_selection)):
            try:
                self.tree.selection_set(str(cur_selection))
            except Exception:
                pass

    def on_header_click(self, col):
        if self.sort_column == col:
            self.sort_reverse = not self.sort_reverse
        else:
            self.sort_column = col
            self.sort_reverse = True

        col_headers = {
            "pid": "PID",
            "name": "Process Name",
            "cpu_percent": "CPU %",
            "memory_mb": "Memory (MB)",
            "memory_percent": "Memory %",
            "status": "Status",
            "user": "User / Owner",
        }
        for c, text in col_headers.items():
            if c == col:
                arrow = " ▼" if self.sort_reverse else " ▲"
                self.tree.heading(c, text=text + arrow)
            else:
                self.tree.heading(c, text=text)

        self.apply_filter_and_sort()

    def kill_selected_process(self, force=False):
        if not self.is_connected:
            messagebox.showwarning("Not Connected", "Please connect to the remote server first.")
            return

        item = self.tree.selection()
        if not item:
            messagebox.showinfo("No Process Selected", "Please select a process from the table first.")
            return

        vals = self.tree.item(item[0], "values")
        if not vals or len(vals) < 2:
            messagebox.showinfo("No Process Selected", "Please select a valid process from the table.")
            return

        try:
            pid = int(vals[0])
            proc_name = str(vals[1])
        except (ValueError, TypeError):
            messagebox.showerror("Error", "Invalid process PID selected.")
            return

        action_word = "Force Kill" if force else "End Task"
        confirm = messagebox.askyesno(
            f"Confirm {action_word}",
            f"Are you sure you want to {action_word.lower()} process:\n\n'{proc_name}' (PID: {pid}) on {self.server_ip.get().strip()}?"
        )
        if not confirm:
            return

        ip = self.server_ip.get().strip()
        port = self.server_port.get().strip()
        url = f"http://{ip}:{port}/api/kill"

        payload = json.dumps({"pid": pid, "force": force}).encode("utf-8")

        def send_kill():
            try:
                req = urllib.request.Request(
                    url,
                    data=payload,
                    headers={"Content-Type": "application/json"}
                )
                with urllib.request.urlopen(req, timeout=5) as resp:
                    res = json.loads(resp.read().decode("utf-8"))
                    self.after(0, lambda: messagebox.showinfo("Success", res.get("message", "Task ended successfully.")))
                    # Instantly remove from local raw_processes so UI updates without waiting for next poll
                    self.raw_processes = [p for p in self.raw_processes if p.get("pid") != pid]
                    self.after(0, self.apply_filter_and_sort)
            except urllib.error.HTTPError as he:
                try:
                    err_body = json.loads(he.read().decode("utf-8"))
                    err_msg = err_body.get("error", str(he))
                except Exception:
                    err_msg = str(he)
                self.after(0, lambda m=err_msg: messagebox.showerror("Kill Failed", f"Server error: {m}"))
            except Exception as e:
                self.after(0, lambda err=str(e): messagebox.showerror("Kill Failed", f"Could not end task: {err}"))

        threading.Thread(target=send_kill, daemon=True).start()

    def show_run_dialog(self):
        if not self.is_connected:
            messagebox.showwarning("Not Connected", "Please connect to the remote server first.")
            return

        cmd = simpledialog.askstring(
            "Run New Task",
            "Enter command to execute on remote PC:\n(e.g., 'notepad.exe', 'powershell.exe -File script.ps1')",
            parent=self
        )
        if not cmd or not cmd.strip():
            return

        ip = self.server_ip.get().strip()
        port = self.server_port.get().strip()
        url = f"http://{ip}:{port}/api/run"
        payload = json.dumps({"command": cmd.strip()}).encode("utf-8")

        def send_run():
            try:
                req = urllib.request.Request(
                    url,
                    data=payload,
                    headers={"Content-Type": "application/json"}
                )
                with urllib.request.urlopen(req, timeout=5) as resp:
                    res = json.loads(resp.read().decode("utf-8"))
                    pid = res.get("pid")
                    self.after(0, lambda: messagebox.showinfo("Task Launched", f"Process launched successfully (PID: {pid})."))
            except Exception as e:
                self.after(0, lambda: messagebox.showerror("Run Failed", f"Failed to launch command on server: {e}"))

        threading.Thread(target=send_run, daemon=True).start()


if __name__ == "__main__":
    app = RemoteTaskManagerClient()
    app.mainloop()
