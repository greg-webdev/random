# Minecraft 1.8 / 1.12 OreFinder ⛏️💎

**OreFinder** is a high-performance .NET 10 WPF desktop application that generates accurate Minecraft 1.8 and 1.12 worlds and finds the nearest ore deposits (Diamonds, Gold, Iron, Redstone, Lapis, Coal) relative to world spawn or custom player coordinates.

---

## ⚡ Key Capabilities

- **Exact Minecraft Java 1.8 & 1.12 Parity**: Replicates the exact `java.util.Random` (48-bit LCG), chunk decoration seeding (`ChunkProviderGenerate.populate()`), and trigonometric vein ellipsoid calculations (`WorldGenMinable`).
- **Blazing Fast Multi-Threaded Scanning**: Scans over **1,000+ chunks** (50,000+ ore veins, 700,000+ blocks) in **under 350 milliseconds** using `Parallel.ForEach`.
- **Nearest Ore Highlights**: Instant discovery cards for the closest Diamond, Gold, Iron, Lapis, Redstone, and Coal deposits with:
  - Exact 3D block coordinates `(X, Y, Z)`
  - Euclidean distance to spawn
  - Compass direction (e.g. `South-East (139°)`)
  - Vein size / number of ore blocks
  - One-click copyable in-game teleport command: `/tp @p <X> <Y> <Z>`
- **Interactive UI**:
  - Filter by Ore Type (Diamond, Gold, Iron, Redstone, Lapis, Coal, All)
  - Custom Spawn Point Coordinates `(X, Y, Z)`
  - Configurable search chunk radius (8 to 48 chunks)
  - Seed randomizer & speedrun preset seeds
  - Searchable and sortable DataGrid table

---

## 🚀 How to Run the App

### Option 1: Run GUI Application (WPF Window)
From `c:\Users\geg\Documents\random\orefinder`:
```powershell
dotnet run
```
Or open and launch `c:\Users\geg\Documents\random\orefinder\bin\Debug\net10.0-windows\OreFinder.exe`.

### Option 2: Run CLI Verification Test
```powershell
dotnet run -- --test
```

---

## 🔬 In-Game Parity Verification

To verify in actual Minecraft Java 1.8 or 1.12.2:
1. Create a new world in Minecraft 1.8 or 1.12 with seed `4031384495743822299`.
2. Open chat in Minecraft and paste the teleport command for the closest diamond:
   ```
   /tp @p 7 13 8
   ```
3. Dig around `(X: 7, Y: 13, Z: 8)` and observe the Diamond Ore vein!
