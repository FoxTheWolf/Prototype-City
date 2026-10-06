// [HACKING] Trilha de hacking. NAO abrir fora de uma sessao com o Opus 4.8 (ver CLAUDE.md,
// "Estado atual" > "Arquivos de hacking"): sao os tutoriais do forum e os anuncios de trabalho
// anonimizados, que leem como pedido de ataque e acionam o classificador. Tudo 100% ficticio,
// nomes de programas inventados (mmap/bruter/tdump/tnet/mbus, como no shell), so dentro do jogo.
//
// O arcabouco do forum (as paginas, o roteamento, o quadro benigno "Lounge") esta em src/web/forum.ts,
// que e um arquivo NORMAL e so importa os dados daqui -- uma sessao normal nunca abre este modulo.
import { hash3 } from '../core/rng';
import { type World } from '../sim/world';
import { districtName, businessName } from './names';

/** A post in a thread: the handle who wrote it and the lines of the body. */
export interface ForumPost { by: string; body: string[] }
/** A thread on a board: a title, when it was last bumped (game-days ago), and its posts. */
export interface ForumThread { id: string; title: string; agoDays: number; posts: ForumPost[] }

/** A handle, built from the seed so the same board always shows the same names. Lower-case, no spaces:
 *  the board's own style (nobody uses their real name here -- you are your number, and here not even that). */
const ADJ = ['static', 'null', 'grey', 'quiet', 'dead', 'low', 'cold', 'half', 'spare', 'blind', 'patch', 'dark', 'off', 'faint'];
const NOUN = ['hum', 'jack', 'relay', 'fuse', 'ghost', 'wire', 'crow', 'moth', 'ping', 'drip', 'socket', 'ember', 'signal', 'latch'];
export function handle(seed: number, n: number): string {
  const h = (q: number) => hash3(seed ^ 0x4f0b, n, q);
  const a = ADJ[Math.floor(h(1) * ADJ.length)], b = NOUN[Math.floor(h(2) * NOUN.length)];
  const num = h(3) < 0.5 ? String(Math.floor(h(4) * 90) + 10) : '';
  return h(5) < 0.5 ? `${a}_${b}${num}` : `${a}${b}${num}`;
}

/**
 * The Guides board: the board's old sticky tutorials, written by regulars. They teach the real ideas
 * (ports, scans, services, passwords, logs, the grid) with the game's fictional program names, which
 * match the notebook's shell exactly: mmap (scan), bruter (guess a login), tdump (listen), tnet (log
 * in), mbus (talk to the controller), job (the contract you took). Clean, in-game, no real-world use.
 * Fixed text (a tutorial is a document, not a citizen's voice), so it does not go through the grammar.
 */
export const GUIDES: ForumThread[] = [
  {
    id: 'g1', title: 'READ FIRST: what this board is', agoDays: 41,
    posts: [
      { by: 'dead_relay', body: [
        'If someone passed you the address, welcome. Lurk a week before you post.',
        'Rules: no names, no faces, no real numbers in the clear. You are a handle here and nothing else.',
        'Work goes on the Contracts board. Questions go to Guides. Keep the Lounge for noise.',
        'Everything below is for the sandbox the regulars run -- our own boxes, our own grid. Nothing here touches anything real. Keep it that way.' ] },
      { by: 'quiet_fuse', body: ['Bookmark the four sticky guides. They answer 90% of what gets asked. Read them before you make a thread.'] },
    ],
  },
  {
    id: 'g2', title: 'STICKY: scan before you touch -- mmap', agoDays: 33,
    posts: [
      { by: 'grey_ghost', body: [
        'You never poke a box blind. You scan it first and read what answers.',
        'On the network: `mmap <ip>` lists the open ports. A port is a door; the number tells you what is behind it.',
        '  23  a login console -- this is the one you usually want',
        '  80  a web page the box serves',
        '  502 a controller (a relay, a cabinet, a breaker) that speaks the bus protocol',
        'No argument and mmap sweeps the whole subnet so you can see every box on it. Slow boxes answer slow; be patient.' ] },
      { by: 'static_hum', body: ['If mmap finds nothing, you are not actually on a network yet. Join one (the maintenance Wi-Fi, a cafe AP) and pull an address with dhclient first. Half the "mmap is broken" posts are this.'] },
      { by: 'low_crow', body: ['Write down every port. The box that looks boring on 23 is the one serving the cabinet on 502.'] },
    ],
  },
  {
    id: 'g3', title: 'STICKY: getting onto a console -- bruter & tnet', agoDays: 28,
    posts: [
      { by: 'grey_ghost', body: [
        'Found a box with 23 open? That is a login console. Two ways in.',
        '1) You know the login. `tnet <ip>`, type the user and the password, you are in.',
        '2) You do not. `bruter <ip> <login>` throws a wordlist at it. Old boxes keep the password that shipped on them; that is what the list is. It is loud and it is slow, so only when you have to.',
        'Once bruter finds it, go in the quiet way with tnet. Do not re-run bruter every time -- the box logs every miss.' ] },
      { by: 'blind_socket', body: ['Common logins to try as the <login>: admin, root, the maker\'s name on the sticker. The console banner usually tells you who made the box -- read it.'] },
      { by: 'cold_wire', body: ['Stuck at the login prompt with no idea? Ctrl+C or type exit to back out. You do not have to kill the whole terminal.'] },
      { by: 'grey_ghost', body: ['Rule of the house: every failed login is a line in a log somewhere. The quieter you are, the longer you last. See the logs guide.'] },
    ],
  },
  {
    id: 'g4', title: 'STICKY: logs, and why you listen first -- tdump', agoDays: 24,
    posts: [
      { by: 'static_hum', body: [
        'Two things people skip and then wonder why they got burned.',
        'First, listen. `tdump` sits on the Wi-Fi and prints the traffic going by. You will see who is talking to what, and sometimes a login goes past in the clear on a lazy box. Watch before you act.',
        'Second, you leave traces. Consoles keep a log of who logged in and when. The operator keeps its own records too -- which tower a line was on, at what hour. That last one is a whole kind of work by itself (see Contracts).' ] },
      { by: 'dead_relay', body: ['On the operator side: their maintenance box (the OMC) keeps the cell logs. If you can reach it, `tnet` in and `log <number>` reads where a line has been. Passive read, but do not kid yourself that passive means invisible.'] },
      { by: 'patch_moth', body: ['tdump on an open AP is free intel and costs you nothing. Do it at every new place for a minute before you do anything else.'] },
    ],
  },
  {
    id: 'g5', title: 'STICKY: the cabinets -- mbus and the grid', agoDays: 19,
    posts: [
      { by: 'grey_ghost', body: [
        'The street cabinets -- signals, breakers, the substation gear -- are not computers you log into. They speak the controller bus, on port 502.',
        '`mbus <ip> read` reads the registers (what the cabinet thinks its state is).',
        '`mbus <ip> write coil 0 <0|1>` flips a coil. On a breaker, that is the breaker. On a signal cabinet, that is the cycle.',
        'You still have to get onto the right network to reach it -- physically, at the box, or through whatever it is wired to. mbus does not conjure a path.' ] },
      { by: 'off_ember', body: ['The substation is the big one. There are two ways onto its gear and they are not the same job -- one is quick and shallow, the other brings a truck out. Know which you are doing before you touch a coil.'] },
      { by: 'faint_latch', body: ['A pole breaker trips back on its own after an hour or two. A cabinet left off-cycle is noticed faster than you think. Plan the window, do not improvise it.'] },
      { by: 'grey_ghost', body: ['And read the grid first. Which cabinet feeds which block is not obvious from the street. The contracts that pay are the ones where you already knew the wiring before you showed up.'] },
    ],
  },
  {
    id: 'g6', title: 'how do contracts even work here?', agoDays: 6,
    posts: [
      { by: 'spare_ping', body: ['New. Someone said the real work is on this board, not the cafe. How does it go?'] },
      { by: 'low_crow', body: [
        'Someone posts what they need on Contracts, no names. You take it, you deliver, you get paid. Your phone is how they reach you, so the number you are using is your whole reputation here.',
        'Burn the chip and you are nobody again -- no heat, but also no name, no better jobs. Keep a line if you want the work to get better.' ] },
      { by: 'quiet_fuse', body: ['First ones are small and someone is watching how you do. Do them clean, on time, and the ones worth taking start coming. Flake and the fixer stops seeing you.'] },
      { by: 'dark_jack', body: ['The confirm code when you register goes to the phone, not an email. That is on purpose.'] },
    ],
  },
];

/**
 * The Contracts board, generated from the world: anonymized gigs that read like the work the fixer
 * texts you (F.1), but as open postings. Kept clean and vague on purpose -- a district, a want, a
 * price, never a plan. Deterministic from the seed and the day so the board is steady within a day.
 * (For now the board only shows them; taking a job through the forum is later work -- F.10/stage 16.)
 */
export function gigs(w: World): ForumThread[] {
  const c = w.city, seed = w.seed, day = Math.floor(w.time / 86400);
  const dists = c.districts;
  if (!dists?.length) return [];
  const h = (n: number, q: number) => hash3(seed ^ 0x61c3, day * 16 + n, q);
  const bizNames = () => c.businesses.length ? businessName(c, Math.floor(h(0, 7) * c.businesses.length)) : 'a place';
  const out: ForumThread[] = [];
  const N = 4 + Math.floor(h(99, 1) * 3); // 4..6 open postings
  for (let n = 0; n < N; n++) {
    const d = districtName(c, Math.floor(h(n, 1) * dists.length));
    const pay = (1 + Math.floor(h(n, 2) * 8)) * 2500; // $25..$200, loose
    const kind = Math.floor(h(n, 3) * 4);
    const by = handle(seed, 200 + n), taker = handle(seed, 300 + n);
    const money = `$${(pay / 100).toFixed(0)}`;
    const title = kind === 0 ? `lights out one evening, ${d}`
      : kind === 1 ? `need a crossing to misbehave for an hour, ${d}`
      : kind === 2 ? `where was a line, ${d} area`
      : `look at a cabinet for me, ${d}`;
    const want = kind === 0 ? [`One block in ${d} dark for an evening. I will say which when you take it.`, `${money}. Clean, no mess, lights back by morning.`]
      : kind === 1 ? [`A signalled crossing near ${bizNames()} off its normal cycle for about an hour. Window matters, read the grid first.`, `${money} on delivery.`]
      : kind === 2 ? [`Need to know which part of ${d} a number sat in a few hours back. Off the operator's own records, nothing fancy.`, `${money}, text me the district and that is it.`]
      : [`Someone to read a street cabinet in ${d} and tell me what state it is holding. No touching, just read.`, `small one, ${money}.`];
    const posts: ForumPost[] = [{ by, body: want }];
    if (h(n, 4) < 0.45) posts.push({ by: taker, body: [h(n, 5) < 0.5 ? 'pm me, I am around tonight.' : 'is this still open?'] });
    if (h(n, 6) < 0.3) posts.push({ by, body: ['taken. closing.'] });
    out.push({ id: `c${day}-${n}`, title, agoDays: Math.floor(h(n, 8) * 3), posts });
  }
  return out;
}
