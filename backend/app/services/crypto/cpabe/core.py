"""
CP-ABE Core Integration Layer

This module provides the public API for CP-ABE operations in the SeSPHR system.
It acts as an integration layer that abstracts the underlying CP-ABE backend implementation.

Architectural Design:
- Backend Abstraction: Uses the CPABEBackend interface to allow backend swapping
- Current Implementation: Uses SimulatedCPABE for academic demonstration
- Future Migration: Can be swapped with real CP-ABE implementation without changing
  calling code (e.g., storage/phr.py, storage/access.py)

Separation of Concerns:
- Policy Parsing: Handled by policy.parser module
- Key Encryption/Decryption: Handled by CP-ABE backend (this module)
- Access Control: Enforced through CP-ABE cryptographic operations
"""

from app.services.crypto.cpabe.simulated import SimulatedCPABE

# Backend instance - can be swapped with real CP-ABE implementation
# For production: Replace SimulatedCPABE() with RealCPABE() or similar
_backend = SimulatedCPABE()


def encrypt_aes_key(aes_key_bytes, policy):
    """
    Encrypt an AES key under a CP-ABE access policy.
    
    This function is called when storing PHR files. The AES key used to encrypt
    the file is itself encrypted under an attribute-based policy, ensuring that
    only users with matching attributes can decrypt and access the file.
    
    Args:
        aes_key_bytes: The AES encryption key (bytes) used to encrypt PHR content
        policy: Access policy string (e.g., "Role:Doctor AND Dept:Cardiology")
        
    Returns:
        Encrypted key blob (string) that can be stored with file metadata.
        This blob can only be decrypted by users whose attributes satisfy the policy.
        
    Example:
        key = b'\\x01\\x02...'
        encrypted = encrypt_aes_key(key, "Role:Doctor")
        # Store encrypted with file metadata
    """
    return _backend.encrypt_key(aes_key_bytes, policy)


def decrypt_aes_key(encrypted_blob, user):
    """
    Decrypt an AES key using user attributes.
    
    This function is called when accessing PHR files. The encrypted AES key
    is decrypted only if the user's attributes satisfy the policy under which
    it was encrypted. This enforces fine-grained access control at the cryptographic level.
    
    Args:
        encrypted_blob: Encrypted key blob from encrypt_aes_key()
        user: User object with attributes (from storage.users.User)
        
    Returns:
        Decrypted AES key (bytes) if user attributes satisfy the policy.
        This key can then be used to decrypt the PHR file content.
        
    Raises:
        PermissionError: If user attributes do not satisfy the policy.
        This prevents unauthorized access even if the encrypted blob is obtained.
        
    Example:
        user = User("doctor1", {"Role": "Doctor", "Dept": "Cardiology"})
        aes_key = decrypt_aes_key(encrypted_blob, user)
        # Use aes_key to decrypt file content
    """
    return _backend.decrypt_key(encrypted_blob, user)
