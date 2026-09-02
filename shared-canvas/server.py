# server.py
import os
import json
import asyncio
import socket
from typing import Dict, List, Any, Set
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

app = FastAPI(title="Multiplayer Canvas Server")

# Get local LAN IP address for easy sharing
def get_local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

LOCAL_IP = get_local_ip()
PORT = 8080

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, "public")

# Mount static folder
app.mount("/static", StaticFiles(directory=PUBLIC_DIR), name="static")

# In-memory board state
connected_clients: Dict[str, WebSocket] = {}
client_metadata: Dict[str, Dict[str, Any]] = {}
drawing_history: List[Dict[str, Any]] = []  # Stores complete strokes for new joiners
MAX_HISTORY = 1000

PALETTE = [
    "#ef4444", "#f97316", "#f59e0b", "#10b981", "#06b6d4",
    "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e"
]

color_counter = 0

async def broadcast(message: Dict[str, Any], exclude_client_id: str = None):
    """Broadcast JSON message to all connected clients except optional exclude_client_id"""
    data_str = json.dumps(message)
    disconnected = []

    for cid, ws in connected_clients.items():
        if exclude_client_id and cid == exclude_client_id:
            continue
        try:
            await ws.send_text(data_str)
        except Exception:
            disconnected.append(cid)

    for cid in disconnected:
        await remove_client(cid)

async def remove_client(client_id: str):
    if client_id in connected_clients:
        del connected_clients[client_id]
    if client_id in client_metadata:
        meta = client_metadata.pop(client_id)
        # Notify others
        await broadcast({
            "type": "user_left",
            "clientId": client_id,
            "username": meta.get("username", "User"),
            "onlineCount": len(connected_clients),
            "users": list(client_metadata.values())
        })
        print(f"[-] Client left: {meta.get('username')} ({client_id}). Total online: {len(connected_clients)}")

@app.get("/", response_class=HTMLResponse)
async def serve_index():
    index_path = os.path.join(PUBLIC_DIR, "index.html")
    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>Shared Canvas - index.html not found</h1>", status_code=404)

@app.get("/client.js")
async def serve_js():
    js_path = os.path.join(PUBLIC_DIR, "client.js")
    return FileResponse(js_path, media_type="application/javascript")

@app.get("/style.css")
async def serve_css():
    css_path = os.path.join(PUBLIC_DIR, "style.css")
    return FileResponse(css_path, media_type="text/css")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    global color_counter
    await websocket.accept()

    # Assign identity
    client_id = f"user_{id(websocket)}_{len(connected_clients) + 1}"
    assigned_color = PALETTE[color_counter % len(PALETTE)]
    color_counter += 1
    username = f"Painter {len(connected_clients) + 1}"

    user_info = {
        "clientId": client_id,
        "username": username,
        "color": assigned_color,
        "x": 0,
        "y": 0,
    }

    connected_clients[client_id] = websocket
    client_metadata[client_id] = user_info

    print(f"[+] Client joined: {username} ({client_id}) from {websocket.client.host}. Total: {len(connected_clients)}")

    # Send initial state to the newly connected client
    try:
        await websocket.send_text(json.dumps({
            "type": "init",
            "self": user_info,
            "localIp": LOCAL_IP,
            "port": PORT,
            "users": list(client_metadata.values()),
            "onlineCount": len(connected_clients),
            "history": drawing_history
        }))

        # Notify other clients of new user
        await broadcast({
            "type": "user_joined",
            "user": user_info,
            "onlineCount": len(connected_clients),
            "users": list(client_metadata.values())
        }, exclude_client_id=client_id)

    except Exception as e:
        print(f"Error during client handshake: {e}")
        await remove_client(client_id)
        return

    # Listen for incoming events
    try:
        while True:
            text = await websocket.receive_text()
            data = json.loads(text)
            event_type = data.get("type")

            if event_type == "cursor":
                # Real-time cursor move
                x = data.get("x", 0)
                y = data.get("y", 0)
                user_info["x"] = x
                user_info["y"] = y
                await broadcast({
                    "type": "cursor",
                    "clientId": client_id,
                    "username": user_info["username"],
                    "color": user_info["color"],
                    "x": x,
                    "y": y
                }, exclude_client_id=client_id)

            elif event_type == "draw_stroke":
                # Full or partial stroke drawn
                stroke = data.get("stroke")
                if stroke:
                    stroke["clientId"] = client_id
                    drawing_history.append(stroke)
                    if len(drawing_history) > MAX_HISTORY:
                        drawing_history.pop(0)

                    await broadcast({
                        "type": "draw_stroke",
                        "stroke": stroke
                    }, exclude_client_id=client_id)

            elif event_type == "draw_segment":
                # Live streaming segment while user is drawing
                segment = data.get("segment")
                if segment:
                    segment["clientId"] = client_id
                    await broadcast({
                        "type": "draw_segment",
                        "segment": segment
                    }, exclude_client_id=client_id)

            elif event_type == "ping":
                # Sonar ping location
                x = data.get("x", 0)
                y = data.get("y", 0)
                note = data.get("note", "")
                await broadcast({
                    "type": "ping",
                    "clientId": client_id,
                    "username": user_info["username"],
                    "color": user_info["color"],
                    "x": x,
                    "y": y,
                    "note": note
                })

            elif event_type == "clear":
                # Clear board
                drawing_history.clear()
                await broadcast({
                    "type": "clear",
                    "username": user_info["username"]
                })

            elif event_type == "undo":
                # Undo last stroke from this client
                for i in range(len(drawing_history) - 1, -1, -1):
                    if drawing_history[i].get("clientId") == client_id:
                        drawing_history.pop(i)
                        break
                await broadcast({
                    "type": "sync_history",
                    "history": drawing_history
                })

            elif event_type == "update_profile":
                # User changed nickname or color
                if "username" in data and data["username"].strip():
                    user_info["username"] = data["username"].strip()[:24]
                if "color" in data and data["color"].startswith("#"):
                    user_info["color"] = data["color"]

                await broadcast({
                    "type": "user_updated",
                    "user": user_info,
                    "users": list(client_metadata.values())
                })

            elif event_type == "chat":
                # Chat message or emoji reaction
                message_text = data.get("text", "").strip()[:200]
                if message_text:
                    await broadcast({
                        "type": "chat",
                        "clientId": client_id,
                        "username": user_info["username"],
                        "color": user_info["color"],
                        "text": message_text
                    })

    except WebSocketDisconnect:
        await remove_client(client_id)
    except Exception as e:
        print(f"WebSocket error for {client_id}: {e}")
        await remove_client(client_id)

def main():
    print("=" * 65)
    print("🚀 Multiplayer Cursor / Drawing Canvas Server")
    print(f"📡 Local Access:   http://localhost:{PORT}")
    print(f"🌐 LAN Access:     http://{LOCAL_IP}:{PORT}")
    print("✨ Anyone on your Wi-Fi/local network can connect and draw!")
    print("=" * 65)
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")

if __name__ == "__main__":
    main()
