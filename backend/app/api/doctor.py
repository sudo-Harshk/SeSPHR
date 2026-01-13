
from flask import Blueprint, request, session, send_file
import os
import json
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
                    
                    files.append({
                        "filename": original_filename,
                        "enc_filename": enc_filename,
                        "owner": meta.get("owner", "Unknown"),
                        "date": mtime,
                        "size": size,
                        "policy": meta.get("policy", "N/A"),
                        "iv": meta.get("iv", "N/A"),
                        "key_blob": meta.get("key_blob", "N/A"),
                        "algorithm": "AES-GCM-256 + RSA-OAEP"
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
        with open(meta_path, "r") as f:
            meta = json.load(f)
            
        doctor_user_data = get_user_by_id(session["user_id"])
        if not doctor_user_data:
             return api_error("User not found", 404)
        
        doctor_user = SimpleNamespace(**doctor_user_data)
        doctor_user.attributes = get_user_attributes(session["user_id"])
        
        # 1. Policy
        if not evaluate_policy(doctor_user, meta["policy"]):
            audit_deny(session["user_id"], filename, "DENIED_POLICY")
            return api_error("Access denied: policy not satisfied", 403)

        # 2. Revocation
        if session["user_id"] in meta.get("revoked_users", []):
            audit_deny(session["user_id"], filename, "DENIED_REVOKED")
            return api_error("Access denied: You have been revoked by the owner", 403)

        # 3. Re-Encryption
        if meta.get("mode") == "client_side_encryption":
            key_blob = meta.get("key_blob")
            iv = meta.get("iv")
            
            if not key_blob:
                return api_error("Key blob missing in metadata", 500)
                
            re_encrypted_key = re_encrypt_key(key_blob, session["user_id"])
                
            log_event(session["user_id"], filename, "ACCESS", "GRANTED_RE_ENCRYPT")

            return api_success({
                "status": "granted",
                "key_blob": re_encrypted_key,
                "iv": iv,
                "file_url": f"/api/doctor/download/{meta['file']}",
                "message": "Access granted. Key re-encrypted for your identity."
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
