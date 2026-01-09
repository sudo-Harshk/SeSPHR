import requests
import os
import json
import time

BASE_URL = "http://localhost:5000/api"

def test_full_flow():
    session = requests.Session()
    
    # 1. Patient Upload
    print("\n--- 1. Patient Upload ---")
    login_payload = {"email": "patient.demo@sesphr.com", "password": "123456789"}
    res = session.post(f"{BASE_URL}/login", json=login_payload)
    if res.status_code != 200:
        print(f"Patient Login Failed: {res.text}")
        return
    print("Patient Login: OK")

    filename = f"record_{int(time.time())}.txt"
    with open(filename, "w") as f:
        f.write("Confidential Medical Record")
        
    try:
        with open(filename, 'rb') as f:
            files = {'file': f}
            # Policy requires Doctor role
            data = {'policy': 'Role:Doctor'} 
            res = session.post(f"{BASE_URL}/patient/upload", files=files, data=data)
        
        if res.status_code == 200:
             print(f"Upload OK: {res.json()['data']['filename']}")
             uploaded_filename = res.json()['data']['filename']
        else:
             print(f"Upload Failed: {res.text}")
             return
    finally:
        if os.path.exists(filename):
            os.remove(filename)
            
    # 2. Doctor Access
    print("\n--- 2. Doctor Access ---")
    
    # Create a fresh doctor to ensure clean state
    # (Auto-derivation logic should give them Role:Doctor)
    doc_email = f"doc_{int(time.time())}@test.com"
    doc_payload = {"email": doc_email, "password": "password123", "role": "doctor", "name": "Dr. Test"}
    
    # Signup
    res = session.post(f"{BASE_URL}/signup", json=doc_payload)
    if res.status_code != 200:
        print(f"Doctor Signup Failed: {res.text}")
        return
    print(f"Doctor Created: {doc_email}")
    
    # Login
    login_payload = {"email": doc_email, "password": "password123"}
    res = session.post(f"{BASE_URL}/login", json=login_payload)
    if res.status_code != 200:
        print(f"Doctor Login Failed: {res.text}")
        return
    print("Doctor Login: OK")
    
    # Access File
    # We normalized filename in upload response, but access might need exact name?
    # api_doctor_access expects "file" which is usually the normalized name?
    # Let's try the normalized name we got back.
    
    print(f"Attempting access to: {uploaded_filename}")
    access_payload = {"file": uploaded_filename}
    res = session.post(f"{BASE_URL}/doctor/access", json=access_payload)
    
    print(f"Access Response Code: {res.status_code}")
    print(f"Access Response Body: {res.text}")
    
    if res.status_code == 200 and res.json().get('data', {}).get('status') == 'granted':
        print("SUCCESS: Access Granted!")
    else:
        print("FAILURE: Access Denied.")

if __name__ == "__main__":
    test_full_flow()
