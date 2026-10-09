// TC_HEAP=1 (16.1): the heap sampler of Chromium's own tools over the game's frames, without a window. Waits for the
// world to run, samples the allocations for `secs` s and prints the functions that allocated the most (by their own
// allocations, not their callees'), per frame, so what feeds the garbage collector shows by name.
async function heap(win, secs) {
  await new Promise((ok) => win.webContents.once('did-finish-load', ok));
  const run = (js) => win.webContents.executeJavaScript(js, true);
  // the world drawn and ticking for a few seconds first: the start's one-off allocations out of the sample
  await run(`(async () => { const t0 = performance.now(); while (!(window.world?.tick > 600) && performance.now() - t0 < 120000) await new Promise((r) => setTimeout(r, 200)); })()`);
  const dbg = win.webContents.debugger;
  dbg.attach('1.3');
  await dbg.sendCommand('HeapProfiler.enable');
  await dbg.sendCommand('HeapProfiler.collectGarbage');
  await run(`window.__hf = 0; (function f() { window.__hf++; requestAnimationFrame(f); })(); 0`);
  if (process.env.TC_HEAP_EVAL) console.log('eval before:', await run(process.env.TC_HEAP_EVAL));
  await dbg.sendCommand('HeapProfiler.startSampling', { samplingInterval: 4096, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
  if (process.env.TC_HEAP_DURING) console.log('during:', await run(process.env.TC_HEAP_DURING));
  await new Promise((r) => setTimeout(r, secs * 1000));
  const { profile } = await dbg.sendCommand('HeapProfiler.stopSampling');
  const frames = await run('window.__hf');
  if (process.env.TC_HEAP_EVAL) console.log('eval:', await run(process.env.TC_HEAP_EVAL));
  const own = new Map();
  let total = 0;
  const paths = [];
  (function walk(n, up) {
    const f = n.callFrame, key = `${f.functionName || '(anon)'}  ${(f.url || '').replace(/^.*\//, '')}:${f.lineNumber + 1}`;
    own.set(key, (own.get(key) ?? 0) + n.selfSize);
    total += n.selfSize;
    const path = [...up, f.functionName || '(anon)'];
    if (n.selfSize) paths.push([n.selfSize, path.slice(-7).join(' < ')]);
    for (const c of n.children) walk(c, path);
  })(profile.head, []);
  const kb = (b) => (b / frames / 1024).toFixed(1);
  console.log(`${frames} frames in ${secs} s (${(frames / secs).toFixed(0)} fps): ${(total / secs / 1e6).toFixed(1)} MB/s, ${kb(total)} KB a frame`);
  for (const [k, v] of [...own].sort((a, b) => b[1] - a[1]).slice(0, 40)) console.log(`${kb(v).padStart(8)} KB  ${(100 * v / total).toFixed(1).padStart(5)}%  ${k}`);
  // TC_HEAP_PATHS=1: the heaviest call paths too (innermost last)
  if (process.env.TC_HEAP_PATHS) for (const [v, p] of paths.sort((a, b) => b[0] - a[0]).slice(0, 25)) console.log(`${kb(v).padStart(8)} KB  ${p}`);
  dbg.detach();
}
module.exports = { heap };
