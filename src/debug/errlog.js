// Required error capture (DESIGN.md §9). Imported FIRST by main.js so that
// errors thrown while other modules evaluate are still recorded.
// tools/errors.sh reads #errlog's text and its data-frames attribute.
const el = document.createElement('div');
el.id = 'errlog';
el.style.display = 'none';
el.dataset.frames = '0';
(document.body || document.documentElement).appendChild(el);

function fmt(a) {
  if (a instanceof Error) return a.stack || a.message;
  if (a && typeof a === 'object') {
    try { return JSON.stringify(a).slice(0, 500); } catch (e) { return String(a); }
  }
  return String(a);
}
function log(kind, args) {
  el.textContent += `[${kind}] ${args.map(fmt).join(' ')}\n`;
}
const origError = console.error.bind(console);
const origWarn = console.warn.bind(console);
console.error = (...args) => { log('error', args); origError(...args); };
console.warn = (...args) => { log('warn', args); origWarn(...args); };
window.addEventListener('error', (e) => log('onerror', [e.message, `${e.filename}:${e.lineno}:${e.colno}`, e.error || '']));
window.addEventListener('unhandledrejection', (e) => log('unhandledrejection', [e.reason]));

export const errlog = {
  el,
  setFrames(n) { el.dataset.frames = String(n); },
  log,
};
