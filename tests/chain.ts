/**
 * [HACKING] Shell command chaining (15.7e), the splitter in Node:
 *   npx rolldown tests/chain.ts --format esm --platform node -o tests/.out/chain.mjs && node tests/.out/chain.mjs
 * && / || / ; split outside quotes; an operator inside a quoted ESSID is left in the command.
 */
import { splitChain } from '../src/laptop/shell';

let fails = 0;
const fail = (m: string) => { if (++fails <= 20) console.log('FAIL ' + m); };
const eq = (got: unknown, want: unknown, m: string) => { if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${m}: got ${JSON.stringify(got)}`); };

eq(splitChain('ls'), [{ op: '', cmd: 'ls' }], 'a single command');
eq(splitChain('iwconfig wlan0 essid "X" && dhclient'),
  [{ op: '', cmd: 'iwconfig wlan0 essid "X"' }, { op: '&&', cmd: 'dhclient' }], '&& splits (the reported bug)');
eq(splitChain('a ; b ; c'), [{ op: '', cmd: 'a' }, { op: ';', cmd: 'b' }, { op: ';', cmd: 'c' }], '; splits');
eq(splitChain('bruter x || tdump'), [{ op: '', cmd: 'bruter x' }, { op: '||', cmd: 'tdump' }], '|| splits');
// an && inside a quoted ESSID must stay in the command, not split it
eq(splitChain('iwconfig wlan0 essid "A && B"'), [{ op: '', cmd: 'iwconfig wlan0 essid "A && B"' }], 'operator inside quotes is literal');
eq(splitChain("echo 'a;b' && ls"), [{ op: '', cmd: "echo 'a;b'" }, { op: '&&', cmd: 'ls' }], '; inside single quotes is literal');

console.log(fails ? `${fails} failure(s)` : 'OK — && / || / ; split outside quotes, literal inside them');
process.exit(fails ? 1 : 0);
