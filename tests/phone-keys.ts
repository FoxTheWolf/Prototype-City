/**
 * The phone's keys of 2026-10-06, in Node:
 *   npx rolldown tests/phone-keys.ts --format esm --platform node -o tests/.out/phone-keys.mjs && node tests/.out/phone-keys.mjs
 * The typing hint's data (Abc: the letter picked; T9: the guesses and the one shown), the Phone's two
 * tabs (Calls <-> Contacts), the Tunes Player on the menu, and the side keys (volume, play/pause).
 */
import { Editor } from '../src/phone/textinput';
import { APPS, Phone } from '../src/phone/phone';
import { createWorld } from '../src/sim/world';

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL ' + m); } };

// Abc: 2 tapped three times is c, the third of "abc2"
const e = new Editor(160);
e.key('2', 0); e.key('2', 0.1); e.key('2', 0.2);
ok(e.tapping(0.3) === 'abc2' && e.tapIndex() === 2, `abc tap index ${e.tapIndex()}`);
// T9: 4-6-6-3 has several words (good, home, gone...); * steps to the next, and the index follows
const f = new Editor(160); f.key('#', 0);
for (const k of ['4', '6', '6', '3'] as const) f.key(k, 1);
const G = f.guesses();
console.log('  4663 ->', G.join(' '));
ok(G.length > 1 && f.guessIndex() === 0 && f.word() === G[0], 't9 first guess');
f.key('*', 2);
ok(f.guessIndex() === 1 && f.word() === G[1], 't9 * steps to the second guess');

// the menu: Tunes on it, Contacts not (a tab of the Phone)
ok(APPS.includes('tunes') && !APPS.includes('contacts') && APPS.length === 16, 'menu apps');
const w = createWorld(42), P = new Phone(w);
P.screen = 'calls';
P.press('right', 1, 100, 100);
ok(P.screen === 'contacts', `right on Calls opens Contacts (${P.screen})`);
P.press('left', 1, 100, 100);
ok(P.screen === 'calls', `left on Contacts opens Calls (${P.screen})`);
// the side keys
const v0 = P.tn.vol;
P.press('vup', 1, 100, 100);
ok(Math.abs(P.tn.vol - Math.min(1, v0 + 0.1)) < 1e-9, `vol up ${v0} -> ${P.tn.vol}`);
P.press('vdown', 1, 100, 100); P.press('vdown', 1, 100, 100);
ok(Math.abs(P.tn.vol - (v0 - 0.1)) < 1e-9, `vol down -> ${P.tn.vol}`);
P.press('play', 1, 100, 100);
ok(P.tn.cur >= 0 && P.tn.playing, 'play starts a song');
P.tn.len = 120;
P.press('play', 1, 100, 100);
ok(!P.tn.playing, 'play again pauses');
// the standby screen: the arrows pick a notice, OK opens its app (the music: the Tunes Player)
P.open('standby', 1);
ok(P.notices().includes('tune'), `notices ${P.notices()}`);
P.press('down', 1, 100, 100);
ok(P.nsel === 0, `down picks the first notice (${P.nsel})`);
const k = P.notices().indexOf('tune');
for (let n = 0; n < k; n++) P.press('down', 1, 100, 100);
P.press('ok', 1, 100, 100);
ok(P.screen === 'app', `OK on the music opens the player (${P.screen})`);
P.press('rsoft', 1, 100, 100);
ok(P.screen === 'standby', `Back from it comes home (${P.screen})`);
P.press('ok', 1, 100, 100);
ok(P.screen === 'menu', `OK with nothing picked opens the menu (${P.screen})`);
console.log(fails ? `${fails} FAILED` : 'phone keys: all ok');
