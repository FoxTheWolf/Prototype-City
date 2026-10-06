/**
 * [HACKING] WEP IV capture → crack (the next of the Trilha, 2026-10-06), run in Node:
 *   npx rolldown tests/wep.ts --format esm --platform node -o tests/.out/wep.mjs && node tests/.out/wep.mjs [seed...]
 * Checks: the substations' GRIDLINK links are WEP with 10-digit keys; wepIvRate is 0 out of range and
 * climbs with signal; a capture written off a GRIDLINK BSSID with enough IVs resolves to that AP's key,
 * and too few IVs does not. The success depends only on how long the player captured (the IV count),
 * never on the simulation's traffic.
 */
import { generateCity } from '../src/sim/city';
import { buildPower } from '../src/sim/power';
import { buildWifi, Sec } from '../src/sim/wifi';
import { CITY_SIZE } from '../src/sim/world';
import { WEP_IVS, wepIvRate, parseCapture } from '../src/laptop/shell';

const seeds = process.argv.length > 2 ? process.argv.slice(2).map(Number) : [42, 711445483, 7, 1, 2, 3];
let fails = 0;
const fail = (m: string) => { if (++fails <= 30) console.log('FAIL ' + m); };

// --- wepIvRate (pure)
if (wepIvRate(-90) !== 0 || wepIvRate(-120) !== 0) fail('rate should be 0 at/below -90 dBm');
if (!(wepIvRate(-55) > wepIvRate(-75) && wepIvRate(-75) > wepIvRate(-88))) fail('rate should climb with signal');
// a strong signal (~-55 dBm) reaches the threshold in a plausible stand (each step ~0.4 s)
const stepsStrong = Math.ceil(WEP_IVS / wepIvRate(-55));
if (!(stepsStrong > 0 && stepsStrong < 120)) fail(`strong signal should fill in < 120 steps, got ${stepsStrong}`);
// a weak-but-usable signal is clearly slower (the cost of standing far)
if (!(Math.ceil(WEP_IVS / wepIvRate(-82)) > stepsStrong * 2)) fail('weak signal should take much longer than strong');

// --- parseCapture round-trip
const sample = `# tdump WEP IV capture\nESSID GRIDLINK-03\nBSSID AA:BB:CC:DD:EE:FF\nCH 6\n#Data 23456\n`;
const pc = parseCapture(sample);
if (!pc || pc.bssid !== 'AA:BB:CC:DD:EE:FF' || pc.ivs !== 23456) fail('parseCapture should read BSSID and #Data');
if (parseCapture('nonsense') !== null) fail('parseCapture should reject a non-capture');

// --- per seed: the WEP links exist, and a capture of one cracks to its key (enough IVs) but not with too few
for (const seed of seeds) {
  const city = generateCity(seed, CITY_SIZE);
  const power = buildPower(seed, city);
  const wifi = buildWifi(seed, city, city.cx, city.cy, power);
  const gridlinks = wifi.filter((a) => a.util >= 0);
  if (gridlinks.length !== power.subs.length) fail(`seed ${seed}: ${gridlinks.length} GRIDLINK links for ${power.subs.length} substations`);
  for (const a of gridlinks) {
    if (a.sec !== Sec.WEP) fail(`seed ${seed}: a GRIDLINK link is not WEP`);
    if (!/^\d{10}$/.test(a.key)) fail(`seed ${seed}: WEP key is not 10 digits ("${a.key}")`);
  }
  // simulate a capture file off the first GRIDLINK and "crack" it the way the shell's wcrack does
  const target = gridlinks[0];
  const crack = (ivs: number) => {
    const cap = parseCapture(`BSSID ${target.bssid}\n#Data ${ivs}\n`)!;
    const i = wifi.findIndex((A) => A.bssid === cap.bssid && A.sec === Sec.WEP);
    return i >= 0 && cap.ivs >= WEP_IVS ? wifi[i].key : null;
  };
  if (crack(WEP_IVS) !== target.key) fail(`seed ${seed}: enough IVs should resolve the key`);
  if (crack(WEP_IVS - 1) !== null) fail(`seed ${seed}: too few IVs should not resolve the key`);
  // the operator's OMC link is WEP too (one in the city)
  const omc = wifi.filter((a) => a.omc);
  if (omc.length && omc[0].sec !== Sec.WEP) fail(`seed ${seed}: the OMC link should be WEP`);
  console.log(`seed ${seed}: ${gridlinks.length} GRIDLINK WEP links, crack of ${target.bssid} → ${target.key}`);
}

console.log(fails ? `${fails} failure(s)` : `OK — WEP links are 10-digit WEP, capture fills by signal, enough IVs crack and too few do not (threshold ${WEP_IVS})`);
process.exit(fails ? 1 : 0);
