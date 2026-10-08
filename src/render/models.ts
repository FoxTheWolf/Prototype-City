import { hash3 } from '../core/rng';
import { type DistrictType, type RGB } from '../sim/city';
import { type Population } from '../sim/citizens';
import { looksOf } from '../sim/looks';
import { Mat, part, Shape, type Part } from './objects';

const { Box, Cyl, Ball } = Shape;
const { Solid, Leaf, Glow, Text, Board, Wheel, Glass, Screen, Skin } = Mat;

const GLASS: RGB = [45, 65, 95];
const TIRE: RGB = [28, 28, 32];
const STEEL: RGB = [100, 100, 110];

/** Clothes and skin for the people seen in vehicles (and, later, on the sidewalks). */
const CLOTHES: RGB[] = [[150, 40, 45], [40, 60, 110], [70, 70, 75], [180, 170, 150], [50, 100, 70], [120, 80, 50], [200, 200, 205], [30, 30, 34]];
const SKIN: RGB[] = [[225, 185, 150], [190, 140, 100], [140, 95, 65], [95, 65, 45]];
/** The RGB of sim/looks.ts's TONES, HAIRS and CLOTHS, in their order. */
const TONE_RGB: RGB[] = [[235, 200, 175], [225, 185, 150], [200, 155, 115], [170, 120, 85], [130, 88, 60], [90, 62, 44]];

/** A person sitting in a vehicle at (x, y), seat at z: torso and head, colors from `who`. */
function seated(m: Part[], x: number, y: number, z: number, who: number) {
  const shirt = CLOTHES[who % CLOTHES.length], skin = SKIN[(who >> 3) % SKIN.length];
  m.push(part(Box, x - 0.18, y - 0.2, z, x + 0.12, y + 0.2, z + 0.45, shirt, Solid, '#', '=', '#'));
  m.push(part(Ball, x - 0.12, y - 0.11, z + 0.47, x + 0.12, y + 0.11, z + 0.76, skin, Solid, '@'));
}

const cars = new Map<string, Part[]>();
/** A sedan 4.4 m long, with see-through windows and the driver inside (and a passenger, by `who`); taxis carry a lit roof sign. */
export function carModel(col: RGB, taxi: boolean, who = 0): Part[] {
  const key = col.join() + taxi + who;
  let m = cars.get(key);
  if (m) return m;
  m = [
    part(Box, -2.2, -0.9, 0.35, 2.2, 0.9, 0.95, col, Solid, '#', '=', '#'),
    part(Box, -1.1, -0.82, 0.95, 0.9, 0.82, 1.4, GLASS, Glass, '=', '=', '='),
    part(Box, -1.0, -0.8, 1.4, 0.8, 0.8, 1.5, col, Solid, '-', '_', '-'),
    part(Box, -0.6, -0.75, 0.6, -0.48, 0.75, 1.25, [40, 38, 42], Solid, '|', '=', '|'),
  ];
  seated(m, -0.15, -0.42, 0.62, who); // the driver on the left (-y)
  if (who & 4) seated(m, -0.15, 0.42, 0.62, who * 7 + 3);
  for (const wx of [-1.4, 1.4]) for (const wy of [-1, 1]) m.push(part(Ball, wx - 0.34, wy * 0.95 - 0.13, 0, wx + 0.34, wy * 0.95 + 0.13, 0.68, TIRE, Wheel, 'o'));
  for (const wy of [-1, 1]) {
    const a = wy * 0.45, b = wy * 0.8;
    m.push(part(Box, 2.19, Math.min(a, b), 0.62, 2.25, Math.max(a, b), 0.82, [255, 245, 200], Glow, '@'));
    m.push(part(Box, -2.25, Math.min(a, b), 0.62, -2.19, Math.max(a, b), 0.82, [255, 40, 40], Glow, '@'));
  }
  if (taxi) m.push(part(Box, -0.3, -0.3, 1.5, 0.2, 0.3, 1.75, [255, 215, 90], Glow, '#'));
  cars.set(key, m);
  return m;
}

const HEAD: RGB = [255, 245, 200], TAIL: RGB = [255, 40, 40];
/** Wheels at the given x positions, and head and tail lamps at the ends (half length hl, half width hw). */
function running(m: Part[], xs: number[], hl: number, hw: number, r = 0.34) {
  for (const wx of xs) for (const wy of [-1, 1]) m.push(part(Ball, wx - r, wy * hw - 0.13, 0, wx + r, wy * hw + 0.13, r * 2, TIRE, Wheel, 'o'));
  for (const wy of [-1, 1]) {
    const a = wy * (hw - 0.45), b = wy * (hw - 0.1);
    m.push(part(Box, hl - 0.01, Math.min(a, b), 0.62, hl + 0.05, Math.max(a, b), 0.85, HEAD, Glow, '@'));
    m.push(part(Box, -hl - 0.05, Math.min(a, b), 0.62, -hl + 0.01, Math.max(a, b), 0.85, TAIL, Glow, '@'));
  }
}

const vehicles = new Map<string, Part[]>();
/**
 * The other vehicles, facing +x and centered: a delivery van, a box truck, a city bus with its lit
 * windows and destination sign, and a police car whose beacon flashes red and blue (`flash`: 0 off,
 * 1 red side lit, 2 blue side lit).
 */
export function vehicleModel(kind: string, col: RGB, flash = 0, who = 0): Part[] {
  const key = kind + col.join() + flash + '|' + who;
  let m = vehicles.get(key);
  if (m) return m;
  switch (kind) {
    case 'van': m = [
      part(Box, -2.6, -1.0, 0.35, 1.3, 1.0, 2.3, col, Solid, '#', '=', '#'),
      part(Box, 1.3, -1.0, 0.35, 2.6, 1.0, 1.2, col, Solid, '#', '=', '#'),
      part(Box, 1.3, -1.0, 2.05, 2.6, 1.0, 2.3, col, Solid, '=', '=', '='),
      part(Box, 1.3, -1.0, 1.2, 2.62, 1.0, 2.05, GLASS, Glass, '=', '=', '='),
    ]; seated(m, 1.75, -0.45, 0.95, who); running(m, [-1.7, 1.7], 2.6, 1.0); break;
    case 'truck': m = [
      part(Box, 2.0, -1.05, 0.4, 4.25, 1.05, 1.5, col, Solid, '#', '=', '#'),
      part(Box, 2.0, -1.05, 2.3, 4.25, 1.05, 2.6, col, Solid, '=', '=', '='),
      part(Box, 2.0, -1.05, 1.5, 4.27, 1.05, 2.3, GLASS, Glass, '=', '=', '='),
      part(Box, -4.25, -1.2, 0.65, 1.9, 1.2, 3.5, [215, 215, 210], Solid, '|', '=', '#'),
      part(Box, -4.25, -1.22, 2.9, 1.9, 1.22, 3.1, col, Solid, '=', '=', '='),
    ]; seated(m, 3.1, -0.5, 1.15, who); running(m, [-3.2, -2.1, 3.2], 4.25, 1.05, 0.45); break;
    case 'bus': m = [
      part(Box, -6, -1.25, 0.35, 6, 1.25, 1.35, col, Solid, '#', '=', '#'),
      part(Box, -6, -1.25, 2.45, 6, 1.25, 3.1, col, Solid, '#', '=', '#'),
      part(Box, -6, -1.25, 1.35, 6, 1.25, 2.45, GLASS, Glass, ':', '=', ':'),
      part(Box, -5.8, -0.9, 2.3, 5.6, 0.9, 2.42, [255, 225, 160], Glow, '='),
      part(Box, 6.0, -0.9, 2.6, 6.05, 0.9, 2.95, [255, 170, 40], Glow, '='),
      part(Box, -6.0, -1.25, 3.1, 6.0, 1.25, 3.2, [180, 180, 185], Solid, '=', '_'),
    ];
    seated(m, 5.2, -0.6, 1.0, who);
    for (let k = 0; k < 6; k++) if ((who >> k) & 1 || k < 2) seated(m, -4.5 + k * 1.6, k & 1 ? -0.6 : 0.6, 1.0, who * 13 + k * 5);
    running(m, [-4, 4.2], 6, 1.25, 0.5); break;
    default: { // police: a dark sedan with white doors and a beacon on the roof
      m = [
        part(Box, -2.4, -0.9, 0.35, 2.4, 0.9, 0.95, col, Solid, '#', '=', '#'),
        part(Box, -0.9, -0.92, 0.45, 0.9, 0.92, 0.9, [225, 225, 230], Solid, '=', '=', '='),
        part(Box, -1.1, -0.82, 0.95, 0.9, 0.82, 1.4, GLASS, Glass, '=', '=', '='),
        part(Box, -1.0, -0.8, 1.4, 0.8, 0.8, 1.5, col, Solid, '-', '_', '-'),
      ];
      seated(m, -0.15, -0.42, 0.62, who); seated(m, -0.15, 0.42, 0.62, who + 1);
      running(m, [-1.5, 1.5], 2.4, 0.9);
      m.push(part(Box, -0.25, -0.55, 1.5, 0.15, 0, 1.68, flash === 1 ? [255, 40, 40] : [90, 20, 20], flash === 1 ? Glow : Solid, '#'));
      m.push(part(Box, -0.25, 0, 1.5, 0.15, 0.55, 1.68, flash === 2 ? [60, 90, 255] : [20, 25, 90], flash === 2 ? Glow : Solid, '#'));
    }
  }
  vehicles.set(key, m);
  return m;
}
const peds = new Map<string, Part[]>();
/** The population the cached people belong to (a new city, new looks). */
let pedsOf: Population | null = null;
const HAIR: RGB[] = [[20, 20, 22], [55, 38, 25], [100, 65, 35], [140, 100, 60], [195, 160, 90], [150, 60, 30], [140, 140, 140], [215, 215, 210]];
const SHOES: RGB[] = [[25, 25, 28], [70, 45, 30], [200, 200, 200], [110, 80, 50]];
/**
 * A person's look in the blocky style (13.8), drawn from how the simulation says they look
 * (looksOf, 13.11e): skin tone, hair (color and how long), eyes, beard, shirt and trousers, a
 * jacket or not, sleeves, shoes, slim arms. The style bits go to the shader (mcSkin): head = hair
 * length (2 bits) + eye color (2) + beard (1); body = 0 plain, 1 open jacket, 2 striped; arm = 0 long, 1 short sleeves.
 */
export function pedLook(P: Population, who: number) {
  const L = looksOf(P, who);
  const shirt = CLOTHES[L.shirt], jacket = CLOTHES[L.jacket], bodyStyle = L.jacketOn ? 1 : L.striped ? 2 : 0;
  return {
    skin: TONE_RGB[L.tone], hair: HAIR[L.hair], shirt, pants: CLOTHES[L.pants], jacket, shoes: SHOES[L.shoes], alex: L.slim,
    // a jacket's sleeves are the jacket's
    sleeve: L.jacketOn ? jacket : shirt,
    headStyle: L.hairLen | (L.eyes << 2) | (+L.beard << 4), bodyStyle, armStyle: +L.shortSleeves,
  };
}

const EYE_RGB: RGB[] = [[70, 45, 25], [120, 90, 45], [60, 120, 70], [60, 110, 190]];
/** A person's face for an avatar on the web (15.17g): the same skin, hair, eyes and shirt as their body in the street. */
export function faceOf(P: Population, who: number) {
  const L = looksOf(P, who), b = pedLook(P, who);
  return { skin: b.skin, hair: b.hair, shirt: L.jacketOn ? b.jacket : b.shirt, eyes: EYE_RGB[L.eyes], hairLen: L.hairLen, beard: L.beard };
}

const UMBRELLAS: RGB[] = [[30, 30, 34], [150, 30, 40], [40, 60, 120], [200, 180, 60], [60, 110, 70], [150, 150, 155]];
/**
 * A person standing or walking, facing +x: jointed legs and arms with the step (`step`: 0 standing, 1..8 the walk),
 * coat, trousers and skin from `who`, under an umbrella in the rain. Far away just the figure.
 */
export function pedModel(P: Population, who: number, step: number, umbrella: boolean, far: boolean, use = 0): Part[] {
  const key = who + '|' + step + '|' + umbrella + far + use;
  // keyed by the whole person (a key on part of the id let two people share a pose's look, 13.11a); kept small
  if (peds.size > 6000 || pedsOf !== P) { peds.clear(); pedsOf = P; }
  let m = peds.get(key);
  if (m) return m;
  const L = pedLook(P, who), coat = L.shirt, pants = L.pants;
  // the blocky proportions (13.8): a pixel of the skin's grid is 1.8/32 m; head 8, body 8 x 12 x 4, limbs 4 x 12 x 4
  const X = 1.8 / 32, hd = 4 * X, bd = 2 * X, lw = 4 * X, alex = L.alex ? X : 0;
  const sk = (k: number, style: number) => k | (style << 4);
  if (far) m = [
    part(Box, -bd, -hd, 0, bd, hd, 12 * X, pants, Solid, '|', '=', '|'),
    part(Box, -bd, -hd, 12 * X, bd, hd, 24 * X, coat, Solid, '#', '=', '#'),
    part(Box, -hd, -hd, 24 * X, hd, hd, 32 * X, L.skin, Solid, '@')];
  else {
    const Z = 12 * X, T = 24 * X;
    const limb = (y0: number, y1: number, dx: number, z0: number, z1: number, col: RGB, col2: RGB, k: number, st: number) => {
      const q = part(Box, -bd + dx, y0, z0, bd + dx, y1, z1, col, Skin, '#', '=', '#');
      q.col2 = col2; q.skin = sk(k, st);
      return q;
    };
    // the walk (13.11c): step 0 standing, 1..8 the eighths of a stride. Each limb is in two (thigh and
    // shin, upper arm and forearm), turned at its joints: the hips swing the legs, the knee bends while
    // the leg comes forward, the arms swing against the legs with the elbows a little bent
    const ph = ((step - 1) * Math.PI) / 4, walk = step > 0;
    const legA = (q: number) => (walk ? 0.45 * Math.sin(ph + q) : 0), knee = (q: number) => (walk ? 0.8 * Math.max(0, Math.cos(ph + q)) : 0);
    const jointed = (y0: number, y1: number, jz: number, a: number, bend: number, col: RGB, col2: RGB, k: number, st: number): Part[] => {
      const h = 6 * X, up = limb(y0, y1, 0, jz - h, jz, col, col2, k, st), kx = h * Math.sin(a), kz = jz - h * Math.cos(a);
      up.swing = a; up.pivX = 0; up.pivZ = jz; up.skin! |= 1 << 16;
      const lo = limb(y0, y1, kx, kz - h, kz, col, col2, k, st);
      lo.swing = a + bend; lo.pivX = kx; lo.pivZ = kz; lo.skin! |= 6 << 12;
      return [up, lo];
    };
    const armA = (q: number) => -0.6 * legA(q), elbow = walk ? 0.3 : 0.05;
    const head = part(Box, -hd, -hd, T, hd, hd, T + 8 * X, L.skin, Skin, '#', '#', '#');
    head.col2 = L.hair; head.skin = sk(0, L.headStyle);
    const body = part(Box, -bd, -hd, Z, bd, hd, T, coat, Skin, '#', '=', '#');
    body.col2 = L.jacket; body.skin = sk(1, L.bodyStyle);
    m = [
      ...jointed(0, lw, Z, legA(0), -knee(0), pants, L.shoes, 3, 0),
      ...jointed(-lw, 0, Z, legA(Math.PI), -knee(Math.PI), pants, L.shoes, 3, 0),
      body,
      // the right arm swinging, or holding the phone: at the ear on a call, out in front to text (its screen lit)
      use === 4 ? part(Box, -0.05, hd, T - 0.225, 0.5, hd + lw - alex, T, L.sleeve, Solid, '=', '-', '#') // pointing the way: the arm out ahead (its hand added below)
        : use === 1 ? limb(hd, hd + lw - alex, 0, T - 0.1, T + 0.28, L.sleeve, L.skin, 2, L.armStyle)
        : use ? limb(hd - 0.05, hd + lw - 0.05 - alex, 0.15, Z + 0.15, Z + 0.27, L.sleeve, L.skin, 2, L.armStyle)
          : umbrella ? part(Box, -0.05, hd, T - 0.225, 0.3, hd + lw - alex, T, L.sleeve, Solid, '=', '-', '#')
          : jointed(hd, hd + lw - alex, T, armA(0), elbow, L.sleeve, L.skin, 2, L.armStyle),
      ...jointed(-hd - lw + alex, -hd, T, armA(Math.PI), elbow, L.sleeve, L.skin, 2, L.armStyle),
      head,
    ].flat();
    if (use === 1) m.push(part(Box, -0.01, hd - 0.02, T + 0.12, 0.07, hd + 0.03, T + 0.28, [30, 30, 34], Solid, '|'));
    else if (use === 4) m.push(part(Box, 0.5, hd + 0.02, T - 0.2, 0.62, hd + lw - alex - 0.02, T - 0.03, L.skin, Solid, '#'));
    else if (use) {
      m.push(part(Box, 0.26, -0.02, Z + 0.24, 0.36, 0.1, Z + 0.29, [30, 30, 34], Solid, '='));
      m.push(part(Box, 0.27, 0, Z + 0.29, 0.35, 0.08, Z + 0.31, use === 3 ? [255, 240, 160] : [150, 200, 255], Glow, '-', '='));
    }
    if (umbrella) {
      // held in the right hand (out in front at the shoulder's height when free; by the side while on the phone)
      const ux = use ? 0.08 : 0.34, uy = use ? hd + (lw - alex) / 2 : 0.1, uz = use ? 1.3 : T - 0.2;
      // the forearm turned in, the hand in front of the chest
      if (!use) m.push(part(Box, 0.2, uy - 0.04, T - 0.22, 0.3, hd + lw - alex, T - 0.06, L.sleeve, Solid, '='),
        part(Box, 0.29, uy - 0.06, T - 0.22, 0.39, uy + 0.06, T - 0.06, L.skin, Solid, '#'));
      m.push(part(Box, ux - 0.015, uy - 0.015, uz, ux + 0.015, uy + 0.015, 2.05, [40, 40, 44], Solid, '|'));
      m.push(part(Ball, ux - 0.58, uy - 0.58, 1.97, ux + 0.58, uy + 0.58, 2.27, UMBRELLAS[(who >> 2) % UMBRELLAS.length], Solid, '^', '^', '^'));
    }
  }
  peds.set(key, m);
  return m;
}

const bikes = new Map<string, Part[]>();
/**
 * A bicycle and its rider, facing +x: two thin wheels, the frame, the rider leaning over the bars,
 * legs at the pedals' turn (`crank`, 0..3), a small front lamp.
 */
export function bikeModel(col: RGB, who: number, crank: number): Part[] {
  const key = col.join() + '|' + (who & 31) + '|' + crank;
  let m = bikes.get(key);
  if (m) return m;
  const shirt = CLOTHES[who % CLOTHES.length], pants = CLOTHES[(who >> 2) % CLOTHES.length], skin = SKIN[(who >> 3) % SKIN.length];
  const r = 0.33, a = (crank * Math.PI) / 2, f = 0.17 * Math.cos(a), g = 0.17 * Math.sin(a);
  m = [
    part(Ball, -0.95, -0.04, 0, -0.29, 0.04, 2 * r, TIRE, Wheel, 'o'),
    part(Ball, 0.29, -0.04, 0, 0.95, 0.04, 2 * r, TIRE, Wheel, 'o'),
    part(Box, -0.62, -0.03, 0.38, 0.62, 0.03, 0.46, col, Solid, '=', '=', '='),
    part(Box, -0.3, -0.03, 0.4, -0.22, 0.03, 0.92, col, Solid, '|'),
    part(Box, 0.5, -0.03, 0.4, 0.58, 0.03, 1.05, col, Solid, '|'),
    part(Box, 0.48, -0.28, 1.0, 0.56, 0.28, 1.06, STEEL, Solid, '-'),
    // the rider: legs at the cranks, torso leaning forward, head
    part(Box, -0.24 + f, 0.08, 0.3 + g, -0.12 + f, 0.2, 0.95, pants, Solid, '|'),
    part(Box, -0.24 - f, -0.2, 0.3 - g, -0.12 - f, -0.08, 0.95, pants, Solid, '|'),
    part(Box, -0.3, -0.2, 0.95, 0.25, 0.2, 1.45, shirt, Solid, '#', '=', '#'),
    part(Ball, 0.12, -0.12, 1.45, 0.36, 0.12, 1.72, skin, Solid, '@'),
    part(Box, 0.6, -0.06, 0.88, 0.66, 0.06, 0.98, [255, 245, 210], Glow, '*'),
  ];
  bikes.set(key, m);
  return m;
}

/** Each kind's half length and height, for its bounds. */
export const VEHICLE_SIZE: Record<string, [number, number]> = { bike: [1.0, 1.8], sedan: [2.3, 1.8], taxi: [2.3, 1.8], van: [2.7, 2.4], truck: [4.3, 3.6], bus: [6.1, 3.3], police: [2.5, 1.8] };

const farCars = new Map<string, Part[]>();
/** A car far off: the body, the cabin and a strip of lights at each end. */
export function carFarModel(col: RGB, taxi: boolean): Part[] {
  const key = col.join() + taxi;
  let m = farCars.get(key);
  if (m) return m;
  m = [
    part(Box, -2.2, -0.9, 0.2, 2.2, 0.9, 0.95, col, Solid, '#', '=', '#'),
    part(Box, -1.1, -0.82, 0.95, 0.9, 0.82, 1.5, taxi ? col : GLASS, Solid, '=', '-', '='),
    part(Box, 2.19, -0.8, 0.62, 2.25, 0.8, 0.82, [255, 245, 200], Glow, '@'),
    part(Box, -2.25, -0.8, 0.62, -2.19, 0.8, 0.82, [255, 40, 40], Glow, '@'),
  ];
  farCars.set(key, m);
  return m;
}

const lamps = new Map<string, Part[]>();
/** Street lamp: a pole on a base, with an arm reaching over the street (+x) to the lamp head, glowing `head`. */
export function lampModel(head: RGB): Part[] {
  const key = head.join();
  let m = lamps.get(key);
  if (m) return m;
  m = [
    part(Cyl, -0.18, -0.18, 0, 0.18, 0.18, 0.6, STEEL, Solid, '#', '='),
    part(Cyl, -0.08, -0.08, 0, 0.08, 0.08, 6.6, STEEL, Solid, '|', '.'),
    part(Box, 0, -0.05, 6.45, 1.7, 0.05, 6.6, STEEL, Solid, '-', '-', '|'),
    part(Box, 1.2, -0.2, 6.25, 2.0, 0.2, 6.5, head, Glow, '*'),
  ];
  lamps.set(key, m);
  return m;
}

/**
 * The district's banner on an avenue's lamp post (the signage manual, section 5): two cloths hanging on brackets
 * either side of the pole, below the arm, in the district's color with its number; read from +x (the arm's side;
 * a second one turned round shows the other). Says the neighbourhood from far off, from any angle.
 */
export function bannerModel(district: number, col: RGB): Part[] {
  const key = `banner|${district}|${col.join()}`;
  let m = lamps.get(key);
  if (m) return m;
  const ink: RGB = [22, 23, 26];
  m = [];
  for (const sy of [-1, 1]) {
    const y0 = sy * 0.1, y1 = sy * 0.62;
    m.push(part(Box, -0.02, Math.min(y0, y1), 4.62, 0.02, Math.max(y0, y1), 4.66, STEEL, Solid, '-'));
    const cloth = part(Box, -0.01, Math.min(y0, y1) + 0.04, 3.3, 0.01, Math.max(y0, y1) - 0.02, 4.6, col, Board, '#');
    cloth.text = String(district + 1); cloth.col2 = ink; cloth.lamp = 0; cloth.plate = true;
    m.push(cloth);
  }
  lamps.set(key, m);
  return m;
}

/**
 * A lot's street number over its door (the signage manual, section 5): white on the dark glass of the transom,
 * read from +x; letters about 8 cm.
 */
export function doorNumberModel(num: string): Part[] {
  const key = `door|${num}`;
  let m = lamps.get(key);
  if (m) return m;
  const hw = (0.075 * num.length + 0.08) / 2;
  const p = part(Box, 0, -hw, 2.42, 0.012, hw, 2.58, [26, 34, 40], Board, '=');
  p.text = num; p.col2 = [236, 236, 230]; p.lamp = 0; p.plate = true;
  m = [p];
  lamps.set(key, m);
  return m;
}

/**
 * A shop's OPEN / CLOSED card in the glass by its door, its hours under it (the signage manual, section 6): it
 * says from the sidewalk whether the shop is worth walking in; read from +x, letters about 6 cm.
 */
export function openSignModel(open: boolean, hours: string): Part[] {
  const key = `open|${open}|${hours}`;
  let m = lamps.get(key);
  if (m) return m;
  const word = open ? 'OPEN' : 'CLOSED', hw = (0.06 * word.length + 0.05) / 2, hh = (0.045 * hours.length + 0.04) / 2;
  const card = part(Box, 0, -hw, 1.42, 0.012, hw, 1.52, [242, 241, 236], Board, '=');
  card.text = word; card.col2 = open ? [200, 38, 43] : [22, 23, 26]; card.lamp = 0; card.plate = true;
  const hrs = part(Box, 0, -hh, 1.35, 0.012, hh, 1.4, [26, 34, 40], Board, '.');
  hrs.text = hours; hrs.col2 = [236, 236, 230]; hrs.lamp = 0; hrs.plate = true;
  m = [card, hrs];
  lamps.set(key, m);
  return m;
}

const SERV_BLUE: RGB = [31, 79, 156];
/**
 * The bus stop's flag on the shelter's post (the signage manual, section 5): blue, BUS / STOP and the street the
 * stop serves. One face, read from +x, its plane at x0, spanning y0..y1 along it; the stop draws two, back to back.
 */
export function busFlagModel(name: string, x0: number, y0: number, y1: number): Part[] {
  const key = `busflag|${name}|${x0}|${y0}`;
  let m = lamps.get(key);
  if (m) return m;
  m = [['BUS', 2.93, 3.15], ['STOP', 2.72, 2.93], [name, 2.55, 2.72]].map(([t, z0, z1]) => {
    const p = part(Box, x0, y0, z0 as number, x0 + 0.012, y1, z1 as number, SERV_BLUE, Board, '=');
    p.text = t as string; p.col2 = SIGN_WHITE; p.lamp = 0; p.plate = true;
    return p;
  });
  lamps.set(key, m);
  return m;
}

/** The PHONE sign on a payphone's hood (the signage manual, section 5), read from +x: the payphone turned round. */
export function phoneSignModel(): Part[] {
  let m = lamps.get('phonesign');
  if (m) return m;
  const p = part(Box, 0.32, -0.3, 1.84, 0.332, 0.3, 2.06, SERV_BLUE, Board, '=');
  p.text = 'PHONE'; p.col2 = SIGN_WHITE; p.lamp = 0; p.plate = true;
  m = [p];
  lamps.set('phonesign', m);
  return m;
}

/**
 * The yellow "CCTV" notice under a security camera (the signage manual, section 7): it tells the player there is a
 * camera there, as such notices do; read from +x, its foot at z0.
 */
export function cctvSignModel(z0: number): Part[] {
  const key = `cctvsign|${z0}`;
  let m = lamps.get(key);
  if (m) return m;
  const p = part(Box, 0, -0.27, z0, 0.012, 0.27, z0 + 0.3, [242, 194, 48], Board, '=');
  p.text = 'CCTV'; p.col2 = [22, 23, 26]; p.lamp = 0; p.plate = true;
  m = [p];
  lamps.set(key, m);
  return m;
}

const trees = new Map<number, Part[]>();
/** Street and park tree: a trunk under a crown of one to three leafy ellipsoids, varied by seed. */
export function treeModel(seed: number, w: number, h: number): Part[] {
  let m = trees.get(seed);
  if (m) return m;
  const r = (k: number) => hash3(seed, k, 71);
  const leaf: RGB = [40 + r(1) * 25, 110 + r(2) * 60, 45 + r(3) * 20];
  const R = w / 2;
  m = [
    part(Cyl, -0.18, -0.18, 0, 0.18, 0.18, h * 0.55, [90, 62, 38], Solid, '|', '.'),
    part(Ball, -R * 0.6, -R * 0.6, h * 0.45, R * 0.6, R * 0.6, h * 0.85, leaf, Leaf, '@'),
  ];
  // clumps around the core make the outline lumpy
  const n = 5 + ((r(4) * 4) | 0);
  for (let k = 0; k < n; k++) {
    const a = (k / n + r(10 + k) * 0.15) * Math.PI * 2, d = R * (0.4 + 0.2 * r(40 + k)), s = R * (0.35 + 0.2 * r(20 + k));
    const zc = h * (0.5 + 0.35 * r(30 + k)), cx = Math.cos(a) * d, cy = Math.sin(a) * d;
    m.push(part(Ball, cx - s, cy - s, zc - s * 0.8, cx + s, cy + s, zc + s * 0.8, leaf, Leaf, '@'));
  }
  trees.set(seed, m);
  return m;
}

const WOOD: RGB = [125, 85, 50];
const DARK: RGB = [55, 58, 62];

/** Street furniture; +x faces the street (or the path, for park benches). */
export const FURNITURE: Record<string, { parts: Part[]; r: number; h: number }> = {
  bench: {
    r: 1, h: 0.95, parts: [
      part(Box, -0.25, -0.9, 0.42, 0.25, 0.9, 0.48, WOOD, Solid, '=', '='),
      part(Box, -0.32, -0.9, 0.52, -0.26, 0.9, 0.92, WOOD, Solid, '=', '-', '|'),
      part(Box, -0.28, -0.84, 0, 0.2, -0.76, 0.42, DARK, Solid, '|'),
      part(Box, -0.28, 0.76, 0, 0.2, 0.84, 0.42, DARK, Solid, '|'),
    ],
  },
  bin: {
    r: 0.45, h: 1, parts: [
      part(Cyl, -0.3, -0.3, 0, 0.3, 0.3, 0.88, [50, 75, 58], Solid, '#', 'o'),
      part(Cyl, -0.33, -0.33, 0.86, 0.33, 0.33, 0.96, STEEL, Solid, '=', 'o'),
    ],
  },
  hydrant: {
    r: 0.35, h: 0.85, parts: [
      part(Cyl, -0.15, -0.15, 0, 0.15, 0.15, 0.68, [190, 45, 35], Solid, '#', 'o'),
      part(Ball, -0.15, -0.15, 0.58, 0.15, 0.15, 0.82, [190, 45, 35], Solid, 'o'),
      part(Box, -0.06, -0.26, 0.42, 0.06, 0.26, 0.54, [210, 170, 60], Solid, '='),
    ],
  },
  mailbox: {
    r: 0.45, h: 1.25, parts: [
      part(Box, -0.25, -0.25, 0.35, 0.25, 0.25, 1.05, [40, 70, 155], Solid, '#', '=', '#'),
      part(Ball, -0.25, -0.25, 0.9, 0.25, 0.25, 1.22, [40, 70, 155], Solid, '='),
      part(Box, 0.25, -0.15, 0.85, 0.27, 0.15, 0.92, [180, 180, 190], Solid, '-'),
      part(Box, -0.2, -0.2, 0, 0.2, 0.2, 0.35, DARK, Solid, '|'),
    ],
  },
  news: {
    r: 0.4, h: 1, parts: [
      part(Box, -0.22, -0.25, 0, 0.22, 0.25, 0.98, [200, 170, 40], Solid, '#', '=', '#'),
      part(Box, 0.22, -0.18, 0.5, 0.24, 0.18, 0.85, [205, 205, 190], Solid, '='),
    ],
  },
  payphone: {
    // the phone faces the sidewalk (-x), under a blue hood
    r: 0.5, h: 2.15, parts: [
      part(Box, -0.06, -0.06, 0, 0.06, 0.06, 1.05, STEEL, Solid, '|'),
      part(Box, -0.22, -0.26, 1.0, 0.14, 0.26, 1.8, [150, 150, 158], Solid, '#', '=', '#'),
      part(Box, -0.24, -0.08, 1.2, -0.22, 0.08, 1.55, [30, 30, 34], Solid, '%'),
      part(Box, -0.24, -0.16, 1.62, -0.22, 0.16, 1.74, [170, 215, 255], Glow, '='),
      part(Box, -0.32, -0.36, 1.8, 0.2, 0.36, 2.1, [40, 80, 165], Solid, '=', '_', '='),
    ],
  },
  table: {
    // a cafe table with its folding chairs, the square's kind
    r: 1.1, h: 0.95, parts: [
      part(Cyl, -0.4, -0.4, 0.72, 0.4, 0.4, 0.76, [70, 110, 80], Solid, '=', 'O'),
      part(Cyl, -0.04, -0.04, 0, 0.04, 0.04, 0.72, DARK, Solid, '|'),
      part(Box, 0.55, -0.2, 0.42, 0.95, 0.2, 0.46, [70, 110, 80], Solid, '=', '='),
      part(Box, 0.9, -0.2, 0.46, 0.95, 0.2, 0.92, [70, 110, 80], Solid, '|', '-', '#'),
      part(Box, -0.95, -0.2, 0.42, -0.55, 0.2, 0.46, [70, 110, 80], Solid, '=', '='),
      part(Box, -0.95, -0.2, 0.46, -0.9, 0.2, 0.92, [70, 110, 80], Solid, '|', '-', '#'),
    ],
  },
  planter: {
    // a square planter with a shrub
    r: 0.8, h: 1.6, parts: [
      part(Box, -0.6, -0.6, 0, 0.6, 0.6, 0.6, [120, 115, 105], Solid, '#', '=', '#'),
      part(Ball, -0.55, -0.55, 0.5, 0.55, 0.55, 1.55, [50, 120, 60], Leaf, '@'),
    ],
  },
  steps: {
    // red steps to sit on, rising away from their front (+x), their risers lit from inside
    r: 5.2, h: 3.1, parts: [
      ...[0, 1, 2, 3, 4, 5].map((k) => part(Box, 3 - k - 1, -4, 0, 3 - k, 4, 0.5 * (k + 1), [150, 30, 35], Solid, '#', '=', '#')),
      ...[0, 1, 2, 3, 4, 5].map((k) => part(Box, 3 - k, -3.9, 0.5 * k + 0.08, 3 - k + 0.04, 3.9, 0.5 * k + 0.42, [255, 70, 70], Glow, '=')),
    ],
  },
  shelter: {
    // bus shelter: a roof on posts, a glass back and a lit poster at one end; the post carries the stop's flag
    r: 2.3, h: 3.2, parts: [
      part(Box, -0.95, -2.05, 2.3, 0.95, 2.05, 2.45, STEEL, Solid, '=', '_'),
      part(Box, -0.95, -2.0, 0.25, -0.88, 2.0, 2.3, GLASS, Solid, ':'),
      // the advert: a small video screen showing the same animations as the big ones (both sides); its color is its power (white: on)
      part(Box, -0.88, 1.92, 0.3, 0.55, 2.0, 2.15, [255, 255, 255], Screen, '='),
      part(Box, 0.8, -2.0, 0, 0.9, -1.9, 3.2, STEEL, Solid, '|'),
      part(Box, -0.6, -1.5, 0.42, -0.2, 1.3, 0.5, STEEL, Solid, '=', '='),
    ],
  },
  dumpster: {
    r: 1.4, h: 1.3, parts: [
      part(Box, -0.8, -1.0, 0.15, 0.8, 1.0, 1.15, [45, 90, 65], Solid, '#', '=', '#'),
      part(Box, -0.85, -1.05, 1.15, 0.85, 1.05, 1.25, [35, 70, 50], Solid, '=', '='),
      part(Box, -0.7, -0.9, 0, 0.7, 0.9, 0.15, TIRE, Solid, 'o'),
    ],
  },
};

const piles = new Map<number, Part[]>();
/** A pile of rubble: concrete chunks, planks and a tire, arranged by seed. */
export function debrisModel(seed: number): Part[] {
  const key = seed % 64;
  let m = piles.get(key);
  if (m) return m;
  m = [];
  const r = (k: number) => hash3(key, k, 83);
  const n = 3 + ((r(0) * 4) | 0);
  for (let k = 0; k < n; k++) {
    const x = (r(k * 4 + 1) - 0.5) * 2, y = (r(k * 4 + 2) - 0.5) * 2, kind = r(k * 4 + 3);
    if (kind < 0.5) { const s = 0.2 + 0.35 * r(k * 4 + 4); m.push(part(Box, x - s, y - s * 0.8, 0, x + s, y + s * 0.8, s * 1.4, [105, 100, 95], Solid, '#', '%', '#')); }
    else if (kind < 0.8) m.push(part(Box, x - 0.9, y - 0.1, 0, x + 0.9, y + 0.1, 0.08 + 0.3 * r(k * 4 + 4), WOOD, Solid, '=', '='));
    else m.push(part(Cyl, x - 0.35, y - 0.35, 0, x + 0.35, y + 0.35, 0.22, TIRE, Solid, 'o', '0'));
  }
  m.push(part(Ball, -1.2, -1, -0.3, 1.2, 1, 0.45, [80, 76, 72], Solid, ':'));
  piles.set(key, m);
  return m;
}

/** Cordon floodlight tower: a lattice mast with a bank of lamps facing +x. */
export const FLOOD: Part[] = [
  part(Box, -0.25, -0.25, 0, 0.25, 0.25, 13, STEEL, Solid, 'x', '=', 'x'),
  part(Box, -0.1, -0.9, 12.6, 0.2, 0.9, 12.8, STEEL, Solid, '=', '='),
  part(Box, 0.2, -0.8, 12.8, 0.5, 0.8, 14.2, [255, 250, 225], Glow, '#'),
];

const floods = new Map<string, Part[]>();
/**
 * A floodlight at the foot of a lit facade (+x out from the wall, the lamp's spot at the origin): a low steel
 * box on a plate, its lens on top tilted to the wall, glowing in the light's color while it is on (lit 0..1).
 */
export function wallFloodModel(col: RGB, lit: number): Part[] {
  const key = `${col.join(',')}|${lit}`;
  let m = floods.get(key);
  if (!m) {
    const on = lit > 0.05, k = 255 / Math.max(...col), lens: RGB = on ? [Math.min(255, col[0] * k * lit + 40), Math.min(255, col[1] * k * lit + 40), Math.min(255, col[2] * k * lit + 40)] : [60, 62, 66];
    m = [
      part(Box, -0.22, -0.2, 0, 0.2, 0.2, 0.06, [70, 70, 74], Solid, '_', '='),
      part(Box, -0.16, -0.15, 0.06, 0.16, 0.15, 0.3, [95, 96, 100], Solid, '#', '='),
      part(Box, -0.18, -0.13, 0.3, 0.1, 0.13, 0.34, lens, on ? Glow : Solid, '*', '@'),
    ];
    floods.set(key, m);
  }
  return m;
}

const blades = new Map<string, Part[]>();
/** Height of a blade sign's panel: its letters, a square symbol on top if it has one, and the frame. */
export function bladeHeight(text: string, sym: number, letter: number) {
  return text.length * letter + (sym >= 0 ? letter * 1.04 : 0) + 0.3;
}
/** Reach of a blade sign from the wall. */
export function bladeReach(letter: number) {
  return 0.4 + letter * 1.2;
}
/**
 * Blade sign, sticking out of a wall along +x: two steel arms, a dark frame and the lit panel with
 * its word stacked from the top. `col` is the neon's color at its current brightness. A tall one
 * (bigger letters) has more arms and bulbs chasing up its two edges.
 */
export function bladeModel(text: string, sym: number, col: RGB, z0: number, letter: number, chase = 0): Part[] {
  const key = text + sym + col.join() + letter + chase;
  let m = blades.get(key);
  if (m) return m;
  const z1 = z0 + bladeHeight(text, sym, letter), x1 = bladeReach(letter), wy = 0.16 * letter / 0.75;
  m = [
    part(Box, 0.4, -wy, z0, x1, wy, z1, [40, 36, 44], Solid, '|', '=', '|'),
    part(Box, 0.46, -wy - 0.02, z0 + 0.15, x1 - 0.06, wy + 0.02, z1 - 0.15, col, Text, ' '),
  ];
  m[1].text = text;
  if (sym >= 0) m[1].sym = sym;
  const arms = letter > 1 ? 4 : 2;
  for (let k = 0; k < arms; k++) {
    const z = z0 + 0.3 + ((z1 - z0 - 0.6) * k) / (arms - 1);
    m.push(part(Box, 0, -0.04, z - 0.05, 0.4, 0.04, z + 0.05, STEEL, Solid, '-', '-', '|'));
  }
  if (letter > 1) {
    // bulbs up the front and back edges, every third one lit, climbing
    const n = Math.floor((z1 - z0) / 0.5);
    for (let k = 0; k < n && m.length < 31; k += 1) {
      if ((k + chase) % 3) continue;
      const z = z0 + 0.25 + k * 0.5;
      for (const y of [-wy, wy]) {
        const b = part(Box, x1 - 0.1, y - 0.07, z - 0.07, x1 + 0.04, y + 0.07, z + 0.07, [255, 230, 160], Glow, 'o');
        b.bulbs = true; // (a sign's light: it looks lit as the sign does, gpu/objects.ts)
        m.push(b);
      }
    }
  }
  if (blades.size > 4000) blades.clear();
  blades.set(key, m);
  return m;
}

const dimmed = new Map<string, Part[]>();
/** A piece of street furniture with its lights (poster, phone sign) at power k, in eighths so models are reused. */
export function poweredFurniture(kind: string, k: number): Part[] {
  const q = Math.round(Math.min(1.25, k) * 8) / 8, key = kind + q;
  let m = dimmed.get(key);
  if (!m) {
    m = FURNITURE[kind].parts.map((p) => (p.mat === Mat.Glow || p.mat === Mat.Screen ? { ...p, col: [p.col[0] * q, p.col[1] * q, p.col[2] * q] as RGB } : p));
    dimmed.set(key, m);
  }
  return m;
}

const GOODS: RGB[] = [[200, 60, 50], [60, 120, 200], [230, 200, 60], [80, 170, 90], [220, 220, 210]];
const furns = new Map<string, Part[]>();
/** Each good has its own packaging color, from its name (so the same good looks the same everywhere). */
const goodColors = new Map<string, RGB>();
export function goodColor(g: string): RGB {
  let c = goodColors.get(g);
  if (!c) {
    let h = 0;
    for (let i = 0; i < g.length; i++) h = Math.imul(h ^ g.charCodeAt(i), 0x01000193);
    const a = ((h >>> 0) % 360) / 360 * 2 * Math.PI, l = 150 + ((h >>> 9) % 70);
    c = [l + 80 * Math.cos(a), l + 80 * Math.cos(a - 2.09), l + 80 * Math.cos(a + 2.09)].map((x) => Math.max(30, Math.min(240, x))) as unknown as RGB;
    goodColors.set(g, c);
  }
  return c;
}
/**
 * Furniture, facing +x (its front), centered, hx deep and hy wide (half sizes), as volumes like the
 * street furniture. Colors vary a little with the seed.
 */
export function furnitureModel(kind: string, seed: number, hx: number, hy: number, stock?: string[]): Part[] {
  const v = seed % 4, key = kind + v + hx.toFixed(2) + hy.toFixed(2) + (stock ? stock.join() : '');
  let m = furns.get(key);
  if (m) return m;
  const pick = <T>(a: T[]) => a[v % a.length];
  const WOOD = pick<RGB>([[120, 80, 50], [95, 65, 45], [140, 105, 70], [80, 60, 50]]);
  const FAB = pick<RGB>([[120, 60, 55], [60, 80, 120], [90, 110, 80], [130, 120, 100]]);
  const WHITE: RGB = [200, 200, 195], DARK: RGB = [45, 45, 50], STEEL: RGB = [150, 152, 158];
  /** The packaging color of the goods at a spot: one of the piece's stock (each good its own color), or any. */
  const goods = (h: number): RGB => (stock?.length ? goodColor(stock[(h * stock.length) | 0]) : GOODS[(h * GOODS.length) | 0]);
  /** Rows of goods across a face at x = fx, from z0 to z1, each `w` wide and `t` tall. */
  const fill = (out: Part[], fx: number, z0: number, z1: number, dz: number, w: number, t: number, skip = 0.25) => {
    for (let z = z0; z < z1; z += dz) for (let y = -hy + 0.1; y < hy - w; y += w + 0.08) {
      const h = hash3(seed, Math.round(y * 10), Math.round(z * 10));
      if (h < skip) continue;
      out.push(part(Box, fx - 0.06, y, z, fx, y + w, z + t, goods(h), Solid, '#'));
    }
  };
  switch (kind) {
    case 'bed': m = [
      part(Box, -hx, -hy, 0, hx, hy, 0.3, WOOD, Solid, '=', '='),
      part(Box, -hx + 0.05, -hy + 0.05, 0.3, hx - 0.05, hy - 0.05, 0.5, FAB, Solid, '~', '~'),
      part(Box, -hx + 0.05, -hy + 0.15, 0.5, -hx + 0.45, hy - 0.15, 0.62, WHITE, Solid, 'o', 'o'),
      part(Box, -hx, -hy, 0, -hx + 0.08, hy, 1.0, WOOD, Solid, '#', '=')]; break;
    case 'nightstand': m = [part(Box, -hx, -hy, 0, hx, hy, 0.55, WOOD, Solid, '=', '_'), part(Ball, -0.08, -0.08, 0.55, 0.08, 0.08, 0.8, [255, 220, 150], Glow, 'o')]; break;
    case 'sofa': m = [
      part(Box, -hx, -hy, 0.1, hx, hy, 0.45, FAB, Solid, '=', '~'),
      part(Box, -hx, -hy, 0.45, -hx + 0.22, hy, 0.85, FAB, Solid, '#', '='),
      part(Box, -hx, -hy, 0.45, hx, -hy + 0.18, 0.65, FAB, Solid, '#', '='),
      part(Box, -hx, hy - 0.18, 0.45, hx, hy, 0.65, FAB, Solid, '#', '=')]; break;
    case 'coffee': case 'table': {
      // the top, and a leg under each corner up to it
      const top = kind === 'table' ? 0.72 : 0.38;
      m = [part(Box, -hx, -hy, top, hx, hy, top + 0.05, WOOD, Solid, '-', '=')];
      for (const [lx, ly] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const cx = lx * (hx - 0.08), cy = ly * (hy - 0.08);
        m.push(part(Box, cx - 0.03, cy - 0.03, 0, cx + 0.03, cy + 0.03, top, WOOD, Solid, '|'));
      }
      break;
    }
    case 'tv': m = [part(Box, -hx, -hy, 0, hx, hy, 0.5, WOOD, Solid, '=', '_'), part(Box, -0.05, -hy + 0.1, 0.5, 0.03, hy - 0.1, 1.15, DARK, Solid, '#'), part(Box, 0.03, -hy + 0.15, 0.55, 0.05, hy - 0.15, 1.1, [90, 140, 200], Glow, ':')]; break;
    case 'counter': m = [part(Box, -hx, -hy, 0, hx, hy, 0.88, WHITE, Solid, '#', '='), part(Box, -hx, -hy, 0.88, hx, hy, 0.93, [70, 70, 75], Solid, '-', '_')]; break;
    case 'fridge': m = [part(Box, -hx, -hy, 0, hx, hy, 1.8, WHITE, Solid, '|', '=', '|'), part(Box, hx, -hy + 0.1, 1.1, hx + 0.03, -hy + 0.15, 1.4, [150, 150, 155], Solid, '|')]; break;
    case 'tub': m = [part(Box, -hx, -hy, 0, hx, hy, 0.55, WHITE, Solid, '#', 'o'), part(Box, -hx + 0.1, -hy + 0.1, 0.35, hx - 0.1, hy - 0.1, 0.56, [110, 150, 170], Solid, '~')]; break;
    case 'toilet': m = [part(Ball, -hx + 0.1, -hy, 0, hx, hy, 0.42, WHITE, Solid, 'o'), part(Box, -hx, -hy, 0.3, -hx + 0.2, hy, 0.8, WHITE, Solid, '#', '=')]; break;
    case 'desk': m = [
      part(Box, -hx, -hy, 0.72, hx, hy, 0.76, WOOD, Solid, '-', '='),
      part(Box, -hx, -hy, 0, hx, -hy + 0.05, 0.72, WOOD, Solid, '|'), part(Box, -hx, hy - 0.05, 0, hx, hy, 0.72, WOOD, Solid, '|'),
      part(Box, -hx + 0.08, -0.25, 0.76, -hx + 0.14, 0.25, 1.1, DARK, Solid, '#'), part(Box, -hx + 0.14, -0.22, 0.79, -hx + 0.16, 0.22, 1.07, [120, 200, 160], Glow, ':')]; break;
    case 'chair': m = [part(Box, -hx, -hy, 0.42, hx, hy, 0.48, DARK, Solid, '=', '='), part(Box, -hx, -hy, 0.48, -hx + 0.08, hy, 0.95, DARK, Solid, '#'), part(Box, -0.04, -0.04, 0, 0.04, 0.04, 0.42, [90, 90, 95], Solid, '|')]; break;
    case 'shelf': {
      m = [part(Box, -hx, -hy, 0, hx, hy, 1.8, WOOD, Solid, '|', '=')];
      // goods on the shelves, in bright packaging
      for (let z = 0.3; z < 1.7; z += 0.42) for (let y = -hy + 0.1; y < hy - 0.2; y += 0.3) {
        const h = hash3(seed, Math.round(y * 10), Math.round(z * 10));
        if (h < 0.25) continue;
        m.push(part(Box, hx - 0.02, y, z, hx + 0.02, y + 0.22, z + 0.25, goods(h), Solid, '#'));
      }
      break;
    }
    case 'bar': m = [part(Box, -hx, -hy, 0, hx, hy, 1.05, [70, 45, 35], Solid, '#', '='), part(Box, -hx, -hy, 1.05, hx + 0.08, hy, 1.1, [150, 110, 70], Solid, '-', '_')]; break;
    case 'stool': m = [part(Cyl, -0.04, -0.04, 0, 0.04, 0.04, 0.72, STEEL, Solid, '|'), part(Cyl, -hx, -hy, 0.72, hx, hy, 0.78, [150, 40, 40], Solid, '=', 'o')]; break;
    case 'bottles': {
      // a tall back shelf, its bottles in rows (the stock's colors), a mirror strip behind
      m = [part(Box, -hx, -hy, 0, hx, hy, 0.9, [70, 45, 35], Solid, '#', '='), part(Box, -hx, -hy, 0.9, -hx + 0.04, hy, 2.0, [120, 130, 140], Glass, '|')];
      for (const z of [0.9, 1.35]) {
        m.push(part(Box, -hx, -hy, z, hx, hy, z + 0.03, [90, 60, 40], Solid, '-'));
        for (let y = -hy + 0.1; y < hy - 0.15; y += 0.15) {
          const h = hash3(seed, Math.round(y * 20), Math.round(z * 10));
          if (h < 0.15) continue;
          m.push(part(Cyl, -0.06, y, z + 0.03, 0.06, y + 0.11, z + 0.36, goods(h), Solid, '!', 'o'));
        }
      }
      break;
    }
    case 'cooler': m = [
      // a glass-door drinks fridge, lit inside
      part(Box, -hx, -hy, 0, hx, hy, 2.0, DARK, Solid, '#', '='),
      part(Box, hx - 0.02, -hy + 0.06, 0.15, hx + 0.01, hy - 0.06, 1.9, [200, 230, 255], Glow, ':')];
      fill(m, hx + 0.02, 0.25, 1.8, 0.4, 0.12, 0.26, 0.15); break;
    case 'case': m = [
      // a display counter: a base, glass on top, goods inside
      part(Box, -hx, -hy, 0, hx, hy, 0.6, WOOD, Solid, '#', '='),
      part(Box, -hx, -hy, 0.95, hx, hy, 1.0, [170, 200, 210], Glass, '-', '_')];
      for (let y = -hy + 0.15; y < hy - 0.2; y += 0.32) {
        const h = hash3(seed, Math.round(y * 10), 3);
        if (h < 0.2) continue;
        m.push(part(Box, -0.12, y, 0.6, 0.12, y + 0.22, 0.75, goods(h), Solid, 'o', 'o'));
      }
      break;
    case 'oven': m = [
      part(Box, -hx, -hy, 0, hx, hy, 0.85, STEEL, Solid, '#', '='),
      part(Box, -hx, -hy, 0.85, hx, hy, 1.55, [110, 112, 118], Solid, '#', '='),
      part(Box, hx, -hy + 0.15, 1.05, hx + 0.02, hy - 0.15, 1.3, [255, 130, 40], Glow, '=')]; break;
    case 'washer': case 'dryer': {
      // a front loader; dryers stack two high
      const tall = kind === 'dryer' ? 1.8 : 0.9;
      m = [part(Box, -hx, -hy, 0, hx, hy, tall, WHITE, Solid, '#', '=')];
      for (let z = 0.45; z < tall; z += 0.9) m.push(part(Ball, hx - 0.03, -0.2, z - 0.2, hx + 0.03, 0.2, z + 0.2, [60, 70, 80], Glass, 'O'));
      break;
    }
    case 'till': m = [part(Box, -hx, -hy, 0, hx, hy, 1.0, WOOD, Solid, '#', '='), part(Box, -0.15, -0.2, 1.0, 0.1, 0.2, 1.25, DARK, Solid, '#'), part(Box, 0.1, -0.15, 1.05, 0.12, 0.15, 1.2, [120, 255, 140], Glow, ':')]; break;
    case 'reception': m = [part(Box, -hx, -hy, 0, hx, hy, 1.05, [70, 60, 55], Solid, '#', '='), part(Box, -hx, -hy, 1.05, hx + 0.1, hy, 1.12, [170, 160, 140], Solid, '-', '_')]; break;
    // (13.9c) a wall outlet: a plate at knee height, two dark sockets
    case 'outlet': m = [part(Box, -hx, -hy, 0.28, hx, hy, 0.42, [215, 208, 190], Solid, ':', '='), part(Box, hx, -0.03, 0.31, hx + 0.005, 0.03, 0.39, [40, 38, 36], Solid, ':')]; break;
    case 'plant': m = [part(Cyl, -hx * 0.6, -hy * 0.6, 0, hx * 0.6, hy * 0.6, 0.4, [150, 90, 60], Solid, '|', 'o'), part(Ball, -hx, -hy, 0.35, hx, hy, 1.2, [60, 130, 70], Leaf, '@')]; break;
    default: m = [part(Box, -hx, -hy, 0, hx, hy, 0.8, WOOD, Solid, '#')];
  }
  furns.set(key, m);
  return m;
}

const escapes = new Map<string, Part[]>();
/**
 * One storey of a fire escape, facing +x out of the wall, centered along it (2 bays): the landing's
 * grating at z 0 with its rails (from the first floor up), and the flight up to the next landing in
 * the outer half, climbing toward +y (up) or -y.
 */
export function escapeModel(landing: boolean, flight: number, half: number, odd: boolean): Part[] {
  const key = `${landing}${flight}${half}${odd}`;
  let m = escapes.get(key);
  if (m) return m;
  const IRON: RGB = [95, 95, 105];
  m = [];
  if (landing) {
    m.push(part(Box, 0.02, -half, -0.06, 1, half, 0, IRON, Solid, '=', '#'));
    m.push(part(Box, 0.96, -half, 0, 1, half, 1, IRON, Solid, '|', '-'));
    m.push(part(Box, 0.02, -half, 0, 1, -half + 0.04, 1, IRON, Solid, '|', '-'));
    m.push(part(Box, 0.02, half - 0.04, 0, 1, half, 1, IRON, Solid, '|', '-'));
  }
  if (flight) {
    for (let i = 0; i < 10; i++) {
      const u = (i + 0.5) / 10, y = -half + 2 * half * (flight > 0 ? u : 1 - u), z = 3.5 * (i + 1) / 10;
      m.push(part(Box, odd ? 0.73 : 0.46, y - half / 10, z - 0.04, odd ? 0.97 : 0.71, y + half / 10, z, IRON, Solid, '_', '='));
    }
    m.push(part(Box, 0.95, -half, 0.9, 0.99, half, 0.95, IRON, Solid, '/', '-'));
  }
  escapes.set(key, m);
  return m;
}

const shedModels = new Map<number, Part[]>();
/**
 * A piece of sidewalk shed, `len` long along the wall (y), 2.6 m out (x, from -1.3 to 1.3, the wall
 * at -1.3): a green plywood deck at 3 m on steel posts at the curb side, with a lit bulb under it.
 */
export function shedModel(len: number): Part[] {
  const key = Math.round(len * 10);
  let m = shedModels.get(key);
  if (m) return m;
  const h = len / 2, PLY: RGB = [55, 95, 60], PIPE: RGB = [120, 120, 125];
  m = [
    part(Box, -1.3, -h, 3, 1.3, h, 3.25, PLY, Solid, '=', '#'),
    part(Box, 1.25, -h, 3.25, 1.3, h, 4.1, PLY, Solid, '#', '='),
    part(Box, 1.15, -h + 0.05, 0, 1.25, -h + 0.15, 3, PIPE, Solid, '|'),
    part(Box, 1.15, h - 0.15, 0, 1.25, h - 0.05, 3, PIPE, Solid, '|'),
    part(Box, 1.15, -h, 2.85, 1.25, h, 2.95, PIPE, Solid, '-'),
    part(Ball, -0.08, -0.08, 2.75, 0.08, 0.08, 2.95, [255, 225, 160], Glow, 'o'),
  ];
  shedModels.set(key, m);
  return m;
}

const boards = new Map<string, Part[]>();
/**
 * Rooftop billboard facing +x, w wide and h tall, standing on a roof at height `base` with its
 * panel's foot at `top` (both world heights): a painted panel with `text` (fg on bg), steel legs and braces behind it, a catwalk along
 * its foot and gooseneck lamps over the catwalk, lit at `lamp` (0..1, in eighths).
 */
export function boardModel(text: string, w: number, h: number, base: number, top: number, bg: RGB, fg: RGB, lamp: number): Part[] {
  const key = `${text}|${w.toFixed(1)}|${h.toFixed(1)}|${base.toFixed(1)}|${top.toFixed(1)}|${bg.join()}|${fg.join()}|${lamp}`;
  let m = boards.get(key);
  if (m) return m;
  const hw = w / 2, z0 = top, z1 = top + h;
  m = [part(Box, -0.12, -hw, z0, 0.12, hw, z1, [70, 70, 75], Board, '#', '=', '#')];
  m[0].text = text; m[0].col = bg; m[0].col2 = fg; m[0].lamp = lamp;
  // legs and braces behind the panel
  const legs = Math.max(2, Math.round(w / 4) + 1);
  for (let k = 0; k < legs; k++) {
    const y = -hw + 0.4 + ((w - 0.8) * k) / (legs - 1);
    m.push(part(Box, -0.5, y - 0.1, base, -0.3, y + 0.1, z1 - 0.3, STEEL, Solid, '|', '.'));
    m.push(part(Box, -0.3, y - 0.05, z0 - 0.2, -0.12, y + 0.05, z1 - 0.3, STEEL, Solid, '|'));
  }
  m.push(part(Box, -0.5, -hw, (base + z0) / 2 - 0.06, -0.3, hw, (base + z0) / 2 + 0.06, STEEL, Solid, '-', '='));
  // catwalk with its rail, and the lamps on their arms
  m.push(part(Box, 0.12, -hw, z0 - 0.12, 0.95, hw, z0 - 0.02, STEEL, Solid, '=', '#'));
  m.push(part(Box, 0.9, -hw, z0 - 0.02, 0.95, hw, z0 + 0.06, STEEL, Solid, '-'));
  const lamps = Math.max(2, Math.round(w / 3.5));
  for (let k = 0; k < lamps && m.length < 31; k++) {
    const y = -hw + (w * (k + 0.5)) / lamps;
    m.push(part(Box, 0.75, y - 0.12, z0 + 0.06, 1.0, y + 0.12, z0 + 0.22, lamp > 0.05 ? [255 * lamp + 40, 235 * lamp + 38, 190 * lamp + 36] : [70, 70, 72], lamp > 0.05 ? Glow : Solid, lamp > 0.05 ? '*' : '-'));
  }
  if (boards.size > 2000) boards.clear();
  boards.set(key, m);
  return m;
}

const masts = new Map<string, Part[]>();
/**
 * A cell site's mast on a roof at `base`: an equipment cabinet, the pole, three panel antennas
 * around its top (one per sector), and the red aviation light, `lit` while it blinks on.
 */
export function mastModel(base: number, lit: boolean): Part[] {
  const key = base.toFixed(1) + (lit ? '*' : '');
  let m = masts.get(key);
  if (m) return m;
  const z = base;
  m = [
    part(Box, -1.6, -0.6, z, -0.8, 0.6, z + 1.6, [120, 122, 118], Solid, '#', '='),
    part(Cyl, -0.15, -0.15, z, 0.15, 0.15, z + 8.2, STEEL, Solid, '|', '.'),
    part(Box, -0.2, -0.2, z + 3.5, 0.2, 0.2, z + 3.6, STEEL, Solid, '-'),
  ];
  for (let k = 0; k < 3; k++) {
    // a panel 1.4 m tall facing out, at 0, 120 and 240 degrees
    const a = (k * 2 * Math.PI) / 3, c = Math.cos(a), s2 = Math.sin(a), cx = c * 0.45, cy = s2 * 0.45;
    m.push(part(Box, cx - 0.16, cy - 0.16, z + 5.3, cx + 0.16, cy + 0.16, z + 6.7, [205, 205, 200], Solid, '[', '|'));
  }
  m.push(part(Ball, -0.14, -0.14, z + 8.2, 0.14, 0.14, z + 8.5, lit ? [255, 40, 30] : [70, 18, 16], lit ? Glow : Solid, lit ? '*' : 'o'));
  masts.set(key, m);
  return m;
}

const signals = new Map<string, Part[]>();
const HOUSING: RGB = [34, 36, 30];
/** Lamp colors of a traffic light, top to bottom, lit and dark. */
const SIG_LIT: RGB[] = [[255, 40, 30], [255, 180, 30], [60, 255, 140]];
const SIG_DARK: RGB[] = [[60, 16, 14], [60, 46, 14], [14, 50, 30]];
/**
 * A traffic light's mast arm, facing +x (the oncoming traffic), drawn as its own object centered on
 * the arm so its bounds stay small: the arm along y from `y0` (at the pole) to past the farthest
 * head, one head per lane at `at` (y, same frame). `lit` is the lamp that is on (0 red, 1 yellow,
 * 2 green), or -1 when it is dark. The pole is signalPole.
 */
export function signalModel(at: number[], y0: number, lit: number): Part[] {
  const key = at.join() + '|' + y0 + '|' + lit;
  let m = signals.get(key);
  if (m) return m;
  const reach = Math.max(...at) + 0.4;
  m = [part(Box, -0.06, y0, 5.95, 0.06, reach, 6.12, HOUSING, Solid, '-', '=', '|')];
  for (const y of at) {
    m.push(part(Box, -0.18, y - 0.2, 4.75, 0.18, y + 0.2, 5.95, HOUSING, Solid, '#', '=', '#'));
    for (let k = 0; k < 3; k++) {
      const z = 5.6 - k * 0.38;
      m.push(part(Box, 0.18, y - 0.13, z - 0.13, 0.24, y + 0.13, z + 0.13, k === lit ? SIG_LIT[k] : SIG_DARK[k], k === lit ? Glow : Solid, k === lit ? '@' : 'o'));
    }
  }
  signals.set(key, m);
  return m;
}

/** Far away, only the lamp that is lit in each head: what the eye picks out down an avenue at night. */
export function signalFarModel(at: number[], lit: number): Part[] {
  const key = 'far|' + at.join() + '|' + lit;
  let m = signals.get(key);
  if (m) return m;
  const z = 5.6 - lit * 0.38;
  m = at.map((y) => part(Box, 0.05, y - 0.18, z - 0.18, 0.24, y + 0.18, z + 0.18, SIG_LIT[lit], Glow, '@'));
  signals.set(key, m);
  return m;
}

/** A traffic light's pole on its base (the walk signals on it are walkSignal). */
export const SIGNAL_POLE: Part[] = [
  part(Cyl, -0.2, -0.2, 0, 0.2, 0.2, 0.5, STEEL, Solid, '#', '='),
  part(Cyl, -0.12, -0.12, 0, 0.12, 0.12, 6.3, HOUSING, Solid, '|', '.'),
];
const walks: Part[][] = [];
/**
 * A walk signal on a pole, facing +x: a lamp panel that reads GO in green when people may cross, XX in red when not (two letters as GO, the signage manual),
 * a red X when they may not, like the shop signs (bulbs up close, glyphs farther). 1 GO, 2 X, 0 dark.
 * The panel is a little larger than a real one, so the word reads from across an avenue.
 */
export function walkSignal(w: number): Part[] {
  let m = walks[w];
  if (m) return m;
  const plate = part(Box, 0.38, -0.35, 2.38, 0.41, 0.35, 2.98, [16, 15, 14], Board, '.');
  if (w) { plate.text = w === 1 ? 'GO' : 'XX'; plate.col2 = w === 1 ? [70, 255, 120] : [255, 45, 35]; plate.bulbs = true; }
  m = walks[w] = [part(Box, 0.1, -0.37, 2.35, 0.38, 0.37, 3.0, HOUSING, Solid, '#', '=', '#'), plate];
  return m;
}

const streetSigns = new Map<string, Part[]>();
/** The districts' stripe colors (the signage manual, section 3; a color a district type, decided 2026-10-08: the color says the kind of neighbourhood, the number which one). */
export const DISTRICT_COLS: Record<DistrictType, RGB> = { financial: [216, 162, 29], commercial: [42, 159, 208], residential: [95, 174, 59], historic: [122, 79, 196], industrial: [210, 85, 42], theater: [194, 54, 122] };
/** A street blade's height (m). */
export const BLADE_H = 0.3;
/** The street green and the letters' white (the manual: #1f6b45, #f2f1ec; the white a little brighter, as reflective). */
const SIGN_GREEN: RGB = [31, 107, 69], SIGN_WHITE: RGB = [242, 241, 236];
/** A street blade's half width for its name and hundred (m). */
export const bladeHalf = (name: string, hund: string) => (0.135 * name.length + 0.1 * hund.length + 0.3) / 2;
/**
 * A street-name blade (the signage manual, section 4), its name read from the front (+x): green with white
 * letters (dots up close, a glyph a letter farther), the district's stripe along its top and the block's
 * hundred at its right. Its back is plain: a corner gets two, back to back. `z0` its foot; `pole`: with its
 * own pole under it.
 */
export function streetBlade(name: string, hund: string, stripe: RGB, z0: number, pole: boolean): Part[] {
  const key = `${name}|${hund}|${stripe.join()}|${z0}|${pole}`;
  let m = streetSigns.get(key);
  if (m) return m;
  // (read from +x, the reader's right is -y: the hundred there)
  const hw = bladeHalf(name, hund), H = BLADE_H, split = -hw + (0.1 * hund.length + 0.08);
  const b = part(Box, 0, -hw, z0, 0.02, hw, z0 + H, SIGN_GREEN, Solid, '=');
  // the name on the left part, the hundred smaller on the right (plates: no frame), the stripe on top
  const nm = part(Box, 0.02, split, z0 + 0.02, 0.022, hw - 0.02, z0 + H - 0.05, SIGN_GREEN, Board, '=');
  nm.text = name; nm.col2 = SIGN_WHITE; nm.lamp = 0; nm.plate = true;
  const hn = part(Box, 0.02, -hw + 0.03, z0 + 0.05, 0.022, split, z0 + H - 0.09, SIGN_GREEN, Board, '=');
  hn.text = hund; hn.col2 = SIGN_WHITE; hn.lamp = 0; hn.plate = true;
  m = [b, nm, hn, part(Box, 0.02, -hw, z0 + H - 0.035, 0.024, hw, z0 + H, stripe, Solid, '-')];
  // the pole stops under the blade: the sign sits on its cap, nothing crosses its face
  if (pole) m.push(part(Cyl, -0.04, -0.04, 0, 0.04, 0.04, z0, STEEL, Solid, '|', '.'));
  streetSigns.set(key, m);
  return m;
}

/**
 * The overhead blade (the manual, section 4): at the end of a light's arm, past its last head, hanging under the
 * arm's piece carried on to it; the crossing road's name for the traffic it faces (+x). In the arm's frame:
 * y from `y0` outward.
 */
export function overheadBlade(name: string, hund: string, stripe: RGB, y0: number): Part[] {
  const key = `over|${name}|${hund}|${stripe.join()}|${y0}`;
  let m = streetSigns.get(key);
  if (m) return m;
  // (read from +x, the reader's right is -y, toward the pole: the hundred there)
  const hw = bladeHalf(name, hund) * 1.6, H = 0.42, z0 = 5.45, y1 = y0 + 0.15 + hw * 2, split = y0 + 0.15 + (0.13 * hund.length + 0.18);
  const b = part(Box, 0.07, y0 + 0.15, z0, 0.09, y1, z0 + H, SIGN_GREEN, Solid, '=');
  const nm = part(Box, 0.09, split, z0 + 0.03, 0.092, y1 - 0.03, z0 + H - 0.07, SIGN_GREEN, Board, '=');
  nm.text = name; nm.col2 = SIGN_WHITE; nm.lamp = 0; nm.plate = true;
  const hn = part(Box, 0.09, y0 + 0.18, z0 + 0.07, 0.092, split, z0 + H - 0.12, SIGN_GREEN, Board, '=');
  hn.text = hund; hn.col2 = SIGN_WHITE; hn.lamp = 0; hn.plate = true;
  m = [
    // the arm carried on to it, and the two clamps it hangs from
    part(Box, -0.06, y0, 5.95, 0.06, y1 + 0.05, 6.12, HOUSING, Solid, '-', '=', '|'),
    part(Box, 0.0, y0 + 0.3, z0 + H, 0.07, y0 + 0.34, 5.95, STEEL, Solid, '|'),
    part(Box, 0.0, y1 - 0.19, z0 + H, 0.07, y1 - 0.15, 5.95, STEEL, Solid, '|'),
    b, nm, hn, part(Box, 0.09, y0 + 0.15, z0 + H - 0.05, 0.094, y1, z0 + H, stripe, Solid, '-'),
  ];
  streetSigns.set(key, m);
  return m;
}

/** A guide sign on its post, facing +x (13.7): brown with white letters, toward a landmark ("^ OLD MARLOW 0.3 MI"). */
export function guideSign(text: string): Part[] {
  const key = `guide|${text}`;
  let m = streetSigns.get(key);
  if (m) return m;
  const hw = Math.max(0.8, 0.12 * text.length + 0.3) / 2;
  const b = part(Box, 0.05, -hw, 2.1, 0.08, hw, 2.5, [105, 62, 34], Board, '=');
  b.text = text; b.col2 = [240, 235, 225]; b.lamp = 0;
  m = [part(Cyl, -0.04, -0.04, 0, 0.04, 0.04, 2.6, STEEL, Solid, '|', '.'), b];
  streetSigns.set(key, m);
  return m;
}

/**
 * A stop sign facing +x on its post: an octagon 0.76 m across (the signage manual, section 4), built of thin
 * slices as the city's objects are (cubes), its middle band carrying STOP in white.
 */
export const STOP_SIGN: Part[] = (() => {
  const D = 0.76, R = D / 2, side = R * 0.4142, zc = 2.48, red: RGB = [200, 38, 43], n = 10, dz = D / n;
  const m = [part(Cyl, -0.05, -0.05, 0, 0.05, 0.05, zc + 0.3, STEEL, Solid, '|', '.')];
  for (let k = 0; k < n; k++) {
    const z0 = zc - R + k * dz, mid = Math.abs(z0 + dz / 2 - zc), hw = mid <= side ? R : R - (mid - side);
    if (mid + dz / 2 <= side + 1e-6) continue; // the middle band is one board, below
    m.push(part(Box, 0.05, -hw, z0, 0.08, hw, z0 + dz, red, Solid, '#', '=', '#'));
  }
  const band = part(Box, 0.05, -R, zc - side, 0.08, R, zc + side, red, Board, '#', '=', '#');
  band.text = 'STOP'; band.col2 = SIGN_WHITE; band.lamp = 0; band.plate = true;
  m.push(band);
  return m;
})();

/** The turn signal's amber lamps on one side (sg: -1 left, 1 right; +y of a car is its right), and the high beams flashing. */
const LAMPS = new Map<string, Part[]>();
export function signalLamps(hl: number, hw: number, sg: number, flash: boolean): Part[] {
  const key = `${hl}|${hw}|${sg}|${+flash}`;
  let m = LAMPS.get(key);
  if (m) return m;
  m = [];
  if (sg) {
    const y0 = sg > 0 ? hw - 0.25 : -hw + 0.05, y1 = y0 + 0.2;
    m.push(part(Box, hl - 0.02, y0, 0.66, hl + 0.06, y1, 0.8, [255, 170, 30], Glow, '*'));
    m.push(part(Box, -hl - 0.06, y0, 0.66, -hl + 0.02, y1, 0.8, [255, 150, 20], Glow, '*'));
  }
  if (flash) for (const y of [-hw + 0.1, hw - 0.4]) m.push(part(Box, hl - 0.01, y, 0.6, hl + 0.08, y + 0.3, 0.88, [255, 255, 240], Glow, '@'));
  LAMPS.set(key, m);
  return m;
}

const yards = new Map<string, Part[]>();
const TRAFO: RGB = [86, 100, 88], PORCELAIN: RGB = [176, 120, 84], GRAVEL: RGB = [78, 76, 70];
/**
 * A substation's yard, D deep (along x, +x toward the street) and W wide: a gravel pad, a chain-link
 * fence (see-through, Glass) on posts with barbed wire on top and a gate on the street side with the
 * high-voltage sign, two or three transformers with their radiators, bushings and conservator
 * tanks, a steel gantry over them carrying the incoming line on insulator strings, the control hut at
 * the back and a floodlight on a pole. `on`: the hut's lamp green and the yard floodlit at night
 * (`flood`, 0..1); off, the lamp red and the yard dark.
 */
export function substationModel(D: number, W: number, on: boolean, flood: number, name = ''): Part[] {
  const key = `${D.toFixed(1)}|${W.toFixed(1)}|${on}|${flood}|${name}`;
  let m = yards.get(key);
  if (m) return m;
  const hx = D / 2 - 0.6, hy = W / 2 - 0.6;
  m = [part(Box, -hx, -hy, 0, hx, hy, 0.06, GRAVEL, Solid, ':', '.', ':')];
  // the fence: the mesh on each side (the gate's two leaves on the street side), posts every ~3 m, the top rail
  const FH = 2.4;
  m.push(part(Box, -hx, -hy, 0, -hx + 0.03, hy, FH, [120, 124, 120], Glass, '#'));
  m.push(part(Box, -hx, -hy, 0, hx, -hy + 0.03, FH, [120, 124, 120], Glass, '#'));
  m.push(part(Box, -hx, hy - 0.03, 0, hx, hy, FH, [120, 124, 120], Glass, '#'));
  m.push(part(Box, hx - 0.03, -hy, 0, hx, -1.8, FH, [120, 124, 120], Glass, '#'));
  m.push(part(Box, hx - 0.03, 1.8, 0, hx, hy, FH, [120, 124, 120], Glass, '#'));
  m.push(part(Box, hx - 0.05, -1.8, 0, hx, 1.8, FH - 0.1, [140, 144, 138], Glass, '#'));
  for (const [x, y] of [[-hx, -hy], [hx, -hy], [-hx, hy], [hx, hy], [hx, -1.8], [hx, 1.8], [-hx, 0], [0, -hy], [0, hy]]) m.push(part(Cyl, x - 0.06, y - 0.06, 0, x + 0.06, y + 0.06, FH + 0.35, STEEL, Solid, '|', '+'));
  // barbed wire over the top
  m.push(part(Box, -hx, -hy, FH + 0.25, hx, -hy + 0.04, FH + 0.32, [90, 90, 96], Solid, '~'));
  m.push(part(Box, -hx, hy - 0.04, FH + 0.25, hx, hy, FH + 0.32, [90, 90, 96], Solid, '~'));
  m.push(part(Box, -hx, -hy, FH + 0.25, -hx + 0.04, hy, FH + 0.32, [90, 90, 96], Solid, '~'));
  // the sign on the gate, facing the street
  const sign = part(Box, hx, -0.8, 1.1, hx + 0.04, 0.8, 1.75, [230, 210, 40], Board, '#');
  sign.text = 'DANGER'; sign.col2 = [20, 20, 20]; sign.lamp = Math.max(0.25, flood * 0.6);
  m.push(sign);
  // the utility's plate over it: whose yard this is, and its number (13.7)
  if (name) {
    const plate = part(Box, hx, -1.2, 1.85, hx + 0.04, 1.2, 2.2, [235, 235, 230], Board, '#');
    plate.text = name; plate.col2 = [30, 60, 140]; plate.lamp = Math.max(0.25, flood * 0.6);
    m.push(plate);
  }
  // the transformers, side by side across the yard
  const n = W > 22 ? 3 : 2, tx = -hx * 0.05;
  for (let k = 0; k < n; k++) {
    const y = -hy + ((2 * hy) * (k + 0.5)) / n;
    m.push(part(Box, tx - 1.3, y - 1.0, 0.06, tx + 1.3, y + 1.0, 2.7, TRAFO, Solid, '#', '=', '#'));
    // radiator fins on both sides
    m.push(part(Box, tx - 1.1, y - 1.45, 0.4, tx + 1.1, y - 1.0, 2.4, [70, 82, 72], Solid, '|', '-'));
    m.push(part(Box, tx - 1.1, y + 1.0, 0.4, tx + 1.1, y + 1.45, 2.4, [70, 82, 72], Solid, '|', '-'));
    // the conservator tank on top, and three bushings
    m.push(part(Ball, tx - 1.2, y - 0.35, 2.75, tx + 0.2, y + 0.35, 3.35, [96, 110, 98], Solid, 'o', 'O'));
    for (let b = -1; b <= 1; b++) m.push(part(Cyl, tx + 0.6 - 0.11, y + b * 0.55 - 0.11, 2.7, tx + 0.6 + 0.11, y + b * 0.55 + 0.11, 4.0, PORCELAIN, Solid, '=', '*'));
  }
  // the gantry: two lattice posts and the beam across, with the line's insulator strings
  const gx = tx + 0.6;
  m.push(part(Box, gx - 0.25, -hy + 0.8, 0.06, gx + 0.25, -hy + 1.3, 9, STEEL, Solid, 'X', '+'));
  m.push(part(Box, gx - 0.25, hy - 1.3, 0.06, gx + 0.25, hy - 0.8, 9, STEEL, Solid, 'X', '+'));
  m.push(part(Box, gx - 0.25, -hy + 0.8, 8.5, gx + 0.25, hy - 0.8, 9, STEEL, Solid, 'X', '='));
  for (let b = -1; b <= 1; b++) m.push(part(Cyl, gx - 0.07, b * 0.55 - 0.07, 7.1, gx + 0.07, b * 0.55 + 0.07, 8.5, PORCELAIN, Solid, '='));
  // the control hut at the back, its door and the status lamp over it
  const hut = Math.min(4, D * 0.28);
  m.push(part(Box, -hx + 0.4, -hy + 0.6, 0.06, -hx + 0.4 + hut, -hy + 0.6 + Math.min(5, W * 0.35), 3, [150, 138, 120], Solid, '#', '='));
  m.push(part(Box, -hx + 0.4 + hut, -hy + 1.4, 0.06, -hx + 0.44 + hut, -hy + 2.4, 2.1, [60, 64, 70], Solid, '|'));
  m.push(part(Ball, -hx + 0.44 + hut, -hy + 1.75, 2.35, -hx + 0.6 + hut, -hy + 2.05, 2.6, on ? [80, 255, 120] : [255, 50, 40], Glow, '*'));
  // the floodlight on its pole, in a front corner
  m.push(part(Cyl, hx - 1.2, hy - 1.2, 0, hx - 1.0, hy - 1.0, 7, STEEL, Solid, '|', '.'));
  m.push(part(Box, hx - 1.4, hy - 1.5, 6.8, hx - 0.8, hy - 0.7, 7.2, flood > 0.05 ? [255, 240 * flood + 15, 200 * flood + 30] : [70, 70, 72], flood > 0.05 ? Glow : Solid, flood > 0.05 ? '*' : '='));
  if (yards.size > 200) yards.clear();
  yards.set(key, m);
  return m;
}

const cams = new Map<string, Part[]>();
/**
 * A security camera at height z, looking along +x (it pans with the object's heading), by its
 * model's shape (sim/cctv.ts): a box camera in its weather housing with a sun shield and a dark
 * lens; a dome, a smoked half-ball under a white base; a bullet, a long white tube with a hood. The
 * red light of a camera recording blinks (`led`).
 */
export function cctvModel(z: number, led: boolean, shape: 'box' | 'dome' | 'bullet'): Part[] {
  const key = z.toFixed(1) + (led ? '*' : '') + shape;
  let m = cams.get(key);
  if (m) return m;
  const LED: RGB = led ? [255, 40, 30] : [70, 20, 18], ledM = led ? Glow : Solid;
  if (shape === 'box') m = [
    part(Box, -0.36, -0.12, z - 0.13, 0.22, 0.12, z + 0.09, [210, 210, 204], Solid, '=', '-', '#'),
    part(Box, -0.4, -0.16, z + 0.09, 0.32, 0.16, z + 0.13, [180, 182, 176], Solid, '-', '='),
    part(Ball, 0.18, -0.085, z - 0.11, 0.3, 0.085, z + 0.06, [22, 24, 30], Solid, 'o', 'o'),
    part(Box, -0.4, -0.03, z - 0.05, -0.36, 0.03, z + 0.01, LED, ledM, '.'),
  ];
  else if (shape === 'dome') m = [
    part(Cyl, -0.2, -0.2, z + 0.02, 0.2, 0.2, z + 0.12, [222, 222, 218], Solid, '=', '-'),
    part(Ball, -0.17, -0.17, z - 0.2, 0.17, 0.17, z + 0.06, [38, 40, 48], Solid, 'O', 'o'),
    part(Box, 0.16, -0.025, z + 0.02, 0.2, 0.025, z + 0.07, LED, ledM, '.'),
  ];
  else m = [
    part(Ball, -0.3, -0.09, z - 0.09, 0.22, 0.09, z + 0.09, [226, 226, 222], Solid, '=', '-'),
    part(Box, -0.05, -0.11, z + 0.07, 0.32, 0.11, z + 0.1, [200, 200, 196], Solid, '-', '='),
    part(Ball, 0.17, -0.06, z - 0.06, 0.25, 0.06, z + 0.06, [22, 24, 30], Solid, 'o', 'o'),
    part(Box, -0.18, -0.12, z - 0.03, -0.14, -0.09, z + 0.02, LED, ledM, '.'),
  ];
  cams.set(key, m);
  return m;
}
const camMounts = new Map<string, Part[]>();
/**
 * What a camera hangs from, reaching `arm` metres along +x to it at height z: a pole of its own with
 * an arm (traffic, `pole`), or a bracket out of the wall (shop).
 */
export function cctvMount(z: number, arm: number, pole: boolean): Part[] {
  const key = `${z.toFixed(1)}|${arm.toFixed(2)}|${pole}`;
  let m = camMounts.get(key);
  if (m) return m;
  m = pole
    ? [part(Cyl, -0.09, -0.09, 0, 0.09, 0.09, z + 0.35, [92, 96, 100], Solid, '|', '.'), part(Box, 0, -0.04, z + 0.22, arm, 0.04, z + 0.3, [92, 96, 100], Solid, '-', '='), part(Box, arm - 0.04, -0.03, z + 0.1, arm + 0.04, 0.03, z + 0.24, [92, 96, 100], Solid, '|')]
    : [part(Box, 0, -0.06, z - 0.02, arm, 0.06, z + 0.04, [150, 150, 146], Solid, '-', '='), part(Box, 0, -0.1, z - 0.12, 0.04, 0.1, z + 0.12, [150, 150, 146], Solid, '#')];
  camMounts.set(key, m);
  return m;
}
