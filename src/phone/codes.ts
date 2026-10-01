import { hash3 } from '../core/rng';

/**
 * The phone's secret codes: typed on the dialer, they open the service screens the maker left in
 * the firmware (the way phone phreaks and later handset hackers found them). *#06# shows the IMEI,
 * as on every GSM phone; the others are this firmware's own, different in every city (seed), so a
 * new game does not start knowing them. They are meant to be found in the world (stage 12 on: a
 * forum post, a repair shop's notes, a leaked manual); until then the phone's debug settings list
 * them. A code runs as soon as its last # is typed, without the call key.
 */
export type CodeKind = 'imei' | 'gps' | 'field' | 'sensors' | 'keys' | 'lcd' | 'version';
export const CODE_KINDS: CodeKind[] = ['imei', 'gps', 'field', 'sensors', 'keys', 'lcd', 'version'];

export interface SecretCode {
  code: string;
  kind: CodeKind;
}

const cache = new Map<number, SecretCode[]>();

export function secretCodes(seed: number): SecretCode[] {
  let L = cache.get(seed);
  if (L) return L;
  L = [{ code: '*#06#', kind: 'imei' }];
  const used = new Set<string>();
  CODE_KINDS.slice(1).forEach((kind, n) => {
    let digits = '';
    for (let t = 0; !digits || used.has(digits); t++) digits = String(1000 + Math.floor(hash3(seed, 0xc0de + n, t) * 9000));
    used.add(digits);
    L!.push({ code: `*#${digits}#`, kind });
  });
  cache.set(seed, L);
  return L;
}

/** The service screen a dialed string opens, if it is one of the codes. */
export function codeKind(seed: number, s: string): CodeKind | null {
  return secretCodes(seed).find((c) => c.code === s)?.kind ?? null;
}
