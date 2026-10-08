/**
 * The lot sizes against the interiors catalog (the interiors manual, section 3; plano-interiores step 1):
 *   npx rolldown tests/lots.ts --format esm --platform node -o tests/.out/lots.mjs && node tests/.out/lots.mjs [seed...]
 * One seed per run (doorOf keeps a cache by building index). For each building with a street door: its width along the door's face and its depth, counted against the catalog.
 */
import { generateCity } from '../src/sim/city';
import { CITY_SIZE } from '../src/sim/world';
import { doorOf } from '../src/sim/interior';

const seeds = process.argv.length > 2 ? process.argv.slice(2).map(Number) : [42];
const TOWERS = ['16x16', '16x24', '20x20', '24x24', '24x32'];
export function inCatalog(w: number, d: number, floors: number): boolean {
  if (floors >= 6 || w >= 16) return TOWERS.includes(`${w}x${d}`) || TOWERS.includes(`${d}x${w}`);
  return [8, 10, 12].includes(w) && d >= w && d <= 24 && d % 2 === 0;
}
for (const seed of seeds) {
  const city = generateCity(seed, CITY_SIZE);
  const tally = new Map<string, number>();
  let n = 0, ok = 0, noDoor = 0;
  city.buildings.forEach((B, k) => {
    if (B.tier !== 1) return;
    const D = doorOf(city, k);
    if (!D) { noDoor++; return; }
    const along = D.face < 2 ? B.y1 - B.y0 : B.x1 - B.x0, depth = D.face < 2 ? B.x1 - B.x0 : B.y1 - B.y0;
    const floors = Math.round(B.h / 3.5);
    const w = Math.round(along), d = Math.round(depth), key = `${w}x${d}${floors >= 6 ? ' T' : ''}`;
    tally.set(key, (tally.get(key) ?? 0) + 1);
    n++; if (inCatalog(w, d, floors)) ok++;
  });
  console.log(`seed ${seed}: ${n} buildings with a door (${noDoor} without), ${ok} in the catalog (${((100 * ok) / n).toFixed(1)}%)`);
  console.log([...tally].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => `${k}:${v}`).join('  '));
}
// how many of the misses are wider than deep, and how many of those stand on a corner (a street on the short side too)
import { blockAt } from '../src/sim/city';
for (const seed of seeds) {
  const city = generateCity(seed, CITY_SIZE);
  let wide = 0, corner = 0, tallNarrow = 0, other = 0;
  const misses = new Map<string, number>();
  city.buildings.forEach((B, k) => {
    if (B.tier !== 1) return;
    const D = doorOf(city, k)!; if (!D) return;
    const w = Math.round(D.face < 2 ? B.y1 - B.y0 : B.x1 - B.x0), d = Math.round(D.face < 2 ? B.x1 - B.x0 : B.y1 - B.y0), floors = Math.round(B.h / 3.5);
    if (inCatalog(w, d, floors)) return;
    if (floors >= 6 && Math.min(w, d) < 16) { tallNarrow++; return; }
    if (w > d) {
      wide++;
      const blk = blockAt(city, (B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2)!;
      const E = 4.01, side = D.face < 2 ? [B.y0 - blk.y0 <= E, blk.y1 - B.y1 <= E] : [B.x0 - blk.x0 <= E, blk.x1 - B.x1 <= E];
      if (side[0] || side[1]) corner++;
    } else { other++; const key = `${w}x${d}${floors >= 6 ? ' T' : ''}`; misses.set(key, (misses.get(key) ?? 0) + 1); }
  });
  console.log(`seed ${seed} misses: ${wide} wider than deep (${corner} on a corner), ${tallNarrow} tall and narrow (6+ floors under 16 m), ${other} other`);
  console.log('  other: ' + [...misses].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([k, v]) => `${k}:${v}`).join('  '));
}
