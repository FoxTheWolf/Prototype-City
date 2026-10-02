import { hash3 } from '../core/rng';
import { districtAt, type City } from '../sim/city';
import { calendar } from '../sim/clock';
import { forecast, newWeather } from '../sim/weather';
import { type World } from '../sim/world';
import en from './en.json';
import { businessName, cityName, districtName, landmarkName, roadName, seamName } from './names';
import { expand, Fresh, selOf } from './gen';
import { momentTags } from './voice';
import { makerName } from './names';
import { TEXT } from './text';

/**
 * Headlines for the news tickers. What really goes on comes first, read from the sim: a substation
 * down or just back (by district), the weather now and the forecast for tonight, the date. Then
 * flavor stories, a few per game hour, filled with names that exist in the city. The stage 12 event
 * queue will feed the same ticker with real accidents and jams.
 */
const N = en.news;
/**
 * Flavor headlines by subject (city, crime, economy, business, transit, fire, tech, culture,
 * sports, health, world, odd, night), for the tickers now and later for papers, radio and the
 * social network; and all of them in one list.
 */
export const FLAVOR_BY: Record<string, string[]> = N.flavor;
export const FLAVOR: string[] = Object.values(FLAVOR_BY).flat();

const ordinal = (n: number) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'TH' : (['TH', 'ST', 'ND', 'RD'][n % 10] ?? 'TH'));

/**
 * A headline template filled with names that exist in the city, upper case. `h(q)` gives the
 * story's random numbers (0..1), so the same story always reads the same.
 */
export function fillHeadline(city: City, tpl: string, h: (q: number) => number): string {
  const nAve = city.xb.length / 2, nSt = city.yb.length / 2, avenue = h(1) < 0.5, n = 18 + (city.nameSeed % 30);
  return tpl
    .replace('{biz}', city.businesses.length ? businessName(city, Math.floor(h(2) * city.businesses.length)).toUpperCase() : 'LOCAL SHOP')
    .replace('{road}', roadName(city, avenue, Math.floor(h(3) * (avenue ? nAve : nSt))).toUpperCase())
    .replace('{district}', districtName(city, Math.floor(h(4) * city.districts.length)).toUpperCase())
    .replace('{landmark}', city.landmarks.length ? landmarkName(city, Math.floor(h(5) * city.landmarks.length)).toUpperCase() : 'CITY HALL')
    .replace('{seam}', seamName(city).toUpperCase())
    .replace('{city}', cityName(city).toUpperCase())
    .replace('{nth}', ordinal(n))
    .replace('{n}', String(n))
    .replace('{m}', String(2 + Math.floor(h(6) * 40)))
    .replace('{p}', (1.5 + Math.floor(h(7) * 6) * 0.25).toFixed(2))
    .replace('{o}', String(90 + Math.floor(h(8) * 50)));
}
/**
 * A headline put together by the news grammar (locale/text/news.en.json: subjects, verbs, things
 * by section, filled with the city's names), never the same twice in a session.
 */
const freshNews = new Fresh(4000);
export function madeHeadline(city: City, seed: number, a: number, b: number, t = 0): string {
  // the stories of the year, by the month (the crash in the fall, the games in August), or the city's own
  const sel = selOf(momentTags(t), 0);
  return freshNews.take((r) => {
    const h = (q: number) => hash3(Math.floor(r() * 1e9), q, 0x4e5);
    const nb = city.businesses.length;
    const tpl = expand(r() < 0.45 ? '#hl2008#' : '#hl#', TEXT, r, {
      biz2: nb ? businessName(city, Math.floor(r() * nb)).toUpperCase() : 'THE CORNER DELI',
      weekday: N.weekdays[Math.floor(r() * 7)],
      maker: makerName(city, Math.floor(r() * 3)).toUpperCase(),
    }, sel);
    return fillHeadline(city, tpl, h).toUpperCase();
  }, seed, a, b);
}
const ahead = newWeather();
let key = '', text = '';

/** Seconds of real time a restored substation stays in the news. */
const RESTORED_NEWS = 120;
/** Seconds of real time a traffic jam stays in the news. */
const JAM_NEWS = 180;

export function tickerText(world: World): string {
  const { city, power } = world;
  const hour = Math.floor(world.time / 3600);
  const recent = (s: { changed: number }) => s.changed >= 0 && world.tick - s.changed < RESTORED_NEWS * 60;
  // jams from the event queue, while they are fresh
  const jams = world.events.list.filter((e) => (e.kind === 'jam' || e.kind === 'crash') && world.tick - e.tick < JAM_NEWS * 60);
  const k = `${hour}|${power.subs.map((s) => (s.on ? (recent(s) ? 2 : 1) : 0)).join('')}|${world.weather.preset}|${jams.map((e) => e.id).join()}`;
  if (k === key) return text;
  key = k;
  const pick = <T>(a: T[], j: number) => a[Math.floor(hash3(world.seed, hour, j) * a.length)];
  const items: string[] = [];
  power.subs.forEach((s, j) => {
    const d = districtName(city, districtAt(city, s.x, s.y)).toUpperCase();
    if (!s.on) items.push(pick(N.blackout, 100 + j).replace('{district}', d));
    else if (recent(s)) items.push(pick(N.restored, 200 + j).replace('{district}', d));
  });
  for (const e of jams.slice(-3)) {
    const [i, j, hd] = e.refs, avenue = (hd & 1) === 1;
    items.push(pick(e.kind === 'crash' ? N.crash : N.jam, 300 + e.id).replace('{road}', roadName(city, avenue, avenue ? i : j).toUpperCase()).replace('{cross}', roadName(city, !avenue, avenue ? j : i).toUpperCase()));
  }
  const W = world.weather, c = calendar(world.time);
  ahead.preset = W.preset;
  forecast(world.seed, world.time + 6 * 3600, ahead);
  items.push(N.weather.replace('{city}', cityName(city).toUpperCase()).replace('{now}', sky(W)).replace('{temp}', String(Math.round(W.temp * 1.8 + 32))).replace('{later}', sky(ahead)));
  items.push(N.date.replace('{wd}', N.weekdays[c.weekday]).replace('{mon}', N.months[c.month - 1]).replace('{d}', String(c.day)).replace('{y}', String(c.year)));
  const first = Math.floor(hash3(world.seed, hour, 0) * FLAVOR.length);
  // five different stories (11 steps through the list never repeat within it: 11 and its length are coprime)
  // half from the written stories, half put together by the grammar
  for (let j = 0; j < 5; j++) items.push(j & 1 ? madeHeadline(city, world.seed, hour, j, world.time) : fillHeadline(city, FLAVOR[(first + j * 11) % FLAVOR.length], (q) => hash3(world.seed, hour * 8 + j, q)));
  text = items.join(N.sep) + N.sep;
  return text;
}

function sky(w: { cloud: number; precip: number; snow: boolean }): string {
  const S = N.sky;
  if (w.precip > 0.02) return w.snow ? S.snow : w.precip > 0.75 ? S.storm : w.precip < 0.25 ? S.drizzle : S.rain;
  return w.cloud > 0.7 ? S.cloudy : S.clear;
}
