"""AES-GCM + RSA-OAEP(SHA-256) upload payload matching the browser (see frontend/src/utils/crypto.ts)."""

from __future__ import annotations

from Crypto.Cipher import AES, PKCS1_OAEP
from Crypto.PublicKey import RSA
from Crypto.Random import get_random_bytes
from Crypto.Hash import SHA256


def encrypt_and_wrap_for_upload(plaintext: bytes, srs_public_key_pem: str) -> tuple[bytes, str, str]:
    aes_key = get_random_bytes(32)
    iv = get_random_bytes(12)
    cipher_aes = AES.new(aes_key, AES.MODE_GCM, nonce=iv)
    ciphertext, tag = cipher_aes.encrypt_and_digest(plaintext)
    blob = ciphertext + tag
    srs = RSA.import_key(srs_public_key_pem)
    cipher_rsa = PKCS1_OAEP.new(srs, hashAlgo=SHA256)
    wrapped = cipher_rsa.encrypt(aes_key)
    return blob, wrapped.hex(), iv.hex()


def seed_patient_upload(
    session,
    api_base: str,
    logical_basename: str,
    plaintext: bytes,
    policy: str = "Role:Doctor",
) -> None:
    """POST /api/patient/upload with a valid encrypted blob (real crypto, not mocked)."""
    r = session.get(f"{api_base}/api/srs/public-key")
    r.raise_for_status()
    j = r.json()
    assert j.get("success"), j
    pem = j["data"]["public_key"]
    blob, key_blob, iv = encrypt_and_wrap_for_upload(plaintext, pem)

    base = logical_basename.replace(".enc", "").replace(".json", "")
    enc_filename = f"{base}.enc"
    files = {"file": (enc_filename, blob, "application/octet-stream")}
    data = {
        "policy": policy,
        "key_blob": key_blob,
        "iv": iv,
        "portions": "[]",
    }
    resp = session.post(f"{api_base}/api/patient/upload", files=files, data=data)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body.get("success"), body
