# 🎨 LiveCanvas - Multiplayer Cursor & Drawing Board

A high-performance real-time collaborative canvas where anyone on your local network (Wi-Fi) or computer can connect, draw, see live cursors, and sonar ping each other.

---

## ⚡ Features

- **Smooth Multiplayer Cursors**:
  - Real-time cursor movement with colored pointer arrows, usernames, and drawing badges.
  - Automatic disconnection cleanup and instant state sync.
- **Collaborative Freehand Drawing**:
  - High-DPI screen support (`devicePixelRatio`) with quadratic Bezier smoothing.
  - Tools: **Pen / Marker**, **Highlighter** (translucent), **Eraser**, **Brush Size Slider** (2px to 48px).
  - Palette with 8 vibrant presets + custom HTML5 color picker.
  - History synchronization: New joiners immediately receive all existing board artwork!
- **Radar Sonar Ping**:
  - **Right-click anywhere on the canvas** or press `P` to trigger an animated radar sonar ripple effect with audio chime that shows all users where you are pointing!
- **Local Network (LAN) Sharing**:
  - Detects your local Wi-Fi / LAN IP (e.g. `http://192.168.51.98:8080`).
  - One-click copy button to share with phones, tablets, or other PCs on your local network.
- **Floating Reactions**:
  - Real-time floating emojis (👍, ❤️, 🔥, 🚀, 🎉, 😂).
- **Undo & Clear & PNG Export**:
  - Global board clearing with confirmation, stroke-level undo (`Ctrl+Z`), and instant PNG artwork download.

---

## 🚀 Running the Server

Make sure dependencies are installed:
```powershell
pip install fastapi uvicorn websockets
```

Start the server:
```powershell
# Option 1: Direct Python
python server.py

# Option 2: Using start.bat
double-click start.bat

# Option 3: Using uvicorn CLI
python -m uvicorn server:app --host 0.0.0.0 --port 8080 --reload
```

---

## 🌐 Opening the Board

- **On your computer**: Open [http://localhost:8080](http://localhost:8080)
- **On other devices on your Wi-Fi (phone, laptop, tablet)**: Open `http://<your-lan-ip>:8080` (displayed at the top of the app)
