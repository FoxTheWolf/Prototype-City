/**
 * How big the world's shader gets once every call is inlined (13.S): the Windows compiler (FXC/DXC through Dawn)
 * copies a function's body into each call, so a big function called from several places, or from a function
 * that is itself copied, multiplies. Prints each function's own size, how many copies the inlining makes and
 * what they weigh, biggest first. Run:
 * npx rolldown tests/wgsl-inline.ts --format esm --platform node -o tests/.out/wgsl-inline.mjs && node tests/.out/wgsl-inline.mjs
 */
import { worldWGSL } from '../src/render/gpu/shader';

const w = worldWGSL();
// each module-scope fn: its name and body (a brace count from its first '{')
const fns = new Map<string, string>();
for (const m of w.matchAll(/^fn (\w+)\s*\(/gm)) {
  let i = w.indexOf('{', m.index!), d = 0, j = i;
  for (; j < w.length; j++) { if (w[j] === '{') d++; else if (w[j] === '}' && --d === 0) break; }
  fns.set(m[1], w.slice(i, j + 1));
}
// the body's size in tokens (comments out), and its calls to other fns
const size = new Map<string, number>(), calls = new Map<string, Map<string, number>>();
for (const [n, b] of fns) {
  const code = b.replace(/\/\/.*$/gm, '');
  size.set(n, (code.match(/[A-Za-z_]\w*|\d+\.?\d*|[^\s\w]/g) ?? []).length);
  const c = new Map<string, number>();
  for (const m of code.matchAll(/\b(\w+)\s*\(/g)) if (fns.has(m[1]) && m[1] !== n) c.set(m[1], (c.get(m[1]) ?? 0) + 1);
  calls.set(n, c);
}
// copies: main runs once; a fn is copied once per call in each copy of its caller
const copies = new Map<string, number>([['main', 1]]);
const order: string[] = [], seen = new Set<string>();
const visit = (n: string) => { if (seen.has(n)) return; seen.add(n); for (const c of calls.get(n)!.keys()) visit(c); order.push(n); };
visit('main');
order.reverse(); // callers before callees
for (const n of order) for (const [c, k] of calls.get(n)!) copies.set(c, (copies.get(c) ?? 0) + (copies.get(n) ?? 0) * k);
// inlined size: a fn's own tokens times its copies (its callees counted on their own)
const rows = order.map((n) => ({ n, own: size.get(n)!, copies: copies.get(n) ?? 0, total: size.get(n)! * (copies.get(n) ?? 0) }));
const all = rows.reduce((s, r) => s + r.total, 0), src = [...size.values()].reduce((a, b) => a + b, 0);
console.log(`${fns.size} fns, ${src} tokens written, ${all} tokens once inlined (x${(all / src).toFixed(1)})`);
rows.sort((a, b) => b.total - a.total);
for (const r of rows.slice(0, Number(process.argv[2] ?? 30))) {
  const by = [...calls.entries()].filter(([, c]) => c.has(r.n)).map(([p, c]) => `${p}${c.get(r.n)! > 1 ? `x${c.get(r.n)}` : ''}`).join(' ');
  console.log(`${String(r.total).padStart(8)} ${(100 * r.total / all).toFixed(1).padStart(5)}%  ${r.n.padEnd(16)} own ${String(r.own).padStart(5)}  copies ${String(r.copies).padStart(4)}  <- ${by}`);
}
