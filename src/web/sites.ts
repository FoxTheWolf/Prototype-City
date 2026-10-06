/**
 * The city's web (15.1): every site exists from the start, made from the simulation by the seed
 * (the player is just one more visitor). The portal of the city's internet provider (the start page:
 * the headlines of the news queue, the weather, a directory of the businesses) and a site for most
 * businesses (the small ones often have none): its name, colors, logo and layout picked by the seed
 * from a few templates, its contents true to the city (opening hours, the address by its streets,
 * the phone number, what it sells and for how much, who works there). A site is served from its
 * business's building: a blackout there takes it down.
 */
import { hash3 } from '../core/rng';
import { nearestRoad, type BusinessKind } from '../sim/city';
import { subAt } from '../sim/power';
import { PLACES } from '../sim/placeTypes';
import { formatNumber } from '../sim/telco';
import { calendar } from '../sim/clock';
import { type World } from '../sim/world';
import { placeAt } from '../phone/places';
import { businessName, cityName, citizenNames, districtName, roadName } from '../locale/names';
import { expand, rngOf, tidy } from '../locale/gen';
import { TEXT } from '../locale/text';
import { newsStories, storyBody } from '../locale/news';
import { districtAt } from '../sim/city';
import en from '../locale/en.json';
import { type Block, type C3, type Page, type Theme } from './page';

/** A hostname as written: lowercase letters and digits. */
const slug = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');

/** The share of each kind of business that has a site (in 2008 the corner shops mostly had none). */
const ONLINE: Partial<Record<BusinessKind, number>> = { bank: 1, hotel: 0.95, cinema: 1, electronics: 0.9, phones: 0.9, cyber: 0.95, motel: 0.5, pizza: 0.6, fastfood: 0.8, bar: 0.5, diner: 0.45, cafe: 0.55, books: 0.6, pharmacy: 0.7, autoparts: 0.6, grocery: 0.4, liquor: 0.35, pawn: 0.4, tailor: 0.25, laundry: 0.2, deli: 0.25, parking: 0.3 };

/** The colors of 2008's sites: page, paper, ink, dim, link, banner, banner ink, bar, bar ink. */
const THEMES: Theme[] = [
  { page: [200, 200, 204], bg: [255, 255, 255], fg: [30, 30, 34], dim: [120, 120, 128], link: [0, 0, 204], head: [24, 52, 112], headFg: [255, 255, 255], bar: [214, 226, 246], barFg: [20, 40, 100] },
  { page: [60, 30, 20], bg: [252, 244, 224], fg: [50, 30, 20], dim: [140, 110, 90], link: [170, 40, 20], head: [140, 30, 20], headFg: [255, 236, 190], bar: [230, 200, 140], barFg: [90, 30, 10] },
  { page: [0, 0, 0], bg: [16, 16, 20], fg: [210, 210, 210], dim: [110, 110, 120], link: [120, 200, 255], head: [0, 0, 0], headFg: [255, 120, 0], bar: [40, 40, 48], barFg: [255, 170, 60] },
  { page: [214, 230, 214], bg: [255, 255, 250], fg: [20, 50, 30], dim: [100, 130, 110], link: [0, 110, 60], head: [30, 110, 60], headFg: [240, 255, 240], bar: [200, 230, 200], barFg: [20, 80, 40] },
  { page: [236, 236, 236], bg: [255, 255, 255], fg: [40, 40, 40], dim: [140, 140, 140], link: [200, 0, 90], head: [255, 255, 255], headFg: [200, 0, 90], bar: [60, 60, 60], barFg: [255, 255, 255] },
  { page: [0, 0, 80], bg: [0, 0, 120], fg: [255, 255, 0], dim: [170, 170, 255], link: [0, 255, 255], head: [120, 0, 120], headFg: [255, 255, 255], bar: [0, 0, 60], barFg: [0, 255, 0] },
  { page: [90, 90, 96], bg: [240, 240, 244], fg: [30, 30, 40], dim: [120, 120, 130], link: [40, 90, 180], head: [50, 56, 66], headFg: [255, 210, 80], bar: [80, 86, 96], barFg: [240, 240, 240] },
  { page: [250, 230, 200], bg: [255, 250, 240], fg: [60, 40, 20], dim: [150, 120, 90], link: [200, 90, 0], head: [230, 120, 20], headFg: [255, 255, 255], bar: [250, 210, 150], barFg: [110, 50, 0] },
];
/** The portal's own: the provider's blue. */
const PORTAL: Theme = { page: [180, 196, 220], bg: [255, 255, 255], fg: [24, 24, 32], dim: [110, 116, 130], link: [0, 51, 153], head: [0, 51, 153], headFg: [255, 255, 255], bar: [255, 204, 0], barFg: [0, 30, 90] };

/** A logo of a few lines for each kind of place (the sites' "images", drawn in characters). */
const ICONS: Partial<Record<BusinessKind | 'any', string[]>> = {
  cafe: [' ( (  ', '  ) ) ', '|____|>', ' \\__/ '],
  diner: [' _____ ', '|DINER|', '|_____|', ' O   O '],
  pizza: ['  /\\  ', ' /o.\\ ', '/.o.o\\', '------'],
  bar: [' _____ ', ' \\   / ', '  \\ /  ', '  _|_  '],
  bank: ['  /\\  ', ' /$$\\ ', '|_||_|', '======'],
  phones: [' ___ ', '|[_]|', '|:::|', '|___|'],
  electronics: [' ____ ', '|    |', '|____|', ' /__\\ '],
  cyber: [' ____ ', '|>_  |', '|____|', '[####]'],
  hotel: [' _H_ ', '|o o|', '|o o|', '|_n_|'],
  books: [' ____ ', '|||||\\', '|||||/', ' ---- '],
  pharmacy: ['  _  ', ' | | ', '|+ +|', ' |_| '],
  any: [' ____ ', '| ** |', '|____|'],
};

export type SiteRef = { kind: 'portal' } | { kind: 'biz'; k: number };
export interface Web { hosts: Map<string, SiteRef>; byBiz: Map<number, string>; portal: string }

const webs = new WeakMap<object, Web>();
/** The city's sites by hostname (made once per city). */
export function webOf(w: World): Web {
  let W = webs.get(w.city);
  if (W) return W;
  const c = w.city, hosts = new Map<string, SiteRef>(), byBiz = new Map<number, string>();
  const portal = `www.${slug(cityName(c))}online.com`;
  hosts.set(portal, { kind: 'portal' });
  c.businesses.forEach((b, k) => {
    const head = b.hq ?? k;
    if (head !== k) { const h = byBiz.get(head); if (h) byBiz.set(k, h); return; }
    if (hash3(w.seed, k, 0x5173) >= (ONLINE[b.kind] ?? 0.4)) return;
    let host = `www.${slug(businessName(c, k))}.com`;
    if (hosts.has(host)) host = `www.${slug(businessName(c, k))}${slug(districtName(c, districtAt(c, ...placeAt(c, k))))}.com`;
    if (hosts.has(host)) return;
    hosts.set(host, { kind: 'biz', k }); byBiz.set(k, host);
  });
  W = { hosts, byBiz, portal };
  webs.set(c, W);
  return W;
}

export interface Fetched { host: string; path: string; page?: Page; error?: 'dns' | 'down' }

/** What asking for `url` brings: the page, or why not (no such host; the server is down). */
export function fetchUrl(w: World, url: string): Fetched {
  const u = url.trim().toLowerCase().replace(/^https?:\/\//, '');
  let host = u.split('/')[0], path = '/' + u.split('/').slice(1).join('/');
  if (!host.includes('.')) host = `www.${host}.com`;
  if (!host.startsWith('www.') && !webOf(w).hosts.has(host)) host = 'www.' + host;
  path = path.replace(/\/+$/, '') || '/';
  const S = webOf(w).hosts.get(host);
  if (!S) return { host, path, error: 'dns' };
  if (S.kind === 'biz') {
    const [x, y] = placeAt(w.city, S.k);
    if (!w.power.subs[subAt(w.power, w.city, x, y)].on) return { host, path, error: 'down' };
    return { host, path, page: bizPage(w, S.k, host, path) };
  }
  return { host, path, page: portalPage(w, host, path) };
}

/** The address of business k as one would write it: on its street, at the nearest corner. */
export function addressOf(w: World, k: number): string {
  const c = w.city, [x, y] = placeAt(c, k);
  const i = nearestRoad(c.xb, c.xCell, x), j = nearestRoad(c.yb, c.yCell, y);
  const onAve = Math.abs((c.xb[2 * i] + c.xb[2 * i + 1]) / 2 - x) < Math.abs((c.yb[2 * j] + c.yb[2 * j + 1]) / 2 - y);
  return onAve ? `${roadName(c, true, i)} at ${roadName(c, false, j)}` : `${roadName(c, false, j)} at ${roadName(c, true, i)}`;
}

const hh = (h: number) => (h % 24 === 0 ? 'midnight' : h % 24 === 12 ? 'noon' : `${((h + 11) % 12) + 1} ${h % 24 < 12 ? 'am' : 'pm'}`);
const money = (c: number) => `$${(c / 100).toFixed(2)}`;

/** A page of business k's site. */
function bizPage(w: World, k: number, host: string, path: string): Page {
  const c = w.city, b = c.businesses[k], P = w.pop, h = (q: number) => hash3(w.seed, k, q), name = businessName(c, k);
  const theme = THEMES[Math.floor(h(1) * THEMES.length)], tpl = Math.floor(h(2) * 3), year = String(1958 + Math.floor(h(3) * 48));
  const r = rngOf(w.seed, k, 0xb10b), district = districtName(c, districtAt(c, ...placeAt(c, k)));
  const say = (key: string, ctx: Record<string, string> = {}) => tidy(expand(`#${key}#`, TEXT, r, { biz: name, district, year, city: cityName(c), ...ctx }));
  const T = PLACES[b.kind], goods = en.goods as Record<string, string>;
  const food = !!T.order, list = food ? 'menu' : 'products';
  const nav: [string, string][] = [['Home', `http://${host}/`], [food ? 'Menu' : 'Products', `http://${host}/${list}`], ['About Us', `http://${host}/about`], ['Contact', `http://${host}/contact`]];
  const [o, z] = T.hours, open = o === 0 && z === 24 ? 'Open 24 hours' : `${b.kind === 'bank' ? 'Mon-Fri' : 'Daily'} ${hh(o)} - ${hh(z)}`;
  const phone = formatNumber(w.telco, w.telco.bizNum[k]), addr = addressOf(w, k);
  const banner: Block = { t: 'banner', text: name, sub: `Since ${year} - ${district}`, art: ICONS[b.kind] ?? ICONS.any };
  // last touched some days ago (never before the calendar starts, 2008-01-01: an older one says so in words)
  const ago = Math.floor(h(4) * 400) * 86400, D = calendar(Math.max(0, w.time - ago));
  const updated = say('web.updated', { date: w.time - ago < 0 ? 'in 2007' : `${D.month}/${D.day}/${String(D.year).slice(2)}` });
  const counter = say('web.visitors', { n: String(1000 + Math.floor(h(5) * 90000)).padStart(6, '0') });
  const foot: Block = { t: 'foot', text: `(c) ${D.year} ${name} - ${addr} - ${phone}` };
  let body: Block[];
  switch (path) {
    case '/': {
      const info: Block[] = [{ t: 'h', text: 'Hours' }, { t: 'p', text: open }, { t: 'h', text: 'Find us' }, { t: 'p', text: `${addr}, ${district}` }, { t: 'p', text: `Call ${phone}` }];
      const main: Block[] = [{ t: 'h', text: say('web.welcome') }, { t: 'p', text: say(`web.intro.${b.kind}`) }, { t: 'p', text: `See our [${food ? 'menu' : 'products'}](http://${host}/${list}) or [get in touch](http://${host}/contact).` }];
      body = tpl === 1 ? [{ t: 'cols', cols: [main, info], widths: [0.66, 0.34] }]
        : tpl === 2 ? [{ t: 'space' }, ...main, { t: 'hr' }, ...info, { t: 'p', text: counter }]
        : [...main, { t: 'hr' }, { t: 'cols', cols: [info.slice(0, 2), info.slice(2)] }];
      break;
    }
    case `/${list}`:
      body = [{ t: 'h', text: food ? 'Our Menu' : 'Products & Prices' }, { t: 'table', head: true, rows: [['Item', 'Price'], ...T.sells.map(([g, p]) => [goods[g] ?? g.replace(/_/g, ' '), money(p)])] }, { t: 'p', text: food ? 'Prices include tax. Ask about our daily specials!' : 'Prices subject to change. Come see the full selection in store.' }];
      break;
    case '/about': {
      const W = P.workplaces.find((x) => x.biz === k), staff = (W?.staff ?? []).slice(0, 5).map((i) => citizenNames(c, P, i)[0]);
      body = [{ t: 'h', text: `About ${name}` }, { t: 'p', text: say('web.about') }, ...(staff.length ? [{ t: 'p', text: say('web.team', { staff: staff.join(', ') }) } as Block] : [])];
      break;
    }
    case '/contact':
      body = [{ t: 'h', text: 'Contact Us' }, { t: 'table', rows: [['Address', `${addr}, ${district}`], ['Phone', phone], ['Hours', open]] }, { t: 'p', text: 'We do not take reservations or orders by e-mail.' }];
      break;
    default:
      body = [{ t: 'h', text: '404 - Page Not Found' }, { t: 'p', text: `The page you requested could not be found. Go back to the [home page](http://${host}/).` }];
  }
  const blocks: Block[] = tpl === 2 ? [banner, ...body, { t: 'nav', links: nav }, { t: 'p', text: updated }, foot] : [banner, { t: 'nav', links: nav }, ...body, { t: 'p', text: updated }, foot];
  return { url: `http://${host}${path}`, title: path === '/' ? name : `${name} - ${path.slice(1)}`, theme, blocks, kb: 30 + Math.floor(h(6) * 60) };
}

/** A page of the provider's portal: the start page, a story, the weather, the directory. */
function portalPage(w: World, host: string, path: string): Page {
  const c = w.city, city = cityName(c), r = rngOf(w.seed, 0x9047, Math.floor(w.time / 3600)), Wb = webOf(w);
  const nav: [string, string][] = [['Home', `http://${host}/`], ['News', `http://${host}/news`], ['Weather', `http://${host}/weather`], ['Directory', `http://${host}/directory`]];
  const banner: Block = { t: 'banner', text: `${city} Online`, sub: tidy(expand('#web.portal.tagline#', TEXT, r, { city })), art: [' .--. ', '( @@ )', " '--' "] };
  const stories = newsStories(w), W = w.weather, f = (t: number) => Math.round(t * 1.8 + 32);
  const D = calendar(w.time), date = `${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][D.weekday]}, ${D.month}/${D.day}/${D.year}`;
  const sky = W.snow && W.precip > 0.15 ? 'Snow' : W.precip > 0.4 ? 'Rain' : W.precip > 0.15 ? 'Showers' : 'Fair';
  const weather: Block[] = [{ t: 'h', text: 'Weather' }, { t: 'p', text: `${sky}, ${f(W.temp)}F` }, { t: 'p', text: `[Full forecast](http://${host}/weather)` }];
  const ads = [...Wb.byBiz.entries()].filter(([k, h2]) => Wb.hosts.get(h2)?.kind === 'biz' && (Wb.hosts.get(h2) as { k: number }).k === k);
  const ad = ads.length ? ads[Math.floor(hash3(w.seed, Math.floor(w.time / 3600), 7) * ads.length)] : null;
  const foot: Block = { t: 'foot', text: `${city} Online - ${date}` };
  let body: Block[];
  const m = path.match(/^\/news\/(\d+)$/);
  if (m && stories[+m[1]]) {
    const S = stories[+m[1]];
    body = [{ t: 'h', text: S.head }, ...storyBody(w, S).map((p) => ({ t: 'p', text: p }) as Block), { t: 'p', text: `[Back to the news](http://${host}/news)` }];
  } else if (path === '/news') {
    body = [{ t: 'h', text: `News - ${date}` }, { t: 'list', items: stories.map((S, n) => [S, n] as const).filter(([S]) => S.kind !== 'date').map(([S, n]) => `[${S.head}](http://${host}/news/${n})`) }];
  } else if (path === '/weather') {
    body = [{ t: 'h', text: `Weather for ${city}` }, { t: 'table', rows: [['Now', `${sky}, ${f(W.temp)}F`], ['Wind', `${Math.round(Math.hypot(W.windX, W.windY) * 2.2)} mph`]] }];
  } else if (path === '/directory' || path.startsWith('/directory/')) {
    const kind = path.split('/')[2] as BusinessKind | undefined;
    const kinds = en.phone.find.kinds as Record<string, string>;
    if (!kind || !PLACES[kind]) body = [{ t: 'h', text: 'Business Directory' }, { t: 'p', text: 'Browse the businesses of the city by category.' }, { t: 'list', items: Object.keys(PLACES).filter((k2) => kinds[k2]).map((k2) => `[${kinds[k2]}](http://${host}/directory/${k2})`) }];
    else {
      const rows = c.businesses.map((b, k) => ({ b, k })).filter(({ b, k }) => b.kind === kind && (b.hq ?? k) === k).slice(0, 40)
        .map(({ k }) => [Wb.byBiz.has(k) ? `[${businessName(c, k)}](http://${Wb.byBiz.get(k)}/)` : businessName(c, k), addressOf(w, k), formatNumber(w.telco, w.telco.bizNum[k])]);
      body = [{ t: 'h', text: kinds[kind] ?? kind }, { t: 'table', head: true, rows: [['Name', 'Address', 'Phone'], ...rows] }, { t: 'p', text: `[All categories](http://${host}/directory)` }];
    }
  } else if (path === '/') {
    const heads = stories.map((S, n) => [S, n] as const).filter(([S]) => S.kind !== 'date').slice(0, 8).map(([S, n]) => `[${S.head}](http://${host}/news/${n})`);
    body = [{ t: 'cols', widths: [0.64, 0.36], cols: [[{ t: 'h', text: 'Top Stories' }, { t: 'list', items: heads.length ? heads : ['No news is good news.'] }], [...weather, ...(ad ? [{ t: 'ad', text: `Visit ${businessName(c, ad[0])}!`, url: `http://${ad[1]}/` } as Block] : []), { t: 'h', text: 'Find' }, { t: 'p', text: `[Business directory](http://${host}/directory)` }]] }];
  } else body = [{ t: 'h', text: '404 - Not Found' }, { t: 'p', text: `[Home](http://${host}/)` }];
  return { url: `http://${host}${path}`, title: path === '/' ? `${city} Online` : `${city} Online - ${path.slice(1)}`, theme: PORTAL, blocks: [banner, { t: 'nav', links: nav }, ...body, foot], kb: 60 };
}

export const portalUrl = (w: World) => `http://${webOf(w).portal}/`;
export type { C3 };
