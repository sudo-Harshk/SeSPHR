import json
import os
import shutil

from config import Config

CLOUD_DATA = Config.CLOUD_DATA
CLOUD_META = Config.CLOUD_META


def store_phr(owner_id, file_path, policy):
    """Legacy wrapper for backward compatibility if needed, or deprecate."""
    # This was the old server-side encryption function.
    # Refactor to use store_encrypted_phr if we had the key, but we don't.
    # We should probably remove this or raise deprecation warning.
    raise NotImplementedError("Server-side encryption is deprecated. Use store_encrypted_phr.")

def store_encrypted_phr(owner_id, file_storage, policy, key_blob, iv, portions=None):
    """
    Store a PHR that was already encrypted by the client.
    
    Args:
        owner_id: ID of the user uploading
        file_storage: Flask FileStorage object (stream) or path
        policy: Global access policy string (for the entire file)
        key_blob: Encrypted AES key (from client) for the entire file
        iv: IV used for encryption (from client)
        portions: (Optional) List of dictionaries containing granular access info
    """
    if not os.path.exists(CLOUD_DATA):
        os.makedirs(CLOUD_DATA)

    if not os.path.exists(CLOUD_META):
        os.makedirs(CLOUD_META)
        
    # Get original filename
    original_filename = file_storage.filename
    # Ensure it ends with .enc extension
    if not original_filename.endswith(".enc"):
        enc_filename = f"{original_filename}.enc"
    else:
        enc_filename = original_filename
        
    enc_path = os.path.join(CLOUD_DATA, enc_filename)
    meta_path = os.path.join(CLOUD_META, f"{enc_filename.replace('.enc', '')}.json")
    
    # Save the encrypted file content directly
    file_storage.save(enc_path)

    metadata = {
        "owner": owner_id,
        "file": enc_filename,
        "policy": policy,
        "key_blob": key_blob,
        "iv": iv, 
        "mode": "client_side_encryption",
        "portions": portions or [] # List of { name, policy, key_blob, iv }
    }

    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)

    return enc_filename
