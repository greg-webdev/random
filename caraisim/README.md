# High-Performance C++ Maze AI Simulation (Raylib)

An ultra-fast, smooth 60+ FPS C++ implementation of the Autonomous Neural Network Maze Navigation Simulation rewritten with Raylib and MSVC.

## 🚀 Key Features & Performance
- **Blazing Fast C++ Core**: Replaces Python/Pygame overhead, achieving 60 to 500+ FPS without lag.
- **15x15 Maze Grid & Pathfinding**:
  - Randomized Depth-First Search (DFS) backtracking maze generation with cell wall topology (`walls[4]`).
  - Breadth-First Search (BFS) pathfinder computing optimal path node sequences (`shortest_path`) and $O(1)$ set lookups (`path_set`).
- **Deep 10-Hidden-Layer Neural Network (12 Stages Total)**:
  - $\text{Input: } 64 \rightarrow 48 \rightarrow 44 \rightarrow 40 \rightarrow 36 \rightarrow 32 \rightarrow 28 \rightarrow 24 \rightarrow 20 \rightarrow 16 \rightarrow 12 \rightarrow \text{Output: } 3$ (`Steering`, `Throttle`, `Brake`).
  - $\tanh(x)$ activations on all hidden and output nodes with full real-time synaptic visualization.
- **Physics, Sensors & Rock-Solid Survival**:
  - Population Size: 200 cars per generation.
  - 64 raycast sensors spanning a 170° field of view up to 100px max distance.
  - **Lethal Wall Collision**: Any physical wall contact instantly terminates the car.
  - **Predictive Corridor Centering & Early Cornering**: Lateral distance equilibrium keeps cars centered within corridors, while early cornering initiates sharp turns ($12^\circ/\text{frame}$) well before approaching head-on walls.
  - **Adaptive Corner-Braking**: Speed dynamically throttles down near walls ($1.3\text{ px/frame}$) and surges up to $60.0\text{ px/frame}$ along clear open straights.
  - **Interactive Click-to-Kill on Population Grid**: Click on any car box (0 to 199) in the sidebar population matrix to instantly eliminate that car on demand.
  - **3D Glass Maze & Follow Best Car Mode ('V' and 'F' Keys)**:
    - **Follow Best Car Mode ('F' key / 'FOLLOW BEST' button)**:
      - Automatically locks a smooth third-person chase camera behind the lead car in 3D.
      - **Zoom In/Out**: Scroll the mouse wheel to zoom anywhere from a tight bumper camera ($3.5\text{ units}$) to a wide high-altitude drone view ($75.0\text{ units}$).
      - **360° Orbit Around Car**: Click and drag horizontally to rotate the camera around the car while it drives!
    - **Full 3D Car Rotation**: 3D red rectangular cars dynamically rotate and turn with their actual steering heading around every corner.
    - **Intuitive 3D Camera Controls**:
      - **Left-Click + Drag**: 360° orbit rotation around the maze.
      - **Right-Click + Drag**: Smooth 1:1 camera panning across the maze floor.
      - **Mouse Wheel**: Smooth zoom in/out.
  - **🧬 Genetic Evolution & Strict Fitness Enforcement**:
    - **Zero-Finisher Universal Punishment & 0% Mutation**: If **no car reaches the end** in a generation, **all cars receive a heavy fitness penalty** and **mutation is locked to 0%** (`current_mutation_rate = 0.0f`). The population clones the top survivor's weights directly without random variation, forcing the exact current generation to re-evaluate without exploratory deviation.
    - **Progress Mode ($1 - 49$ Finishers)**: When cars begin solving the maze, the standard adaptive mutation rate ($15\%$) activates.
    - **25% Mastery Rule ($\ge 50$ Finishers)**: As soon as **over 25% of the population successfully reaches the goal**, the mutation rate reverts to **5% (Fine-Tuning Mode)** with standard deviation $0.08$.
    - **Live Status Tags**: Displays `MUTATION: 0% (PUNISHED)` in red, `MUTATION: 15%` in blue, or `MUTATION: 5% (FINE-TUNE)` in glowing turquoise.
  - **🧩 Dynamic Dual-Mode Pathfinding Engine**:
    - **Maze Mode (Default & on 'GEN MAZE' / Reset)**: Active on startup and whenever you click **`GEN MAZE`** or press **`R`**. Uses pure 15x15 discrete cell-by-cell BFS, dead-end avoidance thresholds, and renders the glowing **neon green solution trail**.
    - **Non-Maze Freehand Mode (Only When Custom Drawing)**: If (and only if) you draw custom walls, erase, or clear the canvas, the system seamlessly transitions into **Continuous Non-Maze Pathfinding Mode** ($200 \times 200$ high-resolution continuous BFS) to route fluid checkpoint curves along custom-drawn tracks.
  - **🟩 Vibrant Green Correct Path Solution Squares**:
    - Visited squares along the optimal solution path glow in **neon emerald green** (`Color{0, 230, 80}`) in both **2D and 3D views**.
  - **🌀 Spinner Survival Mode ('P' Key or 'SPINNER' Button)**:
    - **No Goal Objective**: The Goal is completely removed in Spinner Mode. Cars navigate and dodge purely for **survival duration** rather than seeking a target destination.
    - **Full-Perimeter Sweeping Blades ($620\text{px}$ Arm Length)**: The spinning hazard arms extend completely through and beyond the arena boundaries and corners ($\sqrt{400^2+400^2}=565.7\text{px}$). **No safe zones, corners, or hiding spots exist anywhere on the entire map.**
    - **Slow-Paced Rotational Sweep ($0.35^\circ / \text{tick}$)**: The blades sweep deliberately slower than car top speed, requiring the AI cars to **slow down, match velocity, brake on approach, and cruise steadily in the quadrant gaps** without rear-ending the blade in front or being overtaken from behind.
    - **Dynamic Kinetic Obstacle**: The AI's 64 laser sensors detect the rotating blades in real-time. Contact with the central hub or rotating blade arms crushes the car instantly.
    - **Survival Fitness Scoring**: Cars earn continuous fitness purely from ticks alive, active velocity, and hazard clearance.
    - **2D & 3D Visuals**: Rendered with glowing amber/red hazard warning blades in 2D and a massive 3D industrial kinetic rotating hazard in 3D mode.
  - **💀 Interactive Click-to-Kill System**:
    - **Direct Arena Kill**: Click directly on any car on the 2D arena grid to eliminate it instantly with a skull marker and shockwave explosion animation.
    - **Matrix Kill**: Click any car index cell in the 200-car population matrix to eliminate it.
  - **🖋️ Authentic Twentieth Century Typography (Tw Cen MT)**:
    - Entire user interface, menu buttons, telemetry data, generation matrix, and in-game HUDs utilize high-resolution bilinear-filtered **Twentieth Century** font (`Tw Cen MT` / `Tw Cen MT Bold`).
    - Collision-free, pixel-perfect UI layout with balanced padding across all resolutions.
  - **🎨 Freehand Drawing Canvas (Yellow Walls & Black Floor) with 'GO!' Launch Button**:
    - **Free Drawing on Black Canvas**: The canvas is solid Black (drivable floor) where you can freely paint **Bright Yellow Walls** (`Color{255, 220, 0, 255}`).
    - **Paint & Erase**: Left-click to paint yellow walls with adjustable brush sizes (`Small 8px`, `Med 16px`, `Large 28px`); Right-click to erase (paint Black).
    - **Finely Moveable Start Point**: Pixel-accurate placement of the **START** spawn point anywhere on the canvas by dragging with the Start Tool.
    - **Finely Moveable Goal**: Pixel-accurate placement of the **GOAL** target with a gold target radius.
    - **▶ GO! Button**: Large green button on the drawing page (`[▶ GO! (LET CARS RACE)]` or key **`G`**) to instantly unleash the 200 AI cars onto your custom drawn track.
    - **Continuous Laser Raycast & Collision**: Fast sub-stepped physics and 64 raycasts against the drawn yellow walls.
  - **🧠 Subtle, Non-Distracting Neural Synapses**:
    - Cleaned up the neural map with higher thresholding and subtle, elegant translucent synapses so the interface remains crisp and readable.
  - **⚡ 50X Headless Training Mode ('H') & System Tray Background Processing**:
    - Press **`H`** to enter **50x Headless Training Mode** ($\sim 3,000\text{ Ticks / sec}$).
    - **System Tray Background Execution**: Minimizing or closing the window in training mode hides the app to the **Windows System Tray**, continuing 50x training in the background. Clicking the tray icon instantly restores the window.
  - **🖱️ Native Windows 7 Smooth Dragging**:
    - Zero-lag, hardware-accelerated Win32 native window dragging across monitors.
  - **⏱️ Ultra-Smooth 120 FPS Slow-Mo Mode ('S' Key or 'SLOW-MO' Button)**:
    - Press **`S`** to toggle **120 FPS High Refresh Slow-Mo** ($0.25\text{x}$ speed).
  - **20-Hidden-Layer Deep Neural Architecture (22 Stages Total)**:
    - Full $\text{In}(64) \rightarrow 20\text{ Hidden Layers} \rightarrow \text{Out}(3)$ deep architecture.
  - **High-Velocity Speed Rewards**:
    - Quadratic velocity scoring: $0.5 + (1.5 \times \text{speed}) + (0.08 \times \text{speed}^2)$ plus milestone speed surges.
  - **3-Layer Impenetrable Dead-End Prevention Engine**:
    - **Layer 1: Sensor Masking**: The 64 laser sensors treat all openings leading into known dead-ends as solid impenetrable walls. The AI physically sees no opening.
    - **Layer 2: Active Rejection Steering**: Repulsive steering force ($+85\%$) actively pushes the car away from any dead-end corridor opening, locking onto the optimal BFS solution route ($+70\%$).
    - **Layer 3: Hard Virtual Barrier**: Sub-stepped physics check blocks the car from physically crossing the threshold into any dead-end cell, instantly turning heading toward the next checkpoint.
  - **AI Thought Process & Real-Time Telemetry Inspector**:
    - **Live Decision Telemetry Panel**: Dedicated telemetry dashboard in the sidebar showing exactly what the AI is thinking:
      - 🎯 **Target Milestone**: Current checkpoint, total milestones, and $\%$ path completion.
      - 🧠 **Thought Intent**: Dynamic real-time summary of the car's cognitive state (e.g. *"Dead-end opening blocked | Steering to optimal path"*, *"Full throttle along optimal corridor (Delta -3.2°)"*, *"Corner ahead: Corner-braking to 12.4 px/s"*).
      - 🚫 **Dead-End Filter Badge**: Real-time trap detector displaying clear/hazard status.
      - 🕹️ **Control Telemetry & Gauge**: Real-time steering gauge $[-1.0 \dots +1.0]$, throttle percentage, velocity, and front sensor clearance.
    - **Visual Navigation Vector**: Cyan vector arrow projecting from the leader car to its intended next checkpoint.
  - **Authentic Windows 7 Aero Glass Titlebar**: Features a full Aero Glass gradient header bar with application icon, Aero text glow, smooth window dragging, glassy blue Minimize button, and iconic ruby-red Close button with authentic specular reflections and hover blooms.
  - **Strict Path & Elimination**: Instant termination on wall collision, deviation from `path_set`, reverse angle $> 95^\circ$, or stagnation exceeding 240 ticks.
  - **Speed Rewards**: `cumulative_score += 0.2 + (speed * 0.6)` along correct path nodes.
  - **Despawn on Win**: Winner auto-despawns at `(ROWS-1, COLS-1)` with finish bonus to avoid blocking traffic.
- **Genetic Algorithm & Progression**:
  - **Run Until Done**: Each generation runs continuously until **every car has either died or reached the finish line** (`alive_count == 0`), with a generous upper safety cap ($3,000$ ticks) so navigating cars never get prematurely cut off.
  - **Stagnation Filter**: Inactive/stuck cars are automatically eliminated after 240 ticks of non-progression.
  - **Subtle Grey Optimal Path Trace**: Shows an elegant grey guide trail along the shortest path from start to finish.
  - Elitism preserving top performer across generations.
  - 10% mutation rate with Gaussian perturbation ($\mu = 0.0, \sigma = 0.15$).
  - Binary `.ai` file serialization/deserialization for exporting and importing brain weights.
- **Pixel-Perfect HUD & Live Neuron Visualizer**:
  - **Top Left HUD**: Real-time Generation counter, Alive count, Time left (400 ticks max), and Leader Fitness.
  - **Top Right Buttons**: Native Windows file dialogs for `IMPORT .AI` and `EXPORT .AI`.
  - **40-Car Population Matrix**: 10x4 grid showing car states (Dead = Black, Winner = Green, Positive Reward = Blue Gradient, Penalty = Red, Leader = White Border).
  - **Live 5-Layer Neuron Map**: Visualizes 64 inputs, 5 hidden layers (color-coded cyan for positive, red for negative activations), 3 outputs (`St`, `Th`, `Br`), and synaptic connections.
  - **Clean Raytracers**: Bright green ray tracers rendered exclusively for the current leader car.

---

## 🎮 Controls & Shortcuts
- `Space`: Cycle simulation speed multipliers (`1x` $\rightarrow$ `2x` $\rightarrow$ `5x` $\rightarrow$ `10x` $\rightarrow$ `1x`)
- `R`: Regenerate new random maze and reset population
- `I`: Import `.ai` brain file
- `E`: Export best performer's `.ai` brain file
- `ESC`: Exit simulation

---

## 🛠️ Building & Running

### Option 1: Run Precompiled Binary
Simply double-click or execute:
```cmd
maze_ai_sim.exe
```

### Option 2: Recompile with Build Script
Run the automated MSVC build script:
```cmd
build.bat
```
