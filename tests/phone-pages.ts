// The phone's pages drawn in pixels (phone/pixpages.ts), painted with made-up data into PNGs to look at without the
// game or a GPU: tests/.out/tunes.png (the Tunes Player). The bars on top are pixui.ts's, not drawn here.
import { writeFileSync } from 'node:fs';
import { Img, Paint } from '../src/render/paint2d';
import { artColors, wxColors } from '../src/phone/hdicons';
import { paintCalc, paintList, paintMenu, paintNotes, paintStore, paintTunes, paintWeather, paintCalMonth, paintCalDay, paintCalNew } from '../src/phone/pixpages';
import { png } from './png';
const I = new Img(240, 432), P = new Paint(I);
const spec = new Float32Array(16).map((_, k) => 0.2 + 0.6 * Math.abs(Math.sin(k)));
const rows = [{ kind: 'head' as const, label: 'Songs', size: '', mark: '' as const, sel: false },
  ...['Night Shift - The Overpass Kids', 'Sodium Glow - Kimara Sound', 'Last Train - Grid People'].map((l, i) => ({ kind: 'song' as const, label: l, size: '3.1 MB', mark: (i === 0 ? 'play' : '') as '' | 'play', sel: i === 1, pre: () => {} })),
  { kind: 'head' as const, label: 'SD card', size: '', mark: '' as const, sel: false }, { kind: 'note' as const, label: 'No songs on the card', size: '', mark: '' as const, sel: false }];
paintTunes(P, { title: 'Tunes', out: 'SPEAKER', idle: 'Nothing playing', tune: { title: 'Night Shift', band: 'The Overpass Kids', at: 42, len: 180, playing: true, vol: 0.7, shuffle: '', spec, sel: false, pre: () => {} }, volLabel: 'VOL', keys: '< > skip  * # volume  0 shuffle', rows, t: 5 }, 1);
const out = new Uint8ClampedArray(I.px.length); for (let k = 0; k < I.px.length; k += 4) { const a = I.px[k + 3] / 255; out[k] = I.px[k] * a; out[k + 1] = I.px[k + 1] * a; out[k + 2] = I.px[k + 2] * a; out[k + 3] = 255; }
writeFileSync('tests/.out/tunes.png', png(out, 240, 432));

// 0.15.29: the list pages (settings), the calculator, notes, the store and My Apps
{
  const shot = (name: string, paint: (P: Paint) => void) => {
    const J = new Img(240, 432), Q = new Paint(J); paint(Q);
    const o = new Uint8ClampedArray(J.px.length); for (let k = 0; k < J.px.length; k += 4) { const a = J.px[k + 3] / 255; o[k] = J.px[k] * a; o[k + 1] = J.px[k + 1] * a; o[k + 2] = J.px[k + 2] * a; o[k + 3] = 255; }
    writeFileSync(`tests/.out/${name}.png`, png(o, 240, 432));
  };
  const f = () => {}, col = [138, 147, 160] as const;
  shot('settings', (Q) => paintList(Q, { title: 'Settings', note: '', col, t: 5, rows: ['Sounds', 'Display', 'Phone & case', 'Units', 'Wi-Fi', 'USB cable', 'About phone', 'Debug (game)', 'People here (debug)'].map((l, n) => ({ kind: 'go' as const, label: l, sel: n === 2, pre: f })) }));
  shot('sounds', (Q) => paintList(Q, { title: 'Sounds', note: '', col, t: 5, foot: '< > change   OK next', rows: [['Profile', 'Normal'], ['Ringtone', 'Nocturne'], ['Keypad tones', 'Touch-tone']].map(([l, v], n) => ({ kind: 'opt' as const, label: l, value: v, sel: n === 1, pre: f })) }));
  shot('wifi', (Q) => paintList(Q, { title: 'Wi-Fi', note: '', col, t: 5, foot: 'KEY (debug) 4417', rows: [{ kind: 'pick', label: 'Wi-Fi', value: 'ON', col: [120, 255, 150], sel: false, pre: f },
    { kind: 'text', label: 'Connected 192.168.1.23', col: [120, 255, 150] }, { kind: 'pick', label: '> Petrovs Coffee', value: 'WEP', bars: 3, col: [120, 255, 150], sel: false, pre: f }, { kind: 'pick', label: 'NETGEAR', value: 'WPA', bars: 1, sel: true, pre: f }, { kind: 'pick', label: 'linksys', value: '', bars: 2, sel: false, pre: f }] }));
  shot('about', (Q) => paintList(Q, { title: 'About phone', note: '', col, t: 5, rows: [['Network', 'NORTEL'], ['Signal', '-71 dBm (3/4)'], ['Number', '555-0179'], ['Credit', '$4.20'], ['Model', 'Kesion S2'], ['CPU', 'ARM9 200 MHz'], ['Camera', '2 MP'], ['GPS now', 'OFF']].map(([l, v]) => ({ kind: 'info' as const, label: l, value: v })) }));
  shot('calc', (Q) => paintCalc(Q, { title: 'Calc', value: '1234.5', op: '+', err: false, hint: 'Type the numbers on the keypad',
    keys: [['+', '^'], ['-', 'v'], ['x', '<'], ['/', '>'], ['C', '*'], ['.', '#'], ['=', 'OK']].map(([sym, hint]) => ({ sym, key: 'ok' as const, hint, kind: sym === 'C' ? 'clear' as const : sym === '.' ? 'point' as const : 'op' as const })) }));
  shot('notes', (Q) => paintNotes(Q, { title: 'Notes', note: 'Abc 52/400', text: 'meet at the diner 9pm\nbring the cable and the old phone', live: 1, blink: false, empty: '', hint: { chips: ['m', 'n', 'o', '6'], on: 1 }, t: 5 }));
  shot('store', (Q) => paintStore(Q, { title: 'Kesion Store', tabs: ['CATALOG', 'INSTALLED'], tab: 0, goTab: f, empty: '', t: 5, bar: 0.4, note: '', about: 'A torch: the whole screen white, as bright as it goes.',
    rows: [['Snake', 'INSTALLED', true, 'snake', [150, 178, 84]], ['Torch', '12KB FREE', false, 'torch', [230, 200, 60]], ['Converter', '36KB $0.99', false, 'convert', [40, 150, 150]], ['Atlas 3D', '38MB $9.99', false, 'atlas', [60, 130, 90]], ['Reynard', 'INSTALLED', true, 'reynard', [34, 30, 28]]].map(([l, r, h, id, c], n) => ({ label: l as string, right: r as string, col: c as [number, number, number], art: artColors(id as string), big: n === 3, have: h as boolean, sel: n === 1, pre: f })) }));
  shot('folder', (Q) => paintMenu(Q, [['Snake', 'snake', [150, 178, 84]], ['Torch', 'torch', [230, 200, 60]], ['Converter', 'convert', [40, 150, 150]], ['Reynard', 'reynard', [34, 30, 28]]].map(([l, id, c], n) => ({ label: l as string, col: c as [number, number, number], art: artColors(id as string), sel: n === 0, pre: f })), 5, { title: 'My Apps', note: '3', col: [224, 154, 58], empty: [] }));
}

// 0.15.30: the weather
{
  const J = new Img(240, 432), Q = new Paint(J);
  const cards = [['NOW', '21:00', 'partlyNight', '54°'], ['+3h', '00:00', 'rain', '51°'], ['+6h', '03:00', 'storm', '49°'], ['+12h', '09:00', 'drizzle', '55°'], ['+24h', '21:00', 'sun', '60°']].map(([label, hour, a, temp]) => ({ label, hour, art: wxColors(a), temp }));
  paintWeather(Q, { city: 'Port Halvard', brand: 'skycast', top: [20, 30, 64], bot: [60, 70, 110], t: 5, msg: [], log: [], bar: -1, kb: '', warn: [],
    now: { art: wxColors('partlyNight'), temp: '54', unit: '°F', sky: 'Partly cloudy', line: 'H 60°   L 48°   wind 4 m/s' }, cards, moon: 'Moon: waxing gibbous', updated: 'updated 20:41' });
  const o = new Uint8ClampedArray(J.px.length); for (let k = 0; k < J.px.length; k += 4) { const a = J.px[k + 3] / 255; o[k] = J.px[k] * a; o[k + 1] = J.px[k + 1] * a; o[k + 2] = J.px[k + 2] * a; o[k + 3] = 255; }
  writeFileSync('tests/.out/weather.png', png(o, 240, 432));
}

// 0.15.31: the calendar
{
  const shot = (name: string, paint: (P: Paint) => void) => {
    const J = new Img(240, 432), Q = new Paint(J); paint(Q);
    const o = new Uint8ClampedArray(J.px.length); for (let k = 0; k < J.px.length; k += 4) { const a = J.px[k + 3] / 255; o[k] = J.px[k] * a; o[k + 1] = J.px[k + 1] * a; o[k + 2] = J.px[k + 2] * a; o[k + 3] = 255; }
    writeFileSync(`tests/.out/${name}.png`, png(o, 240, 432));
  };
  const days = Array.from({ length: 31 }, (_, i) => { const c = 3 + i; return { d: i + 1, col: c % 7, row: Math.floor(c / 7), today: i === 6, sel: i === 13, red: c % 7 === 0 || i === 12, rem: i === 13 || i === 20, ev: i % 4 === 1, pre: () => {} }; });
  shot('cal-month', (Q) => paintCalMonth(Q, { title: 'OCTOBER 2008', week: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'], days, date: 'Tu Oct 14', moon: 'full moon', hint: '* # month  0 today',
    lines: [{ text: 'Columbus Day', red: true }, { text: '* Live band at The Copper Owl', red: false }, { text: '* Sale at Halvard Hardware', red: false }] }));
  shot('cal-day', (Q) => paintCalDay(Q, { title: 'TU OCTOBER 14, 2008', scroll: 0, lines: [{ text: 'Sunrise 7:02 am   Sunset 6:21 pm', col: 'ink', head: false }, { text: 'Moon: full moon', col: 'ink', head: false }, { text: 'Forecast: rain, 51°F', col: 'blue', head: false },
    { text: '', col: 'ink', head: false }, { text: 'REMINDERS', col: 'red', head: true }, { text: '9:00 pm  meet at the diner', col: 'ink', head: false }, { text: '', col: 'ink', head: false }, { text: 'IN THE CITY', col: 'red', head: true }, { text: '* Live band at The Copper Owl', col: 'ink', head: false }] }));
  shot('cal-new', (Q) => paintCalNew(Q, { title: 'New reminder - Oct 14', whatLabel: 'What', what: 'meet at the dine', whenLabel: 'When', when: '21:--  HHMM', step: 0, blink: true, hint: { chips: ['d', 'e', 'f', '3'], on: 1 }, goWhat: () => {}, goWhen: () => {} }));
}
