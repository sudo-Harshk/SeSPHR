#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
End-to-End Automated Test Harness for SeSPHR

This script performs comprehensive testing of all major workflows:
- Authentication & Session Management
- Patient Workflow (Upload, Revoke)
- Doctor Workflow (Access Control, Download)
- Admin/Audit Workflow (Logs, Hash Chain Integrity)
- Security Controls (Role-Based Access Control)

Usage:
    python full_system_test.py

Output:
    - test_report.json: Machine-readable JSON report
    - Console: Human-readable summary with pass/fail indicators
"""

import sys
import io
# Fix Windows console encoding issues
# if sys.platform == 'win32':
#     sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
#     sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import requests
import json
import time
import hashlib
import os
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Configuration
BASE_URL = "http://localhost:5000/api"  
REPORT_FILE = Path(__file__).parent / "test_report.json"
SAMPLE_FILE = Path(__file__).parent / "sample.txt"
TEST_DOWNLOAD_DIR = Path(__file__).parent
CLOUD_META_DIR = Path(__file__).parent.parent / "cloud" / "meta"
CLOUD_DATA_DIR = Path(__file__).parent.parent / "cloud" / "data"

# Test users (populated dynamically)
PATIENT = {}
DOCTOR = {}
ADMIN = {}


class TestResult:
    """Represents a single test result"""
    def __init__(self, test_name: str, expected: str, actual: str, 
                 status: str, duration_ms: float):
        self.test_name = test_name
        self.expected = expected
        self.actual = actual
        self.status = status
        self.duration_ms = duration_ms
    
    def to_dict(self) -> Dict:
        return {
            "test_name": self.test_name,
            "status": self.status,
            "expected": self.expected,
            "actual": self.actual,
            "duration_ms": round(self.duration_ms, 2)
        }


class TestRunner:
    """Main test runner class"""
    
    def __init__(self):
        self.results: List[TestResult] = []
        self.start_time = time.time()
        self.uploaded_filename: Optional[str] = None
        
    def run_test(self, test_name: str, test_func) -> bool:
        """Run a single test and record the result"""
        start = time.time()
        try:
            expected, actual, passed = test_func()
            duration_ms = (time.time() - start) * 1000
            status = "PASS" if passed else "FAIL"
            self.results.append(TestResult(test_name, expected, actual, status, duration_ms))
            return passed
        except Exception as e:
            duration_ms = (time.time() - start) * 1000
            self.results.append(TestResult(
                test_name, 
                "Test should complete without exception",
                f"Exception: {str(e)}",
                "FAIL",
                duration_ms
            ))
            return False
    
    def generate_report(self) -> Dict:
        """Generate final test report"""
        total_time = time.time() - self.start_time
        passed = sum(1 for r in self.results if r.status == "PASS")
        failed = sum(1 for r in self.results if r.status == "FAIL")
        
        return {
            "summary": {
                "total_tests": len(self.results),
                "passed": passed,
                "failed": failed,
                "execution_time_sec": round(total_time, 2)
            },
            "tests": [r.to_dict() for r in self.results]
        }
    
    def save_report(self):
        """Save JSON report to file"""
        report = self.generate_report()
        REPORT_FILE.write_text(json.dumps(report, indent=2))
        return report
    
    def print_summary(self):
        """Print human-readable summary to console"""
        report = self.generate_report()
        summary = report["summary"]
        
        print("\n" + "="*70)
        print("SeSPHR End-to-End Test Report")
        print("="*70)
        print(f"Total Tests: {summary['total_tests']}")
        print(f"Passed: {summary['passed']}")
        print(f"Failed: {summary['failed']}")
        print(f"Execution Time: {summary['execution_time_sec']}s")
        print("="*70)
        
        print("\n[PASS] PASSED TESTS:")
        print("-" * 70)
        for result in self.results:
            if result.status == "PASS":
                print(f"[PASS] {result.test_name}")
        
        print("\n[FAIL] FAILED TESTS:")
        print("-" * 70)
        for result in self.results:
            if result.status == "FAIL":
                print(f"[FAIL] {result.test_name}")
                print(f"  Expected: {result.expected}")
                print(f"  Actual: {result.actual}")
        
        print("\n" + "="*70)

def cleanup_cloud_storage():
    """Wipe cloud storage to ensure fresh test state"""
    if CLOUD_META_DIR.exists():
        shutil.rmtree(CLOUD_META_DIR)
    if CLOUD_DATA_DIR.exists():
        shutil.rmtree(CLOUD_DATA_DIR)
    
    # Recreate empty dirs
    os.makedirs(CLOUD_META_DIR, exist_ok=True)
    os.makedirs(CLOUD_DATA_DIR, exist_ok=True)
    print(f"[SETUP] Wiped cloud storage: {CLOUD_META_DIR}, {CLOUD_DATA_DIR}")

def setup_test_users(session: requests.Session) -> bool:
    """Create fresh test users for this run"""
    timestamp = int(time.time())
    
    # 1. Signup Patient
    p_email = f"patient_{timestamp}@test.com"
    p_pass = "PatientPass123!"
    r = requests.post(f"{BASE_URL}/signup", json={
        "email": p_email,
        "password": p_pass,
        "role": "patient",
        "name": "Test Patient"
    })
    if r.status_code != 200:
        print(f"Failed to create patient: {r.text}")
        return False
    # API returns {data: {data: {user_id: ...}}}
    PATIENT.update({"email": p_email, "password": p_pass, "user_id": r.json()["data"]["data"]["user_id"]})
    print(f"[SETUP] Created patient: {p_email}")

    # 2. Signup Doctor
    d_email = f"doctor_{timestamp}@test.com"
    d_pass = "DoctorPass123!"
    r = requests.post(f"{BASE_URL}/signup", json={
        "email": d_email,
        "password": d_pass,
        "role": "doctor",
        "name": "Test Doctor"
    })
    if r.status_code != 200:
        print(f"Failed to create doctor: {r.text}")
        return False
    DOCTOR.update({"email": d_email, "password": d_pass, "user_id": r.json()["data"]["data"]["user_id"]})
    print(f"[SETUP] Created doctor: {d_email}")

    # 3. Create Admin (Direct DB access needed as API doesn't support admin signup)
    # We must add project root to path to import storage functions
    try:
        project_root = Path(__file__).parent.parent
        sys.path.insert(0, str(project_root))
        from storage.users import create_admin_user
        
        a_email = f"admin_{timestamp}@test.com"
        a_pass = "AdminPass123!"
        a_id = create_admin_user(a_email, a_pass, "Test Admin")
        
        if not a_id:
            print("Failed to create admin via internal function")
            return False
            
        ADMIN.update({"email": a_email, "password": a_pass, "user_id": a_id})
        print(f"[SETUP] Created admin: {a_email}")
        
    except ImportError as e:
        print(f"Failed to import create_admin_user: {e}")
        return False
    except Exception as e:
        print(f"Failed to create admin: {e}")
        return False

    return True


# ============================================================================
# A. Authentication & Session Tests
# ============================================================================

def test_unauthenticated_access(runner: TestRunner, session: requests.Session):
    """Test that unauthenticated access to protected endpoints returns 401"""
    def _test():
        r = session.get(f"{BASE_URL}/session")
        expected = "401 Unauthorized"
        actual = f"{r.status_code} {r.json().get('error', 'No error field')}"
        passed = r.status_code == 401
        return expected, actual, passed
    runner.run_test("A.1: Unauthenticated access to /api/session", _test)


def test_login_patient(runner: TestRunner, session: requests.Session):
    """Test login as patient"""
    def _test():
        r = session.post(f"{BASE_URL}/login", json=PATIENT)
        expected = "200 OK with user data"
        actual = f"{r.status_code} - {r.text[:100]}"
        passed = r.status_code == 200 and r.json().get("success") == True
        return expected, actual, passed
    runner.run_test("A.2: Login as patient", _test)


def test_login_doctor(runner: TestRunner, session: requests.Session):
    """Test login as doctor"""
    def _test():
        r = session.post(f"{BASE_URL}/login", json=DOCTOR)
        expected = "200 OK with user data"
        actual = f"{r.status_code} - {r.text[:100]}"
        passed = r.status_code == 200 and r.json().get("success") == True
        return expected, actual, passed
    runner.run_test("A.3: Login as doctor", _test)


def test_login_admin(runner: TestRunner, session: requests.Session):
    """Test login as admin"""
    def _test():
        r = session.post(f"{BASE_URL}/login", json=ADMIN)
        expected = "200 OK with user data"
        actual = f"{r.status_code} - {r.text[:100]}"
        passed = r.status_code == 200 and r.json().get("success") == True
        return expected, actual, passed
    runner.run_test("A.4: Login as admin", _test)


def test_session_persistence(runner: TestRunner, session: requests.Session):
    """Test that session persists across requests"""
    def _test():
        # Login first
        session.post(f"{BASE_URL}/login", json=PATIENT)
        
        # Check session
        r = session.get(f"{BASE_URL}/session")
        expected = "authenticated: true"
        data = r.json()
        actual = f"authenticated: {data.get('data', {}).get('authenticated', False)}"
        passed = (r.status_code == 200 and 
                 data.get("success") == True and
                 data.get("data", {}).get("authenticated") == True)
        return expected, actual, passed
    runner.run_test("A.5: Session persists across requests", _test)


def test_session_endpoint(runner: TestRunner, session: requests.Session):
    """Test /api/session returns authenticated = true"""
    def _test():
        session.post(f"{BASE_URL}/login", json=PATIENT)
        r = session.get(f"{BASE_URL}/session")
        data = r.json()
        expected = "authenticated: true"
        actual = f"authenticated: {data.get('data', {}).get('authenticated', False)}"
        passed = (r.status_code == 200 and 
                 data.get("data", {}).get("authenticated") == True)
        return expected, actual, passed
    runner.run_test("A.6: /api/session returns authenticated = true", _test)


def test_logout(runner: TestRunner, session: requests.Session):
    """Test logout invalidates session"""
    def _test():
        # Login first
        session.post(f"{BASE_URL}/login", json=PATIENT)
        
        # Logout
        r_logout = session.post(f"{BASE_URL}/logout")
        
        # Verify session invalidated
        r_session = session.get(f"{BASE_URL}/session")
        expected = "Logout returns 200, then session returns 401"
        actual = f"Logout: {r_logout.status_code}, Session: {r_session.status_code}"
        passed = (r_logout.status_code == 200 and r_session.status_code == 401)
        return expected, actual, passed
    runner.run_test("A.7: Logout invalidates session", _test)


# ============================================================================
# B. Patient Workflow Tests
# ============================================================================

def test_patient_upload(runner: TestRunner, session: requests.Session):
    """Test patient uploads PHR file"""
    def _test():
        # Login as patient
        session.post(f"{BASE_URL}/login", json=PATIENT)
        
        # Upload file
        if not SAMPLE_FILE.exists():
            return "sample.txt exists", f"File not found: {SAMPLE_FILE}", False
        
        with open(SAMPLE_FILE, 'rb') as f:
            files = {'file': ('sample.txt', f, 'text/plain')}
            data = {'policy': 'Role:Doctor'}
            r = session.post(f"{BASE_URL}/patient/upload", files=files, data=data)
        
        expected = "200 OK or status: uploaded"
        actual = f"{r.status_code} - {r.text[:100]}"
        passed = (r.status_code == 200 or 
                 (r.status_code == 200 and r.json().get("status") == "uploaded"))
        
        # Store filename for later tests
        if passed:
            runner.uploaded_filename = "sample.txt.json"  # Metadata filename
        
        return expected, actual, passed
    runner.run_test("B.1: Patient uploads PHR file", _test)


def test_patient_files_list(runner: TestRunner, session: requests.Session):
    """Test patient can see uploaded files"""
    def _test():
        session.post(f"{BASE_URL}/login", json=PATIENT)
        r = session.get(f"{BASE_URL}/patient/files")
        data = r.json()
        expected = "200 OK with files list"
        files = data.get("data", {}).get("files", [])
        actual = f"{r.status_code} - Files: {len(files)}"
        passed = (r.status_code == 200 and 
                 data.get("success") == True and
                 len(files) > 0)
        return expected, actual, passed
    runner.run_test("B.2: Patient files appear in /api/patient/files", _test)


def test_patient_revoke(runner: TestRunner, session: requests.Session):
    """Test patient revokes access"""
    def _test():
        session.post(f"{BASE_URL}/login", json=PATIENT)
        
        # Get files first
        r_files = session.get(f"{BASE_URL}/patient/files")
        files_data = r_files.json()
        files = files_data.get("data", {}).get("files", [])
        
        if not files:
            return "Files exist to revoke", "No files found", False
        
        # Files are dicts now -> extract filename
        file_entry = files[0]
        if isinstance(file_entry, dict):
            # Use display filename (original name) for revoke as per API
            filename = file_entry.get("filename", "")
        else:
            filename = str(file_entry)
            
        # Backend expects 'filename' in body. 
        r = session.post(f"{BASE_URL}/patient/revoke", json={"filename": filename})
        
        # Strict validation: endpoint must return 200 OK
        if r.status_code != 200:
            return "200 OK", f"{r.status_code} - {r.text[:100]}", False
        
        # Verify file still exists (revoke updates policy, doesn't delete file)
        r_files_after = session.get(f"{BASE_URL}/patient/files")
        files_after = r_files_after.json().get("data", {}).get("files", [])
        expected = "200 OK revoke, file still exists"
        actual = f"{r.status_code}, files after: {len(files_after)}"
        passed = len(files_after) > 0
        return expected, actual, passed
    runner.run_test("B.3: Patient revokes access", _test)


# ============================================================================
# C. Doctor Workflow Tests
# ============================================================================

def test_doctor_files_list(runner: TestRunner, session: requests.Session):
    """Test doctor can fetch authorized files"""
    def _test():
        session.post(f"{BASE_URL}/login", json=DOCTOR)
        r = session.get(f"{BASE_URL}/doctor/files")
        data = r.json()
        expected = "200 OK with files list"
        files = data.get("data", {}).get("files", [])
        actual = f"{r.status_code} - Files: {len(files)}"
        passed = (r.status_code == 200 and 
                 data.get("success") == True)
        return expected, actual, passed
    runner.run_test("C.1: Doctor fetches /api/doctor/files", _test)


def test_doctor_access_authorized(runner: TestRunner, session: requests.Session):
    """Test doctor accesses authorized file"""
    def _test():
        session.post(f"{BASE_URL}/login", json=DOCTOR)
        
        # Get files
        r_files = session.get(f"{BASE_URL}/doctor/files")
        files = r_files.json().get("data", {}).get("files", [])
        
        if not files:
            return "Files exist", "No files found", False
        
        # Extract filename from dict
        file_entry = files[0]
        if isinstance(file_entry, dict):
            # API expects encrypted filename for access
            filename = file_entry.get("enc_filename", "")
        else:
            filename = str(file_entry)

        r = session.post(f"{BASE_URL}/doctor/access", json={"file": filename})
        resp_json = r.json()
        
        # Wrapped response: { success: true, data: { status: "granted" } }
        status = resp_json.get("data", {}).get("status")
        
        expected = "status: granted"
        actual = f"{r.status_code} - {json.dumps(resp_json, indent=2)}"
        
        passed = (r.status_code == 200 and status == "granted")
        return expected, actual, passed
    runner.run_test("C.2: Doctor accesses authorized file → GRANTED", _test)


def test_doctor_access_unauthorized(runner: TestRunner, session: requests.Session):
    """Test doctor attempts to access unauthorized file"""
    def _test():
        session.post(f"{BASE_URL}/login", json=DOCTOR)
        
        # Try to access a non-existent or unauthorized file
        r = session.post(f"{BASE_URL}/doctor/access", json={"file": "nonexistent.enc"})
        
        expected = "status: denied or 403"
        actual = f"{r.status_code} - {r.text[:100]}"
        # Should be denied (403) or return denied status
        passed = (r.status_code == 403 or 
                 r.json().get("status") == "denied")
        return expected, actual, passed
    runner.run_test("C.3: Doctor accesses unauthorized file → DENIED", _test)


def test_doctor_download(runner: TestRunner, session: requests.Session):
    """Test doctor downloads authorized file via secure streamed blob (or legacy disk)"""
    def _test():
        session.post(f"{BASE_URL}/login", json=DOCTOR)
        
        # Get files
        r_files = session.get(f"{BASE_URL}/doctor/files")
        files = r_files.json().get("data", {}).get("files", [])
        
        if not files:
            return "Files exist", "No files found", False
        
        file_entry = files[0]
        if isinstance(file_entry, dict):
            filename = file_entry.get("enc_filename", "")
        else:
            filename = str(file_entry)
        
        # Trigger download request
        r_download = session.post(
            f"{BASE_URL}/doctor/access",
            json={"file": filename, "download": True},
            stream=True
        )
        
        # Check content type
        content_type = r_download.headers.get("Content-Type", "")
        # Flask might send text/html on error, or application/json
        is_binary = "application/octet-stream" in content_type or "text/plain" in content_type
        
        # NOTE: r_download.content gives raw bytes. r_download.text tries to decode.
        
        if r_download.status_code == 200:
             # Secure streaming download - get BYTES
            downloaded_bytes = r_download.content
        else:
            return "200 OK (binary)", f"{r_download.status_code} - {r_download.text[:200]}", False
        
        # Verify contents match original
        with open(SAMPLE_FILE, "rb") as f:
            original_bytes = f.read()
            
        expected = f"Downloaded content matches original ({len(original_bytes)} bytes)"
        
        # Compare bytes directly
        passed = downloaded_bytes == original_bytes
        
        if not passed:
             actual = f"Downloaded {len(downloaded_bytes)} bytes, expected {len(original_bytes)}"
        else:
             actual = f"Matched {len(downloaded_bytes)} bytes"
        
        return expected, actual, passed
    runner.run_test("C.4: Secure doctor download (streamed blob)", _test)


# ============================================================================
# D. Admin / Audit Workflow Tests
# ============================================================================

def test_admin_audit_logs(runner: TestRunner, session: requests.Session):
    """Test admin fetches audit logs"""
    def _test():
        session.post(f"{BASE_URL}/login", json=ADMIN)
        r = session.get(f"{BASE_URL}/audit/logs")
        data = r.json()
        expected = "200 OK with logs array"
        logs = data.get("data", {}).get("logs", [])
        actual = f"{r.status_code} - Logs: {len(logs)}"
        passed = (r.status_code == 200 and 
                 data.get("success") == True)
        return expected, actual, passed
    runner.run_test("D.1: Admin fetches /api/audit/logs", _test)


def test_audit_logs_exist(runner: TestRunner, session: requests.Session):
    """Test that audit logs exist"""
    def _test():
        session.post(f"{BASE_URL}/login", json=ADMIN)
        r = session.get(f"{BASE_URL}/audit/logs")
        logs = r.json().get("data", {}).get("logs", [])
        expected = "Logs array exists"
        actual = f"Logs count: {len(logs)}"
        passed = isinstance(logs, list)
        return expected, actual, passed
    runner.run_test("D.2: Audit logs exist", _test)


def test_audit_logs_granted_denied(runner: TestRunner, session: requests.Session):
    """Test that both GRANTED and DENIED_* entries exist"""
    def _test():
        session.post(f"{BASE_URL}/login", json=ADMIN)
        r = session.get(f"{BASE_URL}/audit/logs")
        logs = r.json().get("data", {}).get("logs", [])
        
        granted = [log for log in logs if log.get("status") == "GRANTED"]
        # Check for any DENIED_* status
        denied = [log for log in logs if log.get("status", "").startswith("DENIED_")]
        
        expected = "Both GRANTED and DENIED_* entries present"
        actual = f"GRANTED: {len(granted)}, DENIED_*: {len(denied)}"
        # Note: If no denied requests happened (C.3 is critical), this might fail.
        # C.3 ensures at least one DENIED.
        passed = len(granted) > 0 and len(denied) > 0
        return expected, actual, passed
    runner.run_test("D.3: Audit logs contain both GRANTED and DENIED", _test)


def test_hash_chain_integrity(runner: TestRunner, session: requests.Session):
    """Test hash chain integrity by recomputing hashes"""
    def _test():
        session.post(f"{BASE_URL}/login", json=ADMIN)
        r = session.get(f"{BASE_URL}/audit/logs")
        logs = r.json().get("data", {}).get("logs", [])
        
        if not logs:
            return "Logs exist", "No logs found", False
        
        # CRITICAL: Backend returns logs newest→oldest
        # Reverse to process in chronological order
        logs = list(reversed(logs))
        
        prev_hash = ""
        all_valid = True
        invalid_entries = []
        
        for i, entry in enumerate(logs):
            # Reconstruct entry without hash (as backend does)
            entry_data = {
                "action": entry.get("action"),
                "file": entry.get("file"),
                "prev_hash": prev_hash,
                "status": entry.get("status"),
                "timestamp": entry.get("timestamp"),
                "user": entry.get("user")
            }
            
            # Serialize with sorted keys
            raw = json.dumps(entry_data, sort_keys=True).encode()
            computed_hash = hashlib.sha256(raw).hexdigest()
            stored_hash = entry.get("hash", "")
            
            if computed_hash != stored_hash:
                all_valid = False
                invalid_entries.append(i)
            
            prev_hash = stored_hash
        
        expected = "All hashes valid"
        actual = f"Valid: {len(logs) - len(invalid_entries)}/{len(logs)}, Invalid entries: {invalid_entries}"
        passed = all_valid
        
        return expected, actual, passed
    runner.run_test("D.4: Hash chain integrity verification", _test)


# ============================================================================
# E. Security Controls Tests
# ============================================================================

def test_doctor_accessing_patient_endpoint(runner: TestRunner, session: requests.Session):
    """Test doctor accessing patient endpoint returns 403"""
    def _test():
        session.post(f"{BASE_URL}/login", json=DOCTOR)
        r = session.get(f"{BASE_URL}/patient/files")
        expected = "403 Forbidden"
        actual = f"{r.status_code} - {r.json().get('error', 'No error')}"
        passed = r.status_code == 403
        return expected, actual, passed
    runner.run_test("E.1: Doctor accessing patient endpoint → 403", _test)


def test_patient_accessing_doctor_endpoint(runner: TestRunner, session: requests.Session):
    """Test patient accessing doctor endpoint returns 403"""
    def _test():
        session.post(f"{BASE_URL}/login", json=PATIENT)
        r = session.get(f"{BASE_URL}/doctor/files")
        expected = "403 Forbidden"
        actual = f"{r.status_code} - {r.json().get('error', 'No error')}"
        passed = r.status_code == 403
        return expected, actual, passed
    runner.run_test("E.2: Patient accessing doctor endpoint → 403", _test)


def test_non_admin_accessing_audit_logs(runner: TestRunner, session: requests.Session):
    """Test non-admin accessing audit logs returns 403"""
    def _test():
        session.post(f"{BASE_URL}/login", json=DOCTOR)
        r = session.get(f"{BASE_URL}/audit/logs")
        expected = "403 Forbidden"
        actual = f"{r.status_code} - {r.json().get('error', 'No error')}"
        passed = r.status_code == 403
        return expected, actual, passed
    runner.run_test("E.3: Non-admin accessing audit logs → 403", _test)


# ============================================================================
# Main Test Execution
# ============================================================================

def run_all_tests():
    """Execute all test suites"""
    runner = TestRunner()
    
    print("Starting SeSPHR End-to-End Test Suite...")
    print("="*70)
    
    # Clean up cloud storage
    cleanup_cloud_storage()
    
    # Setup users
    print("\n[SETUP] Provisioning test users...")
    if setup_test_users(requests.Session()):
        print("[OK] User provisioning successful")
    else:
        print("[FAIL] User provisioning failed!")
        return False
    
    # A. Authentication & Session
    print("\n[A] Testing Authentication & Session...")
    test_unauthenticated_access(runner, requests.Session())
    test_login_patient(runner, requests.Session())
    test_login_doctor(runner, requests.Session())
    test_login_admin(runner, requests.Session())
    test_session_persistence(runner, requests.Session())
    test_session_endpoint(runner, requests.Session())
    test_logout(runner, requests.Session())
    
    # B. Patient Workflow
    print("\n[B] Testing Patient Workflow...")
    patient_session = requests.Session()
    test_patient_upload(runner, patient_session)
    test_patient_files_list(runner, patient_session)
    test_patient_revoke(runner, patient_session)
    
    # C. Doctor Workflow
    print("\n[C] Testing Doctor Workflow...")
    doctor_session = requests.Session()
    test_doctor_files_list(runner, doctor_session)
    test_doctor_access_authorized(runner, doctor_session)
    test_doctor_access_unauthorized(runner, doctor_session)
    test_doctor_download(runner, doctor_session)
    
    # D. Admin / Audit Workflow
    print("\n[D] Testing Admin / Audit Workflow...")
    admin_session = requests.Session()
    test_admin_audit_logs(runner, admin_session)
    test_audit_logs_exist(runner, admin_session)
    test_audit_logs_granted_denied(runner, admin_session)
    test_hash_chain_integrity(runner, admin_session)
    
    # E. Security Controls
    print("\n[E] Testing Security Controls...")
    test_doctor_accessing_patient_endpoint(runner, requests.Session())
    test_patient_accessing_doctor_endpoint(runner, requests.Session())
    test_non_admin_accessing_audit_logs(runner, requests.Session())
    
    # Generate and save report
    print("\n[REPORT] Generating test report...")
    report = runner.save_report()
    runner.print_summary()
    
    print(f"\n[OK] Report saved to: {REPORT_FILE}")
    print("="*70)
    
    return report["summary"]["failed"] == 0


if __name__ == "__main__":
    try:
        success = run_all_tests()
        exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nTest execution interrupted by user")
        exit(1)
    except Exception as e:
        print(f"\n\nFatal error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
