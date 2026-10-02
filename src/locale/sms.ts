import { type World } from '../sim/world';
import { districtAt } from '../sim/city';
import { expand, rngOf, selOf, tidy } from './gen';
import { TEXT } from './text';
import { businessName, districtName } from './names';
import { lifeCtx, momentTags, selFor, voice } from './voice';
import NAMES from './text/names.en.json';

/**
 * Text messages from the city's people, put together by the text grammar (locale/text/sms.en.json):
 * a text sent to the player by mistake, an "oops" when the player answers it, a stranger's "who is
 * this?", a shop's automatic reply, a shop's advertising (`biz`, the business sending it). They are in the sender's voice (their age, family, the hour).
 * `q` (0..1) picks the words; `i` is the citizen sending it (-1 for a business).
 */
export function smsText(world: World, kind: 'wrong' | 'oops' | 'res' | 'biz' | 'promo' | 'annoyed', i: number, q: number, biz = -1): string {
  const r = rngOf(Math.floor(q * 2147483647), i, 0x5a5), W = world.weather, P = world.pop;
  const sel = i >= 0 ? selFor(P, i, world.time, W.temp, W.precip, W.snow) : selOf(momentTags(world.time, W.temp, W.precip, W.snow), 0);
  const ctx = i >= 0 ? lifeCtx(world.city, P, i, r) : {};
  const F = r() < 0.5 ? NAMES.female.mid : NAMES.male.mid;
  ctx.other = F[Math.floor(r() * F.length)];
  ctx.district = districtName(world.city, districtAt(world.city, world.player.x, world.player.y));
  ctx.friend = ctx.friend ?? ctx.other;
  if (biz >= 0) {
    ctx.biz = businessName(world.city, biz); ctx.BIZ = ctx.biz.toUpperCase();
    ctx.offer = expand(`#promo.${world.city.businesses[biz].kind}#`, TEXT, r, ctx, sel);
  }
  const s = tidy(expand(`#sms.${kind}#`, TEXT, r, ctx, sel));
  return i >= 0 ? voice(s, P, i, r) : s;
}
