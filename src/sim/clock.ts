/**
 * Game time: seconds since midnight, January 1st 2008, running TIME_SCALE times faster than real
 * time. The calendar, the sun and the moon follow from it, for a city at about New York's latitude.
 */

/** Real minutes one game day lasts (as in GTA IV); change it here. */
export const DAY_REAL_MIN = 48;
/** Game seconds per real second. */
export const TIME_SCALE = 86400 / (DAY_REAL_MIN * 60);
export const YEAR0 = 2008;
const LAT = (41 * Math.PI) / 180;
const TILT = (23.44 * Math.PI) / 180;
const DAY = 86400;
/** A real new moon: 2008-01-08 11:37 UTC, as game time. */
const NEW_MOON = 7 * DAY + 11.62 * 3600;
const SYNODIC = 29.530589 * DAY;

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

/** The sun's ecliptic longitude, roughly (0 at the March equinox). */
const sunLon = (t: number) => (2 * Math.PI * (t / DAY - 79)) / 365.25;

/** The sun: [elevation, azimuth]. */
export function sunDir(t: number, out: Float64Array) {
  const hour = (((t / 3600) % 24) + 24) % 24;
  return sky(Math.asin(Math.sin(TILT) * Math.sin(sunLon(t))), ((hour - 12) * Math.PI) / 12, out);
}

/** Moon phase: 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter. */
export function moonPhase(t: number): number {
  const p = (t - NEW_MOON) / SYNODIC;
  return p - Math.floor(p);
}

/**
 * The moon: [elevation, azimuth]. It trails the sun by its phase (rising about 50 minutes later
 * every day) and sits on the ecliptic that far from the sun, ignoring its 5 degree tilt.
 */
export function moonDir(t: number, out: Float64Array) {
  const hour = (((t / 3600) % 24) + 24) % 24, p = moonPhase(t);
  return sky(Math.asin(Math.sin(TILT) * Math.sin(sunLon(t) + 2 * Math.PI * p)), ((hour - 12) * Math.PI) / 12 - 2 * Math.PI * p, out);
}
