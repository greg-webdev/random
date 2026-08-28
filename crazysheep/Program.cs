using System;
using System.Collections.Generic;
using System.Numerics;
using Raylib_cs;

namespace CrazyCattle3D
{
    public enum GameState
    {
        MainMenu,
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
            Raylib.CloseWindow();
        }

        private static void InitializeMatch()
        {
            s_terrain = new Terrain(s_currentMap);
            s_sheep = new Sheep[TotalSheepCount];
            UI.ClearKillFeed();
            s_matchTime = 0.0f;
            s_stateTimer = 0.0f;

            Random rnd = new Random();

            // 1. Create Player at index 0 (center-ish spawn)
            float playerYaw = 0.0f;
            Vector3 playerPos = new Vector3(0, s_terrain.GetHeight(0, -15.0f) + 1.0f, -15.0f);
            s_player = new Sheep(0, "You", true, playerPos, playerYaw);
            s_sheep[0] = s_player;

            // 2. Create Bot Sheep (scattered across the arena)
            for (int i = 1; i < TotalSheepCount; i++)
            {
                float angle = (float)rnd.NextDouble() * MathF.PI * 2.0f;
                float dist = 8.0f + (float)rnd.NextDouble() * (s_terrain.ArenaRadius * 0.72f);
                float x = MathF.Cos(angle) * dist;
                float z = MathF.Sin(angle) * dist;
                float y = s_terrain.GetHeight(x, z) + 1.0f;
                float yaw = (float)rnd.NextDouble() * MathF.PI * 2.0f;

                string botName = $"Sheep #{i}";
                s_sheep[i] = new Sheep(i, botName, false, new Vector3(x, y, z), yaw);
            }

            // Position initial camera
            s_renderer.Camera.Position = s_player.Position - new Vector3(0, -3.5f, 6.5f);
            s_renderer.Camera.Target = s_player.Position;
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

            // Start game
            if (Raylib.IsKeyPressed(KeyboardKey.Space) || Raylib.IsKeyPressed(KeyboardKey.Enter))
            {
                InitializeMatch();
                s_state = GameState.Playing;
                AudioEngine.PlayBaa(1.1f);
            }

            // Slowly orbit camera around center
            float camAngle = (float)Raylib.GetTime() * 0.25f;
            s_renderer.Camera.Position = new Vector3(MathF.Cos(camAngle) * 35.0f, 16.0f, MathF.Sin(camAngle) * 35.0f);
            s_renderer.Camera.Target = new Vector3(0, 4.0f, 0);
        }

        private static void UpdatePlaying(float dt)
        {
            s_matchTime += dt;

            // 1. Update all sheep
            for (int i = 0; i < s_sheep.Length; i++)
            {
                s_sheep[i].Update(dt, s_terrain, s_sheep);
            }

            // 2. Resolve Collisions
            ResolveCollisions(dt);

            // 3. Check for Tipping / Fence / Boundary Explosions
            CheckExplosions();

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

            // Render 3D Scene
            s_renderer.RenderScene(s_terrain, s_sheep, s_player);

            // Render 2D Overlays & HUD
            switch (s_state)
            {
                case GameState.MainMenu:
                    UI.DrawMainMenu(s_currentMap, s_bestRank < 999 ? s_bestRank : 0);
                    break;

                case GameState.Playing:
                    UI.DrawHUD(s_player, s_sheep, s_terrain, GetAliveCount(), s_renderer.Camera);
                    break;

                case GameState.GameOver:
                    UI.DrawGameOverScreen(GetAliveCount() + 1, TotalSheepCount, s_player.Kills);
                    break;

                case GameState.Victory:
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
    }
}
