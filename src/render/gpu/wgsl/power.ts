import { SURGE, SURGE_K } from '../../power';

export const powerWGSL = (): string => /* wgsl */ `// ---- power (render/power.ts): one element's light level now, from its substation's state
fn power(sub: i32, x: f32, y: f32, id: i32, gen: bool, group: i32, spread: f32) -> f32 {
  let o = u32(sub) * 4u;
  let changed = subs[o];
  if (changed < 0.0) { return 1.0; }
  let since = u.sec - changed; let d = length(vec2f(x - subs[o + 2u], y - subs[o + 3u]));
  let hb = hash3(group, sub, 404); let hw = hash3(id, sub, 407);
  if (subs[o + 1u] < 0.5) {
    // (L.12) the surge: everything swells together, then holds brighter until the ring arrives (render/power.ts)
    if (since < ${SURGE}) { return 1.0 + ${SURGE_K.toFixed(3)} * smoothstep(0.0, ${SURGE}, since); }
    let t = since - ${SURGE} - d / 120.0 - hb * 0.3 - hw * spread;
    if (t < 0.0) { return ${(1 + SURGE_K).toFixed(3)}; }
    if (t < 0.32) { return select(0.05, 1.25, hash3(id, ifloor(t * 28.0), 405) < 0.45); }
    if (gen && t > 3.0) { return min(0.55, (t - 3.0) * 0.4); }
    return 0.0;
  }
  let t = since - (0.4 + d / 120.0 + hb * 2.0 + hw * spread * 2.0);
  if (t < 0.0) { return select(0.0, 0.55, gen); }
  return select(1.0, 0.15, t < 0.7 && hash3(id, ifloor(t * 18.0), 406) < 0.5);
}

/** The power element a window belongs to: in a blackout the windows go (and come back) together by
 *  whole floors in some buildings, by runs of 4..8 windows in the others, not one by one. */
fn winGroup(bk: i32, wi: i32, fl: i32) -> i32 {
  let h = hash3(bk, 0, 408);
  if (h < 0.35) { return bk * 131 + fl * 7; }
  return bk * 131 + (wi / (4 + i32(fract(h * 13.0) * 5.0))) * 977 + fl * 7;
}

`;
