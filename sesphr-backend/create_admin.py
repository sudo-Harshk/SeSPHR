import sys
import os
from getpass import getpass

# Add parent directory to path to allow importing modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from storage.users import create_admin_user
from storage.db import init_db

def main():
    print("=== Create Admin User ===")
    
    email = input("Email: ").strip()
    if not email:
        print("Email is required.")
        return

    password = getpass("Password: ").strip()
    if not password:
        print("Password is required.")
        return

    name = input("Name (optional): ").strip()
    
    try:
        init_db()
        user_id = create_admin_user(email, password, name if name else None)
        print(f"\nSUCCESS: Admin created with UUID: {user_id}")
    except ValueError as e:
        print(f"\nERROR: {e}")
    except Exception as e:
        print(f"\nFATAL ERROR: {e}")

if __name__ == "__main__":
    main()
