// ==========================================
// CrAzYcATtlE3D - Web Edition
// Edited by Gregory
// ==========================================

// --- 1. PROCEDURAL AUDIO SYNTHESIZER ---
class SoundEngine {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playBleat(pitch = 1.0) {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'triangle';

    const baseFreq = 220 * pitch;
    osc1.frequency.setValueAtTime(baseFreq, now);
    osc1.frequency.linearRampToValueAtTime(baseFreq * 0.88, now + 0.35);

    osc2.frequency.setValueAtTime(baseFreq * 1.5, now);
    osc2.frequency.linearRampToValueAtTime(baseFreq * 1.35, now + 0.35);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950, now);
    filter.Q.value = 3.5;

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.4);
    osc2.stop(now + 0.4);
  }

  playCrash(volume = 0.5) {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const bufSize = this.ctx.sampleRate * 0.2;
    const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + 0.2);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(Math.min(volume * 0.4, 0.4), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
  }

  playExplosion() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.6);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.7);

    this.playCrash(0.8);
  }

  playClick(pitch = 1.0) {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600 * pitch, now);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }
}

const audio = new SoundEngine();

// --- 2. TITLE CLICK-TO-SPIN LOGIC ---
const titleText = document.getElementById('title-text');
const titleWrapper = document.getElementById('title-wrapper');
let titleAngle = 0;
let titleSpinVel = 0;

titleWrapper.addEventListener('click', () => {
  audio.playBleat(1.3 + Math.random() * 0.3);
  titleSpinVel += 32.0;
});

function updateTitleSpin(dt) {
  if (titleSpinVel > 0.01) {
    titleAngle += titleSpinVel * dt;
    titleSpinVel = Math.max(0, titleSpinVel - dt * 14.0);

    const wobble = Math.sin(titleAngle * 2) * 0.15 * Math.min(titleSpinVel / 20.0, 1.0);
    titleText.style.transform = `rotate(${titleAngle}rad) scale(${1 + wobble}, ${1 - wobble})`;
  } else if (titleAngle % (Math.PI * 2) > 0.05) {
    titleAngle += dt * 10.0;
    if (titleAngle >= Math.PI * 2) titleAngle = 0;
    titleText.style.transform = `rotate(${titleAngle}rad) scale(1, 1)`;
  } else {
    titleAngle = 0;
    titleText.style.transform = 'rotate(0rad) scale(1, 1)';
  }
}

// --- 3. INTERACTIVE FIDGET SPINNER ---
const fidgetCanvas = document.getElementById('fidget-canvas');
const fidgetCtx = fidgetCanvas.getContext('2d');
const fidgetLabel = document.getElementById('fidget-label');
let fAngle = 0;
let fVel = 3.5;
let fDragging = false;
let fLastY = 0;

fidgetCanvas.addEventListener('mousedown', (e) => {
  fDragging = true;
  fVel += 16.0;
  audio.playClick(1.4);
});
window.addEventListener('mouseup', () => (fDragging = false));

function updateFidgetSpinner(dt) {
  fVel = fVel + (3.5 - fVel) * Math.min(1.8 * dt, 1);
  fAngle += fVel * dt;

  const w = fidgetCanvas.width;
  const h = fidgetCanvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const r = 24;

  fidgetCtx.clearRect(0, 0, w, h);

  // Background Ring
  fidgetCtx.beginPath();
  fidgetCtx.arc(cx, cy, r, 0, Math.PI * 2);
  fidgetCtx.strokeStyle = 'rgba(71, 85, 105, 0.4)';
  fidgetCtx.lineWidth = 3;
  fidgetCtx.stroke();

  // Spinning main arc
  fidgetCtx.beginPath();
  fidgetCtx.arc(cx, cy, r, fAngle, fAngle + 2.4);
  fidgetCtx.strokeStyle = '#f59e0b';
  fidgetCtx.lineWidth = 4;
  fidgetCtx.stroke();

  // Head bead
  const beadX = cx + Math.cos(fAngle + 2.4) * r;
  const beadY = cy + Math.sin(fAngle + 2.4) * r;
  fidgetCtx.beginPath();
  fidgetCtx.arc(beadX, beadY, 3.5, 0, Math.PI * 2);
  fidgetCtx.fillStyle = '#ffffff';
  fidgetCtx.fill();

  // Center sheep head icon
  fidgetCtx.save();
  fidgetCtx.translate(cx, cy);
  fidgetCtx.rotate(fAngle);
  fidgetCtx.fillStyle = '#f8fafc';
  fidgetCtx.beginPath();
  fidgetCtx.arc(0, 0, 10, 0, Math.PI * 2);
  fidgetCtx.fill();
  fidgetCtx.fillStyle = '#0f172a';
  fidgetCtx.fillRect(-4, -2, 8, 5); // Snout
  fidgetCtx.restore();

  // Update label text
  const absV = Math.abs(fVel);
  if (absV > 24) {
    fidgetLabel.innerText = 'CRAZY SPEED!';
    fidgetLabel.style.color = '#ef4444';
  } else if (absV > 12) {
    fidgetLabel.innerText = 'WHEEE!';
    fidgetLabel.style.color = '#f59e0b';
  } else {
    fidgetLabel.innerText = 'SPINNER';
    fidgetLabel.style.color = '#06b6d4';
  }
}

// --- 4. MAPS & ARENAS ---
const MAPS = [
  { name: '☘ IRELAND (Rolling Hills)', color: 0x3d7a36, sky: 0x60a5fa, friction: 0.985, hills: 6.0 },
  { name: '❄ ICELAND (Glaciers)', color: 0x93c5fd, sky: 0xcffafe, friction: 0.994, hills: 4.5 },
  { name: '🏜 DESERT (Sand Dunes)', color: 0xd97706, sky: 0xfef08a, friction: 0.978, hills: 8.0 }
];
let currentMapIdx = 0;
const mapLabel = document.getElementById('map-name-label');
document.getElementById('prev-map-btn').addEventListener('click', () => {
  currentMapIdx = (currentMapIdx + MAPS.length - 1) % MAPS.length;
  mapLabel.innerText = MAPS[currentMapIdx].name;
  audio.playClick();
});
document.getElementById('next-map-btn').addEventListener('click', () => {
  currentMapIdx = (currentMapIdx + 1) % MAPS.length;
  mapLabel.innerText = MAPS[currentMapIdx].name;
  audio.playClick();
});

// --- 5. GAME LOGIC & CHEAT ENGINE STATE ---
let gameState = 'MENU'; // MENU, PLAYING, END
let timeScale = 1.0;
let isTimeFrozen = false;
let isFlyMode = false;
let speedMultiplier = 1.0;
let isGodMode = false;
let isSuperHeavy = false;
let isMegaShockwave = false;
let isMoonGravity = false;

// Names for kill feed
const BOT_NAMES = [
  'Nardo Polo', 'Baby Oil', 'Shaun', 'Woolly Bull', 'Ram-bo', 'Lamb-orghini',
  'Clover', 'Thunder-Sheep', 'Sir Baas-a-Lot', 'Wooly Mammoth', 'Baa-bra',
  'Bleat-les', 'Shepherd', 'Chops', 'Mutton Button', 'Cotton-Ball', 'Ranger',
  'Flock-Star', 'Pasture King', 'Alpine Dasher', 'Battering Ram'
];

// --- 6. THREE.JS 3D WORLD SETUP ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(80, 480 / 640, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(480, 640);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.2);
sunLight.position.set(60, 100, 50);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 250;
const d = 100;
sunLight.shadow.camera.left = -d;
sunLight.shadow.camera.right = d;
sunLight.shadow.camera.top = d;
sunLight.shadow.camera.bottom = -d;
scene.add(sunLight);

// Terrain Function
function getTerrainHeight(x, z) {
  const map = MAPS[currentMapIdx];
  return Math.sin(x * 0.05) * Math.cos(z * 0.05) * map.hills +
         Math.sin(x * 0.12 + 1.2) * 1.5 +
         Math.cos(z * 0.12) * 1.5;
}

function getTerrainNormal(x, z) {
  const eps = 0.2;
  const hL = getTerrainHeight(x - eps, z);
  const hR = getTerrainHeight(x + eps, z);
  const hD = getTerrainHeight(x, z - eps);
  const hU = getTerrainHeight(x, z + eps);
  const norm = new THREE.Vector3(hL - hR, 2 * eps, hD - hU);
  return norm.normalize();
}

let terrainMesh = null;
let fenceGroup = null;

function buildArena() {
  if (terrainMesh) scene.remove(terrainMesh);
  if (fenceGroup) scene.remove(fenceGroup);

  const map = MAPS[currentMapIdx];
  scene.background = new THREE.Color(map.sky);
  scene.fog = new THREE.FogExp2(map.sky, 0.007);

  // Terrain Geometry
  const segs = 90;
  const size = 200;
  const geom = new THREE.PlaneGeometry(size, size, segs, segs);
  geom.rotateX(-Math.PI / 2);

  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, getTerrainHeight(x, z));
  }
  geom.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({ color: map.color });
  terrainMesh = new THREE.Mesh(geom, mat);
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);

  // Perimeter Arena Fence (Circular radius 75)
  fenceGroup = new THREE.Group();
  const fenceRadius = 75;
  const postCount = 45;
  const postGeom = new THREE.CylinderGeometry(0.3, 0.3, 3, 6);
  const postMat = new THREE.MeshLambertMaterial({ color: 0x78350f });

  for (let i = 0; i < postCount; i++) {
    const angle = (i / postCount) * Math.PI * 2;
    const fx = Math.cos(angle) * fenceRadius;
    const fz = Math.sin(angle) * fenceRadius;
    const fy = getTerrainHeight(fx, fz) + 1.2;

    const post = new THREE.Mesh(postGeom, postMat);
    post.position.set(fx, fy, fz);
    post.castShadow = true;
    fenceGroup.add(post);
  }
  scene.add(fenceGroup);
}

// --- 7. 3D CAR-SHEEP MODEL BUILDER ---
function createSheepMesh(isPlayer = false) {
  const group = new THREE.Group();

  // 1. Fluffy Wool Body (chamfered sphere)
  const bodyGeom = new THREE.SphereGeometry(1.0, 12, 10);
  bodyGeom.scale(1.15, 0.85, 1.4);
  const woolColor = isPlayer ? 0xfffbeb : (0xdbeafe - (Math.random() * 0x202020));
  const bodyMat = new THREE.MeshLambertMaterial({ color: woolColor });
  const body = new THREE.Mesh(bodyGeom, bodyMat);
  body.castShadow = true;
  group.add(body);

  // 2. Head & Snout
  const headGeom = new THREE.SphereGeometry(0.48, 8, 8);
  const headMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
  const head = new THREE.Mesh(headGeom, headMat);
  head.position.set(0, 0.3, -1.2);
  head.castShadow = true;
  group.add(head);

  // Snout
  const snoutGeom = new THREE.BoxGeometry(0.32, 0.25, 0.35);
  const snout = new THREE.Mesh(snoutGeom, headMat);
  snout.position.set(0, 0.18, -1.5);
  group.add(snout);

  // Eyes
  const eyeGeom = new THREE.SphereGeometry(0.1, 6, 6);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

  const eyeL = new THREE.Mesh(eyeGeom, eyeMat);
  eyeL.position.set(-0.25, 0.45, -1.45);
  const pupL = new THREE.Mesh(eyeGeom, pupilMat);
  pupL.scale.set(0.5, 0.5, 0.5);
  pupL.position.set(-0.27, 0.45, -1.52);
  group.add(eyeL);
  group.add(pupL);

  const eyeR = new THREE.Mesh(eyeGeom, eyeMat);
  eyeR.position.set(0.25, 0.45, -1.45);
  const pupR = new THREE.Mesh(eyeGeom, pupilMat);
  pupR.scale.set(0.5, 0.5, 0.5);
  pupR.position.set(0.27, 0.45, -1.52);
  group.add(eyeR);
  group.add(pupR);

  // 4 Wheels
  const wheelGeom = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 10);
  wheelGeom.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });

  const wheelPositions = [
    [-0.85, -0.4, 0.8],  // Back Left
    [0.85, -0.4, 0.8],   // Back Right
    [-0.85, -0.4, -0.8], // Front Left
    [0.85, -0.4, -0.8]   // Front Right
  ];

  const wheels = [];
  wheelPositions.forEach(pos => {
    const w = new THREE.Mesh(wheelGeom, wheelMat);
    w.position.set(pos[0], pos[1], pos[2]);
    w.castShadow = true;
    group.add(w);
    wheels.push(w);
  });

  group.userData.wheels = wheels;
  group.userData.bodyMesh = body;
  return group;
}

// --- 8. SHEEP CLASS & VEHICLE PHYSICS ---
class Sheep {
  constructor(id, isPlayer, startPos, startYaw) {
    this.id = id;
    this.isPlayer = isPlayer;
    this.name = isPlayer ? 'Gregory (Player)' : (BOT_NAMES[id % BOT_NAMES.length] + ' #' + id);
    this.mesh = createSheepMesh(isPlayer);
    scene.add(this.mesh);

    this.pos = startPos.clone();
    this.vel = new THREE.Vector3();
    this.yaw = startYaw;
    this.roll = 0;
    this.pitch = 0;
    this.isAlive = true;
    this.tippedTimer = 0;
    this.kills = 0;

    // AI timing
    this.aiSteer = 0;
    this.aiThrottle = 1.0;
    this.aiTimer = Math.random() * 2.0;
  }

  update(dt, input) {
    if (!this.isAlive) return;

    let throttle = 0;
    let steer = 0;

    if (this.isPlayer) {
      // Player controls
      if (input.w) throttle += 1.0;
      if (input.s) throttle -= 0.6;
      if (input.a) steer += 1.0;
      if (input.d) steer -= 1.0;

      // Flight mode override
      if (isFlyMode) {
        const flySpeed = 40 * speedMultiplier;
        const moveDir = new THREE.Vector3();
        const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
        const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

        if (input.w) moveDir.add(fwd);
        if (input.s) moveDir.sub(fwd);
        if (input.a) moveDir.sub(right);
        if (input.d) moveDir.add(right);
        if (input.space) moveDir.y += 1.0;
        if (input.shift) moveDir.y -= 1.0;

        if (moveDir.lengthSq() > 0.01) moveDir.normalize().multiplyScalar(flySpeed);
        this.vel.copy(moveDir);
        this.pos.addScaledVector(this.vel, dt);

        this.mesh.position.copy(this.pos);
        this.mesh.rotation.set(0, this.yaw, 0);
        return;
      }
    } else {
      // Bot AI
      this.aiTimer -= dt;
      if (this.aiTimer <= 0) {
        this.aiTimer = 0.8 + Math.random() * 1.5;
        this.aiThrottle = 0.5 + Math.random() * 0.5;
        this.aiSteer = (Math.random() * 2 - 1) * 0.8;

        // Steer away from boundary fence
        const distFromCenter = Math.sqrt(this.pos.x * this.pos.x + this.pos.z * this.pos.z);
        if (distFromCenter > 65) {
          const toCenterAngle = Math.atan2(-this.pos.x, -this.pos.z);
          this.aiSteer = (toCenterAngle - this.yaw) * 0.8;
        }
      }
      throttle = this.aiThrottle;
      steer = this.aiSteer;
    }

    // Vehicle Steering
    const turnRate = 2.8;
    this.yaw += steer * turnRate * dt;

    // Forward Direction
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    // Acceleration & Speeds
    const effectiveSpeedMult = this.isPlayer ? speedMultiplier : 1.0;
    const accel = (this.isPlayer && isSuperHeavy ? 80 : 35) * effectiveSpeedMult;
    this.vel.addScaledVector(fwd, throttle * accel * dt);

    // Terrain Downhill Acceleration (Iconic CC3D physics)
    const norm = getTerrainNormal(this.pos.x, this.pos.z);
    const slopePush = new THREE.Vector3(norm.x, 0, norm.z).multiplyScalar(22.0);
    this.vel.addScaledVector(slopePush, dt);

    // Gravity
    const grav = (this.isPlayer && isMoonGravity ? 5.0 : 25.0);
    this.vel.y -= grav * dt;

    // Integrate Position
    this.pos.addScaledVector(this.vel, dt);

    // Ground Contact
    const groundY = getTerrainHeight(this.pos.x, this.pos.z) + 0.9;
    if (this.pos.y <= groundY) {
      this.pos.y = groundY;
      if (this.vel.y < 0) this.vel.y = 0;

      // Friction & Drag
      const map = MAPS[currentMapIdx];
      this.vel.x *= Math.pow(map.friction, dt * 60);
      this.vel.z *= Math.pow(map.friction, dt * 60);

      // Align pitch/roll to ground slope
      this.pitch = -norm.z * 0.8;
      this.roll = norm.x * 0.8;
    }

    // Tipping Check (Cannot tip if player with God Mode or Super Heavy)
    const isUntippable = this.isPlayer && (isGodMode || isSuperHeavy);
    const tilt = Math.abs(this.roll) + Math.abs(this.pitch);
    if (!isUntippable && tilt > 1.2) {
      this.tippedTimer += dt;
      if (this.tippedTimer > 0.45) {
        this.explode('Flipped and exploded!');
      }
    } else {
      this.tippedTimer = 0;
    }

    // Perimeter boundary check (fence radius 75)
    const distToCenter = Math.sqrt(this.pos.x * this.pos.x + this.pos.z * this.pos.z);
    if (distToCenter > 75) {
      this.explode('Smashed into perimeter fence!');
    }

    // Update 3D Mesh
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.set(this.pitch, this.yaw, this.roll);

    // Rotate Wheels
    const speed = this.vel.length();
    const wheels = this.mesh.userData.wheels;
    if (wheels) {
      wheels.forEach((w, idx) => {
        w.rotation.x += speed * dt * 3.0;
        if (idx >= 2) w.rotation.y = steer * 0.4; // Front steering
      });
    }

    // Super Heavy visual scale
    if (this.isPlayer) {
      const scale = isSuperHeavy ? 1.35 : 1.0;
      this.mesh.scale.set(scale, scale, scale);
    }
  }

  explode(reason) {
    if (!this.isAlive) return;
    this.isAlive = false;
    audio.playExplosion();

    // Spawn particle puffs
    spawnWoolPuff(this.pos);
    scene.remove(this.mesh);

    addKillMessage(`${this.name} ${reason}`, this.isPlayer);
    updateAliveCount();

    if (this.isPlayer) {
      setTimeout(() => showEndScreen(false), 900);
    }
  }
}

// Particle System for Explosions
const particles = [];
function spawnWoolPuff(center) {
  const pGeom = new THREE.SphereGeometry(0.3, 6, 6);
  const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = 0; i < 16; i++) {
    const p = new THREE.Mesh(pGeom, pMat);
    p.position.copy(center);
    const vel = new THREE.Vector3(
      (Math.random() * 2 - 1) * 12,
      Math.random() * 14 + 4,
      (Math.random() * 2 - 1) * 12
    );
    scene.add(p);
    particles.push({ mesh: p, vel, life: 1.0 });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt * 1.5;
    p.vel.y -= 25.0 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.scale.multiplyScalar(0.96);

    if (p.life <= 0) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
    }
  }
}

// --- 9. BATTLE ROYALE MANAGER ---
let sheepList = [];
let playerSheep = null;

function startMatch() {
  gameState = 'PLAYING';
  document.getElementById('menu-screen').style.display = 'none';
  document.getElementById('end-screen').style.display = 'none';
  document.getElementById('hud-overlay').style.display = 'block';

  buildArena();

  // Clear existing sheep
  sheepList.forEach(s => scene.remove(s.mesh));
  sheepList = [];

  // Spawn Player at center
  const pPos = new THREE.Vector3(0, getTerrainHeight(0, 0) + 1.2, 0);
  playerSheep = new Sheep(0, true, pPos, 0);
  sheepList.push(playerSheep);

  // Spawn 39 Bot Sheep in circle
  const totalBots = 39;
  for (let i = 1; i <= totalBots; i++) {
    const angle = (i / totalBots) * Math.PI * 2;
    const r = 20 + Math.random() * 45;
    const bx = Math.cos(angle) * r;
    const bz = Math.sin(angle) * r;
    const by = getTerrainHeight(bx, bz) + 1.2;
    const bot = new Sheep(i, false, new THREE.Vector3(bx, by, bz), Math.random() * Math.PI * 2);
    sheepList.push(bot);
  }

  updateAliveCount();
  audio.playBleat(1.1);
}

function resolveCollisions() {
  for (let i = 0; i < sheepList.length; i++) {
    const s1 = sheepList[i];
    if (!s1.isAlive) continue;

    for (let j = i + 1; j < sheepList.length; j++) {
      const s2 = sheepList[j];
      if (!s2.isAlive) continue;

      const diff = new THREE.Vector3().subVectors(s2.pos, s1.pos);
      const dist = diff.length();
      const minDist = 2.0;

      if (dist < minDist && dist > 0.001) {
        // Super Heavy Instant Obliteration
        if (s1.isPlayer && isSuperHeavy) {
          s2.explode('was pulverized by SUPER HEAVY GREGORY!');
          s1.kills++;
          audio.playCrash(1.0);
          continue;
        }
        if (s2.isPlayer && isSuperHeavy) {
          s1.explode('was pulverized by SUPER HEAVY GREGORY!');
          s2.kills++;
          audio.playCrash(1.0);
          continue;
        }

        // Push apart
        const normal = diff.normalize();
        const overlap = (minDist - dist) * 0.5;
        s1.pos.addScaledVector(normal, -overlap);
        s2.pos.addScaledVector(normal, overlap);

        // Impulse bounce
        const relVel = new THREE.Vector3().subVectors(s2.vel, s1.vel);
        const velAlongNorm = relVel.dot(normal);

        if (velAlongNorm < 0) {
          const impulseMag = -1.6 * velAlongNorm * 0.5;
          const impulse = normal.clone().multiplyScalar(impulseMag);
          s1.vel.sub(impulse);
          s2.vel.add(impulse);

          audio.playCrash(Math.abs(velAlongNorm) / 10.0);

          // High-speed ram knockover
          if (Math.abs(velAlongNorm) > 12.0) {
            if (s1.vel.length() > s2.vel.length()) s2.roll += (Math.random() * 2 - 1) * 1.5;
            else s1.roll += (Math.random() * 2 - 1) * 1.5;
          }
        }
      }
    }
  }
}

function updateAliveCount() {
  const alive = sheepList.filter(s => s.isAlive).length;
  document.getElementById('alive-count').innerText = `ALIVE: ${alive} / ${sheepList.length}`;

  if (gameState === 'PLAYING' && playerSheep && playerSheep.isAlive && alive <= 1) {
    setTimeout(() => showEndScreen(true), 800);
  }
}

function addKillMessage(msg, isPlayer) {
  const feed = document.getElementById('killfeed');
  const div = document.createElement('div');
  div.className = 'kill-msg' + (isPlayer ? ' player' : '');
  div.innerText = msg;
  feed.appendChild(div);

  setTimeout(() => {
    if (feed.contains(div)) feed.removeChild(div);
  }, 4500);
}

function showEndScreen(won) {
  gameState = 'END';
  document.getElementById('hud-overlay').style.display = 'none';
  const endModal = document.getElementById('end-screen');
  endModal.style.display = 'flex';

  const title = document.getElementById('end-title');
  const rank = document.getElementById('end-rank');
  const kills = document.getElementById('end-kills');

  if (won) {
    title.innerText = 'WINNER WINNER SHEEP DINNER!';
    title.style.color = '#10b981';
    rank.innerText = 'Rank: #1 CHAMPION';
  } else {
    title.innerText = 'OBLITERATED!';
    title.style.color = '#ef4444';
    const alive = sheepList.filter(s => s.isAlive).length;
    rank.innerText = `Rank: #${alive + 1}`;
  }
  kills.innerText = `Sheep Rammed: ${playerSheep ? playerSheep.kills : 0}`;
}

// --- 10. INPUT LISTENERS ---
const input = { w: false, a: false, s: false, d: false, space: false, shift: false };
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyW' || e.code === 'ArrowUp') input.w = true;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') input.a = true;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') input.s = true;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') input.d = true;
  if (e.code === 'Space') {
    input.space = true;
    if (gameState === 'PLAYING' && playerSheep && playerSheep.isAlive) {
      audio.playBleat(1.0);
      if (isMegaShockwave) triggerMegaShockwave();
    }
  }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.shift = true;
  if (e.code === 'F4') {
    e.preventDefault();
    toggleCheatModal();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyW' || e.code === 'ArrowUp') input.w = false;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') input.a = false;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') input.s = false;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') input.d = false;
  if (e.code === 'Space') input.space = false;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.shift = false;
});

// Start & Restart Buttons
document.getElementById('start-game-btn').addEventListener('click', startMatch);
document.getElementById('restart-btn').addEventListener('click', startMatch);
document.getElementById('back-menu-btn').addEventListener('click', () => {
  gameState = 'MENU';
  document.getElementById('end-screen').style.display = 'none';
  document.getElementById('menu-screen').style.display = 'flex';
});

// --- 11. CHEAT ENGINE MODAL & TOGGLES ---
const cheatModal = document.getElementById('cheat-modal');
const cheatToggleBtn = document.getElementById('cheat-toggle-btn');
const cheatStatus = document.getElementById('cheat-status');

function toggleCheatModal() {
  audio.playClick(1.2);
  const isOpen = cheatModal.style.display === 'flex';
  cheatModal.style.display = isOpen ? 'none' : 'flex';
  updateCheatButtonVisuals();
}

cheatToggleBtn.addEventListener('click', toggleCheatModal);
document.getElementById('btn-close-cheat').addEventListener('click', toggleCheatModal);

function setCheatStatus(msg) {
  cheatStatus.innerText = msg;
}

// Cheat Actions
document.getElementById('btn-freeze').addEventListener('click', () => {
  audio.playClick();
  isTimeFrozen = !isTimeFrozen;
  setCheatStatus(isTimeFrozen ? 'TIME FROZEN! Physics paused.' : 'TIME RESUMED.');
  updateCheatButtonVisuals();
});

document.getElementById('btn-fly').addEventListener('click', () => {
  audio.playClick();
  isFlyMode = !isFlyMode;
  setCheatStatus(isFlyMode ? 'FLY MODE ON: WASD to steer, Space to ascend, Shift to descend!' : 'FLY MODE OFF.');
  updateCheatButtonVisuals();
});

const speedLevels = [1.0, 2.5, 5.0, 10.0];
let curSpeedIdx = 0;
document.getElementById('btn-speed').addEventListener('click', () => {
  audio.playClick();
  curSpeedIdx = (curSpeedIdx + 1) % speedLevels.length;
  speedMultiplier = speedLevels[curSpeedIdx];
  setCheatStatus(`SPEED MULTIPLIER: ${speedMultiplier}x`);
  updateCheatButtonVisuals();
});

document.getElementById('btn-god').addEventListener('click', () => {
  audio.playClick();
  isGodMode = !isGodMode;
  setCheatStatus(isGodMode ? 'GOD MODE ACTIVE: 100% immune to all tipping and damage!' : 'GOD MODE OFF.');
  updateCheatButtonVisuals();
});

document.getElementById('btn-heavy').addEventListener('click', () => {
  audio.playClick();
  isSuperHeavy = !isSuperHeavy;
  setCheatStatus(isSuperHeavy ? 'SUPER HEAVY TANK ACTIVE (120 KG): Obliterates any sheep on touch!' : 'SUPER HEAVY OFF.');
  updateCheatButtonVisuals();
});

document.getElementById('btn-shockwave').addEventListener('click', () => {
  audio.playClick();
  isMegaShockwave = !isMegaShockwave;
  setCheatStatus(isMegaShockwave ? 'MEGA SHOCKWAVE ACTIVE: Press Space/Bleat to blast all nearby sheep!' : 'SHOCKWAVE OFF.');
  updateCheatButtonVisuals();
});

document.getElementById('btn-gravity').addEventListener('click', () => {
  audio.playClick();
  isMoonGravity = !isMoonGravity;
  setCheatStatus(isMoonGravity ? 'MOON GRAVITY ON: 0.2x Floaty Physics!' : 'GRAVITY NORMAL.');
  updateCheatButtonVisuals();
});

document.getElementById('btn-slowmo').addEventListener('click', () => {
  audio.playClick();
  timeScale = timeScale === 0.25 ? 1.0 : 0.25;
  setCheatStatus(`TIME SCALE: ${timeScale}x SLOW MOTION`);
  updateCheatButtonVisuals();
});

document.getElementById('btn-explode').addEventListener('click', () => {
  audio.playExplosion();
  let count = 0;
  sheepList.forEach(s => {
    if (!s.isPlayer && s.isAlive) {
      s.explode('was atomized by Gregory\'s Cheat Engine!');
      count++;
    }
  });
  setCheatStatus(`KABOOM! Obliterated ${count} opponent sheep!`);
});

document.getElementById('btn-unflip').addEventListener('click', () => {
  audio.playClick();
  if (playerSheep) {
    playerSheep.pos.y = getTerrainHeight(playerSheep.pos.x, playerSheep.pos.z) + 2.5;
    playerSheep.vel.set(0, 0, 0);
    playerSheep.roll = 0;
    playerSheep.pitch = 0;
    playerSheep.isAlive = true;
    setCheatStatus('Player sheep unflips and returns to battle!');
  }
});

function triggerMegaShockwave() {
  if (!playerSheep) return;
  audio.playExplosion();
  let blasted = 0;
  sheepList.forEach(s => {
    if (!s.isPlayer && s.isAlive) {
      const diff = new THREE.Vector3().subVectors(s.pos, playerSheep.pos);
      const dist = diff.length();
      if (dist < 40) {
        const dir = diff.normalize();
        dir.y = 0.8;
        s.vel.add(dir.normalize().multiplyScalar(28.0));
        s.roll += (Math.random() * 2 - 1) * 2.0;
        blasted++;
      }
    }
  });
  setCheatStatus(`Mega Shockwave blasted ${blasted} sheep into orbit!`);
}

function updateCheatButtonVisuals() {
  const btnFreeze = document.getElementById('btn-freeze');
  btnFreeze.innerText = `❄ TIME: ${isTimeFrozen ? 'FROZEN [ON]' : 'RUNNING [OFF]'}`;
  btnFreeze.className = 'cheat-btn' + (isTimeFrozen ? ' active' : '');

  const btnFly = document.getElementById('btn-fly');
  btnFly.innerText = `🕊 FLY MODE: ${isFlyMode ? 'ACTIVE [ON]' : '[OFF]'}`;
  btnFly.className = 'cheat-btn' + (isFlyMode ? ' active' : '');

  const btnSpeed = document.getElementById('btn-speed');
  btnSpeed.innerText = `⚡ SPEED: ${speedMultiplier}x`;
  btnSpeed.className = 'cheat-btn' + (speedMultiplier > 1 ? ' active' : '');

  const btnGod = document.getElementById('btn-god');
  btnGod.innerText = `🛡 GOD MODE: ${isGodMode ? 'ACTIVE [ON]' : '[OFF]'}`;
  btnGod.className = 'cheat-btn' + (isGodMode ? ' active' : '');

  const btnHeavy = document.getElementById('btn-heavy');
  btnHeavy.innerText = `🚜 SUPER HEAVY: ${isSuperHeavy ? 'ACTIVE [ON]' : '[OFF]'}`;
  btnHeavy.className = 'cheat-btn' + (isSuperHeavy ? ' active' : '');

  const btnSw = document.getElementById('btn-shockwave');
  btnSw.innerText = `📢 SHOCKWAVE: ${isMegaShockwave ? 'ACTIVE [ON]' : '[OFF]'}`;
  btnSw.className = 'cheat-btn' + (isMegaShockwave ? ' active' : '');

  const btnGrav = document.getElementById('btn-gravity');
  btnGrav.innerText = `🌙 MOON GRAV: ${isMoonGravity ? 'ACTIVE [ON]' : '[OFF]'}`;
  btnGrav.className = 'cheat-btn' + (isMoonGravity ? ' active' : '');

  const btnSlow = document.getElementById('btn-slowmo');
  btnSlow.innerText = `⏱ SLOW-MO: ${timeScale < 1 ? '0.25x [ON]' : '[OFF]'}`;
  btnSlow.className = 'cheat-btn' + (timeScale < 1 ? ' active' : '');
}

// --- 12. MAIN ANIMATION LOOP ---
let lastTime = performance.now();

function animate(currentTime) {
  requestAnimationFrame(animate);

  const rawDt = Math.min((currentTime - lastTime) / 1000, 0.1);
  lastTime = currentTime;

  // Startup animations always run smoothly
  updateTitleSpin(rawDt);
  updateFidgetSpinner(rawDt);

  const effectiveDt = (isTimeFrozen ? 0 : rawDt) * timeScale;

  if (gameState === 'PLAYING') {
    // Update all sheep
    sheepList.forEach(s => s.update(effectiveDt, input));

    // Resolve Collisions
    if (effectiveDt > 0) resolveCollisions();

    // Camera follow player
    if (playerSheep && playerSheep.mesh) {
      const camOffset = new THREE.Vector3(0, 3.2, 5.2);
      camOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), playerSheep.yaw);

      const targetCamPos = playerSheep.pos.clone().add(camOffset);
      camera.position.lerp(targetCamPos, Math.min(rawDt * 10, 1));
      camera.lookAt(playerSheep.pos.x, playerSheep.pos.y + 0.8, playerSheep.pos.z);

      // Speedometer
      const mph = Math.round(playerSheep.vel.length() * 2.237);
      document.getElementById('speedo-display').innerText = `SPEED: ${mph} MPH`;
    }
  } else {
    // Menu background gentle camera orbit
    const t = currentTime * 0.0003;
    camera.position.set(Math.cos(t) * 35, 18, Math.sin(t) * 35);
    camera.lookAt(0, 2, 0);
  }

  updateParticles(rawDt);
  renderer.render(scene, camera);
}

// Initial Build & Launch Loop
buildArena();
requestAnimationFrame(animate);
