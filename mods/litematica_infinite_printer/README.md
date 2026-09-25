# ⚡ Litematica Infinite Printer

A high-performance Fabric client-side mod for **Minecraft 1.21.11** that extends **Litematica** with **automated block placement**, **automated block breaking**, **automated BlockState & orientation tuning**, **redstone update suppression**, and **toggleable infinite reach**.

---

## 🌟 Key Features

1. **🛡 Redstone Safe Building & Update Suppression**
   - **Litematica World Update Suppression**: Automatically engages Litematica's built-in block update suppressor on the client level while printing (`IWorldUpdateSuppressor`), preventing premature neighbor updates or desyncs from breaking redstone machines.
   - **4-Stage Redstone Dependency Sorting**:
     1. **Stage 1 (Structure & Solid)**: Solid support blocks, concrete, stone, terracotta, obsidian, glass, wood, iron.
     2. **Stage 2 (Mechanics & Containers)**: Hoppers, chests, droppers, dispensers, cauldrons, composters.
     3. **Stage 3 (Actuators)**: Pistons and Sticky Pistons (placed in their proper retracted state before signals connect).
     4. **Stage 4 (Power & Logic)**: Redstone wire, repeaters, comparators, observers, redstone torches, levers.
   - **Zero Redstone Misfires**: Foundations, pistons, and containers are guaranteed to be in place before any redstone dust or observers are placed, preventing pistons from firing or machines from jamming during construction.
   - **Rate-Limited Signal Placement**: Places redstone power components at a controlled rate (2 per tick) to prevent cascading signal updates.

2. **🚫 Anti-Spam Placement Engine**
   - **Position Cooldown Cache**: When a placement packet is dispatched, the position enters a 6-tick cooldown until the server confirms the placement, eliminating packet flooding and network desyncs.
   - **`canSurvive` Dependency Check**: Verifies that blocks requiring floor support (Repeaters, Comparators, Redstone Wire, Torches, Doors, Rails, Carpets) have their floor block placed before attempting to place them.
   - **Valid Neighbor Face Validation**: Blocks are only attempted when at least one solid adjacent face exists to click against.
   - **Ghost-Click Elimination**: Removed extraneous air-click packets (`useItem`) that caused spam.

3. **⚡ Intelligent Block Placement & Orientation Control**
   - **Target-Oriented Rotation Packets**: Automatically calculates and dispatches the exact player yaw and pitch packets when placing directional blocks (Pistons, Observers, Droppers, Dispensers, Repeaters, Comparators, Stairs, Furnaces, Chests, Hoppers).
   - **Precise Slabs & Stairs Half**: Accurately targets the upper hit zone (`y + 0.85`) or lower zone (`y + 0.15`) or top/bottom neighbor faces so slabs and stairs place right side up or upside down as specified in the schematic.
   - **Hopper & Pillar/Axis Alignment**: Aligns hoppers to attach to their intended target and logs/pillars/chains along the X, Y, or Z axis.

4. **🎛 Automated BlockState Tuning (Repeaters, Delays, Modes & Notes)**
   - **Repeater Delay**: Automatically calculates difference `(targetDelay - curDelay + 4) % 4` and right-clicks repeaters to match the schematic delay (1 to 4).
   - **Comparator Mode**: Automatically toggles between Compare and Subtract mode.
   - **Daylight Detectors**: Automatically inverts/un-inverts daylight detectors.
   - **Note Blocks**: Automatically tunes note blocks to the exact note pitch (0–24).
   - **Trapdoors & Fence Gates**: Automatically toggles open/closed states.
   - **Campfires**: Automatically equips a shovel from hotbar/inventory and extinguishes campfires if unlit in the schematic.
   - **Log Stripping & Farmland**: Automatically equips an axe to strip logs or a hoe to till farmland.

5. **⛏ Automated Block Breaking (Auto-Break)**
   - Automatically detects and breaks obstacles, terrain, or incorrectly placed/oriented blocks.
   - **Smart Tool Auto-Switch**: Automatically swaps to the best tool (Pickaxe, Axe, Shovel, Shears) with the highest destroy speed.
   - Fast packet-breaking in survival and instant break in creative.
   - Ignores unbreakable blocks (bedrock, barriers, portals).

6. **🎯 Infinite Reach & Configurable Range**
   - **Infinite Reach Mode (∞)**: Prints and clears across all loaded chunks within the schematic boundaries without vanilla 4.5m distance checks.
   - **Configurable Range Mode**: Adjustable range slider (from 16m up to 256m) for servers with strict anticheat.

7. **🎒 Inventory & Creative Management**
   - **Auto-Switch / Hotbar Pick**: Automatically switches hotbar slot or swaps items from main inventory (slots 9–35) when a block is needed.
   - **Creative Auto-Pick**: Automatically spawns and equips the required item in creative mode if not in inventory.

8. **📐 Respect Litematica Layer Range**
   - When enabled, respects Litematica's active Layer Range (`Single Layer`, `All Below`, `Range`).

9. **🖥 In-Game HUD Overlay & Settings Screen**
   - Translucent on-screen HUD badge displaying Printer status, Auto-Break status, Reach mode, queued blocks (place/break/adjust), and total counts.
   - Custom in-game settings screen accessible anytime via `O` or `/printer gui`.

---

## ⌨ Controls & Hotkeys

| Hotkey | Action | Default Key |
|---|---|---|
| **Toggle Printer** | Turn automatic printing ON / OFF | `CAPS LOCK` |
| **Toggle Auto-Break** | Turn automatic block breaking ON / OFF | `B` |
| **Toggle Reach Mode** | Toggle between Infinite (∞) and Limited reach | `N` |
| **Open Settings GUI** | Open full in-game configuration menu | `O` |

*(All hotkeys are rebindable in **Options** ➔ **Controls** ➔ **Key Binds** under "Litematica Infinite Printer".)*

---

## 💬 In-Game Commands

- `/printer` - View status summary (speeds, remaining queue, totals, reach mode).
- `/printer toggle` - Toggle printer ON/OFF.
- `/printer autobreak [true|false]` - Toggle or set auto-break state.
- `/printer blockstate [true|false]` - Toggle automatic BlockState tuning.
- `/printer reach infinite` - Enable unrestricted infinite reach.
- `/printer reach <blocks>` - Set custom reach distance (e.g. `/printer reach 48`).
- `/printer speed <1-64>` - Set placement speed (blocks placed per tick).
- `/printer breakspeed <1-16>` - Set breaking speed (blocks broken per tick).
- `/printer gui` - Open the in-game GUI settings screen.
- `/printer reset` - Reset placed, broken, and adjusted block counters.

---

## 📁 Installation

The compiled jar is installed at:
`%appdata%\.minecraft\mods\litematica-infinite-printer-1.0.0.jar`
