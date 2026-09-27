// ?debug=1 overlay: fps, frame time, renderer.info (calls/tris/programs).
export class Stats {
  constructor(renderer) {
    this.renderer = renderer;
    this.el = document.createElement('div');
    this.el.id = 'stats';
    Object.assign(this.el.style, {
      position: 'fixed', left: '8px', top: '8px', zIndex: 50, font: '11px/1.35 Menlo, monospace',
      color: '#ddd', background: 'rgba(0,0,0,0.6)', padding: '6px 8px', whiteSpace: 'pre', pointerEvents: 'none',
    });
    document.body.appendChild(this.el);
    this.frames = 0;
    this.acc = 0;
    this.fps = 0;
    this.ms = 0;
    this.last = performance.now();
  }
  update(extra = '') {
    const now = performance.now();
    const dt = now - this.last;
    this.last = now;
    this.frames++;
    this.acc += dt;
    this.ms = this.ms * 0.9 + dt * 0.1;
    if (this.acc > 500) {
      this.fps = (this.frames * 1000) / this.acc;
      this.frames = 0;
      this.acc = 0;
      const i = this.renderer.info;
      this.el.textContent = `fps ${this.fps.toFixed(1)}  ${this.ms.toFixed(1)} ms\n`
        + `calls ${i.render.calls}  tris ${(i.render.triangles / 1000).toFixed(0)}k\n`
        + `programs ${i.programs ? i.programs.length : '?'}  geo ${i.memory.geometries}  tex ${i.memory.textures}\n${extra}`;
      this.el.dataset.fps = this.fps.toFixed(1);
    }
  }
}
