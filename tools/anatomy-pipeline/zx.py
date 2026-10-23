import numpy as np, struct, re, json, sys
from blend import Blend
B = Blend(__import__('os').environ.get('ZAN_BLEND', '/tmp/zan/Z-Anatomy/Startup.blend'))
CD_MPOLY, CD_MLOOP = 25, 26
def layers(me, cd):
    off = B.fields('Mesh')[cd][0]; blkoff = me['off'] + off
    lp, = struct.unpack_from('<Q', B.buf, blkoff + B.fields('CustomData')['layers'][0]); tot, = struct.unpack_from('<i', B.buf, blkoff + B.fields('CustomData')['totlayer'][0])
    out = []
    lb = B.near(lp, me)
    if not lb: return out
    for i in range(tot):
        out.append({'type': B.get(lb, 'CustomDataLayer', 'type', i), 'name': B.get(lb, 'CustomDataLayer', 'name', i), 'data': B.get(lb, 'CustomDataLayer', 'data', i)})
    return out
def mesh(me):
    nv, np_, nl = B.get(me, 'Mesh', 'totvert'), B.get(me, 'Mesh', 'totpoly'), B.get(me, 'Mesh', 'totloop')
    V = None
    for L in layers(me, 'vdata'):
        blk = B.near(L['data'], me)
        if not blk or L['type'] not in (0, 48) or blk['count'] == 0: continue
        cnt = blk['count']; st = blk['size'] // cnt
        if L['type'] == 48 and L['name'] != 'position': continue
        if st == 12: V = np.frombuffer(B.buf, '<f4', cnt * 3, blk['off']).reshape(-1, 3).copy()
        elif st >= 12 and V is None: V = np.frombuffer(B.buf, np.uint8, cnt * st, blk['off']).reshape(cnt, st)[:, :12].copy().view('<f4').reshape(-1, 3)
    P = Lp = None
    for L in layers(me, 'pdata'):
        blk = B.near(L['data'], me)
        if blk and B.sname(blk) == 'MPoly':
            st = B.tlen[B.types.index('MPoly')]; cnt = blk['count']; st = blk['size'] // cnt; raw = np.frombuffer(B.buf, np.uint8, cnt * st, blk['off']).reshape(cnt, st); P = raw[:, :8].copy().view('<i4').reshape(-1, 2)
    for L in layers(me, 'ldata'):
        blk = B.near(L['data'], me)
        if blk and B.sname(blk) == 'MLoop':
            cnt = blk['count']; st = blk['size'] // cnt; Lp = np.frombuffer(B.buf, np.uint8, cnt * st, blk['off']).reshape(cnt, st)[:, :4].copy().view('<u4').ravel()
    return V, P, Lp
if __name__ == '__main__':
    obs = [b for b in B.blocks if b['code'] == 'OB']
    rows = []
    for ob in obs:
        if B.get(ob, 'Object', 'type') != 1: continue
        name = B.get(ob, 'ID', 'name') if False else None
        rows.append(ob)
    print('mesh objects', len(rows))
    idf = B.fields('Object')['id'][0]
    def idname(blk): return B.buf[blk['off'] + B.fields('ID')['name'][0]: blk['off'] + B.fields('ID')['name'][0] + 66].split(b'\0')[0].decode('latin1')
    names = [idname(o)[2:] for o in rows]
    print(names[:40]); print([n for n in names if re.search('calcaneonav|spring|deltoid lig|plantar apon|tibialis post', n, re.I)][:20])
    me = B.byptr[B.get(rows[0], 'Object', 'data')]; V, P, L = mesh(me); print(idname(me), None if V is None else V.shape, None if P is None else P.shape, None if L is None else L.shape)

def idname(blk):
    o = blk['off'] + B.fields('ID')['name'][0]; return B.buf[o:o + 66].split(b'\0')[0].decode('latin1')
def collections():
    out = {}
    lb_off = B.fields('Collection')['gobject'][0]; ch_off = B.fields('Collection')['children'][0]
    for g in [b for b in B.blocks if b['code'] == 'GR']:
        name = idname(g)[2:]
        first, = struct.unpack_from('<Q', B.buf, g['off'] + lb_off)
        obs = []; p = first; guard = 0; prev = g
        while p and guard < 100000:
            co = B.near(p, prev) or B.byptr.get(p)
            if not co: break
            obp = B.get(co, 'CollectionObject', 'ob'); obs.append(obp)
            p = B.get(co, 'CollectionObject', 'next'); prev = co; guard += 1
        kids = []; p, = struct.unpack_from('<Q', B.buf, g['off'] + ch_off); prev = g; guard = 0
        while p and guard < 10000:
            cc = B.near(p, prev) or B.byptr.get(p)
            if not cc: break
            kids.append(B.get(cc, 'CollectionChild', 'collection')); p = B.get(cc, 'CollectionChild', 'next'); prev = cc; guard += 1
        out[g['ptr']] = {'name': name, 'obs': obs, 'kids': kids}
    return out
