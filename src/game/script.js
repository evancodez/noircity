// The scripts' vocabulary (docs/story/CONTRACTS.md §3, §5): what a scene's
// or a fight's coroutine yields, and defineScene. A scene file imports
// these from here (game/SceneManager.js loads the scene files, so they
// must not import it).
//   yield wait(s)      yield until(() => cond)      yield beat(name)
import { ORDER } from '../scenes/order.js';
export { ORDER };
export const wait = (s) => ({ kind: 'wait', left: s });
export const until = (cond) => ({ kind: 'until', cond });
export const beat = (name) => ({ kind: 'beat', name });

// a scene's definition with its defaults (see game/SceneManager.js); its
// chapter card's numeral (title) and name come from the story's order
// (src/scenes/order.js) unless it gives its own
// [C1] (and the chapter's kit defaults: its stand-in objective line, its
// music and beatMusic, what the detective carries by then - order.js; a key
// the scene gives itself wins, docs/story/seams/Z.md)
export function defineScene(def) {
  if (!def.id) throw new Error('defineScene: an id');
  const O = ORDER.find((o) => o.id === def.id);
  const kit = {};
  if (O) for (const k of ['objective', 'music', 'beatMusic', 'carry', 'flags']) if (Object.prototype.hasOwnProperty.call(O, k)) kit[k] = O[k];
  return { stage: 'block', title: O ? O.numeral : '', name: O ? O.title : '', beats: [], setup: {}, save: [], spawn: null, ...kit, ...def };
}

// a key's name for a prompt ('KeyE' -> 'E')
export function keyLabel(code) {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return { Space: 'SPACE', Mouse0: 'LMB', Mouse2: 'RMB', Escape: 'ESC' }[code] || code;
}
