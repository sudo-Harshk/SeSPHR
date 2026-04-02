
from flask import Blueprint, session, jsonify, request
import os
import shutil
from app.services.crypto.keys import generate_user_keys, CLOUD_KEYS_USERS
from app.services.utils import api_success, api_error
from config import Config

bp = Blueprint('debug', __name__, url_prefix='/api/debug')

@bp.route("/gen-keys/<user_id>", methods=["POST"])
def api_gen_keys(user_id):
    if os.environ.get("FLASK_ENV") != "development":
         return api_error("Debug only", 403)
         
    try:
        generate_user_keys(user_id)
        return api_success({"message": f"Keys generated for {user_id}"})
    except Exception as e:
        return api_error(str(e), 500)

@bp.route("/reset", methods=["POST"])
def api_reset():
    if os.environ.get("FLASK_ENV") != "development":
        return api_error("Debug only", 403)
        
    try:
        # Clear Cloud Data
        if Config.CLOUD_DATA.exists():
            shutil.rmtree(Config.CLOUD_DATA)
            Config.CLOUD_DATA.mkdir()
            
        if Config.CLOUD_META.exists():
            shutil.rmtree(Config.CLOUD_META)
            Config.CLOUD_META.mkdir()
            
        # Clear Keys (SRS and Users)
        if Config.CLOUD_KEYS_SRS.exists():
            shutil.rmtree(Config.CLOUD_KEYS_SRS)
            Config.CLOUD_KEYS_SRS.mkdir()
            
        if Config.CLOUD_KEYS_USERS.exists():
            shutil.rmtree(Config.CLOUD_KEYS_USERS)
            Config.CLOUD_KEYS_USERS.mkdir()
            
        # Clear Audit Logs
        if Config.AUDIT_LOG_PATH.exists():
            os.remove(Config.AUDIT_LOG_PATH)
            
        # Clear Database
        if Config.DB_PATH.exists():
            os.remove(Config.DB_PATH)
            
        # Re-initialize Database
        from app.services.storage.db import init_db
        init_db()

        return api_success({"message": "System reset successfully"})
    except Exception as e:
        return api_error(str(e), 500)

@bp.route("/my-private-key")
def api_my_private_key():
    if "user_id" not in session:
        return api_error("Unauthorized", 401)
        
    user_id = session["user_id"]
    priv_path = Config.CLOUD_KEYS_USERS / f"{user_id}_private.pem"
    
    if priv_path.exists():
        with open(priv_path, "r") as f:
            return api_success({"private_key": f.read()})
            
    return api_error("Private key not found", 404)


@bp.route("/ensure-my-keys", methods=["POST"])
def api_ensure_my_keys():
    """
    Development: create RSA key pair for the logged-in user if missing, then return private key PEM.
    Doctors need this for SRS re-encrypted key unwrap in the browser.
    """
    if os.environ.get("FLASK_ENV") != "development":
        return api_error("Only available in development", 403)
    if "user_id" not in session:
        return api_error("Unauthorized", 401)

    user_id = session["user_id"]
    priv_path = Config.CLOUD_KEYS_USERS / f"{user_id}_private.pem"
    if not priv_path.exists():
        generate_user_keys(user_id)

    with open(priv_path, "r") as f:
        return api_success({"private_key": f.read()})


@bp.route("/clear-uploads", methods=["POST"])
def api_clear_uploads():
    """
    Development: remove ciphertext and metadata only (keep users, DB, SRS keys, user RSA keys).
    """
    if os.environ.get("FLASK_ENV") != "development":
        return api_error("Debug only", 403)

    try:
        removed_data = 0
        removed_meta = 0
        if Config.CLOUD_DATA.exists():
            for p in Config.CLOUD_DATA.iterdir():
                if p.is_file() and p.suffix.lower() == ".enc":
                    p.unlink()
                    removed_data += 1
        if Config.CLOUD_META.exists():
            for p in Config.CLOUD_META.iterdir():
                if p.is_file() and p.suffix.lower() == ".json":
                    p.unlink()
                    removed_meta += 1
        return api_success({
            "message": "PHR uploads cleared",
            "removed_enc_files": removed_data,
            "removed_meta_files": removed_meta,
        })
    except Exception as e:
        return api_error(str(e), 500)


@bp.route("/clear-audit-log", methods=["POST"])
def api_clear_audit_log():
    """Development: delete audit.log to fix a broken hash chain (e.g. concurrent writes before locking)."""
    if os.environ.get("FLASK_ENV") != "development":
        return api_error("Debug only", 403)
    try:
        if Config.AUDIT_LOG_PATH.exists():
            Config.AUDIT_LOG_PATH.unlink()
        return api_success({"message": "audit.log removed; new events will start a fresh chain."})
    except Exception as e:
        return api_error(str(e), 500)
