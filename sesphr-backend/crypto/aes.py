from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
import os

AES_KEY_SIZE = 32   # 256 bits
NONCE_SIZE = 12     # Explicit nonce size
TAG_SIZE = 16


def encrypt_file(input_path, output_path):
    key = get_random_bytes(AES_KEY_SIZE)
    nonce = get_random_bytes(NONCE_SIZE)

    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)

    with open(input_path, "rb") as f:
        plaintext = f.read()

    ciphertext, tag = cipher.encrypt_and_digest(plaintext)

    with open(output_path, "wb") as f:
        f.write(nonce)
        f.write(tag)
        f.write(ciphertext)

    return key


def decrypt_file(input_path, output_path, key):
    with open(input_path, "rb") as f:
        nonce = f.read(NONCE_SIZE)
        tag = f.read(TAG_SIZE)
        ciphertext = f.read()

    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    plaintext = cipher.decrypt_and_verify(ciphertext, tag)

    with open(output_path, "wb") as f:
        f.write(plaintext)
