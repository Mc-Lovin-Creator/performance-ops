"""Minimal reader for uncompressed little-endian 64-bit .blend files (enough for meshes and objects)."""
import struct, numpy as np
class Blend:
    def __init__(self, path):
        self.buf = open(path, 'rb').read(); b = self.buf
        assert b[:7] == b'BLENDER' and b[7:8] == b'-' and b[8:9] == b'v'
        self.ver = int(b[9:12]); o = 12; self.blocks = []; self.byptr = {}; self.multi = {}
        while o < len(b):
            code = b[o:o + 4]; size, = struct.unpack_from('<i', b, o + 4); ptr, = struct.unpack_from('<Q', b, o + 8); sdna, cnt = struct.unpack_from('<ii', b, o + 16)
            blk = {'code': code.rstrip(b'\0').decode('latin1'), 'size': size, 'ptr': ptr, 'sdna': sdna, 'count': cnt, 'off': o + 24}
            self.blocks.append(blk)
            blk['i'] = len(self.blocks) - 1
            if ptr: self.byptr[ptr] = blk; self.multi.setdefault(ptr, []).append(blk)
            if code == b'DNA1': self._dna(o + 24)
            if code == b'ENDB': break
            o += 24 + size
    def _dna(self, o):
        b = self.buf; base0 = o; assert b[o:o + 4] == b'SDNA'; o += 4
        al = lambda x: base0 + ((x - base0 + 3) & ~3)
        def sect(tag):
            nonlocal o; assert b[o:o + 4] == tag, (b[o:o + 4], tag); o += 4
        def strings(n):
            nonlocal o; out = []
            for _ in range(n):
                e = b.index(b'\0', o); out.append(b[o:e].decode('latin1')); o = e + 1
            o = al(o); return out
        sect(b'NAME'); n, = struct.unpack_from('<i', b, o); o += 4; self.names = strings(n)
        sect(b'TYPE'); n, = struct.unpack_from('<i', b, o); o += 4; self.types = strings(n)
        sect(b'TLEN'); self.tlen = list(struct.unpack_from('<%dh' % n, b, o)); o += 2 * n; o = al(o)
        sect(b'STRC'); n, = struct.unpack_from('<i', b, o); o += 4; self.structs = []; self.sidx = {}
        for i in range(n):
            t, nf = struct.unpack_from('<hh', b, o); o += 4
            fields = []
            for _ in range(nf):
                ft, fn = struct.unpack_from('<hh', b, o); o += 4; fields.append((self.types[ft], self.names[fn]))
            self.structs.append((self.types[t], fields)); self.sidx[self.types[t]] = i
        self.layout = {}
    def fields(self, sname):
        if sname in self.layout: return self.layout[sname]
        out = {}; off = 0
        for t, n in self.structs[self.sidx[sname]][1]:
            name = n; arr = 1
            base = name.split('[')[0].lstrip('*').strip('()').lstrip('*')
            dims = [int(x) for x in name.replace(']', '').split('[')[1:]] if '[' in name else []
            for d in dims: arr *= d
            if name.startswith('*') or name.startswith('(*'): size = 8 * arr; kind = 'ptr'
            else: size = self.tlen[self.types.index(t)] * arr; kind = t
            out[base] = (off, kind, size, dims, name); off += size
        self.layout[sname] = out; return out
    def get(self, blk, sname, field, i=0):
        f = self.fields(sname)[field]; off, kind, size, dims, _ = f
        base = blk['off'] + i * self.tlen[self.types.index(sname)] + off; b = self.buf
        if kind == 'ptr': return struct.unpack_from('<Q', b, base)[0]
        if kind == 'char': return b[base:base + size].split(b'\0')[0].decode('latin1', 'replace')
        fmt = {'int': 'i', 'float': 'f', 'short': 'h', 'char': 'b', 'double': 'd', 'uint64_t': 'Q', 'int64_t': 'q', 'uint': 'I', 'uchar': 'B'}[kind]
        n = size // struct.calcsize(fmt)
        v = struct.unpack_from('<%d%s' % (n, fmt), b, base)
        return v[0] if n == 1 else v
    def near(self, ptr, after):
        L = self.multi.get(ptr)
        if not L: return None
        for b in L:
            if b['i'] > after['i']: return b
        return L[-1]
    def sname(self, blk): return self.structs[blk['sdna']][0]
    def array(self, ptr, dtype, cols):
        blk = self.byptr.get(ptr)
        if not blk: return None
        a = np.frombuffer(self.buf, dtype, blk['size'] // np.dtype(dtype).itemsize, blk['off'])
        return a.reshape(-1, cols) if cols > 1 else a
