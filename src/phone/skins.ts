import { weatherIcon, wxArt } from './hdicons';
import en from '../locale/en.json';
import { cityName } from '../locale/names';
import { newsStories, storyBody, type Story } from '../locale/news';
import { HD } from '../render/hd';
import { isSolid } from '../sim/city';
import { takePic } from './wire';
import { PICK, PICK_INK } from './ui';
import { calendar, moonPhase, sunDir } from '../sim/clock';
import { forecast, newWeather, type Weather } from '../sim/weather';
import { type World } from '../sim/world';
import { bigText, ch, type C3, hhmm, type Lcd, MONTHS, DAYS, SH, softKeys, SW, typed } from './lcd';
import { type Phone } from './phone';

/**
 * The apps that have a look of their own, as the first app stores' apps did: the weather on a sky
 * the color of the weather outside, and the news as a newspaper's front page. (Streetwire and the
 * calendar have their own files; the small ones are in apps.ts.)
 */
const A = en.phone.apps, W = A.wx;
const lerp = (a: C3, b: C3, k: number): C3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

function skyWord(w: Weather): string {
  const K = W.sky;
  if (w.precip > 0.02) return w.snow ? K.snow : w.precip > 0.75 ? K.storm : w.precip < 0.25 ? K.drizzle : K.rain;
  return w.cloud > 0.75 ? K.cloudy : w.cloud > 0.35 ? K.partly : K.clear;
}
/** A little picture of the weather, 5 cells by 3, each row in the color of what it shows (sun, moon, cloud, rain, snow, lightning). */
const SUN: C3 = [255, 214, 70], MOON: C3 = [236, 232, 196], CLOUD: C3 = [232, 236, 244], DARKC: C3 = [150, 156, 170], RAIN: C3 = [120, 180, 255], BOLT: C3 = [255, 240, 110];
function icon(w: Weather, night: boolean): [string, C3][] {
  const cloud: C3 = w.precip > 0.75 ? DARKC : CLOUD;
  if (w.precip > 0.02) {
    if (w.snow) return [[' .-. ', CLOUD], ['(___)', CLOUD], ['* * *', [255, 255, 255]]];
    if (w.precip > 0.75) return [['(___)', cloud], ['  /_ ', BOLT], [" /'' ", BOLT]];
    if (w.precip < 0.25) return [[' .-. ', cloud], ['(___)', cloud], [" ' ' ", RAIN]];
    return [['(___)', cloud], [' ////', RAIN], ['//// ', RAIN]];
  }
  if (w.cloud > 0.75) return [['  .-.', CLOUD], ['.(   ', CLOUD], ['(____', CLOUD]];
  if (w.cloud > 0.35) return night ? [['  )  ', MOON], [' .-. ', CLOUD], ['(___)', CLOUD]] : [['\\ | ', SUN], [' .-. ', CLOUD], ['(___)', CLOUD]];
  return night ? [[' .-. ', MOON], ['(  ( ', MOON], [" '-' ", MOON]] : [['\\ | /', SUN], ['- O -', SUN], ['/ | \\', SUN]];
}

const ahead: Weather = newWeather(), sun = new Float64Array(2);
/** Skycast: the sky behind it follows the hour and the weather; the temperature big; the hours ahead as cards. */
export function weatherApp(S: Lcd, P: Phone, world: World, t: number, now: number) {
  const R = P.radio, J = R.job?.what === 'weather' ? R.job : null, fresh = world.time - P.wxAt < 3600;
  // the sky: day blue, dusk orange, night navy; grayer the more clouds, darker in rain
  const el = sunDir(world.time, sun)[0], day = Math.max(0, Math.min(1, (el + 0.1) / 0.35)), dusk = Math.max(0, 1 - Math.abs(el) / 0.12) * 0.7;
  const w = world.weather, gray = Math.min(1, w.cloud * 0.8 + w.precip);
  let top: C3 = lerp([12, 20, 52], [52, 120, 214], day), bot: C3 = lerp([30, 44, 90], [140, 196, 248], day);
  top = lerp(top, [214, 110, 70], dusk * 0.6); bot = lerp(bot, [255, 170, 100], dusk);
  top = lerp(top, lerp([40, 44, 52], [110, 118, 130], day), gray * 0.8); bot = lerp(bot, lerp([60, 64, 74], [160, 166, 176], day), gray * 0.8);
  for (let y = 1; y < SH - 1; y++) S.fill(y, lerp(top, bot, (y - 1) / (SH - 3)));
  const bg = (y: number) => lerp(top, bot, (y - 1) / (SH - 3));
  const WHITE: C3 = [255, 255, 255], SOFT: C3 = [225, 235, 250];
  S.text(1, 1, cityName(world.city), WHITE, bg(1));
  S.text(SW - 8, 1, 'skycast', SOFT, bg(1));
  if (!fresh && (!J || J.state === 'nosignal') && !P.online()) {
    S.center(10, A.weather[0], WHITE, bg(10)); S.center(12, A.weather[1] ?? '', SOFT, bg(12));
    return softKeys(S, '', en.phone.back);
  }
  if (J && J.state !== 'done') {
    const u = Math.max(0, now - J.at);
    [`${W.attach} ...`, `${W.pdp} ...`, W.get.replace('{city}', cityName(world.city).toLowerCase().replace(/ /g, '_'))].forEach((l, k) => { if (u > k * 0.6) S.text(2, 5 + k, l, SOFT, bg(5 + k)); });
    if (J.state === 'loading') {
      const n = Math.round((J.done / J.kb) * (SW - 6));
      for (let x = 0; x < SW - 6; x++) S.put(3 + x, 10, 32, x < n ? WHITE : [255, 255, 255], x < n ? WHITE : bg(10));
      S.center(12, W.kb.replace('{a}', J.done.toFixed(1)).replace('{b}', String(J.kb)), SOFT, bg(12));
    }
    if (J.state === 'nosignal') S.center(13, W.lost, [255, 200, 190], bg(13));
    if (J.state === 'nodata') { S.center(13, W.noData, [255, 200, 190], bg(13)); S.center(15, W.buy, SOFT, bg(15)); }
    return softKeys(S, R.state === 'service' ? W.refresh : '', en.phone.back);
  }
  const base = P.wxAt, f = (c: number) => (P.prefs.temp ? Math.round(c) : Math.round(c * 1.8 + 32));
  ahead.preset = world.weather.preset;
  forecast(world.seed, base, ahead);
  const nowW = { ...ahead };
  // high and low over the next day
  let hi = -99, lo = 99;
  for (let h = 0; h <= 24; h += 3) { forecast(world.seed, base + h * 3600, ahead); hi = Math.max(hi, ahead.temp); lo = Math.min(lo, ahead.temp); }
  bigText(S, 3, `${f(nowW.temp)}${P.prefs.temp ? 'C' : 'F'}`, WHITE, t);
  S.center(11, skyWord(nowW as Weather), WHITE, bg(11));
  S.center(12, `H ${f(hi)}   L ${f(lo)}   wind ${Math.round(Math.hypot(nowW.windX, nowW.windY))} m/s`, SOFT, bg(12));
  // the hours ahead, as cards
  ([0, 3, 6, 12, 24] as const).forEach((h, k) => {
    if (t < 0.15 + k * 0.1) return;
    const at = base + h * 3600;
    forecast(world.seed, at, ahead);
    const x0 = 1 + k * 8, cardBg: C3 = lerp(bg(16), [255, 255, 255], 0.16), hr = calendar(at).hour, night = hr < 6 || hr > 19;
    for (let y = 14; y <= 20; y++) for (let x = 0; x < 7; x++) S.put(x0 + x, y, 32, cardBg, cardBg);
    const lab = h ? W.in.replace('{h}', String(h)) : W.now;
    S.text(x0 + ((7 - lab.length) >> 1), 14, lab, WHITE, cardBg);
    S.text(x0 + 1, 15, hhmm(hr).slice(0, 5), SOFT, cardBg);
    icon(ahead, night).forEach(([row, col], r) => S.text(x0 + 1, 16 + r, row.slice(0, 5), col, cardBg));
    weatherIcon(S, x0 + 1, 16, wxArt(ahead.precip, ahead.snow, ahead.cloud, night), cardBg);
    const tt = `${f(ahead.temp)}°`;
    S.text(x0 + ((7 - tt.length) >> 1), 19, tt, WHITE, cardBg);
  });
  const ph = W.phases[Math.round(moonPhase(world.time) * 8) % 8];
  S.text(1, SH - 3, `${W.moon}: ${ph}`, SOFT, bg(SH - 3));
  const up = W.updated.replace('{t}', hhmm(calendar(base).hour));
  S.text(SW - up.length - 1, SH - 3, up, SOFT, bg(SH - 3));
  softKeys(S, R.state === 'service' ? W.refresh : '', en.phone.back);
}

const PAPER: C3 = [236, 228, 208], INK: C3 = [24, 20, 16], FADED: C3 = [110, 98, 82], RULE: C3 = [150, 136, 112];
/** The news: the front page of the city's paper, the same headlines the tickers run. */
export function newsApp(S: Lcd, P: Phone, world: World, t: number, loading: boolean) {
  for (let y = 1; y < SH - 1; y++) S.fill(y, PAPER);
  const name = `THE ${cityName(world.city).toUpperCase()} COURIER`, c = calendar(world.time);
  S.center(1, name.length <= SW - 2 ? name : 'THE COURIER', INK, PAPER);
  for (let x = 0; x < SW; x++) { S.put(x, 2, ch('='), INK, PAPER); S.put(x, 4, ch('-'), RULE, PAPER); }
  const line = `${DAYS[c.weekday]}. ${MONTHS[c.month - 1]} ${c.day}, ${c.year}`;
  S.text(1, 3, line, FADED, PAPER);
  S.text(SW - 10, 3, 'LATE ED.', FADED, PAPER);
  if (loading || world.time - P.newsAt > 3600) {
    S.center(10, P.online() ? A.shop.newsWait : A.shop.newsNone, P.online() ? FADED : [170, 40, 30], PAPER);
    return softKeys(S, '', en.phone.back);
  }
  // the front page: every story under its headline; the picked one dark, OK opens it
  if (P.newsOpen) return article(S, P, world, P.newsOpen, t);
  const list = newsStories(world).filter((q) => q.kind !== 'date');
  P.newsSel = Math.max(0, Math.min(P.newsSel, list.length - 1));
  const rows: [string, number][] = [];
  let selRow = 0;
  list.forEach((q, k) => {
    if (k === P.newsSel) selRow = rows.length;
    for (const l of wrapW(q.head + (isNaN(q.x) ? '' : ' [PHOTO]'), SW - 2)) rows.push([l, k]);
    if (k < list.length - 1) rows.push(['~', -1]);
  });
  const view = SH - 7;
  // keep the picked story in view
  if (selRow < P.scroll) P.scroll = selRow;
  const selEnd = rows.findIndex((r, i) => i > selRow && r[1] !== P.newsSel);
  if ((selEnd < 0 ? rows.length : selEnd) > P.scroll + view) P.scroll = (selEnd < 0 ? rows.length : selEnd) - view;
  P.scroll = Math.max(0, Math.min(P.scroll, Math.max(0, rows.length - view)));
  rows.slice(P.scroll, P.scroll + view).forEach(([l, k], i) => {
    const y = 5 + i, pick = k === P.newsSel;
    if (l === '~') { S.center(y, '*  *  *', RULE, PAPER); return; }
    if (pick) S.fill(y, PICK);
    S.text(1, y, typed(l, t - i * 0.03, 140), pick ? PICK_INK : INK, pick ? PICK : k === 0 ? [228, 216, 190] : PAPER);
  });
  softKeys(S, W.refresh, en.phone.back);
}

/** Photos of the stories: bigger than Streetwire's (the paper's), 42 x 18. */
const PHOTO_W = 42, PHOTO_H = 18;
/**
 * Where the paper's photo of a story is taken from: a security camera near it (the still from its
 * recorder, from up on its pole or wall), else a spot on the street 20 to 40 m off, looking at it.
 */
function photoSpot(world: World, q: Story): [number, number, number, number, number, number] {
  // a substation: from its street, across the fence
  const Y = world.power.subs.find((u) => u.x === q.x && u.y === q.y)?.yard;
  if (Y) {
    const c = Math.cos(Y.a), sn = Math.sin(Y.a), half = Math.abs(c) > 0.5 ? (Y.x1 - Y.x0) / 2 : (Y.y1 - Y.y0) / 2;
    return [q.x + c * (half + 7), q.y + sn * (half + 7), Y.a + Math.PI, 1.6, 0.12, -1];
  }
  let best = -1, bd = 140;
  world.cctv.forEach((c, k) => { const d = Math.hypot(c.x - q.x, c.y - q.y); if (d < bd && d > 6) { bd = d; best = k; } });
  if (best >= 0) {
    const c = world.cctv[best];
    return [c.x, c.y, Math.atan2(q.y - c.y, q.x - c.x), c.z, -Math.atan2(c.z - 1, bd) * 0.8, best];
  }
  for (let d = 20; d <= 40; d += 5) for (let a = 0; a < 12; a++) {
    const ang = (a / 12) * Math.PI * 2 + q.key, x = q.x + Math.cos(ang) * d, y = q.y + Math.sin(ang) * d;
    if (!isSolid(world.city, x, y)) return [x, y, Math.atan2(q.y - y, q.x - x), 1.6, 0.04, -1];
  }
  return [q.x, q.y, q.key, 1.6, 0.04, -1];
}

/** A story opened: its headline, its photo (when it happened somewhere), the article and the dateline; up and down scroll. */
function article(S: Lcd, P: Phone, world: World, q: Story, t: number) {
  const rows: [string, C3, C3][] = [];
  for (const l of wrapW(q.head, SW - 2)) rows.push([l, INK, [228, 216, 190]]);
  rows.push(['', INK, PAPER]);
  let photoAt = -1, cam = -1;
  if (!isNaN(q.x)) {
    photoAt = rows.length;
    for (let r = 0; r < PHOTO_H; r++) rows.push(['', INK, PAPER]);
    cam = photoSpot(world, q)[5];
    rows.push([cam >= 0 ? `Security camera still, CAM ${String(cam + 1).padStart(2, '0')}` : 'Courier photo', FADED, PAPER]);
    rows.push(['', INK, PAPER]);
  }
  for (const para of storyBody(world, q)) { for (const l of wrapW(para, SW - 2)) rows.push([l, INK, PAPER]); rows.push(['', INK, PAPER]); }
  const c = calendar(q.at);
  rows.push([`${cityName(world.city).toUpperCase()}, ${MONTHS[c.month - 1]} ${c.day}`, FADED, PAPER]);
  const view = SH - 7;
  P.scroll = Math.max(0, Math.min(P.scroll, Math.max(0, rows.length - view)));
  rows.slice(P.scroll, P.scroll + view).forEach(([l, fg, bg], i) => { if (bg !== PAPER) S.fill(5 + i, bg); S.text(1, 5 + i, typed(l, t - i * 0.02, 160), fg, bg); });
  if (photoAt >= 0) {
    const [x, y, yaw, eye, pitch] = photoSpot(world, q), pic = takePic(P, 0x7e000000 + q.key * 8 + (q.kind === 'crash' ? 1 : q.kind === 'jam' ? 2 : q.kind === 'blackout' ? 3 : 4), x, y, yaw, PHOTO_W, PHOTO_H, eye, pitch);
    for (let r = 0; r < PHOTO_H; r++) {
      const yy = 5 + photoAt + r - P.scroll;
      if (yy < 5 || yy >= 5 + view) continue;
      for (let cx = 0; cx < PHOTO_W && cx < SW; cx++) {
        if (!pic) { S.put(cx, yy, 32, FADED, [200, 192, 172]); continue; }
        const o = (r * pic.w + cx) * 4;
        S.put(cx, yy, 32, [pic.cells[o + 1], pic.cells[o + 2], pic.cells[o + 3]], [pic.bg[o], pic.bg[o + 1], pic.bg[o + 2]]);
        for (let iy = 0; iy < HD; iy++) for (let ix = 0; ix < HD; ix++) {
          const h = ((r * HD + iy) * pic.w * HD + cx * HD + ix) * 3;
          S.pixel(cx, yy, ix, iy, pic.hd[h], pic.hd[h + 1], pic.hd[h + 2]);
        }
      }
    }
  }
  softKeys(S, '', en.phone.back);
}

function wrapW(s: string, w: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of s.split(' ')) {
    if (line && line.length + 1 + word.length > w) { out.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(line);
  return out;
}
