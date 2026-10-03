import { hash3 } from '../core/rng';
import { type City } from './city';

/**
 * The player's bank account. The banks are the city's (city.banks: chains of branches, each a
 * business with a front on the street); the account was opened at the branch nearest where the
 * player starts, some weeks before the game begins, and its statement so far comes from the seed:
 * card payments at businesses that exist, cash from the chain's own branches, the monthly fee.
 * From here on every line is something that happened in the game (a top-up, a payment in).
 */
export type EntryKind = 'open' | 'cash' | 'atm' | 'card' | 'fee' | 'topup' | 'transfer';
/** A line of the statement: game time, what, cents (+ in, - out), and what it refers to (a business for card and atm). */
export interface Entry { at: number; kind: EntryKind; amount: number; ref: number }

export interface BankAccount {
  /** The bank (index into city.banks) and the branch where it was opened (a business). */
  bank: number;
  branch: number;
  /** The account number (10 digits). */
  number: string;
  /** Cents. */
  balance: number;
  /** Oldest first. */
  ledger: Entry[];
}

/** Days of history before the game starts, the opening deposit, and the monthly fee (cents). */
const DAY = 86400, HISTORY_DAYS = 40, OPENING = 60000, FEE = 500;

export function openAccount(seed: number, city: City, x: number, y: number, time: number): BankAccount {
  // the branch nearest the start
  let branch = city.banks[0].hq, bank = 0, bd = Infinity;
  city.banks.forEach((c, n) => c.branches.forEach((k) => {
    const B = city.buildings[city.businesses[k].building], d = Math.hypot((B.x0 + B.x1) / 2 - x, (B.y0 + B.y1) / 2 - y);
    if (d < bd) { bd = d; branch = k; bank = n; }
  }));
  const h = (a: number, b: number) => hash3(seed ^ 0xba4c, a, b);
  const number = Array.from({ length: 10 }, (_, i) => Math.floor(h(i, 0) * 10)).join('').replace(/^0/, '4');
  const A: BankAccount = { bank, branch, number, balance: 0, ledger: [] };
  const day0 = Math.floor(time / DAY) - HISTORY_DAYS;
  post(A, (day0 + 0.45) * DAY, 'open', OPENING, branch);
  // a few things a day, some days nothing: cards at the city's businesses, cash from the bank's machines
  const B = city.businesses, own = city.banks[bank].branches;
  for (let d = day0 + 1; d < day0 + HISTORY_DAYS; d++) {
    if (Math.floor(d / 30.44) !== Math.floor((d - 1) / 30.44)) post(A, (d + 0.01) * DAY, 'fee', -FEE, 0);
    for (let n = 0; n < 3; n++) {
      const r = h(d, n + 1);
      if (r < 0.45) continue;
      const at = (d + 0.35 + 0.6 * h(d, n + 11)) * DAY;
      if (r < 0.9 && B.length) {
        const k = Math.floor(h(d, n + 21) * B.length), cents = 250 + Math.floor(h(d, n + 31) * (B[k].kind === 'grocery' || B[k].kind === 'electronics' ? 6000 : 2200));
        post(A, at, 'card', -cents, k);
      } else post(A, at, 'atm', -2000 * (1 + Math.floor(h(d, n + 41) * 3)), own[Math.floor(h(d, n + 51) * own.length)]);
    }
    if (A.balance < 15000) post(A, (d + 0.5) * DAY, 'cash', 20000 + 5000 * Math.floor(h(d, 61) * 6), own[0]);
  }
  A.ledger.sort((a, b) => a.at - b.at);
  return A;
}

/** A line on the account: false (and nothing done) when money going out is more than there is. */
export function post(A: BankAccount, at: number, kind: EntryKind, amount: number, ref: number): boolean {
  if (amount < 0 && A.balance + amount < 0) return false;
  A.balance += amount;
  A.ledger.push({ at, kind, amount, ref });
  return true;
}
