"""Turn BodyParts3D STL meshes into one skinned, web-ready anatomy pack.
Output: anatomy.bin (gzip) = [u32 json_len][json][positions i16*3][skinIdx u8*4][skinW u8*4][indices u32]
Coordinates out: metres, y up, z anterior, model's right = -x.
"""
import json, os, sys, gzip, re, struct
import numpy as np
from scipy.spatial import cKDTree
sys.path.insert(0, os.path.dirname(__file__))
from stl import load_stl

ROOT = os.environ.get('ANAT_WORK', os.path.expanduser('~/anatomy-work')) + '/'
D = ROOT + 'deps/bp3d/assets/BodyParts3D_data/stl/'
M = json.load(open(ROOT + 'deps/bp3d-msk.json'))
OUT = ROOT + 'rig/'

def to_world(V):  # bp3d mm (x, y=posterior+, z up) -> metres (x, y up, z anterior)
    return np.stack([V[:, 0], V[:, 2], -V[:, 1]], 1) / 1000.0

# ---------- simplification: quadric-placed vertex clustering ----------
def simplify(V, F, cell):
    if len(V) < 300: return V, F
    # vertex normals, so the two faces of a thin sheet never merge into one cluster
    vn = np.zeros_like(V); fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    for k in range(3): np.add.at(vn, F[:, k], fn)
    ax = np.abs(vn).argmax(1); sg = np.sign(vn[np.arange(len(V)), ax]).astype(np.int64)
    bucket = ax * 2 + (sg > 0)
    key = np.c_[np.floor(V / cell).astype(np.int64), bucket]
    _, cl = np.unique(key, axis=0, return_inverse=True); cl = cl.ravel()
    n = cl.max() + 1
    p0, p1, p2 = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
    nrm = np.cross(p1 - p0, p2 - p0); area = np.linalg.norm(nrm, axis=1) + 1e-12
    nu = nrm / area[:, None]; d = -(nu * p0).sum(1)
    A = np.zeros((n, 3, 3)); b = np.zeros((n, 3)); mean = np.zeros((n, 3)); cnt = np.zeros(n)
    np.add.at(mean, cl, V); np.add.at(cnt, cl, 1); mean /= cnt[:, None]
    w = area[:, None, None]
    Q = nu[:, :, None] * nu[:, None, :] * w; qb = nu * d[:, None] * area[:, None]
    for k in range(3):
        np.add.at(A, cl[F[:, k]], Q); np.add.at(b, cl[F[:, k]], qb)
    lam = (np.trace(A, axis1=1, axis2=2) / 3.0)[:, None, None] * 0.05 + 1e-9
    P = np.linalg.solve(A + lam * np.eye(3), (-b + lam[:, :, 0] * mean)[:, :, None])[:, :, 0]
    # keep inside the cell neighbourhood
    off = P - mean; lim = cell * 0.9; nn = np.linalg.norm(off, axis=1)
    P = np.where((nn > lim)[:, None], mean + off / (nn[:, None] + 1e-12) * lim, P)
    keep = (cl[F][:, 0] != cl[F][:, 1]) & (cl[F][:, 1] != cl[F][:, 2]) & (cl[F][:, 0] != cl[F][:, 2])
    G = cl[F][keep]; on = nu[keep]
    srt = np.sort(G, 1); _, ui = np.unique(srt, axis=0, return_index=True); ui = np.sort(ui); G = G[ui]; on = on[ui]
    # keep each new face facing the same way as the original surface it came from
    q0, q1, q2 = P[G[:, 0]], P[G[:, 1]], P[G[:, 2]]
    nn_ = np.cross(q1 - q0, q2 - q0)
    flip = (nn_ * on).sum(1) < 0
    G[flip] = G[flip][:, [0, 2, 1]]
    used = np.unique(G); remap = -np.ones(n, np.int64); remap[used] = np.arange(len(used))
    return P[used], remap[G]

def surface_area(V, F):
    return 0.5 * np.linalg.norm(np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]]), axis=1).sum()

# ---------- load ----------
parts = []
for fid, (name, kind) in []:
    if any(s in name for s in ['eyeball', 'gingiva', 'brain', 'precuneus']): continue
    p = D + fid + '.stl'
    if not os.path.exists(p): continue
    V, F = load_stl(p)
    parts.append({'id': fid, 'name': name, 'kind': kind, 'V': V, 'F': F})
print('loaded', len(parts), 'raw verts', sum(len(p['V']) for p in parts))

ZAN = True
if ZAN:
    import pickle
    parts = pickle.load(open('/tmp/zan_parts.pkl', 'rb'))
    for p in parts: p['id'] = p['name']
    print('Z-Anatomy parts', len(parts), 'raw verts', sum(len(p['V']) for p in parts))
ALIAS = {'fifth lumbar vertebra': 'vertebra l5', 'twelfth thoracic vertebra': 'vertebra t12', 'seventh cervical vertebra': 'vertebra c7', 'atlas': 'atlas (c1)',
         'navicular bone of right foot': 'right navicular bone', 'navicular bone of left foot': 'left navicular bone'}
byname = {p['name']: p for p in parts}
def P(n): return byname[ALIAS.get(n, n) if ZAN else n]['V']

# ---------- joint centres from bone geometry (bp3d mm) ----------
def sphere_fit(X):
    A = np.c_[2 * X, np.ones(len(X))]; f = (X ** 2).sum(1)
    c, *_ = np.linalg.lstsq(A, f, rcond=None); return c[:3]
J = {}
for s, side in [('R', 'right'), ('L', 'left')]:
    sg = -1 if s == 'R' else 1
    fem = P(side + ' femur'); zt = fem[:, 2].max()
    top = fem[fem[:, 2] > zt - 50]
    med = top[(top[:, 0] * sg) < np.percentile(top[:, 0] * sg, 45)]
    J['hip_' + s] = sphere_fit(med)
    zb = fem[:, 2].min(); low = fem[fem[:, 2] < zb + 40]
    J['knee_' + s] = np.array([low[:, 0].mean(), low[:, 1].mean(), zb + 22])
    tib = P(side + ' tibia'); fib = P(side + ' fibula')
    mm = tib[tib[:, 2] < tib[:, 2].min() + 15].mean(0); lm = fib[fib[:, 2] < fib[:, 2].min() + 15].mean(0)
    tal = P(side + ' talus')
    J['ankle_' + s] = np.array([(mm[0] + lm[0]) / 2, (mm[1] + lm[1]) / 2, tal[:, 2].max() - 8])
    hum = P(side + ' humerus'); ht = hum[:, 2].max()
    htop = hum[hum[:, 2] > ht - 45]
    hmed = htop[(htop[:, 0] * sg) < np.percentile(htop[:, 0] * sg, 50)]
    J['shoulder_' + s] = sphere_fit(hmed)
    hb = hum[:, 2].min(); hl = hum[hum[:, 2] < hb + 25]
    J['elbow_' + s] = np.array([hl[:, 0].mean(), hl[:, 1].mean(), hb + 14])
    rad = P(side + ' radius'); uln = P(side + ' ulna')
    rd = rad[rad[:, 2] < rad[:, 2].min() + 12].mean(0); ud = uln[uln[:, 2] < uln[:, 2].min() + 12].mean(0)
    J['wrist_' + s] = (rd + ud) / 2 + np.array([0, 0, -6])
J['pelvis'] = (J['hip_R'] + J['hip_L']) / 2
L5 = P('fifth lumbar vertebra'); J['lumbar'] = np.array([0, L5[:, 1].mean() + 8, L5[:, 2].min()])
T12 = P('twelfth thoracic vertebra'); J['thorax'] = np.array([0, T12[:, 1].mean() + 10, T12[:, 2].min()])
C7 = P('seventh cervical vertebra'); J['neck'] = np.array([0, C7[:, 1].mean() + 8, C7[:, 2].min()])
AT = P('atlas'); J['head'] = np.array([0, AT[:, 1].mean() + 5, AT[:, 2].max()])
JOINTS = ['pelvis', 'lumbar', 'thorax', 'neck', 'head', 'hip_R', 'knee_R', 'ankle_R', 'hip_L', 'knee_L', 'ankle_L', 'shoulder_R', 'elbow_R', 'wrist_R', 'shoulder_L', 'elbow_L', 'wrist_L']
PARENT = {'pelvis': None, 'lumbar': 'pelvis', 'thorax': 'lumbar', 'neck': 'thorax', 'head': 'neck', 'hip_R': 'pelvis', 'knee_R': 'hip_R', 'ankle_R': 'knee_R', 'hip_L': 'pelvis', 'knee_L': 'hip_L', 'ankle_L': 'knee_L',
          'shoulder_R': 'thorax', 'elbow_R': 'shoulder_R', 'wrist_R': 'elbow_R', 'shoulder_L': 'thorax', 'elbow_L': 'shoulder_L', 'wrist_L': 'elbow_L'}
JI = {j: i for i, j in enumerate(JOINTS)}
for k in J: print(k, np.round(J[k]).astype(int))

# ---------- bone -> segment ----------
def seg_of_bone(n):
    side = 'R' if n.startswith('right') or ' right ' in n else 'L' if n.startswith('left') or ' left ' in n else None
    if re.search(r'femur', n): return 'hip_' + side
    if re.search(r'tibia|fibula|interosseous membrane of .* leg', n): return 'knee_' + side
    if re.search(r'patella', n): return ('knee_' + side, 'hip_' + side)
    if re.search(r'calcaneus|talus|cuboid|cuneiform|navicular bone|metatarsal|toe|sesamoid bone|finger of foot', n): return 'ankle_' + side
    if re.search(r'humerus', n): return 'shoulder_' + side
    if re.search(r'radius|ulna|interosseous membrane of .* forearm', n): return 'elbow_' + side
    if re.search(r'capitate|hamate|lunate|pisiform|scaphoid|trapezium|trapezoid|triquetr|metacarpal|finger|thumb', n): return 'wrist_' + side
    if re.search(r'hip bone|sacrum|coccy', n): return 'pelvis'
    if re.search(r'lumbar vertebra|vertebra l\d', n): return 'lumbar'
    if re.search(r'vertebra t\d', n): return 'thorax'
    if re.search(r'vertebra c\d|atlas \(|axis \(', n): return 'neck'
    if re.search(r'body of sternum', n): return 'thorax'
    if re.search(r'thoracic vertebra|rib|sternum|manubrium|xiphoid|costal|scapula|clavicle', n): return 'thorax'
    if re.search(r'cervical vertebra|atlas|axis', n): return 'neck'
    if re.search(r'intervertebral disk of (first|second|third|fourth|fifth|sixth|seventh) cervical', n): return 'neck'
    if re.search(r'intervertebral disk of .* lumbar', n): return 'lumbar'
    if re.search(r'intervertebral disk', n): return 'thorax'
    return 'head'

import scipy.sparse as sp, subprocess
def taubin(V, F, iters=10, lam=0.5, mu=-0.53):
    n = len(V); i = np.r_[F[:, 0], F[:, 1], F[:, 2], F[:, 1], F[:, 2], F[:, 0]]; j = np.r_[F[:, 1], F[:, 2], F[:, 0], F[:, 0], F[:, 1], F[:, 2]]
    A = sp.coo_matrix((np.ones(len(i)), (i, j)), shape=(n, n)).tocsr(); A.data[:] = 1.0
    deg = np.asarray(A.sum(1)).ravel(); deg[deg == 0] = 1; W = sp.diags(1.0 / deg) @ A
    X = V.copy()
    for _ in range(iters):
        X = X + lam * (W @ X - X); X = X + mu * (W @ X - X)
    return X
def weights_for(V, cand, sharp=4.0):
    D_ = np.stack([trees[c].query(V)[0] for c in cand], 1) + 2.0
    W = 1.0 / D_ ** sharp
    if len(cand) > 4:
        idx = np.argsort(-W, 1)[:, :4]; W = np.take_along_axis(W, idx, 1); ids = np.array([JI[c] for c in cand])[idx]
    else:
        ids = np.tile(np.array([JI[c] for c in cand]), (len(V), 1));
    W = W / W.sum(1, keepdims=True)
    if W.shape[1] < 4:
        W = np.c_[W, np.zeros((len(V), 4 - W.shape[1]))]; ids = np.c_[ids, np.zeros((len(V), 4 - ids.shape[1]), int)]
    return ids.astype(np.uint8), W


# ---------- systems pack: insertions, vessels, nerves, organs (second, lazily loaded file on the same rig) ----------
segpts = {j: [] for j in JOINTS}
for p in parts:
    if p['kind'] == 'bone':
        s_ = seg_of_bone(p['name']); s_ = s_[0] if isinstance(s_, tuple) else s_
        segpts[s_].append(p['V'][::3])
trees = {j: cKDTree(np.vstack(v)) for j, v in segpts.items() if v}
import pickle
P2 = pickle.load(open('/tmp/zan_parts2.pkl', 'rb'))
BRAIN_SURF = re.compile(r'sulc|lat_fis|pole$|fissure|notch|incisure')
BRAIN_KEEP = re.compile(r'gyr|lobule|culmen|declive|vermis|flocculus|nodule|lingula of cerebellum|tonsil of cerebellum|pons|midbrain|medulla oblongata|white matter of spinal cord|corpus callosum|cuneus|insula|eyeball|cornea|lens$|retina|iris')
GENITAL = re.compile(r'penis|testis|epididym|ductus deferens|seminal|ejaculatory|prostate|urethra|glans|corpus cavernosum|corpus spongiosum')
keep = []
for p in P2:
    n, k = p['name'], p['kind']
    if k in ('nerve', 'neuro'):
        if p['curve']:
            if BRAIN_SURF.search(n): continue
            k = 'nerve'
        else:
            if not BRAIN_KEEP.search(n) or BRAIN_SURF.search(n): continue
            k = 'brain'
    if k == 'organ' and (GENITAL.search(n) or re.search(r'omentum|mesocolon|meso-appendix|pleura|taenia|mucosa', n)): continue
    if k == 'ins' and len(p['V']) < 3: continue
    p['kind'] = k; keep.append(p)
parts2 = keep
print('systems parts', len(parts2), 'raw verts', sum(len(p['V']) for p in parts2))
blob = [struct.pack('<I', len(parts2))]; bodies = []
for p in parts2:
    V = p['V']; F = p['F']; a = surface_area(V, F)
    dens = {'ins': 8.0, 'artery': 26.0, 'vein': 30.0, 'nerve': 26.0, 'brain': 90.0, 'organ': 70.0}[p['kind']]
    target = int(max(60 if p['curve'] else 120, min(6000, a / dens)))
    Vs = V if p['curve'] or p['kind'] == 'ins' else taubin(V, F, 6)
    blob.append(struct.pack('<IIIf', len(Vs), F.size, int(min(F.size, target * 6)), 0.02))
    bodies.append(Vs.astype(np.float32).tobytes()); bodies.append(F.astype(np.uint32).tobytes())
open('/tmp/bp_in2.bin', 'wb').write(b''.join(blob + bodies))
subprocess.run(['node', os.path.join(OUT, 'meshopt', 'simplify.mjs'), '/tmp/bp_in2.bin', '/tmp/bp_out2.bin'], check=True)
raw = open('/tmp/bp_out2.bin', 'rb').read(); n_ = struct.unpack_from('<I', raw, 0)[0]; hd = np.frombuffer(raw, np.uint32, 2 * n_, 4).reshape(n_, 2); o = 4 + 8 * n_
for p, (nv, ni) in zip(parts2, hd):
    p['V'] = np.frombuffer(raw, np.float32, nv * 3, o).reshape(-1, 3).astype(np.float64); o += nv * 12
    p['F'] = np.frombuffer(raw, np.uint32, ni, o).reshape(-1, 3).astype(np.int64); o += ni * 4
print('simplified verts', sum(len(p['V']) for p in parts2))
structs = []; POS = []; SI = []; SW = []; IDX = []; voff = 0; ioff = 0
LAYER = {'ins': 'ins', 'artery': 'art', 'vein': 'vein', 'nerve': 'nerve', 'brain': 'nerve', 'organ': 'organ'}
KIND = {'artery': 'Artery', 'vein': 'Vein', 'nerve': 'Nerve', 'brain': 'Brain and spinal cord', 'organ': 'Organ'}
for p in parts2:
    V, F = p['V'], p['F']
    if len(F) == 0: continue
    cand = []
    for j, t in trees.items():
        d, _ = t.query(V[:: max(1, len(V) // 300)])
        if d.min() < 25: cand.append((d.min(), j))
    cand = [j for _, j in sorted(cand)][:5] or [min(trees, key=lambda j: trees[j].query(V.mean(0))[0])]
    if p['kind'] == 'ins': cand = cand[:1]
    si, sw = weights_for(V, cand)
    Vw = to_world(V); POS.append(Vw); SI.append(si); SW.append(sw); IDX.append(F.astype(np.uint32).ravel())
    nm = p['name']; side = 'R' if nm.startswith('right') else 'L' if nm.startswith('left') else ''
    st = {'name': nm, 'kind': ('Origin' if p['role'] == 'origin' else 'Insertion') if p['kind'] == 'ins' else KIND[p['kind']], 'layer': LAYER[p['kind']], 'key': None, 'side': side, 'v': [voff, len(V)], 'i': [ioff, int(F.size)]}
    if p['kind'] == 'ins': st['muscle'] = (('right ' if side == 'R' else 'left ' if side == 'L' else '') + p['label'].lower())
    structs.append(st); voff += len(V); ioff += F.size
POSa = np.vstack(POS); SIa = np.vstack(SI).astype(np.uint8); SWa = np.vstack(SW)
SWq = np.round(SWa * 255).astype(np.int32); diff = 255 - SWq.sum(1); SWq[np.arange(len(SWq)), SWa.argmax(1)] += diff; SWq = SWq.astype(np.uint8)
IDXa = np.concatenate(IDX).astype(np.uint32)
SCALE = 4000.0; Q = np.round(POSa * SCALE).astype(np.int16)
meta = {'credit': 'Z-Anatomy (CC BY-SA 4.0) on BodyParts3D (CC BY-SA 2.1 Japan): muscle attachments, vessels, nerves and organs.', 'scale': SCALE, 'nv': int(len(Q)), 'ni': int(len(IDXa)), 'structs': structs}
js = json.dumps(meta, separators=(',', ':')).encode(); pad = (4 - (4 + len(js)) % 4) % 4; js += b' ' * pad
out = struct.pack('<I', len(js)) + js + Q.tobytes() + SIa.tobytes() + SWq.tobytes() + IDXa.tobytes()
with gzip.open(OUT + 'systems.bin.gz', 'wb', 9) as f: f.write(out)
from collections import Counter
print('structs', len(structs), 'verts', len(Q), 'gz MB', round(os.path.getsize(OUT + 'systems.bin.gz') / 1e6, 2), Counter(s['layer'] for s in structs))
