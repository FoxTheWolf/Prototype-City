// The population of a seed, kept in the browser (IndexedDB) so the next start skips making it (~1.5 s).
// The key holds a hash of the code it comes from (the city, the grid, the phones, the plans, the people),
// so changing that code makes a new one by itself. ?fresh in the address makes it again regardless.
import type { Population } from './sim/citizens';
import city from './sim/city.ts?raw';
import citizens from './sim/citizens.ts?raw';
import telco from './sim/telco.ts?raw';
import power from './sim/power.ts?raw';
import interior from './sim/interior.ts?raw';
import device from './sim/device.ts?raw';
import rng from './core/rng.ts?raw';
import world from './sim/world.ts?raw';

const DB = 'terminal-city', STORE = 'population';

/** FNV-1a over the sources the population depends on. */
const CODE = (() => {
  let h = 0x811c9dc5;
  for (const s of [city, citizens, telco, power, interior, device, rng, world]) for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
})();

const fresh = new URLSearchParams(location.search).has('fresh');

function open(): Promise<IDBDatabase> {
  return new Promise((ok, fail) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fail(r.error);
  });
}

/** The saved population of this seed for this code, or undefined (none, ?fresh, or no storage). */
export async function loadPop(seed: number): Promise<Population | undefined> {
  if (fresh) return undefined;
  try {
    const db = await open();
    return await new Promise((ok) => {
      const r = db.transaction(STORE).objectStore(STORE).get(`${seed} ${CODE}`);
      r.onsuccess = () => ok(r.result as Population | undefined);
      r.onerror = () => ok(undefined);
    });
  } catch { return undefined; }
}

/** Keeps it; drops the ones made by older code, and keeps a few seeds at most. */
export async function savePop(seed: number, pop: Population) {
  try {
    const db = await open(), st = db.transaction(STORE, 'readwrite').objectStore(STORE);
    const keys = await new Promise<IDBValidKey[]>((ok) => { const r = st.getAllKeys(); r.onsuccess = () => ok(r.result); r.onerror = () => ok([]); });
    const cur = keys.filter((k) => String(k).endsWith(` ${CODE}`));
    for (const k of keys) if (!cur.includes(k) || cur.indexOf(k) >= 3) st.delete(k);
    st.put(pop, `${seed} ${CODE}`);
  } catch { /* no storage: made again next time */ }
}
