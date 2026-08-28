using System;
using System.Collections.Generic;
using System.Numerics;
using Raylib_cs;

namespace CrazyCattle3D
{
    public struct Particle
    {
        public Vector3 Position;
        public Vector3 Velocity;
        public Color Color;
        public float Size;
        public float Lifetime;
        public float MaxLifetime;
        public bool IsWoolChunk;
        public float Rotation;
        public float RotationSpeed;
    }

    public class Renderer3D
    {
        public Camera3D Camera;
        private readonly List<Particle> _particles = new();
        private float _screenShakeTrauma = 0.0f;
        private readonly Random _rnd = new();

        public Renderer3D()
        {
            Camera = new Camera3D
            {
                Position = new Vector3(0.0f, 10.0f, 15.0f),
                Target = Vector3.Zero,
                Up = new Vector3(0.0f, 1.0f, 0.0f),
                FovY = 65.0f,
                Projection = CameraProjection.Perspective
            };
        }

        public void AddScreenShake(float amount)
        {
            _screenShakeTrauma = Math.Clamp(_screenShakeTrauma + amount, 0.0f, 1.0f);
        }

        public void SpawnExplosion(Vector3 pos, Color woolColor)
        {
            AddScreenShake(0.65f);

            // Fiery smoke core
            for (int i = 0; i < 25; i++)
            {
                float vx = ((float)_rnd.NextDouble() - 0.5f) * 16.0f;
                float vy = 4.0f + (float)_rnd.NextDouble() * 14.0f;
                float vz = ((float)_rnd.NextDouble() - 0.5f) * 16.0f;

                Color col = _rnd.Next(0, 3) switch
                {
                    0 => new Color(255, 100, 30, 255),
                    1 => new Color(255, 200, 40, 255),
                    _ => new Color(80, 80, 80, 220)
                };

                _particles.Add(new Particle
                {
                    Position = pos + new Vector3(0, 0.5f, 0),
                    Velocity = new Vector3(vx, vy, vz),
                    Color = col,
                    Size = 0.8f + (float)_rnd.NextDouble() * 0.9f,
                    Lifetime = 0.0f,
                    MaxLifetime = 0.6f + (float)_rnd.NextDouble() * 0.4f,
                    IsWoolChunk = false
                });
            }

            // Flying wool chunks / sheep fragments
            for (int i = 0; i < 18; i++)
            {
                float vx = ((float)_rnd.NextDouble() - 0.5f) * 22.0f;
                float vy = 6.0f + (float)_rnd.NextDouble() * 18.0f;
                float vz = ((float)_rnd.NextDouble() - 0.5f) * 22.0f;

                _particles.Add(new Particle
                {
                    Position = pos + new Vector3(0, 0.7f, 0),
                    Velocity = new Vector3(vx, vy, vz),
                    Color = woolColor,
                    Size = 0.5f + (float)_rnd.NextDouble() * 0.5f,
                    Lifetime = 0.0f,
                    MaxLifetime = 1.4f + (float)_rnd.NextDouble() * 0.8f,
                    IsWoolChunk = true,
                    RotationSpeed = ((float)_rnd.NextDouble() - 0.5f) * 20.0f
                });
            }
        }

        public void SpawnDustPuff(Vector3 pos, Color col)
        {
            for (int i = 0; i < 3; i++)
            {
                _particles.Add(new Particle
                {
                    Position = pos + new Vector3(((float)_rnd.NextDouble() - 0.5f) * 0.5f, 0.1f, ((float)_rnd.NextDouble() - 0.5f) * 0.5f),
                    Velocity = new Vector3(((float)_rnd.NextDouble() - 0.5f) * 2.0f, 1.2f + (float)_rnd.NextDouble() * 1.5f, ((float)_rnd.NextDouble() - 0.5f) * 2.0f),
                    Color = new Color(col.R, col.G, col.B, (byte)160),
                    Size = 0.35f + (float)_rnd.NextDouble() * 0.3f,
                    Lifetime = 0.0f,
                    MaxLifetime = 0.45f,
                    IsWoolChunk = false
                });
            }
        }

        public void UpdateParticlesAndCamera(float dt, Sheep playerSheep, Terrain terrain)
        {
            // Update particles
            for (int i = _particles.Count - 1; i >= 0; i--)
            {
                Particle p = _particles[i];
                p.Lifetime += dt;

                if (p.Lifetime >= p.MaxLifetime)
                {
                    _particles.RemoveAt(i);
                    continue;
                }

                // Gravity on particles
                p.Velocity.Y -= (p.IsWoolChunk ? 26.0f : 10.0f) * dt;
                p.Position += p.Velocity * dt;

                // Bounce wool chunks off ground
                float groundY = terrain.GetHeight(p.Position.X, p.Position.Z);
                if (p.Position.Y < groundY + p.Size * 0.5f)
                {
                    p.Position.Y = groundY + p.Size * 0.5f;
                    p.Velocity.Y = -p.Velocity.Y * 0.45f;
                    p.Velocity.X *= 0.7f;
                    p.Velocity.Z *= 0.7f;
                }

                p.Rotation += p.RotationSpeed * dt;
                _particles[i] = p;
            }

            // Update camera shake
            if (_screenShakeTrauma > 0)
            {
                _screenShakeTrauma = MathF.Max(0.0f, _screenShakeTrauma - dt * 1.4f);
            }

            // Follow player camera
            if (playerSheep != null)
            {
                float targetFov = playerSheep.IsDashing ? 78.0f : 65.0f;
                Camera.FovY += (targetFov - Camera.FovY) * Math.Clamp(dt * 8.0f, 0.0f, 1.0f);

                // Calculate chase camera position
                float distBehind = 6.2f;
                float heightAbove = 3.6f;

                Vector3 forward = new Vector3(MathF.Sin(playerSheep.Yaw), 0, MathF.Cos(playerSheep.Yaw));
                Vector3 idealCamPos = playerSheep.Position - forward * distBehind + Vector3.UnitY * heightAbove;

                // Clamp camera above terrain
                float camGroundH = terrain.GetHeight(idealCamPos.X, idealCamPos.Z);
                if (idealCamPos.Y < camGroundH + 1.2f)
                {
                    idealCamPos.Y = camGroundH + 1.2f;
                }

                // Smooth interpolation
                Camera.Position = Vector3.Lerp(Camera.Position, idealCamPos, Math.Clamp(dt * 12.0f, 0.0f, 1.0f));
                Vector3 idealTarget = playerSheep.Position + Vector3.UnitY * 0.8f + forward * 1.5f;
                Camera.Target = Vector3.Lerp(Camera.Target, idealTarget, Math.Clamp(dt * 16.0f, 0.0f, 1.0f));

                // Apply screen shake
                if (_screenShakeTrauma > 0.001f)
                {
                    float shake = _screenShakeTrauma * _screenShakeTrauma * 0.85f;
                    Camera.Position += new Vector3(
                        ((float)_rnd.NextDouble() - 0.5f) * shake,
                        ((float)_rnd.NextDouble() - 0.5f) * shake,
                        ((float)_rnd.NextDouble() - 0.5f) * shake
                    );
                    Camera.Target += new Vector3(
                        ((float)_rnd.NextDouble() - 0.5f) * shake * 0.5f,
                        ((float)_rnd.NextDouble() - 0.5f) * shake * 0.5f,
                        ((float)_rnd.NextDouble() - 0.5f) * shake * 0.5f
                    );
                }
            }
        }

        public void RenderScene(Terrain terrain, Sheep[] allSheep, Sheep playerSheep)
        {
            Raylib.BeginMode3D(Camera);

            // 1. Draw Terrain
            RenderTerrain(terrain);

            // 2. Draw Fences
            RenderFences(terrain);

            // 3. Draw Obstacles (trees, boulders)
            RenderObstacles(terrain);

            // 4. Draw Sheep
            for (int i = 0; i < allSheep.Length; i++)
            {
                Sheep s = allSheep[i];
                if (s.IsAlive)
                {
                    RenderSheep(s);
                }
            }

            // 5. Draw Particles
            RenderParticles();

            Raylib.EndMode3D();
        }

        private void RenderTerrain(Terrain terrain)
        {
            // Grid-based undulating terrain
            const int gridHalfSize = 42;
            const float cellSize = 2.2f;

            for (int z = -gridHalfSize; z < gridHalfSize; z++)
            {
                for (int x = -gridHalfSize; x < gridHalfSize; x++)
                {
                    float wx1 = x * cellSize;
                    float wz1 = z * cellSize;
                    float wx2 = (x + 1) * cellSize;
                    float wz2 = (z + 1) * cellSize;

                    float distSq = (wx1 * wx1 + wz1 * wz1);
                    if (distSq > (terrain.ArenaRadius + 8.0f) * (terrain.ArenaRadius + 8.0f))
                    {
                        continue; // Skip outside arena
                    }

                    float y11 = terrain.GetHeight(wx1, wz1);
                    float y12 = terrain.GetHeight(wx1, wz2);
                    float y21 = terrain.GetHeight(wx2, wz1);
                    float y22 = terrain.GetHeight(wx2, wz2);

                    // Alternating checker detail for visible motion
                    bool isAlt = ((x + z) & 1) == 0;
                    Color baseCol = isAlt ? terrain.GrassColor : terrain.GrassDetailColor;

                    // Simple directional lighting based on elevation
                    float slopeLight = Math.Clamp(0.85f + (y22 - y11) * 0.08f, 0.65f, 1.25f);
                    Color shadedCol = new Color(
                        (byte)Math.Clamp(baseCol.R * slopeLight, 0, 255),
                        (byte)Math.Clamp(baseCol.G * slopeLight, 0, 255),
                        (byte)Math.Clamp(baseCol.B * slopeLight, 0, 255),
                        (byte)255
                    );

                    Vector3 v1 = new Vector3(wx1, y11, wz1);
                    Vector3 v2 = new Vector3(wx1, y12, wz2);
                    Vector3 v3 = new Vector3(wx2, y22, wz2);
                    Vector3 v4 = new Vector3(wx2, y21, wz1);

                    Raylib.DrawTriangle3D(v1, v2, v3, shadedCol);
                    Raylib.DrawTriangle3D(v1, v3, v4, shadedCol);
                }
            }
        }

        private void RenderFences(Terrain terrain)
        {
            var posts = terrain.FencePosts;
            for (int i = 0; i < posts.Count; i++)
            {
                Vector3 p1 = posts[i];
                Vector3 p2 = posts[(i + 1) % posts.Count];

                // Fence post
                Raylib.DrawCylinder(p1, 0.18f, 0.18f, 2.2f, 6, terrain.FenceColor);

                // Top & Middle rails
                Vector3 rTop1 = p1 + Vector3.UnitY * 1.6f;
                Vector3 rTop2 = p2 + Vector3.UnitY * 1.6f;
                Vector3 rMid1 = p1 + Vector3.UnitY * 0.85f;
                Vector3 rMid2 = p2 + Vector3.UnitY * 0.85f;

                Raylib.DrawLine3D(rTop1, rTop2, terrain.FenceColor);
                Raylib.DrawLine3D(rMid1, rMid2, terrain.FenceColor);

                // Warning hazard glow on fence top
                Color warningCol = ((i % 4 == 0) ? Color.Red : Color.Yellow);
                Raylib.DrawSphere(p1 + Vector3.UnitY * 2.2f, 0.12f, warningCol);
            }
        }

        private void RenderObstacles(Terrain terrain)
        {
            for (int i = 0; i < terrain.Obstacles.Count; i++)
            {
                var obs = terrain.Obstacles[i];

                if (obs.Type == 0)
                {
                    // Tree: Trunk + foliage
                    Raylib.DrawCylinder(obs.Position, 0.45f, 0.35f, obs.Height * 0.5f, 6, new Color(90, 50, 20, 255));
                    Vector3 topPos = obs.Position + Vector3.UnitY * (obs.Height * 0.65f);
                    Raylib.DrawSphere(topPos, obs.Radius, obs.Color);
                    Raylib.DrawSphere(topPos + Vector3.UnitY * (obs.Radius * 0.6f), obs.Radius * 0.75f, obs.Color);
                }
                else if (obs.Type == 1)
                {
                    // Boulder / Ice block
                    Raylib.DrawCube(obs.Position + Vector3.UnitY * (obs.Height * 0.4f), obs.Radius * 1.6f, obs.Height * 0.8f, obs.Radius * 1.6f, obs.Color);
                    Raylib.DrawCubeWires(obs.Position + Vector3.UnitY * (obs.Height * 0.4f), obs.Radius * 1.6f, obs.Height * 0.8f, obs.Radius * 1.6f, Color.DarkGray);
                }
                else
                {
                    // Pillar / Ancient stone / Geyser
                    Raylib.DrawCylinder(obs.Position, obs.Radius * 0.7f, obs.Radius * 0.7f, obs.Height, 8, obs.Color);
                }
            }
        }

        private void RenderSheep(Sheep s)
        {
            Rlgl.PushMatrix();
            Rlgl.Translatef(s.Position.X, s.Position.Y, s.Position.Z);
            Rlgl.Rotatef(s.Yaw * (180.0f / MathF.PI), 0, 1, 0);
            Rlgl.Rotatef(s.Pitch * (180.0f / MathF.PI), 1, 0, 0);
            Rlgl.Rotatef(s.Roll * (180.0f / MathF.PI), 0, 0, 1);

            // 1. Fluffy Wool Body (Center cube + puffy wool spheres)
            Color bodyWool = s.WoolColor;
            if (s.IsDashing)
            {
                // Pulsing energetic glow when dashing
                bodyWool = Color.Gold;
            }

            // Main torso
            Raylib.DrawCube(new Vector3(0, 0.45f, 0), 1.25f, 0.95f, 1.55f, bodyWool);
            Raylib.DrawSphere(new Vector3(0, 0.48f, 0.35f), 0.65f, bodyWool);
            Raylib.DrawSphere(new Vector3(0, 0.48f, -0.35f), 0.65f, bodyWool);
            Raylib.DrawSphere(new Vector3(-0.45f, 0.45f, 0), 0.55f, bodyWool);
            Raylib.DrawSphere(new Vector3(0.45f, 0.45f, 0), 0.55f, bodyWool);

            // Tail
            Raylib.DrawSphere(new Vector3(0, 0.6f, -0.9f), 0.22f, bodyWool);

            // 2. Head (Black or dark face sticking forward)
            Vector3 headPos = new Vector3(0, 0.55f, 0.95f);
            Raylib.DrawCube(headPos, 0.55f, 0.55f, 0.65f, s.SkinColor);

            // Floppy Ears
            Raylib.DrawCube(headPos + new Vector3(-0.36f, 0.15f, -0.1f), 0.35f, 0.15f, 0.18f, s.SkinColor);
            Raylib.DrawCube(headPos + new Vector3(0.36f, 0.15f, -0.1f), 0.35f, 0.15f, 0.18f, s.SkinColor);

            // Cartoon Eyes
            Vector3 eyeL = headPos + new Vector3(-0.18f, 0.16f, 0.34f);
            Vector3 eyeR = headPos + new Vector3(0.18f, 0.16f, 0.34f);
            Raylib.DrawSphere(eyeL, 0.11f, Color.White);
            Raylib.DrawSphere(eyeR, 0.11f, Color.White);

            // Pupils (look crazy/X when tipped!)
            if (s.IsTipped)
            {
                // Funny cartoon X or spiraling eyes
                Raylib.DrawSphere(eyeL + new Vector3(0, 0, 0.05f), 0.05f, Color.Red);
                Raylib.DrawSphere(eyeR + new Vector3(0, 0, 0.05f), 0.05f, Color.Red);
            }
            else
            {
                Raylib.DrawSphere(eyeL + new Vector3(0, 0, 0.05f), 0.06f, Color.Black);
                Raylib.DrawSphere(eyeR + new Vector3(0, 0, 0.05f), 0.06f, Color.Black);
            }

            // Player Distinct Features: Golden Horns & Cool Shades
            if (s.IsPlayer)
            {
                // Golden curved ram horns
                Raylib.DrawCube(headPos + new Vector3(-0.35f, 0.35f, -0.05f), 0.2f, 0.38f, 0.2f, Color.Gold);
                Raylib.DrawCube(headPos + new Vector3(0.35f, 0.35f, -0.05f), 0.2f, 0.38f, 0.2f, Color.Gold);

                // Cool sunglasses across the eyes
                Raylib.DrawCube(headPos + new Vector3(0, 0.15f, 0.36f), 0.52f, 0.16f, 0.08f, new Color(15, 15, 20, 255));
            }

            // 3. Legs (4 little black hooves with trot animation)
            float legSwing1 = MathF.Sin(s.TrotPhase) * 0.35f;
            float legSwing2 = -legSwing1;

            if (s.IsTipped)
            {
                // Hilarious flailing legs when upside down/tipped
                float flail = MathF.Sin(s.TippedTimer * 28.0f) * 0.4f;
                legSwing1 = flail;
                legSwing2 = -flail;
            }

            DrawLeg(new Vector3(-0.45f, 0, 0.5f), legSwing1, s.SkinColor);
            DrawLeg(new Vector3(0.45f, 0, 0.5f), legSwing2, s.SkinColor);
            DrawLeg(new Vector3(-0.45f, 0, -0.5f), legSwing2, s.SkinColor);
            DrawLeg(new Vector3(0.45f, 0, -0.5f), legSwing1, s.SkinColor);

            Rlgl.PopMatrix();
        }

        private void DrawLeg(Vector3 basePos, float swing, Color color)
        {
            Rlgl.PushMatrix();
            Rlgl.Translatef(basePos.X, basePos.Y, basePos.Z);
            Rlgl.Rotatef(swing * (180.0f / MathF.PI), 1, 0, 0);
            Raylib.DrawCylinder(new Vector3(0, -0.45f, 0), 0.11f, 0.13f, 0.5f, 5, color);
            Rlgl.PopMatrix();
        }

        private void RenderParticles()
        {
            for (int i = 0; i < _particles.Count; i++)
            {
                var p = _particles[i];
                float lifeRatio = 1.0f - (p.Lifetime / p.MaxLifetime);
                float curSize = p.Size * (p.IsWoolChunk ? 1.0f : lifeRatio);

                Color col = new Color(
                    p.Color.R,
                    p.Color.G,
                    p.Color.B,
                    (byte)(p.Color.A * Math.Clamp(lifeRatio, 0.0f, 1.0f))
                );

                if (p.IsWoolChunk)
                {
                    Rlgl.PushMatrix();
                    Rlgl.Translatef(p.Position.X, p.Position.Y, p.Position.Z);
                    Rlgl.Rotatef(p.Rotation, 1, 1, 0);
                    Raylib.DrawCube(Vector3.Zero, curSize, curSize, curSize, col);
                    Rlgl.PopMatrix();
                }
                else
                {
                    Raylib.DrawSphere(p.Position, curSize, col);
                }
            }
        }
    }
}
