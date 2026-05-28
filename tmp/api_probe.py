#!/usr/bin/env python3
import json
import urllib.request
import urllib.error
import ssl

BASE = "https://api.kaburlumedia.com"
TENANT = "cmk7e7tg401ezlp22wkz5rxky"
DOMAIN = "cmk7eat8z01f5lp22otmq5pbr"

ctx = ssl.create_default_context()

def login():
    body = json.dumps({"mobileNumber": "9502337775", "mpin": "1234", "deviceInfo": "api-probe"}).encode()
    req = urllib.request.Request(f"{BASE}/auth/login", data=body, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, context=ctx, timeout=30) as r:
        data = json.load(r)
    return data["data"]["jwt"], data["data"].get("user", {})

def probe(method, path, token, body=None):
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Tenant-Id": TENANT,
        "X-Domain-Id": DOMAIN,
    }
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode()
    req = urllib.request.Request(f"{BASE}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=30) as r:
            code = r.status
            raw = r.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        code = e.code
        raw = e.read().decode("utf-8", errors="replace")
    except Exception as e:
        return 0, str(e)[:120]
    msg = ""
    try:
        j = json.loads(raw)
        msg = str(j.get("message") or j.get("error") or j.get("success") or "")[:100]
    except Exception:
        msg = raw[:100].replace("\n", " ")
    return code, msg

LANG = "cmk74fubb0014ugy41ec79nq4"

ENDPOINTS = [
    # Health
    ("GET", "/health/ai"),
    ("GET", "/api/v1/health/ai"),
    # Auth session
    ("GET", "/api/v1/reporters/me"),
    # Dashboard (tenant admin)
    ("GET", "/api/v1/dashboard/me"),
    ("GET", "/api/v1/dashboard/admin/overview"),
    ("GET", f"/api/v1/dashboard/tenants/{TENANT}/summary"),
    ("GET", f"/api/v1/dashboard/tenants/{TENANT}/web-articles"),
    ("GET", f"/api/v1/dashboard/tenants/{TENANT}/reporters"),
    # Categories / content
    ("GET", f"/api/v1/categories?languageId={LANG}"),
    ("GET", f"/api/v1/categories/tenant?languageId={LANG}"),
    ("GET", "/api/v1/languages"),
    ("GET", "/api/v1/states"),
    ("GET", "/api/v1/shortnews?limit=3"),
    ("GET", "/api/v1/articles/public?limit=3"),
    ("GET", "/api/v1/articles/newspaper?limit=3"),
    ("GET", "/api/v1/public/articles?limit=2"),
    # Tenant / domain
    ("GET", f"/api/v1/tenants/{TENANT}"),
    ("GET", f"/api/v1/domains/{TENANT}"),
    # Journalist (correct paths)
    ("GET", "/api/v1/journalist/profile"),
    ("GET", "/api/v1/journalist/my-card"),
    ("GET", "/api/v1/journalist/directory?limit=3"),
    ("GET", "/api/v1/journalist/updates?limit=3"),
    # Meta / lookups
    ("GET", "/api/v1/reporter-designations"),
    ("GET", "/api/v1/castes"),
    ("GET", "/api/v1/family/relations"),
    ("GET", "/api/v1/locations"),
    ("GET", "/api/v1/districts"),
    ("GET", "/api/v1/mandals"),
    # WhatsApp / notifications
    ("GET", "/api/v1/whatsapp/templates"),
    ("GET", "/api/v1/notifications/me"),
    # Epaper
    ("GET", "/api/v1/epaper/settings"),
    ("GET", "/api/v1/epaper/pdf-issues?limit=2"),
    # Wallet / billing (tenant)
    ("GET", f"/api/v1/wallet/tenant/{TENANT}/balance"),
    ("GET", f"/api/v1/billing/tenant/{TENANT}/subscription"),
    # Homepage / theme
    ("GET", f"/api/v1/homepage-sections?domainId={DOMAIN}"),
    ("GET", f"/api/v1/tenant-theme?domainId={DOMAIN}"),
    # Settings
    ("GET", f"/api/v1/settings/domain?domainId={DOMAIN}"),
    # Profiles
    ("GET", "/api/v1/profiles/me"),
    # Superadmin-only (expect 403)
    ("GET", "/api/v1/admin/users?limit=3"),
    ("GET", "/api/v1/tenant-admins"),
    # President (expect 403 for tenant admin)
    ("GET", "/api/v1/journalist/president/dashboard"),
]

def main():
    token, user = login()
    print(f"LOGIN OK role={user.get('role')} userId={user.get('userId')}\n")
    ok = warn = fail = 0
    fails = []
    warns = []
    for method, path in ENDPOINTS:
        code, msg = probe(method, path, token)
        if code >= 500 or code == 0:
            fail += 1
            fails.append((method, path, code, msg))
            print(f"FAIL {method:4} {path:50} {code:>3}  {msg}")
        elif code >= 400:
            warn += 1
            warns.append((method, path, code, msg))
            print(f"WARN {method:4} {path:50} {code:>3}  {msg}")
        else:
            ok += 1
            print(f" OK  {method:4} {path:50} {code:>3}")
    print(f"\nSUMMARY: OK={ok} WARN(4xx)={warn} FAIL(5xx)={fail}")
    if fails:
        print("\n=== 5xx / network failures ===")
        for row in fails:
            print("  ", row)
    if warns:
        print("\n=== 4xx (may be wrong path or permissions) ===")
        for row in warns:
            print("  ", row)

if __name__ == "__main__":
    main()
