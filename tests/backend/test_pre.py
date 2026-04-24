from __future__ import annotations

import requests


def test_doctor_access_re_encrypts_key(doctor_session: requests.Session, api_base: str) -> None:
    r = doctor_session.post(
        f"{api_base}/api/doctor/access",
        json={"file": "pytest-seed.txt"},
    )
    assert r.status_code == 200
    j = r.json()
    assert j["success"], j
    data = j["data"]
    assert data["status"] == "granted"
    dbg = data["debug"]
    assert dbg["key_blob_srs"] != dbg["key_blob_doctor"]
    assert dbg["key_blob_srs"] not in ("N/A", "", None)
    assert dbg["key_blob_doctor"] not in ("N/A", "", None)
