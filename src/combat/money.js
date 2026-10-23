// [O4] Money and what I carry to fight with (docs/OPEN_WORLD.md §4, the
// brief's §3): one number, $, in save.money (the seam for lane O7's HUD and
// saves); the guns owned in save.inventory ('revolver', 'tommy', 'shotgun');
// the rounds in the coat in save.ammo ({ revolver, shotgun, tommy: drums }).
//   money(G)              the $ I have
//   earn(G, n, why)       more (a purse, a fare, a wallet): event 'money'
//   pay(G, n, why)        -> true if I had it (and it is gone), else false
//   owns(G, gun)          the gun is mine          give(G, gun)
//   arms(G).next(dir)     the mouse wheel's turn through what I own (fists first)
// Never required for anything: a player with no money can do everything but buy.
export function wallet(G) {
  const S = G.save;
  if (S.money == null) S.money = 0;
  if (!S.ammo) S.ammo = {};
  return S;
}
export const money = (G) => wallet(G).money;
export function earn(G, n, why = '') {
  const S = wallet(G);
  n = Math.round(n);
  if (!n) return S.money;
  S.money += n;
  G.emit('money', { money: S.money, delta: n, why });
  if (G.hud && G.hud.message) G.hud.message(`$ ${S.money}   + ${n}`, 2.2);
  return S.money;
}
export function pay(G, n, why = '') {
  const S = wallet(G);
  n = Math.round(n);
  if (S.money < n) return false;
  S.money -= n;
  G.emit('money', { money: S.money, delta: -n, why });
  if (G.hud && G.hud.message) G.hud.message(`$ ${S.money}   - ${n}`, 2.2);
  return true;
}
// (a fall in the city costs a little: the hospital's stitches, the station's fine)
export function lose(G, frac = 0.1, min = 0, why = '') {
  const S = wallet(G);
  const n = Math.min(S.money, Math.max(min, Math.round(S.money * frac)));
  if (n > 0) { S.money -= n; G.emit('money', { money: S.money, delta: -n, why }); }
  return n;
}
export function owns(G, gun) { return gun === 'fists' || (G.save.inventory || []).includes(gun); }
export function give(G, gun) { const I = G.save.inventory || (G.save.inventory = []); if (!I.includes(gun)) I.push(gun); G.emit('arms', { gun }); }

// the wheel through what I own: fists, the revolver, the shotgun, the Tommy gun
const ORDER = ['fists', 'revolver', 'shotgun', 'tommy'];
export function arms(G) {
  return {
    list: () => ORDER.filter((g) => owns(G, g)),
    next(dir = 1) {
      const L = this.list();
      if (L.length < 2) return null;
      const Ws = G.player.weapons, cur = Ws.current && L.includes(Ws.current) ? Ws.current : 'fists';
      const to = L[(L.indexOf(cur) + (dir > 0 ? 1 : -1) + L.length) % L.length];
      this.to(to);
      return to;
    },
    to(gun) {
      const Ws = G.player.weapons;
      // (what the gun in hand has left goes back into the coat's count first)
      const Wp = Ws.active, A0 = wallet(G).ammo;
      if (Wp && Ws.current !== 'fists' && Number.isFinite(Wp.pocket)) { A0[Ws.current] = Wp.pocket; A0[Ws.current + 'In'] = Wp.ammo; }
      if (gun === 'fists') Ws.equip('fists');
      else {
        const W = Ws.get(gun);
        Ws.equip(gun);
        // (the coat's count of rounds into the gun)
        const A = wallet(G).ammo;
        if (W && W.setCounts && A[gun] != null) W.setCounts({ rounds: A[gun + 'In'] ?? W.mag, pocket: A[gun] });
      }
      G.emit('arms:equip', { gun });
    },
  };
}
