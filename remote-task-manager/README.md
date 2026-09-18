# Remote Task Manager (Multi-Tab Hub Edition)

A standalone client-server solution for monitoring and managing processes, transferring files, and controlling the display on a remote machine (`192.168.50.148`) across your local network.

---

## What's New in this Version

### 1. Reusable Saved Download Places on Server
- Save frequent server destination paths (e.g. `C:\Users\LENOVO\Downloads`, `C:\Temp`, custom folders) to reuse anytime across app restarts.
- Convenient dropdown combobox with **"⭐ Save Location"** and **"🗑️ Remove"** buttons in the File Transfer tab.
- Persisted locally in `~/.remote_task_manager_config.json`.

### 2. Remote Server Directory Explorer UI ("Browse Server...")
- Clicking **"🌐 Browse Server..."** opens a dedicated Dark Mode window on the client that queries the remote server's filesystem in real-time.
- **Drive & Folder Exploration**: View logical drives (`C:\`, `D:\`), standard user directories, and browse into any subfolder with a double-click.
- **Navigation Controls**: Address bar with direct navigation, **"⬆️ Up"** button, and **"🔄 Refresh"**.
- **Remote Folder Creation**: Click **"➕ New Folder"** to create a directory directly on the server filesystem.
- **Instant Destination Selection**: Select any folder and click **"✔ Select This Folder"** to automatically set it as the transfer destination, with an option to save it to your reusable places list!

### 3. Drag-and-Drop File Transfers
- Drag and drop files from Windows Explorer directly into the large upload target box on the client, or click to browse.
- Instant base64-buffered transfer directly into your chosen server folder.

### 4. Client Multi-Tab Dashboard
- **⚡ Task Manager**: Real-time CPU, RAM, and Disk gauges; sortable process table with PID, Memory, CPU%, User; End Task; Force Kill; and Run New Task.
- **📁 File Transfer**: Destination folder manager, remote server directory explorer, and drag-and-drop file sender.
- **🎬 Media & Display**:
  - **Fullscreen Video Player**: Stream videos from the client to play in fullscreen on the server. Stop it anytime from the client with one click.
  - **Privacy Black Screen**: Turn ON a solid black overlay across the server monitor.

### 5. Secret 'Z' Key Dismissal
- On the server, the black screen overlay and fullscreen video player **cannot be exited by pressing Escape, double-clicking, or clicking the mouse**.
- No exit instructions are displayed on the black screen.
- Only pressing the **`Z`** key on the server keyboard (or clicking the Stop / Turn OFF button in the client) will dismiss the overlay.

---

## Directory Layout

```
remote-task-manager/
├── server/                               <-- DEPLOY THIS TO SERVER (192.168.50.148)
│   ├── RemoteTaskManagerServer.exe       <-- Standalone Host Server GUI
│   ├── server_app.py                     <-- Server source code
│   └── README.md                         <-- Server instructions
│
├── client/                               <-- RUN THIS ON YOUR CLIENT PC
│   ├── RemoteTaskManagerClient.exe       <-- Standalone Multi-Tab Client GUI
│   ├── client_app.py                     <-- Client source code
│   └── README.md                         <-- Client instructions
│
├── dist/                                 <-- Combined compiled binaries
│   ├── RemoteTaskManagerServer.exe
│   └── RemoteTaskManagerClient.exe
│
├── build.bat                             <-- Recompiles both EXEs from source
└── README.md
```

---

## Quick Setup Steps

1. Copy the **`server/`** folder to your server machine (`192.168.50.148`).
2. Run **`RemoteTaskManagerServer.exe`** on `192.168.50.148` (it will auto-start and hide to the `^` tray).
3. On your client machine, run **`client\RemoteTaskManagerClient.exe`**.
4. Click **Connect** to access all three tabs: Task Manager, File Transfer, and Media & Display.
5. In the **File Transfer** tab:
   - Click **"🌐 Browse Server..."** to explore folders on `192.168.50.148` and choose your destination.
   - Click **"⭐ Save Location"** to keep favorite folders in your reusable dropdown list.
   - Drag and drop your file into the upload box and click **"🚀 Send File to Server Now"**!
