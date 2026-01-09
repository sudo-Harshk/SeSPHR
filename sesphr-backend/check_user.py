import sqlite3
import os
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

DB_PATH = "storage/sesphr.db"
ph = PasswordHasher()

def check_user(email, password):
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    try:
        cur.execute("SELECT user_id, email, role, password_hash FROM users WHERE email = ?", (email,))
        row = cur.fetchone()
        
        if row:
            print(f"User found: ID={row[0]}, Email={row[1]}, Role={row[2]}")
            stored_hash = row[3]
            try:
                ph.verify(stored_hash, password)
                print("Password verification: SUCCESS")
            except VerifyMismatchError:
                print("Password verification: FAILED")
            except Exception as e:
                print(f"Password verification ERROR: {e}")
        else:
            print(f"User {email} NOT found")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    check_user("patient.demo@sesphr.com", "123456789")
