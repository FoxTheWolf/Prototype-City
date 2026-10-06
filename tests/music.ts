// 15.9b: every song that comes with the Tunes Player compiles: whole bars, notes in the channels' range,
// and the melody's notes are mostly the bar's chord tones or steps of the key (a check on the hand-written parts)
import { chord, compile, TRACKS } from '../src/audio/tracks';
import NAMES from '../src/locale/music.en.json';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('FAIL', m); } };
for (const T of TRACKS) {
  const S = compile(T), secs = S.steps * S.stepS;
  ok((NAMES as Record<string, unknown>)[T.id] !== undefined, `${T.id}: no band and title in music.en.json`);
  ok(secs > 60 && secs < 300, `${T.id}: ${secs.toFixed(0)} s long`);
  const prog = T.prog.split(/\s+/).map(chord);
  let lead = 0, onChord = 0;
  for (const e of S.events) {
    if (e.ch === 'lead') {
      ok(e.n >= 53 && e.n <= 91, `${T.id}: lead note ${e.n} out of range at ${e.at}`);
      lead++;
      const C = prog[Math.floor(e.at / T.bar) % prog.length].map((p) => ((p % 12) + 12) % 12);
      if (C.includes(e.n % 12)) onChord++;
    }
    if (e.ch === 'bass') ok(e.n >= 28 && e.n <= 60, `${T.id}: bass ${e.n}`);
  }
  // a melody that rarely lands on its chord would sound wrong over it: the hand-written parts should mostly fit
  ok(onChord / lead > 0.55, `${T.id}: only ${((100 * onChord) / lead).toFixed(0)}% of the lead on chord tones`);
  console.log(`${T.id.padEnd(10)} ${secs.toFixed(0).padStart(4)} s  ${S.events.length} events  lead on chord ${((100 * onChord) / lead).toFixed(0)}%`);
}
console.log(fail ? `${fail} FAILED` : 'all ok');
process.exit(fail ? 1 : 0);
