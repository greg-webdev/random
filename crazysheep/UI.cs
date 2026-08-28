using System;
using System.Collections.Generic;
using System.Numerics;
using Raylib_cs;

namespace CrazyCattle3D
{
    public struct KillFeedEntry
    {
        public string Message;
        public float Timer;
        public Color TextColor;
    }

    public static class UI
    {
        public const int ScreenWidth = 480;
        public const int ScreenHeight = 640;

        private static readonly List<KillFeedEntry> s_killFeed = new();
        private static float s_menuTime;
        private static float s_titleRotation;
        private static float s_titleSpinVelocity;

        public static void AddKillMessage(string msg, bool isPlayerInvolved)
        {
            s_killFeed.Insert(0, new KillFeedEntry
            {
                Message = msg,
                Timer = 3.5f,
                TextColor = isPlayerInvolved ? Color.Yellow : Color.White
            });

            if (s_killFeed.Count > 4)
            {
                s_killFeed.RemoveAt(s_killFeed.Count - 1);
            }
        }

        public static void ClearKillFeed()
        {
            s_killFeed.Clear();
        }

        public static void Update(float dt)
        {
            s_menuTime += dt;

            // Title spin physics
            if (s_titleSpinVelocity > 0.01f)
            {
                s_titleRotation += s_titleSpinVelocity * dt;
                s_titleSpinVelocity = MathF.Max(0.0f, s_titleSpinVelocity - dt * 14.0f);
            }
            else if (s_titleRotation > 0.01f)
            {
                // Seamlessly complete rotation to next multiple of 360 deg or return to 0
                s_titleRotation += dt * 12.0f;
                float fullTurn = MathF.PI * 2.0f;
                if (s_titleRotation >= fullTurn)
                {
                    s_titleRotation -= fullTurn;
                    if (s_titleRotation < 0.2f) s_titleRotation = 0.0f;
                }
            }

            for (int i = s_killFeed.Count - 1; i >= 0; i--)
            {
                var entry = s_killFeed[i];
                entry.Timer -= dt;
                if (entry.Timer <= 0)
                {
                    s_killFeed.RemoveAt(i);
                }
                else
                {
                    s_killFeed[i] = entry;
                }
            }
        }

        public static void DrawHUD(Sheep player, Sheep[] allSheep, Terrain terrain, int aliveCount, Camera3D camera)
        {
            // 1. World-to-Screen Speech Bubbles & Indicators
            DrawWorldOverlays(allSheep, camera);

            // 2. Top Stats Bar
            Raylib.DrawRectangle(0, 0, ScreenWidth, 52, new Color(15, 15, 20, 200));
            Raylib.DrawRectangleLines(0, 0, ScreenWidth, 52, new Color(80, 80, 100, 255));

            // Alive Sheep Badge
            Raylib.DrawRectangle(10, 8, 140, 36, new Color(30, 80, 40, 220));
            Raylib.DrawRectangleLines(10, 8, 140, 36, Color.Green);
            Raylib.DrawText($"ALIVE: {aliveCount}/{allSheep.Length}", 18, 18, 16, Color.RayWhite);

            // Player Kills Badge
            Raylib.DrawRectangle(ScreenWidth - 130, 8, 120, 36, new Color(90, 30, 30, 220));
            Raylib.DrawRectangleLines(ScreenWidth - 130, 8, 120, 36, Color.Red);
            Raylib.DrawText($"KILLS: {player.Kills}", ScreenWidth - 116, 18, 16, Color.RayWhite);

            // 3. Minimap Radar (Center-top below bar)
            DrawRadar(player, allSheep, terrain, ScreenWidth / 2, 85, 30);

            // 4. Kill Feed Notifications
            int feedY = 125;
            for (int i = 0; i < s_killFeed.Count; i++)
            {
                var feed = s_killFeed[i];
                float alpha = Math.Clamp(feed.Timer / 0.5f, 0.0f, 1.0f);
                Color bg = new Color((byte)20, (byte)20, (byte)30, (byte)(170 * alpha));
                Color textCol = new Color(feed.TextColor.R, feed.TextColor.G, feed.TextColor.B, (byte)(255 * alpha));

                int textW = Raylib.MeasureText(feed.Message, 13);
                int boxW = textW + 16;
                int boxX = ScreenWidth - boxW - 8;

                Raylib.DrawRectangle(boxX, feedY, boxW, 20, bg);
                Raylib.DrawText(feed.Message, boxX + 8, feedY + 4, 13, textCol);
                feedY += 24;
            }

            // 5. Bottom Dashboard (Speed, Dash meter, Baa button)
            int dashY = ScreenHeight - 75;
            Raylib.DrawRectangle(0, dashY, ScreenWidth, 75, new Color(15, 15, 20, 220));
            Raylib.DrawLine(0, dashY, ScreenWidth, dashY, new Color(100, 100, 120, 255));

            // Speedometer
            float currentSpeedKmh = MathF.Sqrt(player.Velocity.X * player.Velocity.X + player.Velocity.Z * player.Velocity.Z) * 3.6f;
            string speedStr = $"{(int)currentSpeedKmh} KM/H";
            Color speedCol = currentSpeedKmh > 65.0f ? Color.Red : (currentSpeedKmh > 35.0f ? Color.Yellow : Color.RayWhite);
            Raylib.DrawText(speedStr, 16, dashY + 12, 22, speedCol);

            // Dash Energy Meter
            int meterX = 145;
            int meterY = dashY + 15;
            int meterW = 210;
            int meterH = 18;

            Raylib.DrawRectangle(meterX, meterY, meterW, meterH, new Color(40, 40, 45, 255));
            int fillW = (int)(meterW * Math.Clamp(player.DashEnergy, 0.0f, 1.0f));
            Color dashBarCol = player.DashEnergy >= 0.35f ? Color.Gold : Color.Orange;
            Raylib.DrawRectangle(meterX, meterY, fillW, meterH, dashBarCol);
            Raylib.DrawRectangleLines(meterX, meterY, meterW, meterH, Color.LightGray);
            Raylib.DrawText("DASH [SHIFT]", meterX + 60, meterY + 3, 12, Color.Black);

            // Baa Button Indicator
            int baaX = ScreenWidth - 110;
            Raylib.DrawRectangle(baaX, dashY + 10, 95, 28, new Color(45, 45, 60, 255));
            Raylib.DrawRectangleLines(baaX, dashY + 10, 95, 28, Color.SkyBlue);
            Raylib.DrawText("[E] BAA!", baaX + 22, dashY + 16, 14, Color.RayWhite);

            // Controls helper at bottom
            Raylib.DrawText("WASD: Steer  SPACE: Ram/Jump  R: Restart  ESC: Menu", 16, ScreenHeight - 22, 11, Color.Gray);

            // 6. Danger Warning if Player Tipped
            if (player.IsTipped && player.IsAlive)
            {
                float flash = MathF.Sin(s_menuTime * 15.0f);
                if (flash > 0)
                {
                    int warnY = ScreenHeight / 2 - 40;
                    Raylib.DrawRectangle(40, warnY, ScreenWidth - 80, 48, new Color(180, 20, 20, 220));
                    Raylib.DrawRectangleLines(40, warnY, ScreenWidth - 80, 48, Color.Yellow);
                    Raylib.DrawText("⚠️ TIPPED OVER! ⚠️", 115, warnY + 8, 24, Color.Yellow);
                    Raylib.DrawText("EXPLOSION IMMINENT!", 145, warnY + 30, 14, Color.RayWhite);
                }
            }
        }

        private static void DrawRadar(Sheep player, Sheep[] allSheep, Terrain terrain, int cx, int cy, int radius)
        {
            Raylib.DrawCircle(cx, cy, radius, new Color(10, 15, 20, 180));
            Raylib.DrawCircleLines(cx, cy, radius, new Color(60, 80, 100, 255));
            Raylib.DrawCircleLines(cx, cy, radius / 2, new Color(40, 55, 70, 180));

            float scale = radius / terrain.ArenaRadius;

            // Draw other sheep
            for (int i = 0; i < allSheep.Length; i++)
            {
                var s = allSheep[i];
                if (!s.IsAlive) continue;

                int dotX = cx + (int)(s.Position.X * scale);
                int dotY = cy + (int)(s.Position.Z * scale);

                if (s.IsPlayer)
                {
                    // Player: glowing yellow dot with heading line
                    Raylib.DrawCircle(dotX, dotY, 4, Color.Yellow);
                    int hx = dotX + (int)(MathF.Sin(s.Yaw) * 7);
                    int hy = dotY + (int)(MathF.Cos(s.Yaw) * 7);
                    Raylib.DrawLine(dotX, dotY, hx, hy, Color.Gold);
                }
                else
                {
                    Color botDot = s.IsTipped ? Color.Orange : Color.White;
                    Raylib.DrawCircle(dotX, dotY, 2, botDot);
                }
            }
        }

        private static void DrawWorldOverlays(Sheep[] allSheep, Camera3D camera)
        {
            for (int i = 0; i < allSheep.Length; i++)
            {
                var s = allSheep[i];
                if (!s.IsAlive) continue;

                Vector3 head3D = s.Position + Vector3.UnitY * 1.5f;
                Vector2 screenPos = Raylib.GetWorldToScreen(head3D, camera);

                // Ignore if off screen
                if (screenPos.X < -50 || screenPos.X > ScreenWidth + 50 || screenPos.Y < -50 || screenPos.Y > ScreenHeight + 50)
                {
                    continue;
                }

                // Player Indicator Tag
                if (s.IsPlayer)
                {
                    Raylib.DrawText("▼ YOU", (int)screenPos.X - 18, (int)screenPos.Y - 26, 12, Color.Gold);
                }

                // Speech Bubble
                if (s.BaaTimer > 0)
                {
                    int bubbleW = Raylib.MeasureText(s.BaaText, 14) + 14;
                    int bubbleH = 22;
                    int bx = (int)screenPos.X - bubbleW / 2;
                    int by = (int)screenPos.Y - 24;

                    Raylib.DrawRectangleRounded(new Rectangle(bx, by, bubbleW, bubbleH), 0.4f, 4, Color.RayWhite);
                    Raylib.DrawRectangleRoundedLines(new Rectangle(bx, by, bubbleW, bubbleH), 0.4f, 4, Color.Black);
                    Raylib.DrawText(s.BaaText, bx + 7, by + 4, 14, Color.Black);
                }
            }
        }

        public static void DrawMainMenu(MapType currentMap, int bestScore)
        {
            // Dark vignette background
            Raylib.DrawRectangleGradientV(0, 0, ScreenWidth, ScreenHeight, new Color(20, 30, 45, 255), new Color(10, 15, 25, 255));

            // Animated title with funny wave
            float wave = MathF.Sin(s_menuTime * 3.5f) * 6.0f;
            string title = "CrAzYcATtlE3D";
            int titleSize = 42;
            int tw = Raylib.MeasureText(title, titleSize);
            int tx = (ScreenWidth - tw) / 2;
            int ty = 75 + (int)wave;

            // Check click on title to trigger spin
            if (Raylib.IsMouseButtonPressed(MouseButton.Left))
            {
                Vector2 mpos = Raylib.GetMousePosition();
                if (mpos.X >= tx - 20 && mpos.X <= tx + tw + 20 && mpos.Y >= ty - 15 && mpos.Y <= ty + titleSize + 20)
                {
                    s_titleSpinVelocity += 32.0f;
                    AudioEngine.PlayBaa(1.25f);
                }
            }

            // Title with spin rotation around center
            Rlgl.PushMatrix();
            float titleCenterX = tx + tw * 0.5f;
            float titleCenterY = ty + titleSize * 0.5f;
            Rlgl.Translatef(titleCenterX, titleCenterY, 0.0f);
            Rlgl.Rotatef(s_titleRotation * (180.0f / MathF.PI), 0.0f, 0.0f, 1.0f);
            Raylib.DrawText(title, -(tw / 2) + 3, -(titleSize / 2) + 3, titleSize, new Color(30, 30, 30, 255));
            Raylib.DrawText(title, -(tw / 2), -(titleSize / 2), titleSize, Color.Yellow);
            Rlgl.PopMatrix();

            // Subtitle
            string sub = "★ BATTLE ROYALE RAGE GAME ★ (CLICK TITLE TO SPIN!)";
            int subW = Raylib.MeasureText(sub, 12);
            Raylib.DrawText(sub, (ScreenWidth - subW) / 2, ty + 50, 12, Color.Orange);

            string greg = "★ EDITED BY GREGORY ★";
            int gw = Raylib.MeasureText(greg, 12);
            Raylib.DrawText(greg, (ScreenWidth - gw) / 2, ty + 68, 12, Color.Gold);
            Raylib.DrawText("Edited by Gregory", 12, ScreenHeight - 20, 11, Color.Yellow);

            // Animated Startup Spinner (top right)
            float spinAngle = s_menuTime * 4.2f;
            int spCx = ScreenWidth - 50;
            int spCy = 45;
            int spRadius = 18;
            Raylib.DrawCircle(spCx, spCy, spRadius + 4, new Color(10, 18, 30, 220));
            Raylib.DrawCircleLines(spCx, spCy, spRadius, new Color(60, 80, 110, 200));
            for (int i = 0; i < 3; i++)
            {
                float a = spinAngle + (i * MathF.PI * 2.0f / 3.0f);
                int ox = spCx + (int)(MathF.Cos(a) * spRadius);
                int oy = spCy + (int)(MathF.Sin(a) * spRadius);
                Color dotC = i == 0 ? Color.Gold : (i == 1 ? Color.Yellow : Color.SkyBlue);
                Raylib.DrawCircle(ox, oy, 3, dotC);
            }
            Raylib.DrawText("SPIN", spCx - 11, spCy - 4, 9, Color.Gold);

            // Sheep art placeholder / frame
            int cardY = 175;
            Raylib.DrawRectangle(40, cardY, ScreenWidth - 80, 130, new Color(30, 40, 55, 200));
            Raylib.DrawRectangleLines(40, cardY, ScreenWidth - 80, 130, new Color(100, 130, 180, 255));

            // Map Selector
            string mapName = currentMap switch
            {
                MapType.Ireland => "☘ IRELAND (Rolling Hills)",
                MapType.Iceland => "❄ ICELAND (Slippery Glaciers)",
                MapType.Desert => "🏜 DESERT (Sand Dunes)",
                _ => "IRELAND"
            };

            Raylib.DrawText("SELECT ARENA:", 55, cardY + 15, 14, Color.LightGray);
            int mw = Raylib.MeasureText(mapName, 17);
            Raylib.DrawText(mapName, (ScreenWidth - mw) / 2, cardY + 45, 17, Color.Gold);
            Raylib.DrawText("[◄ LEFT / RIGHT ARROWS ►]", 120, cardY + 85, 13, Color.SkyBlue);

            // Best Record
            if (bestScore > 0)
            {
                string recStr = $"BEST RUN: #{bestScore} PLACE";
                int rw = Raylib.MeasureText(recStr, 14);
                Raylib.DrawText(recStr, (ScreenWidth - rw) / 2, cardY + 105, 14, Color.Green);
            }

            // How to Play box
            int infoY = 325;
            Raylib.DrawRectangle(40, infoY, ScreenWidth - 80, 190, new Color(25, 30, 40, 220));
            Raylib.DrawRectangleLines(40, infoY, ScreenWidth - 80, 190, new Color(70, 85, 110, 255));

            Raylib.DrawText("RULES OF SURVIVAL:", 55, infoY + 14, 15, Color.Yellow);
            Raylib.DrawText("• RAM other sheep to tip them over!", 55, infoY + 40, 13, Color.RayWhite);
            Raylib.DrawText("• Tipped sheep EXPLODE after 0.4s!", 55, infoY + 62, 13, Color.RayWhite);
            Raylib.DrawText("• Slamming into FENCES = Instant Boom!", 55, infoY + 84, 13, Color.RayWhite);
            Raylib.DrawText("• Charge down hills for maximum ram!", 55, infoY + 106, 13, Color.RayWhite);
            Raylib.DrawText("• Be the last sheep standing to WIN!", 55, infoY + 128, 13, Color.Gold);
            Raylib.DrawText("CONTROLS: WASD / SHIFT / SPACE / E", 55, infoY + 158, 12, Color.SkyBlue);

            // Pulsing Start Prompt
            float pulse = (MathF.Sin(s_menuTime * 5.0f) + 1.0f) * 0.5f;
            Color promptCol = new Color(
                (byte)(200 + 55 * pulse),
                (byte)(200 + 55 * pulse),
                (byte)(50 + 200 * pulse),
                (byte)255
            );

            string startPrompt = "► PRESS SPACE OR ENTER TO PLAY ◄";
            int spW = Raylib.MeasureText(startPrompt, 18);
            Raylib.DrawText(startPrompt, (ScreenWidth - spW) / 2, 537, 18, promptCol);

            // Multiplayer button
            float mpPulse = (MathF.Sin(s_menuTime * 3.5f + 1.5f) + 1.0f) * 0.5f;
            Color mpCol = new Color(
                (byte)(120 + (int)(60 * mpPulse)),
                (byte)(80  + (int)(40 * mpPulse)),
                (byte)(230 + (int)(25 * mpPulse)),
                (byte)255
            );
            string mpPrompt = "🐑  [M]  MULTIPLAYER LOBBY  [M]  🐑";
            int mpW = Raylib.MeasureText(mpPrompt, 15);
            Raylib.DrawRectangle((ScreenWidth - mpW) / 2 - 10, 563, mpW + 20, 24,
                new Color(30, 20, 60, 180));
            Raylib.DrawText(mpPrompt, (ScreenWidth - mpW) / 2, 568, 15, mpCol);

            // Footer note
            string foot = "Original concept by anna (@4nn4t4t)";
            int fw = Raylib.MeasureText(foot, 11);
            Raylib.DrawText(foot, (ScreenWidth - fw) / 2, 610, 11, Color.DarkGray);
        }

        public static void DrawVictoryScreen(int kills, float matchTime)
        {
            // Golden celebration overlay
            Raylib.DrawRectangle(0, 0, ScreenWidth, ScreenHeight, new Color(20, 15, 5, 210));

            // Confetti effect
            Random rnd = new Random(42);
            for (int i = 0; i < 45; i++)
            {
                float cx = (float)rnd.NextDouble() * ScreenWidth;
                float cy = ((float)rnd.NextDouble() * ScreenHeight + s_menuTime * 120.0f) % ScreenHeight;
                Color col = rnd.Next(0, 4) switch
                {
                    0 => Color.Gold,
                    1 => Color.Yellow,
                    2 => Color.Pink,
                    _ => Color.SkyBlue
                };
                Raylib.DrawRectangle((int)cx, (int)cy, 7, 7, col);
            }

            int cyTitle = 140;
            string vic = "#1 VICTORY ROYALE!";
            int vw = Raylib.MeasureText(vic, 32);
            Raylib.DrawText(vic, (ScreenWidth - vw) / 2, cyTitle, 32, Color.Gold);

            string din = "WINNER WINNER SHEEP DINNER!";
            int dw = Raylib.MeasureText(din, 18);
            Raylib.DrawText(din, (ScreenWidth - dw) / 2, cyTitle + 48, 18, Color.Yellow);

            // Stats box
            int boxY = cyTitle + 100;
            Raylib.DrawRectangle(60, boxY, ScreenWidth - 120, 160, new Color(30, 30, 40, 240));
            Raylib.DrawRectangleLines(60, boxY, ScreenWidth - 120, 160, Color.Gold);

            Raylib.DrawText("BATTLE STATISTICS:", 80, boxY + 20, 16, Color.RayWhite);
            Raylib.DrawText($"Sheep Obliterated: {kills}", 80, boxY + 55, 15, Color.Yellow);
            int minutes = (int)(matchTime / 60);
            int seconds = (int)(matchTime % 60);
            Raylib.DrawText($"Survival Time: {minutes:D2}:{seconds:D2}", 80, boxY + 85, 15, Color.RayWhite);
            Raylib.DrawText("Final Rank: #1 (Champion Sheep)", 80, boxY + 115, 15, Color.Green);

            // Prompts
            Raylib.DrawText("[R] PLAY AGAIN", 100, boxY + 195, 18, Color.RayWhite);
            Raylib.DrawText("[ESC / M] MAIN MENU", 255, boxY + 195, 18, Color.LightGray);
        }

        public static void DrawGameOverScreen(int rank, int totalSheep, int kills)
        {
            // Dark crimson overlay
            Raylib.DrawRectangle(0, 0, ScreenWidth, ScreenHeight, new Color(30, 10, 10, 220));

            int cyTitle = 140;
            string rip = "YOU GOT OBLITERATED!";
            int rw = Raylib.MeasureText(rip, 28);
            Raylib.DrawText(rip, (ScreenWidth - rw) / 2, cyTitle, 28, Color.Red);

            string rankStr = $"PLACED #{rank} OUT OF {totalSheep}";
            int rsw = Raylib.MeasureText(rankStr, 20);
            Raylib.DrawText(rankStr, (ScreenWidth - rsw) / 2, cyTitle + 45, 20, Color.RayWhite);

            // Stats box
            int boxY = cyTitle + 95;
            Raylib.DrawRectangle(60, boxY, ScreenWidth - 120, 140, new Color(40, 20, 20, 240));
            Raylib.DrawRectangleLines(60, boxY, ScreenWidth - 120, 140, Color.Red);

            Raylib.DrawText("ROUND SUMMARY:", 80, boxY + 18, 16, Color.Yellow);
            Raylib.DrawText($"Kills: {kills}", 80, boxY + 52, 15, Color.RayWhite);
            string cause = (rank > 1) ? "Flipped over and exploded into wool!" : "Smashed into perimeter fence!";
            Raylib.DrawText(cause, 80, boxY + 85, 13, Color.Orange);

            // Prompts
            Raylib.DrawText("[R] RETRY", 120, boxY + 175, 20, Color.RayWhite);
            Raylib.DrawText("[ESC / M] MENU", 265, boxY + 175, 20, Color.LightGray);
        }

        public static void DrawCheatMenu(Sheep player, ref bool timeFrozen, ref bool flyMode, ref float speedMult, ref bool godMode)
        {
            int mw = 360;
            int mh = 370;
            int mx = (ScreenWidth - mw) / 2;
            int my = (ScreenHeight - mh) / 2;

            Raylib.DrawRectangle(mx, my, mw, mh, new Color(15, 20, 35, 245));
            Raylib.DrawRectangleLines(mx, my, mw, mh, Color.SkyBlue);

            Raylib.DrawText("⚡ CHEAT ENGINE [F4] ⚡", mx + 55, my + 15, 18, Color.Yellow);
            Raylib.DrawText("Press F4 to Toggle", mx + 125, my + 40, 12, Color.LightGray);

            int by = my + 65;
            int btnH = 34;
            int gap = 8;

            // 1. Freeze Time
            DrawButton(mx + 20, by, mw - 40, btnH, $"❄ FREEZE TIME: {(timeFrozen ? "FROZEN [ON]" : "[OFF]")}", timeFrozen ? Color.SkyBlue : Color.RayWhite);
            if (CheckClick(mx + 20, by, mw - 40, btnH)) timeFrozen = !timeFrozen;
            by += btnH + gap;

            // 2. Fly Mode
            DrawButton(mx + 20, by, mw - 40, btnH, $"🕊 FLY MODE: {(flyMode ? "FLYING [ON]" : "[OFF]")}", flyMode ? Color.Green : Color.RayWhite);
            if (CheckClick(mx + 20, by, mw - 40, btnH))
            {
                flyMode = !flyMode;
                if (player != null) player.IsFlying = flyMode;
            }
            by += btnH + gap;

            // 3. Speed Multiplier
            DrawButton(mx + 20, by, mw - 40, btnH, $"⚡ SPEED: {speedMult:F1}x", speedMult > 1.0f ? Color.Gold : Color.RayWhite);
            if (CheckClick(mx + 20, by, mw - 40, btnH))
            {
                speedMult = speedMult >= 5.0f ? 1.0f : (speedMult >= 2.5f ? 5.0f : 2.5f);
                if (player != null) player.SpeedMultiplier = speedMult;
            }
            by += btnH + gap;

            // 4. God Mode
            DrawButton(mx + 20, by, mw - 40, btnH, $"🛡 GOD MODE: {(godMode ? "INVINCIBLE [ON]" : "[OFF]")}", godMode ? Color.Gold : Color.RayWhite);
            if (CheckClick(mx + 20, by, mw - 40, btnH))
            {
                godMode = !godMode;
                if (player != null) player.IsGodMode = godMode;
            }
            by += btnH + gap;

            // 5. Super Heavy Tank
            bool isHeavy = player != null && player.IsSuperHeavy;
            DrawButton(mx + 20, by, mw - 40, btnH, $"🚜 SUPER HEAVY TANK: {(isHeavy ? "[ON]" : "[OFF]")}", isHeavy ? Color.Orange : Color.RayWhite);
            if (CheckClick(mx + 20, by, mw - 40, btnH))
            {
                if (player != null) player.IsSuperHeavy = !player.IsSuperHeavy;
            }
            by += btnH + gap;

            // 6. Unflip / Restore
            DrawButton(mx + 20, by, mw - 40, btnH, "🔄 UNFLIP / RESTORE SHEEP", Color.RayWhite);
            if (CheckClick(mx + 20, by, mw - 40, btnH))
            {
                if (player != null)
                {
                    player.Position = new Vector3(player.Position.X, player.Position.Y + 2.0f, player.Position.Z);
                    player.Velocity = Vector3.Zero;
                    player.Roll = 0;
                    player.Pitch = 0;
                }
            }
            by += btnH + gap;

            Raylib.DrawText("[CLICK BUTTONS OR PRESS F4 TO CLOSE]", mx + 45, my + mh - 25, 11, Color.Gray);
        }

        private static void DrawButton(int x, int y, int w, int h, string text, Color textColor)
        {
            Vector2 mpos = Raylib.GetMousePosition();
            bool hover = mpos.X >= x && mpos.X <= x + w && mpos.Y >= y && mpos.Y <= y + h;
            Raylib.DrawRectangle(x, y, w, h, hover ? new Color(40, 55, 80, 255) : new Color(25, 32, 48, 255));
            Raylib.DrawRectangleLines(x, y, w, h, hover ? Color.Yellow : new Color(60, 80, 110, 255));
            int tw = Raylib.MeasureText(text, 12);
            Raylib.DrawText(text, x + (w - tw) / 2, y + (h - 12) / 2, 12, textColor);
        }

        private static bool CheckClick(int x, int y, int w, int h)
        {
            if (Raylib.IsMouseButtonPressed(MouseButton.Left))
            {
                Vector2 mpos = Raylib.GetMousePosition();
                return mpos.X >= x && mpos.X <= x + w && mpos.Y >= y && mpos.Y <= y + h;
            }
            return false;
        }
    }
}
