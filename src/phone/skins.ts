import en from '../locale/en.json';
import { cityName } from '../locale/names';
import { tickerText } from '../locale/news';
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
/** A little picture of the weather, 5 cells by 2. */
function icon(w: Weather, night: boolean): [string, string, C3] {
  if (w.precip > 0.02) return w.snow ? ['(___)', ' * * ', [235, 240, 255]] : w.precip > 0.75 ? ['(___)', ' /// ', [255, 230, 120]] : ['(___)', ' / / ', [170, 210, 255]];
  if (w.cloud > 0.75) return [' .-. ', '(___)', [225, 230, 238]];
  if (w.cloud > 0.35) return night ? [' (  .', '(___)', [225, 230, 238]] : ['\\|.-.', '(___)', [255, 220, 110]];
  return night ? ['  _  ', ' ((  ', [240, 235, 200]] : [' \\|/ ', '-( )-', [255, 220, 90]];
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
    const [a, b, col] = icon(ahead, night);
    S.text(x0 + 1, 16, a, col, cardBg); S.text(x0 + 1, 17, b, col, cardBg);
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
  const heads = tickerText(world).split(en.news.sep).map((h) => h.trim()).filter(Boolean);
  const rows: [string, C3, boolean][] = [];
  heads.forEach((h, k) => {
    for (const l of wrapW(h, SW - 2)) rows.push([l, INK, k === 0]);
    rows.push([k === 0 ? '' : '', INK, false]);
    if (k < heads.length - 1) rows.push(['~'.repeat(8), RULE, false]);
  });
  const view = SH - 7;
  P.scroll = Math.max(0, Math.min(P.scroll, Math.max(0, rows.length - view)));
  rows.slice(P.scroll, P.scroll + view).forEach(([l, col, lead], k) => {
    const y = 5 + k;
    if (l.startsWith('~')) { S.center(y, '*  *  *', col, PAPER); return; }
    S.text(1, y, typed(l, t - k * 0.03, 140), col, lead ? [228, 216, 190] : PAPER);
  });
  softKeys(S, W.refresh, en.phone.back);
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
