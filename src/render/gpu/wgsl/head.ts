import { BAY, FLOOR_H, LANE_W, SIDEWALK } from '../../../sim/city';
import { CELL, FLOOD_OUT, PANEL_S, SIDE } from '../../lights';
import { BLOCKS, FLOOD_FIX_FAR, FLOOD_GAP, LITTER, LITTER_FAR } from '../../raycaster';
import { G, UNIFORMS, f } from './common';
import { LAMP_R, LIGHT_W } from '../../lightmap';

export function headWGSL(): string {
  const glyphs = Object.entries(G).map(([k, v]) => `const ${k} = ${v}u;`).join('\n');
  return /* wgsl */ `
struct U { ${UNIFORMS.map((n) => `${n}: f32`).join(', ')} };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> xb: array<f32>;
@group(0) @binding(2) var<storage, read> yb: array<f32>;
@group(0) @binding(3) var<storage, read> xc: array<u32>;
@group(0) @binding(4) var<storage, read> yc: array<u32>;
@group(0) @binding(5) var<storage, read> blk: array<f32>;
@group(0) @binding(6) var<storage, read> bld: array<f32>;
@group(0) @binding(7) var<storage, read_write> outp: array<u32>;
@group(0) @binding(8) var<storage, read> subs: array<f32>;
@group(0) @binding(9) var<storage, read> lmap: array<u32>;
@group(0) @binding(10) var<storage, read> lampCol: array<f32>;
@group(0) @binding(11) var<storage, read> dl: array<f32>;
@group(0) @binding(12) var<storage, read> dlv: array<f32>;
@group(0) @binding(13) var<storage, read> doff: array<u32>;
@group(0) @binding(14) var<storage, read> didx: array<u32>;
@group(0) @binding(15) var<storage, read> sg: array<u32>;
@group(0) @binding(16) var<storage, read> fx: array<u32>;

${glyphs}
const FLOOR_H = ${FLOOR_H};
const BAY = ${BAY};
const SIDEWALK = ${SIDEWALK};
const LANE_W = ${LANE_W};
const FOG = 1500.0;
// how much of a far thing the city's orange glow covers at night (finish)
const NIGHT_HAZE = 0.42;
const LIT_H = 9.0;
const LIT_FAR = 600.0;
const GROUND_FAR = 600.0;
const LIGHT_KNEE = 150.0;
/** How much of a lamp's light a surface sends back once tinted by its color (finish), and how strongly a lit room's light spills onto the wall around its window. */
/** A panel light's size factor (PANEL_S in lights.ts), and how much of it a surface turned away from it still gets (it is not a point: some of it always shows). */
const PANEL_S = ${f(PANEL_S)}; const PANEL_RECV_WRAP = 0.15;
const WIN_SPILL = 70.0;
const CROWN_H = 16.0;
const FLOOD_GAP = ${f(FLOOD_GAP)}; const FLOOD_OUT = ${f(FLOOD_OUT)}; const FLOOD_FIX_FAR = ${f(FLOOD_FIX_FAR)}; const FLOOD_SHADOW_FAR = 45.0;
const LW = ${LIGHT_W};
const DSIDE = ${SIDE};
const DCELL = ${CELL}.0;
const BLOCKS = array<u32, 256>(${Array.from(BLOCKS).map((b) => `${b}u`).join(',')});
const PATS = array<vec3u, 5>(vec3u(AT, HASH, PCT), vec3u(56u, O, COL), vec3u(88u, 90u, PLUS), vec3u(48u, O, EQ), vec3u(72u, HASH, EQ));
// materials (R.23): how rough a surface is (0 a mirror, 1 matte) and how much it reflects head-on (F0)
const MAT_NONE = 0u; const MAT_ASPHALT = 1u; const MAT_CONCRETE = 2u; const MAT_BRICK = 3u; const MAT_GLASS = 4u; const MAT_METAL = 5u;
const MAT_PAINT = 6u; const MAT_LEAF = 7u; const MAT_STONE = 8u; const MAT_WINDOW = 9u;
// (a car's paint: a clear coat over a satin color, not chrome; its mirror only shows toward the edges, blurred)
const MAT_ROUGH = array<f32, 10>(1.0, 0.8, 0.85, 0.9, 0.04, 0.45, 0.35, 1.0, 0.75, 0.05);
const MAT_F0 = array<f32, 10>(0.0, 0.03, 0.03, 0.025, 0.05, 0.25, 0.1, 0.02, 0.03, 0.04);
// each facade style's wall (office, glass, brick, historic, residential, warehouse, lit stripes, spire, ...)
const WALL_MAT = array<u32, 16>(2u, 5u, 3u, 8u, 2u, 5u, 2u, 5u, 2u, 5u, 5u, 8u, 8u, 5u, 2u, 2u);
/** How far a mirroring surface traces its reflection (m); past it, it mirrors the sky only. */
const REFL_FAR_WALL = 260.0; const REFL_FAR_GROUND = 160.0;
/** How far a car's paint mirrors the city (m); past it, the sky only. How much the paint's color tints what it mirrors (metallic flakes). */
const REFL_FAR_CAR = 90.0; const CAR_METAL = 0.25;
/** How far a rough surface's mirror ray is scattered per unit of roughness (a blurred reflection, dithered per cell). */
const REFL_BLUR = 0.1;
/** How much of a lamp's highlight on glossy paint, metal or glass blooms, and where the sun's glint starts blooming and how fast it grows. */
const SPEC_BLOOM = 1.6; const SPEC_BLOOM_MIN = 0.4; const SPEC_BLOOM_SUN = 0.5;
/** How saturated the palette color reads as albedo under a light: the palettes are near grey (their hue shows
 *  mostly through the city's orange haze), so a lit wall went grey; the light now takes a stronger version of the hue. */
const LIT_SAT = 1.5;
/** How much of a lamp's own hue a facade takes (0: only its brightness). */
const WALL_LAMP_HUE = 0.9;
/** At night, how much darker the street objects' paint reads than its palette color (as the walls' palette is). */
const OBJ_NIGHT = 0.3;
/** How strongly a glossy surface shows the lamps' light at night, on top of the light it scatters. */
/** The walls of the shops seen through their windows: mint, butter, salmon, sky, cream, red. */
const SHOP_PAINT = array<vec3f, 6>(vec3f(150.0, 205.0, 175.0), vec3f(225.0, 205.0, 120.0), vec3f(220.0, 140.0, 115.0), vec3f(135.0, 180.0, 215.0), vec3f(220.0, 205.0, 170.0), vec3f(190.0, 80.0, 70.0));
const LAMP_GLOSS = 1.2; const CAR_GLOSS = 1.5;
const KIND_OTHER = 0u; const KIND_GROUND = 1u; const KIND_WALL = 2u; const KIND_BLOCK = 3u; const KIND_OBJECT = 4u; const KIND_ROOM = 5u;
const LIT_A = array<vec4f, ${LITTER.length}>(${LITTER.map((L) => `vec4f(${L.slice(0, 4).map(f).join(', ')})`).join(', ')});
const LIT_B = array<vec3f, ${LITTER.length}>(${LITTER.map((L) => `vec3f(${L.slice(4).map(f).join(', ')})`).join(', ')});
const LITTER_FAR = ${f(LITTER_FAR)};
// (lamp pool radius ${LAMP_R} m: baked into the light map on the CPU)

// the same hash as core/rng.ts's hash3 (32-bit wrapping products)
fn hash3(a: i32, b: i32, c: i32) -> f32 {
  var h = (u32(a) * 374761393u) ^ (u32(b) * 668265263u) ^ (u32(c) * 2147483647u);
  h = (h ^ (h >> 13u)) * 1274126177u;
  h = h ^ (h >> 16u);
  return f32(h) / 4294967296.0;
}
fn ifloor(x: f32) -> i32 { return i32(floor(x)); }

`;
}
