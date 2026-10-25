// Static checks that run without a browser:
//  1. every cited source key exists in SRC (no broken evidence links)
//  2. every store key the app writes is classified on the server (backend/core/policy.py)
//  3. the build contains no known demo passcodes or obvious secrets
//  4. each module parses as JavaScript
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'app', 'src');
const files = readdirSync(SRC).filter(f => f.endsWith('.js'));
const all = files.map(f => [f, readFileSync(join(SRC, f), 'utf8')]);
let fail = 0; const bad = m => { console.error('FAIL', m); fail++; };

// 1. evidence keys
const norms = all.map(([, s]) => s).join('\n');
const defined = new Set([...norms.matchAll(/^\s{2}([a-z0-9_]+): \{ cite:/gm)].map(m => m[1]).concat([...norms.matchAll(/SRC\.([a-z0-9_]+) = \{/g)].map(m => m[1])));
const used = new Set();
for (const [f, s] of all) {
  for (const m of s.matchAll(/srcLink\('([a-z0-9_]+)'\)/g)) used.add(m[1] + '@' + f);
  for (const m of s.matchAll(/\bsrc: \[([^\]]*)\]/g)) for (const k of m[1].matchAll(/'([a-z0-9_]+)'/g)) used.add(k[1] + '@' + f);
  for (const m of s.matchAll(/\['(?:ok|fixed|practice|weak)', \[([^\]]*)\]/g)) for (const k of m[1].matchAll(/'([a-z0-9_]+)'/g)) used.add(k[1] + '@' + f);
}
for (const u of used) { const [k, f] = u.split('@'); if (!defined.has(k)) bad(`source "${k}" cited in ${f} is not defined in SRC`); }
console.log(`evidence: ${defined.size} sources defined, ${used.size} citations checked`);

// 2. store keys classified
const policy = readFileSync(join(ROOT, 'backend', 'core', 'policy.py'), 'utf8');
const classified = new Set([...policy.matchAll(/"([A-Za-z0-9_-]+)": "(user|team|clinic|p1)"/g)].map(m => m[1]));
const keys = new Set();
for (const [, s] of all) for (const m of s.matchAll(/store\.(?:get|set)\('([A-Za-z0-9_-]+)'/g)) keys.add(m[1]);
for (const k of keys) if (!classified.has(k)) bad(`store key "${k}" is not classified in backend/core/policy.py`);
console.log(`policy: ${keys.size} store keys, all classified: ${[...keys].every(k => classified.has(k))}`);

// 3. secrets
for (const [f, s] of all) for (const pat of [/liv2026|padel2026/, /\b4417\b/, /sk-[A-Za-z0-9]{20,}/, /AKIA[0-9A-Z]{16}/]) if (pat.test(s)) bad(`possible secret ${pat} in ${f}`);

// 4. syntax (classic modules only; anatomy2.js is an ES module)
for (const [f, s] of all) { if (f === 'anatomy2.js') continue; try { new Function(s); } catch (e) { bad(`${f} does not parse: ${e.message}`); } }

if (fail) { console.error(`${fail} problem(s)`); process.exit(1); }
console.log('static checks passed');
