// GPU time per pipeline stage (EXT_disjoint_timer_query_webgl2), Phase 3b
// performance pass. Off unless started: Pipeline calls prof.begin(name) /
// prof.end() around each stage only while `pipeline.prof` is set.
//   await __noir.gpuProfile(4)  ->  { frames, total, stages: { id: ms, ... } }
// Queries are not nested (one TIME_ELAPSED query at a time), so a stage is
// ended before the next begins; results are read back a few frames later.
export class GpuProf {
  constructor(gl) {
    this.gl = gl;
    this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    this.free = [];
    this.pending = [];        // [{ q, name }]
    this.sum = new Map();     // name -> { ms, n }
    this.open = null;
    this.frames = 0;
  }
  get ok() { return !!this.ext; }
  begin(name) {
    if (!this.ext) return;
    if (this.open) this.end();
    const gl = this.gl;
    const q = this.free.pop() || gl.createQuery();
    gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.open = { q, name };
  }
  end() {
    if (!this.ext || !this.open) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.open);
    this.open = null;
  }
  // once per frame: collect finished queries
  frame() {
    if (!this.ext) return;
    this.end();
    this.frames++;
    const gl = this.gl;
    const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT);
    let i = 0;
    for (; i < this.pending.length; i++) {
      const P = this.pending[i];
      if (!gl.getQueryParameter(P.q, gl.QUERY_RESULT_AVAILABLE)) break;
      if (!disjoint) {
        const ns = gl.getQueryParameter(P.q, gl.QUERY_RESULT);
        const s = this.sum.get(P.name) || { ms: 0, n: 0 };
        s.ms += ns / 1e6; s.n++;
        this.sum.set(P.name, s);
      }
      this.free.push(P.q);
    }
    this.pending.splice(0, i);
  }
  reset() { this.sum.clear(); this.frames = 0; }
  report() {
    const stages = {};
    let total = 0, n = 0;
    for (const [k, s] of this.sum) { stages[k] = +(s.ms / s.n).toFixed(3); total += s.ms / s.n; n = Math.max(n, s.n); }
    return { frames: n, total: +total.toFixed(2), stages };
  }
}
