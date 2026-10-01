import { hash3 } from '../core/rng';
import en from '../locale/en.json';
import { formatNumber } from '../sim/telco';
import { type World } from '../sim/world';

/**
 * The operator's service menu, reached by dialing *100# (USSD, as prepaid lines of the time had
 * it): a text menu answered with a number. Balance, data bundles bought with the credit, top-up
 * cards (their codes are sold in shops; the economy, stage 13, will sell them), the line's number,
 * the data used. `path` is the answers so far; it returns the text to show, whether it waits for an
 * answer, and a text message to send after (confirmations come by SMS, as they did).
 */
const U = en.phone.ussd;
/** The bundles: KB, cents, days. */
export const BUNDLES: [number, number, number][] = [[5 * 1024, 300, 7], [20 * 1024, 1000, 30], [100 * 1024, 3000, 30]];

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const mb = (kb: number) => `${(kb / 1024).toFixed(2)} MB`;

/** The top-up cards that exist in this city: 12-digit codes worth $10 or $20 (index k). */
export function voucher(seed: number, k: number): { code: string; cents: number } {
  let code = '';
  for (let i = 0; i < 12; i++) code += Math.floor(hash3(seed, 0x70a1 + k, i) * 10);
  return { code, cents: k % 2 ? 2000 : 1000 };
}
const VOUCHERS = 40;

export function ussd(world: World, code: string, path: string[]): { text: string; menu: boolean; sms?: string } {
  if (code !== '*100#') return { text: U.unknown, menu: false };
  const A = world.telco.player;
  if (!path.length) return { text: U.root.join('\n'), menu: true };
  const [a, b] = path;
  switch (a) {
    case '1': return { text: U.balance.replace('{c}', money(A.credit)).replace('{d}', mb(A.dataKB)), menu: false };
    case '2': {
      if (b === undefined) return { text: [U.bundlesHead, ...BUNDLES.map(([kb, c, d], i) => `${i + 1} ${kb / 1024}MB ${money(c)} ${d}d`)].join('\n'), menu: true };
      const B = BUNDLES[+b - 1];
      if (!B) return { text: U.invalid, menu: false };
      if (A.credit < B[1]) return { text: U.noCredit.replace('{c}', money(A.credit)), menu: false };
      A.credit -= B[1]; A.dataKB += B[0];
      const done = U.bought.replace('{n}', `${B[0] / 1024}MB`).replace('{c}', money(A.credit));
      return { text: done, menu: false, sms: done };
    }
    case '3': {
      if (b === undefined) return { text: U.topupAsk, menu: true };
      for (let k = 0; k < VOUCHERS; k++) {
        const v = voucher(world.seed, k);
        if (v.code !== b) continue;
        if (world.telco.spent.has(b)) return { text: U.used, menu: false };
        world.telco.spent.add(b);
        A.credit += v.cents;
        const done = U.topped.replace('{v}', money(v.cents)).replace('{c}', money(A.credit));
        return { text: done, menu: false, sms: done };
      }
      return { text: U.badCode, menu: false };
    }
    case '4': return { text: U.number.replace('{n}', formatNumber(world.telco, A.number.replace('-', ''))), menu: false };
    case '5': return { text: U.usage.replace('{u}', mb(A.usedKB)).replace('{d}', mb(A.dataKB)), menu: false };
  }
  return { text: U.invalid, menu: false };
}

/** A top-up card not used yet, for the debug settings. */
export function freeVoucher(world: World): string {
  for (let k = 0; k < VOUCHERS; k++) { const v = voucher(world.seed, k); if (!world.telco.spent.has(v.code)) return v.code; }
  return '';
}
