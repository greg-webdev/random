# Neon Chaos Sandbox: Physics & Ragdoll Playground 🎮⚡

An interactive 2D physics toy game and arcade sandbox built with Python and Pygame, featuring soft-body jelly creatures, articulated ragdolls, TNT chain reactions, gravitational singularities, kinetic shockwaves, and procedural synthesizer audio.

---

## 🚀 Quick Start

Run the standalone Windows `.exe` directly (no Python installation required):
```powershell
.\dist\NeonChaosSandbox.exe
```

Or run from source:
```powershell
python main.py
```

---

## 🕹️ Controls & God Powers

| Control | Action |
| :--- | :--- |
| **Left Click** | **Spawn** currently selected item / **Grab & Fling** any existing entity |
| **Right Click (Hold)** | **Black Hole Singularity** (swirling gravitational vortex) |
| **Spacebar / Middle Click** | **Kinetic Repulsor Shockwave** (launches all nearby objects) |
| **Keys `1` – `7`** | Select spawner tool from dock |
| **`G`** | **Cycle Gravity Modes** (Normal 1.0G ➔ Moon 0.2G ➔ Zero-G ➔ Inverted -1.0G) |
| **`T` / `Tab`** | **Toggle Slow-Motion Bullet Time** (0.2x speed) |
| **`C`** | Clear all objects from screen |
| **`R`** | Reset scene to default interactive playground |
| **`H`** | Show / Hide Controls Overlay |
| **`Esc`** | Exit application |

---

## 🛠️ Spawner Tools (Keys 1 – 7)

1. **`[1] Jelly`**: Squishy gelatinous soft-body blobs with volume-preservation springs and cute animated cartoon eyes that track your cursor and blink.
2. **`[2] Ragdoll`**: Humanoid articulated stick skeletons with physics joints you can drag, toss, and tumble.
3. **`[3] Neon Ball`**: High-elasticity glowing bouncy balls that play harmonious pentatonic chimes on collisions.
4. **`[4] TNT Crate`**: Explosive crates that detonate on heavy impacts or laser contact, triggering devastating chain reactions!
5. **`[5] Bumper`**: High-impulse pinball bumpers that flash and repel objects with retro arcade sound fx.
6. **`[6] Portal`**: Click twice to place entrance and exit wormholes that preserve and redirect momentum.
7. **`[7] Laser`**: Interactive energy beam that slices through space, ignites TNT fuses, and pushes objects.

---

## 🎵 100% Procedural Synthesizer Audio

All sounds (pentatonic bounce notes, squish sounds, explosions, shockwaves, portals, bumpers) are synthesized algorithmically in real time using NumPy math waveforms into Pygame audio buffers. Zero external `.wav`/`.mp3` files are required.

---

## 📦 Building the Executable

To rebuild the single-file executable:
```powershell
python -m PyInstaller --clean --onefile --windowed --icon=icon.ico --name NeonChaosSandbox main.py
```
Output executable: `dist/NeonChaosSandbox.exe`
