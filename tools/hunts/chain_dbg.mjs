// [R3] scratch: the hands' state in the tail, cold and through the chain
const HS = `(() => { const H = G.hands; const f = (v) => v && v.toArray ? v.toArray().map((x) => +x.toFixed(3)) : v;
  return { set: H.set, clips: H.clips.map((c) => [c.name, c.hold, c.done, +c.t.toFixed(2)]), still: !!H.still, blendT: +H.blendT.toFixed(2), blendDur: H.blendDur, fromR: !!H.from.R, fromL: !!H.from.L,
    nowR: f(H.now.R.p), nowL: f(H.now.L.p), visR: H.now.R.vis, visL: H.now.L.vis, held: [H.held.R && H.held.R.name, H.held.L && H.held.L.name], keyMemo: !!H.keyMemo, studyFov: H.studyFov, vmStudy: !!G.vm.study }; })()`;
export default async function (h) {
  await h.open('/?mute=1&start=tail');
  await h.begin();
  await h.wait(3500);
  h.log('COLD ' + JSON.stringify(await h.js(HS)));
  await h.open('/?mute=1&start=watcher.car');
  await h.begin();
  await h.until(`G.interact.list.some((i) => i.id === 'drive')`, 20000);
  const door = await h.js(`(() => { const i = G.interact.list.find((x) => x.id === 'drive'); const p = typeof i.at === 'function' ? i.at() : i.at; return [p.x, p.z]; })()`);
  await h.js(`(() => { N.controller.setPose(${door[0] - 1.5}, ${door[1]}, -Math.PI / 2, -0.1); return 1; })()`);
  await h.wait(800);
  h.log('WATCHER ' + JSON.stringify(await h.js(HS)));
  await h.until(`G.hud.promptShown.includes('drive')`, 6000);
  await h.key('KeyE');
  await h.wait(900);
  h.log('DOOR ' + JSON.stringify(await h.js(HS)));
  await h.until(`G.scenes.current && G.scenes.current.id === 'tail'`, 12000);
  await h.wait(500);
  h.log('TAIL +0.5 ' + JSON.stringify(await h.js(HS)));
  await h.wait(3000);
  h.log('TAIL +3.5 ' + JSON.stringify(await h.js(HS)));
}
