/**
 * The real sky (sim/clock.ts) against the worked examples of Meeus' Astronomical Algorithms, and one event of 2008.
 * Run: npx rolldown tests/sky.ts --format esm --platform node -o tests/.out/sky.mjs && node tests/.out/sky.mjs
 */
import { LAT, moonDir, moonPhase, moonRaDec, siderealTime, sunDir, sunRaDec } from '../src/sim/clock';

const JD0 = 2454466.5, LON = 74, DEG = 180 / Math.PI;
/** Game time of a Julian day (UT). */
const at = (jd: number) => (jd - JD0) * 86400 - (LON / 15) * 3600;
let fails = 0;
function near(what: string, got: number, want: number, tol: number) {
  const d = Math.abs(((got - want + 540) % 360) - 180);
  const ok = d <= tol;
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}: ${got.toFixed(3)} (want ${want.toFixed(3)}, off ${d.toFixed(3)}, tol ${tol})`);
}

// 12.a: 1987 April 10, 0h UT, the mean sidereal time at Greenwich 13h10m46.3668s
near('GMST 1987-04-10', siderealTime(at(2446895.5)) * DEG + LON, 197.693195, 0.001);
// 25.a: 1992 October 13, 0h, the sun at RA 198.38083, dec -7.78507
const S = sunRaDec(at(2448908.5));
near('sun RA 1992-10-13', S[0] * DEG, 198.38083, 0.02);
near('sun dec 1992-10-13', S[1] * DEG, -7.78507, 0.02);
// 47.a: 1992 April 12, 0h, the moon at RA 134.688470, dec 13.768368
const M = moonRaDec(at(2448724.5));
near('moon RA 1992-04-12', M[0] * DEG, 134.68847, 0.3);
near('moon dec 1992-04-12', M[1] * DEG, 13.768368, 0.3);
// the total lunar eclipse of 2008-02-21, greatest at 03:26 UT: full, high in the south-east of the city's sky
const ecl = at(2454517.5 + 3.43 / 24);
near('phase at the eclipse of 2008-02-21', moonPhase(ecl) * 360, 180, 2);
const o = new Float64Array(2);
moonDir(ecl, o);
console.log(`     the moon then: elevation ${(o[0] * DEG).toFixed(1)}, azimuth ${(o[1] * DEG).toFixed(1)}`);
sunDir(ecl, o);
console.log(`     the sun then: elevation ${(o[0] * DEG).toFixed(1)}`);
if (o[0] > 0) fails++;
// a night in the game's first week: the moon's elevation through it, one line an hour
for (let h = 18; h <= 30; h += 2) { moonDir(3 * 86400 + h * 3600, o); console.log(`     Jan 4 ${String(h % 24).padStart(2, '0')}:00 moon el ${(o[0] * DEG).toFixed(1)} az ${(o[1] * DEG).toFixed(1)} phase ${moonPhase(3 * 86400 + h * 3600).toFixed(2)}`); }
// the shader's turn of a world direction into the equator's frame (gpu/shader.ts eqDir), against Vega and Polaris
// placed by the hour angle: elevation and azimuth to a world direction (x east, y south, z up), and back
const eqDir = (v: number[], lst: number) => {
  const n = -v[1], P = -n * Math.sin(LAT) + v[2] * Math.cos(LAT), Q = -v[0], R = n * Math.cos(LAT) + v[2] * Math.sin(LAT);
  return [Math.cos(lst) * P + Math.sin(lst) * Q, Math.sin(lst) * P - Math.cos(lst) * Q, R];
};
for (const [name, ra, dec] of [['Vega', 279.23, 38.78], ['Polaris', 37.95, 89.26], ['Sirius', 101.29, -16.72]] as const) {
  const t = 40 * 86400 + 21 * 3600, lst = siderealTime(t), a = ra / DEG, d = dec / DEG, ha = lst - a;
  const el = Math.asin(Math.sin(LAT) * Math.sin(d) + Math.cos(LAT) * Math.cos(d) * Math.cos(ha));
  const az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(LAT) - Math.tan(d) * Math.cos(LAT)) + Math.PI;
  const h = az - Math.PI / 2, v = [Math.cos(h) * Math.cos(el), Math.sin(h) * Math.cos(el), Math.sin(el)];
  const e = eqDir(v, lst), want = [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
  near(`${name} through eqDir (el ${(el * DEG).toFixed(1)}, az ${(az * DEG).toFixed(1)})`, Math.acos(Math.min(1, e[0] * want[0] + e[1] * want[1] + e[2] * want[2])) * DEG, 0, 0.01);
}
console.log(fails ? `${fails} failed` : 'all ok');
process.exit(fails ? 1 : 0);
