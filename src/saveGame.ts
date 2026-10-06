// The saved game (F.6), kept in the browser (IndexedDB, by structured clone: Maps, Sets and typed
// arrays go as they are). One slot for now. Under the Electron build the page is always served from
// the same origin (port 47180), so the save lasts between runs; in the dev server it lives per port.
import type { WorldSave } from './sim/save';

/** Bumped when the shape changes in a way an old save cannot be read into. */
export const SAVE_V = 1;

export interface GameSave {
  v: number;
  seed: number;
  /** Real time it was written (Date.now()), for the title's line. */
  at: number;
  world: WorldSave;
  phone: unknown;
  laptop: unknown;
  watch: unknown;
  cam: { yaw: number; pitch: number };
}

const DB = 'terminal-city-saves', STORE = 'saves', SLOT = 'slot1';

function open(): Promise<IDBDatabase> {
  return new Promise((ok, fail) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fail(r.error);
  });
}

/** The save, or undefined (none, an older shape, or no storage). */
export async function readSave(): Promise<GameSave | undefined> {
  try {
    const db = await open();
    const s = await new Promise<GameSave | undefined>((ok) => {
      const r = db.transaction(STORE).objectStore(STORE).get(SLOT);
      r.onsuccess = () => ok(r.result as GameSave | undefined);
      r.onerror = () => ok(undefined);
    });
    return s?.v === SAVE_V ? s : undefined;
  } catch { return undefined; }
}

/** Writes it over the slot: true once it is on disk. */
export async function writeSave(s: GameSave): Promise<boolean> {
  try {
    const db = await open();
    return await new Promise((ok) => {
      const t = db.transaction(STORE, 'readwrite');
      t.objectStore(STORE).put(s, SLOT);
      t.oncomplete = () => ok(true);
      t.onerror = t.onabort = () => ok(false);
    });
  } catch (e) { console.warn('save failed', e); return false; }
}

/** Erases the slot (NEW GAME starts over: no CONTINUE back to the old one). */
export async function deleteSave(): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((ok) => {
      const t = db.transaction(STORE, 'readwrite');
      t.objectStore(STORE).delete(SLOT);
      t.oncomplete = t.onerror = t.onabort = () => ok();
    });
  } catch (e) { console.warn('could not erase the save', e); }
}
