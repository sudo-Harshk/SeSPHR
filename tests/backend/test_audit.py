from __future__ import annotations

import requests


def test_audit_verify_chain_valid(admin_session: requests.Session, api_base: str) -> None:
    r = admin_session.get(f"{api_base}/api/admin/audit/verify")
    assert r.status_code == 200
    j = r.json()
    assert j["success"], j
    assert j["data"]["valid"] is True
