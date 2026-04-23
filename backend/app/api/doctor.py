from flask import Blueprint, request, session, send_file
import os
import json
import time
from types import SimpleNamespace
from app.services.crypto.ops import re_encrypt_key
from app.services.policy.parser import evaluate_policy
from app.services.storage.users import get_user_by_id, get_user_attributes
from app.services.audit.logger import audit_deny, log_event
from app.services.utils import api_success, api_error
from config import Config

bp = Blueprint('doctor', __name__, url_prefix='/api/doctor')

@bp.route("/files")
def api_files():
    if "user_id" not in session:
        return api_error("Unauthorized", 401)
    
    if session.get("role") != "doctor":
        return api_error("Forbidden", 403)

    files = []
    if Config.CLOUD_DATA.exists():
        for enc_filename in os.listdir(Config.CLOUD_DATA):
            if not enc_filename.endswith(".enc"):
                continue
            
            meta_filename = enc_filename.replace(".enc", ".json")
            meta_path = Config.CLOUD_META / meta_filename
            
            if meta_path.exists():
                try:
                    with open(meta_path, "r") as f:
                        meta = json.load(f)
                    
                    original_filename = enc_filename.replace(".enc", "")
                    
                    # Get modification time and size
                    file_path = Config.CLOUD_DATA / enc_filename
                    mtime = os.path.getmtime(file_path)
                    size = os.path.getsize(file_path)
                    
                    portions = meta.get("portions") or []
                    files.append({
                        "filename": original_filename,
                        "enc_filename": enc_filename,
                        "owner": meta.get("owner", "Unknown"),
                        "date": mtime,
                        "size": size,
                        "policy": meta.get("policy", "N/A"),
                        "iv": meta.get("iv", "N/A"),
                        "key_blob": meta.get("key_blob", "N/A"),
                        "algorithm": "AES-GCM-256 + RSA-OAEP",
                        "revoked_users": meta.get("revoked_users", []),
                        "portions": [
                            {"name": p.get("name", ""), "policy": p.get("policy", "")}
                            for p in portions
                        ],
                    })
                except (json.JSONDecodeError, IOError):
                    continue
            else:
                original_filename = enc_filename.replace(".enc", "")
                file_path = Config.CLOUD_DATA / enc_filename
                mtime = os.path.getmtime(file_path)
                size = os.path.getsize(file_path)
                
                files.append({
                    "filename": original_filename,
                    "owner": None,
                    "date": mtime,
                    "size": size,
                    "policy": None
                })

    return api_success({"files": files})

@bp.route("/access", methods=["POST"])
def api_access():
    if "user_id" not in session:
        return api_error("Unauthorized", 401)
    
    if session.get("role") != "doctor":
        return api_error("Forbidden", 403)

    data = request.json
    filename = data.get("file")
    
    if not filename:
        return api_error("file parameter required", 400)
    
    # Normalize filename
    meta_filename = filename if filename.endswith(".json") else f"{filename}.json"
    if not meta_filename.endswith(".json"):
         meta_filename = meta_filename.replace(".enc", ".json")
         
    meta_path = Config.CLOUD_META / meta_filename
    if not meta_path.exists():
        meta_path = Config.CLOUD_META / f"{filename}.json"
        if not meta_path.exists():
            return api_error("File metadata not found", 404)

    try:
        t_fetch_start = time.time()
        with open(meta_path, "r") as f:
            meta = json.load(f)
        t_fetch_ms = round((time.time() - t_fetch_start) * 1000, 1)

        doctor_user_data = get_user_by_id(session["user_id"])
        if not doctor_user_data:
             return api_error("User not found", 404)

        doctor_user = SimpleNamespace(**doctor_user_data)
        doctor_user.attributes = get_user_attributes(session["user_id"])

        # 1. Check Global Policy
        t_policy_start = time.time()
        has_global_access = evaluate_policy(doctor_user, meta.get("policy", ""))
        t_policy_ms = round((time.time() - t_policy_start) * 1000, 1)

        # 2. Revocation
        if session["user_id"] in meta.get("revoked_users", []):
            audit_deny(session["user_id"], filename, "DENIED_REVOKED")
            return api_error("Access denied: You have been revoked by the owner", 403)

        # 3. Check Granular Portions
        portions = meta.get("portions", [])
        accessible_portions = []

        for p in portions:
            if evaluate_policy(doctor_user, p["policy"]):
                try:
                    re_enc_key = re_encrypt_key(p["key_blob"], session["user_id"])
                    accessible_portions.append({
                        "name": p["name"],
                        "key_blob": re_enc_key,
                        "iv": p["iv"]
                    })
                except Exception as e:
                    print(f"ERROR: Portion re-encryption failed for {p['name']}: {e}")

        # 4. Final Access Decision
        if not has_global_access and not accessible_portions:
            audit_deny(session["user_id"], filename, "DENIED_POLICY")
            return api_error("Access denied: No parts of this record are accessible with your attributes", 403)

        # 5. Return Results
        if meta.get("mode") == "client_side_encryption":
            key_blob = meta.get("key_blob")
            iv = meta.get("iv")

            re_encrypted_global_key = None
            t_reenc_ms = 0
            if has_global_access and key_blob:
                t_reenc_start = time.time()
                re_encrypted_global_key = re_encrypt_key(key_blob, session["user_id"])
                t_reenc_ms = round((time.time() - t_reenc_start) * 1000, 1)

            portions_note = f" + {len(accessible_portions)} section(s)" if accessible_portions else ""
            log_event(session["user_id"], filename, "ACCESS", f"GRANTED{portions_note}")

            debug_info = {
                "policy": meta.get("policy", "N/A"),
                "key_blob_srs": (key_blob[:8] + "...") if key_blob else "N/A",
                "key_blob_doctor": (re_encrypted_global_key[:8] + "...") if re_encrypted_global_key else "N/A",
                "steps": [
                    {"label": "Fetch key_blob", "duration_ms": t_fetch_ms},
                    {"label": "Policy check", "duration_ms": t_policy_ms},
                    {"label": "Re-encrypt key (SRS)", "duration_ms": t_reenc_ms},
                    {"label": "Decrypt in browser", "duration_ms": None},
                ],
                "note": "SRS processes only 32-byte AES key, never the file."
            }

            return api_success({
                "status": "granted",
                "key_blob": re_encrypted_global_key,
                "iv": iv,
                "portions": accessible_portions,
                "file_url": f"/api/doctor/download/{meta['file']}",
                "message": "Access granted. Check 'portions' for granular field keys.",
                "debug": debug_info,
            })
            
        else:
            return api_error("Legacy file format not supported in Hybrid Mode", 400)

    except Exception as e:
        return api_error(str(e), 500)

@bp.route("/download/<filename>")
def api_download_file(filename):
    if session.get("role") != "doctor":
        return api_error("Unauthorized", 403)
        
    file_path = Config.CLOUD_DATA / filename
    if not file_path.exists():
        return api_error("File not found", 404)
        
    return send_file(file_path, as_attachment=True)
