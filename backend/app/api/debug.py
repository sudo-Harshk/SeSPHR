
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
