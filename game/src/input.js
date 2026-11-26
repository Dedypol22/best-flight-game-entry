// Keyboard and mouse controls, title-screen mission selection, and pause/restart actions.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, active: false };
    this.justPressed = new Set();
    this.actions = { start: false, mission: null, next: false, retry: false, title: false };
    this.canvas = canvas;
    this.bind();
  }

  bind() {
    window.addEventListener('keydown', event => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
      if (!this.keys.has(event.code)) this.justPressed.add(event.code);
      this.keys.add(event.code);
    });
    window.addEventListener('keyup', event => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.keys.clear());
    this.canvas.addEventListener('mousemove', event => {
      const bounds = this.canvas.getBoundingClientRect();
      this.mouse.x = (event.clientX - bounds.left) / bounds.width * 2 - 1;
      this.mouse.y = (event.clientY - bounds.top) / bounds.height * 2 - 1;
      this.mouse.active = true;
    });
    this.canvas.addEventListener('mouseleave', () => { this.mouse.active = false; });
    document.querySelectorAll('[data-mission]').forEach(button => button.addEventListener('click', () => {
      document.querySelectorAll('[data-mission]').forEach(item => item.classList.remove('selected'));
      button.classList.add('selected');
      this.actions.mission = Number(button.dataset.mission);
    }));
    this.onClick('btn-start', 'start');
    this.onClick('btn-next', 'next');
    this.onClick('btn-retry-mission', 'retry');
    this.onClick('btn-restart', 'retry');
    this.onClick('btn-title', 'title');
    this.onClick('btn-play-again', 'start');
  }

  onClick(id, action) {
    document.getElementById(id)?.addEventListener('click', () => { this.actions[action] = true; });
  }

  down(...codes) { return codes.some(code => this.keys.has(code)); }
  pressed(...codes) {
    const hit = codes.some(code => this.justPressed.has(code));
    if (hit) codes.forEach(code => this.justPressed.delete(code));
    return hit;
  }

  consumeAction(name) {
    const action = this.actions[name];
    this.actions[name] = false;
    return action;
  }

  consumeMission() {
    const value = this.actions.mission;
    this.actions.mission = null;
    return value;
  }

  clearPressed() { this.justPressed.clear(); }
}
