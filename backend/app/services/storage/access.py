import json
import os
import sys
import json
import os
import sys
from app.services.crypto.aes import decrypt_file
from app.services.crypto.cpabe.core import decrypt_aes_key
from app.services.policy.parser import evaluate_policy
from app.services.audit.logger import log_event
from config import Config

CLOUD_DATA = Config.CLOUD_DATA
CLOUD_META = Config.CLOUD_META


def access_phr(user_id, enc_file, output_path):
    # This seems to be a CLI-only or legacy Access function using CP-ABE Core directly?
    # Our web app uses Hybrid (RSA+AES) with SRS.
    # We should probably update this to support Hybrid or just fix imports for legacy.
    # Fixing imports for now.
    
    meta_path = CLOUD_META / enc_file.replace(".enc", ".json")

    if not meta_path.exists():
        log_event(user_id, enc_file, "ACCESS", "INVALID_REQUEST")
        raise FileNotFoundError("Metadata not found")

    with open(meta_path, "r") as f:
        meta = json.load(f)

    try:
        # Load user attributes dynamically
        from app.services.storage.users import get_user_attributes
        attrs = get_user_attributes(user_id)
        
        # Create user object for policy evaluation
        from types import SimpleNamespace
        user = SimpleNamespace(user_id=user_id, attributes=attrs)
        
        # Note: decrypt_aes_key (CP-ABE) is used here. 
        # Ideally CLI should also support SRS/Hybrid if we want it to work with web uploads.
        aes_key = decrypt_aes_key(meta["aes_key"], user)
    except Exception:
        log_event(user_id, enc_file, "ACCESS", "DENIED_POLICY")
        raise PermissionError("Access denied: policy not satisfied")

    enc_path = os.path.join(CLOUD_DATA, enc_file)
    decrypt_file(enc_path, output_path, aes_key)

    log_event(user_id, enc_file, "ACCESS", "GRANTED")
    return True
