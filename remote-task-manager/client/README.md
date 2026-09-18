# Remote Task Manager - Client Dashboard Component

Run this component on your client machine to connect to and manage the remote PC (`192.168.50.148`).

## Quick Start on Client

### Run the Standalone Client Executable
Double-click:
```
RemoteTaskManagerClient.exe
```
This opens the **Client Task Manager Dashboard**:
- Server IP defaults to `192.168.50.148` (customizable).
- Port defaults to `8888`.
- Token defaults to `remoteadmin123`.
- Click **Connect** to start monitoring.

## Features
- **Performance Meters**: Real-time CPU, RAM, and Disk percentage cards.
- **Process List**: Live table with PID, Process Name, CPU%, Memory MB/%, Status, and Owner.
- **Sorting**: Click any column header to sort ascending or descending.
- **Search**: Instant filter as you type.
- **Task Termination**: Select a process and click **End Task** (graceful) or **Force Kill**.
- **Run Remote Task**: Launch commands on the remote server directly from the client.
- **Remember Settings**: Remembers last connected IP and port so you don't need to retype.
