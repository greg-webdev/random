# `asciivd.exe` - Video to ANSI Color Terminal HTTP Streamer

Convert any video file into real-time ANSI color terminal playback and stream it directly over HTTP so anyone can watch the video using `curl`.

---

## 🚀 Usage

### 1. Run Server with a Video File
```powershell
.\asciivd.exe C:\path\to\your_video.mp4 --port 8080
```

### 2. Run Server in Demo Mode (Dynamic Rainbow Plasma)
If no video file path is specified, `asciivd.exe` automatically generates a colorful real-time dynamic particle plasma loop:
```powershell
.\asciivd.exe --port 8080
```

### 3. Stream in Terminal via `curl`
Open any terminal window (Windows Terminal, Linux/macOS bash/zsh, Git Bash) and run:
```bash
curl http://localhost:8080
```

---

## 🎛️ Query Parameters (Customize via HTTP)

You can pass URL query parameters directly in your `curl` command to change resolution, FPS, or render mode dynamically for that specific stream connection!

| Parameter | Default | Description | Example |
| :--- | :--- | :--- | :--- |
| `w` or `width` | `80` | Terminal columns (width) | `curl http://localhost:8080?w=120` |
| `y` or `height` | `40` | Terminal rows (height) | `curl http://localhost:8080?h=50` |
| `mode` | `block` | `block` (TrueColor half-block `▀`) or `ascii` (density characters) | `curl http://localhost:8080?mode=ascii` |
| `fps` | `30` | Stream frame rate (1 - 60 FPS) | `curl http://localhost:8080?fps=60` |

### Combined `curl` Example:
```bash
curl "http://localhost:8080?w=100&h=40&mode=block&fps=30"
```

---

## 🖥️ Local Terminal Playback (No HTTP Server)
If you want to play a video directly in your local terminal window without starting an HTTP server:
```powershell
.\asciivd.exe C:\path\to\video.mp4 --play -w 100 -y 40
```

---

## ⚙️ Command Line Flags

```
usage: asciivd.exe [-h] [-p PORT] [-b BIND] [-w WIDTH] [-y HEIGHT] [-m {block,ascii}] [-f FPS] [--play] [video]

positional arguments:
  video                 Path to video file (if omitted, runs colorful demo pattern)

options:
  -p PORT, --port PORT  HTTP server port (default: 8080)
  -b BIND, --bind BIND  HTTP server bind host (default: 0.0.0.0)
  -w WIDTH, --width WIDTH
                        Default terminal width in columns (default: 80)
  -y HEIGHT, --height HEIGHT
                        Default terminal height in rows (default: 40)
  -m {block,ascii}, --mode {block,ascii}
                        Playback mode: 'block' (TrueColor ▀) or 'ascii' (ASCII density)
  -f FPS, --fps FPS     Playback frame rate (default: 30)
  --play                Play directly in local terminal instead of launching HTTP server
```
