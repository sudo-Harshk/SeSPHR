from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
import requests

# tests/backend as import root for `helpers`
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from helpers.crypto_client import seed_patient_upload  # noqa: E402

API_BASE = os.environ.get("TEST_API_URL", "http://127.0.0.1:5000")
SEED_FILE = "pytest-seed.txt"


@pytest.fixture(scope="session")
def api_base() -> str:
    return API_BASE


@pytest.fixture(scope="session")
def patient_session(api_base: str) -> requests.Session:
    s = requests.Session()
    r = s.post(
        f"{api_base}/api/login",
        json={"email": "patient1@demo.com", "password": "Demo@1234"},
    )
    assert r.status_code == 200 and r.json().get("success"), r.text
    return s


@pytest.fixture(scope="session")
def doctor_session(api_base: str) -> requests.Session:
    s = requests.Session()
    r = s.post(
        f"{api_base}/api/login",
        json={"email": "dr_cardio@demo.com", "password": "Demo@1234"},
    )
    assert r.status_code == 200 and r.json().get("success"), r.text
    return s


@pytest.fixture(scope="session")
def admin_session(api_base: str) -> requests.Session:
    s = requests.Session()
    r = s.post(
        f"{api_base}/api/login",
        json={"email": "admin@demo.com", "password": "Demo@1234"},
    )
    assert r.status_code == 200 and r.json().get("success"), r.text
    return s


@pytest.fixture(scope="session", autouse=True)
def _isolate_and_seed(
    api_base: str,
    patient_session: requests.Session,
    doctor_session: requests.Session,
) -> None:
    """Clear uploads + audit, seed one record, grant access once (audit chain)."""
    cu = requests.post(f"{api_base}/api/debug/clear-uploads")
    assert cu.status_code == 200 and cu.json().get("success"), cu.text
    ca = requests.post(f"{api_base}/api/debug/clear-audit-log")
    assert ca.status_code == 200 and ca.json().get("success"), ca.text

    seed_patient_upload(
        patient_session,
        api_base,
        SEED_FILE,
        b"pytest backend seed\n",
        "Role:Doctor",
    )
    acc = doctor_session.post(
        f"{api_base}/api/doctor/access",
        json={"file": SEED_FILE},
    )
    assert acc.status_code == 200, acc.text
    data = acc.json()
    assert data.get("success"), data
    assert data["data"]["status"] == "granted"
