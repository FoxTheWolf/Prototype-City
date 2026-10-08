// 15.18: the makers as families (docs/identidade/fabricantes-manual.html). Four phone makers whose index
// is the family, each family's model names in its format, the work brick as the player's notebook, the
// megacorp's coined name; every brand's name drawn in its dot font and its symbol in four variants.
// Picture: tests/.out/makers.png (the logos of four cities, on dark and on light).
import { writeFileSync } from 'node:fs';
import { coin, cctvMakerName, computerMakerName, makerName, operatorName, watchMakerName } from '../src/locale/names';
import { brandGlyphs, brandSymbol, brandVariant, Fam, FAMILIES, laptopFam, operatorFam, paintLogo, phoneFam } from '../src/render/brands';
import { Img, Paint } from '../src/render/paint2d';
import { LOOK_MAKER, LOOKS, MAKERS, lookPhone, phoneModel, playerPhone } from '../src/sim/device';
import { playerLaptop } from '../src/sim/computer';
import { type City } from '../src/sim/city';
import { png } from './png';

let bad = 0;
const check = (name: string, ok: boolean) => { if (!ok) { bad++; console.log('FAIL', name); } };

check('four makers', MAKERS === 4 && LOOK_MAKER.length === LOOKS);
check('each family has a body', [0, 1, 2, 3].every((m) => LOOK_MAKER.includes(m)));
const FORMAT = [/^\d{4}[ics]?$/, /^(Ledger|Courier|Quorum|Charter) \d{4}$/, /^(tempo|loop|glide|beat) \d{2}$/, /^(Field|Anvil|Trek|Brick) X\d$/];
for (const seed of [42, 7, 711445483]) {
  for (let m = 0; m < MAKERS; m++) for (let t = 0; t < 3; t++) {
    const d = phoneModel(seed, m, t);
    check(`seed ${seed} maker ${m} tier ${t}: "${d.model}" in its family's format`, FORMAT[m].test(d.model));
    check(`seed ${seed} maker ${m}: its look is its own`, LOOK_MAKER[d.look] === m);
  }
  check(`seed ${seed}: same seed, same model`, phoneModel(seed, 2, 1).model === phoneModel(seed, 2, 1).model);
  for (let l = 0; l < LOOKS; l++) check(`look ${l} is its maker's`, lookPhone(seed, l).maker === LOOK_MAKER[l] && lookPhone(seed, l).look === l);
  check("the player starts on the executive's Slate (the phone's manual; 2026-10-07)", playerPhone(seed).maker === 1);
  const L = playerLaptop(seed);
  check(`seed ${seed}: the notebook is the work brick, "${L.model}"`, L.maker === 0 && /^[TXR]\d{2,3}$/.test(L.model));
}

check('coin: Kessler', coin('Kessler', 0) === 'Kesion');
for (const r of ['Ulrich', 'Ashford', 'Easton', 'Orwell', 'Yardley', 'Irving']) for (let s = 0; s < 6; s++) {
  const c = coin(r, s);
  check(`coin ${r} ${s}: "${c}" 5-7 letters`, c.length >= 5 && c.length <= 7 && /^[A-Z][a-z]+$/.test(c));
}

const cities = [42, 7, 99, 711445483].map((nameSeed) => ({ nameSeed }) as unknown as City);
for (const C of cities) {
  const ops = [0, 1, 2].map((o) => operatorName(C, o)), makers = [0, 1, 2, 3].map((m) => makerName(C, m));
  check(`city ${C.nameSeed}: the megacorp is coined`, /^[A-Z][a-z]{4,6}$/.test(ops[0]) && !/ |Cell|Tel|Mobile/.test(ops[0]));
  check(`city ${C.nameSeed}: the prepaid ones keep a template`, ops.slice(1).every((o) => /Mobile|Wireless|Cell|Telecom|Tel/.test(o)));
  // the roots apart (a prepaid operator's root is its name less the template)
  const roots = [...ops.map((o) => o.replace(/ ?(Mobile|Wireless|Cell|Telecom|Tel)$/, '')), ...makers, computerMakerName(C, 0), computerMakerName(C, 1), watchMakerName(C)];
  check(`city ${C.nameSeed}: names apart (${roots.join(' ')})`, new Set(roots).size === roots.length);
  console.log(`city ${C.nameSeed}: phones ${makers.join(', ')} | notebooks ${computerMakerName(C, 0)}, ${computerMakerName(C, 1)} | operators ${ops.join(', ')}`);
}

// every name a brand can carry has its letters in its family's font
for (const C of cities) {
  const names: [number, string][] = [
    ...[0, 1, 2, 3].map((m): [number, string] => [phoneFam(m), makerName(C, m)]),
    ...[0, 1].map((m): [number, string] => [laptopFam(m), computerMakerName(C, m)]),
    ...[0, 1, 2].map((o): [number, string] => [operatorFam(o), operatorName(C, o)]),
    [Fam.Watch, watchMakerName(C)], ...[0, 1, 2].map((k): [number, string] => [Fam.Cctv, cctvMakerName(C, k)]),
  ];
  for (const [f, n] of names) check(`${FAMILIES[f].name} "${n}": every letter drawn`, brandGlyphs(f, n).every((g, i) => g || n[i] === ' '));
}
// the symbols: something in each, and the four variants apart
const same = (a: Uint8Array, b: Uint8Array) => a.every((v, i) => v === b[i]);
for (let f = 0; f < Fam.Cctv; f++) {
  const S = [0, 1, 2, 3].map((v) => brandSymbol(f, v));
  check(`${FAMILIES[f].name}: symbols drawn`, S.every((s) => s.some((v) => v)));
  check(`${FAMILIES[f].name}: four variants apart`, S.every((s, i) => S.every((t, j) => i === j || !same(s, t))));
}
check('cameras: three marks apart', !same(brandSymbol(Fam.Cctv, 0), brandSymbol(Fam.Cctv, 1)) && !same(brandSymbol(Fam.Cctv, 1), brandSymbol(Fam.Cctv, 2)));
check('variant 0..3 and stable', [0, 1, 2, 3, 4, 5, 6, 7, 8].every((f) => { const v = brandVariant(42, f); return v >= 0 && v < 4 && v === brandVariant(42, f); }));

// the picture: a column per city, each brand on dark and on light
const S = 2, ROW = 22 * S, COL = 300 * S, img = new Img(COL * cities.length, ROW * 11 * 2 + 10), P = new Paint(img);
cities.forEach((C, ci) => {
  const x = ci * COL;
  P.rect(x, 0, COL, ROW * 11, [12, 12, 14]);
  P.rect(x, ROW * 11, COL, ROW * 11 + 10, [238, 236, 230]);
  const list: [number, string, number][] = [
    ...[0, 1, 2, 3].map((m): [number, string, number] => [phoneFam(m), makerName(C, m), brandVariant(C.nameSeed, phoneFam(m))]),
    ...[0, 1].map((m): [number, string, number] => [laptopFam(m), computerMakerName(C, m), brandVariant(C.nameSeed, laptopFam(m))]),
    ...[0, 1, 2].map((o): [number, string, number] => [operatorFam(o), operatorName(C, o), brandVariant(C.nameSeed, operatorFam(o))]),
    [Fam.Watch, watchMakerName(C), brandVariant(C.nameSeed, Fam.Watch)], [Fam.Cctv, cctvMakerName(C, 0), 0],
  ];
  list.forEach(([f, n, v], i) => {
    paintLogo(P, x + 8, i * ROW + 3 * S, f, n, v, S, true);
    paintLogo(P, x + 8, ROW * 11 + 10 + i * ROW + 3 * S, f, n, v, S, false);
  });
});
writeFileSync('tests/.out/makers.png', png(img.px, img.w, img.h));
console.log(bad ? `${bad} failed` : 'makers: all passed (picture in tests/.out/makers.png)');
