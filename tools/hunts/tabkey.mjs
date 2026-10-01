// [R3] the Tab key: what it does to the focus and to the pointer lock
export default async function (h) {
  await h.open('/?mute=1&start=diner.settle');
  await h.begin();
  await h.wait(2000);
  const S = () => h.js(`({ lock: !!document.pointerLockElement, focus: document.hasFocus(), active: document.activeElement && (document.activeElement.tagName + '#' + document.activeElement.id), focusables: document.querySelectorAll('[tabindex], button, a[href], input, select, textarea, [contenteditable]').length, paused: G.hud.paused })`);
  h.log('before: ' + JSON.stringify(await S()));
  await h.key('Tab', 80); await h.wait(400);
  h.log('after Tab: ' + JSON.stringify(await S()));
}
