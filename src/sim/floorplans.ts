/**
 * The drawn floors and room arrangements of the interiors manual (docs/identidade/interiores-manual.html),
 * and the rules every one of them must pass before the game uses it. One character is half a metre; the first
 * row is the street facade. Two layers of the same size: the plan (walls, doors, rooms) and the furniture.
 * Not used by the plans in the game yet: the rework of the interiors (after the manual) builds on this.
 */
import data from './floorplans.json';

export interface Floor {
  id: string;
  /** Plan: '#' outer wall, 'W' window, 'G' shop glass, '+' inner wall, 'D' door, 'E' a home's entry, 'R' street door, 'S' stair, 'L' lift, '.' common hall, 'x' roof; lowercase letters are rooms. */
  rooms: string[];
  /** Furniture over the plan: '.' free floor, a letter of FURN a piece. */
  furn: string[];
  /** Rows that repeat to fit deeper lots, and the depths (m) the plan serves, the first its own. */
  rep?: number[];
  depths?: number[];
}
/** A room's frame (walls '#', windows 'W', doors 'D', open sides 'o' around '.' floor) and one way to furnish it. */
export interface Arrangement { room: string; who: string; frame: string[]; rows: string[] }
export interface BuildingStack { name: string; floors: string[] }

export const FLOORS = data.floors as Floor[];
export const ARRANGEMENTS = data.arrangements as Arrangement[];
export const BUILDINGS = data.buildings as BuildingStack[];

/** Room letters and what they are. */
export const ROOM_KINDS: Record<string, string> = {
  l: 'living', e: 'entry', k: 'kitchen', b: 'bedroom', h: 'bath', s: 'studio', c: 'residents corridor', u: 'utility',
  o: 'shop', p: 'open office', m: 'manager office', n: 'meeting room', q: 'pantry', r: 'motel office',
};
/** Furniture letters: tall pieces (never against a window) and the posto a piece gives its user. */
export const FURN: Record<string, { tall?: boolean; posto?: string }> = {
  B: { posto: 'sleep' }, A: { tall: true }, Q: { posto: 'desk' }, h: { posto: 'sit' }, F: { posto: 'sofa' }, T: {}, t: { posto: 'eat' },
  K: {}, O: { posto: 'cook' }, N: { posto: 'dishes' }, G: { tall: true }, V: {}, C: {}, H: { posto: 'shower' }, P: {}, w: {}, y: {},
  X: { tall: true }, Z: { tall: true }, U: {}, S: { tall: true }, r: { posto: 'sofa' }, J: {},
};

const WALLS = new Set(['#', 'W', 'G', '+']);
const DOORS = new Set(['D', 'E', 'R']);
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** A plan with its repeated rows grown to depth d (m): each extra 2 m is 4 rows, shared among the rep rows. */
export function grow(F: Floor, d: number): Floor {
  if (!F.rep || !F.depths) return F;
  const extra = ((d - F.depths[0]) * 2) / F.rep.length, rooms: string[] = [], furn: string[] = [];
  F.rooms.forEach((r, y) => { const n = F.rep!.includes(y) ? 1 + extra : 1; for (let i = 0; i < n; i++) { rooms.push(r); furn.push(F.furn[y]); } });
  return { ...F, rooms, furn };
}

interface Comp { cells: [number, number][]; x0: number; x1: number; y0: number; y1: number; ch: string }
/** The 4-connected region of one character around (sx, sy). */
function component(rows: string[], sx: number, sy: number): Comp {
  const ch = rows[sy][sx], H = rows.length, W = rows[0].length, seen = new Set([sy * W + sx]), q: [number, number][] = [[sx, sy]], cells: [number, number][] = [];
  let x0 = sx, x1 = sx, y0 = sy, y1 = sy;
  while (q.length) {
    const [x, y] = q.pop()!;
    cells.push([x, y]);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    for (const [dx, dy] of N4) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || rows[ny][nx] !== ch || seen.has(ny * W + nx)) continue;
      seen.add(ny * W + nx); q.push([nx, ny]);
    }
  }
  return { cells, x0, x1, y0, y1, ch };
}

/** The manual's rules R1-R8 on one floor (one depth): each failure as 'R<n> what'. Empty when it passes. */
export function checkFloor(F: Floor): string[] {
  const R = F.rooms, M = F.furn, H = R.length, W = R[0].length, out: string[] = [];
  // R1: one width, a closed frame
  if (!R.every((r) => r.length === W) || M.length !== H || !M.every((r) => r.length === W)) return ['R1 rows of different widths'];
  const edge = (c: string) => WALLS.has(c) || DOORS.has(c);
  for (let x = 0; x < W; x++) if (!edge(R[0][x]) || !edge(R[H - 1][x])) { out.push('R1 open frame'); break; }
  for (let y = 0; y < H; y++) if ((R[y][0] !== '#' && !DOORS.has(R[y][0])) || (R[y][W - 1] !== '#' && !DOORS.has(R[y][W - 1]))) { out.push('R1 open frame'); break; }
  // R2: windows mid-bay, inner walls meet the facades at the piers
  for (const y of [0, H - 1]) for (let x = 0; x < W; x++) {
    const m = x % 4, iy = y === 0 ? 1 : H - 2;
    if (R[y][x] === 'W' && m !== 1 && m !== 2) out.push(`R2 window off the bay at x${x}`);
    if (R[iy][x] === '+' && (m === 1 || m === 2) && x > 0 && x < W - 1) out.push(`R2 wall against a window at x${x}`);
  }
  // R3: rooms are rectangles
  const comps: Comp[] = [], seen = new Set<number>();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ROOM_KINDS[R[y][x]] && !seen.has(y * W + x)) {
    const c = component(R, x, y);
    c.cells.forEach(([a, b]) => seen.add(b * W + a));
    comps.push(c);
    if (c.cells.length !== (c.x1 - c.x0 + 1) * (c.y1 - c.y0 + 1)) out.push(`R3 ${ROOM_KINDS[c.ch]} not a rectangle`);
  }
  // R4: from the stairs and street doors, every room and every free cell is reached
  const free = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && !WALLS.has(R[y][x]) && (DOORS.has(R[y][x]) || M[y][x] === '.');
  const reach = new Set<number>(), q: [number, number][] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (R[y][x] === 'S' || R[y][x] === 'R') { reach.add(y * W + x); q.push([x, y]); }
  while (q.length) {
    const [x, y] = q.pop()!;
    for (const [dx, dy] of N4) {
      const nx = x + dx, ny = y + dy;
      if (!free(nx, ny) || reach.has(ny * W + nx)) continue;
      reach.add(ny * W + nx); q.push([nx, ny]);
    }
  }
  for (const c of comps) if (!c.cells.some(([x, y]) => reach.has(y * W + x))) out.push(`R4 ${ROOM_KINDS[c.ch]} unreachable`);
  let shut = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (free(x, y) && !reach.has(y * W + x)) shut++;
  if (shut) out.push(`R4 ${shut} floor cells shut in by furniture`);
  // R5: both sides of each door are floor, clear of furniture
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (DOORS.has(R[y][x])) {
    const horiz = !!R[y][x - 1] && (DOORS.has(R[y][x - 1]) || DOORS.has(R[y][x + 1])) && !(R[y - 1] && DOORS.has(R[y - 1][x]));
    const sides = horiz ? [[x, y - 1], [x, y + 1]] : [[x - 1, y], [x + 1, y]];
    for (const [a, b] of sides) {
      if (b < 0 || b >= H || a < 0 || a >= W) continue;
      if (WALLS.has(R[b][a])) out.push(`R5 door at (${x},${y}) against a wall`);
      else if (M[b][a] !== '.') out.push(`R5 door at (${x},${y}) blocked`);
    }
  }
  // R6: bedrooms have a window; a bathroom never opens into a kitchen
  for (const c of comps) if (c.ch === 'b' && !c.cells.some(([x, y]) => N4.some(([dx, dy]) => R[y + dy]?.[x + dx] === 'W'))) out.push('R6 bedroom without a window');
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (R[y][x] === 'D') {
    const n = [R[y - 1][x], R[y + 1][x], R[y][x - 1], R[y][x + 1]];
    if (n.includes('h') && n.includes('k')) out.push('R6 bathroom opening into the kitchen');
  }
  // R7: tall pieces never right inside a window
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (R[y][x] === 'W') for (const [dx, dy] of N4) {
    const f = M[y + dy]?.[x + dx];
    if (f && FURN[f]?.tall) out.push(`R7 tall piece at a window (${x + dx},${y + dy})`);
  }
  // R8: every piece with a posto touches a reached cell (or its chair does)
  const done = new Set<number>();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const f = M[y][x];
    if (!FURN[f]?.posto || FURN[f].posto === 'sit' || done.has(y * W + x)) continue;
    const c = component(M, x, y);
    c.cells.forEach(([a, b]) => done.add(b * W + a));
    const ok = c.cells.some(([a, b]) => N4.some(([dx, dy]) => {
      const nx = a + dx, ny = b + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) return false;
      if (M[ny][nx] === 'h') return N4.some(([ex, ey]) => reach.has((ny + ey) * W + nx + ex));
      return reach.has(ny * W + nx);
    }));
    if (!ok) out.push(`R8 ${f} at (${x},${y}) has no posto`);
  }
  // R12 (playtest of 2026-10-08): a home is entered through its own door E, never straight from the stair or a hall
  // through a plain doorway, and the E opens on an entry, the living room or the studio (not the kitchen, a bathroom
  // or a bedroom)
  // (a bathroom off a hall is an office's or a motel's shared one)
  const COMMON = '.cS', HOMES = 'lkbse';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (R[y][x] === 'E') for (const [dx, dy] of N4) {
    const a = R[y + dy]?.[x + dx], b = R[y - dy]?.[x - dx];
    if (a && b && COMMON.includes(b) && 'khb'.includes(a)) out.push(`R12 entry door at (${x},${y}) opens on the ${ROOM_KINDS[a]}`);
  }
  const common = new Set<number>(), cq: [number, number][] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (COMMON.includes(R[y][x])) { common.add(y * W + x); cq.push([x, y]); }
  while (cq.length) {
    const [x, y] = cq.pop()!;
    for (const [dx, dy] of N4) {
      const nx = x + dx, ny = y + dy, c = R[ny]?.[nx];
      if (!c || common.has(ny * W + nx) || !(c === 'D' || COMMON.includes(c) || HOMES.includes(c))) continue;
      if (HOMES.includes(c)) { out.push(`R12 the ${ROOM_KINDS[c]} at (${nx},${ny}) opens on the common parts without an entry door`); return out; }
      common.add(ny * W + nx); cq.push([nx, ny]);
    }
  }
  return out;
}

/** R9: the stair stands on the same cells on every floor of a building, up to the roof. */
export function checkBuilding(B: BuildingStack, floors: Floor[] = FLOORS): string[] {
  const cells = (F: Floor) => F.rooms.flatMap((r, y) => [...r].map((c, x) => (c === 'S' ? `${x},${y}` : ''))).filter(Boolean).join(' ');
  const fl0 = B.floors.map((id) => floors.find((F) => F.id === id)!), out: string[] = [];
  for (const d of fl0[0].depths ?? [0]) {
    const fl = fl0.map((F) => (d ? grow(F, d) : F)), base = cells(fl[0]);
    for (const F of fl) if (cells(F) !== base) out.push(`R9 ${B.name}: the stair moves on ${F.id}${d ? ` (${d} m)` : ''}`);
    const r11 = checkU(fl);
    if (r11) out.push(`R11 ${B.name}${d ? ` (${d} m)` : ''}: ${r11}`);
  }
  return out;
}

/**
 * R11: the U stair fits (2026-10-08): the S rectangle is at least 4.25 m long (a landing, a flight's 2.25 m run, the
 * 1 m half landing), and on every floor the ways into it open on the landing, all at the same end.
 */
function checkU(fl: Floor[]): string {
  const R0 = fl[0].rooms;
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  R0.forEach((r, y) => [...r].forEach((c, x) => { if (c === 'S') { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }));
  if (x1 < 0) return '';
  const along = x1 - x0 >= y1 - y0, n = (along ? x1 - x0 : y1 - y0) + 1, land = n - 6.5;
  if (land < 2) return `the stair is ${n / 2} m long; a U needs 4.25`;
  // each way in, as its distance (characters) from the low end and from the high end
  const at: number[] = [];
  for (const F of fl) {
    const R = F.rooms, way = (x: number, y: number) => { const c = R[y]?.[x]; return !!c && c !== 'S' && c !== 'x' && /[a-z.DER]/.test(c); };
    for (let x = x0; x <= x1; x++) for (const y of [y0 - 1, y1 + 1]) if (way(x, y)) at.push(along ? x - x0 : y < y0 ? -1 : n);
    for (let y = y0; y <= y1; y++) for (const x of [x0 - 1, x1 + 1]) if (way(x, y)) at.push(along ? (x < x0 ? -1 : n) : y - y0);
  }
  if (at.every((a) => a < land) || at.every((a) => n - 1 - a < land)) return '';
  return `the ways into the stair (${[...new Set(at)].join(', ')}) are not all on one landing (${land / 2} m at one end)`;
}

/** The rules on one room arrangement inside its frame: doors clear, tall pieces off the windows, open sides mostly free, every floor cell reached, chairs at a table, every posto reachable. */
export function checkArrangement(A: Arrangement): string[] {
  const fr = A.frame, W = fr[0].length - 2, D = fr.length - 2, g = A.rows, out: string[] = [];
  if (g.length !== D || g.some((r) => r.length !== W)) return [`size: ${g.length} rows, want ${D} of ${W}`];
  const fc = (x: number, y: number) => fr[y + 1][x + 1];
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < D;
  const entries: [number, number][] = [], open: [number, number][] = [];
  for (let y = 0; y < D; y++) for (let x = 0; x < W; x++) {
    if (g[y][x] !== '.' && !FURN[g[y][x]]) out.push(`unknown letter ${g[y][x]}`);
    for (const [dx, dy] of N4) {
      const c = fc(x + dx, y + dy);
      if (c === 'D') { if (g[y][x] !== '.') out.push(`door blocked at (${x},${y})`); entries.push([x, y]); }
      if (c === 'o') { entries.push([x, y]); open.push([x, y]); }
      if (c === 'W' && FURN[g[y][x]]?.tall) out.push(`tall piece at a window (${x},${y})`);
    }
  }
  if (open.length && open.filter(([x, y]) => g[y][x] === '.').length < open.length / 2) out.push('open side blocked');
  const key = (x: number, y: number) => y * W + x, seen = new Set<number>(), q: [number, number][] = [];
  for (const [x, y] of entries) if (g[y][x] === '.' && !seen.has(key(x, y))) { seen.add(key(x, y)); q.push([x, y]); }
  while (q.length) {
    const [x, y] = q.pop()!;
    for (const [dx, dy] of N4) {
      const nx = x + dx, ny = y + dy;
      if (inside(nx, ny) && !seen.has(key(nx, ny)) && g[ny][nx] === '.') { seen.add(key(nx, ny)); q.push([nx, ny]); }
    }
  }
  let shut = 0;
  for (let y = 0; y < D; y++) for (let x = 0; x < W; x++) if (g[y][x] === '.' && !seen.has(key(x, y))) shut++;
  if (shut) out.push(`${shut} floor cells shut in`);
  const near = (x: number, y: number, p: (a: number, b: number) => boolean) => N4.some(([dx, dy]) => inside(x + dx, y + dy) && p(x + dx, y + dy));
  const done = new Set<number>();
  for (let y = 0; y < D; y++) for (let x = 0; x < W; x++) {
    const c = g[y][x];
    if (c === 'h' && !near(x, y, (a, b) => g[b][a] === 't' || g[b][a] === 'Q')) out.push(`chair without a table at (${x},${y})`);
    if (!FURN[c]?.posto || c === 'h' || done.has(key(x, y))) continue;
    const comp = component(g, x, y);
    comp.cells.forEach(([a, b]) => done.add(key(a, b)));
    if (comp.cells.length !== (comp.x1 - comp.x0 + 1) * (comp.y1 - comp.y0 + 1)) out.push(`${c} not a rectangle`);
    const ok = comp.cells.some(([a, b]) => near(a, b, (u, v) => seen.has(key(u, v)) || (g[v][u] === 'h' && near(u, v, (s, t) => seen.has(key(s, t))))));
    if (!ok) out.push(`${c} at (${x},${y}) has no posto`);
  }
  return out;
}
