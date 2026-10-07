// 15.17d: the Ferret's error pages. A site in a dark sector times out after the ferret has dug 8 s, and
// opens again when the power is back; an address that never was is "Server not found"; no network is
// "Offline"; a lapsed certificate shows its warning, and Add Exception lets the page through (kept on the disk).
import { writeFileSync } from 'node:fs';
import { createWorld } from '../src/sim/world';
import { Browser } from '../src/web/browser';
import { certOf, webOf } from '../src/web/sites';
import { placeAt } from '../src/phone/places';
import { subAt } from '../src/sim/power';
import { shot } from './png';

let bad = 0;
const check = (name: string, ok: boolean) => { if (!ok) { bad++; console.log('FAIL', name); } };
const w = createWorld(42), Wb = webOf(w);
const disk = new Map<string, string>();
const files = { read: (n: string) => disk.get(n) ?? null, write: (n: string, t: string) => { disk.set(n, t); } };
let up = true;
const B = new Browser(w, () => ({ up, kbps: 900 }), () => {}, 160, 50, files);
const page = (t: number) => B.cells(t).scr.ch.slice(4, 49).map((r) => r.join('')).join('\n');
const art = (t: number) => B.art(t).key;

// a shop's site in the dark
const biz = [...Wb.byBiz.entries()].find(([, h]) => !certOf(w, h))!, [k, host] = biz;
const sub = subAt(w.power, w.city, ...placeAt(w.city, k));
w.power.subs[sub].on = false;
B.go(host, 0);
check('the ferret digs while it waits for a dark server', /"dig"/.test(art(5)) && /Waiting for/.test(B.cells(5).scr.ch[49].join('')));
check('no timeout before 8 s', !/timed out/.test(page(8)));
check('timed out after it', /The connection has timed out/.test(page(10)) && page(10).includes(host));
check('the ferret is lost then', /"lost"/.test(art(10)));
w.power.subs[sub].on = true;
const tryRow = B.cells(20).scr.ch.findIndex((r) => r.join('').includes(' Try Again '));
if (tryRow >= 0) B.click(23, tryRow, 20);
check('Try Again with the power back opens the site', !/timed out/.test(page(40)) && !B.url.includes('Problem'));

// an address that never was
B.go('www.nosuchplacezzq.com', 50);
check('Server not found', /Server not found/.test(page(51)) && /nosuchplacezzq/.test(page(51)));
// no network
up = false; B.go('', 60);
check('Offline', /Offline/.test(page(61)) && /no network/.test(B.cells(61).scr.ch[49].join('')));
up = true;

// a lapsed certificate
const badHost = [...Wb.hosts.keys()].find((h) => certOf(w, h) === 'bad' && Wb.hosts.get(h)!.kind === 'biz')!;
check('some shop has a lapsed certificate', !!badHost);
check('the mail is on https with a good one', certOf(w, [...Wb.hosts.entries()].find(([, s]) => s.kind === 'mail')![0]) === 'ok');
B.go(badHost, 70);
check('the address turns https', B.url.startsWith('https://'));
check('the warning, not the page', /This Connection is Untrusted/.test(page(72)) && /expired on \d\d\/\d\d\/\d{4}/.test(page(72)));
writeFileSync('tests/.out/ferret-cert.png', shot(B, 72));
const row = B.cells(72).scr.ch.findIndex((r) => r.join('').includes('Add Exception'));
B.click(B.cells(72).scr.ch[row].join('').indexOf('Add Exception') + 2, row, 72);
check('Add Exception lets the page through', !/Untrusted/.test(page(90)) && page(90).trim().length > 0);
check('the exception is on the disk', (disk.get('exceptions') ?? '').includes(badHost));
check('the padlock shows once trusted', /"secure":true/.test(art(90)));
B.go(host, 100); w.power.subs[sub].on = false; B.go(host, 100);
writeFileSync('tests/.out/ferret-timeout.png', shot(B, 112));
console.log(bad ? `${bad} failed` : 'web-errors: all passed (pictures in tests/.out/ferret-cert.png, ferret-timeout.png)');
process.exit(bad ? 1 : 0);
