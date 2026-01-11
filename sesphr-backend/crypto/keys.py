import os
from Crypto.PublicKey import RSA

# Define paths for key storage
CLOUD_KEYS_SRS = "cloud/keys/srs"
CLOUD_KEYS_USERS = "cloud/keys/users"

# Ensure directories exist
for directory in [CLOUD_KEYS_SRS, CLOUD_KEYS_USERS]:
    if not os.path.exists(directory):
        os.makedirs(directory)

def get_or_create_srs_key():
    """
    Check for SRS keys on disk. If missing, generate new pair.
    Returns: (private_key_obj, public_key_pem_bytes)
    """
    priv_path = os.path.join(CLOUD_KEYS_SRS, "srs_private.pem")
    pub_path = os.path.join(CLOUD_KEYS_SRS, "srs_public.pem")

    if os.path.exists(priv_path) and os.path.exists(pub_path):
        with open(priv_path, "rb") as f:
            private_key = RSA.import_key(f.read())
        with open(pub_path, "rb") as f:
            public_key_pem = f.read()
        return private_key, public_key_pem

    # Generate new pair
    key = RSA.generate(2048)
    private_key = key
    public_key = key.publickey().export_key()
    private_key_pem = key.export_key()

    with open(priv_path, "wb") as f:
        f.write(private_key_pem)
    
    with open(pub_path, "wb") as f:
        f.write(public_key)

    return private_key, public_key

def generate_user_keys(user_id):
    """
    Generate RSA keypair for a specific user.
    Saves to disk and returns (priv_pem, pub_pem).
    """
    key = RSA.generate(2048)
    private_pem = key.export_key()
    public_pem = key.publickey().export_key()

    priv_path = os.path.join(CLOUD_KEYS_USERS, f"{user_id}_private.pem")
    pub_path = os.path.join(CLOUD_KEYS_USERS, f"{user_id}_public.pem")

    with open(priv_path, "wb") as f:
        f.write(private_pem)
    
    with open(pub_path, "wb") as f:
        f.write(public_pem)

    return private_pem, public_pem

def get_user_public_key(user_id):
    """
    Retrieve user's public key from disk.
    Returns bytes or None if not found.
    """
    pub_path = os.path.join(CLOUD_KEYS_USERS, f"{user_id}_public.pem")
    if os.path.exists(pub_path):
        with open(pub_path, "rb") as f:
            return f.read()
    return None
