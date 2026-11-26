// Seeded RNG (mulberry32) and helpers
export class SeededRNG {
  constructor(seed = 1) {
    this.seed = seed >>> 0;
    this.state = this.seed;
  }

  // Mulberry32 algorithm
  next() {
    this.state = (this.state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Reset to seed
  reset() {
    this.state = this.seed;
  }

  // Random integer [min, max]
  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  // Random float [min, max)
  float(min, max) {
    return min + this.next() * (max - min);
  }

  // Random element from array
  choice(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }

  // Random boolean with probability
  chance(p) {
    return this.next() < p;
  }

  // Gaussian-ish (Box-Muller)
  gaussian(mean = 0, std = 1) {
    const u1 = this.next();
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * std;
  }

  // Shuffle array in place (Fisher-Yates)
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

// Deterministic noise functions for terrain
export class Noise {
  constructor(rng) {
    this.rng = rng;
    this.perm = new Array(512);
    this.grad3 = new Array(512);
    this.init();
  }

  init() {
    // Build permutation table
    const p = new Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    this.rng.shuffle(p);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }
    // Gradient vectors for 3D simplex
    const grads = [
      [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
      [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
      [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1],
    ];
    for (let i = 0; i < 512; i++) {
      this.grad3[i] = grads[this.perm[i] % 12];
    }
  }

  // Simple 2D value noise
  value2D(x, z, scale = 1) {
    x *= scale;
    z *= scale;
    const xi = Math.floor(x);
    const zi = Math.floor(z);
    const xf = x - xi;
    const zf = z - zi;
    const u = xf * xf * (3 - 2 * xf);
    const v = zf * zf * (3 - 2 * zf);

    const a = this.hash(xi, zi);
    const b = this.hash(xi + 1, zi);
    const c = this.hash(xi, zi + 1);
    const d = this.hash(xi + 1, zi + 1);

    const x1 = this.lerp(a, b, u);
    const x2 = this.lerp(c, d, u);
    return this.lerp(x1, x2, v);
  }

  // Fractal Brownian Motion
  fbm(x, z, octaves = 4, persistence = 0.5, scale = 1) {
    let value = 0;
    let amplitude = 1;
    let frequency = scale;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
      value += this.value2D(x, z, frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }
    return value / maxValue;
  }

  // Ridged noise for sharp features
  ridged(x, z, octaves = 4, scale = 1) {
    let value = 0;
    let amplitude = 1;
    let frequency = scale;
    for (let i = 0; i < octaves; i++) {
      const n = Math.abs(this.value2D(x, z, frequency) * 2 - 1);
      value += (1 - n) * amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    return value;
  }

  hash(x, z) {
    const h = this.perm[(x + this.perm[z & 255]) & 511];
    return (h / 255) * 2 - 1;
  }

  lerp(a, b, t) {
    return a + (b - a) * t;
  }
}

// Create deterministic RNG from seed
export function createRNG(seed = 1) {
  return new SeededRNG(seed);
}

export function createNoise(seed = 1) {
  return new Noise(new SeededRNG(seed));
}