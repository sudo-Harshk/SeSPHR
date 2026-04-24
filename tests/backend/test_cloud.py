from __future__ import annotations

import json

import requests


def test_cloud_raw_metadata_only(admin_session: requests.Session, api_base: str) -> None:
    r = admin_session.get(f"{api_base}/api/admin/cloud-raw")
    assert r.status_code == 200
    body = r.json()
    assert body["success"]
    files = body["data"]["files"]
    assert len(files) >= 1
    raw = json.dumps(body)
    assert "key_blob" in raw or any("key_blob" in json.dumps(f) for f in files)
    assert any("iv" in json.dumps(f) for f in files)
    # No obvious PII JSON keys in API payload
    assert '"name":' not in raw
    assert '"age":' not in raw
    assert '"phone":' not in raw
