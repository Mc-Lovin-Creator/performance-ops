#!/usr/bin/env python3
"""Create the first lead account on a new server (stage 2). Python standard library only.

  python3 scripts/first_lead.py --api https://<your-app> --email you@yourwork.com

Asks for the set-up key and your new password at hidden prompts; nothing is shown, stored or logged.
Works only while the server has no accounts and SETUP_TOKEN is set. Remove SETUP_TOKEN afterwards.
"""
import argparse
import getpass
import json
import sys
import urllib.error
import urllib.request

ap = argparse.ArgumentParser()
ap.add_argument("--api", required=True)
ap.add_argument("--email", required=True)
ap.add_argument("--person", default="jp", help="your person id in the app (default jp)")
a = ap.parse_args()

tok = getpass.getpass("SETUP_TOKEN (hidden): ").strip()
pw = getpass.getpass("New password, 12+ characters (hidden): ")
if pw != getpass.getpass("Again (hidden): "):
    sys.exit("passwords differ")
body = json.dumps({"email": a.email, "person": a.person, "password": pw, "setup_token": tok}).encode()
del pw, tok
req = urllib.request.Request(a.api.rstrip("/") + "/api/setup/first-lead", data=body, method="POST", headers={"content-type": "application/json"})
try:
    with urllib.request.urlopen(req, timeout=20) as r:
        u = json.loads(r.read())["user"]
        print(f"Created {u['email']} as lead with Player 1 access.")
        print("Next: remove SETUP_TOKEN from Emergent's environment and restart the backend, then sign in and turn on two-step sign-in.")
except urllib.error.HTTPError as e:
    msg = {404: "set-up is closed (an account already exists, or SETUP_TOKEN is not set or shorter than 32 characters)",
           403: "wrong set-up key", 400: "check the email and that the password has 12+ characters"}.get(e.code, e.read().decode(errors="replace"))
    sys.exit(f"Not created ({e.code}): {msg}")
