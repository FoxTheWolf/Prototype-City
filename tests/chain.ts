/**
 * [HACKING] Shell command chaining (15.7e), the splitter in Node:
 *   npx rolldown tests/chain.ts --format esm --platform node -o tests/.out/chain.mjs && node tests/.out/chain.mjs
 * && / || / ; split outside quotes; an operator inside a quoted ESSID is left in the command.
 */
import { splitChain, cmdSegmentStart, argTemplate } from '../src/laptop/shell';

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

// cmdSegmentStart: where the current command segment begins (Tab completion after a chain operator, 15.7e)
eq(cmdSegmentStart('dhcl'), 0, 'no operator: segment starts at 0');
eq(cmdSegmentStart('iwconfig wlan0 essid "X" && dhcl'), 27, 'after && the segment is the command word');
eq(cmdSegmentStart('a ; b ; c'), 7, 'after the last ; ');
eq(cmdSegmentStart('iwconfig essid "A && B" && dh'), 26, '&& inside quotes does not start a segment');

// argTemplate: Tab scaffolds a command's arguments (15.7e-d). The caret lands where the next field goes.
const ti = argTemplate('iwconfig', 'Cafe')!;
eq(ti.text, 'iwconfig wlan0 essid "Cafe" key ', 'iwconfig scaffolds with the ESSID and a key field');
eq(ti.caret, ti.text.length, 'caret after "key " to type/click the key');
const ti0 = argTemplate('iwconfig', '')!;
eq(ti0.text, 'iwconfig wlan0 essid ""', 'iwconfig with no ESSID in range');
eq(ti0.text[ti0.caret], '"', 'caret sits between the empty quotes');
const td = argTemplate('tdump', 'GRIDLINK-03')!;
eq(td.text, 'tdump mon "GRIDLINK-03" -w capture.ivs', 'tdump scaffolds monitor capture');
eq(argTemplate('wcrack', '')!.text, 'wcrack capture.ivs', 'wcrack scaffolds the capture file');
eq(argTemplate('ls', ''), null, 'a command with no shaped template gets none');

console.log(fails ? `${fails} failure(s)` : 'OK — split; cmdSegmentStart; argTemplate scaffolds');
process.exit(fails ? 1 : 0);
