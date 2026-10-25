"""Build the single-page app from app/src.

  python app/build.py            -> dist/performance-lab.html  (standalone demo, data stays on the device)
                                  -> frontend/public/index.html (production: signs in to the backend via REACT_APP_BACKEND_URL)
Modules are concatenated in a fixed order inside one closure (see ORDER); the 3D engine is an ES module.
"""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "app" / "src"
ASSETS = ROOT / "app" / "assets"
# modules inserted, in order, where app.js marks /* ---------- search ---------- */
ORDER = ["anatdb", "return", "hub", "p1hub", "team", "anatui", "edudata", "norms", "anatdb2", "anatdb3", "edu", "agents", "cinema", "p1load", "docread", "vault", "ops", "squad", "audit",
         "members", "labs", "book", "story", "fascia3d", "motion", "explainers", "focus", "consent", "opencap", "wear", "pilot", "sync"]
MARK = "/* ---------- search ---------- */"


def read(name):
    return (SRC / name).read_text(encoding="utf-8")


def build() -> str:
    app = read("app.js")
    assert MARK in app, "search marker missing in app.js"
    inserted = "\n".join(read(m + ".js") for m in ORDER)
    app = app.replace(MARK, inserted + "\n" + MARK, 1)
    return (read("shell.html") + "\n<script>\n" + read("data.js") + "\n" + read("topo.js") + "\nwindow.TOPO = TOPO;\n" + app + "\n</script>\n<script>\n"
            + read("lightwarp.js") + "\n" + read("hx.js") + "\n" + read("hxslider.js") + "\n</script>\n<script type=\"module\">\n" + read("anatomy2.js") + "\n</script>\n")


def main():
    page = build()
    dist = ROOT / "dist"
    dist.mkdir(exist_ok=True)
    (dist / "performance-lab.html").write_text(page, encoding="utf-8")
    pub = ROOT / "frontend" / "public"
    pub.mkdir(parents=True, exist_ok=True)
    head = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            '<meta name="robots" content="noindex,nofollow"><title>Performance Ops</title>'
            '<link rel="manifest" href="manifest.webmanifest"><meta name="theme-color" content="#0b0d12">'
            '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">'
            '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Performance Ops">'
            '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' \'unsafe-inline\' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; '
            'worker-src \'self\' blob:; style-src \'self\' \'unsafe-inline\' https://fonts.googleapis.com; font-src \'self\' https://fonts.gstatic.com data:; '
            'img-src \'self\' data: blob:; media-src \'self\' blob: data:; connect-src \'self\' %REACT_APP_BACKEND_URL% https://cdnjs.cloudflare.com https://cdn.jsdelivr.net '
            'https://eutils.ncbi.nlm.nih.gov https://www.ebi.ac.uk; object-src \'none\'; base-uri \'none\'; form-action \'self\'">'
            '<link rel="apple-touch-icon" href="icon-180.png"><link rel="icon" type="image/png" href="icon-192.png"><script>window.PLOS_API="%REACT_APP_BACKEND_URL%";</script></head><body>')
    (pub / "index.html").write_text(head + page + "</body></html>", encoding="utf-8")
    for f in (ASSETS / "pwa").glob("*"):   # installable on phones (home-screen icon, full screen); no service worker, so nothing clinical is cached offline
        shutil.copy(f, pub / f.name)
    for f in ASSETS.glob("*.txt"):
        shutil.copy(f, pub / f.name)
        shutil.copy(f, dist / f.name)
    print(f"built {len(page):,} characters -> dist/ and frontend/public/")


if __name__ == "__main__":
    main()
