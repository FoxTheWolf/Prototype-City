// 15.17c: the Ferret's tabs, back and forward per tab, the bookmarks and the history on the notebook's
// disk, the frame's pixels; and a picture of it (tests/.out/ferret.png: the frame in HD with the cells'
// text in the 5 x 7 font, to judge the layout without the game).
import { writeFileSync } from 'node:fs';
import { png, shot } from './png';
import { createWorld } from '../src/sim/world';
import { Browser } from '../src/web/browser';
import { fetchUrl } from '../src/web/sites';

let bad = 0;
const check = (name: string, ok: boolean) => { if (!ok) { bad++; console.log('FAIL', name); } };
const w = createWorld(42);
const disk = new Map<string, string>();
const files = { read: (n: string) => disk.get(n) ?? null, write: (n: string, t: string) => { disk.set(n, t); } };
let quit = 0;
const B = new Browser(w, () => ({ up: true, kbps: 900 }), () => { quit++; }, 160, 50, files);
B.go('', 0);
const home = B.url;
const rowText = (t: number, r: number) => B.cells(t).scr.ch[r].join('');
check('the factory bookmarks: Lookwise, the mail, the portal', /Lookwise.*Mail/.test(rowText(10, 3)));
check('the forum is never a factory bookmark', !/switchboard/i.test(rowText(10, 3)));
// follow a link, then back and forward
B.key('Tab', false, 10); B.key('Tab', false, 10); B.key('Enter', false, 10);
const second = B.url;
check('a link followed', second !== home);
B.key('Backspace', false, 11);
check('back', B.url === home);
B.click(5, 2, 12); // forward is cells 4..6 of the bar
check('forward', B.url === second);
check('the back button thumps', B.sfx.includes('thump'));
check('both pages in the history file', (disk.get('history') ?? '').includes(home) && (disk.get('history') ?? '').includes(second));
// a new tab opens on the start page; its own back is empty; Ctrl+Tab goes round
B.key('t', true, 13);
check('Ctrl+T: a new tab on the start page', B.url === home);
B.key('Backspace', false, 14);
check('the new tab has its own (empty) history', B.url === home);
B.key('Tab', true, 15);
check('Ctrl+Tab: back to the first tab', B.url === second);
// visited links are purple: a story linked in the start page's text, seen, then back home
const story = (fetchUrl(w, home).page!.blocks.flatMap((b) => (b.t === 'cols' ? b.cols.flat() : [b])).find((b) => b.t === 'list') as { items: string[] } | undefined)?.items.map((s) => s.match(/\]\(([^)]+)\)/)?.[1]).find(Boolean);
if (story) { B.go(story, 16); B.go(home, 16.5); }
check('the start page links a story in its text', !!story);
const S = B.cells(30).scr;
let purple = false;
for (let r = 4; r < 49; r++) for (let c = 0; c < 159; c++) if (S.fg[r][c] === 0x551a8b) purple = true;
check('a link seen is purple', purple);
// bookmark the page with Ctrl+D (the star lights), and the file keeps it
B.key('t', true, 31); B.go('www.lookwise.com/search?q=pizza', 31);
const sUrl = B.url;
B.key('d', true, 40);
check('Ctrl+D: the page in the bookmarks file', (disk.get('bookmarks') ?? '').includes(sUrl));
const B2 = new Browser(w, () => ({ up: true, kbps: 900 }), () => {}, 160, 50, files);
B2.go('', 50);
check('a Ferret opened again reads the bookmarks', /pizza|Lookwise/i.test(B2.cells(60).scr.ch[3].join('')) && (disk.get('bookmarks') ?? '').split('\n').length === 4);
B.key('d', true, 41);
check('Ctrl+D again takes it away', !(disk.get('bookmarks') ?? '').includes(sUrl));
// the search box: words typed there are always a search
B.key('k', true, 42); for (const ch of 'motel') B.key(ch, false, 42); B.key('Enter', false, 42);
check('the Lookwise box searches', B.url.includes('lookwise.com/search?q=motel'));
// closing the tabs one by one; the last one closes the browser
const tabs = () => B.cells(50).scr.ch[0].join('').split('x').length;
B.key('w', true, 50); B.key('w', true, 50);
check('Ctrl+W closes a tab', quit === 0);
B.key('w', true, 50);
check('closing the last tab closes Ferret', quit === 1);
void tabs;
// the frame's pixels: digging while loading, a key that changes then, and steady once done
const C = new Browser(w, () => ({ up: true, kbps: 120 }), () => {}, 160, 50, null);
C.go('', 100);
const k1 = C.art(100.6).key, k2 = C.art(100.75).key, kDone = C.art(200).key;
check('the ferret digs while the page comes', /"dig"/.test(k1) && k1 !== k2);
// (only a blinking ad or a marquee moves it then: the key's last part)
const still = (k: string) => k.split('|').slice(0, -1).join('|');
check('the frame holds still once the page is in', still(kDone) === still(C.art(260).key) && /"peek"/.test(kDone));

writeFileSync('tests/.out/ferret.png', shot(C, 200));
console.log(bad ? `${bad} failed` : 'browser-tabs: all passed (picture in tests/.out/ferret.png)');
process.exit(bad ? 1 : 0);
