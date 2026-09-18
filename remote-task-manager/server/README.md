# Remote Task Manager - Server Host Component

Deploy this folder to the target machine you want to monitor and manage (`192.168.50.148`).

## Quick Start on the Server

### Option A: Run the Standalone Server Executable (No Python required!)
Double-click:
```
RemoteTaskManagerServer.exe
```
This opens the **Host Server Control Panel**:
## System Tray & Background Operation (Hidden Icon `^` on Taskbar)

- **Minimizes to Tray**: Clicking the **`X`** (close) button or clicking **`Minimize to Tray`** hides the window into the Windows System Tray (the hidden icons `^` up arrow next to your taskbar clock).
- **Click to Open**: Simply click or double-click the green server tray icon under `^` to instantly reopen the Host Control Panel.
- **Tray Menu**: Right-click the tray icon for options:
  - **Open Host Control Panel** (default)
  - **Status**: Live status indication
  - **Port**: Currently listening port
  - **Exit Server**: Completely shuts down the server and exits.

### Option B: Run via Python Script
If you prefer running via command line:
```cmd
python server_app.py --port 8888 --token remoteadmin123
```
Or for headless background mode (no GUI window):
```cmd
python server_app.py --headless --port 8888 --token remoteadmin123
```

## Security Note
Default authentication token is `remoteadmin123`. Any client attempting to query or terminate tasks without this token will be blocked and logged.
