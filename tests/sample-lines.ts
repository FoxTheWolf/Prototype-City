/**
 * A sample of the dialogue's lines for the user to read (14.9): each key of the replies, the balloons
 * and the texts, said by a random citizen in their voice (age, family, hour), written to docs/amostra-falas.md.
 *   npx rolldown tests/sample-lines.ts --format esm --platform node -o tests/.out/sample.mjs && node tests/.out/sample.mjs [seed]
 */
import { writeFileSync } from 'node:fs';
import { createWorld } from '../src/sim/world';
import { expand, rngOf, tidy } from '../src/locale/gen';
import { TEXT } from '../src/locale/text';
import { lifeCtx, selFor, ageTag } from '../src/locale/voice';
import { citizenNames } from '../src/locale/names';
import REPLIES from '../src/locale/text/replies.en.json';
import BARKS from '../src/locale/text/barks.en.json';
import DIRS from '../src/locale/text/directions.en.json';

const w = createWorld(Number(process.argv[2] ?? 42)), P = w.pop, N = P.age.length;
const groups: [string, RegExp][] = [['Conversa (balcão e rua)', /^reply\.(?!sms|call)/], ['SMS e ligação', /^reply\.(sms|call)|^sms\.res$/], ['Balões na rua', /^bark\./], ['Pedir direção', /^dir\./]];
let out = '# Amostra de falas (14.9)\n\nGerada por `tests/sample-lines.ts` (semente 42). Cada linha: a fala, depois quem fala (nome, idade, se trabalha) e a chave. As falas variam pela pessoa e pela hora; marque o que soar errado, ruim ou fora do tom.\n';
let k = 0, total = 0;
for (const [title, re] of groups) {
  // only the dialogue's own pieces (the social posts' comments share the reply. prefix)
  const keys = [...Object.keys(REPLIES), ...Object.keys(BARKS), ...Object.keys(DIRS), 'sms.res'].filter((x) => re.test(x) && !x.startsWith('g.'));
  out += `\n## ${title}\n\n`;
  // about 14 per group, from different keys
  const step = Math.max(1, Math.floor(keys.length / 14));
  for (let j = 0; j < keys.length && total < 60; j += step) {
    const key = keys[j], i = Math.floor((Math.sin(++k * 12.9898) * 43758.5453 % 1 + 1) % 1 * N);
    if (P.age[i] < 14) { j -= step - 1; continue; }
    w.time = Math.floor(w.time / 86400) * 86400 + (8 + (k * 5) % 15) * 3600;
    const r = rngOf(i, k, 7), sel = selFor(P, i, w.time, w.weather.temp, w.weather.precip, w.weather.snow, k % 3 === 0 ? ['met'] : []);
    const s = tidy(expand(`#${key}#`, TEXT, r, { ...lifeCtx(w.city, P, i, r), what: 'Nguyen Pharmacy', when: 'yesterday', num: '(256) 838-2909', age: String(P.age[i]), time: '9:40', thing: 'coffee', number: '1.50', place: 'Golden Diner', biz: 'Sal Drugs', other: 'Dana', leg1: 'north two blocks to Kessler St', leg2: 'east one block', road: 'Marlow Ave', way: 'east', feet: '120' }, sel));
    out += `- “${s}” — ${citizenNames(w.city, P, i)[0]}, ${P.age[i]} (${ageTag(P.age[i])}${P.job[i] >= 0 ? ', trabalha' : ''}) · \`${key}\`\n`;
    total++;
  }
}
writeFileSync('docs/amostra-falas.md', out);
console.log(`${total} lines → docs/amostra-falas.md`);
