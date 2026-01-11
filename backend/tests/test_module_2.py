import unittest
import os
import shutil
import sys
import json
import base64
from pathlib import Path

# Add project root to sys.path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from app import create_app
from app.services.crypto.keys import get_or_create_srs_key

class TestModule2(unittest.TestCase):
    def setUp(self):
        os.environ["FLASK_ENV"] = "development"
        self.flask_app = create_app('default')
        self.app = self.flask_app.test_client()
        self.flask_app.testing = True
        
        # Ensure we have a user
        self.user_id = "test_patient_mod2"
        # We need to simulate a login session
        # But for api/patient/upload we need session.
        # Instead of mocking session, let's login properly if possible
        # or use a helper to bypass auth for testing if app allows?
        # The app uses session['user_id'].
        # We can use With app.test_client() as c: with c.session_transaction() as sess: ...

    def test_01_blind_storage_upload(self):
        """
        Simulate Frontend Encryption and Upload.
        Verify Server stores it blindly without re-encryption.
        """
        
        # 1. Fetch SRS Public Key (Simulation of Frontend Step 1)
        resp = self.app.get("/api/srs/public-key")
        self.assertEqual(resp.status_code, 200)
        srs_key_pem = resp.get_json()["data"]["public_key"]
        self.assertTrue(srs_key_pem.startswith("-----BEGIN PUBLIC KEY-----"))
        
        # 2. Simulate Encryption (Client Side)
        # We don't need real crypto here, just random bytes to prove blind storage
        fake_encrypted_file_content = os.urandom(1024) # 1KB random "encrypted" data
        fake_iv = os.urandom(12).hex() # 12 bytes IV hex
        fake_wrapped_key = os.urandom(256).hex() # 256 bytes RSA key hex
        
        policy = "Role:Doctor"
        filename = "test_blind_upload.txt"
        
        # 3. Upload to Backend
        # We use session transaction to set user_id
        with self.app.session_transaction() as sess:
            sess["user_id"] = self.user_id
            sess["role"] = "patient"
            
        data = {
            "file": (io.BytesIO(fake_encrypted_file_content), filename),
            "policy": policy,
            "key_blob": fake_wrapped_key,
            "iv": fake_iv
        }
        
        resp = self.app.post(
            "/api/patient/upload", 
            data=data, 
            content_type="multipart/form-data"
        )
        
        if resp.status_code != 200:
            print(f"Upload Failed: {resp.get_json()}")
        self.assertEqual(resp.status_code, 200)
        
        # 4. Verification (Server Side)
        # Check cloud/data/
        cloud_data = os.path.join(project_root, "cloud", "data")
        # The file is stored as <filename>.enc in the current implementation? 
        # Or <filename>.enc if we send test_blind_upload.txt?
        # Logic in store_phr (new) usually keeps name or ID.
        # Let's check what currently store_phr does.
        # We expect test_blind_upload.txt.enc
        
        expected_enc_path = os.path.join(cloud_data, f"{filename}.enc")
        self.assertTrue(os.path.exists(expected_enc_path), "Encrypted file not found in cloud/data")
        
        with open(expected_enc_path, "rb") as f:
            stored_content = f.read()
            
        # BLIND STORAGE CHECK: 
        # The stored content MUST be exactly what we sent (fake_encrypted_file_content)
        # If server re-encrypted it, it would be different.
        self.assertEqual(stored_content, fake_encrypted_file_content, "Server modified the file! Blind storage failed.")
        
        # Check Metadata
        cloud_meta = os.path.join(project_root, "cloud", "meta")
        expected_meta_path = os.path.join(cloud_meta, f"{filename}.json")
        self.assertTrue(os.path.exists(expected_meta_path), "Metadata not found")
        
        with open(expected_meta_path, "r") as f:
            meta = json.load(f)
            
        self.assertEqual(meta["key_blob"], fake_wrapped_key, "Metadata key_blob mismatch")
        self.assertEqual(meta["iv"], fake_iv, "Metadata IV mismatch")
        self.assertEqual(meta["owner"], self.user_id)
        
        print("[Pass] Blind Storage verified successfully")

import io
if __name__ == "__main__":
    unittest.main()
