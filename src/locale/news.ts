import { hash3 } from '../core/rng';
import { districtAt } from '../sim/city';
import { calendar } from '../sim/clock';
import { forecast, newWeather } from '../sim/weather';
import { type World } from '../sim/world';
import en from './en.json';
import { businessName, cityName, districtName, landmarkName, roadName, seamName } from './names';

/**
 * Headlines for the news tickers. What really goes on comes first, read from the sim: a substation
 * down or just back (by district), the weather now and the forecast for tonight, the date. Then
 * flavor stories, a few per game hour, filled with names that exist in the city. The stage 12 event
 * queue will feed the same ticker with real accidents and jams.
 */
const N = en.news;
const ahead = newWeather();
let key = '', text = '';

/** Seconds of real time a restored substation stays in the news. */
const RESTORED_NEWS = 120;

export function tickerText(world: World): string {
  const { city, power } = world;
  const hour = Math.floor(world.time / 3600);
  const recent = (s: { changed: number }) => s.changed >= 0 && world.tick - s.changed < RESTORED_NEWS * 60;
  const k = `${hour}|${power.subs.map((s) => (s.on ? (recent(s) ? 2 : 1) : 0)).join('')}|${world.weather.preset}`;
  if (k === key) return text;
  key = k;
  const pick = <T>(a: T[], j: number) => a[Math.floor(hash3(world.seed, hour, j) * a.length)];
  const items: string[] = [];
  power.subs.forEach((s, j) => {
    const d = districtName(city, districtAt(city, s.x, s.y)).toUpperCase();
    if (!s.on) items.push(pick(N.blackout, 100 + j).replace('{district}', d));
    else if (recent(s)) items.push(pick(N.restored, 200 + j).replace('{district}', d));
  });
  const W = world.weather, c = calendar(world.time);
  ahead.preset = W.preset;
  forecast(world.seed, world.time + 6 * 3600, ahead);
  items.push(N.weather.replace('{city}', cityName(city).toUpperCase()).replace('{now}', sky(W)).replace('{temp}', String(Math.round(W.temp * 1.8 + 32))).replace('{later}', sky(ahead)));
  items.push(N.date.replace('{wd}', N.weekdays[c.weekday]).replace('{mon}', N.months[c.month - 1]).replace('{d}', String(c.day)).replace('{y}', String(c.year)));
  const nAve = city.xb.length / 2, nSt = city.yb.length / 2, first = Math.floor(hash3(world.seed, hour, 0) * N.flavor.length);
  for (let j = 0; j < 5; j++) {
    const h = (q: number) => hash3(world.seed, hour * 8 + j, q);
    const avenue = h(1) < 0.5;
    // five different stories (7 steps through the list never repeats within it)
    items.push(N.flavor[(first + j * 7) % N.flavor.length]
      .replace('{biz}', city.businesses.length ? businessName(city, Math.floor(h(2) * city.businesses.length)).toUpperCase() : 'LOCAL SHOP')
      .replace('{road}', roadName(city, avenue, Math.floor(h(3) * (avenue ? nAve : nSt))).toUpperCase())
      .replace('{district}', districtName(city, Math.floor(h(4) * city.districts.length)).toUpperCase())
      .replace('{landmark}', city.landmarks.length ? landmarkName(city, Math.floor(h(5) * city.landmarks.length)).toUpperCase() : 'CITY HALL')
      .replace('{seam}', seamName(city).toUpperCase())
      .replace('{n}', String(18 + (city.nameSeed % 30)))
      .replace('{m}', String(2 + Math.floor(h(6) * 40)))
      .replace('{p}', (1.5 + Math.floor(h(7) * 6) * 0.25).toFixed(2))
      .replace('{o}', String(90 + Math.floor(h(8) * 50))));
  }
  text = items.join(N.sep) + N.sep;
  return text;
}

function sky(w: { cloud: number; precip: number; snow: boolean }): string {
  const S = N.sky;
  if (w.precip > 0.02) return w.snow ? S.snow : w.precip > 0.75 ? S.storm : w.precip < 0.25 ? S.drizzle : S.rain;
  return w.cloud > 0.7 ? S.cloudy : S.clear;
}
