import unittest
import os
import shutil
import sys
from pathlib import Path

# Add project root to sys.path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from web.app import app
from crypto.keys import get_or_create_srs_key

class TestModule1(unittest.TestCase):
    def setUp(self):
        os.environ["FLASK_ENV"] = "development"
        self.app = app.test_client()
        self.app.testing = True

    def test_01_file_cleanup(self):
        """Verify cloud/data directory is empty/clean"""
        data_dir = os.path.join(project_root, "cloud", "data")
        if os.path.exists(data_dir):
            files = os.listdir(data_dir)
            # It might be empty or not exist, both are fine ("Clean Slate")
            self.assertEqual(len(files), 0, f"cloud/data should be empty, found: {files}")
        else:
            # If it doesn't exist, that's also 'clean'
            pass
        print("\n[Pass] File Cleanup Verified")

    def test_02_srs_key_generation(self):
        """Verify SRS keys are generated and exist on disk"""
        # Call the function directly to ensure keys are generated
        priv, pub = get_or_create_srs_key()
        
        srs_key_dir = os.path.join(project_root, "cloud", "keys", "srs")
        priv_path = os.path.join(srs_key_dir, "srs_private.pem")
        pub_path = os.path.join(srs_key_dir, "srs_public.pem")
        
        self.assertTrue(os.path.exists(priv_path), "SRS Private Key not found on disk")
        self.assertTrue(os.path.exists(pub_path), "SRS Public Key not found on disk")
        
        # Verify content looks like PEM
        with open(pub_path, "r") as f:
            content = f.read()
            self.assertIn("-----BEGIN PUBLIC KEY-----", content)
            
        print("[Pass] SRS Key Generation Verified")

    def test_03_api_availability(self):
        """Verify GET /api/srs/public-key returns 200 and PEM"""
        response = self.app.get("/api/srs/public-key")
        self.assertEqual(response.status_code, 200)
        
        data = response.get_json()
        self.assertIn("data", data)
        self.assertIn("public_key", data["data"])
        self.assertIn("-----BEGIN PUBLIC KEY-----", data["data"]["public_key"])
        print("[Pass] API Availability Verified")

    def test_04_user_keys_debug(self):
        """Verify POST /api/debug/gen-keys/<user_id> generates keys"""
        user_id = "test_doc_module1"
        response = self.app.post(f"/api/debug/gen-keys/{user_id}")
        if response.status_code != 200:
            print(f"Debug Endpoint Failed: {response.get_json()}")
        self.assertEqual(response.status_code, 200)
        
        # Check files
        user_key_dir = os.path.join(project_root, "cloud", "keys", "users")
        priv_path = os.path.join(user_key_dir, f"{user_id}_private.pem")
        pub_path = os.path.join(user_key_dir, f"{user_id}_public.pem")
        
        self.assertTrue(os.path.exists(priv_path), "User Private Key not found")
        self.assertTrue(os.path.exists(pub_path), "User Public Key not found")
        print("[Pass] User Key Generation Debug Endpoint Verified")

if __name__ == "__main__":
    unittest.main()
