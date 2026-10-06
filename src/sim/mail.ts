/**
 * The player's e-mail (15.4): the accounts made on the city's webmail (web/webmail.ts), each bound
 * to the phone number it was confirmed by (the player is their number: a new SIM and the code to get
 * back in goes to the old one). What is kept is only what the player did and what was sent to them
 * from outside: the spam, the newsletters and the bank's statements are made again from the seed
 * and the simulation (the bank's ledger) each time the box is looked at, so they need no tick.
 */
/** A letter in a box: its id (stable, so the read and deleted marks hold), when, from, the subject and its paragraphs. */
export interface Letter { id: string; at: number; from: string; name: string; subject: string; body: string[] }

export interface MailAccount {
  user: string;
  pass: string;
  /** The line the account was confirmed by (a local number, as telco.player.number). */
  num: string;
  /** Game time it was made. */
  made: number;
  read: Set<string>;
  gone: Set<string>;
  /** Letters sent in by the game's systems (deliverMail), oldest first. */
  extra: Letter[];
}

export interface Mail {
  accounts: MailAccount[];
  /** A sign-up or a password reset waiting for the code texted to its number. */
  pending: { user: string; pass: string; num: string; code: string; reset: boolean } | null;
  /** Who is signed in on the notebook (the site's cookie). */
  session: string | null;
  /** Texts the provider sent to the player's line, for the phone to take. */
  sms: { from: string; text: string }[];
}

export const newMail = (): Mail => ({ accounts: [], pending: null, session: null, sms: [] });

/** The account named `user`, if there is one. */
export const accountOf = (M: Mail, user: string | null) => M.accounts.find((a) => a.user === user);

/**
 * A letter into a box (the oldest account when `to` is null): the channel the game's systems write
 * by (the fixer's long contracts later). False when there is no such account.
 */
export function deliverMail(M: Mail, to: string | null, at: number, from: string, name: string, subject: string, body: string[]): boolean {
  const A = to ? accountOf(M, to) : M.accounts[0];
  if (!A) return false;
  A.extra.push({ id: `x${A.extra.length}`, at, from, name, subject, body });
  return true;
}
