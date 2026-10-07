/**
 * Burrow Labs' site (15.17j), at www.burrow-labs.net: the ten people who make the Ferret, by its manual
 * (docs/identidade/ferret-manual.html, "A Burrow Labs e o Ferret"): "Get Ferret", the release notes, the
 * bug forum. The browser everyone uses, made by a small firm of humble start (a room over a laundromat in
 * 2004; decided with the user on 2026-10-07): today ten people on a floor of one of the city's office
 * towers (picked by the seed), real citizens who go to work there, with the server in the building, so a
 * blackout on that block takes the site down like any other. It is the "Ferret Help" of the bookmarks.
 */
import { hash3 } from '../core/rng';
import { calendar } from '../sim/clock';
import { subAt } from '../sim/power';
import { type World } from '../sim/world';
import { citizenNames, cityName } from '../locale/names';
import { expand, rngOf, tidy } from '../locale/gen';
import { TEXT } from '../locale/text';
import { type Block, type Page, type Theme } from './page';

export const BURROW_HOST = 'www.burrow-labs.net';
const THEME: Theme = { page: [214, 196, 168], bg: [255, 250, 240], fg: [46, 29, 18], dim: [130, 104, 80], link: [107, 74, 46], head: [107, 74, 46], headFg: [241, 228, 200], bar: [241, 228, 200], barFg: [74, 44, 26], gloss: true, tile: 'dots' };
/** The versions so far, newest first, with the month they came out (the notebook comes with 2.0). */
const VERSIONS: [string, string][] = [['2.0.4', 'January 2008'], ['2.0.3', 'November 2007'], ['2.0.2', 'September 2007'], ['2.0', 'June 2007'], ['1.5', 'December 2006']];

/** Where Burrow Labs works: an office tower by the seed, its spot, and the ten who work there (citizen ids, from the tower's staff). */
export function burrowHome(w: World): { building: number; at: [number, number]; staff: number[] } {
  const O = w.pop.workplaces.filter((p) => p.kind === 'office' && p.staff.length >= 10);
  const P = O.length ? O[Math.floor(hash3(w.seed, 0xb0, 0x7e) * O.length)] : w.pop.workplaces[0], B = w.city.buildings[P.building];
  return { building: P.building, at: [(B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2], staff: P.staff.slice(0, 10) };
}
/** Whether the office's block has power (the server is there). */
export function burrowUp(w: World): boolean {
  const [x, y] = burrowHome(w).at;
  return w.power.subs[subAt(w.power, w.city, x, y)].on;
}

export function burrowPage(w: World, path: string, addr: string): Page {
  const url = (p: string) => `http://${BURROW_HOST}${p}`, city = cityName(w.city), home = burrowHome(w);
  const say = (key: string, seed = 0) => tidy(expand(`#${key}#`, TEXT, rngOf(w.seed, 0xb0b, seed), { city, addr }));
  const team = home.staff.map((i) => citizenNames(w.city, w.pop, i).join(' '));
  const tabs: [string, string][] = [['Home', url('/')], ['Get Ferret', url('/download')], ['Release Notes', url('/notes')], ['Bugs', url('/bugs')], ['About', url('/about')]];
  const page = (p: string, title: string, body: Block[]): Page => ({
    url: url(p), title: title ? `Burrow Labs - ${title}` : 'Ferret - the web browser that digs', theme: THEME, kb: 26 + body.length * 2,
    blocks: [{ t: 'banner', text: 'ferret', sub: 'The free web browser, by Burrow Labs', logo: 'ferret' },
      { t: 'tabs', links: tabs, on: Math.max(0, tabs.findIndex(([, u]) => u === url(p))) }, ...body, { t: 'rule', kind: 'dots' },
      { t: 'seals', seals: [['best'], ['html']] },
      { t: 'foot', text: `(c) ${calendar(w.time).year} Burrow Labs - ${addr} - Ferret is free software` }],
  });
  switch (path) {
    case '/':
      return page('/', '', [{ t: 'cols', widths: [0.62, 0.38], cols: [
        [{ t: 'big', text: 'Ferret 2.0', kind: 'hero', rows: 2, col: THEME.head }, { t: 'p', text: say('web.burrow.intro') }, { t: 'seals', seals: [['get', url('/download')]] }],
        [{ t: 'icon', icon: 'star', title: 'Tabs', text: 'Many pages in one window.' },
          { t: 'icon', icon: 'lock', title: 'Safe', text: 'Warns you about bad certificates.' },
          { t: 'icon', icon: 'phone', title: 'Ferret Mini', text: `On your phone too. [See how](${url('/download')})` }],
      ] }, { t: 'p', text: `New: [Ferret ${VERSIONS[0][0]}](${url('/notes')}) is out. Found a bug? [Tell us](${url('/bugs')}).` }]);
    case '/download':
      return page(path, 'Get Ferret', [{ t: 'h', text: 'Get Ferret' },
        { t: 'table', head: true, rows: [['', 'Version', 'Size'], ['Ferret for Osprey', VERSIONS[0][0], '6.2 MB'], ['Ferret Mini for phones', '1.1', '110 KB']] },
        { t: 'p', text: 'Ferret comes with Osprey: updates arrive with the system\'s own. Ferret Mini is in your phone\'s store, free.' },
        { t: 'p', text: 'Ferret is free. Lookwise is the search box; you can help us with a donation.' }]);
    case '/notes':
      return page(path, 'Release Notes', [{ t: 'h', text: 'Release Notes' }, ...VERSIONS.flatMap(([v, when], i): Block[] => {
        const fixes = new Set<string>();
        for (let n = 0; fixes.size < 3 && n < 12; n++) fixes.add(say('web.burrow.fix', i * 16 + n));
        return [{ t: 'h', text: `Ferret ${v} - ${when}` }, { t: 'list', items: [...fixes] }];
      })]);
    case '/bugs': {
      // the forum's open threads: a few new each week
      const week = Math.floor(w.time / (7 * 86400)), seen = new Set<string>(), rows: string[][] = [['#', 'Bug', 'Status', 'Replies']];
      for (let n = 0; rows.length < 9 && n < 40; n++) {
        const t = say('web.burrow.bug', 1000 + week * 40 + n);
        if (seen.has(t)) continue;
        seen.add(t);
        const h = hash3(w.seed, week, n);
        rows.push([String(4210 + week * 9 + rows.length * 7), t, ['NEW', 'CONFIRMED', 'FIXED', 'WONTFIX'][Math.floor(h * 4)], String(Math.floor(h * 1e3) % 23)]);
      }
      return page(path, 'Bugs', [{ t: 'h', text: 'Bug forum' }, { t: 'p', text: 'Tell us what broke. Search first: someone may have found it already.' }, { t: 'table', head: true, rows }]);
    }
    case '/about':
      return page(path, 'About', [{ t: 'h', text: 'About Burrow Labs' }, { t: 'p', text: say('web.burrow.about') }, ...(team.length ? [{ t: 'h', text: 'The team' } as Block, { t: 'list', items: team } as Block] : []), { t: 'p', text: `Burrow Labs, ${addr}, ${city}.` }]);
    default:
      return page(path, 'Not Found', [{ t: 'h', text: 'Page not found' }, { t: 'p', text: `The ferret dug, and found nothing. Back to the [home page](${url('/')}).` }]);
  }
}
