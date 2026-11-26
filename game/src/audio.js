// Small procedural WebAudio engine, wind bed, ring chime, and landing impact.
export class AudioEngine {
  constructor() {
    this.context = null;
    this.engine = null;
    this.wind = null;
    this.muted = false;
  }

  start() {
    if (this.muted) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!this.context) {
        this.context = new AudioContext();
        this.engine = this.context.createOscillator();
        this.engine.type = 'sawtooth';
        const engineGain = this.context.createGain();
        engineGain.gain.value = 0.025;
        this.engine.connect(engineGain).connect(this.context.destination);
        this.engine.start();
        this.wind = this.context.createOscillator();
        this.wind.type = 'triangle';
        this.wind.frequency.value = 90;
        const windGain = this.context.createGain();
        windGain.gain.value = 0.008;
        this.wind.connect(windGain).connect(this.context.destination);
        this.wind.start();
      }
      if (this.context.state === 'suspended') this.context.resume();
    } catch { this.context = null; }
  }

  update(throttle, speed) {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime;
    this.engine.frequency.setTargetAtTime(48 + throttle * 72, now, 0.08);
    this.wind.frequency.setTargetAtTime(55 + speed * 1.1, now, 0.3);
  }

  tone(frequency, duration = 0.35, wave = 'sine', volume = 0.14) {
    if (!this.context || this.muted) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * 0.68), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  ring() { this.tone(920, 0.42, 'sine', 0.18); }
  touchdown(hard = false) { this.tone(hard ? 95 : 150, 0.22, 'triangle', hard ? 0.28 : 0.12); }
  toggleMute() { this.muted = !this.muted; if (!this.muted) this.start(); }
}
