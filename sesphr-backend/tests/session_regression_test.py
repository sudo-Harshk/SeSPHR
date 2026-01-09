import requests
import json
import time
from pathlib import Path

BASE_URL = "http://localhost:5000/api"  # Note: Vite Proxy forwards to 5000
REPORT_FILE = Path(__file__).parent / "session_test_report.json"


class SessionTestReport:
    def __init__(self):
        self.start_time = time.time()
        self.results = []
        self.passed = True

    def add(self, step, success, details=""):
        if not success:
            self.passed = False
        self.results.append({
            "step": step,
            "success": success,
            "details": details
        })
        print(f"[{'PASS' if success else 'FAIL'}] {step}")
        if not success:
            print(f"  Details: {details}")

    def save(self):
        report = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "duration_sec": round(time.time() - self.start_time, 2),
            "overall_status": "PASS" if self.passed else "FAIL",
            "results": self.results
        }
        with open(REPORT_FILE, "w") as f:
            json.dump(report, f, indent=2)
        return report


def run_tests():
    report = SessionTestReport()
    session = requests.Session()

    # STEP 0 — Signup a new user dynamically
    timestamp = int(time.time())
    email = f"test_doctor_{timestamp}@example.com"
    password = "SecurePassword123!"
    
    print(f"Creating test user: {email}")
    
    r = requests.post(f"{BASE_URL}/signup", json={
        "email": email, 
        "password": password, 
        "role": "doctor",
        "name": "Test Doctor"
    })
    
    if r.status_code != 200:
        report.add("Signup test user", False, f"Failed: {r.text}")
        return report.save()
    
    user_id = r.json()["data"]["user_id"]
    report.add("Signup test user", True, f"Created user {user_id}")

    # STEP 1 — Check unauthenticated session
    r = session.get(f"{BASE_URL}/session")
    report.add(
        "Unauthenticated session check",
        r.status_code == 401,
        f"Expected 401, got {r.status_code}"
    )

    # STEP 2 — Login
    r = session.post(
        f"{BASE_URL}/login",
        json={"email": email, "password": password}
    )

    report.add(
        "Login request",
        r.status_code == 200,
        f"Response: {r.text}"
    )

    # STEP 3 — Check cookie issued
    cookies = session.cookies.get_dict()
    report.add(
        "Session cookie issued",
        "session" in cookies,
        f"Cookies present: {cookies}"
    )

    # STEP 4 — Session persists (simulate reload)
    r = session.get(f"{BASE_URL}/session")
    data = r.json().get("data", {})
    report.add(
        "Session persists after reload",
        r.status_code == 200 and data.get("authenticated") is True,
        f"Response: {r.text}"
    )
    
    # Verify attributes loaded
    report.add(
        "Attributes loaded in session endpoint",
        "attributes" in data and "Role" in data["attributes"],
        f"Attributes: {data.get('attributes')}"
    )

    # STEP 5 — Access protected endpoint
    r = session.get(f"{BASE_URL}/doctor/files")
    report.add(
        "Protected endpoint access",
        r.status_code == 200,
        f"Status: {r.status_code}, Body: {r.text}"
    )

    # STEP 6 — Logout
    r = session.post(f"{BASE_URL}/logout")
    report.add(
        "Logout request",
        r.status_code == 200,
        f"Response: {r.text}"
    )

    # STEP 7 — Verify session cleared
    r = session.get(f"{BASE_URL}/session")
    report.add(
        "Session invalid after logout",
        r.status_code == 401,
        f"Expected 401, got {r.status_code}"
    )

    return report.save()


if __name__ == "__main__":
    print("Running session regression tests...\n")
    result = run_tests()
    print("\nReport written to:", REPORT_FILE)

