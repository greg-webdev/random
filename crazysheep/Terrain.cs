using System;
using System.Collections.Generic;
using System.Numerics;
using Raylib_cs;

namespace CrazyCattle3D
{
    public enum MapType
    {
        Ireland = 0,
        Iceland = 1,
        Desert = 2
    }

    public struct Obstacle
    {
        public Vector3 Position;
        public float Radius;
        public float Height;
        public Color Color;
        public int Type; // 0 = Tree/Palm, 1 = Boulder/IceBlock, 2 = Geyser/Ruin
    }

    public class Terrain
    {
        public MapType Map { get; private set; }
        public float ArenaRadius { get; private set; } = 85.0f;
        public float Friction { get; private set; } = 0.94f;
        public Color GrassColor { get; private set; }
        public Color GrassDetailColor { get; private set; }
        public Color SkyColor { get; private set; }
        public Color FogColor { get; private set; }
        public Color FenceColor { get; private set; }

        public List<Vector3> FencePosts { get; } = new();
        public List<Obstacle> Obstacles { get; } = new();

        public Terrain(MapType map)
        {
            Map = map;
            ConfigureMap();
            BuildFences();
            BuildObstacles();
        }

        private void ConfigureMap()
        {
            switch (Map)
            {
                case MapType.Ireland:
                    ArenaRadius = 85.0f;
                    Friction = 0.94f;
                    GrassColor = new Color(54, 153, 54, 255);
                    GrassDetailColor = new Color(42, 128, 42, 255);
                    SkyColor = new Color(135, 206, 235, 255);
                    FogColor = new Color(190, 225, 240, 255);
                    FenceColor = new Color(139, 90, 43, 255);
                    break;

                case MapType.Iceland:
                    ArenaRadius = 80.0f;
                    Friction = 0.985f; // Super slippery ice!
                    GrassColor = new Color(200, 225, 245, 255);
                    GrassDetailColor = new Color(165, 200, 230, 255);
                    SkyColor = new Color(180, 210, 240, 255);
                    FogColor = new Color(215, 235, 250, 255);
                    FenceColor = new Color(80, 110, 140, 255);
                    break;

                case MapType.Desert:
                    ArenaRadius = 90.0f;
                    Friction = 0.92f;
                    GrassColor = new Color(225, 185, 120, 255);
                    GrassDetailColor = new Color(205, 160, 95, 255);
                    SkyColor = new Color(245, 205, 150, 255);
                    FogColor = new Color(240, 210, 170, 255);
                    FenceColor = new Color(160, 100, 60, 255);
                    break;
            }
        }

        public float GetHeight(float x, float z)
        {
            float distSq = x * x + z * z;
            float dist = MathF.Sqrt(distSq);

            // Arena boundary slopes upwards to keep sheep contained or act as ramps
            float boundaryWall = 0.0f;
            if (dist > ArenaRadius * 0.75f)
            {
                float excess = (dist - ArenaRadius * 0.75f) / (ArenaRadius * 0.25f);
                boundaryWall = excess * excess * 8.0f;
            }

            float hills = 0.0f;
            switch (Map)
            {
                case MapType.Ireland:
                    // Rolling green hills, nice natural ramps
                    hills = MathF.Sin(x * 0.065f) * MathF.Cos(z * 0.065f) * 3.8f +
                            MathF.Sin(x * 0.12f + 1.2f) * 1.5f +
                            MathF.Cos(z * 0.11f - 0.8f) * 1.5f;
                    break;

                case MapType.Iceland:
                    // Steeper glacial ridges and bowls
                    hills = MathF.Sin(x * 0.08f) * 2.8f +
                            MathF.Cos(z * 0.08f) * 2.8f +
                            MathF.Sin((x + z) * 0.05f) * 2.0f;
                    break;

                case MapType.Desert:
                    // Long wind-swept sand dunes
                    hills = MathF.Sin(x * 0.05f + z * 0.03f) * 4.2f +
                            MathF.Cos(z * 0.07f) * 1.8f;
                    break;
            }

            return hills + boundaryWall;
        }

        public Vector3 GetNormal(float x, float z)
        {
            const float eps = 0.25f;
            float hL = GetHeight(x - eps, z);
            float hR = GetHeight(x + eps, z);
            float hD = GetHeight(x, z - eps);
            float hU = GetHeight(x, z + eps);

            Vector3 normal = new Vector3(hL - hR, 2.0f * eps, hD - hU);
            return Vector3.Normalize(normal);
        }

        private void BuildFences()
        {
            FencePosts.Clear();
            int postCount = 64;
            float angleStep = (MathF.PI * 2.0f) / postCount;

            for (int i = 0; i < postCount; i++)
            {
                float angle = i * angleStep;
                float x = MathF.Cos(angle) * ArenaRadius;
                float z = MathF.Sin(angle) * ArenaRadius;
                float y = GetHeight(x, z);
                FencePosts.Add(new Vector3(x, y, z));
            }
        }

        private void BuildObstacles()
        {
            Obstacles.Clear();
            Random rnd = new Random((int)Map * 100 + 42);
            int count = 28;

            for (int i = 0; i < count; i++)
            {
                float angle = (float)rnd.NextDouble() * MathF.PI * 2.0f;
                float r = 15.0f + (float)rnd.NextDouble() * (ArenaRadius * 0.70f - 15.0f);
                float x = MathF.Cos(angle) * r;
                float z = MathF.Sin(angle) * r;
                float y = GetHeight(x, z);

                int type = rnd.Next(0, 3);
                float radius = 1.6f + (float)rnd.NextDouble() * 1.2f;
                float height = 3.5f + (float)rnd.NextDouble() * 2.5f;

                Color col;
                if (Map == MapType.Ireland)
                {
                    col = type == 0 ? new Color(34, 110, 34, 255) :
                          type == 1 ? new Color(110, 110, 110, 255) : new Color(139, 69, 19, 255);
                }
                else if (Map == MapType.Iceland)
                {
                    col = type == 0 ? new Color(220, 240, 255, 255) :
                          type == 1 ? new Color(130, 170, 200, 255) : new Color(70, 130, 180, 255);
                }
                else
                {
                    col = type == 0 ? new Color(70, 140, 50, 255) :
                          type == 1 ? new Color(180, 140, 90, 255) : new Color(140, 80, 40, 255);
                }

                Obstacles.Add(new Obstacle
                {
                    Position = new Vector3(x, y, z),
                    Radius = radius,
                    Height = height,
                    Color = col,
                    Type = type
                });
            }
        }
    }
}
