/**
 * Save migration for the notebook's disk (fix for "lodestar is not a command"):
 *   npx rolldown tests/laptop-migrate.ts --format esm --platform node -o tests/.out/laptop-migrate.mjs && node tests/.out/laptop-migrate.mjs [seed]
 * A fresh disk has the browser (lodestar) as a runnable binary. A disk saved before 15.1 lacks it;
 * syncPrograms adds back only the missing system binaries, leaving the owner's files alone.
 */
import { Computer, playerLaptop } from '../src/sim/computer';
import { install, syncPrograms } from '../src/laptop/shell';

const seed = Number(process.argv[2] ?? 42);
let fails = 0;
const fail = (m: string) => { if (++fails <= 20) console.log('FAIL ' + m); };

const pc = new Computer(playerLaptop(seed));
install(pc, 1_200_000_000);
if (pc.get('/usr/bin/lodestar')?.exec !== 'lodestar') fail('a fresh disk has lodestar as a runnable program');

// simulate an old save: drop the lodestar binary, add a user file that must survive
const [dir] = pc.parent('/usr/bin/lodestar');
dir!.kids!.delete('lodestar');
pc.put('/home/' + pc.hw.user + '/notes.txt', 'keep me\n', pc.hw.user, 1_200_000_000);
if (pc.get('/usr/bin/lodestar')) fail('the old-save simulation did remove lodestar');

syncPrograms(pc, 1_200_000_000);
if (pc.get('/usr/bin/lodestar')?.exec !== 'lodestar') fail('syncPrograms added lodestar back');
if (pc.get('/home/' + pc.hw.user + '/notes.txt')?.data !== 'keep me\n') fail('syncPrograms left the owner file alone');

// idempotent: running it on a complete disk changes nothing it would overwrite
const before = pc.get('/bin/ls');
syncPrograms(pc, 1_300_000_000);
if (pc.get('/bin/ls') !== before) fail('syncPrograms replaced a program that was already there');

console.log(fails ? `${fails} failure(s)` : 'OK — fresh disk has lodestar; old saves get it back; user files and present binaries untouched');
process.exit(fails ? 1 : 0);
