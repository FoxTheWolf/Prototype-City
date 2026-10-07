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
import { formatNumber, isOpen } from '../sim/telco';
import { calendar } from '../sim/clock';
import { type World } from '../sim/world';
import { placeAt } from '../phone/places';
import { businessName, cityName, citizenNames, districtName, roadName } from '../locale/names';
import { expand, rngOf, tidy, type Grammar } from '../locale/gen';
import CALLS from '../locale/calls.json';
import { TEXT } from '../locale/text';
import { newsStories, storyBody } from '../locale/news';
import { districtAt } from '../sim/city';
import en from '../locale/en.json';
import { type Block, type C3, type Page, type PhotoSubj, type Sky, type Theme } from './page';
import { groundAt, mapRaster } from '../phone/mapdata';
import { mailHost, mailPage, provider } from './webmail';
import { WIRE_HOST, wirePage } from './streetwire';
import { FORUM_HOST, forumPage } from './forum';
import { GRID_HOST, gridHome, gridPage } from './gridlink';

/** A hostname as written: lowercase letters and digits. */
export const slug = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');

/** The share of each kind of business that has a site (in 2008 the corner shops mostly had none). */
const ONLINE: Partial<Record<BusinessKind, number>> = { bank: 1, hotel: 0.95, cinema: 1, electronics: 0.9, phones: 0.9, cyber: 0.95, motel: 0.5, pizza: 0.6, fastfood: 0.8, bar: 0.5, diner: 0.45, cafe: 0.55, books: 0.6, pharmacy: 0.7, autoparts: 0.6, grocery: 0.4, liquor: 0.35, pawn: 0.4, tailor: 0.25, laundry: 0.2, deli: 0.25, parking: 0.3 };

/** The share of each kind's sites that have a page made for phones (in 2008 mostly the big ones: banks, chains, the phone shops). */
const MOBILE: Partial<Record<BusinessKind, number>> = { bank: 0.9, phones: 0.8, electronics: 0.5, hotel: 0.5, cinema: 0.6, fastfood: 0.5, cyber: 0.3, pharmacy: 0.3 };

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
const PORTAL: Theme = { page: [180, 196, 220], bg: [255, 255, 255], fg: [24, 24, 32], dim: [110, 116, 130], link: [0, 51, 153], head: [0, 51, 153], headFg: [255, 255, 255], bar: [255, 204, 0], barFg: [0, 30, 90], gloss: true, tile: 'stripes' };

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

export type SiteRef = { kind: 'portal' } | { kind: 'search' } | { kind: 'mail' } | { kind: 'wire' } | { kind: 'forum' } | { kind: 'grid' } | { kind: 'biz'; k: number };
export interface Web { hosts: Map<string, SiteRef>; byBiz: Map<number, string>; portal: string; search: string }
/** The search engine (15.3): its name and host. */
export const SEARCH = 'Lookwise', SEARCH_HOST = 'www.lookwise.com';

const webs = new WeakMap<object, Web>();
/** The city's sites by hostname (made once per city). */
export function webOf(w: World): Web {
  let W = webs.get(w.city);
  if (W) return W;
  const c = w.city, hosts = new Map<string, SiteRef>(), byBiz = new Map<number, string>();
  const portal = `www.${slug(cityName(c))}online.com`;
  hosts.set(portal, { kind: 'portal' });
  hosts.set(SEARCH_HOST, { kind: 'search' });
  hosts.set(mailHost(w), { kind: 'mail' });
  hosts.set(WIRE_HOST, { kind: 'wire' });
  hosts.set(GRID_HOST, { kind: 'grid' });
  hosts.set(FORUM_HOST, { kind: 'forum' }); // not indexed by the search, not on the portal: you get the address from someone
  c.businesses.forEach((b, k) => {
    const head = b.hq ?? k;
    if (head !== k) { const h = byBiz.get(head); if (h) byBiz.set(k, h); return; }
    if (hash3(w.seed, k, 0x5173) >= (ONLINE[b.kind] ?? 0.4)) return;
    let host = `www.${slug(businessName(c, k))}.com`;
    if (hosts.has(host)) host = `www.${slug(businessName(c, k))}${slug(districtName(c, districtAt(c, ...placeAt(c, k))))}.com`;
    if (hosts.has(host)) return;
    hosts.set(host, { kind: 'biz', k }); byBiz.set(k, host);
  });
  W = { hosts, byBiz, portal, search: SEARCH_HOST };
  webs.set(c, W);
  return W;
}

/** cert (15.17d): the site is on https, with a good certificate or an expired one (the browser warns before showing it). */
export interface Fetched { host: string; path: string; page?: Page; error?: 'dns' | 'down'; cert?: 'ok' | 'bad' }

/**
 * Which sites are on https, and whose certificate has lapsed (15.17d): the mail and the banks are on it
 * (one small bank in four let its certificate lapse), a few shops (half of them lapsed too), and the
 * forum, on a certificate of its own making. The rest are plain http, as most of the web of 2008 was.
 */
export function certOf(w: World, host: string): 'ok' | 'bad' | undefined {
  const S = webOf(w).hosts.get(host);
  if (!S) return undefined;
  if (S.kind === 'mail') return 'ok';
  if (S.kind === 'forum') return 'bad';
  if (S.kind !== 'biz') return undefined;
  const h = hash3(w.seed, S.k, 0xce27);
  if (w.city.businesses[S.k].kind === 'bank') return h < 0.25 ? 'bad' : 'ok';
  return h < 0.04 ? 'bad' : h < 0.08 ? 'ok' : undefined;
}
/** When a lapsed certificate ran out: a day in the year before now, from the host. */
export function certExpiry(w: World, host: string): string {
  const ago = (20 + Math.floor(hash3(host.length, host.charCodeAt(5) || 1, w.seed) * 340)) * 86400, p2 = (n: number) => String(n).padStart(2, '0');
  if (w.time - ago >= 0) { const D = calendar(w.time - ago); return `${p2(D.month)}/${p2(D.day)}/${D.year}`; }
  // before the calendar's start: a day of the year before (months of 30 days are near enough on a certificate)
  const back = Math.floor((ago - w.time) / 86400) % 360;
  return `${p2(12 - Math.floor(back / 30))}/${p2(28 - (back % 28))}/${calendar(0).year - 1}`;
}

/** What asking for `url` brings (with a form's boxes, when one was sent): the page, or why not (no such host; the server is down). */
export function fetchUrl(w: World, url: string, form?: Map<string, string>): Fetched {
  const u = url.trim().toLowerCase().replace(/^https?:\/\//, '');
  const query = form?.get('q') ?? decodeURIComponent((u.split('?q=')[1] ?? '').replace(/\+/g, ' '));
  let host = u.split(/[/?]/)[0], path = '/' + u.split('?')[0].split('/').slice(1).join('/');
  if (!host.includes('.')) host = `www.${host}.com`;
  if (!host.startsWith('www.') && !webOf(w).hosts.has(host)) host = 'www.' + host;
  path = path.replace(/\/+$/, '') || '/';
  const S = webOf(w).hosts.get(host);
  if (!S) return { host, path, error: 'dns' };
  const cert = certOf(w, host);
  if (S.kind === 'biz') {
    const [x, y] = placeAt(w.city, S.k);
    if (!w.power.subs[subAt(w.power, w.city, x, y)].on) return { host, path, error: 'down' };
    return { host, path, cert, page: bizPage(w, S.k, host, path) };
  }
  if (S.kind === 'search') return { host, path, page: searchPage(w, host, path, query) };
  if (S.kind === 'mail') return { host, path, cert, page: mailPage(w, host, path, form) };
  if (S.kind === 'wire') return { host, path, page: wirePage(w, path, form) };
  if (S.kind === 'forum') return { host, path, cert, page: forumPage(w, path, form) };
  if (S.kind === 'grid') return w.power.subs[gridHome(w)].on ? { host, path, page: gridPage(w, path) } : { host, path, error: 'down' };
  return { host, path, page: portalPage(w, host, path) };
}

/** The address of business k as one would write it: on its street, at the nearest corner. */
export function addressOf(w: World, k: number): string {
  const c = w.city, [x, y] = placeAt(c, k);
  const i = nearestRoad(c.xb, c.xCell, x), j = nearestRoad(c.yb, c.yCell, y);
  const onAve = Math.abs((c.xb[2 * i] + c.xb[2 * i + 1]) / 2 - x) < Math.abs((c.yb[2 * j] + c.yb[2 * j + 1]) / 2 - y);
  return onAve ? `${roadName(c, true, i)} at ${roadName(c, false, j)}` : `${roadName(c, false, j)} at ${roadName(c, true, i)}`;
}

export const hh = (h: number) => (h % 24 === 0 ? 'midnight' : h % 24 === 12 ? 'noon' : `${((h + 11) % 12) + 1} ${h % 24 < 12 ? 'am' : 'pm'}`);
export const money = (c: number) => `$${(c / 100).toFixed(2)}`;

/** The layouts a site may have: a classic column, a sidebar on the right, a centered home page with a visitor
 *  counter, a menu down the left, a corporate one, a bare page "under construction"; each kind of place has its
 *  likely ones (a bank looks corporate, a bar homemade, a laundry barely there). */
const enum Tpl { Classic, Side, Center, LeftNav, Corporate, Bare }
const TPLS: Partial<Record<BusinessKind, Tpl[]>> = {
  bank: [Tpl.Corporate, Tpl.Classic], hotel: [Tpl.Corporate, Tpl.LeftNav, Tpl.Classic], cinema: [Tpl.Corporate, Tpl.Side], electronics: [Tpl.Corporate, Tpl.LeftNav, Tpl.Side],
  phones: [Tpl.Corporate, Tpl.Side], fastfood: [Tpl.Corporate, Tpl.Classic], bar: [Tpl.Center, Tpl.Side, Tpl.LeftNav], pizza: [Tpl.Center, Tpl.Classic, Tpl.Side],
  cyber: [Tpl.Center, Tpl.LeftNav], laundry: [Tpl.Bare, Tpl.Center], tailor: [Tpl.Bare, Tpl.Classic], deli: [Tpl.Bare, Tpl.Center], liquor: [Tpl.Bare, Tpl.Classic],
  pawn: [Tpl.Bare, Tpl.Center], grocery: [Tpl.Bare, Tpl.Classic, Tpl.Side], parking: [Tpl.Bare], motel: [Tpl.Bare, Tpl.Center],
};
const ANY = [Tpl.Classic, Tpl.Side, Tpl.Center, Tpl.LeftNav];

/** The kinds' own page beyond the menu or products: a cinema's showtimes, a hotel's rooms, a bank's rates and branches. */
const EXTRA: Partial<Record<BusinessKind, [string, string]>> = { cinema: ['Showtimes', 'showtimes'], hotel: ['Rooms & Rates', 'rooms'], motel: ['Rates', 'rooms'], bank: ['Rates', 'rates'] };

/** What a place's photos show, by its kind (the manual's GROUP): food, a shop front, a bar, electronics, a room. */
const GROUP: Partial<Record<BusinessKind, PhotoSubj>> = {
  diner: 'food', cafe: 'food', pizza: 'food', deli: 'food', fastfood: 'food', bar: 'bar', liquor: 'bar',
  hotel: 'room', motel: 'room', electronics: 'tech', phones: 'tech', cyber: 'tech',
};
/** The grammar's key for a kind's special and slogan (a few kinds have their own). */
const pitchOf = (kind: BusinessKind) => (kind === 'bank' || kind === 'cinema' ? kind : GROUP[kind] ?? 'store');

/**
 * The city's own ground round a point, for a site's "Find us" map (the Maps raster, phone/mapdata.ts):
 * gw x gh spots `step` metres apart, one digit each (the Ground kind), as data the page carries.
 */
function groundAround(w: World, x: number, y: number, gw = 48, gh = 30, step = 5): string {
  const m = mapRaster(w.city);
  let g = '';
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) g += String(groundAt(m, x + (i - gw / 2) * step, y + (j - gh * 0.55) * step));
  return g;
}

/** A page of business k's site. */
function bizPage(w: World, k: number, host: string, path: string): Page {
  const c = w.city, b = c.businesses[k], P = w.pop, h = (q: number) => hash3(w.seed, k, q), name = businessName(c, k);
  const tpls = TPLS[b.kind] ?? ANY, tpl = tpls[Math.floor(h(2) * tpls.length)], base = THEMES[Math.floor(h(1) * THEMES.length)], year = String(1958 + Math.floor(h(3) * 48));
  // each template is a year of the web (15.17f): its background, its shine
  const TILES = ['stripes', 'dots', 'checks', 'diag'] as const;
  const theme: Theme = tpl === Tpl.Center ? { ...base, page: [8, 8, 40], bg: [8, 8, 40], fg: [255, 255, 255], dim: [170, 170, 255], link: [0, 255, 255], head: [8, 8, 40], headFg: [255, 255, 0], tile: 'stars' }
    : tpl === Tpl.Classic ? { ...base, tile: TILES[Math.floor(h(11) * 4)] }
    : tpl === Tpl.LeftNav ? { ...base, tile: 'checks', gloss: true }
    : tpl === Tpl.Side ? { ...base, tile: 'diag', gloss: true }
    : tpl === Tpl.Corporate ? { ...base, page: [228, 231, 236], bg: [255, 255, 255], gloss: true, head: base.head[0] + base.head[1] + base.head[2] > 600 ? [40, 44, 52] : base.head }
    : { page: [255, 255, 255], bg: [255, 255, 255], fg: [0, 0, 0], dim: [120, 120, 120], link: [0, 0, 204], head: [255, 255, 255], headFg: [0, 0, 0], bar: [230, 230, 230], barFg: [0, 0, 0] };
  const r = rngOf(w.seed, k, 0xb10b), district = districtName(c, districtAt(c, ...placeAt(c, k)));
  const say = (key: string, ctx: Record<string, string> = {}) => tidy(expand(`#${key}#`, TEXT, r, { biz: name, district, year, city: cityName(c), ...ctx }));
  const T = PLACES[b.kind], goods = en.goods as Record<string, string>;
  const food = ['diner', 'cafe', 'pizza', 'deli', 'fastfood', 'bar'].includes(b.kind), sells = T.sells.length > 0, list = food ? 'menu' : 'products', extra = EXTRA[b.kind];
  const nav: [string, string][] = [['Home', `http://${host}/`], ...(sells ? [[food ? 'Menu' : 'Products', `http://${host}/${list}`] as [string, string]] : []),
    ...(extra ? [[extra[0], `http://${host}/${extra[1]}`] as [string, string]] : []), ...(b.kind === 'bank' ? [['Branches', `http://${host}/branches`] as [string, string]] : []),
    ['About Us', `http://${host}/about`], ['Contact', `http://${host}/contact`]];
  const [o, z] = T.hours, allDay = o === 0 && z === 24, open = allDay ? 'Open 24 hours' : `${b.kind === 'bank' ? 'Mon-Fri' : 'Daily'} ${hh(o)} - ${hh(z)}`;
  const phone = formatNumber(w.telco, w.telco.bizNum[k]), addr = addressOf(w, k);
  // live: open or closed right now; back after an outage of its block (the city's doings show, never who did them)
  const hour = calendar(w.time).hour, now = allDay || isOpen(b.kind, hour) ? 'OPEN NOW' : `CLOSED NOW - opens at ${hh(o)}`;
  const [bx, by] = placeAt(c, k), sub = subAt(w.power, c, bx, by);
  const back = w.events.list.some((e) => e.kind === 'restored' && e.refs[0] === sub && w.time - e.time < 86400);
  const notice: Block[] = back ? [{ t: 'notice', text: say('web.outage') }] : [];
  const banner: Block = tpl === Tpl.Bare ? { t: 'h', text: name.toUpperCase() } : { t: 'banner', text: name, sub: `Since ${year} - ${district}`, art: ICONS[b.kind] ?? ICONS.any, look: tpl === Tpl.Classic ? 'bevel' : undefined };
  // the photos by the place's kind, the special of the day and the slogan from the grammar, the map round the door
  const subj: PhotoSubj = GROUP[b.kind] ?? 'store', seed = Math.floor(h(12) * 1e9), pitch = pitchOf(b.kind);
  // the special is one of the things it really sells, at its price
  const deal = T.sells.length ? T.sells[Math.floor(h(18) * T.sells.length)] : null, item = deal ? (goods[deal[0]] ?? deal[0].replace(/_/g, ' ')).toLowerCase() : 'a coffee';
  const special = say(`web.special.${pitch}`, { item, price: money(deal?.[1] ?? 150), pct: String(10 + Math.floor(h(13) * 4) * 5), rate: (1.5 + h(8)).toFixed(2) });
  const [sl1, sl2 = ''] = say(`web.slogan.${pitch}`).split('|');
  const ground = groundAround(w, bx, by);
  const findMap: Block = { t: 'map', seed, pins: ['A'], h: 6, ground, gw: 48, gh: 30 };
  const reviews = 3 + Math.floor(h(14) * 3), nRev = 12 + Math.floor(h(15) * 60);
  // the blog's posts: what happened near the shop this week (the city's doings), else the shop's own news
  const near = w.events.list.filter((e) => (e.kind === 'restored' ? e.refs[0] === sub : (e.kind === 'crash' || e.kind === 'jam') && Math.hypot(e.x - bx, e.y - by) < 250) && w.time - e.time < 7 * 86400).slice(-2).reverse();
  const when = (t: number) => { const d = Math.floor((w.time - t) / 86400); return d < 1 ? 'today' : d < 2 ? 'yesterday' : `on ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][calendar(t).weekday]}`; };
  const dated = (t: number) => { const Dd = calendar(Math.max(0, t)); return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Dd.month - 1]} ${Dd.day}, ${Dd.year}`; };
  const posts: [string, string, string][] = near.map((e) => [dated(e.time), say(`web.post.${e.kind}.title`), say(`web.post.${e.kind}.body`, { when: when(e.time) })]);
  for (let tries = 0; posts.length < 2 && tries < 8; tries++) {
    const t = say('web.post.generic.title'), x = say('web.post.generic.body');
    if (!posts.some((p) => p[1] === t || p[2] === x)) posts.push([dated(w.time - (posts.length + 1) * (5 + Math.floor(h(16 + posts.length) * 20)) * 86400), t, x]);
  }
  const ago = Math.floor(h(4) * 400) * 86400, D = calendar(Math.max(0, w.time - ago));
  const updated = say('web.updated', { date: w.time - ago < 0 ? 'in 2007' : `${D.month}/${D.day}/${String(D.year).slice(2)}` });
  const counter = say('web.visitors', { n: String(1000 + Math.floor(h(5) * 90000)).padStart(6, '0') });
  const foot: Block = { t: 'foot', text: `(c) ${calendar(w.time).year} ${name} - ${addr} - ${phone}` };
  const info: Block[] = [{ t: 'h', text: 'Hours' }, { t: 'p', text: open }, { t: 'p', text: now }, { t: 'h', text: 'Find us' }, { t: 'p', text: `${addr}, ${district}` }, { t: 'p', text: `Call ${phone}` }];
  let body: Block[];
  switch (path) {
    case '/': {
      const see = sells ? `See our [${food ? 'menu' : 'products'}](http://${host}/${list})` : extra ? `See our [${extra[0].toLowerCase()}](http://${host}/${extra[1]})` : 'Come visit us';
      const main: Block[] = [{ t: 'h', text: say('web.welcome') }, { t: 'p', text: say(`web.intro.${b.kind}`) }, { t: 'p', text: `${see} or [get in touch](http://${host}/contact).` }];
      const priceRows = T.sells.slice(0, 4).map(([g, p]) => [goods[g] ?? g.replace(/_/g, ' '), money(p)]);
      switch (tpl) {
        case Tpl.Center: // 1998: the homepage that was never updated
          body = [{ t: 'photo', subj, seed, h: 6, w: 22, center: true, frame: 'line' }, { t: 'big', text: say('web.welcome.home98'), kind: 'hero', rows: 2, center: true, col: [255, 255, 255] },
            { t: 'blink', text: `*** ${special} ***` }, { t: 'space' },
            { t: 'list', items: nav.slice(1).map(([l, u]) => `[${l}](${u})`) }, { t: 'p', text: `${now} - ${addr} - ${phone}` }, { t: 'rule', kind: 'rainbow' }, { t: 'p', text: counter }, { t: 'p', text: 'Best viewed at 800x600 with Ferret.' }];
          break;
        case Tpl.Classic: // 2001: tables, a framed photo beside the welcome, the special of the day
          body = [{ t: 'cols', widths: [0.3, 0.7], cols: [[{ t: 'photo', subj, seed, h: 6, w: 20 }], main] }, { t: 'rule', kind: 'groove' },
            { t: 'burst', label: 'NEW!', text: `TODAY'S SPECIAL: ${special}` }, { t: 'rule', kind: 'groove' },
            { t: 'cols', cols: [priceRows.length ? [{ t: 'table', rows: priceRows }] : info.slice(0, 3), info.slice(1)] }];
          break;
        case Tpl.LeftNav: // 2003: the welcome, the prices, the button to book or order
          body = [...main, ...(priceRows.length ? [{ t: 'table', head: true, rows: [['', 'Price'], ...priceRows] } as Block] : []), { t: 'submit', label: subj === 'room' ? 'Book now' : subj === 'food' ? 'Order online' : 'Contact us' }, ...info.slice(1, 3), ...info.slice(4)];
          break;
        case Tpl.Side: // 2005: a blog, with boxes on the side
          body = [{ t: 'cols', widths: [0.66, 0.34], cols: [
            [{ t: 'rss', text: `LATEST NEWS - [RSS](http://${host}/)` }, ...posts.flatMap(([d, t, x], i): Block[] => [{ t: 'p', text: d }, { t: 'h', text: t }, ...(i === 0 ? [{ t: 'photo', subj, seed, h: 4, w: 14, frame: 'line' } as Block] : []), { t: 'p', text: x }, { t: 'rule', kind: 'dots' }])],
            [{ t: 'box', title: 'Hours', blocks: [{ t: 'p', text: open }, { t: 'p', text: now }] }, { t: 'box', title: 'Find us', blocks: [findMap, { t: 'p', text: addr }, { t: 'p', text: phone }] },
              { t: 'box', title: 'Reviews', blocks: [{ t: 'stars', n: reviews }, { t: 'p', text: `${reviews}.${Math.floor(h(17) * 10)} - ${nRev} reviews` }] }],
          ] }];
          break;
        case Tpl.Corporate: // 2008: the hero, three boxes with glossy icons
          body = [{ t: 'hero', title: sl1.toUpperCase(), sub: `${sl2} ${special}.`, subj, seed, btn: ['Learn more >>', `http://${host}/about`] },
            { t: 'cols', cols: [[{ t: 'icon', icon: b.kind === 'bank' ? 'lock' : 'star', title: 'Hours', text: `${open}. ${now}` }], [{ t: 'icon', icon: 'pin', title: 'Find us', text: `${addr}, ${district}` }], [{ t: 'icon', icon: 'phone', title: 'Call us', text: phone }]] },
            { t: 'cols', widths: [0.55, 0.45], cols: [[{ t: 'box', title: b.kind === 'bank' ? 'Online banking' : 'Find a store', blocks: [{ t: 'p', text: `[${b.kind === 'bank' ? 'Sign in' : 'Store locator'}](http://${host}/contact)` }] }], [findMap]] }];
          break;
        default: // Bare: free hosting, the picture that never loaded, under construction
          body = [{ t: 'broken', name: 'logo.jpg', text: `${say(`web.intro.${b.kind}`)} ${addr}. Call ${phone}.` },
            { t: 'art', lines: ['   /\\', '  /!!\\    UNDER CONSTRUCTION', ' /____\\   Our new website is coming soon!'], col: [200, 120, 0] },
            { t: 'p', text: `[${say('web.webmaster')}](http://${mailHost(w)}/)` }];
      }
      break;
    }
    case `/${list}`:
      if (!sells) return bizPage(w, k, host, '/404');
      body = [{ t: 'h', text: food ? 'Our Menu' : 'Products & Prices' }, { t: 'table', head: true, rows: [['Item', 'Price'], ...T.sells.map(([g, p]) => [goods[g] ?? g.replace(/_/g, ' '), money(p)])] }, { t: 'p', text: food ? 'Prices include tax. Ask about our daily specials!' : 'Prices subject to change. Come see the full selection in store.' }];
      break;
    case '/showtimes': {
      if (b.kind !== 'cinema') return bizPage(w, k, host, '/404');
      const films = Array.from({ length: 5 }, (_, n) => tidy(expand('#films#', CALLS as unknown as Grammar, rngOf(w.seed, k, Math.floor(w.time / (7 * 86400)) * 10 + n))));
      body = [{ t: 'h', text: `Now Showing - week of ${calendar(w.time).month}/${calendar(w.time).day}` }, { t: 'table', head: true, rows: [['Film', 'Times'], ...films.map((f, n) => [f, ['1:10  4:20  7:30  10:15', '12:45  3:30  6:45  9:40', '2:00  5:15  8:20', '11:50  2:40  5:30  8:10  10:50', '7:00  9:45  12:05'][n]])] }, { t: 'p', text: 'Matinees before 5 pm: $5.50. Evening shows: $8.00.' }];
      break;
    }
    case '/rooms': {
      if (b.kind !== 'hotel' && b.kind !== 'motel') return bizPage(w, k, host, '/404');
      const night = T.sells.find(([g]) => g === 'room_night')?.[1] ?? 7900 + Math.floor(h(7) * 8) * 1000;
      body = [{ t: 'h', text: extra![0] }, { t: 'table', head: true, rows: [['Room', 'Per night'], ['Standard (one queen)', money(night)], ['Double (two fulls)', money(Math.round(night * 1.25))], ...(b.kind === 'hotel' ? [['Suite', money(night * 2)]] : [['Weekly (standard)', money(night * 6)]])] }, { t: 'p', text: `To book, call ${phone}. Check-in after 3 pm, check-out by 11 am.` }];
      break;
    }
    case '/rates':
      if (b.kind !== 'bank') return bizPage(w, k, host, '/404');
      body = [{ t: 'h', text: 'Current Rates' }, { t: 'table', head: true, rows: [['Account', 'APY'], ['Savings', `${(1.5 + h(8)).toFixed(2)}%`], ['12-month CD', `${(3 + h(9)).toFixed(2)}%`], ['Money Market', `${(2 + h(10)).toFixed(2)}%`]] }, { t: 'p', text: 'Rates as of today and subject to change. Member FDIC.' }];
      break;
    case '/branches': {
      if (b.kind !== 'bank') return bizPage(w, k, host, '/404');
      const rows = c.businesses.map((x, n) => ({ x, n })).filter(({ x, n }) => (x.hq ?? n) === k).map(({ n }) => [addressOf(w, n), districtName(c, districtAt(c, ...placeAt(c, n))), formatNumber(w.telco, w.telco.bizNum[n])]);
      body = [{ t: 'h', text: 'Branches & ATMs' }, { t: 'table', head: true, rows: [['Address', 'District', 'Phone'], ...rows] }, { t: 'p', text: 'Branch hours: Mon-Fri 9 am - 5 pm.' }];
      break;
    }
    case '/about': {
      const Wk = P.workplaces.find((x) => x.biz === k), staff = (Wk?.staff ?? []).slice(0, 5).map((i) => citizenNames(c, P, i)[0]);
      body = [{ t: 'h', text: `About ${name}` }, { t: 'p', text: say('web.about') }, ...(staff.length ? [{ t: 'p', text: say('web.team', { staff: staff.join(', ') }) } as Block] : [])];
      break;
    }
    case '/contact':
      body = [{ t: 'h', text: 'Contact Us' }, { t: 'table', rows: [['Address', `${addr}, ${district}`], ['Phone', phone], ['Hours', open], ['Now', now]] }, { t: 'p', text: 'We do not take reservations or orders by e-mail.' }];
      break;
    default:
      body = [{ t: 'h', text: '404 - Page Not Found' }, { t: 'p', text: `The page you requested could not be found. Go back to the [home page](http://${host}/).` }];
  }
  const navB: Block = { t: 'nav', links: nav, look: tpl === Tpl.Classic ? 'bevel' : undefined }, on = Math.max(0, nav.findIndex(([, u]) => u === `http://${host}${path === '/' ? '/' : path}`));
  const blocks: Block[] = tpl === Tpl.Center ? [{ t: 'marquee', text: `*** Welcome to ${name}! *** ${special} *** Sign our guestbook! *** Thanks for visiting ***` }, { t: 'big', text: name, kind: 'word', rows: 4, center: true }, { t: 'rule', kind: 'rainbow' }, ...notice, ...body, ...(path === '/' ? [] : [navB]), { t: 'p', text: updated }]
    : tpl === Tpl.Bare ? [{ t: 'ad', name: `${cityName(c)}Net`, text: 'Free web pages - get your own site today!', url: portalUrl(w), c1: [0, 51, 153], c2: [255, 204, 0] }, banner, ...notice, ...body, navB, { t: 'p', text: `Hosted by ${cityName(c)}Net` }]
    : tpl === Tpl.LeftNav ? [{ t: 'photo', subj: 'sky', seed, h: 4, w: 124, frame: 'none' }, { ...banner, art: undefined } as Block, ...notice, { t: 'cols', widths: [0.22, 0.78], cols: [[{ t: 'buttons', links: nav, on }], body] }, { t: 'p', text: 'Site by Pixelworks Web Design' }, foot]
    : tpl === Tpl.Side ? [banner, { t: 'tabs', links: nav, on }, ...notice, ...body, { t: 'p', text: `(c) ${calendar(w.time).year} ${name} - Powered by Blogsmith` }]
    : tpl === Tpl.Corporate ? [banner, navB, ...notice, ...body, { t: 'rule', kind: 'groove' }, foot]
    : [banner, navB, ...notice, ...body, { t: 'p', text: updated }, foot];
  return { url: `http://${host}${path}`, title: path === '/' ? name : `${name} - ${path.slice(1)}`, theme, blocks, kb: tpl === Tpl.Bare ? 12 : 30 + Math.floor(h(6) * 60), mobile: h(7) < (MOBILE[b.kind] ?? 0.12) };
}

/** A page of the provider's portal: the start page, a story, the weather, the directory. */
function portalPage(w: World, host: string, path: string): Page {
  const c = w.city, city = cityName(c), r = rngOf(w.seed, 0x9047, Math.floor(w.time / 3600)), Wb = webOf(w);
  const nav: [string, string][] = [['Home', `http://${host}/`], ['News', `http://${host}/news`], ['Weather', `http://${host}/weather`], ['Directory', `http://${host}/directory`], ['Mail', `http://${mailHost(w)}/`], ['Search', `http://${SEARCH_HOST}/`]];
  const banner: Block = { t: 'banner', text: `${city} Online`, sub: tidy(expand('#web.portal.tagline#', TEXT, r, { city })), art: [' .--. ', '( @@ )', " '--' "] };
  const stories = newsStories(w), W = w.weather, f = (t: number) => Math.round(t * 1.8 + 32);
  const D = calendar(w.time), date = `${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][D.weekday]}, ${D.month}/${D.day}/${D.year}`;
  const sky = W.snow && W.precip > 0.15 ? 'Snow' : W.precip > 0.4 ? 'Rain' : W.precip > 0.15 ? 'Showers' : 'Fair';
  // the icon by the sky and the hour; the wind by the compass
  const hour = D.hour, night = hour < 6 || hour >= 19, icon: Sky = W.precip > 0.15 ? (W.snow ? 'snow' : 'rain') : W.cloud > 0.6 ? 'cloud' : night ? 'moon' : 'sun';
  const mph = Math.round(Math.hypot(W.windX, W.windY) * 2.2), wdir = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'][((Math.round(Math.atan2(W.windY, W.windX) / (Math.PI / 4)) + 4) % 8 + 8) % 8]; // where it blows from
  const weather: Block[] = [{ t: 'weather', sky: icon, title: `${night ? 'Tonight' : 'Today'}: ${sky.toLowerCase()}`, text: `${f(W.temp)} F  wind ${wdir} ${mph}  [Forecast](http://${host}/weather)` }];
  // the ads of the day: businesses of the city that have a site (in their own colors), never the same two
  const ads = [...Wb.hosts.entries()].filter((e): e is [string, { kind: 'biz'; k: number }] => e[1].kind === 'biz');
  const day = Math.floor(w.time / 86400), adOf = (q: number) => {
    if (!ads.length) return null;
    const [h2, S] = ads[Math.floor(hash3(w.seed, day, q) * ads.length)], b = c.businesses[S.k], T = THEMES[Math.floor(hash3(w.seed, S.k, 1) * THEMES.length)];
    const [sl] = tidy(expand(`#web.slogan.${pitchOf(b.kind)}#`, TEXT, rngOf(w.seed, S.k, day), { biz: businessName(c, S.k), city })).split('|');
    return { t: 'ad', name: businessName(c, S.k), text: sl, url: `http://${h2}/`, c1: T.head, c2: T.headFg } as Block;
  };
  const ad = adOf(7);
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
    const news = stories.map((S, n) => [S, n] as const).filter(([S]) => S.kind !== 'date');
    // the top story with its photo (a dark street for a blackout, the street for the traffic, the city for the rest) and its first lines
    const lead = news[0], rest = news.slice(1, 8).map(([S, n]) => `[${S.head}](http://${host}/news/${n})`);
    const subjOf = (k: string): PhotoSubj => (k === 'blackout' ? 'blackout' : k === 'crash' || k === 'jam' ? 'sky' : k === 'weather' ? 'sky' : 'store');
    const first = lead ? (storyBody(w, lead[0])[0] ?? '') : '', short = first.length > 130 ? first.slice(0, first.lastIndexOf(' ', 127)) + '...' : first;
    const top: Block[] = lead
      ? [{ t: 'cols', widths: [0.34, 0.66], cols: [[{ t: 'photo', subj: subjOf(lead[0].kind), seed: lead[0].key * 31 + 7, h: 5, w: 18, frame: 'line' }], [{ t: 'p', text: `[${lead[0].head}](http://${host}/news/${lead[1]})` }, { t: 'p', text: short }]] }]
      : [{ t: 'p', text: 'No news is good news.' }];
    // the provider's own banner on top; the search box with the owl, sent to Lookwise; the directory's big groups
    const kinds = en.phone.find.kinds as Record<string, string>, groups: [string, BusinessKind][] = ([['Food & drink', 'diner'], ['Coffee', 'cafe'], ['Banks', 'bank'], ['Night life', 'bar'], ['Hotels', 'hotel']] as [string, BusinessKind][]).filter(([, k2]) => kinds[k2]);
    const search: Block = { t: 'box', title: 'Search the web', owl: true, blocks: [{ t: 'input', name: 'q', label: 'Look it up:', size: 26 }, { t: 'submit', label: 'Go' }] };
    body = [{ t: 'ad', name: `${city} Online`, text: 'Free e-mail with 25 MB for everyone. Sign up by SMS today!', url: `http://${mailHost(w)}/signup`, c1: [0, 51, 153], c2: [255, 204, 0] },
      { t: 'cols', widths: [0.62, 0.38], cols: [
        [{ t: 'h', text: `Top Stories - ${date}` }, ...top, { t: 'list', items: rest }, { t: 'p', text: `[More news >>](http://${host}/news)` }, { t: 'p', text: `[Streetwire](http://${WIRE_HOST}/): what the city is saying` }, { t: 'p', text: `Lights out? [GridLink's outage map](http://${GRID_HOST}/outages)` }],
        [{ t: 'box', title: 'Weather', blocks: weather }, search, ...(ad ? [ad] : []), { t: 'box', title: 'Directory', blocks: [{ t: 'list', items: [...groups.map(([l, k2]) => `[${l}](http://${host}/directory/${k2})`), `[All categories](http://${host}/directory)`] }] }],
      ] }];
  } else body = [{ t: 'h', text: '404 - Not Found' }, { t: 'p', text: `[Home](http://${host}/)` }];
  return { url: `http://${host}${path}`, title: path === '/' ? `${city} Online` : `${city} Online - ${path.slice(1)}`, theme: PORTAL, blocks: [banner, { t: 'nav', links: nav }, ...body, foot], kb: 60, mobile: true, form: path === '/' ? `http://${SEARCH_HOST}/search` : undefined };
}

export const portalUrl = (w: World) => `http://${webOf(w).portal}/`;
/** The address of a search for `q`. */
export const searchUrl = (q: string) => `http://${SEARCH_HOST}/search?q=${encodeURIComponent(q.trim()).replace(/%20/g, '+')}`;

/** A page in the search engine's index: what it is called, where, and the words it is found by. */
interface Doc { url: string; title: string; snippet: string; words: Map<string, number> }
const indexes = new WeakMap<object, Doc[]>();
const tokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((x) => x.length > 1);
/**
 * The index (15.3): the front page of every business site and the portal's sections, made once per
 * city. Only what has a site is in it (the corner shops are found by their sign, the directory, word
 * of mouth); the pages deeper in the sites are not crawled.
 */
function indexOf(w: World): Doc[] {
  let I = indexes.get(w.city);
  if (I) return I;
  const c = w.city, Wb = webOf(w), kinds = en.phone.find.kinds as Record<string, string>, goods = en.goods as Record<string, string>;
  I = [];
  const doc = (url: string, title: string, snippet: string, parts: [string, number][]) => {
    const words = new Map<string, number>();
    for (const [t, wt] of parts) for (const x of tokens(t)) words.set(x, Math.max(words.get(x) ?? 0, wt));
    I!.push({ url, title, snippet, words });
  };
  for (const [host, S] of Wb.hosts) {
    if (S.kind !== 'biz') continue;
    const k = S.k, b = c.businesses[k], name = businessName(c, k), district = districtName(c, districtAt(c, ...placeAt(c, k))), addr = addressOf(w, k);
    const intro = tidy(expand(`#web.intro.${b.kind}#`, TEXT, rngOf(w.seed, k, 0xb10b), { biz: name, district, year: '', city: cityName(c) }));
    doc(`http://${host}/`, name, `${kinds[b.kind] ?? b.kind} - ${addr}, ${district}. ${intro}`, [[name, 5], [kinds[b.kind] ?? b.kind, 3], [b.kind, 3], [district, 2], [addr, 2], [intro, 1], [PLACES[b.kind].sells.map(([g]) => goods[g] ?? g).join(' '), 1]]);
  }
  const city = cityName(c);
  doc(`http://${Wb.portal}/`, `${city} Online`, `News, weather and the business directory of ${city}.`, [[city, 3], ['online news weather directory portal home', 3]]);
  doc(`http://${Wb.portal}/news`, `${city} Online - News`, `Today's headlines from around ${city}.`, [['news headlines today', 4], [city, 2]]);
  doc(`http://${Wb.portal}/weather`, `${city} Online - Weather`, `The weather in ${city} today.`, [['weather forecast rain snow temperature', 4], [city, 2]]);
  doc(`http://${mailHost(w)}/`, `${provider(w)} Mail`, `Free e-mail from ${provider(w)}. Sign in or sign up for a free account.`, [['mail email webmail inbox free account sign signup', 4], [city, 2]]);
  doc(`http://${GRID_HOST}/`, 'GridLink - Power & Telecom', `Power and home phone service for ${city}. Outage map, report an outage.`, [['gridlink power electricity outage outages blackout lights phone telecom utility', 4], [city, 1]]);
  doc(`http://${WIRE_HOST}/`, 'Streetwire', "What's happening in your city, right now. Join free.", [['streetwire social network posts friends people feed', 4], [city, 1]]);
  doc(`http://${Wb.portal}/directory`, `${city} Online - Business Directory`, 'Every business in the city by category, with address and phone.', [['directory business businesses yellow pages phone address', 4], [Object.values(kinds).join(' '), 1]]);
  indexes.set(w.city, I);
  return I;
}

/** The search engine: its front page, or the results for `q` (the best ten first). */
function searchPage(w: World, host: string, path: string, q: string): Page {
  const theme: Theme = { page: [255, 255, 255], bg: [255, 255, 255], fg: [30, 30, 30], dim: [0, 128, 0], link: [17, 17, 204], head: [255, 255, 255], headFg: [40, 90, 200], bar: [235, 239, 249], barFg: [40, 40, 40] };
  const banner: Block = { t: 'banner', text: SEARCH, sub: 'Search the web', art: ['  ___  ', ' / _ \\ ', '| (_) |', ' \\___/\\'] };
  const howto: Block = { t: 'p', text: 'Type what you are looking for in the address bar and go.' };
  if (path !== '/search' || !q.trim()) return { url: `http://${host}/`, title: SEARCH, theme, blocks: [banner, howto, { t: 'foot', text: `(c) 2008 ${SEARCH}` }], kb: 20, mobile: true };
  const terms = tokens(q), docs = indexOf(w);
  const hits = docs.map((d) => ({ d, s: terms.reduce((a, t) => a + (d.words.get(t) ?? (t.length > 3 ? [...d.words.keys()].some((x) => x.startsWith(t)) ? 0.5 : 0 : 0)), 0) * (terms.every((t) => d.words.has(t)) ? 2 : 1) }))
    .filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.d.title.localeCompare(b.d.title));
  const top = hits.slice(0, 10);
  const blocks: Block[] = [banner, { t: 'p', text: `Results 1 - ${top.length} of about ${hits.length} for ${q}.` }];
  for (const { d } of top) blocks.push({ t: 'p', text: `[${d.title}](${d.url})` }, { t: 'art', lines: [d.url.replace('http://', '')], col: theme.dim }, { t: 'p', text: d.snippet.length > 150 ? d.snippet.slice(0, 147) + '...' : d.snippet });
  if (!top.length) blocks.push({ t: 'p', text: `Your search - ${q} - did not match any documents.` }, { t: 'list', items: ['Make sure all words are spelled correctly.', 'Try different keywords.', 'Try more general keywords.'] });
  blocks.push({ t: 'foot', text: `(c) 2008 ${SEARCH}` });
  return { url: searchUrl(q), title: `${q} - ${SEARCH} Search`, theme, blocks, kb: 45 + top.length * 6, mobile: true };
}
export type { C3 };
