#!/usr/bin/env python3
"""Make the server keys on YOUR computer (Python standard library only; macOS has python3 built in).

  python3 scripts/gen_keys.py            JWT_SECRET, FIELD_KEY, SETUP_TOKEN
  python3 scripts/gen_keys.py --wear     also WEAR_CRON_KEY and GARMIN_PUSH_KEY

Paste the lines into Emergent's environment settings for the backend. Then:
- do not paste them into any chat (Emergent's agent, Claude or anyone else)
- do not commit them; keep a copy in your password manager
- FIELD_KEY encrypts clinical data: if it is lost, the encrypted data cannot be read. Never change it on a live server
  without a planned re-encryption.
"""
import base64
import os
import secrets
import sys

print("JWT_SECRET=" + secrets.token_urlsafe(48))
print("FIELD_KEY=" + base64.urlsafe_b64encode(os.urandom(32)).decode())   # Fernet key format
print("SETUP_TOKEN=" + secrets.token_urlsafe(40) + "    # remove after the first account is made (stage 2)")
if "--wear" in sys.argv:
    print("WEAR_CRON_KEY=" + secrets.token_urlsafe(40))
    print("GARMIN_PUSH_KEY=" + secrets.token_urlsafe(32))
