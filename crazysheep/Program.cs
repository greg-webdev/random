using System;
using System.Collections.Generic;
using System.Numerics;
using Raylib_cs;

namespace CrazyCattle3D
{
    public enum GameState
    {
        MainMenu,
        Lobby,
        Playing,
        GameOver,
        Victory
    }

    public static class Program
    {
        private const int ScreenWidth = 480;
        private const int ScreenHeight = 640;
        private const int TotalSheepCount = 40;

        private static GameState s_state = GameState.MainMenu;
        private static float s_stateTimer;

        private static bool s_cheatMenuOpen;
        private static bool s_timeFrozen;
        private static bool s_flyMode;
        private static float s_speedMult = 1.0f;
        private static bool s_godMode;
        private static MapType s_currentMap = MapType.Ireland;
        private static Terrain s_terrain = null!;
        private static Renderer3D s_renderer = null!;
        private static Sheep[] s_sheep = null!;
        private static Sheep s_player = null!;
        private static float s_matchTime;
        private static int s_bestRank = 999;

        // ── Multiplayer ──────────────────────────────────────────────────
        private static NetworkManager s_net    = new NetworkManager();
        private static LobbyManager   s_lobby  = new LobbyManager();
        // Broadcast state every 50ms (20 Hz)
        private const  float NetBroadcastInterval = 0.05f;
        private static float s_netBroadcastTimer  = 0f;

        public static void Main(string[] args)
        {
            // Configure Raylib window
            Raylib.SetConfigFlags(ConfigFlags.Msaa4xHint);
            Raylib.InitWindow(ScreenWidth, ScreenHeight, "CrAzYcATtlE3D");
            Raylib.SetTargetFPS(60);

            // Initialize procedural audio synthesizer
            AudioEngine.Initialize();

            // Initialize rendering engine and terrain
            s_renderer = new Renderer3D();
            s_terrain = new Terrain(s_currentMap);

            InitializeMatch();

            // Main Game Loop
            while (!Raylib.WindowShouldClose())
            {
                float dt = Raylib.GetFrameTime();
                if (dt > 0.05f) dt = 0.05f; // Prevent physics explosions during lag spikes

                Update(dt);
                Draw();
            }

            // Cleanup
            AudioEngine.Shutdown();
            s_net.Dispose();
            Raylib.CloseWindow();
        }

        private static void InitializeMatch()
        {
            InitializeMatch(seed: 0);
        }

        private static void InitializeMatch(int seed)
        {
            s_terrain = new Terrain(s_currentMap);
            s_sheep = new Sheep[TotalSheepCount];
            UI.ClearKillFeed();
            s_matchTime = 0.0f;
            s_stateTimer = 0.0f;

            // Use a shared seed for deterministic obstacle/spawn placement in MP
            Random rnd = seed != 0 ? new Random(seed) : new Random();

            // Figure out how many human players we have
            int humanCount = s_net.Role == NetRole.None ? 1 : s_net.Peers.Count + 1;

            // 1. Create sheep for human players (slots 0..humanCount-1)
            for (int h = 0; h < humanCount; h++)
            {
                float angle  = h * (MathF.PI * 2f / humanCount);
                float dist   = 12.0f;
                float px     = MathF.Cos(angle) * dist;
                float pz     = MathF.Sin(angle) * dist;
                float py     = s_terrain.GetHeight(px, pz) + 1.0f;
                float yaw    = MathF.Atan2(-px, -pz);

                string pName = h == 0 ? (s_net.LocalName is { Length: > 0 } n ? n : "You")
                                      : s_net.GetSlotName(h);
                if (string.IsNullOrEmpty(pName)) pName = $"Player {h + 1}";

                var sheep = new Sheep(h, pName, h == s_net.LocalSlot || s_net.Role == NetRole.None,
                                     new Vector3(px, py, pz), yaw);

                // Assign net role
                if (s_net.Role == NetRole.None)
                    sheep.NetRole = SheepRole.Local;      // solo play
                else if (h == s_net.LocalSlot)
                    sheep.NetRole = SheepRole.Local;      // this machine's player
                else
                    sheep.NetRole = SheepRole.Remote;     // network player

                s_sheep[h] = sheep;

                if (h == s_net.LocalSlot || s_net.Role == NetRole.None)
                    s_player = sheep;
            }

            // 2. Create Bot Sheep for remaining slots (scattered across the arena)
            for (int i = humanCount; i < TotalSheepCount; i++)
            {
                float angle = (float)rnd.NextDouble() * MathF.PI * 2.0f;
                float dist  = 8.0f + (float)rnd.NextDouble() * (s_terrain.ArenaRadius * 0.72f);
                float x     = MathF.Cos(angle) * dist;
                float z     = MathF.Sin(angle) * dist;
                float y     = s_terrain.GetHeight(x, z) + 1.0f;
                float yaw2  = (float)rnd.NextDouble() * MathF.PI * 2.0f;

                string botName = $"Sheep #{i}";
                var bot = new Sheep(i, botName, false, new Vector3(x, y, z), yaw2);
                bot.NetRole = SheepRole.Bot;
                s_sheep[i] = bot;
            }

            // Position initial camera
            s_renderer.Camera.Position = s_player.Position - new Vector3(0, -3.5f, 6.5f);
            s_renderer.Camera.Target   = s_player.Position;
        }

        private static void Update(float dt)
        {
            UI.Update(dt);
            s_stateTimer += dt;

            // Global Hotkeys
            if (Raylib.IsKeyPressed(KeyboardKey.Escape))
            {
                if (s_state == GameState.Playing || s_state == GameState.GameOver || s_state == GameState.Victory)
                {
                    s_state = GameState.MainMenu;
                    return;
                }
            }

            if (Raylib.IsKeyPressed(KeyboardKey.R))
            {
                if (s_state == GameState.Playing || s_state == GameState.GameOver || s_state == GameState.Victory)
                {
                    InitializeMatch();
                    s_state = GameState.Playing;
                    return;
                }
            }

            // Authentic TCRF Easter Egg: Ctrl + Shift + End -> Instant debug_win!
            if ((Raylib.IsKeyDown(KeyboardKey.LeftControl) || Raylib.IsKeyDown(KeyboardKey.RightControl)) &&
                (Raylib.IsKeyDown(KeyboardKey.LeftShift) || Raylib.IsKeyDown(KeyboardKey.RightShift)) &&
                Raylib.IsKeyPressed(KeyboardKey.End))
            {
                TriggerDebugWin();
            }

            if (Raylib.IsKeyPressed(KeyboardKey.F4))
            {
                s_cheatMenuOpen = !s_cheatMenuOpen;
                AudioEngine.PlayCrash(0.8f);
            }

            if (s_timeFrozen && s_state == GameState.Playing)
            {
                dt = 0.0f;
            }

            switch (s_state)
            {
                case GameState.MainMenu:
                    UpdateMainMenu(dt);
                    break;

                case GameState.Lobby:
                    UpdateLobby(dt);
                    break;

                case GameState.Playing:
                    UpdatePlaying(dt);
                    break;

                case GameState.GameOver:
                    UpdateGameOver(dt);
                    break;

                case GameState.Victory:
                    UpdateVictory(dt);
                    break;
            }
        }

        private static void UpdateMainMenu(float dt)
        {
            // Cycle maps with Left / Right arrows
            if (Raylib.IsKeyPressed(KeyboardKey.Left) || Raylib.IsKeyPressed(KeyboardKey.A))
            {
                s_currentMap = (MapType)(((int)s_currentMap + 2) % 3);
                s_terrain = new Terrain(s_currentMap);
                AudioEngine.PlayCrash(0.4f);
            }
            if (Raylib.IsKeyPressed(KeyboardKey.Right) || Raylib.IsKeyPressed(KeyboardKey.D))
            {
                s_currentMap = (MapType)(((int)s_currentMap + 1) % 3);
                s_terrain = new Terrain(s_currentMap);
                AudioEngine.PlayCrash(0.4f);
            }

            // Start solo game
            if (Raylib.IsKeyPressed(KeyboardKey.Space) || Raylib.IsKeyPressed(KeyboardKey.Enter))
            {
                s_net = new NetworkManager(); // solo: no networking
                InitializeMatch();
                s_state = GameState.Playing;
                AudioEngine.PlayBaa(1.1f);
            }

            // Open multiplayer lobby
            if (Raylib.IsKeyPressed(KeyboardKey.M))
            {
                s_net = new NetworkManager();
                s_lobby.Reset();
                s_state = GameState.Lobby;
                AudioEngine.PlayCrash(0.5f);
            }

            // Slowly orbit camera around center
            float camAngle = (float)Raylib.GetTime() * 0.25f;
            s_renderer.Camera.Position = new Vector3(MathF.Cos(camAngle) * 35.0f, 16.0f, MathF.Sin(camAngle) * 35.0f);
            s_renderer.Camera.Target = new Vector3(0, 4.0f, 0);
        }

        private static void UpdateLobby(float dt)
        {
            s_net.Tick(dt);
            s_lobby.Update(dt, s_net);

            // Handle incoming packets on the host side (player joins, etc.)
            if (s_net.Role == NetRole.Host)
            {
                // Packets for join events are handled inside NetworkManager/LobbyManager;
                // We just check for the lobby PlayerList updates here.
                foreach (var pkt in s_net.PollPackets())
                {
                    if (pkt.Type == NetPacketType.PlayerList)
                        s_net.ParsePlayerList(pkt.Data, 1);
                }
            }

            // Host chose to start
            if (s_lobby.ReadyToStart && s_net.Role == NetRole.Host)
            {
                int seed = (int)(Raylib.GetTime() * 1000.0);
                s_net.HostStartMatch(seed);
                InitializeMatch(seed);
                s_state = GameState.Playing;
                AudioEngine.PlayBaa(1.1f);
                return;
            }

            // Client received a MatchStart
            if (s_lobby.MatchReceived && s_net.Role == NetRole.Client)
            {
                InitializeMatch(s_lobby.MatchSeed);
                s_state = GameState.Playing;
                AudioEngine.PlayBaa(1.1f);
                return;
            }

            if (Raylib.IsKeyPressed(KeyboardKey.Escape))
            {
                s_net.Dispose();
                s_net = new NetworkManager();
                s_lobby.Reset();
                s_state = GameState.MainMenu;
            }
        }

        private static void UpdatePlaying(float dt)
        {
            s_matchTime += dt;

            // ── Client: poll network state and send local input ──────────────────
            if (s_net.Role == NetRole.Client)
            {
                // Send our local input to host BEFORE we process physics
                SendLocalInput();

                // Apply any state snapshots we've received
                foreach (var pkt in s_net.PollPackets())
                {
                    if (pkt.Type == NetPacketType.StateSnapshot)
                        s_net.ApplySnapshot(pkt, s_sheep);
                    else if (pkt.Type == NetPacketType.PlayerLeave)
                        HandlePlayerLeave(pkt);
                }
            }

            // ── Host: feed client inputs into their sheep ────────────────────
            if (s_net.Role == NetRole.Host)
            {
                foreach (var peer in s_net.Peers)
                {
                    if (s_net.TryGetPeerInput(peer.SlotIndex, out InputPacket inp))
                    {
                        int slot = peer.SlotIndex;
                        if (slot < s_sheep.Length && s_sheep[slot] != null)
                        {
                            s_sheep[slot].PendingInput    = inp;
                            s_sheep[slot].HasPendingInput  = true;
                        }
                    }
                }
            }

            // 1. Update all sheep
            for (int i = 0; i < s_sheep.Length; i++)
            {
                s_sheep[i].Update(dt, s_terrain, s_sheep);
            }

            // 2. Resolve Collisions (host-authoritative; clients do visual-only via snapshots)
            // Run collision on both host and solo; clients skip to avoid desyncs
            if (s_net.Role != NetRole.Client)
            {
                ResolveCollisions(dt);
                CheckExplosions();
            }

            // 3. Broadcast state (host only, 20 Hz)
            if (s_net.Role == NetRole.Host)
            {
                s_netBroadcastTimer -= dt;
                if (s_netBroadcastTimer <= 0f)
                {
                    s_netBroadcastTimer = NetBroadcastInterval;
                    s_net.BroadcastState(s_sheep);
                }
                s_net.Tick(dt);
            }

            // 4. Update particles and camera
            s_renderer.UpdateParticlesAndCamera(dt, s_player, s_terrain);

            // 5. Check Win/Loss conditions
            int aliveCount = GetAliveCount();

            if (!s_player.IsAlive)
            {
                int rank = aliveCount + 1;
                if (rank < s_bestRank) s_bestRank = rank;
                s_state = GameState.GameOver;
                AudioEngine.PlayGameOver();
            }
            else if (aliveCount <= 1)
            {
                s_bestRank = 1;
                s_state = GameState.Victory;
                AudioEngine.PlayWin();
            }
        }

        // Send the local player's keyboard input as a net packet to the host
        private static void SendLocalInput()
        {
            if (s_player == null || !s_player.IsAlive) return;

            float throttle = 0f, steer = 0f;
            byte  buttons  = 0;

            if (Raylib.IsKeyDown(KeyboardKey.W) || Raylib.IsKeyDown(KeyboardKey.Up))    throttle += 1.0f;
            if (Raylib.IsKeyDown(KeyboardKey.S) || Raylib.IsKeyDown(KeyboardKey.Down))  throttle -= 0.6f;
            if (Raylib.IsKeyDown(KeyboardKey.A) || Raylib.IsKeyDown(KeyboardKey.Left))  steer    -= 1.0f;
            if (Raylib.IsKeyDown(KeyboardKey.D) || Raylib.IsKeyDown(KeyboardKey.Right)) steer    += 1.0f;

            Vector2 mouseDelta = Raylib.GetMouseDelta();
            if (MathF.Abs(mouseDelta.X) > 0.5f)
                steer += Math.Clamp(mouseDelta.X * 0.08f, -1.0f, 1.0f);

            if (Raylib.IsKeyDown(KeyboardKey.LeftShift) || Raylib.IsKeyDown(KeyboardKey.RightShift)) buttons |= 0x01;
            if (Raylib.IsKeyPressed(KeyboardKey.Space))  buttons |= 0x02;
            if (Raylib.IsKeyPressed(KeyboardKey.E))      buttons |= 0x04;
            if (Raylib.IsKeyPressed(KeyboardKey.F2))     buttons |= 0x08;

            var inp = new InputPacket { Throttle = throttle, Steer = steer, Buttons = buttons };
            s_net.SendInput(inp);
        }

        private static void HandlePlayerLeave(RawPacket pkt)
        {
            if (pkt.Data.Length < 2) return;
            int slot = pkt.Data[1];
            if (slot < s_sheep.Length && s_sheep[slot] != null)
            {
                s_sheep[slot].NetRole = SheepRole.Bot; // fall back to AI
                UI.AddKillMessage($"{s_sheep[slot].Name} disconnected!", false);
            }
        }

        private static void UpdateGameOver(float dt)
        {
            s_renderer.UpdateParticlesAndCamera(dt, s_player, s_terrain);
            if (Raylib.IsKeyPressed(KeyboardKey.M))
            {
                s_state = GameState.MainMenu;
            }
        }

        private static void UpdateVictory(float dt)
        {
            s_renderer.UpdateParticlesAndCamera(dt, s_player, s_terrain);
            if (Raylib.IsKeyPressed(KeyboardKey.M))
            {
                s_state = GameState.MainMenu;
            }
        }

        private static void ResolveCollisions(float dt)
        {
            // Sheep vs Sheep collisions
            for (int i = 0; i < s_sheep.Length; i++)
            {
                Sheep s1 = s_sheep[i];
                if (!s1.IsAlive) continue;

                for (int j = i + 1; j < s_sheep.Length; j++)
                {
                    Sheep s2 = s_sheep[j];
                    if (!s2.IsAlive) continue;

                    Vector3 delta = s2.Position - s1.Position;
                    float distSq = delta.LengthSquared();
                    float minDist = s1.Radius + s2.Radius;

                    if (distSq < minDist * minDist && distSq > 0.0001f)
                    {
                        float dist = MathF.Sqrt(distSq);
                        Vector3 normal = delta / dist;
                        float overlap = minDist - dist;

                        // Separate sheep
                        s1.Position -= normal * (overlap * 0.5f);
                        s2.Position += normal * (overlap * 0.5f);

                        // Super Heavy instant obliteration
                        if (s1.IsSuperHeavy)
                        {
                            ExplodeSheep(s2, $"{s1.Name} (SUPER HEAVY) OBLITERATED {s2.Name}!");
                            s1.Kills++;
                            continue;
                        }
                        if (s2.IsSuperHeavy)
                        {
                            ExplodeSheep(s1, $"{s2.Name} (SUPER HEAVY) OBLITERATED {s1.Name}!");
                            s2.Kills++;
                            continue;
                        }

                        // Relative velocity along impact normal
                        Vector3 relVel = s2.Velocity - s1.Velocity;
                        float velAlongNormal = Vector3.Dot(relVel, normal);

                        if (velAlongNormal < 0)
                        {
                            float restitution = 0.75f;
                            float impulseMag = -(1.0f + restitution) * velAlongNormal * 0.5f;
                            Vector3 impulse = normal * impulseMag;

                            float s1Speed = s1.Velocity.Length();
                            float s2Speed = s2.Velocity.Length();

                            // Ramming and tipping calculations
                            // The sheep hitting with more speed applies roll/pitch torque to the other!
                            Vector3 torque1 = Vector3.Cross(relVel, normal) * 0.35f;
                            Vector3 torque2 = -torque1;

                            // High-speed ram bonus
                            if (s1Speed > s2Speed + 6.0f)
                            {
                                torque2 *= 2.8f;
                                impulseMag *= 1.4f;
                                s2.ApplyImpulse(impulse * 1.5f, torque2);
                                s1.ApplyImpulse(-impulse * 0.5f, torque1 * 0.3f);

                                if (s1Speed > 16.0f)
                                {
                                    // Massive ram: instant obliterate!
                                    ExplodeSheep(s2, $"{s1.Name} RAMMED {s2.Name} to pieces!");
                                    s1.Kills++;
                                }
                            }
                            else if (s2Speed > s1Speed + 6.0f)
                            {
                                torque1 *= 2.8f;
                                impulseMag *= 1.4f;
                                s1.ApplyImpulse(-impulse * 1.5f, torque1);
                                s2.ApplyImpulse(impulse * 0.5f, torque2 * 0.3f);

                                if (s2Speed > 16.0f)
                                {
                                    ExplodeSheep(s1, $"{s2.Name} RAMMED {s1.Name} to pieces!");
                                    s2.Kills++;
                                }
                            }
                            else
                            {
                                s1.ApplyImpulse(-impulse, torque1);
                                s2.ApplyImpulse(impulse, torque2);
                            }

                            // Sound & Dust effects
                            float totalImpact = MathF.Abs(velAlongNormal);
                            if (totalImpact > 3.0f)
                            {
                                AudioEngine.PlayCrash(Math.Clamp(totalImpact / 15.0f, 0.2f, 1.0f));
                                Vector3 midPos = (s1.Position + s2.Position) * 0.5f;
                                s_renderer.SpawnDustPuff(midPos, Color.LightGray);
                            }
                        }
                    }
                }

                // Sheep vs Obstacles
                for (int o = 0; o < s_terrain.Obstacles.Count; o++)
                {
                    var obs = s_terrain.Obstacles[o];
                    Vector2 toObs = new Vector2(s1.Position.X - obs.Position.X, s1.Position.Z - obs.Position.Z);
                    float obsDist = toObs.Length();
                    float minObsDist = s1.Radius + obs.Radius;

                    if (obsDist < minObsDist && obsDist > 0.001f)
                    {
                        Vector2 n2D = toObs / obsDist;
                        float overlap = minObsDist - obsDist;
                        s1.Position.X += n2D.X * overlap;
                        s1.Position.Z += n2D.Y * overlap;

                        float speed = s1.Velocity.Length();
                        if (speed > 17.5f)
                        {
                            ExplodeSheep(s1, $"{s1.Name} crashed into an obstacle!");
                            break;
                        }
                        else
                        {
                            // Bounce back
                            s1.Velocity.X = n2D.X * (speed * 0.6f + 3.0f);
                            s1.Velocity.Z = n2D.Y * (speed * 0.6f + 3.0f);
                            AudioEngine.PlayCrash(0.6f);
                        }
                    }
                }

                // Sheep vs Boundary Fence
                float distFromCenter = MathF.Sqrt(s1.Position.X * s1.Position.X + s1.Position.Z * s1.Position.Z);
                if (distFromCenter > s_terrain.ArenaRadius)
                {
                    float speed = s1.Velocity.Length();
                    if (speed > 8.0f)
                    {
                        // Ramming into the fence at speed = INSTANT EXPLOSION!
                        ExplodeSheep(s1, $"{s1.Name} slammed into the fence and EXPLODED!");
                    }
                    else
                    {
                        // Bounce inwards
                        Vector3 inward = Vector3.Normalize(new Vector3(-s1.Position.X, 0, -s1.Position.Z));
                        s1.Velocity = inward * (speed * 0.75f + 4.0f);
                        s1.Position += inward * 0.8f;
                        AudioEngine.PlayCrash(0.5f);
                    }
                }
            }
        }

        private static void CheckExplosions()
        {
            for (int i = 0; i < s_sheep.Length; i++)
            {
                Sheep s = s_sheep[i];
                if (!s.IsAlive) continue;

                // Check if sheep was tipped over for too long
                if (s.ShouldExplodeFromTipping())
                {
                    ExplodeSheep(s, $"{s.Name} tipped over and EXPLODED!");
                }
            }
        }

        private static void ExplodeSheep(Sheep s, string message)
        {
            if (!s.IsAlive) return;

            s.IsAlive = false;
            s_renderer.SpawnExplosion(s.Position, s.WoolColor);
            AudioEngine.PlayExplosion();
            UI.AddKillMessage(message, s.IsPlayer);
        }

        private static void TriggerDebugWin()
        {
            // TCRF instant win cheat!
            for (int i = 1; i < s_sheep.Length; i++)
            {
                if (s_sheep[i].IsAlive)
                {
                    s_sheep[i].IsAlive = false;
                    s_renderer.SpawnExplosion(s_sheep[i].Position, s_sheep[i].WoolColor);
                }
            }
            s_player.Kills += 10;
            s_bestRank = 1;
            s_state = GameState.Victory;
            AudioEngine.PlayExplosion();
            AudioEngine.PlayWin();
            UI.AddKillMessage("DEBUG_WIN ACTIVATED! (TCRF Easter Egg)", true);
        }

        private static int GetAliveCount()
        {
            int count = 0;
            for (int i = 0; i < s_sheep.Length; i++)
            {
                if (s_sheep[i].IsAlive) count++;
            }
            return count;
        }

        private static void Draw()
        {
            Raylib.BeginDrawing();
            Raylib.ClearBackground(s_terrain.SkyColor);

            switch (s_state)
            {
                case GameState.Lobby:
                    // Lobby has its own full-screen draw
                    s_lobby.Draw(s_net);
                    Raylib.EndDrawing();
                    return;

                case GameState.MainMenu:
                    // Render 3D Scene for menu background
                    s_renderer.RenderScene(s_terrain, s_sheep, s_player);
                    UI.DrawMainMenu(s_currentMap, s_bestRank < 999 ? s_bestRank : 0);
                    break;

                case GameState.Playing:
                    s_renderer.RenderScene(s_terrain, s_sheep, s_player);
                    UI.DrawHUD(s_player, s_sheep, s_terrain, GetAliveCount(), s_renderer.Camera);
                    DrawNetworkHUD();
                    break;

                case GameState.GameOver:
                    s_renderer.RenderScene(s_terrain, s_sheep, s_player);
                    UI.DrawGameOverScreen(GetAliveCount() + 1, TotalSheepCount, s_player.Kills);
                    break;

                case GameState.Victory:
                    s_renderer.RenderScene(s_terrain, s_sheep, s_player);
                    UI.DrawVictoryScreen(s_player.Kills, s_matchTime);
                    break;
            }

            // Render Cheat Menu if open
            if (s_cheatMenuOpen)
            {
                UI.DrawCheatMenu(s_player, ref s_timeFrozen, ref s_flyMode, ref s_speedMult, ref s_godMode);
            }

            // Draw FPS in corner
            Raylib.DrawFPS(10, ScreenHeight - 20);

            Raylib.EndDrawing();
        }

        /// <summary>Draws a small network status badge and player nametags in multiplayer.</summary>
        private static void DrawNetworkHUD()
        {
            if (s_net.Role == NetRole.None) return;

            // ─ Connection status badge (top-right) ────────────────────────────
            string roleStr = s_net.Role == NetRole.Host ? "HOST" : "CLIENT";
            float  latency = s_net.Role == NetRole.Client ? s_net.LatencyMs : 0f;
            Color  latCol  = latency < 60 ? Color.Green : latency < 150 ? Color.Yellow : Color.Red;
            string latStr  = s_net.Role == NetRole.Client ? $"{(int)latency}ms" : $"{s_net.Peers.Count}P";

            Raylib.DrawRectangle(ScreenWidth - 90, 4, 86, 22, new Color(0, 0, 0, 140));
            Raylib.DrawText(roleStr, ScreenWidth - 86, 8, 13, new Color(180, 180, 255, 255));
            Raylib.DrawText(latStr,  ScreenWidth - 50, 8, 13, latCol);

            // ─ Floating player name tags (world-space projected) ───────────────
            int humanCount = s_net.Peers.Count + 1;
            for (int i = 0; i < humanCount && i < s_sheep.Length; i++)
            {
                Sheep sh = s_sheep[i];
                if (!sh.IsAlive || sh.NetRole == SheepRole.Local) continue;

                // Project 3D world position above head to screen
                Vector3 worldPos = sh.Position + new Vector3(0, 2.8f, 0);
                Vector2 screen   = Raylib.GetWorldToScreen(worldPos, s_renderer.Camera);

                if (screen.X < 0 || screen.X > ScreenWidth || screen.Y < 0 || screen.Y > ScreenHeight)
                    continue;

                string tag = sh.Name;
                int tw  = Raylib.MeasureText(tag, 13);
                int tx  = (int)screen.X - tw / 2;
                int ty  = (int)screen.Y - 10;

                Raylib.DrawRectangle(tx - 4, ty - 2, tw + 8, 18, new Color(0, 0, 0, 130));
                Raylib.DrawText(tag, tx, ty, 13, new Color(255, 230, 100, 255));

                // Ping badge for host
                if (s_net.Role == NetRole.Host)
                {
                    float peerLat = s_net.GetPeerLatency(i);
                    Color pCol = peerLat < 60 ? Color.Green : peerLat < 150 ? Color.Yellow : Color.Red;
                    string ps  = $"{(int)peerLat}ms";
                    Raylib.DrawText(ps, tx, ty + 16, 11, pCol);
                }
            }
        }
    }
}
