import { hash3, type Rng } from '../core/rng';
import { type City } from '../sim/city';
import { type Population } from '../sim/citizens';
import { calendar } from '../sim/clock';
import { citizenNames, petName, workplaceName } from './names';
import { selOf, type Ctx, type Sel } from './gen';
import PROFILES from './text/profiles.en.json';

/**
 * A citizen's voice: who they are, as conditions the text pieces can ask for (their age, family,
 * work, the hour and the weather when they speak), the real names of their life (their partner,
 * a kid, the pet, a colleague, the place they work), and their way of typing (the young drop
 * capitals and write "u", the old write full sentences, trail off with "..." and sign their name).
 * Every trait comes from the seed and the sim, so the same person always sounds the same.
 */
export const ageTag = (a: number) => (a < 13 ? 'kid' : a < 20 ? 'teen' : a < 35 ? 'young' : a < 55 ? 'adult' : a < 70 ? 'old' : 'senior');
const PETS = ['', 'cat', 'dog', 'bird', 'fish'];
const SEASON = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'fall', 'fall', 'fall', 'winter'];

/** What the moment is: the hour, the day, the season, the weather (temperature in °C, rain). */
export function momentTags(t: number, temp = 12, precip = 0, snow = false): string[] {
  const c = calendar(t), h = c.hour, T: string[] = [];
  T.push(h >= 5 && h < 11 ? 'morning' : h < 14 && h >= 11 ? 'noon' : h >= 14 && h < 18 ? 'afternoon' : h >= 18 && h < 22 ? 'evening' : 'late');
  T.push(c.weekday === 0 || c.weekday === 6 ? 'weekend' : 'weekday');
  if (c.weekday === 1) T.push('monday');
  if (c.weekday === 5) T.push('friday');
  T.push(SEASON[c.month - 1], `mon${c.month}`);
  if (temp < 4) T.push('cold');
  if (temp > 26) T.push('hot');
  if (precip > 0.15) T.push(snow ? 'snowy' : 'wet');
  return T;
}

/** Who someone is, as tags. */
export function personTags(P: Population, i: number): string[] {
  const T: string[] = [ageTag(P.age[i]), P.gender[i] ? 'm' : 'f'];
  const H = P.households[P.home[i]];
  if (P.spouse[i] >= 0) T.push('partner');
  if (H.n === 1) T.push('alone');
  let kids = 0;
  for (let k = 0; k < H.n; k++) if (P.age[H.m0 + k] < 18 && H.m0 + k !== i) kids++;
  if (kids && P.age[i] >= 20) T.push('kids');
  if (P.age[i] < 18) T.push('child');
  if (H.n > 1 && P.spouse[i] < 0 && !kids && P.age[i] >= 18 && P.age[i] < 40) T.push('roomies');
  if (H.pet) T.push('pet', PETS[H.pet]);
  T.push(['job', 'student', 'retired', 'jobless', 'school'][P.role[i]]);
  return T;
}

/** The conditions for citizen i speaking at time t, and their persona. */
export function selFor(P: Population, i: number, t: number, temp?: number, precip?: number, snow?: boolean, extra: string[] = []): Sel {
  return selOf([...personTags(P, i), ...momentTags(t, temp, precip, snow), ...extra], (hash3(P.seed, i, 0x5e1f) * 2147483647) | 1);
}

/** The names of someone's life, for the `{slots}` of the pieces. */
export function lifeCtx(city: City, P: Population, i: number, r: Rng): Ctx {
  const H = P.households[P.home[i]], c: Ctx = {};
  c.first = citizenNames(city, P, i)[0];
  if (P.spouse[i] >= 0) {
    c.partner = citizenNames(city, P, P.spouse[i])[0];
    c.partnerword = P.gender[P.spouse[i]] ? (r() < 0.5 ? 'my husband' : 'the hubby') : (r() < 0.5 ? 'my wife' : 'the wife');
  }
  const kids: number[] = [];
  for (let k = 0; k < H.n; k++) if (P.age[H.m0 + k] < 18 && H.m0 + k !== i) kids.push(H.m0 + k);
  if (kids.length) { const k = kids[Math.floor(r() * kids.length)]; c.kid = citizenNames(city, P, k)[0]; c.kidword = P.gender[k] ? 'my son' : 'my daughter'; c.kidage = String(P.age[k]); }
  if (H.pet) { c.petname = petName(H.petName); c.pettype = PETS[H.pet]; }
  if (P.job[i] >= 0) {
    c.job = workplaceName(city, P, P.job[i]);
    const st = P.workplaces[P.job[i]].staff, j = st[Math.floor(r() * st.length)];
    if (j !== undefined && j !== i) c.colleague = citizenNames(city, P, j)[0];
  }
  if (!c.colleague) c.colleague = 'Pat';
  const nf = P.friendAt[i + 1] - P.friendAt[i];
  if (nf) c.friend = citizenNames(city, P, P.friendList[P.friendAt[i] + Math.floor(r() * nf)])[0];
  const L = PROFILES.interest;
  c.interest = L[Math.floor(hash3(P.seed, i, 0x1e7) * L.length)];
  c.interest2 = L[Math.floor(hash3(P.seed, i, 0x1e8) * L.length)];
  return c;
}

/** Text speak of 2008, for the authors who use it. */
const SPEAK: [RegExp, string][] = [[/\byou\b/gi, 'u'], [/\bare\b/g, 'r'], [/\btonight\b/gi, '2nite'], [/\btomorrow\b/gi, '2morrow'], [/\bgreat\b/g, 'gr8'], [/\bbecause\b/gi, 'cuz'], [/\bplease\b/gi, 'plz'], [/\bthanks\b/gi, 'thx'], [/\bwith\b/g, 'w/'], [/\bpeople\b/g, 'ppl'], [/\bsee\b/g, 'c'], [/\bfor\b/g, '4'], [/\bto\b/g, '2'], [/\bwhat\b/g, 'wat'], [/\bokay\b/gi, 'k'], [/\breally\b/g, 'rly'], [/\bsomeone\b/g, 'some1'], [/\bbefore\b/g, 'b4'], [/\blater\b/g, 'l8r']];
const SMILEY = /(^|\s)([:;=x8B][-o']?[()DPpS/|3*\]\[]+|<3|\^_\^|-_-|>_<|T_T|o_O|O_O|x_x|@_@|u_u|zzz+)(?=\s|$)/g;

/** Typing the way citizen i types: kept the same in everything they write. */
export function voice(s: string, P: Population, i: number, r: Rng, sign = ''): string {
  const a = P.age[i], g = ageTag(a), h = (q: number) => hash3(P.seed ^ 0x7e, i, q);
  const lowerP = { kid: 0.6, teen: 0.5, young: 0.3, adult: 0.12, old: 0.05, senior: 0.03 }[g]!;
  const speakP = { kid: 0.5, teen: 0.45, young: 0.15, adult: 0.03, old: 0, senior: 0 }[g]!;
  const dotsP = { kid: 0, teen: 0.05, young: 0.06, adult: 0.12, old: 0.35, senior: 0.5 }[g]!;
  const stretchP = { kid: 0.4, teen: 0.4, young: 0.2, adult: 0.05, old: 0, senior: 0 }[g]!;
  // smileys are kept as they are through the changes below
  const keep: string[] = [];
  s = s.replace(SMILEY, (_, a: string, b: string) => `${a}\u0001${keep.push(b) - 1}\u0002`);
  if (h(4) < speakP) for (const [x, y] of SPEAK) if (r() < 0.8) s = s.replace(x, y);
  if (h(6) < stretchP && r() < 0.5) s = s.replace(/\b(so|yes|no|ugh|wow|yay)\b/i, (w) => w + w[w.length - 1].repeat(2 + Math.floor(r() * 3)));
  if (h(7) < dotsP) s = s.replace(/\. (?=[A-Za-z])/g, () => (r() < 0.6 ? '... ' : '. '));
  if (h(1) < lowerP) s = s.toLowerCase();
  else if ((g === 'senior' || g === 'old') && h(5) < 0.06) s = s.toUpperCase(); // the caps lock left on
  if (h(2) > (g === 'senior' ? 0.95 : 0.78)) s = s.replace(/\.$/, '');
  if (h(3) < (g === 'senior' || g === 'kid' ? 0.25 : 0.1) && r() < 0.5) {
    // a typo: two letters of a word swapped
    const words = s.split(' '), k = Math.floor(r() * words.length), w = words[k];
    if (w.length > 4 && !w.includes('\u0001')) { const j = 1 + Math.floor(r() * (w.length - 3)); words[k] = w.slice(0, j) + w[j + 1] + w[j] + w.slice(j + 2); s = words.join(' '); }
  }
  if (sign && (g === 'senior' ? h(8) < 0.4 : g === 'old' ? h(8) < 0.15 : false)) s += ` - ${sign}`;
  return s.replace(/\u0001(\d+)\u0002/g, (_, n: string) => keep[+n]);
}

/** Whether a person writes smileys at all (the old hardly ever do). */
export const usesSmileys = (P: Population, i: number) => hash3(P.seed ^ 0x7e, i, 9) < ({ kid: 0.9, teen: 0.9, young: 0.75, adult: 0.5, old: 0.2, senior: 0.08 }[ageTag(P.age[i])] ?? 0.5);
