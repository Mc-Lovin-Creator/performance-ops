import numpy as np, struct, os
def load_stl(path):
    with open(path,'rb') as f: data=f.read()
    if data[:5].lower()==b'solid' and b'facet' in data[:400]:
        txt=data.decode('ascii','ignore').split()
        v=[float(txt[i+1]) for i in range(len(txt)) for _ in [0] if False]
        verts=[]
        it=iter(range(len(txt)))
        for i,t in enumerate(txt):
            if t=='vertex': verts.append((float(txt[i+1]),float(txt[i+2]),float(txt[i+3])))
        tri=np.array(verts,dtype=np.float64).reshape(-1,3,3)
    else:
        n=struct.unpack('<I',data[80:84])[0]
        rec=np.frombuffer(data,dtype=np.dtype([('n','<f4',3),('v','<f4',(3,3)),('a','<u2')]),count=n,offset=84)
        tri=rec['v'].astype(np.float64)
    # weld
    flat=tri.reshape(-1,3)
    key=np.round(flat*1000).astype(np.int64)
    uniq,inv=np.unique(key,axis=0,return_inverse=True)
    V=np.zeros((len(uniq),3)); cnt=np.zeros(len(uniq))
    np.add.at(V,inv.ravel(),flat); np.add.at(cnt,inv.ravel(),1); V/=cnt[:,None]
    F=inv.reshape(-1,3)
    F=F[(F[:,0]!=F[:,1])&(F[:,1]!=F[:,2])&(F[:,0]!=F[:,2])]
    return V,F
