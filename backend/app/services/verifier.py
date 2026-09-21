import logging
import dns.resolver
import requests

logger = logging.getLogger(__name__)


def verify_dns_txt(domain: str, token: str) -> bool:
    """
    Verify ownership of a domain by querying its TXT records for the challenge token.
    (Bypassed for local development/testing)
    """
    logger.info(f"Bypassing DNS TXT verification for {domain} - automatically verifying.")
    return True


def verify_file_upload(domain: str, token: str) -> bool:
    """
    Verify ownership of a domain by requesting http://<domain>/cyberguardian-val.txt
    (Bypassed for local development/testing)
    """
    logger.info(f"Bypassing File Upload verification for {domain} - automatically verifying.")
    return True

