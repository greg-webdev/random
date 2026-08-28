using System;
using System.Collections.Generic;
using System.Net;
using Raylib_cs;

namespace CrazyCattle3D
{
    // ---------------------------------------------------------------------------
    //  Lobby screen state machine
    // ---------------------------------------------------------------------------
    public enum LobbyMode { ChooseRole, Hosting, Joining, Connecting }

    public class LobbyManager
    {
        // ── Public state ──────────────────────────────────────────────────────
        public LobbyMode Mode { get; private set; } = LobbyMode.ChooseRole;

        // Filled-in by UI
        public string PlayerName = "Player";
        public string HostIP     = "127.0.0.1";
        public string PortString = "7777";
        public bool   ReadyToStart = false;   // host clicked "Start Game"
        public bool   MatchReceived = false;  // client received MatchStart
        public int    MatchSeed;

        // Player list for display
        public List<(int slot, string name)> Players { get; } = new();

        // Status / error message
        public string StatusMsg = "";

        // Active field for text input: 0=name, 1=ip, 2=port
        private int _activeField = 0;
        private float _cursorBlink;
        private float _animTime;
        private float _connectTimeout;

        // ── Init ──────────────────────────────────────────────────────────────

        public void Reset()
        {
            Mode = LobbyMode.ChooseRole;
            Players.Clear();
            StatusMsg = "";
            ReadyToStart = false;
            MatchReceived = false;
            _activeField = 0;
            _animTime = 0;
            _connectTimeout = 0;
        }

        // ── Update ────────────────────────────────────────────────────────────

        public void Update(float dt, NetworkManager net)
        {
            _cursorBlink += dt * 2.5f;
            _animTime += dt;

            switch (Mode)
            {
                case LobbyMode.ChooseRole:
                    UpdateChooseRole();
                    break;

                case LobbyMode.Hosting:
                    UpdateHosting(dt, net);
                    break;

                case LobbyMode.Joining:
                    UpdateJoining(dt, net);
                    break;

                case LobbyMode.Connecting:
                    UpdateConnecting(dt, net);
                    break;
            }
        }

        private void UpdateChooseRole()
        {
            // Text input: player name (field 0)
            HandleTextInput(ref PlayerName, 12, 0);

            // Tab to cycle fields
            if (Raylib.IsKeyPressed(KeyboardKey.Tab))
                _activeField = (_activeField + 1) % 3;
        }

        private void UpdateHosting(float dt, NetworkManager net)
        {
            // Handle text input for the port field (field 2 only)
            if (_activeField == 2) HandleTextInput(ref PortString, 5, 2);

            // Poll packets for new joins
            foreach (var pkt in net.PollPackets())
            {
                // PlayerList updates handled by Program.cs; we just sync the display list
            }

            // Sync display list from net
            SyncPlayerList(net);

            // Host can press Enter / click button to start
            if (Raylib.IsKeyPressed(KeyboardKey.Enter) && Players.Count >= 1)
            {
                ReadyToStart = true;
            }
        }

        private void UpdateJoining(float dt, NetworkManager net)
        {
            // Field cycling: 0=name, 1=ip, 2=port
            HandleTextInput(ref PlayerName, 12, 0);
            HandleTextInput(ref HostIP, 39, 1);
            HandleTextInput(ref PortString, 5, 2);

            if (Raylib.IsKeyPressed(KeyboardKey.Tab))
                _activeField = (_activeField + 1) % 3;

            // Enter → attempt connect
            if (Raylib.IsKeyPressed(KeyboardKey.Enter))
                TryConnect(net);
        }

        private void UpdateConnecting(float dt, NetworkManager net)
        {
            _connectTimeout -= dt;
            if (_connectTimeout <= 0f)
            {
                StatusMsg = "Connection timed out. Press ESC to go back.";
                Mode = LobbyMode.Joining;
            }

            // Poll for Welcome packet
            foreach (var pkt in net.PollPackets())
            {
                if (pkt.Type == NetPacketType.Welcome)
                {
                    // data[1]=slot, data[2]=totalPlayers, data[3..]=player list
                    if (pkt.Data.Length >= 3)
                    {
                        net.ParsePlayerList(pkt.Data, 3);
                        SyncPlayerListFromSlotNames(net, pkt.Data[2]);
                        StatusMsg = $"Connected! You are sheep #{pkt.Data[1]}. Waiting for host…";
                        Mode = LobbyMode.Hosting; // shared "waiting" screen
                    }
                }
                else if (pkt.Type == NetPacketType.PlayerList)
                {
                    net.ParsePlayerList(pkt.Data, 1);
                    SyncPlayerList(net);
                }
                else if (pkt.Type == NetPacketType.MatchStart)
                {
                    if (pkt.Data.Length >= 5)
                    {
                        MatchSeed = BitConverter.ToInt32(pkt.Data, 1);
                        net.ParsePlayerList(pkt.Data, 5);
                    }
                    MatchReceived = true;
                }
            }
        }

        // ── Actions ───────────────────────────────────────────────────────────

        public void GoHost(NetworkManager net)
        {
            net.LocalName = PlayerName;
            if (!int.TryParse(PortString, out int port) || port < 1024 || port > 65535)
                port = NetworkManager.DefaultPort;

            try
            {
                net.StartHost(port);
                Players.Clear();
                Players.Add((0, PlayerName));
                StatusMsg = $"Hosting on port {port}. Waiting for players…";
                Mode = LobbyMode.Hosting;
            }
            catch (Exception ex)
            {
                StatusMsg = $"Host failed: {ex.Message}";
            }
        }

        public void GoJoin()
        {
            _activeField = 1; // Focus IP field
            Mode = LobbyMode.Joining;
            StatusMsg = "Enter the host's IP address and port, then press Enter.";
        }

        private void TryConnect(NetworkManager net)
        {
            net.LocalName = PlayerName;
            if (!int.TryParse(PortString, out int port) || port < 1024 || port > 65535)
                port = NetworkManager.DefaultPort;

            if (!IPAddress.TryParse(HostIP, out _))
            {
                StatusMsg = "Invalid IP address.";
                return;
            }

            try
            {
                net.StartClient(HostIP, port);
                StatusMsg = $"Connecting to {HostIP}:{port}…";
                Mode = LobbyMode.Connecting;
                _connectTimeout = 8.0f;
            }
            catch (Exception ex)
            {
                StatusMsg = $"Connect failed: {ex.Message}";
            }
        }

        // ── Helpers ───────────────────────────────────────────────────────────

        private void SyncPlayerList(NetworkManager net)
        {
            Players.Clear();
            Players.Add((0, net.GetSlotName(0) is { Length: > 0 } n0 ? n0 : net.LocalName));
            foreach (var peer in net.Peers)
                Players.Add((peer.SlotIndex, peer.PlayerName));
        }

        private void SyncPlayerListFromSlotNames(NetworkManager net, int count)
        {
            Players.Clear();
            for (int i = 0; i < count; i++)
            {
                string n = net.GetSlotName(i);
                if (!string.IsNullOrEmpty(n)) Players.Add((i, n));
            }
        }

        private void HandleTextInput(ref string field, int maxLen, int fieldIdx)
        {
            if (_activeField != fieldIdx) return;

            // Backspace
            if (Raylib.IsKeyPressed(KeyboardKey.Backspace) && field.Length > 0)
                field = field[..^1];

            // Printable characters
            int ch;
            while ((ch = Raylib.GetCharPressed()) != 0)
            {
                if (field.Length < maxLen && ch >= 32 && ch < 127)
                    field += (char)ch;
            }
        }

        // ── Draw ──────────────────────────────────────────────────────────────

        public void Draw(NetworkManager net)
        {
            const int W = UI.ScreenWidth;
            const int H = UI.ScreenHeight;

            // Dark gradient background
            Raylib.DrawRectangleGradientV(0, 0, W, H,
                new Color(10, 10, 25, 255), new Color(25, 10, 45, 255));

            // Animated sheep-wool dots in background
            DrawBackgroundDots();

            // Title
            DrawShadowText("🐑 CRAZY CATTLE 3D", W / 2 - 140, 28,
                new Color(255, 200, 60, 255), 26);
            DrawShadowText("MULTIPLAYER LOBBY", W / 2 - 105, 58,
                new Color(180, 140, 255, 255), 20);

            Raylib.DrawLine(20, 88, W - 20, 88, new Color(80, 60, 120, 180));

            switch (Mode)
            {
                case LobbyMode.ChooseRole:   DrawChooseRole(net); break;
                case LobbyMode.Hosting:      DrawHosting(net);    break;
                case LobbyMode.Joining:      DrawJoining();       break;
                case LobbyMode.Connecting:   DrawConnecting();    break;
            }

            // Status bar at bottom
            if (!string.IsNullOrEmpty(StatusMsg))
            {
                Raylib.DrawRectangle(0, H - 44, W, 44, new Color(0, 0, 0, 160));
                int sw = Raylib.MeasureText(StatusMsg, 14);
                Raylib.DrawText(StatusMsg, (W - sw) / 2, H - 28, 14, new Color(200, 220, 255, 255));
            }
        }

        private void DrawChooseRole(NetworkManager net)
        {
            const int W = UI.ScreenWidth;
            int cy = 120;

            // Player name field
            DrawFieldLabel("Your Sheep Name:", 30, cy);
            DrawTextField(PlayerName, 30, cy + 22, W - 60, _activeField == 0, _cursorBlink);
            cy += 70;

            DrawShadowText("How do you want to play?", W / 2 - 115, cy, Color.LightGray, 16);
            cy += 32;

            bool hoverHost = DrawButton("🏠  HOST a Game", 40, cy, W - 80, 52,
                new Color(60, 130, 220, 255), new Color(90, 160, 255, 255));
            cy += 66;

            bool hoverJoin = DrawButton("🔗  JOIN a Game", 40, cy, W - 80, 52,
                new Color(80, 180, 80, 255), new Color(110, 220, 110, 255));
            cy += 66;

            DrawShadowText("[ESC] = solo / back", W / 2 - 80, cy, new Color(130, 130, 150, 200), 13);

            if (hoverHost && Raylib.IsMouseButtonPressed(MouseButton.Left)) GoHost(net);
            if (hoverJoin && Raylib.IsMouseButtonPressed(MouseButton.Left)) GoJoin();
            if (Raylib.IsKeyPressed(KeyboardKey.H)) GoHost(net);
            if (Raylib.IsKeyPressed(KeyboardKey.J)) GoJoin();
        }

        private void DrawHosting(NetworkManager net)
        {
            const int W = UI.ScreenWidth;
            int cy = 110;

            // Show local IP hint
            string myIP = GetLocalIP();
            DrawShadowText($"Your IP: {myIP}", W / 2 - Raylib.MeasureText($"Your IP: {myIP}", 16) / 2, cy,
                new Color(255, 200, 60, 255), 16);
            cy += 24;
            DrawShadowText($"Port: {PortString}", W / 2 - 30, cy, Color.LightGray, 14);
            cy += 36;

            Raylib.DrawLine(20, cy, W - 20, cy, new Color(80, 60, 120, 120));
            cy += 14;

            DrawShadowText($"Players ({Players.Count}/{NetworkManager.MaxPlayers}):", 30, cy,
                new Color(180, 140, 255, 255), 16);
            cy += 26;

            foreach (var (slot, name) in Players)
            {
                Color rowBg = slot == net.LocalSlot ? new Color(50, 40, 80, 180) : new Color(30, 25, 55, 140);
                Raylib.DrawRectangleRounded(new Rectangle(25, cy - 4, W - 50, 28), 0.4f, 6, rowBg);

                string label = slot == 0 ? "👑 HOST" : $"#{slot}";
                Raylib.DrawText(label, 35, cy, 16, new Color(255, 200, 60, 220));
                Raylib.DrawText(name, 110, cy, 16, Color.White);

                // Latency badge for non-host slots
                if (slot != 0 && net.Role == NetRole.Host)
                {
                    float lat = net.GetPeerLatency(slot);
                    Color latCol = lat < 60 ? Color.Green : lat < 150 ? Color.Yellow : Color.Red;
                    string latStr = $"{(int)lat}ms";
                    Raylib.DrawText(latStr, W - 70, cy, 14, latCol);
                }
                cy += 34;
            }

            cy += 10;

            // Start button (host only)
            if (net.Role == NetRole.Host)
            {
                bool canStart = Players.Count >= 2;
                Color btnCol = canStart ? new Color(60, 200, 80, 255) : new Color(80, 80, 80, 255);
                Color btnHov = canStart ? new Color(90, 240, 110, 255) : new Color(80, 80, 80, 255);
                string btnTxt = canStart ? "▶  Start Match!" : "Waiting for players…";
                bool hov = DrawButton(btnTxt, 40, cy, W - 80, 52, btnCol, btnHov);
                if (canStart && hov && Raylib.IsMouseButtonPressed(MouseButton.Left))
                    ReadyToStart = true;
                if (canStart && Raylib.IsKeyPressed(KeyboardKey.Enter))
                    ReadyToStart = true;
            }
            else
            {
                // Pulsing waiting text for clients
                float alpha = (MathF.Sin(_animTime * 2.5f) + 1f) * 0.5f;
                Color waitCol = new Color(180, 180, 255, (int)(150 + alpha * 105));
                DrawShadowText("Waiting for host to start…", W / 2 - 100, cy + 14, waitCol, 16);
            }
        }

        private void DrawJoining()
        {
            const int W = UI.ScreenWidth;
            int cy = 110;

            DrawFieldLabel("Your Name:", 30, cy);
            DrawTextField(PlayerName, 30, cy + 22, W - 60, _activeField == 0, _cursorBlink);
            cy += 72;

            DrawFieldLabel("Host IP Address:", 30, cy);
            DrawTextField(HostIP, 30, cy + 22, W - 60, _activeField == 1, _cursorBlink);
            cy += 72;

            DrawFieldLabel("Port:", 30, cy);
            DrawTextField(PortString, 30, cy + 22, 120, _activeField == 2, _cursorBlink);
            cy += 72;

            bool hov = DrawButton("🔗  Connect!", 40, cy, W - 80, 52,
                new Color(60, 160, 220, 255), new Color(90, 200, 255, 255));
            if (hov && Raylib.IsMouseButtonPressed(MouseButton.Left)) { /* handled by Enter */ }

            cy += 70;
            DrawShadowText("[TAB] = switch field   [Enter] = connect", W / 2 - 155, cy,
                new Color(130, 130, 150, 200), 13);
        }

        private void DrawConnecting()
        {
            const int W = UI.ScreenWidth;
            const int H = UI.ScreenHeight;

            float dots = (_animTime % 1.5f) / 0.5f;
            string anim = dots < 1 ? "." : dots < 2 ? ".." : "...";
            string msg = $"Connecting{anim}";
            int sw = Raylib.MeasureText(msg, 22);
            Raylib.DrawText(msg, (W - sw) / 2, H / 2 - 20, 22, new Color(180, 180, 255, 255));

            // Countdown ring
            float frac = _connectTimeout / 8.0f;
            Raylib.DrawCircleLines(W / 2, H / 2 + 40, 22, Color.DarkGray);
            // Approximate arc with small rectangles
            for (int i = 0; i < 36; i++)
            {
                float angle = i / 36.0f;
                if (angle > frac) break;
                float a = angle * MathF.PI * 2 - MathF.PI / 2;
                int x = (int)(W / 2 + MathF.Cos(a) * 22);
                int y = (int)(H / 2 + 40 + MathF.Sin(a) * 22);
                Raylib.DrawCircle(x, y, 3, new Color(100, 200, 255, 220));
            }
        }

        // ── Drawing helpers ───────────────────────────────────────────────────

        private void DrawBackgroundDots()
        {
            const int W = UI.ScreenWidth;
            const int H = UI.ScreenHeight;
            var rng = new Random(42);
            for (int i = 0; i < 22; i++)
            {
                float x = rng.Next(0, W);
                float y = rng.Next(0, H);
                float phase = rng.Next(0, 628) / 100f;
                float alpha = (MathF.Sin(_animTime * 0.8f + phase) + 1f) * 0.5f;
                byte a = (byte)(20 + alpha * 30);
                Raylib.DrawCircle((int)x, (int)y, rng.Next(2, 6), new Color((byte)180, (byte)140, (byte)255, a));
            }
        }

        private void DrawFieldLabel(string label, int x, int y)
        {
            Raylib.DrawText(label, x, y, 14, new Color(180, 160, 220, 255));
        }

        private void DrawTextField(string text, int x, int y, int width, bool active, float blink)
        {
            Color border = active ? new Color(140, 100, 240, 255) : new Color(70, 60, 100, 255);
            Color bg     = active ? new Color(30, 20, 55, 230) : new Color(20, 15, 40, 200);
            Raylib.DrawRectangleRounded(new Rectangle(x, y, width, 32), 0.35f, 6, bg);
            Raylib.DrawRectangleRoundedLines(new Rectangle(x, y, width, 32), 0.35f, 6, border);

            string display = text + (active && (int)blink % 2 == 0 ? "|" : "");
            Raylib.DrawText(display, x + 10, y + 8, 16, Color.White);
        }

        private bool DrawButton(string text, int x, int y, int w, int h, Color normal, Color hover)
        {
            var rect = new Rectangle(x, y, w, h);
            bool isHover = Raylib.CheckCollisionPointRec(Raylib.GetMousePosition(), rect);
            Color col = isHover ? hover : normal;

            Raylib.DrawRectangleRounded(rect, 0.3f, 8, col);
            Raylib.DrawRectangleRoundedLines(rect, 0.3f, 8, new Color(255, 255, 255, 40));

            int tw = Raylib.MeasureText(text, 18);
            int tx = x + (w - tw) / 2;
            int ty = y + (h - 18) / 2;
            // Drop shadow
            Raylib.DrawText(text, tx + 1, ty + 1, 18, new Color(0, 0, 0, 100));
            Raylib.DrawText(text, tx, ty, 18, Color.White);

            return isHover;
        }

        private static void DrawShadowText(string text, int x, int y, Color col, int fontSize)
        {
            Raylib.DrawText(text, x + 1, y + 1, fontSize, new Color(0, 0, 0, 120));
            Raylib.DrawText(text, x, y, fontSize, col);
        }

        private static string GetLocalIP()
        {
            try
            {
                var host = System.Net.Dns.GetHostEntry(System.Net.Dns.GetHostName());
                foreach (var addr in host.AddressList)
                    if (addr.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
                        return addr.ToString();
            }
            catch { }
            return "127.0.0.1";
        }
    }
}
