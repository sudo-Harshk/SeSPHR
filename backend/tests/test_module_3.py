import unittest
import os
import shutil
import sys
import json
import base64
from pathlib import Path
from Crypto.PublicKey import RSA
from Crypto.Cipher import PKCS1_OAEP, AES
from Crypto.Hash import SHA256
from Crypto.Random import get_random_bytes

# Add project root to sys.path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from app import create_app
from app.services.crypto.keys import get_or_create_srs_key, get_user_public_key, generate_user_keys
from app.services.storage.users import create_user, get_user_by_email # Helper to ensure users exist

class TestModule3(unittest.TestCase):
    def setUp(self):
        os.environ["FLASK_ENV"] = "development"
        self.flask_app = create_app('default')
        self.app = self.flask_app.test_client()
        self.flask_app.testing = True
        
        # Initialize DB
        ctx = self.flask_app.app_context()
        ctx.push()
        
        # Define Test Users
        self.patient_id = "test_patient_mod3"
        self.doctor_id = "test_doctor_mod3"
        
        # Ensure Keys Exist for them (Simulate Registration)
        # We need their private keys in this script to verify decryption
        self.doc_priv_pem, self.doc_pub_pem = generate_user_keys(self.doctor_id)
        self.patient_priv_pem, self.patient_pub_pem = generate_user_keys(self.patient_id)

    def test_01_re_encryption_flow(self):
        """
        Full Flow:
        1. Client (Patient) Encrypts File & Wraps Key (Module 2)
        2. Client Uploads
        3. Doctor Requests Access (Module 3)
        4. SRS Re-Encrypts Key
        5. Doctor Client Decrypts Key & Verifies
        """
        print("\n[Start] Testing Re-Encryption Flow...")
        
        # --- STEP 1: CLIENT ENCRYPTION (Patient) ---
        original_aes_key = get_random_bytes(32) # 256-bit
        iv = get_random_bytes(12)
        file_content = b"Super Secret Patient Data"
        
        # Encrypt File (AES-GCM)
        cipher_aes = AES.new(original_aes_key, AES.MODE_GCM, nonce=iv)
        ciphertext, tag = cipher_aes.encrypt_and_digest(file_content)
        encrypted_blob = ciphertext # In real app we might combine tag, but blind storage blindly stores what we give.
        # Actually crypto.ts combines validation? No, crypto.ts returns blob. 
        # App blindly stores. So this is fine.
        
        # Wrap AES Key with SRS Public Key
        # Fetch SRS Key first
        srs_priv, srs_pub_pem = get_or_create_srs_key()
        srs_pub_key = RSA.import_key(srs_pub_pem)
        
        cipher_rsa = PKCS1_OAEP.new(srs_pub_key, hashAlgo=SHA256)
        wrapped_key_for_srs = cipher_rsa.encrypt(original_aes_key)
        
        # --- STEP 2: UPLOAD (Patient) ---
        filename = "patient_record_mod3.txt.enc"
        policy = "Role:Doctor" # Policy allowing doctors
        
        with self.app.session_transaction() as sess:
            sess["user_id"] = self.patient_id
            sess["role"] = "patient"
            
        data = {
            "file": (io.BytesIO(encrypted_blob), filename),
            "policy": policy,
            "key_blob": wrapped_key_for_srs.hex(),
            "iv": iv.hex()
        }
        
        resp = self.app.post(
            "/api/patient/upload", 
            data=data, 
            content_type="multipart/form-data"
        )
        self.assertEqual(resp.status_code, 200, f"Upload failed: {resp.get_json()}")
        print("[Pass] Patient Upload Successful")
        
        # --- STEP 3: DOCTOR ACCESS REQUEST ---
        # Switch session to Doctor
        with self.app.session_transaction() as sess:
            sess["user_id"] = self.doctor_id
            sess["role"] = "doctor"
            # We need to make sure storage.users checks work.
            # get_user_by_id might fail if we didn't actually create the user DB entry.
            # generate_user_keys doesn't create DB user.
            # So we rely on our mock/stub or we must create user.
            # Let's create dummy user in DB if not exists.
        
        # Create user in DB to satisfy get_user_by_id checks in api_doctor_access
        try:
             # This might fail if user already exists or email conflict, ignore
             create_user("doc3@test.com", "pass", "doctor", "Dr Test", user_id=self.doctor_id)
        except:
             pass 

        req_data = {
            "file": filename.replace(".enc", "") # Request by display name
        }
        
        resp = self.app.post("/api/doctor/access", json=req_data)
        
        if resp.status_code != 200:
            print(f"Access Failed: {resp.get_json()}")
            
        self.assertEqual(resp.status_code, 200)
        resp_data = resp.get_json()
        self.assertEqual(resp_data["data"]["status"], "granted")
        print("[Pass] SRS Access Granted")
        
        # --- STEP 4: VERIFY RE-ENCRYPTION ---
        re_encrypted_key_hex = resp_data["data"]["key_blob"]
        
        # Decrypt using DOCTOR'S PRIVATE KEY
        doc_priv_key = RSA.import_key(self.doc_priv_pem)
        cipher_pvt = PKCS1_OAEP.new(doc_priv_key, hashAlgo=SHA256)
        
        decrypted_aes_key = cipher_pvt.decrypt(bytes.fromhex(re_encrypted_key_hex))
        
        self.assertEqual(decrypted_aes_key, original_aes_key, "FATAL: Re-encrypted key does not match original AES key!")
        print("[Pass] Key Re-Encryption Verified Successfully (Original AES Key Recovered)")
        
        # --- STEP 5: VERIFY FILE DOWNLOAD ---
        file_url = resp_data["data"]["file_url"]
        download_resp = self.app.get(file_url)
        self.assertEqual(download_resp.status_code, 200)
        self.assertEqual(download_resp.data, encrypted_blob)
        print("[Pass] Encrypted File Download Verified")

import io
if __name__ == "__main__":
    unittest.main()
