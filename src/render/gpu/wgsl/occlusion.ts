import { BLD, BLK } from './common';

export const occlusionWGSL = (): string => /* wgsl */ `// ---- the sky's occlusion (L.4): how much of the sky a point sees, past the buildings round it
/** How far the horizon is looked for (m), how many directions round a point on the ground, and how far from the viewer it is
 *  worked out (past it the occlusion fades to none over the last third). */
const SKY_R = 110.0; const SKY_FAR = 700.0;
/** The highest a building rises above (px, py, pz) seen along (rdx, rdy), as the tangent of its elevation, within SKY_R. */
fn horizonTan(px: f32, py: f32, pz: f32, rdx: f32, rdy: f32) -> f32 {
  let ix = select(1e12, 1.0 / rdx, rdx != 0.0); let iy = select(1e12, 1.0 / rdy, rdy != 0.0);
  let stX = select(1, -1, rdx < 0.0); let stY = select(1, -1, rdy < 0.0);
  let W = nXC; let H = nYC;
  if (px < 0.0 || py < 0.0 || px >= f32(W) || py >= f32(H)) { return 0.0; }
  var cx = i32(xcU(u32(u32(px)))); var cy = i32(ycU(u32(u32(py))));
  let nx = i32(u.nxb) - 1; let ny = i32(u.nyb) - 1;
  var tx = (select(xbF(u32(cx + 1)), xbF(u32(cx)), rdx < 0.0) - px) * ix;
  var ty = (select(ybF(u32(cy + 1)), ybF(u32(cy)), rdy < 0.0) - py) * iy;
  var tIn = 0.0; var best = 0.0; gHzQ = -1;
  for (var s = 0; s < 64; s++) {
    if (tIn > SKY_R || (SHADOW_TOP - pz) < best * tIn) { break; }
    if ((cx & 1) == 1 && (cy & 1) == 1) {
      let o = u32(((cy >> 1) * i32(u.nbx) + (cx >> 1)) * ${BLK});
      let b0 = i32(blkF(u32(o + 4u))); let b1 = i32(blkF(u32(o + 5u)));
      if (b1 > b0 && blkF(u32(o + 6u)) - pz > best * max(tIn, 0.5)) {
        for (var q0 = b0; q0 < b1; q0++) {
          let q = u32(q0 * ${BLD});
          let x0 = bldF(u32(q)); let y0 = bldF(u32(q + 1u)); let x1 = bldF(u32(q + 2u)); let y1 = bldF(u32(q + 3u)); let h = bldF(u32(q + 4u));
          if (h - pz <= best * max(tIn, 0.5)) { continue; }
          var tN = 0.0; var tF = 0.0;
          if (bldF(u32(q + 5u)) > 0.5) {
            let rr = (x1 - x0) * 0.5; let ox = px - (x0 + rr); let oy = py - (y0 + rr);
            let qb = ox * rdx + oy * rdy; let disc = qb * qb - (ox * ox + oy * oy - rr * rr);
            if (disc <= 0.0) { continue; }
            tN = -qb - sqrt(disc); tF = -qb + sqrt(disc);
          } else {
            let ax = (x0 - px) * ix; let bx = (x1 - px) * ix; let ay = (y0 - py) * iy; let by = (y1 - py) * iy;
            tN = max(min(ax, bx), min(ay, by)); tF = min(max(ax, bx), max(ay, by));
            if (bldF(u32(q + 6u)) > 0.5) {
              let knx = bldF(u32(q + 7u)); let kny = bldF(u32(q + 8u)); let kc = bldF(u32(q + 9u));
              let dn = knx * rdx + kny * rdy; let th = (kc - knx * px - kny * py) / dn;
              if (dn < 0.0) { tN = max(tN, th); } else if (dn > 0.0) { tF = min(tF, th); } else if (knx * px + kny * py > kc) { continue; }
            }
          }
          if (tF <= 0.03 || tN >= tF || tN > SKY_R) { continue; }
          let tb = (h - pz) / max(tN, 0.5);
          if (tb > best) {
            // the face the ray meets (a round tower's, or the cut's, roughly: back along the ray)
            best = tb; gHzQ = i32(q);
            if (bldF(u32(q + 5u)) > 0.5) { gHzN = vec2f(-rdx, -rdy); }
            else if (bldF(u32(q + 6u)) > 0.5 && tN > max(min((x0 - px) * ix, (x1 - px) * ix), min((y0 - py) * iy, (y1 - py) * iy)) + 1e-3) { gHzN = vec2f(bldF(u32(q + 7u)), bldF(u32(q + 8u))); }
            else if (min((x0 - px) * ix, (x1 - px) * ix) > min((y0 - py) * iy, (y1 - py) * iy)) { gHzN = vec2f(select(1.0, -1.0, rdx > 0.0), 0.0); }
            else { gHzN = vec2f(0.0, select(1.0, -1.0, rdy > 0.0)); }
          }
        }
      }
    }
    if (tx < ty) { cx += stX; tIn = tx; if (cx < 0 || cx >= nx) { break; } tx = (select(xbF(u32(cx + 1)), xbF(u32(cx)), rdx < 0.0) - px) * ix; }
    else { cy += stY; tIn = ty; if (cy < 0 || cy >= ny) { break; } ty = (select(ybF(u32(cy + 1)), ybF(u32(cy)), rdy < 0.0) - py) * iy; }
  }
  return best;
}
/** The share of the sky's light a surface at P with normal N gets past the buildings (1: open sky), cosine-weighted:
 *  a floor sees cos^2 of each direction's horizon; a wall only the sky in front of it, each slice by how it faces it.
 *  No sorting by cell: it moves smoothly with the point, so no glyph flickers. */
const SKY_DIRS = 16;
fn skyView(P: vec3f, N: vec3f) -> f32 {
  let up = N.z > 0.7;
  gBncA = vec3f(0.0); gBncS = vec3f(0.0);
  if (up) {
    // (16 directions: with 8, each corner of a building crossing one of them cut a straight wedge of shade into the street)
    var s = 0.0;
    for (var k = 0; k < SKY_DIRS; k++) {
      let a = (f32(k) + 0.5) * (6.283185 / f32(SKY_DIRS)); let tn = horizonTan(P.x, P.y, P.z + 0.3, cos(a), sin(a));
      s += 1.0 / (1.0 + tn * tn);
      bounceFrom(tn * tn / (1.0 + tn * tn) / f32(SKY_DIRS));
    }
    return s / f32(SKY_DIRS);
  }
  let n = normalize(vec2f(N.x, N.y) + vec2f(1e-5, 0.0));
  var s = 0.0; var wsum = 0.0;
  for (var k = -2; k <= 2; k++) {
    let a = f32(k) * 0.6; let w = cos(a);
    let d = vec2f(n.x * cos(a) - n.y * sin(a), n.x * sin(a) + n.y * cos(a));
    let th = atan(horizonTan(P.x + n.x * 0.15, P.y + n.y * 0.15, P.z, d.x, d.y));
    let sl = (0.785398 - th * 0.5 - sin(2.0 * th) * 0.25) / 0.785398;
    s += w * sl; wsum += w;
    bounceFrom(w * (1.0 - sl) / 3.37); // (3.37: the sum of the slices' weights)
  }
  // a wall also sees half its hemisphere below the horizon: the ground's light (the bounce, in light) stands in for it
  return mix(s / wsum, 1.0, max(0.0, N.z));
}
/** The building that rose highest in the last horizonTan (its offset in bld, -1: none) and the normal of its face met. */
var<private> gHzQ: i32 = -1;
var<private> gHzN: vec2f = vec2f(0.0);
/**
 * What the buildings hiding the sky give back (skyView), in their own colors (L.8): their albedo x the share of the sky
 * they hide (gBncA, lit by the sky) and x how their face meets the sun too (gBncS); a sunlit wall's warm afternoon
 * light reaches the street and the wall across from it.
 */
var<private> gBncA: vec3f = vec3f(0.0);
var<private> gBncS: vec3f = vec3f(0.0);
fn bounceFrom(w: f32) {
  if (gHzQ < 0 || w <= 0.0) { return; }
  let q = u32(gHzQ);
  // a facade: its wall color, darkened a little by its windows
  var A = lin(mix(colAt(q + 15u), vec3f(55.0, 62.0, 78.0), 0.3)) * DAY_ALBEDO;
  let am = max(A.x, max(A.y, A.z)); if (am > DAY_ALB_MAX) { A *= DAY_ALB_MAX / am; }
  gBncA += A * w;
  gBncS += A * (w * max(0.0, gHzN.x * u.sunX + gHzN.y * u.sunY));
}
/** How far from the viewer the street objects' shadows are traced (m). */
const OBJ_SHADOW_FAR = 120.0;
/** This cell's sunlight after the shadows (sunLit), for finish. */
var<private> gSun: f32 = 1.0;
/** Whether the moon reaches this cell past the buildings (1) or not (0), for finish. */
var<private> gMoon: f32 = 1.0;
/** This cell's share of the sky past the buildings (skyView), for finish. */
var<private> gSky: f32 = 1.0;
// what of the cell's color is light it gives off (a lit window, a sign, a lamp) and light it gets from the
// lamps (street lamps, floodlights, headlights), for the cell at depth gTag; set where the cell is made
var<private> gEm: vec3f = vec3f(0.0);
var<private> gIl: vec3f = vec3f(0.0);
var<private> gTag: f32 = -1.0;
// how strongly the finished cell glows onto its neighbors (0..1), written with it (the background's alpha)
var<private> gGlow: f32 = 0.0;
// how much of a cell's light blooms (a lit doorway or a floodlight's lamp less than a sign)
var<private> gGlowK: f32 = 1.0;
// how much brighter than drawn a cell's own light looks (the signs: lit to the eye, apart from the light they cast)
var<private> gEmK: f32 = 1.0;
// the material, the surface's normal (toward the viewer) and how wet it is, of the cell at gTag (R.23)
var<private> gMat: u32 = 0u;
var<private> gNrm: vec3f = vec3f(0.0, 0.0, 1.0);
var<private> gWet: f32 = 0.0;
// the hue of this cell's surface (its palette color, saturated, max channel 1), for the light and the paint's reflection
var<private> gTint: vec3f = vec3f(1.0);
// this cell's ray (unit, the way it travels)
var<private> gRay: vec3f = vec3f(1.0, 0.0, 0.0);
// where the rays through the city start (the eye; a mirror's spot for a reflection), and whether it is one
var<private> gOX: f32 = 0.0;
var<private> gOY: f32 = 0.0;
var<private> gOZ: f32 = 0.0;
var<private> gRefl: bool = false;
// (13.10b2) a room seen from the street through to a window on its far side: where the walk met that glass (gBack,
// roomWalk), and for the cell wallCell made, how far off the far glass is (gBackT, 0 none), where the near window is,
// and how much of the cell is the room (peekK); main sends a second ray on through it to the street behind
var<private> gBack: f32 = 0.0;
var<private> gBackT: f32 = 0.0;
var<private> gBackW: f32 = 0.0;
var<private> gBackK: f32 = 0.0;
// a lit piece of furniture (a screen, a lamp) met by peekRoom: its glow, so it blooms seen from the street as from inside
var<private> gPeekEm: vec3f = vec3f(0.0);
// (13.10d2) how far off what peekRoom met really is: the cell keeps the facade's depth, but the light in the hand
// falls on the room behind the glass or the doorway, as it does seen from inside
var<private> gPeekT: f32 = 0.0;
/** The viewer's stairwell (roomWalk): the walk left the storey through it (1 up, -1 down, 0 not), where, and the plan it went into. */
var<private> gWell: i32 = 0;
/** The viewer's stairwell (x0, y0, x1, y1; empty when none), the same on every storey; and whether the walk is a storey seen through it. */
var<private> gWR: vec4f = vec4f(0.0);
var<private> gThru: bool = false;
fn inWellRect(x: f32, y: f32) -> bool { return x > gWR.x && x < gWR.z && y > gWR.y && y < gWR.w; }
var<private> gWellT: f32 = 0.0;
var<private> gWellO: u32 = 0u;

`;
