import hashlib
import json
import os
import threading
import time
from pathlib import Path
from typing import Optional, Tuple

from config import Config

LOG_FILE = Config.AUDIT_LOG_PATH

# Serialize appends so concurrent requests cannot read the same "last hash" and fork the chain.
_audit_append_lock = threading.Lock()

# Ensure parent directory exists
if not LOG_FILE.parent.exists():
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)


def log_event(user_id, file_name, action, status):
    with _audit_append_lock:
        timestamp = int(time.time())

        prev_hash = ""
        if os.path.exists(LOG_FILE):
            with open(LOG_FILE, "r", encoding="utf-8") as f:
                lines = f.readlines()
                if lines:
                    prev_hash = json.loads(lines[-1].strip())["hash"]

        entry = {
            "timestamp": timestamp,
            "user": user_id,
            "file": file_name,
            "action": action,
            "status": status,
            "prev_hash": prev_hash,
        }

        raw = json.dumps(entry, sort_keys=True).encode()
        entry_hash = hashlib.sha256(raw).hexdigest()
        entry["hash"] = entry_hash

        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")


def verify_audit_log_file(path: Optional[Path] = None) -> Tuple[bool, Optional[str]]:
    """
    Walk the audit file in on-disk order (same as append order).
    Each line must be valid JSON; prev_hash must match the previous line's hash;
    each line's hash must match SHA256(json.dumps(body, sort_keys=True)) like log_event.
    """
    path = path or LOG_FILE
    if not path.exists():
        return True, None

    last_hash = ""
    physical_line = 0
    try:
        with open(path, "r", encoding="utf-8") as f:
            for raw in f:
                physical_line += 1
                line = raw.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    return False, f"Invalid JSON at file line {physical_line}"

                prev_stored = entry.get("prev_hash", "") or ""
                if prev_stored != last_hash:
                    return (
                        False,
                        f"Hash chain broken at file line {physical_line}: "
                        f"prev_hash does not match the previous entry (log may be edited, merged, or corrupted).",
                    )

                stored_hash = entry.get("hash")
                if not stored_hash:
                    return False, f"Missing hash field at file line {physical_line}"

                body = {k: v for k, v in entry.items() if k != "hash"}
                raw_bytes = json.dumps(body, sort_keys=True).encode("utf-8")
                computed = hashlib.sha256(raw_bytes).hexdigest()
                if computed != stored_hash:
                    return False, f"Stored hash does not match payload at file line {physical_line}"

                last_hash = stored_hash
        return True, None
    except OSError as e:
        return False, str(e)


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