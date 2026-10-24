"""Local end-to-end helper: API on :8011 (memory store) and the built frontend on :8012, with throwaway test accounts.
Prints one JSON line with the generated passwords. Used by tests/sync_e2e.mjs only."""
import asyncio, json, os, secrets, sys, threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ["PLOS_NO_AUTOAPP"] = "1"
import uvicorn
from core.security import Keys, gen_field_key, hash_password
from core.store import MemoryStore
from server import create_app

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
store, pw = MemoryStore(), {}
EMPTY = os.environ.get("PLOS_E2E_EMPTY") == "1"   # first-run test: no accounts, set-up key on
API_PORT, WEB_PORT = (8021, 8022) if EMPTY else (8011, 8012)
if EMPTY:
    pw["setup_token"] = os.environ["SETUP_TOKEN"] = secrets.token_urlsafe(40)
for email, role, person, p1 in [] if EMPTY else [("jp@lab.test", "lead", "jp", True), ("javi@lab.test", "coach", "javi", False)]:
    pw[email] = secrets.token_urlsafe(12)
    asyncio.run(store.add_user({"email": email, "role": role, "person": person, "p1": p1, "password_hash": hash_password(pw[email])}))
# wearable providers are faked (no network); same fake as tests/test_wear.py
import httpx
from tests.test_wear import FakeProviders
os.environ.update({"OURA_CLIENT_ID": "e2e-oura", "OURA_CLIENT_SECRET": secrets.token_urlsafe(16), "PUBLIC_API_URL": f"http://localhost:{API_PORT}", "APP_URL": f"http://localhost:{WEB_PORT}"})
app = create_app(store, Keys(secrets.token_urlsafe(40), gen_field_key()), [f"http://localhost:{WEB_PORT}"], http=httpx.AsyncClient(transport=httpx.MockTransport(FakeProviders())))
page = open(os.path.join(ROOT, "frontend", "public", "index.html")).read().replace("%REACT_APP_BACKEND_URL%", f"http://localhost:{API_PORT}")
static = os.path.join(ROOT, "dist", "_e2e_first" if EMPTY else "_e2e"); os.makedirs(static, exist_ok=True)
open(os.path.join(static, "index.html"), "w").write(page)
threading.Thread(target=ThreadingHTTPServer(("127.0.0.1", WEB_PORT), partial(SimpleHTTPRequestHandler, directory=static)).serve_forever, daemon=True).start()


async def peek():
    while True:
        await asyncio.sleep(0.5)
        open(os.path.join(static, "server_state.json"), "w").write(json.dumps({f"{s}|{k}": sorted(v.keys()) for (s, k), v in store.state.items()}))
print(json.dumps(pw), flush=True)
config = uvicorn.Config(app, host="127.0.0.1", port=API_PORT, log_level="warning")
server = uvicorn.Server(config)
async def main():
    asyncio.create_task(peek()); await server.serve()
asyncio.run(main())
