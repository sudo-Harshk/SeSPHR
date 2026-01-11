import os
from Crypto.PublicKey import RSA
from Crypto.Cipher import PKCS1_OAEP
from Crypto.Hash import SHA256
from app.services.crypto.keys import get_or_create_srs_key, get_user_public_key

def re_encrypt_key(encrypted_key_hex, doctor_user_id):
    """
    SRS Proxy Re-Encryption Logic.
    1. Decrypt (Unwrap) the key using SRS Private Key.
    2. Encrypt (Wrap) the key using Doctor's Public Key.
    """
    # 1. Load SRS Private Key
    srs_private_key, _ = get_or_create_srs_key()
    
    # 2. Decrypt (Unwrap) the key
    # The key was encrypted using RSA-OAEP with SHA-256 (as per Web Crypto API defaults in utils/crypto.ts)
    cipher_srs = PKCS1_OAEP.new(srs_private_key, hashAlgo=SHA256)
    
    try:
        encrypted_key_bytes = bytes.fromhex(encrypted_key_hex)
        aes_key = cipher_srs.decrypt(encrypted_key_bytes)
    except (ValueError, TypeError) as e:
        raise ValueError(f"SRS Decryption Failed (Integrity Check): {str(e)}")

    # 3. Load Doctor Public Key
    doctor_pub_pem = get_user_public_key(doctor_user_id)
    if not doctor_pub_pem:
        raise ValueError(f"Doctor public key not found for {doctor_user_id}. Doctor must generate keys.")
        
    doctor_public_key = RSA.import_key(doctor_pub_pem)
    
    # 4. Encrypt (Wrap) for Doctor
    cipher_doctor = PKCS1_OAEP.new(doctor_public_key, hashAlgo=SHA256)
    wrapped_key = cipher_doctor.encrypt(aes_key)
    
    return wrapped_key.hex()
