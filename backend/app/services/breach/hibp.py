"""
Have I Been Pwned integration.

Two functions:
  - check_email_breaches: only call after the email has completed
    OTP/link verification (i.e. you've confirmed the requesting user
    actually controls that inbox).
  - check_password_pwned: safe to call for any password check, since it
    uses k-anonymity — the real password/hash is never sent anywhere.

Requires: pip install requests
Requires: HIBP_API_KEY (email breach lookups require a paid API key;
Pwned Passwords k-anonymity endpoint does not require a key)
"""

from __future__ import annotations
import hashlib
import requests

HIBP_API_BASE = "https://haveibeenpwned.com/api/v3"
PWNED_PASSWORDS_API = "https://api.pwnedpasswords.com/range"


def check_email_breaches(email: str, api_key: str) -> list[dict]:
    """
    Only call this after verifying the requesting user controls `email`
    (e.g. they clicked a confirmation link sent to that address).
    """
    headers = {
        "hibp-api-key": api_key,
        "user-agent": "CyberGuardianAI-BreachMonitor",
    }
    resp = requests.get(
        f"{HIBP_API_BASE}/breachedaccount/{email}",
        headers=headers,
        params={"truncateResponse": "false"},
        timeout=10,
    )
    if resp.status_code == 404:
        return []  # no breaches found
    resp.raise_for_status()
    return resp.json()


def check_domain_breaches(domain: str, api_key: str) -> list[dict]:
    """
    Only call after `domain` has completed the same DNS-TXT verification
    used for the asset scanner. Requires a Domain Search subscription
    tier on the HIBP API key.
    """
    headers = {
        "hibp-api-key": api_key,
        "user-agent": "CyberGuardianAI-BreachMonitor",
    }
    resp = requests.get(
        f"{HIBP_API_BASE}/breacheddomain/{domain}",
        headers=headers,
        timeout=10,
    )
    if resp.status_code == 404:
        return []
    resp.raise_for_status()
    return resp.json()


def check_password_pwned(password: str) -> int:
    """
    Returns the number of times this password has appeared in known
    breaches, using k-anonymity so the real password never leaves the
    client in recoverable form.

    Call this function itself from the BROWSER (client-side) where
    possible — the hashing should happen in JS before it ever reaches
    your backend, so your server never sees the plaintext password
    either. This Python version is provided for a server-side fallback
    or for testing.
    """
    sha1_hash = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
    prefix, suffix = sha1_hash[:5], sha1_hash[5:]

    resp = requests.get(f"{PWNED_PASSWORDS_API}/{prefix}", timeout=10)
    resp.raise_for_status()

    for line in resp.text.splitlines():
        hash_suffix, count = line.split(":")
        if hash_suffix == suffix:
            return int(count)
    return 0
