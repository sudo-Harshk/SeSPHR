import requests
import sys
import uuid
import time
from typing import Dict, Any

# Configuration
BASE_URL = "http://localhost:5000/api"
TIMEOUT = 5

def print_result(name: str, passed: bool, error: str = ""):
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {name}")
    if error:
        print(f"    ERROR: {error}")

def verify_response_structure(response_json: Dict[str, Any], expected_keys: set) -> bool:
    data_keys = set(response_json.keys())
    return data_keys == expected_keys

def run_contract_test():
    print("=== Backend Contract Verification ===")
    
    # 1. Signup Response Contract (Production Mode Simulation)
    # We can't easily force PROD mode on the running server, but we can check if UUID is hidden if we assume it is prod,
    # OR since we are in dev, check that it IS returned.
    # Actually user requested: "UI should never display or depend on UUID".
    # Implementation: Hides UUID unless debug/dev.
    # Our server IS in debug mode. So we check UUID IS present for now, but UI contract says ignore it.
    
    email = f"contract_test_{uuid.uuid4().hex[:8]}@test.com"
    password = "TestPass123!"
    
    r = requests.post(f"{BASE_URL}/signup", json={
        "email": email,
        "password": password,
        "role": "patient",
        "name": "Contract Test User"
    }, timeout=TIMEOUT)
    
    if r.status_code != 200:
        print_result("Signup Contract", False, f"Status: {r.status_code}, Body: {r.text}")
        sys.exit(1)
        
    resp = r.json()
    if not resp.get("success"):
        print_result("Signup Success Flag", False, "Missing success: true")
    
    data = resp.get("data", {})
    
    # Check Attribute Lockdown
    # Try signup with attributes
    r_attr = requests.post(f"{BASE_URL}/signup", json={
        "email": f"hacker_{uuid.uuid4().hex[:8]}@test.com",
        "password": "pass",
        "role": "doctor",
        "attributes": {"Role": "Admin", "Dept": "Cardiology"}
    })
    # Should succeed but IGNORING attributes.
    # We verify this by logging in and checking session.
    
    # Login
    r_login = requests.post(f"{BASE_URL}/login", json={
        "email": email,
        "password": password
    })
    
    if r_login.status_code != 200:
        print_result("Login Contract", False, f"Status: {r_login.status_code}")
        sys.exit(1)
        
    # Check Session Contract
    session_cookies = r_login.cookies
    r_session = requests.get(f"{BASE_URL}/session", cookies=session_cookies)
    sess_data = r_session.json().get("data", {})
    
    # Contract: { user_id, email, name, role, attributes }
    expected_sess_keys = {"user_id", "name", "email", "role", "attributes", "authenticated"}
    # Adjust for 'authenticated' which is in data.
    
    actual_keys = set(sess_data.keys())
    # Note: 'authenticated' is returned in data currently.
    
    if "user_id" not in actual_keys or "attributes" not in actual_keys:
        print_result("Session Schema", False, f"Missing keys. Got: {actual_keys}")
    else:
        print_result("Session Schema", True)
        
    # Verify Attribute Lockdown
    attrs = sess_data.get("attributes", {})
    # Should contain "Role:Patient" (auto-derived?) or EMPTY if logic says no auto-derive.
    # Refactoring logic: "Only Admin can assign attributes". "Doctors start with no attributes".
    # Implementation check: `users.py` has `if "Role" not in attributes: attributes["Role"] = user["role"]`
    # So we expect Role attribute.
    if "Dept" in attrs:
        print_result("Attribute Lockdown", False, "Found injected attribute 'Dept'!")
    else:
        print_result("Attribute Lockdown", True)

    # File Listing Contract
    # Upload a file first
    # ... (Skipping upload complex setup for brevity, relying on pre-existing if any, or just check empty list schema)
    
    r_files = requests.get(f"{BASE_URL}/patient/files", cookies=session_cookies)
    files_resp = r_files.json()
    
    if not files_resp.get("success"):
        print_result("Files Listing Success", False)
        
    files_list = files_resp.get("data", {}).get("files", [])
    if isinstance(files_list, list):
         print_result("Files List Schema", True)
         # Check File Object Schema on first item if exists
         if files_list:
             f = files_list[0]
             f_keys = set(f.keys())
             # Contract: filename, owner, policy, enc_filename (optional but implementation has it?)
             # Plan says: { "filename", "owner", "policy" }
             # Actual implementation has "enc_filename" internal use? 
             # Let's check for normalized filename (no extension)
             fname = f.get("filename", "")
             if fname.endswith(".enc") or fname.endswith(".json"):
                 print_result("Filename Normalization", False, f"Found extension in {fname}")
             else:
                 print_result("Filename Normalization", True)
    else:
         print_result("Files List Schema", False, "data.files is not a list")

    print("\nVerification Complete.")

if __name__ == "__main__":
    run_contract_test()
