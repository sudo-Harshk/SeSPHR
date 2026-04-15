"""
Demo seed script — creates pre-configured accounts for the live demo.

Accounts created:
  patient1@demo.com   / Demo@1234   (role: patient)
  patient2@demo.com   / Demo@1234   (role: patient)
  dr_cardio@demo.com  / Demo@1234   (role: doctor, Dept: Cardiology)
  dr_ortho@demo.com   / Demo@1234   (role: doctor, Dept: Orthopedics)
  admin@demo.com      / Demo@1234   (role: admin)

Run from the backend/ directory:
  python seed_demo_users.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.services.storage.db import init_db
from app.services.storage.users import create_user, get_user_by_email, add_attribute
from app.services.crypto.keys import generate_user_keys
from config import Config

PASSWORD = "Demo@1234"

USERS = [
    {"email": "patient1@demo.com",  "name": "Alice (Patient 1)", "role": "patient",  "attributes": {}},
    {"email": "patient2@demo.com",  "name": "Bob (Patient 2)",   "role": "patient",  "attributes": {}},
    {"email": "dr_cardio@demo.com", "name": "Dr. Raj Cardio",    "role": "doctor",   "attributes": {"Dept": "Cardiology", "Speciality": "Cardiac"}},
    {"email": "dr_ortho@demo.com",  "name": "Dr. Priya Ortho",   "role": "doctor",   "attributes": {"Dept": "Orthopedics"}},
    {"email": "admin@demo.com",     "name": "System Admin",      "role": "admin",    "attributes": {}},
]

def seed():
    print("Initialising database...")
    init_db()

    for u in USERS:
        existing = get_user_by_email(u["email"])
        if existing:
            print(f"  SKIP  {u['email']} (already exists)")
            continue

        user_id = create_user(u["email"], PASSWORD, u["role"], u["name"])
        generate_user_keys(user_id)

        for k, v in u["attributes"].items():
            add_attribute(user_id, k, v)

        print(f"  OK    {u['email']} ({u['role']}) — user_id: {user_id}")

    print("\nDone. Demo credentials:")
    print(f"  {'Email':<28} {'Password':<14} Role")
    print("  " + "-" * 60)
    for u in USERS:
        print(f"  {u['email']:<28} {PASSWORD:<14} {u['role']}")

if __name__ == "__main__":
    seed()
