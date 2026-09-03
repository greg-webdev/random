import * as THREE from 'three';

/**
 * Procedural 3D Cyberpunk Sports Car Model Generator
 */
export function createCyberCar(isAI = false) {
  const carGroup = new THREE.Group();

  // Primary colors
  const mainColor = isAI ? 0x9333ea : 0x00d2ff;       // AI: Electric Purple/Magenta, Player: Neon Cyan
  const accentColor = isAI ? 0xff007f : 0x00f3ff;     // Trim glow
  const darkColor = 0x0f172a;                        // Carbon fiber dark body

  // Car Materials
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: mainColor,
    metalness: 0.85,
    roughness: 0.25,
    envMapIntensity: 1.0,
  });

  const darkMaterial = new THREE.MeshStandardMaterial({
    color: darkColor,
    metalness: 0.6,
    roughness: 0.5,
  });

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x111827,
    metalness: 0.2,
    roughness: 0.1,
    transmission: 0.8,
    transparent: true,
    opacity: 0.85,
  });

  const neonGlowMat = new THREE.MeshBasicMaterial({
    color: accentColor,
  });

  const tailGlowMat = new THREE.MeshBasicMaterial({
    color: 0xff0033,
  });

  // 1. Lower Chassis
  const lowerGeo = new THREE.BoxGeometry(1.9, 0.35, 4.2);
  const lowerMesh = new THREE.Mesh(lowerGeo, darkMaterial);
  lowerMesh.position.y = 0.35;
  lowerMesh.castShadow = true;
  lowerMesh.receiveShadow = true;
  carGroup.add(lowerMesh);

  // 2. Main Body Shell (wedge profile)
  const bodyGeo = new THREE.BoxGeometry(1.8, 0.45, 3.8);
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMaterial);
  bodyMesh.position.set(0, 0.6, -0.1);
  bodyMesh.castShadow = true;
  carGroup.add(bodyMesh);

  // Front nose slope
  const noseGeo = new THREE.ConeGeometry(0.9, 1.2, 4);
  const noseMesh = new THREE.Mesh(noseGeo, bodyMaterial);
  noseMesh.rotation.x = -Math.PI / 2;
  noseMesh.rotation.y = Math.PI / 4;
  noseMesh.scale.set(1.4, 1.0, 0.35);
  noseMesh.position.set(0, 0.45, 1.9);
  carGroup.add(noseMesh);

  // 3. Cabin / Cockpit
  const cabinGeo = new THREE.BoxGeometry(1.3, 0.42, 1.8);
  const cabinMesh = new THREE.Mesh(cabinGeo, glassMaterial);
  cabinMesh.position.set(0, 0.95, -0.3);
  cabinMesh.castShadow = true;
  carGroup.add(cabinMesh);

  // Roof strip (color accent)
  const roofGeo = new THREE.BoxGeometry(1.2, 0.05, 1.6);
  const roofMesh = new THREE.Mesh(roofGeo, bodyMaterial);
  roofMesh.position.set(0, 1.17, -0.3);
  carGroup.add(roofMesh);

  // 4. Rear Spoiler / Wing
  const spoilerStrutGeo = new THREE.BoxGeometry(0.08, 0.4, 0.15);
  const strutL = new THREE.Mesh(spoilerStrutGeo, darkMaterial);
  strutL.position.set(-0.65, 1.0, -1.9);
  const strutR = new THREE.Mesh(spoilerStrutGeo, darkMaterial);
  strutR.position.set(0.65, 1.0, -1.9);
  carGroup.add(strutL);
  carGroup.add(strutR);

  const wingGeo = new THREE.BoxGeometry(1.9, 0.06, 0.4);
  const wingMesh = new THREE.Mesh(wingGeo, bodyMaterial);
  wingMesh.position.set(0, 1.2, -1.9);
  carGroup.add(wingMesh);

  // Neon strip on rear wing
  const wingNeonGeo = new THREE.BoxGeometry(1.85, 0.03, 0.04);
  const wingNeon = new THREE.Mesh(wingNeonGeo, neonGlowMat);
  wingNeon.position.set(0, 1.2, -2.1);
  carGroup.add(wingNeon);

  // 5. Headlights
  const lightGeo = new THREE.BoxGeometry(0.35, 0.1, 0.1);
  const headL = new THREE.Mesh(lightGeo, neonGlowMat);
  headL.position.set(-0.65, 0.5, 2.05);
  const headR = new THREE.Mesh(lightGeo, neonGlowMat);
  headR.position.set(0.65, 0.5, 2.05);
  carGroup.add(headL);
  carGroup.add(headR);

  // Forward Spotlight cones for player
  if (!isAI) {
    const spotL = new THREE.SpotLight(0x00f3ff, 2.5, 45, Math.PI / 6, 0.5, 1.5);
    spotL.position.set(-0.65, 0.55, 2.1);
    const targetL = new THREE.Object3D();
    targetL.position.set(-0.65, 0, 15);
    carGroup.add(spotL);
    carGroup.add(targetL);
    spotL.target = targetL;

    const spotR = new THREE.SpotLight(0x00f3ff, 2.5, 45, Math.PI / 6, 0.5, 1.5);
    spotR.position.set(0.65, 0.55, 2.1);
    const targetR = new THREE.Object3D();
    targetR.position.set(0.65, 0, 15);
    carGroup.add(spotR);
    carGroup.add(targetR);
    spotR.target = targetR;
  }

  // 6. Taillights
  const tailGeo = new THREE.BoxGeometry(0.65, 0.08, 0.08);
  const tailL = new THREE.Mesh(tailGeo, tailGlowMat);
  tailL.position.set(-0.55, 0.55, -2.05);
  const tailR = new THREE.Mesh(tailGeo, tailGlowMat);
  tailR.position.set(0.55, 0.55, -2.05);
  carGroup.add(tailL);
  carGroup.add(tailR);

  // 7. Underglow Light
  const underglow = new THREE.PointLight(accentColor, 1.5, 6, 1.8);
  underglow.position.set(0, 0.1, 0);
  carGroup.add(underglow);

  // 8. Wheels
  const wheelRadius = 0.38;
  const wheelWidth = 0.32;
  const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 18);
  wheelGeo.rotateZ(Math.PI / 2);

  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.8,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: mainColor,
    metalness: 0.9,
    roughness: 0.2,
  });

  function createWheel() {
    const wGroup = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeo, wheelMat);
    tire.castShadow = true;
    wGroup.add(tire);

    const rimGeo = new THREE.CylinderGeometry(wheelRadius * 0.65, wheelRadius * 0.65, wheelWidth + 0.01, 8);
    rimGeo.rotateZ(Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    wGroup.add(rim);

    return wGroup;
  }

  const wheelFL = createWheel();
  wheelFL.position.set(-1.0, wheelRadius, 1.35);
  const wheelFR = createWheel();
  wheelFR.position.set(1.0, wheelRadius, 1.35);
  const wheelRL = createWheel();
  wheelRL.position.set(-1.0, wheelRadius, -1.35);
  const wheelRR = createWheel();
  wheelRR.position.set(1.0, wheelRadius, -1.35);

  carGroup.add(wheelFL);
  carGroup.add(wheelFR);
  carGroup.add(wheelRL);
  carGroup.add(wheelRR);

  // 9. Nitro Exhaust Flames
  const flameMat = new THREE.MeshBasicMaterial({
    color: isAI ? 0xff00aa : 0x00f3ff,
    transparent: true,
    opacity: 0.0,
  });
  const flameGeo = new THREE.ConeGeometry(0.16, 0.9, 8);
  flameGeo.rotateX(-Math.PI / 2);

  const flameL = new THREE.Mesh(flameGeo, flameMat);
  flameL.position.set(-0.35, 0.35, -2.4);
  const flameR = new THREE.Mesh(flameGeo, flameMat);
  flameR.position.set(0.35, 0.35, -2.4);

  carGroup.add(flameL);
  carGroup.add(flameR);

  // Return handle object with animatable parts
  return {
    mesh: carGroup,
    wheels: {
      fl: wheelFL,
      fr: wheelFR,
      rl: wheelRL,
      rr: wheelRR,
    },
    flames: [flameL, flameR],
    flameMat: flameMat,
    setFlameVisibility: (visible, intensity = 1.0) => {
      flameMat.opacity = visible ? THREE.MathUtils.clamp(0.6 + Math.random() * 0.4 * intensity, 0, 1) : 0;
      const scale = 0.8 + Math.random() * 0.5 * intensity;
      flameL.scale.set(scale, scale, scale * 1.3);
      flameR.scale.set(scale, scale, scale * 1.3);
    },
    updateWheels: (speed, steerAngle) => {
      const rotDelta = speed * 0.08;
      wheelFL.rotation.x += rotDelta;
      wheelFR.rotation.x += rotDelta;
      wheelRL.rotation.x += rotDelta;
      wheelRR.rotation.x += rotDelta;

      // Steer front wheels
      wheelFL.rotation.y = steerAngle;
      wheelFR.rotation.y = steerAngle;
    }
  };
}
