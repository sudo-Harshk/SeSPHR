import json
from app.services.policy.parser import evaluate_policy


def encrypt_key(aes_key_bytes, policy):
    """
    Simulated CP-ABE encryption.
    Returns a policy-bound encrypted key blob.
    """
    blob = {
        "policy": policy,
        "key": aes_key_bytes.hex()
    }
    return json.dumps(blob)


def decrypt_key(enc_blob, user):
    """
    Simulated CP-ABE decryption.
    Returns AES key bytes if policy satisfied.
    """
    data = json.loads(enc_blob)
    policy = data["policy"]

    if not evaluate_policy(user, policy):
        raise PermissionError("CP-ABE policy not satisfied")

    return bytes.fromhex(data["key"])
