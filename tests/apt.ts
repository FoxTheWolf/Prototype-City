/**
 * [HACKING] apt: the well-known tools are not preinstalled, they are fetched. Node, fs level:
 *   npx rolldown tests/apt.ts --format esm --platform node -o tests/.out/apt.mjs && node tests/.out/apt.mjs [seed]
 * A fresh disk has none of the catalog tools nor them in ~/bin; aptInstall puts a runnable binary;
 * an unknown package is refused; apt and apt-get themselves are preinstalled.
 */
import { Computer, playerLaptop } from '../src/sim/computer';
import { install, aptInstall } from '../src/laptop/shell';
import { DEBUG } from '../src/debug';

const seed = Number(process.argv[2] ?? 42);
let fails = 0;
const fail = (m: string) => { if (++fails <= 20) console.log('FAIL ' + m); };

const pc = new Computer(playerLaptop(seed));
install(pc, 1_200_000_000);
const u = pc.hw.user;

// the catalog tools are not there from the start, in either place
for (const n of ['mmap', 'tdump', 'tnet', 'mbus']) {
  if (pc.get(`/usr/bin/${n}`) || pc.get(`/home/${u}/bin/${n}`)) fail(`${n} should not be preinstalled`);
}
// apt itself is preinstalled, and so is bruter (interim) in ~/bin
if (pc.get('/usr/bin/apt')?.exec !== 'apt' || pc.get('/usr/bin/apt-get')?.exec !== 'apt-get') fail('apt/apt-get are preinstalled');
if (pc.get(`/home/${u}/bin/bruter`)?.exec !== 'bruter') fail('bruter is still in ~/bin for now');

// installing puts a runnable binary that resolves on the PATH (/usr/bin)
if (!aptInstall(pc, 'mmap', 1_200_000_100)) fail('aptInstall mmap returned true');
const f = pc.get('/usr/bin/mmap');
if (f?.exec !== 'mmap') fail('installed mmap is a runnable binary');
if (!f?.size) fail('installed mmap has a size on disk');

// an unknown package is refused
if (aptInstall(pc, 'nmap', 1_200_000_100)) fail('aptInstall refuses an unknown package');
// the clandestine tools (bruter, wcrack) are in the catalog only as a DEBUG aid (DEBUG.aptClandestine);
// their real source will be the forum (15.8c). With the flag on, aptInstall knows them.
if (DEBUG.aptClandestine) {
  if (!aptInstall(pc, 'bruter', 1_200_000_100)) fail('with aptClandestine, bruter is fetchable via apt');
  if (!aptInstall(pc, 'wcrack', 1_200_000_101)) fail('with aptClandestine, wcrack is fetchable via apt');
} else {
  if (aptInstall(pc, 'bruter', 1_200_000_100)) fail('without the debug flag, bruter is forum-only (not in apt)');
}

console.log(fails ? `${fails} failure(s)` : 'OK — catalog tools come via apt, apt/bruter preinstalled, unknown refused, clandestine tools in apt per debug flag');
process.exit(fails ? 1 : 0);
