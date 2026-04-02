
from flask import Blueprint, request, session
import os
import json
import sys
from app.services.storage.phr import store_encrypted_phr
from app.services.audit.logger import audit_deny
from app.services.audit.logger import log_event
from app.services.utils import api_success, api_error
from config import Config

bp = Blueprint('patient', __name__, url_prefix='/api/patient')

@bp.route("/files")
def api_files():
    if "user_id" not in session:
        audit_deny("anonymous", None, "DENIED_AUTH")
        return api_error("Unauthorized", 401)
    
    if session.get("role") != "patient":
        audit_deny(session.get("user_id", "unknown"), None, "DENIED_ROLE")
        return api_error("Forbidden: patient role required", 403)

    files = []
    # Use Config paths
    if Config.CLOUD_META.exists():
        for meta_filename in os.listdir(Config.CLOUD_META):
            if not meta_filename.endswith(".json"):
                continue
            
            meta_path = Config.CLOUD_META / meta_filename
            try:
                with open(meta_path, "r") as f:
                    meta = json.load(f)
                
                original_filename = meta.get("file", meta_filename).replace(".enc", "")
                if original_filename == meta_filename:
                    original_filename = meta_filename.replace(".json", "")
                
                owner = meta.get("owner", None)
                if not owner and "test_patient" in meta_filename:
                     owner = "test_patient_mod2"

                # Get modification time and size
                file_path = Config.CLOUD_DATA / meta.get("file", meta_filename.replace(".json", ".enc"))
                mtime = 0
                size = 0
                if file_path.exists():
                     mtime = os.path.getmtime(file_path)
                     size = os.path.getsize(file_path)

                pol = meta.get("policy", None)
                prev_pol = meta.get("previous_policy")
                files.append({
                    "filename": original_filename.replace(".enc", "").replace(".json", ""),
                    "owner": owner,
                    "date": mtime,
                    "size": size,
                    "policy": pol,
                    "iv": meta.get("iv", "N/A"),
                    "key_blob": meta.get("key_blob", "N/A"),
                    "portions": meta.get("portions", []),
                    "algorithm": "AES-GCM-256 + RSA-OAEP",
                    "revoked_users": meta.get("revoked_users", []),
                    "can_restore_full": bool(prev_pol) and pol == "Role:__REVOKED__",
                })
            except (json.JSONDecodeError, IOError):
                continue

    return api_success({"files": files})

@bp.route("/upload", methods=["POST"])
def api_upload():
    if session.get("role") != "patient":
        return {"error": "unauthorized"}, 403

    file = request.files["file"]
    policy = request.form["policy"]
    key_blob = request.form.get("key_blob")
    iv = request.form.get("iv")
    
    # Optional granular portions
    portions_raw = request.form.get("portions")
    portions = None
    if portions_raw:
        try:
            portions = json.loads(portions_raw)
        except json.JSONDecodeError:
            return api_error("Invalid portions format", 400)
    
    if not key_blob or not iv:
        return api_error("Missing encryption parameters (key_blob or iv)", 400)

    store_encrypted_phr(session["user_id"], file, policy, key_blob, iv, portions=portions)

    return api_success({
        "message": "File uploaded successfully",
        "filename": file.filename.replace(".enc", "").replace(".json", ""),
        "policy": policy,
        "owner": session["user_id"],
        "iv": iv,
        "key_blob": key_blob,
        "portions": portions or [],
        "algorithm": "AES-GCM-256 + RSA-OAEP"
    })

@bp.route("/revoke", methods=["POST"])
def api_revoke():
    if "user_id" not in session:
        return api_error("Unauthorized", 401)
    
    if session.get("role") != "patient":
        return api_error("Forbidden", 403)
    
    data = request.json or {}
    filename = data.get("filename")
    
    if not filename:
        return api_error("Filename required", 400)
    
    meta_filename = filename if filename.endswith(".json") else f"{filename}.json"
    meta_path = Config.CLOUD_META / meta_filename
    
    if not meta_path.exists():
        return api_error("File not found", 404)
    
    with open(meta_path, "r") as f:
        meta = json.load(f)
    
    if meta.get("owner") != session["user_id"]:
        audit_deny(session["user_id"], filename, "DENIED_OWNER")
        return api_error("Forbidden: not file owner", 403)
    
    revoke_user_id = data.get("revoke_user_id")
    if revoke_user_id:
        revoked_list = meta.get("revoked_users", [])
        if revoke_user_id not in revoked_list:
            revoked_list.append(revoke_user_id)
        meta["revoked_users"] = revoked_list
        log_event(session["user_id"], filename, "REVOKE_USER", f"Revoked {revoke_user_id}")
    else:
        current_pol = meta.get("policy", "")
        if current_pol and current_pol != "Role:__REVOKED__":
            meta["previous_policy"] = current_pol
        meta["policy"] = "Role:__REVOKED__"
        try:
            key_blob = json.loads(meta["aes_key"])
            key_blob["policy"] = "Role:__REVOKED__"
            meta["aes_key"] = json.dumps(key_blob)
        except Exception as e:
            print(f"REVOCATION WARNING: {e}", file=sys.stderr)
        
        log_event(session["user_id"], filename, "REVOKE", "SUCCESS")
    
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)
    
    return api_success({"status": "revoked", "filename": filename})


@bp.route("/grant", methods=["POST"])
def api_grant():
    """Restore access: remove a user from revoked_users, or restore global policy after full revoke."""
    if "user_id" not in session:
        return api_error("Unauthorized", 401)

    if session.get("role") != "patient":
        return api_error("Forbidden", 403)

    data = request.json or {}
    filename = data.get("filename")
    if not filename:
        return api_error("Filename required", 400)

    grant_user_id = (data.get("grant_user_id") or "").strip()
    restore_full = bool(data.get("restore_full"))
    new_policy = (data.get("policy") or "").strip()

    meta_filename = filename if filename.endswith(".json") else f"{filename}.json"
    meta_path = Config.CLOUD_META / meta_filename

    if not meta_path.exists():
        return api_error("File not found", 404)

    with open(meta_path, "r") as f:
        meta = json.load(f)

    if meta.get("owner") != session["user_id"]:
        audit_deny(session["user_id"], filename, "DENIED_OWNER")
        return api_error("Forbidden: not file owner", 403)

    if grant_user_id:
        revoked_list = list(meta.get("revoked_users", []))
        if grant_user_id not in revoked_list:
            return api_error("User is not in the revoked list", 400)
        meta["revoked_users"] = [u for u in revoked_list if u != grant_user_id]
        log_event(session["user_id"], filename, "GRANT_USER", f"Restored {grant_user_id}")
    elif restore_full:
        if meta.get("policy") != "Role:__REVOKED__":
            return api_error("Record is not fully revoked", 400)
        prev = meta.pop("previous_policy", None)
        if prev:
            meta["policy"] = prev
        elif new_policy:
            meta["policy"] = new_policy
        else:
            return api_error(
                "No saved previous policy. Pass policy in the request body to set a new access policy.",
                400,
            )
        meta["revoked_users"] = []
        log_event(session["user_id"], filename, "RESTORE_ACCESS", meta.get("policy", ""))
    else:
        return api_error("Provide grant_user_id or restore_full: true", 400)

    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)

    return api_success({"status": "granted", "filename": filename})
