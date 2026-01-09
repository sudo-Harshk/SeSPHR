import hashlib
import json
import os
import time

LOG_FILE = "audit/audit.log"


def log_event(user_id, file_name, action, status):
    timestamp = int(time.time())

    prev_hash = ""
    if os.path.exists(LOG_FILE):
        with open(LOG_FILE, "r") as f:
            lines = f.readlines()
            if lines:
                prev_hash = json.loads(lines[-1])["hash"]

    entry = {
        "timestamp": timestamp,
        "user": user_id,
        "file": file_name,
        "action": action,
        "status": status,
        "prev_hash": prev_hash
    }

    raw = json.dumps(entry, sort_keys=True).encode()
    entry_hash = hashlib.sha256(raw).hexdigest()
    entry["hash"] = entry_hash

    with open(LOG_FILE, "a") as f:
        f.write(json.dumps(entry) + "\n")


def audit_deny(user, file, reason):
    """
    Helper function to log access denial events.
    
    This provides a single source of truth for denial logging,
    ensuring consistent audit trail across all endpoints.
    
    Args:
        user: User ID (or "anonymous" if not authenticated)
        file: File name being accessed (or None if not applicable)
        reason: Denial reason (DENIED_AUTH, DENIED_ROLE, DENIED_POLICY, etc.)
    """
    log_event(
        user_id=user or "anonymous",
        file_name=file or "unknown",
        action="ACCESS",
        status=reason
    )