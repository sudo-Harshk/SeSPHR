"""
CP-ABE Backend Interface

This module defines the interface for Ciphertext-Policy Attribute-Based Encryption (CP-ABE)
backends. CP-ABE is a cryptographic scheme that enables fine-grained access control
by encrypting data under access policies defined over user attributes.

Architectural Responsibilities:
- Key Encryption: Encrypt AES keys under attribute-based access policies
- Key Decryption: Decrypt AES keys only if user attributes satisfy the policy
- Policy Enforcement: Ensure access control is enforced at the cryptographic level

Note: Policy parsing and evaluation are handled separately by the policy module.
This interface focuses solely on the cryptographic operations.
"""


class CPABEBackend:
    """
    Abstract interface for CP-ABE cryptographic operations.
    
    This interface defines the contract for CP-ABE backends, allowing the system
    to swap between simulated and real CP-ABE implementations without changing
    the calling code.
    
    Responsibilities:
    - Encrypt AES keys under attribute-based policies
    - Decrypt AES keys based on user attribute satisfaction
    - Maintain cryptographic security guarantees
    """
    
    def encrypt_key(self, aes_key_bytes, policy):
        """
        Encrypt an AES key under a CP-ABE access policy.
        
        Args:
            aes_key_bytes: The AES key to encrypt (bytes)
            policy: Access policy string (e.g., "Role:Doctor AND Dept:Cardiology")
            
        Returns:
            Encrypted key blob (string) that can only be decrypted by users
            whose attributes satisfy the policy.
            
        Note:
            The policy string format is parsed and evaluated by the policy module.
            This method handles only the cryptographic encryption operation.
        """
        raise NotImplementedError

    def decrypt_key(self, encrypted_blob, user):
        """
        Decrypt an AES key using user attributes.
        
        Args:
            encrypted_blob: Encrypted key blob from encrypt_key()
            user: User object with attributes for policy evaluation
            
        Returns:
            Decrypted AES key (bytes) if user attributes satisfy the policy.
            
        Raises:
            PermissionError: If user attributes do not satisfy the policy.
            
        Note:
            Policy evaluation is performed to determine if decryption should succeed.
            This method handles only the cryptographic decryption operation.
        """
        raise NotImplementedError
