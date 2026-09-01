using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using OreFinder.Models;

namespace OreFinder.Services
{
    public class WorldGeneratorService
    {
        public async Task<(List<OreLocation> Ores, WorldSummary Summary)> FindOresAsync(
            string seedInput,
            string version,
            int chunkRadius,
            int spawnX,
            int spawnY,
            int spawnZ,
            OreType? filterType = null,
            IProgress<double>? progress = null,
            CancellationToken cancellationToken = default)
        {
            var stopwatch = Stopwatch.StartNew();
            long seed = JavaRandom.ParseSeed(seedInput);

            int minChunkX = (spawnX >> 4) - chunkRadius;
            int maxChunkX = (spawnX >> 4) + chunkRadius;
            int minChunkZ = (spawnZ >> 4) - chunkRadius;
            int maxChunkZ = (spawnZ >> 4) + chunkRadius;

            int totalChunks = (maxChunkX - minChunkX + 1) * (maxChunkZ - minChunkZ + 1);
            var oreBag = new ConcurrentBag<OreLocation>();
            int processedChunks = 0;

            await Task.Run(() =>
            {
                var chunkCoords = new List<(int cx, int cz)>(totalChunks);
                for (int cx = minChunkX; cx <= maxChunkX; cx++)
                {
                    for (int cz = minChunkZ; cz <= maxChunkZ; cz++)
                    {
                        chunkCoords.Add((cx, cz));
                    }
                }

                // Sort chunks radiating outward from spawn chunk
                int centerCx = spawnX >> 4;
                int centerCz = spawnZ >> 4;
                chunkCoords.Sort((a, b) =>
                {
                    int da = (a.cx - centerCx) * (a.cx - centerCx) + (a.cz - centerCz) * (a.cz - centerCz);
                    int db = (b.cx - centerCx) * (b.cx - centerCx) + (b.cz - centerCz) * (b.cz - centerCz);
                    return da.CompareTo(db);
                });

                Parallel.ForEach(chunkCoords, new ParallelOptions
                {
                    MaxDegreeOfParallelism = Environment.ProcessorCount,
                    CancellationToken = cancellationToken
                }, coord =>
                {
                    cancellationToken.ThrowIfCancellationRequested();

                    var chunkOres = MinecraftOreGenerator.GenerateChunkOres(
                        seed, coord.cx, coord.cz, spawnX, spawnY, spawnZ, version);

                    foreach (var ore in chunkOres)
                    {
                        if (filterType == null || ore.Type == filterType.Value)
                        {
                            oreBag.Add(ore);
                        }
                    }

                    int count = Interlocked.Increment(ref processedChunks);
                    if (count % 50 == 0 || count == totalChunks)
                    {
                        progress?.Report((double)count / totalChunks * 100.0);
                    }
                });
            }, cancellationToken);

            var sortedOres = oreBag.OrderBy(o => o.Distance).ToList();
            stopwatch.Stop();

            var summary = new WorldSummary
            {
                SeedInput = seedInput,
                ParsedSeed = seed,
                Version = version,
                ChunkRadius = chunkRadius,
                TotalChunksScanned = totalChunks,
                TotalVeinsFound = sortedOres.Count,
                TotalBlocksFound = sortedOres.Sum(o => o.VeinBlockCount),
                ExecutionTimeMs = stopwatch.Elapsed.TotalMilliseconds,
                ClosestDiamond = sortedOres.FirstOrDefault(o => o.Type == OreType.Diamond),
                ClosestGold = sortedOres.FirstOrDefault(o => o.Type == OreType.Gold),
                ClosestIron = sortedOres.FirstOrDefault(o => o.Type == OreType.Iron),
                ClosestRedstone = sortedOres.FirstOrDefault(o => o.Type == OreType.Redstone),
                ClosestLapis = sortedOres.FirstOrDefault(o => o.Type == OreType.Lapis),
                ClosestCoal = sortedOres.FirstOrDefault(o => o.Type == OreType.Coal),
            };

            return (sortedOres, summary);
        }
    }
}