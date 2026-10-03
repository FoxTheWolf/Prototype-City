/** Long work written as a generator that yields how far along it is (0..1), now and then. */
export type Steps<T> = Generator<number, T>;

/** Runs it all at once. */
export function drain<T>(g: Steps<T>): T {
  for (;;) { const r = g.next(); if (r.done) return r.value; }
}

/** Runs it in slices of about `budget` ms, giving the page a turn between them (it keeps painting and answering). */
export async function pace<T>(g: Steps<T>, onStep: (f: number) => void, budget = 30): Promise<T> {
  for (;;) {
    const t0 = performance.now();
    let r = g.next();
    while (!r.done && performance.now() - t0 < budget) r = g.next();
    if (r.done) return r.value;
    onStep(r.value);
    await new Promise<void>((ok) => { const c = new MessageChannel(); c.port1.onmessage = () => ok(); c.port2.postMessage(0); });
  }
}
