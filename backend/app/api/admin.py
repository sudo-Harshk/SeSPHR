
from flask import Blueprint, request, session
import os
import csv
import json
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
