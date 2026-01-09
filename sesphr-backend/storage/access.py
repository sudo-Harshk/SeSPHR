import json
import os
import sys
from crypto.aes import decrypt_file
from crypto.cpabe.core import decrypt_aes_key
from policy.parser import evaluate_policy
from audit.logger import log_event

CLOUD_DATA = "cloud/data"
CLOUD_META = "cloud/meta"


def access_phr(user_id, enc_file, output_path):
    meta_path = os.path.join(CLOUD_META, enc_file.replace(".enc", ".json"))

    if not os.path.exists(meta_path):
        log_event(user_id, enc_file, "ACCESS", "INVALID_REQUEST")
        raise FileNotFoundError("Metadata not found")

    with open(meta_path, "r") as f:
        meta = json.load(f)

    try:
        # Load user attributes dynamically
        from storage.users import get_user_attributes
        attrs = get_user_attributes(user_id)
        
        # Create user object for policy evaluation
        from policy.models import User
        user = User(user_id, attrs)
        
        aes_key = decrypt_aes_key(meta["aes_key"], user)
    except Exception:
        log_event(user_id, enc_file, "ACCESS", "DENIED_POLICY")
        raise PermissionError("Access denied: policy not satisfied")

    enc_path = os.path.join(CLOUD_DATA, enc_file)
    decrypt_file(enc_path, output_path, aes_key)

    log_event(user_id, enc_file, "ACCESS", "GRANTED")
    return True
