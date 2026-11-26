// Browser bootstrap: canvas sizing, input, audio, fixed-step update, rendering, and test hooks.
import { CONFIG } from './config.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { FlightGame } from './game.js';
import { readShot } from './shots.js';

const canvas = document.getElementById('canvas');
canvas.width = CONFIG.CANVAS_WIDTH;
canvas.height = CONFIG.CANVAS_HEIGHT;
canvas.style.width = '100vw';
canvas.style.height = '100vh';
const renderer = new Renderer(canvas);
const input = new Input(canvas);
const audio = new AudioEngine();
const shot = readShot();
const game = new FlightGame(shot?.seed ?? 1, {
  crash: () => renderer.triggerShake(12, 0.5),
  impact: (x, y, z) => renderer.emitSplash(x, y, z),
});
if (shot) game.setShot(shot.name);

const title = document.getElementById('title-screen');
const missionComplete = document.getElementById('mission-complete-screen');
const gameOver = document.getElementById('game-over-screen');
const win = document.getElementById('win-screen');
let previous = performance.now();
let frameCount = 0;
let selectedMission = 0;

function hideOverlays() {
  [title, missionComplete, gameOver, win].forEach(element => element.classList.add('hidden'));
}

function updateOverlays() {
  const s = game.state;
  title.classList.toggle('hidden', s.mode !== 'title');
  missionComplete.classList.toggle('hidden', s.mode !== 'mission-complete');
  gameOver.classList.toggle('hidden', s.mode !== 'gameover');
  win.classList.toggle('hidden', s.mode !== 'win');
  document.getElementById('crash-cause').textContent = s.crashCause;
  document.getElementById('final-score').textContent = `Sortie score · ${s.aircraft.score.toLocaleString()}`;
  document.getElementById('mission-score').textContent = `${CONFIG.MISSIONS[s.mission].name} · ${s.aircraft.score.toLocaleString()} points`;
  document.getElementById('total-score').textContent = `${game.totalScore.toLocaleString()} points`; 
  document.getElementById('btn-next').textContent = s.mission >= 2 ? 'Finish Campaign' : 'Continue to Next Sortie';
  if (s.mode === 'win') {
    document.getElementById('total-score').textContent = `${game.totalScore.toLocaleString()} points`;
  }
}

function actions() {
  const s = game.state;
  const selected = input.consumeMission();
  if (selected !== null) selectedMission = selected;
  if (input.consumeAction('start')) {
    audio.start();
    if (s.mode === 'win') game.totalScore = 0;
    game.startMission(selectedMission);
  }
  if (input.consumeAction('next') && s.mode === 'mission-complete') {
    if (s.mission >= 2) { s.mode = 'win'; }
    else { selectedMission = s.mission + 1; game.startMission(selectedMission); }
  }
  if (input.consumeAction('retry')) game.restart();
  if (input.consumeAction('title')) game.state.mode = 'title';
  if (input.consumeAction('start') && s.mode === 'win') { game.totalScore = 0; game.startMission(0); }
  if (input.pressed('KeyR') && s.mode !== 'title' && s.mode !== 'win') game.restart();
  if (input.pressed('KeyC')) s.cockpitView = !s.cockpitView;
  if (input.pressed('KeyP')) s.paused = !s.paused;
  if (input.pressed('KeyM')) audio.toggleMute();
  if (input.pressed('Space') && s.mode === 'title') {
    audio.start(); game.startMission(selectedMission);
  }
  if (input.pressed('Digit1')) selectedMission = 0;
  if (input.pressed('Digit2')) selectedMission = 1;
  if (input.pressed('Digit3')) selectedMission = 2;
}

function loop(now) {
  const dt = Math.min(0.05, (now - previous) / 1000 || 0);
  previous = now;
  actions();
  document.getElementById('cockpit-panel').classList.toggle('active', game.state.cockpitView);
  if (game.state.mode === 'playing' && !game.state.paused) {
    game.update(dt, input, audio);
    renderer.updateParticles(dt);
    const a = game.state.aircraft;
    if (a.throttle > 0.2 && Math.floor(game.state.time * 3) % 3 === 0) {
      renderer.emitSmoke(a.x, a.y - 2, a.z, 1);
    }
  }
  renderer.render(game.state, game.world, input, game.state.cockpitView);
  if (game.state.paused) {
    const pause = document.getElementById('pause-indicator'); pause.classList.add('active');
  } else document.getElementById('pause-indicator').classList.remove('active');
  updateOverlays();
  input.clearPressed();
  frameCount++;
  requestAnimationFrame(loop);
}

window.__game = {
  game,
  input,
  audio,
  get state() { return game.state; },
  get speed() { return game.state.aircraft.airspeed; },
  get score() { return game.state.aircraft.score; },
  get rings() { return game.state.missionProgress.ringsPassed; },
  get frame() { return frameCount; },
  start: id => game.startMission(id),
  setPosition: (...args) => game.setPosition(...args),
  passRing: () => {
    const ring = game.world.rings.find(item => item.active && !item.passed);
    if (!ring) return false;
    const a = game.state.aircraft; a.x = ring.x; a.y = ring.height; a.z = ring.z;
    game.checkRings(audio); return game.state.missionProgress.ringsPassed > 0;
  },
  placeAtNextRing: () => {
    const ring = game.world.rings.find(item => item.active && !item.passed);
    if (!ring) return false;
    const a = game.state.aircraft;
    a.x = ring.x - ring.radius * 1.5; a.y = ring.height; a.z = ring.z - 5;
    a.airspeed = 48; a.heading = Math.PI / 2; a.vy = 0; a.onGround = false;
    return true;
  },
  setNextRingActive: () => {
    const ring = game.world.rings[game.state.missionProgress.ringsPassed];
    game.world.rings.forEach(item => { item.active = false; });
    if (ring) ring.active = true;
    return Boolean(ring);
  },
  land: () => {
    const a = game.state.aircraft, r = game.world.runway;
    a.x = r.x; a.z = r.z; a.y = 4; a.airspeed = 4; a.vy = -1; a.gearDown = true;
    game.checkLanding(audio); return game.state.mode === 'mission-complete';
  },
  step: (dt, controls = {}) => {
    const simulationInput = {
      down: (...keys) => keys.some(key => controls[key]),
      pressed: key => Boolean(controls[key]),
      mouse: { x: controls.mouseX || 0, active: Boolean(controls.mouseX) },
    };
    game.update(dt, simulationInput, null);
    return game.state;
  },
};

requestAnimationFrame(loop);
