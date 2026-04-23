
from flask import Blueprint, request, session
import os
import csv
import json
import time
from app.services.storage.users import get_all_users_with_attributes, get_user_by_id, add_attribute, remove_attribute
from app.services.audit.logger import verify_audit_log_file
from app.services.utils import api_success, api_error
from config import Config

bp = Blueprint('admin', __name__, url_prefix='/api/admin')

@bp.route("/users")
def api_users():
    if "user_id" not in session or session.get("role") != "admin":
        return api_error("Unauthorized", 403)

    try:
        users = list(get_all_users_with_attributes().values())
        return api_success({"users": users})
    except Exception as e:
        return api_error(f"Failed to load users: {str(e)}", 500)

@bp.route("/attributes", methods=["POST"])
def api_attributes():
    if "user_id" not in session or session.get("role") != "admin":
        return api_error("Unauthorized", 403)
    
    data = request.json
    action = data.get("action")
    target_user_id = data.get("user_id")
    key = data.get("key")
    value = data.get("value")
    
    if action not in ["add", "remove"] or not target_user_id or not key:
        return api_error("Invalid parameters", 400)
    
    if action == "add" and not value:
        return api_error("value required for add", 400)
    
    try:
        if action == "add":
            add_attribute(target_user_id, key, value)
        else:
            remove_attribute(target_user_id, key)
            
        return api_success({"message": "Attribute updated successfully"})
    except Exception as e:
        return api_error(str(e), 500)

@bp.route("/audit")
def api_audit_logs():
    # This route mimics the original /api/audit/logs logic
    if "user_id" not in session or session.get("role") != "admin":
        return api_error("Unauthorized", 403)
    
    try:
        if not Config.AUDIT_LOG_PATH.exists():
            return api_success({
                "logs": [],
                "integrity": {"valid": True, "detail": ""},
            })

        logs = []
        with open(Config.AUDIT_LOG_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    logs.append(json.loads(line))
                except json.JSONDecodeError:
                    continue

        # Enrich user field: resolve UUID → display name + role
        all_users = get_all_users_with_attributes()
        user_labels = {}
        for uid, u in all_users.items():
            name = u.get("name") or u.get("email", uid)
            role = u.get("role", "")
            attrs = u.get("attributes", {})
            dept = attrs.get("Dept", "")
            user_labels[uid] = {"display": name, "role": role, "email": u.get("email", ""), "dept": dept}

        for log in logs:
            uid = log.get("user", "")
            if uid in user_labels:
                log["user_display"] = user_labels[uid]["display"]
                log["user_role"] = user_labels[uid]["role"]
                log["user_email"] = user_labels[uid]["email"]
                log["user_dept"] = user_labels[uid]["dept"]
            else:
                log["user_display"] = uid  # fallback to raw ID
                log["user_role"] = ""
                log["user_email"] = ""
                log["user_dept"] = ""

        ok, detail = verify_audit_log_file(Config.AUDIT_LOG_PATH)
        return api_success({
            "logs": logs,
            "integrity": {"valid": ok, "detail": detail or ""},
        })
    except Exception as e:
        return api_error(str(e), 500)

@bp.route("/benchmark")
def api_benchmark():
    if "user_id" not in session or session.get("role") != "admin":
        return api_error("Unauthorized", 403)

    csv_path = Config.BASE_DIR.parent / "benchmark_results.csv"
    if not csv_path.exists():
        return api_error("Benchmark results not found", 404)

    rows = []
    try:
        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                rows.append({
                    "file_size": row.get("File Size (MB)", ""),
                    "encryption_time": float(row.get("Encryption Time (s)", 0)),
                    "srs_time": float(row.get("SRS Time (s)", 0)),
                    "decryption_time": float(row.get("Decryption Time (s)", 0)),
                })
    except Exception as e:
        return api_error(f"Failed to parse benchmark file: {str(e)}", 500)

    return api_success({"results": rows})

@bp.route("/benchmark", methods=["POST"])
def api_benchmark_run():
    if "user_id" not in session or session.get("role") != "admin":
        return api_error("Unauthorized", 403)

    mode = request.args.get("mode", "rsa-pre")

    try:
        from Crypto.Cipher import AES
        from Crypto.PublicKey import RSA
        from Crypto.Cipher import PKCS1_OAEP
        from Crypto.Hash import SHA256, SHA1
        from app.services.crypto.keys import get_or_create_srs_key

        srs_private_key, srs_public_pem = get_or_create_srs_key()

        sizes_kb = [1, 10, 100, 1024, 5120, 10240]
        results = []

        for kb in sizes_kb:
            plaintext = os.urandom(kb * 1024)

            # AES-GCM encrypt
            t0 = time.time()
            aes_key = os.urandom(32)
            nonce = os.urandom(12)
            cipher_enc = AES.new(aes_key, AES.MODE_GCM, nonce=nonce)
            ciphertext, tag = cipher_enc.encrypt_and_digest(plaintext)
            enc_time = round((time.time() - t0) * 1000, 2)

            # AES-GCM decrypt
            t0 = time.time()
            cipher_dec = AES.new(aes_key, AES.MODE_GCM, nonce=nonce)
            cipher_dec.decrypt_and_verify(ciphertext, tag)
            dec_time = round((time.time() - t0) * 1000, 2)

            # RSA-OAEP re-encryption (32-byte key only — constant time)
            t0 = time.time()
            cipher_wrap = PKCS1_OAEP.new(srs_private_key, hashAlgo=SHA256)
            # Simulate: wrap a random 32-byte AES key with SRS pub key, then re-encrypt for doctor
            # Here we just time RSA decrypt + encrypt (same operation as re_encrypt_key)
            srs_pub_key = RSA.import_key(srs_public_pem)
            cipher_pub = PKCS1_OAEP.new(srs_pub_key, hashAlgo=SHA256)
            wrapped = cipher_pub.encrypt(aes_key)
            cipher_wrap2 = PKCS1_OAEP.new(srs_private_key, hashAlgo=SHA256)
            unwrapped = cipher_wrap2.decrypt(wrapped)
            cipher_re = PKCS1_OAEP.new(srs_pub_key, hashAlgo=SHA1)
            cipher_re.encrypt(unwrapped)
            srs_time = round((time.time() - t0) * 1000, 2)

            size_label = f"{kb / 1024:.0f}" if kb >= 1024 else f"{kb / 1024:.2f}".rstrip('0').rstrip('.')
            results.append({
                "file_size": f"{kb / 1024:.2f}".rstrip('0').rstrip('.'),
                "file_size_kb": kb,
                "encryption_time": enc_time / 1000,
                "srs_time": srs_time / 1000,
                "decryption_time": dec_time / 1000,
                "encryption_time_ms": enc_time,
                "srs_time_ms": srs_time,
                "decryption_time_ms": dec_time,
            })

        import logging
        logging.info(f"[benchmark] mode={mode} sizes={[r['file_size_kb'] for r in results]}")

        return api_success({"results": results, "mode": mode})
    except Exception as e:
        return api_error(f"Benchmark failed: {str(e)}", 500)

@bp.route("/cloud-raw")
def api_cloud_raw():
    if "user_id" not in session or session.get("role") != "admin":
        return api_error("Unauthorized", 403)

    try:
        files = []
        if Config.CLOUD_META.exists():
            for meta_file in os.listdir(Config.CLOUD_META):
                if not meta_file.endswith(".json"):
                    continue
                meta_path = Config.CLOUD_META / meta_file
                try:
                    with open(meta_path, "r") as f:
                        meta = json.load(f)
                except (json.JSONDecodeError, IOError):
                    continue

                enc_filename = meta_file.replace(".json", ".enc")
                enc_path = Config.CLOUD_DATA / enc_filename
                size = os.path.getsize(enc_path) if enc_path.exists() else 0
                key_blob = meta.get("key_blob", "")

                files.append({
                    "filename": enc_filename,
                    "key_blob_preview": key_blob[:8] + "..." if key_blob else "N/A",
                    "iv": meta.get("iv", "N/A"),
                    "policy": meta.get("policy", "N/A"),
                    "algorithm": "AES-GCM-256 + RSA-OAEP",
                    "size": size,
                    "raw_meta": {
                        "key_blob": (key_blob[:16] + "...") if key_blob else "N/A",
                        "iv": meta.get("iv", "N/A"),
                        "policy": meta.get("policy", "N/A"),
                        "algorithm": "AES-GCM-256 + RSA-OAEP",
                        "mode": meta.get("mode", "client_side_encryption"),
                    }
                })

        return api_success({
            "files": files,
            "cloud_guarantee": "No plaintext. No PII visible.",
            "note": "All fields are cryptographic metadata, not user data."
        })
    except Exception as e:
        return api_error(str(e), 500)

@bp.route("/audit/verify")
def api_audit_verify():
    if "user_id" not in session or session.get("role") != "admin":
        return api_error("Unauthorized", 403)

    try:
        total_blocks = 0
        if Config.AUDIT_LOG_PATH.exists():
            with open(Config.AUDIT_LOG_PATH, "r", encoding="utf-8") as f:
                total_blocks = sum(1 for line in f if line.strip())

        valid, detail = verify_audit_log_file(Config.AUDIT_LOG_PATH)

        block_number = None
        if not valid and detail:
            import re
            match = re.search(r"line (\d+)", detail)
            if match:
                block_number = int(match.group(1))

        return api_success({
            "valid": valid,
            "block_number": block_number,
            "detail": detail or "",
            "total_blocks": total_blocks,
        })
    except Exception as e:
        return api_error(str(e), 500)
