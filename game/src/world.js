// World generation: terrain, volcano, coastline, fields, village, river, runway, rings, drop zones
import { CONFIG } from './config.js';
import { createNoise } from './random.js';

export class World {
  constructor(seed = 1) {
    this.seed = seed;
    this.noise = createNoise(seed);
    this.rng = new (class {
      constructor(s) { this.state = s >>> 0; }
      next() { this.state = (this.state + 0x6D2B79F5) >>> 0; let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
      float(min, max) { return min + this.next() * (max - min); }
      int(min, max) { return min + Math.floor(this.next() * (max - min + 1)); }
    })(seed);

    this.generate();
  }

  generate() {
    const { WORLD, RINGS, DROP_ZONES } = CONFIG;

    // Volcano center
    this.volcano = {
      x: 0,
      z: 0,
      height: WORLD.VOLCANO_HEIGHT,
      radius: WORLD.VOLCANO_RADIUS,
    };

    // Runway
    this.runway = {
      x: WORLD.RUNWAY_X,
      z: WORLD.RUNWAY_Z,
      length: WORLD.RUNWAY_LENGTH,
      width: WORLD.RUNWAY_WIDTH,
      heading: WORLD.RUNWAY_HEADING,
      threshold: 50, // threshold marking distance from ends
    };

    // Rings (convert to world coordinates)
    this.rings = RINGS.map((r, i) => ({
      ...r,
      id: i,
      passed: false,
      active: false,
    }));

    // Drop zones
    this.dropZones = DROP_ZONES.map((dz, i) => ({
      ...dz,
      id: i,
      delivered: false,
      active: false,
    }));

    // Height queries used while placing buildings need the river valley already available.
    this.river = this.generateRiver();

    // Village buildings
    this.village = this.generateVillage();

    // Field patches
    this.fields = this.generateFields();

    // Coastline
    this.coastline = this.generateCoastline();

    // Windsock position
    this.windsock = {
      x: this.runway.x + Math.sin(this.runway.heading) * (this.runway.length / 2 - 60),
      z: this.runway.z + Math.cos(this.runway.heading) * (this.runway.length / 2 - 60),
    };

    // Hangar
    this.hangar = {
      x: this.runway.x + Math.sin(this.runway.heading + Math.PI/2) * 80,
      z: this.runway.z + Math.cos(this.runway.heading + Math.PI/2) * 80,
      width: 60,
      depth: 40,
      heading: this.runway.heading,
    };

    // Smoke particles from volcano
    this.volcanoSmoke = [];
    for (let i = 0; i < 30; i++) {
      this.volcanoSmoke.push({
        x: this.rng.float(-80, 80),
        z: this.rng.float(-80, 80),
        y: this.rng.float(550, 620),
        vx: this.rng.float(-0.3, 0.3),
        vy: this.rng.float(0.5, 1.5),
        vz: this.rng.float(-0.3, 0.3),
        size: this.rng.float(8, 20),
        life: this.rng.float(0, 1),
      });
    }
  }

  generateVillage() {
    const buildings = [];
    const centerX = -300;
    const centerZ = 400;
    const count = 12;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + this.rng.float(-0.2, 0.2);
      const dist = this.rng.float(40, 120);
      const x = centerX + Math.sin(angle) * dist;
      const z = centerZ + Math.cos(angle) * dist;
      const h = this.getHeight(x, z);
      const w = this.rng.float(12, 20);
      const d = this.rng.float(12, 20);
      const heading = this.rng.float(0, Math.PI * 2);
      buildings.push({ x, z, y: h, w, d, heading, roofH: this.rng.float(3, 6) });
    }
    return buildings;
  }

  generateFields() {
    const fields = [];
    const patches = 15;
    for (let i = 0; i < patches; i++) {
      const x = this.rng.float(-1200, 1200);
      const z = this.rng.float(-1200, 1200);
      // Avoid volcano and village
      if (x*x + z*z < 900*900) continue;
      if ((x+300)*(x+300) + (z-400)*(z-400) < 200*200) continue;
      const w = this.rng.float(80, 160);
      const d = this.rng.float(80, 160);
      const heading = this.rng.float(0, Math.PI * 2);
      const type = this.rng.int(0, 2);
      fields.push({ x, z, w, d, heading, type });
    }
    return fields;
  }

  generateRiver() {
    const points = [];
    // River flows from volcano area to sea
    let x = this.rng.float(-100, 100);
    let z = this.rng.float(200, 400);
    for (let i = 0; i < 25; i++) {
      points.push({ x, z, width: this.rng.float(15, 30) });
      x += this.rng.float(-40, 40);
      z += this.rng.float(-60, -20); // generally toward sea (negative z)
      if (z < -1800) break;
    }
    return points;
  }

  generateCoastline() {
    // Simple coastline: z = -1800 with some noise
    const points = [];
    for (let x = -2000; x <= 2000; x += 40) {
      const z = -1800 + this.noise.value2D(x * 0.005, 0) * 100;
      points.push({ x, z });
    }
    return points;
  }

  // Get terrain height at world position
  getHeight(x, z) {
    const { WORLD } = CONFIG;
    const VOLCANO_HEIGHT = WORLD.VOLCANO_HEIGHT;
    const VOLCANO_RADIUS = WORLD.VOLCANO_RADIUS;

    // Distance from volcano center
    const dx = x - this.volcano.x;
    const dz = z - this.volcano.z;
    const distVolcano = Math.sqrt(dx*dx + dz*dz);

    // Volcano cone
    let h = 0;
    if (distVolcano < VOLCANO_RADIUS) {
      const t = distVolcano / VOLCANO_RADIUS;
      h = VOLCANO_HEIGHT * (1 - t * t) * (1 - t * 0.3);
      // Add noise for rough volcanic terrain
      h += this.noise.fbm(x * 0.01, z * 0.01, 3, 0.5, 1) * 30 * (1 - t);
    }

    // Base terrain noise
    const baseNoise = this.noise.fbm(x * 0.002, z * 0.002, 4, 0.5, 1) * 60;
    h += baseNoise;

    // River valley
    for (const rp of this.river ?? []) {
      const drx = x - rp.x;
      const drz = z - rp.z;
      const dr = Math.sqrt(drx*drx + drz*drz);
      if (dr < rp.width * 3) {
        const valleyDepth = (1 - dr / (rp.width * 3)) * 15;
        h -= valleyDepth;
      }
    }

    // Coastline transition
    if (z < -1700) {
      const tide = Math.max(0, (-1700 - z) / 100);
      h = h * (1 - tide) + WORLD.SEA_LEVEL * tide - 2;
    }

    // Runway flat area
    const rdx = x - this.runway.x;
    const rdz = z - this.runway.z;
    const along = rdx * Math.sin(this.runway.heading) + rdz * Math.cos(this.runway.heading);
    const across = rdx * Math.cos(this.runway.heading) - rdz * Math.sin(this.runway.heading);
    if (Math.abs(along) < this.runway.length / 2 + 50 && Math.abs(across) < this.runway.width / 2 + 30) {
      h = WORLD.SEA_LEVEL + 2; // slightly above sea
    }

    // Takeoff corridor: a flat valley straight ahead of the runway (heading 0,
    // +z) for 2.5 km past its far end, so a straight climb-out never meets a
    // hill before the pilot has had room to climb. Without it the ground
    // rises to ~28 m just past the runway while a level-flight climb-out is
    // still only a few metres up, and the flight ends in the first ridge.
    if (along > -this.runway.length / 2 - 50 && along < 2900 && Math.abs(across) < this.runway.width / 2 + 60) {
      h = WORLD.SEA_LEVEL + 2;
    }

    // Hangar flat area
    if (this.hangar) {
      const hdx = x - this.hangar.x;
      const hdz = z - this.hangar.z;
      const halong = hdx * Math.sin(this.hangar.heading) + hdz * Math.cos(this.hangar.heading);
      const hacross = hdx * Math.cos(this.hangar.heading) - hdz * Math.sin(this.hangar.heading);
      if (Math.abs(halong) < this.hangar.depth / 2 + 10 && Math.abs(hacross) < this.hangar.width / 2 + 10) {
        h = WORLD.SEA_LEVEL + 2;
      }
    }

    // Village flat spots
    for (const b of this.village ?? []) {
      const vbx = x - b.x;
      const vbz = z - b.z;
      if (Math.abs(vbx) < b.w/2 + 3 && Math.abs(vbz) < b.d/2 + 3) {
        h = b.y;
      }
    }

    return Math.max(WORLD.SEA_LEVEL - 5, h);
  }

  // Check if position is water
  isWater(x, z) {
    return this.getHeight(x, z) <= CONFIG.WORLD.SEA_LEVEL + 0.5;
  }

  // Check if on runway
  onRunway(x, z) {
    const rdx = x - this.runway.x;
    const rdz = z - this.runway.z;
    const along = rdx * Math.sin(this.runway.heading) + rdz * Math.cos(this.runway.heading);
    const across = rdx * Math.cos(this.runway.heading) - rdz * Math.sin(this.runway.heading);
    return Math.abs(along) < this.runway.length / 2 && Math.abs(across) < this.runway.width / 2;
  }

  // Get runway position relative to thresholds
  getRunwayPosition(x, z) {
    const rdx = x - this.runway.x;
    const rdz = z - this.runway.z;
    const along = rdx * Math.sin(this.runway.heading) + rdz * Math.cos(this.runway.heading);
    const across = rdx * Math.cos(this.runway.heading) - rdz * Math.sin(this.runway.heading);
    // Normalize: -1 at threshold start, 0 at center, 1 at far threshold
    const norm = along / (this.runway.length / 2);
    return { along, across, norm };
  }

  // Update volcano smoke
  updateSmoke(dt) {
    for (const s of this.volcanoSmoke) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      s.life += dt * 0.3;
      if (s.life > 1 || s.y > 700) {
        s.x = this.rng.float(-80, 80);
        s.z = this.rng.float(-80, 80);
        s.y = this.rng.float(550, 620);
        s.vx = this.rng.float(-0.3, 0.3);
        s.vy = this.rng.float(0.5, 1.5);
        s.vz = this.rng.float(-0.3, 0.3);
        s.size = this.rng.float(8, 20);
        s.life = 0;
      }
    }
  }

  // Reset mission-specific state
  resetMission(missionId) {
    for (const r of this.rings) {
      r.passed = false;
      r.active = missionId === 0;
    }
    for (const dz of this.dropZones) {
      dz.delivered = false;
      dz.active = missionId === 1;
    }
  }
}
