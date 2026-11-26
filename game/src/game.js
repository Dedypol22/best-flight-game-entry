// Flight physics, mission state, collision rules, fuel, damage, scoring, and campaign transitions.
import { CONFIG } from './config.js';
import { World } from './world.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class FlightGame {
  constructor(seed = 1, hooks = {}) {
    this.seed = seed;
    this.hooks = hooks;
    this.world = new World(seed);
    this.mission = 0;
    this.totalScore = 0;
    this.frame = 0;
    this.state = this.makeState('title');
  }

  makeState(mode = 'playing', mission = this.mission) {
    const runway = this.world.runway;
    const aircraft = {
      x: runway.x, y: 6, z: runway.z + runway.length * 0.28,
      vx: 0, vy: 0, vz: 0, altitude: 6, airspeed: 0, heading: 0,
      pitch: 0, bank: 0, throttle: 0.22, fuel: CONFIG.AIRCRAFT.FUEL_CAPACITY,
      damage: 0, score: 0, gearDown: true, flaps: 0, onGround: true, time: 0,
    };
    this.world.resetMission(mission);
    return {
      mode, mission, missionProgress: { ringsPassed: 0, cratesDelivered: 0, landingPhase: 'approach' },
      aircraft, elapsed: 0, time: 0, seed: this.seed, frame: 0, paused: false,
      cockpitView: false, cameraX: aircraft.x, cameraY: aircraft.y + CONFIG.CAMERA.CHASE_HEIGHT,
      cameraZ: aircraft.z - CONFIG.CAMERA.CHASE_DIST, cameraPitch: 0.12, cameraHeading: 0,
      cosH: 1, sinH: 0, sunAngle: 0.32, windAngle: 0.15, crashCause: '', totalScore: this.totalScore,
      takeoff: false,
    };
  }

  startMission(id = this.mission) {
    this.mission = clamp(id, 0, 2);
    this.state = this.makeState('playing', this.mission);
    this.state.mode = 'playing';
  }

  restart() { this.state = this.makeState('playing', this.mission); }

  setShot(name) {
    const s = this.state;
    const a = s.aircraft;
    const runway = this.world.runway;
    s.mode = name === 'start' ? 'title' : 'playing';
    s.mission = name === 'land' ? 2 : 0;
    this.mission = s.mission;
    this.world.resetMission(s.mission);
    a.fuel = 174;
    a.throttle = 0.76;
    a.time = 18;
    s.time = 18;
    s.elapsed = 84;
    s.sunAngle = 0.32;
    s.cockpitView = false;
    if (name === 'start') {
      a.x = runway.x; a.z = runway.z + 90; a.y = 6; a.airspeed = 0; a.gearDown = true;
      s.cameraX = a.x; s.cameraY = 90; s.cameraZ = a.z - 250; s.cameraPitch = 0.24; s.cameraHeading = 0;
      return;
    }
    if (name === 'land') {
      // On the runway centreline: the strip is only 30 m wide, and the
      // landing check needs |across| < 16.5 m. Staging 42 m to the side
      // (as before) flew the whole approach parallel to the runway and
      // the aircraft met the ground beside it instead of landing on it.
      a.x = runway.x; a.z = runway.z + 710; a.y = 58; a.altitude = 58; a.airspeed = 42;
      a.vx = 0; a.vy = -2.2; a.vz = -42; a.heading = Math.PI; a.pitch = -0.02;
      // Gentle approach power: full cruise throttle would accelerate the
      // aircraft past the 52 m/s touchdown band before it reaches the
      // runway, so the landing check could never fire.
      a.throttle = 0.45;
      a.gearDown = true; a.flaps = 1; s.missionProgress.landingPhase = 'approach';
      s.cameraX = a.x; s.cameraY = a.y + 66; s.cameraZ = a.z + 195; s.cameraHeading = Math.PI; s.cameraPitch = -0.12;
      return;
    }
    const ring = this.world.rings[name === 'ring' ? 2 : 0];
    a.x = ring.x; a.z = ring.z - 340; a.y = ring.height + 10; a.altitude = a.y;
    a.airspeed = 52; a.vx = Math.sin(a.heading) * 52; a.vy = 0; a.vz = Math.cos(a.heading) * 52;
    a.gearDown = false; a.flaps = 0;
    s.cameraX = a.x; s.cameraY = a.y + 82; s.cameraZ = a.z - 230; s.cameraPitch = 0.18; s.cameraHeading = a.heading;
    if (name === 'ring') {
      // Staging only marks progress; the aircraft stays on the generic
      // placement above — directly behind the ring on its flight line, so
      // it flies straight through the ring instead of passing 110 m to
      // the side of it and never scoring.
      s.missionProgress.ringsPassed = 2;
      this.world.rings.forEach((item, index) => { item.passed = index < 2; item.active = index === 2; });
    }
  }

  setPosition(x, y, z, heading = 0, speed = 45) {
    const a = this.state.aircraft;
    a.x = x; a.y = y; a.z = z; a.heading = heading; a.airspeed = speed;
    a.vx = Math.sin(heading) * speed; a.vy = 0; a.vz = Math.cos(heading) * speed;
    a.onGround = false;
  }

  crash(cause) {
    if (this.state.mode !== 'playing') return;
    this.state.mode = 'gameover';
    this.state.crashCause = cause;
    this.hooks.crash?.(cause);
  }

  completeMission() {
    if (this.state.mode !== 'playing') return;
    const a = this.state.aircraft;
    const bonus = Math.floor(a.fuel / CONFIG.AIRCRAFT.FUEL_CAPACITY * 300) - Math.floor(a.damage * 300);
    a.score = Math.max(0, a.score + Math.max(0, bonus));
    this.totalScore += a.score;
    this.state.totalScore = this.totalScore;
    this.state.mode = 'mission-complete';
  }

  update(dt, input, audio) {
    const s = this.state;
    s.frame++; this.frame = s.frame;
    if (s.mode !== 'playing' || s.paused) return;
    const a = s.aircraft;
    const cfg = CONFIG.AIRCRAFT;
    dt = Math.min(dt, 1 / 30);
    s.elapsed += dt; s.time += dt; a.time += dt;
    const throttleUp = input.down('KeyW');
    const throttleDown = input.down('KeyS', 'ArrowDown');
    a.throttle = clamp(a.throttle + (throttleUp ? 0.65 : 0) * dt - (throttleDown ? 0.75 : 0) * dt, 0, 1);
    const pitchInput = (input.down('ArrowUp') ? 1 : 0) - (input.down('ArrowDown') ? 1 : 0);
    const bankInput = (input.down('ArrowRight', 'KeyD') ? 1 : 0) - (input.down('ArrowLeft', 'KeyA') ? 1 : 0);
    let steer = bankInput;
    if (input.mouse.active && !s.cockpitView) steer += clamp(input.mouse.x, -1, 1) * 0.45;
    a.bank = clamp(a.bank + steer * cfg.ROLL_RATE_MAX * dt, -0.9, 0.9);
    if (!bankInput && !input.mouse.active) a.bank *= Math.exp(-0.7 * dt);
    a.pitch = clamp(a.pitch + pitchInput * cfg.PITCH_RATE_MAX * dt, -0.48, 0.48);
    if (!pitchInput) a.pitch *= Math.exp(-0.3 * dt);
    // Turn rate has an airspeed-independent part so the aircraft still
    // answers the bank on the ground (airspeed 0), where a pure
    // airspeed-coupled rate would leave the heading frozen at 0.000.
    a.heading = (a.heading + Math.sin(a.bank) * (a.airspeed / 65) * 0.72 * dt + Math.sin(a.bank) * 0.18 * dt + Math.PI * 2) % (Math.PI * 2);
    a.vx = Math.sin(a.heading) * a.airspeed;
    a.vz = Math.cos(a.heading) * a.airspeed;
    const targetSpeed = 9 + a.throttle * 65 - Math.max(0, a.pitch) * 10 - a.flaps * 3;
    const throttleAcceleration = (input.down('KeyW') ? 22 : 0) - (input.down('KeyS') ? 28 : 0);
    const acceleration = (targetSpeed - a.airspeed) * (a.onGround ? 0.55 : 0.24);
    a.airspeed = clamp(a.airspeed + (acceleration + throttleAcceleration) * dt, 0, cfg.MAX_SPEED);
    // Rolling resistance: a landing rollout brakes much harder than a
    // takeoff roll, or a flown landing never stops and runs off the
    // runway end with the throttle still up.
    const rolloutBraking = s.mission === 2 && s.missionProgress.landingPhase !== 'approach';
    if (a.onGround) a.airspeed = Math.max(0, a.airspeed - (input.down('KeyS') ? 16 : rolloutBraking ? 14 : 4) * dt);
    const stallSpeed = a.flaps ? cfg.STALL_SPEED_FLAPS : cfg.STALL_SPEED;
    const lift = a.airspeed < stallSpeed ? (a.airspeed / stallSpeed) ** 2 : Math.min(1.35, 0.72 + a.airspeed / 110);
    // Level flight settles into a gentle descent: at cruise the lift term
    // only just balances the sink term, so without elevator input the
    // aircraft slowly loses height instead of floating level forever.
    // A staged landing approach therefore actually lands, instead of
    // levelling off at 25 m, sailing past the runway and meeting a hill.
    a.vy += (lift * 9.81 * Math.sin(a.pitch + 0.05) - (a.airspeed < stallSpeed ? 3.2 : 0.85)) * dt;
    // Vertical speed is capped: with no damping, holding full pitch-up
    // lets vy grow without bound and the aircraft climbs like a rocket
    // (1,700 m+ in 25 s). 30 m/s is still a brisk climb for a bush plane.
    a.vy = clamp(a.vy, -30, 30);
    if (a.airspeed > 34) s.takeoff = true;
    if (s.takeoff || !a.onGround) {
      a.x += Math.sin(a.heading) * a.airspeed * dt;
      a.z += Math.cos(a.heading) * a.airspeed * dt;
      a.y += a.vy * dt;
      if (a.onGround && s.mission === 2 && s.missionProgress.landingPhase !== 'approach') {
        // Rolling after touchdown: pin the aircraft to the surface. Level
        // flight slowly gains climb, so without this the rollout floats a
        // fraction of a metre above the touchdown band and the landing
        // check stops seeing it, and the mission can never complete.
        // Gated on the landing phase (not just onGround): a fresh mission
        // also starts onGround, and pinning there would slam a staged
        // airborne shot — or a rotating takeoff — down to the ground.
        a.y = this.world.getHeight(a.x, a.z) + 3; a.vy = 0;
      }
      a.onGround = false;
    } else {
      a.z += Math.cos(a.heading) * a.airspeed * dt;
      a.x += Math.sin(a.heading) * a.airspeed * dt;
      a.y = Math.max(a.y, this.world.getHeight(a.x, a.z) + 5);
    }
    a.altitude = Math.max(0, a.y - this.world.getHeight(a.x, a.z));
    a.fuel = Math.max(0, a.fuel - (0.015 + a.throttle * 0.105) * dt);
    if (a.fuel <= 0) a.throttle = 0;
    audio?.update(a.throttle, a.airspeed);
    if (input.pressed('Space')) this.actionSpace();
    this.checkRings(audio);
    this.checkLanding(audio);
    this.checkTerrain();
    this.updateCamera(dt);
    this.world.updateSmoke(dt);
    this.hooks.update?.(dt);
  }

  actionSpace() {
    const s = this.state, a = s.aircraft;
    if (s.mission === 1) {
      if (s.missionProgress.cratesDelivered >= 3 || a.altitude > 110 || a.airspeed > 58) return;
      const target = this.world.dropZones[s.missionProgress.cratesDelivered];
      const d = Math.hypot(a.x - target.x, a.z - target.z);
      if (d < target.radius * 1.8) {
        target.delivered = true; s.missionProgress.cratesDelivered++;
        a.score += d < target.radius * 0.7 ? CONFIG.SCORING.DROP_HIT : CONFIG.SCORING.DROP_CLOSE;
        if (s.missionProgress.cratesDelivered >= 3) this.completeMission();
      } else a.score = Math.max(0, a.score - 40);
    } else {
      a.flaps = a.flaps ? 0 : 1;
    }
  }

  checkRings(audio) {
    const s = this.state;
    if (s.mission !== 0) return;
    const ring = this.world.rings.find(item => item.active && !item.passed);
    if (!ring) return;
    const d = Math.hypot(s.aircraft.x - ring.x, s.aircraft.z - ring.z);
    if (d < ring.radius && Math.abs(s.aircraft.y - ring.height) < ring.radius) {
      ring.passed = true; s.missionProgress.ringsPassed++;
      s.aircraft.score += CONFIG.SCORING.RING_PASS;
      audio?.ring();
      const next = this.world.rings.find(item => !item.passed);
      if (next) next.active = true;
      else this.completeMission();
    }
  }

  checkLanding(audio) {
    const s = this.state, a = s.aircraft;
    if (s.mission !== 2) return;
    const rw = this.world.runway;
    const p = this.world.getRunwayPosition(a.x, a.z);
    const inRunway = Math.abs(p.along) < rw.length / 2 && Math.abs(p.across) < rw.width * 0.55;
    if (a.y <= CONFIG.WORLD.SEA_LEVEL + 5 && inRunway && a.airspeed < 52 && a.gearDown) {
      if (a.vy < -8 || Math.abs(p.across) > rw.width * 0.45) {
        a.damage = Math.min(1, a.damage + 0.25); audio?.touchdown(true); this.crash('Hard landing — gear, sink rate, or runway alignment'); return;
      }
      a.y = CONFIG.WORLD.SEA_LEVEL + 5; a.vy = 0; a.onGround = true;
      // Cut the throttle on touchdown: with it still up, the engine
      // keeps driving the aircraft past the runway end instead of
      // letting the rollout brake to a stop.
      a.throttle = 0;
      s.missionProgress.landingPhase = a.airspeed > 8 ? 'rollout' : 'stopped';
      if (!a.landed) { audio?.touchdown(false); a.landed = true; }
      if (a.airspeed <= 8) this.completeMission();
    }
  }

  checkTerrain() {
    const s = this.state, a = s.aircraft;
    const ground = this.world.getHeight(a.x, a.z);
    if (a.y <= ground + 1 && !this.world.onRunway(a.x, a.z)) {
      this.hooks.impact?.(a.x, ground, a.z);
      this.crash(this.world.isWater(a.x, a.z) ? 'Ditched in the sea' : 'Terrain impact');
      return;
    }
    if (a.y <= ground + 3 && this.world.onRunway(a.x, a.z) && s.mission === 2) {
      if (!a.gearDown || a.airspeed > 53 || Math.abs(a.vy) > 9) {
        this.crash('Unsafe runway touchdown');
      } else if (a.airspeed < 9) this.completeMission();
    }
  }

  updateCamera(dt) {
    const s = this.state, a = s.aircraft;
    const back = s.cockpitView ? 0 : CONFIG.CAMERA.CHASE_DIST;
    const height = s.cockpitView ? 3 : CONFIG.CAMERA.CHASE_HEIGHT;
    const targetX = a.x - Math.sin(a.heading) * back;
    const targetZ = a.z - Math.cos(a.heading) * back;
    const blend = 1 - Math.exp(-dt * 5);
    s.cameraX += (targetX - s.cameraX) * blend;
    s.cameraY += (a.y + height - s.cameraY) * blend;
    s.cameraZ += (targetZ - s.cameraZ) * blend;
    s.cameraHeading = a.heading;
    // Chase view looks almost level (0.03): a steeper downward pitch
    // pushes the aircraft to the bottom of the frame, half under the
    // instrument panel, instead of sitting visibly mid-frame.
    s.cameraPitch = s.cockpitView ? a.pitch : 0.03 + a.pitch * 0.3;
    s.cosH = Math.cos(s.cameraHeading); s.sinH = Math.sin(s.cameraHeading);
  }
}
