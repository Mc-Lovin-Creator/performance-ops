"""Export Z-Anatomy (CC BY-SA 4.0, built on BodyParts3D) bones, joints/ligaments and muscles into a parts pickle in BodyParts3D-style millimetres."""
import zx, numpy as np, pickle, re, collections as co, struct, mods as MODS
from zx import B, idname
C = zx.collections()
roots = {v['name']: v for v in C.values() if v['name'][:1].isdigit()}
obblk = {b['ptr']: b for b in B.blocks if b['code'] == 'OB'}
def mesh_of(ob):
    L = [b for b in B.multi.get(B.get(ob, 'Object', 'data'), []) if b['code'] == 'ME']; return L[0] if L else None
parts = []; skipped = co.Counter()
moff = B.fields('Object')['modifiers'][0]
def modstack(ob):
    out = []; p, = struct.unpack_from('<Q', B.buf, ob['off'] + moff); prev = ob
    while p:
        md = B.near(p, prev) or B.byptr.get(p)
        if not md: break
        sn = B.sname(md); mode = B.get(md, 'ModifierData', 'mode')
        if sn == 'SubsurfModifierData':
            lv = B.get(md, 'SubsurfModifierData', 'levels'); rl = B.get(md, 'SubsurfModifierData', 'renderLevels'); out.append(('sub', min(2, max(lv, rl, 1))))
        elif sn == 'SolidifyModifierData':
            out.append(('sol', B.get(md, 'SolidifyModifierData', 'offset'), B.get(md, 'SolidifyModifierData', 'offset_fac')))
        elif sn in ('HookModifierData',): pass
        else: out.append(('bad', sn))
        p = B.get(md, 'ModifierData', 'next'); prev = md
    return out
for sysname, kind in [('1: Skeletal system', 'bone'), ('3: Joints', 'joint'), ('4: Muscular system', 'muscle')]:
    for p in roots[sysname]['obs']:
        ob = obblk.get(p)
        if not ob or B.get(ob, 'Object', 'type') != 1: continue
        n = idname(ob)[2:]
        suf = n.rsplit('.', 1)[1] if '.' in n else ''
        if suf not in ('l', 'r', '') or n.startswith('('): skipped[suf or 'paren'] += 1; continue
        me = mesh_of(ob)
        if not me: continue
        V, P, L = zx.mesh(me)
        if V is None or P is None or L is None or len(P) < 1 or L.max() >= len(V): skipped['nomesh'] += 1; continue
        ms = modstack(ob)
        if any(m[0] == 'bad' for m in ms): skipped['mod:' + [m[1] for m in ms if m[0] == 'bad'][0]] += 1; continue
        if len(P) < 8 and not ms: skipped['tiny'] += 1; continue
        envelope = bool(re.search(r'fascia|septum|sheath|bursa|epicranial|galea|fat pad|adipose|synovial membrane|joint capsule|fibrous membrane', n.lower()) and 'aponeurosis' not in n.lower().replace('epicranial aponeurosis', ''))
        if envelope and re.search(r'fat pad|adipose|synovial membrane', n.lower()): skipped['fat'] += 1; continue
        V, F = MODS.apply(V.astype(float), P, L, ms)
        M = np.array(B.get(ob, 'Object', 'obmat'), float).reshape(4, 4).T
        W = (np.c_[V, np.ones(len(V))] @ M.T)[:, :3]
        base = n.rsplit('.', 1)[0] if suf else n
        side = {'l': 'left ', 'r': 'right ', '': ''}[suf]
        k2 = kind
        low = base.lower()
        if kind == 'joint': k2 = 'cart' if re.search(r'cartilage|disc|meniscus|labrum|symphysis', low) else 'conn'
        if kind == 'muscle' and re.search(r'tendon|aponeurosis|retinaculum|fascia|sheath|linea alba|tendinous', low): k2 = 'conn'
        if kind == 'bone' and re.search(r'cartilage', low): k2 = 'cart'
        if envelope: k2 = 'fascia'
        parts.append({'name': side + low, 'kind': {'bone': 'bone', 'muscle': 'muscle'}.get(k2, k2), 'V': W * 1000.0, 'F': F, 'label': base})
print('parts', len(parts), 'skipped', dict(skipped), 'verts', sum(len(p['V']) for p in parts))
print(co.Counter(p['kind'] for p in parts))
xs = {p['name']: p['V'][:, 0].mean() for p in parts}
print('femur x', {k: round(v) for k, v in xs.items() if 'femur' in k})
print([p['name'] for p in parts if re.search('calcaneonav|cruciate|plantar apon|tibialis post|deltoid lig|medial lig', p['name'])][:20])
pickle.dump(parts, open('/tmp/zan_parts6.pkl', 'wb'))
