// Batch QEM simplification with meshoptimizer: in = [u32 count][per part: u32 nv, u32 ni, u32 targetIdx, f32 err][f32 V...][u32 I...]
import { MeshoptSimplifier as M } from './meshopt_simplifier.js';
import fs from 'fs';
await M.ready;
const buf = fs.readFileSync(process.argv[2]); const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
let o = 0; const n = dv.getUint32(o, true); o += 4;
const parts = []; for (let i = 0; i < n; i++) { parts.push({ nv: dv.getUint32(o, true), ni: dv.getUint32(o + 4, true), tgt: dv.getUint32(o + 8, true), err: dv.getFloat32(o + 12, true) }); o += 16; }
const chunks = [Buffer.from(new Uint32Array([n]).buffer)]; const heads = [], bodies = [];
for (const p of parts) {
  const V = new Float32Array(buf.buffer.slice(buf.byteOffset + o, buf.byteOffset + o + p.nv * 12)); o += p.nv * 12;
  const I = new Uint32Array(buf.buffer.slice(buf.byteOffset + o, buf.byteOffset + o + p.ni * 4)); o += p.ni * 4;
  let out = I;
  if (p.tgt < p.ni) { const [r] = M.simplify(I, V, 3, p.tgt, p.err, ['Regularize']); out = r; }
  const [remap, unique] = M.compactMesh(out.slice());
  // compactMesh rewrites indices in place on its argument copy; rebuild explicitly
  const used = new Map(), nv = []; const idx = new Uint32Array(out.length);
  for (let k = 0; k < out.length; k++) { let j = used.get(out[k]); if (j === undefined) { j = used.size; used.set(out[k], j); nv.push(V[out[k] * 3], V[out[k] * 3 + 1], V[out[k] * 3 + 2]); } idx[k] = j; }
  heads.push(used.size, idx.length); bodies.push(Buffer.from(new Float32Array(nv).buffer), Buffer.from(idx.buffer));
}
fs.writeFileSync(process.argv[3], Buffer.concat([chunks[0], Buffer.from(new Uint32Array(heads).buffer), ...bodies]));
console.log('simplified', n);
