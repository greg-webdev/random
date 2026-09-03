import * as THREE from 'three';

/**
 * Arcade 3D Racing Vehicle Physics & Dynamics Engine
 */
export class Vehicle {
  constructor(carHandle, isAI = false) {
    this.carHandle = carHandle;
    this.mesh = carHandle.mesh;
    this.isAI = isAI;

    // Kinematics
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.forward = new THREE.Vector3(0, 0, 1);
    this.heading = 0; // Yaw angle in radians
    this.speed = 0;   // Forward speed (units / sec)
    this.steerAngle = 0;

    // Performance Specs
    this.maxSpeed = 85.0;            // ~200 km/h in display
    this.boostMaxSpeed = 120.0;       // ~280 km/h
    this.acceleration = 45.0;
    this.braking = 55.0;
    this.reverseMaxSpeed = -20.0;
    this.drag = 0.985;
    this.turnSpeed = 2.4;

    // Drift & Boost
    this.isDrifting = false;
    this.driftDirection = 0;         // -1 left, 1 right
    this.driftFactor = 0.0;
    this.nitro = 100.0;              // 0 to 100%
    this.isBoosting = false;
    this.boostTimer = 0;

    // Race Progress
    this.currentLap = 1;
    this.lapProgress = 0.0;          // 0 to 1 along track spline
    this.totalProgress = 0.0;        // laps + lapProgress
    this.currentCheckpoint = 0;
    this.lapStartTime = 0;
    this.currentLapTime = 0;
    this.bestLapTime = Infinity;
    this.lapTimes = [];
    this.raceFinished = false;

    // Spark / Collision state
    this.lastWallHit = 0;
  }

  reset(startPosition, startTangent) {
    this.position.copy(startPosition);
    this.velocity.set(0, 0, 0);
    this.speed = 0;
    this.steerAngle = 0;
    this.currentLap = 1;
    this.lapProgress = 0.0;
    this.totalProgress = 0.0;
    this.currentCheckpoint = 0;
    this.currentLapTime = 0;
    this.lapTimes = [];
    this.raceFinished = false;
    this.nitro = 100.0;
    this.isBoosting = false;
    this.boostTimer = 0;

    // Orient mesh along startTangent
    this.heading = Math.atan2(startTangent.x, startTangent.z);
    this.forward.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    this.mesh.position.copy(this.position);
    this.mesh.rotation.set(0, this.heading, 0);
  }

  update(delta, input, track) {
    if (delta > 0.1) delta = 0.1; // Clamp large frame jumps

    // 1. Process Steering
    const steerTarget = (input.steer || 0) * 0.48;
    this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, steerTarget, delta * 12.0);

    // Speed-dependent steering responsiveness
    const speedRatio = Math.abs(this.speed) / this.maxSpeed;
    const effectiveTurn = this.turnSpeed * (1.1 - speedRatio * 0.45);

    // 2. Process Drift Input
    if (input.drift && Math.abs(this.speed) > 15 && Math.abs(input.steer) > 0.1) {
      this.isDrifting = true;
      this.driftDirection = Math.sign(input.steer);
      this.driftFactor = THREE.MathUtils.lerp(this.driftFactor, 1.0, delta * 4.0);
      // Drifting charges nitro!
      this.nitro = Math.min(100, this.nitro + delta * 25.0);
    } else {
      this.isDrifting = false;
      this.driftFactor = THREE.MathUtils.lerp(this.driftFactor, 0.0, delta * 6.0);
      // Slow passive nitro recharge
      this.nitro = Math.min(100, this.nitro + delta * 4.0);
    }

    // 3. Process Nitro Boost
    if (this.boostTimer > 0) {
      this.boostTimer -= delta;
      this.isBoosting = true;
    } else if (input.boost && this.nitro > 5) {
      this.isBoosting = true;
      this.nitro = Math.max(0, this.nitro - delta * 35.0);
    } else {
      this.isBoosting = false;
    }

    // 4. Acceleration / Braking
    const currentMaxSpeed = this.isBoosting ? this.boostMaxSpeed : this.maxSpeed;
    const accelRate = this.acceleration * (this.isBoosting ? 2.2 : 1.0);

    if (input.throttle > 0) {
      if (this.speed < currentMaxSpeed) {
        this.speed += accelRate * input.throttle * delta;
      }
    } else if (input.brake > 0) {
      if (this.speed > 0) {
        this.speed -= this.braking * input.brake * delta;
        if (this.speed < 0) this.speed = 0;
      } else {
        // Reverse
        if (this.speed > this.reverseMaxSpeed) {
          this.speed -= (this.acceleration * 0.5) * input.brake * delta;
        }
      }
    } else {
      // Natural drag deceleration
      this.speed *= Math.pow(this.drag, delta * 60);
      if (Math.abs(this.speed) < 0.1) this.speed = 0;
    }

    // 5. Yaw & Angular Dynamics (with drift slip angle)
    if (Math.abs(this.speed) > 0.5) {
      const dirSign = Math.sign(this.speed);
      const turnDelta = -this.steerAngle * effectiveTurn * dirSign * delta;
      this.heading += turnDelta;

      if (this.isDrifting) {
        // Extra slide angle
        this.heading += -this.driftDirection * 0.4 * this.driftFactor * delta;
      }
    }

    // 6. Forward vector & Position integration
    this.forward.set(Math.sin(this.heading), 0, Math.cos(this.heading));

    // Drift slip velocity blending
    const moveVelocity = this.forward.clone().multiplyScalar(this.speed);
    this.position.addScaledVector(moveVelocity, delta);

    // 7. Track Boundary Collision & Surface Snapping
    const trackInfo = track.getClosestProgress(this.position);
    this.lapProgress = trackInfo.t;

    // Follow road elevation smoothly
    this.position.y = THREE.MathUtils.lerp(this.position.y, trackInfo.centerPoint.y + 0.1, delta * 15.0);

    // Guardrail collision check
    const halfTrack = track.trackWidth / 2 - 1.2;
    if (trackInfo.distanceFromCenter > halfTrack) {
      // Hit outer rail: push back inward & reduce speed
      const inwardNormal = trackInfo.normal.clone().multiplyScalar(trackInfo.lateralOffset > 0 ? -1 : 1);
      const penetration = trackInfo.distanceFromCenter - halfTrack;
      this.position.addScaledVector(inwardNormal, penetration * 1.05);

      this.speed *= 0.88; // Collision deceleration
      this.lastWallHit = performance.now();
    }

    // 8. Boost Pad Trigger Check
    if (track.checkBoostPadHit(this.position)) {
      this.boostTimer = 1.2; // 1.2s of super boost!
      this.speed = Math.max(this.speed, this.boostMaxSpeed * 0.95);
    }

    // 9. Checkpoint & Lap Progress Update
    this.updateCheckpoints(trackInfo.t);

    // 10. Update 3D Mesh transforms & Visuals
    this.mesh.position.copy(this.position);
    
    // Body roll / tilt during hard turns or drifts
    const rollAngle = -this.steerAngle * 0.12 * (this.isDrifting ? 1.8 : 1.0);
    const pitchAngle = (input.throttle ? -0.02 : 0) + (input.brake ? 0.04 : 0);
    this.mesh.rotation.set(pitchAngle, this.heading, rollAngle);

    // Wheels rotation & steering
    this.carHandle.updateWheels(this.speed * delta, this.steerAngle);

    // Exhaust Flames
    this.carHandle.setFlameVisibility(this.isBoosting, this.isBoosting ? 1.5 : 0.0);
  }

  updateCheckpoints(currentT) {
    const totalCheckpoints = 32;
    const expectedCp = (this.currentCheckpoint + 1) % totalCheckpoints;
    const expectedT = expectedCp / totalCheckpoints;

    // Check if passed next checkpoint
    let diff = Math.abs(currentT - expectedT);
    if (diff > 0.5) diff = 1.0 - diff;

    if (diff < 0.08) {
      this.currentCheckpoint = expectedCp;

      // Completed full lap when wrapping back to 0
      if (this.currentCheckpoint === 0) {
        this.completeLap();
      }
    }

    // Continuous monotonic total race progress: laps + currentT
    this.totalProgress = (this.currentLap - 1) + currentT;
  }

  completeLap() {
    if (this.lapStartTime > 0) {
      const lapTime = (performance.now() - this.lapStartTime) / 1000;
      this.lapTimes.push(lapTime);
      if (lapTime < this.bestLapTime) {
        this.bestLapTime = lapTime;
      }
    }
    this.lapStartTime = performance.now();
    this.currentLap++;
  }

  getSpeedKMH() {
    // 1 unit/sec ≈ 2.5 km/h
    return Math.round(Math.abs(this.speed) * 2.4);
  }
}
