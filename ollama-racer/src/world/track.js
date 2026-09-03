import * as THREE from 'three';

/**
 * Procedural 3D Track, Cyberpunk City Environment & Spline Navigation System
 */
export class TrackManager {
  constructor(scene) {
    this.scene = scene;
    this.trackWidth = 18; // Track road width in units
    this.spline = null;
    this.trackPoints = [];
    this.trackMesh = null;
    this.barriers = [];
    this.boostPads = [];
    this.checkpoints = [];
    this.trackLength = 0;
    this.sampleCount = 300; // Spline resolution
  }

  buildTrack() {
    // 1. Define circuit control points (smooth closed loop circuit with turns & elevation)
    const rawPoints = [
      new THREE.Vector3(0, 0, 0),          // Start / Finish straight
      new THREE.Vector3(0, 0, 180),        // Fast straightaway
      new THREE.Vector3(40, 2, 280),       // Turn 1 entry
      new THREE.Vector3(120, 5, 340),      // Banked sweeper right
      new THREE.Vector3(220, 4, 300),      // Sweeper exit
      new THREE.Vector3(260, 2, 200),      // Turn 2
      new THREE.Vector3(210, 0, 120),      // Chicane entrance
      new THREE.Vector3(250, -1, 30),      // Chicane flick
      new THREE.Vector3(220, 0, -80),      // Turn 3 hairpin approach
      new THREE.Vector3(130, 3, -150),     // Hairpin apex
      new THREE.Vector3(30, 6, -160),      // Uphill twist
      new THREE.Vector3(-80, 5, -120),     // Crest
      new THREE.Vector3(-160, 2, -50),     // Fast downhill drop
      new THREE.Vector3(-200, 0, 60),      // Western sweeping curve
      new THREE.Vector3(-180, 0, 180),     // South curve
      new THREE.Vector3(-100, 0, 240),     // Technical Esses
      new THREE.Vector3(-50, 0, 150),      // Final bend entry
      new THREE.Vector3(-20, 0, 60),       // Straight alignment
    ];

    this.spline = new THREE.CatmullRomCurve3(rawPoints, true, 'centripetal', 0.5);
    this.trackLength = this.spline.getLength();

    // Sample points evenly along the spline
    this.trackPoints = this.spline.getSpacedPoints(this.sampleCount);

    // 2. Build Ribbon Road Geometry
    this.buildRoadMesh();

    // 3. Build Glowing Neon Guardrails & Kerbs
    this.buildGuardrails();

    // 4. Build Start / Finish Line Gantry
    this.buildStartGantry();

    // 5. Place Boost Pads
    this.placeBoostPads();

    // 6. Build City Skyline & Cyberpunk Backdrop
    this.buildCyberpunkEnvironment();

    // 7. Setup discrete race checkpoints for accurate progress & gap tracking
    this.setupCheckpoints();
  }

  buildRoadMesh() {
    const roadGeo = new THREE.BufferGeometry();
    const vertices = [];
    const uvs = [];
    const indices = [];

    const halfWidth = this.trackWidth / 2;

    for (let i = 0; i <= this.sampleCount; i++) {
      const t = (i % this.sampleCount) / this.sampleCount;
      const pt = this.spline.getPointAt(t);
      const tangent = this.spline.getTangentAt(t).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      // Left edge, Center, Right edge
      const left = pt.clone().addScaledVector(normal, -halfWidth);
      const right = pt.clone().addScaledVector(normal, halfWidth);

      vertices.push(left.x, left.y + 0.05, left.z);
      vertices.push(right.x, right.y + 0.05, right.z);

      const v = (i / this.sampleCount) * 40; // Texture repeat
      uvs.push(0, v);
      uvs.push(1, v);

      if (i < this.sampleCount) {
        const row1 = i * 2;
        const row2 = (i + 1) * 2;
        indices.push(row1, row1 + 1, row2);
        indices.push(row1 + 1, row2 + 1, row2);
      }
    }

    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    roadGeo.setIndex(indices);
    roadGeo.computeVertexNormals();

    // Create dark tarmac texture procedurally with glowing grid lines
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x0c1020,
      metalness: 0.8,
      roughness: 0.3,
    });

    this.trackMesh = new THREE.Mesh(roadGeo, roadMat);
    this.trackMesh.receiveShadow = true;
    this.scene.add(this.trackMesh);

    // Center dash line (Neon Cyan)
    const lineGeo = new THREE.BufferGeometry();
    const lineVerts = [];
    for (let i = 0; i < this.sampleCount; i += 2) {
      const t1 = i / this.sampleCount;
      const t2 = (i + 0.9) / this.sampleCount;
      const p1 = this.spline.getPointAt(t1);
      const p2 = this.spline.getPointAt(t2);
      lineVerts.push(p1.x, p1.y + 0.08, p1.z);
      lineVerts.push(p2.x, p2.y + 0.08, p2.z);
    }
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lineVerts, 3));
    const lineMat = new THREE.LineBasicMaterial({ color: 0x00f3ff, linewidth: 2 });
    const centerLines = new THREE.LineSegments(lineGeo, lineMat);
    this.scene.add(centerLines);
  }

  buildGuardrails() {
    const halfWidth = this.trackWidth / 2;
    const railMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.9,
      roughness: 0.2
    });

    for (let side = -1; side <= 1; side += 2) {
      const barrierGeo = new THREE.BufferGeometry();
      const bVerts = [];
      const bIndices = [];

      for (let i = 0; i <= this.sampleCount; i++) {
        const t = (i % this.sampleCount) / this.sampleCount;
        const pt = this.spline.getPointAt(t);
        const tangent = this.spline.getTangentAt(t).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

        const base = pt.clone().addScaledVector(normal, side * (halfWidth + 0.2));
        const top = base.clone().add(new THREE.Vector3(0, 1.2, 0));

        bVerts.push(base.x, base.y, base.z);
        bVerts.push(top.x, top.y, top.z);

        if (i < this.sampleCount) {
          const row1 = i * 2;
          const row2 = (i + 1) * 2;
          bIndices.push(row1, row1 + 1, row2);
          bIndices.push(row1 + 1, row2 + 1, row2);
        }
      }

      barrierGeo.setAttribute('position', new THREE.Float32BufferAttribute(bVerts, 3));
      barrierGeo.setIndex(bIndices);
      barrierGeo.computeVertexNormals();

      const barrierMesh = new THREE.Mesh(barrierGeo, barrierMat);
      this.scene.add(barrierMesh);

      // Add neon glowing ribbon at top of barrier
      const railCurvePoints = [];
      for (let i = 0; i <= this.sampleCount; i++) {
        const t = (i % this.sampleCount) / this.sampleCount;
        const pt = this.spline.getPointAt(t);
        const tangent = this.spline.getTangentAt(t).normalize();
        const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
        railCurvePoints.push(pt.clone().addScaledVector(normal, side * (halfWidth + 0.2)).add(new THREE.Vector3(0, 1.25, 0)));
      }
      const railSpline = new THREE.CatmullRomCurve3(railCurvePoints, true);
      const railTubeGeo = new THREE.TubeGeometry(railSpline, 300, 0.12, 6, true);
      const railMesh = new THREE.Mesh(railTubeGeo, side === -1 ? railMat : new THREE.MeshBasicMaterial({ color: 0xff007f }));
      this.scene.add(railMesh);
    }
  }

  buildStartGantry() {
    const startPoint = this.spline.getPointAt(0);
    const tangent = this.spline.getTangentAt(0).normalize();
    const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

    const gantryGroup = new THREE.Group();

    // Pillar left & right
    const pillarGeo = new THREE.BoxGeometry(1.2, 10, 1.2);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.3 });

    const pillarL = new THREE.Mesh(pillarGeo, pillarMat);
    pillarL.position.copy(startPoint).addScaledVector(normal, -this.trackWidth / 2 - 1.5).add(new THREE.Vector3(0, 5, 0));
    pillarL.castShadow = true;

    const pillarR = new THREE.Mesh(pillarGeo, pillarMat);
    pillarR.position.copy(startPoint).addScaledVector(normal, this.trackWidth / 2 + 1.5).add(new THREE.Vector3(0, 5, 0));
    pillarR.castShadow = true;

    gantryGroup.add(pillarL);
    gantryGroup.add(pillarR);

    // Crossbeam
    const beamGeo = new THREE.BoxGeometry(this.trackWidth + 4, 1.6, 2.0);
    const beam = new THREE.Mesh(beamGeo, pillarMat);
    beam.position.copy(startPoint).add(new THREE.Vector3(0, 9.2, 0));
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), normal);
    gantryGroup.add(beam);

    // Illuminated Finish Banner Mesh
    const bannerGeo = new THREE.PlaneGeometry(this.trackWidth * 0.8, 1.2);
    const bannerMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      side: THREE.DoubleSide
    });
    const banner = new THREE.Mesh(bannerGeo, bannerMat);
    banner.position.copy(startPoint).add(new THREE.Vector3(0, 9.2, 0));
    banner.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
    gantryGroup.add(banner);

    // Chequered start strip across road
    const stripGeo = new THREE.PlaneGeometry(this.trackWidth, 2.5);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.copy(startPoint).add(new THREE.Vector3(0, 0.08, 0));
    strip.rotation.x = Math.PI / 2;
    strip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    strip.rotateX(Math.PI / 2);
    gantryGroup.add(strip);

    this.scene.add(gantryGroup);
  }

  placeBoostPads() {
    // Place boost pads at 4 strategic spots (straights and exit of hairpins)
    const padLocations = [0.08, 0.32, 0.62, 0.88];
    const padMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff, transparent: true, opacity: 0.85 });

    padLocations.forEach((t, idx) => {
      const pt = this.spline.getPointAt(t);
      const tangent = this.spline.getTangentAt(t).normalize();
      const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

      const padGeo = new THREE.PlaneGeometry(5, 7);
      const padMesh = new THREE.Mesh(padGeo, padMat);
      padMesh.position.copy(pt).add(new THREE.Vector3(0, 0.1, 0));
      padMesh.rotation.x = -Math.PI / 2;
      padMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
      padMesh.rotateX(Math.PI / 2);

      // Light glow above pad
      const padLight = new THREE.PointLight(0x00f3ff, 2.0, 12);
      padLight.position.copy(pt).add(new THREE.Vector3(0, 1.5, 0));
      this.scene.add(padLight);

      this.scene.add(padMesh);
      this.boostPads.push({
        position: pt,
        radius: 4.5,
        t: t
      });
    });
  }

  buildCyberpunkEnvironment() {
    // 1. Ground Plane Grid
    const groundGeo = new THREE.PlaneGeometry(1600, 1600);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x050711,
      roughness: 0.95,
      metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // 2. Neon Cyberpunk Skyscrapers
    const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
    const buildingMat = new THREE.MeshStandardMaterial({
      color: 0x090c1a,
      roughness: 0.3,
      metalness: 0.85
    });

    const windowNeonColors = [0x00f3ff, 0xff007f, 0xa855f7, 0x3b82f6];

    // Cluster buildings outside the track perimeter
    for (let i = 0; i < 90; i++) {
      const angle = (i / 90) * Math.PI * 2 + (Math.random() * 0.1);
      const distance = 260 + Math.random() * 320;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;

      const width = 20 + Math.random() * 35;
      const depth = 20 + Math.random() * 35;
      const height = 60 + Math.random() * 180;

      const bMesh = new THREE.Mesh(buildingGeo, buildingMat);
      bMesh.scale.set(width, height, depth);
      bMesh.position.set(x, height / 2, z);
      this.scene.add(bMesh);

      // Glowing roof beacon / edge line
      if (Math.random() > 0.3) {
        const beaconMat = new THREE.MeshBasicMaterial({
          color: windowNeonColors[Math.floor(Math.random() * windowNeonColors.length)]
        });
        const beaconGeo = new THREE.BoxGeometry(width + 0.5, 2.5, depth + 0.5);
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.set(x, height, z);
        this.scene.add(beacon);
      }
    }

    // 3. Starfield Particles
    const starGeo = new THREE.BufferGeometry();
    const starCount = 1200;
    const starPositions = [];
    for (let i = 0; i < starCount; i++) {
      const sx = (Math.random() - 0.5) * 1800;
      const sy = 120 + Math.random() * 600;
      const sz = (Math.random() - 0.5) * 1800;
      starPositions.push(sx, sy, sz);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 2.2,
      transparent: true,
      opacity: 0.8
    });
    const stars = new THREE.Points(starGeo, starMat);
    this.scene.add(stars);
  }

  setupCheckpoints() {
    // 32 checkpoints evenly distributed along the spline
    const count = 32;
    this.checkpoints = [];
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const pt = this.spline.getPointAt(t);
      this.checkpoints.push({
        index: i,
        t: t,
        point: pt
      });
    }
  }

  /**
   * Find closest progress t on track for a given 3D position
   */
  getClosestProgress(position) {
    let bestT = 0;
    let minDistSq = Infinity;
    const steps = 120;

    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const pt = this.spline.getPointAt(t);
      const distSq = pt.distanceToSquared(position);
      if (distSq < minDistSq) {
        minDistSq = distSq;
        bestT = t;
      }
    }

    // Refine local search around bestT
    const delta = 1 / steps;
    const fineSteps = 10;
    for (let i = -fineSteps; i <= fineSteps; i++) {
      const t = (bestT + (i / fineSteps) * delta + 1.0) % 1.0;
      const pt = this.spline.getPointAt(t);
      const distSq = pt.distanceToSquared(position);
      if (distSq < minDistSq) {
        minDistSq = distSq;
        bestT = t;
      }
    }

    const centerPoint = this.spline.getPointAt(bestT);
    const tangent = this.spline.getTangentAt(bestT).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

    // Calculate signed lateral offset from center line (positive = right, negative = left)
    const diff = new THREE.Vector3().subVectors(position, centerPoint);
    const lateralOffset = diff.dot(normal);

    return {
      t: bestT,
      centerPoint: centerPoint,
      distanceFromCenter: Math.abs(lateralOffset),
      lateralOffset: lateralOffset,
      tangent: tangent,
      normal: normal
    };
  }

  /**
   * Check if position hits any boost pad
   */
  checkBoostPadHit(position) {
    for (const pad of this.boostPads) {
      if (pad.position.distanceTo(position) < pad.radius) {
        return true;
      }
    }
    return false;
  }
}
