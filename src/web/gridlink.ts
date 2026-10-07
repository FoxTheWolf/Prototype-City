/**
 * GridLink's site (15.17g), at www.gridlink-power.com: the city's power and home-phone company in
 * 2008, by its manual (docs/identidade/manual.html: the negative mark on the navy, POWER . TELECOM,
 * the glossy tabs, the cyan buttons). Its outage map is the grid itself: the sectors of sim/power.ts
 * lit or dark right now, with how long they have been out and whether the crews are on it. The site
 * is served from the control room at the middle sector's yard, so a blackout there takes it down too.
 */
import { type World } from '../sim/world';
import { calendar } from '../sim/clock';
import { cityName } from '../locale/names';
import { expand, rngOf, tidy } from '../locale/gen';
import { TEXT } from '../locale/text';
import { type Block, type Page, type Theme } from './page';

export const GRID_HOST = 'www.gridlink-power.com';
/** The outage line on every GridLink box, truck and bill. */
export const GRID_PHONE = '1-800-555-0148';
const THEME: Theme = { page: [207, 211, 216], bg: [255, 255, 255], fg: [30, 34, 44], dim: [96, 104, 116], link: [29, 58, 110], head: [29, 58, 110], headFg: [255, 255, 255], bar: [214, 222, 230], barFg: [29, 58, 110], gloss: true };

/** How many sectors there are across (the substations' grid, row by row from the north). */
const across = (w: World) => Math.max(1, Math.round(Math.sqrt(w.power.subs.length)));
/** A sector's code as stenciled on the boxes: its row from the north, its column from the west ("2B"). */
export const sectorOf = (w: World, k: number) => `${Math.floor(k / across(w)) + 1}${'ABCDEFGH'[k % across(w)]}`;
/** The substation the site is served from: the middle one, where the control room is. */
export const gridHome = (w: World) => Math.floor(w.power.subs.length / 2);

const clock = (t: number) => { const h = Math.floor(calendar(t).hour), m = Math.floor((calendar(t).hour - h) * 60); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };

export function gridPage(w: World, path: string): Page {
  const S = w.power.subs, url = (p: string) => `http://${GRID_HOST}${p}`, city = cityName(w.city);
  const say = (key: string, ctx: Record<string, string> = {}) => tidy(expand(`#${key}#`, TEXT, rngOf(w.seed, 0x6e1d, Math.floor(w.time / 86400)), { city, phone: GRID_PHONE, ...ctx }));
  const tabs: [string, string][] = [['Home', url('/')], ['Outages', url('/outages')], ['Report an Outage', url('/report')], ['About Us', url('/about')]];
  const out = S.map((s, k) => [s, k] as const).filter(([s]) => !s.on);
  // since when each dark sector has been out: its last blackout in the city's log
  const since = (k: number) => { const e = [...w.events.list].reverse().find((x) => x.kind === 'blackout' && x.refs[0] === k); return e ? clock(e.time) : 'earlier'; };
  const map: Block = { t: 'sectors', cols: across(w), on: S.map((s) => s.on), labels: S.map((_, k) => sectorOf(w, k)) };
  const status: Block = out.length
    ? { t: 'notice', text: say('web.grid.out', { sectors: out.map(([, k]) => sectorOf(w, k)).join(', ') }), url: url('/outages') }
    : { t: 'p', text: say('web.grid.ok') };
  const page = (p: string, title: string, body: Block[]): Page => ({
    url: url(p), title: title ? `GridLink - ${title}` : 'GridLink - Power & Telecom', theme: THEME, kb: 34 + body.length * 2, mobile: true,
    blocks: [{ t: 'banner', text: 'Power . Telecom', sub: `Serving ${city}. Outages: ${GRID_PHONE}`, logo: 'gridlink' },
      { t: 'tabs', links: tabs, on: Math.max(0, tabs.findIndex(([, u]) => u === url(p))) }, ...body, { t: 'rule', kind: 'groove' },
      { t: 'foot', text: `(c) ${calendar(w.time).year} GridLink Power & Telecom - ${city}` }],
  });
  switch (path) {
    case '/':
      return page('/', '', [{ t: 'cols', widths: [0.62, 0.38], cols: [
        [{ t: 'big', text: say('web.grid.slogan'), kind: 'hero', rows: 2, col: THEME.head }, status, { t: 'p', text: say('web.grid.intro') }, map],
        [{ t: 'icon', icon: 'phone', title: 'Report an outage', text: `Call ${GRID_PHONE}, day or night. [How](${url('/report')})` },
          { t: 'icon', icon: 'pin', title: 'Outage map', text: `Every sector, right now. [See the map](${url('/outages')})` },
          { t: 'icon', icon: 'star', title: 'Safety first', text: say('web.grid.safety') }],
      ] }]);
    case '/outages':
      return page(path, 'Outages', [{ t: 'h', text: `Outage map - ${clock(w.time)}` }, map, status,
        { t: 'table', head: true, rows: [['Sector', 'Status', 'Since'], ...S.map((s, k) => [sectorOf(w, k), s.on ? 'Normal' : s.offAt >= 0 ? 'OUTAGE - crews dispatched' : 'OUTAGE - reported', s.on ? '' : since(k)])] },
        { t: 'p', text: 'Most outages are fixed within a few hours. This page updates when you reload it.' }]);
    case '/report':
      return page(path, 'Report an Outage', [{ t: 'h', text: 'Report an outage' }, { t: 'p', text: say('web.grid.report') },
        { t: 'list', items: ['Check your breakers first.', 'See if your neighbors are dark too.', `Then call ${GRID_PHONE}, 24 hours a day.`] }, { t: 'p', text: say('web.grid.safety') }]);
    case '/about':
      return page(path, 'About Us', [{ t: 'h', text: 'About GridLink' }, { t: 'p', text: say('web.grid.about', { n: String(S.length) }) }]);
    default:
      return page(path, 'Not Found', [{ t: 'h', text: 'Page not found' }, { t: 'p', text: `Back to the [home page](${url('/')}).` }]);
  }
}
