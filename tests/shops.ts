/**
 * The shops by the manual's models (13.21; the interiors manual, section 7b): every shop room of the city (SEED, default
 * 42; drawn floors and cut ones alike) furnished by a model, with its till; the clerk's place behind each counter and
 * the customer's in front of the till on free floor of the shop. The cybercafé and the motel's reception must never
 * be left without one (the first hour).
 *   node tests/floorplans-sync.mjs && npx rolldown tests/shops.ts --format esm --platform node -o tests/.out/shops.mjs && node tests/.out/shops.mjs
 */
import { generateCity } from '../src/sim/city';
import { cellAt, inFurniture, planOf, ROOM, stackOf, WALL, type Plan, type Posto } from '../src/sim/interior';
import { CITY_SIZE } from '../src/sim/world';

const city = generateCity(Number(process.env.SEED ?? 42), CITY_SIZE);
const tally = new Map<string, [number, number]>();
let bad = 0;
/** The lots whose shop has its till (one is enough: a big cut plan also has 1 m strips of shop, rightly bare). */
const served = new Set<number>(), firstHour: number[] = [];
const say = (m: string) => { if (bad++ < 12) console.log('  ' + m); };
const onFloor = (P: Plan, r: number, q: Posto) => { const c = cellAt(P, q.x, q.y); return (c & ROOM) === r + 1 && !(c & WALL) && !inFurniture(P, q.x, q.y); };
city.buildings.forEach((B, k) => {
  if (!B.shop || B.tier !== 1) return;
  const P = planOf(city, k, 0);
  if (!P) return;
  const kind = B.biz >= 0 ? city.businesses[B.biz].kind : '-';
  if (kind === 'cyber' || kind === 'motel') firstHour.push(k);
  const where = `lot ${k} (${kind}, ${stackOf(city, k) ? 'drawn' : 'cut'})`;
  P.rooms.forEach((R, r) => {
    if (R.kind !== 'shop') return;
    const e = tally.get(kind) ?? [0, 0];
    e[0]++;
    tally.set(kind, e);
    const mine = P.furn.filter((f) => (cellAt(P, f.x, f.y) & ROOM) === r + 1);
    const tills = mine.filter((f) => f.kind === 'till');
    if (!tills.length) { e[1]++; return; }
    served.add(k);
    for (const f of mine) {
      if (f.posto?.kind === 'clerk' && !onFloor(P, r, f.posto)) say(`${where}: the clerk's place behind a ${f.kind} is not free floor`);
      if (['till', 'bar'].includes(f.kind) && f.posto?.kind !== 'clerk') say(`${where}: a ${f.kind} without its clerk`);
    }
    for (const t of tills) if (!t.serve || !onFloor(P, r, t.serve)) say(`${where}: no customer's place at the till`);
  });
});
let n = 0, none = 0;
for (const [k, [a, b]] of [...tally].sort()) { console.log(`${k.padEnd(12)} ${a} shops, ${b} without a model`); n += a; none += b; }
const must = firstHour.filter((k) => !served.has(k)).length;
console.log(`${n} shops, ${none} without a model (${((100 * none) / n).toFixed(1)}%)`);
console.log(`${firstHour.length} cybercafés and motels, ${must} without a till`);
console.log(bad || must ? `FAIL ${bad}${must ? `, ${must} cybercafés or motels without a model` : ''}` : 'ok');
