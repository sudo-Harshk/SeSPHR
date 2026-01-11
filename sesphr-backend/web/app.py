from flask import Flask, render_template, request, redirect, session, url_for, jsonify, make_response, send_file
# from flask_cors import CORS  # Disabled for dev - using Vite proxy instead
import os
import sys
import json
from pathlib import Path
from datetime import timedelta

# #region agent log
def write_debug_log(location, message, data, hypothesis_id="A", run_id="run1"):
    """Helper function to write debug logs"""
    log_path = Path(r"d:\Projects\Personal\Mtech-FinalYear-Project\801\sesphr\.cursor\debug.log")
    try:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        import time
        log_entry = {
            "sessionId": "debug-session",
            "runId": run_id,
            "hypothesisId": hypothesis_id,
            "location": location,
            "message": message,
            "data": data,
            "timestamp": int(time.time() * 1000)
        }
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry) + "\n")
            f.flush()
        # Also print to console for verification
        print(f"[DEBUG LOG] {location}: {message}", file=sys.stderr)
    except Exception as e:
        # Fallback: print to stderr so we can see if logging fails
        print(f"DEBUG LOG ERROR in {location}: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
# #endregion

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from storage.phr import store_phr
from storage.access import access_phr
from storage.users import (
    create_user, add_attribute, remove_attribute, 
    verify_password, get_user_by_id, get_user_by_email, get_user_attributes,
    get_all_users_with_attributes
)
from storage.db import get_connection, init_db
from web.utils import api_success, api_error
from web.utils import api_success, api_error
from audit.logger import audit_deny
from crypto.keys import get_or_create_srs_key, get_user_public_key, generate_user_keys

app = Flask(__name__)
# CORS(app, supports_credentials=True, origins=["http://localhost:5173"])  # Disabled for dev - using Vite proxy instead
app.secret_key = "sesphr-secret-key"

app.config.update(
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=False,
    SESSION_COOKIE_HTTPONLY=True,
)

app.permanent_session_lifetime = timedelta(hours=24)

@app.after_request
def after_request(response):
    if session.modified:
        session.permanent = True
        
    set_cookie_headers = response.headers.getlist("Set-Cookie")
    set_cookie_str = ", ".join(set_cookie_headers) if set_cookie_headers else "NOT_SET_YET"
    write_debug_log(
        "app.py:after_request",
        "Response headers after request",
        {
            "path": request.path,
            "method": request.method,
            "set_cookie_header": set_cookie_str,
            "set_cookie_count": len(set_cookie_headers),
            "session_modified": session.modified,
            "session_accessed": session.accessed if hasattr(session, 'accessed') else 'unknown',
            "session_keys": list(session.keys()) if session else [],
            "session_user_id": session.get("user_id"),
            "session_role": session.get("role"),
            "session_empty": not bool(session)
        },
        hypothesis_id="A"
    )
    # #endregion
    
    return response


@app.route("/", methods=["GET", "POST"])
def login():
    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/api/signup", methods=["POST"])
def api_signup():
    """Create a new user account with name, email, password and role"""
    data = request.json or {}
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    role = data.get("role")

    # Validate input
    if not email or not password or not role:
        return api_error("email, password, and role are required", 400)
    
    if role not in ["patient", "doctor"]:
        # Admin signup disabled via public API
        return api_error("Invalid role. Must be patient or doctor", 400)
    
    if "@" not in email:
        return api_error("Invalid email format", 400)
    
    # Security: Do not accept ANY attributes payload
    if "attributes" in data:
         # Log warning but proceed? Or strict fail? 
         # User said "Do NOT accept attributes payload". Ignoring it is safer than failing silently.
         pass
    
    try:
        # Create user (this handles email uniqueness and UUID generation)
        # Note: create_user returns user_id (UUID)
        user_id = create_user(email, password, role, name)
        
        # NOTE: Attribute assignment is STRICTLY forbidden here per security policy.
        # Only Admin can assign attributes via separate flow.
        
        # Strict Contract:
        # 1. Attributes are strictly forbidden here.
        # 2. UUID IS HIDDEN unless in development mode.
        
        response_data = {
            "email": email,
            "role": role
        }
        
        # Only expose UUID in dev/debug mode
        if app.debug or os.environ.get("FLASK_ENV") == "development":
            response_data["user_id"] = user_id

        return api_success({
            "message": "User created successfully",
            "data": response_data
        })
    except ValueError as e:
        return api_error(str(e), 400)
    except Exception as e:
        return api_error(f"Failed to create user: {str(e)}", 500)


@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.json or {}
    email = data.get("email")
    password = data.get("password")

    # Validate input
    if not email or not password:
        return api_error("email and password are required", 400)
    
    if "@" not in email:
        return api_error("Invalid email format", 400)
    
    # Authenticate user using new email-based lookup
    user = get_user_by_email(email)
    
    # Verify password if user found
    if not user or not verify_password(user["password_hash"], password):
        # Use generic log identifier since we might not have a reliable ID yet
        audit_deny(email, None, "DENIED_AUTH")
        return api_error("Invalid credentials", 401)
    
    user_id = user["user_id"]
    role = user["role"]
    
    session.permanent = True
    session["user_id"] = user_id
    session["role"] = role
    
    # Force Flask to save session
    session.modified = True
    _ = session.accessed

    return api_success({
        "user": user_id, 
        "role": role
    })


@app.route("/api/session")
def api_session():
    if "user_id" not in session:
        return api_error("Unauthorized", 401)

    user_id = session["user_id"]
    
    # Fetch user details
    user = get_user_by_id(user_id)
    if not user:
        session.clear()
        return api_error("User not found", 401)
        
    # Load attributes dynamically
    attributes = get_user_attributes(user_id)
    
    return api_success({
        "authenticated": True,
        "user_id": user_id,
        "name": user.get("name"),
        "email": user.get("email"),
        "role": user.get("role"),
        "attributes": attributes
    })


@app.route("/api/logout", methods=["POST"])
def api_logout():
    session.clear()
    return api_success({"status": "logged_out"})


# Patient APIs
@app.route("/api/patient/files")
def api_patient_files():
    # Check authentication
    if "user_id" not in session:
        audit_deny("anonymous", None, "DENIED_AUTH")
        return api_error("Unauthorized", 401)
    
    # Verify role
    if session.get("role") != "patient":
        audit_deny(session.get("user_id", "unknown"), None, "DENIED_ROLE")
        return api_error("Forbidden: patient role required", 403)

    files = []
    if os.path.exists("cloud/meta"):
        for meta_filename in os.listdir("cloud/meta"):
            if not meta_filename.endswith(".json"):
                continue
            
            meta_path = os.path.join("cloud/meta", meta_filename)
            try:
                with open(meta_path, "r") as f:
                    meta = json.load(f)
                
                # Extract original filename from metadata or derive from meta_filename
                original_filename = meta.get("file", meta_filename).replace(".enc", "")
                if original_filename == meta_filename:
                    # If meta["file"] not available, strip .json from meta_filename
                    original_filename = meta_filename.replace(".json", "")
                
                # Get canonical encrypted filename from metadata
                enc_filename = meta.get("file", meta_filename.replace(".json", ".enc"))
                if not enc_filename.endswith(".enc"):
                    enc_filename = f"{original_filename}.enc"
                
                files.append({
                    "filename": original_filename.replace(".enc", "").replace(".json", ""), # Normalized: NO EXTENSION
                    "owner": meta.get("owner", None), # Strict: null if missing, not "Unknown"
                    "policy": meta.get("policy", None) # Strict: null if missing, not "N/A"
                })
            except (json.JSONDecodeError, IOError) as e:
                # Skip corrupted metadata files
                continue

    return api_success({"files": files})


@app.route("/api/patient/upload", methods=["POST"])
def api_patient_upload():
    if session.get("role") != "patient":
        return {"error": "unauthorized"}, 403

    file = request.files["file"]
    policy = request.form["policy"]

    file_path = os.path.join("tests", file.filename)
    file.save(file_path)

    store_phr(session["user_id"], file_path, policy)

    # Return standardized success response with file details for UI update
    return api_success({
        "message": "File uploaded successfully",
        "filename": file.filename.replace(".enc", "").replace(".json", ""), # Normalized
        "policy": policy,
        "owner": session["user_id"]
    })


@app.route("/api/patient/revoke", methods=["POST"])
def api_patient_revoke():
    """Revoke access to a PHR file by updating its policy (policy-only, AES key unchanged)"""
    # Check authentication
    if "user_id" not in session:
        data = request.json or {}
        filename = data.get("filename", "unknown")
        audit_deny("anonymous", filename, "DENIED_AUTH")
        return api_error("Unauthorized", 401)
    
    # Verify role
    if session.get("role") != "patient":
        data = request.json or {}
        filename = data.get("filename", "unknown")
        audit_deny(session["user_id"], filename, "DENIED_ROLE")
        return api_error("Forbidden: patient role required", 403)
    
    data = request.json or {}
    filename = data.get("filename")
    
    if not filename:
        audit_deny(session["user_id"], "unknown", "INVALID_REQUEST")
        return api_error("Filename required", 400)
    
    # Find metadata file
    meta_filename = filename if filename.endswith(".json") else f"{filename}.json"
    meta_path = os.path.join("cloud/meta", meta_filename)
    
    if not os.path.exists(meta_path):
        audit_deny(session["user_id"], filename, "INVALID_REQUEST")
        return api_error("File not found", 404)
    
    # Read metadata
    with open(meta_path, "r") as f:
        meta = json.load(f)
    
    # Verify ownership
    if meta.get("owner") != session["user_id"]:
        audit_deny(session["user_id"], filename, "DENIED_OWNER")
        return api_error("Forbidden: not file owner", 403)
    
    # ✅ REVOKE = change policy only (AES key remains unchanged)
    # This preserves cryptographic correctness and file recoverability
    meta["policy"] = "Role:__REVOKED__"
    
    # CRITICAL SECURITY FIX:
    # Also update the policy inside the "encrypted" key blob.
    # Since we are using SimulatedCPABE, the blob is JSON and contains the policy.
    # If we don't update this, the crypto/access layer will still see the OLD policy 
    # (e.g. "Role:Doctor") inside the blob and grant access!
    try:
        key_blob = json.loads(meta["aes_key"])
        key_blob["policy"] = "Role:__REVOKED__"
        meta["aes_key"] = json.dumps(key_blob)
    except Exception as e:
        # Should not happen in simulation, but log if blob is corrupt
        print(f"REVOCATION WARNING: Failed to update key blob: {e}", file=sys.stderr)
    
    # Save updated metadata
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)
    
    # Audit log
    from audit.logger import log_event
    log_event(session["user_id"], filename, "REVOKE", "SUCCESS")
    
    return api_success({"status": "revoked", "filename": filename})


# Doctor APIs
@app.route("/api/doctor/files")
def api_doctor_files():
    # #region agent log
    write_debug_log(
        "app.py:api_doctor_files",
        "Protected endpoint request",
        {
            "cookie_header": request.headers.get("Cookie", "NOT_PRESENT"),
            "origin": request.headers.get("Origin", "NOT_PRESENT"),
            "session_keys": list(session.keys()) if session else [],
            "session_user_id": session.get("user_id"),
            "session_role": session.get("role"),
            "role_check": session.get("role") == "doctor"
        },
        hypothesis_id="D"
    )
    # #endregion
    
    # Check authentication
    if "user_id" not in session:
        audit_deny("anonymous", None, "DENIED_AUTH")
        return api_error("Unauthorized", 401)
    
    # Verify role
    if session.get("role") != "doctor":
        audit_deny(session.get("user_id", "unknown"), None, "DENIED_ROLE")
        return api_error("Forbidden: doctor role required", 403)

    files = []
    if os.path.exists("cloud/data"):
        for enc_filename in os.listdir("cloud/data"):
            if not enc_filename.endswith(".enc"):
                continue
            
            # Find matching metadata JSON file
            meta_filename = enc_filename.replace(".enc", ".json")
            meta_path = os.path.join("cloud/meta", meta_filename)
            
            if os.path.exists(meta_path):
                try:
                    with open(meta_path, "r") as f:
                        meta = json.load(f)
                    
                    # Extract original filename (remove .enc extension)
                    original_filename = enc_filename.replace(".enc", "")
                    
                    files.append({
                        "filename": original_filename,  # Display name
                        "enc_filename": enc_filename,   # Canonical encrypted filename
                        "owner": meta.get("owner", "Unknown"),
                        "policy": meta.get("policy", "N/A")
                    })
                except (json.JSONDecodeError, IOError) as e:
                    # Skip corrupted metadata files
                    continue
            else:
                # Metadata not found, return basic info
                original_filename = enc_filename.replace(".enc", "")
                files.append({
                    "filename": original_filename,  # Normalization handled by replace
                    "owner": None,
                    "policy": None
                })

    return api_success({"files": files})


@app.route("/api/doctor/access", methods=["POST"])
def api_doctor_access():
    # Check authentication
    if "user_id" not in session:
        data = request.json or {}
        filename = data.get("file", "unknown")
        audit_deny("anonymous", filename, "DENIED_AUTH")
        return api_error("Unauthorized", 401)
    
    # Verify role
    if session.get("role") != "doctor":
        data = request.json or {}
        filename = data.get("file", "unknown")
        audit_deny(session["user_id"], filename, "DENIED_ROLE")
        return api_error("Forbidden: doctor role required", 403)

    data = request.json
    filename = data["file"]
    
    # Ensure filename refers to the encrypted file
    if not filename.endswith(".enc"):
        filename = f"{filename}.enc"
    
    # Use absolute path to ensure send_file finds it
    out_dir = project_root / "tests"
    if not out_dir.exists():
        out_dir.mkdir(parents=True)
        
    out_path = str(out_dir / f"web_{filename.replace('.enc','')}")

    try:
        access_phr(session["user_id"], filename, out_path)
        
        # Check for download flag in BODY (standard) or QUERY PARAM (frontend behavior)
        if data.get("download") or request.args.get("download") == "true":
            # Return binary stream
            return send_file(out_path, as_attachment=True, download_name=filename.replace('.enc', ''))
            
        return api_success({"status": "granted"})
    except Exception as e:
        return api_error(str(e), 403)


# Admin APIs
@app.route("/api/admin/users")
def api_admin_users():
    # Check authentication
    if "user_id" not in session:
        return api_error("Unauthorized", 401)
    
    # Verify admin role
    if session.get("role") != "admin":
        return api_error("Forbidden: admin role required", 403)

    try:
        users = get_all_users_with_attributes()
        return api_success({"users": users})
    except Exception as e:
        return api_error(f"Failed to load users: {str(e)}", 500)


@app.route("/api/admin/attributes", methods=["POST"])
def api_admin_attributes():
    """Assign or remove attributes for a user"""
    # Check authentication
    if "user_id" not in session:
        return api_error("Unauthorized", 401)
    
    # Verify admin role
    if session.get("role") != "admin":
        return api_error("Forbidden: admin role required", 403)
    
    data = request.json
    action = data.get("action")  # "add" or "remove"
    target_user_id = data.get("user_id")
    key = data.get("key")
    value = data.get("value")
    
    # Validate input
    if not action or action not in ["add", "remove"]:
        return api_error("Invalid action. Must be 'add' or 'remove'", 400)
    
    if not target_user_id or not key:
        return api_error("user_id and key are required", 400)
    
    if action == "add" and not value:
        return api_error("value is required for add action", 400)
    
    # Check if target user exists
    target_user = get_user_by_id(target_user_id)
    if not target_user:
        return api_error("Target user not found", 404)
    
    try:
        if action == "add":
            add_attribute(target_user_id, key, value)
            return api_success({
                "message": "Attribute added successfully",
                "user_id": target_user_id,
                "key": key,
                "value": value
            })
        else:  # remove
            remove_attribute(target_user_id, key)
            return api_success({
                "message": "Attribute removed successfully",
                "user_id": target_user_id,
                "key": key
            })
    except Exception as e:
        return api_error(f"Failed to update attribute: {str(e)}", 500)


@app.route("/api/admin/audit")
def api_admin_audit():
    if session.get("role") != "admin":
        return {"error": "unauthorized"}, 403

    logs = []
    if os.path.exists("audit/audit.log"):
        with open("audit/audit.log") as f:
            logs = f.readlines()

    return {"logs": logs}


@app.route("/api/audit/logs")
def api_audit_logs():
    # Check authentication
    if "user_id" not in session:
        return api_error("Unauthorized", 401)
    
    # Verify admin role
    if session.get("role") != "admin":
        return api_error("Forbidden: admin role required", 403)
    
    try:
        audit_log_path = "audit/audit.log"
        
        # Check if audit log file exists
        if not os.path.exists(audit_log_path):
            return api_success({"logs": []})
        
        # Read and parse audit log entries
        logs = []
        with open(audit_log_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                
                try:
                    entry = json.loads(line)
                    logs.append(entry)
                except json.JSONDecodeError:
                    # Skip invalid JSON lines
                    continue
        
        # Sort by timestamp (latest first)
        logs.sort(key=lambda x: x.get("timestamp", 0), reverse=True)
        
        return api_success({"logs": logs})
    
    except Exception as e:
        return api_error(f"Failed to read audit logs: {str(e)}", 500)


@app.route("/api/srs/public-key")
def api_srs_public_key():
    """Return the SRS Public Key (PEM)"""
    try:
        _, public_key_pem = get_or_create_srs_key()
        return api_success({"public_key": public_key_pem.decode("utf-8")})
    except Exception as e:
        return api_error(f"Failed to retrieve SRS key: {str(e)}", 500)


@app.route("/api/debug/gen-keys/<user_id>", methods=["POST"])
def api_debug_gen_keys(user_id):
    """Debug endpoint to generate keys for a specific user"""
    if not app.debug and os.environ.get("FLASK_ENV") != "development":
         return api_error("Debug only", 403)
         
    try:
        generate_user_keys(user_id)
        return api_success({"message": f"Keys generated for {user_id}"})
    except Exception as e:
        return api_error(str(e), 500)





@app.route("/patient")
def patient_dashboard():
    if session.get("role") != "patient":
        return redirect(url_for("login"))
    return render_template("patient_dashboard.html", user=session["user_id"])


@app.route("/patient/upload", methods=["GET", "POST"])
def upload_phr():
    if session.get("role") != "patient":
        return redirect(url_for("login"))

    if request.method == "POST":
        file = request.files["file"]
        policy = request.form["policy"]

        file_path = os.path.join("tests", file.filename)
        file.save(file_path)

        store_phr(session["user_id"], file_path, policy)

        return redirect(url_for("patient_dashboard"))

    return render_template("upload_phr.html")


@app.route("/doctor")
def doctor_dashboard():
    if session.get("role") != "doctor":
        return redirect(url_for("login"))
    return render_template("doctor_dashboard.html", user=session["user_id"])


@app.route("/doctor/records")
def doctor_records():
    if session.get("role") != "doctor":
        return redirect(url_for("login"))

    files = []
    if os.path.exists("cloud/data"):
        files = os.listdir("cloud/data")

    return render_template(
        "doctor_records.html",
        files=files,
        user=session["user_id"]
    )


@app.route("/doctor/access/<filename>")
def doctor_access(filename):
    if session.get("role") != "doctor":
        return redirect(url_for("login"))

    output_path = os.path.join("tests", f"web_{filename.replace('.enc', '')}")

    try:
        access_phr(session["user_id"], filename, output_path)
        message = "Access granted. File decrypted successfully."
    except Exception as e:
        message = f"Access denied: {str(e)}"

    return render_template(
        "doctor_result.html",
        message=message
    )


@app.route("/admin")
def admin_dashboard():
    if session.get("role") != "admin":
        return redirect(url_for("login"))
    return render_template("admin_dashboard.html", user=session["user_id"])


@app.route("/admin/users", methods=["GET", "POST"])
def admin_users():
    if session.get("role") != "admin":
        return redirect(url_for("login"))

    message = ""

    if request.method == "POST":
        action = request.form["action"]
        user_id = request.form["user_id"]

        try:
            if action == "create":
                create_user(user_id)
                message = "User created successfully"

            elif action == "add_attr":
                key = request.form["key"]
                value = request.form["value"]
                add_attribute(user_id, key, value)
                message = "Attribute added"

            elif action == "remove_attr":
                key = request.form["key"]
                remove_attribute(user_id, key)
                message = "Attribute removed"

        except Exception as e:
            message = str(e)

    users = load_users()
    return render_template(
        "admin_users.html",
        users=users.values(),
        message=message
    )


@app.route("/admin/audit")
def admin_audit():
    if session.get("role") != "admin":
        return redirect(url_for("login"))

    logs = []
    if os.path.exists("audit/audit.log"):
        with open("audit/audit.log", "r") as f:
            logs = f.readlines()

    return render_template("admin_audit.html", logs=logs)


if __name__ == "__main__":
    # #region agent log
    write_debug_log(
        "app.py:startup",
        "Flask server starting",
        {"config": {"samesite": app.config.get("SESSION_COOKIE_SAMESITE"), "secure": app.config.get("SESSION_COOKIE_SECURE")}},
        hypothesis_id="STARTUP",
        run_id="run1"
    )
    # #endregion
    # Initialize SRS identity
    print("Initializing SRS Keys...", file=sys.stderr)
    get_or_create_srs_key()
    
    app.run(host="localhost", port=5000, debug=True)
