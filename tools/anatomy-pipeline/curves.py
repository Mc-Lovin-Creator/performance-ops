"""Z-Anatomy curve objects (vessels, nerves) -> tube meshes; plus mesh objects of the cardiovascular, nervous, visceral and insertion systems."""
import zx, numpy as np, struct, re, collections as co, pickle, sys
from zx import B, idname
C = zx.collections(); roots = {v['name']: v for v in C.values() if v['name'][:1].isdigit()}
obblk = {b['ptr']: b for b in B.blocks if b['code'] == 'OB'}
nb_list_off = B.fields('Curve')['nurb'][0]
def data_blk(ob, code):
    L = [b for b in B.multi.get(B.get(ob, 'Object', 'data'), []) if b['code'] == code]; return L[0] if L else None
def nurbs(cu):
    out = []; p, = struct.unpack_from('<Q', B.buf, cu['off'] + nb_list_off); prev = cu; g = 0
    while p and g < 5000:
        nb = B.near(p, prev) or B.byptr.get(p)
        if not nb or B.sname(nb) != 'Nurb': break
        out.append(nb); p = B.get(nb, 'Nurb', 'next'); prev = nb; g += 1
    return out
def bez(p0, h0, h1, p1, n):
    t = np.linspace(0, 1, n, endpoint=False)[:, None]
    return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * h0 + 3 * (1 - t) * t ** 2 * h1 + t ** 3 * p1
def chaikin(P, R, it=2):
    for _ in range(it):
        if len(P) < 3: break
        Q = 0.75 * P[:-1] + 0.25 * P[1:]; S = 0.25 * P[:-1] + 0.75 * P[1:]
        P2 = np.empty((len(Q) * 2, 3)); P2[0::2] = Q; P2[1::2] = S; P2 = np.vstack([P[:1], P2, P[-1:]])
        RQ = 0.75 * R[:-1] + 0.25 * R[1:]; RS = 0.25 * R[:-1] + 0.75 * R[1:]
        R2 = np.empty(len(RQ) * 2); R2[0::2] = RQ; R2[1::2] = RS; R = np.concatenate([R[:1], R2, R[-1:]]); P = P2
    return P, R
def polyline(nb):
    bz = B.get(nb, 'Nurb', 'bezt'); bp = B.get(nb, 'Nurb', 'bp'); n = B.get(nb, 'Nurb', 'pntsu'); cyc = B.get(nb, 'Nurb', 'flagu') & 1
    if bz:
        blk = B.near(bz, nb) or B.byptr.get(bz)
        if not blk: return None, None
        st = blk['size'] // max(1, blk['count']); raw = np.frombuffer(B.buf, np.uint8, blk['count'] * st, blk['off']).reshape(blk['count'], st)
        V = raw[:, :36].copy().view('<f4').reshape(-1, 3, 3).astype(float); R = raw[:, 44:48].copy().view('<f4').ravel().astype(float)
        res = 4; pts = []; rad = []
        segs = len(V) if cyc else len(V) - 1
        for i in range(segs):
            j = (i + 1) % len(V); s = bez(V[i, 1], V[i, 2], V[j, 0], V[j, 1], res); pts.append(s); rad.append(np.linspace(R[i], R[j], res, endpoint=False))
        pts.append(V[-1:, 1] if not cyc else V[:1, 1]); rad.append(R[-1:] if not cyc else R[:1])
        return np.vstack(pts), np.concatenate(rad)
    if bp:
        blk = B.near(bp, nb) or B.byptr.get(bp)
        if not blk: return None, None
        st = blk['size'] // max(1, blk['count']); raw = np.frombuffer(B.buf, np.uint8, blk['count'] * st, blk['off']).reshape(blk['count'], st)
        P = raw[:, :12].copy().view('<f4').reshape(-1, 3).astype(float); R = raw[:, 28:32].copy().view('<f4').ravel().astype(float)
        if B.get(nb, 'Nurb', 'type') == 4: P, R = chaikin(P, R, 2)
        if cyc: P = np.vstack([P, P[:1]]); R = np.concatenate([R, R[:1]])
        return P, R
    return None, None
def tube(P, R, sides):
    keep = np.r_[True, np.linalg.norm(np.diff(P, axis=0), axis=1) > 1e-6]; P, R = P[keep], R[keep]
    if len(P) < 2: return None, None
    T = np.gradient(P, axis=0); T /= np.linalg.norm(T, axis=1, keepdims=True) + 1e-12
    n = np.cross(T[0], [0, 0, 1.0]);
    if np.linalg.norm(n) < 0.1: n = np.cross(T[0], [0, 1.0, 0])
    n /= np.linalg.norm(n); N = [n]
    for i in range(1, len(P)):  # parallel transport frame
        v = N[-1] - T[i] * np.dot(N[-1], T[i]); l = np.linalg.norm(v); N.append(v / l if l > 1e-9 else N[-1])
    N = np.array(N); Bn = np.cross(T, N)
    a = np.linspace(0, 2 * np.pi, sides, endpoint=False)
    V = (P[:, None, :] + R[:, None, None] * (np.cos(a)[None, :, None] * N[:, None, :] + np.sin(a)[None, :, None] * Bn[:, None, :])).reshape(-1, 3)
    F = []
    for i in range(len(P) - 1):
        for k in range(sides):
            a0 = i * sides + k; a1 = i * sides + (k + 1) % sides; b0 = a0 + sides; b1 = a1 + sides; F += [[a0, b0, a1], [a1, b0, b1]]
    # caps
    c0 = len(V); V = np.vstack([V, P[:1], P[-1:]])
    for k in range(sides): F.append([c0, (k + 1) % sides, k]); e = (len(P) - 1) * sides; F.append([c0 + 1, e + k, e + (k + 1) % sides])
    return V, np.array(F)
SYS = [('2: Muscular insertions', 'ins'), ('5: Cardiovascular system', 'cv'), ('7: Nervous system & Sense organs', 'nerve'), ('8: Visceral systems', 'organ')]
parts = []; skip = co.Counter()
for sysname, kind in SYS:
    for p in roots[sysname]['obs']:
        ob = obblk.get(p)
        if not ob: continue
        t = B.get(ob, 'Object', 'type'); n = idname(ob)[2:]
        suf = n.rsplit('.', 1)[1] if '.' in n else ''
        if kind == 'ins':
            m = re.match(r'([oe])(\d*)([lr])$', suf)
            if not m or n.startswith('('): skip['ins-suf'] += 1; continue
            side = {'l': 'left ', 'r': 'right '}[m.group(3)]; base = n.rsplit('.', 1)[0]; role = 'origin' if m.group(1) == 'o' else 'insertion'
        else:
            if suf not in ('l', 'r', '') or n.startswith('('): skip[kind + ':' + (suf or 'paren')] += 1; continue
            side = {'l': 'left ', 'r': 'right ', '': ''}[suf]; base = n.rsplit('.', 1)[0] if suf else n; role = None
        M = np.array(B.get(ob, 'Object', 'obmat'), float).reshape(4, 4).T
        low = base.lower()
        if t == 1:
            me = data_blk(ob, 'ME')
            if not me: skip['nome'] += 1; continue
            V, P_, L = zx.mesh(me)
            if V is None or P_ is None or L is None or len(P_) < 1 or L.max() >= len(V): skip['badmesh'] += 1; continue
            F = []
            for s, c in P_:
                for k in range(1, c - 1): F.append([L[s], L[s + k], L[s + k + 1]])
            F = np.array(F)
        elif t == 2:
            cu = data_blk(ob, 'CU')
            if not cu: skip['nocu'] += 1; continue
            ext2 = B.get(cu, 'Curve', 'ext2')
            if ext2 <= 0: skip['nobevel'] += 1; continue
            VV = []; FF = []; off = 0
            for nb in nurbs(cu):
                P, R = polyline(nb)
                if P is None: continue
                R = np.maximum(R, 0.05) * ext2
                v, f = tube(P, R, 6)
                if v is None: continue
                VV.append(v); FF.append(f + off); off += len(v)
            if not VV: skip['nocurve'] += 1; continue
            V = np.vstack(VV); F = np.vstack(FF)
        else: skip['type%d' % t] += 1; continue
        W = (np.c_[V, np.ones(len(V))] @ M.T)[:, :3]
        k2 = kind
        if kind == 'cv': k2 = 'vein' if re.search(r'vein|venous|sinus|vena', low) else 'artery'
        if kind == 'cv' and re.search(r'heart|atrium|ventricle|valve|cusp|papillary|chordae|trabecul|septum|auricle|pericard', low): k2 = 'organ'
        if kind == 'nerve' and re.search(r'brain|cerebr|cerebell|gyrus|lobe|eye|retina|lens|cornea|ear|cochlea|ventricle|thalamus|pons|medulla|mesenceph|dura|arachnoid|pia|spinal cord|ganglion$', low) and t == 1: k2 = 'neuro'
        parts.append({'name': side + low, 'kind': k2, 'V': W * 1000.0, 'F': F, 'label': base, 'role': role, 'curve': t == 2})
print('parts', len(parts), dict(skip)); print(co.Counter(p['kind'] for p in parts)); print('verts', co.Counter({k: sum(len(p['V']) for p in parts if p['kind'] == k) for k in set(p['kind'] for p in parts)}))
print([p['name'] for p in parts if p['kind'] == 'artery'][:30]); print([p['name'] for p in parts if p['kind'] == 'nerve'][:30])
pickle.dump(parts, open('/tmp/zan_parts2.pkl', 'wb'))
