/**
 * [HACKING] apt: the well-known tools are not preinstalled, they are fetched. Node, fs level:
 *   npx rolldown tests/apt.ts --format esm --platform node -o tests/.out/apt.mjs && node tests/.out/apt.mjs [seed]
 * A fresh disk has none of the catalog tools nor them in ~/bin; aptInstall puts a runnable binary;
 * an unknown package is refused; apt and apt-get themselves are preinstalled.
 */
import { Computer, playerLaptop } from '../src/sim/computer';
import { install, aptInstall } from '../src/laptop/shell';

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

// an unknown package is refused, and bruter is NOT in the catalog (it comes from the forum)
if (aptInstall(pc, 'nmap', 1_200_000_100)) fail('aptInstall refuses an unknown package');
if (aptInstall(pc, 'bruter', 1_200_000_100)) fail('bruter is not in the apt catalog (forum-only)');

console.log(fails ? `${fails} failure(s)` : 'OK — catalog tools come via apt, apt/bruter preinstalled, unknown and bruter refused');
process.exit(fails ? 1 : 0);
