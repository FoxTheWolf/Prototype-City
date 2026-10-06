/**
 * The webmail of the city's internet provider (15.4), at mail.<provider>.com: sign up with a name
 * and a password and a code texted to the player's line (the player is their number), sign in, read
 * the box, delete; a forgotten password is reset by a code texted to the number on the account, so a
 * player who threw that SIM away has lost the account. The box holds only what exists: the provider's
 * welcome, the spam of 2008, the newsletters of the shops the player paid at by card (the ledger) and,
 * on the first account, the bank's weekly statement with the real lines of the ledger; plus what the
 * game's systems deliver (sim/mail.ts). Letters are made from the seed when the box is looked at.
 */
import { hash3 } from '../core/rng';
import { calendar } from '../sim/clock';
import { accountOf, type Letter, type MailAccount } from '../sim/mail';
import { formatNumber } from '../sim/telco';
import { PLACES } from '../sim/placeTypes';
import { districtAt } from '../sim/city';
import { type World } from '../sim/world';
import { placeAt } from '../phone/places';
import { businessName, cityName, districtName, operatorName } from '../locale/names';
import { expand, rngOf, tidy } from '../locale/gen';
import { TEXT } from '../locale/text';
import en from '../locale/en.json';
import { type Block, type Page, type Theme } from './page';
import { addressOf, hh, money, slug, webOf } from './sites';

const DAY = 86400;
/** The mail's own colors: the provider's blue and yellow, a little lighter than its portal. */
const THEME: Theme = { page: [196, 210, 232], bg: [255, 255, 255], fg: [24, 24, 32], dim: [110, 116, 130], link: [0, 51, 153], head: [0, 51, 153], headFg: [255, 255, 255], bar: [255, 214, 60], barFg: [0, 30, 90] };
/** The short code the provider texts from. */
const SHORT = '24245';

/** The provider's name, its mail host and the domain of its addresses. */
export const provider = (w: World) => `${cityName(w.city)} Online`;
export const mailDomain = (w: World) => `${slug(cityName(w.city))}online.com`;
export const mailHost = (w: World) => `mail.${mailDomain(w)}`;

const say = (w: World, key: string, q: number, ctx: Record<string, string>) => tidy(expand(`#${key}#`, TEXT, rngOf(w.seed, 0x3a11, q), { provider: provider(w), host: mailHost(w), city: cityName(w.city), ...ctx }));
/** A letter's paragraphs from a grammar text ('|' between them). */
const paras = (s: string) => s.split('|').map((p) => p.trim()).filter(Boolean);
const uhash = (s: string) => [...s].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
const when = (t: number) => { const D = calendar(t), h = Math.floor(D.hour), m = Math.floor((D.hour - h) * 60); return `${D.month}/${D.day}/${String(D.year).slice(2)} ${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
const day = (t: number) => { const D = calendar(t); return `${D.month}/${D.day}`; };

/** Every letter in account A's box now, newest first. */
export function letters(w: World, A: MailAccount): Letter[] {
  const out: Letter[] = [], c = w.city, u = uhash(A.user), h = (a: number, b: number) => hash3(w.seed ^ u, a, b);
  const add = (L: Letter) => { if (L.at <= w.time && !A.gone.has(L.id)) out.push(L); };
  const ctx = { user: A.user, address: `${A.user}@${mailDomain(w)}`, num: formatNumber(w.telco, A.num) };
  add({ id: 'w', at: A.made, from: `welcome@${mailDomain(w)}`, name: `${provider(w)} Team`, subject: say(w, 'mail.welcome.subject', u, ctx), body: paras(say(w, 'mail.welcome.body', u, ctx)) });
  const d0 = Math.floor(A.made / DAY), d1 = Math.floor(w.time / DAY);
  // the bank sends its statements to the first address the player made (they gave it at the branch)
  if (w.mail.accounts[0] === A) {
    const Acc = w.bank, bank = businessName(c, c.banks[Acc.bank].hq), last4 = Acc.number.slice(-4), from = `statements@${slug(bank)}.com`;
    const bctx = { bank, last4, phone: formatNumber(w.telco, w.telco.bizNum[c.banks[Acc.bank].hq]) };
    add({ id: 'b', at: A.made + 900, from, name: bank, subject: say(w, 'mail.bank.hello.subject', 1, bctx), body: paras(say(w, 'mail.bank.hello.body', 1, bctx)) });
    const kinds = en.phone.apps.bank.kinds as Record<string, string>, op = operatorName(c, w.telco.player.op ?? 0);
    for (let d = d0 + 1; d <= d1; d++) {
      if ((d + 2) % 7 !== 1) continue; // Mondays (January 1st 2008 was a Tuesday)
      const L = Acc.ledger.filter((e) => e.at >= (d - 7) * DAY && e.at < d * DAY);
      const lines = L.map((e) => {
        const what = kinds[e.kind].replace('{biz}', e.kind === 'card' || e.kind === 'atm' ? businessName(c, e.ref) : '').replace('{op}', op);
        return `  ${day(e.at).padEnd(6)} ${what.slice(0, 30).padEnd(31)} ${(e.amount > 0 ? '+' : '') + money(e.amount)}`.replace('$-', '-$');
      });
      const bal = Acc.ledger.filter((e) => e.at < d * DAY).reduce((a, e) => a + e.amount, 0), wk = { ...bctx, week: day((d - 7) * DAY) };
      add({ id: `b${d}`, at: d * DAY + 6 * 3600 + h(d, 1) * 3600, from, name: bank, subject: say(w, 'mail.bank.stmt.subject', d, wk),
        body: [say(w, 'mail.bank.stmt.intro', d, wk), ...(lines.length ? lines : ['  No activity this week.']), `  ${'Balance'.padEnd(38)} ${money(bal)}`, ...paras(say(w, 'mail.bank.stmt.outro', d, wk))] });
    }
  }
  // the spam: none the first day, then up to three a day, more as the address gets around
  const SPAM = ['lottery', 'watches', 'home', 'loan', 'software', 'stock', 'diploma', 'money', 'chain'];
  for (let d = d0 + 1; d <= d1; d++) {
    const n = Math.floor(h(d, 2) * Math.min(4, 1.5 + (d - d0) * 0.25));
    for (let k = 0; k < n; k++) {
      const kind = SPAM[Math.floor(h(d, 10 + k) * SPAM.length)], q = d * 8 + k, sctx = { name: say(w, 'mail.spam.name', q, {}) };
      const name = say(w, `mail.spam.${kind}.from`, q, sctx);
      add({ id: `s${d}.${k}`, at: d * DAY + h(d, 20 + k) * DAY, from: `${slug(name).slice(0, 10) || 'info'}${Math.floor(h(d, 30 + k) * 900 + 100)}@${['hotmale.net', 'freemail.biz', 'win-now.info', 'mailz.ru'][Math.floor(h(d, 40 + k) * 4)]}`, name,
        subject: say(w, `mail.spam.${kind}.subject`, q, sctx), body: paras(say(w, `mail.spam.${kind}.body`, q, sctx)) });
    }
  }
  // the newsletters: the shops with a site the player paid at by card since the address was made
  const Wb = webOf(w), first = new Map<number, number>();
  for (const e of w.bank.ledger) if (e.kind === 'card' && e.at >= A.made && e.ref >= 0 && Wb.byBiz.has(e.ref) && !first.has(e.ref)) first.set(e.ref, e.at);
  for (const [k, t0] of first) {
    const b = c.businesses[k], biz = businessName(c, k), host = Wb.byBiz.get(k)!.replace(/^www\./, ''), [o, z] = PLACES[b.kind].hours;
    const nctx = { biz, district: districtName(c, districtAt(c, ...placeAt(c, k))), address: addressOf(w, k), hours: o === 0 && z === 24 ? 'all day and all night' : `${hh(o)} to ${hh(z)}` };
    const from = `news@${host}`, outro = say(w, 'mail.news.outro', k, nctx);
    add({ id: `n${k}`, at: t0 + 2 * 3600 + h(k, 3) * 3600, from, name: biz, subject: say(w, 'mail.news.first.subject', k, nctx), body: [say(w, 'mail.news.first.body', k, nctx), outro] });
    for (let n = 1; t0 + n * 7 * DAY <= w.time; n++) {
      const q = k * 64 + n, pctx = { ...nctx, promo: TEXT[`promo.${b.kind}`] ? say(w, `promo.${b.kind}`, q, {}) : 'Come see what is new this week!' };
      add({ id: `n${k}.${n}`, at: t0 + n * 7 * DAY + h(k, 10 + n) * 6 * 3600, from, name: biz, subject: say(w, 'mail.news.subject', q, pctx), body: [say(w, 'mail.news.body', q, pctx), outro] });
    }
  }
  for (const L of A.extra) add(L);
  return out.sort((a, b) => b.at - a.at);
}

/** The pages of the webmail; a page sent by a form brings its boxes in `form`. */
export function mailPage(w: World, host: string, path: string, form?: Map<string, string>): Page {
  const M = w.mail, prov = provider(w), f = (k: string) => (form?.get(k) ?? '').trim();
  const page = (p: string, title: string, body: Block[], action?: string): Page => ({
    url: `http://${host}${p}`, title: `${prov} Mail - ${title}`, theme: THEME, form: action ? `http://${host}${action}` : undefined, kb: 24 + body.length,
    blocks: [{ t: 'banner', text: `${prov} Mail`, sub: say(w, 'mail.tagline', 0, {}), art: [' ______ ', '|\\    /|', '| \\__/ |', '|______|'] }, ...body, { t: 'foot', text: `(c) 2008 ${prov} - Privacy Policy - Terms of Service` }],
  });
  const note = (s: string): Block[] => (s ? [{ t: 'p', text: `>> ${s}` }] : []);
  const signIn = (msg = '') => page('/', 'Sign In', [{ t: 'h', text: 'Sign in to your account' }, ...note(msg),
    { t: 'input', name: 'user', label: 'Username:', size: 20 }, { t: 'input', name: 'pass', label: 'Password:', secret: true, size: 20 }, { t: 'submit', label: 'Sign In' },
    { t: 'p', text: `New to ${prov} Mail? [Sign up for free](http://${host}/signup)` }, { t: 'p', text: `[Forgot your password?](http://${host}/forgot)` }], '/login');
  const signUp = (msg = '') => page('/signup', 'Sign Up', [{ t: 'h', text: 'Create your free account' }, ...note(msg),
    { t: 'p', text: `Choose a username (3 to 16 letters or numbers) and a password of at least 6 characters. Your address will be username@${mailDomain(w)}. To keep out spammers we will text a code to your mobile phone.` },
    { t: 'input', name: 'user', label: 'Username:', size: 16 }, { t: 'input', name: 'pass', label: 'Password:', secret: true, size: 20 }, { t: 'input', name: 'pass2', label: 'Retype password:', secret: true, size: 20 },
    { t: 'submit', label: 'Create Account' }, { t: 'p', text: `[Back to sign in](http://${host}/)` }], '/signup');
  const forgot = (msg = '') => page('/forgot', 'Reset Password', [{ t: 'h', text: 'Reset your password' }, ...note(msg),
    { t: 'p', text: 'Type your username and a new password. We will text a code to the mobile phone on your account.' },
    { t: 'input', name: 'user', label: 'Username:', size: 16 }, { t: 'input', name: 'pass', label: 'New password:', secret: true, size: 20 }, { t: 'input', name: 'pass2', label: 'Retype password:', secret: true, size: 20 },
    { t: 'submit', label: 'Send Code' }, { t: 'p', text: `[Back to sign in](http://${host}/)` }], '/forgot');
  const confirm = (msg = '') => page('/confirm', 'Enter Code', [{ t: 'h', text: 'Check your phone' }, ...note(msg),
    { t: 'p', text: `We sent a text message with a 6-digit code to the phone number ending in ${M.pending!.num.slice(-4)}. Type it below. It may take a minute to arrive.` },
    { t: 'input', name: 'code', label: 'Code:', size: 8 }, { t: 'submit', label: 'Confirm' }, { t: 'p', text: `[Start over](http://${host}/)` }], '/confirm');
  /** Ask for a code: the text goes to the number, and arrives only if that is the line in the phone now. */
  const sendCode = (user: string, pass: string, num: string, reset: boolean) => {
    const code = String(100000 + Math.floor(w.rng() * 900000));
    M.pending = { user, pass, num, code, reset };
    if (num === w.telco.player.number) M.sms.push({ from: SHORT, text: `${prov} Mail: your code is ${code}. Do not share it with anyone.` });
    return confirm();
  };
  const pwErr = (p: string, p2: string) => (p.length < 6 ? 'The password must have at least 6 characters.' : p !== p2 ? 'The passwords do not match.' : '');

  const A = accountOf(M, M.session);
  const inbox = (msg = '') => {
    const L = letters(w, A!), unread = L.filter((l) => !A!.read.has(l.id)).length;
    const rows = L.slice(0, 60).map((l) => [A!.read.has(l.id) ? ' ' : '*', l.name.slice(0, 24), `[${l.subject.slice(0, 56)}](http://${host}/read/${l.id})`, when(l.at)]);
    return page('/inbox', 'Inbox', [{ t: 'nav', links: [['Inbox', `http://${host}/inbox`], ['Sign Out', `http://${host}/logout`]] }, ...note(msg),
      { t: 'h', text: `Inbox (${unread} unread) - ${A!.user}@${mailDomain(w)}` },
      L.length ? { t: 'table', head: true, rows: [[' ', 'From', 'Subject', 'Date'], ...rows] } : { t: 'p', text: 'Your inbox is empty.' }]);
  };

  switch (path) {
    case '/login': {
      const B = accountOf(M, f('user').toLowerCase());
      if (!B || B.pass !== f('pass')) return signIn('The username or password you entered is incorrect.');
      M.session = B.user;
      return mailPage(w, host, '/inbox');
    }
    case '/logout': M.session = null; return signIn('You have signed out.');
    case '/signup': {
      if (!form) return signUp();
      const user = f('user').toLowerCase();
      if (!/^[a-z0-9]{3,16}$/.test(user)) return signUp('The username must be 3 to 16 letters or numbers.');
      if (accountOf(M, user) || ['admin', 'postmaster', 'support', 'welcome'].includes(user)) return signUp(`Sorry, ${user}@${mailDomain(w)} is already taken.`);
      const e = pwErr(form.get('pass') ?? '', form.get('pass2') ?? '');
      return e ? signUp(e) : sendCode(user, form.get('pass')!, w.telco.player.number, false);
    }
    case '/forgot': {
      if (!form) return forgot();
      const B = accountOf(M, f('user').toLowerCase());
      if (!B) return forgot('There is no account with that username.');
      const e = pwErr(form.get('pass') ?? '', form.get('pass2') ?? '');
      return e ? forgot(e) : sendCode(B.user, form.get('pass')!, B.num, true);
    }
    case '/confirm': {
      const P = M.pending;
      if (!P) return signIn();
      if (!form) return confirm();
      if (f('code') !== P.code) return confirm('That code is not right. Check the text message and try again.');
      M.pending = null;
      const B = accountOf(M, P.user);
      if (P.reset && B) B.pass = P.pass;
      else if (!B) M.accounts.push({ user: P.user, pass: P.pass, num: P.num, made: w.time, read: new Set(), gone: new Set(), extra: [] });
      M.session = P.user;
      return mailPage(w, host, '/inbox');
    }
  }
  if (!A) return signIn();
  const m = path.match(/^\/(read|delete)\/([a-z0-9.]+)$/);
  if (m) {
    const l = letters(w, A).find((x) => x.id === m[2]);
    if (!l) return inbox('That message is no longer there.');
    if (m[1] === 'delete') { A.gone.add(l.id); return inbox('The message was deleted.'); }
    A.read.add(l.id);
    return page(`/read/${l.id}`, l.subject, [{ t: 'nav', links: [['Inbox', `http://${host}/inbox`], ['Delete', `http://${host}/delete/${l.id}`], ['Sign Out', `http://${host}/logout`]] },
      { t: 'table', rows: [['From:', `${l.name} <${l.from}>`], ['To:', `${A.user}@${mailDomain(w)}`], ['Date:', when(l.at)], ['Subject:', l.subject]] },
      ...l.body.map((p): Block => (p.startsWith('  ') ? { t: 'art', lines: [p] } : { t: 'p', text: p })), { t: 'p', text: `[Back to Inbox](http://${host}/inbox)` }]);
  }
  return inbox();
}
