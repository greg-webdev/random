# server.py in multiplayer-canvas
import os
import json
import socket
from typing import Dict, List, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

app = FastAPI(title="Multiplayer Canvas")

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

if os.path.exists(PUBLIC_DIR):
    app.mount("/static", StaticFiles(directory=PUBLIC_DIR), name="static")

connected_clients: Dict[str, WebSocket] = {}
client_metadata: Dict[str, Dict[str, Any]] = {}
drawing_history: List[Dict[str, Any]] = []

PALETTE = [
    "#ef4444", "#f97316", "#f59e0b", "#10b981", "#06b6d4",
    "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e"
]
color_counter = 0

async def broadcast(message: Dict[str, Any], exclude_client_id: str = None):
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
        await broadcast({
            "type": "user_left",
            "clientId": client_id,
            "username": meta.get("username", "User"),
            "onlineCount": len(connected_clients),
            "users": list(client_metadata.values())
        })

@app.get("/", response_class=HTMLResponse)
async def serve_index():
    index_path = os.path.join(PUBLIC_DIR, "index.html")
    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse("<h1>Multiplayer Canvas - index.html not found</h1>", status_code=404)

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

    client_id = f"user_{id(websocket)}"
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

        await broadcast({
            "type": "user_joined",
            "user": user_info,
            "onlineCount": len(connected_clients),
            "users": list(client_metadata.values())
        }, exclude_client_id=client_id)

    except Exception:
        await remove_client(client_id)
        return

    try:
        while True:
            text = await websocket.receive_text()
            data = json.loads(text)
            event_type = data.get("type")

            if event_type == "cursor":
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
                stroke = data.get("stroke")
                if stroke:
                    stroke["clientId"] = client_id
                    drawing_history.append(stroke)
                    if len(drawing_history) > 1000:
                        drawing_history.pop(0)
                    await broadcast({
                        "type": "draw_stroke",
                        "stroke": stroke
                    }, exclude_client_id=client_id)

            elif event_type == "draw_segment":
                segment = data.get("segment")
                if segment:
                    segment["clientId"] = client_id
                    await broadcast({
                        "type": "draw_segment",
                        "segment": segment
                    }, exclude_client_id=client_id)

            elif event_type == "ping":
                await broadcast({
                    "type": "ping",
                    "clientId": client_id,
                    "username": user_info["username"],
                    "color": user_info["color"],
                    "x": data.get("x", 0),
                    "y": data.get("y", 0),
                })

            elif event_type == "clear":
                drawing_history.clear()
                await broadcast({
                    "type": "clear",
                    "username": user_info["username"]
                })

            elif event_type == "undo":
                for i in range(len(drawing_history) - 1, -1, -1):
                    if drawing_history[i].get("clientId") == client_id:
                        drawing_history.pop(i)
                        break
                await broadcast({
                    "type": "sync_history",
                    "history": drawing_history
                })

            elif event_type == "update_profile":
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
                msg = data.get("text", "").strip()[:200]
                if msg:
                    await broadcast({
                        "type": "chat",
                        "clientId": client_id,
                        "username": user_info["username"],
                        "color": user_info["color"],
                        "text": msg
                    })

    except WebSocketDisconnect:
        await remove_client(client_id)
    except Exception:
        await remove_client(client_id)

if __name__ == "__main__":
    print(f"Starting server on http://localhost:{PORT} / http://{LOCAL_IP}:{PORT}")
    uvicorn.run(app, host="0.0.0.0", port=PORT)