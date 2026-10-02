import { hash3 } from '../core/rng';
import { logEvent } from './events';
import { switchSub } from './power';
import { Sec } from './wifi';
import { type World } from './world';

/**
 * The machines on a Wi-Fi network: what a scan finds behind the router and what they answer. A
 * shop's or home's network has the router and sometimes a PC or two; a substation's maintenance
 * link (sim/wifi.ts, `util`) has the radio bridge, the substation's remote terminal (the breaker)
 * and the cabinet that runs the traffic lights of its district. Everything is made from the seed,
 * so a scan twice gives the same machines. The services are simulated: a login prompt, a password
 * that is a weak one from the common lists, and a few commands that change the city's state.
 */
export interface Port { n: number; service: string; banner: string }
export type HostKind = 'router' | 'pc' | 'rtu' | 'signal' | 'bridge';
export interface Host {
  ip: string;
  name: string;
  kind: HostKind;
  /** The substation it belongs to (rtu, signal, bridge), or -1. */
  sub: number;
  ports: Port[];
  /** Login of the telnet-style console on port 23, if it has one. */
  user: string;
  pass: string;
  mac: string;
}

/** Common passwords, as in a cracker's word list: every weak password in the game is one of these. */
export const WORDS = [
  'admin', 'password', 'letmein', 'welcome', 'qwerty', 'secret', 'changeme', 'default', 'guest', 'root', 'toor', 'master',
  'monkey', 'dragon', 'shadow', 'sunshine', 'princess', 'football', 'baseball', 'freedom', 'whatever', 'trustno1', 'iloveyou',
  'abc123', 'pass123', '123456', '12345678', '111111', '000000', '1234', 'test', 'temp', 'login', 'access', 'service',
  'operator', 'system', 'manager', 'supervisor', 'maint', 'grid', 'voltex', 'power', 'switch', 'relay', 'breaker', 'signal',
  'traffic', 'cabinet', 'city', 'utility', 'engineer', 'tech', 'backup', 'public', 'private', 'cisco', 'netgear', 'router',
  'linksys', 'wireless', 'internet', 'network', 'server', 'computer', 'office', 'summer', 'winter', 'spring', 'autumn',
  'coffee', 'pepper', 'ginger', 'cookie', 'banana', 'orange', 'purple', 'silver', 'golden', 'diamond', 'rocket', 'thunder',
  'lightning', 'michael', 'jessica', 'daniel', 'ashley', 'andrew', 'joshua', 'matthew', 'jordan', 'taylor', 'hunter', 'buster',
];

const mac = (seed: number, k: number) => Array.from({ length: 6 }, (_, i) => Math.floor(hash3(seed ^ 0x77a, k, i) * 256).toString(16).padStart(2, '0')).join(':').toUpperCase();

/** The hosts on access point `ap`'s network, address ending .1 first. Cached per world and point. */
export function lanHosts(w: World, ap: number): Host[] {
  const A = w.wifi[ap], base = `192.168.${A.ch}`, h = (n: number) => hash3(w.seed ^ 0x5d1, ap, n);
  const word = (n: number) => WORDS[Math.floor(h(n) * WORDS.length)];
  const out: Host[] = [];
  const add = (last: number, name: string, kind: HostKind, sub: number, ports: Port[], user = '', pass = '') =>
    out.push({ ip: `${base}.${last}`, name, kind, sub, ports, user, pass, mac: mac(w.seed, ap * 50 + last) });
  if (A.util >= 0) {
    const k = A.util, n = String(k + 1).padStart(2, '0');
    add(1, `bridge-${n}`, 'bridge', k, [{ n: 80, service: 'http', banner: 'Voltex AirLink 100 radio bridge' }]);
    add(10, `rtu-${n}`, 'rtu', k, [
      { n: 23, service: 'telnet', banner: `Voltex RTU-300 substation controller fw 2.1.4` },
      { n: 502, service: 'modbus', banner: 'unit 1 (telemetry)' },
    ], 'operator', word(11));
    add(11, `atc-${n}`, 'signal', k, [
      { n: 23, service: 'telnet', banner: 'Metrix ATC-2 traffic signal cabinet fw 1.8' },
    ], 'engineer', word(12));
    return out;
  }
  // an ordinary network: the router, and for some a PC or two sharing files
  const old = h(1) < 0.35;
  add(1, 'router', 'router', -1, [
    { n: 80, service: 'http', banner: old ? 'Boa HTTPd 0.94 (router admin)' : 'lighttpd 1.4 (router admin)' },
    ...(old ? [{ n: 23, service: 'telnet', banner: 'router maintenance console' }] : []),
  ], old ? 'admin' : '', old ? word(2) : '');
  const pcs = A.sec === Sec.Open ? Math.floor(h(3) * 3) : Math.floor(h(3) * 2);
  for (let i = 0; i < pcs; i++) {
    add(20 + i * 3, ['front-desk', 'office-pc', 'kitchen', 'laptop', 'media', 'den'][Math.floor(h(20 + i) * 6)], 'pc', -1, [
      { n: 135, service: 'msrpc', banner: 'Microsoft Windows RPC' },
      { n: 139, service: 'netbios-ssn', banner: '' },
      ...(h(30 + i) < 0.4 ? [{ n: 445, service: 'microsoft-ds', banner: 'Windows XP file sharing' }] : []),
    ]);
  }
  return out;
}

/** Throw a substation's breaker from over the network: its district goes dark (or comes back), from the substation itself. */
export function setBreaker(w: World, k: number, on: boolean) {
  const S = w.power.subs[k];
  if (S.on === on) return false;
  switchSub(w.power, k, on, w.tick, S.x, S.y);
  logEvent(w.events, on ? 'restored' : 'blackout', w.tick, w.time, S.x, S.y, 0.8, [k]);
  return true;
}

/** Tell a district's signal cabinet what to do: 0 normal, 1 flash, 2 dark. */
export function setSignals(w: World, k: number, mode: number) { w.power.subs[k].sig = mode; }

/**
 * Whether a technician is logged into a substation's terminal right now (and so is on the air in
 * the clear): half the 20-minute windows of game time have one, for the first part of the window.
 */
export function techOnline(w: World, k: number): boolean {
  const win = Math.floor(w.time / 1200), into = (w.time % 1200) / 1200;
  return hash3(w.seed ^ 0x7ec, k, win) < 0.55 && into < 0.6;
}
