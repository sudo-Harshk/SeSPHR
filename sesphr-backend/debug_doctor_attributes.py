import sqlite3
import sys
import os

# Add project root to path
sys.path.append(os.getcwd())

from storage.users import get_connection, get_user_attributes
from policy.parser import evaluate_policy

class MockUser:
    def __init__(self, attributes):
        self.attributes = attributes

def debug_doctor_access():
    conn = get_connection()
    cur = conn.cursor()
    
    # 1. Find a doctor
    print("\n--- Finding Doctors ---")
    cur.execute("SELECT user_id, email, name, role FROM users WHERE role = 'doctor'")
    doctors = cur.fetchall()
    
    if not doctors:
        print("No doctors found in DB.")
        return

    for doc in doctors:
        user_id, email, name, role = doc
        print(f"\nChecking Doctor: {email} (ID: {user_id})")
        
        # 2. Get Attributes
        attributes = get_user_attributes(user_id)
        print(f"Attributes: {attributes}")
        
        # 3. Simulate Policy Check "Role:Doctor"
        user = MockUser(attributes)
        policy = "Role:Doctor"
        
        try:
            result = evaluate_policy(user, policy)
            print(f"Policy '{policy}' Evaluation: {result}")
        except Exception as e:
            print(f"Policy Evaluation Error: {e}")

        # 4. Simulate Casing Mismatch Check
        policy_lower = "Role:doctor"
        try:
             result = evaluate_policy(user, policy_lower)
             print(f"Policy '{policy_lower}' Evaluation: {result}")
        except:
            pass

    conn.close()

if __name__ == "__main__":
    debug_doctor_access()
