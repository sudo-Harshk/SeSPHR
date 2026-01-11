import unittest
import os
import sys
import json
import base64
from pathlib import Path
from Crypto.PublicKey import RSA
from Crypto.Cipher import PKCS1_OAEP, AES
from Crypto.Hash import SHA256
from Crypto.Random import get_random_bytes
import io

# Add project root to sys.path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from app import create_app
from app.services.crypto.keys import get_or_create_srs_key, get_user_public_key, generate_user_keys
from app.services.storage.users import create_user

class TestModule5(unittest.TestCase):
    def setUp(self):
        os.environ["FLASK_ENV"] = "development"
        self.flask_app = create_app('default')
        self.app = self.flask_app.test_client()
        self.flask_app.testing = True

        # Initialize DB
        ctx = self.flask_app.app_context()
        ctx.push()
        
        # Define Test Users
        self.patient_id = "test_patient_mod5"
        self.doc_a_id = "test_doc_a"
        self.doc_b_id = "test_doc_b"
        
        # Ensure Keys Exist (Simulate Registration)
        generate_user_keys(self.doc_a_id)
        generate_user_keys(self.doc_b_id)
        generate_user_keys(self.patient_id)
        
        # Ensure Users exist in DB (for role checks)
        try: create_user("docA@test.com", "pass", "doctor", "Dr A", user_id=self.doc_a_id)
        except: pass
        try: create_user("docB@test.com", "pass", "doctor", "Dr B", user_id=self.doc_b_id)
        except: pass
        try: create_user("pat5@test.com", "pass", "patient", "Pat 5", user_id=self.patient_id)
        except: pass

    def test_granular_revocation(self):
        print("\n[Start] Testing Granular Revocation...")
        
        # --- STEP 1: UPLOAD (Patient) ---
        original_aes_key = get_random_bytes(32)
        iv = get_random_bytes(12)
        
        # Wrap AES Key for SRS
        srs_priv, srs_pub_pem = get_or_create_srs_key()
        srs_pub_key = RSA.import_key(srs_pub_pem)
        cipher_rsa = PKCS1_OAEP.new(srs_pub_key, hashAlgo=SHA256)
        wrapped_key_for_srs = cipher_rsa.encrypt(original_aes_key)
        
        filename = "patient_mod5.txt.enc"
        
        with self.app.session_transaction() as sess:
            sess["user_id"] = self.patient_id
            sess["role"] = "patient"
            
        params = {
            "file": (io.BytesIO(b"Secret Data"), filename),
            "policy": "Role:Doctor",
            "key_blob": wrapped_key_for_srs.hex(),
            "iv": iv.hex()
        }
        resp = self.app.post("/api/patient/upload", data=params, content_type="multipart/form-data")
        self.assertEqual(resp.status_code, 200)
        print("[Pass] Upload Successful")
        
        # --- STEP 2: DOCTOR A ACCESS (Positive) ---
        with self.app.session_transaction() as sess:
            sess["user_id"] = self.doc_a_id
            sess["role"] = "doctor"
            
        resp = self.app.post("/api/doctor/access", json={"file": filename.replace(".enc", "")})
        self.assertEqual(resp.status_code, 200, "Doctor A should have access initially")
        self.assertEqual(resp.get_json()["data"]["status"], "granted")
        print("[Pass] Doctor A Access Granted (Before Revocation)")

        # --- STEP 3: DOCTOR B ACCESS (Positive Control) ---
        with self.app.session_transaction() as sess:
            sess["user_id"] = self.doc_b_id
            sess["role"] = "doctor"
            
        resp = self.app.post("/api/doctor/access", json={"file": filename.replace(".enc", "")})
        self.assertEqual(resp.status_code, 200, "Doctor B should have access")
        print("[Pass] Doctor B Access Granted")

        # --- STEP 4: REVOKE DOCTOR A ---
        with self.app.session_transaction() as sess:
            sess["user_id"] = self.patient_id # Patient context
            sess["role"] = "patient"
            
        revoke_data = {
            "filename": filename.replace(".enc", ""),
            "revoke_user_id": self.doc_a_id # Granular!
        }
        resp = self.app.post("/api/patient/revoke", json=revoke_data)
        self.assertEqual(resp.status_code, 200)
        print(f"[Pass] Revoked Doctor A successfully")

        # --- STEP 5: DOCTOR A ACCESS (Negative) ---
        with self.app.session_transaction() as sess:
            sess["user_id"] = self.doc_a_id
            sess["role"] = "doctor"
            
        resp = self.app.post("/api/doctor/access", json={"file": filename.replace(".enc", "")})
        self.assertEqual(resp.status_code, 403, "Doctor A should be denied after revocation")
        print("[Pass] Doctor A Access DENIED (Correctly)")

        # --- STEP 6: DOCTOR B ACCESS (Positive Persistence) ---
        with self.app.session_transaction() as sess:
            sess["user_id"] = self.doc_b_id
            sess["role"] = "doctor"
            
        resp = self.app.post("/api/doctor/access", json={"file": filename.replace(".enc", "")})
        self.assertEqual(resp.status_code, 200, "Doctor B should STILL have access")
        print("[Pass] Doctor B Access Still Granted (Revocation was granular)")
        
        print("\nModule 5 Verified: Granular Revocation is working.")

if __name__ == "__main__":
    unittest.main()
