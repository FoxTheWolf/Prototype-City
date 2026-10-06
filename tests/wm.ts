/**
 * The notebook's window manager (15.7), in Node:
 *   npx rolldown tests/wm.ts --format esm --platform node -o tests/.out/wm.mjs && node tests/.out/wm.mjs [seed]
 * The terminal and the browser sit side by side with a '|' divider; the focus marker points at the
 * pane with the keys; Ctrl+Left/Right moves it; Ctrl+Up maximizes a pane (no divider, full width) and
 * again restores the split; PageUp walks the terminal's scrollback; keys reach the focused pane.
 * Prints the top rows of the composed screen.
 */
import { createWorld } from '../src/sim/world';
import { Browser } from '../src/web/browser';
import { WM, type TermIO } from '../src/laptop/wm';

const W = 160, H = 50;
const w = createWorld(Number(process.argv[2] ?? 42));
let fails = 0;
const fail = (m: string) => { if (++fails <= 30) console.log('FAIL ' + m); };

const lines = Array.from({ length: 60 }, (_, i) => ({ text: `line ${i}`, ink: 0 }));
lines.push({ text: 'bin  docs  tmp', ink: 0 });
lines.push({ text: 'host 10.0.4.7:23 open', ink: 0 });
lines.push({ text: 'Cell 01 - Address: AA:BB:CC:DD:EE:FF', ink: 0 });
lines.push({ text: 'ESSID:"Petrovs Coffee"  key 7418529185', ink: 0 });
const term: TermIO & { lines: { text: string; ink: number }[] } = {
  lines,
  prompt: 'user@host:~$ ',
  input: 'who',
  cur: 3,
  mask: false,
  scroll: 0,
  ready: true,
  termKey(k) { if (k.length === 1) { this.input += k; this.cur++; } },
  paste(t) { this.input += t; this.cur += t.length; },
};

const browser = new Browser(w, () => ({ up: true, kbps: 600 }), () => { }, W, H);
browser.go('', 0);
const wm = new WM(term, browser, W, H);

const split = Math.floor((W - 1) / 2); // 79
const rowStr = (scr: { ch: string[][] }, r: number) => scr.ch[r].join('');

// --- split layout, web focused by default ---
let out = wm.cells(1);
if (out.scr.w !== W || out.scr.h !== H) fail('composed screen is the console size');
if (rowStr(out.scr, 0)[split] !== '|') fail('a divider column between the panes');
if (out.scr.ch[H >> 1][split] !== '>') fail('the marker points at the web pane when it has the focus');
// the terminal pane holds the prompt line on the left; the browser's title bar is on the right
const leftHasPrompt = out.scr.ch.some((row) => row.slice(0, split).join('').includes('user@host:~$ who'));
if (!leftHasPrompt) fail('the terminal pane shows the prompt and what is typed');
const rightHasChrome = out.scr.ch.some((row) => row.slice(split + 1).join('').includes('Lodestar'));
if (!rightHasChrome) fail('the browser pane shows its chrome');

// --- move the focus to the terminal ---
wm.key('ArrowLeft', true, 1);
out = wm.cells(1);
if (out.scr.ch[H >> 1][split] !== '<') fail('the marker points at the terminal once it has the focus');
if (out.cx !== 13 + 3 || out.cy !== H - 1) fail(`the caret sits after the prompt on the last row (got ${out.cx},${out.cy})`);

// a letter typed reaches the terminal, not the browser
wm.key('x', false, 1);
if (term.input !== 'whox') fail('a key reaches the focused terminal');

// PageUp walks the scrollback
term.input = 'who'; term.cur = 3;
wm.key('PageUp', false, 1);
if (term.scroll <= 0) fail('PageUp scrolls the terminal back');
term.scroll = 0;

// --- Ctrl+Up maximizes the terminal: full width, no divider ---
wm.key('ArrowUp', true, 1);
out = wm.cells(1);
if (rowStr(out.scr, 0).includes('|') && rowStr(out.scr, 0)[split] === '|') fail('no divider when a pane is maximized');
if (out.scr.ch[0].slice(split).join('').includes('Lodestar')) fail('the browser is hidden when the terminal is maximized');
// restore
wm.key('ArrowUp', true, 1);
out = wm.cells(1);
if (out.scr.ch[0][split] !== '|') fail('Ctrl+Up again restores the split');

// --- mouse: a press on a pane focuses it; the wheel scrolls the pane under the cursor ---
wm.cells(1); // compose so the selection can read the grid
wm.focus = 'web';
wm.down(5, 10); wm.up(5, 10, 1); // a plain click, no drag
if (wm.focus !== 'term') fail('a press on the terminal pane focuses it');
wm.down(split + 10, 5); wm.up(split + 10, 5, 1);
if (wm.focus !== 'web') fail('a press on the browser pane focuses it');
term.scroll = 0;
wm.wheel(-1, 5); // wheel up over the terminal walks its scrollback
if (term.scroll <= 0) fail('the wheel over the terminal scrolls it back');
term.scroll = 0;

// --- select a run of the terminal and copy it, then paste into the prompt ---
wm.focus = 'term';
wm.cells(1);
// the top row of the terminal pane reads "line 12" in the printout above; drag across it
wm.down(0, 0); wm.drag(6, 0); wm.up(6, 0, 1);
if (!/^line \d/.test(wm.clip)) fail(`a drag copies the text under it (got "${wm.clip}")`);
term.input = ''; term.cur = 0;
wm.key('v', true, 1); // Ctrl+V pastes into the prompt
if (term.input !== wm.clip.replace(/\s+/g, ' ').trim()) fail(`Ctrl+V pastes the clipboard into the prompt (got "${term.input}")`);

// --- clicking an address in the terminal types it at the prompt (15.7d) ---
wm.focus = 'term'; term.scroll = 0; term.input = ''; term.cur = 0;
const scr = wm.cells(1).scr;
let ipr = -1, ipc = -1;
for (let r = 0; r < H && ipr < 0; r++) { const c = scr.ch[r].join('').indexOf('10.0.4.7'); if (c >= 0 && c < split) { ipr = r; ipc = c + 3; } }
if (ipr < 0) fail('the address line is on screen');
else { wm.down(ipc, ipr); wm.up(ipc, ipr, 1); if (!term.input.includes('10.0.4.7:23')) fail(`clicking an address types it at the prompt (got "${term.input}")`); }

// --- clicking other fields: a MAC, a quoted ESSID, a WEP key (15.7e-c) ---
function clickField(needle: string, into: number, want: string, what: string) {
  wm.focus = 'term'; term.scroll = 0; term.input = ''; term.cur = 0;
  const s = wm.cells(1).scr;
  for (let r = 0; r < H; r++) { const c = s.ch[r].join('').indexOf(needle); if (c >= 0 && c < split) { wm.down(c + into, r); wm.up(c + into, r, 1); if (term.input !== want) fail(`clicking ${what} types "${want}" (got "${term.input}")`); return; } }
  fail(`the ${what} line is on screen`);
}
clickField('AA:BB:CC:DD:EE:FF', 2, 'AA:BB:CC:DD:EE:FF', 'a MAC/BSSID');
clickField('"Petrovs Coffee"', 3, '"Petrovs Coffee"', 'a quoted ESSID');
clickField('7418529185', 2, '7418529185', 'a WEP key');

console.log(fails ? `\n${fails} FAILED` : '\nOK — composes, focuses, maximizes, routes keys, the mouse, copy/paste, and field clicks (ip, mac, essid, key)');
console.log('\n--- top of the composed screen (split, terminal focused) ---');
wm.key('ArrowLeft', true, 1);
const show = wm.cells(1);
for (let r = 0; r < 6; r++) console.log(rowStr(show.scr, r).replace(/\s+$/, ''));
