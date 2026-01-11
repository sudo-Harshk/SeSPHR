
from flask import Blueprint, request, session, redirect, url_for
from app.services.storage.users import create_user, verify_password, get_user_by_email, get_user_by_id, get_user_attributes
from app.services.audit.logger import audit_deny
from app.services.utils import api_success, api_error
import os

bp = Blueprint('auth', __name__, url_prefix='/api')

@bp.route("/signup", methods=["POST"])
def api_signup():
    data = request.json or {}
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    role = data.get("role")

    if not email or not password or not role:
        return api_error("email, password, and role are required", 400)
    
    if role not in ["patient", "doctor"]:
        return api_error("Invalid role. Must be patient or doctor", 400)
    
    if "@" not in email:
        return api_error("Invalid email format", 400)
    
    try:
        user_id = create_user(email, password, role, name)
        
        # Generate keys for the new user immediately
        from app.services.crypto.keys import generate_user_keys
        generate_user_keys(user_id)
        
        response_data = {"email": email, "role": role}
        if os.environ.get("FLASK_ENV") == "development":
            response_data["user_id"] = user_id

        return api_success({
            "message": "User created successfully",
            "data": response_data
        })
    except ValueError as e:
        return api_error(str(e), 400)
    except Exception as e:
        return api_error(f"Failed to create user: {str(e)}", 500)

@bp.route("/login", methods=["POST"])
def api_login():
    data = request.json or {}
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return api_error("email and password are required", 400)
    
    user = get_user_by_email(email)
    
    if not user or not verify_password(user["password_hash"], password):
        audit_deny(email, None, "DENIED_AUTH")
        return api_error("Invalid credentials", 401)
    
    user_id = user["user_id"]
    role = user["role"]
    
    session.permanent = True
    session["user_id"] = user_id
    session["role"] = role
    session.modified = True

    return api_success({
        "user": user_id, 
        "role": role
    })

@bp.route("/session")
def api_session():
    if "user_id" not in session:
        return api_error("Unauthorized", 401)

    user_id = session["user_id"]
    user = get_user_by_id(user_id)
    if not user:
        session.clear()
        return api_error("User not found", 401)
        
    attributes = get_user_attributes(user_id)
    
    return api_success({
        "authenticated": True,
        "user_id": user_id,
        "name": user.get("name"),
        "email": user.get("email"),
        "role": user.get("role"),
        "attributes": attributes
    })

@bp.route("/logout", methods=["POST"])
def api_logout():
    session.clear()
    return api_success({"status": "logged_out"})
