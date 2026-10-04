// [C10a] what piles up over fails at one checkpoint: the stage scene's objects by parent path and name,
// and the renderer's geometries / textures, diffed before and after N fails.
//   HUNT_AT=gunfight.flank HUNT_TIMES=3 NOIR_PORT=5350 node tools/hunt.mjs tools/hunts/pile.mjs
const COUNT = `(() => { const m = {}; const path = (o) => { const p = []; let x = o.parent; for (let i = 0; x && i < 3; i++, x = x.parent) p.push(x.name || x.type); return p.reverse().join('/'); };
  N.scene.traverse((o) => { if (o.parent === N.scene || (o.parent && o.parent.parent === N.scene)) { const mt = o.material && (Array.isArray(o.material) ? o.material[0] : o.material); const k = path(o) + ' > ' + (o.name || o.type) + (o.parent === N.scene && o.isMesh ? ' [' + (o.geometry && o.geometry.type) + ' ' + (mt && (mt.name || mt.type)) + ' ' + Object.keys(o.userData || {}).join(',') + ' y' + o.position.y.toFixed(1) + ']' : ''); m[k] = (m[k] || 0) + 1; } });
  const I = N.renderer.info.memory; m.__geo = I.geometries; m.__tex = I.textures; m.__top = N.scene.children.length; return m; })()`;
export default async function (h) {
  const at = process.env.HUNT_AT || 'gunfight.flank';
  const times = +(process.env.HUNT_TIMES || 3);
  const fall = process.env.HUNT_FALL !== '0';
  await h.open(`/?mute=1&start=${at}`);
  h.check(`${at}: begun`, await h.begin());
  await h.wait(4000);
  const X = process.env.HUNT_EXPR;
  if (X) h.log('  expr before: ' + JSON.stringify(await h.js(X)));
  // (every GL texture and buffer made from here on, by the stack that made it, until deleted)
  if (process.env.HUNT_GL) await h.js(`(() => { const gl = N.renderer.getContext(); const live = window.__glLive = new Map(); Error.stackTraceLimit = 60;
    const wrap = (mk, del) => { const m0 = gl[mk].bind(gl), d0 = gl[del].bind(gl);
      gl[mk] = () => { const o = m0(); const st = (new Error().stack || '').split('\\n').slice(2, 60).map((l) => l.trim().replace(/https?:[^)]*\\/src\\//, '').replace(/\\?[^:]*/, '')).filter((l) => !/three|node_modules/.test(l)).slice(0, 3).join(' < '); live.set(o, mk + ' ' + st); return o; };
      gl[del] = (o) => { live.delete(o); return d0(o); }; };
    wrap('createTexture', 'deleteTexture'); wrap('createBuffer', 'deleteBuffer'); return 1; })()`);
  if (process.env.HUNT_GEO) await h.js(`(() => { Error.stackTraceLimit = 60; const set = window.__geos = new Set(); const P = N.THREE.BufferGeometry.prototype, sa = P.setAttribute;
    P.setAttribute = function (n, a) { if (!this.__st) { this.__st = (new Error().stack || '').split('\\n').slice(2).map((l) => l.trim()).filter((l) => !/node_modules|three/.test(l)).slice(0, 3).map((l) => l.replace(/^at /, '').replace(/https?:\\/\\/[^/]+\\/src\\//, '').replace(/\\?t=\\d+/, '')).join(' < '); set.add(this); } return sa.call(this, n, a); }; return 1; })()`);
  const a = await h.js(COUNT);
  for (let k = 0; k < times; k++) {
    await h.js(`(G.fail({ why: 'Hunt.', fall: ${fall} }), 1)`);
    await h.until(`!G.failing && G.state === 'playing' && !G.scenes.trans`, 12000);
    await h.wait(1500);
  }
  const b = await h.js(COUNT);
  if (process.env.HUNT_GEO) { const r = await h.js(`(() => { const c = {}; for (const g of window.__geos) if (g._listeners && g._listeners.dispose && g._listeners.dispose.length) c[g.__st] = (c[g.__st] || 0) + 1; return Object.entries(c).sort((x, y) => y[1] - x[1]).slice(0, 16); })()`); for (const [k, n] of r) h.log(`  GEO ${n}  ${k}`); }
  if (process.env.HUNT_GL) { const r = await h.js(`(() => { const c = {}; for (const v of window.__glLive.values()) c[v] = (c[v] || 0) + 1; return Object.entries(c).sort((x, y) => y[1] - x[1]).slice(0, 14); })()`); for (const [k, n] of r) h.log(`  GL ${n}  ${k}`); }
  if (X) h.log('  expr after: ' + JSON.stringify(await h.js(X)));
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if ((b[k] || 0) !== (a[k] || 0)) h.log(`  ${k}: ${a[k] || 0} -> ${b[k] || 0}`);
}
