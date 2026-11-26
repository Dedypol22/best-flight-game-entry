// Pseudo-3D renderer: sky/sun/clouds, terrain strips, runway, rings, aircraft sprite, cockpit panel, particles
import { CONFIG } from './config.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = CONFIG.CANVAS_WIDTH;
    this.height = CONFIG.CANVAS_HEIGHT;
    this.halfW = this.width / 2;
    this.halfH = this.height / 2;

    // Pre-rendered assets
    this.sunGradient = null;
    this.clouds = [];
    this.generateClouds();
    this.horizonGradient = null;
    this.createGradients();

    // Aircraft sprite cache
    this.aircraftSprite = null;
    this.aircraftSpriteCockpit = null;
    this.propAngle = 0;

    // Particle systems
    this.particles = [];
    this.exhaustParticles = [];
    this.splashParticles = [];
    this.randomState = 1;

    // Screen shake
    this.shakeX = 0;
    this.shakeY = 0;
    this.shakeTime = 0;
  }

  createGradients() {
    const { COLORS } = CONFIG;
    // Sky gradient
    this.skyGradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    this.skyGradient.addColorStop(0, COLORS.SKY_TOP);
    this.skyGradient.addColorStop(0.35, COLORS.SKY_MID);
    this.skyGradient.addColorStop(0.55, COLORS.SKY_HORIZON);
    this.skyGradient.addColorStop(1, '#18100c');

    // Sun glow
    this.sunGradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, 200);
    this.sunGradient.addColorStop(0, COLORS.SUN_COLOR);
    this.sunGradient.addColorStop(0.3, COLORS.SUN_GLOW + '80');
    this.sunGradient.addColorStop(1, 'transparent');

    // Horizon haze
    this.horizonGradient = this.ctx.createLinearGradient(0, this.halfH - 50, 0, this.halfH + 100);
    this.horizonGradient.addColorStop(0, 'transparent');
    this.horizonGradient.addColorStop(0.5, COLORS.SKY_HORIZON + '40');
    this.horizonGradient.addColorStop(1, COLORS.SKY_HORIZON + '10');
  }

  generateClouds() {
    // Deterministic cloud layers
    for (let layer = 0; layer < 3; layer++) {
      const count = 8 - layer * 2;
      const yBase = 60 + layer * 80;
      const speed = 0.5 + layer * 0.3;
      for (let i = 0; i < count; i++) {
        const seed = layer * 100 + i * 17;
        // Simple deterministic pseudo-random
        let s = seed;
        const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
        this.clouds.push({
          x: rand() * this.width * 2 - this.width,
          y: yBase + rand() * 60,
          scale: 0.6 + rand() * 0.8,
          speed: speed * (0.8 + rand() * 0.4),
          opacity: 0.3 + rand() * 0.3,
          parts: Array.from({length: 5 + Math.floor(rand() * 4)}, () => ({
            dx: (rand() - 0.5) * 80,
            dy: (rand() - 0.5) * 30,
            r: 20 + rand() * 40,
          })),
        });
      }
    }
  }

  random() {
    let x = this.randomState >>> 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.randomState = x >>> 0;
    return this.randomState / 4294967296;
  }

  setSeed(seed) {
    this.randomState = (seed >>> 0) || 1;
  }

  // Main render entry
  render(state, world, input, cockpitView) {
    const { ctx, width, height, halfW, halfH } = this;
    ctx.save();
    this.setSeed((state.seed || 1) + Math.floor((state.time || 0) * 60));

    // Screen shake
    if (this.shakeTime > 0) {
      ctx.translate(this.shakeX, this.shakeY);
      this.shakeTime -= 1/60;
    }

    // Clear
    ctx.fillStyle = '#0a0806';
    ctx.fillRect(0, 0, width, height);

    // Sky
    this.drawSky(state);

    // Clouds
    this.drawClouds(state);

    // Sun
    this.drawSun(state);

    // Terrain (back to front)
    this.drawTerrain(state, world);

    // Volcano smoke
    this.drawVolcanoSmoke(state, world);

    // River
    this.drawRiver(state, world);

    // Fields
    this.drawFields(state, world);

    // Village
    this.drawVillage(state, world);

    // Runway
    this.drawRunway(state, world);

    // Hangar
    this.drawHangar(state, world);

    // Windsock
    this.drawWindsock(state, world);

    // Rings
    this.drawRings(state, world);

    // Drop zones
    this.drawDropZones(state, world);

    // Aircraft (chase view only)
    if (!cockpitView) {
      this.drawAircraftChase(state);
    }

    // Particles
    this.drawParticles(state);

    // Exhaust
    this.drawExhaust(state);

    // Splash
    this.drawSplash(state);

    ctx.restore();

    // Cockpit instruments stay visible in either camera so flight data remains readable.
    this.drawCockpitPanel({ ...state, cockpitView: true });

    // HUD (always on top)
    this.drawHUD(state);
  }

  drawSky(state) {
    const { ctx, skyGradient, horizonGradient, halfH } = this;
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, this.width, this.height);
    // Horizon haze
    ctx.fillStyle = horizonGradient;
    ctx.fillRect(0, halfH - 50, this.width, 150);
  }

  drawSun(state) {
    const { ctx } = this;
    const { COLORS } = CONFIG;
    const { sunAngle = 0.3 } = state; // Late afternoon sun
    const sunX = this.halfW + Math.cos(sunAngle) * 400;
    const sunY = this.halfH - Math.sin(sunAngle) * 300 - 100;

    ctx.save();
    ctx.translate(sunX, sunY);
    ctx.fillStyle = this.sunGradient;
    ctx.beginPath();
    ctx.arc(0, 0, 180, 0, Math.PI * 2);
    ctx.fill();

    // Sun disk
    const diskGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 60);
    diskGrad.addColorStop(0, COLORS.SUN_COLOR);
    diskGrad.addColorStop(0.5, COLORS.SUN_GLOW);
    diskGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = diskGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawClouds(state) {
    const { ctx, clouds } = this;
    const { COLORS } = CONFIG;
    const time = state.time || 0;

    for (const cloud of clouds) {
      const x = (cloud.x + time * cloud.speed * 10) % (this.width * 2) - this.width;
      const y = cloud.y - state.cameraY * 0.02; // Parallax

      ctx.save();
      ctx.globalAlpha = cloud.opacity;
      ctx.translate(x, y);
      ctx.scale(cloud.scale, cloud.scale);

      for (const part of cloud.parts) {
        const grad = ctx.createRadialGradient(part.dx, part.dy, 0, part.dx, part.dy, part.r);
        grad.addColorStop(0, COLORS.CLOUD_COLOR);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(part.dx, part.dy, part.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // Project world (x,y,z) to screen (sx, sy, scale)
  project(state, x, y, z) {
    const { cameraX, cameraY, cameraZ, cameraPitch, cameraHeading, cosH, sinH } = state;
    const { halfW, halfH, height } = this;

    // Translate to camera space
    let tx = x - cameraX;
    let ty = y - cameraY;
    let tz = z - cameraZ;

    // Rotate by heading (yaw)
    const rx = tx * cosH + tz * sinH;
    const rz = -tx * sinH + tz * cosH;

    // Rotate by pitch
    const py = ty * Math.cos(cameraPitch) - rz * Math.sin(cameraPitch);
    const pz = ty * Math.sin(cameraPitch) + rz * Math.cos(cameraPitch);

    if (pz <= 1) return null; // Behind or at camera

    // Perspective projection
    const fov = 1.0; // ~90 degrees
    const scale = halfW / (pz * Math.tan(fov));
    const sx = halfW + rx * scale;
    const sy = halfH - py * scale;

    return { sx, sy, scale, pz, rx, py };
  }

  drawTerrain(state, world) {
    const { ctx } = this;
    const { COLORS, TERRAIN, WORLD } = CONFIG;
    const { cameraX, cameraZ, cameraY, cameraHeading } = state;
    const viewDist = TERRAIN.VIEW_DIST;
    const stripCount = TERRAIN.STRIP_COUNT;
    const stripSpacing = TERRAIN.STRIP_SPACING;

    // Draw terrain strips from far to near
    for (let i = stripCount; i >= 0; i--) {
      const dist = i * stripSpacing;
      if (dist > viewDist) continue;

      const stripY = cameraY + 1.5; // Eye height above ground
      const angle = cameraHeading;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // Strip corners in world space
      const halfWidth = dist * Math.tan(0.7); // Half FOV width at this distance
      const wx1 = cameraX + (-halfWidth * cosA - dist * sinA);
      const wz1 = cameraZ + (-halfWidth * sinA + dist * cosA);
      const wx2 = cameraX + (halfWidth * cosA - dist * sinA);
      const wz2 = cameraZ + (halfWidth * sinA + dist * cosA);

      // Sample heights along strip
      const samples = 8;
      const stripCoords = [];
      for (let s = 0; s <= samples; s++) {
        const t = s / samples;
        const sx = wx1 + (wx2 - wx1) * t;
        const sz = wz1 + (wz2 - wz1) * t;
        const hy = world.getHeight(sx, sz);
        const proj = this.project(state, sx, hy, sz);
        if (proj) {
          stripCoords.push({ x: proj.sx, y: proj.sy, height: hy, worldX: sx, worldZ: sz });
        }
      }

      if (stripCoords.length < 2) continue;

      // Draw strip as polygon
      ctx.beginPath();
      ctx.moveTo(stripCoords[0].x, stripCoords[0].y);
      for (let s = 1; s < stripCoords.length; s++) {
        ctx.lineTo(stripCoords[s].x, stripCoords[s].y);
      }
      // Close to bottom of screen
      ctx.lineTo(stripCoords[stripCoords.length - 1].x, this.height);
      ctx.lineTo(stripCoords[0].x, this.height);
      ctx.closePath();

      // Color based on height and biome
      const mid = stripCoords[Math.floor(stripCoords.length / 2)];
      const h = mid.height;
      let color;
      if (h <= WORLD.SEA_LEVEL + 1) {
        // Water
        const deep = h < WORLD.SEA_LEVEL - 2;
        color = deep ? COLORS.SEA_DEEP : COLORS.SEA_SHALLOW;
        // Add subtle wave lines
        ctx.fillStyle = color;
        ctx.fill();
        if (!deep && i < 20) {
          ctx.strokeStyle = COLORS.SEA_FOAM + '20';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      } else if (h > 400) {
        // Volcano
        const t = Math.min(1, (h - 400) / 200);
        const r = Math.floor(40 + t * 20);
        const g = Math.floor(32 + t * 16);
        const b = Math.floor(24 + t * 8);
        color = `rgb(${r},${g},${b})`;
        ctx.fillStyle = color;
        ctx.fill();
        // Volcanic glow lines
        if (h > 500 && i % 3 === 0) {
          ctx.strokeStyle = COLORS.VOLCANO_GLOW + '30';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      } else if (h > 150) {
        // Hills
        color = COLORS.GRASS_DARK;
        ctx.fillStyle = color;
        ctx.fill();
      } else {
        // Lowland
        color = COLORS.GRASS_LIGHT;
        ctx.fillStyle = color;
        ctx.fill();
      }
    }
  }

  drawVolcanoSmoke(state, world) {
    const { ctx } = this;
    const { COLORS, WORLD } = CONFIG;
    for (const s of world.volcanoSmoke) {
      const proj = this.project(state, s.x, s.y, s.z);
      if (!proj || proj.pz > 3000) continue;
      const alpha = (1 - s.life) * 0.15 * (1 - proj.pz / 3000);
      if (alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.VOLCANO_SMOKE;
      ctx.beginPath();
      ctx.arc(proj.sx, proj.sy, s.size * proj.scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawRiver(state, world) {
    const { ctx } = this;
    const { COLORS, WORLD } = CONFIG;
    for (let i = 0; i < world.river.length - 1; i++) {
      const p1 = world.river[i];
      const p2 = world.river[i + 1];
      const proj1 = this.project(state, p1.x, WORLD.SEA_LEVEL + 1, p1.z);
      const proj2 = this.project(state, p2.x, WORLD.SEA_LEVEL + 1, p2.z);
      if (!proj1 || !proj2) continue;
      if (proj1.pz > 2000 && proj2.pz > 2000) continue;

      const width1 = p1.width * proj1.scale;
      const width2 = p2.width * proj2.scale;

      ctx.beginPath();
      ctx.moveTo(proj1.sx - width1/2, proj1.sy);
      ctx.lineTo(proj2.sx - width2/2, proj2.sy);
      ctx.lineTo(proj2.sx + width2/2, proj2.sy);
      ctx.lineTo(proj1.sx + width1/2, proj1.sy);
      ctx.closePath();

      const grad = ctx.createLinearGradient(proj1.sx, proj1.sy, proj2.sx, proj2.sy);
      grad.addColorStop(0, COLORS.RIVER_WATER);
      grad.addColorStop(1, COLORS.RIVER_WATER + '80');
      ctx.fillStyle = grad;
      ctx.fill();

      // Banks
      ctx.strokeStyle = COLORS.RIVER_BANK;
      ctx.lineWidth = Math.max(1, 2 * proj1.scale);
      ctx.beginPath();
      ctx.moveTo(proj1.sx - width1/2, proj1.sy);
      ctx.lineTo(proj2.sx - width2/2, proj2.sy);
      ctx.moveTo(proj1.sx + width1/2, proj1.sy);
      ctx.lineTo(proj2.sx + width2/2, proj2.sy);
      ctx.stroke();
    }
  }

  drawFields(state, world) {
    const { ctx } = this;
    const { COLORS } = CONFIG;
    const fieldColors = [COLORS.FIELD_1, COLORS.FIELD_2, COLORS.FIELD_3];

    for (const f of world.fields) {
      // Check distance
      const dx = f.x - state.cameraX;
      const dz = f.z - state.cameraZ;
      const dist = Math.sqrt(dx*dx + dz*dz);
      if (dist > 2000) continue;

      const corners = [
        { x: -f.w/2, z: -f.d/2 },
        { x: f.w/2, z: -f.d/2 },
        { x: f.w/2, z: f.d/2 },
        { x: -f.w/2, z: f.d/2 },
      ];

      const projected = [];
      for (const c of corners) {
        const wx = f.x + c.x * Math.cos(f.heading) - c.z * Math.sin(f.heading);
        const wz = f.z + c.x * Math.sin(f.heading) + c.z * Math.cos(f.heading);
        const hy = world.getHeight(wx, wz);
        const proj = this.project(state, wx, hy + 0.5, wz);
        if (proj) projected.push(proj);
      }

      if (projected.length < 4) continue;

      ctx.beginPath();
      ctx.moveTo(projected[0].sx, projected[0].sy);
      for (let i = 1; i < projected.length; i++) {
        ctx.lineTo(projected[i].sx, projected[i].sy);
      }
      ctx.closePath();

      ctx.fillStyle = fieldColors[f.type];
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Field rows
      ctx.strokeStyle = fieldColors[f.type] + '60';
      ctx.lineWidth = Math.max(0.5, 1 * projected[0].scale);
      for (let r = 1; r < 5; r++) {
        const t = r / 5;
        const sx1 = projected[0].sx + (projected[3].sx - projected[0].sx) * t;
        const sy1 = projected[0].sy + (projected[3].sy - projected[0].sy) * t;
        const sx2 = projected[1].sx + (projected[2].sx - projected[1].sx) * t;
        const sy2 = projected[1].sy + (projected[2].sy - projected[1].sy) * t;
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.stroke();
      }
    }
  }

  drawVillage(state, world) {
    const { ctx } = this;
    const { COLORS } = CONFIG;

    for (const b of world.village) {
      const dx = b.x - state.cameraX;
      const dz = b.z - state.cameraZ;
      const dist = Math.sqrt(dx*dx + dz*dz);
      if (dist > 1500) continue;

      // Building base
      const corners = [
        { x: -b.w/2, z: -b.d/2 },
        { x: b.w/2, z: -b.d/2 },
        { x: b.w/2, z: b.d/2 },
        { x: -b.w/2, z: b.d/2 },
      ];

      const walls = [];
      for (const c of corners) {
        const wx = b.x + c.x * Math.cos(b.heading) - c.z * Math.sin(b.heading);
        const wz = b.z + c.x * Math.sin(b.heading) + c.z * Math.cos(b.heading);
        const proj = this.project(state, wx, b.y, wz);
        if (proj) walls.push({ ...proj, wx, wz });
      }

      if (walls.length < 3) continue;

      // Draw walls (extruded)
      for (let i = 0; i < walls.length; i++) {
        const w1 = walls[i];
        const w2 = walls[(i + 1) % walls.length];
        const roofY1 = this.project(state, w1.wx, b.y + b.roofH, w1.wz);
        const roofY2 = this.project(state, w2.wx, b.y + b.roofH, w2.wz);
        if (!roofY1 || !roofY2) continue;

        ctx.beginPath();
        ctx.moveTo(w1.sx, w1.sy);
        ctx.lineTo(w2.sx, w2.sy);
        ctx.lineTo(roofY2.sx, roofY2.sy);
        ctx.lineTo(roofY1.sx, roofY1.sy);
        ctx.closePath();

        // Wall shading based on facing
        const facing = (w2.wx - w1.wx) * Math.sin(b.heading) - (w2.wz - w1.wz) * Math.cos(b.heading);
        const light = facing > 0 ? 0.9 : 0.6;
        ctx.fillStyle = `rgb(${Math.floor(200*light)},${Math.floor(168*light)},${Math.floor(136*light)})`;
        ctx.fill();

        // Roof
        if (i === 0) {
          ctx.beginPath();
          ctx.moveTo(w1.sx, w1.sy);
          ctx.lineTo(w2.sx, w2.sy);
          ctx.lineTo(roofY2.sx, roofY2.sy);
          ctx.lineTo(roofY1.sx, roofY1.sy);
          ctx.closePath();
          ctx.fillStyle = COLORS.VILLAGE_ROOF;
          ctx.fill();
        }
      }
    }
  }

  drawRunway(state, world) {
    const { ctx } = this;
    const { COLORS, WORLD } = CONFIG;
    const rw = world.runway;
    const halfLen = rw.length / 2;
    const halfWid = rw.width / 2;

    const corners = [
      { x: -halfWid, z: -halfLen },
      { x: halfWid, z: -halfLen },
      { x: halfWid, z: halfLen },
      { x: -halfWid, z: halfLen },
    ];

    const projected = [];
    for (const c of corners) {
      const wx = rw.x + c.x * Math.sin(rw.heading) + c.z * Math.cos(rw.heading);
      const wz = rw.z + c.x * Math.cos(rw.heading) - c.z * Math.sin(rw.heading);
      const proj = this.project(state, wx, WORLD.SEA_LEVEL + 2.1, wz);
      if (proj) projected.push(proj);
    }

    if (projected.length < 3) return;

    // Runway surface
    ctx.beginPath();
    ctx.moveTo(projected[0].sx, projected[0].sy);
    for (let i = 1; i < projected.length; i++) ctx.lineTo(projected[i].sx, projected[i].sy);
    ctx.closePath();
    ctx.fillStyle = COLORS.RUNWAY_SURFACE;
    ctx.fill();

    // Threshold markings
    for (let end = 0; end < 2; end++) {
      const threshold = rw.threshold;
      const zPos = end === 0 ? -halfLen : halfLen;
      for (let t = 0; t < threshold; t += 4) {
        const mz = zPos + (end === 0 ? t : -t);
        const mx1 = -halfWid;
        const mx2 = halfWid;
        const p1 = this.project(state,
          rw.x + mx1 * Math.sin(rw.heading) + mz * Math.cos(rw.heading),
          WORLD.SEA_LEVEL + 2.2,
          rw.z + mx1 * Math.cos(rw.heading) - mz * Math.sin(rw.heading)
        );
        const p2 = this.project(state,
          rw.x + mx2 * Math.sin(rw.heading) + mz * Math.cos(rw.heading),
          WORLD.SEA_LEVEL + 2.2,
          rw.z + mx2 * Math.cos(rw.heading) - mz * Math.sin(rw.heading)
        );
        if (p1 && p2) {
          ctx.strokeStyle = COLORS.RUNWAY_MARKING;
          ctx.lineWidth = Math.max(1, 3 * p1.scale);
          ctx.beginPath();
          ctx.moveTo(p1.sx, p1.sy);
          ctx.lineTo(p2.sx, p2.sy);
          ctx.stroke();
        }
      }
    }

    // Centerline
    ctx.strokeStyle = COLORS.RUNWAY_MARKING + '80';
    ctx.lineWidth = Math.max(1, 2 * projected[0].scale);
    ctx.setLineDash([20 * projected[0].scale, 15 * projected[0].scale]);
    ctx.beginPath();
    ctx.moveTo(projected[0].sx, projected[0].sy);
    ctx.lineTo(projected[2].sx, projected[2].sy);
    ctx.stroke();
    ctx.setLineDash([]);

    // Runway numbers (simplified)
    const projNum = this.project(state, rw.x, WORLD.SEA_LEVEL + 2.3, rw.z - halfLen + 60);
    if (projNum) {
      ctx.fillStyle = COLORS.RUNWAY_MARKING;
      ctx.font = `bold ${Math.max(12, 24 * projNum.scale)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('09', projNum.sx, projNum.sy);
    }
  }

  drawHangar(state, world) {
    const { ctx } = this;
    const { COLORS, WORLD } = CONFIG;
    const h = world.hangar;
    const hw = h.width / 2;
    const hd = h.depth / 2;

    const corners = [
      { x: -hw, z: -hd },
      { x: hw, z: -hd },
      { x: hw, z: hd },
      { x: -hw, z: hd },
    ];

    const walls = [];
    for (const c of corners) {
      const wx = h.x + c.x * Math.sin(h.heading) + c.z * Math.cos(h.heading);
      const wz = h.z + c.x * Math.cos(h.heading) - c.z * Math.sin(h.heading);
      const proj = this.project(state, wx, WORLD.SEA_LEVEL + 2, wz);
      if (proj) walls.push({ ...proj, wx, wz });
    }

    if (walls.length < 3) return;

    // Walls
    for (let i = 0; i < walls.length; i++) {
      const w1 = walls[i];
      const w2 = walls[(i + 1) % walls.length];
      const roof1 = this.project(state, w1.wx, WORLD.SEA_LEVEL + 10, w1.wz);
      const roof2 = this.project(state, w2.wx, WORLD.SEA_LEVEL + 10, w2.wz);
      if (!roof1 || !roof2) continue;

      ctx.beginPath();
      ctx.moveTo(w1.sx, w1.sy);
      ctx.lineTo(w2.sx, w2.sy);
      ctx.lineTo(roof2.sx, roof2.sy);
      ctx.lineTo(roof1.sx, roof1.sy);
      ctx.closePath();

      const facing = (w2.wx - w1.wx) * Math.sin(h.heading) - (w2.wz - w1.wz) * Math.cos(h.heading);
      const light = facing > 0 ? 0.8 : 0.5;
      ctx.fillStyle = `rgb(${Math.floor(80*light)},${Math.floor(72*light)},${Math.floor(64*light)})`;
      ctx.fill();
    }

    // Roof
    ctx.beginPath();
    ctx.moveTo(walls[0].sx, walls[0].sy);
    for (let i = 1; i < walls.length; i++) ctx.lineTo(walls[i].sx, walls[i].sy);
    ctx.closePath();
    const roofTop = this.project(state, h.x, WORLD.SEA_LEVEL + 10, h.z);
    if (roofTop) {
      ctx.fillStyle = COLORS.HANGAR_ROOF;
      ctx.fill();
    }
  }

  drawWindsock(state, world) {
    const { ctx } = this;
    const { COLORS, WORLD } = CONFIG;
    const ws = world.windsock;
    const proj = this.project(state, ws.x, WORLD.SEA_LEVEL + 6, ws.z);
    if (!proj || proj.pz > 1500) return;

    const poleH = 6 * proj.scale;
    ctx.strokeStyle = COLORS.WINDSOCK_POLE;
    ctx.lineWidth = Math.max(1, 2 * proj.scale);
    ctx.beginPath();
    ctx.moveTo(proj.sx, proj.sy);
    ctx.lineTo(proj.sx, proj.sy + poleH);
    ctx.stroke();

    // Sock (animated by wind)
    const windAngle = state.windAngle || 0;
    const sockLen = 4 * proj.scale;
    const sockW = 1.5 * proj.scale;
    const sx = proj.sx + Math.sin(windAngle) * sockLen;
    const sy = proj.sy - Math.cos(windAngle) * sockLen;

    ctx.fillStyle = COLORS.WINDSOCK_FABRIC;
    ctx.beginPath();
    ctx.moveTo(proj.sx, proj.sy);
    ctx.lineTo(sx - sockW, sy);
    ctx.lineTo(sx + sockW, sy);
    ctx.closePath();
    ctx.fill();
  }

  drawRings(state, world) {
    const { ctx } = this;
    const { COLORS } = CONFIG;
    const time = state.time || 0;

    for (const ring of world.rings) {
      if (!ring.active || ring.passed) continue;
      const proj = this.project(state, ring.x, ring.height, ring.z);
      if (!proj || proj.pz > 2500) continue;

      const r = ring.radius * proj.scale;
      if (r < 2) continue;

      // Pulsing glow
      const pulse = 1 + Math.sin(time * 4) * 0.15;
      const glowR = r * pulse * 1.4;

      // Glow
      const glow = ctx.createRadialGradient(proj.sx, proj.sy, 0, proj.sx, proj.sy, glowR);
      glow.addColorStop(0, COLORS.RING_GLOW + '40');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(proj.sx, proj.sy, glowR, 0, Math.PI * 2);
      ctx.fill();

      // Ring torus (two circles)
      ctx.strokeStyle = COLORS.RING_COLOR;
      ctx.lineWidth = Math.max(2, 4 * proj.scale);
      ctx.beginPath();
      ctx.arc(proj.sx, proj.sy, r, 0, Math.PI * 2);
      ctx.stroke();

      // Inner ring
      ctx.strokeStyle = COLORS.RING_GLOW;
      ctx.lineWidth = Math.max(1, 2 * proj.scale);
      ctx.beginPath();
      ctx.arc(proj.sx, proj.sy, r * 0.7, 0, Math.PI * 2);
      ctx.stroke();

      // Number
      ctx.fillStyle = COLORS.RING_GLOW;
      ctx.font = `bold ${Math.max(10, 16 * proj.scale)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${ring.id + 1}`, proj.sx, proj.sy);
    }
  }

  drawDropZones(state, world) {
    const { ctx } = this;
    const { COLORS } = CONFIG;

    for (const dz of world.dropZones) {
      if (!dz.active || dz.delivered) continue;
      const proj = this.project(state, dz.x, world.getHeight(dz.x, dz.z) + 1, dz.z);
      if (!proj || proj.pz > 2000) continue;

      const r = dz.radius * proj.scale;
      if (r < 3) continue;

      // Pulsing circle
      const pulse = 1 + Math.sin(state.time * 3) * 0.2;
      ctx.strokeStyle = COLORS.DROP_ZONE;
      ctx.lineWidth = Math.max(2, 3 * proj.scale);
      ctx.setLineDash([10 * proj.scale, 5 * proj.scale]);
      ctx.beginPath();
      ctx.arc(proj.sx, proj.sy, r * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Crosshair
      ctx.strokeStyle = COLORS.DROP_ZONE + '80';
      ctx.lineWidth = Math.max(1, 2 * proj.scale);
      ctx.beginPath();
      ctx.moveTo(proj.sx - r, proj.sy);
      ctx.lineTo(proj.sx + r, proj.sy);
      ctx.moveTo(proj.sx, proj.sy - r);
      ctx.lineTo(proj.sx, proj.sy + r);
      ctx.stroke();
    }
  }

  drawAircraftChase(state) {
    const { ctx } = this;
    const { COLORS } = CONFIG;
    const { aircraft } = state;
    if (!aircraft) return;

    const proj = this.project(state, aircraft.x, aircraft.y, aircraft.z);
    if (!proj) return;

    const scale = proj.scale * 3.5; // World-projected scale: roughly a 100 px wingspan in chase view.
    const heading = aircraft.heading;
    const pitch = aircraft.pitch;
    const bank = aircraft.bank;

    ctx.save();
    ctx.translate(proj.sx, proj.sy);
    // Rotate to heading (compensate for camera)
    ctx.rotate(-state.cameraHeading + heading);
    // Bank tilt
    ctx.rotate(bank * 0.5);
    // Pitch affects vertical squash
    ctx.scale(1, Math.max(0.3, 1 - Math.abs(pitch) * 0.5));

    this.drawAircraftShape(ctx, scale, aircraft, true);
    ctx.restore();
  }

  drawAircraftShape(ctx, scale, aircraft, chaseView) {
    const { COLORS } = CONFIG;
    const s = scale;
    const gearDown = aircraft.gearDown;
    const flaps = aircraft.flaps > 0.5;
    const propSpin = (aircraft.time || 0) * (aircraft.throttle * 48 + 18);

    // Fuselage
    ctx.fillStyle = COLORS.AIRCRAFT_BODY;
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.2); // Nose
    ctx.bezierCurveTo(-s * 0.4, -s * 0.8, -s * 0.5, s * 0.6, -s * 0.35, s * 1.0);
    ctx.lineTo(s * 0.35, s * 1.0);
    ctx.bezierCurveTo(s * 0.5, s * 0.6, s * 0.4, -s * 0.8, 0, -s * 1.2);
    ctx.fill();

    // Cockpit canopy
    ctx.fillStyle = '#203040';
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.0);
    ctx.lineTo(-s * 0.25, -s * 0.4);
    ctx.lineTo(s * 0.25, -s * 0.4);
    ctx.closePath();
    ctx.fill();

    // Wings
    ctx.fillStyle = COLORS.AIRCRAFT_WING;
    ctx.beginPath();
    ctx.moveTo(-s * 0.35, s * 0.1);
    ctx.lineTo(-s * 2.8, s * 0.2);
    ctx.lineTo(-s * 2.5, s * 0.5);
    ctx.lineTo(-s * 0.35, s * 0.4);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(s * 0.35, s * 0.1);
    ctx.lineTo(s * 2.8, s * 0.2);
    ctx.lineTo(s * 2.5, s * 0.5);
    ctx.lineTo(s * 0.35, s * 0.4);
    ctx.fill();

    // Flaps
    if (flaps) {
      ctx.fillStyle = COLORS.AIRCRAFT_WING;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(-s * 0.35, s * 0.4);
      ctx.lineTo(-s * 1.5, s * 0.7);
      ctx.lineTo(-s * 0.35, s * 0.55);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(s * 0.35, s * 0.4);
      ctx.lineTo(s * 1.5, s * 0.7);
      ctx.lineTo(s * 0.35, s * 0.55);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Tail fin
    ctx.fillStyle = COLORS.AIRCRAFT_TAIL;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.8);
    ctx.lineTo(-s * 0.5, s * 1.3);
    ctx.lineTo(s * 0.5, s * 1.3);
    ctx.fill();

    // Horizontal stabilizers
    ctx.beginPath();
    ctx.moveTo(-s * 0.8, s * 0.9);
    ctx.lineTo(-s * 1.3, s * 0.95);
    ctx.lineTo(-s * 1.1, s * 1.1);
    ctx.lineTo(-s * 0.6, s * 1.05);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(s * 0.8, s * 0.9);
    ctx.lineTo(s * 1.3, s * 0.95);
    ctx.lineTo(s * 1.1, s * 1.1);
    ctx.lineTo(s * 0.6, s * 1.05);
    ctx.fill();

    // Landing gear
    if (gearDown) {
      ctx.strokeStyle = COLORS.AIRCRAFT_GEAR;
      ctx.lineWidth = Math.max(1, s * 0.08);
      // Main gear
      ctx.beginPath();
      ctx.moveTo(-s * 0.6, s * 0.3);
      ctx.lineTo(-s * 0.6, s * 0.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s * 0.6, s * 0.3);
      ctx.lineTo(s * 0.6, s * 0.9);
      ctx.stroke();
      // Nose gear
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.2);
      ctx.lineTo(0, s * 0.3);
      ctx.stroke();
    }

    // Propeller (animated)
    this.propAngle = propSpin;
    const propAlpha = 0.3 + aircraft.throttle * 0.5;
    ctx.save();
    ctx.translate(0, -s * 1.3);
    ctx.rotate(this.propAngle);
    ctx.globalAlpha = propAlpha;
    ctx.fillStyle = COLORS.AIRCRAFT_PROP_BLUR;
    // Prop disk
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.1, s * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.1, s * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    // Navigation lights
    if (chaseView) {
      // Left (red)
      ctx.fillStyle = COLORS.AIRCRAFT_LIGHT_RED;
      ctx.globalAlpha = 0.5 + Math.sin(aircraft.time * 8) * 0.5;
      ctx.beginPath();
      ctx.arc(-s * 2.6, s * 0.25, Math.max(2, s * 0.15), 0, Math.PI * 2);
      ctx.fill();
      // Right (green)
      ctx.fillStyle = COLORS.AIRCRAFT_LIGHT_GREEN;
      ctx.globalAlpha = 0.5 + Math.sin(aircraft.time * 8 + Math.PI) * 0.5;
      ctx.beginPath();
      ctx.arc(s * 2.6, s * 0.25, Math.max(2, s * 0.15), 0, Math.PI * 2);
      ctx.fill();
      // Tail (white)
      ctx.fillStyle = COLORS.AIRCRAFT_LIGHT_WHITE;
      ctx.globalAlpha = 0.5 + Math.sin(aircraft.time * 6) * 0.5;
      ctx.beginPath();
      ctx.arc(0, s * 1.2, Math.max(2, s * 0.12), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  drawParticles(state) {
    const { ctx } = this;
    const { COLORS } = CONFIG;
    for (const p of this.particles) {
      const proj = this.project(state, p.x, p.y, p.z);
      if (!proj) continue;
      const alpha = p.life * 0.6;
      if (alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.PARTICLE_SMOKE;
      ctx.beginPath();
      ctx.arc(proj.sx, proj.sy, p.size * proj.scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawExhaust(state) {
    const { ctx } = this;
    const { COLORS } = CONFIG;
    const { aircraft } = state;
    if (!aircraft || aircraft.throttle < 0.1) return;

    // Exhaust position (behind engine)
    const exX = aircraft.x - Math.sin(aircraft.heading) * 2.5;
    const exY = aircraft.y - 0.3;
    const exZ = aircraft.z - Math.cos(aircraft.heading) * 2.5;
    if (Math.floor((state.time || 0) * 30) % 3 === 0) this.emitExhaust(exX, exY, exZ, aircraft.throttle);

    for (const p of this.exhaustParticles) {
      const proj = this.project(state, p.x, p.y, p.z);
      if (!proj) continue;
      const alpha = p.life * 0.8;
      if (alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      const grad = ctx.createRadialGradient(proj.sx, proj.sy, 0, proj.sx, proj.sy, p.size * proj.scale);
      grad.addColorStop(0, COLORS.PARTICLE_EXHAUST);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(proj.sx, proj.sy, p.size * proj.scale * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawSplash(state) {
    const { ctx } = this;
    const { COLORS } = CONFIG;
    for (const p of this.splashParticles) {
      const proj = this.project(state, p.x, p.y, p.z);
      if (!proj) continue;
      const alpha = p.life * 0.7;
      if (alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.PARTICLE_SPLASH;
      ctx.beginPath();
      ctx.arc(proj.sx, proj.sy, p.size * proj.scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Particle emission
  emitSmoke(x, y, z, count = 1) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (this.random() - 0.5) * 2,
        y: y + this.random() * 1,
        z: z + (this.random() - 0.5) * 2,
        vx: (this.random() - 0.5) * 0.5,
        vy: this.random() * 0.5 + 0.2,
        vz: (this.random() - 0.5) * 0.5,
        size: 3 + this.random() * 5,
        life: 1,
      });
    }
    if (this.particles.length > 200) this.particles.splice(0, this.particles.length - 200);
  }

  emitExhaust(x, y, z, throttle) {
    const count = Math.floor(throttle * 3) + 1;
    for (let i = 0; i < count; i++) {
      this.exhaustParticles.push({
        x: x + (this.random() - 0.5) * 0.5,
        y: y + (this.random() - 0.5) * 0.3,
        z: z + (this.random() - 0.5) * 0.5,
        vx: (this.random() - 0.5) * 1,
        vy: (this.random() - 0.5) * 0.5 - 0.5,
        vz: (this.random() - 0.5) * 1,
        size: 1 + this.random() * 2,
        life: 1,
      });
    }
    if (this.exhaustParticles.length > 100) this.exhaustParticles.splice(0, this.exhaustParticles.length - 100);
  }

  emitSplash(x, y, z) {
    for (let i = 0; i < 15; i++) {
      this.splashParticles.push({
        x: x + (this.random() - 0.5) * 3,
        y: y + this.random() * 2,
        z: z + (this.random() - 0.5) * 3,
        vx: (this.random() - 0.5) * 3,
        vy: this.random() * 3 + 1,
        vz: (this.random() - 0.5) * 3,
        size: 2 + this.random() * 4,
        life: 1,
      });
    }
    if (this.splashParticles.length > 150) this.splashParticles.splice(0, this.splashParticles.length - 150);
  }

  updateParticles(dt) {
    const g = 9.81;
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= g * dt * 0.1;
      p.life -= dt * 0.8;
    }
    this.particles = this.particles.filter(p => p.life > 0);

    for (const p of this.exhaustParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.life -= dt * 3;
    }
    this.exhaustParticles = this.exhaustParticles.filter(p => p.life > 0);

    for (const p of this.splashParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= g * dt;
      p.life -= dt * 1.5;
    }
    this.splashParticles = this.splashParticles.filter(p => p.life > 0);
  }

  triggerShake(intensity = 5, duration = 0.3) {
    this.shakeX = (this.random() - 0.5) * intensity;
    this.shakeY = (this.random() - 0.5) * intensity;
    this.shakeTime = duration;
  }

  // Cockpit panel rendering
  drawCockpitPanel(state) {
    const { ctx, width: CANVAS_WIDTH, height: CANVAS_HEIGHT } = this;
    const { COLORS } = CONFIG;
    const { aircraft } = state;
    if (!aircraft) return;
    if (!state.cockpitView) return;

    const panelY = CANVAS_HEIGHT - 180;

    // Panel background
    ctx.fillStyle = COLORS.PANEL_BG;
    ctx.fillRect(0, panelY, CANVAS_WIDTH, 180);
    ctx.strokeStyle = COLORS.PANEL_BORDER;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, panelY);
    ctx.lineTo(CANVAS_WIDTH, panelY);
    ctx.stroke();

    // Artificial Horizon (center)
    this.drawArtificialHorizon(ctx, aircraft, panelY);

    // Altimeter (left)
    this.drawAltimeter(ctx, aircraft, panelY);

    // Airspeed (right)
    this.drawAirspeed(ctx, aircraft, panelY);

    // Compass (bottom center)
    this.drawCompassPanel(ctx, aircraft, panelY);

    // Fuel (left of compass)
    this.drawFuelGauge(ctx, aircraft, panelY);
  }

  drawArtificialHorizon(ctx, aircraft, panelY) {
    const { COLORS } = CONFIG;
    const cx = this.halfW;
    const cy = panelY + 80;
    const radius = 90;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-aircraft.bank);

    // Sky
    const skyGrad = ctx.createLinearGradient(0, -radius, 0, radius);
    skyGrad.addColorStop(0, COLORS.SKY_TOP);
    skyGrad.addColorStop(1, COLORS.SKY_HORIZON);
    ctx.fillStyle = skyGrad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Ground
    const gndGrad = ctx.createLinearGradient(0, 0, 0, radius);
    gndGrad.addColorStop(0, COLORS.GRASS_DARK);
    gndGrad.addColorStop(1, COLORS.VOLCANO_ROCK);
    ctx.fillStyle = gndGrad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI);
    ctx.fill();

    // Horizon line
    ctx.strokeStyle = COLORS.PANEL_AMBER;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-radius, 0);
    ctx.lineTo(radius, 0);
    ctx.stroke();

    // Pitch ladder
    ctx.strokeStyle = COLORS.PANEL_WHITE;
    ctx.lineWidth = 1;
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    for (let p = -60; p <= 60; p += 10) {
      if (p === 0) continue;
      const y = -p * 0.8; // Scale
      if (Math.abs(y) > radius - 10) continue;
      const w = p % 30 === 0 ? 40 : 20;
      ctx.beginPath();
      ctx.moveTo(-w/2, y);
      ctx.lineTo(w/2, y);
      ctx.stroke();
      if (p % 30 === 0) {
        ctx.fillStyle = COLORS.PANEL_WHITE;
        ctx.fillText(`${p > 0 ? '+' : ''}${p}`, 0, y - 4);
      }
    }

    // Aircraft symbol (fixed)
    ctx.strokeStyle = COLORS.PANEL_AMBER;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-20, 0);
    ctx.lineTo(-8, 0);
    ctx.moveTo(8, 0);
    ctx.lineTo(20, 0);
    ctx.moveTo(0, -8);
    ctx.lineTo(0, 8);
    ctx.stroke();

    // Bank indicator
    ctx.strokeStyle = COLORS.PANEL_WHITE;
    ctx.lineWidth = 2;
    const bankAngle = Math.max(-Math.PI/2, Math.min(Math.PI/2, aircraft.bank));
    const bi = radius - 15;
    ctx.beginPath();
    ctx.arc(0, 0, bi, -Math.PI/2, -Math.PI/2 + bankAngle);
    ctx.stroke();
    // Triangle marker
    ctx.fillStyle = COLORS.PANEL_WHITE;
    ctx.save();
    ctx.rotate(-Math.PI/2 + bankAngle);
    ctx.beginPath();
    ctx.moveTo(0, -bi - 8);
    ctx.lineTo(-5, -bi);
    ctx.lineTo(5, -bi);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  drawAltimeter(ctx, aircraft, panelY) {
    const { COLORS } = CONFIG;
    const cx = 80;
    const cy = panelY + 80;
    const radius = 50;
    const alt = Math.max(0, aircraft.altitude);
    const altFt = alt * 3.28084;
    const needleAngle = (altFt % 1000) / 1000 * Math.PI * 2 - Math.PI/2;
    const thousands = Math.floor(altFt / 1000) % 10;

    ctx.save();
    ctx.translate(cx, cy);

    // Face
    ctx.fillStyle = COLORS.PANEL_BG;
    ctx.strokeStyle = COLORS.PANEL_BORDER;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Ticks
    ctx.strokeStyle = COLORS.PANEL_WHITE;
    ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2 - Math.PI/2;
      const r1 = radius - 5;
      const r2 = radius - (i % 5 === 0 ? 15 : 10);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
      ctx.stroke();
      if (i % 5 === 0) {
        ctx.fillStyle = COLORS.PANEL_WHITE;
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${i * 100}`, Math.cos(a) * (r2 - 8), Math.sin(a) * (r2 - 8));
      }
    }

    // Needle
    ctx.strokeStyle = COLORS.PANEL_AMBER;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(needleAngle) * (radius - 10), Math.sin(needleAngle) * (radius - 10));
    ctx.stroke();

    // Center hub
    ctx.fillStyle = COLORS.PANEL_AMBER;
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();

    // Digital readout
    ctx.fillStyle = COLORS.PANEL_GREEN;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.floor(altFt).toString().padStart(5, '0')}`, 0, radius + 22);

    // 1000ft indicator
    ctx.fillStyle = COLORS.PANEL_WHITE;
    ctx.font = '11px monospace';
    ctx.fillText(`${thousands}`, 0, radius + 38);

    ctx.restore();
  }

  drawAirspeed(ctx, aircraft, panelY) {
    const { COLORS } = CONFIG;
    const cx = this.width - 80;
    const cy = panelY + 80;
    const radius = 50;
    const speed = Math.max(0, aircraft.airspeed);
    const speedKts = speed * 1.94384;
    const maxSpeed = 160; // kts
    const needleAngle = Math.min(1, speedKts / maxSpeed) * Math.PI * 1.5 - Math.PI * 0.75;

    ctx.save();
    ctx.translate(cx, cy);

    ctx.fillStyle = COLORS.PANEL_BG;
    ctx.strokeStyle = COLORS.PANEL_BORDER;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Ticks
    ctx.strokeStyle = COLORS.PANEL_WHITE;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 16; i++) {
      const spd = i * 10;
      const a = (spd / maxSpeed) * Math.PI * 1.5 - Math.PI * 0.75;
      const r1 = radius - 5;
      const r2 = radius - (spd % 50 === 0 ? 15 : 10);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
      ctx.stroke();
      if (spd % 50 === 0) {
        ctx.fillStyle = COLORS.PANEL_WHITE;
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${spd}`, Math.cos(a) * (r2 - 8), Math.sin(a) * (r2 - 8));
      }
    }

    // Stall zone
    ctx.strokeStyle = COLORS.PANEL_RED;
    ctx.lineWidth = 3;
    const stallAngle = (45 / maxSpeed) * Math.PI * 1.5 - Math.PI * 0.75;
    ctx.beginPath();
    ctx.arc(0, 0, radius + 3, -Math.PI * 0.75, stallAngle);
    ctx.stroke();

    // Needle
    ctx.strokeStyle = COLORS.PANEL_AMBER;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(needleAngle) * (radius - 10), Math.sin(needleAngle) * (radius - 10));
    ctx.stroke();

    ctx.fillStyle = COLORS.PANEL_AMBER;
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();

    // Digital
    ctx.fillStyle = COLORS.PANEL_GREEN;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.floor(speedKts).toString().padStart(3, '0')}`, 0, radius + 22);
    ctx.fillStyle = COLORS.PANEL_WHITE;
    ctx.font = '11px monospace';
    ctx.fillText('KTS', 0, radius + 38);

    ctx.restore();
  }

  drawCompassPanel(ctx, aircraft, panelY) {
    const { COLORS } = CONFIG;
    const cx = this.halfW;
    const cy = panelY + 145;
    const width = 240;
    const height = 30;

    ctx.save();
    ctx.translate(cx, cy);

    // Background
    ctx.fillStyle = COLORS.PANEL_BG;
    ctx.strokeStyle = COLORS.PANEL_BORDER;
    ctx.lineWidth = 1;
    ctx.fillRect(-width/2, -height/2, width, height);
    ctx.strokeRect(-width/2, -height/2, width, height);

    // Tape
    const heading = aircraft.heading;
    const deg = (heading * 180 / Math.PI) % 360;
    const pxPerDeg = width / 60; // Show 60 degrees

    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let d = -30; d <= 30; d += 5) {
      const hdg = Math.round((deg + d + 360) % 360);
      const x = d * pxPerDeg;
      if (x < -width/2 || x > width/2) continue;

      ctx.strokeStyle = d === 0 ? COLORS.PANEL_AMBER : COLORS.PANEL_WHITE + '80';
      ctx.lineWidth = d === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, -height/2);
      ctx.lineTo(x, d % 15 === 0 ? -height/2 + 12 : -height/2 + 6);
      ctx.stroke();

      if (d % 15 === 0) {
        ctx.fillStyle = d === 0 ? COLORS.PANEL_AMBER : COLORS.PANEL_WHITE;
        const label = hdg === 0 ? 'N' : hdg === 90 ? 'E' : hdg === 180 ? 'S' : hdg === 270 ? 'W' : String(hdg).padStart(3, '0');
        ctx.fillText(label, x, -height/2 + 22);
      }
    }

    // Lubber line
    ctx.strokeStyle = COLORS.PANEL_AMBER;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -height/2);
    ctx.lineTo(0, -height/2 + 10);
    ctx.stroke();

    ctx.restore();
  }

  drawFuelGauge(ctx, aircraft, panelY) {
    const { COLORS } = CONFIG;
    const cx = this.halfW - 140;
    const cy = panelY + 145;
    const w = 60;
    const h = 30;

    const fuelPct = aircraft.fuel / CONFIG.AIRCRAFT.FUEL_CAPACITY * 100;

    ctx.save();
    ctx.translate(cx, cy);

    ctx.fillStyle = COLORS.PANEL_BG;
    ctx.strokeStyle = COLORS.PANEL_BORDER;
    ctx.lineWidth = 1;
    ctx.fillRect(-w/2, -h/2, w, h);
    ctx.strokeRect(-w/2, -h/2, w, h);

    // Fill
    const fillH = (h - 4) * (fuelPct / 100);
    const grad = ctx.createLinearGradient(0, h/2, 0, -h/2);
    grad.addColorStop(0, COLORS.PANEL_RED);
    grad.addColorStop(0.3, COLORS.PANEL_AMBER);
    grad.addColorStop(1, COLORS.PANEL_GREEN);
    ctx.fillStyle = grad;
    ctx.fillRect(-w/2 + 2, h/2 - 2 - fillH, w - 4, fillH);

    // Label
    ctx.fillStyle = COLORS.PANEL_WHITE;
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FUEL', 0, -h/2 - 8);
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`${Math.floor(fuelPct)}%`, 0, h/2 + 16);

    ctx.restore();
  }

  // HUD overlay
  drawHUD(state) {
    const { aircraft } = state;
    if (!aircraft) return;

    const altFt = Math.max(0, Math.round(aircraft.altitude * 3.28084));
    const spdKts = Math.max(0, Math.round(aircraft.airspeed * 1.94384));
    const hdgDeg = Math.round((aircraft.heading * 180 / Math.PI + 360) % 360);
    const fuelPct = Math.round(aircraft.fuel / CONFIG.AIRCRAFT.FUEL_CAPACITY * 100);
    const dmgPct = Math.round(aircraft.damage * 100);
    const score = aircraft.score || 0;

    document.getElementById('hud-alt').textContent = `${altFt.toLocaleString()} ft`;
    document.getElementById('hud-spd').textContent = `${spdKts} kts`;
    document.getElementById('hud-hdg').textContent = `${hdgDeg.toString().padStart(3, '0')}°`;
    document.getElementById('hud-fuel').textContent = `${fuelPct}%`;
    document.getElementById('fuel-bar').style.width = `${fuelPct}%`;
    document.getElementById('hud-dmg').textContent = `${dmgPct}%`;
    document.getElementById('dmg-bar').style.width = `${dmgPct}%`;
    document.getElementById('hud-score').textContent = score.toLocaleString();
    document.getElementById('objective-title').textContent = `${CONFIG.MISSIONS[state.mission].name} · ${Math.floor(state.elapsed || 0)}s`;

    // Compass tape
    this.drawCompassTape(hdgDeg);

    // Objective
    this.updateObjective(state);
  }

  drawCompassTape(hdgDeg) {
    const canvas = document.getElementById('compass-canvas');
    const ctx = canvas.getContext('2d');
    const w = 320, h = 40;
    ctx.clearRect(0, 0, w, h);

    const pxPerDeg = w / 60;
    const centerDeg = hdgDeg;

    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let d = -30; d <= 30; d += 5) {
      const hdg = Math.round((centerDeg + d + 360) % 360);
      const x = w/2 + d * pxPerDeg;
      if (x < 0 || x > w) continue;

      ctx.strokeStyle = d === 0 ? '#e8a030' : '#a89878';
      ctx.lineWidth = d === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 5);
      ctx.lineTo(x, d % 15 === 0 ? 20 : 14);
      ctx.stroke();

      if (d % 15 === 0) {
        ctx.fillStyle = d === 0 ? '#e8a030' : '#c8b898';
        const label = hdg === 0 ? 'N' : hdg === 90 ? 'E' : hdg === 180 ? 'S' : hdg === 270 ? 'W' : String(hdg).padStart(3, '0');
        ctx.fillText(label, x, 32);
      }
    }

    // Lubber line
    ctx.strokeStyle = '#e8a030';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w/2, 0);
    ctx.lineTo(w/2, 8);
    ctx.stroke();
  }

  updateObjective(state) {
    const { aircraft, mission, missionProgress } = state;
    if (!aircraft) return;

    const el = document.getElementById('objective-text');
    const missions = CONFIG.MISSIONS;
    const m = missions[mission];

    if (mission === 0) {
      el.textContent = `Fly through ring ${Math.min(missionProgress.ringsPassed + 1, m.rings)} of ${m.rings} · ${missionProgress.ringsPassed}/${m.rings}`;
    } else if (mission === 1) {
      el.textContent = `Drop ${Math.min(missionProgress.cratesDelivered + 1, m.drops)} of ${m.drops} · ${missionProgress.cratesDelivered}/${m.drops}`;
    } else if (mission === 2) {
      if (missionProgress.landingPhase === 'approach') {
        el.textContent = 'Align with runway, gear down, flaps';
      } else if (missionProgress.landingPhase === 'flare') {
        el.textContent = 'Flare for touchdown';
      } else if (missionProgress.landingPhase === 'rollout') {
        el.textContent = 'Brake to stop before runway end';
      } else {
        el.textContent = 'Approach the runway';
      }
    }
    const timer = document.getElementById('hud-timer');
    if (timer) timer.textContent = `${Math.floor(state.elapsed || 0)}s`;
  }
}
