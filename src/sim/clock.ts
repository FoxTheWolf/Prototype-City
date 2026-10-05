/**
 * Game time: seconds since midnight, January 1st 2008, running TIME_SCALE times faster than real
 * time. The calendar, the sun and the moon follow from it, for a city at about New York's latitude.
 */

/** Real minutes one game day lasts (as in GTA IV); change it here. */
export const DAY_REAL_MIN = 120;
/** Game seconds per real second. */
export const TIME_SCALE = 86400 / (DAY_REAL_MIN * 60);
export const YEAR0 = 2008;
/** The city's latitude, radians (the render's stars turn by it too). */
export const LAT = (40.71 * Math.PI) / 180; // New York's sky (LON below)
const DAY = 86400;

const leap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export interface Calendar {
  year: number;
  /** 0-based day of the year. */
  doy: number;
  /** 1..12 and 1..31. */
  month: number;
  day: number;
  /** 0 = Sunday. */
  weekday: number;
  /** Fractional hour of the day, 0..24. */
  hour: number;
}

export function calendar(t: number): Calendar {
  let days = Math.floor(t / DAY), year = YEAR0;
  const hour = (t - days * DAY) / 3600;
  // January 1st 2008 was a Tuesday
  const weekday = (((days + 2) % 7) + 7) % 7;
  while (days >= (leap(year) ? 366 : 365)) { days -= leap(year) ? 366 : 365; year++; }
  const doy = days;
  let month = 0;
  for (; month < 12; month++) {
    const n = MONTH_DAYS[month] + (month === 1 && leap(year) ? 1 : 0);
    if (days < n) break;
    days -= n;
  }
  return { year, doy, month: month + 1, day: days + 1, weekday, hour };
}

/** Elevation and azimuth (from north, clockwise) in radians of a body with declination dec at hour angle ha. */
function sky(dec: number, ha: number, out: Float64Array) {
  const el = Math.asin(Math.sin(LAT) * Math.sin(dec) + Math.cos(LAT) * Math.cos(dec) * Math.cos(ha));
  out[0] = el;
  out[1] = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(LAT) - Math.tan(dec) * Math.cos(LAT)) + Math.PI;
  return out;
}

// ---- the real sky of 2008 (Meeus, Astronomical Algorithms, low precision: the sun to 0.01 degree, the moon to a
// few tenths). The game's clock is the local mean time of the city's meridian, LON west of Greenwich, so the sun
// is due south near noon as before; JD0 is the Julian day of 2008-01-01 0h UT.
const LON = 74;
const JD0 = 2454466.5;
const RAD = Math.PI / 180;
/** Julian centuries since J2000 at game time t. */
const jc = (t: number) => (JD0 + (t + (LON / 15) * 3600) / DAY - 2451545) / 36525;
/** The local sidereal time at game time t, radians. */
export function siderealTime(t: number): number {
  const d = JD0 + (t + (LON / 15) * 3600) / DAY - 2451545;
  return (((280.46061837 + 360.98564736629 * d - LON) % 360) + 360) % 360 * RAD;
}
/** The obliquity of the ecliptic, radians. */
const obliq = (T: number) => (23.439291 - 0.0130042 * T) * RAD;
/** The sun's ecliptic longitude, radians. */
function sunLon(T: number): number {
  const L0 = 280.46646 + 36000.76983 * T, M = (357.52911 + 35999.05029 * T) * RAD;
  return (L0 + (1.914602 - 0.004817 * T) * Math.sin(M) + 0.019993 * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M)) * RAD;
}
/** The moon's ecliptic longitude and latitude, radians (the largest terms of Meeus' chapter 47). */
function moonEcl(T: number): [number, number] {
  const Lp = 218.3164477 + 481267.88123421 * T, D = (297.8501921 + 445267.1114034 * T) * RAD, M = (357.5291092 + 35999.0502909 * T) * RAD;
  const Mp = (134.9633964 + 477198.8675055 * T) * RAD, F = (93.272095 + 483202.0175233 * T) * RAD, s = Math.sin;
  const lon = Lp + 6.288774 * s(Mp) + 1.274027 * s(2 * D - Mp) + 0.658314 * s(2 * D) + 0.213618 * s(2 * Mp) - 0.185116 * s(M) - 0.114332 * s(2 * F)
    + 0.058793 * s(2 * D - 2 * Mp) + 0.057066 * s(2 * D - M - Mp) + 0.053322 * s(2 * D + Mp) + 0.045758 * s(2 * D - M) - 0.040923 * s(M - Mp) - 0.03472 * s(D) - 0.030383 * s(M + Mp);
  const lat = 5.128122 * s(F) + 0.280602 * s(Mp + F) + 0.277693 * s(Mp - F) + 0.173237 * s(2 * D - F) + 0.055413 * s(2 * D - Mp + F) + 0.046271 * s(2 * D - Mp - F);
  return [lon * RAD, lat * RAD];
}
/** Right ascension and declination (radians) of ecliptic longitude lon and latitude lat. */
function equatorial(lon: number, lat: number, eps: number): [number, number] {
  const ra = Math.atan2(Math.sin(lon) * Math.cos(eps) - Math.tan(lat) * Math.sin(eps), Math.cos(lon));
  return [ra, Math.asin(Math.sin(lat) * Math.cos(eps) + Math.cos(lat) * Math.sin(eps) * Math.sin(lon))];
}
/** The sun's right ascension and declination at game time t (for the tests). */
export function sunRaDec(t: number): [number, number] { const T = jc(t); return equatorial(sunLon(T), 0, obliq(T)); }
/** The moon's right ascension and declination at game time t (for the tests). */
export function moonRaDec(t: number): [number, number] { const T = jc(t), [l, b] = moonEcl(T); return equatorial(l, b, obliq(T)); }

/** The sun: [elevation, azimuth]. */
export function sunDir(t: number, out: Float64Array) {
  const [ra, dec] = sunRaDec(t);
  return sky(dec, siderealTime(t) - ra, out);
}

/** Moon phase: 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter (its longitude ahead of the sun's). */
export function moonPhase(t: number): number {
  const T = jc(t), p = (moonEcl(T)[0] - sunLon(T)) / (2 * Math.PI);
  return p - Math.floor(p);
}

/** The moon: [elevation, azimuth], as seen from the city (its parallax lowers it by up to a degree). */
export function moonDir(t: number, out: Float64Array) {
  const [ra, dec] = moonRaDec(t);
  sky(dec, siderealTime(t) - ra, out);
  out[0] -= 0.951 * RAD * Math.cos(out[0]);
  return out;
}
