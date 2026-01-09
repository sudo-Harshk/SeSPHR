import sqlite3
import uuid
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from .db import get_connection, init_db

ph = PasswordHasher()

ALLOWED_ROLES = {"patient", "doctor", "admin"}

def hash_password(password):
    return ph.hash(password)

def verify_password(stored_hash, password):
    try:
        ph.verify(stored_hash, password)
        return True
    except VerifyMismatchError:
        return False

def create_user(email, password, role, name=None):
    if role not in ALLOWED_ROLES:
        raise ValueError(f"Invalid role. Allowed: {ALLOWED_ROLES}")
    
    # Generate UUID
    user_id = str(uuid.uuid4())
    password_hash = hash_password(password)
    
    conn = get_connection()
    cur = conn.cursor()
    
    try:
        cur.execute(
            "INSERT INTO users (user_id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)",
            (user_id, email, name, password_hash, role)
        )
        # Note: No attributes are inserted here. Restricted to Admin/CLI only.
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise ValueError("Email already registered")
    
    conn.close()
    return user_id

def create_admin_user(email, password, name=None):
    """
    Create a new admin user. Enforces admin role.
    """
    if not email or not password:
        raise ValueError("Email and password are required")

    return create_user(email, password, "admin", name)

def get_user_by_email(email):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT user_id, email, name, password_hash, role FROM users WHERE email = ?", (email,))
    row = cur.fetchone()
    conn.close()
    
    if row:
        return {
            "user_id": row[0],
            "email": row[1],
            "name": row[2],
            "password_hash": row[3],
            "role": row[4]
        }
    return None

def get_user_by_id(user_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT user_id, email, name, password_hash, role FROM users WHERE user_id = ?", (user_id,))
    row = cur.fetchone()
    conn.close()
    
    if row:
        return {
            "user_id": row[0],
            "email": row[1],
            "name": row[2],
            "password_hash": row[3],
            "role": row[4]
        }
    return None

def get_user_attributes(user_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT key, value FROM attributes WHERE user_id = ?", (user_id,))
    rows = cur.fetchall()
    conn.close()
    
    attributes = {}
    for key, value in rows:
        attributes[key] = value
    
    # Auto-derive Role attribute from users table if needed, or rely on explicit attributes?
    # User requested: "Optionally auto-assign Role:<role> attribute... but no others"
    # To keep it robust, let's fetch role from users table and append it if missing?
    # Or just return explicitly stored attributes.
    # Plan said: "Optionally auto-assign Role:<role> attribute... but no others"
    # Let's derive it to ensure CP-ABE policy works without manual admin step for basic role.
    
    user = get_user_by_id(user_id)
    if user:
        # Canonical role attribute. Capitalized to match CP-ABE convention in this system?
        # System uses "Role:Doctor" etc.
        role_attr = f"Role:{user['role'].capitalize()}"
        attributes["Role"] = user["role"].capitalize() # Or however policy expects it.
        # Actually traditionally attributes are a set of strings. 
        # But this function returns a dict {key: value}.
        # Existing encryption uses "Role:Doctor". 
        # So key is "Role", value is "Doctor".
        if "Role" not in attributes:
            attributes["Role"] = user["role"].capitalize()
            
    return attributes

def add_attribute(user_id, key, value):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT OR REPLACE INTO attributes (user_id, key, value) VALUES (?, ?, ?)",
            (user_id, key, value)
        )
        conn.commit()
    finally:
        conn.close()

def remove_attribute(user_id, key):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "DELETE FROM attributes WHERE user_id = ? AND key = ?",
            (user_id, key)
        )
        conn.commit()
    finally:
        conn.close()

def get_all_users_with_attributes():
    conn = get_connection()
    cur = conn.cursor()
    
    # Get all users
    cur.execute("SELECT user_id, email, name, role FROM users")
    users_rows = cur.fetchall()
    
    users = {}
    for r in users_rows:
        uid = r[0]
        users[uid] = {
            "user_id": uid,
            "email": r[1],
            "name": r[2],
            "role": r[3],
            "attributes": {}
        }
    
    # Get all attributes
    cur.execute("SELECT user_id, key, value FROM attributes")
    attr_rows = cur.fetchall()
    
    for r in attr_rows:
        uid, key, val = r[0], r[1], r[2]
        if uid in users:
            users[uid]["attributes"][key] = val
            
    conn.close()
    return users
