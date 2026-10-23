"""Apply Blender Subdivision Surface (Catmull-Clark) and Solidify to polygon meshes, in numpy."""
import numpy as np
def edges_of(st, ct, L):
    # corner -> next corner within its face
    nf = len(st); fid = np.repeat(np.arange(nf), ct); pos = np.arange(len(L)) - np.repeat(st, ct)
    nxt = np.repeat(st, ct) + (pos + 1) % np.repeat(ct, ct)
    a, b = L, L[nxt]; key = np.minimum(a, b).astype(np.int64) * (1 << 32) + np.maximum(a, b)
    uk, einv = np.unique(key, return_inverse=True)
    E = np.stack([uk >> 32, uk & 0xffffffff], 1)
    return fid, nxt, E, einv.ravel()
def catmull(V, st, ct, L):
    nv = len(V); nf = len(st)
    fid, nxt, E, ce = edges_of(st, ct, L)
    FP = np.zeros((nf, 3)); np.add.at(FP, fid, V[L]); FP /= ct[:, None]
    ne = len(E); efc = np.zeros(ne); np.add.at(efc, ce, 1); efs = np.zeros((ne, 3)); np.add.at(efs, ce, FP[fid])
    mid = (V[E[:, 0]] + V[E[:, 1]]) / 2; bnd = efc < 2
    EP = np.where(bnd[:, None], mid, (V[E[:, 0]] + V[E[:, 1]] + efs / np.maximum(efc, 1)[:, None]) / (2 + np.maximum(efc, 1)[:, None]) * 1.0)
    EP[~bnd] = (V[E[~bnd, 0]] + V[E[~bnd, 1]] + efs[~bnd] / efc[~bnd, None] * 2) / 4  # (v0+v1+fa+fb)/4
    # vertex update
    val = np.zeros(nv); np.add.at(val, E[:, 0], 1); np.add.at(val, E[:, 1], 1)
    Fs = np.zeros((nv, 3)); fcount = np.zeros(nv); np.add.at(Fs, L, FP[fid]); np.add.at(fcount, L, 1)
    Rs = np.zeros((nv, 3)); np.add.at(Rs, E[:, 0], mid); np.add.at(Rs, E[:, 1], mid)
    isb = np.zeros(nv, bool); isb[E[bnd, 0]] = True; isb[E[bnd, 1]] = True
    n = np.maximum(val, 1)[:, None]
    NV = (Fs / np.maximum(fcount, 1)[:, None] + 2 * Rs / n + (n - 3) * V) / n
    Bs = np.zeros((nv, 3)); np.add.at(Bs, E[bnd, 0], V[E[bnd, 1]]); np.add.at(Bs, E[bnd, 1], V[E[bnd, 0]])
    NV[isb] = 0.75 * V[isb] + 0.125 * Bs[isb]
    lone = fcount == 0; NV[lone] = V[lone]
    OUT = np.vstack([NV, EP, FP]); eo = nv; fo = nv + ne
    prv = np.repeat(st, ct) + (np.arange(len(L)) - np.repeat(st, ct) - 1) % np.repeat(ct, ct)
    # corner c: quad [v_c, edge(c->next), face, edge(prev->c)]
    eprev = ce[prv]
    Q = np.stack([L, eo + ce, fo + fid, eo + eprev], 1)
    return OUT, np.zeros(len(Q), np.int64) + 0, Q
def quads_to_poly(Q):
    st = np.arange(len(Q)) * 4; ct = np.full(len(Q), 4); return st, ct, Q.ravel()
def tri(st, ct, L):
    tris = []
    for k in range(3, ct.max() + 1):
        sel = ct == k
        if not sel.any(): continue
        s0 = st[sel]
        for j in range(1, k - 1): tris.append(np.stack([L[s0], L[s0 + j], L[s0 + j + 1]], 1))
    return np.concatenate(tris).astype(np.int64)
def normals(V, F):
    n = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]]); N = np.zeros_like(V)
    for k in range(3): np.add.at(N, F[:, k], n)
    return N / (np.linalg.norm(N, axis=1, keepdims=True) + 1e-12)
def solidify(V, st, ct, L, thick, fac):
    F = tri(st, ct, L); N = normals(V, F)
    out = V + N * thick * (fac + 1) / 2; inn = V - N * thick * (1 - fac) / 2
    nv = len(V); V2 = np.vstack([out, inn])
    F2 = [F, F[:, ::-1] + nv]
    fid, nxt, E, ce = edges_of(st, ct, L)
    cnt = np.zeros(len(E)); np.add.at(cnt, ce, 1)
    # boundary edges in face order (from corners whose edge is boundary)
    bc = np.where(cnt[ce] == 1)[0]
    a, b = L[bc], L[nxt[bc]]
    F2.append(np.stack([a, b, b + nv], 1)); F2.append(np.stack([a, b + nv, a + nv], 1))
    return V2, np.concatenate(F2)
def apply(V, P, L, mods):
    st, ct, L = P[:, 0].copy(), P[:, 1].copy(), L.astype(np.int64)
    F = None
    for m in mods:
        if m[0] == 'sub':
            for _ in range(min(max(m[1], 0), 3)):
                V, _, Q = catmull(V, st, ct, L); st, ct, L = quads_to_poly(Q)
        elif m[0] == 'sol':
            V, F = solidify(V, st, ct, L, m[1], m[2])
            # continue as triangles: polygons from triangles
            st = np.arange(len(F)) * 3; ct = np.full(len(F), 3); L = F.ravel()
    return V, tri(st, ct, L)
