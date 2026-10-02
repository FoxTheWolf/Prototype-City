import { hash3 } from '../core/rng';
import { districtAt, type City } from '../sim/city';
import { type Post } from '../sim/social';
import { businessName, districtName } from './names';
import S from './social.en.json';

/**
 * The words of a post (see sim/social.ts): a line for its kind, with the places that are real filled
 * in, in its author's own way of typing (some never use capitals, some drop the full stop).
 */
export function postText(city: City, p: Post): string {
  const all = (S.posts as Record<string, string[]>)[p.kind] ?? [''];
  const fits = p.biz >= 0 ? all : all.filter((l) => !l.includes('{biz}'));
  let s = fits[p.pick % fits.length]
    .replace('{biz}', p.biz >= 0 ? businessName(city, p.biz) : '')
    .replace('{district}', districtName(city, districtAt(city, p.x, p.y)));
  const style = hash3(p.who, 0x7e, 1);
  if (style < 0.3) s = s.toLowerCase();
  if (style > 0.8 && s.endsWith('.')) s = s.slice(0, -1);
  return s;
}

/** How long ago a post went up, as the feed shows it. */
export function postAge(t: number, at: number): string {
  const m = Math.floor((t - at) / 60);
  if (m < 1) return S.ago.now;
  return m < 60 ? S.ago.m.replace('{n}', String(m)) : S.ago.h.replace('{n}', String(Math.floor(m / 60)));
}

export const SOCIAL = S;
