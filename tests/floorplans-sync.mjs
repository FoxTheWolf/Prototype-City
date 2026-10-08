// The interiors manual is where floors and arrangements are drawn; this copies them into src/sim/floorplans.json:
//   node tests/floorplans-sync.mjs && npx rolldown tests/floorplans.ts --format esm --platform node -o tests/.out/floorplans.mjs && node tests/.out/floorplans.mjs
import fs from 'node:fs';

const s = fs.readFileSync('docs/identidade/interiores-manual.html', 'utf8');
/** The array a `const NAME = [...];` of the manual's script holds. */
const grab = (name) => {
  const k = `const ${name} = `, i = s.indexOf(k), m = /;\r?\n/g;
  m.lastIndex = i;
  return new Function('return ' + s.slice(i + k.length, m.exec(s).index))();
};
const floors = grab('FLOORS').map((f) => ({ id: f.id, rooms: f.rooms, furn: f.furn, ...(f.rep ? { rep: f.rep, depths: f.depths } : {}) }));
const out = { floors, arrangements: grab('ROOMLIB'), buildings: grab('BUILDINGS') };
fs.writeFileSync('src/sim/floorplans.json', JSON.stringify(out, null, 1));
console.log(`${floors.length} floors, ${out.arrangements.length} arrangements, ${out.buildings.length} building stacks`);
