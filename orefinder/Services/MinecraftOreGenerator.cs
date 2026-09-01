using System;
using System.Collections.Generic;
using OreFinder.Models;

namespace OreFinder.Services
{
    /// <summary>
    /// Exact implementation of Minecraft 1.8 / 1.12 chunk decoration and ore vein placement.
    /// </summary>
    public static class MinecraftOreGenerator
    {
        public struct VeinConfig
        {
            public OreType Type;
            public int VeinCount;
            public int NumberOfBlocks;
            public int MinHeight;
            public int MaxHeight;
            public bool IsTriangleDistribution; // For Lapis
        }

        // Exact Minecraft 1.8 / 1.12 Decorator parameters
        public static readonly VeinConfig[] StandardConfigs = new[]
        {
            // Note: In Minecraft, decorative stone runs first (Dirt, Gravel, Granite, Diorite, Andesite)
            // Dirt: 20 veins, size 33, 0..256
            // Gravel: 10 veins, size 33, 0..256
            // Granite/Diorite/Andesite: 10 veins each, size 33, 0..80
            new VeinConfig { Type = OreType.Coal, VeinCount = 20, NumberOfBlocks = 17, MinHeight = 0, MaxHeight = 128 },
            new VeinConfig { Type = OreType.Iron, VeinCount = 20, NumberOfBlocks = 9, MinHeight = 0, MaxHeight = 64 },
            new VeinConfig { Type = OreType.Gold, VeinCount = 2, NumberOfBlocks = 9, MinHeight = 0, MaxHeight = 32 },
            new VeinConfig { Type = OreType.Redstone, VeinCount = 8, NumberOfBlocks = 8, MinHeight = 0, MaxHeight = 16 },
            new VeinConfig { Type = OreType.Diamond, VeinCount = 1, NumberOfBlocks = 8, MinHeight = 0, MaxHeight = 16 },
            new VeinConfig { Type = OreType.Lapis, VeinCount = 1, NumberOfBlocks = 7, MinHeight = 0, MaxHeight = 32, IsTriangleDistribution = true },
        };

        /// <summary>
        /// Generates all ore veins inside a specific chunk (chunkX, chunkZ) using exact 1.8 / 1.12 RNG seeding.
        /// </summary>
        public static List<OreLocation> GenerateChunkOres(long worldSeed, int chunkX, int chunkZ, int spawnX, int spawnY, int spawnZ, string version = "1.8")
        {
            var results = new List<OreLocation>();

            // 1. Exact Chunk RNG Seeding from Minecraft ChunkProviderGenerate.populate()
            var rand = new JavaRandom();
            rand.SetSeed(worldSeed);
            long i1 = rand.NextLong() / 2L * 2L + 1L;
            long j1 = rand.NextLong() / 2L * 2L + 1L;
            long chunkSeed = (long)chunkX * i1 + (long)chunkZ * j1 ^ worldSeed;
            rand.SetSeed(chunkSeed);

            int chunkOriginX = chunkX * 16;
            int chunkOriginZ = chunkZ * 16;

            // 2. Consume RNG for pre-ore decorators (Dirt, Gravel, Stones)
            // Dirt: 20 veins of size 33, 0..256
            GenerateStoneVeins(rand, 20, 33, 0, 256, chunkOriginX, chunkOriginZ);
            // Gravel: 10 veins of size 33, 0..256
            GenerateStoneVeins(rand, 10, 33, 0, 256, chunkOriginX, chunkOriginZ);

            if (version == "1.8" || version == "1.12")
            {
                // Granite: 10 veins of size 33, 0..80
                GenerateStoneVeins(rand, 10, 33, 0, 80, chunkOriginX, chunkOriginZ);
                // Diorite: 10 veins of size 33, 0..80
                GenerateStoneVeins(rand, 10, 33, 0, 80, chunkOriginX, chunkOriginZ);
                // Andesite: 10 veins of size 33, 0..80
                GenerateStoneVeins(rand, 10, 33, 0, 80, chunkOriginX, chunkOriginZ);
            }

            // 3. Generate each ore type in exact sequence
            foreach (var cfg in StandardConfigs)
            {
                for (int v = 0; v < cfg.VeinCount; v++)
                {
                    int vx = chunkOriginX + rand.NextInt(16);
                    int vy;

                    if (cfg.IsTriangleDistribution)
                    {
                        // Lapis triangular distribution: center 16, spread 16
                        vy = rand.NextInt(16) + rand.NextInt(16);
                    }
                    else
                    {
                        vy = rand.NextInt(cfg.MaxHeight - cfg.MinHeight) + cfg.MinHeight;
                    }

                    int vz = chunkOriginZ + rand.NextInt(16);

                    // Execute WorldGenMinable and get block positions
                    var veinBlocks = GenerateMinableVein(rand, cfg.NumberOfBlocks, vx, vy, vz);
                    if (veinBlocks.Count > 0)
                    {
                        // Pick center of vein for main position
                        int midIdx = veinBlocks.Count / 2;
                        var center = veinBlocks[midIdx];

                        double dx = center.X - spawnX;
                        double dy = center.Y - spawnY;
                        double dz = center.Z - spawnZ;
                        double dist3D = Math.Sqrt(dx * dx + dy * dy + dz * dz);
                        double dist2D = Math.Sqrt(dx * dx + dz * dz);

                        string dir = CalculateDirection(dx, dz);

                        results.Add(new OreLocation
                        {
                            Type = cfg.Type,
                            X = center.X,
                            Y = center.Y,
                            Z = center.Z,
                            VeinBlockCount = veinBlocks.Count,
                            Distance = dist3D,
                            Distance2D = dist2D,
                            Direction = dir
                        });
                    }
                }
            }

            return results;
        }

        private static void GenerateStoneVeins(JavaRandom rand, int count, int blocks, int minH, int maxH, int chunkX, int chunkZ)
        {
            for (int i = 0; i < count; i++)
            {
                int x = chunkX + rand.NextInt(16);
                int y = rand.NextInt(maxH - minH) + minH;
                int z = chunkZ + rand.NextInt(16);
                GenerateMinableVein(rand, blocks, x, y, z);
            }
        }

        /// <summary>
        /// Exact WorldGenMinable algorithm from Minecraft Java 1.8 / 1.12.
        /// Replicates the mathematical ellipsoid interpolation.
        /// </summary>
        private static List<(int X, int Y, int Z)> GenerateMinableVein(JavaRandom rand, int numberOfBlocks, int startX, int startY, int startZ)
        {
            var blocks = new List<(int X, int Y, int Z)>();
            var visited = new HashSet<long>();

            float f = rand.NextFloat() * (float)Math.PI;
            double d0 = (double)((float)(startX + 8) + (float)Math.Sin(f) * (float)numberOfBlocks / 8.0F);
            double d1 = (double)((float)(startX + 8) - (float)Math.Sin(f) * (float)numberOfBlocks / 8.0F);
            double d2 = (double)((float)(startZ + 8) + (float)Math.Cos(f) * (float)numberOfBlocks / 8.0F);
            double d3 = (double)((float)(startZ + 8) - (float)Math.Cos(f) * (float)numberOfBlocks / 8.0F);
            double d4 = (double)(startY + rand.NextInt(3) - 2);
            double d5 = (double)(startY + rand.NextInt(3) - 2);

            for (int i = 0; i < numberOfBlocks; ++i)
            {
                float f1 = (float)i / (float)numberOfBlocks;
                double d6 = d0 + (d1 - d0) * (double)f1;
                double d7 = d4 + (d5 - d4) * (double)f1;
                double d8 = d2 + (d3 - d2) * (double)f1;
                double d9 = rand.NextDouble() * (double)numberOfBlocks / 16.0D;
                double d10 = ((double)Math.Sin((float)Math.PI * f1) + 1.0D) * d9 + 1.0D;
                double d11 = ((double)Math.Sin((float)Math.PI * f1) + 1.0D) * d9 + 1.0D;

                int minX = (int)Math.Floor(d6 - d10 / 2.0D);
                int minY = (int)Math.Floor(d7 - d11 / 2.0D);
                int minZ = (int)Math.Floor(d8 - d10 / 2.0D);
                int maxX = (int)Math.Floor(d6 + d10 / 2.0D);
                int maxY = (int)Math.Floor(d7 + d11 / 2.0D);
                int maxZ = (int)Math.Floor(d8 + d10 / 2.0D);

                for (int bx = minX; bx <= maxX; ++bx)
                {
                    double d12 = ((double)bx + 0.5D - d6) / (d10 / 2.0D);
                    if (d12 * d12 < 1.0D)
                    {
                        for (int by = minY; by <= maxY; ++by)
                        {
                            double d13 = ((double)by + 0.5D - d7) / (d11 / 2.0D);
                            if (d12 * d12 + d13 * d13 < 1.0D)
                            {
                                for (int bz = minZ; bz <= maxZ; ++bz)
                                {
                                    double d14 = ((double)bz + 0.5D - d8) / (d10 / 2.0D);
                                    if (d12 * d12 + d13 * d13 + d14 * d14 < 1.0D)
                                    {
                                        long key = ((long)bx & 0x3FFFFFF) | (((long)bz & 0x3FFFFFF) << 26) | (((long)by & 0xFFF) << 52);
                                        if (visited.Add(key))
                                        {
                                            blocks.Add((bx, by, bz));
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            return blocks;
        }

        public static string CalculateDirection(double dx, double dz)
        {
            double angle = Math.Atan2(dx, -dz) * (180.0 / Math.PI);
            if (angle < 0) angle += 360;

            string[] directions = { "North", "North-East", "East", "South-East", "South", "South-West", "West", "North-West", "North" };
            int index = (int)Math.Round(angle / 45.0) % 8;
            return $"{directions[index]} ({angle:F0}°)";
        }
    }
}
