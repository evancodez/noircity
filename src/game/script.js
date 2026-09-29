// The scripts' vocabulary (docs/story/CONTRACTS.md §3, §5): what a scene's
// or a fight's coroutine yields, and defineScene. A scene file imports
// these from here (game/SceneManager.js loads the scene files, so they
// must not import it).
//   yield wait(s)      yield until(() => cond)      yield beat(name)
export const wait = (s) => ({ kind: 'wait', left: s });
export const until = (cond) => ({ kind: 'until', cond });
export const beat = (name) => ({ kind: 'beat', name });

// a scene's definition with its defaults (see game/SceneManager.js)
export function defineScene(def) {
  if (!def.id) throw new Error('defineScene: an id');
  return { stage: 'block', title: '', name: '', beats: [], setup: {}, save: [], spawn: null, ...def };
}

// a key's name for a prompt ('KeyE' -> 'E')
export function keyLabel(code) {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return { Space: 'SPACE', Mouse0: 'LMB', Mouse2: 'RMB', Escape: 'ESC' }[code] || code;
}
