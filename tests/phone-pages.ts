// The phone's pages drawn in pixels (phone/pixpages.ts), painted with made-up data into PNGs to look at without the
// game or a GPU: tests/.out/tunes.png (the Tunes Player). The bars on top are pixui.ts's, not drawn here.
import { writeFileSync } from 'node:fs';
import { Img, Paint } from '../src/render/paint2d';
import { artColors, wxColors } from '../src/phone/hdicons';
import { paintCalc, paintList, paintMenu, paintNotes, paintStore, paintTunes, paintWeather, paintCalMonth, paintCalDay, paintCalNew, paintNewsFront, paintNewsArticle, paintWireFeed, paintWirePost, paintWireProfile, paintBank, paintSnake, paintConvert, paintCamera, paintPhotos, wrapText } from '../src/phone/pixpages';
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

// 0.15.32: the news
{
  const shot = (name: string, paint: (P: Paint) => void) => {
    const J = new Img(240, 432), Q = new Paint(J); paint(Q);
    const o = new Uint8ClampedArray(J.px.length); for (let k = 0; k < J.px.length; k += 4) { const a = J.px[k + 3] / 255; o[k] = J.px[k] * a; o[k + 1] = J.px[k + 1] * a; o[k + 2] = J.px[k + 2] * a; o[k + 3] = 255; }
    writeFileSync(`tests/.out/${name}.png`, png(o, 240, 432));
  };
  const heads = ['Blackout darkens Riverside for two hours', 'Two cars collide at 5th and Mercer; no one hurt', 'Diner on Kell Street opens late for the night shift', 'City council meets on the tram budget'];
  shot('news-front', (Q) => paintNewsFront(Q, { name: 'THE PORT HALVARD COURIER', date: 'Tue. Oct 14, 2008', ed: 'LATE ED.', wait: '', bad: false, t: 5,
    stories: heads.map((h, k) => ({ lines: wrapText(h, 30), photo: k < 2, sel: k === 1, pre: () => {} })) }));
  const hd = new Uint8ClampedArray(126 * 54 * 3).map((_, i) => ((i / 3) % 126) < 60 ? 40 + (i % 3) * 30 : 120);
  shot('news-article', (Q) => paintNewsArticle(Q, { name: 'THE PORT HALVARD COURIER', date: 'Tue. Oct 14, 2008', ed: 'LATE ED.', head: wrapText(heads[0], 30), photo: { hd, w: 126, h: 54 }, hasPhoto: true,
    caption: 'Security camera still, CAM 04', body: [...wrapText('The lights went out across Riverside at nine last night, and the grid company says the cause is under review.', 36), '', ...wrapText('Shops closed early.', 36)], dateline: 'PORT HALVARD, Oct 14', scroll: 0, t: 5 }));
}

// 0.15.33: Streetwire
{
  const shot = (name: string, paint: (P: Paint) => void) => {
    const J = new Img(240, 432), Q = new Paint(J); paint(Q);
    const o = new Uint8ClampedArray(J.px.length); for (let k = 0; k < J.px.length; k += 4) { const a = J.px[k + 3] / 255; o[k] = J.px[k] * a; o[k + 1] = J.px[k + 1] * a; o[k + 2] = J.px[k + 2] * a; o[k + 3] = 255; }
    writeFileSync(`tests/.out/${name}.png`, png(o, 240, 432));
  };
  const hd = new Uint8ClampedArray(126 * 42 * 3).map((_, i) => ((i / 3) % 126) < 60 ? 40 + (i % 3) * 30 : 120);
  const faces = [{ col: [180, 110, 150] as [number, number, number], ini: 'MR' }, { col: [100, 170, 140] as [number, number, number], ini: 'ES' }, { col: [120, 120, 200] as [number, number, number], ini: 'JO' }];
  const texts = ['tried to fix the sink myself. now the kitchen is a pond, send help', 'lights out on Kell Street again, third time this month', 'best coffee in Riverside is the little cart by the station. fight me'];
  shot('wire-feed', (Q) => paintWireFeed(Q, { tab: 'Home', tagline: 'what the city is saying', wait: '', bad: false, photoWord: 'photo', t: 5,
    posts: texts.map((s, k) => ({ face: faces[k], name: ['Maria Rossi', 'Eric Shi', 'Jo Okafor'][k], age: `${k * 4 + 2}m ago`, lines: wrapText(s, 33), hasPhoto: k < 2, photo: k === 0 ? { hd, w: 126, h: 42 } : null,
      likes: String(3 + k), liked: k === 1, comments: `${k} comments`, sel: k === 1, pre: () => {} })) }));
  shot('wire-post', (Q) => paintWirePost(Q, { tab: 'Post', tagline: 'what the city is saying', photo: { hd, w: 126, h: 42 }, loadingPhoto: 'loading photo...', scroll: 0, t: 5,
    rows: [{ kind: 'who', face: faces[0], name: 'Maria Rossi', sub: '2m ago in Riverside', author: true }, ...wrapText(texts[0], 35).map((text) => ({ kind: 'text' as const, text })), { kind: 'photo' },
      { kind: 'like', label: 'Like', count: '3 likes', liked: false }, { kind: 'gap' },
      { kind: 'who', face: faces[1], name: 'Eric Shi', sub: '1m ago' }, { kind: 'text', text: 'call a plumber, @maria, not youtube' }, { kind: 'gap' },
      { kind: 'who', face: { col: [255, 140, 40], ini: 'NI' }, name: 'nightowl', sub: 'just now', you: true }, { kind: 'text', text: 'rubber boots. trust me.' }, { kind: 'gap' }] }));
  shot('wire-profile', (Q) => paintWireProfile(Q, { tab: 'Profile', tagline: 'Loading the wire..', face: faces[0], name: 'Maria Rossi', handle: '@mrossi82', friends: '214 friends', joined: 'joined Mar 2007',
    info: [['Age', '26'], ['Lives in', 'Riverside'], ['Work', 'works at Kell Street Diner'], ['Likes', 'jazz, soccer, old films']], bio: wrapText('Night shift, day dreams. If the lights go out, I am the one with candles.', 36).slice(0, 3),
    postsBy: 'Posts', noPosts: 'No recent posts.', t: 5, posts: texts.map((s, k) => ({ age: `${k * 4 + 2}m ago`, text: s, sel: k === 0, pre: () => {} })) }));
}

// 0.15.34: the bank
{
  const shot = (name: string, paint: (P: Paint) => void) => {
    const J = new Img(240, 432), Q = new Paint(J); paint(Q);
    const o = new Uint8ClampedArray(J.px.length); for (let k = 0; k < J.px.length; k += 4) { const a = J.px[k + 3] / 255; o[k] = J.px[k] * a; o[k + 1] = J.px[k + 1] * a; o[k + 2] = J.px[k + 2] * a; o[k + 3] = 255; }
    writeFileSync(`tests/.out/${name}.png`, png(o, 240, 432));
  };
  const nm = 'HALVARD SAVINGS & TRUST', f = () => {};
  shot('bank-home', (Q) => paintBank(Q, { name: nm, t: 5, view: { kind: 'home', acct: 'Checking ****4471', label: 'Available balance', balance: '$1,284.50', asOf: 'As of 21:04',
    menu: ['Statement', 'Branches nearby', 'Branch & contact'].map((label, n) => ({ label, sel: n === 1, pre: f })) } }));
  shot('bank-stmt', (Q) => paintBank(Q, { name: nm, t: 5, view: { kind: 'stmt', title: 'STATEMENT', rows: [['10/14', 'Card: Kell Street Diner', '-$8.40', false], ['10/14', 'ATM: 5th Ave Deli', '-$40.00', false], ['10/13', 'Transfer in', '+$600.00', true], ['10/12', 'Top up Corvia', '-$20.00', false]]
    .map(([date, what, amt, plus], n) => ({ date: date as string, what: what as string, amt: amt as string, plus: plus as boolean, sel: n === 1, pre: f })) } }));
  shot('bank-near', (Q) => paintBank(Q, { name: nm, t: 5, view: { kind: 'near', title: 'BRANCHES NEARBY', hint: 'Take cash out at the counter. Green key calls.', call: 'Call the branch',
    rows: [['Halvard Savings', '5th Avenue & Mercer St', '240m', true], ['Halvard Savings Downtown', 'Kell Street & 2nd Avenue', '1.2km', true], ['Halvard Savings', 'Bay Road & 9th St', '2.1km', false]]
      .map(([name, where, dist, open], n) => ({ name: name as string, where: where as string, dist: dist as string, open: open as boolean, openLabel: open ? 'Open now' : 'Closed', sel: n === 0, pre: f })) } }));
  shot('bank-branch', (Q) => paintBank(Q, { name: nm, t: 5, view: { kind: 'branch', title: 'YOUR BRANCH', call: 'Call the branch', lines: [{ text: '5th Avenue &', kind: 'ink' }, { text: 'Mercer Street', kind: 'ink' }, { text: 'Riverside', kind: 'ink' },
    { text: '', kind: 'ink' }, { text: 'Mon-Fri 9am-5pm', kind: 'dim' }, { text: '(555) 014-2233', kind: 'num' }, { text: 'Head office', kind: 'head' }, { text: 'Kell Street &', kind: 'ink' }, { text: '2nd Avenue', kind: 'ink' }, { text: 'Downtown', kind: 'ink' },
    { text: '', kind: 'ink' }, { text: '6 branches in the city', kind: 'dim' }] } }));
}

// 0.15.35: Snake, the converter
{
  const shot = (name: string, paint: (P: Paint) => void) => {
    const J = new Img(240, 432), Q = new Paint(J); paint(Q);
    const o = new Uint8ClampedArray(J.px.length); for (let k = 0; k < J.px.length; k += 4) { const a = J.px[k + 3] / 255; o[k] = J.px[k] * a; o[k + 1] = J.px[k + 1] * a; o[k + 2] = J.px[k + 2] * a; o[k + 3] = 255; }
    writeFileSync(`tests/.out/${name}.png`, png(o, 240, 432));
  };
  const body: [number, number][] = [[20, 10], [19, 10], [18, 10], [17, 10], [17, 9], [17, 8], [16, 8]];
  shot('snake', (Q) => paintSnake(Q, { w: 40, h: 20, body, food: [30, 4], score: 'SCORE 6   BEST 40', over: false, gameOver: 'GAME OVER', again: 'OK to play again' }));
  shot('snake-over', (Q) => paintSnake(Q, { w: 40, h: 20, body, food: [30, 4], score: 'SCORE 6   BEST 40', over: true, gameOver: 'GAME OVER', again: 'OK to play again' }));
  shot('convert', (Q) => paintConvert(Q, { title: 'Converter', col: [40, 150, 150], what: 'Temperature', input: '72.5', from: 'F', out: '22.5', to: 'C', blink: true, hint: '0-9 type   # .   * del' }));
}

// 0.15.36: the camera and the photos
{
  const shot = (name: string, paint: (P: Paint) => void) => {
    const J = new Img(240, 432), Q = new Paint(J); paint(Q);
    const o = new Uint8ClampedArray(J.px.length); for (let k = 0; k < J.px.length; k += 4) { const a = J.px[k + 3] / 255; o[k] = J.px[k] * a; o[k + 1] = J.px[k + 1] * a; o[k + 2] = J.px[k + 2] * a; o[k + 3] = 255; }
    writeFileSync(`tests/.out/${name}.png`, png(o, 240, 432));
  };
  // a night street: dark sky, a lit window band, the road
  const w = 128, h = 128, hd = new Uint8ClampedArray(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 3, win = y > 30 && y < 80 && x % 16 < 6 && y % 12 < 6, road = y > 96;
    const c = win ? [255, 200, 110] : road ? [50, 46, 40] : y < 30 ? [14, 18, 30] : [40, 34, 44];
    hd[i] = c[0]; hd[i + 1] = c[1]; hd[i + 2] = c[2];
  }
  const pic = { hd, w, h };
  shot('camera', (Q) => paintCamera(Q, { pic, ar: 1.2, flash: false, info: '2MP  34', mode: 'FLASH', flashOn: true, zoom: '1.6x digital' }));
  shot('photos', (Q) => paintPhotos(Q, { title: 'Photos', count: '3/7', col: [154, 159, 168], pic, ar: 1.2, date: '14 Oct  21:04', kb: '612 KB', del: '* delete', empty: 'No photos yet' }));
}
