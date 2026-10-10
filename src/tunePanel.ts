/**
 * The tuning panel (F12, debug): sliders over render/tune.ts's TUNE, the live knobs, for adjusting the look while
 * playing without a rebuild (Tweakpane, loaded on first use; never part of the game itself). The mouse is freed while
 * it is open, and the keys and clicks on it stay with it (they don't walk the player or lock the mouse again).
 */
import { TUNE } from './render/tune';

/** Each knob's slider range and step. */
const RANGE: Record<keyof typeof TUNE, [number, number, number]> = {
  dayExpo: [0.3, 5, 0.05], eyeDay: [0, 1, 0.05], bandDayLo: [0.005, 0.4, 0.005], bandDayHi: [0.01, 0.6, 0.005],
  adaptDark: [0, 1, 0.05], adaptBright: [0, 1, 0.05], giK: [0, 4, 0.05], giRayMax: [0.25, 8, 0.25],
};
const DEFAULTS = { ...TUNE };

let host: HTMLDivElement | null = null;

/** Opens or closes the panel; returns whether it is open now. */
export async function toggleTune(): Promise<boolean> {
  if (host) { host.style.display = host.style.display === 'none' ? '' : 'none'; return host.style.display !== 'none'; }
  host = document.createElement('div');
  Object.assign(host.style, { position: 'fixed', top: '8px', right: '8px', width: '300px', zIndex: '1000' });
  for (const ev of ['keydown', 'keyup', 'mousedown', 'mouseup', 'click', 'wheel']) host.addEventListener(ev, (e) => e.stopPropagation());
  document.body.appendChild(host);
  const { Pane } = await import('tweakpane');
  const pane = new Pane({ container: host, title: 'tune (F12)' });
  for (const k of Object.keys(RANGE) as (keyof typeof TUNE)[]) {
    const [min, max, step] = RANGE[k];
    pane.addBinding(TUNE, k, { min, max, step });
  }
  // what to tell Claude: the values changed from the code's, to write back into the constants
  pane.addButton({ title: 'copy changes' }).on('click', () => {
    const ch = (Object.keys(TUNE) as (keyof typeof TUNE)[]).filter((k) => TUNE[k] !== DEFAULTS[k]).map((k) => `${k} = ${TUNE[k]}`);
    void navigator.clipboard?.writeText(ch.join('\n') || '(no changes)');
  });
  // (the console may change TUNE too: the sliders follow)
  setInterval(() => { if (host?.style.display !== 'none') pane.refresh(); }, 500);
  pane.addButton({ title: 'reset' }).on('click', () => { Object.assign(TUNE, DEFAULTS); pane.refresh(); });
  return true;
}
