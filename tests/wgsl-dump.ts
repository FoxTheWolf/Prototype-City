/**
 * Dumps the world's WGSL (gpu/shader.ts) and its hash, to prove a refactor of the shader's TypeScript left the
 * WGSL byte for byte the same (13.S). Run:
 * npx rolldown tests/wgsl-dump.ts --format esm --platform node -o tests/.out/wgsl-dump.mjs && node tests/.out/wgsl-dump.mjs [out.wgsl]
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { worldWGSL } from '../src/render/gpu/shader';

const w = worldWGSL();
if (process.argv[2]) writeFileSync(process.argv[2], w);
console.log(`world WGSL: ${w.length} chars, ${w.split('\n').length} lines, sha1 ${createHash('sha1').update(w).digest('hex')}`);
