import { wxArt, wxColors } from './hdicons';
import { articleLines, paintNewsArticle, paintNewsFront, paintWeather, type NewsArticle, type NewsFront, type Weather as WeatherPage } from './pixpages';
import { type Paint } from '../render/paint2d';
import en from '../locale/en.json';
import { cityName } from '../locale/names';
import { newsStories, storyBody, type Story } from '../locale/news';
import { HD } from '../render/hd';
import { isSolid } from '../sim/city';
import { takePic } from './wire';
import { calendar, moonPhase, sunDir } from '../sim/clock';
import { forecast, newWeather, type Weather } from '../sim/weather';
import { type World } from '../sim/world';
import { type C3, hhmm, type Lcd, MONTHS, DAYS, softKeys } from './lcd';
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
const ahead: Weather = newWeather(), sun = new Float64Array(2);
/** Skycast: the sky behind it follows the hour and the weather; the temperature big; the hours ahead as cards. */
/** The weather (Skycast), painted in pixels by pixpages.ts paintWeather: the sky of the hour, then the forecast that came down, the download, or why there is none. */
export function weatherApp(S: Lcd, P: Phone, world: World, t: number, now: number): (Pt: Paint) => void {
  const R = P.radio, J = R.job?.what === 'weather' ? R.job : null, fresh = world.time - P.wxAt < 3600;
  // the sky: day blue, dusk orange, night navy; grayer the more clouds, darker in rain
  const el = sunDir(world.time, sun)[0], day = Math.max(0, Math.min(1, (el + 0.1) / 0.35)), dusk = Math.max(0, 1 - Math.abs(el) / 0.12) * 0.7;
  const w = world.weather, gray = Math.min(1, w.cloud * 0.8 + w.precip);
  let top: C3 = lerp([12, 20, 52], [52, 120, 214], day), bot: C3 = lerp([30, 44, 90], [140, 196, 248], day);
  top = lerp(top, [214, 110, 70], dusk * 0.6); bot = lerp(bot, [255, 170, 100], dusk);
  top = lerp(top, lerp([40, 44, 52], [110, 118, 130], day), gray * 0.8); bot = lerp(bot, lerp([60, 64, 74], [160, 166, 176], day), gray * 0.8);
  const d: WeatherPage = { city: cityName(world.city), brand: 'skycast', top, bot, t, msg: [], log: [], bar: -1, kb: '', warn: [], now: null, cards: [], moon: '', updated: '' };
  const page = (Pt: Paint) => paintWeather(Pt, d);
  softKeys(S, R.state === 'service' ? W.refresh : '', en.phone.back);
  if (!fresh && (!J || J.state === 'nosignal') && !P.online()) { d.msg = [A.weather[0], A.weather[1] ?? '']; softKeys(S, '', en.phone.back); return page; }
  if (J && J.state !== 'done') {
    const u = Math.max(0, now - J.at);
    d.log = [`${W.attach} ...`, `${W.pdp} ...`, W.get.replace('{city}', cityName(world.city).toLowerCase().replace(/ /g, '_'))].filter((_, k) => u > k * 0.6);
    if (J.state === 'loading') { d.bar = J.done / J.kb; d.kb = W.kb.replace('{a}', J.done.toFixed(1)).replace('{b}', String(J.kb)); }
    if (J.state === 'nosignal') d.warn = [W.lost];
    if (J.state === 'nodata') d.warn = [W.noData, W.buy];
    return page;
  }
  const base = P.wxAt, f = (c: number) => (P.prefs.temp ? Math.round(c) : Math.round(c * 1.8 + 32)), night = (at: number) => { const hr = calendar(at).hour; return hr < 6 || hr > 19; };
  ahead.preset = world.weather.preset;
  forecast(world.seed, base, ahead);
  const nowW = { ...ahead };
  // high and low over the next day
  let hi = -99, lo = 99;
  for (let h = 0; h <= 24; h += 3) { forecast(world.seed, base + h * 3600, ahead); hi = Math.max(hi, ahead.temp); lo = Math.min(lo, ahead.temp); }
  d.now = { art: wxColors(wxArt(nowW.precip, nowW.snow, nowW.cloud, night(base))), temp: String(f(nowW.temp)), unit: P.prefs.temp ? '°C' : '°F', sky: skyWord(nowW as Weather),
    line: `H ${f(hi)}°   L ${f(lo)}°   wind ${Math.round(Math.hypot(nowW.windX, nowW.windY))} m/s` };
  // the hours ahead, as cards
  d.cards = ([0, 3, 6, 12, 24] as const).map((h) => {
    const at = base + h * 3600;
    forecast(world.seed, at, ahead);
    return { label: h ? W.in.replace('{h}', String(h)) : W.now, hour: hhmm(calendar(at).hour).slice(0, 5), art: wxColors(wxArt(ahead.precip, ahead.snow, ahead.cloud, night(at))), temp: `${f(ahead.temp)}°` };
  });
  d.moon = `${W.moon}: ${W.phases[Math.round(moonPhase(world.time) * 8) % 8]}`;
  d.updated = W.updated.replace('{t}', hhmm(calendar(base).hour));
  return page;
}

/** The news: the front page of the city's paper, the same headlines the tickers run. */
export function newsApp(S: Lcd, P: Phone, world: World, t: number, loading: boolean): (Pt: Paint) => void {
  const full = `THE ${cityName(world.city).toUpperCase()} COURIER`, c = calendar(world.time);
  const name = full.length <= 36 ? full : 'THE COURIER', date = `${DAYS[c.weekday]}. ${MONTHS[c.month - 1]} ${c.day}, ${c.year}`, ed = 'LATE ED.';
  if (loading || world.time - P.newsAt > 3600) {
    softKeys(S, '', en.phone.back);
    const d: NewsFront = { name, date, ed, wait: P.online() ? A.shop.newsWait : A.shop.newsNone, bad: !P.online(), stories: [], t };
    return (Pt) => paintNewsFront(Pt, d);
  }
  if (P.newsOpen) return article(S, P, world, P.newsOpen, t, name, date, ed);
  // the front page: every story under its headline; the picked one dark, OK (or a second touch) opens it
  const list = newsStories(world).filter((q) => q.kind !== 'date');
  P.newsSel = Math.max(0, Math.min(P.newsSel, list.length - 1));
  const stories = list.map((q, k) => ({ lines: wrapW(q.head, 30), photo: !isNaN(q.x), sel: k === P.newsSel, pre: () => { P.newsSel = k; } }));
  softKeys(S, W.refresh, en.phone.back);
  const d: NewsFront = { name, date, ed, wait: '', bad: false, stories, t };
  return (Pt) => paintNewsFront(Pt, d);
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
function article(S: Lcd, P: Phone, world: World, q: Story, t: number, name: string, date: string, ed: string): (Pt: Paint) => void {
  const head = wrapW(q.head, 30), body: string[] = [];
  for (const para of storyBody(world, q)) { body.push(...wrapW(para, 36), ''); }
  const hasPhoto = !isNaN(q.x);
  let photo: NewsArticle['photo'] = null, caption = '';
  if (hasPhoto) {
    const [x, y, yaw, eye, pitch, cam] = photoSpot(world, q);
    const pic = takePic(P, 0x7e000000 + q.key * 8 + (q.kind === 'crash' ? 1 : q.kind === 'jam' ? 2 : q.kind === 'blackout' ? 3 : 4), x, y, yaw, PHOTO_W, PHOTO_H, eye, pitch);
    if (pic) photo = { hd: pic.hd, w: pic.w * HD, h: pic.h * HD };
    caption = cam >= 0 ? `Security camera still, CAM ${String(cam + 1).padStart(2, '0')}` : 'Courier photo';
  }
  const c = calendar(q.at), d: NewsArticle = { name, date, ed, head, photo, hasPhoto, caption, body, dateline: `${cityName(world.city).toUpperCase()}, ${MONTHS[c.month - 1]} ${c.day}`, scroll: 0, t };
  // up and down scroll, a line at a time, to the end
  const view = 24;
  P.scroll = Math.max(0, Math.min(P.scroll, Math.max(0, articleLines(d) - view)));
  d.scroll = P.scroll;
  softKeys(S, '', en.phone.back);
  return (Pt) => paintNewsArticle(Pt, d);
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
