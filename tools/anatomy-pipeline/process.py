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
for fid, (name, kind) in sorted(M.items(), key=lambda x: x[1][0]):
    if any(s in name for s in ['eyeball', 'gingiva', 'brain', 'precuneus']): continue
    p = D + fid + '.stl'
    if not os.path.exists(p): continue
    V, F = load_stl(p)
    parts.append({'id': fid, 'name': name, 'kind': kind, 'V': V, 'F': F})
print('loaded', len(parts), 'raw verts', sum(len(p['V']) for p in parts))

ZAN = os.environ.get('ZAN') == '1'
if ZAN:
    import pickle
    parts = pickle.load(open('/tmp/zan_parts6.pkl', 'rb'))
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

# ---------- smooth (Taubin, removes the scan stair-steps) then simplify with meshoptimizer QEM ----------
import scipy.sparse as sp, subprocess
def taubin(V, F, iters=10, lam=0.5, mu=-0.53):
    n = len(V); i = np.r_[F[:, 0], F[:, 1], F[:, 2], F[:, 1], F[:, 2], F[:, 0]]; j = np.r_[F[:, 1], F[:, 2], F[:, 0], F[:, 0], F[:, 1], F[:, 2]]
    A = sp.coo_matrix((np.ones(len(i)), (i, j)), shape=(n, n)).tocsr(); A.data[:] = 1.0
    deg = np.asarray(A.sum(1)).ravel(); deg[deg == 0] = 1; W = sp.diags(1.0 / deg) @ A
    X = V.copy()
    for _ in range(iters):
        X = X + lam * (W @ X - X); X = X + mu * (W @ X - X)
    return X
blob = [struct.pack('<I', len(parts))]; bodies = []
for p in parts:
    V = p['V']; F = p['F']
    a = surface_area(V, F)
    dens = 22.0 if p['kind'] == 'bone' else 34.0  # mm^2 per output vertex
    footz = min(J['ankle_R'][2], J['ankle_L'][2]) + 70
    foot = V[:, 2].mean() < footz
    if foot: dens /= 3.0
    target = int(max(160, min(12000 if foot else 5000, a / dens)))
    vol = abs((V[F[:, 0]] * np.cross(V[F[:, 1]], V[F[:, 2]])).sum()) / 6.0
    p['thick'] = 2.0 * vol / max(a, 1e-6)
    it = 6 if p['thick'] < 3 else 12
    Vs = taubin(V, F, it)
    p['Vs'] = Vs
    blob.append(struct.pack('<IIIf', len(Vs), F.size, int(min(F.size, target * 6)), 0.02))
    bodies.append(Vs.astype(np.float32).tobytes()); bodies.append(F.astype(np.uint32).tobytes())
open('/tmp/bp_in.bin', 'wb').write(b''.join(blob + bodies))
subprocess.run(['node', os.path.join(OUT, 'meshopt', 'simplify.mjs'), '/tmp/bp_in.bin', '/tmp/bp_out.bin'], check=True)
raw = open('/tmp/bp_out.bin', 'rb').read(); n = struct.unpack_from('<I', raw, 0)[0]; hd = np.frombuffer(raw, np.uint32, 2 * n, 4).reshape(n, 2); o = 4 + 8 * n
tot = 0
for p, (nv, ni) in zip(parts, hd):
    V2 = np.frombuffer(raw, np.float32, nv * 3, o).reshape(-1, 3).astype(np.float64); o += nv * 12
    F2 = np.frombuffer(raw, np.uint32, ni, o).reshape(-1, 3).astype(np.int64); o += ni * 4
    p['V'], p['F'] = V2, F2; del p['Vs']; tot += nv
print('simplified verts', tot, 'tris', sum(len(p['F']) for p in parts))

# ---------- segment point clouds for skinning ----------
segpts = {j: [] for j in JOINTS}
for p in parts:
    if p['kind'] == 'bone' or (p['kind'] == 'cart' and not ZAN):
        s = seg_of_bone(p['name']); s = s[0] if isinstance(s, tuple) else s
        if p['kind'] == 'cart' and 'costal' in p['name']: s = 'thorax'
        segpts[s].append(p['V'])
trees = {j: cKDTree(np.vstack(v)) for j, v in segpts.items() if v}

deep_words = ['medius', 'minimus', 'piriformis', 'gemellus', 'obturator', 'quadratus', 'intermedius', 'adductor brevis', 'soleus', 'tibialis posterior', 'flexor digitorum longus', 'flexor hallucis longus', 'popliteus', 'psoas', 'iliacus', 'transversus', 'internal oblique', 'multifidus', 'rotator', 'semispinalis', 'longissimus', 'iliocostalis', 'spinalis', 'intertransvers', 'interspinales', 'levatores', 'intercostal', 'rhomboid', 'levator scapulae', 'serratus posterior', 'supraspinatus', 'teres minor', 'subscapularis', 'pectoralis minor', 'subclavius', 'coracobrachialis', 'brachialis', 'supinator', 'pronator quadratus', 'profundus', 'flexor pollicis longus', 'extensor indicis', 'abductor pollicis longus', 'splenius', 'scalenus', 'longus colli', 'longus capitis', 'rectus capitis', 'obliquus capitis', 'diaphragm', 'coccygeus', 'pubococcygeus', 'puborectalis', 'iliococcygeus', 'lumbrical', 'inteross', 'adductor minimus', 'pectineus', 'plantaris', 'flexor accessorius', 'pterygoid']

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

# ---------- clinical key mapping ----------
KEYMAP = [(r'gluteus maximus', 'glute_max'), (r'gluteus medius', 'glute_med'), (r'psoas major|iliacus', 'iliopsoas'), (r'rectus femoris', 'rectus_femoris'),
          (r'vastus lateralis', 'vastus_lateralis'), (r'vastus medialis', 'vastus_medialis'), (r'biceps femoris', 'biceps_femoris'), (r'semitendinosus', 'semitendinosus'),
          (r'adductor magnus', 'adductor_magnus'), (r'medial head of .*gastrocnemius', 'gastrocnemius_med'), (r'lateral head of .*gastrocnemius', 'gastrocnemius_lat'), (r'soleus', 'soleus'),
          (r'tibialis anterior', 'tibialis_anterior'), (r'rectus abdominis', 'rectus_abdominis'), (r'external oblique', 'ext_oblique'), (r'iliocostalis|longissimus|spinalis (thoracis|cervicis)', 'erector_spinae'),
          (r'latissimus dorsi', 'lat_dorsi'), (r'pectoralis major', 'pec_major'), (r'clavicular part of .*deltoid', 'deltoid_ant'), (r'acromial part of .*deltoid', 'deltoid_mid'), (r'spinal part of .*deltoid', 'deltoid_post'),
          (r'descending part of .*trapezius', 'trapezius_upper'), (r'(ascending|transverse) part of .*trapezius', 'trapezius_lower'), (r'supraspinatus', 'supraspinatus'), (r'infraspinatus', 'infraspinatus'),
          (r'biceps brachii', 'biceps_brachii'), (r'triceps brachii', 'triceps'), (r'extensor carpi radialis brevis', 'forearm_extensors'), (r'flexor carpi radialis', 'forearm_flexors'), (r'sternocleidomastoid', 'scm'),
          (r'calcaneal tendon', 'achilles'), (r'long plantar ligament', 'long_plantar'), (r'tibialis posterior', 'tib_post'), (r'abductor hallucis', 'abductor_hallucis'), (r'flexor digitorum brevis', 'fdb'), (r'fibularis longus', 'fibularis_longus'), (r'flexor hallucis longus', 'fhl'), (r'femur', 'femur'), (r'tibia$', 'tibia'), (r'fibula', 'fibula'), (r'patella', 'patella'), (r'hip bone|sacrum', 'pelvis'),
          (r'cervical vertebra|atlas|axis', 'cspine'), (r'thoracic vertebra', 'tspine'), (r'lumbar vertebra', 'lspine'), (r'rib$|costal cartilage', 'ribs'), (r'sternum|manubrium|xiphoid', 'sternum'),
          (r'clavicle', 'clavicle'), (r'scapula', 'scapula'), (r'humerus', 'humerus'), (r'radius|ulna', 'forearm'), (r'capitate|hamate|lunate|pisiform|scaphoid|trapez|triquetral|metacarpal|finger|thumb', 'hand'),
          (r'calcaneus|talus|cuboid|cuneiform|navicular|metatarsal|toe', 'foot'), (r'occipital|frontal|parietal|temporal bone|sphenoid|ethmoid|mandible|maxilla|zygomatic|nasal|lacrimal|palatine|vomer|concha', 'skull')]
KEYMAP = [(r'plantar calcaneonavicular', 'spring_ligament'), (r'anterior cruciate', 'acl'), (r'posterior cruciate', 'pcl'), (r'tibial collateral ligament', 'mcl'), (r'fibular collateral ligament', 'lcl'),
          (r'patellar ligament', 'patellar_tendon'), (r'anterior talofibular', 'atfl'), (r'plantar aponeurosis', 'plantar_fascia'), (r'tibionavicular|tibiocalcaneal|tibiotalar|medial ligament of ankle|deltoid ligament', 'deltoid_ligament'),
          (r'gastrocnemius.*medial|medial.*gastrocnemius', 'gastrocnemius_med'), (r'gastrocnemius.*lateral|lateral.*gastrocnemius', 'gastrocnemius_lat'), (r'vertebra c\d|atlas \(|axis \(', 'cspine'), (r'vertebra t\d', 'tspine'), (r'vertebra l\d', 'lspine')] + KEYMAP
def keyof(n):
    if re.search(r'sheath|bursa|fascia$|facet|groove|sulcus', n) and 'aponeurosis' not in n: return None
    for pat, k in KEYMAP:
        if re.search(pat, n): return k
    return None

# ---------- assemble ----------
structs = []; POS = []; SI = []; SW = []; IDX = []; voff = 0; ioff = 0
def add(name, kind, layer, V, F, si, sw, key):
    global voff, ioff
    Vw = to_world(V)
    POS.append(Vw); SI.append(si); SW.append(sw); IDX.append(F.astype(np.uint32))
    side = 'R' if name.startswith('right') or ' right ' in name else 'L' if name.startswith('left') or ' left ' in name else ''
    structs.append({'name': name, 'kind': kind, 'layer': layer, 'key': key, 'side': side, 'v': [voff, len(V)], 'i': [ioff, int(F.size)]})
    voff += len(V); ioff += F.size

for p in parts:
    n, k, V, F = p['name'], p['kind'], p['V'], p['F']
    if k == 'bone' or (k == 'cart' and not ZAN):
        s = seg_of_bone(n)
        if k == 'cart' and 'costal' in n: s = 'thorax'
        if isinstance(s, tuple):
            si = np.tile(np.array([JI[s[0]], JI[s[1]], 0, 0], np.uint8), (len(V), 1)); sw = np.tile([0.55, 0.45, 0, 0], (len(V), 1))
        else:
            si = np.tile(np.array([JI[s], 0, 0, 0], np.uint8), (len(V), 1)); sw = np.tile([1.0, 0, 0, 0], (len(V), 1))
        add(n, 'Bone' if k == 'bone' else 'Cartilage', 'bone' if k == 'bone' else 'cart', V, F, si, sw, keyof(n))
    else:
        # candidate segments: any bone segment within 12 mm of this structure
        cand = []
        for j, t in trees.items():
            d, _ = t.query(V[:: max(1, len(V) // 400)])
            if d.min() < 12: cand.append((d.min(), j))
        cand = [j for _, j in sorted(cand)][:5] or [min(trees, key=lambda j: trees[j].query(V.mean(0))[0])]
        si, sw = weights_for(V, cand)
        layer = 'fascia' if k == 'fascia' else 'conn' if k == 'conn' else 'cart' if k == 'cart' else ('deep' if any(w in n for w in deep_words) else 'sup')
        kindl = ('Bursa' if 'bursa' in n else 'Capsule' if re.search(r'capsule|fibrous membrane', n) else 'Sheath' if 'sheath' in n else 'Septum' if 'septum' in n else 'Fascia') if k == 'fascia' else \
                'Muscle' if k == 'muscle' else 'Cartilage' if k == 'cart' else 'Tendon' if re.search(r'tendon|tendinous', n) else 'Aponeurosis' if 'aponeurosis' in n else 'Retinaculum' if 'retinacul' in n else 'Ligament'
        add(n, kindl, layer, V, F, si, sw, keyof(n))

# ---------- landmark ligaments the dataset lacks (approximate, labelled) ----------
def tube(a, b, r, segs=12, rings=8):
    a = np.array(a, float); b = np.array(b, float); ax = b - a; L = np.linalg.norm(ax); ax /= L
    t = np.cross(ax, [0, 0, 1.0]); t = t if np.linalg.norm(t) > 1e-3 else np.cross(ax, [1.0, 0, 0]); t /= np.linalg.norm(t); u = np.cross(ax, t)
    V = []
    for i in range(rings + 1):
        c = a + ax * L * i / rings; rr = r * (0.8 + 0.2 * np.sin(np.pi * i / rings))
        for k in range(segs):
            th = 2 * np.pi * k / segs; V.append(c + (np.cos(th) * t + np.sin(th) * u) * rr)
    F = []
    for i in range(rings):
        for k in range(segs):
            p0 = i * segs + k; p1 = i * segs + (k + 1) % segs; F += [[p0, p0 + segs, p1], [p1, p0 + segs, p1 + segs]]
    return np.array(V), np.array(F), rings, segs
for s, side in ([] if ZAN else [('R', 'right'), ('L', 'left')]):
    sg = -1 if s == 'R' else 1
    fem = P(side + ' femur'); tib = P(side + ' tibia'); fib = P(side + ' fibula'); pat = P(side + ' patella')
    kc = J['knee_' + s]; zb = fem[:, 2].min(); tp = tib[:, 2].max()
    lat_c = np.array([kc[0] + sg * 14, kc[1] + 8, zb + 10]); med_c = np.array([kc[0] - sg * 14, kc[1] + 6, zb + 10])
    tib_ant = np.array([kc[0] - sg * 4, kc[1] - 8, tp - 4]); tib_post = np.array([kc[0], kc[1] + 16, tp - 8])
    epi_m = np.array([kc[0] - sg * 42, kc[1], kc[2] + 8]); epi_l = np.array([kc[0] + sg * 40, kc[1] + 2, kc[2] + 8])
    tib_med = np.array([kc[0] - sg * 36, kc[1] - 4, tp - 55]); fh = fib[fib[:, 2] > fib[:, 2].max() - 10].mean(0)
    pz = pat[:, 2].min(); apex = pat[pat[:, 2] < pz + 6].mean(0)
    tt = tib[(tib[:, 2] < tp - 40) & (tib[:, 2] > tp - 70)]; tub = tt[tt[:, 1].argmin()]
    for nm, a, b, r, key in [('anterior cruciate ligament', lat_c, tib_ant, 4.5, 'acl'), ('posterior cruciate ligament', med_c, tib_post, 5, 'pcl'),
                             ('medial collateral ligament', epi_m, tib_med, 4, 'mcl'), ('lateral collateral ligament', epi_l, fh, 3, 'lcl'), ('patellar ligament', apex, tub, 6, 'patellar_tendon')]:
        V, F, R_, S_ = tube(a, b, r)
        frac = np.repeat(np.arange(R_ + 1) / R_, S_)
        top = 'hip_' + s; bot = 'knee_' + s
        si = np.tile(np.array([JI[top], JI[bot], 0, 0], np.uint8), (len(V), 1)); sw = np.c_[1 - frac, frac, np.zeros(len(V)), np.zeros(len(V))]
        if key == 'patellar_tendon': sw = np.c_[0.45 * (1 - frac), 1 - 0.45 * (1 - frac), np.zeros(len(V)), np.zeros(len(V))]
        add(side + ' ' + nm, 'Ligament', 'conn', V, F, si, sw, key)
    tal = P(side + ' talus'); lmall = fib[fib[:, 2] < fib[:, 2].min() + 10].mean(0)
    neck = tal[tal[:, 1].argmin()] + np.array([sg * 8, 6, -2])
    V, F, R_, S_ = tube(lmall + np.array([0, -6, 4]), neck, 3)
    frac = np.repeat(np.arange(R_ + 1) / R_, S_)
    si = np.tile(np.array([JI['knee_' + s], JI['ankle_' + s], 0, 0], np.uint8), (len(V), 1)); sw = np.c_[1 - frac, frac, np.zeros(len(V)), np.zeros(len(V))]
    add(side + ' anterior talofibular ligament', 'Ligament', 'conn', V, F, si, sw, 'atfl')

# ---------- foot and ankle landmarks for Player 1 (approximate, labelled) ----------
def band(pts, wid, thk, up=(0, 0, 1.0), segs=16, normals=None):
    # flattened tube along a path; width lies along the bone surface when surface normals are given, parallel-transported otherwise
    pts = np.asarray(pts, float); n = len(pts); wid = np.broadcast_to(np.asarray(wid, float), (n,)); up = np.asarray(up, float)
    T = np.array([pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)] for i in range(n)]); T /= np.linalg.norm(T, axis=1, keepdims=True) + 1e-9
    V = []; nv = None
    for i in range(n):
        t = T[i]
        if normals is not None:
            nv = normals[i] - t * np.dot(normals[i], t); nv /= np.linalg.norm(nv) + 1e-9
        elif nv is None:
            nv = np.cross(np.cross(t, up), t); nv = nv if np.linalg.norm(nv) > 1e-3 else np.cross(t, [1.0, 0, 0]); nv /= np.linalg.norm(nv)
        else:
            nv = nv - t * np.dot(nv, t); nv /= np.linalg.norm(nv) + 1e-9
        sv = np.cross(t, nv); sv /= np.linalg.norm(sv) + 1e-9
        taper = 0.55 + 0.45 * np.sin(np.pi * (0.08 + 0.84 * i / (n - 1)))
        for k in range(segs):
            th = 2 * np.pi * k / segs; c, s_ = np.cos(th), np.sin(th)
            V.append(pts[i] + sv * c * wid[i] / 2 * taper + nv * np.sign(s_) * abs(s_) ** 0.7 * thk / 2 * (0.6 + 0.4 * taper))
    F = []
    for i in range(n - 1):
        for k in range(segs):
            p0 = i * segs + k; p1 = i * segs + (k + 1) % segs; F += [[p0, p0 + segs, p1], [p1, p0 + segs, p1 + segs]]
    return np.array(V), np.array(F), n, segs
def smooth_path(P_, k=4):
    P_ = np.asarray(P_, float).copy()
    for _ in range(k): P_[1:-1] = (P_[:-2] + 2 * P_[1:-1] + P_[2:]) / 4.0
    return P_
def bez(a, c, b, n=12):
    t = np.linspace(0, 1, n)[:, None]; return (1 - t) ** 2 * a + 2 * (1 - t) * t * c + t ** 2 * b
def cat(P_, n=16):
    P_ = [np.asarray(p, float) for p in P_]; P_ = [P_[0]] + P_ + [P_[-1]]; out = []
    for i in range(1, len(P_) - 2):
        p0, p1, p2, p3 = P_[i - 1], P_[i], P_[i + 1], P_[i + 2]
        for t in np.linspace(0, 1, n, endpoint=False):
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P_[-2]); return np.array(out)
def hug(path, tree, pts, off):
    # lay a ligament path onto the bone surface; returns the path and the outward surface normals along it
    path = np.asarray(path, float).copy()
    for _ in range(4):
        d, i = tree.query(path); q = pts[i]; v = path - q; nrm = v / (np.linalg.norm(v, axis=1, keepdims=True) + 1e-9)
        path = q + nrm * off
        path = smooth_path(path, 2)
    d, i = tree.query(path); nrm = path - pts[i]; nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-9
    avg = nrm.mean(0); avg /= np.linalg.norm(avg) + 1e-9
    nrm = np.tile(avg, (len(path), 1))  # one plane per ligament: flat, untwisted, clean
    return path, nrm
def skin_const(V, j):
    return np.tile(np.array([JI[j], 0, 0, 0], np.uint8), (len(V), 1)), np.tile([1.0, 0, 0, 0], (len(V), 1))
def skin_grad(V, R_, S_, a, b):
    frac = np.repeat(np.arange(R_) / max(R_ - 1, 1), S_)
    return np.tile(np.array([JI[a], JI[b], 0, 0], np.uint8), (len(V), 1)), np.c_[1 - frac, frac, np.zeros(len(V)), np.zeros(len(V))]
for s, side in ([] if ZAN else [('R', 'right'), ('L', 'left')]):
    m = 1 if s == 'R' else -1  # +x is medial for the right foot
    cal = P(side + ' calcaneus'); nav = P('navicular bone of ' + side + ' foot'); tal = P(side + ' talus'); tib = P(side + ' tibia')
    up_ = cal[(cal[:, 2] > np.percentile(cal[:, 2], 55)) & (cal[:, 1] < np.percentile(cal[:, 1], 50))]
    sust = up_[(up_[:, 0] * m) > np.percentile(up_[:, 0] * m, 94)].mean(0)
    nl = nav[nav[:, 2] < np.percentile(nav[:, 2], 30)]; navp = nl[(nl[:, 0] * m) > np.percentile(nl[:, 0] * m, 75)].mean(0)
    navt = nav[(nav[:, 0] * m) > np.percentile(nav[:, 0] * m, 95)].mean(0)
    th = tal[tal[:, 1] < np.percentile(tal[:, 1], 15)]; thd = th[th[:, 2] < np.percentile(th[:, 2], 12)].mean(0) + np.array([m * 2, 0, -2.5])
    hb = np.vstack([tal, cal, nav]); htree = cKDTree(hb)
    # spring ligament: a hammock from the sustentaculum tali to the plantar navicular, slung under the talar head
    hp, hn = hug(bez(sust, thd, navp, 22), htree, hb, 2.6)
    V, F, R_, S_ = band(hp, np.r_[np.linspace(11, 16, 11), np.linspace(16, 12, 11)], 3.0, normals=hn)
    si, sw = skin_const(V, 'ankle_' + s); add(side + ' spring ligament (plantar calcaneonavicular)', 'Ligament', 'conn', V, F, si, sw, 'spring_ligament')
    # deltoid ligament: fan from the medial malleolus
    lowt = tib[tib[:, 2] < tib[:, 2].min() + 8]; mtip = lowt[(lowt[:, 0] * m) > np.percentile(lowt[:, 0] * m, 60)].mean(0)
    tmed = tal[(tal[:, 0] * m) > np.percentile(tal[:, 0] * m, 95)]; tpost = tmed[tmed[:, 1] > np.median(tmed[:, 1])].mean(0)
    for nm, tgt, w in [('tibionavicular', navt, 8), ('tibiocalcaneal', sust, 9), ('posterior tibiotalar', tpost, 9)]:
        db = np.vstack([tib, tal, nav, cal]); dtree = cKDTree(db)
        hp, hn = hug(bez(mtip, (mtip + tgt) / 2 + np.array([m * 3, 0, 0]), tgt, 18), dtree, db, 1.9)
        V, F, R_, S_ = band(hp, np.linspace(w + 3, w - 1, 18), 1.6, normals=hn)
        si, sw = skin_grad(V, R_, S_, 'knee_' + s, 'ankle_' + s); add(side + ' deltoid ligament, ' + nm + ' part', 'Ligament', 'conn', V, F, si, sw, 'deltoid_ligament')
    # plantar fascia: calcaneal tuberosity to the five metatarsal heads
    tub = cal[(cal[:, 1] > np.percentile(cal[:, 1], 90)) & (cal[:, 2] < np.percentile(cal[:, 2], 22))].mean(0) + np.array([m * 4, 0, -3])
    heads = []
    for k in ['first', 'second', 'third', 'fourth', 'fifth']:
        mt = P(side + ' ' + k + ' metatarsal bone'); hd = mt[mt[:, 1] < np.percentile(mt[:, 1], 10)]
        heads.append(np.array([hd[:, 0].mean(), hd[:, 1].mean(), hd[:, 2].min() - 3]))
    heads = np.array(heads); mid = tub + (heads.mean(0) - tub) * 0.45; mid[2] = min(mid[2], tub[2] + 6)
    V, F, R_, S_ = band(bez(tub, (tub + mid) / 2 + np.array([0, 0, -2]), mid, 8), np.linspace(16, 26, 8), 1.8)
    si, sw = skin_const(V, 'ankle_' + s); add(side + ' plantar fascia (plantar aponeurosis), central band', 'Ligament', 'conn', V, F, si, sw, 'plantar_fascia')
    for k, hd in enumerate(heads):
        V, F, R_, S_ = band(bez(mid, (mid + hd) / 2 + np.array([0, 0, -1.5]), hd, 8), 6.0, 1.5)
        si, sw = skin_const(V, 'ankle_' + s); add(side + ' plantar fascia, digital slip ' + str(k + 1), 'Ligament', 'conn', V, F, si, sw, 'plantar_fascia')
    # tibialis posterior tendon: behind the medial malleolus to the navicular tuberosity
    bt = tib[(tib[:, 2] > tib[:, 2].min() + 6) & (tib[:, 2] < tib[:, 2].min() + 40)]; bt = bt[(bt[:, 0] * m) > np.percentile(bt[:, 0] * m, 85)]
    behind = bt[bt[:, 1] > np.percentile(bt[:, 1], 80)].mean(0) + np.array([0, 5, 0])
    p0 = behind + np.array([-m * 4, 6, 45]); p2 = mtip + np.array([m * 2, 9, -9]); p3 = navt + np.array([m * 2, 2, -2])
    tb = np.vstack([tib, tal, nav]); ttree = cKDTree(tb)
    path = smooth_path(cat([p0, behind, p2, p3], 10), 6); hp, hn = hug(path[6:], ttree, tb, 3.0); path = smooth_path(np.r_[path[:6], hp], 4)
    V, F, R_, S_ = band(path, 5.0, 3.6, up=(m * 1.0, 0, 0))
    si, sw = skin_grad(V, R_, S_, 'knee_' + s, 'ankle_' + s); add(side + ' tibialis posterior tendon', 'Tendon', 'conn', V, F, si, sw, 'tib_post_tendon')

POSa = np.vstack(POS); SIa = np.vstack(SI).astype(np.uint8); SWa = np.vstack(SW)
SWq = np.round(SWa * 255).astype(np.int32); diff = 255 - SWq.sum(1); SWq[np.arange(len(SWq)), SWa.argmax(1)] += diff; SWq = SWq.astype(np.uint8)
IDXa = np.concatenate([f.ravel() for f in IDX]).astype(np.uint32)
SCALE = 4000.0  # 0.25 mm units
Q = np.round(POSa * SCALE).astype(np.int16)
joints = {j: (to_world(J[j][None])[0]).round(5).tolist() for j in JOINTS}
meta = {'credit': 'Z-Anatomy, the libre 3D atlas of anatomy (CC BY-SA 4.0), built on BodyParts3D (c) Life Science Integrated Database Center (CC BY-SA 2.1 Japan).' if ZAN else 'BodyParts3D, (c) 2008 Life Science Integrated Database Center, CC BY-SA 2.1 Japan. Knee ligaments, ATFL, spring ligament, deltoid ligament, plantar fascia and tibialis posterior tendon added as approximate landmark models.',
        'scale': SCALE, 'nv': int(len(Q)), 'ni': int(len(IDXa)), 'joints': JOINTS, 'parent': [PARENT[j] for j in JOINTS], 'jointPos': [joints[j] for j in JOINTS], 'structs': structs}
js = json.dumps(meta, separators=(',', ':')).encode()
pad = (4 - (4 + len(js)) % 4) % 4; js += b' ' * pad
blob = struct.pack('<I', len(js)) + js + Q.tobytes() + SIa.tobytes() + SWq.tobytes() + IDXa.tobytes()
with gzip.open(OUT + 'anatomy6.bin.gz', 'wb', 9) as f: f.write(blob)
print('structs', len(structs), 'verts', len(Q), 'tris', len(IDXa) // 3, 'raw MB', round(len(blob) / 1e6, 2), 'gz MB', round(os.path.getsize(OUT + 'anatomy6.bin.gz') / 1e6, 2))
from collections import Counter
print(Counter(s['layer'] for s in structs))
print('mapped keys', len({s['key'] for s in structs if s['key']}))
