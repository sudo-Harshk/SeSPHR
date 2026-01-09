import json
import os
from crypto.aes import encrypt_file
from crypto.cpabe.core import encrypt_aes_key

CLOUD_DATA = "cloud/data"
CLOUD_META = "cloud/meta"


def store_phr(owner_id, file_path, policy):
    if not os.path.exists(CLOUD_DATA):
        os.makedirs(CLOUD_DATA)

    if not os.path.exists(CLOUD_META):
        os.makedirs(CLOUD_META)

    # Security: Ensure owner_id is provided
    assert owner_id, "Owner ID is required for PHR storage"

    file_name = os.path.basename(file_path)
    enc_file = f"{file_name}.enc"
    meta_file = f"{file_name}.json"

    enc_path = os.path.join(CLOUD_DATA, enc_file)
    meta_path = os.path.join(CLOUD_META, meta_file)

    aes_key = encrypt_file(file_path, enc_path)

    metadata = {
        "owner": owner_id,
        "file": enc_file,
        "policy": policy,
        "aes_key": encrypt_aes_key(aes_key, policy)
    }

    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)

    return enc_file
