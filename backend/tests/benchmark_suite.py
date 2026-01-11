
import sys
import os
import time
import json
import csv
import io
import uuid
from pathlib import Path

# Add project root to Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from Crypto.Cipher import AES, PKCS1_OAEP
from Crypto.PublicKey import RSA
from Crypto.Random import get_random_bytes
from Crypto.Hash import SHA256

from app import create_app
from app.services.crypto.keys import get_or_create_srs_key, generate_user_keys, get_user_public_key
from app.services.storage.users import create_user

# Constants
SIZES = {
    "100KB": 100 * 1024,
    "1MB": 1 * 1024 * 1024, 
    "5MB": 5 * 1024 * 1024,
    "10MB": 10 * 1024 * 1024
}

RESULTS_FILE = "benchmark_results.csv"

def client_encrypt(data_bytes, srs_public_key_pem):
    """
    Simulates: Client generates AES key, Encrypts Data, Wraps Key with SRS Public Key.
    Returns: (encrypted_data_blob, wrapped_key_hex, iv_hex, aes_key)
    """
    # 1. Generate AES Key
    aes_key = get_random_bytes(32) # 256 bits
    iv = get_random_bytes(12)      # 96 bits for GCM
    
    # 2. Encrypt Data (AES-GCM)
    cipher_aes = AES.new(aes_key, AES.MODE_GCM, nonce=iv)
    ciphertext, tag = cipher_aes.encrypt_and_digest(data_bytes)
    # Blob usually is nonce + tag + ciphertext or just tag + ciphertext check storage/phr
    # Frontend logic (crypto.ts) sends iv separately. ciphertext usually is just the data.
    # But wait, crypto.ts encryptFile returns encryptedBlob.
    # Let's replicate crypto.ts simply:
    # It returns a blob. In python passing to backend, we just send bytes.
    # The important part is timing.
    encrypted_blob = ciphertext + tag # Tag is usually appended in GCM
    
    # 3. Wrap AES Key (RSA-OAEP SHA-256)
    srs_public_key = RSA.import_key(srs_public_key_pem)
    cipher_rsa = PKCS1_OAEP.new(srs_public_key, hashAlgo=SHA256)
    wrapped_key = cipher_rsa.encrypt(aes_key)
    
    return encrypted_blob, wrapped_key.hex(), iv.hex(), aes_key

def client_decrypt(encrypted_blob, wrapped_key_hex, iv_hex, doctor_private_key_pem, tag_size=16):
    """
    Simulates: Doctor Unwraps Key using their Code, Decrypts Data.
    """
    # 1. Unwrap Key
    doctor_private_key = RSA.import_key(doctor_private_key_pem)
    cipher_rsa = PKCS1_OAEP.new(doctor_private_key, hashAlgo=SHA256)
    
    encrypted_key_bytes = bytes.fromhex(wrapped_key_hex)
    aes_key = cipher_rsa.decrypt(encrypted_key_bytes)
    
    # 2. Decrypt Data
    iv = bytes.fromhex(iv_hex)
    
    # Assuming encrypted_blob = ciphertext + tag (last 16 bytes)
    ciphertext = encrypted_blob[:-tag_size]
    tag = encrypted_blob[-tag_size:]
    
    cipher_aes = AES.new(aes_key, AES.MODE_GCM, nonce=iv)
    plaintext = cipher_aes.decrypt_and_verify(ciphertext, tag)
    
    return plaintext

def run_benchmark():
    print("Starting SeSPHR Performance Benchmark...")
    print(f"Sizes to test: {list(SIZES.keys())}")
    
    # Setup App Client
    app = create_app('default')
    client = app.test_client()
    
    # Push context for database access
    ctx = app.app_context()
    ctx.push()
    
    # Initialize DB (Schema) in case it's a fresh run/path
    from app.services.storage.db import init_db
    init_db()
    
    # 1. Setup Identities
    # Use unique emails to avoid conflicts on repeated runs
    run_id = int(time.time())
    
    # Create Patient in DB
    patient_email = f"bench_patient_{run_id}@sesphr.local"
    patient_id = create_user(patient_email, "password", "patient", "Bench Patient")
    
    # Create Doctor in DB
    doctor_email = f"bench_doctor_{run_id}@sesphr.local"
    doctor_id = create_user(doctor_email, "password", "doctor", "Bench Doctor")
    
    print(f"Creating Bench Entities: Patient={patient_id[:8]}, Doctor={doctor_id[:8]}")
    
    # Generate Keys
    # SRS Key (Server Key)
    _, srs_pub_pem = get_or_create_srs_key()
    
    # Doctor Key (Receiver)
    # create_user doesn't generate keys, we have to do it manually or let the app do it.
    # In the app, keys are generated on demand via debug endpoint or client logic.
    # Here we generate them manually to ensure they exist on disk.
    doc_priv_pem, doc_pub_pem = generate_user_keys(doctor_id)
    
    # Patient (Sender)
    generate_user_keys(patient_id) 
    
    # Mock Sessions
    # We need to mock session cookies. Flask Client handles cookies automatically if we 'login'.
    # But since we generated UUIDs directly, we might need to bypass login or mock session.
    # `app.py` checks `session.get('role')`.
    
    results = []
    
    for size_label, size_bytes in SIZES.items():
        print(f"\n--- Testing Size: {size_label} ---")
        
        # Data Gen
        data = get_random_bytes(size_bytes)
        
        # --- Step A: Encryption (Client Side) ---
        start_time = time.time()
        
        enc_blob, wrapped_key_for_srs, iv_hex, original_aes_key = client_encrypt(data, srs_pub_pem)
        
        encrypt_duration = time.time() - start_time
        print(f"Encryption Time: {encrypt_duration:.4f}s")
        
        
        # --- Step B: Upload (Network/Store) ---
        # Set Patient Session
        with client.session_transaction() as sess:
            sess["user_id"] = patient_id
            sess["role"] = "patient"
            
        filename = f"bench_{size_label}_{int(time.time())}.txt"
        
        upload_data = {
            'file': (io.BytesIO(enc_blob), filename), # Not .enc, backend adds it? Or we should? Backend logic: "file.filename". 
            'policy': f"Role:Doctor", # Simple Policy
            'key_blob': wrapped_key_for_srs,
            'iv': iv_hex
        }
        
        # Upload
        up_resp = client.post("/api/patient/upload", data=upload_data, content_type='multipart/form-data')
        if up_resp.status_code != 200:
            print(f"Upload Failed: {up_resp.data}")
            continue
            
        final_filename = up_resp.json['data']['filename'] # Backend normalized name
        
        # --- Step C: SRS Re-Encryption (Backend) ---
        # Switch to Doctor Session
        with client.session_transaction() as sess:
            sess["user_id"] = doctor_id
            sess["role"] = "doctor"
            
        start_time = time.time()
        
        # Request Access
        access_resp = client.post("/api/doctor/access", json={"file": final_filename})
        
        srs_duration = time.time() - start_time
        print(f"SRS Time: {srs_duration:.4f}s")
        
        if access_resp.status_code != 200:
             print(f"Access Failed: {access_resp.data}")
             continue
             
        access_data = access_resp.json['data']
        re_encrypted_key_hex = access_data['key_blob']
        # iv_hex should be same
        
        
        # --- Step D: Decryption (Client Side) ---
        start_time = time.time()
        
        # Decrypt
        decrypted_data = client_decrypt(enc_blob, re_encrypted_key_hex, iv_hex, doc_priv_pem)
        
        decrypt_duration = time.time() - start_time
        print(f"Decryption Time: {decrypt_duration:.4f}s")
        
        # Verify Correctness
        if decrypted_data != data:
             print("INTEGRITY CHECK FAILED!")
        else:
             print("Integrity Verified.")
             
        results.append({
            "File Size (MB)": size_label,
            "Encryption Time (s)": round(encrypt_duration, 5),
            "SRS Time (s)": round(srs_duration, 5),
            "Decryption Time (s)": round(decrypt_duration, 5)
        })

    # Save Results
    with open(RESULTS_FILE, mode='w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=["File Size (MB)", "Encryption Time (s)", "SRS Time (s)", "Decryption Time (s)"])
        writer.writeheader()
        writer.writerows(results)
        
    print(f"\nBenchmark Complete. Results saved to {RESULTS_FILE}")
    
    # Print Table
    print("\n| File Size | Encryption (s) | SRS Time (s) | Decryption (s) |")
    print("|---|---|---|---|")
    for r in results:
        print(f"| {r['File Size (MB)']} | {r['Encryption Time (s)']} | {r['SRS Time (s)']} | {r['Decryption Time (s)']} |")


if __name__ == "__main__":
    run_benchmark()
