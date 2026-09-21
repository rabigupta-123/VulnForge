import concurrent.futures
import json
import dns.resolver
import requests

FINDING_SUBDOMAINS_DISCOVERED = {
    "title": "Subdomains Discovered",
    "category": "dns",
    "severity": "info",
    "cvss_score": 0.0,
    "owasp_mapping": "A05:2021-Security Misconfiguration",
    "description": (
        "Active subdomains associated with your domain were discovered by searching "
        "public Certificate Transparency (CT) logs and performing live DNS resolution checks. "
        "Mapping your attack surface helps identify forgotten testing servers or exposed APIs."
    ),
    "remediation": (
        "Review the list of discovered subdomains. Ensure that unused staging, development, "
        "or internal subdomains are decommissioned or restricted to internal IP ranges."
    ),
}


def resolve_subdomain(subdomain: str) -> str:
    """
    Check if a subdomain is active by resolving its DNS 'A' record.
    Returns the subdomain name if it resolves, otherwise None.
    """
    try:
        resolver = dns.resolver.Resolver()
        resolver.timeout = 1.5
        resolver.lifetime = 1.5
        # Try resolving the host to an IP address
        answers = resolver.resolve(subdomain, "A")
        if answers:
            return subdomain
    except Exception:
        pass
    return None


def scan_subdomains(domain: str) -> list:
    """
    Search certificate transparency logs for subdomains of domain,
    and concurrently check if they resolve actively.
    """
    findings = []
    subdomains_found = set()

    # Query crt.sh certificate logs JSON endpoint
    crt_url = f"https://crt.sh/?q=%.{domain}&output=json"
    try:
        headers = {"User-Agent": "CyberGuardian-SubdomainFinder/1.0"}
        response = requests.get(crt_url, headers=headers, timeout=8.0)
        if response.status_code == 200:
            cert_data = response.json()
            for cert in cert_data:
                # crt.sh splits multi-domain entries with newlines or spaces
                names = cert.get("name_value", "").split("\n")
                for name in names:
                    clean_name = name.strip().lower()
                    # Ensure it is a valid subdomain (not the root itself, starts with it, ends with target domain)
                    if clean_name.endswith(domain) and clean_name != domain:
                        # Skip wildcard entries
                        if "*" not in clean_name:
                            subdomains_found.add(clean_name)
    except Exception:
        # If crt.sh is down or times out, we continue with empty subdomains list
        pass

    # Cap active checks at 50 subdomains to prevent queue blockages
    subdomains_list = list(subdomains_found)[:50]
    active_subdomains = []

    if subdomains_list:
        # Verify active DNS resolutions concurrently
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(resolve_subdomain, sub) for sub in subdomains_list]
            for future in concurrent.futures.as_completed(futures):
                res = future.result()
                if res:
                    active_subdomains.append(res)

    # Return finding if any active subdomains are found
    if active_subdomains:
        f = FINDING_SUBDOMAINS_DISCOVERED.copy()
        f["raw_output"] = json.dumps({"active_subdomains": sorted(active_subdomains)})
        findings.append(f)

    return findings
