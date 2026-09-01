using System;

namespace OreFinder.Models
{
    public enum OreType
    {
        Diamond,
        Gold,
        Iron,
        Redstone,
        Lapis,
        Coal,
        Emerald
    }

    public static class OreTypeExtensions
    {
        public static string GetDisplayName(this OreType type) => type switch
        {
            OreType.Diamond => "Diamond Ore",
            OreType.Gold => "Gold Ore",
            OreType.Iron => "Iron Ore",
            OreType.Redstone => "Redstone Ore",
            OreType.Lapis => "Lapis Lazuli Ore",
            OreType.Coal => "Coal Ore",
            OreType.Emerald => "Emerald Ore",
            _ => type.ToString()
        };

        public static string GetHexColor(this OreType type) => type switch
        {
            OreType.Diamond => "#38BDF8", // Cyan
            OreType.Gold => "#FACC15",    // Gold yellow
            OreType.Iron => "#FB923C",    // Iron orange-brown
            OreType.Redstone => "#EF4444",// Red
            OreType.Lapis => "#3B82F6",   // Deep blue
            OreType.Coal => "#9CA3AF",    // Charcoal gray
            OreType.Emerald => "#10B981", // Emerald green
            _ => "#FFFFFF"
        };

        public static string GetEmoji(this OreType type) => type switch
        {
            OreType.Diamond => "💎",
            OreType.Gold => "🟡",
            OreType.Iron => "⚪",
            OreType.Redstone => "🔴",
            OreType.Lapis => "🔵",
            OreType.Coal => "⚫",
            OreType.Emerald => "🟢",
            _ => "⛏️"
        };
    }

    public class OreLocation
    {
        public OreType Type { get; set; }
        public string OreName => Type.GetDisplayName();
        public string HexColor => Type.GetHexColor();
        public string Emoji => Type.GetEmoji();

        public int X { get; set; }
        public int Y { get; set; }
        public int Z { get; set; }

        public int ChunkX => X >> 4;
        public int ChunkZ => Z >> 4;

        public int VeinBlockCount { get; set; } = 1;
        public double Distance { get; set; }
        public double Distance2D { get; set; }
        public string Direction { get; set; } = string.Empty;

        public string TpCommand => $"/tp @p {X} {Y} {Z}";
        public string CoordsDisplay => $"X: {X}, Y: {Y}, Z: {Z}";
        public string DistanceDisplay => $"{Distance:F1} blocks";

        public override string ToString() => $"[{Type}] {CoordsDisplay} ({DistanceDisplay})";
    }

    public class WorldSummary
    {
        public string SeedInput { get; set; } = string.Empty;
        public long ParsedSeed { get; set; }
        public string Version { get; set; } = "1.8 / 1.12";
        public int ChunkRadius { get; set; }
        public int TotalChunksScanned { get; set; }
        public int TotalVeinsFound { get; set; }
        public int TotalBlocksFound { get; set; }
        public double ExecutionTimeMs { get; set; }

        public OreLocation? ClosestDiamond { get; set; }
        public OreLocation? ClosestGold { get; set; }
        public OreLocation? ClosestIron { get; set; }
        public OreLocation? ClosestRedstone { get; set; }
        public OreLocation? ClosestLapis { get; set; }
        public OreLocation? ClosestCoal { get; set; }
    }
}
