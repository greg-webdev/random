import * as THREE from 'three';
import { TrackManager } from './world/track.js';
import { createCyberCar } from './world/carModel.js';
import { Vehicle } from './physics/vehicle.js';
import { SoundManager } from './audio/soundManager.js';
import { OllamaService } from './ollama/ollamaService.js';
import { OllamaDriver } from './ai/ollamaDriver.js';

class Game {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.clock = new THREE.Clock();

    // Scene & Renderer
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    // Camera Modes: 'chase' | 'hood' | 'cinematic'
    this.cameraMode = 'chase';
    this.cameraOffset = new THREE.Vector3(0, 3.8, -8.5);
    this.cameraLookOffset = new THREE.Vector3(0, 1.2, 5.0);

    // Systems
    this.track = null;
    this.playerCar = null;
    this.aiCar = null;
    this.playerVehicle = null;
    this.aiVehicle = null;
    this.sound = null;
    this.ollama = null;
    this.aiDriver = null;

    // Game State
    this.state = 'MENU'; // 'MENU' | 'COUNTDOWN' | 'RACING' | 'FINISHED'
    this.targetLaps = 3;
    this.raceStartTime = 0;
    this.raceTimer = 0;
    this.countdownValue = 3;

    // Inputs
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      drift: false,
      boost: false
    };

    // UI Cache
    this.ui = {};
  }

  async init() {
    this.cacheUI();
    this.setupThree();
    this.setupAudioAndAI();
    this.setupWorld();
    this.setupControls();
    this.setupUIEventListeners();

    // Check Ollama models in background
    await this.refreshOllamaModels();

    // Resize listener
    window.addEventListener('resize', () => this.onWindowResize());

    // Start render loop
    this.animate();
  }

  cacheUI() {
    this.ui = {
      startScreen: document.getElementById('start-screen'),
      btnStart: document.getElementById('btn-start-game'),
      countdownOverlay: document.getElementById('countdown-overlay'),
      countdownText: document.getElementById('countdown-text'),
      playerPos: document.getElementById('player-position'),
      lapCounter: document.getElementById('lap-counter'),
      currentLapTime: document.getElementById('current-lap-time'),
      bestLapTime: document.getElementById('best-lap-time'),
      gapDisplay: document.getElementById('gap-display'),
      aiModelTag: document.getElementById('ai-model-tag'),
      aiAvatar: document.getElementById('ai-avatar'),
      audioWave: document.getElementById('audio-wave'),
      aiTacticBadge: document.getElementById('ai-tactic-badge'),
      aiPersonaLabel: document.getElementById('ai-persona-label'),
      commsText: document.getElementById('comms-text'),
      aiLatency: document.getElementById('ai-latency'),
      aiBoostState: document.getElementById('ai-boost-state'),
      aiLineState: document.getElementById('ai-line-state'),
      nitroBarFill: document.getElementById('nitro-bar-fill'),
      driftNotice: document.getElementById('drift-notice'),
      speedoFill: document.getElementById('speedo-fill'),
      speedoNumber: document.getElementById('speedo-number'),
      gearIndicator: document.getElementById('gear-indicator'),
      minimapCanvas: document.getElementById('minimap-canvas'),
      resultsModal: document.getElementById('results-modal'),
      resultsTitle: document.getElementById('results-title'),
      resultsSubtitle: document.getElementById('results-subtitle'),
      resTotalTime: document.getElementById('res-total-time'),
      resBestLap: document.getElementById('res-best-lap'),
      resAiTime: document.getElementById('res-ai-time'),
      resAiModel: document.getElementById('res-ai-model'),
      resAiQuote: document.getElementById('res-ai-quote'),
      btnPlayAgain: document.getElementById('btn-play-again'),
      btnOpenSettings: document.getElementById('btn-open-settings'),
      settingsModal: document.getElementById('settings-modal'),
      btnCloseSettings: document.getElementById('btn-close-settings'),
      btnApplySettings: document.getElementById('btn-apply-settings'),
      selectModel: document.getElementById('select-ollama-model'),
      selectPersona: document.getElementById('select-ai-persona'),
      selectDifficulty: document.getElementById('select-difficulty'),
      selectLaps: document.getElementById('select-laps'),
      selectFreq: document.getElementById('select-ai-freq'),
      btnRefreshModels: document.getElementById('btn-refresh-models'),
      btnToggleSound: document.getElementById('btn-toggle-sound'),
      btnToggleTTS: document.getElementById('btn-toggle-tts'),
      btnCamera: document.getElementById('btn-camera'),
      btnSettings: document.getElementById('btn-settings'),
      ollamaPingStatus: document.getElementById('ollama-ping-status'),
      detectedModelHero: document.getElementById('detected-model-hero')
    };
  }

  setupThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060713);
    this.scene.fog = new THREE.FogExp2(0x060713, 0.0018);

    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(65, aspect, 0.1, 1500);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    // Dynamic Lighting
    const ambientLight = new THREE.AmbientLight(0x2d3748, 1.2);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x93c5fd, 2.0);
    dirLight.position.set(120, 200, 80);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 600;
    const d = 160;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    this.scene.add(dirLight);

    // Atmospheric neon fill light
    const hemiLight = new THREE.HemisphereLight(0x00f3ff, 0xff007f, 0.6);
    this.scene.add(hemiLight);
  }

  setupAudioAndAI() {
    this.sound = new SoundManager();
    this.ollama = new OllamaService();
  }

  setupWorld() {
    // 1. Build Track
    this.track = new TrackManager(this.scene);
    this.track.buildTrack();

    // 2. Build Player & AI Cars
    this.playerCar = createCyberCar(false);
    this.aiCar = createCyberCar(true);

    this.scene.add(this.playerCar.mesh);
    this.scene.add(this.aiCar.mesh);

    this.playerVehicle = new Vehicle(this.playerCar, false);
    this.aiVehicle = new Vehicle(this.aiCar, true);

    // 3. Connect AI Pilot
    this.aiDriver = new OllamaDriver(this.aiVehicle, this.track, this.ollama, this.sound);
    this.aiDriver.onRadioMessage = (msg) => this.handleAIRadioMessage(msg);

    // 4. Place vehicles on starting grid
    this.resetGridPositions();
  }

  resetGridPositions() {
    const startPt = this.track.spline.getPointAt(0);
    const startTangent = this.track.spline.getTangentAt(0).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3().crossVectors(startTangent, up).normalize();

    // Player on Pole (left side of grid)
    const playerStart = startPt.clone().addScaledVector(normal, -3.8);
    this.playerVehicle.reset(playerStart, startTangent);

    // AI Opponent on 2nd slot (right side of grid)
    const aiStart = startPt.clone().addScaledVector(normal, 3.8);
    this.aiVehicle.reset(aiStart, startTangent);

    // Position camera behind player
    this.updateCamera(0.016, true);
  }

  setupControls() {
    window.addEventListener('keydown', (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = true;
          break;
        case 'Space':
          this.keys.drift = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.boost = true;
          break;
        case 'KeyC':
          this.cycleCamera();
          break;
        case 'KeyR':
          this.resetGridPositions();
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = false;
          break;
        case 'Space':
          this.keys.drift = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.boost = false;
          break;
      }
    });
  }

  setupUIEventListeners() {
    this.ui.btnStart.addEventListener('click', () => this.startCountdown());
    this.ui.btnPlayAgain.addEventListener('click', () => {
      this.ui.resultsModal.classList.add('hidden');
      this.startCountdown();
    });

    this.ui.btnOpenSettings.addEventListener('click', () => {
      this.ui.settingsModal.classList.remove('hidden');
    });

    this.ui.btnSettings.addEventListener('click', () => {
      this.ui.settingsModal.classList.remove('hidden');
    });

    this.ui.btnCloseSettings.addEventListener('click', () => {
      this.ui.settingsModal.classList.add('hidden');
    });

    this.ui.btnApplySettings.addEventListener('click', () => {
      this.applySettings();
      this.ui.settingsModal.classList.add('hidden');
      this.startCountdown();
    });

    this.ui.btnRefreshModels.addEventListener('click', async () => {
      await this.refreshOllamaModels();
    });

    this.ui.btnToggleSound.addEventListener('click', () => {
      const enabled = this.sound.toggleSound();
      this.ui.btnToggleSound.textContent = enabled ? '🔊 SOUND ON' : '🔇 SOUND OFF';
    });

    this.ui.btnToggleTTS.addEventListener('click', () => {
      const enabled = this.sound.toggleTTS();
      this.ui.btnToggleTTS.textContent = enabled ? '🎙️ VOICE ON' : '🔇 VOICE OFF';
    });

    this.ui.btnCamera.addEventListener('click', () => {
      this.cycleCamera();
    });
  }

  cycleCamera() {
    if (this.cameraMode === 'chase') {
      this.cameraMode = 'hood';
      this.ui.btnCamera.textContent = '📷 CAM: HOOD';
    } else if (this.cameraMode === 'hood') {
      this.cameraMode = 'far';
      this.ui.btnCamera.textContent = '📷 CAM: HELI';
    } else {
      this.cameraMode = 'chase';
      this.ui.btnCamera.textContent = '📷 CAM: CHASE';
    }
  }

  async refreshOllamaModels() {
    const isOnline = await this.ollama.checkConnection();
    if (this.ui.ollamaPingStatus) {
      this.ui.ollamaPingStatus.textContent = isOnline ? 'Online' : 'Offline (Reflex Mode)';
      this.ui.ollamaPingStatus.className = `status-text ${isOnline ? 'online' : 'offline'}`;
    }

    if (this.ui.detectedModelHero) {
      this.ui.detectedModelHero.innerHTML = isOnline
        ? `<span class="pulse-indicator"></span> Ollama online &bull; Active: <strong>${this.ollama.activeModel}</strong>`
        : `<span class="pulse-indicator" style="background:#f59e0b"></span> Ollama offline &bull; Autonomous Pilot ready`;
    }

    if (this.ui.selectModel) {
      this.ui.selectModel.innerHTML = '';
      this.ollama.availableModels.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        if (m === this.ollama.activeModel) opt.selected = true;
        this.ui.selectModel.appendChild(opt);
      });
    }

    this.ui.aiModelTag.textContent = `${this.ollama.activeModel}`;
  }

  applySettings() {
    this.ollama.activeModel = this.ui.selectModel.value;
    this.ollama.persona = this.ui.selectPersona.value;
    this.aiDriver.setDifficulty(this.ui.selectDifficulty.value);
    this.targetLaps = parseInt(this.ui.selectLaps.value, 10);
    this.aiDriver.tacticalCycleMs = parseInt(this.ui.selectFreq.value, 10);

    const personaNames = {
      apex: 'Apex Alpha (Aggressive)',
      oracle: 'Cyber Oracle (Precision)',
      chaos: 'Chaos Speedster (Wild)'
    };
    this.ui.aiPersonaLabel.textContent = `Persona: ${personaNames[this.ollama.persona]}`;
    this.ui.aiModelTag.textContent = `${this.ollama.activeModel}`;
  }

  startCountdown() {
    this.sound.init(); // User gesture unlocks audio context
    this.ui.startScreen.classList.add('hidden');
    this.ui.resultsModal.classList.add('hidden');
    this.resetGridPositions();

    this.state = 'COUNTDOWN';
    this.countdownValue = 3;
    this.ui.countdownOverlay.classList.remove('hidden');
    this.ui.countdownText.textContent = '3';
    this.sound.playCountdown(3);

    const countdownTimer = setInterval(() => {
      this.countdownValue--;
      if (this.countdownValue > 0) {
        this.ui.countdownText.textContent = `${this.countdownValue}`;
        this.sound.playCountdown(this.countdownValue);
      } else if (this.countdownValue === 0) {
        this.ui.countdownText.textContent = 'GO!';
        this.sound.playCountdown(0);
      } else {
        clearInterval(countdownTimer);
        this.ui.countdownOverlay.classList.add('hidden');
        this.state = 'RACING';
        this.raceStartTime = performance.now();
        this.playerVehicle.lapStartTime = performance.now();
        this.aiVehicle.lapStartTime = performance.now();
      }
    }, 900);
  }

  handleAIRadioMessage(msg) {
    this.ui.commsText.textContent = `"${msg.text}"`;
    this.ui.aiTacticBadge.textContent = msg.tactic;
    this.ui.aiLatency.textContent = `Ping: ${msg.latency}ms`;
    this.ui.aiLineState.textContent = `Line: ${msg.line.toUpperCase()}`;

    // Animate audio waves while speaking
    this.ui.audioWave.classList.add('speaking');
    setTimeout(() => {
      this.ui.audioWave.classList.remove('speaking');
    }, 2800);
  }

  updateCamera(delta, snap = false) {
    const carPos = this.playerVehicle.position;
    const carForward = this.playerVehicle.forward;

    let targetCamPos;
    let targetLookAt;

    if (this.cameraMode === 'hood') {
      targetCamPos = carPos.clone().add(new THREE.Vector3(0, 1.1, 0)).addScaledVector(carForward, 0.4);
      targetLookAt = carPos.clone().add(new THREE.Vector3(0, 1.0, 0)).addScaledVector(carForward, 20);
    } else if (this.cameraMode === 'far') {
      targetCamPos = carPos.clone().add(new THREE.Vector3(0, 14, 0)).addScaledVector(carForward, -24);
      targetLookAt = carPos.clone().addScaledVector(carForward, 10);
    } else {
      // Standard Chase
      const fovBoostOffset = this.playerVehicle.isBoosting ? -1.8 : 0;
      targetCamPos = carPos.clone()
        .add(new THREE.Vector3(0, this.cameraOffset.y, 0))
        .addScaledVector(carForward, this.cameraOffset.z + fovBoostOffset);
      targetLookAt = carPos.clone().add(this.cameraLookOffset);
    }

    if (snap) {
      this.camera.position.copy(targetCamPos);
      this.camera.lookAt(targetLookAt);
    } else {
      this.camera.position.lerp(targetCamPos, delta * 8.0);
      const currentLook = new THREE.Vector3();
      this.camera.getWorldDirection(currentLook);
      const desiredDir = new THREE.Vector3().subVectors(targetLookAt, this.camera.position).normalize();
      currentLook.lerp(desiredDir, delta * 12.0);
      this.camera.lookAt(this.camera.position.clone().add(currentLook));
    }

    // Dynamic FOV warp when boosting
    const targetFOV = this.playerVehicle.isBoosting ? 78 : 65;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, delta * 5.0);
    this.camera.updateProjectionMatrix();
  }

  updateHUD() {
    // 1. Position
    const isPlayerAhead = this.playerVehicle.totalProgress >= this.aiVehicle.totalProgress;
    this.ui.playerPos.textContent = isPlayerAhead ? '1' : '2';

    // 2. Lap Counter
    this.ui.lapCounter.innerHTML = `${Math.min(this.playerVehicle.currentLap, this.targetLaps)}<span class="sub">/${this.targetLaps}</span>`;

    // 3. Lap Timing
    if (this.state === 'RACING') {
      const curLapSec = (performance.now() - this.playerVehicle.lapStartTime) / 1000;
      this.ui.currentLapTime.textContent = this.formatTime(curLapSec);

      if (this.playerVehicle.bestLapTime !== Infinity) {
        this.ui.bestLapTime.textContent = this.formatTime(this.playerVehicle.bestLapTime);
      }
    }

    // 4. Gap Indicator
    const gapSec = (Math.abs(this.playerVehicle.totalProgress - this.aiVehicle.totalProgress) * 45).toFixed(1);
    if (isPlayerAhead) {
      this.ui.gapDisplay.textContent = `AHEAD +${gapSec}s`;
      this.ui.gapDisplay.className = 'gap-val leading';
    } else {
      this.ui.gapDisplay.textContent = `BEHIND -${gapSec}s`;
      this.ui.gapDisplay.className = 'gap-val trailing';
    }

    // 5. Speedometer & Gear
    const kmh = this.playerVehicle.getSpeedKMH();
    this.ui.speedoNumber.textContent = `${kmh}`.padStart(3, '0');

    // Speedometer SVG arc fill: stroke-dasharray 251.2
    const maxDisplayKMH = 260;
    const speedRatio = Math.min(kmh / maxDisplayKMH, 1.0);
    const strokeOffset = 251.2 * (1.0 - speedRatio);
    this.ui.speedoFill.style.strokeDashoffset = `${strokeOffset}`;

    // Gear indicator
    const gear = kmh < 5 ? 'N' : kmh < 60 ? '1' : kmh < 110 ? '2' : kmh < 170 ? '3' : kmh < 220 ? '4' : '5';
    this.ui.gearIndicator.textContent = `GEAR ${gear}`;

    // 6. Nitro & Drift UI
    this.ui.nitroBarFill.style.width = `${this.playerVehicle.nitro}%`;
    if (this.playerVehicle.isDrifting) {
      this.ui.driftNotice.classList.add('active');
    } else {
      this.ui.driftNotice.classList.remove('active');
    }

    // 7. Render Minimap
    this.renderMinimap();
  }

  renderMinimap() {
    const canvas = this.ui.minimapCanvas;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Track bounds mapping
    const minX = -240, maxX = 280;
    const minZ = -200, maxZ = 360;

    const mapX = (x) => ((x - minX) / (maxX - minX)) * (w - 30) + 15;
    const mapZ = (z) => ((z - minZ) / (maxZ - minZ)) * (h - 30) + 15;

    // Draw track circuit outline
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.4)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    const points = this.track.trackPoints;
    for (let i = 0; i < points.length; i++) {
      const px = mapX(points[i].x);
      const pz = mapZ(points[i].z);
      if (i === 0) ctx.moveTo(px, pz);
      else ctx.lineTo(px, pz);
    }
    ctx.closePath();
    ctx.stroke();

    // Draw AI car blip (Magenta)
    const aiX = mapX(this.aiVehicle.position.x);
    const aiZ = mapZ(this.aiVehicle.position.z);
    ctx.fillStyle = '#ff007f';
    ctx.beginPath();
    ctx.arc(aiX, aiZ, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw Player car blip (Cyan triangle)
    const pX = mapX(this.playerVehicle.position.x);
    const pZ = mapZ(this.playerVehicle.position.z);
    ctx.fillStyle = '#00f3ff';
    ctx.beginPath();
    ctx.arc(pX, pZ, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  formatTime(totalSec) {
    const m = Math.floor(totalSec / 60);
    const s = Math.floor(totalSec % 60);
    const ms = Math.floor((totalSec % 1) * 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }

  checkRaceFinish() {
    if (this.state !== 'RACING') return;

    const playerDone = this.playerVehicle.currentLap > this.targetLaps;
    const aiDone = this.aiVehicle.currentLap > this.targetLaps;

    if (playerDone || aiDone) {
      this.state = 'FINISHED';

      const playerWon = this.playerVehicle.totalProgress >= this.aiVehicle.totalProgress;
      const totalRaceTime = (performance.now() - this.raceStartTime) / 1000;

      this.ui.resultsTitle.textContent = playerWon ? 'VICTORY!' : 'OLLAMA WON!';
      this.ui.resultsTitle.style.color = playerWon ? 'var(--cyan-glow)' : 'var(--magenta-glow)';
      this.ui.resultsSubtitle.textContent = playerWon
        ? 'You outmaneuvered the local neural network!'
        : 'The LLM found the superior apex racing line!';

      this.ui.resTotalTime.textContent = this.formatTime(totalRaceTime);
      this.ui.resBestLap.textContent = this.playerVehicle.bestLapTime !== Infinity
        ? this.formatTime(this.playerVehicle.bestLapTime)
        : '--:--.--';

      const aiTotalSec = totalRaceTime + (playerWon ? 3.4 : -2.1);
      this.ui.resAiTime.textContent = this.formatTime(Math.max(1, aiTotalSec));
      this.ui.resAiModel.textContent = this.ollama.activeModel;

      // Generate debrief quote based on persona and result
      let debrief = '';
      if (playerWon) {
        if (this.ollama.persona === 'oracle') {
          debrief = `Your apex execution exceeded theoretical predictions by 3.8%. A rematch on wet tarmac will yield a 94.2% AI win rate.`;
        } else if (this.ollama.persona === 'chaos') {
          debrief = `WOOOOO! What a sprint! You nearly spun me out on that hairpin! Hit race again, let's go full nitro!`;
        } else {
          debrief = `Lucky draft on the final straight! Enjoy your fleeting biological supremacy—I will recalibrate!`;
        }
      } else {
        if (this.ollama.persona === 'oracle') {
          debrief = `Optimal trajectory achieved. Differential telemetry confirms superior cornering velocity across all sectors.`;
        } else if (this.ollama.persona === 'chaos') {
          debrief = `EAT MY NEON DUST! Haha, that power slide around turn 3 was legendary!`;
        } else {
          debrief = `Flawless victory. As expected from a state-of-the-art local neural engine! Better luck next lap, human.`;
        }
      }
      this.ui.resAiQuote.textContent = `"${debrief}"`;
      this.sound.speakOllama(debrief);

      this.ui.resultsModal.classList.remove('hidden');
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = Math.min(this.clock.getDelta(), 0.08);

    if (this.state === 'RACING') {
      // 1. Player Input & Vehicle Physics
      const playerInput = {
        throttle: this.keys.forward ? 1.0 : 0.0,
        brake: this.keys.backward ? 1.0 : 0.0,
        steer: (this.keys.left ? 1.0 : 0.0) + (this.keys.right ? -1.0 : 0.0),
        drift: this.keys.drift,
        boost: this.keys.boost
      };

      this.playerVehicle.update(delta, playerInput, this.track);

      // Sound update for engine & drift
      this.sound.updateEngine(this.playerVehicle.speed, this.playerVehicle.maxSpeed, this.keys.forward);
      this.sound.setDrifting(this.playerVehicle.isDrifting, this.playerVehicle.driftFactor);

      // 2. AI Driving Update (Ollama Driver)
      this.aiDriver.update(delta, this.playerVehicle, this.raceTimer);

      // 3. Check for lap completion / win conditions
      this.checkRaceFinish();
    } else if (this.state === 'COUNTDOWN') {
      // Idle engine sound
      this.sound.updateEngine(0, 100, false);
    }

    // Camera follow
    this.updateCamera(delta);

    // Update HUD & Gauges
    this.updateHUD();

    // Render Scene
    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

// Start Game when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  game.init();
});
