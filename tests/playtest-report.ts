/**
 * The playtest report (13.10p): reads one session's record (playtest/*.jsonl, written by src/playtest.ts)
 * and writes a summary next to it (<session>_report.md) for the user and Claude; nobody reads the raw lines.
 *   npx rolldown tests/playtest-report.ts --format esm --platform node -o tests/.out/playtest-report.mjs && node tests/.out/playtest-report.mjs [file.jsonl]
 * Without a file, the newest in playtest/. The city is made again from the record's seed for the route's map.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateCity } from '../src/sim/city';
import { CITY_SIZE } from '../src/sim/world';

type Rec = { k: string; rt: number; gt: number; [key: string]: any };

const arg = process.argv[2];
const file = arg ?? (() => {
  const dir = 'playtest', all = readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => join(dir, f));
  if (!all.length) { console.log('no record in playtest/'); process.exit(1); }
  return all.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
})();
const recs: Rec[] = readFileSync(file, 'utf8').split('\n').filter((l) => l.trim()).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
const start = recs.find((r) => r.k === 'start');
if (!start) { console.log(`${file}: no start record`); process.exit(1); }
const of = (k: string) => recs.filter((r) => r.k === k);
const pos = of('pos');

// ---- formats
const two = (n: number) => String(Math.floor(n)).padStart(2, '0');
const date = (gt: number) => { const d = new Date(Date.UTC(2008, 0, 1) + gt * 1000); return `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())}`; };
const clock = (gt: number) => { const d = new Date(Date.UTC(2008, 0, 1) + gt * 1000); return `${date(gt)} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`; };
const hm = (s: number) => `${Math.floor(s / 3600)}h${two((s % 3600) / 60)}`;
const mins = (s: number) => `${(s / 60).toFixed(1)} min`;
const usd = (c: number) => `${c < 0 ? '-' : ''}$${(Math.abs(c) / 100).toFixed(2)}`;
const where = (r: Rec) => (r.biz ? `${r.biz} (${r.kind})` : r.b >= 0 && r.b !== undefined ? `prédio ${r.b}` : 'rua');
const at = (r: Rec) => `${r.x?.toFixed?.(1) ?? '?'},${r.y?.toFixed?.(1) ?? '?'}`;

const out: string[] = [];
const say = (s = '') => out.push(s);

// ---- the session
const last = recs[recs.length - 1];
say(`# Relatório de playtest — ${file.replace(/^.*[\\/]/, '')}`);
say();
say(`- Semente **${start.seed}**, versão **${start.version}**; tela ${start.screen?.join(' x ')}.`);
say(`- Duração real: **${mins(last.rt)}**; no jogo, de ${clock(recs[0].gt)} a ${clock(last.gt)}.`);
const begin = of('begin')[0];
if (begin) say(`- Começou ${begin.continued ? 'continuando um save' : 'num jogo novo'}, com ${usd(begin.cash)} no bolso e ${usd(begin.bank)} no banco, em ${at(begin)}.`);
if (!pos.length) say('- Nenhuma amostra de posição (o jogador não entrou na cidade).');
say();

// ---- the time the walks eat: legs of movement between stops, and skipped time (sleep, T)
type Leg = { a: Rec; b: Rec; dist: number; game: number };
const legs: Leg[] = [];
let skipped = 0, gameMoving = 0, dist = 0, idleRun: Rec[] = [];
const idles: { a: Rec; b: Rec }[] = [];
let leg: Leg | null = null, still = 0;
for (let i = 1; i < pos.length; i++) {
  const P = pos[i - 1], Q = pos[i], dgt = Q.gt - P.gt, drt = Q.rt - P.rt, d = Math.hypot(Q.x - P.x, Q.y - P.y);
  // time moved faster than the clock's 30x: a skip (sleeping, T), not walking
  if (dgt > Math.max(120, drt * 30 * 3)) { skipped += dgt; leg = null; continue; }
  if (d > 0.4 && d < 30) {
    dist += d; gameMoving += dgt; still = 0;
    if (!leg) { leg = { a: P, b: Q, dist: 0, game: 0 }; legs.push(leg); }
    leg.b = Q; leg.dist += d; leg.game += dgt;
    if (idleRun.length > 1 && idleRun[idleRun.length - 1].rt - idleRun[0].rt >= 60) idles.push({ a: idleRun[0], b: idleRun[idleRun.length - 1] });
    idleRun = [];
  } else {
    // a pause of 20 s (real) or more ends the leg
    if (++still >= 20) leg = null;
    if (!Q.ui) idleRun.push(Q); else { if (idleRun.length > 1 && idleRun[idleRun.length - 1].rt - idleRun[0].rt >= 60) idles.push({ a: idleRun[0], b: idleRun[idleRun.length - 1] }); idleRun = []; }
  }
}
if (idleRun.length > 1 && idleRun[idleRun.length - 1].rt - idleRun[0].rt >= 60) idles.push({ a: idleRun[0], b: idleRun[idleRun.length - 1] });
const gameAll = pos.length > 1 ? pos[pos.length - 1].gt - pos[0].gt - skipped : 0;
const walks = legs.filter((l) => l.dist >= 30);
say('## Tempo de jogo nos deslocamentos');
say();
say(`- Andou **${(dist / 1000).toFixed(2)} km**, que comeram **${hm(gameMoving)}** de jogo (${gameAll > 0 ? Math.round((gameMoving / gameAll) * 100) : 0}% do tempo de jogo da sessão, sem contar ${hm(skipped)} pulados dormindo ou com T).`);
if (walks.length) {
  say(`- Média: ${(gameMoving / 60 / Math.max(dist / 1000, 1e-6)).toFixed(0)} min de jogo por km.`);
  say();
  say('| # | de | até | distância | real | jogo |');
  say('|---|---|---|---|---|---|');
  walks.forEach((l, i) => say(`| ${i + 1} | ${at(l.a)} | ${at(l.b)} | ${Math.round(l.dist)} m | ${mins(l.b.rt - l.a.rt)} | ${hm(l.game)} |`));
}
say();

// ---- the route's map: the city's buildings around the route, the route, and what happened on it
say('## Mapa do percurso');
say();
if (pos.length > 1) {
  const city = generateCity(start.seed, CITY_SIZE);
  const xs = pos.map((p) => p.x), ys = pos.map((p) => p.y), M = 60;
  const x0 = Math.max(0, Math.min(...xs) - M), x1 = Math.min(city.w, Math.max(...xs) + M), y0 = Math.max(0, Math.min(...ys) - M), y1 = Math.min(city.h, Math.max(...ys) + M);
  // a column is s metres wide and a row 2s tall (the glyphs are about twice as tall as wide)
  const s = Math.max(4, (x1 - x0) / 100, (y1 - y0) / 2 / 50), cols = Math.ceil((x1 - x0) / s), rows = Math.ceil((y1 - y0) / (2 * s));
  const map = Array.from({ length: rows }, () => Array<string>(cols).fill(' '));
  const put = (x: number, y: number, c: string) => { const i = Math.floor((x - x0) / s), j = Math.floor((y - y0) / (2 * s)); if (i >= 0 && j >= 0 && i < cols && j < rows) map[j][i] = c; };
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = x0 + (i + 0.5) * s, y = y0 + (j + 0.5) * 2 * s;
    if (city.buildings.some((B) => x >= B.x0 && x < B.x1 && y >= B.y0 && y < B.y1)) map[j][i] = ':';
  }
  for (const p of pos) put(p.x, p.y, '*');
  const legend: string[] = [];
  const places = of('place').filter((r) => r.b >= 0), named = new Map<number, string>();
  for (const r of places) if (!named.has(r.b)) {
    const c = '123456789ABDFGHJKLMOPQRTUVWYZ'[named.size] ?? '+';
    named.set(r.b, c); put(r.x, r.y, c); legend.push(`${c} ${where(r)}`);
  }
  of('stuck').forEach((r) => put(r.x, r.y, 'X'));
  of('note').forEach((r) => put(r.x, r.y, 'N'));
  put(pos[0].x, pos[0].y, 'S'); put(pos[pos.length - 1].x, pos[pos.length - 1].y, 'E');
  say(`Cada coluna tem ${s.toFixed(0)} m, cada linha ${(2 * s).toFixed(0)} m; o norte em cima. \`:\` prédio, \`*\` percurso, \`S\` começo, \`E\` fim, \`X\` travou, \`N\` nota; os números são os lugares em que entrou.`);
  say();
  say('```');
  const lines = map.map((l) => l.join('').replace(/\s+$/, ''));
  while (lines.length && !lines[0]) lines.shift();
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  for (const l of lines) say(l);
  say('```');
  if (legend.length) { say(); for (const l of legend) say(`- ${l}`); }
}
say();

// ---- notes, stuck, where the player stood still
say('## Notas (F8)');
say();
const notes = of('note');
if (!notes.length) say('Nenhuma nota.');
notes.forEach((r, i) => say(`${i + 1}. **${clock(r.gt)}**, ${where(r)}, POS ${at(r)}, andar ${r.floor}${r.img ? ` — captura \`${r.img}\`` : ''}\n   > ${String(r.text).replace(/\n/g, '\n   > ')}`));
say();
say('## Onde travou');
say();
const stuck = of('stuck');
say(stuck.length ? stuck.map((r) => `- ${clock(r.gt)}: POS ${at(r)}, andar ${r.floor}, ${where(r)} (andando sem sair do lugar)`).join('\n') : 'Nenhum lugar em que andou sem sair do lugar.');
say();
say('## Onde ficou parado (1 min real ou mais, sem nada nas mãos)');
say();
say(idles.length ? idles.map((I) => `- ${clock(I.a.gt)}: POS ${at(I.a)}, ${mins(I.b.rt - I.a.rt)}${I.a.in >= 0 ? `, dentro do prédio ${I.a.in}` : ''}`).join('\n') : 'Nenhum.');
const lastPos = pos[pos.length - 1];
if (lastPos) say(`\nTerminou em POS ${at(lastPos)}${lastPos.in >= 0 ? `, dentro do prédio ${lastPos.in} (andar ${lastPos.f})` : ', na rua'}, às ${clock(lastPos.gt)}.`);
say();

// ---- what had the hands
say('## Com o que passou o tempo (real)');
say();
const hands = new Map<string, number>();
for (let i = 1; i < pos.length; i++) { const k = pos[i - 1].ui || 'andando / olhando'; hands.set(k, (hands.get(k) ?? 0) + pos[i].rt - pos[i - 1].rt); }
for (const [k, v] of [...hands].sort((a, b) => b[1] - a[1])) say(`- ${k}: ${mins(v)}`);
say();

// ---- places
say('## Lugares');
say();
const stays = new Map<string, number>();
const pl = of('place');
pl.forEach((r, i) => { if (r.b >= 0) { const end = pl[i + 1]?.rt ?? last.rt; stays.set(where(r), (stays.get(where(r)) ?? 0) + end - r.rt); } });
say(stays.size ? [...stays].map(([k, v]) => `- ${k}: ${mins(v)}`).join('\n') : 'Não entrou em nenhum lugar.');
say();

// ---- the money, a game day at a time
say('## Economia');
say();
const days = new Map<string, { first: Rec; last: Rec; buy: number; inc: number }>();
for (const p of pos) {
  const k = date(p.gt), D = days.get(k);
  if (!D) days.set(k, { first: p, last: p, buy: 0, inc: 0 }); else D.last = p;
}
for (const r of of('buy')) { const D = days.get(date(r.gt)); if (D) D.buy += r.cents; }
// income: the bank's entries in (pay, transfers)
for (const r of of('bank')) { const D = days.get(date(r.gt)); if (D && r.cents > 0) D.inc += r.cents; }
if (days.size) {
  say('| dia do jogo | bolso + banco no começo | no fim | saldo do dia | compras | entradas no banco |');
  say('|---|---|---|---|---|---|');
  for (const [k, D] of days) {
    const w0 = D.first.cash + D.first.bank, w1 = D.last.cash + D.last.bank;
    say(`| ${k} | ${usd(w0)} | ${usd(w1)} | ${usd(w1 - w0)} | ${usd(D.buy)} | ${usd(D.inc)} |`);
  }
}
const buys = of('buy'), takes = of('take'), thefts = of('theft');
if (buys.length) { say(); say('Compras:'); for (const r of buys) say(`- ${clock(r.gt)}: ${r.good} por ${usd(r.cents)} em ${where(r)}`); }
const bank = of('bank');
if (bank.length) { say(); say('Banco:'); for (const r of bank) say(`- ${clock(r.gt)}: ${r.kind} ${usd(r.cents)}${r.biz ? ` (${r.biz})` : ''}, saldo ${usd(r.balance)}`); }
if (thefts.length) { say(); say(`Furtos: ${thefts.map((r) => `${clock(r.gt)} (${r.items} item/itens)`).join(', ')}.`); }
say(`\nPegou ${takes.length} coisa(s) das prateleiras e pagou ${buys.length}.`);
say();

// ---- the phone, the city, the player's state
say('## Celular');
say();
const smsIn = of('sms_in'), smsOut = of('sms_out'), calls = of('call');
say(`- ${smsIn.length} SMS recebido(s), ${smsOut.length} enviado(s), ${calls.length} ligação(ões).`);
for (const r of smsIn) say(`- ← ${clock(r.gt)} de ${r.from}: “${String(r.text).slice(0, 90)}${String(r.text).length > 90 ? '…' : ''}”`);
for (const r of smsOut) say(`- → ${clock(r.gt)} para ${r.to}: “${String(r.text).slice(0, 90)}”`);
for (const r of calls) say(`- ☎ ${clock(r.gt)} ${r.kind} ${r.number}`);
say();
say('## Diálogo');
say();
const sayRecs = of('say');
say(sayRecs.length ? sayRecs.map((r) => `- ${clock(r.gt)} ${r.who}: “${r.text}” → ${r.intent ?? 'NÃO ENTENDIDA'}${r.tone ? `, ${r.tone}` : ''}`).join('\n') : 'Nenhuma fala registrada (o diálogo da etapa 14 ainda não existe).');
say();
say('## A cidade em volta (eventos a menos de 300 m)');
say();
const near = of('event').filter((r) => r.d < 300), byKind = new Map<string, number>();
for (const r of near) byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1);
say(byKind.size ? [...byKind].map(([k, v]) => `- ${k}: ${v}`).join('\n') : 'Nenhum.');
say(`\n(${of('event').length} eventos na cidade inteira durante a sessão.)`);
say();
say('## Calor, fome');
say();
for (const r of of('heat')) say(`- ${clock(r.gt)}: calor no nível ${r.tier} (${r.points})`);
for (const r of of('bust')) say(`- ${clock(r.gt)}: **preso** (multa ${usd(r.fine)}, pagamento perdido ${usd(r.lostPay)})`);
for (const r of of('hunger')) say(`- ${clock(r.gt)}: fome no estágio ${r.stage}`);
say();

// ---- what stands out, for Claude's own reading to start from
say('## Pontos a olhar');
say();
const flags: string[] = [];
for (const l of walks) if (l.game > 2 * 3600) flags.push(`Um deslocamento de ${Math.round(l.dist)} m comeu ${hm(l.game)} de jogo (${at(l.a)} → ${at(l.b)}).`);
if (stuck.length) flags.push(`Travou ${stuck.length} vez(es) andando contra algo.`);
if (of('hunger').some((r) => r.stage >= 3)) flags.push('A fome chegou ao último estágio.');
if (gameAll > 0 && gameMoving / gameAll > 0.5) flags.push(`Mais da metade do tempo de jogo foi andando (${Math.round((gameMoving / gameAll) * 100)}%).`);
if (takes.length > buys.length + thefts.reduce((s, r) => s + r.items, 0)) flags.push('Pegou coisas que não pagou nem levou (devolveu ou largou).');
say(flags.length ? flags.map((f) => `- ${f}`).join('\n') : 'Nada fora do comum nos números.');

const report = file.replace(/\.jsonl$/, '_report.md');
writeFileSync(report, out.join('\n') + '\n');
console.log(report);
