using System;
using System.Collections.Generic;

namespace OreFinder.Models
{
    public class WorldData
    {
        public string Seed { get; set; } = string.Empty;
        public string MinecraftVersion { get; set; } = "1.8";
        public List<OreLocation> FoundOres { get; set; } = new List<OreLocation>();
        public bool IsGenerationSuccessful { get; set; }

        public WorldData(string seed, string version)
        {
            Seed = seed ?? "0";
            MinecraftVersion = version ?? "1.8";
            IsGenerationSuccessful = false;
        }
    }
}