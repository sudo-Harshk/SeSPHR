
from flask import Blueprint, request, session
import os
import json
from app.services.storage.users import get_all_users_with_attributes, get_user_by_id, add_attribute, remove_attribute
from app.services.utils import api_success, api_error
from config import Config

bp = Blueprint('admin', __name__, url_prefix='/api/admin')

@bp.route("/users")
def api_users():
    if "user_id" not in session or session.get("role") != "admin":
        return api_error("Unauthorized", 403)

    try:
        users = get_all_users_with_attributes()
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
            return api_success({"logs": []})
        
        logs = []
        with open(Config.AUDIT_LOG_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line: continue
                try:
                    logs.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
        
        logs.sort(key=lambda x: x.get("timestamp", 0), reverse=True)
        return api_success({"logs": logs})
    except Exception as e:
        return api_error(str(e), 500)
