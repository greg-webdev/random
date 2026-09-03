import * as THREE from 'three';

/**
 * Hierarchical AI Racing Pilot:
 * 60 FPS Reflexive Spline & Obstacle Steering + Async Ollama Tactical Decision Integration
 */
export class OllamaDriver {
  constructor(vehicle, track, ollamaService, soundManager) {
    this.vehicle = vehicle;
    this.track = track;
    this.ollama = ollamaService;
    this.sound = soundManager;

    // AI Driving Characteristics
    this.baseSpeedFactor = 1.0;     // Difficulty tuning: normal 1.0, pro 1.15, ludicrous 1.3
    this.aggression = 0.8;
    this.targetLine = 'center';     // 'inside' | 'center' | 'outside'
    this.activeTactic = 'CRUISING';
    this.lookAheadDistance = 25.0;

    // Autonomous steering smoothing
    this.steerSmooth = 0;
    this.isBrakingForCorner = false;

    // Tactical loop timer
    this.tacticalCycleMs = 3000;
    this.lastTacticalCall = 0;

    // Radio Callback for UI
    this.onRadioMessage = null;
  }

  setDifficulty(difficulty) {
    switch (difficulty) {
      case 'pro':
        this.baseSpeedFactor = 1.12;
        this.vehicle.maxSpeed = 92.0;
        break;
      case 'ludicrous':
        this.baseSpeedFactor = 1.25;
        this.vehicle.maxSpeed = 100.0;
        break;
      case 'normal':
      default:
        this.baseSpeedFactor = 1.0;
        this.vehicle.maxSpeed = 85.0;
        break;
    }
  }

  /**
   * Called every frame in the main game loop (60 FPS)
   */
  update(delta, playerVehicle, raceTime) {
    const now = performance.now();

    // 1. Check if it's time for an Ollama tactical consultation
    if (now - this.lastTacticalCall > this.tacticalCycleMs && !this.vehicle.raceFinished) {
      this.lastTacticalCall = now;
      this.requestOllamaTactics(playerVehicle);
    }

    // 2. High-Speed 60 FPS Reflex Driving
    const inputs = this.computeReflexInputs(delta, playerVehicle);
    this.vehicle.update(delta, inputs, this.track);
  }

  computeReflexInputs(delta, playerVehicle) {
    const currentT = this.vehicle.lapProgress;
    const speed = Math.abs(this.vehicle.speed);

    // Look-ahead distance increases with speed
    const lookAheadDist = 18.0 + (speed / 20.0) * 12.0;
    const lookAheadT = (currentT + (lookAheadDist / this.track.trackLength)) % 1.0;

    // Get spline target point & tangent
    const targetCenter = this.track.spline.getPointAt(lookAheadT);
    const targetTangent = this.track.spline.getTangentAt(lookAheadT).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const targetNormal = new THREE.Vector3().crossVectors(targetTangent, up).normalize();

    // Lateral offset based on tactical line preference
    let lateralOffset = 0;
    const halfWidth = (this.track.trackWidth / 2) - 2.5;

    if (this.targetLine === 'inside') {
      // Determine which direction the upcoming curve turns
      const nextT = (lookAheadT + 0.05) % 1.0;
      const nextCenter = this.track.spline.getPointAt(nextT);
      const toNext = new THREE.Vector3().subVectors(nextCenter, targetCenter);
      const curveDir = toNext.dot(targetNormal);
      lateralOffset = curveDir > 0 ? halfWidth * 0.7 : -halfWidth * 0.7;
    } else if (this.targetLine === 'outside') {
      const nextT = (lookAheadT + 0.05) % 1.0;
      const nextCenter = this.track.spline.getPointAt(nextT);
      const toNext = new THREE.Vector3().subVectors(nextCenter, targetCenter);
      const curveDir = toNext.dot(targetNormal);
      lateralOffset = curveDir > 0 ? -halfWidth * 0.6 : halfWidth * 0.6;
    }

    // Player obstacle / drafting adjustment
    const distToPlayer = this.vehicle.position.distanceTo(playerVehicle.position);
    if (distToPlayer < 12.0) {
      if (this.activeTactic === 'BLOCK_INSIDE') {
        // Match player's lateral position to block!
        const playerTrackInfo = this.track.getClosestProgress(playerVehicle.position);
        lateralOffset = THREE.MathUtils.clamp(playerTrackInfo.lateralOffset, -halfWidth, halfWidth);
      } else if (this.activeTactic === 'DRAFT_SLINGSHOT') {
        // Follow closely behind then pull to the side
        if (distToPlayer < 6.0) {
          lateralOffset = lateralOffset > 0 ? -halfWidth * 0.7 : halfWidth * 0.7;
        }
      }
    }

    // Final desired 3D target
    const desiredTarget = targetCenter.clone().addScaledVector(targetNormal, lateralOffset);

    // Compute steering angle error
    const toTarget = new THREE.Vector3().subVectors(desiredTarget, this.vehicle.position).normalize();
    const forward = this.vehicle.forward;
    const right = new THREE.Vector3(-forward.z, 0, forward.x); // Local right vector

    const forwardDot = forward.dot(toTarget);
    const rightDot = right.dot(toTarget);

    // Calculate required steering input (-1 to 1)
    let rawSteer = -rightDot * 2.2;
    rawSteer = THREE.MathUtils.clamp(rawSteer, -1.0, 1.0);

    this.steerSmooth = THREE.MathUtils.lerp(this.steerSmooth, rawSteer, delta * 14.0);

    // Detect curvature ahead for smart corner braking
    const currentTangent = this.track.spline.getTangentAt(currentT).normalize();
    const curvature = 1.0 - currentTangent.dot(targetTangent); // 0 on straight, up to ~0.5 on sharp curve

    let throttle = 1.0;
    let brake = 0.0;
    let drift = false;

    // Corner braking & drift initiation
    if (curvature > 0.18 && speed > 55.0) {
      brake = 0.6;
      throttle = 0.2;
      this.isBrakingForCorner = true;

      // Drift if sharp corner and fast
      if (curvature > 0.25 && speed > 48.0) {
        drift = true;
      }
    } else {
      this.isBrakingForCorner = false;
      throttle = 1.0;
      brake = 0.0;
    }

    // AI Boost activation
    let boost = false;
    if (this.activeTactic === 'TURBO_SURGE' || (curvature < 0.05 && speed > 60.0 && this.vehicle.nitro > 40)) {
      boost = true;
    }

    return {
      steer: this.steerSmooth,
      throttle: throttle,
      brake: brake,
      drift: drift,
      boost: boost
    };
  }

  async requestOllamaTactics(playerVehicle) {
    const isAiLeading = this.vehicle.totalProgress >= playerVehicle.totalProgress;
    const distGap = this.vehicle.position.distanceTo(playerVehicle.position);
    const gapSec = (Math.abs(this.vehicle.totalProgress - playerVehicle.totalProgress) * 45).toFixed(1);

    // Determine upcoming track section description
    const currentT = this.vehicle.lapProgress;
    let section = 'High-Speed Straightaway';
    if (currentT > 0.15 && currentT < 0.35) section = 'Sweeping Banked Turn';
    else if (currentT > 0.35 && currentT < 0.50) section = 'Technical Chicane';
    else if (currentT > 0.50 && currentT < 0.70) section = 'Dangerous Hairpin Bend';
    else if (currentT > 0.70 && currentT < 0.85) section = 'Downhill S-Curves';

    const telemetry = {
      aiLap: this.vehicle.currentLap,
      aiSpeed: this.vehicle.getSpeedKMH(),
      aiNitro: Math.round(this.vehicle.nitro),
      aiPosition: isAiLeading ? '1st' : '2nd',
      playerLap: playerVehicle.currentLap,
      playerSpeed: playerVehicle.getSpeedKMH(),
      playerPosition: isAiLeading ? '2nd' : '1st',
      distanceGap: distGap,
      gapDescription: isAiLeading ? `AI leading by ${gapSec}s` : `Player leading by ${gapSec}s`,
      trackSection: section,
      isAiLeading: isAiLeading
    };

    const decision = await this.ollama.getTacticalDecision(telemetry);

    if (decision) {
      this.activeTactic = decision.tactic || 'CUT_APEX';
      this.targetLine = decision.targetLine || 'inside';
      this.aggression = decision.aggression || 0.85;

      if (decision.boost && this.vehicle.nitro > 20) {
        this.vehicle.boostTimer = 1.0;
      }

      // Notify UI and speak radio taunt
      if (this.onRadioMessage && decision.radioTaunt) {
        this.onRadioMessage({
          text: decision.radioTaunt,
          tactic: this.activeTactic,
          line: this.targetLine,
          latency: decision.latency,
          source: decision.source,
          persona: this.ollama.persona
        });

        // Trigger sound & speech synthesis
        this.sound.playRadioGlitch();
        this.sound.speakOllama(decision.radioTaunt);
      }
    }
  }
}
