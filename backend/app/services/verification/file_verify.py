"""
Domain verification via file upload (alternative to DNS TXT — useful when
a user can't edit DNS but can upload to their web root).

Flow:
1. Same token generation as dns_verify.py
2. User is shown: "Upload a file to https://yourdomain.com/.well-known/cyberguardian-verify.txt
   containing exactly: <token>"
3. "Check Now" -> this module fetches that URL and compares

Drop into: backend/app/services/verification/file_verify.py
"""

import requests


def check_file_verification(domain: str, expected_token: str, timeout: int = 10) -> bool:
    url = f"https://{domain}/.well-known/cyberguardian-verify.txt"
    try:
        resp = requests.get(url, timeout=timeout)
        if resp.status_code != 200:
            return False
        return expected_token.strip() in resp.text.strip()
    except requests.RequestException:
        return False
